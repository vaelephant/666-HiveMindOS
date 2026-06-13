"""启动连通性自检 — Postgres / Qdrant / 大模型(embedding + chat)。

在 FastAPI 启动时实测各外部依赖是否可达，并以统一格式打印；也供
/health/deps 接口复用，返回结构化结果。

健壮性约定：
- 所有检查【并行】执行，并共享一个 deadline（STARTUP_HEALTHCHECK_TIMEOUT，默认 5s），
  单项慢/挂不会拖累整体启动。
- 每项检查跑在 daemon 线程里，超时后即便底层调用仍在阻塞，也不会卡住启动或进程退出。
- postgres / qdrant 额外带客户端级超时，避免线程长期悬挂。

成本约定：
- postgres / qdrant 为本地连接，几乎免费，默认实测。
- embedding 会发一次最小 embed 请求（~1 token，极低成本），默认实测。
- chat 默认只校验 provider key 与已解析 model，不发请求（避免 --reload 反复烧钱）。
  设 STARTUP_LLM_PING=true 时才实测 chat 真实联通。
- 总开关 STARTUP_HEALTHCHECK=false 可整体关闭网络自检（启动只打印配置）。
"""

from __future__ import annotations

import os
import threading
import time
from dataclasses import dataclass
from typing import Callable

from shared import config


def _timeout() -> float:
    try:
        return float(os.environ.get("STARTUP_HEALTHCHECK_TIMEOUT", "5"))
    except ValueError:
        return 5.0


def _flag(name: str, default: bool = False) -> bool:
    val = os.environ.get(name, "").strip().lower()
    if not val:
        return default
    return val in ("1", "true", "yes", "on")


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


def _db_host() -> str:
    url = config.DATABASE_URL
    return url.split("@", 1)[-1] if "@" in url else url


# ── 各依赖的探测逻辑（成功返回 detail 字符串，失败抛异常）────────────────


def _detail_postgres() -> str:
    import psycopg

    connect_timeout = max(1, int(_timeout()))
    with psycopg.connect(config.DATABASE_URL, connect_timeout=connect_timeout) as conn:
        row = conn.execute("SELECT version()").fetchone()
    version = (row[0] if row else "").split(" on ", 1)[0]
    return f"{_db_host()}  {version}".strip()


def _detail_qdrant() -> str:
    from qdrant_client import QdrantClient

    kwargs: dict = {
        "url": config.QDRANT_URL,
        "timeout": max(1, int(_timeout())),
        "check_compatibility": False,
    }
    if config.QDRANT_API_KEY:
        kwargs["api_key"] = config.QDRANT_API_KEY
    client = QdrantClient(**kwargs)
    names = {c.name for c in client.get_collections().collections}
    want = config.QDRANT_COLLECTION
    coll_flag = "✓" if want in names else "待建"
    return f"{config.QDRANT_URL}  collections={len(names)}  [{want}: {coll_flag}]"


def _detail_embedding() -> str:
    from model_layer import client as llm
    from model_layer import registry

    resolved = registry.resolve_embed(None)
    vector = llm.embed("ping", source="healthcheck")
    return f"{resolved.provider}/{resolved.model}  dim={len(vector)}"


def _provider_key_present(provider: str) -> bool:
    if provider == "openai":
        return bool(config.OPENAI_API_KEY)
    if provider == "anthropic":
        return bool(config.ANTHROPIC_API_KEY)
    return True


def _detail_chat() -> str:
    from model_layer import registry

    resolved = registry.resolve_chat(None)
    if not _provider_key_present(resolved.provider):
        raise RuntimeError(f"{resolved.provider} 的 API key 未设置")
    label = f"{resolved.provider}/{resolved.model}"
    if not _flag("STARTUP_LLM_PING"):
        return f"{label}  key✓（已配置，未实测，设 STARTUP_LLM_PING=true 实测）"
    from model_layer import client as llm

    text = llm.complete("ping", max_tokens=8)
    preview = (text or "").strip().replace("\n", " ")[:24]
    return f"{label}  实测✓  reply={preview!r}"


# ── 并行调度（daemon 线程 + 共享 deadline）──────────────────────────────


def _run_parallel(specs: list[tuple[int, str, Callable[[], str]]], timeout: float) -> dict[int, CheckResult]:
    results: dict[int, CheckResult] = {}
    threads: dict[int, threading.Thread] = {}
    starts: dict[int, float] = {}

    def worker(idx: int, name: str, fn: Callable[[], str]) -> None:
        try:
            detail = fn()
            results[idx] = CheckResult(name, True, detail, (time.perf_counter() - starts[idx]) * 1000)
        except Exception as exc:  # noqa: BLE001 — 自检需吞掉一切异常并如实上报
            results[idx] = CheckResult(name, False, f"{type(exc).__name__}: {exc}", (time.perf_counter() - starts[idx]) * 1000)

    for idx, name, fn in specs:
        starts[idx] = time.perf_counter()
        t = threading.Thread(target=worker, args=(idx, name, fn), name=f"healthcheck-{name}", daemon=True)
        threads[idx] = t
        t.start()

    deadline = time.perf_counter() + timeout
    for idx, name, _ in specs:
        threads[idx].join(max(0.0, deadline - time.perf_counter()))
        if idx not in results:
            results[idx] = CheckResult(name, False, f"超时(>{timeout:g}s)", timeout * 1000)
    return results


def run_startup_checks(*, include_llm: bool = True) -> list[CheckResult]:
    """实测各依赖连通性。include_llm=False 时跳过 embedding/chat 的网络调用。"""
    timeout = _timeout()
    plan: list[CheckResult | tuple[str, Callable[[], str]]] = [("postgres", _detail_postgres)]

    if not config.QDRANT_ENABLED:
        plan.append(CheckResult("qdrant", True, "QDRANT_ENABLED=false（已禁用）", skipped=True))
    else:
        plan.append(("qdrant", _detail_qdrant))

    if include_llm:
        if config.OPENAI_API_KEY:
            plan.append(("embedding", _detail_embedding))
        else:
            plan.append(CheckResult("embedding", False, "OPENAI_API_KEY 未设置"))
        plan.append(("chat", _detail_chat))
    else:
        plan.append(CheckResult("embedding", True, "include_llm=false（跳过）", skipped=True))
        plan.append(CheckResult("chat", True, "include_llm=false（跳过）", skipped=True))

    slots: dict[int, CheckResult] = {}
    runnable: list[tuple[int, str, Callable[[], str]]] = []
    for i, item in enumerate(plan):
        if isinstance(item, CheckResult):
            slots[i] = item
        else:
            runnable.append((i, item[0], item[1]))

    if runnable:
        slots.update(_run_parallel(runnable, timeout))
    return [slots[i] for i in range(len(plan))]


# ── TTL 缓存（供 /health/deps 高频轮询时避免反复真连）───────────────────

_cache: dict[bool, tuple[float, list[CheckResult]]] = {}
_cache_lock = threading.Lock()


def cached_checks(*, include_llm: bool = True, ttl: float = 10.0) -> list[CheckResult]:
    now = time.monotonic()
    with _cache_lock:
        hit = _cache.get(include_llm)
        if hit and now - hit[0] < ttl:
            return hit[1]
    results = run_startup_checks(include_llm=include_llm)
    with _cache_lock:
        _cache[include_llm] = (now, results)
    return results


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
