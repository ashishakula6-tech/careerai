import json
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone

from app.core.security import get_current_user_token, require_role
from app.middleware.tenant import get_tenant_session
from app.models.application import Application
from app.models.candidate import Candidate, CandidateProfile
from app.models.job import Job
from app.models.approval import Approval
from app.models.notification import Notification
from app.models.audit_log import AuditLog

router = APIRouter(prefix="/applications", tags=["Applications"])


@router.get("")
def list_applications(
    skip: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100),
    job_id: Optional[str] = None, status_filter: Optional[str] = Query(None, alias="status"),
    token: dict = Depends(get_current_user_token), db: Session = Depends(get_tenant_session),
):
    query = db.query(Application).filter(Application.tenant_id == token["tenant_id"])
    if job_id: query = query.filter(Application.job_id == job_id)
    if status_filter: query = query.filter(Application.status == status_filter)
    total = query.count()
    apps = query.order_by(Application.match_score.desc().nullslast(), Application.created_at.desc()).offset(skip).limit(limit).all()
    return {"items": [_app_dict(a, db) for a in apps], "total": total, "skip": skip, "limit": limit}


@router.post("", status_code=201)
async def create_application(candidate_id: str, job_id: str, token: dict = Depends(get_current_user_token), db: Session = Depends(get_tenant_session)):
    tid = token["tenant_id"]
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id, Candidate.deleted_at.is_(None)).first()
    if not candidate: raise HTTPException(status_code=404, detail="Candidate not found")
    job = db.query(Job).filter(Job.id == job_id, Job.deleted_at.is_(None), Job.status == "active").first()
    if not job: raise HTTPException(status_code=404, detail="Job not found or not active")
    if db.query(Application).filter(Application.candidate_id == candidate_id, Application.job_id == job_id).first():
        raise HTTPException(status_code=409, detail="Application already exists")

    profile = db.query(CandidateProfile).filter(CandidateProfile.candidate_id == candidate_id, CandidateProfile.is_current == True).first()
    match_result = {"match_score": 0, "ranking_factors": {}, "ai_recommendation": "review", "bias_score": 0.02}

    if profile:
        from app.agents.matching_agent import MatchingAgent
        matcher = MatchingAgent()
        match_result = await matcher.match_candidate_to_job(
            {"skills": profile.skills_list, "experience": profile.experience_list, "education": profile.education_list},
            {"skills": job.skills_list, "experience_min": job.experience_min, "experience_max": job.experience_max, "education": job.education, "location": job.location, "remote_allowed": job.remote_allowed},
        )

    app = Application(tenant_id=tid, candidate_id=candidate_id, job_id=job_id,
                      match_score=match_result["match_score"], ranking_factors_json=json.dumps(match_result.get("ranking_factors", {})),
                      ai_recommendation=match_result.get("ai_recommendation", "review"), bias_score=match_result.get("bias_score", 0), status="matched")
    db.add(app)
    db.flush()

    db.add(Approval(tenant_id=tid, entity_type="application", entity_id=app.id, action="shortlist_decision",
                    ai_recommendation_json=json.dumps({"decision": match_result.get("ai_recommendation"), "score": match_result["match_score"]})))
    db.add(AuditLog(tenant_id=tid, user_id=token.get("sub"), action="APPLICATION_CREATED", entity_type="application",
                    entity_id=app.id, details_json=json.dumps({"match_score": match_result["match_score"], "ai_recommendation": match_result.get("ai_recommendation")})))
    candidate.status = "matched"
    db.commit()
    db.refresh(app)
    return _app_dict(app, db)


@router.get("/{app_id}")
def get_application(app_id: str, token: dict = Depends(get_current_user_token), db: Session = Depends(get_tenant_session)):
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app: raise HTTPException(status_code=404, detail="Application not found")
    return _app_dict(app, db)


