"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, API_BASE } from '@/lib/api';

type Site = {
  id: number;
  code: string;
  name: string;
};

// Only letters, spaces, hyphens, and common punctuation are allowed.
const ALLOWED_NAME  = /^[a-zA-Z\-\s]*$/;
const ALLOWED_CODE  = /^[a-zA-Z]*$/;
const ALLOWED_NOTES = /^[a-zA-Z\-\.\,\s]*$/;

const sanitizeName  = (v: string) => v.replace(/[^a-zA-Z\-\s]/g, '');
const sanitizeCode  = (v: string) => v.replace(/[^a-zA-Z]/g, '');
const sanitizeNotes = (v: string) => v.replace(/[^a-zA-Z\-\.\,\s]/g, '');

export default function TambahDepartemenContent() {
  const router = useRouter();

  const [sites, setSites] = useState<Site[]>([]);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    site_id: "",
    notes: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSites, setIsLoadingSites] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [modal, setModal] = useState<{ isOpen: boolean; message: string }>({
    isOpen: false,
    message: "",
  });

  useEffect(() => {
    const fetchSites = async () => {
      try {
        const response = await apiFetch(`${API_BASE}/sites`, {
          method: "GET",
        });
        const result = await response.json();
        if (result.success) {
          setSites(result.data);
          if (result.data.length === 1) {
            setFormData(prev => ({ ...prev, site_id: result.data[0].id.toString() }));
          }
        }
      } catch (err) {
        console.error("Gagal mengambil data site:", err);
        setError("Gagal memuat daftar lokasi site.");
      } finally {
        setIsLoadingSites(false);
      }
    };
    fetchSites();
  }, []);

  const clearFieldErr = (name: string) =>
    setFieldErrors(prev => { const n = { ...prev }; delete n[name]; return n; });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let sanitized = value;

    if (name === 'code')  sanitized = sanitizeCode(value);
    if (name === 'name')  sanitized = sanitizeName(value);
    if (name === 'notes') sanitized = sanitizeNotes(value);

    setFormData(prev => ({ ...prev, [name]: sanitized }));
    clearFieldErr(name);
  };

  const handleModalClose = () => {
    setModal({ isOpen: false, message: "" });
    router.push("/dashboard/department");
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const fe: Record<string, string> = {};

    if (!formData.code.trim()) {
      fe.code = "Kode departemen wajib diisi.";
    } else if (!ALLOWED_CODE.test(formData.code)) {
      fe.code = "Kode hanya boleh berisi huruf, angka, dan tanda hubung (-).";
    }

    if (!formData.name.trim()) {
      fe.name = "Nama departemen wajib diisi.";
    } else if (!ALLOWED_NAME.test(formData.name)) {
      fe.name = "Nama mengandung karakter yang tidak diizinkan.";
    }

    if (!formData.site_id) {
      fe.site_id = "Lokasi site wajib dipilih.";
    }

    if (!formData.notes.trim()) {
      fe.notes = "Catatan wajib diisi.";
    } else if (formData.notes && !ALLOWED_NOTES.test(formData.notes)) {
      fe.notes = "Catatan mengandung karakter yang tidak diizinkan.";
    }

    if (Object.keys(fe).length > 0) {
      setFieldErrors(fe);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(true);

    const payload = {
      code: formData.code,
      name: formData.name,
      site_id: parseInt(formData.site_id),
      is_qs: false,
      notes: formData.notes,
    };

    try {
      const response = await apiFetch(`${API_BASE}/departments`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        setModal({
          isOpen: true,
          message: `Departemen ${formData.name} berhasil ditambahkan.`,
        });
      } else {
        setError(result.error || "Gagal menambah departemen.");
      }
    } catch (err) {
      setError("Terjadi kesalahan koneksi ke server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls = (hasError: boolean) =>
    `w-full px-4 py-2.5 border rounded-lg outline-none transition-all ${
      hasError
        ? "bg-red-50 border-red-500 text-red-900 focus:ring-2 focus:ring-red-400"
        : "bg-slate-50 border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white"
    }`;

  return (
    <div className="p-6 max-w-2xl mx-auto w-full">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors mb-6 group"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 group-hover:-translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        <span className="font-medium">Kembali ke Daftar</span>
      </button>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Tambah Departemen Baru</h1>
            <p className="text-slate-500 text-sm mt-1">Masukkan informasi departemen yang akan didaftarkan ke sistem.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                {error}
              </div>
            )}

            <div className="grid gap-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="code" className="text-sm font-semibold text-slate-700">
                    Kode Departemen <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="code"
                    name="code"
                    type="text"
                    placeholder="Contoh: ANDEV, GA, QC"
                    value={formData.code}
                    onChange={handleChange}
                    className={inputCls(!!fieldErrors.code)}
                    autoComplete="off"
                  />
                  {fieldErrors.code && (
                    <p className="text-xs text-red-500 font-medium mt-1">{fieldErrors.code}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label htmlFor="site_id" className="text-sm font-semibold text-slate-700">
                    Lokasi Site <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="site_id"
                    name="site_id"
                    value={formData.site_id}
                    onChange={handleChange}
                    disabled={isLoadingSites}
                    className={`${inputCls(!!fieldErrors.site_id)} appearance-none disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    <option value="" disabled>
                      {isLoadingSites ? "Memuat data site..." : "Pilih Site..."}
                    </option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name} ({site.code})
                      </option>
                    ))}
                  </select>
                  {fieldErrors.site_id && (
                    <p className="text-xs text-red-500 font-medium mt-1">{fieldErrors.site_id}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-semibold text-slate-700">
                  Nama Departemen <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Contoh: Analytical Development"
                  value={formData.name}
                  onChange={handleChange}
                  className={inputCls(!!fieldErrors.name)}
                  autoComplete="off"
                />
                {fieldErrors.name && (
                  <p className="text-xs text-red-500 font-medium mt-1">{fieldErrors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="notes" className="text-sm font-semibold text-slate-700">
                  Catatan <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  placeholder="Contoh: Penambahan Departemen baru untuk tim..."
                  value={formData.notes}
                  onChange={handleChange}
                  className={`${inputCls(!!fieldErrors.notes)} resize-none`}
                />
                {fieldErrors.notes && (
                  <p className="text-xs text-red-500 font-medium mt-1">{fieldErrors.notes}</p>
                )}
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-sm shadow-blue-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Departemen"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {modal.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-base font-black text-gray-900 mb-1.5">Berhasil</h3>
            <p className="text-xs text-gray-500 font-medium leading-relaxed mb-5">{modal.message}</p>
            <button
              onClick={handleModalClose}
              className="w-full px-4 py-2.5 bg-[#003d7a] text-white rounded-lg text-xs font-black uppercase tracking-wider hover:bg-[#002d5a] transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
