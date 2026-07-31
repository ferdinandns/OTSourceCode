'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import RiskBadge from '@/components/RiskBadge';

type Eligibility = {
  eligible: boolean;
  is_due: boolean;
  due_date: string;
  sarpras_id: number;
  schedule_id: number;
  reason?: string;
};

export default function SarprasDetailPage() {
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const { code } = useParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isChecker, setIsChecker] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    const rolesStr = sessionStorage.getItem('roles');
    if (rolesStr) {
      try {
        const roles: string[] = JSON.parse(rolesStr);
        setIsChecker(roles.includes('checker'));
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (!isChecker || !data) return;
    const fetchEligibility = async () => {
      try {
        const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/sarpras/detail/${code}/checker-eligibility`);
        const json = await res.json();
        if (json.success) setEligibility(json.data);
      } catch (err) {
        console.error("Gagal cek eligibility:", err);
      }
    };
    fetchEligibility();
  }, [isChecker, data, code]);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/sarpras/detail/${code}`);
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch (err) {
        console.error("Gagal mengambil detail:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [code]);

  const formatDateIndo = (dateStr: string) => {
    if (!dateStr || dateStr.startsWith("0001") || dateStr === "-") {
      return "Belum Ada Jadwal";
    }
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "-";
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(date);
    } catch (e) {
      return "-";
    }
  };

  const handleClaimAndGo = async () => {
    if (!eligibility?.sarpras_id) return;
    try {
      setProcessingId(eligibility.sarpras_id);
      setIsModalOpen(false);
      const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/inspections/${eligibility.schedule_id}/claim`, {
        method: 'POST'
      });
      if (res.ok) {
        router.push(`/inspection/form/${eligibility.sarpras_id}?scheduleId=${eligibility.schedule_id}`);
      } else {
        const errorData = await res.json();
        alert(errorData.message || "Gagal mengambil tugas");
      }
    } catch (err) {
      console.error("Claim error:", err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleCheckEligibility = async () => {
    if (!isChecker || !data) {
      alert('Anda tidak memiliki akses pemeriksa atau data belum dimuat.');
      return;
    }
    try {
      const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/sarpras/detail/${code}/checker-eligibility`);
      const json = await res.json();
      if (json.success) {
        setEligibility(json.data);
        if (json.data.eligible && json.data.is_due) {
          setIsModalOpen(true);
        } else {
          alert(json.data.reason || 'Tidak memenuhi syarat pemeriksaan.');
        }
      } else {
        alert(json.message || 'Gagal cek eligibility');
      }
    } catch (err) {
      console.error('Cek eligibility error:', err);
      alert('Terjadi kesalahan saat mengecek kelayakan.');
    }
  };

  const handleDownloadQRLabel = () => {
    if (!data || !data.qr_code || !data.code || !data.name) return;
    const qrImg = new Image();
    qrImg.src = data.qr_code;
    qrImg.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const qrSize = 600;
      const margin = 40;
      const textPadding = 30;
      canvas.width = qrSize + (margin * 2);
      canvas.height = qrSize + (margin * 2) + textPadding + 150;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(qrImg, margin, margin, qrSize, qrSize);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const centerX = canvas.width / 2;
      let currentY = margin + qrSize + textPadding;
      ctx.font = 'bold 36px "Inter", "Helvetica Neue", sans-serif';
      ctx.fillStyle = '#111827';
      ctx.fillText(data.name.toUpperCase(), centerX, currentY);
      currentY += 50;
      ctx.font = '28px "Inter", "Helvetica Neue", sans-serif';
      ctx.fillStyle = '#6b7280';
      ctx.fillText(`CODE : ${data.code}`, centerX, currentY);
      const finalImageDataUrl = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.href = finalImageDataUrl;
      link.download = `QR_${data.code}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
  };

  if (loading) return <div className="p-10 text-center font-black animate-pulse text-[#003d7a]">LOADING...</div>;
  if (!data) return <div className="p-10 text-center text-red-500 font-black">DATA TIDAK DITEMUKAN</div>;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto">
      <button
        onClick={() => router.push('/dashboard/list-sarpras')}
        className="mb-4 sm:mb-6 p-2.5 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 transition-all text-gray-600"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </button>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 uppercase tracking-tighter">{data.name}</h1>
          <p className="text-md sm:text-lg font-bold text-gray-400">CODE : <span className="text-[#003d7a]">{data.code}</span></p>
        </div>
        <div className="flex gap-3 mt-1">
          <StatusBadge status={data.status} />
          <RiskBadge risk={data.risk_level} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          <div className="bg-white p-5 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-6 md:mb-8">
              <div className="w-8 h-8 bg-[#003d7a] rounded-lg flex items-center justify-center text-white text-xs font-black">i</div>
              <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight uppercase">Informasi Sarpras</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-6 md:gap-y-10 gap-x-4">
              <InfoItem label="JENIS" value={data.name} />
              <InfoItem label="NOMOR SERI" value={data.serial_number} />
              <InfoItem label="SITE" value={data.site} />
              <InfoItem label="DEPARTEMEN" value={data.department} />
              <InfoItem label="LOKASI" value={data.location} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
            <div className="bg-white p-5 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-6 md:mb-8">
                <svg className="w-5 h-5 text-[#003d7a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <h2 className="text-xs sm:text-sm font-black text-gray-900 uppercase tracking-widest">Penanggung Jawab</h2>
              </div>
              <div className="space-y-5 md:space-y-6">
                <PicItem label="Pemeriksa Terakhir" value={data.pemeriksa} />
                <PicItem label="PIC Responsibility" value={data.pic_responsibility} />
              </div>
            </div>

            <div className="bg-white p-5 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-6 md:mb-8">
                <svg className="w-5 h-5 text-[#003d7a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h2 className="text-xs sm:text-sm font-black text-gray-900 uppercase tracking-widest">Jadwal</h2>
              </div>
              <div className="space-y-5 md:space-y-6">
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">TERAKHIR DIPERIKSA</p>
                  <p className="text-sm md:text-[15px] font-black text-emerald-600 uppercase">{formatDateIndo(data.last_inspected)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">JADWAL SELANJUTNYA</p>
                  <p className="text-sm md:text-[15px] font-black text-[#003d7a] uppercase">{formatDateIndo(data.next_due_date)}</p>
                </div>
              </div>
            </div>
          </div>

          {isChecker && eligibility?.eligible && (
            <div className="mt-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-gray-50 border border-gray-200 p-4 sm:p-5 rounded-2xl gap-4">
                <div className="text-center sm:text-left">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                    Batas Waktu Pemeriksaan
                  </p>
                  <p className="text-sm font-black text-gray-800 uppercase">
                    {!data.next_due_date || data.next_due_date === "0001-01-01T00:00:00Z"
                      ? "BELUM TERJADWAL"
                      : formatDateIndo(data.next_due_date)}
                  </p>
                </div>
                {eligibility.is_due ? (
                  <button
                  onClick={handleCheckEligibility}
                    disabled={processingId === eligibility.sarpras_id}
                    className="bg-[#003d7a] hover:bg-[#002d5a] text-white px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all shadow-lg active:scale-95 disabled:opacity-50 w-full sm:w-auto"
                  >
                    {processingId === eligibility.sarpras_id ? '...' : "Mulai Periksa ➔"}
                  </button>
                ) : (
                  <div className="text-center sm:text-right">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
                    <p className="text-[11px] font-black text-emerald-600 uppercase">
                      Belum Waktunya Diperiksa
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white p-5 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center">
          <h2 className="text-[11px] font-black text-gray-900 uppercase mb-6 sm:mb-8 tracking-[0.2em]">Digital QR Code</h2>
          <div className="p-4 sm:p-6 bg-gray-50 rounded-[2rem] mb-5 sm:mb-6 border border-gray-100 shadow-inner">
            <img src={data.qr_code} alt="QR Code" className="w-32 h-32 sm:w-44 sm:h-44 mix-blend-multiply" />
          </div>
          <p className="text-[11px] sm:text-[12px] font-black text-[#003d7a] uppercase mb-1 tracking-tight text-center">{data.name}</p>
          <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 mb-8 sm:mb-10">{data.code}</p>
          <button
            onClick={handleDownloadQRLabel}
            className="w-full py-3.5 sm:py-4.5 bg-[#003d7a] text-white rounded-2xl font-black text-[10px] tracking-[0.15em] uppercase hover:bg-[#002d5a] transition-all shadow-xl shadow-blue-900/20 active:scale-[0.98]"
          >
            Download QR
          </button>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[99] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-gray-100">
            <h3 className="text-center text-xl font-black text-gray-900 tracking-tight uppercase mb-4">Klaim Tugas?</h3>
            <p className="text-center text-gray-500 text-sm font-medium mb-8 italic">"Setelah diklaim, Anda bertanggung jawab menyelesaikan pemeriksaan ini."</p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-xs font-black uppercase text-gray-400"
              >
                Batal
              </button>
              <button
                onClick={handleClaimAndGo}
                className="flex-1 py-3 bg-[#003d7a] text-white rounded-xl text-xs font-black uppercase shadow-lg hover:bg-[#002d5a]"
              >
                Ya, Yakin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-1.5">{label}</p>
      <p className="text-xs sm:text-[13px] font-black text-gray-800 uppercase leading-tight">{value || '-'}</p>
    </div>
  );
}

function PicItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-xs sm:text-sm md:text-[14px] font-black text-gray-800 uppercase break-words">{value || '-'}</p>
    </div>
  );
}
