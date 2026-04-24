import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('admin@demo.example.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-purple-900 to-indigo-950"></div>

      {/* Animated blobs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-float"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-pink-500 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-float" style={{ animationDelay: '4s' }}></div>
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-grid opacity-10"></div>

      <div className="relative z-10 max-w-5xl w-full mx-4 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Left side - Marketing */}
        <div className="text-white animate-fade-in hidden lg:block">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur rounded-full border border-white/20 mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-medium text-white/90">Next-gen recruitment platform</span>
          </div>

          <h1 className="text-5xl font-black mb-4 leading-tight">
            Hire smarter with
            <span className="block text-gradient-sunset mt-1">AI-powered insights</span>
          </h1>
          <p className="text-lg text-white/70 mb-8">
            The modern recruitment console that matches the best candidates to your roles automatically with resume parsing, AI interviews, and compliance built-in.
          </p>

          {/* Features */}
          <div className="space-y-4">
            {[
              { icon: '🎯', title: 'Smart Match', desc: 'AI ranks candidates by fit percentage' },
              { icon: '🎙️', title: 'AI Interviews', desc: 'Voice-based screenings save hours' },
              { icon: '🛡️', title: 'Compliant', desc: 'GDPR, CCPA, EEOC built-in' },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 backdrop-blur border border-white/10">
                <div className="text-2xl">{f.icon}</div>
                <div>
                  <p className="font-semibold text-white">{f.title}</p>
                  <p className="text-sm text-white/60">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right side - Login Card */}
        <div className="animate-fade-in">
          <div className="glass-card rounded-3xl p-8 shadow-2xl">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-xl">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h2 className="text-2xl font-black text-gray-900">Welcome back</h2>
              <p className="text-gray-500 text-sm mt-1">Sign in to your recruiter account</p>
            </div>

            {error && (
              <div className="mb-5 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white/80 transition"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white/80 transition"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white rounded-xl font-bold shadow-xl hover:shadow-2xl hover:scale-[1.02] disabled:opacity-50 disabled:scale-100 transition-all"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Signing in...
                  </span>
                ) : 'Sign in to Console'}
              </button>
            </form>

            <div className="mt-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
              <p className="text-xs font-semibold text-indigo-700 mb-2">Demo Credentials</p>
              <div className="space-y-1 text-xs text-gray-600">
                <div className="flex justify-between"><span>Admin:</span><code className="bg-white px-2 py-0.5 rounded">admin@demo.example.com / admin123</code></div>
                <div className="flex justify-between"><span>Recruiter:</span><code className="bg-white px-2 py-0.5 rounded">recruiter@demo.example.com / admin123</code></div>
              </div>
            </div>
          </div>

          <p className="text-center mt-6 text-sm text-white/70">
            Looking for jobs? <a href="/portal" className="text-white font-semibold hover:text-indigo-300 transition">Visit Candidate Portal &rarr;</a>
          </p>
        </div>
      </div>
    </div>
  );
}
