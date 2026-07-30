import { useState, useEffect, useCallback } from "react"
import { useAuth } from "../hooks/useAuth"
import { useTheme } from "../hooks/useTheme"
import { API_BASE } from "../config"

interface RecycleBinItem {
  id: number
  type: "RM" | "PM"
  nomorDoc: string
  kodeItem: string
  namaMaterial: string
  manufacture: string
  deletedAt: string
  deletedBy: string
  sisaHari: number
}

interface PaginatedResponse {
  data: RecycleBinItem[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

const RestoreIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
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
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
  </svg>
)
const ClockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
)
const EmptyIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
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
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        <p className="font-medium text-sm">{message}</p>
        <button onClick={onClose} className="ml-auto text-current hover:opacity-70">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function ConfirmModal({ item, onConfirm, onCancel }: {
  item: RecycleBinItem; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50">
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-2xl p-7 w-full max-w-sm shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center text-red-600 dark:text-red-400 flex-shrink-0">
            <TrashIcon />
          </span>
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Hapus Permanen?</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Data berikut akan dihapus permanen dan <strong className="text-gray-700 dark:text-gray-200">tidak dapat dipulihkan</strong>:
        </p>
        <div className="p-3 bg-gray-50 dark:bg-neutral-800 rounded-lg text-sm space-y-1.5">
          <p className="text-gray-700 dark:text-gray-200">
            <span className="text-gray-400 text-xs block">Nomor</span>
            <strong>{item.nomorDoc}</strong>
          </p>
          <p className="text-gray-600 dark:text-gray-300">
            <span className="text-gray-400 text-xs block">Material</span>
            {item.namaMaterial || "-"}
          </p>
        </div>
        <div className="flex justify-end gap-2.5 mt-5">
          <button onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-gray-400 hover:border-gray-400 transition-colors">
            Batal
          </button>
          <button onClick={onConfirm}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors">
            Hapus Permanen
          </button>
        </div>
      </div>
    </div>
  )
}

