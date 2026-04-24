"""
Seed hundreds of realistic jobs across every industry, role level, and geography.
Designed for a public portal handling lakhs of candidates.
"""
import httpx
import json
import random
import itertools

base = 'http://localhost:8000/api/v1'
r = httpx.post(f'{base}/auth/login', params={'email': 'admin@demo.example.com', 'password': 'admin123'})
token = r.json()['access_token']
h = {'Authorization': f'Bearer {token}'}

# ===== JOB TEMPLATES =====

titles_and_skills = {
    # Software Engineering
    "Frontend Developer": ["React", "JavaScript", "TypeScript", "CSS", "HTML", "Next.js", "Tailwind"],
    "Backend Developer": ["Python", "Node.js", "PostgreSQL", "REST APIs", "Docker", "Redis"],
    "Full Stack Developer": ["React", "Python", "Node.js", "PostgreSQL", "Docker", "Git"],
    "Senior Software Engineer": ["Python", "Java", "System Design", "AWS", "Microservices", "Docker"],
    "Staff Engineer": ["System Design", "Go", "Kubernetes", "AWS", "Python", "Distributed Systems"],
    "Principal Engineer": ["Architecture", "System Design", "Mentoring", "AWS", "Microservices", "Python"],
    "iOS Developer": ["Swift", "SwiftUI", "Xcode", "iOS", "Core Data", "REST APIs"],
    "Android Developer": ["Kotlin", "Android Studio", "Jetpack Compose", "REST APIs", "Firebase"],
    "Mobile Developer": ["React Native", "TypeScript", "iOS", "Android", "REST APIs"],
    "Embedded Systems Engineer": ["C", "C++", "RTOS", "ARM", "IoT", "Embedded Linux"],
    "Game Developer": ["Unity", "C#", "Unreal Engine", "3D Math", "Physics", "Shaders"],
    "Blockchain Developer": ["Solidity", "Ethereum", "Web3.js", "Smart Contracts", "DeFi", "Rust"],
    "Rust Developer": ["Rust", "Systems Programming", "Concurrency", "Linux", "Performance"],
    "Go Developer": ["Go", "Microservices", "gRPC", "Kubernetes", "Docker", "PostgreSQL"],
    "Java Developer": ["Java", "Spring Boot", "Maven", "PostgreSQL", "REST APIs", "Docker"],
    "PHP Developer": ["PHP", "Laravel", "MySQL", "Redis", "Vue.js", "REST APIs"],
    "Ruby on Rails Developer": ["Ruby", "Rails", "PostgreSQL", "Redis", "Sidekiq", "Docker"],
    "Angular Developer": ["Angular", "TypeScript", "RxJS", "NgRx", "REST APIs", "CSS"],
    "Vue.js Developer": ["Vue.js", "JavaScript", "Vuex", "REST APIs", "CSS", "Node.js"],
    ".NET Developer": [".NET", "C#", "SQL Server", "Azure", "REST APIs", "Entity Framework"],
    "WordPress Developer": ["WordPress", "PHP", "JavaScript", "CSS", "WooCommerce", "MySQL"],
    "Shopify Developer": ["Shopify", "Liquid", "JavaScript", "CSS", "REST APIs", "Ruby"],
    # Data & AI
    "Data Scientist": ["Python", "Machine Learning", "SQL", "TensorFlow", "Statistics", "Pandas"],
    "Data Analyst": ["SQL", "Python", "Tableau", "Excel", "Power BI", "Statistics"],
    "Data Engineer": ["Python", "Spark", "Airflow", "SQL", "Snowflake", "dbt", "AWS"],
    "Machine Learning Engineer": ["Python", "TensorFlow", "PyTorch", "MLOps", "Docker", "Kubernetes"],
    "AI/ML Research Scientist": ["Python", "Deep Learning", "NLP", "PyTorch", "Research", "Publications"],
    "NLP Engineer": ["Python", "NLP", "Transformers", "BERT", "SpaCy", "TensorFlow"],
    "Computer Vision Engineer": ["Python", "OpenCV", "TensorFlow", "PyTorch", "Image Processing", "CNNs"],
    "MLOps Engineer": ["Python", "MLflow", "Kubernetes", "Docker", "AWS SageMaker", "CI/CD"],
    "Business Intelligence Analyst": ["SQL", "Tableau", "Power BI", "Python", "Excel", "Data Modeling"],
    "Analytics Engineer": ["SQL", "dbt", "Python", "Snowflake", "Data Modeling", "Git"],
    # DevOps & Cloud
    "DevOps Engineer": ["AWS", "Kubernetes", "Docker", "Terraform", "Jenkins", "Linux", "Python"],
    "Site Reliability Engineer": ["Linux", "Kubernetes", "Prometheus", "Grafana", "Python", "AWS"],
    "Cloud Architect": ["AWS", "Azure", "Terraform", "Kubernetes", "Networking", "Security"],
    "Platform Engineer": ["Kubernetes", "Helm", "ArgoCD", "Go", "Terraform", "Docker"],
    "Infrastructure Engineer": ["AWS", "Terraform", "Ansible", "Linux", "Networking", "Docker"],
    "Release Engineer": ["CI/CD", "Jenkins", "GitHub Actions", "Docker", "Python", "Git"],
    # Cybersecurity
    "Cybersecurity Analyst": ["SIEM", "Network Security", "Python", "Penetration Testing", "SOC2"],
    "Security Engineer": ["AWS Security", "IAM", "Encryption", "Python", "Compliance", "OWASP"],
    "Penetration Tester": ["Kali Linux", "Burp Suite", "Python", "Network Security", "OWASP"],
    "SOC Analyst": ["SIEM", "Splunk", "Threat Intelligence", "Incident Response", "Linux"],
    # Management
    "Engineering Manager": ["Leadership", "Agile", "Python", "System Design", "Hiring", "Mentoring"],
    "Technical Program Manager": ["Program Management", "Agile", "Jira", "Stakeholder Management", "Technical"],
    "Product Manager": ["Product Strategy", "Agile", "Jira", "SQL", "Analytics", "UX"],
    "Scrum Master": ["Scrum", "Agile", "Jira", "Confluence", "Facilitation", "Coaching"],
    "VP of Engineering": ["Leadership", "Strategy", "Hiring", "Architecture", "Agile", "Budget"],
    "CTO": ["Leadership", "Architecture", "Strategy", "Cloud", "Security", "Innovation"],
    "Director of Product": ["Product Strategy", "Leadership", "Roadmapping", "Analytics", "UX"],
    # Design
    "UX Designer": ["Figma", "User Research", "Wireframing", "Prototyping", "Design Thinking"],
    "UI Designer": ["Figma", "Sketch", "Adobe XD", "CSS", "Design Systems", "Typography"],
    "UX/UI Designer": ["Figma", "UI/UX", "Prototyping", "User Research", "Design Systems"],
    "Product Designer": ["Figma", "User Research", "Prototyping", "Design Systems", "CSS"],
    "Graphic Designer": ["Photoshop", "Illustrator", "InDesign", "Branding", "Typography"],
    "Motion Designer": ["After Effects", "Premiere Pro", "Cinema 4D", "Animation", "Figma"],
    # Marketing & Sales
    "Digital Marketing Manager": ["SEO", "Google Ads", "Analytics", "Social Media", "Content Strategy"],
    "Growth Hacker": ["Analytics", "A/B Testing", "SQL", "Python", "Product", "Marketing"],
    "Content Strategist": ["Content Writing", "SEO", "Analytics", "Social Media", "CMS"],
    "SEO Specialist": ["SEO", "Google Analytics", "Ahrefs", "Content", "HTML", "Link Building"],
    "Performance Marketing Manager": ["Google Ads", "Facebook Ads", "Analytics", "A/B Testing", "SQL"],
    "Sales Engineer": ["Pre-sales", "Demo", "Technical", "CRM", "APIs", "Cloud"],
    "Developer Advocate": ["Public Speaking", "Technical Writing", "Python", "JavaScript", "APIs"],
    # IT & Support
    "System Administrator": ["Linux", "Windows Server", "Active Directory", "Networking", "Scripting"],
    "Database Administrator": ["PostgreSQL", "MySQL", "MongoDB", "Backup", "Replication", "Linux"],
    "Network Engineer": ["Cisco", "Networking", "Firewall", "SD-WAN", "BGP", "Linux"],
    "IT Support Engineer": ["Windows", "Linux", "Networking", "Troubleshooting", "Active Directory"],
    "Technical Support Engineer": ["Linux", "AWS", "SQL", "Troubleshooting", "Communication"],
    "Help Desk Analyst": ["Windows", "Office 365", "Troubleshooting", "Active Directory", "ITIL"],
    # QA
    "QA Engineer": ["Selenium", "Python", "Cypress", "API Testing", "Agile", "JIRA"],
    "QA Automation Engineer": ["Selenium", "Python", "Cypress", "Jest", "CI/CD", "API Testing"],
    "Performance Test Engineer": ["JMeter", "Gatling", "Python", "Load Testing", "AWS", "Monitoring"],
    "SDET": ["Python", "Java", "Selenium", "REST APIs", "CI/CD", "Docker"],
    # Consulting & Others
    "SAP Consultant": ["SAP", "S/4HANA", "ABAP", "FICO", "Project Management"],
    "Salesforce Developer": ["Salesforce", "Apex", "Lightning", "SOQL", "JavaScript"],
    "Technical Writer": ["Technical Writing", "API Documentation", "Markdown", "Git"],
    "Solutions Architect": ["AWS", "Azure", "Solution Design", "Microservices", "Pre-sales"],
    "ERP Consultant": ["SAP", "Oracle", "ERP", "Business Process", "Project Management"],
    "Agile Coach": ["Agile", "Scrum", "Kanban", "Coaching", "Leadership", "SAFe"],
    # Emerging
    "Web3 Developer": ["Solidity", "Ethereum", "React", "Node.js", "Smart Contracts"],
    "AR/VR Developer": ["Unity", "C#", "3D", "ARKit", "ARCore", "OpenXR"],
    "Robotics Engineer": ["ROS", "Python", "C++", "Computer Vision", "Control Systems"],
    "Quantum Computing Researcher": ["Python", "Qiskit", "Linear Algebra", "Physics", "Research"],
    "Prompt Engineer": ["LLMs", "Python", "NLP", "Prompt Design", "AI", "GPT"],
}

