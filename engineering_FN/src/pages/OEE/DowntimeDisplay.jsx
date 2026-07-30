import React, { useState, useMemo } from 'react';

const ShiftStatsDisplay = ({ events = [] }) => {
  const [isOpen, setIsOpen] = useState(false);

  // 1. FIXED AGGREGATION: This controls the big '30m' vs '0m' numbers
  const stats = useMemo(() => {
      const computed = {
          planned: { freq: 0, duration: 0 },
          unplanned: { freq: 0, duration: 0 }
      };

      events.forEach(curr => {
          const dur = parseFloat(curr.duration_minutes || 0);
          // We look ONLY at the category string from the database
          if (curr.category === 'Planned') {
              computed.planned.freq += 1;
              computed.planned.duration += dur;
          } else {
              // If it's not explicitly 'Planned', it's 'Unplanned'
              computed.unplanned.freq += 1;
              computed.unplanned.duration += dur;
          }
      });
      return computed;
  }, [events]);

  const listItems = useMemo(() => {
      return [...events].sort((a, b) => b.duration_minutes - a.duration_minutes);
  }, [events]);

  const toggleAll = () => setIsOpen(!isOpen);

  const renderDropdownList = (targetCategory) => {
    // 2. FIXED FILTERING: This ensures 'Briefing' moves to the Blue Card
    const filteredItems = listItems.filter(e => e.category === targetCategory);
    const borderColor = targetCategory === 'Unplanned' ? 'border-red-100' : 'border-blue-100';

    return (
      <div className={`mt-4 pt-2 border-t ${borderColor} animate-in fade-in slide-in-from-top-2 duration-200`}>
        <div className="max-h-60 overflow-y-auto pr-1 custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead className="font-bold text-gray-400 uppercase sticky top-0 bg-white">
              <tr>
                <th className="py-2 w-20">Dur</th>
                <th className="py-2">Description</th>
                <th className="py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-gray-600">
              {filteredItems.length === 0 ? (
                <tr><td colSpan="3" className="py-4 italic text-gray-400 text-center">No {targetCategory} items found</td></tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2 font-bold text-gray-800">{Math.round(item.duration_minutes)} m</td>
                    <td className="py-2">{item.reason_name}</td>
                    <td className="py-2 text-right uppercase text-[9px] font-bold text-gray-400">
                       {item.compareStatus || 'OPR'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-2 gap-4 mb-6 items-start">
      {/* UNPLANNED CARD */}
      <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
        <div onClick={toggleAll} className="flex justify-between items-center cursor-pointer">
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider italic">Unplanned Downtime</h3>
              <div className="flex items-baseline gap-2 mt-1">
                {/* Now shows ONLY Unplanned duration */}
                <span className="text-2xl font-extrabold text-red-600">{Math.round(stats.unplanned.duration)}m</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-gray-800">{stats.unplanned.freq}</div>
            </div>
        </div>
        {isOpen && renderDropdownList('Unplanned')}
      </div>

      {/* PLANNED CARD */}
      <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
        <div onClick={toggleAll} className="flex justify-between items-center cursor-pointer">
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider italic">Planned Budget</h3>
              <div className="flex items-baseline gap-2 mt-1">
                {/* Now includes Briefing/Istirahat duration */}
                <span className="text-2xl font-extrabold text-blue-600">{Math.round(stats.planned.duration)}m</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-gray-800">{stats.planned.freq}</div>
            </div>
        </div>
        {isOpen && renderDropdownList('Planned')}
      </div>
    </div>
  );
};

export default ShiftStatsDisplay;