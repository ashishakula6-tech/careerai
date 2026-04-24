import uuid
import json
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class Application(Base):
    __tablename__ = "applications"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False)
    job_id = Column(String(36), ForeignKey("jobs.id"), nullable=False)
    match_score = Column(Float, nullable=True)
    ranking_factors_json = Column(Text, default="{}")
    ai_recommendation = Column(String(50), nullable=True)
    human_decision = Column(String(50), nullable=True)
    bias_score = Column(Float, nullable=True)
    status = Column(String(50), default="new")
    override_reason = Column(Text, nullable=True)
    approved_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    video_filename = Column(String(255), nullable=True)
    video_size = Column(Float, nullable=True)  # bytes
    video_duration = Column(Float, nullable=True)  # seconds
    video_uploaded_at = Column(DateTime, nullable=True)
    has_video = Column(String(10), default="no")  # "yes" or "no"
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    candidate = relationship("Candidate", back_populates="applications")
    job = relationship("Job", back_populates="applications")
    interviews = relationship("Interview", back_populates="application")

    @property
    def ranking_factors(self):
        try:
            return json.loads(self.ranking_factors_json) if self.ranking_factors_json else {}
        except (json.JSONDecodeError, TypeError):
            return {}
