
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.bug import Bug
from app.models.assignment import ProjectAssignment
from app.models.project import Project
from app.models.project_update import ProjectUpdate
from app.models.notification import Notification
from app.models.user import User
from app.schemas.bug import BugCreate, BugResponse, BugStatusUpdate
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/bugs", tags=["Bugs"])


@router.post("/", response_model=BugResponse)
def create_bug(
    bug_data: BugCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "tester":
        raise HTTPException(
            status_code=403,
            detail="Only testers can report bugs",
        )

    if bug_data.reported_by != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You can only report bugs as yourself",
        )

    if not bug_data.title.strip():
        raise HTTPException(
            status_code=400,
            detail="Bug title is required",
        )

    assignment = db.query(ProjectAssignment).filter(
        ProjectAssignment.project_id == bug_data.project_id,
        ProjectAssignment.tester_id == current_user.id,
    ).first()

    if not assignment:
        raise HTTPException(
            status_code=403,
            detail="You can report bugs only for assigned projects",
        )

    bug = Bug(
        project_id=bug_data.project_id,
        reported_by=current_user.id,
        title=bug_data.title.strip(),
        description=bug_data.description,
        severity=bug_data.severity,
        status="open",
    )

    db.add(bug)

    # If tester logs a critical bug, notify manager(s) immediately
    if bug_data.severity and bug_data.severity.lower() == "critical":
        project = db.query(Project).filter(Project.id == bug_data.project_id).first()
        project_title = project.name if project else f"Project #{bug_data.project_id}"
        tester_name = current_user.name if current_user and current_user.name else "QA Tester"

        managers = db.query(User).filter(User.role == "manager", User.is_active.is_(True)).all()
        for mgr in managers:
            notif = Notification(
                user_id=mgr.id,
                project_id=bug_data.project_id,
                title=f"Critical Defect Alert: {project_title}",
                message=f"{tester_name} logged a CRITICAL bug: '{bug.title}'. Immediate review or escalation required.",
                type="critical_bug",
                is_read=False,
            )
            db.add(notif)

    db.commit()
    db.refresh(bug)

    return bug


