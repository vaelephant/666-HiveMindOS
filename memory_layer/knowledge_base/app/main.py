from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from memory_layer.knowledge_base.app.logging_config import setup_logging, get_logger
from memory_layer.knowledge_base.app.routers import (
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
    usage,
    wiki,
)
from memory_layer.knowledge_base.core.services.model_settings_service import init_user_profile_resolver
from memory_layer.knowledge_base.core.services.usage_service import init_usage_tracking
from memory_layer.knowledge_base.app.routers.integrations import wechat_work as integrations_wechat_work
from memory_layer.knowledge_base.app.routers.webhooks import wechat_work as webhooks_wechat_work
from memory_layer.knowledge_base import config
from memory_layer.knowledge_base.core.db.postgres import close_pool, pg_conn
from memory_layer.knowledge_base.core.db.sequences import repair_serial_sequences


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
    db_host = config.DATABASE_URL.split("@")[-1] if "@" in config.DATABASE_URL else config.DATABASE_URL
    log.info("postgres     = %s", db_host)
    log.info("openai_key   = %s", "✓ set" if config.OPENAI_API_KEY else "✗ missing")
    log.info("anthropic_key= %s", "✓ set" if config.ANTHROPIC_API_KEY else "✗ missing")
    from model_layer.registry import startup_report

    for warning in startup_report():
        log.warning("[models] %s", warning)
    log.info("log_dir      = %s", config.LOG_DIR)
    log.info("━" * 50)

    init_usage_tracking()
    init_user_profile_resolver()

    try:
        with pg_conn() as conn:
            fixed = repair_serial_sequences(conn)
            conn.commit()
        if fixed:
            log.info("serial sequences repaired  %s", "; ".join(fixed))
    except Exception as exc:
        log.warning("serial sequence repair skipped: %s", exc)

    yield

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
app.include_router(settings.router,     prefix="/api/v1", tags=["settings"])
app.include_router(webhooks_wechat_work.router, prefix="/api/v1", tags=["webhooks"])
app.include_router(integrations_wechat_work.router, prefix="/api/v1", tags=["integrations"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "knowledge_base"}
