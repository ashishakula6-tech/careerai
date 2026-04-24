import json, hashlib
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone

from app.core.security import get_current_user_token, require_role
from app.middleware.tenant import get_tenant_session
from app.models.candidate import Candidate, CandidateProfile, RawResume
from app.models.application import Application
from app.models.job import Job
from app.models.consent import Consent
from app.models.audit_log import AuditLog

router = APIRouter(prefix="/candidates", tags=["Candidates"])


@router.get("")
def list_candidates(
    skip: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    token: dict = Depends(require_role("admin", "recruiter")),
    db: Session = Depends(get_tenant_session),
):
    query = db.query(Candidate).filter(Candidate.deleted_at.is_(None), Candidate.tenant_id == token["tenant_id"])
    if status_filter:
        query = query.filter(Candidate.status == status_filter)
    total = query.count()
    candidates = query.order_by(Candidate.created_at.desc()).offset(skip).limit(limit).all()
    return {"items": [_cand_dict(c) for c in candidates], "total": total, "skip": skip, "limit": limit}


@router.get("/search")
async def ai_search_candidates(
    q: str = Query(..., description="Natural language search query"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    token: dict = Depends(require_role("admin", "recruiter")),
    db: Session = Depends(get_tenant_session),
):
    """AI-powered candidate search. Accepts natural language queries like:
    'Python developers with 5+ years in Bangalore'
    'Shortlisted candidates with React and AWS'
    'Candidates who passed interview for Machine Learning roles'
    """
    from app.agents.candidate_search import CandidateSearchAgent
    from sqlalchemy import or_, func

    agent = CandidateSearchAgent()
    filters = await agent.parse_query(q)

    tid = token["tenant_id"]
    query = db.query(Candidate).filter(Candidate.deleted_at.is_(None), Candidate.tenant_id == tid)

    # Filter by status
    if filters.get("status"):
        query = query.filter(Candidate.status == filters["status"])

    # Filter by skills (search in profiles)
    if filters.get("skills"):
        skill_filters = []
        for skill in filters["skills"]:
            skill_filters.append(func.lower(CandidateProfile.skills).like(f"%{skill.lower()}%"))
        matching_ids = db.query(CandidateProfile.candidate_id).filter(
            CandidateProfile.is_current == True,
            or_(*skill_filters),
        ).all()
        matching_ids = [r[0] for r in matching_ids]
        if matching_ids:
            query = query.filter(Candidate.id.in_(matching_ids))
        # If no skill matches found, don't return empty — still search by other filters

    # Filter by keyword in name/email/profile summary
    keyword = filters.get("keyword", "")
    # Clean up junk keywords (single chars, common words)
    if keyword and len(keyword) > 2 and not all(len(w) <= 2 for w in keyword.split()):
        kw = f"%{keyword.lower()}%"
        # Search in candidate name + profile summary + skills
        name_match = db.query(Candidate.id).filter(
            Candidate.deleted_at.is_(None),
            or_(
                func.lower(Candidate.first_name).like(kw),
                func.lower(Candidate.last_name).like(kw),
                func.lower(Candidate.email).like(kw),
            )
        ).all()
        profile_match = db.query(CandidateProfile.candidate_id).filter(
            or_(
                func.lower(CandidateProfile.skills).like(kw),
                func.lower(CandidateProfile.summary).like(kw),
            )
        ).all()
        all_kw_ids = set(r[0] for r in name_match + profile_match)
        if all_kw_ids:
            query = query.filter(Candidate.id.in_(all_kw_ids))

    total = query.count()
    candidates = query.order_by(Candidate.created_at.desc()).offset(skip).limit(limit).all()

    # Enrich results with profile + application info
    results = []
    for c in candidates:
        profile = db.query(CandidateProfile).filter(
            CandidateProfile.candidate_id == c.id, CandidateProfile.is_current == True
        ).first()

        apps = db.query(Application, Job).join(Job, Application.job_id == Job.id).filter(
            Application.candidate_id == c.id
        ).all()

        # Experience check
        if filters.get("experience_min") and profile:
            total_years = sum(e.get("years", 0) for e in (profile.experience_list or []) if isinstance(e, dict))
            if total_years < filters["experience_min"]:
                continue

        result = {
            **_cand_dict(c),
            "skills": profile.skills_list if profile else [],
            "experience": profile.experience_list if profile else [],
            "education": profile.education_list if profile else [],
            "summary": profile.summary if profile else None,
            "confidence": profile.confidence_dict if profile else {},
            "applications": [
                {
                    "job_title": j.title,
                    "job_location": j.location,
                    "match_score": a.match_score,
                    "status": a.status,
                    "has_video": a.has_video == "yes",
                }
                for a, j in apps
            ],
            "total_applications": len(apps),
            "best_match_score": max((a.match_score or 0 for a, j in apps), default=0),
        }
        results.append(result)

    # Sort by best match score
    results.sort(key=lambda r: r.get("best_match_score", 0), reverse=True)

    return {
        "items": results[:limit],
        "total": len(results),
        "filters_applied": filters,
        "query": q,
    }


@router.post("", status_code=201)
async def create_candidate(
    email: str = Form(...), first_name: str = Form(...), last_name: str = Form(...),
    phone: Optional[str] = Form(None),
    consent_job_application: bool = Form(True),
    resume: Optional[UploadFile] = File(None),
    token: dict = Depends(require_role("admin", "recruiter")),
    db: Session = Depends(get_tenant_session),
):
    tid = token["tenant_id"]
    if db.query(Candidate).filter(Candidate.email == email, Candidate.tenant_id == tid, Candidate.deleted_at.is_(None)).first():
        raise HTTPException(status_code=409, detail="Candidate with this email already exists")

    candidate = Candidate(tenant_id=tid, email=email, first_name=first_name, last_name=last_name,
                          phone_hash=hashlib.sha256(phone.encode()).hexdigest() if phone else None,
                          consent_given=consent_job_application, status="new")
    db.add(candidate)
    db.flush()

    db.add(Consent(candidate_id=candidate.id, tenant_id=tid, purpose="job_application",
                   granted=consent_job_application, granted_at=datetime.now(timezone.utc) if consent_job_application else None))

    if resume:
        content = await resume.read()
        raw = RawResume(candidate_id=candidate.id, tenant_id=tid, file_name=resume.filename,
                        file_type=resume.content_type or "application/octet-stream",
                        file_size=len(content), file_hash=hashlib.sha256(content).hexdigest(),
                        file_content=content.decode("utf-8", errors="replace"))
        db.add(raw)

        from app.agents.resume_parser import ResumeParserAgent
        parser = ResumeParserAgent()
        parsed = await parser.parse_resume(content.decode("utf-8", errors="replace"))

        profile = CandidateProfile(candidate_id=candidate.id, tenant_id=tid,
                                   skills=json.dumps(parsed.get("skills", [])),
                                   experience=json.dumps(parsed.get("experience", [])),
                                   education=json.dumps(parsed.get("education", [])),
                                   summary=parsed.get("summary", ""),
                                   confidence_scores=json.dumps(parsed.get("confidence_scores", {})),
                                   parsing_method=parsed.get("parsing_method", "rule_based"))
        db.add(profile)
        candidate.status = "parsed"

    db.add(AuditLog(tenant_id=tid, user_id=token["sub"], action="CANDIDATE_CREATED", entity_type="candidate",
                    entity_id=candidate.id, details_json=json.dumps({"email": email})))
    db.commit()
    db.refresh(candidate)
    return _cand_dict(candidate)


@router.get("/{candidate_id}")
def get_candidate(candidate_id: str, token: dict = Depends(get_current_user_token), db: Session = Depends(get_tenant_session)):
    """Get full candidate profile with all data a recruiter needs."""
    from app.models.interview import Interview

    c = db.query(Candidate).filter(Candidate.id == candidate_id, Candidate.deleted_at.is_(None)).first()
    if not c: raise HTTPException(status_code=404, detail="Candidate not found")

    # Profile (skills, experience, education)
    profile = db.query(CandidateProfile).filter(
        CandidateProfile.candidate_id == c.id, CandidateProfile.is_current == True
    ).first()

    # All applications with job details
    apps = db.query(Application, Job).join(Job, Application.job_id == Job.id).filter(
        Application.candidate_id == c.id
    ).order_by(Application.created_at.desc()).all()

    # Interviews
    interviews = []
    for app, job in apps:
        interview = db.query(Interview).filter(
            Interview.application_id == app.id
        ).order_by(Interview.created_at.desc()).first()
        if interview:
            interviews.append({
                "id": interview.id,
                "job_title": job.title,
                "status": interview.status,
                "score": interview.overall_score,
                "passed": interview.passed,
                "started_at": interview.started_at.isoformat() if interview.started_at else None,
                "completed_at": interview.completed_at.isoformat() if interview.completed_at else None,
            })

    # Resume info
    resumes = db.query(RawResume).filter(RawResume.candidate_id == c.id).order_by(RawResume.uploaded_at.desc()).all()

    return {
        **_cand_dict(c),
        # Profile
        "skills": profile.skills_list if profile else [],
        "experience": profile.experience_list if profile else [],
        "education": profile.education_list if profile else [],
        "summary": profile.summary if profile else None,
        "confidence_scores": profile.confidence_dict if profile else {},
        "parsing_method": profile.parsing_method if profile else None,
        # Applications
        "applications": [
            {
                "id": app.id,
                "job_title": job.title,
                "job_location": job.location,
                "match_score": app.match_score,
                "ai_recommendation": app.ai_recommendation,
                "human_decision": app.human_decision,
                "status": app.status,
                "has_video": app.has_video == "yes",
                "video_duration": app.video_duration,
                "applied_at": app.created_at.isoformat() if app.created_at else None,
            }
            for app, job in apps
        ],
        "total_applications": len(apps),
        "best_match_score": max((a.match_score or 0 for a, j in apps), default=0),
        # Interviews
        "interviews": interviews,
        # Resumes
        "resumes": [
            {"file_name": r.file_name, "file_type": r.file_type, "file_size": r.file_size,
             "uploaded_at": r.uploaded_at.isoformat() if r.uploaded_at else None}
            for r in resumes
        ],
    }


@router.get("/{candidate_id}/profile")
def get_candidate_profile(candidate_id: str, token: dict = Depends(get_current_user_token), db: Session = Depends(get_tenant_session)):
    p = db.query(CandidateProfile).filter(CandidateProfile.candidate_id == candidate_id, CandidateProfile.is_current == True).first()
    if not p: raise HTTPException(status_code=404, detail="Profile not found")
    return {"id": p.id, "candidate_id": p.candidate_id, "skills": p.skills_list, "experience": p.experience_list,
            "education": p.education_list, "summary": p.summary, "confidence_scores": p.confidence_dict,
            "parsing_method": p.parsing_method, "version": p.version,
            "created_at": p.created_at.isoformat() if p.created_at else None}


@router.get("/{candidate_id}/profile/history")
def get_profile_history(candidate_id: str, token: dict = Depends(get_current_user_token), db: Session = Depends(get_tenant_session)):
    profiles = db.query(CandidateProfile).filter(CandidateProfile.candidate_id == candidate_id).order_by(CandidateProfile.version.desc()).all()
    return [{"id": p.id, "version": p.version, "is_current": p.is_current, "parsing_method": p.parsing_method,
             "confidence_scores": p.confidence_dict, "created_at": p.created_at.isoformat() if p.created_at else None} for p in profiles]


@router.delete("/{candidate_id}")
def delete_candidate(candidate_id: str, token: dict = Depends(require_role("admin")), db: Session = Depends(get_tenant_session)):
    c = db.query(Candidate).filter(Candidate.id == candidate_id, Candidate.deleted_at.is_(None)).first()
    if not c: raise HTTPException(status_code=404, detail="Candidate not found")
    c.email = f"deleted_{c.id}@anonymized.local"
    c.first_name = "DELETED"; c.last_name = "DELETED"; c.phone_hash = None
    c.deleted_at = datetime.now(timezone.utc)
    db.add(AuditLog(tenant_id=token["tenant_id"], user_id=token["sub"], action="CANDIDATE_DELETED_GDPR",
                    entity_type="candidate", entity_id=c.id, details_json=json.dumps({"reason": "GDPR Article 17"}), gdpr_related=True))
    db.commit()
    return {"message": "Candidate data deleted per GDPR Article 17"}


def _cand_dict(c):
    return {"id": c.id, "tenant_id": c.tenant_id, "email": c.email, "first_name": c.first_name, "last_name": c.last_name,
            "consent_given": c.consent_given, "status": c.status, "source": c.source,
            "created_at": c.created_at.isoformat() if c.created_at else None, "updated_at": c.updated_at.isoformat() if c.updated_at else None}
