import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../context/AuthContext'
import './TenantPayments.css'

const API_URL = 'http://localhost:5001/api'

export default function TenantPayments() {
  const { user, authHeaders }  = useAuth()
  const [payments, setPayments]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [info, setInfo]             = useState({ balance: 0 }) 
  const [pageError, setPageError]   = useState('')
  
  // Payment Modal & STK Push State
  const [showModal, setShowModal]               = useState(false)
  const [paymentAmount, setPaymentAmount]       = useState('')
  const [paymentPhone, setPaymentPhone]         = useState('')
  const [isProcessing, setIsProcessing]         = useState(false)
  const [paymentSuccess, setPaymentSuccess]     = useState(false)

  // ── LIVE API FETCH ──
  useEffect(() => {
    async function fetchPaymentsData() {
      try {
        setLoading(true)
        
        // Fetch current balance from dashboard endpoint, and full payment list from payments endpoint
        const [dashRes, paymentsRes] = await Promise.all([
          fetch(`${API_URL}/tenant-dashboard`, { headers: authHeaders() }),
          fetch(`${API_URL}/payments`, { headers: authHeaders() })
        ])

        if (!dashRes.ok || !paymentsRes.ok) throw new Error('Failed to load payment data')

        const dashData = await dashRes.json()
        const paymentsData = await paymentsRes.json()

        setInfo({ balance: dashData.data.info.balance })

        // Format raw backend data
        const formattedPayments = (paymentsData.data || []).map(p => {
          const dateObj = new Date(p.payment_date)
          return {
            id: p.id,
            amount: p.amount,
            date: dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            month: dateObj.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
            status: p.status, // Uses 'confirmed' or 'failed' natively from DB
            reference: p.mpesa_ref || '—'
          }
        })

        setPayments(formattedPayments)
      } catch (err) {
        setPageError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchPaymentsData()
  }, [])

  // Lock body scroll
  useEffect(() => {
    if (showModal) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = 'unset'
    return () => { document.body.style.overflow = 'unset' }
  }, [showModal])

  // STRICT VALIDATION
  const handlePhoneChange = (e) => {
    const numericValue = e.target.value.replace(/\D/g, '')
    if (numericValue.length <= 9) {
      setPaymentPhone(numericValue)
    }
  }

  // ── LIVE M-PESA STK PUSH ──
  const handleMpesaPayment = async (e) => {
    e.preventDefault()
    
    if (paymentPhone.length !== 9) {
       alert("Please enter exactly 9 digits for your M-Pesa number.")
       return
    }
    
    setIsProcessing(true)

    try {
      const res = await fetch(`${API_URL}/payments/initiate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          phone: `254${paymentPhone}`,
          amount: Number(paymentAmount),
          paymentType: 'rent'
        })
      })

      const data = await res.json()
      
      if (!res.ok) throw new Error(data.message)

      // Simulate STK processing UX
      setTimeout(() => {
        setIsProcessing(false)
        setPaymentSuccess(true)
        
        setTimeout(() => {
          setPaymentSuccess(false)
          setShowModal(false)
          
          // Optimistically update the UI to reflect a confirmed payment
          const newPayment = {
            id: Date.now(),
            amount: Number(paymentAmount),
            date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            month: new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
            status: 'confirmed',
            reference: 'Processing...'
          }
          
          setPayments(prev => [newPayment, ...prev])
          setInfo({ balance: Math.max(0, info.balance - Number(paymentAmount)) })
          setPaymentAmount('')
        }, 2000)
      }, 3000)

    } catch (err) {
      alert(`Payment failed: ${err.message}`)
      setIsProcessing(false)
    }
  }

  // Uses 'confirmed' matching our DB schema
  const totalPaid = payments.filter(p => p.status === 'confirmed').reduce((sum, p) => sum + Number(p.amount), 0)

  const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(10,22,40,0.6)', zIndex: 9999, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }
  const wrapperStyle = { display: 'flex', alignItems: 'flex-start', justifyContent: 'center', minHeight: '100%', padding: '3rem 1rem', boxSizing: 'border-box' }
  const contentStyle = { position: 'relative', background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '480px', margin: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }

  return (
    <div className="tenant-payments">

      <div className="payments-header">
        <div>
          <h2 className="payments-title">Payments</h2>
          <p className="payments-sub">Your rent payment history</p>
        </div>
        <button className="btn-primary" onClick={() => { setPaymentAmount(info.balance > 0 ? info.balance : ''); setShowModal(true); }}>
          <i className="fas fa-plus" /> Make Payment
        </button>
      </div>

      {pageError && (
        <div style={{ padding: '12px 20px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', marginBottom: '20px', color: '#991b1b' }}>
          ⚠️ {pageError}
        </div>
      )}

      {/* Summary cards */}
      <div className="payment-summary">
        <div className="summary-card">
          <div className="summary-icon blue"><i className="fas fa-money-bill-wave" /></div>
          <div>
            <div className="summary-label">Total Paid</div>
            <div className="summary-value">Ksh {totalPaid.toLocaleString()}</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon emerald"><i className="fas fa-check-circle" /></div>
          <div>
            <div className="summary-label">Paid Payments</div>
            <div className="summary-value">{payments.filter(p => p.status === 'confirmed').length}</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon amber"><i className="fas fa-history" /></div>
          <div>
            <div className="summary-label">Total Attempts</div>
            <div className="summary-value">{payments.length}</div>
          </div>
        </div>
      </div>

      {/* Payments table */}
      <div className="payments-table-card">
        {loading && <div className="payments-empty"><i className="fas fa-circle-notch fa-spin" /><p>Loading history...</p></div>}
        {!loading && payments.length === 0 ? (
          <div className="payments-empty">
            <i className="fas fa-receipt" />
            <p>No payment records yet</p>
          </div>
        ) : !loading && (
          <table className="payments-table">
            <thead>
              <tr><th>Reference</th><th>Month</th><th>Date</th><th>Amount</th><th>Status</th></tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id}>
                  <td className="payment-ref">{p.reference ?? '—'}</td>
                  <td className="payment-month">{p.month}</td>
                  <td className="payment-date">{p.date}</td>
                  <td className="payment-amount">Ksh {Number(p.amount).toLocaleString()}</td>
                  <td>
                    <span className={`status-badge ${p.status}`}>
                      {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* M-PESA STK PUSH MODAL */}
      {showModal && createPortal(
        <div style={overlayStyle} onClick={() => !isProcessing && setShowModal(false)}>
          <div style={wrapperStyle}>
            <div style={contentStyle} onClick={e => e.stopPropagation()}>
              
              <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="modal-title" style={{ margin: 0 }}>Make a Payment</h3>
                <button 
                  onClick={() => setShowModal(false)} 
                  disabled={isProcessing}
                  style={{ width: '34px', height: '34px', borderRadius: '50%', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <i className="fas fa-times" />
                </button>
              </div>

              <div style={{ padding: '2rem' }}>
                {paymentSuccess ? (
                   <div className="tenant-payment-success animation-fade-in" style={{ background: 'transparent', padding: '1rem 0', border: 'none', textAlign: 'center' }}>
                     <div className="success-icon" style={{ width: '60px', height: '60px', fontSize: '2rem', background: '#10b981', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}><i className="fas fa-check-circle"></i></div>
                     <h3 style={{ margin: '0 0 0.5rem 0', fontFamily: "'Darker Grotesque', sans-serif", fontSize: '1.75rem', color: 'var(--navy-900)' }}>Request Sent!</h3>
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
                        style={{ width: '100%', padding: '0.875rem 1rem', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '1rem', fontFamily: "'DM Sans', sans-serif" }}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: '2rem' }}>
                      <label className="form-label" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: 'var(--navy-900)', marginBottom: '0.5rem' }}>M-Pesa Number</label>
                      <div className="mpesa-input-wrapper" style={{ display: 'flex', alignItems: 'stretch', borderRadius: '10px', overflow: 'hidden', border: '2px solid #e2e8f0' }}>
                        <span className="mpesa-prefix" style={{ background: 'var(--slate-100)', padding: '0.875rem 1rem', fontWeight: '600', color: 'var(--slate-500)', borderRight: '1px solid #e2e8f0', display: 'flex', alignItems: 'center' }}>+254</span>
                        <input 
                          type="tel" 
                          className="form-input mpesa-input" 
                          value={paymentPhone} 
                          onChange={handlePhoneChange} 
                          placeholder="712345678" 
                          required 
                          style={{ border: 'none', borderRadius: '0', flex: 1, padding: '0.875rem 1rem', fontSize: '1rem', fontFamily: "'DM Sans', sans-serif", outline: 'none' }}
                        />
                      </div>
                    </div>

                    <button type="submit" className="btn-mpesa" disabled={isProcessing} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '1rem', background: isProcessing ? '#a7f3d0' : '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontFamily: "'DM Sans', sans-serif", fontWeight: '700', fontSize: '1rem', cursor: isProcessing ? 'not-allowed' : 'pointer' }}>
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