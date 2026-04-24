import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/common/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Jobs from './pages/Jobs';
import JobCreate from './pages/JobCreate';
import JobDetail from './pages/JobDetail';
import Candidates from './pages/Candidates';
import CandidateDetail from './pages/CandidateDetail';
import Applications from './pages/Applications';
import Videos from './pages/Videos';
import Approvals from './pages/Approvals';
import Notifications from './pages/Notifications';
import AuditLogs from './pages/AuditLogs';
import Compliance from './pages/Compliance';
import CandidatePortal from './pages/CandidatePortal';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/portal" element={<CandidatePortal />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/jobs" element={<ProtectedRoute><Jobs /></ProtectedRoute>} />
          <Route path="/jobs/new" element={<ProtectedRoute><JobCreate /></ProtectedRoute>} />
          <Route path="/jobs/:id" element={<ProtectedRoute><JobDetail /></ProtectedRoute>} />
          <Route path="/candidates" element={<ProtectedRoute><Candidates /></ProtectedRoute>} />
          <Route path="/candidates/:id" element={<ProtectedRoute><CandidateDetail /></ProtectedRoute>} />
          <Route path="/applications" element={<ProtectedRoute><Applications /></ProtectedRoute>} />
          <Route path="/videos" element={<ProtectedRoute><Videos /></ProtectedRoute>} />
          <Route path="/approvals" element={<ProtectedRoute><Approvals /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/audit" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
          <Route path="/compliance" element={<ProtectedRoute><Compliance /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
