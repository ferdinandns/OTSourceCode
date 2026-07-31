'use client';

import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import annotationPlugin from 'chartjs-plugin-annotation';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ChartDataLabels, annotationPlugin);

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

const colors = [
  'rgba(75, 192, 192, 1)', 'rgba(255, 99, 132, 1)', 'rgba(54, 162, 235, 1)',
  'rgba(255, 206, 86, 1)', 'rgba(153, 102, 255, 1)', 'rgba(255, 159, 64, 1)'
];

function formatDate(dateStr: string) {
  if (!dateStr || dateStr.startsWith("0001-01-01")) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Komponen Grafik "Product Line Chart" (Pergerakan Waktu Berdasarkan Produk).
 * 
 * **Konsep Arsitektural:**
 * - **Matrix Computation di Client**: Proses komputasi di `useMemo` membentuk struktur matriks 2D 
 *   (Produk x Proses), kemudian meratakannya (*flattening*) ke dalam array datasets `Chart.js`.
 * - **Defensive Null-checking**: Karena tidak semua produk melewati seluruh tahapan (ada proses yang dilewati), 
 *   *dataset mapping* menerapkan pola *null fallback* agar garis grafik terputus wajar daripada 
 *   jatuh (drop) ke nilai 0 yang menyesatkan (misleading graph).
 */
export default function ProductLineCharts({ leadtimeData, startProcess, endProcess }: { leadtimeData: any[], startProcess: string, endProcess: string }) {
  
  let startIdx = xValues.indexOf(startProcess);
  let endIdx = xValues.indexOf(endProcess);
  if (startIdx === -1 || endIdx === -1) { startIdx = 0; endIdx = xValues.length - 1; }
  if (startIdx > endIdx) [startIdx, endIdx] = [endIdx, startIdx];

  // ENGINE MENGHITUNG RATA-RATA (AGGREGATION)
  const { avgOverall, avgPerProduk, dateTrackerOverall, dateTrackerProduk } = useMemo(() => {
    const sumAll: Record<string, number> = {};
    const countAll: Record<string, number> = {};
    const sumProd: Record<string, Record<string, number>> = {};
    const countProd: Record<string, Record<string, number>> = {};
    
    // Tracker untuk tanggal pertama dan terakhir
    const dateTrackerOverall: Record<string, { first: any, last: any }> = {};
    const dateTrackerProduk: Record<string, Record<string, { first: any, last: any }>> = {};

    leadtimeData.forEach(row => {
      const prod = row.kode_produk;
      if (!prod) return;

      if (!sumProd[prod]) { sumProd[prod] = {}; countProd[prod] = {}; dateTrackerProduk[prod] = {}; }

      xValues.forEach((procName, idx) => {
        const colName = processCols[idx];
        const val = row[colName];
        
        // 1. Hitung jumlah & count untuk rata-rata (hanya jika > 0)
        if (val && val > 0) {
          sumAll[colName] = (sumAll[colName] || 0) + val;
          countAll[colName] = (countAll[colName] || 0) + 1;
          
          sumProd[prod][colName] = (sumProd[prod][colName] || 0) + val;
          countProd[prod][colName] = (countProd[prod][colName] || 0) + 1;
        }

        // 2. Lacak Tanggal Pertama & Terakhir
        const dateField = dateFieldMap[idx];
        const rawDate = row[dateField];
        if (rawDate && !rawDate.startsWith("0001-01-01")) {
          const dateObj = new Date(rawDate);
          const formatted = formatDate(rawDate);
          const batchInfo = { raw: dateObj, formatted, batch: row.no_batch };

          // Overall Tracker
          if (!dateTrackerOverall[procName]) {
            dateTrackerOverall[procName] = { first: batchInfo, last: batchInfo };
          } else {
            if (dateObj < dateTrackerOverall[procName].first.raw) dateTrackerOverall[procName].first = batchInfo;
            if (dateObj > dateTrackerOverall[procName].last.raw) dateTrackerOverall[procName].last = batchInfo;
          }

          // Produk Tracker
          if (!dateTrackerProduk[prod][procName]) {
            dateTrackerProduk[prod][procName] = { first: batchInfo, last: batchInfo };
          } else {
            if (dateObj < dateTrackerProduk[prod][procName].first.raw) dateTrackerProduk[prod][procName].first = batchInfo;
            if (dateObj > dateTrackerProduk[prod][procName].last.raw) dateTrackerProduk[prod][procName].last = batchInfo;
          }
        }
      });
    });

    // Finalisasi Rata-Rata Overall
    const avgOverall = processCols.map(col => countAll[col] ? (sumAll[col] / countAll[col]) : null);
    
    // Finalisasi Rata-Rata per Produk
    const avgPerProduk: Record<string, (number | null)[]> = {};
    Object.keys(sumProd).forEach(prod => {
      avgPerProduk[prod] = processCols.map(col => countProd[prod][col] ? (sumProd[prod][col] / countProd[prod][col]) : null);
    });

    return { avgOverall, avgPerProduk, dateTrackerOverall, dateTrackerProduk };
  }, [leadtimeData]);

  // KONFIGURASI GRAFIK 1 (RATA-RATA KESELURUHAN)
  const chart1Data = {
    labels: xValues,
    datasets: [{
      label: "Rata-rata Leadtime (Semua Produk)",
      data: avgOverall.map((val, idx) => (idx < startIdx || idx > endIdx) ? null : val),
      borderColor: 'rgba(75, 192, 192, 1)',
      backgroundColor: 'transparent',
      borderWidth: 2,
      fill: false,
      tension: 0.3
    }]
  };

  const chart1Options = {
    responsive: true,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: { position: 'bottom' as const },
      title: { display: true, text: "Leadtime Detail per Proses (Rata-rata Keseluruhan)" },
      datalabels: {
        anchor: 'end' as const, align: 'top' as const, color: 'black',
        formatter: (v: any) => v >= 1440 ? `${(v / 1440).toFixed(1)} days` : v > 60 ? `${(v / 60).toFixed(1)} hours` : v > 0 ? `${v.toFixed(1)} min` : ''
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (ctx: any) => {
            const v = Number(ctx.raw);
            if (!v || v <= 0) return null;
            const procName = xValues[ctx.dataIndex];
            const tracker = dateTrackerOverall[procName];
            
            return [
              `Proses: ${procName}`,
              `${v.toFixed(1)} menit`,
              `${(v / 60).toFixed(1)} jam`,
              `${(v / 1440).toFixed(1)} hari`,
              `Tgl Pertama: ${tracker?.first?.formatted || '-'} (${tracker?.first?.batch || '-'})`,
              `Tgl Terakhir: ${tracker?.last?.formatted || '-'} (${tracker?.last?.batch || '-'})`
            ];
          }
        }
      }
    },
    scales: { y: { beginAtZero: true } }
  };

  // KONFIGURASI GRAFIK 2 (RATA-RATA PER PRODUK)
  const produkKeys = Object.keys(avgPerProduk);
  const chart2Data = {
    labels: xValues,
    datasets: produkKeys.map((prod, i) => ({
      label: prod,
      data: avgPerProduk[prod].map((val, idx) => (idx < startIdx || idx > endIdx) ? null : val),
      borderColor: colors[i % colors.length],
      backgroundColor: 'transparent',
      borderWidth: 2,
      fill: false,
      tension: 0.3
    }))
  };

  const chart2Options = {
    responsive: true,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: { position: 'bottom' as const },
      title: { display: true, text: `Leadtime Detail per Produk (Rentang yang difilter)` },
      datalabels: {
        anchor: 'end' as const, align: 'top' as const, color: 'black',
        formatter: (v: any) => v >= 1440 ? `${(v / 1440).toFixed(1)} days` : v > 60 ? `${(v / 60).toFixed(1)} hours` : v > 0 ? `${v.toFixed(1)} min` : ''
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (ctx: any) => {
            const v = Number(ctx.raw);
            if (!v || v <= 0) return null;
            const procName = xValues[ctx.dataIndex];
            const prodName = ctx.dataset.label;
            const tracker = dateTrackerProduk[prodName]?.[procName];
            
            return [
              `Produk: ${prodName}`,
              `${v.toFixed(1)} menit`,
              `${(v / 60).toFixed(1)} jam`,
              `${(v / 1440).toFixed(1)} hari`,
              `Tgl Pertama: ${tracker?.first?.formatted || '-'} (${tracker?.first?.batch || '-'})`,
              `Tgl Terakhir: ${tracker?.last?.formatted || '-'} (${tracker?.last?.batch || '-'})`
            ];
          }
        }
      }
    },
    scales: { y: { beginAtZero: true } }
  };

  return (
    <div className="space-y-8">
      <div className="w-full bg-white p-4 rounded-lg border shadow-sm">
        <Line data={chart1Data} options={chart1Options} />
      </div>

      {produkKeys.length > 0 && (
        <div className="w-full bg-white p-4 rounded-lg border shadow-sm">
          <Line data={chart2Data} options={chart2Options} />
        </div>
      )}
    </div>
  );
}