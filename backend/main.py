
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import test_connection, engine, Base
import app.models  # Ensure all SQLAlchemy models are registered
from app.routers.auth import router as auth_router
from app.routers.projects import router as projects_router
from app.routers.team import router as team_router
from app.routers.notifications import router as notifications_router
from app.routers import bugs


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure all tables exist on startup
    try:
        Base.metadata.create_all(bind=engine)
        # Safely migrate new columns into existing MySQL tables if not present
        from sqlalchemy import inspect, text
        with engine.connect() as conn:
            inspector = inspect(engine)
            if inspector.has_table("projects"):
                proj_cols = [c["name"] for c in inspector.get_columns("projects")]
                if "excel_sheet_url" not in proj_cols:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN excel_sheet_url VARCHAR(500) NULL"))
                if "total_bugs" not in proj_cols:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN total_bugs INT NOT NULL DEFAULT 0"))
                if "open_bugs" not in proj_cols:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN open_bugs INT NOT NULL DEFAULT 0"))
                if "need_retest_bugs" not in proj_cols:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN need_retest_bugs INT NOT NULL DEFAULT 0"))
                if "retested_bugs" not in proj_cols:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN retested_bugs INT NOT NULL DEFAULT 0"))
                if "closed_bugs" not in proj_cols:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN closed_bugs INT NOT NULL DEFAULT 0"))
                if "fixed_bugs" not in proj_cols:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN fixed_bugs INT NOT NULL DEFAULT 0"))
                if "critical_bugs" not in proj_cols:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN critical_bugs INT NOT NULL DEFAULT 0"))
                if "last_sheet_sync" not in proj_cols:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN last_sheet_sync DATETIME NULL"))

            if inspector.has_table("project_updates"):
                upd_cols = [c["name"] for c in inspector.get_columns("project_updates")]
                if "excel_sheet_url" not in upd_cols:
                    conn.execute(text("ALTER TABLE project_updates ADD COLUMN excel_sheet_url VARCHAR(500) NULL"))
                if "open_bugs" not in upd_cols:
                    conn.execute(text("ALTER TABLE project_updates ADD COLUMN open_bugs INT NOT NULL DEFAULT 0"))
                if "need_retest_bugs" not in upd_cols:
                    conn.execute(text("ALTER TABLE project_updates ADD COLUMN need_retest_bugs INT NOT NULL DEFAULT 0"))
                if "retested_bugs" not in upd_cols:
                    conn.execute(text("ALTER TABLE project_updates ADD COLUMN retested_bugs INT NOT NULL DEFAULT 0"))
                if "closed_bugs" not in upd_cols:
                    conn.execute(text("ALTER TABLE project_updates ADD COLUMN closed_bugs INT NOT NULL DEFAULT 0"))
                if "fixed_bugs" not in upd_cols:
                    conn.execute(text("ALTER TABLE project_updates ADD COLUMN fixed_bugs INT NOT NULL DEFAULT 0"))
                if "critical_bugs" not in upd_cols:
                    conn.execute(text("ALTER TABLE project_updates ADD COLUMN critical_bugs INT NOT NULL DEFAULT 0"))

            if inspector.has_table("bugs"):
                bug_cols = {c["name"]: c for c in inspector.get_columns("bugs")}
                # Ensure status and severity accommodate all statuses without truncation
                conn.execute(text("ALTER TABLE bugs MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'open'"))
                conn.execute(text("ALTER TABLE bugs MODIFY COLUMN severity VARCHAR(30) NOT NULL DEFAULT 'medium'"))

            conn.commit()
    except Exception as e:
        print(f"Database schema initialization/migration notice: {e}")
    yield


app = FastAPI(title="QA Team Dashboard API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(team_router)
app.include_router(bugs.router)
app.include_router(notifications_router)

@app.get("/")
def home():
    return {"message": "QA Team Dashboard API is running"}

@app.get("/health/db")
def database_health():
    try:
        test_connection()
        return {"database": "connected"}
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Database connection failed. Check .env settings."
        )
