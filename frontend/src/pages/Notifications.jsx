import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications', { params: { limit: 50 } });
      setNotifications(res.data.items || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleApprove = async (id) => {
    try {
      await api.post(`/notifications/${id}/approve`);
      load();
    } catch (err) { alert('Failed to approve'); }
  };

  const handleEdit = (notif) => {
    setEditingId(notif.id);
    setEditContent(notif.message_content || '');
  };

  const saveEdit = async (id) => {
    try {
      await api.put(`/notifications/${id}`, null, { params: { message_content: editContent } });
      setEditingId(null);
      load();
    } catch (err) { alert('Failed to save'); }
  };

  const statusColors = {
    pending_approval: 'badge-yellow', approved: 'badge-blue', sent: 'badge-green', failed: 'badge-red',
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Notifications</h1>
      <p className="text-sm text-gray-500 mb-6">Review and approve candidate notifications before sending</p>

      {loading ? <p className="text-center py-8 text-gray-500">Loading...</p> : notifications.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500">No notifications</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((n) => (
            <div key={n.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className={`badge ${statusColors[n.status] || 'badge-gray'}`}>{n.status.replace('_', ' ')}</span>
                  <span className="text-sm text-gray-500 ml-2">{n.type}</span>
                </div>
                <span className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString()}</span>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 mb-3">
                <p className="text-xs text-gray-500 mb-1">To: {n.recipient_email}</p>
                <p className="text-sm font-medium text-gray-900 mb-2">Subject: {n.subject}</p>
                {editingId === n.id ? (
                  <div>
                    <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => saveEdit(n.id)} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Save</button>
                      <button onClick={() => setEditingId(null)} className="px-3 py-1 border border-gray-300 rounded text-sm">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{n.message_content}</p>
                )}
              </div>

              {n.status === 'pending_approval' && (
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(n)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Edit</button>
                  <button onClick={() => handleApprove(n.id)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Approve & Send</button>
                </div>
              )}
              {n.sent_at && <p className="text-xs text-green-600 mt-2">Sent at: {new Date(n.sent_at).toLocaleString()}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
