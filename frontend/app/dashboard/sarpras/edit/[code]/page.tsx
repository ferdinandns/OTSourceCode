'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch, API_BASE } from '@/lib/api';

export default function EditSarprasPage() {
  const router = useRouter();
  const { code } = useParams();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [formData, setFormData] = useState({
    id: '',
    code: '',
    name: '',
    type: '',
    dept: '',
    location_detail: '',
    notes: ''
  });

  useEffect(() => {
    const fetchDetail = async () => {
      if (!code) return;
      setIsLoading(true);
      try {
        const safeCode = decodeURIComponent(code as string);
        const res = await apiFetch(`${API_BASE}/sarpras/detail/${safeCode}`);
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          if (json.success && json.data) {
            const d = json.data;
            setFormData({
              id: d.ID || d.id,
              code: d.Code || d.code,
              name: d.SarprasTypeName || d.name,
              type: d.SarprasTypeName || d.type,
              dept: d.LocationDeptName || d.dept,
              location_detail: d.LocationDetail || d.location_detail,
              notes: ''
            });
          }
        } catch (parseErr) {
          console.error("Isi response yang rusak:", text);
          throw new Error("Backend mengirim format bukan JSON");
        }
      } catch (err) {
        console.error("Gagal ambil detail:", err);
        setError("Gagal memuat data sarpras");
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetail();
  }, [code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`${API_BASE}/sarpras/${formData.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          location_detail: formData.location_detail,
          notes: formData.notes
        })
      });
      if (res.ok) router.push('/dashboard/list-sarpras');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="p-10 text-center font-bold">Loading Data...</div>;
  if (error) return <div className="p-10 text-center text-red-500 font-bold">{error}</div>;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 sm:p-8 border-b border-gray-50 bg-[#003d7a]">
          <h1 className="text-white font-black uppercase tracking-widest text-base sm:text-lg">Edit Asset Sarpras</h1>
          <p className="text-blue-200 text-[11px] sm:text-xs mt-1">Hanya Lokasi Detail dan Notes yang dapat diubah.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-8 space-y-5 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-[11px] font-black text-gray-400 uppercase mb-2">Asset Code</label>
              <input 
                value={formData.code} 
                disabled 
                className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-gray-400 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-[11px] font-black text-gray-400 uppercase mb-2">Asset Name</label>
              <input 
                value={formData.name} 
                disabled 
                className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-gray-400 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Lokasi Detail <span className="text-red-500">*</span></label>
            <textarea
              required
              value={formData.location_detail}
              onChange={(e) => setFormData({...formData, location_detail: e.target.value})}
              rows={4}
              className="w-full bg-[#f1f5f9] border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-[#003d7a] outline-none transition-all resize-vertical"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Notes / Alasan Perubahan <span className="text-red-500">*</span></label>
            <textarea
              required
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Contoh: Pemindahan unit karena renovasi..."
              rows={3}
              className="w-full bg-[#f1f5f9] border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-[#003d7a] outline-none transition-all resize-vertical"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2 sm:gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="order-2 sm:order-1 py-3 sm:py-4 text-xs font-black uppercase text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all w-full sm:flex-1"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="order-1 sm:order-2 py-3 sm:py-4 bg-[#003d7a] text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-blue-900/20 active:scale-95 transition-all disabled:opacity-50 w-full sm:flex-[2]"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
