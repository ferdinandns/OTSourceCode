"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import Cookies from "js-cookie";
import { 
  Home, Users, Box, List, LineChart, 
  FileSpreadsheet, LogOut, ChevronDown, 
  Gauge, Pencil
} from "lucide-react";
import Image from "next/image";
import { API_BASE_URL, apiFetch } from "@/lib/api";

interface SidebarProps {
  isOpen: boolean;
  setIsOpen?: (val: boolean) => void; 
}

/**
 * Komponen Navigasi Utama Aplikasi.
 * 
 * **Konsep Arsitektural:**
 * 1. **Client-Side Rendering (CSR)**: Menggunakan `"use client"` karena bergantung pada
 *    state (isOpen, dsb) dan mengakses `Cookies` secara langsung untuk mendapatkan informasi
 *    pengguna (nama, role/level). 
 * 2. **Conditional Menu Rendering**: Merender item menu secara dinamis berdasarkan 
 *    `level` pengguna. Konsep ini berjalan paralel dengan validasi API di backend; 
 *    frontend menyembunyikan menu yang tidak boleh diakses (`hasElevatedAccess`), 
 *    dan backend menjaga agar endpointnya pun tidak bocor meskipun user tahu URL-nya.
 * 3. **Sinkronisasi State Global**: Menerima prop `isOpen` dari Layout untuk
 *    menyesuaikan lebar (collapse/expand) berdasarkan interaksi di Navbar atas.
 *
 * @param {SidebarProps} props - Properti untuk mengontrol perilaku buka/tutup sidebar
 */
