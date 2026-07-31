'use client';

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { apiFetch, API_BASE } from "@/lib/api";

type ReportItem = {
  id: number;
  schedule_id: number;
  inspection_id: number;
  jenis_sarpras: string;
  nomor_sarpras: string;
  departemen: string;
  site: string;
  schedule_status: string;
  scheduled_date: string | null;
  status: string;
  nama_pemeriksa: string;
  tanggal_diperiksa: string | null;
  action_plan: string;
  nok_parameters: string[];
};

type Department = { id: number; name: string };

// Defined at module scope to avoid reallocation on each render,
// and to avoid double‑encoding the path for both src and onClick.
const getMinioUrl = (path: string) =>
  `${process.env.NEXT_PUBLIC_MINIO_URL}/emertrack/${path.split('/').map(encodeURIComponent).join('/')}`;

const getStatusStyle = (status: string) => {
  switch (status.toLowerCase()) {
    case "ready":
      return "bg-emerald-500 text-white";
    case "need_repair":
      return "bg-amber-500 text-white";
    case "will_be_repaired":
      return "bg-blue-500 text-white";
    case "waiting_verification":
      return "bg-purple-500 text-white";
    case "not_ready":
      return "bg-slate-400 text-white";
    default:
      return "bg-slate-400 text-white";
  }
};

const formatStatus = (status: string) =>
  status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

const getUsedReason = (item: ReportItem): string | null => {
  if (!item.nok_parameters || item.nok_parameters.length === 0) return null;
  const first = item.nok_parameters[0];
  if (first.startsWith("Habis Digunakan:")) {
    return first.replace("Habis Digunakan:", "").trim();
  }
  return null;
};

// Memoized leaf components. Splitting these out means React can bail out of
// re‑rendering an individual card (and its <img>) when unrelated state in
// the modal changes, and `content-visibility: auto` lets the browser skip
// layout/paint entirely for cards that are scrolled out of view — this is
// what was making the modal feel heavy on scroll.

const ParameterCard = React.memo(function ParameterCard({ item }: { item: any }) {
  const photoUrl = item.photo_path ? getMinioUrl(item.photo_path) : null;
  const isOk = item.status === 'OK';

  return (
    <div
      className={`rounded-xl border p-3 sm:p-4 transition-colors [content-visibility:auto] [contain-intrinsic-size:auto_180px] ${
        isOk
          ? 'border-slate-100 bg-slate-50/60 hover:bg-slate-50'
          : 'border-red-100 bg-red-50/40 hover:bg-red-50/60'
      }`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <span className="text-sm font-black text-slate-800 leading-snug">
          {item.parameter_name || 'Parameter tidak diketahui'}
        </span>
        {isOk ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap shrink-0">
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            OK
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-red-50 text-red-700 border border-red-200 whitespace-nowrap shrink-0">
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            NOK
          </span>
        )}
      </div>

      {item.notes && (
        <p className="mt-2.5 text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200 italic leading-relaxed">
          "{item.notes}"
        </p>
      )}

      {photoUrl && (
        <div className="mt-3">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Foto Temuan:</p>
          <img
            src={photoUrl}
            alt="Foto temuan"
            width={128}
            height={128}
            loading="lazy"
            decoding="async"
            className="w-28 h-28 sm:w-32 sm:h-32 object-cover rounded-xl cursor-pointer border border-slate-200 hover:opacity-80 transition-opacity"
            onClick={() => window.open(photoUrl)}
          />
        </div>
      )}
    </div>
  );
});

