'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { apiFetch, API_BASE } from '@/lib/api';
import { useWebSocket } from '@/hooks/useWebsocket';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface StatusStat {
  status: string;
  count: number;
  total_risk: number;
  percentage: number;
}

interface TypeStat {
  type_name: string;
  count: number;
}

interface DashboardData {
  total_assets: number;
  total_risk_weight: number;
  status_stats: StatusStat[];
  type_stats: TypeStat[];
  department_compliance_stats: DepartmentComplianceStat[];
}

interface DepartmentComplianceStat {
  department_name: string;
  total_sarpras: number;
  on_time_count: number;
  overdue_count: number;
  compliance_percentage: number;
}

interface APIResponse {
  data: DashboardData;
  message: string;
  status: string;
}

interface Department {
  id: number;
  name: string;
}

interface SarprasType {
  id: number;
  name: string;
}

interface SarprasTypesResponse {
  success: boolean;
  data: SarprasType[];
}

interface TableRow {
  id: number;
  nama: string;
  nomor: string;
  departemen: string;
  pemeriksa: string;
  status: string;
  terakhir: string;
  selanjutnya: string;
}

const STATUS_CONFIG: Record<string, {
  label: string; bg: string; text: string;
  dot: string; border: string; chartColor: string; chartHover: string;
}> = {
  ready:          { label: 'Ready',          bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-200', chartColor: '#00a65a', chartHover: '#00c96d' },
  not_ready:      { label: 'Not Ready',      bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-500',     border: 'border-red-200',     chartColor: '#ef4444', chartHover: '#f87171' },
  need_repair:    { label: 'Need Repair',    bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500',   border: 'border-amber-200',   chartColor: '#f59e0b', chartHover: '#fbbf24' },
  will_be_repaired: { label: 'Will Be Repaired', bg: 'bg-sky-100',     text: 'text-sky-700',     dot: 'bg-sky-500',     border: 'border-sky-200',     chartColor: '#0ea5e9', chartHover: '#38bdf8' },
  waiting_verification: { label: 'Waiting Verification', bg: 'bg-gray-100',    text: 'text-gray-600',    dot: 'bg-gray-400',    border: 'border-gray-200',    chartColor: '#9ca3af', chartHover: '#d1d5db' },
};

const STATUS_ORDER = ['ready', 'will_be_repaired', 'need_repair', 'not_ready', 'waiting_verification'];

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['waiting_verification'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 md:px-2.5 md:py-1 rounded-full text-[9px] md:text-[11px] font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function YearPicker({value, onChange, options}: {value: number; onChange: (y: number) => void; options: number[]}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef =useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    if (open && listRef.current) {
      const activeEl = listRef.current.querySelector('[data-active="true"]') as HTMLElement | null;
    }
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-[10px] md:text-[12px] font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg py-1 px-2 md:py-1.5 md:px-3 focus:outline-none focus:ring-1 focus:ring-[#003d7a] min-w-[70px] text-left"
      >
        {value}
      </button>

      {open && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-24 max-h-40 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg"
        >
          {options.map(y => (
            <div
              key={y}
              data-active={y ===value}
              onClick={() => { onChange(y); setOpen(false); }}
              className={`px-3 py-2 text-[12px] md:text-[13px] font-semibold cursor-pointer ${
                  y === value ? 'bg-[#003d7a] text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {y}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const IconChevronLeft = () => (
  <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);
const IconChevronRight = () => (
  <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);
const IconSearch = () => (
  <svg className="w-3 h-3 md:w-3.5 md:h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
  </svg>
);

const PAGE_SIZE = 10;

function buildTableUrl(f: {
  page: number;
  status: string;
  period: string;
  dept_id: number | null;
  type_id: number | null;
  search: string;
  sort_by: string;
  sort_order: string;
}) {
  const p = new URLSearchParams();
  p.set('page', String(f.page));
  p.set('page_size', String(PAGE_SIZE));
  if (f.status)   p.set('status', f.status);
  if (f.period)   p.set('period', f.period);
  if (f.dept_id !== null)   p.set('dept_id', String(f.dept_id));
  if (f.type_id !== null) p.set('type_id', String(f.type_id));
  if (f.search)  p.set('search', f.search);
  if (f.sort_by) {
    p.set('sort_by', f.sort_by);
    p.set('sort_order', f.sort_order);
  }
  return `${API_BASE}/dashboard/table?${p.toString()}`;
}

export default function DashboardPage() {

  const [summaryData,    setSummaryData]    = useState<DashboardData | null>(null);
  const [sarprasTypes,   setSarprasTypes]   = useState<SarprasType[]>([]);
  const [mergedTypeStats,setMergedTypeStats]= useState<TypeStat[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError,   setSummaryError]   = useState('');

  const [activeStatus, setActiveStatus] = useState('');
  const [period,       setPeriod]       = useState('');
  const [filterDept,   setFilterDept]   = useState<number | null>(null);
  const [filterType,   setFilterType]   = useState<number | null>(null);
  const [search,       setSearch]       = useState('');
  const [sortBy, setSortBy] = useState('');  
  const [sortOrder, setSortOrder] = useState('desc');
  const [year, setYear] = useState<number>(new Date().getFullYear());

  const [tableData,    setTableData]    = useState<TableRow[]>([]);
  const [tableLoading, setTableLoading] = useState(true);
  const [page,         setPage]         = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [departments, setDepartments] = useState<Department[]>([]);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const p = new URLSearchParams();
      if (activeStatus) p.set('status', activeStatus);
      if (period) p.set('period', period);
      if (filterDept !== null) p.set('dept_id', String(filterDept));
      if (filterType !== null) p.set('type_id', String(filterType));
      if (search) p.set('search', search);
      p.set('year', String(year));

      const [dashRes, typesRes, deptRes] = await Promise.all([
        apiFetch(`${API_BASE}/dashboard/summary?${p.toString()}`),
        apiFetch(`${API_BASE}/sarpras-types`),
        apiFetch(`${API_BASE}/departments`),
      ]);

      const deptJson = await deptRes.json();
      setDepartments(deptJson.success ? deptJson.data : []);

      const dashJson: APIResponse = await dashRes.json();
      const typesJson: SarprasTypesResponse = await typesRes.json();
      if (dashJson.status !== 'success') throw new Error(dashJson.message || 'Unknown error');

      const apiData = dashJson.data;
   
      apiData.status_stats = apiData.status_stats ?? [];
      apiData.type_stats = apiData.type_stats ?? [];
      apiData.department_compliance_stats = apiData.department_compliance_stats ?? [];

      const masterTypes = typesJson.success ? typesJson.data : [];
      setSarprasTypes(masterTypes);

      const apiTypes = apiData.type_stats ?? [];
      const merged: TypeStat[] = masterTypes.map(t => {
        const found = apiTypes.find(x => x.type_name.toLowerCase() === t.name.toLowerCase());
        return { type_name: t.name, count: found?.count ?? 0 };
      });
      apiTypes.forEach(item => {
        if (!merged.some(m => m.type_name.toLowerCase() === item.type_name.toLowerCase()))
          merged.push(item);
      });

      setSummaryData(apiData);
      setMergedTypeStats(merged);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setSummaryLoading(false);
    }
  }, [activeStatus, period, filterDept, filterType, search, year]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const handleSort = (key?: string) => {
    if (!key) return;
    if (sortBy === key) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
    setPage(1); 
  };

  const fetchTable = useCallback(async () => {
    setTableLoading(true);
    try {
      const url  = buildTableUrl({ page, status: activeStatus, period, dept_id: filterDept, type_id: filterType, search, sort_by: sortBy, sort_order: sortOrder, });
      const res  = await apiFetch(url);
      const json = await res.json();
      if (json.status === 'success') {
        setTableData(json.data ?? []);
        setTotalRecords(json.meta?.total ?? 0);
      }
    } catch (err) {
      console.error('Gagal load tabel', err);
    } finally {
      setTableLoading(false);
    }
  }, [page, activeStatus, period, filterDept, filterType, search, sortBy, sortOrder]);

  useEffect(() => { fetchTable(); }, [fetchTable]);

  useWebSocket({
    'DATA_UPDATED': () => {
      fetchTable();
      fetchSummary();
    },
  });

  const handleStatusToggle = (key: string) => {
    setActiveStatus(prev => prev === key ? '' : key);
    setPage(1);
  };
  const handleSearch = (v: string) => { setSearch(v);     setPage(1); };
  const handleDept   = (id: number | null) => { setFilterDept(id); setPage(1); };
  const handleType   = (id: number | null) => { setFilterType(id); setPage(1); };
  const handlePeriod = (v: string) => { setPeriod(v);     setPage(1); };

  const resetAll = () => {
    setActiveStatus('');
    setPeriod('');
    setFilterDept(null);
    setFilterType(null);
    setSearch('');
    setPage(1);
  };
  const hasFilter = !!(activeStatus || period || filterDept || filterType || search);

  const getStatusCount = (k: string) => {
    const stats = summaryData?.status_stats ?? [];
    return stats.find(s => s.status === k)?.count ?? 0;
  };
  const getStatusPct = (k: string) => {
    const stats = summaryData?.status_stats ?? [];
    return stats.find(s => s.status === k)?.percentage ?? 0;
  };

  const getBarWidth = (count: number) => {
    if (count <= 0) return '4px';
    const counts = mergedTypeStats.map(t => t.count);
    const max = counts.length > 0 ? Math.max(...counts) : 1;
    const validMax = max <= 0 ? 1 : max;
    return `${Math.min(Math.round((count / validMax) * 100), 100)}%`;
  };

  const departmentStats = summaryData?.department_compliance_stats ?? [];

  const totalPages  = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
  const isUnchecked = (name: string) => !name || name.toLowerCase() === 'belum diperiksa';

  const currentYear = new Date().getFullYear();
  const YEAR_OPTIONS = useMemo(() => {
    const startedYear = 2020;
    const endYear = currentYear + 5;
    return Array.from({ length: endYear - startedYear + 1}, (_, i) => endYear - i)
  }, [currentYear]);
    
    const chartBlocks = (summaryData?.status_stats ?? []).reduce<{ key: string; pct: number; left: number }[]>((acc, s) => {
    const key = s.status;
    const pct = s.percentage;
    const left = acc.length ? acc[acc.length - 1].left + acc[acc.length - 1].pct : 0;
    if (pct > 0) {
      return [...acc, { key, pct, left }];
    }
    return acc;
  }, []);

  return (
    <>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm mb-4 md:mb-6">
        <div>
          <h2 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight">Dashboard</h2>
          <p className="text-[11px] md:text-sm font-semibold text-slate-400 mt-0.5">Informasi Lengkap Seluruh data Sarana Prasana Emergency.</p>
        </div>
      </div>

      {summaryError && !summaryLoading && (
        <div className="mb-6 p-3 md:p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs md:text-sm rounded-md">
          <p className="font-bold">Error Sinkronisasi Data</p>
          <p>{summaryError}</p>
        </div>
      )}

      {summaryLoading && !summaryData ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 md:h-10 md:w-10 border-b-2 border-[#003d7a]" />
        </div>
      ) : (
        <div className={`transition-opacity duration-300 ${summaryLoading ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 md:gap-6 mb-6 md:mb-8">

            <div className="bg-white rounded-xl shadow-sm border border-gray-50 p-4 md:p-6 lg:col-span-2">
              <div className="flex items-center mb-4 md:mb-6">
                <svg className="w-4 h-4 md:w-5 md:h-5 mr-2 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 11V9a2 2 0 00-2-2m2 4v4a2 2 0 104 0v-1m-4-3H9m2 0h4m6 1a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-base md:text-[17px] font-bold text-gray-900">Status Overview</h3>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="relative w-32 h-32 md:w-36 md:h-36 flex-shrink-0 rounded-xl overflow-visible shadow-sm mx-auto sm:mx-0">
                  <div className="absolute inset-0 rounded-xl overflow-hidden">
                    <div className="absolute inset-0 bg-[#f4f4f4]" />
                    {chartBlocks.map(b => {
                      if (b.pct <= 0) return null;
                      const cfg = STATUS_CONFIG[b.key];
                      const dimmed = activeStatus !== '' && activeStatus !== b.key;
                      return (
                        <div
                          key={b.key}
                          onClick={() => handleStatusToggle(b.key)}
                          className={`absolute top-0 h-full cursor-pointer transition-opacity duration-300 ${dimmed ? 'opacity-20' : 'opacity-100'}`}
                          style={{ left: `${b.left}%`, width: `${b.pct}%`, backgroundColor: cfg.chartColor }}
                          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = cfg.chartHover; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = cfg.chartColor; }}
                        />
                      );
                    })}
                  </div>
                  <div className="absolute inset-[12%] bg-white rounded-lg flex flex-col items-center justify-center shadow-sm z-20 pointer-events-none">
                    <span className="text-xl md:text-[26px] font-black text-gray-900 leading-none">
                      {summaryData?.total_assets.toLocaleString('id-ID') ?? '0'}
                    </span>
                    <span className="text-[8px] md:text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1 text-center">Total Assets</span>
                  </div>
                </div>

                <div className="flex-1 space-y-1.5 md:space-y-2">
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                    const isActive = activeStatus === key;
                    const dimmed   = activeStatus !== '' && !isActive;
                    return (
                      <div
                        key={key}
                        onClick={() => handleStatusToggle(key)}
                        className={`flex items-center justify-between cursor-pointer rounded-lg px-2 py-1.5 transition-all select-none
                          ${isActive ? 'bg-gray-100 ring-1 ring-gray-300' : 'hover:bg-gray-50'}
                          ${dimmed ? 'opacity-35' : 'opacity-100'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.chartColor }} />
                          <span className={`text-[11px] md:text-[12px] ${isActive ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                            {cfg.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <span className="text-[10px] md:text-[11px] font-bold text-gray-500">{getStatusCount(key)}</span>
                          <span className="text-[10px] md:text-[11px] font-black text-gray-900 w-10 text-right">{getStatusPct(key).toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {activeStatus && (
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[10px] md:text-[11px] text-gray-500">
                    Filter: <span className="font-bold" style={{ color: STATUS_CONFIG[activeStatus]?.chartColor }}>{STATUS_CONFIG[activeStatus]?.label}</span>
                  </span>
                  <button onClick={() => { setActiveStatus(''); setPage(1); }} className="text-[10px] md:text-[11px] font-bold text-[#003d7a] hover:underline">
                    Tampilkan semua
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-50 p-4 md:p-6 lg:col-span-3 flex flex-col h-full">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <div className="flex items-center">
                  <svg className="w-4 h-4 md:w-5 md:h-5 mr-2 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <h3 className="text-base md:text-[17px] font-bold text-gray-900">Total Sarana Prasarana Emergency</h3>
                </div>
                {filterType && (
                  <button onClick={() => handleType(null)} className="text-[10px] md:text-[11px] font-bold text-[#003d7a] hover:underline">Reset</button>
                )}
              </div>

              <div className="space-y-2 md:space-y-3 overflow-y-auto pr-1 md:pr-2 max-h-[200px] md:max-h-[220px]">
                {mergedTypeStats.length > 0 ? mergedTypeStats.map((item, i) => {
                  const itemId = sarprasTypes.find(t => t.name.toLowerCase() === item.type_name.toLowerCase())?.id;
                  const isActive = itemId !== undefined && filterType === itemId;
                  return (
                    <div
                      key={i}
                      onClick={() => handleType(isActive ? null : itemId ?? null)}
                      className={`cursor-pointer rounded-lg p-2 -mx-2 transition-all ${isActive ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'}`}
                    >
                      <div className="flex justify-between text-xs md:text-[13px] font-bold mb-1.5">
                        <span className={item.count === 0 ? 'text-gray-400' : isActive ? 'text-[#003d7a]' : 'text-gray-800'}>{item.type_name}</span>
                        <span className={item.count === 0 ? 'text-gray-400' : 'text-gray-800'}>{item.count === 0 ? '-' : item.count}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 md:h-2">
                        <div
                          className={`h-1.5 md:h-2 rounded-full transition-all duration-700 ${item.count === 0 ? 'bg-gray-200' : isActive ? 'bg-[#003d7a]' : 'bg-[#003d7a]/50'}`}
                          style={{ width: item.count === 0 ? '3px' : getBarWidth(item.count) }}
                        />
                      </div>
                    </div>
                  );
                }) : (
                  <p className="text-xs md:text-sm text-gray-500 text-center py-4">Tidak ada data.</p>
                )}
              </div>
            </div>
          </div>
 
          <div className="bg-white rounded-xl shadow-sm border border-gray-50 p-4 md:p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {/* <svg className="w-4 h-4 md:w-5 md:h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg> */}
                <div>
                  <h3 className="text-base md:text-[17px] font-bold text-gray-900">Kepatuhan Jadwal Inspeksi per Departemen ({year})</h3>
                  <p className="text-[10px] md:text-[11px] text-gray-500 mt-0.5">Menghitung tiap jadwal pemeriksaan sepanjang tahun ini — termasuk yang pernah telat, walau sarpras-nya sekarang sudah kembali ready.</p>
                </div>
              </div>
             <YearPicker value={year} onChange={setYear} options={YEAR_OPTIONS}/>
            </div>

            {departmentStats.length > 0 ? (
              <div className="w-full" style={{ height: Math.max(240, departmentStats.length * 42) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={[...departmentStats].sort((a, b) => a.compliance_percentage - b.compliance_percentage)}
                    margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
                    barCategoryGap={12}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 600 }}
                      axisLine={{ stroke: '#e5e7eb' }}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="department_name"
                      width={140}
                      tick={{ fontSize: 11, fill: '#374151', fontWeight: 700 }}
                      axisLine={{ stroke: '#e5e7eb' }}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{
                        borderRadius: 10,
                        border: '1px solid #e5e7eb',
                        fontSize: 12,
                        fontWeight: 600,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                      }}
                      formatter={(value, _name, props) => {
                        const p = props.payload as DepartmentComplianceStat;
                        return [
                          `${Number(value ?? 0).toLocaleString('id-ID')}% tepat waktu (${p.on_time_count}/${p.total_sarpras} jadwal, ${p.overdue_count} pernah telat)`,
                          '',
                        ];
                      }}
                      labelStyle={{ color: '#111827', fontWeight: 800, marginBottom: 4 }}
                    />
                    <Bar dataKey="compliance_percentage" radius={[0, 6, 6, 0]} maxBarSize={22} animationDuration={600}>
                      {[...departmentStats]
                        .sort((a, b) => a.compliance_percentage - b.compliance_percentage)
                        .map((entry, i) => {
                          const color =
                            entry.compliance_percentage < 50
                              ? '#ef4444'
                              : entry.compliance_percentage < 80
                              ? '#f59e0b'
                              : '#00a65a';
                          return <Cell key={i} fill={color} />;
                        })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-gray-500">Tidak ada data kepatuhan inspeksi departemen untuk tahun {year}.</div>
            )}
          </div>
 
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-100 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[#003d7a] flex items-center justify-center text-white flex-shrink-0">
                    <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 6h18M3 14h18M3 18h18" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm md:text-[15px] font-bold text-gray-900 leading-tight">Tabel Kondisi Sarpras</h3>
                    <p className="text-[10px] md:text-[11px] text-gray-400 font-medium mt-0.5">
                      {tableLoading ? 'Memperbarui...' : `${totalRecords} asset ditemukan`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 md:px-3 md:py-2 w-full sm:w-64 md:w-72">
                  <IconSearch />
                  <input
                    type="text"
                    placeholder="Cari nama, nomor, departemen..."
                    value={search}
                    onChange={e => handleSearch(e.target.value)}
                    className="bg-transparent text-xs md:text-[13px] text-gray-700 placeholder-gray-400 outline-none flex-1"
                  />
                  {search && <button onClick={() => handleSearch('')} className="text-gray-400 hover:text-gray-600 font-bold text-xs md:text-sm">✕</button>}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-1.5 flex-1">
                  <button
                    onClick={() => { setActiveStatus(''); setPage(1); }}
                    className={`px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-[11px] font-bold border transition-all ${activeStatus === '' ? 'bg-[#003d7a] text-white border-[#003d7a]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
                  >
                    Semua Status
                  </button>
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => handleStatusToggle(key)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-[11px] font-bold border transition-all ${activeStatus === key ? `${cfg.bg} ${cfg.text} ${cfg.border}` : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
                    >
                      {activeStatus === key && <span className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-full ${cfg.dot}`} />}
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filterType ?? ''}
                  onChange={e => handleType(e.target.value ? Number(e.target.value) : null)}
                  className="text-[10px] md:text-[12px] font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg py-1 px-2 md:py-1.5 md:px-3 focus:outline-none focus:ring-1 focus:ring-[#003d7a]"
                >
                  <option value="">Semua Jenis Sarpras</option>
                  {sarprasTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>

                <select
                  value={filterDept ?? ''}
                  onChange={e => handleDept(e.target.value ? Number(e.target.value) : null)}
                  className="text-[10px] md:text-[12px] font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg py-1 px-2 md:py-1.5 md:px-3 focus:outline-none focus:ring-1 focus:ring-[#003d7a]"
                >
                  <option value="">Semua Departemen</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>

                <div className="relative w-full sm:w-64">
                <input
                  type="month"
                  value={period}
                  onChange={e => handlePeriod(e.target.value)}
                  className={`w-full sm:w-64 text-[10px] md:text-[12px] font-semibold bg-white border border-gray-200 rounded-lg py-1.5 px-3 focus:outline-none focus:ring-1 focus:ring-[#003d7a]
                  ${!period ? 'text-transparent' : 'text-gray-700'}`}
                />

                {!period && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] md:text-[12px] font-semibold text-gray-700 pointer-events-none">
                    Bulan Pemeriksaan Selanjutnya
                  </span>
                )}
              </div>

                {hasFilter && (
                  <button onClick={resetAll} className="text-[10px] md:text-[11px] font-bold text-red-500 hover:text-red-700 px-1 md:px-2 py-1 rounded-lg hover:bg-red-50 transition-all whitespace-nowrap">
                    ✕ Reset Filter
                  </button>
                )}
              </div>

              {hasFilter && (
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Aktif:</span>
                  {activeStatus && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-bold border ${STATUS_CONFIG[activeStatus]?.bg} ${STATUS_CONFIG[activeStatus]?.text} ${STATUS_CONFIG[activeStatus]?.border}`}>
                      {STATUS_CONFIG[activeStatus]?.label}
                      <button onClick={() => { setActiveStatus(''); setPage(1); }}>✕</button>
                    </span>
                  )}
                  {filterType != null && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                       {sarprasTypes.find(t => t.id === filterType)?.name ?? filterType}<button onClick={() => handleType(null)}>✕</button>
                    </span>
                  )}
                  {filterDept != null && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                       {departments.find(d => d.id === filterDept)?.name ?? filterDept}<button onClick={() => handleDept(null)}>✕</button>
                    </span>
                  )}
                  {period && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                      {period}<button onClick={() => handlePeriod('')}>✕</button>
                    </span>
                  )}
                  {search && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                      "{search}"<button onClick={() => handleSearch('')}>✕</button>
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[700px] md:min-w-full w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    {[
                      { label: 'No', align: 'center', w: 'w-12' },
                      { label: 'Nama Sarpras', align: 'left', w: 'w-32', key: 'name' },
                      { label: 'Nomor Sarpras', align: 'left', w: 'w-44', key: 'code' },
                      { label: 'Departemen', align: 'left', w: 'w-48', key: 'department' },
                      { label: 'Pemeriksa', align: 'left', w: 'w-40', key: 'checker' },
                      { label: 'Terakhir Diperiksa', align: 'center', w: 'w-32', key: 'last_inspected_at' },
                      { label: 'Kondisi', align: 'center', w: 'w-36', key: 'status' },
                      { label: 'Pemeriksaan Selanjutnya', align: 'center', w: 'w-36', key: 'next_check' },
                    ].map(col => (
                      <th
                        key={col.label}
                        onClick={() => handleSort(col.key)}
                        className={`py-2 px-2 md:py-3 md:px-4 text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest ${col.w} ${col.align === 'center' ? 'text-center' : ''} ${col.key ? 'cursor-pointer hover:text-gray-600 select-none' : ''}`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {col.key && sortBy === col.key && (
                            <span className="text-[8px]">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className={`divide-y divide-gray-50 transition-opacity duration-150 ${tableLoading ? 'opacity-60' : 'opacity-100'}`}>
                  {tableData.length === 0 && !tableLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 md:py-20 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gray-100 flex items-center justify-center text-xl md:text-2xl text-gray-300">∅</div>
                          <span className="text-[11px] md:text-[13px] font-bold text-gray-400 uppercase tracking-widest">Tidak Ada Data</span>
                          {hasFilter && <button onClick={resetAll} className="mt-2 text-[11px] md:text-[12px] font-bold text-[#003d7a] hover:underline">Reset semua filter</button>}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    tableData.map((row, index) => {
                      const rowNum    = (page - 1) * PAGE_SIZE + index + 1;
                      const unchecked = isUnchecked(row.pemeriksa);
                      return (
                        <tr key={row.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="py-2 px-2 md:py-3.5 md:px-4 text-center">
                            <span className="text-[10px] md:text-[12px] font-bold text-gray-400">{rowNum}</span>
                          </td>
                          <td className="py-2 px-2 md:py-3.5 md:px-4">
                            <span className="text-[11px] md:text-[13px] font-bold text-gray-800 uppercase tracking-wide">{row.nama}</span>
                          </td>
                          <td className="py-2 px-2 md:py-3.5 md:px-4 text-center">
                            <div className="flex justify-center">
                              <span className="text-[10px] md:text-[12px] font-bold text-[#003d7a] font-mono bg-blue-50 px-1.5 py-0.5 md:px-2 rounded">
                                {row.nomor}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-2 md:py-3.5 md:px-4">
                            <span className="text-[10px] md:text-[12px] font-medium text-gray-600">{row.departemen}</span>
                          </td>
                          <td className="py-2 px-2 md:py-3.5 md:px-4">
                            {unchecked ? (
                              <span className="text-[9px] md:text-[11px] font-semibold text-gray-400 italic">Belum diperiksa</span>
                            ) : (
                              <div className="flex items-center gap-1 md:gap-2">
                                <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-[#003d7a] text-white flex items-center justify-center text-[8px] md:text-[9px] font-black flex-shrink-0">
                                  {row.pemeriksa.charAt(0)}
                                </div>
                                <span className="text-[10px] md:text-[12px] font-bold text-gray-800 uppercase">{row.pemeriksa}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2 md:py-3.5 md:px-4 text-center">
                            {row.terakhir && row.terakhir !== '-' ?
                              <span className="text-[10px] md:text-[12px] font-medium text-gray-400">{row.terakhir}</span>
                              : <span className="text-[10px] md:text-[12px] font-medium text-gray-400">-</span>
                            }
                          </td>
                          <td className="py-2 px-2 md:py-3.5 md:px-4 text-center">
                            <StatusBadge status={row.status} />
                          </td>
                          <td className="py-2 px-2 md:py-3.5 md:px-4 text-center">
                            {row.selanjutnya && row.selanjutnya !== '-'
                              ? <span className="text-[10px] md:text-[12px] font-bold text-gray-700">{row.selanjutnya}</span>
                              : <span className="text-[10px] md:text-[12px] font-medium text-gray-400">-</span>
                            }
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-3 py-2 md:px-6 md:py-3.5 border-t border-gray-100 bg-gray-50/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className="text-[10px] md:text-[12px] font-semibold text-gray-500 text-center sm:text-left">
                {totalRecords === 0 ? 'Tidak ada data' : (
                  <>
                    Menampilkan{' '}
                    <span className="font-bold text-gray-700">{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, totalRecords)}</span>
                    {' '}dari{' '}
                    <span className="font-bold text-gray-700">{totalRecords}</span> data
                  </>
                )}
              </span>

              <div className="flex items-center justify-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                  className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                  <IconChevronLeft />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i+1)
                  .filter(p => p===1 || p===totalPages || Math.abs(p-page)<=1)
                  .reduce<(number|string)[]>((acc, p, i, arr) => {
                    if (i > 0 && (p as number)-(arr[i-1] as number) > 1) acc.push('…');
                    acc.push(p); return acc;
                  }, [])
                  .map((p, i) => typeof p === 'string'
                    ? <span key={`e${i}`} className="w-5 h-5 md:w-8 md:h-8 flex items-center justify-center text-gray-400 text-xs md:text-sm">…</span>
                    : <button key={p} onClick={() => setPage(p)}
                        className={`w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-lg text-[10px] md:text-[13px] font-bold transition-all ${page===p ? 'bg-[#003d7a] text-white shadow-sm' : 'border border-gray-200 text-gray-600 hover:bg-white'}`}>
                        {p}
                      </button>
                  )}
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
                  className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                  <IconChevronRight />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
