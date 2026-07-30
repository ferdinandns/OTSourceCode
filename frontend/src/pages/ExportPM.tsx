import React, { useState, useEffect, useRef, useMemo } from "react"
import ReactDOM from "react-dom"
import { API_BASE } from "../config"
import type { DiversifikasiPM } from "../types/types"

interface DateRange {
  from: string
  to:   string
}

const BRAND = "#2e3192"
const GREEN  = "#80bc00"
const today  = new Date()
const fmt    = (d: Date) => d.toISOString().split("T")[0]

const MONTHS_ID = [
  "Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember",
]

const fmtDisplay = (iso: string | null | undefined): string => {
  if (!iso) return ""
  const raw = iso.slice(0, 10)
  if (raw === "0001-01-01") return ""
  const [y, m, d] = raw.split("-")
  return `${d}/${m}/${y}`
}

function DateRangePicker({ value, onChange }: {
  value: DateRange; onChange: (r: DateRange) => void
}) {
  const [open,      setOpen]      = useState(false)
  const [selecting, setSelecting] = useState<"from" | "to">("from")
  const [hovered,   setHovered]   = useState<string | null>(null)
  const [draft,     setDraft]     = useState<DateRange>(value)
  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [popupPos,  setPopupPos]  = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  const btnRef   = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!popupRef.current?.contains(e.target as Node) &&
          !btnRef.current?.contains(e.target as Node)) setOpen(false)
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

  const isInRange = (dateStr: string) => {
    if (!draft.from) return false
    const t = draft.to || hovered || ""
    if (!t) return false
    const [lo, hi] = draft.from <= t ? [draft.from, t] : [t, draft.from]
    return dateStr > lo && dateStr < hi
  }

  const handleDay = (dateStr: string) => {
    if (selecting === "from") {
      setDraft({ from: dateStr, to: "" }); setSelecting("to")
    } else {
      const [from, to] = draft.from <= dateStr ? [draft.from, dateStr] : [dateStr, draft.from]
      setDraft({ from, to }); setSelecting("from")
    }
  }

  const buildCalendar = (year: number, month: number) => {
    const first = new Date(year, month, 1).getDay()
    const total = new Date(year, month + 1, 0).getDate()
    const cells: (string | null)[] = Array(first).fill(null)
    for (let d = 1; d <= total; d++)
      cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`)
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
        type="button"
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
            if (left + popupWidth > window.innerWidth) left = window.innerWidth - popupWidth - 16
            left = Math.max(8, left)
            top  = Math.max(8, top)
            setPopupPos({ top, left })
          }
          setDraft(value)
          setOpen(o => !o)
          setSelecting("from")
        }}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-indigo-400 transition-colors w-full"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span className="flex-1 text-left">{label}</span>
      </button>

      {open && ReactDOM.createPortal(
        <div
          ref={popupRef}
          style={{ position: "fixed", top: popupPos.top, left: popupPos.left, zIndex: 999999 }}
          className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-2xl shadow-2xl p-5 w-[640px]"
        >
          <p className="text-xs font-semibold text-gray-400 mb-4 text-center uppercase tracking-widest">
            {selecting === "from" ? "Pilih tanggal mulai" : "Pilih tanggal akhir"}
          </p>
          <div className="grid grid-cols-2 gap-6">
            {[
              { year: viewYear, month: viewMonth, cells: buildCalendar(viewYear, viewMonth) },
              { year: nextYear, month: nextMon,   cells: buildCalendar(nextYear, nextMon) },
            ].map(({ year, month, cells }, ci) => (
              <div key={ci}>
                <div className="flex items-center justify-between mb-3">
                  {ci === 0
                    ? <button type="button" onClick={prevMonth} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                      </button>
                    : <span />}
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{MONTHS_ID[month]} {year}</span>
                  {ci === 1
                    ? <button type="button" onClick={nextMonth} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    : <span />}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
                    <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
                  ))}
                  {cells.map((dateStr, i) => {
                    if (!dateStr) return <div key={`e-${i}`} />
                    const isStart  = dateStr === draft.from
                    const isEnd    = dateStr === (draft.to || hovered || "")
                    const inRange  = isInRange(dateStr)
                    const isFuture = dateStr > fmt(today)
                    return (
                      <button key={dateStr} type="button" disabled={isFuture}
                        onClick={() => !isFuture && handleDay(dateStr)}
                        onMouseEnter={() => selecting === "to" && setHovered(dateStr)}
                        onMouseLeave={() => setHovered(null)}
                        className={`text-center text-xs py-1.5 rounded-lg font-medium transition-all
                          ${isFuture ? "text-gray-200 dark:text-gray-700 cursor-not-allowed" : "cursor-pointer"}
                          ${isStart || isEnd ? "text-white font-bold" : ""}
                          ${inRange && !isStart && !isEnd ? "rounded-none" : ""}`}
                        style={{
                          background: isStart || isEnd ? BRAND : inRange ? "#dbeafe" : undefined,
                          color:      isStart || isEnd ? "white" : inRange ? BRAND : undefined,
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
            <button type="button"
              onClick={() => {
                const def = { from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), to: fmt(today) }
                setDraft(def); onChange(def); setSelecting("from"); setOpen(false)
              }}
              className="px-4 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors">
              Reset
            </button>
            <button type="button" onClick={() => setOpen(false)}
              className="px-4 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-500 hover:border-gray-400 transition-colors">
              Batal
            </button>
            <button type="button" onClick={() => { if (draft.from && draft.to) { onChange(draft); setOpen(false) } }}
              disabled={!draft.from || !draft.to}
              className="px-5 py-1.5 text-xs font-semibold rounded-lg text-white disabled:opacity-40"
              style={{ background: BRAND }}>
              Terapkan
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

function KodeItemAutocomplete({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: string[]
}) {
  const [open,  setOpen]  = useState(false)
  const [query, setQuery] = useState(value)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setQuery(value) }, [value])
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const filtered = useMemo(() =>
    query.trim()
      ? options.filter(o => o.toLowerCase().includes(query.toLowerCase())).slice(0, 60)
      : options.slice(0, 60),
    [query, options]
  )

  return (
    <div ref={wrapRef} className="relative">
      <input id="export-pm-kode-item" name="exportPmKodeItem" type="text" value={query}
        placeholder="Ketik kode item… (opsional)"
        autoComplete="off"
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#2e3192] transition-colors"
      />
      {query && (
        <button type="button" onClick={() => { setQuery(""); onChange(""); setOpen(false) }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}
      {open && filtered.length > 0 && (
        <div className="absolute z-[999999] left-0 right-0 mt-1 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-xl max-h-44 overflow-y-auto">
          {filtered.map(opt => (
            <button key={opt} type="button"
              onClick={() => { setQuery(opt); onChange(opt); setOpen(false) }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors first:rounded-t-xl last:rounded-b-xl font-mono">
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface ExportPMModalProps {
  data:    DiversifikasiPM[]
  onClose: () => void
}

export default function ExportPMModal({ data, onClose }: ExportPMModalProps) {
  const [mode,        setMode]        = useState<"all" | "custom">("all")
  const [dateRange,   setDateRange]   = useState<DateRange>({
    from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)),
    to:   fmt(today),
  })
  const [kodeItem,    setKodeItem]    = useState("")
  const [isExporting, setIsExporting] = useState(false)
  const [error,       setError]       = useState("")

  const kodeItemOptions = useMemo(() => {
    const set = new Set<string>()
    for (const row of data) {
      if (row.kodeItem) set.add(row.kodeItem as string)
      for (const rev of (row.revisions ?? [])) {
        if (rev.kodeItem) set.add(rev.kodeItem as string)
      }
    }
    return Array.from(set).sort()
  }, [data])

  const handleExport = async () => {
    setError("")
    if (mode === "custom" && (!dateRange.from || !dateRange.to)) {
      setError("Pilih periode terlebih dahulu.")
      return
    }
    setIsExporting(true)
    try {
      const params = new URLSearchParams({ mode })
      if (mode === "custom") {
        params.set("from", dateRange.from)
        params.set("to",   dateRange.to)
        if (kodeItem.trim()) params.set("kodeItem", kodeItem.trim())
      }

      const res = await fetch(`${API_BASE}/diversifikasi-pm/export?${params.toString()}`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: "Gagal mengunduh file." }))
        throw new Error(json.error || "Gagal mengunduh file.")
      }

      const disposition = res.headers.get("Content-Disposition") ?? ""
      const match       = disposition.match(/filename="?([^";\n]+)"?/)
      const now         = new Date()
      const dd          = String(now.getDate()).padStart(2, "0")
      const mm          = String(now.getMonth() + 1).padStart(2, "0")
      const yyyy        = now.getFullYear()
      const fallback    = `Diversifikasi_PM_${dd}${mm}${yyyy}.xlsx`
      const fileName    = match ? match[1] : fallback

      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href     = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIsExporting(false)
    }
  }

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-neutral-700 w-full max-w-lg mx-4 flex flex-col overflow-visible"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 flex-shrink-0 rounded-t-2xl"
          style={{ background: "linear-gradient(135deg, #2e3192 0%, #1e2060 100%)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Export Data Diversifikasi PM</h3>
              <p className="text-xs text-white/60 mt-0.5">Format XLSX · Packaging Material · Termasuk history revisi</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-visible flex-1">

          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Pilih Mode Export
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setMode("all")}
                className={`relative flex flex-col items-start gap-1.5 p-4 rounded-xl border-2 text-left transition-all ${
                  mode === "all"
                    ? "border-[#2e3192] bg-indigo-50/70 dark:bg-indigo-950/40"
                    : "border-gray-200 dark:border-neutral-700 hover:border-gray-300"
                }`}>
                {mode === "all" && (
                  <span className="absolute top-3 right-3 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: BRAND }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </span>
                )}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${mode === "all" ? "bg-[#2e3192]" : "bg-gray-100 dark:bg-neutral-800"}`}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={mode === "all" ? "white" : "#9ca3af"} strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                </div>
                <span className={`text-sm font-bold ${mode === "all" ? "text-[#2e3192] dark:text-indigo-400" : "text-gray-700 dark:text-gray-200"}`}>
                  Semua Data
                </span>
                <span className="text-[11px] text-gray-400 leading-snug">Seluruh data tanpa filter</span>
              </button>

              <button type="button" onClick={() => setMode("custom")}
                className={`relative flex flex-col items-start gap-1.5 p-4 rounded-xl border-2 text-left transition-all ${
                  mode === "custom"
                    ? "border-[#80bc00] bg-green-50/70 dark:bg-green-950/30"
                    : "border-gray-200 dark:border-neutral-700 hover:border-gray-300"
                }`}>
                {mode === "custom" && (
                  <span className="absolute top-3 right-3 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: GREEN }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </span>
                )}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${mode === "custom" ? "bg-[#80bc00]" : "bg-gray-100 dark:bg-neutral-800"}`}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={mode === "custom" ? "white" : "#9ca3af"} strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <span className={`text-sm font-bold ${mode === "custom" ? "text-[#5a8500] dark:text-green-400" : "text-gray-700 dark:text-gray-200"}`}>
                  Kustom
                </span>
                <span className="text-[11px] text-gray-400 leading-snug">Filter periode &amp; kode item</span>
              </button>
            </div>
          </div>

          <div
            className="overflow-visible transition-all duration-300"
            style={{
              maxHeight:     mode === "custom" ? "500px" : "0px",
              opacity:       mode === "custom" ? 1 : 0,
              pointerEvents: mode === "custom" ? "auto" : "none",
            }}
          >
            <div className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                  Periode (berdasarkan Tgl Penerimaan)
                  <span className="ml-1.5 text-red-400">*</span>
                </label>
                <DateRangePicker value={dateRange} onChange={setDateRange} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                  Kode Item
                  <span className="ml-1.5 text-gray-400 font-normal">(opsional)</span>
                </label>
                <KodeItemAutocomplete value={kodeItem} onChange={setKodeItem} options={kodeItemOptions} />
                {kodeItemOptions.length > 0 && (
                  <p className="mt-1.5 text-[11px] text-gray-400">{kodeItemOptions.length} kode item tersedia</p>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-medium">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-950 flex-shrink-0 rounded-b-2xl">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-500 hover:border-gray-400 transition-colors">
            Batal
          </button>
          <button type="button" onClick={handleExport} disabled={isExporting}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-[0.98]"
            style={{ background: isExporting ? "#6b7280" : GREEN }}>
            {isExporting ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Mengekspor…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download XLSX
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}