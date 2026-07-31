'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#f4f7f9] flex flex-col items-center justify-center px-4 font-sans">
      
      {/* CARD CONTAINER */}
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.05)] border-t-[6px] border-[#003d7a] overflow-hidden p-12 text-center relative">
        
        {/* LOGO EMERTRACK */}
        <div className="mb-10">
          <h1 className="text-[24px] font-black text-[#003d7a] tracking-widest uppercase">EMERTRACK</h1>
          <p className="text-[10px] font-bold text-gray-400 tracking-[0.3em] uppercase">Emergency Tracking System</p>
        </div>

        {/* 404 ILLUSTRATION / ICON */}
        <div className="relative mb-8 inline-block">
          <div className="text-[120px] font-black text-[#f1f5f9] leading-none select-none">
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
             <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center animate-pulse">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
             </div>
          </div>
        </div>

        {/* ERROR MESSAGE */}
        <div className="space-y-3 mb-10">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Halaman Tidak Ditemukan</h2>
          <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">
            Maaf, halaman yang Anda cari mungkin telah dipindahkan atau tidak tersedia di dalam sistem.
          </p>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">     
          <Link 
            href="/dashboard"
            className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-white bg-[#003d7a] shadow-[0_8px_20px_rgba(0,61,122,0.2)] hover:bg-[#002d5a] transition-all text-sm flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Kembali ke Dashboard
          </Link>
        </div>

        {/* FOOTER DECORATION */}
        <div className="mt-12 pt-8 border-t border-gray-50">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Bintang Toedjoe • IT Department
          </p>
        </div>

      </div>

      {/* BACKGROUND DECORATION BLOBS */}
      <div className="fixed -bottom-20 -left-20 w-80 h-80 bg-blue-100/50 rounded-full blur-3xl -z-10"></div>
      <div className="fixed -top-20 -right-20 w-80 h-80 bg-red-50/50 rounded-full blur-3xl -z-10"></div>
    </div>
  );
}