import React, { useState, useEffect } from 'react';
import axios from 'axios';

const MasterLogOverride = () => {
  const [logs, setLogs] = useState([]);
  const [pendingChanges, setPendingChanges] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async () => {
    try {
      const res = await axios.get('http://localhost:8002/part/getallMasterLogs');
      setLogs(res.data);
      setLoading(false);
    } catch (err) { console.error("Fetch failed", err); }
  };

  const handleEdit = (id, field, value) => {
    setLogs(prev => prev.map(log => log.id === id ? { ...log, [field]: value } : log));
    setPendingChanges(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const submitOverrides = async () => {
    if (!window.confirm(`Commit ${Object.keys(pendingChanges).length} overrides to production?`)) return;
    try {
      await axios.put('http://localhost:8002/part/updateMasterLogs', { changes: pendingChanges });
      setPendingChanges({});
      fetchLogs();
      alert("Database updated successfully.");
    } catch (err) { alert("Update failed."); }
  };

  if (loading) return <div className="p-10 text-center font-black">CONNECTING TO MASTER ENGINE...</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-200 font-mono">
      {/* HEADER CONTROL BAR */}
      <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-black tracking-tighter text-red-500 flex items-center gap-2">
            <span className="animate-pulse">●</span> OEE_MASTER_LOGS_OVERRIDE
          </h1>
          <p className="text-[10px] text-slate-500 uppercase">DBeaver Simulation Mode | Read-Write Enabled</p>
        </div>
        <button 
          onClick={submitOverrides}
          disabled={Object.keys(pendingChanges).length === 0}
          className={`px-6 py-2 rounded font-black text-xs transition-all ${Object.keys(pendingChanges).length > 0 ? 'bg-red-600 hover:bg-red-500 shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
        >
          EXECUTE UPDATE ({Object.keys(pendingChanges).length})
        </button>
      </div>

      {/* SCROLLABLE DATA GRID */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-[11px] whitespace-nowrap">
          <thead className="bg-slate-800 sticky top-0 z-20 border-b-2 border-slate-700">
            <tr>
              <th className="p-3 border-r border-slate-700 sticky left-0 bg-slate-800 z-30">ID</th>
              <th className="p-3 border-r border-slate-700 sticky left-[50px] bg-slate-800 z-30">PROD_DATE</th>
              <th className="p-3 border-r border-slate-700">SHIFT</th>
              {/* OEE METRICS */}
              {['avail_shift', 'avail_daily', 'perf_shift', 'perf_daily', 'qual_shift', 'qual_daily', 'oee_shift', 'oee_daily'].map(h => (
                <th key={h} className="p-3 border-r border-slate-700 bg-blue-900/20 text-blue-400">{h.toUpperCase()}</th>
              ))}
              {/* HMI RAW VALUES */}
              {['hmi_avail', 'hmi_perf', 'hmi_qual', 'hmi_oee_shift', 'total_prod', 'total_good'].map(h => (
                <th key={h} className="p-3 border-r border-slate-700 bg-emerald-900/20 text-emerald-400">{h.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                <td className="p-2 border-r border-slate-800 bg-slate-900 sticky left-0 font-bold text-slate-500">{log.id}</td>
                <td className="p-2 border-r border-slate-800 bg-slate-900 sticky left-[50px] text-slate-400">
                  {new Date(log.production_date).toLocaleDateString('en-GB')}
                </td>
                <td className="p-1 border-r border-slate-800">
                  <input type="number" value={log.shift_name} onChange={(e) => handleEdit(log.id, 'shift_name', e.target.value)}
                    className={`w-full bg-transparent outline-none px-2 py-1 rounded ${pendingChanges[log.id]?.shift_name ? 'bg-amber-900/30 text-amber-400' : ''}`} />
                </td>
                {/* DECIMAL OVERRIDES */}
                {[
                  'availability_value_shift', 'availability_value_daily', 
                  'performance_value_shift', 'performance_value_daily',
                  'quality_value_shift', 'quality_value_daily',
                  'oee_value_shift', 'oee_value_daily'
                ].map(col => (
                  <td key={col} className="p-1 border-r border-slate-800">
                    <input type="number" step="0.01" value={log[col]} onChange={(e) => handleEdit(log.id, col, e.target.value)}
                      className={`w-full bg-transparent outline-none px-2 py-1 rounded text-blue-400 font-bold ${pendingChanges[log.id]?.[col] ? 'bg-amber-900/30 ring-1 ring-amber-500' : ''}`} />
                  </td>
                ))}
                {/* INTEGER OVERRIDES */}
                {[
                  'hmi_avail_value', 'hmi_perf_value', 'hmi_qual_value', 
                  'hmi_oee_shift_value', 'total_product', 'total_good'
                ].map(col => (
                  <td key={col} className="p-1 border-r border-slate-800">
                    <input type="number" value={log[col]} onChange={(e) => handleEdit(log.id, col, e.target.value)}
                      className={`w-full bg-transparent outline-none px-2 py-1 rounded text-emerald-400 ${pendingChanges[log.id]?.[col] ? 'bg-amber-900/30 ring-1 ring-amber-500' : ''}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MasterLogOverride;