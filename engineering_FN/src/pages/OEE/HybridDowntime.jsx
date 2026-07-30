import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import ShiftStatsDisplay from './DowntimeDisplay';
import AuditNavigator from './AuditNavigator';


// --- CONFIG ---
const SHIFT_SCHEDULE = {
    "Shift 1": { start: "06:30", end: "15:00" },
    "Shift 2": { start: "15:00", end: "22:45" },
    "Shift 3": { start: "22:45", end: "06:30" }
};

// --- HELPERS ---
const getMinutesFromStart = (time, shiftStart) => {
    if (!time || !shiftStart) return 0;
    const t = new Date(`2000-01-01T${time}`);
    const start = new Date(`2000-01-01T${shiftStart}`);
    if (start.getHours() > 20 && t.getHours() < 12) t.setDate(t.getDate() + 1);
    return (t - start) / 60000;
};

const addMinutes = (timeStr, mins) => {
    if (!timeStr) return '';
    const date = new Date(`2000-01-01T${timeStr}`);
    date.setMinutes(date.getMinutes() + parseFloat(mins));
    return date.toTimeString().slice(0, 5);
};

const getDiffMinutes = (start, end) => {
    if (!start || !end) return 0;
    let d1 = new Date(`2000-01-01T${start}`);
    let d2 = new Date(`2000-01-01T${end}`);
    if (d2 < d1) d2.setDate(d2.getDate() + 1);
    return Math.max(0, (d2 - d1) / 60000);
};

const formatTimeOnly = (isoString) => {
    if (!isoString) return '--:--';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
};



// --- BUDGET BAR ---
const BudgetBar = ({ title, used, limit, barColor, type }) => {
    const safeLimit = limit || 1; 
    const percentage = Math.min((used / safeLimit) * 100, 100); 
    const isOverBudget = used > safeLimit;
    const bgStyle = type === 'Unplanned' ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100';

    return (
      <div className={`p-4 rounded-lg border ${bgStyle}`}>
        <div className="flex justify-between text-sm font-bold text-gray-700 mb-2">
          <span>{title}</span>
          <span className={`${isOverBudget ? 'text-red-600 font-extrabold' : 'text-gray-600'}`}>
            {Math.round(used)} / {limit} mins
          </span>
        </div>
        <div className="w-full bg-white rounded-full h-4 overflow-hidden border border-gray-200 relative">
          <div className={`h-full transition-all duration-500 ${isOverBudget ? 'bg-red-600' : barColor}`} style={{ width: `${percentage}%` }}></div>
        </div>
        <div className="mt-2 text-[10px] font-bold uppercase flex justify-between">
           <span className="text-gray-400">Utilization</span>
           <span className={isOverBudget ? "text-red-600 animate-pulse" : "text-gray-400"}>
              {isOverBudget ? `⛔ EXCEEDED BY ${Math.round(used - safeLimit)}m` : `${Math.round(safeLimit - used)}m Remaining`}
           </span>
        </div>
      </div>
    );
};

