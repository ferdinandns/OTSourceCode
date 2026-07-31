'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export default function IdleTimerProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogout = useCallback(() => {
    localStorage.clear();
    sessionStorage.clear();
    router.push('/login');
  }, [router]);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    // Set 30 menit (30 * 60 * 1000)
    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, 1800000); 
  }, [handleLogout]);

  useEffect(() => {
    // Event yang dianggap sebagai aktivitas user
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    resetTimer();
    events.forEach(e => window.addEventListener(e, resetTimer));

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [resetTimer]);

  return <>{children}</>;
}