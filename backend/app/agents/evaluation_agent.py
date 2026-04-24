"""
Interview Evaluation Agent - Processes interview notes and generates
structured evaluation with rubric scoring.

Rules:
- human_decision_required is ALWAYS True
- This is a SUMMARY to assist decision-making, not a replacement for human judgment
"""
import json
import random
from typing import Optional

from app.core.config import settings


class EvaluationAgent:
    """Evaluates interview performance using rubric-based scoring."""

    RUBRIC_CRITERIA = {
        "technical_skills": {
            "1": "No relevant technical knowledge demonstrated",
            "2": "Basic understanding with significant gaps",
            "3": "Competent with some areas for improvement",
            "4": "Strong technical skills with minor gaps",
            "5": "Exceptional technical expertise",
        },
        "problem_solving": {
            "1": "Unable to approach problems systematically",
            "2": "Basic problem-solving with guidance needed",
            "3": "Adequate problem-solving abilities",
            "4": "Strong analytical and creative problem-solving",
            "5": "Exceptional problem-solving methodology",
        },
        "communication": {
            "1": "Difficulty expressing ideas clearly",
            "2": "Basic communication with room for improvement",
            "3": "Clear and adequate communication",
            "4": "Strong communication and articulation",
            "5": "Exceptional communication and presentation skills",
        },
        "cultural_fit": {
            "1": "Significant misalignment with company values",
            "2": "Some alignment with potential concerns",
            "3": "Adequate alignment with company culture",
            "4": "Strong alignment with company values",
            "5": "Exceptional cultural fit and values alignment",
        },
    }

    async def evaluate_interview(
        self, notes: str, job_requirements: dict = None
    ) -> dict:
        """Evaluate interview based on notes and job requirements.

        Returns structured evaluation with scores, strengths, and recommendation.
        """
        if settings.OPENAI_API_KEY:
            try:
                return await self._evaluate_with_llm(notes, job_requirements)
            except Exception:
                pass

        return await self._evaluate_with_rules(notes, job_requirements)

    async def _evaluate_with_llm(
        self, notes: str, job_requirements: Optional[dict]
    ) -> dict:
        """LLM-based interview evaluation."""
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        requirements_text = ""
        if job_requirements:
            requirements_text = f"\nJob Requirements: {json.dumps(job_requirements)}"

        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": f"""You are an interview evaluation assistant. Analyze interview notes and provide structured scoring.

Score each criterion on a 1-5 scale:
- technical_skills
- problem_solving
- communication
- cultural_fit

Return JSON with:
- ai_summary: 2-3 sentence summary
- structured_scores: object with scores for each criterion
- strengths: array of 2-3 key strengths
- areas_for_improvement: array of 1-2 areas
- ai_recommendation: "proceed" | "second_interview" | "not_proceed"

IMPORTANT: This is a recommendation only. Human judgment is required.{requirements_text}""",
                },
                {"role": "user", "content": f"Interview notes:\n\n{notes[:3000]}"},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
            max_tokens=1000,
        )

        result = json.loads(response.choices[0].message.content)
        result["human_decision_required"] = True  # ALWAYS True
        return result

    async def _evaluate_with_rules(
        self, notes: str, job_requirements: Optional[dict]
    ) -> dict:
        """Rule-based interview evaluation for demo/fallback."""
        notes_lower = notes.lower()

        # Score based on keyword analysis
        positive_keywords = [
            "strong", "excellent", "impressive", "solid", "great",
            "well-prepared", "articulate", "clear", "innovative", "leader",
        ]
        negative_keywords = [
            "weak", "poor", "struggled", "confused", "unclear",
            "unprepared", "lacking", "insufficient", "concerns",
        ]

        positive_count = sum(1 for kw in positive_keywords if kw in notes_lower)
        negative_count = sum(1 for kw in negative_keywords if kw in notes_lower)

        # Calculate base score (2.5-4.5 range)
        base = 3.0 + (positive_count * 0.3) - (negative_count * 0.4)
        base = max(1.5, min(4.5, base))

        structured_scores = {
            "technical_skills": round(base + random.uniform(-0.5, 0.5), 1),
            "problem_solving": round(base + random.uniform(-0.5, 0.5), 1),
            "communication": round(base + random.uniform(-0.3, 0.5), 1),
            "cultural_fit": round(base + random.uniform(-0.3, 0.3), 1),
        }

        # Clamp scores to 1-5
        for key in structured_scores:
            structured_scores[key] = max(1.0, min(5.0, structured_scores[key]))

        avg_score = sum(structured_scores.values()) / len(structured_scores)

        # Determine recommendation
        if avg_score >= 3.8:
            recommendation = "proceed"
        elif avg_score >= 2.8:
            recommendation = "second_interview"
        else:
            recommendation = "not_proceed"

        # Generate strengths and improvements
        strengths = []
        improvements = []

        if structured_scores["technical_skills"] >= 3.5:
            strengths.append("Solid technical foundation")
        else:
            improvements.append("Technical depth could be strengthened")

        if structured_scores["communication"] >= 3.5:
            strengths.append("Clear and effective communication")
        else:
            improvements.append("Communication clarity could improve")

        if structured_scores["problem_solving"] >= 3.5:
            strengths.append("Good problem-solving approach")

        if structured_scores["cultural_fit"] >= 3.5:
            strengths.append("Strong cultural alignment")

        if not strengths:
            strengths.append("Shows potential for growth")

        return {
            "ai_summary": f"Candidate demonstrated {'strong' if avg_score >= 3.5 else 'adequate'} "
            f"overall performance across evaluation criteria. "
            f"Average score: {avg_score:.1f}/5.0. "
            f"{'Recommended to proceed.' if recommendation == 'proceed' else 'Further evaluation suggested.'}",
            "structured_scores": structured_scores,
            "strengths": strengths[:3],
            "areas_for_improvement": improvements[:2] if improvements else ["Continue developing domain expertise"],
            "ai_recommendation": recommendation,
            "human_decision_required": True,  # ALWAYS True
            "_disclaimer": "This is a SUMMARY to assist decision-making. Human judgment is required for the final decision.",
        }
