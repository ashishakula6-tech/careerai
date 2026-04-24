from fastapi import APIRouter, Depends
from typing import Optional

from app.core.security import get_current_user_token
from app.agents.policy_gate import PolicyGateService

router = APIRouter(prefix="/policy", tags=["Policy Gate"])


@router.post("/validate")
async def validate_policy(workflow_step: str, data: dict, entity_id: Optional[str] = None,
                          token: dict = Depends(get_current_user_token)):
    return await PolicyGateService().validate(workflow_step, data, entity_id)
