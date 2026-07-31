"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, API_BASE } from "@/lib/api";
import Link from "next/link";
import { useWebSocket } from '@/hooks/useWebsocket';

type RepairStatus =
  | "assigned"
  | "in_progress"
  | "submitted"
  | "in_review"
  | "approved"
  | "rejected"
  | "waiting_verification";

interface RepairRow {
  ID: number;
  SarprasID: number;
  SarprasCode: string;
  SarprasName: string;
  DepartmentName: string;
  CheckerName: string;
  InspectedAt: string;
  NOKParameters: string[];
  ActionPlan: string;
  RepairDueDate: string | null;
  PICName: string;
  SarprasStatus: string;
  RepairStatus: RepairStatus;
}

interface NOKParameterDetail {
  parameter_name: string;
  notes: string;
  photo_url: string;
}

interface SubmissionDetail {
  id: number;
  attempt: number;
  action_plan: string;
  due_date: string | null;
  status: string; // draft, submitted, reviewed
  created_at: string;
  evidences: string[];
  reviewed_at?: string;
  verdict?: string; // "approve" | "reject"
  feedback?: string;
  reviewer_name?: string;
    review_attachments?: string[];
}

interface RepairDetailResponse {
  repair_order_id: number;
  pic_name: string;
  sarpras_code: string;
  sarpras_name: string;
  department: string;
  inspected_at: string;
  status: RepairStatus;
  reviewer_feedback: string;
  reviewer_name: string;
  nok_details: NOKParameterDetail[];
  submissions: SubmissionDetail[];
}

interface ReviewHistoryItem {
  id: number;
  verdict: "approve" | "reject";
  feedback: string;
  reviewer_name: string;
  reviewed_at: string;
}

interface RepairMonitoringRow {
  repair_order_id: number;
  sarpras_id: number;
  sarpras_code: string;
  sarpras_name: string;
  pic_department: string;
  department_id: number;
  pic_name: string;
  checker_name: string;
  action_plan: string;
  repair_status: RepairStatus; // assigned, in_progress, submitted, in_review (nanti di-map)
  created_at: string;
  due_date: string | null;
  reviewer_id: number | null;
  reviewer_name: string;
}

const PAGE_SIZE = 10;
const REVIEW_HISTORY_PAGE_SIZE = 5;

