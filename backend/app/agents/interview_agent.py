"""
AI Interview Agent - Generates role-specific interview questions and
evaluates candidate answers with structured scoring.

Flow:
1. Generate questions based on job skills + candidate profile
2. Candidate answers each question (text)
3. AI evaluates all answers → scores + pass/fail recommendation
4. If passed → candidate moves to "interview_passed" for human review
5. If failed → candidate can retry or status stays at "interviewing"

Rules:
- Questions are tailored to the job requirements
- Scoring is transparent with per-question breakdown
- Pass threshold: average score >= 3.0 out of 5.0
- Final hiring decision ALWAYS requires human approval
"""
import json
import random
from typing import List, Optional

from app.core.config import settings


# Question bank organized by skill category
QUESTION_BANK = {
    # Programming Languages
    "python": [
        {"q": "Explain the difference between a list and a tuple in Python. When would you use each?", "type": "technical", "difficulty": "easy"},
        {"q": "What are Python decorators and how do they work? Give a practical example.", "type": "technical", "difficulty": "medium"},
        {"q": "How does Python's garbage collection work? What are reference cycles and how does Python handle them?", "type": "technical", "difficulty": "hard"},
        {"q": "Explain the Global Interpreter Lock (GIL) in Python. How does it affect multi-threaded programs?", "type": "technical", "difficulty": "hard"},
        {"q": "What is the difference between `deepcopy` and `copy` in Python? When would each be appropriate?", "type": "technical", "difficulty": "medium"},
    ],
    "javascript": [
        {"q": "Explain the difference between `var`, `let`, and `const` in JavaScript.", "type": "technical", "difficulty": "easy"},
        {"q": "What is the event loop in JavaScript? How does it handle asynchronous operations?", "type": "technical", "difficulty": "medium"},
        {"q": "Explain closures in JavaScript with an example. How are they useful in practice?", "type": "technical", "difficulty": "medium"},
        {"q": "What is the difference between Promises and async/await? What are the error handling patterns for each?", "type": "technical", "difficulty": "medium"},
    ],
    "react": [
        {"q": "Explain the virtual DOM and how React uses it to optimize rendering performance.", "type": "technical", "difficulty": "medium"},
        {"q": "What are React hooks? Explain useState, useEffect, and useCallback with examples.", "type": "technical", "difficulty": "medium"},
        {"q": "How would you optimize a React application that's rendering slowly? Walk through your debugging approach.", "type": "technical", "difficulty": "hard"},
        {"q": "Explain the difference between controlled and uncontrolled components. When would you use each?", "type": "technical", "difficulty": "easy"},
    ],
    "typescript": [
        {"q": "What are generics in TypeScript? Provide an example of when you'd use them.", "type": "technical", "difficulty": "medium"},
        {"q": "Explain the difference between `interface` and `type` in TypeScript.", "type": "technical", "difficulty": "easy"},
    ],
    # Cloud & DevOps
    "aws": [
        {"q": "Explain the difference between EC2, ECS, and Lambda. When would you choose each?", "type": "technical", "difficulty": "medium"},
        {"q": "How would you design a highly available architecture on AWS for a web application with 1 million daily users?", "type": "system_design", "difficulty": "hard"},
        {"q": "What is the difference between S3 storage classes? How would you optimize storage costs?", "type": "technical", "difficulty": "medium"},
    ],
    "docker": [
        {"q": "Explain the difference between a Docker image and a container. How does layered filesystem work?", "type": "technical", "difficulty": "easy"},
        {"q": "How would you optimize a Docker image to reduce its size? Walk through your approach.", "type": "technical", "difficulty": "medium"},
    ],
    "kubernetes": [
        {"q": "Explain the difference between a Deployment, StatefulSet, and DaemonSet in Kubernetes.", "type": "technical", "difficulty": "medium"},
        {"q": "How does Kubernetes handle service discovery and load balancing?", "type": "technical", "difficulty": "medium"},
        {"q": "Describe how you would troubleshoot a pod that's stuck in CrashLoopBackOff.", "type": "problem_solving", "difficulty": "medium"},
    ],
    # Data
    "sql": [
        {"q": "Explain the difference between INNER JOIN, LEFT JOIN, and FULL OUTER JOIN with examples.", "type": "technical", "difficulty": "easy"},
        {"q": "How would you optimize a slow SQL query? Walk through your approach from diagnosis to fix.", "type": "problem_solving", "difficulty": "medium"},
        {"q": "Explain database indexing. What types of indexes exist and when would you use each?", "type": "technical", "difficulty": "medium"},
    ],
    "machine learning": [
        {"q": "Explain the bias-variance tradeoff. How do you balance underfitting and overfitting?", "type": "technical", "difficulty": "medium"},
        {"q": "Walk me through how you would approach a classification problem from data collection to model deployment.", "type": "problem_solving", "difficulty": "hard"},
        {"q": "What is the difference between supervised, unsupervised, and reinforcement learning? Give examples of each.", "type": "technical", "difficulty": "easy"},
    ],
    # General
    "system design": [
        {"q": "Design a URL shortener like bit.ly. Walk through the architecture, data model, and scalability considerations.", "type": "system_design", "difficulty": "hard"},
        {"q": "How would you design a real-time chat application that supports millions of concurrent users?", "type": "system_design", "difficulty": "hard"},
    ],
    "agile": [
        {"q": "Describe your experience with Agile/Scrum. What ceremonies do you find most valuable and why?", "type": "behavioral", "difficulty": "easy"},
    ],
    "leadership": [
        {"q": "Tell me about a time you had to resolve a conflict within your team. What was your approach?", "type": "behavioral", "difficulty": "medium"},
        {"q": "How do you prioritize tasks when you have multiple urgent deadlines? Give a specific example.", "type": "behavioral", "difficulty": "easy"},
    ],
    "git": [
        {"q": "Explain the difference between git merge and git rebase. When would you use each?", "type": "technical", "difficulty": "easy"},
    ],
    # Fallback general questions
    "_general": [
        {"q": "Tell me about a challenging project you worked on recently. What was your role and what was the outcome?", "type": "behavioral", "difficulty": "easy"},
        {"q": "How do you stay updated with new technologies and industry trends?", "type": "behavioral", "difficulty": "easy"},
        {"q": "Describe a situation where you had to learn a new technology quickly. How did you approach it?", "type": "behavioral", "difficulty": "easy"},
        {"q": "What's your approach to debugging a complex issue in production?", "type": "problem_solving", "difficulty": "medium"},
        {"q": "How do you ensure code quality in your projects? What practices do you follow?", "type": "behavioral", "difficulty": "easy"},
    ],
}


