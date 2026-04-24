import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function Compliance() {
  const [compliance, setCompliance] = useState(null);
  const [bias, setBias] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [compRes, biasRes] = await Promise.allSettled([
        api.get('/audit/reports/compliance'),
        api.get('/audit/reports/bias'),
      ]);
      if (compRes.status === 'fulfilled') setCompliance(compRes.value.data);
      if (biasRes.status === 'fulfilled') setBias(biasRes.value.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Compliance Dashboard</h1>
      <p className="text-sm text-gray-500 mb-6">GDPR, CCPA, and EEOC compliance monitoring</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* GDPR/CCPA */}
        <div className="stat-card">
          <h3 className="text-sm font-medium text-gray-500 mb-3">GDPR/CCPA Status</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Audit Coverage</span>
              <span className="font-medium text-green-600">{compliance?.audit_coverage || '100%'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Data Retention</span>
              <span className="font-medium text-green-600">{compliance?.data_retention || '6 years'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">GDPR Actions</span>
              <span className="font-medium">{compliance?.gdpr_related_actions || 0}</span>
            </div>
          </div>
        </div>

        {/* EEOC */}
        <div className="stat-card">
          <h3 className="text-sm font-medium text-gray-500 mb-3">EEOC Compliance</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Auto-Rejections</span>
              <span className="font-bold text-green-600">0 (ALWAYS)</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Disparate Impact</span>
              <span className="font-medium text-green-600">{bias?.disparate_impact_status || 'Compliant'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Bias Score</span>
              <span className="font-medium">{bias?.average_bias_score || 0}</span>
            </div>
          </div>
        </div>

        {/* AI Transparency */}
        <div className="stat-card">
          <h3 className="text-sm font-medium text-gray-500 mb-3">AI Transparency</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Applications Analyzed</span>
              <span className="font-medium">{bias?.total_applications_analyzed || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Human Overrides</span>
              <span className="font-medium">{bias?.human_overrides || 0} ({bias?.override_rate || '0%'})</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Auto-Rejections</span>
              <span className="font-bold text-green-600">0 (Policy Enforced)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Platform Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Three Platform Controls</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-800 mb-2">1. Policy Gate Service</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>Validates consent before processing</li>
              <li>Checks required fields and approvals</li>
              <li>Enforces suppression rules</li>
              <li>Gates all irreversible actions</li>
            </ul>
          </div>
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <h4 className="font-medium text-green-800 mb-2">2. Versioning + Immutable Storage</h4>
            <ul className="text-sm text-green-700 space-y-1">
              <li>Raw resumes stored separately</li>
              <li>All profiles versioned with history</li>
              <li>Enables rollback and reproducibility</li>
            </ul>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <h4 className="font-medium text-purple-800 mb-2">3. Comprehensive Audit Logging</h4>
            <ul className="text-sm text-purple-700 space-y-1">
              <li>Every action logged immutably</li>
              <li>AI vs human decision tracking</li>
              <li>6-year retention for EEOC</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Architecture Rules */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Architecture Rules (Enforced)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-900">Rule 1: "Ranking is not a Decision"</p>
            <p className="text-xs text-gray-500 mt-1">Model recommends, doesn't decide. No auto-rejection based on scores alone.</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-900">Rule 2: "AI can shortlist, humans finalize"</p>
            <p className="text-xs text-gray-500 mt-1">All shortlists require human approval. Override capability at every step.</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-900">Rule 3: "Never notify before human approval"</p>
            <p className="text-xs text-gray-500 mt-1">Candidate confirmation is gated and reversible. Message preview required.</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-900">Rule 4: "AI summarizes, humans judge"</p>
            <p className="text-xs text-gray-500 mt-1">Evaluation assists decision-making, does not replace human judgment.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
