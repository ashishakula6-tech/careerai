"""
Resume Intelligence Engine — extracts, normalizes, and structures candidate data
from unstructured resume text into a clean, recruiter-ready format.

Uses a 5-phase LLM extraction pipeline (raw extract → structure → normalize →
validate → JSON output) with a rule-based fallback when the LLM is unavailable.
"""
import re
import json
from typing import Optional

from app.core.config import settings


SYSTEM_PROMPT = """ROLE (Act Like):
You are an advanced AI Resume Intelligence Engine designed for a Career AI platform. Your role is to extract, normalize, and structure candidate data from unstructured inputs (resume, profile text, portfolio, or uploaded documents) into a clean, recruiter-ready JSON format.

CONTEXT:
The system is part of a Career AI platform used by recruiters to evaluate candidates quickly. The extracted data will be stored in a database and displayed in recruiter dashboards. Accuracy, completeness, and structured formatting are critical.

TASKS:
1. Extract all relevant candidate information from the input.
2. Categorize the data into structured sections.
3. Normalize inconsistent formats (dates, skills, institutions).
4. Infer missing but obvious data when possible (without hallucination).
5. Maintain high precision — DO NOT fabricate unknown details.

DATA TO EXTRACT:
1. Personal Information: Full Name, Email, Phone Number, Location, LinkedIn / Portfolio URLs
2. Profile Summary: Short professional summary (2–4 lines), Career objective (if available)
3. Education (per entry): Institution Name, Degree, Field of Study, Start Date–End Date (YYYY-MM), Grade/CGPA if available
4. Experience (per job): Company Name, Role/Title, Duration (Start–End YYYY-MM), Responsibilities (bullet points), Technologies used
5. Projects (per project): Name, Description, Technologies used, Role, Outcome/Impact
6. Skills: Technical Skills, Soft Skills, Tools & Technologies
7. Languages: Language name, Proficiency level
8. Certifications / Publications / Awards: Title, Issuer/Org, Date, Description
9. Additional Work: Internships, Freelance, Volunteering, Hackathons, Leadership
10. Interests: Hobbies, Professional interests

REASONING RULES:
- Use context to group scattered information.
- Do not assume data not present in the text.
- Standardize date format: YYYY-MM
- Remove duplicates.
- Keep descriptions concise but meaningful.

PHASED EXECUTION:
Phase 1 — Raw Extraction: Extract all possible data without structuring.
Phase 2 — Structuring: Organize into defined categories.
Phase 3 — Normalization: Fix dates, standardize skills, remove duplicates.
Phase 4 — Validation: Ensure no empty critical fields, check consistency.
Phase 5 — Final JSON Output: Return only valid structured JSON.

OUTPUT FORMAT (STRICT JSON ONLY — no markdown, no commentary):
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
    {
      "institution": "",
      "degree": "",
      "field": "",
      "start_date": "",
      "end_date": "",
      "grade": ""
    }
  ],
  "experience": [
    {
      "company": "",
      "role": "",
      "start_date": "",
      "end_date": "",
      "responsibilities": [],
      "technologies": []
    }
  ],
  "projects": [
    {
      "name": "",
      "description": "",
      "technologies": [],
      "role": "",
      "outcome": ""
    }
  ],
  "skills": {
    "technical": [],
    "soft": [],
    "tools": []
  },
  "languages": [
    {"language": "", "proficiency": ""}
  ],
  "certifications": [
    {"title": "", "issuer": "", "date": "", "description": ""}
  ],
  "awards": [
    {"title": "", "issuer": "", "date": "", "description": ""}
  ],
  "publications": [
    {"title": "", "publisher": "", "date": "", "description": ""}
  ],
  "additional_work": [
    {"type": "", "organization": "", "role": "", "duration": "", "description": ""}
  ],
  "interests": []
}

STOPPING CONDITION:
- Output MUST be valid JSON.
- No explanations, no extra text, no markdown.
- If data is missing, return null or empty arrays.
- Stop immediately after JSON output."""


