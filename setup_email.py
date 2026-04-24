"""
Quick email setup — run this once to configure real email sending.

Usage:
    python3 setup_email.py

It will ask for your Gmail address and App Password, then create the .env file.
After this, all candidate emails will be sent to real inboxes.
"""
import os
import smtplib
from email.mime.text import MIMEText

print("=" * 50)
print("  CareerAI — Email Setup")
print("=" * 50)
print()
print("To send real emails, you need a Gmail App Password.")
print()
print("Steps to get one (1 minute):")
print("  1. Go to: https://myaccount.google.com/apppasswords")
print("  2. If asked, enable 2-Step Verification first")
print("  3. Create an app password named 'CareerAI'")
print("  4. Copy the 16-character password")
print()

gmail = input("Enter your Gmail address: ").strip()
password = input("Enter your Gmail App Password: ").strip()

if not gmail or not password:
    print("Error: Both email and password are required.")
    exit(1)

# Test the connection
print(f"\nTesting connection to smtp.gmail.com...")
try:
    msg = MIMEText("Your CareerAI email is configured! Candidates will now receive real emails.")
    msg["From"] = f"CareerAI <{gmail}>"
    msg["To"] = gmail
    msg["Subject"] = "CareerAI Email Setup Successful!"

    with smtplib.SMTP("smtp.gmail.com", 587, timeout=10) as server:
        server.starttls()
        server.login(gmail, password)
        server.send_message(msg)

    print(f"Success! Test email sent to {gmail}")
    print("Check your inbox for 'CareerAI Email Setup Successful!'")
except Exception as e:
    print(f"Failed: {e}")
    print("\nMake sure:")
    print("  - 2-Step Verification is enabled on your Google account")
    print("  - You used an App Password, not your regular Gmail password")
    print("  - The App Password has no spaces")
    exit(1)

# Write .env file
env_path = os.path.join(os.path.dirname(__file__), "backend", ".env")
with open(env_path, "w") as f:
    f.write(f"""# CareerAI Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER={gmail}
SMTP_PASSWORD={password}
FROM_EMAIL={gmail}
COMPANY_NAME=CareerAI
""")

print(f"\n.env file created at: {env_path}")
print("\nAll set! Restart the backend and emails will be sent to real inboxes.")
print("Run: pkill -f uvicorn && cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000")
