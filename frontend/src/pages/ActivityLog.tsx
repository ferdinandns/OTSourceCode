import { useState, useEffect, useCallback, useRef } from "react"
import { useTheme } from "../hooks/useTheme"
import { useAuth } from "../hooks/useAuth"
import { useApi } from "../hooks/useApi"

type Action = "create" | "update" | "delete" | "restore"
type TableName = "Diversifikasi RM" | "Diversifikasi PM"

interface ActivityEntry {
  id: number
  time: string
  name: string
  division: string
  action: Action
  table: TableName
  noData: string
  detail: string
}

interface ApiResponse {
  data: ActivityEntry[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

const ACTION_CONFIG: Record<Action, { label: string; classes: string; dot: string }> = {
  create:  { label: "Create",  classes: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",    dot: "#80bc00" },
  update:  { label: "Update",  classes: "bg-indigo-100 text-[#2e3192] dark:bg-indigo-950 dark:text-indigo-300", dot: "#2e3192" },
  delete:  { label: "Delete",  classes: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",            dot: "#e53935" },
  restore: { label: "Restore", classes: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",    dot: "#f59e0b" },
}

const SearchIcon      = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
const ChevronDownIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
const ChevronUpIcon   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
const FilterIcon      = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
const ClockIcon       = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
const InfoIcon        = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
const EmptyIcon       = () => <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>

function parseDetail(detail: string, action: Action, noData: string) {
  const pipeIdx = detail.indexOf("||")
  const rawSummary = pipeIdx >= 0 ? detail.slice(0, pipeIdx) : detail
  const expanded   = pipeIdx >= 0 ? detail.slice(pipeIdx + 2) : ""

  let summary = ""

  if (action === "create") {
    summary = `Data baru ditambahkan: ${noData}`
  } else if (action === "delete") {
    summary = `Data dihapus: ${noData}`
  } else if (action === "restore") {
    summary = `Data dipulihkan: ${noData}`
  } else {
    const colonIdx = rawSummary.indexOf(": ")
    if (colonIdx >= 0) {
      const afterColon = rawSummary.slice(colonIdx + 2).trim()
      const secondColon = afterColon.indexOf(": ")
      if (secondColon >= 0 && /^[A-Z]{2}_/.test(afterColon)) {
        summary = afterColon.slice(secondColon + 2).trim()
      } else {
        summary = afterColon
      }
    } else {
      summary = rawSummary
    }
    if (!summary || summary === "(tidak ada perubahan)") {
      summary = "Tidak ada perubahan"
    }
  }

  return { summary, expanded }
}

export default function ActivityLog() {
  useTheme()
  useAuth()
  const api = useApi()
  const apiRef = useRef(api)
  useEffect(() => { apiRef.current = api })

  const [data, setData]               = useState<ActivityEntry[]>([])
  const [total, setTotal]             = useState(0)
  const [totalPages, setTotalPages]   = useState(1)
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [filterAction, setFilterAction] = useState<"all" | Action>("all")
  const [filterTable, setFilterTable]   = useState<"all" | TableName>("all")
  const [activeTab, setActiveTab]       = useState<"all" | "RM" | "PM">("all")
  const [currentPage, setCurrentPage]   = useState(1)
  const [expandedRow, setExpandedRow]   = useState<number | null>(null)

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setCurrentPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    if (activeTab === "all") setFilterTable("all")
    else if (activeTab === "RM") setFilterTable("Diversifikasi RM")
    else setFilterTable("Diversifikasi PM")
    setCurrentPage(1)
  }, [activeTab])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set("limit", "50")
      if (search) params.set("search", search)
      if (filterAction !== "all") params.set("action", filterAction)
      if (filterTable !== "all") params.set("table", filterTable)

      const json = await apiRef.current.get<ApiResponse>(`/activity-logs?${params.toString()}`)
      setData(json.data ?? [])
      setTotal(json.total ?? 0)
      setTotalPages(json.totalPages ?? 1)
    } catch {
      setData([])
    } finally {
      setLoading(false)
    } 
  }, [search, filterAction, filterTable])

  useEffect(() => { loadData() }, [loadData])

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

