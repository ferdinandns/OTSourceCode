'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import Cookies from 'js-cookie';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { API_BASE_URL, apiFetch } from '@/lib/api';

const PROCESS_LIST = [
  "CWO", "Potong Stock", "Preparasi", "Timbang", "Validasi 1", "Validasi 2", "Compounding",
  "Terima Sample", "Analisa Complete", "Release QC", "Tempel Label Rilis",
  "Filling", "Sample FG", "End Packaging", "Setor BR", "Setor RAP",
  "Terima BR", "Terima RAP", "QA Release", "Shipment"
];

const KELOMPOK_LIST = [{ value: "Pharma", label: "Pharma" }, { value: "Herbal", label: "Herbal" }];
interface Option { value: string; label: string; }

/**
 * Komponen Filter untuk Halaman Report.
 * 
 * **Konsep Arsitektural:**
 * 1. **URL as Source of Truth (Hoisted State via URL)**: State untuk filter tidak hanya
 *    disimpan di lokal React state (useState), tetapi dipantulkan ke Query Parameter URL
 *    melalui router Next.js (`useSearchParams`). Hal ini memungkinkan URL di-bookmark 
 *    atau dibagikan (share) dengan filter yang masih menempel.
 * 2. **Client-Side Data Munging**: Komponen ini memfetch *master data* satu kali dari backend 
 *    lalu melakukan filterisasi berjenjang (cascading filter) di memori browser dengan `useMemo` 
 *    untuk meminimalkan request API repetitif saat user mengubah pilihan dropdown.
 */
