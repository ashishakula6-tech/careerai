"""
Auto Job Generator — Simulates a live job board that continuously receives
new postings from companies worldwide and expires old ones.

Runs on:
1. Server startup — seeds initial jobs if DB is empty
2. Every portal visit — checks for expired jobs + adds a few new ones
3. Background thread — generates new jobs every hour

This makes the portal feel alive — every time a candidate visits,
they see fresh jobs and expired ones are marked.
"""
import json
import random
import threading
import time
from datetime import datetime, timezone, timedelta

from app.core.database import SessionLocal
from app.models.job import Job

# ===== JOB DATA POOLS =====

TITLES_SKILLS = {
    "Frontend Developer": ["React", "JavaScript", "TypeScript", "CSS", "HTML", "Next.js", "Tailwind"],
    "Backend Developer": ["Python", "Node.js", "PostgreSQL", "REST APIs", "Docker", "Redis"],
    "Full Stack Developer": ["React", "Python", "Node.js", "PostgreSQL", "Docker", "Git"],
    "Senior Software Engineer": ["Python", "Java", "System Design", "AWS", "Microservices"],
    "Staff Engineer": ["System Design", "Go", "Kubernetes", "AWS", "Python"],
    "iOS Developer": ["Swift", "SwiftUI", "Xcode", "iOS", "Core Data"],
    "Android Developer": ["Kotlin", "Android Studio", "Jetpack Compose", "Firebase"],
    "Flutter Developer": ["Flutter", "Dart", "Firebase", "REST APIs", "Mobile"],
    "React Native Developer": ["React Native", "TypeScript", "Redux", "Firebase"],
    "Data Scientist": ["Python", "Machine Learning", "SQL", "TensorFlow", "Statistics"],
    "Data Analyst": ["SQL", "Python", "Tableau", "Excel", "Power BI"],
    "Data Engineer": ["Python", "Spark", "Airflow", "SQL", "Snowflake", "AWS"],
    "Machine Learning Engineer": ["Python", "TensorFlow", "PyTorch", "MLOps", "Docker"],
    "AI Engineer": ["Python", "LangChain", "OpenAI", "Vector DBs", "FastAPI"],
    "Prompt Engineer": ["LLMs", "Python", "NLP", "Prompt Design", "GPT"],
    "NLP Engineer": ["Python", "NLP", "Transformers", "BERT", "SpaCy"],
    "DevOps Engineer": ["AWS", "Kubernetes", "Docker", "Terraform", "Jenkins", "Linux"],
    "Cloud Engineer": ["AWS", "Azure", "GCP", "Terraform", "Docker"],
    "Site Reliability Engineer": ["Linux", "Kubernetes", "Prometheus", "Python", "AWS"],
    "Cloud Architect": ["AWS", "Azure", "Terraform", "Kubernetes", "Security"],
    "Platform Engineer": ["Kubernetes", "Helm", "ArgoCD", "Go", "Terraform"],
    "Cybersecurity Analyst": ["SIEM", "Network Security", "Python", "SOC2"],
    "Security Engineer": ["AWS Security", "IAM", "Python", "Compliance", "OWASP"],
    "Engineering Manager": ["Leadership", "Agile", "Python", "System Design"],
    "Product Manager": ["Product Strategy", "Agile", "Jira", "SQL", "Analytics"],
    "Scrum Master": ["Scrum", "Agile", "Jira", "Confluence"],
    "Project Manager": ["Project Management", "Agile", "Jira", "Stakeholders"],
    "UX/UI Designer": ["Figma", "UI/UX", "Prototyping", "User Research"],
    "Product Designer": ["Figma", "User Research", "Design Systems"],
    "Graphic Designer": ["Photoshop", "Illustrator", "InDesign", "Branding"],
    "Digital Marketing Manager": ["SEO", "Google Ads", "Analytics", "Social Media"],
    "Content Strategist": ["Content Writing", "SEO", "Analytics", "Social Media"],
    "SEO Specialist": ["SEO", "Google Analytics", "Ahrefs", "Content"],
    "QA Engineer": ["Selenium", "Python", "Cypress", "API Testing"],
    "QA Automation Engineer": ["Selenium", "Python", "Cypress", "CI/CD"],
    "SDET": ["Python", "Java", "Selenium", "REST APIs", "CI/CD"],
    "Database Administrator": ["PostgreSQL", "MySQL", "MongoDB", "Backup"],
    "Network Engineer": ["Cisco", "Networking", "Firewall", "SD-WAN"],
    "System Administrator": ["Linux", "Windows Server", "Networking", "Scripting"],
    "Technical Support Engineer": ["Linux", "AWS", "SQL", "Troubleshooting"],
    "Java Developer": ["Java", "Spring Boot", "Maven", "PostgreSQL"],
    "PHP Developer": ["PHP", "Laravel", "MySQL", "Redis", "Vue.js"],
    "Go Developer": ["Go", "Microservices", "gRPC", "Kubernetes", "Docker"],
    ".NET Developer": [".NET", "C#", "SQL Server", "Azure"],
    "Python Developer": ["Python", "Django", "Flask", "PostgreSQL", "REST APIs"],
    "Ruby on Rails Developer": ["Ruby", "Rails", "PostgreSQL", "Redis"],
    "Angular Developer": ["Angular", "TypeScript", "RxJS", "NgRx"],
    "Vue.js Developer": ["Vue.js", "JavaScript", "Vuex", "Node.js"],
    "Blockchain Developer": ["Solidity", "Ethereum", "Web3.js", "Smart Contracts"],
    "Rust Developer": ["Rust", "Systems Programming", "Concurrency", "Linux"],
    "SAP Consultant": ["SAP", "S/4HANA", "ABAP", "FICO"],
    "Salesforce Developer": ["Salesforce", "Apex", "Lightning", "SOQL"],
    "Solutions Architect": ["AWS", "Azure", "Solution Design", "Microservices"],
    "Business Analyst": ["Requirements", "SQL", "Jira", "Documentation"],
    "Technical Writer": ["Technical Writing", "API Documentation", "Markdown"],
    "Sales Engineer": ["Pre-sales", "Demo", "Technical", "CRM"],
    "Developer Advocate": ["Public Speaking", "Technical Writing", "Python", "APIs"],
    "FinTech Developer": ["Python", "React", "Payment APIs", "Security", "AWS"],
    "Healthcare IT Developer": ["HL7", "FHIR", "Python", "React", "HIPAA"],
    "IoT Developer": ["IoT", "MQTT", "Python", "Embedded", "AWS IoT"],
    "Embedded Systems Engineer": ["C", "C++", "RTOS", "ARM", "IoT"],
    "Game Developer": ["Unity", "C#", "Unreal Engine", "3D Math"],
    "AR/VR Developer": ["Unity", "C#", "ARKit", "ARCore"],
    "Robotics Engineer": ["ROS", "Python", "C++", "Computer Vision"],
    "MLOps Engineer": ["Python", "MLflow", "Kubernetes", "Docker", "AWS SageMaker"],
    "Growth Hacker": ["Analytics", "A/B Testing", "SQL", "Python"],
    "Social Media Manager": ["Social Media", "Content", "Analytics", "Branding"],
    "Video Editor": ["Premiere Pro", "After Effects", "DaVinci Resolve"],
    "Customer Success Manager": ["CRM", "Communication", "SaaS", "Analytics"],
    "HR Tech Specialist": ["HRMS", "Workday", "SAP SuccessFactors", "Analytics"],
    "ERP Consultant": ["SAP", "Oracle", "ERP", "Business Process"],
    "Agile Coach": ["Agile", "Scrum", "Kanban", "Coaching", "SAFe"],
    "Web3 Developer": ["Solidity", "Ethereum", "React", "Smart Contracts"],
    "MERN Stack Developer": ["MongoDB", "Express", "React", "Node.js"],
    "WordPress Developer": ["WordPress", "PHP", "JavaScript", "CSS"],
    "Shopify Developer": ["Shopify", "Liquid", "JavaScript", "Ruby"],
}

