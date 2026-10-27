from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
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

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Project name is required")

        return value


class ProjectStatusUpdate(BaseModel):
    status: Literal["active", "completed", "on_hold"]


class ProjectMetricsUpdate(BaseModel):
    excel_sheet_url: str | None = None
    total_bugs: int | None = None
    open_bugs: int | None = None
    need_retest_bugs: int | None = None
    retested_bugs: int | None = None
    closed_bugs: int | None = None
    fixed_bugs: int | None = None
    critical_bugs: int | None = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: str | None
    status: str
    start_date: date | None
    end_date: date | None
    excel_sheet_url: str | None = None
    total_bugs: int = 0
    open_bugs: int = 0
    need_retest_bugs: int = 0
    retested_bugs: int = 0
    closed_bugs: int = 0
    fixed_bugs: int = 0
    critical_bugs: int = 0
    last_sheet_sync: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
