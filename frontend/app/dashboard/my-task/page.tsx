'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ApprovalModal, { ApprovalData } from '@/components/ApprovalModal';
import { apiFetch } from '@/lib/api';
import { useWebSocket } from '@/hooks/useWebsocket';

interface TaskItem {
  id: number;
  title: string;
  subtitle?: string;
  type?: 'INSPECTION' | 'VERIFICATION' | 'APPROVAL' | 'REPAIR' | 'REFILL';
}

interface MyTasksResponse {
  inspections: TaskItem[] | null;
  verifications: TaskItem[] | null;
  approvals: TaskItem[] | null;
  repairs: TaskItem[] | null;
  refills: TaskItem[] | null;
}

type TabKey = 'inspection' | 'verification' | 'approval' | 'repair' | 'refill';

interface TabConfig {
  key: TabKey;
  label: string;
  taskType: 'INSPECTION' | 'VERIFICATION' | 'APPROVAL' | 'REPAIR' | 'REFILL';
}

const ALL_TABS: TabConfig[] = [
  { key: 'inspection', label: 'Pemeriksaan', taskType: 'INSPECTION' },
  { key: 'verification', label: 'Verifikasi', taskType: 'VERIFICATION' },
  { key: 'approval', label: 'Approval', taskType: 'APPROVAL' },
  { key: 'repair', label: 'Perbaikan', taskType: 'REPAIR' },
  { key: 'refill', label: 'Monitoring ED APAR', taskType: 'REFILL' },
];

