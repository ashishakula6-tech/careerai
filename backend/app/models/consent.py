import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class Consent(Base):
    __tablename__ = "consents"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False)
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False)
    purpose = Column(String(50), nullable=False)
    granted = Column(Boolean, default=False)
    granted_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    candidate = relationship("Candidate", back_populates="consents")