const EvidenceThumb = React.memo(function EvidenceThumb({ path }: { path: string }) {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const url = getMinioUrl(path);

  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
  const isImage = imageExts.includes(ext);
  const isPDF = ext === 'pdf';
  const isWord = ['doc', 'docx'].includes(ext);
  const isExcel = ['xls', 'xlsx'].includes(ext);
  const isPPT = ['ppt', 'pptx'].includes(ext);

  if (isImage) {
    return (
      <img
        src={url}
        alt="Bukti perbaikan"
        width={64}
        height={64}
        loading="lazy"
        decoding="async"
        className="w-16 h-16 object-cover rounded-lg cursor-pointer border border-slate-200 hover:opacity-80"
        onClick={() => window.open(url)}
      />
    );
  }

  const icon = isPDF ? (
    <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
      <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
    </svg>
  ) : isWord ? (
    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
      <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
      <text x="5" y="15" fontSize="8" fontWeight="bold" fill="white">W</text>
    </svg>
  ) : isExcel ? (
    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
      <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
      <text x="5" y="15" fontSize="8" fontWeight="bold" fill="white">X</text>
    </svg>
  ) : isPPT ? (
    <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
      <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
      <text x="5" y="15" fontSize="8" fontWeight="bold" fill="white">P</text>
    </svg>
  ) : (
    <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
      <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
    </svg>
  );

  const label = isPDF ? 'PDF' : isWord ? 'Word' : isExcel ? 'Excel' : isPPT ? 'PPT' : 'File';

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
    >
      {icon}
      <span>{label}</span>
    </a>
  );
});

const RepairSubmission = React.memo(function RepairSubmission({ sub }: { sub: any }) {
  return (
    <div className="border-l-2 border-slate-200 pl-4 space-y-2 [content-visibility:auto] [contain-intrinsic-size:auto_160px]">
      <div className="flex justify-between items-start">
        <span className="text-xs font-black text-slate-700">Attempt #{sub.attempt}</span>
        {sub.verdict === 'approve' && (
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">✓ Disetujui</span>
        )}
        {sub.verdict === 'reject' && (
          <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">✗ Ditolak</span>
        )}
        {!sub.verdict && sub.status === 'submitted' && (
          <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">Menunggu Review</span>
        )}
      </div>
      <p className="text-xs text-slate-600">
        <span className="font-bold">Action Plan:</span> {sub.action_plan || '-'}
      </p>
      {sub.due_date && (
        <p className="text-xs text-slate-600">
          <span className="font-bold">Target Selesai:</span> {new Date(sub.due_date).toLocaleDateString('id-ID')}
        </p>
      )}
      {sub.created_at && (
        <p className="text-xs text-slate-600">
          <span className="font-bold">Target Selesai:</span> {new Date(sub.created_at).toLocaleDateString('id-ID')}
        </p>
      )}
      {sub.evidences && sub.evidences.length > 0 && (
        <div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Bukti Perbaikan:</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {sub.evidences.map((ev: string, idx: number) => (
              <EvidenceThumb key={idx} path={ev} />
            ))}
          </div>
        </div>
      )}
      {sub.feedback && (
        <p className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded-lg">
          <span className="font-bold">Catatan Reviewer ({sub.reviewer || 'QS'}):</span> "{sub.feedback}"
        </p>
      )}
    </div>
  );
});

