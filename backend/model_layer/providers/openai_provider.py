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


def _usage_from_openai(usage) -> dict | None:
    if usage is None:
        return None
    prompt = int(getattr(usage, "prompt_tokens", 0) or 0)
    completion = int(getattr(usage, "completion_tokens", 0) or 0)
    total = int(getattr(usage, "total_tokens", 0) or prompt + completion)
    details = getattr(usage, "prompt_tokens_details", None)
    cached = int(getattr(details, "cached_tokens", 0) or 0) if details else 0
    if total <= 0 and prompt <= 0 and completion <= 0 and cached <= 0:
        return None
    return {
        "prompt_tokens": prompt,
        "completion_tokens": completion,
        "total_tokens": total,
        "cached_prompt_tokens": cached,
        "cache_creation_tokens": 0,
    }


def complete(
    *,
    prompt: str,
    system: str | None,
    model: str,
    max_tokens: int,
) -> str:
    text, _usage = complete_with_usage(
        prompt=prompt,
        system=system,
        model=model,
        max_tokens=max_tokens,
    )
    return text


def complete_with_usage(
    *,
    prompt: str,
    system: str | None,
    model: str,
    max_tokens: int,
) -> tuple[str, dict | None]:
    response = _get_client().chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        messages=_messages(prompt, system),
    )
    return response.choices[0].message.content or "", _usage_from_openai(response.usage)


def complete_stream(
    *,
    prompt: str,
    system: str | None,
    model: str,
    max_tokens: int,
) -> Iterator[str]:
    yield from complete_stream_with_usage(
        prompt=prompt,
        system=system,
        model=model,
        max_tokens=max_tokens,
    )


def complete_stream_with_usage(
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
        stream_options={"include_usage": True},
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
    text, steps, _usage = agentic_loop_with_usage(
        system=system,
        user_message=user_message,
        tools_schema=tools_schema,
        tool_executor=tool_executor,
        model=model,
        max_tokens=max_tokens,
        max_iterations=max_iterations,
        on_step=on_step,
    )
    return text, steps


def agentic_loop_with_usage(
    *,
    system: str,
    user_message: str,
    tools_schema: list[dict],
    tool_executor: Callable[[str, dict], str],
    model: str,
    max_tokens: int,
    max_iterations: int = 10,
    on_step: Callable[[dict], None] | None = None,
) -> tuple[str, list[dict], dict | None]:
    messages: list[dict] = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_message},
    ]
    steps: list[dict] = []

    total_usage = {
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0,
        "cached_prompt_tokens": 0,
        "cache_creation_tokens": 0,
    }

    for _ in range(max_iterations):
        response = _get_client().chat.completions.create(
            model=model,
            max_tokens=max_tokens,
            messages=messages,
            tools=tools_schema,
            tool_choice="auto",
        )
        usage = _usage_from_openai(response.usage)
        if usage:
            for key in total_usage:
                total_usage[key] += usage.get(key, 0)
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
            usage_out = total_usage if total_usage["total_tokens"] else None
            return msg.content or "", steps, usage_out

    usage_out = total_usage if total_usage["total_tokens"] else None
    return "（已达最大步骤数，结果可能不完整）", steps, usage_out


def embed(*, text: str, model: str) -> list[float]:
    text = text.strip()
    if not text:
        raise ValueError("embed: empty text")
    vector, _usage = embed_with_usage(text=text, model=model)
    return vector


def embed_with_usage(*, text: str, model: str) -> tuple[list[float], dict | None]:
    response = _get_client().embeddings.create(model=model, input=text)
    usage = _usage_from_openai(response.usage)
    return response.data[0].embedding, usage


def embed_batch(*, texts: list[str], model: str) -> list[list[float]]:
    cleaned = [t.strip() for t in texts]
    if not cleaned:
        return []
    vectors, _usage = embed_batch_with_usage(texts=texts, model=model)
    return vectors


def embed_batch_with_usage(*, texts: list[str], model: str) -> tuple[list[list[float]], dict | None]:
    cleaned = [t.strip() for t in texts]
    if not cleaned:
        return [], None
    response = _get_client().embeddings.create(model=model, input=cleaned)
    usage = _usage_from_openai(response.usage)
    vectors = [row.embedding for row in sorted(response.data, key=lambda d: d.index)]
    return vectors, usage
