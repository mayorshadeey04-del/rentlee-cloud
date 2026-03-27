import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import ManagementSidebar from './ManagementSidebar'
import ManagementNavbar  from './ManagementNavbar'
import './ManagementLayout.css'

export default function ManagementLayout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="management-layout">

      {/* Fixed sidebar — never unmounts */}
      <ManagementSidebar collapsed={collapsed} />

      {/* Right side */}
      <div className={`management-main ${collapsed ? 'expanded' : ''}`}>

        {/* Fixed navbar — never unmounts */}
        {/* notificationCount — swap 3 with your API value later */}
        <ManagementNavbar
          onToggleSidebar={() => setCollapsed(c => !c)}
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