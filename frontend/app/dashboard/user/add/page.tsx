"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, API_BASE } from "@/lib/api";
import { IdCard, User, Mail, MapPin, Users, ChevronDown } from "lucide-react";
import TransactionModal from "@/components/TransactionStatusModal";

type Site = { id: number; name: string; code: string };
type Department = { id: number; name: string; code: string };
type SarprasType = { id: number; name: string };

const AVAILABLE_ROLES = [
  { id: "admin", label: "Admin" },
  { id: "qs", label: "Quality System (QS)" },
  { id: "checker", label: "Checker (Inspektur)" },
];

export default function TambahUserContent() {
  const router = useRouter();
  
  const [sites, setSites] = useState<Site[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sarprasTypes, setSarprasTypes] = useState<SarprasType[]>([]);
  const [isLoadingRelasi, setIsLoadingRelasi] = useState(true);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSuccess, setModalSuccess] = useState<boolean | null>(null);
  const [modalMessage, setModalMessage] = useState("");

  const ERROR_FIELD_ORDER = ["nik", "name", "email", "site_id", "department_id", "roles", "sarpras_type_ids"];

  const scrollToFirstError = (errors: Record<string, string>) => {
    const firstKey = ERROR_FIELD_ORDER.find((k) => errors[k]) || Object.keys(errors)[0];
    if (!firstKey) return;

    requestAnimationFrame(() => {
      const el =
        document.querySelector(`[data-field="${firstKey}"]`) ||
        document.querySelector(`[name="${firstKey}"]`);

      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
          el.focus({ preventScroll: true });
        }
      }
    });
  };

  const [formData, setFormData] = useState({
    nik: "",
    name: "",
    email: "",
    site_id: "",
    department_id: "",
    is_active: true,
    is_supervisor: false,
    roles: [] as string[],
    sarpras_type_ids: [] as number[],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchRelations = async () => {
      try {
        const [resSites, resDepts, resSarprasTypes] = await Promise.all([
            apiFetch(`${API_BASE}/sites`),
            apiFetch(`${API_BASE}/departments`),
            apiFetch(`${API_BASE}/sarpras-types`),
        ]);

        const dataSites = await resSites.json();
        const dataDepts = await resDepts.json();
        const dataSarprasTypes = await resSarprasTypes.json();

        if (dataSites.success) setSites(dataSites.data);
        if (dataDepts.success) setDepartments(dataDepts.data);
        if (dataSarprasTypes.success) setSarprasTypes(dataSarprasTypes.data);
      } catch (err) {
        setError("Gagal memuat data relasi dari server.");
      } finally {
        setIsLoadingRelasi(false);
      }
    };
    fetchRelations();
  }, []);

  // Detect QS department to control role access.
  const isSelectedDeptQS = () => {
    if (!formData.department_id) return false;
    const selectedDept = departments.find(d => d.id.toString() === formData.department_id);
    if (!selectedDept) return false;
    
    // QS department is identified by 'quality assurance - quality system' or 'qs' in its name.
    const deptName = selectedDept.name.toLowerCase();
    return deptName.includes("quality assurance - quality system") || deptName.includes("qs");
  };

  const isQSDept = isSelectedDeptQS();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => {
      const newState = { ...prev, [name]: type === "checkbox" ? checked : value };
      
      if (name === "is_supervisor" && checked) {
        newState.sarpras_type_ids = [];
      }

       if (name === "is_supervisor") {
        if (checked) {
          newState.sarpras_type_ids = [];
          // Tambahkan role pic_responsibility saat jadi supervisor
          if (!newState.roles.includes("pic_responsibility")) {
            newState.roles = [...newState.roles, "pic_responsibility"];
          }
        } else {
          // Lepas role pic_responsibility saat supervisor di-uncheck
          newState.roles = newState.roles.filter((r) => r !== "pic_responsibility");
        }
      }

      // Remove QS role when department is changed away from QS.
      if (name === "department_id") {
        const newlySelectedDept = departments.find(d => d.id.toString() === value);
        if (newlySelectedDept) {
          const isNewDeptQS = newlySelectedDept.name.toLowerCase().includes("quality assurance - quality system") || newlySelectedDept.name.toLowerCase().includes("qs");
          if (!isNewDeptQS && newState.roles.includes("qs")) {
            newState.roles = newState.roles.filter(r => r !== "qs");
          }
        }
      }

      return newState;
    });

    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleNIKChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, nik: e.target.value }));
    if (fieldErrors.nik) setFieldErrors((prev) => ({ ...prev, nik: "" }));
  }

  const handleRoleChange = (roleId: string) => {
    setFormData((prev) => {
      const isSelected = prev.roles.includes(roleId);
      const newRoles = isSelected
        ? prev.roles.filter((r) => r !== roleId)
        : [...prev.roles, roleId];
        
      const newSarprasTypeIds = (!newRoles.includes("checker")) ? [] : prev.sarpras_type_ids;
      return { ...prev, roles: newRoles, sarpras_type_ids: newSarprasTypeIds };
    });

    if (fieldErrors.roles) setFieldErrors((prev) => ({ ...prev, roles: "" }));
  };

  const handleSarprasTypeChange = (typeId: number) => {
    setFormData((prev) => {
      const isSelected = prev.sarpras_type_ids.includes(typeId);
      const newTypeIds = isSelected
        ? prev.sarpras_type_ids.filter((id) => id !== typeId)
        : [...prev.sarpras_type_ids, typeId];
      return { ...prev, sarpras_type_ids: newTypeIds };
    });

    if (fieldErrors.sarpras_type_ids) setFieldErrors((prev) => ({ ...prev, sarpras_type_ids: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    
    const errors: Record<string, string> = {};

    if (!formData.nik.trim()) {
      errors.nik = "NIK wajib diisi.";
    } else if (!/^[A-Za-z0-9]+$/.test(formData.nik)) {
      errors.nik = "NIK hanya boleh berisi huruf dan angka.";
    }
    if (!formData.name.trim()) errors.name = "Nama Lengkap wajib diisi.";
    if (!formData.site_id) errors.site_id = "Lokasi Site wajib dipilih.";
    if (!formData.department_id) errors.department_id = "Departemen wajib dipilih.";
    if (formData.roles.length === 0) errors.roles = "Pilih minimal 1 Role akses.";

    if (!formData.email.trim()) {
      errors.email = "Email Perusahaan wajib diisi.";
    } else if (!formData.email.includes("@")) {
      errors.email = "Format email tidak valid (wajib menggunakan '@').";
    }

    if (formData.roles.includes("checker") && !formData.is_supervisor && formData.sarpras_type_ids.length === 0) {
      errors.sarpras_type_ids = "Pilih minimal 1 jenis Sarpras.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError("Mohon lengkapi isian yang diblok warna merah sebelum menyimpan.");
      setIsSubmitting(false);
      scrollToFirstError(errors);
      return;
    }

    const payload = {
      nik: formData.nik,
      name: formData.name,
      email: formData.email,
      site_id: parseInt(formData.site_id),
      department_id: parseInt(formData.department_id),
      is_active: formData.is_active,
      is_supervisor: formData.is_supervisor,
      roles: formData.roles,
      sarpras_type_ids: formData.sarpras_type_ids,
    };

    try {
      const response = await apiFetch(`${API_BASE}/users`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!result.success) {
        if (result.errors && typeof result.errors === "object" && Object.keys(result.errors).length > 0) {
          setFieldErrors((prev) => ({ ...prev, ...result.errors }));
          setError("Mohon periksa kembali isian yang ditandai merah.");
          setIsSubmitting(false);
          scrollToFirstError(result.errors);
          return;
        }

        // Error lain yang bukan per-field -> tetap pakai modal
        setModalSuccess(false);
        setModalMessage(result.message || result.error || "Gagal membuat data user baru.");
        setModalOpen(true);
        setIsSubmitting(false);
        return;
      }

      // Sukses
      setModalSuccess(true);
      setModalMessage(result.message || "Berhasil.");
      setModalOpen(true);
    } catch (err) {
      setModalSuccess(false);
      setModalMessage("Terjadi kesalahan koneksi ke server.");
      setModalOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  const getInputClass = (fieldName: string, hasIcon: boolean = false) => {
    const paddingX = hasIcon ? "pl-11 pr-4 " : "px-4 ";
    const baseClass = "w-full " + paddingX + "py-2.5 rounded-lg outline-none transition-all ";
    if (fieldErrors[fieldName]) {
      return baseClass + "bg-red-50 border border-red-500 focus:ring-2 focus:ring-red-500 text-red-900 placeholder-red-300";
    }
    return baseClass + "bg-slate-50 border border-slate-300 focus:ring-2 focus:ring-blue-500 text-slate-900";
  };

  return (
    <div className="p-6 max-w-4xl mx-auto w-full">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors mb-6 group">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 group-hover:-translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        <span className="font-medium">Kembali ke Daftar User</span>
      </button>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Tambah Pengguna Baru</h1>
            <p className="text-slate-500 text-sm mt-1">Lengkapi data diri dan otorisasi sistem untuk karyawan.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                {error}
              </div>
            )}

           <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b pb-2">Informasi Dasar</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">NIK <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <IdCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    <input name="nik" value={formData.nik} onChange={handleNIKChange} className={getInputClass("nik", true)} placeholder="0012030445" />
                  </div>
                  {fieldErrors.nik && <p className="text-xs text-red-500 font-medium mt-1">{fieldErrors.nik}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Nama Lengkap <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    <input name="name" value={formData.name} onChange={handleChange} className={getInputClass("name", true)} placeholder="Raffa Fadilah" />
                  </div>
                  {fieldErrors.name && <p className="text-xs text-red-500 font-medium mt-1">{fieldErrors.name}</p>}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">Email Perusahaan <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    <input name="email" value={formData.email} onChange={handleChange} className={getInputClass("email", true)} placeholder="raffa.fadilah@emertrack.com" />
                  </div>
                  {fieldErrors.email && <p className="text-xs text-red-500 font-medium mt-1">{fieldErrors.email}</p>}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b pb-2">Penempatan</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Lokasi Site <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    <select name="site_id" value={formData.site_id} onChange={handleChange} disabled={isLoadingRelasi} className={`${getInputClass("site_id", true)} appearance-none`}>
                      <option value="">Pilih Site...</option>
                      {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                  {fieldErrors.site_id && <p className="text-xs text-red-500 font-medium mt-1">{fieldErrors.site_id}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Departemen <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    <select name="department_id" value={formData.department_id} onChange={handleChange} disabled={isLoadingRelasi} className={`${getInputClass("department_id", true)} appearance-none`}>
                      <option value="">Pilih Departemen...</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                  {fieldErrors.department_id && <p className="text-xs text-red-500 font-medium mt-1">{fieldErrors.department_id}</p>}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b pb-2">Otorisasi Sistem</h2>
              
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-700">Pilih Role Akses <span className="text-red-500">*</span></label>
                <div data-field="roles" className={`grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border ${fieldErrors.roles ? "border-red-500 bg-red-50/30" : "border-transparent"}`}>
                  {AVAILABLE_ROLES.map((role) => {
                    // Disable QS role checkbox when department is not QS.
                    const isQSRole = role.id === "qs";
                    const isDisabled = isQSRole && !isQSDept;

                    let labelStyle = "bg-white hover:bg-slate-50 border-slate-200 cursor-pointer";
                    if (isDisabled) labelStyle = "bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed";
                    else if (formData.roles.includes(role.id)) labelStyle = "bg-blue-50 border-blue-300 cursor-pointer";
                    if (fieldErrors.roles && !isDisabled) labelStyle = "border-red-200 bg-white cursor-pointer";

                    return (
                      <label key={role.id} title={isDisabled ? "Hanya karyawan departemen QS yang dapat memilih role ini" : ""} className={`flex items-center gap-3 p-3 border rounded-lg transition-all ${labelStyle}`}>
                        <input 
                          type="checkbox" 
                          disabled={isDisabled}
                          checked={formData.roles.includes(role.id)} 
                          onChange={() => handleRoleChange(role.id)} 
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:bg-slate-300 disabled:border-slate-300 disabled:cursor-not-allowed" 
                        />
                        <div className="flex flex-col">
                          <span className={`text-sm font-medium ${fieldErrors.roles ? 'text-red-700' : isDisabled ? 'text-slate-500' : 'text-slate-700'}`}>
                            {role.label}
                          </span>
                          {isDisabled && (
                            <span className="text-[10px] text-slate-400 mt-0.5">Khusus Departemen QS</span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
                {fieldErrors.roles && <p className="text-xs text-red-500 font-medium mt-1">{fieldErrors.roles}</p>}
              </div>

              <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_supervisor"
                    checked={formData.is_supervisor}
                    onChange={handleChange}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-semibold text-slate-700">PIC Responsibility (Supervisor)</span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Jika dicentang, pengguna berperan sebagai PIC Responsibility / Supervisor dan akan memiliki akses ke semua jenis sarpras tanpa perlu penugasan khusus.
                    </p>
                  </div>
                </label>
              </div>

              {formData.roles.includes("checker") && (
                <div data-field="sarpras_type_ids" className={`mt-4 p-5 rounded-xl border transition-all ${fieldErrors.sarpras_type_ids ? "border-red-500 bg-red-50/50" : "border-indigo-200 bg-indigo-50/50"}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 ${fieldErrors.sarpras_type_ids ? "text-red-500" : "text-indigo-600"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M9 15h6"></path><path d="M9 11h6"></path></svg>
                    <h3 className={`text-sm font-bold ${fieldErrors.sarpras_type_ids ? "text-red-800" : "text-indigo-900"}`}>Penugasan Inspeksi Sarpras (Khusus Checker)</h3>
                  </div>

                  {formData.is_supervisor ? (
                    <div className="flex items-start gap-2 text-sm text-indigo-700 bg-indigo-100/50 p-3 rounded-lg border border-indigo-200">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>
                      <span className="leading-relaxed">
                        Karena akun ini adalah <strong>PIC Responsibility (Supervisor)</strong>, maka ia memiliki akses ke <strong>Semua Jenis Sarpras</strong>.
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className={`text-sm ${fieldErrors.sarpras_type_ids ? "text-red-600 font-medium" : "text-slate-600"}`}>Pilih jenis Sarpras yang menjadi tanggung jawab inspeksi checker ini: <span className="text-red-500">*</span></p>
                      <div className="flex flex-wrap gap-3">
                        {isLoadingRelasi ? (
                          <span className="text-sm text-slate-500">Memuat jenis sarpras...</span>
                        ) : (
                          sarprasTypes.map(st => {
                            const isChecked = formData.sarpras_type_ids.includes(st.id);
                            const styleChecked = "bg-indigo-600 text-white border-indigo-600";
                            const styleUnchecked = fieldErrors.sarpras_type_ids ? "bg-white text-red-700 border-red-300 hover:bg-red-50" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50";
                            return (
                              <label key={st.id} className={`flex items-center gap-2 px-4 py-2 border rounded-full cursor-pointer transition-all ${isChecked ? styleChecked : styleUnchecked}`}>
                                <input type="checkbox" className="hidden" checked={isChecked} onChange={() => handleSarprasTypeChange(st.id)} />
                                <span className="text-sm font-medium">{st.name}</span>
                              </label>
                            )
                          })
                        )}
                      </div>
                      {fieldErrors.sarpras_type_ids && <p className="text-xs text-red-500 font-medium mt-1">{fieldErrors.sarpras_type_ids}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-6 border-t flex justify-end gap-3">
              <button type="button" onClick={() => router.back()} className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Batal</button>
              <button type="submit" disabled={isSubmitting} className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-sm shadow-blue-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 transition-all">
                {isSubmitting ? "Menyimpan..." : "Simpan Pengguna"}
              </button>
            </div>
          </form>
        </div>
      </div>
      <TransactionModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        success={modalSuccess}
        message={modalMessage}
      />
    </div>
  );
}
