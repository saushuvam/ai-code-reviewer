import { useState, useEffect } from 'react'
import { AuthContext } from './authContextValue'
import { parseResponse } from '../services/apiClient'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'Content-Type': 'application/json' },
        })
        if (res.ok) {
          const data = await parseResponse(res, 'Session check failed')
          if (isMounted) setUser(data.user || null)
        } else {
          if (isMounted) setUser(null)
        }
      } catch {
        if (isMounted) setUser(null)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    checkAuth()

    return () => {
      isMounted = false
    }
  }, [])

  async function signin(email, password) {
    const res = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await parseResponse(res, 'Sign in failed')
    setUser(data.user)
    return data.user
  }

  async function signup(name, email, password, confirmPassword) {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, confirmPassword }),
    })
    const data = await parseResponse(res, 'Registration failed')
    setUser(data.user)
    return data.user
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signin, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
