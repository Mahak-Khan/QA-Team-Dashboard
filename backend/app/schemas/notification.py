from datetime import date, datetime
from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    project_id: int
    title: str
    message: str | None = None
    type: str
    is_read: bool
    created_at: datetime

    # Project details for review
    project_name: str | None = None
    project_description: str | None = None
    project_status: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    excel_sheet_url: str | None = None
    total_bugs: int = 0
    open_bugs: int = 0
    need_retest_bugs: int = 0
    retested_bugs: int = 0
    closed_bugs: int = 0
    fixed_bugs: int = 0
    critical_bugs: int = 0
    last_sheet_sync: datetime | None = None

    class Config:
        from_attributes = True


class UnreadCountResponse(BaseModel):
    unread_count: int
