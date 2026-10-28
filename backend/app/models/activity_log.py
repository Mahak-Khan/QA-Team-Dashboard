from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func, Index
from sqlalchemy.orm import relationship
from app.database import Base


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    __table_args__ = (
        Index("ix_activity_user_created", "user_id", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
    action_type = Column(String(50), nullable=False, index=True)  # 'bug_reported', 'bug_status_updated', 'bug_updated', 'progress_submitted', 'session_login'
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.current_timestamp(), index=True)

    user = relationship("User", foreign_keys=[user_id], lazy="joined")
    project = relationship("Project", foreign_keys=[project_id], lazy="joined")

    @property
    def user_name(self) -> str | None:
        return self.user.name if self.user else None

    @property
    def user_email(self) -> str | None:
        return self.user.email if self.user else None

    @property
    def user_role(self) -> str | None:
        return self.user.role if self.user else None

    @property
    def project_name(self) -> str | None:
        return self.project.name if self.project else None
