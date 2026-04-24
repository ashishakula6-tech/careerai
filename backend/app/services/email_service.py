"""
Email Service — sends real emails to candidates.

Uses 3 methods in order of priority:
1. SMTP with credentials (if SMTP_USER + SMTP_PASSWORD configured)
2. Direct MX delivery (no credentials needed — sends directly to recipient's mail server)
3. Console fallback (if everything fails, logs to terminal)
"""
import smtplib
import socket
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

from app.core.config import settings

# Sender identity for direct delivery
SENDER_DOMAIN = "careerai-platform.com"
SENDER_EMAIL = f"noreply@{SENDER_DOMAIN}"
SENDER_NAME = settings.COMPANY_NAME or "CareerAI"


class EmailService:
    """Sends transactional emails to candidates."""

    @staticmethod
    def _has_smtp_credentials() -> bool:
        return bool(settings.SMTP_USER and settings.SMTP_PASSWORD)

    @staticmethod
    def _build_message(to_email: str, subject: str, html_body: str, text_body: str = ""):
        msg = MIMEMultipart("alternative")
        from_email = settings.FROM_EMAIL if settings.FROM_EMAIL else SENDER_EMAIL
        msg["From"] = f"{SENDER_NAME} <{from_email}>"
        msg["To"] = to_email
        msg["Subject"] = subject
        msg["X-Mailer"] = "CareerAI Platform"
        if text_body:
            msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))
        return msg, from_email

    @staticmethod
    def _send_via_smtp(msg, from_email, to_email):
        """Send via configured SMTP server (Gmail, etc)."""
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        return True

    @staticmethod
    def _get_mx_host(domain):
        """Look up the MX record for a domain."""
        try:
            import dns.resolver
            answers = dns.resolver.resolve(domain, 'MX')
            # Pick the one with lowest priority (highest preference)
            mx = sorted(answers, key=lambda r: r.preference)[0]
            return str(mx.exchange).rstrip('.')
        except Exception:
            return None

    @staticmethod
    def _send_via_mx(msg, from_email, to_email):
        """Send directly to the recipient's mail server via MX lookup. No credentials needed."""
        domain = to_email.split('@')[1]
        mx_host = EmailService._get_mx_host(domain)
        if not mx_host:
            raise Exception(f"No MX record found for {domain}")

        with smtplib.SMTP(mx_host, 25, timeout=15) as server:
            server.ehlo(SENDER_DOMAIN)
            # Try STARTTLS but don't fail if not supported
            try:
                server.starttls()
                server.ehlo(SENDER_DOMAIN)
            except Exception:
                pass
            server.sendmail(from_email, [to_email], msg.as_string())
        return True

    @staticmethod
    def _send_via_sendmail(msg, to_email):
        """Send via local sendmail command (works on macOS with postfix)."""
        import subprocess
        proc = subprocess.Popen(
            ['/usr/sbin/sendmail', '-t', '-oi'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        stdout, stderr = proc.communicate(msg.as_bytes(), timeout=10)
        if proc.returncode != 0:
            raise Exception(f"sendmail exit code {proc.returncode}: {stderr.decode()}")
        return True

    @staticmethod
    def send(to_email: str, subject: str, html_body: str, text_body: str = ""):
        """Send an email. Tries multiple methods in order."""
        msg, from_email = EmailService._build_message(to_email, subject, html_body, text_body)

        # Method 1: SMTP with credentials (if configured)
        if EmailService._has_smtp_credentials():
            try:
                EmailService._send_via_smtp(msg, from_email, to_email)
                print(f"EMAIL SENT (SMTP): {to_email} — {subject}")
                EmailService._store_in_db(to_email, subject, html_body, text_body)
                return True
            except Exception as e:
                print(f"SMTP failed ({e})")

        # Method 2: Local sendmail (macOS/Linux with postfix)
        import os
        if os.path.exists('/usr/sbin/sendmail'):
            try:
                EmailService._send_via_sendmail(msg, to_email)
                print(f"EMAIL SENT (sendmail): {to_email} — {subject}")
                EmailService._store_in_db(to_email, subject, html_body, text_body)
                return True
            except Exception as e:
                print(f"sendmail failed ({e})")

        # Method 3: Store in database (in-app inbox)
        try:
            EmailService._store_in_db(to_email, subject, html_body, text_body)
            print(f"EMAIL STORED (in-app inbox): {to_email} — {subject}")
            return True
        except Exception as db_err:
            print(f"DB store failed: {db_err}")

        # Method 4: Console fallback
        print(f"\n{'='*60}")
        print(f"EMAIL (console fallback)")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        print(f"{'='*60}\n")
        return False

    @staticmethod
    def _store_in_db(to_email, subject, html_body, text_body):
        """Store email in the database so candidates can read it in their portal inbox."""
        from app.core.database import SessionLocal
        from app.models.candidate import Candidate
        from app.models.notification import Notification

        db = SessionLocal()
        try:
            from app.models.tenant import Tenant
            tenant = db.query(Tenant).first()
            if not tenant:
                return

            candidate = db.query(Candidate).filter(Candidate.email == to_email).first()
            if not candidate:
                return

            notif = Notification(
                tenant_id=tenant.id,
                candidate_id=candidate.id,
                type="email",
                status="sent",
                subject=subject,
                message_content=text_body or html_body,
                message_template=html_body,
                recipient_email=to_email,
            )
            db.add(notif)
            db.commit()
        finally:
            db.close()

    # ==================== EMAIL TEMPLATES ====================

    @staticmethod
    def send_shortlisted(to_email: str, candidate_name: str, job_title: str, company: str = None):
        """Candidate has been shortlisted — invite to AI interview."""
        company = company or settings.COMPANY_NAME
        subject = f"Great news! You've been shortlisted for {job_title}"
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #1e40af; color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">Congratulations! 🎉</h1>
            </div>
            <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="font-size: 16px; color: #374151;">Dear {candidate_name},</p>
                <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">
                    We are pleased to inform you that your application for <strong>{job_title}</strong>
                    has been <span style="color: #059669; font-weight: bold;">shortlisted</span>.
                </p>
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0; font-size: 14px; color: #166534;">
                        <strong>Next Step:</strong> Please log in to the Candidate Portal to take your AI Interview.
                        This is a voice-based interview where an AI interviewer will ask you questions related to the role.
                    </p>
                </div>
                <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
                    The AI interview consists of 5 questions and takes approximately 15 minutes.
                    Make sure you have a working microphone and are in a quiet environment.
                </p>
                <div style="text-align: center; margin: 25px 0;">
                    <a href="{settings.APP_BASE_URL}/portal" style="background: #1e40af; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
                        Go to Candidate Portal
                    </a>
                </div>
                <p style="font-size: 13px; color: #9ca3af;">
                    Best regards,<br>
                    {company} Recruitment Team
                </p>
            </div>
        </div>
        """
        text = f"""Dear {candidate_name},

Congratulations! Your application for {job_title} has been shortlisted.

Next Step: Log in to the Candidate Portal to take your AI Interview.
Portal: {settings.APP_BASE_URL}/portal

The interview consists of 5 voice-based questions and takes about 15 minutes.

Best regards,
{company} Recruitment Team"""

        return EmailService.send(to_email, subject, html, text)

    @staticmethod
    def send_rejected(to_email: str, candidate_name: str, job_title: str, reason: str = None, company: str = None):
        """Candidate has been rejected."""
        company = company or settings.COMPANY_NAME
        subject = f"Update on your application for {job_title}"
        reason_text = f"<p style='font-size: 14px; color: #6b7280;'>Reason: {reason}</p>" if reason else ""
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #374151; color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">Application Update</h1>
            </div>
            <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="font-size: 16px; color: #374151;">Dear {candidate_name},</p>
                <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">
                    Thank you for your interest in the <strong>{job_title}</strong> position
                    and the time you invested in the application process.
                </p>
                <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">
                    After careful consideration, we have decided not to move forward with your application
                    at this time.
                </p>
                {reason_text}
                <div style="background: #fefce8; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0; font-size: 14px; color: #854d0e;">
                        We encourage you to apply for other positions that match your skills.
                        Visit our portal to browse current openings.
                    </p>
                </div>
                <div style="text-align: center; margin: 25px 0;">
                    <a href="{settings.APP_BASE_URL}/portal" style="background: #374151; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
                        Browse Other Jobs
                    </a>
                </div>
                <p style="font-size: 13px; color: #9ca3af;">
                    Best regards,<br>
                    {company} Recruitment Team
                </p>
            </div>
        </div>
        """
        text = f"""Dear {candidate_name},

Thank you for your interest in the {job_title} position.

After careful consideration, we have decided not to move forward with your application at this time.
{('Reason: ' + reason) if reason else ''}

We encourage you to apply for other positions: {settings.APP_BASE_URL}/portal

Best regards,
{company} Recruitment Team"""

        return EmailService.send(to_email, subject, html, text)

    @staticmethod
    def send_interview_passed(to_email: str, candidate_name: str, job_title: str, score: float, company: str = None):
        """Candidate passed the AI interview."""
        company = company or settings.COMPANY_NAME
        subject = f"You passed the AI Interview for {job_title}!"
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #059669; color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">Interview Passed! 🎉</h1>
                <p style="margin: 8px 0 0; font-size: 18px; opacity: 0.9;">Score: {score}/5.0</p>
            </div>
            <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="font-size: 16px; color: #374151;">Dear {candidate_name},</p>
                <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">
                    Congratulations! You have successfully passed the AI interview for
                    <strong>{job_title}</strong> with a score of <strong>{score}/5.0</strong>.
                </p>
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0; font-size: 14px; color: #166534;">
                        <strong>Next Step:</strong> A human recruiter will review your interview performance
                        and contact you to schedule the next round. Expect to hear from us within 3-5 business days.
                    </p>
                </div>
                <p style="font-size: 13px; color: #9ca3af;">
                    Best regards,<br>
                    {company} Recruitment Team
                </p>
            </div>
        </div>
        """
        text = f"""Dear {candidate_name},

Congratulations! You passed the AI interview for {job_title} with a score of {score}/5.0.

Next Step: A recruiter will review your performance and contact you within 3-5 business days.

Best regards,
{company} Recruitment Team"""

        return EmailService.send(to_email, subject, html, text)

    @staticmethod
    def send_interview_failed(to_email: str, candidate_name: str, job_title: str, score: float, threshold: float, company: str = None):
        """Candidate failed the AI interview."""
        company = company or settings.COMPANY_NAME
        subject = f"AI Interview results for {job_title}"
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #374151; color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">Interview Results</h1>
                <p style="margin: 8px 0 0; font-size: 18px; opacity: 0.9;">Score: {score}/5.0</p>
            </div>
            <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="font-size: 16px; color: #374151;">Dear {candidate_name},</p>
                <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">
                    Thank you for completing the AI interview for <strong>{job_title}</strong>.
                </p>
                <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">
                    Your score of <strong>{score}/5.0</strong> was below the pass threshold
                    of <strong>{threshold}/5.0</strong>. Unfortunately, we are unable to move
                    forward with your application at this time.
                </p>
                <div style="background: #fefce8; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0; font-size: 14px; color: #854d0e;">
                        We encourage you to strengthen your skills and explore other open positions
                        on our portal.
                    </p>
                </div>
                <div style="text-align: center; margin: 25px 0;">
                    <a href="{settings.APP_BASE_URL}/portal" style="background: #374151; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                        Browse Other Jobs
                    </a>
                </div>
                <p style="font-size: 13px; color: #9ca3af;">
                    Best regards,<br>
                    {company} Recruitment Team
                </p>
            </div>
        </div>
        """
        text = f"""Dear {candidate_name},

Thank you for completing the AI interview for {job_title}.

Your score of {score}/5.0 was below the threshold of {threshold}/5.0.

We encourage you to explore other positions: {settings.APP_BASE_URL}/portal

Best regards,
{company} Recruitment Team"""

        return EmailService.send(to_email, subject, html, text)

    @staticmethod
    def send_interview_abandoned(to_email: str, candidate_name: str, job_title: str, company: str = None):
        """Candidate disconnected during interview."""
        company = company or settings.COMPANY_NAME
        subject = f"Your interview for {job_title} was not completed"
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #dc2626; color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">Interview Not Completed</h1>
            </div>
            <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="font-size: 16px; color: #374151;">Dear {candidate_name},</p>
                <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">
                    Your AI interview for <strong>{job_title}</strong> was not completed
                    because the call was disconnected before all questions were answered.
                </p>
                <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">
                    As a result, your application has been <strong style="color: #dc2626;">rejected</strong>.
                </p>
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0; font-size: 14px; color: #991b1b;">
                        Disconnecting during an interview is treated as an incomplete application.
                        You may browse and apply for other positions.
                    </p>
                </div>
                <div style="text-align: center; margin: 25px 0;">
                    <a href="{settings.APP_BASE_URL}/portal" style="background: #374151; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                        Browse Other Jobs
                    </a>
                </div>
                <p style="font-size: 13px; color: #9ca3af;">
                    Best regards,<br>
                    {company} Recruitment Team
                </p>
            </div>
        </div>
        """
        text = f"""Dear {candidate_name},

Your AI interview for {job_title} was not completed because the call was disconnected.

Your application has been rejected.

You may browse other positions: {settings.APP_BASE_URL}/portal

Best regards,
{company} Recruitment Team"""

        return EmailService.send(to_email, subject, html, text)

    @staticmethod
    def send_welcome(to_email, candidate_name, skills_count=0, matches_count=0, total_jobs=500, company=None):
        company = company or settings.COMPANY_NAME
        first = candidate_name.split()[0]
        subject = f"Welcome to {company}! Your career journey starts here"
        html = f"""<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><div style="background:linear-gradient(135deg,#6366f1,#a855f7,#ec4899);padding:40px;border-radius:16px 16px 0 0;text-align:center;"><h1 style="color:white;margin:0;font-size:28px;">Welcome to {company}!</h1><p style="color:rgba(255,255,255,0.9);margin:10px 0 0;">We're excited to have you, {first}!</p></div><div style="background:white;padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px;"><p style="font-size:15px;color:#4b5563;line-height:1.7;">We analyzed your resume: <strong>{skills_count} skills</strong> detected, <strong>{matches_count} jobs</strong> matched from <strong>{total_jobs}+</strong> open worldwide.</p><div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin:20px 0;"><p style="margin:0;font-size:14px;color:#166534;font-weight:bold;">How it works:</p><ol style="margin:8px 0 0;padding-left:20px;color:#166534;font-size:13px;line-height:1.8;"><li>Browse AI-matched jobs and apply</li><li>Record a 30-60s video pitch</li><li>If shortlisted, take AI voice interview</li><li>Pass and a recruiter contacts you!</li></ol></div><p style="font-size:14px;color:#6b7280;">New jobs added every hour from <strong>100+ cities</strong>.</p><div style="text-align:center;margin:25px 0;"><a href="{settings.APP_BASE_URL}/portal" style="background:linear-gradient(135deg,#6366f1,#a855f7);color:white;padding:14px 40px;border-radius:12px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block;">Browse Your Matched Jobs</a></div><p style="font-size:13px;color:#9ca3af;text-align:center;">We're rooting for you! 🚀 — {company} Team</p></div></div>"""
        text = f"Welcome {candidate_name}! {skills_count} skills found, {matches_count} jobs matched. Visit {settings.APP_BASE_URL}/portal"
        return EmailService.send(to_email, subject, html, text)

    @staticmethod
    def send_video_pitch_rejected_encouraging(to_email, candidate_name, job_title, score, threshold, strengths=None, improvements=None, company=None):
        company = company or settings.COMPANY_NAME
        first = candidate_name.split()[0]
        subject = f"Update on {job_title} — don't stop here, {first}!"
        s_text = ", ".join(strengths) if strengths else "Great effort and courage"
        i_text = ", ".join(improvements) if improvements else "Try mentioning specific skills from the job description"
        html = f"""<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;padding:30px;border-radius:16px 16px 0 0;text-align:center;"><h1 style="margin:0;font-size:24px;">Keep Going, {first}! 💫</h1></div><div style="background:white;padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px;"><p style="font-size:15px;color:#4b5563;line-height:1.7;">Your video for <strong>{job_title}</strong> scored <strong>{score}/5.0</strong> (needed {threshold}). While this role wasn't the match, your effort was impressive!</p><div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:12px;margin:15px 0;"><p style="margin:0;font-size:13px;color:#166534;">✅ <strong>What you did well:</strong> {s_text}</p></div><div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:12px;margin:15px 0;"><p style="margin:0;font-size:13px;color:#854d0e;">💡 <strong>Tips:</strong> {i_text}</p></div><div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;margin:20px 0;"><p style="margin:0;font-size:14px;color:#1e40af;font-weight:bold;">Next steps:</p><ul style="margin:8px 0 0;padding-left:20px;color:#1e40af;font-size:13px;line-height:1.8;"><li>Browse 500+ other jobs matching your skills</li><li>Try a role closer to your strengths</li><li>New jobs every hour!</li></ul></div><div style="text-align:center;margin:25px 0;"><a href="{settings.APP_BASE_URL}/portal" style="background:linear-gradient(135deg,#6366f1,#a855f7);color:white;padding:14px 35px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;">Explore More Jobs</a></div><p style="font-size:14px;color:#6b7280;text-align:center;">Every successful person faced rejection. <strong>Your perfect role is out there!</strong> 🚀</p></div></div>"""
        text = f"Hi {first}, pitch for {job_title}: {score}/5.0 (needed {threshold}). Browse 500+ more at {settings.APP_BASE_URL}/portal"
        return EmailService.send(to_email, subject, html, text)

    @staticmethod
    def send_interview_failed_encouraging(to_email, candidate_name, job_title, score, threshold, strengths=None, company=None):
        company = company or settings.COMPANY_NAME
        first = candidate_name.split()[0]
        subject = f"Interview results for {job_title} — we believe in you, {first}!"
        s_html = ("<p style='font-size:13px;color:#166534;'>✅ <strong>Strengths:</strong> " + ", ".join(strengths) + "</p>") if strengths else ""
        html = f"""<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;padding:30px;border-radius:16px 16px 0 0;text-align:center;"><h1 style="margin:0;font-size:24px;">You Gave It Your Best! 🌟</h1></div><div style="background:white;padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px;"><p style="font-size:15px;color:#4b5563;line-height:1.7;">AI interview for <strong>{job_title}</strong>: <strong>{score}/5.0</strong> (needed {threshold}). This doesn't define your worth!</p>{s_html}<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;margin:20px 0;"><p style="margin:0;font-size:14px;color:#1e40af;font-weight:bold;">Game plan:</p><ul style="margin:8px 0 0;padding-left:20px;color:#1e40af;font-size:13px;line-height:1.8;"><li>Apply for roles matching your strongest skills</li><li>Practice domain-specific questions</li><li>500+ jobs across 100+ cities!</li></ul></div><div style="text-align:center;margin:25px 0;"><a href="{settings.APP_BASE_URL}/portal" style="background:linear-gradient(135deg,#6366f1,#a855f7);color:white;padding:14px 35px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;">Find More Jobs</a></div><div style="background:#fef3c7;border:1px solid #fde68a;border-radius:12px;padding:16px;text-align:center;"><p style="margin:0;font-size:14px;color:#92400e;"><em>"Success is not final, failure is not fatal. It is the courage to continue that counts."</em></p></div><p style="font-size:13px;color:#9ca3af;text-align:center;margin-top:15px;">Come back stronger! 💪 — {company} Team</p></div></div>"""
        text = f"Hi {first}, interview for {job_title}: {score}/5.0 (needed {threshold}). 500+ more jobs at {settings.APP_BASE_URL}/portal"
        return EmailService.send(to_email, subject, html, text)

    @staticmethod
    def send_abandoned_encouraging(to_email, candidate_name, job_title, company=None):
        company = company or settings.COMPANY_NAME
        first = candidate_name.split()[0]
        subject = f"We noticed you left — we'd love to see you try again, {first}!"
        html = f"""<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;padding:30px;border-radius:16px 16px 0 0;text-align:center;"><h1 style="margin:0;font-size:24px;">We Miss You, {first}! 😊</h1></div><div style="background:white;padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px;"><p style="font-size:15px;color:#4b5563;line-height:1.7;">The interview for <strong>{job_title}</strong> was disconnected. That's okay — it happens!</p><p style="font-size:15px;color:#4b5563;">This application was closed, but <strong>your talent hasn't gone anywhere!</strong></p><div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;margin:20px 0;"><p style="margin:0;font-size:14px;color:#1e40af;font-weight:bold;">You can:</p><ul style="margin:8px 0 0;padding-left:20px;color:#1e40af;font-size:13px;line-height:1.8;"><li>Apply to another role — 500+ jobs</li><li>Ensure stable internet next time</li><li>New jobs posted every hour!</li></ul></div><div style="text-align:center;margin:25px 0;"><a href="{settings.APP_BASE_URL}/portal" style="background:linear-gradient(135deg,#6366f1,#a855f7);color:white;padding:14px 35px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;">Try Another Job</a></div><p style="font-size:14px;color:#6b7280;text-align:center;">Technical glitches happen. <strong>We believe in you!</strong> 🚀</p></div></div>"""
        text = f"Hi {first}, interview for {job_title} disconnected. 500+ more jobs at {settings.APP_BASE_URL}/portal. We believe in you!"
        return EmailService.send(to_email, subject, html, text)
