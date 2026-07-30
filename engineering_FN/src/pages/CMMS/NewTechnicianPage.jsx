import React, { useState, useEffect } from 'react';
import './NewTechnicianPage.css'; // <-- Import the new CSS file here

const WorkOrderDashboard = () => {
    const [workOrders, setWorkOrders] = useState([]);
    const [selectedPWO, setSelectedPWO] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState("Open"); // <-- NEW STATE
    const [completedFilter, setCompletedFilter] = useState("NotClosed"); // <-- NEW STATE

    const today = new Date();
    // getMonth() is 0-indexed (0=Jan, 3=Apr), so we add 1 and pad it to "04"
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0'); 
    const currentYear = String(today.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(currentMonth); // <-- Defaults to current month
    const [selectedYear, setSelectedYear] = useState(currentYear);

    useEffect(() => { fetchWorkOrders(); }, []);

    const years = Array.from(new Array(5), (val, index) => today.getFullYear() - 2 + index);

    const fetchWorkOrders = async () => {
        setLoading(true);
        try {
            const response = await fetch('http://10.126.15.197:8002/part/getWorkOrders'); 
            const data = await response.json();
            if (Array.isArray(data)) setWorkOrders(data);
            else setWorkOrders([]);
        } catch (error) {
            setWorkOrders([]);
        } finally {
            setLoading(false);
        }
    };

    const openWorkOrder = async (pwo_number) => {
        try {
            const response = await fetch(`http://10.126.15.197:8002/part/${pwo_number}`);
            const data = await response.json();
            if (!response.ok) return alert(`Error: ${data.message || 'Check console'}`);

            if (data.operations && typeof data.operations === 'string') data.operations = JSON.parse(data.operations);
            if (!data.operations || !Array.isArray(data.operations)) data.operations = []; 
            setSelectedPWO(data);
        } catch (error) {
            console.error("Failed to fetch PWO details:", error);
        }
    };

    const handleOperationChange = (index, field, value) => {
        const updatedOperations = [...selectedPWO.operations];
        updatedOperations[index][field] = value;
        setSelectedPWO({ ...selectedPWO, operations: updatedOperations });
    };

    const getLeadTechnician = (operationsData) => {
        if (!operationsData) return 'Not Assigned';
        
        try {
            let opsArray = operationsData;
            
            // Sometimes Node sends raw buffers over HTTP looking like { type: 'Buffer', data: [...] }
            if (opsArray.type === 'Buffer' && Array.isArray(opsArray.data)) {
                opsArray = String.fromCharCode(...opsArray.data);
            }
            
            // Parse it if it's a string
            if (typeof opsArray === 'string') {
                opsArray = JSON.parse(opsArray);
            }
            
            // Extract the first assigned technician
            if (Array.isArray(opsArray)) {
                const task = opsArray.find(op => op.Technician && String(op.Technician).trim() !== '');
                if (task) return String(task.Technician).trim();
            }
        } catch (error) {
            console.error("Frontend JSON Parse Error:", error);
        }
        
        return 'Not Assigned';
    };

    const saveWorkOrder = async () => {
        // --- NEW: STRICT FORM VALIDATION ---
        if (selectedPWO && selectedPWO.operations) {
            for (let i = 0; i < selectedPWO.operations.length; i++) {
                const op = selectedPWO.operations[i];
                
                // Safely grab the values and trim away empty spaces
                const tech = (op.Technician || op.technician || '').toString().trim();
                const start = (op.start_time || '').toString().trim();
                const end = (op.end_time || '').toString().trim();
                const note = (op.note || '').toString().trim();

                // If ANY of these four fields are empty, block the save!
                if (!tech || !start || !end || !note) {
                    // Alert the user exactly which step needs fixing
                    alert(`Submission Blocked 🛑\n\nPlease fill out all fields (Technician, Start Time, End Time, and Note) for Step ${op.Step || i + 1}.`);
                    return; // <--- This 'return' instantly stops the save process
                }
            }
        }
        // -----------------------------------

        setSaving(true);
        try {
            await fetch(`http://10.126.15.197:8002/part/${selectedPWO.pwo_number}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operations: selectedPWO.operations,
                    status: 'Completed'
                }),
            });
            
            setSelectedPWO(null);
            fetchWorkOrders();
        } catch (error) {
            console.error("Failed to save work order:", error);
            alert("Failed to communicate with server.");
        } finally {
            setSaving(false);
        }
    };

    const handleCloseWorkOrder = async (pwo_number, e) => {
        e.stopPropagation(); // Stops the row click from opening the form
        
        // Safety check to prevent accidental clicks
        if (!window.confirm(`Are you sure you want to close PWO ${pwo_number}?`)) {
            return;
        }

        try {
            await fetch(`http://10.126.15.197:8002/part/${pwo_number}/close`, {
                method: 'PUT'
            });
            
            // Instantly refresh the dashboard to move it out of the Pending Review tab
            fetchWorkOrders();
        } catch (error) {
            console.error("Failed to close work order:", error);
            alert("Failed to communicate with server.");
        }
    };

        const canFillAll = (field) => {
        if (!selectedPWO || !selectedPWO.operations || selectedPWO.operations.length === 0) return false;
        const firstRowValue = selectedPWO.operations[0][field];
        return firstRowValue && firstRowValue.trim() !== '';
    };

    const handleFillAll = (field) => {
        if (!canFillAll(field)) return;
        
        const firstRowValue = selectedPWO.operations[0][field];
        const updatedOperations = selectedPWO.operations.map(op => ({
            ...op,
            [field]: firstRowValue
        }));
        
        setSelectedPWO({ ...selectedPWO, operations: updatedOperations });
    };

    // --- FILTER LOGIC ---
    const workOrdersForMonth = (Array.isArray(workOrders) ? workOrders : []).filter(wo => {
        if (!wo.schedule_date) return false;
        
        const woDate = new Date(wo.schedule_date);
        const woYear = String(woDate.getFullYear());
        const woMonth = String(woDate.getMonth() + 1).padStart(2, '0');
        
        return woYear === String(selectedYear) && woMonth === String(selectedMonth);
    });

    // --- 2. CALCULATE METRICS ---
    const totalPWO = workOrdersForMonth.length;
    const completedCount = workOrdersForMonth.filter(wo => wo.status === 'Completed').length;
    const openCount = totalPWO - completedCount;

    // --- 3. FILTER BY TAB, SUB-TAB, AND SEARCH ---
    const filteredWorkOrders = workOrdersForMonth
        .filter(wo => {
            // If we are on the Open tab, just show non-completed jobs
            if (activeTab === 'Open') {
                return wo.status !== 'Completed';
            } 
            
            // If we are on the Completed tab...
            if (wo.status !== 'Completed') return false;
            
            // Handle the isClosed binary value (safely handling nulls or true/false)
            // TINYINT(1) in MariaDB usually comes through as 0 or 1
            const isClosedVal = wo.isClosed == 1 || wo.isClosed === true ? 1 : 0;
            
            if (completedFilter === 'NotClosed') {
                return isClosedVal === 0;
            } else {
                return isClosedVal === 1;
            }
        })
        .filter(wo => {
            const term = searchTerm.toLowerCase();
            return (
                (wo.pwo_number || '').toLowerCase().includes(term) ||
                (wo.asset_number || '').toLowerCase().includes(term) ||
                (wo.description || '').toLowerCase().includes(term)
            );
        });

    // --- RENDER: Detail View (Technician Form) ---
    if (selectedPWO) {
        return (
            <div className="wo-container">
                <div className="wo-header">
                    <h2>Executing: {selectedPWO.pwo_number}</h2>
                    <p>Asset: {selectedPWO.asset_number} | {selectedPWO.description}</p>
                </div>

                <div className="wo-table-wrapper">
                    <table className="wo-table">
                        <thead>
                            <tr>
                                <th className="wo-th">Step</th>
                                <th className="wo-th">Task / Item to Check</th>
                                
                                <th className="wo-th">
                                    Technician
                                    <button 
                                        className="wo-btn-fill" 
                                        onClick={() => handleFillAll('Technician')}
                                        disabled={!canFillAll('Technician')}
                                        title="Copy first row to all"
                                    >
                                        ↓ Fill All
                                    </button>
                                </th>
                                
                                <th className="wo-th">
                                    Start Time
                                    <button 
                                        className="wo-btn-fill" 
                                        onClick={() => handleFillAll('start_time')}
                                        disabled={!canFillAll('start_time')}
                                        title="Copy first row to all"
                                    >
                                        ↓ Fill All
                                    </button>
                                </th>
                                
                                <th className="wo-th">
                                    End Time
                                    <button 
                                        className="wo-btn-fill" 
                                        onClick={() => handleFillAll('end_time')}
                                        disabled={!canFillAll('end_time')}
                                        title="Copy first row to all"
                                    >
                                        ↓ Fill All
                                    </button>
                                </th>
                                
                                <th className="wo-th">Technician Note</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(selectedPWO.operations || []).map((op, index) => (
                                <tr key={index}>
                                    <td className="wo-td">{op.Step}</td>
                                    <td className="wo-td">{op.Task}</td>
                                    <td className="wo-td">
                                        <input className="wo-input" style={{width: '120px'}} type="text" placeholder="Tech ID"
                                            value={op.Technician || ''} onChange={(e) => handleOperationChange(index, 'Technician', e.target.value)} />
                                    </td>
                                    <td className="wo-td">
                                        <input className="wo-input" style={{width: '130px'}} type="datetime-local"
                                            value={op.start_time || ''} onChange={(e) => handleOperationChange(index, 'start_time', e.target.value)} />
                                    </td>
                                    <td className="wo-td">
                                        <input className="wo-input" style={{width: '130px'}} type="datetime-local"
                                            value={op.end_time || ''} onChange={(e) => handleOperationChange(index, 'end_time', e.target.value)} />
                                    </td>
                                    <td className="wo-td">
                                        <textarea className="wo-textarea" type="text" placeholder="Add Technician Notes"
                                            value={op.note || ''} onChange={(e) => handleOperationChange(index, 'note', e.target.value)} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                    <button className="wo-btn-cancel" onClick={() => setSelectedPWO(null)}>Cancel</button>
                    <button className="wo-btn-success" onClick={saveWorkOrder} disabled={saving}>
                        
                        {saving ? 'Saving...' : 'Complete & Submit Work Order'}
                    </button>
                </div>
            </div>
        );
    }

    // --- RENDER: List View (Dashboard) ---
    return (
<div className="wo-container">
            <div className="wo-header">
                <h1>{activeTab === 'Open' ? 'Open Maintenance Orders' : 'Completed Maintenance Orders'}</h1>
                <p>Select a PWO to {activeTab === 'Open' ? 'begin execution' : 'review or edit'}.</p>
            </div>

            {/* --- CONTROLS ROW (Tabs, Date Pickers, Search) --- */}
            <div className="wo-controls-row">
                
                {/* 1. Main Tabs */}
                <div className="wo-tabs-container">
                    <button 
                        className={`wo-tab-btn ${activeTab === 'Open' ? 'active' : ''}`}
                        onClick={() => setActiveTab('Open')}
                    >
                        Open PWO <span style={{ opacity: 0.8, fontSize: '0.85em', marginLeft: '4px' }}>{openCount}/{totalPWO}</span>
                    </button>
                    <button 
                        className={`wo-tab-btn ${activeTab === 'Completed' ? 'active' : ''}`}
                        onClick={() => {
                            setActiveTab('Completed');
                            setCompletedFilter('NotClosed'); // Reset to Not Closed when switching
                        }}
                    >
                        Completed PWO <span style={{ opacity: 0.8, fontSize: '0.85em', marginLeft: '4px' }}>{completedCount}/{totalPWO}</span>
                    </button>
                </div>

                {/* 2. Month & Year Pickers */}
                <div className="wo-date-picker">
                    <select 
                        className="wo-select"
                        value={selectedMonth} 
                        onChange={(e) => setSelectedMonth(e.target.value)}
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

                    <select 
                        className="wo-select"
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(e.target.value)}
                    >
                        {years.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>

                {/* 3. Search Bar */}
                <div className="wo-search-container">
                    <input 
                        type="text" 
                        className="wo-search-input"
                        placeholder="Search by PWO, Asset, or Description..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                {/* --- NEW: Sub-Tabs for Completed Status --- */}
                {activeTab === 'Completed' && (
                    <div className="wo-tabs-container">
                        <button 
                            className={`wo-tab-btn ${completedFilter === 'NotClosed' ? 'active' : ''}`}
                            onClick={() => setCompletedFilter('NotClosed')}
                        >
                            Pending Review
                        </button>
                        <button 
                            className={`wo-tab-btn ${completedFilter === 'Closed' ? 'active' : ''}`}
                            onClick={() => setCompletedFilter('Closed')}
                        >
                            Closed
                        </button>
                    </div>
                )}
            </div>

            

            {loading ? <p>Loading system data...</p> : (
                <div className="wo-table-wrapper">
                    <table className="wo-table">
                        <thead>
                            <tr>
                                <th className="wo-th">PWO Number</th>
                                <th className="wo-th">Schedule Date</th>
                                <th className="wo-th">Asset Number</th>
                                <th className="wo-th">Description</th>
                                {activeTab === 'Completed' && (<th className="wo-th">Technician</th>)}
                                <th className="wo-th">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredWorkOrders.length > 0 ? (
                                filteredWorkOrders.map((wo) => (
                                    <tr key={wo.pwo_number} className="wo-tr-hover" onClick={() => openWorkOrder(wo.pwo_number)}>
                                        <td className="wo-td"><strong>{wo.pwo_number}</strong></td>
                                        <td className="wo-td"><span className="wo-badge">{wo.schedule_date}</span></td>
                                        <td className="wo-td">{wo.asset_number}</td>
                                        <td className="wo-td" style={{ color: 'var(--text-muted)' }}>{wo.description || 'No Description'}</td>
                                        {/* Render the technician data using React's safe parser */}
                                        {activeTab === 'Completed' && (
                                            <td className="wo-td">
                                                <strong style={{ color: 'var(--accent-blue)' }}>
                                                    {getLeadTechnician(wo.operations)}
                                                </strong>
                                            </td>
                                        )}
                                        <td className="wo-td">
                                            {/* We use Flexbox to put the buttons side-by-side cleanly */}
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                
                                                <button className="wo-btn-primary">
                                                    {activeTab === 'Open' ? 'Execute' : 'Review'}
                                                </button>
                                                {activeTab === 'Completed' && completedFilter === 'NotClosed' && (
                                                    <button 
                                                        className="wo-btn-success"
                                                        style={{ padding: '8px 16px', margin: 0, backgroundColor: '#059669' }}
                                                        onClick={(e) => handleCloseWorkOrder(wo.pwo_number, e)}
                                                    >
                                                        Close
                                                    </button>
                                                )}

                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="wo-td" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                        No Open Work Orders match your search.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default WorkOrderDashboard;