import React, { useState, useEffect } from 'react';
import api from '../services/api';
import AIInterview from '../components/AIInterview';
import VideoRecorder from '../components/VideoRecorder';

export default function CandidatePortal() {
  // view: landing | upload | matches | job-detail | record-video | apply-success | status | data | interview | inbox | search-results
  const [view, setView] = useState('landing');
  const [email, setEmail] = useState('');
  const [pendingAppId, setPendingAppId] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Candidate auth
  const [candidateAuth, setCandidateAuth] = useState(null); // { name, email, token }
  const [authView, setAuthView] = useState(null); // null | 'login' | 'register'
  const [authForm, setAuthForm] = useState({ email: '', password: '', first_name: '', last_name: '', phone: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Landing search
  const [landingQuery, setLandingQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Recent jobs on landing
  const [recentJobs, setRecentJobs] = useState([]);
  const [recentJobsLoading, setRecentJobsLoading] = useState(true);
  const [landingSelectedJob, setLandingSelectedJob] = useState(null); // job shown in right panel

  // Resume + profile
  const [resume, setResume] = useState(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', password: '', consent: false });
  const [useManual, setUseManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    job_title: '', experience_years: '', experience_details: '',
    location: '', summary: '', is_fresher: false,
  });
  const [skillInput, setSkillInput] = useState('');
  const [manualSkills, setManualSkills] = useState([]);
  const [educationList, setEducationList] = useState([{ degree: '', field: '', university: '', year: '' }]);
  const [profile, setProfile] = useState(null);
  const [matchedJobs, setMatchedJobs] = useState([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [totalMatched, setTotalMatched] = useState(0);

  // Filters on matched results
  const [filterLocation, setFilterLocation] = useState('');
  const [filterExpMin, setFilterExpMin] = useState('');
  const [filterExpMax, setFilterExpMax] = useState('');
  const [filterWorkMode, setFilterWorkMode] = useState(''); // '' | 'remote' | 'hybrid' | 'office'
  const [filterMatch, setFilterMatch] = useState('');   // '' | 'great' | 'good' | 'low'
  const [filterSearch, setFilterSearch] = useState('');

  // Job apply
  const [selectedJob, setSelectedJob] = useState(null);
  const [applyResult, setApplyResult] = useState(null); // kept for apply-success view
  const [jobDetailReturn, setJobDetailReturn] = useState('matches'); // where to go when user hits Back on job-detail

  // Status
  const [applications, setApplications] = useState([]);

  // Inbox
  const [inboxEmails, setInboxEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);

  // Interview
  const [interviewData, setInterviewData] = useState(null);

  // Skills panel
  const [skillsExpanded, setSkillsExpanded] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState(null);

  // Profile editor
  const [editedProfile, setEditedProfile] = useState(null); // working copy while editing
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveMsg, setProfileSaveMsg] = useState('');
  const [addInputs, setAddInputs] = useState({}); // { sectionKey: inputValue }

  // ==================== SESSION RESTORE + RECENT JOBS ====================
  useEffect(() => {
    // Restore candidate session from localStorage and fetch their profile
    try {
      const stored = localStorage.getItem('candidate_auth');
      if (stored) {
        const parsed = JSON.parse(stored);
        setCandidateAuth(parsed);
        setEmail(parsed.email || '');
        // Pre-fill upload form with known account details so they don't re-enter them
        const nameParts = (parsed.name || '').split(' ');
        setForm(f => ({
          ...f,
          first_name: parsed.first_name || nameParts[0] || '',
          last_name: parsed.last_name || nameParts.slice(1).join(' ') || '',
          phone: parsed.phone || '',
        }));
        // Silently fetch their saved profile so skills show immediately
        api.get('/portal/candidate/me', { params: { email: parsed.email }, headers: { Authorization: undefined } })
          .then(res => {
            if (res.data.profile) {
              setProfile(res.data.profile);
              // Fill phone from profile if not already in auth
              if (res.data.profile.phone && !parsed.phone) {
                setForm(f => ({ ...f, phone: res.data.profile.phone }));
              }
            }
          })
          .catch(() => {});
      }
    } catch {}

    // Load recent jobs — retry up to 3 times because free-tier backend may be waking up
    const fetchRecentJobs = (attempt = 0) => {
      api.get('/portal/jobs', { params: { limit: 50 }, headers: { Authorization: undefined } })
        .then(res => { const jobs = res.data.jobs || []; setRecentJobs(jobs); setLandingSelectedJob(jobs[0] || null); setRecentJobsLoading(false); })
        .catch(() => {
          if (attempt < 3) setTimeout(() => fetchRecentJobs(attempt + 1), 8000);
          else setRecentJobsLoading(false);
        });
    };
    fetchRecentJobs();
  }, []);

  // ==================== CANDIDATE AUTH ====================
  const handleCandidateLogin = async (e) => {
    e.preventDefault();
    setAuthError(''); setAuthLoading(true);
    try {
      const res = await api.post('/portal/candidate/login', null, {
        params: { email: authForm.email, password: authForm.password },
        headers: { Authorization: undefined },
      });
      const auth = { ...res.data.candidate, token: res.data.access_token };
      setCandidateAuth(auth);
      setEmail(auth.email);
      localStorage.setItem('candidate_auth', JSON.stringify(auth));
      // Pre-fill upload form so returning candidate doesn't retype their details
      const lnParts = (auth.name || '').split(' ');
      setForm(f => ({
        ...f,
        first_name: auth.first_name || lnParts[0] || '',
        last_name: auth.last_name || lnParts.slice(1).join(' ') || '',
        phone: auth.phone || '',
      }));
      setAuthView(null);
      setAuthForm({ email: '', password: '', first_name: '', last_name: '', phone: '' });
      // If they have an existing profile, go straight to job matches
      try {
        const pr = await api.get('/portal/candidate/me', { params: { email: auth.email }, headers: { Authorization: undefined } });
        if (pr.data.profile) {
          setProfile(pr.data.profile);
          if (pr.data.profile.phone && !auth.phone) setForm(f => ({ ...f, phone: pr.data.profile.phone }));
          // Re-run matching and navigate to matches page
          const mr = await api.get('/portal/candidate/matches', { params: { email: auth.email }, headers: { Authorization: undefined } });
          setMatchedJobs(mr.data.matched_jobs || []);
          setTotalJobs(mr.data.total_jobs || 0);
          setTotalMatched(mr.data.total_matched || 0);
          setView('matches');
        }
      } catch {}
    } catch (err) {
      setAuthError(err.response?.data?.detail || 'Login failed. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCandidateRegister = async (e) => {
    e.preventDefault();
    if (!authForm.phone.trim()) { setAuthError('Phone number is required'); return; }
    setAuthError(''); setAuthLoading(true);
    try {
      const res = await api.post('/portal/candidate/register', null, {
        params: {
          email: authForm.email, password: authForm.password,
          first_name: authForm.first_name, last_name: authForm.last_name, phone: authForm.phone,
        },
        headers: { Authorization: undefined },
      });
      const auth = { ...res.data.candidate, token: res.data.access_token };
      setCandidateAuth(auth);
      setEmail(auth.email);
      localStorage.setItem('candidate_auth', JSON.stringify(auth));
      // Pre-fill upload form with newly registered details
      setForm(f => ({
        ...f,
        first_name: auth.first_name || authForm.first_name,
        last_name: auth.last_name || authForm.last_name,
        phone: auth.phone || authForm.phone,
      }));
      setAuthView(null);
      setAuthForm({ email: '', password: '', first_name: '', last_name: '', phone: '' });
      // Fetch existing profile if they had one
      try {
        const pr = await api.get('/portal/candidate/me', { params: { email: auth.email }, headers: { Authorization: undefined } });
        if (pr.data.profile) setProfile(pr.data.profile);
      } catch {}
    } catch (err) {
      setAuthError(err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  // ==================== LANDING SEARCH ====================
  const handleLandingSearch = async (e) => {
    e.preventDefault();
    if (!landingQuery.trim()) return;
    setSearchLoading(true);
    try {
      const res = await api.get('/portal/jobs', {
        params: { q: landingQuery.trim(), limit: 20 },
        headers: { Authorization: undefined },
      });
      setSearchResults(res.data.jobs || []);
      setView('search-results');
    } catch {}
    finally { setSearchLoading(false); }
  };

  // ==================== REGISTER OR LOGIN HELPER ====================
  // Silently registers a new candidate or logs in an existing one using
  // the details from the upload form, then stores the session.
  const registerOrLogin = async () => {
    if (candidateAuth) return; // already logged in
    try {
      const res = await api.post('/portal/candidate/register', null, {
        params: { email, password: form.password, first_name: form.first_name, last_name: form.last_name, phone: form.phone },
        headers: { Authorization: undefined },
      });
      const auth = { ...res.data.candidate, token: res.data.access_token };
      setCandidateAuth(auth);
      localStorage.setItem('candidate_auth', JSON.stringify(auth));
    } catch (err) {
      const detail = err.response?.data?.detail || '';
      if (detail.includes('already registered')) {
        // Existing account — try login with the password they typed
        try {
          const res = await api.post('/portal/candidate/login', null, {
            params: { email, password: form.password },
            headers: { Authorization: undefined },
          });
          const auth = { ...res.data.candidate, token: res.data.access_token };
          setCandidateAuth(auth);
          localStorage.setItem('candidate_auth', JSON.stringify(auth));
        } catch (loginErr) {
          throw new Error(loginErr.response?.data?.detail || 'Wrong password for this email. Please enter your correct password.');
        }
      } else {
        throw new Error(detail || 'Account creation failed.');
      }
    }
  };

  // ==================== UPLOAD & MATCH ====================
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!form.consent) { setMessage('Please consent to data processing'); return; }
    if (!form.phone.trim()) { setMessage('Phone number is required'); return; }
    if (!candidateAuth && !form.password.trim()) { setMessage('Please set a password for your account'); return; }
    if (manualSkills.length === 0) { setMessage('Please add at least one skill'); return; }
    setLoading(true); setMessage('');
    try {
      await registerOrLogin();
      const res = await api.post('/portal/manual-profile', {
        email, first_name: form.first_name, last_name: form.last_name,
        phone: form.phone,
        job_title: manualForm.job_title,
        skills: manualSkills,
        experience_years: manualForm.is_fresher ? 0 : (parseInt(manualForm.experience_years) || 0),
        experience_details: manualForm.is_fresher ? 'Fresher — looking for first opportunity' : manualForm.experience_details,
        education_list: educationList.filter(e => e.degree),
        location: manualForm.location,
        summary: manualForm.summary,
        is_fresher: manualForm.is_fresher,
      }, { headers: { Authorization: undefined } });
      setProfile(res.data.profile);
      setMatchedJobs(res.data.matched_jobs || []);
      setTotalJobs(res.data.total_jobs || 0);
      setTotalMatched(res.data.total_matched || 0);
      setView('matches');
    } catch (err) { setMessage(err.response?.data?.detail || 'Submit failed'); }
    finally { setLoading(false); }
  };

  const addManualSkill = () => {
    const s = skillInput.trim();
    if (s && !manualSkills.includes(s)) { setManualSkills([...manualSkills, s]); setSkillInput(''); }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!useManual && !resume) { setMessage('Please upload your resume or fill in manually'); return; }
    if (useManual) { handleManualSubmit(e); return; }
    if (!form.consent) { setMessage('Please consent to data processing'); return; }
    if (!form.phone.trim()) { setMessage('Phone number is required'); return; }
    if (!candidateAuth && !form.password.trim()) { setMessage('Please set a password for your account'); return; }
    setLoading(true); setMessage('');
    try {
      await registerOrLogin();
      const nameParts = (candidateAuth?.name || '').split(' ');
      const fd = new FormData();
      fd.append('email', email);
      fd.append('first_name', form.first_name || candidateAuth?.first_name || nameParts[0] || '');
      fd.append('last_name', form.last_name || candidateAuth?.last_name || nameParts.slice(1).join(' ') || '');
      fd.append('phone', form.phone || candidateAuth?.phone || '');
      fd.append('consent_job_application', 'true');
      fd.append('resume', resume);
      const res = await api.post('/portal/upload-resume', fd, {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: undefined },
      });
      setProfile(res.data.profile);
      setMatchedJobs(res.data.matched_jobs || []);
      setTotalJobs(res.data.total_jobs || 0);
      setTotalMatched(res.data.total_matched || 0);
      setView('matches');
    } catch (err) { setMessage(err.response?.data?.detail || 'Upload failed'); }
    finally { setLoading(false); }
  };

  // ==================== APPLY (creates application, then goes to video) ====================
  const handleApply = async () => {
    if (!selectedJob) return;
    setLoading(true); setMessage('');
    try {
      const fd = new FormData();
      fd.append('job_id', selectedJob.id);
      fd.append('email', email);
      fd.append('first_name', form.first_name);
      fd.append('last_name', form.last_name);
      fd.append('consent_job_application', 'true');
      fd.append('resume', resume);
      const res = await api.post('/portal/apply', fd, {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: undefined },
      });
      setPendingAppId(res.data.application_id);
      setView('record-video'); // Go to video recording step
    } catch (err) { setMessage(err.response?.data?.detail || 'Apply failed'); }
    finally { setLoading(false); }
  };

  // ==================== VIDEO UPLOAD + AI EVALUATION ====================
  const [videoEvaluation, setVideoEvaluation] = useState(null);

  const handleVideoSubmit = async (videoBlob, duration, transcript) => {
    if (!pendingAppId) return;
    setLoading(true); setMessage('');
    try {
      const fd = new FormData();
      fd.append('email', email);
      fd.append('duration', Math.round(duration));
      fd.append('transcript', transcript || '');
      fd.append('video', videoBlob, 'pitch.webm');
      const res = await api.post(`/portal/application/${pendingAppId}/video`, fd, {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: undefined },
      });
      setVideoEvaluation(res.data.evaluation);
      setMatchedJobs(prev => prev.map(j => j.id === selectedJob?.id ? { ...j, already_applied: true } : j));
      setView('apply-success');
      setApplyResult(res.data);
    } catch (err) { setMessage(err.response?.data?.detail || 'Video upload failed'); }
    finally { setLoading(false); }
  };

  // ==================== STATUS ====================
  const checkStatus = async () => {
    if (!email) { setMessage('Please enter your email'); return; }
    setLoading(true); setMessage('');
    try {
      const res = await api.get('/portal/applications', { params: { email }, headers: { Authorization: undefined } });
      setApplications(res.data.applications || []);
      if (!res.data.applications.length) setMessage('No applications found');
    } catch (err) { setMessage('Failed'); }
    finally { setLoading(false); }
  };

  // ==================== INTERVIEW ====================
  const startInterview = async (applicationId) => {
    setLoading(true); setMessage('');
    try {
      const fd = new FormData();
      fd.append('application_id', applicationId);
      fd.append('email', email);
      const res = await api.post('/portal/interview/start', fd, {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: undefined },
      });
      setInterviewData(res.data);
      setView('interview');
    } catch (err) { setMessage(err.response?.data?.detail || 'Failed to start interview'); }
    finally { setLoading(false); }
  };

  // ==================== HELPERS ====================
  const formatSalary = (min, max) => {
    if (!min && !max) return null;
    const fmt = (v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v;
    if (min && max) return `$${fmt(min)} - $${fmt(max)}`;
    return min ? `From $${fmt(min)}` : `Up to $${fmt(max)}`;
  };

  // ==================== INBOX ====================
  const loadInbox = async () => {
    if (!email) return;
    try {
      const res = await api.get('/portal/inbox', { params: { email }, headers: { Authorization: undefined } });
      setInboxEmails(res.data.emails || []);
    } catch {}
  };

  // ==================== LOGOUT ====================
  const handleLogout = () => {
    if (!window.confirm('Sign out of your candidate session? Your saved profile data on the server stays — sign back in with your email anytime.')) return;
    localStorage.removeItem('candidate_auth');
    setCandidateAuth(null);
    setAuthView(null);
    setEmail('');
    setProfile(null);
    setResume(null);
    setForm({ first_name: '', last_name: '', phone: '', consent: false });
    setUseManual(false);
    setManualForm({ job_title: '', experience_years: '', experience_details: '', location: '', summary: '', is_fresher: false });
    setManualSkills([]);
    setSkillInput('');
    setEducationList([{ degree: '', field: '', university: '', year: '' }]);
    setMatchedJobs([]);
    setTotalJobs(0);
    setTotalMatched(0);
    setApplications([]);
    setInboxEmails([]);
    setSelectedEmail(null);
    setSelectedJob(null);
    setApplyResult(null);
    setInterviewData(null);
    setPendingAppId(null);
    setMessage('');
    clearAllFilters();
    setView('landing');
  };

  // ==================== FILTER MATCHED JOBS ====================
  const uniqueLocations = [...new Set(matchedJobs.map(j => j.location).filter(Boolean))].sort();

  const filteredJobs = matchedJobs.filter(job => {
    if (filterLocation && job.location !== filterLocation) return false;
    if (filterWorkMode && (job.work_mode || 'office') !== filterWorkMode) return false;
    if (filterExpMin && (job.experience_min == null || job.experience_min < Number(filterExpMin))) return false;
    if (filterExpMax && (job.experience_max == null || job.experience_max > Number(filterExpMax))) return false;
    if (filterMatch === 'great' && job.match_score < 0.7) return false;
    if (filterMatch === 'good' && (job.match_score < 0.4 || job.match_score >= 0.7)) return false;
    if (filterMatch === 'low' && job.match_score >= 0.4) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      const haystack = `${job.title} ${job.location} ${(job.skills || []).join(' ')} ${job.description}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const hasActiveFilters = filterLocation || filterWorkMode || filterExpMin || filterExpMax || filterMatch || filterSearch;
  const clearAllFilters = () => { setFilterLocation(''); setFilterWorkMode(''); setFilterExpMin(''); setFilterExpMax(''); setFilterMatch(''); setFilterSearch(''); };

  const scoreColor = (s) => s >= 0.7 ? 'text-green-600' : s >= 0.4 ? 'text-yellow-600' : 'text-red-500';
  const scoreBarColor = (s) => s >= 0.7 ? 'bg-green-500' : s >= 0.4 ? 'bg-yellow-500' : 'bg-red-500';

  // ==================== SKILL INFO ====================
  const SKILL_INFO = {
    'python': 'A versatile high-level programming language widely used in data science, AI, web development, and automation.',
    'java': 'Object-oriented language used for enterprise apps, Android development, and scalable web backends.',
    'c++': 'High-performance systems programming language used in game development, embedded systems, and OS.',
    'c#': 'Microsoft\'s object-oriented language for Windows apps, Unity game development, and enterprise software.',
    'javascript': 'The primary language of the web — powers browser interactivity and backend via Node.js.',
    'typescript': 'Typed superset of JavaScript enabling better tooling and fewer runtime errors in large codebases.',
    'react': 'Meta\'s JavaScript library for building fast, interactive user interfaces and single-page apps.',
    'vue': 'Progressive JavaScript framework for building user interfaces with a gentle learning curve.',
    'angular': 'Google\'s TypeScript-based framework for building enterprise-scale single-page applications.',
    'node.js': 'JavaScript runtime for building scalable server-side and network applications outside the browser.',
    'next.js': 'React meta-framework with server-side rendering, static generation, and full-stack capabilities.',
    'sql': 'Standard language for querying and managing relational databases like MySQL, PostgreSQL, SQL Server.',
    'mysql': 'Widely-used open-source relational database system, backbone of many web applications.',
    'postgresql': 'Advanced open-source relational database known for reliability, standards compliance, and performance.',
    'mongodb': 'NoSQL document database storing JSON-like documents — ideal for flexible, rapidly changing data.',
    'redis': 'In-memory data store used as a high-speed cache, session store, and message broker.',
    'aws': 'Amazon Web Services — the world\'s leading cloud platform with 200+ services for compute, storage, and AI.',
    'azure': 'Microsoft\'s cloud platform offering compute, AI, databases, and DevOps services globally.',
    'gcp': 'Google Cloud Platform — cloud services for compute, big data, AI, and Kubernetes management.',
    'docker': 'Platform for packaging apps into containers so they run consistently across any environment.',
    'kubernetes': 'Open-source orchestration system for automating deployment, scaling, and management of containers.',
    'linux': 'Open-source OS kernel powering most servers, cloud infrastructure, and embedded systems worldwide.',
    'git': 'Distributed version control system for tracking code changes and collaborating across teams.',
    'devops': 'Culture and practice combining development and operations for faster, more reliable software delivery.',
    'ci/cd': 'Continuous Integration/Deployment — automating the build, test, and release pipeline.',
    'terraform': 'HashiCorp\'s Infrastructure as Code tool for provisioning cloud resources declaratively.',
    'ansible': 'Agentless automation tool for configuration management, app deployment, and orchestration.',
    'jenkins': 'Open-source automation server for building, testing, and deploying code continuously.',
    'machine learning': 'AI branch where systems learn patterns from data to make predictions without explicit programming.',
    'deep learning': 'ML subset using multi-layer neural networks — excels at image, speech, and language tasks.',
    'ai': 'Artificial Intelligence — building systems that perform tasks requiring human-like intelligence.',
    'nlp': 'Natural Language Processing — AI techniques for understanding, generating, and translating human language.',
    'computer vision': 'AI field enabling machines to interpret and understand images and video like humans.',
    'data science': 'Combining statistics, programming, and domain expertise to extract insights and value from data.',
    'data analysis': 'Inspecting, cleaning, and modeling data to discover patterns and support decision-making.',
    'tensorflow': 'Google\'s open-source ML framework for building and training neural networks at scale.',
    'pytorch': 'Meta\'s deep learning framework known for flexibility and ease of research.',
    'spark': 'Apache Spark — fast, distributed data processing engine for large-scale analytics.',
    'hadoop': 'Framework for distributed storage and processing of massive datasets across server clusters.',
    'excel': 'Microsoft\'s spreadsheet software for data analysis, financial modeling, and business reporting.',
    'power bi': 'Microsoft\'s business intelligence tool for creating interactive dashboards and data visualizations.',
    'tableau': 'Leading data visualization platform for turning raw data into insightful, shareable dashboards.',
    'blockchain': 'Decentralized distributed ledger powering cryptocurrencies, smart contracts, and Web3 apps.',
    'cybersecurity': 'Protecting computer systems, networks, and data from digital attacks, theft, and damage.',
    'networking': 'Designing, implementing, and managing computer networks and communication infrastructure.',
    'agile': 'Iterative software methodology emphasizing collaboration, flexibility, and incremental delivery.',
    'scrum': 'Agile framework using time-boxed sprints and ceremonies for structured team development.',
    'project management': 'Planning, executing, and closing projects while managing scope, time, budget, and risk.',
    'leadership': 'Guiding, motivating, and developing teams to achieve strategic organizational goals.',
    'communication': 'Clearly conveying information verbally, in writing, and through presentations to varied audiences.',
    'sem': 'Search Engine Marketing — running paid ads on search engines like Google to drive targeted traffic.',
    'seo': 'Search Engine Optimization — improving website visibility in organic (unpaid) search results.',
    'pr': 'Public Relations — managing reputation and communications between organizations and their audiences.',
    'training': 'Designing and delivering programs to build skills, knowledge, and competency in others.',
    'figma': 'Cloud-based design tool for UI/UX prototyping, wireframing, and collaborative design.',
    'flutter': 'Google\'s framework for building natively compiled apps for mobile, web, and desktop from one codebase.',
    'kotlin': 'Modern JVM language for Android development, fully interoperable with Java.',
    'swift': 'Apple\'s fast, safe programming language for iOS, macOS, watchOS, and tvOS apps.',
    'r': 'Statistical programming language for data analysis, bioinformatics, and academic research.',
    'django': 'High-level Python web framework promoting rapid development and clean design patterns.',
    'fastapi': 'Modern async Python framework for building high-performance APIs with automatic docs.',
    'spring': 'Java enterprise framework for building robust, scalable web apps and microservices.',
    'graphql': 'API query language letting clients request exactly the data they need — no over-fetching.',
    'rest api': 'Architectural style for web services using HTTP methods (GET, POST, PUT, DELETE) for CRUD operations.',
    'microservices': 'Architecture where apps are built as small, independently deployable services communicating via APIs.',
    'html': 'HyperText Markup Language — the standard for structuring and giving meaning to web content.',
    'css': 'Cascading Style Sheets — controls visual presentation, layout, and animations of web pages.',
    'testing': 'Evaluating software to find defects and verify it meets functional and performance requirements.',
    'selenium': 'Open-source framework for automating web browser actions — widely used for UI testing.',
    'power bi': 'Microsoft tool for creating interactive business intelligence reports and dashboards from data.',
    'photoshop': 'Adobe\'s industry-standard software for image editing, compositing, and graphic design.',
  };

  const getSkillInfo = (skill) => {
    const key = skill.toLowerCase().trim();
    return SKILL_INFO[key] || `${skill} is a professional skill valued across many industries and job roles.`;
  };

  // ==================== RENDER ====================

  // ===== LANDING PAGE (full screen, no header) =====
  if (view === 'landing') {
    return (
      <div className="min-h-screen relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-900" />
        <div className="absolute inset-0 bg-grid opacity-10" />
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-purple-500 rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-float" />
        <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-blue-500 rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-float" style={{ animationDelay: '3s' }} />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-pink-500 rounded-full mix-blend-screen filter blur-[100px] opacity-10 animate-float" style={{ animationDelay: '5s' }} />

        {/* Navbar */}
        <nav className="relative z-10 max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl animate-pulse-glow">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <span className="text-xl font-black text-white">CareerAI</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setView('status')} className="px-4 py-2 text-sm text-white/70 hover:text-white transition">My Applications</button>
            <a href="/login" className="px-4 py-2 text-sm text-white/70 hover:text-white transition">Recruiter Login</a>
            {candidateAuth ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    if (!candidateAuth) return;
                    if (matchedJobs.length > 0) { setView('matches'); return; }
                    // Re-fetch matches from saved profile
                    setLoading(true);
                    try {
                      const res = await api.get('/portal/candidate/matches', {
                        params: { email: candidateAuth.email },
                        headers: { Authorization: undefined },
                      });
                      setProfile(res.data.profile);
                      setMatchedJobs(res.data.matched_jobs || []);
                      setTotalJobs(res.data.total_jobs || 0);
                      setTotalMatched(res.data.total_matched || 0);
                      setEmail(candidateAuth.email);
                      setView('matches');
                    } catch {
                      setView('upload');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  title="Go to your portal"
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full border border-white/20 hover:border-white/40 transition cursor-pointer">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                    {candidateAuth.name?.charAt(0)}
                  </div>
                  <span className="text-white text-sm font-medium">{candidateAuth.name}</span>
                </button>
                <button onClick={handleLogout} className="px-3 py-1.5 text-sm text-white/60 hover:text-white border border-white/20 rounded-lg transition">Sign out</button>
              </div>
            ) : (
              <>
                <button onClick={() => { setAuthView('login'); setAuthError(''); }} className="px-4 py-2 text-sm text-white/80 hover:text-white border border-white/20 rounded-xl transition">Sign In</button>
                <button onClick={() => setView('upload')} className="px-5 py-2.5 bg-white text-indigo-700 rounded-xl font-bold text-sm hover:bg-indigo-50 transition shadow-lg">
                  Get Started Free
                </button>
              </>
            )}
          </div>
        </nav>

        {/* Hero Section */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left — Copy */}
            <div className="animate-fade-in">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur rounded-full border border-white/20 mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-medium text-white/90">1200+ jobs live across 120+ cities worldwide</span>
              </div>

              <h1 className="text-6xl font-black text-white leading-tight">
                Your next career<br />
                <span className="text-gradient-sunset">starts here.</span>
              </h1>

              <p className="text-xl text-white/70 mt-6 leading-relaxed max-w-lg">
                Upload your resume and our AI instantly matches you with the best jobs worldwide.
                Video pitch, AI interview, and you're hired — all in one place.
              </p>

              {/* Search bar */}
              <form onSubmit={handleLandingSearch} className="mt-8 flex gap-2">
                <div className="flex-1 relative">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input
                    type="text" value={landingQuery} onChange={e => setLandingQuery(e.target.value)}
                    placeholder="Search jobs — e.g. Python developer, Dubai, Remote…"
                    className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:border-white/50 focus:bg-white/15 transition text-sm backdrop-blur"
                  />
                </div>
                <button type="submit" disabled={searchLoading}
                  className="px-6 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl font-bold shadow-xl hover:scale-105 transition-all disabled:opacity-60 whitespace-nowrap">
                  {searchLoading ? 'Searching…' : 'Search Jobs'}
                </button>
              </form>

              <div className="flex items-center gap-4 mt-4">
                <button onClick={() => setView('upload')}
                  className="px-8 py-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white rounded-2xl font-bold text-lg shadow-2xl hover:shadow-purple-500/30 hover:scale-105 transition-all flex items-center gap-2">
                  Upload Resume & Find Jobs
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </button>
                <button onClick={() => setView('status')} className="px-6 py-4 text-white/80 hover:text-white font-medium transition">
                  Check Status
                </button>
              </div>

              {/* Trust badges */}
              <div className="flex items-center gap-6 mt-6 text-white/50 text-sm">
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  100% Free
                </div>
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  Secure Login
                </div>
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  GDPR Compliant
                </div>
              </div>
            </div>

            {/* Right — Visual card */}
            <div className="animate-slide-up hidden lg:block">
              <div className="relative">
                {/* Glow behind card */}
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-3xl blur-2xl opacity-30 scale-105" />

                <div className="relative glass rounded-3xl p-8 border border-white/20">
                  {/* Mock match card */}
                  <div className="bg-white/10 rounded-2xl p-5 mb-4 border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-white font-bold text-lg">Senior Software Engineer</p>
                        <p className="text-white/60 text-sm">Bangalore, India — Hybrid</p>
                      </div>
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                        <span className="text-white text-2xl font-black">87%</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-xs font-medium">Python</span>
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-xs font-medium">React</span>
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-xs font-medium">AWS</span>
                      <span className="px-2 py-0.5 bg-white/10 text-white/50 rounded text-xs">+4 more</span>
                    </div>
                  </div>

                  <div className="bg-white/10 rounded-2xl p-5 mb-4 border border-white/10 opacity-80">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-bold">Data Scientist</p>
                        <p className="text-white/60 text-sm">Dubai, UAE — Remote</p>
                      </div>
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                        <span className="text-white text-xl font-black">72%</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/10 rounded-2xl p-5 border border-white/10 opacity-60">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-bold">DevOps Engineer</p>
                        <p className="text-white/60 text-sm">London, UK — Office</p>
                      </div>
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                        <span className="text-white text-xl font-black">65%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Candidate Skills Card — shown after login */}
        {candidateAuth && profile?.skills?.length > 0 && (
          <div className="relative z-10 max-w-7xl mx-auto px-6 pb-10">
            <div className="glass rounded-2xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                    {candidateAuth.name?.charAt(0)}
                  </div>
                  <div>
                    <p className="text-white font-bold">{candidateAuth.name}</p>
                    <p className="text-white/50 text-xs">Your saved profile</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setEditedProfile(JSON.parse(JSON.stringify(profile))); setView('profile'); }}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-xl border border-white/20 transition">
                    My Profile
                  </button>
                  <button onClick={() => setView('upload')} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-xl border border-white/20 transition">
                    Update Resume
                  </button>
                </div>
              </div>
              <p className="text-white/60 text-xs mb-3">Your skills ({profile.skills.length})</p>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map(s => (
                  <span key={s} className="px-3 py-1 bg-indigo-500/20 text-indigo-200 rounded-full text-sm border border-indigo-400/30">{s}</span>
                ))}
              </div>
              {profile.summary && (
                <p className="mt-3 text-white/50 text-sm italic line-clamp-2">{profile.summary}</p>
              )}
            </div>
          </div>
        )}

        {/* Recent Jobs — left list / right detail */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 pb-16">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-2xl font-black text-white">Recently Added Jobs</h2>
            <button onClick={() => { setLandingQuery(''); setSearchResults(recentJobs); setView('search-results'); }}
              className="text-sm text-white/60 hover:text-white transition flex items-center gap-1">
              View all <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </button>
          </div>

          {recentJobsLoading ? (
            <div className="flex gap-4 h-[480px]">
              <div className="w-80 shrink-0 space-y-3 overflow-hidden">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="glass rounded-xl p-4 border border-white/10 animate-pulse">
                    <div className="h-4 bg-white/10 rounded mb-2 w-3/4" />
                    <div className="h-3 bg-white/10 rounded w-1/2" />
                  </div>
                ))}
              </div>
              <div className="flex-1 glass rounded-2xl border border-white/10 animate-pulse" />
            </div>
          ) : recentJobs.length === 0 ? (
            <div className="text-center py-12 text-white/40">
              <p className="text-sm">Jobs loading… backend is waking up, refresh in a moment.</p>
            </div>
          ) : (
            <div className="flex gap-4 h-[520px]">
              {/* Left — job list */}
              <div className="w-80 shrink-0 overflow-y-auto space-y-2 pr-1" style={{ scrollbarWidth: 'thin' }}>
                {recentJobs.map(job => (
                  <div key={job.id}
                    onClick={() => setLandingSelectedJob(job)}
                    className={`rounded-xl p-4 border cursor-pointer transition ${
                      landingSelectedJob?.id === job.id
                        ? 'bg-white/20 border-white/40 shadow-lg'
                        : 'glass border-white/10 hover:bg-white/10'
                    }`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-white font-semibold text-sm leading-tight line-clamp-2">{job.title}</p>
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                        job.work_mode === 'remote' ? 'bg-emerald-500/20 text-emerald-300' :
                        job.work_mode === 'hybrid' ? 'bg-amber-500/20 text-amber-300' :
                        'bg-blue-500/20 text-blue-300'}`}>
                        {job.work_mode || 'Office'}
                      </span>
                    </div>
                    <p className="text-white/50 text-xs flex items-center gap-1">
                      <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                      {job.location}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(job.skills || []).slice(0, 3).map(s => (
                        <span key={s} className="text-xs px-1.5 py-0.5 bg-white/10 text-white/60 rounded">{s}</span>
                      ))}
                      {(job.skills || []).length > 3 && <span className="text-xs text-white/40">+{job.skills.length - 3} more</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Right — brief job detail */}
              {landingSelectedJob ? (
                <div className="flex-1 glass rounded-2xl border border-white/20 p-6 overflow-y-auto space-y-5" style={{ scrollbarWidth: 'thin' }}>
                  {/* Title + Apply */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-white text-xl font-black leading-tight">{landingSelectedJob.title}</h3>
                      <div className="flex items-center gap-2 mt-2 flex-wrap text-sm">
                        <span className="text-white/60 flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                          {landingSelectedJob.location}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          landingSelectedJob.work_mode === 'remote' ? 'bg-emerald-500/20 text-emerald-300' :
                          landingSelectedJob.work_mode === 'hybrid' ? 'bg-amber-500/20 text-amber-300' :
                          'bg-blue-500/20 text-blue-300'}`}>
                          {landingSelectedJob.work_mode || 'Office'}
                        </span>
                        {landingSelectedJob.experience_min != null && (
                          <span className="text-white/50 text-xs">{landingSelectedJob.experience_min}–{landingSelectedJob.experience_max || '10+'}yr exp</span>
                        )}
                        {landingSelectedJob.salary_min && (
                          <span className="text-emerald-400 font-semibold text-xs">${(landingSelectedJob.salary_min/1000).toFixed(0)}K–${(landingSelectedJob.salary_max/1000).toFixed(0)}K</span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => { setSelectedJob(landingSelectedJob); setView('upload'); }}
                      className="shrink-0 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-bold text-sm hover:scale-105 transition-all shadow-lg">
                      Apply Now
                    </button>
                  </div>

                  {/* Skills */}
                  {(landingSelectedJob.skills || []).length > 0 && (
                    <div>
                      <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Required Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(landingSelectedJob.skills || []).map(s => {
                          const has = profile?.skills?.some(ps => ps.toLowerCase() === s.toLowerCase());
                          return (
                            <span key={s} className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                              profile ? (has ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 text-rose-300')
                                      : 'bg-white/10 text-white/70'}`}>
                              {profile ? (has ? '✓ ' : '✗ ') : ''}{s}
                            </span>
                          );
                        })}
                      </div>
                      {profile && <p className="text-white/30 text-xs mt-1">✓ you have · ✗ you'll learn</p>}
                    </div>
                  )}

                  {/* Description */}
                  <div>
                    <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">About the Role</p>
                    <p className="text-white/70 text-sm leading-relaxed">{landingSelectedJob.description}</p>
                  </div>

                  {/* Details row */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {[
                      { label: 'Experience', val: landingSelectedJob.experience_min != null ? `${landingSelectedJob.experience_min}–${landingSelectedJob.experience_max || '10+'} years` : 'Any' },
                      { label: 'Education', val: landingSelectedJob.education || 'Any level' },
                      { label: 'Work Mode', val: (landingSelectedJob.work_mode || 'office').charAt(0).toUpperCase() + (landingSelectedJob.work_mode || 'office').slice(1) },
                      { label: 'Salary', val: landingSelectedJob.salary_min ? `$${(landingSelectedJob.salary_min/1000).toFixed(0)}K–$${(landingSelectedJob.salary_max/1000).toFixed(0)}K` : 'Competitive' },
                    ].map(({ label, val }) => (
                      <div key={label} className="bg-white/5 rounded-xl px-3 py-2.5">
                        <p className="text-white/35 text-xs mb-0.5">{label}</p>
                        <p className="text-white/80 text-sm font-semibold">{val}</p>
                      </div>
                    ))}
                  </div>

                  {/* Posted date */}
                  {landingSelectedJob.published_at && (
                    <p className="text-white/25 text-xs">
                      Posted {new Date(landingSelectedJob.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex-1 glass rounded-2xl border border-white/10 flex items-center justify-center">
                  <p className="text-white/30 text-sm">Select a job to see details</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="relative z-10 border-t border-white/10 py-8">
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-white/40 text-sm">
            <p>CareerAI — AI-powered recruitment with human oversight</p>
            <div className="flex gap-4">
              <button onClick={() => setView('data')} className="hover:text-white/70 transition">Privacy</button>
              <a href="/login" className="hover:text-white/70 transition">Recruiter Login</a>
            </div>
          </div>
        </footer>

        {/* Auth Modal */}
        {authView && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setAuthView(null)}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-fade-in" onClick={e => e.stopPropagation()}>
              {/* Tabs */}
              <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6">
                <button onClick={() => { setAuthView('login'); setAuthError(''); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${authView === 'login' ? 'bg-white shadow text-indigo-700' : 'text-gray-500'}`}>
                  Sign In
                </button>
                <button onClick={() => { setAuthView('register'); setAuthError(''); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${authView === 'register' ? 'bg-white shadow text-indigo-700' : 'text-gray-500'}`}>
                  Register
                </button>
              </div>

              {authView === 'login' ? (
                <form onSubmit={handleCandidateLogin} className="space-y-4">
                  <h2 className="text-xl font-black text-gray-900">Welcome back</h2>
                  {authError && <p className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{authError}</p>}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Email *</label>
                    <input type="email" required value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})}
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Password *</label>
                    <input type="password" required value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})}
                      placeholder="Enter your password"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                  </div>
                  <button type="submit" disabled={authLoading}
                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:opacity-90 transition disabled:opacity-60">
                    {authLoading ? 'Signing in…' : 'Sign In'}
                  </button>
                  <p className="text-center text-sm text-gray-500">No account? <button type="button" onClick={() => { setAuthView('register'); setAuthError(''); }} className="text-indigo-600 font-semibold">Register</button></p>
                </form>
              ) : (
                <form onSubmit={handleCandidateRegister} className="space-y-4">
                  <h2 className="text-xl font-black text-gray-900">Create your account</h2>
                  {authError && <p className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{authError}</p>}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">First Name *</label>
                      <input type="text" required value={authForm.first_name} onChange={e => setAuthForm({...authForm, first_name: e.target.value})}
                        placeholder="e.g. Sarah"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Last Name *</label>
                      <input type="text" required value={authForm.last_name} onChange={e => setAuthForm({...authForm, last_name: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Email *</label>
                    <input type="email" required value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})}
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Phone *</label>
                    <input type="tel" required value={authForm.phone} onChange={e => setAuthForm({...authForm, phone: e.target.value})}
                      placeholder="+1 234 567 8900"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Password *</label>
                    <input type="password" required minLength={6} value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})}
                      placeholder="Minimum 6 characters"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                  </div>
                  <button type="submit" disabled={authLoading}
                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:opacity-90 transition disabled:opacity-60">
                    {authLoading ? 'Creating account…' : 'Create Account'}
                  </button>
                  <p className="text-center text-sm text-gray-500">Already registered? <button type="button" onClick={() => { setAuthView('login'); setAuthError(''); }} className="text-indigo-600 font-semibold">Sign In</button></p>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===== SEARCH RESULTS VIEW =====
  if (view === 'search-results') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <button onClick={() => setView('landing')} className="text-sm text-blue-600 hover:underline mb-6 inline-flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to home
          </button>
          <div className="mb-6">
            <form onSubmit={handleLandingSearch} className="flex gap-2">
              <div className="flex-1 relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" value={landingQuery} onChange={e => setLandingQuery(e.target.value)}
                  placeholder="Search by job title, company, skill, or location…"
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white" />
              </div>
              <button type="submit" className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition">Search</button>
            </form>
            <p className="text-sm text-gray-500 mt-2">{searchResults.length} jobs found for "{landingQuery}"</p>
          </div>
          <div className="space-y-4">
            {searchResults.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p>No jobs found. Try a different keyword.</p>
              </div>
            ) : searchResults.map(job => (
              <div key={job.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition cursor-pointer"
                onClick={() => { setSelectedJob(job); setJobDetailReturn('search-results'); setView('job-detail'); }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-lg">{job.title}</h3>
                    <p className="text-gray-500 text-sm mt-1 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                      {job.location}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        job.work_mode === 'remote' ? 'bg-emerald-100 text-emerald-700' :
                        job.work_mode === 'hybrid' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'}`}>
                        {job.work_mode || 'Office'}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {(job.skills || []).slice(0, 5).map(s => (
                        <span key={s} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{s}</span>
                      ))}
                    </div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setSelectedJob(job); setView('upload'); }}
                    className="shrink-0 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition">
                    Apply
                  </button>
                </div>
              </div>
            ))}
          </div>
          {searchResults.length > 0 && (
            <div className="mt-8 text-center">
              <p className="text-gray-500 text-sm mb-3">Want personalised matches? Upload your resume.</p>
              <button onClick={() => setView('upload')} className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:opacity-90 transition">
                Upload Resume & Get Matched
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Animated background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-float" style={{ animationDelay: '4s' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="cursor-pointer flex items-center gap-3" onClick={() => setView(profile ? 'matches' : 'landing')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gradient-blue">CareerAI</h1>
              <p className="text-gray-500 text-xs">AI-Powered Job Matching</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {profile && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/80 rounded-full border border-gray-200">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                  {profile.name?.charAt(0)}
                </div>
                <span className="text-gray-700 text-sm font-medium">{profile.name}</span>
              </div>
            )}
            {profile && (
              <button onClick={() => { setEditedProfile(JSON.parse(JSON.stringify(profile))); setAddInputs({}); setProfileSaveMsg(''); setView('profile'); }}
                className="px-3 py-1.5 text-sm text-indigo-600 hover:text-white hover:bg-indigo-600 font-semibold rounded-lg border border-indigo-200 hover:border-indigo-600 transition">
                My Profile
              </button>
            )}
            <button onClick={() => { setView('inbox'); loadInbox(); }} className="px-3 py-1.5 text-sm text-gray-600 hover:text-blue-600 font-medium rounded-lg hover:bg-white/50 transition relative">
              Inbox
              {inboxEmails.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">{inboxEmails.length}</span>}
            </button>
            <button onClick={() => setView('status')} className="px-3 py-1.5 text-sm text-gray-600 hover:text-blue-600 font-medium rounded-lg hover:bg-white/50 transition">My Apps</button>
            <button onClick={() => setView('data')} className="px-3 py-1.5 text-sm text-gray-600 hover:text-blue-600 font-medium rounded-lg hover:bg-white/50 transition">Privacy</button>
            <a href="/login" className="px-3 py-1.5 text-sm text-gray-500 hover:text-blue-600 font-medium">Recruiter</a>
            {(profile || email) && (
              <button onClick={handleLogout} title="Sign out of your candidate session"
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-rose-600 hover:text-white hover:bg-rose-500 font-medium rounded-lg border border-rose-200 hover:border-rose-500 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Sign out
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-4 py-8">
        {message && (
          <div className={`mb-4 p-4 rounded-2xl text-sm shadow-lg animate-fade-in ${message.includes('success') || message.includes('submitted') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
            <span className="font-medium">{message}</span>
            <button onClick={() => setMessage('')} className="float-right text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
          </div>
        )}

        {/* ===== STEP 1: UPLOAD RESUME ===== */}
        {view === 'upload' && (
          <div className="max-w-2xl mx-auto animate-fade-in">

            {/* Tab bar — shown for any signed-in candidate */}
            {candidateAuth && (
              <div className="flex gap-2 p-1 bg-white/80 backdrop-blur rounded-2xl border border-gray-200 shadow-sm mb-8 mt-4">
                <button
                  type="button"
                  className="flex-1 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow transition"
                >
                  <svg className="w-4 h-4 inline mr-1.5 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  Update Resume
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (profile) { setEditedProfile(JSON.parse(JSON.stringify(profile))); setView('profile'); }
                    else setMessage('Upload your resume first to create a profile.');
                  }}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition"
                >
                  <svg className="w-4 h-4 inline mr-1.5 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  My Profile
                </button>
              </div>
            )}

            {/* Hero */}
            <div className="text-center mb-10 mt-2">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/80 backdrop-blur rounded-full border border-indigo-200 mb-4">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-medium text-indigo-700">Powered by AI - 1200+ jobs across 120+ cities in every industry - Updated live</span>
              </div>
              <h2 className="text-5xl font-black tracking-tight">
                <span className="text-gradient-blue">Find your dream job</span>
              </h2>
              <h2 className="text-5xl font-black tracking-tight mt-1">
                <span className="text-gray-900">in seconds</span>
              </h2>
              <p className="text-gray-600 mt-4 text-lg">Upload your resume and let AI match you to jobs that fit your skills perfectly</p>

              {/* Quick stats */}
              <div className="flex items-center justify-center gap-6 mt-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <span className="text-blue-600 font-bold">1</span>
                  </div>
                  <span className="text-gray-600">Upload resume</span>
                </div>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                    <span className="text-purple-600 font-bold">2</span>
                  </div>
                  <span className="text-gray-600">Get matched</span>
                </div>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 font-bold">3</span>
                  </div>
                  <span className="text-gray-600">Apply instantly</span>
                </div>
              </div>
            </div>

            {selectedJob && (
              <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center gap-3">
                <svg className="w-5 h-5 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-indigo-800">Applying for: {selectedJob.title}</p>
                  <p className="text-xs text-indigo-600">{selectedJob.location} · {selectedJob.work_mode || 'Office'}</p>
                </div>
                <button type="button" onClick={() => setSelectedJob(null)} className="text-indigo-400 hover:text-indigo-600 text-lg leading-none">&times;</button>
              </div>
            )}

            <form onSubmit={handleUpload} className="glass-card rounded-3xl p-8 space-y-5 shadow-2xl">
              {candidateAuth ? (
                /* Signed-in banner — shows pre-filled account info, no re-entry needed */
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-sm text-emerald-700 font-semibold">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Signed in — your details are pre-filled below
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-white/70 rounded-xl px-3 py-2.5 border border-emerald-100">
                      <p className="text-xs text-gray-400 mb-0.5">First Name</p>
                      <p className="font-semibold text-gray-800">{form.first_name || '—'}</p>
                    </div>
                    <div className="bg-white/70 rounded-xl px-3 py-2.5 border border-emerald-100">
                      <p className="text-xs text-gray-400 mb-0.5">Last Name</p>
                      <p className="font-semibold text-gray-800">{form.last_name || '—'}</p>
                    </div>
                    <div className="bg-white/70 rounded-xl px-3 py-2.5 border border-emerald-100">
                      <p className="text-xs text-gray-400 mb-0.5">Email</p>
                      <p className="font-semibold text-gray-800 truncate">{email}</p>
                    </div>
                    <div className="bg-white/70 rounded-xl px-3 py-2.5 border border-emerald-100">
                      <p className="text-xs text-gray-400 mb-0.5">Phone</p>
                      {form.phone ? (
                        <p className="font-semibold text-gray-800">{form.phone}</p>
                      ) : (
                        <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                          placeholder="+1 234 567 8900" required
                          className="w-full font-semibold text-gray-800 bg-transparent outline-none placeholder-gray-300 text-sm" />
                      )}
                    </div>
                  </div>
                  {!form.phone && (
                    <p className="text-xs text-amber-600">Please add your phone number above to continue.</p>
                  )}
                </div>
              ) : (
                /* Not signed in — show full form */
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">First Name *</label>
                      <input type="text" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} required
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white/80 transition" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Last Name *</label>
                      <input type="text" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} required
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white/80 transition" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white/80 transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Phone *</label>
                    <input type="tel" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                      placeholder="+1 234 567 8900"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white/80 transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Set Password *
                      <span className="text-gray-400 font-normal ml-1 text-xs">— to save your profile & sign in later</span>
                    </label>
                    <input type="password" required minLength={6} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                      placeholder="Min 6 characters"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white/80 transition" />
                  </div>
                </>
              )}
              {/* Toggle: Resume or Manual */}
              <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                <button type="button" onClick={() => setUseManual(false)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${!useManual ? 'bg-white shadow text-indigo-700' : 'text-gray-500'}`}>
                  Upload Resume
                </button>
                <button type="button" onClick={() => setUseManual(true)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${useManual ? 'bg-white shadow text-indigo-700' : 'text-gray-500'}`}>
                  Fill Manually (No Resume)
                </button>
              </div>

              {!useManual ? (
                /* Resume upload area */
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Upload Resume</label>
                  <div className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                    resume ? 'border-emerald-400 bg-emerald-50/50' : 'border-indigo-300 bg-indigo-50/30 hover:border-indigo-500 hover:bg-indigo-50/60'
                  }`}
                    onClick={() => document.getElementById('resume-upload').click()}>
                    <input id="resume-upload" type="file" accept=".pdf,.docx,.doc,.txt,.rtf,.odt,.html,.htm,.md,.pages,.jpg,.jpeg,.png,.webp" onChange={e => setResume(e.target.files[0])} className="hidden" />
                    {resume ? (
                      <div className="animate-fade-in">
                        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mb-3 shadow-lg">
                          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <p className="text-emerald-700 font-semibold text-lg">{resume.name}</p>
                        <p className="text-emerald-600 text-xs mt-1">{(resume.size / 1024).toFixed(1)} KB - Click to change</p>
                      </div>
                    ) : (
                      <>
                        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center mb-3 shadow-lg animate-float">
                          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                        </div>
                        <p className="text-gray-700 font-medium">Drop your resume here</p>
                        <p className="text-gray-500 text-sm mt-1">or click to browse</p>
                        <p className="text-gray-400 text-xs mt-2">PDF, DOCX, TXT, RTF, Images, or any format</p>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                /* Manual form — no resume needed */
                <div className="space-y-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                  <p className="text-xs text-indigo-600 font-medium">Fill in your details manually — no resume needed</p>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Current/Desired Job Title *</label>
                    <input type="text" value={manualForm.job_title} onChange={e => setManualForm({...manualForm, job_title: e.target.value})}
                      placeholder="e.g. Photographer, Teacher, Software Developer, Chef..."
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-sm" required />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Skills *</label>
                    <div className="flex gap-2 mb-2">
                      <input type="text" value={skillInput} onChange={e => setSkillInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addManualSkill(); } }}
                        placeholder="Type a skill and press Enter"
                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-sm" />
                      <button type="button" onClick={addManualSkill}
                        className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">Add</button>
                    </div>
                    {manualSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {manualSkills.map(s => (
                          <span key={s} className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium flex items-center gap-1">
                            {s}
                            <button type="button" onClick={() => setManualSkills(manualSkills.filter(x => x !== s))} className="text-indigo-400 hover:text-indigo-700">&times;</button>
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">e.g. Photography, Photoshop, Teaching, Cooking, Python, Sales, Driving...</p>
                  </div>

                  {/* Experience — fresher toggle */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-semibold text-gray-700">Experience</label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={manualForm.is_fresher}
                          onChange={e => setManualForm({...manualForm, is_fresher: e.target.checked, experience_years: '', experience_details: ''})}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" />
                        <span className="text-sm text-indigo-600 font-medium">I'm a fresher (no experience)</span>
                      </label>
                    </div>

                    {manualForm.is_fresher ? (
                      <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                        <p className="text-emerald-700 text-sm font-medium">No worries! Many jobs welcome freshers.</p>
                        <p className="text-emerald-600 text-xs mt-1">We'll match you with entry-level and trainee positions.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Years of Experience</label>
                            <input type="number" value={manualForm.experience_years} onChange={e => setManualForm({...manualForm, experience_years: e.target.value})}
                              min={0} max={50} placeholder="e.g. 5"
                              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Your Location</label>
                            <input type="text" value={manualForm.location} onChange={e => setManualForm({...manualForm, location: e.target.value})}
                              placeholder="e.g. Mumbai, India"
                              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white text-sm" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Work Details <span className="text-gray-400">(optional)</span></label>
                          <textarea value={manualForm.experience_details} onChange={e => setManualForm({...manualForm, experience_details: e.target.value})}
                            rows={2} placeholder="e.g. Worked at Studio XYZ as Lead Photographer for 3 years..."
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white text-sm" />
                        </div>
                      </div>
                    )}

                    {/* Location for freshers too */}
                    {manualForm.is_fresher && (
                      <div className="mt-3">
                        <label className="block text-xs text-gray-500 mb-1">Your Location</label>
                        <input type="text" value={manualForm.location} onChange={e => setManualForm({...manualForm, location: e.target.value})}
                          placeholder="e.g. Mumbai, India"
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white text-sm" />
                      </div>
                    )}
                  </div>

                  {/* Education — multiple entries with Add button */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-semibold text-gray-700">Education</label>
                      <button type="button" onClick={() => setEducationList([...educationList, { degree: '', field: '', university: '', year: '' }])}
                        className="flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-200 transition">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        Add Education
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">Add your latest education first. You can add school, college, university — any level.</p>

                    <div className="space-y-3">
                      {educationList.map((edu, idx) => (
                        <div key={idx} className="p-3 bg-white rounded-xl border border-gray-200 relative">
                          {educationList.length > 1 && (
                            <button type="button" onClick={() => setEducationList(educationList.filter((_, i) => i !== idx))}
                              className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          )}
                          <p className="text-xs text-indigo-600 font-medium mb-2">{idx === 0 ? 'Latest / Highest Education' : `Education ${idx + 1}`}</p>
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <select value={edu.degree} onChange={e => {
                              const updated = [...educationList]; updated[idx] = {...edu, degree: e.target.value}; setEducationList(updated);
                            }} className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm">
                              <option value="">Degree / Level</option>
                              <option value="10th Standard">10th Standard</option>
                              <option value="12th Standard">12th Standard / PUC</option>
                              <option value="ITI">ITI</option>
                              <option value="Diploma">Diploma</option>
                              <option value="Certificate">Certificate Course</option>
                              <option value="Bachelor's">Bachelor's Degree (B.A/B.Sc/B.Tech/B.Com)</option>
                              <option value="Master's">Master's Degree (M.A/M.Sc/M.Tech/M.Com)</option>
                              <option value="MBA">MBA</option>
                              <option value="PhD">PhD / Doctorate</option>
                              <option value="Self-taught">Self-taught / Online Courses</option>
                              <option value="Other">Other</option>
                            </select>
                            <input type="text" value={edu.field} placeholder="Subject / Field (e.g. Computer Science, Arts)"
                              onChange={e => { const u = [...educationList]; u[idx] = {...edu, field: e.target.value}; setEducationList(u); }}
                              className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input type="text" value={edu.university} placeholder="School / College / University name"
                              onChange={e => { const u = [...educationList]; u[idx] = {...edu, university: e.target.value}; setEducationList(u); }}
                              className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm" />
                            <input type="text" value={edu.year} placeholder="Year (e.g. 2022)"
                              onChange={e => { const u = [...educationList]; u[idx] = {...edu, year: e.target.value}; setEducationList(u); }}
                              className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">About You <span className="text-gray-400 font-normal">(optional)</span></label>
                    <textarea value={manualForm.summary} onChange={e => setManualForm({...manualForm, summary: e.target.value})}
                      rows={2} placeholder={manualForm.is_fresher ? "What are you passionate about? What kind of work excites you?" : "Brief description of yourself, your strengths, what you're looking for..."}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white text-sm" />
                  </div>
                </div>
              )}
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-white/50 transition">
                <input type="checkbox" checked={form.consent} onChange={e => setForm({ ...form, consent: e.target.checked })} className="rounded mt-0.5 text-indigo-600 focus:ring-indigo-500 w-4 h-4" />
                <span className="text-sm text-gray-700">I consent to processing my data to find matching jobs <span className="text-red-500">*</span></span>
              </label>
              <button type="submit" disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white rounded-xl font-bold text-lg shadow-xl hover:shadow-2xl hover:scale-[1.02] disabled:opacity-50 disabled:scale-100 transition-all">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    {useManual ? 'Matching your profile...' : 'Analyzing your resume...'}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    {useManual ? 'Find Jobs For My Profile' : 'Find My Perfect Job'}
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  </span>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ===== STEP 2: MATCHED JOBS ===== */}
        {view === 'matches' && profile && (
          <div className="animate-fade-in">
            {/* Profile hero card */}
            <div className="relative overflow-hidden rounded-3xl mb-6 shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500" />
              <div className="absolute inset-0 bg-dots opacity-20" />
              <div className="relative p-8 text-white">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl font-black border border-white/30">
                      {profile.name?.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-3xl font-black">Welcome, {profile.name?.split(' ')[0]}!</h2>
                      <p className="text-white/80 mt-1">We found perfect matches for your profile</p>
                      <div className="flex gap-4 mt-3 text-sm">
                        <div className="flex items-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          <span className="font-semibold">{profile.skills?.length || 0} skills</span>
                        </div>
                        {profile.experience?.[0]?.years && (
                          <div className="flex items-center gap-1.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <span className="font-semibold">{profile.experience[0].years} years exp</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setView('upload')} className="glass px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/20 transition">
                    Update Resume
                  </button>
                </div>
                {(profile.skills || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {(skillsExpanded ? profile.skills : profile.skills.slice(0, 12)).map(s => (
                      <button key={s} onClick={() => setSelectedSkill(selectedSkill === s ? null : s)}
                        className={`px-3 py-1 backdrop-blur rounded-full text-xs font-medium border transition ${
                          selectedSkill === s
                            ? 'bg-white text-indigo-700 border-white shadow-lg'
                            : 'bg-white/20 text-white border-white/20 hover:bg-white/30'
                        }`}>
                        {s}
                      </button>
                    ))}
                    {profile.skills.length > 12 && (
                      <button onClick={() => { setSkillsExpanded(e => !e); setSelectedSkill(null); }}
                        className="px-3 py-1 bg-indigo-500/30 hover:bg-indigo-500/50 backdrop-blur rounded-full text-xs text-white font-semibold border border-indigo-400/40 transition">
                        {skillsExpanded ? 'Show less' : `+${profile.skills.length - 12} more`}
                      </button>
                    )}
                  </div>
                )}
                {/* Skill info tooltip */}
                {selectedSkill && (
                  <div className="mt-3 flex items-start gap-2 px-4 py-3 bg-white/15 backdrop-blur rounded-xl border border-white/20 text-sm text-white animate-fade-in">
                    <svg className="w-4 h-4 mt-0.5 shrink-0 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <div className="flex-1">
                      <span className="font-bold text-white">{selectedSkill}: </span>
                      <span className="text-white/80">{getSkillInfo(selectedSkill)}</span>
                    </div>
                    <button onClick={() => setSelectedSkill(null)} className="text-white/50 hover:text-white ml-2 shrink-0">✕</button>
                  </div>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-5 border border-emerald-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-emerald-700 uppercase tracking-wider">Great Fit</p>
                    <p className="text-3xl font-black text-emerald-700 mt-1">{filteredJobs.filter(j => j.match_score >= 0.7).length}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-amber-700 uppercase tracking-wider">Good Fit</p>
                    <p className="text-3xl font-black text-amber-700 mt-1">{filteredJobs.filter(j => j.match_score >= 0.4 && j.match_score < 0.7).length}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-blue-700 uppercase tracking-wider">Open Worldwide</p>
                    <p className="text-3xl font-black text-blue-700 mt-1">{totalJobs}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </div>
                </div>
              </div>
            </div>

            {/* ===== FILTER BAR ===== */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
              {/* Search within matches */}
              <div className="relative mb-4">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <input type="text" value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
                  placeholder="Filter by job title, required skill, or keyword…"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm" />
              </div>

              <div className="flex flex-wrap gap-3 items-end">
                {/* Location */}
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Location</label>
                  <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer">
                    <option value="">All Locations ({uniqueLocations.length})</option>
                    {uniqueLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                  </select>
                </div>

                {/* Experience Range */}
                <div className="min-w-[120px]">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Min Exp (yr)</label>
                  <input type="number" value={filterExpMin} onChange={e => setFilterExpMin(e.target.value)} min={0} max={20}
                    placeholder="Any"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
                <div className="min-w-[120px]">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Max Exp (yr)</label>
                  <input type="number" value={filterExpMax} onChange={e => setFilterExpMax(e.target.value)} min={0} max={30}
                    placeholder="Any"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>

                {/* Work Mode */}
                <div className="min-w-[140px]">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Work Mode</label>
                  <select value={filterWorkMode} onChange={e => setFilterWorkMode(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer">
                    <option value="">All Modes</option>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="office">Work from Office</option>
                  </select>
                </div>

                {/* Match % */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Match</label>
                  <select value={filterMatch} onChange={e => setFilterMatch(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer">
                    <option value="">All</option>
                    <option value="great">70%+ (Great)</option>
                    <option value="good">40-70% (Good)</option>
                    <option value="low">&lt;40% (Low)</option>
                  </select>
                </div>
              </div>

              {/* Active filters summary + clear */}
              {hasActiveFilters && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <p className="text-sm text-gray-500">
                    Showing <span className="font-bold text-gray-900">{filteredJobs.length}</span> of {matchedJobs.length} matches
                    {filterLocation && <span className="ml-1">in <span className="font-medium text-indigo-600">{filterLocation}</span></span>}
                    {filterWorkMode && <span className="ml-1">| <span className="font-medium text-indigo-600 capitalize">{filterWorkMode}</span></span>}
                    {(filterExpMin || filterExpMax) && <span className="ml-1">| Exp: {filterExpMin || '0'}-{filterExpMax || 'any'}yr</span>}
                  </p>
                  <button onClick={clearAllFilters} className="text-sm text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    Clear all filters
                  </button>
                </div>
              )}
            </div>

            {/* Results count */}
            <div className="flex items-end justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{filteredJobs.length} jobs for you</h3>
                <p className="text-sm text-gray-500">Out of {totalJobs} open positions worldwide — showing best matches from {totalMatched} relevant roles</p>
              </div>
            </div>

            {/* Job cards */}
            {filteredJobs.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-gray-500 text-lg font-medium">No jobs match your filters</p>
                <p className="text-gray-400 text-sm mt-1">Try adjusting your filters or clear them</p>
                <button onClick={clearAllFilters} className="mt-4 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition">
                  Clear All Filters
                </button>
              </div>
            ) : (
            <div className="space-y-4">
              {filteredJobs.map((job, idx) => (
                <div key={job.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden card-hover cursor-pointer group animate-slide-up"
                  style={{ animationDelay: `${idx * 0.05}s` }}
                  onClick={() => { setSelectedJob(job); setJobDetailReturn('matches'); setView('job-detail'); }}>
                  {/* Top match strip */}
                  <div className={`h-1 ${
                    job.match_score >= 0.7 ? 'bg-gradient-to-r from-emerald-400 to-teal-500' :
                    job.match_score >= 0.4 ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
                    'bg-gradient-to-r from-rose-400 to-red-500'
                  }`} />

                  <div className="p-6">
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-xl font-bold text-gray-900 group-hover:text-indigo-600 transition">{job.title}</h4>
                          {job.already_applied && <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">Applied</span>}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mb-3">
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            {job.location || 'Remote'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            (job.work_mode || 'office') === 'remote' ? 'bg-emerald-100 text-emerald-700' :
                            (job.work_mode || 'office') === 'hybrid' ? 'bg-blue-100 text-blue-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>{(job.work_mode || 'office') === 'remote' ? 'Remote' : (job.work_mode || 'office') === 'hybrid' ? 'Hybrid' : 'Office'}</span>
                          {job.experience_min != null && (
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                              {job.experience_min}-{job.experience_max || '10+'}y
                            </span>
                          )}
                          {formatSalary(job.salary_min, job.salary_max) && (
                            <span className="px-2 py-0.5 bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-800 rounded-full text-xs font-bold">
                              {formatSalary(job.salary_min, job.salary_max)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2 mb-3">{job.description}</p>

                        {/* Skills */}
                        <div className="flex flex-wrap gap-1.5">
                          {(job.matching_skills || []).slice(0, 6).map(s => (
                            <span key={s} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold border border-emerald-200">&#10003; {s}</span>
                          ))}
                          {(job.missing_skills || []).slice(0, 3).map(s => (
                            <span key={s} className="px-2.5 py-1 bg-gray-50 text-gray-400 rounded-lg text-xs border border-gray-200">{s}</span>
                          ))}
                        </div>
                      </div>

                      {/* Match score */}
                      <div className={`flex flex-col items-center justify-center min-w-[100px] p-4 rounded-2xl ${
                        job.match_score >= 0.7 ? 'bg-gradient-to-br from-emerald-500 to-teal-600' :
                        job.match_score >= 0.4 ? 'bg-gradient-to-br from-amber-500 to-orange-600' :
                        'bg-gradient-to-br from-rose-500 to-red-600'
                      } text-white shadow-lg`}>
                        <div className="text-4xl font-black leading-none">
                          {(job.match_score * 100).toFixed(0)}
                        </div>
                        <div className="text-sm font-bold">%</div>
                        <div className="text-xs font-medium mt-1 uppercase tracking-wider opacity-90">
                          {job.ai_recommendation === 'recommend' ? 'Great fit' : job.ai_recommendation === 'review' ? 'Good fit' : 'Low fit'}
                        </div>
                        {!job.already_applied && (
                          <button onClick={(e) => { e.stopPropagation(); setSelectedJob(job); setView('job-detail'); }}
                            className="mt-3 w-full px-3 py-1.5 bg-white text-gray-900 rounded-lg text-xs font-bold hover:bg-gray-100 transition shadow">
                            Apply
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        )}

        {/* ===== MY PROFILE (view + edit) ===== */}
        {view === 'profile' && editedProfile && (() => {
          const ep = editedProfile;
          const jobSkills = (selectedJob?.skills || []).map(s => s.toLowerCase());
          const mySkills  = (ep.skills || []).map(s => s.toLowerCase());
          const missingForJob = jobSkills.filter(s => !mySkills.includes(s));

          const removeItem = (section, idx) =>
            setEditedProfile(p => ({ ...p, [section]: p[section].filter((_, i) => i !== idx) }));

          const removeSkill = (skill) =>
            setEditedProfile(p => ({ ...p, skills: p.skills.filter(s => s !== skill) }));

          const addItem = (section, blank) =>
            setEditedProfile(p => ({ ...p, [section]: [...(p[section] || []), blank] }));

          const addSkillFromInput = () => {
            const v = (addInputs.skills || '').trim();
            if (!v || ep.skills.includes(v)) return;
            setEditedProfile(p => ({ ...p, skills: [...p.skills, v] }));
            setAddInputs(i => ({ ...i, skills: '' }));
          };

          const saveProfile = async () => {
            setProfileSaving(true); setProfileSaveMsg('');
            try {
              await api.put('/portal/candidate/profile', ep, {
                params: { email: candidateAuth?.email || profile.email },
                headers: { Authorization: undefined },
              });
              setProfile({ ...profile, ...ep });
              setProfileSaveMsg('✓ Profile saved successfully');
            } catch { setProfileSaveMsg('Save failed. Please try again.'); }
            finally { setProfileSaving(false); }
          };

          const SectionHeader = ({ title, icon, onAdd }) => (
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">{icon} {title}</h3>
              {onAdd && (
                <button onClick={onAdd} className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition">
                  <span className="text-base leading-none">+</span> Add
                </button>
              )}
            </div>
          );

          const Tag = ({ label, color = 'gray', onRemove }) => (
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${
              color === 'green' ? 'bg-green-50 text-green-700 border-green-200' :
              color === 'red'   ? 'bg-red-50 text-red-500 border-red-200' :
              color === 'blue'  ? 'bg-blue-50 text-blue-700 border-blue-200' :
              'bg-gray-100 text-gray-700 border-gray-200'}`}>
              {label}
              {onRemove && <button onClick={onRemove} className="ml-1 hover:text-red-500 font-bold text-xs">✕</button>}
            </span>
          );

          return (
            <div className="max-w-3xl mx-auto">
              {/* Tab bar */}
              <div className="flex gap-2 p-1 bg-white/80 backdrop-blur rounded-2xl border border-gray-200 shadow-sm mb-6 mt-4">
                <button
                  type="button"
                  onClick={() => setView('upload')}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition"
                >
                  <svg className="w-4 h-4 inline mr-1.5 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  Update Resume
                </button>
                <button
                  type="button"
                  className="flex-1 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow transition"
                >
                  <svg className="w-4 h-4 inline mr-1.5 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  My Profile
                </button>
              </div>

              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <button onClick={() => setView(matchedJobs.length > 0 ? 'matches' : 'landing')}
                    className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1 mb-1">
                    ← Back
                  </button>
                  <h2 className="text-2xl font-black text-gray-900">My Profile</h2>
                  <p className="text-gray-500 text-sm mt-0.5">Extracted from your resume · Edit anything that needs correcting</p>
                </div>
                <div className="flex items-center gap-2">
                  {profileSaveMsg && <span className={`text-sm font-medium ${profileSaveMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{profileSaveMsg}</span>}
                  <button onClick={saveProfile} disabled={profileSaving}
                    className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-60 transition shadow-lg">
                    {profileSaving ? 'Saving…' : 'Save Profile'}
                  </button>
                </div>
              </div>

              {/* Job skill gap banner */}
              {selectedJob && missingForJob.length > 0 && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                  <p className="text-sm font-semibold text-amber-800 mb-2">
                    Skills missing for <span className="text-amber-900">{selectedJob.title}</span> — add them to improve your match:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {missingForJob.map(s => (
                      <button key={s} onClick={() => { setEditedProfile(p => ({ ...p, skills: [...p.skills, s] })); }}
                        className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-full text-sm font-medium border border-amber-300 transition">
                        + {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-6">
                {/* Summary */}
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  <SectionHeader title="Summary" icon="📝" />
                  <textarea value={ep.summary || ''} rows={3}
                    onChange={e => setEditedProfile(p => ({ ...p, summary: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none" />
                </div>

                {/* Skills */}
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  <SectionHeader title={`Skills (${ep.skills?.length || 0})`} icon="⚡" />
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(ep.skills || []).map(s => (
                      <Tag key={s} label={s}
                        color={jobSkills.length > 0 ? (jobSkills.includes(s.toLowerCase()) ? 'green' : 'gray') : 'blue'}
                        onRemove={() => removeSkill(s)} />
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <input value={addInputs.skills || ''} onChange={e => setAddInputs(i => ({ ...i, skills: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addSkillFromInput()}
                      placeholder="Type a skill and press Enter or +"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                    <button onClick={addSkillFromInput} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition">+</button>
                  </div>
                  {jobSkills.length > 0 && (
                    <p className="text-xs text-gray-400 mt-2">
                      <span className="inline-block w-3 h-3 rounded-full bg-green-200 mr-1" />Green = matches {selectedJob.title} · Gray = not required
                    </p>
                  )}
                </div>

                {/* Experience */}
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  <SectionHeader title="Experience" icon="💼"
                    onAdd={() => addItem('experience', { company: '', role: '', years: '', description: '' })} />
                  <div className="space-y-3">
                    {(ep.experience || []).length === 0 && <p className="text-sm text-gray-400 italic">No experience added yet.</p>}
                    {(ep.experience || []).map((exp, i) => (
                      <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-200 relative">
                        <button onClick={() => removeItem('experience', i)}
                          className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition text-sm font-bold">✕</button>
                        <div className="grid grid-cols-2 gap-2 pr-8">
                          <input value={exp.company || ''} onChange={e => { const u=[...ep.experience]; u[i]={...u[i],company:e.target.value}; setEditedProfile(p=>({...p,experience:u})); }}
                            placeholder="Company" className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                          <input value={exp.role || ''} onChange={e => { const u=[...ep.experience]; u[i]={...u[i],role:e.target.value}; setEditedProfile(p=>({...p,experience:u})); }}
                            placeholder="Role / Title" className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                          <input value={exp.years || ''} onChange={e => { const u=[...ep.experience]; u[i]={...u[i],years:e.target.value}; setEditedProfile(p=>({...p,experience:u})); }}
                            placeholder="Years (e.g. 2.5)" className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                          <input value={exp.description || ''} onChange={e => { const u=[...ep.experience]; u[i]={...u[i],description:e.target.value}; setEditedProfile(p=>({...p,experience:u})); }}
                            placeholder="Brief description" className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Education */}
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  <SectionHeader title="Education" icon="🎓"
                    onAdd={() => addItem('education', { degree: '', field: '', university: '', year: '' })} />
                  <div className="space-y-3">
                    {(ep.education || []).length === 0 && <p className="text-sm text-gray-400 italic">No education added yet.</p>}
                    {(ep.education || []).map((edu, i) => (
                      <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-200 relative">
                        <button onClick={() => removeItem('education', i)}
                          className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition text-sm font-bold">✕</button>
                        <div className="grid grid-cols-2 gap-2 pr-8">
                          <input value={edu.degree || ''} onChange={e => { const u=[...ep.education]; u[i]={...u[i],degree:e.target.value}; setEditedProfile(p=>({...p,education:u})); }}
                            placeholder="Degree (e.g. Bachelor's)" className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                          <input value={edu.field || ''} onChange={e => { const u=[...ep.education]; u[i]={...u[i],field:e.target.value}; setEditedProfile(p=>({...p,education:u})); }}
                            placeholder="Field of study" className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                          <input value={edu.university || ''} onChange={e => { const u=[...ep.education]; u[i]={...u[i],university:e.target.value}; setEditedProfile(p=>({...p,education:u})); }}
                            placeholder="University / Institution" className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                          <input value={edu.year || ''} onChange={e => { const u=[...ep.education]; u[i]={...u[i],year:e.target.value}; setEditedProfile(p=>({...p,education:u})); }}
                            placeholder="Graduation year" className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Projects */}
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  <SectionHeader title="Projects" icon="🚀"
                    onAdd={() => addItem('projects', { name: '', description: '', technologies: [], role: '', outcome: '' })} />
                  <div className="space-y-3">
                    {(ep.projects || []).length === 0 && <p className="text-sm text-gray-400 italic">No projects extracted. Add them manually.</p>}
                    {(ep.projects || []).map((proj, i) => (
                      <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-200 relative">
                        <button onClick={() => removeItem('projects', i)}
                          className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition text-sm font-bold">✕</button>
                        <div className="space-y-2 pr-8">
                          <input value={proj.name || ''} onChange={e => { const u=[...ep.projects]; u[i]={...u[i],name:e.target.value}; setEditedProfile(p=>({...p,projects:u})); }}
                            placeholder="Project name" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent font-semibold" />
                          <textarea value={proj.description || ''} rows={2} onChange={e => { const u=[...ep.projects]; u[i]={...u[i],description:e.target.value}; setEditedProfile(p=>({...p,projects:u})); }}
                            placeholder="Description" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none" />
                          <input value={(proj.technologies||[]).join(', ')} onChange={e => { const u=[...ep.projects]; u[i]={...u[i],technologies:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)}; setEditedProfile(p=>({...p,projects:u})); }}
                            placeholder="Technologies (comma-separated)" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Certifications */}
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  <SectionHeader title="Certifications" icon="🏅"
                    onAdd={() => addItem('certifications', { title: '', issuer: '', date: '', description: '' })} />
                  <div className="space-y-2">
                    {(ep.certifications || []).length === 0 && <p className="text-sm text-gray-400 italic">No certifications found. Add them manually.</p>}
                    {(ep.certifications || []).map((cert, i) => (
                      <div key={i} className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100 relative">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <input value={cert.title || ''} onChange={e => { const u=[...ep.certifications]; u[i]={...u[i],title:e.target.value}; setEditedProfile(p=>({...p,certifications:u})); }}
                            placeholder="Certificate title" className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                          <input value={cert.issuer || ''} onChange={e => { const u=[...ep.certifications]; u[i]={...u[i],issuer:e.target.value}; setEditedProfile(p=>({...p,certifications:u})); }}
                            placeholder="Issued by" className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                        </div>
                        <button onClick={() => removeItem('certifications', i)}
                          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition text-sm font-bold shrink-0">✕</button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Awards */}
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  <SectionHeader title="Awards & Achievements" icon="🏆"
                    onAdd={() => addItem('awards', { title: '', issuer: '', date: '', description: '' })} />
                  <div className="space-y-2">
                    {(ep.awards || []).length === 0 && <p className="text-sm text-gray-400 italic">No awards extracted. Add them if you have any.</p>}
                    {(ep.awards || []).map((award, i) => (
                      <div key={i} className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <input value={award.title || ''} onChange={e => { const u=[...ep.awards]; u[i]={...u[i],title:e.target.value}; setEditedProfile(p=>({...p,awards:u})); }}
                            placeholder="Award title" className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                          <input value={award.issuer || ''} onChange={e => { const u=[...ep.awards]; u[i]={...u[i],issuer:e.target.value}; setEditedProfile(p=>({...p,awards:u})); }}
                            placeholder="Awarded by" className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                        </div>
                        <button onClick={() => removeItem('awards', i)}
                          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition text-sm font-bold shrink-0">✕</button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Languages & Interests */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                    <SectionHeader title="Languages" icon="🌐"
                      onAdd={() => addItem('languages', { language: '', proficiency: '' })} />
                    <div className="space-y-2">
                      {(ep.languages || []).length === 0 && <p className="text-sm text-gray-400 italic">None added.</p>}
                      {(ep.languages || []).map((lang, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input value={lang.language || ''} onChange={e => { const u=[...ep.languages]; u[i]={...u[i],language:e.target.value}; setEditedProfile(p=>({...p,languages:u})); }}
                            placeholder="Language" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                          <input value={lang.proficiency || ''} onChange={e => { const u=[...ep.languages]; u[i]={...u[i],proficiency:e.target.value}; setEditedProfile(p=>({...p,languages:u})); }}
                            placeholder="Level" className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                          <button onClick={() => removeItem('languages', i)}
                            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 rounded-full text-sm font-bold">✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                    <SectionHeader title="Interests" icon="✨" />
                    <div className="flex flex-wrap gap-2 mb-2">
                      {(ep.interests || []).map((interest, i) => (
                        <Tag key={i} label={interest} onRemove={() => removeItem('interests', i)} />
                      ))}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <input value={addInputs.interests || ''} onChange={e => setAddInputs(inp => ({ ...inp, interests: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter' && addInputs.interests?.trim()) { addItem('interests', addInputs.interests.trim()); setAddInputs(i=>({...i,interests:''})); } }}
                        placeholder="Add interest + Enter"
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom save */}
              <div className="mt-8 flex items-center justify-between py-4 border-t border-gray-100">
                {profileSaveMsg && <span className={`text-sm font-medium ${profileSaveMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{profileSaveMsg}</span>}
                <div className="ml-auto">
                  <button onClick={saveProfile} disabled={profileSaving}
                    className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-60 transition shadow-lg">
                    {profileSaving ? 'Saving…' : 'Save Profile'}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ===== JOB DETAIL ===== */}
        {view === 'job-detail' && selectedJob && (
          <div>
            <button onClick={() => setView(jobDetailReturn)} className="text-sm text-blue-600 hover:underline mb-4 inline-block">
              &larr; {jobDetailReturn === 'matches' ? 'Back to matched jobs' : jobDetailReturn === 'search-results' ? 'Back to search results' : 'Back to home'}
            </button>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedJob.title}</h2>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                    {selectedJob.location && <span>{selectedJob.location}</span>}
                    <span className={`text-sm font-medium ${
                      (selectedJob.work_mode || 'office') === 'remote' ? 'text-emerald-600' :
                      (selectedJob.work_mode || 'office') === 'hybrid' ? 'text-blue-600' : 'text-orange-600'
                    }`}>{(selectedJob.work_mode || 'office') === 'remote' ? 'Remote' : (selectedJob.work_mode || 'office') === 'hybrid' ? 'Hybrid' : 'Work from Office'}</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className={`text-3xl font-bold ${scoreColor(selectedJob.match_score)}`}>{(selectedJob.match_score * 100).toFixed(0)}%</div>
                  <p className="text-xs text-gray-400">match</p>
                </div>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {formatSalary(selectedJob.salary_min, selectedJob.salary_max) && (
                  <div className="p-3 bg-green-50 rounded-lg"><p className="text-xs text-gray-500">Salary</p><p className="font-semibold text-green-800">{formatSalary(selectedJob.salary_min, selectedJob.salary_max)}</p></div>
                )}
                {selectedJob.experience_min != null && (
                  <div className="p-3 bg-blue-50 rounded-lg"><p className="text-xs text-gray-500">Experience</p><p className="font-semibold text-blue-800">{selectedJob.experience_min}-{selectedJob.experience_max || '10+'}yr</p></div>
                )}
                {selectedJob.education && (
                  <div className="p-3 bg-purple-50 rounded-lg"><p className="text-xs text-gray-500">Education</p><p className="font-semibold text-purple-800">{selectedJob.education}</p></div>
                )}
                <div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">Work Mode</p><p className="font-semibold text-gray-800 capitalize">{(selectedJob.work_mode || 'office') === 'office' ? 'Work from Office' : selectedJob.work_mode}</p></div>
              </div>

              <h3 className="font-semibold text-gray-900 mb-2">About the role</h3>
              <p className="text-gray-600 leading-relaxed mb-6">{selectedJob.description}</p>

              {(() => {
                const jobSkills = selectedJob.skills || [];
                const candidateSkills = (profile?.skills || []).map(s => s.toLowerCase());
                const hasAiData = (selectedJob.matching_skills || []).length > 0 || (selectedJob.missing_skills || []).length > 0;
                const matching = hasAiData
                  ? (selectedJob.matching_skills || [])
                  : jobSkills.filter(s => candidateSkills.includes(s.toLowerCase()));
                const missing = hasAiData
                  ? (selectedJob.missing_skills || [])
                  : jobSkills.filter(s => !candidateSkills.includes(s.toLowerCase()));
                if (!jobSkills.length) return null;
                return (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {candidateSkills.length ? 'Your skill match' : 'Required skills'}
                      </h3>
                      {candidateSkills.length > 0 && (
                        <span className="text-xs text-gray-500">
                          {matching.length}/{jobSkills.length} skills matched
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {matching.map(s => (
                        <span key={s} className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium border border-green-200">&#10003; {s}</span>
                      ))}
                      {missing.map(s => (
                        <span key={s} className="px-3 py-1.5 bg-red-50 text-red-400 rounded-lg text-sm border border-red-100">&#10007; {s}</span>
                      ))}
                    </div>
                    {!candidateSkills.length && (
                      <p className="mt-2 text-xs text-indigo-600">
                        <button onClick={() => setAuthView('login')} className="underline">Sign in</button> or <button onClick={() => setView('upload')} className="underline">upload your resume</button> to see how your skills match this role.
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Ranking factors */}
              {selectedJob.ranking_factors && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-2">Match breakdown</h3>
                  <div className="grid grid-cols-5 gap-3">
                    {Object.entries(selectedJob.ranking_factors).map(([k, v]) => (
                      <div key={k}>
                        <p className="text-xs text-gray-500 capitalize mb-1">{k.replace('_', ' ')}</p>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden"><div className={`h-full rounded-full ${scoreBarColor(v)}`} style={{ width: `${v * 100}%` }} /></div>
                        <p className="text-xs font-medium text-gray-700 mt-0.5">{(v * 100).toFixed(0)}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedJob.already_applied ? (
                <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-600 font-medium">You've already applied for this position</div>
              ) : (
                <button onClick={handleApply} disabled={loading}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold text-lg hover:bg-blue-700 disabled:opacity-50 transition">
                  {loading ? 'Applying...' : `Apply for ${selectedJob.title}`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ===== RECORD VIDEO PITCH ===== */}
        {view === 'record-video' && selectedJob && (
          <div className="mt-4">
            <VideoRecorder
              jobTitle={selectedJob.title}
              minSeconds={30}
              maxSeconds={60}
              onSubmit={handleVideoSubmit}
              onCancel={() => {
                // Cancel — delete the pending application? For now just go back
                setView('job-detail');
                setMessage('Video recording cancelled. You can still submit your application.');
              }}
            />
          </div>
        )}

        {/* ===== APPLY SUCCESS — with video evaluation results ===== */}
        {view === 'apply-success' && (
          <div className="max-w-lg mx-auto mt-8">
            <div className={`rounded-xl shadow-sm border overflow-hidden ${videoEvaluation?.passed ? 'border-green-200' : 'border-red-200'}`}>
              {/* Header */}
              <div className={`p-6 text-center text-white ${videoEvaluation?.passed ? 'bg-green-600' : 'bg-red-500'}`}>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${videoEvaluation?.passed ? 'bg-green-500' : 'bg-red-400'}`}>
                  {videoEvaluation?.passed ? (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  )}
                </div>
                <h2 className="text-xl font-bold">
                  {videoEvaluation?.passed ? 'Shortlisted! Video Pitch Passed' : 'Video Pitch Did Not Pass'}
                </h2>
                <p className="mt-1 opacity-90">for {selectedJob?.title}</p>
                {videoEvaluation && (
                  <p className="mt-1 text-lg opacity-80">Score: {videoEvaluation.overall_score} / {videoEvaluation.max_score}</p>
                )}
              </div>

              <div className="bg-white p-6">
                {/* Summary */}
                {videoEvaluation?.summary && (
                  <p className="text-sm text-gray-700 mb-4">{videoEvaluation.summary}</p>
                )}

                {/* Score breakdown */}
                {videoEvaluation?.scores && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Evaluation Breakdown</h4>
                    <div className="space-y-3">
                      {Object.entries(videoEvaluation.scores).map(([key, val]) => (
                        <div key={key}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-600 capitalize">{key.replace(/_/g, ' ')}</span>
                            <span className={`text-sm font-bold ${val >= 3.5 ? 'text-green-600' : val >= 2.5 ? 'text-yellow-600' : 'text-red-500'}`}>{val}/5</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${val >= 3.5 ? 'bg-green-500' : val >= 2.5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${(val / 5) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skills mentioned */}
                {videoEvaluation?.matched_skills_mentioned?.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Skills you mentioned</h4>
                    <div className="flex flex-wrap gap-1">
                      {videoEvaluation.matched_skills_mentioned.map(s => (
                        <span key={s} className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Strengths & improvements */}
                {videoEvaluation?.strengths?.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-sm font-semibold text-green-700 mb-1">Strengths</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {videoEvaluation.strengths.map((s, i) => <li key={i} className="flex gap-2"><span className="text-green-500">+</span>{s}</li>)}
                    </ul>
                  </div>
                )}
                {videoEvaluation?.improvements?.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-sm font-semibold text-yellow-700 mb-1">Areas to improve</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {videoEvaluation.improvements.map((s, i) => <li key={i} className="flex gap-2"><span className="text-yellow-500">-</span>{s}</li>)}
                    </ul>
                  </div>
                )}

                {/* Next steps */}
                {videoEvaluation?.passed ? (
                  <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-800 font-medium">Next step: Check your email — you've been shortlisted for the AI Interview!</p>
                    <p className="text-xs text-green-600 mt-1">Go to "My Applications" to take the AI Interview.</p>
                  </div>
                ) : (
                  <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-red-800">Your pitch didn't meet the threshold of {videoEvaluation?.pass_threshold}/5. You can apply for other positions.</p>
                  </div>
                )}

                <div className="flex gap-3 justify-center mt-6">
                  {videoEvaluation?.passed && (
                    <button onClick={() => { setView('status'); checkStatus(); }} className="px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">Take AI Interview</button>
                  )}
                  <button onClick={() => setView('matches')} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Browse More Jobs</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== MY APPLICATIONS / STATUS ===== */}
        {view === 'status' && (
          <div>
            <button onClick={() => setView(profile ? 'matches' : 'upload')} className="text-sm text-blue-600 hover:underline mb-4 inline-block">&larr; Back</button>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">My Applications</h2>
              <div className="flex gap-2 mb-6">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your registered email address"
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyDown={e => e.key === 'Enter' && checkStatus()} />
                <button onClick={checkStatus} disabled={loading} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
                  {loading ? 'Loading...' : 'Check'}
                </button>
              </div>
              {applications.length > 0 && (
                <div className="space-y-3">
                  {applications.map((app, i) => (
                    <div key={i} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{app.job_title}</p>
                          <p className="text-sm text-gray-500">{app.job_location || 'Remote'}</p>
                          <p className="text-xs text-gray-400 mt-1">Applied {new Date(app.applied_at).toLocaleDateString()}</p>

                          {/* Video status */}
                          {app.has_video && (
                            <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded bg-purple-100 text-purple-700">Video pitch submitted</span>
                          )}
                          {app.needs_video && (
                            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                              <p className="text-xs text-yellow-800 font-medium">Video pitch required to complete your application</p>
                              <button onClick={() => {
                                setSelectedJob({ id: app.id, title: app.job_title });
                                setPendingAppId(app.id);
                                setView('record-video');
                              }} className="mt-1 px-3 py-1 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-700">
                                Record Video Now
                              </button>
                            </div>
                          )}

                          {app.interview_status && (
                            <div className="mt-2">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                app.interview_passed ? 'bg-green-100 text-green-700' :
                                app.interview_status === 'abandoned' ? 'bg-red-100 text-red-700' :
                                app.interview_status === 'failed' ? 'bg-red-100 text-red-700' :
                                'bg-blue-100 text-blue-700'
                              }`}>Interview: {app.interview_status === 'abandoned' ? 'Disconnected' : app.interview_status}</span>
                              {app.interview_score != null && <span className="text-xs text-gray-500 ml-2">Score: {app.interview_score}/5.0</span>}
                            </div>
                          )}
                          {app.is_rejected && app.rejection_reason && (
                            <p className="mt-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">Rejected: {app.rejection_reason}</p>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            app.status === 'interview_passed' ? 'bg-green-100 text-green-800' :
                            app.status === 'shortlisted' ? 'bg-blue-100 text-blue-800' :
                            app.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            app.status === 'interviewing' ? 'bg-purple-100 text-purple-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>{app.status === 'interview_passed' ? 'Passed' : app.status}</span>

                          {app.can_take_interview && !app.is_rejected && (
                            <button onClick={() => startInterview(app.id)}
                              className="mt-2 block px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 animate-pulse">
                              {app.can_resume_interview ? 'Resume Interview' : 'Take AI Interview'}
                            </button>
                          )}
                          {app.interview_id && app.interview_status === 'passed' && (
                            <button onClick={async () => {
                              try {
                                const res = await api.get(`/portal/interview/${app.interview_id}`, { params: { email }, headers: { Authorization: undefined } });
                                setInterviewData({ interview_id: app.interview_id, job_title: res.data.job_title, questions: res.data.questions });
                                setView('interview');
                              } catch {}
                            }} className="mt-2 block px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">View Results</button>
                          )}
                        </div>
                      </div>
                      {/* Progress */}
                      <div className="mt-3 flex items-center gap-1">
                        {['Applied', 'Shortlisted', 'AI Interview', 'Passed', 'Hired'].map((step, idx) => {
                          const m = { 'new': 0, 'parsed': 0, 'matched': 0, 'shortlisted': 1, 'interviewing': 2, 'interview_passed': 3, 'hired': 4 };
                          const c = m[app.status] ?? 0;
                          const a = idx <= c && app.status !== 'rejected';
                          return (
                            <React.Fragment key={step}>
                              <div className={`flex items-center gap-1 ${a ? 'text-blue-600' : app.status === 'rejected' && idx === 0 ? 'text-red-500' : 'text-gray-300'}`}>
                                <div className={`w-2 h-2 rounded-full ${a ? 'bg-blue-600' : app.status === 'rejected' ? 'bg-red-400' : 'bg-gray-200'}`} />
                                <span className="text-xs hidden sm:inline">{step}</span>
                              </div>
                              {idx < 4 && <div className={`flex-1 h-0.5 ${idx < c && app.status !== 'rejected' ? 'bg-blue-600' : 'bg-gray-200'}`} />}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== AI INTERVIEW ===== */}
        {view === 'interview' && interviewData && (
          <AIInterview
            interviewData={interviewData}
            email={email}
            onComplete={() => { setView('status'); checkStatus(); }}
            onBack={() => { setView('status'); checkStatus(); }}
          />
        )}

        {/* ===== INBOX ===== */}
        {view === 'inbox' && (
          <div className="animate-fade-in">
            <button onClick={() => setView(profile ? 'matches' : 'upload')} className="text-sm text-blue-600 hover:underline mb-4 inline-block">&larr; Back</button>

            {!email ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">My Inbox</h2>
                <div className="flex gap-2">
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email to view inbox"
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                  <button onClick={loadInbox} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700">Load</button>
                </div>
              </div>
            ) : selectedEmail ? (
              /* Email detail view */
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50">
                  <div>
                    <button onClick={() => setSelectedEmail(null)} className="text-sm text-indigo-600 hover:underline mb-2 inline-block">&larr; Back to inbox</button>
                    <h3 className="text-lg font-bold text-gray-900">{selectedEmail.subject}</h3>
                    <p className="text-xs text-gray-500 mt-1">{new Date(selectedEmail.sent_at).toLocaleString()}</p>
                  </div>
                </div>
                <div className="p-6">
                  {selectedEmail.body_html ? (
                    <div dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }} />
                  ) : (
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedEmail.body_text}</p>
                  )}
                </div>
              </div>
            ) : (
              /* Email list */
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">My Inbox</h2>
                    <p className="text-xs text-gray-500 mt-0.5">{inboxEmails.length} messages</p>
                  </div>
                  <button onClick={loadInbox} className="text-sm text-indigo-600 hover:underline font-medium">Refresh</button>
                </div>

                {inboxEmails.length === 0 ? (
                  <div className="p-12 text-center">
                    <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-500 font-medium">No messages yet</p>
                    <p className="text-gray-400 text-sm mt-1">Upload your resume and apply for jobs to receive updates</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {inboxEmails.map((em) => (
                      <div key={em.id} onClick={() => setSelectedEmail(em)}
                        className="p-4 hover:bg-indigo-50/50 cursor-pointer transition flex items-start gap-3 group">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white flex-shrink-0 mt-0.5">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 group-hover:text-indigo-700 transition truncate">{em.subject}</p>
                          <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{em.body_text?.substring(0, 120)}...</p>
                          <p className="text-xs text-gray-400 mt-1">{new Date(em.sent_at).toLocaleString()}</p>
                        </div>
                        <svg className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 flex-shrink-0 mt-2 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== GDPR DATA ===== */}
        {view === 'data' && (
          <div>
            <button onClick={() => setView(profile ? 'matches' : 'upload')} className="text-sm text-blue-600 hover:underline mb-4 inline-block">&larr; Back</button>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">My Data & Privacy</h2>
              <div className="mb-6">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your registered email address"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div className="space-y-3">
                <button onClick={async () => {
                  if (!email) { setMessage('Enter email'); return; }
                  try {
                    const res = await api.get('/portal/data', { params: { email }, headers: { Authorization: undefined } });
                    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'my_data.json'; a.click();
                  } catch (err) { setMessage(err.response?.data?.detail || 'Failed'); }
                }} className="w-full p-4 border border-gray-200 rounded-lg text-left hover:bg-gray-50">
                  <p className="font-medium text-gray-900">Download My Data</p>
                  <p className="text-sm text-gray-500">Export as JSON (GDPR Article 15)</p>
                </button>
                <button onClick={async () => {
                  if (!email || !window.confirm('Permanently delete all your data?')) return;
                  try {
                    const res = await api.delete('/portal/data', { params: { email }, headers: { Authorization: undefined } });
                    setMessage(res.data.message);
                  } catch (err) { setMessage(err.response?.data?.detail || 'Failed'); }
                }} className="w-full p-4 border border-red-200 rounded-lg text-left hover:bg-red-50">
                  <p className="font-medium text-red-700">Request Deletion</p>
                  <p className="text-sm text-red-500">GDPR Article 17 — Right to Erasure</p>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
