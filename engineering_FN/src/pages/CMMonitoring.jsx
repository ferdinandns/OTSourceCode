import React, { useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ReferenceLine, ResponsiveContainer 
} from 'recharts';

// --- Dummy Data Setup ---
const initialVibrationData = [
  { time: '08:00', x_vibration: 2.1, y_vibration: 1.8, z_vibration: 2.5, temp: 45 },
  { time: '09:00', x_vibration: 2.3, y_vibration: 1.9, z_vibration: 2.7, temp: 46 },
  { time: '10:00', x_vibration: 2.5, y_vibration: 2.1, z_vibration: 3.1, temp: 48 },
  { time: '11:00', x_vibration: 4.2, y_vibration: 3.8, z_vibration: 4.5, temp: 55 }, 
  { time: '12:00', x_vibration: 2.8, y_vibration: 2.2, z_vibration: 3.0, temp: 47 },
];

const runningHoursData = [
  { part: 'Main Belt', runtime: 1850, limit: 2000 },
  { part: 'Side Belt', runtime: 800, limit: 1000 },
];

const initialLogs = [
  { id: 1, partName: 'Main Belt', action: 'Lubricate', registeredBy: 'Tech A', remarks: 'Squeaking noise reported during startup.', datetime: '2026-02-25 08:30:00' },
  { id: 2, partName: 'Machine CM1', action: 'Check', registeredBy: 'Tech B', remarks: 'High Z-axis vibration at 11 AM. Investigating bearings.', datetime: '2026-02-26 11:15:00' }
];