class AIInterviewAgent:
    """Generates interview questions and evaluates candidate answers."""

    PASS_THRESHOLD = 3.0  # out of 5.0
    NUM_QUESTIONS = 5

    async def generate_questions(
        self, job_skills: List[str], job_title: str, job_description: str = "",
        exclude_questions: Optional[List[str]] = None,
    ) -> List[dict]:
        """Generate interview questions tailored to the job.

        exclude_questions: list of question texts to avoid (from previous interviews).
        This ensures different candidates get different questions.
        """

        if settings.OPENAI_API_KEY:
            try:
                return await self._generate_with_llm(job_skills, job_title, job_description)
            except Exception:
                pass

        return self._generate_from_bank(job_skills, job_title, exclude_questions or [])

    def _generate_from_bank(
        self, job_skills: List[str], job_title: str, exclude_questions: List[str]
    ) -> List[dict]:
        """Pick questions from the question bank based on job skills.

        Questions are randomized so each candidate gets a different set.
        Previously asked questions (exclude_questions) are skipped.
        """
        exclude_set = set(exclude_questions)

        # Collect ALL matching questions into a pool first
        pool = []
        for skill in job_skills:
            skill_lower = skill.lower().strip()
            for bank_key, bank_questions in QUESTION_BANK.items():
                if bank_key == "_general":
                    continue
                if bank_key in skill_lower or skill_lower in bank_key:
                    for q in bank_questions:
                        if q["q"] not in exclude_set:
                            pool.append({"question": q["q"], "type": q["type"],
                                         "difficulty": q["difficulty"], "skill": skill})

        # Shuffle the entire pool so every candidate gets different questions
        random.shuffle(pool)

        # Deduplicate by question text
        seen = set()
        unique_pool = []
        for q in pool:
            if q["question"] not in seen:
                seen.add(q["question"])
                unique_pool.append(q)

        # Pick from shuffled pool
        selected = unique_pool[:self.NUM_QUESTIONS]

        # Fill remaining with general questions (also shuffled)
        if len(selected) < self.NUM_QUESTIONS:
            general = [q for q in QUESTION_BANK["_general"] if q["q"] not in seen and q["q"] not in exclude_set]
            random.shuffle(general)
            for q in general:
                if len(selected) >= self.NUM_QUESTIONS:
                    break
                selected.append({"question": q["q"], "type": q["type"],
                                 "difficulty": q["difficulty"], "skill": "General"})

        # Assign IDs and time limits
        for i, q in enumerate(selected):
            q["id"] = i + 1
            q["time_limit_seconds"] = 180 if q["difficulty"] == "easy" else 300 if q["difficulty"] == "medium" else 420

        return selected

    async def _generate_with_llm(self, job_skills: List[str], job_title: str, job_description: str) -> List[dict]:
        """Generate interview questions — Claude Opus 4.7 primary, GPT-4o fallback."""
        from app.services.llm_client import call_llm_json, LLMTier

        result = await call_llm_json(
            system=f"""You are a senior technical interviewer at a world-class company.
Generate exactly {self.NUM_QUESTIONS} high-quality interview questions for a {job_title} position.
Required skills: {', '.join(job_skills)}

Return a JSON object with a "questions" array. Each question must have:
- id: number (1-{self.NUM_QUESTIONS})
- question: a specific, insightful interview question
- type: "technical" | "problem_solving" | "behavioral" | "system_design"
- difficulty: "easy" | "medium" | "hard"
- skill: which specific skill this tests
- time_limit_seconds: 180 for easy, 300 for medium, 420 for hard

Mix: 2-3 technical, 1 problem-solving, 1 behavioral. Make every question specific and non-generic.""",
            user=f"Job description: {job_description[:1000]}",
            tier=LLMTier.PRIMARY,
            max_tokens=2000,
            temperature=0.7,
        )
        return result.get("questions", result) if isinstance(result, dict) else result

    async def evaluate_answers(self, questions_and_answers: List[dict], job_title: str, job_skills: List[str]) -> dict:
        """Evaluate all candidate answers and produce a score."""

        if settings.OPENAI_API_KEY:
            try:
                return await self._evaluate_with_llm(questions_and_answers, job_title, job_skills)
            except Exception:
                pass

        return self._evaluate_with_rules(questions_and_answers, job_title)

    def _evaluate_with_rules(self, qa_pairs: List[dict], job_title: str) -> dict:
        """Rule-based evaluation of interview answers."""
        question_results = []
        total_score = 0

        for qa in qa_pairs:
            answer = qa.get("answer", "").strip()
            question = qa.get("question", "")
            skill = qa.get("skill", "General")

            if not answer or len(answer) < 10:
                score = 1.0
                feedback = "Answer was too brief or empty. Please provide a detailed response."
            else:
                # Score based on answer quality signals
                word_count = len(answer.split())
                has_example = any(w in answer.lower() for w in ["example", "for instance", "such as", "i built", "i developed", "i implemented", "i used", "we used"])
                has_structure = any(w in answer.lower() for w in ["first", "second", "finally", "step", "approach", "process"])
                has_technical = any(w in answer.lower() for w in ["function", "class", "method", "algorithm", "database", "api", "server", "deploy", "code", "test", "debug", "performance", "architecture", "design", "implement", "data", "model"])
                has_depth = word_count > 50

                base = 2.5
                if word_count > 30:
                    base += 0.3
                if has_depth:
                    base += 0.5
                if has_example:
                    base += 0.5
                if has_structure:
                    base += 0.3
                if has_technical:
                    base += 0.4

                # Add some variance
                base += random.uniform(-0.3, 0.3)
                score = round(max(1.0, min(5.0, base)), 1)

                if score >= 4.0:
                    feedback = "Excellent response with clear examples and depth."
                elif score >= 3.0:
                    feedback = "Good response. Consider adding more specific examples or deeper technical detail."
                elif score >= 2.0:
                    feedback = "Adequate but could be improved with more detail and real-world examples."
                else:
                    feedback = "Response needs more depth. Try to provide specific examples from your experience."

            question_results.append({
                "question_id": qa.get("id", 0),
                "question": question,
                "skill": skill,
                "score": score,
                "max_score": 5.0,
                "feedback": feedback,
            })
            total_score += score

        avg_score = round(total_score / max(len(qa_pairs), 1), 2)
        passed = avg_score >= self.PASS_THRESHOLD

        if passed:
            if avg_score >= 4.0:
                overall_feedback = f"Outstanding performance! You demonstrated strong expertise across all areas. Your average score of {avg_score}/5.0 exceeds our threshold. You will move forward to the next stage."
            else:
                overall_feedback = f"Good performance! Your average score of {avg_score}/5.0 meets our requirements. You will move forward to the next stage for human review."
        else:
            overall_feedback = f"Thank you for completing the interview. Your average score of {avg_score}/5.0 is below our threshold of {self.PASS_THRESHOLD}/5.0. We encourage you to strengthen your skills and try again."

        return {
            "overall_score": avg_score,
            "max_score": 5.0,
            "pass_threshold": self.PASS_THRESHOLD,
            "passed": passed,
            "question_results": question_results,
            "overall_feedback": overall_feedback,
            "recommendation": "proceed" if passed else "not_proceed",
            "human_review_required": True,
        }

    async def _evaluate_with_llm(self, qa_pairs: List[dict], job_title: str, job_skills: List[str]) -> dict:
        """Evaluate interview answers — Claude Opus 4.7 primary, GPT-4o fallback."""
        from app.services.llm_client import call_llm_json, LLMTier

        qa_text = "\n\n".join([
            f"Q{qa.get('id', i+1)} ({qa.get('skill', 'General')}): {qa.get('question', '')}\nAnswer: {qa.get('answer', 'No answer')}"
            for i, qa in enumerate(qa_pairs)
        ])

        result = await call_llm_json(
            system=f"""You are an expert technical interviewer evaluating a candidate for a {job_title} position.
Required skills: {', '.join(job_skills)}

Score each answer 1-5:
1 = Poor — no relevant content or completely off-topic
2 = Below average — major knowledge gaps, vague answers
3 = Adequate — meets basic expectations, some depth
4 = Good — solid knowledge, clear examples, good reasoning
5 = Excellent — exceptional depth, real-world insight, impressive

Return JSON with:
- overall_score: float (average of all scores, 1 decimal)
- max_score: 5.0
- pass_threshold: {self.PASS_THRESHOLD}
- passed: boolean (overall_score >= {self.PASS_THRESHOLD})
- question_results: array of {{question_id, question, skill, score, max_score: 5.0, feedback: specific 1-sentence feedback}}
- overall_feedback: 2-3 sentence balanced overall assessment
- recommendation: "proceed" | "not_proceed"
- human_review_required: true""",
            user=qa_text,
            tier=LLMTier.PRIMARY,
            max_tokens=3000,
            temperature=0.2,
        )
        result["human_review_required"] = True
        return result
