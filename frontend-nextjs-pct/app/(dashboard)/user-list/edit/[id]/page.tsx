"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Eye, EyeOff, Save, KeyRound, ArrowLeft, ChevronDown } from "lucide-react";
import Cookies from "js-cookie";
import { API_BASE_URL, apiFetch } from "@/lib/api";

const detailAreaOptions: Record<string, string[]> = {
  "PPIC": ["Administrator", "PPIC Site"],
  "Quality Control": ["Administrator", "Manager", "Analis"],
  "Quality Assurance": ["Administrator", "QA BR"],
  "Warehouse": ["Administrator", "WH WG Admin", "WH OMC Admin", "WH OMC Operator", "Penimbangan"],
  "Production": ["Administrator", "Manager", "Supervisor", "Op Compounding", "Admin BR"],
  "DEFAULT": ["A"]
};

const AREAS_WITH_DETAIL_TABLE = [
  "Production",
  "Warehouse",
  "PPIC",
  "Quality Assurance",
  "Quality Control",
];

const getDetailAreaFromLevel = (level: string) => {
  if (!level) return "";
  const lowerLevel = level.toLowerCase();

  if (lowerLevel === "analis") return "Analis/Inspektor";

  const allOptions = Object.values(detailAreaOptions).flat();
  const match = allOptions.find(opt => opt.toLowerCase() === lowerLevel);

  if (match) return match;

  return level.charAt(0).toUpperCase() + level.slice(1);
};

