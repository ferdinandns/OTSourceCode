import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, AreaChart, Area } from 'recharts';

const LogInspector = () => {
  // --- 1. CONFIGURATION & DATA ---
   const categories = {
    "Line 1": [
      { name: 'PMA (L1) [Old]', table: 'cMT-FHDGEA1_EBR_PMA_data', db: 'db2', expectedRows: 1440 },
      { name: 'PMA (L1) [New]', table: 'cMT-FHDGEA1_EBR_PMA_new_data', db: 'db4', expectedRows: 1440 },
      { name: 'FBD (L1) [New]', table: 'cMT-FHDGEA1_EBR_FBD_new_data', db: 'db4', expectedRows: 1440 },
      { name: 'FBD (L1) [Old]', table: 'cMT-FHDGEA1_EBR_FBD_data', db: 'db4', expectedRows: 1440 },
      { name: 'FBD (L1)', table: 'cMT-FHDGEA1_EBR_FBD_new_data', db: 'db4', expectedRows: 1440 },
      { name: 'EPH (L1) [New]', table: 'cMT-FHDGEA1_EBR_EPH_new_data', db: 'db4', expectedRows: 1440 },
      { name: 'EPH (L1) [Old]', table: 'cMT-FHDGEA1_EBR_EPH_data', db: 'db2', expectedRows: 1440 },
      { name: 'Wetmill (L1) [New]', table: 'cMT-FHDGEA1_EBR_Wetmill_new_data', db: 'db4', expectedRows: 1440 },
      { name: 'Wetmill (L1) [Old]', table: 'cMT-FHDGEA1_EBR_Wetmill_data', db: 'db2', expectedRows: 1440 },
      { name: 'Mezanine_Coating', table: 'mezanine.tengah_Coating-FilteNEW_data', db: 'db3', expectedRows: 144 } 
    ],
    "Line 3": [
      { name: 'EBR_FBD_L3 [Old]', table: 'cMT-GEA-L3_Data_FBD_L3_data', db: 'db', expectedRows: 1440 },
      { name: 'EBR_FBD_L3 [New]', table: 'cMT-GEA-L3_Data_FBD_L3_data', db: 'db3', expectedRows: 1440 },
      { name: 'EBR_PMA_L3 [Old]', table: 'cMT-GEA-L3_EBR_PMA_L3_data', db: 'db', expectedRows: 1440 },
      { name: 'EBR_PMA_L3 [New]', table: 'cMT-GEA-L3_EBR_PMA_L3_data', db: 'db3', expectedRows: 1440 },      
      { name: 'EBR_EPH_L3 [Old]', table: 'cMT-GEA-L3_EBR_EPH_L3_data', db: 'db', expectedRows: 1440 },
      { name: 'EBR_EPH_L3 [New]', table: 'cMT-GEA-L3_EBR_EPH_L3_data', db: 'db3', expectedRows: 1440 },
      { name: 'EBR_WETMILL [Old]', table: 'cMT-GEA-L3_EBR_WETMILL_data', db: 'db', expectedRows: 1440 },
      { name: 'EBR_WETMILL [New]', table: 'cMT-GEA-L3_EBR_WETMILL_data', db: 'db3', expectedRows: 1440 },
      { name: 'Current_PMA_L3 [Old]', table: 'cMT-GEA-L3_Current_PMA_L3_data', db: 'db', expectedRows: 1440 },
      { name: 'Current_PMA_L3 [New]', table: 'cMT-GEA-L3_Current_PMA_L3_data', db: 'db3', expectedRows: 1440 },
      { name: 'Data_FBD_L3 [Old]', table: 'cMT-GEA-L3_Data_FBD_L3_data', db: 'db', expectedRows: 1440 },
      { name: 'Data_FBD_L3 [New]', table: 'cMT-GEA-L3_Data_FBD_L3_data', db: 'db3', expectedRows: 1440 },
      { name: 'PMA_KWmeter [Old]', table: 'cMT-GEA-L3_PMA_KWmeter_data', db: 'db', expectedRows: 1440 },
      { name: 'PMA_KWmeter [New]', table: 'cMT-GEA-L3_PMA_KWmeter_data', db: 'db3', expectedRows: 1440 },
      { name: 'PMA_RECIPE_FULL [Old]', table: 'cMT-GEA-L3_PMA_RECIPE_RECOR_data', db: 'db', expectedRows: 1440 },
      { name: 'PMA_RECIPE_FULL [New]', table: 'cMT-GEA-L3_PMA_RECIPE_RECOR_data', db: 'db3', expectedRows: 1440 }
    ],
    "NodeRed": [
      { name: 'NR_Coating', table: 'NodeRed_Coating', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_CoatingFilter', table: 'NodeRed_CoatingFilterNEW', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_EPH_L1', table: 'NodeRed_EPH_L1', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_EPH_L3', table: 'NodeRed_EPH_L3', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_EPH_L3_1', table: 'NodeRed_EPH_L3_1', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_EPH_Vakum_L1', table: 'NodeRed_EPH_Vakum_L1', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_FBD_L1', table: 'NodeRed_FBD_L1', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_FBD_L1_1', table: 'NodeRed_FBD_L1_1', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_FBD_L1_Filter', table: 'NodeRed_FBD_L1_FilterProduct', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_FBD_L3', table: 'NodeRed_FBD_L3', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_FBD_L3_1', table: 'NodeRed_FBD_L3_1', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_FBD_L3_2', table: 'NodeRed_FBD_L3_2', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_FBD_L3_Filter', table: 'NodeRed_FBD_L3_FilterProduct', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_FinalMix', table: 'NodeRed_FinalMix', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_GEA_FilterNew', table: 'NodeRed_GEA_FilterNew', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_PMA_KWmeter', table: 'NodeRed_PMA_KWmeter', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_PMA_L1', table: 'NodeRed_PMA_L1', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_PMA_L3', table: 'NodeRed_PMA_L3', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_PMA_L3_1', table: 'NodeRed_PMA_L3_1', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_PMA_L3_2', table: 'NodeRed_PMA_L3_2', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_PMA_L3_3', table: 'NodeRed_PMA_L3_3', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_PMA_L3_4', table: 'NodeRed_PMA_L3_4', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_TotalPD', table: 'NodeRed_TotalPD', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_Vibration_Fette', table: 'NodeRed_Vibration_Fette_L1', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_WETMILL_L3', table: 'NodeRed_WETMILL_L3', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_WETMILL_L3_1', table: 'NodeRed_WETMILL_L3_1', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_WH1_Monitoring', table: 'NodeRed_WH1_Monitoring', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_WH2_Monitoring', table: 'NodeRed_WH2_Monitoring', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_Wetmill_L1', table: 'NodeRed_Wetmill_L1', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_Wetmill_L1_1', table: 'NodeRed_Wetmill_L1_1', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_Time_EPH_L1', table: 'NodeRed_timeproses_EPH_L1', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_Time_FBD_L1', table: 'NodeRed_timeproses_FBD_L1', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_Time_Granulasi', table: 'NodeRed_timeproses_GRANULASI_L1', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_Time_PMA_L1', table: 'NodeRed_timeproses_PMA_L1', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_Time_Vacum_L1', table: 'NodeRed_timeproses_VACUM_L1', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_Time_Vacum_Open', table: 'NodeRed_timeproses_VACUM_OpenSystem', db: 'dbTest', expectedRows: 1440 },
      { name: 'NR_Time_Wetmill_L1', table: 'NodeRed_timeproses_WETMILL_L1', db: 'dbTest', expectedRows: 1440 }
      
       
    ],
    "Misc": [
      { name: 'CMT-MTC_Motor1.1_data', table: 'CMT-MTC_Motor1.1_data', db: 'db3', expectedRows: 1440 },
      { name: 'CMT-MTC_Motor1.2_data', table: 'CMT-MTC_Motor1.2_data', db: 'db3', expectedRows: 1440 }
    ]
  };

  // --- 2. STATE ---
  const [selectedId, setSelectedId] = useState('cMT-FHDGEA1_EBR_PMA_data');
  const [dates, setDates] = useState(''); 
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('ALL');
  const [firstDataDate, setFirstDataDate] = useState('...'); 
  const [lastDataDate, setLastDataDate] = useState('...');
  const [inspectedDate, setInspectedDate] = useState(null);
  
  const [table, dbName] = selectedId.split('|');
  const rowsPerPage = 20;

  const HourlyHeatmap = ({ table, dbName, date, columnName }) => {
  const [hourlyData, setHourlyData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  // 1. Guard: Only fetch if we have the minimum required info
  if (!date || !table) return;

  // 2. AbortController kills the "Pending" avalanche
  const controller = new AbortController();
  setLoading(true);

  fetch(`http://10.126.15.197:8002/part/getHourlyHeatmap?tableName=${table}&dbName=${dbName}&date=${date}&columnName=${columnName}`, {
    signal: controller.signal
  })
    .then(res => res.json())
    .then(data => {
      // 3. ONLY update the local heatmap state. 
      // Do NOT call setLogs or setPage here!
      setHourlyData(data);
      setLoading(false);
    })
    .catch(err => {
      if (err.name !== 'AbortError') {
        console.error("Heatmap Fetch error:", err);
        setLoading(false);
      }
    });

  // 4. Cleanup function: Cancels the fetch if you click a different date
  return () => controller.abort();

  // IMPORTANT: Only watch the specific date and table being inspected
}, [date, table, dbName, columnName]);

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

  // --- 3. HELPERS (Defined before use to avoid ESLint errors) ---
  const getTableDetails = (tableName, requestedDb) => {
    let expectedRows = 1440;
    for (const group of Object.values(categories)) {
      const found = group.find(t => t.table === tableName && t.db === requestedDb);
      if (found) {
        expectedRows = found.expectedRows || 1440;
        break;
      }
    }
    const columnName = tableName.startsWith('NodeRed') ? 'timestamp' : 'time@timestamp';
    return { expectedRows, columnName };
  };

  const formatDate = (dateStr) => {
  if (!dateStr) return '';
  // This constructor automatically adds the +7 hours for WIB
  const date = new Date(dateStr); 
  // 'sv-SE' ensures it outputs exactly YYYY-MM-DD for your HTML inputs
  return date.toLocaleDateString('sv-SE'); 
};

  const getStatusStyle = (status) => {
    switch(status) {
      case 'OK': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'NO DATA': return 'bg-slate-100 text-slate-500 border-slate-200';
      default: return 'bg-rose-100 text-rose-700 border-rose-200'; // GAP FOUND
    }
  };

 const chartData = useMemo(() => {
    return [...logs]
      .sort((a, b) => new Date(a.check_date) - new Date(b.check_date))
      .map(log => ({
        date: formatDate(log.check_date),
        rows: log.actual_rows,
        benchmark: log.expected_rows || getTableDetails(table, dbName).expectedRows
      }));
  }, [logs, selectedId]);
  

  // --- 4. ACTIONS ---
  const exportToExcel = () => {
    const { expectedRows } = getTableDetails(table, dbName);
    const worksheetData = logs.filter(l => filter === 'ALL' || l.status === filter).map(log => ({
      "Check Date": formatDate(log.check_date),
      "Actual Rows": log.actual_rows,
      "Expected Rows": log.expected_rows || expectedRows,
      "Integrity %": `${log.integrity_percent}%`,
      "Status": log.status
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Integrity Report");
    
    // Auto-size columns roughly
    worksheet["!cols"] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    XLSX.writeFile(workbook, `Integrity_Report_${table}_${dates.start}.xlsx`);
  };

  // --- 5. DATA FETCHING ---
  useEffect(() => {
  const { expectedRows, columnName } = getTableDetails(table, dbName);
  
  fetch(`http://10.126.15.197:8002/part/getDataIntegritySummary?tableName=${table}&dbName=${dbName}&columnName=${columnName}&startDate=${dates.start}&endDate=${dates.end}&expectedRows=${expectedRows}`)
    .then(res => res.json())
    .then(data => {
      // PRE-FORMATTING: Convert ISO (17:00Z) to YYYY-MM-DD for the state
      if (data.first_date) {
        const cleanStart = new Date(data.first_date).toLocaleDateString('sv-SE');
        setFirstDataDate(cleanStart);
      }
      if (data.last_date) {
        const cleanEnd = new Date(data.last_date).toLocaleDateString('sv-SE');
        setLastDataDate(cleanEnd);
      }
      
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    });
}, [selectedId, dates.start, dates.end]);

  // --- 6. LOGIC ---
  const stats = useMemo(() => {
  return logs.reduce((acc, log) => {
    // 1. Existing Status Counts
    if (log.status === 'OK') acc.ok++;
    else if (log.status === 'GAP FOUND') acc.gap++;
    else if (log.status === 'NO DATA') acc.noData++;

    // 2. NEW: Accumulate Minutes Loss
    // If actual is 1400 and expected is 1440, loss is 40.
    const expected = log.expected_rows || getTableDetails(table, dbName).expectedRows;
    const actual = log.actual_rows || 0;
    const loss = Math.max(0, expected - actual); // Ensure we don't count "extra" rows as negative loss
    
    acc.totalMinutesLoss += loss;
    return acc;
  }, { total: logs.length, ok: 0, gap: 0, noData: 0, totalMinutesLoss: 0 });
}, [logs, table, dbName]);

  const filteredLogs = useMemo(() => logs.filter(log => filter === 'ALL' || log.status === filter), [logs, filter]);
  const paginatedLogs = useMemo(() => filteredLogs.slice((page - 1) * rowsPerPage, page * rowsPerPage), [filteredLogs, page]);
  const totalPages = Math.ceil(filteredLogs.length / rowsPerPage) || 1;

  return (
    <div className="p-8 bg-slate-50 min-h-screen text-slate-800 font-sans selection:bg-blue-100">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Table Integrity Logs</h2>
          <p className="text-slate-500 text-sm mt-1 font-medium">Monitoring Data Integrity</p>
        </div>
        <button 
          onClick={exportToExcel}
          className="flex items-center gap-2 bg-[#1D6F42] hover:bg-[#155231] text-white px-5 py-2.5 rounded-lg font-bold shadow-md transition-all active:scale-95"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          Export Excel
        </button>
      </div>
      
      {/* Filters Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="flex flex-col">
          <label className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">Target Machine</label>
          <select 
            className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition" 
            value={selectedId} 
            onChange={(e) => { setSelectedId(e.target.value); setPage(1); }}
          >
            {Object.entries(categories).map(([cat, tables]) => (
              <optgroup label={cat} key={cat}>
                {tables.map(t => <option key={`${t.table}|${t.db}`} value={`${t.table}|${t.db}`}>{t.name}</option>)}
              </optgroup>
            ))}
          </select>
          <div className="mt-2 text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded inline-block w-fit">
            AVAILABLE: {formatDate(firstDataDate)} — {formatDate(lastDataDate)}
          </div>
        </div>

        <div className="flex flex-col">
  <label className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">Start Date</label>
  <input 
    type="date" 
    value={dates.start} 
    className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-sm" 
    onChange={(e) => setDates(prev => ({...prev, start: e.target.value}))} 
  />
  <button 
    type="button"
    onClick={() => setDates(prev => ({ ...prev, start: firstDataDate }))} 
    className="text-[10px] text-blue-500 font-bold mt-2 hover:text-blue-700 transition text-left ml-1"
  >
    Set to {firstDataDate}
  </button>
</div>

        <div className="flex flex-col">
          <label className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">End Date</label>
          <input type="date" value={dates.end} className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-sm" onChange={(e) => setDates({...dates, end: e.target.value})} />
          <button onClick={() => setDates(prev => ({ ...prev, end: lastDataDate }))} className="text-[10px] text-blue-500 font-bold mt-2 hover:text-blue-700 transition text-left ml-1">Set to {lastDataDate}</button>
        </div>
      </div>

      {/* Stats and Filter Buttons Row */}
      <div className="flex flex-col xl:flex-row gap-6 mb-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-grow">
          {[
            { label: 'Total Logs', value: stats.total, color: 'slate' },
            { label: 'Healthy (OK)', value: stats.ok, color: 'emerald' },
            { label: 'Gaps Found', value: stats.gap, color: 'rose' },
            { label: 'Missing Data', value: stats.noData, color: 'slate' }
          ].map((s, i) => (
            <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">{s.label}</span>
              <span className={`text-2xl font-black text-${s.color}-600`}>{s.value}</span>
            </div>
          ))}
        </div>

        <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 shadow-sm flex flex-col items-center">
    <span className="text-[10px] font-black text-orange-400 uppercase tracking-tighter mb-1">
      Minutes Lost
    </span>
    <span className="text-2xl font-black text-orange-600">
      {stats.totalMinutesLoss.toLocaleString()}
    </span>
    <span className="text-[9px] text-orange-400 font-bold">Total Accumulated</span>
  </div>

        <div className="flex bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
          {['ALL', 'OK', 'GAP FOUND', 'NO DATA'].map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${filter === f ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      
      
      

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl mb-8">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Row Quantity Trend (Daily)</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorRows" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{fontSize: 10, fill: '#94a3b8'}} 
                minTickGap={30}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{fontSize: 10, fill: '#94a3b8'}}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                itemStyle={{ fontWeight: 'bold' }}
              />
              {/* The Benchmark Line */}
              <ReferenceLine y={getTableDetails(table, dbName).expectedRows} label={{ position: 'right', value: 'Benchmark', fill: '#94a3b8', fontSize: 10 }} stroke="#94a3b8" strokeDasharray="3 3" />
              
              <Area 
                type="monotone" 
                dataKey="rows" 
                stroke="#3b82f6" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorRows)" 
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden mb-6">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-100">
              <th className="p-5">Check Date</th>
              <th className="p-5 text-center">Actual Rows</th>
              <th className="p-5 text-center">Benchmark</th>
              <th className="p-5 text-center">Health %</th>
              <th className="p-5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {paginatedLogs.map((log, i) => (
              <tr key={i} className="hover:bg-slate-50/50 transition-colors group" onClick={() => setInspectedDate(formatDate(log.check_date))}>
                <td className="p-5 font-bold text-slate-900">{formatDate(log.check_date)}</td>
                <td className="p-5 text-center font-medium text-slate-500">{log.actual_rows?.toLocaleString() || '0'}</td>
                <td className="p-5 text-center font-medium text-slate-300">{log.expected_rows || getTableDetails(table, dbName).expectedRows}</td>
                <td className={`p-5 text-center font-black ${log.integrity_percent < 100 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {log.integrity_percent}%
                </td>
                <td className="p-5 text-center">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${getStatusStyle(log.status)}`}>
                    {log.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

       {inspectedDate && (
  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl mb-8 transition-all animate-in fade-in slide-in-from-top-4 duration-500">
    <HourlyHeatmap 
      table={table} 
      dbName={dbName} 
      date={inspectedDate} 
      columnName={getTableDetails(table, dbName).columnName} 
    />
  </div>
)}

      {/* Pagination */}
      <div className="flex justify-between items-center py-4 px-2">
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Page {page} of {totalPages}</p>
        <div className="flex gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogInspector;