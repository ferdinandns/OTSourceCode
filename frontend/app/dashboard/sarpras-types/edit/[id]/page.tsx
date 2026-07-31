"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiFetch, API_BASE } from "@/lib/api";
import TransactionModal from '@/components/TransactionStatusModal';

// Matches the Go DTO for parameter items.
type Parameter = { 
  parameter_name: string; 
  parameter_desc: string; 
  order_no: number 
};

export default function EditSarprastype() {
  const router = useRouter();
  const params = useParams();
  const id = params.id;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalSuccess, setModalSuccess] = useState<boolean | null>(null);
  const [modalMessage, setModalMessage] = useState("");

  // Read-only metadata displayed from the server.
  const [infoData, setInfoData] = useState({ code: "", pic: "" });

  // Form state mirroring the backend update DTO.
  const [formData, setFormData] = useState({
    name: "",
    insp_interval_months: 1,
    notes: "",
    parameters: [] as Parameter[],
  });

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await apiFetch(`${API_BASE}/sarpras-types/detail/${id}`);
        const result = await res.json();
        
        if (result.success) {
          const d = result.data;
          setInfoData({ code: d.code, pic: d.pic_department });
          
          // Map API response fields (name, desc) to form DTO property names.
          const mappedParams = d.parameters.map((p: any) => ({
            parameter_name: p.name,
            parameter_desc: p.desc,
            order_no: p.order_no
          }));

          setFormData({
            name: d.sarpras_name || "",
            insp_interval_months: d.insp_interval_months || 1,
            // Reset notes field to require the user to provide a new revision reason.
            notes: "",
            parameters: mappedParams,
          });
        } else {
          setError(result.error || "Gagal memuat detail data.");
        }
      } catch (err) {
        console.error(err);
        setError("Gagal mengambil data detail jenis sarpras dari server.");
      } finally {
        setIsLoading(false);
      }
    };

    if (id) fetchDetail();
  }, [id]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOverItem = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const _params = [...formData.parameters];
    const draggedItem = _params.splice(draggedIndex, 1)[0];
    _params.splice(targetIndex, 0, draggedItem);
    
    setFormData({ 
      ...formData, 
      parameters: _params.map((p, i) => ({ ...p, order_no: i + 1 })) 
    });

    setDraggedIndex(targetIndex);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const addParameter = () => {
    setFormData({
      ...formData,
      parameters: [
        ...formData.parameters,
        { parameter_name: "", parameter_desc: "", order_no: formData.parameters.length + 1 }
      ]
    });
  };

  const removeParameter = (targetIndex: number) => {
    const _params = [...formData.parameters];
    _params.splice(targetIndex, 1);
    
    setFormData({
      ...formData,
      parameters: _params.map((x, i) => ({ ...x, order_no: i + 1 }))
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.parameters.length === 0) {
      return setError("Minimal harus terdapat 1 parameter inspeksi!");
    }
    if (!formData.notes.trim()) {
      return setError("Notes permohonan wajib diisi untuk keperluan pelacakan audit!");
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        name: formData.name.trim(),
        insp_interval_months: Number(formData.insp_interval_months),
        notes: formData.notes.trim(),
        parameters: formData.parameters
      };

      const res = await apiFetch(`${API_BASE}/sarpras-types/${id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
      });

      const result = await res.json();
      const success = !!result.success;
      const message = result.message || result.error || (success ? "Berhasil." : "Gagal mengajukan pengubahan data jenis sarpras.");
      setModalSuccess(success);
      setModalMessage(message);
      setModalOpen(true);
    } catch (err) {
      setModalSuccess(false);
      setModalMessage("Terjadi kesalahan koneksi ke server backend.");
      setModalOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    if (modalSuccess) {
      router.push("/dashboard/sarpras-types");
      router.refresh();
    }
  }

  if (isLoading) {
    return (
      <div className="p-20 text-center flex flex-col items-center justify-center space-y-3">
        <svg className="animate-spin h-8 w-8 text-[#003d7a]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        <span className="text-sm text-slate-500 font-bold tracking-wide">Mengambil detail data dari sistem...</span>
      </div>
    );
  }

  return (
    <div className="p-2 max-w-6xl mx-auto space-y-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="flex items-center justify-between">
        <button 
          type="button"
          onClick={() => router.back()} 
          className="group flex items-center gap-2 text-slate-400 hover:text-[#003d7a] transition-all font-black text-sm uppercase tracking-widest cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 transition-transform group-hover:-translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          Kembali
        </button>
        <div className="text-right">
          <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-lg uppercase tracking-[0.2em] border border-amber-100">Revision Request</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-6 items-stretch">
        
        <div className="w-full lg:w-[380px] space-y-6">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-xl shadow-slate-200/50 p-7 space-y-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
            
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Ubah Data Induk</h2>
              <p className="text-xs font-medium text-slate-400 mt-1">Identitas kode unik dan departemen PIC terkunci demi konsistensi data.</p>
            </div>

            {error && (
              <div className="flex gap-2 items-start text-[13px] text-red-600 bg-red-50 p-4 rounded-2xl border border-red-100 animate-in fade-in zoom-in-95 duration-200">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <span className="font-bold">{error}</span>
              </div>
            )}
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1">Kode</label>
                <input 
                  type="text" 
                  value={infoData.code} 
                  disabled
                  className="w-full px-4 py-3 bg-slate-100/70 border border-slate-200 rounded-xl font-mono text-sm font-bold text-slate-400 outline-none cursor-not-allowed select-none" 
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1">PIC Departemen Penanggung Jawab</label>
                <input 
                  type="text" 
                  value={infoData.pic} 
                  disabled
                  className="w-full px-4 py-3 bg-slate-100/70 border border-slate-200 rounded-xl text-sm font-bold text-slate-400 outline-none cursor-not-allowed select-none" 
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">Nama Jenis Sarpras</label>
                <input 
                  type="text" 
                  placeholder="Contoh: Alat Pemadam Api Ringan"
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  required 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#003d7a] focus:bg-white outline-none transition-all" 
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1 flex justify-between">
                  Interval Siklus Inspeksi <span>(1-12 Bulan)</span>
                </label>
                <div className="relative flex items-center">
                  <input 
                    type="number" 
                    min="1" 
                    max="12"
                    value={formData.insp_interval_months} 
                    onChange={e => setFormData({...formData, insp_interval_months: parseInt(e.target.value) || 1})} 
                    required 
                    className="w-full pl-4 pr-16 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black focus:ring-2 focus:ring-[#003d7a] focus:bg-white outline-none transition-all" 
                  />
                  <span className="absolute right-4 text-[10px] font-black text-slate-400 uppercase tracking-widest pointer-events-none">Bulan</span>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1 flex justify-between">
                  Notes<span className="text-red-500 text-[9px] font-bold">*Wajib</span>
                </label>
                <textarea 
                  placeholder="Wajib jelaskan detail alasan mengapa dilakukan perubahan konfigurasi data master ini..."
                  value={formData.notes} 
                  onChange={e => setFormData({...formData, notes: e.target.value})} 
                  required 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#003d7a] focus:bg-white outline-none transition-all resize-none placeholder:text-slate-300" 
                  rows={3}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 bg-white border border-slate-100 rounded-3xl shadow-xl shadow-slate-200/50 p-0 flex flex-col overflow-hidden">
          <div className="p-7 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Manajemen Parameter</h2>
              <p className="text-xs font-medium text-slate-400 mt-0.5">Sesuaikan poin checklist pemeriksaan lapangan. Tahan dan geser item untuk merubah urutan.</p>
            </div>
            <button 
              type="button" 
              onClick={addParameter} 
              className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider text-[#003d7a] bg-blue-50 hover:bg-blue-100 rounded-xl transition-all cursor-pointer border border-blue-100 shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 stroke-[3]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Tambah Poin
            </button>
          </div>

          <div className="flex-1 p-7 overflow-y-auto max-h-[600px] space-y-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            {formData.parameters.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-14 space-y-4 border-2 border-dashed border-slate-100 rounded-3xl">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-400 italic">Daftar parameter kosong.</p>
                  <p className="text-xs font-bold text-slate-300 mt-1 uppercase tracking-wider">Silakan klik tombol "Tambah Poin" untuk membuat checklist.</p>
                </div>
              </div>
            ) : (
              formData.parameters.map((param, index) => {
                const isCurrentlyDragged = draggedIndex === index;

                return (
                  <div 
                    key={index} 
                    draggable 
                    onDragStart={(e) => handleDragStart(e, index)} 
                    onDragOver={(e) => handleDragOverItem(e, index)} 
                    onDragEnd={handleDragEnd} 
                    className={`group flex items-start gap-4 p-5 border border-slate-100 bg-white rounded-2xl shadow-sm hover:shadow-md hover:border-blue-100 cursor-grab active:cursor-grabbing relative overflow-hidden transition-all duration-150 ease-in-out ${
                      isCurrentlyDragged ? "opacity-20 border-dashed border-blue-400 bg-blue-50/40 scale-[0.97]" : ""
                    }`}
                  >
                    <div className={`absolute top-0 left-0 w-1 h-full bg-slate-100 transition-colors ${
                      isCurrentlyDragged ? "bg-amber-500" : "group-hover:bg-blue-400"
                    }`}></div>
                    
                    <div className="pt-1 text-slate-300 group-hover:text-blue-400 transition-colors select-none">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                    </div>

                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="h-6 min-w-[24px] flex items-center justify-center bg-slate-900 text-white rounded-lg text-[10px] font-black shadow-inner">
                          {param.order_no}
                        </span>
                        <input 
                          value={param.parameter_name} 
                          onChange={e => { const p = [...formData.parameters]; p[index].parameter_name = e.target.value; setFormData({...formData, parameters: p}); }} 
                          placeholder="Nama Parameter (Contoh: Masa Kedaluwarsa Media)" 
                          className="flex-1 text-sm font-black text-slate-800 border-b-2 border-transparent focus:border-[#003d7a] outline-none pb-1 transition-all placeholder:text-slate-300" 
                          required 
                        />
                      </div>
                      <textarea 
                        value={param.parameter_desc} 
                        onChange={e => { const p = [...formData.parameters]; p[index].parameter_desc = e.target.value; setFormData({...formData, parameters: p}); }} 
                        placeholder="Jelaskan instruksi kriteria penilaian kelayakan poin ini di lapangan..." 
                        className="w-full text-xs font-medium text-slate-500 bg-slate-50/50 border border-slate-100 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all min-h-[70px]" 
                        rows={2} 
                        required 
                        onDragOver={(e) => e.stopPropagation()}
                      />
                    </div>

                    <button 
                      type="button" 
                      onClick={() => removeParameter(index)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer flex-shrink-0"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-7 bg-slate-50/50 border-t border-slate-100 flex justify-end items-center gap-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:block">Periksa kembali instruksi parameter sebelum menyimpan</p>
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="px-10 py-3.5 bg-amber-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-amber-900/20 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Menyimpan Perubahan...
                </div>
              ) : "Simpan Perubahan"}
            </button>
          </div>
        </div>
      </form>
      <TransactionModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        success={modalSuccess}
        message={modalMessage}
      />
    </div>
  );
}
