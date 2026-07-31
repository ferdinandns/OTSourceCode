"use client";

import React, { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  success: boolean | null;
  message: string;
};

export default function TransactionStatusModal({ isOpen, onClose, success, message }: Props) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper: close modal and navigate back
  const handleCloseAndBack = () => {
    onClose();
    router.back();
  };

  // Auto‑close after 3 seconds, then go back
  useEffect(() => {
    if (isOpen) {
      timerRef.current = setTimeout(() => {
        handleCloseAndBack();
      }, 3000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const Icon = () => {
    if (success === true) {
      return (
        <svg className="w-7 h-7 sm:w-8 sm:h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      );
    }
    if (success === false) {
      return (
        <svg className="w-7 h-7 sm:w-8 sm:h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <line x1="18" y1="6" x2="6" y2="18" strokeWidth={2.5} />
          <line x1="6" y1="6" x2="18" y2="18" strokeWidth={2.5} />
        </svg>
      );
    }
    // success === null → generic info
    return (
      <svg className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" strokeWidth={2.5} />
        <line x1="12" y1="16" x2="12" y2="12" strokeWidth={2.5} />
        <line x1="12" y1="8" x2="12.01" y2="8" strokeWidth={2.5} />
      </svg>
    );
  };

  const title =
    success === true ? "Sukses" :
    success === false ? "Gagal" :
    "Informasi";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleCloseAndBack}
      />

      {/* Panel — slides up on mobile, scales in on sm+ */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        {/* Gradient top bar (same blue as sarpras/add SuccessModal) */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#003d7a] to-[#0062c4]" />

        <div className="px-6 sm:px-8 pt-8 sm:pt-10 pb-6 sm:pb-8 flex flex-col items-center text-center">
          {/* Icon Circle */}
          <div
            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mb-4 sm:mb-5 ${
              success === true
                ? "bg-green-50"
                : success === false
                  ? "bg-red-50"
                  : "bg-blue-50"
            }`}
          >
            <Icon />
          </div>

          <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-sm text-gray-500 leading-relaxed mb-6 sm:mb-8 whitespace-pre-wrap">{message}</p>

          {/* Two action buttons (like sarpras/add SuccessModal) */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 w-full">
            <button
              onClick={handleCloseAndBack}
              className="flex-1 px-4 py-2.5 bg-[#003d7a] text-white rounded-lg text-sm font-bold hover:bg-[#002d5a] transition-all"
            >
              Tutup
            </button>
            {/*<button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-[#003d7a] text-white rounded-lg text-sm font-bold hover:bg-[#002d5a] transition-all"
            >
              Tutup
            </button>*/}
          </div>
        </div>
      </div>
    </div>
  );
}
