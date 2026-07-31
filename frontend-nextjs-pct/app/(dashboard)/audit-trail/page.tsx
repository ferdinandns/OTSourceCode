"use client";

import { useState, useEffect } from "react";
import Cookies from "js-cookie";
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { AuditTrailData } from "@/types";
import { API_BASE_URL, apiFetch } from "@/lib/api";

type SortConfig = {
    key: keyof AuditTrailData;
    direction: "asc" | "desc";
} | null;

/**
 * Halaman Audit Trail (Log Aktivitas Pengguna).
 * 
 * **Konsep Arsitektural:**
 * - **Read-Only Ledger**: Halaman ini dirancang hanya untuk membaca (Read-only) data dari 
 *   API Audit Trail. Tidak ada fitur C/U/D (Create/Update/Delete) karena log bersifat *immutable* 
 *   di tingkat basis data dan *middleware* Go.
 * - **Lazy Data Transformation**: Data timestamp dari backend diformat secara asinkron (pada saat render) 
 *   menjadi format zona waktu lokal pengguna browser.
 */
export default function AuditTrailPage() {
    const [data, setData] = useState<AuditTrailData[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // State untuk Filter & Pencarian
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [appliedStartDate, setAppliedStartDate] = useState("");
    const [appliedEndDate, setAppliedEndDate] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    // State untuk Pagination & Sorting
    const [entriesPerPage, setEntriesPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);

    // Reset pagination ke halaman 1 jika search/filter berubah
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, entriesPerPage, appliedStartDate, appliedEndDate]);

    // Fetching Data API (Dijalankan awal dan setiap kali filter tanggal berubah)
    useEffect(() => {
        const fetchAuditTrail = async () => {
            setIsLoading(true);
            try {
                const token = Cookies.get("token");

                // Membangun URL beserta parameter query tanggal jika ada
                let url = `${API_BASE_URL}/api/v1/master/admin-audit-trail/`;
                const params = new URLSearchParams();

                if (appliedStartDate) params.append("start_date", appliedStartDate);
                if (appliedEndDate) params.append("end_date", appliedEndDate);

                if (params.toString()) {
                    url += `?${params.toString()}`;
                }

                const response = await apiFetch(url, {
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    }
                });

                const json = await response.json();

                if (response.ok && json.meta?.status === "success") {
                    setData(json.data || []);
                } else {
                    console.warn("Gagal menarik data dari server:", json.meta?.message);
                    setData([]);
                    alert(json.meta?.message || "Gagal memuat data audit trail.");
                }
            } catch (error) {
                console.error("Terjadi kesalahan jaringan:", error);
                setData([]);
                alert("Terjadi kesalahan jaringan saat memuat data audit trail.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchAuditTrail();
    }, [appliedStartDate, appliedEndDate]); // Trigger ulang saat filter tanggal diterapkan

    const handleDateSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setAppliedStartDate(startDate);
        setAppliedEndDate(endDate);
    };

    // 1. FILTERING (Hanya Kata Kunci, karena Tanggal difilter oleh Backend)
    const filteredData = data.filter(item => {
        let isValidSearch = true;

        // Filter Kata Kunci
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            isValidSearch =
                (item.nama || "").toLowerCase().includes(q) ||
                (item.tanggal || "").toLowerCase().includes(q) ||
                (item.jam || "").toLowerCase().includes(q) ||
                (item.area || "").toLowerCase().includes(q) ||
                (item.kegiatan || "").toLowerCase().includes(q) ||
                (item.alamat_ip || "").toLowerCase().includes(q);
        }

        return isValidSearch;
    });

    // 2. SORTING LOGIC
    const sortedData = [...filteredData].sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;

        const aValue = String(a[key] || "");
        const bValue = String(b[key] || "");

        return direction === "asc"
            ? aValue.localeCompare(bValue, undefined, { numeric: true })
            : bValue.localeCompare(aValue, undefined, { numeric: true });
    });

    // 3. PAGINATION LOGIC
    const totalPages = Math.max(1, Math.ceil(sortedData.length / entriesPerPage));
    const startIndex = (currentPage - 1) * entriesPerPage;
    const currentData = sortedData.slice(startIndex, startIndex + entriesPerPage);

    const handleSort = (key: keyof AuditTrailData) => {
        let direction: "asc" | "desc" = "asc";
        if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
            direction = "desc";
        }
        setSortConfig({ key, direction });
    };

    const getPaginationNumbers = () => {
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        if (currentPage <= 5) {
            return [1, 2, 3, 4, 5, 6, 7, "...", totalPages];
        }
        if (currentPage >= totalPages - 3) {
            return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        }
        return [1, "...", currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2, "...", totalPages];
    };

    const renderSortIcon = (key: keyof AuditTrailData) => {
        if (sortConfig?.key !== key) return <ArrowUpDown size={14} className="text-gray-400" />;
        return sortConfig.direction === "asc" ? <ArrowUp size={14} className="text-gray-800" /> : <ArrowDown size={14} className="text-gray-800" />;
    };

    // Helper Format Tanggal (Mengubah format T00:00:00Z menjadi DD/MM/YYYY)
    const formatDate = (dateString: string) => {
        if (!dateString) return "-";
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return dateString;
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    };

    if (isLoading) {
        return (
            <div className="w-full h-[calc(100vh-100px)] flex flex-col items-center justify-center bg-transparent">
                <div className="w-12 h-12 border-4 border-[#eaf4d5] border-t-[#8cc63f] rounded-full animate-spin"></div>
                <p className="mt-4 text-[#104c97] font-bold animate-pulse tracking-wide">
                    Memuat Log Aktivitas...
                </p>
            </div>
        );
    }

    return (
        <div className="w-full md:w-[95%] mx-auto bg-transparent min-h-125">

            <div className="mb-4">
                <h2 className="text-3xl font-semibold text-gray-800">Audit Trail</h2>
                <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                    <span>Log Activity</span>
                </div>
            </div>

            <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">

                {/* Date Range Filter Form */}
                <div className="p-4 border-b border-gray-100">
                    <form onSubmit={handleDateSearch} className="flex flex-wrap items-end gap-4">
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Start Date</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="border border-gray-300 rounded p-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#c7d6ab]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">End Date</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="border border-gray-300 rounded p-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#c7d6ab]"
                            />
                        </div>
                        <button
                            type="submit"
                            className="bg-[#c7d6ab] hover:bg-[#b3c494] text-gray-800 px-6 py-2 rounded text-sm font-medium transition cursor-pointer"
                        >
                            Search
                        </button>

                        {(appliedStartDate || appliedEndDate) && (
                            <button
                                type="button"
                                onClick={() => {
                                    setStartDate(""); setEndDate(""); setAppliedStartDate(""); setAppliedEndDate("");
                                }}
                                className="text-sm text-red-500 hover:text-red-700 font-medium ml-2 transition cursor-pointer"
                            >
                                Clear Filter
                            </button>
                        )}
                    </form>
                </div>

                {/* Entries & Search Keyword */}
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

                {/* Tabel */}
                <div className="overflow-x-auto min-h-87.5">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="text-gray-700 bg-white border-b-2 border-gray-200">
                            <tr>
                                <th className="px-4 py-3 font-semibold border border-gray-200 w-16 text-center cursor-pointer hover:bg-gray-50" onClick={() => handleSort("id" as keyof AuditTrailData)}>
                                    <div className="flex items-center justify-between gap-1 whitespace-nowrap">No {renderSortIcon("id" as keyof AuditTrailData)}</div>
                                </th>
                                <th className="px-4 py-3 font-semibold border border-gray-200 cursor-pointer hover:bg-gray-50" onClick={() => handleSort("tanggal")}>
                                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">Date {renderSortIcon("tanggal")}</div>
                                </th>
                                <th className="px-4 py-3 font-semibold border border-gray-200 cursor-pointer hover:bg-gray-50" onClick={() => handleSort("jam")}>
                                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">Time {renderSortIcon("jam")}</div>
                                </th>
                                <th className="px-4 py-3 font-semibold border border-gray-200 cursor-pointer hover:bg-gray-50" onClick={() => handleSort("alamat_ip")}>
                                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">IP Address {renderSortIcon("alamat_ip")}</div>
                                </th>
                                <th className="px-4 py-3 font-semibold border border-gray-200 cursor-pointer hover:bg-gray-50" onClick={() => handleSort("nama")}>
                                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">Name {renderSortIcon("nama")}</div>
                                </th>
                                <th className="px-4 py-3 font-semibold border border-gray-200 cursor-pointer hover:bg-gray-50" onClick={() => handleSort("area")}>
                                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">Area {renderSortIcon("area")}</div>
                                </th>
                                <th className="px-4 py-3 font-semibold border border-gray-200 cursor-pointer hover:bg-gray-50" onClick={() => handleSort("kegiatan")}>
                                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">Activity {renderSortIcon("kegiatan")}</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentData.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500 italic border border-gray-200">
                                        Tidak ada log aktivitas ditemukan.
                                    </td>
                                </tr>
                            ) : (
                                currentData.map((item, index) => {
                                    const isNoDesc = sortConfig?.key === "id" && sortConfig?.direction === "desc";
                                    const rowNumber = isNoDesc ? filteredData.length - (startIndex + index) : startIndex + index + 1;
                                    return (
                                        <tr key={item.id} className="border border-gray-200 hover:bg-gray-50 transition text-gray-800">
                                            <td className="px-4 py-3 text-center border border-gray-200">{rowNumber}</td>
                                            <td className="px-4 py-3 border border-gray-200 whitespace-nowrap">{formatDate(item.tanggal)}</td>
                                            <td className="px-4 py-3 border border-gray-200 whitespace-nowrap">{item.jam}</td>
                                            <td className="px-4 py-3 border border-gray-200 whitespace-nowrap">{item.alamat_ip}</td>
                                            <td className="px-4 py-3 border border-gray-200 whitespace-nowrap">{item.nama}</td>
                                            <td className="px-4 py-3 border border-gray-200 whitespace-nowrap">{item.area}</td>
                                            <td className="px-4 py-3 border border-gray-200">{item.kegiatan}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
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
                            className="px-3 py-1.5 hover:bg-gray-100 disabled:opacity-50 disabled:bg-gray-50 cursor-pointer border-l-0 cursor-pointer disabled:cursor-default"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}