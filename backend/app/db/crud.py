"""CRUD / service helpers for all AutoCranker domain objects."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.db.models import (
    Customer,
    GarageSettings,
    InventoryItem,
    Inspection,
    Message,
    Provider,
    Quotation,
    QuotationItem,
    QuotationStatus,
    RepairCase,
    RepairCaseStatus,
    Vehicle,
)

# Statuses that mean a case is still open / in progress.
_OPEN_STATUSES = {
    RepairCaseStatus.NEW_REQUEST.value,
    RepairCaseStatus.COLLECTING_INFO.value,
    RepairCaseStatus.APPOINTMENT_BOOKED.value,
    RepairCaseStatus.CHECKED_IN.value,
    RepairCaseStatus.INSPECTION_PENDING.value,
    RepairCaseStatus.INSPECTION_DONE.value,
    RepairCaseStatus.QUOTE_DRAFT.value,
    RepairCaseStatus.QUOTE_WAITING_OWNER_APPROVAL.value,
    RepairCaseStatus.QUOTE_SENT.value,
    RepairCaseStatus.CUSTOMER_APPROVED.value,
    RepairCaseStatus.WAITING_FOR_PARTS.value,
    RepairCaseStatus.IN_REPAIR.value,
    RepairCaseStatus.READY_FOR_PICKUP.value,
}


# ---------------------------------------------------------------------------
# Customer
# ---------------------------------------------------------------------------


def get_customer_by_phone(db: Session, phone_number: str) -> Optional[Customer]:
    return db.query(Customer).filter(Customer.phone_number == phone_number).first()


def get_customer(db: Session, customer_id: int) -> Optional[Customer]:
    return db.get(Customer, customer_id)


def list_customers(db: Session, skip: int = 0, limit: int = 100) -> List[Customer]:
    return db.query(Customer).order_by(Customer.created_at.desc()).offset(skip).limit(limit).all()


def get_or_create_customer(
    db: Session, phone_number: str, name: Optional[str] = None
) -> Customer:
    customer = get_customer_by_phone(db, phone_number)
    if customer:
        if name and not customer.name:
            customer.name = name
            db.flush()
        return customer
    customer = Customer(phone_number=phone_number, name=name)
    db.add(customer)
    db.flush()
    return customer


# ---------------------------------------------------------------------------
# Message
# ---------------------------------------------------------------------------


def create_message(
    db: Session,
    customer_id: int,
    role: str,
    content: str,
    channel: str = "whatsapp",
    external_message_id: Optional[str] = None,
) -> Message:
    msg = Message(
        customer_id=customer_id,
        role=role,
        content=content,
        channel=channel,
        external_message_id=external_message_id,
    )
    db.add(msg)
    db.flush()
    return msg


def is_message_seen(db: Session, external_message_id: str) -> bool:
    return (
        db.query(Message)
        .filter(Message.external_message_id == external_message_id)
        .first()
        is not None
    )


def get_messages_for_customer(
    db: Session, customer_id: int, limit: int = 50
) -> List[Message]:
    return (
        db.query(Message)
        .filter(Message.customer_id == customer_id)
        .order_by(Message.created_at.asc())
        .limit(limit)
        .all()
    )


def get_recent_history_for_llm(
    db: Session, customer_id: int, limit: int = 12
) -> List[Dict[str, Any]]:
    """Return conversation turns in the format expected by the LLM prompt."""
    messages = (
        db.query(Message)
        .filter(
            Message.customer_id == customer_id,
            Message.role.in_(["customer", "assistant"]),
        )
        .order_by(Message.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "role": m.role,
            "text": m.content,
            "created_at": m.created_at.isoformat(),
        }
        for m in reversed(messages)
    ]


# ---------------------------------------------------------------------------
# RepairCase
# ---------------------------------------------------------------------------


def list_repair_cases(
    db: Session, skip: int = 0, limit: int = 100
) -> List[RepairCase]:
    return (
        db.query(RepairCase)
        .order_by(RepairCase.updated_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_repair_case(db: Session, case_id: int) -> Optional[RepairCase]:
    return db.get(RepairCase, case_id)


def create_repair_case(
    db: Session,
    customer_id: int,
    vehicle_id: Optional[int] = None,
    title: Optional[str] = None,
    problem_summary: Optional[str] = None,
    urgency: Optional[str] = None,
    status: str = RepairCaseStatus.NEW_REQUEST.value,
    appointment_start: Optional[datetime] = None,
    appointment_end: Optional[datetime] = None,
    appointment_type: Optional[str] = None,
    calendar_notes: Optional[str] = None,
) -> RepairCase:
    case = RepairCase(
        customer_id=customer_id,
        vehicle_id=vehicle_id,
        status=status,
        title=title,
        problem_summary=problem_summary,
        urgency=urgency,
        appointment_start=appointment_start,
        appointment_end=appointment_end,
        appointment_type=appointment_type,
        calendar_notes=calendar_notes,
    )
    db.add(case)
    db.flush()
    return case


def update_repair_case(
    db: Session, case_id: int, updates: Dict[str, Any]
) -> Optional[RepairCase]:
    case = db.get(RepairCase, case_id)
    if not case:
        return None
    allowed = {
        "status", "title", "problem_summary", "urgency",
        "vehicle_id", "appointment_start", "appointment_end",
        "appointment_type", "calendar_notes",
    }
    for key, value in updates.items():
        if key in allowed:
            setattr(case, key, value)
    case.updated_at = datetime.now(timezone.utc)
    db.flush()
    return case


def get_active_repair_case_for_customer(
    db: Session, customer_id: int
) -> Optional[RepairCase]:
    """Return the most recently updated open repair case for this customer."""
    return (
        db.query(RepairCase)
        .filter(
            RepairCase.customer_id == customer_id,
            RepairCase.status.in_(_OPEN_STATUSES),
        )
        .order_by(RepairCase.updated_at.desc())
        .first()
    )


def get_or_update_vehicle(
    db: Session, customer_id: int, data: Dict[str, Any]
) -> Optional[Vehicle]:
    """Create a vehicle for this customer if none exists, or update with new data.

    Never overwrites an existing field with null – only fills in missing ones
    and updates when a non-null value is provided.
    """
    non_null = {
        k: v
        for k, v in data.items()
        if v is not None and k in {"make", "model", "year", "plate", "vin", "mileage"}
    }
    if not non_null:
        return db.query(Vehicle).filter(Vehicle.customer_id == customer_id).first()

    vehicle = db.query(Vehicle).filter(Vehicle.customer_id == customer_id).first()
    if vehicle:
        for key, value in non_null.items():
            setattr(vehicle, key, value)
        db.flush()
    else:
        vehicle = Vehicle(customer_id=customer_id, **non_null)
        db.add(vehicle)
        db.flush()
    return vehicle


# ---------------------------------------------------------------------------
# GarageSettings
# ---------------------------------------------------------------------------


def get_garage_settings(db: Session) -> Optional[GarageSettings]:
    return db.query(GarageSettings).first()


def upsert_garage_settings(db: Session, **kwargs: Any) -> GarageSettings:
    settings = db.query(GarageSettings).first()
    if settings:
        for key, value in kwargs.items():
            setattr(settings, key, value)
    else:
        settings = GarageSettings(**kwargs)
        db.add(settings)
    db.flush()
    return settings


# ---------------------------------------------------------------------------
# InventoryItem
# ---------------------------------------------------------------------------


def list_inventory(db: Session) -> List[InventoryItem]:
    return db.query(InventoryItem).order_by(InventoryItem.name).all()


# ---------------------------------------------------------------------------
# Provider
# ---------------------------------------------------------------------------


def list_providers(db: Session) -> List[Provider]:
    return db.query(Provider).order_by(Provider.name).all()


# ---------------------------------------------------------------------------
# Inspection
# ---------------------------------------------------------------------------


def create_inspection(
    db: Session,
    repair_case_id: int,
    raw_notes: str,
    technician_name: Optional[str] = None,
    ai_summary: Optional[str] = None,
    urgency: Optional[str] = None,
    findings_json: Optional[str] = None,
    recommended_actions_json: Optional[str] = None,
    media_urls_json: Optional[str] = None,
) -> Inspection:
    inspection = Inspection(
        repair_case_id=repair_case_id,
        raw_notes=raw_notes,
        technician_name=technician_name,
        ai_summary=ai_summary,
        urgency=urgency,
        findings_json=findings_json,
        recommended_actions_json=recommended_actions_json,
        media_urls_json=media_urls_json,
    )
    db.add(inspection)
    db.flush()
    return inspection


def get_latest_inspection(db: Session, repair_case_id: int) -> Optional[Inspection]:
    return (
        db.query(Inspection)
        .filter(Inspection.repair_case_id == repair_case_id)
        .order_by(Inspection.created_at.desc())
        .first()
    )


# ---------------------------------------------------------------------------
# Quotation
# ---------------------------------------------------------------------------


def create_quotation_with_items(
    db: Session,
    repair_case_id: int,
    inspection_id: Optional[int],
    internal_summary: str,
    customer_explanation: str,
    urgency: str,
    currency: str,
    tax_rate: float,
    items_data: List[Dict[str, Any]],
    status: str = QuotationStatus.WAITING_OWNER_APPROVAL.value,
) -> Quotation:
    subtotal = round(sum(float(i.get("quantity", 1)) * float(i.get("unit_price", 0)) for i in items_data), 2)
    tax = round(subtotal * tax_rate, 2)
    total = round(subtotal + tax, 2)

    quotation = Quotation(
        repair_case_id=repair_case_id,
        inspection_id=inspection_id,
        status=status,
        internal_summary=internal_summary,
        customer_explanation=customer_explanation,
        urgency=urgency,
        subtotal=subtotal,
        tax=tax,
        total=total,
        currency=currency,
    )
    db.add(quotation)
    db.flush()

    for i in items_data:
        qty = float(i.get("quantity", 1))
        price = float(i.get("unit_price", 0))
        item = QuotationItem(
            quotation_id=quotation.id,
            item_type=str(i.get("item_type", "part")),
            description=str(i.get("description", "")),
            quantity=qty,
            unit_price=price,
            total=round(qty * price, 2),
            source=str(i.get("source", "ai_suggested")),
        )
        db.add(item)

    db.flush()
    return quotation


def get_latest_quotation(db: Session, repair_case_id: int) -> Optional[Quotation]:
    return (
        db.query(Quotation)
        .filter(Quotation.repair_case_id == repair_case_id)
        .order_by(Quotation.created_at.desc())
        .first()
    )


def get_quotation(db: Session, quotation_id: int) -> Optional[Quotation]:
    return db.get(Quotation, quotation_id)


def update_quotation(db: Session, quotation_id: int, updates: Dict[str, Any]) -> Optional[Quotation]:
    quotation = db.get(Quotation, quotation_id)
    if not quotation:
        return None
    allowed = {"status", "internal_summary", "customer_explanation", "urgency", "subtotal", "tax", "total"}
    for key, value in updates.items():
        if key in allowed:
            setattr(quotation, key, value)
    quotation.updated_at = datetime.now(timezone.utc)
    db.flush()
    return quotation
