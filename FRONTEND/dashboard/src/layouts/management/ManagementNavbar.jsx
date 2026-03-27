import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './ManagementNavbar.css'

const API_URL = 'http://localhost:5001/api'

const TYPE_META = {
  payment:     { icon: 'fas fa-money-bill-wave', color: '#22c55e' },
  maintenance: { icon: 'fas fa-wrench',          color: '#f97316' },
  tenant:      { icon: 'fas fa-user-plus',       color: '#3b82f6' },
  general:     { icon: 'fas fa-bell',            color: '#94a3b8' },
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 60)    return 'Just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function ManagementNavbar({ onToggleSidebar }) {
  const { user, logout, authHeaders } = useAuth()
  const navigate = useNavigate()

  // ── User dropdown ─────────────────────────────────────────────────
  const [userOpen, setUserOpen]   = useState(false)
  const userRef                   = useRef(null)

  // ── Notification dropdown ─────────────────────────────────────────
  const [notifOpen, setNotifOpen]             = useState(false)
  const [notifications, setNotifications]     = useState([])
  const notifRef                              = useRef(null)

  const unreadCount = notifications.filter(n => !n.isRead).length

  // LIVE API FETCH
  useEffect(() => {
    async function fetchNotifications() {
      try {
        const res = await fetch(`${API_URL}/notifications`, {
          headers: authHeaders()
        })
        const data = await res.json()
        if (res.ok) {
          setNotifications(data.data || [])
        }
      } catch (err) {
        console.error("Failed to load notifications", err)
      }
    }
    fetchNotifications()
  }, [])

  // Close dropdowns on outside click or Escape
  useEffect(() => {
    function handleClick(e) {
      if (userRef.current  && !userRef.current.contains(e.target))  setUserOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    function handleEscape(e) {
      if (e.key === 'Escape') { setUserOpen(false); setNotifOpen(false) }
    }
    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  async function markAllRead() {
    try {
      await fetch(`${API_URL}/notifications/read-all`, { 
        method: 'PATCH',
        headers: authHeaders() 
      })
      setNotifications(n => n.map(notif => ({ ...notif, isRead: true })))
    } catch (err) {
      console.error(err)
    }
  }

  async function markOneRead(id) {
    // Prevent redundant API calls if it's already read
    const target = notifications.find(n => n.id === id)
    if (target?.isRead) return

    try {
      await fetch(`${API_URL}/notifications/${id}/read`, { 
        method: 'PATCH',
        headers: authHeaders()
      })
      setNotifications(n => n.map(notif => notif.id === id ? { ...notif, isRead: true } : notif))
    } catch (err) {
      console.error(err)
    }
  }

  function openNotifPage() {
    setNotifOpen(false)
    setUserOpen(false)
    navigate('/management/notifications')
  }

  const handleLogout = () => { logout(); navigate('/login') }

  const initials  = user?.name ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'U'
  const firstName = user?.name?.split(' ')[0] ?? 'User'

  return (
    <header className="management-navbar">
      {/* Left — sidebar toggle */}
      <div className="navbar-left">
        <button type="button" className="navbar-toggle-btn" onClick={onToggleSidebar} aria-label="Toggle sidebar">
          <i className="fas fa-bars"></i>
        </button>
      </div>

      {/* Right */}
      <div className="navbar-right">
        <span className="navbar-greeting">Hello, {firstName}</span>

        {/* ── User avatar + dropdown ── */}
        <div className="navbar-user-wrapper" ref={userRef}>
          <div className="navbar-user-avatar" onClick={e => { e.stopPropagation(); setNotifOpen(false); setUserOpen(o => !o) }}>
            {initials}
          </div>

          <div className={`navbar-dropdown ${userOpen ? 'open' : ''}`}>
            <div className="navbar-dropdown-header">
              <div className="navbar-dropdown-name">{user?.name}</div>
              <div className="navbar-dropdown-role">{user?.role}</div>
              <div className="navbar-dropdown-email">{user?.email}</div>
            </div>
            <div className="navbar-dropdown-menu">
              <button className="navbar-dropdown-item" onClick={() => { navigate('/management/profile'); setUserOpen(false) }}>
                <i className="fas fa-user" /> Edit Profile
              </button>
              <button className="navbar-dropdown-item" onClick={openNotifPage}>
                <i className="fas fa-bell" /> Notifications
                {unreadCount > 0 && <span className="navbar-menu-badge">{unreadCount}</span>}
              </button>
              <button className="navbar-dropdown-item logout" onClick={handleLogout}>
                <i className="fas fa-power-off" /> Logout
              </button>
            </div>
          </div>
        </div>

        {/* ── Bell button + notification dropdown ── */}
        <div className="navbar-notif-wrapper" ref={notifRef}>
          <button type="button" className="navbar-icon-btn" aria-label="Notifications" onClick={e => { e.stopPropagation(); setUserOpen(false); setNotifOpen(o => !o) }}>
            <i className="fas fa-bell"></i>
            {unreadCount > 0 && (
              <span className="navbar-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>

          <div className={`notif-dropdown ${notifOpen ? 'open' : ''}`}>
            <div className="notif-dropdown-header">
              <span className="notif-dropdown-title">Notifications</span>
              <div className="notif-header-actions">
                {unreadCount > 0 && (
                  <button className="notif-mark-all" onClick={markAllRead}>
                    Mark all as read
                  </button>
                )}
                <button className="notif-close-btn" onClick={() => setNotifOpen(false)}>
                  <i className="fas fa-times" />
                </button>
              </div>
            </div>

            <div className="notif-list">
              {notifications.length === 0 && (
                <div className="notif-empty">
                  <i className="fas fa-bell-slash notif-empty-icon" />
                  <p>No notifications yet</p>
                </div>
              )}
              {notifications.slice(0, 5).map(notif => {
                const meta = TYPE_META[notif.type] || TYPE_META.general
                return (
                  <div key={notif.id} className={`notif-item ${notif.isRead ? 'read' : 'unread'}`} onClick={() => markOneRead(notif.id)}>
                    <div className="notif-icon-wrap" style={{ background: meta.color + '18' }}>
                      <i className={meta.icon} style={{ color: meta.color }} />
                    </div>
                    <div className="notif-content">
                      <div className="notif-title-row">
                        <p className="notif-title">{notif.title}</p>
                        <span className="notif-time">{timeAgo(notif.createdAt)}</span>
                      </div>
                      <p className="notif-message">{notif.message}</p>
                    </div>
                    {!notif.isRead && <span className="notif-dot" />}
                  </div>
                )
              })}
            </div>

            <div className="notif-footer">
              <button className="notif-view-all" onClick={openNotifPage}>
                View All Notifications
              </button>
            </div>

          </div>
        </div>

      </div>
    </header>
  )
}