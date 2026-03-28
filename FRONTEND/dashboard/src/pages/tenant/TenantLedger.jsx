import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import './TenantLedger.css'

const API_URL = 'http://localhost:5001/api'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatCurrency(amount) {
  return `Ksh ${Number(amount || 0).toLocaleString()}`
}

export default function TenantLedger() {
  const { user, authHeaders } = useAuth()
  const [ledgerData, setLedgerData] = useState([])
  const [tenantInfo, setTenantInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchLedger() {
      try {
        setLoading(true)
        const res = await fetch(`${API_URL}/payments/ledger`, {
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
  }, [])

  // ✅ UPDATED PDF GENERATOR WITH LOGO & EXACT ORDER
  const downloadPDF = () => {
    const doc = new jsPDF()
    const tenantName = tenantInfo?.full_name || user?.name || 'Tenant'
    const unit = tenantInfo?.unit_number || 'N/A'
    const apartment = tenantInfo?.property_name || 'N/A'

    // Helper function to build the text and table (called after logo loads)
    const generateContent = () => {
      doc.setFontSize(16)
      doc.setTextColor(51, 65, 85) // Slate
      doc.text('Statement of Account', 105, 38, { align: 'center' })

      doc.setFontSize(10)
      doc.setTextColor(15, 23, 42) // Navy text
      doc.text(`Tenant: ${tenantName}`, 14, 48)
      doc.text(`Unit: ${unit}`, 14, 54)
      doc.text(`Apartment: ${apartment}`, 14, 60)
      doc.text(`Date Generated: ${new Date().toLocaleDateString('en-KE')}`, 14, 66)

      // Table Data Mapping
      const tableColumns = ["Date", "Description", "Charge (Debit)", "Payment (Credit)", "Balance"]
      const tableRows = ledgerData.map(item => [
        formatDate(item.transaction_date),
        item.description,
        item.charge > 0 ? formatCurrency(item.charge) : '—',
        item.payment > 0 ? formatCurrency(item.payment) : '—',
        formatCurrency(item.running_balance)
      ])

      // Generate Table
      autoTable(doc, {
        startY: 72,
        head: [tableColumns],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: {
          2: { halign: 'right', textColor: [225, 29, 72] }, // Red for charges
          3: { halign: 'right', textColor: [5, 150, 105] }, // Green for payments
          4: { halign: 'right', fontStyle: 'bold' }
        }
      })

      doc.save(`Rentlee_Statement_${tenantName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`)
    }

    // Load the logo from the public folder
    const logo = new Image()
    logo.src = '/logo.png'
    logo.onload = () => {
      // Centering logic: A4 page is 210mm wide. 
      // If logo is 45mm wide: (210 - 45) / 2 = 82.5mm X-axis position.
      doc.addImage(logo, 'PNG', 82.5, 15, 45, 12)
      generateContent()
    }
    logo.onerror = () => {
      // Fallback just in case the logo image fails to load
      doc.setFontSize(22)
      doc.setTextColor(30, 58, 138)
      doc.text('Rentlee', 105, 25, { align: 'center' })
      generateContent()
    }
  }

  return (
    <div className="tenant-ledger-page">
      <div className="ledger-header">
        <div>
          <h2 className="ledger-title">Ledger Statement</h2>
          <p className="ledger-sub">A complete timeline of your charges and payments.</p>
        </div>
        <button className="btn-download" onClick={downloadPDF} disabled={ledgerData.length === 0}>
          <i className="fas fa-file-pdf" /> Download PDF
        </button>
      </div>

      {error && (
        <div className="ledger-error">
          ⚠️ {error}
        </div>
      )}

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
            {loading && <tr><td colSpan="5" className="table-empty">Loading your statement...</td></tr>}
            {!loading && ledgerData.length === 0 && (
              <tr><td colSpan="5" className="table-empty">No transactions found.</td></tr>
            )}
            
            {!loading && ledgerData.map((item, index) => (
              <tr key={item.ref_id + index}>
                <td className="ledger-date">{formatDate(item.transaction_date)}</td>
                <td>
                  <span className="ledger-desc">{item.description}</span>
                  <span className={`ledger-type-badge ${item.transaction_type}`}>
                    {item.transaction_type}
                  </span>
                </td>
                <td className="align-right charge-cell">
                  {item.charge > 0 ? formatCurrency(item.charge) : '—'}
                </td>
                <td className="align-right payment-cell">
                  {item.payment > 0 ? formatCurrency(item.payment) : '—'}
                </td>
                <td className="align-right balance-cell">
                  {formatCurrency(item.running_balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}