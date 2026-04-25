import json, hashlib
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone

from app.core.database import get_db
from app.models.candidate import Candidate, CandidateProfile, RawResume
from app.models.application import Application
from app.models.job import Job
from app.models.consent import Consent
from app.models.interview import Interview
from app.models.audit_log import AuditLog

router = APIRouter(prefix="/portal", tags=["Candidate Portal"])


def _get_default_tenant(db):
    from app.models.tenant import Tenant
    t = db.query(Tenant).first()
    return t.id if t else None


# ==================== CANDIDATE AUTH ====================

@router.post("/candidate/register")
def candidate_register(
    email: str,
    password: str,
    first_name: str,
    last_name: str,
    phone: str,
    db: Session = Depends(get_db),
):
    from app.core.security import get_password_hash, create_access_token
    if not phone.strip():
        raise HTTPException(status_code=400, detail="Phone number is required")
    tid = _get_default_tenant(db)
    if not tid:
        raise HTTPException(status_code=500, detail="No tenant configured")

    existing = db.query(Candidate).filter(
        Candidate.email == email, Candidate.tenant_id == tid, Candidate.deleted_at.is_(None)
    ).first()

    if existing:
        if existing.password_hash:
            raise HTTPException(status_code=400, detail="Email already registered. Please sign in instead.")
        # Attach password to existing unregistered candidate
        existing.password_hash = get_password_hash(password)
        existing.phone = phone
        db.commit()
        token_data = {"sub": existing.id, "email": existing.email, "role": "candidate",
                      "name": f"{existing.first_name} {existing.last_name}"}
        return {"access_token": create_access_token(token_data), "token_type": "bearer",
                "candidate": {"id": existing.id, "email": existing.email,
                              "name": f"{existing.first_name} {existing.last_name}"}}

    candidate = Candidate(
        tenant_id=tid, email=email, first_name=first_name, last_name=last_name,
        phone=phone, phone_hash=hashlib.sha256(phone.encode()).hexdigest(),
        password_hash=get_password_hash(password), consent_given=True, source="portal",
    )
    db.add(candidate)
    db.flush()
    db.add(Consent(candidate_id=candidate.id, tenant_id=tid, purpose="job_application",
                   granted=True, granted_at=datetime.now(timezone.utc)))
    db.commit()

    token_data = {"sub": candidate.id, "email": email, "role": "candidate",
                  "name": f"{first_name} {last_name}"}
    return {"access_token": create_access_token(token_data), "token_type": "bearer",
            "candidate": {"id": candidate.id, "email": email, "name": f"{first_name} {last_name}"}}


