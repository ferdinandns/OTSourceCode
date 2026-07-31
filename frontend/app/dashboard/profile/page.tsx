'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface ProfileData {
  full_name: string;
  email?: string;
  nik?: string;
  department_name: string;
  site_name: string;
  roles: string[];
  is_supervisor: boolean;
  assigned_sarpras: { id: number; name: string; code: string }[];
}

const ROLE_LABELS: Record<string, string> = {
  qs: 'Quality System',
  admin: 'Administrator',
  checker: 'Checker',
  pic_responsibility: 'PIC Responsibility',
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/me`);
        const json = await res.json();
        if (json.success) setProfile(json.data);
      } catch (err) {
        console.error('Gagal load profil');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const getInitials = (name: string) => {
    if (!name || name === 'User') return 'U';
    const names = name.trim().split(/\s+/);
    const initials = names.length === 1 ? names[0].substring(0, 2) : names[0][0] + names[names.length - 1][0];
    return initials.toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#003d7a]" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8">
      {/* Header dengan tombol back dan change password */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-[#003d7a] tracking-tight">EMERTRACK</h1>
            <p className="text-xs md:text-sm font-bold text-gray-400">User Profile Control Center</p>
          </div>
        </div>
        <button
          onClick={() => router.push('/dashboard/profile/change-password')}
          className="bg-[#003d7a] text-white px-4 py-2 md:px-6 md:py-3 rounded-lg font-bold text-sm shadow-lg flex items-center gap-2 justify-center hover:bg-[#002d5c] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Change Password
        </button>
      </div>

      {/* Grid info personal & roles - satu kolom di mobile, dua kolom di md+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 mb-6">
        {/* Personal Info Card */}
        <div className="bg-white p-5 md:p-8 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-5 md:mb-8">
            <div className="p-2 bg-blue-50 text-[#003d7a] rounded-lg">
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
            <h2 className="text-lg md:text-xl font-black text-gray-800">Personal Information</h2>
          </div>

          {/* Avatar + Nama */}
          <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#003d7a] flex items-center justify-center text-white text-base md:text-lg font-black flex-shrink-0">
              {profile ? getInitials(profile.full_name) : 'U'}
            </div>
            <div>
              <p className="font-black text-gray-900 text-base md:text-lg">{profile?.full_name || '-'}</p>
              {profile?.is_supervisor && (
                <span className="text-[9px] md:text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 uppercase tracking-wider">
                  Supervisor
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Email Address</p>
              <p className="text-xs md:text-sm font-bold text-gray-800 break-all">{profile?.email || '-'}</p>
            </div>
            <div>
              <p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">NIK</p>
              <p className="text-xs md:text-sm font-bold text-gray-800">{profile?.nik || '-'}</p>
            </div>
            <div>
              <p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Sites</p>
              <p className="text-xs md:text-sm font-bold text-gray-800">{profile?.site_name || '-'}</p>
            </div>
            <div>
              <p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Department</p>
              <p className="text-xs md:text-sm font-bold text-gray-800">{profile?.department_name || '-'}</p>
            </div>
          </div>
        </div>

        {/* Roles & Access Card */}
        <div className="bg-[#f8f9fa] p-5 md:p-8 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-5 md:mb-8">
            <div className="p-2 bg-blue-100 text-[#003d7a] rounded-lg">
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-8 0h-4V4h4v2z" />
              </svg>
            </div>
            <h2 className="text-lg md:text-xl font-black text-gray-800">Roles & Access</h2>
          </div>

          <div className="space-y-3">
            {profile?.roles && profile.roles.length > 0 ? (
              profile.roles.map((role) => (
                <div key={role} className="flex items-center justify-between p-3 md:p-4 bg-white rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 md:w-8 md:h-8 bg-[#eef4fa] rounded-lg flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#003d7a]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
                      </svg>
                    </div>
                    <span className="font-bold text-gray-800 text-xs md:text-sm">{ROLE_LABELS[role] || role}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs md:text-sm text-gray-400">Tidak ada role</p>
            )}
          </div>
        </div>
      </div>

      {/* Assigned Sarpras Types (hanya tampil jika user memiliki role checker) */}
      {profile && profile.roles.includes('checker') && (
        <div className="bg-white p-5 md:p-8 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 md:mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h2 className="text-lg md:text-xl font-black text-gray-800">Assigned Sarpras Types</h2>
            </div>

            {/* Badge kondisi */}
            {profile.is_supervisor && profile.roles.includes('checker') ? (
              <span className="bg-amber-100 text-amber-700 text-[9px] md:text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest self-start sm:self-center">
                All Types
              </span>
            ) : (
              <span className="bg-blue-100 text-[#003d7a] text-[9px] md:text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest self-start sm:self-center">
                {profile.assigned_sarpras?.length || 0} Assigned
              </span>
            )}
          </div>

          {/* Konten assigned sarpras */}
          {profile.is_supervisor && profile.roles.includes('checker') ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 md:p-5 bg-amber-50 rounded-xl border border-amber-100">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 md:w-6 md:h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <p className="font-black text-amber-800 text-sm md:text-base">Akses Penuh ke Semua Jenis Sarpras</p>
                <p className="text-xs md:text-sm text-amber-600 font-medium mt-0.5">
                  {profile.is_supervisor
                    ? 'Sebagai Supervisor, kamu dapat memeriksa seluruh jenis sarpras emergency.'
                    : 'Sebagai Checker, kamu dapat memeriksa seluruh jenis sarpras emergency.'}
                </p>
              </div>
            </div>
          ) : (
            profile.assigned_sarpras && profile.assigned_sarpras.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {profile.assigned_sarpras.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 md:p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-white flex items-center justify-center rounded-lg shadow-sm border border-gray-100">
                        <span className="text-[8px] md:text-[10px] font-black text-[#003d7a]">{item.code}</span>
                      </div>
                      <span className="font-bold text-gray-800 text-xs md:text-sm">{item.name}</span>
                    </div>
                    <div className="text-green-500">
                      <svg className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs md:text-sm text-gray-400 text-center py-4">Tidak ada sarpras yang di-assign</p>
            )
          )}
        </div>
      )}
    </div>
  );
}