export default function FilterReport() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 1. STATE UNTUK MENYIMPAN SELURUH JSON DARI GOLANG
  const [masterData, setMasterData] = useState<any[]>([]);

  // 2. STATE FORM FILTER
  const [filterType, setFilterType] = useState(searchParams.get('filter_type') || '');
  const [startDate, setStartDate] = useState(searchParams.get('start_date') || '');
  const [endDate, setEndDate] = useState(searchParams.get('end_date') || '');
  
  const [kelompokProduk, setKelompokProduk] = useState<string[]>(searchParams.getAll('kategori[]'));
  const [kodeProduk, setKodeProduk] = useState<string[]>(searchParams.getAll('kode_produk[]'));
  const [batches, setBatches] = useState<string[]>(searchParams.getAll('batches[]'));
  
  const [startProcess, setStartProcess] = useState(searchParams.get('start_process') || '');
  const [endProcess, setEndProcess] = useState(searchParams.get('end_process') || '');

  // FETCH MASTER DATA (HANYA 1X SAAT HALAMAN DIBUKA)
  useEffect(() => {
    const fetchLeadtimeSummary = async () => {
      const token = Cookies.get("token");
      if (!token) return;

      try {
        const res = await apiFetch(`${API_BASE_URL}/api/v1/master/leadtime-summary`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            const dataArray = Object.values(json.data);
            setMasterData(dataArray);
          }
        }
      } catch (error) {
        console.error("Gagal memuat master data:", error);
      }
    };

    fetchLeadtimeSummary();
  }, []);

  // CASCADING DROPDOWN LOGIC
  
  // Ekstrak semua kode_produk yang unik dari masterData
  const filteredByDateData = useMemo(() => {
    if (!startDate || !endDate) return masterData;
    
    // Pastikan parsing ke waktu lokal dari input YYYY-MM-DD
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59`);

    return masterData.filter(item => {
      if (!item.tanggal_wo || item.tanggal_wo.startsWith("0001-01-01")) return false;
      
      // Amankan spasi agar bisa di-parse oleh browser (ubah "2026-01-05 09:27:02" jadi format ISO)
      const dateStr = item.tanggal_wo.replace(' ', 'T');
      const itemDate = new Date(dateStr);
      
      return itemDate >= start && itemDate <= end;
    });
  }, [masterData, startDate, endDate]);

  // Filter TAHAP 2: Untuk Batch Report & Product Report, saring data yang lolos filter tanggal
  // berdasarkan Kelompok Produk (Pharma/Herbal) yang dipilih user.
  // NOTE: field kategori dari API leadtime-summary bernama "kategori".
  const filteredByKelompokData = useMemo(() => {
    if (kelompokProduk.length === 0) return filteredByDateData;
    return filteredByDateData.filter(item => kelompokProduk.includes(item.kategori));
  }, [filteredByDateData, kelompokProduk]);

  // Opsi Produk (dipakai bersama oleh Batch Report & Product Report), sudah difilter tanggal + kelompok
  const produkOptionsFiltered = useMemo<Option[]>(() => {
    const uniqueProduk = Array.from(new Set(filteredByKelompokData.map(item => item.kode_produk).filter(Boolean)));
    return uniqueProduk.map(p => ({ value: p as string, label: p as string }));
  }, [filteredByKelompokData]);

  // Filter TAHAP 3: Ekstrak Opsi Batch HANYA dari produk yang dipilih, dalam data yang sudah
  // tersaring tanggal + kelompok
  const batchOptions = useMemo<Option[]>(() => {
    if (kodeProduk.length === 0) return [];
    
    const filteredBatches = filteredByKelompokData.filter(item => kodeProduk.includes(item.kode_produk));
    return filteredBatches.map(b => ({
      value: String(b.id),
      label: b.no_batch
    }));
  }, [filteredByKelompokData, kodeProduk]);

  // Reset pilihan Produk & Batch setiap kali Kelompok Produk berubah,
  // supaya tidak ada produk "nyangkut" dari kelompok yang sudah tidak dipilih.
  useEffect(() => {
    setKodeProduk([]);
    setBatches([]);
  }, [kelompokProduk]);

  // Evaluasi UI
  const isKelompokFilled = kelompokProduk.length > 0;
  const isProdukFilled = kodeProduk.length > 0;
  const isBatchFilled = batches.length > 0;
  const isDatesFilled = startDate !== '' && endDate !== '';
  const hasDataInDateRange = filteredByDateData.length > 0; // Cek ketersediaan data

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setFilterType(val);
    router.push(val ? `${pathname}?filter_type=${val}` : pathname);
  };

  const handleApplyFilter = () => {
    const params = new URLSearchParams();
    if (filterType) params.set('filter_type', filterType);
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    if (startProcess) params.set('start_process', startProcess);
    if (endProcess) params.set('end_process', endProcess);
    
    kelompokProduk.forEach(k => params.append('kategori[]', k));
    kodeProduk.forEach(p => params.append('kode_produk[]', p));
    batches.forEach(b => params.append('batches[]', b));

    router.push(`${pathname}?${params.toString()}`);
  };

  const handleResetFilter = () => {
    router.push(filterType ? `${pathname}?filter_type=${filterType}` : pathname);
  };

  const showProcessesForBatch = filterType === 'batch' && isBatchFilled;
  const showProcessesForGroup = filterType === 'group' && isKelompokFilled && endDate !== '';
  const showProcessesForProduk = filterType === 'produk' && isProdukFilled && endDate !== '';
  const canShowProcesses = showProcessesForBatch || showProcessesForGroup || showProcessesForProduk;

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl text-black font-bold">
          {filterType === 'produk' ? 'Product Reporting' : filterType === 'group' ? 'Product Category Reporting' : filterType === 'batch' ? 'Batch Reporting' : 'Pilih Tipe Report'}
        </h2>
        
        <div className="w-64">
          <select className="text-gray-500 w-full border p-2 rounded-md bg-gray-50" value={filterType} onChange={handleTypeChange}>
            <option value="">-- Pilih Tipe Report --</option>
            <option value="batch">Batch Report</option>
            <option value="produk">Product Report</option>
            <option value="group">Product Category Report</option>
          </select>
        </div>
      </div>

      {/* Input lainnya baru muncul setelah user memilih Tipe Report */}
      {filterType !== '' && (
      <div className="space-y-2">
        {/* Filter Tanggal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 text-black">
          <div>
            <Label className="text-sm font-semibold mb-2 block">Start Date (Tanggal WO):</Label>
            <div className='outline rounded-sm px-2'>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-sm font-semibold mb-2 block">End Date (Tanggal WO):</Label>
            <div className='outline rounded-sm px-2'>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        </div>

        {/* LOGIKA BATCH REPORT */}
        {filterType === 'batch' && (
          <div className="space-y-4 border-b pb-4">
            {/* Cegat di sini jika tanggal sudah diisi tapi data kosong */}
            {isDatesFilled && !hasDataInDateRange ? (
              <div className="text-red-600 font-medium bg-red-50 p-3 rounded-md text-sm border border-red-100">
                ⚠️ Tidak ada data batch yang diproduksi pada rentang tanggal tersebut.
              </div>
            ) : (
              <>
                <div>
                  <Label className="text-black text-sm font-semibold mb-2 block">Pilih Kelompok Produk:</Label>
                  <MultiSelect options={KELOMPOK_LIST} selected={kelompokProduk} onChange={setKelompokProduk} placeholder="-- pilih kelompok --" />
                </div>
                
                {isDatesFilled && isKelompokFilled && (
                  <div>
                    <Label className="text-black text-sm font-semibold mb-2 block">Pilih Produk (Tersedia pada tanggal & kelompok tersebut):</Label>
                    <MultiSelect options={produkOptionsFiltered} selected={kodeProduk} onChange={setKodeProduk} placeholder="-- pilih produk --" />
                  </div>
                )}

                {isProdukFilled && (
                  <div>
                    <Label className="text-sm text-black font-semibold mb-2 block">Pilih Batch:</Label>
                    <MultiSelect options={batchOptions} selected={batches} onChange={setBatches} placeholder="-- cari atau pilih batch --" />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* LOGIKA GROUP REPORT */}
        {filterType === 'group' && (
          <div className="border-b pb-4">
             {isDatesFilled && !hasDataInDateRange ? (
                <div className="text-red-600 font-medium bg-red-50 p-3 rounded-md text-sm border border-red-100">
                  ⚠️ Tidak ada data yang diproduksi pada rentang tanggal tersebut.
                </div>
             ) : (
                <>
                  <Label className="text-sm text-black font-semibold mb-2 block">Pilih Kelompok Produk:</Label>
                  <MultiSelect options={KELOMPOK_LIST} selected={kelompokProduk} onChange={setKelompokProduk} placeholder="-- pilih kelompok --" />
                </>
             )}
          </div>
        )}

        {/* LOGIKA PRODUCT REPORT */}
        {filterType === 'produk' && (
          <div className="space-y-4 border-b pb-4">
             {isDatesFilled && !hasDataInDateRange ? (
                <div className="text-red-600 font-medium bg-red-50 p-3 rounded-md text-sm border border-red-100">
                  ⚠️ Tidak ada data produk pada rentang tanggal tersebut.
                </div>
             ) : (
                <>
                  <div>
                    <Label className="text-sm text-black font-semibold mb-2 block">Pilih Kelompok Produk:</Label>
                    <MultiSelect options={KELOMPOK_LIST} selected={kelompokProduk} onChange={setKelompokProduk} placeholder="-- pilih kelompok --" />
                  </div>

                  {isDatesFilled && isKelompokFilled && (
                    <div>
                      <Label className="text-sm text-black font-semibold mb-2 block">Pilih Produk (Tersedia pada tanggal & kelompok tersebut):</Label>
                      <MultiSelect options={produkOptionsFiltered} selected={kodeProduk} onChange={setKodeProduk} placeholder="-- pilih produk --" />
                    </div>
                  )}
                </>
             )}
          </div>
        )}

        {/* MUNCUL JIKA SEMUA SYARAT TERPENUHI */}
        {canShowProcesses && hasDataInDateRange && (
          <div className="pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <Label className="text-black text-sm font-semibold mb-2 block">Proses Mulai:</Label>
                <select className="text-black w-full border p-2 rounded-md" value={startProcess} onChange={(e) => setStartProcess(e.target.value)}>
                  <option value="">-- pilih proses mulai --</option>
                  {PROCESS_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-black text-sm font-semibold mb-2 block">Proses Akhir:</Label>
                <select className="text-black w-full border p-2 rounded-md" value={endProcess} onChange={(e) => setEndProcess(e.target.value)}>
                  <option value="">-- pilih proses akhir --</option>
                  {PROCESS_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleApplyFilter} className="bg-green-600 hover:bg-green-700 cursor-pointer">Tampilkan Grafik</Button>
              <Button onClick={handleResetFilter} className='bg-gray-500 hover:bg-gray-600 cursor-pointer'>Hapus Filter</Button>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}