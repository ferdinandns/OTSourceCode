import { useCallback } from "react"
import { useAuth } from "./useAuth"
import { API_BASE } from "../config"

const REFRESH_ENDPOINT = `${API_BASE}/api/refresh-token`
const STORAGE_KEYS = {
  accessToken: "auth_access_token",
  refreshToken: "auth_refresh_token",
  accessTokenExpiry: "auth_access_token_expiry",
}

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH"

interface ApiOptions {
  headers?: Record<string, string>
  signal?: AbortSignal
}

async function attemptRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken)
  if (!refreshToken) return null

  try {
    const res = await fetch(REFRESH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!res.ok) return null

    const data = await res.json()
    localStorage.setItem(STORAGE_KEYS.accessToken, data.access_token)
    localStorage.setItem(STORAGE_KEYS.refreshToken, data.refresh_token)
    localStorage.setItem(
      STORAGE_KEYS.accessTokenExpiry,
      String(Date.now() + 20 * 60 * 1000)
    )
    return data.access_token
  } catch {
    return null
  }
}

export function useApi() {
  const { logout } = useAuth()

  const request = useCallback(
    async <T = unknown>(
      path: string,
      method: HttpMethod = "GET",
      body?: unknown,
      options: ApiOptions = {}
    ): Promise<T> => {
      const url = path.startsWith("http") ? path : `${API_BASE}${path}`

      const makeRequest = async (token: string): Promise<Response> => {
        return fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...options.headers,
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: options.signal,
        })
      }

      const token = localStorage.getItem(STORAGE_KEYS.accessToken) ?? ""
      let res = await makeRequest(token)

      if (res.status === 401) {
        const errorData = await res.json().catch(() => ({}))
        const code = errorData?.code

        if (code === "IDLE_TIMEOUT" || code === "REFRESH_EXPIRED" || code === "REFRESH_INVALID") {
          logout()
          throw new Error(errorData.error ?? "Sesi berakhir, silakan login kembali")
        }

        const newToken = await attemptRefresh()
        if (!newToken) {
          logout()
          throw new Error("Sesi berakhir, silakan login kembali")
        }

        res = await makeRequest(newToken)

        if (res.status === 401) {
          logout()
          throw new Error("Sesi berakhir, silakan login kembali")
        }
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Request gagal" }))
        throw new Error(errData.error ?? `HTTP ${res.status}`)
      }

      const text = await res.text()
      if (!text) return {} as T

      return JSON.parse(text) as T
    },
    [logout]
  )

  return {
    get: <T = unknown>(path: string, options?: ApiOptions) =>
      request<T>(path, "GET", undefined, options),

    post: <T = unknown>(path: string, body?: unknown, options?: ApiOptions) =>
      request<T>(path, "POST", body, options),

    put: <T = unknown>(path: string, body?: unknown, options?: ApiOptions) =>
      request<T>(path, "PUT", body, options),

    patch: <T = unknown>(path: string, body?: unknown, options?: ApiOptions) =>
      request<T>(path, "PATCH", body, options),

    delete: <T = unknown>(path: string, options?: ApiOptions) =>
      request<T>(path, "DELETE", undefined, options),
  }
}