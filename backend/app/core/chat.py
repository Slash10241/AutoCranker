"""Channel-agnostic chat handler."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.core.llm import GeminiClient
from app.schemas import BotReply, IncomingMessage

logger = logging.getLogger(__name__)


def handle_message(
    msg: IncomingMessage,
    history: List[Dict[str, Any]],
    app_name: str,
    llm_client: Optional[GeminiClient] = None,
) -> BotReply:
    """Process one inbound user message and return the bot's reply.

    `history` is a list of prior turns already loaded by the caller (from DB
    or elsewhere).  This function no longer manages storage – that is the
    channel handler's responsibility.
    """
    text = msg.text.strip()
    handoff = False

    if text and llm_client:
        llm_response = llm_client.reply(
            message=text,
            history=history,
            user_name=msg.name,
        )
        if llm_response:
            reply_text = llm_response.reply
            handoff = llm_response.handoff
        else:
            reply_text = _fallback_reply(msg, app_name, text)
    elif not text:
        reply_text = (
            "He recibido tu mensaje pero está vacío o no es texto. "
            "¿Me lo puedes escribir de nuevo?"
        )
    else:
        reply_text = _fallback_reply(msg, app_name, text)

    logger.info(
        "handled message user_id=%s text=%r reply=%r",
        msg.user_id,
        text[:80],
        reply_text[:80],
    )

    return BotReply(reply=reply_text, status="ok", handoff=handoff)


def _fallback_reply(msg: IncomingMessage, app_name: str, text: str) -> str:
    name = msg.name.split(" ")[0] if msg.name else "ahí"
    if text.lower() in {"hola", "hello", "hi", "buenas"}:
        return (
            f"¡Hola {name}! Soy el asistente de {app_name}. "
            "Configura GEMINI_API_KEY para respuestas con IA."
        )
    return (
        f"Gracias por escribir a {app_name}. "
        "El asistente con IA no está disponible ahora mismo. "
        "Configura GEMINI_API_KEY para activarlo."
    )
