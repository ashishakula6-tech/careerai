"""
Resume Intelligence Engine — 5-stage pipeline orchestrator.

Pipeline stages
───────────────
Stage 1 │ OCR          file_extractor.py   — extract text from PDF / image / DOCX
Stage 2 │ Cleaning     text_cleaner.py     — fix encoding, remove noise, score quality
Stage 3 │ LLM          _extract_with_llm   — structured JSON extraction (GPT-4o-mini)
Stage 4 │ Validation   resume_schema.py    — Pydantic schema validation + healing
Stage 5 │ Output       parse_resume()      — returns standardised ParsedResume dict

Fallback: if LLM is unavailable or confidence is below threshold,
Stage 3 is replaced by rule-based extraction.
"""
import re
import json
import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public system prompt (used by Stage 3)
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """ROLE:
You are an advanced AI Resume Intelligence Engine for a Career AI platform.
Extract, normalize, and structure candidate data from unstructured resume text.

TASKS:
1. Extract all candidate information.
2. Categorise into structured sections.
3. Normalise formats (dates → YYYY-MM, deduplicate skills).
4. Infer obvious missing data — do NOT hallucinate.
5. Return ONLY valid JSON — no markdown, no commentary.

PHASED EXECUTION:
Phase 1 — Raw Extraction: pull all data without structuring.
Phase 2 — Structuring: organise into defined categories.
Phase 3 — Normalisation: fix dates, standardise skills, remove duplicates.
Phase 4 — Validation: ensure no empty critical fields.
Phase 5 — JSON Output: return the final object.

STRICT OUTPUT FORMAT (JSON only):
{
  "personal_info": {
    "full_name": "",
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": "",
    "portfolio": ""
  },
  "summary": "",
  "education": [
    {"institution": "", "degree": "", "field": "", "start_date": "YYYY-MM", "end_date": "YYYY-MM", "grade": ""}
  ],
  "experience": [
    {"company": "", "role": "", "start_date": "YYYY-MM", "end_date": "YYYY-MM or present",
     "responsibilities": [], "technologies": []}
  ],
  "projects": [
    {"name": "", "description": "", "technologies": [], "role": "", "outcome": ""}
  ],
  "skills": {
    "technical": [],
    "soft": [],
    "tools": []
  },
  "languages": [{"language": "", "proficiency": ""}],
  "certifications": [{"title": "", "issuer": "", "date": "YYYY-MM", "description": ""}],
  "awards": [{"title": "", "issuer": "", "date": "", "description": ""}],
  "publications": [{"title": "", "publisher": "", "date": "", "description": ""}],
  "additional_work": [{"type": "", "organization": "", "role": "", "duration": "", "description": ""}],
  "interests": []
}

RULES:
- Dates must be YYYY-MM. Use "present" for current roles.
- If a field is unknown return null or [].
- Do not invent company names, schools, or dates.
- Return ONLY the JSON object — nothing else."""


# ---------------------------------------------------------------------------
# Main pipeline entry point
# ---------------------------------------------------------------------------

