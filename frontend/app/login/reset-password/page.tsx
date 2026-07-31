'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {API_BASE, apiFetch} from '@/lib/api'

// Komponen form dipisah agar bisa dibungkus Suspense (Syarat Next.js App Router)
function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token'); // Menangkap ?token=... dari URL

  const [formData, setFormData] = useState({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Cegat jika ada orang iseng buka halaman ini tanpa token dari email
  if (!token) {
    return (
      <div className="text-center p-6 bg-red-50 rounded-2xl border border-red-100">
        <p className="text-sm font-bold text-red-700">
          Akses Ditolak: Tautan reset tidak valid atau Anda tidak memiliki token otorisasi.
        </p>
        <button onClick={() => router.push('/login')} className="mt-4 text-xs font-black text-[#003d7a] hover:underline">
          Kembali ke Login
        </button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirm) {
      setError('Konfirmasi password tidak cocok');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password baru minimal harus 8 karakter');
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch(`${API_BASE}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ token, new_password: formData.password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Gagal mengatur ulang password');

      setSuccess(true);
      // Redirect ke login setelah sukses dalam 2.5 detik
      setTimeout(() => { router.push('/login'); }, 2500);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-4 animate-in fade-in zoom-in duration-300">
        <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
        </div>
        <h3 className="text-lg font-black text-gray-800">Password Diperbarui!</h3>
        <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">Sistem keamanan telah diperbarui. Mengalihkan Anda kembali ke halaman login...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3.5 bg-red-50 text-red-700 text-xs font-bold rounded-xl border border-red-100 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Password Baru</label>
        <input
          type="password"
          required
          placeholder="Minimal 8 karakter"
          value={formData.password}
          onChange={e => setFormData({ ...formData, password: e.target.value })}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-[#003d7a] focus:outline-none transition-all"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Konfirmasi Password</label>
        <input
          type="password"
          required
          placeholder="Ulangi password baru"
          value={formData.confirm}
          onChange={e => setFormData({ ...formData, confirm: e.target.value })}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-[#003d7a] focus:outline-none transition-all"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#003d7a] text-white font-black py-4 rounded-xl shadow-md hover:bg-[#002d5c] transition-all disabled:bg-gray-300 flex items-center justify-center mt-2"
      >
        {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Simpan Password Baru'}
      </button>
    </form>
  );
}

// Komponen Utama Page
export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center justify-center p-4">
      <div className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 w-full max-w-[450px]">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-[#003d7a] tracking-tight">EMERTRACK</h1>
          <p className="text-sm font-bold text-gray-400 mt-1">Set New Password</p>
        </div>
        
        {/* Suspense WAJIB ada di Next.js App Router kalau pakai useSearchParams */}
        <Suspense fallback={
          <div className="flex justify-center items-center py-10">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-[#003d7a] rounded-full animate-spin"></div>
          </div>
        }>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}