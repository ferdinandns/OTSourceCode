'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, API_BASE } from '@/lib/api';
import { useWebSocket } from '@/hooks/useWebsocket';

interface ReviewRow {
  RepairOrderID: number;
  SarprasCode: string;
  SarprasName: string;
  Department: string;
  NOKParameters: string[];
  PICName: string;
  RepairStatus: string;        
  SubmittedAt: string | null;
  is_my_review: boolean;
}

interface ReviewSummary {
  approved: number;
  rejected: number;
  in_review: number;
  waiting_review: number;
}

interface ReviewHistoryItem {
  review_id: number;
  repair_order_id: number;
  sarpras_code: string;
  sarpras_name: string;
  department_name: string;
  verdict: 'approve' | 'reject';
  feedback: string;
  reviewed_at: string;
  reviewer_name: string;
  repair_status: string;
}

interface NOKDetail {
  parameter_name: string;
  notes: string;
  photo_url: string;
}

interface ReviewHistoryDetail {
  review_id: number;
  repair_order_id: number;
  sarpras_code: string;
  sarpras_name: string;
  department_name: string;
  verdict: 'approve' | 'reject';
  feedback: string;
  reviewed_at: string;
  reviewer_name: string;
  repair_status: string;
  action_plan: string;
  evidence_paths: string[];
  nok_details?: NOKDetail[];
}

