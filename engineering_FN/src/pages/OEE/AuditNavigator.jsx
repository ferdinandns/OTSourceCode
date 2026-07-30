import React, { useState, useEffect, useRef } from 'react';
import Draggable from 'react-draggable'; // Restore for moveability

const AuditNavigator = ({ selectedDate, navigateDay, hasSubmitted }) => {
  const [isIdle, setIsIdle] = useState(false);
  const [shouldShake, setShouldShake] = useState(false);
  const timerRef = useRef(null);

  const resetIdleTimer = () => {
    setIsIdle(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsIdle(true), 8000);
  };

  useEffect(() => {
    if (!hasSubmitted) {
      setShouldShake(true);
      const timer = setTimeout(() => setShouldShake(false), 500);
      return () => clearTimeout(timer);
    }
  }, [selectedDate, hasSubmitted]);

  const statusColor = hasSubmitted ? 'bg-white' : 'bg-red-50';
  const statusBorder = hasSubmitted ? 'border-slate-200' : 'border-red-300 shadow-red-200/60';
  const statusText = hasSubmitted ? 'text-slate-400' : 'text-red-500';

  return (
    <Draggable handle=".drag-handle">
      <div 
        onMouseEnter={resetIdleTimer}
        /* Adjusted default position to top-right to avoid blocking bottom buttons */
        className={`fixed top-32 right-8 z-[100] flex flex-col items-center bg-white rounded-2xl shadow-2xl border transition-all duration-700
          ${isIdle ? 'opacity-40 scale-95' : 'opacity-100 scale-100'}
          ${statusColor} ${statusBorder} ${shouldShake ? 'animate-shake' : ''}
          w-auto select-none
        `}
      >
        {/* DRAG HANDLE: Allows repositioning anywhere on the Canvas */}
        <div className="drag-handle w-full h-4 bg-slate-900/5 hover:bg-slate-900/10 cursor-move flex justify-center items-center rounded-t-2xl border-b border-slate-100">
           <div className="w-8 h-1 rounded-full bg-slate-300" />
        </div>

        <div className="flex items-center gap-2 p-2">
          {/* NAVIGATION CONTROLS */}
          <button 
            onClick={() => navigateDay(-1)} 
            className="flex items-center justify-center w-12 h-12 bg-white rounded-xl hover:bg-slate-50 border border-slate-200 active:scale-90 transition-all shadow-sm"
          >
            <span className="text-blue-500 font-black text-sm">◀</span>
          </button>

          <div className="px-6 flex flex-col items-center justify-center min-w-[120px]">
            <span className={`text-[8px] font-black uppercase tracking-widest mb-1 transition-colors ${statusText}`}>
              {hasSubmitted ? 'VERIFIED' : '⚠️ REQUIRED'}
            </span>
            <span className="text-sm font-black text-slate-800">
              {new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
            </span>
          </div>

          <button 
            onClick={() => navigateDay(1)} 
            className="flex items-center justify-center w-12 h-12 bg-white rounded-xl hover:bg-slate-50 border border-slate-200 active:scale-90 transition-all shadow-sm"
          >
            <span className="text-blue-500 font-black text-sm">▶</span>
          </button>
        </div>

        {/* CSS FOR SHAKE EFFECT */}
        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-4px); }
            75% { transform: translateX(4px); }
          }
          .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
        `}</style>
      </div>
    </Draggable>
  );
};

export default AuditNavigator;