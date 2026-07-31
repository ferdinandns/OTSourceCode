"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { apiFetch, API_BASE } from "@/lib/api";

type Department = {
  id: number;
  code: string;
  name: string;
  is_qs: boolean;
  site_code: string;
  site_desc: string;
  site_id?: number;
  created_at: string;
  is_active?: boolean;
};

export default function MasterDepartemenContent() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editName, setEditName] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [successModal, setSuccessModal] = useState<{ isOpen: boolean; message: string }>({
    isOpen: false,
    message: "",
  });

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const response = await apiFetch(`${API_BASE}/departments`, {
        method: "GET",
      });
      const result = await response.json();
      if (result.success) {
        const dataWithStatus = result.data.map((dep: Department) => ({
          ...dep,
          is_active: true,
        }));
        setDepartments(dataWithStatus);
      }
    } catch (error) {
      console.error("Gagal fetch departemen:", error);
      showToast("Gagal memuat data departemen", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSuccessModalClose = () => {
    setSuccessModal({ isOpen: false, message: "" });
    fetchDepartments();
  };

  const handleEditClick = (dept: Department) => {
    setEditingDept(dept);
    setEditName(dept.name);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingDept) return;
    if (!editName.trim()) {
      showToast("Nama departemen tidak boleh kosong", "error");
      return;
    }
    setEditLoading(true);
    try {
      const response = await apiFetch(`${API_BASE}/departments/${editingDept.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editName.trim(),
          site_id: editingDept.site_id,
        }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setIsEditModalOpen(false);
        setSuccessModal({
          isOpen: true,
          message: "Request edit departemen berhasil dikirim ke approval.",
        });
      } else {
        showToast(result.message || "Gagal mengedit departemen", "error");
      }
    } catch (error) {
      console.error(error);
      showToast("Terjadi kesalahan jaringan", "error");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteClick = (id: number) => {
    setDeletingId(id);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    setDeleteLoading(true);
    try {
      const response = await apiFetch(`${API_BASE}/departments/${deletingId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setIsDeleteModalOpen(false);
        setSuccessModal({
          isOpen: true,
          message: "Request hapus departemen berhasil dikirim ke approval.",
        });
      } else {
        showToast(result.message || "Gagal menghapus departemen", "error");
      }
    } catch (error) {
      console.error(error);
      showToast("Terjadi kesalahan jaringan", "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredData = departments.filter(
    (dep) =>
      dep.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dep.code.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm mb-5 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Master Departemen</h1>
          <p className="ext-xs sm:text-sm text-slate-500 mt-1">
            Total <span className="font-semibold text-slate-700">{departments.length}</span> departemen di sistem Emertrack.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Link
            href="/dashboard/department/add"
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm shadow-blue-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Tambah Departemen
          </Link>
        </div>
      </div>

      <div className="relative max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow shadow-sm"
          placeholder="Cari nama atau kode departemen..."
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">No</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nama Departemen</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Kode</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Site</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {loading ? (
                [...Array(5)].map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-full"></div></td>
                  </tr>
                ))
              ) : paginatedData.map((dep, index) => (
                <tr key={dep.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-400 font-mono">
                    {String(startIndex + index + 1).padStart(2, '0')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{dep.name}</span>
                      {dep.is_qs && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200 uppercase">QS Team</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-medium">{dep.code}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{dep.site_desc}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>AKTIF
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleEditClick(dep)} className="text-slate-400 hover:text-blue-600 transition-colors" title="Edit departemen">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && filteredData.length > 0 && (
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <div className="text-sm text-slate-500">
              Menampilkan <span className="font-semibold text-slate-900">{startIndex + 1}</span> - <span className="font-semibold text-slate-900">{Math.min(startIndex + itemsPerPage, filteredData.length)}</span> dari <span className="font-semibold text-slate-900">{filteredData.length}</span> data
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 text-sm font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">Prev</button>
              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => (
                  <button key={i} onClick={() => setCurrentPage(i + 1)} className={`w-9 h-9 text-sm font-semibold rounded-lg transition-all ${currentPage === i + 1 ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>{i + 1}</button>
                ))}
              </div>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 text-sm font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">Next</button>
            </div>
          </div>
        )}
      </div>

      {isEditModalOpen && editingDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Departemen</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kode</label>
                <input type="text" value={editingDept.code} disabled className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Departemen</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Batal</button>
              <button onClick={handleEditSubmit} disabled={editLoading} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {editLoading ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Hapus Departemen</h2>
            <p className="text-gray-600 mb-6">Apakah Anda yakin ingin menghapus departemen ini? Tindakan ini akan membutuhkan persetujuan supervisor.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Batal</button>
              <button onClick={handleDeleteConfirm} disabled={deleteLoading} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
                {deleteLoading ? "Memproses..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}

      {successModal.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-base font-black text-gray-900 mb-1.5">Berhasil</h3>
            <p className="text-xs text-gray-500 font-medium leading-relaxed mb-5">{successModal.message}</p>
            <button
              onClick={handleSuccessModalClose}
              className="w-full px-4 py-2.5 bg-[#003d7a] text-white rounded-lg text-xs font-black uppercase tracking-wider hover:bg-[#002d5a] transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-right-5 duration-300">
          <div className={`px-6 py-3 rounded-lg shadow-lg text-sm font-bold ${toast.type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
