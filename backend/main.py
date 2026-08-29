from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db, get_db_status
from ingest import router as ingest_router, legacy_router as legacy_ingest_router
from security_engine import router as security_router

# Initialize database schema on startup
init_db()

app = FastAPI(
    title="AuditFlow Supply Chain & Master Farmer Registry API",
    description="FastAPI Backend for 18-Column Field Capture, Batch Ingestion, Record Retrieval, and SEC ISA Security Enforcement",
    version="1.0.0",
)

# Configure CORS for Mobile Client and Web Preview
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(ingest_router)
app.include_router(legacy_ingest_router)
app.include_router(security_router)

@app.get("/health", tags=["System Health"])
async def health_check():
    db_health = get_db_status()
    return {
        "status": "healthy" if db_health.get("connected") else "degraded",
        "service": "AuditFlow Field Capture Backend",
        "database": db_health,
        "endpoints": {
            "batch_ingest": "POST /api/v1/ingest/batch",
            "list_records": "GET /api/v1/ingest/records",
            "get_record": "GET /api/v1/ingest/records/{id_or_nin}",
            "export_csv": "GET /api/v1/ingest/records/export/csv",
            "stats_summary": "GET /api/v1/ingest/stats/summary",
            "upload_template": "POST /api/v1/ingest/upload-template",
            "security_reconcile": "POST /api/v1/security/reconcile-manifest",
            "db_health": "GET /api/v1/health/db",
        },
    }

@app.get("/api/v1/health/db", tags=["System Health"])
async def db_health_check():
    return get_db_status()

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", 8000))
    is_dev = os.getenv("ENVIRONMENT", "development").lower() == "development"
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=is_dev)
