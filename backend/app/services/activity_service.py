from datetime import datetime, date, timedelta
from typing import Optional, List, Dict
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.models.activity_log import ActivityLog
from app.models.bug import Bug
from app.models.project_update import ProjectUpdate
from app.models.assignment import ProjectAssignment
from app.models.user import User
from app.schemas.activity import HeatmapDay, PulseSummary, PulseResponse, TeamTesterOverview


def record_activity(
    db: Session,
    user_id: int,
    action_type: str,
    title: str,
    description: Optional[str] = None,
    project_id: Optional[int] = None,
    created_at: Optional[datetime] = None,
) -> Optional[ActivityLog]:
    """Safely records an activity log entry without crashing caller transactions."""
    try:
        activity = ActivityLog(
            user_id=user_id,
            action_type=action_type,
            title=title[:255],
            description=description,
            project_id=project_id,
            created_at=created_at or datetime.now(),
        )
        db.add(activity)
        return activity
    except Exception as e:
        print(f"Failed to record activity log: {e}")
        return None


def get_activity_level(count: int) -> int:
    """Calculates GitHub-style contribution level (0 to 4)."""
    if count == 0:
        return 0
    elif count <= 2:
        return 1
    elif count <= 5:
        return 2
    elif count <= 9:
        return 3
    else:
        return 4


def get_user_pulse(
    db: Session,
    user_id: Optional[int] = None,
    days: int = 365,
) -> PulseResponse:
    """Generates the full 365-day contribution matrix and streaks for a user (or team)."""
    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)

    # Base query for activities in range
    query = db.query(ActivityLog).filter(
        ActivityLog.created_at >= datetime.combine(start_date, datetime.min.time()),
        ActivityLog.created_at <= datetime.combine(end_date, datetime.max.time()),
    )

    if user_id is not None:
        query = query.filter(ActivityLog.user_id == user_id)
        user = db.query(User).filter(User.id == user_id).first()
        tester_name = user.name if user else f"Tester #{user_id}"
    else:
        tester_name = "Team (All Testers)"

    activities = query.all()

    # Aggregate by date string YYYY-MM-DD
    day_counts: Dict[str, Dict[str, int]] = {}
    for act in activities:
        d_str = act.created_at.strftime("%Y-%m-%d")
        if d_str not in day_counts:
            day_counts[d_str] = {
                "total": 0,
                "bugs": 0,
                "status": 0,
                "progress": 0,
                "login": 0,
            }

        day_counts[d_str]["total"] += 1
        if act.action_type == "bug_reported":
            day_counts[d_str]["bugs"] += 1
        elif act.action_type in ("bug_status_updated", "bug_updated"):
            day_counts[d_str]["status"] += 1
        elif act.action_type == "progress_submitted":
            day_counts[d_str]["progress"] += 1
        elif act.action_type == "session_login":
            day_counts[d_str]["login"] += 1

    # Build continuous day array from start_date to end_date
    heatmap_days: List[HeatmapDay] = []
    curr = start_date
    while curr <= end_date:
        d_str = curr.strftime("%Y-%m-%d")
        stats = day_counts.get(d_str, {"total": 0, "bugs": 0, "status": 0, "progress": 0, "login": 0})
        heatmap_days.append(
            HeatmapDay(
                date=d_str,
                count=stats["total"],
                level=get_activity_level(stats["total"]),
                bugs_count=stats["bugs"],
                status_count=stats["status"],
                progress_count=stats["progress"],
                login_count=stats["login"],
            )
        )
        curr += timedelta(days=1)

    # Compute total contributions and type breakdowns
    total_contributions = len(activities)
    bugs_reported = sum(1 for a in activities if a.action_type == "bug_reported")
    status_updates = sum(1 for a in activities if a.action_type in ("bug_status_updated", "bug_updated"))
    progress_updates = sum(1 for a in activities if a.action_type == "progress_submitted")
    active_days = len(day_counts)

    # Compute streaks (current and longest)
    # Check backwards from today
    current_streak = 0
    check_day = end_date
    today_str = end_date.strftime("%Y-%m-%d")
    yesterday_str = (end_date - timedelta(days=1)).strftime("%Y-%m-%d")

    # If today has activity, streak starts from today
    # If today has no activity yet, streak can continue from yesterday
    if day_counts.get(today_str, {}).get("total", 0) > 0:
        while day_counts.get(check_day.strftime("%Y-%m-%d"), {}).get("total", 0) > 0:
            current_streak += 1
            check_day -= timedelta(days=1)
    elif day_counts.get(yesterday_str, {}).get("total", 0) > 0:
        check_day = end_date - timedelta(days=1)
        while day_counts.get(check_day.strftime("%Y-%m-%d"), {}).get("total", 0) > 0:
            current_streak += 1
            check_day -= timedelta(days=1)

    # Longest streak
    longest_streak = 0
    temp_streak = 0
    for day in heatmap_days:
        if day.count > 0:
            temp_streak += 1
            if temp_streak > longest_streak:
                longest_streak = temp_streak
        else:
            temp_streak = 0

    # Most recent activity timestamp
    last_act = (
        db.query(ActivityLog)
        .filter(ActivityLog.user_id == user_id if user_id else True)
        .order_by(desc(ActivityLog.created_at))
        .first()
    )
    last_active_at = last_act.created_at.isoformat() if last_act and last_act.created_at else None

    summary = PulseSummary(
        total_contributions=total_contributions,
        current_streak=current_streak,
        longest_streak=longest_streak,
        active_days=active_days,
        bugs_reported=bugs_reported,
        status_updates=status_updates,
        progress_updates=progress_updates,
        last_active_at=last_active_at,
    )

    return PulseResponse(
        tester_id=user_id,
        tester_name=tester_name,
        summary=summary,
        heatmap=heatmap_days,
    )


