import os
from typing import Optional
from openai import OpenAI

_client: Optional[OpenAI] = None

def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
    return _client

DEFAULT_MODEL = os.environ.get("DEFAULT_MODEL", "gpt-4o")
FAST_MODEL = os.environ.get("FAST_MODEL", "gpt-4o-mini")


def complete(
    prompt: str,
    system: Optional[str] = None,
    model: Optional[str] = None,
    max_tokens: int = 8192,
) -> str:
    model = model or DEFAULT_MODEL
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    response = _get_client().chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        messages=messages,
    )
    return response.choices[0].message.content or ""
