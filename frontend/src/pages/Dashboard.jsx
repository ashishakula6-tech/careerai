import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ jobs: 0, candidates: 0, applications: 0, approvals: 0 });
  const [recentLogs, setRecentLogs] = useState([]);
  const [topApps, setTopApps] = useState([]);
  const [loading, setLoading] = useState(true);

  // AI Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [jobsRes, candidatesRes, appsRes, approvalsRes, logsRes, topAppsRes] = await Promise.allSettled([
        api.get('/jobs', { params: { limit: 1, status: 'active' } }),
        api.get('/candidates', { params: { limit: 1 } }),
        api.get('/applications', { params: { limit: 1 } }),
        api.get('/approvals', { params: { limit: 1, status: 'pending' } }),
        api.get('/audit/logs', { params: { limit: 10 } }),
        api.get('/applications', { params: { limit: 5 } }),
      ]);

      setStats({
        jobs: jobsRes.status === 'fulfilled' ? jobsRes.value.data.total : 0,
        candidates: candidatesRes.status === 'fulfilled' ? candidatesRes.value.data.total : 0,
        applications: appsRes.status === 'fulfilled' ? appsRes.value.data.total : 0,
        approvals: approvalsRes.status === 'fulfilled' ? approvalsRes.value.data.total : 0,
      });

      if (logsRes.status === 'fulfilled') setRecentLogs(logsRes.value.data.items || []);
      if (topAppsRes.status === 'fulfilled') setTopApps(topAppsRes.value.data.items || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSearch = async (q) => {
    const query = q || searchQuery;
    if (!query.trim()) { setSearchResults(null); return; }
    setSearchQuery(query);
    setIsSearching(true);
    try {
      const res = await api.get('/candidates/search', { params: { q: query, limit: 10 } });
      setSearchResults(res.data);
    } catch {}
    finally { setIsSearching(false); }
  };

  const statCards = [
    {
      label: 'Active Jobs',
      value: stats.jobs,
      icon: (<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>),
      gradient: 'from-blue-500 to-indigo-600',
      bg: 'from-blue-50 to-indigo-50',
      link: '/jobs',
    },
    {
      label: 'Pending Approvals',
      value: stats.approvals,
      icon: (<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>),
      gradient: 'from-amber-500 to-orange-600',
      bg: 'from-amber-50 to-orange-50',
      link: '/approvals',
      urgent: stats.approvals > 0,
    },
    {
      label: 'Candidates',
      value: stats.candidates,
      icon: (<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>),
      gradient: 'from-emerald-500 to-teal-600',
      bg: 'from-emerald-50 to-teal-50',
      link: '/candidates',
    },
    {
      label: 'Applications',
      value: stats.applications,
      icon: (<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>),
      gradient: 'from-purple-500 to-pink-600',
      bg: 'from-purple-50 to-pink-50',
      link: '/applications',
    },
  ];

  const actionColor = (action) => {
    if (action.includes('SHORTLISTED') || action.includes('PASSED') || action.includes('PUBLISHED')) return 'bg-emerald-100 text-emerald-700';
    if (action.includes('REJECTED') || action.includes('ABANDONED') || action.includes('FAILED')) return 'bg-rose-100 text-rose-700';
    if (action.includes('CREATED') || action.includes('UPLOADED') || action.includes('APPLIED')) return 'bg-blue-100 text-blue-700';
    if (action.includes('NOTIFICATION')) return 'bg-purple-100 text-purple-700';
    return 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-gray-500 mt-4 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Hero Greeting */}
      <div className="relative overflow-hidden rounded-3xl mb-8 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500"></div>
        <div className="absolute inset-0 bg-dots opacity-10"></div>
        <div className="relative p-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium">Welcome back, {user?.full_name?.split(' ')[0]}</p>
              <h1 className="text-4xl font-black mt-1">Your Dashboard</h1>
              <p className="text-white/80 mt-2">Here's what's happening in your recruitment pipeline today.</p>
            </div>
            <div className="hidden md:flex items-center gap-3">
              <Link to="/jobs/new" className="px-5 py-3 bg-white text-indigo-600 rounded-xl font-bold shadow-lg hover:shadow-2xl hover:scale-105 transition flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                Create Job
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* AI Candidate Search */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <span className="text-sm font-bold text-gray-800">Find Candidates with AI</span>
          <span className="text-xs text-gray-400">— type what you're looking for in plain English</span>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="flex gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='e.g. "Python developers with 5+ years in Bangalore" or "Shortlisted React engineers"'
              className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm" />
            {searchQuery && (
              <button type="button" onClick={() => { setSearchQuery(''); setSearchResults(null); }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
          <button type="submit" disabled={isSearching}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold text-sm hover:shadow-lg disabled:opacity-50 transition-all flex items-center gap-2 whitespace-nowrap">
            {isSearching ? (
              <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Searching...</>
            ) : (
              <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> AI Search</>
            )}
          </button>
        </form>

        {/* Quick search chips */}
        {!searchResults && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {['Python developers', 'React engineers in Bangalore', 'Shortlisted candidates', 'DevOps with Kubernetes', 'Machine learning PhD', 'Candidates from Dubai'].map(q => (
              <button key={q} onClick={() => { setSearchQuery(q); handleSearch(q); }}
                className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-100 transition">
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Search Results */}
        {searchResults && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            {/* Filters applied */}
            {searchResults.filters_applied && (
              <div className="flex flex-wrap items-center gap-1.5 mb-3">
                <span className="text-xs text-gray-500 font-medium">Filters:</span>
                {searchResults.filters_applied.skills?.map(s => (
                  <span key={s} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{s}</span>
                ))}
                {searchResults.filters_applied.location && (
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">{searchResults.filters_applied.location}</span>
                )}
                {searchResults.filters_applied.status && (
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">{searchResults.filters_applied.status}</span>
                )}
                {searchResults.filters_applied.experience_min != null && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">{searchResults.filters_applied.experience_min}+ yrs</span>
                )}
                {searchResults.filters_applied.education && (
                  <span className="px-2 py-0.5 bg-pink-100 text-pink-700 rounded-full text-xs font-medium">{searchResults.filters_applied.education}</span>
                )}
              </div>
            )}

            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-700 font-medium">{searchResults.total} candidate{searchResults.total !== 1 ? 's' : ''} found</p>
              <button onClick={() => navigate('/candidates')} className="text-xs text-indigo-600 hover:underline font-medium">Advanced search</button>
            </div>

            {searchResults.items?.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No candidates match this search</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {searchResults.items?.slice(0, 8).map(c => (
                  <Link key={c.id} to={`/candidates/${c.id}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-indigo-50/50 transition group">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {c.first_name?.charAt(0)}{c.last_name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 text-sm group-hover:text-indigo-700 transition truncate">{c.first_name} {c.last_name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          c.status === 'shortlisted' ? 'bg-emerald-100 text-emerald-700' :
                          c.status === 'interview_passed' ? 'bg-green-200 text-green-800' :
                          c.status === 'rejected' ? 'bg-rose-100 text-rose-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{c.status}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(c.skills || []).slice(0, 5).map(s => (
                          <span key={s} className="text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{s}</span>
                        ))}
                      </div>
                    </div>
                    {c.best_match_score > 0 && (
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        c.best_match_score >= 0.7 ? 'bg-emerald-100 text-emerald-700' :
                        c.best_match_score >= 0.4 ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{(c.best_match_score * 100).toFixed(0)}%</span>
                    )}
                  </Link>
                ))}
              </div>
            )}

            {searchResults.total > 8 && (
              <button onClick={() => navigate('/candidates')} className="w-full mt-3 py-2 text-center text-sm text-indigo-600 font-medium hover:bg-indigo-50 rounded-xl transition">
                View all {searchResults.total} results in Candidates page
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {statCards.map((card, idx) => (
          <Link
            key={card.label}
            to={card.link}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.bg} p-6 border border-white shadow-sm card-hover animate-slide-up`}
            style={{ animationDelay: `${idx * 0.1}s` }}
          >
            {card.urgent && (
              <span className="absolute top-3 right-3 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            )}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{card.label}</p>
                <p className="text-4xl font-black text-gray-900 mt-2">{card.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center shadow-lg text-white`}>
                {card.icon}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link to="/jobs/new" className="group p-5 bg-white rounded-2xl border border-gray-100 shadow-sm card-hover">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-3 group-hover:bg-blue-600 transition">
            <svg className="w-5 h-5 text-blue-600 group-hover:text-white transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          </div>
          <p className="font-bold text-gray-900">Create New Job</p>
          <p className="text-sm text-gray-500 mt-1">Post a new position</p>
        </Link>
        <Link to="/approvals" className="group p-5 bg-white rounded-2xl border border-gray-100 shadow-sm card-hover">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mb-3 group-hover:bg-amber-500 transition">
            <svg className="w-5 h-5 text-amber-600 group-hover:text-white transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <p className="font-bold text-gray-900">Review Approvals</p>
          <p className="text-sm text-gray-500 mt-1">{stats.approvals} pending decisions</p>
        </Link>
        <Link to="/compliance" className="group p-5 bg-white rounded-2xl border border-gray-100 shadow-sm card-hover">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-3 group-hover:bg-emerald-600 transition">
            <svg className="w-5 h-5 text-emerald-600 group-hover:text-white transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <p className="font-bold text-gray-900">Compliance Report</p>
          <p className="text-sm text-gray-500 mt-1">GDPR/EEOC status</p>
        </Link>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Applications */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-900">Top Matched Applications</h2>
              <p className="text-xs text-gray-500 mt-0.5">Highest fit candidates</p>
            </div>
            <Link to="/applications" className="text-sm text-indigo-600 font-semibold hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {topApps.length === 0 ? (
              <p className="p-8 text-gray-400 text-sm text-center">No applications yet</p>
            ) : (
              topApps.map((app) => (
                <Link key={app.id} to="/applications" className="flex items-center justify-between p-4 hover:bg-gray-50 transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {app.candidate_name?.charAt(0) || 'C'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{app.candidate_name || 'Candidate'}</p>
                      <p className="text-xs text-gray-500 truncate">{app.job_title || 'Unknown role'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {app.has_video && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">Video</span>
                    )}
                    {app.match_score != null ? (
                      <div className={`px-3 py-1 rounded-xl font-bold text-sm ${
                        app.match_score >= 0.7 ? 'bg-emerald-100 text-emerald-700' :
                        app.match_score >= 0.4 ? 'bg-amber-100 text-amber-700' :
                        'bg-rose-100 text-rose-700'
                      }`}>
                        {(app.match_score * 100).toFixed(0)}%
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">N/A</span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Recent Activity</h2>
            <p className="text-xs text-gray-500 mt-0.5">Audit trail</p>
          </div>
          <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
            {recentLogs.length === 0 ? (
              <p className="p-8 text-gray-400 text-sm text-center">No activity</p>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="p-3 hover:bg-gray-50 transition">
                  <div className="flex items-start gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${actionColor(log.action)}`}>
                      {log.action.split('_').slice(0, 2).join(' ').toLowerCase()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(log.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
