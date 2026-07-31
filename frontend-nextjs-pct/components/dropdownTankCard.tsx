"use client";

import { useState } from "react";
import Cookies from "js-cookie";
import { X } from "lucide-react";
import { SimpleData } from "@/types";
import { formatLeadTime } from "@/utils/formatTime";
import { AccessRule, hasAccess } from "@/lib/access";
import { apiFetch } from "@/lib/api";

interface DropdownTankCardProps {
  title: string;
  subtitle: string;
  data: SimpleData[];
  apiPostUrl: string;
  onSuccess: () => void;
  dropdownOptions?: { id: string | number; label: string }[];
  dropdownOptionsMap?: Record<string, { id: string | number; label: string }[]>;
  fetchDynamicOptions?: (id: number | string) => Promise<{ id: string | number; label: string }[]>;
  dropdownPlaceholder?: string;
  access?: AccessRule;
}

/**
 * Komponen UI Wrapper "DropdownTankCard".
 * 
 * **Konsep Arsitektural:**
 * Merupakan varian dari `SimpleCard` dengan tambahan fitur "Dropdown Dinamis".
 * Secara arsitektur, komponen ini memungkinkan *dependency injection* untuk 
 * memfetch daftar tank/mesin secara dinamis (berdasarkan batch yang dipilih) 
 * via properti `fetchDynamicOptions`, sehingga integrasinya dengan backend 
 * tetap lepas (decoupled) dari komponen UI ini.
 */
