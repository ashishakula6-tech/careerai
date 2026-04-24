"""
Seeds jobs across EVERY industry — not just IT.
Photography, teaching, healthcare, finance, hospitality, fitness, legal, etc.
"""
import httpx, json, random

base = 'http://localhost:8000/api/v1'
r = httpx.post(f'{base}/auth/login', params={'email': 'admin@demo.example.com', 'password': 'admin123'})
token = r.json()['access_token']
h = {'Authorization': f'Bearer {token}'}

titles_skills = {
    # Photography / Creative
    "Photographer": ["Photography", "Lightroom", "Photoshop", "Camera Operation", "Lighting", "Photo Editing"],
    "Wedding Photographer": ["Wedding Photography", "Portrait Photography", "Lightroom", "Photoshop", "Lighting"],
    "Product Photographer": ["Product Photography", "Lighting", "Photoshop", "E-commerce", "Photo Editing"],
    "Videographer": ["Videography", "Premiere Pro", "Camera Operation", "Lighting", "Video Editing"],
    "Video Editor": ["Video Editing", "Premiere Pro", "After Effects", "DaVinci Resolve", "Color Grading"],
    "Motion Graphics Designer": ["After Effects", "Motion Graphics", "Animation", "Illustrator", "Cinema 4D"],
    "Graphic Designer": ["Photoshop", "Illustrator", "InDesign", "Graphic Design", "Branding", "Typography"],
    "UI/UX Designer": ["Figma", "UI/UX", "Wireframing", "Prototyping", "User Research"],
    "3D Artist": ["Blender", "Maya", "3D Modeling", "Texturing", "Animation"],
    "Interior Designer": ["Interior Design", "AutoCAD", "Space Planning", "3D Modeling", "Color Theory"],
    "Fashion Designer": ["Fashion Design", "Pattern Making", "Sewing", "Illustrator", "Textile"],
    # Teaching / Education
    "School Teacher": ["Teaching", "Lesson Planning", "Classroom Management", "Curriculum Design"],
    "Math Teacher": ["Teaching", "Mathematics", "Lesson Planning", "Assessment", "STEM Education"],
    "Science Teacher": ["Teaching", "Science", "Lab Management", "STEM Education", "Lesson Planning"],
    "English Teacher": ["English Teaching", "ESL", "Grammar", "Lesson Planning", "Communication"],
    "Online Tutor": ["Online Teaching", "Tutoring", "E-learning", "Communication", "Subject Expertise"],
    "Corporate Trainer": ["Corporate Training", "Presentation Skills", "Workshop Facilitation", "Coaching"],
    "Yoga Instructor": ["Yoga", "Fitness Coaching", "Meditation", "Wellness", "Communication"],
    "Music Teacher": ["Music", "Teaching", "Piano", "Guitar", "Vocal Training"],
    "Dance Instructor": ["Dance", "Choreography", "Teaching", "Fitness", "Performance"],
    "IELTS Trainer": ["IELTS", "English Teaching", "ESL", "TEFL", "Communication"],
    "Professor": ["Teaching", "Research", "Curriculum Design", "PhD", "Publications"],
    # Healthcare
    "Registered Nurse": ["Nursing", "Patient Care", "Clinical", "First Aid", "CPR", "EHR"],
    "Pharmacist": ["Pharmacy", "Drug Safety", "Patient Counseling", "Clinical", "Compliance"],
    "Physiotherapist": ["Physiotherapy", "Patient Care", "Exercise Therapy", "Clinical"],
    "Lab Technician": ["Lab Technician", "Clinical", "Testing", "Quality Control", "Safety"],
    "Dental Hygienist": ["Dental", "Patient Care", "Oral Health", "Clinical", "X-Ray"],
    "Medical Coder": ["Medical Coding", "ICD-10", "CPT", "Medical Billing", "HIPAA"],
    "Nutritionist": ["Nutrition", "Dietetics", "Meal Planning", "Health Coaching", "Wellness"],
    "Psychologist": ["Psychology", "Counseling", "Therapy", "Assessment", "Communication"],
    "Veterinarian": ["Veterinary", "Animal Care", "Surgery", "Diagnostics", "Clinical"],
    "Paramedic": ["Emergency Care", "First Aid", "CPR", "Patient Care", "Ambulance"],
    # Finance / Accounting
    "Accountant": ["Accounting", "Bookkeeping", "Taxation", "Tally", "Excel", "QuickBooks"],
    "Financial Analyst": ["Financial Analysis", "Excel", "Budgeting", "Forecasting", "SQL"],
    "Tax Consultant": ["Taxation", "Audit", "Compliance", "Accounting", "Financial Planning"],
    "Investment Banker": ["Investment", "Financial Analysis", "Banking", "Excel", "Valuation"],
    "Insurance Agent": ["Insurance", "Sales", "Client Relations", "Negotiation", "Compliance"],
    "Auditor": ["Audit", "Accounting", "Compliance", "Risk Management", "Excel"],
    "Loan Officer": ["Banking", "Loan Processing", "Financial Analysis", "Customer Service"],
    "Bookkeeper": ["Bookkeeping", "QuickBooks", "Tally", "Excel", "Accounting"],
    # Marketing / Sales
    "Digital Marketing Manager": ["Digital Marketing", "SEO", "Google Ads", "Social Media Marketing", "Analytics"],
    "Social Media Manager": ["Social Media Marketing", "Content Writing", "Canva", "Analytics", "Branding"],
    "Content Writer": ["Content Writing", "Blogging", "SEO", "Copywriting", "Research"],
    "Copywriter": ["Copywriting", "Content Writing", "Branding", "Communication", "Creativity"],
    "SEO Specialist": ["SEO", "Google Analytics", "Content Marketing", "HTML", "Link Building"],
    "Email Marketing Specialist": ["Email Marketing", "Mailchimp", "Copywriting", "Analytics", "A/B Testing"],
    "Brand Manager": ["Brand Management", "Marketing", "Strategy", "Analytics", "Communication"],
    "Sales Executive": ["Sales", "Negotiation", "Cold Calling", "CRM", "Lead Generation"],
    "Real Estate Agent": ["Real Estate", "Sales", "Negotiation", "Property Management", "Client Relations"],
    "Business Development Manager": ["Business Development", "Sales", "Strategy", "Negotiation", "CRM"],
    "Telecaller": ["Cold Calling", "Sales", "Communication", "CRM", "Customer Service"],
    # HR / Admin
    "HR Manager": ["Recruitment", "Employee Relations", "Performance Management", "HR Analytics", "Payroll"],
    "Recruiter": ["Recruitment", "Talent Acquisition", "Interviewing", "Sourcing", "ATS"],
    "Office Administrator": ["Office Administration", "Scheduling", "Data Entry", "Excel", "Communication"],
    "Executive Assistant": ["Executive Assistant", "Scheduling", "Communication", "Excel", "Organization"],
    "Receptionist": ["Receptionist", "Customer Service", "Communication", "Scheduling", "Office Administration"],
    "Virtual Assistant": ["Virtual Assistant", "Data Entry", "Email Management", "Scheduling", "Communication"],
    "Data Entry Operator": ["Data Entry", "Excel", "Typing", "Accuracy", "Office Administration"],
    # Legal
    "Lawyer": ["Legal Research", "Litigation", "Contract Drafting", "Corporate Law", "Legal Writing"],
    "Paralegal": ["Paralegal", "Legal Research", "Documentation", "Filing", "Compliance"],
    "Legal Advisor": ["Legal Research", "Compliance", "Contract Drafting", "Corporate Law", "Advisory"],
    "Company Secretary": ["Company Secretary", "Compliance", "Corporate Law", "Board Meetings", "Regulatory"],
    # Engineering / Construction
    "Civil Engineer": ["Civil Engineering", "AutoCAD", "Construction Management", "Structural Design"],
    "Mechanical Engineer": ["Mechanical Engineering", "SolidWorks", "AutoCAD", "Manufacturing", "Quality Control"],
    "Electrical Engineer": ["Electrical Engineering", "Circuit Design", "PLC", "AutoCAD", "Safety"],
    "Architect": ["Architecture", "AutoCAD", "3D Modeling", "Design", "Urban Planning"],
    "Site Supervisor": ["Construction Management", "Site Supervision", "Safety Management", "Quality Control"],
    "Quantity Surveyor": ["Quantity Surveying", "Cost Estimation", "AutoCAD", "Project Planning"],
    "HVAC Technician": ["HVAC", "Installation", "Maintenance", "Troubleshooting", "Safety"],
    "Plumber": ["Plumbing", "Installation", "Maintenance", "Safety", "Troubleshooting"],
    "Electrician": ["Electrical", "Wiring", "Installation", "Maintenance", "Safety"],
    "Welder": ["Welding", "MIG", "TIG", "Fabrication", "Blueprint Reading"],
    # Hospitality / Food
    "Hotel Manager": ["Hotel Management", "Front Desk", "Customer Service", "Revenue Management"],
    "Chef": ["Cooking", "Chef", "Menu Planning", "Food Safety", "Kitchen Management"],
    "Pastry Chef": ["Baking", "Pastry", "Cooking", "Food Safety", "Creativity"],
    "Bartender": ["Bartending", "Mixology", "Customer Service", "Hospitality"],
    "Restaurant Manager": ["Restaurant Management", "Customer Service", "Inventory", "Team Management"],
    "Barista": ["Coffee", "Customer Service", "Hospitality", "Latte Art"],
    "Housekeeping Manager": ["Housekeeping", "Hotel Management", "Quality Control", "Team Management"],
    "Event Planner": ["Event Planning", "Event Management", "Budgeting", "Vendor Management", "Communication"],
    "Tour Guide": ["Tour Guide", "Tourism", "Communication", "History", "Languages"],
    "Travel Agent": ["Travel Planning", "Ticketing", "Tourism", "Customer Service", "Booking"],
    # Fitness / Sports
    "Personal Trainer": ["Personal Training", "Fitness Coaching", "Nutrition", "Exercise Science"],
    "Gym Manager": ["Gym Management", "Fitness", "Team Management", "Sales", "Customer Service"],
    "Sports Coach": ["Sports Coaching", "Athletics", "Training", "Team Management", "Strategy"],
    "Zumba Instructor": ["Zumba", "Fitness Coaching", "Dance", "Group Training", "Motivation"],
    "Swimming Coach": ["Swimming", "Coaching", "Water Safety", "Fitness", "Training"],
    # Logistics / Delivery
    "Warehouse Manager": ["Warehouse Management", "Inventory Management", "Logistics", "Team Management"],
    "Supply Chain Manager": ["Supply Chain", "Logistics", "Procurement", "Vendor Management", "Analytics"],
    "Delivery Driver": ["Driving", "Navigation", "Customer Service", "Time Management"],
    "Procurement Manager": ["Procurement", "Vendor Management", "Negotiation", "Supply Chain", "Budgeting"],
    "Import Export Manager": ["Import Export", "Customs", "Documentation", "Logistics", "Compliance"],
    # Agriculture / Environment
    "Agricultural Scientist": ["Agriculture", "Research", "Soil Science", "Crop Management"],
    "Farm Manager": ["Farming", "Agriculture", "Team Management", "Budgeting", "Operations"],
    "Environmental Consultant": ["Environmental Science", "Sustainability", "Compliance", "Research"],
    "Sustainability Manager": ["Sustainability", "Renewable Energy", "ESG", "Compliance", "Strategy"],
    # Media / Journalism
    "Journalist": ["Journalism", "Reporting", "Writing", "Editing", "Research"],
    "News Anchor": ["Broadcasting", "Communication", "Journalism", "Public Speaking"],
    "Podcast Producer": ["Podcast", "Audio Editing", "Content", "Storytelling", "Marketing"],
    "Radio Jockey": ["Radio", "Broadcasting", "Communication", "Entertainment", "Public Speaking"],
    "Translator": ["Translation", "Languages", "Localization", "Communication", "Writing"],
    # Automotive
    "Auto Mechanic": ["Auto Repair", "Diagnostics", "Maintenance", "Engine", "Troubleshooting"],
    "Automobile Engineer": ["Automotive Engineering", "Design", "Manufacturing", "Quality", "Safety"],
    # Retail
    "Store Manager": ["Retail Management", "Sales", "Inventory", "Customer Service", "Team Management"],
    "Visual Merchandiser": ["Visual Merchandising", "Retail", "Design", "Branding", "Display"],
    "Cashier": ["Cash Handling", "Customer Service", "POS", "Communication"],
    # Government / NGO
    "Social Worker": ["Social Work", "Counseling", "Community", "Communication", "Empathy"],
    "NGO Program Manager": ["Program Management", "Fundraising", "Community", "Strategy", "Reporting"],
    "Policy Analyst": ["Policy Analysis", "Research", "Writing", "Government", "Analytics"],
    # Others
    "Pilot": ["Aviation", "Flying", "Navigation", "Safety", "Communication"],
    "Cabin Crew": ["Hospitality", "Safety", "Communication", "Customer Service", "First Aid"],
    "Security Guard": ["Security", "Surveillance", "Communication", "Physical Fitness", "Safety"],
    "Housekeeper": ["Housekeeping", "Cleaning", "Organization", "Time Management"],
    "Nanny": ["Childcare", "First Aid", "Communication", "Patience", "Organization"],
    "Pet Groomer": ["Pet Grooming", "Animal Care", "Customer Service", "Hygiene"],
    "Florist": ["Floral Design", "Creativity", "Customer Service", "Event Planning"],
    "Tailor": ["Sewing", "Pattern Making", "Alteration", "Fashion", "Attention to Detail"],
    "Makeup Artist": ["Makeup", "Beauty", "Bridal Makeup", "SFX", "Creativity"],
    "Hair Stylist": ["Hair Styling", "Coloring", "Cutting", "Customer Service", "Trends"],
}

locations = [
    # India heavy
    "Bangalore, India", "Hyderabad, India", "Mumbai, India", "Pune, India", "Chennai, India",
    "Delhi NCR, India", "Noida, India", "Gurgaon, India", "Kolkata, India", "Ahmedabad, India",
    "Jaipur, India", "Kochi, India", "Lucknow, India", "Chandigarh, India", "Indore, India",
    "Coimbatore, India", "Nagpur, India", "Surat, India", "Vadodara, India", "Trivandrum, India",
    "Mysore, India", "Bhopal, India", "Patna, India", "Ranchi, India", "Guwahati, India",
    # Dubai heavy
    "Dubai, UAE", "Abu Dhabi, UAE", "Sharjah, UAE", "Dubai Internet City, UAE", "DIFC Dubai, UAE",
    "Riyadh, Saudi Arabia", "Jeddah, Saudi Arabia", "Doha, Qatar", "Muscat, Oman", "Kuwait City, Kuwait",
    # USA
    "New York, USA", "San Francisco, USA", "Los Angeles, USA", "Chicago, USA", "Houston, USA",
    "Miami, USA", "Dallas, USA", "Seattle, USA", "Boston, USA", "Austin, USA",
    # Europe
    "London, UK", "Manchester, UK", "Berlin, Germany", "Paris, France", "Amsterdam, Netherlands",
    "Dublin, Ireland", "Barcelona, Spain", "Milan, Italy", "Zurich, Switzerland", "Stockholm, Sweden",
    # Asia Pacific
    "Singapore", "Tokyo, Japan", "Sydney, Australia", "Melbourne, Australia", "Bangkok, Thailand",
    "Kuala Lumpur, Malaysia", "Manila, Philippines", "Jakarta, Indonesia", "Hong Kong", "Seoul, South Korea",
    # Africa
    "Lagos, Nigeria", "Cape Town, South Africa", "Nairobi, Kenya", "Cairo, Egypt",
    # South America
    "Sao Paulo, Brazil", "Mexico City, Mexico", "Buenos Aires, Argentina", "Bogota, Colombia",
    # Canada
    "Toronto, Canada", "Vancouver, Canada", "Montreal, Canada",
    # Remote
    "Remote, Worldwide", "Remote, India", "Remote, USA", "Remote, Europe",
]

