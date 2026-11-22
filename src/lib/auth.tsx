import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { get, post } from './api'

export interface User {
  id: number
  name: string
  email: string
  role: string
  active: boolean
  studentId: string | null
  emailVerified: boolean
  mfaEnabled: boolean
  phone: string | null
  phoneVerified: boolean
  createdAt: string
  lastLoginAt: string | null
  organizationId: number | null
  platformAdmin: boolean
  orgAdmin: boolean
  ageConfirmed: boolean
  termsAccepted: boolean
  termsAcceptedAt: string | null
  digestOptIn: boolean
}

interface AuthContextType {
  user: User | null
  csrf: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: any) => Promise<{ user: User; csrf: string; devCode?: string }>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  isAuthenticated: () => boolean
  isAdmin: () => boolean
  isOrgAdmin: () => boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [csrf, setCsrf] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const isAuthenticated = useCallback(() => user !== null, [user])
  const isAdmin = useCallback(() => user?.role === 'admin', [user])
  const isOrgAdmin = useCallback(() => user?.role === 'org_admin', [user])

  useEffect(() => {
    refresh()
  }, [])

  const refresh = useCallback(async () => {
    try {
      const data = await get<{ user: User; csrf: string }>('/api/auth/me')
      setUser(data.user)
      setCsrf(data.csrf)
    } catch {
      setUser(null)
      setCsrf(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const login = async (email: string, password: string) => {
    const data = await post<{ user: User; csrf: string }>('/api/auth/login', { email, password })
    setUser(data.user)
    setCsrf(data.csrf)
  }

  const register = async (data: any): Promise<{ user: User; csrf: string; devCode?: string }> => {
    const res = await post<{ user: User; csrf: string; devCode?: string }>('/api/auth/register', data)
    setUser(res.user)
    setCsrf(res.csrf)
    return res
  }

  const logout = async () => {
    try {
      await post('/api/auth/logout', {})
    } catch {
      // ignore
    }
    setUser(null)
    setCsrf(null)
  }

  return (
    <AuthContext.Provider value={{ user, csrf, loading, login, register, logout, refresh, isAuthenticated, isAdmin, isOrgAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
