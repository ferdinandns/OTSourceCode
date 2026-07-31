// src/app/(dashboard)/product-alert/page.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Cookies from "js-cookie";
import { ChevronDown, ChevronLeft, ChevronRight, X, Eye, EyeOff, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { ProductAlertData } from "@/types";
import { API_BASE_URL, apiFetch } from "@/lib/api";

const thresholdOptions = [
    { title: "CWO - Potong Stock", field: "threshold_cwo_potong_stock" },
    { title: "Potong Stock - Validasi 1", field: "threshold_potong_stock_validasi_1" },
    { title: "Validasi 1 - Validasi 2", field: "threshold_validasi_1_validasi_2" },
    { title: "Validasi 2 - Start Compounding", field: "threshold_validasi_2_start_compounding" },
    { title: "Start - End Compounding", field: "threshold_start_compounding_end_compounding" },
    { title: "End Compounding - Sampling Ruah", field: "threshold_end_compounding_sampling_ruah" },
    { title: "Sampling Ruah - Ruah Datang", field: "threshold_sampling_ruah_ruah_datang" },
    { title: "Ruah Datang - Disposisi Ruah", field: "threshold_ruah_datang_disposisi_ruah" },
    { title: "Disposisi Ruah - Labeling Ruah", field: "threshold_disposisi_ruah_labeling_ruah" },
    { title: "Labeling Ruah - Start Filling", field: "threshold_labeling_ruah_start_filling" },
    { title: "Start Filling - End Packaging", field: "threshold_start_filling_end_packaging" },
    { title: "End Packaging - QA Rilis", field: "threshold_end_packaging_qa_rilis" },
    { title: "End Packaging - Setor BR", field: "threshold_end_packaging_setor_br" },
    { title: "Setor BR - QA Rilis", field: "threshold_setor_br_qa_rilis" },
    { title: "End Packaging - RAP", field: "threshold_end_packaging_setor_rap" },
    { title: "RAP - QA Rilis", field: "threshold_setor_rap_qa_rilis" },
    { title: "End Filling - QA Rilis", field: "threshold_end_filling_qa_rilis" },
    { title: "End Filling - Setor BR", field: "threshold_end_filling_setor_br" },
    { title: "End Filling - RAP", field: "threshold_end_filling_setor_rap" },
    { title: "QA Rilis - Shipment", field: "threshold_qa_rilis_shipment" }
];

type SortConfig = {
    key: string;
    direction: "asc" | "desc";
} | null;

export default function ProductAlertPage() {
    const [data, setData] = useState<ProductAlertData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [entriesPerPage, setEntriesPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);

    // State Dropdown & Modal
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeModalConfig, setActiveModalConfig] = useState<{ title: string; field: string } | null>(null);

    // State Form Modal
    const [formModal, setFormModal] = useState({
        pharma_powder: "",
        herbal_liquid: "",
        pharma_liquid: "",
        username: "",
        password: ""
    });
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchAlertData = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = Cookies.get("token");
            const res = await apiFetch(`${API_BASE_URL}/api/v1/master/product-alerts/`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            const json = await res.json();

            if (res.ok) {
                // Konversi data menit dari database menjadi format yang sesuai dengan Frontend (dibagi 60)
                const mappedData = json.data.map((item: any) => {
                    
                    // Kumpulkan semua field threshold ke dalam satu object "thresholds"
                    const thresholdsRecord: Record<string, number | null> = {};
                    thresholdOptions.forEach(opt => {
                        // Jika nilainya ada, bagi 60. Jika null/undefined, biarkan null
                        const val = item[opt.field];
                        thresholdsRecord[opt.field] = val !== null && val !== undefined ? val / 60 : null;
                    });

                    return {
                        id: item.id,
                        kode_produk: item.kode_produk,
                        kategori: item.kategori,
                        sediaan: item.sediaan,
                        thresholds: thresholdsRecord
                    };
                });
                setData(mappedData);
            } else {
                console.error("Gagal memuat data:", json.message);
            }
        } catch (error) {
            console.error("Error fetching product alerts:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Panggil fetchData saat halaman pertama kali dimuat
    useEffect(() => {
        fetchAlertData();
    }, [fetchAlertData]);

    const openModal = (option: { title: string; field: string }) => {
        setActiveModalConfig(option);
        setIsDropdownOpen(false);

        // 1. Cari sampel 1 baris data untuk masing-masing grup di dalam state 'data'
        const pharmaPowderItem = data.find(item => item.kategori === "Pharma" && item.sediaan === "Powder");
        const herbalLiquidItem = data.find(item => item.kategori === "Herbal" && item.sediaan === "Liquid");
        const pharmaLiquidItem = data.find(item => item.kategori === "Pharma" && item.sediaan === "Liquid");

        // 2. Ambil nilai threshold berdasarkan field yang dipilih (sudah dalam bentuk jam dari fetch)
        const valPharmaPowder = pharmaPowderItem?.thresholds[option.field];
        const valHerbalLiquid = herbalLiquidItem?.thresholds[option.field];
        const valPharmaLiquid = pharmaLiquidItem?.thresholds[option.field];

        // 3. Set ke state formModal. Jika nilainya ada, ubah ke string, jika null/undefined jadikan string kosong
        setFormModal({ 
            pharma_powder: valPharmaPowder !== null && valPharmaPowder !== undefined ? String(valPharmaPowder) : "",
            herbal_liquid: valHerbalLiquid !== null && valHerbalLiquid !== undefined ? String(valHerbalLiquid) : "",
            pharma_liquid: valPharmaLiquid !== null && valPharmaLiquid !== undefined ? String(valPharmaLiquid) : "",
            username: "", 
            password: "" 
        });

        setShowPassword(false);
        setIsModalOpen(true);
    };

    const handleModalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const token = Cookies.get("token");
            
            // Susun Payload. Nilai form string ("") diubah jadi null agar Golang Pointer pointer membacanya sebagai request kosong
            const payload = {
                field: activeModalConfig?.field,
                confirm_username: formModal.username,
                confirm_password: formModal.password,
                pharma_powder: formModal.pharma_powder !== "" ? Number(formModal.pharma_powder) : null,
                herbal_liquid: formModal.herbal_liquid !== "" ? Number(formModal.herbal_liquid) : null,
                pharma_liquid: formModal.pharma_liquid !== "" ? Number(formModal.pharma_liquid) : null,
            };

            const response = await apiFetch(`${API_BASE_URL}/api/v1/master/product-alerts/group`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.meta?.message);
            }

            alert(result.meta?.message + `: ${activeModalConfig?.title}`);
            setIsModalOpen(false);
            
            // Refresh tabel data secara real-time dari database
            fetchAlertData();

        } catch (error: any) {
            alert(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // FILTERING & SORTING
    const filteredData = data.filter(item =>
        item.kode_produk.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.kategori.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sediaan.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const sortedData = [...filteredData].sort((a, b) => {
        if (!sortConfig) return 0;

        let aValue: any = a[sortConfig.key as keyof ProductAlertData];
        let bValue: any = b[sortConfig.key as keyof ProductAlertData];

        // Jika sorting berdasarkan kolom threshold
        if (sortConfig.key.startsWith("threshold_")) {
            aValue = a.thresholds[sortConfig.key];
            bValue = b.thresholds[sortConfig.key];
        }

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
    });

    const totalPages = Math.max(1, Math.ceil(sortedData.length / entriesPerPage));
    const startIndex = (currentPage - 1) * entriesPerPage;
    const currentData = sortedData.slice(startIndex, startIndex + entriesPerPage);

    const handleSort = (key: string) => {
        let direction: "asc" | "desc" = "asc";
        if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
            direction = "desc";
        }
        setSortConfig({ key, direction });
    };

    // HELPER FORMAT ANGKA (Menyamakan blade: number_format / 60)
    const formatThreshold = (valueDalamJam: number | undefined | null) => {
        if (valueDalamJam === undefined || valueDalamJam === null) return 0;
        
        // Value sudah dalam bentuk jam (karena dibagi 60 saat fetch)
        // Mengubah ke 1 angka di belakang koma, dan menghilangkan '.0' jika genap
        const formatted = valueDalamJam.toFixed(1).replace(/\.0$/, '');
        return formatted;
    };

    return (
        <div className="w-full md:w-[95%] mx-auto bg-transparent min-h-[500px]">

            <div className="mb-4 mt-4">
                <h2 className="text-2xl font-bold text-gray-800">Product Alert (Threshold)</h2>
            </div>

            <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">

                {/* Header - Tombol Dropdown Edit Threshold */}
                <div className="p-4 border-b border-gray-100 flex items-center">
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="bg-[#c7d6ab] hover:bg-[#b3c494] text-gray-900 px-4 py-2 rounded text-sm font-medium transition flex items-center gap-2 shadow-sm cursor-pointer"
                        >
                            Edit Threshold <ChevronDown size={16} />
                        </button>

                        {/* Dropdown Menu (Scrollable karena itemnya banyak) */}
                        {isDropdownOpen && (
                            <div className="absolute left-0 mt-1 w-72 bg-white rounded shadow-xl border border-gray-200 z-50 max-h-80 overflow-y-auto custom-scrollbar">
                                {thresholdOptions.map((opt, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => openModal(opt)}
                                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#eaf4ff] text-gray-700 transition border-b border-gray-50 last:border-0"
                                    >
                                        {opt.title}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Toolbar Entries & Search */}
                <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <select
                            value={entriesPerPage}
                            onChange={e => setEntriesPerPage(Number(e.target.value))}
                            className="border border-gray-300 rounded p-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#c7d6ab]"
                        >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={15}>15</option>
                            <option value={20}>20</option>
                            <option value={25}>25</option>
                        </select>
                        <span>entries per page</span>
                    </div>
                    <div>
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="border border-gray-300 rounded p-2 text-sm text-black w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-[#c7d6ab]"
                        />
                    </div>
                </div>

                {/* TABEL WIDE DENGAN SCROLL HORIZONTAL */}
                <div className="overflow-x-auto min-h-[350px]">
                    <table className="w-full text-sm text-left border-collapse min-w-[3000px]">
                        <thead className="text-gray-700 bg-white border-b-2 border-gray-200">
                            <tr>
                                <th className="px-2 py-3 font-semibold border border-gray-200 w-[50px] min-w-[50px] max-w-[50px] text-center sticky left-0 bg-white z-20 outline outline-1 outline-gray-200">
                                    No
                                </th>
                                <th className="px-2 py-3 font-semibold border border-gray-200 w-[130px] min-w-[130px] max-w-[130px] cursor-pointer hover:bg-gray-50 sticky left-[50px] bg-white z-20 outline outline-1 outline-gray-200" onClick={() => handleSort("kode_produk")}>
                                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">
                                        Kode Produk {sortConfig?.key === "kode_produk" ? (sortConfig.direction === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} className="text-gray-400" />}
                                    </div>
                                </th>
                                <th className="px-2 py-3 font-semibold border border-gray-200 w-[100px] min-w-[100px] max-w-[100px] cursor-pointer hover:bg-gray-50 sticky left-[180px] bg-white z-20 outline outline-1 outline-gray-200" onClick={() => handleSort("kategori")}>
                                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">
                                        Kategori {sortConfig?.key === "kategori" ? (sortConfig.direction === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} className="text-gray-400" />}
                                    </div>
                                </th>
                                <th className="px-2 py-3 font-semibold border border-gray-200 w-[100px] min-w-[100px] max-w-[100px] cursor-pointer hover:bg-gray-50 sticky left-[280px] bg-white z-20 outline outline-1 outline-gray-200 shadow-[5px_0_5px_-2px_rgba(0,0,0,0.1)]" onClick={() => handleSort("sediaan")}>
                                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">
                                        Sediaan {sortConfig?.key === "sediaan" ? (sortConfig.direction === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />) : <ArrowUpDown size={14} className="text-gray-400" />}
                                    </div>
                                </th>

                                {/* Render 20 Header Kolom Threshold */}
                                {thresholdOptions.map((opt, idx) => (
                                    <th key={idx} className="px-2 py-1.5 font-semibold border border-gray-200 cursor-pointer hover:bg-gray-50 text-center" onClick={() => handleSort(opt.field)}>
                                        <div className="flex flex-col items-center justify-center gap-1 whitespace-normal break-words text-center leading-tight">
                                            <span>{opt.title}</span>
                                            {sortConfig?.key === opt.field ? (
                                                sortConfig.direction === "asc" ? <ArrowUp size={12} className="text-blue-600 flex-shrink-0" /> : <ArrowDown size={12} className="text-blue-600 flex-shrink-0" />
                                            ) : (
                                                <ArrowUpDown size={12} className="text-gray-400 opacity-60 flex-shrink-0" />
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {currentData.length === 0 ? (
                                <tr>
                                    <td colSpan={24} className="px-4 py-8 text-center text-gray-500 italic border border-gray-200">
                                        Tidak ada data.
                                    </td>
                                </tr>
                            ) : (
                                currentData.map((item, index) => (
                                    <tr key={item.id} className="border border-gray-200 hover:bg-gray-50 transition text-gray-800">
                                        <td className="px-4 py-3 text-center border border-gray-200 sticky left-0 w-[50px] min-w-[50px] max-w-[50px] bg-white group-hover:bg-gray-50 z-10 outline outline-1 outline-gray-200">
                                            {startIndex + index + 1}
                                        </td>
                                        <td className="px-4 py-3 border border-gray-200 whitespace-nowrap sticky left-[50px] w-[130px] min-w-[130px] max-w-[130px] bg-white group-hover:bg-gray-50 z-10 font-bold outline outline-1 outline-gray-200">
                                            {item.kode_produk}
                                        </td>
                                        <td className="px-4 py-3 border border-gray-200 whitespace-nowrap sticky left-[180px] w-[100px] min-w-[100px] max-w-[100px] bg-white group-hover:bg-gray-50 z-10 outline outline-1 outline-gray-200">
                                            {item.kategori}
                                        </td>
                                        {/* Hanya kolom terakhir (Sediaan) yang dikasih shadow penutup agar memberi kesan depth saat di-scroll */}
                                        <td className="px-4 py-3 border border-gray-200 whitespace-nowrap sticky left-[280px] w-[100px] min-w-[100px] max-w-[100px] bg-white group-hover:bg-gray-50 z-10 outline outline-1 outline-gray-200 shadow-[5px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                            {item.sediaan}
                                        </td>

                                        {/* Render 20 Data Kolom Threshold */}
                                        {thresholdOptions.map((opt, idx) => (
                                            <td key={idx} className="px-4 py-3 border border-gray-200 text-center">
                                                {formatThreshold(item.thresholds[opt.field])}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t border-gray-200 flex justify-between items-center text-sm text-gray-600 bg-gray-50 rounded-b-lg">
                    <div>Showing {currentData.length === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + entriesPerPage, filteredData.length)} of {filteredData.length} entries</div>
                    <div className="flex bg-white rounded border border-gray-300 overflow-hidden shadow-sm">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 border-r border-gray-300 hover:bg-gray-100 disabled:opacity-50 cursor-pointer disabled:cursor-default"><ChevronLeft size={16} /></button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button key={page} onClick={() => setCurrentPage(page)} className={`px-3 py-1.5 border-r border-gray-300 ${currentPage === page ? 'bg-[#eaf4ff] text-blue-600 font-medium' : 'hover:bg-gray-100 cursor-pointer'}`}>{page}</button>
                        ))}
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 hover:bg-gray-100 disabled:opacity-50 cursor-pointer disabled:cursor-default"><ChevronRight size={16} /></button>
                    </div>
                </div>

            </div>

            {/* ========================================== */}
            {/* MODAL POP-UP EDIT THRESHOLD ALERT          */}
            {/* ========================================== */}
            {isModalOpen && activeModalConfig && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 fade-in">
                    <form onSubmit={handleModalSubmit} className="bg-white rounded-lg shadow-2xl w-[500px] overflow-hidden">

                        {/* Header Modal */}
                        <div className="px-4 py-3 bg-white border-b border-gray-200 flex justify-between items-center">
                            <h5 className="font-bold text-lg text-gray-800">
                                Edit Threshold {activeModalConfig.title}
                            </h5>
                            <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-black transition">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">

                            {/* 1. Pharma - Powder */}
                            <div className="flex border border-gray-300 rounded overflow-hidden shadow-sm h-[40px]">
                                <span className="bg-[#0d6efd] text-white px-3 flex items-center justify-center font-medium w-24 text-sm flex-shrink-0">Pharma</span>
                                <span className="bg-gray-50 px-3 flex items-center justify-center text-gray-700 font-medium border-r border-gray-300 w-24 text-sm flex-shrink-0">Powder</span>
                                <input
                                    type="number" step="0.1" required
                                    value={formModal.pharma_powder}
                                    onChange={e => setFormModal({ ...formModal, pharma_powder: e.target.value })}
                                    className="flex-1 px-3 py-1 text-sm text-black focus:outline-none focus:bg-blue-50 transition"
                                />
                                <span className="bg-gray-50 px-3 flex items-center justify-center text-gray-700 border-l border-gray-300 text-sm flex-shrink-0">jam</span>
                            </div>

                            {/* 2. Herbal - Liquid */}
                            <div className="flex border border-gray-300 rounded overflow-hidden shadow-sm h-[40px]">
                                <span className="bg-[#198754] text-white px-3 flex items-center justify-center font-medium w-24 text-sm flex-shrink-0">Herbal</span>
                                <span className="bg-gray-50 px-3 flex items-center justify-center text-gray-700 font-medium border-r border-gray-300 w-24 text-sm flex-shrink-0">Liquid</span>
                                <input
                                    type="number" step="0.1" required
                                    value={formModal.herbal_liquid}
                                    onChange={e => setFormModal({ ...formModal, herbal_liquid: e.target.value })}
                                    className="flex-1 px-3 py-1 text-sm text-black focus:outline-none focus:bg-blue-50 transition"
                                />
                                <span className="bg-gray-50 px-3 flex items-center justify-center text-gray-700 border-l border-gray-300 text-sm flex-shrink-0">jam</span>
                            </div>

                            {/* 3. Pharma - Liquid */}
                            <div className="flex border border-gray-300 rounded overflow-hidden shadow-sm h-[40px]">
                                <span className="bg-[#0d6efd] text-white px-3 flex items-center justify-center font-medium w-24 text-sm flex-shrink-0">Pharma</span>
                                <span className="bg-gray-50 px-3 flex items-center justify-center text-gray-700 font-medium border-r border-gray-300 w-24 text-sm flex-shrink-0">Liquid</span>
                                <input
                                    type="number" step="0.1" required
                                    value={formModal.pharma_liquid}
                                    onChange={e => setFormModal({ ...formModal, pharma_liquid: e.target.value })}
                                    className="flex-1 px-3 py-1 text-sm text-black focus:outline-none focus:bg-blue-50 transition"
                                />
                                <span className="bg-gray-50 px-3 flex items-center justify-center text-gray-700 border-l border-gray-300 text-sm flex-shrink-0">jam</span>
                            </div>

                            <hr className="my-4 border-gray-200" />

                            {/* Verifikasi Akun */}
                            <div>
                                <label className="block font-bold text-sm text-gray-800 mb-3">
                                    Masukkan Username dan Password untuk Verifikasi
                                </label>
                                <div className="space-y-3">
                                    <div className="flex border border-gray-300 rounded overflow-hidden shadow-sm h-[40px]">
                                        <span className="bg-gray-50 px-3 flex items-center text-gray-700 font-medium border-r border-gray-300 w-28 text-sm flex-shrink-0">Username</span>
                                        <input
                                            type="text" placeholder="Username" required
                                            value={formModal.username}
                                            onChange={e => setFormModal({ ...formModal, username: e.target.value })}
                                            className="flex-1 px-3 py-1 text-sm text-black focus:outline-none focus:bg-blue-50 transition"
                                        />
                                    </div>
                                    <div className="flex border border-gray-300 rounded overflow-hidden shadow-sm relative h-[40px]">
                                        <span className="bg-gray-50 px-3 flex items-center text-gray-700 font-medium border-r border-gray-300 w-28 text-sm flex-shrink-0">Password</span>
                                        <input
                                            type={showPassword ? "text" : "password"} placeholder="Password" required
                                            value={formModal.password}
                                            onChange={e => setFormModal({ ...formModal, password: e.target.value })}
                                            className="flex-1 px-3 py-1 text-sm text-black focus:outline-none focus:bg-blue-50 transition pr-10"
                                        />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700">
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* Footer Modal */}
                        <div className="p-4 border-t border-gray-200 flex justify-end gap-2 bg-gray-50">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 bg-[#6c757d] text-white rounded font-medium hover:bg-[#5c636a] transition text-sm cursor-pointer"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-4 py-2 bg-[#0d6efd] text-white rounded font-medium hover:bg-[#0b5ed7] transition text-sm cursor-pointer disabled:opacity-50"
                            >
                                {isSubmitting ? "Menyimpan..." : "Simpan"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}