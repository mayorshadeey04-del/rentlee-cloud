import { useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../context/AuthContext'
import Toast from '../../components/Toast'
import './Profile.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const TABS_LANDLORD  = ['profile', 'password', 'email']
const TABS_CARETAKER = ['password']

const TAB_LABELS = {
  profile:  'Profile',
  password: 'Change Password',
  email:    'Change Email',
}

// ── Password strength helper ──────────────────────────────────────────────────
function getStrength(pw) {
  if (!pw)         return null
  if (pw.length < 6)  return { level: 1, label: 'Too short', color: '#e11d48' }
  if (pw.length < 8)  return { level: 2, label: 'Weak',      color: '#f97316' }
  if (pw.length < 12) return { level: 3, label: 'Good',      color: '#eab308' }
  return               { level: 4, label: 'Strong',   color: '#22c55e' }
}

// ── Password input with show/hide toggle ──────────────────────────────────────
function PasswordField({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false)
  return (
    <div className="pw-field-wrap">
      <input
        className="form-input"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
      <button
        type="button"
        className="pw-toggle"
        onClick={() => setShow(s => !s)}
        tabIndex={-1}
      >
        <i className={show ? 'fas fa-eye-slash' : 'fas fa-eye'} />
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Profile() {
  const { user } = useAuth()
  const isLandlord    = user?.role === 'landlord'
  const availableTabs = isLandlord ? TABS_LANDLORD : TABS_CARETAKER

  const [activeTab, setActiveTab] = useState(availableTabs[0])
  const [toasts, setToasts]       = useState([])

  // State to toggle between Read-Only and Edit Mode
  const [isEditingProfile, setIsEditingProfile] = useState(false)

  // Loading states for buttons
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [loadingPassword, setLoadingPassword] = useState(false)
  const [loadingEmail, setLoadingEmail] = useState(false)
  const [loadingVerify, setLoadingVerify] = useState(false)

  // ── Helper: Get Auth Token ────────────────────────────────────────────────
  const getAuthHeaders = useCallback(() => {
    const token = user?.token || localStorage.getItem('rentlee_token')
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, [user])

  function showToast(type, title, message) {
    const id = Date.now()
    setToasts(t => [...t, { id, type, title, message }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }

  // ── Profile form ──────────────────────────────────────────────────────────
  const [profile, setProfile] = useState({
    firstName: user?.first_name || user?.firstName || user?.name?.split(' ')[0] || '',
    lastName:  user?.last_name || user?.lastName || user?.name?.split(' ').slice(1).join(' ') || '',
    phone:     user?.phone || '',
  })
  const [profileError, setProfileError] = useState('')

  // Initial quick load
  useEffect(() => {
    if (user) {
      setProfile(prev => ({
        firstName: user.first_name || user.firstName || user.name?.split(' ')[0] || prev.firstName,
        lastName:  user.last_name || user.lastName || user.name?.split(' ').slice(1).join(' ') || prev.lastName,
        phone:     user.phone || prev.phone
      }))
    }
  }, [user])

  // Fetch the absolute truth from the database!
  useEffect(() => {
    const fetchFreshData = async () => {
      try {
        const res = await fetch(`${API_URL}/signin/me`, { headers: getAuthHeaders() });
        const dbData = await res.json();
        
        if (dbData.success && dbData.data) {
          setProfile({
            firstName: dbData.data.firstName || dbData.data.first_name || '',
            lastName:  dbData.data.lastName || dbData.data.last_name || '',
            phone:     dbData.data.phone || ''
          });
          
          const currentUserData = JSON.parse(localStorage.getItem('rentlee_user') || '{}');
          if (!currentUserData.phone && dbData.data.phone) {
            localStorage.setItem('rentlee_user', JSON.stringify({ 
               ...currentUserData, 
               phone: dbData.data.phone 
            }));
          }
        }
      } catch (error) {
        console.error("Could not fetch fresh profile data:", error);
      }
    };

    fetchFreshData();
  }, [getAuthHeaders]);

  // Handle Cancel Edit
  function handleCancelEdit() {
    setIsEditingProfile(false)
    setProfileError('')
    // Reset form to original context data so unsaved typing is discarded
    setProfile({
      firstName: user.first_name || user.firstName || user.name?.split(' ')[0] || '',
      lastName:  user.last_name || user.lastName || user.name?.split(' ').slice(1).join(' ') || '',
      phone:     user.phone || ''
    })
  }

  async function submitProfile() {
    if (!profile.firstName || !profile.lastName) {
      setProfileError('First name and last name are required.')
      return
    }

    if (!profile.phone || profile.phone.length !== 10) {
      setProfileError('Phone number is required and must be exactly 10 digits.')
      return
    }
    
    setLoadingProfile(true)
    try {
      const res = await fetch(`${API_URL}/signin/profile`, { 
        method: 'PUT', 
        headers: getAuthHeaders(), 
        body: JSON.stringify(profile) 
      })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.message || 'Failed to update profile')
      
      const currentUserData = JSON.parse(localStorage.getItem('rentlee_user') || '{}');
      const updatedUserData = {
        ...currentUserData,
        firstName: data.data.first_name,
        lastName: data.data.last_name,
        name: `${data.data.first_name} ${data.data.last_name}`, 
        phone: data.data.phone
      };
      localStorage.setItem('rentlee_user', JSON.stringify(updatedUserData));

      setProfileError('')
      setIsEditingProfile(false) // Close edit mode automatically
      showToast('success', 'Profile Updated', 'Your profile has been updated successfully.')

      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error) {
      setProfileError(error.message)
    } finally {
      setLoadingProfile(false)
    }
  }

  // ── Password form ─────────────────────────────────────────────────────────
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const strength = getStrength(pwForm.newPw)
  const confirmMismatch = pwForm.confirm.length > 0 && pwForm.confirm !== pwForm.newPw

  async function submitPassword() {
    if (!pwForm.current || !pwForm.newPw || !pwForm.confirm) {
      setPwError('Please fill in all fields.')
      return
    }
    if (pwForm.newPw.length < 8) {
      setPwError('New password must be at least 8 characters long.')
      return
    }
    if (pwForm.newPw !== pwForm.confirm) {
      setPwError('Passwords do not match.')
      return
    }

    setLoadingPassword(true)
    try {
      const res = await fetch(`${API_URL}/signin/password`, { 
        method: 'PUT', 
        headers: getAuthHeaders(), 
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.newPw }) 
      })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.message || 'Failed to change password')

      setPwError('')
      setPwForm({ current: '', newPw: '', confirm: '' })
      showToast('success', 'Password Changed', 'Your password has been changed successfully.')
    } catch (error) {
      setPwError(error.message)
    } finally {
      setLoadingPassword(false)
    }
  }

  // ── Email form ────────────────────────────────────────────────────────────
  const [emailForm, setEmailForm] = useState({ currentEmail: '', newEmail: '' })
  const [emailError, setEmailError] = useState('')
  const [showVerify, setShowVerify]     = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')
  const [code, setCode]                 = useState('')
  const [codeError, setCodeError]       = useState('')

  async function submitEmailChange() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailForm.currentEmail || !emailForm.newEmail) {
      setEmailError('Please fill in all fields.')
      return
    }
    if (!emailRegex.test(emailForm.currentEmail)) {
      setEmailError('Current email address is not valid.')
      return
    }
    if (!emailRegex.test(emailForm.newEmail)) {
      setEmailError('New email address is not valid.')
      return
    }
    if (emailForm.currentEmail === emailForm.newEmail) {
      setEmailError('New email must be different from your current email.')
      return
    }
    
    setLoadingEmail(true)
    try {
      const res = await fetch(`${API_URL}/signin/change-email`, { 
        method: 'POST', 
        headers: getAuthHeaders(), 
        body: JSON.stringify({ currentEmail: emailForm.currentEmail, newEmail: emailForm.newEmail }) 
      })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.message || 'Failed to request email change')

      setEmailError('')
      setPendingEmail(emailForm.newEmail)
      setCode('')
      setCodeError('')
      setShowVerify(true)
    } catch (error) {
      setEmailError(error.message)
    } finally {
      setLoadingEmail(false)
    }
  }

  async function submitVerification() {
    if (!code || code.length < 6) {
      setCodeError('Please enter the full 6-digit code.')
      return
    }

    setLoadingVerify(true)
    try {
      const res = await fetch(`${API_URL}/signin/verify-email-change`, { 
        method: 'POST', 
        headers: getAuthHeaders(), 
        body: JSON.stringify({ code })
      })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.message || 'Failed to verify email')

      const currentUserData = JSON.parse(localStorage.getItem('rentlee_user') || '{}');
      const updatedUserData = {
        ...currentUserData,
        email: pendingEmail
      };
      localStorage.setItem('rentlee_user', JSON.stringify(updatedUserData));

      setShowVerify(false)
      setEmailForm({ currentEmail: '', newEmail: '' })
      setPendingEmail('')
      setCode('')
      showToast('success', 'Email Updated', 'Email verified and updated successfully!')
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error) {
      setCodeError(error.message)
    } finally {
      setLoadingVerify(false)
    }
  }

  // ── Shared modal styles ───────────────────────────────────────────────────
  const overlayStyle = {
    position: 'fixed', top: 0, left: 0,
    width: '100vw', height: '100vh',
    background: 'rgba(10,22,40,0.45)',
    zIndex: 9999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '2rem', boxSizing: 'border-box'
  }
  const contentStyle = {
    background: '#fff', borderRadius: '24px',
    width: '90%', maxWidth: '480px',
    boxShadow: '0 8px 48px rgba(10,22,40,0.18)',
    overflow: 'hidden', position: 'relative',
    marginTop: '1rem'
  }
  const headerStyle = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '1.5rem 2rem', borderBottom: '1.5px solid #f1f5f9'
  }
  const closeStyle = {
    width: '34px', height: '34px', borderRadius: '50%',
    border: '1.5px solid #e2e8f0', background: '#fff',
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '0.875rem', flexShrink: 0
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="profile-page">

      <Toast toasts={toasts} />

      <h2 className="page-title">My Profile</h2>
      <div className="breadcrumb">
        <a href="/management/dashboard">Dashboard</a> › Profile › My Profile
      </div>

      <div className="profile-container">

        <div className="profile-tabs">
          {availableTabs.map(tab => (
            <button
              key={tab}
              className={`profile-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* ── Profile tab (New Contact Details Card) ────────────────────────────────── */}
        {activeTab === 'profile' && (
          <div className="contact-details-card">
            
            {/* Header with toggle buttons */}
            <div className="card-header">
              <h3 className="card-title">Contact Details</h3>
              
              {!isEditingProfile ? (
                <button className="btn-edit" onClick={() => setIsEditingProfile(true)}>
                  <i className="fas fa-edit" /> Edit Details
                </button>
              ) : (
                <div className="header-actions">
                  <button className="btn-cancel" onClick={handleCancelEdit}>Cancel</button>
                  <button 
                    className="btn-primary" 
                    onClick={submitProfile}
                    disabled={loadingProfile}
                  >
                    {loadingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>

            <div className="card-body">
              {profileError && <p className="form-error">{profileError}</p>}
              
              <div className="form-row">
                {/* First Name */}
                <div className="form-group">
                  <label className="form-label">
                    <i className="fas fa-user field-icon" /> First Name
                  </label>
                  <div className="input-wrapper">
                    <input 
                      className={`form-input ${!isEditingProfile ? 'readonly' : ''}`}
                      value={profile.firstName} 
                      placeholder="First Name"
                      readOnly={!isEditingProfile}
                      onChange={e => { 
                        setProfileError(''); 
                        const val = e.target.value.replace(/[^a-zA-Z\s]/g, '');
                        setProfile(p => ({ ...p, firstName: val })) 
                      }} 
                    />
                    {!isEditingProfile && <i className="fas fa-lock lock-icon" />}
                  </div>
                </div>
                
                {/* Last Name */}
                <div className="form-group">
                  <label className="form-label">
                    <i className="fas fa-user field-icon" /> Last Name
                  </label>
                  <div className="input-wrapper">
                    <input 
                      className={`form-input ${!isEditingProfile ? 'readonly' : ''}`}
                      value={profile.lastName} 
                      placeholder="Last Name"
                      readOnly={!isEditingProfile}
                      onChange={e => { 
                        setProfileError(''); 
                        const val = e.target.value.replace(/[^a-zA-Z\s]/g, '');
                        setProfile(p => ({ ...p, lastName: val })) 
                      }} 
                    />
                    {!isEditingProfile && <i className="fas fa-lock lock-icon" />}
                  </div>
                </div>
              </div>

              {/* Email (Always locked here) */}
              <div className="form-group">
                <label className="form-label">
                  <i className="fas fa-envelope field-icon" /> Email Address
                </label>
                <div className="input-wrapper">
                  <input 
                    className="form-input readonly" 
                    type="email" 
                    value={user?.email || ''} 
                    readOnly 
                  />
                  <i className="fas fa-lock lock-icon" />
                </div>
              </div>

              {/* Phone Number */}
              <div className="form-group">
                <label className="form-label">
                  <i className="fas fa-phone field-icon" /> Phone Number
                </label>
                <div className="input-wrapper">
                  <input 
                    className={`form-input ${!isEditingProfile ? 'readonly' : ''}`}
                    type="tel" 
                    value={profile.phone} 
                    placeholder="0712345678"
                    readOnly={!isEditingProfile}
                    onChange={e => {
                      setProfileError('');
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setProfile(p => ({ ...p, phone: val }))
                    }} 
                  />
                  {!isEditingProfile && <i className="fas fa-lock lock-icon" />}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ── Change Password tab ─────────────────────────── */}
        {activeTab === 'password' && (
          <div className="form-section">
            <div className="section-title"><i className="fas fa-lock" /> Change Password</div>
            {pwError && <p className="form-error">{pwError}</p>}

            <div className="form-group">
              <label className="form-label">Current Password <span className="required">*</span></label>
              <PasswordField
                value={pwForm.current}
                placeholder="Enter current password"
                onChange={e => { setPwError(''); setPwForm(f => ({ ...f, current: e.target.value })) }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">New Password <span className="required">*</span></label>
              <PasswordField
                value={pwForm.newPw}
                placeholder="Enter new password"
                onChange={e => { setPwError(''); setPwForm(f => ({ ...f, newPw: e.target.value })) }}
              />
              {pwForm.newPw && strength && (
                <div className="pw-strength">
                  <div className="pw-strength-bars">
                    {[1, 2, 3, 4].map(n => (
                      <div key={n} className="pw-strength-bar"
                        style={{ background: n <= strength.level ? strength.color : 'var(--slate-200)' }} />
                    ))}
                  </div>
                  <span className="pw-strength-label" style={{ color: strength.color }}>
                    {strength.label}
                  </span>
                </div>
              )}
              {!pwForm.newPw && <p className="field-hint">Password must be at least 8 characters long</p>}
            </div>

            <div className="form-group">
              <label className="form-label">Confirm New Password <span className="required">*</span></label>
              <PasswordField
                value={pwForm.confirm}
                placeholder="Confirm new password"
                onChange={e => { setPwError(''); setPwForm(f => ({ ...f, confirm: e.target.value })) }}
              />
              {pwForm.confirm.length > 0 && (
                confirmMismatch
                  ? <p className="field-hint error"><i className="fas fa-times-circle" /> Passwords do not match</p>
                  : <p className="field-hint success"><i className="fas fa-check-circle" /> Passwords match</p>
              )}
            </div>

            <div className="form-actions">
              <button 
                className="btn-primary" 
                onClick={submitPassword}
                disabled={loadingPassword}
              >
                {loadingPassword ? 'Updating...' : 'Change Password'}
              </button>
            </div>
          </div>
        )}

        {/* ── Change Email tab ────────────────────────────── */}
        {activeTab === 'email' && (
          <div className="form-section">
            <div className="section-title"><i className="fas fa-envelope" /> Change Email</div>
            {emailError && <p className="form-error">{emailError}</p>}

            <div className="form-group">
              <label className="form-label">Current Email <span className="required">*</span></label>
              <input className="form-input" type="email" value={emailForm.currentEmail}
                placeholder="Enter your current email"
                onChange={e => { setEmailError(''); setEmailForm(f => ({ ...f, currentEmail: e.target.value })) }} />
            </div>

            <div className="form-group">
              <label className="form-label">New Email <span className="required">*</span></label>
              <input className="form-input" type="email" value={emailForm.newEmail}
                placeholder="Enter new email address"
                onChange={e => { setEmailError(''); setEmailForm(f => ({ ...f, newEmail: e.target.value })) }} />
              <p className="field-hint">A verification code will be sent to your new email</p>
            </div>

            <div className="form-actions">
              <button 
                className="btn-primary" 
                onClick={submitEmailChange}
                disabled={loadingEmail}
              >
                {loadingEmail ? 'Sending Code...' : 'Change Email'}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── Verification modal ──────────────────────────── */}
      {showVerify && createPortal(
        <div style={overlayStyle} onClick={() => setShowVerify(false)}>
          <div style={contentStyle} onClick={e => e.stopPropagation()}>
            <div style={headerStyle}>
              <h3 className="modal-title">Verify New Email</h3>
              <button style={closeStyle} onClick={() => setShowVerify(false)}>
                <i className="fas fa-times" />
              </button>
            </div>
            <div className="modal-body">
              <div className="verify-icon-wrap">
                <div className="verify-icon"><i className="fas fa-envelope-open-text" /></div>
              </div>
              <p className="verify-message">A 6-digit verification code has been sent to</p>
              <p className="verify-email">{pendingEmail}</p>
              <p className="verify-sub">Enter the code below to confirm your new email address.</p>
              {codeError && <p className="form-error">{codeError}</p>}
              <div className="form-group">
                <label className="form-label">Verification Code <span className="required">*</span></label>
                <input
                  className="form-input code-input"
                  value={code}
                  onChange={e => { setCodeError(''); setCode(e.target.value.replace(/\D/g, '').slice(0, 6)) }}
                  placeholder="000000"
                  maxLength={6}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowVerify(false)}>Cancel</button>
              <button 
                className="btn-submit" 
                onClick={submitVerification}
                disabled={loadingVerify}
              >
                {loadingVerify ? 'Verifying...' : 'Verify & Confirm'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

    </div>
  )
}