locations = [
    # India
    "Bangalore, India", "Hyderabad, India", "Mumbai, India", "Pune, India", "Chennai, India",
    "Delhi NCR, India", "Noida, India", "Gurgaon, India", "Kolkata, India", "Ahmedabad, India",
    "Jaipur, India", "Kochi, India", "Chandigarh, India", "Indore, India", "Coimbatore, India",
    # USA
    "San Francisco, USA", "New York, USA", "Seattle, USA", "Austin, USA", "Boston, USA",
    "Chicago, USA", "Los Angeles, USA", "Denver, USA", "Atlanta, USA", "Miami, USA",
    "Portland, USA", "San Diego, USA", "Dallas, USA", "Phoenix, USA", "Raleigh, USA",
    # Europe
    "London, UK", "Berlin, Germany", "Amsterdam, Netherlands", "Paris, France", "Dublin, Ireland",
    "Barcelona, Spain", "Stockholm, Sweden", "Munich, Germany", "Zurich, Switzerland", "Warsaw, Poland",
    "Milan, Italy", "Prague, Czech Republic", "Helsinki, Finland", "Oslo, Norway", "Copenhagen, Denmark",
    "Lisbon, Portugal", "Vienna, Austria", "Brussels, Belgium", "Edinburgh, UK", "Manchester, UK",
    # Asia Pacific
    "Singapore", "Tokyo, Japan", "Seoul, South Korea", "Sydney, Australia", "Melbourne, Australia",
    "Jakarta, Indonesia", "Manila, Philippines", "Bangkok, Thailand", "Kuala Lumpur, Malaysia",
    "Ho Chi Minh City, Vietnam", "Taipei, Taiwan", "Hong Kong", "Auckland, New Zealand",
    # Middle East
    "Dubai, UAE", "Abu Dhabi, UAE", "Riyadh, Saudi Arabia", "Doha, Qatar", "Tel Aviv, Israel",
    # Africa
    "Lagos, Nigeria", "Cape Town, South Africa", "Nairobi, Kenya", "Cairo, Egypt", "Accra, Ghana",
    # South America
    "Sao Paulo, Brazil", "Buenos Aires, Argentina", "Mexico City, Mexico", "Bogota, Colombia",
    "Santiago, Chile", "Lima, Peru", "Montevideo, Uruguay", "Medellin, Colombia",
    # Canada
    "Toronto, Canada", "Vancouver, Canada", "Montreal, Canada", "Calgary, Canada", "Ottawa, Canada",
    # Remote
    "Remote, Worldwide", "Remote, USA", "Remote, Europe", "Remote, Asia Pacific", "Remote, India",
]

