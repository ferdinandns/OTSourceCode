import React, { useState } from 'react';
import InventoryTable from './SparepartInventory'; 
import NonInventoryDashboard from './SparepartNonInventory'; 
import './SparepartDashboard.css'; // Make sure this points to your CSS file!

const SparepartDashboardWrapper = () => {
    const [activeTab, setActiveTab] = useState('inventory');

    return (
        <div className="dashboard-wrapper">
            
            {/* The Master Tabs UI */}
            <div className="master-tabs-container">
                <button 
                    className={`master-tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
                    onClick={() => setActiveTab('inventory')}
                >
                    Inventory Parts
                </button>
                <button 
                    className={`master-tab-btn ${activeTab === 'non-inventory' ? 'active' : ''}`}
                    onClick={() => setActiveTab('non-inventory')}
                >
                    Non-Inventory Parts
                </button>
            </div>

            {/* Conditional Rendering (The Switch) */}
            {activeTab === 'inventory' ? <InventoryTable /> : <NonInventoryDashboard />}

        </div>
    );
};

export default SparepartDashboardWrapper;