import { useCallback, useEffect, useRef, useState } from "react"
import { useAutoRefresh } from "../hooks/useAutoRefresh"
import { useWakeLock } from "../hooks/useWakeLock"
import { API_BASE } from "../config"

type TabType = "RM" | "PM"

type VideotronStat = {
  released: number
  total: number
}

type VideotronRow = {
  id: number
  nomor: string
  namaMaterial: string
  manufacture: string
  noBatch: string
  statusProject: string
  hasil: string
  updatedAt: string
}

type VideotronSection = {
  totalDivers: number
  analisa: VideotronStat
  statusLabscale: VideotronStat
  statusTrial: VideotronStat
  rows: VideotronRow[]
}

type VideotronResponse = {
  generatedAt: string
  rm: VideotronSection
  pm: VideotronSection
}

const ROTATE_INTERVAL_MS  = 20_000
const REFRESH_INTERVAL_MS = 60_000

export default function VideotronPage() {
  const { isActive: wakeLockActive, isSupported: wakeLockSupported } = useWakeLock(true)

  const [activeTab, setActiveTab] = useState<TabType>("RM")
  const [jam, setJam] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setJam(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setActiveTab(prev => (prev === "RM" ? "PM" : "RM"))
    }, ROTATE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  const fetcher = useCallback(async (): Promise<VideotronResponse> => {
    const res = await fetch(`${API_BASE}/videotron`)
    if (!res.ok) throw new Error("Gagal fetch videotron")
    return res.json()
  }, [])

  const { data, lastUpdated, error } = useAutoRefresh(fetcher, { intervalMs: REFRESH_INTERVAL_MS })

  return (
    <div className="h-screen w-screen flex flex-col bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white overflow-hidden">
      <Header
        jam={jam}
        wakeLockActive={wakeLockActive}
        wakeLockSupported={wakeLockSupported}
      />
      <StatsSection activeTab={activeTab} data={data} />
      <TableSection activeTab={activeTab} data={data} />
      <Footer lastUpdated={lastUpdated} activeTab={activeTab} error={error} />
    </div>
  )
}

