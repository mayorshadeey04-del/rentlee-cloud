import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../context/AuthContext'
import { can } from '../../utils/permissions'
import Toast from '../../components/Toast'
import ConfirmDialog from '../../components/ConfirmDialog'
import './Units.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// ✅ Database unit types (matching backend validation)
const UNIT_TYPES = ['single_room', 'one_bedroom', 'two_bedroom', 'bedsitter']

// Display labels for unit types
const UNIT_TYPE_LABELS = {
  'single_room': 'Single Room',
  'one_bedroom': '1 Bedroom',
  'two_bedroom': '2 Bedroom',
  'bedsitter': 'Bedsitter'
}

const STATUSES = ['occupied', 'vacant'] // used for filtering only — not editable in modals

// ✅ Updated form fields to match backend: unitNumber, rentAmount
const EMPTY_FORM = { propertyId: '', propertyName: '', unitNumber: '', type: '', rentAmount: '' }

function formatRent(amount) {
  if (!amount || amount === 0) return 'Ksh 0'
  return `Ksh ${Number(amount).toLocaleString('en-KE')}`
}

export default function Units() {
  const { user, authHeaders } = useAuth()
  const [units, setUnits]           = useState([])
  const [properties, setProperties] = useState([])
  const [loading, setLoading]       = useState(true)
  const [showFilter, setShowFilter] = useState(false)
  const [showAdd, setShowAdd]       = useState(false)
  const [showEdit, setShowEdit]     = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [error, setError]           = useState('')
  const [filters, setFilters]       = useState({ propertyId: '', type: '', status: '' })
  const [activeFilters, setActiveFilters] = useState({ propertyId: '', type: '', status: '' })
  const [toasts, setToasts]         = useState([])
  const [confirm, setConfirm]       = useState(null)

  const canCreate = can(user?.role, 'units', 'create')
  const canUpdate = can(user?.role, 'units', 'update')
  const canDelete = can(user?.role, 'units', 'delete')

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showToast = useCallback((type, title, message) => {
    const id = Date.now()
    setToasts(t => [...t, { id, type, title, message }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }, [])

  // ── Fetch units and properties ────────────────────────────────────────────
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)

        const [unitsRes, propsRes] = await Promise.all([
          fetch(`${API_URL}/units`, { headers: authHeaders() }),
          fetch(`${API_URL}/properties`, { headers: authHeaders() })
        ])

        if (!unitsRes.ok || !propsRes.ok) {
          throw new Error('Failed to fetch data')
        }

        const unitsData = await unitsRes.json()
        const propsData = await propsRes.json()

        // ✅ Normalize backend data (snake_case → camelCase for internal use)
        const unitsList = (unitsData.data || unitsData).map(unit => ({
          id: unit.id,
          propertyId: unit.property_id,
          propertyName: unit.property_name || 'Unknown',
          unitNumber: unit.unit_number,
          type: unit.type,
          rentAmount: unit.rent_amount || 0,
          status: unit.status
        }))

        const propsList = (propsData.data || propsData).map(prop => ({
          id: prop.id,
          name: prop.name,
          location: prop.location
        }))

        setUnits(unitsList)
        setProperties(propsList)

      } catch (err) {
        console.error('❌ Fetch error:', err)
        showToast('error', 'Error', 'Failed to load units')
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchData()
    }
  }, [user, authHeaders, showToast])

  const filtered = units.filter(u =>
    (!activeFilters.propertyId || String(u.propertyId) === String(activeFilters.propertyId)) &&
    (!activeFilters.type       || u.type === activeFilters.type) &&
    (!activeFilters.status     || u.status === activeFilters.status)
  )

