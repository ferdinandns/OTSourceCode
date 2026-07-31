// components/TaskCards.tsx
import React from 'react';

interface MyTaskCardProps {
  type: 'INSPECTION' | 'VERIFICATION' | 'APPROVAL' | 'REPAIR';
  title: string;
  subtitle: string;
  onClick?: () => void;
}

export default function MyTaskCard({ type, title, subtitle, onClick }: MyTaskCardProps) {
  return (
    <div onClick={onClick} className="cursor-pointer bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-bold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
      </div>
      <div className="mt-3 text-[10px] font-bold uppercase text-[#003d7a]">{type}</div>
    </div>
  );
}