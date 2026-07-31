// src/app/(dashboard)/raw-data/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import Cookies from "js-cookie";
import {
    Server, Search, RotateCcw, Download, FileSpreadsheet,
    ChevronDown, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown
} from "lucide-react";
import { API_BASE_URL, apiFetch } from "@/lib/api";
import * as XLSX from "xlsx";

interface TimestampData {
    id: number;
    no_batch: string;
    no_wo_ruah: string;
    no_wo_kemas: string;
    kode_produk: string;
    kode_ruah: string;
    ppic_cwo: string;
    wh_potong_stock: string;
    wh_timbang: string;
    wh_val1: string;
    prod_val2: string;
    prod_compounding: string;
    transfer_storage: string;
    qc_terima: string;
    qc_analisa: string;
    qc_release: string;
    scan_storage: string;
    prod_filling: string;
    qc_sample_fg: string;
    end_packaging: string;
    serah_terima_bpp: string;
    setor_br: string;
    setor_rap: string;
    terima_br: string;
    terima_rap: string;
    qa_release: string;
    shipment: string;
}

interface DurationData {
    id: number;
    no_batch: string;
    kode_produk: string;
    kode_ruah: string;
    kategori: string;
    cwo_potong: string;
    potong_prep: string;
    prep_timbang: string;
    timbang_val1: string;
    val1_val2: string;
    val2_comp: string;
    comp_qc: string;
    qc_analisa: string;
    analisa_release: string;
    release_scan: string;
    scan_filling: string;
    filling_sample: string;
    sample_endpack: string;
    endpack_setor_br: string;
    setor_br_rap: string;
    setor_rap_terima_br: string;
    terima_br_rap: string;
    terima_rap_qa: string;
    qa_shipment: string;
    total_menit: string;
    reasons: { process_name: string; reason: string }[];
}

type SortConfig = {
    key: string;
    direction: "asc" | "desc";
} | null;

/**
 * Halaman Raw Data (Laporan Tabel).
 * 
 * **Konsep Arsitektural:**
 * - **Server-side API Pagination**: Mengelola state `currentPage` di frontend dan mengirimkannya 
 *   sebagai parameter kueri ke API backend. Tabel tidak memuat seluruh data ke memori (*client-side pagination*), 
 *   melainkan memanfaatkan kapabilitas paginasi GORM di Golang.
 * - **Debounced Search**: Input pencarian (*Search*) dibatasi kecepatannya (debounce) menggunakan 
 *   `useEffect` timer. Ini mencegah pengiriman permintaan API beruntun yang dapat membebani server (DDoS-like behavior) 
 *   saat pengguna mengetik dengan cepat.
 */
