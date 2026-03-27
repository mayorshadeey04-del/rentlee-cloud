import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './context/AuthContext'
import App from './App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* AuthProvider wraps everything so any component can access user data */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
)