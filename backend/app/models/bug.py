
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func
from app.database import Base


class Bug(Base):
    __tablename__ = "bugs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    reported_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String(20), default="medium", nullable=False)
    status = Column(String(20), default="open", nullable=False)
    created_at = Column(DateTime, server_default=func.current_timestamp())