export default function RawDataPage() {
    const [timestampData, setTimestampData] = useState<TimestampData[]>([]);
    const [durationData, setDurationData] = useState<DurationData[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Filter Tanggal Master
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [appliedStartDate, setAppliedStartDate] = useState("");
    const [appliedEndDate, setAppliedEndDate] = useState("");

    // STATE TABEL 1 (TIMESTAMP) 
    const [searchQuery1, setSearchQuery1] = useState("");
    const [entriesPerPage1, setEntriesPerPage1] = useState(10);
    const [currentPage1, setCurrentPage1] = useState(1);
    const [sortConfig1, setSortConfig1] = useState<SortConfig>(null);

    // STATE TABEL 2 (DURATION)
    const [searchQuery2, setSearchQuery2] = useState("");
    const [entriesPerPage2, setEntriesPerPage2] = useState(10);
    const [currentPage2, setCurrentPage2] = useState(1);
    const [sortConfig2, setSortConfig2] = useState<SortConfig>(null);

    // Dropdown Download
    const [isDownloadOpen, setIsDownloadOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const fetchRawData = async (start = "", end = "") => {
        setIsLoading(true);
        try {
            const token = Cookies.get("token"); 

            const requestOptions = {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            };

            // Setup URL (Satu Endpoint)
            let endpointUrl = `${API_BASE_URL}/api/v1/master/work-orders/`;
            if (start && end) {
                endpointUrl += `?start_date=${start}&end_date=${end}`;
            }

            const res = await apiFetch(endpointUrl, requestOptions);
            const json = await res.json();

            if (json.data) {
                const timestampsArray = json.data.timestamps || [];
                
                const mappedTimestamps: TimestampData[] = timestampsArray.map((item: any, index: number) => ({
                    id: item.id || index + 1,
                    no_batch: item.no_batch || "-",
                    no_wo_ruah: item.no_wo_ruah || "-",
                    no_wo_kemas: item.no_wo_kemas || "-",
                    kode_produk: item.kode_produk || "-",
                    kode_ruah: item.kode_ruah || "-",
                    ppic_cwo: formatDateTimeDisplay(item.tanggal_wo), 
                    wh_potong_stock: formatDateTimeDisplay(item.tanggal_potong_stock),
                    wh_timbang: formatDateTimeDisplay(item.tanggal_timbang),
                    wh_val1: formatDateTimeDisplay(item.tanggal_kirim_val1), 
                    prod_val2: formatDateTimeDisplay(item.tanggal_terima_val2),
                    prod_compounding: formatDateTimeDisplay(item.tanggal_kirim_compounding),
                    transfer_storage: formatDateTimeDisplay(item.tanggal_kirim_ke_qc), 
                    qc_terima: formatDateTimeDisplay(item.tanggal_qc_analisa), 
                    qc_analisa: formatDateTimeDisplay(item.analisa_complete_date),
                    qc_release: formatDateTimeDisplay(item.qc_release_date),
                    scan_storage: formatDateTimeDisplay(item.tempel_label_release_date), 
                    prod_filling: formatDateTimeDisplay(item.kirim_ke_filling),
                    qc_sample_fg: formatDateTimeDisplay(item.kirim_ke_sample_fg),
                    end_packaging: formatDateTimeDisplay(item.kirim_ke_end_packaging),
                    serah_terima_bpp: formatDateTimeDisplay(item.kirim_ke_serah_terima_bpp),
                    setor_br: formatDateTimeDisplay(item.setor_br_date),
                    setor_rap: formatDateTimeDisplay(item.setor_rap_date),
                    terima_br: formatDateTimeDisplay(item.terima_br_date),
                    terima_rap: formatDateTimeDisplay(item.terima_rap_date),
                    qa_release: formatDateTimeDisplay(item.qa_release_date),
                    shipment: formatDateTimeDisplay(item.shipment_received_at)
                }));
                setTimestampData(mappedTimestamps);

                const durationsArray = json.data.durations || [];

                const mappedDurations: DurationData[] = durationsArray.map((item: any, index: number) => ({
                    id: item.id || index + 1,
                    no_batch: item.no_batch || "-",
                    kode_produk: item.kode_produk || "-",
                    kode_ruah: item.kode_ruah || "-",
                    kategori: item.kategori || "-",
                    // Frontend helper akan otomatis mengonversi angka murni (menit) ke format DD-HH-MM-SS
                    cwo_potong: String(item.lead_cwo_potong || 0),
                    potong_prep: String( 0),
                    prep_timbang: String(item.lead_potong_timbang || 0), // Sesuaikan field DB
                    timbang_val1: String(item.lead_timbang_val1 || 0),
                    val1_val2: String(item.lead_val1_val2 || 0),
                    val2_comp: String(item.lead_val2_comp || 0),
                    comp_qc: String(item.lead_comp_qc || 0),
                    qc_analisa: String(item.lead_qc_analisa || 0),
                    analisa_release: String(item.lead_analisa_release || 0),
                    release_scan: String(item.lead_release_scan || 0),
                    scan_filling: String(item.lead_scan_filling || 0),
                    filling_sample: String(item.lead_filling_sample || 0),
                    sample_endpack: String(item.lead_sample_endpack || 0),
                    endpack_setor_br: String(item.lead_endpack_setor_br || 0),
                    setor_br_rap: String(item.lead_setor_br_rap || 0),
                    setor_rap_terima_br: String(item.lead_setor_rap_tr_br || 0),
                    terima_br_rap: String(item.lead_tr_br_rap || 0),
                    terima_rap_qa: String(item.lead_tr_rap_qa || 0),
                    qa_shipment: String(item.lead_qa_shipment || 0),
                    total_menit: String(item.total_leadtime || 0), 
                    reasons: item.reasons || [] 
                }));
                setDurationData(mappedDurations);
            }
        } catch (error) {
            console.error("Gagal mengambil data dari API:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Panggil saat komponen pertama kali di-mount
    useEffect(() => {
        fetchRawData();
    }, []);

    // Reset pagination saat pencarian/entri berubah
    useEffect(() => setCurrentPage1(1), [searchQuery1, entriesPerPage1, appliedStartDate, appliedEndDate]);
    useEffect(() => setCurrentPage2(1), [searchQuery2, entriesPerPage2, appliedStartDate, appliedEndDate]);

    // EXPORT HANDLERS

    // Export Timestamp Report
    const exportRawData = () => {
        const formattedData = timestampData.map(r => ({
            "No Batch": r.no_batch,
            "No WO Ruah": r.no_wo_ruah,
            "No WO Kemas": r.no_wo_kemas,
            "Kode Produk": r.kode_produk,
            "Kode Ruah": r.kode_ruah,
            "PPIC CWO": r.ppic_cwo,
            "Warehouse Potong Stock": r.wh_potong_stock,
            "Warehouse Timbang": r.wh_timbang,
            "Warehouse Validasi 1": r.wh_val1,
            "Produksi Validasi 2": r.prod_val2,
            "Compounding Mixing Tank": r.prod_compounding,
            "Transfer Storagetank": r.transfer_storage,
            "QC Terima Sample": r.qc_terima,
            "QC Analisa Complete": r.qc_analisa,
            "QC Release": r.qc_release,
            "Scan Barcode Storage": r.scan_storage,
            "Produksi Filling": r.prod_filling,
            "Sample FG": r.qc_sample_fg,
            "End Packaging": r.end_packaging,
            "Serah Terima BPP": r.serah_terima_bpp,
            "Setor BR": r.setor_br,
            "Setor RAP": r.setor_rap,
            "Terima BR": r.terima_br,
            "Terima RAP": r.terima_rap,
            "QA Release": r.qa_release,
            "Shipment Received": r.shipment
        }));

        const worksheet = XLSX.utils.json_to_sheet(formattedData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Timestamp Report");
        XLSX.writeFile(workbook, "rawdata-timestamp.xlsx");
    };

    // Export Duration Report (Digital)
    const exportRawDataDigital = () => {
        const formattedData = durationData.map(r => ({
            "No Batch": r.no_batch,
            "Kode Produk": r.kode_produk,
            "Kode Ruah": r.kode_ruah,
            "Kategori Produk": r.kategori,
            "CWO - Potong Stock": formatDurationDisplay(r.cwo_potong),
            "Potong Stock - Timbang": formatDurationDisplay(r.prep_timbang),
            "Timbang - Validasi 1": formatDurationDisplay(r.timbang_val1),
            "Validasi 1 - Validasi 2": formatDurationDisplay(r.val1_val2),
            "Validasi 2 - Compounding": formatDurationDisplay(r.val2_comp),
            "Compounding - QC": formatDurationDisplay(r.comp_qc),
            "QC - Analisa": formatDurationDisplay(r.qc_analisa),
            "Analisa - Complete": formatDurationDisplay(r.analisa_release),
            "Release QC - Tempel Label": formatDurationDisplay(r.release_scan),
            "Label - Filling": formatDurationDisplay(r.scan_filling), 
            "Filling - Sample FG": formatDurationDisplay(r.filling_sample),
            "Sample FG - End Packaging": formatDurationDisplay(r.sample_endpack),
            "End Packaging - Setor BR": formatDurationDisplay(r.endpack_setor_br),
            "Setor BR - Setor RAP": formatDurationDisplay(r.setor_br_rap),
            "Setor RAP - Terima BR": formatDurationDisplay(r.setor_rap_terima_br),
            "Terima BR - Terima RAP": formatDurationDisplay(r.terima_br_rap),
            "QA Release - Shipment": formatDurationDisplay(r.qa_shipment),
            "Total Leadtime": formatDurationDisplay(r.total_menit)
        }));

        const worksheet = XLSX.utils.json_to_sheet(formattedData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Duration Report");
        XLSX.writeFile(workbook, "rawdata-duration.xlsx");
    };

    // Export TPM Compounding Report
    const exportRawDataTPM = () => {
        // TPM membutuhkan kalkulasi spesifik antara Validasi 2 dan QC Release
        const formattedData = timestampData.map((ts, index) => {
            const dr = durationData[index]; // Ambil data durasi yang sejalan
            
            // Kalkulasi manual menit TPM (Validasi 2 ke QC Release)
            let tpmDuration = "-";
            if (ts.prod_val2 !== "-" && ts.qc_release !== "-") {
                const start = new Date(ts.prod_val2).getTime();
                const end = new Date(ts.qc_release).getTime();
                if (!isNaN(start) && !isNaN(end) && end >= start) {
                    const diffMins = (end - start) / 60000;
                    tpmDuration = formatDurationDisplay(String(diffMins));
                }
            }

            return {
                "No Batch": ts.no_batch,
                "Kode Produk": ts.kode_produk,
                "Kode Ruah": ts.kode_ruah,
                "Kategori Produk": dr?.kategori || "-",
                "Produksi Validasi 2": ts.prod_val2,
                "QC Release": ts.qc_release,
                "Lead Time Validasi 2 - QC Release": tpmDuration
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(formattedData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "TPM Compounding");
        XLSX.writeFile(workbook, "rawdata-tpm-compounding.xlsx");
    };

    // Format Helper untuk Mengubah ISO String ke YYYY-MM-DD HH:mm:ss
    const formatDateTimeDisplay = (isoString: string) => {
        if (!isoString || isoString === "-") return "-";
        
        try {
            const date = new Date(isoString);
            
            // Validasi jika string tanggal rusak/tidak valid
            if (isNaN(date.getTime())) return isoString;

            const pad = (n: number) => String(n).padStart(2, '0');

            const year = date.getFullYear();
            const month = pad(date.getMonth() + 1); // Bulan dimulai dari 0
            const day = pad(date.getDate());
            
            const hours = pad(date.getHours());
            const minutes = pad(date.getMinutes());
            const seconds = pad(date.getSeconds());

            // Menggabungkan menjadi format YYYY-MM-DD HH:mm:ss
            return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
        } catch (error) {
            return isoString;
        }
    };

    // Format Helper Waktu untuk Tabel Duration
    const formatDurationDisplay = (val: string) => {
        if (!val || val === "-" || val === "0") return "-";
        
        let d = 0, h = 0, m = 0, s = 0;

        // Coba konversi string ke angka desimal (float)
        const floatMins = parseFloat(val);

        if (!isNaN(floatMins)) {
            if (floatMins < 0) return "-";
            
            // Jika data adalah angka (dari Golang), ubah semua ke detik dulu agar akurat
            const totalSeconds = Math.round(floatMins * 60);

            d = Math.floor(totalSeconds / 86400); // 1 hari = 86400 detik
            let remainder = totalSeconds % 86400;

            h = Math.floor(remainder / 3600);     // 1 jam = 3600 detik
            remainder = remainder % 3600;

            m = Math.floor(remainder / 60);       // 1 menit = 60 detik
            s = remainder % 60;
        } else {
            // Fallback: Jika val kebetulan masih pakai format teks lama "Hari", "Jam"
            const dMatch = val.match(/(\d+)\s*Hari/i);
            const hMatch = val.match(/(\d+)\s*Jam/i);
            const mMatch = val.match(/(\d+)\s*Menit/i);
            const sMatch = val.match(/(\d+)\s*Detik/i);

            if (dMatch) d = parseInt(dMatch[1], 10);
            if (hMatch) h = parseInt(hMatch[1], 10);
            if (mMatch) m = parseInt(mMatch[1], 10);
            if (sMatch) s = parseInt(sMatch[1], 10);
        }

        const pad = (n: number) => String(n).padStart(2, '0');
        
        // Output dalam format DD:HH:MM:SS
        return `${pad(d)}:${pad(h)}:${pad(m)}:${pad(s)}`;
    };

    // FILTERING LOGIC
    const handleDateSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setAppliedStartDate(startDate);
        setAppliedEndDate(endDate);
        
        // Panggil fungsi fetch dengan parameter tanggal
        fetchRawData(startDate, endDate);
    };

    const handleResetFilters = () => {
        setStartDate(""); setEndDate("");
        setAppliedStartDate(""); setAppliedEndDate("");
        setSearchQuery1(""); setSearchQuery2("");
        
        // Panggil ulang fetch tanpa parameter (ambil semua data)
        fetchRawData();
    };

    // Sorting Helper
    const applySorting = (data: any[], config: SortConfig) => {
        return [...data].sort((a, b) => {
            if (!config) return 0;
            const { key, direction } = config;
            const aVal = String(a[key] || "");
            const bVal = String(b[key] || "");
            return direction === "asc"
                ? aVal.localeCompare(bVal, undefined, { numeric: true })
                : bVal.localeCompare(aVal, undefined, { numeric: true });
        });
    };

    // Pipeline Tabel 1 (Timestamp)
    const filteredData1 = timestampData.filter(item =>
        Object.values(item).some(val => String(val).toLowerCase().includes(searchQuery1.toLowerCase()))
    );
    const sortedData1 = applySorting(filteredData1, sortConfig1);
    const totalPages1 = Math.max(1, Math.ceil(sortedData1.length / entriesPerPage1));
    const startIndex1 = (currentPage1 - 1) * entriesPerPage1;
    const currentData1 = sortedData1.slice(startIndex1, startIndex1 + entriesPerPage1);

    // 4. Pipeline Tabel 2 (Duration)
    const filteredData2 = durationData.filter(item =>
        Object.values(item).some(val => String(val).toLowerCase().includes(searchQuery2.toLowerCase()))
    );
    const sortedData2 = applySorting(filteredData2, sortConfig2);
    const totalPages2 = Math.max(1, Math.ceil(sortedData2.length / entriesPerPage2));
    const startIndex2 = (currentPage2 - 1) * entriesPerPage2;
    const currentData2 = sortedData2.slice(startIndex2, startIndex2 + entriesPerPage2);

    // RENDERING HELPERS 
    const handleSort1 = (key: string) => {
        let direction: "asc" | "desc" = "asc";
        if (sortConfig1 && sortConfig1.key === key && sortConfig1.direction === "asc") direction = "desc";
        setSortConfig1({ key, direction });
    };

    const handleSort2 = (key: string) => {
        let direction: "asc" | "desc" = "asc";
        if (sortConfig2 && sortConfig2.key === key && sortConfig2.direction === "asc") direction = "desc";
        setSortConfig2({ key, direction });
    };

    const renderSortIcon = (key: string, config: SortConfig) => {
        if (config?.key !== key) return <ArrowUpDown size={14} className="text-gray-400" />;
        return config.direction === "asc" ? <ArrowUp size={14} className="text-gray-800" /> : <ArrowDown size={14} className="text-gray-800" />;
    };

    // Header Wrapper untuk Format Satu Kata Satu Baris (Kolom Waktu)
    const renderWrappedHeader = (label: string, sortKey: string, isTable1: boolean, isTimeColumn: boolean, extraClass = "") => {
        const handleSort = isTable1 ? handleSort1 : handleSort2;
        const config = isTable1 ? sortConfig1 : sortConfig2;

        return (
            <th
                key={sortKey}
                className={`px-3 py-2 border-r border-gray-200 cursor-pointer hover:bg-gray-200 align-middle ${extraClass}`}
                onClick={() => handleSort(sortKey)}
            >
                <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-semibold leading-snug ${isTimeColumn ? "whitespace-normal" : "whitespace-nowrap"}`}>
                        {label}
                    </span>
                    <div className="shrink-0">
                        {renderSortIcon(sortKey, config)}
                    </div>
                </div>
            </th>
        );
    };

    const getPaginationNumbers = (total: number, current: number) => {
        if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
        if (current <= 5) return [1, 2, 3, 4, 5, 6, 7, "...", total];
        if (current >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
        return [1, "...", current - 2, current - 1, current, current + 1, current + 2, "...", total];
    };

    // List Kolom Tabel 1
    const tsStandardCols = [
        { key: "no_wo_ruah", label: "No WO Ruah" }, { key: "no_wo_kemas", label: "No WO Kemas" }, { key: "kode_ruah", label: "Kode Ruah" }
    ];
    const tsTimeCols = [
        { key: "ppic_cwo", label: "PPIC CWO" }, { key: "wh_potong_stock", label: "WH Potong Stock" },
        { key: "wh_timbang", label: "WH Timbang" }, { key: "wh_val1", label: "WH (Validasi 1)" },
        { key: "prod_val2", label: "Prod (Validasi 2)" }, { key: "prod_compounding", label: "Prod Compounding" },
        { key: "transfer_storage", label: "Transfer Storage" }, { key: "qc_terima", label: "QC Terima Sample" },
        { key: "qc_analisa", label: "QC Analisa Complete" }, { key: "qc_release", label: "QC Release" },
        { key: "scan_storage", label: "Scan Barcode Storage" }, { key: "prod_filling", label: "Prod Filling" },
        { key: "qc_sample_fg", label: "QC Sample FG" }, { key: "end_packaging", label: "End Packaging" },
        { key: "serah_terima_bpp", label: "Serah Terima BPP" }, { key: "setor_br", label: "Setor BR" },
        { key: "setor_rap", label: "Setor RAP" }, { key: "terima_br", label: "Terima BR" },
        { key: "terima_rap", label: "Terima RAP" }, { key: "qa_release", label: "QA Release" },
        { key: "shipment", label: "Shipment" }
    ];

    // List Kolom Tabel 2
    const durStandardCols = [
        { key: "kode_ruah", label: "Kode Ruah" }, { key: "kategori", label: "Kategori Produk" }
    ];
    const durTimeCols = [
        { key: "cwo_potong", label: "PPIC CWO - WH Potong Stock" }, { key: "potong_prep", label: "WH Potong Stock - WH Prep" },
        { key: "prep_timbang", label: "WH Prep - WH Timbang" }, { key: "timbang_val1", label: "WH Timbang - WH (Val 1)" },
        { key: "val1_val2", label: "WH (Val 1) - Prod (Val 2)" }, { key: "val2_comp", label: "Prod (Val 2) - Prod Compounding" },
        { key: "comp_qc", label: "Prod Compounding - Transfer Storage" }, { key: "qc_analisa", label: "Transfer Storage - QC Terima" },
        { key: "analisa_release", label: "QC Terima - QC Analisa Complete" }, { key: "release_scan", label: "QC Analisa Complete - QC Release" },
        { key: "scan_filling", label: "QC Release - Scan Barcode Storage" }, { key: "filling_sample", label: "Scan Barcode - Prod Filling" },
        { key: "sample_endpack", label: "Prod Filling - QC Sample FG" }, { key: "endpack_setor_br", label: "QC Sample FG - End Packaging" },
        { key: "setor_br_rap", label: "End Packaging - Setor BR" }, { key: "setor_rap_terima_br", label: "Setor BR - Setor RAP" },
        { key: "terima_br_rap", label: "Setor RAP - Terima BR" }, { key: "terima_rap_qa", label: "Terima BR - Terima RAP" },
        { key: "qa_shipment", label: "Terima RAP - QA Release" }, { key: "total_menit", label: "Total (Menit)" }
    ];

    return (
        <div className="w-full md:w-[95%] mx-auto bg-transparent min-h-[500px]">

            {/* HEADER */}
            <div className="mb-6 mt-4">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                    <Server size={24} className="text-gray-700" /> Raw Data Leadtime PCT
                </h2>
            </div>

            {/* FILTER TANGGAL & DOWNLOAD TOOLBAR */}
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-4 mb-6 flex flex-col md:flex-row justify-between items-end gap-4">
                <form onSubmit={handleDateSearch} className="flex flex-wrap items-end gap-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-800 mb-1">Filter by Tanggal Create WO</label>
                        <div className="flex gap-2">
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Start</p>
                                <input
                                    type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                                    className="border border-gray-300 rounded p-1.5 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#c7d6ab]"
                                />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 mb-1">End</p>
                                <input
                                    type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                                    className="border border-gray-300 rounded p-1.5 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#c7d6ab]"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button type="submit" className="bg-[#c7d6ab] hover:bg-[#b3c494] text-gray-800 px-4 py-1.5 rounded text-sm font-medium transition cursor-pointer flex items-center gap-1.5">
                            <Search size={14} /> Search Date
                        </button>
                        {(appliedStartDate || appliedEndDate) && (
                            <button type="button" onClick={handleResetFilters} className="border border-red-300 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded text-sm font-medium transition cursor-pointer flex items-center gap-1.5">
                                <RotateCcw size={14} /> Clear
                            </button>
                        )}
                    </div>
                </form>

                {/* Dropdown Download */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsDownloadOpen(!isDownloadOpen)}
                        disabled={!appliedStartDate || !appliedEndDate}
                        className="bg-[#c7d6ab] hover:bg-[#b3c494] text-gray-800 px-4 py-1.5 rounded text-sm font-medium transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        <Download size={16} /> Download <ChevronDown size={14} />
                    </button>

                    {isDownloadOpen && appliedStartDate && appliedEndDate && (
                        <div className="absolute right-0 mt-1 w-56 bg-white rounded shadow-xl border border-gray-200 z-50 text-left overflow-hidden">
                            <button onClick={exportRawData} className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm hover:bg-gray-100 text-gray-700 transition border-b border-gray-50">
                                <FileSpreadsheet size={16} className="text-green-600" /> Timestamp Report
                            </button>
                            <button onClick={exportRawDataDigital} className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm hover:bg-gray-100 text-gray-700 transition border-b border-gray-50">
                                <FileSpreadsheet size={16} className="text-green-600" /> Duration Report
                            </button>
                            <button onClick={exportRawDataTPM} className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm hover:bg-gray-100 text-gray-700 transition">
                                <FileSpreadsheet size={16} className="text-green-600" /> TPM Compounding Report
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden mb-8">
                {/* ========================================== */}
                {/* TABEL 1: TIMESTAMP REPORT                  */}
                {/* ========================================== */}
                <div className="bg-gray-50 p-4 border-b border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <h4 className="text-lg font-bold text-gray-800 border-r-2 border-gray-300 pr-4">TIMESTAMP REPORT</h4>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <select value={entriesPerPage1} onChange={e => setEntriesPerPage1(Number(e.target.value))} className="border border-gray-300 rounded p-1.5 bg-white focus:ring-1 focus:ring-[#c7d6ab]">
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={15}>15</option>
                                <option value={20}>20</option>
                                <option value={25}>25</option>
                            </select>
                            <span>entries</span>
                        </div>
                    </div>
                    <input type="text" placeholder="Search Timestamp..." value={searchQuery1} onChange={e => setSearchQuery1(e.target.value)} className="border border-gray-300 rounded p-2 text-sm w-full md:w-64 focus:ring-2 focus:ring-[#c7d6ab] text-black" />
                </div>

                <div className="overflow-x-auto min-h-[300px] border-b border-gray-200 custom-scrollbar">
                    <table className="w-full text-sm text-left border-collapse min-w-[3500px]">
                        <thead className="text-gray-700 bg-gray-100 border-b border-gray-300">
                            <tr>
                                <th className="px-2 py-2 font-semibold border-r border-gray-200 text-center sticky left-0 bg-gray-100 z-20 cursor-pointer hover:bg-gray-200 w-[50px] min-w-[50px] max-w-[50px] outline outline-1 outline-gray-200" onClick={() => handleSort1("id")}>
                                    <div className="flex flex-row items-center justify-between">No {renderSortIcon("id", sortConfig1)}</div>
                                </th>
                                <th className="px-3 py-2 font-semibold border-r border-gray-200 cursor-pointer sticky left-[50px] bg-gray-100 z-20 hover:bg-gray-200 w-[130px] min-w-[130px] max-w-[130px] outline outline-1 outline-gray-200" onClick={() => handleSort1("no_batch")}>
                                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">No Batch {renderSortIcon("no_batch", sortConfig1)}</div>
                                </th>
                                <th className="px-3 py-2 font-semibold border-r border-gray-200 cursor-pointer sticky left-[180px] bg-gray-100 z-20 hover:bg-gray-200 w-[150px] min-w-[150px] max-w-[150px] outline outline-1 outline-gray-200 shadow-[5px_0_5px_-2px_rgba(0,0,0,0.1)]" onClick={() => handleSort1("kode_produk")}>
                                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">Kode Produk {renderSortIcon("kode_produk", sortConfig1)}</div>
                                </th>
                                {tsStandardCols.map(col => renderWrappedHeader(col.label, col.key, true, false))}
                                {tsTimeCols.map(col => renderWrappedHeader(col.label, col.key, true, true, "min-w-[100px]"))}
                            </tr>
                        </thead>
                        <tbody>
                            {currentData1.length === 0 ? (
                                <tr><td colSpan={27} className="px-4 py-8 text-center text-gray-500 italic">Tidak ada data.</td></tr>
                            ) : (
                                currentData1.map((item, index) => (
                                    <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50 transition text-gray-800">
                                        <td className="px-4 py-3 text-center border-r border-gray-200 sticky left-0 bg-white z-10 w-[50px] min-w-[50px] max-w-[50px] outline outline-1 outline-gray-200">
                                            {startIndex1 + index + 1}
                                        </td>
                                        <td className="px-4 py-3 font-bold border-r border-gray-200 whitespace-nowrap sticky left-[50px] bg-white z-10 w-[130px] min-w-[130px] max-w-[130px] outline outline-1 outline-gray-200">
                                            {item.no_batch}
                                        </td>
                                        <td className="px-4 py-3 font-medium border-r border-gray-200 whitespace-nowrap sticky left-[180px] bg-white z-10 w-[150px] min-w-[150px] max-w-[150px] outline outline-1 outline-gray-200 shadow-[5px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                            {item.kode_produk}
                                        </td>
                                        {tsStandardCols.map(col => <td key={col.key} className="px-4 py-3 border-r border-gray-200 whitespace-nowrap">{item[col.key as keyof TimestampData]}</td>)}
                                        {tsTimeCols.map(col => <td key={col.key} className="px-4 py-2 border-r border-gray-200 text-left whitespace-pre-line">{item[col.key as keyof TimestampData]}</td>)}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Pagination 1 */}
                <div className="p-4 flex flex-col md:flex-row justify-between items-center text-sm text-gray-600 bg-white gap-4">
                    <div>Showing {filteredData1.length === 0 ? 0 : startIndex1 + 1} to {Math.min(startIndex1 + entriesPerPage1, filteredData1.length)} of {filteredData1.length} entries</div>
                    <div className="flex bg-white rounded border border-gray-300 overflow-hidden shadow-sm">
                        <button onClick={() => setCurrentPage1(p => Math.max(1, p - 1))} disabled={currentPage1 === 1} className="px-3 py-1.5 border-r border-gray-300 hover:bg-gray-100 hover:cursor-pointer disabled:opacity-50 disabled:cursor-default"><ChevronLeft size={16} /></button>
                        {getPaginationNumbers(totalPages1, currentPage1).map((page, idx) => (
                            page === "..." ? <span key={`d1-${idx}`} className="px-3 py-1.5 border-r border-gray-300 text-gray-500 bg-gray-50">...</span> :
                                <button key={`p1-${page}`} onClick={() => setCurrentPage1(page as number)} className={`px-3 py-1.5 border-r border-gray-300 ${currentPage1 === page ? 'bg-[#eaf4ff] text-blue-600 font-medium' : 'hover:bg-gray-100 cursor-pointer'}`}>{page}</button>
                        ))}
                        <button onClick={() => setCurrentPage1(p => Math.min(totalPages1, p + 1))} disabled={currentPage1 === totalPages1} className="px-3 py-1.5 hover:bg-gray-100 hover:cursor-pointer disabled:opacity-50 disabled:cursor-default"><ChevronRight size={16} /></button>
                    </div>
                </div>
            </div>

            <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                {/* ========================================== */}
                {/* TABEL 2: DURATION REPORT                   */}
                {/* ========================================== */}
                <div className="bg-gray-50 p-4 border-b border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="border-r-2 border-gray-300 pr-4">
                            <h4 className="text-lg font-bold text-gray-800">DURATION REPORT</h4>
                            <p className="text-xs text-gray-500">DD - HH - MM - SS</p>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <select value={entriesPerPage2} onChange={e => setEntriesPerPage2(Number(e.target.value))} className="border border-gray-300 rounded p-1.5 bg-white focus:ring-1 focus:ring-[#c7d6ab]">
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={15}>15</option>
                                <option value={20}>20</option>
                                <option value={25}>25</option>
                            </select>
                            <span>entries</span>
                        </div>
                    </div>
                    <input type="text" placeholder="Search Duration..." value={searchQuery2} onChange={e => setSearchQuery2(e.target.value)} className="border border-gray-300 rounded p-2 text-sm w-full md:w-64 focus:ring-2 focus:ring-[#c7d6ab] text-black" />
                </div>

                <div className="overflow-x-auto min-h-[300px] border-b border-gray-200 custom-scrollbar">
                    <table className="w-full text-sm text-left border-collapse min-w-[3500px]">
                        <thead className="text-gray-700 bg-gray-100 border-b border-gray-300">
                            <tr>
                                <th className="px-2 py-2 font-semibold border-r border-gray-200 text-center sticky left-0 bg-gray-100 z-20 cursor-pointer hover:bg-gray-200 w-[50px] min-w-[50px] max-w-[50px] outline outline-1 outline-gray-200" onClick={() => handleSort2("id")}>
                                    <div className="flex items-center justify-between gap-0">No {renderSortIcon("id", sortConfig2)}</div>
                                </th>
                                <th className="px-3 py-2 font-semibold border-r border-gray-200 cursor-pointer sticky left-[50px] bg-gray-100 z-20 hover:bg-gray-200 w-[130px] min-w-[130px] max-w-[130px] outline outline-1 outline-gray-200" onClick={() => handleSort2("no_batch")}>
                                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">No Batch {renderSortIcon("no_batch", sortConfig2)}</div>
                                </th>
                                <th className="px-3 py-2 font-semibold border-r border-gray-200 cursor-pointer sticky left-[180px] bg-gray-100 z-20 hover:bg-gray-200 w-[150px] min-w-[150px] max-w-[150px] outline outline-1 outline-gray-200 shadow-[5px_0_5px_-2px_rgba(0,0,0,0.1)]" onClick={() => handleSort2("kode_produk")}>
                                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">Kode Produk {renderSortIcon("kode_produk", sortConfig2)}</div>
                                </th>
                                {durStandardCols.map(col => renderWrappedHeader(col.label, col.key, false, false))}
                                {durTimeCols.map(col => renderWrappedHeader(col.label, col.key, false, true, "min-w-[120px]"))}
                                <th className="px-3 py-2 font-semibold whitespace-nowrap">Reason</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentData2.length === 0 ? (
                                <tr><td colSpan={27} className="px-4 py-8 text-center text-gray-500 italic">Tidak ada data.</td></tr>
                            ) : (
                                currentData2.map((item, index) => (
                                    <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50 transition text-gray-800">
                                        <td className="px-3 py-2 text-center border-r border-gray-200 sticky left-0 bg-white z-10 w-[50px] min-w-[50px] max-w-[50px] outline outline-1 outline-gray-200">
                                            {startIndex2 + index + 1}
                                        </td>
                                        <td className="px-3 py-2 font-bold border-r border-gray-200 whitespace-nowrap sticky left-[50px] bg-white z-10 w-[130px] min-w-[130px] max-w-[130px] outline outline-1 outline-gray-200">
                                            {item.no_batch}
                                        </td>
                                        <td className="px-3 py-2 font-medium border-r border-gray-200 whitespace-nowrap sticky left-[180px] bg-white z-10 w-[150px] min-w-[150px] max-w-[150px] outline outline-1 outline-gray-200 shadow-[5px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                            {item.kode_produk}
                                        </td>
                                        {durStandardCols.map(col => <td key={col.key} className="px-4 py-3 border-r border-gray-200 whitespace-nowrap">{item[col.key as keyof DurationData] as string}</td>)}

                                        {durTimeCols.map(col => (
                                            <td key={col.key} className="px-3 py-2 border-r border-gray-200 text-center whitespace-nowrap font-mono text-sm tracking-tighter">
                                                {formatDurationDisplay(item[col.key as keyof DurationData] as string)}
                                            </td>
                                        ))}

                                        <td className="px-3 py-2">
                                            {item.reasons.length > 0 ? (
                                                <ul className="list-disc ml-4 space-y-1">
                                                    {item.reasons.map((r, i) => <li key={i} className="text-xs"><b>{r.process_name}</b><br />{r.reason}</li>)}
                                                </ul>
                                            ) : "-"}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Pagination 2 */}
                <div className="p-4 flex flex-col md:flex-row justify-between items-center text-sm text-gray-600 bg-white gap-4">
                    <div>Showing {filteredData2.length === 0 ? 0 : startIndex2 + 1} to {Math.min(startIndex2 + entriesPerPage2, filteredData2.length)} of {filteredData2.length} entries</div>
                    <div className="flex bg-white rounded border border-gray-300 overflow-hidden shadow-sm">
                        <button onClick={() => setCurrentPage2(p => Math.max(1, p - 1))} disabled={currentPage2 === 1} className="px-3 py-1.5 border-r border-gray-300 hover:bg-gray-100 disabled:opacity-50"><ChevronLeft size={16} /></button>
                        {getPaginationNumbers(totalPages2, currentPage2).map((page, idx) => (
                            page === "..." ? <span key={`d2-${idx}`} className="px-3 py-1.5 border-r border-gray-300 text-gray-500 bg-gray-50">...</span> :
                                <button key={`p2-${page}`} onClick={() => setCurrentPage2(page as number)} className={`px-3 py-1.5 border-r border-gray-300 ${currentPage2 === page ? 'bg-[#eaf4ff] text-blue-600 font-medium' : 'hover:bg-gray-100'}`}>{page}</button>
                        ))}
                        <button onClick={() => setCurrentPage2(p => Math.min(totalPages2, p + 1))} disabled={currentPage2 === totalPages2} className="px-3 py-1.5 hover:bg-gray-100 disabled:opacity-50"><ChevronRight size={16} /></button>
                    </div>
                </div>

            </div>
        </div>
    );
}