descs = [
    "We're hiring a {t} to join our team. Great opportunity for someone passionate about their craft. Competitive pay and growth opportunities.",
    "Looking for an experienced {t}. You'll work with a dynamic team and make a real impact. Apply if you're driven and skilled.",
    "Exciting {t} opening! Join a fast-growing organization. We value talent, dedication, and fresh ideas. Great benefits included.",
    "We need a skilled {t} who can hit the ground running. Modern workplace, supportive team, and excellent career prospects.",
    "Join us as a {t}. We offer flexible work, competitive salary, and the chance to do meaningful work every day.",
]

exp_ranges = [(0,1), (0,2), (1,3), (2,4), (2,5), (3,6), (4,8), (5,10)]
edu = ["High School", "Diploma", "Bachelor's", "Master's", "MBA", "PhD", "Certificate", None, None]
work_modes = ["remote", "hybrid", "office"]

sal_base = {0: (20000,40000), 1: (25000,50000), 2: (35000,70000), 3: (50000,90000), 4: (60000,120000), 5: (80000,150000)}
multipliers = {"India": 0.2, "UAE": 0.7, "Saudi": 0.65, "Qatar": 0.7, "Oman": 0.5, "Kuwait": 0.6,
               "USA": 1.0, "UK": 0.85, "Germany": 0.9, "France": 0.8, "Switzerland": 1.0,
               "Japan": 0.8, "Singapore": 0.9, "Australia": 0.85, "Canada": 0.8,
               "Nigeria": 0.12, "Kenya": 0.12, "South Africa": 0.2, "Egypt": 0.15,
               "Brazil": 0.25, "Mexico": 0.25, "Argentina": 0.2, "Colombia": 0.2,
               "Philippines": 0.15, "Indonesia": 0.15, "Malaysia": 0.3, "Thailand": 0.25}

print(f"Generating {len(titles_skills)} job types...")
all_jobs = []

for title, skills in titles_skills.items():
    num_locs = random.randint(3, 6)
    for loc in random.sample(locations, num_locs):
        exp = random.choice(exp_ranges)
        wm = "remote" if "Remote" in loc else random.choices(work_modes, weights=[20, 35, 45])[0]
        s = sal_base.get(exp[0], (30000, 70000))
        mult = 1.0
        for c, m in multipliers.items():
            if c in loc: mult = m; break
        all_jobs.append({
            "title": title, "description": random.choice(descs).replace("{t}", title),
            "skills": random.sample(skills, min(len(skills), random.randint(3, len(skills)))),
            "experience_min": exp[0], "experience_max": exp[1],
            "education": random.choice(edu), "location": loc,
            "remote_allowed": wm in ("remote", "hybrid"), "work_mode": wm,
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
    if (i+1) % 100 == 0: print(f"  {i+1}/{len(all_jobs)} ({created} created)")

print(f"\nDone! {created} new jobs created")
r = httpx.get(f'{base}/portal/jobs?limit=1')
d = r.json()
print(f"Total active: {d['total']} jobs | {len(d['locations'])} locations")
