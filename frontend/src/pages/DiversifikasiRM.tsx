import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react"
import ReactDOM from "react-dom"
import { useTheme } from "../hooks/useTheme"
import { useAuth } from "../hooks/useAuth"
import type { DiversifikasiRM, DiversifikasiProduk, HasilAnalisa, StatusRM, StatusProject } from "../types/types"
import ItemAutocomplete from "../components/ItemAutocomplete"
import ProductAutocomplete from "../components/ProductAutocomplete"
import SuccessModal from "../components/SuccessModal"
import { useFormDraft, clearFormDraft } from "../hooks/useFormDraft"
import { API_BASE } from "../config"
import ExportRMModal from "./ExportRM"

const DRAFT_KEY_RM = "draft-diversifikasi-rm"
const HEADER_ROW1_HEIGHT = 34

const HASIL_OPTIONS: HasilAnalisa[] = ["MS", "TMS", "OP", "N/A"]
const STATUS_RM_OPTIONS: StatusRM[] = ["Reject", "Release", "On Progress", "N/A"]
const STATUS_PROJECT_OPTIONS: StatusProject[] = ["Done", "Drop", "On Progress"]

const DATE_FIELDS_RM = [
  "tglKirimCPro", "tglTerimaTS", "rmTglKirimQC", "rmTglKeluarHasilAnalisa",
  "tglDilakukanScaleUp", "scaleUpTglKirimQC", "scaleUpTglKeluarHasilAnalisa",
] as const

const PRODUCT_DATE_FIELDS = ["produkTglKirimQC", "produkTglKeluarHasil"] as const

type PaginationState = {
  total: number
  page: number
  perPage: number
  totalPages: number
}

function calcLeadTimeDays(tglKirim: string | null, tglKeluar: string | null): number | null {
  if (!tglKirim) return null
  const start = new Date(tglKirim); start.setHours(0, 0, 0, 0)
  const end = tglKeluar ? new Date(tglKeluar) : new Date(); end.setHours(0, 0, 0, 0)
  const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return diff >= 0 ? diff : null
}

function LeadTimeBadge({ tglKirim, tglKeluar, compact = false }: {
  tglKirim: string | null; tglKeluar: string | null; compact?: boolean
}) {
  const days = calcLeadTimeDays(tglKirim, tglKeluar)
  if (days === null) return <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
  const isDone = !!tglKeluar
  const color =
    days > 14
      ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-800"
      : isDone
        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 border-green-200 dark:border-green-800"
        : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800"

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${color}`}>
        {!isDone && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse inline-block" />}
        {days} hari
      </span>
    )
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold ${color}`}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
      <span>Lead Time: <strong>{days} hari</strong></span>
      {!isDone && (
        <span className="flex items-center gap-1 text-[10px] font-normal opacity-80">
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse inline-block" />
          berjalan
        </span>
      )}
    </div>
  )
}

const fmtDate = (val: string | null | undefined): string => {
  if (!val) return ""
  const d = val.slice(0, 10)
  if (d === "0001-01-01" || d === "") return ""
  const [year, month, day] = d.split("-")
  if (!year || !month || !day) return ""
  return `${day}/${month}/${year}`
}

const fmtDateRaw = (val: string | null | undefined): string => {
  if (!val) return ""
  const d = val.slice(0, 10)
  return d === "0001-01-01" ? "" : d
}

const D = () => <span className="block text-center text-gray-300 dark:text-gray-600 select-none text-xs">—</span>

const DateVal = ({ v }: { v: string | null | undefined }) => {
  const d = fmtDate(v)
  return d ? <span className="whitespace-nowrap text-xs">{d}</span> : <D />
}

const Val = ({ v }: { v: string | null | undefined }) =>
  v ? <span className="text-xs">{v}</span> : <D />

function CopyableTooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const triggerRef = React.useRef<HTMLDivElement>(null)
  const hideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelHide = () => { if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null } }
  const scheduleHide = () => { hideTimer.current = setTimeout(() => setVisible(false), 120) }
  const handleTriggerEnter = () => {
    cancelHide()
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 6, left: rect.left })
    }
    setVisible(true)
  }

  return (
    <div ref={triggerRef} className="relative inline-block w-full"
      onMouseEnter={handleTriggerEnter} onMouseLeave={scheduleHide}>
      {children}
      {visible && text && ReactDOM.createPortal(
        <div onMouseEnter={cancelHide} onMouseLeave={scheduleHide}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 999999, maxWidth: 340, maxHeight: 260, overflowY: "auto", pointerEvents: "auto" }}
          className="bg-gray-900 dark:bg-neutral-700 text-gray-100 text-xs rounded-lg shadow-2xl border border-gray-700 dark:border-neutral-500 px-3 py-2.5 leading-relaxed select-text cursor-text whitespace-pre-wrap break-words">
          {text}
        </div>,
        document.body
      )}
    </div>
  )
}

const BADGE_MAP_HASIL: Record<string, string> = {
  MS:    "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  TMS:   "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  OP:    "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  "N/A": "bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-gray-300",
}
const BADGE_MAP_STATUS: Record<string, string> = {
  Reject:        "bg-red-700 text-white dark:bg-red-800 dark:text-red-100",
  Release:       "bg-green-700 text-white dark:bg-green-800 dark:text-green-100",
  Done:          "bg-green-700 text-white dark:bg-green-800 dark:text-green-100",
  Drop:          "bg-red-700 text-white dark:bg-red-800 dark:text-red-100",
  "On Progress": "bg-amber-500 text-white dark:bg-amber-600 dark:text-white",
  "N/A":         "bg-gray-500 text-white dark:bg-gray-600 dark:text-gray-100",
}

function BadgeHasil({ value }: { value: string }) {
  if (!value) return <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
  const cls = BADGE_MAP_HASIL[value] ?? "bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-gray-300"
  return <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap ${cls}`}>{value}</span>
}

function BadgeStatus({ value }: { value: string }) {
  if (!value) return <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
  const cls = BADGE_MAP_STATUS[value] ?? "bg-gray-500 text-white dark:bg-gray-600 dark:text-gray-100"
  return <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap ${cls}`}>{value}</span>
}

const CPRO_FIELDS    = ["tglKirimCPro", "kodeItem", "namaMaterial", "manufacture", "noBatchMaterial"]
const TS_INFO_FIELDS = ["tglTerimaTS"]
const QC_FIELDS      = ["rmTglKirimQC", "rmTglKeluarHasilAnalisa", "rmFisik", "rmKimia", "rmMikrobiologi", "rmSensoriMaterial", "rmCekKarakteristik", "rmStatus"]
const TS_FIELDS      = ["noBatchScaleUp", "scaleUpStatus", "tglDilakukanScaleUp", "scaleUpTglKirimQC", "scaleUpTglKeluarHasilAnalisa", "linkFileDiversifikasi", "kesimpulan", "scaleUpKodeProduk", "perluAnalisaAndev"]
const ANDEV_FIELDS   = ["andevKimia", "andevVerifikasiMA", "andevStatus"]
const ALL_FIELDS     = ["linkFileDiversifikasi", "kesimpulan"]

function canEdit(division: string | undefined, field: string): boolean {
  if (division === "Admin") return true
  if (ALL_FIELDS.includes(field)) return true
  if (division === "CPro") return CPRO_FIELDS.includes(field)
  if (division === "QC") return QC_FIELDS.includes(field)
  if (division === "Andev") return QC_FIELDS.includes(field) || ANDEV_FIELDS.includes(field)
  if (division === "TS") return TS_FIELDS.includes(field) || TS_INFO_FIELDS.includes(field)
  return false
}
const canEditStatusProject = (div?: string) => div === "Admin" || div === "TS"
const canIsiUlang = (div?: string) => div !== "TS"

type FormData = {
  id?: number
  nomorRM: string
  parentId?: number | null
  statusProject: StatusProject | ""
  tglKirimCPro: string; tglTerimaTS: string
  kodeItem: string; namaMaterial: string; manufacture: string; noBatchMaterial: string
  rmTglKirimQC: string; rmTglKeluarHasilAnalisa: string
  rmFisik: HasilAnalisa | ""; rmKimia: HasilAnalisa | ""
  rmMikrobiologi: HasilAnalisa | ""; rmSensoriMaterial: HasilAnalisa | ""
  rmCekKarakteristik: HasilAnalisa | ""; rmStatus: StatusRM | ""
  perluAnalisaAndev: "Yes" | "No" | ""
  andevKimia: HasilAnalisa | ""
  andevVerifikasiMA: HasilAnalisa | ""
  andevStatus: StatusRM | ""
  scaleUpKodeProduk: string
  noBatchScaleUp: string; scaleUpStatus: StatusRM | ""
  tglDilakukanScaleUp: string; scaleUpTglKirimQC: string
  scaleUpTglKeluarHasilAnalisa: string
  linkFileDiversifikasi: string; kesimpulan: string
  products: DiversifikasiProduk[]
}

