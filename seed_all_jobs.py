"""
Massive job seeder — 500+ jobs with remote/hybrid/office across the world.
Heavy on India, Dubai, and all major cities.
"""
import httpx, json, random

base = 'http://localhost:8000/api/v1'
r = httpx.post(f'{base}/auth/login', params={'email': 'admin@demo.example.com', 'password': 'admin123'})
token = r.json()['access_token']
h = {'Authorization': f'Bearer {token}'}

titles_and_skills = {
    "Frontend Developer": ["React", "JavaScript", "TypeScript", "CSS", "HTML", "Next.js"],
    "Backend Developer": ["Python", "Node.js", "PostgreSQL", "REST APIs", "Docker"],
    "Full Stack Developer": ["React", "Python", "Node.js", "PostgreSQL", "Docker"],
    "Senior Software Engineer": ["Python", "Java", "System Design", "AWS", "Microservices"],
    "Staff Engineer": ["System Design", "Go", "Kubernetes", "AWS", "Python"],
    "Principal Engineer": ["Architecture", "System Design", "AWS", "Microservices", "Python"],
    "iOS Developer": ["Swift", "SwiftUI", "Xcode", "iOS", "Core Data"],
    "Android Developer": ["Kotlin", "Android Studio", "Jetpack Compose", "Firebase"],
    "Mobile Developer": ["React Native", "TypeScript", "iOS", "Android"],
    "Flutter Developer": ["Flutter", "Dart", "Firebase", "REST APIs", "Mobile"],
    "Embedded Systems Engineer": ["C", "C++", "RTOS", "ARM", "IoT"],
    "Game Developer": ["Unity", "C#", "Unreal Engine", "3D Math"],
    "Blockchain Developer": ["Solidity", "Ethereum", "Web3.js", "Smart Contracts"],
    "Rust Developer": ["Rust", "Systems Programming", "Concurrency", "Linux"],
    "Go Developer": ["Go", "Microservices", "gRPC", "Kubernetes", "Docker"],
    "Java Developer": ["Java", "Spring Boot", "Maven", "PostgreSQL"],
    "PHP Developer": ["PHP", "Laravel", "MySQL", "Redis", "Vue.js"],
    "Ruby on Rails Developer": ["Ruby", "Rails", "PostgreSQL", "Redis"],
    "Angular Developer": ["Angular", "TypeScript", "RxJS", "NgRx"],
    "Vue.js Developer": ["Vue.js", "JavaScript", "Vuex", "Node.js"],
    ".NET Developer": [".NET", "C#", "SQL Server", "Azure"],
    "WordPress Developer": ["WordPress", "PHP", "JavaScript", "CSS"],
    "Shopify Developer": ["Shopify", "Liquid", "JavaScript", "Ruby"],
    "MERN Stack Developer": ["MongoDB", "Express", "React", "Node.js"],
    "MEAN Stack Developer": ["MongoDB", "Express", "Angular", "Node.js"],
    "Python Developer": ["Python", "Django", "Flask", "PostgreSQL", "REST APIs"],
    "Data Scientist": ["Python", "Machine Learning", "SQL", "TensorFlow", "Statistics"],
    "Data Analyst": ["SQL", "Python", "Tableau", "Excel", "Power BI"],
    "Data Engineer": ["Python", "Spark", "Airflow", "SQL", "Snowflake", "AWS"],
    "Machine Learning Engineer": ["Python", "TensorFlow", "PyTorch", "MLOps", "Docker"],
    "AI/ML Research Scientist": ["Python", "Deep Learning", "NLP", "PyTorch"],
    "NLP Engineer": ["Python", "NLP", "Transformers", "BERT", "SpaCy"],
    "Computer Vision Engineer": ["Python", "OpenCV", "TensorFlow", "CNNs"],
    "MLOps Engineer": ["Python", "MLflow", "Kubernetes", "Docker", "AWS SageMaker"],
    "Business Intelligence Analyst": ["SQL", "Tableau", "Power BI", "Python"],
    "Analytics Engineer": ["SQL", "dbt", "Python", "Snowflake"],
    "Prompt Engineer": ["LLMs", "Python", "NLP", "Prompt Design", "GPT"],
    "AI Engineer": ["Python", "LangChain", "OpenAI", "Vector DBs", "FastAPI"],
    "DevOps Engineer": ["AWS", "Kubernetes", "Docker", "Terraform", "Jenkins", "Linux"],
    "Site Reliability Engineer": ["Linux", "Kubernetes", "Prometheus", "Grafana", "Python"],
    "Cloud Architect": ["AWS", "Azure", "Terraform", "Kubernetes", "Security"],
    "Platform Engineer": ["Kubernetes", "Helm", "ArgoCD", "Go", "Terraform"],
    "Infrastructure Engineer": ["AWS", "Terraform", "Ansible", "Linux", "Docker"],
    "Cloud Engineer": ["AWS", "Azure", "GCP", "Terraform", "Docker"],
    "Cybersecurity Analyst": ["SIEM", "Network Security", "Python", "SOC2"],
    "Security Engineer": ["AWS Security", "IAM", "Python", "Compliance"],
    "Penetration Tester": ["Kali Linux", "Burp Suite", "Python", "OWASP"],
    "Engineering Manager": ["Leadership", "Agile", "Python", "System Design"],
    "Technical Program Manager": ["Program Management", "Agile", "Jira"],
    "Product Manager": ["Product Strategy", "Agile", "Jira", "SQL", "Analytics"],
    "Scrum Master": ["Scrum", "Agile", "Jira", "Confluence"],
    "Project Manager": ["Project Management", "Agile", "Jira", "Stakeholders"],
    "Delivery Manager": ["Delivery", "Agile", "Stakeholders", "Risk Management"],
    "UX Designer": ["Figma", "User Research", "Wireframing", "Prototyping"],
    "UI Designer": ["Figma", "Sketch", "Adobe XD", "Design Systems"],
    "UX/UI Designer": ["Figma", "UI/UX", "Prototyping", "User Research"],
    "Product Designer": ["Figma", "User Research", "Design Systems"],
    "Graphic Designer": ["Photoshop", "Illustrator", "InDesign", "Branding"],
    "Digital Marketing Manager": ["SEO", "Google Ads", "Analytics", "Social Media"],
    "Growth Hacker": ["Analytics", "A/B Testing", "SQL", "Python"],
    "Content Strategist": ["Content Writing", "SEO", "Analytics", "Social Media"],
    "SEO Specialist": ["SEO", "Google Analytics", "Ahrefs", "Content"],
    "Performance Marketing Manager": ["Google Ads", "Facebook Ads", "Analytics"],
    "Social Media Manager": ["Social Media", "Content", "Analytics", "Branding"],
    "Sales Engineer": ["Pre-sales", "Demo", "Technical", "CRM"],
    "Developer Advocate": ["Public Speaking", "Technical Writing", "Python", "APIs"],
    "System Administrator": ["Linux", "Windows Server", "Networking", "Scripting"],
    "Database Administrator": ["PostgreSQL", "MySQL", "MongoDB", "Backup"],
    "Network Engineer": ["Cisco", "Networking", "Firewall", "SD-WAN"],
    "IT Support Engineer": ["Windows", "Linux", "Networking", "Troubleshooting"],
    "Technical Support Engineer": ["Linux", "AWS", "SQL", "Troubleshooting"],
    "QA Engineer": ["Selenium", "Python", "Cypress", "API Testing"],
    "QA Automation Engineer": ["Selenium", "Python", "Cypress", "CI/CD"],
    "Performance Test Engineer": ["JMeter", "Gatling", "Python", "AWS"],
    "SDET": ["Python", "Java", "Selenium", "REST APIs", "CI/CD"],
    "SAP Consultant": ["SAP", "S/4HANA", "ABAP", "FICO"],
    "Salesforce Developer": ["Salesforce", "Apex", "Lightning", "SOQL"],
    "Technical Writer": ["Technical Writing", "API Documentation", "Markdown"],
    "Solutions Architect": ["AWS", "Azure", "Solution Design", "Microservices"],
    "ERP Consultant": ["SAP", "Oracle", "ERP", "Business Process"],
    "Business Analyst": ["Requirements", "SQL", "Jira", "Documentation"],
    "Web3 Developer": ["Solidity", "Ethereum", "React", "Smart Contracts"],
    "AR/VR Developer": ["Unity", "C#", "ARKit", "ARCore"],
    "Robotics Engineer": ["ROS", "Python", "C++", "Computer Vision"],
    "IoT Developer": ["IoT", "MQTT", "Python", "Embedded", "AWS IoT"],
    "Video Editor": ["Premiere Pro", "After Effects", "DaVinci Resolve"],
    "UI/UX Researcher": ["User Research", "Surveys", "Analytics", "Figma"],
    "Customer Success Manager": ["CRM", "Communication", "SaaS", "Analytics"],
    "HR Tech Specialist": ["HRMS", "Workday", "SAP SuccessFactors", "Analytics"],
    "FinTech Developer": ["Python", "React", "Payment APIs", "Security", "AWS"],
    "Healthcare IT Developer": ["HL7", "FHIR", "Python", "React", "HIPAA"],
}

