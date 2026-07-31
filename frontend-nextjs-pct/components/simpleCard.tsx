// src/components/SimpleCard.tsx
"use client";

import { useState } from "react";
import { Trash2, X, RefreshCw } from "lucide-react";
import { SimpleData } from "@/types";
import { formatLeadTime } from "@/utils/formatTime";
import Cookies from "js-cookie";
import { AccessRule, hasAccess } from "@/lib/access";
import { apiFetch } from "@/lib/api";

interface SimpleCardProps {
  title: string;
  subtitle: string;
  count: number;
  countOver: number;
  batches: SimpleData[];
  apiPostUrl?: string;
  onSuccess: () => void;
  showDelete?: boolean;
  onDeleteClick?: (batch: SimpleData) => void;
  submitText?: string;
  hideSubmit?: boolean;
  showBottomRefresh?: boolean;
  showTopRefresh?: boolean;
  selectionMode?: "checkbox" | "radio";
  hideLeadTime?: boolean; 
  access?: AccessRule;
}

/**
 * Komponen UI Wrapper "SimpleCard".
 * 
 * **Konsep Arsitektural:**
 * 1. **Client-Side Component**: Bertugas untuk merender UI Card secara interaktif 
 *    serta mengurus logika pengiriman form (POST) ke Backend API via `apiFetch`.
 * 2. **Role-Based Access Control (RBAC)**: Secara proaktif mengecek apakah 
 *    pengguna saat ini (melalui evaluasi `hasAccess` dengan aturan dari backend) 
 *    diizinkan untuk menggunakan Card ini. Jika tidak, fitur klik dan submit 
 *    akan dimatikan (disabled).
 * 3. **Reusable Wrapper**: Dirancang agnostik (tidak terikat pada data spesifik)
 *    sehingga dapat dipakai berulang di berbagai layar (CWO, QA, QC, dsb) 
 *    selama mematuhi antarmuka `SimpleData`.
 */
