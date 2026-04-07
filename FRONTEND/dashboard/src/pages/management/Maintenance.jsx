import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { can } from '../../utils/permissions'
import Toast from '../../components/Toast'
import ConfirmDialog from '../../components/ConfirmDialog'
import './Maintenance.css'

const API_URL = 'import.meta.env.VITE_API_URL'
const EMPTY_FILTERS = { propertyId: '', status: '', priority: '', category: '' }
const PRIORITIES    = ['Low', 'Medium', 'High', 'Urgent']
const STATUSES      = ['Open', 'In Progress', 'Completed']
const CATEGORIES    = ['Plumbing', 'Electrical', 'HVAC', 'General', 'Painting', 'Pest Control', 'Security']

// Mapped directly to your Database ENUM values
const STATUS_MAP = {
  'open':        { label: 'Open',        class: 'open' },
  'in_progress': { label: 'In Progress', class: 'in-progress' },
  'completed':   { label: 'Completed',   class: 'completed' },
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Maintenance() {
  const { user, authHeaders } = useAuth()
  const navigate = useNavigate()
  
  const [requests, setRequests]           = useState([])
  const [properties, setProperties]       = useState([])
  const [loading, setLoading]             = useState(true)
  const [pageError, setPageError]         = useState('')
  
  const [showFilter, setShowFilter]       = useState(false)
  const [filters, setFilters]             = useState(EMPTY_FILTERS)
  const [activeFilters, setActiveFilters] = useState(EMPTY_FILTERS)
  
  // Custom UI State
  const [toasts, setToasts]               = useState([])
  const [confirm, setConfirm]             = useState(null)

  const canUpdate = can(user?.role, 'maintenance', 'update')

  const showToast = useCallback((type, title, message) => {
    const id = Date.now()
    setToasts(t => [...t, { id, type, title, message }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }, [])

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        
        const [maintRes, propsRes] = await Promise.all([
          fetch(`${API_URL}/maintenance`, { headers: authHeaders() }),
          fetch(`${API_URL}/properties`, { headers: authHeaders() })
        ])

        if (!maintRes.ok || !propsRes.ok) throw new Error('Failed to fetch dashboard data')

        const maintData = await maintRes.json()
        const propsData = await propsRes.json()

        setRequests(maintData.data || [])
        setProperties(propsData.data || [])
      } catch (err) {
        setPageError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Client-side filtering logic
  const filtered = requests.filter(r => {
    const statusLabel = STATUS_MAP[r.status]?.label || ''
    const priorityLabel = r.priority ? r.priority.charAt(0).toUpperCase() + r.priority.slice(1) : ''
    
    return (!activeFilters.propertyId || String(r.property_id) === String(activeFilters.propertyId)) &&
           (!activeFilters.status     || statusLabel === activeFilters.status) &&
           (!activeFilters.priority   || priorityLabel === activeFilters.priority) &&
           (!activeFilters.category   || r.category === activeFilters.category)
  })

  function handleFilterChange(e) { setFilters(f => ({ ...f, [e.target.name]: e.target.value })) }
  function applyFilters() { setActiveFilters({ ...filters }) }
  function clearFilters() { setFilters(EMPTY_FILTERS); setActiveFilters(EMPTY_FILTERS) }

  function triggerDelete(id) {
    setConfirm({
      id,
      title: 'Archive Request',
      message: 'Are you sure you want to archive this completed request? It will be removed from this active list.'
    })
  }

  async function executeDelete() {
    if (!confirm) return
    const id = confirm.id
    setConfirm(null)
    
    try {
      const res = await fetch(`${API_URL}/maintenance/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      
      setRequests(reqs => reqs.filter(r => r.id !== id))
      showToast('success', 'Archived', 'Maintenance request archived successfully.')
    } catch (err) {
      showToast('error', 'Action Failed', err.message)
    }
  }

  return (
    <div className="maintenance-page">
      <Toast toasts={toasts} />
      {confirm && <ConfirmDialog title={confirm.title} message={confirm.message} onConfirm={executeDelete} onCancel={() => setConfirm(null)} />}

      <div className="page-header">
        <h2 className="page-title">Maintenance Requests</h2>
        <button className="btn-filter" onClick={() => setShowFilter(s => !s)}>
          <i className="fas fa-filter" /> Filter
        </button>
      </div>

      {pageError && (
        <div style={{ padding: '12px 20px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', marginBottom: '20px', color: '#991b1b' }}>
          ⚠️ {pageError}
        </div>
      )}

      {showFilter && (
        <div className="filter-panel">
          <div className="filter-group">
            <label className="filter-label">Property</label>
            <select className="filter-select" name="propertyId" value={filters.propertyId} onChange={handleFilterChange}>
              <option value="">All Properties</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Category</label>
            <select className="filter-select" name="category" value={filters.category} onChange={handleFilterChange}>
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Status</label>
            <select className="filter-select" name="status" value={filters.status} onChange={handleFilterChange}>
              <option value="">All Status</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Priority</label>
            <select className="filter-select" name="priority" value={filters.priority} onChange={handleFilterChange}>
              <option value="">All Priorities</option>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="filter-actions">
            <button className="btn-clear" onClick={clearFilters}>Clear</button>
            <button className="btn-apply" onClick={applyFilters}>Apply</button>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="maintenance-table">
          <thead>
            <tr>
              <th>TENANT NAME</th>
              <th>PROPERTY</th>
              <th>CATEGORY</th>
              <th>PRIORITY</th>
              <th>STATUS</th>
              <th>DATE SUBMITTED</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="table-empty">Loading requests...</td></tr>}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} className="table-empty">No maintenance requests found.</td></tr>
            )}
            
            {!loading && filtered.map(req => {
              const statusMeta = STATUS_MAP[req.status] || STATUS_MAP['open']
              return (
                <tr 
                  key={req.id} 
                  className="request-row" 
                  onClick={() => navigate('/management/maintenance/maintenancedetail', { state: { id: req.id } })}
                >
                  {/* ✅ FIXED: Correctly pulls first and last name from backend */}
                  <td className="tenant-name">{req.tenant_first_name} {req.tenant_last_name}</td>
                  
                  <td className="property-cell">
                    <span className="property-name">{req.property_name || req.propertyName}</span>
                    <span className="unit-subtext">{req.unit_number || req.unitId}</span>
                  </td>
                  <td><span className="category-badge">{req.category}</span></td>
                  <td><span className={`priority-badge ${req.priority?.toLowerCase()}`}>{req.priority}</span></td>
                  <td><span className={`status-badge ${statusMeta.class}`}>{statusMeta.label}</span></td>
                  <td className="date-submitted">{formatDate(req.created_at)}</td>
                  
                  <td className="actions-td" onClick={e => e.stopPropagation()}>
                    <div className="action-icon-group">
                      <button 
                        className="action-icon-btn view" 
                        onClick={() => navigate('/management/maintenance/maintenancedetail', { state: { id: req.id } })} 
                        title="View Details"
                      >
                        <i className="fas fa-eye" />
                      </button>
                      
                      {canUpdate && req.status === 'completed' && (
                        <button 
                          className="action-icon-btn delete" 
                          onClick={() => triggerDelete(req.id)} 
                          title="Archive Completed Request"
                        >
                          <i className="fas fa-trash-alt" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      
    </div>
  )
}