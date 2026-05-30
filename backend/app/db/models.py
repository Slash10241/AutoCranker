"""SQLAlchemy ORM models for AutoCranker."""

from __future__ import annotations

import enum
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class RepairCaseStatus(str, enum.Enum):
    NEW_REQUEST = "new_request"
    COLLECTING_INFO = "collecting_info"
    APPOINTMENT_BOOKED = "appointment_booked"
    CHECKED_IN = "checked_in"
    INSPECTION_PENDING = "inspection_pending"
    INSPECTION_DONE = "inspection_done"
    QUOTE_DRAFT = "quote_draft"
    QUOTE_WAITING_OWNER_APPROVAL = "quote_waiting_owner_approval"
    QUOTE_SENT = "quote_sent"
    CUSTOMER_APPROVED = "customer_approved"
    CUSTOMER_DECLINED = "customer_declined"
    WAITING_FOR_PARTS = "waiting_for_parts"
    IN_REPAIR = "in_repair"
    READY_FOR_PICKUP = "ready_for_pickup"
    CLOSED = "closed"


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    phone_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )

    vehicles: Mapped[List["Vehicle"]] = relationship(
        "Vehicle", back_populates="customer", cascade="all, delete-orphan"
    )
    messages: Mapped[List["Message"]] = relationship(
        "Message", back_populates="customer", cascade="all, delete-orphan"
    )
    repair_cases: Mapped[List["RepairCase"]] = relationship(
        "RepairCase", back_populates="customer", cascade="all, delete-orphan"
    )


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("customers.id"), index=True
    )
    plate: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    vin: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    make: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    mileage: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )

    customer: Mapped["Customer"] = relationship("Customer", back_populates="vehicles")
    repair_cases: Mapped[List["RepairCase"]] = relationship(
        "RepairCase", back_populates="vehicle"
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("customers.id"), index=True
    )
    role: Mapped[str] = mapped_column(String(20))  # customer | assistant | system
    content: Mapped[str] = mapped_column(Text)
    message_type: Mapped[str] = mapped_column(String(20), default="text")
    attachment_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    attachment_filename: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    channel: Mapped[str] = mapped_column(String(30), default="whatsapp")
    external_message_id: Mapped[Optional[str]] = mapped_column(
        String(200), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    customer: Mapped["Customer"] = relationship("Customer", back_populates="messages")


class RepairCase(Base):
    __tablename__ = "repair_cases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("customers.id"), index=True
    )
    vehicle_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("vehicles.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(50), default=RepairCaseStatus.NEW_REQUEST.value
    )
    title: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    problem_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    urgency: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    appointment_start: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    appointment_end: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    appointment_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    calendar_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )

    customer: Mapped["Customer"] = relationship(
        "Customer", back_populates="repair_cases"
    )
    vehicle: Mapped[Optional["Vehicle"]] = relationship(
        "Vehicle", back_populates="repair_cases"
    )
    inspections: Mapped[List["Inspection"]] = relationship(
        "Inspection", back_populates="repair_case", cascade="all, delete-orphan"
    )
    quotations: Mapped[List["Quotation"]] = relationship(
        "Quotation", back_populates="repair_case", cascade="all, delete-orphan"
    )


class GarageSettings(Base):
    __tablename__ = "garage_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200))
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    opening_hours_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    timezone: Mapped[str] = mapped_column(String(60), default="Europe/Madrid")
    labor_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="EUR")
    tax_rate: Mapped[float] = mapped_column(Float, default=0.21)


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200))
    sku: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, unique=True)
    quantity_available: Mapped[int] = mapped_column(Integer, default=0)
    unit_cost: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    selling_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)


class Provider(Base):
    __tablename__ = "providers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200))
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class Inspection(Base):
    __tablename__ = "inspections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    repair_case_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("repair_cases.id"), index=True
    )
    technician_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    raw_notes: Mapped[str] = mapped_column(Text)
    ai_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    urgency: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    recommended_actions_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    findings_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    media_urls_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )

    repair_case: Mapped["RepairCase"] = relationship(
        "RepairCase", back_populates="inspections"
    )
    quotations: Mapped[List["Quotation"]] = relationship(
        "Quotation", back_populates="inspection"
    )


class QuotationStatus(str, enum.Enum):
    DRAFT = "draft"
    WAITING_OWNER_APPROVAL = "waiting_owner_approval"
    APPROVED_BY_OWNER = "approved_by_owner"
    SENT_TO_CUSTOMER = "sent_to_customer"
    CUSTOMER_APPROVED = "customer_approved"
    CUSTOMER_DECLINED = "customer_declined"
    EXPIRED = "expired"


class Quotation(Base):
    __tablename__ = "quotations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    repair_case_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("repair_cases.id"), index=True
    )
    inspection_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("inspections.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(50), default=QuotationStatus.DRAFT.value
    )
    internal_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    customer_explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    urgency: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    subtotal: Mapped[float] = mapped_column(Float, default=0.0)
    tax: Mapped[float] = mapped_column(Float, default=0.0)
    total: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(10), default="EUR")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )

    repair_case: Mapped["RepairCase"] = relationship(
        "RepairCase", back_populates="quotations"
    )
    inspection: Mapped[Optional["Inspection"]] = relationship(
        "Inspection", back_populates="quotations"
    )
    items: Mapped[List["QuotationItem"]] = relationship(
        "QuotationItem", back_populates="quotation", cascade="all, delete-orphan"
    )


class QuotationItem(Base):
    __tablename__ = "quotation_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    quotation_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("quotations.id"), index=True
    )
    item_type: Mapped[str] = mapped_column(String(20), default="part")  # labor/part/fee/other
    description: Mapped[str] = mapped_column(String(300))
    quantity: Mapped[float] = mapped_column(Float, default=1.0)
    unit_price: Mapped[float] = mapped_column(Float, default=0.0)
    total: Mapped[float] = mapped_column(Float, default=0.0)
    source: Mapped[str] = mapped_column(String(30), default="ai_suggested")  # ai_suggested/inventory/manual
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )

    quotation: Mapped["Quotation"] = relationship("Quotation", back_populates="items")
