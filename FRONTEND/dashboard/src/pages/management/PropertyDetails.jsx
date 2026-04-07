import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useAuth } from '../../context/AuthContext'
import { can } from '../../utils/permissions'
import Toast from '../../components/Toast'
import ConfirmDialog from '../../components/ConfirmDialog'
import SubmitButton from '../../components/SubmitButton' // ✅ Imported Pro Button
import './Properties.css' 

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const EMPTY_TYPE_FORM = { name: '', defaultRent: '' }
const EMPTY_UNIT_FORM = { unitNumber: '', typeId: '' }

// Standardized list to ensure data integrity
const ROOM_TYPE_OPTIONS = ["Single Room", "Bedsitter", "1 Bedroom", "2 Bedroom", "3 Bedroom", "Commercial Shop"]

export default function PropertyDetails() {
  const params = useParams() 
  const location = useLocation()
  const navigate = useNavigate()
  const { user, authHeaders } = useAuth()
  
  // ✅ Bulletproof ID grabber: Try URL params first, then try the hidden state!
  const propertyId = params.id || location.state?.id;
  
  // Data State
  const [property, setProperty] = useState(null)
  const [unitTypes, setUnitTypes] = useState([])
  const [units, setUnits] = useState([])
  const [activeTab, setActiveTab] = useState('types') 
  
  // UI State
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false) // ✅ Loading state for all modals
  const [error, setError] = useState('')
  const [pageError, setPageError] = useState('')
  const [toasts, setToasts] = useState([])
  const [confirm, setConfirm] = useState(null)

  // Type Modal State
  const [showAddType, setShowAddType] = useState(false)
  const [showEditType, setShowEditType] = useState(false)
  const [editTypeTarget, setEditTypeTarget] = useState(null)
  const [typeForm, setTypeForm] = useState(EMPTY_TYPE_FORM)

  // Unit Modal State
  const [showAddUnit, setShowAddUnit] = useState(false)
  const [showEditUnit, setShowEditUnit] = useState(false)
  const [editUnitTarget, setEditUnitTarget] = useState(null)
  const [unitForm, setUnitForm] = useState(EMPTY_UNIT_FORM)

  // Permissions
  const canManageTypes = can(user?.role || 'landlord', 'properties', 'update')
  const canManageUnits = can(user?.role || 'landlord', 'units', 'update')

  const showToast = useCallback((type, title, message) => {
    const id = Date.now()
    setToasts(t => [...t, { id, type, title, message }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }, [])

  // ── LIVE DATA FETCHING ────────────────────────────────────────────────
  useEffect(() => {
    if (propertyId) {
      fetchPropertyData()
    } else {
      setPageError("No property ID found. Please go back and select a property.")
      setLoading(false)
    }
  }, [propertyId])

  async function fetchPropertyData() {
    try {
      setLoading(true)
      setPageError('')

      // Fetch Property Details, Room Types, and Units concurrently
      const [propRes, typesRes, unitsRes] = await Promise.all([
        fetch(`${API_URL}/properties/${propertyId}`, { headers: authHeaders() }),
        fetch(`${API_URL}/roomtypes?propertyId=${propertyId}`, { headers: authHeaders() }),
        fetch(`${API_URL}/units?propertyId=${propertyId}`, { headers: authHeaders() })
      ])

      if (!propRes.ok || !typesRes.ok || !unitsRes.ok) {
        throw new Error('Failed to load property data')
      }

      const propData = await propRes.json()
      const typesData = await typesRes.json()
      const unitsData = await unitsRes.json()

      // Set Property
      setProperty(propData.data || propData)

      // Set Room Types
      const formattedTypes = (typesData.data || []).map(t => ({
        id: t.id,
        name: t.name,
        defaultRent: t.default_rent,
        unitsCount: parseInt(t.units_count) || 0
      }))
      setUnitTypes(formattedTypes)

      // Set Units
      const formattedUnits = (unitsData.data || []).map(u => ({
        id: u.id,
        unit_number: u.unit_number,
        type_id: u.room_type_id,
        type_name: u.type_name,
        rent: u.rent,
        status: u.status
      }))
      setUnits(formattedUnits)

    } catch (err) {
      console.error(err)
      setPageError(err.message || 'Unable to load property details.')
    } finally {
      setLoading(false)
    }
  }

  // --- Handlers ---
  const handleTypeChange = (e) => { setError(''); setTypeForm(f => ({ ...f, [e.target.name]: e.target.value })) }
  const handleUnitChange = (e) => { setError(''); setUnitForm(f => ({ ...f, [e.target.name]: e.target.value })) }

  // ── LIVE ACTIONS (TYPES) ──────────────────────────────────────────────
  async function submitAddType() {
    if (!typeForm.name || !typeForm.defaultRent) return setError('Please fill in all fields.')
    
    setIsSubmitting(true) // ✅ Spinner ON

    try {
      const res = await fetch(`${API_URL}/roomtypes`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ propertyId, name: typeForm.name, defaultRent: Number(typeForm.defaultRent) })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      
      const newType = data.data
      setUnitTypes([...unitTypes, { id: newType.id, name: newType.name, defaultRent: newType.default_rent, unitsCount: 0 }])
      setShowAddType(false)
      showToast('success', 'Type Added', `${newType.name} pricing saved.`)
    } catch (err) { 
      setError(err.message) 
    } finally {
      setIsSubmitting(false) // ✅ Spinner OFF
    }
  }

  async function submitEditType() {
    if (!typeForm.name || !typeForm.defaultRent) return setError('Please fill in all fields.')
    
    setIsSubmitting(true) // ✅ Spinner ON

    try {
      const res = await fetch(`${API_URL}/roomtypes/${editTypeTarget.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ name: typeForm.name, defaultRent: Number(typeForm.defaultRent) })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      
      const updatedType = data.data
      setUnitTypes(unitTypes.map(t => t.id === editTypeTarget.id ? { ...t, name: updatedType.name, defaultRent: updatedType.default_rent } : t))
      // Also update the UI rent for any units using this type
      setUnits(units.map(u => u.type_id === editTypeTarget.id ? { ...u, type_name: updatedType.name, rent: updatedType.default_rent } : u))
      
      setShowEditType(false)
      showToast('success', 'Price Updated', 'Pricing tier updated successfully.')
    } catch (err) { 
      setError(err.message) 
    } finally {
      setIsSubmitting(false) // ✅ Spinner OFF
    }
  }

  const handleDeleteType = (type) => {
    if (type.unitsCount > 0) return showToast('error', 'Action Denied', `Cannot delete ${type.name}. It is assigned to ${type.unitsCount} active units.`)
    setConfirm({ id: type.id, action: 'type', message: `Are you sure you want to delete the "${type.name}" pricing tier?` })
  }

  // ── LIVE ACTIONS (UNITS) ──────────────────────────────────────────────
  async function submitAddUnit() {
    if (!unitForm.unitNumber || !unitForm.typeId) return setError('Please fill in all fields.')
    
    setIsSubmitting(true) // ✅ Spinner ON

    try {
      const res = await fetch(`${API_URL}/units`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ propertyId, unitNumber: unitForm.unitNumber, roomTypeId: unitForm.typeId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      
      const createdUnit = data.data
      const selectedType = unitTypes.find(t => t.id === createdUnit.room_type_id || t.id === createdUnit.unit_type_id)
      
      setUnits([...units, {
        id: createdUnit.id,
        unit_number: createdUnit.unit_number,
        type_id: selectedType.id,
        type_name: selectedType.name,
        rent: selectedType.defaultRent,
        status: createdUnit.status
      }])
      setUnitTypes(unitTypes.map(t => t.id === selectedType.id ? { ...t, unitsCount: t.unitsCount + 1 } : t))
      
      setShowAddUnit(false)
      setUnitForm(EMPTY_UNIT_FORM)
      showToast('success', 'Unit Created', `Unit ${createdUnit.unit_number} added successfully.`)
    } catch (err) { 
      setError(err.message) 
    } finally {
      setIsSubmitting(false) // ✅ Spinner OFF
    }
  }

  async function submitEditUnit() {
    if (!unitForm.unitNumber || !unitForm.typeId) return setError('Please fill in all fields.')
    
    setIsSubmitting(true) // ✅ Spinner ON

    try {
      const res = await fetch(`${API_URL}/units/${editUnitTarget.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ unitNumber: unitForm.unitNumber, roomTypeId: unitForm.typeId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      
      const updatedUnit = data.data
      const selectedType = unitTypes.find(t => t.id === updatedUnit.room_type_id || t.id === updatedUnit.unit_type_id)

      if (editUnitTarget.type_id !== selectedType.id) {
        setUnitTypes(unitTypes.map(t => {
          if (t.id === editUnitTarget.type_id) return { ...t, unitsCount: t.unitsCount - 1 }
          if (t.id === selectedType.id) return { ...t, unitsCount: t.unitsCount + 1 }
          return t
        }))
      }

      setUnits(units.map(u => u.id === editUnitTarget.id ? {
        ...u, unit_number: updatedUnit.unit_number, type_id: selectedType.id, type_name: selectedType.name, rent: selectedType.defaultRent
      } : u))
      
      setShowEditUnit(false)
      showToast('success', 'Unit Updated', `Unit ${updatedUnit.unit_number} updated successfully.`)
    } catch (err) { 
      setError(err.message) 
    } finally {
      setIsSubmitting(false) // ✅ Spinner OFF
    }
  }

  const handleDeleteUnit = (unit) => {
    if (unit.status === 'occupied') return showToast('error', 'Action Denied', `Cannot delete ${unit.unit_number}. It is currently occupied.`)
    setConfirm({ id: unit.id, typeId: unit.type_id, action: 'unit', message: `Are you sure you want to delete unit "${unit.unit_number}"?` })
  }

  // ── CONFIRM DELETE HANDLER ────────────────────────────────────────────
  async function handleConfirmDelete() {
    const { id, action, typeId } = confirm
    setConfirm(null)
    
    try {
      const endpoint = action === 'type' ? `${API_URL}/roomtypes/${id}` : `${API_URL}/units/${id}`
      const res = await fetch(endpoint, { method: 'DELETE', headers: authHeaders() })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.message)

      if (action === 'type') {
        setUnitTypes(unitTypes.filter(t => t.id !== id))
        showToast('success', 'Deleted', 'Pricing tier removed.')
      } else if (action === 'unit') {
        setUnits(units.filter(u => u.id !== id))
        setUnitTypes(unitTypes.map(t => t.id === typeId ? { ...t, unitsCount: t.unitsCount - 1 } : t))
        showToast('success', 'Deleted', 'Unit removed.')
      }
    } catch (err) {
      showToast('error', 'Delete Failed', err.message)
    }
  }

  // --- UI Helpers ---
  const getStatusStyle = (status) => ({
    padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', display: 'inline-block',
    background: status === 'occupied' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
    color: status === 'occupied' ? '#10b981' : '#f59e0b',
    border: `1px solid ${status === 'occupied' ? '#10b981' : '#f59e0b'}`
  })

  const overlayStyle = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(10,22,40,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', boxSizing: 'border-box' }
  const contentStyle = { background: '#fff', borderRadius: '24px', width: '90%', maxWidth: '600px', boxShadow: '0 8px 48px rgba(10,22,40,0.18)', overflow: 'hidden' }
  const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', borderBottom: '1.5px solid #f1f5f9' }
  const closeStyle = { width: '34px', height: '34px', borderRadius: '50%', border: '1.5px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem' }

  return (
    <div className="properties-page">
      <Toast toasts={toasts} />
      {confirm && <ConfirmDialog message={confirm.message} onConfirm={handleConfirmDelete} onCancel={() => setConfirm(null)} />}

      <div style={{ marginBottom: '1.5rem' }}>
        <button onClick={() => navigate('/management/properties')} style={{ background: 'none', border: 'none', color: 'var(--slate-400)', cursor: 'pointer', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <i className="fas fa-arrow-left" /> Back to Properties
        </button>
        <div className="page-header" style={{ marginBottom: '1rem' }}>
          <div>
            <h2 className="page-title">{property ? property.name : 'Loading...'}</h2>
            <p style={{ color: 'var(--slate-400)', fontSize: '0.938rem', marginTop: '0.25rem' }}>{property?.location}</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '2rem', borderBottom: '2px solid var(--slate-200)', marginBottom: '2rem' }}>
        <button onClick={() => setActiveTab('units')} style={{ padding: '0.75rem 0', background: 'none', border: 'none', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', color: activeTab === 'units' ? 'var(--blue-500)' : 'var(--slate-400)', borderBottom: activeTab === 'units' ? '3px solid var(--blue-500)' : '3px solid transparent', marginBottom: '-2px' }}>
          Physical Units ({units.length})
        </button>
        <button onClick={() => setActiveTab('types')} style={{ padding: '0.75rem 0', background: 'none', border: 'none', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', color: activeTab === 'types' ? 'var(--blue-500)' : 'var(--slate-400)', borderBottom: activeTab === 'types' ? '3px solid var(--blue-500)' : '3px solid transparent', marginBottom: '-2px' }}>
          Pricing & Room Types
        </button>
      </div>

      {pageError && (
        <div style={{ padding: '12px 20px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#991b1b' }}>
          <span>⚠️ {pageError}</span>
        </div>
      )}

      {/* --- TAB CONTENT: PHYSICAL UNITS --- */}
      {activeTab === 'units' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <p style={{ color: 'var(--slate-500)', fontSize: '0.938rem' }}>Manage the individual doors and occupancy in this building.</p>
            {canManageUnits && (
              <button className="btn-primary" onClick={() => { setUnitForm(EMPTY_UNIT_FORM); setError(''); setShowAddUnit(true); }}>
                <i className="fas fa-plus" /> Add New Unit
              </button>
            )}
          </div>

          <div className="table-container">
            <table className="prop-table">
              <thead>
                <tr>
                  <th>UNIT ID</th>
                  <th>ROOM TYPE</th>
                  <th>MONTHLY RENT</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan="5" className="table-empty">Loading units...</td></tr>}
                {!loading && units.length === 0 && <tr><td colSpan="5" className="table-empty">No units created yet. Click "Add New Unit" to start.</td></tr>}
                {units.map(unit => (
                  <tr key={unit.id}>
                    <td className="prop-name">{unit.unit_number}</td>
                    <td className="prop-location">{unit.type_name}</td>
                    <td className="prop-units">Ksh {Number(unit.rent).toLocaleString()}</td>
                    <td><span style={getStatusStyle(unit.status)}>{unit.status}</span></td>
                    <td>
                      <div className="action-buttons">
                        {canManageUnits && (
                          <>
                            <button className="action-btn edit-btn" onClick={() => { setEditUnitTarget(unit); setUnitForm({ unitNumber: unit.unit_number, typeId: unit.type_id }); setError(''); setShowEditUnit(true); }}><i className="fas fa-edit" /></button>
                            <button className="action-btn delete-btn" onClick={() => handleDeleteUnit(unit)} style={{ opacity: unit.status === 'occupied' ? 0.4 : 1, cursor: unit.status === 'occupied' ? 'not-allowed' : 'pointer' }}><i className="fas fa-trash" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* --- TAB CONTENT: ROOM TYPES --- */}
      {activeTab === 'types' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <p style={{ color: 'var(--slate-500)', fontSize: '0.938rem' }}>Define standard pricing tiers for this property before creating units.</p>
            {canManageTypes && (
              <button className="btn-primary" onClick={() => { setTypeForm(EMPTY_TYPE_FORM); setError(''); setShowAddType(true); }}>
                <i className="fas fa-plus" /> Add Room Type
              </button>
            )}
          </div>

          <div className="table-container">
            <table className="prop-table">
              <thead>
                <tr>
                  <th>TYPE NAME</th>
                  <th>DEFAULT RENT (KSH)</th>
                  <th>UNITS USING THIS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan="4" className="table-empty">Loading pricing data...</td></tr>}
                {!loading && unitTypes.length === 0 && <tr><td colSpan="4" className="table-empty">No room types defined yet. Click "Add Room Type" to start.</td></tr>}
                {unitTypes.map(type => (
                  <tr key={type.id}>
                    <td className="prop-name">{type.name}</td>
                    <td className="prop-units">{Number(type.defaultRent).toLocaleString()}</td>
                    <td className="prop-location">{type.unitsCount} Units</td>
                    <td>
                      <div className="action-buttons">
                        {canManageTypes && (
                          <>
                            <button className="action-btn edit-btn" onClick={() => { setEditTypeTarget(type); setTypeForm({ name: type.name, defaultRent: type.defaultRent }); setError(''); setShowEditType(true); }}><i className="fas fa-edit" /></button>
                            <button className="action-btn delete-btn" onClick={() => handleDeleteType(type)} style={{ opacity: type.unitsCount > 0 ? 0.4 : 1, cursor: type.unitsCount > 0 ? 'not-allowed' : 'pointer' }}><i className="fas fa-trash" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* --- MODALS --- */}

      {/* ADD/EDIT UNIT MODAL */}
      {(showAddUnit || showEditUnit) && createPortal(
        <div style={overlayStyle} onClick={() => { setShowAddUnit(false); setShowEditUnit(false); }}>
          <div style={contentStyle} onClick={e => e.stopPropagation()}>
            <div style={headerStyle}>
              <h3 className="modal-title">{showEditUnit ? 'Edit Unit' : 'Add New Unit'}</h3>
              <button style={closeStyle} onClick={() => { setShowAddUnit(false); setShowEditUnit(false); }}><i className="fas fa-times" /></button>
            </div>
            <div className="modal-body">
              {error && <div className="form-error">{error}</div>}
              
              {unitTypes.length === 0 && (
                <div style={{ background: '#fee2e2', color: '#991b1b', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #fca5a5' }}>
                  <strong>Action Required:</strong> You must define at least one Room Type in the "Pricing" tab before you can create a physical unit.
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Unit Number / ID <span>*</span></label>
                  <input className="form-input" name="unitNumber" value={unitForm.unitNumber} onChange={handleUnitChange} placeholder="e.g., A01, 12B" disabled={unitTypes.length === 0} />
                </div>
                <div className="form-group">
                  <label className="form-label">Room Type <span>*</span></label>
                  <select className="form-select" name="typeId" value={unitForm.typeId} onChange={handleUnitChange} disabled={unitTypes.length === 0}>
                    <option value="">Choose a type...</option>
                    {unitTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {unitForm.typeId && (
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '1rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                  <span style={{ color: '#0369a1', fontWeight: '600', fontSize: '0.938rem' }}>Fixed Monthly Rent:</span>
                  <span style={{ color: '#0369a1', fontWeight: '700', fontSize: '1.1rem' }}>
                    Ksh {Number(unitTypes.find(t => t.id === unitForm.typeId)?.defaultRent).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => { setShowAddUnit(false); setShowEditUnit(false); }}>Cancel</button>
              {/* ✅ Swapped Submit Button */}
              <SubmitButton 
                onClick={showEditUnit ? submitEditUnit : submitAddUnit}
                isSubmitting={isSubmitting}
                disabled={isSubmitting || unitTypes.length === 0}
                text={showEditUnit ? 'Save Changes' : 'Create Unit'}
                loadingText={showEditUnit ? 'Saving...' : 'Creating...'}
                className="btn-submit"
              />
            </div>
          </div>
        </div>
      , document.body)}

      {/* ADD/EDIT TYPE MODAL */}
      {(showAddType || showEditType) && createPortal(
        <div style={overlayStyle} onClick={() => { setShowAddType(false); setShowEditType(false); }}>
          <div style={contentStyle} onClick={e => e.stopPropagation()}>
            <div style={headerStyle}>
              <h3 className="modal-title" style={{ fontSize: '1.5rem' }}>{showEditType ? 'Edit Pricing Tier' : 'Add Room Type'}</h3>
              <button style={closeStyle} onClick={() => { setShowAddType(false); setShowEditType(false); }}><i className="fas fa-times" /></button>
            </div>
            <div className="modal-body">
              {error && <div className="form-error">{error}</div>}
              
              {showEditType && editTypeTarget?.unitsCount > 0 && (
                <div style={{ background: '#fffbeb', border: '1px solid #f59e0b', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                  <p style={{ color: '#b45309', margin: 0, fontSize: '0.875rem', fontWeight: '600' }}><i className="fas fa-exclamation-triangle" style={{ marginRight: '0.5rem' }}/>Warning: Bulk Update</p>
                  <p style={{ color: '#d97706', margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>Changing this price will automatically update the next monthly invoice for all <strong>{editTypeTarget.unitsCount} active tenants</strong> using this room type.</p>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Type Name <span>*</span></label>
                  <select className="form-select" name="name" value={typeForm.name} onChange={handleTypeChange}>
                    <option value="">Select Category...</option>
                    {ROOM_TYPE_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Default Rent (Ksh) <span>*</span></label>
                  <input className="form-input" name="defaultRent" type="number" min="0" value={typeForm.defaultRent} onChange={handleTypeChange} placeholder="e.g., 15000" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => { setShowAddType(false); setShowEditType(false); }}>Cancel</button>
              {/* ✅ Swapped Submit Button */}
              <SubmitButton 
                onClick={showEditType ? submitEditType : submitAddType}
                isSubmitting={isSubmitting}
                text={showEditType ? 'Save Changes' : 'Create Room Type'}
                loadingText={showEditType ? 'Saving...' : 'Creating...'}
                className="btn-submit"
              />
            </div>
          </div>
        </div>
      , document.body)}

    </div>
  )
}