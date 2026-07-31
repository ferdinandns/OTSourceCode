'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation'; 

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Terjadi kesalahan sistem');
      }
      
      setMessage(data.message || 'Instruksi reset telah dikirim ke email Anda.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memproses permintaan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center justify-center p-4">
      <div className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 w-full max-w-[450px]">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-[#003d7a] tracking-tight">EMERTRACK</h1>
          <p className="text-sm font-bold text-gray-400 mt-1">Forgot Password Recovery</p>
        </div>

        {/* Jika Sukses Kirim Email */}
        {message ? (
          <div className="text-center py-4 animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-bold text-gray-700 px-2 leading-relaxed">{message}</p>
            <button 
              onClick={() => router.push('/login')} 
              className="mt-8 w-full bg-gray-50 text-gray-600 font-bold py-3 rounded-xl border border-gray-200 hover:bg-gray-100 transition-all"
            >
              Kembali ke Halaman Login
            </button>
          </div>
        ) : (
          /* Form Input Email */
          <form onSubmit={handleSubmit} className="space-y-5">
            <p className="text-xs text-gray-500 leading-relaxed text-center mb-6">
              Masukkan alamat email Anda yang terdaftar. Sistem akan mengirimkan tautan khusus untuk mengatur ulang password Anda.
            </p>

            {error && (
              <div className="p-3.5 bg-red-50 text-red-700 text-xs font-bold rounded-xl border border-red-100 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Email Terdaftar
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="nama@domain.com"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-[#003d7a] focus:outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#003d7a] text-white font-black py-4 rounded-xl shadow-md hover:bg-[#002d5c] transition-all disabled:bg-gray-300 flex items-center justify-center mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Kirim Tautan Reset'
              )}
            </button>

            <div className="text-center pt-4">
              <button 
                type="button" 
                onClick={() => router.push('/login')} 
                className="text-xs font-bold text-gray-400 hover:text-[#003d7a] transition-colors"
              >
                Batal dan kembali ke Login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}