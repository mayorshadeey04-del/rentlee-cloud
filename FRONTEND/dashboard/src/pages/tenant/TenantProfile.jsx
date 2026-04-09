import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import SubmitButton from '../../components/SubmitButton' //  Imported Pro Button
import './TenantProfile.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export default function TenantProfile() {
  const { user, login, authHeaders } = useAuth()
  
  const [activeTab, setActiveTab] = useState('personal')
  const [loadingData, setLoadingData] = useState(true)
  
  // Real Data from DB
  const [dbProfile, setDbProfile] = useState(null)
  
  // Personal Info State
  const [editing, setEditing]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState({ email: '', phone: '' })
  
  // Password State
  const [pwdForm, setPwdForm]     = useState({ current: '', new: '', confirm: '' })
  const [savingPwd, setSavingPwd] = useState(false)
  
  // Feedback State
  const [errors, setErrors]       = useState({})
  const [success, setSuccess]     = useState('')
  const [pageError, setPageError] = useState('')

  // ── 1. FETCH LIVE PROFILE ON LOAD ──
  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch(`${API_URL}/profile`, { headers: authHeaders() })
        const data = await res.json()
        
        if (res.ok) {
          setDbProfile(data.data)
          setForm({ email: data.data.email || '', phone: data.data.phone || '' })
        } else {
          setPageError(data.message)
        }
      } catch (err) {
        setPageError('Failed to load profile data from server.')
      } finally {
        setLoadingData(false)
      }
    }
    fetchProfile()
  }, [])

  // ── 2. SAVE PERSONAL INFO ──
  async function handleSavePersonal() {
    setErrors({}); setSuccess('')
    let newErrors = {}

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(form.email)) newErrors.email = "Please enter a valid email address."
    if (!form.phone || form.phone.length < 9) newErrors.phone = "Must be a valid Kenyan number."

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors); return
    }

    setSaving(true) //  Turn spinner ON
    try {
      const res = await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ email: form.email, phone: form.phone })
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.message)

      setDbProfile(data.data) // Update local view with new DB values
      setEditing(false)
      setSuccess('Personal information updated successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setErrors({ form: err.message })
    } finally {
      setSaving(false) //  Turn spinner OFF
    }
  }

  // ── 3. SAVE NEW PASSWORD ──
  async function handleSavePassword(e) {
    e.preventDefault()
    setErrors({}); setSuccess('')
    let newErrors = {}

    if (!pwdForm.current) newErrors.current = "Current password is required."
    if (pwdForm.new.length < 8) newErrors.new = "Password must be at least 8 characters."
    if (pwdForm.new !== pwdForm.confirm) newErrors.confirm = "New passwords do not match."

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors); return
    }

    setSavingPwd(true) //  Turn spinner ON
    try {
      const res = await fetch(`${API_URL}/profile/password`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ currentPassword: pwdForm.current, newPassword: pwdForm.new })
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.message)

      setPwdForm({ current: '', new: '', confirm: '' })
      setSuccess('Password changed successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setErrors({ current: err.message })
    } finally {
      setSavingPwd(false) //  Turn spinner OFF
    }
  }

  // ============================================================================
  // SKELETON LOADER
  // ============================================================================
  if (loadingData) {
    return (
      <div className="tenant-profile">
        <div className="profile-header">
          <div className="skeleton skeleton-title" style={{ width: '25%', marginBottom: '0.5rem' }}></div>
          <div className="skeleton skeleton-text" style={{ width: '35%' }}></div>
        </div>

        <div className="profile-container">
          <div className="profile-info-card">
            {/* Skeleton Tabs */}
            <div className="profile-tabs" style={{ display: 'flex', gap: '1px', background: 'var(--slate-200)' }}>
              <div className="skeleton" style={{ flex: 1, height: '3.5rem', borderRadius: 0 }}></div>
              <div className="skeleton" style={{ flex: 1, height: '3.5rem', borderRadius: 0 }}></div>
            </div>

            {/* Skeleton Form Fields */}
            <div className="profile-tab-content" style={{ padding: '1.5rem 2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <div className="skeleton skeleton-title" style={{ width: '30%', margin: 0 }}></div>
                <div className="skeleton" style={{ width: '120px', height: '2.5rem', borderRadius: '10px' }}></div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div className="skeleton skeleton-text" style={{ width: '20%' }}></div>
                    <div className="skeleton" style={{ width: '100%', height: '3rem', borderRadius: '10px' }}></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="tenant-profile">

      <div className="profile-header">
        <h2 className="profile-title">My Profile</h2>
        <p className="profile-sub">Manage your account settings</p>
      </div>

      <div className="profile-container">

        {pageError && <div style={{ color: 'red', marginBottom: '1rem' }}>{pageError}</div>}

        <div className="profile-info-card">
          <div className="profile-tabs">
            <button className={`profile-tab ${activeTab === 'personal' ? 'active' : ''}`} onClick={() => { setActiveTab('personal'); setErrors({}); setSuccess(''); }}>
              <i className="fas fa-user-circle" /> Personal Information
            </button>
            <button className={`profile-tab ${activeTab === 'password' ? 'active' : ''}`} onClick={() => { setActiveTab('password'); setErrors({}); setSuccess(''); }}>
              <i className="fas fa-lock" /> Change Password
            </button>
          </div>

          {success && <div className="profile-success-banner"><i className="fas fa-check-circle" /> {success}</div>}
          {errors.form && <div className="profile-success-banner" style={{background:'#fee2e2', color:'#ef4444'}}><i className="fas fa-exclamation-circle" /> {errors.form}</div>}

          {/* TAB 1: PERSONAL INFORMATION */}
          {activeTab === 'personal' && (
            <div className="profile-tab-content animation-fade-in">
              <div className="profile-info-header">
                <h3 className="profile-info-title">Contact Details</h3>
                {!editing ? (
                  <button className="profile-edit-btn" onClick={() => setEditing(true)}>
                    <i className="fas fa-edit" /> Edit Details
                  </button>
                ) : (
                  <div className="profile-edit-actions">
                    <button className="btn-cancel-sm" onClick={() => { setEditing(false); setErrors({}); setForm({ email: dbProfile?.email, phone: dbProfile?.phone }); }} disabled={saving}>Cancel</button>
                    {/*  Swapped Button */}
                    <SubmitButton 
                      onClick={handleSavePersonal} 
                      isSubmitting={saving} 
                      text="Save Changes" 
                      loadingText="Saving..." 
                      className="btn-save"
                    />
                  </div>
                )}
              </div>

              <div className="profile-fields">
                <div className="profile-field">
                  <label className="profile-field-label"><i className="fas fa-user" /> Full Name</label>
                  <span className="profile-field-value readonly-text">{dbProfile?.first_name} {dbProfile?.last_name} <i className="fas fa-lock lock-icon" title="Cannot edit name"></i></span>
                </div>
                
                {/*  FIXED: Looking for id_number instead of national_id */}
                <div className="profile-field">
                  <label className="profile-field-label"><i className="fas fa-id-card" /> ID Number</label>
                  <span className="profile-field-value readonly-text profile-id">{dbProfile?.id_number || 'N/A'} <i className="fas fa-lock lock-icon" title="Cannot edit ID"></i></span>
                </div>

                <div className="profile-field">
                  <label className="profile-field-label"><i className="fas fa-envelope" /> Email Address</label>
                  {editing ? (
                    <>
                      <input className={`profile-input ${errors.email ? 'input-error' : ''}`} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={saving} />
                      {errors.email && <span className="form-error-msg">{errors.email}</span>}
                    </>
                  ) : (
                    <span className="profile-field-value">{dbProfile?.email || 'N/A'}</span>
                  )}
                </div>

                <div className="profile-field">
                  <label className="profile-field-label"><i className="fas fa-phone" /> Phone Number</label>
                  {editing ? (
                    <>
                      <input className={`profile-input ${errors.phone ? 'input-error' : ''}`} type="tel" value={form.phone} placeholder="+254 7XX XXX XXX" onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} disabled={saving} />
                      {errors.phone && <span className="form-error-msg">{errors.phone}</span>}
                    </>
                  ) : (
                    <span className="profile-field-value">{dbProfile?.phone || 'N/A'}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CHANGE PASSWORD */}
          {activeTab === 'password' && (
            <div className="profile-tab-content animation-fade-in">
              <div className="profile-info-header"><h3 className="profile-info-title">Security</h3></div>
              <form className="profile-fields" onSubmit={handleSavePassword}>
                <div className="profile-field">
                  <label className="profile-field-label">Current Password</label>
                  <input className={`profile-input ${errors.current ? 'input-error' : ''}`} type="password" value={pwdForm.current} onChange={e => setPwdForm(f => ({ ...f, current: e.target.value }))} placeholder="Enter current password" disabled={savingPwd} />
                  {errors.current && <span className="form-error-msg">{errors.current}</span>}
                </div>
                
                <div className="profile-field">
                  <label className="profile-field-label">New Password</label>
                  <input className={`profile-input ${errors.new ? 'input-error' : ''}`} type="password" value={pwdForm.new} onChange={e => setPwdForm(f => ({ ...f, new: e.target.value }))} placeholder="Min 8 characters" disabled={savingPwd} />
                  {errors.new && <span className="form-error-msg">{errors.new}</span>}
                </div>

                <div className="profile-field">
                  <label className="profile-field-label">Confirm New Password</label>
                  <input className={`profile-input ${errors.confirm ? 'input-error' : ''}`} type="password" value={pwdForm.confirm} onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))} placeholder="Retype new password" disabled={savingPwd} />
                  {errors.confirm && <span className="form-error-msg">{errors.confirm}</span>}
                </div>

                <div style={{ marginTop: '1rem' }}>
                  {/*  Swapped Button */}
                  <SubmitButton 
                    type="submit" 
                    isSubmitting={savingPwd} 
                    text="Update Password" 
                    loadingText="Updating Security..." 
                    className="btn-save"
                    style={{ padding: '0.875rem 2rem' }}
                  />
                </div>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}