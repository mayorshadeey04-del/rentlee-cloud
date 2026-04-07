import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import PlatformSidebar from './PlatformSidebar'
import PlatformNavbar  from './PlatformNavbar'
import './PlatformLayout.css'

export default function PlatformLayout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="platform-layout">
      <PlatformSidebar collapsed={collapsed} />
      <div className={`platform-main ${collapsed ? 'expanded' : ''}`}>
        <PlatformNavbar onToggleSidebar={() => setCollapsed(c => !c)} />
        <main className="platform-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}