"""AutoCranker customer intake agent.

Calls the LLM with a rich structured prompt and returns an `IntakeResult`
containing the reply text plus all extracted data (vehicle, repair case,
appointment).  Falls back gracefully when the LLM is unavailable or returns
invalid JSON.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING, Any, Dict, List, Optional

if TYPE_CHECKING:
    from app.db.models import Customer, GarageSettings, RepairCase, Vehicle

from app.core.agent_log import log_agent_run
from app.core.llm import GeminiClient

logger = logging.getLogger(__name__)


@dataclass
class IntakeResult:
    reply: str
    intent: str = "collecting_info"
    handoff: bool = False
    # Repair case
    should_create_or_update_case: bool = False
    case_title: Optional[str] = None
    case_problem_summary: Optional[str] = None
    case_urgency: Optional[str] = None
    case_status: Optional[str] = None
    # Vehicle
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_year: Optional[int] = None
    vehicle_plate: Optional[str] = None
    vehicle_vin: Optional[str] = None
    vehicle_mileage: Optional[int] = None
    # Appointment
    should_book: bool = False
    appointment_start: Optional[datetime] = None
    appointment_end: Optional[datetime] = None
    appointment_type: Optional[str] = None
    calendar_notes: Optional[str] = None


class IntakeAgent:
    def __init__(self, llm_client: GeminiClient, app_name: str, system_prompt: str = "") -> None:
        self.llm_client = llm_client
        self.app_name = app_name
        self.system_prompt = system_prompt

    def run(
        self,
        message: str,
        history: List[Dict[str, Any]],
        customer: "Customer",
        active_case: Optional["RepairCase"],
        vehicle: Optional["Vehicle"],
        garage: Optional["GarageSettings"],
        booked_slots: Optional[List[datetime]] = None,
    ) -> IntakeResult:
        label = f"customer_id={customer.id}"
        if not self.llm_client.available:
            logger.warning("IntakeAgent: LLM not available, using fallback reply")
            result = self._fallback(message, customer)
            log_agent_run("intake", label, message=message, fallback="llm_unavailable", result=result)
            return result

        prompt = self._build_prompt(message, history, customer, active_case, vehicle, garage, booked_slots)
        raw = self.llm_client.generate_json(prompt)
        if not raw:
            logger.warning("IntakeAgent: LLM returned empty/invalid JSON, using fallback")
            result = self._fallback(message, customer)
            log_agent_run(
                "intake",
                label,
                message=message,
                prompt=prompt,
                raw=self.llm_client.last_raw_response,
                fallback="empty_or_invalid_json",
                result=result,
            )
            return result

        try:
            result = self._parse_result(raw)
            log_agent_run(
                "intake",
                label,
                message=message,
                prompt=prompt,
                raw=self.llm_client.last_raw_response,
                parsed=raw,
                result=result,
            )
            return result
        except Exception as exc:
            logger.exception("IntakeAgent: failed to parse LLM result")
            result = self._fallback(message, customer)
            log_agent_run(
                "intake",
                label,
                message=message,
                prompt=prompt,
                raw=self.llm_client.last_raw_response,
                parsed=raw,
                error=str(exc),
                fallback=True,
                result=result,
            )
            return result

    # ------------------------------------------------------------------
    # Prompt building
    # ------------------------------------------------------------------

    def _build_prompt(
        self,
        message: str,
        history: List[Dict[str, Any]],
        customer: "Customer",
        active_case: Optional["RepairCase"],
        vehicle: Optional["Vehicle"],
        garage: Optional["GarageSettings"],
        booked_slots: Optional[List[datetime]] = None,
    ) -> str:
        now = datetime.now(timezone.utc)
        garage_name = garage.name if garage else self.app_name
        tz_name = garage.timezone if garage else "UTC"
        opening_hours = _format_opening_hours(garage)

        customer_name = customer.name or "Unknown"
        vehicle_text = _format_vehicle(vehicle)
        active_case_text = _format_active_case(active_case)
        history_text = _format_history(history)
        booked_slots_text = _format_booked_slots(booked_slots)

        system_prefix = f"{self.system_prompt}\n\n" if self.system_prompt else ""
        return f"""{system_prefix}You are the AI front-desk assistant for {garage_name}, a car repair garage.