@router.get("/{app_id}/video")
def get_application_video(
    app_id: str,
    request: Request,
    token: str = Query(None, description="JWT token (passed as query param so video tag can load)"),
):
    """Stream the video pitch with HTTP Range support for proper video playback."""
    from fastapi.responses import StreamingResponse
    from app.core.security import decode_token
    from app.core.database import SessionLocal
    import os

    # Manual auth via query param token
    if not token:
        raise HTTPException(status_code=401, detail="Token required")
    try:
        payload = decode_token(token)
        if payload.get("role") not in ("admin", "recruiter"):
            raise HTTPException(status_code=403, detail="Recruiter access required")
        tid = payload.get("tenant_id")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Fetch app info using a short-lived DB session
    db = SessionLocal()
    try:
        app = db.query(Application).filter(Application.id == app_id, Application.tenant_id == tid).first()
        if not app or not app.video_filename:
            raise HTTPException(status_code=404, detail="Video not found")
        video_filename = app.video_filename

        # Audit log (only for initial request without range or start of stream)
        if not request.headers.get("range") or "bytes=0-" in (request.headers.get("range") or ""):
            try:
                db.add(AuditLog(
                    tenant_id=tid, user_id=payload.get("sub"), action="VIDEO_VIEWED",
                    entity_type="application", entity_id=app_id,
                    details_json=json.dumps({"video_filename": video_filename}),
                ))
                db.commit()
            except Exception:
                pass
    finally:
        db.close()

    base_uploads = os.getenv("UPLOADS_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "uploads"))
    video_dir = os.path.join(base_uploads, "videos")
    filepath = os.path.join(video_dir, video_filename)

    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Video file not found on disk")

    file_size = os.path.getsize(filepath)
    if file_size < 1024:
        raise HTTPException(status_code=404, detail="Video file is corrupt or incomplete")

    ext = video_filename.rsplit(".", 1)[-1].lower()
    media_type = {"webm": "video/webm", "mp4": "video/mp4", "mov": "video/quicktime", "mkv": "video/x-matroska"}.get(ext, "video/webm")

    # HTTP Range support
    range_header = request.headers.get("range")
    if range_header:
        try:
            range_str = range_header.replace("bytes=", "").strip()
            start_str, end_str = range_str.split("-")
            start = int(start_str) if start_str else 0
            end = int(end_str) if end_str else file_size - 1
            end = min(end, file_size - 1)
            chunk_size = end - start + 1
        except Exception:
            start = 0; end = file_size - 1; chunk_size = file_size

        def iter_chunk():
            with open(filepath, "rb") as f:
                f.seek(start)
                remaining = chunk_size
                while remaining > 0:
                    data = f.read(min(8192, remaining))
                    if not data: break
                    yield data
                    remaining -= len(data)

        return StreamingResponse(iter_chunk(), status_code=206, media_type=media_type, headers={
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(chunk_size),
            "Cache-Control": "no-cache",
        })

    # No range - full file
    def iter_full():
        with open(filepath, "rb") as f:
            while True:
                data = f.read(8192)
                if not data: break
                yield data

    return StreamingResponse(iter_full(), media_type=media_type, headers={
        "Accept-Ranges": "bytes",
        "Content-Length": str(file_size),
        "Cache-Control": "no-cache",
    })


@router.get("/videos/all")
def list_all_videos(
    token: dict = Depends(require_role("admin", "recruiter")),
    db: Session = Depends(get_tenant_session),
    skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200),
):
    """List all applications that have a playable video pitch (excludes corrupt files)."""
    tid = token["tenant_id"]
    # Filter: only videos >= 1KB (real recordings, not test data)
    query = db.query(Application).filter(
        Application.tenant_id == tid,
        Application.has_video == "yes",
        Application.video_filename.isnot(None),
        Application.video_size >= 1024,
    ).order_by(Application.video_uploaded_at.desc().nullslast())

    total = query.count()
    apps = query.offset(skip).limit(limit).all()

    results = []
    for app in apps:
        candidate = db.query(Candidate).filter(Candidate.id == app.candidate_id).first()
        job = db.query(Job).filter(Job.id == app.job_id).first()
        results.append({
            "application_id": app.id,
            "candidate_id": app.candidate_id,
            "candidate_name": f"{candidate.first_name} {candidate.last_name}" if candidate else "Unknown",
            "candidate_email": candidate.email if candidate else None,
            "job_title": job.title if job else "Unknown",
            "job_location": job.location if job else None,
            "video_duration": app.video_duration,
            "video_size": app.video_size,
            "uploaded_at": app.video_uploaded_at.isoformat() if app.video_uploaded_at else None,
            "match_score": app.match_score,
            "status": app.status,
            "ai_recommendation": app.ai_recommendation,
        })

    return {"items": results, "total": total, "skip": skip, "limit": limit}


