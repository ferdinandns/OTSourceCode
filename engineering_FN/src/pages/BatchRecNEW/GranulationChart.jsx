import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

const GranulationChart = ({ data, machine, mode = 'overlay' }) => {
    if (!data || data.length === 0) return <div className="p-10 text-center">No Data</div>;

    // 1. Ambil kolom angka saja
    const keys = Object.keys(data[0]).filter(key => 
        !['wib_time', 'Batch_ID', 'Process_ID', 'timestamp', 'id', 'ID'].includes(key) && 
        typeof data[0][key] === 'number'
    );

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

    // Fungsi formatter waktu agar seragam
    const formatXAxis = (str) => {
        if (!str) return '';
        const parts = str.split(' ');
        if (parts.length < 2) return str;
        return `${parts[0]} ${parts[1].substring(0, 5)}`;
    };

    // Di dalam file GranulationChart.jsx (Bagian Mode Split)

if (mode === 'split') {
    return (
        <div className="w-full space-y-8 bg-white dark:bg-[#161b22] p-4">
            <h3 className="text-[14px] font-bold text-blue-600 mb-6 uppercase border-b pb-2">
                Multi-Parameter Analysis: {machine}
            </h3>
            <div className="grid grid-cols-1 gap-10">
                {keys.map((key, index) => (
                    /* TAMBAHKAN CLASS 'split-chart-item' DI SINI RIZ */
                    <div 
                        key={key} 
                        className="split-chart-item bg-gray-50 dark:bg-[#0d1117] p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm"
                        style={{ breakInside: 'avoid', marginBottom: '20px' }} 
                    >
                        <h4 className="text-[12px] font-bold text-gray-700 dark:text-gray-300 mb-4 uppercase flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[index % colors.length] }}></span>
                            {key.replace(/_/g, ' ')}
                        </h4>
                        
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} opacity={0.2} />
                                    <XAxis 
                                        dataKey="wib_time" 
                                        tickFormatter={formatXAxis}
                                        interval={Math.floor(data.length / 12)} 
                                        tick={{ fontSize: 9, fill: '#9ca3af' }}
                                    />
                                    <YAxis fontSize={10} tick={{ fill: '#9ca3af' }} domain={['auto', 'auto']} />
                                    <Tooltip contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #30363d', fontSize: '11px' }} />
                                    <Line 
                                        type="monotone" 
                                        dataKey={key} 
                                        stroke={colors[index % colors.length]} 
                                        dot={false} 
                                        strokeWidth={2.5}
                                        animationDuration={1000}
                                        isAnimationActive={false} // Matikan animasi khusus untuk keperluan PDF agar tidak kosong saat dipotret
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

    // --- MODE 2: OVERLAY (GRAFIK GABUNGAN - LAMA) ---
    return (
        <div className="w-full bg-white dark:bg-[#161b22] p-4">
            <h3 className="text-[12px] font-bold text-blue-600 mb-6 uppercase">Trend Analysis (Overlay): {machine}</h3>
            <div className="h-[450px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                        <XAxis 
                            dataKey="wib_time" 
                            tickFormatter={formatXAxis}
                            interval={Math.floor(data.length / 15)} 
                            tick={{ fontSize: 10, fill: '#666' }}
                            height={60}
                        />
                        <YAxis yAxisId="left" fontSize={10} tick={{fill: '#9ca3af'}} />
                        <YAxis yAxisId="right" orientation="right" fontSize={10} tick={{fill: '#60a5fa'}} />
                        
                        <Tooltip contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #30363d', fontSize: '11px' }} />
                        <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                        
                        {keys.map((key, index) => (
                            <Line 
                                key={key}
                                yAxisId={(key.toLowerCase().includes('kw') || key.toLowerCase().includes('current')) ? "right" : "left"}
                                type="monotone" 
                                dataKey={key} 
                                stroke={colors[index % colors.length]} 
                                dot={false} 
                                strokeWidth={2}
                                name={key.replace(/_/g, ' ')} 
                                animationDuration={1000}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default GranulationChart;