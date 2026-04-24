from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class PolicyValidationRequest(BaseModel):
    workflow_step: str
    data: dict
    entity_id: Optional[str] = None


class PolicyValidationResponse(BaseModel):
    is_valid: bool
    errors: List[str] = []
    warnings: List[str] = []
    metadata: dict = {}
