import uuid
import json
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, Float, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class Interview(Base):
    __tablename__ = "interviews"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False)
    application_id = Column(String(36), ForeignKey("applications.id"), nullable=False)
    interviewer_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    interview_type = Column(String(50), default="ai")  # "ai" or "human"
    scheduled_at = Column(DateTime, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, default=60)
    timezone_str = Column(String(100), nullable=True)
    meeting_link = Column(String(512), nullable=True)
    status = Column(String(50), default="pending")  # pending, in_progress, completed, passed, failed
    questions_json = Column(Text, default="[]")  # JSON array of questions
    answers_json = Column(Text, default="[]")  # JSON array of answers
    ai_evaluation_json = Column(Text, nullable=True)  # JSON evaluation result
    overall_score = Column(Float, nullable=True)
    passed = Column(Boolean, nullable=True)
    human_feedback = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    application = relationship("Application", back_populates="interviews")

    @property
    def questions(self):
        try:
            return json.loads(self.questions_json) if self.questions_json else []
        except (json.JSONDecodeError, TypeError):
            return []

    @property
    def answers(self):
        try:
            return json.loads(self.answers_json) if self.answers_json else []
        except (json.JSONDecodeError, TypeError):
            return []

    @property
    def ai_evaluation(self):
        try:
            return json.loads(self.ai_evaluation_json) if self.ai_evaluation_json else None
        except (json.JSONDecodeError, TypeError):
            return None