def get_team_overview(db: Session) -> List[TeamTesterOverview]:
    """Provides managers with an at-a-glance status of all testers, active today status, and streaks."""
    testers = db.query(User).filter(User.role == "tester", User.is_active.is_(True)).all()
    if not testers:
        return []

    tester_ids = [t.id for t in testers]
    today_start = datetime.combine(date.today(), datetime.min.time())
    month_start = datetime.combine(date.today().replace(day=1), datetime.min.time())
    year_start = datetime.combine(date.today().replace(month=1, day=1), datetime.min.time())
    streak_window_start = datetime.combine(date.today() - timedelta(days=60), datetime.min.time())

    # 1. Fetch counts grouped by user_id in batch
    today_counts = dict(
        db.query(ActivityLog.user_id, func.count(ActivityLog.id))
        .filter(ActivityLog.user_id.in_(tester_ids), ActivityLog.created_at >= today_start)
        .group_by(ActivityLog.user_id)
        .all()
    )

    month_counts = dict(
        db.query(ActivityLog.user_id, func.count(ActivityLog.id))
        .filter(ActivityLog.user_id.in_(tester_ids), ActivityLog.created_at >= month_start)
        .group_by(ActivityLog.user_id)
        .all()
    )

    year_counts = dict(
        db.query(ActivityLog.user_id, func.count(ActivityLog.id))
        .filter(ActivityLog.user_id.in_(tester_ids), ActivityLog.created_at >= year_start)
        .group_by(ActivityLog.user_id)
        .all()
    )

    # 2. Fetch distinct active dates for streak calculation in last 60 days
    recent_dates_raw = (
        db.query(ActivityLog.user_id, func.date(ActivityLog.created_at))
        .filter(ActivityLog.user_id.in_(tester_ids), ActivityLog.created_at >= streak_window_start)
        .distinct()
        .all()
    )
    user_active_dates: Dict[int, set] = {}
    for uid, dt in recent_dates_raw:
        if uid not in user_active_dates:
            user_active_dates[uid] = set()
        user_active_dates[uid].add(dt.strftime("%Y-%m-%d") if hasattr(dt, "strftime") else str(dt))

    # 3. Fetch latest activity per tester
    latest_activities: Dict[int, ActivityLog] = {}
    recent_logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.user_id.in_(tester_ids))
        .order_by(desc(ActivityLog.created_at))
        .all()
    )
    for act in recent_logs:
        if act.user_id not in latest_activities:
            latest_activities[act.user_id] = act

    end_date = date.today()
    today_str = end_date.strftime("%Y-%m-%d")
    yesterday_str = (end_date - timedelta(days=1)).strftime("%Y-%m-%d")

    result: List[TeamTesterOverview] = []
    for tester in testers:
        dates_set = user_active_dates.get(tester.id, set())

        # Fast streak computation
        current_streak = 0
        if today_str in dates_set:
            check_day = end_date
            while check_day.strftime("%Y-%m-%d") in dates_set:
                current_streak += 1
                check_day -= timedelta(days=1)
        elif yesterday_str in dates_set:
            check_day = end_date - timedelta(days=1)
            while check_day.strftime("%Y-%m-%d") in dates_set:
                current_streak += 1
                check_day -= timedelta(days=1)

        last_act = latest_activities.get(tester.id)

        result.append(
            TeamTesterOverview(
                id=tester.id,
                name=tester.name,
                email=tester.email,
                role=tester.role,
                active_today=today_counts.get(tester.id, 0) > 0,
                current_streak=current_streak,
                total_contributions_year=year_counts.get(tester.id, 0),
                total_contributions_month=month_counts.get(tester.id, 0),
                last_active_at=last_act.created_at.isoformat() if last_act and last_act.created_at else None,
                recent_action=last_act.title if last_act else "No recent activity",
            )
        )

    return result


def backfill_historical_activities(db: Session):
    """Seed existing Bug and ProjectUpdate records into ActivityLog so heatmaps are populated immediately."""
    try:
        existing_count = db.query(func.count(ActivityLog.id)).scalar() or 0
        if existing_count > 0:
            return  # Already seeded or has data

        print("Backfilling historical activities from existing Bugs and ProjectUpdates...")

        # 1. Backfill from Bugs
        bugs = db.query(Bug).all()
        for bug in bugs:
            db.add(
                ActivityLog(
                    user_id=bug.reported_by,
                    project_id=bug.project_id,
                    action_type="bug_reported",
                    title=f"Reported {bug.severity.upper()} Defect: '{bug.title}'",
                    description=bug.description,
                    created_at=bug.created_at or datetime.now(),
                )
            )

        # 2. Backfill from ProjectUpdates
        updates = (
            db.query(ProjectUpdate, ProjectAssignment)
            .join(ProjectAssignment, ProjectUpdate.assignment_id == ProjectAssignment.id)
            .all()
        )
        for upd, assign in updates:
            db.add(
                ActivityLog(
                    user_id=assign.tester_id,
                    project_id=assign.project_id,
                    action_type="progress_submitted",
                    title=f"Submitted Sprint Progress ({upd.progress}%)",
                    description=upd.remarks,
                    created_at=upd.updated_at or datetime.now(),
                )
            )

        db.commit()
        print("Historical activity backfill complete.")
    except Exception as e:
        db.rollback()
        print(f"Error backfilling historical activity: {e}")
