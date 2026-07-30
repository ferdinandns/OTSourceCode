import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const COLORS = {
    avail: ['#3b82f6', '#f1f5f9'], 
    perf:  ['#10b981', '#f1f5f9'], 
    qual:  ['#f59e0b', '#f1f5f9']  
};

const FetteOeeDashboard = () => {
    // --- STATE ---
    // Dashboard Date (Live View)
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    
    // History Log Date Range (Default: Today to Today, or Last 30 Days)
    const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 14)).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const [data, setData] = useState(null);
    const [historyData, setHistoryData] = useState([]); 
    const [loading, setLoading] = useState(false);
    
    const [activeShift, setActiveShift] = useState(1);
    const [showDailyLogic, setShowDailyLogic] = useState(false);
    const [showShiftLogic, setShowShiftLogic] = useState(false);
    const [historyMode, setHistoryMode] = useState('daily'); 
    const [isSyncing, setIsSyncing] = useState(false);

    const TARGET_RATE = 5333;
    const SHIFT_DURATIONS = { 1: 510, 2: 465, 3: 465 };

    // --- FETCH DATA ---
    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Today's Live Dashboard Data
            const todayRes = await fetch(`http://10.126.15.197:8002/part/getUnifiedOEE2?date=${date}`);
            const todayResult = await todayRes.json();
            setData(todayResult);

            // 2. Fetch Historical Logs with Date Range
            // Pass the startDate and endDate states to the backend
            const historyRes = await fetch(`http://10.126.15.197:8002/part/getHistoryLog?startDate=${startDate}&endDate=${endDate}`);
            const historyResult = await historyRes.json();
            setHistoryData(historyResult);

        } catch (err) {
            console.error("Fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    // Initial Fetch & Refetch when 'date' changes
    useEffect(() => { fetchData(); }, [date]);

    // Handle Search Button Click for History
    const handleHistorySearch = () => {
        fetchData();
    };

    const handleSyncAndArchive = async () => {
    // Assuming you have a state for the date picker, e.g., `selectedDate`
    // If your state is named differently (like `dashboardDate`), change it here!
    if (!date) {
      alert("Please select a date first.");
      return;
    }

    setIsSyncing(true);
    try {
      // ⚠️ IMPORTANT: Make sure this URL matches your new route for getUnifiedOEE2
      await axios.get('http://10.126.15.197:8002/part/getUnifiedOEE2', {
        params: {
          date: date, // Sends the date from your date picker (e.g., '2026-01-21')
          archive: 'true'     // This triggers the saving block in your backend
        }
      });

      alert(`✅ Successfully synced and archived data for ${date}!`);
      
      // If you have a function to refresh the history table, call it here:
      // fetchHistory(); 

    } catch (error) {
      console.error("❌ Sync Error:", error);
      alert("Failed to sync data. Check the console for details.");
    } finally {
      setIsSyncing(false);
    }
  };
    

    // --- HELPER COMPONENTS ---
    const CalculationTable = ({ stats, shiftTime, isDaily = false }) => {
        const r = parseFloat(stats?.tRun || stats?.run_time) || 0;
        const o = parseFloat(stats?.tOut || stats?.total_prod) || 0;
        const g = parseFloat(stats?.tGood || stats?.total_good) || 0;
        const p = parseFloat(stats?.tPlan || stats?.planned_stop) || 0;
        const t = parseFloat(stats?.tTime || stats?.total_time) || shiftTime; 
        const pot = (t - p) * TARGET_RATE;
        const calcPct = (n, d) => d > 0 ? (n / d) * 100 : 0;

        return (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-[#f8fafc] border-t border-slate-100 rounded-b-3xl text-left">
                <div className="space-y-1 text-[11px] font-medium text-slate-500">
                    <p className="text-blue-600 font-bold border-b border-blue-100 mb-2 uppercase">{isDaily ? 'Daily' : ''} Availability</p>
                    <p className="italic text-[10px] mb-2">Formula: Run / (ShiftTime - PlannedStop)</p>
                    <div className="flex justify-between"><span>Total Runtime:</span><span>{r} m</span></div>
                    <div className="flex justify-between"><span>Total Planned:</span><span>{p} m</span></div>
                    <div className="flex justify-between"><span>Total Shift Time:</span><span>{t} m</span></div>
                    <div className="flex justify-between font-bold text-slate-900 pt-1 border-t"><span>Result:</span><span>{(calcPct(r, t - p)).toFixed(2)}%</span></div>
                </div>
                <div className="space-y-1 text-[11px] font-medium text-slate-500">
                    <p className="text-emerald-600 font-bold border-b border-green-100 mb-2 uppercase">{isDaily ? 'Daily' : ''} Performance</p>
                    <p className="italic text-[10px] mb-2">Formula: ActualOut / PotentialOut</p>
                    <div className="flex justify-between"><span>Total Output:</span><span>{o.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Potential:</span><span className="text-orange-500 font-bold">{pot.toLocaleString()}</span></div>
                    <div className="flex justify-between font-bold text-slate-900 pt-1 border-t"><span>Result:</span><span>{calcPct(o, pot).toFixed(2)}%</span></div>
                </div>
                <div className="space-y-1 text-[11px] font-medium text-slate-500">
                    <p className="text-amber-600 font-bold border-b border-orange-100 mb-2 uppercase">{isDaily ? 'Daily' : ''} Quality</p>
                    <p className="italic text-[10px] mb-2">Formula: Good / Total Output</p>
                    <div className="flex justify-between"><span>Total Output:</span><span>{o.toLocaleString()}</span></div>
                    <div className="flex justify-between text-red-500"><span>Rejects:</span><span>{(o - g).toLocaleString()}</span></div>
                    <div className="flex justify-between font-bold text-slate-900 pt-1 border-t"><span>Result:</span><span>{calcPct(g, o).toFixed(2)}%</span></div>
                </div>
            </div>
        );
    };

    const renderHistoryTable = () => {
        if (!historyData || historyData.length === 0) return <div className="p-8 text-center text-slate-400">No historical logs found within range.</div>;

        return (
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                            <th className="py-4 px-4">Date</th>
                            <th className="py-4 px-4 text-blue-600">OEE</th>
                            <th className="py-4 px-4">Avail</th>
                            <th className="py-4 px-4">Perf</th>
                            <th className="py-4 px-4">Qual</th>
                            <th className="py-4 px-4">Run Time</th>
                            <th className="py-4 px-4">Stop Time</th>
                            <th className="py-4 px-4 text-green-600">Total Output</th>
                            <th className="py-4 px-4 text-red-500">Total Reject</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs font-bold text-slate-600">
                        {historyData.map((dayItem, index) => {
                            const dateObj = new Date(dayItem.date);
                            const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

                            if (historyMode === 'daily') {
                                const d = dayItem.daily || {};
                                return (
                                    <tr key={index} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                        <td className="py-4 px-4 text-slate-800">{dateStr}</td>
                                        <td className="py-4 px-4 text-lg font-black text-blue-600">{parseFloat(d.oee || 0).toFixed(2)}%</td>
                                        <td className="py-4 px-4">{parseFloat(d.availability || 0).toFixed(2)}%</td>
                                        <td className="py-4 px-4">{parseFloat(d.performance || 0).toFixed(2)}%</td>
                                        <td className="py-4 px-4">{parseFloat(d.quality || 0).toFixed(2)}%</td>
                                        <td className="py-4 px-4 font-mono text-slate-400">{d.total_run} m</td>
                                        <td className="py-4 px-4 font-mono text-slate-400">{d.total_stop} m</td>
                                        <td className="py-4 px-4 text-green-600 font-black">{d.total_output?.toLocaleString()}</td>
                                        <td className="py-4 px-4 text-red-500 font-black">{d.total_reject?.toLocaleString()}</td>
                                    </tr>
                                );
                            } else {
                                return [1, 2, 3].map((shiftId, sIndex) => {
                                    const s = dayItem.shifts?.[shiftId] || {};
                                    return (
                                        <tr key={`${index}-${shiftId}`} className={`border-slate-50 hover:bg-slate-50 ${shiftId === 3 ? 'border-b-2 border-slate-100' : 'border-b'}`}>
                                            <td className="py-4 px-4">
                                                {sIndex === 0 ? <span className="text-slate-800">{dateStr}</span> : null}
                                                <div className="mt-1">
                                                    <span className={`text-[9px] px-2 py-0.5 rounded text-white font-bold ${shiftId === 1 ? 'bg-indigo-500' : shiftId === 2 ? 'bg-purple-500' : 'bg-slate-400'}`}>SHIFT {shiftId}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 text-lg font-black text-blue-600">{parseFloat(s.oee || 0).toFixed(2)}%</td>
                                            <td className="py-4 px-4">{parseFloat(s.avail || 0).toFixed(2)}%</td>
                                            <td className="py-4 px-4">{parseFloat(s.perf || 0).toFixed(2)}%</td>
                                            <td className="py-4 px-4">{parseFloat(s.qual || 0).toFixed(2)}%</td>
                                            <td className="py-4 px-4 font-mono text-slate-400">{s.total_run || 0} m</td>
                                            <td className="py-4 px-4 font-mono text-slate-400">{s.total_stop || 0} m</td>
                                            <td className="py-4 px-4 text-green-600 font-black">{(s.total_product || 0).toLocaleString()}</td>
                                            <td className="py-4 px-4 text-red-500 font-black">{(s.reject || 0).toLocaleString()}</td>
                                        </tr>
                                    );
                                });
                            }
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#f1f5f9] p-8 font-sans">
            <div className="max-w-[1400px] mx-auto space-y-8">
                {/* Header */}
                <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm">
                    <h1 className="text-2xl font-black text-slate-800">Fette Performance Console</h1>
                    <div className="flex gap-4 items-center">
                         <span className="text-xs font-bold text-slate-400 uppercase">Live Date:</span>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 font-bold text-slate-700 shadow-sm" />
                    </div>
                    {/* Button to Archive Trigger Today's Data
                    <button
                        onClick={handleSyncAndArchive}
                        disabled={isSyncing}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all active:scale-95 ${
                            isSyncing 
                            ? "bg-indigo-400 text-white cursor-not-allowed" 
                            : "bg-indigo-600 text-white hover:bg-indigo-700"
                        }`}
                        >
                        {isSyncing ? (
                            <>
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Archiving...
                            </>
                        ) : (
                            <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                            </svg>
                            Sync & Archive Day
                            </>
                        )}
                        </button> */}
                </div>

                {/* Dashboard Sections ... */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-10 text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Daily Aggregated OEE</p>
                    <h2 className="text-7xl font-black text-[#ef4444] mb-12">{data?.daily?.oee || "0.00%"}</h2>
                    
                    <div className="flex flex-col md:flex-row justify-center gap-20 mb-8">
                        <RechartsPie label="Daily Availability" valueString={data?.daily?.availability} type="avail" />
                        <RechartsPie label="Daily Performance" valueString={data?.daily?.performance} type="perf" />
                        <RechartsPie label="Daily Quality" valueString={data?.daily?.quality} type="qual" />
                    </div>
                    <button onClick={() => setShowDailyLogic(!showDailyLogic)} className="mt-8 text-[10px] font-bold text-slate-400 hover:text-slate-600 underline">
                        {showDailyLogic ? 'Hide Daily Logic' : 'Show Daily Calculation Logic'}
                    </button>
                    {showDailyLogic && <CalculationTable stats={data?.daily?.raw} shiftTime={data?.daily?.raw?.tTime} isDaily={true} />}
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-10">
                        <div className="flex justify-between items-center mb-10">
                            <div><h3 className="text-xl font-bold text-slate-800">Shift Breakdown</h3></div>
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                {[1, 2, 3].map(id => (
                                    <button key={id} onClick={() => setActiveShift(id)} className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${activeShift === id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Shift {id}</button>
                                ))}
                            </div>
                        </div>
                        <div className="text-center mb-10"><h2 className="text-7xl font-black text-red-500">{data?.shifts?.[activeShift]?.oee || "0.00%"}</h2></div>
                        <div className="flex flex-col md:flex-row justify-center gap-20">
                            <RechartsPie label="Availability" valueString={data?.shifts?.[activeShift]?.availability} type="avail" />
                            <RechartsPie label="Performance" valueString={data?.shifts?.[activeShift]?.performance} type="perf" />
                            <RechartsPie label="Quality" valueString={data?.shifts?.[activeShift]?.quality} type="qual" />
                        </div>
                        <div className="text-center mt-8"><button onClick={() => setShowShiftLogic(!showShiftLogic)} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 underline">{showShiftLogic ? 'Hide Logic' : 'Show Logic'}</button></div>
                    </div>
                    {showShiftLogic && <CalculationTable stats={data?.shifts?.[activeShift]?.raw} shiftTime={SHIFT_DURATIONS[activeShift]} />}
                </div>

                {/* HISTORICAL LOG */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden p-8">
                    <div className="flex flex-col md:flex-row justify-between items-center mb-8">
                        <div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Historical Log</h3>
                            <p className="text-xs text-slate-400 font-medium">Production Archive</p>
                        </div>
                        
                        {/* Control Bar */}
                        <div className="flex gap-4 items-center">
                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                <button onClick={() => setHistoryMode('daily')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all ${historyMode === 'daily' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}>Daily</button>
                                <button onClick={() => setHistoryMode('shifts')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all ${historyMode === 'shifts' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}>Shifts</button>
                            </div>
                            
                            {/* ACTIVE DATE PICKER */}
                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                                <span className="text-[10px] font-bold text-slate-400">RANGE</span>
                                <input 
                                    type="date" 
                                    value={startDate} 
                                    onChange={(e) => setStartDate(e.target.value)} 
                                    className="bg-transparent text-xs font-bold text-slate-600 outline-none w-24 cursor-pointer" 
                                />
                                <span className="text-slate-300">-</span>
                                <input 
                                    type="date" 
                                    value={endDate} 
                                    onChange={(e) => setEndDate(e.target.value)} 
                                    className="bg-transparent text-xs font-bold text-slate-600 outline-none w-24 cursor-pointer" 
                                />
                                <button 
                                    onClick={handleHistorySearch}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold px-3 py-1 rounded ml-2 transition-colors"
                                >
                                    SEARCH
                                </button>
                            </div>
                        </div>
                    </div>

                    {renderHistoryTable()}
                </div>
            </div>
        </div>
    );
};

const RechartsPie = ({ label, valueString, type }) => {
    const val = parseFloat(valueString) || 0;
    const chartData = [{ name: 'Value', value: val }, { name: 'Remainder', value: 100 - val }];
    const activeColors = COLORS[type] || COLORS.avail;
    const textColor = type === 'avail' ? 'text-blue-600' : type === 'perf' ? 'text-emerald-600' : 'text-amber-600';
    return (
        <div className="flex flex-col items-center">
            <h4 className="text-sm font-bold text-slate-500 uppercase mb-4">{label}</h4>
            <div className="relative w-48 h-48 md:w-64 md:h-64">
                <ResponsiveContainer>
                    <PieChart>
                        <Pie data={chartData} innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" startAngle={90} endAngle={-270}>
                            {chartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={activeColors[index % activeColors.length]} />))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <div className={`absolute inset-0 flex items-center justify-center text-3xl font-black ${textColor}`}>{valueString || "0.00%"}</div>
            </div>
        </div>
    );
};

export default FetteOeeDashboard;