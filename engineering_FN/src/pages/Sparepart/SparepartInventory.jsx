import React, { useState, useEffect, useRef } from 'react';
import './SparepartDashboard.css';
import { useNavigate } from 'react-router-dom';
import SparepartLogForm from './SparepartForm'; // Adjust path as needed
import Papa from 'papaparse';
import MapLightbox from './LightboxMapping'; // <-- NEW: Import the lightbox component
import { useSelector } from 'react-redux'; // Assuming you use Redux for user state
import * as XLSX from 'xlsx';

const InventoryTable = () => {
    const [parts, setParts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const navigate = useNavigate();
    const [isLogFormOpen, setIsLogFormOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [showReorderOnly, setShowReorderOnly] = useState(false); 
    const fileInputRef = useRef(null); // <-- NEW: Reference for the hidden file input
    const [showMapModal, setShowMapModal] = useState(false);
    const [isMapOpen, setIsMapOpen] = useState(false);

    // 1. Grab the user's department from your state management
        const [userDepartment, setUserDepartment] = useState('Unknown');
    const isSparepartDept = userDepartment === 'Sparepart';

    console.log("Current Department is:", userDepartment, "| Is Authorized?", isSparepartDept);

    // 2. Add state for inline editing
    const [editingPartId, setEditingPartId] = useState(null);
    const [editFormData, setEditFormData] = useState({ 
        Location: '', 
        Availability: '' 
    });

    useEffect(() => {
        // Step A: Let's see if the token actually exists under the name 'user_token'
        const rawToken = localStorage.getItem('user_token'); 
        console.log("Step A - Raw Token from Storage:", rawToken);

        if (!rawToken) {
            console.error("TOKEN MISSING: No item named 'user_token' found in localStorage.");
            // If you use a different name, try changing it to localStorage.getItem('accessToken')
            return; 
        }

        try {
            // Step B: Crack open the payload
            const base64Url = rawToken.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));

            const decodedToken = JSON.parse(jsonPayload);
            
            // Step C: Look at the exact payload
            console.log("Step C - Successfully Decoded Token:", decodedToken);
            
            // Step D: Set the state. Ensure 'department' is spelled exactly as it appears in Step C!
            setUserDepartment(decodedToken.department || 'Unknown');
            console.log("Step D - Department Set To:", decodedToken.department);
            
        } catch (error) {
            console.error("TOKEN CRASH: Failed to decode the token. Is it a valid JWT?", error);
        }
    }, []);




        const fetchInventory = async () => {
            try {
                const response = await fetch('http://10.126.15.197:8002/part/getInventoryParts'); 
                
                // --- NEW ERROR HANDLING LOGIC ---
                if (!response.ok) {
                    let serverErrorMessage = `HTTP status ${response.status}`;
                    try {
                        // Try to read the exact JSON error sent by Express
                        const errorData = await response.json(); 
                        // Grab the message whether your backend sends { error: "..." } or { message: "..." }
                        serverErrorMessage = errorData.error || errorData.message || JSON.stringify(errorData);
                    } catch (e) {
                        // If the backend sent pure text instead of JSON, read it here
                        serverErrorMessage = await response.text(); 
                    }
                    // Throw this detailed message down to the catch block
                    throw new Error(serverErrorMessage); 
                }

                const data = await response.json();
                setParts(data);
            } catch (err) {
                console.error("Failed to fetch parts:", err);
                // This now sets the detailed string into your UI
                setError(err.message); 
            } finally {
                setIsLoading(false);
            }
        };
        

    useEffect(() => {
        fetchInventory();
    }, []);

    const handleEditClick = (part) => {
        setEditingPartId(part.Part_Number);
        
        setEditFormData({
            Location: part.Part_Location || '', 
            Availability: part.Availability || ''
        });
    };

    // Triggered when the user clicks "Save"
    const handleSaveEdit = async (partNumber) => {
        try {
            // 1. Try to use the Redux token first. 
            // If it's empty, try grabbing it directly from localStorage.
            // (Make sure 'token' matches whatever you call it in your auth slice/storage!)
            const rawToken = localStorage.getItem('user_token'); 
            const activeToken = rawToken || localStorage.getItem('user_token');

            // 3. Stop the request if we still don't have a token
            if (!activeToken || activeToken === "null") {
                alert("Session expired or token missing. Please log out and log back in!");
                return;
            }

            // 4. Send the request with the guaranteed token
            const response = await fetch(`http://10.126.15.197:8002/part/InventoryupdatePart/${partNumber}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    // Use activeToken here!
                    'Authorization': `Bearer ${activeToken}` 
                },
                body: JSON.stringify({
                    Location: editFormData.Location,
                    Availability: editFormData.Availability
                })
            });

            if (!response.ok) throw new Error("Failed to update part");
            
            alert("Part updated successfully!");
            setEditingPartId(null);
            fetchInventory(); 
            
        } catch (error) {
            console.error("Error updating part:", error);
            alert("Failed to update part.");
        }
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setIsLoading(true);

        Papa.parse(file, {
            delimiter: ";", 
            skipEmptyLines: true,
            complete: async function(results) {
                const headerIndex = results.data.findIndex(row => row[0] && row[0].trim() === 'Part Number');
                
                if (headerIndex === -1) {
                    alert("Invalid CSV Format: Could not find the 'Part Number' header row.");
                    setIsLoading(false);
                    return;
                }

                const headers = results.data[headerIndex].map(h => h ? h.trim() : '');
                
                const idxPart = headers.indexOf('Part Number');
                const idxDesc = headers.indexOf('Part Description');
                const idxAvail = headers.indexOf('Availability');
                const idxMin = headers.indexOf('Re-Order Point Min');
                const idxMax = headers.indexOf('Re-Order Point Max');

                // PASTE IT RIGHT HERE!
                const parseNumber = (val) => {
                    if (val === undefined || val === null || val.trim() === '') return null;
                    const parsed = parseInt(val.replace(/,/g, ''), 10);
                    return isNaN(parsed) ? null : parsed;
                };

                const dataRows = results.data.slice(headerIndex + 1);
                const payload = [];

                dataRows.forEach(row => {
                    const partNumber = row[idxPart] ? row[idxPart].trim() : null;

                    // --- THE BOUNCER: STRICT VALIDATION ---
                    // 1. Must not be empty
                    // 2. Must not be the header text itself
                    // 3. Must not contain spaces or colons (blocks metadata like "Category : ")
                    if (
                        !partNumber || 
                        partNumber.toLowerCase().includes('part number') || 
                        partNumber.includes(' ') || 
                        partNumber.includes(':')
                    ) {
                        return; // Skip this garbage row entirely and move to the next one
                    }

                    // If it passed the bouncer, it's a real part number! Extract the rest:
                    const description = (idxDesc !== -1 && row[idxDesc] && row[idxDesc].trim() !== '') ? row[idxDesc].trim() : null;
                    const availability = idxAvail !== -1 ? parseNumber(row[idxAvail]) : null;
                    const reorderMin = idxMin !== -1 ? parseNumber(row[idxMin]) : null;
                    const reorderMax = idxMax !== -1 ? parseNumber(row[idxMax]) : null;

                    payload.push({
                        partNumber,
                        description,
                        availability,
                        reorderMin,
                        reorderMax
                    });
                });

                try {
                    const response = await fetch('http://10.126.15.197:8002/part/updateInventoryBatch', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ updates: payload })
                    });

                    if (!response.ok) {
                        const errData = await response.json();
                        throw new Error(errData.details || "Failed to update database.");
                    }
                    
                    alert("Inventory synced successfully!");
                    window.location.reload(); 

                } catch (err) {
                    console.error(err);
                    alert(`Error: ${err.message}`);
                } finally {
                    setIsLoading(false);
                    if (fileInputRef.current) fileInputRef.current.value = ""; 
                }
            }
        });
    };

    const sparepartMaps = [
    { id: 1, title: 'Layout Sparepart', src: '/SparepartMap/LAYOUT_SPAREPART.png' },
    { id: 2, title: 'Rack F1', src: '/SparepartMap/F1.png' },
    { id: 3, title: 'Rack F2', src: '/SparepartMap/F2.png' },
    { id: 4, title: 'Rack G1', src: '/SparepartMap/G1.png' },
    { id: 5, title: 'Rack G2', src: '/SparepartMap/G2.1.png' },
    { id: 6, title: 'Rack GEA', src: '/SparepartMap/G2.2.png' },
    { id: 7, title: 'Rack H1', src: '/SparepartMap/H1.png' },
    { id: 8, title: 'Rack H2', src: '/SparepartMap/H2.png' },
    { id: 9, title: 'Rack I1', src: '/SparepartMap/I1.png' },
    { id: 10, title: 'Rack I2', src: '/SparepartMap/I2.png' },
];
    // FIX 1: We are now declaring filteredParts using parts.filter()
    const filteredParts = parts.filter((part) => {
        // 1. Search Logic
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
            (part.Part_Number && part.Part_Number.toLowerCase().includes(searchLower)) ||
            (part.Part_Description && part.Part_Description.toLowerCase().includes(searchLower));

        // 2. Type Logic
        const matchesType = typeFilter === 'ALL' || part.Type === typeFilter;

        // 3. REORDER LOGIC (Strictly Less Than)
        const isReorder = part.Availability < part.Reorder_Min;
        
        // If the user checked the box, but this part is NOT a reorder part, drop it.
        if (showReorderOnly && !isReorder) {
            return false;
        }

        return matchesSearch && matchesType;
    });

    const handleExportExcel = () => {
        // 1. Format the data perfectly for Excel
        const exportData = filteredParts.map(part => {
            const isLowStock = part.Availability <= part.Reorder_Min;
            
            return {
                "Part Number": part.Part_Number,
                "Description": part.Part_Description,
                "Location": part.Part_Location || "-",
                "Type": part.Type || "-",
                "Current Stock": part.Availability,
                "Minimum Stock": part.Reorder_Min,
                "Status": isLowStock ? "Needs Reorder" : "Stock OK",
                // Format the date nicely for the spreadsheet
                "Last Updated": part.Last_Date ? new Date(part.Last_Date).toLocaleString() : "-"
            };
        });

        // 2. Convert the clean JSON array into an Excel Worksheet
        const worksheet = XLSX.utils.json_to_sheet(exportData);

        // Optional: Auto-size the columns to make the Excel file look professional immediately
        const columnWidths = [
            { wch: 15 }, // Part Number
            { wch: 45 }, // Description
            { wch: 25 }, // Location
            { wch: 10 }, // Type
            { wch: 12 }, // Current Stock
            { wch: 12 }, // Minimum Stock
            { wch: 15 }, // Status
            { wch: 20 }, // Last Updated
        ];
        worksheet['!cols'] = columnWidths;

        // 3. Create a new Workbook and append the Worksheet to it
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory Parts");

        const now = new Date();
        const datePart = now.toISOString().split('T')[0]; // Gets "YYYY-MM-DD"
        const timePart = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // Gets "HH-MM-SS"
        const fileName = `Inventory_Parts_Export_${datePart}_${timePart}.xlsx`;

        // 5. Trigger the download in the browser with the new dynamic name
        XLSX.writeFile(workbook, fileName);
    };

   return (
        <div className="inventory-container">
            
            {/* Added Flexbox here to align the title and the button perfectly on the same line */}
            <div className="header-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>Inventory Parts Overview</h2>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="action-btn cancel-btn" onClick={() => setIsMapOpen(true)}>
                        🗺️ Show Mapping
                    </button>
                    <button 
                        onClick={() => navigate('/sparepartlogs')} 
                        style={{
                            backgroundColor: 'var(--element-bg)',
                            color: 'var(--text-main)',
                            padding: '10px 20px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            cursor: 'pointer',
                            fontWeight: '600',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}
                    >
                        View Audit Logs
                    </button>
                    
                    <button 
                        onClick={() => setIsLogFormOpen(true)}
                        style={{
                            backgroundColor: 'var(--accent-blue)',
                            color: '#ffffff',
                            padding: '10px 20px',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: '600',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                    >
                        Log Sparepart Usage
                    </button>

                    {/* HIDDEN FILE INPUT */}
                    <input 
                        type="file" 
                        accept=".csv" 
                        ref={fileInputRef} 
                        style={{ display: 'none' }} 
                        onChange={handleFileUpload} 
                    />

                    <button 
        className="action-btn" 
        style={{ 
            backgroundColor: 'white', 
            color: '#10b981', // A nice Excel-like green
            padding: '8px 16px', 
            border: '1px solid #10b981', 
            borderRadius: '4px', 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
        }}
        onClick={handleExportExcel}
    >
        {/* Optional: Add an icon if you use a library like react-icons (e.g., <FaFileExcel />) */}
        <span>Export to Excel</span>
    </button>

                    {/* NEW UPLOAD BUTTON */}
                    <button 
                        onClick={() => fileInputRef.current.click()} 
                        style={{
                            backgroundColor: 'var(--element-bg)',
                            color: 'var(--text-main)',
                            padding: '10px 20px',
                            borderRadius: '6px',
                            border: '1px solid var(--accent-blue)',
                            cursor: 'pointer',
                            fontWeight: '600',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}
                    >
                        Upload CSV
                    </button>
                </div>
            </div>

            <div className="controls-section">
                <input 
                    type="text" 
                    placeholder="Search by Part Number or Description..." 
                    className="search-input"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                
                <select 
                    className="type-select"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                >
                    <option value="ALL">All Types</option>
                    <option value="MESIN">MESIN</option>
                    <option value="BUILDING">BUILDING</option>
                    <option value="UTILITY">UTILITY</option>
                </select>

                <div className="reorder-toggle-wrapper">
                    <input 
                        type="checkbox" 
                        id="reorderToggle" 
                        className="reorder-checkbox"
                        checked={showReorderOnly}
                        onChange={(e) => setShowReorderOnly(e.target.checked)}
                    />
                    <label htmlFor="reorderToggle" style={{ cursor: 'pointer', fontWeight: '600', color: '#ef4444' }}>
                        Show Reorder Items Only
                    </label>
                </div>
            </div>
                        
            {isLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Loading inventory data...
                </div>
            ) : error ? (
                <div style={{ 
                    backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                    border: '1px solid #ef4444', 
                    padding: '20px', 
                    borderRadius: '8px',
                    margin: '20px 0'
                }}>
                    <h3 style={{ color: '#ef4444', margin: '0 0 10px 0' }}>⚠️ Failed to Load Database</h3>
                    <p style={{ margin: '0 0 8px 0', fontWeight: '500', color: 'var(--text-main)' }}>
                        The server responded with the following error:
                    </p>
                    <code style={{ 
                        display: 'block', 
                        padding: '12px', 
                        backgroundColor: 'var(--main-bg)',
                        color: '#ef4444',
                        borderRadius: '6px',
                        fontFamily: 'monospace',
                        border: '1px solid rgba(239, 68, 68, 0.3)'
                    }}>
                        {error}
                    </code>
                </div>
            ) : (
                <div className="table-wrapper">
                    <table className="inventory-table">
                    <thead>
                        <tr>
                            <th>Part Number</th>
                            <th>Description</th>
                            <th>Location</th>
                            <th>Type</th>
                            <th>Availability</th>
                            <th>Last Updated</th>
                            
                            {/* The Actions Header */}
                            {isSparepartDept && (
                                <th style={{ textAlign: 'center', width: '120px' }}>Actions</th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredParts.map((part) => {
                            const isEditing = editingPartId === part.Part_Number;
                            // Calculate isReorder just like your old code did
                            const isReorder = part.Availability <= part.Reorder_Min; 

                            return (
                                <tr key={part.Part_Number} className={isReorder ? 'reorder-row' : ''}>
                                    
                                    {/* 1. Part Number */}
                                    <td><strong>{part.Part_Number}</strong></td>
                                    
                                    {/* 2. Description (Restored to your exact old code) */}
                                    <td>
                                        {part.Part_Description}
                                        {part.Description && (
                                            <div className="description-subtext">
                                                {part.Description}
                                            </div>
                                        )}
                                    </td>
                                    
                                    {/* 3. Location (Editable vs Static) */}
                                    <td>
                                        {isEditing ? (
                                            <input 
                                                className="table-input" 
                                                style={{ width: '100%', padding: '4px' }}
                                                value={editFormData.Location} 
                                                onChange={(e) => setEditFormData({...editFormData, Location: e.target.value})}
                                            />
                                        ) : (
                                            part.Part_Location || '-'
                                        )}
                                    </td>
                                    
                                    {/* 4. Type */}
                                    <td>{part.Type || '-'}</td>

                                    {/* 5. Availability (Editable vs Static) */}
                                    <td>
                                        {isEditing ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <input 
                                                    type="number"
                                                    className="table-input" 
                                                    style={{ width: '70px', padding: '4px' }}
                                                    value={editFormData.Availability} 
                                                    onChange={(e) => setEditFormData({...editFormData, Availability: e.target.value})}
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                {/* Restored to your exact span classes */}
                                                <span className={isReorder ? 'stock-low' : 'stock-ok'}>
                                                    {part.Availability}
                                                </span>
                                                <div className="description-subtext">Min: {part.Reorder_Min}</div>
                                            </>
                                        )}
                                    </td>
                                    
                                    {/* 6. Last Updated */}
                                    <td>{part.Last_Date ? new Date(part.Last_Date).toLocaleString() : '-'}</td>
                                    
                                    {/* 7. ACTIONS COLUMN (Only visible to Sparepart Dept) */}
                                    {isSparepartDept && (
                                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                            {isEditing ? (
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                    <button className="action-btn save-btn" onClick={() => handleSaveEdit(part.Part_Number)}>
                                                        Save
                                                    </button>
                                                    <button className="action-btn cancel-btn" onClick={() => setEditingPartId(null)}>
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <button className="action-btn edit-btn" onClick={() => handleEditClick(part)}>
                                                    Edit
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                </div>
            )}
            {/* When isLogFormOpen is true, this renders our popup over the table */}
            {isLogFormOpen && (
                <SparepartLogForm onClose={() => setIsLogFormOpen(false)} />
            )}

            <MapLightbox 
                isOpen={isMapOpen} 
                onClose={() => setIsMapOpen(false)} 
                mapImages={sparepartMaps} 
            />

        </div>
    )
}

export default InventoryTable;