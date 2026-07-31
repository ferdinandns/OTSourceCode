import Cookies from "js-cookie";

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8011");
console.log("Cek API URL:", process.env.NEXT_PUBLIC_API_BASE_URL);

export const SESSION_EXPIRED_EVENT = "session-expired";

/**
 * Wrapper di atas fetch() bawaan. Berperan sebagai jembatan utama (API Gateway/Interceptor)
 * antara aplikasi frontend NextJS dan backend Go. Pakai ini untuk SEMUA pemanggilan API
 * yang butuh token (selain login/refresh-token/logout yang memiliki penanganan khusus).
 *
 * **Alasan Arsitektural & Alur Logika:**
 * 1. **Injeksi Token Sentralistik**: Menghindari repetisi kode pengambilan token dari cookie
 *    dan pemasangan header `Authorization` di setiap komponen.
 * 2. **Event-Driven Error Handling (401 Unauthorized)**: Jika backend Go menolak akses (karena token kadaluarsa
 *    atau dicabut), fungsi ini tidak memblokir atau melakukan redirect secara langsung. Sebaliknya, ia 
 *    menyiarkan (broadcast) event `SESSION_EXPIRED_EVENT`.
 * 3. **Pemisahan Tanggung Jawab (Separation of Concerns)**: Pengkondisian redirect atau tampilan modal
 *    diserahkan ke `SessionManager` yang akan mendengarkan event ini. Komponen yang memanggil API 
 *    tetap bisa fokus menangani state datanya (menampilkan error fetch, dsb) secara independen.
 *
 * @param {string} input - URL atau endpoint tujuan fetch
 * @param {RequestInit} [init={}] - Konfigurasi fetch opsional (method, body, dll)
 * @returns {Promise<Response>} Respons asli dari fungsi `fetch` bawaan browser
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = Cookies.get("token");
  const level = Cookies.get("level");

  const headers = new Headers(init.headers);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(input, { ...init, headers });

  // Guest pakai token dummy yang memang selalu ditolak backend sebagai
  // token tidak valid (bukan soal expired). Jangan trigger modal re-login
  // untuk kasus ini -- guest tidak punya password untuk re-login lewat modal.
  // Biarkan pemanggilnya (komponen card, dst) menangani errornya sendiri
  // seperti biasa (mis. lewat alert()).
  if (response.status === 401 && level !== "guest" && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }

  return response;
}