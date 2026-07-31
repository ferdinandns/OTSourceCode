// src/components/produksiFillingCard.tsx
"use client";

import { useState } from "react";
import Cookies from "js-cookie";
import { RefreshCw } from "lucide-react";
import { FillingData } from "@/types";
import { calculateDuration } from "@/utils/formatTime";
import { apiFetch } from "@/lib/api";

interface ProduksiFillingCardProps {
  liquidData: FillingData[];
  powderData: FillingData[];
  apiPostUrl: string;
  onSuccess: () => void;
  mesinOptions: string[]; // Opsi dropdown dari backend
}

/**
 * Komponen UI Card untuk Modul "Produksi Filling".
 * 
 * **Konsep Arsitektural:**
 * 1. **Pemisahan Alur (Liquid vs Powder)**: Komponen ini mendemonstrasikan pola UI terbelah (Split UI) 
 *    di mana alur "Auto Kirim" (Liquid) dirender bersebelahan dengan "Manual Kirim" (Powder). 
 *    Ini mengakomodasi perbedaan logika bisnis di sisi manufaktur tanpa harus membuat dua komponen yang sepenuhnya terpisah.
 * 2. **Local Form State Management**: Menyimpan state pilihan dropdown (`powderSelections`) secara terisolasi 
 *    di memori komponen, sehingga saat satu baris (batch) di-submit ke backend, baris lainnya tidak terpengaruh.
 * 3. **API Integration**: Memanfaatkan `apiFetch` untuk mengirim data POST secara terotentikasi ke backend.
 */
