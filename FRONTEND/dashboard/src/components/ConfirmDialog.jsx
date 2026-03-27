import { createPortal } from 'react-dom'

/**
 * ConfirmDialog — replaces window.confirm with a styled modal
 *
 * Usage:
 *   const [confirm, setConfirm] = useState(null) // { message, onConfirm }
 *
 *   // Trigger it:
 *   setConfirm({
 *     title: 'Delete Property',         // optional — defaults to 'Confirm Delete'
 *     message: 'This will delete...',
 *     onConfirm: () => { ... your delete logic ... }
 *   })
 *
 *   // Render it:
 *   {confirm && (
 *     <ConfirmDialog
 *       title={confirm.title}
 *       message={confirm.message}
 *       onConfirm={() => { confirm.onConfirm(); setConfirm(null) }}
 *       onCancel={() => setConfirm(null)}
 *     />
 *   )}
 */
export default function ConfirmDialog({ title = 'Confirm Delete', message, onConfirm, onCancel }) {
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
        {/* Red top stripe */}
        <div style={{ height: '4px', background: 'linear-gradient(90deg, #f87171, #ef4444)' }} />

        <div style={{ padding: '1.75rem 2rem' }}>
          {/* Icon */}
          <div style={{
            width: '52px', height: '52px', borderRadius: '50%',
            background: 'rgba(239,68,68,0.08)',
            border: '2px solid rgba(239,68,68,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '1rem', fontSize: '1.25rem', color: '#ef4444'
          }}>
            <i className="fas fa-trash-alt" />
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
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            color: '#fff', border: 'none', borderRadius: '10px',
            fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            boxShadow: '0 4px 12px rgba(239,68,68,0.3)'
          }}>Delete</button>
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