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


def complete(
    *,
    prompt: str,
    system: str | None,
    model: str,
    max_tokens: int,
) -> str:
    kwargs: dict = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    }
    if system:
        kwargs["system"] = system
    response = _get_client().messages.create(**kwargs)
    parts = [block.text for block in response.content if block.type == "text"]
    return "".join(parts)


def complete_stream(
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
    if system:
        kwargs["system"] = system
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
    tools = _openai_tools_to_anthropic(tools_schema)
    messages: list[dict] = [{"role": "user", "content": user_message}]
    steps: list[dict] = []

    for _ in range(max_iterations):
        kwargs: dict = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": messages,
            "tools": tools,
        }
        if system:
            kwargs["system"] = system
        response = _get_client().messages.create(**kwargs)

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
            return final_text, steps

        text = "".join(block.text for block in response.content if block.type == "text")
        return text, steps

    return "（已达最大步骤数，结果可能不完整）", steps
