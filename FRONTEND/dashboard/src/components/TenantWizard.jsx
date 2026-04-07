import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import SubmitButton from './SubmitButton' // ✅ Imported Pro Button

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// ✅ ADDED MIGRATION FIELDS TO STATE
const EMPTY_FORM = {
  firstName: '', lastName: '', phone: '', idNumber: '', email: '',
  propertyId: '', propertyName: '', unitId: '', unitNumber: '',
  rentAmount: 0, depositAmount: 0,
  isExisting: false, historicalDeposit: '', currentArrears: '0'
}

export default function TenantWizard({ isOpen, onClose, onSuccess, properties }) {
  const { authHeaders } = useAuth()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(EMPTY_FORM)
  const [vacantUnits, setVacantUnits] = useState([])
  const [loadingUnits, setLoadingUnits] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false) // ✅ Shared loading state
  const [error, setError] = useState('')

  // Reset wizard and lock body scroll when opened
  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setForm(EMPTY_FORM)
      setError('')
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [isOpen])

  // LIVE API CALL FOR UNITS
  async function loadVacantUnits(propertyId) {
    if (!propertyId) { setVacantUnits([]); return }
    setLoadingUnits(true)
    
    try {
      const res = await fetch(`${API_URL}/units?propertyId=${propertyId}`, {
        headers: authHeaders()
      })
      const data = await res.json()
      
      if (res.ok) {
        const available = (data.data || []).filter(u => u.status === 'vacant')
        setVacantUnits(available)
      }
    } catch (err) {
      console.error('Failed to load vacant units', err)
      setError('Failed to load units. Please try again.')
    } finally {
      setLoadingUnits(false)
    }
  }

  // STRICT INPUT FILTERING
  const handleChange = (e) => {
    setError('')
    const { name } = e.target
    let value = e.target.value

    if (name === 'firstName' || name === 'lastName') {
      value = value.replace(/[^a-zA-Z\s]/g, '')
    } else if (name === 'phone') {
      value = value.replace(/[^\d+]/g, '')
    } else if (name === 'idNumber') {
      value = value.replace(/\D/g, '').slice(0, 12)
    }

    if (name === 'propertyId') {
      const prop = properties.find(p => String(p.id) === String(value))
      setForm(f => ({ ...f, propertyId: value, propertyName: prop?.name || '', unitId: '', rentAmount: 0 }))
      loadVacantUnits(value)
    } else if (name === 'unitId') {
      const unit = vacantUnits.find(u => String(u.id) === String(value))
      setForm(f => ({ 
        ...f, 
        unitId: value, 
        unitNumber: unit?.unit_number || '', 
        rentAmount: unit?.rent || 0, 
        depositAmount: unit?.rent || 0 
      }))
    } else {
      setForm(f => ({ ...f, [name]: value }))
    }
  }

  // STRICT FORMAT VALIDATION
  const nextStep = () => {
    setError('')
    
    if (step === 1) {
      if (!form.firstName || !form.lastName || !form.phone || !form.idNumber || !form.email) return setError('Please fill all required profile fields.')
      if (form.firstName.length < 2 || form.lastName.length < 2) return setError('First and Last names must be at least 2 characters long.')
      const phoneRegex = /^(?:07|01|\+2547|\+2541)\d{8}$/
      if (!phoneRegex.test(form.phone)) return setError('Please enter a valid Kenyan phone number.')
      if (form.idNumber.length < 6) return setError('Please enter a valid National ID number (minimum 6 digits).')
      const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/
      if (!emailRegex.test(form.email)) return setError('Please enter a strictly valid email address.')
      setStep(2)
      
    } else if (step === 2) {
      if (!form.propertyId || !form.unitId) return setError('Please select a property and a vacant unit.')
      setStep(3)
    }
  }

  const prevStep = () => { setError(''); setStep(s => s - 1) }

  // LIVE API CALL FOR SUBMITTING
  async function submitWizard() {
    // ✅ NEW VALIDATION FOR MIGRATION
    if (form.isExisting && !form.historicalDeposit) return setError('Please enter the historical deposit amount paid.')
    
    setIsSubmitting(true) // ✅ Spinner ON
    setError('')
    
    try {
      const res = await fetch(`${API_URL}/tenants`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone,
          idNumber: form.idNumber,
          email: form.email,
          propertyId: form.propertyId,
          unitId: form.unitId,
          depositAmount: Number(form.depositAmount),
          // ✅ PASSING NEW MIGRATION DATA TO BACKEND
          isExisting: form.isExisting,
          historicalDeposit: form.historicalDeposit ? Number(form.historicalDeposit) : 0,
          currentArrears: form.currentArrears ? Number(form.currentArrears) : 0
        })
      })
      
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.message || 'Failed to create tenant')
      
      onSuccess({ ...data.data, firstName: form.firstName, lastName: form.lastName, isExisting: form.isExisting })
      onClose()
      
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSubmitting(false) // ✅ Spinner OFF
    }
  }

  if (!isOpen) return null

  const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(10,22,40,0.6)', zIndex: 9999, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }
  const wrapperStyle = { display: 'flex', alignItems: 'flex-start', justifyContent: 'center', minHeight: '100%', padding: '3rem 1rem', boxSizing: 'border-box' }
  const contentStyle = { position: 'relative', background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '700px', margin: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }
  const stepperContainer = { display: 'flex', background: '#f8fafc', padding: '1.5rem 2rem', borderBottom: '1px solid #e2e8f0', gap: '1rem', flexShrink: 0 }
  const stepIndicator = (isActive, isPast) => ({ flex: 1, borderBottom: `4px solid ${isActive || isPast ? '#3b82f6' : '#cbd5e1'}`, paddingBottom: '0.5rem', color: isActive || isPast ? '#1e293b' : '#94a3b8', fontWeight: isActive ? '700' : '600', fontSize: '0.875rem', transition: 'all 0.3s ease' })

  // Toggle Styles
  const toggleBtnStyle = (active) => ({ flex: 1, padding: '0.75rem', border: 'none', background: active ? '#fff' : 'transparent', borderRadius: '8px', fontWeight: '600', color: active ? '#2563eb' : '#64748b', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: active ? '0 4px 12px rgba(0,0,0,0.08)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem' })

  return createPortal(
    <div style={overlayStyle} onClick={onClose}>
      <div style={wrapperStyle}>
        <div style={contentStyle} onClick={e => e.stopPropagation()}>
          
          <div style={stepperContainer}>
            <div style={stepIndicator(step === 1, step > 1)}>1. Tenant Profile</div>
            <div style={stepIndicator(step === 2, step > 2)}>2. Placement</div>
            <div style={stepIndicator(step === 3, step > 3)}>3. Finances</div>
          </div>

          <div style={{ padding: '2rem' }}>
              
            {error && <div className="form-error">{error}</div>}

            {step === 1 && (
              <div className="wizard-step animation-fade-in">
                <h3 style={{ fontSize: '1.25rem', color: '#0f172a', marginBottom: '1.5rem' }}>Capture Tenant Details</h3>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">First Name <span>*</span></label><input className="form-input" name="firstName" value={form.firstName} onChange={handleChange} placeholder="e.g., Jane" /></div>
                  <div className="form-group"><label className="form-label">Last Name <span>*</span></label><input className="form-input" name="lastName" value={form.lastName} onChange={handleChange} placeholder="e.g., Kamau" /></div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Phone Number <span>*</span></label>
                    <input className="form-input" name="phone" value={form.phone} onChange={handleChange} placeholder="e.g., 0712345678" />
                    <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>Preferably their M-Pesa registered number.</small>
                  </div>
                  <div className="form-group"><label className="form-label">National ID <span>*</span></label><input className="form-input" name="idNumber" value={form.idNumber} onChange={handleChange} placeholder="ID Number" /></div>
                </div>
                <div className="form-group"><label className="form-label">Email Address <span>*</span></label><input className="form-input" type="email" name="email" value={form.email} onChange={handleChange} placeholder="Used for portal invites" /></div>
              </div>
            )}

            {step === 2 && (
              <div className="wizard-step animation-fade-in">
                <h3 style={{ fontSize: '1.25rem', color: '#0f172a', marginBottom: '1.5rem' }}>Placement</h3>
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label">Select Property <span>*</span></label>
                  <select className="form-select" name="propertyId" value={form.propertyId} onChange={handleChange}>
                    <option value="">Choose a property...</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Assign Unit <span>*</span></label>
                    <select className="form-select" name="unitId" value={form.unitId} onChange={handleChange} disabled={!form.propertyId || loadingUnits}>
                      <option value="">{loadingUnits ? 'Loading units...' : 'Choose a vacant unit...'}</option>
                      {vacantUnits.map(u => <option key={u.id} value={u.id}>{u.unit_number}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Default Rent</label>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.875rem 1rem', borderRadius: '10px', color: '#475569', fontWeight: '600', fontSize: '0.938rem', display: 'flex', alignItems: 'center', height: '48px' }}>
                      {form.rentAmount ? `Ksh ${Number(form.rentAmount).toLocaleString()}` : '—'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="wizard-step animation-fade-in">
                <h3 style={{ fontSize: '1.25rem', color: '#0f172a', marginBottom: '1rem' }}>Financial Setup</h3>

                {/* ── THE NEW TOGGLE ── */}
                <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '12px', padding: '0.35rem', marginBottom: '1.5rem' }}>
                  <button type="button" style={toggleBtnStyle(!form.isExisting)} onClick={() => setForm(f => ({ ...f, isExisting: false }))}>
                    <i className="fas fa-user-plus" /> New Move-In
                  </button>
                  <button type="button" style={toggleBtnStyle(form.isExisting)} onClick={() => setForm(f => ({ ...f, isExisting: true }))}>
                    <i className="fas fa-history" /> Existing Tenant
                  </button>
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                   <label className="form-label">Agreed Monthly Rent (Ksh) <span>*</span></label>
                   <input className="form-input" type="number" name="rentAmount" value={form.rentAmount} onChange={handleChange} />
                </div>

                {/* ── NEW TENANT UI ── */}
                {!form.isExisting ? (
                  <>
                    <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1rem' }}>Their portal will be <strong>locked</strong> until they pay the move-in charges below via M-Pesa.</p>
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                      <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label className="form-label" style={{ color: '#166534' }}>First Month's Rent (Ksh)</label>
                        <input className="form-input" type="number" value={form.rentAmount} disabled style={{ borderColor: '#bbf7d0', background: '#dcfce7', color: '#166534', fontWeight: 'bold', cursor: 'not-allowed' }} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ color: '#166534' }}>Required Security Deposit (Ksh)</label>
                        <input className="form-input" type="number" name="depositAmount" value={form.depositAmount} onChange={handleChange} style={{ borderColor: '#bbf7d0' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                      <span style={{ color: '#64748b', fontWeight: '600' }}>Total Due on Portal:</span>
                      <span style={{ fontWeight: '700', color: '#2563eb', fontSize: '1.125rem' }}>Ksh {(Number(form.rentAmount) + Number(form.depositAmount)).toLocaleString()}</span>
                    </div>
                  </>
                ) : (
                  
                /* ── EXISTING TENANT (MIGRATION) UI ── */
                  <>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', padding: '1rem 1.25rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '10px', marginBottom: '1.5rem' }}>
                      <i className="fas fa-unlock" style={{ color: '#1d4ed8', fontSize: '1.25rem', marginTop: '2px' }}></i>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#1e3a8a', lineHeight: 1.5 }}>
                        <strong>Seamless Migration:</strong> The tenant's portal will remain <strong>unlocked</strong>. Enter their past financial data below to sync their ledger.
                      </p>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Historical Deposit Paid <span>*</span></label>
                        <input className="form-input" type="number" name="historicalDeposit" value={form.historicalDeposit} onChange={handleChange} />
                        <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>Recorded in ledger, not billed.</small>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Current Unpaid Arrears</label>
                        <input className="form-input" type="number" name="currentArrears" value={form.currentArrears} onChange={handleChange} />
                        <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>Leave as 0 if fully cleared.</small>
                      </div>
                    </div>
                  </>
                )}

              </div>
            )}

          </div>

          <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <button onClick={step === 1 ? onClose : prevStep} style={{ background: 'transparent', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer', padding: '0.5rem 1rem' }}>
              {step === 1 ? 'Cancel' : '← Back'}
            </button>
            
            {step < 3 ? (
              <button className="btn-primary" onClick={nextStep}>Next Step →</button>
            ) : (
              /* ✅ Swapped Button */
              <SubmitButton 
                onClick={submitWizard} 
                isSubmitting={isSubmitting} 
                text={form.isExisting ? 'Sync Existing Tenant' : 'Send Invite & Lock Portal'}
                loadingText={form.isExisting ? 'Syncing...' : 'Processing...'}
                className="btn-primary"
                style={{ background: form.isExisting ? '#3b82f6' : '#10b981' }} // Custom color mapping
              />
            )}
          </div>

        </div>
      </div>
    </div>
  , document.body)
}