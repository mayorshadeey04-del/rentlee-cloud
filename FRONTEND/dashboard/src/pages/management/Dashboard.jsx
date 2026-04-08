import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { can, isAssigned } from '../../utils/permissions'
import Chart from 'chart.js/auto';
import './Dashboard.css'

export default function Dashboard() {
  const { user, authHeaders } = useAuth()
  const navigate = useNavigate()
  const chartRef      = useRef(null)
  const chartInstance = useRef(null)

  const [stats,           setStats]           = useState(null)
  const [maintenanceData, setMaintenanceData] = useState(null)
  const [properties,      setProperties]      = useState([])
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState(null)

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

  // ✅ Format currency with commas
  const formatCurrency = (amount) => {
    if (!amount || amount === 0) return 'Ksh 0'
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return `Ksh ${num.toLocaleString('en-KE')}`
  }

  // ✅ Calculate status based on occupancy
  const getPropertyStatus = (occupiedUnits, totalUnits) => {
    const vacant = totalUnits - occupiedUnits
    
    if (vacant === 0) {
      return { type: 'full', label: 'Full', color: '#22c55e' }
    } else {
      return { type: 'vacant', label: `${vacant} Vacant`, color: '#f97316' }
    }
  }

  // ── Fetch dashboard data from backend ──────────────────────
  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true)
        setError(null)

        console.log('📥 Loading dashboard data...')

        // ✅ 1. GET /api/dashboard/stats
        const statsRes = await fetch(`${API_URL}/dashboard/stats`, { 
          headers: authHeaders()
        })
        
        if (!statsRes.ok) {
          if (statsRes.status === 401) {
            console.error('❌ Unauthorized - redirecting to login')
            navigate('/')
            return
          }
          throw new Error('Failed to fetch stats')
        }

        const statsData = await statsRes.json()
        console.log('✅ Raw stats data:', statsData)
        
        // ✅ Normalize stats data
        const rawStats = statsData.data || statsData
        const normalizedStats = {
          totalProperties: rawStats.totalProperties || rawStats.total_properties || 0,
          monthlyRent: rawStats.monthlyRent || rawStats.monthly_rent || 0,
          activeTenants: rawStats.activeTenants || rawStats.active_tenants || 0,
          openRequests: rawStats.openRequests || rawStats.open_requests || 0
        }
        
        console.log('✅ Normalized stats:', normalizedStats)
        setStats(normalizedStats)

        // ✅ Pull chart data directly from the pre-calculated stats payload
        if (rawStats.maintenance) {
          setMaintenanceData({
             open: rawStats.maintenance.pending || 0,
             inProgress: rawStats.maintenance.in_progress || 0,
             complete: rawStats.maintenance.completed || 0
          });
        }

        // ✅ 2. GET /api/properties
        const propsRes = await fetch(`${API_URL}/properties`, { 
          headers: authHeaders() 
        })
        
        if (!propsRes.ok) {
          throw new Error('Failed to fetch properties')
        }

        const propsData = await propsRes.json()
        console.log('✅ Raw properties data:', propsData)
        
        let propsList = propsData.data || propsData
        
        // ✅ Normalize properties with proper calculations
        propsList = propsList.map(prop => {
          const totalUnits = prop.total_units || prop.totalUnits || 0
          const occupiedUnits = prop.occupied_units || prop.occupiedUnits || 0
          const monthlyRent = prop.monthly_rent || prop.monthlyRent || 0
          const status = getPropertyStatus(occupiedUnits, totalUnits)
          
          return {
            id: prop.id,
            name: prop.name,
            location: prop.location,
            totalUnits,
            occupiedUnits,
            vacantCount: totalUnits - occupiedUnits,
            monthlyRent,
            status: status.type,
            statusLabel: status.label,
            statusColor: status.color,
            propertyId: prop.id
          }
        })
        
        console.log('✅ Normalized properties:', propsList)
        setProperties(propsList)

      } catch (err) {
        console.error('❌ Dashboard fetch error:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      loadDashboard()
    }
  }, [navigate, user])

  // ── Chart.js pie chart ─────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current || !maintenanceData) return

    if (chartInstance.current) chartInstance.current.destroy()

    // Grab the 2D context explicitly to fix the blank rendering bug
    const ctx = chartRef.current.getContext('2d');

    chartInstance.current = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Open', 'In Progress', 'Complete'],
        datasets: [{
          data: [
            maintenanceData.open || 0, 
            maintenanceData.inProgress || 0, 
            maintenanceData.complete || 0
          ],
          backgroundColor: ['#f97316', '#3b82f6', '#22c55e'],
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { padding: 20, font: { family: 'DM Sans', size: 13 } },
          },
        },
      },
    })

    return () => { if (chartInstance.current) chartInstance.current.destroy() }
  }, [maintenanceData])

  // Caretaker sees only their assigned properties
  const visibleProperties = user?.role === 'caretaker'
    ? properties.filter(p => isAssigned(user.assignedPropertyIds, p.propertyId))
    : properties

  // Quick links filtered by role
  const quickLinks = [
    {
      icon: 'fas fa-building',
      title: 'Add Property',
      desc: 'Register new property',
      path: '/management/properties',
      show: can(user?.role, 'properties', 'create'),
    },
    {
      icon: 'fas fa-user-plus',
      title: 'Add Tenant',
      desc: 'Register new tenant',
      path: '/management/tenants',
      show: can(user?.role, 'tenants', 'create'),
    },
    {
      icon: 'fas fa-comment-dots',
      title: 'Send Notice',
      desc: 'Bulk SMS / Email',
      path: '/management/tenants',
      show: can(user?.role, 'tenants', 'create'),
    },
  ].filter(l => l.show)

  // ── Loading state ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="dashboard-empty">
        <i className="fas fa-circle-notch fa-spin"></i>
        <p>Loading dashboard...</p>
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────
  if (error) {
    return (
      <div className="dashboard-empty">
        <i className="fas fa-exclamation-circle" style={{ color: '#ef4444' }}></i>
        <p>Error loading dashboard: {error}</p>
        <button 
          onClick={() => window.location.reload()} 
          style={{ 
            marginTop: '1rem', 
            padding: '0.5rem 1rem', 
            cursor: 'pointer',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px'
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <>
      {/* ── Stat Cards ─────────────────────────────────────────── */}
      <section className="stats-grid">

        <div className="stat-card blue">
          <div className="stat-card-header">
            <div className="stat-card-icon"><i className="fas fa-building"></i></div>
          </div>
          <div className="stat-card-label">Total Properties</div>
          <div className="stat-card-value">{stats?.totalProperties ?? 0}</div>
        </div>

        <div className="stat-card emerald">
          <div className="stat-card-header">
            <div className="stat-card-icon"><i className="fas fa-money-bill-wave"></i></div>
          </div>
          <div className="stat-card-label">Monthly Rent</div>
          <div className="stat-card-value">{formatCurrency(stats?.monthlyRent)}</div>
        </div>

        <div className="stat-card amber">
          <div className="stat-card-header">
            <div className="stat-card-icon"><i className="fas fa-users"></i></div>
          </div>
          <div className="stat-card-label">Active Tenants</div>
          <div className="stat-card-value">{stats?.activeTenants ?? 0}</div>
        </div>

        <div className="stat-card rose">
          <div className="stat-card-header">
            <div className="stat-card-icon"><i className="fas fa-wrench"></i></div>
          </div>
          <div className="stat-card-label">Open Requests</div>
          <div className="stat-card-value">{stats?.openRequests ?? 0}</div>
        </div>

      </section>

      {/* ── Chart + Quick Links ────────────────────────────────── */}
      <section className="dashboard-grid">

        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <h2 className="dashboard-card-title">Maintenance Requests</h2>
          </div>
          {/* Override flexbox display with block, and provide an explicit height so Chart.js doesn't collapse */}
          <div className="dashboard-chart-container" style={{ display: 'block', position: 'relative', height: '320px', width: '100%' }}>
            {maintenanceData && (maintenanceData.open > 0 || maintenanceData.inProgress > 0 || maintenanceData.complete > 0)
              ? <canvas ref={chartRef} width="300" height="300"></canvas>
              : <div className="dashboard-empty"><i className="fas fa-chart-pie"></i><p>No maintenance data yet</p></div>
            }
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <h2 className="dashboard-card-title">Quick Links</h2>
          </div>
          <div className="quick-links-list">
            {quickLinks.length > 0 ? (
              quickLinks.map(link => (
                <button
                  key={link.title}
                  className="quick-link-btn"
                  onClick={() => navigate(link.path)}
                >
                  <div className="quick-link-icon"><i className={link.icon}></i></div>
                  <div className="quick-link-content">
                    <div className="quick-link-title">{link.title}</div>
                    <div className="quick-link-desc">{link.desc}</div>
                  </div>
                  <span className="quick-link-arrow"><i className="fas fa-arrow-right"></i></span>
                </button>
              ))
            ) : (
              <div className="dashboard-empty">
                <i className="fas fa-link"></i>
                <p>No quick actions available</p>
              </div>
            )}
          </div>
        </div>

      </section>

      {/* ── Properties Overview ────────────────────────────────── */}
      <section className="properties-table-card">
        <div className="dashboard-card-header">
          <h2 className="dashboard-card-title">Properties Overview</h2>
          <Link to="/management/properties" className="dashboard-view-all">
            Manage all <i className="fas fa-arrow-right"></i>
          </Link>
        </div>

        {visibleProperties.length === 0 ? (
          <div className="dashboard-empty">
            <i className="fas fa-building"></i>
            <p>No properties to display</p>
          </div>
        ) : (
          <table className="properties-table">
            <thead>
              <tr>
                <th>PROPERTY</th>
                <th>UNITS</th>
                <th>MONTHLY RENT</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {visibleProperties.map(property => (
                <tr key={property.id}>
                  <td>
                    <div className="property-name">{property.name}</div>
                    <div className="property-location">
                      <i className="fas fa-map-marker-alt"></i>
                      {property.location}
                    </div>
                  </td>
                  <td className="property-units">
                    {property.occupiedUnits} / {property.totalUnits}
                  </td>
                  <td className="property-rent">{formatCurrency(property.monthlyRent)}</td>
                  <td>
                    <span 
                      className={`status-badge ${property.status}`}
                      style={{ 
                        background: property.statusColor + '20',
                        color: property.statusColor,
                        border: `1px solid ${property.statusColor}40`
                      }}
                    >
                      {property.statusLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}