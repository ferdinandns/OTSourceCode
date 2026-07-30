import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { History, User, Calendar, MessageCircle, Clock, Box, AlertTriangle, Search, AlertCircle, ArrowLeft } from 'lucide-react';

const OverrideAuditViewer = () => {
    const [logs, setLogs] = useState([]);
    const [filteredLogs, setFilteredLogs] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLog, setSelectedLog] = useState(null);
    const [loading, setLoading] = useState(false);

    const API_BASE = "http://10.126.15.197:8002/part";

    useEffect(() => { fetchLogs(); }, []);

    // Filter logic
    useEffect(() => {
        const lowerTerm = searchTerm.toLowerCase();
        const filtered = logs.filter(log => 
            log.change_reason?.toLowerCase().includes(lowerTerm) || 
            log.production_date?.includes(lowerTerm) ||
            log.target_shift?.toString().includes(lowerTerm)
        );
        setFilteredLogs(filtered);
    }, [searchTerm, logs]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/getOverrideAuditLogs`);
            setLogs(res.data);
            setFilteredLogs(res.data);
            if (res.data.length > 0) setSelectedLog(res.data[0]);
        } catch (err) {
            console.error("Failed to fetch logs");
        } finally {
            setLoading(false);
        }
    };

    const parseJSON = (str) => {
        try { return typeof str === 'string' ? JSON.parse(str) : str; }
        catch (e) { return null; }
    };

    return (
        <div style={{ backgroundColor: '#f1f5f9', minHeight: '100vh', fontFamily: 'Inter, sans-serif', display: 'grid', gridTemplateColumns: '1fr 380px', gap: '30px', padding: '30px' }}>
            
            {/* --- LEFT COLUMN: MAIN CONTENT (COMPARISON) --- */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                
                {/* Header Card */}
                <div style={{ background: '#fff', borderRadius: '24px', padding: '30px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ padding: '10px', background: '#0f172a', borderRadius: '12px' }}><History size={20} color="#fff" /></div>
                        <div>
                            <h1 style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', margin: 0 }}>AUDIT COMPARISON</h1>
                            <p style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', margin: 0 }}>Review historical changes and overrides</p>
                        </div>
                    </div>

                    {selectedLog ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', padding: '20px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                            <MetaItem icon={<Calendar size={14}/>} label="PRODUCTION DATE" val={new Date(selectedLog.production_date).toLocaleDateString('en-GB')} />
                            <MetaItem icon={<User size={14}/>} label="MODIFIED BY" val={selectedLog.user_name || 'System'} />
                            <MetaItem icon={<MessageCircle size={14}/>} label="JUSTIFICATION" val={selectedLog.change_reason} highlight />
                        </div>
                    ) : (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>Select a log from the sidebar to view details</div>
                    )}
                </div>

                {/* Comparison Grid */}
                {selectedLog && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', flex: 1 }}>
                        {/* OLD DATA */}
                        <ComparisonCard 
                            title="Old Data" 
                            data={parseJSON(selectedLog.original_data_json)} 
                            targetShift={selectedLog.target_shift}
                            color="#64748b" 
                            bgHeader="#f1f5f9"
                        />
                        {/* NEW DATA */}
                        <ComparisonCard 
                            title="Manual Override Data" 
                            data={parseJSON(selectedLog.new_data_json)} 
                            targetShift={selectedLog.target_shift}
                            color="#2563eb" 
                            isNew
                            bgHeader="#eff6ff"
                        />
                    </div>
                )}
            </div>

            {/* --- RIGHT COLUMN: HISTORY SIDEBAR --- */}
            <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden', height: 'calc(100vh - 60px)', position: 'sticky', top: '30px' }}>
                
                {/* Sidebar Header */}
                <div style={{ padding: '25px', borderBottom: '1px solid #f1f5f9', background: '#fff' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', marginBottom: '15px' }}>CHANGE LOG HISTORY</h3>
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input 
                            type="text" 
                            placeholder="Search date, shift or reason..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ 
                                width: '100%', padding: '12px 12px 12px 36px', borderRadius: '12px', border: '1px solid #e2e8f0', 
                                background: '#f8fafc', color: '#0f172a', fontSize: '12px', fontWeight: '600', outline: 'none' 
                            }} 
                        />
                    </div>
                </div>

                {/* Scrollable List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
                    {filteredLogs.map(log => (
                        <div 
                            key={log.id} 
                            onClick={() => setSelectedLog(log)}
                            style={{ 
                                padding: '15px', marginBottom: '10px', borderRadius: '12px', cursor: 'pointer',
                                background: selectedLog?.id === log.id ? '#eff6ff' : '#fff',
                                border: selectedLog?.id === log.id ? '1px solid #bfdbfe' : '1px solid #f1f5f9',
                                transition: 'all 0.2s ease',
                                boxShadow: selectedLog?.id === log.id ? '0 4px 6px -1px rgba(37, 99, 235, 0.1)' : 'none'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ fontSize: '10px', fontWeight: '700', color: selectedLog?.id === log.id ? '#2563eb' : '#64748b', background: selectedLog?.id === log.id ? '#fff' : '#f1f5f9', padding: '4px 8px', borderRadius: '6px' }}>
                                    {new Date(log.production_date).toLocaleDateString('en-GB')}
                                </span>
                                <span style={{ fontSize: '10px', fontWeight: '800', color: '#0f172a' }}>SHIFT {log.target_shift}</span>
                            </div>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#334155', lineHeight: '1.4', marginBottom: '8px' }}>
                                {log.change_reason.length > 60 ? log.change_reason.substring(0, 60) + '...' : log.change_reason}
                            </div>
                            <div style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={10} /> {new Date(log.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                            </div>
                        </div>
                    ))}
                    
                    {filteredLogs.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                            <AlertCircle size={32} style={{ margin: '0 auto 10px auto', opacity: 0.3 }} />
                            <p style={{ fontSize: '12px', fontWeight: '600' }}>No logs found</p>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};

// --- HELPER COMPONENTS ---

const MetaItem = ({ icon, label, val, highlight }) => (
    <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '10px', fontWeight: '800', marginBottom: '6px' }}>
            {icon} {label}
        </div>
        <div style={{ fontSize: '13px', fontWeight: highlight ? '800' : '700', color: highlight ? '#0f172a' : '#334155' }}>{val}</div>
    </div>
);

const ComparisonCard = ({ title, data, targetShift, color, isNew, bgHeader }) => {
    if (!data) return null;
    const shift = data[targetShift];
    const m = shift?.master || {}; 

    // Calculation for derived values (if not in DB)
    const safeGood = (parseFloat(m.total_product) || 0) - (parseFloat(m.reject) || 0);

    return (
        <div style={{ 
            background: '#fff', borderRadius: '24px', 
            border: isNew ? '2px solid #2563eb' : '1px solid #e2e8f0', 
            overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)',
            display: 'flex', flexDirection: 'column'
        }}>
            {/* Header */}
            <div style={{ background: bgHeader, padding: '15px 25px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: '900', color: color, letterSpacing: '0.5px' }}>{title}</span>
                {isNew && <span style={{ fontSize: '9px', background: '#2563eb', color: '#fff', padding: '4px 10px', borderRadius: '20px', fontWeight: '700' }}>CURRENT</span>}
            </div>
            
            <div style={{ padding: '25px', flex: 1 }}>
                
                {/* 1. TOP: OEE SCORES */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '25px' }}>
                    <div style={{ background: isNew ? '#2563eb' : '#f8fafc', padding: '15px', borderRadius: '16px', color: isNew ? '#fff' : '#475569', textAlign: 'center' }}>
                        <div style={{ fontSize: '9px', fontWeight: '800', opacity: 0.8, marginBottom: '4px' }}>DAILY OEE</div>
                        <div style={{ fontSize: '24px', fontWeight: '900' }}>{parseFloat(m.oee_value_daily || 0).toFixed(2)}%</div>
                    </div>
                    <div style={{ border: '1px solid #e2e8f0', padding: '15px', borderRadius: '16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '9px', fontWeight: '800', color: '#94a3b8', marginBottom: '4px' }}>SHIFT {targetShift} OEE</div>
                        <div style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a' }}>{parseFloat(m.oee_value_shift || 0).toFixed(2)}%</div>
                    </div>
                </div>

                {/* 2. MIDDLE: APQ METRICS */}
                <h4 style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>APQ Breakdown</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '25px' }}>
                    <StatBox label="Avail" val={m.availability_value_shift} unit="%" color="#3b82f6" />
                    <StatBox label="Perf" val={m.performance_value_shift} unit="%" color="#8b5cf6" />
                    <StatBox label="Qual" val={m.quality_value_shift} unit="%" color="#10b981" />
                </div>

                {/* 3. BOTTOM: DATA TABLE */}
                <h4 style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Production Data</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <DataRow label="Run Time" val={m.total_run} unit=" min" icon={<Clock size={10}/>} />
                    <DataRow label="Stop Time" val={m.total_stop} unit=" min" icon={<AlertTriangle size={10}/>} />
                    
                    <DataRow label="Planned" val={m.planned_stop || m.planned_dur || 0} unit=" min" />
                    <DataRow label="Unplanned" val={m.unplanned_stop || m.unplanned_dur || 0} unit=" min" isError />
                    
                    <div style={{ gridColumn: 'span 2', height: '1px', background: '#f1f5f9', margin: '5px 0' }} />
                    
                    <DataRow label="Output" val={m.total_product} unit=" pcs" icon={<Box size={10}/>} />
                    <div />
                    
                    <DataRow label="Good" val={safeGood} unit=" pcs" isGood />
                    <DataRow label="Rejects" val={m.reject} unit=" pcs" isError />
                </div>

            </div>
        </div>
    );
};

const StatBox = ({ label, val, unit, color }) => (
    <div style={{ textAlign: 'center', padding: '10px 5px', background: '#fff', border: '1px solid #f1f5f9', borderRadius: '12px' }}>
        <div style={{ fontSize: '8px', fontWeight: '800', color: '#94a3b8', marginBottom: '2px', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontSize: '14px', fontWeight: '900', color: color }}>{parseFloat(val || 0).toFixed(1)}{unit}</div>
    </div>
);

const DataRow = ({ label, val, unit, icon, isError, isGood }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#f8fafc', borderRadius: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: '700', color: '#64748b' }}>
            {icon} {label}
        </div>
        <div style={{ 
            fontSize: '11px', fontWeight: '800', 
            color: isError ? '#ef4444' : isGood ? '#10b981' : '#334155' 
        }}>
            {parseInt(val || 0).toLocaleString()}{unit}
        </div>
    </div>
);

export default OverrideAuditViewer;