class ResumeParserAgent:
    """Orchestrates the 5-stage resume parsing pipeline."""

    async def parse_resume(self, text_content: str) -> dict:
        """Run the full pipeline and return a flat dict for the rest of the app.

        The dict keys match what portal.py and the matching agent expect:
          skills, experience, education, summary, confidence_scores,
          overall_confidence, parsing_method, personal_info, projects,
          certifications, awards, publications, languages, additional_work,
          interests, skills_breakdown, text_quality, validation_warnings
        """
        # ── Stage 2: Clean ───────────────────────────────────────────────
        from app.services.text_cleaner import clean_text
        cleaned, quality = clean_text(text_content)

        if quality < 0.15:
            logger.warning("Very low text quality (%.2f) — OCR may have failed", quality)

        # Use original text as fallback if cleaner wiped too much
        working_text = cleaned if len(cleaned) > 100 else text_content

        # ── Stage 3: LLM extraction ──────────────────────────────────────
        raw_parsed: Optional[dict] = None
        method = "rule_based"

        if settings.OPENAI_API_KEY:
            try:
                raw_parsed = await self._extract_with_llm(working_text)
                if raw_parsed:
                    method = "llm"
            except Exception as exc:
                logger.warning("LLM extraction failed (%s), falling back to rules", exc)

        if not raw_parsed:
            raw_parsed = self._extract_with_rules(working_text)

        # ── Stage 4 & 5: Validate + Schema ──────────────────────────────
        from app.schemas.resume_schema import validate_parsed
        result = validate_parsed(raw_parsed, text_quality=quality, parsing_method=method)
        resume = result.resume

        if result.errors:
            logger.warning("Validation errors: %s", result.errors)

        # ── Build confidence scores ───────────────────────────────────────
        conf_skills = min(1.0, len(resume.flat_skills()) * 0.05) if resume.flat_skills() else 0.3
        conf_exp    = 0.9 if resume.experience else 0.4
        conf_edu    = 0.9 if resume.education  else 0.4

        if method == "rule_based":
            conf_skills *= 0.7
            conf_exp    *= 0.6
            conf_edu    *= 0.7

        overall = round((conf_skills + conf_exp + conf_edu) / 3, 2)

        # ── Return flat dict compatible with the rest of the app ─────────
        return {
            # Core fields used by portal.py and matching engine
            "skills":               resume.flat_skills(),
            "experience":           resume.experience_for_matching(),
            "education":            resume.education_for_matching(),
            "summary":              resume.summary or "",
            "confidence_scores":    {
                "skills":     round(conf_skills, 2),
                "experience": round(conf_exp, 2),
                "education":  round(conf_edu, 2),
            },
            "overall_confidence":   overall,
            "parsing_method":       method,
            # Enriched fields stored in metadata_json
            "personal_info":        resume.personal_info.model_dump(),
            "projects":             [p.model_dump() for p in resume.projects],
            "certifications":       [c.model_dump() for c in resume.certifications],
            "awards":               [a.model_dump() for a in resume.awards],
            "publications":         [p.model_dump() for p in resume.publications],
            "languages":            [l.model_dump() for l in resume.languages],
            "additional_work":      [w.model_dump() for w in resume.additional_work],
            "interests":            resume.interests,
            "skills_breakdown":     resume.skills.model_dump(),
            # Pipeline diagnostics
            "text_quality":         quality,
            "validation_warnings":  result.warnings + result.errors,
        }

    # -----------------------------------------------------------------------
    # Stage 3a: LLM extraction
    # -----------------------------------------------------------------------

    async def _extract_with_llm(self, text: str) -> Optional[dict]:
        """Extract resume data using Claude Opus 4.7 (primary) → GPT-4o (fallback)."""
        from app.services.llm_client import call_llm_json, LLMTier

        raw = await call_llm_json(
            system=SYSTEM_PROMPT,
            user=f"Extract all candidate data:\n\n{text[:6000]}",
            tier=LLMTier.PRIMARY,
            max_tokens=3000,
            temperature=0.1,
        )

        # Basic sanity: must have at least one non-empty section
        if not any([
            raw.get("skills"),
            raw.get("experience"),
            raw.get("education"),
            raw.get("summary"),
        ]):
            return None

        return raw

    # -----------------------------------------------------------------------
    # Stage 3b: Rule-based fallback
    # -----------------------------------------------------------------------

    COMMON_SKILLS = [
        "python", "javascript", "typescript", "java", "c++", "c#", "go", "rust", "ruby", "php", "swift", "kotlin",
        "react", "angular", "vue", "node.js", "express", "django", "flask", "fastapi", "spring boot", "laravel",
        "sql", "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "firebase",
        "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "jenkins", "ci/cd", "devops",
        "git", "github", "gitlab", "agile", "scrum",
        "machine learning", "deep learning", "nlp", "data science", "ai", "tensorflow", "pytorch",
        "html", "css", "tailwind", "bootstrap", "rest", "graphql", "microservices",
        "linux", "networking", "security", "blockchain", "web3",
        "figma", "adobe xd", "ui/ux", "tableau", "power bi",
        "excel", "powerpoint", "google sheets", "salesforce", "sap",
        "flutter", "react native", "ios", "android",
        "photoshop", "premiere pro", "after effects", "illustrator", "canva",
        "teaching", "training", "coaching", "mentoring", "curriculum design",
        "nursing", "patient care", "clinical", "medical records",
        "accounting", "bookkeeping", "financial analysis", "budgeting", "audit",
        "digital marketing", "seo", "sem", "google ads", "social media marketing",
        "content marketing", "copywriting", "email marketing",
        "recruitment", "talent acquisition", "hr analytics", "payroll",
        "mechanical engineering", "electrical engineering", "civil engineering",
        "autocad", "solidworks", "matlab", "plc",
        "logistics", "supply chain", "procurement", "inventory management",
        "leadership", "communication", "teamwork", "problem solving", "critical thinking",
        "time management", "adaptability", "creativity", "negotiation", "project management",
    ]

    DEGREE_MAP = {
        "phd": "PhD", "doctorate": "PhD", "doctor": "PhD",
        "master": "Master's", "mba": "MBA",
        "bachelor": "Bachelor's", "associate": "Associate's",
        "diploma": "Diploma", "certificate": "Certificate",
    }

    def _extract_with_rules(self, text: str) -> dict:
        text_lower = text.lower()

        # Skills
        found = []
        for s in self.COMMON_SKILLS:
            if s.lower() in text_lower:
                found.append(s.title() if len(s) > 3 else s.upper())

        # Education
        edu_patterns = [
            r"(?i)(bachelor|b\.?s\.?|b\.?a\.?|b\.?sc\.?|b\.?e\.?|b\.?tech)",
            r"(?i)(master|m\.?s\.?|m\.?a\.?|m\.?sc\.?|m\.?e\.?|m\.?tech|mba)",
            r"(?i)(ph\.?d\.?|doctorate)", r"(?i)(diploma|certificate)",
        ]
        edu_entries, seen_edu = [], set()
        for pat in edu_patterns:
            for m in re.finditer(pat, text):
                deg_text = m.group().lower()
                level = "Bachelor's"
                for key, val in self.DEGREE_MAP.items():
                    if key in deg_text:
                        level = val
                        break
                ctx = text[max(0, m.start()-20): m.end()+120]
                field = self._infer_field(ctx)
                key = f"{level}_{field}"
                if key not in seen_edu:
                    seen_edu.add(key)
                    edu_entries.append({
                        "institution": None, "degree": level,
                        "field": field, "start_date": None, "end_date": None, "grade": None,
                    })

        # Experience years
        exp_entries = []
        yrs = re.findall(r"(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience)?", text_lower)
        if yrs:
            exp_entries.append({
                "company": None, "role": None,
                "start_date": None, "end_date": None,
                "responsibilities": [], "technologies": [],
                "description": f"{max(int(y) for y in yrs)} years of experience",
            })

        # Email
        emails = re.findall(r"[\w.+-]+@[\w-]+\.[\w.-]+", text)

        summary = f"Candidate with {len(found)} identified skills"
        if exp_entries:
            summary += f" and approximately {exp_entries[0]['description']}"
        if edu_entries:
            summary += f". Education: {edu_entries[0]['degree']}"
        summary += "."

        return {
            "personal_info": {
                "full_name": None, "email": emails[0] if emails else None,
                "phone": None, "location": None, "linkedin": None, "portfolio": None,
            },
            "summary": summary,
            "education": edu_entries[:3],
            "experience": exp_entries,
            "projects": [],
            "skills": {"technical": found[:20], "soft": [], "tools": []},
            "languages": [], "certifications": [], "awards": [],
            "publications": [], "additional_work": [], "interests": [],
        }

    def _infer_field(self, ctx: str) -> Optional[str]:
        fields = [
            "computer science", "software engineering", "information technology",
            "electrical engineering", "mechanical engineering", "data science",
            "mathematics", "physics", "business administration", "economics",
            "marketing", "finance", "accounting", "human resources",
            "psychology", "communications", "biology", "chemistry",
        ]
        ctx_lower = ctx.lower()
        for f in fields:
            if f in ctx_lower:
                return f.title()
        return None