# Weighted locations — India and Dubai heavy
LOCATIONS = [
    # India (heavy)
    *["Bangalore, India"]*5, *["Hyderabad, India"]*5, *["Mumbai, India"]*4, *["Pune, India"]*4,
    *["Chennai, India"]*3, *["Delhi NCR, India"]*4, *["Noida, India"]*3, *["Gurgaon, India"]*4,
    *["Kolkata, India"]*2, *["Ahmedabad, India"]*2, *["Jaipur, India"]*2, *["Kochi, India"]*2,
    *["Chandigarh, India"]*2, *["Indore, India"]*2, *["Coimbatore, India"]*2, *["Lucknow, India"]*1,
    *["Nagpur, India"]*1, *["Visakhapatnam, India"]*1, *["Bhubaneswar, India"]*1, *["Trivandrum, India"]*1,
    *["Mysore, India"]*1, *["Mangalore, India"]*1, *["Vadodara, India"]*1, *["Surat, India"]*1,
    # UAE/Dubai (heavy)
    *["Dubai, UAE"]*5, *["Abu Dhabi, UAE"]*3, *["Sharjah, UAE"]*2, *["Dubai Internet City, UAE"]*3,
    *["Dubai Silicon Oasis, UAE"]*2, *["DIFC Dubai, UAE"]*2,
    # Middle East
    *["Riyadh, Saudi Arabia"]*3, *["Jeddah, Saudi Arabia"]*2, *["Doha, Qatar"]*2,
    *["Muscat, Oman"]*1, *["Kuwait City, Kuwait"]*1, *["Manama, Bahrain"]*1, *["Tel Aviv, Israel"]*2,
    # USA
    *["San Francisco, USA"]*3, *["New York, USA"]*3, *["Seattle, USA"]*3, *["Austin, USA"]*2,
    *["Boston, USA"]*2, *["Chicago, USA"]*2, *["Los Angeles, USA"]*2, *["Denver, USA"]*2,
    *["Atlanta, USA"]*2, *["Miami, USA"]*1, *["Portland, USA"]*1, *["San Diego, USA"]*1,
    *["Dallas, USA"]*2, *["Phoenix, USA"]*1, *["Raleigh, USA"]*1, *["San Jose, USA"]*2,
    *["Washington DC, USA"]*2, *["Houston, USA"]*1, *["Minneapolis, USA"]*1, *["Detroit, USA"]*1,
    # Europe
    *["London, UK"]*3, *["Berlin, Germany"]*3, *["Amsterdam, Netherlands"]*2, *["Paris, France"]*2,
    *["Dublin, Ireland"]*3, *["Barcelona, Spain"]*2, *["Stockholm, Sweden"]*2, *["Munich, Germany"]*2,
    *["Zurich, Switzerland"]*2, *["Warsaw, Poland"]*2, *["Milan, Italy"]*1, *["Prague, Czech Republic"]*1,
    *["Helsinki, Finland"]*1, *["Oslo, Norway"]*1, *["Copenhagen, Denmark"]*1, *["Lisbon, Portugal"]*2,
    *["Vienna, Austria"]*1, *["Brussels, Belgium"]*1, *["Edinburgh, UK"]*1, *["Manchester, UK"]*2,
    *["Hamburg, Germany"]*1, *["Frankfurt, Germany"]*1, *["Bucharest, Romania"]*1, *["Tallinn, Estonia"]*1,
    # Asia Pacific
    *["Singapore"]*3, *["Tokyo, Japan"]*3, *["Seoul, South Korea"]*2, *["Sydney, Australia"]*3,
    *["Melbourne, Australia"]*2, *["Jakarta, Indonesia"]*2, *["Manila, Philippines"]*2,
    *["Bangkok, Thailand"]*2, *["Kuala Lumpur, Malaysia"]*2, *["Ho Chi Minh City, Vietnam"]*2,
    *["Taipei, Taiwan"]*1, *["Hong Kong"]*2, *["Auckland, New Zealand"]*1, *["Shenzhen, China"]*1,
    # Africa
    *["Lagos, Nigeria"]*2, *["Cape Town, South Africa"]*2, *["Nairobi, Kenya"]*2, *["Cairo, Egypt"]*1,
    *["Accra, Ghana"]*1, *["Johannesburg, South Africa"]*1,
    # South America
    *["Sao Paulo, Brazil"]*2, *["Buenos Aires, Argentina"]*2, *["Mexico City, Mexico"]*2,
    *["Bogota, Colombia"]*2, *["Santiago, Chile"]*1, *["Lima, Peru"]*1, *["Medellin, Colombia"]*1,
    # Canada
    *["Toronto, Canada"]*3, *["Vancouver, Canada"]*2, *["Montreal, Canada"]*2, *["Calgary, Canada"]*1,
    *["Ottawa, Canada"]*1, *["Waterloo, Canada"]*1,
    # Remote
    *["Remote, Worldwide"]*4, *["Remote, USA"]*3, *["Remote, Europe"]*3,
    *["Remote, India"]*3, *["Remote, Asia Pacific"]*2, *["Remote, Middle East"]*2,
]

