import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import PlatformSidebar from './PlatformSidebar'
import PlatformNavbar  from './PlatformNavbar'
import './PlatformLayout.css'

export default function PlatformLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  // ✅ Auto-close the mobile sidebar whenever the user navigates
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
    <div className="platform-layout">
      {/* ✅ Dark overlay for mobile */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)}></div>
      )}

      {/* ✅ Pass mobileOpen prop */}
      <PlatformSidebar collapsed={collapsed} mobileOpen={mobileOpen} />
      
      <div className={`platform-main ${collapsed ? 'expanded' : ''}`}>
        <PlatformNavbar onToggleSidebar={handleToggleSidebar} />
        <main className="platform-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}