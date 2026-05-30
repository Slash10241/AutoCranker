"""Frontend chat API — local WhatsApp simulator entry point.

POST /api/chat          — send a message, run intake agent, return BotReply
GET  /api/chat/{session_id}/messages — load conversation history for a session
"""

from __future__ import annotations

import hmac
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db.crud import (
    create_message,
    create_repair_case,
    get_active_repair_case_for_customer,
    get_customer_by_phone,
    get_garage_settings,
    get_messages_for_customer,
    get_or_create_customer,
    get_or_update_vehicle,
    get_recent_history_for_llm,
    is_message_seen,
    update_repair_case,
)
from app.db.models import Vehicle
from app.db.session import get_db
from app.memory import InMemoryStore, get_store
from app.schemas import BotReply, FrontendChatMessage, MessageOut
from app.services import AppServices, get_services

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["chat"])

_CHANNEL = "web"


def _verify_api_key(provided: Optional[str], expected: str) -> None:
    if not expected:
        return
    if not provided or not hmac.compare_digest(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )


@router.get("/chat/{session_id}/messages", response_model=List[MessageOut])
def get_chat_messages(
    session_id: str,
    limit: int = 50,
    x_api_key: Optional[str] = Header(default=None, alias="X-Api-Key"),
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
) -> List[MessageOut]:
    _verify_api_key(x_api_key, settings.frontend_api_key)

    customer = get_customer_by_phone(db, session_id)
    if not customer:
        return []
    return get_messages_for_customer(db, customer.id, limit=limit)


@router.post("/chat", response_model=BotReply)
def frontend_chat(
    payload: FrontendChatMessage,
    x_api_key: Optional[str] = Header(default=None, alias="X-Api-Key"),
    settings: Settings = Depends(get_settings),
    store: InMemoryStore = Depends(get_store),
    services: AppServices = Depends(get_services),
    db: Session = Depends(get_db),
) -> BotReply:
    _verify_api_key(x_api_key, settings.frontend_api_key)

    logger.info(
        "incoming frontend chat session_id=%s message_id=%s name=%r text=%r",
        payload.session_id,
        payload.message_id,
        payload.name,
        payload.message[:80],
    )

    if not payload.session_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="session_id is required",
        )

    if store.already_seen(payload.message_id):
        logger.info("duplicate (memory) message_id=%s", payload.message_id)
        return BotReply(reply="", status="duplicate", handoff=False)

    if payload.message_id and is_message_seen(db, payload.message_id):
        logger.info("duplicate (db) message_id=%s", payload.message_id)
        store.mark_seen(payload.message_id)
        return BotReply(reply="", status="duplicate", handoff=False)

    store.mark_seen(payload.message_id)

    customer = get_or_create_customer(db, payload.session_id, payload.name)

    create_message(
        db,
        customer_id=customer.id,
        role="customer",
        content=payload.message,
        channel=_CHANNEL,
        external_message_id=payload.message_id,
    )

    history = get_recent_history_for_llm(db, customer.id, limit=10)
    active_case = get_active_repair_case_for_customer(db, customer.id)
    vehicle = db.query(Vehicle).filter(Vehicle.customer_id == customer.id).first()
    garage = get_garage_settings(db)

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

    vehicle_data = {
        "make": result.vehicle_make,
        "model": result.vehicle_model,
        "year": result.vehicle_year,
        "plate": result.vehicle_plate,
        "vin": result.vehicle_vin,
        "mileage": result.vehicle_mileage,
    }
    vehicle = get_or_update_vehicle(db, customer.id, vehicle_data)

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

    if result.reply:
        create_message(
            db,
            customer_id=customer.id,
            role="assistant",
            content=result.reply,
            channel=_CHANNEL,
            external_message_id=None,
        )

    return BotReply(
        reply=result.reply,
        status="ok",
        handoff=result.handoff,
        intent=result.intent,
    )
