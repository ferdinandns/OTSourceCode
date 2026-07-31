'use client';

import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  // Normalisasi string agar cocok dengan pengecekan (huruf kecil & ganti spasi jadi underscore)
  const s = status?.toLowerCase().replace(/ /g, '_') || '';

  const config: Record<string, { bg: string; text: string; label: string }> = {
    'ready': { 
      bg: 'bg-emerald-100', 
      text: 'text-emerald-700', 
      label: 'Ready' 
    },
    'not_ready': { 
      bg: 'bg-red-100', 
      text: 'text-red-600', 
      label: 'Not Ready' 
    },
    'need_repair': { 
      bg: 'bg-amber-100', 
      text: 'text-amber-700', 
      label: 'Need Repair' 
    },
    'will_be_repair': { 
      bg: 'bg-blue-100', 
      text: 'text-blue-700', 
      label: 'Will Be Repair' 
    },
    'waiting_for_verification': { 
      bg: 'bg-slate-200', 
      text: 'text-slate-600', 
      label: 'Waiting for Verification' 
    },
    'waiting_review': { 
      bg: 'bg-purple-100', 
      text: 'text-purple-700', 
      label: 'Waiting Review' 
    },
  };

  const current = config[s] || { bg: 'bg-gray-100', text: 'text-gray-500', label: status };

  return (
    <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-white/50 shadow-sm ${current.bg} ${current.text}`}>
      {current.label}
    </span>
  );
}