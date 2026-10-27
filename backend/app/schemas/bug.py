from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class BugCreate(BaseModel):
    project_id: int
    reported_by: int
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    severity: Literal["low", "medium", "high", "critical"] = "medium"

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Bug title is required")

        return value

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str | None) -> str | None:
        if value is not None:
            value = value.strip()
            return value or None

        return value


class BugStatusUpdate(BaseModel):
    status: Literal["open", "need_retest", "need to be retest", "retested", "closed"]

    @field_validator("status")
    @classmethod
    def normalize_status(cls, value: str) -> str:
        val = value.strip().lower()
        if val in ("need to be retest", "need_to_be_retest", "need_retest"):
            return "need_retest"
        return val


class BugResponse(BaseModel):
    id: int
    project_id: int
    reported_by: int
    title: str
    description: str | None
    severity: str
    status: str
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
