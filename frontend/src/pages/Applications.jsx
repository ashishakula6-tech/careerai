import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function Applications() {
  const [applications, setApplications] = useState([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [matchFilter, setMatchFilter] = useState(''); // '', 'high', 'medium', 'low'
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [statusFilter]);

  const load = async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/applications', { params });
      setApplications(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleAction = async (appId, action) => {
    try {
      await api.post(`/applications/${appId}/${action}`);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || `Failed to ${action}`);
    }
  };

  // Apply match filter on client side
  const filtered = applications.filter(app => {
    if (!matchFilter) return true;
    const s = app.match_score || 0;
    if (matchFilter === 'high') return s >= 0.7;
    if (matchFilter === 'medium') return s >= 0.4 && s < 0.7;
    if (matchFilter === 'low') return s < 0.4;
    return true;
  });

  // Score-based colors
  const matchColor = (s) => {
    if (s == null) return 'text-gray-400 bg-gray-100';
    if (s >= 0.7) return 'text-green-700 bg-green-100 border-green-300';
    if (s >= 0.4) return 'text-yellow-700 bg-yellow-100 border-yellow-300';
    return 'text-red-600 bg-red-100 border-red-300';
  };

  const matchLabel = (s) => {
    if (s == null) return 'N/A';
    if (s >= 0.7) return 'Great fit';
    if (s >= 0.4) return 'Good fit';
    return 'Weak fit';
  };

  const statusColors = {
    new: 'bg-blue-100 text-blue-700',
    pending_video: 'bg-orange-100 text-orange-700',
    matched: 'bg-yellow-100 text-yellow-700',
    shortlisted: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    hold: 'bg-gray-100 text-gray-700',
    interviewing: 'bg-purple-100 text-purple-700',
    interview_passed: 'bg-green-200 text-green-800',
  };

  // Summary stats
  const stats = {
    high: applications.filter(a => (a.match_score || 0) >= 0.7).length,
    medium: applications.filter(a => (a.match_score || 0) >= 0.4 && (a.match_score || 0) < 0.7).length,
    low: applications.filter(a => (a.match_score || 0) < 0.4 && a.match_score != null).length,
    withVideo: applications.filter(a => a.has_video).length,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
          <p className="text-sm text-gray-500 mt-1">{total} total — sorted by match % (highest first)</p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-900">{applications.length}</p>
        </div>
        <div className="bg-green-50 rounded-lg border border-green-200 p-4">
          <p className="text-xs text-green-700">Great fit (70%+)</p>
          <p className="text-2xl font-bold text-green-700">{stats.high}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
          <p className="text-xs text-yellow-700">Good fit (40-70%)</p>
          <p className="text-2xl font-bold text-yellow-700">{stats.medium}</p>
        </div>
        <div className="bg-red-50 rounded-lg border border-red-200 p-4">
          <p className="text-xs text-red-700">Weak fit (&lt;40%)</p>
          <p className="text-2xl font-bold text-red-700">{stats.low}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex gap-1">
          <span className="text-xs text-gray-500 font-medium self-center mr-1">Status:</span>
          {['', 'new', 'pending_video', 'shortlisted', 'interviewing', 'interview_passed', 'rejected'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <span className="text-xs text-gray-500 font-medium self-center mr-1">Match:</span>
          {[
            { key: '', label: 'All' },
            { key: 'high', label: '70%+' },
            { key: 'medium', label: '40-70%' },
            { key: 'low', label: '<40%' },
          ].map((m) => (
            <button key={m.key} onClick={() => setMatchFilter(m.key)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${matchFilter === m.key ? 'bg-green-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Application cards */}
      <div className="space-y-4">
        {loading ? <p className="text-center py-8 text-gray-500">Loading...</p> : filtered.length === 0 ? <p className="text-center py-8 text-gray-500">No applications match the filters</p> : (
          filtered.map((app) => (
            <div key={app.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Top bar — match % strip */}
              <div className={`h-1.5 ${
                (app.match_score || 0) >= 0.7 ? 'bg-green-500' :
                (app.match_score || 0) >= 0.4 ? 'bg-yellow-500' : 'bg-red-400'
              }`} style={{ width: `${(app.match_score || 0) * 100}%` }} />

              <div className="p-6">
                <div className="flex items-start gap-6">
                  {/* Left: candidate + job info */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <Link to={`/candidates/${app.candidate_id}`} className="text-lg font-semibold text-blue-700 hover:underline">
                          {app.candidate_name || `Candidate ${app.candidate_id.substring(0, 8)}`}
                        </Link>
                        {app.candidate_email && <p className="text-xs text-gray-500">{app.candidate_email}</p>}
                      </div>
                    </div>

                    {/* Applied for */}
                    <div className="mb-3">
                      <p className="text-xs text-gray-500">Applied for</p>
                      <p className="text-sm font-medium text-gray-900">{app.job_title || 'Job'}</p>
                      {app.job_location && <p className="text-xs text-gray-500">{app.job_location}</p>}
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[app.status] || 'bg-gray-100 text-gray-700'}`}>
                        {app.status}
                      </span>
                      {app.ai_recommendation && (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          app.ai_recommendation === 'recommend' ? 'bg-green-100 text-green-700' :
                          app.ai_recommendation === 'review' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>AI: {app.ai_recommendation}</span>
                      )}
                      {app.has_video && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                          Video pitch
                        </span>
                      )}
                    </div>

                    {/* Ranking factors */}
                    {app.ranking_factors && Object.keys(app.ranking_factors).length > 0 && (
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs font-medium text-gray-700 mb-2">Match breakdown</p>
                        <div className="grid grid-cols-5 gap-3">
                          {Object.entries(app.ranking_factors).map(([key, val]) => (
                            <div key={key}>
                              <p className="text-xs text-gray-500 capitalize mb-1">{key.replace(/_/g, ' ')}</p>
                              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${val >= 0.7 ? 'bg-green-500' : val >= 0.4 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${val * 100}%` }} />
                              </div>
                              <p className="text-xs font-medium text-gray-700 mt-0.5">{(val * 100).toFixed(0)}%</p>
                            </div>
                          ))}
                        </div>
                        {app.bias_score != null && (
                          <p className="text-xs text-gray-400 mt-2">Bias check: {(app.bias_score * 100).toFixed(1)}% — within acceptable range</p>
                        )}
                      </div>
                    )}

                    {app.human_decision && (
                      <p className="text-xs text-gray-500 mt-2">
                        Your decision: <span className={`font-medium ${app.human_decision === 'shortlist' ? 'text-green-600' : app.human_decision === 'reject' ? 'text-red-600' : 'text-gray-600'}`}>{app.human_decision}</span>
                        {app.override_reason && ` — "${app.override_reason}"`}
                      </p>
                    )}
                  </div>

                  {/* Right: HUGE match percentage */}
                  <div className={`flex flex-col items-center justify-center p-5 rounded-xl border-2 min-w-[140px] ${matchColor(app.match_score)}`}>
                    <div className="text-5xl font-black leading-none">
                      {app.match_score != null ? `${(app.match_score * 100).toFixed(0)}` : '—'}
                    </div>
                    <div className="text-sm font-bold mt-0.5">%</div>
                    <div className="text-xs font-medium mt-2 uppercase tracking-wider">{matchLabel(app.match_score)}</div>

                    {/* Action buttons */}
                    {(app.status === 'matched' || app.status === 'new') && (
                      <div className="flex flex-col gap-1.5 mt-3 w-full">
                        <button onClick={() => handleAction(app.id, 'shortlist')} className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700">Shortlist</button>
                        <button onClick={() => handleAction(app.id, 'reject')} className="px-3 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700">Reject</button>
                        <button onClick={() => handleAction(app.id, 'hold')} className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300">Hold</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
