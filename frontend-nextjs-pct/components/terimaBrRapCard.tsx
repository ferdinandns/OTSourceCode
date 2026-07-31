// src/components/terimaBrRapCard.tsx
"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { SimpleData } from "@/types";
import { calculateDuration } from "@/utils/formatTime";
import Cookies from "js-cookie";
import { AccessRule, hasAccess } from "@/lib/access";
import { apiFetch } from "@/lib/api";

interface TerimaBrRapCardProps {
  title: string;
  subtitle: string;
  type: "BR" | "RAP"; 
  count: number;
  countOver: number;
  batches: SimpleData[];
  apiPostUrl: string;
  onSuccess: () => void;
  submitText?: string;
  access?: AccessRule;
}

/**
 * Komponen UI Khusus untuk Modul "Terima BR / RAP".
 * 
 * **Konsep Arsitektural:**
 * - Komponen ini menyimpang dari `SimpleCard` karena memiliki logika *rendering* tanggal 
 *   yang spesifik (misal, memilah antara tipe BR atau RAP, serta mem-*parsing* format tanggal *custom* 
 *   yang tidak sesuai standar ISO 8601).
 * - **Bulk Action Design**: Dirancang untuk aksi massal (*checkbox* batch), dengan state 
 *   `selectedIds` yang terpusat. Mengirim *array of ID* ke backend dalam satu *request* `apiFetch`
 *   dibandingkan me-*loop* API berkali-kali.
 */
