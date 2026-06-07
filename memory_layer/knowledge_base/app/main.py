from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from memory_layer.knowledge_base.app.logging_config import setup_logging, get_logger
from memory_layer.knowledge_base.app.routers import ingest, query, wiki
from memory_layer.knowledge_base import config


@asynccontextmanager
async def lifespan(_app: FastAPI):
    setup_logging()
    log = get_logger("hivemind.startup")

    log.info("━" * 50)
    log.info("  HiveMindOS · Knowledge Base  v0.1.0")
    log.info("━" * 50)
    log.info("model        = %s", config.DEFAULT_MODEL)
    log.info("fast_model   = %s", config.FAST_MODEL)
    log.info("storage      = %s", config.STORAGE_ROOT)
    log.info("wiki         = %s", config.WIKI_ROOT)
    log.info("registry_db  = %s", config.REGISTRY_DB)
    log.info("openai_key   = %s", "✓ set" if config.OPENAI_API_KEY else "✗ missing — AI calls will fail")
    log.info("log_dir      = %s", config.LOG_DIR)
    log.info("━" * 50)

    yield

    log.info("Knowledge Base server shutting down.")


app = FastAPI(title="HiveMindOS — Knowledge Base", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router, prefix="/api/v1", tags=["ingest"])
app.include_router(query.router,  prefix="/api/v1", tags=["query"])
app.include_router(wiki.router,   prefix="/api/v1", tags=["wiki"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "knowledge_base"}
