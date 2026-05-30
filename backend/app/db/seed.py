"""Demo seed data for AutoCranker.

Runs once at startup; skips any records that already exist.
"""

from __future__ import annotations

import json
import logging

from sqlalchemy.orm import Session

from app.db.models import Customer, GarageSettings, InventoryItem, Provider, RepairCase, Vehicle

logger = logging.getLogger(__name__)


def seed_demo_data(db: Session) -> None:
    _seed_garage(db)
    _seed_inventory(db)
    _seed_providers(db)
    _seed_example_case(db)
    db.commit()
    logger.info("Demo seed data ensured.")


def _seed_garage(db: Session) -> None:
    if db.query(GarageSettings).first():
        return
    opening_hours = {
        "monday": "08:00-18:00",
        "tuesday": "08:00-18:00",
        "wednesday": "08:00-18:00",
        "thursday": "08:00-18:00",
        "friday": "08:00-17:00",
        "saturday": "09:00-13:00",
        "sunday": "closed",
    }
    settings = GarageSettings(
        name="Taller AutoCranker",
        address="Carrer de la Mecànica 42, 08001 Barcelona",
        phone="+34 93 000 0000",
        opening_hours_json=json.dumps(opening_hours),
        timezone="Europe/Madrid",
        labor_rate=75.0,
        currency="EUR",
    )
    db.add(settings)
    db.flush()


def _seed_inventory(db: Session) -> None:
    if db.query(InventoryItem).first():
        return
    items = [
        InventoryItem(name="Front brake pads (set)", sku="BRK-FRT-001", quantity_available=12, unit_cost=18.00, selling_price=65.00),
        InventoryItem(name="Front brake discs (pair)", sku="BRK-DSC-001", quantity_available=8, unit_cost=45.00, selling_price=85.00),
        InventoryItem(name="Brake fluid (500ml)", sku="BRK-FLD-001", quantity_available=20, unit_cost=5.00, selling_price=15.00),
        InventoryItem(name="Rear brake pads (set)", sku="BRK-RR-001", quantity_available=10, unit_cost=15.00, selling_price=55.00),
        InventoryItem(name="Oil filter", sku="FLT-OIL-001", quantity_available=25, unit_cost=4.50, selling_price=12.00),
        InventoryItem(name="Engine oil 5W-30 (5L)", sku="OIL-5W30-5L", quantity_available=40, unit_cost=12.00, selling_price=32.00),
        InventoryItem(name="Air filter", sku="FLT-AIR-001", quantity_available=15, unit_cost=8.00, selling_price=22.00),
        InventoryItem(name="Cabin air filter", sku="FLT-CAB-001", quantity_available=20, unit_cost=5.00, selling_price=18.00),
        InventoryItem(name="Spark plugs (set x4)", sku="SPK-004", quantity_available=30, unit_cost=8.00, selling_price=28.00),
        InventoryItem(name="Car battery 70Ah", sku="BAT-70AH", quantity_available=6, unit_cost=65.00, selling_price=120.00),
        InventoryItem(name="Timing belt kit", sku="TBL-KIT-001", quantity_available=5, unit_cost=55.00, selling_price=110.00),
        InventoryItem(name="Wiper blades (pair)", sku="WPR-001", quantity_available=18, unit_cost=7.00, selling_price=20.00),
    ]
    db.add_all(items)
    db.flush()


def _seed_providers(db: Session) -> None:
    if db.query(Provider).first():
        return
    providers = [
        Provider(
            name="AutoPartes SA",
            phone="+34 91 123 4567",
            email="pedidos@autopartes.es",
            notes="Proveedor principal de recambios. Entrega en 24h.",
        ),
        Provider(
            name="MotorPro Distribuciones",
            phone="+34 93 987 6543",
            email="comercial@motorpro.cat",
            notes="Especialistas en aceites y lubricantes. Descuento 15% por volumen.",
        ),
    ]
    db.add_all(providers)
    db.flush()


def _seed_example_case(db: Session) -> None:
    if db.query(Customer).first():
        return
    customer = Customer(phone_number="demo_leo_ekl7", name="Leo (Demo)")
    db.add(customer)
    db.flush()

    vehicle = Vehicle(
        customer_id=customer.id,
        plate="1234 ABC",
        make="Seat",
        model="Leon",
        year=2018,
        mileage=87500,
    )
    db.add(vehicle)
    db.flush()

    case = RepairCase(
        customer_id=customer.id,
        vehicle_id=vehicle.id,
        status="checked_in",
        title="Brake noise",
        problem_summary="Customer reports squealing brake noise at low speed. Front pads and rotors to be inspected.",
        urgency="medium",
    )
    db.add(case)
    db.flush()
