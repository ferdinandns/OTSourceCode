import { useEffect, useRef, useState, useCallback, type ReactNode } from "react"
import { AuthContext, type User } from "./auth-context"
import { API_BASE } from "../config"

const STORAGE_KEYS = {
  user:           "auth_user",
  accessToken:    "auth_access_token",
  refreshToken:   "auth_refresh_token",
  absoluteExpiry: "auth_absolute_expiry",
  lastActivity:   "auth_last_activity",
} as const

const REFRESH_MARGIN_MS        = 60 * 1000
const ACCESS_TOKEN_DURATION_MS = 20 * 60 * 1000
const IDLE_TIMEOUT_MS          = 24 * 60 * 60 * 1000

interface StoredSession {
  user: User
  accessTokenExpiry: number
  absoluteExpiry: number
  lastActivity: number
}

function clearStorage() {
  Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k))
  localStorage.removeItem("auth_access_token_expiry")
}

function readInitialSession(): { user: User | null; accessToken: string | null; session: StoredSession | null } {
  try {
    const rawUser           = localStorage.getItem(STORAGE_KEYS.user)
    const rawAccessToken    = localStorage.getItem(STORAGE_KEYS.accessToken)
    const rawAccessExpiry   = localStorage.getItem("auth_access_token_expiry")
    const rawAbsoluteExpiry = localStorage.getItem(STORAGE_KEYS.absoluteExpiry)
    const rawLastActivity   = localStorage.getItem(STORAGE_KEYS.lastActivity)

    if (!rawUser || !rawAccessToken || !rawAbsoluteExpiry || !rawLastActivity) {
      return { user: null, accessToken: null, session: null }
    }

    const now            = Date.now()
    const absoluteExpiry = Number(rawAbsoluteExpiry)
    const lastActivity   = Number(rawLastActivity)

    if (now > absoluteExpiry || now - lastActivity > IDLE_TIMEOUT_MS) {
      clearStorage()
      return { user: null, accessToken: null, session: null }
    }

    return {
      user: JSON.parse(rawUser) as User,
      accessToken: rawAccessToken,
      session: {
        user: JSON.parse(rawUser) as User,
        accessTokenExpiry: Number(rawAccessExpiry ?? 0),
        absoluteExpiry,
        lastActivity,
      },
    }
  } catch {
    return { user: null, accessToken: null, session: null }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = readInitialSession()

  const [user, setUser]                    = useState<User | null>(initial.user)
  const [accessToken, setAccessTokenState] = useState<string | null>(initial.accessToken)

  const refreshTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleRefreshRef = useRef<(expiry: number) => void>(() => {})
  const initialSessionRef  = useRef<StoredSession | null>(initial.session)

  const logout = useCallback((callAPI = true) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)

    if (callAPI) {
      const token = localStorage.getItem(STORAGE_KEYS.accessToken)
      if (token) {
        fetch(`${API_BASE}/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {})
      }
    }

    clearStorage()
    setUser(null)
    setAccessTokenState(null)
  }, [])

  const scheduleRefresh = useCallback((accessTokenExpiry: number) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    const delay = accessTokenExpiry - Date.now() - REFRESH_MARGIN_MS
    if (delay <= 0) return

    refreshTimerRef.current = setTimeout(() => {
      const storedRefresh = localStorage.getItem(STORAGE_KEYS.refreshToken)
      if (!storedRefresh) { logout(false); return }

      fetch(`${API_BASE}/refresh-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: storedRefresh }),
      })
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data) => {
          const newExpiry = Date.now() + ACCESS_TOKEN_DURATION_MS
          localStorage.setItem(STORAGE_KEYS.accessToken,   data.access_token)
          localStorage.setItem(STORAGE_KEYS.refreshToken,  data.refresh_token)
          localStorage.setItem("auth_access_token_expiry", String(newExpiry))
          setAccessTokenState(data.access_token)
          scheduleRefreshRef.current(newExpiry)
        })
        .catch(() => logout(false))
    }, delay)
  }, [logout])

  useEffect(() => {
    scheduleRefreshRef.current = scheduleRefresh
  }, [scheduleRefresh])

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    const storedRefresh = localStorage.getItem(STORAGE_KEYS.refreshToken)
    if (!storedRefresh) { logout(false); return null }

    try {
      const res = await fetch(`${API_BASE}/refresh-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: storedRefresh }),
      })
      if (!res.ok) { logout(false); return null }

      const data      = await res.json()
      const newExpiry = Date.now() + ACCESS_TOKEN_DURATION_MS
      localStorage.setItem(STORAGE_KEYS.accessToken,   data.access_token)
      localStorage.setItem(STORAGE_KEYS.refreshToken,  data.refresh_token)
      localStorage.setItem("auth_access_token_expiry", String(newExpiry))
      setAccessTokenState(data.access_token)
      scheduleRefresh(newExpiry)
      return data.access_token
    } catch {
      logout(false)
      return null
    }
  }, [logout, scheduleRefresh])

  const login = useCallback((userData: User, newAccessToken: string, newRefreshToken: string) => {
    const now            = Date.now()
    const accessExpiry   = now + ACCESS_TOKEN_DURATION_MS
    const absoluteExpiry = now + 7 * 24 * 60 * 60 * 1000

    localStorage.setItem(STORAGE_KEYS.user,           JSON.stringify(userData))
    localStorage.setItem(STORAGE_KEYS.accessToken,    newAccessToken)
    localStorage.setItem(STORAGE_KEYS.refreshToken,   newRefreshToken)
    localStorage.setItem("auth_access_token_expiry",  String(accessExpiry))
    localStorage.setItem(STORAGE_KEYS.absoluteExpiry, String(absoluteExpiry))
    localStorage.setItem(STORAGE_KEYS.lastActivity,   String(now))

    setUser(userData)
    setAccessTokenState(newAccessToken)
    scheduleRefresh(accessExpiry)
  }, [scheduleRefresh])

  const updateActivity = useCallback(() => {
    localStorage.setItem(STORAGE_KEYS.lastActivity, String(Date.now()))
  }, [])

  useEffect(() => {
    const session = initialSessionRef.current
    if (!session) return

    const now = Date.now()
    if (now < session.accessTokenExpiry - REFRESH_MARGIN_MS) {
      scheduleRefresh(session.accessTokenExpiry)
    } else {
      setTimeout(() => { refreshAccessToken() }, 0)
    }
  }, [scheduleRefresh, refreshAccessToken])

  useEffect(() => {
    if (!user) return

    const events = ["mousedown", "keydown", "touchstart", "scroll"] as const
    events.forEach((e) => window.addEventListener(e, updateActivity, { passive: true }))

    const idleCheck = setInterval(() => {
      const last = Number(localStorage.getItem(STORAGE_KEYS.lastActivity) ?? 0)
      if (Date.now() - last > IDLE_TIMEOUT_MS) logout(false)
    }, 5 * 60 * 1000)

    return () => {
      events.forEach((e) => window.removeEventListener(e, updateActivity))
      clearInterval(idleCheck)
    }
  }, [user, updateActivity, logout])

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        login,
        logout: () => logout(true),
        setAccessToken: setAccessTokenState,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}