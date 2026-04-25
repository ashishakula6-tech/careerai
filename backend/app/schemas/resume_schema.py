"""
Stage 4 & 5 of the resume pipeline: Schema definition + Validation.

Pydantic models define the exact shape of a parsed resume.
The validate_parsed() function coerces and heals LLM output so
downstream code always receives well-typed, bounded data.
"""
from __future__ import annotations

import re
from typing import List, Optional
from pydantic import BaseModel, field_validator, model_validator


# ---------------------------------------------------------------------------
# Sub-models
# ---------------------------------------------------------------------------

class PersonalInfo(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin: Optional[str] = None
    portfolio: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        if v is None:
            return v
        v = str(v).strip()
        if not re.match(r"[^@]+@[^@]+\.[^@]+", v):
            return None          # drop malformed email rather than fail
        return v.lower()

    @field_validator("phone")
    @classmethod
    def clean_phone(cls, v):
        if v is None:
            return v
        # Keep digits, +, -, (, ), spaces only
        cleaned = re.sub(r"[^\d\+\-\(\)\s]", "", str(v)).strip()
        return cleaned if len(re.sub(r"\D", "", cleaned)) >= 7 else None

    @field_validator("linkedin", "portfolio")
    @classmethod
    def clean_url(cls, v):
        if not v:
            return None
        v = str(v).strip()
        return v if v.startswith(("http", "linkedin", "github", "www")) else None


class EducationEntry(BaseModel):
    institution: Optional[str] = None
    degree: Optional[str] = None
    field: Optional[str] = None
    start_date: Optional[str] = None   # YYYY-MM
    end_date: Optional[str] = None
    grade: Optional[str] = None

    @field_validator("start_date", "end_date")
    @classmethod
    def normalise_date(cls, v):
        return _normalise_date(v)


class ExperienceEntry(BaseModel):
    company: Optional[str] = None
    role: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    responsibilities: List[str] = []
    technologies: List[str] = []
    description: Optional[str] = None  # fallback summary line

    @field_validator("start_date", "end_date")
    @classmethod
    def normalise_date(cls, v):
        return _normalise_date(v)

    @field_validator("responsibilities", "technologies")
    @classmethod
    def clean_list(cls, v):
        if not isinstance(v, list):
            return []
        return [str(i).strip() for i in v if str(i).strip()][:20]


class ProjectEntry(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    technologies: List[str] = []
    role: Optional[str] = None
    outcome: Optional[str] = None


class SkillsBlock(BaseModel):
    technical: List[str] = []
    soft: List[str] = []
    tools: List[str] = []

    @field_validator("technical", "soft", "tools")
    @classmethod
    def clean_skills(cls, v):
        if not isinstance(v, list):
            return []
        return list(dict.fromkeys(
            s.strip() for s in v if isinstance(s, str) and s.strip()
        ))[:60]


class LanguageEntry(BaseModel):
    language: Optional[str] = None
    proficiency: Optional[str] = None


class CertificationEntry(BaseModel):
    title: Optional[str] = None
    issuer: Optional[str] = None
    date: Optional[str] = None
    description: Optional[str] = None

    @field_validator("date")
    @classmethod
    def normalise_date(cls, v):
        return _normalise_date(v)


class AwardEntry(BaseModel):
    title: Optional[str] = None
    issuer: Optional[str] = None
    date: Optional[str] = None
    description: Optional[str] = None


class PublicationEntry(BaseModel):
    title: Optional[str] = None
    publisher: Optional[str] = None
    date: Optional[str] = None
    description: Optional[str] = None


class AdditionalWorkEntry(BaseModel):
    type: Optional[str] = None        # internship | freelance | volunteer | hackathon
    organization: Optional[str] = None
    role: Optional[str] = None
    duration: Optional[str] = None
    description: Optional[str] = None


# ---------------------------------------------------------------------------
# Top-level schema
# ---------------------------------------------------------------------------

class ParsedResume(BaseModel):
    personal_info: PersonalInfo = PersonalInfo()
    summary: Optional[str] = None
    education: List[EducationEntry] = []
    experience: List[ExperienceEntry] = []
    projects: List[ProjectEntry] = []
    skills: SkillsBlock = SkillsBlock()
    languages: List[LanguageEntry] = []
    certifications: List[CertificationEntry] = []
    awards: List[AwardEntry] = []
    publications: List[PublicationEntry] = []
    additional_work: List[AdditionalWorkEntry] = []
    interests: List[str] = []

    # Injected by the pipeline, not from LLM
    parsing_method: str = "llm"
    overall_confidence: float = 0.0
    confidence_scores: dict = {}
    text_quality: float = 0.0
    validation_warnings: List[str] = []

    @field_validator("summary")
    @classmethod
    def cap_summary(cls, v):
        if not v:
            return v
        # Trim to 1000 chars
        return str(v).strip()[:1000]

    @field_validator("interests")
    @classmethod
    def clean_interests(cls, v):
        if not isinstance(v, list):
            return []
        return [str(i).strip() for i in v if str(i).strip()][:20]

    @model_validator(mode="after")
    def cross_validate(self):
        warnings = list(self.validation_warnings)
        if not self.personal_info.email:
            warnings.append("No email address found")
        if not self.skills.technical and not self.skills.tools:
            warnings.append("No technical skills extracted")
        if not self.experience:
            warnings.append("No work experience found")
        if not self.education:
            warnings.append("No education history found")
        self.validation_warnings = warnings
        return self

    # ------------------------------------------------------------------
    # Convenience: flatten skills for the matching engine
    # ------------------------------------------------------------------
    def flat_skills(self) -> List[str]:
        return list(dict.fromkeys(
            self.skills.technical + self.skills.soft + self.skills.tools
        ))

    # ------------------------------------------------------------------
    # Convert experience to the format the matching agent expects
    # ------------------------------------------------------------------
    def experience_for_matching(self) -> List[dict]:
        result = []
        for e in self.experience:
            result.append({
                "company": e.company or "Not specified",
                "role": e.role or "Not specified",
                "years": _date_range_to_years(e.start_date, e.end_date),
                "description": e.description or " | ".join(e.responsibilities[:5]),
            })
        return result

    def education_for_matching(self) -> List[dict]:
        return [
            {
                "degree": e.degree or "Not specified",
                "field": e.field or "Not specified",
                "university": e.institution or "Not specified",
                "year": (e.end_date or "")[:4] or None,
                "grade": e.grade or "",
            }
            for e in self.education
        ]


# ---------------------------------------------------------------------------
# Validation entry-point
# ---------------------------------------------------------------------------

class ValidationResult:
    def __init__(self, resume: ParsedResume, errors: List[str]):
        self.resume = resume
        self.errors = errors
        self.is_valid = len(errors) == 0

    @property
    def warnings(self):
        return self.resume.validation_warnings


def validate_parsed(raw_dict: dict, text_quality: float = 1.0,
                    parsing_method: str = "llm") -> ValidationResult:
    """Validate and coerce a raw LLM output dict into a ParsedResume.

    Healing strategy:
    - Missing keys → defaults (empty lists / None)
    - Wrong types (e.g. str where list expected) → coerced or dropped
    - Invalid emails / dates → set to None rather than raising
    - Array sizes capped at safe limits

    Returns a ValidationResult with the validated resume and any hard errors.
    """
    errors: List[str] = []

    # --- Normalise skills block ---
    skills_raw = raw_dict.get("skills", {})
    if isinstance(skills_raw, list):
        # Old format: flat list → put everything in technical
        raw_dict["skills"] = {"technical": skills_raw, "soft": [], "tools": []}
    elif not isinstance(skills_raw, dict):
        raw_dict["skills"] = {}

    # --- Normalise experience: some LLMs return years as a string ---
    for exp in raw_dict.get("experience", []):
        if not isinstance(exp, dict):
            continue
        if "years" in exp:
            try:
                exp["years"] = float(exp["years"])
            except (TypeError, ValueError):
                exp.pop("years", None)

    # --- Ensure all list fields are actually lists ---
    list_fields = [
        "education", "experience", "projects", "languages",
        "certifications", "awards", "publications", "additional_work", "interests",
    ]
    for field in list_fields:
        if field in raw_dict and not isinstance(raw_dict[field], list):
            raw_dict[field] = []

    # --- Parse through Pydantic ---
    try:
        resume = ParsedResume(
            **raw_dict,
            text_quality=text_quality,
            parsing_method=parsing_method,
        )
    except Exception as exc:
        errors.append(f"Schema parse error: {exc}")
        # Return a minimal valid resume rather than crashing the upload
        resume = ParsedResume(
            text_quality=text_quality,
            parsing_method=parsing_method,
            validation_warnings=[f"Schema parse error: {exc}"],
        )

    return ValidationResult(resume, errors)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_MONTH_MAP = {
    "jan": "01", "feb": "02", "mar": "03", "apr": "04",
    "may": "05", "jun": "06", "jul": "07", "aug": "08",
    "sep": "09", "oct": "10", "nov": "11", "dec": "12",
}


def _normalise_date(v: Optional[str]) -> Optional[str]:
    """Coerce various date strings to YYYY-MM. Returns None if unparseable."""
    if not v:
        return None
    v = str(v).strip().lower()
    if v in ("present", "current", "now", "ongoing", "till date"):
        return "present"

    # Already YYYY-MM
    if re.match(r"^\d{4}-\d{2}$", v):
        return v

    # YYYY only
    if re.match(r"^\d{4}$", v):
        return f"{v}-01"

    # Month YYYY or YYYY Month
    for abbr, num in _MONTH_MAP.items():
        if abbr in v:
            year_match = re.search(r"\d{4}", v)
            if year_match:
                return f"{year_match.group()}-{num}"

    # MM/YYYY or MM-YYYY
    m = re.match(r"(\d{1,2})[\/\-](\d{4})", v)
    if m:
        return f"{m.group(2)}-{m.group(1).zfill(2)}"

    # YYYY/MM
    m = re.match(r"(\d{4})[\/\-](\d{1,2})", v)
    if m:
        return f"{m.group(1)}-{m.group(2).zfill(2)}"

    return None


def _date_range_to_years(start: Optional[str], end: Optional[str]) -> float:
    try:
        import datetime

        def parse_ym(s):
            if not s or s == "present":
                return datetime.date.today()
            parts = s.split("-")
            return datetime.date(int(parts[0]), int(parts[1]) if len(parts) > 1 else 6, 1)

        s, e = parse_ym(start), parse_ym(end)
        if s and e and e > s:
            return round((e - s).days / 365.25, 1)
    except Exception:
        pass
    return 0.0
