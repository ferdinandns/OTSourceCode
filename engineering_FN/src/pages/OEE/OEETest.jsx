import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';

const OeeDashboard = () => {
// --- 1. GET TODAY'S DATE AS 'YYYY-MM-DD' ---
  const getTodayStr = () => {
    const today = new Date();
    // This handles timezone offset so you don't get yesterday's date by mistake
    const offset = today.getTimezoneOffset() * 60000;
    const localDate = new Date(today.getTime() - offset);
    return localDate.toISOString().split('T')[0];
  };

  // --- 2. INITIALIZE STATE WITH TODAY ---
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [selectedShift, setSelectedShift] = useState(1);
  const [oeeData, setOeeData] = useState(null);
  const [activeShift, setActiveShift] = useState(1);
  const [showMath, setShowMath] = useState(false);
  const [showDailyMath, setShowDailyMath] = useState(false); // <--- ADD THIS (for Daily)
  
  // --- HISTORY TABLE STATE ---
// 1. DATA variable: Must start as an empty ARRAY []
const [historyData, setHistoryData] = useState([]);
// 2. DATE inputs: These should use getTodayStr()
const [historyStart, setHistoryStart] = useState(getTodayStr());
const [historyEnd, setHistoryEnd] = useState(getTodayStr());
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [viewMode, setViewMode] = useState('daily');

  // Dashboard Data State
  const [data, setData] = useState({
    daily: null,
    shift1: null, shift2: null, shift3: null
  });
  const [trendData, setTrendData] = useState([]);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const shiftLabels = { 1: "06:30 — 15:00", 2: "15:00 — 22:45", 3: "22:45 — 06:30" };
  
  const COLORS = {
    avail: ['#2563EB', '#E2E8F0'], // Blue
    perf:  ['#059669', '#E2E8F0'], // Emerald
    qual:  ['#D97706', '#E2E8F0']  // Amber
  };

  // 1. Fetch Dashboard Data
const fetchData = async () => {
    setLoading(true);
    try {
      const [unifiedRes, trendRes] = await Promise.all([
        axios.get(`http://10.126.15.197:8002/part/getUnifiedOEE`, { params: { date: selectedDate } }),
        axios.get(`http://10.126.15.197:8002/part/getWeeklyTrend`)
      ]);

      console.log("Unified Data:", unifiedRes.data);
      const d = unifiedRes.data;

      // ⚠️ HELPER: Handles both 'raw' (Daily) and 'stats' (Shift) properties
      const formatData = (sourceData) => {
        if (!sourceData) return null;

        // STEP 1: Find where the numbers are hiding.
        // Daily data uses '.raw', Shifts use '.stats'
        const raw = sourceData.raw || sourceData.stats || {};

        return {
           oee: sourceData.oee, // "27.30%" (String)
           
           availability: {
               availability: sourceData.availability, // "60.80%"
               value: sourceData.availability,        // For Pie Chart
               
               // Map RAW numbers to the keys the UI expects
               numerator: raw.tRun,
               denominator: raw.tTime - raw.tPlan,
               runtime: raw.tRun,
               unplanned_downtime: raw.tUnplan,
               planned_downtime: raw.tPlan,
               
               // Specific keys for "Daily Logic" section
               total_runtime: raw.tRun,
               total_unplanned: raw.tUnplan,
               total_planned: raw.tPlan,
               total_shift_time: raw.tTime
           },
           
           performance: {
               performance: sourceData.performance, // "45.02%"
               value: sourceData.performance,
               
               actual_output: raw.tOut,
               target_rate: 5333, 
               actual_runtime: raw.tRun,
               // Fix for potential output
               potential_output: (raw.tTime - raw.tPlan) > 0 ? (raw.tRun * 5333) : 0, 
               
               // Specific key for "Daily Logic"
               total_output: raw.tOut
           },
           
           quality: {
               quality: sourceData.quality, // "99.72%"
               value: sourceData.quality,
               
               total_product: raw.tOut,
               total_rejects: raw.tRej,
               good_product: raw.tGood
           }
        };
      };

      setData({
        // Apply the smarter helper to all sets
        daily: formatData(d.daily),
        shift1: formatData(d.shifts[1]),
        shift2: formatData(d.shifts[2]),
        shift3: formatData(d.shifts[3])
      });

      // --- TREND LOGIC (Unchanged) ---
      const rawTrend = trendRes.data || [];
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
          const dateObj = new Date();
          dateObj.setDate(dateObj.getDate() - i);
          const offset = dateObj.getTimezoneOffset() * 60000;
          const dateStr = new Date(dateObj.getTime() - offset).toISOString().split('T')[0];
          last7Days.push(dateStr);
      }

      const formattedTrend = last7Days.map(dateStr => {
          const match = rawTrend.find(item => item.production_date && item.production_date.startsWith(dateStr));
          return {
            date: new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
            oee: match ? parseFloat(match.oee_value_daily) : 0,
            availability: match ? parseFloat(match.availability_value_daily) : 0,
            performance: match ? parseFloat(match.performance_value_daily) : 0,
            quality: match ? parseFloat(match.quality_value_daily) : 0
          };
      });

      setTrendData(formattedTrend);
      
    } catch (error) {
      console.error("Dashboard Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch History Log
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
        const res = await axios.get('http://10.126.15.197:8002/part/getHistoryLog', {
             params: { startDate: historyStart, endDate: historyEnd }
        });
        
        // ✅ SAFETY CHECK: If result is missing, force it to be []
        const safeData = Array.isArray(res.data) ? res.data : [];
        setHistoryData(safeData);

    } catch (error) {
        console.error("History Error:", error);
        setHistoryData([]); // ✅ Fallback to empty list on error
    } finally {
        setLoadingHistory(false);
    }
};

  useEffect(() => { 
      fetchData(); 
      fetchHistory(); 
  }, [selectedDate]);

  const handleGenerateData = async () => {
    if (!window.confirm("Overwrite data?")) return;
    setGenerating(true);
    try {
      await axios.get('http://10.126.15.197:8002/part/generateDummyDataWeekly');
      alert("✅ Data Generated!");
      fetchData(); 
    } catch (error) { alert("❌ Error"); } finally { setGenerating(false); }
  };

// ✅ NEW ARCHIVE LOGIC: 
  // We simply call 'getUniversalOEE' for all 3 shifts.
  // The backend now automatically saves (archives) the result every time we call this.
  // ✅ UPDATED ARCHIVE LOGIC (Uses selectedDate)
  // ✅ UPDATED ARCHIVE FUNCTION
  const handleArchive = async () => {
    // 1. Safety Checks
    if (!selectedDate) return alert("Please select a date first.");
    
    const confirm = window.confirm(`Sync & Archive data for ${selectedDate}?`);
    if (!confirm) return;

    setLoadingHistory(true); 

    try {
      // 2. CALL THE API WITH "ARCHIVE: TRUE"
      // This tells the backend: "Yes, please WRITE this to the database."
      await axios.get('http://10.126.15.197:8002/part/getUnifiedOEE', {
        params: { 
            date: selectedDate,
            archive: 'true' // <--- THIS IS THE MISSING KEY
        }
      });

      // 3. Refresh the UI
      await fetchData();     
      await fetchHistory(); 

      alert(`✅ Successfully Synced & Archived ${selectedDate}!`);

    } catch (error) {
      console.error("❌ Archive Failed:", error);
      alert("Failed to sync data.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const activeData = activeShift === 1 ? { metrics: data.shift1 } : activeShift === 2 ? { metrics: data.shift2 } : { metrics: data.shift3 };
  
  // Helper for Pie Data
  const getPieData = (val) => [{ name: 'Ok', value: parseFloat(val)||0 }, { name: 'Loss', value: 100 - (parseFloat(val)||0) }];
  
  const getOeeColor = (val) => {
      const num = parseFloat(val);
      if(num >= 85) return "text-emerald-500";
      if(num >= 75) return "text-blue-500";
      if(num >= 60) return "text-amber-500";
      return "text-red-500";
  };

  const activeMetrics = activeShift === 1 ? data.shift1 : activeShift === 2 ? data.shift2 : data.shift3;

  

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-900">
      
      {/* HEADER */}
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Fette Machine Dashboard</h1>
          <p className="text-slate-500 font-medium mt-1">Production Overview | <span className="font-mono font-bold text-indigo-600">{selectedDate}</span></p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="border p-2 rounded-lg font-bold text-slate-700 text-sm"/>
            
            <button 
    onClick={handleArchive}
    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded shadow flex items-center gap-2"
>
    {/* You can keep your existing Icon here */}
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
    </svg>
    Sync & Archive Day
</button>
            {/*
            <button onClick={handleGenerateData} disabled={generating} className="px-4 py-2 bg-indigo-600 text-white font-bold text-sm rounded-lg shadow-sm hover:bg-indigo-700 disabled:opacity-50">
                {generating ? '...' : '⚡ New Data'}
            </button> */}

        </div> 
      </header>

      {loading ? <div className="p-12 text-center text-slate-400 italic">Loading Dashboard...</div> : (
        <>
            {/* --- DAILY AGGREGATE SECTION --- */}
<div className="bg-white rounded-3xl p-8 mb-8 shadow-sm border border-indigo-50">
  
  {/* Existing Daily Score & Pie Charts Code... */}
  <div className="text-center mb-10 border-b border-slate-100 pb-8">
      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Daily Aggregated OEE</h2>
      <div className={`text-7xl font-black ${getOeeColor(data.daily?.oee)}`}>{data.daily?.oee || "0.00%"}</div>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 justify-items-center">
      <PieCard title="Daily Availability" value={data.daily?.availability?.value} color={COLORS.avail} textColor="text-blue-600" />
      <PieCard title="Daily Performance" value={data.daily?.performance?.value} color={COLORS.perf} textColor="text-emerald-600" />
      <PieCard title="Daily Quality" value={data.daily?.quality?.value} color={COLORS.qual} textColor="text-amber-600" />
  </div>

  {/* --- NEW: DAILY MATH VALIDATOR --- */}
  <div className="mt-8 flex justify-center">
      <button onClick={() => setShowDailyMath(!showDailyMath)} className="text-xs font-bold text-slate-400 hover:text-indigo-600 underline">
          {showDailyMath ? 'Hide Daily Logic' : 'Show Daily Calculation Logic'}
      </button>
  </div>

  {showDailyMath && data.daily && (
      <div className="mt-6 bg-slate-50 p-6 rounded-xl border border-slate-200 text-left text-xs font-mono text-slate-600 grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* 1. DAILY AVAILABILITY */}
          <div>
              <h5 className="font-bold text-blue-600 mb-2 border-b border-blue-200 pb-1">DAILY AVAILABILITY</h5>
              <div className="space-y-1 mt-2 pl-2 border-l-2 border-slate-200">
                  <div className="flex justify-between"><span>Total Runtime:</span> <span>{data.daily.availability?.total_runtime} m</span></div>
                  <div className="flex justify-between"><span>Total Unplanned:</span> <span>{data.daily.availability?.total_unplanned} m</span></div>
                  <div className="flex justify-between"><span>Total Planned:</span> <span>{data.daily.availability?.total_planned} m</span></div>
                  <div className="flex justify-between"><span>Total Shift Time:</span> <span>{data.daily.availability?.total_shift_time} m</span></div>
                  <div className="flex justify-between font-bold text-slate-800 pt-1 border-t border-slate-200 mt-1">
                      <span>Result:</span> 
                      <span>{data.daily.availability?.value}</span>
                  </div>
              </div>
          </div>

          {/* 2. DAILY PERFORMANCE */}
          <div>
              <h5 className="font-bold text-emerald-600 mb-2 border-b border-emerald-200 pb-1">DAILY PERFORMANCE</h5>
              <div className="space-y-1 mt-2 pl-2 border-l-2 border-slate-200">
                  <div className="flex justify-between"><span>Total Output:</span> <span>{data.daily.performance?.total_output?.toLocaleString()}</span></div>
                  <div className="flex justify-between text-amber-600"><span>Potential Out:</span> <span>{Math.round(data.daily.performance?.potential_output)?.toLocaleString()}</span></div>
                  <div className="flex justify-between font-bold text-slate-800 pt-1 border-t border-slate-200 mt-1">
                      <span>Result:</span> 
                      <span>{data.daily.performance?.value}</span>
                  </div>
              </div>
          </div>

          {/* 3. DAILY QUALITY */}
          <div>
              <h5 className="font-bold text-amber-600 mb-2 border-b border-amber-200 pb-1">DAILY QUALITY</h5>
              <div className="space-y-1 mt-2 pl-2 border-l-2 border-slate-200">
                  <div className="flex justify-between"><span>Total Output:</span> <span>{data.daily.quality?.total_output?.toLocaleString()}</span></div>
                  <div className="flex justify-between text-red-500"><span>Total Rejects:</span> <span>{data.daily.quality?.total_rejects}</span></div>
                  <div className="flex justify-between text-emerald-600"><span>Good Product:</span> <span>{data.daily.quality?.good_product?.toLocaleString()}</span></div>
                  <div className="flex justify-between font-bold text-slate-800 pt-1 border-t border-slate-200 mt-1">
                      <span>Result:</span> 
                      <span>{data.daily.quality?.value}</span>
                  </div>
              </div>
          </div>

      </div>
  )}
</div>

            {/* --- SHIFT BREAKDOWN SECTION --- */}
            <div className="mb-10 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-end mb-6 pb-4 border-b border-slate-100">
                       <div>
                          <h2 className="text-xl font-bold text-slate-700">Shift Breakdown</h2>
                          <p className="text-xs text-slate-400 mt-1">Live Metrics for Shift {activeShift}</p>
                       </div>
                       <div className="flex gap-2">
                          {[1, 2, 3].map((num) => (
                              <button key={num} onClick={() => setActiveShift(num)} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeShift === num ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                  Shift {num}
                              </button>
                          ))}
                      </div>
                  </div>

                  {activeData && (
                    <>
                        <div className="text-center mb-10">
                             <h3 className="text-lg font-bold text-slate-500 uppercase tracking-widest mb-1">Shift {activeShift} OEE</h3>
                             <div className={`text-6xl font-black ${getOeeColor(activeData.metrics?.oee)}`}>{activeData.metrics?.oee}</div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 justify-items-center">
                             {/* Availability Pie */}
                             <div className="flex flex-col items-center">
                                <h4 className="text-sm font-bold text-slate-500 uppercase mb-4">Availability</h4>
                                <div className="relative w-64 h-64">
                                    <ResponsiveContainer>
                                        <PieChart>
                                            <Pie data={getPieData(activeData.metrics?.availability?.availability)} innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value">
                                                {getPieData(activeData.metrics?.availability?.availability).map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS.avail[index % COLORS.avail.length]} />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex items-center justify-center text-3xl font-black text-blue-600">
                                        {activeData.metrics?.availability?.availability}
                                    </div>
                                </div>
                            </div>
                            {/* Performance Pie */}
                            <div className="flex flex-col items-center">
                                <h4 className="text-sm font-bold text-slate-500 uppercase mb-4">Performance</h4>
                                <div className="relative w-64 h-64">
                                    <ResponsiveContainer>
                                        <PieChart>
                                            <Pie data={getPieData(activeData.metrics?.performance?.performance)} innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value">
                                                {getPieData(activeData.metrics?.performance?.performance).map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS.perf[index % COLORS.perf.length]} />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex items-center justify-center text-3xl font-black text-emerald-600">
                                        {activeData.metrics?.performance?.performance}
                                    </div>
                                </div>
                            </div>
                            {/* Quality Pie */}
                            <div className="flex flex-col items-center">
                                <h4 className="text-sm font-bold text-slate-500 uppercase mb-4">Quality</h4>
                                <div className="relative w-64 h-64">
                                    <ResponsiveContainer>
                                        <PieChart>
                                            <Pie data={getPieData(activeData.metrics?.quality?.quality)} innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value">
                                                {getPieData(activeData.metrics?.quality?.quality).map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS.qual[index % COLORS.qual.length]} />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex items-center justify-center text-3xl font-black text-amber-600">
                                        {activeData.metrics?.quality?.quality}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* MATH VALIDATOR */}
                        <div className="mt-8 flex justify-center">
                            <button onClick={() => setShowMath(!showMath)} className="text-xs font-bold text-slate-400 hover:text-indigo-600 underline">
                                {showMath ? 'Hide Logic' : 'Show Calculation Logic'}
                            </button>
                        </div>
                        {showMath && activeMetrics && (
    <div className="mt-6 bg-slate-50 p-6 rounded-xl border border-slate-200 text-left text-xs font-mono text-slate-600 grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* 1. AVAILABILITY LOGIC */}
        <div>
            <h5 className="font-bold text-blue-600 mb-2 border-b border-blue-200 pb-1">AVAILABILITY</h5>
            <p className="mb-1">Formula: <span className="bg-white px-1 rounded border">Run / (ShiftTime - PlannedStop)</span></p>
            <div className="space-y-1 mt-2 pl-2 border-l-2 border-slate-200">
                <div className="flex justify-between"><span>Runtime:</span> <span>{activeMetrics.availability?.runtime} min</span></div>
                <div className="flex justify-between"><span>Unplanned Stop:</span> <span>{activeMetrics.availability?.unplanned_downtime} min</span></div>
                <div className="flex justify-between"><span>Planned Stop:</span> <span>{activeMetrics.availability?.planned_downtime} min</span></div>
                <div className="flex justify-between font-bold text-slate-800 pt-1">
                    <span>Result:</span> 
                    <span>{activeMetrics.availability?.numerator} / {activeMetrics.availability?.denominator} = {activeMetrics.availability?.availability}</span>
                </div>
            </div>
        </div>

        {/* 2. PERFORMANCE LOGIC (Here is your issue) */}
        <div>
            <h5 className="font-bold text-emerald-600 mb-2 border-b border-emerald-200 pb-1">PERFORMANCE</h5>
            <p className="mb-1">Formula: <span className="bg-white px-1 rounded border">ActualOut / PotentialOut</span></p>
            <div className="space-y-1 mt-2 pl-2 border-l-2 border-slate-200">
                <div className="flex justify-between"><span>Actual Output:</span> <span>{activeMetrics.performance?.actual_output?.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Target Rate:</span> <span>{activeMetrics.performance?.target_rate} /min</span></div>
                <div className="flex justify-between"><span>Runtime Used:</span> <span>{activeMetrics.performance?.actual_runtime} min</span></div>
                <div className="flex justify-between text-amber-600"><span>Potential Out:</span> <span>{Math.round(activeMetrics.performance?.potential_output)?.toLocaleString()}</span></div>
                <div className="flex justify-between font-bold text-slate-800 pt-1">
                    <span>Result:</span> 
                    <span>{activeMetrics.performance?.performance}</span>
                </div>
            </div>
        </div>

        {/* 3. QUALITY LOGIC */}
        <div>
            <h5 className="font-bold text-amber-600 mb-2 border-b border-amber-200 pb-1">QUALITY</h5>
            <p className="mb-1">Formula: <span className="bg-white px-1 rounded border">Good / Total Output</span></p>
            <div className="space-y-1 mt-2 pl-2 border-l-2 border-slate-200">
                <div className="flex justify-between"><span>Total Output:</span> <span>{activeMetrics.quality?.total_product?.toLocaleString()}</span></div>
                <div className="flex justify-between text-red-500"><span>Rejects:</span> <span>{activeMetrics.quality?.total_rejects}</span></div>
                <div className="flex justify-between text-emerald-600"><span>Good Product:</span> <span>{activeMetrics.quality?.good_product?.toLocaleString()}</span></div>
                <div className="flex justify-between font-bold text-slate-800 pt-1">
                    <span>Result:</span> 
                    <span>{activeMetrics.quality?.quality}</span>
                </div>
            </div>
        </div>

    </div>
)}
                    </>
                  )}
            </div>

            {/* --- WEEKLY TREND (BAR CHART) --- */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 mb-10">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-8">Weekly OEE Trend</h3>
                <div className="h-96 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 14}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 14}} domain={[0, 100]} />
                            <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px'}} />
                            <Legend wrapperStyle={{paddingTop: '20px'}} />
                            <Bar dataKey="oee" fill="#6366F1" radius={[6, 6, 0, 0]} name="OEE Score" barSize={24} />
                            <Bar dataKey="availability" fill="#93C5FD" radius={[6, 6, 0, 0]} name="Avail" barSize={12} />
                            <Bar dataKey="performance" fill="#6EE7B7" radius={[6, 6, 0, 0]} name="Perf" barSize={12} />
                            <Bar dataKey="quality" fill="#FCD34D" radius={[6, 6, 0, 0]} name="Qual" barSize={12} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* --- HISTORICAL TABLE --- */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 mt-8">
        
        {/* HEADER & CONTROLS */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6">
          <h3 className="text-lg font-black text-slate-700 uppercase tracking-widest">Historical Log</h3>
          
          <div className="flex gap-4 items-center mt-4 md:mt-0">
            
            {/* 1. VIEW MODE TOGGLE */}
            <div className="bg-slate-100 p-1 rounded-lg flex text-sm font-bold border border-slate-200">
              <button
                onClick={() => setViewMode('daily')}
                className={`px-4 py-1.5 rounded-md transition-all ${
                  viewMode === 'daily' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setViewMode('shifts')}
                className={`px-4 py-1.5 rounded-md transition-all ${
                  viewMode === 'shifts' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Shifts
              </button>
            </div>

            {/* 2. DATE PICKER */}
            <div className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
              <input type="date" value={historyStart} onChange={e => setHistoryStart(e.target.value)} className="bg-transparent text-sm font-bold text-slate-600 outline-none"/>
              <span className="text-slate-400 font-bold">-</span>
              <input type="date" value={historyEnd} onChange={e => setHistoryEnd(e.target.value)} className="bg-transparent text-sm font-bold text-slate-600 outline-none"/>
              <button onClick={fetchHistory} className="ml-2 bg-indigo-600 text-white px-4 py-1.5 rounded-md text-sm font-bold hover:bg-indigo-700 shadow-sm transition-transform active:scale-95">
                Search
              </button>
            </div>
          </div>
        </div>

        {/* TABLE CONTENT */}
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-extrabold">Date</th>
                <th className="px-6 py-4 font-bold text-indigo-600">OEE</th>
                <th className="px-6 py-4">Avail</th>
                <th className="px-6 py-4">Perf</th>
                <th className="px-6 py-4">Qual</th>
                <th className="px-6 py-4">Run Time</th>
                <th className="px-6 py-4">Stop Time</th>
                <th className="px-6 py-4">Total Output</th>
                <th className="px-6 py-4 text-red-500">Total Reject</th>
              </tr>
            </thead>
            <tbody>
              {loadingHistory ? (
                <tr><td colSpan="9" className="text-center py-8 text-slate-400">Loading history...</td></tr>
              ) : (historyData?.length || 0) > 0 ? (
                historyData.map((dayItem) => (
                  <React.Fragment key={dayItem.date}>
                    
                    {/* === VIEW MODE: DAILY === */}
                    {viewMode === 'daily' && (
                      <tr className="bg-white border-b hover:bg-indigo-50/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800">
                          {new Date(dayItem.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                        <td className="px-6 py-4 font-black text-indigo-600 text-lg">
                          {/* Use optional chaining and parseFloat to be safe */}
                          {parseFloat(dayItem.daily?.oee || 0).toFixed(2)}%
                        </td>
                        <td className="px-6 py-4 font-medium">{parseFloat(dayItem.daily?.availability || 0).toFixed(2)}%</td>
                        <td className="px-6 py-4 font-medium">{parseFloat(dayItem.daily?.performance || 0).toFixed(2)}%</td>
                        <td className="px-6 py-4 font-medium">{parseFloat(dayItem.daily?.quality || 0).toFixed(2)}%</td>
                        
                        <td className="px-6 py-4 font-mono text-slate-500">{dayItem.daily?.total_run} m</td>
                        <td className="px-6 py-4 font-mono text-amber-600">{dayItem.daily?.total_stop} m</td>
                        <td className="px-6 py-4 font-mono text-emerald-600 font-bold">{dayItem.daily?.total_output?.toLocaleString()}</td>
                        <td className="px-6 py-4 font-mono text-red-500 font-bold">{dayItem.daily?.total_reject?.toLocaleString()}</td>
                      </tr>
                    )}

                    {/* === VIEW MODE: SHIFTS === */}
                    {viewMode === 'shifts' && [1, 2, 3].map(shiftId => {
                        const shift = dayItem.shifts[shiftId];
                        
                        // If the shift is missing (e.g., future shift), don't render it
                        if (!shift) return null; 
                        
                        return (
                          <tr key={`${dayItem.date}-${shiftId}`} className="bg-white border-b hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-slate-500">
                              <div className="flex items-center gap-2">
                                {/* Only show date for Shift 1 for a cleaner look */}
                                <span className={shiftId === 1 ? "font-bold text-slate-800" : "invisible"}>
                                  {new Date(dayItem.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                </span>
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                                  shiftId === 1 ? "bg-blue-100 text-blue-700" :
                                  shiftId === 2 ? "bg-purple-100 text-purple-700" :
                                  "bg-indigo-100 text-indigo-700"
                                }`}>
                                  Shift {shiftId}
                                </span>
                              </div>
                            </td>

                            {/* ✅ THE FIX: Read the mapped 'shift' keys, NOT the DB 'daily' keys */}
                            {/* Make sure your backend maps these to oee_value_shift, etc. */}
                            <td className="px-6 py-4 font-bold text-slate-700">
                                {parseFloat(shift.oee || 0).toFixed(2)}%
                            </td>
                            <td className="px-6 py-4 text-slate-500">{parseFloat(shift.avail || 0).toFixed(2)}%</td>
                            <td className="px-6 py-4 text-slate-500">{parseFloat(shift.perf || 0).toFixed(2)}%</td>
                            <td className="px-6 py-4 text-slate-500">{parseFloat(shift.qual || 0).toFixed(2)}%</td>
                            
                            {/* Raw Counters */}
                            <td className="px-6 py-4 font-mono text-slate-400">{shift.total_run} m</td>
                            <td className="px-6 py-4 font-mono text-slate-400">{shift.total_stop} m</td>
                            <td className="px-6 py-4 font-mono text-emerald-600/70">{shift.total_product?.toLocaleString()}</td>
                            <td className="px-6 py-4 font-mono text-red-400">{shift.reject?.toLocaleString()}</td>
                          </tr>
                        );
                    })}

                  </React.Fragment>
                ))
              ) : (
                <tr><td colSpan="9" className="text-center py-8 text-slate-400 italic">No logs found for this period. Try archiving data first.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}
    </div>
  );
};

export default OeeDashboard;

// --- SUB-COMPONENT FOR PIE CHARTS ---
// Place this OUTSIDE your main OeeDashboard component (at the bottom of the file)
const PieCard = ({ title, value, color, textColor }) => {
    // Helper to format data for Recharts
    const getPieData = (valString) => {
        const val = parseFloat(valString) || 0;
        return [{ name: 'Ok', value: val }, { name: 'Loss', value: 100 - val }];
    };

    const pieData = getPieData(value);

    return (
      <div className="flex flex-col items-center">
        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">{title}</h4>
        <div className="relative w-48 h-48">
          <ResponsiveContainer>
            <PieChart>
              <Pie 
                data={pieData} 
                innerRadius={60} 
                outerRadius={80} 
                paddingAngle={5} 
                dataKey="value"
                stroke="none"
              >
                {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={color[index % color.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Centered Percentage Text */}
          <div className={`absolute inset-0 flex items-center justify-center text-2xl font-black ${textColor}`}>
            {value || "0%"}
          </div>
        </div>
      </div>
    );
};