@router.post("/candidate/login")
def candidate_login(email: str, password: str, db: Session = Depends(get_db)):
    from app.core.security import verify_password, create_access_token
    tid = _get_default_tenant(db)

    candidate = db.query(Candidate).filter(
        Candidate.email == email, Candidate.tenant_id == tid, Candidate.deleted_at.is_(None)
    ).first()

    if not candidate:
        raise HTTPException(status_code=401, detail="Email not found. Please register first.")
    if not candidate.password_hash:
        raise HTTPException(status_code=401, detail="No password set. Please register with a password first.")
    if not verify_password(password, candidate.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect password.")

    token_data = {"sub": candidate.id, "email": candidate.email, "role": "candidate",
                  "name": f"{candidate.first_name} {candidate.last_name}"}
    return {"access_token": create_access_token(token_data), "token_type": "bearer",
            "candidate": {"id": candidate.id, "email": email,
                          "name": f"{candidate.first_name} {candidate.last_name}"}}


@router.get("/candidate/me")
def get_candidate_profile(email: str = Query(...), db: Session = Depends(get_db)):
    """Return the candidate's current profile so the frontend can show skills after login."""
    tid = _get_default_tenant(db)
    candidate = db.query(Candidate).filter(
        Candidate.email == email, Candidate.tenant_id == tid, Candidate.deleted_at.is_(None)
    ).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    profile = db.query(CandidateProfile).filter(
        CandidateProfile.candidate_id == candidate.id,
        CandidateProfile.is_current == True,
    ).first()

    if not profile:
        return {"profile": None}

    try:
        meta = json.loads(candidate.metadata_json or "{}")
    except Exception:
        meta = {}

    return {
        "profile": {
            "id": candidate.id,
            "name": f"{candidate.first_name} {candidate.last_name}",
            "email": candidate.email,
            "phone": candidate.phone or "",
            "skills": profile.skills_list,
            "experience": profile.experience_list,
            "education": profile.education_list,
            "summary": profile.summary or "",
            "parsing_method": profile.parsing_method or "rule_based",
            "projects": meta.get("projects", []),
            "certifications": meta.get("certifications", []),
            "awards": meta.get("awards", []),
            "publications": meta.get("publications", []),
            "languages": meta.get("languages", []),
            "additional_work": meta.get("additional_work", []),
            "interests": meta.get("interests", []),
            "skills_breakdown": meta.get("skills_breakdown", {}),
        }
    }


@router.get("/candidate/matches")
async def get_candidate_matches(email: str = Query(...), db: Session = Depends(get_db)):
    """Re-run job matching for an existing candidate profile. Called when candidate clicks their name to go to the portal."""
    tid = _get_default_tenant(db)
    candidate = db.query(Candidate).filter(
        Candidate.email == email, Candidate.tenant_id == tid, Candidate.deleted_at.is_(None)
    ).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    profile = db.query(CandidateProfile).filter(
        CandidateProfile.candidate_id == candidate.id,
        CandidateProfile.is_current == True,
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="No profile found. Please upload your resume first.")

    candidate_skills = profile.skills_list
    candidate_experience = profile.experience_list
    candidate_education = profile.education_list
    location = None
    for exp in candidate_experience:
        if isinstance(exp, dict) and exp.get("location"):
            location = exp["location"]
            break

    total_active = db.query(Job).filter(Job.tenant_id == tid, Job.status == "active", Job.deleted_at.is_(None)).count()

    from app.agents.matching_agent import MatchingAgent
    from sqlalchemy import or_, func
    matcher = MatchingAgent()

    base_query = db.query(Job).filter(Job.tenant_id == tid, Job.status == "active", Job.deleted_at.is_(None))
    if candidate_skills:
        skill_filters = [func.lower(Job.skills).like(f"%{s.lower()}%") for s in candidate_skills[:10]]
        active_jobs = base_query.filter(or_(*skill_filters)).limit(200).all()
        other_jobs = base_query.filter(~Job.id.in_([j.id for j in active_jobs])).order_by(func.random()).limit(20).all()
        active_jobs = active_jobs + other_jobs
    else:
        active_jobs = base_query.limit(100).all()

    applied_job_ids = {a.job_id for a in db.query(Application).filter(Application.candidate_id == candidate.id).all()}

    candidate_data = {"skills": candidate_skills, "experience": candidate_experience,
                      "education": candidate_education, "location": location}

    matched_jobs = []
    for job in active_jobs:
        job_data = {"skills": job.skills_list, "experience_min": job.experience_min,
                    "experience_max": job.experience_max, "education": job.education,
                    "location": job.location, "remote_allowed": job.remote_allowed}
        result = await matcher.match_candidate_to_job(candidate_data, job_data)
        matched_jobs.append({
            "id": job.id, "title": job.title, "description": job.description,
            "skills": job.skills_list, "experience_min": job.experience_min,
            "experience_max": job.experience_max, "education": job.education,
            "location": job.location, "remote_allowed": job.remote_allowed,
            "work_mode": getattr(job, 'work_mode', 'office') or 'office',
            "salary_min": job.salary_min, "salary_max": job.salary_max,
            "published_at": job.published_at.isoformat() if job.published_at else None,
            "match_score": result["match_score"], "ranking_factors": result["ranking_factors"],
            "ai_recommendation": result["ai_recommendation"],
            "already_applied": job.id in applied_job_ids,
            "matching_skills": sorted(set(s.lower() for s in candidate_skills) & set(s.lower() for s in job.skills_list)),
            "missing_skills": sorted(set(s.lower() for s in job.skills_list) - set(s.lower() for s in candidate_skills)),
        })

    matched_jobs.sort(key=lambda j: j["match_score"], reverse=True)

    return {
        "profile": {
            "id": candidate.id,
            "name": f"{candidate.first_name} {candidate.last_name}",
            "email": candidate.email,
            "skills": candidate_skills,
            "experience": candidate_experience,
            "education": candidate_education,
            "summary": profile.summary or "",
        },
        "matched_jobs": matched_jobs[:50],
        "total_matched": len(matched_jobs),
        "total_jobs": total_active,
        "total_matches": len([j for j in matched_jobs if j["match_score"] >= 0.4]),
    }


@router.get("/jobs")
def list_public_jobs(
    q: Optional[str] = Query(None, description="Search query - matches title, description, skills, location"),
    location: Optional[str] = Query(None, description="Filter by location"),
    remote: Optional[bool] = Query(None, description="Filter remote-only jobs"),
    work_mode: Optional[str] = Query(None, description="Filter by work mode: remote, hybrid, office"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Public endpoint - search and browse active jobs. Auto-refreshes on every visit."""
    # Refresh: expire old jobs + add new ones
    from app.services.job_generator import refresh_jobs
    try:
        refresh_jobs()
    except Exception:
        pass

    tid = _get_default_tenant(db)
    if not tid:
        return {"jobs": [], "total": 0}

    query = db.query(Job).filter(Job.tenant_id == tid, Job.status == "active", Job.deleted_at.is_(None))

    from sqlalchemy import or_, func

    if q:
        search = f"%{q.lower()}%"
        query = query.filter(
            or_(
                func.lower(Job.title).like(search),
                func.lower(Job.description).like(search),
                func.lower(Job.skills).like(search),
                func.lower(Job.location).like(search),
                func.lower(Job.education).like(search),
            )
        )

    if location:
        query = query.filter(func.lower(Job.location).like(f"%{location.lower()}%"))

    if remote is True:
        query = query.filter(Job.remote_allowed == True)

    if work_mode and work_mode in ("remote", "hybrid", "office"):
        query = query.filter(Job.work_mode == work_mode)

    total = query.count()
    jobs = query.order_by(Job.published_at.desc()).offset(skip).limit(limit).all()

    # Collect unique locations for filter suggestions
    all_locations = db.query(Job.location).filter(
        Job.tenant_id == tid, Job.status == "active", Job.deleted_at.is_(None), Job.location.isnot(None)
    ).distinct().all()
    locations = sorted(set(loc[0] for loc in all_locations if loc[0]))

    return {
        "jobs": [
            {
                "id": j.id,
                "title": j.title,
                "description": j.description,
                "skills": j.skills_list,
                "experience_min": j.experience_min,
                "experience_max": j.experience_max,
                "education": j.education,
                "location": j.location,
                "remote_allowed": j.remote_allowed,
                "work_mode": getattr(j, 'work_mode', 'office') or 'office',
                "salary_min": j.salary_min,
                "salary_max": j.salary_max,
                "published_at": j.published_at.isoformat() if j.published_at else None,
                "expires_at": j.expires_at.isoformat() if getattr(j, 'expires_at', None) else None,
                "is_expired": j.status == "expired",
            }
            for j in jobs
        ],
        "total": total,
        "locations": locations,
        "expired_count": db.query(Job).filter(Job.tenant_id == tid, Job.status == "expired").count(),
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/manual-profile")
async def manual_profile_and_match(
    data: dict,
    db: Session = Depends(get_db),
):
    """Candidate fills profile manually (no resume). Match against jobs."""
    tid = _get_default_tenant(db)
    if not tid:
        raise HTTPException(status_code=500, detail="No tenant configured")

    email = data.get("email", "").strip()
    first_name = data.get("first_name", "").strip()
    last_name = data.get("last_name", "").strip()
    phone = data.get("phone", "").strip()
    if not email or not first_name:
        raise HTTPException(status_code=400, detail="Email and first name are required")
    if not phone:
        raise HTTPException(status_code=400, detail="Phone number is required")

    candidate_skills = data.get("skills", [])
    experience_years = data.get("experience_years", 0)
    experience_details = data.get("experience_details", "")
    is_fresher = data.get("is_fresher", False)
    location = data.get("location", "")
    summary = data.get("summary", "")
    job_title = data.get("job_title", "")

    # Experience
    if is_fresher:
        candidate_experience = [{"company": "Fresher", "role": job_title or "Entry Level",
                                 "years": 0, "description": "Fresher — looking for first opportunity"}]
    elif experience_years:
        candidate_experience = [{"company": "Not specified", "role": job_title or "Not specified",
                                 "years": experience_years, "description": experience_details}]
    else:
        candidate_experience = []

    # Education — supports multiple entries
    education_list = data.get("education_list", [])
    candidate_education = []
    for edu in education_list:
        if edu.get("degree"):
            candidate_education.append({
                "degree": edu.get("degree", ""),
                "field": edu.get("field", ""),
                "university": edu.get("university", ""),
                "year": edu.get("year", ""),
            })
    # Fallback for old single-education format
    if not candidate_education:
        edu_degree = data.get("education_degree", "")
        if edu_degree:
            candidate_education = [{"degree": edu_degree, "field": data.get("education_field", ""),
                                    "university": data.get("education_university", "")}]

    if not summary:
        summary = f"{first_name} {last_name}"
        if job_title:
            summary += f" — {job_title}"
        if is_fresher:
            summary += ". Fresher looking for first opportunity"
        if candidate_skills:
            summary += f". Skills: {', '.join(candidate_skills[:5])}"
        if experience_years and not is_fresher:
            summary += f". {experience_years} years experience"
        if candidate_education:
            summary += f". Education: {candidate_education[0].get('degree', '')}"
        summary += "."

    # Create or update candidate
    candidate = db.query(Candidate).filter(
        Candidate.email == email, Candidate.tenant_id == tid, Candidate.deleted_at.is_(None)
    ).first()

    if not candidate:
        candidate = Candidate(
            tenant_id=tid, email=email, first_name=first_name, last_name=last_name,
            phone=phone, phone_hash=hashlib.sha256(phone.encode()).hexdigest(),
            consent_given=True, source="portal-manual",
        )
        db.add(candidate)
        db.flush()
        db.add(Consent(
            candidate_id=candidate.id, tenant_id=tid, purpose="job_application",
            granted=True, granted_at=datetime.now(timezone.utc),
        ))

    # Save profile
    old_profile = db.query(CandidateProfile).filter(
        CandidateProfile.candidate_id == candidate.id, CandidateProfile.is_current == True
    ).first()
    if old_profile:
        old_profile.is_current = False

    profile = CandidateProfile(
        candidate_id=candidate.id, tenant_id=tid,
        skills=json.dumps(candidate_skills),
        experience=json.dumps(candidate_experience),
        education=json.dumps(candidate_education),
        summary=summary,
        confidence_scores=json.dumps({"skills": 1.0, "experience": 1.0, "education": 1.0}),
        parsing_method="manual",
        is_current=True,
        version=(old_profile.version + 1) if old_profile else 1,
    )
    db.add(profile)
    candidate.status = "parsed"

    db.add(AuditLog(
        tenant_id=tid, action="MANUAL_PROFILE_CREATED", entity_type="candidate",
        entity_id=candidate.id,
        details_json=json.dumps({"email": email, "skills": candidate_skills, "method": "manual"}),
    ))
    db.commit()
    db.refresh(candidate)

    total_active = db.query(Job).filter(Job.tenant_id == tid, Job.status == "active", Job.deleted_at.is_(None)).count()

    # Match against jobs
    from app.agents.matching_agent import MatchingAgent
    from sqlalchemy import or_, func
    matcher = MatchingAgent()

    base_query = db.query(Job).filter(Job.tenant_id == tid, Job.status == "active", Job.deleted_at.is_(None))
    if candidate_skills:
        skill_filters = [func.lower(Job.skills).like(f"%{s.lower()}%") for s in candidate_skills[:10]]
        active_jobs = base_query.filter(or_(*skill_filters)).limit(200).all()
        other_jobs = base_query.filter(~Job.id.in_([j.id for j in active_jobs])).order_by(func.random()).limit(20).all()
        active_jobs = active_jobs + other_jobs
    else:
        active_jobs = base_query.limit(100).all()

    applied_job_ids = set()
    existing_apps = db.query(Application).filter(Application.candidate_id == candidate.id).all()
    for a in existing_apps:
        applied_job_ids.add(a.job_id)

    candidate_data = {"skills": candidate_skills, "experience": candidate_experience,
                      "education": candidate_education, "location": location or None}

    matched_jobs = []
    for job in active_jobs:
        job_data = {"skills": job.skills_list, "experience_min": job.experience_min,
                    "experience_max": job.experience_max, "education": job.education,
                    "location": job.location, "remote_allowed": job.remote_allowed}
        result = await matcher.match_candidate_to_job(candidate_data, job_data)
        matched_jobs.append({
            "id": job.id, "title": job.title, "description": job.description,
            "skills": job.skills_list, "experience_min": job.experience_min,
            "experience_max": job.experience_max, "education": job.education,
            "location": job.location, "remote_allowed": job.remote_allowed,
            "salary_min": job.salary_min, "salary_max": job.salary_max,
            "published_at": job.published_at.isoformat() if job.published_at else None,
            "match_score": result["match_score"], "ranking_factors": result["ranking_factors"],
            "ai_recommendation": result["ai_recommendation"],
            "already_applied": job.id in applied_job_ids,
            "matching_skills": sorted(set(s.lower() for s in candidate_skills) & set(s.lower() for s in job.skills_list)),
            "missing_skills": sorted(set(s.lower() for s in job.skills_list) - set(s.lower() for s in candidate_skills)),
        })

    matched_jobs.sort(key=lambda j: j["match_score"], reverse=True)

    # Send welcome email
    from app.services.email_service import EmailService
    EmailService.send_welcome(
        to_email=email, candidate_name=f"{first_name} {last_name}",
        skills_count=len(candidate_skills), matches_count=len(matched_jobs),
        total_jobs=total_active,
    )

    return {
        "candidate_id": candidate.id,
        "profile": {
            "name": f"{first_name} {last_name}", "email": email,
            "skills": candidate_skills, "experience": candidate_experience,
            "education": candidate_education, "summary": summary, "confidence": 1.0,
        },
        "matched_jobs": matched_jobs[:50],
        "total_matched": len(matched_jobs),
        "total_jobs": total_active,
        "total_matches": len([j for j in matched_jobs if j["match_score"] >= 0.4]),
    }


@router.post("/upload-resume")
async def upload_resume_and_match(
    email: str = Form(...),
    first_name: str = Form(...),
    last_name: str = Form(...),
    phone: str = Form(...),
    consent_job_application: bool = Form(True),
    resume: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Step 1 of the candidate flow:
    Upload resume → AI parses it → match against ALL active jobs → return ranked suggestions.
    Candidate profile is created/updated but no application is created yet.
    """
    tid = _get_default_tenant(db)
    if not tid:
        raise HTTPException(status_code=500, detail="No tenant configured")

    content = await resume.read()

    # Extract text from ANY file format (PDF, DOCX, images, RTF, etc.)
    from app.services.file_extractor import extract_text
    text = extract_text(content, filename=resume.filename or "", content_type=resume.content_type or "")

    # Parse resume
    from app.agents.resume_parser import ResumeParserAgent
    parsed = await ResumeParserAgent().parse_resume(text)

    candidate_skills = parsed.get("skills", [])
    candidate_experience = parsed.get("experience", [])
    candidate_education = parsed.get("education", [])

    # Create or update candidate
    candidate = db.query(Candidate).filter(
        Candidate.email == email, Candidate.tenant_id == tid, Candidate.deleted_at.is_(None)
    ).first()

    if not candidate:
        candidate = Candidate(
            tenant_id=tid, email=email, first_name=first_name, last_name=last_name,
            phone_hash=hashlib.sha256(phone.encode()).hexdigest() if phone else None,
            consent_given=consent_job_application, source="portal",
        )
        db.add(candidate)
        db.flush()
        db.add(Consent(
            candidate_id=candidate.id, tenant_id=tid, purpose="job_application",
            granted=consent_job_application, granted_at=datetime.now(timezone.utc),
        ))

    # Store resume
    db.add(RawResume(
        candidate_id=candidate.id, tenant_id=tid, file_name=resume.filename,
        file_type=resume.content_type or "application/octet-stream", file_size=len(content),
        file_hash=hashlib.sha256(content).hexdigest(), file_content=text,
    ))

    # Save/update profile
    old_profile = db.query(CandidateProfile).filter(
        CandidateProfile.candidate_id == candidate.id, CandidateProfile.is_current == True
    ).first()
    if old_profile:
        old_profile.is_current = False

    # Enrich metadata with all fields extracted by the Intelligence Engine
    enriched_meta = {
        "personal_info":        parsed.get("personal_info", {}),
        "projects":             parsed.get("projects", []),
        "certifications":       parsed.get("certifications", []),
        "awards":               parsed.get("awards", []),
        "publications":         parsed.get("publications", []),
        "languages":            parsed.get("languages", []),
        "additional_work":      parsed.get("additional_work", []),
        "interests":            parsed.get("interests", []),
        "skills_breakdown":     parsed.get("skills_breakdown", {}),
        "text_quality":         parsed.get("text_quality", 1.0),
        "validation_warnings":  parsed.get("validation_warnings", []),
    }

    profile = CandidateProfile(
        candidate_id=candidate.id, tenant_id=tid,
        skills=json.dumps(candidate_skills),
        experience=json.dumps(candidate_experience),
        education=json.dumps(candidate_education),
        summary=parsed.get("summary", ""),
        confidence_scores=json.dumps(parsed.get("confidence_scores", {})),
        parsing_method=parsed.get("parsing_method", "rule_based"),
        is_current=True,
        version=(old_profile.version + 1) if old_profile else 1,
    )
    db.add(profile)
    candidate.status = "parsed"
    candidate.metadata_json = json.dumps(enriched_meta)

    db.add(AuditLog(
        tenant_id=tid, action="RESUME_UPLOADED_PORTAL", entity_type="candidate",
        entity_id=candidate.id,
        details_json=json.dumps({
            "email": email,
            "skills_found": len(candidate_skills),
            "parsing_method": parsed.get("parsing_method", "rule_based"),
            "text_quality": parsed.get("text_quality", 1.0),
            "validation_warnings": parsed.get("validation_warnings", []),
        }),
    ))
    db.commit()
    db.refresh(candidate)

    # Send welcome email on first upload
    total_active = db.query(Job).filter(Job.tenant_id == tid, Job.status == "active").count()

    # ===== MATCH against active jobs (optimized: pre-filter by skills in SQL) =====
    from app.agents.matching_agent import MatchingAgent
    from sqlalchemy import or_, func
    matcher = MatchingAgent()

    # Pre-filter: only fetch jobs that mention at least one of the candidate's skills
    # This avoids loading ALL jobs when there are thousands
    base_query = db.query(Job).filter(Job.tenant_id == tid, Job.status == "active", Job.deleted_at.is_(None))
    if candidate_skills:
        skill_filters = [func.lower(Job.skills).like(f"%{s.lower()}%") for s in candidate_skills[:10]]
        active_jobs = base_query.filter(or_(*skill_filters)).limit(200).all()
        # Also get a few random ones for variety
        other_jobs = base_query.filter(~Job.id.in_([j.id for j in active_jobs])).order_by(func.random()).limit(20).all()
        active_jobs = active_jobs + other_jobs
    else:
        active_jobs = base_query.limit(100).all()

    # Already applied jobs
    applied_job_ids = set()
    existing_apps = db.query(Application).filter(Application.candidate_id == candidate.id).all()
    for a in existing_apps:
        applied_job_ids.add(a.job_id)

    candidate_data = {
        "skills": candidate_skills,
        "experience": candidate_experience,
        "education": candidate_education,
        "location": None,
    }

    matched_jobs = []
    for job in active_jobs:
        job_data = {
            "skills": job.skills_list,
            "experience_min": job.experience_min,
            "experience_max": job.experience_max,
            "education": job.education,
            "location": job.location,
            "remote_allowed": job.remote_allowed,
        }
        result = await matcher.match_candidate_to_job(candidate_data, job_data)

        matched_jobs.append({
            "id": job.id,
            "title": job.title,
            "description": job.description,
            "skills": job.skills_list,
            "experience_min": job.experience_min,
            "experience_max": job.experience_max,
            "education": job.education,
            "location": job.location,
            "remote_allowed": job.remote_allowed,
            "salary_min": job.salary_min,
            "salary_max": job.salary_max,
            "published_at": job.published_at.isoformat() if job.published_at else None,
            "match_score": result["match_score"],
            "ranking_factors": result["ranking_factors"],
            "ai_recommendation": result["ai_recommendation"],
            "already_applied": job.id in applied_job_ids,
            "matching_skills": sorted(set(s.lower() for s in candidate_skills) & set(s.lower() for s in job.skills_list)),
            "missing_skills": sorted(set(s.lower() for s in job.skills_list) - set(s.lower() for s in candidate_skills)),
        })

    # Sort by match score descending
    matched_jobs.sort(key=lambda j: j["match_score"], reverse=True)

    # Send welcome email
    from app.services.email_service import EmailService
    EmailService.send_welcome(
        to_email=email, candidate_name=f"{first_name} {last_name}",
        skills_count=len(candidate_skills), matches_count=len(matched_jobs),
        total_jobs=total_active,
    )

    return {
        "candidate_id": candidate.id,
        "profile": {
            "name": f"{first_name} {last_name}",
            "email": email,
            "skills": candidate_skills,
            "experience": candidate_experience,
            "education": candidate_education,
            "summary": parsed.get("summary", ""),
            "confidence": parsed.get("overall_confidence", 0),
        },
        "matched_jobs": matched_jobs[:50],
        "total_matched": len(matched_jobs),
        "total_jobs": total_active,
        "total_matches": len([j for j in matched_jobs if j["match_score"] >= 0.4]),
    }


@router.post("/apply", status_code=201)
async def submit_application(
    job_id: str = Form(...), email: str = Form(...), first_name: str = Form(...), last_name: str = Form(...),
    phone: Optional[str] = Form(None), consent_job_application: bool = Form(...), resume: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    tid = _get_default_tenant(db)
    if not tid: raise HTTPException(status_code=500, detail="No tenant configured")
    if not consent_job_application: raise HTTPException(status_code=400, detail="Consent is required")

    candidate = db.query(Candidate).filter(Candidate.email == email, Candidate.tenant_id == tid, Candidate.deleted_at.is_(None)).first()
    if not candidate:
        candidate = Candidate(tenant_id=tid, email=email, first_name=first_name, last_name=last_name,
                              phone_hash=hashlib.sha256(phone.encode()).hexdigest() if phone else None, consent_given=True, source="portal")
        db.add(candidate); db.flush()
        db.add(Consent(candidate_id=candidate.id, tenant_id=tid, purpose="job_application", granted=True, granted_at=datetime.now(timezone.utc)))

    job = db.query(Job).filter(Job.id == job_id, Job.tenant_id == tid, Job.status == "active").first()
    if not job: raise HTTPException(status_code=404, detail="Job not found or not accepting applications")
    if db.query(Application).filter(Application.candidate_id == candidate.id, Application.job_id == job_id).first():
        raise HTTPException(status_code=409, detail="Already applied")

    content = await resume.read()

    # Extract text from any format
    from app.services.file_extractor import extract_text as extract_file_text
    resume_text = extract_file_text(content, filename=resume.filename or "", content_type=resume.content_type or "")

    db.add(RawResume(candidate_id=candidate.id, tenant_id=tid, file_name=resume.filename,
                     file_type=resume.content_type or "application/octet-stream", file_size=len(content),
                     file_hash=hashlib.sha256(content).hexdigest(), file_content=resume_text[:5000]))

    from app.agents.resume_parser import ResumeParserAgent
    parsed = await ResumeParserAgent().parse_resume(resume_text)

    # Invalidate old profile, save new one
    old_profile = db.query(CandidateProfile).filter(
        CandidateProfile.candidate_id == candidate.id, CandidateProfile.is_current == True
    ).first()
    if old_profile:
        old_profile.is_current = False

    db.add(CandidateProfile(candidate_id=candidate.id, tenant_id=tid, skills=json.dumps(parsed.get("skills", [])),
                            experience=json.dumps(parsed.get("experience", [])), education=json.dumps(parsed.get("education", [])),
                            summary=parsed.get("summary", ""), confidence_scores=json.dumps(parsed.get("confidence_scores", {})),
                            parsing_method=parsed.get("parsing_method", "rule_based"), is_current=True,
                            version=(old_profile.version + 1) if old_profile else 1))
    candidate.status = "parsed"

    # ===== Compute AI match score for this specific job =====
    from app.agents.matching_agent import MatchingAgent
    matcher = MatchingAgent()
    match_result = await matcher.match_candidate_to_job(
        {
            "skills": parsed.get("skills", []),
            "experience": parsed.get("experience", []),
            "education": parsed.get("education", []),
            "location": None,
        },
        {
            "skills": job.skills_list,
            "experience_min": job.experience_min,
            "experience_max": job.experience_max,
            "education": job.education,
            "location": job.location,
            "remote_allowed": job.remote_allowed,
        },
    )

    app = Application(
        tenant_id=tid, candidate_id=candidate.id, job_id=job_id, status="pending_video",
        match_score=match_result["match_score"],
        ranking_factors_json=json.dumps(match_result.get("ranking_factors", {})),
        ai_recommendation=match_result.get("ai_recommendation"),
        bias_score=match_result.get("bias_score", 0),
    )
    db.add(app); db.flush()
    db.add(AuditLog(tenant_id=tid, action="CANDIDATE_APPLIED_VIA_PORTAL", entity_type="application", entity_id=app.id,
                    details_json=json.dumps({"email": email, "job_title": job.title,
                                             "match_score": match_result["match_score"]})))
    db.commit()
    return {"message": "Application created. Please upload your video pitch to complete.",
            "application_id": app.id, "status": "pending_video", "job_title": job.title,
            "match_score": match_result["match_score"]}


@router.post("/application/{application_id}/video")
async def upload_video_pitch(
    application_id: str,
    email: str = Form(...),
    duration: float = Form(0),
    transcript: str = Form(""),
    video: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload video pitch → AI evaluates → auto-shortlist or reject."""
    tid = _get_default_tenant(db)
    candidate = db.query(Candidate).filter(
        Candidate.email == email, Candidate.tenant_id == tid, Candidate.deleted_at.is_(None)
    ).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    app = db.query(Application).filter(
        Application.id == application_id, Application.candidate_id == candidate.id
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    # Validate file type
    allowed = ["video/webm", "video/mp4", "video/quicktime", "video/x-matroska"]
    if video.content_type and video.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Only video files are accepted (MP4, WebM, MOV)")

    video_bytes = await video.read()
    file_size = len(video_bytes)
    if file_size > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Video must be under 50MB")

    # Store video on disk — uses UPLOADS_DIR env (set by Render to persistent disk path)
    import os
    base_uploads = os.getenv("UPLOADS_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "uploads"))
    video_dir = os.path.join(base_uploads, "videos")
    os.makedirs(video_dir, exist_ok=True)
    ext = video.filename.rsplit(".", 1)[-1] if "." in video.filename else "webm"
    stored_filename = f"{application_id}.{ext}"
    with open(os.path.join(video_dir, stored_filename), "wb") as f:
        f.write(video_bytes)

    app.video_filename = stored_filename
    app.video_size = file_size
    app.video_duration = duration
    app.video_uploaded_at = datetime.now(timezone.utc)
    app.has_video = "yes"

    job = db.query(Job).filter(Job.id == app.job_id).first()
    job_title = job.title if job else "Unknown"
    job_skills = job.skills_list if job else []
    cand_name = f"{candidate.first_name} {candidate.last_name}"

    # ===== AI EVALUATE the video pitch =====
    from app.agents.video_pitch_evaluator import VideoPitchEvaluator
    evaluator = VideoPitchEvaluator()
    evaluation = await evaluator.evaluate(
        transcript=transcript,
        job_title=job_title,
        job_skills=job_skills,
        job_description=job.description if job else "",
        candidate_name=cand_name,
    )

    from app.services.email_service import EmailService

    if evaluation["passed"]:
        # Auto-shortlist — candidate moves to AI interview
        app.status = "shortlisted"
        candidate.status = "shortlisted"
        EmailService.send_shortlisted(
            to_email=candidate.email, candidate_name=cand_name, job_title=job_title,
        )
        status_msg = "shortlisted"
        result_msg = f"Your video pitch scored {evaluation['overall_score']}/5.0 — you've been shortlisted! Check your email for the next step: AI Interview."
    else:
        # Reject — pitch wasn't strong enough
        app.status = "rejected"
        candidate.status = "rejected"
        EmailService.send_video_pitch_rejected_encouraging(
            to_email=candidate.email, candidate_name=cand_name, job_title=job_title,
            score=evaluation['overall_score'], threshold=evaluation['pass_threshold'],
            strengths=evaluation.get('strengths'), improvements=evaluation.get('improvements'),
        )
        status_msg = "rejected"
        result_msg = f"Your video pitch scored {evaluation['overall_score']}/5.0 (needed {evaluation['pass_threshold']}). Unfortunately we cannot move forward."

    db.add(AuditLog(
        tenant_id=tid, action="VIDEO_PITCH_EVALUATED", entity_type="application",
        entity_id=application_id,
        details_json=json.dumps({
            "email": email, "job_title": job_title,
            "video_duration": duration, "transcript_length": len(transcript),
            "overall_score": evaluation["overall_score"],
            "passed": evaluation["passed"],
            "scores": evaluation["scores"],
            "matched_skills": evaluation.get("matched_skills_mentioned", []),
        }),
    ))
    db.commit()

    return {
        "message": result_msg,
        "application_id": application_id,
        "status": status_msg,
        "evaluation": evaluation,
    }


@router.get("/applications")
def get_my_applications(email: str = Query(...), db: Session = Depends(get_db)):
    tid = _get_default_tenant(db)
    candidate = db.query(Candidate).filter(Candidate.email == email, Candidate.tenant_id == tid, Candidate.deleted_at.is_(None)).first()
    if not candidate: return {"applications": []}
    rows = db.query(Application, Job).join(Job, Application.job_id == Job.id).filter(Application.candidate_id == candidate.id).order_by(Application.created_at.desc()).all()

    result = []
    for a, j in rows:
        interview = db.query(Interview).filter(Interview.application_id == a.id, Interview.interview_type == "ai").order_by(Interview.created_at.desc()).first()
        app_data = {
            "id": a.id, "job_title": j.title, "job_location": j.location, "status": a.status,
            "applied_at": a.created_at.isoformat() if a.created_at else None,
            "has_video": a.has_video == "yes",
            "needs_video": a.status == "pending_video",
            "can_take_interview": a.status in ("shortlisted", "interviewing") and (interview is None or interview.status == "in_progress"),
            "can_resume_interview": (interview is not None and interview.status == "in_progress"),
            "is_rejected": a.status == "rejected",
            "rejection_reason": "Disconnected during interview" if (interview and interview.status == "abandoned") else None,
            "interview_status": interview.status if interview else None,
            "interview_id": interview.id if interview else None,
            "interview_score": interview.overall_score if interview else None,
            "interview_passed": interview.passed if interview else None,
        }
        result.append(app_data)
    return {"applications": result}


@router.get("/data")
def export_data(email: str = Query(...), db: Session = Depends(get_db)):
    tid = _get_default_tenant(db)
    c = db.query(Candidate).filter(Candidate.email == email, Candidate.tenant_id == tid, Candidate.deleted_at.is_(None)).first()
    if not c: raise HTTPException(status_code=404, detail="Not found")
    p = db.query(CandidateProfile).filter(CandidateProfile.candidate_id == c.id, CandidateProfile.is_current == True).first()
    return {"personal_data": {"email": c.email, "first_name": c.first_name, "last_name": c.last_name, "status": c.status},
            "profile": {"skills": p.skills_list, "experience": p.experience_list, "education": p.education_list} if p else None}


@router.get("/inbox")
def get_my_inbox(email: str = Query(...), db: Session = Depends(get_db)):
    """Get all emails/notifications sent to this candidate."""
    tid = _get_default_tenant(db)
    candidate = db.query(Candidate).filter(Candidate.email == email, Candidate.tenant_id == tid, Candidate.deleted_at.is_(None)).first()
    if not candidate:
        return {"emails": [], "unread": 0}

    from app.models.notification import Notification
    notifs = db.query(Notification).filter(
        Notification.candidate_id == candidate.id,
        Notification.type == "email",
    ).order_by(Notification.created_at.desc()).all()

    return {
        "emails": [
            {
                "id": n.id,
                "subject": n.subject,
                "body_html": n.message_template,
                "body_text": n.message_content,
                "sent_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notifs
        ],
        "total": len(notifs),
    }


@router.delete("/data")
def delete_data(email: str = Query(...), db: Session = Depends(get_db)):
    tid = _get_default_tenant(db)
    c = db.query(Candidate).filter(Candidate.email == email, Candidate.tenant_id == tid, Candidate.deleted_at.is_(None)).first()
    if not c: raise HTTPException(status_code=404, detail="Not found")
    c.email = f"deleted_{c.id}@anonymized.local"; c.first_name = "DELETED"; c.last_name = "DELETED"
    c.phone_hash = None; c.deleted_at = datetime.now(timezone.utc); c.status = "withdrawn"
    db.add(AuditLog(tenant_id=tid, action="CANDIDATE_SELF_DELETION_GDPR", entity_type="candidate", entity_id=c.id,
                    details_json=json.dumps({"reason": "GDPR Article 17"}), gdpr_related=True))
    db.commit()
    return {"message": "Your data has been anonymized and marked for deletion.", "gdpr_reference": "Article 17"}


# ==================== AI INTERVIEW ENDPOINTS ====================

@router.post("/interview/start")
async def start_ai_interview(
    application_id: str = Form(...),
    email: str = Form(...),
    db: Session = Depends(get_db),
):
    """Start an AI interview for a shortlisted application."""
    tid = _get_default_tenant(db)
    candidate = db.query(Candidate).filter(Candidate.email == email, Candidate.tenant_id == tid, Candidate.deleted_at.is_(None)).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    app = db.query(Application).filter(Application.id == application_id, Application.candidate_id == candidate.id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if app.status not in ("shortlisted", "interviewing"):
        raise HTTPException(status_code=400, detail="Only shortlisted candidates can take the AI interview")

    # Check for existing in-progress interview - resume it
    existing = db.query(Interview).filter(
        Interview.application_id == application_id,
        Interview.interview_type == "ai",
        Interview.status.in_(["pending", "in_progress"]),
    ).first()
    if existing:
        job = db.query(Job).filter(Job.id == app.job_id).first()
        return {
            "interview_id": existing.id,
            "job_title": job.title if job else "Unknown",
            "questions": existing.questions,
            "total_questions": len(existing.questions),
            "status": existing.status,
            "message": "Resuming existing interview",
        }

    # Get job details for question generation
    job = db.query(Job).filter(Job.id == app.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Collect questions from all previous interviews for this job
    # so this candidate (and others) get different questions each time
    past_interviews = db.query(Interview).filter(
        Interview.tenant_id == tid,
        Interview.application_id == application_id,
    ).all()
    exclude_questions = []
    for pi in past_interviews:
        for q in pi.questions:
            exclude_questions.append(q.get("question", ""))

    # Also exclude questions asked to OTHER candidates for the same job
    from sqlalchemy import and_
    other_apps = db.query(Application).filter(
        Application.job_id == app.job_id,
        Application.id != application_id,
    ).all()
    for oa in other_apps:
        other_interviews = db.query(Interview).filter(Interview.application_id == oa.id).all()
        for oi in other_interviews:
            for q in oi.questions:
                exclude_questions.append(q.get("question", ""))

    # Generate questions using AI Interview Agent
    from app.agents.interview_agent import AIInterviewAgent
    agent = AIInterviewAgent()
    questions = await agent.generate_questions(
        job_skills=job.skills_list,
        job_title=job.title,
        job_description=job.description,
        exclude_questions=exclude_questions,
    )

    # Create interview record
    interview = Interview(
        tenant_id=tid,
        application_id=application_id,
        interview_type="ai",
        status="in_progress",
        started_at=datetime.now(timezone.utc),
        questions_json=json.dumps(questions),
        duration_minutes=30,
    )
    db.add(interview)

    # Update application status
    app.status = "interviewing"
    candidate.status = "interviewing"

    db.add(AuditLog(
        tenant_id=tid, action="AI_INTERVIEW_STARTED", entity_type="interview",
        entity_id=interview.id,
        details_json=json.dumps({"application_id": application_id, "job_title": job.title, "num_questions": len(questions)}),
    ))

    db.commit()
    db.refresh(interview)

    return {
        "interview_id": interview.id,
        "job_title": job.title,
        "questions": questions,
        "total_questions": len(questions),
        "status": "in_progress",
        "message": f"AI Interview started. You have {len(questions)} questions. Good luck!",
    }


@router.post("/interview/{interview_id}/submit")
async def submit_ai_interview(
    interview_id: str,
    email: str = Form(...),
    answers: str = Form(...),  # JSON string of [{question_id, answer}]
    db: Session = Depends(get_db),
):
    """Submit answers for an AI interview and get evaluation."""
    tid = _get_default_tenant(db)
    candidate = db.query(Candidate).filter(Candidate.email == email, Candidate.tenant_id == tid, Candidate.deleted_at.is_(None)).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    interview = db.query(Interview).filter(Interview.id == interview_id, Interview.status == "in_progress").first()
    if not interview:
        raise HTTPException(status_code=404, detail="Active interview not found")

    # Verify the candidate owns this interview
    app = db.query(Application).filter(Application.id == interview.application_id, Application.candidate_id == candidate.id).first()
    if not app:
        raise HTTPException(status_code=403, detail="Not authorized")

    job = db.query(Job).filter(Job.id == app.job_id).first()

    # Parse answers
    try:
        answers_list = json.loads(answers)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid answers format. Expected JSON array.")

    # Merge questions with answers
    questions = interview.questions
    qa_pairs = []
    for q in questions:
        answer_text = ""
        for a in answers_list:
            if str(a.get("question_id")) == str(q.get("id")):
                answer_text = a.get("answer", "")
                break
        qa_pairs.append({
            "id": q.get("id"),
            "question": q.get("question"),
            "skill": q.get("skill", "General"),
            "type": q.get("type", "technical"),
            "answer": answer_text,
        })

    # Evaluate with AI
    from app.agents.interview_agent import AIInterviewAgent
    agent = AIInterviewAgent()
    evaluation = await agent.evaluate_answers(
        questions_and_answers=qa_pairs,
        job_title=job.title if job else "Unknown",
        job_skills=job.skills_list if job else [],
    )

    # Update interview record
    interview.answers_json = json.dumps(answers_list)
    interview.ai_evaluation_json = json.dumps(evaluation)
    interview.overall_score = evaluation.get("overall_score", 0)
    interview.passed = evaluation.get("passed", False)
    interview.completed_at = datetime.now(timezone.utc)
    interview.status = "passed" if evaluation.get("passed") else "failed"

    # Update application status based on result + send email
    from app.services.email_service import EmailService
    job_title = job.title if job else "the position"
    cand_name = f"{candidate.first_name} {candidate.last_name}"
    score = evaluation.get("overall_score", 0)

    if evaluation.get("passed"):
        app.status = "interview_passed"
        candidate.status = "interview_passed"
        EmailService.send_interview_passed(
            to_email=candidate.email, candidate_name=cand_name,
            job_title=job_title, score=score,
        )
    else:
        app.status = "rejected"
        candidate.status = "rejected"
        EmailService.send_interview_failed_encouraging(
            to_email=candidate.email, candidate_name=cand_name,
            job_title=job_title, score=score,
            threshold=evaluation.get("pass_threshold", 3.0),
            strengths=[qr.get("feedback", "") for qr in evaluation.get("question_results", []) if qr.get("score", 0) >= 3.5][:3],
        )

    db.add(AuditLog(
        tenant_id=tid, action="AI_INTERVIEW_COMPLETED", entity_type="interview",
        entity_id=interview.id,
        details_json=json.dumps({
            "application_id": app.id,
            "overall_score": score,
            "passed": evaluation.get("passed"),
            "recommendation": evaluation.get("recommendation"),
        }),
    ))

    db.commit()

    return {
        "interview_id": interview.id,
        "status": interview.status,
        "evaluation": evaluation,
    }


@router.get("/interview/{interview_id}")
def get_interview_result(interview_id: str, email: str = Query(...), db: Session = Depends(get_db)):
    """Get AI interview result."""
    tid = _get_default_tenant(db)
    candidate = db.query(Candidate).filter(Candidate.email == email, Candidate.tenant_id == tid, Candidate.deleted_at.is_(None)).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    # Verify ownership
    app = db.query(Application).filter(Application.id == interview.application_id, Application.candidate_id == candidate.id).first()
    if not app:
        raise HTTPException(status_code=403, detail="Not authorized")

    job = db.query(Job).filter(Job.id == app.job_id).first()

    return {
        "interview_id": interview.id,
        "job_title": job.title if job else "Unknown",
        "status": interview.status,
        "started_at": interview.started_at.isoformat() if interview.started_at else None,
        "completed_at": interview.completed_at.isoformat() if interview.completed_at else None,
        "overall_score": interview.overall_score,
        "passed": interview.passed,
        "questions": interview.questions,
        "evaluation": interview.ai_evaluation,
    }


@router.post("/interview/{interview_id}/abandon")
def abandon_interview(
    interview_id: str,
    email: str = Form(...),
    reason: str = Form("Candidate disconnected"),
    db: Session = Depends(get_db),
):
    """Candidate cut the call mid-interview — auto-reject."""
    tid = _get_default_tenant(db)
    candidate = db.query(Candidate).filter(
        Candidate.email == email, Candidate.tenant_id == tid, Candidate.deleted_at.is_(None)
    ).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    app = db.query(Application).filter(
        Application.id == interview.application_id, Application.candidate_id == candidate.id
    ).first()
    if not app:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Mark interview as failed
    interview.status = "abandoned"
    interview.completed_at = datetime.now(timezone.utc)
    interview.overall_score = 0
    interview.passed = False

    # Reject the application
    app.status = "rejected"
    app.human_decision = "auto_rejected_abandoned"
    candidate.status = "rejected"

    # Send rejection email
    job = db.query(Job).filter(Job.id == app.job_id).first()
    from app.services.email_service import EmailService
    EmailService.send_abandoned_encouraging(
        to_email=candidate.email,
        candidate_name=f"{candidate.first_name} {candidate.last_name}",
        job_title=job.title if job else "the position",
    )

    db.add(AuditLog(
        tenant_id=tid, action="AI_INTERVIEW_ABANDONED", entity_type="interview",
        entity_id=interview.id,
        details_json=json.dumps({
            "application_id": app.id,
            "reason": reason,
            "questions_answered": len([a for a in interview.answers if a]),
            "total_questions": len(interview.questions),
        }),
    ))

    db.commit()
    return {"status": "rejected", "message": "Interview abandoned. Application has been rejected."}
