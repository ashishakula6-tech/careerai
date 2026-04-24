import uuid
import json
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey

from app.core.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False)
    user_id = Column(String(36), nullable=True)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(100), nullable=False)
    entity_id = Column(String(36), nullable=True)
    details_json = Column(Text, default="{}")
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    gdpr_related = Column(Boolean, default=False)
    ccpa_related = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    @property
    def details(self):
        try:
            return json.loads(self.details_json) if self.details_json else {}
        except (json.JSONDecodeError, TypeError):
            return {}
