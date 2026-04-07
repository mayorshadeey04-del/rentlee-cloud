import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../context/AuthContext'
import Toast from '../../components/Toast'
import ConfirmDialog from '../../components/ConfirmDialog'
import SubmitButton from '../../components/SubmitButton' // ✅ Imported Pro Button
import './TenantMaintenance.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const CATEGORIES = ['Plumbing', 'Electrical', 'HVAC', 'General', 'Painting', 'Pest Control', 'Security']

// Mapped directly to your Database ENUM values
const STATUS_MAP = {
  'open':        { label: 'Open',        class: 'open',        icon: 'fas fa-clock'         },
  'in_progress': { label: 'In Progress', class: 'in-progress', icon: 'fas fa-spinner'       },
  'completed':   { label: 'Completed',   class: 'completed',   icon: 'fas fa-check-circle'  },
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function TenantMaintenance() {
  const { user, authHeaders } = useAuth()
  const [requests, setRequests]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [filter, setFilter]         = useState('All') // UI Filter
  const [pageError, setPageError]   = useState('')
  
  // Custom UI State
  const [toasts, setToasts]               = useState([])
  const [confirm, setConfirm]             = useState(null)
  
  // Modal & Form State
  const [showModal, setShowModal]   = useState(false)
  const [editId, setEditId]         = useState(null) 
  const [form, setForm]             = useState({ title: '', description: '', category: '', priority: 'medium' })
  const [isSubmitting, setIsSubmitting] = useState(false) // ✅ Renamed for consistency

  const showToast = useCallback((type, title, message) => {
    const id = Date.now()
    setToasts(t => [...t, { id, type, title, message }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }, [])

  // ── LIVE API FETCH ──
  const fetchRequests = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_URL}/maintenance/my-requests`, {
        headers: authHeaders()
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      
      setRequests(data.data || [])
    } catch (err) {
      setPageError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  // Lock body scroll safely
  useEffect(() => {
    if (showModal) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = 'unset'
    return () => { document.body.style.overflow = 'unset' }
  }, [showModal])

  // --- HANDLERS ---
  const openNewRequest = () => {
    setEditId(null)
    setForm({ title: '', description: '', category: '', priority: 'medium' })
    setShowModal(true)
  }

  const openEditRequest = (req) => {
    setEditId(req.id)
    setForm({ 
      title: req.title, 
      description: req.description, 
      category: req.category || '', 
      priority: req.priority || 'medium' 
    })
    setShowModal(true)
  }

  const triggerDelete = (id, currentStatus) => {
    const actionText = currentStatus === 'open' ? 'cancel this request' : 'remove this from your dashboard'
    setConfirm({
      id,
      title: currentStatus === 'open' ? 'Cancel Request' : 'Remove Request',
      message: `Are you sure you want to ${actionText}?`
    })
  }

  const executeDelete = async () => {
    if (!confirm) return
    const id = confirm.id
    setConfirm(null)

    try {
      const res = await fetch(`${API_URL}/maintenance/my-requests/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)

      setRequests(prev => prev.filter(r => r.id !== id))
      showToast('success', 'Success', data.message || 'Request removed')
    } catch (err) {
      showToast('error', 'Action Failed', err.message)
    }
  }

  const handleSubmit = async () => {
    if (!form.title || !form.description || !form.category) return
    setIsSubmitting(true) // ✅ Turn spinner ON
    setPageError('')
    
    try {
      const endpoint = editId ? `${API_URL}/maintenance/my-requests/${editId}` : `${API_URL}/maintenance`
      const method = editId ? 'PUT' : 'POST'
      
      const res = await fetch(endpoint, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(form)
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)

      await fetchRequests() // Refresh the list to get full normalized data
      setShowModal(false)
      showToast('success', editId ? 'Request Updated' : 'Request Submitted', 'Your maintenance request has been saved.')
    } catch (err) {
      showToast('error', 'Submission Failed', err.message)
    } finally {
      setIsSubmitting(false) // ✅ Turn spinner OFF
    }
  }

  // Filter relies on mapping DB status to the UI Labels
  const filters  = ['All', 'Open', 'In Progress', 'Completed']
  const filtered = filter === 'All' 
    ? requests 
    : requests.filter(r => STATUS_MAP[r.status]?.label === filter)

  const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(10,22,40,0.6)', zIndex: 9999, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }
  const wrapperStyle = { display: 'flex', alignItems: 'flex-start', justifyContent: 'center', minHeight: '100%', padding: '3rem 1rem', boxSizing: 'border-box' }
  const contentStyle = { position: 'relative', background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '660px', margin: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }

  return (
    <div className="tenant-maintenance">
      <Toast toasts={toasts} />
      {confirm && <ConfirmDialog title={confirm.title} message={confirm.message} onConfirm={executeDelete} onCancel={() => setConfirm(null)} />}

      <div className="maint-header">
        <div>
          <h2 className="maint-title">Maintenance Requests</h2>
          <p className="maint-sub">Submit and track your maintenance requests</p>
        </div>
        <button className="btn-primary" onClick={openNewRequest}>
          <i className="fas fa-plus" /> New Request
        </button>
      </div>

      {pageError && (
        <div style={{ padding: '12px 20px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', marginBottom: '20px', color: '#991b1b' }}>
          ⚠️ {pageError}
        </div>
      )}

      <div className="maint-filter-tabs">
        {filters.map(f => (
          <button key={f} className={`maint-filter-tab ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}>
            {f}
            {f !== 'All' && (
              <span className="maint-tab-count">
                {requests.filter(r => STATUS_MAP[r.status]?.label === f).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="maint-list">
        {loading && <div className="maint-empty"><i className="fas fa-circle-notch fa-spin" /><p>Loading requests...</p></div>}
        
        {!loading && filtered.length === 0 && (
          <div className="maint-empty">
            <i className="fas fa-tools" />
            <p>{filter === 'All' ? 'No maintenance requests yet' : `No ${filter.toLowerCase()} requests`}</p>
            {filter === 'All' && (
              <button className="btn-primary" style={{ marginTop: '0.5rem' }} onClick={openNewRequest}>
                Submit your first request
              </button>
            )}
          </div>
        )}

        {!loading && filtered.map(req => {
          const statusMeta = STATUS_MAP[req.status] || STATUS_MAP['open']
          return (
            <div key={req.id} className="maint-item">
              <div className={`maint-status-icon ${statusMeta.class}`}>
                <i className={statusMeta.icon} />
              </div>
              <div className="maint-item-content">
                <div className="maint-item-top">
                  <p className="maint-item-title">{req.title}</p>
                  <span className={`status-badge ${statusMeta.class}`}>{statusMeta.label}</span>
                </div>
                <p className="maint-item-desc">{req.description}</p>
                
                <div className="maint-item-meta">
                  <div className="maint-meta-left">
                    {req.category && <span className="maint-category"><i className="fas fa-tag" /> {req.category}</span>}
                    {req.priority && <span className="maint-date" style={{textTransform: 'capitalize'}}><i className="fas fa-flag" /> {req.priority}</span>}
                    <span className="maint-date"><i className="fas fa-calendar" /> {formatDate(req.created_at)}</span>
                  </div>
                  
                  <div className="maint-meta-right">
                    {req.status === 'open' && (
                      <button className="maint-action-btn edit" onClick={() => openEditRequest(req)} title="Edit Request">
                        <i className="fas fa-edit"></i>
                      </button>
                    )}
                    
                    {(req.status === 'open' || req.status === 'completed') && (
                      <button className="maint-action-btn delete" onClick={() => triggerDelete(req.id, req.status)} title={req.status === 'open' ? 'Cancel Request' : 'Remove from Dashboard'}>
                        <i className="fas fa-trash-alt"></i>
                      </button>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )
        })}
      </div>

      {showModal && createPortal(
        <div style={overlayStyle} onClick={() => !isSubmitting && setShowModal(false)}>
          <div style={wrapperStyle}>
            <div style={contentStyle} onClick={e => e.stopPropagation()}>
              
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'1.5rem 2rem', borderBottom:'1.5px solid #f1f5f9'}}>
                <h3 className="maint-title" style={{ fontSize: '1.5rem', margin: 0 }}>
                  {editId ? 'Edit Maintenance Request' : 'New Maintenance Request'}
                </h3>
                <button 
                  onClick={() => setShowModal(false)} 
                  disabled={isSubmitting}
                  style={{width:'34px',height:'34px',borderRadius:'50%',border:'1.5px solid #e2e8f0',background:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.875rem',flexShrink:0}}
                >
                  <i className="fas fa-times" />
                </button>
              </div>

              <div style={{ padding: '1.5rem 2rem' }}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Issue Title <span>*</span></label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="e.g., Leaking kitchen sink"
                    value={form.title}
                    disabled={isSubmitting}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Category <span>*</span></label>
                    <select
                      className="form-select"
                      value={form.category}
                      disabled={isSubmitting}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    >
                      <option value="">Select category</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <select
                      className="form-select"
                      value={form.priority}
                      onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                      disabled={!!editId || isSubmitting} // Priority is locked once submitted
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label className="form-label">Description <span>*</span></label>
                  <textarea
                    className="form-textarea"
                    rows={4}
                    placeholder="Describe the issue in detail..."
                    value={form.description}
                    disabled={isSubmitting}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ padding: '1rem 2rem 1.75rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end', borderTop: '1.5px solid #f1f5f9' }}>
                <button className="btn-cancel" onClick={() => setShowModal(false)} disabled={isSubmitting}>Cancel</button>
                {/* ✅ Swapped Button */}
                <SubmitButton 
                  onClick={handleSubmit} 
                  isSubmitting={isSubmitting} 
                  text={editId ? 'Save Changes' : 'Submit Request'} 
                  loadingText="Saving..." 
                  className="btn-submit"
                />
              </div>

            </div>
          </div>
        </div>
      , document.body)}

    </div>
  )
}