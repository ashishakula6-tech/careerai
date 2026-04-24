from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db, SessionLocal
from app.api.routes import auth, jobs, candidates, applications, approvals, notifications, audit, policy, portal

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-powered HR Recruitment Platform with human-in-the-loop controls",
)

# CORS — read allowed origins from env, fall back to wildcard for local dev
import os
_cors_env = os.getenv("CORS_ORIGINS", "")
if _cors_env:
    _origins = [o.strip() for o in _cors_env.split(",") if o.strip()]
else:
    _origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=False if "*" in _origins else True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "Accept-Ranges", "Content-Length"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(jobs.router, prefix="/api/v1")
app.include_router(candidates.router, prefix="/api/v1")
app.include_router(applications.router, prefix="/api/v1")
app.include_router(approvals.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(audit.router, prefix="/api/v1")
app.include_router(policy.router, prefix="/api/v1")
app.include_router(portal.router, prefix="/api/v1")


@app.on_event("startup")
def startup():
    init_db()
    _seed_data()

    # Auto-generate jobs in a background thread so startup doesn't block
    # (Render times out if startup takes >60s)
    import threading
    def _async_seed():
        try:
            from app.services.job_generator import seed_initial_jobs, start_background_generator
            seed_initial_jobs(min_count=100)  # Start with 100 jobs (faster)
            start_background_generator(interval_seconds=3600)
        except Exception as e:
            print(f"[startup] Job seeder error: {e}")
    threading.Thread(target=_async_seed, daemon=True).start()


def _seed_data():
    """Create demo tenant and users if they don't exist."""
    from app.models.tenant import Tenant
    from app.models.user import User
    from app.core.security import get_password_hash

    db = SessionLocal()
    try:
        if db.query(Tenant).first():
            return  # Already seeded

        tenant = Tenant(id="demo-tenant-001", name="Demo Company", domain="demo.example.com", gdpr_compliant=True, ccpa_compliant=True)
        db.add(tenant)
        db.flush()

        db.add(User(id="admin-user-001", tenant_id=tenant.id, email="admin@demo.example.com",
                     password_hash=get_password_hash("admin123"), full_name="Admin User", role="admin"))
        db.add(User(id="recruiter-user-001", tenant_id=tenant.id, email="recruiter@demo.example.com",
                     password_hash=get_password_hash("admin123"), full_name="Jane Recruiter", role="recruiter"))
        db.commit()
        print("Demo data seeded: admin@demo.example.com / admin123")
    finally:
        db.close()


@app.get("/")
def root():
    return {"name": settings.APP_NAME, "version": settings.APP_VERSION, "status": "running", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "healthy"}
