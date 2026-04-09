import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import ManagementSidebar from './ManagementSidebar'
import ManagementNavbar  from './ManagementNavbar'
import './ManagementLayout.css'

export default function ManagementLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  // ✅ Auto-close the mobile sidebar whenever the user navigates to a new page
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const handleToggleSidebar = () => {
    if (window.innerWidth <= 768) {
      setMobileOpen(!mobileOpen)
    } else {
      setCollapsed(!collapsed)
    }
  }

  return (
    <div className="management-layout">
      
      {/* ✅ Dark overlay for mobile when sidebar is open */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)}></div>
      )}

      {/* Fixed sidebar */}
      <ManagementSidebar collapsed={collapsed} mobileOpen={mobileOpen} />

      {/* Right side */}
      <div className={`management-main ${collapsed ? 'expanded' : ''}`}>

        {/* Fixed navbar */}
        <ManagementNavbar
          onToggleSidebar={handleToggleSidebar}
          notificationCount={3}
        />

        {/* ── Only this area changes when clicking menu items ── */}
        <main className="management-content">
          <Outlet />
        </main>

      </div>
    </div>
  )
}