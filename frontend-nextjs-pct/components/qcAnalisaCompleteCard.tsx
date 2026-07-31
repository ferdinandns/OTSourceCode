// src/components/qcAnalisaCompleteCard.tsx
"use client";

import { useState } from "react";
import Cookies from "js-cookie";
import { X } from "lucide-react";
import TableCardShell from "./tableCardShell";
import { QcAnalisaCompleteData } from "@/types";
import { calculateDuration } from "@/utils/formatTime";
import { AccessRule, hasAccess } from "@/lib/access";
import { apiFetch } from "@/lib/api";

interface QcAnalisaCompleteCardProps {
  data: QcAnalisaCompleteData[];
  apiPostUrl: string;
  onSuccess: () => void;
  access?: AccessRule;
}

/**
 * Komponen UI Card untuk Modul "QC Analisa Complete".
 * 
 * **Konsep Arsitektural:**
 * - Mirip dengan Card *bulk action* lainnya, ini menerapkan pola "Pilih dan Kirim" 
 *   berdasarkan kumpulan *Checkbox ID* (`selectedIds`).
 * - **Centralized Error Handling**: Mengelola state `errorMsg` secara tunggal dan merendernya 
 *   di dalam Modal konfirmasi untuk memberikan konteks langsung (in-place feedback) kepada pengguna 
 *   tanpa harus berpindah halaman atau mengandalkan alert bawaan browser.
 */
export default function QcAnalisaCompleteCard({ data, apiPostUrl, onSuccess, access }: QcAnalisaCompleteCardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [keterangan, setKeterangan] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const isGuest = Cookies.get("level") === "guest";
  const allowed = hasAccess(access);

  const filteredData = data.filter((item) => 
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
        setErrorMsg(errData.message || "Gagal memproses data.");
      }
    } catch (error) {
      setErrorMsg("Koneksi ke server gagal.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Komponen Tombol Kirim untuk diselipkan ke Footer TableCardShell
  const footerButton = !isGuest ? (
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
  ) : null;

  return (
    <>
      <TableCardShell
        title="QC ANALISA COMPLETE"
        subtitle="Departement QC"
        count={data.length}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onRefresh={onSuccess}
        headers={["Pilih", "Kode Ruah", "Kode Produk", "No Batch", "Compounding", "Storage / Bin", "Tanggal QC Analisa"]}
        footerComponent={footerButton}
      >
        {filteredData.length === 0 ? (
          <tr>
            <td colSpan={7} className="px-4 py-8 text-center text-gray-500 italic border-b">
              Tidak ada data.
            </td>
          </tr>
        ) : (
          filteredData.map((item) => {
            return (
              <tr key={item.id} className="border-b hover:bg-gray-50 text-center text-gray-800">
                {/* Kolom Checkbox di urutan pertama sesuai gambar */}
                <td className="px-2 py-2">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(item.id)}
                    onChange={() => handleCheckSingle(item.id)}
                    disabled={isGuest || !allowed}
                    title={!allowed ? "Anda tidak memiliki akses untuk melakukan aksi ini" : undefined}
                    className="rounded cursor-pointer w-4 h-4 disabled:opacity-30 disabled:cursor-not-allowed"
                  />
                </td>
                <td className="px-2 py-2 font-medium">{item.kode_ruah}</td>
                <td className="px-2 py-2 font-bold">{item.kode_produk}</td>
                <td className="px-2 py-2">{item.no_batch}</td>
                <td className="px-2 py-2">{item.mixing_tank}</td>
                <td className="px-2 py-2">{item.storage_tank}</td>
                
                {/* Kolom Tanggal & Durasi QC Analisa */}
                <td className="px-2 py-2 text-sm">
                  {item.tanggal_qc_analisa ? (
                    <>
                      <span className="block font-medium">
                        {/* Format tanggal disesuaikan seperti DD/MM/YYYY HH:mm:ss */}
                        {new Date(item.tanggal_qc_analisa).toLocaleString('id-ID')}
                      </span>
                      <span className="text-gray-500 text-xs">Total durasi : {calculateDuration(item.tanggal_qc_analisa)}</span>
                    </>
                  ) : "-"}
                </td>
              </tr>
            );
          })
        )}
      </TableCardShell>

      {/* MODAL KONFIRMASI */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-pop-in">
            <div className="bg-[#c7d6ab] p-4 flex justify-between items-center">
              <h5 className="font-bold text-gray-900">Konfirmasi Pengiriman Batch</h5>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-800 hover:text-black cursor-pointer">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-5">
              <p className="text-sm text-gray-700 mb-2">Batch yang akan dikirim ({selectedIds.length} item):</p>
              
              <ul className="border border-gray-200 rounded max-h-32 overflow-y-auto mb-4 bg-gray-50">
                {data.filter(b => selectedIds.includes(b.id)).map(b => (
                  <li key={b.id} className="text-xs text-black p-2 border-b border-gray-200 last:border-0 font-medium">
                    {b.kode_ruah} - {b.kode_produk} - {b.no_batch}
                  </li>
                ))}
              </ul>

              <textarea 
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Tambahkan keterangan opsional (misal: QC Analisa selesai)..."
                className="w-full border border-gray-300 rounded p-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#c7d6ab] min-h-[80px]"
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
                className="px-4 py-2 bg-[#8c9f6d] text-white rounded text-sm font-semibold hover:bg-[#7b8f5d] transition cursor-pointer"
              >
                {isSubmitting ? "Memproses..." : "Kirim Batch Terpilih"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}