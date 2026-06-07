from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from memory_layer.knowledge_base.app.routers import ingest, query, wiki

app = FastAPI(title="HiveMindOS — Knowledge Base", version="0.1.0")

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
