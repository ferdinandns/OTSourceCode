import React, { useState, useEffect, useCallback, useRef } from "react"
import ReactDOM from "react-dom"
import { useTheme } from "../hooks/useTheme"
import { useAuth } from "../hooks/useAuth"
import { API_BASE } from "../config"

type TabType = "RM" | "PM"

interface CardStat {
  released: number
  total: number
}

interface ProductStatusItem {
  kodeProduk: string
  status: string
}

interface DashboardRMRow {
  id: number
  nomorRM: string
  namaMaterial: string
  manufacture: string
  noBatchMaterial: string
  statusProject: string
  hasilRM: string
  hasilAlokasi: string
  hasilScaleUp: string
  products: ProductStatusItem[]
  createdAt: string
  updatedAt: string
}

interface DashboardPMRow {
  id: number
  nomorPM: string
  namaMaterial: string
  manufacture: string
  noBatchMaterial: string
  statusProject: string
  hasilPM: string
  hasilAlokasi: string
  hasilTrial: string
  products: ProductStatusItem[]
  createdAt: string
  updatedAt: string
}

interface PaginationMeta {
  total: number
  page: number
  perPage: number
  totalPages: number
}

interface DashboardRMTable extends PaginationMeta {
  data: DashboardRMRow[]
}

interface DashboardPMTable extends PaginationMeta {
  data: DashboardPMRow[]
}

interface DashboardRM {
  totalDivers: number
  analisaRM: CardStat
  statusLabscale: CardStat
  statusScaleUp: CardStat
  tableData: DashboardRMTable  
}

interface DashboardPM {
  totalDivers: number
  analisaPM: CardStat
  statusTrial: CardStat
  tableData: DashboardPMTable   
}

interface DashboardData {
  diverRM: DashboardRM
  diverPM: DashboardPM
}

const today = new Date()
const fmt = (d: Date) => d.toISOString().split("T")[0]
const fmtDisplay = (iso: string) => {
  if (!iso) return ""
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]

const BRAND = "#2e3192"
const GREEN = "#80bc00"

const BADGE_STATUS_PROJECT: Record<string, string> = {
  Done:          "bg-green-700 text-white",
  Drop:          "bg-red-700 text-white",
  "On Progress": "bg-amber-500 text-white",
}

const BADGE_STATUS_RM: Record<string, string> = {
  Release:       "bg-green-100 text-green-800",
  Reject:        "bg-red-100 text-red-800",
  "On Progress": "bg-yellow-100 text-yellow-800",
  "N/A":         "bg-gray-100 text-gray-500",
}

const BADGE_HASIL: Record<string, string> = {
  MS:    "bg-green-100 text-green-800",
  TMS:   "bg-red-100 text-red-800",
  OP:    "bg-yellow-100 text-yellow-800",
  "N/A": "bg-gray-100 text-gray-500",
}

