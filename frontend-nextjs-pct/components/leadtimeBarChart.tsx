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
import annotationPlugin from 'chartjs-plugin-annotation';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels,
  annotationPlugin
);

const colorMap: Record<string, string> = {
  'biru': 'rgba(0, 174, 255, 0.1)',
  'hijau tua': 'rgba(0, 128, 0, 0.4)',
  'hijau muda': 'rgba(144, 238, 144, 0.4)',
  'kuning': 'rgba(255, 255, 0, 0.25)',
  'merah': 'rgba(255, 0, 0, 0.1)'
};

const processCols = [
  "CWO", "Potong Stock", "Preparasi", "Timbang", "Validasi 1", "Validasi 2", "Compounding",
  "Terima Sample", "Analisa Complete", "Release QC", "Tempel Label Rilis",
  "Filling", "Sample FG", "End Packaging", "Setor BR", "Setor RAP",
  "Terima BR", "Terima RAP", "QA Release", "Shipment"
];

// Mapping Proses ke Kolom Tanggal (Sesuai database)
const dateFieldMap: Record<string, string> = {
  "CWO": "tanggal_wo",
  "Potong Stock": "tanggal_potong_stock",
  "Preparasi": "tanggal_timbang",
  "Timbang": "tanggal_timbang",
  "Validasi 1": "tanggal_terima_val1",
  "Validasi 2": "tanggal_terima_val2",
  "Compounding": "tanggal_kirim_compounding",
  "Terima Sample": "tanggal_kirim_ke_qc",
  "Analisa Complete": "analisa_complete_date",
  "Release QC": "qc_release_date",
  "Tempel Label Rilis": "tempel_label_release_date",
  "Filling": "kirim_ke_filling",
  "Sample FG": "kirim_ke_sample_fg",
  "End Packaging": "kirim_ke_end_packaging",
  "Setor BR": "setor_br_date",
  "Setor RAP": "setor_rap_date",
  "Terima BR": "terima_br_date",
  "Terima RAP": "terima_rap_date",
  "QA Release": "qa_release_date",
  "Shipment": "shipment_received_at"
};

function formatDate(dateStr: string) {
  if (!dateStr || dateStr === "0001-01-01T00:00:00Z") return "Belum ada";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Belum ada";

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');

  return `${day}-${month}-${year} ${hour}:${min}:${sec}`;
}

interface ThresholdRange {
  color: string;
  max_value: number;
}

/**
 * Komponen Grafik "Leadtime Bar Chart" (Total per Batch dengan Threshold).
 * 
 * **Konsep Arsitektural:**
 * - **Threshold Plugin Annotation**: Menambahkan garis batas waktu (*threshold areas*) di latar belakang 
 *   grafik menggunakan `chartjs-plugin-annotation` untuk memberikan indikator visual "merah/hijau/kuning" 
 *   tanpa harus mewarnai bar-nya langsung.
 * - **Complex Tooltip Injection**: Merender data alasan (*reasons*) keterlambatan langsung ke dalam 
 *   label tooltip (hover state), meminimalkan ruang UI sambil tetap memberikan konteks mendalam (contextual drilling).
 */
export default function LeadtimeBarChart({ 
  leadtimeData, 
  thresholdRanges = [],
  startProcess = "", 
  endProcess = "" 
}: { 
  leadtimeData: any[]; 
  thresholdRanges?: ThresholdRange[];
  startProcess?: string; 
  endProcess?: string; 
}) {

  // Proses data sekaligus cari nilai maksimal untuk membatasi tinggi grafik
  const chartDataParsed = useMemo(() => {
    const labels: string[] = [];
    const dataDays: number[] = [];
    let maxDataValue = 0;

    leadtimeData.forEach(r => {
      labels.push(r.no_batch);
      const rangeMinutes = r.total_range || 0;
      const days = rangeMinutes / 60 / 24;
      dataDays.push(Number(days.toFixed(2)));
      
      if (days > maxDataValue) maxDataValue = days;
    });

    return { labels, dataDays, maxDataValue };
  }, [leadtimeData]);

  // Set batas tinggi Y-axis agar tidak tertarik ke 100 (minimal tinggi 5 hari)
  const yAxisMax = Math.max(chartDataParsed.maxDataValue * 1.3, 5);

  const annotations: any = {};
  let lastMax = 0;
  thresholdRanges.forEach((item, index) => {
    annotations[`threshold_${index}`] = {
      type: 'box',
      yMin: lastMax,
      yMax: item.max_value,
      backgroundColor: colorMap[item.color.toLowerCase()] ?? 'rgba(255, 0, 0, 0.05)',
      borderWidth: 0,
      drawTime: 'beforeDatasetsDraw'
    };
    lastMax = item.max_value;
  });

  const chartData = {
    labels: chartDataParsed.labels,
    datasets: [{
      label: `Leadtime Total (${startProcess} - ${endProcess})`,
      data: chartDataParsed.dataDays,
      backgroundColor: "rgba(54, 163, 235, 1)",
      borderColor: "rgba(54,162,235,1)",
      borderWidth: 1
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: `Leadtime Total dengan Area Threshold (Hari)` },
      annotation: { 
        annotations,
        clip: true // Memotong anotasi warna yang melewati batas yAxisMax
      },
      datalabels: {                            
        rotation: -90,
        display: (ctx: any) => ctx.chart.data.datasets[0].data.length <= 85,
        color: 'black',
        formatter: (v: any) => parseFloat(v) > 0 ? `${v} Hari` : ''
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const row = leadtimeData[ctx.dataIndex];
            if (!row) return null;

            const vHari = Number(ctx.raw);
            const vJam  = vHari * 24;
            const vMenit = vJam * 60;

            const startField = dateFieldMap[startProcess] || "";
            const endField   = dateFieldMap[endProcess] || "";

            const rawStart = row[startField];
            const rawEnd   = row[endField];

            const startDate = rawStart ? formatDate(rawStart) : "Belum ada";
            const endDate   = rawEnd   ? formatDate(rawEnd)   : "Belum selesai";

            // Mengambil Reason sesuai range
            let reasonLines: string[] = [];
            if (row.reasons && Array.isArray(row.reasons)) {
              const startIdx = processCols.indexOf(startProcess);
              const endIdx   = processCols.indexOf(endProcess);

              row.reasons.forEach((r: any) => {
                const procIdx = processCols.indexOf(r.process_name);
                if (procIdx >= startIdx && procIdx <= endIdx) {
                  reasonLines.push(`- ${r.process_name}: ${r.reason} (${r.nama || 'Unknown'})`);
                }
              });
            }

            const lines = [
              `${vHari.toFixed(2)} Hari`,
              `${vJam.toFixed(1)} Jam`,
              `${vMenit.toFixed(0)} Menit`,
              ``,
              `Awal (${startProcess}): ${startDate}`,
              `Akhir (${endProcess}): ${endDate}`,
            ];

            if (reasonLines.length > 0) {
              lines.push('', 'Reason:', ...reasonLines);
            } else {
              lines.push('', '(Tidak ada reason)');
            }

            return lines;
          }
        }
      }
    },
    scales: {
      y: { 
        beginAtZero: true, 
        title: { display: true, text: "Hari" },
        max: yAxisMax // Batas dinamis yang sudah dihitung
      },
      x: { title: { display: true, text: "Batch" } }
    }
  };

  return (
    <div className="w-full bg-white p-4 rounded-lg border shadow-sm h-[450px]">
      <Bar data={chartData} options={chartOptions} />
    </div>
  );
}