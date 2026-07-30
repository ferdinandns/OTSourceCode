import React, { useState, useEffect } from 'react';
import VibrationChart from './VibrationChart';

export default function Level4({ startDate, endDate, fetchTrigger }) {
  const [zAxisData, setZAxisData] = useState(null);
  const [xAxisData, setXAxisData] = useState(null);
  const [diagnosticData, setDiagnosticData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Safety check: Prevents the API from firing on the initial page load

    const fetchDiagnostics = async () => {
      setLoading(true);
      try {
        const timeRange = {
          start: startDate.replace('T', ' ') + ':00',
          finish: endDate.replace('T', ' ') + ':59'
        };

        const queryZ = new URLSearchParams({ ...timeRange, axis: 'Z-Axis' }).toString();
        const queryX = new URLSearchParams({ ...timeRange, axis: 'X-Axis' }).toString();

        const [responseZ, responseX] = await Promise.all([
          fetch(`http://10.126.15.197:8002/part/getVibrationData?${queryZ}`),
          fetch(`http://10.126.15.197:8002/part/getVibrationData?${queryX}`)
        ]);

        const resultZ = await responseZ.json();
        const resultX = await responseX.json();

        // 1. Save raw data for the charts
        setZAxisData(resultZ.data);
        setXAxisData(resultX.data);

        // 2. Helper function to build table rows and assign color-coded status
        const buildRow = (paramName, key, warnLimit, dangerLimit) => {
          const zMax = parseFloat(resultZ.stats?.[key]?.max || 0);
          const xMax = parseFloat(resultX.stats?.[key]?.max || 0);
          
          // Find the worst-case scenario between the two axes
          const worstMax = Math.max(zMax, xMax);

          const getStatus = (val) => {
            if (val >= dangerLimit) return { label: 'DANGER', color: '#ef4444' };
            if (val >= warnLimit) return { label: 'WARNING', color: '#f59e0b' };
            return { label: 'HEALTHY', color: '#10b981' };
          };

          return { 
            param: paramName, 
            valX: xMax, 
            valZ: zMax, 
            worst: worstMax,
            status: getStatus(worstMax) 
          };
        };

        // Standard Thresholds (Adjust these limits based on your specific baseline)
        const rows = [
          buildRow('RMS Velocity', 'rms_velocity', 4.5, 7.1),
          buildRow('Peak Velocity', 'peak_velocity', 8.0, 12.0),
          buildRow('RMS Acceleration', 'rms_accel', 0.3, 0.5),
          buildRow('HF RMS', 'hf_rms_accel', 1.5, 3.0),
          buildRow('Crest Factor', 'crest_factor', 5.0, 10.0)
        ];

        setDiagnosticData(rows);
      } catch (error) {
        console.error("Fetch Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDiagnostics();
  }, [fetchTrigger, startDate, endDate]);

  return (
    <div className="level-container">
      <h3 className="level-title">DIAGNOSA</h3>
      
      {loading ? (
        <div className="card placeholder-card">Running system diagnostics...</div>
      ) : (
        <>
          {/* 1. The Frequency Charts (Indigo) */}
          <VibrationChart 
            title="Z-Axis Peak Velocity Component Frequency (Hz)" 
            data={zAxisData?.peak_vel_freq} 
            color="#4f46e5" 
          />
          <VibrationChart 
            title="X-Axis Peak Velocity Component Frequency (Hz)" 
            data={xAxisData?.peak_vel_freq} 
            color="#4f46e5" 
          />

          {/* 2. The Cross-Reference Table */}
          <div className="card" style={{ padding: '24px', overflowX: 'auto', marginTop: '16px' }}>
            {diagnosticData.length === 0 ? (
              <div className="placeholder-card" style={{ boxShadow: 'none', color: 'var(--text-muted)' }}>
                No data available. Adjust dates and click CARI DATA.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '13px' }}>
                    <th style={{ padding: '12px' }}>Parameter</th>
                    <th style={{ padding: '12px' }}>X</th>
                    <th style={{ padding: '12px' }}>Z</th>
                    <th style={{ padding: '12px' }}>Worst</th>
                    <th style={{ padding: '12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {diagnosticData.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '16px 12px', fontWeight: '500', color: 'var(--text-main)' }}>{row.param}</td>
                      <td style={{ padding: '16px 12px', color: 'var(--text-muted)' }}>{row.valX.toFixed(2)}</td>
                      <td style={{ padding: '16px 12px', color: 'var(--text-muted)' }}>{row.valZ.toFixed(2)}</td>
                      <td style={{ padding: '16px 12px', fontWeight: '700', color: 'var(--text-main)' }}>
                        {row.worst.toFixed(2)}
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        {/* A clean, simple dot to match your mockup design exactly */}
                        <span 
                          style={{ 
                            display: 'inline-block',
                            width: '12px', 
                            height: '12px', 
                            borderRadius: '50%', 
                            backgroundColor: row.status.color,
                            boxShadow: `0 0 8px ${row.status.color}80`
                          }} 
                          title={row.status.label}
                        ></span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}