# Heavy on India and Dubai, plus everywhere else
locations_weighted = {
    # India — lots of entries (will appear more)
    "Bangalore, India": 8, "Hyderabad, India": 7, "Mumbai, India": 6, "Pune, India": 6,
    "Chennai, India": 5, "Delhi NCR, India": 6, "Noida, India": 5, "Gurgaon, India": 6,
    "Kolkata, India": 4, "Ahmedabad, India": 4, "Jaipur, India": 3, "Kochi, India": 3,
    "Chandigarh, India": 3, "Indore, India": 3, "Coimbatore, India": 3, "Lucknow, India": 2,
    "Nagpur, India": 2, "Visakhapatnam, India": 2, "Bhubaneswar, India": 2, "Trivandrum, India": 2,
    "Mysore, India": 2, "Mangalore, India": 2, "Vadodara, India": 2, "Surat, India": 2,
    # Dubai/UAE/Middle East — lots
    "Dubai, UAE": 7, "Abu Dhabi, UAE": 5, "Sharjah, UAE": 3, "Dubai Internet City, UAE": 4,
    "Dubai Silicon Oasis, UAE": 3, "DIFC Dubai, UAE": 3, "Riyadh, Saudi Arabia": 4,
    "Jeddah, Saudi Arabia": 3, "Doha, Qatar": 3, "Muscat, Oman": 2, "Kuwait City, Kuwait": 2,
    "Manama, Bahrain": 2, "Tel Aviv, Israel": 3,
    # USA
    "San Francisco, USA": 5, "New York, USA": 5, "Seattle, USA": 4, "Austin, USA": 4,
    "Boston, USA": 3, "Chicago, USA": 3, "Los Angeles, USA": 3, "Denver, USA": 3,
    "Atlanta, USA": 3, "Miami, USA": 2, "Portland, USA": 2, "San Diego, USA": 2,
    "Dallas, USA": 3, "Phoenix, USA": 2, "Raleigh, USA": 2, "San Jose, USA": 3,
    "Washington DC, USA": 3, "Houston, USA": 2, "Minneapolis, USA": 2, "Detroit, USA": 2,
    # Europe
    "London, UK": 5, "Berlin, Germany": 4, "Amsterdam, Netherlands": 4, "Paris, France": 3,
    "Dublin, Ireland": 4, "Barcelona, Spain": 3, "Stockholm, Sweden": 3, "Munich, Germany": 3,
    "Zurich, Switzerland": 3, "Warsaw, Poland": 3, "Milan, Italy": 2, "Prague, Czech Republic": 2,
    "Helsinki, Finland": 2, "Oslo, Norway": 2, "Copenhagen, Denmark": 2, "Lisbon, Portugal": 3,
    "Vienna, Austria": 2, "Brussels, Belgium": 2, "Edinburgh, UK": 2, "Manchester, UK": 3,
    "Hamburg, Germany": 2, "Frankfurt, Germany": 2, "Bucharest, Romania": 2, "Tallinn, Estonia": 2,
    # Asia Pacific
    "Singapore": 5, "Tokyo, Japan": 4, "Seoul, South Korea": 3, "Sydney, Australia": 4,
    "Melbourne, Australia": 3, "Jakarta, Indonesia": 3, "Manila, Philippines": 3,
    "Bangkok, Thailand": 3, "Kuala Lumpur, Malaysia": 3, "Ho Chi Minh City, Vietnam": 3,
    "Taipei, Taiwan": 2, "Hong Kong": 3, "Auckland, New Zealand": 2, "Shenzhen, China": 2,
    # Africa
    "Lagos, Nigeria": 3, "Cape Town, South Africa": 3, "Nairobi, Kenya": 3, "Cairo, Egypt": 2,
    "Accra, Ghana": 2, "Johannesburg, South Africa": 2, "Dar es Salaam, Tanzania": 1,
    # South America
    "Sao Paulo, Brazil": 3, "Buenos Aires, Argentina": 3, "Mexico City, Mexico": 3,
    "Bogota, Colombia": 3, "Santiago, Chile": 2, "Lima, Peru": 2, "Medellin, Colombia": 2,
    "Montevideo, Uruguay": 2,
    # Canada
    "Toronto, Canada": 4, "Vancouver, Canada": 3, "Montreal, Canada": 3, "Calgary, Canada": 2,
    "Ottawa, Canada": 2, "Waterloo, Canada": 2,
    # Remote
    "Remote, Worldwide": 6, "Remote, USA": 4, "Remote, Europe": 4, "Remote, India": 5,
    "Remote, Asia Pacific": 3, "Remote, Middle East": 3,
}

