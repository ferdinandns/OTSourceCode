import React, { useMemo } from 'react';
import 'chart.js/auto'; 
import { Line } from 'react-chartjs-2';

export default function VibrationChart({ title, data, color = "#3b82f6" }) {
  
  const hasData = Array.isArray(data) && data.length > 0;

  // 1. Calculate Stats on the fly using React useMemo for performance
  const stats = useMemo(() => {
    if (!hasData) return { min: '0.000', max: '0.000', avg: '0.000' };

    const yValues = data.map(point => point.y);
    const max = Math.max(...yValues);
    const min = Math.min(...yValues);
    const sum = yValues.reduce((a, b) => a + b, 0);
    const avg = sum / yValues.length;

    return {
      min: min.toFixed(3),
      max: max.toFixed(3),
      avg: avg.toFixed(3)
    };
  }, [data, hasData]);

  // 2. Format the Date and Time into multi-line arrays
  const chartLabels = hasData 
    ? data.map(point => {
        const dateObj = new Date(point.x);
        const dateStr = dateObj.toLocaleDateString('id-ID', { 
            day: '2-digit', month: 'short', year: 'numeric' 
        }); 
        const timeStr = dateObj.toLocaleTimeString('id-ID', { 
            hour: '2-digit', minute: '2-digit', second: '2-digit' 
        });
        return [dateStr, timeStr]; 
      })
    : [['15 Jul 2026', '00.00.00'], ['15 Jul 2026', '01.00.00']]; 

  const chartValues = hasData 
    ? data.map(point => point.y) 
    : [0, 0.8];

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false, 
    plugins: {
      legend: { display: false },
      // We turn off the Chart.js title because we are building a better custom one below
      title: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          title: function(tooltipItems) {
            const rawLabel = tooltipItems[0].label; 
            return Array.isArray(rawLabel) ? rawLabel.join(' | ') : rawLabel; 
          }
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'var(--border-color)' },
        ticks: { 
          color: 'var(--text-muted)',
          maxTicksLimit: 10, 
          maxRotation: 0, 
          minRotation: 0
        }
      },
      y: {
        grid: { color: 'var(--border-color)' },
        ticks: { color: 'var(--text-muted)' }
      }
    }
  };

  const chartConfig = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Signal',
        data: chartValues,
        borderColor: color,
        borderWidth: 1.5,
        pointRadius: 0, 
        pointHitRadius: 10, 
        tension: 0.1 
      }
    ]
  };

  return (
    <div className="card chart-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
      
      {/* 3. The Custom Header with Stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h4 style={{ margin: 0, fontSize: '15px', color: 'var(--text-main)' }}>{title}</h4>
        
        <div style={{ display: 'flex', gap: '20px', fontSize: '13px', fontWeight: '600' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>MIN:</span>
            <span style={{ color: 'var(--text-main)' }}>{stats.min}</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>AVG:</span>
            <span style={{ color: '#f59e0b' }}>{stats.avg}</span> {/* Warning Yellow */}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>MAX:</span>
            <span style={{ color: '#ef4444' }}>{stats.max}</span> {/* Critical Red */}
          </div>
        </div>
      </div>

      {/* The Chart Canvas */}
      <div style={{ height: '220px', width: '100%' }}>
        <Line options={options} data={chartConfig} />
      </div>
      
    </div>
  );
}