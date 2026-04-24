from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user_token


def get_tenant_session(
    token: dict = Depends(get_current_user_token),
    db: Session = Depends(get_db),
) -> Session:
    """Returns db session. In PostgreSQL this would set RLS context.
    With SQLite, tenant filtering is done at query level."""
    return db
