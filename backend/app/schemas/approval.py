import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class ApprovalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    tenant_id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    action: str
    status: str
    requested_by: Optional[uuid.UUID] = None
    decided_by: Optional[uuid.UUID] = None
    ai_recommendation: Optional[dict] = None
    decision_reason: Optional[str] = None
    expires_at: Optional[datetime] = None
    decided_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class ApprovalDecision(BaseModel):
    reason: Optional[str] = None