function Header({
  jam, wakeLockActive, wakeLockSupported,
}: {
  jam: Date
  wakeLockActive: boolean
  wakeLockSupported: boolean
}) {
  return (
    <header className="flex-shrink-0 px-10 py-6 border-b border-white/10 flex items-center justify-between">
      <div>
        <h1 className="text-4xl font-black bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent tracking-tight">
          TSMMS MONITORING
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Technical Service Monitoring &amp; Management System
        </p>
      </div>
      <div className="text-right">
        <div className="text-3xl font-black text-cyan-400 tabular-nums leading-none">
          {jam.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
        <div className="text-gray-400 text-sm mt-1">
          {jam.toLocaleDateString("id-ID", {
            weekday: "long", day: "numeric", month: "long", year: "numeric",
          })}
        </div>
        <div className="text-[10px] mt-1">
          {!wakeLockSupported ? (
            <span className="text-amber-400">⚠️ Wake Lock tidak didukung browser</span>
          ) : wakeLockActive ? (
            <span className="text-green-400 flex items-center gap-1 justify-end">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Wake Lock aktif
            </span>
          ) : (
            <span className="text-gray-500">Wake Lock tidak aktif</span>
          )}
        </div>
      </div>
    </header>
  )
}

function StatsSection({ activeTab, data }: { activeTab: TabType; data: VideotronResponse | null }) {
  const rm = data?.rm
  const pm = data?.pm

  return (
    <section className="flex-shrink-0 px-10 py-3">
      <div className="flex items-center gap-4 mb-5">
        <div className={`px-5 py-2 rounded-full font-bold text-sm transition-all duration-500 ${
          activeTab === "RM" ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/30" : "bg-white/10 text-gray-400"
        }`}>
          DIVERSIFIKASI RM
        </div>
        <div className={`px-5 py-2 rounded-full font-bold text-sm transition-all duration-500 ${
          activeTab === "PM" ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/30" : "bg-white/10 text-gray-400"
        }`}>
          DIVERSIFIKASI PM
        </div>
      </div>

      {activeTab === "RM" && (
        <div className="grid grid-cols-4 gap-5">
          <StatCard label="Total Divers RM"  value={rm?.totalDivers ?? 0} color="cyan" />
          <StatCard label="Analisa RM"       value={rm?.analisa?.released ?? 0}      total={rm?.analisa?.total ?? 0}      color="green" />
          <StatCard label="Status Labscale"  value={rm?.statusLabscale?.released ?? 0} total={rm?.statusLabscale?.total ?? 0} color="purple" />
          <StatCard label="Status Scale Up"  value={rm?.statusTrial?.released ?? 0}  total={rm?.statusTrial?.total ?? 0}  color="amber" />
        </div>
      )}

      {activeTab === "PM" && (
        <div className="grid grid-cols-3 gap-5">
          <StatCard label="Total Divers PM"     value={pm?.totalDivers ?? 0} color="cyan" />
          <StatCard label="Analisa PM"          value={pm?.analisa?.released ?? 0}   total={pm?.analisa?.total ?? 0}   color="green" />
          <StatCard label="Status Trial Mesin"  value={pm?.statusTrial?.released ?? 0} total={pm?.statusTrial?.total ?? 0} color="amber" />
        </div>
      )}
    </section>
  )
}

function StatCard({
  label, value, total, color,
}: {
  label: string; value: number; total?: number; color: string
}) {
  const colors: Record<string, { bg: string; text: string; bar: string }> = {
    cyan:   { bg: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/30",     text: "text-cyan-400",   bar: "bg-cyan-400" },
    green:  { bg: "from-green-500/20 to-green-500/5 border-green-500/30",  text: "text-green-400",  bar: "bg-green-400" },
    purple: { bg: "from-purple-500/20 to-purple-500/5 border-purple-500/30", text: "text-purple-400", bar: "bg-purple-400" },
    amber:  { bg: "from-amber-500/20 to-amber-500/5 border-amber-500/30",  text: "text-amber-400",  bar: "bg-amber-400" },
  }
  const c = colors[color]
  const pct = total && total > 0 ? Math.round((value / total) * 100) : 0

  return (
    <div className={`bg-gradient-to-br ${c.bg} border rounded-2xl p-6 py-2 h-full flex flex-col` }>
      <div className="text-gray-300 text-xs font-bold uppercase tracking-widest mb-3">{label}</div>
      <div className="flex items-baseline gap-2">
        <div className={`text-6xl font-black tabular-nums leading-none ${c.text}`}>{value}</div>
        {total !== undefined && (
          <div className="text-3xl font-bold text-gray-500">/ {total}</div>
        )}
      </div>
      {total !== undefined && total > 0 && (
        <>
          <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${c.bar}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-xs text-gray-400 mt-2">{pct}% release</div>
        </>
      )}
    </div>
  )
}

function TableSection({ activeTab, data }: { activeTab: TabType; data: VideotronResponse | null }) {
  const rows = activeTab === "RM"
    ? (data?.rm?.rows ?? [])
    : (data?.pm?.rows ?? [])

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    el.scrollTop = 0
    const id = setInterval(() => {
      if (el.scrollHeight <= el.clientHeight) return
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
        el.scrollTop = 0
      } else {
        el.scrollTop += 1
      }
    }, 60)

    return () => clearInterval(id)
  }, [activeTab, rows.length])

  return (
    <section className="flex-1 px-10 pb-4 overflow-hidden min-h-0">
      <div className="h-full bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-200">
            {activeTab === "RM" ? "Data Diversifikasi RM" : "Data Diversifikasi PM"}
          </h2>
          <span className="text-gray-400 text-sm">{rows.length} baris</span>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-900/95 backdrop-blur z-10">
              <tr className="text-gray-400 uppercase text-[10px] tracking-widest">
                <th className="text-left py-3 px-3">No</th>
                <th className="text-left py-3 px-3">Nama Material</th>
                <th className="text-left py-3 px-3">Manufacture</th>
                <th className="text-left py-3 px-3">No Batch</th>
                <th className="text-center py-3 px-3">Status</th>
                <th className="text-center py-3 px-3">Hasil</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${activeTab}-${r.id}`} className="border-t border-white/5 hover:bg-white/5">
                  <td className="py-3 px-3 font-mono text-cyan-400 font-bold whitespace-nowrap">
                    {r.nomor}
                  </td>
                  <td className="py-3 px-3 text-white">{r.namaMaterial || "—"}</td>
                  <td className="py-3 px-3 text-gray-300">{r.manufacture || "—"}</td>
                  <td className="py-3 px-3 text-gray-300">{r.noBatch || "—"}</td>
                  <td className="py-3 px-3 text-center">
                    <BadgeStatus status={r.statusProject} />
                  </td>
                  <td className="py-3 px-3 text-center">
                    <BadgeHasil hasil={r.hasil} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-500 py-12 text-base">
                    Belum ada data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function BadgeStatus({ status }: { status: string }) {
  const colors: Record<string, string> = {
    "On Progress": "bg-amber-500 text-white",
    "Done":        "bg-green-500 text-white",
    "Drop":        "bg-red-500 text-white",
  }
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${colors[status] ?? "bg-gray-500 text-white"}`}>
      {status || "—"}
    </span>
  )
}

