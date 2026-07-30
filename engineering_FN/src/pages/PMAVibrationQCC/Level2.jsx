import React, { useState, useEffect } from 'react';
import VibrationChart from './VibrationChart';

export default function Level2({ startDate, endDate, fetchTrigger }) {
  const [zAxisData, setZAxisData] = useState(null);
  const [xAxisData, setXAxisData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTelemetry = async () => {
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

        setZAxisData(resultZ.data);
        setXAxisData(resultX.data);
      } catch (error) {
        console.error("Fetch Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTelemetry();
  }, [fetchTrigger]);

  return (
    <div className="level-container">
      <h3 className="level-title">EARLY BEARING HEALTH DETECTION</h3>
      
      {loading ? (
        <div className="card placeholder-card">Loading bearing telemetry data...</div>
      ) : (
        <>
          {/* High-Frequency RMS Charts (Emerald Green) */}
          <VibrationChart 
            title="Z-Axis High-Frequency RMS Acceleration (G)" 
            data={zAxisData?.hf_rms_accel} 
            color="#10b981" 
          />
          <VibrationChart 
            title="X-Axis High-Frequency RMS Acceleration (G)" 
            data={xAxisData?.hf_rms_accel} 
            color="#10b981" 
          />

          {/* Crest Factor Charts (Purple) */}
          <VibrationChart 
            title="Z-Axis Crest Factor" 
            data={zAxisData?.crest_factor} 
            color="#8b5cf6" 
          />
          <VibrationChart 
            title="X-Axis Crest Factor" 
            data={xAxisData?.crest_factor} 
            color="#8b5cf6" 
          />
        </>
      )}
    </div>
  );
}