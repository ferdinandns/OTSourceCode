'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface NOKDetail {
  parameter_name: string;
  notes: string;
  photo_url: string;
}

interface ReviewDetail {
  repair_order_id: number;
  sarpras_code: string;
  sarpras_name: string;
  site: string;
  department: string;
  location_detail: string;
  pic_name: string;
  action_plan: string;
  report_date: string | null;
  repair_done_at: string | null;
  status: string;
  nok_details: NOKDetail[];
  evidences: string[];
}

type PreviewKind = 'image' | 'pdf';

interface PreviewMedia {
  url: string;
  kind: PreviewKind;
  name?: string;
}

export default function ReviewFormPage() {
  const router = useRouter();
  const params = useParams();
  const repairOrderID = params?.id as string;

  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [verdict, setVerdict] = useState<'approve' | 'reject' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<PreviewMedia | null>(null);
  const [reviewerName, setReviewerName] = useState('');
  const [reviewFiles, setReviewFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<{ isOpen: boolean; message: string; title?: string }>({
    isOpen: false,
    message: '',
  });

  const getMinioUrl = (path: string) =>
    path
      ? `${process.env.NEXT_PUBLIC_MINIO_URL}/emertrack/${path
          .split('/')
          .map((p) => encodeURIComponent(p))
          .join('/')}`
      : '';

  const formatDate = (dateStr: string | null) =>
    dateStr
      ? new Intl.DateTimeFormat('id-ID', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        }).format(new Date(dateStr))
      : '-';

  const isImage = (path: string) =>
    /\.(jpg|jpeg|png|webp|gif)$/i.test(path);

  const isPDF = (path: string) => /\.pdf$/i.test(path);

  const fetchDetail = useCallback(async () => {
    if (!repairOrderID) return;
    setIsLoading(true);
    try {
      const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/reviews/${repairOrderID}`);
      const json = await res.json();
      if (json.success) {
        
        const validStatuses = ['submitted', 'in_review']; 
        
        if (!validStatuses.includes(json.data.status?.toLowerCase())) {
          alert('Waduh! Tugas ini sudah diambil atau selesai direview oleh QS lain, Dhan!');
          router.push('/dashboard/reviews');
          return;
        }
        
        setDetail(json.data);
      } else {
        setError(json.message || 'Gagal memuat detail review');
      }
    } catch (err) {
      setError('Terjadi kesalahan koneksi');
    } finally {
      setIsLoading(false);
    }
  }, [repairOrderID, router]);

  useEffect(() => {
    fetchDetail();
    const name =
      localStorage.getItem('fullName') ||
      sessionStorage.getItem('fullName') ||
      'QS Reviewer';
    setReviewerName(name);
  }, [fetchDetail]);

  const handleReviewFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setReviewFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (index: number) => {
    setReviewFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleBack = async () => {
    try {
      await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/reviews/${repairOrderID}/cancel`, {
        method: 'POST',
      });
    } catch {}
    router.push('/dashboard/reviews');
  };

  const handleSubmit = async () => {
    if (!verdict) {
      alert('Pilih verdict terlebih dahulu (Approve / Reject)');
      return;
    }
    if (!feedback.trim()) {
      alert('Catatan feedback wajib diisi');
      return;
    }

    setIsSubmitting(true);
    try {
      // ✅ Pakai FormData supaya bisa kirim file sekaligus
      const fd = new FormData();
      fd.append('verdict', verdict);
      fd.append('feedback', feedback);
      reviewFiles.forEach(file => fd.append('attachments', file));

      const res = await apiFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/reviews/${repairOrderID}/submit`,
        {
          method: 'POST',
          body: fd,
          // ✅ Jangan set Content-Type manual — biar browser set boundary-nya sendiri
        }
      );
      const json = await res.json();
      if (res.ok && json.success) {
        setModal({
          isOpen: true,
          title: 'Berhasil',
          message: `Review perbaikan berhasil ${verdict === 'approve' ? 'disetujui' : 'ditolak'}.`,
        });
      } else {
        alert(json.message || 'Gagal submit review');
      }
    } catch {
      alert('Terjadi kesalahan koneksi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModalClose = () => {
    setModal({ isOpen: false, message: '' });
    router.push('/dashboard/reviews');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fc]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#003d7a] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
            Memuat data...
          </p>
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fc]">
        <div className="text-center">
          <p className="text-red-500 font-bold mb-4">{error || 'Data tidak ditemukan'}</p>
          <Link
            href="/dashboard/reviews"
            className="text-[#003d7a] font-bold text-sm underline"
          >
            Kembali ke halaman review
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fc] pb-16">
      {/* BACK BUTTON — compact floating pill, not a full-width bar */}
      <div className="px-8 pt-6">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 bg-white/95 backdrop-blur border border-gray-200 shadow-sm hover:shadow-md hover:border-[#003d7a]/30 text-[#003d7a] font-bold text-xs px-4 py-2 rounded-full transition-all active:scale-95"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
          Kembali ke halaman QS Review
        </button>
      </div>

      <div className="max-w-[1200px] mx-auto px-8 pt-8">
        {/* PAGE TITLE */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">
            Isi Review Bukti Perbaikan
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Silahkan isi review bukti perbaikan kepada sarpras yang telah diperbaiki.
          </p>
        </div>

        <div className="flex gap-6 items-start">
          {/* LEFT COLUMN */}
          <div className="flex-1 space-y-6">

            {/* INFORMASI SARPRAS */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
                <h2 className="text-[11px] font-black text-[#003d7a] uppercase tracking-widest">
                  Informasi Sarpras
                </h2>
                <div className="w-8 h-8 bg-[#eef2f8] rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#003d7a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Nama Sarpras
                  </p>
                  <p className="text-base font-black text-gray-900">{detail.sarpras_name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Nomor Sarpras
                    </p>
                    <p className="text-sm font-black text-[#003d7a]">{detail.sarpras_code}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Location
                    </p>
                    <p className="text-sm font-bold text-gray-800">{detail.department}</p>
                  </div>
                </div>
                {detail.location_detail && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Detail Lokasi
                    </p>
                    <p className="text-sm font-medium text-gray-600">{detail.location_detail}</p>
                  </div>
                )}
              </div>
            </div>

            {/* PARAMETER NOK */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50">
                <h2 className="text-[11px] font-black text-[#003d7a] uppercase tracking-widest">
                  Parameter NOK (Findings)
                </h2>
              </div>
              <div className="px-6 py-5 space-y-3">
                {detail.nok_details?.length > 0 ? (
                  detail.nok_details.map((nok, idx) => (
                    <div
                      key={idx}
                      className="flex gap-4 bg-red-50 border border-red-100 rounded-xl p-4"
                    >
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-black text-gray-900">{nok.parameter_name}</p>
                        {nok.notes && (
                          <p className="text-xs text-gray-500 mt-1 italic">"{nok.notes}"</p>
                        )}
                        {nok.photo_url && (
                          <img
                            src={getMinioUrl(nok.photo_url)}
                            alt="NOK"
                            className="mt-3 w-24 h-24 object-cover rounded-lg cursor-pointer hover:opacity-80 border border-red-200"
                            onClick={() => setPreviewMedia({ url: getMinioUrl(nok.photo_url), kind: 'image' })}
                          />
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400 italic text-center py-4">
                    Tidak ada parameter NOK
                  </p>
                )}
              </div>
            </div>

            {/* HASIL PERBAIKAN */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50">
                <h2 className="text-[11px] font-black text-[#003d7a] uppercase tracking-widest">
                  Hasil Perbaikan
                </h2>
              </div>
              <div className="px-6 py-5">
                {detail.action_plan && (
                  <div className="mb-5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                      Action Plan PIC
                    </p>
                    <p className="text-sm font-medium text-gray-700 bg-gray-50 rounded-xl px-4 py-3">
                      {detail.action_plan}
                    </p>
                  </div>
                )}

                {detail.evidences?.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                      Bukti Perbaikan
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {detail.evidences.map((ev, idx) => {
                        const filename = ev.split('/').pop() || `Bukti ${idx + 1}`;

                        if (isImage(ev)) {
                          return (
                            <div
                              key={idx}
                              className="relative group cursor-pointer"
                              onClick={() => setPreviewMedia({ url: getMinioUrl(ev), kind: 'image', name: filename })}
                            >
                              <img
                                src={getMinioUrl(ev)}
                                alt={`Evidence ${idx + 1}`}
                                className="w-32 h-32 object-cover rounded-xl hover:opacity-80 border border-gray-200 shadow-sm transition-all pointer-events-none"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-xl transition-all flex items-center justify-center pointer-events-none">
                                <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                </svg>
                              </div>
                            </div>
                          );
                        }

                        if (isPDF(ev)) {
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setPreviewMedia({ url: getMinioUrl(ev), kind: 'pdf', name: filename })}
                              className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-red-200 bg-red-50 rounded-xl hover:bg-red-100 hover:border-red-300 transition-all group"
                            >
                              <svg className="w-8 h-8 text-red-500 mb-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                              </svg>
                              <p className="text-[9px] font-bold text-red-600 text-center px-2 truncate w-full">
                                {filename}
                              </p>
                              <p className="text-[8px] text-red-400 mt-0.5 group-hover:text-red-500">Klik untuk lihat</p>
                            </button>
                          );
                        }

                        // Other file types (doc/docx/xls/etc) — can't render inline, offer to open instead
                        const ext = filename.split('.').pop()?.toUpperCase() || 'FILE';
                        return (
                          <a
                            key={idx}
                            href={getMinioUrl(ev)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-gray-200 bg-gray-50 rounded-xl hover:bg-gray-100 hover:border-gray-300 transition-all group"
                          >
                            <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <path d="M14 2v6h6" />
                            </svg>
                            <p className="text-[9px] font-bold text-gray-600 text-center px-2 truncate w-full">
                              {filename}
                            </p>
                            <p className="text-[8px] text-gray-400 mt-0.5 group-hover:text-gray-500">{ext} · Buka file</p>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic text-center py-4">
                    Tidak ada bukti perbaikan
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN — QS Decision Panel */}
          <div className="w-[340px] flex-shrink-0 sticky top-[73px]">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="bg-[#003d7a] px-6 py-4 flex items-center gap-3">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Keputusan Verifikasi
                </h3>
              </div>

              <div className="px-6 py-5 space-y-6">
                {/* Assessment Outcome */}
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                    Assessment Outcome
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setVerdict('approve')}
                      className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-black text-sm transition-all ${
                        verdict === 'approve'
                          ? 'border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-100'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300 hover:bg-emerald-50'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${verdict === 'approve' ? 'bg-white/20' : 'bg-emerald-100'}`}>
                        <svg className={`w-3 h-3 ${verdict === 'approve' ? 'text-white' : 'text-emerald-600'}`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      Approve
                    </button>
                    <button
                      onClick={() => setVerdict('reject')}
                      className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-black text-sm transition-all ${
                        verdict === 'reject'
                          ? 'border-red-500 bg-red-500 text-white shadow-lg shadow-red-100'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-red-300 hover:bg-red-50'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${verdict === 'reject' ? 'bg-white/20' : 'bg-red-100'}`}>
                        <svg className={`w-3 h-3 ${verdict === 'reject' ? 'text-white' : 'text-red-600'}`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                      Reject
                    </button>
                  </div>
                </div>

                {/* Attachment — opsional */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                    Lampiran <span className="text-gray-300 font-normal normal-case tracking-normal">(opsional)</span>
                  </label>

                  {/* Upload area */}
                  <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl px-4 py-4 cursor-pointer hover:border-[#003d7a]/40 hover:bg-slate-50/50 transition-all">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold text-gray-500 text-center">
                      Klik untuk upload file
                    </p>
                    <p className="text-[10px] text-gray-400">PDF, JPG, PNG — maks 10MB</p>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={handleReviewFileChange}
                    />
                  </label>

                  {/* File list */}
                  {reviewFiles.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {reviewFiles.map((file, idx) => (
                        <li key={idx} className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <svg className="w-3.5 h-3.5 text-[#003d7a] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                            </svg>
                            <span className="text-[11px] font-semibold text-gray-700 truncate">{file.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(idx)}
                            className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100" />

                {/* Feedback */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                    Catatan Feedback <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={5}
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Provide detailed feedback about the result..."
                    className="w-full bg-[#f8fafd] border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-[#003d7a] focus:border-transparent outline-none transition-all resize-none placeholder:text-gray-300"
                  />
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100" />

                {/* Reviewer Info */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Reviewer
                    </span>
                    <span className="text-xs font-black text-gray-800">{reviewerName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Review Date
                    </span>
                    <span className="text-xs font-black text-gray-800">
                      {formatDate(new Date().toISOString())}
                    </span>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !verdict || !feedback.trim()}
                  className="w-full py-4 bg-[#003d7a] hover:bg-[#002d5a] text-white font-black text-sm uppercase rounded-xl shadow-lg shadow-blue-900/20 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Memproses...
                    </span>
                  ) : (
                    'Submit Review'
                  )}
                </button>

                <p className="text-[9px] text-gray-400 text-center italic leading-relaxed">
                  Setelah hasil perbaikan dikirim, PIC yang bertanggung jawab akan menerima notifikasi.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FULLSCREEN EVIDENCE PREVIEW — image or pdf */}
      {previewMedia && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setPreviewMedia(null)}
        >
          <div
            className={`relative w-full flex flex-col items-center ${
              previewMedia.kind === 'pdf' ? 'max-w-4xl h-[88vh]' : 'max-w-5xl'
            }`}
          >
            <div className="w-full flex items-center justify-between mb-3">
              <p className="text-white/70 text-xs font-semibold truncate pr-4">
                {previewMedia.name || ''}
              </p>
              <button
                className="text-white/70 hover:text-white bg-black/50 rounded-full p-2 flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewMedia(null);
                }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {previewMedia.kind === 'image' ? (
              <img
                src={previewMedia.url}
                alt="Preview"
                className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div
                className="w-full flex-1 bg-white rounded-xl overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <iframe src={previewMedia.url} title={previewMedia.name || 'PDF preview'} className="w-full h-full" />
              </div>
            )}
          </div>
        </div>
      )}

      {modal.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-base font-black text-gray-900 mb-1.5">{modal.title || 'Informasi'}</h3>
            <p className="text-xs text-gray-500 font-medium leading-relaxed mb-5">{modal.message}</p>
            <button
              onClick={handleModalClose}
              className="w-full px-4 py-2.5 bg-[#003d7a] text-white rounded-lg text-xs font-black uppercase tracking-wider hover:bg-[#002d5a] transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}