DESCRIPTIONS = [
    "We're looking for a talented {title} to join our growing team. You'll work on challenging problems at scale and make a real impact.",
    "Join us as a {title} and help build the future of our platform. Design and implement features used by millions.",
    "We need an experienced {title} to lead key initiatives. Architect solutions, mentor developers, and drive decisions.",
    "Exciting opportunity for a {title}. Build scalable systems and collaborate cross-functionally with product and design.",
    "We're hiring a {title} to develop features from concept to deployment. Ship fast, learn faster.",
    "Looking for a passionate {title} who thrives in fast-paced environments. Modern stack, great culture, real impact.",
    "As a {title}, design robust systems, write production code, and translate business needs into technical solutions.",
    "Join a world-class team as a {title}. Ownership, cutting-edge tools, and a team that invests in your growth.",
]

SALARY_MULTIPLIERS = {
    "India": 0.2, "Philippines": 0.15, "Indonesia": 0.15, "Vietnam": 0.15,
    "Nigeria": 0.12, "Kenya": 0.12, "Ghana": 0.12, "Egypt": 0.15,
    "Brazil": 0.25, "Argentina": 0.2, "Colombia": 0.2, "Mexico": 0.25,
    "Peru": 0.18, "Chile": 0.25, "Uruguay": 0.22,
    "Japan": 0.8, "Korea": 0.6, "Taiwan": 0.5, "China": 0.5,
    "Singapore": 0.9, "Hong Kong": 0.9, "Malaysia": 0.3, "Thailand": 0.25,
    "UAE": 0.7, "Saudi": 0.65, "Qatar": 0.7, "Oman": 0.5, "Kuwait": 0.6, "Bahrain": 0.55, "Israel": 0.8,
    "UK": 0.85, "Ireland": 0.85, "Germany": 0.9, "Netherlands": 0.9,
    "Switzerland": 1.0, "France": 0.8, "Spain": 0.65, "Italy": 0.7,
    "Sweden": 0.85, "Norway": 0.9, "Denmark": 0.85, "Finland": 0.8,
    "Poland": 0.4, "Czech": 0.45, "Romania": 0.3, "Estonia": 0.45,
    "Portugal": 0.55, "Austria": 0.8, "Belgium": 0.8,
    "Australia": 0.85, "New Zealand": 0.75, "South Africa": 0.2, "Canada": 0.8,
}

