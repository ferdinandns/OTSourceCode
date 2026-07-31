"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, API_BASE } from "@/lib/api";
import TransactionModal from '@/components/TransactionStatusModal';

// Matches the Go DTO for parameter items.
type ParameterRequest = { 
  parameter_name: string; 
  parameter_desc: string; 
  order_no: number 
};

type Department = { id: number; name: string; code: string };

export default function TambahSarprastype() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [modalOpen, setModalOpen] = useState(false);
  const [modalSuccess, setModalSuccess] = useState<boolean | null>(null);
  const [modalMessage, setModalMessage] = useState("");

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    is_apar: false,
    pic_dept_id: "",
    insp_interval_months: 1, 
    notes: "",
    parameters: [] as ParameterRequest[],
  });

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Fetch departments for PIC department dropdown.
  useEffect(() => {
      apiFetch(`${API_BASE}/departments`)
          .then(res => res.json())
          .then(res => { if (res.success) setDepartments(res.data) });
  }, []);

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

    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        pic_dept_id: parseInt(formData.pic_dept_id),
        insp_interval_months: Number(formData.insp_interval_months),
        notes: formData.notes.trim()
      };

      const res = await apiFetch(`${API_BASE}/sarpras-types`, {
          method: "POST",
          body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!result.success) {
        if (result.errors && typeof result.errors === "object" && Object.keys(
          result.errors).length > 0) {
            setFieldErrors((prev) => ({...prev, ...result.errors}));
            setError("Mohon periksa kembali isian yang ditandai merah.");
            setIsLoading(false);
            return;
        }

        setModalSuccess(false);
        setModalMessage(result.message || result.error || "Gagal mengajukan data jenis sarpras baru.");
        setModalOpen(true);
        setIsLoading(false);
        return;
      }
      setModalSuccess(true);
      setModalMessage(result.message || 'Berhasil menambahkan user.');
      setModalOpen(true);
    } catch (err) {
      setModalSuccess(false);
      setModalMessage("Terjadi kesalahan koneksi ke server backend.");
      setModalOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    if (modalSuccess) {
      router.push("/dashboard/sarpras-types");
      router.refresh();
    }
  };

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
          <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-lg uppercase tracking-[0.2em] border border-blue-100">Request Form</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-6 items-stretch">
        
        <div className="w-full lg:w-[380px] space-y-6">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-xl shadow-slate-200/50 p-7 space-y-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#003d7a]"></div>
            
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Data Induk</h2>
              <p className="text-xs font-medium text-slate-400 mt-1">Informasi dasar identitas jenis sarpras.</p>
            </div>

            {error && (
              <div className="flex gap-2 items-start text-[13px] text-red-600 bg-red-50 p-4 rounded-2xl border border-red-100 animate-in fade-in zoom-in-95 duration-200">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <span className="font-bold">{error}</span>
              </div>
            )}
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">Kode <span className="text-red">*</span></label>
                <input 
                  type="text" 
                  placeholder="Contoh: APAR"
                  value={formData.code} 
                  onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} 
                  required 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm font-bold focus:ring-2 focus:ring-[#003d7a] focus:bg-white outline-none transition-all placeholder:text-slate-300" 
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">Nama Jenis Sarpras <span className="text-red">*</span></label>
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
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">PIC Departemen Penanggung Jawab <span className="text-red">*</span></label>
                <div className="relative">
                  <select 
                    value={formData.pic_dept_id} 
                    onChange={e => setFormData({...formData, pic_dept_id: e.target.value})} 
                    required 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#003d7a] focus:bg-white outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="">-- Pilih Departemen --</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <label className={`flex items-center gap-3 p-4 border rounded-2xl cursor-pointer transition-all ${formData.is_apar ? 'bg-red-50/70 border-red-200 ring-2 ring-red-100/60' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                  <input 
                    type="checkbox" 
                    checked={formData.is_apar} 
                    onChange={e => setFormData({...formData, is_apar: e.target.checked})} 
                    className="w-5 h-5 accent-red-600 cursor-pointer" 
                  />
                  <div className="flex flex-col">
                    <span className={`text-xs font-black uppercase tracking-tight ${formData.is_apar ? 'text-red-700' : 'text-slate-700'}`}>Kategori APAR</span>
                    <span className="text-[10px] text-slate-400 font-medium leading-tight">Aktifkan parameter kustom khusus fire safety</span>
                  </div>
                </label>
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
                  Notes Permohonan <span className="text-red-500 text-[9px] font-bold">*Wajib</span>
                </label>
                <textarea 
                  placeholder="Jelaskan alasan bisnis penambahan data jenis sarpras baru ini untuk verifikasi supervisor..."
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

        <div className="flex-1 bg-white border border-slate-100 rounded-3xl shadow-xl shadow-slate-200/50 flex flex-col overflow-hidden">
          <div className="p-7 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Parameter Inspeksi</h2>
              <p className="text-xs font-medium text-slate-400 mt-0.5">Tentukan poin pemeriksaan di lapangan. Tahan dan geser item untuk mengubah urutan.</p>
            </div>
            <button 
              type="button" 
              onClick={addParameter} 
              className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider text-[#003d7a] bg-blue-50 hover:bg-blue-100 rounded-xl transition-all cursor-pointer border border-blue-100 shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 stroke-[3]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Tambah Parameter
            </button>
          </div>

          <div className="flex-1 p-7 overflow-y-auto max-h-[600px] space-y-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            {formData.parameters.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-14 space-y-4 border-2 border-dashed border-slate-100 rounded-3xl">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-400 italic">Belum ada parameter pemeriksaan.</p>
                  <p className="text-xs font-bold text-slate-300 mt-1 uppercase tracking-wider">Silakan klik tombol "Tambah Item" untuk memulai.</p>
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
                      isCurrentlyDragged ? "bg-blue-500" : "group-hover:bg-blue-400"
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
                          placeholder="Nama Parameter (Contoh: Tekanan Selang Barometer)" 
                          className="flex-1 text-sm font-black text-slate-800 border-b-2 border-transparent focus:border-[#003d7a] outline-none pb-1 transition-all placeholder:text-slate-300" 
                          required 
                        />
                      </div>
                      <textarea 
                        value={param.parameter_desc} 
                        onChange={e => { const p = [...formData.parameters]; p[index].parameter_desc = e.target.value; setFormData({...formData, parameters: p}); }} 
                        placeholder="Jelaskan detail standar kriteria kelayakan pemeriksaan untuk poin parameter ini..." 
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
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:block">Perhatikan kembali data dan parameter pemeriksaan sebelum mengirim request</p>
            <button 
              type="submit" 
              disabled={isLoading} 
              className="px-10 py-3.5 bg-emerald-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-emerald-900/20 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Loading...
                </div>
              ) : "Submit"}
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
