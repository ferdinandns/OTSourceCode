'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useWebSocket } from '@/hooks/useWebsocket';

interface NotificationItem {
  id: number;
  type: string;
  message: string;
  reference_id?: number;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data || [];
        setNotifications(data);
        setUnreadCount(data.filter((n: NotificationItem) => !n.is_read).length);
      }
    } catch (err) {
      console.error('Gagal memuat notifikasi', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useWebSocket({
    'NEW_NOTIFICATION': (data) => {
      setNotifications(prev => [data, ...prev]);
      setUnreadCount(prev => prev + 1);
    },
  });

  const handleRead = async (id: number) => {
    try {
      await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/${id}/read`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      window.dispatchEvent(new CustomEvent('refresh-notifications')); 
    } catch (err) {
      console.error('Gagal menandai baca', err);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/${id}`, { method: 'DELETE' });
      const removed = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (removed && !removed.is_read) setUnreadCount(prev => Math.max(0, prev - 1));
      window.dispatchEvent(new CustomEvent('refresh-notifications')); 
    } catch (err) {
      console.error('Gagal hapus notifikasi', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/read-all`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      window.dispatchEvent(new CustomEvent('refresh-notifications')); 
    } catch (err) {
      console.error('Gagal tandai semua baca', err);
    }
  };

  const handleDeleteAll = async () => {
    setIsConfirmOpen(false);
    try {
      const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications/delete-all-notifications`, { method: 'DELETE' });
      if (res.ok) {
        setNotifications([]);
        setUnreadCount(0);
        window.dispatchEvent(new CustomEvent('refresh-notifications'));
      } else {
        const json = await res.json();
        alert(json.message || 'Gagal menghapus notifikasi');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan');
    }
  };

  const handleItemClick = (notif: NotificationItem) => {
    if (!notif.is_read) handleRead(notif.id);
    if (notif.reference_id) {
      if (notif.type === 'NEW_INSPECTION') router.push(`/dashboard/inspection`);
      else if (notif.type === 'NEW_REPAIR_ASSIGNMENT') router.push(`/dashboard/repair`);
      else if (notif.type === 'APPROVAL_REQUEST') router.push(`/dashboard/my-task`);
      else if (notif.type === 'REVIEW_READY') router.push(`/dashboard/reviews/`);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8">
      {/* Header with back button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
            aria-label="Kembali"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Notifikasi</h1>
            <p className="text-sm text-gray-500 mt-1">Semua pemberitahuan sistem Anda</p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[#003d7a] bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
            Tandai semua sudah dibaca ({unreadCount})
          </button>
        )}
        {notifications.length > 0 && (
            <button
              onClick={() => setIsConfirmOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              Hapus Semua
            </button>
          )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#003d7a]" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center text-3xl mb-4">🔔</div>
          <p className="text-gray-500 font-medium">Belum ada notifikasi</p>
          <p className="text-sm text-gray-400 mt-1">Notifikasi akan muncul di sini jika ada aktivitas baru.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleItemClick(notif)}
              className={`bg-white rounded-xl border transition-all cursor-pointer hover:shadow-md hover:scale-[1.01] transform duration-200 ${
                !notif.is_read ? 'border-l-4 border-l-[#0ea5e9] shadow-sm' : 'border-gray-100'
              }`}
            >
              <div className="p-5 flex items-start gap-4">
                <div className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${!notif.is_read ? 'bg-[#0ea5e9] animate-pulse' : 'bg-gray-300'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-base ${!notif.is_read ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                    {notif.message}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">{formatDate(notif.created_at)}</p>
                </div>
                <button
                  onClick={(e) => handleDelete(notif.id, e)}
                  className="text-gray-300 hover:text-red-500 transition-colors p-1"
                  aria-label="Hapus"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {isConfirmOpen && (
      <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h3 className="text-base font-black text-gray-900 mb-2">Hapus Semua Notifikasi?</h3>
          <p className="text-xs text-gray-500 font-medium leading-relaxed mb-6">
            Tindakan ini tidak dapat dibatalkan. Semua notifikasi akan dihapus permanen.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setIsConfirmOpen(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-black text-gray-500 hover:bg-gray-50 transition">Batal</button>
            <button onClick={handleDeleteAll} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-xs font-black uppercase hover:bg-red-700 transition">Hapus Semua</button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
