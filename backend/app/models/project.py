from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text
from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), default="active")
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Cloud Excel / Google Sheets live tracking & manual bug metrics
    excel_sheet_url = Column(String(500), nullable=True)
    total_bugs = Column(Integer, default=0, nullable=False)
    open_bugs = Column(Integer, default=0, nullable=False)
    need_retest_bugs = Column(Integer, default=0, nullable=False)
    retested_bugs = Column(Integer, default=0, nullable=False)
    closed_bugs = Column(Integer, default=0, nullable=False)
    fixed_bugs = Column(Integer, default=0, nullable=False)  # alias / backward compatibility
    critical_bugs = Column(Integer, default=0, nullable=False)
    last_sheet_sync = Column(DateTime, nullable=True)
