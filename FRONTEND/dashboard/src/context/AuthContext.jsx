import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {

  // Single state — initialized synchronously from localStorage
  // By the time any component renders, user is already set correctly
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('rentlee_user')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  function login(userData) {
    // Write to localStorage first, then update state
    localStorage.setItem('rentlee_user', JSON.stringify(userData))
    localStorage.setItem('rentlee_token', localStorage.getItem('rentlee_token') || '')
    setUser(userData)
  }

  function logout() {
    localStorage.removeItem('rentlee_user')
    localStorage.removeItem('rentlee_token')
    setUser(null)
  }

  function authHeaders() {
    const token = localStorage.getItem('rentlee_token')
    return token
      ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      : { 'Content-Type': 'application/json' }
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, authHeaders }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}