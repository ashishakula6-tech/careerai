import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone

from app.core.security import require_role
from app.middleware.tenant import get_tenant_session
from app.models.approval import Approval
from app.models.audit_log import AuditLog

router = APIRouter(prefix="/approvals", tags=["Approvals"])


@router.get("")
def list_approvals(skip: int = Query(0), limit: int = Query(20), status_filter: Optional[str] = Query("pending", alias="status"),
                   token: dict = Depends(require_role("admin", "recruiter")), db: Session = Depends(get_tenant_session)):
    query = db.query(Approval).filter(Approval.tenant_id == token["tenant_id"])
    if status_filter: query = query.filter(Approval.status == status_filter)
    total = query.count()
    items = query.order_by(Approval.created_at.desc()).offset(skip).limit(limit).all()
    return {"items": [_dict(a) for a in items], "total": total, "skip": skip, "limit": limit}


@router.get("/{aid}")
def get_approval(aid: str, token: dict = Depends(require_role("admin", "recruiter")), db: Session = Depends(get_tenant_session)):
    a = db.query(Approval).filter(Approval.id == aid).first()
    if not a: raise HTTPException(status_code=404, detail="Approval not found")
    return _dict(a)


@router.post("/{aid}/approve")
def approve_action(aid: str, reason: Optional[str] = None, token: dict = Depends(require_role("admin", "recruiter")), db: Session = Depends(get_tenant_session)):
    a = db.query(Approval).filter(Approval.id == aid, Approval.status == "pending").first()
    if not a: raise HTTPException(status_code=404, detail="Pending approval not found")
    a.status = "approved"; a.decided_by = token["sub"]; a.decided_at = datetime.now(timezone.utc); a.decision_reason = reason
    db.add(AuditLog(tenant_id=a.tenant_id, user_id=token["sub"], action="APPROVAL_APPROVED", entity_type=a.entity_type, entity_id=a.entity_id, details_json=json.dumps({"reason": reason})))
    db.commit(); db.refresh(a)
    return _dict(a)


@router.post("/{aid}/reject")
def reject_action(aid: str, reason: Optional[str] = None, token: dict = Depends(require_role("admin", "recruiter")), db: Session = Depends(get_tenant_session)):
    a = db.query(Approval).filter(Approval.id == aid, Approval.status == "pending").first()
    if not a: raise HTTPException(status_code=404, detail="Pending approval not found")
    a.status = "rejected"; a.decided_by = token["sub"]; a.decided_at = datetime.now(timezone.utc); a.decision_reason = reason
    db.commit(); db.refresh(a)
    return _dict(a)


def _dict(a):
    return {"id": a.id, "tenant_id": a.tenant_id, "entity_type": a.entity_type, "entity_id": a.entity_id,
            "action": a.action, "status": a.status, "requested_by": a.requested_by, "decided_by": a.decided_by,
            "ai_recommendation": a.ai_recommendation, "decision_reason": a.decision_reason,
            "expires_at": a.expires_at.isoformat() if a.expires_at else None,
            "decided_at": a.decided_at.isoformat() if a.decided_at else None,
            "created_at": a.created_at.isoformat() if a.created_at else None}
