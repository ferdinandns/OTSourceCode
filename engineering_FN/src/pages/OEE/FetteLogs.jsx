import React, { useEffect, useState } from 'react';

// Simple CSS for the table layout

const FetteLogTable = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // 1. Fetch Data on Component Mount
    useEffect(() => {
        const fetchLogs = async () => {
            try {
                // Replace with your actual API endpoint
                const response = await fetch('http://localhost:8002/part/getFetteLogs');
                const result = await response.json();

                if (response.ok) {
                    setLogs(result.data);
                } else {
                    setError(result.error || "Failed to load data");
                }
            } catch (err) {
                console.error("Fetch error:", err);
                setError("Network error - check console");
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, []);

    // 2. Loading & Error States
    if (loading) return <div className="p-4 font-bold text-gray-600">⏳ Loading NodeRed Data...</div>;
    if (error) return <div className="p-4 font-bold text-red-600">❌ Error: {error}</div>;

    // 3. Dynamic Column Headers
    // If logs exist, grab keys from the first object to use as headers
    const columns = logs.length > 0 ? Object.keys(logs[0]) : [];

    return (
        <div className="p-4 bg-white rounded shadow-md">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Fette Machine Monitoring (Latest 100)</h2>
            
            {/* Wrapper for horizontal scrolling since the table is wide */}
            <div className="overflow-x-auto">
                <table className="min-w-full border-collapse border border-gray-300 text-sm">
                    {/* --- HEADERS --- */}
                    <thead className="bg-gray-100 sticky top-0">
                        <tr>
                            {columns.map((col) => (
                                <th key={col} className="border p-2 whitespace-nowrap text-left font-semibold text-gray-700 capitalize">
                                    {/* Regex to replace underscores with spaces for readability */}
                                    {col.replace(/_/g, ' ')}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    {/* --- BODY --- */}
                    <tbody>
                        {logs.map((row) => (
                            <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                                {columns.map((col) => (
                                    <td key={`${row.id}-${col}`} className="border p-2 whitespace-nowrap text-gray-600">
                                        {/* Special formatting for timestamps */}
                                        {col === 'timestamp' 
                                            ? new Date(row[col]).toLocaleString('id-ID') 
                                            : row[col]
                                        }
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            {logs.length === 0 && <p className="p-4 text-center text-gray-500">No logs found.</p>}
        </div>
    );
};

export default FetteLogTable;