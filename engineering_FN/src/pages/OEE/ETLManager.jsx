import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import ParetoChart from './ParetoChartFette';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';


const EtlManager = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [etlLoading, setEtlLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  // --- TAB STATE (Updated Order) ---
  const [activeTab, setActiveTab] = useState('shift'); // 'shift', 'summary', 'analytics', 'logs'

  // --- FILTERS ---
  // Global Range for Pareto/Summary/Logs
  const [detailFilter, setDetailFilter] = useState({ start: "2026-01-01", end: "2026-01-31" });
  
  // Specific Filter for "Shift Summary" Tab
  const [shiftFilter, setShiftFilter] = useState({ date: "2026-01-21", name: "Shift 1" });
  const [shiftData, setShiftData] = useState({ events: [], baseline: [] });

  // 1. FETCH GLOBAL DATA (For Tabs 2, 3, and 4)
  const fetchGlobalEvents = async () => {
    setLoading(true);
    try {
      const res = await axios.get("http://10.126.15.197:8002/part/getAllSmartEvents", {
          params: {
              start_date: detailFilter.start || '2026-01-01', 
              end_date: detailFilter.end || '2026-12-31'
          }
      }); 
      setEvents(res.data);
    } catch (err) {
      console.error("Error loading smart events", err);
    } finally {
      setLoading(false);
    }
  };

  // 2. FETCH SPECIFIC SHIFT DATA (For Tab 1)
  const fetchShiftSummary = async () => {
    try {
      // Define timestamps for the baseline fetch based on shift name
      let startTime = "06:30:00";
      let endTime = "15:00:00";
      if (shiftFilter.name === "Shift 2") { startTime = "15:00:00"; endTime = "22:45:00"; }
      if (shiftFilter.name === "Shift 3") { startTime = "22:45:00"; endTime = "06:30:00"; }

      const startIso = `${shiftFilter.date} ${startTime}`;
      let endIso = `${shiftFilter.date} ${endTime}`;
      if (shiftFilter.name === "Shift 3") {
          const nextDay = new Date(shiftFilter.date);
          nextDay.setDate(nextDay.getDate() + 1);
          endIso = `${nextDay.toISOString().split('T')[0]} ${endTime}`;
      }

      const [smartRes, baselineRes] = await Promise.all([
        axios.get(`http://10.126.15.197:8002/part/getStoredShiftEvents`, { 
            params: { date: shiftFilter.date, shift: shiftFilter.name } 
        }),
        axios.get(`http://10.126.15.197:8002/part/getStoredShiftEvents`, { 
            params: { start_date: startIso, end_date: endIso } 
        })
      ]);
      
      setShiftData({
          events: smartRes.data.events || [],
          baseline: baselineRes.data.events || []
      });
    } catch (err) {
      console.error("Error loading shift summary", err);
    }
  };

  useEffect(() => {
    fetchGlobalEvents();
  }, [detailFilter.start, detailFilter.end]);

  useEffect(() => {
    if (activeTab === 'shift') fetchShiftSummary();
  }, [shiftFilter, activeTab]);

  const handleRunEtl = async () => {
    setEtlLoading(true);
    setStatusMsg("Processing...");
    try {
      const res = await axios.post("http://10.126.15.197:8002/part/runEtlProcess");
      if (res.data.total_created > 0) {
          setStatusMsg(`✅ Success! Created ${res.data.total_created} new events.`);
      } else {
          setStatusMsg("ℹ️ System up to date.");
      }
      fetchGlobalEvents(); 
    } catch (err) {
      setStatusMsg("❌ Error: " + (err.response?.data?.error || err.message));
    } finally {
      setEtlLoading(false);
    }
  };

  // --- COMPARISON LOGIC FOR SHIFT SUMMARY ---
  const shiftComparison = useMemo(() => {
    const machineMap = {};
    shiftData.baseline.forEach(e => {
        const key = e.reason_name || "Undefined";
        if (!machineMap[key]) machineMap[key] = [];
        machineMap[key].push(parseFloat(e.duration_minutes || 0));
    });

    const machineUsage = {};
    return shiftData.events.map(e => {
        const key = e.reason_name || "Undefined";
        const dur = parseFloat(e.duration_minutes || 0);
        const available = machineMap[key] || [];
        const used = machineUsage[key] || 0;

        let status = 'NEW';
        if (used < available.length) {
            status = Math.abs(available[used] - dur) <= 1 ? 'MATCH' : 'DIFF';
            machineUsage[key] = used + 1;
        }
        return { ...e, status };
    });
  }, [shiftData]);

  // --- HELPER: FILTER LOGIC ---
  const filterData = (data, range) => {
    if (!range.start || !range.end) return data; 
    const start = new Date(range.start).getTime();
    const end = new Date(range.end).getTime();
    return data.filter(ev => {
        const time = new Date(ev.start_time).getTime();
        return time >= start && time <= end;
    });
  };

  // --- 2. DATA PREPARATION ---
  const summaryFilter = detailFilter; // Link summary to global filter

  const detailedUnplanned = useMemo(() => 
    filterData(events.filter(e => e.category === 'Unplanned'), detailFilter), 
  [events, detailFilter]);

  const detailedPlanned = useMemo(() => 
    filterData(events.filter(e => e.category === 'Planned'), detailFilter), 
  [events, detailFilter]);

  const calculateStats = (category) => {
    const raw = events.filter(e => e.category === category);
    const filtered = filterData(raw, summaryFilter);
    const stats = {};
    
    filtered.forEach(ev => {
        const key = ev.reason_name || `Unknown (ID: ${ev.reason_id})`;
        if (!stats[key]) stats[key] = { name: key, freq: 0, dur: 0 };
        stats[key].freq += 1;
        stats[key].dur += parseFloat(ev.duration_minutes || 0);
    });
    return Object.values(stats).sort((a, b) => b.dur - a.dur);
  };

  const summaryUnplanned = useMemo(() => calculateStats('Unplanned'), [events, summaryFilter]);
  const summaryPlanned = useMemo(() => calculateStats('Planned'), [events, summaryFilter]);

  // --- REUSABLE COMPONENTS ---

  const TabButton = ({ id, label, icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-8 py-4 font-bold text-sm transition-all border-b-4 ${
        activeTab === id 
          ? "border-blue-600 text-blue-600 bg-blue-50/50" 
          : "border-transparent text-gray-400 hover:text-gray-600"
      }`}
    >
      <span>{icon}</span> {label}
    </button>
  );

  const DatePickerBar = ({ label, range, setRange }) => (
    <div className="flex flex-wrap items-end gap-4 bg-gray-50 p-3 rounded border border-gray-200 mb-4">
        <div className="font-bold text-gray-700 text-sm w-32 pt-2">{label}</div>
        <div className="flex-1 min-w-[150px]">
            <label className="block text-[10px] font-bold text-gray-400 uppercase">Start Time</label>
            <input 
                type="date" 
                className="w-full border p-1.5 text-sm rounded outline-none focus:ring-1 focus:ring-blue-500"
                value={range.start}
                onChange={(e) => setRange({...range, start: e.target.value})}
            />
        </div>
        <div className="flex-1 min-w-[150px]">
            <label className="block text-[10px] font-bold text-gray-400 uppercase">End Time</label>
            <input 
                type="date" 
                className="w-full border p-1.5 text-sm rounded outline-none focus:ring-1 focus:ring-blue-500"
                value={range.end}
                onChange={(e) => setRange({...range, end: e.target.value})}
            />
        </div>
        <button 
            onClick={() => setRange({start:"", end:""})}
            className="text-xs text-blue-600 underline font-bold px-2 py-2 hover:text-blue-800"
        >
            Clear Filter
        </button>
    </div>
  );

  const DetailTable = ({ title, data, colorClass, headerColor, showStatus }) => (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden border-t-4 ${colorClass} h-full flex flex-col`}>
        <div className="p-3 bg-gray-50 border-b flex justify-between items-center">
            <h3 className="font-bold text-gray-700 flex items-center gap-2 text-sm">
                {title} 
                <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs">{data.length}</span>
            </h3>
        </div>
        <div className="overflow-x-auto flex-1 max-h-[400px]">
            <table className="min-w-full text-left text-sm relative">
                <thead className={`${headerColor} text-gray-600 uppercase text-xs sticky top-0 z-10 shadow-sm`}>
                    <tr>
                        <th className="px-4 py-2">Dur</th>
                        <th className="px-4 py-2">Description</th>
                        {!showStatus && <th className="px-4 py-2">Date/Time</th>}
                        <th className={`px-4 py-2 ${showStatus ? 'text-right' : 'text-center'}`}>
                            {showStatus ? 'Status' : 'Source'}
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {data.length === 0 ? (
                        <tr><td colSpan="4" className="px-4 py-8 text-center text-gray-400 italic">No events found</td></tr>
                    ) : (
                        data.map((ev, i) => (
                            <tr key={ev.id || i} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-2 font-bold text-gray-800">{Math.round(ev.duration_minutes)}m</td>
                                <td className="px-4 py-2 text-blue-700 text-xs font-medium">{ev.reason_name}</td>
                                {!showStatus && (
                                    <td className="px-4 py-2 text-[10px] text-gray-400">
                                        {new Date(ev.start_time).toLocaleDateString()} {new Date(ev.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                    </td>
                                )}
                                <td className={`px-4 py-2 ${showStatus ? 'text-right' : 'text-center'}`}>
                                    {showStatus ? (
                                        <span className={`text-[10px] px-1 rounded font-bold border ${
                                            ev.status === 'MATCH' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-500 border-red-200'
                                        }`}>
                                            {ev.status}
                                        </span>
                                    ) : (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                                            ev.source_type === 'SUPERVISOR' ? "bg-green-50 text-green-600 border-green-200" : "bg-gray-50 text-gray-400 border-gray-200"
                                        }`}>
                                            {ev.source_type === 'SUPERVISOR' ? 'HUMAN' : 'MACHINE'}
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    </div>
  );

  const StatsTable = ({ title, data, colorClass, headerColor }) => (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden border-t-4 ${colorClass} h-full flex flex-col`}>
        <div className="p-3 bg-gray-50 border-b">
            <h3 className="font-bold text-gray-800 text-sm">{title}</h3>
        </div>
        <div className="overflow-x-auto flex-1 max-h-[300px]">
            <table className="min-w-full text-left text-sm relative">
                <thead className={`${headerColor} text-gray-700 uppercase text-xs font-bold sticky top-0 z-10 shadow-sm`}>
                    <tr>
                        <th className="px-4 py-2">Description</th>
                        <th className="px-4 py-2 text-right">Freq</th>
                        <th className="px-4 py-2 text-right">Total Duration</th>
                        <th className="px-4 py-2 text-right">Avg</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {data.length === 0 ? (
                        <tr><td colSpan="4" className="p-8 text-center text-gray-400 italic">No records in range</td></tr>
                    ) : (
                        data.map((stat, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-4 py-2 font-medium text-gray-700">{stat.name}</td>
                                <td className="px-4 py-2 text-right font-mono text-gray-600">{stat.freq}</td>
                                <td className="px-4 py-2 text-right font-bold text-gray-800">{stat.dur.toFixed(0)} m</td>
                                <td className="px-4 py-2 text-right text-gray-400 text-xs">{(stat.dur / stat.freq).toFixed(1)}</td>
                            </tr>
                        ))
                    )}
                </tbody>
                {data.length > 0 && (
                    <tfoot className="bg-gray-50 font-bold text-gray-800 border-t sticky bottom-0">
                        <tr>
                            <td className="px-4 py-2">TOTAL</td>
                            <td className="px-4 py-2 text-right">{data.reduce((s, i) => s + i.freq, 0)}</td>
                            <td className="px-4 py-2 text-right">{data.reduce((s, i) => s + i.dur, 0).toFixed(0)} m</td>
                            <td></td>
                        </tr>
                    </tfoot>
                )}
            </table>
        </div>
    </div>
  );

const FrequencyChart = ({ data, title, color }) => {
  const chartData = useMemo(() => {
    const counts = data.reduce((acc, curr) => {
      const label = curr.reason_name || curr.description || "Undefined";
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .map(([name, freq]) => ({ name, freq }))
      .sort((a, b) => b.freq - a.freq);
  }, [data]);

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 h-[400px] flex flex-col">
      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">{title}</h3>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={chartData} margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
            <XAxis type="number" hide />
            <YAxis 
                type="category" 
                dataKey="name" 
                width={120} 
                fontSize={9} 
                fontWeight="bold" 
                stroke="#64748b"
                tickLine={false}
                axisLine={false}
            />
            <Tooltip 
                cursor={{fill: '#f8fafc'}}
                contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '10px'}}
            />
            <Bar dataKey="freq" fill={color} radius={[0, 4, 4, 0]} barSize={20}>
                {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fillOpacity={1 - (index * 0.05)} />
                ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const WrappedTick = ({ x, y, payload }) => {
  const text = payload.value;
  // Breaks labels at " + ", " (", or if too long
  const words = text.split(/(?=[+(])/); 
  
  return (
    <g transform={`translate(${x},${y})`}>
      <text 
        x={-10} 
        y={0} 
        dy={words.length > 1 ? -6 : 4} 
        textAnchor="end" 
        fill="#64748b" 
        fontSize={10} 
        fontWeight="bold"
      >
        {words.map((line, i) => (
          <tspan x={-10} dy={i === 0 ? 0 : 12} key={i}>
            {line.trim()}
          </tspan>
        ))}
      </text>
    </g>
  );
};

    const ComparisonChart = ({ data, title, color, type }) => {
  const chartData = useMemo(() => {
    const stats = data.reduce((acc, curr) => {
      const label = curr.reason_name || curr.description || "Undefined";
      if (!acc[label]) acc[label] = { name: label, freq: 0, dur: 0 };
      acc[label].freq += 1;
      acc[label].dur += parseFloat(curr.duration_minutes || 0);
      return acc;
    }, {});
    return Object.values(stats).sort((a, b) => b[type] - a[type]);
  }, [data, type]);

  // DYNAMIC CALCULATIONS: Ensures long labels have space and don't overlap
  const dynamicMargin = useMemo(() => {
    const maxChars = Math.max(...chartData.map(d => d.name.length), 10);
    return Math.min(maxChars * 6.5, 200); 
  }, [chartData]);

  // DYNAMIC HEIGHT: Increases chart height based on the number of items to prevent vertical clashing
  const dynamicHeight = useMemo(() => {
    const itemCount = chartData.length;
    return Math.max(itemCount * 45, 400); // 45px per label ensures no overlap
  }, [chartData]);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col min-h-[300px]">
      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        {title}
      </h3>
      
      {/* --- NEW: CONDITIONAL "NO DATA" MESSAGE --- */}
      {chartData.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
           <span className="text-2xl mb-2 opacity-30">📊</span>
           <p className="text-xs font-bold text-slate-400 italic">No historical data found for this selection</p>
        </div>
      ) : (
        <div style={{ height: `${dynamicHeight}px`, width: '100%' }}>
          <ResponsiveContainer>
            <BarChart layout="vertical" data={chartData} margin={{ top: 5, right: 30, left: 110, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" tick={<WrappedTick />} interval={0} axisLine={false} tickLine={false} />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px' }}
                formatter={(val) => type === 'dur' ? [`${Math.round(val)} m`, 'Total Duration'] : [val, 'Occurrences']}
              />
              <Bar dataKey={type} fill={color} radius={[0, 12, 12, 0]} barSize={24}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fillOpacity={1 - (index * 0.05)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* HEADER */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8 flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-gray-800">Fette Downtime Statistics</h1>
            <p className="text-sm text-gray-500">Analyze planned and unplanned frequencies, durations, and human-verified logs.</p>
        </div>
        <div className="flex gap-4">
             {statusMsg && <span className="text-sm font-bold text-green-600 pt-2 animate-pulse">{statusMsg}</span>}
             <button 
                onClick={handleRunEtl}
                disabled={etlLoading}
                className={`px-6 py-2 rounded text-white font-bold shadow ${etlLoading ? "bg-gray-400" : "bg-purple-600 hover:bg-purple-700"}`}
            >
                {etlLoading ? "Processing..." : "Execute ETL"}
            </button>
        </div>
      </div>

      {/* TABS SELECTION (Updated Order) */}
      <div className="flex bg-white rounded-t-xl border border-gray-200 shadow-sm mb-0 overflow-hidden">
          <TabButton id="shift" label="Shift Summary" icon="🕒" />
          <TabButton id="summary" label="Reason Summary" icon="📊" />
          <TabButton id="analytics" label="Pareto Analysis" icon="🎯" />
          <TabButton id="logs" label=" Detailed Logs" icon="📋" />
      </div>

      {/* CONTENT AREA */}
      <div className="bg-white p-6 rounded-b-xl shadow-sm border border-t-0 border-gray-200 min-h-[500px]">
        {loading && activeTab !== 'shift' ? (
            <div className="flex items-center justify-center h-64 text-gray-400">Loading Smart Data...</div>
        ) : (
            <>
                {/* TAB 1: SHIFT SUMMARY WITH ANALYTICS */}
{activeTab === 'shift' && (
    <div className="animate-fadeIn space-y-8">
        {/* AUDIT CONTROL BAR */}
        <div className="flex flex-wrap items-center gap-4 mb-6 bg-slate-50/50 p-4 rounded-xl border border-slate-100 shadow-inner">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200 min-w-[140px]">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-tight mb-1">Target Date</label>
                    <input 
                        type="date" 
                        className="text-xs font-bold text-slate-700 outline-none bg-transparent w-full" 
                        value={shiftFilter.date} 
                        onChange={e => setShiftFilter({...shiftFilter, date: e.target.value})} 
                    />
                </div>
                <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200 min-w-[120px]">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-tight mb-1">Shift Name</label>
                    <select 
                        className="text-xs font-bold text-slate-700 outline-none bg-transparent w-full appearance-none cursor-pointer" 
                        value={shiftFilter.name} 
                        onChange={e => setShiftFilter({...shiftFilter, name: e.target.value})}
                    >
                        <option>Shift 1</option><option>Shift 2</option><option>Shift 3</option>
                    </select>
                </div>
            </div>
            <button onClick={fetchShiftSummary} className="ml-auto bg-slate-900 text-white px-6 py-2.5 rounded-lg text-[10px] font-black shadow-lg hover:bg-black transition-all active:scale-95">
                🔍 AUDIT SHIFT
            </button>
        </div>

        {/* BREAKDOWN TABLES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">
            <DetailTable 
                title="🔴 Unplanned Breakdown" 
                data={shiftComparison.filter(e => e.category === 'Unplanned')} 
                colorClass="border-red-500" 
                headerColor="bg-red-50" 
                showStatus={true} 
            />
            <DetailTable 
                title="🔵 Planned Breakdown" 
                data={shiftComparison.filter(e => e.category === 'Planned')} 
                colorClass="border-blue-500" 
                headerColor="bg-blue-50" 
                showStatus={true} 
            />
        </div>

        {/* NEW: SHIFT FREQUENCY CHARTS 
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FrequencyChart 
                title="📊 Shift Unplanned Frequency" 
                data={shiftComparison.filter(e => e.category === 'Unplanned')} 
                color="#ef4444" 
            />
            <FrequencyChart 
                title="📊 Shift Planned Frequency" 
                data={shiftComparison.filter(e => e.category === 'Planned')} 
                color="#3b82f6" 
            />
        </div> */}


        {/* BOTTOM ANALYTICS SECTION */}
<div className="space-y-10 mt-10 border-t pt-10 border-slate-100">
    
    {/* UNPLANNED ANALYSIS: FREQUENCY VS DURATION */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ComparisonChart 
            title="🔴 Unplanned: Frequency (Counts)" 
            data={shiftComparison.filter(e => e.category === 'Unplanned')} 
            color="#ef4444" 
            type="freq"
        />
        <ComparisonChart 
            title="🔴 Unplanned: Total Loss (Minutes)" 
            data={shiftComparison.filter(e => e.category === 'Unplanned')} 
            color="#b91c1c" 
            type="dur"
        />
    </div>

    {/* PLANNED ANALYSIS: FREQUENCY VS DURATION */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ComparisonChart 
            title="🔵 Planned: Frequency (Counts)" 
            data={shiftComparison.filter(e => e.category === 'Planned')} 
            color="#3b82f6" 
            type="freq"
        />
        <ComparisonChart 
            title="🔵 Planned: Total Utilized (Minutes)" 
            data={shiftComparison.filter(e => e.category === 'Planned')} 
            color="#1d4ed8" 
            type="dur"
        />
    </div>
</div>
    </div>
)}

                {/* TAB 2: REASON SUMMARY */}
                {activeTab === 'summary' && (
                    <div className="animate-fadeIn">
                        <DatePickerBar label="Analysis Period:" range={detailFilter} setRange={setDetailFilter} />
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">
                            <StatsTable title="🔴 Unplanned Summary" data={summaryUnplanned} colorClass="border-red-500" headerColor="bg-red-100" />
                            <StatsTable title="🔵 Planned Summary" data={summaryPlanned} colorClass="border-blue-500" headerColor="bg-blue-100" />
                        </div>
                    </div>
                )}

                {/* TAB 3: PARETO ANALYSIS */}
                {activeTab === 'analytics' && (
                    <div className="animate-fadeIn">
                        <div className="grid grid-cols-1 gap-6 h-[450px]">
                            <ParetoChart title="Monthly Pareto (Unplanned Losses)" data={events.filter(e => e.category === 'Unplanned')} />
                        </div>
                    </div>
                )}

                {/* TAB 4: DETAILED LOGS */}
                {activeTab === 'logs' && (
    <div className="animate-fadeIn space-y-8">
        
        {/* 1. TOP RANGE PICKER BAR */}
        <div className="flex items-center gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100 shadow-inner">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-tight mb-1">Start Date</label>
                    <input 
                        type="date" 
                        className="text-xs font-bold text-slate-700 outline-none bg-transparent" 
                        value={detailFilter.start} 
                        onChange={e => setDetailFilter({...detailFilter, start: e.target.value})} 
                    />
                </div>
                <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-tight mb-1">End Date</label>
                    <input 
                        type="date" 
                        className="text-xs font-bold text-slate-700 outline-none bg-transparent" 
                        value={detailFilter.end} 
                        onChange={e => setDetailFilter({...detailFilter, end: e.target.value})} 
                    />
                </div>
            </div>
            <p className="ml-auto text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                {events.length} Records Found In Range
            </p>
        </div>

        {/* 2. MIDDLE SECTION: DETAILED TABLES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[500px]">
            <DetailTable 
                title="🔴 Unplanned Logs" 
                data={detailedUnplanned} 
                colorClass="border-red-500" 
                headerColor="bg-red-50" 
            />
            <DetailTable 
                title="🔵 Planned Logs" 
                data={detailedPlanned} 
                colorClass="border-blue-500" 
                headerColor="bg-blue-50" 
            />
        </div>

        {/* 3. BOTTOM SECTION: FREQUENCY ANALYTICS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FrequencyChart 
                title="🎯 Unplanned Frequency (Occurrence Count)" 
                data={detailedUnplanned} 
                color="#ef4444" 
            />
            <FrequencyChart 
                title="🎯 Planned Frequency (Occurrence Count)" 
                data={detailedPlanned} 
                color="#3b82f6" 
            />
        </div>
        
    </div>
)}
            </>
        )}
      </div>
    </div>
  );
};

export default EtlManager;