'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, API_BASE } from '@/lib/api';
import Link from 'next/link';
import { useWebSocket } from '@/hooks/useWebsocket';
import RiskBadge from '@/components/RiskBadge';

interface SarprasItem {
  ID: number;
  Code: string;
  SarprasTypeName: string;
  LocationDeptName: string;
  SiteName: string;
  PICDeptName: string;
  LocationDetail: string;
  Status: string;
  RiskLevel: string;
}

type SortableColumn = 'code' | 'sarpras_type_name' | 'location_dept_name' | 'site_name' | 'risk_level' | 'status';

export default function ListSarprasPage() {
  const [items, setItems] = useState<SarprasItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SarprasItem | null>(null);
  const [deleteNotes, setDeleteNotes] = useState('');

  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [sarprasTypes, setSarprasTypes] = useState<{ id: number; name: string }[]>([]);
  
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [userRoles, setUserRoles] = useState<string[]>([]);

  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(totalRecords / limit);

  const [sortBy, setSortBy] = useState<SortableColumn>('code');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');

  const fetchRef = useRef<() => Promise<void>>(undefined);

  const handleSort = (column: SortableColumn) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(column);
      setSortOrder('ASC');
    }
    setOffset(0);
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (selectedDeptId) params.append('location_dept_id', selectedDeptId);
      if (selectedTypeId) params.append('sarpras_type_id', selectedTypeId);

      const deptName = departments.find(d => d.id.toString() === selectedDeptId)?.name || 'All';
      const typeName = sarprasTypes.find(t => t.id.toString() === selectedTypeId)?.name || 'All';
      params.append('department_name', deptName);
      params.append('sarpras_type_name', typeName);
      params.append('sort_by', sortBy);
      params.append('sort_order', sortOrder);

      const url = `${API_BASE}/sarpras/export?${params.toString()}`;
      const response = await apiFetch(url);
      if (!response.ok) throw new Error('Failed to export PDF');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;

      const now = new Date();
      const formattedDate = now.toISOString().split('T')[0].replace(/-/g, '');
      link.setAttribute('download', `List_Sarpras_${formattedDate}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const fetchListSarpras = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedDeptId) params.append('location_dept_id', selectedDeptId);
      if (selectedTypeId) params.append('sarpras_type_id', selectedTypeId);
      params.append('offset', offset.toString());
      params.append('limit', limit.toString());
      params.append('sort_by', sortBy);
      params.append('sort_order', sortOrder);

      const url = `${API_BASE}/sarpras?${params.toString()}`;
      const response = await apiFetch(url);
      const json = await response.json();
      if (json.success) {
        setItems(json.data.items || []);
        setTotalRecords(json.data.meta.total || 0);
      }
    } catch (err) {
      if (err !== 'Unauthorized') {
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedDeptId, selectedTypeId, offset, limit, sortBy, sortOrder]);

  useEffect(() => {
    fetchRef.current = fetchListSarpras;
  }, [fetchListSarpras]);

  useWebSocket({
    DATA_UPDATED: () => {
      if (fetchRef.current) fetchRef.current();
    },
  });

  useEffect(() => {
    const storedRolesStr = localStorage.getItem('roles') || sessionStorage.getItem('roles');
    if (storedRolesStr) {
      try { setUserRoles(JSON.parse(storedRolesStr)); } catch (e) {}
    }

    const fetchMasterData = async () => {
      try {
        const deptRes = await apiFetch(`${API_BASE}/departments`);
        if (deptRes.ok) {
          const deptJson = await deptRes.json();
          if (deptJson.success) setDepartments(deptJson.data);
        }

        const typeRes = await apiFetch(`${API_BASE}/sarpras-types`);
        if (typeRes.ok) {
          const typeJson = await typeRes.json();
          if (typeJson.success) setSarprasTypes(typeJson.data);
        }
      } catch (err) {}
    };

    fetchMasterData();
  }, []);

  useEffect(() => {
    fetchListSarpras();
  }, [fetchListSarpras]);

  useEffect(() => {
    setOffset(0);
  }, [selectedDeptId, selectedTypeId, sortBy, sortOrder]);

  const goToPrevPage = () => setOffset(prev => Math.max(0, prev - limit));
  const goToNextPage = () => {
    if (offset + limit < totalRecords) setOffset(prev => prev + limit);
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

  const handleDelete = async () => {
    if (!selectedItem || !deleteNotes.trim()) return;
    setIsLoading(true);
    try {
      const url = `${API_BASE}/sarpras/${selectedItem.ID}`;
      const response = await apiFetch(url, {
        method: 'DELETE',
        body: JSON.stringify({ notes: deleteNotes })
      });
      if (response.ok) {
        setIsDeleteModalOpen(false);
        setDeleteNotes('');
        fetchListSarpras();
      } else {
        const json = await response.json();
        const msg = json.message || json.error || "Gagal menghapus data";
        alert(msg);
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("Terjadi kesalahan koneksi");
    } finally {
      setIsLoading(false);
    }
  };

  const SortIcon = ({ column }: { column: SortableColumn }) => {
    if (sortBy !== column) {
      return (
        <span className="inline-flex ml-1 text-slate-300 group-hover:text-slate-400">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </span>
      );
    }
    return (
      <span className="inline-flex ml-1 text-blue-600">
        {sortOrder === 'ASC' ? (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        ) : (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </span>
    );
  };

  return (
    <div className="p-2 sm:p-4 md:p-6 w-full space-y-4 md:space-y-6 max-w-full overflow-x-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight">List Sarana Prasarana Emergency</h2>
          <p className="text-[11px] md:text-sm font-semibold text-slate-400 mt-0.5">Informasi Lengkap Seluruh data Sarana Prasana Emergency.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
          <button 
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-[#003d7a] font-black text-xs uppercase tracking-wider py-3 px-4 rounded-xl transition-all cursor-pointer border border-slate-200/40 shadow-sm"
            onClick={handleExportPDF}
            disabled={isExporting}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="font-bold tracking-wide">{isExporting ? 'Mengekspor...' : 'Ekspor PDF'}</span>
          </button>
          
          {(userRoles.includes('admin') || userRoles.includes('qs')) && (
            <Link 
              href="/dashboard/sarpras/add" 
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#003d7a] hover:bg-[#002d5a] text-white font-black text-xs uppercase tracking-wider py-3 px-4 rounded-xl shadow-sm transition-all text-center"
            >
              <svg className="w-4 h-4 stroke-[3] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M12 4v16m8-8H4" />
              </svg>
              <span className="font-bold tracking-wide">Tambah Sarpras</span>
            </Link>
          )}
        </div>
      </div>

      <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2.5 py-2 rounded-lg border border-slate-200/60 w-fit">
          Filter By
        </span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="text-xs font-bold text-slate-600 min-w-[110px]">Departemen :</label>
            <select
              value={selectedDeptId}
              onChange={(e) => {
                setSelectedDeptId(e.target.value);
                setOffset(0);
              }}
              className="w-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#003d7a] focus:bg-white transition-all appearance-none"
            >
              <option value="">Semua Departemen</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="text-xs font-bold text-slate-600 min-w-[110px]">Jenis Sarpras :</label>
            <select
              value={selectedTypeId}
              onChange={(e) => {
                setSelectedTypeId(e.target.value);
                setOffset(0);
              }}
              className="w-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#003d7a] focus:bg-white transition-all appearance-none"
            >
              <option value="">Semua Jenis</option>
              {sarprasTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end items-center gap-2 mt-2">
          <span className="text-[10px] font-black text-slate-500">Show:</span>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setOffset(0);
            }}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#003d7a] outline-none"
          >
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden max-w-full">
        <div className="overflow-x-auto w-full scrollbar-thin scrollbar-thumb-slate-200">
          <table className="w-full min-w-[800px] table-auto border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200">
                <th className="py-3 px-2 md:px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-12">No</th>
                <th className="py-3 px-2 md:px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[140px] cursor-pointer select-none hover:text-slate-700 group" onClick={() => handleSort('sarpras_type_name')}>
                  <div className="flex items-center gap-1"><span>Nama Sarpras</span><SortIcon column="sarpras_type_name" /></div>
                </th>
                <th className="py-3 px-2 md:px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[150px] cursor-pointer select-none hover:text-slate-700 group" onClick={() => handleSort('code')}>
                  <div className="flex items-center gap-1"><span>Nomor Sarpras</span><SortIcon column="code" /></div>
                </th>
                <th className="py-3 px-2 md:px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-20 text-center cursor-pointer hover:text-slate-600" onClick={() => handleSort('site_name')}>
                  <div className="flex items-center justify-center gap-1"><span>Site</span><SortIcon column="site_name" /></div>
                </th>
                <th className="py-3 px-2 md:px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[140px] cursor-pointer select-none hover:text-slate-700 group" onClick={() => handleSort('location_dept_name')}>
                  <div className="flex items-center gap-1"><span>Departemen</span><SortIcon column="location_dept_name" /></div>
                </th>
                <th className="py-3 px-2 md:px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[180px]">Lokasi Detail</th>
                <th className="py-3 px-2 md:px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[110px] text-center cursor-pointer hover:text-slate-700 group" onClick={() => handleSort('risk_level')}>
                  <div className="flex items-center justify-center gap-1"><span>Level Resiko</span><SortIcon column="risk_level" /></div>
                </th>
                <th className="py-3 px-2 md:px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 justify-center">
                      <div className="w-6 h-6 border-2 border-slate-200 border-t-[#003d7a] rounded-full animate-spin" />
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Loading data...</span>
                    </div>
                  </td>
                </tr>
              ) : items.length > 0 ? (
                items.map((item, index) => {
                  const rowNumber = offset + index + 1;
                  return (
                    <tr key={item.ID} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors align-top">
                      <td className="py-4 px-2 md:px-4 text-xs md:text-sm font-bold text-slate-400 text-center">{rowNumber}</td>
                      <td className="py-4 px-2 md:px-4 text-xs md:text-sm font-black text-slate-800">
                        <span className="line-clamp-2">{item.SarprasTypeName}</span>
                      </td>
                      <td className="py-4 px-2 md:px-4">
                        <span className="inline-block font-mono text-[10px] md:text-xs font-black text-[#003d7a] bg-blue-50 border border-blue-100/80 px-1.5 py-1 md:px-2 md:py-1 rounded-lg shadow-sm whitespace-nowrap tracking-wide">
                          {item.Code}
                        </span>
                      </td>
                      <td className="py-4 px-2 md:px-4 text-xs md:text-sm font-bold text-slate-600 text-center whitespace-nowrap">{item.SiteName}</td>
                      <td className="py-4 px-2 md:px-4 text-xs md:text-sm font-bold text-slate-600">
                        <span className="line-clamp-2">{item.LocationDeptName}</span>
                      </td>
                      <td className="py-4 px-2 md:px-4 text-xs font-medium text-slate-500 leading-relaxed italic">
                        <span className="line-clamp-2">"{item.LocationDetail || '-'}"</span>
                      </td>
                      <td className="py-4 px-2 md:px-4 text-center">
                        <RiskBadge risk={item.RiskLevel} />
                      </td>
                      <td className="py-4 px-2 md:px-4 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <Link href={`/dashboard/list-sarpras/${item.Code}`} title="View Detail" className="p-1.5 md:p-2 text-slate-400 hover:text-[#003d7a] hover:bg-slate-100 rounded-lg transition-colors">
                            <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>
                          {userRoles.includes('qs') && (
                            <>
                              <Link href={`/dashboard/sarpras/edit/${item.Code}`} title="Edit Data" className="p-1.5 md:p-2 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded-lg transition-colors">
                                <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </Link>
                              <button onClick={() => { setSelectedItem(item); setDeleteNotes(''); setIsDeleteModalOpen(true); }} title="Delete Data" className="p-1.5 md:p-2 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
                                <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs font-semibold text-slate-400 italic">
                    Tidak ada data sarpras.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="bg-slate-50 px-4 md:px-6 py-3 md:py-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-wider text-center sm:text-left">
            {totalRecords > 0
              ? `Showing ${offset + 1} to ${Math.min(offset + limit, totalRecords)} of ${totalRecords} records`
              : "No records found"}
          </span>
          <div className="flex gap-1.5 justify-center">
            <button
              onClick={goToPrevPage}
              disabled={offset === 0}
              className="px-3 md:px-4 py-1.5 md:py-2 bg-white border border-slate-200 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider shadow-sm disabled:opacity-30 hover:bg-slate-50 transition-all cursor-pointer"
            >
              Prev
            </button>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                {getVisiblePages().map(p => (
                  <button
                    key={p}
                    onClick={() => goToPage(p)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm transition-all ${
                      p === currentPage
                        ? 'bg-[#003d7a] text-white shadow-md'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center px-3 md:px-4 bg-slate-200/60 rounded-xl border border-slate-300/30">
              <span className="text-[9px] md:text-[10px] font-black text-slate-700 uppercase tracking-tight">
                {currentPage} / {totalPages}
              </span>
            </div>
            <button
              onClick={goToNextPage}
              disabled={offset + limit >= totalRecords}
              className="px-3 md:px-4 py-1.5 md:py-2 bg-white border border-slate-200 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider shadow-sm disabled:opacity-30 hover:bg-slate-50 transition-all cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {isDeleteModalOpen && selectedItem && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-[90%] sm:max-w-md shadow-xl overflow-hidden border-t-[4px] border-red-500 animate-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-6 text-center">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 mb-1 uppercase tracking-tight">Hapus Sarpras?</h3>
              <div className="bg-slate-50 rounded-xl p-3 sm:p-3.5 mb-4 sm:mb-5 border border-slate-200 text-center">
                <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wide mb-0.5">Asset Terpilih</p>
                <p className="text-xs sm:text-sm font-mono font-black text-[#003d7a]">{selectedItem.Code}</p>
                <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 mt-0.5">{selectedItem.LocationDeptName}</p>
              </div>
              <div className="text-left mb-4 sm:mb-6">
                <label className="block text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5 ml-0.5">Alasan Penghapusan <span className="text-red-500 font-bold">*</span></label>
                <textarea required value={deleteNotes} onChange={(e) => setDeleteNotes(e.target.value)} placeholder="Masukkan alasan penghapusan aset untuk kebutuhan logs audit trail..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-red-500 focus:bg-white outline-none transition-all resize-none placeholder:text-slate-300" rows={3} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-2 sm:py-3 text-xs font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all cursor-pointer">Batal</button>
                <button disabled={!deleteNotes.trim() || isLoading} onClick={handleDelete} className="flex-1 py-2 sm:py-3 bg-red-600 text-white rounded-xl text-xs font-black uppercase shadow-sm shadow-red-200 active:scale-95 transition-all disabled:opacity-30 cursor-pointer">{isLoading ? 'Processing...' : 'Hapus'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
