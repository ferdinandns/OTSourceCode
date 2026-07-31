// src/app/(dashboard)/user-list/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import {
    Eye, EyeOff, UserPlus, ChevronDown, ChevronLeft, ChevronRight,
    PencilLine, KeyRound, Trash2, ArrowUpDown, ArrowUp, ArrowDown
} from "lucide-react";
import { UserAccountData } from "@/types";
import { API_BASE_URL, apiFetch } from "@/lib/api";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";

const detailAreaOptions: Record<string, string[]> = {
    "PPIC": ["Administrator", "PPIC Site"],
    "Quality Control": ["Administrator", "Manager", "Analis"],
    "Quality Assurance": ["Administrator", "QA BR"],
    "Warehouse": ["Administrator", "WH WG Admin", "WH OMC Admin", "WH OMC Operator", "Penimbangan"],
    "Production": ["Administrator", "Manager", "Supervisor", "Op Compounding", "Admin BR"],
    "DEFAULT": ["A"]
};

const getDetailAreaFromLevel = (level: string) => {
    if (!level) return "";
    const lowerLevel = level.toLowerCase();

    if (lowerLevel === "analis") return "Analis/Inspektor";

    const allOptions = Object.values(detailAreaOptions).flat();
    const match = allOptions.find(opt => opt.toLowerCase() === lowerLevel);

    if (match) return match;

    return level.charAt(0).toUpperCase() + level.slice(1);
};

type SortConfig = {
    key: keyof UserAccountData;
    direction: "asc" | "desc";
} | null;

type AuthActionType =
    | { type: "CHANGE_AREA"; user: UserAccountData; oldArea: string; newArea: string }
    | { type: "DELETE_USER"; user: UserAccountData }
    | { type: "RESET_PASSWORD"; user: UserAccountData };

/**
 * Halaman Manajemen Pengguna (User List).
 * 
 * **Konsep Arsitektural:**
 * - **Routing Integration**: Berbeda dengan *ProductPage* yang menggunakan Modal, halaman ini menggunakan 
 *   fitur *routing Next.js* (`router.push`) untuk menavigasi pengguna ke halaman spesifik 
 *   (`add/page.tsx` atau `edit/[id]/page.tsx`) saat ingin melakukan mutasi data.
 * - **Authorization Check**: Secara arsitektural, halaman ini memvalidasi token JWT pengguna. Jika bukan 
 *   Admin atau Super Admin, backend akan menolak, dan UI akan menangani respons tersebut dengan 
 *   mengeluarkan pengguna (logout) atau menampilkan *Access Denied*.
 */
