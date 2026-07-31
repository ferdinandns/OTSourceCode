'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, API_BASE } from '@/lib/api';
import { getEffectivePermissions } from '@/lib/permissions';
import { useWebSocket } from '@/hooks/useWebsocket';

interface InspectionItem {
  ID: number;
  SarprasID: number;
  SarprasName: string;
  SarprasCode: string;
  SarprasStatus: string;
  CheckerName: string;
  CheckerID: number | null;
  ScheduleStatus: string;
  NextDueDate: string | null;
}

interface MonitoringItem {
  inspection_id: number;
  sarpras_id: number;
  sarpras_code: string;
  sarpras_name: string;
  department_name: string;
  department_id: number;
  checker_name: string;
  checker_id: number;
  created_at: string;
  schedule_status: string;
  sarpras_status: string;
  next_due_date: string | null;
}

interface Department {
  id: number;
  name: string;
}

export default function ListPemeriksaanPage() {
  const router = useRouter();
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [userPerms, setUserPerms] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'monitoring' | null>(null);

  const [listData, setListData] = useState<InspectionItem[]>([]);
  const [scheduleSummary, setScheduleSummary] = useState({
    pending: 0,
    in_progress: 0,
    done: 0,
    overdue: 0,
  });

  const [monitoringData, setMonitoringData] = useState<MonitoringItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [userDeptId, setUserDeptId] = useState<number | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<number | null>(null);
  const [currentUserID, setCurrentUserID] = useState<number | null>(null);
  const [selectedSarprasId, setSelectedSarprasId] = useState<number | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    let mounted = true;
    const loadUser = async () => {
      let roles = JSON.parse(sessionStorage.getItem('roles') || '[]');
      let isSupervisor = sessionStorage.getItem('isSupervisor') === 'true';
      if (!roles.length) {
        try {
          const res = await apiFetch(`${API_BASE}/me`);
          if (res.ok) {
            const json = await res.json();
            const data = json.data;
            roles = data.roles || [];
            isSupervisor = data.is_supervisor || false;
            sessionStorage.setItem('roles', JSON.stringify(roles));
            sessionStorage.setItem('isSupervisor', isSupervisor ? 'true' : 'false');
            const uid = data.user_id || data.id;
            if (uid) localStorage.setItem('user_id', uid.toString());
          }
        } catch (e) { console.error(e); }
      }
      if (!mounted) return;
      setUserRoles(roles);
      setUserPerms(getEffectivePermissions(roles, isSupervisor));
      const uid = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');
      if (uid) setCurrentUserID(Number(uid));
      const did = sessionStorage.getItem('department_id');
      if (did) {
        const deptId = Number(did);
        setUserDeptId(deptId);
        setSelectedDeptId(deptId);
      }
    };
    const fetchDepts = async () => {
      try {
        const res = await apiFetch(`${API_BASE}/departments`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) setDepartments(json.data || []);
        }
      } catch (e) { console.error(e); }
    };
    loadUser();
    fetchDepts();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!userRoles.length) return;
    const isChecker = userRoles.includes('checker');
    const canViewMonitoring = userPerms.includes('view:inspection');
    if (isChecker) setActiveTab('active');
    else if (canViewMonitoring) setActiveTab('monitoring');
    else setActiveTab(null);
  }, [userRoles, userPerms]);

  useEffect(() => {
    if (activeTab === 'active') fetchActiveInspections();
    else if (activeTab === 'monitoring') fetchMonitoringData();
  }, [activeTab, selectedDeptId]);

  const fetchActiveInspections = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/inspections/active`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data?.data || [];
        setListData(data);
        const pending = data.filter((i: InspectionItem) => i.ScheduleStatus === 'pending').length;
        const inProgress = data.filter((i: InspectionItem) => i.ScheduleStatus === 'in_progress').length;
        const done = data.filter((i: InspectionItem) => i.ScheduleStatus === 'done').length;
        const overdue = data.filter((i: InspectionItem) => i.ScheduleStatus === 'overdue').length; 
        setScheduleSummary({ pending, in_progress: inProgress, done, overdue, });
      } else setListData([]);
    } catch (err) {
      console.error(err);
      setListData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchMonitoringData = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = `${API_BASE}/inspections/monitoring?page=1&page_size=100`;
      if (selectedDeptId !== null && selectedDeptId !== 0) url += `&department_id=${selectedDeptId}`;
      else if (selectedDeptId === 0) url += `&department_id=all`;
      const res = await apiFetch(url);
      if (res.ok) {
        const json = await res.json();
        const data = json.data?.data || [];
        setMonitoringData(data);
      } else setMonitoringData([]);
    } catch (err) {
      console.error(err);
      setMonitoringData([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDeptId]);

  useWebSocket({
    'DATA_UPDATED': () => {
      if (activeTab === 'active') {
        fetchActiveInspections();
      } else if (activeTab === 'monitoring') {
        fetchMonitoringData();
      }
    },
  });

  const handleClaimAndGo = async () => {
    if (!selectedSchedule || !selectedSarprasId) return;
    try {
      setProcessingId(selectedSchedule);
      setIsModalOpen(false);
      const res = await apiFetch(`${API_BASE}/inspections/${selectedSchedule}/claim`, { method: 'POST' });
      if (res.ok) {
        router.push(`/inspection/form/${selectedSarprasId}?scheduleId=${selectedSchedule}`);
      } else {
        const errData = await res.json();
        alert(errData.message || 'Gagal claim');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
      setSelectedSchedule(null);
      setSelectedSarprasId(null);
    }
  };

  const isResumableByMe = (item: InspectionItem) =>
    item.ScheduleStatus === 'in_progress' && item.CheckerID !== null && item.CheckerID === currentUserID;

  const canInspectItem = (item: InspectionItem) => {
    if (!item.NextDueDate) return true;
    const due = new Date(item.NextDueDate);
    const now = new Date();
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 3600 * 24));
    return diffDays <= 10;
  };

  const filteredData = useMemo(() => {
    if (filterStatus === 'All') return listData;
    return listData.filter(item => item.ScheduleStatus === filterStatus);
  }, [listData, filterStatus]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const canViewMonitoring = userPerms.includes('view:inspection') && userRoles.includes('qs');
  const isChecker = userRoles.includes('checker');

  if (activeTab === null) return <div className="p-8 text-center text-gray-500 animate-pulse">Memuat...</div>;

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-8 md:pb-10 px-4 md:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm mb-5 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
            Pemeriksaan Sarpras
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Status kesiapan sarana prasarana emergency Bintang Toedjoe.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 sm:gap-6 border-b border-gray-200 pb-2">
        {isChecker && (
          <button
            onClick={() => setActiveTab('active')}
            className={`pb-2 sm:pb-3 px-1 sm:px-2 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all ${
              activeTab === 'active'
                ? 'border-b-2 border-[#003d7a] text-[#003d7a]'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Aktif
          </button>
        )}
        {canViewMonitoring && (
          <button
            onClick={() => setActiveTab('monitoring')}
            className={`pb-2 sm:pb-3 px-1 sm:px-2 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all ${
              activeTab === 'monitoring'
                ? 'border-b-2 border-[#003d7a] text-[#003d7a]'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Monitoring
          </button>
        )}
      </div>

      {activeTab === 'active' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 md:gap-4">
            <SummaryCard label="Pending" count={scheduleSummary.pending} total={listData.length} color="#f59e0b" icon="🕒" />
            <SummaryCard label="In Progress" count={scheduleSummary.in_progress} total={listData.length} color="#3b82f6" icon="⚙️" />
            <SummaryCard label="Done" count={scheduleSummary.done} total={listData.length} color="#10b981" icon="✓" />
            <SummaryCard label="Overdue"     count={scheduleSummary.overdue}     total={listData.length} color="#ef4444" icon="⚠️" />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-3 md:p-5 border-b border-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#f8fafd]">
              <div className="flex items-center gap-3">
                <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Filter Status Jadwal:</span>
                <select
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                  className="bg-white border border-gray-200 rounded-md px-2 py-1 md:px-4 md:py-1.5 text-[10px] md:text-xs font-bold text-gray-700 outline-none"
                >
                  <option value="All">Semua</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
              <button
                onClick={() => { setFilterStatus('All'); setCurrentPage(1); }}
                className="text-[10px] md:text-[11px] font-bold text-[#003d7a] hover:underline uppercase tracking-wider"
              >
                Reset
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[800px] md:min-w-full w-full text-left">
                <thead>
                  <tr className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                    <th className="py-3 md:py-5 px-3 md:px-6">No</th>
                    <th className="py-3 md:py-5 px-3 md:px-4">Nama Sarpras</th>
                    <th className="py-3 md:py-5 px-3 md:px-4">Nomor</th>
                    <th className="py-3 md:py-5 px-3 md:px-4 text-center">Status Sarpras</th>
                    <th className="py-3 md:py-5 px-3 md:px-4 text-center">Status Jadwal</th>
                    <th className="py-3 md:py-5 px-3 md:px-4 text-center">Jatuh Tempo</th>
                    <th className="py-3 md:py-5 px-3 md:px-4 text-center">Pemeriksa</th>
                    <th className="py-3 md:py-5 px-3 md:px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {isLoading ? (
                    <tr><td colSpan={8} className="py-10 text-center text-xs md:text-sm font-bold text-gray-400 animate-pulse">Loading data...</td></tr>
                  ) : paginatedData.length === 0 ? (
                    <tr><td colSpan={8} className="py-10 text-center text-xs md:text-sm font-bold text-gray-400">Tidak ada data pemeriksaan aktif</td></tr>
                  ) : (
                    paginatedData.map((item, idx) => {
                      const isResumable = isResumableByMe(item);
                      const canInspect = canInspectItem(item);
                      const showClaimBtn = (item.ScheduleStatus === 'pending' || item.ScheduleStatus === 'overdue') && canInspect;
                      const showResumeBtn = item.ScheduleStatus === 'in_progress' && isResumable;
                      const showDisabled = (item.ScheduleStatus === 'in_progress' && !isResumable) || (item.ScheduleStatus === 'pending' && !canInspect);
                      return (
                        <tr key={item.ID} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 md:py-5 px-3 md:px-6 text-xs md:text-sm font-bold text-gray-900">
                            {(currentPage - 1) * itemsPerPage + idx + 1}
                           </td>
                          <td className="py-3 md:py-5 px-3 md:px-4 text-xs md:text-sm font-bold text-gray-900">{item.SarprasName}</td>
                          <td className="py-3 md:py-5 px-3 md:px-4 text-xs md:text-sm font-bold text-[#003d7a] uppercase">{item.SarprasCode}</td>
                          <td className="py-3 md:py-5 px-3 md:px-4 text-center">
                            <SarprasStatusBadge status={item.SarprasStatus} />
                          </td>
                          <td className="py-3 md:py-5 px-3 md:px-4 text-center">
                            <ScheduleStatusBadge status={item.ScheduleStatus} />
                          </td>
                          <td className="py-3 md:py-5 px-3 md:px-4 text-center font-bold text-xs md:text-sm text-gray-400 italic">
                            {item.NextDueDate ? new Date(item.NextDueDate).toLocaleDateString('id-ID') : '-'}
                          </td>
                          <td className="py-3 md:py-5 px-3 md:px-4 text-center">
                            {item.CheckerName ? (
                              <div className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 transition-colors rounded-full px-2 py-0.5 md:px-3 md:py-1 shadow-sm">
                                <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-gradient-to-br from-[#003d7a] to-[#0ea5e9] flex items-center justify-center text-white text-[8px] md:text-[10px] font-bold">
                                  {item.CheckerName.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-[10px] md:text-sm font-medium text-gray-700 truncate max-w-[80px] md:max-w-[120px]">
                                  {item.CheckerName}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] md:text-xs text-gray-400 italic flex items-center justify-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                Belum
                              </span>
                            )}
                          </td>
                          <td className="py-3 md:py-5 px-3 md:px-4 text-center">
                            {showClaimBtn && (
                              <button
                                onClick={() => { setSelectedSchedule(item.ID); setSelectedSarprasId(item.SarprasID); setIsModalOpen(true); }}
                                disabled={processingId === item.ID}
                                className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 md:px-4 md:py-1.5 rounded text-[9px] md:text-[10px] font-black uppercase flex items-center gap-1 mx-auto transition-all shadow-md"
                              >
                                {processingId === item.ID ? '...' : 'Periksa'}
                              </button>
                            )}
                            {showResumeBtn && (
                              <button
                                onClick={() => { setSelectedSchedule(item.ID); setSelectedSarprasId(item.SarprasID); setIsModalOpen(true); }}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 md:px-4 md:py-1.5 rounded text-[9px] md:text-[10px] font-black uppercase flex items-center gap-1 mx-auto"
                              >
                                Lanjutkan
                              </button>
                            )}
                            {showDisabled && (
                              <button disabled className="bg-gray-200 text-gray-400 px-2 py-1 md:px-4 md:py-1.5 rounded text-[9px] md:text-[10px] font-black uppercase cursor-not-allowed mx-auto">
                                {item.ScheduleStatus === 'in_progress' ? 'Sedang Diperiksa' : 'Belum Waktunya'}
                              </button>
                            )}
                            {item.ScheduleStatus === 'done' && (
                              <button
                                onClick={() => router.push(`/dashboard/inspection/detail/${item.ID}`)}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 md:px-4 md:py-1.5 rounded text-[9px] md:text-[10px] font-black uppercase"
                              >
                                Detail
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {!isLoading && totalPages > 1 && (
              <div className="p-4 md:p-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs border-t border-gray-50 bg-white">
                <p className="font-bold text-gray-400">Page {currentPage} of {totalPages}</p>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentPage(prev => Math.max(prev-1,1))} disabled={currentPage===1} className="p-1.5 md:p-2 border rounded hover:bg-gray-50 disabled:opacity-20 uppercase font-black text-[9px] md:text-[10px]">Prev</button>
                  <button onClick={() => setCurrentPage(prev => Math.min(prev+1,totalPages))} disabled={currentPage===totalPages} className="p-1.5 md:p-2 border rounded hover:bg-gray-50 disabled:opacity-20 uppercase font-black text-[9px] md:text-[10px]">Next</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'monitoring' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-3 md:p-5 border-b border-gray-50 bg-[#f8fafd] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Filter Departemen:</span>
              <select
                value={selectedDeptId ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'all') setSelectedDeptId(0);
                  else setSelectedDeptId(Number(val));
                }}
                className="bg-white border border-gray-200 rounded-md px-2 py-1 md:px-4 md:py-1.5 text-[10px] md:text-xs font-bold text-gray-700 outline-none"
              >
                <option value="all">Semua Departemen</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
          </div>
          {isLoading ? (
            <div className="py-10 text-center text-xs md:text-sm font-bold text-gray-400 animate-pulse">Memuat data monitoring...</div>
          ) : monitoringData.length === 0 ? (
            <div className="py-10 text-center text-xs md:text-sm font-bold text-gray-400">Belum ada data monitoring</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[800px] md:min-w-full w-full text-left">
                <thead>
                  <tr className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                    <th className="py-3 md:py-4 px-3 md:px-4">No</th>
                    <th className="py-3 md:py-4 px-3 md:px-4">Kode Sarpras</th>
                    <th className="py-3 md:py-4 px-3 md:px-4">Nama Sarpras</th>
                    <th className="py-3 md:py-4 px-3 md:px-4">Departemen</th>
                    <th className="py-3 md:py-4 px-3 md:px-4">Pemeriksa</th>
                    <th className="py-3 md:py-4 px-3 md:px-4 text-center">Status Jadwal</th>
                    <th className="py-3 md:py-4 px-3 md:px-4 text-center">Status Sarpras</th>
                    <th className="py-3 md:py-4 px-3 md:px-4 text-center">Jatuh Tempo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {monitoringData.map((item, index) => (
                    <tr key={item.inspection_id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 md:py-4 px-3 md:px-4 text-xs md:text-sm font-mono text-gray-500">{(index + 1)}</td>
                      <td className="py-3 md:py-4 px-3 md:px-4 text-xs md:text-sm font-bold text-[#003d7a]">{item.sarpras_code}</td>
                      <td className="py-3 md:py-4 px-3 md:px-4 text-xs md:text-sm font-bold text-gray-800">{item.sarpras_name}</td>
                      <td className="py-3 md:py-4 px-3 md:px-4 text-xs md:text-sm text-gray-600">{item.department_name}</td>
                      <td className="py-3 md:py-4 px-3 md:px-4 text-xs md:text-sm text-gray-600">{item.checker_name || '-'}</td>
                      <td className="py-3 md:py-4 px-3 md:px-4 text-center"><ScheduleStatusBadge status={item.schedule_status} /></td>
                      <td className="py-3 md:py-4 px-3 md:px-4 text-center"><SarprasStatusBadge status={item.sarpras_status} /></td>
                      <td className="py-3 md:py-4 px-3 md:px-4 text-center text-xs md:text-sm text-gray-500">
                        {item.next_due_date ? new Date(item.next_due_date).toLocaleDateString('id-ID') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[99] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-5 md:p-8 max-w-sm w-full shadow-2xl border border-gray-100">
            <h3 className="text-center text-lg md:text-xl font-black text-gray-900 tracking-tight uppercase mb-4">Lakukan Pemeriksaan?</h3>
            <p className="text-center text-gray-500 text-xs md:text-sm font-medium mb-6 md:mb-8 italic">
              {selectedSchedule && listData.find(i => i.ID === selectedSchedule)?.ScheduleStatus === 'in_progress'
                ? 'Anda akan melanjutkan pemeriksaan yang sebelumnya tertunda.'
                : 'Setelah diklik, Anda bertanggung jawab menyelesaikan pemeriksaan ini.'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-2 md:py-3 border border-gray-200 rounded-xl text-[10px] md:text-xs font-black uppercase text-gray-400">Batal</button>
              <button onClick={handleClaimAndGo} className="flex-1 py-2 md:py-3 bg-[#0ea5e9] text-white rounded-xl text-[10px] md:text-xs font-black uppercase shadow-lg hover:bg-[#0284c7]">Ya, Yakin</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, count, total, color, icon }: any) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="bg-white p-3 md:p-6 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden flex flex-col justify-between h-[90px] md:h-[130px]">
      <div className="absolute left-0 top-0 bottom-0 w-[3px] md:w-[4px]" style={{ backgroundColor: color }} />
      <div className="flex justify-between items-start">
        <div>
          <p className="text-[8px] md:text-[9px] font-black text-gray-400 tracking-widest uppercase">{label}</p>
          <h3 className="text-lg md:text-2xl font-black text-gray-900 mt-1">{count}</h3>
        </div>
        <div className="w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-white text-[8px] md:text-[10px] font-black" style={{ backgroundColor: color }}>
          {icon}
        </div>
      </div>
      <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
        <div className="h-full transition-all duration-700" style={{ backgroundColor: color, width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function SarprasStatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase().replace(/_/g, ' ') || '';
  const config: Record<string, string> = {
    ready: 'bg-emerald-100 text-emerald-700',
    'not ready': 'bg-red-100 text-red-600',
    'need repair': 'bg-amber-100 text-amber-700',
    'will be repaired': 'bg-blue-100 text-blue-700',
    'waiting verification': 'bg-purple-100 text-purple-700',
  };
  const display = s === 'not ready' ? 'Not Ready' : s === 'need repair' ? 'Need Repair' : s === 'will be repaired' ? 'Will Be Repaired' : s === 'waiting verification' ? 'Waiting Verif' : s;
  return <span className={`px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-wider ${config[s] || 'bg-gray-100 text-gray-400'}`}>{display}</span>;
}

function ScheduleStatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase() || '';
  const config: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    in_progress: 'bg-blue-100 text-blue-700',
    done: 'bg-green-100 text-green-700',
    overdue:     'bg-red-100 text-red-700',
  };
  const display = s === 'in_progress' ? 'In Progress' : s;
  return <span className={`px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-wider ${config[s] || 'bg-gray-100 text-gray-400'}`}>{display}</span>;
}