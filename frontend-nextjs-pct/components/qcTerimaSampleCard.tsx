// src/components/QcTerimaSampleCard.tsx
"use client";

import { useState } from "react";
import Cookies from "js-cookie";
import { X } from "lucide-react";
import TableCardShell from "./tableCardShell";
import { QcTerimaSampleData } from "@/types";
import { formatLeadTime } from "@/utils/formatTime";
import { AccessRule, hasAccess } from "@/lib/access";
import { apiFetch } from "@/lib/api";

interface QcTerimaSampleCardProps {
  data: QcTerimaSampleData[];
  apiPostUrl: string;
  onSuccess: () => void;
  access?: AccessRule;
}

/**
 * Komponen UI Card untuk "QC Terima Sample".
 * 
 * **Konsep Arsitektural:**
 * - **Inline to Modal Flow**: Alih-alih membuat form panjang di dalam baris tabel, 
 *   komponen ini menggunakan tombol "Terima" yang akan me-*trigger* sebuah Modal 
 *   untuk input `No. Sample`. Ini meminimalkan kekacauan visual (visual clutter) di tabel utama.
 * - **Per-Item Modal Context**: State `selectedItem` menyimpan objek `QcTerimaSampleData` 
 *   secara utuh saat tombol ditekan, sehingga Modal dapat merender kembali informasi rinci 
 *   (Kode Ruah, Batch, dll) sebagai pengingat sebelum aksi dilakukan.
 */
export default function QcTerimaSampleCard({ data, apiPostUrl, onSuccess, access }: QcTerimaSampleCardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const isGuest = Cookies.get("level") === "guest";
  const allowed = hasAccess(access);

  // State untuk Modal Per-Baris
  const [selectedItem, setSelectedItem] = useState<QcTerimaSampleData | null>(null);
  const [noSample, setNoSample] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Logika Filter
  const filteredData = data.filter((item) => 
    item.no_batch.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.kode_ruah.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.kode_produk.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const countOver = data.filter(d => d.status_lead === "OVER").length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Mencegah reload halaman saat submit
    // if (!noSample.trim()) {
    //   setErrorMsg("No. Sample wajib diisi!");
    //   return;
    // }
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
          id: selectedItem?.id ? [selectedItem.id] : [],
          text: noSample,
          ket: keterangan || "-"
        }),
      });

      if (response.ok) {
        setSelectedItem(null); // Tutup modal
        setNoSample("");
        setKeterangan("");
        onSuccess(); // Refresh tabel
      } else {
        const errData = await response.json();
        setErrorMsg(errData.message || "Gagal mengirim data.");
      }
    } catch (error) {
      setErrorMsg("Gagal terhubung ke server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <TableCardShell
        title="QC TERIMA SAMPLE"
        subtitle="Departement QC"
        count={data.length}
        countOver={countOver}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onRefresh={onSuccess}
        headers={["Kode Ruah", "Kode Produk", "No Batch", "Compounding", "Storage / Bin", "Tanggal Kirim ke QC", "Status"]}
      >
        {/* === ISI BARIS TABEL KHUSUS QC === */}
        {filteredData.length === 0 ? (
          <tr>
            <td colSpan={7} className="px-4 py-8 text-center text-gray-500 italic">
              Tidak ada data yang menunggu.
            </td>
          </tr>
        ) : (
          filteredData.map((item) => (
            <tr 
              key={item.id} 
              className={`border-b hover:bg-gray-50 text-center ${item.status_lead === 'OVER' ? 'text-red-600' : 'text-gray-800'}`}
            >
              <td className="px-3 py-2 font-medium">{item.kode_ruah}</td>
              <td className="px-3 py-2 font-bold">{item.kode_produk}</td>
              <td className="px-3 py-2">{item.no_batch}</td>
              <td className="px-3 py-2">{item.mixing_tank || "-"}</td>
              <td className="px-3 py-2">{item.storage_tank || "-"}</td>
              <td className="px-3 py-2 text-sm">
                {item.tanggal_kirim_ke_qc ? (
                  <>
                    <span className="block font-medium">{new Date(item.tanggal_kirim_ke_qc).toLocaleString('id-ID')}</span>
                    <span className="">Durasi: {formatLeadTime(item.leadtime || 0)}</span>
                  </>
                ) : "-"}
              </td>
              <td className="px-3 py-2">
                {!isGuest && (
                  <button 
                    onClick={() => allowed && setSelectedItem(item)}
                    disabled={!allowed}
                    title={!allowed ? "Anda tidak memiliki akses untuk melakukan aksi ini" : undefined}
                    className="bg-[#c7d6ab] text-black text-sm border border-[#c7d6ab] hover:bg-[#c7d6ab]/50 hover:text-black px-2 py-1.5 rounded shadow-sm font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#c7d6ab]"
                  >
                    Terima
                  </button>
                )}
              </td>
            </tr>
          ))
        )}
      </TableCardShell>

      {/* MODAL KHUSUS QC TERIMA SAMPLE */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-pop-in">
            <div className="bg-yellow-400 p-4 flex justify-between items-center">
              <h5 className="font-bold text-gray-900">Konfirmasi Terima Sample QC</h5>
              <button onClick={() => setSelectedItem(null)} className="text-gray-800 hover:text-black cursor-pointer">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="p-5 space-y-4">
                <div className="bg-gray-50 border border-gray-200 p-3 rounded">
                  <p className="text-sm font-bold text-gray-700 border-b pb-2 mb-2">Batch yang akan diterima:</p>
                  <div className="text-sm text-black">
                    <p>Kode Ruah: <span className="font-semibold">{selectedItem.kode_ruah}</span></p>
                    <p>Kode Produk: <span className="font-semibold">{selectedItem.kode_produk}</span></p>
                    <p>No Batch: <span className="font-semibold">{selectedItem.no_batch}</span></p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    No. Sample <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="number"
                    value={noSample}
                    required
                    onChange={(e) => setNoSample(e.target.value)}
                    placeholder="Masukkan no. sample yang diterima..."
                    className="w-full border border-gray-300 rounded p-2 text-sm text-black focus:ring-2 focus:ring-yellow-400 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Keterangan (Opsional)</label>
                  <textarea 
                    value={keterangan}
                    onChange={(e) => setKeterangan(e.target.value)}
                    placeholder="Masukkan catatan QC..."
                    className="w-full border border-gray-300 rounded p-2 text-sm text-black focus:ring-2 focus:ring-yellow-400 focus:outline-none"
                    rows={2}
                  />
                </div>

                {errorMsg && <p className="text-red-500 text-xs font-semibold">{errorMsg}</p>}
              </div>

              <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50">
                <button 
                  type="button" 
                  onClick={() => {
                    setSelectedItem(null);
                    setNoSample("");
                    setKeterangan("");
                  }}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-gray-500 text-white rounded text-sm font-semibold hover:bg-gray-600 transition cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-green-600 text-white rounded text-sm font-semibold hover:bg-green-700 transition cursor-pointer"
                >
                  {isSubmitting ? "Memproses..." : "Ya, Terima"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}