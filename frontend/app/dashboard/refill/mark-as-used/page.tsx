'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, API_BASE } from '@/lib/api';

interface SelectedAparDetail {
  sarpras_id: number;
  sarpras_type: string;
  sarpras_no: string;
  expired_date: string;
}

export default function MarkAsUsedPage() {
  const router = useRouter();
  const [selectedApars, setSelectedApars] = useState<SelectedAparDetail[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modal, setModal] = useState<{
    isOpen: boolean;
    message: string;
    title?: string;
    isSuccess?: boolean;
  }>({ isOpen: false, message: '' });

  useEffect(() => {
    // Retrieve selected IDs from monitoring page via sessionStorage
    const rawIds = sessionStorage.getItem('refill_selected_ids');
    if (!rawIds) {
      router.replace('/dashboard/refill');
      return;
    }

    try {
      const ids: number[] = JSON.parse(rawIds);
      if (!Array.isArray(ids) || ids.length === 0) {
        router.replace('/dashboard/refill');
        return;
      }
      setSelectedIds(ids);

      // Fetch full asset details from the backend to display names and serial numbers
      const fetchSelectedDetails = async () => {
        try {
          const res = await apiFetch(`${API_BASE}/refill?limit=100`);
          const json = await res.json();
          if (json.success && json.data?.data) {
            const allItems: any[] = json.data.data;
            // Filter only items whose IDs are in the checked list
            const filtered = allItems
              .filter((item) => ids.includes(item.sarpras_id))
              .map((item) => ({
                sarpras_id: item.sarpras_id,
                sarpras_type: item.sarpras_type,
                sarpras_no: item.sarpras_no,
                expired_date: item.expired_date,
              }));
            setSelectedApars(filtered);
          }
        } catch (err) {
          console.error('Gagal mengambil detail daftar aset tercentang:', err);
        }
      };

      fetchSelectedDetails();
    } catch {
      router.replace('/dashboard/refill');
    }
  }, [router]);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setModal({ isOpen: true, message: 'Keterangan penggunaan wajib diisi.', title: 'Perhatian' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch(`${API_BASE}/refill/mark-used`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sarpras_ids: selectedIds,
          reason: reason.trim(), 
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal menandai APAR');
      }

      sessionStorage.removeItem('refill_selected_ids');
      setModal({
        isOpen: true,
        title: 'Berhasil',
        message: `${selectedIds.length} APAR/APAB berhasil ditandai sebagai telah digunakan dan statusnya menjadi Not Ready. Tim GA dapat segera membuat Refill Order.`,
        isSuccess: true,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan. Silakan coba lagi.';
      setModal({ isOpen: true, title: 'Gagal', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModalClose = () => {
    if (modal.isSuccess) {
      router.push('/dashboard/refill');
    } else {
      setModal({ isOpen: false, message: '' });
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
  };

  const presets = [
    'Digunakan untuk training pemadam kebakaran',
    'Digunakan untuk insiden kebakaran',
    'Digunakan untuk simulasi darurat',
    'Habis pakai — perlu refill segera',
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-8">
      <div className="max-w-5xl mx-auto w-full animate-in fade-in duration-500 space-y-6">

        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          Kembali ke Monitoring
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Akumulasi Grup</p>
              <h2 className="text-base font-black text-slate-800">Ringkasan Unit Terpilih</h2>
              <div className="flex items-center justify-between mt-4 bg-amber-50/60 border border-amber-100 rounded-xl p-4">
                <div>
                  <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider">Total Kuantitas</p>
                  <p className="text-3xl font-black text-amber-800 font-mono">{selectedIds.length} <span className="text-xs font-bold font-sans uppercase text-amber-700">Unit</span></p>
                </div>
                <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 shadow-inner">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" /></svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-3 bg-slate-400 rounded-sm" /> Rincian Identitas Aset ({selectedApars.length})
              </h3>
              
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {selectedApars.length > 0 ? selectedApars.map((apar) => (
                  <div key={apar.sarpras_id} className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl flex items-center justify-between group hover:border-slate-300 transition-all">
                    <div className="space-y-0.5">
                      <p className="text-xs font-black text-slate-800 group-hover:text-[#003d7a] transition-colors">{apar.sarpras_type}</p>
                      <span className="inline-block font-mono text-[10px] font-black text-[#003d7a] bg-blue-50/80 border border-blue-100 px-2 py-0.5 rounded">
                        {apar.sarpras_no}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Expired Date</span>
                      <span className="text-[11px] font-bold font-mono text-slate-600">{formatDate(apar.expired_date)}</span>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-6 text-slate-400 text-xs italic font-medium animate-pulse">Menghubungkan baris data...</div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/40">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#b45309">
                  <path d="M12 23a7.5 7.5 0 0 1-5.138-12.963C8.204 8.774 11.5 6.5 11 1.5c6 4 9 8 3 14 1 0 2.5 0 3-1.5.5 1 .5 2 .5 3A7.5 7.5 0 0 1 12 23z"/>
                </svg>
              </div>
              <div>
                <h1 className="text-base font-black text-slate-800">Form Alasan Penggunaan</h1>
                <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Berikan justifikasi pemakaian media untuk rekam log sistem.</p>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-0.5">Pilih Keterangan Cepat</label>
                <div className="flex flex-wrap gap-1.5">
                  {presets.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setReason(p)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                        reason === p
                          ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-amber-400 hover:text-amber-700'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest ml-0.5">
                  Keterangan Justifikasi Lapangan <span className="text-red-500 font-bold">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Contoh: Digunakan untuk kegiatan training simulasi pemadam kebakaran rutin tim K3 Kalbe Consumer Health di area lapangan Gedung B..."
                  rows={4}
                  className="w-full px-4 py-3 bg-slate-50/60 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-300 outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white resize-none transition-all"
                />
              </div>

              <div className="flex gap-3 bg-red-50/60 border border-red-100 rounded-xl p-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" className="shrink-0 mt-0.5">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <p className="text-[11px] text-red-700 font-semibold leading-relaxed">
                  Tindakan korektif ini akan seketika mengubah status seluruh unit terpilih menjadi <span className="font-black">Not Ready</span> dan memotong tanggal Expired Date ke hari ini untuk memicu alarm Refill Order di panel General Affair (GA).
                </p>
              </div>

              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => router.back()}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !reason.trim()}
                  className={`flex-1 px-4 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    isSubmitting || !reason.trim()
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed border'
                      : 'bg-amber-600 text-white hover:bg-amber-700 shadow-md shadow-amber-900/10'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-300 border-t-white rounded-full animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    "Konfirmasi Mark as Used"
                  )}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {modal.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${modal.isSuccess ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
              {modal.isSuccess ? (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              )}
            </div>
            <h3 className="text-base font-black text-gray-900 mb-1.5">{modal.title || 'Informasi'}</h3>
            <p className="text-xs text-gray-500 font-medium leading-relaxed mb-5">{modal.message}</p>
            <button
              onClick={handleModalClose}
              className={`w-full px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors cursor-pointer ${
                modal.isSuccess ? 'bg-[#00875a] text-white hover:bg-[#006b47]' : 'bg-[#003d7a] text-white hover:bg-[#002d5a]'
              }`}
            >
              {modal.isSuccess ? 'Kembali ke Monitoring' : 'OK'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
