from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.notification import Notification
from app.models.project import Project
from app.models.user import User
from app.core.dependencies import get_current_user
from app.schemas.notification import NotificationResponse, UnreadCountResponse

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def build_notification_response(n: Notification) -> NotificationResponse:
    p: Project | None = n.project
    return NotificationResponse(
        id=n.id,
        user_id=n.user_id,
        project_id=n.project_id,
        title=n.title,
        message=n.message,
        type=n.type,
        is_read=n.is_read,
        created_at=n.created_at,
        project_name=p.name if p else None,
        project_description=p.description if p else None,
        project_status=p.status if p else None,
        start_date=p.start_date if p else None,
        end_date=p.end_date if p else None,
        excel_sheet_url=p.excel_sheet_url if p else None,
        total_bugs=p.total_bugs if p else 0,
        open_bugs=p.open_bugs if p else 0,
        need_retest_bugs=p.need_retest_bugs if p else 0,
        retested_bugs=p.retested_bugs if p else 0,
        closed_bugs=p.closed_bugs if p else 0,
        fixed_bugs=p.fixed_bugs if p else 0,
        critical_bugs=p.critical_bugs if p else 0,
        last_sheet_sync=p.last_sheet_sync if p else None,
    )


@router.get("/", response_model=list[NotificationResponse])
def get_user_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notifications = (
        db.query(Notification)
        .options(joinedload(Notification.project))
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )
    return [build_notification_response(n) for n in notifications]


@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
        .count()
    )
    return {"unread_count": count}


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
@router.put("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = (
        db.query(Notification)
        .options(joinedload(Notification.project))
        .filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    db.commit()
    db.refresh(notification)

    return build_notification_response(notification)


@router.patch("/mark-all-read")
@router.put("/mark-all-read")
def mark_all_notifications_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()

    return {"message": "All notifications marked as read"}
