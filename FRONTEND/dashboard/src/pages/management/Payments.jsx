import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../context/AuthContext'
import Toast from '../../components/Toast'
import './Payments.css'

const API_URL = 'import.meta.env.VITE_API_URL'

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

  // ─── Toast System ───
  const [toasts, setToasts] = useState([])
  const showToast = useCallback((type, title, message) => {
    const id = Date.now()
    setToasts(t => [...t, { id, type, title, message }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }, [])

  // ─── Generate & Reverse State ───
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [showReverseModal, setShowReverseModal]   = useState(false)
  const [genForm, setGenForm]                     = useState({ dueDate: '' })
  const [reversePeriod, setReversePeriod]         = useState('')
  const [isGenerating, setIsGenerating]           = useState(false)
  const [isReversing, setIsReversing]             = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setLoading(true)
      setPageError('')

      const [paymentsRes, propsRes] = await Promise.all([
        fetch(`${API_URL}/payments`, { headers: authHeaders() }),
        fetch(`${API_URL}/properties`, { headers: authHeaders() })
      ])

      if (!paymentsRes.ok || !propsRes.ok) throw new Error('Failed to load data from server')

      const paymentsData = await paymentsRes.json()
      const propsData = await propsRes.json()

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
      setPageError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (showGenerateModal || showReverseModal) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = 'unset'
    return () => { document.body.style.overflow = 'unset' }
  }, [showGenerateModal, showReverseModal])

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

  // ✅ GENERATE RENT
  async function handleGenerateRent() {
    if (!genForm.dueDate) {
      return showToast('error', 'Missing Field', 'Please select a due date.')
    }
    
    setIsGenerating(true)
    
    try {
      const dateObj = new Date(genForm.dueDate);
      const month = dateObj.toLocaleString('en-US', { month: 'long' }); 
      const year = dateObj.getFullYear(); 
      const autoPeriodName = `${month} ${year}`; 

      const res = await fetch(`${API_URL}/payments/generate-rent`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ periodName: autoPeriodName, dueDate: genForm.dueDate })
      })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.message || 'Failed to generate rent invoices')

      showToast('success', 'Rent Generated', `${data.count} invoices created for ${autoPeriodName}.`)
      setShowGenerateModal(false)
      setGenForm({ dueDate: '' })
    } catch (error) {
      showToast('error', 'Generation Failed', error.message)
    } finally {
      setIsGenerating(false)
    }
  }

  // ✅ REVERSE (UNDO) RENT (WITH AUTO-DERIVED MONTH PICKER)
  async function handleReverseRent() {
    if (!reversePeriod) {
      return showToast('error', 'Missing Field', 'Please select a month to reverse.')
    }

    setIsReversing(true)
    try {
      // Convert "YYYY-MM" (e.g., "2026-11") to "Month YYYY" (e.g., "November 2026")
      const [year, monthNum] = reversePeriod.split('-');
      const dateObj = new Date(year, parseInt(monthNum) - 1);
      const formattedPeriodName = `${dateObj.toLocaleString('en-US', { month: 'long' })} ${year}`;

      const res = await fetch(`${API_URL}/payments/reverse-rent`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ periodName: formattedPeriodName })
      })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.message || 'Failed to reverse rent invoices')

      showToast('success', 'Rent Reversed', `Successfully removed ${data.count} unpaid invoices for ${formattedPeriodName}.`)
      setShowReverseModal(false)
      setReversePeriod('')
    } catch (error) {
      showToast('error', 'Reversal Failed', error.message)
    } finally {
      setIsReversing(false)
    }
  }

  const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(10,22,40,0.6)', zIndex: 9999, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }
  const wrapperStyle = { display: 'flex', alignItems: 'flex-start', justifyContent: 'center', minHeight: '100%', padding: '3rem 1rem', boxSizing: 'border-box' }
  const contentStyle = { position: 'relative', background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '520px', margin: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }
  
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="payments-page">
      <Toast toasts={toasts} />

      <div className="page-header">
        <h2 className="page-title">Payments</h2>
        <div className="header-right" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="btn-primary" onClick={() => setShowGenerateModal(true)}>
            <i className="fas fa-file-invoice-dollar" /> Generate Rent
          </button>
          
          <button 
            style={{ padding: '0.625rem 1.125rem', borderRadius: '10px', background: 'transparent', border: '1.5px solid #fca5a5', color: '#ef4444', fontFamily: "'DM Sans', sans-serif", fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem' }} 
            onClick={() => setShowReverseModal(true)}
            onMouseOver={(e) => { e.target.style.background = '#fef2f2' }}
            onMouseOut={(e) => { e.target.style.background = 'transparent' }}
          >
            <i className="fas fa-undo" /> Undo Rent
          </button>

          <div className="status-tabs" style={{ marginLeft: '1rem' }}>
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
                  <span>This will automatically create a rent invoice for <strong>every active tenant</strong> based on their monthly rent. The invoice period will be generated automatically based on your selected due date.</span>
                </div>

                <div className="form-group">
                  <label className="filter-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Select Due Date <span style={{color: '#f87171'}}>*</span></label>
                  <input 
                    type="date" 
                    className="filter-input" 
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    min={today}
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

      {/* ✅ REVERSE RENT MODAL (UPDATED) */}
      {showReverseModal && createPortal(
        <div style={overlayStyle} onClick={() => !isReversing && setShowReverseModal(false)}>
          <div style={wrapperStyle}>
            <div style={contentStyle} onClick={e => e.stopPropagation()}>
              
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'1.5rem 2rem', borderBottom:'1.5px solid #f1f5f9'}}>
                <h3 className="page-title" style={{ fontSize: '1.5rem', margin: 0, color: '#e11d48' }}>Reverse Invoices</h3>
                <button onClick={() => setShowReverseModal(false)} disabled={isReversing} style={{width:'34px',height:'34px',borderRadius:'50%',border:'1.5px solid #e2e8f0',background:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.875rem',flexShrink:0}}>
                  <i className="fas fa-times" />
                </button>
              </div>

              <div style={{ padding: '1.5rem 2rem' }}>
                <div className="info-banner" style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: '#e11d48', borderRadius: '8px', fontSize: '0.938rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <i className="fas fa-exclamation-triangle" style={{ marginTop: '0.2rem' }}></i>
                  <span>This will permanently delete all <strong>UNPAID</strong> invoices matching the exact period you select below. Paid invoices cannot be reversed.</span>
                </div>
                
                <div className="form-group">
                  <label className="filter-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Select Month to Reverse <span style={{color: '#f87171'}}>*</span></label>
                  {/* ✅ THE MONTH PICKER: Outputs YYYY-MM */}
                  <input 
                    type="month" 
                    className="filter-input" 
                    style={{ width: '100%', boxSizing: 'border-box', cursor: 'pointer' }}
                    value={reversePeriod} 
                    onChange={e => setReversePeriod(e.target.value)} 
                  />
                </div>
              </div>

              <div style={{ padding: '1rem 2rem 1.75rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end', borderTop: '1.5px solid #f1f5f9' }}>
                <button className="btn-clear" onClick={() => setShowReverseModal(false)}>Cancel</button>
                <button className="btn-primary" style={{ background: '#e11d48' }} onClick={handleReverseRent} disabled={isReversing}>
                  {isReversing ? 'Reversing...' : 'Confirm Reversal'}
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