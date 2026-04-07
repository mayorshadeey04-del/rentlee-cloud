import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { can } from '../../utils/permissions'
import './ManagementSidebar.css'

export default function ManagementSidebar({ collapsed }) {
  const { user } = useAuth()
  const location = useLocation()
  
  // Keep the Financials dropdown open if we are currently inside it
  const isFinancialActive = location.pathname.includes('/management/payments') || location.pathname.includes('/management/ledger')
  const [financialsOpen, setFinancialsOpen] = useState(isFinancialActive)

  const navItems = [
    {
      path: '/management/dashboard',
      icon: 'fas fa-th-large',
      label: 'Dashboard',
      show: true,
    },
    {
      path: '/management/properties',
      icon: 'fas fa-building',
      label: 'Properties',
      show: true, 
    },
    {
      path: '/management/tenants',
      icon: 'fas fa-users',
      label: 'Tenants',
      show: true,
    },
    // ✅ DROPDOWN MENU FOR FINANCIALS
    {
      id: 'financials',
      icon: 'fas fa-money-bill-wave',
      label: 'Financials',
      show: can(user.role, 'payments', 'view'),
      children: [
        { path: '/management/payments', label: 'Payments' },
        { path: '/management/ledger', label: 'Tenant Ledgers' }
      ]
    },
    {
      path: '/management/maintenance',
      icon: 'fas fa-wrench',
      label: 'Maintenance',
      show: true,
    },
    {
      path: '/management/reports',
      icon: 'fas fa-chart-line',
      label: 'Reports',
      show: can(user.role, 'reports', 'view'),
    },
    {
      path: '/management/settings',
      icon: 'fas fa-cog',
      label: 'Settings',
      show: user.role === 'landlord',
    },
  ]

  return (
    <aside className={`management-sidebar ${collapsed ? 'collapsed' : ''}`}>

      {/* Logo */}
      <div className="sidebar-logo">
        <svg className="sidebar-logo-icon" viewBox="0 0 98 89" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9.81982 42.5871V65.0695C9.81982 69.7779 9.81982 72.1321 10.8827 73.9356C11.8188 75.5162 13.3059 76.8026 15.144 77.6056C17.2259 78.522 19.9562 78.522 25.4071 78.522H72.242C77.693 78.522 80.4184 78.522 82.5003 77.6056C84.3361 76.8013 85.8295 75.5166 86.7664 73.9356C87.8293 72.1363 87.8293 69.7863 87.8293 65.0864V42.5871C87.8293 40.3422 87.8293 39.2198 87.5124 38.173C87.2318 37.2478 86.7701 36.3706 86.1472 35.5792C85.4403 34.6838 84.4652 33.9397 82.5003 32.4641L59.0975 14.8077C55.4603 12.0626 53.6368 10.6879 51.589 10.1666C49.7851 9.70422 47.8641 9.70422 46.0552 10.1666C44.0075 10.6879 42.1938 12.0584 38.5566 14.7993L15.1488 32.4641C13.1889 33.9439 12.2089 34.6838 11.5068 35.575C10.8817 36.3674 10.4184 37.246 10.1367 38.173C9.81982 39.2156 9.81982 40.3422 9.81982 42.5871Z" stroke="#3B82F6" strokeWidth="9.81979" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div className="sidebar-logo-text-wrapper">
          <span className="sidebar-logo-text"><span className="logo-rent">Rent</span><span className="logo-lee">lee</span></span>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <ul className="sidebar-menu">
          {navItems.filter(item => item.show).map((item) => {
            
            // Render Dropdown for Financials
            if (item.children) {
              return (
                <li key={item.id} className="sidebar-nav-item dropdown-container">
                  <div 
                    className={`sidebar-nav-link ${isFinancialActive ? 'active-parent' : ''}`} 
                    onClick={() => setFinancialsOpen(!financialsOpen)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="sidebar-nav-icon"><i className={item.icon}></i></span>
                    <span className="sidebar-nav-text">{item.label}</span>
                  </div>
                  
                  {!collapsed && financialsOpen && (
                    <ul className="sidebar-dropdown-menu" style={{ listStyle: 'none', padding: 0, margin: '0.25rem 0 0 0', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {item.children.map(child => (
                        <li key={child.path}>
                          <NavLink to={child.path} className={({ isActive }) => `sidebar-nav-link sub-link ${isActive ? 'active' : ''}`}>
                            <span className="sidebar-nav-icon" style={{ width: '20px' }}></span>
                            <span className="sidebar-nav-text">{child.label}</span>
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            }

            // Render Standard Link
            return (
              <li key={item.path} className="sidebar-nav-item">
                <NavLink
                  to={item.path}
                  className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}
                >
                  <span className="sidebar-nav-icon"><i className={item.icon}></i></span>
                  <span className="sidebar-nav-text">{item.label}</span>
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

    </aside>
  )
}