export default function ProduksiFillingCard({
  liquidData, powderData, apiPostUrl, onSuccess, mesinOptions
}: ProduksiFillingCardProps) {

  const [searchLiquid, setSearchLiquid] = useState("");
  const [searchPowder, setSearchPowder] = useState("");

  // State untuk menyimpan pilihan mesin dari masing-masing batch Powder
  // Format: { [id_batch]: "Nama Mesin" }
  const [powderSelections, setPowderSelections] = useState<Record<number, string>>({});
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  const isGuest = Cookies.get("level") === "guest";

  // Filter Data Liquid
  const filteredLiquid = (liquidData || []).filter(item =>
    item.kode_produk.toLowerCase().includes(searchLiquid.toLowerCase()) ||
    item.no_batch.toLowerCase().includes(searchLiquid.toLowerCase()) ||
    (item.mesin_filling && item.mesin_filling.toLowerCase().includes(searchLiquid.toLowerCase()))
  );

  // Filter Data Powder disamakan dengan Liquid
  const filteredPowder = (powderData || []).filter(item =>
    item.kode_produk.toLowerCase().includes(searchPowder.toLowerCase()) ||
    item.no_batch.toLowerCase().includes(searchPowder.toLowerCase()) ||
    (item.mesin_filling && item.mesin_filling.toLowerCase().includes(searchPowder.toLowerCase()))
  );

  // Handler Pilihan Dropdown
  const handleSelectMesin = (id: number, val: string) => {
    setPowderSelections(prev => ({ ...prev, [id]: val }));
  };

  // Handler Submit untuk Powder
  const handleKirimPowder = async (id: number) => {
    const selectedMesin = powderSelections[id];
    if (!selectedMesin) return;

    setSubmittingId(id);

    try {
      const response = await apiFetch(apiPostUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Cookies.get("token")}`
        },
        body: JSON.stringify({
          id: id ? [id] : [],
          text: selectedMesin
        }),
      });

      if (response.ok) {
        // Hapus pilihan dari state setelah sukses
        setPowderSelections(prev => {
          const newState = { ...prev };
          delete newState[id];
          return newState;
        });
        onSuccess(); // Refresh komponen
      } else {
        const errData = await response.json();
        alert(errData.message || "Gagal mengirim data.");
      }
    } catch (error) {
      alert("Koneksi ke server gagal.");
    } finally {
      setSubmittingId(null);
    }
  };

  // Helper render waktu
  const renderWaktu = (waktuStr?: string) => {
    if (!waktuStr) return "-";
    const d = new Date(waktuStr);
    return `${d.toLocaleDateString('id-ID')} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col h-105 w-full">
      {/* Header Utama */}
      <div className="bg-[#c7d6ab] p-3 flex justify-between items-center shrink-0">
        <div>
          <h3 className="font-bold text-gray-800 uppercase">PRODUKSI FILLING</h3>
          <p className="text-sm text-gray-700">Departement Produksi</p>
        </div>
        <button
          onClick={onSuccess}
          className="bg-white p-2 rounded hover:bg-gray-100 transition shadow-sm text-gray-700 cursor-pointer"
          title="Refresh Data"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Konten Terbagi Dua (Grid) */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 overflow-hidden">

        {/* ================= KOLOM KIRI: LIQUID ================= */}
        <div className="flex flex-col h-full overflow-hidden border-r border-gray-100 pr-2">
          <div className="flex items-center gap-2 mb-2 shrink-0">
            <h4 className="font-bold text-gray-800">Auto Kirim</h4>
            <span className="bg-gray-800 text-white text-xs font-bold px-2 py-0.5 rounded-full">Total: {(liquidData || []).length}</span>
          </div>

          <input
            type="text"
            placeholder="Search kode produk / batch / mesin..."
            value={searchLiquid}
            onChange={(e) => setSearchLiquid(e.target.value)}
            className="w-full border border-gray-300 rounded p-2 text-sm text-black focus:outline-none focus:border-[#c7d6ab] mb-3 shrink-0"
          />

          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {filteredLiquid.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center mt-4">Tidak ada data Liquid.</p>
            ) : (
              filteredLiquid.map(item => (
                <div key={item.id} className="border border-gray-200 rounded p-2 shadow-sm hover:shadow transition bg-white">
                  {/* <h5 className={`font-bold ${item.status_lead === 'OVER' ? 'text-red-600' : 'text-gray-800'}`}>
                    {item.kode_produk} - {item.no_batch}
                  </h5> */}
                  <h5 className={`font-bold ${!item.mesin_filling ? 'text-red-600' : 'text-gray-800'}`}>
                    {item.kode_produk} - {item.no_batch}
                  </h5>
                  <div className="mt-1 space-y-0.5 text-sm text-gray-600">
                    <p>Mesin Filling: <span className="font-medium text-black">{item.mesin_filling || "-"}</span></p>
                    <p>Waktu Kirim: {renderWaktu(item.kirim_ke_filling)}</p>
                    <p>Total durasi: {calculateDuration(item.kirim_ke_filling)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ================= KOLOM KANAN: POWDER ================= */}
        <div className="flex flex-col h-full overflow-hidden pl-2">
          <div className="flex items-center gap-2 mb-2 shrink-0">
            <h4 className="font-bold text-gray-800">Manual Kirim</h4>
            <span className="bg-gray-800 text-white text-xs font-bold px-2 py-0.5 rounded-full">Total: {(powderData || []).length}</span>
          </div>

          {/* Form input disamakan dengan Liquid (tanpa tombol button cari) */}
          <input
            type="text"
            placeholder="Search kode produk / batch / mesin..."
            value={searchPowder}
            onChange={(e) => setSearchPowder(e.target.value)}
            className="w-full border border-gray-300 rounded p-2 text-sm text-black focus:outline-none focus:border-[#c7d6ab] mb-3 shrink-0"
          />

          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {filteredPowder.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center mt-4">Tidak ada data Powder.</p>
            ) : (
              filteredPowder.map(item => {
                const selectedVal = powderSelections[item.id] || "";
                const isProcessing = submittingId === item.id;

                return (
                  <div key={item.id} className="border border-gray-200 rounded p-2 shadow-sm hover:shadow transition bg-white flex flex-col">
                    <h5 className="font-bold text-gray-800">
                      {item.kode_produk} - {item.no_batch}
                    </h5>
                    <div className="mt-1 space-y-0.5 text-sm text-gray-600 mb-3">
                      <p>Waktu Kirim: {renderWaktu(item.kirim_ke_filling)}</p>
                      <p>Total durasi: {calculateDuration(item.kirim_ke_filling)}</p>
                    </div>

                    {!isGuest && (
                      <div className="mt-auto space-y-2 pt-1 border-t border-gray-100">
                        <label className="text-sm font-bold text-gray-800">Pilih Mesin</label>
                        <select
                          value={selectedVal}
                          onChange={(e) => handleSelectMesin(item.id, e.target.value)}
                          disabled={isProcessing}
                          className="w-full border border-gray-300 rounded p-2 text-sm text-black focus:outline-none focus:ring-1 focus:ring-green-600 disabled:bg-gray-100"
                        >
                          <option value="" disabled>-- Pilih Mesin --</option>
                          {mesinOptions.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleKirimPowder(item.id)}
                          disabled={!selectedVal || isProcessing}
                          className={`w-full py-2 rounded text-sm font-bold transition ${selectedVal && !isProcessing ? "bg-[#188c54] hover:bg-[#126b40] text-white cursor-pointer" : "bg-gray-200 text-gray-400 cursor-not-allowed"
                            }`}
                        >
                          {isProcessing ? "Memproses..." : "Kirim ke Sample FG"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}