// --- MAIN COMPONENT ---
const HybridDowntimeManager = () => {
  const [selectedDate, setSelectedDate] = useState("2026-01-21");
  const [selectedShift, setSelectedShift] = useState("Shift 1");
  const startTime = SHIFT_SCHEDULE[selectedShift].start;
  const endTime = SHIFT_SCHEDULE[selectedShift].end;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState(null); 

  const [machineEvents, setMachineEvents] = useState([]); // Operator Labeled Data (For Comparison)
  const [plcEvents, setPlcEvents] = useState([]);         // Raw PLC Data (For Bottom List) [FIXED]
  const [userEntries, setUserEntries] = useState([]);  
  const [budgetLimits, setBudgetLimits] = useState({ unplanned: 124, planned: 110, total_downtime: 0 }); 
  const [reasonOptions, setReasonOptions] = useState({ Unplanned: [], Planned: [] });
  const [activeShiftId, setActiveShiftId] = useState(null);

  const [machineMeta, setMachineMeta] = useState({ 
        operators: 'Fetching...', 
        batches: [], 
        isLoading: false 
    });


  // Load Reasons
  useEffect(() => {
    const fetchReasons = async () => {
        try {
            const res = await axios.get("http://10.126.15.197:8002/part/getDowntimeReasons");
            setReasonOptions({
                Unplanned: res.data.filter(r => r.default_category === 'Unplanned'),
                Planned: res.data.filter(r => r.default_category === 'Planned')
            });
        } catch (err) { console.error("Reasons Error", err); }
        
    };
    fetchReasons();
  }, []);

  // Fetch Data on Change
  useEffect(() => { fetchHybridData(); }, [selectedDate, selectedShift]); 

  const fetchHybridData = async () => {
      setLoading(true);
      
      let startIso = `${selectedDate} ${startTime}:00`;
      let endIso = `${selectedDate} ${endTime}:00`;
      
      // Shift 3 Logic
      if (selectedShift === "Shift 3") {
          const nextDay = new Date(selectedDate);
          nextDay.setDate(nextDay.getDate() + 1);
          endIso = `${nextDay.toISOString().split('T')[0]} ${endTime}:00`;
      }

      try {
    setLoading(true);

    // CALL 5 APIs IN PARALLEL (Added Machine Metadata)
    const [plcRes, operatorRes, supervisorRes, shiftIdRes, metaRes] = await Promise.all([
        // 1. RAW PLC
        axios.get(`http://10.126.15.197:8002/part/getDowntimeByUnix`, { params: { start_date: startIso, end_date: endIso } }),
        
        // 2. OPERATOR LABELED
        axios.get(`http://10.126.15.197:8002/part/getStoredShiftEvents`, { params: { start_date: startIso, end_date: endIso } }),
        
        // 3. SUPERVISOR SAVED
        axios.get(`http://10.126.15.197:8002/part/getStoredDowntime`, { params: { start_date: startIso, end_date: endIso } }),
        
        // 4. GET MASTER SHIFT ID
        axios.get('http://10.126.15.197:8002/part/getShiftId', { params: { date: selectedDate, shift: selectedShift } }),

        // 5. NEW: MACHINE METADATA (Operators & Batches)
        axios.get('http://localhost:8002/part/getShiftMetadata', { 
            params: { date: selectedDate, startTime: startTime, endTime: endTime } 
        })
    ]);

    // --- 0. SAVE THE SHIFT ID ---
    setActiveShiftId(shiftIdRes.data.shift_id); 

    // --- 1. NEW: SAVE MACHINE CONTEXT ---
    setMachineMeta({
        operators: metaRes.data.operators || "None Found",
        batches: metaRes.data.batches || [],
        isLoading: false
    });

    // --- 2. PLC DATA ---
    setPlcEvents(plcRes.data.events || []);
    const budgetData = plcRes.data.budget || {};
    setBudgetLimits({
        total_downtime: parseFloat(budgetData.total_downtime || 0), 
        planned: parseFloat(budgetData.planned_limit || 0),         
        unplanned: parseFloat(budgetData.unplanned_limit || 0)      
    });

    // --- 3. OPERATOR DATA ---
    setMachineEvents(operatorRes.data.events || []);

    // --- 4. SUPERVISOR DATA ---
    const spvData = supervisorRes.data;
    const { events, is_submitted, last_updated_by, last_updated_at } = spvData;

    if (is_submitted && events.length > 0) {
        setSubmissionStatus({
            user: last_updated_by || "Unknown",
            time: last_updated_at ? new Date(last_updated_at).toLocaleString('en-GB') : "Unknown Date"
        });
        const formatted = events.map(e => ({
            id: e.id,
            startTime: new Date(e.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            endTime: new Date(e.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            duration: parseFloat(e.duration_minutes),
            reason: e.reason_name || '',
            category: e.category || 'Unplanned'
        }));
        setUserEntries(formatted);
    } else {
        setSubmissionStatus(null); 
        setUserEntries([{ id: Date.now(), startTime: startTime, endTime: '', duration: 0, reason: '', category: 'Unplanned' }]);
    }

} catch (err) {
    console.error("Fetch error:", err);
    setMachineMeta({ operators: 'Sync Error', batches: [], isLoading: false });
} finally {
    setLoading(false);
}
  };

  // 1. Keep your navigateDay exactly as it is. It only updates the state.
const navigateDay = (amount) => {
  const [year, month, day] = selectedDate.split('-').map(Number);
  const current = new Date(year, month - 1, day);
  current.setDate(current.getDate() + amount);
  
  const y = current.getFullYear();
  const m = String(current.getMonth() + 1).padStart(2, '0');
  const d = String(current.getDate()).padStart(2, '0');
  
  setSelectedDate(`${y}-${m}-${d}`); // This triggers the useEffect below
};

// 2. Ensure you have this useEffect to handle the actual data fetching
useEffect(() => {
  fetchHybridData();
}, [selectedDate, selectedShift]); // Watches for both day and shift changes

  const handleSaveReport = async () => {
    setSaving(true);
    
    // Calculate Timestamps
    let startIso = `${selectedDate} ${startTime}:00`;
    let endIso = `${selectedDate} ${endTime}:00`;
    if (selectedShift === "Shift 3") {
        const nextDay = new Date(selectedDate);
        nextDay.setDate(nextDay.getDate() + 1);
        endIso = `${nextDay.toISOString().split('T')[0]} ${endTime}:00`;
    }

    try {
        // Filter out empty rows before sending
        const payload = userEntries
            .filter(e => e.duration > 0 && e.reason)
            .map(e => ({
                start_time: `${selectedDate} ${e.startTime}:00`, 
                end_time: `${selectedDate} ${e.endTime}:00`,
                duration_minutes: e.duration,
                category: e.category,
                reason_name: e.reason,
                reason_id: reasonOptions[e.category]?.find(r => r.name === e.reason)?.id || null
            }));

        // --- THE FIX ---
        // We now send 'shift' (string) instead of 'shift_id' (int)
        // The backend will use this string + date to find the ID (539)
        await axios.post(`http://10.126.15.197:8002/part/storeDowntimeEvents`, { 
            shift: selectedShift, // Send "Shift 1"
            date: selectedDate,   // Send "2026-01-21"
            events: payload,
            start_range: startIso,
            end_range: endIso
        });

        alert("✅ Report Submitted Successfully!");
        fetchHybridData(); // Refresh the view to see the "Saved" status
    } catch (err) {
        console.error("Save Error:", err);
        alert("Failed to save report: " + (err.response?.data?.error || err.message));
    } finally {
        setSaving(false);
    }
  };

  // --- MERGE & COMPARE LOGIC ---
  // --- STATS DISPLAY LOGIC (Frequency-Aware) ---
  const statsDisplayEvents = useMemo(() => {
      
      // 1. Map Operator Events (Baseline)
      // We store an array of durations for each reason to handle duplicates
      const machineMap = {};
      machineEvents.forEach(e => {
          const key = e.reason_name || "Undefined";
          if (!machineMap[key]) machineMap[key] = [];
          machineMap[key].push(parseFloat(e.duration_minutes || 0));
      });

      // 2. Track usage to know which Operator events are "taken"
      const machineUsage = {}; // counts how many times we matched a reason
      const finalDisplayList = [];  

      // --- A. PROCESS USER ENTRIES (Your Input) ---
      userEntries.forEach(e => {
          if (!e.reason || !e.duration) return;

          const key = e.reason;
          const userDur = parseFloat(e.duration);
          
          // Check if this reason exists in machine logs
          const availableDurations = machineMap[key] || [];
          const usedCount = machineUsage[key] || 0;

          let status = 'new';
          
          // If the operator has this reason, and we haven't "used up" all occurrences
          if (usedCount < availableDurations.length) {
              // Get the specific duration for this occurrence (e.g. the 1st, 2nd, etc.)
              const baselineDur = availableDurations[usedCount];
              const diff = Math.abs(baselineDur - userDur);
              
              status = diff <= 1 ? 'match' : 'diff';
              
              // Mark one occurrence as used
              machineUsage[key] = usedCount + 1; 
          }

          finalDisplayList.push({
              category: e.category,
              reason_name: key,
              duration_minutes: userDur,
              compareStatus: status,
              isUserEntry: true
          });
      });

      // --- B. PROCESS REMAINING MACHINE ENTRIES (Pending) ---
      Object.keys(machineMap).forEach(key => {
          const totalOccurrences = machineMap[key].length;
          const usedCount = machineUsage[key] || 0;

          // If operator has 2 "Ganti Matcon" and you only entered 1, 
          // this loop runs for the 2nd one.
          if (usedCount < totalOccurrences) {
              // Add ALL remaining occurrences individually
              for (let i = usedCount; i < totalOccurrences; i++) {
                  finalDisplayList.push({
                      category: 'Unplanned', // or lookup from machineEvents if possible
                      reason_name: key,
                      duration_minutes: machineMap[key][i],
                      compareStatus: 'pending',
                      isUserEntry: false
                  });
              }
          }
      });

      return finalDisplayList;

  }, [userEntries, machineEvents]);

  // --- BUDGET STATS ---
  const budgetStats = useMemo(() => {
    const userTotals = userEntries.reduce((acc, entry) => {
      const dur = parseFloat(entry.duration) || 0;
      if (entry.category === 'Planned') acc.planned += dur;
      if (entry.category === 'Unplanned') acc.unplanned += dur;
      return acc;
    }, { planned: 0, unplanned: 0 });

    const totalMachineDuration = budgetLimits.total_downtime || 0;
    const totalSpent = userTotals.planned + userTotals.unplanned;
    const unassigned = Math.max(0, totalMachineDuration - totalSpent);

    return {
      unplannedSpent: userTotals.unplanned,
      plannedSpent: userTotals.planned,
      unassigned,
      totalMachineDuration,
      unassignedPercent: (unassigned / (totalMachineDuration || 1)) * 100,
      isOverBudget: (userTotals.planned > budgetLimits.planned) || (userTotals.unplanned > budgetLimits.unplanned)
    };
  }, [userEntries, budgetLimits]);

  const canSubmit = useMemo(() => {
      if (budgetStats.isOverBudget) return false;
      if (Math.round(budgetStats.unassigned) > 0) return false;
      // Allow submit if at least one row is valid
      const hasValidRow = userEntries.some(e => e.duration > 0 && e.reason);
      return hasValidRow; 
  }, [budgetStats, userEntries]);

  // --- UI HANDLERS ---
  const checkShiftBoundary = (timeStr) => {
      if (!timeStr) return false;
      const mins = getMinutesFromStart(timeStr, startTime);
      const shiftLength = getMinutesFromStart(endTime, startTime);
      return mins >= 0 && mins <= shiftLength;
  };

  const handleTimeChange = (id, field, value) => {
    setUserEntries(prev => prev.map(entry => {
        if (entry.id !== id) return entry;
        if (field === 'startTime' && !checkShiftBoundary(value)) {
            alert(`Start time must be within shift (${startTime} - ${endTime})`);
            return entry; 
        }
        let updated = { ...entry, [field]: value };
        if (updated.startTime && updated.endTime) updated.duration = getDiffMinutes(updated.startTime, updated.endTime);
        return updated;
    }));
  };

  const handleDurationChange = (id, newDuration) => {
    const dur = parseFloat(newDuration);
    if (dur < 0) return;
    setUserEntries(prev => prev.map(entry => {
        if (entry.id !== id) return entry;
        let validDuration = dur;
        if (entry.startTime) {
            const currentMins = getMinutesFromStart(entry.startTime, startTime);
            const totalShiftMins = getMinutesFromStart(endTime, startTime);
            const maxDuration = totalShiftMins - currentMins;
            if (dur > maxDuration) validDuration = maxDuration;
        }
        const updated = { ...entry, duration: validDuration };
        if (updated.startTime) updated.endTime = addMinutes(updated.startTime, validDuration);
        return updated;
    }));
  };

  const updateField = (id, field, value) => {
      setUserEntries(prev => prev.map(e => {
        if (e.id !== id) return e;
        if (field === 'category') return { ...e, [field]: value, reason: '' };
        return { ...e, [field]: value };
      }));
  };

  const addNewRow = () => {
      const lastEntry = userEntries[userEntries.length - 1];
      const nextStart = lastEntry && lastEntry.endTime ? lastEntry.endTime : startTime;
      if (!checkShiftBoundary(nextStart) || nextStart === endTime) { alert("End of shift reached."); return; }
      setUserEntries([...userEntries, { id: Date.now(), startTime: nextStart, endTime: '', duration: 0, reason: '', category: 'Unplanned' }]);
  };


/* --- HybridDowntime.jsx --- */

return (
  <div className="flex flex-col gap-6 p-6 bg-gray-50 min-h-screen font-sans">
    {/* HEADER: Restored to original non-sticky block */}
    <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-800">Fette Downtime Manager</h1>
            
            {/* TIMES BUBBLE */}
            <div className="bg-blue-50 text-blue-800 text-xs font-bold px-3 py-1 rounded border border-blue-200">
                {startTime} - {endTime}
            </div>
            
            {/* STATUS BADGE */}
            {submissionStatus ? (
                <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded border border-green-200 text-xs font-bold animate-in fade-in">
                    <span>✅ Report Submitted</span>
                    <span className="font-normal text-green-600 italic">by {submissionStatus.user} at {submissionStatus.time}</span>
                </div>
            ) : (
                <div className="px-3 py-1 bg-gray-100 text-gray-500 rounded border border-gray-200 text-xs font-bold">
                    ⚪ Pending Submission
                </div>
            )}
        </div>

        <div className="flex items-center gap-2 mt-0.5">
    <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest">
      {/* FIX: Change metaData.operators to machineMeta.operators */}
      Operator: <span className="text-blue-600">{machineMeta.operators || '---'}</span>
    </span>
    <span className="text-[12px] text-slate-300">|</span>
    <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest">
      {/* FIX: Change metaData.batches to machineMeta.batches */}
      Batch: <span className="text-emerald-600">
  {machineMeta.batches && machineMeta.batches.length > 0 
    ? machineMeta.batches.map(b => b.replace(/[^a-zA-Z0-9]/g, "")).join(", ")
    : '---'}
</span>
    </span>
  </div>

        <div className="flex items-center gap-2">
           {/* REFINED NAVIGATOR: Integrated into original control group */}
           <div className="flex items-center bg-gray-50 p-1 rounded border border-gray-200">
              <button 
                onClick={() => navigateDay(-1)}
                className="w-8 h-8 flex items-center justify-center bg-white border rounded shadow-sm hover:bg-gray-50 active:scale-90 transition-all text-blue-600 text-xs"
              >
                ◀
              </button>
              
              <input 
                type="date" 
                value={selectedDate} 
                onChange={e => setSelectedDate(e.target.value)} 
                className="bg-transparent px-3 text-sm font-bold text-gray-700 outline-none cursor-pointer" 
              />
              
              <button 
                onClick={() => navigateDay(1)}
                className="w-8 h-8 flex items-center justify-center bg-white border rounded shadow-sm hover:bg-gray-50 active:scale-90 transition-all text-blue-600 text-xs"
              >
                ▶
              </button>
           </div>

           <select 
             value={selectedShift} 
             onChange={(e) => setSelectedShift(e.target.value)} 
             className="border rounded px-3 py-2 text-sm font-bold bg-white outline-none focus:ring-2 ring-blue-500 cursor-pointer"
           >
               {Object.keys(SHIFT_SCHEDULE).map(s => <option key={s} value={s}>{s}</option>)}
           </select>
        </div>
    </div>


      {loading ? <div className="text-center py-20 text-gray-500">Loading Data...</div> : (
      <>
        {/* BUDGET SUMMARY */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 sticky top-0 z-20">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-gray-800">Shift Downtime Summary</h2>
                <div className="bg-gray-100 px-3 py-1 rounded text-right">
                    <div className="text-[10px] font-bold text-gray-400 uppercase">TOTAL DOWNTIME (PLC)</div>
                    <div className="text-xl font-extrabold text-blue-900">{Math.round(budgetStats.totalMachineDuration)} m</div>
                </div>
            </div>

            {/* Unassigned Bar */}
            <div className="mb-6 bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <div className="flex justify-between text-sm font-bold text-yellow-800 mb-2">
                    <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${budgetStats.unassigned > 0 ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></span>
                        <span>{budgetStats.unassigned > 0 ? "Unassigned Stoptime (Pending Action)" : "All Time Accounted For"}</span>
                    </div>
                    <span>{Math.round(budgetStats.unassigned)} m</span>
                </div>
                <div className="w-full bg-white h-5 rounded-full overflow-hidden border border-yellow-100">
                    <div className={`h-full transition-all duration-500 ${budgetStats.unassigned === 0 ? 'bg-green-500' : 'bg-yellow-400'}`} style={{width: `${budgetStats.unassignedPercent}%`}}></div>
                </div>
                <p className="text-[10px] text-yellow-600 mt-1 italic">* This bar decreases as you assign categories below.</p>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <BudgetBar title="Confirmed Unplanned Loss" used={budgetStats.unplannedSpent} limit={budgetLimits.unplanned} type="Unplanned" barColor="bg-red-500" />
                <BudgetBar title="Confirmed Planned Budget" used={budgetStats.plannedSpent} limit={budgetLimits.planned} type="Planned" barColor="bg-blue-500" />
            </div>
        </div>

        <div className="flex flex-col xl:flex-row gap-6">
            <div className="xl:w-5/12 space-y-6">
                {/* PASSING MERGED EVENTS TO DISPLAY */}
                <ShiftStatsDisplay events={statsDisplayEvents} />
                
                {/* [FIXED] ORIGINAL MACHINE TIMESTAMPS: Now uses plcEvents (Raw Data) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[400px]">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 rounded-t-xl">
                        <h4 className="text-sm font-bold text-gray-700">Actual Machine Stoptime</h4>
                    </div>
                    <div className="overflow-y-auto flex-1 custom-scrollbar">
                        {plcEvents.map((ev, i) => (
                            <div key={i} className="flex justify-between px-4 py-3 border-b border-gray-50 text-xs">
                                <span className="font-mono text-gray-500">
                                    {formatTimeOnly(ev.start_time)} - {formatTimeOnly(ev.finish_time || ev.end_time)}
                                </span>
                                <span className="font-bold text-gray-800">{Math.round(ev.duration_minutes)}m</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="xl:w-7/12 flex flex-col">
    {/* CONTAINER: Polished industrial aesthetic */}
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-6">
            <div className="flex flex-col">
                <h2 className="text-xl font-black text-slate-800 tracking-tight">Accounting Canvas</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Shift Data Verification</p>
            </div>
            <button 
                onClick={addNewRow} 
                className="bg-slate-900 text-white px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider shadow-lg hover:bg-black transition-all active:scale-95"
            >
                + New Entry
            </button>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <th className="pb-4 pl-2 w-24">Start</th>
                        <th className="pb-4 w-24 text-center">Dur (m)</th>
                        <th className="pb-4 w-24">End</th>
                        <th className="pb-4 w-36">Category</th>
                        <th className="pb-4 px-2">Description / Reason</th>
                        <th className="pb-4 w-10"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {userEntries.map((entry) => (
                        <tr key={entry.id} className="group hover:bg-slate-50/50 transition-colors">
                            {/* START TIME */}
                            <td className="py-4 pl-2">
                                <input 
                                    type="time" 
                                    value={entry.startTime} 
                                    onChange={(e) => handleTimeChange(entry.id, 'startTime', e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 ring-blue-500/20 focus:border-blue-500 transition-all" 
                                />
                            </td>

                            {/* DURATION */}
                            <td className="py-4 px-2">
                                <input 
                                    type="number" 
                                    value={entry.duration} 
                                    onChange={(e) => handleDurationChange(entry.id, e.target.value)} 
                                    className="w-full bg-white border border-blue-100 shadow-sm rounded-xl p-2.5 text-base font-black text-blue-900 text-center outline-none focus:ring-2 ring-blue-500/20 focus:border-blue-500" 
                                />
                            </td>

                            {/* END TIME */}
                            <td className="py-4 pr-2">
                                <input 
                                    type="time" 
                                    value={entry.endTime} 
                                    disabled 
                                    className="w-full bg-slate-100/50 border border-transparent rounded-xl p-2.5 text-sm font-bold text-slate-400" 
                                />
                            </td>

                            {/* CATEGORY: Increased to text-xs for better readability */}
                            <td className="py-4 pr-2">
                                <select 
                                    value={entry.category} 
                                    onChange={(e) => updateField(entry.id, 'category', e.target.value)} 
                                    className={`text-xs font-black uppercase tracking-tight p-2.5 rounded-xl border w-full appearance-none cursor-pointer transition-all ${
                                        entry.category === 'Unplanned' 
                                            ? 'text-red-600 bg-red-50 border-red-100' 
                                            : 'text-blue-600 bg-blue-50 border-blue-100'
                                    }`}
                                >
                                    <option value="Unplanned">Unplanned</option>
                                    <option value="Planned">Planned</option>
                                </select>
                            </td>

                            {/* REASON: Increased to text-sm and added more padding */}
                            <td className="py-4 px-2">
                                <select 
                                    value={entry.reason} 
                                    onChange={(e) => updateField(entry.id, 'reason', e.target.value)} 
                                    className={`w-full rounded-xl border p-2.5 text-sm font-bold outline-none transition-all appearance-none cursor-pointer ${
                                        !entry.reason 
                                            ? 'border-red-200 bg-red-50/50 text-red-400' 
                                            : 'border-slate-200 bg-white text-slate-700 focus:border-blue-500 focus:ring-2 ring-blue-500/20'
                                    }`}
                                >
                                    <option value="">-- Select Reason --</option>
                                    {reasonOptions[entry.category]?.map((r) => (
                                        <option key={r.id} value={r.name} className="text-sm py-2">{r.name}</option>
                                    ))}
                                </select>
                            </td>

                            <td className="py-4 text-right">
                                <button 
                                    onClick={() => setUserEntries(userEntries.filter(e => e.id !== entry.id))} 
                                    className="text-slate-300 hover:text-red-500 p-2 transition-colors"
                                >
                                    ✕
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {/* FOOTER */}
        <div className="mt-auto pt-6 border-t border-slate-100 flex justify-between items-center">
             <div className="flex flex-col gap-1">
                 <div className="flex items-center gap-2">
                     <div className={`w-2.5 h-2.5 rounded-full ${canSubmit ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
                     <span className={`text-[11px] font-black uppercase tracking-widest ${canSubmit ? "text-green-600" : "text-red-500"}`}>
                        {budgetStats.isOverBudget 
                            ? "Budget Exceeded" 
                            : Math.round(budgetStats.unassigned) > 0 
                                ? `${Math.round(budgetStats.unassigned)}m Unassigned` 
                                : "Shift Balanced"}
                     </span>
                 </div>
                 {!canSubmit && <span className="text-[10px] font-bold text-slate-400 italic">*Missing reasons or timing errors.</span>}
             </div>
             
             <button 
                onClick={handleSaveReport} 
                disabled={saving || !canSubmit}
                className={`px-10 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-white shadow-lg transition-all active:scale-95 ${
                    saving || !canSubmit 
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none" 
                        : "bg-green-600 hover:bg-green-700 shadow-green-200"
                }`}
             >
                {saving ? "Processing..." : submissionStatus ? "Update Report" : "Submit Report"}
             </button>
        </div>
    </div>
</div>
        </div>
      </>
      )}

      
    </div>
  );
};

export default HybridDowntimeManager;