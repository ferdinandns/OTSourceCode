import React, { useState, useEffect } from 'react';

const HourlyHeatmap = ({ table, dbName, date, columnName }) => {
  const [hourlyData, setHourlyData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`http://localhost:8002/part/getHourlyHeatmap?tableName=${table}&dbName=${dbName}&date=${date}&columnName=${columnName}`)
      .then(res => res.json())
      .then(data => {
        setHourlyData(data);
        setLoading(false);
      });
  }, [table, date]);

  const getHeatColor = (count) => {
    if (count >= 60) return 'bg-emerald-500'; // Perfect
    if (count >= 50) return 'bg-emerald-300';
    if (count >= 30) return 'bg-yellow-400';
    if (count > 0) return 'bg-orange-500';
    return 'bg-slate-200'; // No Data
  };

  if (loading) return <div className="p-4 text-center text-xs font-bold text-slate-400 animate-pulse">GENERATING HOURLY MAP...</div>;

  return (
    <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-inner mt-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
        Hourly Intensity Map: {date}
      </h4>
      <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
        {hourlyData.map((d) => (
          <div key={d.hour} className="group relative">
            <div className={`h-10 w-full rounded-md transition-all border border-white/20 ${getHeatColor(d.actual_rows)}`} />
            <div className="mt-1 text-[9px] font-bold text-slate-400 text-center">
              {String(d.hour).padStart(2, '0')}:00
            </div>
            {/* Tooltip on hover */}
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-800 text-white text-[9px] p-2 rounded shadow-xl z-10 whitespace-nowrap">
              {d.actual_rows} / 60 Rows
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};