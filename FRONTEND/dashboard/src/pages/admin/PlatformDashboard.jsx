import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import Toast from '../../components/Toast'
import ConfirmDialog from '../../components/ConfirmDialog'
import './PlatformDashboard.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

//  Helper to format timestamps dynamically
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function PlatformDashboard() {
  const { authHeaders } = useAuth()
  const [stats, setStats] = useState({ total_landlords: 0, total_properties: 0, total_tenants: 0 })
  const [landlords, setLandlords] = useState([])
  const [logs, setLogs] = useState([]) //  NEW: Logs state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // UI States
  const [activeTab, setActiveTab] = useState('landlords')
  const [searchQuery, setSearchQuery] = useState('')
  const [toasts, setToasts] = useState([])
  const [confirm, setConfirm] = useState(null)

  const showToast = useCallback((type, title, message) => {
    const id = Date.now()
    setToasts(t => [...t, { id, type, title, message }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }, [])

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    try {
      setLoading(true)
      const res = await fetch(`${API_URL}/admin/dashboard`, { headers: authHeaders() })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.message)
      
      setStats(data.data.stats)
      setLandlords(data.data.landlords)
      setLogs(data.data.logs || []) //  Save dynamic logs to state
    } catch (err) {
      setError(err.message || 'Failed to load platform data')
    } finally {
      setLoading(false)
    }
  }

  const filteredLandlords = landlords.filter(l => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const fullName = `${l.first_name} ${l.last_name}`.toLowerCase();
    return fullName.includes(q) || l.email.toLowerCase().includes(q) || l.phone.includes(q);
  });

  // Get the 5 most recent signups dynamically
  const recentSignups = [...landlords].slice(0, 5);

  function handleToggleClick(id, currentStatus, name) {
    setConfirm({
      id,
      currentStatus,
      title: currentStatus ? 'Suspend Account' : 'Activate Account',
      message: `Are you sure you want to ${currentStatus ? 'suspend' : 'activate'} ${name}'s account? They ${currentStatus ? 'will lose' : 'will regain'} access to the platform immediately.`,
      confirmText: currentStatus ? 'Suspend' : 'Activate',
      type: currentStatus ? 'danger' : 'success'
    });
  }

  async function executeToggle() {
    if (!confirm) return;
    const { id, currentStatus } = confirm;
    
    try {
      const res = await fetch(`${API_URL}/admin/landlords/${id}/toggle`, {
        method: 'PATCH',
        headers: authHeaders()
      })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.message)
      
      setLandlords(prev => prev.map(l => l.id === id ? { ...l, is_active: data.is_active } : l))
      showToast('success', 'Status Updated', `The landlord account has been ${data.is_active ? 'activated' : 'suspended'}.`)
      
    } catch (err) {
      showToast('error', 'Update Failed', err.message)
    } finally {
      setConfirm(null);
    }
  }

  return (
    <div className="platform-dashboard">
      <Toast toasts={toasts} />
      
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmText={confirm.confirmText}
          type={confirm.type}
          onConfirm={executeToggle}
          onCancel={() => setConfirm(null)}
        />
      )}

      <div className="platform-header">
        <div>
          <h2 className="platform-title">Platform Administration</h2>
          <p className="platform-sub">Rentlee Global Overview & Landlord Management</p>
        </div>
      </div>

      {error && <div className="platform-error"> {error}</div>}

      {/* Global Stats Cards */}
      <div className="platform-summary">
        <div className="summary-card">
          <div className="summary-icon blue"><i className="fas fa-user-tie" /></div>
          <div>
            <div className="summary-label">Registered Landlords</div>
            <div className="summary-value">{stats.total_landlords}</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon amber"><i className="fas fa-building" /></div>
          <div>
            <div className="summary-label">Total Properties</div>
            <div className="summary-value">{stats.total_properties}</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon emerald"><i className="fas fa-users" /></div>
          <div>
            <div className="summary-label">Active Tenants</div>
            <div className="summary-value">{stats.total_tenants}</div>
          </div>
        </div>
      </div>

      {/* ── Tabs Navigation ── */}
      <div className="platform-tabs">
        <button 
          className={`platform-tab ${activeTab === 'landlords' ? 'active' : ''}`}
          onClick={() => setActiveTab('landlords')}
        >
          <i className="fas fa-users" /> Landlord Accounts
        </button>
        <button 
          className={`platform-tab ${activeTab === 'signups' ? 'active' : ''}`}
          onClick={() => setActiveTab('signups')}
        >
          <i className="fas fa-user-plus" /> Recent Sign-ups
        </button>
        <button 
          className={`platform-tab ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          <i className="fas fa-shield-alt" /> System Audit Logs
        </button>
      </div>

      {/* ── Tab Content Area ── */}
      <div className="platform-tab-content">

        {/* TAB 1: Landlord Accounts */}
        {activeTab === 'landlords' && (
          <div className="platform-table-card fade-in">
            <div className="table-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Landlord Accounts</h3>
              
              <div style={{ position: 'relative' }}>
                <i className="fas fa-search" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}></i>
                <input 
                  type="text" 
                  placeholder="Search name, email, or phone..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    padding: '0.6rem 1rem 0.6rem 2.25rem',
                    borderRadius: '8px',
                    border: '1.5px solid var(--slate-200)',
                    outline: 'none',
                    width: '280px',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.875rem'
                  }}
                />
              </div>
            </div>
            
            {loading ? (
              <div className="platform-empty"><i className="fas fa-circle-notch fa-spin" /><p>Loading system data...</p></div>
            ) : filteredLandlords.length === 0 ? (
              <div className="platform-empty">
                <i className="fas fa-search" style={{ fontSize: '2rem', color: 'var(--slate-300)', marginBottom: '1rem' }}></i>
                <p>{searchQuery ? 'No landlords matched your search.' : 'No landlords registered yet.'}</p>
              </div>
            ) : (
              <table className="platform-table">
                <thead>
                  <tr>
                    <th>Landlord</th>
                    <th>Contact Info</th>
                    <th>Properties</th>
                    <th>Tenants</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLandlords.map(l => (
                    <tr key={l.id}>
                      <td>
                        <div className="user-name">{l.first_name} {l.last_name}</div>
                        <div className="user-date">Joined {new Date(l.created_at).toLocaleDateString()}</div>
                      </td>
                      <td>
                        <div className="user-email">{l.email}</div>
                        <div className="user-phone">{l.phone}</div>
                      </td>
                      <td className="metric-cell">{l.property_count}</td>
                      <td className="metric-cell">{l.tenant_count}</td>
                      <td>
                        <span className={`status-badge ${l.is_active ? 'active' : 'suspended'}`}>
                          {l.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td>
                        <button 
                          className={`btn-action ${l.is_active ? 'btn-suspend' : 'btn-activate'}`}
                          onClick={() => handleToggleClick(l.id, l.is_active, l.first_name)}
                        >
                          {l.is_active ? <><i className="fas fa-ban" /> Suspend</> : <><i className="fas fa-check" /> Activate</>}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 2: Recent Sign-ups */}
        {activeTab === 'signups' && (
          <div className="audit-card fade-in">
            <div className="audit-header">
              <h3><i className="fas fa-user-plus" style={{ color: 'var(--blue-500)', marginRight: '0.5rem' }}></i> Recent Sign-ups</h3>
            </div>
            <ul className="audit-list">
              {recentSignups.length === 0 && <li className="audit-item"><span className="audit-text">No sign-ups found.</span></li>}
              {recentSignups.map(user => (
                <li key={`signup-${user.id}`} className="audit-item">
                  <div className="audit-avatar">{user.first_name.charAt(0)}{user.last_name.charAt(0)}</div>
                  <div className="audit-content">
                    <div className="audit-title">{user.first_name} {user.last_name}</div>
                    <div className="audit-text">{user.email}</div>
                  </div>
                  <div className="audit-time">{new Date(user.created_at).toLocaleDateString()}</div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* TAB 3: System Audit Logs (NOW 100% REAL DATA) */}
        {activeTab === 'logs' && (
          <div className="audit-card fade-in">
            <div className="audit-header">
              <h3><i className="fas fa-shield-alt" style={{ color: 'var(--rose-500)', marginRight: '0.5rem' }}></i> System Audit Logs</h3>
            </div>
            <ul className="audit-list">
              {logs.length === 0 && <li className="audit-item"><span className="audit-text">No system logs available.</span></li>}
              
              {logs.map((log, i) => {
                // Dynamically assign icons and colors based on event type
                let icon = 'fas fa-info-circle';
                let color = '#64748b'; // default slate
                
                if (log.type === 'user') { icon = 'fas fa-user-check'; color = '#3b82f6'; } // blue
                if (log.type === 'property') { icon = 'fas fa-building'; color = '#10b981'; } // emerald
                if (log.type === 'payment') { icon = 'fas fa-money-bill-wave'; color = '#f59e0b'; } // amber

                return (
                  <li key={i} className="audit-item">
                    <div className="audit-icon-wrap" style={{ background: `${color}15`, color: color }}>
                      <i className={icon}></i>
                    </div>
                    <div className="audit-content">
                      <div className="audit-title" style={{ fontSize: '0.9rem' }}>{log.text}</div>
                    </div>
                    <div className="audit-time">{timeAgo(log.created_at)}</div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

      </div>
    </div>
  )
}