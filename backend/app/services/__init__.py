"""Application service container."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from app.config import Settings, get_settings
from app.core.intake_agent import IntakeAgent
from app.core.llm import GeminiClient
from app.core.quotation_agent import QuotationAgent

_services: Optional["AppServices"] = None


@dataclass
class AppServices:
    llm_client: GeminiClient
    intake_agent: IntakeAgent
    quotation_agent: QuotationAgent


def init_services(settings: Optional[Settings] = None) -> AppServices:
    global _services
    settings = settings or get_settings()
    llm_client = GeminiClient(settings)
    intake_agent = IntakeAgent(llm_client=llm_client, app_name=settings.app_name)
    quotation_agent = QuotationAgent(llm_client=llm_client)
    _services = AppServices(
        llm_client=llm_client,
        intake_agent=intake_agent,
        quotation_agent=quotation_agent,
    )
    return _services


def get_services() -> AppServices:
    if _services is None:
        return init_services()
    return _services
