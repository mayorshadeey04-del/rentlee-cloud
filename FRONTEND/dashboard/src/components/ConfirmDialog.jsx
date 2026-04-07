import { createPortal } from 'react-dom'

export default function ConfirmDialog({ title = 'Confirm Action', message, onConfirm, onCancel, confirmText = 'Confirm', type = 'danger' }) {
  
  const isDanger = type === 'danger';
  const colorHex = isDanger ? '#ef4444' : '#10b981';
  const gradient = isDanger ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #10b981, #059669)';
  const iconBg   = isDanger ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)';
  const iconBorder = isDanger ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)';
  const iconClass = isDanger ? 'fas fa-exclamation-triangle' : 'fas fa-check-circle';

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0,
      width: '100vw', height: '100vh',
      background: 'rgba(10,22,40,0.55)',
      zIndex: 99998, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      padding: '2rem', boxSizing: 'border-box'
    }}>
      <div style={{
        background: '#fff', borderRadius: '20px',
        width: '90%', maxWidth: '420px',
        boxShadow: '0 20px 60px rgba(10,22,40,0.25)',
        overflow: 'hidden',
        animation: 'confirmSlideIn 0.25s cubic-bezier(0.34,1.56,0.64,1)'
      }}>
        {/* Top stripe */}
        <div style={{ height: '4px', background: gradient }} />

        <div style={{ padding: '1.75rem 2rem' }}>
          {/* Icon */}
          <div style={{
            width: '52px', height: '52px', borderRadius: '50%',
            background: iconBg, border: `2px solid ${iconBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '1rem', fontSize: '1.25rem', color: colorHex
          }}>
            <i className={iconClass} />
          </div>

          {/* Title */}
          <h3 style={{
            fontFamily: "'Darker Grotesque', sans-serif",
            fontSize: '1.25rem', fontWeight: 700,
            color: '#0f172a', margin: '0 0 0.5rem'
          }}>{title}</h3>

          {/* Message */}
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.9rem', color: '#64748b',
            margin: 0, lineHeight: 1.6
          }}>{message}</p>
        </div>

        {/* Buttons */}
        <div style={{
          padding: '1rem 2rem 1.5rem',
          display: 'flex', gap: '0.75rem', justifyContent: 'flex-end'
        }}>
          <button onClick={onCancel} style={{
            padding: '0.75rem 1.5rem', background: '#fff', color: '#0f172a',
            border: '1.5px solid #e2e8f0', borderRadius: '10px',
            fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif", transition: 'all 0.2s'
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            padding: '0.75rem 1.5rem',
            background: gradient,
            color: '#fff', border: 'none', borderRadius: '10px',
            fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            boxShadow: `0 4px 12px ${iconBorder}`
          }}>{confirmText}</button>
        </div>
      </div>

      <style>{`
        @keyframes confirmSlideIn {
          from { opacity: 0; transform: translateY(-16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  , document.body)
}