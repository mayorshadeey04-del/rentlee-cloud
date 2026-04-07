import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../context/AuthContext'
import Toast from '../../components/Toast'
import ConfirmDialog from '../../components/ConfirmDialog'
import './Settings.css'

const EMPTY_CARETAKER = { firstName: '', lastName: '', email: '', phone: '' }
const EMPTY_ASSIGN    = { propertyId: '', caretakerId: '' }

const TABS = [
  { key: 'caretakers',   label: 'User Roles',          icon: 'fas fa-user-shield' },
  { key: 'assignments',  label: 'Assign Properties',   icon: 'fas fa-building'    },
]

// Adjust this if your backend is hosted on a different port!
const API_URL = 'import.meta.env.VITE_API_URL' 

export default function Settings() {
  const { user } = useAuth()
  const [activeTab, setActiveTab]       = useState('caretakers')
  const [caretakers, setCaretakers]     = useState([])
  const [assignments, setAssignments]   = useState([])
  const [properties, setProperties]     = useState([])
  const [loading, setLoading]           = useState(true)
  const [toasts, setToasts]             = useState([])
  const [confirm, setConfirm]           = useState(null)

  // Add caretaker modal
  const [showAdd, setShowAdd]   = useState(false)
  const [addForm, setAddForm]   = useState(EMPTY_CARETAKER)
  const [addError, setAddError] = useState('')

  // Edit caretaker modal
  const [showEdit, setShowEdit]     = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm]     = useState(EMPTY_CARETAKER)
  const [editError, setEditError]   = useState('')

  // Assign property modal
  const [showAssign, setShowAssign]   = useState(false)
  const [assignForm, setAssignForm]   = useState(EMPTY_ASSIGN)
  const [assignError, setAssignError] = useState('')

  // ── Helper: Get Auth Token ────────────────────────────────────────────────
  const getAuthHeaders = useCallback(() => {
    const token = user?.token || localStorage.getItem('rentlee_token')
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, [user])

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showToast = useCallback((type, title, message) => {
    const id = Date.now()
    setToasts(t => [...t, { id, type, title, message }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }, [])

  // ── Fetch Initial Data ────────────────────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const headers = getAuthHeaders()

        // Fetch Caretakers and Properties from real backend
        const [cRes, pRes] = await Promise.all([
          fetch(`${API_URL}/caretakers`, { headers }),
          fetch(`${API_URL}/properties`, { headers })
        ])

        if (cRes.ok) {
          const cData = await cRes.json()
          setCaretakers(cData.data || [])
          
          // ✅ Extract real assignments from the caretaker data!
          const realAssignments = [];
          (cData.data || []).forEach(ct => {
            if (ct.properties && Array.isArray(ct.properties)) {
              ct.properties.forEach(p => {
                if (p.status === 'active') {
                  realAssignments.push({
                    id: `${ct.id}-${p.propertyId}`, // Unique ID for React map
                    propertyId: p.propertyId,
                    propertyName: p.propertyName,
                    caretakerId: ct.id,
                    caretakerName: `${ct.first_name || ct.firstName} ${ct.last_name || ct.lastName}`,
                    caretakerPhone: ct.phone
                  });
                }
              });
            }
          });
          setAssignments(realAssignments);
        }

        if (pRes.ok) {
          const pData = await pRes.json()
          setProperties(pData.data || [])
        }

      } catch (error) {
        console.error("Failed to load settings data:", error)
        showToast('error', 'Connection Error', 'Could not load data from the server.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [getAuthHeaders, showToast])

  // ── Add Caretaker ─────────────────────────────────────────────────────────────
  async function submitAdd() {
    if (!addForm.firstName || !addForm.lastName || !addForm.email || !addForm.phone) {
      setAddError('Please fill in all required fields.')
      return
    }
    
    try {
      const res = await fetch(`${API_URL}/caretakers`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(addForm)
      })
      
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.message || 'Failed to create caretaker')

      setCaretakers(c => [{ ...data.data, status: 'pending' }, ...c])
      setShowAdd(false)
      setAddForm(EMPTY_CARETAKER)
      showToast('success', 'Caretaker Added', `${addForm.firstName} ${addForm.lastName} has been added and sent a setup email.`)
    } catch (error) {
      setAddError(error.message)
    }
  }

  // ── Edit Caretaker ────────────────────────────────────────────────────────────
  function openEdit(caretaker) {
    setEditTarget(caretaker)
    setEditForm({ 
      firstName: caretaker.first_name || caretaker.firstName, 
      lastName: caretaker.last_name || caretaker.lastName, 
      email: caretaker.email, 
      phone: caretaker.phone 
    })
    setEditError('')
    setShowEdit(true)
  }

  async function submitEdit() {
    if (!editForm.firstName || !editForm.lastName || !editForm.email || !editForm.phone) {
      setEditError('Please fill in all required fields.')
      return
    }
    
    try {
      const res = await fetch(`${API_URL}/caretakers/${editTarget.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(editForm)
      })
      
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.message || 'Failed to update caretaker')

      setCaretakers(c => c.map(ct => ct.id === editTarget.id ? { ...ct, ...data.data } : ct))
      setShowEdit(false)
      showToast('success', 'Caretaker Updated', `${editForm.firstName} has been updated successfully.`)
    } catch (error) {
      setEditError(error.message)
    }
  }

  // ── Delete Caretaker (Two-Stage) ──────────────────────────────────────────────
  function deleteCaretaker(id) {
    const ct = caretakers.find(c => c.id === id)
    const isInactive = ct?.status?.toLowerCase() === 'inactive'
    const name = ct?.first_name || ct?.firstName || 'User'
    
    setConfirm({
      id,
      type: 'caretaker',
      title: isInactive ? 'Permanent Delete Caretaker' : 'Deactivate Caretaker',
      message: isInactive 
        ? `This will PERMANENTLY erase "${name}" from the database. This action cannot be undone.`
        : `This will deactivate "${name}" and immediately revoke all their property access. They will remain in your list as inactive.`
    })
  }

  async function confirmDeleteCaretaker(id) {
    const ct = caretakers.find(c => c.id === id)
    const isInactive = ct?.status?.toLowerCase() === 'inactive'
    const name = ct?.first_name || ct?.firstName || 'User'

    try {
      const res = await fetch(`${API_URL}/caretakers/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders() 
      })
      
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.message || 'Failed to delete caretaker')
      
      if (isInactive) {
        // STAGE 2: Permanent Delete
        setCaretakers(c => c.filter(ct => ct.id !== id))
        setAssignments(a => a.filter(asgn => asgn.caretakerId !== id))
        showToast('success', 'Caretaker Erased', `${name} has been permanently removed.`)
      } else {
        // STAGE 1: Soft Delete
        setCaretakers(c => c.map(ct => ct.id === id ? { ...ct, status: 'inactive' } : ct))
        setAssignments(a => a.filter(asgn => asgn.caretakerId !== id))
        showToast('success', 'Caretaker Deactivated', `${name} has been deactivated.`)
      }
    } catch (error) {
      showToast('error', 'Deletion Failed', error.message)
    }
  }

  // ── Assign Property (REAL API CONNECTED) ─────────────────────────────────────
  async function submitAssign() {
    if (!assignForm.propertyId || !assignForm.caretakerId) {
      setAssignError('Please select both a property and a caretaker.')
      return
    }
    
    // Find all properties currently assigned to this caretaker
    const currentPropertyIds = assignments
      .filter(a => String(a.caretakerId) === String(assignForm.caretakerId))
      .map(a => a.propertyId);
      
    // Add the new one (using Set to prevent duplicates)
    const newPropertyIds = [...new Set([...currentPropertyIds, assignForm.propertyId])];

    try {
      const res = await fetch(`${API_URL}/caretakers/${assignForm.caretakerId}/properties`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ propertyIds: newPropertyIds })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to assign property');

      // Update UI locally
      const prop = properties.find(p => String(p.id) === String(assignForm.propertyId))
      const care = caretakers.find(c => String(c.id) === String(assignForm.caretakerId))
      
      const created = {
        id: `${assignForm.caretakerId}-${assignForm.propertyId}`,
        propertyId: assignForm.propertyId,
        propertyName: prop?.name || 'Unknown Property',
        caretakerId: assignForm.caretakerId,
        caretakerName: care ? `${care.first_name || care.firstName} ${care.last_name || care.lastName}` : '',
        caretakerPhone: care?.phone || '',
      }
      
      setAssignments(a => [...a, created])
      setShowAssign(false)
      setAssignForm(EMPTY_ASSIGN)
      showToast('success', 'Assignment Created', `${prop?.name} assigned to caretaker.`)
      
    } catch(error) {
      setAssignError(error.message);
    }
  }

  function deleteAssignment(id) {
    const asgn = assignments.find(a => a.id === id)
    setConfirm({
      id,
      type: 'assignment',
      title: 'Remove Assignment',
      message: `This will remove the assignment of "${asgn?.propertyName}" from "${asgn?.caretakerName}".`
    })
  }

  async function confirmDeleteAssignment(id) {
    const asgn = assignments.find(a => a.id === id)
    if (!asgn) return;

    // Filter out the deleted property to get the remaining ones
    const remainingPropertyIds = assignments
      .filter(a => String(a.caretakerId) === String(asgn.caretakerId) && a.id !== id)
      .map(a => a.propertyId);

    try {
      const res = await fetch(`${API_URL}/caretakers/${asgn.caretakerId}/properties`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ propertyIds: remainingPropertyIds })
      });
      
      if (!res.ok) throw new Error('Failed to remove assignment');

      setAssignments(a => a.filter(a => a.id !== id))
      showToast('success', 'Assignment Removed', `${asgn.propertyName} has been unassigned.`)
    } catch(error) {
      showToast('error', 'Action Failed', error.message);
    }
  }

  // ── Shared modal styles ───────────────────────────────────────────────────────
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
    width: '90%', maxWidth: '560px',
    boxShadow: '0 8px 48px rgba(10,22,40,0.18)',
    position: 'relative', marginTop: '1rem',
    overflow: 'hidden'
  }
  const headerStyle = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '1.5rem 2rem', borderBottom: '1.5px solid #f1f5f9', flexShrink: 0
  }
  const closeStyle = {
    width: '34px', height: '34px', borderRadius: '50%',
    border: '1.5px solid #e2e8f0', background: '#fff',
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '0.875rem', flexShrink: 0
  }

  return (
    <div className="settings-page">
      <Toast toasts={toasts} />

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          onConfirm={() => {
            if (confirm.type === 'caretaker') confirmDeleteCaretaker(confirm.id)
            if (confirm.type === 'assignment') confirmDeleteAssignment(confirm.id)
            setConfirm(null)
          }}
          onCancel={() => setConfirm(null)}
        />
      )}

      <div className="page-header">
        <h2 className="page-title">Settings</h2>
      </div>

      <div className="settings-container">
        <div className="settings-tabs">
          {TABS.map(tab => (
            <button
              key={tab.key}
              className={`settings-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <i className={tab.icon} /> {tab.label}
            </button>
          ))}
        </div>

        <div className="settings-content">
          {/* ── Caretakers tab ───────────────────────────────── */}
          {activeTab === 'caretakers' && (
            <div>
              <div className="section-header">
                <h3 className="section-title">Caretakers</h3>
                <button className="btn-primary" onClick={() => { setAddForm(EMPTY_CARETAKER); setAddError(''); setShowAdd(true) }}>
                  <i className="fas fa-plus" /> Add Caretaker
                </button>
              </div>
              <div className="table-wrapper">
                <table className="settings-table">
                  <thead>
                    <tr>
                      <th>CARETAKER NAME</th>
                      <th>EMAIL</th>
                      <th>PHONE</th>
                      <th>STATUS</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && <tr><td colSpan="5" className="table-empty">Loading...</td></tr>}
                    {!loading && caretakers.length === 0 && (
                      <tr><td colSpan="5" className="table-empty">No caretakers yet. Click "Add Caretaker" to get started.</td></tr>
                    )}
                    {caretakers.map(ct => (
                      <tr key={ct.id}>
                        <td className="cell-bold">{ct.first_name || ct.firstName} {ct.last_name || ct.lastName}</td>
                        <td className="cell-muted">{ct.email}</td>
                        <td className="cell-muted">{ct.phone}</td>
                        <td>
                          <span className={`status-badge ${ct.status?.toLowerCase()}`}>{ct.status}</span>
                        </td>
                        <td>
                          {(() => {
                            const isInactive = ct.status?.toLowerCase() === 'inactive';
                            return (
                              <div className="action-buttons">
                                <button 
                                  className="action-btn edit-btn" 
                                  onClick={() => openEdit(ct)}
                                  disabled={isInactive}
                                  style={{ 
                                    cursor: isInactive ? 'not-allowed' : 'pointer',
                                    filter: isInactive ? 'grayscale(100%)' : 'none'
                                  }}
                                  title={isInactive ? "Cannot edit inactive caretaker" : "Edit"}
                                >
                                  <i className="fas fa-edit" />
                                </button>
                                <button 
                                  className="action-btn delete-btn" 
                                  onClick={() => deleteCaretaker(ct.id)}
                                  style={isInactive ? { backgroundColor: '#1e293b', color: '#fff' } : {}}
                                  title={isInactive ? "Permanent Delete" : "Deactivate Caretaker"}
                                >
                                  <i className={isInactive ? "fas fa-skull" : "fas fa-trash"} />
                                </button>
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Assignments tab ──────────────────────────────── */}
          {activeTab === 'assignments' && (
            <div>
              <div className="section-header">
                <h3 className="section-title">Property Assignments</h3>
                <button className="btn-primary" onClick={() => { setAssignForm(EMPTY_ASSIGN); setAssignError(''); setShowAssign(true) }}>
                  <i className="fas fa-plus" /> Assign Property
                </button>
              </div>
              <div className="table-wrapper">
                <table className="settings-table">
                  <thead>
                    <tr>
                      <th>PROPERTY</th>
                      <th>CARETAKER</th>
                      <th>PHONE</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && <tr><td colSpan="4" className="table-empty">Loading...</td></tr>}
                    {!loading && assignments.length === 0 && (
                      <tr><td colSpan="4" className="table-empty">No assignments yet. Click "Assign Property" to get started.</td></tr>
                    )}
                    {assignments.map(asgn => (
                      <tr key={asgn.id}>
                        <td className="cell-bold">{asgn.propertyName}</td>
                        <td className="cell-muted">{asgn.caretakerName}</td>
                        <td className="cell-muted">{asgn.caretakerPhone}</td>
                        <td>
                          <div className="action-buttons">
                            <button className="action-btn delete-btn" onClick={() => deleteAssignment(asgn.id)}>
                              <i className="fas fa-trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Add Caretaker Modal ─────────────────────────────────────── */}
      {showAdd && createPortal(
        <div style={overlayStyle} onClick={() => setShowAdd(false)}>
          <div style={contentStyle} onClick={e => e.stopPropagation()}>
            <div style={headerStyle}>
              <h3 className="modal-title">Add Caretaker</h3>
              <button style={closeStyle} onClick={() => setShowAdd(false)}><i className="fas fa-times" /></button>
            </div>
            <div className="modal-body">
              {addError && <p className="form-error">{addError}</p>}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">First Name <span>*</span></label>
                  <input className="form-input" value={addForm.firstName}
                    onChange={e => { setAddError(''); setAddForm(f => ({ ...f, firstName: e.target.value })) }}
                    placeholder="Enter first name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name <span>*</span></label>
                  <input className="form-input" value={addForm.lastName}
                    onChange={e => { setAddError(''); setAddForm(f => ({ ...f, lastName: e.target.value })) }}
                    placeholder="Enter last name" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email <span>*</span></label>
                <input className="form-input" type="email" value={addForm.email}
                  onChange={e => { setAddError(''); setAddForm(f => ({ ...f, email: e.target.value })) }}
                  placeholder="e.g., user@email.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number <span>*</span></label>
                <input className="form-input" type="tel" value={addForm.phone}
                  onChange={e => { setAddError(''); setAddForm(f => ({ ...f, phone: e.target.value })) }}
                  placeholder="e.g., 0712 345 678" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-submit" onClick={submitAdd}>Add Caretaker</button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ── Edit Caretaker Modal ────────────────────────────────────── */}
      {showEdit && createPortal(
        <div style={overlayStyle} onClick={() => setShowEdit(false)}>
          <div style={contentStyle} onClick={e => e.stopPropagation()}>
            <div style={headerStyle}>
              <h3 className="modal-title">Edit Caretaker</h3>
              <button style={closeStyle} onClick={() => setShowEdit(false)}><i className="fas fa-times" /></button>
            </div>
            <div className="modal-body">
              {editError && <p className="form-error">{editError}</p>}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">First Name <span>*</span></label>
                  <input className="form-input" value={editForm.firstName}
                    onChange={e => { setEditError(''); setEditForm(f => ({ ...f, firstName: e.target.value })) }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name <span>*</span></label>
                  <input className="form-input" value={editForm.lastName}
                    onChange={e => { setEditError(''); setEditForm(f => ({ ...f, lastName: e.target.value })) }} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email <span>*</span></label>
                <input className="form-input" type="email" value={editForm.email}
                  onChange={e => { setEditError(''); setEditForm(f => ({ ...f, email: e.target.value })) }} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number <span>*</span></label>
                <input className="form-input" type="tel" value={editForm.phone}
                  onChange={e => { setEditError(''); setEditForm(f => ({ ...f, phone: e.target.value })) }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowEdit(false)}>Cancel</button>
              <button className="btn-submit" onClick={submitEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ── Assign Property Modal ───────────────────────────────────── */}
      {showAssign && createPortal(
        <div style={overlayStyle} onClick={() => setShowAssign(false)}>
          <div style={contentStyle} onClick={e => e.stopPropagation()}>
            <div style={headerStyle}>
              <h3 className="modal-title">Assign Property</h3>
              <button style={closeStyle} onClick={() => setShowAssign(false)}><i className="fas fa-times" /></button>
            </div>
            <div className="modal-body">
              {assignError && <p className="form-error">{assignError}</p>}
              <div className="form-group">
                <label className="form-label">Select Property <span>*</span></label>
                <select className="form-select" value={assignForm.propertyId}
                  onChange={e => { setAssignError(''); setAssignForm(f => ({ ...f, propertyId: e.target.value })) }}>
                  <option value="">Choose a property</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Select Caretaker <span>*</span></label>
                <select className="form-select" value={assignForm.caretakerId}
                  onChange={e => { setAssignError(''); setAssignForm(f => ({ ...f, caretakerId: e.target.value })) }}>
                  <option value="">Choose a caretaker</option>
                  {caretakers.map(c => <option key={c.id} value={c.id}>{c.first_name || c.firstName} {c.last_name || c.lastName}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowAssign(false)}>Cancel</button>
              <button className="btn-submit" onClick={submitAssign}>Create Assignment</button>
            </div>
          </div>
        </div>
      , document.body)}

    </div>
  )
}