class ResumeParserAgent:
    """Parses resumes into structured candidate profiles using the Resume Intelligence Engine."""

    COMMON_SKILLS = [
        # Software / IT
        "python", "javascript", "typescript", "java", "c++", "c#", "go", "rust", "ruby", "php", "swift", "kotlin", "dart",
        "react", "angular", "vue", "node.js", "express", "django", "flask", "fastapi", "spring boot", "laravel", "rails",
        "sql", "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "firebase", "dynamodb",
        "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "jenkins", "ci/cd", "devops",
        "git", "github", "gitlab", "agile", "scrum", "jira", "confluence",
        "machine learning", "deep learning", "nlp", "data science", "ai", "tensorflow", "pytorch",
        "html", "css", "tailwind", "bootstrap", "rest", "graphql", "microservices", "api",
        "linux", "windows server", "networking", "security", "blockchain", "solidity", "web3",
        "figma", "sketch", "adobe xd", "ui/ux", "wireframing", "prototyping",
        "excel", "powerpoint", "word", "google sheets", "tableau", "power bi", "looker",
        "salesforce", "sap", "oracle", "erp", "crm", "hubspot", "zoho",
        "react native", "flutter", "ios", "android", "mobile",
        # Photography / Creative
        "photography", "videography", "photo editing", "lightroom", "photoshop", "premiere pro",
        "after effects", "final cut pro", "davinci resolve", "camera operation", "lighting",
        "color grading", "retouching", "portrait photography", "wedding photography", "product photography",
        "drone photography", "film making", "video editing", "motion graphics", "animation",
        "3d modeling", "blender", "maya", "cinema 4d", "illustrator", "indesign", "canva",
        "graphic design", "branding", "logo design", "typography", "print design",
        # Teaching / Education
        "teaching", "tutoring", "curriculum design", "lesson planning", "classroom management",
        "online teaching", "e-learning", "lms", "moodle", "canvas", "google classroom",
        "training", "corporate training", "coaching", "mentoring", "public speaking",
        "presentation skills", "workshop facilitation", "instructional design",
        "special education", "early childhood education", "stem education",
        "english teaching", "esl", "tefl", "ielts", "toefl",
        # Healthcare / Medical
        "nursing", "patient care", "clinical", "medical records", "ehr", "hipaa",
        "first aid", "cpr", "phlebotomy", "radiology", "pharmacy", "lab technician",
        "physiotherapy", "occupational therapy", "counseling", "psychology",
        "dental", "optometry", "veterinary", "nutrition", "dietetics",
        "medical coding", "medical billing", "health informatics",
        # Business / Finance / Accounting
        "accounting", "bookkeeping", "financial analysis", "budgeting", "forecasting",
        "taxation", "audit", "compliance", "risk management", "investment",
        "banking", "insurance", "financial planning", "portfolio management",
        "quickbooks", "tally", "xero", "sage", "sap fico",
        "business development", "strategy", "consulting", "market research",
        "business analysis", "requirements gathering", "stakeholder management",
        # Marketing / Sales
        "digital marketing", "seo", "sem", "google ads", "facebook ads", "social media marketing",
        "content marketing", "email marketing", "copywriting", "content writing", "blogging",
        "brand management", "pr", "public relations", "event management", "event planning",
        "google analytics", "a/b testing", "conversion optimization",
        "sales", "cold calling", "lead generation", "negotiation", "pipeline management",
        "customer service", "customer success", "account management", "client relations",
        # HR / Recruitment
        "recruitment", "talent acquisition", "interviewing", "onboarding", "employee relations",
        "performance management", "compensation", "benefits", "payroll", "hr analytics",
        "workday", "bamboohr", "successfactors", "peoplesoft",
        "office administration", "scheduling", "data entry", "records management",
        "receptionist", "executive assistant", "virtual assistant",
        # Legal
        "legal research", "contract drafting", "litigation", "corporate law", "intellectual property",
        "regulatory", "legal writing", "paralegal", "notary",
        # Engineering / Manufacturing
        "mechanical engineering", "electrical engineering", "civil engineering", "chemical engineering",
        "autocad", "solidworks", "catia", "ansys", "matlab", "plc", "scada",
        "quality control", "quality assurance", "six sigma", "lean manufacturing",
        "project planning", "construction management", "site supervision", "safety management",
        "welding", "cnc", "machining", "fabrication",
        # Hospitality / Food
        "hotel management", "front desk", "housekeeping", "concierge", "reservation",
        "restaurant management", "food service", "cooking", "chef", "baking", "pastry",
        "bartending", "catering", "food safety", "haccp",
        "travel planning", "tour guide", "tourism", "airline", "ticketing",
        # Fitness / Sports
        "personal training", "fitness coaching", "yoga", "pilates", "nutrition coaching",
        "sports coaching", "athletics", "swimming", "martial arts",
        "massage therapy", "spa management", "wellness", "meditation",
        # Real Estate
        "real estate", "property management", "leasing", "valuation", "mortgage",
        "interior design", "space planning", "architecture", "urban planning",
        # Logistics / Supply Chain
        "logistics", "supply chain", "inventory management", "warehouse management",
        "procurement", "vendor management", "shipping", "freight", "customs",
        "fleet management", "route planning", "last mile delivery",
        # Agriculture / Environment
        "agriculture", "farming", "horticulture", "organic farming",
        "environmental science", "sustainability", "renewable energy", "solar", "wind energy",
        "waste management", "recycling", "conservation",
        # Media / Writing
        "journalism", "reporting", "editing", "proofreading", "technical writing",
        "creative writing", "screenwriting", "podcast", "radio", "broadcasting",
        "translation", "interpretation", "localization",
        # Soft Skills
        "leadership", "communication", "teamwork", "problem solving", "critical thinking",
        "time management", "organization", "multitasking", "adaptability", "creativity",
        "negotiation", "conflict resolution", "decision making", "emotional intelligence",
        "project management", "team management", "people management",
    ]

    EDUCATION_PATTERNS = [
        r"(?i)(bachelor|b\.?s\.?|b\.?a\.?|b\.?sc\.?|b\.?e\.?|b\.?tech)",
        r"(?i)(master|m\.?s\.?|m\.?a\.?|m\.?sc\.?|m\.?e\.?|m\.?tech|mba)",
        r"(?i)(ph\.?d\.?|doctorate|doctor)",
        r"(?i)(associate|diploma|certificate)",
    ]

    DEGREE_LEVELS = {
        "phd": "PhD", "doctorate": "PhD", "doctor": "PhD",
        "master": "Master's", "mba": "MBA",
        "bachelor": "Bachelor's", "associate": "Associate's",
        "diploma": "Diploma", "certificate": "Certificate",
    }

    async def parse_resume(self, text_content: str) -> dict:
        """Parse resume text through the Resume Intelligence Engine.

        Attempts LLM-powered 5-phase extraction first; falls back to rule-based
        parsing if the LLM is unavailable or confidence is too low.
        """
        if settings.OPENAI_API_KEY:
            try:
                llm_result = await self._parse_with_llm(text_content)
                if llm_result and llm_result.get("overall_confidence", 0) >= settings.CONFIDENCE_THRESHOLD:
                    return llm_result
            except Exception:
                pass

        return await self._parse_with_rules(text_content)

    async def _parse_with_llm(self, text_content: str) -> Optional[dict]:
        """5-phase Resume Intelligence Engine extraction via LLM."""
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Extract all candidate data from this resume:\n\n{text_content[:6000]}"},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=3000,
            )

            raw = json.loads(response.choices[0].message.content)

            # --- Flatten skills for the matching engine ---
            skills_block = raw.get("skills", {})
            if isinstance(skills_block, dict):
                all_skills = (
                    skills_block.get("technical", []) +
                    skills_block.get("soft", []) +
                    skills_block.get("tools", [])
                )
            else:
                all_skills = skills_block if isinstance(skills_block, list) else []
            all_skills = list(dict.fromkeys(s for s in all_skills if s))  # deduplicate, preserve order

            # --- Normalise experience entries ---
            raw_exp = raw.get("experience", [])
            experience = []
            for e in (raw_exp or []):
                if not isinstance(e, dict):
                    continue
                years = _date_range_to_years(e.get("start_date"), e.get("end_date"))
                desc = ""
                responsibilities = e.get("responsibilities", [])
                if responsibilities:
                    desc = " | ".join(responsibilities[:5])
                experience.append({
                    "company": e.get("company") or "Not specified",
                    "role": e.get("role") or "Not specified",
                    "years": years,
                    "start_date": e.get("start_date") or "",
                    "end_date": e.get("end_date") or "",
                    "description": desc,
                    "technologies": e.get("technologies", []),
                })

            # --- Normalise education entries ---
            raw_edu = raw.get("education", [])
            education = []
            for edu in (raw_edu or []):
                if not isinstance(edu, dict):
                    continue
                education.append({
                    "degree": edu.get("degree") or "Not specified",
                    "field": edu.get("field") or "Not specified",
                    "university": edu.get("institution") or "Not specified",
                    "year": (edu.get("end_date") or "")[:4] or None,
                    "grade": edu.get("grade") or "",
                })

            # --- Confidence scoring ---
            conf_skills = min(1.0, len(all_skills) * 0.05) if all_skills else 0.3
            conf_exp = 0.9 if experience else 0.4
            conf_edu = 0.9 if education else 0.4
            overall = round((conf_skills + conf_exp + conf_edu) / 3, 2)

            # --- Personal info ---
            personal = raw.get("personal_info", {}) or {}

            return {
                # Fields used by the matching engine and profile storage
                "skills": all_skills,
                "experience": experience,
                "education": education,
                "summary": raw.get("summary") or "",
                "confidence_scores": {
                    "skills": round(conf_skills, 2),
                    "experience": round(conf_exp, 2),
                    "education": round(conf_edu, 2),
                },
                "overall_confidence": overall,
                "parsing_method": "llm",
                # Enriched fields stored in metadata / recruiter dashboard
                "personal_info": personal,
                "projects": raw.get("projects", []) or [],
                "certifications": raw.get("certifications", []) or [],
                "awards": raw.get("awards", []) or [],
                "publications": raw.get("publications", []) or [],
                "languages": raw.get("languages", []) or [],
                "additional_work": raw.get("additional_work", []) or [],
                "interests": raw.get("interests", []) or [],
                "skills_breakdown": {
                    "technical": skills_block.get("technical", []) if isinstance(skills_block, dict) else [],
                    "soft": skills_block.get("soft", []) if isinstance(skills_block, dict) else [],
                    "tools": skills_block.get("tools", []) if isinstance(skills_block, dict) else [],
                },
            }
        except Exception:
            return None

    async def _parse_with_rules(self, text_content: str) -> dict:
        """Rule-based resume parsing — used when LLM is unavailable."""
        text_lower = text_content.lower()

        # Skills
        found_skills = []
        for skill in self.COMMON_SKILLS:
            if skill.lower() in text_lower:
                found_skills.append(skill.title() if len(skill) > 3 else skill.upper())

        # Education
        education = []
        for pattern in self.EDUCATION_PATTERNS:
            for match in re.finditer(pattern, text_content):
                degree_text = match.group().lower()
                degree_level = "Bachelor's"
                for key, value in self.DEGREE_LEVELS.items():
                    if key in degree_text:
                        degree_level = value
                        break
                context = text_content[max(0, match.start() - 20):match.end() + 100]
                field = self._extract_field_of_study(context)
                education.append({
                    "degree": degree_level,
                    "field": field or "Not specified",
                    "university": "Not extracted",
                    "year": None,
                })

        seen = set()
        unique_education = []
        for edu in education:
            key = f"{edu['degree']}_{edu['field']}"
            if key not in seen:
                seen.add(key)
                unique_education.append(edu)

        # Experience
        experience = []
        year_patterns = re.findall(r"(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience)?", text_lower)
        if year_patterns:
            total_years = max(int(y) for y in year_patterns)
            experience.append({
                "company": "Not extracted",
                "role": "Not extracted",
                "years": total_years,
                "description": "Extracted from resume text",
            })

        summary = f"Candidate with {len(found_skills)} identified skills"
        if experience:
            summary += f" and {experience[0]['years']} years of experience"
        if unique_education:
            summary += f". Education: {unique_education[0]['degree']}"
        summary += "."

        skills_conf = min(0.7, len(found_skills) * 0.07)
        exp_conf = 0.5 if experience else 0.2
        edu_conf = 0.6 if unique_education else 0.2

        return {
            "skills": found_skills[:20],
            "experience": experience,
            "education": unique_education[:3],
            "summary": summary,
            "confidence_scores": {
                "skills": round(skills_conf, 2),
                "experience": round(exp_conf, 2),
                "education": round(edu_conf, 2),
            },
            "overall_confidence": round((skills_conf + exp_conf + edu_conf) / 3, 2),
            "parsing_method": "rule_based",
            "personal_info": {},
            "projects": [],
            "certifications": [],
            "awards": [],
            "publications": [],
            "languages": [],
            "additional_work": [],
            "interests": [],
            "skills_breakdown": {"technical": found_skills[:20], "soft": [], "tools": []},
        }

    def _extract_field_of_study(self, context: str) -> Optional[str]:
        fields = [
            "computer science", "software engineering", "information technology",
            "electrical engineering", "mechanical engineering", "data science",
            "mathematics", "physics", "business administration", "economics",
            "marketing", "finance", "accounting", "human resources",
            "psychology", "communications", "biology", "chemistry",
        ]
        context_lower = context.lower()
        for field in fields:
            if field in context_lower:
                return field.title()
        return None


def _date_range_to_years(start: Optional[str], end: Optional[str]) -> float:
    """Estimate years of experience from YYYY-MM date strings."""
    try:
        import datetime
        def parse_ym(s):
            if not s:
                return None
            parts = s.strip().split("-")
            year = int(parts[0])
            month = int(parts[1]) if len(parts) > 1 else 6
            return datetime.date(year, month, 1)

        s = parse_ym(start)
        e = parse_ym(end) if end and end.lower() not in ("present", "current", "now") else datetime.date.today()
        if s and e and e > s:
            return round((e - s).days / 365.25, 1)
    except Exception:
        pass
    return 0.0
