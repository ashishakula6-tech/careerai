"""
Video Pitch Evaluator — Analyzes candidate's video pitch transcript and scores:

1. Communication (clarity, structure, fluency) — 25%
2. Confidence (assertiveness, conviction, energy) — 20%
3. Technical Knowledge (mentions of relevant skills, tools, projects) — 30%
4. Relevance (how well the pitch connects to the specific job) — 25%

Pass threshold: 3.0 / 5.0 → auto-shortlist
Below threshold: rejected

Uses the transcript of what the candidate said (captured via browser speech recognition
during recording, or via OpenAI Whisper if available).
"""
import random
from typing import List, Optional
import json

from app.core.config import settings


class VideoPitchEvaluator:
    """Evaluates a candidate's video pitch based on transcript."""

    PASS_THRESHOLD = 3.0
    WEIGHTS = {
        "communication": 0.25,
        "confidence": 0.20,
        "technical_knowledge": 0.30,
        "relevance": 0.25,
    }

    async def evaluate(
        self,
        transcript: str,
        job_title: str,
        job_skills: List[str],
        job_description: str = "",
        candidate_name: str = "",
    ) -> dict:
        """Evaluate the video pitch transcript."""

        if settings.OPENAI_API_KEY:
            try:
                return await self._evaluate_with_llm(transcript, job_title, job_skills, job_description, candidate_name)
            except Exception:
                pass

        return self._evaluate_with_rules(transcript, job_title, job_skills, candidate_name)

    def _evaluate_with_rules(
        self, transcript: str, job_title: str, job_skills: List[str], candidate_name: str
    ) -> dict:
        """Rule-based pitch evaluation."""
        text = transcript.lower().strip()
        words = text.split()
        word_count = len(words)
        sentences = [s.strip() for s in transcript.replace("!", ".").replace("?", ".").split(".") if s.strip()]

        # ===== Communication =====
        comm_score = 2.5
        if word_count > 80:
            comm_score += 0.5
        if word_count > 150:
            comm_score += 0.3
        if len(sentences) >= 5:
            comm_score += 0.4  # Well structured
        avg_sentence_len = word_count / max(len(sentences), 1)
        if 8 < avg_sentence_len < 25:
            comm_score += 0.3  # Good sentence length
        # Filler words penalty
        fillers = sum(1 for w in words if w in ["um", "uh", "like", "you know", "basically", "actually", "so", "well"])
        if fillers > 5:
            comm_score -= 0.5
        comm_score = max(1.0, min(5.0, round(comm_score + random.uniform(-0.2, 0.2), 1)))

        # ===== Confidence =====
        conf_score = 2.5
        confidence_words = ["i am", "i have", "i can", "i will", "i believe", "i'm confident",
                           "my experience", "my expertise", "i led", "i built", "i designed",
                           "i managed", "i achieved", "passionate", "excited", "driven",
                           "strong background", "proven track"]
        conf_hits = sum(1 for phrase in confidence_words if phrase in text)
        conf_score += min(1.5, conf_hits * 0.25)
        if word_count < 30:
            conf_score -= 1.0  # Too short = low confidence
        conf_score = max(1.0, min(5.0, round(conf_score + random.uniform(-0.2, 0.2), 1)))

        # ===== Technical Knowledge =====
        tech_score = 2.0
        matched_skills = []
        for skill in job_skills:
            if skill.lower() in text:
                matched_skills.append(skill)
                tech_score += 0.4
        # Technical terms
        tech_terms = ["architecture", "scalable", "performance", "algorithm", "database",
                     "framework", "api", "deployment", "testing", "optimization", "pipeline",
                     "microservices", "cloud", "production", "infrastructure", "system design"]
        tech_hits = sum(1 for t in tech_terms if t in text)
        tech_score += min(1.0, tech_hits * 0.2)
        # Project mentions
        project_words = ["project", "built", "developed", "implemented", "created", "designed",
                        "launched", "deployed", "led", "managed", "contributed"]
        project_hits = sum(1 for p in project_words if p in text)
        tech_score += min(0.5, project_hits * 0.15)
        tech_score = max(1.0, min(5.0, round(tech_score + random.uniform(-0.2, 0.2), 1)))

        # ===== Relevance =====
        rel_score = 2.5
        # Mentions the job title or role
        if job_title.lower() in text or any(w in text for w in job_title.lower().split()):
            rel_score += 0.5
        # Mentions why they want this job
        why_words = ["because", "reason", "why i", "i want", "interested in", "passionate about",
                    "perfect fit", "right fit", "align", "match", "suitable", "ideal"]
        why_hits = sum(1 for w in why_words if w in text)
        rel_score += min(1.0, why_hits * 0.3)
        # Mentions company/team value
        team_words = ["team", "company", "culture", "mission", "value", "impact", "growth", "contribute"]
        team_hits = sum(1 for t in team_words if t in text)
        rel_score += min(0.5, team_hits * 0.2)
        rel_score = max(1.0, min(5.0, round(rel_score + random.uniform(-0.2, 0.2), 1)))

        # ===== Overall =====
        scores = {
            "communication": comm_score,
            "confidence": conf_score,
            "technical_knowledge": tech_score,
            "relevance": rel_score,
        }
        overall = round(sum(scores[k] * self.WEIGHTS[k] for k in scores), 2)
        passed = overall >= self.PASS_THRESHOLD

        # Generate feedback
        strengths = []
        improvements = []

        if comm_score >= 3.5:
            strengths.append("Clear and well-structured communication")
        else:
            improvements.append("Work on structuring your pitch more clearly with a beginning, middle, and end")

        if conf_score >= 3.5:
            strengths.append("Confident and assertive presentation")
        else:
            improvements.append("Show more confidence — use phrases like 'I have experience in...' and 'I successfully...'")

        if tech_score >= 3.5:
            strengths.append(f"Good technical knowledge — mentioned {len(matched_skills)} relevant skills")
        else:
            improvements.append(f"Mention more job-relevant skills ({', '.join(job_skills[:3])})")

        if rel_score >= 3.5:
            strengths.append("Well-connected pitch to the job requirements")
        else:
            improvements.append("Explain specifically why this role and this company appeal to you")

        if passed:
            summary = f"Strong video pitch! {candidate_name} demonstrated good communication and relevant technical knowledge. Score: {overall}/5.0 — auto-shortlisted for AI interview."
        else:
            summary = f"The video pitch did not meet the minimum threshold. Score: {overall}/5.0 (needed {self.PASS_THRESHOLD}). Candidate should strengthen their pitch content."

        return {
            "overall_score": overall,
            "max_score": 5.0,
            "pass_threshold": self.PASS_THRESHOLD,
            "passed": passed,
            "scores": scores,
            "weights": self.WEIGHTS,
            "matched_skills_mentioned": matched_skills,
            "word_count": word_count,
            "strengths": strengths[:3],
            "improvements": improvements[:3],
            "summary": summary,
        }

    async def _evaluate_with_llm(
        self, transcript: str, job_title: str, job_skills: List[str],
        job_description: str, candidate_name: str
    ) -> dict:
        """LLM-based video pitch evaluation — Claude Opus 4.7 primary, GPT-4o fallback."""
        from app.services.llm_client import call_llm_json, LLMTier

        result = await call_llm_json(
            system=f"""You are an expert talent evaluator at a leading recruitment platform.
Evaluate this video pitch transcript for a {job_title} position.
Required skills: {', '.join(job_skills)}

Score 1-5 on each dimension:
- communication (clarity, structure, fluency, articulation) weight 25%
- confidence (assertiveness, conviction, positive energy) weight 20%
- technical_knowledge (relevant skills, tools, projects actually mentioned) weight 30%
- relevance (how specifically connected to this role and company) weight 25%

Return JSON:
- overall_score: float (weighted average)
- max_score: 5.0
- pass_threshold: {self.PASS_THRESHOLD}
- passed: boolean (overall_score >= {self.PASS_THRESHOLD})
- scores: object with each criterion score
- matched_skills_mentioned: array of skills from the required list that were mentioned
- strengths: 2-3 specific strengths observed
- improvements: 1-2 concrete suggestions
- summary: 2 sentences of overall assessment""",
            user=f"Candidate: {candidate_name}\n\nTranscript:\n{transcript[:3000]}",
            tier=LLMTier.PRIMARY,
            max_tokens=1000,
            temperature=0.2,
        )
        result["weights"] = self.WEIGHTS
        return result