SAL_RANGES = {0:(40000,70000), 1:(50000,80000), 2:(60000,100000), 3:(80000,130000),
              4:(100000,160000), 5:(120000,180000), 6:(140000,220000), 8:(180000,300000), 10:(200000,350000)}

EXP_RANGES = [(0,2), (1,3), (2,5), (3,6), (4,8), (5,10), (6,12), (8,15), (10,20)]
EDU = ["Bachelor's", "Bachelor's in CS", "Master's", "Master's in CS", "MBA", "PhD", None, None]
WORK_MODES = ["remote", "hybrid", "office"]


def _get_salary_multiplier(location):
    for country, m in SALARY_MULTIPLIERS.items():
        if country in location:
            return m
    return 1.0


def generate_single_job(tenant_id):
    """Generate one random job."""
    title = random.choice(list(TITLES_SKILLS.keys()))
    skills = TITLES_SKILLS[title]
    loc = random.choice(LOCATIONS)
    exp = random.choice(EXP_RANGES)
    wm = "remote" if "Remote" in loc else random.choices(WORK_MODES, weights=[25, 40, 35])[0]
    sal = SAL_RANGES.get(exp[0], (60000, 120000))
    mult = _get_salary_multiplier(loc)
    desc = random.choice(DESCRIPTIONS).replace("{title}", title)

    # Expire between 7-45 days from now
    expires_days = random.randint(7, 45)

    return Job(
        tenant_id=tenant_id,
        title=title,
        description=desc,
        skills=json.dumps(random.sample(skills, min(len(skills), random.randint(3, len(skills))))),
        requirements=json.dumps({}),
        experience_min=exp[0],
        experience_max=exp[1],
        education=random.choice(EDU),
        location=loc,
        remote_allowed=(wm in ("remote", "hybrid")),
        work_mode=wm,
        salary_min=int(sal[0] * mult),
        salary_max=int(sal[1] * mult),
        status="active",
        published_at=datetime.now(timezone.utc) - timedelta(hours=random.randint(0, 72)),
        expires_at=datetime.now(timezone.utc) + timedelta(days=expires_days),
    )


