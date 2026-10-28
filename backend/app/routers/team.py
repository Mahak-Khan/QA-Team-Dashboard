
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.assignment import ProjectAssignment
from app.models.project_update import ProjectUpdate
from app.models.bug import Bug
from app.models.notification import Notification
from app.core.security import get_password_hash
from app.core.dependencies import get_current_user
from app.schemas.team import TesterCreate

router = APIRouter(prefix="/team", tags=["Team"])


def manager_only(current_user: User):
    if current_user.role != "manager":
        raise HTTPException(
            status_code=403,
            detail="Only managers can access this resource"
        )


@router.post("/testers")
def create_tester(
    payload: TesterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    manager_only(current_user)

    if not payload.name.strip():
        raise HTTPException(
            status_code=400,
            detail="Name is required"
        )

    existing_user = db.query(User).filter(
        User.email == payload.email
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already exists"
        )

    tester = User(
        name=payload.name.strip(),
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role="tester",
        is_active=True,
    )

    db.add(tester)
    db.commit()
    db.refresh(tester)

    return {
        "id": tester.id,
        "name": tester.name,
        "email": tester.email,
        "role": tester.role,
    }


@router.get("/testers")
def get_testers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("manager", "tester"):
        raise HTTPException(status_code=403, detail="Access denied")

    return db.query(User).filter(
        User.role == "tester",
        User.is_active == True
    ).all()


@router.get("/testers/{tester_id}")
def get_tester_by_id(
    tester_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    manager_only(current_user)
    tester = db.query(User).filter(User.id == tester_id, User.role == "tester").first()
    if not tester:
        raise HTTPException(status_code=404, detail="Tester not found")

    return {
        "id": tester.id,
        "name": tester.name,
        "email": tester.email,
        "role": tester.role,
        "is_active": tester.is_active,
    }


@router.patch("/testers/{tester_id}/status")
@router.put("/testers/{tester_id}/status")
def toggle_tester_status(
    tester_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    manager_only(current_user)
    tester = db.query(User).filter(User.id == tester_id, User.role == "tester").first()
    if not tester:
        raise HTTPException(status_code=404, detail="Tester not found")

    tester.is_active = not tester.is_active
    db.commit()
    db.refresh(tester)
    return {
        "id": tester.id,
        "name": tester.name,
        "is_active": tester.is_active,
        "message": f"Tester account {'activated' if tester.is_active else 'deactivated'}."
    }


@router.delete("/testers/{tester_id}")
def delete_tester(
    tester_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    manager_only(current_user)
    tester = db.query(User).filter(User.id == tester_id, User.role == "tester").first()
    if not tester:
        raise HTTPException(status_code=404, detail="Tester not found")

    # 1. Reassign reported bugs to the Manager so defect tracking history is preserved
    db.query(Bug).filter(Bug.reported_by == tester_id).update(
        {"reported_by": current_user.id},
        synchronize_session=False,
    )

    # 2. Find all project assignments for this tester
    assignments = db.query(ProjectAssignment).filter(ProjectAssignment.tester_id == tester_id).all()
    assignment_ids = [a.id for a in assignments]

    # 3. Clean up progress updates logged under these assignments
    if assignment_ids:
        db.query(ProjectUpdate).filter(ProjectUpdate.assignment_id.in_(assignment_ids)).delete(
            synchronize_session=False
        )

    # 4. Remove assignments - frees up projects so they can be reassigned to other testers
    db.query(ProjectAssignment).filter(ProjectAssignment.tester_id == tester_id).delete(
        synchronize_session=False
    )

    # 5. Clean up notifications sent to this tester
    db.query(Notification).filter(Notification.user_id == tester_id).delete(
        synchronize_session=False
    )

    # 6. Delete tester account safely
    db.delete(tester)
    db.commit()

    return {
        "message": f"Tester '{tester.name}' deleted successfully. Assigned projects have been freed up.",
        "freed_projects_count": len(assignment_ids),
    }