@router.get("/", response_model=list[BugResponse])
def get_bugs(
    project_id: int | None = None,
    tester_id: int | None = None,
    status: str | None = Query(
        default=None,
        pattern="^(open|need_retest|need to be retest|retested|closed)$",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Bug)

    effective_tester_id = current_user.id if current_user.role == "tester" else tester_id

    if effective_tester_id is not None:
        query = query.join(
            ProjectAssignment,
            ProjectAssignment.project_id == Bug.project_id,
        ).filter(
            ProjectAssignment.tester_id == effective_tester_id
        )
    elif current_user.role != "manager":
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    if project_id is not None:
        query = query.filter(Bug.project_id == project_id)

    if status is not None:
        normalized_st = (
            "need_retest"
            if status in ("need to be retest", "need_retest")
            else status
        )
        query = query.filter(Bug.status == normalized_st)

    return query.distinct().order_by(Bug.created_at.desc()).all()


@router.patch("/{bug_id}/status", response_model=BugResponse)
@router.put("/{bug_id}/status", response_model=BugResponse)
def update_bug_status(
    bug_id: int,
    status_data: BugStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bug = db.query(Bug).filter(Bug.id == bug_id).first()
    if not bug:
        raise HTTPException(
            status_code=404,
            detail="Bug not found",
        )

    if current_user.role == "tester":
        assignment = db.query(ProjectAssignment).filter(
            ProjectAssignment.project_id == bug.project_id,
            ProjectAssignment.tester_id == current_user.id
        ).first()
        if not assignment:
            raise HTTPException(
                status_code=403,
                detail="You can only update bug statuses for your assigned projects",
            )
    elif current_user.role != "manager":
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    bug.status = status_data.status
    db.commit()
    db.refresh(bug)

    return bug


@router.get("/summary")
def get_bug_summary(
    tester_id: int | None = None,
    project_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    effective_tester_id = current_user.id if current_user.role == "tester" else tester_id

    base_query = db.query(Bug)
    if effective_tester_id is not None:
        base_query = base_query.join(
            ProjectAssignment,
            ProjectAssignment.project_id == Bug.project_id,
        ).filter(
            ProjectAssignment.tester_id == effective_tester_id
        )

    if project_id is not None:
        base_query = base_query.filter(Bug.project_id == project_id)

    ticket_total = base_query.distinct().count()

    # Aggregate status counts in 1 SQL query using GROUP BY instead of 4 separate queries
    status_counts = {"open": 0, "need_retest": 0, "retested": 0, "closed": 0}
    for st, cnt in (
        base_query.with_entities(Bug.status, func.count(func.distinct(Bug.id)))
        .group_by(Bug.status)
        .all()
    ):
        if st in status_counts:
            status_counts[st] = cnt

    # Aggregate severity counts in 1 SQL query using GROUP BY instead of 4 separate queries
    severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for sev, cnt in (
        base_query.with_entities(Bug.severity, func.count(func.distinct(Bug.id)))
        .group_by(Bug.severity)
        .all()
    ):
        if sev in severity_counts:
            severity_counts[sev] = cnt

    # Aggregate live bug metrics from projects/cloud sheets
    proj_query = db.query(Project)
    if effective_tester_id is not None:
        proj_query = proj_query.join(
            ProjectAssignment,
            ProjectAssignment.project_id == Project.id,
        ).filter(
            ProjectAssignment.tester_id == effective_tester_id
        )

    if project_id is not None:
        proj_query = proj_query.filter(Project.id == project_id)

    projects = proj_query.distinct().all()

    sheet_total = 0
    sheet_open = 0
    sheet_need_retest = 0
    sheet_retested = 0
    sheet_closed = 0
    sheet_critical = 0

    if effective_tester_id is not None:
        assignment_query = db.query(ProjectAssignment).filter(
            ProjectAssignment.tester_id == effective_tester_id
        )
        if project_id is not None:
            assignment_query = assignment_query.filter(
                ProjectAssignment.project_id == project_id
            )
        tester_assignments = assignment_query.all()
        if tester_assignments:
            asgn_ids = [a.id for a in tester_assignments]
            asgn_proj_ids = {a.project_id for a in tester_assignments}

            # Batch fetch referenced projects (1 query instead of N)
            proj_map = {
                p.id: p
                for p in db.query(Project).filter(Project.id.in_(asgn_proj_ids)).all()
            }

            # Batch fetch updates (1 query instead of N)
            all_updates = (
                db.query(ProjectUpdate)
                .filter(ProjectUpdate.assignment_id.in_(asgn_ids))
                .order_by(ProjectUpdate.id.desc())
                .all()
            )
            latest_upd_map = {}
            for upd in all_updates:
                if upd.assignment_id not in latest_upd_map:
                    latest_upd_map[upd.assignment_id] = upd

            for asgn in tester_assignments:
                latest_upd = latest_upd_map.get(asgn.id)
                proj = proj_map.get(asgn.project_id)
                if latest_upd and (
                    latest_upd.open_bugs
                    or latest_upd.need_retest_bugs
                    or latest_upd.retested_bugs
                    or latest_upd.closed_bugs
                    or latest_upd.fixed_bugs
                    or latest_upd.critical_bugs
                ):
                    sheet_open += latest_upd.open_bugs or 0
                    sheet_need_retest += latest_upd.need_retest_bugs or 0
                    sheet_retested += latest_upd.retested_bugs or 0
                    sheet_closed += (latest_upd.closed_bugs or latest_upd.fixed_bugs or 0)
                    sheet_critical += latest_upd.critical_bugs or 0
                    sheet_total += (
                        (latest_upd.open_bugs or 0)
                        + (latest_upd.need_retest_bugs or 0)
                        + (latest_upd.retested_bugs or 0)
                        + (latest_upd.closed_bugs or latest_upd.fixed_bugs or 0)
                    )
                elif proj:
                    sheet_open += proj.open_bugs or 0
                    sheet_need_retest += proj.need_retest_bugs or 0
                    sheet_retested += proj.retested_bugs or 0
                    sheet_closed += (proj.closed_bugs or proj.fixed_bugs or 0)
                    sheet_critical += proj.critical_bugs or 0
                    sheet_total += proj.total_bugs or 0
    else:
        for p in projects:
            sheet_total += p.total_bugs or 0
            sheet_open += p.open_bugs or 0
            sheet_need_retest += p.need_retest_bugs or 0
            sheet_retested += p.retested_bugs or 0
            sheet_closed += (p.closed_bugs or p.fixed_bugs or 0)
            sheet_critical += p.critical_bugs or 0

    combined_total = max(ticket_total, sheet_total)
    combined_open = max(status_counts.get("open", 0), sheet_open)
    combined_need_retest = max(status_counts.get("need_retest", 0), sheet_need_retest)
    combined_retested = max(status_counts.get("retested", 0), sheet_retested)
    combined_closed = max(status_counts.get("closed", 0), sheet_closed)
    combined_critical = max(severity_counts.get("critical", 0), sheet_critical)

    return {
        "total": combined_total,
        "open": combined_open,
        "need_retest": combined_need_retest,
        "retested": combined_retested,
        "closed": combined_closed,
        "severities": {
            **severity_counts,
            "critical": combined_critical,
        },
        "sheet_metrics": {
            "total_bugs": sheet_total,
            "open_bugs": sheet_open,
            "need_retest_bugs": sheet_need_retest,
            "retested_bugs": sheet_retested,
            "closed_bugs": sheet_closed,
            "critical_bugs": sheet_critical,
        },
    }



@router.get("/{bug_id}")
def get_bug_by_id(
    bug_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bug = db.query(Bug).filter(Bug.id == bug_id).first()
    if not bug:
        raise HTTPException(status_code=404, detail="Bug not found")

    if current_user.role == "tester":
        assignment = db.query(ProjectAssignment).filter(
            ProjectAssignment.project_id == bug.project_id,
            ProjectAssignment.tester_id == current_user.id
        ).first()
        if not assignment:
            raise HTTPException(status_code=403, detail="Access denied")

    reporter = db.query(User).filter(User.id == bug.reported_by).first()

    return {
        "id": bug.id,
        "project_id": bug.project_id,
        "reported_by": bug.reported_by,
        "reporter_name": reporter.name if reporter else "Unknown",
        "reporter_email": reporter.email if reporter else "",
        "title": bug.title,
        "description": bug.description,
        "severity": bug.severity,
        "status": bug.status,
        "created_at": bug.created_at.isoformat() if bug.created_at else None,
    }


@router.delete("/{bug_id}")
def delete_bug(
    bug_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can delete bugs")

    bug = db.query(Bug).filter(Bug.id == bug_id).first()
    if not bug:
        raise HTTPException(status_code=404, detail="Bug not found")

    db.delete(bug)
    db.commit()
    return {"message": "Bug deleted successfully"}

