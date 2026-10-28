from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class ActivityLogBase(BaseModel):
    action_type: str
    title: str
    description: Optional[str] = None
    project_id: Optional[int] = None


class ActivityLogCreate(ActivityLogBase):
    user_id: Optional[int] = None


class ActivityLogResponse(ActivityLogBase):
    id: int
    user_id: int
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_role: Optional[str] = None
    project_name: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class HeatmapDay(BaseModel):
    date: str  # YYYY-MM-DD
    count: int
    level: int  # 0 to 4
    bugs_count: int = 0
    status_count: int = 0
    progress_count: int = 0
    login_count: int = 0


class PulseSummary(BaseModel):
    total_contributions: int = 0
    current_streak: int = 0
    longest_streak: int = 0
    active_days: int = 0
    bugs_reported: int = 0
    status_updates: int = 0
    progress_updates: int = 0
    last_active_at: Optional[str] = None


class PulseResponse(BaseModel):
    tester_id: Optional[int] = None
    tester_name: Optional[str] = None
    summary: PulseSummary
    heatmap: List[HeatmapDay]


class TeamTesterOverview(BaseModel):
    id: int
    name: str
    email: str
    role: str
    active_today: bool = False
    current_streak: int = 0
    total_contributions_year: int = 0
    total_contributions_month: int = 0
    last_active_at: Optional[str] = None
    recent_action: Optional[str] = None