// Memoized on row data so toggling one row does not re‑render every row.
const ExpandedRowContent = React.memo(function ExpandedRowContent({
  item,
  isExpanded,
}: {
  item: ReportItem;
  isExpanded: boolean;
}) {
  const statusKey = item.status.toLowerCase();
  const usedReason = useMemo(() => getUsedReason(item), [item]);

  return (
    <div
      className={`grid transition-all duration-500 ease-in-out ${
        isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="overflow-hidden">
        <div
          className={`px-3 sm:px-6 bg-slate-50 border-l-4 ml-3 sm:ml-6 rounded-r-xl shadow-inner transition-all duration-500 ease-in-out ${
            isExpanded ? "py-3 my-2 sm:py-5 sm:my-3" : "py-0 my-0"
          } ${
            statusKey === "not_ready" && usedReason
              ? "border-orange-400"
              : "border-blue-600"
          }`}
        >
          {statusKey === "ready" && (
            <div className="flex items-center gap-3 text-xs sm:text-sm text-emerald-700 font-medium animate-in fade-in duration-300">
              <div className="p-1.5 bg-emerald-100 rounded-full shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              Seluruh parameter inspeksi dalam kondisi baik. Sarana siap digunakan untuk keadaan darurat.
            </div>
          )}
          {statusKey === "not_ready" && usedReason && (
            <div className="animate-in fade-in duration-300">
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                <div className="p-1.5 bg-orange-100 rounded-full text-orange-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                  </svg>
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-orange-700 uppercase tracking-wider">
                  Sarana Telah Digunakan
                </span>
              </div>
              <div className="ml-2 flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 sm:px-4 sm:py-3">
                <span className="text-orange-400 mt-0.5 shrink-0">•</span>
                <p className="text-xs sm:text-sm text-orange-800 leading-relaxed">{usedReason}</p>
              </div>
              <p className="ml-2 mt-2 sm:mt-3 text-[10px] sm:text-xs text-slate-500 italic">
                Tim GA dapat segera membuat Refill Order untuk memulai proses pengisian ulang.
              </p>
            </div>
          )}
          {statusKey === "not_ready" && !usedReason && (
            <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-600 font-medium animate-in fade-in duration-300">
              <div className="p-1.5 bg-slate-200 rounded-full text-slate-500 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
              Sarana ini belum dilakukan inspeksi rutin.
            </div>
          )}
          {statusKey === "waiting_verification" && (
            <div className="flex items-center gap-3 text-xs sm:text-sm text-purple-700 font-medium animate-in fade-in duration-300">
              <div className="p-1.5 bg-purple-100 rounded-full shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              Menunggu tim Quality System (QS) melakukan verifikasi terhadap bukti perbaikan yang telah diunggah PIC.
            </div>
          )}
          {statusKey === "need_repair" && (
            <div className="animate-in fade-in duration-300">
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                <div className="p-1 bg-amber-100 rounded text-amber-600">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-amber-700 uppercase tracking-wider">
                  Parameter Tidak Sesuai (NOK):
                </span>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-2 ml-2">
                {item.nok_parameters?.length > 0 ? (
                  item.nok_parameters.map((nok, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
                      <span className="text-amber-500 mt-0.5">•</span>
                      {nok}
                    </li>
                  ))
                ) : (
                  <li className="text-xs sm:text-sm text-slate-500 italic">Data parameter tidak tersedia.</li>
                )}
              </ul>
            </div>
          )}
          {(statusKey === "will_be_repaired" || statusKey === "in_progress") && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 animate-in fade-in duration-300">
              <div>
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <div className="p-1 bg-amber-100 rounded text-amber-600">
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold text-amber-700 uppercase tracking-wider">
                    Parameter Tidak Sesuai (NOK):
                  </span>
                </div>
                <ul className="space-y-1 ml-2">
                  {item.nok_parameters?.length > 0 ? (
                    item.nok_parameters.map((nok, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
                        <span className="text-amber-500 mt-0.5">•</span>
                        {nok}
                      </li>
                    ))
                  ) : (
                    <li className="text-xs sm:text-sm text-slate-500 italic">Data parameter tidak tersedia.</li>
                  )}
                </ul>
              </div>

              <div className="border-l-2 border-slate-200 pl-4 sm:pl-6">
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <div className="p-1 bg-blue-100 rounded text-blue-600">
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold text-blue-700 uppercase tracking-wider">
                    Repair Action Plan:
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-blue-50/50 p-2 sm:p-3 rounded-lg border border-blue-100">
                  {item.action_plan || (
                    <span className="text-slate-400 italic">Action plan belum diisi oleh PIC.</span>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default function ReportPemeriksaanContent() {
  const [data, setData] = useState<ReportItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<number[]>([]);

  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean;
    inspectionId: number | null;
    sarprasName: string;
    sarprasCode: string;
  }>({ isOpen: false, inspectionId: null, sarprasName: "", sarprasCode: "" });
  const [inspectionDetail, setInspectionDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/departments`)
      .then((res) => res.json())
      .then((res) => {
        if (res.success) setDepartments(res.data);
      })
      .catch((err) => console.error("Gagal fetch departments:", err));
  }, []);

  const fetchReports = useCallback(() => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (filterDept) params.append("department_id", filterDept);
    if (filterStatus) params.append("status", filterStatus);
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);

    apiFetch(`${API_BASE}/inspection-report?${params.toString()}`)
      .then((res) => res.json())
      .then((res) => {
        if (res.success) setData(res.data);
      })
      .catch((err) => console.error("Gagal fetch report:", err))
      .finally(() => setIsLoading(false));
  }, [filterDept, filterStatus, startDate, endDate]);

  const fetchInspectionDetail = useCallback(async (inspectionId: number) => {
    setDetailLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/inspections/${inspectionId}`);
      const json = await res.json();
      if (json.success) setInspectionDetail(json.data);
      else setInspectionDetail(null);
    } catch (err) {
      console.error(err);
      setInspectionDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const toggleRow = useCallback((id: number) => {
    setExpandedRows((prev) =>
      prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]
    );
  }, []);

  const closeDetailModal = useCallback(() => {
    setDetailModal({ isOpen: false, inspectionId: null, sarprasName: "", sarprasCode: "" });
  }, []);

  const openDetailModal = useCallback((item: ReportItem) => {
    if (item.inspection_id) {
      setDetailModal({
        isOpen: true,
        inspectionId: item.inspection_id,
        sarprasName: item.jenis_sarpras,
        sarprasCode: item.nomor_sarpras,
      });
      fetchInspectionDetail(item.inspection_id);
    } else {
      setInspectionDetail(null);
      setDetailModal({
        isOpen: true,
        inspectionId: null,
        sarprasName: item.jenis_sarpras,
        sarprasCode: item.nomor_sarpras,
      });
    }
  }, [fetchInspectionDetail]);

  const handleExport = () => {
    const params = new URLSearchParams();
    if (filterDept) params.append("department_id", filterDept);
    if (filterStatus) params.append("status", filterStatus);
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);
    window.open(
      `${API_BASE}/inspection-report/export?${params.toString()}`,
      "_blank"
    );
  };

  const resetFilters = () => {
    setFilterDept("");
    setFilterStatus("");
    setStartDate("");
    setEndDate("");
  };

  const startMax = endDate ? endDate : undefined;
  const endMax = startDate ? startDate : undefined;

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto w-full animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm mb-5 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
            Report Pemeriksaan Sarana Prasarana
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Ringkasan laporan pemeriksaan berkala sarana prasarana emergency.
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200 w-full sm:w-auto"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Export Report (.xlsx)
        </button>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4 mb-5 sm:mb-6 flex flex-wrap items-center gap-3">
        <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
          Filter By:
        </span>

        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="px-2 py-1.5 sm:px-3 sm:py-2 border border-slate-300 rounded-lg text-xs sm:text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px] flex-1 sm:flex-none"
        >
          <option value="">Semua Departemen</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-2 py-1.5 sm:px-3 sm:py-2 border border-slate-300 rounded-lg text-xs sm:text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 min-w-[130px] flex-1 sm:flex-none"
        >
          <option value="">Semua Status</option>
          <option value="ready">Ready</option>
          <option value="not_ready">Not Ready</option>
          <option value="need_repair">Need Repair</option>
          <option value="will_be_repaired">Will Be Repaired</option>
          <option value="waiting_verification">Waiting Verification</option>
        </select>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            max={startMax}
            className="px-2 py-1.5 sm:px-3 sm:py-2 border border-slate-300 rounded-lg text-xs sm:text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 w-auto"
            title="Dari Tanggal"
          />
          <span className="text-slate-400 font-medium">-</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={endMax}
            className="px-2 py-1.5 sm:px-3 sm:py-2 border border-slate-300 rounded-lg text-xs sm:text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 w-auto"
            title="Sampai Tanggal"
          />
        </div>

        {(filterDept || filterStatus || startDate || endDate) && (
          <button
            onClick={resetFilters}
            className="ml-auto text-xs sm:text-sm font-semibold text-red-600 hover:text-red-800 flex items-center gap-1 shrink-0"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            Reset
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[800px] md:min-w-full w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-3 sm:px-6 sm:py-4 text-left text-[10px] sm:text-xs font-bold text-slate-800 uppercase">Nomor</th>
                <th className="px-3 py-3 sm:px-6 sm:py-4 text-left text-[10px] sm:text-xs font-bold text-slate-800 uppercase">Jenis Sarpras</th>
                <th className="px-3 py-3 sm:px-6 sm:py-4 text-left text-[10px] sm:text-xs font-bold text-slate-800 uppercase">Nomor Sarpras</th>
                <th className="px-3 py-3 sm:px-6 sm:py-4 text-left text-[10px] sm:text-xs font-bold text-slate-800 uppercase">Departemen</th>
                <th className="px-3 py-3 sm:px-6 sm:py-4 text-center text-[10px] sm:text-xs font-bold text-slate-800 uppercase">Site</th>
                <th className="px-3 py-3 sm:px-6 sm:py-4 text-center text-[10px] sm:text-xs font-bold text-slate-800 uppercase">Status</th>
                <th className="px-3 py-3 sm:px-6 sm:py-4 text-left text-[10px] sm:text-xs font-bold text-slate-800 uppercase">Nama Pemeriksa</th>
                <th className="px-3 py-3 sm:px-6 sm:py-4 text-left text-[10px] sm:text-xs font-bold text-slate-800 uppercase">Tanggal Diperiksa</th>
                <th className="px-3 py-3 sm:px-6 sm:py-4 text-center text-[10px] sm:text-xs font-bold text-slate-800 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="p-8 sm:p-12 text-center text-slate-500 font-medium text-sm">
                    Memuat data report...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 sm:p-12 text-center text-slate-500 text-sm">
                    Tidak ada data.
                  </td>
                </tr>
              ) : (
                data.map((item, index) => {
                  const isExpanded = expandedRows.includes(item.schedule_id);

                  return (
                    <React.Fragment key={item.schedule_id}>
                      <tr
                        onClick={() => toggleRow(item.schedule_id)}
                        className={`cursor-pointer transition-colors ${isExpanded ? "bg-slate-50/80" : "hover:bg-slate-50"}`}
                      >
                        <td className="px-3 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm text-slate-900 font-medium">{index + 1}</td>
                        <td className="px-3 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm text-slate-900 font-bold">{item.jenis_sarpras}</td>
                        <td className="px-3 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm font-semibold text-blue-700 break-words">{item.nomor_sarpras}</td>
                        <td className="px-3 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm text-slate-800">{item.departemen}</td>
                        <td className="px-3 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm text-slate-800 text-center">{item.site}</td>
                        <td className="px-3 py-3 sm:px-6 sm:py-4 text-center">
                          <span className={`inline-flex px-2 py-0.5 sm:px-3 sm:py-1 text-[9px] sm:text-[11px] font-bold rounded-full ${getStatusStyle(item.status)}`}>
                            {formatStatus(item.status)}
                          </span>
                        </td>
                        <td className="px-3 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm text-slate-800">{item.nama_pemeriksa}</td>
                        <td className="px-3 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm text-slate-800 font-medium">
                          {item.tanggal_diperiksa
                            ? new Date(item.tanggal_diperiksa).toLocaleDateString("id-ID", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "-"}
                        </td>
                        <td className="px-3 py-3 sm:px-6 sm:py-4 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetailModal(item);
                            }}
                            className="px-3 py-1 text-[10px] font-bold text-white bg-[#003d7a] rounded-lg hover:bg-[#002d5a] transition"
                          >
                            Detail
                          </button>
                        </td>
                      </tr>

                      <tr className="bg-white">
                        <td colSpan={9} className="p-0 border-b border-slate-100">
                          <ExpandedRowContent item={item} isExpanded={isExpanded} />
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailModal.isOpen && (
        <div
          className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
          onClick={closeDetailModal}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col border-t-[4px] border-[#003d7a] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header is not sticky because it's a sibling of the scroll container —
                making it sticky would be a no-op. Using shrink-0 with flex-col
                keeps it pinned. */}
            <div className="bg-slate-50 px-5 sm:px-6 py-4 border-b border-slate-200 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-800 uppercase tracking-wider">Detail Pemeriksaan</h3>
                {(detailModal.sarprasName || detailModal.sarprasCode) && (
                  <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                    {detailModal.sarprasName} · <span className="font-mono">{detailModal.sarprasCode}</span>
                  </p>
                )}
              </div>
              <button
                onClick={closeDetailModal}
                className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 bg-slate-50/50 [transform:translateZ(0)]">
              {detailLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-7 h-7 border-2 border-slate-200 border-t-[#003d7a] rounded-full animate-spin" />
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Memuat data...</p>
                </div>
              ) : (
                <div className="p-4 sm:p-6 space-y-5">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                      <span className="w-1.5 h-4 bg-[#003d7a] rounded-sm" />
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Informasi Sarpras</h4>
                    </div>
                    <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Sarpras</span>
                        <p className="text-sm font-black text-slate-800">
                          {detailModal.sarprasName || inspectionDetail?.sarpras?.sarpras_type_name || '-'}
                        </p>
                        <span className="font-mono text-[11px] text-slate-400 font-bold">
                          {detailModal.sarprasCode || inspectionDetail?.sarpras?.code || '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Checker</span>
                        <p className="text-sm font-bold text-slate-700">{inspectionDetail?.checker?.name || '-'}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Departemen</span>
                        <p className="text-sm font-bold text-slate-700">{inspectionDetail?.checker?.department_name || '-'}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Tanggal Pemeriksaan</span>
                        <p className="text-sm font-bold text-slate-700">
                          {inspectionDetail?.inspected_at
                            ? new Date(inspectionDetail.inspected_at).toLocaleString('id-ID')
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Hasil Keseluruhan</span>
                        {inspectionDetail?.overall_status === 'OK' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            NOT OK (NOK)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                      <span className="w-1.5 h-4 bg-[#003d7a] rounded-sm" />
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Parameter Pemeriksaan</h4>
                      {inspectionDetail?.items?.length > 0 && (
                        <span className="ml-auto text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                          {inspectionDetail.items.length} item
                        </span>
                      )}
                    </div>

                    <div className="p-3 sm:p-4 space-y-2.5">
                      {inspectionDetail?.items?.length > 0 ? (
                        inspectionDetail.items.map((item: any) => (
                          <ParameterCard key={item.id} item={item} />
                        ))
                      ) : (
                        <div className="text-center py-10 text-slate-400 italic text-sm">
                          Tidak ada data parameter pemeriksaan.
                        </div>
                      )}
                    </div>
                  </div>

                  {inspectionDetail?.repair && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-amber-500 rounded-sm" />
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Riwayat Perbaikan & Review
                        </h4>
                        {inspectionDetail.repair.status && (
                          <span className="ml-auto text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            {inspectionDetail.repair.status === 'approved' && '✅ Disetujui'}
                            {inspectionDetail.repair.status === 'rejected' && '❌ Ditolak'}
                            {inspectionDetail.repair.status === 'in_progress' && '⏳ Dalam Perbaikan'}
                            {inspectionDetail.repair.status === 'submitted' && '📤 Menunggu Review'}
                          </span>
                        )}
                      </div>

                      <div className="p-4 space-y-4">
                        {inspectionDetail.repair.submissions?.map((sub: any) => (
                          <RepairSubmission key={sub.id} sub={sub} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer — see the header note above regarding the sticky removal. */}
            <div className="bg-white px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 flex justify-end shrink-0">
              <button
                onClick={closeDetailModal}
                className="px-5 sm:px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-wider transition-colors border border-slate-200 w-full sm:w-auto"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