# Build weighted location list
weighted_locations = []
for loc, weight in locations_weighted.items():
    weighted_locations.extend([loc] * weight)

descriptions = [
    "We're looking for a talented {title} to join our growing team. You'll work on challenging problems at scale, collaborate with smart people, and make a real impact.",
    "Join us as a {title} and help build the future of our platform. You'll design and implement features used by millions in an agile environment.",
    "We need an experienced {title} to lead key initiatives. You will architect solutions, mentor developers, and drive technical decisions.",
    "Exciting opportunity for a {title} to work on cutting-edge technology. Build scalable systems and collaborate cross-functionally.",
    "We're hiring a {title} to develop new features from concept to deployment. Participate in code reviews and contribute to engineering culture.",
    "Looking for a passionate {title} who thrives in fast-paced environments. Ship code daily and directly impact business outcomes.",
    "As a {title}, you will design robust systems, write production-quality code, and translate business requirements into technical solutions.",
    "We're building something special and need a {title} who shares our vision. Ownership, latest tools, and a team that cares about your growth.",
]

exp_ranges = [(0,2), (1,3), (2,5), (3,6), (4,8), (5,10), (6,12), (8,15), (10,20)]
edu = ["Bachelor's", "Bachelor's in CS", "Master's", "Master's in CS", "MBA", "PhD", None, None]

