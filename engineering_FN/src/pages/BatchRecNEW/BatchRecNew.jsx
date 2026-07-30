import React, { useState, useEffect } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import GranulationChart from './GranulationChart';

const GranulationReport = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({
        line: '', // Kosongkan
        machine: '', // Kosongkan
        startDate: '',
        endDate: '',
    }); 
        
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(100);
    const [totalRows, setTotalRows] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    // 1. Fungsi Ambil Data (SINKRON DENGAN TOMBOL CARI)
    // Ganti fungsi fetchData kamu dengan ini
    const fetchData = async () => {
    const currentFilters = filters; 

    if (!currentFilters.line || !currentFilters.machine || !currentFilters.startDate || !currentFilters.endDate) {
        alert("Harap pilih Line, Unit Mesin, serta rentang Tanggal!");
        return;
    }

    setLoading(true);
    try {
        // --- REQUEST 1: UNTUK TABEL (Dibatasi Limit & Page) ---
        const responseTable = await axios.get('http://localhost:8002/part/granulation-batch-record', { 
            params: { 
                ...currentFilters,
                page: page,
                limit: limit 
            } 
        });

        // --- REQUEST 2: UNTUK GRAFIK (Ambil Semua Data) ---
        // Kita kirim limit yang sangat besar (misal 50.000) agar semua tgl terbaca
        const responseChart = await axios.get('http://localhost:8002/part/granulation-batch-record', { 
            params: { 
                ...currentFilters,
                page: 1, 
                limit: 50000 
            } 
        });

        const rawDataTable = responseTable.data.data || [];
        const rawDataChart = responseChart.data.data || [];

        if (rawDataTable.length === 0) {
            alert("Data tidak ditemukan untuk rentang waktu tersebut!");
            setData([]);
            setChartData([]); // Reset chart juga
            setTotalRows(0);
            setTotalPages(0);
            return;
        }

        // --- FILTERING DATA (Buang ID agar bersih) ---
        const filteredTable = rawDataTable.map(({ id, ID, timestamp, ...rest }) => ({ ...rest }));
        const filteredChart = rawDataChart.map(({ id, ID, timestamp, ...rest }) => ({ ...rest }));

        // --- SET KE MASING-MASING STATE ---
        setData(filteredTable);      // Untuk Tabel (Isinya cuma 100 baris)
        setChartData(filteredChart); // Untuk Grafik (Isinya ribuan baris, Full tgl 22-24)
        
        setTotalRows(responseTable.data.totalRows || 0);
        setTotalPages(responseTable.data.totalPages || 0);

    } catch (err) {
        alert(`Gagal menarik data: ${err.response?.data?.error || err.message}`);
    } finally {
        setLoading(false);
    }
};

    useEffect(() => {
        if (filters.startDate && filters.endDate) {
            fetchData();
        }
    }, [page, limit]);

    // 2. Fungsi Export PDF (Dinamis & WIB Paling Kiri)
  const handleExportPDF = async () => {
    try {
        setLoading(true);

        const formattedStart = filters.startDate ? filters.startDate.replace('T', ' ') : '';
        const formattedEnd = filters.endDate ? filters.endDate.replace('T', ' ') : '';

        // 1. Ambil data full dari backend untuk tabel
        const response = await axios.get('http://localhost:8002/part/export-pdf', { params: filters });
        const fullData = response.data;
        
        if (!fullData || fullData.length === 0) {
            setLoading(false);
            return alert("Data tidak ditemukan untuk periode ini.");
        }

        // Delay 2 detik agar Recharts di kontainer tersembunyi selesai render animasi
        await new Promise(resolve => setTimeout(resolve, 2000));

        const doc = new jsPDF('l', 'mm', 'a4');
        const pdfWidth = doc.internal.pageSize.getWidth();
        const pdfHeightLimit = doc.internal.pageSize.getHeight() - 20; // Margin bawah

        // --- HALAMAN 1: OVERLAY MODE (Judul + Grafik Gabungan) ---
        const overlayElement = document.getElementById('pdf-section-overlay');
        if (overlayElement) {
            const canvasOverlay = await html2canvas(overlayElement, { 
                scale: 2, 
                useCORS: true, 
                windowWidth: 2000 
            });
            const imgOverlay = canvasOverlay.toDataURL('image/png');
            const imgProps = doc.getImageProperties(imgOverlay);
            const overlayHeight = (imgProps.height * (pdfWidth - 20)) / imgProps.width;
            
            doc.addImage(imgOverlay, 'PNG', 10, 10, pdfWidth - 20, overlayHeight);
        }

        // --- HALAMAN 2 & SETERUSNYA: SPLIT MODE (Per Parameter) ---
        // Kita ambil elemen individual yang sudah diberi class 'split-chart-item'
        const splitSection = document.getElementById('pdf-section-split');
        //const splitCharts = document.querySelectorAll('.split-chart-item');
        if (splitSection) {
            const splitCharts = splitSection.querySelectorAll('.split-chart-item');
        if (splitCharts.length > 0) {
            doc.addPage();
            doc.setFontSize(16);
            doc.setTextColor(41, 128, 185);
            doc.text("2. MULTI-PARAMETER ANALYSIS (SPLIT MODE)", 10, 15);

            let currentY = 25; // Mulai di bawah judul

            for (let i = 0; i < splitCharts.length; i++) {
                const chartCanvas = await html2canvas(splitCharts[i], { scale: 2, useCORS: true });
                const chartImg = chartCanvas.toDataURL('image/png');
                const imgProps = doc.getImageProperties(chartImg);
                const chartPdfHeight = (imgProps.height * (pdfWidth - 20)) / imgProps.width;

                // Cek: Apakah grafik ini muat di sisa halaman? Kalau enggak, ganti halaman.
                if (currentY + chartPdfHeight > pdfHeightLimit) {
                    doc.addPage();
                    currentY = 15; // Reset posisi Y ke atas halaman baru
                }

                doc.addImage(chartImg, 'PNG', 10, currentY, pdfWidth - 20, chartPdfHeight);
                currentY += chartPdfHeight + 10; // Jarak antar grafik 10mm
            }
        }
    }

        // --- HALAMAN TERAKHIR: DETAILED HISTORY LOG (TABEL) ---
        doc.addPage();
        doc.setFontSize(14);
        doc.setTextColor(41, 128, 185);
        doc.text("3. DETAILED HISTORY LOG", 14, 15);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Machine: ${filters.machine?.toUpperCase()} | Periode: ${formattedStart} - ${formattedEnd}`, 14, 22);

        // Mapping Data: Buang kolom yang tidak perlu ditampilkan di tabel PDF
        const cleanData = fullData.map(({ id, timestamp, wib_time, ID, Batch_ID, Process_ID, ...rest }) => ({
            "WIB TIME": wib_time ? wib_time.replace('T', ' ') : '',
            ...rest
        }));

        // Ambil Header Tabel (Otomatis dari keys data)
        const tableColumn = Object.keys(cleanData[0]).map(key => key.replace(/_/g, ' ').toUpperCase());
        const tableRows = cleanData.map(item => Object.values(item));

        // Generate Tabel dengan AutoTable
        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 28,
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [41, 128, 185], halign: 'center' },
            alternateRowStyles: { fillColor: [245, 247, 250] },
            margin: { left: 10, right: 10 },
            didDrawPage: (data) => {
                // Tambahkan nomor halaman di pojok kanan bawah jika mau
                const str = "Halaman " + doc.internal.getNumberOfPages();
                doc.setFontSize(8);
                doc.text(str, pdfWidth - 25, doc.internal.pageSize.getHeight() - 10);
            }
        });

        // Simpan File
        doc.save(`Report_${filters.machine}.pdf`);

    } catch (err) {
        console.error("Export Error:", err);
        alert("Gagal Export PDF: " + err.message);
    } finally {
        setLoading(false);
    }
};

    // 3. Fungsi Export Excel (Dinamis & WIB Paling Kiri)
    const handleExportExcel = async () => {
    try {
        setLoading(true);
        
        // 1. Gunakan chartData karena ini isinya FULL (tgl 22-24), bukan data pagination
        if (!chartData || chartData.length === 0) {
            alert("Gagal Export: Silakan klik 'CARI DATA' terlebih dahulu!");
            return;
        }

        // 2. Mapping data: WIB TIME paling kiri, buang ID & timestamp agar rapi di Excel
        const cleanData = chartData.map(({ id, ID, timestamp, wib_time, ...rest }) => ({
            "WIB TIME": wib_time,
            ...rest
        }));

        // 3. Proses pembuatan file Excel
        const ws = XLSX.utils.json_to_sheet(cleanData);
        
        // Atur lebar kolom sedikit supaya WIB TIME tidak terpotong (opsional)
        const wscols = [{ wch: 25 }]; 
        ws['!cols'] = wscols;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Full Batch Record");
        
        // Nama file dinamis sesuai mesin dan waktu download
        const fileName = `Full_Report_${filters.machine}_${new Date().getTime()}.xlsx`;
        XLSX.writeFile(wb, fileName);

    } catch (err) { 
        console.error(err);
        alert("Gagal Excel: " + err.message); 
    } finally { 
        setLoading(false); 
    }
};

const [graphMode, setGraphMode] = useState('overlay'); // 'overlay' atau 'split'

// Di komponen utama kamu
const [viewMode, setViewMode] = useState('table'); // default: table

// Fungsi untuk pindah ke grafik
const handleShowChart = () => setViewMode('chart');

// Fungsi untuk balik ke log
const handleShowLog = () => setViewMode('table');

const [chartData, setChartData] = useState([]); // Untuk grafik utuh
         // Tetap untuk tabel (pagination)
    // Deteksi kolom untuk tabel UI
    const columns = data.length > 0 ? Object.keys(data[0]) : [];

   return (
    <div className="p-6 bg-[#f8fafd] dark:bg-[#0f111a] min-h-screen font-sans transition-colors duration-300">
        {/* Card Filter */}
        <div className="bg-white dark:bg-[#161b22] p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-2 uppercase">Line</label>
                    <select className="w-full border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-gray-50 dark:bg-[#0d1117] text-sm font-semibold dark:text-white"
                        value={filters.line}
                        onChange={(e) => {
                            const newLine = e.target.value;
                            const newMachine = (newLine === "Line 1" && filters.machine === "PMA kW Meter") ? "" : filters.machine;
                            setFilters({ ...filters, line: newLine, machine: newMachine });
                        }}
                    >
                        <option value="">-- Pilih Line --</option>
                        <option value="Line 1">Line 1</option>
                        <option value="Line 3">Line 3</option>
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-2 uppercase">Unit Mesin</label>
                    <select
                        className="w-full border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-gray-50 dark:bg-[#0d1117] text-sm font-semibold dark:text-white transition-all"
                        value={filters.machine}
                        onChange={(e) => setFilters({ ...filters, machine: e.target.value })}
                    >
                        <option value="">-- Pilih Mesin --</option>
                        <option value="PMA">PMA</option>
                        <option value="FBD">FBD</option>
                        <option value="Wetmill">Wetmill</option>
                        <option value="EPH">EPH</option>
                        {filters.line === "Line 3" && (
                            <option value="PMA kW Meter">PMA kW Meter</option>
                        )}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-2 uppercase">Mulai</label>
                    <input type="datetime-local" className="w-full border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-gray-50 dark:bg-[#0d1117] text-sm dark:text-white"
                        value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 mb-2 uppercase">Selesai</label>
                    <input type="datetime-local" className="w-full border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-gray-50 dark:bg-[#0d1117] text-sm dark:text-white"
                        value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
                </div>
                <button onClick={() => { setPage(1); setViewMode('table'); fetchData(); }} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg shadow-md transition-transform active:scale-95">
                    {loading ? 'LOADING...' : 'CARI DATA'}
                </button>
            </div>
        </div>

        {/* Header Section (Total & Navigation) */}
        <div className="bg-white dark:bg-[#161b22] rounded-t-2xl shadow-sm border-x border-t border-gray-100 dark:border-gray-800 transition-colors">
            <div className="flex justify-between p-4 bg-gray-50/50 dark:bg-[#1c2128] border-b dark:border-gray-800 items-center text-gray-900 dark:text-white">
                <div className="flex items-center gap-4">
                    {viewMode === 'table' && (
                        <select value={limit} onChange={(e) => { setLimit(parseInt(e.target.value)); setPage(1); }} className="border dark:border-gray-700 rounded px-2 py-1 text-sm dark:bg-[#0d1117] dark:text-white">
                            <option value="100">100</option>
                            <option value="500">500</option>
                            <option value="1000">1000</option>
                        </select>
                    )}
                    <div className="text-sm dark:text-gray-400">Total: <b className="text-blue-600">{totalRows}</b> Baris</div>
                   {viewMode === 'chart' && (
                <div className="flex bg-gray-200 dark:bg-gray-800 p-1 rounded-lg ml-2">
                    <button 
                        onClick={() => setGraphMode('overlay')}
                        className={`px-3 py-1 text-[10px] uppercase rounded-md transition-all ${graphMode === 'overlay' ? 'bg-white dark:bg-gray-700 shadow-sm font-bold text-blue-600' : 'text-gray-500'}`}
                    >
                        Overlay
                    </button>
                    <button 
                        onClick={() => setGraphMode('split')}
                        className={`px-3 py-1 text-[10px] uppercase rounded-md transition-all ${graphMode === 'split' ? 'bg-white dark:bg-gray-700 shadow-sm font-bold text-blue-600' : 'text-gray-500'}`}
                    >
                        Split
                    </button>
                </div>
            )}
        </div>
                <div className="flex gap-2 text-white">
                    {viewMode === 'table' ? (
                        <button onClick={() => setViewMode('chart')} className="p-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all flex items-center gap-2 shadow-sm active:scale-95">
                            <i className="fas fa-chart-line text-xs"></i>
                            <span className="text-[10px] font-bold uppercase">Analytics</span>
                        </button>
                    ) : (
                        <button onClick={() => setViewMode('table')} className="p-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all flex items-center gap-2 shadow-sm active:scale-95">
                            <i className="fas fa-list text-xs"></i>
                            <span className="text-[10px] font-bold uppercase">History Log</span>
                        </button>
                    )}
                    <button onClick={handleExportExcel} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-[10px] font-bold shadow-sm active:scale-95 transition-all">📊 EXCEL (LOG ONLY)</button>
                    <button onClick={handleExportPDF} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-[10px] font-bold shadow-sm active:scale-95 transition-all">📄 PDF (LOG + GRAPHICS)</button>
                </div>
            </div>
        </div>

        {/* Main Content Area (Table or Chart) */}
        <div className="bg-white dark:bg-[#161b22] rounded-b-2xl shadow-sm border-x border-b border-gray-100 dark:border-gray-800 overflow-hidden transition-colors">
            {viewMode === 'table' ? (
                <div className="animate-fade-in">
                    <div className="overflow-x-auto max-h-[500px]">
                        <table className="w-full text-left">
                            <thead className="bg-gray-100 dark:bg-[#1c2128] sticky top-0 transition-colors">
                                <tr>
                                    {columns.map(col => (
                                        <th key={col} className="p-4 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase border-b dark:border-gray-700">{col.replace(/_/g, ' ')}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="text-xs dark:text-gray-300">
                                {data.length > 0 ? (
                                    data.map((row, i) => (
                                        <tr key={i} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 border-b dark:border-gray-800 transition-colors">
                                            {columns.map(col => (
                                                <td key={col} className="p-4 whitespace-nowrap border-b dark:border-gray-800">
                                                    {typeof row[col] === 'number' ? row[col].toFixed(2) : row[col]}
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={columns.length || 5} className="p-10 text-center text-gray-400 dark:text-gray-500 italic bg-white dark:bg-[#161b22]">
                                            Data tidak ditemukan atau silakan klik "CARI DATA"
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-[#1c2128] border-t dark:border-gray-800">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                            Halaman <b className="text-blue-600">{page}</b> dari <b>{totalPages}</b>
                        </div>
                        <div className="flex gap-1">
                            <button onClick={() => setPage(1)} disabled={page === 1} className="px-3 py-1 bg-white dark:bg-[#0d1117] border dark:border-gray-700 rounded text-xs dark:text-white disabled:opacity-30">First</button>
                            <button onClick={() => setPage(prev => Math.max(prev - 1, 1))} disabled={page === 1} className="px-3 py-1 bg-white dark:bg-[#0d1117] border dark:border-gray-700 rounded text-xs dark:text-white disabled:opacity-30">Prev</button>
                            <span className="px-4 py-1 text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded">{page}</span>
                            <button onClick={() => setPage(prev => Math.min(prev + 1, totalPages))} disabled={page === totalPages} className="px-3 py-1 bg-white dark:bg-[#0d1117] border dark:border-gray-700 rounded text-xs dark:text-white disabled:opacity-30">Next</button>
                            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-3 py-1 bg-white dark:bg-[#0d1117] border dark:border-gray-700 rounded text-xs dark:text-white disabled:opacity-30">Last</button>
                        </div>
                    </div>
                </div>
            ) : (
                // --- TAMPILAN GRAFIK ---
               <div id="chart-to-export" className="bg-white p-4 rounded-lg">
        {/* PAKAI chartData, bukan data biasa */}
        <GranulationChart 
    data={chartData} 
    machine={filters.machine} 
    mode={graphMode} // Ini artinya: ambil isi dari variabel graphMode (bisa 'overlay' atau 'split')
/>
        
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100">
            <p className="text-[10px] text-blue-600 font-semibold uppercase">
                💡 Grafik menampilkan {chartData.length} baris data (Full Range).
            </p>
        </div>
    </div>
)}
        </div>
      {/* Kontainer Tersembunyi Khusus Export PDF */}
<div style={{ 
    position: 'fixed', // Pakai fixed lebih aman dari absolute untuk elemen tersembunyi
    left: '-10000px', 
    top: '0', 
    height: '0', // Paksa tinggi pembungkus terluar jadi 0
    overflow: 'hidden', // Potong semua yang keluar dari tinggi 0
    pointerEvents: 'none' 
}}>
    <div 
        id="pdf-report-template" 
        style={{ 
            display: 'inline-block', // Agar lebar dan tinggi otomatis seukuran konten
            background: 'white',
            width: '1900px', // Lebar tetap di sini agar chart tidak ciut saat dipotret
        }}
    >
        {/* BAGIAN 1: HEADER & OVERLAY */}
        <div id="pdf-section-overlay" style={{ padding: '50px' }}>
            <h1 style={{ fontSize: '40px', fontWeight: 'bold', color: '#000', marginBottom: '10px' }}>
                BATCH RECORD REPORT: {filters.machine?.toUpperCase()}
            </h1>
            <p style={{ fontSize: '20px', color: '#4b5563', marginBottom: '40px' }}>
                Periode: {filters.startDate?.replace('T', ' ')} - {filters.endDate?.replace('T', ' ')}
            </p>

            <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: '30px' }}>
                <h2 style={{ fontSize: '28px', color: '#1e40af', fontWeight: 'bold', marginBottom: '20px' }}>
                    1. Trend Analysis (Overlay Mode)
                </h2>
                {/* Pastikan tingginya pas */}
                <div style={{ height: '800px', width: '100%' }}>
                    <GranulationChart data={chartData} machine={filters.machine} mode="overlay" />
                </div>
            </div>
        </div>

        {/* BAGIAN 2: SPLIT MODE */}
        <div id="pdf-section-split" style={{ padding: '50px' }}>
            <h2 style={{ fontSize: '28px', color: '#1e40af', fontWeight: 'bold', marginBottom: '30px' }}>
                2. Multi-Parameter Analysis (Split Mode)
            </h2>
            {/* JANGAN kasih height di sini Riz, biar dia otomatis berhenti di grafik terakhir */}
            <div style={{ width: '100%' }}>
                <GranulationChart data={chartData} machine={filters.machine} mode="split" />
            </div>
        </div>
    </div>
</div>
    </div>
    
);
};

export default GranulationReport;