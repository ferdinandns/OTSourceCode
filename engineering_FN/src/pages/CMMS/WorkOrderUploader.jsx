import React, { useState } from 'react';
import './NewTechnicianPage.css'; // Make sure your CSS file is imported!

const WorkOrderUploader = ({ onUploadComplete }) => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [status, setStatus] = useState({ loading: false, message: '', type: '' });

    const handleFileChange = (e) => {
        if (!e.target || !e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];

        if (!file.name.toLowerCase().endsWith('.pdf')) {
            setStatus({ loading: false, message: 'Please select a valid PDF file.', type: 'error' });
            setSelectedFile(null);
            setPreviewData(null);
            return;
        }
        setSelectedFile(file);
        setPreviewData(null);
        setStatus({ loading: false, message: `Loaded: "${file.name}"`, type: 'info' });
    };

    const handleGetPreview = async () => {
        if (!selectedFile) return;
        setStatus({ loading: true, message: 'Extracting data from PDF for preview...', type: 'info' });
        
        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const response = await fetch('http://10.126.15.197:8002/part/preview-pdf', {
                method: 'POST',
                body: formData
            });

            if (response.status === 400) {
                const rawText = await response.text();
                throw new Error(`Server validation rejected: ${rawText}`);
            }

            const result = await response.json();
            if (response.ok) {
                setPreviewData(result);
                setStatus({ loading: false, message: `Preview Generated Successfully!`, type: 'success' });
            } else {
                throw new Error(result.error || 'Failed to extract text data streams.');
            }
        } catch (err) {
            setStatus({ loading: false, message: `Preview Error: ${err.message}`, type: 'error' });
        }
    };

    const handleConfirmSync = async () => {
        if (!previewData) return;

        // Un-nest the payload array to ensure the backend receives a flat array
        let finalArray = [];
        if (previewData.workOrders) {
            if (previewData.workOrders.workOrders && Array.isArray(previewData.workOrders.workOrders)) {
                finalArray = previewData.workOrders.workOrders;
            } else if (Array.isArray(previewData.workOrders)) {
                finalArray = previewData.workOrders;
            } else if (typeof previewData.workOrders === 'object') {
                finalArray = previewData.workOrders.workOrders || [];
            }
        } else if (Array.isArray(previewData)) {
            finalArray = previewData;
        }

        const finalSourceFile = previewData.sourceFile || 
                               (previewData.workOrders && previewData.workOrders.sourceFile) || 
                               selectedFile?.name || 
                               "Unknown_File.pdf";

        const cleanPayload = {
            workOrders: finalArray,
            sourceFile: String(finalSourceFile)
        };

        setStatus({ loading: true, message: 'Committing Work Orders to database...', type: 'info' });

        try {
            const response = await fetch('http://10.126.15.197:8002/part/confirm-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cleanPayload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Server rejected sync (${response.status}): ${errText}`);
            }

            const result = await response.json();
            if (result.success) {
                setStatus({ loading: false, message: `🎉 ${result.message}`, type: 'success' });
                setPreviewData(null);
                setSelectedFile(null);
                if (onUploadComplete) onUploadComplete();
            }
        } catch (err) {
            setStatus({ loading: false, message: `Database Sync Error: ${err.message}`, type: 'error' });
        }
    };

   return (
        // 1. PADDING FIX: Adjusted padding specifically for this component 
        // We use 30px top, 40px right, 60px bottom, 40px left to pull it away from the sidebar
        <div className="wo-container" style={{ width: '100%', padding: '30px 40px 60px 40px', minHeight: 'auto', boxSizing: 'border-box' }}>
            
            {/* Header Section */}
            <div className="wo-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: 'none' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '600', color: 'var(--text-main)' }}>
                        PM Work Order Parser
                    </h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        Upload maintenance packages to preview machine assignments prior to scheduling.
                    </p>
                </div>
            </div>

            {/* Interactive Dropzone */}
            <div style={{ 
                border: '2px dashed var(--border-color)', 
                borderRadius: '12px', 
                backgroundColor: 'var(--element-bg)', 
                padding: '40px 24px', 
                textAlign: 'center', 
                marginBottom: '24px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                transition: 'background-color 0.3s, border-color 0.3s'
            }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📁</div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-main)' }}>
                    {selectedFile ? `Selected File: ${selectedFile.name}` : "Upload Maintenance Package Document"}
                </h4>
                <p style={{ margin: '0 0 24px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Only text-based PM Work Order PDF files are supported
                </p>
                
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'center' }}>
                    <label 
                        style={{ 
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', margin: 0, 
                            padding: '12px 24px', fontWeight: '600', fontSize: '0.9rem', borderRadius: '6px',
                            backgroundColor: 'var(--accent-blue)', 
                            color: '#ffffff', 
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)', transition: 'background-color 0.2s'
                        }}
                    >
                        Choose PDF File
                        <input type="file" accept=".pdf" onChange={handleFileChange} disabled={status.loading} style={{ display: 'none' }} />
                    </label>

                    {selectedFile && !previewData && (
                        <button 
                            onClick={handleGetPreview} disabled={status.loading}
                            style={{ 
                                margin: 0, padding: '12px 24px', border: 'none', fontWeight: '600', fontSize: '0.9rem', borderRadius: '6px',
                                backgroundColor: 'var(--accent-blue)', filter: 'brightness(1.1)', 
                                color: '#ffffff', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                        >
                            {status.loading ? 'Extracting Data...' : 'Extract Data'}
                        </button>
                    )}
                </div>
            </div>

            {/* Status Alerts */}
            {status.message && (
                <div style={{ 
                    padding: '12px 16px', marginBottom: '24px', borderRadius: '6px', fontSize: '0.9rem', fontWeight: '500',
                    backgroundColor: 'var(--element-bg)',
                    color: status.type === 'error' ? '#ef4444' : status.type === 'success' ? '#22c55e' : 'var(--accent-blue)',
                    border: `1px solid ${status.type === 'error' ? '#ef4444' : status.type === 'success' ? '#22c55e' : 'var(--accent-blue)'}`
                }}>
                    {status.message}
                </div>
            )}

            {/* --- COMPLETE REVIEW INTERFACE SECTION --- */}
            {previewData && (
                <div style={{ marginTop: '32px' }}>
                    <div style={{ 
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px',
                        borderBottom: '2px solid var(--border-color)' 
                    }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-main)' }}>
                                Parsed Work Orders Preview
                            </h3>
                            {/* 2. THE RENDER LIMIT NOTE: Show user we found 100, but only display 10 */}
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                Displaying 10 of {(previewData.workOrders || previewData).length} total extracted schedules for validation.
                            </p>
                        </div>
                        <button
                            onClick={handleConfirmSync} disabled={status.loading}
                            style={{ 
                                margin: 0, padding: '10px 24px', border: 'none', fontWeight: '600', borderRadius: '6px', cursor: 'pointer',
                                backgroundColor: '#166534', color: '#ffffff', flexShrink: 0
                            }}
                        >
                            {status.loading ? 'Syncing...' : '✓ Confirm & Sync All to Database'}
                        </button>
                    </div>

                    {/* 3. THE SCROLLBAR FIX: Wrap the entire card list in a restricted-height overflow container */}
                    <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '20px', 
                        maxHeight: '600px', // Restricts how tall the box can get
                        overflowY: 'auto',  // Turns on vertical scrolling if it overflows
                        paddingRight: '10px' // Leaves a tiny bit of space for the scrollbar
                    }}>
                        {/* 4. THE LIMIT FIX: .slice(0, 10) prevents React from struggling to map 200 items at once! */}
                        {(previewData.workOrders || previewData).slice(0, 10).map((wo, idx) => (
                            <div key={idx} style={{ 
                                backgroundColor: 'var(--element-bg)', 
                                border: '1px solid var(--border-color)', 
                                borderRadius: '8px', padding: '20px', 
                                transition: 'background-color 0.3s, border-color 0.3s'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--accent-blue)' }}>
                                            {wo.PWO_Number || wo.pwo_number}
                                        </span>
                                        <span className="wo-badge">
                                            {wo.Area || wo.area || 'Unknown'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        <strong>Target Execution Schedule:</strong> {wo.Schedule_Date || wo.schedule_date}
                                    </div>
                                </div>

                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>Machine / Description</div>
                                    <div style={{ color: 'var(--text-main)', fontWeight: '500', fontSize: '1rem' }}>
                                        <code style={{ backgroundColor: 'var(--hover-bg)', padding: '2px 6px', borderRadius: '4px', marginRight: '8px', color: 'var(--text-main)' }}>
                                            {wo.Asset_Number || wo.asset_number}
                                        </code> 
                                        — {wo.Description || wo.description}
                                    </div>
                                </div>
                                
                                <details style={{ width: '100%' }}>
                                    <summary style={{ cursor: 'pointer', color: 'var(--accent-blue)', fontSize: '0.85rem', fontWeight: '600', width: 'fit-content', outline: 'none' }}>
                                        View Extracted Maintenance Steps ({wo.Operations ? wo.Operations.length : 0} tasks)
                                    </summary>
                                    
                                    <div className="wo-table-wrapper" style={{ marginTop: '12px', maxHeight: '300px' }}>
                                        <table className="wo-table">
                                            <thead>
                                                <tr>
                                                    <th className="wo-th" style={{ width: '80px' }}>Step</th>
                                                    <th className="wo-th">Task Description / Requirement Standard</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {wo.Operations && wo.Operations.map((op, oIdx) => (
                                                    <tr key={oIdx} className="wo-tr-hover">
                                                        <td className="wo-td" style={{ fontWeight: 'bold', color: 'var(--text-muted)' }}>{op.Step}</td>
                                                        <td className="wo-td" style={{ color: 'var(--text-main)' }}>{op.Task}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </details>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkOrderUploader;