'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch, API_BASE } from '@/lib/api';
import { useWebSocket } from '@/hooks/useWebsocket';

interface AuditLog {
  id: number;
  action: string;
  menu: string;
  description: string;
  created_at: string;
  user: {
    name: string;
    department: string;
  };
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filter states
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const buildQuery = useCallback(
    (page: number) => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', '20');
      if (filterStartDate) params.set('start_date', filterStartDate);
      if (filterEndDate) params.set('end_date', filterEndDate);
      return params.toString();
    },
    [filterStartDate, filterEndDate]
  );

  const fetchLogs = useCallback(
    async (page: number) => {
      setIsLoading(true);
      try {
        const res = await apiFetch(`${API_BASE}/audit?${buildQuery(page)}`);
        if (res.ok) {
          const json = await res.json();
          setLogs(json.data?.data || []);
          setTotalPages(json.data?.total_pages || 1);
          setCurrentPage(json.data?.page || 1);
        }
      } catch (err) {
        console.error('Gagal memuat audit log', err);
      } finally {
        setIsLoading(false);
      }
    },
    [buildQuery]
  );

  useEffect(() => {
    fetchLogs(currentPage);
  }, [currentPage, fetchLogs]);

  // Re-fetch on filter change (reset to page 1)
  useEffect(() => {
    setCurrentPage(1);
    fetchLogs(1);
  }, [filterStartDate, filterEndDate, fetchLogs]);

  useWebSocket({
    DATA_UPDATED: () => {
      fetchLogs(currentPage);
    },
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const qs = buildQuery(currentPage);
      const res = await apiFetch(`${API_BASE}/audit/export?${qs.replace(/page=\d+&?/, '').replace(/page_size=\d+&?/, '')}`, { method: 'GET' });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `audit_trail_${new Date().toISOString().slice(0, 10)}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } else {
        console.error('Export gagal');
      }
    } catch (err) {
      console.error('Export error', err);
    } finally {
      setIsExporting(false);
    }
  };

  const getActionLabel = (action: string) => {
    return action.replace(/_/g, ' ').toUpperCase();
  };

  const getActionStyle = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('CREATE') || act.includes('SUBMIT') || act.includes('FILL')) {
      return 'text-green-600 bg-green-50 border-green-100';
    }
    if (act.includes('APPROVE')) return 'text-blue-600 bg-blue-50 border-blue-100';
    if (act.includes('UPDATE')) return 'text-amber-600 bg-amber-50 border-amber-100';
    return 'text-gray-600 bg-gray-50 border-gray-100';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Audit Trail System</h1>
          <p className="text-sm font-medium text-gray-500 mt-1">
            Rekaman seluruh aktivitas perubahan data dan transaksi pada sistem Emertrack.
          </p>
        </div>

        <button
          onClick={handleExport}
          disabled={isExporting || isLoading}
          className={`group flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider text-white shadow-md shadow-green-900/10 transition-all ${
            isExporting || isLoading
              ? 'bg-green-700/50 cursor-not-allowed'
              : 'bg-gradient-to-b from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0'
          }`}
        >
          {isExporting ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              Mengekspor...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Export
            </>
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Tanggal Mulai</label>
          <input
            type="date"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-[#003d7a] outline-none"
          />
        </div>
        <div className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Tanggal Akhir</label>
          <input
            type="date"
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-[#003d7a] outline-none"
          />
        </div>
        <button
          onClick={() => {
            setFilterStartDate('');
            setFilterEndDate('');
          }}
          className="ml-auto px-4 py-2 border border-gray-200 rounded-lg text-[11px] font-black uppercase text-gray-500 hover:bg-gray-50 transition-colors"
        >
          Reset
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f8fafd] border-b border-gray-100">
                <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest w-48">Waktu & User</th>
                <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest w-40">Modul / Aksi</th>
                <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Detail Aktivitas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={3} className="p-20 text-center text-gray-400 font-bold italic">Menarik data dari server...</td></tr>
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-5 px-6 align-top">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-gray-400 mb-1">{log.created_at}</span>
                        <span className="text-sm font-black text-gray-900">{log.user.name}</span>
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-tight mt-0.5">{log.user.department}</span>
                      </div>
                    </td>
                    <td className="py-5 px-6 align-top">
                      <div className="space-y-2">
                        <div className="text-[10px] font-black text-[#003d7a] uppercase tracking-wider opacity-70">{log.menu}</div>
                        <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-black uppercase tracking-tighter ${getActionStyle(log.action)}`}>
                          {getActionLabel(log.action)}
                        </span>
                      </div>
                    </td>
                    <td className="py-5 px-6 align-top">
                      <div className="bg-gray-50/50 rounded-lg p-3 border border-gray-100">
                        <p className="text-sm font-medium text-gray-700 leading-relaxed italic">"{log.description}"</p>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={3} className="p-20 text-center text-gray-400 font-bold uppercase">Data audit log kosong</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-5 border-t border-gray-50 bg-white flex justify-between items-center">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
            Halaman {currentPage} dari {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1 || isLoading}
              className={`px-4 py-1.5 border border-gray-200 rounded-md text-[11px] font-black uppercase transition-all ${
                currentPage === 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-50 text-gray-600'
              }`}
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || isLoading}
              className={`px-4 py-1.5 bg-[#003d7a] text-white rounded-md text-[11px] font-black uppercase shadow-md transition-all ${
                currentPage === totalPages ? 'opacity-30 cursor-not-allowed' : 'hover:bg-[#002d5a]'
              }`}
            >
              {isLoading ? '...' : 'Next Page'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}