"""Shared Pydantic models for inbound/outbound messages and API responses."""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


class IncomingMessage(BaseModel):
    """Channel-agnostic message sent to the chat handler."""

    user_id: str
    name: Optional[str] = None
    text: str
    message_id: Optional[str] = None
    timestamp: Optional[str] = None
    channel: Literal["whatsapp", "voice"] = "whatsapp"


class WhatsAppPayload(BaseModel):
    """Exact shape Make is configured to POST to /webhooks/make/whatsapp."""

    wa_id: str
    name: Optional[str] = None
    message: str = ""
    message_id: Optional[str] = None
    timestamp: Optional[str] = None

    @field_validator("wa_id", "message", mode="before")
    @classmethod
    def _coerce_str(cls, v):
        if v is None:
            return ""
        return str(v).strip() if isinstance(v, str) else str(v)

    @field_validator("name", "message_id", "timestamp", mode="before")
    @classmethod
    def _coerce_optional(cls, v):
        if v is None:
            return None
        s = str(v).strip()
        return s or None


class FrontendChatMessage(BaseModel):
    """Inbound message from the local frontend WhatsApp simulator."""

    session_id: str
    name: Optional[str] = None
    message: str = ""
    message_id: Optional[str] = None

    @field_validator("session_id", "message", mode="before")
    @classmethod
    def _coerce_str_frontend(cls, v):
        if v is None:
            return ""
        return str(v).strip() if isinstance(v, str) else str(v)

    @field_validator("name", "message_id", mode="before")
    @classmethod
    def _coerce_optional_frontend(cls, v):
        if v is None:
            return None
        s = str(v).strip()
        return s or None


class BotReply(BaseModel):
    """What we hand back to Make so it can ship it as a WhatsApp text."""

    reply: str
    status: str = "ok"
    handoff: bool = False
    intent: Optional[str] = Field(
        default=None,
        description="Optional intent label for Make routing/logging.",
    )


# ---------------------------------------------------------------------------
# API response schemas (dashboard)
# ---------------------------------------------------------------------------


class CustomerOut(BaseModel):
    id: int
    phone_number: str
    name: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VehicleOut(BaseModel):
    id: int
    customer_id: int
    plate: Optional[str]
    vin: Optional[str]
    make: Optional[str]
    model: Optional[str]
    year: Optional[int]
    mileage: Optional[int]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: int
    customer_id: int
    role: str
    content: str
    channel: str
    external_message_id: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class RepairCaseOut(BaseModel):
    id: int
    customer_id: int
    vehicle_id: Optional[int]
    status: str
    title: Optional[str]
    problem_summary: Optional[str]
    urgency: Optional[str]
    appointment_start: Optional[datetime]
    appointment_end: Optional[datetime]
    appointment_type: Optional[str]
    calendar_notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# Enriched list item for the dashboard board view.
class RepairCaseListItemOut(BaseModel):
    id: int
    customer_id: int
    customer_name: Optional[str]
    phone_number: str
    vehicle_id: Optional[int]
    vehicle_label: Optional[str]
    status: str
    title: Optional[str]
    problem_summary: Optional[str]
    urgency: Optional[str]
    appointment_start: Optional[datetime]
    appointment_end: Optional[datetime]
    appointment_type: Optional[str]
    blocker: Optional[str]
    # Phase 3 enrichment
    inspection_summary: Optional[str] = None
    quotation_status: Optional[str] = None
    quotation_total: Optional[float] = None
    created_at: datetime
    updated_at: datetime


class GarageSettingsOut(BaseModel):
    id: int
    name: str
    address: Optional[str]
    phone: Optional[str]
    opening_hours_json: Optional[str]
    timezone: str
    labor_rate: Optional[float]
    currency: str

    model_config = {"from_attributes": True}


class InventoryItemOut(BaseModel):
    id: int
    name: str
    sku: Optional[str]
    quantity_available: int
    unit_cost: Optional[float]
    selling_price: Optional[float]

    model_config = {"from_attributes": True}


class ProviderOut(BaseModel):
    id: int
    name: str
    phone: Optional[str]
    email: Optional[str]
    notes: Optional[str]

    model_config = {"from_attributes": True}


class RepairCaseCreate(BaseModel):
    customer_id: int
    vehicle_id: Optional[int] = None
    title: Optional[str] = None
    problem_summary: Optional[str] = None
    urgency: Optional[str] = None
    status: str = "new_request"


class RepairCaseUpdate(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None
    problem_summary: Optional[str] = None
    urgency: Optional[str] = None
    vehicle_id: Optional[int] = None
    appointment_start: Optional[datetime] = None
    appointment_end: Optional[datetime] = None
    appointment_type: Optional[str] = None
    calendar_notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Inspection schemas
# ---------------------------------------------------------------------------


class InspectionSubmit(BaseModel):
    technician_name: Optional[str] = None
    raw_notes: str
    media_urls: List[str] = []


class InspectionOut(BaseModel):
    id: int
    repair_case_id: int
    technician_name: Optional[str]
    raw_notes: str
    ai_summary: Optional[str]
    urgency: Optional[str]
    findings_json: Optional[str]
    recommended_actions_json: Optional[str]
    media_urls_json: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Quotation schemas
# ---------------------------------------------------------------------------


class QuotationItemOut(BaseModel):
    id: int
    quotation_id: int
    item_type: str
    description: str
    quantity: float
    unit_price: float
    total: float
    source: str
    created_at: datetime

    model_config = {"from_attributes": True}


class QuotationOut(BaseModel):
    id: int
    repair_case_id: int
    inspection_id: Optional[int]
    status: str
    internal_summary: Optional[str]
    customer_explanation: Optional[str]
    urgency: Optional[str]
    subtotal: float
    tax: float
    total: float
    currency: str
    items: List[QuotationItemOut] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class QuotationUpdate(BaseModel):
    internal_summary: Optional[str] = None
    customer_explanation: Optional[str] = None
    urgency: Optional[str] = None
    subtotal: Optional[float] = None
    tax: Optional[float] = None
    total: Optional[float] = None
