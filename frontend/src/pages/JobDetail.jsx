import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

export default function JobDetail() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadJob(); }, [id]);

  const loadJob = async () => {
    try {
      const [jobRes, appsRes] = await Promise.all([
        api.get(`/jobs/${id}`),
        api.get('/applications', { params: { job_id: id, limit: 50 } }),
      ]);
      setJob(jobRes.data);
      setApplications(appsRes.data.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    try {
      const res = await api.post(`/jobs/${id}/publish`);
      setJob(res.data);
    } catch (err) {
      alert(JSON.stringify(err.response?.data?.detail || 'Failed to publish'));
    }
  };

  const handleClose = async () => {
    try {
      const res = await api.post(`/jobs/${id}/close`);
      setJob(res.data);
    } catch (err) {
      alert('Failed to close job');
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;
  if (!job) return <div className="text-center py-12 text-gray-500">Job not found</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/jobs" className="text-sm text-blue-600 hover:underline">&larr; Back to Jobs</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{job.title}</h1>
        </div>
        <div className="flex gap-2">
          {job.status === 'draft' && (
            <button onClick={handlePublish} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">Publish</button>
          )}
          {job.status === 'active' && (
            <button onClick={handleClose} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium">Close</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Job Details */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex gap-2 mb-4">
            <span className={`badge ${job.status === 'active' ? 'badge-green' : job.status === 'draft' ? 'badge-gray' : 'badge-red'}`}>{job.status}</span>
            {job.remote_allowed && <span className="badge badge-blue">Remote</span>}
          </div>

          <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
          <p className="text-gray-600 text-sm whitespace-pre-wrap mb-6">{job.description}</p>

          <h3 className="font-semibold text-gray-900 mb-2">Required Skills</h3>
          <div className="flex flex-wrap gap-2 mb-6">
            {(job.skills || []).map((s) => <span key={s} className="badge badge-blue">{s}</span>)}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">Experience:</span> <span className="font-medium">{job.experience_min || 0}-{job.experience_max || 'N/A'} years</span></div>
            <div><span className="text-gray-500">Education:</span> <span className="font-medium">{job.education || 'Not specified'}</span></div>
            <div><span className="text-gray-500">Location:</span> <span className="font-medium">{job.location || 'Not specified'}</span></div>
            <div><span className="text-gray-500">Salary:</span> <span className="font-medium">{job.salary_min ? `$${job.salary_min.toLocaleString()} - $${(job.salary_max || 0).toLocaleString()}` : 'Not specified'}</span></div>
          </div>
        </div>

        {/* Sidebar Stats */}
        <div className="space-y-4">
          <div className="stat-card">
            <p className="text-sm text-gray-500">Applications</p>
            <p className="text-3xl font-bold text-gray-900">{applications.length}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-gray-500">Created</p>
            <p className="text-sm font-medium text-gray-900">{new Date(job.created_at).toLocaleDateString()}</p>
          </div>
          {job.published_at && (
            <div className="stat-card">
              <p className="text-sm text-gray-500">Published</p>
              <p className="text-sm font-medium text-gray-900">{new Date(job.published_at).toLocaleDateString()}</p>
            </div>
          )}
        </div>
      </div>

      {/* Applications for this job */}
      {applications.length > 0 && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Applications ({applications.length})</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {applications.map((app) => (
              <div key={app.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <Link to={`/candidates/${app.candidate_id}`} className="text-blue-600 hover:underline font-medium text-sm">
                    Candidate {app.candidate_id.substring(0, 8)}...
                  </Link>
                  <div className="flex gap-2 mt-1">
                    <span className={`badge ${app.status === 'shortlisted' ? 'badge-green' : app.status === 'rejected' ? 'badge-red' : 'badge-yellow'}`}>
                      {app.status}
                    </span>
                    {app.ai_recommendation && (
                      <span className={`badge ${app.ai_recommendation === 'recommend' ? 'badge-green' : app.ai_recommendation === 'review' ? 'badge-yellow' : 'badge-red'}`}>
                        AI: {app.ai_recommendation}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">{app.match_score ? `${(app.match_score * 100).toFixed(0)}%` : 'N/A'}</p>
                  <p className="text-xs text-gray-500">Match Score</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
