"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, API_BASE } from "@/lib/api";

interface NOKParameterDetail {
  parameter_name: string;
  notes: string;
  photo_url: string;
}

interface RepairDetailResponse {
  repair_order_id: number;
  pic_name: string;
  sarpras_code: string;
  sarpras_name: string;
  department: string;
  inspected_at: string;
  status: string;
  action_plan: string;
  due_date: string | null;
  nok_details: NOKParameterDetail[];
}

export default function ActionPlanPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id;

  const [selectedDetail, setSelectedDetail] = useState<RepairDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [actionPlanText, setActionPlanText] = useState("");
  const [chosenDueDate, setChosenDueDate] = useState("");

  const [minDateString, setMinDateString] = useState("");
  const [maxDateString, setMaxDateString] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const hasSetDefaultDueDate = useRef(false);

  useEffect(() => {
    const today = new Date();
    const maxLimit = new Date();
    maxLimit.setMonth(today.getMonth() + 3);

    const formatDateStr = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    setMinDateString(formatDateStr(today));
    setMaxDateString(formatDateStr(maxLimit));
  }, []);

   useEffect(() => {
    if (!id) return;

    const fetchDetailData = async () => {
      setIsLoading(true);
      try {
        const res = await apiFetch(`${API_BASE}/repairs/${id}`);
        const json = await res.json();
        if (json.success) {
          setSelectedDetail(json.data);
          setActionPlanText(json.data.action_plan || "");

          if (!hasSetDefaultDueDate.current) {
            if (json.data.due_date) {
              const dueDateStr = new Date(json.data.due_date).toISOString().split("T")[0];
              setChosenDueDate(dueDateStr);
            } else {
              const today = new Date();
              const maxLimit = new Date();
              maxLimit.setMonth(today.getMonth() + 3);
              const formatDateStr = (d: Date) => {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, "0");
                const day = String(d.getDate()).padStart(2, "0");
                return `${year}-${month}-${day}`;
              };
              setChosenDueDate(formatDateStr(maxLimit));
            }
            hasSetDefaultDueDate.current = true;
          }
        }
      } catch (err) {
        console.error("Gagal memuat detail data kerusakan:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetailData();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDetail || !actionPlanText.trim() || !chosenDueDate) return;

    const dueDateObj = new Date(chosenDueDate);
    if (isNaN(dueDateObj.getTime())) {
      alert("Tanggal tidak valid");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        action_plan: actionPlanText.trim(),
        due_date: dueDateObj.toISOString(),
      };
      console.log("Submitting due date:", chosenDueDate, payload);

      const res = await apiFetch(
        `${API_BASE}/repairs/${selectedDetail.repair_order_id}/action-plan`,
        { method: "POST", body: JSON.stringify(payload) }
      );
      if (res.ok) {
        setShowSuccessModal(true);
      } else {
        const err = await res.json();
        alert(err.message || "Gagal memperbarui database rencana perbaikan.");
      }
    } catch (err) {
      alert("Terjadi kegagalan koneksi jaringan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-20 text-center flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-[#003d7a] rounded-full animate-spin" />
        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Memuat formulir rencana perbaikan...</span>
      </div>
    );
  }

  if (!selectedDetail) {
    return (
      <div className="p-4 text-center italic text-slate-400 text-sm font-medium">
        Data perbaikan tidak ditemukan atau sudah diproses.
      </div>
    );
  }

  return (
    <div className="p-2 max-w-7xl mx-auto space-y-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      <div className="flex items-center gap-3 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <button
          type="button"
          onClick={() => router.back()}
          className="group p-2.5 hover:bg-slate-50 text-slate-400 hover:text-[#003d7a] rounded-xl transition-all border border-slate-200 cursor-pointer"
        >
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Isi Rencana Perbaikan</h2>
          <p className="text-xs font-semibold text-slate-400 mt-0.5">Silakan tetapkan rancangan tindakan korektif penanggulangan aset rusak.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        <div className="lg:col-span-5 space-y-6">
          
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#003d7a]" />
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center shrink-0">
                <svg className="w-8 h-8 text-[#003d7a]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Spesifikasi Unit</span>
                <h3 className="text-lg font-black text-slate-900 tracking-tight leading-none">{selectedDetail.sarpras_name}</h3>
                <span className="inline-block font-mono text-xs font-black text-[#003d7a] bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-md mt-1">
                  {selectedDetail.sarpras_code}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6 pt-5 border-t border-slate-100 text-xs">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Area / Departemen</span>
                <p className="font-bold text-slate-700 mt-0.5">{selectedDetail.department}</p>
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Tanggal Pemeriksaan</span>
                <p className="font-bold text-slate-700 mt-0.5 font-mono">{new Date(selectedDetail.inspected_at).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
            <h4 className="text-xs font-black text-red-600 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-3 bg-red-500 rounded-sm animate-pulse" /> Daftar Parameter NOK
            </h4>
            
            <div className="space-y-3">
              {selectedDetail.nok_details?.map((nok, idx) => (
                <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 flex gap-4 items-start group">
                  {nok.photo_url ? (
                    <img
                      src={`${process.env.NEXT_PUBLIC_MINIO_URL}/emertrack/${nok.photo_url.split("/").map((p) => encodeURIComponent(p)).join("/")}`}
                      alt="Defect Evidence"
                      className="w-20 h-20 object-cover rounded-lg bg-white border border-slate-200 shadow-sm cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                      onClick={() => setPreviewImage(`${process.env.NEXT_PUBLIC_MINIO_URL}/emertrack/${nok.photo_url.split("/").map((p) => encodeURIComponent(p)).join("/")}`)}
                    />
                  ) : (
                    <div className="w-20 h-20 bg-red-50 border border-dashed border-red-200 rounded-lg flex items-center justify-center text-red-300 shrink-0">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="space-y-1 flex-1">
                    <p className="text-xs font-black text-red-700 uppercase tracking-wide">{nok.parameter_name}</p>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
                      <p className="text-[11px] font-medium text-slate-600 leading-relaxed italic">" {nok.notes || "Tidak tersemat catatan khusus dari checker."} "</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 md:p-8 space-y-6">
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-0.5">PIC Responsibility</label>
              <div className="w-full px-4 py-3.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 flex items-center justify-between select-none">
                <span>{selectedDetail.pic_name}</span>
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest ml-0.5 flex justify-between">
                <span>Rencana Perbaikan (Action Plan) <span className="text-red-500 font-bold">*</span></span>
              </label>
              <textarea
                required
                rows={5}
                value={actionPlanText}
                onChange={(e) => setActionPlanText(e.target.value)}
                placeholder="Tuliskan secara lengkap langkah taktis perbaikan penanggulangan kerusakan di lapangan..."
                className="w-full bg-slate-50/70 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-[#003d7a] focus:bg-white outline-none transition-all resize-none placeholder:text-slate-300"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest ml-0.5">
                Target Batas Tanggal Selesai (Due Date) <span className="text-red-500 font-bold">*</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type="date"
                  required
                  min={minDateString}
                  max={maxDateString}
                  value={chosenDueDate}
                  onChange={(e) => setChosenDueDate(e.target.value)}
                  className="w-full bg-slate-50/70 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#003d7a] focus:bg-white outline-none transition-all cursor-pointer"
                />
              </div>
            </div>

            <div className="bg-blue-50/80 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-[10px] font-black text-blue-800 uppercase tracking-wider mb-0.5">Aturan Batas Waktu Penyelesaian</p>
                <p className="text-xs text-blue-600 font-semibold leading-relaxed">
                  Batas maksimal tanggal penyelesaian perbaikan adalah 3 bulan dari hari ini. Pilihan tanggal setelah batas tersebut tidak dapat dipilih.
                </p>
              </div>
            </div>

          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 text-xs font-black uppercase tracking-wider text-slate-500 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !actionPlanText.trim() || !chosenDueDate}
              className="px-8 py-3 bg-[#003d7a] hover:bg-[#002d5a] text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-blue-900/20 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? "Memproses Data..." : "Submit Action Plan"}
            </button>
          </div>

        </div>
      </form>

      {previewImage && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm transition-opacity"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[85vh] w-full flex justify-center items-center">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute -top-12 right-0 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-2 transition-all cursor-pointer"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={previewImage}
              alt="Bukti Temuan Kerusakan Besar"
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center space-y-5 animate-in zoom-in-95 duration-200">
            
            <div className="w-16 h-16 bg-green-50 border border-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Berhasil!</h3>
              <p className="text-sm font-medium text-slate-500 mt-1.5 leading-relaxed">
                Rencana perbaikan (Action Plan) beserta target batas waktu telah berhasil disimpan ke dalam sistem.
              </p>
            </div>
            
            <button
              type="button"
              onClick={() => {
                setShowSuccessModal(false);
                router.push("/dashboard/repair");
                router.refresh();
              }}
              className="w-full px-6 py-3.5 bg-[#003d7a] hover:bg-[#002d5a] text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-blue-900/20 active:scale-95 transition-all"
            >
              Oke, Kembali
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
