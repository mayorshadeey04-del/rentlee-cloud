import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom' 
import { useAuth } from '../../context/AuthContext'
import { can } from '../../utils/permissions'
import Toast from '../../components/Toast'
import ConfirmDialog from '../../components/ConfirmDialog'
import SubmitButton from '../../components/SubmitButton' // ✅ Imported your Pro Button
import './Properties.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const EMPTY_FORM = { name: '', location: '', totalUnits: '' }

export default function Properties() {
  const { user, authHeaders } = useAuth()
  const navigate = useNavigate() 
  
  const [properties, setProperties] = useState([])
  const [loading, setLoading]       = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false) // ✅ Added loading state for forms
  const [showAdd, setShowAdd]       = useState(false)
  const [showEdit, setShowEdit]     = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [error, setError]           = useState('')
  const [pageError, setPageError]   = useState('')
  const [toasts, setToasts]         = useState([])
  const [confirm, setConfirm]       = useState(null) 

  const canCreate = can(user.role, 'properties', 'create')
  const canUpdate = can(user.role, 'properties', 'update')
  const canDelete = can(user.role, 'properties', 'delete')

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showToast = useCallback((type, title, message) => {
    const id = Date.now()
    setToasts(t => [...t, { id, type, title, message }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }, [])

  // ✅ Fetch properties from backend
  useEffect(() => {
    fetchProperties()
  }, [])

  async function fetchProperties() {
    try {
      setLoading(true)
      setPageError('')
      
      const res = await fetch(`${API_URL}/properties`, {
        headers: authHeaders()
      })

      if (!res.ok) {
        if (res.status === 401) {
          setPageError('Session expired. Please login again.')
        } else {
          setPageError('Failed to load properties. Please try again.')
        }
        setLoading(false)
        return
      }

      const data = await res.json()
      
      // ✅ Handle both response formats and normalize data
      let propertiesList = data.data || data
      
      // ✅ Normalize snake_case to camelCase & include occupiedUnits
      propertiesList = propertiesList.map(prop => ({
        id: prop.id,
        name: prop.name,
        location: prop.location,
        totalUnits: prop.total_units || prop.totalUnits || 0,
        occupiedUnits: prop.occupied_units || prop.occupiedUnits || 0, // Fallback to 0 if none
        landlordId: prop.landlord_id || prop.landlordId
      }))
      
      setProperties(propertiesList)
      
    } catch (err) {
      console.error('❌ Error fetching properties:', err)
      setPageError('Unable to connect to server. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e) {
    setError('')
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function openAdd() { 
    setForm(EMPTY_FORM)
    setError('')
    setShowAdd(true)
  }

  function openEdit(property) {
    setEditTarget(property)
    setError('')
    setForm({ 
      name: property.name, 
      location: property.location, 
      totalUnits: property.totalUnits 
    })
    setShowEdit(true)
  }

  // ✅ Create new property
  async function submitAdd() {
    if (!form.name || !form.location || !form.totalUnits) {
      setError('Please fill in all required fields.')
      return
    }

    setIsSubmitting(true) // ✅ Turn spinner ON

    try {
      const res = await fetch(`${API_URL}/properties`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name: form.name,
          location: form.location,
          totalUnits: Number(form.totalUnits)
        })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.message || 'Failed to create property')
      }

      const data = await res.json()
      
      // ✅ Normalize the created property
      const rawProperty = data.data || data
      const created = {
        id: rawProperty.id,
        name: rawProperty.name,
        location: rawProperty.location,
        totalUnits: rawProperty.total_units || rawProperty.totalUnits || 0,
        occupiedUnits: 0, // A brand new property has 0 occupied units
        landlordId: rawProperty.landlord_id || rawProperty.landlordId
      }
      
      setProperties(p => [...p, created])
      setShowAdd(false)
      setForm(EMPTY_FORM)
      showToast('success', 'Property Added', `${created.name} has been created successfully.`)
      
    } catch (err) {
      setError(err.message || 'Failed to create property')
    } finally {
      setIsSubmitting(false) // ✅ Turn spinner OFF
    }
  }

  // ✅ Update existing property
  async function submitEdit() {
    if (!form.name || !form.location || !form.totalUnits) {
      setError('Please fill in all required fields.')
      return
    }

    setIsSubmitting(true) // ✅ Turn spinner ON

    try {
      const res = await fetch(`${API_URL}/properties/${editTarget.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          name: form.name,
          location: form.location,
          totalUnits: Number(form.totalUnits)
        })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.message || 'Failed to update property')
      }

      const data = await res.json()
      
      // ✅ Normalize the updated property
      const rawProperty = data.data || data
      const updated = {
        id: rawProperty.id,
        name: rawProperty.name,
        location: rawProperty.location,
        totalUnits: rawProperty.total_units || rawProperty.totalUnits || 0,
        occupiedUnits: editTarget.occupiedUnits, // Maintain existing occupancy data
        landlordId: rawProperty.landlord_id || rawProperty.landlordId
      }
      
      setProperties(p => p.map(prop => 
        prop.id === editTarget.id ? updated : prop
      ))
      setShowEdit(false)
      setForm(EMPTY_FORM)
      showToast('success', 'Property Updated', `${updated.name} has been updated successfully.`)
      
    } catch (err) {
      setError(err.message || 'Failed to update property')
    } finally {
      setIsSubmitting(false) // ✅ Turn spinner OFF
    }
  }

  // ✅ Delete property
  function deleteProperty(id, e) {
    e.stopPropagation() // Prevent row click when clicking delete
    const prop = properties.find(p => p.id === id)
    setConfirm({
      id,
      message: `This will permanently delete "${prop?.name}" and all its associated units and tenants.`
    })
  }

  async function confirmDelete() {
    const id = confirm.id
    const prop = properties.find(p => p.id === id)
    setConfirm(null)

    try {
      const res = await fetch(`${API_URL}/properties/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.message || 'Failed to delete property')
      }

      setProperties(p => p.filter(prop => prop.id !== id))
      showToast('success', 'Property Deleted', `${prop?.name} has been removed successfully.`)
      
    } catch (err) {
      showToast('error', 'Delete Failed', err.message || 'Failed to delete property')
    }
  }

  // Navigation helper for Clean URLs
  const goToDetails = (prop) => {
    navigate('/management/properties/Propertydetails', { state: { id: prop.id } })
  }

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
    width: '90%', maxWidth: '660px',
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

  return (
    <div className="properties-page">

      <Toast toasts={toasts} />

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirmDelete}
          onCancel={() => setConfirm(null)}
        />
      )}

      <div className="page-header">
        <h2 className="page-title">Properties</h2>
        {canCreate && (
          <button className="btn-primary" onClick={openAdd}>
            <i className="fas fa-plus" /> Add New Property
          </button>
        )}
      </div>

      {pageError && (
        <div style={{
          padding: '12px 20px', background: '#fee2e2', border: '1px solid #fca5a5',
          borderRadius: '8px', marginBottom: '20px', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', color: '#991b1b'
        }}>
          <span>⚠️ {pageError}</span>
          <div>
            <button onClick={fetchProperties} style={{ marginRight: '10px', padding: '6px 12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Retry
            </button>
            <button onClick={() => setPageError('')} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#991b1b' }}>
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="prop-table">
          <thead>
            <tr>
              <th>PROPERTY NAME</th>
              <th>LOCATION</th>
              <th>TOTAL UNITS</th>
              <th>OCCUPIED</th>
              <th>VACANT</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="6" className="table-empty">Loading properties...</td></tr>}
            {!loading && !pageError && properties.length === 0 && (
              <tr><td colSpan="6" className="table-empty">No properties yet. Click "Add New Property" to get started.</td></tr>
            )}
            {!loading && pageError && <tr><td colSpan="6" className="table-empty">Unable to load properties. Please try again.</td></tr>}
            
            {properties.map(prop => {
              // 🧮 Calculate Vacant Units
              const vacantUnits = prop.totalUnits - prop.occupiedUnits;
              
              return (
                <tr 
                  key={prop.id} 
                  className="clickable-row"
                  onClick={() => goToDetails(prop)}
                >
                  <td className="prop-name">{prop.name}</td>
                  <td className="prop-location">{prop.location}</td>
                  <td className="prop-units font-bold">{prop.totalUnits}</td>
                  
                  {/* OCCUPIED */}
                  <td>
                    <span className={`unit-pill ${prop.occupiedUnits > 0 ? 'occupied' : 'empty'}`}>
                      {prop.occupiedUnits}
                    </span>
                  </td>

                  {/* VACANT */}
                  <td>
                    <span className={`unit-pill ${vacantUnits > 0 ? 'vacant' : 'full'}`}>
                      {vacantUnits}
                    </span>
                  </td>

                  <td onClick={e => e.stopPropagation()}>
                    <div className="action-buttons">
                      
                      <button 
                        className="action-btn view-btn" 
                        onClick={() => goToDetails(prop)}
                        title="Manage Property Details"
                      >
                        <i className="fas fa-eye" />
                      </button>

                      {canUpdate && (
                        <button className="action-btn edit-btn" onClick={(e) => { e.stopPropagation(); openEdit(prop); }}>
                          <i className="fas fa-edit" />
                        </button>
                      )}
                      
                      {canDelete && (
                        <button className="action-btn delete-btn" onClick={(e) => deleteProperty(prop.id, e)}>
                          <i className="fas fa-trash" />
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

      {/* Add Modal */}
      {showAdd && createPortal(
        <div style={overlayStyle} onClick={() => setShowAdd(false)}>
          <div style={contentStyle} onClick={e => e.stopPropagation()}>
            <div style={headerStyle}>
              <h3 className="modal-title">Add New Property</h3>
              <button style={closeStyle} onClick={() => setShowAdd(false)}>
                <i className="fas fa-times" />
              </button>
            </div>
            <div className="modal-body">
              {error && <div style={{ padding: '10px 15px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', marginBottom: '15px', color: '#991b1b' }}>{error}</div>}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Property Name <span>*</span></label>
                  <input className="form-input" name="name" value={form.name} onChange={handleChange} placeholder="e.g., Lenana Apartment" />
                </div>
                <div className="form-group">
                  <label className="form-label">Location <span>*</span></label>
                  <input className="form-input" name="location" value={form.location} onChange={handleChange} placeholder="e.g., Lenana, Nairobi" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Total Units <span>*</span></label>
                <input className="form-input" name="totalUnits" type="number" min="1" value={form.totalUnits} onChange={handleChange} placeholder="e.g., 15" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
              {/* ✅ Swapped Button */}
              <SubmitButton 
                onClick={submitAdd} 
                isSubmitting={isSubmitting} 
                text="Add Property" 
                loadingText="Creating..." 
                className="btn-submit"
              />
            </div>
          </div>
        </div>
      , document.body)}

      {/* Edit Modal */}
      {showEdit && createPortal(
        <div style={overlayStyle} onClick={() => setShowEdit(false)}>
          <div style={contentStyle} onClick={e => e.stopPropagation()}>
            <div style={headerStyle}>
              <h3 className="modal-title">Edit Property</h3>
              <button style={closeStyle} onClick={() => setShowEdit(false)}>
                <i className="fas fa-times" />
              </button>
            </div>
            <div className="modal-body">
              {error && <div style={{ padding: '10px 15px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', marginBottom: '15px', color: '#991b1b' }}>{error}</div>}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Property Name <span>*</span></label>
                  <input className="form-input" name="name" value={form.name} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Location <span>*</span></label>
                  <input className="form-input" name="location" value={form.location} onChange={handleChange} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Total Units <span>*</span></label>
                <input className="form-input" name="totalUnits" type="number" min="1" value={form.totalUnits} onChange={handleChange} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowEdit(false)}>Cancel</button>
              {/* ✅ Swapped Button */}
              <SubmitButton 
                onClick={submitEdit} 
                isSubmitting={isSubmitting} 
                text="Update Property" 
                loadingText="Updating..." 
                className="btn-submit"
              />
            </div>
          </div>
        </div>
      , document.body)}

    </div>
  )
}