import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey

from app.core.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False)
    application_id = Column(String(36), ForeignKey("applications.id"), nullable=True)
    type = Column(String(100), nullable=False)
    status = Column(String(50), default="pending_approval")
    subject = Column(String(500), nullable=True)
    message_template = Column(Text, nullable=True)
    message_content = Column(Text, nullable=True)
    recipient_email = Column(String(255), nullable=False)
    approved_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
