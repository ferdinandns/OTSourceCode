'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, API_BASE } from '@/lib/api';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  // Status apakah ini ganti password pertama kali (Force Change)
  const [isFirstTime, setIsFirstTime] = useState(false);

  const [formData, setFormData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [showPass, setShowPass] = useState({
    old: false,
    new: false,
    confirm: false,
  });

  useEffect(() => {
    // Cek status mustChangePassword dari storage yang di-set saat login
    const mustChange = localStorage.getItem('mustChangePassword') === 'true' || 
                       sessionStorage.getItem('mustChangePassword') === 'true';
    setIsFirstTime(mustChange);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validasi dasar client-side
    if (formData.newPassword !== formData.confirmPassword) {
      setError('Konfirmasi password baru tidak cocok');
      return;
    }

    if (formData.newPassword.length < 8) {
      setError('Password baru minimal harus 8 karakter');
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch(`${API_BASE}/users/change-password`, {
        method: 'POST',
        body: JSON.stringify({
          old_password: isFirstTime ? "" : formData.oldPassword, // Kirim kosong jika pertama kali
          new_password: formData.newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengubah password');
      }

      setSuccess(true);
      
      // Update status di storage agar middleware tidak memblokir lagi
      localStorage.setItem('mustChangePassword', 'false');
      sessionStorage.setItem('mustChangePassword', 'false');

      // Redirect setelah sukses
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  };

  return (
   <div className="fixed inset-0 z-9999 bg-[#f8f9fa] flex flex-col items-center justify-center p-4">
      {/* Container Card */}
      <div className="bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-gray-100 w-full max-w-125 overflow-hidden">
        
        {/* Header Decor */}
        <div className="bg-[#003d7a] p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
          <h2 className="text-2xl font-black text-white relative z-10">Security Update</h2>
          <p className="text-blue-100 text-sm mt-1 relative z-10">
            {isFirstTime 
              ? 'Please set your new account password to continue' 
              : 'Update your password to keep your account secure'}
          </p>
        </div>

        <div className="p-10">
          {success ? (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-black text-gray-800">Password Changed!</h3>
              <p className="text-gray-500 text-sm mt-2">Your security settings have been updated. Redirecting you to dashboard...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-center gap-3">
                  <svg className="w-5 h-5 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <p className="text-xs font-bold text-red-700">{error}</p>
                </div>
              )}

              {/* Password Lama - Hanya muncul jika bukan pertama kali */}
              {!isFirstTime && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Current Password</label>
                  <div className="relative">
                    <input
                      type={showPass.old ? "text" : "password"}
                      required
                      value={formData.oldPassword}
                      onChange={(e) => setFormData({...formData, oldPassword: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-[#003d7a] focus:outline-none transition-all"
                      placeholder="Enter current password"
                    />
                    <button type="button" onClick={() => setShowPass({...showPass, old: !showPass.old})} className="absolute right-4 top-3.5 text-gray-400">
                      {showPass.old ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              )}

              {/* Password Baru */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">New Password</label>
                <div className="relative">
                  <input
                    type={showPass.new ? "text" : "password"}
                    required
                    value={formData.newPassword}
                    onChange={(e) => setFormData({...formData, newPassword: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-[#003d7a] focus:outline-none transition-all"
                    placeholder="Create a strong password"
                  />
                  <button type="button" onClick={() => setShowPass({...showPass, new: !showPass.new})} className="absolute right-4 top-3.5 text-gray-400 text-xs font-bold">
                    {showPass.new ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              </div>

              {/* Konfirmasi Password */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showPass.confirm ? "text" : "password"}
                    required
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-[#003d7a] focus:outline-none transition-all"
                    placeholder="Repeat your new password"
                  />
                  <button type="button" onClick={() => setShowPass({...showPass, confirm: !showPass.confirm})} className="absolute right-4 top-3.5 text-gray-400 text-xs font-bold">
                    {showPass.confirm ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4 flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#003d7a] text-white font-black py-4 rounded-xl shadow-lg hover:bg-[#002d5c] transition-all disabled:bg-gray-300 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                      Update Password
                    </>
                  )}
                </button>
                
                {/* Tombol Batal (Hanya muncul jika bukan force change) */}
                {!isFirstTime && (
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="w-full bg-white text-gray-500 font-bold py-2 text-sm hover:text-gray-800 transition-all"
                  >
                    Cancel and Return
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-8 text-center">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
          EMERTRACK SECURITY MANAGEMENT SYSTEM
        </p>
      </div>
    </div>
  );
}