sal_usd = {0:(40000,70000), 1:(50000,80000), 2:(60000,100000), 3:(80000,130000),
            4:(100000,160000), 5:(120000,180000), 6:(140000,220000), 8:(180000,300000), 10:(200000,350000)}

multipliers = {"India": 0.2, "Philippines": 0.15, "Indonesia": 0.15, "Vietnam": 0.15,
               "Nigeria": 0.12, "Kenya": 0.12, "Ghana": 0.12, "Tanzania": 0.1,
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
               "Australia": 0.85, "New Zealand": 0.75,
               "South Africa": 0.2, "Egypt": 0.15,
               "Canada": 0.8}

work_modes = ["remote", "hybrid", "office"]

print("Generating jobs...")
all_jobs = []

for title, skills in titles_and_skills.items():
    num = random.randint(4, 7)
    locs = random.choices(weighted_locations, k=num)
    # Deduplicate
    locs = list(dict.fromkeys(locs))[:num]

    for loc in locs:
        exp = random.choice(exp_ranges)
        wm = random.choices(work_modes, weights=[30, 35, 35])[0]  # ~30% remote, 35% hybrid, 35% office
        if "Remote" in loc:
            wm = "remote"

        desc = random.choice(descriptions).replace("{title}", title)
        s = sal_usd.get(exp[0], (60000, 120000))
        mult = 1.0
        for country, m in multipliers.items():
            if country in loc:
                mult = m
                break

        all_jobs.append({
            "title": title, "description": desc,
            "skills": random.sample(skills, min(len(skills), random.randint(3, len(skills)))),
            "experience_min": exp[0], "experience_max": exp[1],
            "education": random.choice(edu),
            "location": loc, "remote_allowed": wm in ("remote", "hybrid"), "work_mode": wm,
            "salary_min": int(s[0] * mult), "salary_max": int(s[1] * mult),
        })

random.shuffle(all_jobs)
print(f"Sending {len(all_jobs)} jobs...")

created = 0
for i, job in enumerate(all_jobs):
    try:
        r = httpx.post(f'{base}/jobs', params=job, headers=h, timeout=10)
        if r.status_code == 201:
            httpx.post(f'{base}/jobs/{r.json()["id"]}/publish', headers=h, timeout=10)
            created += 1
    except: pass
    if (i+1) % 100 == 0:
        print(f"  {i+1}/{len(all_jobs)} ({created} created)")

print(f"\nDone! {created} jobs created")
r = httpx.get(f'{base}/portal/jobs?limit=1')
d = r.json()
print(f"Total: {d['total']} jobs | {len(d['locations'])} locations")

# Count by region
for region in ["India", "UAE", "Dubai", "USA", "UK", "Germany", "Remote"]:
    r = httpx.get(f'{base}/portal/jobs?location={region}&limit=1')
    print(f"  {region}: {r.json()['total']} jobs")