function handleChange(e) {
  const { name, value } = e.target
  console.log('handleChange:', name, value, typeof value)
  setError('')
  if (name === 'propertyId') {
    const prop = properties.find(p => String(p.id) === String(value))
    console.log('found prop:', prop)
    setForm(f => ({ ...f, propertyId: value, propertyName: prop?.name || '' }))
  } else {
    setForm(f => ({ ...f, [name]: value }))
  }
}
  function handleFilterChange(e) {
    setFilters(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function applyFilters() { 
    setActiveFilters({ ...filters })
    setShowFilter(false)
  }
  
  function clearFilters() {
    const empty = { propertyId: '', type: '', status: '' }
    setFilters(empty)
    setActiveFilters(empty)
  }

  function openAdd() { 
    setForm(EMPTY_FORM)
    setError('')
    setShowAdd(true)
  }

  function openEdit(unit) {
    setEditTarget(unit)
    setError('')
    setForm({
      propertyId:   unit.propertyId,
      propertyName: unit.propertyName,
      unitNumber:   unit.unitNumber,
      type:         unit.type,
      rentAmount:   unit.rentAmount,
    })
    setShowEdit(true)
  }

  async function submitAdd() {
    if (!form.propertyId || !form.unitNumber || !form.type || !form.rentAmount) {
      setError('Please fill in all required fields.')
      return
    }

    try {
      // ✅ Send data with backend field names
      const res = await fetch(`${API_URL}/units`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          propertyId: form.propertyId,  // ✅
          unitNumber: form.unitNumber,
          type: form.type,
          rentAmount: Number(form.rentAmount)
        })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.message || 'Failed to create unit')
      }

      const data = await res.json()
      const rawUnit = data.data || data

      // ✅ Normalize response
      const created = {
        id: rawUnit.id,
        propertyId: rawUnit.property_id,
        propertyName: form.propertyName,
        unitNumber: rawUnit.unit_number,
        type: rawUnit.type,
        rentAmount: rawUnit.rent_amount,
        status: rawUnit.status
      }

      setUnits(u => [...u, created])
      setShowAdd(false)
      showToast('success', 'Unit Added', `Unit ${created.unitNumber} has been created successfully.`)

    } catch (err) {
      console.error('❌ Create error:', err)
      setError(err.message || 'Failed to create unit')
    }
  }

  async function submitEdit() {
    if (!form.propertyId || !form.unitNumber || !form.type || !form.rentAmount) {
      setError('Please fill in all required fields.')
      return
    }

    try {
      // ✅ Send data with backend field names
      const res = await fetch(`${API_URL}/units/${editTarget.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          propertyId: form.propertyId,  // ✅
          unitNumber: form.unitNumber,
          type: form.type,
          rentAmount: Number(form.rentAmount)
        })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.message || 'Failed to update unit')
      }

      const data = await res.json()
      const rawUnit = data.data || data

      // ✅ Normalize response
      const updated = {
        id: rawUnit.id,
        propertyId: rawUnit.property_id,
        propertyName: form.propertyName,
        unitNumber: rawUnit.unit_number,
        type: rawUnit.type,
        rentAmount: rawUnit.rent_amount,
        status: rawUnit.status
      }

      setUnits(u => u.map(unit => unit.id === editTarget.id ? updated : unit))
      setShowEdit(false)
      showToast('success', 'Unit Updated', `Unit ${form.unitNumber} has been updated successfully.`)

    } catch (err) {
      console.error('❌ Update error:', err)
      setError(err.message || 'Failed to update unit')
    }
  }

  function deleteUnit(id) {
    const unit = units.find(u => u.id === id)
    setConfirm({ id, message: `This will permanently delete unit "${unit?.unitNumber}".` })
  }

  async function confirmDelete() {
    const id = confirm.id
    const unit = units.find(u => u.id === id)
    setConfirm(null)

    try {
      const res = await fetch(`${API_URL}/units/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.message || 'Failed to delete unit')
      }

      setUnits(u => u.filter(unit => unit.id !== id))
      showToast('success', 'Unit Deleted', `Unit ${unit?.unitNumber} has been removed successfully.`)

    } catch (err) {
      console.error('❌ Delete error:', err)
      showToast('error', 'Error', err.message || 'Failed to delete unit')
    }
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
    background: '#f1f5f9', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '16px', color: '#64748b', transition: 'all 0.2s ease'
  }

  return (
    <div className="units-page">

      <div className="page-header">
        <h2 className="page-title">Units</h2>
        <div className="header-buttons">
          <button className="btn-filter" onClick={() => setShowFilter(s => !s)}>
            <i className="fas fa-filter" /> Filter
          </button>
          {canCreate && (
            <button className="btn-primary" onClick={openAdd}>
              <i className="fas fa-plus" /> Add New Unit
            </button>
          )}
        </div>
      </div>

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
            <label className="filter-label">Type</label>
            <select className="filter-select" name="type" value={filters.type} onChange={handleFilterChange}>
              <option value="">All Types</option>
              {UNIT_TYPES.map(t => <option key={t} value={t}>{UNIT_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Status</label>
            <select className="filter-select" name="status" value={filters.status} onChange={handleFilterChange}>
              <option value="">All Status</option>
              <option value="occupied">Occupied</option>
              <option value="vacant">Vacant</option>
            </select>
          </div>
          <div className="filter-actions">
            <button className="btn-clear" onClick={clearFilters}>Clear</button>
            <button className="btn-apply" onClick={applyFilters}>Apply</button>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="units-table">
          <thead>
            <tr>
              <th>PROPERTY NAME</th>
              <th>UNIT NUMBER</th>
              <th>TYPE</th>
              <th>STATUS</th>
              <th>RENT AMOUNT</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan="6" className="table-empty">Loading units...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan="6" className="table-empty">
                {units.length === 0 
                  ? 'No units yet. Click "Add New Unit" to get started.'
                  : 'No units match the current filters.'}
              </td></tr>
            )}
            {filtered.map(unit => (
              <tr key={unit.id}>
                <td className="unit-property">{unit.propertyName}</td>
                <td className="unit-id">{unit.unitNumber}</td>
                <td className="unit-type">{UNIT_TYPE_LABELS[unit.type] || unit.type}</td>
                <td>
                  <span className={`status-badge ${unit.status}`}>
                    {unit.status.charAt(0).toUpperCase() + unit.status.slice(1)}
                  </span>
                </td>
                <td className="unit-rent">{formatRent(unit.rentAmount)}</td>
                <td>
                  <div className="action-buttons">
                    {canUpdate && (
                      <button className="action-btn edit-btn" onClick={() => openEdit(unit)}>
                        <i className="fas fa-edit" />
                      </button>
                    )}
                    {canDelete && (
                      <button className="action-btn delete-btn" onClick={() => deleteUnit(unit.id)}>
                        <i className="fas fa-trash" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAdd && createPortal(
        <div style={overlayStyle} onClick={() => setShowAdd(false)}>
          <div style={contentStyle} onClick={e => e.stopPropagation()}>
            <div style={headerStyle}>
              <h3 className="modal-title">Add New Unit</h3>
              <button style={closeStyle} onClick={() => setShowAdd(false)}><i className="fas fa-times" /></button>
            </div>
            <div className="modal-body">
              {error && <p className="form-error">{error}</p>}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Select Property <span>*</span></label>
                  <select className="form-select" name="propertyId" value={form.propertyId} onChange={handleChange}>
                    <option value="">Choose a property</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Unit Number <span>*</span></label>
                  <input className="form-input" name="unitNumber" value={form.unitNumber} onChange={handleChange} placeholder="e.g., A01, 101, B-12" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Type <span>*</span></label>
                  <select className="form-select" name="type" value={form.type} onChange={handleChange}>
                    <option value="">Choose type</option>
                    {UNIT_TYPES.map(t => <option key={t} value={t}>{UNIT_TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Rent Amount <span>*</span></label>
                  <input className="form-input" name="rentAmount" type="number" value={form.rentAmount} onChange={handleChange} placeholder="e.g., 25000" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-submit" onClick={submitAdd}>Add Unit</button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Edit Modal */}
      {showEdit && createPortal(
        <div style={overlayStyle} onClick={() => setShowEdit(false)}>
          <div style={contentStyle} onClick={e => e.stopPropagation()}>
            <div style={headerStyle}>
              <h3 className="modal-title">Edit Unit</h3>
              <button style={closeStyle} onClick={() => setShowEdit(false)}><i className="fas fa-times" /></button>
            </div>
            <div className="modal-body">
              {error && <p className="form-error">{error}</p>}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Select Property <span>*</span></label>
                  <select className="form-select" name="propertyId" value={form.propertyId} onChange={handleChange}>
                    <option value="">Choose a property</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Unit Number <span>*</span></label>
                  <input className="form-input" name="unitNumber" value={form.unitNumber} onChange={handleChange} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Type <span>*</span></label>
                  <select className="form-select" name="type" value={form.type} onChange={handleChange}>
                    <option value="">Choose type</option>
                    {UNIT_TYPES.map(t => <option key={t} value={t}>{UNIT_TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Rent Amount <span>*</span></label>
                  <input className="form-input" name="rentAmount" type="number" value={form.rentAmount} onChange={handleChange} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowEdit(false)}>Cancel</button>
              <button className="btn-submit" onClick={submitEdit}>Update Unit</button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Toasts */}         
            <Toast toasts={toasts} />

      {/* Confirm Dialog */}
      {confirm && <ConfirmDialog message={confirm.message} onConfirm={confirmDelete} onCancel={() => setConfirm(null)} />}

    </div>
  )
}