export default function UserListPage() {
    const router = useRouter();
    const [currentUserRole, setCurrentUserRole] = useState("");
    const [currentUserDept, setCurrentUserDept] = useState("");

    const [users, setUsers] = useState<UserAccountData[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [searchQuery, setSearchQuery] = useState("");
    const [entriesPerPage, setEntriesPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);

    const [openActionId, setOpenActionId] = useState<number | null>(null);
    const [actionMenuPos, setActionMenuPos] = useState<{ top: number; left: number; openUpward: boolean } | null>(null);

    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [authAction, setAuthAction] = useState<AuthActionType | null>(null);

    // STATE BARU: Untuk menyimpan input otorisasi pada modal CHANGE_AREA
    const [authUsername, setAuthUsername] = useState("");
    const [authPassword, setAuthPassword] = useState("");

    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const role = (Cookies.get("level") || "").toLowerCase();
        const dept = Cookies.get("area") || "";
        const allowedRoles = ["administrator", "manager", "supervisor"];
        if (!allowedRoles.includes(role)) {
            router.replace("/home");
        }
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
        if (openActionId === null) return;
        const closeOnScrollOrResize = () => setOpenActionId(null);
        window.addEventListener("scroll", closeOnScrollOrResize, true);
        window.addEventListener("resize", closeOnScrollOrResize);
        return () => {
            window.removeEventListener("scroll", closeOnScrollOrResize, true);
            window.removeEventListener("resize", closeOnScrollOrResize);
        };
    }, [openActionId]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, entriesPerPage]);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const token = Cookies.get("token");
            const role = (Cookies.get("level") || "").toLowerCase();
            const dept = Cookies.get("area") || "";

            const res = await apiFetch(`${API_BASE_URL}/api/v1/master/users/`, {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });

            if (res.ok) {
                const json = await res.json();
                let rawData = json.data || [];

                if (role !== "administrator") {
                    rawData = rawData.filter((u: any) => u.area === dept);
                }

                const formattedData: UserAccountData[] = rawData.map((u: any) => {
                    const rawDate = u.created_date && !u.created_date.startsWith("0001")
                        ? u.created_date.replace("T", " ").substring(0, 19)
                        : "-";

                    return {
                        id: u.id,
                        created_date: rawDate,
                        nik: u.nik || "-",
                        name: u.nama || "-",
                        username: u.username || "-",
                        department: u.area || "-",
                        level: u.level || "-",
                        status: u.status_akun || "active",
                        detail_area: getDetailAreaFromLevel(u.detail_area)
                    };
                });
                setUsers(formattedData);
            }
        } catch (error) {
            console.error("Terjadi kesalahan saat memuat data user:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const filteredUsers = users.filter(u =>
        (u.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.username || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.department || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.detail_area || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.level || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.nik || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    const sortedUsers = [...filteredUsers].sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;

        const aValue = String(a[key] || "");
        const bValue = String(b[key] || "");

        return direction === "asc"
            ? aValue.localeCompare(bValue, undefined, { numeric: true })
            : bValue.localeCompare(aValue, undefined, { numeric: true });
    });

    const totalPages = Math.max(1, Math.ceil(sortedUsers.length / entriesPerPage));
    const startIndex = (currentPage - 1) * entriesPerPage;
    const currentUsers = sortedUsers.slice(startIndex, startIndex + entriesPerPage);

    const handleSort = (key: keyof UserAccountData) => {
        let direction: "asc" | "desc" = "asc";
        if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
            direction = "desc";
        }
        setSortConfig({ key, direction });
    };

    const renderSortIcon = (key: keyof UserAccountData) => {
        if (sortConfig?.key !== key) return <ArrowUpDown size={14} className="text-gray-400" />;
        return sortConfig.direction === "asc" ? <ArrowUp size={14} className="text-gray-800" /> : <ArrowDown size={14} className="text-gray-800" />;
    };

    const handleDetailAreaChange = (user: UserAccountData, newArea: string) => {
        setAuthAction({
            type: "CHANGE_AREA",
            user,
            oldArea: user.detail_area || "Belum diatur",
            newArea
        });
        setAuthUsername(""); // Reset form username
        setAuthPassword(""); // Reset form password
        setIsAuthModalOpen(true);
        setShowPassword(false);
    };

    const handleDeleteClick = (user: UserAccountData) => {
        setAuthAction({ type: "DELETE_USER", user });
        setIsAuthModalOpen(true);
        setShowPassword(false);
        setOpenActionId(null);
    };

    const handleResetClick = (user: UserAccountData) => {
        setAuthAction({ type: "RESET_PASSWORD", user });
        setIsAuthModalOpen(true);
        setShowPassword(false);
        setOpenActionId(null);
    };

    // Fungsi Submit Otorisasi & Integrasi API Backend
    const submitAuthAction = async () => {
        if (!authAction) return;
        const token = Cookies.get("token");

        try {
            if (authAction.type === "DELETE_USER") {
                const res = await apiFetch(`${API_BASE_URL}/api/v1/master/users/${authAction.user.id}`, {
                    method: "DELETE",
                    headers: {
                        "Authorization": `Bearer ${token}`
                    }
                });
                const result = await res.json();

                if (!res.ok) throw new Error(result.meta?.message || "Gagal menghapus user.");
                alert(result.meta?.message || "Berhasil menghapus data user!");
                fetchUsers();

            } else if (authAction.type === "RESET_PASSWORD") {
                const res = await apiFetch(`${API_BASE_URL}/api/v1/master/users/reset-password/${authAction.user.id}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({})
                });
                const result = await res.json();

                if (!res.ok) throw new Error(result.meta?.message || "Gagal mereset password.");
                alert(result.meta?.message || "Password berhasil direset!");

                if (result.data?.force_logout) {
                    Cookies.remove("token");
                    Cookies.remove("level");
                    Cookies.remove("area");
                    router.push("/login");
                    return;
                }
            } else if (authAction.type === "CHANGE_AREA") {
                const res = await apiFetch(`${API_BASE_URL}/api/v1/master/users/update-detail-area/${authAction.user.id}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        username: authUsername,
                        password: authPassword,
                        detail_area: authAction.newArea, 
                    })
                });
                const result = await res.json();

                if (!res.ok) throw new Error(result.meta?.message || "Gagal mengubah detail area.");
                alert(result.meta?.message);
                fetchUsers(); // Refresh tabel data
            }
        } catch (error: any) {
            alert(error.message);
        } finally {
            setIsAuthModalOpen(false);
            setAuthAction(null);
        }
    };

    const pageTitle = currentUserRole === "administrator"
        ? "User Account List"
        : `User List Account (${currentUserDept})`;

    const canAddAccount = ["administrator", "manager", "supervisor"].includes(currentUserRole);
    const currentAreaOptions = detailAreaOptions[currentUserDept] || detailAreaOptions["DEFAULT"];

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

    return (
        <div className="w-full md:w-[95%] mx-auto bg-transparent min-h-[500px]">
            <div className="bg-white shadow-sm rounded-lg border border-gray-200">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-2xl font-semibold text-gray-800">{pageTitle}</h2>
                    {canAddAccount && (
                        <button
                            onClick={() => router.push("/user-list/add")}
                            className="mt-4 bg-[#c7d6ab] hover:bg-[#b3c494] text-gray-800 px-2 py-2 rounded text-sm font-medium flex items-center gap-2 transition cursor-pointer">
                            <UserPlus size={16} /> Add Account
                        </button>
                    )}
                </div>

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
                                <th className="px-2 py-3 font-semibold border border-gray-200 cursor-pointer hover:bg-gray-100" onClick={() => handleSort("created_date")}>
                                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">Created Date {renderSortIcon("created_date")}</div>
                                </th>
                                <th className="px-2 py-3 font-semibold border border-gray-200 cursor-pointer hover:bg-gray-100" onClick={() => handleSort("nik")}>
                                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">NIK {renderSortIcon("nik")}</div>
                                </th>
                                <th className="px-2 py-3 font-semibold border border-gray-200 cursor-pointer hover:bg-gray-100" onClick={() => handleSort("name")}>
                                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">{currentUserRole === "administrator" ? "Name" : "Nama"} {renderSortIcon("name")}</div>
                                </th>
                                <th className="px-2 py-3 font-semibold border border-gray-200 cursor-pointer hover:bg-gray-100" onClick={() => handleSort("username")}>
                                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">Username {renderSortIcon("username")}</div>
                                </th>

                                {currentUserRole === "administrator" ? (
                                    <>
                                        <th className="px-2 py-3 font-semibold border border-gray-200 cursor-pointer hover:bg-gray-100" onClick={() => handleSort("department")}>
                                            <div className="flex items-center justify-between gap-2 whitespace-nowrap">Department {renderSortIcon("department")}</div>
                                        </th>
                                        <th className="px-2 py-3 font-semibold border border-gray-200 cursor-pointer hover:bg-gray-100" onClick={() => handleSort("level")}>
                                            <div className="flex items-center justify-between gap-2 whitespace-nowrap">Level {renderSortIcon("level")}</div>
                                        </th>
                                        <th className="px-2 py-3 font-semibold border border-gray-200 cursor-pointer hover:bg-gray-100" onClick={() => handleSort("status")}>
                                            <div className="flex items-center justify-between gap-2 whitespace-nowrap">Status {renderSortIcon("status")}</div>
                                        </th>
                                    </>
                                ) : (
                                    <th className="px-2 py-3 font-semibold border border-gray-200 text-center whitespace-nowrap">Detail Area</th>
                                )}

                                <th className="px-2 py-3 font-semibold border border-gray-200 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={currentUserRole === "administrator" ? 9 : 7} className="px-2 py-8 text-center text-gray-500 italic border border-gray-200">
                                        Tidak ada data user.
                                    </td>
                                </tr>
                            ) : (
                                currentUsers.map((user, index) => {
                                    const dropdownOptions = Array.from(new Set([...currentAreaOptions, user.detail_area])).filter(Boolean);

                                    const isNoDesc = sortConfig?.key === "id" && sortConfig?.direction === "desc";
                                    const rowNumber = isNoDesc ? filteredUsers.length - (startIndex + index) : startIndex + index + 1;

                                    return (
                                        <tr key={`${user.id}-${index}`} className="border border-gray-200 hover:bg-gray-100 transition">
                                            <td className="px-2 py-3 text-black text-center border border-gray-200">{rowNumber}</td>
                                            <td className="px-2 py-3 text-black border border-gray-200 whitespace-nowrap">{user.created_date}</td>
                                            <td className="px-2 py-3 text-black border border-gray-200 whitespace-nowrap">{user.nik}</td>
                                            <td className="px-2 py-3 text-black border border-gray-200 whitespace-nowrap">{user.name}</td>
                                            <td className="px-2 py-3 text-black border border-gray-200 whitespace-nowrap">{user.username}</td>

                                            {currentUserRole === "administrator" ? (
                                                <>
                                                    <td className="px-2 py-3 text-black border border-gray-200 whitespace-nowrap">{user.department}</td>
                                                    <td className="px-2 py-3 text-black border border-gray-200 whitespace-nowrap">{user.level}</td>
                                                    <td className="px-2 py-3 border border-gray-200 capitalize whitespace-nowrap">
                                                        <span className={user.status === "active" ? "text-black" : "text-gray-400 italic"}>
                                                            {user.status || "active"}
                                                        </span>
                                                    </td>
                                                </>
                                            ) : (
                                                <td className="px-0 py-0 border border-gray-200 bg-transparent text-black text-center font-bold relative min-w-[150px]">
                                                    <select
                                                        value={user.detail_area || ""}
                                                        onChange={(e) => handleDetailAreaChange(user, e.target.value)}
                                                        disabled={currentUserRole === "supervisor"}
                                                        className={`w-full h-full p-3 bg-transparent outline-none text-center appearance-none ${currentUserRole === "supervisor" ? "cursor-not-allowed text-gray-500" : "cursor-pointer text-black"}`}
                                                    >
                                                        <option value="" disabled>Pilih Area</option>
                                                        {dropdownOptions.map(opt => (
                                                            <option key={opt} value={opt}>{opt}</option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                                                </td>
                                            )}

                                            <td className="px-0 py-0 text-center border border-gray-200 relative min-w-[120px]" ref={openActionId === user.id ? dropdownRef : null}>
                                                <button
                                                    onClick={(e) => {
                                                        if (openActionId === user.id) {
                                                            setOpenActionId(null);
                                                            setActionMenuPos(null);
                                                            return;
                                                        }
                                                        const MENU_WIDTH = 176;
                                                        const MENU_HEIGHT = 130;
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        const spaceBelow = window.innerHeight - rect.bottom;
                                                        const openUpward = spaceBelow < MENU_HEIGHT;

                                                        setActionMenuPos({
                                                            top: openUpward ? rect.top - MENU_HEIGHT - 4 : rect.bottom + 4,
                                                            left: Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8),
                                                            openUpward
                                                        });
                                                        setOpenActionId(user.id);
                                                    }}
                                                    disabled={currentUserRole === "supervisor"}
                                                    className={`w-full h-full p-3 bg-transparent outline-none flex items-center justify-center gap-1 font-medium transition ${currentUserRole === "supervisor" ? "text-gray-400 cursor-not-allowed" : "text-gray-700 hover:bg-gray-100 cursor-pointer"}`}
                                                >
                                                    Choose <ChevronDown size={14} className="text-gray-500" />
                                                </button>

                                                {openActionId === user.id && currentUserRole !== "supervisor" && actionMenuPos && (
                                                    <div
                                                        style={{ position: "fixed", top: actionMenuPos.top, left: actionMenuPos.left }}
                                                        className="w-44 bg-white rounded shadow-xl border border-gray-200 z-50 text-left overflow-hidden"
                                                    >
                                                        <button
                                                            className="w-full flex items-center gap-3 text-left px-2 py-2.5 text-sm hover:bg-gray-100 text-gray-700 transition cursor-pointer"
                                                            onClick={() => {
                                                                setOpenActionId(null);
                                                                router.push(`/user-list/edit/${user.id}`);
                                                            }}
                                                        >
                                                            <PencilLine size={16} /> Edit
                                                        </button>
                                                        <button
                                                            className="w-full flex items-center gap-3 text-left px-2 py-2.5 text-sm hover:bg-gray-100 text-gray-700 transition cursor-pointer"
                                                            onClick={() => handleResetClick(user)}
                                                        >
                                                            <KeyRound size={16} /> Reset Password
                                                        </button>
                                                        <button
                                                            className="w-full flex items-center gap-3 text-left px-2 py-2.5 text-sm hover:bg-red-50 text-red-600 transition cursor-pointer"
                                                            onClick={() => handleDeleteClick(user)}
                                                        >
                                                            <Trash2 size={16} /> Delete
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

                <div className="p-4 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center text-sm text-gray-600 bg-gray-50 rounded-b-lg gap-4">
                    <div>
                        Showing {filteredUsers.length === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + entriesPerPage, filteredUsers.length)} of {filteredUsers.length} entries
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
                            className="px-3 py-1.5 hover:bg-gray-100 disabled:opacity-50 disabled:bg-gray-50 cursor-pointer border-l-0 disabled:cursor-default"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* MODAL OTORISASI & KONFIRMASI TERPADU */}
            {isAuthModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-lg w-[500px] overflow-hidden">
                        <div className="px-4 py-3 border-b flex justify-between items-center">
                            <h5 className="font-bold text-lg text-black">
                                {authAction?.type === "DELETE_USER" && "Konfirmasi Hapus Akun"}
                                {authAction?.type === "RESET_PASSWORD" && "Konfirmasi Reset Password"}
                                {authAction?.type === "CHANGE_AREA" && "Otorisasi Perubahan Area"}
                            </h5>
                            <button onClick={() => setIsAuthModalOpen(false)} className="text-gray-400 hover:text-black font-bold text-xl leading-none">×</button>
                        </div>

                        <div className="p-4 space-y-4">

                            {authAction?.type === "CHANGE_AREA" && (
                                <div className="bg-blue-50 border border-blue-100 text-blue-800 p-3 rounded text-sm">
                                    <p className="mb-2">Anda akan mengubah Detail Area untuk pengguna berikut:</p>
                                    <ul className="space-y-1 ml-2 font-medium">
                                        <li>Nama : <span className="font-bold">{authAction.user.name}</span></li>
                                        <li>Area Sebelumnya : <span className="font-bold text-gray-500 line-through">{authAction.oldArea}</span></li>
                                        <li>Area Baru : <span className="font-bold text-green-600">{authAction.newArea}</span></li>
                                    </ul>
                                    <p className="mt-3 text-xs italic">Silakan masukkan kredensial Anda untuk menyetujui perubahan ini.</p>
                                </div>
                            )}

                            {authAction?.type === "DELETE_USER" && (
                                <div className="bg-red-50 border border-red-100 text-red-800 p-3 rounded text-sm">
                                    <p className="mb-1">Apakah Anda yakin ingin menonaktifkan akun ini secara permanen?</p>
                                    <ul className="space-y-1 ml-2 font-medium">
                                        <li>Nama : <span className="font-bold">{authAction.user.name}</span></li>
                                        <li>Username : <span className="font-bold">{authAction.user.username}</span></li>
                                    </ul>
                                </div>
                            )}

                            {authAction?.type === "RESET_PASSWORD" && (
                                <div className="bg-yellow-50 border border-yellow-100 text-yellow-800 p-3 rounded text-sm">
                                    <p className="mb-1">Apakah Anda yakin ingin mereset password pengguna berikut ke pengaturan default?</p>
                                    <ul className="space-y-1 ml-2 font-medium">
                                        <li>Nama : <span className="font-bold">{authAction.user.name}</span></li>
                                        <li>Username : <span className="font-bold">{authAction.user.username}</span></li>
                                    </ul>
                                </div>
                            )}

                            {/* Form input login hanya dirender saat aksi CHANGE_AREA */}
                            {authAction?.type === "CHANGE_AREA" && (
                                <>
                                    <input
                                        type="text"
                                        placeholder="Username Anda"
                                        required
                                        value={authUsername}
                                        onChange={(e) => setAuthUsername(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 text-black rounded focus:outline-none focus:ring-1 focus:ring-[#c7d6ab]"
                                    />

                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Password Anda"
                                            required
                                            value={authPassword}
                                            onChange={(e) => setAuthPassword(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 text-black rounded focus:outline-none focus:ring-1 focus:ring-[#c7d6ab] pr-10"
                                        />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700">
                                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="px-4 py-3 border-t flex justify-end gap-2 bg-gray-50">
                            <button onClick={() => setIsAuthModalOpen(false)} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition cursor-pointer">Batal</button>
                            <button
                                onClick={submitAuthAction}
                                className={`px-4 py-2 text-white rounded transition cursor-pointer font-medium ${authAction?.type === "DELETE_USER"
                                    ? "bg-red-600 hover:bg-red-700"
                                    : authAction?.type === "RESET_PASSWORD"
                                        ? "bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                                        : "bg-blue-600 hover:bg-blue-700"
                                    }`}
                            >
                                Konfirmasi
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}