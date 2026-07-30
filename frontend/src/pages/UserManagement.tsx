import { useState, useEffect, useCallback } from "react"
import { addUser, updateUser, deleteUser, type UserData } from "../utils/userStorage"
import { useTheme } from "../hooks/useTheme"
import { useAuth } from "../hooks/useAuth"
import { API_BASE } from "../config"

function encodePassword(password: string): string {
  const ascii = password.split("").map((c) => c.charCodeAt(0)).join(",")
  return btoa(ascii)
}

const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
)
const EyeOffIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3l18 18M10.584 10.587A2 2 0 0012 14a2 2 0 001.414-.586m2.122-2.122A9.956 9.956 0 0121 12c-1.274 4.057-5.065 7-9.542 7a9.956 9.956 0 01-5.774-1.774M6.223 6.223A9.956 9.956 0 0112 5c4.477 0 8.268 2.943 9.542 7" />
  </svg>
)
const CopyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
)
const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
  </svg>
)
const PlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)
const CloseIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)
const EmptyIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
)
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
  </svg>
)

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  return (
    <div className="fixed top-6 right-6 z-50 animate-slide-in">
      <div className={`flex items-center gap-3 px-5 py-3 rounded-lg shadow-xl border-2 min-w-[320px] ${
        type === "success"
          ? "bg-green-50 border-green-500 text-green-800 dark:bg-green-950 dark:border-green-700 dark:text-green-300"
          : "bg-red-50 border-red-500 text-red-800 dark:bg-red-950 dark:border-red-700 dark:text-red-300"
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

function PasswordCell({ encodedPassword }: { encodedPassword: string }) {
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(encodedPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="flex items-center gap-1 overflow-hidden">
      <div className="flex items-center gap-1 min-w-0">
        <span className="font-mono text-xs text-gray-700 dark:text-gray-200 truncate">
          {visible ? encodedPassword : "••••••••"}
        </span>
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          title={visible ? "Sembunyikan" : "Tampilkan"}
          className="text-gray-400 hover:text-[#2e3192] dark:hover:text-indigo-400 transition-colors flex-shrink-0"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {visible && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            title="Salin"
            className="text-gray-400 hover:text-[#2e3192] dark:hover:text-indigo-400 transition-colors flex"
          >
            <CopyIcon />
          </button>
          {copied && (
            <span className="text-[10px] font-semibold text-[#80bc00] whitespace-nowrap">
              Tersalin!
            </span>
          )}
        </div>
      )}
    </div>
  )
}

interface FormState {
  id: number
  name: string
  email: string
  division: string
  password: string
  showPassword: boolean
}

const emptyForm: FormState = { id: 0, name: "", email: "", division: "", password: "", showPassword: false }

type DivisionFilter = "all" | "Admin" | "CPro" | "QC" | "TS" | "Andev"

interface ApiResponse {
  data: UserData[]
  total: number
  totalAll: number
  page: number
  perPage: number
  totalPages: number
  divisionCounts: Record<string, number>
}

export default function UserManagement() {
  const { theme } = useTheme()
  const { user: currentUser, accessToken } = useAuth()
  void theme

  const [users, setUsers]             = useState<UserData[]>([])
  const [total, setTotal]             = useState(0)
  const [totalAll, setTotalAll]       = useState(0)
  const [totalPages, setTotalPages]   = useState(1)
  const [divisionCounts, setDivisionCounts] = useState<Record<string, number>>({
    Admin: 0, CPro: 0, QC: 0, TS: 0, Andev: 0,
  })
  const [loading, setLoading]         = useState(true)
  const [showModal, setShowModal]     = useState(false)
  const [isEdit, setIsEdit]           = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [toast, setToast]             = useState<{ message: string; type: "success" | "error" } | null>(null)
  const [submitting, setSubmitting]   = useState(false)
  const [form, setForm]               = useState<FormState>(emptyForm)

  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch]           = useState("")
  const [activeTab, setActiveTab]     = useState<DivisionFilter>("all")

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set("page", String(currentPage))
      if (search) params.set("search", search)
      if (activeTab !== "all") params.set("division", activeTab)

      const res = await fetch(`${API_BASE}/users?${params.toString()}`, {
        headers: { "Authorization": `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error("Gagal memuat data")
      const json: ApiResponse = await res.json()

      setUsers(json.data ?? [])
      setTotal(json.total ?? 0)
      setTotalAll(json.totalAll ?? 0)
      setTotalPages(json.totalPages ?? 1)
      setDivisionCounts(json.divisionCounts ?? { Admin: 0, CPro: 0, QC: 0, TS: 0, Andev: 0 })
    } catch {
      showToast("Gagal memuat data pengguna", "error")
    } finally {
      setLoading(false)
    }
  }, [accessToken, currentPage, search, activeTab])

  useEffect(() => { loadUsers() }, [loadUsers])

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setCurrentPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => { setCurrentPage(1) }, [activeTab])

  const renderPageButtons = (): (number | "...")[] => {
    const pages: (number | "...")[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 4) pages.push("...")
      for (let i = Math.max(2, currentPage - 2); i <= Math.min(totalPages - 1, currentPage + 2); i++) {
        pages.push(i)
      }
      if (currentPage < totalPages - 3) pages.push("...")
      pages.push(totalPages)
    }
    return pages
  }

  const pillFilters: { label: string; value: DivisionFilter }[] = [
    { label: "Semua", value: "all"   },
    { label: "Admin", value: "Admin" },
    { label: "CPro",  value: "CPro"  },
    { label: "QC",    value: "QC"    },
    { label: "TS",    value: "TS"    },
    { label: "Andev", value: "Andev" },
  ]

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const openAddModal  = () => { setIsEdit(false); setForm(emptyForm); setShowModal(true) }
  const openEditModal = (user: UserData) => {
    setIsEdit(true)
    setForm({ id: user.id, name: user.name, email: user.email, division: user.division, password: "", showPassword: false })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (isEdit) {
        await updateUser(form.id, {
          name: form.name,
          email: form.email,
          division: form.division,
          ...(form.password.trim() !== "" && {
            password: form.password,
            passwordEncoded: encodePassword(form.password),
          }),
        }, accessToken)
        showToast("User berhasil diupdate!", "success")
      } else {
        await addUser({
          name: form.name,
          email: form.email,
          division: form.division,
          password: form.password,
          passwordEncoded: encodePassword(form.password),
        }, accessToken)
        showToast("User baru berhasil ditambahkan!", "success")
      }
      await loadUsers()
      setShowModal(false)
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Terjadi kesalahan", "error")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    const userToDelete = users.find((u) => u.id === id)
    if (!userToDelete) return
    if (!window.confirm(`Yakin ingin menghapus user "${userToDelete.name}"?`)) return
    try {
      await deleteUser(id, accessToken)
      showToast("User berhasil dihapus!", "success")
      if (users.length === 1 && currentPage > 1) {
        setCurrentPage((p) => {
          const next = p - 1
          return next < 1 ? 1 : next
        })
      } else {
        await loadUsers()
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal menghapus user", "error")
    }
  }

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 px-8 py-7 font-sans transition-colors duration-300">

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">User Management</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Kelola akun dan hak akses pengguna sistem
            </p>
          </div>
          {currentUser?.division === "Admin" && (
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2e3192] hover:bg-[#252880] text-white text-sm font-semibold transition-colors duration-200"
            >
              <PlusIcon /> Tambah User
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {pillFilters.map((f) => {
            const active = activeTab === f.value
            const count  = f.value === "all" ? totalAll : (divisionCounts[f.value] ?? 0)
            return (
              <button
                key={f.value}
                onClick={() => { setActiveTab(f.value); setCurrentPage(1) }}
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border-2 text-sm font-medium transition-all duration-200 outline-none ${
                  active
                    ? "border-[#2e3192] bg-indigo-50 text-[#2e3192] dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-400"
                    : "border-transparent bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-current opacity-70" />
                {f.label}
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                  active
                    ? "bg-[#2e3192] text-white dark:bg-indigo-400 dark:text-indigo-950"
                    : "bg-gray-200 text-gray-500 dark:bg-neutral-700 dark:text-gray-400"
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-5 py-4 mb-5 flex flex-wrap gap-3 items-center transition-colors duration-300">
          <div className="relative flex-1 min-w-[240px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <SearchIcon />
            </span>
            <input
              id="user-search"
              name="userSearch"
              type="text"
              placeholder="Cari nama, email, atau divisi..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-[#2e3192] dark:focus:border-indigo-400 transition-colors"
            />
          </div>
          <span className="text-sm text-gray-400 ml-auto">
            <strong className="text-gray-600 dark:text-gray-300">{total}</strong> pengguna
          </span>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden transition-colors duration-300">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[700px] table-fixed">
              <colgroup>
                <col style={{ width: "48px" }} />
                <col style={{ width: "180px" }} />
                <col style={{ width: "220px" }} />
                <col style={{ width: "100px" }} />
                <col style={{ width: "190px" }} />
                <col style={{ width: "96px" }} />
              </colgroup>
              <thead>
                <tr className="bg-[#2e3192] dark:bg-neutral-800">
                  {["No", "Nama", "Email", "Divisi", "Password", "Aksi"].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-white whitespace-nowrap ${
                        h === "Aksi" || h === "No" ? "text-center" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="flex items-center justify-center py-20 gap-2 text-sm text-gray-400 dark:text-gray-500">
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Memuat data...
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <span className="opacity-30 text-gray-400 dark:text-gray-500"><EmptyIcon /></span>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          {search ? `Tidak ada hasil untuk "${search}"` : "Belum ada data pengguna"}
                        </span>
                        {search ? (
                          <button
                            onClick={() => { setSearchInput(""); setSearch("") }}
                            className="text-xs text-[#2e3192] dark:text-indigo-400 hover:underline"
                          >
                            Hapus pencarian
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            Klik "Tambah User" untuk menambahkan pengguna baru
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((user, idx) => (
                    <tr
                      key={user.id}
                      className={`border-b border-gray-100 dark:border-neutral-800 transition-colors duration-150
                        ${idx % 2 === 0 ? "bg-white dark:bg-neutral-900" : "bg-gray-50/60 dark:bg-neutral-950"}
                        hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40`}
                    >
                      <td className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500 tabular-nums text-center align-top">
                        {(currentPage - 1) * 50 + idx + 1}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-800 dark:text-gray-100 align-top">
                        <span className="block break-words leading-relaxed">{user.name}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 align-top">
                        <span className="block break-words leading-relaxed">{user.email}</span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="inline-block px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-50 text-[#2e3192] dark:bg-indigo-950 dark:text-indigo-300 whitespace-nowrap">
                          {user.division}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <PasswordCell encodedPassword={user.passwordEncoded ?? ""} />
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        {currentUser?.division === "Admin" && (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEditModal(user)}
                              title="Edit"
                              className="p-1.5 rounded-md text-amber-500 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 border border-transparent hover:border-amber-200 dark:hover:border-amber-800 transition-colors"
                            >
                              <EditIcon />
                            </button>
                            <button
                              onClick={() => handleDelete(user.id)}
                              title="Hapus"
                              className="p-1.5 rounded-md text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border border-transparent hover:border-red-200 dark:hover:border-red-800 transition-colors"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950 flex flex-wrap justify-between items-center gap-3 transition-colors duration-300">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Menampilkan{" "}
              <strong className="text-[#2e3192] dark:text-indigo-400">
                {users.length > 0 ? `${(currentPage - 1) * 50 + 1}–${(currentPage - 1) * 50 + users.length}` : "0"}
              </strong>{" "}
              dari <strong className="text-gray-600 dark:text-gray-300">{total}</strong> pengguna
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => {
                    const next = p - 1
                    return next < 1 ? 1 : next
                  })}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-500 dark:text-gray-400 disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#2e3192] dark:hover:border-indigo-400 transition-colors"
                >‹ Prev</button>

                {renderPageButtons().map((p, i) =>
                  p === "..." ? (
                    <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-gray-400 dark:text-gray-500 select-none">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p as number)}
                      className={`min-w-[32px] px-2.5 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                        currentPage === p
                          ? "bg-[#2e3192] border-[#2e3192] text-white"
                          : "bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-gray-300 hover:border-[#2e3192] dark:hover:border-indigo-400"
                      }`}
                    >{p}</button>
                  )
                )}

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-500 dark:text-gray-400 disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#2e3192] dark:hover:border-indigo-400 transition-colors"
                >Next ›</button>
              </div>
            )}
          </div>
        </div>

        {showModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50"
            onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false) }}
          >
            <div className="relative bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-2xl p-7 w-full max-w-md shadow-2xl transition-colors duration-300">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors flex"
              >
                <CloseIcon />
              </button>
              <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-5">
                {isEdit ? "Edit Pengguna" : "Tambah Pengguna Baru"}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Nama Lengkap</label>
                  <input
                    name="name" value={form.name} onChange={handleChange}
                    placeholder="Masukkan nama lengkap" required
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-[#2e3192] dark:focus:border-indigo-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Email</label>
                  <input
                    name="email" type="email" value={form.email} onChange={handleChange}
                    placeholder="Masukkan alamat email" required
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-[#2e3192] dark:focus:border-indigo-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Divisi</label>
                  <select
                    name="division" value={form.division} onChange={handleChange} required
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#2e3192] dark:focus:border-indigo-400 cursor-pointer transition-colors appearance-none"
                  >
                    <option value="">Pilih Divisi</option>
                    <option value="Admin">Admin</option>
                    <option value="CPro">CPro</option>
                    <option value="QC">QC</option>
                    <option value="TS">TS</option>
                    <option value="Andev">Andev</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                    Password{" "}
                    {isEdit && <span className="font-normal text-gray-400 dark:text-gray-500">(kosongkan jika tidak diubah)</span>}
                  </label>
                  <div className="relative">
                    <input
                      name="password"
                      type={form.showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={handleChange}
                      placeholder={isEdit ? "Password baru (opsional)" : "Masukkan password"}
                      required={!isEdit}
                      className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-[#2e3192] dark:focus:border-indigo-400 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, showPassword: !prev.showPassword }))}
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-[#2e3192] dark:hover:text-indigo-400 transition-colors"
                      aria-label={form.showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    >
                      {form.showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end gap-2.5 pt-1">
                  <button
                    type="button" onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-neutral-500 bg-transparent transition-colors"
                  >Batal</button>
                  <button
                    type="submit" disabled={submitting}
                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#80bc00] hover:bg-[#6da300] text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {submitting && (
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    )}
                    {isEdit ? "Simpan Perubahan" : "Tambah User"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
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