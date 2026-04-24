import uuid
import json
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    phone_hash = Column(String(255), nullable=True)
    password_hash = Column(String(255), nullable=True)
    first_name = Column(String(255), nullable=False)
    last_name = Column(String(255), nullable=False)
    consent_given = Column(Boolean, default=False)
    status = Column(String(50), default="new")
    source = Column(String(100), default="portal")
    metadata_json = Column(Text, default="{}")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime, nullable=True)

    tenant = relationship("Tenant", back_populates="candidates")
    profiles = relationship("CandidateProfile", back_populates="candidate")
    resumes = relationship("RawResume", back_populates="candidate")
    applications = relationship("Application", back_populates="candidate")
    consents = relationship("Consent", back_populates="candidate")


class RawResume(Base):
    __tablename__ = "raw_resumes"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False)
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)
    file_size = Column(Integer, nullable=True)
    file_hash = Column(String(128), nullable=True)
    file_content = Column(Text, nullable=True)
    uploaded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime, nullable=True)

    candidate = relationship("Candidate", back_populates="resumes")


class CandidateProfile(Base):
    __tablename__ = "candidate_profiles"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    candidate_id = Column(String(36), ForeignKey("candidates.id"), nullable=False)
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False)
    skills = Column(Text, default="[]")  # JSON array
    experience = Column(Text, default="[]")  # JSON array
    education = Column(Text, default="[]")  # JSON array
    summary = Column(Text, nullable=True)
    confidence_scores = Column(Text, default="{}")  # JSON
    embedding_id = Column(String(255), nullable=True)
    parsing_method = Column(String(50), default="llm")
    is_current = Column(Boolean, default=True)
    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    candidate = relationship("Candidate", back_populates="profiles")

    @property
    def skills_list(self):
        try:
            return json.loads(self.skills) if self.skills else []
        except (json.JSONDecodeError, TypeError):
            return []

    @property
    def experience_list(self):
        try:
            return json.loads(self.experience) if self.experience else []
        except (json.JSONDecodeError, TypeError):
            return []

    @property
    def education_list(self):
        try:
            return json.loads(self.education) if self.education else []
        except (json.JSONDecodeError, TypeError):
            return []

    @property
    def confidence_dict(self):
        try:
            return json.loads(self.confidence_scores) if self.confidence_scores else {}
        except (json.JSONDecodeError, TypeError):
            return {}
