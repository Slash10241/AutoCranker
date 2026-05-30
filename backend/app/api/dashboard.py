"""Dashboard REST endpoints for the AutoCranker frontend."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.crud import (
    create_inspection,
    create_quotation_with_items,
    create_repair_case,
    get_customer,
    get_garage_settings,
    get_latest_inspection,
    get_latest_quotation,
    get_messages_for_customer,
    get_quotation,
    get_repair_case,
    list_customers,
    list_inventory,
    list_providers,
    list_repair_cases,
    update_quotation,
    update_repair_case,
)
from app.db.session import get_db
from app.schemas import (
    CustomerOut,
    GarageSettingsOut,
    InventoryItemOut,
    InspectionOut,
    InspectionSubmit,
    MessageOut,
    ProviderOut,
    QuotationOut,
    QuotationUpdate,
    RepairCaseCreate,
    RepairCaseListItemOut,
    RepairCaseOut,
    RepairCaseUpdate,
)
from app.services import get_services

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["dashboard"])

# Status → human-readable blocker description shown on the dashboard.
_BLOCKER: dict[str, str] = {
    "new_request": "New request — waiting for review",
    "collecting_info": "Waiting for customer information",
    "appointment_booked": "Waiting for customer to bring the car",
    "checked_in": "Car checked in — waiting for inspection",
    "inspection_pending": "Waiting for technician inspection",
    "inspection_done": "Ready to generate quotation",
    "quote_draft": "Quote draft in progress",
    "quote_waiting_owner_approval": "Waiting for owner to review quotation",
    "quote_sent": "Waiting for customer approval",
    "customer_approved": "Ready to start repair",
    "customer_declined": "Customer declined",
    "waiting_for_parts": "Waiting for parts",
    "in_repair": "Repair in progress",
    "ready_for_pickup": "Waiting for customer pickup",
    "closed": "Closed",
}


def _vehicle_label(case) -> Optional[str]:
    v = case.vehicle
    if not v:
        return None
    parts = [p for p in [v.make, v.model, str(v.year) if v.year else None] if p]
    return " ".join(parts) or v.plate or None


def _to_list_item(case, db: Session) -> RepairCaseListItemOut:
    customer = case.customer
    inspection = get_latest_inspection(db, case.id)
    quotation = get_latest_quotation(db, case.id)
    return RepairCaseListItemOut(
        id=case.id,
        customer_id=case.customer_id,
        customer_name=customer.name if customer else None,
        phone_number=customer.phone_number if customer else "",
        vehicle_id=case.vehicle_id,
        vehicle_label=_vehicle_label(case),
        status=case.status,
        title=case.title,
        problem_summary=case.problem_summary,
        urgency=case.urgency,
        appointment_start=case.appointment_start,
        appointment_end=case.appointment_end,
        appointment_type=getattr(case, "appointment_type", None),
        blocker=_BLOCKER.get(case.status),
        inspection_summary=inspection.ai_summary if inspection else None,
        quotation_status=quotation.status if quotation else None,
        quotation_total=quotation.total if quotation else None,
        created_at=case.created_at,
        updated_at=case.updated_at,
    )


# ---------------------------------------------------------------------------
# Repair cases
# ---------------------------------------------------------------------------


@router.get("/repair-cases", response_model=List[RepairCaseListItemOut])
def api_list_repair_cases(
    skip: int = 0, limit: int = 100, db: Session = Depends(get_db)
) -> List[RepairCaseListItemOut]:
    cases = list_repair_cases(db, skip=skip, limit=limit)
    return [_to_list_item(c, db) for c in cases]


@router.get("/repair-cases/{case_id}", response_model=RepairCaseOut)
def api_get_repair_case(case_id: int, db: Session = Depends(get_db)) -> RepairCaseOut:
    case = get_repair_case(db, case_id)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repair case not found")
    return case


@router.post("/repair-cases", response_model=RepairCaseOut, status_code=status.HTTP_201_CREATED)
def api_create_repair_case(
    body: RepairCaseCreate, db: Session = Depends(get_db)
) -> RepairCaseOut:
    customer = get_customer(db, body.customer_id)
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    case = create_repair_case(
        db,
        customer_id=body.customer_id,
        vehicle_id=body.vehicle_id,
        title=body.title,
        problem_summary=body.problem_summary,
        urgency=body.urgency,
        status=body.status,
    )
    return case


@router.patch("/repair-cases/{case_id}", response_model=RepairCaseOut)
def api_update_repair_case(
    case_id: int, body: RepairCaseUpdate, db: Session = Depends(get_db)
) -> RepairCaseOut:
    case = update_repair_case(db, case_id, body.model_dump(exclude_none=True))
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repair case not found")
    return case


# ---------------------------------------------------------------------------
# Chat summary
# ---------------------------------------------------------------------------


@router.post("/repair-cases/{case_id}/chat-summary")
def api_chat_summary(case_id: int, db: Session = Depends(get_db)) -> dict:
    case = get_repair_case(db, case_id)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repair case not found")

    messages = get_messages_for_customer(db, case.customer_id, limit=100)
    if not messages:
        return {"summary": "No messages found for this case."}

    services = get_services()
    if not services.llm_client.available:
        return {"summary": "AI summary unavailable — LLM not configured."}

    transcript = "\n".join(
        f"[{m.role.upper()}]: {m.content}" for m in messages
    )

    vehicle = case.vehicle
    vehicle_hint = ""
    if vehicle:
        parts = [vehicle.make, vehicle.model, str(vehicle.year) if vehicle.year else None]
        vehicle_hint = " ".join(p for p in parts if p)

    prompt = f"""You are a garage assistant. Read the following WhatsApp conversation between a customer and the AutoCranker AI intake bot.

