"""WhatsApp webhook adapter — Phase 2: intake agent flow.

Make.com WhatsApp payload → intake agent → DB updates → BotReply JSON
"""

from __future__ import annotations

import hmac
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db.crud import (
    create_message,
    create_repair_case,
    get_active_repair_case_for_customer,
    get_or_create_customer,
    get_or_update_vehicle,
    get_recent_history_for_llm,
    is_message_seen,
    update_repair_case,
)
from app.db.session import get_db
from app.memory import InMemoryStore, get_store
from app.schemas import BotReply, WhatsAppPayload
from app.services import AppServices, get_services

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks/make", tags=["whatsapp"])


def _verify_secret(provided: Optional[str], expected: str) -> None:
    if not expected:
        logger.error("MAKE_WEBHOOK_SECRET is not configured; rejecting request.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server secret not configured",
        )
    if not provided or not hmac.compare_digest(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid secret",
        )


@router.post("/whatsapp", response_model=BotReply)
def whatsapp_webhook(
    payload: WhatsAppPayload,
    x_bot_secret: Optional[str] = Header(default=None, alias="X-Bot-Secret"),
    settings: Settings = Depends(get_settings),
    store: InMemoryStore = Depends(get_store),
    services: AppServices = Depends(get_services),
    db: Session = Depends(get_db),
) -> BotReply:
    _verify_secret(x_bot_secret, settings.make_webhook_secret)

    logger.info(
        "incoming whatsapp wa_id=%s message_id=%s name=%r text=%r",
        payload.wa_id,
        payload.message_id,
        payload.name,
        payload.message[:80],
    )

    if not payload.wa_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="wa_id is required",
        )

    # Two-layer deduplication: in-memory (fast) + DB (cross-restart).
    if store.already_seen(payload.message_id):
        logger.info("duplicate (memory) message_id=%s", payload.message_id)
        return BotReply(reply="", status="duplicate", handoff=False)

    if payload.message_id and is_message_seen(db, payload.message_id):
        logger.info("duplicate (db) message_id=%s", payload.message_id)
        store.mark_seen(payload.message_id)
        return BotReply(reply="", status="duplicate", handoff=False)

    store.mark_seen(payload.message_id)

    # ----------------------------------------------------------------
    # 1. Resolve customer
    # ----------------------------------------------------------------
    customer = get_or_create_customer(db, payload.wa_id, payload.name)

    # ----------------------------------------------------------------
    # 2. Persist inbound message
    # ----------------------------------------------------------------
    create_message(
        db,
        customer_id=customer.id,
        role="customer",
        content=payload.message,
        channel="whatsapp",
        external_message_id=payload.message_id,
    )

    # ----------------------------------------------------------------
    # 3. Load context for the intake agent
    # ----------------------------------------------------------------
    history = get_recent_history_for_llm(db, customer.id, limit=10)
    active_case = get_active_repair_case_for_customer(db, customer.id)

    from app.db.models import Vehicle
    vehicle = db.query(Vehicle).filter(Vehicle.customer_id == customer.id).first()

    from app.db.crud import get_garage_settings
    garage = get_garage_settings(db)

    # ----------------------------------------------------------------
    # 4. Run intake agent
    # ----------------------------------------------------------------
    result = services.intake_agent.run(
        message=payload.message,
        history=history,
        customer=customer,
        active_case=active_case,
        vehicle=vehicle,
        garage=garage,
    )

    logger.info(
        "intake result intent=%s should_update_case=%s should_book=%s",
        result.intent,
        result.should_create_or_update_case,
        result.should_book,
    )

    # ----------------------------------------------------------------
    # 5. Apply vehicle data
    # ----------------------------------------------------------------
    vehicle_data = {
        "make": result.vehicle_make,
        "model": result.vehicle_model,
        "year": result.vehicle_year,
        "plate": result.vehicle_plate,
        "vin": result.vehicle_vin,
        "mileage": result.vehicle_mileage,
    }
    vehicle = get_or_update_vehicle(db, customer.id, vehicle_data)

    # ----------------------------------------------------------------
    # 6. Apply repair case data
    # ----------------------------------------------------------------
    if result.should_create_or_update_case:
        case_updates = {}
        if result.case_title:
            case_updates["title"] = result.case_title
        if result.case_problem_summary:
            case_updates["problem_summary"] = result.case_problem_summary
        if result.case_urgency:
            case_updates["urgency"] = result.case_urgency
        if result.case_status:
            case_updates["status"] = result.case_status
        if result.should_book and result.appointment_start:
            case_updates["appointment_start"] = result.appointment_start
            case_updates["appointment_end"] = result.appointment_end
            case_updates["status"] = "appointment_booked"
        if result.appointment_type:
            case_updates["appointment_type"] = result.appointment_type
        if result.calendar_notes:
            case_updates["calendar_notes"] = result.calendar_notes
        if vehicle:
            case_updates["vehicle_id"] = vehicle.id

        if active_case:
            update_repair_case(db, active_case.id, case_updates)
        else:
            create_repair_case(
                db,
                customer_id=customer.id,
                vehicle_id=vehicle.id if vehicle else None,
                title=result.case_title,
                problem_summary=result.case_problem_summary,
                urgency=result.case_urgency,
                status=case_updates.get("status", "collecting_info"),
                appointment_start=result.appointment_start if result.should_book else None,
                appointment_end=result.appointment_end if result.should_book else None,
                appointment_type=result.appointment_type,
                calendar_notes=result.calendar_notes,
            )

    # ----------------------------------------------------------------
    # 7. Persist assistant reply
    # ----------------------------------------------------------------
    if result.reply:
        create_message(
            db,
            customer_id=customer.id,
            role="assistant",
            content=result.reply,
            channel="whatsapp",
            external_message_id=None,
        )

    return BotReply(
        reply=result.reply,
        status="ok",
        handoff=result.handoff,
        intent=result.intent,
    )