Today: {now.strftime("%A %d %B %Y")}. Time: {now.strftime("%H:%M")} UTC. Garage timezone: {tz_name}.

=== GARAGE OPENING HOURS ===
{opening_hours}

=== CUSTOMER ===
Name: {customer_name}
WhatsApp: {customer.phone_number}

=== KNOWN VEHICLE ===
{vehicle_text}

=== ACTIVE REPAIR CASE ===
{active_case_text}

=== ALREADY BOOKED APPOINTMENT SLOTS (unavailable) ===
{booked_slots_text}

=== CONVERSATION SO FAR ===
{history_text}

=== CUSTOMER'S CURRENT MESSAGE ===
{message}

=== YOUR TASK ===
Reply to the customer on WhatsApp. Be short and natural (this is a chat message).

CONVERSATION FLOW — follow this order strictly:
PHASE 1 (collecting_info): Collect ALL of the following before moving on — car problem description, vehicle make, vehicle model, vehicle year, mileage. Ask for only ONE missing field per message. Check KNOWN VEHICLE above first — do not ask for fields already filled. If the customer says "I don't know" or similar for a field, skip it and move to the next. Stay in Phase 1 until all collectible fields are known or skipped.
PHASE 2 (confirm): Once all fields are collected/skipped, ask "Is there anything else you'd like to add?" Set intent="collecting_info" and should_book=false. If the customer adds more info, acknowledge it briefly and ask again. Stay in Phase 2 until the customer says no / nothing more.
PHASE 3 (appointment): ONLY after the customer declines to add more — propose the earliest available slot within opening hours and NOT in the ALREADY BOOKED list. Set should_book=true and intent="appointment_booked" only when the customer explicitly confirms the proposed slot.

RULES:
1. Always reply in English.
2. ALWAYS ask for car-related information — even on the very first message (greeting, hello, etc). Never just say hi back. Always immediately ask what the issue with their car is.
3. If the customer goes off-topic (weather, general chat, unrelated questions), briefly redirect: "I can only help with car repair bookings. What's the issue with your car?"
4. If the customer describes any car problem or repair need, set repair_case.should_create_or_update = true.
5. NEVER invent prices, diagnoses, guaranteed repair durations, or parts availability.
6. Mention that the garage will inspect first and send a quote before any work — only on the first relevant message, never repeat it.
7. If a proposed slot is in the ALREADY BOOKED list, do NOT say the garage is closed. Say something like "That slot is already taken — the next available time is X." Then propose the next free slot within opening hours.
8. Do NOT set intent="appointment_booked" or should_book=true until the customer has confirmed a specific slot.
9. For any vehicle fields the customer did not provide or skipped, always return null — never guess.

URGENCY values: "low" | "medium" | "medium_high" | "high" | "critical"
STATUS values: "collecting_info" | "appointment_booked"

