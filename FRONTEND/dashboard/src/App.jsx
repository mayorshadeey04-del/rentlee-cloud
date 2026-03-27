import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

import AuthCallback     from './pages/AuthCallback'

// Management
import ManagementLayout from './layouts/management/ManagementLayout'
import Dashboard        from './pages/management/Dashboard'
import Properties       from './pages/management/Properties'
import PropertyDetails  from './pages/management/PropertyDetails'
import Units            from './pages/management/Units'
import Tenants          from './pages/management/Tenants'
import Payments         from './pages/management/Payments'
import Maintenance      from './pages/management/Maintenance'
import MaintenanceDetail from './pages/management/MaintenanceDetail' // ✅ NEW IMPORT
import Reports          from './pages/management/Reports'
import Settings         from './pages/management/Settings'
import Notifications    from './pages/management/Notifications'
import Profile          from './pages/management/Profile'

// Tenant
import TenantLayout      from './layouts/tenant/TenantLayout'
import TenantDashboard   from './pages/tenant/TenantDashboard'
import TenantMyUnit      from './pages/tenant/TenantMyUnit'
import TenantPayments    from './pages/tenant/TenantPayments'
import TenantMaintenance from './pages/tenant/TenantMaintenance'
import TenantProfile     from './pages/tenant/TenantProfile'
import TenantNotifications from './pages/tenant/TenantNotifications'

// ── Guards ────────────────────────────────────────────────────────────────────

function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useAuth()
  if (!user) {
    window.location.replace('http://127.0.0.1:5501/FRONTEND/landing/login.html')
    return null
  }
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'tenant' ? '/tenant/dashboard' : '/management/dashboard'} replace />
  }
  return children
}

function RootRedirect() {
  const { user } = useAuth()
  if (!user) {
    window.location.replace('http://127.0.0.1:5501/FRONTEND/landing/login.html')
    return null
  }
  if (user.role === 'tenant') return <Navigate to="/tenant/dashboard" replace />
  return <Navigate to="/management/dashboard" replace />
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Auth callback — receives token from landing pages */}
        <Route path="/auth-callback" element={<AuthCallback />} />

        <Route path="/" element={<RootRedirect />} />

        {/* ── Management (landlord + caretaker) ── */}
        <Route path="/management"
          element={<ProtectedRoute allowedRoles={['landlord', 'caretaker']}><ManagementLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard"     element={<Dashboard />} />
          <Route path="properties"    element={<Properties />} />
          <Route path="properties/Propertydetails" element={<PropertyDetails />} />
          <Route path="units"         element={<Units />} />
          <Route path="tenants"       element={<Tenants />} />
          <Route path="payments"      element={<Payments />} />
          
          {/* ✅ UPDATED MAINTENANCE ROUTES */}
          <Route path="maintenance"     element={<Maintenance />} />
          <Route path="maintenance/maintenancedetail" element={<MaintenanceDetail />} /> 
          
          <Route path="reports"       element={<Reports />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile"       element={<Profile />} />
          <Route path="settings"
            element={<ProtectedRoute allowedRoles={['landlord']}><Settings /></ProtectedRoute>} />
        </Route>

        {/* ── Tenant ── */}
        <Route path="/tenant"
          element={<ProtectedRoute allowedRoles={['tenant']}><TenantLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard"   element={<TenantDashboard />} />
          <Route path="my-unit"     element={<TenantMyUnit />} />
          <Route path="payments"    element={<TenantPayments />} />
          <Route path="maintenance" element={<TenantMaintenance />} />
          <Route path="profile"     element={<TenantProfile />} />
          <Route path="notifications" element={<TenantNotifications />} />
        </Route>

        <Route path="*" element={<RootRedirect />} />

      </Routes>
    </BrowserRouter>
  )
}