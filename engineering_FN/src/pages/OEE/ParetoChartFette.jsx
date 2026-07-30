import React, { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell
} from 'recharts';

const ParetoChart = ({ data, title }) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // 1. Group by Reason and Sum Durations
    const grouped = data.reduce((acc, curr) => {
      const reason = curr.reason_name || 'Undefined';
      acc[reason] = (acc[reason] || 0) + parseFloat(curr.duration_minutes || 0);
      return acc;
    }, {});

    // 2. Sort Descending
    const sorted = Object.entries(grouped)
      .map(([name, duration]) => ({ name, duration }))
      .sort((a, b) => b.duration - a.duration);

    // 3. Calculate Cumulative Percentage
    const totalDuration = sorted.reduce((sum, item) => sum + item.duration, 0);
    let cumulativeSum = 0;

    return sorted.map(item => {
      cumulativeSum += item.duration;
      return {
        ...item,
        cumulative: parseFloat(((cumulativeSum / totalDuration) * 100).toFixed(1))
      };
    });
  }, [data]);

  if (chartData.length === 0) return (
    <div className="h-full flex items-center justify-center text-gray-400 italic bg-white rounded-lg border">
      No data available for Pareto analysis
    </div>
  );

  return (
    <div className="bg-white p-4 rounded-lg shadow-md border-t-4 border-purple-500 h-full flex flex-col">
      <h3 className="font-bold text-gray-700 mb-4 text-sm">{title}</h3>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis 
              dataKey="name" 
              fontSize={10} 
              interval={0} 
              angle={-25} 
              textAnchor="end" 
              stroke="#9ca3af"
            />
            {/* Primary Y-Axis for Duration */}
            <YAxis 
              yAxisId="left" 
              label={{ value: 'Minutes', angle: -90, position: 'insideLeft', fontSize: 10 }}
              fontSize={10}
              stroke="#9ca3af"
            />
            {/* Secondary Y-Axis for Cumulative % */}
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              domain={[0, 100]}
              label={{ value: 'Cumulative %', angle: 90, position: 'insideRight', fontSize: 10 }}
              fontSize={10}
              stroke="#9ca3af"
            />
            <Tooltip 
              contentStyle={{ fontSize: '12px', borderRadius: '8px' }}
              formatter={(value, name) => [name === 'cumulative' ? `${value}%` : `${Math.round(value)}m`, name === 'cumulative' ? 'Cumulative' : 'Duration']}
            />
            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '10px' }}/>
            <Bar yAxisId="left" dataKey="duration" fill="#8884d8" barSize={30} radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={index < 3 ? '#6366f1' : '#c7d2fe'} />
              ))}
            </Bar>
            <Line 
              yAxisId="right" 
              type="monotone" 
              dataKey="cumulative" 
              stroke="#f43f5e" 
              strokeWidth={2}
              dot={{ r: 3, fill: '#f43f5e' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ParetoChart;