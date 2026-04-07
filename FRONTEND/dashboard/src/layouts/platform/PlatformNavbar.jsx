import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './PlatformNavbar.css'

export default function PlatformNavbar({ onToggleSidebar }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [userOpen, setUserOpen] = useState(false)
  const userRef  = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (userRef.current && !userRef.current.contains(e.target)) setUserOpen(false)
    }
    function handleEscape(e) { if (e.key === 'Escape') setUserOpen(false) }
    
    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleEscape)
    return () => { document.removeEventListener('click', handleClick); document.removeEventListener('keydown', handleEscape) }
  }, [])

  const handleLogout = () => { logout(); window.location.replace('/login') } // Adjust to your login route!
  
  const initials  = user?.name ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'SA'
  const firstName = user?.name?.split(' ')[0] ?? 'System'

  return (
    <header className="platform-navbar">

      <div className="navbar-left">
        <button type="button" className="navbar-toggle-btn" onClick={onToggleSidebar}>
          <i className="fas fa-bars"></i>
        </button>
      </div>

      <div className="navbar-right">
        <span className="navbar-greeting">Hello, {firstName}</span>

        <div className="navbar-user-wrapper" ref={userRef}>
          <div className="navbar-user-avatar"
            onClick={e => { e.stopPropagation(); setUserOpen(o => !o) }}>
            {initials}
          </div>
          <div className={`navbar-dropdown ${userOpen ? 'open' : ''}`}>
            <div className="navbar-dropdown-header">
              <div className="navbar-dropdown-name">{user?.name || 'System Administrator'}</div>
              <div className="navbar-dropdown-role">Platform Admin</div>
              <div className="navbar-dropdown-email">{user?.email}</div>
            </div>
            <div className="navbar-dropdown-menu">
              <button className="navbar-dropdown-item logout" onClick={handleLogout}>
                <i className="fas fa-power-off" /> Logout
              </button>
            </div>
          </div>
        </div>

      </div>
    </header>
  )
}