
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import case, func

from app.database import get_db
from app.models.bug import Bug
from app.models.assignment import ProjectAssignment
from app.models.project import Project
from app.models.project_update import ProjectUpdate
from app.models.notification import Notification
from app.models.user import User
from app.schemas.bug import BugCreate, BugResponse, BugStatusUpdate, BugUpdate
from app.core.dependencies import get_current_user
from app.services.activity_service import record_activity

router = APIRouter(prefix="/bugs", tags=["Bugs"])


@router.post("/", response_model=BugResponse)
def create_bug(
    bug_data: BugCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("tester", "manager"):
        raise HTTPException(
            status_code=403,
            detail="Only testers and managers can report bugs",
        )

    if current_user.role == "tester":
        if bug_data.reported_by != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You can only report bugs as yourself",
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

    if not bug_data.title.strip():
        raise HTTPException(
            status_code=400,
            detail="Bug title is required",
        )

    bug = Bug(
        project_id=bug_data.project_id,
        reported_by=current_user.id,
        title=bug_data.title.strip(),
        description=bug_data.description,
        severity=bug_data.severity,
        status="open",
        category=bug_data.category or "bug",
        sheet_url=bug_data.sheet_url.strip() if bug_data.sheet_url else None,
    )

    db.add(bug)

    # When tester reports a bug (or critical bug reported by anyone), notify active managers immediately
    project = db.query(Project).filter(Project.id == bug_data.project_id).first()
    project_title = project.name if project else f"Project #{bug_data.project_id}"
    reporter_name = current_user.name if current_user and current_user.name else "QA Tester"
    issue_type_label = "Requirement Change" if bug.category == "requirement_change" else "Defect"
    is_crit = bug_data.severity and bug_data.severity.lower() == "critical"

    if current_user.role == "tester" or is_crit:
        managers = db.query(User).filter(User.role == "manager", User.is_active.is_(True)).all()
        for mgr in managers:
            if mgr.id != current_user.id:
                notif_title = (
                    f"Critical {issue_type_label} Alert: {project_title}"
                    if is_crit
                    else f"New {issue_type_label} Reported: {project_title}"
                )
                sheet_note = " (Sheet link attached)" if bug.sheet_url else ""
                notif_msg = (
                    f"{reporter_name} logged a CRITICAL {issue_type_label}: '{bug.title}'. Immediate review required.{sheet_note}"
                    if is_crit
                    else f"{reporter_name} reported new {issue_type_label.lower()}: '{bug.title}' ({bug.severity.upper()}, Open).{sheet_note}"
                )
                notif = Notification(
                    user_id=mgr.id,
                    project_id=bug_data.project_id,
                    title=notif_title,
                    message=notif_msg,
                    type="critical_bug" if is_crit else "bug_reported",
                    is_read=False,
                )
                db.add(notif)

    # Record testing pulse activity
    record_activity(
        db=db,
        user_id=current_user.id,
        action_type="bug_reported",
        title=f"Reported {bug.severity.upper()} {issue_type_label}: '{bug.title}'",
        description=bug.description,
        project_id=bug.project_id,
    )

    db.commit()
    db.refresh(bug)

    return bug


@router.get("/", response_model=list[BugResponse])
def get_bugs(
    project_id: int | None = None,
    tester_id: int | None = None,
    reporter_id: int | None = None,
    category: str | None = None,
    severity: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Bug)

    # Testers can only view bugs for projects they are assigned to
    if current_user.role == "tester":
        query = query.join(
            ProjectAssignment,
            ProjectAssignment.project_id == Bug.project_id,
        ).filter(ProjectAssignment.tester_id == current_user.id).distinct()
    elif current_user.role != "manager":
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    # Filter by project
    if project_id is not None:
        query = query.filter(Bug.project_id == project_id)

    # Filter by reporter / tester who reported
    target_reporter = reporter_id or tester_id
    if target_reporter is not None:
        query = query.filter(Bug.reported_by == target_reporter)

    # Filter by category ('bug' or 'requirement_change')
    if category is not None and category != "" and category.lower() != "all":
        query = query.filter(Bug.category == category)

    # Filter by severity ('critical', 'high', 'medium', 'low')
    if severity is not None and severity != "" and severity.lower() != "all":
        query = query.filter(Bug.severity == severity.lower())

    # Filter by status
    if status is not None and status != "" and status.lower() != "all":
        normalized_st = (
            "need_retest"
            if status in ("need to be retest", "need_retest")
            else status.lower()
        )
        query = query.filter(Bug.status == normalized_st)

    return query.order_by(Bug.created_at.desc()).all()


@router.patch("/{bug_id}", response_model=BugResponse)
@router.put("/{bug_id}", response_model=BugResponse)
def update_bug(
    bug_id: int,
    bug_data: BugUpdate,
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
            ProjectAssignment.tester_id == current_user.id,
        ).first()
        if not assignment:
            raise HTTPException(
                status_code=403,
                detail="You can only update bugs for your assigned projects",
            )
    elif current_user.role != "manager":
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    if bug_data.title is not None:
        bug.title = bug_data.title
    if bug_data.description is not None:
        bug.description = bug_data.description
    if bug_data.severity is not None:
        bug.severity = bug_data.severity
    if bug_data.status is not None:
        bug.status = bug_data.status
    if bug_data.category is not None:
        bug.category = bug_data.category
    if bug_data.sheet_url is not None:
        bug.sheet_url = bug_data.sheet_url.strip() or None

    bug.updated_at = func.current_timestamp()

    # Notify manager(s) when a tester updates a defect
    if current_user.role == "tester":
        project = db.query(Project).filter(Project.id == bug.project_id).first()
        project_title = project.name if project else f"Project #{bug.project_id}"
        tester_name = current_user.name if current_user and current_user.name else "QA Tester"
        sheet_info = " (Sheet link updated)" if bug_data.sheet_url is not None else ""

        managers = db.query(User).filter(User.role == "manager", User.is_active.is_(True)).all()
        for mgr in managers:
            if mgr.id != current_user.id:
                notif = Notification(
                    user_id=mgr.id,
                    project_id=bug.project_id,
                    title=f"Defect Updated: {project_title}",
                    message=f"{tester_name} updated defect #{bug.id} '{bug.title}' (Status: {bug.status}, Severity: {bug.severity.upper()}).{sheet_info}",
                    type="bug_updated",
                    is_read=False,
                )
                db.add(notif)

    # Record testing pulse activity
    record_activity(
        db=db,
        user_id=current_user.id,
        action_type="bug_updated",
        title=f"Updated Defect #{bug.id}: '{bug.title}'",
        description=f"Status: {bug.status}, Severity: {bug.severity.upper()}",
        project_id=bug.project_id,
    )

    db.commit()
    db.refresh(bug)
    return bug


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
    bug.updated_at = func.current_timestamp()

    # Notify manager(s) when a tester changes defect status
    if current_user.role == "tester":
        project = db.query(Project).filter(Project.id == bug.project_id).first()
        project_title = project.name if project else f"Project #{bug.project_id}"
        tester_name = current_user.name if current_user and current_user.name else "QA Tester"

        managers = db.query(User).filter(User.role == "manager", User.is_active.is_(True)).all()
        for mgr in managers:
            if mgr.id != current_user.id:
                notif = Notification(
                    user_id=mgr.id,
                    project_id=bug.project_id,
                    title=f"Bug Status Changed: {project_title}",
                    message=f"{tester_name} updated status of defect #{bug.id} '{bug.title}' to '{bug.status}'.",
                    type="bug_status_updated",
                    is_read=False,
                )
                db.add(notif)

    # Record testing pulse activity
    record_activity(
        db=db,
        user_id=current_user.id,
        action_type="bug_status_updated",
        title=f"Changed defect #{bug.id} status to '{bug.status.upper()}'",
        description=f"Defect '{bug.title}' status changed to {bug.status}",
        project_id=bug.project_id,
    )

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

    # Single-roundtrip SQL aggregation using conditional SUM(CASE ...)
    summary_row = base_query.with_entities(
        func.count(func.distinct(Bug.id)).label("total"),
        func.sum(case((Bug.status == "open", 1), else_=0)).label("open"),
        func.sum(case((Bug.status == "need_retest", 1), else_=0)).label("need_retest"),
        func.sum(case((Bug.status == "retested", 1), else_=0)).label("retested"),
        func.sum(case((Bug.status == "closed", 1), else_=0)).label("closed"),
        func.sum(case((func.lower(Bug.severity) == "critical", 1), else_=0)).label("critical"),
        func.sum(case((func.lower(Bug.severity) == "high", 1), else_=0)).label("high"),
        func.sum(case((func.lower(Bug.severity) == "medium", 1), else_=0)).label("medium"),
        func.sum(case((func.lower(Bug.severity) == "low", 1), else_=0)).label("low"),
    ).first()

    total = int(summary_row.total or 0) if summary_row else 0
    open_cnt = int(summary_row.open or 0) if summary_row else 0
    need_retest_cnt = int(summary_row.need_retest or 0) if summary_row else 0
    retested_cnt = int(summary_row.retested or 0) if summary_row else 0
    closed_cnt = int(summary_row.closed or 0) if summary_row else 0
    critical_cnt = int(summary_row.critical or 0) if summary_row else 0
    high_cnt = int(summary_row.high or 0) if summary_row else 0
    medium_cnt = int(summary_row.medium or 0) if summary_row else 0
    low_cnt = int(summary_row.low or 0) if summary_row else 0

    return {
        "total": total,
        "open": open_cnt,
        "need_retest": need_retest_cnt,
        "retested": retested_cnt,
        "closed": closed_cnt,
        "severities": {
            "critical": critical_cnt,
            "high": high_cnt,
            "medium": medium_cnt,
            "low": low_cnt,
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
    project = db.query(Project).filter(Project.id == bug.project_id).first()

    return {
        "id": bug.id,
        "project_id": bug.project_id,
        "project_name": project.name if project else f"Project #{bug.project_id}",
        "reported_by": bug.reported_by,
        "reporter_name": reporter.name if reporter else "Unknown",
        "reporter_email": reporter.email if reporter else "",
        "title": bug.title,
        "description": bug.description,
        "severity": bug.severity,
        "status": bug.status,
        "category": bug.category,
        "sheet_url": bug.sheet_url,
        "created_at": bug.created_at.isoformat() if bug.created_at else None,
        "updated_at": bug.updated_at.isoformat() if bug.updated_at else None,
    }


@router.delete("/{bug_id}")
def delete_bug(
    bug_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bug = db.query(Bug).filter(Bug.id == bug_id).first()
    if not bug:
        raise HTTPException(status_code=404, detail="Bug not found")

    if current_user.role == "manager":
        pass
    elif current_user.role == "tester" and bug.reported_by == current_user.id:
        pass
    else:
        raise HTTPException(status_code=403, detail="Only managers or the reporter can delete this defect")

    db.delete(bug)
    db.commit()
    return {"message": "Bug deleted successfully"}