export default function CMMonitoring() {
  const [logs, setLogs] = useState(initialLogs);
  const [formData, setFormData] = useState({
    partName: 'Main Belt',
    action: 'Check',
    registeredBy: '',
    remarks: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Create formatted DATETIME string (YYYY-MM-DD HH:mm:ss)
    const now = new Date();
    const formattedDateTime = 
      now.getFullYear() + '-' + 
      String(now.getMonth() + 1).padStart(2, '0') + '-' + 
      String(now.getDate()).padStart(2, '0') + ' ' + 
      String(now.getHours()).padStart(2, '0') + ':' + 
      String(now.getMinutes()).padStart(2, '0') + ':' + 
      String(now.getSeconds()).padStart(2, '0');

    const newLog = {
      id: logs.length + 1,
      partName: formData.partName,
      action: formData.action,
      registeredBy: formData.registeredBy,
      remarks: formData.remarks,
      datetime: formattedDateTime 
    };
    
    setLogs([newLog, ...logs]); 
    setFormData({ partName: 'Main Belt', action: 'Check', registeredBy: '', remarks: '' });
  };

  // Custom Tooltip for Recharts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-time">{`Time: ${label}`}</p>
          {payload.map((entry, index) => (
            <p key={`item-${index}`} style={{ color: entry.color, margin: 0, fontSize: '13px', fontWeight: 500 }}>
              {`${entry.name}: ${entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="cm-dashboard">
      <style>{`
        .cm-dashboard {
          padding: 30px;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          background-color: #f1f5f9;
          min-height: 100vh;
          color: #1e293b;
        }
        .header {
          margin-bottom: 30px;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 15px;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.5px;
        }
        .header p {
          margin: 5px 0 0 0;
          color: #64748b;
          font-size: 14px;
        }
        .grid-top {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }
        .grid-bottom {
          display: grid;
          /* WIDENED FORM: Changed from 300px to 400px */
          grid-template-columns: 400px 1fr; 
          gap: 24px;
        }
        .card {
          background-color: #ffffff;
          padding: 24px;
          border-radius: 16px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
          border: 1px solid #e2e8f0;
        }
        .card-title {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 16px 0;
          color: #334155;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .badge {
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .badge-replace { background: #fee2e2; color: #b91c1c; }
        .badge-lubricate { background: #fef3c7; color: #d97706; }
        .badge-check { background: #e0f2fe; color: #0369a1; }
        
        /* Form Styles */
        .form-group { margin-bottom: 16px; }
        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 6px;
          color: #475569;
        }
        .form-input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 14px;
          color: #1e293b;
          background-color: #f8fafc;
          transition: all 0.2s;
          box-sizing: border-box;
        }
        .form-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          background-color: #ffffff;
        }
        .btn-submit {
          width: 100%;
          padding: 12px;
          background-color: #2563eb;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .btn-submit:hover { background-color: #1d4ed8; }
        
        /* Table Styles */
        .log-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .log-table th {
          padding: 12px 16px;
          background-color: #f8fafc;
          border-bottom: 2px solid #e2e8f0;
          color: #64748b;
          font-size: 13px;
          font-weight: 600;
        }
        .log-table td {
          padding: 14px 16px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 14px;
          color: #334155;
        }
        .log-table tr:hover td { background-color: #f8fafc; }

        /* Custom Progress Bar Styles */
        .progress-item { margin-bottom: 24px; }
        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 8px;
        }
        .progress-track {
          width: 100%;
          height: 12px;
          background-color: #e2e8f0;
          border-radius: 999px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          border-radius: 999px;
          transition: width 0.5s ease-in-out;
        }

        .custom-tooltip {
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          padding: 12px;
          border-radius: 8px;
        }
        .tooltip-time {
          margin: 0 0 8px 0;
          font-size: 12px;
          color: #64748b;
          font-weight: 600;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 4px;
        }
      `}</style>

      <div className="header">
        <h1>Machine CM1 Health Dashboard</h1>
        <p>Real-time vibration monitoring and part lifecycle management</p>
      </div>

      <div className="grid-top">
        {/* 1. Machine Vibration Chart */}
        <div className="card">
          <h3 className="card-title">
            Vibration & Temperature
            <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#ef4444', backgroundColor: '#fee2e2', padding: '4px 8px', borderRadius: '12px' }}>
              Danger Threshold: 4.0 mm/s
            </span>
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={initialVibrationData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
              
              <ReferenceLine y={4.0} yAxisId="left" stroke="#ef4444" strokeDasharray="4 4" strokeWidth={2} />
              
              <Line yAxisId="left" type="monotone" dataKey="x_vibration" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="X-Axis (mm/s)" />
              <Line yAxisId="left" type="monotone" dataKey="y_vibration" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Y-Axis (mm/s)" />
              <Line yAxisId="left" type="monotone" dataKey="z_vibration" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Z-Axis (mm/s)" />
              <Line yAxisId="right" type="monotone" dataKey="temp" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Temp (°C)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 2. Horizontal Running Hours Chart */}
        <div className="card">
          <h3 className="card-title">Lifecycle: Running Hours</h3>
          <div style={{ marginTop: '20px' }}>
            {runningHoursData.map((data, index) => {
              // Calculate percentage for the width
              const percentage = Math.min((data.runtime / data.limit) * 100, 100).toFixed(1);
              // Dynamic color: Red if over 90%, otherwise standard blue
              const isWarning = percentage >= 90;
              
              return (
                <div key={index} className="progress-item">
                  <div className="progress-header">
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{data.part}</span>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>
                      <strong style={{ color: isWarning ? '#ef4444' : '#1e293b', fontSize: '15px' }}>
                        {percentage}%
                      </strong>
                      {' '} ({data.runtime} / {data.limit} hrs)
                    </span>
                  </div>
                  <div className="progress-track">
                    <div 
                      className="progress-fill" 
                      style={{ 
                        width: `${percentage}%`, 
                        backgroundColor: isWarning ? '#ef4444' : '#3b82f6' 
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid-bottom">
        {/* 3. Action Registration Form */}
        <div className="card">
          <h3 className="card-title">Register Action</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Target Part</label>
              <select className="form-input" name="partName" value={formData.partName} onChange={handleInputChange}>
                <option value="Machine CM1">Overall Machine CM1</option>
                <option value="Main Belt">Main Belt</option>
                <option value="Side Belt">Side Belt</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Action Type</label>
              <select className="form-input" name="action" value={formData.action} onChange={handleInputChange}>
                <option value="Check">Check</option>
                <option value="Lubricate">Lubricate</option>
                <option value="Replace">Replace</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Technician Name</label>
              <input className="form-input" type="text" name="registeredBy" value={formData.registeredBy} onChange={handleInputChange} required placeholder="e.g. John Doe" />
            </div>

            <div className="form-group">
              <label className="form-label">Findings / Remarks</label>
              <textarea className="form-input" name="remarks" value={formData.remarks} onChange={handleInputChange} required placeholder="Describe the issue..." style={{ minHeight: '80px', resize: 'vertical' }} />
            </div>

            <button type="submit" className="btn-submit">Submit Record</button>
          </form>
        </div>

        {/* 4. Historical Logs Table */}
        <div className="card" style={{ overflowX: 'auto' }}>
          <h3 className="card-title">Maintenance History</h3>
          <table className="log-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Target Part</th>
                <th>Action Taken</th>
                <th>Technician</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  {/* Now displaying full DATETIME */}
                  <td style={{ color: '#64748b', fontSize: '13px', whiteSpace: 'nowrap' }}>{log.datetime}</td>
                  <td style={{ fontWeight: 500 }}>{log.partName}</td>
                  <td>
                    <span className={`badge badge-${log.action.toLowerCase()}`}>
                      {log.action}
                    </span>
                  </td>
                  <td>{log.registeredBy}</td>
                  <td style={{ color: '#475569', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={log.remarks}>
                    {log.remarks}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}