import React, { useState, useEffect } from 'react';
import './SparepartDashboard.css'; 
import { useNavigate } from 'react-router-dom';
import MapLightbox from './LightboxMapping';
import * as XLSX from 'xlsx';



const NonInventoryDashboard = () => {
    const [parts, setParts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showReorderOnly, setShowReorderOnly] = useState(false);

    const navigate = useNavigate();
    
    // NEW: State for the active tab
    const [activeTab, setActiveTab] = useState('All');
    
    const [isLoading, setIsLoading] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingPartId, setEditingPartId] = useState(null);
    const [addFormData, setAddFormData] = useState({ Part_Name: '', Quantity: 0, Unit: 'PCS', Rack: '', Shelf_Location: '' });
    const [editFormData, setEditFormData] = useState({});

    const [isMapOpen, setIsMapOpen] = useState(false);

    const currentUser = 'Admin'; 

    // --- Tab Configuration ---
    // The 'value' should match exactly what is stored in your database for the Rack column
    const tabsList = [
        { label: 'All Items', value: 'All' },
        { label: 'Rack A', value: 'A' },
        { label: 'Rack B', value: 'B' },
        { label: 'Rack C', value: 'C' },
        { label: 'Rack D', value: 'D' },
        { label: 'Rack E', value: 'E' },
        { label: 'BLD', value: 'BLD' }
    ];

    // Helper function to grab the token
    const getToken = () => localStorage.getItem('user_token'); // Change this if you store it differently

    // --- API CALLS ---
    const fetchParts = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('http://10.126.15.197:8002/part/SparepartgetAllParts', {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            }); 
            if (!response.ok) throw new Error("Failed to fetch data");
            const data = await response.json();
            setParts(data);
        } catch (error) {
            console.error("Error fetching parts:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchParts();
    }, []);

    const handleCreatePart = async () => {
        if (!addFormData.Part_Name) return alert("Part Name is required");
        try {
            const response = await fetch('http://10.126.15.197:8002/part/SparepartcreatePart', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify(addFormData) // Removed username, backend handles it!
            });
            if (!response.ok) throw new Error("Failed to create part");
            alert("Part created successfully!");
            setShowAddForm(false);
            setAddFormData({ Part_Name: '', Quantity: 0, Unit: 'PCS', Rack: '', Shelf_Location: '' });
            fetchParts();
        } catch (error) {
            console.error("Error creating part:", error);
            alert("Failed to create part. You might not be authorized.");
        }
    };

    const handleSaveEdit = async (partId) => {
        try {
            const response = await fetch(`http://10.126.15.197:8002/part/SparepartupdatePart/${partId}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify(editFormData) // Removed username
            });
            if (!response.ok) throw new Error("Failed to update part");
            alert("Part updated successfully!");
            setEditingPartId(null);
            fetchParts();
        } catch (error) {
            console.error("Error updating part:", error);
            alert("Failed to update part. You might not be authorized.");
        }
    };

    const handleDeletePart = async (partId) => {
        if (!window.confirm("Are you sure you want to delete this part? This action will be logged.")) return;
        try {
            const response = await fetch(`http://10.126.15.197:8002/part/SparepartdeletePart/${partId}`, {
                method: 'DELETE',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                }
                // Removed body entirely since DELETE usually doesn't need one now
            });
            if (!response.ok) throw new Error("Failed to delete part");
            alert("Part deleted successfully!");
            fetchParts();
        } catch (error) {
            console.error("Error deleting part:", error);
            alert("Failed to delete part. You might not be authorized.");
        }
    };

    const handleViewLogs = async () => {
        try {
            const response = await fetch('http://10.126.15.197:8002/part/SparepartgetInventoryLogs', {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (response.ok) {
                const logs = await response.json();
                console.log("Audit Logs:", logs);
                alert("Logs fetched! Check browser console to view them."); 
            } else {
                alert("Failed to fetch logs. You might not be authorized.");
            }
        } catch (error) {
            console.error("Error fetching logs:", error);
        }
    };

    const handleEditClick = (part) => {
        setEditingPartId(part.Part_ID);
        setEditFormData({
            Part_Name: part.Part_Name,
            Quantity: part.Quantity,
            Unit: part.Unit,
            Rack: part.Rack,
            Shelf_Location: part.Shelf_Location
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
    // FIX 1: We are

    // --- ADVANCED FILTERING: Search + Reorder + Tabs ---
    const filteredParts = parts.filter(part => {
        // 1. Check Search Term
        const matchesSearch = part.Part_Name.toLowerCase().includes(searchTerm.toLowerCase());
        
        // 2. Check Reorder Toggle (If true, only return items where qty <= 0)
        const matchesReorder = showReorderOnly ? part.Quantity <= 0 : true;

        // 3. Check Active Tab (If 'All', ignore. Otherwise, check if Rack matches the tab value)
        const matchesTab = activeTab === 'All' ? true : part.Rack === activeTab;
        
        return matchesSearch && matchesReorder && matchesTab;
    });

    const handleExportNonInventoryExcel = () => {
        // 1. Format the data specifically for the Non-Inventory columns
        // Replace 'filteredNonInventoryParts' with whatever your state variable is called!
        const exportData = filteredParts.map(part => {
            // Assuming Reorder_Min is what you use for the "Min: 0" display
            const minStock = part.Reorder_Min || 0; 
            const isLowStock = part.Quantity <= minStock;
            
            return {
                // Check if your database calls this Part_Name, Item_Name, or just Name!
                "Part Name": part.Part_Name || part.Name, 
                "Current Stock": part.Quantity,
                // "Minimum Stock": minStock,
                // "Status": isLowStock ? "Needs Reorder" : "Stock OK",
                "Location": part.Shelf_Location || part.Part_Shelf_Location || "-",
                "Last Updated": part.Last_Date ? new Date(part.Last_Date).toLocaleString() : "-"
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData);

        const columnWidths = [
            { wch: 50 }, // Part Name (Made this wider since the names look long)
            { wch: 15 }, // Current Stock
           //  { wch: 15 }, // Minimum Stock
           // { wch: 15 }, // Status
            { wch: 25 }, // Location
            { wch: 22 }, // Last Updated
        ];
        worksheet['!cols'] = columnWidths;

        // 4. Create Workbook
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Non-Inventory");

        // 5. Generate the timestamped file name
        const now = new Date();
        const datePart = now.toISOString().split('T')[0];
        const timePart = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        const fileName = `Non_Inventory_Export_${datePart}_${timePart}.xlsx`;

        // 6. Trigger Download
        XLSX.writeFile(workbook, fileName);
    };

    return (
        <div className="inventory-container">
            {/* Header Section */}
            <div className="header-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Non-Inventory Parts Overview</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="action-btn cancel-btn" onClick={() => setIsMapOpen(true)}>
                        Show Mapping
                    </button>
                    <button 
                        onClick={() => navigate('/sparepartnoninventorylogs')} 
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
        className="action-btn" 
        style={{ 
            backgroundColor: 'white', 
            color: '#10b981', 
            padding: '8px 16px', 
            border: '1px solid #10b981', 
            borderRadius: '4px', 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
        }}
        onClick={handleExportNonInventoryExcel}
    >
        <span>Export to Excel</span>
    </button>
                    <button className="action-btn save-btn" onClick={() => setShowAddForm(!showAddForm)}>
                        {showAddForm ? "Cancel Add" : "+ Add Item"}
                    </button>
                </div>
            </div>

            {/* NEW: Tabs Navigation */}
            <div className="tabs-container">
                {tabsList.map(tab => (
                    <button 
                        key={tab.value}
                        className={`tab-button ${activeTab === tab.value ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.value)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Search & Filters Controls */}
            <div className="controls-section" style={{ display: 'flex', alignItems: 'center' }}>
                <input 
                    type="text" 
                    className="search-input"
                    placeholder="Search by Part Name..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                
                <div className="reorder-toggle-wrapper">
                    <input 
                        type="checkbox" 
                        id="reorder-toggle"
                        className="reorder-checkbox"
                        checked={showReorderOnly}
                        onChange={(e) => setShowReorderOnly(e.target.checked)}
                    />
                    <label htmlFor="reorder-toggle" className="filter-label" style={{ color: '#ef4444', cursor: 'pointer' }}>
                        Show Reorder Items Only
                    </label>
                </div>
            </div>

            {/* Inline Add Form */}
            {showAddForm && (
                <div className="date-filters-container" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: '10px' }}>
                    <input className="table-input" placeholder="Part Name" value={addFormData.Part_Name} onChange={e => setAddFormData({...addFormData, Part_Name: e.target.value})} />
                    <input className="table-input" type="number" placeholder="Qty" value={addFormData.Quantity} onChange={e => setAddFormData({...addFormData, Quantity: e.target.value})} />
                    <input className="table-input" placeholder="Unit (PCS, PACK)" value={addFormData.Unit} onChange={e => setAddFormData({...addFormData, Unit: e.target.value})} />
                    <input className="table-input" placeholder="Rack (e.g. A)" value={addFormData.Rack} onChange={e => setAddFormData({...addFormData, Rack: e.target.value})} />
                    <input className="table-input" placeholder="Shelf (e.g. 1.1)" value={addFormData.Shelf_Location} onChange={e => setAddFormData({...addFormData, Shelf_Location: e.target.value})} />
                    <button className="action-btn save-btn" onClick={handleCreatePart}>Save</button>
                </div>
            )}

            {/* Table Area */}
            <div className="table-wrapper">
                <table className="inventory-table">
                    <thead>
                        <tr>
                            <th>Part Name</th>
                            <th>Availability</th>
                            <th>Location</th>
                            <th>Last Updated</th>
                            <th style={{ textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="5" style={{ textAlign: 'center' }}>Loading data...</td></tr>
                        ) : filteredParts.length === 0 ? (
                            <tr><td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No items found for the selected filters.</td></tr>
                        ) : (
                            filteredParts.map((part) => {
                                const isEditing = editingPartId === part.Part_ID;
                                const rowClass = part.Quantity <= 0 ? 'reorder-row' : '';

                                return isEditing ? (
                                    /* EDIT MODE ROW */
                                    <tr key={part.Part_ID}>
                                        <td>
                                            <input className="table-input" value={editFormData.Part_Name} onChange={e => setEditFormData({...editFormData, Part_Name: e.target.value})} />
                                        </td>
                                        
                                        <td>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <input className="table-input" type="number" style={{ width: '60%' }} value={editFormData.Quantity} onChange={e => setEditFormData({...editFormData, Quantity: e.target.value})} />
                                                <input className="table-input" placeholder="Unit" style={{ width: '40%' }} value={editFormData.Unit} onChange={e => setEditFormData({...editFormData, Unit: e.target.value})} />
                                            </div>
                                        </td>

                                        <td>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <input className="table-input" placeholder="Rack" style={{ width: '50%' }} value={editFormData.Rack} onChange={e => setEditFormData({...editFormData, Rack: e.target.value})} />
                                                <input className="table-input" placeholder="Shelf" style={{ width: '50%' }} value={editFormData.Shelf_Location} onChange={e => setEditFormData({...editFormData, Shelf_Location: e.target.value})} />
                                            </div>
                                        </td>
                                        
                                        <td style={{ verticalAlign: 'middle', color: '#64748b' }}>-</td>
                                        
                                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                            <button className="action-btn save-btn" onClick={() => handleSaveEdit(part.Part_ID)}>Save</button>
                                            <button className="action-btn cancel-btn" onClick={() => setEditingPartId(null)}>Cancel</button>
                                        </td>
                                    </tr>
                                ) : (
                                    /* VIEW MODE ROW */
                                    <tr key={part.Part_ID} className={rowClass}>
                                        <td style={{ fontWeight: 'bold' }}>{part.Part_Name}</td>
                                        
                                        <td>
                                            <div className={part.Quantity <= 0 ? 'stock-low' : 'stock-ok'}>
                                                {part.Quantity} {part.Unit}
                                            </div>
                                            <div className="description-subtext">Min: 0</div>
                                        </td>

                                        <td>Rack {part.Rack || '-'} ({part.Shelf_Location || '-'})</td>
                                        
                                        <td>{part.Last_Date ? new Date(part.Last_Date).toLocaleString() : '-'}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button className="action-btn edit-btn" style={{ marginRight: '8px' }} onClick={() => handleEditClick(part)}>Edit</button>
                                            <button className="action-btn edit-mode-toggle active" onClick={() => handleDeletePart(part.Part_ID)}>Delete</button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
             <MapLightbox 
                isOpen={isMapOpen} 
                onClose={() => setIsMapOpen(false)} 
                mapImages={sparepartMaps} 
            />
        </div>
    );
};

export default NonInventoryDashboard;