def expire_old_jobs():
    """Mark jobs past their expires_at as expired."""
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        expired = db.query(Job).filter(
            Job.status == "active",
            Job.expires_at.isnot(None),
            Job.expires_at < now,
        ).all()
        for job in expired:
            job.status = "expired"
        if expired:
            db.commit()
            print(f"[JobGen] Expired {len(expired)} jobs")
    finally:
        db.close()


def generate_new_jobs(count=10):
    """Generate a batch of new jobs."""
    db = SessionLocal()
    try:
        from app.models.tenant import Tenant
        tenant = db.query(Tenant).first()
        if not tenant:
            return

        for _ in range(count):
            job = generate_single_job(tenant.id)
            db.add(job)
        db.commit()
        print(f"[JobGen] Added {count} new jobs")
    finally:
        db.close()


def seed_initial_jobs(min_count=500):
    """Seed initial jobs if DB has fewer than min_count."""
    db = SessionLocal()
    try:
        from app.models.tenant import Tenant
        tenant = db.query(Tenant).first()
        if not tenant:
            return

        current = db.query(Job).filter(Job.tenant_id == tenant.id, Job.status == "active").count()
        if current >= min_count:
            print(f"[JobGen] Already have {current} active jobs, skipping seed")
            return

        needed = min_count - current
        print(f"[JobGen] Seeding {needed} jobs (have {current}, need {min_count})...")

        for i in range(needed):
            db.add(generate_single_job(tenant.id))
            if (i + 1) % 100 == 0:
                db.commit()
                print(f"[JobGen]   {i + 1}/{needed} created")

        db.commit()
        print(f"[JobGen] Seed complete: {needed} jobs added")
    finally:
        db.close()


def refresh_jobs():
    """Called on every portal visit: expire old jobs + add a few new ones."""
    expire_old_jobs()
    # Add 2-5 new jobs each time someone visits (simulates real-time postings)
    generate_new_jobs(count=random.randint(2, 5))


def start_background_generator(interval_seconds=3600):
    """Background thread that generates new jobs every hour."""
    def _loop():
        while True:
            time.sleep(interval_seconds)
            try:
                expire_old_jobs()
                generate_new_jobs(count=random.randint(5, 15))
            except Exception as e:
                print(f"[JobGen] Background error: {e}")

    t = threading.Thread(target=_loop, daemon=True)
    t.start()
    print(f"[JobGen] Background generator started (every {interval_seconds}s)")
