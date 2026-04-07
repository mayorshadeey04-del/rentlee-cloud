import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import './Reports.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const currentYear = new Date().getFullYear()
const YEARS = []
for (let y = currentYear; y >= 2020; y--) { YEARS.push(String(y)) }

// ─── Generic PDF Exporter ──────────────────────────────────────────────────────
// rows can contain plain values OR objects: { value, color, bold }
// e.g. { value: '5', color: [22,163,74], bold: true }
const exportToPDF = (title, columns, rows, propertyLabel = 'All Properties', userName = '') => {
  const doExport = (logoDataUrl) => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.width

    // ── Header area ─────────────────────────────────────────────────────────
    // Left col: logo (y=8-22), property line (y=28), title (y=36)
    // Right col: GENERATED ON label (y=14), date (y=21), PREPARED FOR (y=30), name (y=37)
    // Header ends at y=44, divider at y=44, table starts at y=52
    const headerHeight = 44

    doc.setFillColor(255, 255, 255)
    doc.rect(0, 0, pageWidth, headerHeight, 'F')
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.5)
    doc.line(0, headerHeight, pageWidth, headerHeight)

    // Logo (top left)
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', 12, 6, 34, 13)
    } else {
      doc.setFontSize(16)
      doc.setTextColor(29, 78, 216)
      doc.setFont('helvetica', 'bold')
      doc.text('Rentlee', 14, 18)
    }

    // Property line (below logo)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(100, 116, 139)
    doc.text('Property: ', 14, 26)
    const propLabelWidth = doc.getTextWidth('Property: ')
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text(propertyLabel, 14 + propLabelWidth, 26)

    // Report title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(15, 23, 42)
    doc.text(title, 14, 37)

    // Right side: Generated on
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(100, 116, 139)
    doc.text('GENERATED ON', pageWidth - 14, 12, { align: 'right' })
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text(new Date().toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' }), pageWidth - 14, 19, { align: 'right' })

    // Prepared for
    if (userName) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(100, 116, 139)
      doc.text('PREPARED FOR', pageWidth - 14, 29, { align: 'right' })
      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(15, 23, 42)
      doc.text(userName, pageWidth - 14, 36, { align: 'right' })
    }

    // ── Table ────────────────────────────────────────────────────────────────
    // Separate plain rows from cell-style metadata
    const plainRows = rows.map(row =>
      row.map(cell => (cell && typeof cell === 'object' ? cell.value : cell))
    )
    const cellStyles = {}
    rows.forEach((row, ri) => {
      row.forEach((cell, ci) => {
        if (cell && typeof cell === 'object' && (cell.color || cell.bold)) {
          if (!cellStyles[ri]) cellStyles[ri] = {}
          cellStyles[ri][ci] = {
            textColor: cell.color || [15, 23, 42],
            fontStyle: cell.bold ? 'bold' : 'normal'
          }
        }
      })
    })

   autoTable(doc, {
      startY: headerHeight + 8,
      head: [columns],
      body: plainRows,
      theme: 'grid',
      // ✅ CHANGED: Blue background with white text!
      headStyles: {
        fillColor: [59, 130, 246], // Rentlee Blue (#3B82F6)
        textColor: [255, 255, 255], // White Text
        fontStyle: 'bold',
        fontSize: 9,
        lineWidth: 0, // Removed header borders for a cleaner, modern look
        cellPadding: { top: 7, bottom: 7, left: 5, right: 5 }
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      bodyStyles: {
        textColor: [15, 23, 42],
        fontSize: 9,
        lineWidth: 0.3,
        lineColor: [203, 213, 225]
      },
      styles: { font: 'helvetica', cellPadding: 5 },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const rowStyles = cellStyles[data.row.index]
          if (rowStyles && rowStyles[data.column.index]) {
            data.cell.styles.textColor = rowStyles[data.column.index].textColor
            data.cell.styles.fontStyle = rowStyles[data.column.index].fontStyle
          }
        }
      },
      didDrawPage: (data) => {
        const pageCount = doc.internal.getNumberOfPages()
        doc.setFontSize(8)
        doc.setTextColor(148, 163, 184)
        doc.text('Rentlee Management System · Confidential', 14, doc.internal.pageSize.height - 10)
        doc.text(
          `Page ${data.pageNumber} of ${pageCount}`,
          pageWidth - 14,
          doc.internal.pageSize.height - 10,
          { align: 'right' }
        )
      }
    })

    doc.save(`Rentlee_${title.replace(/\s+/g, '_')}_${Date.now()}.pdf`)
  }

  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    canvas.getContext('2d').drawImage(img, 0, 0)
    doExport(canvas.toDataURL('image/png'))
  }
  img.onerror = () => doExport(null)
  img.src = '/logo.png'
}

