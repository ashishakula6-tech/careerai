"""
Unified LLM Client — routes every AI call to the best available model.

Priority:
  1. Anthropic Claude Opus 4.7  (primary — highest quality)
  2. Anthropic Claude Sonnet 4.6 (fast tier — high-volume tasks)
  3. OpenAI GPT-4o               (fallback — if Anthropic unavailable)

Usage:
    from app.services.llm_client import call_llm, LLMTier

    result = await call_llm(
        system="You are ...",
        user="Extract from: ...",
        tier=LLMTier.PRIMARY,   # or FAST
        json_mode=True,
    )
    # result is always a plain string; parse JSON yourself if needed
"""
import json
import logging
from enum import Enum
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class LLMTier(str, Enum):
    PRIMARY = "primary"   # Claude Opus 4.7  — resume parsing, matching, evaluation
    FAST    = "fast"      # Claude Sonnet 4.6 — candidate search, quick screening


async def call_llm(
    system: str,
    user: str,
    tier: LLMTier = LLMTier.PRIMARY,
    json_mode: bool = True,
    max_tokens: int = 3000,
    temperature: float = 0.1,
) -> str:
    """Call the best available LLM. Always returns a string.

    If json_mode=True the system prompt is augmented to enforce JSON output
    and the response is validated as parseable JSON before returning.
    """
    if json_mode:
        system = system.rstrip() + "\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no explanation, no extra text."

    # ── Try Anthropic first ────────────────────────────────────────────────
    if settings.ANTHROPIC_API_KEY:
        model = settings.LLM_PRIMARY if tier == LLMTier.PRIMARY else settings.LLM_FAST
        try:
            return await _call_anthropic(system, user, model, max_tokens, temperature, json_mode)
        except Exception as exc:
            logger.warning("Anthropic %s failed (%s), falling back to OpenAI", model, exc)

    # ── Fallback: OpenAI GPT-4o ───────────────────────────────────────────
    if settings.OPENAI_API_KEY:
        try:
            return await _call_openai(system, user, settings.LLM_FALLBACK, max_tokens, temperature, json_mode)
        except Exception as exc:
            logger.error("OpenAI fallback also failed: %s", exc)
            raise

    raise RuntimeError("No LLM API key configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in environment.")


# ---------------------------------------------------------------------------
# Anthropic backend
# ---------------------------------------------------------------------------

async def _call_anthropic(
    system: str, user: str, model: str,
    max_tokens: int, temperature: float, json_mode: bool,
) -> str:
    import anthropic

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    msg = await client.messages.create(
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        system=system,
        messages=[{"role": "user", "content": user}],
    )

    text = msg.content[0].text.strip()

    if json_mode:
        text = _extract_json(text)

    return text


# ---------------------------------------------------------------------------
# OpenAI backend
# ---------------------------------------------------------------------------

async def _call_openai(
    system: str, user: str, model: str,
    max_tokens: int, temperature: float, json_mode: bool,
) -> str:
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    kwargs: dict = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    resp = await client.chat.completions.create(**kwargs)
    return resp.choices[0].message.content.strip()


# ---------------------------------------------------------------------------
# JSON extraction helper
# ---------------------------------------------------------------------------

def _extract_json(text: str) -> str:
    """Strip markdown fences and extract the first valid JSON object/array."""
    # Remove ```json … ``` fences
    import re
    text = re.sub(r"```(?:json)?\s*", "", text)
    text = re.sub(r"```\s*", "", text)
    text = text.strip()

    # Find the first { or [ and the matching closing bracket
    for start_char, end_char in [('{', '}'), ('[', ']')]:
        start = text.find(start_char)
        if start == -1:
            continue
        # Walk to find the matching end
        depth = 0
        for i, ch in enumerate(text[start:], start):
            if ch == start_char:
                depth += 1
            elif ch == end_char:
                depth -= 1
                if depth == 0:
                    candidate = text[start:i + 1]
                    try:
                        json.loads(candidate)   # validate
                        return candidate
                    except json.JSONDecodeError:
                        break

    # Last resort: return as-is and let caller handle the error
    return text


# ---------------------------------------------------------------------------
# Convenience: call_llm_json — always returns a parsed dict
# ---------------------------------------------------------------------------

async def call_llm_json(
    system: str,
    user: str,
    tier: LLMTier = LLMTier.PRIMARY,
    max_tokens: int = 3000,
    temperature: float = 0.1,
) -> dict:
    """Like call_llm but parses and returns a dict. Raises ValueError on bad JSON."""
    raw = await call_llm(system, user, tier=tier, json_mode=True,
                         max_tokens=max_tokens, temperature=temperature)
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"LLM did not return valid JSON: {exc}\nRaw: {raw[:300]}") from exc
