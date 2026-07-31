"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function DetailSarprasType() {
  const router = useRouter();
  const params = useParams();
  const id = params.id;

  const [detailData, setDetailData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/sarpras-types/detail/${id}`, { 
          credentials: "include" 
        });
        const result = await res.json();
        
        if (result.success) {
          setDetailData(result.data);
        } else {
          setError(result.error || "Gagal memuat data detail.");
        }
      } catch (err) {
        setError("Terjadi kesalahan koneksi ke server.");
      } finally {
        setIsLoading(false);
      }
    };

    if (id) fetchDetail();
  }, [id]);

  if (isLoading) {
    return (
      <div className="p-10 flex flex-col items-center justify-center space-y-4">
        <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-slate-500 font-medium">Memuat detail sarpras...</span>
      </div>
    );
  }

  if (error || !detailData) {
    return (
      <div className="p-10 text-center">
        <div className="text-red-500 bg-red-50 p-4 rounded-xl inline-block font-medium">
          {error || "Data tidak ditemukan."}
        </div>
        <div className="mt-4">
          <button onClick={() => router.back()} className="text-blue-600 hover:underline">Kembali ke Daftar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors group">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 group-hover:-translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        <span className="font-medium">Kembali ke Daftar</span>
      </button>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Header Section */}
        <div className="p-8 border-b border-slate-200 bg-slate-50 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-48 h-48" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>

          <div className="relative z-10">
            <span className="font-mono text-sm font-bold text-blue-700 bg-blue-100 border border-blue-200 px-3 py-1 rounded-full shadow-sm">
              {detailData.code}
            </span>
            <h1 className="text-3xl font-bold text-slate-800 mt-4 tracking-tight">{detailData.sarpras_name}</h1>
            <div className="flex items-center gap-2 mt-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              <p className="text-sm font-medium text-slate-600">PIC Departemen: <span className="text-slate-900">{detailData.pic_department}</span></p>
            </div>
          </div>
        </div>

        {/* Parameters Section */}
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              Parameter Inspeksi
            </h2>
            <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              Total: {detailData.parameters?.length || 0} Parameter
            </span>
          </div>

          <div className="space-y-4">
            {detailData.parameters?.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl">
                <p className="text-slate-500">Belum ada parameter inspeksi untuk jenis sarpras ini.</p>
              </div>
            ) : (
              detailData.parameters.sort((a: any, b: any) => a.order_no - b.order_no).map((p: any) => (
                <div key={p.id} className="p-5 border border-slate-200 rounded-xl bg-white shadow-sm flex gap-4 items-start hover:border-blue-300 transition-colors">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-50 text-blue-700 font-bold rounded-full border border-blue-100 flex items-center justify-center text-sm shadow-sm">
                    {p.order_no}
                  </div>
                  <div className="pt-0.5">
                    <h3 className="font-bold text-slate-800">{p.name}</h3>
                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">{p.desc}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
