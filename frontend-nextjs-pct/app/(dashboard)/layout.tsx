"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import Sidebar from "@/components/sidebar";
import { Menu, X, Info } from "lucide-react";
import SessionManager from "@/components/sessionManager";
import { isTokenExpired } from "@/lib/jwt";

/**
 * Layout Khusus untuk Area Dashboard (Terkunci/Authenticated).
 * 
 * **Konsep Arsitektural:**
 * 1. **Client-Side Shell**: Menggunakan `"use client"` karena memuat komponen stateful 
 *    seperti `Sidebar` (buka/tutup), pengecekan `Cookies` saat mount, dan `SessionManager`.
 * 2. **Integrasi SessionManager**: Meletakkan `<SessionManager />` di tingkat layout 
 *    memastikan bahwa pemantauan idle dan auto-refresh token berjalan terus-menerus 
 *    selama pengguna berada di halaman mana pun di dalam `/home`, `/report`, dsb,
 *    tanpa ter-unmount saat berpindah halaman.
 * 3. **Validasi Rute Sederhana**: Memiliki pengecekan keberadaan token di awal (`useEffect`).
 *    Ini adalah proteksi lapisan pertama di frontend; perlindungan sesungguhnya tetap
 *    dilakukan oleh API backend yang merespon 401 jika token dimanipulasi.
 *
 * @param {React.ReactNode} children - Halaman dashboard (seperti Home, Report) yang akan dirender di area konten utama.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = Cookies.get("token");
    const level = Cookies.get("level");

    if (!token) {
      router.push("/login");
      return;
    }

    if (level !== "guest" && isTokenExpired(token)) {
      setIsAuthorized(true);
      return;
    }

    setIsAuthorized(true);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#f1f1f1]">
      <SessionManager />
      {/* Tombol Buka/Tutup Sidebar */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed top-3 left-4 z-[60] p-2 bg-white shadow-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-100 transition-all flex items-center justify-center cursor-pointer"
        aria-label="Toggle Sidebar"
      >
        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Tambahkan setIsOpen ke Sidebar */}
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      {/* Main Content Area */}
      <div className={`transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : "md:ml-20"}`}>
        
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-end px-4 sticky top-0 z-40">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 p-2 text-[#2e3b4e] hover:bg-gray-100 rounded-full transition cursor-pointer"
          >
            <Info size={24} />
          </button>
        </header>

        {/* Page Content */}
        <main className="p-6 min-h-[calc(100vh-120px)]">
          {children}
        </main>

        {/* Footer */}
        <footer className="p-4 text-center text-gray-500 text-xs bg-light mt-auto">
          &copy; 2026 PT Bintang Toedjoe - Tracking Batch System. All Rights Reserved.
        </footer>
      </div>

      {/* Modal Info Aplikasi */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-lg w-[400px] overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-4 border-b">
              <h5 className="font-bold text-lg text-black">Tentang Aplikasi</h5>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-black cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 text-center">
              <img src="/image/developers-logo.jpg" alt="Foto Pembuat" className="rounded-full mx-auto mb-4 w-[120px] shadow-sm" />
              <h5 className="text-black font-bold mb-1">Development</h5>
              <p className="text-gray-500 text-sm mb-4">Pristy | Ivan | Nadia</p>
              <h5 className="text-black font-bold mb-1">Migration</h5>
              <p className="text-gray-500 text-sm mb-4">Farrel</p>
              <p className="text-sm text-gray-700">
                Aplikasi ini dibuat untuk membantu mengetahui leadtime tiap proses yang sedang berlangsung. <br />
                Dikembangkan dengan framework <strong>Laravel</strong>, telah dimodernisasi ke <strong>Golang dan Next.js</strong> yang lebih optimal.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}