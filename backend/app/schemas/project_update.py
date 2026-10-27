from pydantic import BaseModel, Field, field_validator


class ProjectUpdateCreate(BaseModel):
    tester_id: int = Field(gt=0)
    sprint_name: str = Field(min_length=1, max_length=100)
    progress: int = Field(ge=0, le=100)
    remarks: str | None = Field(default=None, max_length=2000)
    excel_sheet_url: str | None = Field(default=None, max_length=500)
    open_bugs: int | None = Field(default=None, ge=0)
    need_retest_bugs: int | None = Field(default=None, ge=0)
    retested_bugs: int | None = Field(default=None, ge=0)
    closed_bugs: int | None = Field(default=None, ge=0)
    fixed_bugs: int | None = Field(default=None, ge=0)
    critical_bugs: int | None = Field(default=None, ge=0)

    @field_validator("sprint_name")
    @classmethod
    def validate_sprint_name(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Sprint name is required")

        return value

    @field_validator("remarks")
    @classmethod
    def validate_remarks(cls, value: str | None) -> str | None:
        if value is not None:
            value = value.strip()
            return value or None

        return value
