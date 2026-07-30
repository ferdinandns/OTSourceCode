import React, { useState, useEffect } from 'react';
import './SparepartLogs.css';
import { useNavigate } from 'react-router-dom';

const SparepartLogs = () => {
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    // 1. Get real-time current date
    const currentDate = new Date();
    const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0'); // e.g., "04"
    const currentYear = String(currentDate.getFullYear()); // e.g., "2026"

    // 2. State for Basic Filters
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [selectedYear, setSelectedYear] = useState(currentYear);

    // 3. State for Advanced Date Range
    const [isDateRangeActive, setIsDateRangeActive] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // --- NEW EDIT STATE ---
    const [isGlobalEditMode, setIsGlobalEditMode] = useState(false);
    const [editingRowId, setEditingRowId] = useState(null);
    const [editFormData, setEditFormData] = useState({
        Employee_Name: '',
        Work_Order_Number: '',
        Description: ''
    });

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                // Ensure this matches the route you set up in Express!
                const response = await fetch('http://10.126.15.197:8002/part/GetSparepartLogs');
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                setLogs(data);
            } catch (err) {
                console.error("Failed to fetch sparepart logs:", err);
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchLogs();
    }, []);

    // --- DEEP SEARCH FILTER LOGIC ---
    const filteredLogs = logs.filter((log) => {
        // --- 1. SEARCH FILTER ---
        let matchesSearch = true;
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            const matchesTopLevel = 
                (log.Employee_Name && log.Employee_Name.toLowerCase().includes(searchLower)) ||
                (log.Work_Order_Number && log.Work_Order_Number.toLowerCase().includes(searchLower)) ||
                (log.Description && log.Description.toLowerCase().includes(searchLower));

            const matchesItems = log.Items_Taken && log.Items_Taken.some(item => 
                (item.part_number && item.part_number.toLowerCase().includes(searchLower)) ||
                (item.part_description && item.part_description.toLowerCase().includes(searchLower))
            );
            matchesSearch = matchesTopLevel || matchesItems;
        }

        // --- 2. DATE FILTER ---
        let matchesDate = false;
        
        // Extract just the "YYYY-MM-DD" part and "YYYY" / "MM" safely
        const logDateString = log.Log_Date ? log.Log_Date.split(' ')[0] : '';
        const logYear = logDateString.substring(0, 4);
        const logMonth = logDateString.substring(5, 7);

        if (isDateRangeActive) {
            // ADVANCED MODE: Check if it falls between Start and End dates
            // If the user activated the toggle but left a box blank, we just show everything
            if (!startDate || !endDate) {
                matchesDate = true; 
            } else {
                matchesDate = logDateString >= startDate && logDateString <= endDate;
            }
        } else {
            // BASIC MODE: Check if it matches the dropdowns
            matchesDate = (logYear === selectedYear) && (logMonth === selectedMonth);
        }

        // Row must pass BOTH the search bar AND the date filter to be shown
        return matchesSearch && matchesDate;
    });


    // --- EDIT HANDLERS ---
    const handleEditClick = (log) => {
        setEditingRowId(log.Log_ID);
        setEditFormData({
            Employee_Name: log.Employee_Name || '',
            Work_Order_Number: log.Work_Order_Number || '',
            Description: log.Description || ''
        });
    };

    const handleCancelEdit = () => {
        setEditingRowId(null);
    };

    const handleSaveEdit = async (logId) => {
        try {
            const response = await fetch(`http://10.126.15.197:8002/part/updateSparepartLog/${logId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editFormData)
            });

            if (!response.ok) throw new Error('Failed to update');

            // Update the local state so the table refreshes without reloading the page
            setLogs(logs.map(log => 
                log.Log_ID === logId 
                ? { ...log, ...editFormData } 
                : log
            ));
            
            setEditingRowId(null); // Close the edit row
        } catch (error) {
            console.error("Error saving edit:", error);
            alert("Failed to save changes.");
        }
    };

    return (
        <div className="audit-container wo-container">
            <div className="header-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                {/* LEFT SIDE: Back Button & Titles */}
                <div>
                    <button onClick={() => navigate(-1)} className="back-btn">
                        ← Back to Dashboard
                    </button>
                    <h2 style={{ margin: '16px 0 0 0' }}>Sparepart Audit Logs</h2>
                    <p style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '0.9rem' }}>
                        Track all sparepart checkouts and inventory reductions.
                    </p>
                </div>

                {/* RIGHT SIDE: Admin Toggle */}
                <button 
                    className={`edit-mode-toggle ${isGlobalEditMode ? 'active' : ''}`}
                    onClick={() => {
                        setIsGlobalEditMode(!isGlobalEditMode);
                        setEditingRowId(null);
                    }}
                >
                    {isGlobalEditMode ? 'Exit Admin Edit Mode' : '🔒 Enable Edit Mode'}
                </button>
            </div>
            

            <div className="controls-section">
                <input 
                    type="text" 
                    placeholder="Search by Employee, Work Order, or Part Number..." 
                    className="search-input"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="date-filters-container">
                
                {/* 1. Basic Month/Year Dropdowns (Disabled if Range is active) */}
                <div className="filter-group">
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

                <div className="filter-group">
                    <span className="filter-label">Year:</span>
                    <select 
                        className="date-select" 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(e.target.value)}
                        disabled={isDateRangeActive}
                    >
                        {/* Add years based on when your plant started using the system */}
                        <option value="2025">2025</option>
                        <option value="2026">2026</option>
                        <option value="2027">2027</option>
                    </select>
                </div>

                {/* 2. Advanced Date Range Toggle */}
                <div className="toggle-wrapper">
                    <input 
                        type="checkbox" 
                        id="rangeToggle" 
                        className="toggle-checkbox"
                        checked={isDateRangeActive}
                        onChange={(e) => setIsDateRangeActive(e.target.checked)}
                    />
                    <label htmlFor="rangeToggle" className="filter-label" style={{ cursor: 'pointer', color: 'var(--text-main)' }}>
                        Advanced Date Range
                    </label>
                </div>

                {/* 3. The Custom Date Range Inputs (Only visible/usable when active) */}
                {isDateRangeActive && (
                    <>
                        <div className="filter-group">
                            <span className="filter-label">From:</span>
                            <input 
                                type="date" 
                                className="date-input" 
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="filter-group">
                            <span className="filter-label">To:</span>
                            <input 
                                type="date" 
                                className="date-input" 
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </>
                )}
            </div>
            
            <div className="table-wrapper">
                <table className="audit-table">
                    <thead>
                        <tr>
                            <th style={{ width: '80px' }}>Log ID</th>
                            <th style={{ width: '180px' }}>Date & Time</th>
                            <th style={{ width: '200px' }}>Employee</th>
                            <th style={{ width: '150px' }}>Division</th>
                            <th style={{ width: '150px' }}>Work Order</th>
                            <th style={{ width: '250px' }}>Reason / Description</th>
                            <th>Parts Taken</th>
                            {/* Conditionally show Actions header */}
                        </tr>
                    </thead>
                    <tbody>
                       {filteredLogs.length === 0 ? (
                            <tr>
                                <td colSpan={isGlobalEditMode ? 7 : 6} className="empty-state">
                                    No audit logs match your search criteria.
                                </td>
                            </tr>
                        ) : (
                            filteredLogs.map((log) => {
                                const isEditing = editingRowId === log.Log_ID;

                                return (
                                    <tr key={log.Log_ID}>
                                        
                                        {/* COLUMN 1: LOG ID (With inline Edit buttons) */}
                                        <td style={{ verticalAlign: 'top' }}>
                                            <strong>#{log.Log_ID}</strong>
                                            {isGlobalEditMode && (
                                                <div style={{ marginTop: '12px' }}>
                                                    {isEditing ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                            <button className="action-btn save-btn" onClick={() => handleSaveEdit(log.Log_ID)}>Save</button>
                                                            <button className="action-btn cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                                                        </div>
                                                    ) : (
                                                        <button className="inline-edit-btn" onClick={() => handleEditClick(log)}>✏️ Edit</button>
                                                    )}
                                                </div>
                                            )}
                                        </td>

                                        {/* COLUMN 2: DATE & TIME (Read Only) */}
                                        <td style={{ color: 'var(--text-muted)' }}>{log.Log_Date}</td>
                                        
                                        {/* COLUMN 3: EMPLOYEE NAME */}
                                        <td>
                                            {isEditing ? (
                                                <input 
                                                    type="text" 
                                                    className="table-input"
                                                    value={editFormData.Employee_Name}
                                                    onChange={(e) => setEditFormData({...editFormData, Employee_Name: e.target.value})}
                                                />
                                            ) : (
                                                <strong>{log.Employee_Name}</strong>
                                            )}
                                        </td>
                                        <td>
                                            {isEditing ? (
                                                <select 
                                                    className="table-input"
                                                    value={editFormData.Division || ''}
                                                    onChange={(e) => setEditFormData({...editFormData, Division: e.target.value})}
                                                >
                                                   <option value="" disabled>Select Division...</option>
                                                    <option value="Imecon">Imecon</option>
                                                    <option value="Maintenance">Maintenance</option>
                                                    <option value="Utility">Utility</option>
                                                    <option value="Production">Production</option>
                                                    <option value="Intern">Intern</option>
                                                </select>
                                            ) : (
                                                log.Division ? <strong>{log.Division}</strong> : <span style={{ color: 'var(--text-muted)' }}>-</span>
                                            )}
                                        </td>

                                        {/* COLUMN 4: WORK ORDER NUMBER */}
                                        <td>
                                            {isEditing ? (
                                                <input 
                                                    type="text" 
                                                    className="table-input"
                                                    value={editFormData.Work_Order_Number}
                                                    onChange={(e) => setEditFormData({...editFormData, Work_Order_Number: e.target.value})}
                                                />
                                            ) : (
                                                log.Work_Order_Number ? (
                                                    <span style={{ color: 'var(--accent-blue)' }}>{log.Work_Order_Number}</span>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)' }}>-</span>
                                                )
                                            )}
                                        </td>

                                        {/* COLUMN 5: DESCRIPTION */}
                                        <td>
                                            {isEditing ? (
                                                <input 
                                                    type="text" 
                                                    className="table-input"
                                                    value={editFormData.Description}
                                                    onChange={(e) => setEditFormData({...editFormData, Description: e.target.value})}
                                                />
                                            ) : (
                                                log.Description ? (
                                                    <span style={{ fontSize: '0.9rem', lineHeight: '1.4', display: 'block' }}>
                                                        {log.Description}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)' }}>-</span>
                                                )
                                            )}
                                        </td>

                                        {/* COLUMN 6: ITEMS TAKEN (Un-editable) */}
                                        <td>
                                            <div className="nested-items-container">
                                                {log.Items_Taken && log.Items_Taken.length > 0 ? (
                                                    log.Items_Taken.map((item, index) => (
                                                        <div key={index} className="nested-item">
                                                            <div className="nested-item-header">
                                                                <span>{item.part_number}</span>
                                                                <span className="qty-badge">Qty: {item.qty}</span>
                                                            </div>
                                                            <div className="nested-item-desc">
                                                                {item.part_description}
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)' }}>No items logged.</span>
                                                )}
                                            </div>
                                        </td>
                                        
                                        {/* Notice: No 7th column here! */}

                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SparepartLogs;