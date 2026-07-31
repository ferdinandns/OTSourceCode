"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { Eye, EyeOff } from "lucide-react";
import { API_BASE_URL, SESSION_EXPIRED_EVENT } from "@/lib/api";
import { getTokenExpiryMs } from "@/lib/jwt";

// Konfigurasi Waktu (dalam milidetik)
const SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 1 Jam idle -> popup muncul (kebijakan keamanan idle, terpisah dari exp token)
const TOKEN_REFRESH_THRESHOLD_MS = 15 * 60 * 1000; // Refresh token diam-diam kalau sisa waktu token < 15 menit & user masih aktif
const CHECK_INTERVAL_MS = 60 * 1000; // Cek kondisi setiap 1 menit

/**
 * Komponen Sentral untuk Manajemen Sesi dan Autentikasi Pengguna (Client-Side).
 * 
 * **Konsep Arsitektural:**
 * Komponen ini berjalan di *root layout* aplikasi, yang berarti ia ter-mount satu kali
 * dan terus hidup (persistent) selama pengguna berada di dalam aplikasi.
 * 
 * **Alur Logika & Tanggung Jawab Utama:**
 * 1. **Pemantauan Idle (Inactivity Timer)**: Mendeteksi interaksi pengguna (mouse, keyboard).
 *    Jika tidak ada aktivitas melebihi `SESSION_TIMEOUT_MS`, pengguna dianggap *idle* dan
 *    sesi dikunci secara paksa meskipun token secara kriptografik masih berlaku.
 * 2. **Auto-Refresh Token di Background (Silent Refresh)**: Menghindari sesi terputus saat 
 *    pengguna sedang aktif bekerja. Jika umur token tersisa < `TOKEN_REFRESH_THRESHOLD_MS`
 *    dan pengguna tercatat aktif, ia akan memanggil API `/refresh-token` tanpa disadari pengguna.
 * 3. **Event Listener (Global Error Handler)**: Berkolaborasi dengan `lib/api.ts`. Jika `apiFetch`
 *    menangkap status HTTP 401, `SessionManager` akan menerima event `SESSION_EXPIRED_EVENT` 
 *    dan segera memunculkan modal Re-Login tanpa menunggu polling interval berikutnya.
 * 
 * Desain ini memisahkan logika "keamanan sesi" (di sini) dari "logika tampilan UI komponen lain"
 * sehingga komponen lain tidak perlu mengurus handling 401 dan redirect login berulang kali.
 *
 * @returns React Node (Render modal re-login jika expired, atau null jika masih valid)
 */
