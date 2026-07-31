"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { apiFetch, API_BASE } from "@/lib/api";

// Matches the Go DTO and domain view rows.
type SarprasTypeList = {
  id: number;
  code: string;
  name: string;
  is_apar: boolean;
  pic_dept_code: string;
  pic_dept_name: string;
  insp_interval_months: number;
};

export default function MasterSarprasTypesList() {
  const [dataList, setDataList] = useState<SarprasTypeList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteNotes, setDeleteNotes] = useState("");
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchList = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/sarpras-types`);
      const result = await res.json();
      if (result.success) {
        setDataList(result.data || []);
      }
    } catch (err) {
      console.error("Gagal memuat list jenis sarpras:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const handleDeleteTrigger = (id: number) => {
    setItemToDelete(id);
    setDeleteNotes("");
    setShowDeleteModal(true);
  };

  const executeDelete = async () => {
    // Notes cannot be empty because the deletion reason is required for audit trail.
    if (!deleteNotes.trim()) return;
    
    setIsDeleting(true);
    try {
      const res = await apiFetch(`${API_BASE}/sarpras-types/${itemToDelete}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: deleteNotes.trim() }),
      });
      const result = await res.json();
      if (result.success) {
        setShowDeleteModal(false);
        fetchList();
      } else {
        alert(result.error || "Gagal menghapus data.");
      }
    } catch (err) {
      console.error(err);
      alert("Kesalahan koneksi ke server.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Perform client‑side filtering for immediate UI responsiveness.
  const filteredData = dataList.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.pic_dept_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-1 max-w-7xl mx-auto space-y-7 w-full animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl border border-slate-100 shadow-sm gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Master Jenis Sarpras</h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">
            Konfigurasi parameter inspeksi, departemen penanggung jawab, dan jangka waktu siklus uji kelayakan.
          </p>
        </div>
        <Link
          href="/dashboard/sarpras-types/add"
          className="flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-wider text-white bg-[#003d7a] rounded-xl hover:bg-[#002d5a] shadow-lg shadow-blue-900/10 transition-all hover:-translate-y-0.5 active:translate-y-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 stroke-[3]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Tambah Jenis Baru
        </Link>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center">
        <div className="relative w-full max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </span>
          <input
            type="text"
            placeholder="Cari berdasarkan kode, nama jenis, atau PIC..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#003d7a] focus:bg-white transition-all placeholder-slate-400"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl shadow-xl shadow-slate-100/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100">
                <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest w-16">No</th>
                <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Identitas Kode</th>
                <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Deskripsi Jenis Sarpras</th>
                <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Interval Cek</th>
                <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">PIC Penanggung Jawab</th>
                <th className="px-6 py-4 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest w-36">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-20 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <svg className="animate-spin h-7 w-7 text-[#003d7a]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      <span className="text-sm text-slate-500 font-bold tracking-wide">Sinkronisasi Master Data...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                 <tr>
                   <td colSpan={6} className="p-16 text-center text-slate-400 text-sm font-medium italic">
                     Tidak ditemukan data jenis sarpras yang sesuai.
                   </td>
                 </tr>
              ) : filteredData.map((item, index) => (
                <tr key={item.id} className="hover:bg-slate-50/40 transition-colors group">
                  <td className="px-6 py-4.5 text-sm font-bold text-slate-400">{index + 1}</td>
                  <td className="px-6 py-4.5">
                    <span className="font-mono text-xs font-black text-[#003d7a] bg-[#eef4fa] border border-blue-100/70 px-2.5 py-1.5 rounded-lg shadow-sm">
                      {item.code}
                    </span>
                  </td>
                  <td className="px-6 py-4.5">
                    <div className="text-sm font-bold text-slate-900 group-hover:text-[#003d7a] transition-colors">{item.name}</div>
                    {item.is_apar && (
                      <span className="text-[9px] font-black bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-md mt-1.5 inline-flex items-center gap-1 uppercase tracking-wider">
                        <span className="h-1 w-1 bg-red-500 rounded-full animate-pulse" />
                        Aset Proteksi Kebakaran
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black text-slate-800 bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-md">
                        {item.insp_interval_months}
                      </span>
                      <span className="text-xs font-bold text-slate-500">Bulan</span>
                    </div>
                  </td>
                  <td className="px-6 py-4.5">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-800">{item.pic_dept_name}</span>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase mt-0.5 tracking-wider">CODE: {item.pic_dept_code || "N/A"}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4.5 text-center">
                    <div className="flex justify-center items-center gap-1">
                      <Link 
                        href={`/dashboard/sarpras-types/${item.id}`} 
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all" 
                        title="Lihat Kontrak & Parameter"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      </Link>
                      
                      <Link 
                        href={`/dashboard/sarpras-types/edit/${item.id}`} 
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" 
                        title="Edit Konfigurasi"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                      </Link>
                      
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[150] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border-t-[4px] border-red-500 animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              </div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight mb-1">Hapus Konfigurasi Jenis Sarpras?</h3>
              <p className="text-xs font-medium text-slate-500 mb-5 leading-relaxed">
                Tindakan penghapusan ini memerlukan validasi supervisor. Alasan penghapusan wajib diisi dengan jelas demi akurasi sistem penelusuran audit log.
              </p>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest flex justify-between">
                  <span>Alasan Penghapusan</span>
                  <span className="text-red-500 font-bold">*Wajib</span>
                </label>
                <textarea 
                  value={deleteNotes} 
                  onChange={(e) => setDeleteNotes(e.target.value)}
                  placeholder="Contoh: Terjadi duplikasi master data / Tipe sarpras sudah diskontinu dari pabrik..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-sm font-medium transition-all resize-none bg-slate-50 focus:bg-white placeholder-slate-400"
                  rows={3}
                  required
                />
              </div>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
              <button 
                onClick={() => setShowDeleteModal(false)} 
                className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                disabled={isDeleting}
              >
                Batal
              </button>
              <button 
                onClick={executeDelete} 
                disabled={!deleteNotes.trim() || isDeleting} 
                className="px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all shadow-sm shadow-red-200 cursor-pointer"
              >
                {isDeleting ? "Memproses..." : "Kirim Pengajuan Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
