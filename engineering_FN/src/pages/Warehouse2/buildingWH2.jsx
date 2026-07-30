import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';


const WH2Dashboard = () => {
    // --- State Management ---
    const navigate = useNavigate(); // <--- ADD THIS
    const [area, setArea] = useState('Area 1');
    const [interval, setInterval] = useState('hour'); 
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    
    const [intervalData, setIntervalData] = useState([]);
    const [stats, setStats] = useState({});
    
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 24;
    // Holds all un-saved typing temporarily
const [draftEdits, setDraftEdits] = useState({});

    // --- CRUD State Management ---
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingRow, setEditingRow] = useState(null); // Tracks which row is actively being edited
    const [editForm, setEditForm] = useState({ temperature: '', humidity: '' });

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createForm, setCreateForm] = useState({
    timestamp: '', // Use type="datetime-local" in the input
    temperature: '',
    humidity: ''})

    let userLevel = 1; // Default to Level 1 (New User) for maximum safety
    // Default to Level 1 (New user) if nothing is found
    const rawLevel = localStorage.getItem('user_level');

    
    try {
        const token = localStorage.getItem('user_token');
        if (token) {
            // Crack open the JWT token and read the payload directly
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (payload.level) {
                userLevel = parseInt(payload.level, 10);
            }
        }
    } catch (error) {
        console.error("Failed to decode token for security check:", error);
    }

    // The Lock: Only Manager (3) and Admin (5)
    const allowedLevels = [3, 5];
    const hasAdminPrivileges = allowedLevels.includes(userLevel);
;

