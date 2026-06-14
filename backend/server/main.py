from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from server.logging_config import setup_logging, get_logger
from server.health_checks import run_startup_checks, cached_checks, log_results, _flag
from server.routers import (
    audit,
    automations,
    candidates,
    chat,
    ingest,
    memories,
    overview,
    playbook,
    query,
    settings,
    skills,
    tasks,
    tool_registry,
    usage,
    wiki,
    workflows,
    health,
)
from model_layer.services.model_settings_service import init_user_profile_resolver
from model_layer.services.usage_service import init_usage_tracking
from server.routers.integrations import wechat_work as integrations_wechat_work
from server.routers.webhooks import wechat_work as webhooks_wechat_work
from shared import config
from shared.db.postgres import close_pool, pg_conn
from shared.db.sequences import repair_serial_sequences


@asynccontextmanager
async def lifespan(_app: FastAPI):
    setup_logging()
    log = get_logger("hivemind.startup")

    log.info("━" * 50)
    log.info("  HiveMindOS · AI 执行引擎  v0.1.0")
    log.info("━" * 50)
    log.info("model        = %s (%s)", config.DEFAULT_MODEL, "default")
    log.info("fast_model   = %s (%s)", config.FAST_MODEL, "fast")
    log.info("embedding    = %s dim=%s", config.EMBEDDING_MODEL, config.EMBEDDING_DIM)
    log.info("storage      = %s", config.STORAGE_ROOT)
    log.info("wiki         = %s", config.WIKI_ROOT)
    log.info("registry_db  = %s", config.REGISTRY_DB)
    from model_layer.registry import startup_report

    for warning in startup_report():
        log.warning("[models] %s", warning)
    log.info("log_dir      = %s", config.LOG_DIR)
    log.info("━" * 50)

    init_usage_tracking()
    init_user_profile_resolver()

    if _flag("STARTUP_HEALTHCHECK", default=True):
        try:
            log_results(log, run_startup_checks())
        except Exception as exc:  # noqa: BLE001 — 自检失败不应阻断启动
            log.error("连通自检执行异常: %s", exc)
    else:
        log.info("连通自检已关闭 (STARTUP_HEALTHCHECK=false)")

    try:
        with pg_conn() as conn:
            fixed = repair_serial_sequences(conn)
            conn.commit()
        if fixed:
            log.info("serial sequences repaired  %s", "; ".join(fixed))
    except Exception as exc:
        log.warning("serial sequence repair skipped: %s", exc)

    scheduler_task = None
    if _flag("WORKFLOW_SCHEDULER_ENABLED", default=False):
        from ops.core.services.workflow_scheduler import start_scheduler

        scheduler_task = start_scheduler()
        log.info("工作流 cron 调度已启用 (WORKFLOW_SCHEDULER_ENABLED=true)")

    yield

    if scheduler_task is not None:
        from ops.core.services.workflow_scheduler import stop_scheduler

        await stop_scheduler()

    close_pool()
    log.info("HiveMindOS server shutting down.")


app = FastAPI(title="HiveMindOS — AI Execution Engine", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router,       prefix="/api/v1", tags=["chat"])
app.include_router(memories.router,   prefix="/api/v1", tags=["memories"])
app.include_router(candidates.router, prefix="/api/v1", tags=["candidates"])
app.include_router(ingest.router,   prefix="/api/v1", tags=["ingest"])
app.include_router(overview.router, prefix="/api/v1", tags=["overview"])
app.include_router(query.router,    prefix="/api/v1", tags=["query"])
app.include_router(tasks.router,        prefix="/api/v1", tags=["tasks"])
app.include_router(automations.router,  prefix="/api/v1", tags=["automations"])
app.include_router(wiki.router,         prefix="/api/v1", tags=["wiki"])
app.include_router(skills.router,       prefix="/api/v1", tags=["skills"])
app.include_router(playbook.router,     prefix="/api/v1", tags=["playbook"])
app.include_router(usage.router,        prefix="/api/v1", tags=["usage"])
app.include_router(audit.router,        prefix="/api/v1", tags=["audit"])
app.include_router(tool_registry.router, prefix="/api/v1", tags=["tools"])
app.include_router(workflows.router,    prefix="/api/v1", tags=["workflows"])
app.include_router(settings.router,     prefix="/api/v1", tags=["settings"])
app.include_router(webhooks_wechat_work.router, prefix="/api/v1", tags=["webhooks"])
app.include_router(integrations_wechat_work.router, prefix="/api/v1", tags=["integrations"])
app.include_router(health.router,              prefix="/api/v1", tags=["health"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "knowledge_base"}


@app.get("/health/deps")
def health_deps(live: bool = True):
    """实测各外部依赖连通性。

    - live=true（默认）：连 Postgres/Qdrant，并真发一次 embedding。
    - live=false：跳过大模型网络调用，只查本地依赖（Postgres/Qdrant）。

    结果带 10s TTL 缓存，避免高频轮询反复真连/烧钱。
    """
    results = cached_checks(include_llm=live)
    checks = [r.as_dict() for r in results]
    all_ok = all(r.ok or r.skipped for r in results)
    return {
        "status": "ok" if all_ok else "degraded",
        "checks": checks,
    }
