'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, API_BASE} from '@/lib/api';
import TransactionModal from "@/components/TransactionStatusModal"

interface SelectedApar {
  sarpras_id: number;
  sarpras_type: string;
  sarpras_no: string;
}

export default function SubmitPOPage() {
  const router = useRouter();
  const [selectedItems, setSelectedItems] = useState<SelectedApar[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setErrors] = useState<Record<string, string>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSuccess, setModalSuccess] = useState<boolean | null>(null);
  const [modalMessage, setModalMessage] = useState("");
  const [form, setForm] = useState({
    po_number: '',
    due_date: '',
  });



  useEffect(() => {
    const storedIds = sessionStorage.getItem('refill_selected_ids');
    if (!storedIds) {
      alert('Tidak ada data APAR yang dipilih.');
      router.back();
      return;
    }
    const ids: number[] = JSON.parse(storedIds);
    const fetchDetails = async () => {
      setIsLoading(true);
      try {
        const promises = ids.map(id =>
          apiFetch(`${API_BASE}/refill/${id}`).then(res => res.json())
        );
        const results = await Promise.all(promises);
        const items: SelectedApar[] = results.map((json: any) => ({
          sarpras_id: json.data.data.sarpras_id,
          sarpras_type: json.data.data.sarpras_type,
          sarpras_no: json.data.data.sarpras_no,
        }));
        setSelectedItems(items);
      } catch (err) {
        console.error('Gagal mengambil detail APAR:', err);
        alert('Gagal memuat data, silakan kembali dan coba lagi.');
        router.back();
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetails();
  }, [router]);

  const handleRemove = (id: number) => {
    const updated = selectedItems.filter(i => i.sarpras_id !== id);
    setSelectedItems(updated);
    sessionStorage.setItem('refill_selected_ids', JSON.stringify(updated.map(i => i.sarpras_id)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`${API_BASE}/refill/submit-po`, {
        method: 'POST',
        body: JSON.stringify({
          sarpras_ids: selectedItems.map(i => i.sarpras_id),
          po_number: form.po_number,
          due_date: new Date(form.due_date).toISOString(),
        }),
      });
      const result = await res.json();
      const success = !!result.success;
      const message = result.message || (success ? "Berhasil Submit PO!" : "Gagal Membuat PO");
      setModalSuccess(success);
      setModalMessage(message);
      setModalOpen(true);
      setTimeout(() => {
        setModalOpen(false);
        sessionStorage.removeItem('refill_selected_ids');
        router.push("/dashboard/refill");
      }, 3000);
    } catch (err) {
      setModalSuccess(false);
      setModalMessage("Terjadi kesalahan koneksi ke server.");
      setModalOpen(true);
      setTimeout(() => {
        setModalOpen(false);
        sessionStorage.removeItem('refill_selected_ids');
        router.push("/dashboard/refill");
      }, 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearErr = (k: string) => setErrors(p => { const n = { ...p }; delete n[k]; return n;}) 

  const validate = () => {
    const e: Record<string, string> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(form.due_date);
    if (!form.po_number) e.po_number = 'PO Number Wajib Diisi!';
    if (!form.due_date) e.due_date = 'Tanggal Due Date Wajib Diisi!';
    if (selectedDate < today) e.due_date = `Due Date Tidak Boleh Kurang Dari Hari ini`;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const inputCls = (hasError: boolean) => 
      `w-full px-4 py-3 rounded-xl border focus:ring-[#003d7a] ${
    hasError ? 'ring-2 ring-red-500' : 'focus:ring-[#003d7a]'
  }`;

  const handleCloseModal = () => {
    setModalOpen(false);
    router.push("/dashboard/refill");
  }

  if (isLoading) {
    return <div className="p-10 text-center">Memuat data...</div>;
  }

  return (
    <div className="min-h-screen bg-white p-6 lg:p-10">
      <div className="max-w-6xl mx-auto">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm font-bold text-[#003d7a] mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Kembali
        </button>
        <h1 className="text-3xl font-black text-slate-800">Isi Nomor Purchasing Order</h1>
        <p className="text-slate-500 mt-2">Silahkan isi nomor PO untuk APAR yang dipilih.</p>

        <div className="border rounded-xl overflow-hidden mt-8">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-6 py-4 text-left">No</th>
                <th className="px-6 py-4 text-left">Jenis Sarpras</th>
                <th className="px-6 py-4 text-left">Nomor Sarpras</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {selectedItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500">Tidak ada data</td>
                </tr>
              ) : (
                selectedItems.map((item, idx) => (
                  <tr key={item.sarpras_id}>
                    <td className="px-6 py-4">{idx + 1}</td>
                    <td className="px-6 py-4">{item.sarpras_type}</td>
                    <td className="px-6 py-4 font-bold text-[#003d7a]">{item.sarpras_no}</td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => handleRemove(item.sarpras_id)} className="text-red-500 hover:text-red-700">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          <path d="M10 11v5M14 11v5" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-slate-100 p-8 rounded-2xl mt-8">
          <div className="mb-4">
            <label className="block text-sm font-black text-[#003d7a] mb-1">Nomor PO *</label>
            <input
              type="text"
              value={form.po_number}
              onChange={e => { setForm(p => ({ ...p, po_number: e.target.value})); clearErr('po_number'); }}
              placeholder="PO-2026-001"
              className={inputCls(!!error.po_number)}
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-black text-[#003d7a] mb-1">Due Date *</label>
            <input
              type="date"
              value={form.due_date}
              onChange={e => {setForm(p => ({ ...p, due_date: e.target.value})); clearErr('due_date'); }}
              min={new Date().toISOString().split('T')[0]}
              className={inputCls(!!error.due_date)}
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!form.po_number || selectedItems.length === 0 || !form.due_date || isSubmitting}
            className="w-full bg-[#003d7a] text-white font-bold py-3 rounded-xl disabled:bg-gray-400"
          >
            {isSubmitting ? 'Submitting...' : 'Submit PO'}
          </button>
        </div>
      </div>
      <TransactionModal 
        isOpen={modalOpen}
        onClose={handleCloseModal}
        success={modalSuccess}
        message={modalMessage}
      />
    </div>
  );
}
