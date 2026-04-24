import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const statusColors = {
  draft: 'badge-gray', active: 'badge-green', closed: 'badge-red', archived: 'badge-yellow',
};

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadJobs(); }, [statusFilter]);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/jobs', { params });
      setJobs(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <p className="text-sm text-gray-500 mt-1">{total} total jobs</p>
        </div>
        <Link to="/jobs/new" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">
          + Create Job
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {['', 'draft', 'active', 'closed'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Jobs Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-gray-500">Loading...</p>
        ) : jobs.length === 0 ? (
          <p className="p-8 text-center text-gray-500">No jobs found</p>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Skills</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link to={`/jobs/${job.id}`} className="text-blue-600 hover:underline font-medium">
                      {job.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {job.location || 'Not specified'}
                    {job.remote_allowed && <span className="ml-1 text-green-600">(Remote)</span>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(job.skills || []).slice(0, 3).map((s) => (
                        <span key={s} className="badge badge-blue">{s}</span>
                      ))}
                      {(job.skills || []).length > 3 && (
                        <span className="badge badge-gray">+{job.skills.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`badge ${statusColors[job.status] || 'badge-gray'}`}>{job.status}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(job.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