export default function DropdownTankCard({
  title, subtitle, data, apiPostUrl, onSuccess, dropdownOptions, dropdownOptionsMap, fetchDynamicOptions, dropdownPlaceholder = "-- Pilih Opsi --",
  access
}: DropdownTankCardProps) {

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | string | null>(null);
  const [selectedValue, setSelectedValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State untuk menyimpan hasil fetch dinamis
  const [dynamicOptions, setDynamicOptions] = useState<{ id: string | number; label: string }[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);

  // State baru untuk Modal Konfirmasi
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [keterangan, setKeterangan] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const isGuest = Cookies.get("level") === "guest";
  const allowed = hasAccess(access);
  const safeData = data || [];

  const filteredData = safeData.filter((item) =>
    item.no_batch.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.kode_ruah && item.kode_ruah.toLowerCase().includes(searchQuery.toLowerCase())) ||
    item.kode_produk.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const countOver = safeData.filter(d => d.status_lead === "OVER").length;

  const handleSelectRow = async (batchId: number | string) => {
    if (!allowed) return;
    setSelectedId(batchId);
    setSelectedValue(""); // Reset dropdown

    if (fetchDynamicOptions) {
      setIsLoadingOptions(true);
      try {
        const opts = await fetchDynamicOptions(batchId);
        setDynamicOptions(opts);
      } catch (error) {
        setDynamicOptions([]);
      } finally {
        setIsLoadingOptions(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (!selectedId || !selectedValue) return;
    if (!allowed) {
      setErrorMsg("Anda tidak memiliki akses untuk melakukan aksi ini.");
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(""); // Reset error message

    try {
      const response = await apiFetch(apiPostUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Cookies.get("token")}`
        },
        body: JSON.stringify({
          id: [selectedId], // Dikirim sebagai array
          tank_id: Number(selectedValue), // Nilai dropdown
          ket: keterangan || "-"
        }),
      });

      if (response.ok) {
        setIsModalOpen(false);
        setKeterangan("");
        setSelectedId(null);
        setSelectedValue("");
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
        <div className="bg-[#c7d6ab] p-3 flex justify-between items-start shrink-0">
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
          <div className="flex flex-col gap-1 items-end">
            <span className="bg-white text-black text-xs font-bold px-2.5 py-0.5 rounded-full shadow-sm">Total: {safeData.length}</span>
            {countOver > 0 && (
              <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow-sm">Over: {countOver}</span>
            )}
          </div>
        </div>

        <div className="p-4 flex-1 flex flex-col gap-3 min-h-0">
          <input
            type="text"
            placeholder="Cari Kode Ruah/Kode Produk/No Batch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-gray-300 rounded p-2 text-sm text-black focus:outline-none focus:ring-1 focus:ring-[#c7d6ab] focus:border-[#c7d6ab] shrink-0"
          />

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-0">
            {filteredData.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center mt-4">Tidak ada data tersedia.</p>
            ) : (
              filteredData.map((batch) => {

                // Tentukan opsi mana yang akan di-render
                let optionsToRender = dynamicOptions;
                if (!fetchDynamicOptions) {
                  optionsToRender = dropdownOptionsMap
                    ? (dropdownOptionsMap[batch.kode_produk] || [])
                    : (dropdownOptions || []);
                }

                return (
                  <div key={batch.id} className="border border-gray-200 rounded shadow-sm hover:bg-gray-50 transition overflow-hidden bg-white">
                    <label className="flex items-start sm:items-center gap-2 md:gap-3 p-2 cursor-pointer">
                      {!isGuest && (
                        <input
                          type="radio"
                          name={`selection_${title}`}
                          checked={selectedId === batch.id}
                          onChange={() => handleSelectRow(batch.id)}
                          disabled={!allowed}
                          title={!allowed ? "Anda tidak memiliki akses untuk melakukan aksi ini" : undefined}
                          className="w-4 h-4 text-[#c7d6ab] focus:ring-[#c7d6ab] mt-1 sm:mt-0 flex-shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      )}

                      <div className="text-xs font-semibold text-gray-700 flex flex-wrap items-center gap-x-1 gap-y-1">
                        {batch.kode_ruah && (
                          <span className={`px-2 py-0.5 rounded text-white ${batch.status_lead === 'OVER' ? 'bg-red-600' : 'bg-black'}`}>
                            {batch.kode_ruah.substring(0, 5).toUpperCase()}
                          </span>
                        )}
                        <span className="text-gray-900">{batch.kode_produk.toUpperCase()}</span>
                        <span className="text-gray-500">- {batch.no_batch.toUpperCase()} -</span>
                        <span className="text-gray-500 whitespace-nowrap">{formatLeadTime(batch.leadtime)}</span>
                      </div>
                    </label>

                    {selectedId === batch.id && !isGuest && (
                      <div className="px-3 pb-3 pt-1 border-t border-gray-100 bg-[#f8faf5] fade-in">
                        {isLoadingOptions ? (
                          <p className="text-xs text-blue-600 italic py-1 animate-pulse">Memuat daftar mesin...</p>
                        ) : optionsToRender.length > 0 ? (
                          <select
                            value={selectedValue}
                            onChange={(e) => setSelectedValue(e.target.value)}
                            className="w-full border border-gray-300 rounded p-2 text-sm text-black focus:outline-none focus:ring-1 focus:ring-[#c7d6ab] focus:border-[#c7d6ab]"
                          >
                            <option value="" disabled>{dropdownPlaceholder}</option>
                            {optionsToRender.map((opt, idx) => (
                              <option key={idx} value={opt.id}>{opt.label}</option>
                            ))}
                          </select>
                        ) : (
                          <p className="text-xs text-red-500 italic py-1">⚠ Tidak ada mesin yang tersedia.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {!isGuest && (
            <div className="flex-shrink-0">
              <button
                onClick={() => allowed && setIsModalOpen(true)}
                disabled={!selectedId || !selectedValue || isSubmitting || !allowed}
                title={!allowed ? "Anda tidak memiliki akses untuk melakukan aksi ini" : undefined}
                className={`w-full py-2.5 rounded font-bold transition ${(selectedId && selectedValue && allowed) ? "bg-[#c7d6ab] hover:bg-[#b3c494] text-gray-800 cursor-pointer" : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
              >
                {isSubmitting ? "Memproses..." : "Kirim Batch Terpilih"}
              </button>
              {!allowed && (
                <p className="text-xs text-red-500 text-center mt-1">
                  
                </p>
              )}
            </div>
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
              <p className="text-sm text-gray-700 mb-2">Batch yang akan dikirim (1 item):</p>

              <ul className="border border-gray-200 rounded max-h-32 overflow-y-auto mb-4 bg-gray-50">
                {safeData.filter(b => b.id === selectedId).map(b => {

                  // 1. Tentukan opsi mesin yang berlaku untuk batch ini (sama seperti logika di atas)
                  let optionsToRender = dynamicOptions;
                  if (!fetchDynamicOptions) {
                    optionsToRender = dropdownOptionsMap
                      ? (dropdownOptionsMap[b.kode_produk] || [])
                      : (dropdownOptions || []);
                  }

                  // 2. Cari nama (label) mesin/tank yang dipilih berdasarkan selectedValue (ID)
                  const selectedTankLabel = optionsToRender.find(
                    opt => String(opt.id) === String(selectedValue)
                  )?.label || selectedValue;

                  return (
                    <li key={b.id} className="text-sm text-black p-3 border-b border-gray-200 last:border-0 font-medium flex flex-col gap-1">
                      <span>
                        {b.kode_ruah} {b.kode_produk} - {b.no_batch} - {formatLeadTime(b.leadtime)}
                      </span>
                      <span className="font-bold w-fit py-0.5 rounded">
                        Tank: {selectedTankLabel}
                      </span>
                    </li>
                  );
                })}
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