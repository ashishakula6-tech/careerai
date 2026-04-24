import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CandidateCreate(BaseModel):
    email: EmailStr
    first_name: str = Field(min_length=1, max_length=255)
    last_name: str = Field(min_length=1, max_length=255)
    phone: Optional[str] = None
    consent_job_application: bool = True
    consent_future_opportunities: bool = False


class CandidateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    tenant_id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    consent_given: bool
    status: str
    source: str = "portal"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CandidateProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    candidate_id: uuid.UUID
    skills: List[str] = []
    experience: list = []
    education: list = []
    summary: Optional[str] = None
    confidence_scores: dict = {}
    parsing_method: str = "llm"
    version: int = 1
    created_at: Optional[datetime] = None
