
from pydantic import BaseModel, Field


class AssignmentCreate(BaseModel):
    tester_id: int = Field(gt=0)
