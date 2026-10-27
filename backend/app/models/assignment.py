from sqlalchemy import Column, DateTime, ForeignKey, Integer, func
from app.database import Base


class ProjectAssignment(Base):
    __tablename__ = "project_assignments"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(
        Integer, ForeignKey("projects.id"), nullable=False
    )
    tester_id = Column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    assigned_at = Column(
        DateTime, server_default=func.current_timestamp()
    )