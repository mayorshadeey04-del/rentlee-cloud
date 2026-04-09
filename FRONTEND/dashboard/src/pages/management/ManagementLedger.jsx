import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import './ManagementLedger.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatCurrency(amount) {
  return `Ksh ${Number(amount || 0).toLocaleString()}`
}

export default function ManagementLedger() {
  const { authHeaders } = useAuth()
  
  // Selection State
  const [properties, setProperties] = useState([])
  const [tenants, setTenants] = useState([])
  const [selectedProperty, setSelectedProperty] = useState('')
  const [selectedTenant, setSelectedTenant] = useState('')

  // Ledger State
  const [ledgerData, setLedgerData] = useState([])
  const [tenantInfo, setTenantInfo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 1. Fetch all properties and tenants on load
  useEffect(() => {
    async function fetchDropdownData() {
      try {
        const [propRes, tenRes] = await Promise.all([
          fetch(`${API_URL}/properties`, { headers: authHeaders() }),
          fetch(`${API_URL}/tenants`, { headers: authHeaders() })
        ])
        const propData = await propRes.json()
        const tenData = await tenRes.json()
        
        setProperties(propData.data || [])
        setTenants(tenData.data || [])
      } catch (err) {
        console.error("Failed to load dropdowns", err)
      }
    }
    fetchDropdownData()
  }, [])

  // 2. Fetch ledger when a tenant is selected
  useEffect(() => {
    if (!selectedTenant) {
      setLedgerData([])
      setTenantInfo(null)
      return
    }

    async function fetchLedger() {
      try {
        setLoading(true)
        setError('')
        const res = await fetch(`${API_URL}/payments/ledger/admin/${selectedTenant}`, {
          headers: authHeaders()
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || 'Failed to fetch ledger')
        
        setLedgerData(data.data || [])
        setTenantInfo(data.tenantInfo || null)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchLedger()
  }, [selectedTenant])

  // Automatically filter tenants based on the selected property (Your brilliant UX idea!)
  const filteredTenants = selectedProperty 
    ? tenants.filter(t => String(t.property_id) === String(selectedProperty))
    : tenants

  const downloadPDF = () => {
    const doc = new jsPDF()
    const tenantName = tenantInfo?.full_name || 'Tenant'
    const unit = tenantInfo?.unit_number || 'N/A'
    const apartment = tenantInfo?.property_name || 'N/A'

    const generateContent = () => {
      doc.setFontSize(16)
      doc.setTextColor(51, 65, 85)
      doc.text('Statement of Account', 105, 38, { align: 'center' })

      doc.setFontSize(10)
      doc.setTextColor(15, 23, 42)
      doc.text(`Tenant: ${tenantName}`, 14, 48)
      doc.text(`Unit: ${unit}`, 14, 54)
      doc.text(`Apartment: ${apartment}`, 14, 60)
      doc.text(`Date Generated: ${new Date().toLocaleDateString('en-KE')}`, 14, 66)

      const tableColumns = ["Date", "Description", "Charge (Debit)", "Payment (Credit)", "Balance"]
      const tableRows = ledgerData.map(item => [
        formatDate(item.transaction_date),
        item.description,
        item.charge > 0 ? formatCurrency(item.charge) : '—',
        item.payment > 0 ? formatCurrency(item.payment) : '—',
        formatCurrency(item.running_balance)
      ])

      autoTable(doc, {
        startY: 72,
        head: [tableColumns],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: {
          2: { halign: 'right', textColor: [225, 29, 72] },
          3: { halign: 'right', textColor: [5, 150, 105] },
          4: { halign: 'right', fontStyle: 'bold' }
        }
      })

      doc.save(`Statement_${tenantName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`)
    }

    const logo = new Image()
    logo.src = '/logo.png'
    logo.onload = () => {
      doc.addImage(logo, 'PNG', 82.5, 15, 45, 12)
      generateContent()
    }
    logo.onerror = () => {
      doc.setFontSize(22)
      doc.setTextColor(30, 58, 138)
      doc.text('Rentlee', 105, 25, { align: 'center' })
      generateContent()
    }
  }

  return (
    <div className="management-ledger-page">
      <div className="ledger-header">
        <div>
          <h2 className="ledger-title">Tenant Ledgers</h2>
          <p className="ledger-sub">View and download statements of account for any tenant.</p>
        </div>
        <button className="btn-download" onClick={downloadPDF} disabled={ledgerData.length === 0 || !selectedTenant}>
          <i className="fas fa-file-pdf" /> Download PDF
        </button>
      </div>

      {/*  YOUR BRILLIANT SELECTION UI */}
      <div className="ledger-selection-panel">
        <div className="selection-group">
          <label>1. Filter by Property (Optional)</label>
          <select value={selectedProperty} onChange={(e) => { setSelectedProperty(e.target.value); setSelectedTenant(''); }}>
            <option value="">All Properties</option>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="selection-group">
          <label>2. Select Tenant to View Statement</label>
          <select value={selectedTenant} onChange={(e) => setSelectedTenant(e.target.value)}>
            <option value="">-- Select a Tenant --</option>
            {filteredTenants.map(t => (
              <option key={t.id} value={t.id}>
                {t.first_name} {t.last_name} (Unit {t.unit_number || 'N/A'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="ledger-error"> {error}</div>}

      <div className="ledger-table-container">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>DATE</th>
              <th>DESCRIPTION</th>
              <th className="align-right">CHARGE (OWE)</th>
              <th className="align-right">PAYMENT (PAID)</th>
              <th className="align-right">BALANCE</th>
            </tr>
          </thead>
          <tbody>
            {!selectedTenant && !loading && (
              <tr><td colSpan="5" className="table-empty"><i className="fas fa-search" style={{fontSize: '2rem', color: '#cbd5e1', marginBottom: '1rem', display: 'block'}}></i>Please select a tenant above to view their statement.</td></tr>
            )}
            {loading && <tr><td colSpan="5" className="table-empty"><i className="fas fa-spinner fa-spin" style={{marginRight: '0.5rem'}}></i> Loading statement...</td></tr>}
            {selectedTenant && !loading && ledgerData.length === 0 && (
              <tr><td colSpan="5" className="table-empty">No transactions found for this tenant.</td></tr>
            )}
            
            {selectedTenant && !loading && ledgerData.map((item, index) => (
              <tr key={item.ref_id + index}>
                <td className="ledger-date">{formatDate(item.transaction_date)}</td>
                <td>
                  <span className="ledger-desc">{item.description}</span>
                  <span className={`ledger-type-badge ${item.transaction_type}`}>{item.transaction_type}</span>
                </td>
                <td className="align-right charge-cell">{item.charge > 0 ? formatCurrency(item.charge) : '—'}</td>
                <td className="align-right payment-cell">{item.payment > 0 ? formatCurrency(item.payment) : '—'}</td>
                <td className="align-right balance-cell">{formatCurrency(item.running_balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}