const areaMapping = {
    "Area 1": "C56 WH2",
    "Area 2": "C64 WH2",
    "Area 3": "C72 WH2"
};
    // --- Fetch Data ---
    const fetchData = async (overrideInterval = interval) => {
        if (!startDate || !endDate || !area) {
            alert("Please select an area, start date, and end date.");
            return;
        }
        try {
            const response = await axios.get("http://localhost:8002/part/getWH2DashboardData", {
                params: { area, startDate, endDate, interval: overrideInterval }
            });
            if (response.data.success) {
                const incomingData = response.data.intervalData || response.data.hourlyData || [];
                setIntervalData(incomingData);
                setStats(response.data.statistics || {});
                setCurrentPage(1); 
                setEditingRow(null); // Reset edit state on new search
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    };

    // --- ADD THIS FUNCTION ---
    const handleCreateSubmit = async () => {
        if (!createForm.timestamp || !createForm.temperature || !createForm.humidity) {
            alert("Please fill in all fields.");
            return;
        }

        // 1. Fetch the token from local storage
        const token = localStorage.getItem('user_token');

        try {
            await axios.post("http://localhost:8002/part/createWH2DashboardData", 
                // The body payload
                {
                    area: area,
                    timestamp: createForm.timestamp,
                    temperature: createForm.temperature,
                    humidity: createForm.humidity
                },
                // 2. The configuration object with headers
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );
            alert("Manual entry created successfully.");
            setIsCreateModalOpen(false); 
            fetchData(); 
        } catch (error) {
            if (error.response && error.response.status === 409) {
                alert(error.response.data.error); 
            } else {
                console.error("Error creating data:", error);
                alert("Failed to create entry.");
            }
        }
    };

    // --- Handle Edit Mode Toggle ---
    const toggleEditMode = () => {
        const newMode = !isEditMode;
        setIsEditMode(newMode);
        
        if (newMode) {
            // Force interval to minute and fetch real data instantly
            setInterval('minute');
            fetchData('minute');
        } else {
            setEditingRow(null);
        }
    };

    // --- CRUD Actions ---
    const startEditing = (row) => {
        setEditingRow(row.raw_timestamp);
        setEditForm({ temperature: row.temperature, humidity: row.humidity });
    };

    // --- 1. THE INLINE UPDATE FUNCTION ---
    // --- 1. THE INLINE UPDATE FUNCTION ---
    // --- 1. LOCAL DRAFT FUNCTION (Fires every time you press a key) ---
    const handleDraftChange = (timestamp, rowArea, field, value) => {
        const key = `${timestamp}_${rowArea}`;
        setDraftEdits(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                [field]: value
            }
        }));
    };

    // --- 2. THE ROW SAVE FUNCTION (Fires only when you click the SAVE button) ---
    const handleSaveRow = async (row) => {
        try {
            const token = localStorage.getItem('user_token');
            // Check all 3 areas if in the wide view, or just the single area
            const areasToCheck = area === 'All' ? ['Area 1', 'Area 2', 'Area 3'] : [row.area || area];
            
            let didUpdate = false;

            // Loop through the areas in this row and bundle the drafts
            for (const targetArea of areasToCheck) {
                const key = `${row.raw_timestamp}_${targetArea}`;
                const edits = draftEdits[key];

                if (edits) {
                    // Grab original data if they only changed one of the two boxes
                    const originalTemp = area === 'All' ? row[`${targetArea}_temperature`] : row.temperature;
                    const originalHum = area === 'All' ? row[`${targetArea}_humidity`] : row.humidity;

                    const finalTemp = edits.temperature !== undefined ? Number(edits.temperature) : originalTemp;
                    const finalHum = edits.humidity !== undefined ? Number(edits.humidity) : originalHum;

                    // Send the bundled payload. This creates ONE clean Audit Log!
                    await axios.put("http://localhost:8002/part/updateWH2DashboardData", {
                        area: targetArea, 
                        raw_timestamp: row.raw_timestamp,
                        temperature: finalTemp,
                        humidity: finalHum
                    }, { headers: { 'Authorization': `Bearer ${token}` } });

                    didUpdate = true;
                }
            }

            if (didUpdate) {
                alert("Row saved successfully.");
                setDraftEdits({}); // Clear the drafts so the inputs reset
                fetchData(); // Refresh the table
            } else {
                alert("No changes detected in this row.");
            }

        } catch (error) {
            console.error("Error saving row:", error);
            alert("Failed to save changes.");
        }
    };


    // --- 2. THE ROW-SPECIFIC DELETE FUNCTION ---
    const handleDeleteClick = async (raw_timestamp, rowArea) => {
        // Frontend Gate
        if (!hasAdminPrivileges) {
            alert("Unauthorized: Only Managers and Admins can delete data.");
            return;
        }

        if (!window.confirm(`Are you sure you want to delete this record for ${rowArea}? This cannot be undone.`)) return;

        try {
            const token = localStorage.getItem('user_token');

            await axios.delete("http://localhost:8002/part/deleteWH2DashboardData", {
                data: { 
                    area: rowArea, // Safely uses the specific row's area!
                    raw_timestamp: raw_timestamp 
                },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            alert("Data deleted successfully.");
            fetchData(); 

        } catch (error) {
            console.error("Error deleting data:", error);
            alert("Failed to delete data.");
        }
    };
    // --- Pagination & Safety Fallbacks ---
    const safeIntervalData = intervalData || [];
    const indexOfLastRow = currentPage * rowsPerPage;
    const indexOfFirstRow = indexOfLastRow - rowsPerPage;
    const currentTableData = safeIntervalData.slice(indexOfFirstRow, indexOfLastRow);
    const totalPages = Math.ceil(safeIntervalData.length / rowsPerPage);
    

    // --- PDF Generation Logic ---
    const exportTableToPDF = () => {
        if (safeIntervalData.length === 0) return alert("No data to export.");
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text(`Historical Log - Warehouse 2 (${area})`, 14, 20);
        doc.setFontSize(10);
        doc.text(`Period: ${startDate} to ${endDate} | Interval: ${interval}`, 14, 28);

        const tableColumn = ["NO", "DATE TIME", "TEMPERATURE (°C)", "HUMIDITY (%)"];
        const tableRows = safeIntervalData.map((row, index) => [
            index + 1, row.log_time, row.temperature, row.humidity
        ]);

        autoTable(doc, { head: [tableColumn], body: tableRows, startY: 35 });
        doc.save(`WH2_Log_${area}_${startDate}.pdf`);
    };

    const exportTableToExcel = () => {
        // Safety check: Don't export if the table is empty
        if (!safeIntervalData || safeIntervalData.length === 0) {
            alert("No data available to export.");
            return;
        }

        // 1. The Area Dictionary: Maps the generic state name to the real building code
        const areaMapping = {
            "Area 1": "C56 WH2",
            "Area 2": "C64 WH2",
            "Area 3": "C72 WH2"
        };

        const excelData = safeIntervalData.map(row => {
            const dateObj = new Date(row.raw_timestamp * 1000);
            
            // THE FIX: Read from row.area, not the global state
            const rowArea = row.area || area; // Fallback just in case
            const formattedArea = areaMapping[rowArea] || rowArea;

            return {
                "Area": formattedArea, 
                "Date & Time": dateObj.toLocaleString('sv-SE').replace(',', ''),
                "Temperature (°C)": row.temperature,
                "Humidity (%)": row.humidity
            };
        });

        // 3. Create a Worksheet
        const worksheet = XLSX.utils.json_to_sheet(excelData);

        // 4. Update the Column Widths (Removed the timestamp width)
        const columnWidths = [
            { wpx: 100 }, // Area
            { wpx: 150 }, // Date & Time
            { wpx: 120 }, // Temperature
            { wpx: 120 }  // Humidity
        ];
        worksheet['!cols'] = columnWidths;

        // 5. Create the Workbook and Trigger Download
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Warehouse Data");

        const today = new Date().toISOString().split('T')[0];
        XLSX.writeFile(workbook, `WH2_Raw_Data_${today}.xlsx`);
    };

    const tableAndChartData = useMemo(() => {
    // If a single area is selected, use the raw data directly
    if (area !== 'All') return safeIntervalData;

    // If 'All' is selected, pivot the data by timestamp
    const groupedData = {};

    safeIntervalData.forEach(row => {
        if (!groupedData[row.log_time]) {
            // Save the raw_timestamp so the CRUD buttons still function
            groupedData[row.log_time] = { 
                log_time: row.log_time, 
                raw_timestamp: row.raw_timestamp 
            };
        }
        
        // Attach the data to the matching timestamp row
        groupedData[row.log_time][`${row.area}_temperature`] = row.temperature;
        groupedData[row.log_time][`${row.area}_humidity`] = row.humidity;
    });

    return Object.values(groupedData);
}, [safeIntervalData, area]);



    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
            
            {/* --- TOP CARD: GRAPH & STATS --- */}
            <div className="bg-white rounded-3xl shadow-sm p-8 mb-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
                    <h2 className="text-xl font-extrabold text-slate-800 tracking-tight uppercase">WAREHOUSE 2 DATA GRAPH</h2>
                    
                    <div className="flex flex-wrap items-center gap-4">
                        <select value={area} onChange={(e) => setArea(e.target.value)} className="bg-white border border-slate-300 text-slate-700 text-sm font-semibold rounded-md px-4 py-2 outline-none shadow-sm cursor-pointer">
                            <option value="Area 1">C56 WH2</option>
                            <option value="Area 2">C64 WH2</option>
                            <option value="Area 3">C72 WH2</option>
                            <option value="All">All Areas (Combined)</option>
                        </select>

                        <select 
                            value={interval} 
                            onChange={(e) => setInterval(e.target.value)}
                            disabled={isEditMode} // Lock dropdown if in edit mode
                            className={`bg-white border border-slate-300 text-sm font-semibold rounded-md px-4 py-2 outline-none shadow-sm cursor-pointer ${isEditMode ? 'text-slate-400 bg-slate-100 cursor-not-allowed' : 'text-slate-700'}`}
                        >
                            <option value="minute">Per Minute</option>
                            <option value="hour">Per Hour</option>
                            <option value="day">Per Day</option>
                            <option value="month">Per Month</option>
                        </select>
                        
                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-full p-1 shadow-sm text-sm">
                            <span className="text-slate-400 font-bold text-xs uppercase tracking-wider pl-4 pr-2">RANGE</span>
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent px-2 py-1 outline-none text-slate-600 font-medium"/>
                            <span className="text-slate-400 font-medium">-</span>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent px-2 py-1 outline-none text-slate-600 font-medium mr-2"/>
                            
                            <button onClick={() => fetchData()} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-1.5 rounded-full transition-colors text-sm">
                                SEARCH
                            </button>
                        </div>
                    </div>
                </div>

                {safeIntervalData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-80 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 mb-8">
                        <p className="text-slate-500 font-medium">Please select a date range and click Search to view monitoring data.</p>
                    </div>
                ) : (
                    <>
                        {/* Chart Component Here (Unchanged) */}
                        <div className="h-80 w-full mb-8">
                            <ResponsiveContainer width="100%" height="100%">
                                {/* USE THE NEW chartData VARIABLE HERE */}
                                <LineChart data={tableAndChartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="log_time" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                                    <YAxis yAxisId="left" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                                    <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                    <Legend wrapperStyle={{paddingTop: '20px'}}/>
                                    
                                    {area === 'All' ? (
                                        <>
                                            {/* C56 WH2 (Area 1) - Indigo & Purple */}
                                            <Line yAxisId="left" type="monotone" name="C56 Temp" dataKey="Area 1_temperature" stroke="#4f46e5" strokeWidth={2} dot={false} />
                                            <Line yAxisId="right" type="monotone" name="C56 Hum" dataKey="Area 1_humidity" stroke="#a855f7" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                            
                                            {/* C64 WH2 (Area 2) - Emerald & Teal */}
                                            <Line yAxisId="left" type="monotone" name="C64 Temp" dataKey="Area 2_temperature" stroke="#10b981" strokeWidth={2} dot={false} />
                                            <Line yAxisId="right" type="monotone" name="C64 Hum" dataKey="Area 2_humidity" stroke="#14b8a6" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                            
                                            {/* C72 WH2 (Area 3) - Amber & Orange */}
                                            <Line yAxisId="left" type="monotone" name="C72 Temp" dataKey="Area 3_temperature" stroke="#f59e0b" strokeWidth={2} dot={false} />
                                            <Line yAxisId="right" type="monotone" name="C72 Hum" dataKey="Area 3_humidity" stroke="#f97316" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                        </>
                                    ) : (
                                        <>
                                            {/* Standard Single Area Lines */}
                                            <Line yAxisId="left" type="monotone" name={`${areaMapping[area] || area} Temp`} dataKey="temperature" stroke="#4f46e5" strokeWidth={3} dot={false} />
                                            <Line yAxisId="right" type="monotone" name={`${areaMapping[area] || area} Hum`} dataKey="humidity" stroke="#0ea5e9" strokeWidth={3} dot={false} />
                                        </>
                                    )}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        {stats.avgTemp && (
                            <div className="flex justify-center gap-16 md:gap-32 text-center border-t border-slate-100 pt-8">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Temperature</p>
                                    <div className="text-slate-800 font-medium">
                                        <span className="block text-2xl font-extrabold text-indigo-600 mb-1">{stats.avgTemp}°C <span className="text-sm font-normal text-slate-400">Avg</span></span>
                                        <span className="text-sm">Max: {stats.maxTemp}°C <span className="mx-2 text-slate-300">|</span> Min: {stats.minTemp}°C</span>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Humidity</p>
                                    <div className="text-slate-800 font-medium">
                                        <span className="block text-2xl font-extrabold text-sky-500 mb-1">{stats.avgHum}% <span className="text-sm font-normal text-slate-400">Avg</span></span>
                                        <span className="text-sm">Max: {stats.maxHum}% <span className="mx-2 text-slate-300">|</span> Min: {stats.minHum}%</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* --- BOTTOM CARD: HISTORICAL LOG TABLE --- */}
            <div className="bg-white rounded-3xl shadow-sm p-8">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8">
                
                {/* Title Area */}
                <div>
                    <h2 className="text-2xl font-extrabold text-slate-800 uppercase tracking-tight">Historical Log</h2>
                    <p className="text-sm text-slate-500 mt-1">Warehouse Archive Data</p>
                </div>

                {/* Button Toolbar */}
                <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
                    
                    {/* --- THE LOCK STARTS HERE (Group 1: Admin Navigation) --- */}
                    {hasAdminPrivileges && (
                        <>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => navigate('/WH2UserManagement')}
                                    className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 hover:text-indigo-600 text-sm font-semibold transition-all shadow-sm"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                                    Manage Users
                                </button>
                                <button 
                                    onClick={() => navigate('/WH2AuditLogs')}
                                    className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 hover:text-indigo-600 text-sm font-semibold transition-all shadow-sm"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                    Audit Logs
                                </button>
                            </div>
                            
                            {/* Vertical Divider */}
                            <div className="hidden sm:block h-8 w-px bg-slate-200"></div>
                        </>
                    )}

                    {/* --- PUBLIC AREA (Group 2: Export Tools) --- */}
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={exportTableToPDF} 
                            disabled={safeIntervalData.length === 0}
                            className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md hover:bg-indigo-100 text-sm font-semibold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            PDF
                        </button>
                        <button 
                            onClick={exportTableToExcel} 
                            disabled={safeIntervalData.length === 0}
                            className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md hover:bg-emerald-100 text-sm font-semibold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            Excel
                        </button>
                    </div>

                    {/* --- THE LOCK RESUMES (Group 3: Data Actions) --- */}
                    {hasAdminPrivileges && (
                        <>
                            {/* Vertical Divider */}
                            <div className="hidden sm:block h-8 w-px bg-slate-200"></div>

                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={toggleEditMode} 
                                    className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-md transition-all shadow-sm border 
                                        ${isEditMode 
                                            ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' 
                                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-slate-900'
                                        }`}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                    {isEditMode ? 'Exit Edit Mode' : 'Edit Mode'}
                                </button>
                                
                                <button 
                                    onClick={() => setIsCreateModalOpen(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white border border-transparent rounded-md hover:bg-indigo-700 text-sm font-bold shadow-md transition-all"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                                    Add Entry
                                </button>
                            </div>
                        </>
                    )}

                </div>
            </div>

                {safeIntervalData.length === 0 ? (
                    <div className="flex items-center justify-center py-12 text-slate-400 font-medium bg-slate-50 rounded-xl border border-slate-100">No historical data available.</div>
                ) : (
                    <>
                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                                       <table className="w-full text-left border-collapse min-w-max">
                    <thead className="bg-slate-50 border-y border-slate-100">
                        {area === 'All' ? (
                            <tr>
                                {/* WIDE FORMAT HEADERS */}
                                <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Date & Time</th>
                                <th className="py-4 px-6 text-xs font-bold text-indigo-500 uppercase tracking-wider">C56 Temp</th>
                                <th className="py-4 px-6 text-xs font-bold text-indigo-500 uppercase tracking-wider">C56 Hum</th>
                                <th className="py-4 px-6 text-xs font-bold text-emerald-500 uppercase tracking-wider">C64 Temp</th>
                                <th className="py-4 px-6 text-xs font-bold text-emerald-500 uppercase tracking-wider">C64 Hum</th>
                                <th className="py-4 px-6 text-xs font-bold text-amber-500 uppercase tracking-wider">C72 Temp</th>
                                <th className="py-4 px-6 text-xs font-bold text-amber-500 uppercase tracking-wider">C72 Hum</th>
                                <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        ) : (
                            <tr>
                                {/* SINGLE AREA HEADERS */}
                                <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Area</th>
                                <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Date & Time</th>
                                <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Temperature (°C)</th>
                                <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Humidity (%)</th>
                                <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        )}
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {tableAndChartData.length === 0 ? (
                            <tr>
                                <td colSpan={area === 'All' ? "8" : "5"} className="py-12 text-center text-slate-400 font-medium">
                                    No data entries found for this period.
                                </td>
                            </tr>
                        ) : (
                            tableAndChartData.map((row, index) => (
                                <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                                    
                                    {area === 'All' ? (
                                        <>
                                            {/* --- WIDE FORMAT ROW --- */}
                                            <td className="py-4 px-6 text-sm font-medium text-slate-600">{row.log_time}</td>
                                            
                                            {/* --- C56 (Area 1) --- */}
                                            <td className="py-4 px-6 text-sm font-bold text-indigo-700">
                                                {isEditMode ? (
                                                    <input type="number" 
                                                        value={draftEdits[`${row.raw_timestamp}_Area 1`]?.temperature ?? row['Area 1_temperature'] ?? ''} 
                                                        onChange={(e) => handleDraftChange(row.raw_timestamp, 'Area 1', 'temperature', e.target.value)} 
                                                        className="w-16 border border-indigo-200 rounded px-1 py-1 outline-none focus:border-indigo-500 bg-indigo-50/50" />
                                                ) : ( row['Area 1_temperature'] ?? '-' )}
                                            </td>
                                            <td className="py-4 px-6 text-sm font-bold text-indigo-700">
                                                {isEditMode ? (
                                                    <input type="number" 
                                                        value={draftEdits[`${row.raw_timestamp}_Area 1`]?.humidity ?? row['Area 1_humidity'] ?? ''} 
                                                        onChange={(e) => handleDraftChange(row.raw_timestamp, 'Area 1', 'humidity', e.target.value)} 
                                                        className="w-16 border border-indigo-200 rounded px-1 py-1 outline-none focus:border-indigo-500 bg-indigo-50/50" />
                                                ) : ( row['Area 1_humidity'] ?? '-' )}
                                            </td>
                                            
                                            {/* --- C64 (Area 2) --- */}
                                            <td className="py-4 px-6 text-sm font-bold text-emerald-700">
                                                {isEditMode ? (
                                                    <input type="number" 
                                                        value={draftEdits[`${row.raw_timestamp}_Area 2`]?.temperature ?? row['Area 2_temperature'] ?? ''} 
                                                        onChange={(e) => handleDraftChange(row.raw_timestamp, 'Area 2', 'temperature', e.target.value)} 
                                                        className="w-16 border border-emerald-200 rounded px-1 py-1 outline-none focus:border-emerald-500 bg-emerald-50/50" />
                                                ) : ( row['Area 2_temperature'] ?? '-' )}
                                            </td>
                                            <td className="py-4 px-6 text-sm font-bold text-emerald-700">
                                                {isEditMode ? (
                                                    <input type="number" 
                                                        value={draftEdits[`${row.raw_timestamp}_Area 2`]?.humidity ?? row['Area 2_humidity'] ?? ''} 
                                                        onChange={(e) => handleDraftChange(row.raw_timestamp, 'Area 2', 'humidity', e.target.value)} 
                                                        className="w-16 border border-emerald-200 rounded px-1 py-1 outline-none focus:border-emerald-500 bg-emerald-50/50" />
                                                ) : ( row['Area 2_humidity'] ?? '-' )}
                                            </td>
                                            
                                            {/* --- C72 (Area 3) --- */}
                                            <td className="py-4 px-6 text-sm font-bold text-amber-700">
                                                {isEditMode ? (
                                                    <input type="number" 
                                                        value={draftEdits[`${row.raw_timestamp}_Area 3`]?.temperature ?? row['Area 3_temperature'] ?? ''} 
                                                        onChange={(e) => handleDraftChange(row.raw_timestamp, 'Area 3', 'temperature', e.target.value)} 
                                                        className="w-16 border border-amber-200 rounded px-1 py-1 outline-none focus:border-amber-500 bg-amber-50/50" />
                                                ) : ( row['Area 3_temperature'] ?? '-' )}
                                            </td>
                                            <td className="py-4 px-6 text-sm font-bold text-amber-700">
                                                {isEditMode ? (
                                                    <input type="number" 
                                                        value={draftEdits[`${row.raw_timestamp}_Area 3`]?.humidity ?? row['Area 3_humidity'] ?? ''} 
                                                        onChange={(e) => handleDraftChange(row.raw_timestamp, 'Area 3', 'humidity', e.target.value)} 
                                                        className="w-16 border border-amber-200 rounded px-1 py-1 outline-none focus:border-amber-500 bg-amber-50/50" />
                                                ) : ( row['Area 3_humidity'] ?? '-' )}
                                            </td>
                                            
                                            {/* --- ACTIONS COLUMN (WIDE) --- */}
                                            <td className="py-4 px-6 text-right">
                                                {isEditMode ? (
                                                    <button onClick={() => handleSaveRow(row)} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded shadow-sm transition-colors">
                                                        Save
                                                    </button>
                                                ) : (
                                                    <button onClick={() => handleDeleteClick(row.raw_timestamp, area === 'All' ? 'All' : (row.area || area))} className="text-slate-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-lg" title="Delete Entry">
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                    </button>
                                                )}
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            {/* --- SINGLE AREA ROW --- */}
                                            <td className="py-4 px-6 text-sm font-bold text-indigo-600">{areaMapping[row.area || area] || (row.area || area)}</td>
                                            <td className="py-4 px-6 text-sm font-medium text-slate-600">{row.log_time}</td>
                                            
                                            <td className="py-4 px-6 text-sm font-bold text-slate-700">
                                                {isEditMode ? (
                                                    <input type="number" 
                                                        value={draftEdits[`${row.raw_timestamp}_${row.area || area}`]?.temperature ?? row.temperature ?? ''} 
                                                        onChange={(e) => handleDraftChange(row.raw_timestamp, row.area || area, 'temperature', e.target.value)} 
                                                        className="w-20 border border-slate-300 rounded px-2 py-1 outline-none focus:border-indigo-500" />
                                                ) : ( row.temperature )}
                                            </td>
                                            
                                            <td className="py-4 px-6 text-sm font-bold text-slate-700">
                                                {isEditMode ? (
                                                    <input type="number" 
                                                        value={draftEdits[`${row.raw_timestamp}_${row.area || area}`]?.humidity ?? row.humidity ?? ''} 
                                                        onChange={(e) => handleDraftChange(row.raw_timestamp, row.area || area, 'humidity', e.target.value)} 
                                                        className="w-20 border border-slate-300 rounded px-2 py-1 outline-none focus:border-indigo-500" />
                                                ) : ( row.humidity )}
                                            </td>
                                            
                                            {/* --- ACTIONS COLUMN (SINGLE) --- */}
                                            <td className="py-4 px-6 text-right">
                                                {isEditMode ? (
                                                    <button onClick={() => handleSaveRow(row)} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded shadow-sm transition-colors">
                                                        Save
                                                    </button>
                                                ) : (
                                                    <button onClick={() => handleDeleteClick(row.raw_timestamp, area === 'All' ? 'All' : (row.area || area))} className="text-slate-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-lg" title="Delete Entry">
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                    </button>
                                                )}
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                        </div>

                        {isCreateModalOpen && (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-96">
            <h3 className="text-lg font-bold mb-4">Add Manual Entry ({area})</h3>
            
            <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Date & Time</label>
            <input 
                type="datetime-local" 
                className="w-full border p-2 rounded mb-4"
                onChange={(e) => setCreateForm({...createForm, timestamp: e.target.value})}
            />

            <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Temperature (°C)</label>
            <input 
                type="number" 
                className="w-full border p-2 rounded mb-4"
                onChange={(e) => setCreateForm({...createForm, temperature: e.target.value})}
            />

            <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Humidity (%)</label>
            <input 
                type="number" 
                className="w-full border p-2 rounded mb-6"
                onChange={(e) => setCreateForm({...createForm, humidity: e.target.value})}
            />

            <div className="flex justify-end gap-3">
                <button onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold">Cancel</button>
                <button 
                    onClick={handleCreateSubmit} 
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold"
                >
                    Save Entry
                </button>
            </div>
        </div>
    </div>
)}

                        {/* Pagination Controls */}
                        <div className="flex justify-between items-center mt-6 text-sm font-medium text-slate-500">
                            <span>Showing {indexOfFirstRow + 1} to {Math.min(indexOfLastRow, safeIntervalData.length)} of {safeIntervalData.length} entries</span>
                            <div className="flex gap-2">
                                <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="px-4 py-2 bg-white border border-slate-300 rounded-md hover:bg-slate-50 text-slate-700 disabled:opacity-50 transition-colors font-semibold">Prev</button>
                                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="px-4 py-2 bg-white border border-slate-300 rounded-md hover:bg-slate-50 text-slate-700 disabled:opacity-50 transition-colors font-semibold">Next</button>
                            </div>
                            
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};



export default WH2Dashboard;