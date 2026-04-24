"""
Policy Gate Service - Central control point that validates all business rules
before any action proceeds. This is one of the THREE PLATFORM CONTROLS.

Rules:
- AI recommends, humans decide
- No auto-rejection based on scores alone
- Never notify before human approval
"""
import re
from datetime import datetime, timezone
from typing import Optional

from app.core.config import settings


class PolicyGateService:
    """Validates workflow steps against policy rules."""

    async def validate(
        self, workflow_step: str, data: dict, entity_id: Optional[str] = None
    ) -> dict:
        """Validate a workflow step against policy rules.

        Returns:
            dict with is_valid, errors, warnings, metadata
        """
        errors = []
        warnings = []
        requires_human_review = True
        is_recommendation_only = True

        validator = getattr(self, f"_validate_{workflow_step}", None)
        if validator:
            step_errors, step_warnings = await validator(data)
            errors.extend(step_errors)
            warnings.extend(step_warnings)
        else:
            warnings.append(f"No validation rules defined for step: {workflow_step}")

        return {
            "is_valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "metadata": {
                "validation_timestamp": datetime.now(timezone.utc).isoformat(),
                "workflow_step": workflow_step,
                "entity_id": entity_id,
                "requires_human_review": requires_human_review,
                "is_recommendation_only": is_recommendation_only,
            },
        }

    async def _validate_job_intake(self, data: dict) -> tuple[list, list]:
        errors = []
        warnings = []

        title = data.get("title", "")
        description = data.get("description", "")
        skills = data.get("skills", [])

        if not title or len(title) < 3:
            errors.append("Job title is required and must be at least 3 characters")

        if not description or len(description) < 50:
            errors.append("Job description must be at least 50 characters for meaningful matching")

        if not skills or len(skills) == 0:
            errors.append("At least one skill is required for candidate matching")

        if len(skills) < 3:
            warnings.append("Consider adding more specific skills for better matching accuracy")

        if len(description) < 200:
            warnings.append("A more detailed description improves AI matching quality")

        return errors, warnings

    async def _validate_candidate_ingestion(self, data: dict) -> tuple[list, list]:
        errors = []
        warnings = []

        email = data.get("email", "")
        consent = data.get("consent_given", False)

        if not email:
            errors.append("Email is required")
        elif not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            errors.append("Invalid email format")

        if not consent:
            errors.append("Candidate consent is required before processing (GDPR/CCPA)")

        return errors, warnings

    async def _validate_resume_parsing(self, data: dict) -> tuple[list, list]:
        errors = []
        warnings = []

        confidence = data.get("confidence", 0)

        if confidence < settings.CONFIDENCE_THRESHOLD:
            errors.append(
                f"Parsing confidence ({confidence:.2f}) is below threshold "
                f"({settings.CONFIDENCE_THRESHOLD}). Manual review required."
            )

        if confidence < 0.8:
            warnings.append("Moderate confidence - human verification recommended for parsed fields")

        return errors, warnings

    async def _validate_candidate_matching(self, data: dict) -> tuple[list, list]:
        errors = []
        warnings = []

        auto_reject = data.get("auto_reject", False)
        bias_score = data.get("bias_score", 0)
        ranking_factors = data.get("ranking_factors", {})

        # RULE: No auto-rejection (ALWAYS enforced)
        if auto_reject:
            errors.append("Auto-rejection is not allowed. All candidates require human review.")

        # Check bias score
        if bias_score > settings.BIAS_ALERT_THRESHOLD:
            errors.append(
                f"Bias score ({bias_score:.4f}) exceeds threshold "
                f"({settings.BIAS_ALERT_THRESHOLD}). Compliance review required."
            )

        # Ensure multi-signal ranking
        if len(ranking_factors) < 2:
            warnings.append("Matching used fewer than 2 signals. Multi-signal ranking recommended.")

        return errors, warnings

    async def _validate_notification(self, data: dict) -> tuple[list, list]:
        errors = []
        warnings = []

        has_approval = data.get("has_approval", False)
        is_suppressed = data.get("is_suppressed", False)

        # RULE: Never notify before human approval
        if not has_approval:
            errors.append("Human approval is required before sending any notification to candidates")

        if is_suppressed:
            errors.append("Candidate is on suppression list. Notification blocked.")

        return errors, warnings

    async def _validate_interview_scheduling(self, data: dict) -> tuple[list, list]:
        errors = []
        warnings = []

        calendar_available = data.get("calendar_available", True)
        timezone_val = data.get("timezone", "")

        if not calendar_available:
            errors.append("No available calendar slots found for the requested time period")

        if not timezone_val:
            warnings.append("Timezone not specified. Will default to UTC.")

        return errors, warnings
