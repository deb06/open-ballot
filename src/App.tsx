import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { toast } from './lib/toast'

// Layouts
import PublicLayout from './components/layout/PublicLayout'
import AuthLayout from './components/layout/AuthLayout'
import AdminLayout from './components/layout/AdminLayout'

// Public pages
import Home from './pages/Home'
import Elections from './pages/Elections'
import ElectionDetail from './pages/ElectionDetail'
import Verify from './pages/Verify'
import Help from './pages/Help'
import Organizations from './pages/Organizations'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import Refunds from './pages/Refunds'
import DataRequest from './pages/DataRequest'
import Dpa from './pages/Dpa'
import Subprocessors from './pages/Subprocessors'
import Status from './pages/Status'
import Archive from './pages/Archive'
import AuditChain from './pages/AuditChain'
import NotFound from './pages/NotFound'

// Auth pages
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'
import VerifyEmail from './pages/auth/VerifyEmail'
import VerifyEmailOtp from './pages/auth/VerifyEmailOtp'
import RegisterOrganization from './pages/auth/RegisterOrganization'
import Join from './pages/auth/Join'

// Account pages
import Account from './pages/account/Account'

// Admin pages
import AdminDashboard from './pages/admin/Dashboard'
import AdminElections from './pages/admin/Elections'
import AdminUsers from './pages/admin/Users'
import AdminAudit from './pages/admin/Audit'
import AdminPolls from './pages/admin/Polls'
import AdminWebhooks from './pages/admin/Webhooks'
import AdminApiKeys from './pages/admin/ApiKeys'
import AdminSchema from './pages/admin/Schema'
import AdminOrganization from './pages/admin/Organization'
import AdminOrganizations from './pages/admin/Organizations'

// Poll pages
import PollNew from './pages/polls/PollNew'
import PollDetail from './pages/polls/PollDetail'

// Auth required wrapper
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth()
  if (loading) return <div className="loading-screen">Loading...</div>
  if (!user || !isAdmin()) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireOrgAdmin({ children }: { children: React.ReactNode }) {
  const { user, isOrgAdmin, loading } = useAuth()
  if (loading) return <div className="loading-screen">Loading...</div>
  if (!user || !isOrgAdmin()) return <Navigate to="/login" replace />
  return <>{children}</>
}

// Inner app that lives INSIDE AuthProvider - can safely use useAuth
function AppRoutes() {
  const { loading, refresh, logout } = useAuth()
  const navigate = useNavigate()

  // Handle auth expiration from API
  useEffect(() => {
    const handler = () => {
      toast('Your session has expired. Please sign in again.', 'error')
      navigate('/login')
    }
    window.addEventListener('auth:expired', handler)
    return () => window.removeEventListener('auth:expired', handler)
  }, [navigate])

  // Don't block rendering on auth check - render routes immediately
  // The auth state will hydrate in the background
  return (
    <Routes>
        {/* Public */}
        <Route path="/" element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="elections" element={<Elections />} />
          <Route path="election/:id" element={<ElectionDetail />} />
          <Route path="verify" element={<Verify />} />
          <Route path="help" element={<Help />} />
          <Route path="organizations" element={<Organizations />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="terms" element={<Terms />} />
          <Route path="refunds" element={<Refunds />} />
          <Route path="data-request" element={<RequireAuth><DataRequest /></RequireAuth>} />
          <Route path="dpa" element={<Dpa />} />
          <Route path="subprocessors" element={<Subprocessors />} />
          <Route path="status" element={<Status />} />
          <Route path="archive" element={<Archive />} />
          <Route path="audit" element={<AuditChain />} />
          <Route path="party" element={<Home />} />
        </Route>

        {/* Auth */}
        <Route path="login" element={<AuthLayout><Login /></AuthLayout>} />
        <Route path="register" element={<AuthLayout><Register /></AuthLayout>} />
        <Route path="forgot-password" element={<AuthLayout><ForgotPassword /></AuthLayout>} />
        <Route path="reset-password/:token" element={<AuthLayout><ResetPassword /></AuthLayout>} />
        <Route path="verify-email" element={<AuthLayout><VerifyEmailOtp /></AuthLayout>} />
          <Route path="verify-email/:token" element={<AuthLayout><VerifyEmail /></AuthLayout>} />
        <Route path="register-organization" element={<AuthLayout><RegisterOrganization /></AuthLayout>} />
        <Route path="join" element={<AuthLayout><Join /></AuthLayout>} />

        {/* Account */}
        <Route path="account" element={<RequireAuth><Account /></RequireAuth>} />

        {/* Admin */}
        <Route path="admin/*" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
          <Route index element={<AdminDashboard />} />
          <Route path="elections" element={<AdminElections />} />
          <Route path="election/:id" element={<AdminElections />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="audit" element={<AdminAudit />} />
          <Route path="polls" element={<AdminPolls />} />
          <Route path="webhooks" element={<AdminWebhooks />} />
          <Route path="api-keys" element={<AdminApiKeys />} />
          <Route path="schema" element={<AdminSchema />} />
          <Route path="org" element={<AdminOrganization />} />
          <Route path="organizations" element={<AdminOrganizations />} />
        </Route>

        {/* Polls */}
        <Route path="polls/new" element={<RequireAuth><PollNew /></RequireAuth>} />
        <Route path="p/:slug" element={<PollDetail />} />

        {/* Observer */}
        <Route path="observer" element={<RequireAuth><Home /></RequireAuth>} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
  )
}

// Root App - BrowserRouter must wrap the component that calls useNavigate
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App