export default function SimpleCard({
  title, subtitle, count, countOver, batches, apiPostUrl, onSuccess,
  showDelete = false, onDeleteClick,
  submitText = "Kirim Batch Terpilih", hideSubmit = false, showBottomRefresh = false,
  showTopRefresh = false, selectionMode = "checkbox", hideLeadTime = false,
  access
}: SimpleCardProps) {

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [keterangan, setKeterangan] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const isGuest = Cookies.get("level") === "guest";
  const allowed = hasAccess(access);

  const q = searchQuery.toLowerCase();
  const filteredBatches = batches
    .filter((b) =>
      (b.no_batch ?? "").toLowerCase().includes(q) ||
      (b.kode_ruah ?? "").toLowerCase().includes(q) ||
      (b.kode_produk ?? "").toLowerCase().includes(q)
    )
    // TAMBAHAN: khusus data timbang (hideLeadTime + ada jumlah_material), sembunyikan
    // seluruh row selama total_label_closed masih 0/belum ada progress.
    .filter((b) => {
      if (!hideLeadTime || b.jumlah_material === undefined) return true;
      return !!b.total_label_closed;
    });

  // TAMBAHAN: khusus data timbang, "Total" di header ikut menyesuaikan jumlah row
  // yang sebenarnya tampil (setelah row dgn total_label_closed=0 disembunyikan),
  // bukan angka `count` mentah dari parent. Card lain (tanpa jumlah_material) tidak terpengaruh.
  const hasProgressData = batches.some((b) => b.jumlah_material !== undefined);
  const displayCount = hasProgressData
    ? batches.filter((b) => !hideLeadTime || b.jumlah_material === undefined || !!b.total_label_closed).length
    : count;

  const handleCheckAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!allowed) return;
    if (e.target.checked) setSelectedIds(filteredBatches.map(b => b.id));
    else setSelectedIds([]);
  };

  const handleCheckSingle = (id: number) => {
    if (!allowed) return;
    if (selectionMode === "radio") {
      setSelectedIds([id]);
    } else {
      if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(val => val !== id));
      else setSelectedIds([...selectedIds, id]);
    }
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
          "Authorization": `Bearer ${token}`
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
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[420px]">
        {/* HEADER DIPERBARUI */}
        <div className="bg-[#c7d6ab] p-3 flex justify-between items-center shrink-0">
          <div className="flex items-start gap-4">
            <div>
              <h3 className="font-bold text-gray-800 uppercase flex items-center gap-2">
                {title}
                {!allowed && (
                  <span
                    title="Anda tidak memiliki akses untuk melakukan aksi ini"
                    className=""
                  >
                    
                  </span>
                )}
              </h3>
              <p className="text-sm text-gray-700">{subtitle}</p>
            </div>

            {/* Tampil di sebelah judul jika showTopRefresh bernilai TRUE */}
            {showTopRefresh && (
              <div className="flex flex-col gap-1">
                <span className="bg-white text-black text-xs font-bold px-2.5 py-0.5 rounded-full">
                  Total: {displayCount}
                </span>
                {countOver > 0 && (
                  <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                    Over: {countOver}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Tampil di pojok kanan jika showTopRefresh bernilai FALSE */}
            {!showTopRefresh && (
              <div className="flex flex-col gap-1 items-end">
                <span className="bg-white text-black text-xs font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                  Total: {displayCount}
                </span>
                {countOver > 0 && (
                  <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                    Over: {countOver}
                  </span>
                )}
              </div>
            )}

            {/* Tombol Refresh */}
            {showTopRefresh && (
              <button
                onClick={onSuccess}
                className="bg-white p-2 rounded hover:bg-gray-100 transition shadow-sm text-gray-700 cursor-pointer"
                title="Refresh Data"
              >
                <RefreshCw size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="p-4 flex-1 flex flex-col gap-3 min-h-0">
          <input
            type="text"
            placeholder="Cari Kode Ruah/Kode Produk/No Batch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-gray-300 rounded p-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#c7d6ab]"
          />

          {!isGuest && !showBottomRefresh && selectionMode === "checkbox" && (
            <div className="flex items-center gap-2 px-1">
              <label className="flex text-sm font-bold text-gray-800 gap-1">
                <input
                  type="checkbox"
                  onChange={handleCheckAll}
                  checked={selectedIds.length === filteredBatches.length && filteredBatches.length > 0}
                  className="rounded cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={filteredBatches.length === 0 || !allowed}
                  title={!allowed ? "Anda tidak memiliki akses untuk melakukan aksi ini" : undefined}
                />
                Pilih Semua</label>
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
            {filteredBatches.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center mt-4">Tidak ada WO tersedia.</p>
            ) : (
              filteredBatches.map((batch) => (
                <div key={batch.id} className="flex flex-row items-start sm:items-center justify-between border border-gray-200 p-2 rounded shadow-sm hover:bg-gray-50 transition gap-2">

                  <label className="flex items-start sm:items-center gap-2 md:gap-3 flex-1 min-w-0">

                    {!isGuest && !showBottomRefresh && (
                      <input
                        type={selectionMode}
                        checked={selectedIds.includes(batch.id)}
                        onChange={() => handleCheckSingle(batch.id)}
                        disabled={!allowed}
                        title={!allowed ? "Anda tidak memiliki akses untuk melakukan aksi ini" : undefined}
                        className={`flex-shrink-0 mt-1 sm:mt-0 disabled:cursor-not-allowed disabled:opacity-50 ${selectionMode === "radio" ? "accent-blue-600 w-4 h-4" : "rounded"} ${allowed ? "cursor-pointer" : ""}`}
                      />
                    )}

                    <div className="flex flex-col gap-1 w-full">
                      <div className="text-xs font-semibold text-gray-700 flex flex-wrap items-center gap-x-1 gap-y-1">
                        <span className={`px-2 py-0.5 rounded text-white ${batch.status_lead === 'OVER' ? 'bg-red-600' : 'bg-black'}`}>
                          {batch.kode_ruah || batch.recipe_ruah?.substring(0, 5)}
                        </span>
                        <span className="text-gray-900">{batch.kode_produk.toUpperCase()}</span>

                        {!hideLeadTime ? (
                          <>
                            <span className="text-gray-500">- {batch.no_batch.toUpperCase()} -</span>
                            <span className="text-gray-500 whitespace-nowrap">{formatLeadTime(batch.leadtime)}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-gray-500">- {batch.no_batch.toUpperCase()} -</span>
                            {/* TAMBAHAN: Kondisi render info label timbang, hanya tampil jika sudah ada progress (> 0) */}
                            {!!batch.total_label_closed && !!batch.jumlah_material && (
                              <span className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${batch.total_label_closed >= batch.jumlah_material ? "text-green-700 bg-green-100" : "text-gray-700 bg-gray-100"}`}>
                                {batch.total_label_closed} / {batch.jumlah_material}
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      {(batch.tanggal_setor || batch.waktu_kirim || batch.mesin_filling) && (
                        <div className="text-sm text-gray-600 flex flex-col font-normal mt-0.5">
                          {batch.tanggal_setor && <span>Tanggal setor : {batch.tanggal_setor}</span>}
                          {batch.waktu_kirim && <span>Waktu kirim : {batch.waktu_kirim}</span>}
                          {batch.mesin_filling && <span>Mesin Filling: {batch.mesin_filling}</span>}
                        </div>
                      )}
                    </div>
                  </label>

                  {!isGuest && showDelete && (
                    <button
                      onClick={() => onDeleteClick && onDeleteClick(batch)}
                      className="text-red-500 hover:text-white border border-red-200 p-1 rounded hover:bg-red-500 transition flex-shrink-0 mt-0.5 sm:mt-0 cursor-pointer"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {!isGuest && !hideSubmit && !showBottomRefresh && (
            <div className="flex-shrink-0">
              <button
                onClick={() => allowed && setIsModalOpen(true)}
                disabled={selectedIds.length === 0 || !allowed}
                title={!allowed ? "Anda tidak memiliki akses untuk melakukan aksi ini" : undefined}
                className={`w-full py-2.5 rounded font-bold transition ${selectedIds.length > 0 && allowed ? "bg-[#c7d6ab] hover:bg-[#b3c494] text-gray-800 cursor-pointer" : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
              >
                {submitText}
              </button>
              {!allowed && (
                <p className="text-xs text-red-500 text-center mt-1">
                  
                </p>
              )}
            </div>
          )}

          {!isGuest && showBottomRefresh && (
            <button
              onClick={onSuccess}
              className="w-full py-2.5 rounded font-bold transition flex-shrink-0 bg-[#c7d6ab] hover:bg-[#b3c494] text-gray-800 flex items-center justify-center gap-2 cursor-pointer"
            >
              Refresh Halaman
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
              <button onClick={() => setIsModalOpen(false)} className="text-gray-800 hover:text-black cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="p-5">
              <p className="text-sm text-gray-700 mb-2">Batch yang akan dikirim ({selectedIds.length} item):</p>

              <ul className="border border-gray-200 rounded max-h-32 overflow-y-auto mb-4 bg-gray-50">
                {batches.filter(b => selectedIds.includes(b.id)).map(b => (
                  <li key={b.id} className="text-xs text-black p-2 border-b border-gray-200 last:border-0 font-medium">
                    {b.kode_ruah} {b.kode_produk} - {b.no_batch} {!hideLeadTime && `- ${formatLeadTime(b.leadtime)}`}
                  </li>
                ))}
              </ul>

              <textarea
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Keterangan (opsional)"
                className="w-full border border-gray-300 rounded p-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-yellow-400 min-h-[80px]"
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
                className="px-4 py-2 bg-green-600 text-white rounded text-sm font-semibold hover:bg-green-700 transition cursor-pointer flex items-center gap-2"
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