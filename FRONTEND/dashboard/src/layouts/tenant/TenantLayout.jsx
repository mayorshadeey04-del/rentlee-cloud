import { useState, useEffect } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import TenantSidebar from './TenantSidebar'
import TenantNavbar  from './TenantNavbar'
import './TenantLayout.css'

const API_URL = 'http://localhost:5001/api'

export default function TenantLayout() {
  const { authHeaders } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [isLocked, setIsLocked] = useState(null) // null = loading
  const location = useLocation()

  // 1. GLOBAL GATEWAY CHECK
  useEffect(() => {
    let isMounted = true;
    
    // Check lock status on every route change
    fetch(`${API_URL}/tenant-dashboard`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => {
        if (isMounted) {
          if (data.success && data.data.info.requiresMoveInPayment) {
            setIsLocked(true)
          } else {
            setIsLocked(false)
          }
        }
      })
      .catch(err => {
        console.error("Layout security check failed:", err)
        if (isMounted) setIsLocked(false)
      })

      return () => { isMounted = false }
  }, [location.pathname, authHeaders])

  // Show a clean loading state while verifying
  if (isLocked === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f8fafc' }}>
        <i className="fas fa-circle-notch fa-spin fa-2x" style={{ color: '#cbd5e1' }}></i>
      </div>
    )
  }

  // =========================================================
  // LOCKED VIEW: No Sidebar, Locked to Dashboard
  // =========================================================
  if (isLocked) {
    return (
      <div className="tenant-layout">
        {/* Sidebar is entirely removed from the DOM here */}
        
        <div className="tenant-main" style={{ marginLeft: 0 }}>
          {/* Tell the Navbar to hide the hamburger icon */}
          <TenantNavbar onToggleSidebar={() => {}} hideMenuBtn={true} />
          
          <main className="tenant-content">
            {/* Strict URL Guard: Redirects back to dashboard if they try to bypass */}
            {location.pathname !== '/tenant/dashboard' ? (
              <Navigate to="/tenant/dashboard" replace />
            ) : (
              <Outlet />
            )}
          </main>
        </div>
      </div>
    )
  }

  // =========================================================
  // NORMAL VIEW: Full Access
  // =========================================================
  return (
    <div className="tenant-layout">
      <TenantSidebar collapsed={collapsed} />
      <div className={`tenant-main ${collapsed ? 'expanded' : ''}`}>
        <TenantNavbar onToggleSidebar={() => setCollapsed(c => !c)} />
        <main className="tenant-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}