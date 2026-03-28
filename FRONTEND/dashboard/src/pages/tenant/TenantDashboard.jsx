import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useAuth } from '../../context/AuthContext'
import './TenantDashboard.css'

const API_URL = 'http://localhost:5001/api'

export default function TenantDashboard() {
  const { user, authHeaders }   = useAuth()
  const navigate   = useNavigate()
  
  const [info, setInfo]           = useState(null)
  const [payments, setPayments]   = useState([])
  const [requests, setRequests]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [pageError, setPageError] = useState('')

  // Payment Modal & STK Push State
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentAmount, setPaymentAmount]       = useState('')
  const [paymentPhone, setPaymentPhone]         = useState('')
  const [isProcessing, setIsProcessing]         = useState(false)
  const [paymentSuccess, setPaymentSuccess]     = useState(false)

  // ── LIVE DATA FETCHING ──
  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_URL}/tenant-dashboard`, {
        headers: authHeaders()
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.message)

      setInfo(data.data.info)
      setPayments(data.data.payments)
      setRequests(data.data.requests)
      
      // Auto-fill phone number if available on user object
      if (user?.phone) {
          const rawPhone = user.phone.replace(/\D/g, '');
          setPaymentPhone(rawPhone.length > 9 ? rawPhone.slice(-9) : rawPhone);
      }
      
    } catch (err) {
      console.error(err)
      setPageError(err.message || 'Failed to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const firstName = user?.first_name || user?.name?.split(' ')[0] || 'Tenant'

  // STRICT VALIDATION: Max 9 Digits for M-Pesa (excluding +254)
  const handlePhoneChange = (e) => {
    const numericValue = e.target.value.replace(/\D/g, '') 
    if (numericValue.length <= 9) {
      setPaymentPhone(numericValue)
    }
  }

  // ── LIVE M-PESA STK PUSH TRIGGER ──
  const handleMpesaPayment = async (e) => {
    e.preventDefault()
    
    if (paymentPhone.length !== 9) {
       alert("Please enter exactly 9 digits for your M-Pesa number.")
       return
    }
    
    setIsProcessing(true)
    const amountToPay = info.requiresMoveInPayment ? info.moveInCharges.total : Number(paymentAmount)

    try {
      const res = await fetch(`${API_URL}/payments/initiate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          phone: `254${paymentPhone}`, // Format to 2547XXXXXXXX
          amount: amountToPay,
          paymentType: info.requiresMoveInPayment ? 'movein' : 'rent'
        })
      })

      const data = await res.json()
      
      if (!res.ok) throw new Error(data.message)

      // The STK Push was successfully triggered on their phone!
      setTimeout(() => {
        setIsProcessing(false)
        setPaymentSuccess(true)
        
        if (info.requiresMoveInPayment) {
          setTimeout(() => {
            setInfo({ ...info, requiresMoveInPayment: false, balance: 0 })
            setPaymentSuccess(false)
          }, 2500)
        } else {
          setTimeout(() => {
            setPaymentSuccess(false)
            setShowPaymentModal(false)
            setInfo({ ...info, balance: info.balance - amountToPay })
            setPaymentAmount('')
          }, 2000)
        }
      }, 3000)

    } catch (err) {
      alert(`Payment failed: ${err.message}`)
      setIsProcessing(false)
    }
  }

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading dashboard...</div>
  if (pageError) return <div style={{ padding: '3rem', textAlign: 'center', color: '#ef4444' }}>{pageError}</div>

  // ============================================================================
  // PHASE 1: THE MOVE-IN GATEWAY (Locked Portal)
  // ============================================================================
  if (info?.requiresMoveInPayment) {
    return (
      <div className="tenant-gateway-container">
        <div className="tenant-gateway-card">
          <div className="tenant-gateway-header">
            <h2 className="tenant-welcome-title" style={{ marginBottom: '0.5rem', textAlign: 'center' }}>Welcome to Rentlee, {firstName}!</h2>
            <p className="tenant-welcome-sub" style={{ margin: '0 0 1.5rem 0', textAlign: 'center' }}>
              Your landlord has drafted your tenancy for <strong>{info.propertyName} - Unit {info.unitId}</strong>.
            </p>
          </div>

          <div className="tenant-gateway-invoice">
            <h4 style={{ margin: '0 0 1rem 0', color: '#64748b', textTransform: 'uppercase', fontSize: '0.813rem', letterSpacing: '0.5px' }}>Move-In Invoice Breakdown</h4>
            <div className="tenant-invoice-row">
              <span>Security Deposit</span>
              <span>Ksh {info.moveInCharges.deposit.toLocaleString()}</span>
            </div>
            <div className="tenant-invoice-row">
              <span>Monthly Rent</span>
              <span>Ksh {info.moveInCharges.rent.toLocaleString()}</span>
            </div>
            <div className="tenant-invoice-total">
              <span>Total Due Now</span>
              <span className="tenant-total-amount">Ksh {info.moveInCharges.total.toLocaleString()}</span>
            </div>
          </div>

          {paymentSuccess ? (
            <div className="tenant-payment-success animation-fade-in">
              <div className="success-icon"><i className="fas fa-check-circle"></i></div>
              <h3>Payment Initiated!</h3>
              <p>Check your phone to enter your PIN to activate your lease.</p>
            </div>
          ) : (
            <form onSubmit={handleMpesaPayment} className="tenant-gateway-form animation-fade-in">
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" style={{ fontWeight: '600', color: 'var(--navy-900)' }}>M-Pesa Phone Number</label>
                <div className="mpesa-input-wrapper">
                  <span className="mpesa-prefix">+254</span>
                  <input 
                    type="tel" 
                    className="form-input mpesa-input" 
                    value={paymentPhone} 
                    onChange={handlePhoneChange} 
                    placeholder="712345678" 
                    required 
                  />
                </div>
              </div>
              <button type="submit" className="btn-mpesa" disabled={isProcessing}>
                {isProcessing ? (
                  <><i className="fas fa-spinner fa-spin"></i> Processing Request...</>
                ) : (
                  <><i className="fas fa-mobile-alt"></i> Pay Ksh {info.moveInCharges.total.toLocaleString()} Now</>
                )}
              </button>
              <p className="tenant-gateway-footer-text">
                <i className="fas fa-lock"></i> Secured by Safaricom Daraja API
              </p>
            </form>
          )}
        </div>
      </div>
    )
  }

  // ============================================================================
  // PHASE 2: THE ACTIVE DASHBOARD
  // ============================================================================
  const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(10,22,40,0.6)', zIndex: 9999, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }
  const wrapperStyle = { display: 'flex', alignItems: 'flex-start', justifyContent: 'center', minHeight: '100%', padding: '3rem 1rem', boxSizing: 'border-box' }
  const contentStyle = { position: 'relative', background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '480px', margin: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }

  return (
    <div className="tenant-dashboard">

      <div className="tenant-welcome">
        <div>
          <h2 className="tenant-welcome-title">Welcome back, {firstName}! 👋</h2>
          <p className="tenant-welcome-sub">Here's a summary of your tenancy</p>
        </div>
      </div>

      <section className="tenant-stats">
        <div className="tenant-stat-card blue">
          <div className="tenant-stat-icon"><i className="fas fa-home"></i></div>
          <div className="tenant-stat-label">My Unit</div>
          <div className="tenant-stat-value">{info?.unitId ?? '—'}</div>
          <div className="tenant-stat-sub">{info?.propertyName ?? '—'}</div>
        </div>

        <div className="tenant-stat-card rose">
          <div className="tenant-stat-icon"><i className="fas fa-money-bill-wave"></i></div>
          <div className="tenant-stat-label">Outstanding Balance</div>
          <div className="tenant-stat-value" style={{ color: info?.balance > 0 ? '#e11d48' : 'var(--navy-900)' }}>
            {info?.balance != null ? `Ksh ${Number(info.balance).toLocaleString()}` : '—'}
          </div>
          <div className="tenant-stat-sub">
            {info?.balance <= 0 ? 'All paid ✓' : `Due: ${info?.nextDueDate ?? '—'}`}
          </div>
        </div>

        <div className="tenant-stat-card emerald">
          <div className="tenant-stat-icon"><i className="fas fa-calendar-check"></i></div>
          <div className="tenant-stat-label">Next Rent Due</div>
          <div className="tenant-stat-value">{info?.nextDueDate ?? '—'}</div>
          <div className="tenant-stat-sub">Monthly rent: {info?.monthlyRent ?? '—'}</div>
        </div>

        <div className="tenant-stat-card amber">
          <div className="tenant-stat-icon"><i className="fas fa-wrench"></i></div>
          <div className="tenant-stat-label">Open Requests</div>
          <div className="tenant-stat-value">{info?.maintenanceCount ?? '—'}</div>
          <div className="tenant-stat-sub">Maintenance tickets</div>
        </div>
      </section>

      <section className="tenant-quick-actions">
        <h3 className="tenant-section-title">Quick Actions</h3>
        <div className="tenant-action-grid">
          <button className="tenant-action-btn" onClick={() => { setPaymentAmount(info?.balance > 0 ? info.balance : ''); setShowPaymentModal(true); }}>
            <div className="tenant-action-icon blue"><i className="fas fa-money-bill-wave"></i></div>
            <div className="tenant-action-content">
              <div className="tenant-action-title">Pay Rent</div>
              <div className="tenant-action-desc">Trigger M-Pesa STK Push</div>
            </div>
            <i className="fas fa-arrow-right tenant-action-arrow"></i>
          </button>
          
          <button className="tenant-action-btn" onClick={() => navigate('/tenant/maintenance')}>
            <div className="tenant-action-icon amber"><i className="fas fa-tools"></i></div>
            <div className="tenant-action-content">
              <div className="tenant-action-title">Report Issue</div>
              <div className="tenant-action-desc">Submit a maintenance request</div>
            </div>
            <i className="fas fa-arrow-right tenant-action-arrow"></i>
          </button>
        </div>
      </section>

      <section className="tenant-bottom-grid">
        <div className="tenant-card">
          <div className="tenant-card-header">
            <h3 className="tenant-card-title">Recent Payments</h3>
            <button className="tenant-view-all" onClick={() => navigate('/tenant/payments')}>
              View all <i className="fas fa-arrow-right"></i>
            </button>
          </div>
          {payments.length === 0 ? (
            <div className="tenant-empty">
              <i className="fas fa-receipt"></i>
              <p>No payments yet</p>
            </div>
          ) : (
            <table className="tenant-table">
              <thead>
                <tr><th>Amount</th><th>Date</th><th>Status</th></tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td className="tenant-table-bold">Ksh {Number(p.amount).toLocaleString()}</td>
                    <td className="tenant-table-muted">{p.date}</td>
                    <td><span className={`status-badge ${p.status?.toLowerCase()}`}>{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="tenant-card">
          <div className="tenant-card-header">
            <h3 className="tenant-card-title">My Maintenance Requests</h3>
            <button className="tenant-view-all" onClick={() => navigate('/tenant/maintenance')}>
              View all <i className="fas fa-arrow-right"></i>
            </button>
          </div>
          {requests.length === 0 ? (
            <div className="tenant-empty">
              <i className="fas fa-wrench"></i>
              <p>No maintenance requests yet</p>
            </div>
          ) : (
            <div className="tenant-maint-list">
              {requests.map(r => (
                <div key={r.id} className="tenant-maint-item">
                  <div className="tenant-maint-content">
                    <p className="tenant-maint-desc">{r.description}</p>
                    <p className="tenant-maint-date">{r.dateSubmitted}</p>
                  </div>
                  <span className={`status-badge ${r.status?.toLowerCase().replace('_', '-')}`}>{r.status.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* STANDARD RENT PAYMENT MODAL */}
      {showPaymentModal && createPortal(
        <div style={overlayStyle} onClick={() => !isProcessing && setShowPaymentModal(false)}>
          <div style={wrapperStyle}>
            <div style={contentStyle} onClick={e => e.stopPropagation()}>
              
              <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="tenant-welcome-title" style={{ fontSize: '1.5rem', margin: 0 }}>Make a Payment</h3>
                <button 
                  onClick={() => setShowPaymentModal(false)} 
                  disabled={isProcessing}
                  style={{ width: '34px', height: '34px', borderRadius: '50%', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <i className="fas fa-times" />
                </button>
              </div>

              <div style={{ padding: '2rem' }}>
                {paymentSuccess ? (
                   <div className="tenant-payment-success animation-fade-in" style={{ background: 'transparent', padding: '1rem 0', border: 'none' }}>
                     <div className="success-icon" style={{ width: '60px', height: '60px', fontSize: '2rem' }}><i className="fas fa-check-circle"></i></div>
                     <h3 style={{ margin: '0 0 0.5rem 0' }}>Request Sent!</h3>
                     <p style={{ color: '#64748b', margin: 0 }}>Check your phone to enter your M-Pesa PIN.</p>
                   </div>
                ) : (
                  <form onSubmit={handleMpesaPayment}>
                    <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1.5rem', textAlign: 'center' }}>
                      <p style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>Current Outstanding Balance</p>
                      <h4 style={{ fontSize: '1.75rem', color: info.balance > 0 ? '#e11d48' : '#059669', margin: 0, fontFamily: "'Darker Grotesque', sans-serif" }}>
                        Ksh {info.balance.toLocaleString()}
                      </h4>
                    </div>

                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                      <label className="form-label" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: 'var(--navy-900)', marginBottom: '0.5rem' }}>Amount to Pay (Ksh)</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        value={paymentAmount} 
                        onChange={(e) => setPaymentAmount(e.target.value)} 
                        placeholder="e.g. 25000" 
                        required 
                        style={{ width: '100%', padding: '0.875rem 1rem', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '1rem' }}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: '2rem' }}>
                      <label className="form-label" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: 'var(--navy-900)', marginBottom: '0.5rem' }}>M-Pesa Number</label>
                      <div className="mpesa-input-wrapper">
                        <span className="mpesa-prefix">+254</span>
                        <input 
                          type="tel" 
                          className="form-input mpesa-input" 
                          value={paymentPhone} 
                          onChange={handlePhoneChange} 
                          placeholder="712345678" 
                          required 
                        />
                      </div>
                    </div>

                    <button type="submit" className="btn-mpesa" disabled={isProcessing} style={{ width: '100%' }}>
                      {isProcessing ? (
                        <><i className="fas fa-spinner fa-spin"></i> Triggering Prompt...</>
                      ) : (
                        <><i className="fas fa-mobile-alt"></i> Send STK Push</>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      , document.body)}

    </div>
  )
}