export default function ReviewPage() {
  const router = useRouter();
  const [items, setItems] = useState<ReviewRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState<number | null>(null);
  const [summary, setSummary] = useState<ReviewSummary>({
    approved: 0,
    rejected: 0,
    in_review: 0,
    waiting_review: 0,
  });

  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [historyData, setHistoryData] = useState<ReviewHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyVerdictFilter, setHistoryVerdictFilter] = useState('');
  const [historySummary, setHistorySummary] = useState({ approved: 0, rejected: 0 });

  const [selectedDetail, setSelectedDetail] = useState<ReviewHistoryDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const pageSize = 10;

  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const mapRepairStatus = (status: string): string => {
    const s = status.toLowerCase();
    if (s === 'submitted') return 'waiting_review';
    return s;
  };

  const fetchReviews = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/reviews`);
      const json = await res.json();
      if (json.success) {
        setItems(json.data.data || []);
        setSummary(json.data.summary || { approved: 0, rejected: 0, in_review: 0, waiting_review: 0 });
      }
    } catch (err) {
      console.error('Gagal memuat list review', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', historyPage.toString());
      params.append('page_size', pageSize.toString());
      if (historyVerdictFilter) params.append('verdict', historyVerdictFilter);
      const res = await apiFetch(`${API_BASE}/reviews/history/qs?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        const data = json.data.data || [];
        setHistoryData(data);
        setHistoryTotal(json.data.total || 0);
        const approved = data.filter((item: ReviewHistoryItem) => item.verdict === 'approve').length;
        const rejected = data.filter((item: ReviewHistoryItem) => item.verdict === 'reject').length;
        setHistorySummary({ approved, rejected });
      }
    } catch (err) {
      console.error('Gagal memuat riwayat review', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPage, historyVerdictFilter]);

  const handleExportPDF = async () => {
    try {
      const params = new URLSearchParams();
      if (historyVerdictFilter) params.append('verdict', historyVerdictFilter);
      const res = await apiFetch(`${API_BASE}/reviews/history/export-pdf?${params.toString()}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `review_history_${new Date().toISOString().slice(0,10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('Gagal mengekspor riwayat');
    }
  };

  const fetchActiveRef = useRef(fetchReviews);
  const fetchHistoryRef = useRef(fetchHistory);
  useEffect(() => {
    fetchActiveRef.current = fetchReviews;
  }, [fetchReviews]);
  useEffect(() => {
    fetchHistoryRef.current = fetchHistory;
  }, [fetchHistory]);

  useWebSocket({
    'DATA_UPDATED': () => {
      if (activeTabRef.current === 'active') {
        fetchActiveRef.current();
      } else if (activeTabRef.current === 'history') {
        fetchHistoryRef.current();
      }
    },
  });

  useEffect(() => {
    if (activeTab === 'active') fetchReviews();
  }, [fetchReviews, activeTab]);

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
  }, [fetchHistory, activeTab]);

  const handleOpenReview = async (repairOrderID: number) => {
    setIsClaiming(repairOrderID);
    try {
      const claimRes = await apiFetch(
        `${API_BASE}/reviews/${repairOrderID}/claim`,
        { method: 'POST' }
      );
      if (!claimRes.ok) {
        const errJson = await claimRes.json();
        alert(errJson.message || 'Gagal meng-claim, mungkin sedang di-review oleh QS lain.');
        fetchReviews();
        return;
      }
      router.push(`/dashboard/reviews/${repairOrderID}`);
    } catch {
      alert('Terjadi kesalahan jaringan.');
    } finally {
      setIsClaiming(null);
    }
  };

  const fetchReviewDetail = async (reviewId: number) => {
    setIsDetailLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/reviews/${reviewId}/history`);
      const json = await res.json();
      if (json.success) {
        setSelectedDetail(json.data);
        setShowDetailModal(true);
      } else {
        alert(json.message || 'Gagal memuat detail review');
      }
    } catch (err) {
      console.error('Gagal fetch detail review', err);
      alert('Terjadi kesalahan saat memuat detail');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) =>
    dateStr
      ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
          .format(new Date(dateStr))
          .replace(/\//g, '-')
      : '-';

  const getRepairStatusBadge = (status: string) => {
    const mapped = mapRepairStatus(status);
    const cfg: Record<string, string> = {
      waiting_review: 'bg-slate-100 text-slate-600',
      in_review:      'bg-amber-100 text-amber-700',
      approved:       'bg-emerald-100 text-emerald-700',
      rejected:       'bg-red-100 text-red-600',
    };
    let label = '';
    if (mapped === 'waiting_review') label = 'Waiting For Review';
    else if (mapped === 'in_review') label = 'In Review';
    else if (mapped === 'approved') label = 'Approved';
    else if (mapped === 'rejected') label = 'Rejected';
    else label = status;
    return (
      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${cfg[mapped] || 'bg-gray-100 text-gray-400'}`}>
        {label}
      </span>
    );
  };

  const getVerdictBadge = (verdict: string) => {
    const cfg: Record<string, string> = {
      approve: 'bg-emerald-100 text-emerald-700',
      reject:  'bg-red-100 text-red-600',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${cfg[verdict] || 'bg-gray-100 text-gray-400'}`}>
        {verdict === 'approve' ? 'Disetujui' : 'Ditolak'}
      </span>
    );
  };

  const historyTotalPages = Math.ceil(historyTotal / pageSize);
  const totalWaitingInReview = summary.waiting_review + summary.in_review;
  const waitingPercent = totalWaitingInReview > 0 ? (summary.waiting_review / totalWaitingInReview) * 100 : 0;
  const inReviewPercent = totalWaitingInReview > 0 ? (summary.in_review / totalWaitingInReview) * 100 : 0;
  const totalApprovedRejected = summary.approved + summary.rejected;
  const approvedPercent = totalApprovedRejected > 0 ? (summary.approved / totalApprovedRejected) * 100 : 0;
  const rejectedPercent = totalApprovedRejected > 0 ? (summary.rejected / totalApprovedRejected) * 100 : 0;

  return (
    <div className="space-y-6 md:space-y-8 pb-8 md:pb-10 px-4 md:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm mb-5 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
            Verifikasi Perbaikan
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Daftar perbaikan sarpras yang menunggu verifikasi QS.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 sm:gap-6 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('active')}
          className={`pb-2 sm:pb-3 px-1 sm:px-2 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all ${activeTab === 'active' ? 'border-b-2 border-[#003d7a] text-[#003d7a]' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Tugas Aktif
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-2 sm:pb-3 px-1 sm:px-2 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all ${activeTab === 'history' ? 'border-b-2 border-[#003d7a] text-[#003d7a]' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Riwayat Review Saya
        </button>
      </div>

      {activeTab === 'active' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-4">
            <div className="bg-white p-3 md:p-6 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden flex flex-col justify-between h-[90px] md:h-[130px]">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] md:w-[4px]" style={{ backgroundColor: '#3c8dbc' }} />
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[8px] md:text-[9px] font-black text-gray-400 tracking-widest uppercase">Waiting For Review</p>
                  <h3 className="text-lg md:text-2xl font-black text-gray-900 mt-1">{summary.waiting_review}</h3>
                </div>
                <div className="w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-white text-[8px] md:text-[10px] font-black" style={{ backgroundColor: '#3c8dbc' }}>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                </div>
              </div>
              <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                <div className="h-full transition-all duration-700" style={{ backgroundColor: '#3c8dbc', width: `${waitingPercent}%` }} />
              </div>
            </div>

            <div className="bg-white p-3 md:p-6 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden flex flex-col justify-between h-[90px] md:h-[130px]">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] md:w-[4px]" style={{ backgroundColor: '#f39c12' }} />
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[8px] md:text-[9px] font-black text-gray-400 tracking-widest uppercase">In Review</p>
                  <h3 className="text-lg md:text-2xl font-black text-gray-900 mt-1">{summary.in_review}</h3>
                </div>
                <div className="w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-white text-[8px] md:text-[10px] font-black" style={{ backgroundColor: '#f39c12' }}>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                </div>
              </div>
              <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                <div className="h-full transition-all duration-700" style={{ backgroundColor: '#f39c12', width: `${inReviewPercent}%` }} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-3 md:p-5 border-b border-gray-50 bg-[#f8fafd] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 w-full">
                <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Filter By:</span>
                <div className="relative w-full sm:w-64">
                  <input type="text" placeholder="Cari kode sarpras..." className="pl-3 pr-9 py-1.5 md:py-2 rounded-md border border-gray-200 text-[10px] md:text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-[#003d7a] w-full" />
                  <svg className="w-3.5 h-3.5 absolute right-2.5 top-2 md:top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <select className="bg-white border border-gray-200 rounded-md px-2 py-1 md:px-4 md:py-1.5 text-[10px] md:text-xs font-bold text-gray-700 outline-none w-full sm:w-auto">
                  <option>All Statuses</option>
                  <option>Waiting For Review</option>
                  <option>In Review</option>
                </select>
              </div>
              <button className="w-full lg:w-auto flex justify-center items-center gap-1.5 text-[10px] md:text-[11px] font-bold text-[#003d7a] hover:underline uppercase tracking-wider">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reset Filters
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1000px] md:min-w-full w-full text-left">
                <thead>
                  <tr className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                    <th className="py-3 md:py-5 px-3 md:px-6 w-14">No</th>
                    <th className="py-3 md:py-5 px-3 md:px-4">Jenis Sarpras</th>
                    <th className="py-3 md:py-5 px-3 md:px-4 text-center">Nomor Sarpras</th>
                    <th className="py-3 md:py-5 px-3 md:px-4 text-center">Lokasi Departemen</th>
                    <th className="py-3 md:py-5 px-3 md:px-4 text-center">Parameter NOK</th>
                    <th className="py-3 md:py-5 px-3 md:px-4 text-center">PIC Perbaikan</th>
                    <th className="py-3 md:py-5 px-3 md:px-4 text-center">Submitted At</th>
                    <th className="py-3 md:py-5 px-3 md:px-4 text-center">Status Perbaikan</th>
                    <th className="py-3 md:py-5 px-3 md:px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {isLoading ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-xs md:text-sm font-bold text-gray-400 animate-pulse">Loading data...</td>
                    </tr>
                  ) : items.length > 0 ? (
                    items.map((item, index) => {
                      const mappedStatus = mapRepairStatus(item.RepairStatus);
                      if (mappedStatus !== 'waiting_review' && mappedStatus !== 'in_review') return null;
                      const isInReview = mappedStatus === 'in_review';
                      let buttonOnClick: () => void;
                      let buttonText: string;
                      let buttonDisabled: boolean;
                      let buttonClassName: string;

                      if (isInReview && item.is_my_review) {
                        buttonText = 'Lanjutkan Review';
                        buttonOnClick = () => router.push(`/dashboard/reviews/${item.RepairOrderID}`);
                        buttonDisabled = false;
                        buttonClassName = 'px-2 py-1 md:px-4 md:py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] md:text-[10px] font-black uppercase tracking-wider rounded transition-all';
                      } else if (isInReview && !item.is_my_review) {
                        buttonText = 'Sedang di-review';
                        buttonOnClick = () => {};
                        buttonDisabled = true;
                        buttonClassName = 'px-2 py-1 md:px-4 md:py-1.5 bg-gray-200 text-gray-400 cursor-not-allowed text-[9px] md:text-[10px] font-black uppercase tracking-wider rounded';
                      } else {
                        buttonText = 'Review';
                        buttonOnClick = () => void handleOpenReview(item.RepairOrderID);
                        buttonDisabled = isClaiming === item.RepairOrderID;
                        buttonClassName = 'px-2 py-1 md:px-4 md:py-1.5 bg-[#003d7a] hover:bg-[#002d5a] text-white text-[9px] md:text-[10px] font-black uppercase tracking-wider rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed';
                      }

                      return (
                        <tr key={item.RepairOrderID} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 md:py-5 px-3 md:px-6 text-xs md:text-sm font-bold text-gray-900">{index + 1}</td>
                          <td className="py-3 md:py-5 px-3 md:px-4 text-xs md:text-sm font-bold text-gray-900">{item.SarprasName}</td>
                          <td className="py-3 md:py-5 px-3 md:px-4 text-xs md:text-sm font-bold text-[#003d7a] text-center">{item.SarprasCode}</td>
                          <td className="py-3 md:py-5 px-3 md:px-4 text-xs md:text-sm font-bold text-gray-700 text-center">{item.Department}</td>
                          <td className="py-3 md:py-5 px-3 md:px-4 text-center">
                            <div className="flex flex-wrap gap-1 justify-center max-w-[140px] mx-auto">
                              {item.NOKParameters?.map((nok, i) => (
                                <span key={i} className="text-[9px] bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded font-bold uppercase tracking-wide">{nok}</span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 md:py-5 px-3 md:px-4 text-xs md:text-sm font-bold text-gray-700 text-center">{item.PICName || '-'}</td>
                          <td className="py-3 md:py-5 px-3 md:px-4 text-xs md:text-sm font-bold text-gray-500 text-center italic">{formatDate(item.SubmittedAt)}</td>
                          <td className="py-3 md:py-5 px-3 md:px-4 text-center">{getRepairStatusBadge(item.RepairStatus)}</td>
                          <td className="py-3 md:py-5 px-3 md:px-4 text-center">
                            <button onClick={buttonOnClick} disabled={buttonDisabled} className={buttonClassName}>
                              {buttonText}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-xs md:text-sm font-bold text-gray-400">Belum ada perbaikan yang perlu di-review.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'history' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-4">
            <div className="bg-white p-3 md:p-6 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden flex flex-col justify-between h-[90px] md:h-[130px]">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] md:w-[4px]" style={{ backgroundColor: '#00a65a' }} />
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[8px] md:text-[9px] font-black text-gray-400 tracking-widest uppercase">Approve</p>
                  <h3 className="text-lg md:text-2xl font-black text-gray-900 mt-1">{historySummary.approved}</h3>
                </div>
                <div className="w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-white text-[8px] md:text-[10px] font-black" style={{ backgroundColor: '#00a65a' }}>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                </div>
              </div>
              <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                <div className="h-full transition-all duration-700" style={{ backgroundColor: '#00a65a', width: `${approvedPercent}%` }} />
              </div>
            </div>

            <div className="bg-white p-3 md:p-6 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden flex flex-col justify-between h-[90px] md:h-[130px]">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] md:w-[4px]" style={{ backgroundColor: '#f56954' }} />
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[8px] md:text-[9px] font-black text-gray-400 tracking-widest uppercase">Reject</p>
                  <h3 className="text-lg md:text-2xl font-black text-gray-900 mt-1">{historySummary.rejected}</h3>
                </div>
                <div className="w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-white text-[8px] md:text-[10px] font-black" style={{ backgroundColor: '#f56954' }}>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                </div>
              </div>
              <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                <div className="h-full transition-all duration-700" style={{ backgroundColor: '#f56954', width: `${rejectedPercent}%` }} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-3 md:p-5 border-b border-gray-50 bg-[#f8fafd] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Filter Verdict:</span>
                <select
                  value={historyVerdictFilter}
                  onChange={(e) => { setHistoryVerdictFilter(e.target.value); setHistoryPage(1); }}
                  className="bg-white border border-gray-200 rounded-md px-2 py-1 md:px-4 md:py-1.5 text-[10px] md:text-xs font-bold text-gray-700 outline-none"
                >
                  <option value="">Semua</option>
                  <option value="approve">Approve</option>
                  <option value="reject">Reject</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Total: {historyTotal} review</span>
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 bg-blue-500 hover:bg-blue-600 text-white font-black text-[9px] md:text-[10px] uppercase tracking-wider rounded-lg shadow-sm transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export PDF
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[900px] md:min-w-full w-full text-left">
                <thead>
                  <tr className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                    <th className="py-3 md:py-4 px-3 md:px-4 text-center w-14">No</th>
                    <th className="py-3 md:py-4 px-3 md:px-4">Sarpras</th>
                    <th className="py-3 md:py-4 px-3 md:px-4">Departemen</th>
                    <th className="py-3 md:py-4 px-3 md:px-4 text-center">Keputusan</th>
                    <th className="py-3 md:py-4 px-3 md:px-4">Feedback</th>
                    <th className="py-3 md:py-4 px-3 md:px-4">Tanggal Review</th>
                    <th className="py-3 md:py-4 px-3 md:px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {historyLoading ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-xs md:text-sm font-bold text-gray-400 animate-pulse">Memuat riwayat...</td>
                    </tr>
                  ) : historyData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-xs md:text-sm font-bold text-gray-400">Belum ada riwayat review.</td>
                    </tr>
                  ) : (
                    historyData.map((item, idx) => {
                      const rowNum = (historyPage - 1) * pageSize + idx + 1;
                      return (
                        <tr key={item.review_id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 md:py-4 px-3 md:px-4 text-xs md:text-sm font-bold text-gray-900 text-center">{rowNum}</td>
                          <td className="py-3 md:py-4 px-3 md:px-4">
                            <p className="text-xs md:text-sm font-bold text-gray-900">{item.sarpras_name}</p>
                            <span className="inline-block text-[10px] font-bold text-gray-400">{item.sarpras_code}</span>
                          </td>
                          <td className="py-3 md:py-4 px-3 md:px-4 text-xs md:text-sm font-bold text-gray-600">{item.department_name}</td>
                          <td className="py-3 md:py-4 px-3 md:px-4 text-center">{getVerdictBadge(item.verdict)}</td>
                          <td className="py-3 md:py-4 px-3 md:px-4 text-xs md:text-sm text-gray-600 max-w-md line-clamp-2 italic">"{item.feedback || '-'}"</td>
                          <td className="py-3 md:py-4 px-3 md:px-4 text-xs md:text-sm text-gray-500">{formatDate(item.reviewed_at)}</td>
                          <td className="py-3 md:py-4 px-3 md:px-4 text-center">
                            <button
                              onClick={() => fetchReviewDetail(item.review_id)}
                              className="px-2 py-1 md:px-4 md:py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[9px] md:text-[10px] font-black uppercase tracking-wider rounded transition-all"
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
        </>
      )}
       {showDetailModal && selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-5xl w-full mx-auto my-8 max-h-[90vh] overflow-y-auto shadow-2xl border-t-4 border-t-[#003d7a]">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
              <div>
                <h3 className="text-lg font-black text-gray-800 tracking-tight">Detail Review QS</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selectedDetail.sarpras_name} ({selectedDetail.sarpras_code})
                </p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 bg-gray-50/30">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="bg-red-50 px-5 py-3 border-b border-red-100">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      <h4 className="text-xs font-black text-red-700 uppercase tracking-wider">Parameter NOK (Temuan)</h4>
                    </div>
                  </div>
                  <div className="p-5 space-y-4">
                    {selectedDetail.nok_details && selectedDetail.nok_details.length > 0 ? (
                      selectedDetail.nok_details.map((nok, idx) => {
                        const imageUrl = `${process.env.NEXT_PUBLIC_MINIO_URL}/emertrack/${nok.photo_url.split('/').map(encodeURIComponent).join('/')}`;
                        const fileName = nok.photo_url.split('/').pop();
                        return (
                          <div key={idx} className="flex gap-3 items-start bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <div className="w-24 shrink-0 flex flex-col items-center">
                              <img
                                src={imageUrl}
                                alt="NOK"
                                className="w-24 h-24 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity border"
                                onClick={() => window.open(imageUrl, '_blank')}
                              />
                              <p className="mt-1.5 text-[9px] font-bold text-slate-400 break-all text-center line-clamp-1 w-full">{fileName}</p>
                            </div>
                            <div className="flex-1 space-y-1">
                              <p className="text-xs font-black text-slate-800">{nok.parameter_name}</p>
                              <p className="text-[11px] text-slate-500 italic bg-white p-2.5 rounded-lg border shadow-sm">
                                "{nok.notes || 'Tanpa catatan tambahan'}"
                              </p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-gray-400 italic">Tidak ada parameter NOK</p>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="bg-emerald-50 px-5 py-3 border-b border-emerald-100">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                      <h4 className="text-xs font-black text-emerald-700 uppercase tracking-wider">Hasil Review</h4>
                    </div>
                  </div>
                  <div className="p-5 space-y-5">
                    <div className="flex flex-wrap justify-between items-center gap-2 border-b border-gray-100 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-500 uppercase">Keputusan:</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${selectedDetail.verdict === 'approve' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                          {selectedDetail.verdict === 'approve' ? 'Disetujui' : 'Ditolak'}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400">Reviewer: <span className="font-bold text-gray-700">{selectedDetail.reviewer_name || '-'}</span></p>
                        <p className="text-[10px] text-gray-400">Tanggal: {formatDate(selectedDetail.reviewed_at)}</p>
                      </div>
                    </div>

                    {selectedDetail.feedback && (
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Feedback:</p>
                        <p className="text-sm text-gray-700 italic">"{selectedDetail.feedback}"</p>
                      </div>
                    )}

                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Action Plan:</p>
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap">
                        {selectedDetail.action_plan || '-'}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Lampiran Evidence:</p>
                      {selectedDetail.evidence_paths && selectedDetail.evidence_paths.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {selectedDetail.evidence_paths.map((path, idx) => {
                            const fileName = path.split('/').pop();
                            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(path);
                            const fullUrl = `${process.env.NEXT_PUBLIC_MINIO_URL}/emertrack/${path.split('/').map(encodeURIComponent).join('/')}`;
                            return (
                              <div key={idx} className="flex flex-col items-center">
                                {isImage ? (
                                  <img
                                    src={fullUrl}
                                    alt={`Evidence ${idx + 1}`}
                                    className="w-full h-24 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition"
                                    onClick={() => window.open(fullUrl, '_blank')}
                                  />
                                ) : (
                                  <a href={fullUrl} target="_blank" className="w-full h-24 bg-blue-50 flex flex-col items-center justify-center rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-100 transition">
                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" /></svg>
                                    <span className="text-[9px] font-bold mt-1">PDF</span>
                                  </a>
                                )}
                                <p className="text-[9px] text-gray-400 truncate w-full text-center mt-1">{fileName}</p>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic">Tidak ada lampiran</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-3 flex justify-end border-t border-gray-200">
              <button onClick={() => setShowDetailModal(false)} className="px-5 py-2 bg-[#003d7a] hover:bg-[#002d5a] text-white rounded-lg text-sm font-bold transition shadow-sm">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}