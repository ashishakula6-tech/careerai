"""
Resume Parsing Agent - Extracts structured data from resumes using LLM with
rule-based fallback. Confidence scores are provided for each section.

If LLM confidence < 0.6, falls back to rule-based parsing.
"""
import re
import json
from typing import Optional

from app.core.config import settings


class ResumeParserAgent:
    """Parses resumes into structured candidate profiles."""

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
        # Photography / Videography / Creative
        "photography", "videography", "photo editing", "lightroom", "photoshop", "premiere pro",
        "after effects", "final cut pro", "davinci resolve", "camera operation", "lighting",
        "color grading", "retouching", "portrait photography", "wedding photography", "product photography",
        "drone photography", "film making", "video editing", "motion graphics", "animation",
        "3d modeling", "blender", "maya", "cinema 4d", "illustrator", "indesign", "canva",
        "graphic design", "branding", "logo design", "typography", "print design", "packaging design",
        # Teaching / Education / Training
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
        # Marketing / Sales / PR
        "digital marketing", "seo", "sem", "google ads", "facebook ads", "social media marketing",
        "content marketing", "email marketing", "copywriting", "content writing", "blogging",
        "brand management", "pr", "public relations", "event management", "event planning",
        "market research", "analytics", "google analytics", "a/b testing", "conversion optimization",
        "sales", "cold calling", "lead generation", "negotiation", "crm", "pipeline management",
        "customer service", "customer success", "account management", "client relations",
        # HR / Recruitment / Admin
        "recruitment", "talent acquisition", "interviewing", "onboarding", "employee relations",
        "performance management", "compensation", "benefits", "payroll", "hr analytics",
        "workday", "bamboohr", "successfactors", "peoplesoft",
        "office administration", "scheduling", "data entry", "filing", "records management",
        "receptionist", "executive assistant", "virtual assistant",
        # Legal
        "legal research", "contract drafting", "litigation", "corporate law", "intellectual property",
        "compliance", "regulatory", "legal writing", "paralegal", "notary",
        # Engineering / Manufacturing / Construction
        "mechanical engineering", "electrical engineering", "civil engineering", "chemical engineering",
        "autocad", "solidworks", "catia", "ansys", "matlab", "plc", "scada",
        "quality control", "quality assurance", "six sigma", "lean manufacturing",
        "project planning", "construction management", "site supervision", "safety management",
        "welding", "cnc", "machining", "fabrication", "assembly",
        # Hospitality / Food / Travel
        "hotel management", "front desk", "housekeeping", "concierge", "reservation",
        "restaurant management", "food service", "cooking", "chef", "baking", "pastry",
        "bartending", "catering", "food safety", "haccp",
        "travel planning", "tour guide", "tourism", "airline", "ticketing",
        # Fitness / Sports / Wellness
        "personal training", "fitness coaching", "yoga", "pilates", "nutrition coaching",
        "sports coaching", "athletics", "swimming", "martial arts",
        "massage therapy", "spa management", "wellness", "meditation",
        # Real Estate / Property
        "real estate", "property management", "leasing", "valuation", "mortgage",
        "interior design", "space planning", "architecture", "urban planning",
        # Logistics / Supply Chain / Warehouse
        "logistics", "supply chain", "inventory management", "warehouse management",
        "procurement", "vendor management", "shipping", "freight", "customs",
        "fleet management", "route planning", "last mile delivery",
        # Agriculture / Environment
        "agriculture", "farming", "horticulture", "organic farming",
        "environmental science", "sustainability", "renewable energy", "solar", "wind energy",
        "waste management", "recycling", "conservation",
        # Media / Journalism / Writing
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
        "phd": "PhD",
        "doctorate": "PhD",
        "doctor": "PhD",
        "master": "Master's",
        "mba": "MBA",
        "bachelor": "Bachelor's",
        "associate": "Associate's",
        "diploma": "Diploma",
        "certificate": "Certificate",
    }

    async def parse_resume(self, text_content: str) -> dict:
        """Parse resume text into structured data.

        First attempts LLM parsing. If confidence is below threshold,
        falls back to rule-based parsing.
        """
        # Try LLM parsing if API key is available
        if settings.OPENAI_API_KEY:
            try:
                llm_result = await self._parse_with_llm(text_content)
                if llm_result and llm_result.get("overall_confidence", 0) >= settings.CONFIDENCE_THRESHOLD:
                    return llm_result
            except Exception:
                pass  # Fall through to rule-based

        # Rule-based fallback
        return await self._parse_with_rules(text_content)

    async def _parse_with_llm(self, text_content: str) -> Optional[dict]:
        """Parse resume using OpenAI LLM."""
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": """You are a resume parsing assistant. Extract structured data from the resume text.
Return a JSON object with these fields:
- skills: array of skill strings
- experience: array of objects with {company, role, years, description}
- education: array of objects with {degree, field, university, year}
- summary: brief professional summary (2-3 sentences)
- confidence_scores: object with {skills: 0-1, experience: 0-1, education: 0-1}

