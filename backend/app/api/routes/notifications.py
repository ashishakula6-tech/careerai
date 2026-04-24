import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone

from app.core.security import require_role
from app.middleware.tenant import get_tenant_session
from app.models.notification import Notification
from app.models.audit_log import AuditLog

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("")
def list_notifications(skip: int = Query(0), limit: int = Query(20), status_filter: Optional[str] = Query(None, alias="status"),
                       token: dict = Depends(require_role("admin", "recruiter")), db: Session = Depends(get_tenant_session)):
    query = db.query(Notification).filter(Notification.tenant_id == token["tenant_id"])
    if status_filter: query = query.filter(Notification.status == status_filter)
    total = query.count()
    items = query.order_by(Notification.created_at.desc()).offset(skip).limit(limit).all()
    return {"items": [_dict(n) for n in items], "total": total, "skip": skip, "limit": limit}


@router.get("/{nid}")
def get_notification(nid: str, token: dict = Depends(require_role("admin", "recruiter")), db: Session = Depends(get_tenant_session)):
    n = db.query(Notification).filter(Notification.id == nid).first()
    if not n: raise HTTPException(status_code=404, detail="Not found")
    return _dict(n)


@router.put("/{nid}")
def edit_notification(nid: str, subject: Optional[str] = None, message_content: Optional[str] = None,
                      token: dict = Depends(require_role("admin", "recruiter")), db: Session = Depends(get_tenant_session)):
    n = db.query(Notification).filter(Notification.id == nid, Notification.status == "pending_approval").first()
    if not n: raise HTTPException(status_code=404, detail="Editable notification not found")
    if subject is not None: n.subject = subject
    if message_content is not None: n.message_content = message_content
    db.commit(); db.refresh(n)
    return _dict(n)


@router.post("/{nid}/approve")
def approve_and_send(nid: str, token: dict = Depends(require_role("admin", "recruiter")), db: Session = Depends(get_tenant_session)):
    n = db.query(Notification).filter(Notification.id == nid, Notification.status == "pending_approval").first()
    if not n: raise HTTPException(status_code=404, detail="Pending notification not found")
    n.status = "sent"; n.approved_by = token["sub"]; n.approved_at = datetime.now(timezone.utc); n.sent_at = datetime.now(timezone.utc)
    db.add(AuditLog(tenant_id=n.tenant_id, user_id=token["sub"], action="NOTIFICATION_SENT", entity_type="notification",
                    entity_id=nid, details_json=json.dumps({"recipient": n.recipient_email, "subject": n.subject})))
    db.commit(); db.refresh(n)
    return _dict(n)


def _dict(n):
    return {"id": n.id, "tenant_id": n.tenant_id, "candidate_id": n.candidate_id, "application_id": n.application_id,
            "type": n.type, "status": n.status, "subject": n.subject, "message_content": n.message_content,
            "recipient_email": n.recipient_email, "approved_by": n.approved_by,
            "approved_at": n.approved_at.isoformat() if n.approved_at else None,
            "sent_at": n.sent_at.isoformat() if n.sent_at else None,
            "created_at": n.created_at.isoformat() if n.created_at else None}
