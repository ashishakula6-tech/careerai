from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.security import (
    verify_password, get_password_hash,
    create_access_token, create_refresh_token, decode_token, get_current_user_token,
)
from app.models.user import User
from app.models.tenant import Tenant

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login")
def login(email: str, password: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email, User.is_active == True).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user.last_login = datetime.now(timezone.utc)
    db.commit()

    token_data = {
        "sub": user.id, "email": user.email, "role": user.role,
        "tenant_id": user.tenant_id, "full_name": user.full_name,
    }
    return {
        "access_token": create_access_token(token_data),
        "refresh_token": create_refresh_token(token_data),
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role, "tenant_id": user.tenant_id},
    }


@router.post("/register")
def register(email: str, password: str, full_name: str, company_name: str, domain: str, db: Session = Depends(get_db)):
    if db.query(Tenant).filter(Tenant.domain == domain).first():
        raise HTTPException(status_code=400, detail="Domain already registered")

    tenant = Tenant(name=company_name, domain=domain, gdpr_compliant=True, ccpa_compliant=True)
    db.add(tenant)
    db.flush()

    user = User(tenant_id=tenant.id, email=email, password_hash=get_password_hash(password), full_name=full_name, role="admin")
    db.add(user)
    db.commit()
    db.refresh(user)

    token_data = {"sub": user.id, "email": user.email, "role": user.role, "tenant_id": tenant.id, "full_name": user.full_name}
    return {
        "access_token": create_access_token(token_data),
        "refresh_token": create_refresh_token(token_data),
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role, "tenant_id": tenant.id},
    }


@router.post("/refresh")
def refresh_token(refresh_token: str):
    payload = decode_token(refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    token_data = {k: payload[k] for k in ["sub", "email", "role", "tenant_id", "full_name"]}
    return {"access_token": create_access_token(token_data), "token_type": "bearer"}


@router.get("/me")
def get_current_user(token: dict = Depends(get_current_user_token)):
    return {"id": token["sub"], "email": token["email"], "full_name": token["full_name"], "role": token["role"], "tenant_id": token["tenant_id"]}
