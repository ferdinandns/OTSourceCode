'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import IdleTimerProvider from '@/components/IdleTimeProvider';
import { apiFetch, API_BASE } from '@/lib/api';
import { useWebSocket } from '@/hooks/useWebsocket';
import { allMenus } from '@/lib/permissions';

interface NotificationItem {
  id: number;
  type: string;
  message: string;
  reference_id?: number;
  is_read: boolean;
  created_at: string;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [menus, setMenus] = useState(allMenus.filter(m => m.isGlobal));
  const [userName, setUserName] = useState<string>('User');
  const [userDept, setUserDept] = useState<string>('Staff');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState<boolean>(false);

  const [currentTime, setCurrentTime] = useState<string>('');

  // Notifications - state for badge and toast
  const processedNotifs = useRef<Set<number>>(new Set());
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [myTaskCount, setMyTaskCount] = useState(0);

  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [isSupervisor, setIsSupervisor] = useState(false);

  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);

  const [forceLogoutNotice, setForceLogoutNotice] = useState<{open: boolean; message: string}>({
    open: false,
    message: "",
  })

  const isActive = (path: string) => pathname === path;

  // Responsive: auto close sidebar on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Bunyi beep (opsional)
  const playBeep = () => {
    try {
      const ctx = new AudioContext();
      const times = [0, 0.15];
      times.forEach((startTime) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.frequency.value = 880;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0, ctx.currentTime + startTime);
        gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + startTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + 0.3);
        oscillator.start(ctx.currentTime + startTime);
        oscillator.stop(ctx.currentTime + startTime + 0.3);
      });
    } catch (e) {}
  };

  const fetchMyTaskCount = useCallback(async () => {
    try {
      const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/my-tasks`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          const d = json.data;
          const total =
            (d.inspections?.length || 0) +
            (d.verifications?.length || 0) +
            (d.approvals?.length || 0) +
            (d.repairs?.length || 0) +
            (d.refills?.length || 0);
          setMyTaskCount(total);
        }
      }
    } catch (err) {
      console.error('Gagal load my task count', err);
    }
  }, []);

  // WebSocket: update notifikasi dan bunyi beep
  useWebSocket({
    'NEW_NOTIFICATION': (data) => {
      if (processedNotifs.current.has(data.id)) return;
      processedNotifs.current.add(data.id);
      setNotifications((prev) => [data, ...prev]);
      setUnreadCount((prev) => prev + 1);
      playBeep();
      // Tampilkan toast
      setToast({ id: data.id, message: data.message });
      setTimeout(() => setToast(null), 5000); // hilang setelah 5 detik
    },
    'DATA_UPDATED': (data) => {
      fetchMyTaskCount();
    },
    'FORCE_LOGOUT': async (data) => {
      setForceLogoutNotice({
        open: true,
        message: data.message || "Akun anda telah dibuat oleh admin. Silahkan login kembali."
      });
    }
  });

  const confirmForceLogout = async () => {
    try {
      await apiFetch(`${API_BASE}/logout`, { method: 'POST'});
    } catch (e) {}
    setForceLogoutNotice({ open: false, message: "" });
    router.push('/login');
  }

  // Fallback polling for new notifications (every 10 seconds)
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications`);
        if (res.ok) {
          const json = await res.json();
          const newData = json.data || [];
          // Check for any notification not yet processed
          for (const item of newData) {
            if (!processedNotifs.current.has(item.id)) {
              processedNotifs.current.add(item.id);
              setNotifications((prev) => [item, ...prev]);
              setUnreadCount((prev) => prev + 1);
              playBeep();
              setToast({ id: item.id, message: item.message });
              setTimeout(() => setToast(null), 5000);
            }
          }
        }
      } catch (err) {
        // ignore polling errors
      }
    };
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      setCurrentTime(timeStr);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications`);
      if (res.ok) {
        const json = await res.json();
        const newData = json.data || [];
        newData.forEach((item: NotificationItem) => processedNotifs.current.add(item.id));
        setNotifications(newData);
        setUnreadCount(newData.filter((n: NotificationItem) => !n.is_read).length);
      }
    } catch (err) {
      console.error('Gagal menarik notifikasi', err);
    }
  }, []);

  // Simpan ref
  const fetchNotificationsRef = useRef(fetchNotifications);
  useEffect(() => {
    fetchNotificationsRef.current = fetchNotifications;
  }, [fetchNotifications]);

  // Event listener untuk refresh
  useEffect(() => {
    const handleRefresh = () => {
      fetchNotificationsRef.current();
    };
    window.addEventListener('refresh-notifications', handleRefresh);
    return () => window.removeEventListener('refresh-notifications', handleRefresh);
  }, []);

  useEffect(() => {

    const userId =
      localStorage.getItem('user_id') ||
      sessionStorage.getItem('user_id');

    if (!userId) {

      const currentUrl =
        window.location.pathname +
        window.location.search;

      router.replace(
        `/login?returnUrl=${encodeURIComponent(currentUrl)}`
      );

      return;
    }

    setCheckingAuth(false);

  }, [router]);

  useEffect(() => {

    if (checkingAuth) return;

    const loadUserData = async () => {

      try {

        const res =
          await apiFetch(
            `${process.env.NEXT_PUBLIC_API_URL}/me`
          );

        if (!res.ok) {

          if (res.status === 401) {

            localStorage.clear();
            sessionStorage.clear();

            const currentUrl =
              window.location.pathname +
              window.location.search;

            window.location.href =
              `/login?error=session_expired&returnUrl=${encodeURIComponent(currentUrl)}`;

            return;
          }

          return;
        }

        const json =
          await res.json();

        const data =
          json.data;

        setUserName(
          data.full_name ||
          data.fullName ||
          'User'
        );

        setUserDept(
          data.department_name ||
          'Staff'
        );

        setUserRoles(
          data.roles || []
        );

        setIsSupervisor(
          data.is_supervisor || false
        );

        const menuIDs =
          data.menus || [];

        setMenus(
          allMenus.filter(
            (m) =>
              menuIDs.includes(m.id)
          )
        );

        // Load my-task count after user data is obtained
        fetchMyTaskCount();

      } catch (err) {

        console.error(
          'Gagal load user data',
          err
        );

      }
    };

    loadUserData();
    fetchNotifications();

  }, [checkingAuth, fetchMyTaskCount]);

  const getInitials = (name: string) => {
    if (!name || name === 'User') return 'U';
    const names = name.trim().split(/\s+/);
    const initials = names.length === 1 ? names[0].substring(0, 2) : names[0][0] + names[names.length - 1][0];
    return initials.toUpperCase();
  };

  const handleSignOut = async () => {
    try {
      await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/logout`, { method: 'POST' });
    } catch {}
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
  };

  // Menu icons (sama seperti sebelumnya, saya singkat karena panjang)
  const menuIcons: Record<string, React.ReactNode> = {
    dashboard: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    sarpras_list: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="2" d="M12 3l9 4.5-9 4.5-9-4.5L12 3zM3 12l9 4.5 9-4.5M3 17l9 4.5 9-4.5" />
      </svg>
    ),
    inspection_report: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <path strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    inspection: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    repair: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    refill: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
        <path d="M12 6v6" />
        <path d="M9 12h6" />
      </svg>
    ),
    review: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    my_task: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <path strokeWidth="2" d="M9 11l3 3L22 4" />
        <path strokeWidth="2" d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
    master_jenis_sarpras: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <rect strokeWidth="2" x="3" y="3" width="7" height="7" rx="1" />
        <rect strokeWidth="2" x="14" y="3" width="7" height="7" rx="1" />
        <rect strokeWidth="2" x="14" y="14" width="7" height="7" rx="1" />
        <path strokeWidth="2" d="M3 14h7v7H3z" />
      </svg>
    ),
    audit_log: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    user_mgmt: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    master_data: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="2" d="M4 7a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V7zm0 8a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  };

  const groupLabels: Record<string, string> = {
    main: 'Main Menu',
    operational: 'Operational Menu',
    master: 'Master Data Menu',
  };

  const renderMenuGroup = (group: string) => {
    const groupMenus = menus.filter((m) => m.group === group);
    if (groupMenus.length === 0) return null;
    return (
      <div className="mb-4">
        {sidebarOpen && <p className="px-6 text-[10px] font-bold text-gray-400 tracking-wider mb-1 uppercase">{groupLabels[group]}</p>}
        {groupMenus.map((menu) => (
        <Link
          key={menu.id}
          href={menu.path}
          className={`flex items-center py-2.5 border-l-[3px] transition-all gap-3 ${
            isActive(menu.path)
              ? 'bg-[#eef4fa] border-[#003d7a] text-[#003d7a] font-semibold'
              : 'border-transparent text-gray-600 hover:bg-gray-50'
          } ${sidebarOpen ? 'px-6' : 'px-0 justify-center relative'}`}
        >
          {/* Icon wrapper with relative untuk badge di collapsed */}
          <div className="relative">
            {menuIcons[menu.id]}
            {/* Badge kecil untuk collapsed */}
            {menu.id === 'my_task' && myTaskCount > 0 && !sidebarOpen && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white ring-1 ring-white">
                {myTaskCount > 9 ? '9+' : myTaskCount}
              </span>
            )}
          </div>

          {sidebarOpen && (
            <span className="text-sm flex-1">{menu.title}</span>
          )}

          {/* Badge besar untuk sidebar terbuka */}
          {sidebarOpen && menu.id === 'my_task' && myTaskCount > 0 && (
            <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
              {myTaskCount > 99 ? '99+' : myTaskCount}
            </span>
          )}
        </Link>
      ))}
      </div>
    );
  };

  if(checkingAuth){
    return null;
  }


  return (
    <IdleTimerProvider>
      <div className="flex h-screen bg-[#f4f7f9] font-sans overflow-hidden relative">
        {/* SIDEBAR */}
        <aside className={`bg-white border-r border-gray-100 flex flex-col shrink-0 z-20 transition-all duration-300 ${sidebarOpen ? 'w-64 md:w-65' : 'w-16'}`}>
          <div className={`border-b border-gray-50 flex items-center transition-all duration-300 ${sidebarOpen ? 'px-4 py-5 justify-between' : 'p-3 justify-center'}`}>
            {sidebarOpen ? (
              <>
                <div>
                  <h1 className="text-xl md:text-[22px] font-bold text-[#003d7a] tracking-wide uppercase">Emertrack</h1>
                  <p className="hidden md:block text-[10px] font-bold text-gray-400 tracking-[0.15em] mt-0.5">Emergency Tracking</p>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-[#003d7a] p-1.5 rounded-md cursor-pointer hover:bg-gray-100">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M11 19l-7-7 7-7M21 19l-7-7 7-7" /></svg>
                </button>
              </>
            ) : (
              <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-[#003d7a] p-1.5 rounded-md cursor-pointer hover:bg-gray-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto py-4 no-scrollbar">
            {renderMenuGroup('main')}
            {renderMenuGroup('operational')}
            {renderMenuGroup('master')}
          </div>
          <div className="p-4 border-t border-gray-100">
            <button onClick={() => setIsSignOutModalOpen(true)} className={`w-full flex items-center py-3 text-gray-600 cursor-pointer hover:text-red-600 hover:bg-red-50 rounded-lg transition-all ${sidebarOpen ? 'px-4' : 'justify-center'}`}>
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              {sidebarOpen && <span className="text-sm font-bold ml-3">Sign Out</span>}
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 md:h-20 bg-white border-b border-gray-100 flex items-center justify-between px-4 md:px-8 z-10">
            <img src="/images/logo-kch.png" alt="Logo" className="h-10 md:h-14 object-contain" />
            <div className="flex items-center space-x-3 md:space-x-6">
              {/* Clock */}
              {currentTime && (
                <div className="hidden sm:flex flex-col items-end border-r border-gray-100 pr-3 md:pr-6">
                  <p className="text-sm md:text-base font-bold text-gray-900 leading-tight tabular-nums tracking-wide">
                    {currentTime}
                  </p>
                  <p className="text-[9px] md:text-[10px] text-gray-400 font-medium mt-0.5">
                    {new Date().toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              )}
              {/* Notification bell - langsung redirect ke halaman notifikasi */}
              <button
                onClick={() => router.push('/dashboard/notifications')}
                className="relative text-gray-400 hover:text-[#003d7a] transition-colors p-1.5 md:p-2 rounded-full hover:bg-gray-50"
              >
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* User profile */}
              <div className="flex items-center space-x-2 md:space-x-3 border-l border-gray-100 pl-3 md:pl-6">
                <div className="text-right hidden sm:flex flex-col items-end">
                  <p className="text-xs md:text-sm font-bold text-gray-900 leading-tight mb-1">{userName}</p>
                  <p className="text-[8px] md:text-[10px] font-extrabold text-[#003d7a] uppercase tracking-wider bg-[#eef4fa] px-2 py-0.5 rounded-sm">{userDept}</p>
                </div>
                <Link href="/dashboard/profile" className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-[#003d7a] flex items-center justify-center text-white text-xs font-bold shadow-sm ring-2 ring-white hover:ring-[#003d7a] transition-all">
                  {getInitials(userName)}
                </Link>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto no-scrollbar p-4 md:p-8 bg-[#f4f7f9]">{children}</main>
        </div>

        {/* SIGN OUT MODAL */}
        {isSignOutModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-[90%] sm:max-w-sm p-6 sm:p-8 text-center animate-in fade-in zoom-in-95">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4 sm:mb-6">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-gray-900 mb-2">Sign Out?</h3>
              <p className="text-xs sm:text-sm font-medium text-gray-500 mb-6 sm:mb-8 px-2 sm:px-4">Sesi Anda akan berakhir. Pastikan semua pekerjaan telah disimpan.</p>
              <div className="flex gap-3 sm:gap-4">
                <button onClick={() => setIsSignOutModalOpen(false)} className="flex-1 py-2 sm:py-3 px-3 sm:px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs sm:text-sm font-bold rounded-xl">Batal</button>
                <button onClick={handleSignOut} className="flex-1 py-2 sm:py-3 px-3 sm:px-4 bg-red-500 hover:bg-red-600 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg">Sign Out</button>
              </div>
            </div>
          </div>
        )}
        {toast && (
        <div className="fixed bottom-6 right-6 z-[200] max-w-sm w-full bg-white shadow-xl rounded-xl border-l-4 border-blue-500 p-4 animate-in slide-in-from-right-5 fade-in duration-300">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-800">Notifikasi Baru</p>
              <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{toast.message}</p>
            </div>
            <button onClick={() => setToast(null)} className="text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {forceLogoutNotice.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-amber-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 9v2m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              </svg>
              <h3 className="text-lg font-bold text-slate-800">Sesi Anda Berakhir</h3>
            </div>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">{forceLogoutNotice.message}</p>
            <button
              onClick={confirmForceLogout}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors"
            >
              Login Kembali
            </button>
          </div>
        </div>
      )}
      </div>
    </IdleTimerProvider>
  );
}
