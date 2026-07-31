// src/components/SerahTerimaBppCard.tsx
"use client";

import { useState } from "react";
import Cookies from "js-cookie";
import TableCardShell from "./tableCardShell";
import { calculateDuration } from "@/utils/formatTime";
import { SerahTerimaBppData } from "@/types";
import { AccessRule, hasAccess } from "@/lib/access";
import { apiFetch } from "@/lib/api";

interface SerahTerimaBppCardProps {
  title: string;
  subtitle: string;
  data: SerahTerimaBppData[];
  apiPostUrl: string;
  onSuccess: () => void;
  access?: AccessRule;
}

/**
 * Komponen UI Card untuk "Serah Terima BPP".
 * 
 * **Konsep Arsitektural:**
 * - **RBAC Guarding**: Mengandalkan utilitas `hasAccess` untuk mematikan input teks
 *   dan tombol (disabled state) di setiap baris bagi pengguna yang tidak memiliki
 *   hak akses sesuai definisi dari backend, sehingga *UX* lebih terkontrol.
 * - **Independen Row Action**: Menyimpan state loading dan keterangan secara terpisah
 *   per ID baris, memungkinkan satu pengguna mengirim baris A sementara baris B masih dirender normal.
 */
export default function SerahTerimaBppCard({ title, subtitle, data, apiPostUrl, onSuccess, access }: SerahTerimaBppCardProps) {
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
    // const barcodeValue = barcodeInputs[id];
    const keteranganValue = keteranganInputs[id] || ""; // Ambil nilai keterangan

    // if (!barcodeValue) {
    //   alert("Harap scan/masukkan barcode terlebih dahulu!");
    //   return;
    // }

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
          // text: barcodeValue,
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
                {item.kirim_ke_serah_terima_bpp ? (
                  <>
                    <span className="block font-medium">
                      {new Date(item.kirim_ke_serah_terima_bpp).toLocaleString('id-ID')}
                    </span>
                    <span className="text-gray-500 text-xs">
                      Total durasi : {calculateDuration(item.kirim_ke_serah_terima_bpp)}
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
                    className="w-full border border-gray-300 border-r-0 rounded-l p-1.5 text-sm text-black focus:outline-none focus:ring-1 focus:ring-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  {/* <input 
                    type="text" 
                    placeholder="Scan di sini..."
                    value={currentBarcode}
                    onChange={(e) => handleBarcodeChange(item.id, e.target.value)}
                    disabled={isGuest || isLoading}
                    className="w-1/2 border border-gray-300 rounded-none p-1.5 text-sm text-black focus:outline-none focus:ring-1 focus:ring-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  /> */}
                  <button 
                    onClick={() => handleScanSubmit(item.id)}
                    // disabled={isGuest || isLoading || !currentBarcode}
                    disabled={isGuest || !allowed || isLoading}
                    title={!allowed ? "Anda tidak memiliki akses untuk melakukan aksi ini" : undefined}
                    className="bg-[#198754] hover:bg-[#157347] text-white font-bold px-3 py-1.5 border border-[#198754] rounded-r text-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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