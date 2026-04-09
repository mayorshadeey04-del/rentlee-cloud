import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import './TenantMyUnit.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export default function TenantMyUnit() {
  const { user, authHeaders } = useAuth()
  const [unit, setUnit]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    async function fetchMyUnit() {
      try {
        setLoading(true)
        const res = await fetch(`${API_URL}/tenant-dashboard/my-unit`, {
          headers: authHeaders()
        })
        const data = await res.json()
        
        if (!res.ok) throw new Error(data.message)
        
        setUnit(data.data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchMyUnit()
  }, [])

  // ============================================================================
  // SKELETON LOADER
  // ============================================================================
  if (loading) {
    return (
      <div className="tenant-my-unit">
        <div className="unit-page-header">
          <div className="skeleton skeleton-title" style={{ width: '25%', marginBottom: '0.5rem' }}></div>
          <div className="skeleton skeleton-text" style={{ width: '40%' }}></div>
        </div>

        <div className="unit-grid">
          {/* Skeleton Card 1: Unit Overview */}
          <div className="unit-card">
            <div className="unit-card-header">
              <div className="skeleton skeleton-title" style={{ width: '40%', margin: 0, height: '1.5rem' }}></div>
              <div className="skeleton" style={{ width: '60px', height: '1.5rem', borderRadius: '8px' }}></div>
            </div>
            <div className="unit-card-body">
              <div className="skeleton" style={{ width: '120px', height: '4rem', marginBottom: '2rem', borderRadius: '8px' }}></div>
              
              <div className="unit-detail-grid">
                <div className="unit-detail-item">
                  <div className="skeleton skeleton-text" style={{ width: '40%', marginBottom: '0.25rem' }}></div>
                  <div className="skeleton skeleton-text" style={{ width: '80%', height: '1.25rem' }}></div>
                </div>
                <div className="unit-detail-item">
                  <div className="skeleton skeleton-text" style={{ width: '40%', marginBottom: '0.25rem' }}></div>
                  <div className="skeleton skeleton-text" style={{ width: '80%', height: '1.25rem' }}></div>
                </div>
                <div className="unit-detail-item" style={{ gridColumn: '1 / -1' }}> 
                  <div className="skeleton skeleton-text" style={{ width: '20%', marginBottom: '0.25rem' }}></div>
                  <div className="skeleton skeleton-text" style={{ width: '60%', height: '1.25rem' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Skeleton Card 2: Tenancy Details */}
          <div className="unit-card">
            <div className="unit-card-header">
              <div className="skeleton skeleton-title" style={{ width: '40%', margin: 0, height: '1.5rem' }}></div>
            </div>
            <div className="unit-card-body">
              <div className="tenancy-detail-list">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="tenancy-item">
                    <div className="skeleton skeleton-icon" style={{ margin: 0 }}></div>
                    <div style={{ flex: 1 }}>
                      <div className="skeleton skeleton-text" style={{ width: '30%', marginBottom: '0.35rem' }}></div>
                      <div className="skeleton skeleton-text" style={{ width: '50%', height: '1.25rem' }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="tenant-my-unit">
        <div style={{ padding: '2rem', color: '#ef4444', textAlign: 'center', background: '#fee2e2', borderRadius: '12px', border: '1px solid #fca5a5' }}>
           {error}
        </div>
      </div>
    )
  }

  return (
    <div className="tenant-my-unit">

      <div className="unit-page-header">
        <h2 className="unit-page-title">My Unit</h2>
        <p className="unit-page-sub">Your current unit and tenancy details</p>
      </div>

      {!unit ? (
        <div className="unit-empty">
          <i className="fas fa-home" />
          <p>No unit assigned yet</p>
        </div>
      ) : (
        <div className="unit-grid">

          {/* Unit Overview */}
          <div className="unit-card unit-overview">
            <div className="unit-card-header">
              <h3 className="unit-card-title">Unit Overview</h3>
              <span className={`status-badge ${unit.status?.toLowerCase()}`}>{unit.status}</span>
            </div>
            <div className="unit-card-body">
              <div className="unit-big-id">{unit.unitId}</div>
              
              <div className="unit-detail-grid">
                <div className="unit-detail-item">
                  <span className="unit-detail-label"><i className="fas fa-home" /> Type</span>
                  <span className="unit-detail-value">{unit.type}</span>
                </div>
                <div className="unit-detail-item">
                  <span className="unit-detail-label"><i className="fas fa-building" /> Property</span>
                  <span className="unit-detail-value">{unit.propertyName}</span>
                </div>
                <div className="unit-detail-item" style={{ gridColumn: '1 / -1' }}> 
                  <span className="unit-detail-label"><i className="fas fa-map-marker-alt" /> Location</span>
                  <span className="unit-detail-value">{unit.location}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tenancy Details */}
          <div className="unit-card">
            <div className="unit-card-header">
              <h3 className="unit-card-title">Tenancy Details</h3>
            </div>
            <div className="unit-card-body">
              <div className="tenancy-detail-list">
                <div className="tenancy-item">
                  <div className="tenancy-icon blue"><i className="fas fa-money-bill-wave" /></div>
                  <div>
                    <div className="tenancy-label">Monthly Rent</div>
                    <div className="tenancy-value">
                      {unit.rentAmount ? `Ksh ${Number(unit.rentAmount).toLocaleString()}` : '—'}
                    </div>
                  </div>
                </div>
                <div className="tenancy-item">
                  <div className="tenancy-icon emerald"><i className="fas fa-calendar-alt" /></div>
                  <div>
                    <div className="tenancy-label">Tenancy Start</div>
                    <div className="tenancy-value">{unit.tenancyStart ?? '—'}</div>
                  </div>
                </div>
                
                <div className="tenancy-item">
                  <div className="tenancy-icon amber"><i className="fas fa-calendar-check" /></div>
                  <div>
                    <div className="tenancy-label">Tenancy End</div>
                    <div className="tenancy-value" style={{ color: unit.tenancyEnd ? 'inherit' : '#059669' }}>
                      {unit.tenancyEnd ? unit.tenancyEnd : 'Ongoing (Open-ended)'}
                    </div>
                  </div>
                </div>
                
                <div className="tenancy-item">
                  <div className="tenancy-icon rose"><i className="fas fa-exclamation-circle" /></div>
                  <div>
                    <div className="tenancy-label">Rent Due Day</div>
                    <div className="tenancy-value">{unit.dueDayOfMonth ? `${unit.dueDayOfMonth}st of every month` : '—'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  )
}