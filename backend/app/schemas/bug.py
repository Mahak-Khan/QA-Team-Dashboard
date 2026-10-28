from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class BugCreate(BaseModel):
    project_id: int
    reported_by: int
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    severity: Literal["low", "medium", "high", "critical"] = "medium"
    category: Literal["bug", "requirement_change"] = "bug"
    sheet_url: str | None = Field(default=None, max_length=500)

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

    @field_validator("sheet_url")
    @classmethod
    def validate_sheet_url(cls, value: str | None) -> str | None:
        if value is not None:
            value = value.strip()
            return value or None
        return value


class BugUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    severity: Literal["low", "medium", "high", "critical"] | None = None
    status: Literal["open", "need_retest", "need to be retest", "retested", "closed"] | None = None
    category: Literal["bug", "requirement_change"] | None = None
    sheet_url: str | None = Field(default=None, max_length=500)

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str | None) -> str | None:
        if value is not None:
            value = value.strip()
            if not value:
                raise ValueError("Bug title cannot be empty")
        return value

    @field_validator("status")
    @classmethod
    def normalize_status(cls, value: str | None) -> str | None:
        if value is not None:
            val = value.strip().lower()
            if val in ("need to be retest", "need_to_be_retest", "need_retest"):
                return "need_retest"
            return val
        return value

    @field_validator("sheet_url")
    @classmethod
    def validate_sheet_url(cls, value: str | None) -> str | None:
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
    description: str | None = None
    severity: str
    status: str
    category: str = "bug"
    sheet_url: str | None = None
    project_name: str | None = None
    reporter_name: str | None = None
    reporter_email: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
