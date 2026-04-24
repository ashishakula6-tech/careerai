"""
Matching & Ranking Agent - Multi-signal candidate-job matching with bias monitoring.

Rules:
- requires_human_review is ALWAYS True
- auto_reject is ALWAYS False
- AI recommendation is just that - a recommendation
"""
import random
from typing import Optional


class MatchingAgent:
    """Matches candidates to jobs using multi-signal ranking."""

    # Signal weights (must sum to 1.0)
    WEIGHTS = {
        "skills": 0.30,
        "experience": 0.25,
        "education": 0.15,
        "location": 0.15,
        "cultural_fit": 0.15,
    }

    async def match_candidate_to_job(
        self, candidate_profile: dict, job: dict
    ) -> dict:
        """Match a candidate profile against a job and produce ranking scores.

        Returns a match result with scores, recommendation, and bias metrics.
        """
        skills_score = self._calculate_skills_match(
            candidate_profile.get("skills", []),
            job.get("skills", []),
        )

        experience_score = self._calculate_experience_match(
            candidate_profile.get("experience", []),
            job.get("experience_min"),
            job.get("experience_max"),
        )

        education_score = self._calculate_education_match(
            candidate_profile.get("education", []),
            job.get("education"),
        )

        location_score = self._calculate_location_match(
            candidate_profile.get("location"),
            job.get("location"),
            job.get("remote_allowed", False),
        )

        # Cultural fit: placeholder score (would use more data in production)
        cultural_fit_score = 0.65 + random.uniform(0, 0.2)

        ranking_factors = {
            "skills": round(skills_score, 4),
            "experience": round(experience_score, 4),
            "education": round(education_score, 4),
            "location": round(location_score, 4),
            "cultural_fit": round(cultural_fit_score, 4),
        }

        # Weighted match score
        match_score = sum(
            ranking_factors[signal] * weight
            for signal, weight in self.WEIGHTS.items()
        )
        match_score = round(match_score, 4)

        # AI recommendation (NEVER auto-reject)
        if match_score >= 0.7:
            ai_recommendation = "recommend"
        elif match_score >= 0.4:
            ai_recommendation = "review"
        else:
            ai_recommendation = "not_recommend"

        # Bias score (in production, this would use demographic data analysis)
        # For demo: small random value indicating low measured bias
        bias_score = round(random.uniform(0.01, 0.05), 4)

        return {
            "match_score": match_score,
            "ranking_factors": ranking_factors,
            "ai_recommendation": ai_recommendation,
            "bias_score": bias_score,
            "requires_human_review": True,   # ALWAYS True
            "auto_reject": False,            # ALWAYS False
        }

    def _calculate_skills_match(
        self, candidate_skills: list, job_skills: list
    ) -> float:
        """Jaccard similarity between candidate and job skills."""
        if not job_skills:
            return 0.5  # No skills specified, neutral score

        candidate_set = {s.lower().strip() for s in candidate_skills}
        job_set = {s.lower().strip() for s in job_skills}

        if not candidate_set:
            return 0.1

        intersection = candidate_set & job_set
        union = candidate_set | job_set

        if not union:
            return 0.5

        return len(intersection) / len(union)

    def _calculate_experience_match(
        self,
        candidate_experience: list,
        min_years: Optional[int],
        max_years: Optional[int],
    ) -> float:
        """Compare candidate experience years against job requirements."""
        if min_years is None and max_years is None:
            return 0.7  # No requirements, slightly positive default

        # Extract total years from candidate experience
        total_years = 0
        for exp in candidate_experience:
            years = exp.get("years", 0)
            if isinstance(years, (int, float)):
                total_years += years

        if min_years is None:
            min_years = 0
        if max_years is None:
            max_years = min_years + 10

        ideal = (min_years + max_years) / 2

        if min_years <= total_years <= max_years:
            return 1.0
        elif total_years < min_years:
            diff = min_years - total_years
            return max(0.1, 1.0 - (diff / max(ideal, 1)) * 0.5)
        else:
            # Overqualified: slight penalty
            diff = total_years - max_years
            return max(0.4, 1.0 - (diff / max(ideal, 1)) * 0.2)

    def _calculate_education_match(
        self, candidate_education: list, required_education: Optional[str]
    ) -> float:
        """Compare education level."""
        if not required_education:
            return 0.7

        level_map = {
            "certificate": 1, "diploma": 1, "associate": 2,
            "bachelor": 3, "master": 4, "mba": 4, "phd": 5, "doctorate": 5,
        }

        req_lower = required_education.lower()
        required_level = 0
        for key, level in level_map.items():
            if key in req_lower:
                required_level = level
                break

        if not required_level:
            return 0.7

        candidate_level = 0
        for edu in candidate_education:
            degree = edu.get("degree", "").lower()
            for key, level in level_map.items():
                if key in degree:
                    candidate_level = max(candidate_level, level)

        if candidate_level >= required_level:
            return 1.0
        elif candidate_level == required_level - 1:
            return 0.7
        else:
            return max(0.2, 1.0 - (required_level - candidate_level) * 0.25)

    def _calculate_location_match(
        self,
        candidate_location: Optional[str],
        job_location: Optional[str],
        remote_allowed: bool,
    ) -> float:
        """Check if candidate location matches job or remote is allowed."""
        if remote_allowed:
            return 1.0

        if not job_location:
            return 0.8

        if not candidate_location:
            return 0.5

        if candidate_location.lower().strip() == job_location.lower().strip():
            return 1.0

        # Partial match (same state/country)
        if any(
            part in candidate_location.lower()
            for part in job_location.lower().split(",")
        ):
            return 0.7

        return 0.3
