import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Trash2, Plus, Search, Save, Activity, Clock, Package, Gauge, ArrowRightLeft, AlertTriangle } from 'lucide-react';

const OverrideManager = () => {
    const [searchDate, setSearchDate] = useState(new Date().toISOString().split('T')[0]);
    const [searchShift, setSearchShift] = useState('1');
    const [originalData, setOriginalData] = useState(null);
    const [data, setData] = useState(null);
    const [reasons, setReasons] = useState([]);
    const [loading, setLoading] = useState(false);

    const API_BASE = "http://localhost:8002/part";

    // Safe formatter to prevent "toFixed" of undefined and handle decimals
    const f = (val, dec = 2) => {
        const num = parseFloat(val);
        return isNaN(num) ? (0).toFixed(dec) : num.toFixed(dec);
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [dataRes, reasonRes] = await Promise.all([
                axios.get(`${API_BASE}/getOverrideDataBySearch?date=${searchDate}&shift=${searchShift}`),
                axios.get(`${API_BASE}/getDowntimeReasons`)
            ]);
            setOriginalData(JSON.parse(JSON.stringify(dataRes.data)));
            setData(dataRes.data);
            setReasons(reasonRes.data);
        } catch (err) {
            alert("No record found. Please verify the Date and Shift.");
            setData(null);
        } finally {
            setLoading(false);
        }
    };

    const defaultStats = { 
        oee: 0, avail: 0, perf: 0, qual: 0, 
        tRun: 0, tStop: 0, tOut: 0, tGood: 0, 
        rej: 0, p: 0, u: 0 
    };

    const calculateStats = (m, e) => {
        if (!m || !e) return { ...defaultStats };

        const TARGET_RATE = 5333;
        const tRun = parseFloat(m.total_run) || 0;
        const tOut = parseFloat(m.total_product) || 0;
        const rej = parseFloat(m.reject) || 0;
        const tGood = parseFloat(m.total_good) || 0;
        const shiftTime = parseFloat(m.total_shift_time) || 510;

        const totals = e.reduce((acc, ev) => {
            const val = parseFloat(ev.duration_minutes) || 0;
            if (ev.category === 'Planned') acc.p += val;
            return acc;
        }, { p: 0 });

        const netAvailableTime = shiftTime - totals.p;
        const avail = netAvailableTime > 0 ? (tRun / netAvailableTime) * 100 : 0;
        const potentialOutput = tRun * TARGET_RATE;
        const perf = potentialOutput > 0 ? (tOut / potentialOutput) * 100 : 0;
        const qual = tOut > 0 ? (tGood / tOut) * 100 : 0;

        return {
            oee: (avail * perf * qual) / 10000,
            avail, perf, qual,
            tRun, tStop: shiftTime - tRun,
            tOut, tGood, rej, p: totals.p
        };
    };

    const o = useMemo(() => calculateStats(originalData?.master, originalData?.events), [originalData]);
    const c = useMemo(() => calculateStats(data?.master, data?.events), [data]);

    const handleTimeChange = (type, val) => {
        const value = parseFloat(val) || 0;
        const shiftTime = parseFloat(data.master.total_shift_time);
        if (type === 'run') setData({ ...data, master: { ...data.master, total_run: value, total_stop: shiftTime - value } });
        else setData({ ...data, master: { ...data.master, total_stop: value, total_run: shiftTime - value } });
    };

    const handleOutputChange = (type, val) => {
        const value = parseFloat(val) || 0;
        const currentRej = parseFloat(data.master.reject) || 0;
        const currentGood = parseFloat(data.master.total_good) || 0;
        if (type === 'good') setData({ ...data, master: { ...data.master, total_good: value, total_product: value + currentRej } });
        else if (type === 'rej') setData({ ...data, master: { ...data.master, reject: value, total_product: currentGood + value } });
        else if (type === 'total') setData({ ...data, master: { ...data.master, total_product: value, total_good: value - currentRej } });
    };

    const handleSave = async () => {
        const shiftTime = parseFloat(data.master.total_shift_time);
        const runTime = parseFloat(data.master.total_run);
        const stopTime = parseFloat(data.master.total_stop);
        
        if (Math.abs((runTime + stopTime) - shiftTime) > 0.1) {
            alert(`❌ Validation Error: Runtime (${runTime}) + Stoptime (${stopTime}) must equal Shift Time (${shiftTime}).`);
            return;
        }

        const reason = window.prompt("REASON FOR OVERRIDE:\nPlease explain why you are manually overriding the sensor data.");
        
        if (!reason || reason.trim().length < 5) {
            alert("❌ Save Cancelled: A valid reason is required.");
            return;
        }

        setLoading(true);
        try {
            const payload = {
                master: data.master,
                events: data.events,
                original: originalData,
                changeReason: reason
            };
            const res = await axios.post(`${API_BASE}/saveOverrideData`, payload);
            alert(`✅ Success: ${res.data.message}\nNew OEE: ${res.data.newOee}%`);
            fetchData(); 
        } catch (err) {
            alert("❌ Failed to save: " + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', color: '#1e293b', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 40px', backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ backgroundColor: '#0f172a', padding: '8px', borderRadius: '8px' }}><Activity color="#fff" size={18} /></div>
                    <h1 style={{ fontSize: '15px', fontWeight: '900', margin: 0 }}>FETTE OVERRIDE</h1>
                </div>
                <div style={{ display: 'flex', gap: '6px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <input type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} style={{ border: 'none', background: 'transparent', padding: '8px 12px', fontSize: '13px', fontWeight: '700', outline: 'none' }} />
                    <select value={searchShift} onChange={(e) => setSearchShift(e.target.value)} style={{ border: 'none', background: 'transparent', padding: '8px 12px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                        <option value="1">Shift 1</option><option value="2">Shift 2</option><option value="3">Shift 3</option>
                    </select>
                    <button onClick={fetchData} style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: '7px', padding: '8px 18px', cursor: 'pointer' }}>{loading ? '...' : <Search size={16} />}</button>
                </div>
            </nav>

            {data ? (
                <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '30px 40px', display: 'grid', gridTemplateColumns: '360px 1fr', gap: '30px' }}>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ background: '#0f172a', padding: '24px', borderRadius: '20px', color: 'white' }}>
                            <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', letterSpacing: '1px' }}>RECALCULATED OEE</div>
                            <div style={{ fontSize: '56px', fontWeight: '900', margin: '5px 0' }}>{f(c.oee, 2)}%</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>Original Score: {f(o.oee, 2)}%</div>
                        </div>

                        <div style={{ background: '#fff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                            <h3 style={{ margin: '0 0 15px 0', fontSize: '12px', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Data Reconciliation</h3>
                            {[
                                { label: "Runtime", old: o.tRun, curr: c.tRun, unit: "m" },
                                { label: "Stoptime", old: o.tStop, curr: c.tStop, unit: "m" },
                                { label: "Planned", old: o.p, curr: c.p, unit: "m" },
                                { label: "Unplanned", old: o.u, curr: c.u, unit: "m" },
                                { label: "Output", old: o.tOut, curr: c.tOut, unit: "" },
                                { label: "Good", old: o.tGood, curr: c.tGood, unit: "" },
                                { label: "Reject", old: o.rej, curr: c.rej, unit: "" }
                            ].map(row => (
                                <div key={row.label} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                                    <div style={{ fontSize: '10px', fontWeight: '800', color: '#cbd5e1', textTransform: 'uppercase' }}>{row.label}</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ flex: 1 }}><div style={{ fontSize: '9px', color: '#cbd5e1' }}>Old</div><div style={{ fontSize: '13px', fontWeight: '600', color: '#94a3b8' }}>{f(row.old, 0)}{row.unit}</div></div>
                                        <ArrowRightLeft size={12} color="#f1f5f9" />
                                        <div style={{ flex: 1, textAlign: 'right' }}><div style={{ fontSize: '9px', color: '#94a3b8' }}>Manual</div><div style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b' }}>{f(row.curr, 0)}{row.unit}</div></div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ background: '#fff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                            <h3 style={{ margin: '0 0 15px 0', fontSize: '12px', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Ground Logic Inputs</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div><label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>Runtime (m)</label>
                                    <input type="number" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '14px', fontWeight: '700' }} value={data.master.total_run} onChange={(e) => handleTimeChange('run', e.target.value)} /></div>
                                    <div><label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>Stoptime (m)</label>
                                    <input type="number" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '14px', fontWeight: '700' }} value={data.master.total_stop} onChange={(e) => handleTimeChange('stop', e.target.value)} /></div>
                                </div>
                                <div><label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>Total Product</label>
                                <input type="number" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '14px', fontWeight: '700' }} value={data.master.total_product} onChange={(e) => handleOutputChange('total', e.target.value)} /></div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div><label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>Good</label>
                                    <input type="number" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '14px', fontWeight: '700' }} value={data.master.total_good} onChange={(e) => handleOutputChange('good', e.target.value)} /></div>
                                    <div><label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>Reject</label>
                                    <input type="number" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '14px', fontWeight: '700' }} value={data.master.reject} onChange={(e) => handleOutputChange('rej', e.target.value)} /></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                            {[
                                { l: "AVAILABILITY", c: c.avail, o: o.avail, i: Clock, clr: "#3b82f6" },
                                { l: "PERFORMANCE", c: c.perf, o: o.perf, i: Gauge, clr: "#8b5cf6" },
                                { l: "QUALITY", c: c.qual, o: o.qual, i: Package, clr: "#10b981" }
                            ].map(p => (
                                <div key={p.l} style={{ background: '#fff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
                                        <div style={{ backgroundColor: `${p.clr}15`, padding: '6px', borderRadius: '6px' }}><p.i size={14} color={p.clr} /></div>
                                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b' }}>{p.l}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                        <div><div style={{ fontSize: '9px', color: '#cbd5e1' }}>Old</div><div style={{ fontSize: '14px', fontWeight: '600', color: '#94a3b8' }}>{f(p.o, 2)}%</div></div>
                                        <ArrowRightLeft size={12} color="#f1f5f9" />
                                        <div style={{ textAlign: 'right' }}><div style={{ fontSize: '9px', color: '#94a3b8' }}>Manual</div><div style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b' }}>{f(p.c, 2)}%</div></div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ backgroundColor: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                            <div style={{ padding: '20px 30px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#334155' }}>DOWNTIME LOG OVERRIDE</h4>
                                <button onClick={() => setData({...data, events: [...data.events, { id: Date.now(), start_time: new Date(), duration_minutes: 0, category: 'Planned', reason_id: reasons[0]?.id }]})} style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '8px 16px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Plus size={14} /> Add Manual Row
                                </button>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ backgroundColor: '#fcfcfd', textAlign: 'left', borderBottom: '1px solid #f1f5f9' }}>
                                    <tr>
                                        <th style={{ padding: '15px 30px', fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Time</th>
                                        <th style={{ padding: '15px 30px', fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Duration</th>
                                        <th style={{ padding: '15px 30px', fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Type</th>
                                        <th style={{ padding: '15px 30px', fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Reason</th>
                                        <th style={{ padding: '15px 30px', textAlign: 'right' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.events.map((ev, idx) => (
                                        <tr key={ev.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                                            <td style={{ padding: '15px 30px', fontSize: '13px' }}>{new Date(ev.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</td>
                                            <td style={{ padding: '15px 30px' }}><input type="number" style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box', fontSize: '13px', fontWeight: '600' }} value={ev.duration_minutes} onChange={(e) => {
                                                const updated = [...data.events];
                                                updated[idx].duration_minutes = e.target.value;
                                                setData({...data, events: updated});
                                            }} /></td>
                                            <td style={{ padding: '15px 30px' }}><span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '900', background: ev.category === 'Planned' ? '#dcfce7' : '#fee2e2', color: ev.category === 'Planned' ? '#166534' : '#991b1b' }}>{ev.category}</span></td>
                                            <td style={{ padding: '15px 30px' }}>
                                                <select style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box', fontSize: '13px', fontWeight: '600' }} value={ev.reason_id} onChange={(e) => {
                                                    const updated = [...data.events];
                                                    updated[idx].reason_id = e.target.value;
                                                    const res = reasons.find(r => r.id === parseInt(e.target.value));
                                                    if (res) updated[idx].category = res.default_category;
                                                    setData({...data, events: updated});
                                                }}>
                                                    {reasons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                                </select>
                                            </td>
                                            <td style={{ padding: '15px 30px', textAlign: 'right' }}>
                                                <button onClick={() => setData({...data, events: data.events.filter((_, i) => i !== idx)})} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div style={{ padding: '25px 30px', background: '#fcfcfd' }}>
                                <button 
                                    onClick={handleSave}
                                    disabled={loading}
                                    style={{ 
                                        width: '100%', 
                                        padding: '18px', 
                                        background: loading ? '#94a3b8' : '#ef4444', 
                                        color: '#fff', 
                                        border: 'none', 
                                        borderRadius: '14px', 
                                        fontWeight: '900', 
                                        fontSize: '15px', 
                                        cursor: loading ? 'not-allowed' : 'pointer', 
                                        display: 'flex', 
                                        justifyContent: 'center', 
                                        gap: '10px', 
                                        boxShadow: '0 10px 15px -3px rgba(239, 68, 68, 0.2)',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    {loading ? 'SYNCHRONIZING...' : <><Save size={18} /> UPDATE SHIFT REALITY</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70vh', color: '#94a3b8' }}>
                    <Search size={64} style={{ opacity: 0.1, marginBottom: '15px' }} />
                    <p style={{ fontWeight: '500' }}>Search Date and Shift to load telemetry data</p>
                </div>
            )}
        </div>
    );
};

export default OverrideManager;