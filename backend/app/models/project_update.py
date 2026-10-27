from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text, String, func
from app.database import Base


class ProjectUpdate(Base):
    __tablename__ = "project_updates"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(
        Integer, ForeignKey("project_assignments.id"), nullable=False
    )
    sprint_name = Column(String(100), nullable=True)
    progress = Column(Integer, default=0)
    remarks = Column(Text, nullable=True)
    excel_sheet_url = Column(String(500), nullable=True)
    open_bugs = Column(Integer, default=0, nullable=False)
    need_retest_bugs = Column(Integer, default=0, nullable=False)
    retested_bugs = Column(Integer, default=0, nullable=False)
    closed_bugs = Column(Integer, default=0, nullable=False)
    fixed_bugs = Column(Integer, default=0, nullable=False)
    critical_bugs = Column(Integer, default=0, nullable=False)
    updated_at = Column(
        DateTime,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )