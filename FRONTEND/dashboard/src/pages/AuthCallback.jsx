import { useEffect } from 'react'

// Receives token + user from landing page via URL params
// URL: /auth-callback?token=xxx&user={...json...}
export default function AuthCallback() {

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token  = params.get('token')
    const user   = params.get('user')

    if (token && user) {
      try {
        const userData = JSON.parse(decodeURIComponent(user))

        // Save to localStorage on this origin (localhost:5173)
        localStorage.setItem('rentlee_token', decodeURIComponent(token))
        localStorage.setItem('rentlee_user', JSON.stringify(userData))

        console.log('✅ Auth saved, redirecting:', userData.role)

        // Use full page reload so AuthContext re-initializes
        // fresh from localStorage — no race condition with state updates
        if (userData.role === 'tenant') {
          window.location.replace('/tenant/dashboard')
        } else {
          window.location.replace('/management/dashboard')
        }

      } catch (err) {
        console.error('Auth callback error:', err)
        window.location.replace('https://rentlee-cloud-l6ur.vercel.app/login.html')
      }
    } else {
      window.location.replace('https://rentlee-cloud-l6ur.vercel.app/login.html')
    }
  }, [])

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'DM Sans, sans-serif',
      color: '#64748B',
      fontSize: '1rem',
      gap: '0.75rem'
    }}>
      <div style={{
        width: '20px',
        height: '20px',
        border: '2px solid #E2E8F0',
        borderTop: '2px solid #3B82F6',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      Signing you in...
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}