export default function TerimaBrRapCard({
  title,
  subtitle,
  type,
  count,
  countOver,
  batches,
  apiPostUrl,
  onSuccess,
  submitText = "Kirim Batch Terpilih",
  access,
}: TerimaBrRapCardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [keterangan, setKeterangan] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const isGuest = Cookies.get("level") === "guest";
  const allowed = hasAccess(access);

  const filteredBatches = batches.filter(
    (b) =>
      b.no_batch.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.kode_ruah.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.kode_produk.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCheckSingle = (id: number) => {
    if (!allowed) return;
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((val) => val !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleCheckAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!allowed) return;
    if (e.target.checked) setSelectedIds(filteredBatches.map((b) => b.id));
    else setSelectedIds([]);
  };

  const handleSubmit = async () => {
    if (!allowed) {
      setErrorMsg("Anda tidak memiliki akses untuk melakukan aksi ini.");
      return;
    }
    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const token = Cookies.get("token");
      const response = await apiFetch(apiPostUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: selectedIds,
          ket: keterangan || "-",
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

  // Helper untuk mengubah string format "DD/MM/YYYY HH:mm:ss" ke format ISO agar terbaca oleh Date JavaScript standar
  const parseCustomDate = (dateStr?: string) => {
    if (!dateStr) return undefined;
    const parts = dateStr.split(/[\s/:]/);
    if (parts.length === 6) {
      // Input asumsi: DD/MM/YYYY HH:mm:ss
      return `${parts[2]}-${parts[1]}-${parts[0]}T${parts[3]}:${parts[4]}:${parts[5]}`;
    }
    return dateStr;
  };

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[400px]">
        {/* HEADER */}
        <div className="bg-[#c7d6ab] p-3 flex justify-between items-center shrink-0">
          <div className="flex items-start gap-4">
            <div>
              <h3 className="font-bold text-gray-800 uppercase flex items-center gap-2">
                {title}
              </h3>
              <p className="text-sm text-gray-700">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-1 items-end">
              <span className="bg-white text-black text-xs font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                Total: {count}
              </span>
              {countOver > 0 && (
                <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                  Over: {countOver}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="p-4 flex-1 flex flex-col gap-3 min-h-0">
          <input
            type="text"
            placeholder="Cari Kode Ruah/Kode Produk/No Batch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-gray-300 rounded p-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#c7d6ab]"
          />

          {!isGuest && (
            <div className="flex items-center gap-2 px-1">
              <label className="flex text-sm font-bold text-gray-800 gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  onChange={handleCheckAll}
                  checked={
                    filteredBatches.length > 0 &&
                    selectedIds.length === filteredBatches.length
                  }
                  className="rounded cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={filteredBatches.length === 0 || !allowed}
                  title={!allowed ? "Anda tidak memiliki akses untuk melakukan aksi ini" : undefined}
                />
                Pilih Semua
              </label>
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
            {filteredBatches.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center mt-4">
                Tidak ada WO tersedia.
              </p>
            ) : (
              filteredBatches.map((batch) => (
                <label
                  key={batch.id}
                  className="flex flex-row items-start sm:items-center justify-between border border-gray-200 p-2 rounded shadow-sm hover:bg-gray-50 transition gap-2 cursor-pointer"
                >
                  <div className="flex items-start sm:items-center gap-2 md:gap-3 flex-1 min-w-0">
                    {!isGuest && (
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(batch.id)}
                        onChange={() => handleCheckSingle(batch.id)}
                        disabled={!allowed}
                        title={!allowed ? "Anda tidak memiliki akses untuk melakukan aksi ini" : undefined}
                        className="flex-shrink-0 mt-1 sm:mt-0 rounded disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                      />
                    )}

                    <div className="flex flex-col gap-1 w-full">
                      {/* Baris Kode & Batch (Sama untuk BR dan RAP) */}
                      <div className="text-sm text-gray-700 flex flex-wrap items-center gap-x-1 gap-y-1">
                        <span className="px-2 py-0.5 rounded text-white bg-black">
                          {batch.kode_ruah.substring(0, 5).toUpperCase()}
                        </span>
                        <span className="text-gray-900">
                          {batch.kode_produk.toUpperCase()}
                        </span>
                        <span className="text-gray-500">
                          - {batch.no_batch.toUpperCase()}
                        </span>
                      </div>

                      {/* Baris Informasi Tambahan (Khusus BR) */}
                      {type === "BR" && (
                        <div className="text-sm text-gray-600 flex flex-col font-normal mt-0.5">
                          <span>
                            Tanggal setor : {new Date(batch.setor_br_date).toLocaleString('id-ID') || "-"}
                          </span>
                          <span>
                            Durasi :{" "}
                            {calculateDuration(
                              parseCustomDate(batch.setor_br_date)
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>

          {/* SUBMIT BUTTON */}
          {!isGuest && (
            <button
              onClick={() => allowed && setIsModalOpen(true)}
              disabled={selectedIds.length === 0 || !allowed}
              title={!allowed ? "Anda tidak memiliki akses untuk melakukan aksi ini" : undefined}
              className={`w-full py-2.5 rounded font-bold transition flex-shrink-0 ${selectedIds.length > 0 && allowed
                  ? "bg-[#c7d6ab] hover:bg-[#b3c494] text-gray-800 cursor-pointer"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
            >
              {submitText}
            </button>
          )}
        </div>
      </div>

      {/* MODAL POP-UP KONFIRMASI */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-pop-in">
            <div className="bg-yellow-400 p-4 flex justify-between items-center">
              <h5 className="font-bold text-gray-900">Konfirmasi {title}</h5>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-800 hover:text-black cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5">
              <p className="text-sm text-gray-700 mb-2">
                Batch yang akan dikirim ({selectedIds.length} item):
              </p>

              <ul className="border border-gray-200 rounded max-h-32 overflow-y-auto mb-4 bg-gray-50">
                {batches
                  .filter((b) => selectedIds.includes(b.id))
                  .map((b) => (
                    <li
                      key={b.id}
                      className="text-xs text-black p-2 border-b border-gray-200 last:border-0 font-medium"
                    >
                      {b.kode_ruah} {b.kode_produk} - {b.no_batch}
                    </li>
                  ))}
              </ul>

              <textarea
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Keterangan (opsional)"
                className="w-full border border-gray-300 rounded p-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-yellow-400 min-h-[80px]"
              />

              {errorMsg && (
                <p className="text-red-500 text-xs mt-2">{errorMsg}</p>
              )}
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
                disabled={isSubmitting || !allowed}
                title={!allowed ? "Anda tidak memiliki akses untuk melakukan aksi ini" : undefined}
                className="px-4 py-2 bg-green-600 text-white rounded text-sm font-semibold hover:bg-green-700 transition cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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