export default function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState("");
  const [userArea, setUserArea] = useState("");
  const [userLevel, setUserLevel] = useState("");
  const [userId, setUserId] = useState("");
  const [isThresholdOpen, setIsThresholdOpen] = useState(false);
  
  // State baru untuk mengontrol popup konfirmasi logout
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  useEffect(() => {
    setUserName(Cookies.get("nama") || "User");
    setUserArea(Cookies.get("area") || "Unknown Area");
    setUserLevel((Cookies.get("level") || "").toLowerCase());
    setUserId(Cookies.get("id") || "");
  }, []);

  const restrictedLevels = ["administrator", "manager", "supervisor"];
  const hasElevatedAccess = restrictedLevels.includes(userLevel);
  const isGuest = userLevel === "guest";

  const handleLogout = async () => {
    const token = Cookies.get("token");
    
    if (token) {
      try {
        await apiFetch(`${API_BASE_URL}/api/v1/logout`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });
      } catch (error) {
        console.error("Gagal mencatat aktivitas logout di server:", error);
      }
    }

    Cookies.remove("token");
    Cookies.remove("nama");
    Cookies.remove("username");
    Cookies.remove("level");
    Cookies.remove("area");
    Cookies.remove("id");
    
    // Tutup modal sebelum redirect (opsional, tapi bagus untuk UX)
    setIsLogoutModalOpen(false); 
    router.push("/login");
  };

  const menuItems = isGuest
    ? [{ name: "Dashboard", icon: Home, path: "/home" }]
    : [
        { name: "Dashboard", icon: Home, path: "/home" },
        ...(hasElevatedAccess
          ? [
              { name: "User Account List", icon: Users, path: "/user-list" },
              { name: "Product", icon: Box, path: "/product" },
            ]
          : []),
        { name: "Audit Trail", icon: List, path: "/audit-trail" },
        { name: "Report", icon: LineChart, path: "/report" },
      ];

  return (
    <>
      <aside
        className={`fixed top-0 left-0 z-50 h-screen bg-white border-r border-gray-200 transition-all duration-300 ease-in-out flex flex-col pt-16 ${
          isOpen ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0 w-64 md:w-20"
        }`}
      >
        {/* Profile Section */}
        <div className={`flex items-center p-4 border-b border-gray-200 transition-all duration-300 ease-in-out shrink-0 ${!isOpen ? "md: md:px-0 gap-0 gap-3" : "gap-3"}`}>
          <Image 
            width={48}
            height={48}
            src="/image/Bintang-Toedjo-removebg-preview (1).png" 
            alt="Profile" 
            className="w-12 h-12 object-contain shrink-0 transition-transform duration-300 ease-in-out" 
            style={{ transform: "rotate(-90deg)" }} 
          />
          <div className={`flex flex-col whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? "opacity-100 max-w-[150px]" : "opacity-0 max-w-0"}`}>
            <p className="text-sm font-bold text-gray-800 truncate flex items-center gap-1">
              {userName}
              {!isGuest && (
                <Link
                  href={`/user-list/edit/${userId}`}
                  title="Edit Profil"
                  className="text-gray-400 hover:text-black transition-colors shrink-0"
                >
                  <Pencil size={11} />
                </Link>
              )}
            </p>
            <p className="text-xs text-gray-500 truncate">Area: <span className="font-medium text-black">{userArea}</span></p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1 overflow-y-auto flex-1 custom-scrollbar mt-2">
          {menuItems.map((item) => {
            const isActive = pathname.startsWith(item.path);
            return (
              <Link 
                key={item.name} 
                href={item.path}
                className={`flex items-center px-3 py-2.5 rounded-md transition-all duration-300 ease-in-out ${
                  isActive ? "bg-[#c7d6ab] font-medium text-black" : "text-gray-700 hover:bg-[#c7d6ab]/80 hover:translate-x-1"
                } ${!isOpen ? "md:gap-3" : "gap-3"}`}
                title={item.name}
              >
                <item.icon size={18} className={`shrink-0 transition-colors duration-300 ${isActive ? "text-black" : "text-gray-600"}`} />
                <span className={`text-sm whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? "opacity-100 max-w-[200px]" : "opacity-0 max-w-0"}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}

          {!isGuest && hasElevatedAccess && (
          <>
          <div className="overflow-hidden">
            <button 
              onClick={() => {
                if (!isOpen && setIsOpen) {
                  setIsOpen(true);
                  setIsThresholdOpen(true);
                } else {
                  setIsThresholdOpen(!isThresholdOpen);
                }
              }}
              className={`w-full flex items-center px-3 py-2.5 rounded-md transition-all duration-300 ease-in-out text-gray-700 hover:bg-[#c7d6ab]/80 hover:translate-x-1 cursor-pointer ${!isOpen ? "md:" : "justify-between"}`}
              title="Threshold"
            >
              <div className={`flex items-center transition-all duration-300 ${!isOpen ? "gap-3" : "gap-3"}`}>
                <Gauge size={18} className="text-gray-600 shrink-0" />
                <span className={`text-sm whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? "opacity-100 max-w-[100px]" : "opacity-0 max-w-0"}`}>
                  Threshold
                </span>
              </div>
              <ChevronDown size={16} className={`shrink-0 transition-all duration-300 ease-in-out ${isThresholdOpen ? "rotate-180" : ""} ${isOpen ? "opacity-100 max-w-[20px]" : "opacity-0 max-w-0"}`} />
            </button>
            
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isThresholdOpen && isOpen ? "max-h-19 opacity-100 mt-1" : "max-h-0 opacity-0 mt-0"}`}>
              <div className="ml-8 space-y-1">
                <Link href="/thresholds/product-category" className="block px-3 py-2 text-sm text-gray-600 rounded-md hover:bg-[#c7d6ab]/80 hover:translate-x-1 transition-all duration-300">Product Category</Link>
                <Link href="/thresholds/product-alert" className="block px-3 py-2 text-sm text-gray-600 rounded-md hover:bg-[#c7d6ab]/80 hover:translate-x-1 transition-all duration-300">Product</Link>
              </div>
            </div>
          </div>

          <Link 
            href="/raw-data"
            className={`flex items-center px-3 py-2.5 rounded-md transition-all duration-300 ease-in-out text-gray-700 hover:bg-[#c7d6ab]/80 hover:translate-x-1 ${!isOpen ? "md:gap-3" : "gap-3"}`}
            title="Raw Data"
          >
            <FileSpreadsheet size={18} className="text-gray-600 shrink-0" />
            <span className={`text-sm whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? "opacity-100 max-w-[200px]" : "opacity-0 max-w-0"}`}>
              Raw Data
            </span>
          </Link>
          </>
          )}

          {/* Tombol Logout sekarang membuka modal, bukan langsung mengeksekusi fungsi */}
          <button 
            onClick={() => setIsLogoutModalOpen(true)}
            className={`w-full flex items-center px-3 py-2.5 rounded-md transition-all duration-300 ease-in-out text-red-600 hover:bg-red-50 hover:translate-x-1 cursor-pointer ${!isOpen ? "md:gap-3" : "gap-3"} ${
              !hasElevatedAccess || isGuest
                ? "mt-2"
                : (isThresholdOpen && isOpen) ? "mt-2" : "mt-[88px]"
            }`}
            title="Logout"
          >
            <LogOut size={18} className="shrink-0" />
            <span className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? "opacity-100 max-w-[200px]" : "opacity-0 max-w-0"}`}>
              Logout
            </span>
          </button>
        </nav>
      </aside>

      {/* Popup Konfirmasi Logout */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-lg shadow-xl w-[90%] max-w-sm p-6 transform transition-all">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Konfirmasi Logout</h3>
            <p className="text-gray-600 text-sm mb-6">
              Apakah Anda yakin ingin keluar dari aplikasi?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsLogoutModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-red-600 bg-white rounded-md border-red-600 border hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
              >
                Ya, Keluar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}