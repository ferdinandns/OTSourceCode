'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch, API_BASE } from '@/lib/api';

interface NOKDetail {
  parameter_name: string;
  notes: string;
  photo_url: string;
}

interface RepairDetail {
  repair_order_id: number;
  sarpras_code: string;
  sarpras_name: string;
  department: string;
  nok_details: NOKDetail[];
}

interface ModalState {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning';
  onConfirm?: () => void;
}

type FileKind = 'image' | 'pdf' | 'other';

const getFileKind = (file: File): FileKind => {
  if (file.type.includes('image')) return 'image';
  if (file.type.includes('pdf')) return 'pdf';
  return 'other';
};

const FileTypeIcon = ({ kind, className = 'w-5 h-5' }: { kind: FileKind; className?: string }) => {
  switch (kind) {
    case 'image':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
      );
    case 'pdf':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
      );
    default:
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
      );
  }
};

const FILE_KIND_STYLES: Record<FileKind, { bg: string; text: string; label: string }> = {
  image: { bg: 'bg-blue-50', text: 'text-[#003d7a]', label: 'IMG' },
  pdf: { bg: 'bg-red-50', text: 'text-red-600', label: 'PDF' },
  other: { bg: 'bg-slate-100', text: 'text-slate-500', label: 'FILE' },
};

interface StagedFile {
  file: File;
  kind: FileKind;
  previewUrl: string | null;
  id: string;
}

