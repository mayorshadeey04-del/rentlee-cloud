import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import TenantSidebar from './TenantSidebar'
import TenantNavbar  from './TenantNavbar'
import './TenantLayout.css'

export default function TenantLayout() {
  const [collapsed, setCollapsed] = useState(false)

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