// ─── 1. Tenant Statement (Balances) ───────────────────────────────────────────
function TenantStatement({ properties }) {
  const { authHeaders, user } = useAuth()
  const [filters, setFilters]   = useState({ propertyId: '', balance: '' })
  const [rows, setRows]         = useState([])
  const [generated, setGenerated] = useState(false)
  const [loading, setLoading]   = useState(false)

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/reports/tenant-statement?propertyId=${filters.propertyId}`, { headers: authHeaders() })
      const data = await res.json()
      
      const fetchedRows = data.data || data;
      if (Array.isArray(fetchedRows)) {
        setRows(fetchedRows)
        setGenerated(true)
      } else {
        alert(data.message || 'Error generating report')
      }
    } catch (err) {
      alert("Failed to connect to server")
    } finally {
      setLoading(false)
    }
  }

  const filtered = rows.filter(r =>
    (!filters.balance ||
      (filters.balance === 'paid'   && Number(r.balance) <= 0) ||
      (filters.balance === 'unpaid' && Number(r.balance) > 0))
  )

  const handleDownload = () => {
    const isAllProps = !filters.propertyId
    const propLabel = isAllProps ? 'All Properties' : (properties.find(p => String(p.id) === String(filters.propertyId))?.name || 'All Properties')
    const userName = user?.name || ''
    const columns = isAllProps
      ? ["Tenant Name", "Property", "Unit ID", "Balance (Ksh)"]
      : ["Tenant Name", "Unit ID", "Balance (Ksh)"]
    const data = filtered.map(r => {
      const bal = Number(r.balance)
      const balCell = { value: `Ksh ${bal.toLocaleString()}`, color: bal <= 0 ? [5, 150, 105] : [225, 29, 72], bold: true }
      return isAllProps
        ? [r.tenantName, r.propertyName, r.unitId, balCell]
        : [r.tenantName, r.unitId, balCell]
    })
    exportToPDF('Tenant Balances Statement', columns, data, propLabel, userName)
  }

  return (
    <>
      <div className="filters-section">
        <div className="filters-grid">
          <div className="filter-group">
            <label className="filter-label">Property</label>
            <select className="filter-select" value={filters.propertyId} onChange={e => setFilters(f => ({ ...f, propertyId: e.target.value }))}>
              <option value="">All Properties</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Balance Status</label>
            <select className="filter-select" value={filters.balance} onChange={e => setFilters(f => ({ ...f, balance: e.target.value }))}>
              <option value="">All</option>
              <option value="paid">Paid (Ksh 0)</option>
              <option value="unpaid">Unpaid (&gt; Ksh 0)</option>
            </select>
          </div>
        </div>
        <div className="filters-actions">
          <button className="btn-generate" onClick={generate} disabled={loading}>
            <i className={loading ? "fas fa-spinner fa-spin" : "fas fa-chart-bar"} /> {loading ? 'Generating...' : 'Generate Report'}
          </button>
          <button className="btn-download-pdf" onClick={handleDownload} disabled={!generated || filtered.length === 0}><i className="fas fa-download" /> Download PDF</button>
        </div>
      </div>

      {generated && (
        <div className="report-summary-cards">
          <div className="summary-card"><h4>Total Tenants</h4><p>{filtered.length}</p></div>
          <div className="summary-card warning"><h4>Total Arrears</h4><p>Ksh {filtered.reduce((sum, r) => sum + Number(r.balance), 0).toLocaleString()}</p></div>
        </div>
      )}

      <div className="report-table-wrapper">
        <table className="report-table">
          <thead>
            <tr>
              {!filters.propertyId && <th>PROPERTY</th>}
              <th>TENANT NAME</th>
              <th>UNIT ID</th>
              <th>BALANCE</th>
            </tr>
          </thead>
          <tbody>
            {!generated && <tr><td colSpan={filters.propertyId ? 3 : 4} className="table-empty">Set filters and click Generate Report.</td></tr>}
            {generated && filtered.length === 0 && <tr><td colSpan={filters.propertyId ? 3 : 4} className="table-empty">No records to display.</td></tr>}
            {filtered.map((r, i) => (
              <tr key={i}>
                {!filters.propertyId && <td className="cell-muted">{r.propertyName}</td>}
                <td className="cell-bold">{r.tenantName}</td>
                <td className="cell-bold">{r.unitId}</td>
                <td className={`cell-amount ${Number(r.balance) <= 0 ? 'positive' : 'negative'}`}>Ksh {Number(r.balance).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ─── 2. Property Statement (Overview) ─────────────────────────────────────────
function PropertyStatement({ properties }) {
  const { authHeaders, user } = useAuth()
  const [propertyId, setPropertyId] = useState('')
  const [rows, setRows]             = useState([])
  const [generated, setGenerated]   = useState(false)
  const [loading, setLoading]       = useState(false)

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/reports/property-statement?propertyId=${propertyId}`, { headers: authHeaders() })
      const data = await res.json()
      
      const fetchedRows = data.data || data;
      if (Array.isArray(fetchedRows)) {
        setRows(fetchedRows)
        setGenerated(true)
      } else {
        alert(data.message || 'Error generating report')
      }
    } catch (err) {
      alert("Failed to connect to server")
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    const userName = user?.name || ''
    const columns = ["Property Name", "Location", "Total Units", "Occupied", "Vacant", "Caretaker"]
    const data = rows.map(r => [
      r.propertyName, r.location,
      { value: String(r.totalUnits), bold: true },
      { value: String(r.occupiedUnits), color: [5, 150, 105], bold: true },
      { value: String(r.vacantUnits), color: r.vacantUnits > 0 ? [225, 29, 72] : [15, 23, 42], bold: Number(r.vacantUnits) > 0 },
      r.caretaker
    ])
    exportToPDF('Property Occupancy Statement', columns, data, 'All Properties', userName)
  }

  return (
    <>
      <div className="filters-section">
        <div className="filters-grid">
          <div className="filter-group">
            <label className="filter-label">Property</label>
            <select className="filter-select" value={propertyId} onChange={e => setPropertyId(e.target.value)}>
              <option value="">All Properties</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <div className="filters-actions">
          <button className="btn-generate" onClick={generate} disabled={loading}>
             <i className={loading ? "fas fa-spinner fa-spin" : "fas fa-chart-bar"} /> {loading ? 'Generating...' : 'Generate Report'}
          </button>
          <button className="btn-download-pdf" onClick={handleDownload} disabled={!generated || rows.length === 0}><i className="fas fa-download" /> Download PDF</button>
        </div>
      </div>

      {generated && (
        <div className="report-summary-cards">
          <div className="summary-card"><h4>Total Properties</h4><p>{rows.length}</p></div>
          <div className="summary-card success">
            <h4>Overall Occupancy</h4>
            <p>{rows.length > 0 ? Math.round((rows.reduce((sum, r) => sum + Number(r.occupiedUnits), 0) / rows.reduce((sum, r) => sum + Number(r.totalUnits), 0)) * 100) : 0}%</p>
          </div>
        </div>
      )}

      <div className="report-table-wrapper">
        <table className="report-table">
          <thead><tr><th>PROPERTY NAME</th><th>LOCATION</th><th>TOTAL UNITS</th><th>OCCUPIED</th><th>VACANT</th><th>ASSIGNED CARETAKER</th></tr></thead>
          <tbody>
            {!generated && <tr><td colSpan="6" className="table-empty">Set filters and click Generate Report.</td></tr>}
            {generated && rows.length === 0 && <tr><td colSpan="6" className="table-empty">No records to display.</td></tr>}
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="cell-bold">{r.propertyName}</td>
                <td className="cell-muted">{r.location}</td>
                <td className="cell-bold">{r.totalUnits}</td>
                <td className="cell-bold positive">{r.occupiedUnits}</td>
                <td className="cell-bold negative">{r.vacantUnits}</td>
                <td className="cell-muted">{r.caretaker}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ─── 3. Unit Status Report (Rent Roll) ────────────────────────────────────────
function UnitStatusReport({ properties }) {
  const { authHeaders, user } = useAuth()
  const [filters, setFilters]   = useState({ propertyId: '', status: '' })
  const [rows, setRows]         = useState([])
  const [generated, setGenerated] = useState(false)
  const [loading, setLoading]     = useState(false)

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/reports/unit-status?propertyId=${filters.propertyId}`, { headers: authHeaders() })
      const data = await res.json()
      
      const fetchedRows = data.data || data;
      if (Array.isArray(fetchedRows)) {
        setRows(fetchedRows)
        setGenerated(true)
      } else {
        alert(data.message || 'Error generating report')
      }
    } catch (err) {
      alert("Failed to connect to server")
    } finally {
      setLoading(false)
    }
  }

  const filtered = rows.filter(r => !filters.status || r.status === filters.status)

  const handleDownload = () => {
    const isAllProps = !filters.propertyId
    const propLabel = isAllProps ? 'All Properties' : (properties.find(p => String(p.id) === String(filters.propertyId))?.name || 'All Properties')
    const userName = user?.name || ''
    const columns = isAllProps
      ? ["Property", "Unit ID", "Room Type", "Monthly Rent (Ksh)", "Status"]
      : ["Unit ID", "Room Type", "Monthly Rent (Ksh)", "Status"]
    const data = filtered.map(r => {
      const statusCell = {
        value: r.status.toUpperCase(),
        color: r.status === 'occupied' ? [5, 150, 105] : [245, 158, 11],
        bold: true
      }
      return isAllProps
        ? [r.propertyName, r.unitId, r.roomType, `Ksh ${Number(r.rent).toLocaleString()}`, statusCell]
        : [r.unitId, r.roomType, `Ksh ${Number(r.rent).toLocaleString()}`, statusCell]
    })
    exportToPDF('Unit Status Report', columns, data, propLabel, userName)
  }

  return (
    <>
      <div className="filters-section">
        <div className="filters-grid">
          <div className="filter-group">
            <label className="filter-label">Property</label>
            <select className="filter-select" value={filters.propertyId} onChange={e => setFilters(f => ({ ...f, propertyId: e.target.value }))}>
              <option value="">All Properties</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Unit Status</label>
            <select className="filter-select" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
              <option value="">All</option>
              <option value="occupied">Occupied</option>
              <option value="vacant">Vacant</option>
            </select>
          </div>
        </div>
        <div className="filters-actions">
          <button className="btn-generate" onClick={generate} disabled={loading}>
             <i className={loading ? "fas fa-spinner fa-spin" : "fas fa-chart-bar"} /> {loading ? 'Generating...' : 'Generate Report'}
          </button>
          <button className="btn-download-pdf" onClick={handleDownload} disabled={!generated || filtered.length === 0}><i className="fas fa-download" /> Download PDF</button>
        </div>
      </div>

      {generated && (
        <div className="report-summary-cards">
          <div className="summary-card"><h4>Total Units</h4><p>{filtered.length}</p></div>
          <div className="summary-card success"><h4>Occupied</h4><p>{filtered.filter(r => r.status === 'occupied').length}</p></div>
          <div className="summary-card warning"><h4>Vacant</h4><p>{filtered.filter(r => r.status === 'vacant').length}</p></div>
        </div>
      )}

      <div className="report-table-wrapper">
        <table className="report-table">
          <thead>
            <tr>
              {!filters.propertyId && <th>PROPERTY</th>}
              <th>UNIT ID</th>
              <th>ROOM TYPE</th>
              <th>MONTHLY RENT</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {!generated && <tr><td colSpan={filters.propertyId ? 4 : 5} className="table-empty">Set filters and click Generate Report.</td></tr>}
            {generated && filtered.length === 0 && <tr><td colSpan={filters.propertyId ? 4 : 5} className="table-empty">No records to display.</td></tr>}
            {filtered.map((r, i) => (
              <tr key={i}>
                {!filters.propertyId && <td className="cell-muted">{r.propertyName}</td>}
                <td className="cell-bold">{r.unitId}</td>
                <td className="cell-muted">{r.roomType}</td>
                <td className="cell-bold">Ksh {Number(r.rent).toLocaleString()}</td>
                <td>
                  <span className={`status-badge-outline ${r.status}`}>
                    {r.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ─── 4. Tenant Directory Report ───────────────────────────────────────────────
function TenantDirectoryReport({ properties }) {
  const { authHeaders, user } = useAuth()
  const [propertyId, setPropertyId] = useState('')
  const [rows, setRows]             = useState([])
  const [generated, setGenerated]   = useState(false)
  const [loading, setLoading]       = useState(false)

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/reports/tenant-directory?propertyId=${propertyId}`, { headers: authHeaders() })
      const data = await res.json()
      
      const fetchedRows = data.data || data;
      if (Array.isArray(fetchedRows)) {
        setRows(fetchedRows)
        setGenerated(true)
      } else {
        alert(data.message || 'Error generating report')
      }
    } catch (err) {
      alert("Failed to connect to server")
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    const isAllProps = !propertyId
    const propLabel = isAllProps ? 'All Properties' : (properties.find(p => String(p.id) === String(propertyId))?.name || 'All Properties')
    const userName = user?.name || ''
    const columns = isAllProps
      ? ["Tenant Name", "Property", "Unit", "Phone Number", "Email"]
      : ["Tenant Name", "Unit", "Phone Number", "Email"]
    const data = rows.map(r => isAllProps
      ? [{ value: r.tenantName, bold: true }, r.propertyName, r.unitId, r.phone, r.email]
      : [{ value: r.tenantName, bold: true }, r.unitId, r.phone, r.email]
    )
    exportToPDF('Tenant Directory', columns, data, propLabel, userName)
  }

  return (
    <>
      <div className="filters-section">
        <div className="filters-grid">
          <div className="filter-group">
            <label className="filter-label">Property</label>
            <select className="filter-select" value={propertyId} onChange={e => setPropertyId(e.target.value)}>
              <option value="">All Properties</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <div className="filters-actions">
          <button className="btn-generate" onClick={generate} disabled={loading}>
             <i className={loading ? "fas fa-spinner fa-spin" : "fas fa-chart-bar"} /> {loading ? 'Generating...' : 'Generate Report'}
          </button>
          <button className="btn-download-pdf" onClick={handleDownload} disabled={!generated || rows.length === 0}><i className="fas fa-download" /> Download PDF</button>
        </div>
      </div>

      {generated && (
        <div className="report-summary-cards">
          <div className="summary-card"><h4>Total Tenants Found</h4><p>{rows.length}</p></div>
        </div>
      )}

      <div className="report-table-wrapper">
        <table className="report-table">
          <thead>
            <tr>
              <th>TENANT NAME</th>
              {!propertyId && <th>PROPERTY</th>}
              <th>UNIT</th>
              <th>PHONE NUMBER</th>
              <th>EMAIL</th>
            </tr>
          </thead>
          <tbody>
            {!generated && <tr><td colSpan={propertyId ? 4 : 5} className="table-empty">Set filters and click Generate Report.</td></tr>}
            {generated && rows.length === 0 && <tr><td colSpan={propertyId ? 4 : 5} className="table-empty">No records to display.</td></tr>}
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="cell-bold">{r.tenantName}</td>
                {!propertyId && <td className="cell-muted">{r.propertyName}</td>}
                <td className="cell-bold">{r.unitId}</td>
                <td className="cell-bold">{r.phone}</td>
                <td className="cell-muted">{r.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ─── 5. Revenue Report ────────────────────────────────────────────────────────
function RevenueReport({ properties }) {
  const { authHeaders, user } = useAuth()
  const [filters, setFilters]       = useState({ periodType: '', year: '', month: '', propertyId: '' })
  const [rows, setRows]             = useState([])
  const [generated, setGenerated]   = useState(false)
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)

  async function generate() {
    setError('')
    if (!filters.periodType) { setError('Please select a Period Type.'); return }
    if (!filters.year)        { setError('Please select a Year.'); return }
    if (filters.periodType === 'monthly' && !filters.month) { setError('Please select a Month.'); return }

    setLoading(true)
    try {
      const params = new URLSearchParams(filters).toString()
      const res = await fetch(`${API_URL}/reports/revenue?${params}`, { headers: authHeaders() })
      const data = await res.json()
      
      const fetchedRows = data.data || data;
      if (Array.isArray(fetchedRows)) {
        setRows(fetchedRows)
        setGenerated(true)
      } else {
        alert(data.message || 'Error generating report')
      }
    } catch (err) {
      alert("Failed to connect to server")
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setError('')
    setFilters(f => ({ ...f, [name]: value, ...(name === 'periodType' && value !== 'monthly' ? { month: '' } : {}) }))
  }

  const handleDownload = () => {
    const isAllProps = !filters.propertyId
    const propLabel = isAllProps ? 'All Properties' : (properties.find(p => String(p.id) === String(filters.propertyId))?.name || 'All Properties')
    const userName = user?.name || ''
    const title = `Revenue Report (${filters.periodType === 'monthly' ? MONTHS[filters.month - 1] : ''} ${filters.year})`
    const columns = isAllProps
      ? ["Property", "Expected (Ksh)", "Collected (Ksh)", "Outstanding (Ksh)", "Tenants"]
      : ["Expected (Ksh)", "Collected (Ksh)", "Outstanding (Ksh)", "Tenants"]
    const data = rows.map(r => {
      const outstanding = Number(r.outstandingAmount)
      const cells = [
        { value: `Ksh ${Number(r.expectedRevenue).toLocaleString()}`, bold: true },
        { value: `Ksh ${Number(r.collectedRevenue).toLocaleString()}`, color: [5, 150, 105], bold: true },
        { value: `Ksh ${outstanding.toLocaleString()}`, color: outstanding <= 0 ? [5, 150, 105] : [225, 29, 72], bold: true },
        String(r.tenantCount)
      ]
      return isAllProps ? [r.propertyName, ...cells] : cells
    })
    exportToPDF(title, columns, data, propLabel, userName)
  }

  return (
    <>
      <div className="filters-section">
        {error && <p className="form-error">{error}</p>}
        <div className="filters-grid">
          <div className="filter-group">
            <label className="filter-label">Period Type <span className="required">*</span></label>
            <select className="filter-select" name="periodType" value={filters.periodType} onChange={handleChange}>
              <option value="">Select Period Type</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Year <span className="required">*</span></label>
            <select className="filter-select" name="year" value={filters.year} onChange={handleChange}>
              <option value="">Select Year</option>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <div className="filters-grid">
          {filters.periodType === 'monthly' && (
            <div className="filter-group">
              <label className="filter-label">Month <span className="required">*</span></label>
              <select className="filter-select" name="month" value={filters.month} onChange={handleChange}>
                <option value="">Select Month</option>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
          )}
          <div className="filter-group">
            <label className="filter-label">Property</label>
            <select className="filter-select" name="propertyId" value={filters.propertyId} onChange={handleChange}>
              <option value="">All Properties</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <div className="filters-actions">
          <button className="btn-generate" onClick={generate} disabled={loading}>
             <i className={loading ? "fas fa-spinner fa-spin" : "fas fa-chart-bar"} /> {loading ? 'Generating...' : 'Generate Report'}
          </button>
          <button className="btn-download-pdf" onClick={handleDownload} disabled={!generated || rows.length === 0}><i className="fas fa-download" /> Download PDF</button>
        </div>
      </div>

      {generated && (
        <div className="report-summary-cards">
          <div className="summary-card"><h4>Total Expected</h4><p>Ksh {rows.reduce((sum, r) => sum + Number(r.expectedRevenue), 0).toLocaleString()}</p></div>
          <div className="summary-card success"><h4>Total Collected</h4><p>Ksh {rows.reduce((sum, r) => sum + Number(r.collectedRevenue), 0).toLocaleString()}</p></div>
          <div className="summary-card warning"><h4>Outstanding</h4><p>Ksh {rows.reduce((sum, r) => sum + Number(r.outstandingAmount), 0).toLocaleString()}</p></div>
        </div>
      )}

      <div className="report-table-wrapper">
        <table className="report-table">
          <thead>
            <tr>
              {!filters.propertyId && <th>PROPERTY</th>}
              <th>EXPECTED REVENUE</th>
              <th>COLLECTED REVENUE</th>
              <th>OUTSTANDING AMOUNT</th>
              <th>NO. OF TENANTS</th>
            </tr>
          </thead>
          <tbody>
            {!generated && <tr><td colSpan={filters.propertyId ? 4 : 5} className="table-empty">Set filters and click Generate Report.</td></tr>}
            {generated && rows.length === 0 && <tr><td colSpan={filters.propertyId ? 4 : 5} className="table-empty">No records to display.</td></tr>}
            {rows.map((r, i) => (
              <tr key={i}>
                {!filters.propertyId && <td className="cell-bold">{r.propertyName}</td>}
                <td className="cell-amount">{`Ksh ${Number(r.expectedRevenue).toLocaleString()}`}</td>
                <td className="cell-amount positive">{`Ksh ${Number(r.collectedRevenue).toLocaleString()}`}</td>
                <td className={`cell-amount ${Number(r.outstandingAmount) <= 0 ? 'positive' : 'negative'}`}>{`Ksh ${Number(r.outstandingAmount).toLocaleString()}`}</td>
                <td className="cell-bold">{r.tenantCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ─── 6. Maintenance Report ────────────────────────────────────────────────────
function MaintenanceReport({ properties }) {
  const { authHeaders, user } = useAuth()
  const [propertyId, setPropertyId] = useState('')
  const [rows, setRows]             = useState([])
  const [generated, setGenerated]   = useState(false)
  const [loading, setLoading]       = useState(false)

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/reports/maintenance?propertyId=${propertyId}`, { headers: authHeaders() })
      const data = await res.json()
      
      const fetchedRows = data.data || data;
      if (Array.isArray(fetchedRows)) {
        setRows(fetchedRows)
        setGenerated(true)
      } else {
        alert(data.message || 'Error generating report')
      }
    } catch (err) {
      alert("Failed to connect to server")
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    const isAllProps = !propertyId
    const propLabel = isAllProps ? 'All Properties' : (properties.find(p => String(p.id) === String(propertyId))?.name || 'All Properties')
    const userName = user?.name || ''
    const columns = isAllProps
      ? ["Property Name", "Total Tickets", "Open", "In Progress", "Completed"]
      : ["Total Tickets", "Open", "In Progress", "Completed"]
    const data = rows.map(r => {
      const cells = [
        { value: String(r.totalTickets), bold: true },
        { value: String(r.open), color: Number(r.open) > 0 ? [225, 29, 72] : [15, 23, 42], bold: Number(r.open) > 0 },
        { value: String(r.inProgress), color: Number(r.inProgress) > 0 ? [245, 158, 11] : [15, 23, 42], bold: Number(r.inProgress) > 0 },
        { value: String(r.completed), color: Number(r.completed) > 0 ? [5, 150, 105] : [15, 23, 42], bold: Number(r.completed) > 0 }
      ]
      return isAllProps ? [r.propertyName, ...cells] : cells
    })
    exportToPDF('Maintenance Overview Report', columns, data, propLabel, userName)
  }

  return (
    <>
      <div className="filters-section">
        <div className="filters-grid">
          <div className="filter-group">
            <label className="filter-label">Property</label>
            <select className="filter-select" value={propertyId} onChange={e => setPropertyId(e.target.value)}>
              <option value="">All Properties</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <div className="filters-actions">
          <button className="btn-generate" onClick={generate} disabled={loading}>
             <i className={loading ? "fas fa-spinner fa-spin" : "fas fa-chart-bar"} /> {loading ? 'Generating...' : 'Generate Report'}
          </button>
          <button className="btn-download-pdf" onClick={handleDownload} disabled={!generated || rows.length === 0}><i className="fas fa-download" /> Download PDF</button>
        </div>
      </div>

      {generated && (
        <div className="report-summary-cards">
          <div className="summary-card"><h4>Total Tickets</h4><p>{rows.reduce((sum, r) => sum + Number(r.totalTickets), 0)}</p></div>
          <div className="summary-card warning"><h4>Open / In Progress</h4><p>{rows.reduce((sum, r) => sum + Number(r.open) + Number(r.inProgress), 0)}</p></div>
          <div className="summary-card success"><h4>Completed</h4><p>{rows.reduce((sum, r) => sum + Number(r.completed), 0)}</p></div>
        </div>
      )}

      <div className="report-table-wrapper">
        <table className="report-table">
          <thead>
            <tr>
              {!propertyId && <th>PROPERTY NAME</th>}
              <th>TOTAL TICKETS</th>
              <th>OPEN</th>
              <th>IN PROGRESS</th>
              <th>COMPLETED</th>
            </tr>
          </thead>
          <tbody>
            {!generated && <tr><td colSpan={propertyId ? 4 : 5} className="table-empty">Set filters and click Generate Report.</td></tr>}
            {generated && rows.length === 0 && <tr><td colSpan={propertyId ? 4 : 5} className="table-empty">No records to display.</td></tr>}
            {rows.map((r, i) => (
              <tr key={i}>
                {!propertyId && <td className="cell-bold">{r.propertyName}</td>}
                <td className="cell-bold">{r.totalTickets}</td>
                <td className="cell-bold negative">{r.open}</td>
                <td className="cell-bold" style={{color: '#f59e0b'}}>{r.inProgress}</td>
                <td className="cell-bold positive">{r.completed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ─── Main Reports page ─────────────────────────────────────────────────────────
const REPORT_TABS = [
  { key: 'tenant-statement',   label: 'Tenant Balances'    },
  { key: 'property-statement', label: 'Property Overview'  },
  { key: 'unit-status',        label: 'Unit Status'        },
  { key: 'tenant-directory',   label: 'Tenant Directory'   },
  { key: 'revenue',            label: 'Revenue Report'     },
  { key: 'maintenance',        label: 'Maintenance Report' },
]

export default function Reports() {
  const { authHeaders, user } = useAuth()
  const [activeTab, setActiveTab]   = useState('tenant-statement')
  const [properties, setProperties] = useState([])

  useEffect(() => {
    async function fetchProps() {
      try {
        const res = await fetch(`${API_URL}/properties`, { headers: authHeaders() })
        const data = await res.json()
        setProperties(data.data || [])
      } catch (error) {
        console.error('Failed to load properties', error)
      }
    }
    fetchProps()
  }, [])

  const REPORT_TITLES = {
    'tenant-statement':   'Tenant Balances Statement',
    'property-statement': 'Property Occupancy Statement',
    'unit-status':        'Unit Status & Rent Roll',
    'tenant-directory':   'Tenant Directory',
    'revenue':            'Revenue & Collections Report',
    'maintenance':        'Maintenance Overview Report',
  }

  return (
    <div className="reports-page">
      <div className="reports-tabs">
        {REPORT_TABS.map(tab => (
          <button
            key={tab.key}
            className={`report-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="report-card">
        <h2 className="report-title">{REPORT_TITLES[activeTab]}</h2>

        {activeTab === 'tenant-statement'   && <TenantStatement       properties={properties} />}
        {activeTab === 'property-statement' && <PropertyStatement     properties={properties} />}
        {activeTab === 'unit-status'        && <UnitStatusReport      properties={properties} />}
        {activeTab === 'tenant-directory'   && <TenantDirectoryReport properties={properties} />}
        {activeTab === 'revenue'            && <RevenueReport         properties={properties} />}
        {activeTab === 'maintenance'        && <MaintenanceReport     properties={properties} />}
      </div>
    </div>
  )
}