import React, { useState, useEffect } from 'react';
import VibrationChart from './VibrationChart';

export default function Level1({ startDate, endDate, fetchTrigger }) {
  const [zAxisData, setZAxisData] = useState(null);
  const [xAxisData, setXAxisData] = useState(null);
  const [loading, setLoading] = useState(false); 

  useEffect(() => {
    // Safety check: Prevents the API from firing on the initial page load
    // It will only execute after the user explicitly clicks "CARI DATA"

    const fetchTelemetry = async () => {
      setLoading(true);
      try {
        // Format the HTML5 datetime-local string to match your MariaDB timestamp format
        const timeRange = {
          start: startDate.replace('T', ' ') + ':00',
          finish: endDate.replace('T', ' ') + ':59'
        };

        // Construct the query strings cleanly
        const queryZ = new URLSearchParams({ ...timeRange, axis: 'Z-Axis' }).toString();
        const queryX = new URLSearchParams({ ...timeRange, axis: 'X-Axis' }).toString();

        // Fire both network requests in parallel to cut loading time in half
        const [responseZ, responseX] = await Promise.all([
          fetch(`http://10.126.15.197:8002/part/getVibrationData?${queryZ}`),
          fetch(`http://10.126.15.197:8002/part/getVibrationData?${queryX}`)
        ]);

        const resultZ = await responseZ.json();
        const resultX = await responseX.json();

        // Update state with the LTTB downsampled arrays
        setZAxisData(resultZ.data);
        setXAxisData(resultX.data);
      } catch (error) {
        console.error("Fetch Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTelemetry();
  }, [fetchTrigger]); // The dependency array ensures this ONLY runs when the trigger increments

  return (
    <div className="level-container">
      <h3 className="level-title">OVERALL HEALTH</h3>
      
      {loading ? (
        <div className="card placeholder-card">Loading telemetry data...</div>
      ) : (
        <>
          {/* Passing the specific data properties to your reusable Chart.js component */}
          <VibrationChart 
            title="Z-Axis RMS Velocity" 
            data={zAxisData?.rms_velocity} 
            color="#3b82f6" 
          />
          <VibrationChart 
            title="X-Axis RMS Velocity" 
            data={xAxisData?.rms_velocity} 
            color="#3b82f6" 
          />
          {/* You can drop the Temperature chart right below this once that endpoint is ready */}
        </>
      )}
    </div>
  );
}