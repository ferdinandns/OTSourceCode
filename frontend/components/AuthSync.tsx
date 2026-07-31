// components/AuthSync.tsx
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthSync() {
  const router = useRouter();

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      // Sesuaikan 'token' dengan key yang kamu pakai saat login
      if (event.key === 'token') {
        alert("Sesi telah berubah atau akun lain login di tab sebelah. Halaman akan dimuat ulang.");
        window.location.reload();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [router]);

  // Karena ini cuma buat logic background, kita return null aja biar nggak merusak UI
  return null; 
}