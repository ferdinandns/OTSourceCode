// src/components/qcReleaseCard.tsx
"use client";

import { useState } from "react";
import Cookies from "js-cookie";
import { RefreshCw, X } from "lucide-react";
import { QcReleaseData } from "@/types";
import { AccessRule, hasAccess } from "@/lib/access";
import { apiFetch } from "@/lib/api";

interface QcReleaseCardProps {
  data: QcReleaseData[];
  apiPostUrl: string;
  onSuccess: () => void;
  access?: AccessRule;
}

/**
 * Komponen UI Card untuk Modul "QC Release".
 * 
 * **Konsep Arsitektural:**
 * - Berperilaku hampir sama dengan `QcAnalisaCompleteCard`, namun didesain sebagai 
 *   langkah final dalam alur QC. State `safeData` digunakan sebagai bentuk *defensive programming*
 *   untuk mencegah `undefined` error saat `filter()` jika props dari server kosong.
 */
export default function QcReleaseCard({ data, apiPostUrl, onSuccess, access }: QcReleaseCardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [keterangan, setKeterangan] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const isGuest = Cookies.get("level") === "guest";
  const allowed = hasAccess(access);
  const safeData = data || [];

  const filteredData = safeData.filter((item) => 
    item.no_batch.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.kode_ruah.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.kode_produk.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCheckSingle = (id: number) => {
    if (!allowed) return;
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(val => val !== id));
    else setSelectedIds([...selectedIds, id]);
  };

  const handleSubmit = async () => {
    if (!allowed) {
      setErrorMsg("Anda tidak memiliki akses untuk melakukan aksi ini.");
      return;
    }
    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const response = await apiFetch(apiPostUrl, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Cookies.get("token")}` 
        },
        body: JSON.stringify({
          id: selectedIds,
          ket: keterangan || "-"
        }),
      });

      if (response.ok) {
        setIsModalOpen(false);
        setSelectedIds([]);
        setKeterangan("");
        onSuccess();
      } else {
        const errData = await response.json();
        setErrorMsg(errData.message || "Gagal mengirim data.");
      }
    } catch (error) {
      setErrorMsg("Koneksi ke server gagal.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[400px]">
        {/* Header Sesuai Screenshot */}
        <div className="bg-[#c7d6ab] p-3 flex justify-between items-center shrink-0">
          <div>
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              QC RELEASE
              <span className="bg-white text-black text-xs font-bold px-2 py-0.5 rounded-full">Total: {safeData.length}</span>
            </h3>
            <p className="text-sm text-gray-700">Departement QC</p>
          </div>
          <button 
            onClick={onSuccess}
            className="bg-white p-2 rounded hover:bg-gray-100 transition shadow-sm text-gray-700 cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex-1 flex flex-col gap-3 min-h-0">
          <input 
            type="text" 
            placeholder="Cari Kode Ruah/Kode Produk/No Batch..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-gray-300 rounded p-2 text-sm text-black focus:outline-none focus:ring-1 focus:ring-[#c7d6ab] focus:border-[#c7d6ab]"
          />

          {/* List Sesuai Format Screenshot */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-0">
            {filteredData.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center mt-4">Tidak ada data tersedia.</p>
            ) : (
              filteredData.map((batch) => (
                <label key={batch.id} className="flex items-start gap-3 p-2 cursor-pointer hover:bg-gray-50 transition border-b border-gray-100 rounded">
                  {!isGuest && (
                    <input 
                      type="checkbox" 
                      checked={selectedIds.includes(batch.id)}
                      onChange={() => handleCheckSingle(batch.id)}
                      disabled={!allowed}
                      title={!allowed ? "Anda tidak memiliki akses untuk melakukan aksi ini" : undefined}
                      className="mt-1 w-4 h-4 text-[#c7d6ab] focus:ring-[#c7d6ab] rounded shrink-0 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                    />
                  )}
                  <div className="text-sm text-gray-800 leading-relaxed">
                    {batch.kode_ruah} - {batch.kode_produk} - {batch.no_batch} | <br />
                    <span className="text-gray-600">
                      (Compounding: {batch.mixing_tank || "-"} / ST: {batch.storage_tank || "-"})
                    </span>
                  </div>
                </label>
              ))
            )}
          </div>

          {!isGuest && (
            <button 
              onClick={() => allowed && setIsModalOpen(true)}
              disabled={selectedIds.length === 0 || !allowed}
              title={!allowed ? "Anda tidak memiliki akses untuk melakukan aksi ini" : undefined}
              className={`w-full py-2.5 rounded font-bold transition flex-shrink-0 ${
                selectedIds.length > 0 && allowed ? "bg-[#c7d6ab] hover:bg-[#b3c494] text-gray-800 cursor-pointer" : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              Kirim Batch Terpilih
            </button>
          )}
        </div>
      </div>

      {/* MODAL POP-UP KONFIRMASI */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-pop-in">
            <div className="bg-yellow-400 p-4 flex justify-between items-center">
              <h5 className="font-bold text-gray-900">Konfirmasi QC Release</h5>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-800 hover:text-black cursor-pointer">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-5">
              <p className="text-sm text-gray-700 mb-2">Batch yang akan dikirim ({selectedIds.length} item):</p>
              
              <ul className="border border-gray-200 rounded max-h-32 overflow-y-auto mb-4 bg-gray-50">
                {safeData.filter(b => selectedIds.includes(b.id)).map(b => (
                  <li key={b.id} className="text-xs text-black p-2 border-b border-gray-200 last:border-0 font-medium">
                    {b.kode_ruah} - {b.kode_produk} - {b.no_batch}
                  </li>
                ))}
              </ul>

              <textarea 
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Keterangan (opsional)"
                className="w-full border border-gray-300 rounded p-2 text-sm text-black focus:outline-none focus:ring-1 focus:ring-yellow-400 min-h-[80px]"
              />

              {errorMsg && <p className="text-red-500 text-xs mt-2">{errorMsg}</p>}
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50">
              <button 
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 bg-gray-500 text-white rounded text-sm font-semibold hover:bg-gray-600 transition cursor-pointer"
              >
                Batal
              </button>
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 bg-green-600 text-white rounded text-sm font-semibold hover:bg-green-700 transition flex items-center gap-2 cursor-pointer"
              >
                {isSubmitting ? "Memproses..." : "Ya, Kirim"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}