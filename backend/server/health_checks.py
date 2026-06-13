"""启动连通性自检 — Postgres / Qdrant / 大模型(embedding + chat)。

在 FastAPI 启动时实测各外部依赖是否可达，并以统一格式打印。
也供 /health 接口复用，返回结构化结果。

成本约定：
- postgres / qdrant 为本地连接，几乎免费，默认实测。
- embedding 会发一次最小 embed 请求（~1 token，极低成本），默认实测。
- chat 默认只校验 provider key 与已解析 model，不发请求（避免 --reload 反复烧钱）。
  如需实测 chat 真实联通，设置环境变量 STARTUP_LLM_PING=true。
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Callable

from knowledge_base import config


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str = ""
    latency_ms: float | None = None
    skipped: bool = False

    @property
    def icon(self) -> str:
        if self.skipped:
            return "○"
        return "✓" if self.ok else "✗"

    def as_dict(self) -> dict:
        return {
            "name": self.name,
            "ok": self.ok,
            "skipped": self.skipped,
            "detail": self.detail,
            "latency_ms": round(self.latency_ms, 1) if self.latency_ms is not None else None,
        }


def _run(name: str, fn: Callable[[], str]) -> CheckResult:
    start = time.perf_counter()
    try:
        detail = fn()
        ms = (time.perf_counter() - start) * 1000
        return CheckResult(name, True, detail, ms)
    except Exception as exc:  # noqa: BLE001 — 自检需吞掉一切异常并如实上报
        ms = (time.perf_counter() - start) * 1000
        return CheckResult(name, False, f"{type(exc).__name__}: {exc}", ms)


def _db_host() -> str:
    url = config.DATABASE_URL
    return url.split("@", 1)[-1] if "@" in url else url


def check_postgres() -> CheckResult:
    def run() -> str:
        from knowledge_base.core.db.postgres import pg_conn

        with pg_conn() as conn:
            row = conn.execute("SELECT version()").fetchone()
        version = (row[0] if row else "").split(" on ", 1)[0]
        return f"{_db_host()}  {version}".strip()

    return _run("postgres", run)


def check_qdrant() -> CheckResult:
    if not config.QDRANT_ENABLED:
        return CheckResult("qdrant", True, "QDRANT_ENABLED=false（已禁用）", skipped=True)

    def run() -> str:
        from qdrant_client import QdrantClient

        kwargs: dict = {"url": config.QDRANT_URL, "timeout": 5}
        if config.QDRANT_API_KEY:
            kwargs["api_key"] = config.QDRANT_API_KEY
        client = QdrantClient(**kwargs)
        names = {c.name for c in client.get_collections().collections}
        want = config.QDRANT_COLLECTION
        coll_flag = "✓" if want in names else "待建"
        return (
            f"{config.QDRANT_URL}  collections={len(names)}  "
            f"[{want}: {coll_flag}]"
        )

    return _run("qdrant", run)


def check_embedding() -> CheckResult:
    if not config.OPENAI_API_KEY:
        return CheckResult("embedding", False, "OPENAI_API_KEY 未设置")

    def run() -> str:
        from model_layer import client as llm
        from model_layer import registry

        resolved = registry.resolve_embed(None)
        vector = llm.embed("ping", source="healthcheck")
        return f"{resolved.provider}/{resolved.model}  dim={len(vector)}"

    return _run("embedding", run)


def _provider_key_present(provider: str) -> bool:
    if provider == "openai":
        return bool(config.OPENAI_API_KEY)
    if provider == "anthropic":
        return bool(config.ANTHROPIC_API_KEY)
    return True


def check_chat() -> CheckResult:
    live = os.environ.get("STARTUP_LLM_PING", "").lower() in ("1", "true", "yes")

    def run() -> str:
        from model_layer import registry

        resolved = registry.resolve_chat(None)
        if not _provider_key_present(resolved.provider):
            raise RuntimeError(f"{resolved.provider} 的 API key 未设置")
        label = f"{resolved.provider}/{resolved.model}"
        if not live:
            return f"{label}  key✓（已配置，未实测，设 STARTUP_LLM_PING=true 实测）"
        from model_layer import client as llm

        text = llm.complete("ping", max_tokens=8)
        preview = (text or "").strip().replace("\n", " ")[:24]
        return f"{label}  实测✓  reply={preview!r}"

    return _run("chat", run)


def run_startup_checks() -> list[CheckResult]:
    return [
        check_postgres(),
        check_qdrant(),
        check_embedding(),
        check_chat(),
    ]


def log_results(log, results: list[CheckResult]) -> None:
    log.info("连通自检 " + "─" * 38)
    for r in results:
        lat = f"  ({r.latency_ms:.0f}ms)" if r.latency_ms is not None and not r.skipped else ""
        line = "  %s %-10s %s%s" % (r.icon, r.name, r.detail, lat)
        if r.skipped or r.ok:
            log.info(line)
        else:
            log.error(line)
    failed = [r.name for r in results if not r.ok and not r.skipped]
    if failed:
        log.error("连通自检：%d 项失败 → %s", len(failed), ", ".join(failed))
    else:
        log.info("连通自检：全部通过")
    log.info("─" * 46)
