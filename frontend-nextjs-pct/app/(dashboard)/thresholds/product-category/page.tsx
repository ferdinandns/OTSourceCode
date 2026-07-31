// src/app/(dashboard)/threshold/page.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Pill, Sprout, ChevronDown, X, Eye, EyeOff } from "lucide-react";
import { ThresholdData } from "@/types";
import Cookies from "js-cookie";
import { API_BASE_URL, apiFetch } from "@/lib/api";

// Tipe untuk menampung state form edit di dalam modal
type EditModalState = {
    isOpen: boolean;
    id: number;
    jenis: "Pharma" | "Herbal";
    batas_treshold: string;
    batas_bawah: string | number;
    batas_atas: string | number;
};

export default function ThresholdPage() {
    const [data, setData] = useState<ThresholdData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [entriesPerPage, setEntriesPerPage] = useState(10);
    const [searchQuery, setSearchQuery] = useState("");

    const [openActionId, setOpenActionId] = useState<number | null>(null);

    // State untuk Modal Edit
    const [modalData, setModalData] = useState<EditModalState>({
        isOpen: false,
        id: 0,
        jenis: "Pharma",
        batas_treshold: "",
        batas_bawah: "",
        batas_atas: ""
    });

    // State untuk konfirmasi username & password di Modal
    const [authUsername, setAuthUsername] = useState("");
    const [authPassword, setAuthPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);

    // Menutup dropdown action ketika klik di luar area
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpenActionId(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Fetching Data (Bisa dihubungkan ke Golang nanti)
    const fetchThresholds = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = Cookies.get("token");
            // Sesuaikan route jika ada prefix /api/v1/master
            const res = await apiFetch(`${API_BASE_URL}/api/v1/master/thresholds`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            const json = await res.json();

            if (res.ok) {
                // Konversi data dari Menit (Database) ke Hari (Frontend)
                const mappedData = json.data.map((item: any) => ({
                    id: item.id,
                    batas_treshold: item.batas_treshold,
                    limit_bawah_pharma_hari: item.limit_bawah_pharma / 1440,
                    limit_atas_pharma_hari: item.limit_atas_pharma / 1440,
                    limit_bawah_herbal_hari: item.limit_bawah_herbal / 1440,
                    limit_atas_herbal_hari: item.limit_atas_herbal / 1440,
                })).sort((a: any, b: any) => a.id - b.id);
                setData(mappedData);
            }
        } catch (error) {
            console.error("Gagal mengambil data threshold:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchThresholds();
    }, [fetchThresholds]);

    const handleOpenEdit = (item: ThresholdData, jenis: "Pharma" | "Herbal") => {
        setModalData({
            isOpen: true,
            id: item.id,
            jenis: jenis,
            batas_treshold: item.batas_treshold,
            batas_bawah: jenis === "Pharma" ? item.limit_bawah_pharma_hari : item.limit_bawah_herbal_hari,
            batas_atas: jenis === "Pharma" ? item.limit_atas_pharma_hari : item.limit_atas_herbal_hari,
        });
        setOpenActionId(null); // Tutup dropdown action
        setAuthUsername("");
        setAuthPassword("");
        setShowPassword(false);
    };

    const handleSaveEdit = async () => {
        setIsSubmitting(true);
        try {
            const token = Cookies.get("token");

            // Cari data original untuk mempertahankan nilai dari jenis yang TIDAK sedang diedit
            const originalData = data.find(item => item.id === modalData.id);
            if (!originalData) throw new Error("Data referensi tidak ditemukan");

            // Susun payload. Backend butuh semua field, jadi kita gabung data baru dan data lama
            const payload = {
                batas_treshold: modalData.batas_treshold,
                limit_bawah_pharma: modalData.jenis === "Pharma" ? Number(modalData.batas_bawah) : originalData.limit_bawah_pharma_hari,
                limit_atas_pharma: modalData.jenis === "Pharma" ? Number(modalData.batas_atas) : originalData.limit_atas_pharma_hari,
                limit_bawah_herbal: modalData.jenis === "Herbal" ? Number(modalData.batas_bawah) : originalData.limit_bawah_herbal_hari,
                limit_atas_herbal: modalData.jenis === "Herbal" ? Number(modalData.batas_atas) : originalData.limit_atas_herbal_hari,
                username: authUsername,
                password: authPassword
            };

            // Hit API menggunakan parameter /:id
            const response = await apiFetch(`${API_BASE_URL}/api/v1/master/thresholds/${modalData.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.meta?.message || result.error || "Gagal mengubah data threshold.");
            }

            alert(result.meta?.message);
            setModalData(prev => ({ ...prev, isOpen: false }));

            // Refresh tabel data secara real-time dari database
            fetchThresholds();

        } catch (error: any) {
            alert(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Logika pewarnaan dinamis header modal
    const getModalHeaderStyle = (batas: string) => {
        switch (batas.toLowerCase()) {
            case 'biru': return 'bg-[#0d6efd] text-white';
            case 'hijau tua': return 'bg-[#198754] text-white';
            case 'hijau muda': return 'bg-[#00ff48] text-black';
            case 'kuning': return 'bg-[#ffc107] text-black';
            case 'merah': return 'bg-[#dc3545] text-white';
            default: return 'bg-gray-500 text-white';
        }
    };

    const filteredData = data.filter(item =>
        (item.batas_treshold || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(item.limit_atas_herbal_hari || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(item.limit_atas_pharma_hari || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(item.limit_bawah_herbal_hari || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(item.limit_bawah_pharma_hari || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="w-full md:w-[95%] mx-auto bg-transparent min-h-[500px]">

            <div className="mb-6 mt-4">
                <h2 className="text-2xl font-bold text-gray-800 uppercase flex items-center gap-3">
                    THRESHOLD
                    <span className="bg-[#c7d6ab] text-gray-800 text-sm font-semibold px-1.5 py-1 rounded normal-case">
                        Satuan: Hari
                    </span>
                </h2>
            </div>

            <div className="bg-white shadow-sm rounded-lg border border-gray-200">

                {/* Toolbar: Entries & Search */}
                <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4 border-b border-gray-100 bg-white">
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
                            className="border border-gray-300 rounded p-2 text-black text-sm w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-[#c7d6ab]"
                        />
                    </div>
                </div>

                {/* Tabel Data */}
                <div className="overflow-visible min-h-[300px]">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="text-gray-700 bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-3 font-semibold border border-gray-200 w-12 text-center">No</th>
                                <th className="px-4 py-3 font-semibold border border-gray-200">Kategori Warna</th>
                                <th className="px-4 py-3 font-semibold border border-gray-200">Pharma Bawah</th>
                                <th className="px-4 py-3 font-semibold border border-gray-200">Pharma Atas</th>
                                <th className="px-4 py-3 font-semibold border border-gray-200">Herbal Bawah</th>
                                <th className="px-4 py-3 font-semibold border border-gray-200">Herbal Atas</th>
                                <th className="px-4 py-3 font-semibold border border-gray-200 text-center w-28">Edit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.map((item, index) => (
                                <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50 transition text-gray-800">
                                    <td className="px-4 py-3 text-center border border-gray-200">{item.id}</td>
                                    <td className="px-4 py-3 border border-gray-200">{item.batas_treshold}</td>
                                    <td className="px-4 py-3 border border-gray-200">{item.limit_bawah_pharma_hari}</td>
                                    <td className="px-4 py-3 border border-gray-200">{item.limit_atas_pharma_hari}</td>
                                    <td className="px-4 py-3 border border-gray-200">{item.limit_bawah_herbal_hari}</td>
                                    <td className="px-4 py-3 border border-gray-200">{item.limit_atas_herbal_hari}</td>

                                    {/* Kolom Action Menyatu */}
                                    <td className="px-0 py-0 text-center border border-gray-200 relative" ref={openActionId === item.id ? dropdownRef : null}>
                                        <button
                                            onClick={() => setOpenActionId(openActionId === item.id ? null : item.id)}
                                            className="w-full h-full min-h-[44px] px-3 bg-[#e2eacb] hover:bg-[#d4e0b5] outline-none flex items-center justify-center gap-1 text-sm font-medium text-gray-800 transition cursor-pointer"
                                        >
                                            Edit <ChevronDown size={14} className="text-gray-600" />
                                        </button>

                                        {openActionId === item.id && (
                                            <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded shadow-xl border border-gray-200 z-50 text-left overflow-hidden">
                                                <button
                                                    className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm hover:bg-gray-100 text-gray-700 transition cursor-pointer"
                                                    onClick={() => handleOpenEdit(item, "Pharma")}
                                                >
                                                    <Pill size={16} className="text-blue-500" /> Edit Pharma
                                                </button>
                                                <button
                                                    className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm hover:bg-gray-100 text-gray-700 transition cursor-pointer"
                                                    onClick={() => handleOpenEdit(item, "Herbal")}
                                                >
                                                    <Sprout size={16} className="text-green-500" /> Edit Herbal
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 flex text-sm text-gray-600 bg-white">
                    Showing 1 to {filteredData.length} of {data.length} entries
                </div>
            </div>

            {/* ========================================== */}
            {/* MODAL POP-UP EDIT THRESHOLD                */}
            {/* ========================================== */}
            {modalData.isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 fade-in">
                    <div className="bg-white rounded-lg shadow-2xl w-[500px] overflow-hidden">

                        {/* Header Modal Dinamis Berdasarkan Warna Threshold */}
                        <div className={`px-4 py-3 flex justify-between items-center ${getModalHeaderStyle(modalData.batas_treshold)}`}>
                            <h5 className="font-bold text-lg">
                                {modalData.jenis} — Batas: {modalData.batas_treshold}
                            </h5>
                            <button onClick={() => setModalData(prev => ({ ...prev, isOpen: false }))} className="hover:opacity-75 transition cursor-pointer">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">

                            {/* Input Batas Bawah */}
                            <div className="flex border border-gray-300 rounded overflow-hidden shadow-sm">
                                <span className="bg-white px-4 py-2 text-sm text-gray-700 font-medium border-r border-gray-300 w-32 flex-shrink-0">
                                    Batas Bawah
                                </span>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={modalData.batas_bawah}
                                    onChange={(e) => setModalData(prev => ({ ...prev, batas_bawah: e.target.value }))}
                                    className="flex-1 px-3 py-2 text-sm text-black focus:outline-none focus:bg-blue-50 transition"
                                />
                                <span className="bg-white px-4 py-2 text-sm text-gray-700 font-medium border-l border-gray-300 flex-shrink-0">
                                    Hari
                                </span>
                            </div>

                            {/* Input Batas Atas */}
                            <div className="flex border border-gray-300 rounded overflow-hidden shadow-sm">
                                <span className="bg-white px-4 py-2 text-sm text-gray-700 font-medium border-r border-gray-300 w-32 flex-shrink-0">
                                    Batas Atas
                                </span>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={modalData.batas_atas}
                                    onChange={(e) => setModalData(prev => ({ ...prev, batas_atas: e.target.value }))}
                                    className="flex-1 px-3 py-2 text-sm text-black focus:outline-none focus:bg-blue-50 transition"
                                />
                                <span className="bg-white px-4 py-2 text-sm text-gray-700 font-medium border-l border-gray-300 flex-shrink-0">
                                    Hari
                                </span>
                            </div>

                            <hr className="my-4 border-gray-200" />

                            {/* Form Konfirmasi Akun */}
                            <div>
                                <label className="block font-bold text-sm text-gray-800 mb-3">
                                    Masukkan Username dan Password untuk Verifikasi
                                </label>
                                <div className="space-y-3">

                                    <div className="flex border border-gray-300 rounded overflow-hidden shadow-sm">
                                        <span className="bg-white px-3 py-2 text-sm text-gray-700 border-r border-gray-300 w-28 flex-shrink-0">
                                            Username
                                        </span>
                                        <input
                                            type="text"
                                            placeholder="Username"
                                            value={authUsername}
                                            onChange={(e) => setAuthUsername(e.target.value)}
                                            className="flex-1 px-3 py-2 text-sm text-black focus:outline-none focus:bg-blue-50 transition"
                                        />
                                    </div>

                                    <div className="flex border border-gray-300 rounded overflow-hidden shadow-sm relative">
                                        <span className="bg-white px-3 py-2 text-sm text-gray-700 border-r border-gray-300 w-28 flex-shrink-0">
                                            Password
                                        </span>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Password"
                                            value={authPassword}
                                            onChange={(e) => setAuthPassword(e.target.value)}
                                            className="flex-1 px-3 py-2 text-sm text-black focus:outline-none focus:bg-blue-50 transition pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700 cursor-pointer"
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>

                                </div>
                            </div>

                        </div>

                        {/* Footer Modal */}
                        <div className="p-4 border-t border-gray-200 flex justify-end gap-2 bg-white">
                            <button
                                onClick={() => setModalData(prev => ({ ...prev, isOpen: false }))}
                                disabled={isSubmitting}
                                className="px-4 py-2 bg-[#6c757d] text-white rounded font-medium hover:bg-[#5c636a] transition text-sm cursor-pointer"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={isSubmitting || !authUsername || !authPassword}
                                className="px-4 py-2 bg-[#198754] text-white rounded font-medium hover:bg-[#157347] transition text-sm cursor-pointer disabled:opacity-50"
                            >
                                {isSubmitting ? "Memproses..." : "Simpan Perubahan"}
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}