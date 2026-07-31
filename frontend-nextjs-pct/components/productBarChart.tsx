'use client';

import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartDataLabels);

const xValues = [
  "CWO", "Potong Stock", "Preparasi", "Timbang", "Validasi 1", "Validasi 2", "Compounding",
  "Terima Sample", "Analisa Complete", "Release QC", "Tempel Label Rilis",
  "Filling", "Sample FG", "End Packaging", "Setor BR", "Setor RAP",
  "Terima BR", "Terima RAP", "QA Release", "Shipment"
];

const processCols = [
  "lead_cwo", "lead_potong_stock", "lead_preparasi", "lead_timbang", "lead_validasi1", "lead_validasi2", "lead_compounding",
  "lead_terima_sample", "lead_analisa_complete", "lead_release_qc", "lead_tempel_label_rilis",
  "lead_filling", "lead_sample_fg", "lead_end_packaging", "lead_setor_br", "lead_setor_rap",
  "lead_terima_br", "lead_terima_rap", "qa_release", "lead_shipment"
];

const dateFieldMap = [
  "tanggal_wo", "tanggal_potong_stock", "tanggal_timbang", "tanggal_timbang", "tanggal_terima_val1", "tanggal_terima_val2", "tanggal_kirim_compounding",
  "tanggal_kirim_ke_qc", "analisa_complete_date", "qc_release_date", "tempel_label_release_date",
  "kirim_ke_filling", "kirim_ke_sample_fg", "kirim_ke_end_packaging", "setor_br_date", "setor_rap_date",
  "terima_br_date", "terima_rap_date", "qa_release_date", "shipment_received_at"
];

