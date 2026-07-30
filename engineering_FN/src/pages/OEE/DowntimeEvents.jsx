import React, { useState, useEffect } from "react";
import axios from "axios";
import ShiftStatsDisplay from './DowntimeDisplay';
import AuditNavigator from './AuditNavigator'; // Import the new component

// --- COMPONENTS: Modals ---

const AssignModal = ({ isOpen, onClose, onSave, event, reasonsList = [], currentUsage = 0, limit = 0 }) => {
  const [category, setCategory] = useState("Unplanned");
  const [reasonId, setReasonId] = useState("");

  // 1. Initialize State
  useEffect(() => {
    if (event) {
      const cleanCategory = 
        (!event.category || event.category === 'Undefined') 
        ? "Unplanned" 
        : event.category;

      setCategory(cleanCategory);
      setReasonId(event.reason_id || "");
    }
  }, [event, isOpen]);

  // 2. Filter Reasons
  const filteredReasons = reasonsList.filter(
    (r) => r.default_category === category
  );

  // 3. Handle Category Change
  const handleCategoryChange = (newCategory) => {
    setCategory(newCategory);
    setReasonId(""); 
  };

  if (!isOpen || !event) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-96 animate-in fade-in zoom-in duration-200">
        <h3 className="text-lg font-bold mb-4 text-gray-800">Assign Downtime Reason</h3>
        
        {/* INPUTS */}
        <label className="block text-sm font-bold mb-2 text-gray-700">Category</label>
        <select 
          className="w-full border border-gray-300 p-2 rounded mb-4 bg-gray-50 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          value={category}
          onChange={(e) => handleCategoryChange(e.target.value)}
        >
          <option value="Unplanned">Unplanned (Loss)</option>
          <option value="Planned">Planned (Budgeted)</option>
        </select>

        <label className="block text-sm font-bold mb-2 text-gray-700">Reason Code</label>
        <select 
          className="w-full border border-gray-300 p-2 rounded mb-6 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          value={reasonId}
          onChange={(e) => setReasonId(e.target.value)}
          disabled={filteredReasons.length === 0}
        >
          <option value="">
             {filteredReasons.length === 0 ? "-- No Reasons Found --" : "-- Select Reason --"}
          </option>
          {filteredReasons.map((reason) => (
            <option key={reason.id} value={reason.id}>
              {reason.name}
            </option>
          ))}
        </select>

        {/* FOOTER */}
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-medium transition-colors">Cancel</button>
          
          <button 
            disabled={!reasonId} 
            onClick={() => {
                if (!event.id) return alert("Please Sync to Database first!");
                if (!reasonId) return alert("Please select a Reason!");

                // --- ⛔ STRICT BUDGET VALIDATOR ---
                if (category === "Planned") {
                    const duration = parseFloat(event.duration_minutes || 0);
                    
                    // Don't double count if we are editing an already planned event
                    const isAlreadyPlanned = event.category === "Planned";
                    const actualUsage = isAlreadyPlanned ? (currentUsage - duration) : currentUsage;
                    const projectedTotal = actualUsage + duration;

                    // STRICT CHECK:
                    if (projectedTotal > limit) {
                        const overBy = (projectedTotal - limit).toFixed(1);
                        
                        // 🛑 HARD STOP: Show Error and RETURN (Do not save)
                        alert(`⛔ BLOCKED: Action Denied.\n\nThis assignment would exceed the Planned Budget by ${overBy} mins.\n\nLimit: ${limit}m\nProjected: ${projectedTotal.toFixed(1)}m`);
                        return; 
                    }
                }
                // ----------------------------------

                onSave(event.id, category, reasonId);
            }}
            className={`px-4 py-2 rounded font-bold shadow-sm text-white transition-colors
                ${!reasonId ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

const SplitModal = ({ isOpen, onClose, onSplit, event }) => {
  const [splitMins, setSplitMins] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-96 animate-in fade-in zoom-in duration-200">
        <h3 className="text-lg font-bold mb-2 text-gray-800">Split Event</h3>
        <p className="text-sm text-gray-500 mb-6 bg-gray-50 p-2 rounded border border-gray-100">
          Total Duration: <span className="font-bold text-gray-800">{Math.round(event.duration_minutes)} mins</span>
        </p>
        
        <label className="block text-sm font-bold mb-2 text-gray-700">Split Amount (First Part)</label>
        <div className="flex items-center gap-2 mb-6">
          <input 
            type="number" 
            className="w-full border border-gray-300 p-2 rounded outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            placeholder="e.g. 10"
            value={splitMins}
            onChange={(e) => setSplitMins(e.target.value)}
          />
          <span className="text-gray-500 font-medium">mins</span>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-medium transition-colors">Cancel</button>
          <button 
            onClick={() => onSplit(event.id, splitMins)}
            className="px-4 py-2 bg-orange-600 text-white font-bold rounded hover:bg-orange-700 shadow-sm transition-colors"
          >
            Split Event
          </button>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENT: Progress Bar ---
const BudgetBar = ({ title, used, limit, colorClass }) => {
  const safeLimit = limit || 1; 
  const percentage = Math.min((used / safeLimit) * 100, 100);
  let barColor = percentage >= 100 ? "bg-red-600" : (percentage > 85 ? "bg-yellow-500" : colorClass);

  return (
    <div className="mb-4 last:mb-0">
      <div className="flex justify-between text-sm font-semibold text-gray-600 mb-1">
        <span>{title}</span>
        <span>{used.toFixed(1)} / {limit || 0} mins</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-5 overflow-hidden border border-gray-300 relative">
        <div className={`h-full transition-all duration-500 flex items-center justify-end pr-2 text-[10px] text-white font-bold ${barColor}`} style={{ width: `${percentage}%` }}>
          {percentage.toFixed(0)}%
        </div>
      </div>
    </div>
  );
};

// --- MAIN PAGE ---
const DowntimeManager = () => {
  // 1. State
  const [mode, setMode] = useState("view"); // 'view' (Live) or 'edit' (Stored)
  const [data, setData] = useState({ events: [], budget: { unplanned_limit: 0, planned_limit: 0 } });
  
  const [selectedDate, setSelectedDate] = useState("2026-01-21");
  const [startTime, setStartTime] = useState("06:30");
  const [endTime, setEndTime] = useState("15:00");
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [reasons, setReasons] = useState([]);

  // Modal State
  const [assignModal, setAssignModal] = useState({ open: false, event: null });
  const [splitModal, setSplitModal] = useState({ open: false, event: null });

  // 2. Data Fetching Logic (Switchable)
  useEffect(() => {
    fetchData();
  }, [selectedDate, startTime, endTime, mode]); 

  useEffect(() => {
    const fetchReasons = async () => {
      try {
        const res = await axios.get("http://10.126.15.197:8002/part/getDowntimeReasons");
        setReasons(res.data || []);
      } catch (err) {
        console.error("Failed to load reasons", err);
      }
    };
    fetchReasons();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (mode === 'view') {
        // --- VIEW MODE: Fetch Raw Machine Data ---
        const startFull = `${selectedDate} ${startTime}:00`;
        const endFull = `${selectedDate} ${endTime}:00`;
        const res = await axios.get(`http://10.126.15.197:8002/part/getDowntimeByUnix`, {
          params: { start_date: startFull, end_date: endFull },
        });
        setData(prev => ({ ...prev, events: res.data.events || [], budget: res.data.budget || prev.budget }));
      
     // ... inside fetchData function ...

} else {
    // --- EDIT MODE: Fetch Stored Table Data by Date ---
    // REMOVED: params: { shift_id: 101 }
    
    // ADDED: Use the same date logic as View Mode
    const startFull = `${selectedDate} ${startTime}:00`;
    const endFull = `${selectedDate} ${endTime}:00`;

    const res = await axios.get(`http://10.126.15.197:8002/part/getStoredDowntime`, {
        params: { start_date: startFull, end_date: endFull },
    });
    
    setData(prev => ({ 
        ...prev, 
        events: res.data.events || [],
        // Keep view mode budget limits for now
    }));
}
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- ACTIONS ---

  const handleSyncToDB = async () => {
    if (data.events.length === 0) return;
    setIsSyncing(true);
    try {
        await axios.post(`http://10.126.15.197:8002/part/storeDowntimeEvents`, { shift_id: 101, events: data.events });
        alert(`Synced! Switching to Edit Mode.`);
        setMode('edit'); // Auto-switch to Edit Mode after sync
    } catch (err) {
        alert("Sync failed.");
    } finally {
        setIsSyncing(false);
    }
  };

  const handleAssign = async (id, category, reasonId) => {
    try {
      await axios.put(`http://10.126.15.197:8002/part/updateDowntime`, { id, category, reason_id: reasonId });
      setAssignModal({ open: false, event: null });
      fetchData(); // Refresh list
    } catch (err) {
      console.error(err);
      alert("Update failed");
    }
  };

  const handleSplit = async (id, splitMins) => {
    try {
      await axios.post(`http://10.126.15.197:8002/part/splitDowntime`, { id, split_minutes: splitMins });
      setSplitModal({ open: false, event: null });
      fetchData(); // Refresh list
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Split failed");
    }
  };

  

  
  // --- HELPERS ---
  const formatDateTime = (iso) => iso ? new Date(iso).toLocaleString('en-GB', { hour12: false }) : "-";
  const getDuration = (e) => parseFloat(e.duration_minutes || 0);

  // Calculate Totals for Bars
  // In View Mode: Calculate from List. In Edit Mode: Calculate from List Categories.
  const usedUnplanned = data.events.filter(e => e.category === 'Unplanned').reduce((sum, e) => sum + getDuration(e), 0);
  const usedPlanned = data.events.filter(e => e.category === 'Planned').reduce((sum, e) => sum + getDuration(e), 0);
  const totalDowntime = data.budget?.total_downtime ? data.budget.total_downtime : data.events.reduce((sum, e) => sum + getDuration(e), 0);

  const checkTimeAnomaly = (eventFinishIso) => {
    if (!eventFinishIso) return false;
    
    // 1. Construct the Hard Limit (Shift End)
    // We combine the selected date + selected end time to make a comparable Date object
    const shiftLimit = new Date(`${selectedDate}T${endTime}:00`);
    
    // 2. Parse the Event's Finish Time
    const eventFinish = new Date(eventFinishIso);

    // 3. Compare (Add a 1-minute buffer for seconds rounding)
    // If event ends AFTER the shift limit, it's an anomaly
    return eventFinish > new Date(shiftLimit.getTime() + 60000);
  };
  
  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* --- HEADER --- */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200 gap-4">
          <div className="flex items-center gap-4">
             <h1 className="text-xl font-bold text-gray-800">📉 Downtime Dashboard</h1>
             {/* MODE SWITCHER */}
             <div className="flex bg-gray-100 rounded-lg p-1">
                <button 
                  onClick={() => setMode('view')}
                  className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${mode === 'view' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                >
                  LIVE DATA
                </button>
                <button 
                  onClick={() => setMode('edit')}
                  className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${mode === 'edit' ? 'bg-white shadow text-green-600' : 'text-gray-500'}`}
                >
                  EDIT MODE
                </button>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
             {/* Only show Date Pickers in View Mode (Edit Mode implies specific shift usually) */}
             {mode === 'view' && (
               <>
                 <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="border rounded px-2 py-1 text-sm"/>
                 <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="border rounded px-2 py-1 text-sm"/>
                 <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="border rounded px-2 py-1 text-sm"/>
                 
                 <button 
                    onClick={handleSyncToDB} disabled={isSyncing || data.events.length === 0}
                    className={`px-4 py-2 rounded text-sm font-bold text-white shadow ${isSyncing ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"}`}
                 >
                    {isSyncing ? "Saving..." : "💾 Sync"}
                 </button>
               </>
             )}
             {mode === 'edit' && (
                <span className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded border border-green-200">
                   ● Editing Stored Shift Record
                </span>
             )}
          </div>
        </div>

        {/* --- SECTION 1: BUDGET OVERVIEW --- */}
        <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-blue-600">
          
          {/* HEADER */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-gray-800">
              Shift Budget Summary
            </h2>
            <div className="bg-gray-100 px-4 py-2 rounded-lg border border-gray-200 flex flex-col items-end">
                <span className="text-xs font-bold text-gray-500 uppercase">Total Downtime (PLC)</span>
                {/* FIXED: INT FORMAT */}
                <span className="text-xl font-extrabold text-blue-900">{Math.round(totalDowntime)} m</span>
            </div>
            
          </div>

          {/* CALCULATIONS BLOCK */}
          {(() => {
               // 1. ANALYZE STATE
               const isListEmpty = data.events.length === 0;
               const hasDowntime = totalDowntime > 0.1;
               
               // State A: Missing Data (PLC says down, DB says nothing)
               const isSyncRequired = isListEmpty && hasDowntime;

               let hasPendingAction = false;
               
               const sums = data.events.reduce((acc, e) => {
                   const dur = getDuration(e);
                   const cat = e.category; 
                   
                   // Check for Undefined items in the list
                   if (!cat || cat === 'Undefined') {
                       hasPendingAction = true;
                   }

                   if (cat === 'Planned') acc.planned += dur;
                   else if (cat === 'Unplanned') acc.unplanned += dur;
                   return acc;
               }, { planned: 0, unplanned: 0 });

               // 2. Calculate Remainder
               const totalAssigned = sums.planned + sums.unplanned;
               const remainderPool = Math.max(0, totalDowntime - totalAssigned);
               const remainderPct = Math.min(100, (remainderPool / totalDowntime) * 100);

               // 3. DEFINE CONFIGURATION BASED ON 3 STATES
               let barConfig;

               if (isSyncRequired) {
                   // STATE 1: SYNC REQUIRED (Orange)
                   barConfig = {
                       color: "bg-orange-400",
                       bgColor: "bg-orange-50",
                       borderColor: "border-orange-200",
                       textColor: "text-orange-700",
                       title: "⚠️ Data Mismatch (Sync Required)",
                       icon: null,
                       subtext: "PLC recorded downtime, but no events were found. Please click Sync."
                   };
               } else if (hasPendingAction) {
                   // STATE 2: PENDING WORK (Yellow)
                   barConfig = {
                       color: "bg-yellow-400",
                       bgColor: "bg-yellow-50",
                       borderColor: "border-yellow-200",
                       textColor: "text-yellow-700",
                       title: "Unassigned Stoptime (Pending Action)",
                       icon: <span className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse"></span>,
                       subtext: "* This bar decreases as you assign categories below."
                   };
               } else {
                   // STATE 3: JOB COMPLETE (Green)
                   // (Config handled directly in return JSX for custom layout)
                   barConfig = { isComplete: true };
               }

               return (
                   <div className="space-y-8">
                       
                       {/* --- TOP BAR: DYNAMIC (Orange -> Yellow -> Green) --- */}
                       {!barConfig.isComplete ? (
                           // SHOW BAR (For Sync Required OR Pending Action)
                           <div className={`p-4 rounded border ${barConfig.bgColor} ${barConfig.borderColor} transition-colors duration-500`}>
                               <div className="flex justify-between text-sm font-bold text-gray-700 mb-2">
                                   <div className="flex items-center gap-2">
                                       {barConfig.icon}
                                       <span>{barConfig.title}</span>
                                   </div>
                                   {/* FIXED: INT FORMAT */}
                                   <span className={`${barConfig.textColor} font-extrabold`}>
                                       {Math.round(remainderPool)} m
                                   </span>
                               </div>
                               
                               <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
                                   <div 
                                       className={`h-full transition-all duration-700 ease-out ${barConfig.color}`} 
                                       style={{ width: `${remainderPct}%` }}
                                   ></div>
                               </div>
                               <p className="text-[10px] text-gray-400 mt-1 italic">
                                   {barConfig.subtext}
                               </p>
                           </div>
                       ) : (
                           // SHOW SUCCESS BANNER (Only when actually complete)
                           <div className="p-4 bg-green-50 rounded border border-green-200 flex items-center justify-between">
                               <div className="flex items-center gap-3">
                                   <div className="bg-green-100 p-2 rounded-full">
                                       <span className="text-lg">✅</span>
                                   </div>
                                   <div>
                                       <h4 className="text-sm font-bold text-green-800">Shift Record Complete</h4>
                                       <p className="text-xs text-green-600">All visible events have been labeled.</p>
                                   </div>
                               </div>
                               <div className="text-right">
                                   <span className="text-xs font-bold text-gray-400 uppercase">Micro-stops Merged</span>
                                   {/* FIXED: INT FORMAT */}
                                   <div className="text-lg font-bold text-gray-600">{Math.round(remainderPool)} m</div>
                               </div>
                           </div>
                       )}

                       {/* --- BOTTOM ROW: RESULTS --- */}
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                           
                           {/* RED BAR */}
                           <div className="p-4 bg-red-50 rounded border border-red-100">
                               
                               {/* HEADER */}
                               <div className="flex justify-between text-sm font-bold text-gray-700 mb-2">
                                   <span>Confirmed Unplanned Loss</span>
                                   <span className="text-gray-600">
                                       {/* FIXED: INT FORMAT */}
                                       {/* If Sync/Pending: Show only Labeled. If Complete: Show Labeled + Micro */}
                                       {Math.round(sums.unplanned + (barConfig.isComplete ? remainderPool : 0))} / {Math.round(data.budget?.unplanned_limit || 124)} mins
                                   </span>
                               </div>

                               {/* BAR CHART */}
                               <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden flex shadow-inner relative">
                                   
                                   {/* Segment 1: Labeled Unplanned (Red) */}
                                   <div 
                                       className="bg-red-500 h-full transition-all duration-700" 
                                       style={{ width: `${Math.min(100, (sums.unplanned / (data.budget?.unplanned_limit || 124)) * 100)}%` }}
                                   ></div>

                                   {/* Segment 2: Micro-stops (Grey) - ONLY SHOWS WHEN COMPLETE */}
                                   {barConfig.isComplete && remainderPool > 0 && (
                                       <div 
                                           className="bg-gray-500 h-full transition-all duration-700 relative group"
                                           style={{ width: `${Math.min(100, (remainderPool / (data.budget?.unplanned_limit || 124)) * 100)}%` }}
                                       >
                                            <div className="absolute bottom-full mb-1 hidden group-hover:block bg-black text-white text-xs p-1 rounded whitespace-nowrap z-10">
                                                {/* FIXED: INT FORMAT */}
                                                Merged Micro-stops: {Math.round(remainderPool)}m
                                            </div>
                                       </div>
                                   )}
                               </div>
                               
                               {/* LEGEND */}
                               <div className="flex gap-4 mt-2 text-[10px] font-bold uppercase text-gray-500">
                                   <div className="flex items-center gap-1">
                                       <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                       {/* FIXED: INT FORMAT */}
                                       <span>Labeled: {Math.round(sums.unplanned)}m</span>
                                   </div>
                                   
                                   {barConfig.isComplete && (
                                       <div className="flex items-center gap-1">
                                           <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                                           {/* FIXED: INT FORMAT */}
                                           <span>Micro-stops: {Math.round(remainderPool)}m</span>
                                       </div>
                                   )}
                               </div>
                           </div>

                           {/* BLUE BAR */}
                           <div className="p-4 bg-blue-50 rounded border border-blue-100">
                              <BudgetBar 
                                title="Confirmed Planned Budget" 
                                // FIXED: INT FORMAT (Passed to child component)
                                used={Math.round(sums.planned)} 
                                limit={Math.round(data.budget?.planned_limit || 110)} 
                                colorClass="bg-blue-500"
                              />
                           </div>
                       </div>
                   </div>
               );
         })()}
        </div>

        <ShiftStatsDisplay 
        startDate={`${selectedDate} ${startTime}`} 
        endDate={`${selectedDate} ${endTime}`} 
    />

        {/* --- TIMELINE LIST --- */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-bold text-gray-700 mb-4">Events Timeline ({data.events.length})</h3>
          
          {loading ? <div className="text-center py-10 text-gray-400 animate-pulse">Loading...</div> : (
            <table className="min-w-full text-left">
              <thead>
                <tr className="bg-gray-100 text-gray-600 uppercase text-xs">
                  <th className="px-4 py-3">Time Range</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                 {data.events.map((event, idx) => {
                   
                   // 1. Check for Time Anomaly (Requires checkTimeAnomaly helper)
                   const isAnomaly = checkTimeAnomaly(event.finish_time || event.end_time);

                   return (
                    <tr key={idx} className={`hover:bg-gray-50 transition-colors ${isAnomaly ? "bg-red-50" : ""}`}>
                      <td className="px-4 py-3 text-sm text-gray-700">
                          <div className="flex items-center gap-2">
                             {/* Time Range Display */}
                             <span>
                                {new Date(event.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} 
                                {" ➝ "} 
                                <span className={isAnomaly ? "text-red-600 font-bold" : ""}>
                                    {new Date(event.end_time || event.finish_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                             </span>
                             
                             {/* WARNING BADGE (Only shows if isAnomaly is true) */}
                             {isAnomaly && (
                                 <div className="group relative">
                                     <span className="cursor-help text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded border border-red-200 font-bold uppercase tracking-wide">
                                          ⚠️ Error
                                     </span>
                                     {/* Tooltip on Hover */}
                                     <div className="absolute left-0 bottom-6 w-48 bg-gray-900 text-white text-xs p-2 rounded hidden group-hover:block z-50 shadow-lg">
                                          Data Error: PLC Duration extends beyond shift end time ({endTime}).
                                     </div>
                                 </div>
                             )}
                          </div>
                      </td>
                      {/* FIXED: INT FORMAT (Math.round) */}
                      <td className="px-4 py-3 text-sm font-bold">
                          {Math.round(getDuration(event))}m
                      </td>
                      <td className="px-4 py-3 text-sm">
                         <span className={`px-2 py-1 rounded text-xs font-bold ${
                            event.category === 'Unplanned' ? 'bg-red-100 text-red-700' : 
                            event.category === 'Planned' ? 'bg-blue-100 text-blue-700' : 
                            'bg-gray-200 text-gray-600'
                         }`}>
                           {event.category || 'Undefined'}
                         </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {mode === 'edit' ? (
                          <div className="flex justify-end gap-2">
                             <button onClick={() => setAssignModal({ open: true, event })} className="text-blue-600 hover:underline text-xs font-bold">Assign</button>
                             <button onClick={() => setSplitModal({ open: true, event })} className="text-orange-600 hover:underline text-xs font-bold">Split</button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Sync to Edit</span>
                        )}
                      </td>
                    </tr>
                   );
                 })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODALS */}
        <AssignModal 
            isOpen={assignModal.open} 
            onClose={() => setAssignModal({ open: false, event: null })} 
            onSave={handleAssign} 
            event={assignModal.event}
            reasonsList={reasons}
            currentUsage={usedPlanned} 
          limit={data.budget.planned_limit}
/>
      <SplitModal isOpen={splitModal.open} onClose={() => setSplitModal({ open: false, event: null })} onSplit={handleSplit} event={splitModal.event} />
          

          <AuditNavigator 
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        // Assuming you want the widget to also control the shift-based times:
        onSync={fetchData} 
      />
      
    </div>
  );
};

export default DowntimeManager;