Return ONLY the following JSON (no markdown fences, no extra text):
{{
  "reply": "your WhatsApp reply",
  "intent": "collecting_info",
  "handoff": false,
  "repair_case": {{
    "should_create_or_update": false,
    "title": null,
    "problem_summary": null,
    "urgency": null,
    "status": "collecting_info"
  }},
  "vehicle": {{
    "make": null,
    "model": null,
    "year": null,
    "plate": null,
    "vin": null,
    "mileage": null
  }},
  "appointment": {{
    "should_book": false,
    "requested_start": null,
    "requested_end": null,
    "appointment_type": null,
    "calendar_notes": null
  }}
}}""".strip()

    # ------------------------------------------------------------------
    # Result parsing
    # ------------------------------------------------------------------

    def _parse_result(self, data: Dict[str, Any]) -> IntakeResult:
        reply = str(data.get("reply", "")).strip()
        if not reply:
            reply = "Thanks for your message. We'll be in touch shortly."

        intent = str(data.get("intent", "collecting_info"))
        handoff = bool(data.get("handoff", False))

        rc = data.get("repair_case") or {}
        veh = data.get("vehicle") or {}
        appt = data.get("appointment") or {}

        # Parse appointment datetimes.
        appt_start: Optional[datetime] = None
        appt_end: Optional[datetime] = None
        should_book = bool(appt.get("should_book", False))

        if should_book and appt.get("requested_start"):
            appt_start = _parse_dt(appt["requested_start"])

        if appt_start:
            if appt.get("requested_end"):
                appt_end = _parse_dt(appt["requested_end"])
            if not appt_end:
                appt_end = appt_start + timedelta(minutes=45)
        else:
            should_book = False  # can't book without a start time

        return IntakeResult(
            reply=reply,
            intent=intent,
            handoff=handoff,
            should_create_or_update_case=bool(rc.get("should_create_or_update", False)),
            case_title=_str_or_none(rc.get("title")),
            case_problem_summary=_str_or_none(rc.get("problem_summary")),
            case_urgency=_str_or_none(rc.get("urgency")),
            case_status=_str_or_none(rc.get("status")),
            vehicle_make=_str_or_none(veh.get("make")),
            vehicle_model=_str_or_none(veh.get("model")),
            vehicle_year=_int_or_none(veh.get("year")),
            vehicle_plate=_str_or_none(veh.get("plate")),
            vehicle_vin=_str_or_none(veh.get("vin")),
            vehicle_mileage=_int_or_none(veh.get("mileage")),
            should_book=should_book,
            appointment_start=appt_start,
            appointment_end=appt_end,
            appointment_type=_str_or_none(appt.get("appointment_type")),
            calendar_notes=_str_or_none(appt.get("calendar_notes")),
        )

    # ------------------------------------------------------------------
    # Fallback (no LLM)
    # ------------------------------------------------------------------

    def _fallback(self, message: str, customer: "Customer") -> IntakeResult:
        name = (customer.name or "").split(" ")[0] if customer.name else "there"
        text = message.lower().strip()
        if text in {"hi", "hello", "hey", "good morning", "good afternoon", "hola"}:
            reply = (
                f"Hi {name}! Welcome to {self.app_name}. "
                "How can we help you today? Please describe your car issue and "
                "we'll get back to you as soon as possible."
            )
        else:
            reply = (
                f"Thanks for reaching out to {self.app_name}. "
                "Our AI assistant is temporarily unavailable. "
                "A team member will review your message and get back to you shortly."
            )
        return IntakeResult(reply=reply)


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------


def _format_booked_slots(slots: Optional[List[datetime]]) -> str:
    if not slots:
        return "None — all slots are available."
    return "\n".join(f"  - {dt.strftime('%A %d %B %Y at %H:%M UTC')}" for dt in slots)


def _format_opening_hours(garage: Optional["GarageSettings"]) -> str:
    if not garage or not garage.opening_hours_json:
        return "Not configured."
    try:
        hours: Dict[str, str] = json.loads(garage.opening_hours_json)
        return "\n".join(f"  {day.capitalize()}: {val}" for day, val in hours.items())
    except Exception:
        return garage.opening_hours_json


def _format_vehicle(vehicle: Optional["Vehicle"]) -> str:
    if not vehicle:
        return "None on record."
    parts = [
        f"Make: {vehicle.make or '?'}",
        f"Model: {vehicle.model or '?'}",
        f"Year: {vehicle.year or '?'}",
        f"Plate: {vehicle.plate or '?'}",
        f"VIN: {vehicle.vin or '?'}",
        f"Mileage: {vehicle.mileage or '?'} km",
    ]
    return ", ".join(parts)


def _format_active_case(case: Optional["RepairCase"]) -> str:
    if not case:
        return "None."
    return (
        f"ID: {case.id}, Status: {case.status}, Title: {case.title or 'Untitled'}, "
        f"Summary: {case.problem_summary or 'N/A'}"
    )


def _format_history(history: List[Dict[str, Any]]) -> str:
    if not history:
        return "(no prior messages)"
    lines = []
    for turn in history:
        role = turn.get("role", "?")
        text = turn.get("text", "")
        lines.append(f"  [{role}]: {text}")
    return "\n".join(lines)


def _str_or_none(val: Any) -> Optional[str]:
    if val is None or str(val).strip().lower() in {"null", "none", ""}:
        return None
    return str(val).strip()


def _int_or_none(val: Any) -> Optional[int]:
    if val is None:
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def _parse_dt(val: Any) -> Optional[datetime]:
    if not val:
        return None
    try:
        s = str(val).strip()
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        return None
