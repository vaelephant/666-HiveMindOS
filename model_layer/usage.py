"""LLM token usage — context + callback hooks for persistence."""

from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Callable

UsageCallback = Callable[["UsageRecord"], None]

_usage_ctx: ContextVar["UsageContext | None"] = ContextVar("llm_usage_ctx", default=None)
_callbacks: list[UsageCallback] = []


@dataclass(frozen=True)
class TokenUsage:
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    cached_prompt_tokens: int = 0
    cache_creation_tokens: int = 0

    @property
    def cache_hit_rate(self) -> float | None:
        """KV / prompt cache 命中率：cached / prompt（无输入时返回 None）。"""
        if self.prompt_tokens <= 0:
            return None
        return self.cached_prompt_tokens / self.prompt_tokens

    @classmethod
    def from_counts(
        cls,
        *,
        prompt_tokens: int | None = None,
        completion_tokens: int | None = None,
        total_tokens: int | None = None,
        cached_prompt_tokens: int | None = None,
        cache_creation_tokens: int | None = None,
    ) -> "TokenUsage | None":
        prompt = int(prompt_tokens or 0)
        completion = int(completion_tokens or 0)
        total = int(total_tokens if total_tokens is not None else prompt + completion)
        cached = int(cached_prompt_tokens or 0)
        cache_creation = int(cache_creation_tokens or 0)
        if total <= 0 and prompt <= 0 and completion <= 0 and cached <= 0:
            return None
        return cls(
            prompt_tokens=prompt,
            completion_tokens=completion,
            total_tokens=total,
            cached_prompt_tokens=cached,
            cache_creation_tokens=cache_creation,
        )


@dataclass(frozen=True)
class UsageContext:
    org_id: str
    user_id: str
    source: str
    source_id: str | None = None


@dataclass(frozen=True)
class UsageRecord:
    org_id: str
    user_id: str
    provider: str
    model: str
    profile_id: str | None
    operation: str
    source: str
    source_id: str | None
    usage: TokenUsage


def register_usage_callback(callback: UsageCallback) -> None:
    if callback not in _callbacks:
        _callbacks.append(callback)


def get_usage_context() -> UsageContext | None:
    return _usage_ctx.get()


@contextmanager
def track_usage(
    org_id: str,
    user_id: str,
    source: str,
    source_id: str | None = None,
):
    token = _usage_ctx.set(UsageContext(org_id=org_id, user_id=user_id, source=source, source_id=source_id))
    try:
        yield
    finally:
        _usage_ctx.reset(token)


def emit_usage(
    *,
    provider: str,
    model: str,
    profile_id: str | None,
    operation: str,
    usage: TokenUsage | None,
    org_id: str | None = None,
    user_id: str | None = None,
    source: str | None = None,
    source_id: str | None = None,
) -> None:
    if usage is None:
        return
    ctx = _usage_ctx.get()
    record = UsageRecord(
        org_id=org_id or (ctx.org_id if ctx else "unknown"),
        user_id=user_id or (ctx.user_id if ctx else "demo"),
        provider=provider,
        model=model,
        profile_id=profile_id,
        operation=operation,
        source=source or (ctx.source if ctx else "unknown"),
        source_id=source_id if source_id is not None else (ctx.source_id if ctx else None),
        usage=usage,
    )
    for callback in _callbacks:
        try:
            callback(record)
        except Exception:
            pass
