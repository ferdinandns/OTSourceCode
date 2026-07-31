// src/components/scanBarcodeStorageCard.tsx
"use client";

import { useState } from "react";
import Cookies from "js-cookie";
import TableCardShell from "./tableCardShell";
import { ScanStorageData } from "@/types";
import { AccessRule, hasAccess } from "@/lib/access";
import { apiFetch } from "@/lib/api";

interface ScanBarcodeStorageCardProps {
  data: ScanStorageData[];
  apiPostUrl: string;
  onSuccess: () => void;
  access?: AccessRule;
}

/**
 * Komponen UI Card untuk "Scan Barcode Storage".
 * 
 * **Konsep Arsitektural:**
 * - Mirip dengan `EndPackagingCard`, ini adalah turunan (consumer) dari `TableCardShell`.
 * - **Uncontrolled to Controlled Hybrid**: Memanfaatkan native `<form onSubmit>` untuk 
 *   menangkap *Enter keypress* dari *barcode scanner hardware*. Daripada mengikat (bind) 
 *   setiap ketikan ke `useState` (yang bisa lambat/tersendat jika scanner mengetik sangat cepat),
 *   komponen ini menangkap nilainya via `FormData` di momen *submit* (lebih performan untuk alat *scanner*).
 */
export default function ScanBarcodeStorageCard({ data, apiPostUrl, onSuccess, access }: ScanBarcodeStorageCardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const isGuest = Cookies.get("level") === "guest";
  const allowed = hasAccess(access);

  const filteredData = data.filter((item) => 
    item.no_batch.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.kode_ruah.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.kode_produk.toLowerCase().includes(searchQuery.toLowerCase())
  );

//   const countOver = data.filter(d => d.status_lead === "OVER").length;

  // Fungsi yang dipanggil saat user menekan Enter di dalam input
  const handleScanSubmit = async (e: React.FormEvent<HTMLFormElement>, id: number) => {
    e.preventDefault(); // Mencegah reload halaman

    if (!allowed) return;
    
    // Mengambil nilai dari input bernama "scanned_storage"
    const formData = new FormData(e.currentTarget);
    const scannedCode = formData.get("scanned_storage") as string;

    if (!scannedCode || !scannedCode.trim()) return;

    setLoadingId(id);

    try {
      const response = await apiFetch(apiPostUrl, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Cookies.get("token")}` 
        },
        body: JSON.stringify({
          id: id ? [id] : [],
          text: scannedCode.trim()
        }),
      });

      if (response.ok) {
        // Jika API mengembalikan sukses, input akan dikosongkan dan refresh tabel
        const formElement = e.target as HTMLFormElement;
        formElement.reset();
        
        // Beri efek visual sukses sementara jika diperlukan (opsional, bisa diganti toast)
        formElement.style.outline = '2px solid #22c55e';
        setTimeout(() => formElement.style.outline = '', 600);

        onSuccess();
      } else {
        const errData = await response.json();
        alert(errData.message || "Gagal menyimpan data scan.");
      }
    } catch (error) {
      alert("Koneksi ke server gagal.");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <TableCardShell
      title="SCAN BARCODE STORAGE"
      subtitle="Departement QC"
      count={data.length}
    //   countOver={countOver}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      onRefresh={onSuccess}
      headers={["Kode Ruah", "Kode Produk", "No Batch", "Compounding", "Storage / Bin", "Scan", "Status"]}
    >
      {filteredData.length === 0 ? (
        <tr>
          <td colSpan={7} className="px-4 py-8 text-center text-gray-500 italic border-b">
            Tidak ada data yang perlu di-scan.
          </td>
        </tr>
      ) : (
        filteredData.map((item) => (
          <tr 
            key={item.id} 
            className={`border-b hover:bg-gray-50 text-center ${item.status_lead === 'OVER' ? 'text-red-600' : 'text-gray-800'}`}
          >
            <td className="px-1 py-2 font-medium">{item.kode_ruah}</td>
            <td className="px-1 py-2 font-bold">{item.kode_produk}</td>
            <td className="px-1 py-2">{item.no_batch}</td>
            <td className="px-1 py-2">{item.mixing_tank || "-"}</td>
            <td className="px-1 py-2">{item.storage_tank || "-"}</td>
            
            {/* Kolom Input Scan */}
            <td className="px-1 py-2">
              <form 
                onSubmit={(e) => handleScanSubmit(e, item.id)}
                className="flex justify-center"
              >
                <input 
                  type="text" 
                  name="scanned_storage"
                  disabled={isGuest || !allowed || loadingId === item.id}
                  placeholder={loadingId === item.id ? "Menyimpan..." : ""}
                  title={!allowed ? "Anda tidak memiliki akses untuk melakukan aksi ini" : undefined}
                  className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#c7d6ab] text-center text-black disabled:bg-gray-100 disabled:cursor-not-allowed"
                  autoComplete="off"
                />
                <button type="submit" className="hidden">Submit</button>
              </form>
            </td>

            {/* Kolom Status */}
            <td className="px-1 py-2">
              <span 
                className={`px-3 py-1 rounded shadow-sm font-semibold text-xs text-white ${
                  item.kirim_ke_filling ? 'bg-green-500' : 'bg-yellow-500'
                }`}
              >
                {item.kirim_ke_filling ? 'Aktif' : 'Non-Aktif'}
              </span>
            </td>
          </tr>
        ))
      )}
    </TableCardShell>
  );
}