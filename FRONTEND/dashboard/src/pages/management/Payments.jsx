import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../context/AuthContext'
import './Payments.css'

const API_URL = 'http://localhost:5001/api'

const EMPTY_FILTERS = { propertyId: '', status: '', from: '', to: '' }
const TYPE_LABELS = { rent: 'Rent', deposit: 'Deposit', movein: 'Move-in' }

function getCurrentMonthLabel() {
  return new Date().toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })
}

function computeStats(payments) {
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear  = now.getFullYear()
  const totalCollected = payments
    .filter(p => p.status === 'confirmed')
    .reduce((sum, p) => sum + Number(p.amount), 0)
  const thisMonth = payments
    .filter(p => {
      if (p.status !== 'confirmed') return false
      const d = new Date(p.date)
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear
    })
    .reduce((sum, p) => sum + Number(p.amount), 0)
  return { totalCollected, thisMonth }
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Payments() {
  // ✅ Extract authHeaders to authenticate API calls
  const { user, authHeaders } = useAuth()
  
  const [payments, setPayments]           = useState([])
  const [properties, setProperties]       = useState([])
  const [loading, setLoading]             = useState(true)
  const [pageError, setPageError]         = useState('')
  const [showFilter, setShowFilter]       = useState(false)
  const [filters, setFilters]             = useState(EMPTY_FILTERS)
  const [activeFilters, setActiveFilters] = useState(EMPTY_FILTERS)
  const [tabStatus, setTabStatus]         = useState('all')
  const [drawerPayment, setDrawerPayment] = useState(null)

  // ─── Generate Rent State ───
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [genForm, setGenForm] = useState({ periodName: '', dueDate: '' })
  const [isGenerating, setIsGenerating] = useState(false)

  // ✅ Fetch live data from Database
  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setLoading(true)
      setPageError('')

      // Fetch both Payments and Properties concurrently
      const [paymentsRes, propsRes] = await Promise.all([
        fetch(`${API_URL}/payments`, { headers: authHeaders() }),
        fetch(`${API_URL}/properties`, { headers: authHeaders() })
      ])

      if (!paymentsRes.ok || !propsRes.ok) {
        throw new Error('Failed to load data from server')
      }

      const paymentsData = await paymentsRes.json()
      const propsData = await propsRes.json()

      // ✅ Map backend snake_case to frontend camelCase
      const formattedPayments = (paymentsData.data || paymentsData).map(p => ({
        id: p.id,
        tenantName: p.tenant_name,
        propertyName: p.property_name,
        propertyId: p.property_id,
        unitId: p.unit_id,
        amount: p.amount,
        paymentType: p.payment_type,
        mpesaRef: p.mpesa_ref,
        date: p.payment_date,
        status: p.status
      }))

      setPayments(formattedPayments)
      setProperties(propsData.data || propsData)
    } catch (err) {
      console.error('Fetch error:', err)
      setPageError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Lock body scroll safely when modal opens
  useEffect(() => {
    if (showGenerateModal) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = 'unset'
    return () => { document.body.style.overflow = 'unset' }
  }, [showGenerateModal])

  // Client-side filtering
  const filtered = payments.filter(p => {
    const matchTab      = tabStatus === 'all' || p.status === tabStatus
    const matchProperty = !activeFilters.propertyId || String(p.propertyId) === String(activeFilters.propertyId)
    const matchStatus   = !activeFilters.status     || p.status === activeFilters.status
    const matchFrom     = !activeFilters.from       || p.date >= activeFilters.from
    const matchTo       = !activeFilters.to         || p.date <= activeFilters.to
    return matchTab && matchProperty && matchStatus && matchFrom && matchTo
  })

  function handleFilterChange(e) { setFilters(f => ({ ...f, [e.target.name]: e.target.value })) }
  function applyFilters() { setActiveFilters({ ...filters }) }
  function clearFilters() { setFilters(EMPTY_FILTERS); setActiveFilters(EMPTY_FILTERS) }

  // ✅ Generate real rent invoices via backend POST
  async function handleGenerateRent() {
    if (!genForm.periodName || !genForm.dueDate) {
      return alert("Please fill in all fields")
    }
    
    setIsGenerating(true)
    
    try {
      const res = await fetch(`${API_URL}/payments/generate-rent`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          periodName: genForm.periodName,
          dueDate: genForm.dueDate
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to generate rent invoices')
      }

      alert(`Success! ${data.count} rent invoices generated for ${genForm.periodName}.`)
      setShowGenerateModal(false)
      setGenForm({ periodName: '', dueDate: '' })
      
    } catch (error) {
      console.error('Error generating rent:', error)
      alert(error.message)
    } finally {
      setIsGenerating(false)
    }
  }

  // Exact styles matched from TenantMaintenance.jsx
  const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(10,22,40,0.6)', zIndex: 9999, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }
  const wrapperStyle = { display: 'flex', alignItems: 'flex-start', justifyContent: 'center', minHeight: '100%', padding: '3rem 1rem', boxSizing: 'border-box' }
  const contentStyle = { position: 'relative', background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '520px', margin: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }

  return (
    <div className="payments-page">

      <div className="page-header">
        <h2 className="page-title">Payments</h2>
        <div className="header-right">
          <button className="btn-primary" onClick={() => setShowGenerateModal(true)}>
            <i className="fas fa-file-invoice-dollar" /> Generate Rent
          </button>
          <div className="status-tabs">
            {['all', 'confirmed', 'failed'].map(tab => (
              <button key={tab} className={`status-tab${tabStatus === tab ? ' active' : ''}`} onClick={() => setTabStatus(tab)}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn-filter" onClick={() => setShowFilter(s => !s)}>
            <i className="fas fa-filter" /> Filter
          </button>
        </div>
      </div>

      {pageError && (
        <div style={{ padding: '12px 20px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', marginBottom: '20px', color: '#991b1b' }}>
          ⚠️ {pageError}
        </div>
      )}

      {(() => {
        const { totalCollected, thisMonth } = computeStats(payments)
        return (
          <div className="payments-stats">
            <div className="stat-card">
              <div className="stat-label">TOTAL COLLECTED</div>
              <div className="stat-value">Ksh {totalCollected.toLocaleString()}</div>
              <div className="stat-sub">All time</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">THIS MONTH</div>
              <div className="stat-value">Ksh {thisMonth.toLocaleString()}</div>
              <div className="stat-sub">{getCurrentMonthLabel()}</div>
            </div>
          </div>
        )
      })()}

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
            <label className="filter-label">Status</label>
            <select className="filter-select" name="status" value={filters.status} onChange={handleFilterChange}>
              <option value="">All Status</option>
              <option value="confirmed">Confirmed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">From Date</label>
            <input className="filter-input" type="date" name="from" value={filters.from} onChange={handleFilterChange} />
          </div>
          <div className="filter-group">
            <label className="filter-label">To Date</label>
            <input className="filter-input" type="date" name="to" value={filters.to} onChange={handleFilterChange} />
          </div>
          <div className="filter-actions">
            <button className="btn-clear" onClick={clearFilters}>Clear</button>
            <button className="btn-apply" onClick={applyFilters}>Apply</button>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="payments-table">
          <thead>
            <tr>
              <th>TENANT NAME</th>
              <th>PROPERTY</th>
              <th>AMOUNT</th>
              <th>TYPE</th>
              <th>M-PESA REF</th>
              <th>DATE</th>
              <th>STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="8" className="table-empty">Loading payments...</td></tr>}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan="8" className="table-empty">No payments found.</td></tr>
            )}
            {filtered.map(payment => (
              <tr key={payment.id} className={payment.status === 'failed' ? 'row-failed' : ''}>
                <td className="tenant-name">{payment.tenantName}</td>
                <td className="property-cell">
                  <span className="property-name">{payment.propertyName}</span>
                  <span className="property-unit">Unit {payment.unitId}</span>
                </td>
                <td className="amount">Ksh {Number(payment.amount).toLocaleString()}</td>
                <td><span className={`type-badge type-${payment.paymentType}`}>{TYPE_LABELS[payment.paymentType] || payment.paymentType}</span></td>
                <td>{payment.mpesaRef ? <span className="mpesa-ref">{payment.mpesaRef}</span> : <span className="mpesa-none">—</span>}</td>
                <td className="payment-date">{formatDate(payment.date)}</td>
                <td>
                  <span className={`status-badge ${payment.status}`}>
                    <span className="status-dot" />
                    {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                  </span>
                </td>
                <td>
                  <button className="btn-view" onClick={() => setDrawerPayment(payment)} title="View details">
                    <i className="fas fa-eye" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ✅ GENERATE RENT MODAL */}
      {showGenerateModal && createPortal(
        <div style={overlayStyle} onClick={() => !isGenerating && setShowGenerateModal(false)}>
          <div style={wrapperStyle}>
            <div style={contentStyle} onClick={e => e.stopPropagation()}>
              
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'1.5rem 2rem', borderBottom:'1.5px solid #f1f5f9'}}>
                <h3 className="page-title" style={{ fontSize: '1.5rem', margin: 0 }}>
                  Generate Rent Invoices
                </h3>
                <button 
                  onClick={() => setShowGenerateModal(false)} 
                  disabled={isGenerating}
                  style={{width:'34px',height:'34px',borderRadius:'50%',border:'1.5px solid #e2e8f0',background:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.875rem',flexShrink:0}}
                >
                  <i className="fas fa-times" />
                </button>
              </div>

              <div style={{ padding: '1.5rem 2rem' }}>
                <div className="info-banner" style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(59,130,246,0.1)', color: 'var(--blue-600)', borderRadius: '8px', fontSize: '0.938rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <i className="fas fa-info-circle" style={{ marginTop: '0.2rem' }}></i>
                  <span>This will automatically create a rent invoice for <strong>every active tenant</strong> based on their monthly rent.</span>
                </div>
                
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="filter-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Period Name <span style={{color: '#f87171'}}>*</span></label>
                  <input 
                    type="text" 
                    className="filter-input" 
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="e.g., April 2026" 
                    value={genForm.periodName} 
                    onChange={e => setGenForm(f => ({ ...f, periodName: e.target.value }))} 
                  />
                </div>

                <div className="form-group">
                  <label className="filter-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Due Date <span style={{color: '#f87171'}}>*</span></label>
                  <input 
                    type="date" 
                    className="filter-input" 
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={genForm.dueDate} 
                    onChange={e => setGenForm(f => ({ ...f, dueDate: e.target.value }))} 
                  />
                </div>
              </div>

              <div style={{ padding: '1rem 2rem 1.75rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end', borderTop: '1.5px solid #f1f5f9' }}>
                <button className="btn-clear" onClick={() => setShowGenerateModal(false)}>Cancel</button>
                <button className="btn-primary" onClick={handleGenerateRent} disabled={isGenerating}>
                  {isGenerating ? 'Generating...' : 'Confirm & Generate'}
                </button>
              </div>

            </div>
          </div>
        </div>
      , document.body)}

      {/* Detail Drawer */}
      {drawerPayment && (
        <div className="drawer-overlay" onClick={() => setDrawerPayment(null)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <span className="drawer-title">Payment details</span>
              <button className="drawer-close" onClick={() => setDrawerPayment(null)}>✕</button>
            </div>
            <div className="drawer-body">
              <div className="drawer-section">
                <div className="drawer-section-label">Transaction</div>
                <div className="drawer-row">
                  <span>Amount</span>
                  <strong className="drawer-amount">Ksh {Number(drawerPayment.amount).toLocaleString()}</strong>
                </div>
                <div className="drawer-row">
                  <span>Type</span>
                  <span className={`type-badge type-${drawerPayment.paymentType}`}>{TYPE_LABELS[drawerPayment.paymentType]}</span>
                </div>
                <div className="drawer-row">
                  <span>Date</span>
                  <span>{formatDate(drawerPayment.date)}</span>
                </div>
                <div className="drawer-row">
                  <span>Status</span>
                  <span className={`status-badge ${drawerPayment.status}`}>
                    <span className="status-dot" />
                    {drawerPayment.status.charAt(0).toUpperCase() + drawerPayment.status.slice(1)}
                  </span>
                </div>
                <div className="drawer-row">
                  <span>M-Pesa ref</span>
                  {drawerPayment.mpesaRef ? <span className="mpesa-ref">{drawerPayment.mpesaRef}</span> : <span className="mpesa-none">—</span>}
                </div>
              </div>
              <div className="drawer-section">
                <div className="drawer-section-label">Tenant</div>
                <div className="drawer-row"><span>Name</span><strong>{drawerPayment.tenantName}</strong></div>
                <div className="drawer-row"><span>Property</span><span>{drawerPayment.propertyName}</span></div>
                <div className="drawer-row"><span>Unit</span><span>{drawerPayment.unitId}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}