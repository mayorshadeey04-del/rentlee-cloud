import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../context/AuthContext'
import { can } from '../../utils/permissions'
import Toast from '../../components/Toast'
import ConfirmDialog from '../../components/ConfirmDialog'
import TenantWizard from '../../components/TenantWizard' 
import SubmitButton from '../../components/SubmitButton' //  Imported Pro Button
import './Tenants.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const STATUSES = ['Active', 'Inactive', 'Pending']
const EMPTY_FORM = { firstName: '', lastName: '', phone: '', idNumber: '', email: '', propertyId: '', propertyName: '', unitId: '' }
const EMPTY_EMAIL = { recipients: '', propertyId: '', subject: '', message: '' }
const EMPTY_FILTERS = { propertyId: '', balance: '', status: '' }

function formatBalance(amount) {
  return `Ksh ${Number(amount || 0).toLocaleString()}`
}

export default function Tenants() {
  const { user, authHeaders } = useAuth()
  const [tenants, setTenants]           = useState([])
  const [properties, setProperties]     = useState([])
  const [vacantUnits, setVacantUnits]   = useState([])
  const [loading, setLoading]           = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false) //  Shared loading state for modals
  const [pageError, setPageError]       = useState('')
  const [showFilter, setShowFilter]     = useState(false)
  
  const [showAdd, setShowAdd]           = useState(false)
  const [showEdit, setShowEdit]         = useState(false)
  const [showEmail, setShowEmail]       = useState(false)
  
  const [editTarget, setEditTarget]     = useState(null)
  const [form, setForm]                 = useState(EMPTY_FORM)
  const [emailForm, setEmailForm]       = useState(EMPTY_EMAIL)
  const [error, setError]               = useState('')
  const [emailError, setEmailError]     = useState('')
  const [filters, setFilters]           = useState(EMPTY_FILTERS)
  const [activeFilters, setActiveFilters] = useState(EMPTY_FILTERS)
  const [toasts, setToasts]             = useState([])
  const [confirm, setConfirm]           = useState(null)

  const canCreate = can(user?.role, 'tenants', 'create')
  const canUpdate = can(user?.role, 'tenants', 'update')
  const canDelete = can(user?.role, 'tenants', 'delete')

  const showToast = useCallback((type, title, message) => {
    const id = Date.now()
    setToasts(t => [...t, { id, type, title, message }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }, [])

  // Live API Fetch
  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setLoading(true)
      setPageError('')

      const [tenantsRes, propsRes] = await Promise.all([
        fetch(`${API_URL}/tenants`, { headers: authHeaders() }),
        fetch(`${API_URL}/properties`, { headers: authHeaders() })
      ])

      if (!tenantsRes.ok || !propsRes.ok) throw new Error('Failed to fetch data')

      const tenantsData = await tenantsRes.json()
      const propsData = await propsRes.json()

      const formattedTenants = (tenantsData.data || []).map(t => ({
        id: t.id,
        firstName: t.first_name,
        lastName: t.last_name,
        phone: t.phone,
        email: t.email,
        idNumber: t.id_number,
        propertyId: t.property_id,
        propertyName: t.property_name,
        unitId: t.unit_id,
        unitNumber: t.unit_number,
        balance: t.balance || 0,
        status: t.status
      }))

      setTenants(formattedTenants)
      setProperties(propsData.data || [])

    } catch (err) {
      setPageError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Load vacant units for Edit modal
  async function loadVacantUnits(propertyId) {
    if (!propertyId) { setVacantUnits([]); return }
    try {
      const res = await fetch(`${API_URL}/units?propertyId=${propertyId}`, { headers: authHeaders() })
      const data = await res.json()
      if (res.ok) {
        setVacantUnits((data.data || []).filter(u => u.status === 'vacant'))
      }
    } catch (err) {
      console.error('Failed to load units', err)
    }
  }

  // Lock scrolling
  useEffect(() => {
    if (showEdit || showEmail) {
      document.body.style.overflow = 'hidden'
    } else if (!showAdd) {
      document.body.style.overflow = 'unset'
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [showEdit, showEmail, showAdd])

  const filtered = tenants.filter(t =>
    (!activeFilters.propertyId || String(t.propertyId) === String(activeFilters.propertyId)) &&
    (!activeFilters.status     || t.status.toLowerCase() === activeFilters.status.toLowerCase()) &&
    (!activeFilters.balance    ||
      (activeFilters.balance === 'paid'   && Number(t.balance) <= 0) ||
      (activeFilters.balance === 'unpaid' && Number(t.balance) > 0))
  )

  //  STRICT AUTO-CLEANING FOR EDIT FORM
  function handleChange(e) {
    setError('')
    const { name } = e.target
    let value = e.target.value

    if (name === 'firstName' || name === 'lastName') {
      value = value.replace(/[^a-zA-Z\s]/g, '') // Letters only
    } else if (name === 'phone') {
      value = value.replace(/[^\d+]/g, '') // Numbers and '+' only
    } else if (name === 'idNumber') {
      value = value.replace(/\D/g, '').slice(0, 12) // Digits only, max 12
    }

    if (name === 'propertyId') {
      const prop = properties.find(p => String(p.id) === String(value))
      setForm(f => ({ ...f, propertyId: value, propertyName: prop?.name || '', unitId: '' }))
      loadVacantUnits(value)
    } else {
      setForm(f => ({ ...f, [name]: value }))
    }
  }

  function handleFilterChange(e) { setFilters(f => ({ ...f, [e.target.name]: e.target.value })) }
  function handleEmailChange(e) { setEmailError(''); setEmailForm(f => ({ ...f, [e.target.name]: e.target.value })) }
  function applyFilters()  { setActiveFilters({ ...filters }) }
  function clearFilters()  { setFilters(EMPTY_FILTERS); setActiveFilters(EMPTY_FILTERS) }

  function openEdit(tenant) {
    setEditTarget(tenant)
    setError('')
    setForm({
      firstName:    tenant.firstName,
      lastName:     tenant.lastName,
      phone:        tenant.phone,
      idNumber:     tenant.idNumber,
      email:        tenant.email,
      propertyId:   tenant.propertyId,
      propertyName: tenant.propertyName,
      unitId:       tenant.unitId,
    })
    loadVacantUnits(tenant.propertyId)
    setShowEdit(true)
  }

const handleWizardSuccess = (newTenant) => {
    fetchData() 
    
    //  Check if it was a migration or a brand new tenant
    if (newTenant.isExisting) {
      showToast('success', 'Tenant Migrated!', `${newTenant.firstName}'s ledger is synced and their portal is fully unlocked.`)
    } else {
      showToast('success', 'Invite Sent!', `${newTenant.firstName} has been invited. Their portal is locked pending payment.`)
    }
  }

  //  STRICT FORMAT VALIDATION BEFORE SUBMITTING EDIT
  async function submitEdit() {
    setError('')

    // 1. Check empty fields
    if (!form.firstName || !form.lastName || !form.phone || !form.idNumber || !form.email || !form.propertyId || !form.unitId) {
      return setError('Please fill in all required fields.')
    }

    // 2. Name Length
    if (form.firstName.length < 2 || form.lastName.length < 2) {
      return setError('First and Last names must be at least 2 characters long.')
    }

    // 3. Strict Phone Number Length and Format (Kenya)
    if (form.phone.startsWith('+')) {
      if (form.phone.length !== 13) return setError('Phone number starting with "+" must be exactly 13 characters (e.g., +254712345678).')
      if (!/^\+254(7|1)\d{8}$/.test(form.phone)) return setError('Invalid Kenyan phone format. Expected +2547... or +2541...')
    } else if (form.phone.startsWith('0')) {
      if (form.phone.length !== 10) return setError('Phone number starting with "0" must be exactly 10 characters (e.g., 0712345678).')
      if (!/^0(7|1)\d{8}$/.test(form.phone)) return setError('Invalid Kenyan phone format. Expected 07... or 01...')
    } else {
      return setError('Phone number must start with "0" or "+".')
    }

    // 4. ID Number Length
    if (form.idNumber.length < 6) {
      return setError('Please enter a valid National ID number (minimum 6 digits).')
    }

    // 5. Strict Email Format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(form.email)) {
      return setError('Please enter a strictly valid email address (e.g., name@gmail.com).')
    }

    setIsSubmitting(true) //  Turn spinner ON

    // Proceed to API call if all validations pass
    try {
      const res = await fetch(`${API_URL}/tenants/${editTarget.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)

      setTenants(t => t.map(ten => ten.id === editTarget.id ? { ...ten, ...form } : ten))
      setShowEdit(false)
      showToast('success', 'Tenant Updated', `${form.firstName} ${form.lastName} has been updated.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSubmitting(false) //  Turn spinner OFF
    }
  }

  function deleteTenant(id) {
    const tenant = tenants.find(t => t.id === id)
    const isInactive = tenant?.status?.toLowerCase() === 'inactive'
    setConfirm({
      id, isInactive,
      message: isInactive 
        ? ` PERMANENT DELETE: This will completely erase "${tenant?.firstName} ${tenant?.lastName}". This cannot be undone.`
        : `Are you sure you want to deactivate "${tenant?.firstName} ${tenant?.lastName}"?`
    })
  }

  // Live Confirm Delete/Deactivate
  async function confirmDelete() {
    const { id, isInactive } = confirm
    const tenant = tenants.find(t => t.id === id)
    setConfirm(null)
    
    try {
      const res = await fetch(`${API_URL}/tenants/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)

      if (isInactive) {
        setTenants(t => t.filter(ten => ten.id !== id))
        showToast('success', 'Permanently Deleted', `The record for ${tenant?.firstName} has been erased.`)
      } else {
        setTenants(t => t.map(ten => ten.id === id ? { ...ten, status: 'inactive' } : ten))
        showToast('success', 'Tenant Deactivated', `${tenant?.firstName} is now inactive.`)
      }
    } catch (err) {
      showToast('error', 'Action Failed', err.message)
    }
  }

  //  LIVE SEND EMAIL LOGIC
  const submitEmail = async () => {
    if (!emailForm.recipients || !emailForm.subject || !emailForm.message) return setEmailError('Fill all required fields.')
    if (emailForm.recipients === 'property' && !emailForm.propertyId) return setEmailError('Select a property.')
    
    setIsSubmitting(true) //  Turn spinner ON
    setEmailError('')

    try {
      const res = await fetch(`${API_URL}/tenants/send-email`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(emailForm)
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.message || 'Failed to send emails')

      setEmailForm(EMPTY_EMAIL)
      setShowEmail(false)
      showToast('success', 'Emails Sent!', `Successfully sent to ${data.count} tenants.`)
    } catch (err) {
      setEmailError(err.message)
    } finally {
      setIsSubmitting(false) //  Turn spinner OFF
    }
  }

  const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(10,22,40,0.6)', zIndex: 9999, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }
  const wrapperStyle = { display: 'flex', alignItems: 'flex-start', justifyContent: 'center', minHeight: '100%', padding: '3rem 1rem', boxSizing: 'border-box' }
  const contentStyle = { position: 'relative', background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '660px', margin: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }
  const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }
  const closeStyle = { width: '34px', height: '34px', borderRadius: '50%', border: '1.5px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', flexShrink: 0 }

  return (
    <div className="tenants-page">
      <Toast toasts={toasts} />
      {confirm && <ConfirmDialog message={confirm.message} onConfirm={confirmDelete} onCancel={() => setConfirm(null)} />}

      <div className="page-header">
        <h2 className="page-title">Tenants</h2>
        <div className="header-buttons">
          <button className="btn-filter" onClick={() => setShowFilter(s => !s)}><i className="fas fa-filter" /> Filter</button>
          <button className="btn-email" onClick={() => { setEmailForm(EMPTY_EMAIL); setEmailError(''); setShowEmail(true) }}><i className="fas fa-envelope" /> Send Email</button>
          {canCreate && <button className="btn-primary" onClick={() => setShowAdd(true)}><i className="fas fa-plus" /> Add New Tenant</button>}
        </div>
      </div>

      {pageError && (
        <div style={{ padding: '12px 20px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', marginBottom: '20px', color: '#991b1b' }}>
           {pageError}
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
            <label className="filter-label">Balance</label>
            <select className="filter-select" name="balance" value={filters.balance} onChange={handleFilterChange}>
              <option value="">All Balances</option>
              <option value="paid">Paid (Ksh 0 or Credit)</option>
              <option value="unpaid">In Arrears (&gt; Ksh 0)</option>
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Status</label>
            <select className="filter-select" name="status" value={filters.status} onChange={handleFilterChange}>
              <option value="">All Statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="filter-actions">
            <button className="btn-clear" onClick={clearFilters}>Clear</button>
            <button className="btn-apply" onClick={applyFilters}>Apply</button>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="tenants-table">
          <thead>
            <tr>
              <th>TENANT NAME</th>
              <th>PHONE NUMBER</th>
              <th>ID NUMBER</th>
              <th>EMAIL</th>
              <th>PROPERTY NAME</th>
              <th>UNIT ID</th>
              <th>BALANCE</th>
              <th>STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="9" className="table-empty">Loading tenants...</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan="9" className="table-empty">No tenants found.</td></tr>}
            {filtered.map(tenant => {
              const isInactive = tenant.status?.toLowerCase() === 'inactive';
              return (
                <tr key={tenant.id} style={{ opacity: isInactive ? 0.6 : 1, backgroundColor: isInactive ? '#f8fafc' : 'inherit' }}>
                  <td className="tenant-name">{tenant.firstName} {tenant.lastName}</td>
                  <td className="tenant-phone">{tenant.phone}</td>
                  <td className="tenant-id">{tenant.idNumber}</td>
                  <td className="tenant-email">{tenant.email}</td>
                  <td className="tenant-property">{tenant.propertyName}</td>
                  <td className="tenant-unit">{tenant.unitNumber || tenant.unitId}</td>
                  <td className="tenant-balance" style={{ color: tenant.balance > 0 ? '#e11d48' : 'var(--navy-900)' }}>{formatBalance(tenant.balance)}</td>
                  <td><span className={`status-badge ${tenant.status?.toLowerCase()}`}>{tenant.status}</span></td>
                  <td>
                    <div className="action-buttons">
                      {canUpdate && (
                        <button className="action-btn edit-btn" onClick={() => openEdit(tenant)} disabled={isInactive} style={{ cursor: isInactive ? 'not-allowed' : 'pointer', filter: isInactive ? 'grayscale(100%)' : 'none' }} title={isInactive ? "Cannot edit inactive tenant" : "Edit"}>
                          <i className="fas fa-edit" />
                        </button>
                      )}
                      {canDelete && (
                        <button className="action-btn delete-btn" onClick={() => deleteTenant(tenant.id)} style={isInactive ? { backgroundColor: '#1e293b', color: '#fff', borderColor: '#1e293b' } : {}} title={isInactive ? "Permanent Delete" : "Deactivate Tenant"}>
                          <i className={isInactive ? "fas fa-skull" : "fas fa-trash"} />
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

      <TenantWizard 
        isOpen={showAdd} 
        onClose={() => setShowAdd(false)} 
        onSuccess={handleWizardSuccess} 
        properties={properties} 
      />

      {/* EDIT TENANT MODAL */}
      {showEdit && createPortal(
        <div style={overlayStyle} onClick={() => !isSubmitting && setShowEdit(false)}>
          <div style={wrapperStyle}>
            <div style={contentStyle} onClick={e => e.stopPropagation()}>
              <div style={headerStyle}>
                <h3 className="modal-title">Edit Tenant</h3>
                <button style={closeStyle} onClick={() => setShowEdit(false)} disabled={isSubmitting}><i className="fas fa-times" /></button>
              </div>
              
              <div style={{ padding: '2rem' }}>
                {error && <p className="form-error">{error}</p>}
                <div className="form-row">
                  <div className="form-group"><label className="form-label">First Name <span>*</span></label><input className="form-input" name="firstName" value={form.firstName} onChange={handleChange} disabled={isSubmitting}/></div>
                  <div className="form-group"><label className="form-label">Last Name <span>*</span></label><input className="form-input" name="lastName" value={form.lastName} onChange={handleChange} disabled={isSubmitting}/></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Phone Number <span>*</span></label><input className="form-input" name="phone" value={form.phone} onChange={handleChange} disabled={isSubmitting}/></div>
                  <div className="form-group"><label className="form-label">ID Number <span>*</span></label><input className="form-input" name="idNumber" value={form.idNumber} onChange={handleChange} disabled={isSubmitting}/></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Email <span>*</span></label><input className="form-input" type="email" name="email" value={form.email} onChange={handleChange} disabled={isSubmitting}/></div>
                  <div className="form-group"><label className="form-label">Property <span>*</span></label>
                    <select className="form-select" name="propertyId" value={form.propertyId} onChange={handleChange} disabled>
                      <option value={form.propertyId}>{form.propertyName}</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ flexShrink: 0, borderTop: '1px solid #e2e8f0' }}>
                <button className="btn-cancel" onClick={() => setShowEdit(false)} disabled={isSubmitting}>Cancel</button>
                {/*  Swapped Button */}
                <SubmitButton 
                  onClick={submitEdit} 
                  isSubmitting={isSubmitting} 
                  text="Update Tenant" 
                  loadingText="Updating..." 
                  className="btn-submit"
                />
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* SEND EMAIL MODAL */}
      {showEmail && createPortal(
        <div style={overlayStyle} onClick={() => !isSubmitting && setShowEmail(false)}>
          <div style={wrapperStyle}>
            <div style={contentStyle} onClick={e => e.stopPropagation()}>
              <div style={headerStyle}>
                <h3 className="modal-title">Send Email Notice</h3>
                <button style={closeStyle} onClick={() => setShowEmail(false)} disabled={isSubmitting}><i className="fas fa-times" /></button>
              </div>
              
              <div style={{ padding: '2rem' }}>
                {emailError && <p className="form-error">{emailError}</p>}
                
                <div className="form-group full-width">
                  <label className="form-label">Recipients <span>*</span></label>
                  <select className="form-select" name="recipients" value={emailForm.recipients} onChange={handleEmailChange} disabled={isSubmitting}>
                    <option value="">Choose recipients</option>
                    <option value="all">All Active Tenants</option>
                    <option value="property">By Specific Property</option>
                    <option value="arrears">Tenants with Arrears (Balance &gt; 0)</option>
                  </select>
                </div>

                {emailForm.recipients === 'property' && (
                  <div className="form-group full-width">
                    <label className="form-label">Select Property <span>*</span></label>
                    <select className="form-select" name="propertyId" value={emailForm.propertyId} onChange={handleEmailChange} disabled={isSubmitting}>
                      <option value="">Choose a property</option>
                      {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                )}

                <div className="form-group full-width">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Subject <span>*</span></span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal' }}>Variables: {'{{firstName}}'}, {'{{fullName}}'}</span>
                  </label>
                  <input 
                    className="form-input" 
                    name="subject" 
                    value={emailForm.subject} 
                    onChange={handleEmailChange} 
                    placeholder="e.g., Rent Reminder for {{fullName}}" 
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-group full-width" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Message <span>*</span></span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal' }}>Variables: {'{{firstName}}'}, {'{{fullName}}'}, {'{{balance}}'}, {'{{unit}}'}</span>
                  </label>
                  <textarea 
                    className="form-textarea" 
                    name="message" 
                    value={emailForm.message} 
                    onChange={handleEmailChange} 
                    rows="6" 
                    placeholder="Dear {{firstName}}, this is a reminder that you have an outstanding balance of Ksh {{balance}} for {{unit}}. Please pay immediately." 
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ flexShrink: 0, borderTop: '1px solid #e2e8f0' }}>
                <button className="btn-cancel" onClick={() => setShowEmail(false)} disabled={isSubmitting}>Cancel</button>
                {/*  Swapped Button */}
                <SubmitButton 
                  onClick={submitEmail} 
                  isSubmitting={isSubmitting} 
                  text="Send Emails" 
                  loadingText="Sending..." 
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