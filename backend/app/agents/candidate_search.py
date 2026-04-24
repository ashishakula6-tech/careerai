"""
AI Candidate Search — Lets recruiters search using natural language.

Examples:
  "Python developers with 5+ years in Bangalore"
  "Frontend engineers who passed the AI interview"
  "Candidates with React and AWS skills, shortlisted"
  "Machine learning engineers with Masters degree"
  "All rejected candidates from Dubai"

Parses the query into structured filters, then searches the database.
If OpenAI is configured, uses LLM to parse complex queries.
Otherwise uses keyword-based parsing.
"""
import re
import json
from typing import Optional, List

from app.core.config import settings


class CandidateSearchAgent:
    """Parses natural language recruiter queries into structured candidate search filters."""

    # Skill keywords to detect
    KNOWN_SKILLS = [
        "python", "javascript", "typescript", "java", "c++", "c#", "go", "rust", "ruby", "php",
        "swift", "kotlin", "dart", "flutter", "react", "angular", "vue", "node.js", "next.js",
        "django", "flask", "fastapi", "spring", "laravel", "rails",
        "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "jenkins",
        "sql", "postgresql", "mysql", "mongodb", "redis", "elasticsearch",
        "machine learning", "deep learning", "nlp", "tensorflow", "pytorch",
        "html", "css", "tailwind", "figma", "photoshop",
        "git", "ci/cd", "agile", "scrum", "jira",
        "linux", "networking", "security", "devops", "microservices",
        "blockchain", "solidity", "web3", "unity", "unreal",
        "data science", "data engineering", "data analysis",
        "salesforce", "sap", "oracle", "erp",
        "react native", "ios", "android",
        ".net", "system design", "api", "rest", "graphql",
    ]

    # Location keywords
    KNOWN_LOCATIONS = [
        "bangalore", "hyderabad", "mumbai", "pune", "chennai", "delhi", "noida", "gurgaon",
        "kolkata", "ahmedabad", "jaipur", "kochi", "indore", "coimbatore",
        "dubai", "abu dhabi", "sharjah", "riyadh", "doha",
        "san francisco", "new york", "seattle", "austin", "boston", "chicago", "los angeles",
        "london", "berlin", "amsterdam", "paris", "dublin", "barcelona", "stockholm", "munich",
        "singapore", "tokyo", "sydney", "toronto", "vancouver",
        "remote", "india", "usa", "uk", "europe", "uae", "germany", "canada", "australia",
    ]

    # Status keywords
    STATUS_MAP = {
        "new": "new", "applied": "new", "fresh": "new",
        "parsed": "parsed",
        "matched": "matched",
        "shortlisted": "shortlisted", "shortlist": "shortlisted",
        "rejected": "rejected", "reject": "rejected", "failed": "rejected",
        "interviewing": "interviewing", "interview": "interviewing",
        "passed": "interview_passed", "interview passed": "interview_passed", "hired": "interview_passed",
    }

    async def parse_query(self, query: str) -> dict:
        """Parse a natural language query into structured search filters."""
        if settings.OPENAI_API_KEY:
            try:
                return await self._parse_with_llm(query)
            except Exception:
                pass
        return self._parse_with_rules(query)

    def _parse_with_rules(self, query: str) -> dict:
        """Rule-based query parsing."""
        q = query.lower().strip()
        filters = {
            "skills": [],
            "location": None,
            "status": None,
            "experience_min": None,
            "experience_max": None,
            "education": None,
            "keyword": None,
        }

        # Extract skills
        for skill in self.KNOWN_SKILLS:
            if skill in q:
                filters["skills"].append(skill)

        # Extract location
        for loc in self.KNOWN_LOCATIONS:
            if loc in q:
                filters["location"] = loc
                break

        # Extract status
        for keyword, status in self.STATUS_MAP.items():
            if keyword in q:
                filters["status"] = status
                break

        # Extract experience years
        # Patterns: "5+ years", "5 years", "3-5 years", "at least 5 years", "minimum 3 years"
        exp_match = re.search(r'(\d+)\+?\s*(?:years?|yrs?)', q)
        if exp_match:
            years = int(exp_match.group(1))
            if '+' in exp_match.group(0) or 'at least' in q or 'minimum' in q or 'min' in q:
                filters["experience_min"] = years
            else:
                filters["experience_min"] = max(0, years - 1)
                filters["experience_max"] = years + 2

        range_match = re.search(r'(\d+)\s*-\s*(\d+)\s*(?:years?|yrs?)', q)
        if range_match:
            filters["experience_min"] = int(range_match.group(1))
            filters["experience_max"] = int(range_match.group(2))

        # Extract education
        edu_keywords = {
            "phd": "PhD", "doctorate": "PhD",
            "masters": "Master's", "master's": "Master's", "msc": "Master's", "mba": "MBA",
            "bachelor": "Bachelor's", "btech": "Bachelor's", "bsc": "Bachelor's", "degree": "Bachelor's",
        }
        for kw, edu in edu_keywords.items():
            if kw in q:
                filters["education"] = edu
                break

        # Remaining words as keyword search (use word-level removal, not char-level)
        words = q.split()
        stop_words = {"with", "who", "has", "have", "in", "from", "and", "or", "the", "a", "an",
                      "find", "search", "show", "get", "me", "all", "candidates", "developers",
                      "engineers", "engineer", "developer", "at", "least", "minimum", "years",
                      "year", "experience", "for", "senior", "junior", "mid", "level"}
        remaining_words = []
        for w in words:
            w_clean = w.strip(".,!?+")
            if w_clean in stop_words:
                continue
            if w_clean in [s.lower() for s in filters["skills"]]:
                continue
            if filters["location"] and w_clean in filters["location"].lower().split():
                continue
            if w_clean.isdigit():
                continue
            if len(w_clean) <= 1:
                continue
            remaining_words.append(w_clean)
        remaining = " ".join(remaining_words).strip()
        if remaining and len(remaining) > 2:
            filters["keyword"] = remaining

        return filters

    async def _parse_with_llm(self, query: str) -> dict:
        """LLM-based query parsing for complex natural language."""
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": """Parse the recruiter's search query into structured filters.
Return JSON with:
- skills: array of skill strings (lowercase)
- location: string or null (city/country)
- status: one of "new","parsed","matched","shortlisted","rejected","interviewing","interview_passed" or null
- experience_min: integer or null
- experience_max: integer or null
- education: "PhD","Master's","MBA","Bachelor's" or null
- keyword: any remaining search terms as string, or null"""
                },
                {"role": "user", "content": query},
            ],
            response_format={"type": "json_object"},
            temperature=0,
            max_tokens=300,
        )
        return json.loads(response.choices[0].message.content)