function formatDate(dateStr: string) {
  if (!dateStr || dateStr.startsWith("0001-01-01")) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Komponen Grafik "Product Bar Chart" (Rata-rata Keseluruhan dan Per Produk).
 * 
 * **Konsep Arsitektural:**
 * - **Custom Aggregation Engine**: Menulis ulang logika pengelompokan (*group by*) berdasarkan 
 *   `kode_produk` di *Client-side*. Ini memberikan fleksibilitas saat user mengubah parameter 
 *   pencarian di URL tanpa membebani server database (Go).
 * - **Hybrid Data Structure**: Menghasilkan objek kompleks `tanggalRangePerBatch` dan `totalBatchPerProduk` 
 *   selama tahap *reduce*, yang khusus dirancang untuk di-*inject* ke dalam *Tooltip Chart.js*,
 *   memberikan detail *hover* yang sangat kaya secara data.
 */
export default function ProductBarCharts({ leadtimeData, startProcess, endProcess }: { leadtimeData: any[], startProcess: string, endProcess: string }) {
  
  let startIdx = xValues.indexOf(startProcess);
  let endIdx = xValues.indexOf(endProcess);
  if (startIdx === -1 || endIdx === -1) { startIdx = 0; endIdx = xValues.length - 1; }
  if (startIdx > endIdx) [startIdx, endIdx] = [endIdx, startIdx];

  // ENGINE AGREGASI (Meniru Logika Laravel)
  const { totalPerProduk, rataRataHariKeseluruhan, totalBatchPerProduk, tanggalRangePerBatch } = useMemo(() => {
    
    // 1. Lacak Range Tanggal per Batch
    const tanggalRangePerBatch: Record<string, { start: Date | null, end: Date | null }> = {};
    const totalBatchPerProduk: Record<string, Set<string>> = {};

    leadtimeData.forEach(row => {
      const produk = row.kode_produk;
      const batch = row.no_batch;
      if (!produk || !batch) return;

      if (!tanggalRangePerBatch[batch]) {
        tanggalRangePerBatch[batch] = { start: null, end: null };
      }

      for (let i = startIdx; i <= endIdx; i++) {
        const rawDate = row[dateFieldMap[i]];
        if (!rawDate || rawDate.startsWith("0001-01-01")) continue;

        const dateObj = new Date(rawDate);
        if (isNaN(dateObj.getTime())) continue;

        if (!tanggalRangePerBatch[batch].start || dateObj < tanggalRangePerBatch[batch].start) tanggalRangePerBatch[batch].start = dateObj;
        if (!tanggalRangePerBatch[batch].end || dateObj > tanggalRangePerBatch[batch].end) tanggalRangePerBatch[batch].end = dateObj;

        if (!totalBatchPerProduk[produk]) totalBatchPerProduk[produk] = new Set();
        totalBatchPerProduk[produk].add(batch);
      }
    });

    // 2. Hitung Rata-rata per Produk
    const prodGroups: Record<string, any[]> = {};
    leadtimeData.forEach(r => {
      if (r.kode_produk) {
        if (!prodGroups[r.kode_produk]) prodGroups[r.kode_produk] = [];
        prodGroups[r.kode_produk].push(r);
      }
    });

    const totalPerProduk: { kode: string, totalHari: number }[] = [];
    let sumTotalHariSemuaProduk = 0;

    Object.keys(prodGroups).forEach(prod => {
      let totalMenitProduk = 0;
      for (let i = startIdx; i <= endIdx; i++) {
        const col = processCols[i];
        let sum = 0, count = 0;
        prodGroups[prod].forEach(row => {
          if (row[col] > 0) { sum += row[col]; count++; }
        });
        if (count > 0) totalMenitProduk += (sum / count);
      }
      
      const hari = totalMenitProduk / 1440;
      totalPerProduk.push({ kode: prod, totalHari: hari });
      sumTotalHariSemuaProduk += hari;
    });

    // 3. Hitung Rata-rata Keseluruhan (Dari Rata-rata Produk)
    const rataRataHariKeseluruhan = totalPerProduk.length > 0 ? (sumTotalHariSemuaProduk / totalPerProduk.length) : 0;

    return { totalPerProduk, rataRataHariKeseluruhan, totalBatchPerProduk, tanggalRangePerBatch };
  }, [leadtimeData, startIdx, endIdx]);

  // CHART 1: Rata-Rata Total Keseluruhan (1 Bar)
  const chart1Options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: "Rata-Rata Leadtime Total Semua Produk (Hari)" },
      datalabels: { 
        rotation: -90,
        color: 'black',
        // Jika batangnya sangat banyak, teks akan disembunyikan agar tidak bertumpuk
        display: (ctx: any) => ctx.chart.data.datasets[0].data.length <= 85,
        formatter: (v: any) => parseFloat(v) > 0 ? `${parseFloat(v).toFixed(2)} Hari` : '' 
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const hari = ctx.raw;
            const batches = Object.keys(tanggalRangePerBatch);
            const batchLines = batches.map(b => {
              const tgl = tanggalRangePerBatch[b];
              return `- ${b}: ${tgl.start ? formatDate(tgl.start.toISOString()) : '-'} s/d ${tgl.end ? formatDate(tgl.end.toISOString()) : '-'}`;
            });

            return [
              `Total Produk: ${totalPerProduk.length}`,
              `Total Batch: ${batches.length}`,
              `${hari.toFixed(2)} Hari`,
              `${(hari * 24).toFixed(1)} Jam`,
              `${(hari * 1440).toLocaleString('id-ID')} Menit`,
              '',
              `Range: ${startProcess} → ${endProcess}`,
              'Detail Batch:',
              ...batchLines
            ];
          }
        }
      }
    },
    scales: { y: { beginAtZero: true, title: { display: true, text: "Hari" } } }
  };

  // CHART 2: Rata-Rata Total per Produk (Banyak Bar)
  const chart2Options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: "Rata-Rata Total Leadtime per Produk (Hari)" },
      datalabels: { 
        rotation: -90,
        color: 'black',
        // Jika batangnya sangat banyak, teks akan disembunyikan agar tidak bertumpuk
        display: (ctx: any) => ctx.chart.data.datasets[0].data.length <= 85,
        formatter: (v: any) => parseFloat(v) > 0 ? `${parseFloat(v).toFixed(2)} Hari` : '' 
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const produk = ctx.label;
            const hari = ctx.raw;
            const batches = Array.from(totalBatchPerProduk[produk] || []);
            
            const batchLines = batches.map(b => {
              const tgl = tanggalRangePerBatch[b as string];
              return `- ${b}: ${tgl.start ? formatDate(tgl.start.toISOString()) : '-'} s/d ${tgl.end ? formatDate(tgl.end.toISOString()) : '-'}`;
            });

            return [
              `Total Batch: ${batches.length}`,
              `${hari.toFixed(2)} Hari`,
              `${(hari * 24).toFixed(1)} Jam`,
              `${(hari * 1440).toLocaleString('id-ID')} Menit`,
              '',
              `Range: ${startProcess} → ${endProcess}`,
              'Detail Batch:',
              ...batchLines
            ];
          }
        }
      }
    },
    scales: { y: { beginAtZero: true, title: { display: true, text: "Hari" } }, x: { title: { display: true, text: "Kode Produk" } } }
  };

  return (
    <div className="space-y-8">
      {/* Chart 1: Rata-Rata Semua Produk */}
      <div className="w-full bg-white p-4 rounded-lg border shadow-sm h-[400px] mt-8">
        <Bar 
          data={{
            labels: ["Rata-Rata Semua Produk"],
            datasets: [{
              label: "Rata-Rata", data: [rataRataHariKeseluruhan],
              backgroundColor: "rgba(75,192,192,0.8)", borderColor: "rgba(75,192,192,1)", borderWidth: 1
            }]
          }} 
          options={chart1Options} 
        />
      </div>

      {/* Chart 2: Rata-Rata per Produk */}
      {totalPerProduk.length > 0 && (
        <div className="w-full bg-white p-4 rounded-lg border shadow-sm h-[400px]">
          <Bar 
            data={{
              labels: totalPerProduk.map(p => p.kode),
              datasets: [{
                label: "Total Leadtime", data: totalPerProduk.map(p => p.totalHari),
                backgroundColor: "rgba(54, 162, 235, 0.8)", borderColor: "rgba(54, 162, 235, 1)", borderWidth: 1
              }]
            }} 
            options={chart2Options} 
          />
        </div>
      )}
    </div>
  );
}