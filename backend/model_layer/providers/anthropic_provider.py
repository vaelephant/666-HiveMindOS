"""Anthropic 原生 SDK — chat / stream / tools。"""

from __future__ import annotations

import json
import os
from collections.abc import Iterator
from typing import Callable

from anthropic import Anthropic

_client: Anthropic | None = None


def _get_client() -> Anthropic:
    global _client
    if _client is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        _client = Anthropic(api_key=api_key)
    return _client


def _openai_tools_to_anthropic(tools_schema: list[dict]) -> list[dict]:
    converted: list[dict] = []
    for tool in tools_schema:
        fn = tool.get("function") or {}
        converted.append({
            "name": fn.get("name", ""),
            "description": fn.get("description") or "",
            "input_schema": fn.get("parameters") or {"type": "object", "properties": {}},
        })
    return converted


_CACHE_MIN_CHARS = 1024


def _system_with_cache(system: str | None, *, cache: bool = True) -> str | list[dict] | None:
    """Anthropic prompt caching — 对足够长的 system 块加 ephemeral cache。"""
    if not system:
        return None
    if not cache or len(system) < _CACHE_MIN_CHARS:
        return system
    return [
        {
            "type": "text",
            "text": system,
            "cache_control": {"type": "ephemeral"},
        }
    ]


def _usage_from_anthropic(usage) -> dict | None:
    if usage is None:
        return None
    prompt = int(getattr(usage, "input_tokens", 0) or 0)
    completion = int(getattr(usage, "output_tokens", 0) or 0)
    total = prompt + completion
    cached = int(getattr(usage, "cache_read_input_tokens", 0) or 0)
    cache_creation = int(getattr(usage, "cache_creation_input_tokens", 0) or 0)
    if total <= 0 and cached <= 0:
        return None
    return {
        "prompt_tokens": prompt,
        "completion_tokens": completion,
        "total_tokens": total,
        "cached_prompt_tokens": cached,
        "cache_creation_tokens": cache_creation,
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
    kwargs: dict = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    }
    cached_system = _system_with_cache(system)
    if cached_system is not None:
        kwargs["system"] = cached_system
    response = _get_client().messages.create(**kwargs)
    parts = [block.text for block in response.content if block.type == "text"]
    return "".join(parts), _usage_from_anthropic(response.usage)


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
    kwargs: dict = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    }
    cached_system = _system_with_cache(system)
    if cached_system is not None:
        kwargs["system"] = cached_system
    with _get_client().messages.stream(**kwargs) as stream:
        yield from stream.text_stream


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
    tools = _openai_tools_to_anthropic(tools_schema)
    messages: list[dict] = [{"role": "user", "content": user_message}]
    steps: list[dict] = []
    total_usage = {
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0,
        "cached_prompt_tokens": 0,
        "cache_creation_tokens": 0,
    }

    for _ in range(max_iterations):
        kwargs: dict = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": messages,
            "tools": tools,
        }
        cached_system = _system_with_cache(system)
        if cached_system is not None:
            kwargs["system"] = cached_system
        response = _get_client().messages.create(**kwargs)
        usage = _usage_from_anthropic(response.usage)
        if usage:
            for key in total_usage:
                total_usage[key] += usage.get(key, 0)

        if response.stop_reason == "tool_use":
            messages.append({"role": "assistant", "content": response.content})
            tool_results = []
            final_text = ""
            for block in response.content:
                if block.type == "text":
                    final_text += block.text
                elif block.type == "tool_use":
                    result = tool_executor(block.name, block.input if isinstance(block.input, dict) else {})
                    step = {"tool": block.name, "args": block.input, "result": result}
                    steps.append(step)
                    if on_step:
                        on_step(step)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": str(result),
                    })
            if tool_results:
                messages.append({"role": "user", "content": tool_results})
                continue
            usage_out = total_usage if total_usage["total_tokens"] else None
            return final_text, steps, usage_out

        text = "".join(block.text for block in response.content if block.type == "text")
        usage_out = total_usage if total_usage["total_tokens"] else None
        return text, steps, usage_out

    usage_out = total_usage if total_usage["total_tokens"] else None
    return "（已达最大步骤数，结果可能不完整）", steps, usage_out
