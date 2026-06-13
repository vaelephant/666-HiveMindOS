"""Provider 协议定义。"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Callable, Protocol


class ChatProvider(Protocol):
    def complete(
        self,
        *,
        prompt: str,
        system: str | None,
        model: str,
        max_tokens: int,
    ) -> str: ...

    def complete_stream(
        self,
        *,
        prompt: str,
        system: str | None,
        model: str,
        max_tokens: int,
    ) -> Iterator[str]: ...

    def agentic_loop(
        self,
        *,
        system: str,
        user_message: str,
        tools_schema: list[dict],
        tool_executor: Callable[[str, dict], str],
        model: str,
        max_tokens: int,
        max_iterations: int = 10,
        on_step: Callable[[dict], None] | None = None,
    ) -> tuple[str, list[dict]]: ...


class EmbedProvider(Protocol):
    def embed(self, *, text: str, model: str) -> list[float]: ...

    def embed_batch(self, *, texts: list[str], model: str) -> list[list[float]]: ...