const EMPTY_FORM: FormData = {
  nomorRM: "", parentId: null, statusProject: "",
  tglKirimCPro: "", tglTerimaTS: "",
  kodeItem: "", namaMaterial: "", manufacture: "", noBatchMaterial: "",
  rmTglKirimQC: "", rmTglKeluarHasilAnalisa: "",
  rmFisik: "", rmKimia: "", rmMikrobiologi: "", rmSensoriMaterial: "",
  rmCekKarakteristik: "", rmStatus: "",
  perluAnalisaAndev: "", andevKimia: "", andevVerifikasiMA: "", andevStatus: "",
  scaleUpKodeProduk: "",
  noBatchScaleUp: "", scaleUpStatus: "",
  tglDilakukanScaleUp: "", scaleUpTglKirimQC: "", scaleUpTglKeluarHasilAnalisa: "",
  linkFileDiversifikasi: "", kesimpulan: "",
  products: [],
}

const EMPTY_PRODUCT: DiversifikasiProduk = {
  kodeProduk: "",
  produkTglKirimQC: null, produkTglKeluarHasil: null,
  produkFisik: "", produkKimia: "", produkMikrobiologi: "",
  produkSensori: "", produkCekKarakteristik: "",
  stabtestFisik: "", stabtestKimia: "", stabtestMikrobiologi: "",
  stabtestSensoriDFCT: "", stabtestStatus: "", keterangan: "",
}

const OV_SCROLL: React.CSSProperties = {
  position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
  zIndex: 99999, backgroundColor: "rgba(0,0,0,0.55)",
  display: "flex", alignItems: "flex-start", justifyContent: "center",
  padding: "24px 16px", overflowY: "auto", boxSizing: "border-box",
}
const OV_CENTER: React.CSSProperties = {
  position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
  zIndex: 99999, backgroundColor: "rgba(0,0,0,0.55)",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: "24px 16px", boxSizing: "border-box",
}

const LockIcon    = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
const CloseIcon   = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
const PlusIcon    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
const TrashIcon   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>
const EditIcon    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
const RefreshIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
const HistoryIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
const SearchIcon  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
const EmptyIcon   = () => <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
const SaveIcon    = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
const ChevronLeftIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
const ChevronRightIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>

function FieldWrapper({ field, division, children }: {
  field: string; division: string | undefined; children: React.ReactNode
}) {
  if (canEdit(division, field)) return <>{children}</>
  return (
    <div className="relative">
      <div className="opacity-40 pointer-events-none select-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-end pr-3 pointer-events-none">
        <span className="flex items-center gap-1 text-[10px] text-gray-400 font-medium bg-white/80 dark:bg-neutral-900/80 px-1.5 py-0.5 rounded">
          <LockIcon /> Bukan hak akses
        </span>
      </div>
    </div>
  )
}

function FInput({ label, name, value, onChange, type = "text", disabled = false }: {
  label: string; name: string; value: string
  onChange: (v: string) => void; type?: string; disabled?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      <input type={type} name={name} value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#2e3192] transition-colors disabled:cursor-not-allowed disabled:opacity-60" />
    </div>
  )
}

