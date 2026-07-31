'use client';

import React, { useMemo } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
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

/**
 * Komponen Grafik "Group Bar Chart" (Total Keseluruhan & Perbandingan Kategori).
 * 
 * **Konsep Arsitektural:**
 * - **Client-Side Aggregation**: Melakukan proses komputasi beban menengah (rata-rata leadtime 
 *   per kategori) di browser menggunakan `useMemo`. Ini mengurangi beban agregasi di backend 
 *   (Go API) dan memungkinkan filter interaktif (startProcess - endProcess) tanpa request ulang.
 * - **Chart.js Wrapper**: Menggunakan `react-chartjs-2` untuk rendering.
 */
export default function GroupBarCharts({ leadtimeData, startProcess, endProcess }: { leadtimeData: any[], startProcess: string, endProcess: string }) {
  
  let startIdx = xValues.indexOf(startProcess);
  let endIdx = xValues.indexOf(endProcess);
  if (startIdx === -1 || endIdx === -1) { startIdx = 0; endIdx = xValues.length - 1; }
  if (startIdx > endIdx) [startIdx, endIdx] = [endIdx, startIdx];

  const { totalPharmaHari, totalHerbalHari, totalKeseluruhanHari, showPharma, showHerbal } = useMemo(() => {
    const pharmaData = leadtimeData.filter(r => r.kategori === 'Pharma');
    const herbalData = leadtimeData.filter(r => r.kategori === 'Herbal');

    const calcTotalHari = (data: any[]) => {
      if (data.length === 0) return 0;
      let sumAverages = 0;
      
      for (let i = startIdx; i <= endIdx; i++) {
        const col = processCols[i];
        const vals = data.map(r => r[col]).filter(v => v !== null && v > 0);
        if (vals.length > 0) {
          sumAverages += vals.reduce((a, b) => a + b, 0) / vals.length;
        }
      }
      return sumAverages / 1440; // Konversi dari menit ke hari
    };

    return {
      totalPharmaHari: calcTotalHari(pharmaData),
      totalHerbalHari: calcTotalHari(herbalData),
      totalKeseluruhanHari: calcTotalHari(leadtimeData),
      showPharma: pharmaData.length > 0,
      showHerbal: herbalData.length > 0
    };
  }, [leadtimeData, startIdx, endIdx]);

  // CHART 1: Rata-Rata Total Keseluruhan (1 Bar)
  const chart1Options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: "Rata-Rata Leadtime Total Kategori (Hari)" },
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
            return [
              `${hari.toFixed(2)} Hari`,
              `${(hari * 24).toFixed(1)} Jam`,
              `${(hari * 1440).toLocaleString('id-ID')} Menit`,
              '',
              `Range: ${startProcess} → ${endProcess}`
            ];
          }
        }
      }
    },
    scales: { y: { beginAtZero: true, title: { display: true, text: "Hari" } } }
  };

  // CHART 2: Perbandingan Pharma vs Herbal (Multi Bar)
  const labelsCompare = [];
  const dataCompare = [];
  const bgColors = [];
  const borderColors = [];

  if (showPharma) {
    labelsCompare.push('Pharma');
    dataCompare.push(totalPharmaHari);
    bgColors.push('rgba(0, 191, 255, 0.7)'); // Biru
    borderColors.push('rgba(0, 191, 255, 1)');
  }
  if (showHerbal) {
    labelsCompare.push('Herbal');
    dataCompare.push(totalHerbalHari);
    bgColors.push('rgba(255, 0, 85, 0.7)'); // Merah/Pink
    borderColors.push('rgba(255, 0, 85, 1)');
  }

  const chart2Options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: "Perbandingan Rata-Rata Total Leadtime (Hari)" },
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
            return [
              `${hari.toFixed(2)} Hari`,
              `${(hari * 24).toFixed(1)} Jam`,
              `${(hari * 1440).toLocaleString('id-ID')} Menit`,
              '',
              `Range: ${startProcess} → ${endProcess}`
            ];
          }
        }
      }
    },
    scales: { y: { beginAtZero: true, title: { display: true, text: "Hari" } } }
  };

  return (
    <div className="space-y-8">
      {/* Chart 1 */}
      <div className="w-full bg-white p-4 rounded-lg border shadow-sm h-[400px] mt-8">
        <Bar 
          data={{
            labels: ["Rata-Rata Keseluruhan"],
            datasets: [{
              label: "Total", data: [totalKeseluruhanHari],
              backgroundColor: "rgba(54, 162, 235, 0.8)", borderColor: "rgba(54, 162, 235, 1)", borderWidth: 1
            }]
          }} 
          options={chart1Options} 
        />
      </div>

      {/* Chart 2 */}
      {labelsCompare.length > 0 && (
        <div className="w-full bg-white p-4 rounded-lg border shadow-sm h-[400px]">
          <Bar 
            data={{
              labels: labelsCompare,
              datasets: [{
                label: "Total Leadtime", data: dataCompare,
                backgroundColor: bgColors, borderColor: borderColors, borderWidth: 1
              }]
            }} 
            options={chart2Options} 
          />
        </div>
      )}
    </div>
  );
}