export default function EditAccountPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id;

  // State dari Cookie (Role Asli)
  const [currentUserLevel, setCurrentUserLevel] = useState("");
  const [currentUserDept, setCurrentUserDept] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // State Show/Hide Password
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [formData, setFormData] = useState({
    nama: "",
    nik: "",
    level: "",
    area: "",
    username: "",
    oldPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const [detailArea, setDetailArea] = useState("");
  const [originalDetailArea, setOriginalDetailArea] = useState("");

  // Fetch Data User saat komponen dimuat
  useEffect(() => {
    const level = (Cookies.get("level") || "").toLowerCase();
    const dept = Cookies.get("area") || "";
    setCurrentUserLevel(level);
    setCurrentUserDept(dept);

    const fetchUserData = async () => {
      setIsFetching(true);
      try {
        const token = Cookies.get("token");
        const res = await apiFetch(`${API_BASE_URL}/api/v1/master/users/`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });

        if (res.ok) {
          const json = await res.json();
          const users = json.data || [];

          // Cari user berdasarkan ID yang sedang diedit
          const userTarget = users.find((u: any) => String(u.id) === String(userId));

          if (userTarget) {
            setFormData(prev => ({
              ...prev,
              nama: userTarget.nama || "",
              nik: userTarget.nik || "",
              username: userTarget.username || "",
              area: userTarget.area || "",
              level: userTarget.level || ""
            }));

            const initialDetailArea = getDetailAreaFromLevel(userTarget.detail_area || "");
            setDetailArea(initialDetailArea);
            setOriginalDetailArea(initialDetailArea);
          } else {
            alert("Data user tidak ditemukan.");
            router.push("/user-list");
          }
        }
      } catch (error) {
        console.error("Gagal mengambil data user:", error);
      } finally {
        setIsFetching(false);
      }
    };

    if (userId) {
      fetchUserData();
    }
  }, [userId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validasi Password sebelum hit API
    if (formData.newPassword || formData.confirmPassword) {
      if (formData.newPassword !== formData.confirmPassword) {
        return alert("New Password dan Re-type New Password tidak cocok!");
      }
      if (!formData.oldPassword) {
        return alert("Password lama harus diisi untuk merubah password!");
      }
    }

    setIsLoading(true);
    try {
      const token = Cookies.get("token");

      // Menyesuaikan payload JSON dengan struct EditUser (request_user.go)
      const payload = {
        nama: formData.nama,
        nik: formData.nik,
        username: formData.username,
        area: formData.area,
        level: formData.level,
        old_password: formData.oldPassword,
        new_password: formData.newPassword,
        confirm_password: formData.confirmPassword
      };

      const response = await apiFetch(`${API_BASE_URL}/api/v1/master/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.meta?.message || result.error || "Gagal mengubah data.");
      }

      alert(result.meta?.message || "Data berhasil diubah!");

      if (currentUserLevel === "administrator" && areaHasDetailTable && detailArea && detailArea !== originalDetailArea) {
        try {
          const areaRes = await apiFetch(`${API_BASE_URL}/api/v1/master/users/update-detail-area/${userId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ detail_area: detailArea })
          });
          const areaResult = await areaRes.json();
          if (!areaRes.ok) {
            throw new Error(areaResult.meta?.message || areaResult.error || "Gagal menyimpan Detail Area.");
          }
          setOriginalDetailArea(detailArea);
        } catch (areaError: any) {
          // Data utama sudah tersimpan; beri tahu terpisah kalau bagian Detail Area gagal.
          alert("Data utama tersimpan, tapi Detail Area gagal disimpan: " + areaError.message);
        }
      }

      // Logic Auto-Logout berdasarkan respons Backend (jika mengubah password sendiri)
      if (result.data?.force_logout) {
        Cookies.remove("token");
        Cookies.remove("level");
        Cookies.remove("area");
        router.push("/login");
      } else {
        router.push("/user-list");
      }

    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    try {
      const token = Cookies.get("token");

      const response = await apiFetch(`${API_BASE_URL}/api/v1/master/users/reset-password/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({}) // Body kosong karena parameter ditangkap dari token dan id params
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.meta?.message || result.error || "Gagal mereset password.");
      }

      setIsResetModalOpen(false);
      alert(result.meta?.message || "Password berhasil direset ke default!");

      if (result.data?.force_logout) {
        Cookies.remove("token");
        Cookies.remove("level");
        Cookies.remove("area");
        router.push("/login");
      }
    } catch (error: any) {
      alert(error.message);
    }
  };


  if (isFetching) {
    return (
      <div className="w-full h-[500px] flex flex-col items-center justify-center bg-transparent">
        <div className="w-12 h-12 border-4 border-[#eaf4d5] border-t-[#8cc63f] rounded-full animate-spin"></div>
        <p className="mt-4 text-[#104c97] font-bold animate-pulse tracking-wide">
          Memuat Data Form...
        </p>
      </div>
    );
  }

  // Pengecekan huruf besar dan simbol (hanya jika newPassword tidak kosong)
  const isNewPasswordValid =
    /[A-Z]/.test(formData.newPassword) && /[^a-zA-Z0-9]/.test(formData.newPassword);

  const areaHasDetailTable = AREAS_WITH_DETAIL_TABLE.includes(formData.area);
  const currentAreaOptions = detailAreaOptions[formData.area] || detailAreaOptions["DEFAULT"];
  const detailAreaDropdownOptions = Array.from(new Set([...currentAreaOptions, detailArea])).filter(Boolean);

  return (
    <div className="w-full md:w-[95%] mx-auto bg-transparent min-h-[500px]">

      <div className="mb-4">
        <h2 className="text-3xl font-semibold text-gray-800">Edit User Data</h2>
        <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
          <span className="cursor-pointer hover:text-blue-600 transition" onClick={() => router.push("/user-list")}>User List Account</span>
          <span>/</span>
          <span>Edit Account</span>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden flex flex-col min-h-[600px]">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center gap-2 text-gray-700 font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
          Edit data
        </div>

        <div className="p-6 flex-1">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">

              {/* KOLOM KIRI */}
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 text-sm mb-1 font-medium">Nama</label>
                  <input type="text" required value={formData.nama} onChange={e => setFormData({ ...formData, nama: e.target.value })} className="w-full md:w-[400px] border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 text-black" />
                </div>

                {/* Fitur yang dirender dinamis hanya untuk administrator sesuai user_services.go */}
                {currentUserLevel === "administrator" && (
                  <>
                    <div>
                      <label className="block text-gray-700 text-sm mb-1 font-medium mt-2">NIK</label>
                      <input type="text" required value={formData.nik} onChange={e => setFormData({ ...formData, nik: e.target.value })} className="w-full md:w-[400px] border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 text-black" />
                    </div>
                    <div>
                      <label className="block text-gray-700 text-sm mb-1 font-medium mt-2">Level</label>
                      <select required value={formData.level} onChange={e => setFormData({ ...formData, level: e.target.value })} className="w-full md:w-[400px] border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 text-black bg-white cursor-pointer">
                        <option value="administrator">Administrator</option>
                        <option value="manager">Manager</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="staff_prod">Staff Produksi</option>
                        <option value="staff_qa">Staff QA</option>
                        <option value="staff_qc">Staff QC</option>
                        <option value="staff_tk">Staff Engineering</option>
                        <option value="staff_wh">Staff Warehouse</option>
                        <option value="staff_ts">Staff Technical Service</option>
                        <option value="staff_ga">Staff General Affair</option>
                        <option value="staff_md">Staff Manufacturing Development</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-700 text-sm mb-1 font-medium mt-2">Department</label>
                      <select
                        required
                        value={formData.area}
                        onChange={e => setFormData({ ...formData, area: e.target.value })}
                        className="w-full md:w-[400px] border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 text-black bg-white cursor-pointer"
                      >
                        <option value="Administrator">Administrator</option>
                        <option value="Production">Production</option>
                        <option value="Engineering">Engineering</option>
                        <option value="Warehouse">Warehouse</option>
                        <option value="Technical Service">Technical Service</option>
                        <option value="General Affair">General Affair</option>
                        <option value="Manufacturing Development">Manufacturing Development</option>
                        <option value="Quality Assurance">Quality Assurance</option>
                        <option value="Quality Control">Quality Control</option>
                      </select>
                    </div>

                    {/* ==== BARU: Detail Area, hanya muncul untuk 5 department yang
                        punya tabel detail sendiri di backend (mapTableName). Tersimpan
                        bersama field lain saat tombol "Submit Data" diklik. */}
                    {areaHasDetailTable && (
                      <div>
                        <label className="block text-gray-700 text-sm mb-1 font-medium mt-2">Detail Area</label>
                        <div className="relative w-full md:w-[400px]">
                          <select
                            value={detailArea}
                            onChange={e => setDetailArea(e.target.value)}
                            className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 text-black bg-white cursor-pointer appearance-none pr-8"
                          >
                            <option value="" disabled>Pilih Detail Area</option>
                            {detailAreaDropdownOptions.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          Perubahan Detail Area akan tersimpan saat Anda klik "Submit Data".
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* KOLOM KANAN */}
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 text-sm mb-1 font-medium">Username</label>
                  <input type="text" required value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} className="w-full md:w-[400px] border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 text-black" />
                </div>

                <div>
                  <label className="block text-gray-700 text-sm mb-1 font-medium mt-2">Old Password</label>
                  <div className="flex w-full md:w-[400px]">
                    <input type={showOldPass ? "text" : "password"} placeholder="Ketik Password Lama..." value={formData.oldPassword} onChange={e => setFormData({ ...formData, oldPassword: e.target.value })} className="flex-1 border border-gray-300 rounded-l p-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 text-black" />
                    <button type="button" onClick={() => setShowOldPass(!showOldPass)} className="bg-white border border-l-0 border-gray-300 rounded-r p-2 text-gray-500 hover:bg-gray-50 transition cursor-pointer">
                      {showOldPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 text-sm mb-1 font-medium mt-2">New Password</label>
                  <div className="flex w-full md:w-[400px]">
                    <input type={showNewPass ? "text" : "password"} placeholder="Ketik Password Baru..." value={formData.newPassword} onChange={e => setFormData({ ...formData, newPassword: e.target.value })} className="flex-1 border border-gray-300 rounded-l p-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 text-black" />
                    <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="bg-white border border-l-0 border-gray-300 rounded-r p-2 text-gray-500 hover:bg-gray-50 transition cursor-pointer">
                      {showNewPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {formData.newPassword && !isNewPasswordValid && (
                    <p className="text-red-500 text-xs mt-1 w-full md:w-[400px]">
                      Password harus mengandung huruf besar dan simbol
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 text-sm mb-1 font-medium mt-2">Re-type New Password</label>
                  <div className="flex w-full md:w-[400px]">
                    <input type={showConfirmPass ? "text" : "password"} placeholder="Konfirmasi Password Baru..." value={formData.confirmPassword} onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })} className="flex-1 border border-gray-300 rounded-l p-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 text-black" />
                    <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)} className="bg-white border border-l-0 border-gray-300 rounded-r p-2 text-gray-500 hover:bg-gray-50 transition cursor-pointer">
                      {showConfirmPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {formData.confirmPassword && (
                    formData.newPassword === formData.confirmPassword ? (
                      <p className="text-green-600 text-xs mt-1 font-medium">Password cocok ✓</p>
                    ) : (
                      <p className="text-red-500 text-xs mt-1">Password tidak cocok dengan password baru</p>
                    )
                  )}
                </div>

                <div className="pt-4 flex gap-2">
                  <button type="button" onClick={() => router.back()} className="px-5 py-2.5 bg-gray-500 text-white font-medium rounded hover:bg-gray-600 transition flex items-center gap-2 cursor-pointer">
                    <ArrowLeft size={16} /> Batal
                  </button>
                  <button type="submit" disabled={isLoading} className="px-6 py-2.5 bg-[#c7d6ab] text-gray-800 font-bold rounded hover:bg-[#b5c796] transition flex items-center cursor-pointer disabled:opacity-50">
                    <Save size={16} className="mr-2" /> {isLoading ? "Menyimpan..." : "Submit Data"}
                  </button>
                </div>

              </div>
            </div>
          </form>
        </div>

        {/* Footer Area: Tombol Reset Password */}
        <div className="bg-gray-50 p-6 border-t border-gray-200 flex justify-center items-center h-[100px]">
          <button
            onClick={() => setIsResetModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white text-gray-800 rounded hover:bg-gray-100 transition shadow-sm font-medium cursor-pointer"
          >
            <KeyRound size={18} /> Reset Password to Default
          </button>
        </div>

      </div>

      {/* MODAL RESET PASSWORD */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-[500px] overflow-hidden">
            <div className="px-4 py-3 border-b flex justify-between items-center">
              <h5 className="font-bold text-lg text-black">Konfirmasi Reset Password</h5>
              <button onClick={() => setIsResetModalOpen(false)} className="text-gray-400 hover:text-black font-bold text-xl cursor-pointer">×</button>
            </div>

            <div className="p-5 text-gray-800">
              Apakah Anda yakin ingin mereset password untuk <b className="text-[#C30544]">{formData.nama}</b> kembali ke pengaturan *default*?
            </div>

            <div className="px-4 py-3 border-t flex justify-end gap-2 bg-gray-50">
              <button onClick={() => setIsResetModalOpen(false)} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition cursor-pointer">Batal</button>
              <button onClick={handleResetPassword} className="px-4 py-2 bg-yellow-500 text-white font-bold rounded hover:bg-yellow-600 transition cursor-pointer shadow-sm">
                Proses Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}