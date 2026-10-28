from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.activity_log import ActivityLog
from app.models.user import User
from app.schemas.activity import (
    ActivityLogCreate,
    ActivityLogResponse,
    PulseResponse,
    TeamTesterOverview,
)
from app.core.dependencies import get_current_user
from app.services.activity_service import (
    get_user_pulse,
    get_team_overview,
    record_activity,
)

router = APIRouter(prefix="/activity", tags=["Activity"])


@router.get("/pulse", response_model=PulseResponse)
def get_pulse(
    tester_id: Optional[int] = Query(None, description="Tester ID to inspect"),
    days: int = Query(365, ge=7, le=730, description="Number of days for heatmap"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve contribution heatmap matrix (52 weeks), streaks, and metrics."""
    # Testers can only view their own activity pulse
    if current_user.role == "tester":
        target_id = current_user.id
    else:
        # Managers can inspect specific tester or view overall team aggregate
        target_id = tester_id

    return get_user_pulse(db, user_id=target_id, days=days)


@router.get("/recent", response_model=List[ActivityLogResponse])
def get_recent_activity(
    tester_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve chronological recent activity feed."""
    query = db.query(ActivityLog)

    if current_user.role == "tester":
        query = query.filter(ActivityLog.user_id == current_user.id)
    elif tester_id is not None:
        query = query.filter(ActivityLog.user_id == tester_id)

    activities = query.order_by(desc(ActivityLog.created_at)).limit(limit).all()
    return activities


@router.get("/team-overview", response_model=List[TeamTesterOverview])
def get_team_activity_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manager view: List all testers with current streaks, active today status, and last activity."""
    if current_user.role != "manager":
        raise HTTPException(
            status_code=403,
            detail="Only managers can view the team activity overview.",
        )
    return get_team_overview(db)


@router.post("/log", response_model=ActivityLogResponse)
def log_manual_activity(
    payload: ActivityLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Log an explicit testing session or checkpoint."""
    target_user_id = current_user.id
    if current_user.role == "manager" and payload.user_id:
        target_user_id = payload.user_id

    log = record_activity(
        db=db,
        user_id=target_user_id,
        action_type=payload.action_type,
        title=payload.title,
        description=payload.description,
        project_id=payload.project_id,
    )
    if not log:
        raise HTTPException(status_code=500, detail="Failed to log activity")

    db.commit()
    db.refresh(log)
    return log