@router.post("/{app_id}/shortlist")
def shortlist(app_id: str, override_reason: Optional[str] = None, token: dict = Depends(require_role("admin", "recruiter")), db: Session = Depends(get_tenant_session)):
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app: raise HTTPException(status_code=404, detail="Application not found")

    app.status = "shortlisted"; app.human_decision = "shortlist"; app.approved_by = token["sub"]; app.approved_at = datetime.now(timezone.utc); app.override_reason = override_reason

    candidate = db.query(Candidate).filter(Candidate.id == app.candidate_id).first()
    job = db.query(Job).filter(Job.id == app.job_id).first()
    if candidate:
        candidate.status = "shortlisted"
        db.add(Notification(tenant_id=app.tenant_id, candidate_id=app.candidate_id, application_id=app_id,
                            type="shortlist_notification", status="sent", subject="Congratulations! You've been shortlisted",
                            message_content=f"Dear {candidate.first_name},\n\nYour application has been shortlisted. We will be in touch shortly.\n\nBest regards,\nHR Team",
                            recipient_email=candidate.email))

        # Send email automatically
        from app.services.email_service import EmailService
        EmailService.send_shortlisted(
            to_email=candidate.email,
            candidate_name=f"{candidate.first_name} {candidate.last_name}",
            job_title=job.title if job else "the position",
        )

    is_override = app.ai_recommendation != "recommend"
    db.add(AuditLog(tenant_id=app.tenant_id, user_id=token["sub"], action="CANDIDATE_SHORTLISTED", entity_type="application",
                    entity_id=app_id, details_json=json.dumps({"ai_recommendation": app.ai_recommendation, "human_decision": "shortlist", "override": is_override, "match_score": app.match_score})))

    approval = db.query(Approval).filter(Approval.entity_id == app_id, Approval.status == "pending").first()
    if approval:
        approval.status = "approved"; approval.decided_by = token["sub"]; approval.decided_at = datetime.now(timezone.utc)

    db.commit(); db.refresh(app)
    return _app_dict(app, db)


@router.post("/{app_id}/reject")
def reject(app_id: str, override_reason: Optional[str] = None, token: dict = Depends(require_role("admin", "recruiter")), db: Session = Depends(get_tenant_session)):
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app: raise HTTPException(status_code=404, detail="Application not found")
    app.status = "rejected"; app.human_decision = "reject"; app.approved_by = token["sub"]; app.approved_at = datetime.now(timezone.utc); app.override_reason = override_reason
    candidate = db.query(Candidate).filter(Candidate.id == app.candidate_id).first()
    job = db.query(Job).filter(Job.id == app.job_id).first()
    if candidate:
        candidate.status = "rejected"
        # Send rejection email automatically
        from app.services.email_service import EmailService
        EmailService.send_rejected(
            to_email=candidate.email,
            candidate_name=f"{candidate.first_name} {candidate.last_name}",
            job_title=job.title if job else "the position",
            reason=override_reason,
        )
    db.add(AuditLog(tenant_id=app.tenant_id, user_id=token["sub"], action="CANDIDATE_REJECTED", entity_type="application",
                    entity_id=app_id, details_json=json.dumps({"ai_recommendation": app.ai_recommendation, "human_decision": "reject", "override": app.ai_recommendation == "recommend"})))
    db.commit(); db.refresh(app)
    return _app_dict(app, db)


@router.post("/{app_id}/hold")
def hold(app_id: str, token: dict = Depends(require_role("admin", "recruiter")), db: Session = Depends(get_tenant_session)):
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app: raise HTTPException(status_code=404, detail="Application not found")
    app.status = "hold"; app.human_decision = "hold"
    db.commit(); db.refresh(app)
    return _app_dict(app, db)


def _app_dict(a, db=None):
    base = {
        "id": a.id, "tenant_id": a.tenant_id, "candidate_id": a.candidate_id, "job_id": a.job_id,
        "match_score": a.match_score, "ranking_factors": a.ranking_factors, "ai_recommendation": a.ai_recommendation,
        "human_decision": a.human_decision, "bias_score": a.bias_score, "status": a.status,
        "override_reason": a.override_reason, "approved_by": a.approved_by,
        "approved_at": a.approved_at.isoformat() if a.approved_at else None,
        "has_video": a.has_video == "yes",
        "video_filename": a.video_filename,
        "video_duration": a.video_duration,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }
    # Enrich with candidate + job info
    if db:
        candidate = db.query(Candidate).filter(Candidate.id == a.candidate_id).first()
        job = db.query(Job).filter(Job.id == a.job_id).first()
        if candidate:
            base["candidate_name"] = f"{candidate.first_name} {candidate.last_name}"
            base["candidate_email"] = candidate.email
        if job:
            base["job_title"] = job.title
            base["job_location"] = job.location
            base["job_skills"] = job.skills_list
    return base
