import React, { useState } from 'react';
import './PmaDashboard.css';
import Level1 from './Level1';
import Level2 from './Level2';
import Level3 from './Level3';
import Level4 from './Level4';
import gearboxImage from '../../assets/gearbox.jpeg';

const PmaDashboard = () => {
  const [activeTab, setActiveTab] = useState('HOME');

  // Helper functions to get today's date formatted for HTML inputs
  const getTodayStart = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T00:00`;
  };

  const getTodayEnd = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T23:59`;
  };

  // 1. Initialize global date state dynamically to today
  const [startDate, setStartDate] = useState(getTodayStart());
  const [endDate, setEndDate] = useState(getTodayEnd());
  
  
  // 2. The Trigger State for the "CARI DATA" button
  const [fetchTrigger, setFetchTrigger] = useState(0);

  // Dummy data for HOME tab
  const homeData = {
    statusMesin: { label: 'HEALTHY', color: '#10b981' }, 
    statusVarilipSeal: { label: 'HEALTHY', color: '#10b981' },
    statusAutoLubricator: { label: 'HEALTHY', color: '#10b981' },
    healthScore: 97,
    runningHours: 5000,
    warning: 1,
    lastUpdate: '14-Jul-26'
  };

  // Modern Status Pill Component
  const StatusPill = ({ status }) => (
    <div className="status-pill">
      <span 
        className="status-dot" 
        style={{ backgroundColor: status.color }}
      ></span>
      <span className="status-label">{status.label}</span>
    </div>
  );

  

  return (
    <div className="log-form-container pma-dashboard-wrapper">
      
      {/* Top Header Card */}
      <div className="dashboard-header-card">
        <div>
          <h1 className="dashboard-title">Health Monitoring System</h1>
          <p className="dashboard-subtitle">Gearbox NORD SK9072 | High Shear Mixer PMA 800</p>
        </div>
      </div>

      {/* Modern Tab Bar */}
      <div className="dashboard-tabs">
        {['HOME', 'Lv 1', 'Lv 2', 'Lv 3', 'Lv 4'].map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'Home' && <span className="tab-icon">⌂</span>}
            {tab !== 'Home' && <span className="tab-icon"></span>}
            {tab}
          </button>
        ))}
      </div>

      {/* 3. The Global Control Bar with Button */}
      <div className="dashboard-controls card" style={{ marginBottom: '24px' }}>
        <div className="control-group">
          <label>Start Date</label>
          <input 
            type="datetime-local" 
            className="modern-input"
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)} 
          />
        </div>
        <div className="control-group">
          <label>End Date</label>
          <input 
            type="datetime-local" 
            className="modern-input"
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)} 
          />
        </div>
        <button 
          className="btn-primary" 
          onClick={() => setFetchTrigger(prev => prev + 1)}
          style={{ alignSelf: 'flex-end', padding: '10px 24px', height: '42px' }}
        >
          
        </button>
      </div>

      {/* Content Area */}
      <div className="dashboard-content">
        
        {activeTab === 'HOME' && (
          <div className="home-grid">
    
    {/* Left Column: Image Card */}
    <div className="card image-card" style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      padding: '20px',
      height: '400px' // Give it a fixed height to match the System Status card
    }}>
      <img 
        src={gearboxImage} 
        alt="Gearbox NORD SK9072" 
        style={{ 
          maxWidth: '100%', 
          maxHeight: '100%', 
          objectFit: 'contain' 
        }} 
      />
    </div>

            {/* Right Column: Metrics Card */}
            <div className="card metrics-card">
              <h3 className="card-title">System Status Overview</h3>
              <div className="metrics-list">
                <div className="metric-row">
                  <span className="metric-label">Status Mesin</span>
                  <StatusPill status={homeData.statusMesin} />
                </div>
                <div className="metric-row">
                  <span className="metric-label">Status Varilip Seal</span>
                  <StatusPill status={homeData.statusVarilipSeal} />
                </div>
                <div className="metric-row">
                  <span className="metric-label">Status Auto-lubricator</span>
                  <StatusPill status={homeData.statusAutoLubricator} />
                </div>
                <div className="metric-row">
                  <span className="metric-label">Health Score</span>
                  <span className="metric-value highlight">{homeData.healthScore} %</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Running Hours</span>
                  <span className="metric-value">{homeData.runningHours} hours</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Warning</span>
                  <span className="metric-value warning">{homeData.warning} alarm</span>
                </div>
                <div className="metric-row borderless">
                  <span className="metric-label">Last Update</span>
                  <span className="metric-value">{homeData.lastUpdate}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. Tab Routing with Props Passed Down */}
        {activeTab === 'Lv 1' && (
          <Level1 
            startDate={startDate} 
            endDate={endDate} 
            fetchTrigger={fetchTrigger} 
          />
        )}
        
        {/* Future Levels will receive the exact same props */}
        {activeTab === 'Lv 2' && (
          <Level2 startDate={startDate} endDate={endDate} fetchTrigger={fetchTrigger} />
        )}
        {activeTab === 'Lv 3' && (
          <Level3 startDate={startDate} endDate={endDate} fetchTrigger={fetchTrigger} />
        )}
        {activeTab === 'Lv 4' && (
          <Level4 startDate={startDate} endDate={endDate} fetchTrigger={fetchTrigger} />
        )}
      
      </div>
    </div>
  );
};

export default PmaDashboard;