export default function SubmitEvidencePage() {
  const router = useRouter();
  const params = useParams();
  const repairId = params.id as string;

  const [detail, setDetail] = useState<RepairDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreviewModal, setImagePreviewModal] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [previewFile, setPreviewFile] = useState<StagedFile | null>(null);

  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [notes, setNotes] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
  });

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning', onConfirm?: () => void) => {
    setModal({ isOpen: true, title, message, type, onConfirm });
  };

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await apiFetch(`${API_BASE}/repairs/${repairId}`);
        const json = await res.json();
        if (json.success) setDetail(json.data);
        else showAlert('Error', 'Data perbaikan tidak ditemukan.', 'error');
      } catch (err) {
        showAlert('Error', 'Gagal mengambil detail perbaikan.', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    if (repairId) fetchDetail();
  }, [repairId]);

  // Revoke object URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      stagedFiles.forEach(sf => {
        if (sf.previewUrl) URL.revokeObjectURL(sf.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processFiles = (newFiles: File[]) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
    const validFiles = newFiles.filter(f => allowedTypes.includes(f.type));
    if (validFiles.length !== newFiles.length) {
      showAlert('Perhatian', 'Beberapa file ditolak karena format tidak didukung (Gunakan PNG, JPG, atau PDF).', 'warning');
    }
    const currentTotalSize = stagedFiles.reduce((acc, f) => acc + f.file.size, 0);
    const newTotalSize = validFiles.reduce((acc, f) => acc + f.size, 0);
    if (currentTotalSize + newTotalSize > 10 * 1024 * 1024) {
      showAlert('Kapasitas Penuh', 'Total ukuran semua file melebihi batas maksimal 10 MB!', 'error');
      return;
    }

    const newStaged: StagedFile[] = validFiles.map(file => {
      const kind = getFileKind(file);
      const previewUrl = (kind === 'image' || kind === 'pdf') ? URL.createObjectURL(file) : null;
      return {
        file,
        kind,
        previewUrl,
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      };
    });

    setStagedFiles(prev => [...prev, ...newStaged]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounter.current += 1;
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDraggingOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDraggingOver(false);
    if (e.dataTransfer.files) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const removeFile = (idToRemove: string) => {
    setStagedFiles(prev => {
      const target = prev.find(f => f.id === idToRemove);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter(f => f.id !== idToRemove);
    });
  };

  const handleSubmit = async () => {
    if (stagedFiles.length === 0) {
      return showAlert('Peringatan', 'Silakan unggah minimal satu bukti terlebih dahulu.', 'warning');
    }
    if (!notes.trim()) {
      return showAlert('Peringatan', 'Catatan perbaikan wajib diisi.', 'warning');
    }
    if (!detail?.repair_order_id) {
      return showAlert('Error Sistem', 'Data perbaikan tidak valid. Silakan muat ulang halaman.', 'error');
    }

    setIsSubmitting(true);
    const formData = new FormData();
    stagedFiles.forEach(sf => formData.append('photos[]', sf.file));
    formData.append('repair_desc', notes);

    try {
      const res = await apiFetch(`${API_BASE}/repairs/${repairId}/evidence`, {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showAlert('Berhasil!', 'Bukti perbaikan berhasil dikirim ke tim QS untuk verifikasi.', 'success', () => {
          router.push('/dashboard/repair');
        });
      } else {
        showAlert('Gagal Submit', json.message || 'Terjadi kesalahan saat menyimpan data.', 'error');
      }
    } catch (err) {
      console.error(err);
      showAlert('Gangguan Jaringan', 'Gagal terhubung ke server. Periksa koneksi internet Anda.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalUsedSize = useMemo(() => stagedFiles.reduce((acc, f) => acc + f.file.size, 0), [stagedFiles]);
  const totalUsedMB = (totalUsedSize / 1024 / 1024).toFixed(2);
  const percentageUsed = Math.min((totalUsedSize / (10 * 1024 * 1024)) * 100, 100);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-[3px] border-slate-200 border-t-[#003d7a] animate-spin" />
          <p className="text-slate-500 font-bold text-sm">Memuat Data Sarpras...</p>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center gap-4">
        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
        </div>
        <p className="text-slate-500 font-bold">Data perbaikan tidak ditemukan.</p>
        <button onClick={() => router.back()} className="text-[#003d7a] underline font-bold text-sm hover:text-blue-800 transition-colors">Kembali</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10 relative">
      <div className="max-w-4xl mx-auto animate-in fade-in duration-500">

        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm font-bold text-[#003d7a] hover:text-blue-800 mb-6 transition-colors group"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:-translate-x-0.5"><path d="m15 18-6-6 6-6" /></svg>
            Kembali ke halaman Perbaikan
          </button>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Isi Bukti Perbaikan Sarpras</h1>
          <p className="text-slate-500 mt-2 text-sm">Silakan unggah bukti perbaikan yang telah dilakukan</p>
        </div>

        <div className="space-y-6">

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm transition-shadow hover:shadow-md">
            <div className="bg-[#9bb9d6] px-6 py-3">
              <h3 className="text-[12px] font-black tracking-widest text-[#003d7a] uppercase">Informasi Sarpras</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nama Sarpras</p>
                <p className="text-sm font-black text-slate-800">{detail.sarpras_name}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nomor Sarpras</p>
                <p className="text-sm font-black text-slate-800">{detail.sarpras_code}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Lokasi Departemen</p>
                <p className="text-sm font-black text-slate-800">{detail.department}</p>
              </div>
            </div>
          </div>

          {detail.nok_details && detail.nok_details.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm transition-shadow hover:shadow-md">
              <div className="bg-[#ffdbdb] px-6 py-3 flex items-center justify-between">
                <h3 className="text-[12px] font-black tracking-widest text-red-600 uppercase">Parameter NOK</h3>
                <span className="text-[11px] font-black text-red-500 bg-white/60 px-2 py-0.5 rounded-full">{detail.nok_details.length}</span>
              </div>
              <div className="p-6 space-y-4">
                {detail.nok_details.map((nok, idx) => (
                  <div key={idx} className="flex gap-4 items-start border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                    <div className="mt-0.5 shrink-0">
                      <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-900">{nok.parameter_name}</p>
                      <p className="text-xs italic text-slate-500 mt-0.5">"{nok.notes || 'Tidak ada catatan'}"</p>
                      {nok.photo_url && (
                        <div className="mt-2">
                          <img
                            src={`${process.env.NEXT_PUBLIC_MINIO_URL}/emertrack/${nok.photo_url}`}
                            alt="Bukti NOK"
                            className="w-20 h-20 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-90 hover:ring-2 hover:ring-[#003d7a] transition-all"
                            onClick={() => setImagePreviewModal(`${process.env.NEXT_PUBLIC_MINIO_URL}/emertrack/${nok.photo_url}`)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm transition-shadow hover:shadow-md">
            <div className="px-6 py-6">
              <div className="flex justify-between items-end mb-3">
                <label className="block text-sm font-black text-[#003d7a] uppercase tracking-wide">
                  Unggah Bukti (Foto/Dokumen) <span className="text-red-500">*</span>
                </label>
                <span className={`text-xs font-bold ${percentageUsed > 90 ? 'text-red-500' : 'text-slate-500'}`}>
                  {totalUsedMB} / 10 MB
                </span>
              </div>

              <div className="w-full bg-slate-200 rounded-full h-1.5 mb-4 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${percentageUsed > 90 ? 'bg-red-500' : 'bg-[#003d7a]'}`}
                  style={{ width: `${percentageUsed}%` }}
                ></div>
              </div>

              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".png,.jpg,.jpeg,.pdf"
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors cursor-pointer group ${
                  isDraggingOver
                    ? 'border-[#003d7a] bg-blue-50'
                    : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-[#003d7a]'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`mb-2 transition-colors ${isDraggingOver ? 'text-[#003d7a]' : 'text-slate-400 group-hover:text-[#003d7a]'}`}><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="M12 12v9" /><path d="m8 16 4-4 4 4" /></svg>
                <p className="text-sm font-bold text-slate-700">{isDraggingOver ? 'Lepaskan file di sini' : 'Klik atau seret file ke sini'}</p>
                <p className="text-[11px] font-medium text-slate-400 mt-1">PNG, JPG, PDF (Bisa lebih dari 1 file)</p>
              </div>
            </div>

            {stagedFiles.length > 0 && (
              <div className="p-6 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {stagedFiles.map((sf) => {
                    const style = FILE_KIND_STYLES[sf.kind];
                    const isPreviewable = sf.kind === 'image' || sf.kind === 'pdf';
                    return (
                      <div
                        key={sf.id}
                        onClick={() => isPreviewable && setPreviewFile(sf)}
                        className={`flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm transition-all ${isPreviewable ? 'cursor-pointer hover:border-[#003d7a] hover:shadow-md' : ''}`}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          {sf.kind === 'image' && sf.previewUrl ? (
                            <img src={sf.previewUrl} alt={sf.file.name} className="w-9 h-9 rounded object-cover flex-shrink-0 border border-slate-200" />
                          ) : (
                            <div className={`w-9 h-9 rounded flex items-center justify-center flex-shrink-0 ${style.bg} ${style.text}`}>
                              <FileTypeIcon kind={sf.kind} className="w-4 h-4" />
                            </div>
                          )}
                          <div className="truncate">
                            <p className="text-xs font-bold text-slate-800 truncate">{sf.file.name}</p>
                            <p className="text-[10px] font-medium text-slate-500">
                              {(sf.file.size / 1024 / 1024).toFixed(2)} MB
                              {isPreviewable && <span className="text-[#003d7a]"> · Lihat</span>}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFile(sf.id); }}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 transition-shadow hover:shadow-md">
            <label className="block text-sm font-black text-[#003d7a] uppercase tracking-wide mb-3">
              Catatan Perbaikan <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan terkait dengan apa saja yang sudah diperbaiki..."
              className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003d7a] text-slate-700 font-medium transition-colors resize-none"
            />
          </div>

          <div className="flex gap-4 pt-2">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || stagedFiles.length === 0 || !notes.trim()}
              className="flex-1 bg-[#003d7a] disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl hover:bg-blue-900 active:scale-[0.99] transition-all shadow-md flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Mengirim...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></svg>
                  Submit Perbaikan
                </>
              )}
            </button>
            <button
              onClick={() => router.back()}
              disabled={isSubmitting}
              className="px-10 bg-slate-200 text-slate-700 font-bold py-3.5 rounded-xl hover:bg-slate-300 transition-colors disabled:opacity-60"
            >
              Batal
            </button>
          </div>
        </div>
      </div>

      {/* NOK evidence image preview (existing photos from server) */}
      {imagePreviewModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setImagePreviewModal(null)}>
          <div className="relative max-w-3xl max-h-[90vh] bg-white rounded-lg overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <img src={imagePreviewModal} alt="Preview" className="w-full h-auto object-contain" />
            <button className="absolute top-2 right-2 bg-white rounded-full p-1.5 shadow hover:bg-slate-100 transition-colors" onClick={() => setImagePreviewModal(null)}>
              <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* Staged upload file preview (image / pdf) */}
      {previewFile && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setPreviewFile(null)}>
          <div className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-xl overflow-hidden shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 ${FILE_KIND_STYLES[previewFile.kind].bg} ${FILE_KIND_STYLES[previewFile.kind].text}`}>
                  <FileTypeIcon kind={previewFile.kind} className="w-3.5 h-3.5" />
                </div>
                <p className="text-sm font-bold text-slate-800 truncate">{previewFile.file.name}</p>
              </div>
              <button className="p-1.5 rounded-full hover:bg-slate-200 transition-colors flex-shrink-0" onClick={() => setPreviewFile(null)}>
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 flex items-center justify-center">
              {previewFile.kind === 'image' && previewFile.previewUrl && (
                <img src={previewFile.previewUrl} alt={previewFile.file.name} className="max-w-full max-h-[75vh] object-contain" />
              )}
              {previewFile.kind === 'pdf' && previewFile.previewUrl && (
                <iframe src={previewFile.previewUrl} title={previewFile.file.name} className="w-full h-[75vh]" />
              )}
            </div>
          </div>
        </div>
      )}

      {modal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              modal.type === 'success' ? 'bg-[#e6f4ef] text-[#00875a]' :
              modal.type === 'error' ? 'bg-red-50 text-red-600' :
              'bg-amber-50 text-amber-500'
            }`}>
              {modal.type === 'success' && (
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></svg>
              )}
              {modal.type === 'error' && (
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
              )}
              {modal.type === 'warning' && (
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              )}
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">{modal.title}</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">{modal.message}</p>
            <button
              onClick={() => {
                setModal(prev => ({ ...prev, isOpen: false }));
                if (modal.onConfirm) modal.onConfirm();
              }}
              className={`w-full px-4 py-3 text-white rounded-xl font-bold transition-colors shadow-sm ${
                modal.type === 'error' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#003d7a] hover:bg-[#002d5a]'
              }`}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}