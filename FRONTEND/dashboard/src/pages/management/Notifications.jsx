import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import './Notifications.css'

const API_URL = 'import.meta.env.VITE_API_URL'

const TYPE_META = {
  payment:     { icon: 'fas fa-money-bill-wave', color: '#22c55e',  label: 'Payment'     },
  maintenance: { icon: 'fas fa-wrench',          color: '#f97316',  label: 'Maintenance' },
  tenant:      { icon: 'fas fa-user-plus',       color: '#3b82f6',  label: 'Tenant'      },
  general:     { icon: 'fas fa-bell',            color: '#94a3b8',  label: 'General'     },
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 60)    return 'Just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`
  return new Date(dateStr).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

const FILTER_TABS = [
  { key: 'all',         label: 'All'         },
  { key: 'unread',      label: 'Unread'      },
  { key: 'payment',     label: 'Payments'    },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'tenant',      label: 'Tenants'     },
]

export default function Notifications() {
  const { authHeaders } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading]             = useState(true)
  const [activeTab, setActiveTab]         = useState('all')

  useEffect(() => {
    async function fetchNotifications() {
      try {
        setLoading(true)
        const res = await fetch(`${API_URL}/notifications`, {
          headers: authHeaders()
        })
        const data = await res.json()
        if (res.ok) {
          setNotifications(data.data || [])
        }
      } catch (err) {
        console.error("Failed to load notifications", err)
      } finally {
        setLoading(false)
      }
    }
    fetchNotifications()
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

  async function deleteOne(id) {
    try {
      await fetch(`${API_URL}/notifications/${id}`, { 
        method: 'DELETE',
        headers: authHeaders() 
      })
      setNotifications(n => n.filter(notif => notif.id !== id))
    } catch (err) {
      console.error(err)
    }
  }

  const unreadCount = notifications.filter(n => !n.isRead).length

  const filtered = notifications.filter(n => {
    if (activeTab === 'all')    return true
    if (activeTab === 'unread') return !n.isRead
    return n.type === activeTab
  })

  return (
    <div className="notifications-page">

      {/* Page header */}
      <div className="notif-page-header">
        <div>
          <h2 className="notif-page-title">Notifications</h2>
          {unreadCount > 0 && (
            <p className="notif-page-sub">{unreadCount} unread notification{unreadCount > 1 ? 's' : ''}</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button className="notif-read-all-btn" onClick={markAllRead}>
            <i className="fas fa-check-double" /> Mark all as read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="notif-tabs">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            className={`notif-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {tab.key === 'unread' && unreadCount > 0 && (
              <span className="notif-tab-count">{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      <div className="notif-page-list">
        {loading && <p className="notif-page-empty">Loading notifications...</p>}

        {!loading && filtered.length === 0 && (
          <div className="notif-page-empty-state">
            <i className="fas fa-bell-slash" />
            <p>No notifications here</p>
          </div>
        )}

        {!loading && filtered.map(notif => {
          const meta = TYPE_META[notif.type] || TYPE_META.general
          return (
            <div
              key={notif.id}
              className={`notif-page-item ${notif.isRead ? 'read' : 'unread'}`}
              onClick={() => markOneRead(notif.id)}
            >
              {/* Icon */}
              <div className="notif-page-icon" style={{ background: meta.color + '18' }}>
                <i className={meta.icon} style={{ color: meta.color }} />
              </div>

              {/* Content */}
              <div className="notif-page-content">
                <div className="notif-page-top">
                  <p className="notif-page-item-title">{notif.title}</p>
                  <span className="notif-page-time">{timeAgo(notif.createdAt)}</span>
                </div>
                <p className="notif-page-message">{notif.message}</p>
                <span className="notif-page-type-badge" style={{ background: meta.color + '18', color: meta.color }}>
                  {meta.label}
                </span>
              </div>

              {/* Actions */}
              <div className="notif-page-actions" onClick={e => e.stopPropagation()}>
                {!notif.isRead && (
                  <button className="notif-action-btn read-btn" title="Mark as read" onClick={() => markOneRead(notif.id)}>
                    <i className="fas fa-check" />
                  </button>
                )}
                <button className="notif-action-btn delete-btn" title="Delete" onClick={() => deleteOne(notif.id)}>
                  <i className="fas fa-trash" />
                </button>
              </div>

              {/* Unread dot */}
              {!notif.isRead && <span className="notif-page-dot" />}
            </div>
          )
        })}
      </div>

    </div>
  )
}