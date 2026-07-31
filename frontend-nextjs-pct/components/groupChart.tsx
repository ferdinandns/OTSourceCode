'use client';

import React, { useMemo } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, ChartDataLabels);

const xValues = ["CWO","Potong Stock", "Preparasi", "Timbang","Validasi 1","Validasi 2","Compounding", "Terima Sample","Analisa Complete","Release QC", "Tempel Label Rilis", "Filling","Sample FG","End Packaging","Setor BR", "Setor RAP", "Terima BR", "Terima RAP", "QA Release","Shipment"];
const processCols = ["lead_cwo", "lead_potong_stock", "lead_preparasi", "lead_timbang", "lead_validasi1", "lead_validasi2", "lead_compounding", "lead_terima_sample", "lead_analisa_complete", "lead_release_qc", "lead_tempel_label_rilis", "lead_filling", "lead_sample_fg", "lead_end_packaging", "lead_setor_br", "lead_setor_rap", "lead_terima_br", "lead_terima_rap", "qa_release", "lead_shipment"];

/**
 * Komponen Grafik "Group Line Chart" (Detail per Proses).
 * 
 * **Konsep Arsitektural:**
 * - **Heavy Client Computation (Memoized)**: Menggunakan algoritma map/reduce 
 *   di dalam `useMemo` untuk memecah `leadtimeData` menjadi array sum dan count 
 *   per proses. Pola ini sengaja meniru (mirror) logika agregasi dari Laravel versi lama,
 *   namun dipindahkan ke *Client Component* Next.js agar backend Go murni menyajikan data mentah (raw data).
 */