function BadgeHasil({ hasil }: { hasil: string }) {
  const colors: Record<string, string> = {
    "MS":                     "bg-green-500/20 text-green-300 border border-green-500/40",
    "TMS":                    "bg-red-500/20 text-red-300 border border-red-500/40",
    "OP":                     "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40",
    "N/A":                    "bg-gray-500/20 text-gray-300 border border-gray-500/40",
    "Accepted with variance": "bg-orange-500/20 text-orange-300 border border-orange-500/40",
    "Release":                "bg-green-500/20 text-green-300 border border-green-500/40",
    "Reject":                 "bg-red-500/20 text-red-300 border border-red-500/40",
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${colors[hasil] ?? "bg-gray-500/20 text-gray-300"}`}>
      {hasil || "—"}
    </span>
  )
}

function Footer({
  lastUpdated, activeTab, error,
}: {
  lastUpdated: Date | null; activeTab: TabType; error: string | null
}) {
  // const text = `📢 Menampilkan data ${activeTab === "RM" ? "Diversifikasi Raw Material" : "Diversifikasi Packaging Material"} — Update terakhir: ${lastUpdated?.toLocaleTimeString("id-ID") ?? "memuat..."}`

  return (
    <footer className="flex-shrink-0 bg-blue-900/40 border-t border-white/10">
      {/* <div className="h-14 flex items-center overflow-hidden">
        {error ? (
          <div className="px-6 text-red-400 text-sm flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        ) : (
          <div className="flex whitespace-nowrap animate-scroll-text">
            <span className="text-white text-lg font-semibold mx-8">{text}</span>
            <span className="text-white text-lg font-semibold mx-8">{text}</span>
          </div>
        )}
      </div> */}

      <div className="h-8 px-6 bg-blue-950/60 border-t border-white/5 flex items-center justify-center gap-2">
        <span className="text-[11px] text-gray-500 tracking-wide">
          Developed by
        </span>
        <span className="text-[11px] font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
          Dealova Anastasya Nadine Anggraini
        </span>
        <span className="text-[11px] text-gray-600">•</span>
        <span className="text-[11px] text-gray-500">
          © {new Date().getFullYear()} TSMMS
        </span>
      </div>
    </footer>
  )
}