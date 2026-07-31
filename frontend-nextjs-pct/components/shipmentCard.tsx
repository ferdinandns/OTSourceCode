// src/components/shipmentCard.tsx
"use client";

import { useState } from "react";
import Cookies from "js-cookie";
import { X } from "lucide-react";
import TableCardShell from "./tableCardShell";
import { calculateDuration } from "@/utils/formatTime"; 
import { AccessRule, hasAccess } from "@/lib/access";
import { apiFetch } from "@/lib/api";

export interface ShipmentData {
  id: number;
  kode_ruah: string;
  kode_produk: string;
  no_batch: string;
  qa_release_date: string; 
  shipment_received_at: string | null; 
}

interface ShipmentCardProps {
  data: ShipmentData[];
  apiPostUrl: string;
  onSuccess: () => void;
  access?: AccessRule;
}

/**
 * Komponen UI Card untuk Modul "Shipment" (Gudang / Warehouse).
 * 
 * **Konsep Arsitektural:**
 * - **Eventual Consistency UI**: Menandai *Record* secara visual menggunakan 
 *   pola `isReceived` (berdasarkan ada/tidaknya nilai `shipment_received_at`). 
 *   Warna baris diubah menjadi merah (alert visual) jika *Shipment* masuk ke sistem 
 *   namun belum ditekan tombol "Terima", menuntut tindakan proaktif dari operator Warehouse.
 * - **Single Resource Endpoint**: Mengirim payload `{ status: "terima" }` ke API yang sama, 
 *   mengandalkan kapabilitas endpoint backend untuk menerjemahkan status baru.
 */
export default function ShipmentCard({ data, apiPostUrl, onSuccess, access }: ShipmentCardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  
  // State untuk modal konfirmasi
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ShipmentData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isGuest = Cookies.get("level") === "guest";
  const allowed = hasAccess(access);
  

  const filteredData = data.filter((item) => 
    item.no_batch.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.kode_ruah.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.kode_produk.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenModal = (item: ShipmentData) => {
    if (!allowed) return;
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleConfirmTerima = async () => {
    if (!selectedItem) return;
    if (!allowed) return;
    setIsSubmitting(true);

    try {
      const response = await apiFetch(apiPostUrl, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Cookies.get("token")}` 
        },
        body: JSON.stringify({
          id: selectedItem?.id ? [selectedItem.id] : [],
          status: "terima"
        }),
      });

      if (response.ok) {
        setIsModalOpen(false);
        setSelectedItem(null);
        onSuccess();
      } else {
        const errData = await response.json();
        alert(errData.message || "Gagal memproses penerimaan.");
      }
    } catch (error) {
      alert("Koneksi ke server gagal.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <TableCardShell
        title="SHIPMENT"
        subtitle="Departement Warehouse"
        count={data.length}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onRefresh={onSuccess}
        hideHeaderRefresh={true}
        headers={["Kode Ruah", "Kode Produk", "No Batch", "Tanggal Shipment", "Terima"]}
      >
        {filteredData.length === 0 ? (
          <tr>
            <td colSpan={5} className="px-4 py-8 text-center text-gray-500 italic border-b">
              Tidak ada data.
            </td>
          </tr>
        ) : (
          filteredData.map((item) => {
            // Cek apakah shipment sudah diterima
            const isReceived = item.shipment_received_at !== null;
            
            // Jika belum diterima, ubah warna teks menjadi merah
            const rowTextColor = !isReceived ? "text-red-500 font-medium" : "text-gray-800";

            return (
              <tr key={item.id} className={`border-b hover:bg-gray-50 text-center ${rowTextColor}`}>
                <td className="px-2 py-3">{item.kode_ruah}</td>
                <td className="px-2 py-3">{item.kode_produk}</td>
                <td className="px-2 py-3">{item.no_batch}</td>
                
                {/* Kolom Tanggal Shipment & Durasi */}
                <td className="px-2 py-3 text-sm">
                  {item.qa_release_date ? (
                    <>
                      <span className="block">
                        {new Date(item.qa_release_date).toLocaleString('id-ID')}
                      </span>
                      {/* Durasi hanya tampil jika isReceived false (belum diterima) */}
                      {!isReceived && (
                        <span className="text-sm">
                          Durasi : {calculateDuration(item.qa_release_date)}
                        </span>
                      )}
                    </>
                  ) : "-"}
                </td>
                
                {/* Kolom Aksi / Status Terima */}
                <td className="px-2 py-3">
                  {isReceived ? (
                    <span className="bg-[#198754] text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                      {new Date(item.shipment_received_at!).toLocaleString('id-ID')}
                    </span>
                  ) : (
                    <button 
                      onClick={() => handleOpenModal(item)}
                      disabled={isGuest || !allowed}
                      title={!allowed ? "Anda tidak memiliki akses untuk melakukan aksi ini" : undefined}
                      className="bg-[#0d6efd] hover:bg-[#0b5ed7] text-white px-4 py-1.5 rounded text-sm font-medium transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Terima
                    </button>
                  )}
                </td>
              </tr>
            );
          })
        )}
      </TableCardShell>

      {/* MODAL KONFIRMASI TERIMA (Tetap Sama) */}
      {isModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-pop-in">
            <div className="bg-[#c7d6ab] p-4 flex justify-between items-center">
              <h5 className="font-bold text-gray-900">Konfirmasi Penerimaan</h5>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-800 hover:text-black cursor-pointer">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-5 text-center">
              <p className="text-sm text-gray-700 mb-4">
                Apakah Anda yakin ingin menerima shipment untuk Batch <strong>{selectedItem.no_batch}</strong>?
              </p>
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
                onClick={handleConfirmTerima}
                disabled={isSubmitting || !allowed}
                title={!allowed ? "Anda tidak memiliki akses untuk melakukan aksi ini" : undefined}
                className="px-4 py-2 bg-[#0d6efd] text-white rounded text-sm font-semibold hover:bg-[#0b5ed7] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Memproses..." : "Ya, Terima"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}