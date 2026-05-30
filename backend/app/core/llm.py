"""Gemini-backed conversation replies."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from pydantic import ValidationError

from app.config import Settings

logger = logging.getLogger(__name__)


@dataclass
class LlmResponse:
    reply: str
    handoff: bool = False


class GeminiClient:
    def __init__(self, settings: Settings) -> None:
        self.enabled = settings.llm_enabled
        self.api_key = settings.gemini_api_key
        self.model = settings.gemini_model
        self.app_name = settings.app_name
        self._client = None

        if not self.enabled or not self.api_key:
            return

        try:
            from google import genai

            self._client = genai.Client(api_key=self.api_key)
        except Exception:
            logger.exception("Failed to initialize Gemini client")
            self._client = None

    @property
    def available(self) -> bool:
        return self.enabled and self._client is not None

    def generate_json(self, prompt: str) -> Optional[Dict[str, Any]]:
        """Send a raw prompt and return the parsed JSON dict, or None on failure."""
        if not self.available:
            return None
        try:
            from google.genai import types

            response = self._client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2,
                ),
            )
            raw_text = getattr(response, "text", "") or ""
            return self._parse_json(raw_text)
        except Exception:
            logger.exception("generate_json failed")
            return None

    def reply(
        self,
        message: str,
        history: List[Dict[str, Any]],
        user_name: Optional[str] = None,
    ) -> Optional[LlmResponse]:
        if not self.available:
            return None

        prompt = self._build_prompt(message, history, user_name)
        try:
            from google.genai import types

            response = self._client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.3,
                ),
            )
            raw_text = getattr(response, "text", "") or ""
            data = self._parse_json(raw_text)
            reply_text = str(data.get("reply", "")).strip()
            if not reply_text:
                return None
            return LlmResponse(
                reply=reply_text,
                handoff=bool(data.get("handoff", False)),
            )
        except (json.JSONDecodeError, ValidationError):
            logger.exception("Gemini returned invalid structured output")
        except Exception:
            logger.exception("Gemini call failed")
        return None

    def _build_prompt(
        self,
        message: str,
        history: List[Dict[str, Any]],
        user_name: Optional[str],
    ) -> str:
        name_hint = user_name or "the user"
        return f"""
You are the WhatsApp assistant for {self.app_name}.

Speak in natural, concise Spanish. If the user writes in Catalan or English,
you may reply in the same language.

Rules:
- Be helpful, friendly, and brief (WhatsApp messages should be short).
- Do not invent facts about products, prices, or availability unless provided.
- If you cannot help, set handoff to true and explain that a human will follow up.
- Always return valid JSON, no markdown.

JSON format:
{{
  "reply": "your response text",
  "handoff": false
}}

User name: {name_hint}

Recent conversation:
{json.dumps(history, ensure_ascii=False)}

Current message:
{message}
""".strip()

    def _parse_json(self, raw_text: str) -> Dict[str, Any]:
        text = raw_text.strip()
        if text.startswith("```"):
            text = text.strip("`").strip()
            if text.startswith("json"):
                text = text[4:].strip()
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            text = text[start : end + 1]
        return json.loads(text)
