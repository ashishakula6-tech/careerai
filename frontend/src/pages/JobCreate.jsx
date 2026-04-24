import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function JobCreate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [form, setForm] = useState({
    title: '', description: '', skills: [],
    experience_min: '', experience_max: '', education: '',
    location: '', remote_allowed: false,
    salary_min: '', salary_max: '',
  });

  const addSkill = () => {
    const skill = skillInput.trim();
    if (skill && !form.skills.includes(skill)) {
      setForm({ ...form, skills: [...form.skills, skill] });
      setSkillInput('');
    }
  };

  const removeSkill = (s) => {
    setForm({ ...form, skills: form.skills.filter((sk) => sk !== s) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('title', form.title);
      params.append('description', form.description);
      form.skills.forEach((s) => params.append('skills', s));
      if (form.experience_min) params.append('experience_min', form.experience_min);
      if (form.experience_max) params.append('experience_max', form.experience_max);
      if (form.education) params.append('education', form.education);
      if (form.location) params.append('location', form.location);
      params.append('remote_allowed', form.remote_allowed);
      if (form.salary_min) params.append('salary_min', form.salary_min);
      if (form.salary_max) params.append('salary_max', form.salary_max);

      const res = await api.post('/jobs', null, { params });
      navigate(`/jobs/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Job</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{JSON.stringify(error)}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
          <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={6} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required minLength={50} />
          <p className="text-xs text-gray-400 mt-1">Minimum 50 characters for effective AI matching</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Skills *</label>
          <div className="flex gap-2 mb-2">
            <input type="text" value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg" placeholder="Type a skill and press Enter" />
            <button type="button" onClick={addSkill} className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200">Add</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.skills.map((s) => (
              <span key={s} className="badge badge-blue cursor-pointer" onClick={() => removeSkill(s)}>{s} x</span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Experience (years)</label>
            <input type="number" value={form.experience_min} onChange={(e) => setForm({ ...form, experience_min: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" min={0} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Experience (years)</label>
            <input type="number" value={form.experience_max} onChange={(e) => setForm({ ...form, experience_max: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" min={0} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Education</label>
          <select value={form.education} onChange={(e) => setForm({ ...form, education: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg">
            <option value="">Not required</option>
            <option value="Bachelor's in CS">Bachelor's in CS</option>
            <option value="Bachelor's">Bachelor's (any field)</option>
            <option value="Master's">Master's</option>
            <option value="PhD">PhD</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="e.g., San Francisco" />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.remote_allowed} onChange={(e) => setForm({ ...form, remote_allowed: e.target.checked })} className="rounded" />
              <span className="text-sm text-gray-700">Remote allowed</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Salary Min ($)</label>
            <input type="number" value={form.salary_min} onChange={(e) => setForm({ ...form, salary_min: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Salary Max ($)</label>
            <input type="number" value={form.salary_max} onChange={(e) => setForm({ ...form, salary_max: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button type="submit" disabled={loading} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Creating...' : 'Create Job'}
          </button>
          <button type="button" onClick={() => navigate('/jobs')} className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
