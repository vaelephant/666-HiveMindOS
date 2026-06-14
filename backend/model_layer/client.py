"""统一 LLM / Embedding 门面 — 按 profile 分发至各 provider SDK。"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Callable

from model_layer import registry
from model_layer.registry import ResolvedProfile
from model_layer.usage import TokenUsage, emit_usage, get_usage_context
from model_layer.user_resolver import try_resolve_user_profile


def _resolve_chat(profile: str | None) -> ResolvedProfile:
    ctx = get_usage_context()
    if ctx and profile:
        custom = try_resolve_user_profile(ctx.org_id, ctx.user_id, profile)
        if custom and custom.kind == "chat":
            return custom
    return registry.resolve_chat(profile)


def _resolve_embed(profile: str | None) -> ResolvedProfile:
    ctx = get_usage_context()
    if ctx and profile:
        custom = try_resolve_user_profile(ctx.org_id, ctx.user_id, profile)
        if custom and custom.kind == "embed":
            return custom
    return registry.resolve_embed(profile)


def _usage_from_raw(raw: dict | None) -> TokenUsage | None:
    if not raw:
        return None
    return TokenUsage.from_counts(
        prompt_tokens=raw.get("prompt_tokens"),
        completion_tokens=raw.get("completion_tokens"),
        total_tokens=raw.get("total_tokens"),
        cached_prompt_tokens=raw.get("cached_prompt_tokens"),
        cache_creation_tokens=raw.get("cache_creation_tokens"),
    )


def _record_chat(
    resolved,
    operation: str,
    raw_usage: dict | None,
    *,
    org_id: str | None = None,
    user_id: str | None = None,
    source: str | None = None,
    source_id: str | None = None,
) -> None:
    emit_usage(
        provider=resolved.provider,
        model=resolved.model,
        profile_id=resolved.id,
        operation=operation,
        usage=_usage_from_raw(raw_usage),
        org_id=org_id,
        user_id=user_id,
        source=source,
        source_id=source_id,
    )


def _record_embed(
    resolved,
    raw_usage: dict | None,
    *,
    org_id: str | None = None,
    user_id: str | None = None,
    source: str | None = None,
    source_id: str | None = None,
) -> None:
    emit_usage(
        provider=resolved.provider,
        model=resolved.model,
        profile_id=resolved.id,
        operation="embed",
        usage=_usage_from_raw(raw_usage),
        org_id=org_id,
        user_id=user_id,
        source=source,
        source_id=source_id,
    )


def embed(
    text: str,
    profile: str | None = None,
    *,
    org_id: str | None = None,
    user_id: str | None = None,
    source: str | None = None,
    source_id: str | None = None,
) -> list[float]:
    resolved = _resolve_embed(profile)
    mod = registry.get_embed_module(resolved.provider)
    fn = getattr(mod, "embed_with_usage", None)
    if fn:
        vector, raw = fn(text=text, model=resolved.model)
        _record_embed(
            resolved,
            raw,
            org_id=org_id,
            user_id=user_id,
            source=source,
            source_id=source_id,
        )
        return vector
    return mod.embed(text=text, model=resolved.model)


def embed_batch(
    texts: list[str],
    profile: str | None = None,
    *,
    org_id: str | None = None,
    user_id: str | None = None,
    source: str | None = None,
    source_id: str | None = None,
) -> list[list[float]]:
    resolved = _resolve_embed(profile)
    mod = registry.get_embed_module(resolved.provider)
    fn = getattr(mod, "embed_batch_with_usage", None)
    if fn:
        vectors, raw = fn(texts=texts, model=resolved.model)
        _record_embed(
            resolved,
            raw,
            org_id=org_id,
            user_id=user_id,
            source=source,
            source_id=source_id,
        )
        return vectors
    return mod.embed_batch(texts=texts, model=resolved.model)


def complete_vision(
    images: list[bytes],
    prompt: str,
    system: str | None = None,
    profile: str | None = None,
    max_tokens: int | None = None,
) -> str:
    resolved = _resolve_chat(profile)
    mod = registry.get_chat_module(resolved.provider)
    fn = getattr(mod, "complete_vision_with_usage", None)
    max_tok = max_tokens or resolved.max_tokens
    if fn:
        text, raw = fn(
            images=images,
            prompt=prompt,
            system=system,
            model=resolved.model,
            max_tokens=max_tok,
        )
        _record_chat(resolved, "vision", raw)
        return text
    raise NotImplementedError(f"vision not supported for provider {resolved.provider}")


def complete(
    prompt: str,
    system: str | None = None,
    profile: str | None = None,
    max_tokens: int | None = None,
) -> str:
    resolved = _resolve_chat(profile)
    mod = registry.get_chat_module(resolved.provider)
    fn = getattr(mod, "complete_with_usage", None)
    max_tok = max_tokens or resolved.max_tokens
    if fn:
        text, raw = fn(prompt=prompt, system=system, model=resolved.model, max_tokens=max_tok)
        _record_chat(resolved, "chat", raw)
        return text
    return mod.complete(prompt=prompt, system=system, model=resolved.model, max_tokens=max_tok)


def complete_stream(
    prompt: str,
    system: str | None = None,
    profile: str | None = None,
    max_tokens: int | None = None,
) -> Iterator[str]:
    resolved = _resolve_chat(profile)
    mod = registry.get_chat_module(resolved.provider)
    max_tok = max_tokens or resolved.max_tokens

    if resolved.provider == "openai":
        from model_layer.providers import openai_provider as oai

        ostream = oai._get_client().chat.completions.create(
            model=resolved.model,
            max_tokens=max_tok,
            messages=oai._messages(prompt, system),
            stream=True,
            stream_options={"include_usage": True},
        )
        raw_usage: dict | None = None
        for chunk in ostream:
            if chunk.usage:
                raw_usage = oai._usage_from_openai(chunk.usage)
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                yield delta
        _record_chat(resolved, "chat", raw_usage)
        return

    if resolved.provider == "anthropic":
        from model_layer.providers import anthropic_provider as ant

        kwargs: dict = {
            "model": resolved.model,
            "max_tokens": max_tok,
            "messages": [{"role": "user", "content": prompt}],
        }
        cached_system = ant._system_with_cache(system)
        if cached_system is not None:
            kwargs["system"] = cached_system
        with ant._get_client().messages.stream(**kwargs) as astream:
            yield from astream.text_stream
            final = astream.get_final_message()
            raw_usage = ant._usage_from_anthropic(final.usage)
        _record_chat(resolved, "chat", raw_usage)
        return

    yield from mod.complete_stream(
        prompt=prompt,
        system=system,
        model=resolved.model,
        max_tokens=max_tok,
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
    resolved = _resolve_chat(profile)
    mod = registry.get_chat_module(resolved.provider)
    fn = getattr(mod, "agentic_loop_with_usage", None)
    max_tok = max_tokens or resolved.max_tokens
    if fn:
        text, steps, raw = fn(
            system=system,
            user_message=user_message,
            tools_schema=tools_schema,
            tool_executor=tool_executor,
            model=resolved.model,
            max_tokens=max_tok,
            max_iterations=max_iterations,
            on_step=on_step,
        )
        _record_chat(resolved, "agentic", raw)
        return text, steps
    return mod.agentic_loop(
        system=system,
        user_message=user_message,
        tools_schema=tools_schema,
        tool_executor=tool_executor,
        model=resolved.model,
        max_tokens=max_tok,
        max_iterations=max_iterations,
        on_step=on_step,
    )
