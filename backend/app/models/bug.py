
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship
from app.database import Base


class Bug(Base):
    __tablename__ = "bugs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    reported_by = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String(20), default="medium", nullable=False, index=True)
    status = Column(String(30), default="open", nullable=False, index=True)
    category = Column(String(50), default="bug", nullable=False, index=True)  # 'bug' or 'requirement_change'
    sheet_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.current_timestamp(), index=True)
    updated_at = Column(DateTime, server_default=func.current_timestamp(), onupdate=func.current_timestamp(), index=True)

    project = relationship("Project", foreign_keys=[project_id], lazy="joined")
    reporter = relationship("User", foreign_keys=[reported_by], lazy="joined")

    @property
    def project_name(self) -> str | None:
        return self.project.name if self.project else None

    @property
    def reporter_name(self) -> str | None:
        return self.reporter.name if self.reporter else None

    @property
    def reporter_email(self) -> str | None:
        return self.reporter.email if self.reporter else None

