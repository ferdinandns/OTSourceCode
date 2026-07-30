import { useState } from "react"
import { useAuth } from "../hooks/useAuth"
import { useNavigate } from "react-router-dom"
import type { User, Division } from "../context/auth-context"
import B7LogoWhite from "../assets/B7-logo-nobg.png"
import B7Background from "../assets/B7.jpg"
import { API_BASE } from "../config"

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  return (
    <div className="fixed top-6 right-6 z-50 animate-slide-in">
      <div className={`flex items-center gap-3 px-5 py-3 rounded-lg shadow-xl border-2 min-w-[320px] ${
        type === "success"
          ? "bg-green-50 border-green-500 text-green-800"
          : "bg-red-50 border-red-500 text-red-800"
      }`}>
        {type === "success" ? (
          <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        <p className="font-medium text-sm">{message}</p>
        <button onClick={onClose} className="ml-auto text-current hover:opacity-70">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
)
const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.584 10.587A2 2 0 0012 14a2 2 0 001.414-.586m2.122-2.122A9.956 9.956 0 0121 12c-1.274 4.057-5.065 7-9.542 7a9.956 9.956 0 01-5.774-1.774M6.223 6.223A9.956 9.956 0 0112 5c4.477 0 8.268 2.943 9.542 7" />
  </svg>
)

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [identifier, setIdentifier] = useState<string>("")
  const [password, setPassword] = useState<string>("")
  const [showPassword, setShowPassword] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const handleLogin = async (): Promise<void> => {
    if (!identifier.trim() || !password.trim()) {
      showToast("Nama/Email dan Password wajib diisi!", "error")
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      })

      const data = await res.json()

      if (!res.ok) {
        showToast(data.error || "Login gagal!", "error")
        return
      }

      const userData: User = {
        id: data.id,
        name: data.name,
        email: data.email,
        division: data.division as Division,
      }

      login(userData, data.access_token, data.refresh_token)

      showToast(`Selamat datang, ${data.name}!`, "success")
      setTimeout(() => navigate("/dashboard"), 500)
    } catch {
      showToast("Tidak dapat terhubung ke server.", "error")
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin()
  }

  return (
    <>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div
        className="h-screen w-full bg-cover bg-center flex items-center justify-center"
        style={{ backgroundImage: `url(${B7Background})` }}
      >
        <div className="bg-white/70 backdrop-blur-sm p-10 rounded-xl w-[400px] text-[#2e3192] shadow-lg">
          <div className="flex flex-col items-center mb-6">
            <img src={B7LogoWhite} alt="B7 Logo" className="w-[150px] object-contain" />
            <h1 className="text-2xl font-bold text-center text-[#2e3192] -mt-2">
              Technical Service Monitoring & Management System
            </h1>
          </div>

          <div className="flex flex-col gap-4">
            <input
              id="identifier"
              name="identifier"
              type="text"
              placeholder="Name or Email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              autoComplete="username"
              className="p-2 rounded text-black border border-gray-300 focus:outline-none focus:border-[#2e3192] transition-colors disabled:opacity-60"
            />

            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                autoComplete="current-password"
                className="p-2 rounded pr-10 text-black w-full border border-gray-300 focus:outline-none focus:border-[#2e3192] transition-colors disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-500 hover:text-[#2e3192] transition"
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className="bg-[#2e3192] hover:bg-[#80bc00] p-2 rounded text-white font-semibold transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {loading ? "Masuk..." : "Login"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
      `}</style>
    </>
  )
}