function StatusBadge({ value, map }: { value: string; map: Record<string, string> }) {
  if (!value) return <span className="text-gray-300 text-xs select-none">—</span>
  const cls = map[value] ?? "bg-gray-100 text-gray-500"
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap ${cls}`}>
      {value}
    </span>
  )
}

function ProductPopup({ products, onClose }: { products: ProductStatusItem[]; onClose: () => void }) {
  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-neutral-700 w-full max-w-sm mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">Detail Produk</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-red-500 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="p-4 max-h-64 overflow-y-auto">
          {products.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">Tidak ada produk</p>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr style={{ background: BRAND }}>
                  <th className="px-3 py-2 text-left text-white font-semibold rounded-tl-lg">Kode Produk</th>
                  <th className="px-3 py-2 text-center text-white font-semibold rounded-tr-lg">Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white dark:bg-neutral-900" : "bg-gray-50 dark:bg-neutral-950"}>
                    <td className="px-3 py-2 font-medium text-indigo-700 dark:text-indigo-400">{p.kodeProduk || "—"}</td>
                    <td className="px-3 py-2 text-center">
                      <StatusBadge value={p.status} map={BADGE_STATUS_RM} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-5 py-3 border-t border-gray-100 dark:border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-500 hover:border-gray-400 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

interface DateRange {
  from: string
  to: string
}

function DateRangePicker({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const [open, setOpen] = useState(false)
  const [selecting, setSelecting] = useState<"from" | "to">("from")
  const [hovered, setHovered] = useState<string | null>(null)
  const [draft, setDraft] = useState<DateRange>(value)
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [popupPos, setPopupPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  const btnRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        !popupRef.current?.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const getDays = (year: number, month: number) => {
    const first = new Date(year, month, 1).getDay()
    const total = new Date(year, month + 1, 0).getDate()
    return { first, total }
  }

  const isInRange = (dateStr: string) => {
    if (!draft.from) return false
    const f = draft.from
    const t = draft.to || hovered || ""
    if (!t) return false
    const [lo, hi] = f <= t ? [f, t] : [t, f]
    return dateStr > lo && dateStr < hi
  }

  const isStart = (d: string) => d === draft.from
  const isEnd = (d: string) => d === (draft.to || hovered || "")

  const handleDay = (dateStr: string) => {
    if (selecting === "from") {
      setDraft({ from: dateStr, to: "" })
      setSelecting("to")
    } else {
      const [from, to] = draft.from <= dateStr ? [draft.from, dateStr] : [dateStr, draft.from]
      setDraft({ from, to })
      setSelecting("from")
    }
  }

  const apply = () => {
    if (draft.from && draft.to) {
      onChange(draft)
      setOpen(false)
    }
  }

  const reset = () => {
    const def = { from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), to: fmt(today) }
    setDraft(def)
    onChange(def)
    setSelecting("from")
    setOpen(false)
  }

  const buildCalendar = (year: number, month: number) => {
    const { first, total } = getDays(year, month)
    const cells: (string | null)[] = Array(first).fill(null)
    for (let d = 1; d <= total; d++) {
      cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`)
    }
    return cells
  }

  const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear
  const nextMon  = viewMonth === 11 ? 0 : viewMonth + 1

  const label = value.from && value.to
    ? `${fmtDisplay(value.from)} - ${fmtDisplay(value.to)}`
    : "Pilih rentang tanggal"

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => {
          const rect = btnRef.current?.getBoundingClientRect()
          if (rect) {
            const popupWidth  = 640
            const popupHeight = 520
            const spacing     = 8

            let top  = rect.bottom + spacing
            let left = rect.left

            if (window.innerHeight - rect.bottom < popupHeight && rect.top > window.innerHeight - rect.bottom) {
              top = rect.top - popupHeight - spacing
            }
            if (left + popupWidth > window.innerWidth) {
              left = window.innerWidth - popupWidth - 16
            }
            left = Math.max(8, left)
            top  = Math.max(8, top)
            setPopupPos({ top, left })
          }
          setDraft(value)
          setOpen(o => !o)
          setSelecting("from")
        }}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-indigo-400 transition-colors"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        {label}
      </button>

      {open && ReactDOM.createPortal(
        <div
          ref={popupRef}
          style={{ position: "fixed", top: popupPos.top, left: popupPos.left, zIndex: 99999 }}
          className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-2xl shadow-2xl p-5 w-[640px]"
        >
          <p className="text-xs font-semibold text-gray-400 mb-4 text-center uppercase tracking-widest">
            {selecting === "from" ? "Pilih tanggal mulai" : "Pilih tanggal akhir"}
          </p>
          <div className="grid grid-cols-2 gap-6">
            {[
              { year: viewYear, month: viewMonth,  cells: buildCalendar(viewYear, viewMonth) },
              { year: nextYear, month: nextMon,    cells: buildCalendar(nextYear, nextMon)   },
            ].map(({ year, month, cells }, ci) => (
              <div key={ci}>
                <div className="flex items-center justify-between mb-3">
                  {ci === 0 ? (
                    <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors text-gray-500">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
                    </button>
                  ) : <span />}
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
                    {MONTHS_ID[month]} {year}
                  </span>
                  {ci === 1 ? (
                    <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors text-gray-500">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                  ) : <span />}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
                    <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
                  ))}
                  {cells.map((dateStr, i) => {
                    if (!dateStr) return <div key={`e-${i}`} />
                    const start    = isStart(dateStr)
                    const end      = isEnd(dateStr)
                    const inRange  = isInRange(dateStr)
                    const isFuture = dateStr > fmt(today)
                    return (
                      <button
                        key={dateStr}
                        disabled={isFuture}
                        onClick={() => !isFuture && handleDay(dateStr)}
                        onMouseEnter={() => selecting === "to" && setHovered(dateStr)}
                        onMouseLeave={() => setHovered(null)}
                        className={`text-center text-xs py-1.5 rounded-lg font-medium transition-all
                          ${isFuture ? "text-gray-200 dark:text-gray-700 cursor-not-allowed" : "cursor-pointer"}
                          ${start || end ? "text-white font-bold" : ""}
                          ${inRange && !start && !end ? "rounded-none" : ""}`}
                        style={{
                          background: start || end ? BRAND : inRange ? "#dbeafe" : undefined,
                          color:      start || end ? "white" : inRange ? BRAND    : undefined,
                        }}
                      >
                        {parseInt(dateStr.split("-")[2])}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-3 mt-5 pt-4 border-t border-gray-100 dark:border-neutral-800">
            <button onClick={reset} className="px-4 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors">Reset</button>
            <button onClick={() => setOpen(false)} className="px-4 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-500 hover:border-gray-400 transition-colors">Batal</button>
            <button
              onClick={apply}
              disabled={!draft.from || !draft.to}
              className="px-5 py-1.5 text-xs font-semibold rounded-lg text-white transition-colors disabled:opacity-40"
              style={{ background: BRAND }}
            >
              Terapkan
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

function StatCard({ title, stat, icon, accent, isTotal = false, totalValue }: {
  title: string
  stat?: CardStat
  icon: React.ReactNode
  accent: string
  isTotal?: boolean
  totalValue?: number
}) {
  return (
    <div className="relative bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5 overflow-hidden transition-colors">
      <div className="absolute top-0 right-0 w-28 h-28 rounded-bl-full opacity-[0.07]" style={{ background: accent }} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">{title}</p>
          {isTotal ? (
            <p className="text-3xl font-black text-gray-900 dark:text-gray-50 leading-none">{totalValue ?? 0}</p>
          ) : (
            <div className="flex items-baseline gap-1.5">
              <p className="text-3xl font-black leading-none" style={{ color: accent }}>{stat?.released ?? 0}</p>
              <p className="text-lg font-bold text-gray-300 dark:text-gray-600">/{stat?.total ?? 0}</p>
            </div>
          )}
          {!isTotal && stat && (
            <p className="mt-1.5 text-[11px] text-gray-400">{stat.total - stat.released} belum release</p>
          )}
          {isTotal && (
            <p className="mt-1.5 text-[11px] text-gray-400">Total seluruh data</p>
          )}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: accent + "20" }}>
          <span style={{ color: accent }}>{icon}</span>
        </div>
      </div>
    </div>
  )
}

const IconFlask  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 3h6M9 3v8L4.5 19A2 2 0 006.3 22h11.4a2 2 0 001.8-3L15 11V3"/></svg>
const IconBeaker = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5s-2.5-1.1-2.5-2.5V2"/><path d="M8.5 2h7"/></svg>
const IconTrend  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
const IconPM     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>

export default function Dashboard() {
  useTheme()
  const { accessToken } = useAuth()

  const [activeTab, setActiveTab]     = useState<TabType>("RM")
  const [dateRange, setDateRange]     = useState<DateRange>({
    from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)),
    to:   fmt(today),
  })
  const [data, setData]               = useState<DashboardData | null>(null)
  const [loading, setLoading]         = useState(false)
  const [productPopup, setProductPopup] = useState<ProductStatusItem[] | null>(null)

  const [tablePage, setTablePage]     = useState(1)
  const TABLE_LIMIT = 25

  useEffect(() => { setTablePage(1) }, [activeTab, dateRange])

  const fetchDashboard = useCallback(async (
    range: DateRange,
    tab: TabType,
    page: number,
  ) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        from:   range.from,
        to:     range.to,
        type:   tab,
        page:   String(page),
        limit:  String(TABLE_LIMIT),
      })
      const res = await fetch(`${API_BASE}/dashboard?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error()
      const json: DashboardData = await res.json()
      setData(json)
    } catch (err) {
      console.error(err)
      setData(null)
    }
    setLoading(false)
  }, [accessToken])

  useEffect(() => {
    fetchDashboard(dateRange, activeTab, tablePage)
  }, [dateRange, activeTab, tablePage, fetchDashboard])

  const rm = data?.diverRM
  const pm = data?.diverPM

  const activeTableMeta: PaginationMeta = activeTab === "RM"
    ? (rm?.tableData ?? { data: [], total: 0, page: 1, perPage: TABLE_LIMIT, totalPages: 1 })
    : (pm?.tableData ?? { data: [], total: 0, page: 1, perPage: TABLE_LIMIT, totalPages: 1 })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 px-6 py-6 font-sans space-y-5 transition-colors duration-300">

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-gray-50 tracking-tight">Dashboard</h1>
          <p className="mt-0.5 text-sm text-gray-400 dark:text-gray-500">
            Ringkasan data Diversifikasi Raw Material &amp; Packaging Material
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden">
            <TabButton label="Diversifikasi RM" active={activeTab === "RM"} onClick={() => setActiveTab("RM")} />
            <TabButton label="Diversifikasi PM" active={activeTab === "PM"} onClick={() => setActiveTab("PM")} />
          </div>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-indigo-400">
          <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Memuat data...
        </div>
      )}

      {activeTab === "RM" && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="Total Divers RM"  icon={<IconPM />}     accent={BRAND}     isTotal totalValue={rm?.totalDivers ?? 0} />
          <StatCard title="Analisa RM"       stat={rm?.analisaRM}  icon={<IconFlask />} accent="#16a34a" />
          <StatCard title="Status Labscale"  stat={rm?.statusLabscale} icon={<IconBeaker />} accent="#7c3aed" />
          <StatCard title="Status Scale Up"  stat={rm?.statusScaleUp}  icon={<IconTrend />}  accent="#d97706" />
        </div>
      )}

      {activeTab === "PM" && (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
          <StatCard title="Total Divers PM"    icon={<IconPM />}    accent={BRAND}     isTotal totalValue={pm?.totalDivers ?? 0} />
          <StatCard title="Analisa PM"         stat={pm?.analisaPM} icon={<IconFlask />} accent="#16a34a" />
          <StatCard title="Status Trial Mesin" stat={pm?.statusTrial} icon={<IconTrend />} accent="#d97706" />
        </div>
      )}

      <TableSection
        activeTab={activeTab}
        loading={loading}
        rmData={rm?.tableData?.data ?? []}
        pmData={pm?.tableData?.data ?? []}
        pagination={activeTableMeta}
        onPageChange={setTablePage}
        onProductClick={products => setProductPopup(products)}
      />

      {productPopup && (
        <ProductPopup products={productPopup} onClose={() => setProductPopup(null)} />
      )}
    </div>
  )
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-5 py-2 text-sm font-semibold transition-all duration-200"
      style={{ background: active ? BRAND : "transparent", color: active ? "white" : "#6b7280" }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = GREEN + "20"
          ;(e.currentTarget as HTMLButtonElement).style.color = GREEN
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = "transparent"
          ;(e.currentTarget as HTMLButtonElement).style.color = "#6b7280"
        }
      }}
    >
      {label}
    </button>
  )
}

function ProductCountButton({ products, onClick }: { products: ProductStatusItem[]; onClick: () => void }) {
  if (!products || products.length === 0) {
    return <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
  }
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold transition-colors ring-2 ring-transparent hover:ring-violet-300 cursor-pointer"
      style={{ background: "#ede9fe", color: "#7c3aed" }}
      title="Lihat detail produk"
    >
      {products.length}
    </button>
  )
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-400 dark:text-gray-500">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="text-sm font-medium">Tidak ada data pada periode ini</span>
        </div>
      </td>
    </tr>
  )
}

const VISIBLE_ROWS = 10

const RM_HEADERS = ["No (RM)", "Nama Material", "Manufacture", "No Batch", "Status Project", "Hasil RM", "Hasil Alokasi Produk", "Hasil Scale Up"]
const PM_HEADERS = ["No (PM)", "Nama Material", "Manufacture", "No Batch", "Status Project", "Hasil PM", "Hasil Alokasi Produk", "Hasil Trial Mesin"]

function TableSection({
  activeTab,
  loading,
  rmData,
  pmData,
  pagination,
  onPageChange,
  onProductClick,
}: {
  activeTab: TabType
  loading: boolean
  rmData: DashboardRMRow[]
  pmData: DashboardPMRow[]
  pagination: PaginationMeta
  onPageChange: (page: number) => void
  onProductClick: (p: ProductStatusItem[]) => void
}) {
  const pageData  = activeTab === "RM" ? rmData : pmData
  const headers   = activeTab === "RM" ? RM_HEADERS : PM_HEADERS
  const { total, page, totalPages } = pagination

  const ROW_HEIGHT    = 36
  const maxTableHeight = VISIBLE_ROWS * ROW_HEIGHT

  const pages: (number | "...")[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push("...")
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push("...")
    pages.push(totalPages)
  }

  const from = total === 0 ? 0 : (page - 1) * pagination.perPage + 1
  const to   = Math.min(page * pagination.perPage, total)

  return (
    <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm transition-colors">

      <div className="px-5 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">
            {activeTab === "RM" ? "Ringkasan Diversifikasi RM" : "Ringkasan Diversifikasi PM"}
          </h2>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded-md border border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            {pages.map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className="px-2 text-xs text-gray-400">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => onPageChange(p as number)}
                  className={`min-w-[28px] h-7 px-1.5 rounded-md text-xs font-medium transition-colors border ${
                    p === page
                      ? "text-white border-transparent"
                      : "border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800"
                  }`}
                  style={p === page ? { background: BRAND } : {}}
                >
                  {p}
                </button>
              )
            )}
            <button
              onClick={() => {
                if (page < totalPages) onPageChange(page + 1)
              }}
              disabled={page >= totalPages}
              className="p-1.5 rounded-md border border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <div style={{ maxHeight: `${maxTableHeight}px`, overflowY: "auto", position: "relative" }}>
          <table className="w-full border-collapse text-xs" style={{ minWidth: "900px" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <tr style={{ background: BRAND }}>
                {headers.map(h => (
                  <th
                    key={h}
                    style={{ position: "sticky", top: 0, background: BRAND }}
                    className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-widest text-white whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8}>
                    <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      <span className="text-sm">Memuat data...</span>
                    </div>
                  </td>
                </tr>
              ) : pageData.length === 0 ? (
                <EmptyRow colSpan={8} />
              ) : activeTab === "RM" ? (
                (pageData as DashboardRMRow[]).map((row, idx) => (
                  <tr
                    key={row.id}
                    className={`border-b border-gray-100 dark:border-neutral-800 transition-colors
                      ${idx % 2 === 0 ? "bg-white dark:bg-neutral-900" : "bg-gray-50/60 dark:bg-neutral-950"}
                      hover:bg-indigo-50/40 dark:hover:bg-indigo-950/10`}
                  >
                    <td className="px-4 py-2.5 text-center font-mono font-bold text-[11px] text-indigo-700 dark:text-indigo-400 whitespace-nowrap">{row.nomorRM}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-700 dark:text-gray-200 font-medium">{row.namaMaterial || "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{row.manufacture || "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{row.noBatchMaterial || "—"}</td>
                    <td className="px-4 py-2.5 text-center"><StatusBadge value={row.statusProject} map={BADGE_STATUS_PROJECT} /></td>
                    <td className="px-4 py-2.5 text-center"><StatusBadge value={row.hasilRM} map={BADGE_STATUS_RM} /></td>
                    <td className="px-4 py-2.5 text-center">
                      <ProductCountButton products={row.products} onClick={() => onProductClick(row.products)} />
                    </td>
                    <td className="px-4 py-2.5 text-center"><StatusBadge value={row.hasilScaleUp} map={BADGE_STATUS_RM} /></td>
                  </tr>
                ))
              ) : (
                (pageData as DashboardPMRow[]).map((row, idx) => (
                  <tr
                    key={row.id}
                    className={`border-b border-gray-100 dark:border-neutral-800 transition-colors
                      ${idx % 2 === 0 ? "bg-white dark:bg-neutral-900" : "bg-gray-50/60 dark:bg-neutral-950"}
                      hover:bg-indigo-50/40 dark:hover:bg-indigo-950/10`}
                  >
                    <td className="px-4 py-2.5 text-center font-mono font-bold text-[11px] text-indigo-700 dark:text-indigo-400 whitespace-nowrap">{row.nomorPM}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-700 dark:text-gray-200 font-medium">{row.namaMaterial || "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{row.manufacture || "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{row.noBatchMaterial || "—"}</td>
                    <td className="px-4 py-2.5 text-center"><StatusBadge value={row.statusProject} map={BADGE_STATUS_PROJECT} /></td>
                    <td className="px-4 py-2.5 text-center"><StatusBadge value={row.hasilPM} map={BADGE_STATUS_RM} /></td>
                    <td className="px-4 py-2.5 text-center">
                      <ProductCountButton products={row.products} onClick={() => onProductClick(row.products)} />
                    </td>
                    <td className="px-4 py-2.5 text-center"><StatusBadge value={row.hasilTrial} map={BADGE_HASIL} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && total > 0 && (
        <div className="px-5 py-3 border-t border-gray-100 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-950 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Menampilkan{" "}
            <strong className="text-indigo-600 dark:text-indigo-400">{from}–{to}</strong>{" "}
            dari <strong className="text-gray-600 dark:text-gray-300">{total}</strong> data
          </span>
        </div>
      )}
    </div>
  )
}