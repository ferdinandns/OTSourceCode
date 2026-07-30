import React, { useState, useEffect } from 'react';
import VibrationChart from './VibrationChart';

export default function Level3({ startDate, endDate, fetchTrigger }) {
  const [zAxisData, setZAxisData] = useState(null);
  const [xAxisData, setXAxisData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Safety check: Prevents the API from firing on the initial page load

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
      <h3 className="level-title">EARLY GEAR HEALTH DETECTION</h3>
      
      {loading ? (
        <div className="card placeholder-card">Loading gear telemetry data...</div>
      ) : (
        <>
          {/* Kurtosis Charts (Amber) - Normal baseline is usually around 3.0 */}
          <VibrationChart 
            title="Z-Axis Kurtosis" 
            data={zAxisData?.kurtosis} 
            color="#f59e0b" 
          />
          <VibrationChart 
            title="X-Axis Kurtosis" 
            data={xAxisData?.kurtosis} 
            color="#f59e0b" 
          />

          {/* Peak Acceleration Charts (Rose) */}
          <VibrationChart 
            title="Z-Axis Peak Acceleration (G)" 
            data={zAxisData?.peak_accel} 
            color="#e11d48" 
          />
          <VibrationChart 
            title="X-Axis Peak Acceleration (G)" 
            data={xAxisData?.peak_accel} 
            color="#e11d48" 
          />
        </>
      )}
    </div>
  );
}