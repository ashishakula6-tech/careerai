import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    name = Column(String(255), nullable=False)
    domain = Column(String(255), unique=True, nullable=False)
    subscription_tier = Column(String(50), default="standard")
    data_region = Column(String(50), default="us-east-1")
    gdpr_compliant = Column(Boolean, default=False)
    ccpa_compliant = Column(Boolean, default=False)
    settings = Column(Text, default="{}")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime, nullable=True)

    users = relationship("User", back_populates="tenant")
    jobs = relationship("Job", back_populates="tenant")
    candidates = relationship("Candidate", back_populates="tenant")