  const tabPills = [
    { label: "Semua",            value: "all" as const },
    { label: "Diversifikasi RM", value: "RM"  as const },
    { label: "Diversifikasi PM", value: "PM"  as const },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 px-8 py-7 font-sans transition-colors duration-300">

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Activity Log</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
          Rekam jejak aktivitas pengguna pada sistem
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {tabPills.map(f => {
          const active = activeTab === f.value
          return (
            <button key={f.value} onClick={() => setActiveTab(f.value)}
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border-2 text-sm font-medium transition-all duration-200 outline-none ${
                active
                  ? "border-[#2e3192] bg-indigo-50 text-[#2e3192] dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-400"
                  : "border-transparent bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-gray-400"
              }`}>
              <span className="w-2 h-2 rounded-full bg-current opacity-70" />
              {f.label}
            </button>
          )
        })}
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-5 py-4 mb-5 flex flex-wrap gap-3 items-center transition-colors duration-300">
        <div className="relative flex-1 min-w-[240px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><SearchIcon /></span>
          <input id="activity-search" name="activitySearch" type="text" placeholder="Cari nama, divisi, nomor data, atau detail aktivitas..."
            value={searchInput} onChange={e => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-[#2e3192] dark:focus:border-indigo-400 transition-colors"
          />
        </div>
        <div className="w-px h-8 bg-gray-200 dark:bg-neutral-700 hidden sm:block" />
        <div className="flex items-center gap-2">
          <span className="text-gray-400"><FilterIcon /></span>
          <select id="activity-filter-action" name="activityFilterAction" value={filterAction}
            onChange={e => { setFilterAction(e.target.value as "all" | Action); setCurrentPage(1) }}
            className="text-sm border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#2e3192] cursor-pointer transition-colors">
            <option value="all">Semua Aksi</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="restore">Restore</option>
          </select>
        </div>
        <span className="text-sm text-gray-400 ml-auto">
          <strong className="text-[#2e3192] dark:text-indigo-400">{total}</strong> data
        </span>
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden transition-colors duration-300">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-[#2e3192] dark:bg-neutral-800">
                {["No", "Waktu", "Nama", "Divisi", "Aksi", "Tabel", "No. Data", "Detail"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-white whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8}>
                  <div className="flex items-center justify-center py-20 gap-2 text-gray-400 dark:text-gray-500">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span className="text-sm">Memuat data...</span>
                  </div>
                </td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={8}>
                  <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400 dark:text-gray-500">
                    <span className="opacity-30"><EmptyIcon /></span>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Belum ada data aktivitas</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">Data akan muncul setelah pengguna melakukan aktivitas pada sistem</span>
                  </div>
                </td></tr>
              ) : (
                data.map((row, idx) => {
                  const ac = ACTION_CONFIG[row.action] ?? ACTION_CONFIG.update
                  const isExpanded = expandedRow === row.id
                  const { summary, expanded } = parseDetail(row.detail, row.action, row.noData)

                  return (
                    <tr key={row.id} onClick={() => setExpandedRow(isExpanded ? null : row.id)}
                      className={`border-b border-gray-100 dark:border-neutral-800 cursor-pointer transition-colors duration-150
                        ${idx % 2 === 0 ? "bg-white dark:bg-neutral-900" : "bg-gray-50/60 dark:bg-neutral-950"}
                        hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40`}>

                      <td className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500 tabular-nums w-12 text-center">
                        {(currentPage - 1) * 50 + idx + 1}
                      </td>

                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {(() => {
                          const raw = row.time
                          const pad = (n: number) => String(n).padStart(2, "0")
                          const d = new Date(raw)
                          const tgl = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
                          const jam =
                            `${pad(d.getHours())}.` +
                            `${pad(d.getMinutes())}.` +
                            `${pad(d.getSeconds())}`
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

                      <td className="px-4 py-3 text-sm font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">
                        {row.name || <span className="text-gray-300 dark:text-gray-600 font-normal text-xs">—</span>}
                      </td>

                      <td className="px-4 py-3">
                        {row.division
                          ? <span className="inline-block px-3 py-1 rounded-md text-xs font-medium bg-indigo-50 text-[#2e3192] dark:bg-indigo-950 dark:text-indigo-300 whitespace-nowrap">{row.division}</span>
                          : <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                        }
                      </td>

                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap ${ac.classes}`}>
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: ac.dot }} />
                          {ac.label}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">{row.table}</td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-[11px] font-mono font-bold text-[#2e3192] dark:text-indigo-400">{row.noData}</span>
                      </td>

                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 max-w-xs">
                        {isExpanded ? (
                          <div onClick={e => e.stopPropagation()}>
                            <div className="space-y-0.5 mb-2">
                              {expanded ? (
                                expanded.split("\n").filter(Boolean).map((line, i) => {
                                  const colonIdx = line.indexOf(": ")
                                  const fieldName = colonIdx >= 0 ? line.slice(0, colonIdx) : line
                                  const change    = colonIdx >= 0 ? line.slice(colonIdx + 2) : ""
                                  return (
                                    <div key={i} className="text-xs">
                                      <span className="font-semibold text-gray-600 dark:text-gray-300">{fieldName}:</span>{" "}
                                      <span className="text-gray-500 dark:text-gray-400">{change}</span>
                                    </div>
                                  )
                                })
                              ) : (
                                <p className="text-xs text-gray-500 dark:text-gray-400">{summary}</p>
                              )}
                            </div>
                            <button onClick={() => setExpandedRow(null)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#80bc00]">
                              <ChevronUpIcon /> Tutup
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="block max-w-[280px] truncate text-xs text-gray-500 dark:text-gray-400">
                              {summary}
                            </span>
                            {expanded && row.action === "update" && (
                              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#2e3192] dark:text-indigo-400 opacity-75 shrink-0">
                                <InfoIcon /><ChevronDownIcon />
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950 flex flex-wrap justify-between items-center gap-3 transition-colors duration-300">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Menampilkan{" "}
            <strong className="text-[#2e3192] dark:text-indigo-400">
              {data.length > 0 ? `${(currentPage - 1) * 50 + 1}–${(currentPage - 1) * 50 + data.length}` : "0"}
            </strong>{" "}
            dari <strong className="text-gray-600 dark:text-gray-300">{total}</strong> data
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
                onClick={() => setCurrentPage(p => p + 1)}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-500 dark:text-gray-400 disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#2e3192] dark:hover:border-indigo-400 transition-colors"
              >Next ›</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}