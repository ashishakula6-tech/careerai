import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [actionFilter]);

  const load = async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (actionFilter) params.action = actionFilter;
      const res = await api.get('/audit/logs', { params });
      setLogs(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const actionTypes = ['', 'JOB_CREATED', 'JOB_PUBLISHED', 'CANDIDATE_CREATED', 'APPLICATION_CREATED', 'CANDIDATE_SHORTLISTED', 'CANDIDATE_REJECTED', 'NOTIFICATION_SENT'];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-sm text-gray-500 mt-1">{total} total entries (immutable, 6-year retention)</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {actionTypes.map((a) => (
          <button key={a} onClick={() => setActionFilter(a)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${actionFilter === a ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}>
            {a || 'All'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? <p className="p-8 text-center text-gray-500">Loading...</p> : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-600">{log.user_id === 'system' ? 'System' : log.user_id.substring(0, 8) + '...'}</td>
                  <td className="px-4 py-3">
                    <span className="badge badge-blue">{log.action}</span>
                    {log.gdpr_related && <span className="badge badge-red ml-1">GDPR</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{log.entity_type} {log.entity_id ? log.entity_id.substring(0, 8) + '...' : ''}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                    {log.details && Object.keys(log.details).length > 0 ? (
                      <details className="cursor-pointer">
                        <summary className="text-blue-600 hover:underline">View</summary>
                        <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-auto max-h-32">{JSON.stringify(log.details, null, 2)}</pre>
                      </details>
                    ) : '-'}
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
