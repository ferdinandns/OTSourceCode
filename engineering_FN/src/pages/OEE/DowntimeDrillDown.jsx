import React from 'react';

const EventDrillDownModal = ({ isOpen, onClose, category, events }) => {
  if (!isOpen) return null;

  const colorClass = category === 'Unplanned' ? 'border-red-500' : 'border-blue-500';
  const headerColor = category === 'Unplanned' ? 'bg-red-50' : 'bg-blue-50';
  const textColor = category === 'Unplanned' ? 'text-red-700' : 'text-blue-700';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex justify-center items-center p-4 backdrop-blur-sm">
      <div className={`bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden border-t-4 ${colorClass} animate-in fade-in zoom-in duration-200`}>
        
        {/* HEADER */}
        <div className={`px-6 py-4 ${headerColor} flex justify-between items-center border-b`}>
          <div>
            <h3 className={`font-bold text-lg ${textColor} flex items-center gap-2`}>
              {category === 'Unplanned' ? '🔴' : '🔵'} {category} Detail Log
            </h3>
            <p className="text-xs text-gray-500">
               Showing {events.length} events for this shift.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none">&times;</button>
        </div>

        {/* TABLE */}
        <div className="max-h-[500px] overflow-y-auto bg-white">
          <table className="min-w-full text-left text-sm relative">
            <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold sticky top-0 shadow-sm z-10">
              <tr>
                <th className="px-6 py-3">Time</th>
                <th className="px-6 py-3">Duration</th>
                <th className="px-6 py-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.length === 0 ? (
                <tr>
                   <td colSpan="3" className="px-6 py-8 text-center text-gray-400 italic">
                      No labeled events found for this category.
                   </td>
                </tr>
              ) : (
                events.map((ev, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 text-xs">
                        <div className="font-bold text-gray-700">
                            {new Date(ev.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                        </div>
                        <div className="text-[10px] text-gray-400">
                            {new Date(ev.start_time).toLocaleDateString()}
                        </div>
                    </td>
                    {/* INT FORMAT */}
                    <td className="px-6 py-3 font-bold text-gray-800">
                        {Math.round(ev.duration_minutes)} m
                    </td>
                    <td className="px-6 py-3 text-xs font-medium text-gray-600">
                        {ev.reason_name || ev.category || 'Undefined'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        <div className="bg-gray-50 px-6 py-3 text-right border-t">
           <button 
             onClick={onClose}
             className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded text-sm font-bold hover:bg-gray-100 shadow-sm transition-colors"
           >
             Close
           </button>
        </div>
      </div>
    </div>
  );
};

export default EventDrillDownModal;