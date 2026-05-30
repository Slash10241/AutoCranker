"""AutoCranker quotation agent.

Takes raw technician inspection notes and returns structured findings + a
quotation draft.  Falls back gracefully when the LLM is unavailable.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Dict, List, Optional

if TYPE_CHECKING:
    from app.db.models import GarageSettings, InventoryItem, RepairCase, Vehicle

from app.core.llm import GeminiClient

logger = logging.getLogger(__name__)


@dataclass
class QuotationItemResult:
    item_type: str  # labor / part / fee / other
    description: str
    quantity: float
    unit_price: float
    source: str = "ai_suggested"  # ai_suggested / inventory / manual

    @property
    def total(self) -> float:
        return round(self.quantity * self.unit_price, 2)


@dataclass
class QuotationAgentResult:
    inspection_summary: str
    urgency: str
    findings: List[Dict[str, Any]] = field(default_factory=list)
    recommended_actions: List[str] = field(default_factory=list)
    internal_summary: str = ""
    customer_explanation: str = ""
    quote_urgency: str = "medium"
    items: List[QuotationItemResult] = field(default_factory=list)


class QuotationAgent:
    def __init__(self, llm_client: GeminiClient) -> None:
        self.llm_client = llm_client

    def run(
        self,
        raw_notes: str,
        repair_case: "RepairCase",
        vehicle: Optional["Vehicle"],
        garage: Optional["GarageSettings"],
        inventory: List["InventoryItem"],
    ) -> QuotationAgentResult:
        if not self.llm_client.available:
            logger.warning("QuotationAgent: LLM not available, using fallback")
            return self._fallback(raw_notes)

        prompt = self._build_prompt(raw_notes, repair_case, vehicle, garage, inventory)
        raw = self.llm_client.generate_json(prompt)
        if not raw:
            logger.warning("QuotationAgent: LLM returned empty/invalid JSON, using fallback")
            return self._fallback(raw_notes)

        try:
            return self._parse_result(raw, garage, inventory)
        except Exception:
            logger.exception("QuotationAgent: failed to parse LLM result")
            return self._fallback(raw_notes)

    # ------------------------------------------------------------------
    # Prompt building
    # ------------------------------------------------------------------

    def _build_prompt(
        self,
        raw_notes: str,
        repair_case: "RepairCase",
        vehicle: Optional["Vehicle"],
        garage: Optional["GarageSettings"],
        inventory: List["InventoryItem"],
    ) -> str:
        garage_name = garage.name if garage else "AutoCranker"
        labor_rate = garage.labor_rate if garage else 75.0
        currency = garage.currency if garage else "EUR"

        vehicle_text = "Unknown vehicle"
        if vehicle:
            parts = [vehicle.make, vehicle.model, str(vehicle.year) if vehicle.year else None]
            vehicle_text = " ".join(p for p in parts if p) or "Unknown"
            if vehicle.mileage:
                vehicle_text += f" ({vehicle.mileage:,} km)"

        inventory_text = "No inventory loaded."
        if inventory:
            lines = [
                f"  - {item.name} (SKU: {item.sku or 'N/A'}): {currency} {item.selling_price or 'N/A'}"
                for item in inventory
            ]
            inventory_text = "\n".join(lines)

        return f"""You are the AI workshop assistant for {garage_name}, a car repair garage.

=== JOB CONTEXT ===
Repair case: {repair_case.title or 'Vehicle inspection'}
Customer-reported problem: {repair_case.problem_summary or 'Not specified'}
Vehicle: {vehicle_text}

=== AVAILABLE INVENTORY (name + selling price) ===
{inventory_text}

=== LABOR RATE ===
{currency} {labor_rate:.2f} per hour

=== TECHNICIAN INSPECTION NOTES ===
{raw_notes}

=== YOUR TASK ===
1. Summarize the inspection findings clearly in 2-3 sentences.
2. Extract structured findings per component.
3. List recommended actions.
4. Generate a quotation draft with line items.

RULES:
- You MUST NOT claim certainty beyond what the technician notes say.
- You MUST NOT invent diagnosis if notes are unclear — say "requires further inspection".
- The customer_explanation must be plain English, non-technical, and under 60 words.
- For parts: if a matching inventory item exists, use its selling_price and set source to "inventory". Otherwise estimate a fair market price and set source to "ai_suggested".
- For labor: calculate hours * labor rate. Use realistic time estimates.
- Urgency values: "low" | "medium" | "medium_high" | "high" | "critical"
- All text in English.