Write a concise 2-3 sentence summary for the garage technician covering:
1. The main problem(s) the customer reported
2. Key vehicle details (make, model, year, mileage if mentioned)
3. Any urgency or important context

Be factual, terse, and professional. Do not include greetings or filler.

Known vehicle: {vehicle_hint or "unknown"}

--- TRANSCRIPT ---
{transcript}
--- END TRANSCRIPT ---

Return ONLY JSON:
{{"summary": "your summary here"}}"""

    result = services.llm_client.generate_json(prompt)
    summary = (result or {}).get("summary", "Could not generate summary.")
    return {"summary": summary}


# ---------------------------------------------------------------------------
# Check-in
# ---------------------------------------------------------------------------


@router.post("/repair-cases/{case_id}/check-in", response_model=RepairCaseOut)
def api_check_in(case_id: int, db: Session = Depends(get_db)) -> RepairCaseOut:
    case = get_repair_case(db, case_id)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repair case not found")
    updated = update_repair_case(db, case_id, {
        "status": "inspection_pending",
    })
    return updated


# ---------------------------------------------------------------------------
# Inspection
# ---------------------------------------------------------------------------


@router.post("/repair-cases/{case_id}/inspection", response_model=InspectionOut, status_code=status.HTTP_201_CREATED)
def api_submit_inspection(
    case_id: int,
    body: InspectionSubmit,
    db: Session = Depends(get_db),
) -> InspectionOut:
    case = get_repair_case(db, case_id)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repair case not found")

    services = get_services()
    vehicle = case.vehicle
    garage = get_garage_settings(db)
    inventory = list_inventory(db)

    agent_result = services.quotation_agent.run(
        raw_notes=body.raw_notes,
        repair_case=case,
        vehicle=vehicle,
        garage=garage,
        inventory=inventory,
    )

    media_json = json.dumps(body.media_urls) if body.media_urls else None

    inspection = create_inspection(
        db,
        repair_case_id=case_id,
        raw_notes=body.raw_notes,
        technician_name=body.technician_name,
        ai_summary=agent_result.inspection_summary,
        urgency=agent_result.urgency,
        findings_json=json.dumps(agent_result.findings),
        recommended_actions_json=json.dumps(agent_result.recommended_actions),
        media_urls_json=media_json,
    )

    update_repair_case(db, case_id, {"status": "inspection_done"})

    logger.info("Inspection %d created for case %d, urgency=%s", inspection.id, case_id, agent_result.urgency)
    return inspection


@router.get("/repair-cases/{case_id}/inspection", response_model=Optional[InspectionOut])
def api_get_inspection(case_id: int, db: Session = Depends(get_db)):
    inspection = get_latest_inspection(db, case_id)
    if not inspection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No inspection found")
    return inspection


# ---------------------------------------------------------------------------
# Quotation
# ---------------------------------------------------------------------------


@router.post("/repair-cases/{case_id}/quotation/generate", response_model=QuotationOut, status_code=status.HTTP_201_CREATED)
def api_generate_quotation(
    case_id: int,
    db: Session = Depends(get_db),
) -> QuotationOut:
    case = get_repair_case(db, case_id)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repair case not found")

    inspection = get_latest_inspection(db, case_id)
    if not inspection:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No inspection found for this case. Submit an inspection first.")

    services = get_services()
    vehicle = case.vehicle
    garage = get_garage_settings(db)
    inventory = list_inventory(db)

    agent_result = services.quotation_agent.run(
        raw_notes=inspection.raw_notes,
        repair_case=case,
        vehicle=vehicle,
        garage=garage,
        inventory=inventory,
    )

    tax_rate = getattr(garage, "tax_rate", 0.21) if garage else 0.21
    currency = garage.currency if garage else "EUR"

    items_data = [
        {
            "item_type": item.item_type,
            "description": item.description,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "source": item.source,
        }
        for item in agent_result.items
    ]

    quotation = create_quotation_with_items(
        db,
        repair_case_id=case_id,
        inspection_id=inspection.id,
        internal_summary=agent_result.internal_summary,
        customer_explanation=agent_result.customer_explanation,
        urgency=agent_result.quote_urgency,
        currency=currency,
        tax_rate=tax_rate,
        items_data=items_data,
        status="waiting_owner_approval",
    )

    update_repair_case(db, case_id, {"status": "quote_waiting_owner_approval"})

    logger.info(
        "Quotation %d generated for case %d: subtotal=%.2f total=%.2f %s",
        quotation.id, case_id, quotation.subtotal, quotation.total, currency,
    )
    return quotation


@router.get("/repair-cases/{case_id}/quotation", response_model=QuotationOut)
def api_get_quotation(case_id: int, db: Session = Depends(get_db)) -> QuotationOut:
    quotation = get_latest_quotation(db, case_id)
    if not quotation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No quotation found for this case")
    return quotation


@router.patch("/quotations/{quotation_id}", response_model=QuotationOut)
def api_update_quotation(
    quotation_id: int, body: QuotationUpdate, db: Session = Depends(get_db)
) -> QuotationOut:
    quotation = update_quotation(db, quotation_id, body.model_dump(exclude_none=True))
    if not quotation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quotation not found")
    return quotation


@router.post("/quotations/{quotation_id}/approve", response_model=QuotationOut)
def api_approve_quotation(quotation_id: int, db: Session = Depends(get_db)) -> QuotationOut:
    quotation = get_quotation(db, quotation_id)
    if not quotation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quotation not found")
    update_quotation(db, quotation_id, {"status": "approved_by_owner"})
    update_repair_case(db, quotation.repair_case_id, {"status": "quote_draft"})
    db.refresh(quotation)
    return quotation


# ---------------------------------------------------------------------------
# Calendar / appointments
# ---------------------------------------------------------------------------


@router.get("/calendar/appointments", response_model=List[RepairCaseListItemOut])
def api_calendar_appointments(db: Session = Depends(get_db)) -> List[RepairCaseListItemOut]:
    from app.db.models import RepairCase
    from sqlalchemy import asc

    cases = (
        db.query(RepairCase)
        .filter(RepairCase.appointment_start.isnot(None))
        .order_by(asc(RepairCase.appointment_start))
        .all()
    )
    return [_to_list_item(c, db) for c in cases]


# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------


@router.get("/customers", response_model=List[CustomerOut])
def api_list_customers(
    skip: int = 0, limit: int = 100, db: Session = Depends(get_db)
) -> List[CustomerOut]:
    return list_customers(db, skip=skip, limit=limit)


@router.get("/customers/{customer_id}", response_model=CustomerOut)
def api_get_customer(customer_id: int, db: Session = Depends(get_db)) -> CustomerOut:
    customer = get_customer(db, customer_id)
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return customer


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------


@router.get("/messages/{customer_id}", response_model=List[MessageOut])
def api_get_messages(
    customer_id: int, limit: int = 50, db: Session = Depends(get_db)
) -> List[MessageOut]:
    customer = get_customer(db, customer_id)
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return get_messages_for_customer(db, customer_id, limit=limit)


# ---------------------------------------------------------------------------
# Garage settings
# ---------------------------------------------------------------------------


@router.get("/garage-settings", response_model=GarageSettingsOut)
def api_garage_settings(db: Session = Depends(get_db)) -> GarageSettingsOut:
    settings = get_garage_settings(db)
    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Garage settings not found. Run seed first.",
        )
    return settings


# ---------------------------------------------------------------------------
# Inventory & providers (read-only for now)
# ---------------------------------------------------------------------------


@router.get("/inventory", response_model=List[InventoryItemOut])
def api_list_inventory(db: Session = Depends(get_db)) -> List[InventoryItemOut]:
    return list_inventory(db)


@router.get("/providers", response_model=List[ProviderOut])
def api_list_providers(db: Session = Depends(get_db)) -> List[ProviderOut]:
    return list_providers(db)
