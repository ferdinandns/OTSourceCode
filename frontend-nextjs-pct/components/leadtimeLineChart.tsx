'use client';

import React from 'react';
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

// Register elemen yang dibutuhkan Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels,
  annotationPlugin
);

const xValues = [
  "CWO", "Potong Stock", "Preparasi", "Timbang", "Validasi 1", "Validasi 2", "Compounding",
  "Terima Sample", "Analisa Complete", "Release QC", "Tempel Label Rilis",
  "Filling", "Sample FG", "End Packaging", "Setor BR", "Setor RAP",
  "Terima BR", "Terima RAP", "QA Release", "Shipment"
];

const processCols: Record<string, string> = {
  "CWO": "lead_cwo", "Potong Stock": "lead_potong_stock", "Preparasi": "lead_preparasi",
  "Timbang": "lead_timbang", "Validasi 1": "lead_validasi1", "Validasi 2": "lead_validasi2",
  "Compounding": "lead_compounding", "Terima Sample": "lead_terima_sample",
  "Analisa Complete": "lead_analisa_complete", "Release QC": "lead_release_qc",
  "Tempel Label Rilis": "lead_tempel_label_rilis", "Filling": "lead_filling",
  "Sample FG": "lead_sample_fg", "End Packaging": "lead_end_packaging",
  "Setor BR": "lead_setor_br", "Setor RAP": "lead_setor_rap",
  "Terima BR": "lead_terima_br", "Terima RAP": "lead_terima_rap",
  "QA Release": "qa_release", "Shipment": "lead_shipment"
};

// Kolom tanggal per proses, urutannya SAMA dengan xValues (dipakai untuk lookup tanggal per batch)
const dateFieldMap = [
  "tanggal_wo", "tanggal_potong_stock", "tanggal_timbang", "tanggal_timbang", "tanggal_terima_val1", "tanggal_terima_val2", "tanggal_kirim_compounding",
  "tanggal_kirim_ke_qc", "analisa_complete_date", "qc_release_date", "tempel_label_release_date",
  "kirim_ke_filling", "kirim_ke_sample_fg", "kirim_ke_end_packaging", "setor_br_date", "setor_rap_date",
  "terima_br_date", "terima_rap_date", "qa_release_date", "shipment_received_at"
];

const colors = [
  'rgba(255, 99, 132, 0.8)', 'rgba(54, 162, 235, 0.8)', 'rgba(255, 206, 86, 0.8)',
  'rgba(75, 192, 192, 0.8)', 'rgba(153, 102, 255, 0.8)', 'rgba(255, 159, 64, 0.8)'
];

function formatDate(dateStr: string) {
  if (!dateStr || dateStr.startsWith("0001-01-01")) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Komponen Grafik "Leadtime Line Chart" (Pergerakan Waktu Tiap Batch).
 * 
 * **Konsep Arsitektural:**
 * - **Multi-Dataset Mapping**: Komponen ini memecah sekumpulan data JSON dari backend 
 *   menjadi array *datasets* terpisah (satu *dataset/garis* untuk tiap batch).
 * - **Dynamic Data Clipping**: Menggunakan nilai `startIdx` dan `endIdx` untuk mengubah 
 *   elemen array di luar *range* menjadi `null`. `chart.js` akan mengerti bahwa nilai `null` 
 *   berarti garis harus putus/disembunyikan pada area tersebut, mempermudah fitur *zoom/filter* rentang proses.
 */
export default function LeadtimeLineChart({ 
  leadtimeData, 
  startProcess = "CWO", 
  endProcess = "Shipment" 
}: { 
  leadtimeData: any[]; 
  startProcess?: string; 
  endProcess?: string; 
}) {

  let startIdx = xValues.indexOf(startProcess);
  let endIdx = xValues.indexOf(endProcess);
  
  if (startIdx === -1 || endIdx === -1) {
      startIdx = 0; endIdx = xValues.length - 1;
  }
  if (startIdx > endIdx) [startIdx, endIdx] = [endIdx, startIdx];

  const datasets = leadtimeData.map((row, i) => {
    return {
      label: row.no_batch,
      data: xValues.map((process, idx) => {
        if (idx < startIdx || idx > endIdx) return null; 
        return row[processCols[process]] ?? null;
      }),
      borderColor: colors[i % colors.length],
      backgroundColor: 'transparent',
      borderWidth: 2,
      tension: 0.3,
      fill: false,
    };
  });

  const chartData = {
    labels: xValues,
    datasets: datasets,
  };

  const chartOptions = {
    responsive: true,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: { position: 'bottom' as const },
      title: { display: true, text: "Leadtime Detail per Proses" },
      datalabels: {
        anchor: 'end' as const, 
        align: 'top' as const, 
        color: 'black', 
        font: { weight: 'bold' as const },
        display: true,
        formatter: (v: any) => {
          // Pastikan nilainya diubah jadi Number agar kondisi >= 1440 jalan
          const val = Number(v);
          if (!val || val <= 0) return '';
          
          if (val >= 1440) return `${(val / 1440).toFixed(1)} days`;
          if (val <= 60) return `${val.toFixed(1)} min`;
          
          return `${(val / 60).toFixed(1)}\nhours`;
        }
      },
      // Custom Tooltip saat di-hover, sekarang menyertakan tanggal
      // per batch sesuai step (proses) yang sedang di-hover.
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (ctx: any) => {
            const val = Number(ctx.raw);
            if (!val || val <= 0) return null;

            const batch = ctx.dataset.label; // Nomor batch (label dataset)
            const row = leadtimeData[ctx.datasetIndex];
            const dateField = dateFieldMap[ctx.dataIndex];
            const rawDate = row?.[dateField];
            const formatted = formatDate(rawDate);

            const lines = [
              `${batch}:`,
              `${val.toLocaleString('id-ID')} menit`,
              `${(val / 60).toFixed(1)} jam`,
              `${(val / 1440).toFixed(1)} hari`,
            ];
            if (formatted) lines.push(`Tanggal: ${formatted}`);

            return lines;
          }
        }
      }
    },
    scales: {
      y: { beginAtZero: true, title: { display: true, text: "Menit" } },
      x: { title: { display: true, text: "Proses" } }
    }
  };

  return (
    <div className="w-full bg-white p-4 rounded-lg border shadow-sm">
      <Line data={chartData} options={chartOptions} />
    </div>
  );
}