Be accurate and conservative with confidence scores.""",
                    },
                    {"role": "user", "content": f"Parse this resume:\n\n{text_content[:4000]}"},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=2000,
            )

            parsed = json.loads(response.choices[0].message.content)

            confidence_scores = parsed.get("confidence_scores", {})
            overall = sum(confidence_scores.values()) / max(len(confidence_scores), 1)

            return {
                "skills": parsed.get("skills", []),
                "experience": parsed.get("experience", []),
                "education": parsed.get("education", []),
                "summary": parsed.get("summary", ""),
                "confidence_scores": confidence_scores,
                "overall_confidence": round(overall, 2),
                "parsing_method": "llm",
            }
        except Exception:
            return None

    async def _parse_with_rules(self, text_content: str) -> dict:
        """Rule-based resume parsing as fallback."""
        text_lower = text_content.lower()

        # Extract skills
        found_skills = []
        for skill in self.COMMON_SKILLS:
            if skill.lower() in text_lower:
                found_skills.append(skill.title() if len(skill) > 3 else skill.upper())

        # Extract education
        education = []
        for pattern in self.EDUCATION_PATTERNS:
            matches = re.finditer(pattern, text_content)
            for match in matches:
                degree_text = match.group().lower()
                degree_level = "Bachelor's"
                for key, value in self.DEGREE_LEVELS.items():
                    if key in degree_text:
                        degree_level = value
                        break

                # Try to find field of study nearby
                context = text_content[max(0, match.start() - 20):match.end() + 100]
                field = self._extract_field_of_study(context)

                education.append({
                    "degree": degree_level,
                    "field": field or "Not specified",
                    "university": "Not extracted",
                    "year": None,
                })

        # Deduplicate education
        seen = set()
        unique_education = []
        for edu in education:
            key = f"{edu['degree']}_{edu['field']}"
            if key not in seen:
                seen.add(key)
                unique_education.append(edu)

        # Extract experience (years)
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

        # Extract emails for contact info
        emails = re.findall(r"[\w.+-]+@[\w-]+\.[\w.-]+", text_content)

        # Generate summary
        summary = f"Candidate with {len(found_skills)} identified skills"
        if experience:
            summary += f" and {experience[0]['years']} years of experience"
        if unique_education:
            summary += f". Education: {unique_education[0]['degree']}"
        summary += "."

        # Calculate confidence scores (rule-based is lower)
        skills_conf = min(0.7, len(found_skills) * 0.07)
        exp_conf = 0.5 if experience else 0.2
        edu_conf = 0.6 if unique_education else 0.2

        return {
            "skills": found_skills[:20],  # Cap at 20
            "experience": experience,
            "education": unique_education[:3],  # Cap at 3
            "summary": summary,
            "confidence_scores": {
                "skills": round(skills_conf, 2),
                "experience": round(exp_conf, 2),
                "education": round(edu_conf, 2),
            },
            "overall_confidence": round((skills_conf + exp_conf + edu_conf) / 3, 2),
            "parsing_method": "rule_based",
        }

    def _extract_field_of_study(self, context: str) -> Optional[str]:
        """Try to extract field of study from text near degree mention."""
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
