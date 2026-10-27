from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship
from app.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=True)
    type = Column(String(50), nullable=False, default="project_assignment")
    is_read = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(DateTime, server_default=func.current_timestamp(), index=True)

    project = relationship("Project", backref="notifications")
    user = relationship("User", backref="notifications")
