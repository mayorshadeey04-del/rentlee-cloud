import { createPortal } from 'react-dom'

/**
 * Toast — top-right notification pop-up
 *
 * Usage:
 *   const [toasts, setToasts] = useState([])
 *
 *   const showToast = useCallback((type, title, message) => {
 *     const id = Date.now()
 *     setToasts(t => [...t, { id, type, title, message }])
 *     setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
 *   }, [])
 *
 *   <Toast toasts={toasts} />
 *
 * type: 'success' | 'error'
 */
export default function Toast({ toasts }) {
  return createPortal(
    <div style={{
      position: 'fixed', top: '1.25rem', right: '1.25rem',
      zIndex: 99999, display: 'flex', flexDirection: 'column', gap: '0.625rem',
      pointerEvents: 'none'
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.875rem 1.25rem',
          background: t.type === 'success'
            ? 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)'
            : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          borderRadius: '14px',
          boxShadow: '0 8px 32px rgba(10,22,40,0.25)',
          border: 'none',
          minWidth: '280px', maxWidth: '360px',
          animation: 'toastSlideIn 0.35s cubic-bezier(0.34,1.56,0.64,1)',
          pointerEvents: 'auto'
        }}>
          {/* Icon */}
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
            background: 'rgba(255,255,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.875rem', color: '#fff'
          }}>
            <i className={t.type === 'success' ? 'fas fa-check' : 'fas fa-exclamation'} />
          </div>

          {/* Text */}
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '0.813rem', fontWeight: 700,
              color: '#fff', fontFamily: "'DM Sans', sans-serif",
              letterSpacing: '0.01em'
            }}>{t.title}</div>
            <div style={{
              fontSize: '0.75rem', color: 'rgba(255,255,255,0.85)',
              fontFamily: "'DM Sans', sans-serif", marginTop: '0.1rem'
            }}>{t.message}</div>
          </div>

          {/* Progress bar */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0,
            height: '3px', borderRadius: '0 0 14px 14px',
            background: 'rgba(255,255,255,0.4)',
            width: '100%',
            animation: 'toastProgress 3s linear forwards'
          }} />
        </div>
      ))}

      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(40px) scale(0.95); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes toastProgress {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  , document.body)
}