export default function RepairPage() {
  const router = useRouter();
  const [items, setItems] = useState<RepairRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedDetail, setSelectedDetail] = useState<RepairDetailResponse | null>(null);
  const [isViewDetailModalOpen, setIsViewDetailModalOpen] = useState(false);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("");

  const [activeTab, setActiveTab] = useState<"active" | "history" | "monitoring" | 'allHistory' | null>(null);
  const [picHistory, setPicHistory] = useState<RepairRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyStatusFilter, setHistoryStatusFilter] = useState("");

  const [allHistoryData, setAllHistoryData] = useState<RepairMonitoringRow[]>([]);
  const [allHistoryLoading, setAllHistoryLoading] = useState(false);
  const [allHistoryPage, setAllHistoryPage] = useState(1);
  const [allHistoryTotal, setAllHistoryTotal] = useState(0);
  const [allHistoryDeptFilter, setAllHistoryDeptFilter] = useState<number | null>(null);
  const [allHistorySearch, setAllHistorySearch] = useState("");

  const [detailModalTab, setDetailModalTab] = useState<"detail" | "reviewHistory">("detail");
  const [reviewHistory, setReviewHistory] = useState<ReviewHistoryItem[]>([]);
  const [reviewHistoryLoading, setReviewHistoryLoading] = useState(false);
  const [reviewHistoryPage, setReviewHistoryPage] = useState(1);
  const [reviewHistoryTotal, setReviewHistoryTotal] = useState(0);
  const [selectedAttempt, setSelectedAttempt] = useState<number>(); 

  const [repairMonitoring, setRepairMonitoring] = useState<RepairMonitoringRow[]>([]);
  const [monitoringDept, setMonitoringDept] = useState<number | null>(null);
  const [departments, setDepartments] = useState<{id:number, name:string}[]>([]);

  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [userDeptId, setUserDeptId] = useState<number | null>(null);

  const fetchRepairMonitoring = useCallback(async () => {
    try {
      let url = `${API_BASE}/repairs/monitoring?page=1&page_size=100`;
      if (monitoringDept && monitoringDept !== 0) url += `&department_id=${monitoringDept}`;
      const res = await apiFetch(url);
      const json = await res.json();
      if (json.success) setRepairMonitoring(json.data.data || []);
    } catch(err) { console.error(err); }
  }, [monitoringDept]);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_BASE}/departments`);
      const json = await res.json();
      if (json.success) setDepartments(json.data || []);
    } catch(err) { console.error(err); }
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      let roles = JSON.parse(sessionStorage.getItem('roles') || '[]');
      if (roles.length === 0) {
        try {
          const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/me`);
          if (res.ok) {
            const json = await res.json();
            roles = json.data.roles || [];
            sessionStorage.setItem('roles', JSON.stringify(roles));
            const deptId = json.data.department_id;
            if (deptId) {
              setUserDeptId(deptId);
              sessionStorage.setItem('department_id', deptId.toString());
            }
          }
        } catch (err) {
          console.error('Gagal ambil user data', err);
        }
      } else {
        const deptId = sessionStorage.getItem('department_id');
        if (deptId) setUserDeptId(Number(deptId));
      }
      setUserRoles(roles);
    };
    loadUser();
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  useEffect(() => {
    if (userRoles.includes('pic_responsibility')) {
      setActiveTab('active');
    } else if (userRoles.includes('qs')) {
      setActiveTab('monitoring');
    } else {
      setActiveTab(null);
    }
  }, [userRoles]);

  useEffect(() => {
    if (activeTab === 'monitoring') {
      fetchRepairMonitoring();
    }
  }, [activeTab, fetchRepairMonitoring]);

  const fetchRepairs = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = `${API_BASE}/repairs`;
      const res = await apiFetch(url);
      const json = await res.json();
      if (json.success) {
        let allData = json.data.data || [];
        allData = allData.filter((item: RepairRow) => item.RepairStatus.toLowerCase() !== "approved");
        const mappedData = allData.map((item: RepairRow) => ({
          ...item,
          RepairStatus: mapStatus(item.RepairStatus) as RepairStatus,
        }));
        let filtered = mappedData;
        if (statusFilter) {
          filtered = mappedData.filter((item: RepairRow) => item.RepairStatus === statusFilter);
        }
        setItems(filtered);
      }
    } catch (err) {
      console.error("Gagal memuat data repair", err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (activeTab === "active") fetchRepairs();
  }, [fetchRepairs, activeTab]);

  const fetchPicHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", historyPage.toString());
      params.append("page_size", PAGE_SIZE.toString());
      if (historyStatusFilter) params.append("status", historyStatusFilter);
      const res = await apiFetch(`${API_BASE}/repairs/history/pic?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setPicHistory(json.data.data || []);
        setHistoryTotal(json.data.total || 0);
      }
    } catch (err) {
      console.error("Gagal memuat riwayat perbaikan", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPage, historyStatusFilter]);

  const fetchAllHistory = useCallback(async () => {
    setAllHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", allHistoryPage.toString());
      params.append("page_size", PAGE_SIZE.toString());
      if (allHistoryDeptFilter) params.append("department_id", allHistoryDeptFilter.toString());
      if (allHistorySearch) params.append("search", allHistorySearch);
      const res = await apiFetch(`${API_BASE}/repairs/history/all?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setAllHistoryData(json.data.data || []);
        setAllHistoryTotal(json.data.total || 0);
      }
    } catch (err) {
      console.error("Gagal memuat semua riwayat perbaikan", err);
    } finally {
      setAllHistoryLoading(false);
    }
  }, [allHistoryPage, allHistoryDeptFilter, allHistorySearch]);

  const fetchActiveRef = useRef(fetchRepairs);
  const fetchHistoryRef = useRef(fetchPicHistory);
  const fetchMonitoringRef = useRef(fetchRepairMonitoring);

  useEffect(() => {
    fetchActiveRef.current = fetchRepairs;
  }, [fetchRepairs]);

  useEffect(() => {
    fetchHistoryRef.current = fetchPicHistory;
  }, [fetchPicHistory]);

  useEffect(() => {
    fetchMonitoringRef.current = fetchRepairMonitoring;
  }, [fetchRepairMonitoring]);

  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);  

  useWebSocket({
  'DATA_UPDATED': () => {
    if (activeTabRef.current === 'active') fetchActiveRef.current();
    else if (activeTabRef.current === 'history') fetchHistoryRef.current();
    else if (activeTabRef.current === 'monitoring') fetchMonitoringRef.current();
    else if (activeTabRef.current === 'allHistory') fetchAllHistory();
  },
});

  useEffect(() => {
    if (activeTab === 'allHistory') fetchAllHistory();
  }, [fetchAllHistory, activeTab]);

  useEffect(() => {
    if (activeTab === "history") fetchPicHistory();
  }, [fetchPicHistory, activeTab]);

  const fetchReviewHistory = useCallback(async (repairID: number, page: number) => {
    setReviewHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("page_size", REVIEW_HISTORY_PAGE_SIZE.toString());
      const res = await apiFetch(`${API_BASE}/repairs/${repairID}/reviews?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setReviewHistory(json.data.data || []);
        setReviewHistoryTotal(json.data.total || 0);
      }
    } catch (err) {
      console.error("Gagal memuat riwayat review", err);
    } finally {
      setReviewHistoryLoading(false);
    }
  }, []);

  const getActiveSubmission = useCallback(() => {
    if (!selectedDetail?.submissions?.length) return null;
    if (selectedAttempt === 0) {
      return selectedDetail.submissions.reduce((prev, curr) =>
        curr.attempt > prev.attempt ? curr : prev
      );
    }
    return selectedDetail.submissions.find((s) => s.attempt === selectedAttempt);
  }, [selectedDetail, selectedAttempt]);

  const handleOpenViewDetail = async (repairID: number) => {
    setIsModalLoading(true);
    setIsViewDetailModalOpen(true);
    setDetailModalTab("detail");
    setReviewHistory([]);
    setReviewHistoryPage(1);
    try {
      const res = await apiFetch(`${API_BASE}/repairs/${repairID}`);
      const json = await res.json();
      if (json.success) {
        setSelectedDetail(json.data);
        const subs = json.data.submissions;
        if (subs && subs.length > 0) {
          const maxAttempt = Math.max(...subs.map((s: any) => s.attempt));
          setSelectedAttempt(maxAttempt);
        } else {
          setSelectedAttempt(0);
        }
      }
    } catch {
      alert("Gagal memuat detail riwayat perbaikan");
      setIsViewDetailModalOpen(false);
    } finally {
      setIsModalLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr || dateStr === "0001-01-01T00:00:00Z") return "-";
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(dateStr));
  };

  const getTimelineStatus = (dueDate: string | null, status: RepairStatus) => {
    if (!dueDate || dueDate === "0001-01-01T00:00:00Z") return "-";
    if (status.toLowerCase() === "approved")
      return <span className="text-emerald-600 font-bold">Done</span>;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    if (today > due) return <span className="text-red-600 font-bold">Overdue</span>;
    return <span className="text-amber-600 font-bold">On Due Date</span>;
  };

  const mapStatus = (status: string): string => {
    const s = status.toLowerCase();
    if (s === "submitted" || s === "in_review") return "waiting_verification";
    return s;
  };

  const getStatusBadge = (status: string) => {
    const normalized = mapStatus(status);
    const config: Record<string, { bg: string; text: string; border: string; label: string }> = {
      assigned: { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", label: "Opened" },
      in_progress: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", label: "On Progress" },
      waiting_verification: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", label: "Waiting Verification" },
      rejected: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", label: "Rejected" },
    };
    const c = config[normalized] || { bg: "bg-gray-50", text: "text-gray-500", border: "border-gray-200", label: status };
    return (
      <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border shadow-sm inline-block ${c.bg} ${c.text} ${c.border}`}>
        {c.label}
      </span>
    );
  };

  const countStatus = (status: string) =>
    items.filter((i) => (i.RepairStatus || "").toLowerCase().trim() === status.toLowerCase().trim()).length;

  const getRejectedRoute = (item: RepairRow): { href: string; label: string } => ({
    href: `/dashboard/repair/action-plan/${item.ID}`,
    label: "Isi Ulang Action Plan",
  });

  const historyTotalPages = Math.ceil(historyTotal / PAGE_SIZE);
  const reviewHistoryTotalPages = Math.ceil(reviewHistoryTotal / REVIEW_HISTORY_PAGE_SIZE);

  return (
    <div className="p-2 space-y-6 max-w-7xl mx-auto w-full animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm mb-5 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
            Perbaikan (Repair)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Monitoring pengajuan action plan dan bukti perbaikan sarana prasarana.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 sm:gap-6 border-b border-gray-200 pb-2">
        {userRoles.includes('pic_responsibility') && (
          <>
            <button
              onClick={() => setActiveTab("active")}
              className={`pb-2 sm:pb-3 px-1 sm:px-2 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all ${
                activeTab === "active" ? "border-b-2 border-[#003d7a] text-[#003d7a]" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              Tugas Aktif
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`pb-2 sm:pb-3 px-1 sm:px-2 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all ${
                activeTab === "history" ? "border-b-2 border-[#003d7a] text-[#003d7a]" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              Riwayat Perbaikan Saya
            </button>
          </>
        )}
        {userRoles.includes('qs') && (
        <>
          <button
            onClick={() => setActiveTab("monitoring")}
            className={`pb-2 sm:pb-3 px-1 sm:px-2 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all ${
              activeTab === "monitoring" ? "border-b-2 border-[#003d7a] text-[#003d7a]" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Monitoring
          </button>
          <button
            onClick={() => setActiveTab("allHistory")}
            className={`pb-2 sm:pb-3 px-1 sm:px-2 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all ${
              activeTab === "allHistory" ? "border-b-2 border-[#003d7a] text-[#003d7a]" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Riwayat Semua Perbaikan
          </button>
        </>
      )}
      </div>

      {activeTab === "active" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 md:gap-4">
            {[
              { key: "assigned", label: "Opened", color: "#64748b", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /> },
              { key: "in_progress", label: "On Progress", color: "#2563eb", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /> },
              { key: "waiting_verification", label: "Waiting Verification", color: "#7c3aed", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /> },
              { key: "rejected", label: "Rejected", color: "#dc2626", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /> },
            ].map((st) => {
              const currentCount = countStatus(st.key);
              const percentage = items.length > 0 ? (currentCount / items.length) * 100 : 0;
              return (
                <div key={st.key} className="bg-white p-5 rounded-xl shadow-sm flex flex-col border border-gray-100 relative overflow-hidden" style={{ borderLeft: `4px solid ${st.color}` }}>
                  <p className="text-[10px] md:text-[11px] font-black uppercase text-gray-400 tracking-wider mb-2">{st.label}</p>
                  <div className="flex justify-between items-center">
                    <h3 className="text-2xl md:text-3xl font-black text-gray-900 font-mono">{currentCount}</h3>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${st.color}15` }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: st.color }}>{st.icon}</svg>
                    </div>
                  </div>
                  <div className="mt-4 h-1 rounded-full w-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%`, backgroundColor: st.color }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-3 md:p-5 border-b border-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#f8fafd]">
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-md px-2.5 py-1.5 md:px-3.5 md:py-2 w-full sm:w-72 focus-within:ring-2 focus-within:ring-[#003d7a] transition-all">
                <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" placeholder="Cari nomor asset..." className="bg-transparent border-none outline-none text-[10px] md:text-xs font-bold text-gray-700 w-full placeholder:text-gray-400" />
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Filter Status:</span>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-white border border-gray-200 rounded-md px-2 py-1 md:px-4 md:py-1.5 text-[10px] md:text-xs font-bold text-gray-700 outline-none">
                  <option value="">Semua Status</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="waiting_verification">Waiting Verification</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1000px] md:min-w-full w-full text-left">
                <thead>
                  <tr className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                    <th className="py-3 md:py-5 px-3 md:px-6 text-center w-14">No</th>
                    <th className="py-3 md:py-5 px-3 md:px-4">Tgl Inspeksi</th>
                    <th className="py-3 md:py-5 px-3 md:px-4">Nama Sarpras</th>
                    <th className="py-3 md:py-5 px-3 md:px-4">Departemen</th>
                    <th className="py-3 md:py-5 px-3 md:px-4 text-center">Status</th>
                    <th className="py-3 md:py-5 px-3 md:px-4">Parameter NOK</th>
                    <th className="py-3 md:py-5 px-3 md:px-4">Action Plan</th>
                    <th className="py-3 md:py-5 px-3 md:px-4">Due Date</th>
                    <th className="py-3 md:py-5 px-3 md:px-4">Timeline</th>
                    <th className="py-3 md:py-5 px-3 md:px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {isLoading ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-xs md:text-sm font-bold text-gray-400 animate-pulse">Loading records...</td>
                    </tr>
                  ) : items.length > 0 ? (
                    items.map((item, index) => {
                      const displayStatus = item.RepairStatus;
                      const rejectedRoute = displayStatus === "rejected" ? getRejectedRoute(item) : null;
                      return (
                        <tr key={item.ID} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 md:py-5 px-3 md:px-6 text-xs md:text-sm font-bold text-gray-900 text-center">{index + 1}</td>
                          <td className="py-3 md:py-5 px-3 md:px-4 text-xs md:text-sm font-bold text-gray-500">{formatDate(item.InspectedAt)}</td>
                          <td className="py-3 md:py-5 px-3 md:px-4">
                            <p className="text-xs md:text-sm font-bold text-gray-900">{item.SarprasName}</p>
                            <span className="inline-block text-[10px] font-bold text-gray-400 mt-0.5">{item.SarprasCode}</span>
                          </td>
                          <td className="py-3 md:py-5 px-3 md:px-4 text-xs md:text-sm font-bold text-gray-600 whitespace-normal break-words">{item.DepartmentName}</td>
                          <td className="py-3 md:py-5 px-3 md:px-4 text-center">{getStatusBadge(item.RepairStatus)}</td>
                          <td className="py-3 md:py-5 px-3 md:px-4 whitespace-normal break-words">
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {item.NOKParameters?.length > 0 ? (
                                item.NOKParameters.map((nok, i) => (
                                  <span key={i} className="text-[9px] bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded font-bold uppercase tracking-wide inline-block">
                                    {nok}
                                  </span>
                                ))
                              ) : (
                                <span className="text-gray-300 font-medium italic text-xs">-</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 md:py-5 px-3 md:px-4 text-xs md:text-sm font-medium text-gray-600 whitespace-normal break-words leading-relaxed max-w-xs">
                            {item.ActionPlan ? (
                              <span className="bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100 block italic">
                                "{item.ActionPlan}"
                              </span>
                            ) : (
                              <span className="text-gray-300 italic font-medium ml-1">-</span>
                            )}
                          </td>
                          <td className="py-3 md:py-5 px-3 md:px-4 text-xs md:text-sm font-bold text-gray-700">{item.ActionPlan ? formatDate(item.RepairDueDate) : "-"}</td>
                          <td className="py-3 md:py-5 px-3 md:px-4 text-[10px] font-black uppercase tracking-wider text-gray-700">
                            {item.ActionPlan ? getTimelineStatus(item.RepairDueDate, item.RepairStatus) : "-"}
                          </td>
                          <td className="py-3 md:py-5 px-3 md:px-4 text-center">
                            {displayStatus === "assigned" && (
                              <Link
                                href={`/dashboard/repair/action-plan/${item.ID}`}
                                className="inline-block text-center px-2 py-1 md:px-4 md:py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[9px] md:text-[10px] font-black uppercase tracking-wider rounded w-full transition-all"
                              >
                                Isi Action Plan
                              </Link>
                            )}
                            {displayStatus === "in_progress" && (
                              <Link
                                href={`/dashboard/repair/submit/${item.ID}`}
                                className="inline-block text-center px-2 py-1 md:px-4 md:py-1.5 bg-[#003d7a] hover:bg-[#002d5a] text-white text-[9px] md:text-[10px] font-black uppercase tracking-wider rounded w-full transition-all"
                              >
                                Submit Bukti
                              </Link>
                            )}
                            {displayStatus === "rejected" && rejectedRoute && (
                              <div className="flex flex-col gap-1.5 items-center w-full">
                                <Link
                                  href={rejectedRoute.href}
                                  className="inline-block text-center px-2 py-1 md:px-4 md:py-1.5 bg-red-600 hover:bg-red-700 text-white text-[9px] md:text-[10px] font-black uppercase tracking-wider rounded w-full transition-all"
                                >
                                  {rejectedRoute.label}
                                </Link>
                                <button
                                  onClick={() => handleOpenViewDetail(item.ID)}
                                  className="text-[9px] font-black text-gray-400 uppercase tracking-widest hover:text-red-600 transition-colors cursor-pointer mt-0.5"
                                >
                                  Lihat Catatan Reject
                                </button>
                              </div>
                            )}
                            {!["assigned", "in_progress", "waiting_verification", "rejected"].includes(displayStatus) && (
                              <button
                                onClick={() => handleOpenViewDetail(item.ID)}
                                className="px-2 py-1 md:px-4 md:py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[9px] md:text-[10px] font-black uppercase tracking-wider rounded w-full transition-all cursor-pointer"
                              >
                                Detail Log
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-xs md:text-sm font-bold text-gray-400">Tidak ditemukan records order perbaikan.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === "history" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-3 md:p-5 border-b border-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#f8fafd]">
            <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Total: {historyTotal} perbaikan sarpras</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[800px] md:min-w-full w-full text-left">
              <thead>
                <tr className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                  <th className="py-3 md:py-5 px-3 md:px-6 text-center w-14">No</th>
                  <th className="py-3 md:py-5 px-3 md:px-4">Nama Sarpras</th>
                  <th className="py-3 md:py-5 px-3 md:px-4">Departemen</th>
                  <th className="py-3 md:py-5 px-3 md:px-4 text-center">Status</th>
                  <th className="py-3 md:py-5 px-3 md:px-4">Action Plan</th>
                  <th className="py-3 md:py-5 px-3 md:px-4">Due Date</th>
                  <th className="py-3 md:py-5 px-3 md:px-4 text-center">Aksi</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {historyLoading ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-xs md:text-sm font-bold text-gray-400 animate-pulse">Memuat riwayat...</td>
                  </tr>
                ) : picHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-xs md:text-sm font-bold text-gray-400">Belum ada riwayat perbaikan selesai.</td>
                  </tr>
                ) : (
                  picHistory.map((item, idx) => {
                    const rowNum = (historyPage - 1) * PAGE_SIZE + idx + 1;
                    return (
                      <tr key={item.ID} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 md:py-5 px-3 md:px-6 text-xs md:text-sm font-bold text-gray-900 text-center">{rowNum}</td>
                        <td className="py-3 md:py-5 px-3 md:px-4">
                          <p className="text-xs md:text-sm font-bold text-gray-900">{item.SarprasName}</p>
                          <span className="inline-block text-[10px] font-bold text-gray-400">{item.SarprasCode}</span>
                        </td>
                        <td className="py-3 md:py-5 px-3 md:px-4 text-xs md:text-sm font-bold text-gray-600">{item.DepartmentName}</td>
                        <td className="py-3 md:py-5 px-3 md:px-4 text-center">{getStatusBadge(item.RepairStatus)}</td>
                        <td className="py-3 md:py-5 px-3 md:px-4 text-xs md:text-sm font-medium text-gray-600 max-w-xs">
                          {item.ActionPlan ? <span className="bg-gray-50 px-2 py-1 rounded border border-gray-100">"{item.ActionPlan}"</span> : "-"}
                        </td>
                        <td className="py-3 md:py-5 px-3 md:px-4 text-xs md:text-sm font-bold text-gray-700">{item.RepairDueDate ? formatDate(item.RepairDueDate) : "-"}</td>
                        <td className="py-3 md:py-5 px-3 md:px-4 text-center">
                          <button onClick={() => handleOpenViewDetail(item.ID)} className="px-2 py-1 md:px-4 md:py-1.5 bg-[#003d7a] hover:bg-[#002d5a] text-white text-[9px] md:text-[10px] font-black uppercase tracking-wider rounded transition-all">
                            Detail
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {historyTotalPages > 1 && (
            <div className="p-4 md:p-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs border-t border-gray-50 bg-white">
              <p className="font-bold text-gray-400">Page {historyPage} of {historyTotalPages}</p>
              <div className="flex gap-2">
                <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1} className="p-1.5 md:p-2 border rounded hover:bg-gray-50 disabled:opacity-20 uppercase font-black text-[9px] md:text-[10px]">Prev</button>
                <button onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p + 1))} disabled={historyPage === historyTotalPages} className="p-1.5 md:p-2 border rounded hover:bg-gray-50 disabled:opacity-20 uppercase font-black text-[9px] md:text-[10px]">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "monitoring" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-3 md:p-5 border-b border-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#f8fafd]">
              <div className="flex items-center gap-3">
                <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Filter Departemen:</span>
                <select
                  value={monitoringDept ?? 'all'}
                  onChange={(e) => setMonitoringDept(e.target.value === 'all' ? null : Number(e.target.value))}
                  className="bg-white border border-gray-200 rounded-md px-2 py-1 md:px-4 md:py-1.5 text-[10px] md:text-xs font-bold text-gray-700 outline-none"
                >
                  <option value="all">Semua Departemen</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => setMonitoringDept(null)}
                className="text-[10px] md:text-[11px] font-bold text-[#003d7a] hover:underline uppercase tracking-wider"
              >
                Reset
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[800px] md:min-w-full w-full text-left">
                <thead>
                  <tr className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                    <th className="py-3 md:py-4 px-3 md:px-4">No</th>
                    <th className="py-3 md:py-4 px-3 md:px-4">Kode Sarpras</th>
                    <th className="py-3 md:py-4 px-3 md:px-4">Nama Sarpras</th>
                    <th className="py-3 md:py-4 px-3 md:px-4">Departemen</th>
                    <th className="py-3 md:py-4 px-3 md:px-4">PIC</th>
                    <th className="py-3 md:py-4 px-3 md:px-4">Action Plan</th>
                    <th className="py-3 md:py-4 px-3 md:px-4 text-center">
                      Due Date
                    </th>

                    <th className="py-3 md:py-4 px-3 md:px-4 text-center">
                      Timeline
                    </th>
                    <th className="py-3 md:py-4 px-3 md:px-4 text-center">Status</th>
                    <th className="py-3 md:py-4 px-3 md:px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {repairMonitoring.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-xs md:text-sm font-bold text-gray-400">
                        Tidak ada perbaikan yang perlu dimonitoring.
                      </td>
                    </tr>
                  ) : (
                    repairMonitoring.map((item, index) => {
                      let displayStatus = item.repair_status;
                      if (displayStatus === "submitted" || displayStatus === "in_review") displayStatus = "waiting_verification";
                      return (
                        <tr key={item.repair_order_id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 md:py-4 px-3 md:px-4 text-xs md:text-sm font-semibold text-gray-600">
                            {(index + 1)}
                          </td>
                          <td className="py-3 md:py-4 px-3 md:px-4 text-xs md:text-sm font-bold text-[#003d7a]">{item.sarpras_code}</td>
                          <td className="py-3 md:py-4 px-3 md:px-4 text-xs md:text-sm font-bold text-gray-800">{item.sarpras_name}</td>
                          <td className="py-3 md:py-4 px-3 md:px-4 text-xs md:text-sm font-bold text-gray-600">{item.pic_department}</td>
                          <td className="py-3 md:py-4 px-3 md:px-4 text-xs md:text-sm text-gray-600">{item.pic_name || "-"}</td>
                          <td className="py-3 md:py-4 px-3 md:px-4 text-xs md:text-sm text-gray-500 max-w-xs truncate">{item.action_plan || "-"}</td>
                          <td className="py-3 md:py-5 px-3 md:px-4 text-center text-xs font-semibold">
                            {item.due_date
                              ? new Date(item.due_date).toLocaleDateString("id-ID")
                              : "-"}
                          </td>

                          <td className="py-3 md:py-5 px-3 md:px-4 text-[10px] font-black uppercase tracking-wider text-center">
                            {item.action_plan
                              ? getTimelineStatus(item.due_date, item.repair_status)
                              : "-"}
                          </td>
                          <td className="py-3 md:py-4 px-3 md:px-4 text-center">
                            {getStatusBadge(displayStatus)}
                          </td>
                          <td className="py-3 md:py-4 px-3 md:px-4 text-center">
                            <button
                              onClick={() => handleOpenViewDetail(item.repair_order_id)}
                              className="px-2 py-1 md:px-4 md:py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[9px] md:text-[10px] font-black uppercase tracking-wider rounded transition-all cursor-pointer"
                            >
                              Detail
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "allHistory" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-3 md:p-5 border-b border-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#f8fafd]">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Filter:</span>
              <select
                value={allHistoryDeptFilter ?? ''}
                onChange={(e) => { setAllHistoryDeptFilter(e.target.value ? Number(e.target.value) : null); setAllHistoryPage(1); }}
                className="bg-white border border-gray-200 rounded-md px-2 py-1 md:px-4 md:py-1.5 text-[10px] md:text-xs font-bold text-gray-700 outline-none"
              >
                <option value="">Semua Departemen</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cari kode/nama sarpras..."
                  value={allHistorySearch}
                  onChange={(e) => { setAllHistorySearch(e.target.value); setAllHistoryPage(1); }}
                  className="pl-8 pr-4 py-1.5 md:py-2 text-[10px] md:text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-md outline-none w-56 md:w-64"
                />
                <svg className="w-3.5 h-3.5 md:w-4 md:h-4 absolute left-2.5 top-2 md:top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <button
                onClick={() => { setAllHistoryDeptFilter(null); setAllHistorySearch(""); setAllHistoryPage(1); }}
                className="text-[10px] md:text-[11px] font-bold text-[#003d7a] hover:underline uppercase tracking-wider"
              >
                Reset
              </button>
            </div>
            <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Total: {allHistoryTotal} perbaikan</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[800px] md:min-w-full w-full text-left">
              <thead>
                <tr className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                  <th className="py-3 md:py-4 px-3 md:px-4 w-14">No</th>
                  <th className="py-3 md:py-4 px-3 md:px-4">Sarpras</th>
                  <th className="py-3 md:py-4 px-3 md:px-4">Departemen PIC</th>
                  <th className="py-3 md:py-4 px-3 md:px-4">PIC</th>
                  <th className="py-3 md:py-4 px-3 md:px-4 text-center">Status</th>
                  <th className="py-3 md:py-4 px-3 md:px-4">Action Plan</th>
                  <th className="py-3 md:py-4 px-3 md:px-4">Perbaikan Selesai</th>
                  <th className="py-3 md:py-4 px-3 md:px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {allHistoryLoading ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-xs md:text-sm font-bold text-gray-400 animate-pulse">Memuat riwayat...</td>
                  </tr>
                ) : allHistoryData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-xs md:text-sm font-bold text-gray-400">Belum ada perbaikan selesai.</td>
                  </tr>
                ) : (
                  allHistoryData.map((item, idx) => {
                    const rowNum = (allHistoryPage - 1) * PAGE_SIZE + idx + 1;
                    let displayStatus = item.repair_status;
                    if (displayStatus === "submitted" || displayStatus === "in_review") displayStatus = "waiting_verification";
                    return (
                      <tr key={item.repair_order_id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 md:py-4 px-3 md:px-4 text-xs md:text-sm font-bold text-gray-900">{rowNum}</td>
                        <td className="py-3 md:py-4 px-3 md:px-4">
                          <p className="text-xs md:text-sm font-bold text-gray-900">{item.sarpras_name}</p>
                          <span className="inline-block text-[10px] font-bold text-gray-400">{item.sarpras_code}</span>
                        </td>
                        <td className="py-3 md:py-4 px-3 md:px-4 text-xs md:text-sm font-bold text-gray-600">{item.pic_department}</td>
                        <td className="py-3 md:py-4 px-3 md:px-4 text-xs md:text-sm text-gray-600">{item.pic_name || "-"}</td>
                        <td className="py-3 md:py-4 px-3 md:px-4 text-center">{getStatusBadge(displayStatus)}</td>
                        <td className="py-3 md:py-4 px-3 md:px-4 text-xs md:text-sm text-gray-500 max-w-xs truncate">{item.action_plan || "-"}</td>
                        <td className="py-3 md:py-4 px-3 md:px-4 text-xs md:text-sm font-bold text-gray-700">{item.created_at ? formatDate(item.created_at) : "-"}</td>
                        <td className="py-3 md:py-4 px-3 md:px-4 text-center">
                          <button
                            onClick={() => handleOpenViewDetail(item.repair_order_id)}
                            className="px-2 py-1 md:px-4 md:py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[9px] md:text-[10px] font-black uppercase tracking-wider rounded transition-all cursor-pointer"
                          >
                            Detail
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {Math.ceil(allHistoryTotal / PAGE_SIZE) > 1 && (
            <div className="p-4 md:p-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs border-t border-gray-50 bg-white">
              <p className="font-bold text-gray-400">Page {allHistoryPage} of {Math.ceil(allHistoryTotal / PAGE_SIZE)}</p>
              <div className="flex gap-2">
                <button onClick={() => setAllHistoryPage(p => Math.max(1, p - 1))} disabled={allHistoryPage === 1} className="p-1.5 md:p-2 border rounded hover:bg-gray-50 disabled:opacity-20 uppercase font-black text-[9px] md:text-[10px]">Prev</button>
                <button onClick={() => setAllHistoryPage(p => Math.min(Math.ceil(allHistoryTotal / PAGE_SIZE), p + 1))} disabled={allHistoryPage === Math.ceil(allHistoryTotal / PAGE_SIZE)} className="p-1.5 md:p-2 border rounded hover:bg-gray-50 disabled:opacity-20 uppercase font-black text-[9px] md:text-[10px]">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {isViewDetailModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl overflow-hidden border-t-[4px] border-[#003d7a] flex flex-col max-h-[92vh]">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-base font-black text-slate-800 uppercase tracking-wider">Detail Riwayat Perbaikan</h3>
                {selectedDetail && (
                  <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                    {selectedDetail.sarpras_name} ({selectedDetail.sarpras_code})
                  </p>
                )}
              </div>
              <button onClick={() => setIsViewDetailModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 cursor-pointer">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex gap-4 px-6 pt-4 border-b border-gray-100">
              <button
                onClick={() => setDetailModalTab("detail")}
                className={`pb-2 text-xs font-bold uppercase transition-colors ${detailModalTab === "detail" ? "text-[#003d7a] border-b-2 border-[#003d7a]" : "text-gray-400"}`}
              >
                Detail Perbaikan
              </button>
              <button
                onClick={() => {
                  setDetailModalTab("reviewHistory");
                  if (selectedDetail && reviewHistory.length === 0) fetchReviewHistory(selectedDetail.repair_order_id, 1);
                }}
                className={`pb-2 text-xs font-bold uppercase transition-colors ${detailModalTab === "reviewHistory" ? "text-[#003d7a] border-b-2 border-[#003d7a]" : "text-gray-400"}`}
              >
                Riwayat Review
              </button>
            </div>

            <div className="p-6 overflow-y-auto bg-slate-50/50 flex-1 space-y-6">
              {isModalLoading ? (
                <div className="text-center py-16 font-bold text-slate-400 uppercase tracking-widest animate-pulse">Memuat data log perbaikan...</div>
              ) : (
                <>
                  {detailModalTab === "detail" && selectedDetail && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm space-y-4">
                        <h4 className="text-[10px] font-black text-red-600 uppercase border-b pb-2 tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-2.5 bg-red-500 rounded-sm" />Kondisi Temuan (Before)
                        </h4>
                        <div className="space-y-3">
                          {selectedDetail.nok_details?.map((nok, idx) => {
                            const fileName = nok.photo_url.split("/").pop();
                            return (
                              <div key={idx} className="flex gap-3 items-start bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <div className="w-24 shrink-0 flex flex-col items-center">
                                  <img
                                    src={`${process.env.NEXT_PUBLIC_MINIO_URL}/emertrack/${nok.photo_url.split("/").map((p) => encodeURIComponent(p)).join("/")}`}
                                    alt="NOK"
                                    className="w-24 h-24 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity border"
                                    onClick={() => setPreviewImage(`${process.env.NEXT_PUBLIC_MINIO_URL}/emertrack/${nok.photo_url.split("/").map((p) => encodeURIComponent(p)).join("/")}`)}
                                  />
                                  <p className="mt-1.5 text-[9px] font-bold text-slate-400 break-all text-center line-clamp-1 w-full">{fileName}</p>
                                </div>
                                <div className="flex-1 space-y-1">
                                  <p className="text-xs font-black text-slate-800">{nok.parameter_name}</p>
                                  <p className="text-[11px] text-slate-500 italic bg-white p-2.5 rounded-lg border shadow-sm">"{nok.notes || "Tanpa catatan tambahan"}"</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm space-y-4 flex flex-col justify-between min-h-[300px]">
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-black text-emerald-600 uppercase border-b pb-2 tracking-wider flex items-center gap-1">
                            <span className="w-1.5 h-2.5 bg-emerald-500 rounded-sm" />Hasil Perbaikan (After)
                          </h4>
                          {selectedDetail.submissions?.length > 1 && (
                            <div className="mb-4">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Riwayat Perbaikan (Attempt):</label>
                              <select
                                value={selectedAttempt}
                                onChange={(e) => setSelectedAttempt(Number(e.target.value))}
                                className="ml-2 text-xs border rounded px-2 py-1 bg-white"
                              >
                                {selectedDetail.submissions.map((sub: any) => (
                                  <option key={sub.id} value={sub.attempt}>
                                    Perbaikan #{sub.attempt} - {
                                      sub.verdict ? (sub.verdict === "approve" ? "✅ Disetujui" : "❌ Ditolak") :
                                      (sub.status === "submitted" ? "⏳ Menunggu Review" : sub.status)
                                    }
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          {(() => {
                            const activeSub = getActiveSubmission();
                            if (!activeSub) return <p className="text-xs text-gray-400 italic">Tidak ada data perbaikan.</p>;
                            return (
                              <>
                                <div>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Action Plan Terlaksana:</p>
                                  <p className="text-xs text-slate-700 mt-1 bg-slate-50 p-3 rounded-xl border border-slate-100 font-medium">
                                    "{activeSub.action_plan || "(kosong)"}"
                                  </p>
                                </div>
                        
                                {(activeSub.feedback || selectedDetail.reviewer_feedback) && (
                                  <div className={`p-3 rounded-xl border text-xs space-y-1 ${
                                    selectedDetail.status.toLowerCase() === "rejected"
                                      ? "bg-red-50/50 border-red-100 text-red-800"
                                      : "bg-blue-50/40 border-blue-100 text-slate-700"
                                  }`}>
                                    <span className="text-[9px] font-black uppercase tracking-wider block opacity-70">
                                      Catatan Reviewer (Feedback):
                                    </span>
                                    <p className="font-semibold italic">" {activeSub.feedback || selectedDetail.reviewer_feedback} "</p>

                                    {(activeSub.review_attachments ?? []).length > 0 && (
                                      <div className="mt-3 pt-3 border-t border-red-100/60">
                                        <p className="text-[9px] font-black uppercase tracking-wider opacity-70 mb-2">
                                          Lampiran Reviewer:
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                          {(activeSub.review_attachments ?? []).map((path: string, idx: number) => {
                                            const isPDF = path.toLowerCase().endsWith('.pdf');
                                            const url = `${process.env.NEXT_PUBLIC_MINIO_URL}/emertrack/${path.split('/').map(encodeURIComponent).join('/')}`;
                                            const fileName = path.split('/').pop();
                                            return isPDF ? (
                                              <a
                                                key={idx}
                                                href={url}
                                                target="_blank"
                                                className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition"
                                              >
                                                <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                  <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                                                </svg>
                                                <span className="truncate max-w-[100px]">{fileName}</span>
                                              </a>
                                            ) : (
                                              <div key={idx} className="flex flex-col items-center">
                                                <img
                                                  src={url}
                                                  alt="Lampiran reviewer"
                                                  className="w-16 h-16 object-cover rounded-lg cursor-pointer border border-red-200 hover:opacity-80 hover:shadow-md transition-all"
                                                  onClick={() => setPreviewImage(url)}
                                                />
                                                <p className="mt-1 text-[8px] text-slate-400 truncate max-w-[64px] text-center">{fileName}</p>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                                <div>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Foto Bukti Perbaikan (Evidence):</p>
                                  <div className="flex flex-wrap gap-3">
                                    {activeSub.evidences?.length > 0 ? (
                                      activeSub.evidences.map((ev, idx) => {
                                        const fileName = ev.split("/").pop();
                                        const isPDF = ev.toLowerCase().endsWith(".pdf");
                                        return (
                                          <div key={idx} className="w-24 flex flex-col items-center">
                                            {isPDF ? (
                                              <a
                                                href={`${process.env.NEXT_PUBLIC_MINIO_URL}/emertrack/${ev}`}
                                                target="_blank"
                                                className="w-24 h-24 bg-blue-50 flex flex-col items-center justify-center rounded-lg border border-blue-100 text-blue-600 hover:bg-blue-100 shadow-sm transition-colors"
                                              >
                                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" /></svg>
                                                <span className="text-[8px] font-black mt-1.5 uppercase tracking-wider">Buka PDF</span>
                                              </a>
                                            ) : (
                                              <img
                                                src={`${process.env.NEXT_PUBLIC_MINIO_URL}/emertrack/${ev.split("/").map((p) => encodeURIComponent(p)).join("/")}`}
                                                alt="Evidence"
                                                className="w-24 h-24 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity border"
                                                onClick={() => setPreviewImage(`${process.env.NEXT_PUBLIC_MINIO_URL}/emertrack/${ev.split("/").map((p) => encodeURIComponent(p)).join("/")}`)}
                                              />
                                            )}
                                            <p className="mt-1 text-[9px] font-bold text-slate-400 break-all text-center line-clamp-1 w-full">{fileName}</p>
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <p className="text-xs text-slate-400 italic">Tidak ada bukti yang diunggah untuk attempt ini.</p>
                                    )}
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                        <div className="pt-4 border-t border-slate-100 mt-6">
                          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 grid grid-cols-3 gap-2 items-center">
                            <div>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Status Akhir:</span>
                              {getStatusBadge(selectedDetail.status)}
                            </div>
                            <div className="text-center border-x border-slate-200/80 px-2">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">PIC Lapangan:</span>
                              <p className="text-xs font-black text-slate-700 truncate" title={selectedDetail.pic_name}>{selectedDetail.pic_name || "-"}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Reviewer/QS:</span>
                              <p className="text-xs font-black text-[#003d7a] truncate" title={selectedDetail.reviewer_name}>{selectedDetail.reviewer_name || "Belum Direview"}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {detailModalTab === "reviewHistory" && (
                    <div className="space-y-3">
                      {reviewHistoryLoading ? (
                        <div className="text-center py-8 text-gray-400 text-xs font-bold animate-pulse">Memuat riwayat review...</div>
                      ) : reviewHistory.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-xs font-semibold italic">Belum ada riwayat review.</div>
                      ) : (
                        reviewHistory.map((review) => (
                          <div key={review.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${review.verdict === "approve" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                                  {review.verdict === "approve" ? "Disetujui" : "Ditolak"}
                                </span>
                                <p className="text-xs text-gray-500 mt-2">Reviewer: <span className="font-bold text-slate-700">{review.reviewer_name || "-"}</span></p>
                              </div>
                              <span className="text-[10px] text-gray-400">{formatDate(review.reviewed_at)}</span>
                            </div>
                            {review.feedback && (
                              <p className="text-xs text-slate-600 mt-3 italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                "{review.feedback}"
                              </p>
                            )}
                          </div>
                        ))
                      )}
                      {reviewHistoryTotalPages > 1 && (
                        <div className="flex justify-between items-center mt-4">
                          <button
                            disabled={reviewHistoryPage === 1}
                            onClick={() => {
                              const newPage = reviewHistoryPage - 1;
                              setReviewHistoryPage(newPage);
                              if (selectedDetail) fetchReviewHistory(selectedDetail.repair_order_id, newPage);
                            }}
                            className="text-xs border px-3 py-1 rounded disabled:opacity-30"
                          >
                            Prev
                          </button>
                          <span className="text-xs text-gray-500">Halaman {reviewHistoryPage} dari {reviewHistoryTotalPages}</span>
                          <button
                            disabled={reviewHistoryPage >= reviewHistoryTotalPages}
                            onClick={() => {
                              const newPage = reviewHistoryPage + 1;
                              setReviewHistoryPage(newPage);
                              if (selectedDetail) fetchReviewHistory(selectedDetail.repair_order_id, newPage);
                            }}
                            className="text-xs border px-3 py-1 rounded disabled:opacity-30"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-white flex justify-end">
              <button
                onClick={() => setIsViewDetailModalOpen(false)}
                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase transition-colors cursor-pointer border"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[85vh] w-full flex justify-center items-center">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-12 right-0 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-2 cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}