"use client";

import { useState, useRef, useEffect } from "react";
import {
    ChevronDown, ChevronLeft, ChevronRight, X, Eye, EyeOff,
    ArrowUpDown, ArrowUp, ArrowDown
} from "lucide-react";
import { ProductData, MixingTankRef } from "@/types";
import { API_BASE_URL, apiFetch } from "@/lib/api"; 
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";

type SortConfig = {
    key: keyof ProductData | "mixing_tanks_str";
    direction: "asc" | "desc";
} | null;

type ModalType = "autoRilis" | "mixingTank" | "status" | null;

/**
 * Halaman Master Produk.
 * 
 * **Konsep Arsitektural:**
 * - **CRUD Page Pattern**: Menggabungkan tampilan daftar tabel (Read) dengan form Create/Update 
 *   di halaman yang sama menggunakan dialog/modal state.
 * - **Sync on Mutation**: Setiap kali pengguna menambah atau mengedit produk (Mutation), fungsi 
 *   `fetchProducts()` dipanggil ulang secara asinkron untuk memastikan tabel sinkron dengan 
 *   kondisi terbaru di *database* Go tanpa memuat ulang seluruh aplikasi.
 */
export default function ProductPage() {
    const router = useRouter();
    const [currentUserRole, setCurrentUserRole] = useState("");
    const [currentUserDept, setCurrentUserDept] = useState("");

    const [data, setData] = useState<ProductData[]>([]);
    const [availableTanks, setAvailableTanks] = useState<MixingTankRef[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Search, Sort, Pagination States
    const [searchQuery, setSearchQuery] = useState("");
    const [entriesPerPage, setEntriesPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);

    // Dropdown Action
    const [openActionId, setOpenActionId] = useState<number | null>(null);

    // Modal States
    const [activeModal, setActiveModal] = useState<ModalType>(null);
    const [selectedProduct, setSelectedProduct] = useState<ProductData | null>(null);

    // Form States 
    const [formValue, setFormValue] = useState("");
    const [selectedTanks, setSelectedTanks] = useState<number[]>([]);
    const [authUsername, setAuthUsername] = useState("");
    const [authPassword, setAuthPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const role = (Cookies.get("level") || "").toLowerCase();
        const dept = Cookies.get("area") || "";
        setCurrentUserRole(role);
        setCurrentUserDept(dept);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpenActionId(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, entriesPerPage]);

    // FETCH DATA PRODUK & TANKS DARI BACKEND GOLANG
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const token = Cookies.get("token");

            // Menyesuaikan jalur grup router master backend Golang
            const res = await apiFetch(`${API_BASE_URL}/api/v1/master/produk/`, {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}` 
                }
            });

            if (res.ok) {
                const json = await res.json();
                if (json.data) {
                    setData(json.data.produk || []);
                    setAvailableTanks(json.data.tanks || []);
                }
            } else {
                console.error("Gagal memuat data produk");
            }
        } catch (error) {
            console.error("Terjadi kesalahan saat memuat data produk:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // FILTERING
    const filteredData = data.filter(item =>
        (item.kode_produk || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.produksi_auto_rilis || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.mixing_tanks || []).map(t => `${t.mixing_tank.nama} (${t.mixing_tank.ruangan})`).join(", ").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.status || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.kategori || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    // SORTING
    const sortedData = [...filteredData].sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;

        let aValue = "";
        let bValue = "";

        if (key === "mixing_tanks_str") {
            aValue = (a.mixing_tanks || []).map(t => `${t.mixing_tank.nama} (${t.mixing_tank.ruangan})`).join(", ");
            bValue = (b.mixing_tanks || []).map(t => `${t.mixing_tank.nama} (${t.mixing_tank.ruangan})`).join(", ");
        } else {
            aValue = String(a[key as keyof ProductData] || "");
            bValue = String(b[key as keyof ProductData] || "");
        }

        return direction === "asc"
            ? aValue.localeCompare(bValue, undefined, { numeric: true })
            : bValue.localeCompare(aValue, undefined, { numeric: true });
    });

    // PAGINATION
    const totalPages = Math.max(1, Math.ceil(sortedData.length / entriesPerPage));
    const startIndex = (currentPage - 1) * entriesPerPage;
    const currentData = sortedData.slice(startIndex, startIndex + entriesPerPage);

    const handleSort = (key: keyof ProductData | "mixing_tanks_str") => {
        let direction: "asc" | "desc" = "asc";
        if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
            direction = "desc";
        }
        setSortConfig({ key, direction });
    };

    const renderSortIcon = (key: string) => {
        if (sortConfig?.key !== key) return <ArrowUpDown size={14} className="text-gray-400" />;
        return sortConfig.direction === "asc" ? <ArrowUp size={14} className="text-gray-800" /> : <ArrowDown size={14} className="text-gray-800" />;
    };

    // HELPER FORMAT TANGGAL TAMPILAN TABEL
    const formatDateTime = (isoString?: string) => {
        if (!isoString || isoString.startsWith("0001")) return "-";
        return isoString.replace("T", " ").substring(0, 19);
    };

    // MODAL OPENERS
    const openEditModal = (product: ProductData, type: ModalType) => {
        setSelectedProduct(product);
        setActiveModal(type);
        setOpenActionId(null);
        setAuthUsername("");
        setAuthPassword("");
        setShowPassword(false);

        if (type === "autoRilis") setFormValue(product.produksi_auto_rilis);
        if (type === "status") setFormValue(product.status);
        if (type === "mixingTank") setSelectedTanks((product.mixing_tanks || []).map(t => t.mixing_tank.id));
    };

    const handleTankCheckbox = (tankId: number) => {
        setSelectedTanks(prev =>
            prev.includes(tankId) ? prev.filter(id => id !== tankId) : [...prev, tankId]
        );
    };

    // SUBMIT ACTIONS KE GOLANG BACKEND
    const handleSubmitModal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProduct) return;
        setIsSubmitting(true);

        const token = Cookies.get("token");
        let endpoint = "";
        let payload: any = {};

        // Penyelarasan payload JSON dengan model struct Request di Golang
        if (activeModal === "autoRilis") {
            endpoint = `/api/v1/master/produk/auto-rilis/${selectedProduct.id}`;
            payload = {
                produksi_auto_rilis: formValue,
                confirm_username: authUsername,
                confirm_password: authPassword
            };
        } else if (activeModal === "mixingTank") {
            endpoint = `/api/v1/master/produk/sync-tank/${selectedProduct.id}`;
            payload = {
                mixing_tank_id: selectedTanks,
                confirm_username: authUsername,
                confirm_password: authPassword
            };
        } else if (activeModal === "status") {
            endpoint = `/api/v1/master/produk/status/${selectedProduct.id}`;
            payload = {
                status: formValue,
                confirm_username_status: authUsername,
                confirm_password_status: authPassword
            };
        }

        try {
            const res = await apiFetch(`${API_BASE_URL}${endpoint}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const result = await res.json();

            if (res.ok) {
                alert(result.meta?.message);
                setActiveModal(null);
                fetchData(); // Refresh data tabel
            } else {
                alert(result.meta?.message);
            }
        } catch (error) {
            console.error("Terjadi kesalahan saat menyimpan data produk:", error);
            alert("Terjadi kesalahan jaringan.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const getPaginationNumbers = () => {
        if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
        if (currentPage <= 5) return [1, 2, 3, 4, 5, 6, 7, "...", totalPages];
        if (currentPage >= totalPages - 3) return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        return [1, "...", currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2, "...", totalPages];
    };

    // Pembatasan akses UI bagi supervisor (Read-Only) 
    const isSupervisor = currentUserRole === "supervisor";

    return (
        <div className="w-full md:w-[95%] mx-auto bg-transparent min-h-[500px]">
            <div className="bg-white shadow-sm rounded-lg border border-gray-200">

                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-2xl font-semibold text-gray-800">
                        Daftar Produk dan Mixing Tank
                    </h2>
                </div>

                {/* Toolbar Filter & Cari */}
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
                            className="border border-gray-300 rounded p-2 text-black text-sm w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-[#c7d6ab]"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto min-h-[350px]">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="text-gray-700 bg-white border-b-2 border-gray-200">
                            <tr>
                                <th className="px-2 py-3 font-semibold border border-gray-200 w-16 text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSort("id")}>
                                    <div className="flex items-center justify-between gap-1 whitespace-nowrap">No {renderSortIcon("id")}</div>
                                </th>
                                <th className="px-2 py-3 font-semibold border border-gray-200 cursor-pointer hover:bg-gray-100" onClick={() => handleSort("kode_produk")}>
                                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">Kode Produk {renderSortIcon("kode_produk")}</div>
                                </th>
                                <th className="px-2 py-3 font-semibold border border-gray-200 cursor-pointer hover:bg-gray-100" onClick={() => handleSort("kategori")}>
                                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">Kategori {renderSortIcon("kategori")}</div>
                                </th>
                                <th className="px-2 py-3 font-semibold border border-gray-200 cursor-pointer hover:bg-gray-100" onClick={() => handleSort("produksi_auto_rilis")}>
                                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">Auto Rilis {renderSortIcon("produksi_auto_rilis")}</div>
                                </th>
                                <th className="px-2 py-3 font-semibold border border-gray-200 cursor-pointer hover:bg-gray-100" onClick={() => handleSort("mixing_tanks_str")}>
                                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">Mixing Tank {renderSortIcon("mixing_tanks_str")}</div>
                                </th>
                                <th className="px-2 py-3 font-semibold border border-gray-200 cursor-pointer hover:bg-gray-100" onClick={() => handleSort("status")}>
                                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">Status {renderSortIcon("status")}</div>
                                </th>
                                <th className="px-2 py-3 font-semibold border border-gray-200 text-center w-28">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="px-2 py-8 text-center text-gray-500 font-medium border border-gray-200 animate-pulse">
                                        Memuat data mesin compounding...
                                    </td>
                                </tr>
                            ) : currentData.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-2 py-8 text-center text-gray-500 italic border border-gray-200">
                                        Tidak ada data produk.
                                    </td>
                                </tr>
                            ) : (
                                currentData.map((item, index) => {
                                    const isBottomRow = index >= currentData.length - 2 && currentData.length > 2;

                                    // Mengadopsi logika pembalikan nomor dinamis saat sorting descending dari user-list
                                    const isNoDesc = sortConfig?.key === "id" && sortConfig?.direction === "desc";
                                    const rowNumber = isNoDesc ? filteredData.length - (startIndex + index) : startIndex + index + 1;

                                    return (
                                        <tr key={item.id} className="border border-gray-200 hover:bg-gray-100 transition">
                                            <td className="px-2 py-3 text-black text-center border border-gray-200">{rowNumber}</td>
                                            <td className="px-2 py-3 text-black font-medium border border-gray-200 whitespace-nowrap">{item.kode_produk}</td>
                                            <td className="px-2 py-3 text-black border border-gray-200 whitespace-nowrap">{item.kategori}</td>

                                            <td className="px-2 py-3 text-black border border-gray-200">
                                                <span className="font-bold">{item.produksi_auto_rilis}</span>
                                                <div className="text-gray-600 text-xs mt-0.5 whitespace-nowrap">
                                                    By: {item.updated_by || '-'} {new Date(item.update_time).toLocaleString('id-ID') && `(${new Date(item.update_time).toLocaleString('id-ID')})`}
                                                </div>
                                            </td>

                                            <td className="px-2 py-3 text-black border border-gray-200">
                                                <span className="font-bold">
                                                    {item.mixing_tanks && item.mixing_tanks.length > 0
                                                        ? item.mixing_tanks.map(t => `${t.mixing_tank.nama} (${t.mixing_tank.ruangan})`).join(', ')
                                                        : '-'}
                                                </span>
                                                {item.mixing_tanks && item.mixing_tanks.length > 0 && (
                                                    <div className="text-gray-600 text-xs mt-0.5">
                                                        {/* Mengambil riwayat update pivot dari array elemen pertama */}
                                                        Update: {item.mixing_tanks[0].update_by || '-'}
                                                        {new Date(item.mixing_tanks[0].update_time).toLocaleString('id-ID') && ` (${new Date(item.mixing_tanks[0].update_time).toLocaleString('id-ID')})`}
                                                    </div>
                                                )}
                                            </td>

                                            <td className="px-2 py-3 text-black border border-gray-200 capitalize whitespace-nowrap">
                                                {item.status === "delisting" ? "delisting" : ""}
                                            </td>

                                            <td className="px-0 py-0 text-center border border-gray-200 relative min-w-[120px]" ref={openActionId === item.id ? dropdownRef : null}>
                                                <button
                                                    onClick={() => setOpenActionId(openActionId === item.id ? null : item.id)}
                                                    disabled={isSupervisor}
                                                    className={`w-full h-full p-3 bg-transparent outline-none flex items-center justify-center gap-1 font-medium transition ${isSupervisor ? "text-gray-400 cursor-not-allowed" : "text-gray-700 hover:bg-gray-100 cursor-pointer"}`}
                                                >
                                                    Choose <ChevronDown size={14} className="text-gray-500" />
                                                </button>

                                                {openActionId === item.id && !isSupervisor && (
                                                    <div className={`absolute right-0 w-44 bg-white rounded shadow-xl border border-gray-200 z-50 text-left overflow-hidden ${isBottomRow ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
                                                        <button
                                                            className="w-full flex items-center gap-2 text-left px-4 py-2.5 text-sm hover:bg-gray-100 text-gray-700 transition cursor-pointer"
                                                            onClick={() => openEditModal(item, "autoRilis")}
                                                        >
                                                            Edit Auto Rilis
                                                        </button>
                                                        <button
                                                            className="w-full flex items-center gap-2 text-left px-4 py-2.5 text-sm hover:bg-gray-100 text-gray-700 transition cursor-pointer border-t border-gray-100"
                                                            onClick={() => openEditModal(item, "mixingTank")}
                                                        >
                                                            Edit Mixing Tank
                                                        </button>
                                                        <button
                                                            className="w-full flex items-center gap-2 text-left px-4 py-2.5 text-sm hover:bg-gray-100 text-gray-700 transition cursor-pointer border-t border-gray-100"
                                                            onClick={() => openEditModal(item, "status")}
                                                        >
                                                            Edit Status
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* PAGINATION FOOTER */}
                <div className="p-4 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center text-sm text-gray-600 bg-gray-50 rounded-b-lg gap-4">
                    <div>
                        Showing {filteredData.length === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + entriesPerPage, filteredData.length)} of {filteredData.length} entries
                    </div>

                    <div className="flex bg-white rounded border border-gray-300 overflow-hidden shadow-sm">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 border-r border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:bg-gray-50 cursor-pointer disabled:cursor-default"
                        >
                            <ChevronLeft size={16} />
                        </button>

                        {getPaginationNumbers().map((page, index) => (
                            page === "..." ? (
                                <span key={`dots-${index}`} className="px-3 py-1.5 border-r border-gray-300 text-gray-500 bg-gray-50 cursor-default">
                                    ...
                                </span>
                            ) : (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page as number)}
                                    className={`px-3 py-1.5 border-r border-gray-300 transition ${currentPage === page ? 'bg-[#eaf4ff] text-blue-600 font-medium' : 'hover:bg-gray-100 cursor-pointer'}`}
                                >
                                    {page}
                                </button>
                            )
                        ))}

                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1.5 hover:bg-gray-100 disabled:opacity-50 disabled:bg-gray-50 border-l-0 cursor-pointer disabled:cursor-default"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>

            </div>

            {/* ========================================== */}
            {/* MODAL POP-UP OTORISASI & DATA TERPADU */}
            {/* ========================================== */}
            {activeModal && selectedProduct && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-lg w-[500px] overflow-hidden flex flex-col max-h-[90vh]">

                        <div className="px-4 py-3 border-b flex justify-between items-center">
                            <h5 className="font-bold text-lg text-black">
                                {activeModal === "autoRilis" && `Ubah Auto Rilis - ${selectedProduct.kode_produk}`}
                                {activeModal === "mixingTank" && `Pilih Mixing Tank - ${selectedProduct.kode_produk}`}
                                {activeModal === "status" && `Ubah Status Produk - ${selectedProduct.kode_produk}`}
                            </h5>
                            <button type="button" onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-black font-bold text-xl leading-none">×</button>
                        </div>

                        <form onSubmit={handleSubmitModal} className="flex flex-col overflow-hidden">
                            <div className="p-4 space-y-4 overflow-y-auto">

                                {/* === 1. NOTIFIKASI/ALUR PERUBAHAN DATA (Style mirip Info Area di user-list) === */}
                                {activeModal === "autoRilis" && (
                                    <div className="bg-blue-50 border border-blue-100 text-blue-800 p-3 rounded text-sm">
                                        <p className="mb-2">Anda akan mengubah konfigurasi rilis otomatis produksi:</p>
                                        <div className="flex border border-gray-300 rounded overflow-hidden bg-white">
                                            <span className="bg-gray-50 px-3 py-2 text-gray-700 font-medium border-r border-gray-300 w-28 text-center shrink-0">Auto Rilis</span>
                                            <select
                                                value={formValue}
                                                onChange={(e) => setFormValue(e.target.value)}
                                                className="flex-1 px-3 py-2 text-black focus:outline-none cursor-pointer"
                                            >
                                                <option value="Ya">Ya</option>
                                                <option value="Tidak">Tidak</option>
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {activeModal === "status" && (
                                    <div className="bg-yellow-50 border border-yellow-100 text-yellow-800 p-3 rounded text-sm">
                                        <p className="mb-2">Atur ketersediaan status peluncuran produk di sistem:</p>
                                        <div className="flex border border-gray-300 rounded overflow-hidden bg-white">
                                            <span className="bg-gray-50 px-3 py-2 text-gray-700 font-medium border-r border-gray-300 w-28 text-center shrink-0">Status</span>
                                            <select
                                                value={formValue}
                                                onChange={(e) => setFormValue(e.target.value)}
                                                className="flex-1 px-3 py-2 text-black focus:outline-none cursor-pointer"
                                            >
                                                <option value="listing">Listing</option>
                                                <option value="delisting">Delisting</option>
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {activeModal === "mixingTank" && (
                                    <div className="bg-blue-50 border border-blue-100 text-blue-800 p-3 rounded text-sm">
                                        <p className="block font-medium text-gray-800 mb-2">Pilih Jembatan Relasi Mixing Tank:</p>
                                        <div className="border border-gray-200 rounded p-3 bg-white space-y-2 max-h-[160px] overflow-y-auto">
                                            {availableTanks.map(tank => (
                                                <label key={tank.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedTanks.includes(tank.id)}
                                                        onChange={() => handleTankCheckbox(tank.id)}
                                                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                                    />
                                                    <span className="text-sm text-black font-semibold">{tank.nama} ({tank.ruangan})</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* === 2. FORM OTORISASI MANUAL SESUAI SOP TINGKAT TINGGI GOLANG === */}
                                <div className="pt-2 border-t border-gray-100">
                                    <label className="block font-semibold text-sm text-gray-800 mb-3">
                                        Masukkan Kredensial untuk Verifikasi Audit Trail
                                    </label>
                                    <div className="space-y-3">
                                        <div className="flex border border-gray-300 rounded overflow-hidden shadow-sm">
                                            <span className="bg-gray-50 px-3 flex items-center text-gray-700 border-r border-gray-300 w-28 text-sm shrink-0 font-medium">Username</span>
                                            <input
                                                type="text" placeholder="Username Anda" required
                                                value={authUsername}
                                                onChange={e => setAuthUsername(e.target.value)}
                                                className="flex-1 px-3 py-2 text-sm text-black focus:outline-none focus:ring-1 focus:ring-[#c7d6ab]"
                                            />
                                        </div>
                                        <div className="flex border border-gray-300 rounded overflow-hidden shadow-sm relative">
                                            <span className="bg-gray-50 px-3 flex items-center text-gray-700 border-r border-gray-300 w-28 text-sm shrink-0 font-medium">Password</span>
                                            <input
                                                type={showPassword ? "text" : "password"} placeholder="Password Anda" required
                                                value={authPassword}
                                                onChange={e => setAuthPassword(e.target.value)}
                                                className="flex-1 px-3 py-2 text-sm text-black focus:outline-none focus:ring-1 focus:ring-[#c7d6ab] pr-10"
                                            />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                            </div>

                            {/* Footer Modal */}
                            <div className="px-4 py-3 border-t flex justify-end gap-2 bg-gray-50 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setActiveModal(null)}
                                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition text-sm cursor-pointer"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm cursor-pointer font-medium disabled:opacity-50"
                                >
                                    {isSubmitting ? "Menyimpan..." : "Konfirmasi"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}