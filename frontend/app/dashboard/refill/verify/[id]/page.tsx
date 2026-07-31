'use client';

import React, { useState, useEffect, use } from 'react';

// --- Interfaces ---
interface VerifyDetail {
  item_id: number;
  sarpras_id: number;
  sarpras_type: string;
  sarpras_no: string;
  location: string;
  department_name: string;
  expired_date: string;
  new_expire_date: string;
  evidence_path: string; 
  update_reason: string;
  evidence_by: string;
  evidence_at: string;
  po_number: string;
  due_date: string;
}

interface ModalState {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning';
  onConfirm?: () => void;
}

export default function VerifyRefillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  // --- States ---
  const [detail, setDetail] = useState<VerifyDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewerName, setReviewerName] = useState('');

  // Form States
  const [status, setStatus] = useState<'approved' | 'rejected' | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Modal State
  const [modal, setModal] = useState<ModalState>({ isOpen: false, title: '', message: '', type: 'warning' });

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning', onConfirm?: () => void) => {
    setModal({ isOpen: true, title, message, type, onConfirm });
  };

  // --- Initial Fetch ---
  useEffect(() => {
    const name = sessionStorage.getItem('fullName') || 'Unknown Reviewer';
    setReviewerName(name);

    const fetchDetail = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/refill/verify/${id}`, { 
          credentials: 'include' 
        });
        const json = await res.json();
        
        if (json.success && json.data?.data) {
          setDetail(json.data.data); 
        } else {
          showAlert('Error', 'Data sarpras tidak ditemukan.', 'error');
        }
      } catch (err) {
        console.error('Gagal mengambil data detail:', err);
        showAlert('Error', 'Gagal terhubung ke server.', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [id]);

  // --- Handlers ---
  const handleSubmit = async () => {
    if (!status) {
      return showAlert('Peringatan', 'Pilih keputusan (Approve / Reject) terlebih dahulu.', 'warning');
    }
    if (status === 'rejected' && !rejectReason.trim()) {
      return showAlert('Peringatan', 'Catatan feedback wajib diisi jika menolak (Reject) bukti.', 'warning');
    }

    setIsSubmitting(true);

    const payload = {
      item_id: detail?.item_id, 
      sarpras_id: detail?.sarpras_id,
      status: status,
      reject_reason: status === 'rejected' ? rejectReason : ''
    };

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/refill/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success || res.ok) {
        showAlert('Berhasil!', `Verifikasi berhasil dikirim dengan status: ${status.toUpperCase()}`, 'success', () => {
          window.history.back();
        });
      } else {
        showAlert('Gagal Verifikasi', json.message || 'Terjadi kesalahan saat menyimpan data.', 'error');
      }
    } catch (err) {
      console.error('Submit error:', err);
      showAlert('Gangguan Jaringan', 'Gagal terhubung ke server.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Helpers ---
  const getParsedEvidence = () => {
    if (!detail?.evidence_path) return [];
    try {
      return JSON.parse(detail.evidence_path) as string[];
    } catch (e) {
      console.error('Failed to parse evidence_path', e);
      return [detail.evidence_path]; 
    }
  };

  const getFullUrl = (path: string) => {
    if (!path) return '';
    const encodedPath = path.split('/').map(p => encodeURIComponent(p)).join('/');
    return `${process.env.NEXT_PUBLIC_MINIO_URL}/emertrack/${encodedPath}`;
  };

  const todayDate = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

  // --- Render Loading/Empty ---
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]"><p className="text-slate-500 font-bold animate-pulse">Memuat Data Verifikasi...</p></div>;
  }

  if (!detail) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center gap-4">
        <p className="text-slate-500 font-bold">Data verifikasi tidak ditemukan.</p>
        <button onClick={() => window.history.back()} className="text-[#003d7a] underline font-bold">Kembali</button>
      </div>
    );
  }

  const evidenceFiles = getParsedEvidence();

  // --- Render UI Utama ---
  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10 relative">
      <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="mb-8">
          <button onClick={() => window.history.back()} className="flex items-center gap-2 text-sm font-bold text-[#003d7a] hover:text-blue-800 mb-6 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Kembali ke halaman Monitoring ED APAR
          </button>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Verifikasi Bukti Refill APAR/APAB</h1>
          <p className="text-slate-500 mt-2 text-sm">Silahkan memverifikasi bukti pengisian ulang APAR/APAB yang telah dilakukan</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT COLUMN: Data & Evidence */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Card: Informasi Sarpras */}
            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#e6f0fa] p-4 rounded-bl-3xl">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#003d7a]"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
              </div>
              <h3 className="text-[13px] font-black tracking-widest text-[#003d7a] uppercase mb-6">Informasi Sarpras</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Nama Sarpras</p>
                  <p className="text-lg font-black text-slate-800">{detail.sarpras_type}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Location</p>
                  <p className="text-lg font-black text-slate-800">{detail.location || 'General Affair'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Nomor Sarpras</p>
                  <p className="text-lg font-black text-slate-800">{detail.sarpras_no}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Due Date PO</p>
                  <p className="text-lg font-black text-slate-800">{new Date(detail.due_date).toLocaleDateString('id-ID')}</p>
                </div>
              </div>
            </div>

            {/* Card: Lampiran Bukti Refill */}
            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
              <h3 className="text-[13px] font-black tracking-widest text-[#003d7a] uppercase mb-6">Lampiran Bukti Refill</h3>
              
              <div className="mb-6 pb-6 border-b border-slate-100">
                <p className="text-sm font-bold text-slate-700 mb-1">Diunggah oleh: <span className="text-[#003d7a]">{detail.evidence_by}</span></p>
                <p className="text-sm text-slate-500 mb-4">Catatan GA: <span className="italic">"{detail.update_reason || '-'}"</span></p>
              </div>

              {evidenceFiles.length === 0 ? (
                <p className="text-slate-400 italic font-medium">Tidak ada file yang dilampirkan.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {evidenceFiles.map((path, index) => {
                    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(path);
                    const isPdf = /\.pdf$/i.test(path);
                    const fileName = path.split('/').pop() || `Attachment ${index + 1}`;

                    return (
                      <div 
                        key={index} 
                        onClick={() => window.open(getFullUrl(path), '_blank')}
                        className="group flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-[#003d7a] hover:shadow-md transition-all cursor-pointer"
                      >
                        {/* Area Preview Atas */}
                        <div className="h-32 bg-slate-50 flex items-center justify-center relative overflow-hidden border-b border-slate-100">
                          {isImage ? (
                            <img 
                              src={getFullUrl(path)} 
                              alt={fileName} 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="%23f1f5f9" stroke="%2394a3b8" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
                              }}
                            />
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={isPdf ? "text-red-500" : "text-blue-500"}>
                              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                              <polyline points="14 2 14 8 20 8"/>
                              {isPdf ? (
                                <>
                                  <path d="M10 13v-1h2a1 1 0 0 1 1 1v0a1 1 0 0 1-1 1h-2v1"/>
                                  <path d="M14 17v-4h2a1 1 0 0 1 1 1v0a1 1 0 0 1-1 1h-2v1"/>
                                </>
                              ) : (
                                <>
                                  <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                                </>
                              )}
                            </svg>
                          )}
                          
                          {/* Overlay Open Icon */}
                          <div className="absolute inset-0 bg-[#003d7a]/0 group-hover:bg-[#003d7a]/20 transition-colors flex items-center justify-center">
                            <div className="bg-white text-[#003d7a] p-2 rounded-full opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all shadow-sm">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                            </div>
                          </div>
                        </div>

                        {/* Area Nama File Bawah */}
                        <div className="p-3 bg-white">
                          <p className="text-[11px] font-bold text-slate-700 truncate" title={decodeURIComponent(fileName)}>
                            {decodeURIComponent(fileName)}
                          </p>
                          <p className="text-[9px] font-bold tracking-wider uppercase text-slate-400 mt-1">
                            {isImage ? 'Image Preview' : 'Document File'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: QS Decision Panel */}
          <div className="lg:col-span-1">
            <div className="bg-[#eef2f6] rounded-3xl p-6 border border-slate-200 sticky top-10">
              
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-[#003d7a] rounded-xl flex items-center justify-center text-white shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </div>
                <h2 className="text-lg font-black text-[#003d7a]">QS Decision Panel</h2>
              </div>

              {/* Assessment Outcome */}
              <div className="mb-8">
                <label className="block text-xs font-black text-[#003d7a] uppercase tracking-wider mb-4">
                  Assessment Outcome
                </label>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setStatus('approved')}
                    className={`flex-1 py-3 px-2 rounded-xl flex items-center justify-center gap-2 font-bold transition-all border ${
                      status === 'approved' 
                        ? 'bg-white border-[#00875a] text-[#00875a] shadow-sm ring-1 ring-[#00875a]' 
                        : 'bg-white border-transparent text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full ${status === 'approved' ? 'bg-[#00875a]' : 'bg-slate-200'}`}></div>
                    Approve
                  </button>
                  <button 
                    onClick={() => setStatus('rejected')}
                    className={`flex-1 py-3 px-2 rounded-xl flex items-center justify-center gap-2 font-bold transition-all border ${
                      status === 'rejected' 
                        ? 'bg-white border-[#e11d48] text-[#e11d48] shadow-sm ring-1 ring-[#e11d48]' 
                        : 'bg-white border-transparent text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full ${status === 'rejected' ? 'bg-[#e11d48]' : 'bg-slate-200'}`}></div>
                    Reject
                  </button>
                </div>
              </div>

              {/* Catatan Feedback */}
              <div className="mb-8">
                <label className="block text-xs font-black text-[#003d7a] uppercase tracking-wider mb-3">
                  Catatan Feedback {status === 'rejected' && <span className="text-red-500">*</span>}
                </label>
                <textarea 
                  rows={5}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Provide detailed feedback about the result..."
                  className="w-full p-4 border border-transparent rounded-2xl bg-white focus:outline-none focus:ring-2 focus:ring-[#003d7a] text-slate-700 font-medium transition-shadow resize-none shadow-sm"
                />
              </div>

              {/* Reviewer Info */}
              <div className="pt-6 border-t border-slate-300 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-500">Reviewer</span>
                  <span className="text-sm font-black text-slate-800">{reviewerName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500">Review Date</span>
                  <span className="text-sm font-black text-slate-800">{todayDate}</span>
                </div>
              </div>

              {/* Submit Button */}
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full bg-[#003d7a] disabled:bg-slate-400 text-white font-bold py-4 rounded-xl hover:bg-[#002d5a] transition-colors shadow-md"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Verifikasi'}
              </button>
              
              <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-4 leading-relaxed">
                Final Submission will trigger notification to<br/>General Affair
              </p>

            </div>
          </div>

        </div>
      </div>

      {/* --- CUSTOM POP-UP MODAL --- */}
      {modal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              modal.type === 'success' ? 'bg-[#e6f4ef] text-[#00875a]' :
              modal.type === 'error' ? 'bg-red-50 text-red-600' :
              'bg-amber-50 text-amber-500'
            }`}>
              {modal.type === 'success' && <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>}
              {modal.type === 'error' && <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
              {modal.type === 'warning' && <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">{modal.title}</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">{modal.message}</p>
            <button
              onClick={() => { setModal(prev => ({ ...prev, isOpen: false })); if (modal.onConfirm) modal.onConfirm(); }}
              className={`w-full px-4 py-3 text-white rounded-xl font-bold transition-colors shadow-sm ${modal.type === 'error' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#003d7a] hover:bg-[#002d5a]'}`}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}