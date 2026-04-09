import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { can } from '../../utils/permissions'
import './MaintenanceDetail.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

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

export default function MaintenanceDetail() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, authHeaders } = useAuth()
  
  const [request, setRequest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')

  const canUpdate = can(user?.role, 'maintenance', 'update')

  // Safely grab the ID from state
  const requestId = location.state?.id

  useEffect(() => {
    if (!requestId) {
      setPageError("No request ID found. Please go back to the list.")
      setLoading(false)
      return
    }

    async function fetchDetail() {
      try {
        const res = await fetch(`${API_URL}/maintenance/${requestId}`, {
          headers: authHeaders()
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message)
        
        setRequest(data.data)
      } catch (err) {
        setPageError(err.message)
      } finally {
        setLoading(false)
      }
    }
    
    fetchDetail()
  }, [requestId])

  async function updateStatus(newDbStatus) {
    try {
      const res = await fetch(`${API_URL}/maintenance/${requestId}/status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: newDbStatus })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)

      setRequest(prev => ({ ...prev, status: newDbStatus }))
    } catch (err) {
      alert(`Status update failed: ${err.message}`)
    }
  }

  if (loading) return <div className="detail-loading"><i className="fas fa-spinner fa-spin"></i> Loading request details...</div>
  if (pageError) return <div className="detail-loading" style={{color: '#ef4444'}}> {pageError}</div>
  if (!request) return <div className="detail-loading">Request not found.</div>

  const statusMeta = STATUS_MAP[request.status] || STATUS_MAP['open']

  return (
    <div className="maintenance-detail-page">
      
      {/* Top Nav */}
      <button className="btn-back" onClick={() => navigate('/management/maintenance')}>
        <i className="fas fa-arrow-left"></i> Back to Requests
      </button>

      {/* Header Area */}
      <div className="detail-header">
        <div className="detail-title-area">
          <h2 className="detail-title">{request.title}</h2>
          <span className={`status-badge ${statusMeta.class}`}>{statusMeta.label}</span>
        </div>
        
        {/* ACTION BUTTONS (Map UI to DB expected values) */}
        {canUpdate && (
          <div className="detail-actions">
            {request.status === 'open' && (
              <button className="detail-action-btn detail-btn-in-progress" onClick={() => updateStatus('in_progress')}>
                Mark In Progress
              </button>
            )}
            {request.status === 'in_progress' && (
              <button className="detail-action-btn detail-btn-complete" onClick={() => updateStatus('completed')}>
                Mark Completed
              </button>
            )}
            {request.status === 'completed' && (
              <span className="completed-text">Completed</span>
            )}
          </div>
        )}
      </div>

      <div className="detail-grid">
        
        {/* Left Column: Context Info */}
        <div className="detail-sidebar">
          <div className="info-card">
            <h3 className="info-card-title">Request Details</h3>
            
            <div className="info-row">
              <span className="info-label">Date Submitted</span>
              <span className="info-value"><i className="fas fa-calendar"></i> {formatDate(request.created_at)}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Category</span>
              <span className="info-value category">{request.category}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Priority</span>
              <span className={`priority-badge ${request.priority?.toLowerCase()}`}>{request.priority}</span>
            </div>
            
            <div className="info-divider"></div>
            
            <h3 className="info-card-title">Location & Tenant</h3>
            <div className="info-row">
              <span className="info-label">Property</span>
              <span className="info-value property">{request.property_name || request.propertyName}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Unit</span>
              <span className="info-value">{request.unit_number || request.unitId}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Tenant</span>
              <span className="info-value tenant">
                <i className="fas fa-user"></i> {request.tenant_first_name} {request.tenant_last_name}
              </span>
            </div>
            {/* Show Phone/Email if available for contact */}
            <div className="info-row">
               <span className="info-label">Contact</span>
               <span className="info-value">{request.tenant_phone}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Full Description */}
        <div className="detail-main">
          <div className="description-card">
            <h3 className="description-title">Issue Description</h3>
            <div className="description-body">
              {request.description}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}