from uuid import UUID
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog


class AuditService:
    """Service for creating immutable audit log entries."""

    @staticmethod
    async def log(
        db: AsyncSession,
        tenant_id: UUID,
        action: str,
        entity_type: str,
        entity_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
        details: dict = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        gdpr_related: bool = False,
        ccpa_related: bool = False,
    ) -> AuditLog:
        """Create an immutable audit log entry."""
        audit = AuditLog(
            tenant_id=tenant_id,
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details or {},
            ip_address=ip_address,
            user_agent=user_agent,
            gdpr_related=gdpr_related,
            ccpa_related=ccpa_related,
        )
        db.add(audit)
        return audit