export default function MyTasksPage() {
  const [user, setUser] = useState<{
    name: string;
    roles: string[];
    isSupervisor: boolean;
    department?: string;
  }>({
    name: 'User',
    roles: [],
    isSupervisor: false,
    department: '',
  });

  const [visibleTabs, setVisibleTabs] = useState<TabConfig[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey | ''>('');
  const [tasks, setTasks] = useState<{
    inspections: TaskItem[];
    verifications: TaskItem[];
    approvals: TaskItem[];
    repairs: TaskItem[];
    refills: TaskItem[];
  }>({
    inspections: [],
    verifications: [],
    approvals: [],
    repairs: [],
    refills: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [selectedApprovalData, setSelectedApprovalData] = useState<ApprovalData | null>(null);
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);
  const [successModal, setSuccessModal] = useState<{ isOpen: boolean; message: string }>({
    isOpen: false,
    message: '',
  });

  const getStorage = (key: string): string => {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key) ?? '';
  };

  useEffect(() => {
    const roles: string[] = JSON.parse(getStorage('roles') || '[]');
    const fullName = getStorage('fullName') || 'User';
    const isSupervisor = getStorage('isSupervisor') === 'true';
    const department = getStorage('department') || '';
    setUser({ name: fullName, roles, isSupervisor, department });
  }, []);

  useEffect(() => {
    if (user.roles.length === 0) return;

    const tabs: TabConfig[] = [];
    if (user.roles.includes('checker')) {
      tabs.push(ALL_TABS[0]);
    }
    if (user.roles.includes('qs')) {
      tabs.push(ALL_TABS[1]);
      if (user.isSupervisor) {
        tabs.push(ALL_TABS[2]);
      }
    }
    if (user.roles.includes('pic_responsibility')) {
      tabs.push(ALL_TABS[3]);
    }

    const hasRefillAccess = user.roles.includes('qs') || user.roles.includes('admin') ||
      user.department?.toLowerCase().includes('general affair');
    if (hasRefillAccess) {
      tabs.push(ALL_TABS[4]);
    }

    setVisibleTabs(tabs);
    if (tabs.length > 0) {
      setActiveTab(tabs[0].key);
    }
  }, [user]);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/my-tasks`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          const d = json.data as MyTasksResponse;
          setTasks({
            inspections: d.inspections || [],
            verifications: d.verifications || [],
            approvals: (d.approvals || []).map((item) => ({
              ...item,
              type: 'APPROVAL' as const,
            })),
            repairs: d.repairs || [],
            refills: d.refills || [],
          });
        }
      }
    } catch (err) {
      console.error('Gagal memuat daftar tugas', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useWebSocket({
    'DATA_UPDATED': () => {
      fetchTasks();
    },
  });

  const getTaskList = (key: TabKey): TaskItem[] => {
    switch (key) {
      case 'inspection':
        return tasks.inspections;
      case 'verification':
        return tasks.verifications;
      case 'approval':
        return tasks.approvals;
      case 'repair':
        return tasks.repairs;
      case 'refill':
        return tasks.refills;
      default:
        return [];
    }
  };

  const roleLabel = () => {
    const labels: string[] = [];
    if (user.roles.includes('checker')) labels.push('Checker');
    if (user.roles.includes('qs'))
      labels.push(user.isSupervisor ? 'QS Supervisor' : 'QS');
    if (user.roles.includes('pic_responsibility')) labels.push('PIC');
    return labels.join(' · ');
  };

  const fetchAndOpenApproval = async (approvalId: number) => {
    try {
      const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/approvals/${approvalId}`);
      if (res.ok) {
        const json = await res.json();
        setSelectedApprovalData(json.data);
        setIsApprovalModalOpen(true);
      } else {
        console.error('Gagal mengambil detail approval');
      }
    } catch (err) {
      console.error('Error fetching approval detail', err);
    }
  };

  const handleApprovalAction = async (id: number, actionType: 'approve' | 'reject', notes: string) => {
    setIsProcessingApproval(true);
    try {
      const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/approvals/${id}/${actionType}`, {
        method: 'POST',
        body: JSON.stringify({ notes }),
      });
      if (res.ok) {
        setIsApprovalModalOpen(false);
        setSelectedApprovalData(null);
        const successMessage = actionType === 'approve' 
          ? 'Request approval berhasil DISETUJUI!' 
          : 'Request approval berhasil DITOLAK!';
        setSuccessModal({ isOpen: true, message: successMessage });
      } else {
        const err = await res.json();
        console.error(err);
        alert(err.message || 'Gagal memproses approval');
      }
    } catch (err) {
      console.error('Error processing approval', err);
      alert('Terjadi kesalahan koneksi');
    } finally {
      setIsProcessingApproval(false);
    }
  };

  const handleSuccessModalClose = () => {
    setSuccessModal({ isOpen: false, message: '' });
    window.location.reload();
  };

  const handleCardClick = (tab: TabKey, id: number) => {
    if (tab === 'approval') {
      fetchAndOpenApproval(id);
    } else {
      const routes: Record<TabKey, string> = {
        inspection: `/dashboard/inspection`,
        verification: `/dashboard/reviews`,
        approval: '#',
        repair: `/dashboard/repair`,
        refill: `/dashboard/refill`,
      };
      window.location.href = routes[tab];
    }
  };

  const ENTITY_LABEL: Record<string, string> = {
    Sarpras: 'Sarpras',
    SarprasType: 'Jenis Sarpras',
    SarprasBulk: 'Import Sarpras',
    Site: 'Site',
    Department: 'Departemen',
    User: 'User',
  };

  const ACTION_LABEL: Record<string, string> = {
    create: 'Tambah',
    edit: 'Ubah',
    delete: 'Hapus',
  };

  const formatApprovalTitle = (title: string): string => {
    const [entity, action] = title.split(' - ');
    const entityLabel = ENTITY_LABEL[entity?.trim()] ?? entity?.trim();
    const actionLabel = ACTION_LABEL[action?.trim().toLowerCase()] ?? action?.trim();
    return `${entityLabel} — ${actionLabel}`;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm mb-4 md:mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">My Tasks</h1>
            <p className="text-sm text-slate-500 mt-1">
              Halo{' '}
              <span className="font-semibold text-slate-700">{user.name}</span>
              {roleLabel() && (
                <span className="ml-2 inline-block px-2 py-0.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider bg-[#003d7a]/10 text-[#003d7a] rounded-full">
                  {roleLabel()}
                </span>
              )}
            </p>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Berikut daftar pekerjaan yang menunggu tindakanmu.
            </p>
          </div>
        </div>

        {visibleTabs.length > 0 && (
          <div className="flex flex-wrap gap-2 sm:gap-3 mb-6 sm:mb-8 border-b border-slate-200 pb-3 sm:pb-4">
            {visibleTabs.map((tab) => {
              const count = getTaskList(tab.key).length;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 sm:gap-2 rounded-full
                    ${isActive
                      ? 'bg-[#003d7a] text-white shadow-md'
                      : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'
                    }`}
                >
                  {tab.label}
                  {count > 0 && (
                    <span
                      className={`flex items-center justify-center min-w-[18px] sm:min-w-[20px] h-4 sm:h-5 px-1 sm:px-1.5 rounded-full text-[9px] sm:text-[10px] font-bold
                        ${isActive ? 'bg-white text-[#003d7a]' : 'bg-red-500 text-white'}`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="space-y-3 sm:space-y-4">
          {isLoading ? (
            <div className="text-center py-16 sm:py-20 text-slate-400 animate-pulse font-medium text-sm sm:text-base">
              Memuat tugas anda...
            </div>
          ) : activeTab === '' ? (
            <div className="text-center py-16 sm:py-20 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400 text-sm sm:text-base">
              Tidak ada role yang dikonfigurasi.
            </div>
          ) : (
            (() => {
              const currentTab = visibleTabs.find((t) => t.key === activeTab);
              if (!currentTab) return null;
              const list = getTaskList(activeTab as TabKey);
              if (list.length === 0) {
                return (
                  <div className="text-center py-16 sm:py-20 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400 text-sm sm:text-base">
                    Tidak ada tugas tertunda untuk kategori ini.
                  </div>
                );
              }
              return list.map((task) => (
                <div
                  key={task.id}
                  onClick={() => handleCardClick(activeTab as TabKey, task.id)}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/5 transition-all cursor-pointer gap-4 sm:gap-0"
                >
                  <div className="flex items-center gap-4 sm:gap-5">
                    <div className="p-2.5 sm:p-3 bg-slate-50 rounded-xl group-hover:bg-blue-50 transition-colors shrink-0">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-[#003d7a]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                        <path d="M12 11h4" />
                        <path d="M12 16h4" />
                        <path d="M8 11h.01" />
                        <path d="M8 16h.01" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-base sm:text-lg group-hover:text-blue-700 transition-colors">
                        {activeTab === 'approval' ? formatApprovalTitle(task.title) : task.title}
                      </h3>
                      {task.subtitle && <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{task.subtitle}</p>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-8 pl-2 sm:pl-0">
                    <div className="text-left sm:text-right">
                      <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 sm:mb-1">Tipe</p>
                      <span className="px-2 py-0.5 sm:px-3 sm:py-1 bg-blue-50 text-[#003d7a] text-[10px] sm:text-[11px] font-bold rounded-lg border border-blue-100">
                        {currentTab.label}
                      </span>
                    </div>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-slate-300 group-hover:text-blue-400 transition-all transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                </div>
              ));
            })()
          )}
        </div>
      </div>

      <ApprovalModal
        isOpen={isApprovalModalOpen}
        onClose={() => {
          setIsApprovalModalOpen(false);
          setSelectedApprovalData(null);
        }}
        data={selectedApprovalData}
        onAction={handleApprovalAction}
      />

      {successModal.isOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-base font-black text-gray-900 mb-1.5">Berhasil</h3>
            <p className="text-xs text-gray-500 font-medium leading-relaxed mb-5">{successModal.message}</p>
            <button onClick={handleSuccessModalClose} className="w-full px-4 py-2.5 bg-[#003d7a] text-white rounded-lg text-xs font-black uppercase tracking-wider hover:bg-[#002d5a] transition-colors">
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
