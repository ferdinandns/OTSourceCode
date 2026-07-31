'use client';

import React from 'react';

interface RiskBadgeProps {
  risk: string;
}

export default function RiskBadge({ risk }: RiskBadgeProps) {
  const r = risk?.toLowerCase().replace(/ /g, '_') || '';

  const config: Record<string, { bg: string; text: string; label: string; border: string }> = {
    'low': { 
      bg: 'bg-green-100', 
      text: 'text-green-700', 
      border: 'border-green-200',
      label: 'Low' 
    },
    'medium': { 
      bg: 'bg-yellow-100', 
      text: 'text-yellow-800', 
      border: 'border-yellow-200',
      label: 'Medium' 
    },
    'high': { 
      bg: 'bg-orange-100', 
      text: 'text-orange-700', 
      border: 'border-orange-200',
      label: 'High' 
    },
    'very_high': { 
      bg: 'bg-red-100', 
      text: 'text-red-700', 
      border: 'border-red-200',
      label: 'Very High' 
    },
  };

  const current = config[r] || { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200', label: risk };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${current.bg} ${current.text} ${current.border}`}>
      {current.label}
    </span>
  );
}