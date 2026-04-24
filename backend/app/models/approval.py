import uuid
import json
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, Text, DateTime, ForeignKey

from app.core.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class Approval(Base):
    __tablename__ = "approvals"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False)
    entity_type = Column(String(100), nullable=False)
    entity_id = Column(String(36), nullable=False)
    action = Column(String(100), nullable=False)
    status = Column(String(50), default="pending")
    requested_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    decided_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    ai_recommendation_json = Column(Text, nullable=True)
    decision_reason = Column(Text, nullable=True)
    expires_at = Column(DateTime, default=lambda: datetime.now(timezone.utc) + timedelta(days=7))
    decided_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    @property
    def ai_recommendation(self):
        try:
            return json.loads(self.ai_recommendation_json) if self.ai_recommendation_json else None
        except (json.JSONDecodeError, TypeError):
            return None