function SisaWaktuBadge({ hari }: { hari: number }) {
  if (hari <= 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-800">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
        Kedaluwarsa
      </span>
    )
  }
  const isRed = hari <= 7
  const colorCls = isRed
    ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-800"
    : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800"
  const dotCls = isRed ? "bg-red-500" : "bg-blue-500"

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${colorCls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotCls} animate-pulse inline-block flex-shrink-0`} />
      {hari} hari lagi
    </span>
  )
}

export default function RecycleBin() {
  const { user: currentUser, accessToken } = useAuth()
  const { theme } = useTheme()
  void theme

  const [items, setItems]             = useState<RecycleBinItem[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [activeTab, setActiveTab]     = useState<"all" | "RM" | "PM">("all")
  const [toast, setToast]             = useState<{ message: string; type: "success" | "error" } | null>(null)
  const [confirmItem, setConfirmItem] = useState<RecycleBinItem | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [total, setTotal]             = useState(0)
  const [totalPages, setTotalPages]   = useState(1)

  const LIMIT = 50

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const authHeaders = {
    "Authorization": `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  }

  const loadItems = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(LIMIT),
        ...(search ? { search } : {}),
      })
      const res = await fetch(`${API_BASE}/recycle-bin?${params}`, {
        headers: { "Authorization": `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error("Gagal memuat data")
      const json: PaginatedResponse = await res.json()
      setItems(json.data ?? [])
      setTotal(json.total ?? 0)
      setTotalPages(json.totalPages ?? 1)
    } catch {
      showToast("Gagal memuat data recycle bin", "error")
    } finally {
      setLoading(false)
    }
  }, [search, accessToken, currentPage])

  useEffect(() => { loadItems() }, [loadItems])

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setCurrentPage(1)
  }, [search])

  const handleRestore = async (item: RecycleBinItem) => {
    try {
      const res = await fetch(
        `${API_BASE}/recycle-bin/${item.type.toLowerCase()}/${item.id}/restore`,
        { method: "PUT", headers: authHeaders }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      showToast(`${item.nomorDoc} berhasil dipulihkan`, "success")
      await loadItems()
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Gagal memulihkan data", "error")
    }
  }

  const handleForceDelete = async (item: RecycleBinItem) => {
    try {
      const res = await fetch(
        `${API_BASE}/recycle-bin/${item.type.toLowerCase()}/${item.id}`,
        { method: "DELETE", headers: authHeaders }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      showToast(`${item.nomorDoc} dihapus permanen`, "success")
      setConfirmItem(null)
      await loadItems()
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Gagal menghapus data", "error")
    }
  }

  const rmCount  = items.filter(i => i.type === "RM").length
  const pmCount  = items.filter(i => i.type === "PM").length
  const filtered = activeTab === "all" ? items : items.filter(i => i.type === activeTab)

  const renderPageButtons = () => {
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

  const pillFilters = [
    { label: "Semua",            value: "all" as const, count: total   },
    { label: "Diversifikasi RM", value: "RM"  as const, count: rmCount },
    { label: "Diversifikasi PM", value: "PM"  as const, count: pmCount },
  ]

  if (currentUser?.division !== "Admin") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 flex items-center justify-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Akses ditolak. Hanya Admin yang dapat mengakses halaman ini.</p>
      </div>
    )
  }

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {confirmItem && (
        <ConfirmModal
          item={confirmItem}
          onConfirm={() => handleForceDelete(confirmItem)}
          onCancel={() => setConfirmItem(null)}
        />
      )}

      <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 px-8 py-7 font-sans transition-colors duration-300">

        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            Recycle Bin
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            Data yang dihapus akan otomatis hilang permanen setelah 30 hari.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {pillFilters.map(f => {
            const active = activeTab === f.value
            return (
              <button
                key={f.value}
                onClick={() => { setActiveTab(f.value); setCurrentPage(1) }}
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border-2 text-sm font-medium transition-all duration-200 outline-none ${
                  active
                    ? "border-[#2e3192] bg-indigo-50 text-[#2e3192] dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-400"
                    : "border-transparent bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-gray-400"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-current opacity-70" />
                {f.label}
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
              id="recycle-search"
              name="recycleSearch"
              type="text"
              placeholder="Cari nomor dokumen, nama material, manufacture, PIC..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-[#2e3192] dark:focus:border-indigo-400 transition-colors"
            />
          </div>
          <span className="text-sm text-gray-400 ml-auto">
            <strong className="text-gray-600 dark:text-gray-300">{total}</strong> data
          </span>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden transition-colors duration-300">
          <div className="overflow-x-auto">
            <div className="max-h-[600px] overflow-y-auto">
              <table className="w-full border-collapse" style={{ minWidth: "1100px" }}>
                <thead>
                  <tr className="bg-[#2e3192] dark:bg-neutral-800">
                    {["No", "No. Data", "Kode Item", "Nama Material", "Manufacture", "Dihapus", "PIC", "Sisa Waktu", "Aksi"].map(h => (
                      <th
                        key={h}
                        className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-white whitespace-nowrap sticky top-0 z-10 bg-[#2e3192] dark:bg-neutral-800 ${
                          h === "Aksi" ? "text-center" : "text-left"
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9}>
                      <div className="flex items-center justify-center py-20 gap-2 text-gray-400 dark:text-gray-500">
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span className="text-sm">Memuat data...</span>
                      </div>
                    </td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={9}>
                      <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400 dark:text-gray-500">
                        <span className="opacity-30"><EmptyIcon /></span>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          {search ? `Tidak ada hasil untuk "${search}"` : "Recycle bin kosong"}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {search ? "" : "Data yang dihapus akan muncul di sini"}
                        </span>
                        {search && (
                          <button
                            onClick={() => { setSearchInput(""); setSearch("") }}
                            className="text-xs text-[#2e3192] dark:text-indigo-400 hover:underline"
                          >
                            Hapus pencarian
                          </button>
                        )}
                      </div>
                    </td></tr>
                  ) : (
                    filtered.map((item, idx) => (
                      <tr
                        key={`${item.type}-${item.id}`}
                        className={`border-b border-gray-100 dark:border-neutral-800 transition-colors duration-150
                          ${idx % 2 === 0 ? "bg-white dark:bg-neutral-900" : "bg-slate-50/80 dark:bg-neutral-950"}
                          hover:bg-blue-50/30 dark:hover:bg-blue-950/10`}
                      >
                        <td className="px-3 py-2.5 text-xs text-gray-400 dark:text-gray-500 tabular-nums w-10 text-center align-middle">
                          {(currentPage - 1) * LIMIT + idx + 1}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-[11px] font-mono font-bold text-[#2e3192] dark:text-indigo-400">{item.nomorDoc}</span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-700 dark:text-gray-200 whitespace-nowrap">
                          {item.kodeItem || <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-700 dark:text-gray-200">
                          {item.namaMaterial || <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-700 dark:text-gray-200 whitespace-nowrap">
                          {item.manufacture || <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                          {(() => {
                            const raw = item.deletedAt
                            const pad = (n: number) => String(n).padStart(2, "0")

                            if (raw.includes(" ") && !raw.includes("T")) {
                              const [tgl, jam] = raw.split(" ")
                              return (
                                <>
                                  <div className="font-medium text-gray-700 dark:text-gray-200 mb-0.5">{tgl}</div>
                                  <div className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
                                    <ClockIcon />{jam}
                                  </div>
                                </>
                              )
                            }

                            const d = new Date(raw)
                            const tgl = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
                            const jam = `${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}`
                            return (
                              <>
                                <div className="font-medium text-gray-700 dark:text-gray-200 mb-0.5">{tgl}</div>
                                <div className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
                                  <ClockIcon />{jam}
                                </div>
                              </>
                            )
                          })()}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-700 dark:text-gray-200 whitespace-nowrap">
                          {item.deletedBy || <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <SisaWaktuBadge hari={item.sisaHari} />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleRestore(item)}
                              title="Pulihkan"
                              className="p-1.5 rounded-md text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors"
                            >
                              <RestoreIcon />
                            </button>
                            <button
                              onClick={() => setConfirmItem(item)}
                              title="Hapus Permanen"
                              className="p-1.5 rounded-md text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border border-transparent hover:border-red-200 dark:hover:border-red-800 transition-colors"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="px-5 py-3 border-t border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950 flex flex-wrap justify-between items-center gap-3 transition-colors duration-300">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Menampilkan{" "}
              <strong className="text-[#2e3192] dark:text-indigo-400">{filtered.length}</strong>{" "}
              dari{" "}
              <strong className="text-gray-600 dark:text-gray-300">{total}</strong>{" "}
              data
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-500 dark:text-gray-400 disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#2e3192] dark:hover:border-indigo-400 transition-colors"
                >‹ Prev</button>

                {renderPageButtons().map((p, i) =>
                  p === "..." ? (
                    <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-gray-400 dark:text-gray-500 select-none">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
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
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-500 dark:text-gray-400 disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#2e3192] dark:hover:border-indigo-400 transition-colors"
                >Next ›</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
      `}</style>
    </>
  )
}