function FSelect({ label, name, value, onChange, options, disabled = false }: {
  label: string; name: string; value: string
  onChange: (v: string) => void; options: readonly string[]; disabled?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      <select name={name} value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#2e3192] transition-colors appearance-none disabled:cursor-not-allowed disabled:opacity-60">
        <option value="">— Pilih —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function SecHeader({ title, badges }: { title: string; badges?: { text: string; color: string }[] }) {
  return (
    <div className="col-span-2 pt-3 pb-1">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="w-1 h-4 bg-[#2e3192] rounded-full flex-shrink-0" />
        <span className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">{title}</span>
        {badges?.map(b => (
          <span key={b.text} className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${b.color}`}>{b.text}</span>
        ))}
      </div>
      <div className="mt-1.5 border-b border-gray-100 dark:border-neutral-800" />
    </div>
  )
}

function PaginationControls({ pagination, onPageChange }: {
  pagination: PaginationState
  onPageChange: (page: number) => void
}) {
  const { page, totalPages, total, perPage } = pagination
  const from = total === 0 ? 0 : (page - 1) * perPage + 1
  const to   = Math.min(page * perPage, total)

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

  return (
    <div className="px-5 py-3 border-t border-gray-100 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-950 flex items-center justify-between flex-wrap gap-2">
      <span className="text-xs text-gray-400 dark:text-gray-500">
        Menampilkan{" "}
        <strong className="text-[#2e3192] dark:text-indigo-400">{from}–{to}</strong>{" "}
        dari <strong className="text-gray-600 dark:text-gray-300">{total}</strong> data
      </span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
          className="p-1.5 rounded-md border border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <ChevronLeftIcon />
        </button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-2 text-xs text-gray-400">…</span>
          ) : (
            <button key={p} onClick={() => onPageChange(p as number)}
              className={`min-w-[28px] h-7 px-1.5 rounded-md text-xs font-medium transition-colors border ${
                p === page
                  ? "bg-[#2e3192] border-[#2e3192] text-white"
                  : "border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800"
              }`}>
              {p}
            </button>
          )
        )}
        <button
          onClick={() => {
            if (page < totalPages) onPageChange(page + 1)
          }}
          disabled={page >= totalPages}
          className="p-1.5 rounded-md border border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <ChevronRightIcon />
        </button>
      </div>
    </div>
  )
}

function ProductListEditor({ products, onChange, canEditProd, onSaveProduk, refreshKey }: {
  products: DiversifikasiProduk[]
  onChange: (p: DiversifikasiProduk[]) => void
  canEditProd: boolean
  onSaveProduk: (kodeProduk: string) => Promise<void>
  refreshKey?: number
}) {
  const [newProdukPerItem, setNewProdukPerItem] = useState<Record<number, string | null>>({})

  const add    = () => onChange([...products, { ...EMPTY_PRODUCT }])
  const remove = (i: number) => {
    onChange(products.filter((_, idx) => idx !== i))
    setNewProdukPerItem(prev => { const next = { ...prev }; delete next[i]; return next })
  }

  const upd = (i: number, field: keyof DiversifikasiProduk, val: string) => {
    const next = [...products]
    if (field === "produkTglKirimQC" || field === "produkTglKeluarHasil") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(next[i] as any)[field] = val ? val : null
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(next[i] as any)[field] = val
    }
    onChange(next)
  }

  useEffect(() => {
    const next = products.map(p => {
      if (!p.produkTglKirimQC) return p
      return {
        ...p,
        produkFisik:            p.produkFisik            || "OP",
        produkKimia:            p.produkKimia            || "OP",
        produkMikrobiologi:     p.produkMikrobiologi     || "OP",
        produkSensori:          p.produkSensori          || "OP",
        produkCekKarakteristik: p.produkCekKarakteristik || "OP",
        stabtestFisik:          p.stabtestFisik          || "OP",
        stabtestKimia:          p.stabtestKimia          || "OP",
        stabtestMikrobiologi:   p.stabtestMikrobiologi   || "OP",
        stabtestSensoriDFCT:    p.stabtestSensoriDFCT    || "OP",
        stabtestStatus:         p.stabtestStatus         || "On Progress",
      }
    })
    const changed = next.some((p, i) => JSON.stringify(p) !== JSON.stringify(products[i]))
    if (changed) onChange(next)
  }, [onChange, products])

  if (!canEditProd) return (
    <p className="text-xs text-gray-400 italic py-2">Produk &amp; Stabtest hanya bisa diisi oleh Admin atau TS.</p>
  )

  return (
    <div className="space-y-4">
      {products.map((p, i) => (
        <div key={i} className="border border-gray-200 dark:border-neutral-700 rounded-xl p-4 space-y-3 bg-gray-50/60 dark:bg-neutral-800/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-violet-700 dark:text-violet-300">Produk {i + 1}</span>
            <button type="button" onClick={() => remove(i)} className="text-red-500 hover:text-red-700 transition-colors"><TrashIcon /></button>
          </div>
          <SecHeader title="Alokasi Produk" />
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Kode Produk</label>
              <ProductAutocomplete
                value={p.kodeProduk}
                onChange={v => { upd(i, "kodeProduk", v); setNewProdukPerItem(prev => ({ ...prev, [i]: null })) }}
                disabled={false}
                refreshKey={refreshKey}
                onNewProductDetected={kode => setNewProdukPerItem(prev => ({ ...prev, [i]: kode }))}
              />
              {newProdukPerItem[i] && (
                <div className="mt-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 rounded-lg">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Kode produk <strong>{newProdukPerItem[i]}</strong> belum ada di database.
                    </p>
                    <button type="button"
                      onClick={async () => { await onSaveProduk(newProdukPerItem[i]!); setNewProdukPerItem(prev => ({ ...prev, [i]: null })) }}
                      className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap">
                      <SaveIcon /> Simpan Kode Produk
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Tgl Kirim QC</label>
              <input id={`rm-tglKirimQC-${i}`} name={`rm-tglKirimQC-${i}`} type="date" value={p.produkTglKirimQC ? String(p.produkTglKirimQC).slice(0, 10) : ""}
                onChange={e => upd(i, "produkTglKirimQC", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#2e3192] transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Tgl Keluar Hasil</label>
              <input id={`rm-tglKeluarHasil-${i}`} name={`rm-tglKeluarHasil-${i}`} type="date" value={p.produkTglKeluarHasil ? String(p.produkTglKeluarHasil).slice(0, 10) : ""}
                onChange={e => upd(i, "produkTglKeluarHasil", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#2e3192] transition-colors" />
            </div>
            {p.produkTglKirimQC && (
              <div className="col-span-2">
                <LeadTimeBadge tglKirim={String(p.produkTglKirimQC)} tglKeluar={p.produkTglKeluarHasil ? String(p.produkTglKeluarHasil) : null} />
              </div>
            )}
            {(["produkFisik", "produkKimia", "produkMikrobiologi", "produkSensori", "produkCekKarakteristik"] as const).map(f => (
              <FSelect key={f} label={
                f === "produkFisik" ? "Fisik" : f === "produkKimia" ? "Kimia" :
                  f === "produkMikrobiologi" ? "Mikrobiologi" : f === "produkSensori" ? "Sensori" : "Cek Karakteristik Produk"
              } name={f} value={p[f]} onChange={v => upd(i, f, v)} options={HASIL_OPTIONS} />
            ))}
          </div>
          <SecHeader title="Stabtest" />
          <div className="grid grid-cols-2 gap-3">
            {(["stabtestFisik", "stabtestKimia", "stabtestMikrobiologi", "stabtestSensoriDFCT"] as const).map(f => (
              <FSelect key={f} label={
                f === "stabtestFisik" ? "Fisik" : f === "stabtestKimia" ? "Kimia" :
                  f === "stabtestMikrobiologi" ? "Mikrobiologi" : "Sensori DFCT"
              } name={f} value={p[f]} onChange={v => upd(i, f, v)} options={HASIL_OPTIONS} />
            ))}
            <FSelect label="Status" name="stabtestStatus" value={p.stabtestStatus}
              onChange={v => upd(i, "stabtestStatus", v)} options={STATUS_RM_OPTIONS} />
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Keterangan</label>
              <textarea id={`rm-keterangan-${i}`} name={`rm-keterangan-${i}`} value={p.keterangan} rows={2} onChange={e => upd(i, "keterangan", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#2e3192] transition-colors resize-none" />
            </div>
          </div>
        </div>
      ))}
      <button type="button" onClick={add}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-violet-400 text-violet-600 dark:text-violet-400 text-xs font-semibold hover:bg-violet-50 dark:hover:bg-violet-950/20 transition-colors">
        <PlusIcon /> Tambah Produk
      </button>
    </div>
  )
}

function ProductDetailModal({ products, namaMaterial, onClose }: {
  products: DiversifikasiProduk[]; namaMaterial: string; onClose: () => void
}) {
  return ReactDOM.createPortal(
    <div style={OV_CENTER} onClick={onClose}>
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-neutral-700 w-full max-w-5xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-neutral-800">
          <div>
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">Detail Alokasi Produk &amp; Stabtest</h3>
            <p className="text-xs text-gray-400 mt-0.5">{namaMaterial}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 px-2.5 py-1 rounded-full font-semibold">{products.length} produk</span>
            <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors"><CloseIcon /></button>
          </div>
        </div>
        <div className="overflow-auto flex-1 p-4">
          <table className="w-full border-collapse text-xs" style={{ minWidth: "900px" }}>
            <thead>
              <tr style={{ height: "36px" }}>
                <th rowSpan={2} className="px-3 bg-[#1e2a7a] text-white text-[10px] font-bold w-10 text-center border-r border-white/20 whitespace-nowrap" style={{ verticalAlign: "middle" }}>No</th>
                <th colSpan={9} className="px-3 bg-[#7c3aed] text-white text-[10px] font-bold text-center border-r border-white/20" style={{ verticalAlign: "middle" }}>ALOKASI PRODUK</th>
                <th colSpan={6} className="px-3 bg-[#047857] text-white text-[10px] font-bold text-center" style={{ verticalAlign: "middle" }}>STABTEST</th>
              </tr>
              <tr style={{ height: "36px" }}>
                {["Kode Produk","Lead Time","Tgl Kirim QC","Tgl Keluar","Fisik","Kimia","Mikro","Sensori","Cek Karakt."].map(h => (
                  <th key={h} style={{ background: "#6d28d9", verticalAlign: "middle" }}
                    className="px-3 text-white text-[10px] font-semibold whitespace-nowrap border-t border-white/20 text-center">{h}</th>
                ))}
                {["Fisik","Kimia","Mikro","Sensori DFCT","Status","Keterangan"].map(h => (
                  <th key={h} style={{ background: "#065f46", verticalAlign: "middle" }}
                    className="px-3 text-white text-[10px] font-semibold whitespace-nowrap border-t border-white/20 text-center">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((prod, i) => (
                <tr key={i} className={`border-b border-gray-100 dark:border-neutral-800 ${i % 2 === 0 ? "bg-white dark:bg-neutral-900" : "bg-violet-50/20 dark:bg-violet-950/10"} hover:bg-violet-50/60 dark:hover:bg-violet-950/30`}>
                  <td className="px-3 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 text-[11px] font-bold">{i + 1}</span>
                  </td>
                  <td className="px-3 py-3 font-semibold text-violet-700 dark:text-violet-300 whitespace-nowrap"><Val v={prod.kodeProduk} /></td>
                  <td className="px-3 py-3 text-center min-w-[110px]">
                    <LeadTimeBadge tglKirim={prod.produkTglKirimQC ? String(prod.produkTglKirimQC) : null} tglKeluar={prod.produkTglKeluarHasil ? String(prod.produkTglKeluarHasil) : null} compact />
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap"><DateVal v={prod.produkTglKirimQC ? String(prod.produkTglKirimQC) : null} /></td>
                  <td className="px-3 py-3 whitespace-nowrap"><DateVal v={prod.produkTglKeluarHasil ? String(prod.produkTglKeluarHasil) : null} /></td>
                  <td className="px-3 py-3 text-center"><BadgeHasil value={prod.produkFisik || ""} /></td>
                  <td className="px-3 py-3 text-center"><BadgeHasil value={prod.produkKimia || ""} /></td>
                  <td className="px-3 py-3 text-center"><BadgeHasil value={prod.produkMikrobiologi || ""} /></td>
                  <td className="px-3 py-3 text-center"><BadgeHasil value={prod.produkSensori || ""} /></td>
                  <td className="px-3 py-3 bg-emerald-50/50 dark:bg-emerald-950/20 text-center"><BadgeHasil value={prod.produkCekKarakteristik || ""} /></td>
                  <td className="px-3 py-3 bg-emerald-50/50 dark:bg-emerald-950/20 text-center"><BadgeHasil value={prod.stabtestFisik || ""} /></td>
                  <td className="px-3 py-3 bg-emerald-50/50 dark:bg-emerald-950/20 text-center"><BadgeHasil value={prod.stabtestKimia || ""} /></td>
                  <td className="px-3 py-3 bg-emerald-50/50 dark:bg-emerald-950/20 text-center"><BadgeHasil value={prod.stabtestMikrobiologi || ""} /></td>
                  <td className="px-3 py-3 bg-emerald-50/50 dark:bg-emerald-950/20 text-center"><BadgeHasil value={prod.stabtestSensoriDFCT || ""} /></td>
                  <td className="px-3 py-3 bg-emerald-50/50 dark:bg-emerald-950/20 text-center"><BadgeStatus value={prod.stabtestStatus || ""} /></td>
                  <td className="px-3 py-3 bg-emerald-50/50 dark:bg-emerald-950/20 max-w-[120px]">
                    {prod.keterangan
                      ? <CopyableTooltip text={prod.keterangan}><span className="block truncate text-xs text-gray-600 dark:text-gray-300">{prod.keterangan}</span></CopyableTooltip>
                      : <D />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-gray-100 dark:border-neutral-800 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-500 hover:border-gray-400 transition-colors">Tutup</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function DiversifikasiRMPage() {
  useTheme()
  const { user, accessToken } = useAuth()
  const division = user?.division

  const authHeaders = {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  }

  const [data, setData]         = useState<DiversifikasiRM[]>([])
  const [loading, setLoading]   = useState(false)

  // Measure the actual rendered height of the first sticky header row so the
  // second header row sticks at the correct offset (avoids relying on a hardcoded px value).
  const headerRow1Ref = useRef<HTMLTableRowElement>(null)
  const [headerRow1Height, setHeaderRow1Height] = useState(HEADER_ROW1_HEIGHT)
  useLayoutEffect(() => {
    const el = headerRow1Ref.current
    if (!el) return
    const measure = () => setHeaderRow1Height(el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener("resize", measure)
    return () => { ro.disconnect(); window.removeEventListener("resize", measure) }
  }, [])

  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination]   = useState<PaginationState>({
    total: 0, page: 1, perPage: 50, totalPages: 1,
  })
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({
    Done: 0, "On Progress": 0, Drop: 0,
  })

  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch]           = useState("")
  const [activeFilter, setActiveFilter] = useState<"all" | StatusProject>("all")

  const [showExport, setShowExport] = useState(false)

  const [showModal, setShowModal]   = useState(false)
  const [isEdit, setIsEdit]         = useState(false)
  const [isIsiUlang, setIsIsiUlang] = useState(false)
  const [form, setForm]             = useState<FormData>(EMPTY_FORM)
  const [successModal, setSuccessModal] = useState<{ open: boolean; message: string }>({ open: false, message: "" })

  const initialFormRef = useRef<FormData>(EMPTY_FORM)

  useFormDraft(DRAFT_KEY_RM, showModal && !isEdit && !isIsiUlang, form, setForm)

  const [pendingNewItem, setPendingNewItem] = useState<{
    kodeItem: string; namaMaterial: string; manufacture: string; isManufactureOnly?: boolean
  } | null>(null)
  const [showNewItemConfirm, setShowNewItemConfirm] = useState(false)

  const [produkRefreshKey, setProdukRefreshKey]     = useState(0)
  const [pendingScaleUpProduk, setPendingScaleUpProduk] = useState<string | null>(null)

  const [expandedRevisions, setExpandedRevisions] = useState<Set<string>>(new Set())
  const [productModal, setProductModal] = useState<{
    open: boolean; products: DiversifikasiProduk[]; namaMaterial: string
  }>({ open: false, products: [], namaMaterial: "" })

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const handleFilterChange = (val: "all" | StatusProject) => {
    setActiveFilter(val)
    setCurrentPage(1)
  }

  useEffect(() => {
    if (!form.rmTglKirimQC) return
    setForm(p => ({
      ...p,
      rmFisik:            p.rmFisik            || "OP",
      rmKimia:            p.rmKimia            || "OP",
      rmMikrobiologi:     p.rmMikrobiologi     || "OP",
      rmSensoriMaterial:  p.rmSensoriMaterial  || "OP",
      rmCekKarakteristik: p.rmCekKarakteristik || "OP",
      rmStatus:           p.rmStatus           || "On Progress",
    }))
  }, [form.rmTglKirimQC])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page:  String(currentPage),
        limit: "50",
        ...(search.trim()          ? { search }              : {}),
        ...(activeFilter !== "all" ? { status: activeFilter } : {}),
      })
      const res = await fetch(`${API_BASE}/diversifikasi-rm?${params}`)
      if (!res.ok) throw new Error()
      const json = await res.json()

      setData(json.data ?? [])
      setPagination({
        total:      json.total      ?? 0,
        page:       json.page       ?? 1,
        perPage:    json.perPage    ?? 50,
        totalPages: json.totalPages ?? 1,
      })
      setStatusCounts(prev => ({ ...prev, ...(json.statusCounts ?? {}) }))
    } catch {
      setData([])
    }
    setLoading(false)
  }, [currentPage, search, activeFilter])

  useEffect(() => { fetchData() }, [fetchData])

  const pillFilters: { label: string; value: "all" | StatusProject; count: number }[] = [
    { label: "Semua",       value: "all",         count: pagination.total           },
    { label: "Done",        value: "Done",        count: statusCounts["Done"]        ?? 0 },
    { label: "Drop",        value: "Drop",        count: statusCounts["Drop"]        ?? 0 },
    { label: "On Progress", value: "On Progress", count: statusCounts["On Progress"] ?? 0 },
  ]

  const set = (field: keyof FormData) => (val: string) =>
    setForm(p => ({ ...p, [field]: val }))

  const toDatetime = (val: string | null | undefined): string | null => {
    if (!val || !val.trim()) return null
    const clean = val.slice(0, 10)
    if (clean === "0001-01-01") return null
    return `${clean}T00:00:00Z`
  }

  const openAdd = () => {
    setIsEdit(false); setIsIsiUlang(false)
    initialFormRef.current = { ...EMPTY_FORM }
    setForm({ ...EMPTY_FORM })
    setPendingNewItem(null); setShowNewItemConfirm(false)
    setPendingScaleUpProduk(null)
    setShowModal(true)
  }

  const openEdit = (row: DiversifikasiRM) => {
    setIsEdit(true); setIsIsiUlang(false)
    const nextForm: FormData = {
      id: row.id,
      nomorRM: row.nomorRM,
      parentId: row.parentId ?? null,
      statusProject: row.statusProject || "",
      tglKirimCPro: fmtDateRaw(row.tglKirimCPro),
      tglTerimaTS: fmtDateRaw(row.tglTerimaTS),
      kodeItem: row.kodeItem || "",
      namaMaterial: row.namaMaterial || "",
      manufacture: row.manufacture || "",
      noBatchMaterial: row.noBatchMaterial || "",
      rmTglKirimQC: fmtDateRaw(row.rmTglKirimQC),
      rmTglKeluarHasilAnalisa: fmtDateRaw(row.rmTglKeluarHasilAnalisa),
      rmFisik: (row.rmFisik || "") as HasilAnalisa | "",
      rmKimia: (row.rmKimia || "") as HasilAnalisa | "",
      rmMikrobiologi: (row.rmMikrobiologi || "") as HasilAnalisa | "",
      rmSensoriMaterial: (row.rmSensoriMaterial || "") as HasilAnalisa | "",
      rmCekKarakteristik: (row.rmCekKarakteristik || "") as HasilAnalisa | "",
      rmStatus: (row.rmStatus || "") as StatusRM | "",
      perluAnalisaAndev: (row.perluAnalisaAndev || "") as "Yes" | "No" | "",
      andevKimia: (row.andevKimia || "") as HasilAnalisa | "",
      andevVerifikasiMA: (row.andevVerifikasiMA || "") as HasilAnalisa | "",
      andevStatus: (row.andevStatus || "") as StatusRM | "",
      scaleUpKodeProduk: row.scaleUpKodeProduk || "",
      noBatchScaleUp: row.noBatchScaleUp || "",
      scaleUpStatus: (row.scaleUpStatus || "") as StatusRM | "",
      tglDilakukanScaleUp: fmtDateRaw(row.tglDilakukanScaleUp),
      scaleUpTglKirimQC: fmtDateRaw(row.scaleUpTglKirimQC),
      scaleUpTglKeluarHasilAnalisa: fmtDateRaw(row.scaleUpTglKeluarHasilAnalisa),
      linkFileDiversifikasi: row.linkFileDiversifikasi || "",
      kesimpulan: row.kesimpulan || "",
      products: (row.products || []).map(p => ({
        ...p,
        produkTglKirimQC: p.produkTglKirimQC ? String(p.produkTglKirimQC).slice(0, 10) : null,
        produkTglKeluarHasil: p.produkTglKeluarHasil ? String(p.produkTglKeluarHasil).slice(0, 10) : null,
      })),
    }
    initialFormRef.current = nextForm
    setForm(nextForm)
    setPendingNewItem(null); setShowNewItemConfirm(false)
    setPendingScaleUpProduk(null)
    setShowModal(true)
  }

  const openIsiUlang = (row: DiversifikasiRM) => {
    setIsEdit(false); setIsIsiUlang(true)
    const nextForm: FormData = { ...EMPTY_FORM, nomorRM: row.nomorRM, parentId: row.id }
    initialFormRef.current = nextForm
    setForm(nextForm)
    setPendingNewItem(null); setShowNewItemConfirm(false)
    setPendingScaleUpProduk(null)
    setShowModal(true)
  }

  const handleReset = () => {
    setForm({ ...initialFormRef.current })
    setPendingNewItem(null); setShowNewItemConfirm(false)
    setPendingScaleUpProduk(null)
    if (!isEdit && !isIsiUlang) clearFormDraft(DRAFT_KEY_RM)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload: Record<string, unknown> = { ...form, parentId: form.parentId ?? null }
    for (const f of DATE_FIELDS_RM) { payload[f] = toDatetime(form[f] as string) }
    payload.products = form.products.map(p => {
      const pp: Record<string, unknown> = { ...p }
      delete pp.id; delete pp.diversifikasiRmId
      for (const f of PRODUCT_DATE_FIELDS) {
        const val = pp[f]
        pp[f] = val ? `${String(val).slice(0, 10)}T00:00:00Z` : null
      }
      return pp
    })
    try {
      const url    = isEdit && form.id ? `${API_BASE}/diversifikasi-rm/${form.id}` : `${API_BASE}/diversifikasi-rm`   
      const method = isEdit ? "PUT" : "POST"
      const res    = await fetch(url, { method, headers: authHeaders, body: JSON.stringify(payload) })
      if (!res.ok) { const e = await res.json().catch(() => ({ error: "Failed" })); throw new Error(e.error) }
      await fetchData()
      if (!isEdit && !isIsiUlang) {
        clearFormDraft(DRAFT_KEY_RM)
        setForm({ ...EMPTY_FORM })
      }
      setSuccessModal({
        open: true,
        message: isEdit ? "Data berhasil diperbarui." : isIsiUlang ? "Isi ulang berhasil disimpan." : "Data berhasil ditambahkan.",
      })
      setShowModal(false)
    } catch (err) { alert(`Gagal: ${(err as Error).message}`) }
  }

  const handleDelete = async (id?: number) => {
    if (!id || !confirm("Hapus data ini?")) return
    try {
      const res = await fetch(`${API_BASE}/diversifikasi/${id}`, { method: "DELETE", headers: authHeaders })
      if (!res.ok) throw new Error()
      if (data.length === 1 && currentPage > 1) setCurrentPage(p => p - 1)
      else await fetchData()
      alert("Data berhasil dihapus")
    } catch { alert("Gagal menghapus") }
  }

  const saveNewItemToDB = async () => {
    if (!form.kodeItem || !form.namaMaterial) { alert("Kode Item dan Nama Material wajib diisi"); return }
    try {
      const res = await fetch(`${API_BASE}/master-items`, {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ kodeItem: form.kodeItem, namaMaterial: form.namaMaterial, manufacture: form.manufacture || "" }),
      })
      if (res.ok) { setPendingNewItem(null); setShowNewItemConfirm(false); alert("Item baru berhasil disimpan") }
      else { const e = await res.json().catch(() => ({})); alert(`Gagal: ${e.error || "Unknown"}`) }
    } catch { alert("Gagal menyimpan item baru") }
  }

  const saveNewProdukToDB = async (kodeProduk: string): Promise<void> => {
    if (!kodeProduk) return
    try {
      const res = await fetch(`${API_BASE}/master-products`, {
        method: "POST", headers: authHeaders, body: JSON.stringify({ kodeProduk }),
      })
      if (res.ok) { setProdukRefreshKey(k => k + 1); alert(`Kode produk "${kodeProduk}" berhasil disimpan`) }
      else if (res.status === 409) { setProdukRefreshKey(k => k + 1); alert(`Kode produk "${kodeProduk}" sudah terdaftar`) }
      else { const e = await res.json().catch(() => ({})); alert(`Gagal: ${e.error || "Unknown"}`) }
    } catch { alert("Gagal menyimpan kode produk baru") }
  }

  const toggleRevision = (nomorRM: string) => {
    setExpandedRevisions(prev => {
      const next = new Set(prev)
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      next.has(nomorRM) ? next.delete(nomorRM) : next.add(nomorRM)
      return next
    })
  }

  const roleBanner =
    division === "CPro"  ? { text: "CPro",  color: "bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-950/40 dark:border-violet-800 dark:text-violet-300" } :
    division === "QC"    ? { text: "QC",    color: "bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-300" } :
    division === "Andev" ? { text: "Andev", color: "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/40 dark:border-orange-800 dark:text-orange-300" } :
    division === "TS"    ? { text: "TS",    color: "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300" } :
    null

  const renderRow = (row: DiversifikasiRM, idx: number, isRevision = false) => {
    const hasRevisions = !isRevision && (row.revisions?.length ?? 0) > 0
    const revExpanded  = expandedRevisions.has(row.nomorRM)
    const products     = row.products || []

    const bgBase = isRevision
      ? "bg-amber-50/70 dark:bg-amber-950/20"
      : idx % 2 === 0 ? "bg-white dark:bg-neutral-900" : "bg-slate-50/80 dark:bg-neutral-950"

    return (
      <tr key={`${isRevision ? "rev" : "main"}-${row.id}`}
        className={`${bgBase} border-b border-gray-100 dark:border-neutral-800 transition-colors ${!isRevision ? "hover:bg-blue-50/30 dark:hover:bg-blue-950/10" : ""}`}>

        <td className="px-3 py-2.5 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            {isRevision && <span className="flex-shrink-0 w-2 h-2 rounded-full bg-amber-400" title="Data lama" />}
            <span className="text-[11px] font-mono font-bold text-[#2e3192] dark:text-indigo-400">{row.nomorRM}</span>
            {hasRevisions && (
              <button onClick={() => toggleRevision(row.nomorRM)}
                title={revExpanded ? "Sembunyikan riwayat" : `${row.revisions!.length} riwayat`}
                className={`transition-colors ${revExpanded ? "text-amber-500" : "text-gray-400 hover:text-amber-500"}`}>
                <HistoryIcon />
              </button>
            )}
          </div>
        </td>
        <td className="px-3 py-2.5 text-center"><BadgeStatus value={row.statusProject || ""} /></td>
        <td className="px-3 py-2.5 whitespace-nowrap"><DateVal v={row.tglKirimCPro} /></td>
        <td className="px-3 py-2.5 whitespace-nowrap"><DateVal v={row.tglTerimaTS} /></td>
        <td className="px-3 py-2.5 whitespace-nowrap text-[11px] font-semibold text-[#2e3192] dark:text-indigo-400">{row.kodeItem || <D />}</td>
        <td className="px-3 py-2.5" style={{ minWidth: "220px", maxWidth: "320px" }}>
          {row.namaMaterial ? <span className="text-xs text-gray-700 dark:text-gray-200 font-medium break-words leading-relaxed">{row.namaMaterial}</span> : <D />}
        </td>
        <td className="px-3 py-2.5" style={{ minWidth: "180px", maxWidth: "260px" }}>
          {row.manufacture ? <span className="text-xs text-gray-700 dark:text-gray-200 break-words leading-relaxed">{row.manufacture}</span> : <D />}
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap"><Val v={row.noBatchMaterial} /></td>

        <td className="px-3 py-2.5 bg-orange-50/50 dark:bg-orange-950/10 text-center whitespace-nowrap">
          {row.perluAnalisaAndev
            ? <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap ${row.perluAnalisaAndev === "Yes" ? "bg-emerald-600 text-white" : "bg-red-500 text-white"}`}>{row.perluAnalisaAndev}</span>
            : <D />}
        </td>
        <td className="px-3 py-2.5 bg-orange-50/50 dark:bg-orange-950/10 text-center">
          {row.perluAnalisaAndev === "Yes" ? <BadgeHasil value={row.andevKimia || ""} /> : <D />}
        </td>
        <td className="px-3 py-2.5 bg-orange-50/50 dark:bg-orange-950/10 text-center">
          {row.perluAnalisaAndev === "Yes" ? <BadgeHasil value={row.andevVerifikasiMA || ""} /> : <D />}
        </td>
        <td className="px-3 py-2.5 bg-orange-50/50 dark:bg-orange-950/10 text-center">
          {row.perluAnalisaAndev === "Yes" ? <BadgeStatus value={row.andevStatus || ""} /> : <D />}
        </td>

        <td className="px-3 py-2.5 bg-sky-50/50 dark:bg-sky-950/10 text-center min-w-[90px] whitespace-nowrap">
          <LeadTimeBadge tglKirim={row.rmTglKirimQC} tglKeluar={row.rmTglKeluarHasilAnalisa} compact />
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap bg-sky-50/50 dark:bg-sky-950/10"><DateVal v={row.rmTglKirimQC} /></td>
        <td className="px-3 py-2.5 whitespace-nowrap bg-sky-50/50 dark:bg-sky-950/10"><DateVal v={row.rmTglKeluarHasilAnalisa} /></td>
        <td className="px-3 py-2.5 bg-sky-50/50 dark:bg-sky-950/10 text-center"><BadgeHasil value={row.rmFisik || ""} /></td>
        <td className="px-3 py-2.5 bg-sky-50/50 dark:bg-sky-950/10 text-center"><BadgeHasil value={row.rmKimia || ""} /></td>
        <td className="px-3 py-2.5 bg-sky-50/50 dark:bg-sky-950/10 text-center"><BadgeHasil value={row.rmMikrobiologi || ""} /></td>
        <td className="px-3 py-2.5 bg-sky-50/50 dark:bg-sky-950/10 text-center"><BadgeHasil value={row.rmSensoriMaterial || ""} /></td>
        <td className="px-3 py-2.5 bg-sky-50/50 dark:bg-sky-950/10 text-center"><BadgeHasil value={row.rmCekKarakteristik || ""} /></td>
        <td className="px-3 py-2.5 bg-sky-50/50 dark:bg-sky-950/10 text-center"><BadgeStatus value={row.rmStatus || ""} /></td>

        <td className="px-3 py-2.5 text-center bg-violet-50/50 dark:bg-violet-950/10">
          {products.length > 0 ? (
            <button onClick={() => setProductModal({ open: true, products, namaMaterial: row.namaMaterial || "" })}
              title="Lihat detail produk"
              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300 text-[11px] font-bold hover:bg-violet-200 dark:hover:bg-violet-800 transition-colors ring-2 ring-transparent hover:ring-violet-300 cursor-pointer">
              {products.length}
            </button>
          ) : (
            <span className="text-gray-300 dark:text-gray-600 text-xs">0</span>
          )}
        </td>

        <td className="px-3 py-2.5 bg-emerald-50/50 dark:bg-emerald-950/10 whitespace-nowrap text-[11px] font-semibold text-[#2e3192] dark:text-indigo-400">{row.scaleUpKodeProduk || <D />}</td>
        <td className="px-3 py-2.5 bg-emerald-50/50 dark:bg-emerald-950/10 whitespace-nowrap"><Val v={row.noBatchScaleUp} /></td>
        <td className="px-3 py-2.5 bg-emerald-50/50 dark:bg-emerald-950/10 text-center"><BadgeStatus value={row.scaleUpStatus || ""} /></td>
        <td className="px-3 py-2.5 bg-emerald-50/50 dark:bg-emerald-950/10 whitespace-nowrap"><DateVal v={row.tglDilakukanScaleUp} /></td>
        <td className="px-3 py-2.5 bg-emerald-50/50 dark:bg-emerald-950/10 whitespace-nowrap"><DateVal v={row.scaleUpTglKirimQC} /></td>
        <td className="px-3 py-2.5 bg-emerald-50/50 dark:bg-emerald-950/10 whitespace-nowrap"><DateVal v={row.scaleUpTglKeluarHasilAnalisa} /></td>
        <td className="px-3 py-2.5 bg-emerald-50/50 dark:bg-emerald-950/10 max-w-[140px]">
          {row.linkFileDiversifikasi
            ? <CopyableTooltip text={row.linkFileDiversifikasi}><span className="block truncate text-xs text-gray-600 dark:text-gray-300">{row.linkFileDiversifikasi}</span></CopyableTooltip>
            : <D />}
        </td>
        <td className="px-3 py-2.5 bg-emerald-50/50 dark:bg-emerald-950/10 max-w-[140px]">
          {row.kesimpulan
            ? <CopyableTooltip text={row.kesimpulan}><span className="block truncate text-xs text-gray-600 dark:text-gray-300">{row.kesimpulan}</span></CopyableTooltip>
            : <D />}
        </td>

        <td className="px-3 py-2.5">
          {isRevision ? (
            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 rounded whitespace-nowrap">Riwayat Revisi</span>
          ) : (
            <div className="flex items-center gap-1">
              <button onClick={() => openEdit(row)} title="Edit"
                className="p-1.5 rounded-md text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 border border-transparent hover:border-amber-200 dark:hover:border-amber-800 transition-colors">
                <EditIcon />
              </button>
              {row.rmStatus === "Reject" && canIsiUlang(division) && (
                <button onClick={() => openIsiUlang(row)} title="Isi Ulang"
                  className="p-1.5 rounded-md text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 border border-transparent hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
                  <RefreshIcon />
                </button>
              )}
              {division === "Admin" && (
                <button onClick={() => handleDelete(row.id)} title="Hapus"
                  className="p-1.5 rounded-md text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border border-transparent hover:border-red-200 dark:hover:border-red-800 transition-colors">
                  <TrashIcon />
                </button>
              )}
            </div>
          )}
        </td>
      </tr>
    )
  }

  const COL_COUNT = 31

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 px-8 py-7 font-sans transition-colors duration-300 space-y-4">

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Diversifikasi RM</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Monitoring Diversifikasi Raw Material</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowExport(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2e3192] text-[#2e3192] dark:text-indigo-400 dark:border-indigo-500 bg-transparent hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-sm font-semibold transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export XLSX
          </button>
          <button onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2e3192] hover:bg-[#252880] text-white text-sm font-semibold transition-colors shadow-sm">
            <PlusIcon /> Tambah Data
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {pillFilters.map(f => {
          const active = activeFilter === f.value
          return (
            <button key={f.value} onClick={() => handleFilterChange(f.value)}
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border-2 text-sm font-medium transition-all duration-200 outline-none ${
                active
                  ? "border-[#2e3192] bg-indigo-50 text-[#2e3192] dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-400"
                  : "border-transparent bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700"
              }`}>
              <span className="w-2 h-2 rounded-full bg-current opacity-70" />
              {f.label}
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                active
                  ? "bg-[#2e3192]/10 text-[#2e3192] dark:bg-indigo-300/20 dark:text-indigo-300"
                  : "bg-gray-200 text-gray-500 dark:bg-neutral-700 dark:text-gray-400"
              }`}>{f.count}</span>
            </button>
          )
        })}
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-5 py-4 mb-5 flex flex-wrap gap-3 items-center transition-colors duration-300">
        <div className="relative flex-1 min-w-[280px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><SearchIcon /></span>
          <input id="rm-search" name="rmSearch" type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
            placeholder="Cari nomor RM, kode item, nama material, manufacture..."
            className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-[#2e3192] dark:focus:border-indigo-400 transition-colors" />
          {searchInput && (
            <button onClick={() => { setSearchInput(""); setSearch(""); setCurrentPage(1) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors">
              <CloseIcon />
            </button>
          )}
        </div>
        <span className="text-sm text-gray-400 ml-auto">
          <strong className="text-gray-600 dark:text-gray-300">{pagination.total}</strong> data
        </span>
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full border-separate text-xs" style={{ minWidth: "2200px", borderSpacing: 0 }}>
              <thead>
                <tr ref={headerRow1Ref}>
                  <th rowSpan={2} className="px-3 py-0 text-[10px] font-bold uppercase text-white bg-[#1e2a7a] sticky top-0 z-20 shadow text-center border-r border-white/20 whitespace-nowrap" style={{ verticalAlign: "middle" }}>No (RM)</th>
                  <th rowSpan={2} className="px-3 py-0 text-[10px] font-bold uppercase text-white bg-[#1e2a7a] sticky top-0 z-20 shadow text-center border-r border-white/20 whitespace-nowrap" style={{ verticalAlign: "middle" }}>Status Project</th>
                  <th colSpan={6} className="py-2 text-center text-[10px] font-bold text-white bg-[#2e3192] sticky top-0 z-20 shadow border-x border-white/20" style={{ height: HEADER_ROW1_HEIGHT }}>INFORMASI UMUM</th>
                  <th colSpan={4} className="py-2 text-center text-[10px] font-bold text-white bg-[#c2410c] sticky top-0 z-20 shadow border-x border-white/20" style={{ height: HEADER_ROW1_HEIGHT }}>ANDEV</th>
                  <th colSpan={9} className="py-2 text-center text-[10px] font-bold text-white bg-[#0369a1] sticky top-0 z-20 shadow border-x border-white/20" style={{ height: HEADER_ROW1_HEIGHT }}>RAW MATERIAL</th>
                  <th colSpan={1} className="py-2 text-center text-[10px] font-bold text-white bg-[#7c3aed] sticky top-0 z-20 shadow border-x border-white/20" style={{ height: HEADER_ROW1_HEIGHT }}>ALOKASI PRODUK</th>
                  <th colSpan={8} className="py-2 text-center text-[10px] font-bold text-white bg-[#047857] sticky top-0 z-20 shadow border-x border-white/20" style={{ height: HEADER_ROW1_HEIGHT }}>SCALE UP / COMMERCIAL</th>
                  <th rowSpan={2} className="px-3 py-0 text-[10px] font-bold uppercase text-white bg-[#1e2a7a] sticky top-0 z-20 shadow text-center border-l border-white/20 whitespace-nowrap" style={{ verticalAlign: "middle" }}>Aksi</th>
                </tr>
                <tr>
                  {["Tgl Kirim CPro","Tgl Terima TS","Kode Item","Nama Material","Manufacture","No Batch"].map(h => (
                    <th key={h} className="px-3 py-2 text-[10px] font-semibold uppercase text-white whitespace-nowrap bg-[#3d43b8] sticky z-10 shadow border-t border-white/10" style={{ top: headerRow1Height }}>{h}</th>
                  ))}
                  {["Perlu Analisa?","Kimia","Verifikasi MA","Status"].map(h => (
                    <th key={h} className="px-3 py-2 text-[10px] font-semibold uppercase text-white whitespace-nowrap bg-[#9a3412] sticky z-10 shadow text-center border-t border-white/10" style={{ top: headerRow1Height }}>{h}</th>
                  ))}
                  {["Lead Time","Tgl Kirim QC","Tgl Keluar","Fisik","Kimia","Mikro","Sensori","Cek Karakt.","Status"].map(h => (
                    <th key={h} className="px-3 py-2 text-[10px] font-semibold uppercase text-white whitespace-nowrap bg-[#0284b3] sticky z-10 shadow text-center border-t border-white/10" style={{ top: headerRow1Height }}>{h}</th>
                  ))}
                  <th className="px-3 py-2 text-[10px] font-semibold uppercase text-white whitespace-nowrap bg-[#6d28d9] sticky z-10 shadow text-center border-t border-white/10" style={{ top: headerRow1Height }}>Jumlah</th>
                  {["Kode Produk","No Batch","Status","Tgl Scale Up","Tgl Kirim QC","Tgl Keluar","Link File","Kesimpulan"].map(h => (
                    <th key={h} className="px-3 py-2 text-[10px] font-semibold uppercase text-white whitespace-nowrap bg-[#065f46] sticky z-10 shadow border-t border-white/10" style={{ top: headerRow1Height }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={COL_COUNT}>
                    <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      <span className="text-sm">Memuat data...</span>
                    </div>
                  </td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan={COL_COUNT}>
                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400 dark:text-gray-500">
                      <span className="opacity-30"><EmptyIcon /></span>
                      <span className="text-sm font-medium">
                        {search || activeFilter !== "all" ? "Tidak ada data yang sesuai filter" : "Belum ada data diversifikasi RM"}
                      </span>
                      {(search || activeFilter !== "all") && (
                        <button onClick={() => { setSearchInput(""); setSearch(""); handleFilterChange("all") }}
                          className="text-xs text-[#2e3192] dark:text-indigo-400 hover:underline">Reset filter</button>
                      )}
                    </div>
                  </td></tr>
                ) : (
                  data.map((row, idx) => (
                    <React.Fragment key={`main-${row.id}`}>
                      {renderRow(row, idx, false)}
                      {expandedRevisions.has(row.nomorRM) && row.revisions?.map(rev =>
                        renderRow(rev, idx, true)
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {!loading && pagination.total > 0 && (
          <PaginationControls
            pagination={pagination}
            onPageChange={page => setCurrentPage(page)}
          />
        )}

        {!loading && pagination.total > 0 && (
          <div className="px-5 pb-2 flex justify-end">
            <span className="text-xs text-gray-300 dark:text-gray-600 flex items-center gap-1">
              <HistoryIcon /> = riwayat isi ulang
            </span>
          </div>
        )}
      </div>

      {productModal.open && (
        <ProductDetailModal
          products={productModal.products}
          namaMaterial={productModal.namaMaterial}
          onClose={() => setProductModal(p => ({ ...p, open: false }))}
        />
      )}

      {showExport && <ExportRMModal data={data} onClose={() => setShowExport(false)} />}

      <SuccessModal
        open={successModal.open}
        message={successModal.message}
        onClose={() => setSuccessModal({ open: false, message: "" })}
      />

      {showModal && ReactDOM.createPortal(
        <div style={OV_SCROLL}>
          <div className="relative bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-2xl w-full max-w-4xl shadow-2xl my-auto">
            <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100 dark:border-neutral-800">
              <div>
                <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">
                  {isIsiUlang ? `Isi Ulang Data — ${form.nomorRM}` :
                    isEdit ? "Edit Data Diversifikasi RM" : "Tambah Data Diversifikasi RM"}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">Isi field sesuai hak akses divisi Anda</p>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-red-500 transition-colors"><CloseIcon /></button>
            </div>

            {roleBanner && (
              <div className={`mx-7 mt-5 px-4 py-2.5 rounded-lg border text-xs font-medium flex items-center gap-2 ${roleBanner.color}`}>
                <LockIcon /> Login sebagai <strong>{roleBanner.text}</strong> — field yang bukan hak akses dikunci otomatis.
              </div>
            )}
            {isIsiUlang && (
              <div className="mx-7 mt-3 px-4 py-2.5 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <RefreshIcon />
                <span>Mengisi ulang <strong>{form.nomorRM}</strong>. Data lama tetap tersimpan sebagai riwayat.</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="px-7 py-6 grid grid-cols-2 gap-x-5 gap-y-3 max-h-[65vh] overflow-y-auto">

                {canEditStatusProject(division) && !isIsiUlang && (
                  <>
                    <SecHeader title="Status Project" />
                    <div className="col-span-2">
                      <FSelect label="Status Project" name="statusProject" value={form.statusProject}
                        onChange={set("statusProject")} options={STATUS_PROJECT_OPTIONS} />
                    </div>
                  </>
                )}

                <SecHeader title="Informasi Umum" badges={[
                  { text: "CPro", color: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" }
                ]} />
                <FieldWrapper field="tglKirimCPro" division={division}>
                  <FInput label="Tgl Kirim CPro" name="tglKirimCPro" value={form.tglKirimCPro}
                    onChange={set("tglKirimCPro")} type="date" disabled={!canEdit(division, "tglKirimCPro")} />
                </FieldWrapper>
                <FieldWrapper field="tglTerimaTS" division={division}>
                  <FInput label="Tgl Terima di TS" name="tglTerimaTS" value={form.tglTerimaTS}
                    onChange={set("tglTerimaTS")} type="date" disabled={!canEdit(division, "tglTerimaTS")} />
                </FieldWrapper>

                <div className="col-span-2">
                  <ItemAutocomplete
                    kodeItemValue={form.kodeItem} namaMaterialValue={form.namaMaterial} manufactureValue={form.manufacture}
                    onKodeItemChange={v => { setForm(p => ({ ...p, kodeItem: v })); setShowNewItemConfirm(false); setPendingNewItem(null) }}
                    onNamaMaterialChange={v => { setForm(p => ({ ...p, namaMaterial: v })); setShowNewItemConfirm(false); setPendingNewItem(null) }}
                    onManufactureChange={v => setForm(p => ({ ...p, manufacture: v }))}
                    disabled={!canEdit(division, "kodeItem")}
                    onNewItemDetected={(kode, nama, mfr, isManufactureOnly) => {
                      setPendingNewItem({ kodeItem: kode, namaMaterial: nama, manufacture: mfr, isManufactureOnly })
                      setShowNewItemConfirm(true)
                    }}
                  />
                  {showNewItemConfirm && pendingNewItem && canEdit(division, "kodeItem") && (
                    <div className="mt-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 rounded-lg">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                            {pendingNewItem.isManufactureOnly ? "Manufacture baru terdeteksi" : "Item baru terdeteksi"}
                          </p>
                          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                            {pendingNewItem.isManufactureOnly
                              ? <>Item <strong>{form.kodeItem}</strong> sudah ada, tetapi manufacture <strong>{form.manufacture}</strong> belum terdaftar.</>
                              : <><strong>{form.kodeItem}</strong> — {form.namaMaterial}{form.manufacture && ` (${form.manufacture})`} tidak ada di database.</>}
                          </p>
                        </div>
                        <button type="button" onClick={saveNewItemToDB}
                          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors">
                          <SaveIcon /> Simpan Item Baru
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <FieldWrapper field="noBatchMaterial" division={division}>
                  <FInput label="No Batch Material" name="noBatchMaterial" value={form.noBatchMaterial}
                    onChange={set("noBatchMaterial")} disabled={!canEdit(division, "noBatchMaterial")} />
                </FieldWrapper>

                <SecHeader title="Analisa Andev" badges={[
                  { text: "TS",    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
                  { text: "Andev", color: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
                ]} />
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Perlu Analisa Andev?</label>
                  {canEdit(division, "perluAnalisaAndev") ? (
                    <div className="flex gap-2">
                      {(["Yes", "No"] as const).map(opt => (
                        <button key={opt} type="button" onClick={() => set("perluAnalisaAndev")(opt)}
                          className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                            form.perluAnalisaAndev === opt
                              ? opt === "Yes" ? "bg-emerald-600 border-emerald-600 text-white" : "bg-red-500 border-red-500 text-white"
                              : "bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 text-gray-500 hover:border-gray-400"}`}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {(["Yes", "No"] as const).map(opt => (
                        <span key={opt} className={`px-4 py-1.5 rounded-lg text-xs font-semibold border ${
                          form.perluAnalisaAndev === opt
                            ? opt === "Yes" ? "bg-emerald-600 border-emerald-600 text-white" : "bg-red-500 border-red-500 text-white"
                            : "bg-gray-50 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 text-gray-300 dark:text-gray-600"}`}>
                          {opt}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {form.perluAnalisaAndev === "Yes" && (
                  <>
                    <FieldWrapper field="andevKimia" division={division}>
                      <FSelect label="Kimia" name="andevKimia" value={form.andevKimia}
                        onChange={set("andevKimia")} options={HASIL_OPTIONS} disabled={!canEdit(division, "andevKimia")} />
                    </FieldWrapper>
                    <FieldWrapper field="andevVerifikasiMA" division={division}>
                      <FSelect label="Verifikasi MA" name="andevVerifikasiMA" value={form.andevVerifikasiMA}
                        onChange={set("andevVerifikasiMA")} options={HASIL_OPTIONS} disabled={!canEdit(division, "andevVerifikasiMA")} />
                    </FieldWrapper>
                    <FieldWrapper field="andevStatus" division={division}>
                      <FSelect label="Status" name="andevStatus" value={form.andevStatus}
                        onChange={set("andevStatus")} options={STATUS_RM_OPTIONS} disabled={!canEdit(division, "andevStatus")} />
                    </FieldWrapper>
                  </>
                )}

                <SecHeader title="Raw Material" badges={[
                  { text: "QC",    color: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
                  { text: "Andev", color: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
                ]} />
                <FieldWrapper field="rmTglKirimQC" division={division}>
                  <FInput label="Tgl Kirim QC" name="rmTglKirimQC" value={form.rmTglKirimQC}
                    onChange={set("rmTglKirimQC")} type="date" disabled={!canEdit(division, "rmTglKirimQC")} />
                </FieldWrapper>
                <FieldWrapper field="rmTglKeluarHasilAnalisa" division={division}>
                  <FInput label="Tgl Keluar Hasil Analisa" name="rmTglKeluarHasilAnalisa" value={form.rmTglKeluarHasilAnalisa}
                    onChange={set("rmTglKeluarHasilAnalisa")} type="date" disabled={!canEdit(division, "rmTglKeluarHasilAnalisa")} />
                </FieldWrapper>
                {form.rmTglKirimQC && (
                  <div className="col-span-2">
                    <LeadTimeBadge tglKirim={form.rmTglKirimQC} tglKeluar={form.rmTglKeluarHasilAnalisa} />
                  </div>
                )}
                <FieldWrapper field="rmFisik" division={division}>
                  <FSelect label="Fisik" name="rmFisik" value={form.rmFisik}
                    onChange={set("rmFisik")} options={HASIL_OPTIONS} disabled={!canEdit(division, "rmFisik")} />
                </FieldWrapper>
                <FieldWrapper field="rmKimia" division={division}>
                  <FSelect label="Kimia" name="rmKimia" value={form.rmKimia}
                    onChange={set("rmKimia")} options={HASIL_OPTIONS} disabled={!canEdit(division, "rmKimia")} />
                </FieldWrapper>
                <FieldWrapper field="rmMikrobiologi" division={division}>
                  <FSelect label="Mikrobiologi" name="rmMikrobiologi" value={form.rmMikrobiologi}
                    onChange={set("rmMikrobiologi")} options={HASIL_OPTIONS} disabled={!canEdit(division, "rmMikrobiologi")} />
                </FieldWrapper>
                <FieldWrapper field="rmSensoriMaterial" division={division}>
                  <FSelect label="Sensori Material" name="rmSensoriMaterial" value={form.rmSensoriMaterial}
                    onChange={set("rmSensoriMaterial")} options={HASIL_OPTIONS} disabled={!canEdit(division, "rmSensoriMaterial")} />
                </FieldWrapper>
                <FieldWrapper field="rmCekKarakteristik" division={division}>
                  <FSelect label="Cek Karakteristik RM" name="rmCekKarakteristik" value={form.rmCekKarakteristik}
                    onChange={set("rmCekKarakteristik")} options={HASIL_OPTIONS} disabled={!canEdit(division, "rmCekKarakteristik")} />
                </FieldWrapper>
                <FieldWrapper field="rmStatus" division={division}>
                  <FSelect label="Status" name="rmStatus" value={form.rmStatus}
                    onChange={set("rmStatus")} options={STATUS_RM_OPTIONS} disabled={!canEdit(division, "rmStatus")} />
                </FieldWrapper>

                <SecHeader title="Alokasi Produk & Lab Scale" badges={[
                  { text: "TS", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" }
                ]} />
                <div className="col-span-2">
                  <ProductListEditor
                    products={form.products}
                    onChange={prods => setForm(p => ({ ...p, products: prods }))}
                    canEditProd={division === "Admin" || division === "TS"}
                    refreshKey={produkRefreshKey}
                    onSaveProduk={saveNewProdukToDB}
                  />
                </div>

                <SecHeader title="Scale Up / Commercial" badges={[
                  { text: "TS", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" }
                ]} />
                <div className="col-span-2">
                  <FieldWrapper field="scaleUpKodeProduk" division={division}>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Kode Produk</label>
                    <ProductAutocomplete
                      value={form.scaleUpKodeProduk}
                      onChange={v => { set("scaleUpKodeProduk")(v); setPendingScaleUpProduk(null) }}
                      disabled={!canEdit(division, "scaleUpKodeProduk")}
                      refreshKey={produkRefreshKey}
                      onNewProductDetected={kode => setPendingScaleUpProduk(kode)}
                    />
                    {pendingScaleUpProduk && canEdit(division, "scaleUpKodeProduk") && (
                      <div className="mt-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 rounded-lg">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            Kode produk <strong>{pendingScaleUpProduk}</strong> belum ada di database.
                          </p>
                          <button type="button"
                            onClick={async () => { await saveNewProdukToDB(pendingScaleUpProduk!); setPendingScaleUpProduk(null) }}
                            className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap">
                            <SaveIcon /> Simpan Kode Produk
                          </button>
                        </div>
                      </div>
                    )}
                  </FieldWrapper>
                </div>
                <FieldWrapper field="noBatchScaleUp" division={division}>
                  <FInput label="No Batch" name="noBatchScaleUp" value={form.noBatchScaleUp}
                    onChange={set("noBatchScaleUp")} disabled={!canEdit(division, "noBatchScaleUp")} />
                </FieldWrapper>
                <FieldWrapper field="scaleUpStatus" division={division}>
                  <FSelect label="Status" name="scaleUpStatus" value={form.scaleUpStatus}
                    onChange={set("scaleUpStatus")} options={STATUS_RM_OPTIONS} disabled={!canEdit(division, "scaleUpStatus")} />
                </FieldWrapper>
                <FieldWrapper field="tglDilakukanScaleUp" division={division}>
                  <FInput label="Tgl Dilakukan Scale Up" name="tglDilakukanScaleUp" value={form.tglDilakukanScaleUp}
                    onChange={set("tglDilakukanScaleUp")} type="date" disabled={!canEdit(division, "tglDilakukanScaleUp")} />
                </FieldWrapper>
                <FieldWrapper field="scaleUpTglKirimQC" division={division}>
                  <FInput label="Tgl Kirim Sampel ke QC" name="scaleUpTglKirimQC" value={form.scaleUpTglKirimQC}
                    onChange={set("scaleUpTglKirimQC")} type="date" disabled={!canEdit(division, "scaleUpTglKirimQC")} />
                </FieldWrapper>
                <FieldWrapper field="scaleUpTglKeluarHasilAnalisa" division={division}>
                  <FInput label="Tgl Keluar Hasil Analisa" name="scaleUpTglKeluarHasilAnalisa" value={form.scaleUpTglKeluarHasilAnalisa}
                    onChange={set("scaleUpTglKeluarHasilAnalisa")} type="date" disabled={!canEdit(division, "scaleUpTglKeluarHasilAnalisa")} />
                </FieldWrapper>
                <FieldWrapper field="linkFileDiversifikasi" division={division}>
                  <FInput label="Link File Diversifikasi" name="linkFileDiversifikasi" value={form.linkFileDiversifikasi}
                    onChange={set("linkFileDiversifikasi")} disabled={!canEdit(division, "linkFileDiversifikasi")} />
                </FieldWrapper>
                <div className="col-span-2">
                  <FieldWrapper field="kesimpulan" division={division}>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Kesimpulan</label>
                    <textarea name="kesimpulan" value={form.kesimpulan} rows={3}
                      onChange={e => set("kesimpulan")(e.target.value)}
                      disabled={!canEdit(division, "kesimpulan")}
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#2e3192] transition-colors resize-none disabled:opacity-60 disabled:cursor-not-allowed" />
                  </FieldWrapper>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 px-7 py-5 border-t border-gray-100 dark:border-neutral-800">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-500 hover:border-gray-400 bg-transparent transition-colors">
                  Batal
                </button>
                <button type="button" onClick={handleReset}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-500 hover:border-red-400 hover:text-red-500 bg-transparent transition-colors">
                  Reset
                </button>
                <button type="submit"
                  className="px-5 py-2 text-sm font-semibold rounded-lg bg-[#80bc00] hover:bg-[#6da300] text-white transition-colors shadow-sm">
                  {isIsiUlang ? "Simpan Isi Ulang" : isEdit ? "Simpan Perubahan" : "Tambah Data"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}