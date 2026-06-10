"""统一 LLM / Embedding 门面 — 按 profile 分发至各 provider SDK。"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Callable

from model_layer import registry


def embed(text: str, profile: str | None = None) -> list[float]:
    resolved = registry.resolve_embed(profile)
    mod = registry.get_embed_module(resolved.provider)
    return mod.embed(text=text, model=resolved.model)


def embed_batch(texts: list[str], profile: str | None = None) -> list[list[float]]:
    resolved = registry.resolve_embed(profile)
    mod = registry.get_embed_module(resolved.provider)
    return mod.embed_batch(texts=texts, model=resolved.model)


def complete(
    prompt: str,
    system: str | None = None,
    profile: str | None = None,
    max_tokens: int | None = None,
) -> str:
    resolved = registry.resolve_chat(profile)
    mod = registry.get_chat_module(resolved.provider)
    return mod.complete(
        prompt=prompt,
        system=system,
        model=resolved.model,
        max_tokens=max_tokens or resolved.max_tokens,
    )


def complete_stream(
    prompt: str,
    system: str | None = None,
    profile: str | None = None,
    max_tokens: int | None = None,
) -> Iterator[str]:
    resolved = registry.resolve_chat(profile)
    mod = registry.get_chat_module(resolved.provider)
    yield from mod.complete_stream(
        prompt=prompt,
        system=system,
        model=resolved.model,
        max_tokens=max_tokens or resolved.max_tokens,
    )


def agentic_loop(
    system: str,
    user_message: str,
    tools_schema: list[dict],
    tool_executor: Callable[[str, dict], str],
    profile: str | None = None,
    max_tokens: int | None = None,
    max_iterations: int = 10,
    on_step: Callable[[dict], None] | None = None,
) -> tuple[str, list[dict]]:
    resolved = registry.resolve_chat(profile)
    mod = registry.get_chat_module(resolved.provider)
    return mod.agentic_loop(
        system=system,
        user_message=user_message,
        tools_schema=tools_schema,
        tool_executor=tool_executor,
        model=resolved.model,
        max_tokens=max_tokens or resolved.max_tokens,
        max_iterations=max_iterations,
        on_step=on_step,
    )
