// src/components/endPackagingCard.tsx
"use client";

import { useState } from "react";
import Cookies from "js-cookie";
import TableCardShell from "./tableCardShell";
import { calculateDuration } from "@/utils/formatTime";
import { EndPackagingData } from "@/types";
import { AccessRule, hasAccess } from "@/lib/access";
import { apiFetch } from "@/lib/api";

interface EndPackagingCardProps {
  title: string;
  subtitle: string;
  data: EndPackagingData[];
  apiPostUrl: string;
  onSuccess: () => void;
  access?: AccessRule;
}

/**
 * Komponen UI Card untuk Modul "End Packaging".
 * 
 * **Konsep Arsitektural:**
 * 1. **TableCardShell Wrapper**: Menggunakan pola komposisi dengan meletakkan 
 *    `TableCardShell` sebagai kerangka utama. Komponen ini mendelegasikan state
 *    `searchQuery` ke shell, namun tetap mengontrol state form input (barcode & keterangan).
 * 2. **Per-Row State Management**: Menggunakan `Record<number, string/boolean>` 
 *    (`barcodeInputs`, `keteranganInputs`, `isSubmitting`) untuk melacak state masing-masing 
 *    baris tabel secara independen agar ketikan di satu baris tidak memengaruhi baris lain.
 */
export default function EndPackagingCard({ title, subtitle, data, apiPostUrl, onSuccess, access }: EndPackagingCardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  
  // State dipisah untuk masing-masing input
  const [barcodeInputs, setBarcodeInputs] = useState<Record<number, string>>({});
  const [keteranganInputs, setKeteranganInputs] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<Record<number, boolean>>({});

  const isGuest = Cookies.get("level") === "guest";
  const allowed = hasAccess(access);

  const filteredData = data.filter((item) => 
    item.no_batch.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.kode_ruah.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.kode_produk.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleBarcodeChange = (id: number, value: string) => {
    setBarcodeInputs(prev => ({ ...prev, [id]: value }));
  };

  const handleKeteranganChange = (id: number, value: string) => {
    setKeteranganInputs(prev => ({ ...prev, [id]: value }));
  };

  const handleScanSubmit = async (id: number) => {
    const barcodeValue = barcodeInputs[id];
    const keteranganValue = keteranganInputs[id] || ""; // Ambil nilai keterangan

    if (!barcodeValue) {
      alert("Harap scan/masukkan barcode terlebih dahulu!");
      return;
    }

    if (!allowed) return;

    setIsSubmitting(prev => ({ ...prev, [id]: true }));

    try {
      const response = await apiFetch(apiPostUrl, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Cookies.get("token")}` 
        },
        body: JSON.stringify({
          id: id ? [id] : [],
          text: barcodeValue,
          ket: keteranganValue // Kirim keterangan ke API jika dibutuhkan
        }),
      });

      if (response.ok) {
        setBarcodeInputs(prev => ({ ...prev, [id]: "" }));
        setKeteranganInputs(prev => ({ ...prev, [id]: "" }));
        onSuccess();
      } else {
        const errData = await response.json();
        alert(errData.message || "Gagal memproses data barcode.");
      }
    } catch (error) {
      alert("Koneksi ke server gagal.");
    } finally {
      setIsSubmitting(prev => ({ ...prev, [id]: false }));
    }
  };

  return (
    <TableCardShell
      title={title}
      subtitle={subtitle}
      count={data.length}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      onRefresh={onSuccess} 
      hideHeaderRefresh={true} 
      headers={["Kode Ruah", "Kode Produk", "No Batch", "No WO Ruah", "Waktu", "Scan Barcode"]}
    >
      {filteredData.length === 0 ? (
        <tr>
          <td colSpan={6} className="px-4 py-8 text-center text-gray-500 italic border-b">
            Tidak ada data.
          </td>
        </tr>
      ) : (
        filteredData.map((item) => {
          const currentBarcode = barcodeInputs[item.id] || "";
          const currentKeterangan = keteranganInputs[item.id] || "";
          const isLoading = isSubmitting[item.id] || false;

          return (
            <tr key={item.id} className="border-b hover:bg-gray-50 text-center text-gray-800">
              <td className="px-2 py-3 font-medium">{item.kode_ruah}</td>
              <td className="px-2 py-3 font-bold">{item.kode_produk}</td>
              <td className="px-2 py-3">{item.no_batch}</td>
              <td className="px-2 py-3">{item.no_wo_ruah}</td>
              
              <td className="px-2 py-3 text-sm">
                {item.kirim_ke_end_packaging ? (
                  <>
                    <span className="block font-medium">
                      {new Date(item.kirim_ke_end_packaging).toLocaleString('id-ID')}
                    </span>
                    <span className="text-gray-500 text-xs">
                      Total durasi : {calculateDuration(item.kirim_ke_end_packaging)}
                    </span>
                  </>
                ) : "-"}
              </td>
              
              <td className="px-3 py-3">
                <div className="flex items-center w-full">
                  <input 
                    type="text" 
                    placeholder="Keterangan"
                    value={currentKeterangan}
                    onChange={(e) => handleKeteranganChange(item.id, e.target.value)}
                    disabled={isGuest || !allowed || isLoading}
                    title={!allowed ? "Anda tidak memiliki akses untuk melakukan aksi ini" : undefined}
                    className="w-1/2 border border-gray-300 border-r-0 rounded-l p-1.5 text-sm text-black focus:outline-none focus:ring-1 focus:ring-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  <input 
                    type="text" 
                    placeholder="Scan disini..."
                    value={currentBarcode}
                    onChange={(e) => handleBarcodeChange(item.id, e.target.value)}
                    disabled={isGuest || !allowed || isLoading}
                    title={!allowed ? "Anda tidak memiliki akses untuk melakukan aksi ini" : undefined}
                    className="w-1/2 border border-gray-300 rounded-none p-1.5 text-sm text-black focus:outline-none focus:ring-1 focus:ring-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  <button 
                    onClick={() => handleScanSubmit(item.id)}
                    disabled={isGuest || !allowed || isLoading || !currentBarcode}
                    title={!allowed ? "Anda tidak memiliki akses untuk melakukan aksi ini" : undefined}
                    className="bg-[#198754] hover:bg-[#157347] text-white font-bold px-3 py-1.5 border border-[#198754] rounded-r text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? "..." : "OK"}
                  </button>
                </div>
              </td>
            </tr>
          );
        })
      )}
    </TableCardShell>
  );
}