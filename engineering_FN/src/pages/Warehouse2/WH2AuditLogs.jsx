import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const WH2AuditLogs = () => {
    // --- State Management ---
    const navigate = useNavigate(); // <--- ADD THIS
    const [logs, setLogs] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Date Filters (Default to April 2026 based on your system context)
    const [month, setMonth] = useState('4'); 
    const [year, setYear] = useState('2026');
    const [isAdvanced, setIsAdvanced] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Converts the backend UTC string back into a clean local time string
    const formatLogTime = (isoString) => {
        if (!isoString) return '-';
        const dateObj = new Date(isoString);
        // 'sv-SE' perfectly formats it as 'YYYY-MM-DD HH:mm:ss'
        return dateObj.toLocaleString('sv-SE').replace(',', '');
    };

    // --- Fetch Logic ---
    const fetchLogs = useCallback(async () => {
        try {
            const token = localStorage.getItem('user_token');
            const params = { search: searchQuery };

            if (isAdvanced) {
                params.startDate = startDate;
                params.endDate = endDate;
            } else {
                params.month = month;
                params.year = year;
            }

            const response = await axios.get("http://localhost:8002/part/getWH2AuditLogs", {
                params,
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.data.success) {
                setLogs(response.data.logs);
            }
        } catch (error) {
            console.error("Error fetching audit logs:", error);
        }
    }, [searchQuery, month, year, isAdvanced, startDate, endDate]);

    // Fetch data whenever filters change
    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    // --- UI Helpers ---
    // 1. Color code the actions
    const getActionBadge = (action) => {
        switch(action) {
            case 'CREATE': return <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold tracking-wider">CREATE</span>;
            case 'UPDATE': return <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold tracking-wider">UPDATE</span>;
            case 'DELETE': return <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold tracking-wider">DELETE</span>;
            default: return <span>{action}</span>;
        }
    };

    // 2. Parse the MariaDB text string back into a JSON object to display the cards
    const renderDetailsCard = (detailsString) => {
        try {
            const details = JSON.parse(detailsString);
            return (
                <div className="bg-white border border-slate-200 rounded-md shadow-sm p-3 min-w-[200px]">
                    <div className="font-bold text-slate-700 text-sm mb-2 border-b pb-1">{details.area}</div>
                    
                    <div className="text-xs text-slate-500 space-y-1">
                        <div className="flex justify-between items-center gap-4">
                            <span>Temp:</span>
                            <span>
                                {details.temperature.old !== null ? <span className="line-through text-red-400 mr-1">{details.temperature.old}</span> : ''} 
                                {details.temperature.old !== null && details.temperature.new !== null ? ' → ' : ''}
                                {details.temperature.new !== null ? <span className="font-bold text-indigo-600 ml-1">{details.temperature.new}</span> : ''}
                            </span>
                        </div>
                        <div className="flex justify-between items-center gap-4">
                            <span>Hum:</span>
                            <span>
                                {details.humidity.old !== null ? <span className="line-through text-red-400 mr-1">{details.humidity.old}</span> : ''} 
                                {details.humidity.old !== null && details.humidity.new !== null ? ' → ' : ''}
                                {details.humidity.new !== null ? <span className="font-bold text-sky-500 ml-1">{details.humidity.new}</span> : ''}
                            </span>
                        </div>
                    </div>
                </div>
            );
        } catch (e) {
            return <span className="text-red-500 text-xs">Error parsing data</span>;
        }
    };

    // --- Format Timestamps ---
    const formatEpoch = (epoch) => {
        const d = new Date(epoch * 1000);
        return d.toLocaleString('sv-SE').replace(',', ''); // Output: 2026-04-01 15:00:00
    };

    const exportToPDF = () => {
        if (logs.length === 0) {
            alert("No logs available to export.");
            return;
        }

        const doc = new jsPDF('landscape'); // Landscape is better for wide tables
        
        // Add a Title
        doc.setFontSize(18);
        doc.text("Warehouse 2 Audit Logs", 14, 22);
        
        // Add the subtitle/date generated
        doc.setFontSize(11);
        doc.setTextColor(100);
        const today = new Date().toLocaleString('sv-SE').replace(',', '');
        doc.text(`Generated: ${today}`, 14, 30);

        // Define the columns
        const tableColumn = ["Log ID", "Log Time", "Employee", "Action", "Target Data Time", "Details"];
        
        // Map the logs array into rows for the PDF
        const tableRows = logs.map(log => {
            // Format the details column cleanly for the PDF
            let detailsText = log.details;
            try {
                const parsed = JSON.parse(log.details);
                const tempChange = `Temp: ${parsed.temperature.old !== null ? parsed.temperature.old : '-'} -> ${parsed.temperature.new !== null ? parsed.temperature.new : '-'}`;
                const humChange = `Hum: ${parsed.humidity.old !== null ? parsed.humidity.old : '-'} -> ${parsed.humidity.new !== null ? parsed.humidity.new : '-'}`;
                detailsText = `${parsed.area}\n${tempChange}\n${humChange}`;
            } catch (e) {
                // If parsing fails (like for a CREATE or DELETE action that might have a different format), leave as is
            }

            return [
                `#${log.log_id}`,
                formatLogTime(log.action_timestamp),
                log.user_name,
                log.action_type,
                formatEpoch(log.target_timestamp), // Re-using your existing formatEpoch function
                detailsText
            ];
        });

        // Generate the table
        autoTable(doc, {                 // <--- Pass 'doc' as the first argument
            head: [tableColumn],
            body: tableRows,
            startY: 40,
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [79, 70, 229] },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                5: { cellWidth: 80 } 
            }
        });

        // Save the file
        doc.save(`WH2_Audit_Logs_${today.split(' ')[0]}.pdf`);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
            <div className="mb-6">
                <button 
                    onClick={() => navigate(-1)} // '-1' acts exactly like the browser's back button
                    className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    BACK TO DASHBOARD
                </button>
            </div>
            
            {/* --- HEADER --- */}
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Warehouse 2 Audit Logs</h1>
                    <p className="text-sm text-slate-500 mt-1">Track all manual data entries, updates, and deletions.</p>
                </div>
                
                {/* --- ADD THE EXPORT BUTTON HERE --- */}
                <div>
                    <button 
                        onClick={exportToPDF}
                        disabled={logs.length === 0}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm uppercase tracking-wider px-6 py-2.5 rounded-md transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        Export to PDF
                    </button>
                </div>
            </div>

            

            {/* --- CONTROLS SECTION --- */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                
                {/* 1. Search Bar */}
                <div className="mb-6">
                    <input 
                        type="text" 
                        placeholder="Search by Employee or Action (e.g., UPDATE)..." 
                        className="w-full md:w-1/2 px-4 py-2 border border-slate-300 rounded-md outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* 2. Date Pickers & Toggle */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-4 border-t border-slate-100">
                    
                    <div className="flex items-center gap-4">
                        {!isAdvanced ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-bold text-slate-500">Month:</label>
                                    <select value={month} onChange={(e) => setMonth(e.target.value)} className="border border-slate-300 rounded px-3 py-1.5 text-sm outline-none">
                                        <option value="1">January</option>
                                        <option value="2">February</option>
                                        <option value="3">March</option>
                                        <option value="4">April</option>
                                        <option value="5">May</option>
                                        {/* Add rest of months */}
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-bold text-slate-500">Year:</label>
                                    <select value={year} onChange={(e) => setYear(e.target.value)} className="border border-slate-300 rounded px-3 py-1.5 text-sm outline-none">
                                        <option value="2025">2025</option>
                                        <option value="2026">2026</option>
                                        <option value="2027">2027</option>
                                    </select>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-bold text-slate-500">Range:</label>
                                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border border-slate-300 rounded px-3 py-1 text-sm outline-none"/>
                                <span className="text-slate-400">-</span>
                                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border border-slate-300 rounded px-3 py-1 text-sm outline-none"/>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <input 
                            type="checkbox" 
                            id="advancedToggle" 
                            checked={isAdvanced} 
                            onChange={(e) => setIsAdvanced(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                        />
                        <label htmlFor="advancedToggle" className="text-sm font-bold text-slate-700 cursor-pointer">Advanced Date Range</label>
                    </div>
                </div>
            </div>

            {/* --- TABLE SECTION --- */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-max">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Log ID</th>
                                <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Log Time</th>
                                <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Employee</th>
                                <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                                <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Target Data Time</th>
                                <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-slate-400 font-medium">No audit logs found for this period.</td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.log_id} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-4 px-6 text-sm font-bold text-slate-700">#{log.log_id}</td>
                                        {/* Removing the 'T' and '.000Z' from the SQL Timestamp */}
                                        <td className="py-4 px-6 text-sm font-medium text-slate-500">
                {formatLogTime(log.action_timestamp)}
            </td>
                                        <td className="py-4 px-6 text-sm font-extrabold text-slate-800">{log.user_name}</td>
                                        <td className="py-4 px-6">{getActionBadge(log.action_type)}</td>
                                        <td className="py-4 px-6 text-sm text-indigo-600 font-medium">{formatEpoch(log.target_timestamp)}</td>
                                        <td className="py-4 px-6">
                                            {renderDetailsCard(log.details)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default WH2AuditLogs;