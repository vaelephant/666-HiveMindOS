"""OpenAI 原生 SDK — chat / stream / tools / embed。"""

from __future__ import annotations

import json
import os
from collections.abc import Iterator
from typing import Callable

from openai import OpenAI

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.environ.get("OPENAI_API_KEY", "")
        _client = OpenAI(api_key=api_key)
    return _client


def _messages(prompt: str, system: str | None) -> list[dict]:
    messages: list[dict] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    return messages


def complete(
    *,
    prompt: str,
    system: str | None,
    model: str,
    max_tokens: int,
) -> str:
    response = _get_client().chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        messages=_messages(prompt, system),
    )
    return response.choices[0].message.content or ""


def complete_stream(
    *,
    prompt: str,
    system: str | None,
    model: str,
    max_tokens: int,
) -> Iterator[str]:
    stream = _get_client().chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        messages=_messages(prompt, system),
        stream=True,
    )
    for chunk in stream:
        delta = chunk.choices[0].delta.content if chunk.choices else None
        if delta:
            yield delta


def agentic_loop(
    *,
    system: str,
    user_message: str,
    tools_schema: list[dict],
    tool_executor: Callable[[str, dict], str],
    model: str,
    max_tokens: int,
    max_iterations: int = 10,
    on_step: Callable[[dict], None] | None = None,
) -> tuple[str, list[dict]]:
    messages: list[dict] = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_message},
    ]
    steps: list[dict] = []

    for _ in range(max_iterations):
        response = _get_client().chat.completions.create(
            model=model,
            max_tokens=max_tokens,
            messages=messages,
            tools=tools_schema,
            tool_choice="auto",
        )
        choice = response.choices[0]
        msg = choice.message

        if choice.finish_reason == "tool_calls" and msg.tool_calls:
            messages.append(msg.model_dump())
            for tc in msg.tool_calls:
                args = json.loads(tc.function.arguments)
                result = tool_executor(tc.function.name, args)
                step = {"tool": tc.function.name, "args": args, "result": result}
                steps.append(step)
                if on_step:
                    on_step(step)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": str(result),
                })
        else:
            return msg.content or "", steps

    return "（已达最大步骤数，结果可能不完整）", steps


def embed(*, text: str, model: str) -> list[float]:
    text = text.strip()
    if not text:
        raise ValueError("embed: empty text")
    response = _get_client().embeddings.create(model=model, input=text)
    return response.data[0].embedding


def embed_batch(*, texts: list[str], model: str) -> list[list[float]]:
    cleaned = [t.strip() for t in texts]
    if not cleaned:
        return []
    response = _get_client().embeddings.create(model=model, input=cleaned)
    return [row.embedding for row in sorted(response.data, key=lambda d: d.index)]
