/**
 * Utility ringan untuk dekoding JWT di sisi klien (frontend).
 *
 * **PENTING - Konsep Arsitektural:**
 * Modul ini secara eksplisit **TIDAK melakukan verifikasi kriptografik (signature validation)**.
 * Keamanan autentikasi dan validasi signature tetap menjadi **otoritas penuh backend Go** 
 * (melalui middleware `RequireAuth()`). 
 * 
 * **Tujuan Utama:**
 * 1. **Stateless UI Behavior**: Mengekstrak data non-sensitif (seperti nama, peran/level, area) dari payload 
 *    untuk digunakan oleh komponen UI tanpa perlu melakukan pemanggilan API (fetch user profile) setiap kali render.
 * 2. **Sinkronisasi Waktu Kadaluarsa (Expiry)**: Membaca claim `exp` agar frontend (melalui `SessionManager`) 
 *    memiliki acuan waktu pasti kapan sebuah sesi akan berakhir. Menghindari sistem tebak-tebakan waktu
 *    dengan menggunakan timer lokal yang rentan terhadap perbedaan waktu (clock skew).
 */

export interface DecodedToken {
  exp?: number;
  user_id?: number;
  username?: string;
  nama?: string;
  level?: string;
  area?: string;
  detail_area?: string;
  [key: string]: unknown;
}

/**
 * Decode payload JWT (bagian tengah, base64url) jadi object.
 * Return null kalau token bukan format JWT yang valid
 * (mis. "guest-token" yang cuma string biasa, bukan 3 bagian dipisah titik).
 */
export function decodeJWT(token: string): DecodedToken | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const decoded = atob(padded);

    const json = decodeURIComponent(
      decoded
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );

    return JSON.parse(json) as DecodedToken;
  } catch {
    return null;
  }
}

/** Waktu expiry token dalam milidetik (epoch), atau null kalau tidak terbaca. */
export function getTokenExpiryMs(token: string): number | null {
  const decoded = decodeJWT(token);
  if (!decoded || typeof decoded.exp !== "number") return null;
  return decoded.exp * 1000;
}

export function isTokenExpired(token: string): boolean {
  const expiryMs = getTokenExpiryMs(token);
  if (expiryMs === null) return true;
  return Date.now() >= expiryMs;
}