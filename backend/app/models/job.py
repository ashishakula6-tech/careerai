import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    requirements = Column(Text, default="{}")  # JSON as text
    skills = Column(Text, default="[]")  # JSON array as text
    experience_min = Column(Integer, nullable=True)
    experience_max = Column(Integer, nullable=True)
    education = Column(String(255), nullable=True)
    location = Column(String(255), nullable=True)
    remote_allowed = Column(Boolean, default=False)
    work_mode = Column(String(20), default="office")  # "remote", "hybrid", "office"
    salary_min = Column(Float, nullable=True)
    salary_max = Column(Float, nullable=True)
    status = Column(String(50), default="draft")  # draft, active, closed, expired
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    published_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)  # auto-expire date
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime, nullable=True)

    tenant = relationship("Tenant", back_populates="jobs")
    creator = relationship("User", back_populates="created_jobs")
    applications = relationship("Application", back_populates="job")

    @property
    def skills_list(self):
        import json
        try:
            return json.loads(self.skills) if self.skills else []
        except (json.JSONDecodeError, TypeError):
            return []

    @skills_list.setter
    def skills_list(self, value):
        import json
        self.skills = json.dumps(value)

    @property
    def requirements_dict(self):
        import json
        try:
            return json.loads(self.requirements) if self.requirements else {}
        except (json.JSONDecodeError, TypeError):
            return {}
