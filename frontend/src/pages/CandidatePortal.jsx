import React, { useState } from 'react';
import api from '../services/api';
import AIInterview from '../components/AIInterview';
import VideoRecorder from '../components/VideoRecorder';

export default function CandidatePortal() {
  // view: landing | upload | matches | job-detail | record-video | apply-success | status | data | interview | inbox
  const [view, setView] = useState('landing');
  const [email, setEmail] = useState('');
  const [pendingAppId, setPendingAppId] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Resume + profile
  const [resume, setResume] = useState(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', consent: false });
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

  // Status
  const [applications, setApplications] = useState([]);

  // Inbox
  const [inboxEmails, setInboxEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);

  // Interview
  const [interviewData, setInterviewData] = useState(null);

  // ==================== UPLOAD & MATCH ====================
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!form.consent) { setMessage('Please consent to data processing'); return; }
    if (manualSkills.length === 0) { setMessage('Please add at least one skill'); return; }
    setLoading(true); setMessage('');
    try {
      const res = await api.post('/portal/manual-profile', {
        email, first_name: form.first_name, last_name: form.last_name,
        phone: form.phone || null,
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
    setLoading(true); setMessage('');
    try {
      const fd = new FormData();
      fd.append('email', email);
      fd.append('first_name', form.first_name);
      fd.append('last_name', form.last_name);
      if (form.phone) fd.append('phone', form.phone);
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
            <button onClick={() => setView('upload')} className="px-5 py-2.5 bg-white text-indigo-700 rounded-xl font-bold text-sm hover:bg-indigo-50 transition shadow-lg">
              Get Started Free
            </button>
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

              <div className="flex items-center gap-4 mt-8">
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
              <div className="flex items-center gap-6 mt-10 text-white/50 text-sm">
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  100% Free
                </div>
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  No Sign-up Required
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

        {/* How it works */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 pb-20">
          <h2 className="text-3xl font-black text-white text-center mb-12">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: '1', icon: '📄', title: 'Upload Resume', desc: 'Drop your resume and AI reads your skills, experience & education in seconds' },
              { step: '2', icon: '🎯', title: 'Get Matched', desc: 'AI scores every job worldwide and shows your top matches with % fit' },
              { step: '3', icon: '🎥', title: 'Video Pitch', desc: 'Record a 30-60 second video telling why you\'re the perfect fit' },
              { step: '4', icon: '🎙️', title: 'AI Interview', desc: 'Take a voice interview with our AI — pass and a recruiter contacts you' },
            ].map((item, i) => (
              <div key={item.step} className="relative glass rounded-2xl p-6 border border-white/10 text-center card-hover animate-slide-up" style={{ animationDelay: `${i * 0.15}s` }}>
                <div className="text-4xl mb-4">{item.icon}</div>
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm font-black mx-auto mb-3">
                  {item.step}
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative z-10 border-t border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { value: '1200+', label: 'Open Jobs', color: 'from-blue-400 to-indigo-400' },
                { value: '120+', label: 'Cities Worldwide', color: 'from-purple-400 to-pink-400' },
                { value: '200+', label: 'Job Categories', color: 'from-emerald-400 to-teal-400' },
                { value: '24/7', label: 'AI-Powered Matching', color: 'from-amber-400 to-orange-400' },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className={`text-4xl font-black bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>{stat.value}</p>
                  <p className="text-white/60 text-sm mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 pb-20">
          <div className="relative overflow-hidden rounded-3xl">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600" />
            <div className="absolute inset-0 bg-dots opacity-10" />
            <div className="relative p-12 text-center">
              <h2 className="text-4xl font-black text-white mb-4">Ready to find your dream job?</h2>
              <p className="text-white/80 text-lg mb-8 max-w-lg mx-auto">It takes less than 60 seconds. Upload your resume and let AI do the heavy lifting.</p>
              <button onClick={() => setView('upload')}
                className="px-10 py-4 bg-white text-indigo-700 rounded-2xl font-bold text-lg shadow-2xl hover:shadow-white/20 hover:scale-105 transition-all">
                Get Started — It's Free
              </button>
            </div>
          </div>
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
            {/* Hero */}
            <div className="text-center mb-10 mt-6">
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

            <form onSubmit={handleUpload} className="glass-card rounded-3xl p-8 space-y-5 shadow-2xl">
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white/80 transition" />
              </div>
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
                    {profile.skills.slice(0, 12).map(s => (
                      <span key={s} className="px-3 py-1 bg-white/20 backdrop-blur rounded-full text-xs font-medium border border-white/20">{s}</span>
                    ))}
                    {profile.skills.length > 12 && (
                      <span className="px-3 py-1 bg-white/10 backdrop-blur rounded-full text-xs text-white/70">+{profile.skills.length - 12} more</span>
                    )}
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
                  placeholder="Search by title, skill, or keyword..."
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
                  onClick={() => { setSelectedJob(job); setView('job-detail'); }}>
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

        {/* ===== JOB DETAIL ===== */}
        {view === 'job-detail' && selectedJob && (
          <div>
            <button onClick={() => setView('matches')} className="text-sm text-blue-600 hover:underline mb-4 inline-block">&larr; Back to matched jobs</button>
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

              <h3 className="font-semibold text-gray-900 mb-2">Your skill match</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {(selectedJob.matching_skills || []).map(s => (
                  <span key={s} className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium border border-green-200">&#10003; {s}</span>
                ))}
                {(selectedJob.missing_skills || []).map(s => (
                  <span key={s} className="px-3 py-1.5 bg-red-50 text-red-400 rounded-lg text-sm border border-red-100">&#10007; {s}</span>
                ))}
              </div>

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
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Your email"
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
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Your email"
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
