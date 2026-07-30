import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './SparepartLogs.css'; 

const SparepartLogs = () => {
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    

    const currentDate = new Date();
    const currentMonthString = String(currentDate.getMonth() + 1).padStart(2, '0'); // Outputs: "05"
    const currentYearString = String(currentDate.getFullYear()); // Outputs: "2026"

    // --- State Declarations ---
    const [selectedMonth, setSelectedMonth] = useState(currentMonthString);
    const [selectedYear, setSelectedYear] = useState(currentYearString);
    const [isDateRangeActive, setIsDateRangeActive] = useState(false);
    
    // Advanced Date State values
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const getToken = () => localStorage.getItem('token'); 

    // --- Fetch Logs From API ---
    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('http://10.126.15.197:8002/part/SparepartgetInventoryLogs', {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                setLogs(data);
            } else {
                console.error("Failed to fetch logs from server");
            }
        } catch (error) {
            console.error("Error connecting to logs endpoint:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    // --- Advanced Filter Engine ---
    const filteredLogs = logs.filter((log) => {
        // --- 1. SEARCH FILTER ---
        let matchesSearch = true;
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            matchesSearch = 
                (log.Part_Name && log.Part_Name.toLowerCase().includes(searchLower)) ||
                (log.Changed_By && log.Changed_By.toLowerCase().includes(searchLower)) ||
                (log.Change_Type && log.Change_Type.toLowerCase().includes(searchLower)) ||
                (log.Log_ID && String(log.Log_ID).includes(searchLower));
        }

        // --- 2. DATE FILTER ---
        let matchesDate = false;
        
        // Safely extract "YYYY-MM-DD" from your timestamp field (Changed_At)
        const logDateString = log.Changed_At ? log.Changed_At.split('T')[0] : '';
        const logYear = logDateString.substring(0, 4);  // "YYYY"
        const logMonth = logDateString.substring(5, 7); // "MM"

        if (isDateRangeActive) {
            // ADVANCED MODE: Evaluates string boundaries between inputs
            if (!startDate || !endDate) {
                matchesDate = true; 
            } else {
                matchesDate = logDateString >= startDate && logDateString <= endDate;
            }
        } else {
            // BASIC MODE: Validates dropdown selections matching "YYYY" and "MM"
            matchesDate = (logYear === selectedYear) && (logMonth === selectedMonth);
        }

        return matchesSearch && matchesDate;
    });

    // Helper to render action badge colors dynamically
    const getActionBadgeStyle = (type) => {
        const base = { padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', display: 'inline-block' };
        if (type === 'CREATE') return { ...base, backgroundColor: '#dcfce7', color: '#15803d' };
        if (type === 'DELETE') return { ...base, backgroundColor: '#fee2e2', color: '#b91c1c' };
        return { ...base, backgroundColor: '#e0f2fe', color: '#0369a1' }; // UPDATE
    };

    return (
        <div className="audit-container">
            
            {/* Header Area */}
            <div className="header-section">
                {/* REPLACED: Changed onClick window action to a clean React Router Link */}
                <Link to="/SparepartDashboard" className="back-btn" style={{ textDecoration: 'none' }}>
                    &larr; Back to Dashboard
                </Link>
                <h2 style={{ marginTop: '16px', marginBottom: '4px', color: 'var(--text-main)' }}>Non-Inventory Audit Logs</h2>
                <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem' }}>
                    Track all row-level component adjustments, creations, and removals.
                </p>
            </div>

            {/* Search Input Control */}
            <div className="controls-section">
                <input 
                    type="text" 
                    className="search-input"
                    placeholder="Search by Part Name, Action Type, or Operator..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Date Filters Controller Block */}
            <div className="controls-section" style={{ 
                alignItems: 'center', 
                padding: '12px 16px', 
                border: '1px solid var(--border-color)', 
                borderRadius: '8px', 
                backgroundColor: 'var(--element-bg)',
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px'
            }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    
                    {/* Basic Dropdowns (Hidden/Disabled when Advanced Range is Checked) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="filter-label">Month:</span>
                        <select 
                            className="date-select"
                            value={selectedMonth} 
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            disabled={isDateRangeActive}
                        >
                            <option value="01">January</option>
                            <option value="02">February</option>
                            <option value="03">March</option>
                            <option value="04">April</option>
                            <option value="05">May</option>
                            <option value="06">June</option>
                            <option value="07">July</option>
                            <option value="08">August</option>
                            <option value="09">September</option>
                            <option value="10">October</option>
                            <option value="11">November</option>
                            <option value="12">December</option>
                        </select>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="filter-label">Year:</span>
                        <select 
                            className="date-select"
                            value={selectedYear} 
                            onChange={(e) => setSelectedYear(e.target.value)}
                            disabled={isDateRangeActive}
                        >
                            <option value="2025">2025</option>
                            <option value="2026">2026</option>
                            <option value="2027">2027</option>
                        </select>
                    </div>

                    {/* ADVANCED CALENDAR INPUTS */}
                    {isDateRangeActive && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '8px' }}>
                            <div className="filter-group">
                                <span className="filter-label">Start:</span>
                                <input 
                                    type="date" 
                                    className="date-input" 
                                    value={startDate} 
                                    onChange={(e) => setStartDate(e.target.value)} 
                                />
                            </div>
                            <div className="filter-group">
                                <span className="filter-label">End:</span>
                                <input 
                                    type="date" 
                                    className="date-input" 
                                    value={endDate} 
                                    onChange={(e) => setEndDate(e.target.value)} 
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Advanced Date Checkbox Toggle */}
                <div className="toggle-wrapper" style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
                    <input 
                        type="checkbox" 
                        id="advanced-date-checkbox" 
                        className="toggle-checkbox"
                        checked={isDateRangeActive}
                        onChange={(e) => setIsDateRangeActive(e.target.checked)}
                    />
                    <label htmlFor="advanced-date-checkbox" className="filter-label" style={{ cursor: 'pointer', userSelect: 'none' }}>
                        Advanced Date Range
                    </label>
                </div>
            </div>

            {/* Structured Table UI */}
            <div className="table-wrapper">
                <table className="audit-table">
                    <thead>
                        <tr>
                            <th>Log ID</th>
                            <th>Date & Time</th>
                            <th>Action By</th>
                            <th>Part Name</th>
                            <th>Action Type</th>
                            <th>Quantity Mutation</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="6" className="empty-state">Loading inventory logs...</td></tr>
                        ) : filteredLogs.length === 0 ? (
                            <tr><td colSpan="6" className="empty-state">No matching log historical data found.</td></tr>
                        ) : (
                            filteredLogs.map((log) => (
                                <tr key={log.Log_ID}>
                                    <td style={{ fontWeight: 'bold' }}>#{log.Log_ID}</td>
                                    <td style={{ color: 'var(--text-muted)' }}>
                                        {log.Changed_At ? new Date(log.Changed_At).toLocaleString() : '-'}
                                    </td>
                                    <td style={{ fontWeight: '600' }}>{log.Changed_By}</td>
                                    <td style={{ maxWidth: '350px', wordBreak: 'break-word' }}>{log.Part_Name}</td>
                                    <td>
                                        <span style={getActionBadgeStyle(log.Change_Type)}>
                                            {log.Change_Type}
                                        </span>
                                    </td>
                                    <td>
                                        {/* Dynamic Quantity Delta Formatter */}
                                        {log.Change_Type === 'CREATE' && (
                                            <span style={{ color: '#16a34a', fontWeight: '600' }}>+{log.New_Quantity}</span>
                                        )}
                                        {log.Change_Type === 'DELETE' && (
                                            <span style={{ color: '#dc2626', fontWeight: '600' }}>Removed ({log.Old_Quantity})</span>
                                        )}
                                        {log.Change_Type === 'UPDATE' && (
                                            <span style={{ color: 'var(--text-main)' }}>
                                                {log.Old_Quantity} &rarr; <strong style={{ color: 'var(--accent-blue)' }}>{log.New_Quantity}</strong>
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
};

export default SparepartLogs;