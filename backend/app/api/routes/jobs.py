import json
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional, List

from app.core.security import get_current_user_token, require_role
from app.middleware.tenant import get_tenant_session
from app.models.job import Job
from app.models.audit_log import AuditLog

router = APIRouter(prefix="/jobs", tags=["Jobs"])


@router.get("")
def list_jobs(
    skip: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    token: dict = Depends(get_current_user_token),
    db: Session = Depends(get_tenant_session),
):
    query = db.query(Job).filter(Job.deleted_at.is_(None), Job.tenant_id == token["tenant_id"])
    if status_filter:
        query = query.filter(Job.status == status_filter)
    total = query.count()
    jobs = query.order_by(Job.created_at.desc()).offset(skip).limit(limit).all()
    return {"items": [_job_dict(j) for j in jobs], "total": total, "skip": skip, "limit": limit}


@router.post("", status_code=201)
def create_job(
    title: str, description: str, skills: List[str] = Query(default=[]),
    experience_min: Optional[int] = None, experience_max: Optional[int] = None,
    education: Optional[str] = None, location: Optional[str] = None,
    remote_allowed: bool = False, work_mode: str = "office",
    salary_min: Optional[float] = None, salary_max: Optional[float] = None,
    token: dict = Depends(require_role("admin", "recruiter")),
    db: Session = Depends(get_tenant_session),
):
    if work_mode not in ("remote", "hybrid", "office"):
        work_mode = "office"
    job = Job(
        tenant_id=token["tenant_id"], title=title, description=description,
        skills=json.dumps(skills), requirements=json.dumps({"skills": skills, "experience_min": experience_min, "experience_max": experience_max, "education": education}),
        experience_min=experience_min, experience_max=experience_max, education=education,
        location=location, remote_allowed=(work_mode in ("remote", "hybrid")), work_mode=work_mode,
        salary_min=salary_min, salary_max=salary_max,
        status="draft", created_by=token["sub"],
    )
    db.add(job)
    db.add(AuditLog(tenant_id=token["tenant_id"], user_id=token["sub"], action="JOB_CREATED", entity_type="job", entity_id=job.id, details_json=json.dumps({"title": title})))
    db.commit()
    db.refresh(job)
    return _job_dict(job)


@router.get("/{job_id}")
def get_job(job_id: str, token: dict = Depends(get_current_user_token), db: Session = Depends(get_tenant_session)):
    job = db.query(Job).filter(Job.id == job_id, Job.deleted_at.is_(None)).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_dict(job)


@router.put("/{job_id}")
def update_job(
    job_id: str, title: Optional[str] = None, description: Optional[str] = None,
    skills: Optional[List[str]] = Query(default=None),
    experience_min: Optional[int] = None, experience_max: Optional[int] = None,
    education: Optional[str] = None, location: Optional[str] = None,
    remote_allowed: Optional[bool] = None, salary_min: Optional[float] = None, salary_max: Optional[float] = None,
    token: dict = Depends(require_role("admin", "recruiter")),
    db: Session = Depends(get_tenant_session),
):
    job = db.query(Job).filter(Job.id == job_id, Job.deleted_at.is_(None)).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if title is not None: job.title = title
    if description is not None: job.description = description
    if skills is not None: job.skills = json.dumps(skills)
    if experience_min is not None: job.experience_min = experience_min
    if experience_max is not None: job.experience_max = experience_max
    if education is not None: job.education = education
    if location is not None: job.location = location
    if remote_allowed is not None: job.remote_allowed = remote_allowed
    if salary_min is not None: job.salary_min = salary_min
    if salary_max is not None: job.salary_max = salary_max
    db.commit()
    db.refresh(job)
    return _job_dict(job)


@router.post("/{job_id}/publish")
def publish_job(job_id: str, token: dict = Depends(require_role("admin", "recruiter")), db: Session = Depends(get_tenant_session)):
    job = db.query(Job).filter(Job.id == job_id, Job.deleted_at.is_(None)).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.status = "active"
    job.published_at = datetime.now(timezone.utc)
    db.add(AuditLog(tenant_id=token["tenant_id"], user_id=token["sub"], action="JOB_PUBLISHED", entity_type="job", entity_id=job.id, details_json=json.dumps({"title": job.title})))
    db.commit()
    db.refresh(job)
    return _job_dict(job)


@router.post("/{job_id}/close")
def close_job(job_id: str, token: dict = Depends(require_role("admin", "recruiter")), db: Session = Depends(get_tenant_session)):
    job = db.query(Job).filter(Job.id == job_id, Job.deleted_at.is_(None)).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.status = "closed"
    job.closed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)
    return _job_dict(job)


@router.delete("/{job_id}")
def delete_job(job_id: str, token: dict = Depends(require_role("admin", "recruiter")), db: Session = Depends(get_tenant_session)):
    job = db.query(Job).filter(Job.id == job_id, Job.deleted_at.is_(None)).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Job deleted"}


def _job_dict(job):
    return {
        "id": job.id, "tenant_id": job.tenant_id, "title": job.title, "description": job.description,
        "requirements": job.requirements_dict, "skills": job.skills_list,
        "experience_min": job.experience_min, "experience_max": job.experience_max,
        "education": job.education, "location": job.location, "remote_allowed": job.remote_allowed,
        "work_mode": getattr(job, 'work_mode', 'office') or 'office',
        "salary_min": job.salary_min, "salary_max": job.salary_max, "status": job.status,
        "created_by": job.created_by,
        "published_at": job.published_at.isoformat() if job.published_at else None,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "updated_at": job.updated_at.isoformat() if job.updated_at else None,
    }
