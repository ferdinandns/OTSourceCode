import React, { useState } from 'react';

const TestImport = () => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleImport = async () => {
        setLoading(true);
        setResult(null);
        setError(null);

        try {
            // Make sure this URL matches your backend route exactly
            const response = await fetch('http://localhost:8002/part/importMaintenanceData', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    // This path is relative to where your BACKEND server.js is located
                    filePath: 'C:\\Users\\Acer\\Documents\\GitHub\\engineering1\\public\\WO PM JAN.csv'
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Import failed');
            }

            setResult(data);
        } catch (err) {
            console.error("Import Error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-10 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-gray-800">Maintenance Data Import Tool</h1>
            
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                <p className="mb-4 text-gray-600">
                    Click the button below to parse <code>data.csv</code> and generate a text report.
                </p>

                <button 
                    onClick={handleImport}
                    disabled={loading}
                    className={`px-6 py-2 rounded-md font-bold text-white transition-colors ${
                        loading 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                >
                    {loading ? 'Processing...' : '🚀 Run Import Script'}
                </button>

                {/* --- ERROR DISPLAY --- */}
                {error && (
                    <div className="mt-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
                        <strong>Error:</strong> {error}
                    </div>
                )}

                {/* --- SUCCESS OUTPUT DISPLAY --- */}
                {result && (
                    <div className="mt-6">
                        <div className="p-4 bg-green-50 border border-green-200 text-green-800 rounded-md mb-4">
                            <strong>✅ {result.message}</strong>
                        </div>
                        
                        <div className="bg-gray-900 text-green-400 p-4 rounded-md font-mono text-sm overflow-auto max-h-96 shadow-inner">
                            <pre>{JSON.stringify(result, null, 2)}</pre>
                        </div>
                        
                        <div className="mt-2 text-xs text-gray-500 text-right">
                            Check the file: <code>{result.outputFile}</code>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ⚠️ THIS LINE FIXES YOUR ERROR:
export default TestImport;