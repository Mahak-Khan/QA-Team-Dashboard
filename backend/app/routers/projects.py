
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import case, func

from app.database import get_db
from app.models.project import Project
from app.schemas.project import (
    ProjectCreate,
    ProjectResponse,
    ProjectStatusUpdate,
    ProjectMetricsUpdate,
)
from app.models.assignment import ProjectAssignment
from app.schemas.assignment import AssignmentCreate
from app.models.user import User
from app.core.dependencies import get_current_user
from app.models.project_update import ProjectUpdate
from app.schemas.project_update import ProjectUpdateCreate
from app.models.notification import Notification
from app.models.bug import Bug

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.post("/", response_model=ProjectResponse)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "manager":
        raise HTTPException(
            status_code=403,
            detail="Only managers can create projects",
        )

    if not payload.name.strip():
        raise HTTPException(
            status_code=400,
            detail="Project name is required",
        )

    if (
        payload.start_date
        and payload.end_date
        and payload.end_date < payload.start_date
    ):
        raise HTTPException(
            status_code=400,
            detail="End date cannot be before start date",
        )

    calculated_total = (
        payload.total_bugs
        if payload.total_bugs > 0
        else (
            (payload.open_bugs or 0)
            + (payload.need_retest_bugs or 0)
            + (payload.retested_bugs or 0)
            + (payload.closed_bugs or payload.fixed_bugs or 0)
        )
    )

    project = Project(
        name=payload.name.strip(),
        description=payload.description,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status="active",
        created_by=current_user.id,
        excel_sheet_url=payload.excel_sheet_url.strip() if payload.excel_sheet_url else None,
        total_bugs=calculated_total,
        open_bugs=payload.open_bugs or 0,
        need_retest_bugs=payload.need_retest_bugs or 0,
        retested_bugs=payload.retested_bugs or 0,
        closed_bugs=payload.closed_bugs or payload.fixed_bugs or 0,
        fixed_bugs=payload.fixed_bugs or payload.closed_bugs or 0,
        critical_bugs=payload.critical_bugs or 0,
        last_sheet_sync=(
            datetime.utcnow()
            if payload.excel_sheet_url or calculated_total > 0
            else None
        ),
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    return project


@router.get("/", response_model=list[ProjectResponse])
def get_projects(
    tester_id: int | None = None,
    project_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Project)

    if current_user.role == "tester":
        query = (
            query.join(
                ProjectAssignment,
                Project.id == ProjectAssignment.project_id,
            )
            .filter(ProjectAssignment.tester_id == current_user.id)
        )
    elif current_user.role == "manager":
        if tester_id is not None:
            query = (
                query.join(
                    ProjectAssignment,
                    Project.id == ProjectAssignment.project_id,
                )
                .filter(ProjectAssignment.tester_id == tester_id)
            )
    else:
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    if project_id is not None:
        query = query.filter(Project.id == project_id)

    projects = query.distinct().order_by(Project.id.desc()).all()
    proj_ids = [p.id for p in projects]
    if proj_ids:
        # Single ultra-fast SQL aggregation for all projects at once
        stats = (
            db.query(
                Bug.project_id,
                func.sum(case((Bug.status == "open", 1), else_=0)).label("open"),
                func.sum(case((Bug.status == "need_retest", 1), else_=0)).label("need_retest"),
                func.sum(case((Bug.status == "retested", 1), else_=0)).label("retested"),
                func.sum(case((Bug.status == "closed", 1), else_=0)).label("closed"),
                func.sum(case((func.lower(Bug.severity) == "critical", 1), else_=0)).label("critical"),
                func.count(Bug.id).label("total"),
            )
            .filter(Bug.project_id.in_(proj_ids))
            .group_by(Bug.project_id)
            .all()
        )
        stat_map = {row.project_id: row for row in stats}
        for p in projects:
            s = stat_map.get(p.id)
            p.open_bugs = int(s.open or 0) if s else 0
            p.need_retest_bugs = int(s.need_retest or 0) if s else 0
            p.retested_bugs = int(s.retested or 0) if s else 0
            p.closed_bugs = int(s.closed or 0) if s else 0
            p.fixed_bugs = p.closed_bugs
            p.critical_bugs = int(s.critical or 0) if s else 0
            p.total_bugs = int(s.total or 0) if s else 0

    return projects



@router.post("/{project_id}/assign")
def assign_tester(
    project_id: int,
    payload: AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "manager":
        raise HTTPException(
            status_code=403,
            detail="Only managers can assign testers",
        )

    project = db.query(Project).filter(
        Project.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    tester = db.query(User).filter(
        User.id == payload.tester_id,
        User.role == "tester",
        User.is_active.is_(True),
    ).first()

    if not tester:
        raise HTTPException(
            status_code=404,
            detail="Active tester not found",
        )

    existing = db.query(ProjectAssignment).filter(
        ProjectAssignment.project_id == project_id,
        ProjectAssignment.tester_id == payload.tester_id,
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Tester already assigned to this project",
        )

    assignment = ProjectAssignment(
        project_id=project_id,
        tester_id=payload.tester_id,
    )

    db.add(assignment)

    # Generate notification for tester
    manager_name = current_user.name if current_user and current_user.name else "Manager"
    notification = Notification(
        user_id=payload.tester_id,
        project_id=project_id,
        title=f"New Project Assigned: {project.name}",
        message=f"{manager_name} assigned you to project '{project.name}'. Review project scope, timeline, and bug sheet.",
        type="project_assignment",
        is_read=False,
    )
    db.add(notification)

    db.commit()
    db.refresh(assignment)

    return {
        "message": "Tester assigned successfully",
        "project_id": assignment.project_id,
        "tester_id": assignment.tester_id,
    }


@router.get("/tester/{tester_id}")
def get_tester_projects(
    tester_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "tester" and current_user.id != tester_id:
        raise HTTPException(
            status_code=403,
            detail="You can only view your own assigned projects",
        )

    if current_user.role not in ("manager", "tester"):
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    tester = db.query(User).filter(
        User.id == tester_id,
        User.role == "tester",
        User.is_active.is_(True),
    ).first()

    if not tester:
        raise HTTPException(
            status_code=404,
            detail="Tester not found",
        )

    projects = (
        db.query(Project)
        .join(
            ProjectAssignment,
            Project.id == ProjectAssignment.project_id,
        )
        .filter(ProjectAssignment.tester_id == tester_id)
        .order_by(Project.id.desc())
        .all()
    )

    return projects


@router.post("/{project_id}/updates")
def save_project_update(
    project_id: int,
    payload: ProjectUpdateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "tester":
        raise HTTPException(
            status_code=403,
            detail="Only testers can submit project progress",
        )

    if current_user.id != payload.tester_id:
        raise HTTPException(
            status_code=403,
            detail="You can only submit progress for your own account",
        )

    if not 0 <= payload.progress <= 100:
        raise HTTPException(
            status_code=400,
            detail="Progress must be between 0 and 100",
        )

    assignment = db.query(ProjectAssignment).filter(
        ProjectAssignment.project_id == project_id,
        ProjectAssignment.tester_id == current_user.id,
    ).first()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="This project is not assigned to this tester",
        )

    update = ProjectUpdate(
        assignment_id=assignment.id,
        sprint_name=payload.sprint_name,
        progress=payload.progress,
        remarks=payload.remarks,
        excel_sheet_url=payload.excel_sheet_url.strip() if payload.excel_sheet_url else None,
        open_bugs=payload.open_bugs or 0,
        need_retest_bugs=payload.need_retest_bugs or 0,
        retested_bugs=payload.retested_bugs or 0,
        closed_bugs=payload.closed_bugs or payload.fixed_bugs or 0,
        fixed_bugs=payload.fixed_bugs or payload.closed_bugs or 0,
        critical_bugs=payload.critical_bugs or 0,
    )

    db.add(update)

    # Sync project-level sheet URL & live bug tallies
    project = db.query(Project).filter(Project.id == project_id).first()
    if project:
        if payload.excel_sheet_url:
            project.excel_sheet_url = payload.excel_sheet_url.strip()
        if payload.open_bugs is not None:
            project.open_bugs = max(0, payload.open_bugs)
        if payload.need_retest_bugs is not None:
            project.need_retest_bugs = max(0, payload.need_retest_bugs)
        if payload.retested_bugs is not None:
            project.retested_bugs = max(0, payload.retested_bugs)
        if payload.closed_bugs is not None:
            project.closed_bugs = max(0, payload.closed_bugs)
            project.fixed_bugs = project.closed_bugs
        elif payload.fixed_bugs is not None:
            project.fixed_bugs = max(0, payload.fixed_bugs)
            project.closed_bugs = project.fixed_bugs

        if payload.critical_bugs is not None:
            project.critical_bugs = max(0, payload.critical_bugs)

        project.total_bugs = max(
            project.total_bugs,
            project.open_bugs + project.need_retest_bugs + project.retested_bugs + project.closed_bugs
        )
        project.last_sheet_sync = datetime.utcnow()

    # Notify manager(s) when tester submits a progress update
    project_title = project.name if project else f"Project #{project_id}"
    tester_name = current_user.name if current_user and current_user.name else "QA Tester"
    sprint_info = f" ({update.sprint_name})" if update.sprint_name else ""

    managers = db.query(User).filter(User.role == "manager", User.is_active.is_(True)).all()
    for mgr in managers:
        notif = Notification(
            user_id=mgr.id,
            project_id=project_id,
            title=f"Progress Update: {project_title}",
            message=f"{tester_name} submitted progress ({update.progress}%){sprint_info}. Remarks: {update.remarks or 'No remarks provided'}",
            type="progress_update",
            is_read=False,
        )
        db.add(notif)

    db.commit()
    db.refresh(update)

    return {
        "message": "Project progress saved successfully",
        "project_id": project_id,
        "tester_id": current_user.id,
        "sprint_name": update.sprint_name,
        "progress": update.progress,
        "remarks": update.remarks,
        "excel_sheet_url": update.excel_sheet_url,
        "open_bugs": update.open_bugs,
        "need_retest_bugs": update.need_retest_bugs,
        "retested_bugs": update.retested_bugs,
        "closed_bugs": update.closed_bugs,
        "fixed_bugs": update.fixed_bugs,
        "critical_bugs": update.critical_bugs,
    }


def populate_project_dynamic_counts(project: Project, db: Session) -> Project:
    s = (
        db.query(
            func.sum(case((Bug.status == "open", 1), else_=0)).label("open"),
            func.sum(case((Bug.status == "need_retest", 1), else_=0)).label("need_retest"),
            func.sum(case((Bug.status == "retested", 1), else_=0)).label("retested"),
            func.sum(case((Bug.status == "closed", 1), else_=0)).label("closed"),
            func.sum(case((func.lower(Bug.severity) == "critical", 1), else_=0)).label("critical"),
            func.count(Bug.id).label("total"),
        )
        .filter(Bug.project_id == project.id)
        .first()
    )
    if s:
        project.open_bugs = int(s.open or 0)
        project.need_retest_bugs = int(s.need_retest or 0)
        project.retested_bugs = int(s.retested or 0)
        project.closed_bugs = int(s.closed or 0)
        project.fixed_bugs = project.closed_bugs
        project.critical_bugs = int(s.critical or 0)
        project.total_bugs = int(s.total or 0)
    return project


@router.patch("/{project_id}/sheet-metrics", response_model=ProjectResponse)
@router.put("/{project_id}/sheet-metrics", response_model=ProjectResponse)
def update_project_metrics(
    project_id: int,
    payload: ProjectMetricsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if current_user.role == "tester":
        assignment = db.query(ProjectAssignment).filter(
            ProjectAssignment.project_id == project_id,
            ProjectAssignment.tester_id == current_user.id
        ).first()
        if not assignment:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Access denied")

    if payload.excel_sheet_url is not None:
        project.excel_sheet_url = payload.excel_sheet_url.strip() or None
    if payload.open_bugs is not None:
        project.open_bugs = max(0, payload.open_bugs)
    if payload.need_retest_bugs is not None:
        project.need_retest_bugs = max(0, payload.need_retest_bugs)
    if payload.retested_bugs is not None:
        project.retested_bugs = max(0, payload.retested_bugs)
    if payload.closed_bugs is not None:
        project.closed_bugs = max(0, payload.closed_bugs)
        project.fixed_bugs = project.closed_bugs
    elif payload.fixed_bugs is not None:
        project.fixed_bugs = max(0, payload.fixed_bugs)
        project.closed_bugs = project.fixed_bugs

    if payload.critical_bugs is not None:
        project.critical_bugs = max(0, payload.critical_bugs)

    if payload.total_bugs is not None:
        project.total_bugs = max(0, payload.total_bugs)
    else:
        project.total_bugs = max(
            project.total_bugs,
            project.open_bugs + project.need_retest_bugs + project.retested_bugs + project.closed_bugs
        )

    project.last_sheet_sync = datetime.utcnow()

    # Notify managers when a tester updates project defect metrics or connects a sheet
    if current_user.role == "tester":
        tester_name = current_user.name if current_user and current_user.name else "QA Tester"
        managers = db.query(User).filter(User.role == "manager", User.is_active.is_(True)).all()
        for mgr in managers:
            if mgr.id != current_user.id:
                notif = Notification(
                    user_id=mgr.id,
                    project_id=project.id,
                    title=f"Project Metrics Updated: {project.name}",
                    message=f"{tester_name} updated QA defect metrics and live sheet for '{project.name}' (Open: {project.open_bugs}, Need Retest: {project.need_retest_bugs}, Closed: {project.closed_bugs}).",
                    type="metrics_updated",
                    is_read=False,
                )
                db.add(notif)

    db.commit()
    db.refresh(project)
    return populate_project_dynamic_counts(project, db)



@router.get("/progress")
def get_all_project_progress(
    tester_id: int | None = None,
    project_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "manager":
        raise HTTPException(
            status_code=403,
            detail="Only managers can view all project progress",
        )

    rows_query = (
        db.query(ProjectAssignment, Project, User)
        .join(Project, ProjectAssignment.project_id == Project.id)
        .join(User, ProjectAssignment.tester_id == User.id)
    )
    if tester_id is not None:
        rows_query = rows_query.filter(ProjectAssignment.tester_id == tester_id)
    if project_id is not None:
        rows_query = rows_query.filter(ProjectAssignment.project_id == project_id)

    assignment_rows = rows_query.all()
    result = []

    if assignment_rows:
        assignment_ids = [asgn.id for asgn, _p, _u in assignment_rows]
        all_updates = (
            db.query(ProjectUpdate)
            .filter(ProjectUpdate.assignment_id.in_(assignment_ids))
            .order_by(ProjectUpdate.id.desc())
            .all()
        )
        latest_update_map = {}
        for upd in all_updates:
            if upd.assignment_id not in latest_update_map:
                latest_update_map[upd.assignment_id] = upd

        # Single grouped query for all projects in progress
        proj_ids = list({p.id for _a, p, _u in assignment_rows})
        stats = (
            db.query(
                Bug.project_id,
                func.sum(case((Bug.status == "open", 1), else_=0)).label("open"),
                func.sum(case((Bug.status == "need_retest", 1), else_=0)).label("need_retest"),
                func.sum(case((Bug.status == "retested", 1), else_=0)).label("retested"),
                func.sum(case((Bug.status == "closed", 1), else_=0)).label("closed"),
                func.sum(case((func.lower(Bug.severity) == "critical", 1), else_=0)).label("critical"),
                func.count(Bug.id).label("total"),
            )
            .filter(Bug.project_id.in_(proj_ids))
            .group_by(Bug.project_id)
            .all()
        )
        stat_map = {row.project_id: row for row in stats}

        for assignment, project, tester in assignment_rows:
            latest_update = latest_update_map.get(assignment.id)
            s = stat_map.get(project.id)
            p_open = int(s.open or 0) if s else 0
            p_need_retest = int(s.need_retest or 0) if s else 0
            p_retested = int(s.retested or 0) if s else 0
            p_closed = int(s.closed or 0) if s else 0
            p_crit = int(s.critical or 0) if s else 0
            p_total = int(s.total or 0) if s else 0

            result.append({
                "project_id": project.id,
                "project_name": project.name,
                "tester_id": tester.id,
                "tester_name": tester.name,
                "tester_email": tester.email,
                "sprint_name": (
                    latest_update.sprint_name if latest_update else "Not started"
                ),
                "progress": latest_update.progress if latest_update else 0,
                "remarks": latest_update.remarks if latest_update else "",
                "excel_sheet_url": (
                    latest_update.excel_sheet_url if latest_update and latest_update.excel_sheet_url else project.excel_sheet_url
                ),
                "open_bugs": p_open,
                "need_retest_bugs": p_need_retest,
                "retested_bugs": p_retested,
                "closed_bugs": p_closed,
                "fixed_bugs": p_closed,
                "critical_bugs": p_crit,
                "total_bugs": p_total,
                "updated_at": (
                    latest_update.updated_at.isoformat()
                    if latest_update and latest_update.updated_at
                    else None
                ),
            })

    # If filtering by a specific project that has no tester assigned yet, provide project info
    if project_id is not None and not result and tester_id is None:
        standalone_project = db.query(Project).filter(Project.id == project_id).first()
        if standalone_project:
            standalone_project = populate_project_dynamic_counts(standalone_project, db)
            result.append({
                "project_id": standalone_project.id,
                "project_name": standalone_project.name,
                "tester_id": None,
                "tester_name": "Unassigned",
                "tester_email": "N/A",
                "sprint_name": "Not started",
                "progress": 0,
                "remarks": "No tester assigned to this project yet",
                "excel_sheet_url": standalone_project.excel_sheet_url,
                "open_bugs": standalone_project.open_bugs,
                "need_retest_bugs": standalone_project.need_retest_bugs,
                "retested_bugs": standalone_project.retested_bugs,
                "closed_bugs": standalone_project.closed_bugs,
                "fixed_bugs": standalone_project.closed_bugs,
                "critical_bugs": standalone_project.critical_bugs,
                "total_bugs": standalone_project.total_bugs,
                "updated_at": None,
            })

    return result


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project_by_id(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if current_user.role == "tester":
        assignment = db.query(ProjectAssignment).filter(
            ProjectAssignment.project_id == project_id,
            ProjectAssignment.tester_id == current_user.id
        ).first()
        if not assignment:
            raise HTTPException(status_code=403, detail="Access denied")

    return populate_project_dynamic_counts(project, db)


@router.patch("/{project_id}/status", response_model=ProjectResponse)
@router.put("/{project_id}/status", response_model=ProjectResponse)
def update_project_status(
    project_id: int,
    payload: ProjectStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can update project status")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.status = payload.status
    db.commit()
    db.refresh(project)
    return populate_project_dynamic_counts(project, db)


@router.get("/{project_id}/updates")
def get_project_updates(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if current_user.role == "tester":
        assignment = db.query(ProjectAssignment).filter(
            ProjectAssignment.project_id == project_id,
            ProjectAssignment.tester_id == current_user.id
        ).first()
        if not assignment:
            raise HTTPException(status_code=403, detail="Access denied")

    rows = (
        db.query(ProjectUpdate, ProjectAssignment, User)
        .join(ProjectAssignment, ProjectUpdate.assignment_id == ProjectAssignment.id)
        .outerjoin(User, ProjectAssignment.tester_id == User.id)
        .filter(ProjectAssignment.project_id == project_id)
        .order_by(ProjectUpdate.updated_at.desc())
        .all()
    )

    results = []
    for update, assignment, tester in rows:
        results.append({
            "id": update.id,
            "assignment_id": update.assignment_id,
            "tester_id": tester.id if tester else None,
            "tester_name": tester.name if tester else "Unknown",
            "sprint_name": update.sprint_name or "Sprint",
            "progress": update.progress,
            "remarks": update.remarks or "",
            "excel_sheet_url": update.excel_sheet_url,
            "open_bugs": update.open_bugs,
            "need_retest_bugs": update.need_retest_bugs,
            "retested_bugs": update.retested_bugs,
            "closed_bugs": update.closed_bugs or update.fixed_bugs,
            "fixed_bugs": update.fixed_bugs or update.closed_bugs,
            "critical_bugs": update.critical_bugs,
            "updated_at": update.updated_at.isoformat() if update.updated_at else None,
        })
    return results




@router.delete("/{project_id}/assign/{tester_id}")
def unassign_tester(
    project_id: int,
    tester_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can unassign testers")

    assignment = db.query(ProjectAssignment).filter(
        ProjectAssignment.project_id == project_id,
        ProjectAssignment.tester_id == tester_id
    ).first()

    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    # Cascade delete all updates under this assignment first
    db.query(ProjectUpdate).filter(
        ProjectUpdate.assignment_id == assignment.id
    ).delete(synchronize_session=False)

    db.delete(assignment)
    # Remove notifications for this unassigned project and tester
    db.query(Notification).filter(
        Notification.project_id == project_id,
        Notification.user_id == tester_id,
    ).delete(synchronize_session=False)
    db.commit()
    return {"message": "Tester unassigned successfully"}


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can delete projects")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # 1. Cascade delete all bugs reported under this project
    db.query(Bug).filter(Bug.project_id == project_id).delete(synchronize_session=False)

    # 2. Cascade delete all project updates for assignments of this project
    assignments = db.query(ProjectAssignment).filter(ProjectAssignment.project_id == project_id).all()
    assignment_ids = [a.id for a in assignments]
    if assignment_ids:
        db.query(ProjectUpdate).filter(ProjectUpdate.assignment_id.in_(assignment_ids)).delete(synchronize_session=False)

    # 3. Cascade delete assignments for this project
    db.query(ProjectAssignment).filter(ProjectAssignment.project_id == project_id).delete(synchronize_session=False)

    # 4. Cascade delete notifications for this project
    db.query(Notification).filter(Notification.project_id == project_id).delete(synchronize_session=False)

    # 5. Delete project
    db.delete(project)
    db.commit()
    return {"message": "Project deleted successfully"}

