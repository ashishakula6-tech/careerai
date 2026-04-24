import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const EXAMPLE_QUERIES = [
  "Python developers with 5+ years",
  "React engineers in Bangalore",
  "Shortlisted candidates with AWS",
  "Machine learning engineers with Masters",
  "Candidates who passed interview",
  "Frontend developers in Dubai",
  "All rejected candidates",
  "DevOps engineers with Kubernetes",
  "Data scientists in India",
  "Senior engineers with system design",
];

export default function Candidates() {
  const [candidates, setCandidates] = useState([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // AI Search
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null); // null = not searching, object = search results
  const [filtersApplied, setFiltersApplied] = useState(null);
  const [showExamples, setShowExamples] = useState(false);

  useEffect(() => { load(); }, [statusFilter]);

  const load = async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/candidates', { params });
      setCandidates(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleAISearch = async (query) => {
    const q = query || searchQuery;
    if (!q.trim()) { clearSearch(); return; }
    setIsSearching(true);
    setSearchQuery(q);
    try {
      const res = await api.get('/candidates/search', { params: { q, limit: 50 } });
      setSearchResults(res.data.items || []);
      setFiltersApplied(res.data.filters_applied);
      setTotal(res.data.total || 0);
    } catch (err) { console.error(err); }
    finally { setIsSearching(false); }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setFiltersApplied(null);
    setShowExamples(false);
    load();
  };

  const displayList = searchResults || candidates;

  const statusColors = {
    new: 'bg-blue-100 text-blue-700',
    parsed: 'bg-yellow-100 text-yellow-700',
    matched: 'bg-amber-100 text-amber-700',
    shortlisted: 'bg-emerald-100 text-emerald-700',
    interviewing: 'bg-purple-100 text-purple-700',
    interview_passed: 'bg-green-200 text-green-800',
    rejected: 'bg-rose-100 text-rose-700',
    withdrawn: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Candidates</h1>
          <p className="text-sm text-gray-500 mt-1">{total} {searchResults ? 'found' : 'total'}</p>
        </div>
      </div>

      {/* AI Search Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <span className="text-sm font-semibold text-gray-700">AI-Powered Search</span>
          <span className="text-xs text-gray-400">— search candidates using natural language</span>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleAISearch(); }} className="flex gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <input
              type="text" value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowExamples(true)}
              placeholder="e.g. Python developers with 5+ years in Bangalore..."
              className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm"
            />
            {searchQuery && (
              <button type="button" onClick={clearSearch} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
          <button type="submit" disabled={isSearching}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold text-sm hover:shadow-lg hover:scale-105 disabled:opacity-50 transition-all flex items-center gap-2">
            {isSearching ? (
              <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Searching...</>
            ) : (
              <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> AI Search</>
            )}
          </button>
        </form>

        {/* Example queries */}
        {showExamples && !searchResults && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500 font-medium mb-2">Try asking:</p>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_QUERIES.map((eq) => (
                <button key={eq} onClick={() => handleAISearch(eq)}
                  className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-100 transition">
                  {eq}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Applied filters display */}
        {filtersApplied && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Filters:</span>
            {filtersApplied.skills?.length > 0 && filtersApplied.skills.map(s => (
              <span key={s} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{s}</span>
            ))}
            {filtersApplied.location && (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">{filtersApplied.location}</span>
            )}
            {filtersApplied.status && (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">{filtersApplied.status}</span>
            )}
            {filtersApplied.experience_min != null && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                {filtersApplied.experience_min}+ years
              </span>
            )}
            {filtersApplied.education && (
              <span className="px-2 py-0.5 bg-pink-100 text-pink-700 rounded-full text-xs font-medium">{filtersApplied.education}</span>
            )}
            <button onClick={clearSearch} className="text-xs text-rose-600 hover:text-rose-700 font-medium ml-2">Clear</button>
          </div>
        )}
      </div>

      {/* Status filter bar (for regular browsing) */}
      {!searchResults && (
        <div className="flex gap-2 mb-4">
          {['', 'new', 'parsed', 'matched', 'shortlisted', 'interviewing', 'interview_passed', 'rejected'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}>
              {s === 'interview_passed' ? 'Passed' : s || 'All'}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {loading || isSearching ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="inline-block w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-gray-500 mt-3 text-sm">{isSearching ? 'AI is searching...' : 'Loading...'}</p>
          </div>
        </div>
      ) : displayList.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-gray-500 font-medium">No candidates found</p>
          {searchResults !== null && <button onClick={clearSearch} className="mt-2 text-indigo-600 text-sm hover:underline">Clear search</button>}
        </div>
      ) : (
        <div className="space-y-3">
          {displayList.map((c, idx) => (
            <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden card-hover animate-slide-up" style={{ animationDelay: `${idx * 0.03}s` }}>
              <div className="p-5">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {c.first_name?.charAt(0)}{c.last_name?.charAt(0)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link to={`/candidates/${c.id}`} className="text-lg font-bold text-gray-900 hover:text-indigo-600 transition">
                        {c.first_name} {c.last_name}
                      </Link>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColors[c.status] || 'bg-gray-100 text-gray-600'}`}>
                        {c.status === 'interview_passed' ? 'Passed' : c.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{c.email}</p>

                    {/* Skills (from search results) */}
                    {c.skills && c.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {c.skills.slice(0, 8).map(s => (
                          <span key={s} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">{s}</span>
                        ))}
                        {c.skills.length > 8 && <span className="px-2 py-0.5 bg-gray-50 text-gray-500 rounded text-xs">+{c.skills.length - 8}</span>}
                      </div>
                    )}

                    {/* Summary */}
                    {c.summary && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{c.summary}</p>
                    )}

                    {/* Applications (from search results) */}
                    {c.applications && c.applications.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {c.applications.slice(0, 3).map((app, i) => (
                          <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-lg text-xs">
                            <span className="text-gray-700 font-medium">{app.job_title}</span>
                            {app.match_score != null && (
                              <span className={`font-bold ${app.match_score >= 0.7 ? 'text-emerald-600' : app.match_score >= 0.4 ? 'text-amber-600' : 'text-rose-500'}`}>
                                {(app.match_score * 100).toFixed(0)}%
                              </span>
                            )}
                            {app.has_video && <span className="text-purple-500" title="Has video pitch">🎥</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right side — match score + actions */}
                  <div className="text-right flex-shrink-0">
                    {c.best_match_score > 0 && (
                      <div className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-sm ${
                        c.best_match_score >= 0.7 ? 'bg-emerald-100 text-emerald-700' :
                        c.best_match_score >= 0.4 ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {(c.best_match_score * 100).toFixed(0)}% best match
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{new Date(c.created_at).toLocaleDateString()}</p>
                    <Link to={`/candidates/${c.id}`} className="inline-block mt-2 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-100 transition">
                      View Profile
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
