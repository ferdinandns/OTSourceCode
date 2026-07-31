// src/components/TableCardShell.tsx
"use client";

import { ReactNode } from "react";
import { RefreshCw } from "lucide-react";

interface TableCardShellProps {
  title: string;
  subtitle: string;
  count: number;
  countOver?: number;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  onRefresh: () => void;
  headers: string[];
  children: ReactNode;
  footerComponent?: ReactNode;
  hideHeaderRefresh?: boolean;
}

/**
 * Komponen UI Layout "TableCardShell".
 * 
 * **Konsep Arsitektural:**
 * 1. **Composition Pattern**: Menggunakan pola *composition* React (menerima `children`) 
 *    untuk memisahkan "cangkang/kerangka tabel" dari "isi baris data (rows)". 
 *    Hal ini memungkinkan developer menyuntikkan (inject) baris tabel khusus dari 
 *    komponen induk tanpa merusak styling kerangka utamanya.
 * 2. **Stateless UI**: Komponen ini murni untuk *presentation* (menampilkan tabel dan header), 
 *    serta menerima properti state pencarian (Search Query) dari luar (hoisted state), 
 *    sehingga proses filterisasi dapat dilakukan di level *parent component*.
 */
export default function TableCardShell({
  title, subtitle, count, countOver,
  searchQuery, setSearchQuery, onRefresh,
  headers, children, footerComponent,
  hideHeaderRefresh = false
}: TableCardShellProps) {

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col h-[400px] lg:w-max lg:min-w-full overflow-hidden">

      {/* Header Hijau */}
      <div className="bg-[#c7d6ab] p-3 flex justify-between items-center shrink-0">
        <div className={`flex items-start gap-4 ${hideHeaderRefresh ? "w-full" : ""}`}>
          <div>
            <h3 className="font-bold text-gray-800 uppercase flex items-center gap-2">
              {title}
            </h3>
            <p className="text-sm text-gray-700">{subtitle}</p>
          </div>

          <div className={`flex flex-col gap-1 ${hideHeaderRefresh ? "ml-auto" : ""}`}>
            <span className="bg-white text-black text-xs font-bold px-2.5 py-0.5 rounded-full">
              Total: {count}
            </span>
            {countOver && countOver > 0 ? (
              <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                Over: {countOver}
              </span>
            ) : null}
          </div>
        </div>

        {!hideHeaderRefresh && (
          <button
            onClick={onRefresh}
            className="bg-white p-2 rounded hover:bg-gray-100 transition shadow-sm text-gray-700 cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw size={18} />
          </button>
        )}
      </div>

      <div className="p-4 flex-grow flex flex-col gap-3 overflow-hidden">
        {/* Kolom Pencarian */}
        <input
          type="text"
          placeholder="Cari Kode Ruah/Kode Produk/No Batch..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full border border-gray-300 rounded p-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#c7d6ab] shrink-0"
        />

        {/* Cangkang Tabel */}
        <div className="flex-grow overflow-y-auto border border-gray-200 rounded">
          {/* Tambahkan border-collapse agar garis tabel menyatu rapi */}
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-white bg-gray-800 sticky top-0 z-20 shadow-sm">
              <tr>
                {headers.map((head, idx) => (
                  <th key={idx} className="px-1 py-2 text-center border-x border-gray-700">{head}</th>
                ))}
              </tr>
            </thead>
            {/* PENJELASAN CLASS TBODY:
              - [&>tr]:border-b [&>tr]:border-gray-100 -> Membuat garis bawah tipis/halus (gray-100).
              - [&>tr:nth-child(odd)]:bg-white -> Baris ganjil warna putih.
              - [&>tr:nth-child(even)]:bg-gray-50 -> Baris genap warna abu-abu super terang.
              - [&>tr:hover]:!bg-[#eaf4ff] -> Saat dihover berubah jadi biru muda (memaksa nimpa warna ganjil/genap dengan `!`).
              - [&>tr>td]:border-x [&>tr>td]:border-gray-200 -> Memberikan garis pembatas antar kolom (vertikal).
            */}
            <tbody className="[&>tr]:border-b [&>tr]:border-gray-100 [&>tr:nth-child(odd)]:bg-white [&>tr:nth-child(even)]:bg-gray-50 [&>tr:hover]:!bg-[#eaeaeb] [&>tr>td]:border-x [&>tr>td]:border-gray-200">
              {children}
            </tbody>
          </table>
        </div>
        {footerComponent && (
          <div className="mt-1 shrink-0">
            {footerComponent}
          </div>
        )}
      </div>
    </div>
  );
}