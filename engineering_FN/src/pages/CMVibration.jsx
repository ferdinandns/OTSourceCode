import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';

// Define the thresholds used for the UI alerts and chart lines
const THRESHOLDS = {
  ACCEL_WARN: 2.8,
  ACCEL_CRIT: 3.5,
  VEL_WARN: 1.1,
  VEL_CRIT: 2.0
};

const VibrationDashboard = () => {
  const [data20s, setData20s] = useState([]);
  const [dataShifts, setDataShifts] = useState([]);
  const [dataDaily, setDataDaily] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [res20s, resShifts, resDaily] = await Promise.all([
                fetch('http://10.126.15.197:8002/part/getToday20SecAverages'),
        fetch('http://10.126.15.197:8002/part/getShiftAverages'),
        fetch('http://10.126.15.197:8002/part/getDailyAverages')
      ]);

      const [json20s, jsonShifts, jsonDaily] = await Promise.all([
        res20s.json(), resShifts.json(), resDaily.json()
      ]);

      if (Array.isArray(json20s)) formatAndSet20s(json20s);
      if (Array.isArray(jsonShifts)) formatAndSetShifts(jsonShifts);
      if (Array.isArray(jsonDaily)) formatAndSetDaily(jsonDaily);

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAllData(); }, []);

  // --- Formatting Functions ---
  const formatAndSet20s = (data) => {
    setData20s(data.map(item => ({
      ...item,
      displayTime: new Date(item.bucket_time).toLocaleTimeString('en-GB'),
      avg_velocity: parseFloat(item.avg_velocity) || 0,
      avg_acceleration: parseFloat(item.avg_acceleration) || 0
    })));
  };

  const formatAndSetShifts = (data) => {
    setDataShifts(data.map(item => ({
      ...item,
      shiftLabel: `${item.production_date.split('T')[0]} (S${item.shift_number})`,
      avg_velocity: parseFloat(item.avg_velocity) || 0,
      avg_acceleration: parseFloat(item.avg_acceleration) || 0
    })));
  };

  const formatAndSetDaily = (data) => {
    setDataDaily(data.map(item => ({
      ...item,
      production_date: item.production_date.split('T')[0],
      avg_velocity: parseFloat(item.avg_velocity) || 0,
      avg_acceleration: parseFloat(item.avg_acceleration) || 0
    })));
  };

  // --- KPI Calculations ---
  // Find the highest values logged today to display in the top tiles
  const maxAccel = data20s.length > 0 ? Math.max(...data20s.map(d => d.avg_acceleration)) : 0;
  const maxVel = data20s.length > 0 ? Math.max(...data20s.map(d => d.avg_velocity)) : 0;

  // Determine System Status based on thresholds
  let systemStatus = 'NORMAL';
  let statusColor = '#10b981'; // Green
  if (maxAccel >= THRESHOLDS.ACCEL_CRIT || maxVel >= THRESHOLDS.VEL_CRIT) {
    systemStatus = 'CRITICAL';
    statusColor = '#ef4444'; // Red
  } else if (maxAccel >= THRESHOLDS.ACCEL_WARN || maxVel >= THRESHOLDS.VEL_WARN) {
    systemStatus = 'WARNING';
    statusColor = '#f59e0b'; // Orange
  }

  // --- UI Components ---
  const KPITile = ({ title, value, unit, subtext, alertColor }) => (
    <div style={{ flex: 1, backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        <span style={{ fontSize: '32px', fontWeight: '800', color: alertColor || '#1e293b' }}>{value}</span>
        {unit && <span style={{ fontSize: '16px', color: '#64748b', fontWeight: '600' }}>{unit}</span>}
      </div>
      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{subtext}</div>
    </div>
  );

  const ChartWrapper = ({ title, height = '250px', children }) => (
    <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
      <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#334155', textTransform: 'uppercase' }}>{title}</h4>
      <div style={{ height }}>{children}</div>
    </div>
  );

  return (
    <div style={{ padding: '24px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#0284c7' }}>Catch Master</span> Vibration Health Dashboard
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>
            Last Update: {new Date().toLocaleString('en-GB')}
          </p>
        </div>
        <button onClick={fetchAllData} disabled={loading} style={{ padding: '10px 20px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}>
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      {/* KPI Row (Top) */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <KPITile 
          title="Current Status" 
          value={systemStatus} 
          alertColor={statusColor} 
          subtext={systemStatus === 'NORMAL' ? 'System Operating Within Limits' : 'Thresholds Exceeded Today'} 
        />
        <KPITile 
          title="Max Acceleration (Today)" 
          value={maxAccel.toFixed(2)} 
          unit="g" 
          alertColor={maxAccel >= THRESHOLDS.ACCEL_WARN ? (maxAccel >= THRESHOLDS.ACCEL_CRIT ? '#ef4444' : '#f59e0b') : '#1e293b'}
          subtext={`Threshold: ${THRESHOLDS.ACCEL_WARN}g (Warning)`} 
        />
        <KPITile 
          title="Max Velocity (Today)" 
          value={maxVel.toFixed(2)} 
          unit="mm/s" 
          alertColor={maxVel >= THRESHOLDS.VEL_WARN ? (maxVel >= THRESHOLDS.VEL_CRIT ? '#ef4444' : '#f59e0b') : '#1e293b'}
          subtext={`Threshold: ${THRESHOLDS.VEL_WARN}mm/s (Warning)`} 
        />
        {/* Placeholder for Temperature since it's in the schema but not queried yet */}
        <KPITile 
          title="Data Points Logged" 
          value={data20s.length} 
          unit="rows" 
          subtext="Fetched from today's active schedule" 
        />
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        
        {/* Left Column: Real-Time Trending */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <ChartWrapper title="Acceleration Trend (20-Second Rolling Averages)" height="300px">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data20s} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="displayTime" tick={{fontSize: 11, fill: '#94a3b8'}} minTickGap={30} />
                <YAxis tick={{fontSize: 11, fill: '#94a3b8'}} domain={[0, 'dataMax + 1']} />
                <Tooltip contentStyle={{ borderRadius: '4px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                
                {/* Threshold Lines */}
                <ReferenceLine y={THRESHOLDS.ACCEL_CRIT} stroke="#ef4444" strokeWidth={1} strokeDasharray="4 4" label={{ position: 'insideTopLeft', value: 'CRITICAL', fill: '#ef4444', fontSize: 11 }} />
                <ReferenceLine y={THRESHOLDS.ACCEL_WARN} stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 4" label={{ position: 'insideTopLeft', value: 'WARNING', fill: '#f59e0b', fontSize: 11 }} />
                
                <Line type="monotone" dataKey="avg_acceleration" stroke="#0ea5e9" strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="Acceleration (g)" />
              </LineChart>
            </ResponsiveContainer>
          </ChartWrapper>

          <ChartWrapper title="Velocity Trend (20-Second Rolling Averages)" height="300px">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data20s} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="displayTime" tick={{fontSize: 11, fill: '#94a3b8'}} minTickGap={30} />
                <YAxis tick={{fontSize: 11, fill: '#94a3b8'}} domain={[0, 'auto']} />
                <Tooltip contentStyle={{ borderRadius: '4px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                
                {/* Threshold Lines */}
                <ReferenceLine y={THRESHOLDS.VEL_WARN} stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 4" label={{ position: 'insideTopLeft', value: 'WARNING', fill: '#f59e0b', fontSize: 11 }} />
                
                <Line type="monotone" dataKey="avg_velocity" stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="Velocity (mm/s)" />
              </LineChart>
            </ResponsiveContainer>
          </ChartWrapper>

        </div>

        {/* Right Column: Historical Benchmarking */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <ChartWrapper title="Max Value Benchmarking (Per Shift)" height="320px">
            <ResponsiveContainer width="100%" height="100%">
              {/* Removed layout="vertical" */}
              <BarChart data={dataShifts} margin={{ top: 10, right: 0, left: -20, bottom: 20 }}>
                {/* Changed to vertical={false} for horizontal grid lines */}
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                
                {/* Moved shiftLabel to XAxis and angled the text so it fits */}
                <XAxis 
                  dataKey="shiftLabel" 
                  angle={-45} 
                  textAnchor="end" 
                  tick={{fontSize: 11, fill: '#475569'}} 
                  height={60} 
                />
                
                {/* Standard YAxis for the numerical values */}
                <YAxis tick={{fontSize: 11, fill: '#94a3b8'}} />
                
                <Tooltip cursor={{fill: '#f8fafc'}} />
                
                {/* Adjusted radius to round the top corners instead of the right side */}
                <Bar 
                  dataKey="avg_acceleration" 
                  fill="#3b82f6" 
                  radius={[4, 4, 0, 0]} 
                  name="Avg Acceleration (g)" 
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartWrapper>

          <ChartWrapper title="Daily Average Overview (7 Days)" height="320px">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataDaily} margin={{ top: 10, right: 0, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="production_date" angle={-45} textAnchor="end" tick={{fontSize: 11, fill: '#475569'}} height={60} />
                <YAxis tick={{fontSize: 11, fill: '#94a3b8'}} />
                <Tooltip cursor={{fill: '#f8fafc'}} />
                <Bar dataKey="avg_velocity" fill="#6366f1" radius={[4, 4, 0, 0]} name="Avg Velocity" />
              </BarChart>
            </ResponsiveContainer>
          </ChartWrapper>

        </div>
      </div>

    </div>
  );
};

export default VibrationDashboard;