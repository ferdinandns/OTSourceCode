// src/app/(dashboard)/user-list/add/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, ArrowLeft } from "lucide-react";
import Cookies from "js-cookie";
import { API_BASE_URL, apiFetch } from "@/lib/api"; 
import { stringifyError } from "next/dist/shared/lib/utils";

// Mapping Level berdasarkan Department
const deptToLevelMap: Record<string, string[]> = {
  "Administrator": ["administrator"],
  "Production": ["manager", "supervisor", "staff_prod"],
  "Engineering": ["manager", "supervisor", "staff_tk"],
  "Warehouse": ["manager", "supervisor", "staff_wh"],
  "Technical Service": ["manager", "supervisor", "staff_ts"],
  "General Affair": ["manager", "supervisor", "staff_ga"],
  "Manufacturing Development": ["manager", "supervisor", "staff_md"],
  "Quality Assurance": ["manager", "supervisor", "staff_qa"],
  "Quality Control": ["manager", "supervisor", "staff_qc"],
};

const levelLabels: Record<string, string> = {
  administrator: "Administrator",
  manager: "Manager",
  supervisor: "Supervisor",
  staff_prod: "Staff", staff_tk: "Staff", staff_wh: "Staff",
  staff_ts: "Staff", staff_ga: "Staff", staff_md: "Staff",
  staff_qa: "Staff", staff_qc: "Staff",
};

export default function AddAccountPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    nik: "",
    username: "",
    department: "",
    level: ""
  });

  const handleDeptChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData({ 
      ...formData, 
      department: e.target.value, 
      level: "" // Reset level saat departemen berubah
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const token = Cookies.get("token"); 

      const response = await apiFetch(`${API_BASE_URL}/api/v1/master/users/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        // Mapping persis dengan struct AddUser di request_user.go
        body: JSON.stringify({
          nama: formData.name,
          nik: formData.nik,
          username: formData.username,
          area: formData.department,
          level: formData.level
        }),
      });

      let result;
      // Gunakan try-catch untuk parsing karena backend bisa mereturn string (saat sukses) atau JSON object (saat error)
      try {
        result = await response.json();
      } catch (err) {
        throw new Error(stringifyError(err));
      }

      if (!response.ok) {
        throw new Error(result.meta?.message || result.error || "Gagal menambahkan akun.");
      }
      
      // Saat sukses, result berupa string "Data pengguna berhasil ditambahkan!"
      alert(result.meta?.message || "Berhasil menambahkan akun!");
      router.push("/user-list"); 
      
    } catch (error: any) {
      console.error("Error submitting data:", error);
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const availableLevels = formData.department ? deptToLevelMap[formData.department] : [];

  return (
    <div className="w-full md:w-[95%] mx-auto bg-transparent min-h-[500px]">
      
      <div className="mb-4">
        <h2 className="text-3xl font-semibold text-gray-800">Add Account</h2>
        <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
          <span className="cursor-pointer hover:text-blue-600 transition" onClick={() => router.push("/user-list")}>User List Account</span> 
          <span>/</span> 
          <span>Add Account</span>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center gap-2 text-gray-700 font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
          New Account
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4 max-w-3xl">
            
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-2">
              <label className="text-gray-700 text-sm font-medium">Full Name</label>
              <div className="md:col-span-3">
                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 text-black" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-2">
              <label className="text-gray-700 text-sm font-medium">NIK</label>
              <div className="md:col-span-3">
                <input type="text" required value={formData.nik} onChange={e => setFormData({...formData, nik: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 text-black" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-2">
              <label className="text-gray-700 text-sm font-medium">Username</label>
              <div className="md:col-span-3">
                <input type="text" required value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 text-black" />
              </div>
            </div>

            {/* <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-2">
              <label className="text-gray-700 text-sm font-medium">Password</label>
              <div className="md:col-span-3 relative flex items-center">
                <input 
                  type={showPassword ? "text" : "password"} 
                  required 
                  minLength={8}
                  placeholder="********************"
                  value={formData.password} 
                  onChange={e => setFormData({...formData, password: e.target.value})} 
                  className="w-full border border-gray-300 rounded-l p-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 text-black" 
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="bg-white border border-l-0 border-gray-300 rounded-r p-2 text-gray-500 hover:bg-gray-50 transition cursor-pointer">
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div> */}

            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-2">
              <label className="text-gray-700 text-sm font-medium">Department</label>
              <div className="md:col-span-3">
                <select required value={formData.department} onChange={handleDeptChange} className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 text-black bg-white cursor-pointer">
                  <option value="" disabled>Choose Department</option>
                  {Object.keys(deptToLevelMap).map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-2">
              <label className="text-gray-700 text-sm font-medium">Level</label>
              <div className="md:col-span-3">
                <select required value={formData.level} onChange={e => setFormData({...formData, level: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 text-black bg-white cursor-pointer" disabled={!formData.department}>
                  <option value="" disabled>Choose Level</option>
                  {availableLevels.map(lvl => (
                    <option key={lvl} value={lvl}>{levelLabels[lvl]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-4 flex gap-2">
              <button type="button" onClick={() => router.push("/user-list")} className="px-5 py-2 bg-gray-500 text-white font-medium rounded hover:bg-gray-600 transition flex items-center gap-2 cursor-pointer">
                <ArrowLeft size={16} /> Back
              </button>
              <button type="submit" disabled={isLoading} className="px-6 py-2 bg-[#C30544] text-white font-medium rounded hover:bg-[#a00438] transition flex items-center gap-2 cursor-pointer disabled:opacity-50">
                <Save size={16} /> {isLoading ? "Submitting..." : "Submit"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}