Return ONLY the following JSON (no markdown, no extra text):
{{
  "inspection_summary": "2-3 sentence summary of findings",
  "urgency": "high",
  "findings": [
    {{
      "component": "Front brake pads",
      "condition": "Heavily worn",
      "urgency": "high",
      "recommended_action": "Replace front brake pads"
    }}
  ],
  "recommended_actions": ["Replace front brake pads", "Replace front brake discs"],
  "quotation": {{
    "internal_summary": "Technical summary for the owner",
    "customer_explanation": "Plain explanation for the customer",
    "urgency": "high",
    "items": [
      {{
        "item_type": "part",
        "description": "Front brake pads",
        "quantity": 1,
        "unit_price": 65.0,
        "source": "inventory"
      }},
      {{
        "item_type": "labor",
        "description": "Replace front brake pads and discs",
        "quantity": 1.5,
        "unit_price": {labor_rate:.2f},
        "source": "ai_suggested"
      }}
    ]
  }}
}}""".strip()

    # ------------------------------------------------------------------
    # Result parsing
    # ------------------------------------------------------------------

    def _parse_result(
        self,
        data: Dict[str, Any],
        garage: Optional["GarageSettings"],
        inventory: List["InventoryItem"],
    ) -> QuotationAgentResult:
        # Build quick name→price lookup for inventory matching.
        inv_lookup: Dict[str, float] = {}
        for item in inventory:
            if item.selling_price:
                inv_lookup[item.name.lower()] = item.selling_price

        summary = str(data.get("inspection_summary", "Inspection completed.")).strip()
        urgency = str(data.get("urgency", "medium"))
        findings = data.get("findings") or []
        recommended_actions = data.get("recommended_actions") or []

        q = data.get("quotation") or {}
        internal_summary = str(q.get("internal_summary", "")).strip()
        customer_explanation = str(q.get("customer_explanation", "")).strip()
        quote_urgency = str(q.get("urgency", urgency))

        items: List[QuotationItemResult] = []
        for raw_item in q.get("items") or []:
            try:
                desc = str(raw_item.get("description", "")).strip()
                if not desc:
                    continue
                item_type = str(raw_item.get("item_type", "part"))
                qty = float(raw_item.get("quantity", 1))
                unit_price = float(raw_item.get("unit_price", 0))
                source = str(raw_item.get("source", "ai_suggested"))

                # Try to match against inventory by fuzzy name.
                matched_price = _fuzzy_inventory_price(desc, inv_lookup)
                if matched_price is not None and source != "ai_suggested":
                    unit_price = matched_price
                    source = "inventory"

                items.append(QuotationItemResult(
                    item_type=item_type,
                    description=desc,
                    quantity=qty,
                    unit_price=unit_price,
                    source=source,
                ))
            except (TypeError, ValueError):
                continue

        return QuotationAgentResult(
            inspection_summary=summary,
            urgency=urgency,
            findings=findings if isinstance(findings, list) else [],
            recommended_actions=recommended_actions if isinstance(recommended_actions, list) else [],
            internal_summary=internal_summary,
            customer_explanation=customer_explanation,
            quote_urgency=quote_urgency,
            items=items,
        )

    # ------------------------------------------------------------------
    # Fallback (no LLM)
    # ------------------------------------------------------------------

    def _fallback(self, raw_notes: str) -> QuotationAgentResult:
        return QuotationAgentResult(
            inspection_summary="Technician inspection notes recorded. AI analysis unavailable — please review notes manually.",
            urgency="medium",
            findings=[],
            recommended_actions=[],
            internal_summary="AI analysis unavailable. Please review technician notes.",
            customer_explanation="We have completed the initial inspection. Our team will be in touch with a detailed quote shortly.",
            quote_urgency="medium",
            items=[],
        )


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _fuzzy_inventory_price(description: str, inv_lookup: Dict[str, float]) -> Optional[float]:
    """Return inventory price if description closely matches an inventory item name."""
    desc_lower = description.lower()
    # Exact match
    if desc_lower in inv_lookup:
        return inv_lookup[desc_lower]
    # Partial match: inventory name contained in description or vice versa
    for name, price in inv_lookup.items():
        if name in desc_lower or desc_lower in name:
            return price
    return None
