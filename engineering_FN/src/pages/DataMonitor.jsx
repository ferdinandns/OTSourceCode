import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    CheckCheck, 
    CheckCircle, 
    AlertTriangle, 
    AlertOctagon, 
    AlertCircle, 
    HelpCircle,
    Search,
    Filter,
    Zap, 
    ZapOff 
} from 'lucide-react';

const MachineDashboard = () => {
    const [machines, setMachines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // UI States
    const [searchTerm, setSearchTerm] = useState(""); 
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [animationsEnabled, setAnimationsEnabled] = useState(true); // Default: Animations ON

    // Fetch data
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Update with your actual API endpoint
                const response = await axios.get('http://10.126.15.197:8002/part/getAllLatestTimestamps'); 
                setMachines(response.data.data);
                setLoading(false);
            } catch (err) {
                console.error("Error fetching data:", err);
                setError("Failed to load machine data.");
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    // --- HELPER: DETERMINE STATUS KEY ---
    const getMachineStatus = (timestampSeconds) => {
        if (!timestampSeconds) return 'NO_DATA';

        const now = Date.now();
        const diffMs = now - (timestampSeconds * 1000);
        const minutes = diffMs / (1000 * 60);
        const hours = diffMs / (1000 * 60 * 60);
        const days = diffMs / (1000 * 60 * 60 * 24);

        if (days > 14) return 'OFFLINE_14';
        if (days > 7)  return 'OFFLINE_7';
        if (hours > 72) return 'LATE_3';
        if (hours > 24) return 'WARNING_1';
        if (minutes > 5) return 'RECENT';
        return 'ONLINE';
    };

    // --- HELPER: GET STYLES BASED ON STATUS KEY ---
    const getStatusStyle = (statusKey) => {
        switch (statusKey) {
            case 'OFFLINE_14':
                return {
                    borderColor: 'border-red-700',
                    textColor: 'text-red-800',
                    bgColor: 'bg-red-200',
                    label: '> 14 Days Offline',
                    icon: <AlertOctagon className="w-6 h-6 text-red-700" />
                };
            case 'OFFLINE_7':
                return {
                    borderColor: 'border-red-400',
                    textColor: 'text-red-600',
                    bgColor: 'bg-red-50',
                    label: '> 7 Days Offline',
                    icon: <AlertCircle className="w-6 h-6 text-red-500" />
                };
            case 'LATE_3':
                return {
                    borderColor: 'border-orange-500',
                    textColor: 'text-orange-700',
                    bgColor: 'bg-orange-100',
                    label: '> 3 Days Behind',
                    icon: <AlertTriangle className="w-6 h-6 text-orange-600" />
                };
            case 'WARNING_1':
                return {
                    borderColor: 'border-yellow-400',
                    textColor: 'text-yellow-700',
                    bgColor: 'bg-yellow-100',
                    label: '1-3 Days Behind',
                    icon: <AlertTriangle className="w-6 h-6 text-yellow-600" />
                };
            case 'RECENT':
                return {
                    borderColor: 'border-[#DBF274]',
                    textColor: 'text-[#8AB514]',
                    bgColor: 'bg-[#ECFFC4]',
                    label: 'Recent (< 24h)',
                    icon: <CheckCircle className="w-6 h-6 text-[#8AB514]" />
                };
            case 'ONLINE':
                return {
                    borderColor: 'border-[#61990E]',
                    textColor: 'text-[#61990E]',
                    bgColor: 'bg-[#B6F2B7]',
                    label: 'Online',
                    icon: <CheckCheck className="w-6 h-6 text-[#418207]" strokeWidth={3} />
                };
            default:
                return {
                    borderColor: 'border-slate-300',
                    textColor: 'text-slate-500',
                    bgColor: 'bg-slate-100',
                    label: 'No Data',
                    icon: <HelpCircle className="w-6 h-6 text-slate-400" />
                };
        }
    };

    // --- FILTER CONFIG ---
    const filterOptions = [
        { key: 'ALL', label: 'View All' },
        { key: 'ONLINE', label: 'Online' },
        { key: 'RECENT', label: '< 24h' },
        { key: 'WARNING_1', label: '1-3 Days' },
        { key: 'LATE_3', label: '> 3 Days' },
        { key: 'OFFLINE_7', label: '> 7 Days' },
        { key: 'OFFLINE_14', label: '> 14 Days' },
        { key: 'NO_DATA', label: 'No Data' },
    ];

    // --- FILTER LOGIC ---
    const filteredMachines = machines.filter(machine => {
        const status = getMachineStatus(machine.timestamp);
        const matchesStatus = statusFilter === 'ALL' || status === statusFilter;
        if (!searchTerm) return matchesStatus;
        const term = searchTerm.toLowerCase();
        const matchesSearch = (
            machine.name.toLowerCase().includes(term) || 
            machine.table.toLowerCase().includes(term)
        );
        return matchesStatus && matchesSearch;
    });

    // --- GROUPING LOGIC ---
    const groupedMachines = filteredMachines.reduce((groups, machine) => {
        const category = machine.category || "Uncategorized";
        if (!groups[category]) groups[category] = [];
        groups[category].push(machine);
        return groups;
    }, {});

    const categoryOrder = ["Line 1", "Line 3", "NodeRed", "IPC", "Staging"];
    const sortedCategories = Object.keys(groupedMachines).sort((a, b) => {
        const indexA = categoryOrder.indexOf(a);
        const indexB = categoryOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });

    if (loading) return <div className="min-h-screen flex items-center justify-center text-xl text-slate-500">Loading Dashboard...</div>;
    if (error) return <div className="min-h-screen flex items-center justify-center text-xl text-red-500">{error}</div>;

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
            {/* UPDATED CSS ANIMATION WITH LAYERED SHADOWS */}
            <style>{`
                /* Define a constant base shadow variable for consistency */
                :root {
                    --base-card-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
                }

                @keyframes intense-red-pulse {
                    0% {
                        /* Layer 1: Base Shadow (Constant) */
                        /* Layer 2: Red Glow (Invisible at start) */
                        box-shadow: var(--base-card-shadow), 0 0 0 0 rgba(220, 38, 38, 0);
                    }
                    50% {
                        /* Layer 1: Base Shadow (Constant) */
                        /* Layer 2: Red Glow (Big and bright) */
                        box-shadow: var(--base-card-shadow), 0 0 30px 10px rgba(220, 38, 38, 0.25);
                    }
                    100% {
                        /* Layer 1: Base Shadow (Constant) */
                        /* Layer 2: Red Glow (Back to invisible) */
                        box-shadow: var(--base-card-shadow), 0 0 0 0 rgba(220, 38, 38, 0);
                    }
                }
                .animate-critical {
                    animation: intense-red-pulse 4s infinite ease-in-out;
                    z-index: 10; 
                }
            `}</style>

            {/* --- HEADER --- */}
            <header className="mb-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Database Status Monitor</h1>
                        <p className="text-slate-500 mt-1 text-sm">Real-time database d</p>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Animation Toggle Button */}
                        <button 
                            onClick={() => setAnimationsEnabled(!animationsEnabled)}
                            className={`
                                flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all border
                                ${animationsEnabled 
                                    ? 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50' 
                                    : 'bg-slate-100 border-slate-200 text-slate-400'
                                }
                            `}
                            title="Toggle Critical Animations"
                        >
                            {animationsEnabled ? <Zap className="w-4 h-4 text-amber-500 fill-amber-500" /> : <ZapOff className="w-4 h-4" />}
                            {animationsEnabled ? 'Animations ON' : 'Animations OFF'}
                        </button>

                        {/* Search Bar */}
                        <div className="relative w-full md:w-80">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-sm transition-all"
                                placeholder="Search Database..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* --- FILTER BUTTONS --- */}
                <div className="flex flex-wrap gap-2 items-center">
                    <div className="flex items-center text-slate-400 mr-2">
                        <Filter className="w-4 h-4 mr-1" />
                        <span className="text-xs font-bold uppercase tracking-wider">Filter:</span>
                    </div>
                    {filterOptions.map((option) => (
                        <button
                            key={option.key}
                            onClick={() => setStatusFilter(option.key)}
                            className={`
                                px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 border
                                ${statusFilter === option.key 
                                    ? 'bg-slate-800 text-white border-slate-800 shadow-md' 
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                                }
                            `}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </header>
            
            {/* --- CONTENT --- */}
            {filteredMachines.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                    <p className="text-slate-400 text-lg">No machines found.</p>
                </div>
            ) : (
                <div className="space-y-12">
                    {sortedCategories.map((category) => (
                        <section key={category}>
                            {/* Category Header */}
                            <div className="flex items-center gap-3 mb-6 border-b border-slate-200 pb-2">
                                <h2 className="text-2xl font-bold text-slate-700 uppercase tracking-wide">
                                    {category}
                                </h2>
                                <span className="px-2.5 py-0.5 bg-slate-200 text-slate-600 text-xs font-bold rounded-full">
                                    {groupedMachines[category].length}
                                </span>
                            </div>

                            {/* Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {groupedMachines[category].map((machine, index) => {
                                    const statusKey = getMachineStatus(machine.timestamp);
                                    const style = getStatusStyle(statusKey);
                                    
                                    // CHECK IF SHOULD ANIMATE
                                    const isCritical = statusKey === 'OFFLINE_14';
                                    const animationClass = (animationsEnabled && isCritical) ? 'animate-critical' : '';
                                    
                                    return (
                                        <div 
                                            key={`${category}-${index}`}
                                            // UPDATED: Changed shadow-sm to shadow-md for better base depth
                                            className={`
                                                relative bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 
                                                border-l-[12px] ${style.borderColor} overflow-hidden group
                                                ${animationClass}
                                            `}
                                        >
                                            <div className="p-5">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="pr-2">
                                                        <h2 className="text-lg font-bold text-slate-800 leading-tight">
                                                            {machine.name}
                                                        </h2>
                                                    </div>
                                                    <div className={`p-2 rounded-full flex-shrink-0 ${style.bgColor}`}>
                                                        {style.icon}
                                                    </div>
                                                </div>

                                                <div className={`text-xs font-extrabold uppercase tracking-wider mb-4 ${style.textColor}`}>
                                                    {style.label}
                                                </div>

                                                <div className="h-px bg-slate-100 w-full mb-3"></div>

                                                <div className="space-y-2">
                                                    <div>
                                                        <p className="text-[10px] text-slate-400 uppercase font-bold">Last Update</p>
                                                        <p className="text-sm font-medium text-slate-700 font-mono">
                                                            {machine.last_update || "No Data"}
                                                        </p>
                                                    </div>
                                                    
                                                    <div>
                                                        <p className="text-[10px] text-slate-400 uppercase font-bold">Source Table</p>
                                                        <p className="text-xs text-slate-500 font-mono truncate group-hover:whitespace-normal group-hover:break-all transition-all" title={machine.table}>
                                                            {machine.table}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MachineDashboard;