exp_ranges = [(0, 2), (1, 3), (2, 5), (3, 6), (4, 8), (5, 10), (6, 12), (8, 15), (10, 20)]
education_levels = ["Bachelor's", "Bachelor's in CS", "Master's", "Master's in CS", "MBA", "PhD", None, None]

descriptions = [
    "We're looking for a talented {title} to join our growing team. You'll work on challenging problems at scale, collaborate with smart people, and make a real impact. Our stack is modern and our culture values autonomy, learning, and shipping fast.",
    "Join us as a {title} and help build the future of our platform. You'll design and implement features used by millions, work in an agile environment, and have the freedom to innovate. We value clean code, strong testing, and continuous improvement.",
    "We need an experienced {title} to lead key initiatives in our engineering team. You will architect solutions, mentor junior developers, drive technical decisions, and ensure high availability of our production systems serving global users.",
    "Exciting opportunity for a {title} to work on cutting-edge technology. You'll build scalable systems, optimize performance, and collaborate cross-functionally with product, design, and data teams to deliver exceptional user experiences.",
    "We're hiring a {title} to strengthen our team. In this role, you'll develop new features from concept to deployment, participate in code reviews, write technical documentation, and contribute to our engineering culture of excellence.",
    "Looking for a passionate {title} who thrives in fast-paced environments. You'll work on a modern tech stack, ship code daily, and directly impact business outcomes. Remote-friendly culture with flexible hours and great benefits.",
    "As a {title}, you will be responsible for designing robust systems, writing production-quality code, debugging complex issues, and collaborating with stakeholders to translate business requirements into technical solutions.",
    "We're building something special and need a {title} who shares our vision. You'll have ownership over significant features, access to the latest tools, and support from a team that genuinely cares about your growth and success.",
]

