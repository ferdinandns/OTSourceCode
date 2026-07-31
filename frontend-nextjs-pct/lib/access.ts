"use client";

import Cookies from "js-cookie";

/**
 * Konfigurasi Role-Based Access Control (RBAC) pada sisi klien.
 *
 * **Konsep Arsitektural:**
 * 1. **Duplikasi Logika Cermin**: Struktur data dan validasi akses di sini dirancang untuk
 *    menjadi bayangan 1:1 dari logika autentikasi middleware di backend Go:
 *    - `middleware.AccessArea("Administrator", "PPIC")`
 *    - `middleware.AccessLevel("administrator", "manager")`
 *    - `middleware.AccessDetailArea(h.db, "Administrator", "PPIC Site")`
 * 2. **Tujuan**: Untuk menyembunyikan tombol, form, atau elemen UI dari pandangan pengguna
 *    jika pada dasarnya permintaan API mereka tetap akan ditolak oleh backend (403 Forbidden).
 *    Ini meminimalisir bad-UX di mana pengguna menekan tombol namun berujung error.
 * 3. **Prinsip Fail-Open / Default-Allow (untuk list kosong)**: Dimensi rule yang dikosongkan (undefined / empty array)
 *    akan dianggap LOLOS / tidak dibatasi. Mekanisme ini identik dengan cara kerja middleware Go 
 *    saat menerima parameter variadic kosong.
 */
export interface AccessRule {
  areas?: string[];
  levels?: string[];
  detailAreas?: string[];
}

export interface CurrentUserAccess {
  area: string;
  level: string;
  detailArea: string;
}

export function getCurrentUserAccess(): CurrentUserAccess {
  return {
    area: Cookies.get("area") ?? "",
    level: Cookies.get("level") ?? "",
    detailArea: Cookies.get("detailArea") ?? Cookies.get("detail_area") ?? "",
  };
}

function matches(value: string, allowed?: string[]): boolean {
  if (!allowed || allowed.length === 0) return true;
  return allowed.some((a) => a.toLowerCase() === value.toLowerCase());
}


export function hasAccess(rule?: AccessRule): boolean {
  if (!rule) return true;
  const user = getCurrentUserAccess();
  return (
    matches(user.area, rule.areas) &&
    (matches(user.level, rule.levels) ||
     matches(user.detailArea, rule.detailAreas))
  );
}