import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import './TenantProfile.css'

const API_URL = 'import.meta.env.VITE_API_URL'

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

    setSaving(true)
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
      setSaving(false)
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

    setSavingPwd(true)
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
      setSavingPwd(false)
    }
  }

  if (loadingData) return <div className="tenant-profile" style={{padding: '2rem'}}>Loading profile...</div>

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
                    <button className="btn-cancel-sm" onClick={() => { setEditing(false); setErrors({}); setForm({ email: dbProfile?.email, phone: dbProfile?.phone }); }}>Cancel</button>
                    <button className="btn-save" onClick={handleSavePersonal} disabled={saving}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                )}
              </div>

              <div className="profile-fields">
                <div className="profile-field">
                  <label className="profile-field-label"><i className="fas fa-user" /> Full Name</label>
                  <span className="profile-field-value readonly-text">{dbProfile?.first_name} {dbProfile?.last_name} <i className="fas fa-lock lock-icon" title="Cannot edit name"></i></span>
                </div>
                
                {/* ✅ FIXED: Looking for id_number instead of national_id */}
                <div className="profile-field">
                  <label className="profile-field-label"><i className="fas fa-id-card" /> ID Number</label>
                  <span className="profile-field-value readonly-text profile-id">{dbProfile?.id_number || 'N/A'} <i className="fas fa-lock lock-icon" title="Cannot edit ID"></i></span>
                </div>

                <div className="profile-field">
                  <label className="profile-field-label"><i className="fas fa-envelope" /> Email Address</label>
                  {editing ? (
                    <>
                      <input className={`profile-input ${errors.email ? 'input-error' : ''}`} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
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
                      <input className={`profile-input ${errors.phone ? 'input-error' : ''}`} type="tel" value={form.phone} placeholder="+254 7XX XXX XXX" onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
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
                  <input className={`profile-input ${errors.current ? 'input-error' : ''}`} type="password" value={pwdForm.current} onChange={e => setPwdForm(f => ({ ...f, current: e.target.value }))} placeholder="Enter current password" />
                  {errors.current && <span className="form-error-msg">{errors.current}</span>}
                </div>
                
                <div className="profile-field">
                  <label className="profile-field-label">New Password</label>
                  <input className={`profile-input ${errors.new ? 'input-error' : ''}`} type="password" value={pwdForm.new} onChange={e => setPwdForm(f => ({ ...f, new: e.target.value }))} placeholder="Min 8 characters" />
                  {errors.new && <span className="form-error-msg">{errors.new}</span>}
                </div>

                <div className="profile-field">
                  <label className="profile-field-label">Confirm New Password</label>
                  <input className={`profile-input ${errors.confirm ? 'input-error' : ''}`} type="password" value={pwdForm.confirm} onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))} placeholder="Retype new password" />
                  {errors.confirm && <span className="form-error-msg">{errors.confirm}</span>}
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <button type="submit" className="btn-save" style={{ padding: '0.875rem 2rem' }} disabled={savingPwd}>
                    {savingPwd ? 'Updating Security...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}