salary_ranges_usd = {
    0: (40000, 70000), 1: (50000, 80000), 2: (60000, 100000), 3: (80000, 130000),
    4: (100000, 160000), 5: (120000, 180000), 6: (140000, 220000), 8: (180000, 300000), 10: (200000, 350000),
}

# Generate jobs
print("Generating jobs...")
all_jobs = []

for title, skills in titles_and_skills.items():
    # Each title gets placed in 3-5 random locations
    num_locations = random.randint(3, 5)
    selected_locations = random.sample(locations, num_locations)

    for loc in selected_locations:
        exp = random.choice(exp_ranges)
        edu = random.choice(education_levels)
        desc = random.choice(descriptions).replace("{title}", title)
        remote = random.random() > 0.4  # 60% remote friendly
        sal = salary_ranges_usd.get(exp[0], (60000, 120000))

        # Adjust salary for location
        multiplier = 1.0
        if "India" in loc: multiplier = 0.2
        elif "Philippines" in loc or "Indonesia" in loc or "Vietnam" in loc: multiplier = 0.15
        elif "Nigeria" in loc or "Kenya" in loc or "Ghana" in loc: multiplier = 0.12
        elif "Brazil" in loc or "Argentina" in loc or "Colombia" in loc or "Mexico" in loc: multiplier = 0.25
        elif "Japan" in loc: multiplier = 0.8
        elif "Korea" in loc: multiplier = 0.6
        elif "Singapore" in loc or "Hong Kong" in loc: multiplier = 0.9
        elif "UK" in loc or "Ireland" in loc: multiplier = 0.85
        elif "Germany" in loc or "Netherlands" in loc or "Switzerland" in loc: multiplier = 0.9
        elif "UAE" in loc or "Qatar" in loc or "Saudi" in loc: multiplier = 0.7
        elif "Australia" in loc or "New Zealand" in loc: multiplier = 0.85
        elif "Canada" in loc: multiplier = 0.8

        sal_min = int(sal[0] * multiplier)
        sal_max = int(sal[1] * multiplier)

        # Pick a random subset of skills (not always all)
        job_skills = random.sample(skills, min(len(skills), random.randint(3, len(skills))))

        all_jobs.append({
            "title": title,
            "description": desc,
            "skills": job_skills,
            "experience_min": exp[0],
            "experience_max": exp[1],
            "education": edu,
            "location": loc,
            "remote_allowed": remote,
            "salary_min": sal_min,
            "salary_max": sal_max,
        })

# Shuffle and send
random.shuffle(all_jobs)

print(f"Sending {len(all_jobs)} jobs to API...")

created = 0
failed = 0
batch_size = 20

for i, job in enumerate(all_jobs):
    try:
        r = httpx.post(f'{base}/jobs', params=job, headers=h, timeout=10)
        if r.status_code == 201:
            jid = r.json()['id']
            httpx.post(f'{base}/jobs/{jid}/publish', headers=h, timeout=10)
            created += 1
        else:
            failed += 1
    except Exception as e:
        failed += 1

    if (i + 1) % 50 == 0:
        print(f"  {i + 1}/{len(all_jobs)} processed ({created} created, {failed} failed)")

print(f"\nDone! {created} jobs created, {failed} failed")

# Verify
r = httpx.get(f'{base}/portal/jobs?limit=1')
print(f"Total active jobs on portal: {r.json()['total']}")
print(f"Locations: {len(r.json()['locations'])}")
