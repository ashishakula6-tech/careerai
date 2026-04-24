import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

export default function CandidateDetail() {
  const { id } = useParams();
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    try {
      const res = await api.get(`/candidates/${id}`);
      setCandidate(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="inline-block w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );
  if (!candidate) return <div className="text-center py-12 text-gray-500">Candidate not found</div>;

  const c = candidate;
  const statusColors = {
    new: 'bg-blue-100 text-blue-700', parsed: 'bg-yellow-100 text-yellow-700',
    matched: 'bg-amber-100 text-amber-700', shortlisted: 'bg-emerald-100 text-emerald-700',
    interviewing: 'bg-purple-100 text-purple-700', interview_passed: 'bg-green-200 text-green-800',
    rejected: 'bg-rose-100 text-rose-700',
  };

  return (
    <div className="animate-fade-in">
      <Link to="/candidates" className="text-sm text-indigo-600 hover:underline mb-4 inline-block">&larr; Back to Candidates</Link>

      {/* Header Card */}
      <div className="relative overflow-hidden rounded-3xl mb-6 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500" />
        <div className="absolute inset-0 bg-dots opacity-10" />
        <div className="relative p-8">
          <div className="flex items-start gap-6">
            <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-white text-3xl font-black border border-white/30">
              {c.first_name?.charAt(0)}{c.last_name?.charAt(0)}
            </div>
            <div className="flex-1 text-white">
              <h1 className="text-3xl font-black">{c.first_name} {c.last_name}</h1>
              <p className="text-white/80 mt-1">{c.email}</p>
              <div className="flex items-center gap-3 mt-3">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusColors[c.status] || 'bg-gray-100 text-gray-700'}`}>
                  {c.status === 'interview_passed' ? 'Interview Passed' : c.status}
                </span>
                <span className="text-white/60 text-sm">Source: {c.source}</span>
                <span className="text-white/60 text-sm">Joined: {new Date(c.created_at).toLocaleDateString()}</span>
              </div>
              {c.summary && <p className="text-white/80 mt-3 text-sm leading-relaxed max-w-2xl">{c.summary}</p>}
            </div>
            {c.best_match_score > 0 && (
              <div className="bg-white/20 backdrop-blur rounded-2xl p-5 text-center border border-white/20 min-w-[120px]">
                <div className="text-4xl font-black text-white">{(c.best_match_score * 100).toFixed(0)}%</div>
                <p className="text-white/80 text-xs mt-1">Best Match</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column — Profile Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Skills */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              Skills
            </h3>
            {(c.skills || []).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {c.skills.map(s => (
                  <span key={s} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-semibold border border-indigo-100">{s}</span>
                ))}
              </div>
            ) : <p className="text-gray-400 text-sm">No skills extracted</p>}

            {/* Confidence Scores */}
            {c.confidence_scores && Object.keys(c.confidence_scores).length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">AI Parsing Confidence</p>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(c.confidence_scores).map(([key, val]) => (
                    <div key={key}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600 capitalize">{key}</span>
                        <span className={`font-bold ${val >= 0.7 ? 'text-emerald-600' : val >= 0.4 ? 'text-amber-600' : 'text-rose-500'}`}>{(val * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${val >= 0.7 ? 'bg-emerald-500' : val >= 0.4 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${val * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">Parsing method: {c.parsing_method}</p>
              </div>
            )}
          </div>

          {/* Experience */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              Experience
            </h3>
            {(c.experience || []).length > 0 ? (
              <div className="space-y-3">
                {c.experience.map((exp, i) => (
                  <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="font-semibold text-gray-900">{exp.role || 'Role'}</p>
                    <p className="text-sm text-gray-600">{exp.company || 'Company'}</p>
                    <p className="text-sm text-indigo-600 font-medium mt-1">{exp.years} years</p>
                    {exp.description && <p className="text-xs text-gray-500 mt-1">{exp.description}</p>}
                  </div>
                ))}
              </div>
            ) : <p className="text-gray-400 text-sm">No experience extracted</p>}
          </div>

          {/* Education */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
              Education
            </h3>
            {(c.education || []).length > 0 ? (
              <div className="space-y-3">
                {c.education.map((edu, i) => (
                  <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="font-semibold text-gray-900">{edu.degree} in {edu.field || 'N/A'}</p>
                    <p className="text-sm text-gray-600">{edu.university || 'University not extracted'}</p>
                    {edu.year && <p className="text-xs text-gray-500 mt-1">Year: {edu.year}</p>}
                  </div>
                ))}
              </div>
            ) : <p className="text-gray-400 text-sm">No education extracted</p>}
          </div>

          {/* Applications */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
              Applications ({c.total_applications})
            </h3>
            {(c.applications || []).length > 0 ? (
              <div className="space-y-3">
                {c.applications.map((app, i) => (
                  <ApplicationCardWithVideo key={i} app={app} statusColors={statusColors} />
                ))}
              </div>
            ) : <p className="text-gray-400 text-sm">No applications yet</p>}
          </div>
        </div>

        {/* Right Column — Quick Info + Interviews + Resumes */}
        <div className="space-y-6">
          {/* Quick Info Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Quick Info</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Email</span><span className="font-medium text-gray-900">{c.email}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Status</span><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[c.status] || ''}`}>{c.status}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Source</span><span className="font-medium text-gray-900">{c.source}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Consent</span><span className={c.consent_given ? 'text-emerald-600 font-medium' : 'text-rose-600'}>{c.consent_given ? 'Granted' : 'Not given'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Applications</span><span className="font-medium text-gray-900">{c.total_applications}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Skills</span><span className="font-medium text-gray-900">{(c.skills || []).length}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Joined</span><span className="font-medium text-gray-900">{new Date(c.created_at).toLocaleDateString()}</span></div>
            </div>
          </div>

          {/* Interviews */}
          {(c.interviews || []).length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">AI Interviews</h3>
              <div className="space-y-3">
                {c.interviews.map((int, i) => (
                  <div key={i} className={`p-3 rounded-xl border ${int.passed ? 'border-emerald-200 bg-emerald-50' : int.status === 'abandoned' ? 'border-rose-200 bg-rose-50' : 'border-gray-200 bg-gray-50'}`}>
                    <p className="font-medium text-sm text-gray-900">{int.job_title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        int.passed ? 'bg-emerald-200 text-emerald-800' :
                        int.status === 'abandoned' ? 'bg-rose-200 text-rose-800' :
                        int.status === 'failed' ? 'bg-rose-100 text-rose-700' : 'bg-gray-200 text-gray-700'
                      }`}>{int.status}</span>
                      {int.score != null && <span className="text-xs text-gray-600 font-medium">{int.score}/5.0</span>}
                    </div>
                    {int.completed_at && <p className="text-xs text-gray-400 mt-1">{new Date(int.completed_at).toLocaleString()}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resumes */}
          {(c.resumes || []).length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Uploaded Resumes</h3>
              <div className="space-y-2">
                {c.resumes.map((r, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.file_name}</p>
                      <p className="text-xs text-gray-500">{r.file_size ? `${(r.file_size / 1024).toFixed(1)} KB` : ''} — {new Date(r.uploaded_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== Sub-component: Application Card with Inline Video Player =====
function ApplicationCardWithVideo({ app, statusColors }) {
  const [showVideo, setShowVideo] = useState(false);
  const token = localStorage.getItem('access_token');
  const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';
  const videoUrl = `${apiBase}/applications/${app.id}/video?token=${encodeURIComponent(token || '')}`;

  return (
    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="font-semibold text-gray-900">{app.job_title}</p>
          <p className="text-sm text-gray-500">{app.job_location}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[app.status] || 'bg-gray-100 text-gray-600'}`}>
              {app.status}
            </span>
            {app.ai_recommendation && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                app.ai_recommendation === 'recommend' ? 'bg-emerald-50 text-emerald-700' :
                app.ai_recommendation === 'review' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
              }`}>AI: {app.ai_recommendation}</span>
            )}
            {app.human_decision && (
              <span className="text-xs text-gray-500">Decision: <span className="font-medium">{app.human_decision}</span></span>
            )}
            {app.has_video && (
              <button
                onClick={() => setShowVideo(!showVideo)}
                className="px-3 py-1 bg-purple-600 text-white rounded-full text-xs font-semibold flex items-center gap-1 hover:bg-purple-700 transition shadow"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                {showVideo ? 'Hide Video' : `Watch Video Pitch ${app.video_duration ? `(${Math.round(app.video_duration)}s)` : ''}`}
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">Applied: {new Date(app.applied_at).toLocaleDateString()}</p>
        </div>
        {app.match_score != null && (
          <div className={`px-4 py-2 rounded-xl text-center flex-shrink-0 ${
            app.match_score >= 0.7 ? 'bg-emerald-100 text-emerald-700' :
            app.match_score >= 0.4 ? 'bg-amber-100 text-amber-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            <div className="text-2xl font-black">{(app.match_score * 100).toFixed(0)}%</div>
            <div className="text-xs font-medium">match</div>
          </div>
        )}
      </div>

      {/* Inline Video Player */}
      {showVideo && app.has_video && (
        <div className="mt-4 animate-fade-in">
          <div className="bg-black rounded-xl overflow-hidden shadow-2xl">
            <video
              controls
              autoPlay
              className="w-full max-h-96 object-contain"
              src={videoUrl}
            >
              Your browser does not support video playback.
            </video>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <span>Video pitch by candidate · {app.video_duration ? `${Math.round(app.video_duration)}s duration` : ''}</span>
            <a href={videoUrl} download={`pitch_${app.id}.webm`}
              className="text-indigo-600 hover:underline font-medium flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