export default function GroupCharts({ leadtimeData, startProcess, endProcess }: { leadtimeData: any[], startProcess: string, endProcess: string }) {
  
  let startIdx = xValues.indexOf(startProcess);
  let endIdx = xValues.indexOf(endProcess);
  if (startIdx === -1 || endIdx === -1) { startIdx = 0; endIdx = xValues.length - 1; }
  if (startIdx > endIdx) [startIdx, endIdx] = [endIdx, startIdx];

  const { avgOverall, avgPharma, avgHerbal, dateTrackerOverall, dateTrackerCategory, showPharma, showHerbal } = useMemo(() => {
    const sumAll: Record<string, number> = {};
    const countAll: Record<string, number> = {};
    const sumCat: Record<string, Record<string, number>> = { 'Pharma': {}, 'Herbal': {} };
    const countCat: Record<string, Record<string, number>> = { 'Pharma': {}, 'Herbal': {} };

    const dateTrackerOverall: Record<string, { first: any, last: any }> = {};
    const dateTrackerCategory: Record<string, Record<string, { first: any, last: any }>> = { 'Pharma': {}, 'Herbal': {} };

    let hasPharma = false;
    let hasHerbal = false;

    leadtimeData.forEach(row => {
      const cat = row.kategori;
      if (cat === 'Pharma') hasPharma = true;
      if (cat === 'Herbal') hasHerbal = true;

      xValues.forEach((procName, idx) => {
        const colName = processCols[idx];
        const val = row[colName];

        // Hitung rata-rata
        if (val && val > 0) {
          sumAll[colName] = (sumAll[colName] || 0) + val;
          countAll[colName] = (countAll[colName] || 0) + 1;

          if (cat === 'Pharma' || cat === 'Herbal') {
            sumCat[cat][colName] = (sumCat[cat][colName] || 0) + val;
            countCat[cat][colName] = (countCat[cat][colName] || 0) + 1;
          }
        }

        // Lacak Tanggal Pertama & Terakhir
        // const dateField = dateFieldMap[idx];
        // const rawDate = row[dateField];
        // if (rawDate && !rawDate.startsWith("0001-01-01")) {
        //   const dateObj = new Date(rawDate);
        //   const formatted = formatDate(rawDate);
        //   const batchInfo = { raw: dateObj, formatted, batch: row.no_batch };

        //   if (!dateTrackerOverall[procName]) {
        //     dateTrackerOverall[procName] = { first: batchInfo, last: batchInfo };
        //   } else {
        //     if (dateObj < dateTrackerOverall[procName].first.raw) dateTrackerOverall[procName].first = batchInfo;
        //     if (dateObj > dateTrackerOverall[procName].last.raw) dateTrackerOverall[procName].last = batchInfo;
        //   }

        //   if (cat === 'Pharma' || cat === 'Herbal') {
        //     if (!dateTrackerCategory[cat][procName]) {
        //       dateTrackerCategory[cat][procName] = { first: batchInfo, last: batchInfo };
        //     } else {
        //       if (dateObj < dateTrackerCategory[cat][procName].first.raw) dateTrackerCategory[cat][procName].first = batchInfo;
        //       if (dateObj > dateTrackerCategory[cat][procName].last.raw) dateTrackerCategory[cat][procName].last = batchInfo;
        //     }
        //   }
        // }
      });
    });

    const avgOverall = processCols.map(col => countAll[col] ? (sumAll[col] / countAll[col]) : null);
    const avgPharma = processCols.map(col => countCat['Pharma'][col] ? (sumCat['Pharma'][col] / countCat['Pharma'][col]) : null);
    const avgHerbal = processCols.map(col => countCat['Herbal'][col] ? (sumCat['Herbal'][col] / countCat['Herbal'][col]) : null);

    return { avgOverall, avgPharma, avgHerbal, dateTrackerOverall, dateTrackerCategory, showPharma: hasPharma, showHerbal: hasHerbal };
  }, [leadtimeData]);

  // Chart Konfigurasi (Sama dengan logika grafik sebelumnya)
  const commonDataLabels = {
    anchor: 'end' as const, align: 'top' as const, color: 'black', font: { weight: 'bold' as const },
    formatter: (v: any) => {
      const val = Number(v);
      if (!val || val <= 0) return '';
      if (val >= 1440) return `${(val / 1440).toFixed(1)} days`;
      if (val <= 60) return `${val.toFixed(1)} min`;
      return `${(val / 60).toFixed(1)}\nhours`;
    }
  };

  const chart1Data = {
    labels: xValues,
    datasets: [{
      label: "Rata-rata Keseluruhan",
      data: avgOverall.map((val, idx) => (idx < startIdx || idx > endIdx) ? null : val),
      borderColor: 'rgba(75, 192, 192, 1)', backgroundColor: 'transparent', borderWidth: 2, fill: false, tension: 0.3
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
      title: { display: true, text: "Leadtime Detail per Proses (Rata-rata Keseluruhan Kategori)" },
      datalabels: commonDataLabels,
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
              `Keseluruhan:`,
              `${v.toFixed(1)} menit`,
              `${(v / 60).toFixed(1)} jam`,
              `${(v / 1440).toFixed(1)} hari`,
            //   `Tgl Pertama: ${tracker?.first?.formatted || '-'} (${tracker?.first?.batch || '-'})`,
            //   `Tgl Terakhir: ${tracker?.last?.formatted || '-'} (${tracker?.last?.batch || '-'})`
            ];
          }
        }
      }
    },
    scales: { y: { beginAtZero: true, title: { display: true, text: "Menit" } }, x: { title: { display: true, text: "Proses" } } }
  };

  const chart2Data = {
    labels: xValues,
    datasets: [
      showPharma && { label: 'Pharma', data: avgPharma.map((val, idx) => (idx < startIdx || idx > endIdx) ? null : val), borderColor: '#00bfff', backgroundColor: 'transparent', borderWidth: 2, fill: false, tension: 0.3 },
      showHerbal && { label: 'Herbal', data: avgHerbal.map((val, idx) => (idx < startIdx || idx > endIdx) ? null : val), borderColor: '#ff0055', backgroundColor: 'transparent', borderWidth: 2, fill: false, tension: 0.3 }
    ].filter(Boolean) as any[]
  };

  const chart2Options = {
    responsive: true,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: { position: 'bottom' as const },
      title: { display: true, text: "Perbandingan Leadtime per Proses (Pharma vs Herbal)" },
      datalabels: commonDataLabels,
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (ctx: any) => {
            const v = Number(ctx.raw);
            if (!v || v <= 0) return null;
            const procName = xValues[ctx.dataIndex];
            const catName = ctx.dataset.label;
            const tracker = dateTrackerCategory[catName]?.[procName];
            return [
              `Kategori: ${catName}`,
              `${v.toFixed(1)} menit`,
              `${(v / 60).toFixed(1)} jam`,
              `${(v / 1440).toFixed(1)} hari`,
            //   `Tgl Pertama: ${tracker?.first?.formatted || '-'} (${tracker?.first?.batch || '-'})`,
            //   `Tgl Terakhir: ${tracker?.last?.formatted || '-'} (${tracker?.last?.batch || '-'})`
            ];
          }
        }
      }
    },
    scales: { y: { beginAtZero: true, title: { display: true, text: "Menit" } }, x: { title: { display: true, text: "Proses" } } }
  };

  return (
    <div className="space-y-8">
      <div className="w-full bg-white p-4 rounded-lg border shadow-sm">
        <Line data={chart1Data} options={chart1Options} />
      </div>

      {(showPharma || showHerbal) && (
        <div className="w-full bg-white p-4 rounded-lg border shadow-sm">
          <Line data={chart2Data} options={chart2Options} />
        </div>
      )}
    </div>
  );
}