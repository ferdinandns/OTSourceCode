'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, API_BASE } from '@/lib/api';
import { useWebSocket } from '@/hooks/useWebsocket';

interface AparRow {
  sarpras_id: number;
  sarpras_type: string;
  sarpras_no: string;
  expired_date: string;
  ed_status: 'active' | 'expired';
  progress_refill: string;
  due_date_refill: string | null;
  po_number: string | null;
  item_id: number | null;
  item_status: string | null;
}

export default function MonitoringEDPage() {
  const router = useRouter();
  const [items, setItems] = useState<AparRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGA, setIsGA] = useState(false);
  const [isQS, setIsQS] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalActive, setTotalActive] = useState(0);
  const [totalExpired, setTotalExpired] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  const totalAll = totalActive + totalExpired;
  const [modal, setModal] = useState<{ isOpen: boolean; message: string; title?: string }>({ isOpen: false, message: '' });

  const currentPage = Math.floor(offset / limit) + 1;

  // Determine role and department from sessionStorage
  useEffect(() => {
    const roles: string[] = JSON.parse(sessionStorage.getItem('roles') || '[]');
    const dept = sessionStorage.getItem('department') || '';
    setIsGA(dept.toLowerCase().includes('general affair'));
    setIsQS(roles.includes('qs'));
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('ed_status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);
    
      params.append('offset', offset.toString());
      params.append('limit', limit.toString());

      const res = await apiFetch(`${API_BASE}/refill?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setItems(json.data.data || []);
        setTotalRecords(json.data.total || 0);
        setTotalActive(json.data.total_active || 0);
        setTotalExpired(json.data.total_expired || 0);
        setTotalPages(Math.ceil((json.data.total || 0) / limit));
      }
    } catch (err) {
      console.error('Gagal memuat data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, searchQuery, offset, limit]);

  

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useWebSocket({
    'DATA_UPDATED': () => {
      fetchData();
    },
  });

  useEffect(() => {
    setOffset(0);
    setSelectedIds([]);
  }, [statusFilter, searchQuery, limit]);

  const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLimit(Number(e.target.value));
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setSearchQuery(searchInput);
    }
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setSearchQuery('');
    setStatusFilter('');
  };

  const isSelectable = (item: AparRow) => {
    if (isGA) {
      // GA can only select items that have not started the refill process
      return item.progress_refill === '-' || item.progress_refill === 'Opened';
    }
    if (isQS) {
      const isExpired = item.ed_status === 'expired';
      const hasAdvancedProgress = item.progress_refill !== '-' && item.progress_refill !== 'Opened';
      return !isExpired && !hasAdvancedProgress;
    }
    return false;
  };

  const handleSelect = (id: number, checked: boolean) => {
    if (checked) setSelectedIds(prev => [...prev, id]);
    else setSelectedIds(prev => prev.filter(i => i !== id));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const selectableOnPage = items.filter(isSelectable).map(i => i.sarpras_id);
      setSelectedIds(prev => [...new Set([...prev, ...selectableOnPage])]);
    } else {
      const currentPageIds = items.map(i => i.sarpras_id);
      setSelectedIds(prev => prev.filter(id => !currentPageIds.includes(id)));
    }
  };

  const allSelectableOnPage = items.filter(isSelectable);
  const isAllChecked = allSelectableOnPage.length > 0 && allSelectableOnPage.every(item => selectedIds.includes(item.sarpras_id));

  const goToSubmitPO = async () => {
    if (selectedIds.length === 0) {
      setModal({ isOpen: true, message: 'Pilih minimal satu APAR yang expired atau belum dalam proses refill.', title: 'Informasi' });
      return;
    }
    setIsLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/refill/validate`, {
        method: 'POST',
        body: JSON.stringify({ sarpras_ids: selectedIds }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Validasi gagal');
      const validIds: number[] = Array.isArray(json.data?.valid_ids) ? json.data.valid_ids : [];
      if (validIds.length === 0) {
        setModal({ isOpen: true, message: 'APAR / APAB belum dapat diisi ulang.', title: 'Informasi' });
        setSelectedIds([]);
        return;
      }
      if (validIds.length !== selectedIds.length) {
        const invalidCount = selectedIds.length - validIds.length;
        setModal({ isOpen: true, message: `${invalidCount} APAR tidak memenuhi syarat dan dihapus dari pilihan.`, title: 'Informasi' });
        setSelectedIds(validIds);
        return;
      }
      sessionStorage.setItem('refill_selected_ids', JSON.stringify(selectedIds));
      router.push('/dashboard/refill/submit-po');
    } catch (err) {
      console.error('Validasi gagal:', err);
      setModal({ isOpen: true, message: 'Gagal memvalidasi data. Silakan coba lagi.', title: 'Error' });
    } finally {
      setIsLoading(false);
    }
  };

  const goToMarkAsUsed = () => {
    if (selectedIds.length === 0) {
      setModal({ isOpen: true, message: 'Pilih minimal satu APAR/APAB yang habis digunakan.', title: 'Informasi' });
      return;
    }
    sessionStorage.setItem('refill_selected_ids', JSON.stringify(selectedIds));
    router.push('/dashboard/refill/mark-as-used');
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
  };

  const isRelevantForSubmitPO = (item: AparRow) => {
    try {
      const now = new Date();
      const exp = item.expired_date ? new Date(item.expired_date) : null;
      if (item.ed_status === 'expired' || (exp && exp < now)) return true;
      if (exp) {
        const daysDiff = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff <= 60 && daysDiff >= 0) return true;
      }
      const pr = (item.progress_refill || '').toLowerCase();
      const st = (item.item_status || '').toLowerCase();
      if (pr.includes('used') || pr.includes('mark') || st.includes('used')) return true;
      return false;
    } catch { return false; }
  };
  const anySelectedRelevant = selectedIds.length > 0 && items.some(i => selectedIds.includes(i.sarpras_id) && isRelevantForSubmitPO(i));
  const anyOnPageRelevant = items.some(i => isRelevantForSubmitPO(i));

  // GA can upload refill evidence when status is 'On Progress' or 'Rejected'
  const renderActionButton = (item: AparRow) => {
    if (isGA && !isQS) {
      const canUpload = item.progress_refill === 'On Progress' || item.progress_refill === 'Rejected';
      return (
        <button
          disabled={!canUpload}
          onClick={() => router.push(`/dashboard/refill/submit-evidence/${item.sarpras_id}`)}
          className={`px-4 py-2 text-[11px] font-bold rounded-lg shadow-sm transition-colors ${
            canUpload ? 'bg-[#00875a] text-white hover:bg-[#006b47]' : 'bg-slate-400 text-white cursor-not-allowed'
          }`}
        >
          Upload Refill Proof
        </button>
      );
    }
    if (isQS && !isGA) {
      const canVerify = item.progress_refill === 'Waiting Review';
      return (
        <button
          disabled={!canVerify}
          onClick={() => router.push(`/dashboard/refill/verify/${item.sarpras_id}`)}
          className={`px-4 py-2 text-[11px] font-bold rounded-lg shadow-sm transition-colors ${
            canVerify ? 'bg-[#003d7a] text-white hover:bg-[#002d5a]' : 'bg-slate-400 text-white cursor-not-allowed'
          }`}
        >
          Verify
        </button>
      );
    }
    return (
      <div className="flex gap-2 justify-center">
        <button
          disabled={item.progress_refill !== 'Waiting Review'}
          onClick={() => router.push(`/dashboard/refill/verify/${item.sarpras_id}`)}
          className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-colors ${
            item.progress_refill === 'Waiting Review' ? 'bg-[#003d7a] text-white hover:bg-[#002d5a]' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Verify
        </button>
      </div>
    );
  };

  const goToPrevPage = () => setOffset(prev => Math.max(0, prev - limit));
  const goToNextPage = () => {
    const newOffset = offset + limit;
    if (newOffset < totalRecords) setOffset(newOffset);
  };
  const goToPage = (pageNum: number) => setOffset((pageNum - 1) * limit);
  const getVisiblePages = () => {
    const delta = 2;
    const start = Math.max(1, currentPage - delta);
    const end = Math.min(totalPages, currentPage + delta);
    const range = [];
    for (let i = start; i <= end; i++) range.push(i);
    return range;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-8">
      <div className="max-w-7xl mx-auto w-full animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm mb-5 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
              Monitoring ED APAR
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Overview of emergency facility readiness and maintenance status.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-4 mb-6 md:mb-8">
          <div className="bg-white p-3 md:p-6 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden flex flex-col justify-between h-[90px] md:h-[130px]">
            <div className="absolute left-0 top-0 bottom-0 w-[3px] md:w-[4px]" style={{ backgroundColor: '#00875a' }} />
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[8px] md:text-[9px] font-black text-gray-400 tracking-widest uppercase">Active</p>
                <h3 className="text-lg md:text-2xl font-black text-gray-900 mt-1">{totalActive}</h3>
              </div>
              <div className="w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-white text-[8px] md:text-[10px] font-black" style={{ backgroundColor: '#00875a' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-.997-6l7.07-7.071-1.414-1.414-5.656 5.657-2.829-2.829-1.414 1.414L11.003 16z"/></svg>
              </div>
            </div>
            <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
              <div className="h-full transition-all duration-700" style={{ backgroundColor: '#00875a', width: `${totalAll > 0 ? (totalActive / totalAll) * 100 : 0}%` }} />
            </div>
          </div>

          <div className="bg-white p-3 md:p-6 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden flex flex-col justify-between h-[90px] md:h-[130px]">
            <div className="absolute left-0 top-0 bottom-0 w-[3px] md:w-[4px]" style={{ backgroundColor: '#e11d48' }} />
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[8px] md:text-[9px] font-black text-gray-400 tracking-widest uppercase">Expired</p>
                <h3 className="text-lg md:text-2xl font-black text-gray-900 mt-1">{totalExpired}</h3>
              </div>
              <div className="w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-white text-[8px] md:text-[10px] font-black" style={{ backgroundColor: '#e11d48' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm0-8v6h2V7h-2z"/></svg>
              </div>
            </div>
            <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
              <div className="h-full transition-all duration-700" style={{ backgroundColor: '#e11d48', width: `${totalAll > 0 ? (totalExpired / totalAll) * 100 : 0}%` }} />
            </div>
          </div>
        </div>

        <div className="flex justify-end mb-4 gap-3">
          {isGA && !isQS && (
            <button
              onClick={goToSubmitPO}
              disabled={selectedIds.length === 0}
              className={`px-5 py-2.5 text-sm font-bold rounded-lg shadow-sm transition-colors ${
                selectedIds.length > 0 ? 'bg-[#003d7a] text-white hover:bg-[#002e5c]' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Submit PO Number ({selectedIds.length})
            </button>
          )}
          {isQS && (
            <button
              onClick={goToMarkAsUsed}
              disabled={selectedIds.length === 0}
              className={`px-5 py-2.5 text-sm font-bold rounded-lg shadow-sm transition-colors ${
                selectedIds.length > 0 ? 'bg-[#dc2626] text-white hover:bg-[#b91c1c]' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Mark as Used ({selectedIds.length})
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-3 md:p-5 border-b border-gray-50 bg-[#f8fafd] flex flex-wrap items-center gap-3 md:gap-4">
            {isGA && (
              <div className="relative group">
                <div className={`w-6 h-6 md:w-7 md:h-7 rounded-lg border flex items-center justify-center text-xs font-bold ${
                  (anySelectedRelevant || anyOnPageRelevant) ? 'bg-[#003d7a] text-white border-[#003d7a]' : 'bg-white text-gray-400 border-gray-200'
                }`}>
                  ?
                </div>
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-72 bg-white border border-gray-200 rounded-lg p-3 shadow-lg z-50">
                  <p className="text-xs font-black text-gray-800 uppercase tracking-wide mb-1">Penjelasan Submit PO</p>
                  <p className="text-[11px] text-gray-600">Gunakan tombol "Submit PO Number" untuk mencatat nomor Purchase Order pengisian ulang APAR/APAB. Tombol ini relevan ketika unit sudah mendekati masa kedaluwarsa (H-2 bulan), sudah kedaluwarsa, atau telah ditandai sebagai "used" oleh tim QS. Pilih minimal satu item yang memenuhi syarat sebelum melanjutkan.</p>
                </div>
              </div>
            )}
            <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Filter By:</span>
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input
                type="text"
                placeholder="Cari kode sarpras... (tekan Enter)"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="pl-8 pr-3 py-1.5 md:py-2 border border-gray-200 rounded-md text-[10px] md:text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-[#003d7a] w-56 md:w-64"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-gray-200 rounded-md px-2 py-1 md:px-4 md:py-1.5 text-[10px] md:text-xs font-bold text-gray-700 outline-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
            </select>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Show:</span>
              <select value={limit} onChange={handleLimitChange} className="bg-white border border-gray-200 rounded-md px-2 py-1 md:px-4 md:py-1.5 text-[10px] md:text-xs font-bold text-gray-700 outline-none">
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>
            {(searchQuery || statusFilter) && (
              <button onClick={handleResetFilters} className="text-[10px] md:text-[11px] font-bold text-[#003d7a] hover:underline uppercase tracking-wider flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
                Reset Filters
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full w-full text-left">
              <thead>
                <tr className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                  <th className="py-3 md:py-5 px-3 md:px-6 text-center w-12">
                    {(isGA || isQS) && (
                      <input
                        type="checkbox"
                        checked={isAllChecked}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 text-[#003d7a] border-gray-300 rounded focus:ring-[#003d7a]"
                      />
                    )}
                  </th>
                  <th className="py-3 md:py-5 px-3 md:px-4 w-14">No</th>
                  <th className="py-3 md:py-5 px-3 md:px-4">Jenis Sarpras</th>
                  <th className="py-3 md:py-5 px-3 md:px-4">Nomor Sarpras</th>
                  <th className="py-3 md:py-5 px-3 md:px-4 text-center">Status ED</th>
                  <th className="py-3 md:py-5 px-3 md:px-4 text-center">Tanggal ED</th>
                  <th className="py-3 md:py-5 px-3 md:px-4 text-center">Progress Refill</th>
                  <th className="py-3 md:py-5 px-3 md:px-4 text-center">Due Date Refill</th>
                  <th className="py-3 md:py-5 px-3 md:px-4 text-center">Action Plan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  <tr><td colSpan={9} className="py-10 text-center text-xs md:text-sm font-bold text-gray-400 animate-pulse">Memuat data sarpras...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={9} className="py-10 text-center text-xs md:text-sm font-bold text-gray-400">Tidak ada data.</td></tr>
                ) : (
                  items.map((item, index) => (
                    <tr key={item.sarpras_id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 md:py-5 px-3 md:px-6 text-center">
                        {(isGA || isQS) && (
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(item.sarpras_id)}
                            onChange={(e) => handleSelect(item.sarpras_id, e.target.checked)}
                            disabled={!isSelectable(item)}
                            className="w-4 h-4 text-[#003d7a] border-gray-300 rounded focus:ring-[#003d7a] disabled:opacity-50"
                          />
                        )}
                       </td>
                      <td className="py-3 md:py-5 px-3 md:px-4 text-xs md:text-sm font-bold text-gray-900">{offset + index + 1}</td>
                      <td className="py-3 md:py-5 px-3 md:px-4 text-xs md:text-sm font-bold text-gray-900">{item.sarpras_type}</td>
                      <td className="py-3 md:py-5 px-3 md:px-4 text-xs md:text-sm font-bold text-[#003d7a]">{item.sarpras_no}</td>
                      <td className="py-3 md:py-5 px-3 md:px-4 text-center">
                        <span className={`px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-wider ${item.ed_status === 'expired' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>{item.ed_status}</span>
                      </td>
                      <td className="py-3 md:py-5 px-3 md:px-4 text-xs md:text-sm font-bold text-gray-700 text-center">{formatDate(item.expired_date)}</td>
                      <td className="py-3 md:py-5 px-3 md:px-4 text-xs md:text-sm font-bold text-gray-700 text-center">{item.progress_refill}</td>
                      <td className="py-3 md:py-5 px-3 md:px-4 text-xs md:text-sm font-bold text-gray-700 text-center">{formatDate(item.due_date_refill)}</td>
                      <td className="py-3 md:py-5 px-3 md:px-4 text-center">{renderActionButton(item)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!isLoading && totalRecords > 0 && (
            <div className="p-4 md:p-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs border-t border-gray-50 bg-white">
              <p className="font-bold text-gray-400">Showing {offset + 1} to {Math.min(offset + limit, totalRecords)} of {totalRecords} records</p>
              <div className="flex gap-1">
                <button onClick={goToPrevPage} disabled={offset === 0} className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-20">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                {getVisiblePages().map(p => (
                  <button key={p} onClick={() => goToPage(p)} className={`w-8 h-8 flex items-center justify-center rounded font-black text-[10px] transition-colors ${p === currentPage ? 'bg-[#003d7a] text-white' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>{p}</button>
                ))}
                <button onClick={goToNextPage} disabled={offset + limit >= totalRecords} className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-20">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {modal.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-[#eef4fa] flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#003d7a]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">{modal.title || 'Informasi'}</h3>
            <p className="text-sm text-gray-500 mb-6">{modal.message}</p>
            <button onClick={() => setModal({ isOpen: false, message: '' })} className="w-full px-4 py-2 bg-[#003d7a] text-white rounded-lg font-bold hover:bg-[#002d5a] transition-colors">OK</button>
          </div>
        </div>
      )}
    </div>
  );
}