export default function SessionManager() {
    const router = useRouter();
    const [isExpired, setIsExpired] = useState(false);
    const [expiredReason, setExpiredReason] = useState<"idle" | "token" | "server" | null>(null);

    // Form State
    const [savedName, setSavedName] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    // Ref untuk tracking waktu aktivitas tanpa memicu re-render React
    const lastActivityTime = useRef<number>(Date.now());
    // Guard supaya tidak ada 2 request refresh nyasar bersamaan
    const isRefreshingRef = useRef<boolean>(false);

    // Ambil nama user saat komponen di-mount
    useEffect(() => {
        const nama = Cookies.get("nama") || "User";
        setSavedName(nama);
    }, []);

    // Fungsi untuk mengupdate waktu aktivitas terakhir
    const updateActivity = useCallback(() => {
        lastActivityTime.current = Date.now();
    }, []);

    // Setup Event Listeners untuk mendeteksi pergerakan/aktivitas
    useEffect(() => {
        const events = ["mousemove", "keydown", "mousedown", "touchstart"];

        events.forEach((event) => {
            window.addEventListener(event, updateActivity);
        });

        return () => {
            events.forEach((event) => {
                window.removeEventListener(event, updateActivity);
            });
        };
    }, [updateActivity]);

    const checkSession = useCallback(async () => {
        const token = Cookies.get("token");
        const level = Cookies.get("level");

        if (level === "guest") {
            if (!token) {
                router.push("/login");
            }
            return;
        }

        if (!token) {
            setIsExpired(false);
            router.push("/login");
            return;
        }

        const expiryMs = getTokenExpiryMs(token);

        // Token tidak terbaca / rusak formatnya -> perlakukan sebagai expired
        if (expiryMs === null) {
            setExpiredReason("token");
            setIsExpired(true);
            return;
        }

        const now = Date.now();
        const msUntilExpiry = expiryMs - now;
        const inactiveDuration = now - lastActivityTime.current;

        // 1. Token BENERAN sudah lewat waktu expired (sumber: exp asli dari backend)
        if (msUntilExpiry <= 0) {
            setExpiredReason("token");
            setIsExpired(true);
            return;
        }

        // 2. Kebijakan idle: user tidak aktif selama SESSION_TIMEOUT_MS meski token masih hidup
        if (inactiveDuration >= SESSION_TIMEOUT_MS) {
            setExpiredReason("idle");
            setIsExpired(true);
            return;
        }

        // 3. User masih aktif & token akan expired sebentar lagi -> auto-refresh diam-diam
        if (msUntilExpiry <= TOKEN_REFRESH_THRESHOLD_MS && !isRefreshingRef.current) {
            isRefreshingRef.current = true;
            try {
                const response = await fetch(`${API_BASE_URL}/api/v1/refresh-token`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    Cookies.set("token", data.token, { expires: 1 });
                    console.log("Token successfully auto-refreshed in background.");
                } else if (response.status === 401) {
                    // Token ditolak server walau secara exp harusnya masih hidup
                    // (mis. dicabut manual) -> munculkan popup langsung, jangan diam-diam gagal.
                    setExpiredReason("server");
                    setIsExpired(true);
                }
            } catch (error) {
                console.error("Failed to auto-refresh token:", error);
            } finally {
                isRefreshingRef.current = false;
            }
        }
    }, [router]);

    // Cek langsung saat mount 
    useEffect(() => {
        checkSession();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Interval Checker rutin
    useEffect(() => {
        const intervalId = setInterval(checkSession, CHECK_INTERVAL_MS);
        return () => clearInterval(intervalId);
    }, [checkSession]);

    // Jaring pengaman: dengar sinyal 401 REAL dari request manapun di app
    // (lewat apiFetch di lib/api.ts). Begitu ada 401 di manapun,
    // modal langsung muncul, tidak perlu nunggu interval berikutnya.
    useEffect(() => {
        const handleSessionExpired = () => {
            setExpiredReason("server");
            setIsExpired(true);
        };
        window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
        return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    }, []);

    // Handle Logout dari Modal
    const handleLogout = async () => {
        const token = Cookies.get("token");
        
        // Tembak API Logout jika token masih ada
        if (token) {
            try {
                await fetch(`${API_BASE_URL}/api/v1/logout`, {
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

        // Hapus semua cookies yang tersimpan
        Cookies.remove("token");
        Cookies.remove("nama");
        Cookies.remove("username"); 
        Cookies.remove("level");
        Cookies.remove("area");
        Cookies.remove("id"); 
        
        router.push("/login");
    };

    // Handle Re-Login dari Modal
    const handleReLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMsg("");

        try {
            const usernameStr = Cookies.get("username") || savedName;

            const response = await fetch(`${API_BASE_URL}/api/v1/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: usernameStr, password }),
            });

            const data = await response.json();

            if (response.ok) {
                Cookies.set("token", data.token, { expires: 1 });
                // Reset activity timer & state
                lastActivityTime.current = Date.now();
                setIsExpired(false);
                setExpiredReason(null);
                setPassword("");
            } else {
                setErrorMsg(data.message || "Password salah, silakan coba lagi.");
            }
        } catch (error) {
            setErrorMsg("Tidak dapat terhubung ke server backend Go.");
        } finally {
            setIsLoading(false);
        }
    };

    // Jika belum expired, jangan render apa-apa (komponen berjalan di background)
    if (!isExpired) return null;

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-100 overflow-hidden animate-in fade-in zoom-in duration-300 mx-4">

                {/* Header Modal */}
                <div className="bg-[#f8faf5] px-6 py-4 border-b border-gray-200 text-center">
                    <h2 className="text-xl font-bold text-[#333]">Sesi Berakhir</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        {expiredReason === "idle" &&
                            "Sistem mendeteksi tidak ada aktivitas selama 1 jam."}
                        {expiredReason === "token" &&
                            "Sesi login Anda telah habis masa berlakunya."}
                        {expiredReason === "server" &&
                            "Sesi Anda ditolak oleh server, silakan login kembali."}
                        {expiredReason === null &&
                            "Silakan masukkan password untuk melanjutkan."}
                    </p>
                </div>

                <div className="p-6">
                    {/* Info Akun Terakhir */}
                    <div className="flex items-center justify-center gap-3 mb-6 p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="w-10 h-10 bg-[#c7d6ab] rounded-full flex items-center justify-center text-[#333] font-bold text-lg">
                            {savedName.charAt(0).toUpperCase()}
                        </div>
                        <div className="text-left">
                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Account</p>
                            <p className="text-[#333] font-bold">{savedName}</p>
                        </div>
                    </div>

                    {errorMsg && (
                        <div className="bg-[#f2dede] border border-[#ebccd1] text-[#a94442] p-3 mb-4 rounded text-sm text-center">
                            {errorMsg}
                        </div>
                    )}

                    {/* Form Re-Login */}
                    <form onSubmit={handleReLogin}>
                        <div className="mb-6">
                            <label className="block text-sm font-bold mb-1.5 text-[#333]">
                                Masukkan Password untuk Melanjutkan
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    required
                                    className="block w-full h-9.5 px-3 py-1.5 pr-10 text-sm text-[#555] bg-white border border-[#ccc] rounded shadow-[inset_0_1px_1px_rgba(0,0,0,0.075)] focus:border-[#c7d6ab] focus:outline-none focus:ring-1 focus:ring-[#c7d6ab] transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 cursor-pointer"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors border border-transparent cursor-pointer"
                            >
                                Logout
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="flex-1 px-4 py-2 text-sm font-medium text-black bg-[#c7d6ab] rounded hover:bg-[#b5c599] transition-colors disabled:opacity-70 disabled:cursor-not-allowed border border-transparent cursor-pointer"
                            >
                                {isLoading ? "Memverifikasi..." : "Continue"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}