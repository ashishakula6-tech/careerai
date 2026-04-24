import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class ApplicationCreate(BaseModel):
    candidate_id: uuid.UUID
    job_id: uuid.UUID


class ApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    tenant_id: uuid.UUID
    candidate_id: uuid.UUID
    job_id: uuid.UUID
    match_score: Optional[float] = None
    ranking_factors: dict = {}
    ai_recommendation: Optional[str] = None
    human_decision: Optional[str] = None
    bias_score: Optional[float] = None
    status: str = "new"
    override_reason: Optional[str] = None
    approved_by: Optional[uuid.UUID] = None
    approved_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
