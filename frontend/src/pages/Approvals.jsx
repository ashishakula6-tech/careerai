import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function Approvals() {
  const [approvals, setApprovals] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/approvals', { params: { status: 'pending', limit: 50 } });
      setApprovals(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleAction = async (id, action) => {
    try {
      await api.post(`/approvals/${id}/${action}`);
      load();
    } catch (err) {
      alert(`Failed to ${action}`);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Pending Approvals</h1>
      <p className="text-sm text-gray-500 mb-6">{total} pending items requiring human review</p>

      {loading ? <p className="text-center py-8 text-gray-500">Loading...</p> : approvals.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500">No pending approvals</p>
          <p className="text-sm text-gray-400 mt-1">All actions have been reviewed</p>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map((a) => (
            <div key={a.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge badge-yellow">Pending</span>
                    <span className="text-sm font-medium text-gray-900">{a.action.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="text-sm text-gray-500">Entity: {a.entity_type} ({a.entity_id.substring(0, 8)}...)</p>
                  {a.ai_recommendation && (
                    <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs font-medium text-blue-700">AI Recommendation</p>
                      <p className="text-sm text-blue-800">
                        Decision: {a.ai_recommendation.decision} | Score: {a.ai_recommendation.score ? `${(a.ai_recommendation.score * 100).toFixed(0)}%` : 'N/A'}
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-2">Expires: {new Date(a.expires_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleAction(a.id, 'approve')} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Approve</button>
                  <button onClick={() => handleAction(a.id, 'reject')} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Reject</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
