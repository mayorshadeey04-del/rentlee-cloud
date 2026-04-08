import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { can, isAssigned } from '../../utils/permissions'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './Dashboard.css'

export default function Dashboard() {
  const { user, authHeaders } = useAuth()
  const navigate = useNavigate()

  const [stats,           setStats]           = useState(null)
  const [maintenanceData, setMaintenanceData] = useState(null)
  const [properties,      setProperties]      = useState([])
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState(null)

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

  const formatCurrency = (amount) => {
    if (!amount || amount === 0) return 'Ksh 0'
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return `Ksh ${num.toLocaleString('en-KE')}`
  }

  const getPropertyStatus = (occupiedUnits, totalUnits) => {
    const vacant = totalUnits - occupiedUnits
    if (vacant === 0) return { type: 'full', label: 'Full', color: '#22c55e' }
    return { type: 'vacant', label: `${vacant} Vacant`, color: '#f97316' }
  }

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true)
        setError(null)

        // 1. GET Stats
        const statsRes = await fetch(`${API_URL}/dashboard/stats`, { headers: authHeaders() })
        if (!statsRes.ok) {
          if (statsRes.status === 401) {
            navigate('/')
            return
          }
          throw new Error('Failed to fetch stats')
        }

        const statsData = await statsRes.json()
        const rawStats = statsData.data || statsData
        
        setStats({
          totalProperties: rawStats.totalProperties || rawStats.total_properties || 0,
          monthlyRent: rawStats.monthlyRent || rawStats.monthly_rent || 0,
          activeTenants: rawStats.activeTenants || rawStats.active_tenants || 0,
          openRequests: rawStats.openRequests || rawStats.open_requests || 0
        })

        if (rawStats.maintenance) {
          setMaintenanceData({
             open: rawStats.maintenance.pending || 0,
             inProgress: rawStats.maintenance.in_progress || 0,
             complete: rawStats.maintenance.completed || 0
          });
        }

        // 2. GET Properties
        const propsRes = await fetch(`${API_URL}/properties`, { headers: authHeaders() })
        if (!propsRes.ok) throw new Error('Failed to fetch properties')

        const propsData = await propsRes.json()
        let propsList = propsData.data || propsData
        
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
        setProperties(propsList)

      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (user) loadDashboard()
  }, [navigate, user])

  const visibleProperties = user?.role === 'caretaker'
    ? properties.filter(p => isAssigned(user.assignedPropertyIds, p.propertyId))
    : properties

  const quickLinks = [
    { icon: 'fas fa-building', title: 'Add Property', desc: 'Register new property', path: '/management/properties', show: can(user?.role, 'properties', 'create') },
    { icon: 'fas fa-user-plus', title: 'Add Tenant', desc: 'Register new tenant', path: '/management/tenants', show: can(user?.role, 'tenants', 'create') },
    { icon: 'fas fa-comment-dots', title: 'Send Notice', desc: 'Bulk SMS / Email', path: '/management/tenants', show: can(user?.role, 'tenants', 'create') },
  ].filter(l => l.show)

  const pieData = maintenanceData ? [
    { name: 'Open', value: maintenanceData.open || 0, color: '#f97316' },
    { name: 'In Progress', value: maintenanceData.inProgress || 0, color: '#3b82f6' },
    { name: 'Complete', value: maintenanceData.complete || 0, color: '#22c55e' }
  ].filter(d => d.value > 0) : [];

  // 👇 The Premium Skeleton Loader
  if (loading) {
    return (
      <>
        <section className="stats-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="stat-card" style={{ border: '2px solid var(--slate-100)', boxShadow: 'none' }}>
              <div className="stat-card-header">
                <div className="skeleton skeleton-icon"></div>
              </div>
              <div className="skeleton skeleton-text" style={{ width: '50%' }}></div>
              <div className="skeleton skeleton-value"></div>
            </div>
          ))}
        </section>

        <section className="dashboard-grid">
          <div className="dashboard-card" style={{ border: '2px solid var(--slate-100)' }}>
            <div className="skeleton skeleton-title"></div>
            <div className="skeleton skeleton-chart"></div>
          </div>
          <div className="dashboard-card" style={{ border: '2px solid var(--slate-100)' }}>
            <div className="skeleton skeleton-title"></div>
            {[1, 2, 3].map(i => <div key={i} className="skeleton skeleton-btn"></div>)}
          </div>
        </section>

        <section className="properties-table-card" style={{ border: '2px solid var(--slate-100)' }}>
          <div className="skeleton skeleton-title" style={{ width: '25%' }}></div>
          <div style={{ marginTop: '2rem' }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton skeleton-table-row"></div>)}
          </div>
        </section>
      </>
    )
  }

  if (error) return <div className="dashboard-empty"><i className="fas fa-exclamation-circle" style={{ color: '#ef4444' }}></i><p>Error: {error}</p></div>

  return (
    <>
      <section className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-card-header"><div className="stat-card-icon"><i className="fas fa-building"></i></div></div>
          <div className="stat-card-label">Total Properties</div>
          <div className="stat-card-value">{stats?.totalProperties ?? 0}</div>
        </div>
        <div className="stat-card emerald">
          <div className="stat-card-header"><div className="stat-card-icon"><i className="fas fa-money-bill-wave"></i></div></div>
          <div className="stat-card-label">Monthly Rent</div>
          <div className="stat-card-value">{formatCurrency(stats?.monthlyRent)}</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-card-header"><div className="stat-card-icon"><i className="fas fa-users"></i></div></div>
          <div className="stat-card-label">Active Tenants</div>
          <div className="stat-card-value">{stats?.activeTenants ?? 0}</div>
        </div>
        <div className="stat-card rose">
          <div className="stat-card-header"><div className="stat-card-icon"><i className="fas fa-wrench"></i></div></div>
          <div className="stat-card-label">Open Requests</div>
          <div className="stat-card-value">{stats?.openRequests ?? 0}</div>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-card">
          <div className="dashboard-card-header"><h2 className="dashboard-card-title">Maintenance Requests</h2></div>
          <div className="dashboard-chart-container" style={{ height: '300px', width: '100%' }}>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} stroke="none">
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} iconType="rect" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="dashboard-empty"><i className="fas fa-chart-pie"></i><p>No maintenance data yet</p></div>
            )}
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-header"><h2 className="dashboard-card-title">Quick Links</h2></div>
          <div className="quick-links-list">
            {quickLinks.map(link => (
              <button key={link.title} className="quick-link-btn" onClick={() => navigate(link.path)}>
                <div className="quick-link-icon"><i className={link.icon}></i></div>
                <div className="quick-link-content">
                  <div className="quick-link-title">{link.title}</div>
                  <div className="quick-link-desc">{link.desc}</div>
                </div>
                <span className="quick-link-arrow"><i className="fas fa-arrow-right"></i></span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="properties-table-card">
        <div className="dashboard-card-header">
          <h2 className="dashboard-card-title">Properties Overview</h2>
          <Link to="/management/properties" className="dashboard-view-all">Manage all <i className="fas fa-arrow-right"></i></Link>
        </div>
        {visibleProperties.length === 0 ? (
          <div className="dashboard-empty"><i className="fas fa-building"></i><p>No properties to display</p></div>
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
                    <div className="property-location"><i className="fas fa-map-marker-alt"></i>{property.location}</div>
                  </td>
                  <td className="property-units">{property.occupiedUnits} / {property.totalUnits}</td>
                  <td className="property-rent">{formatCurrency(property.monthlyRent)}</td>
                  <td>
                    <span className={`status-badge ${property.status}`} style={{ background: property.statusColor + '20', color: property.statusColor, border: `1px solid ${property.statusColor}40` }}>
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