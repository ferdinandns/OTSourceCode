"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSort } from "@/hooks/useSort";
import { apiFetch, API_BASE } from "@/lib/api";
import TransactionModal from "@/components/TransactionStatusModal"

type User = {
  id: number;
  nik: string;
  name: string;
  email: string;
  department_name: string;
  roles: string[];
  is_supervisor: boolean;
  is_active: boolean;
};

type Department = {
  id: number;
  code: string;
  name: string;
};

type ApiResponse = {
  success: boolean;
  data: {
    data: User[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  };
};

export default function MasterUserContent() {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedDept, setSelectedDept] = useState("");

  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSuccess, setModalSuccess] = useState<boolean | null>(null);
  const [modalMessage, setModalMessage] = useState("");

  const { sortBy, sortOrder, handleSort } = useSort("name", "asc");

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const response = await apiFetch(`${API_BASE}/departments`);
        const result = await response.json();
        if (result.success) setDepartments(result.data);
      } catch (error) {
        console.error("Gagal mengambil data departemen:", error);
      }
    };
    fetchDepartments();
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: page.toString() });
        if (searchQuery) params.append("search", searchQuery);
        if (selectedRole) params.append("role", selectedRole);
        if (selectedDept) params.append("department_id", selectedDept);

        params.append("sort_by", sortBy);
        params.append("sort_order", sortOrder);

        const response = await apiFetch(`${API_BASE}/users?${params.toString()}`, {
            method: "GET",
        });

        const result: ApiResponse = await response.json();

        if (result.success) {
          setUsers(result.data.data);
          setTotal(result.data.total);
          setTotalPages(result.data.total_pages);
        } else {
          setUsers([]);
        }
      } catch (error) {
        console.error("Gagal mengambil data user:", error);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      fetchUsers();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [page, searchQuery, selectedRole, selectedDept, refreshTrigger, sortBy, sortOrder]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRole(e.target.value);
    setPage(1);
  };

  const handleDeptChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDept(e.target.value);
    setPage(1);
  };

  const onSortColumnClick = (columnKey: string) => {
    handleSort(columnKey, () => setPage(1));
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const response = await apiFetch(`${API_BASE}/users/${userToDelete.id}`, {
          method: "DELETE",
      });
      const result = await response.json();
      const success = !!result.success;
      const message = result.message || (success ? "Berhasil mengubah data user." : "Gagal mengubah data user");
      setUserToDelete(null); 
      setModalSuccess(success);
      setModalMessage(message);
      setModalOpen(true);
      setTimeout(() => {
        setModalOpen(false);
        setRefreshTrigger(prev => prev + 1);
        setUserToDelete(null);
      }, 3000);
    } catch (error) {
      setUserToDelete(null); 
      setModalSuccess(false);
      setModalMessage("Terjadi kesalahan pada server.");
      setModalOpen(true);
      setTimeout(() => {
        setModalOpen(false);
      })
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  const SortIndicator = ({ columnKey }: { columnKey: string }) => {
    if (sortBy !== columnKey) {
      return (
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="w-4 h-4 ml-1.5 text-slate-300 group-hover:text-slate-400 transition-colors duration-200" 
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="m7 15 5 5 5-5"/>
          <path d="m7 9 5-5 5 5"/>
        </svg>
      );
    }

    if (sortOrder === "asc") {
      return (
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="w-4 h-4 ml-1.5 text-blue-600 transition-all duration-200" 
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="m5 12 7-7 7 7"/>
          <path d="M12 19V5"/>
        </svg>
      );
    }

    return (
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className="w-4 h-4 ml-1.5 text-blue-600 transition-all duration-200" 
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      >
        <path d="M12 5v14"/>
        <path d="m19 12-7 7-7-7"/>
      </svg>
    );
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role.toLowerCase()) {
      case "admin": return "bg-blue-100 text-blue-700 border-blue-200";
      case "qs": return "bg-purple-100 text-purple-700 border-purple-200";
      case "checker": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "pic_responsibility": return "bg-amber-100 text-amber-700 border-amber-200";
      default: return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  };

  const formatRoleName = (role: string) => {
    return role.replace("_", " ").toUpperCase();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 w-full relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm mb-5 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
            Master User
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            <span className="font-semibold text-slate-700">{total}</span> pengguna terdaftar di sistem.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Link 
            href="/dashboard/user/add" 
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Tambah Pengguna
          </Link>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg bg-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow shadow-sm"
            placeholder="Cari NIK, nama, atau email..."
          />
        </div>
        <select value={selectedDept} onChange={handleDeptChange} className="block w-full md:w-56 px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm">
          <option value="">Semua Departemen</option>
          {departments.map((dep) => <option key={dep.id} value={dep.id}>{dep.code} - {dep.name}</option>)}
        </select>
        <select value={selectedRole} onChange={handleRoleChange} className="block w-full md:w-48 px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm">
          <option value="">Semua Role</option>
          <option value="admin">Admin</option>
          <option value="qs">QS</option>
          <option value="checker">Checker</option>
          <option value="pic_responsibility">PIC Responsibility</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[800px] md:min-w-full w-full text-left">
            <thead>
              <tr className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                <th 
                  className="py-3 md:py-5 px-3 md:px-6 cursor-pointer"
                  onClick={() => onSortColumnClick("name")}
                >
                  <div className="flex items-center">
                    Pengguna <SortIndicator columnKey="name" />
                  </div>
                </th>
                <th className="py-3 md:py-5 px-3 md:px-4">
                  Role
                </th>
                <th 
                  className="py-3 md:py-5 px-3 md:px-4 cursor-pointer"
                  onClick={() => onSortColumnClick("department")}
                >
                  <div className="flex items-center">
                    Departemen <SortIndicator columnKey="department" />
                  </div>
                </th>
                <th className="py-3 md:py-5 px-3 md:px-4">
                  Status
                </th>
                <th className="py-3 md:py-5 px-3 md:px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="py-10 text-center text-xs md:text-sm font-bold text-gray-400 animate-pulse">Memuat data...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-xs md:text-sm font-bold text-gray-400">Tidak ada data pengguna yang cocok.</td></tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 md:py-5 px-3 md:px-6">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 h-9 w-9 md:h-10 md:w-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 text-blue-700 font-bold text-xs md:text-sm">
                          {getInitials(user.name)}
                        </div>
                        <div>
                          <div className="text-xs md:text-sm font-bold text-gray-900 flex items-center gap-1.5">
                            {user.name}
                            {user.is_supervisor && (
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>
                            )}
                          </div>
                          <div className="text-[10px] md:text-xs text-gray-400 mt-0.5">{user.email} • {user.nik || "-"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 md:py-5 px-3 md:px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {user.roles.map((role) => (
                          <span key={role} className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] md:text-[10px] font-black uppercase tracking-wider border ${getRoleBadgeStyle(role)}`}>
                            {formatRoleName(role)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 md:py-5 px-3 md:px-4">
                      <span className="text-xs md:text-sm font-bold text-gray-700">{user.department_name}</span>
                    </td>
                    <td className="py-3 md:py-5 px-3 md:px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-wider ${user.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? "bg-emerald-500" : "bg-gray-400"}`}></span>
                        {user.is_active ? "Aktif" : "Non-aktif"}
                      </span>
                    </td>
                    <td className="py-3 md:py-5 px-3 md:px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/dashboard/user/edit/${user.id}`} className="text-gray-400 hover:text-blue-600 transition-colors p-1.5 rounded-md hover:bg-blue-50">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                        </Link>
                        <button 
                          onClick={() => setUserToDelete(user)} 
                          className="text-gray-400 hover:text-red-600 transition-colors p-1.5 rounded-md hover:bg-red-50"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-center text-slate-900 mb-2">Nonaktifkan Pengguna?</h3>
              <p className="text-sm text-center text-slate-500 mb-6 leading-relaxed">
                Anda yakin ingin menghapus/menonaktifkan pengguna <span className="font-bold text-slate-800">{userToDelete.name}</span>? 
                Tindakan ini mungkin membatasi akses mereka ke dalam sistem Emertrack.
              </p>
              
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setUserToDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button 
                  type="button"
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {isDeleting ? (
                     <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : "Ya, Hapus"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <TransactionModal
              isOpen={modalOpen}
              onClose={handleCloseModal}
              success={modalSuccess}
              message={modalMessage}
      />
    </div>
  );
}
