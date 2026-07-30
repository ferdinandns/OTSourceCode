import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { Activity, Trash2, Equal, Save, ChevronDown, ChevronUp, Calculator } from 'lucide-react';

const DayOverrideManager = () => {
    // --- HELPER: GET LOCAL DATE (YYYY-MM-DD) ---
    const getLocalToday = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // --- HELPER: GENERATE EMPTY DAY STRUCTURE ---
    const generateEmptyDay = () => {
        const emptyShift = {
            master: {
                total_run: 0, total_stop: 0, total_product: 0, reject: 0,
                planned_stop: 0, unplanned_stop: 0, 
                production_date: getLocalToday()
            },
            events: []
        };
        return { '1': { ...emptyShift }, '2': { ...emptyShift }, '3': { ...emptyShift } };
    };

    // --- STATE ---
    const [searchDate, setSearchDate] = useState(getLocalToday());
    const [dayData, setDayData] = useState(null);
    const [activeTab, setActiveTab] = useState('1'); 
    const [loading, setLoading] = useState(false);
    const [reasons, setReasons] = useState([]);
    const [originalDayData, setOriginalDayData] = useState(null);
    const [showLogic, setShowLogic] = useState(false);

    const API_BASE = "http://10.126.15.197:8002/part";
    const TARGET_RATE = 5333;
    const SHIFT_DURATIONS = { 1: 510, 2: 465, 3: 465 };

    // --- AUTO-FETCH ON MOUNT ---
    useEffect(() => {
        fetchDay(); 
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); 

    // --- FORMATTER ---
    const f = (val, dec = 2) => {
        const num = parseFloat(val);
        return isNaN(num) ? (0).toFixed(dec) : num.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
    };

    // --- FETCH DATA ---
    const fetchDay = async () => {
        setLoading(true);
        try {
            const [dayRes, reasonRes] = await Promise.all([
                axios.get(`${API_BASE}/getOverrideDayData?date=${searchDate}`),
                axios.get(`${API_BASE}/getDowntimeReasons`)
            ]);

            if (dayRes.data && Object.keys(dayRes.data).length > 0) {
                setDayData(dayRes.data);
                setOriginalDayData(JSON.parse(JSON.stringify(dayRes.data))); 
            } else {
                const empty = generateEmptyDay();
                setDayData(empty);
                setOriginalDayData(empty);
            }
            setReasons(reasonRes.data);

        } catch (err) {
            console.warn("Fetch failed, initializing empty day.", err);
            const empty = generateEmptyDay();
            setDayData(empty);
            setOriginalDayData(empty);
        } finally {
            setLoading(false);
        }
    };

    // --- CALCULATION LOGIC ---
    const calculateOEE = (master, shiftId) => {
        if (!master) return { oee: 0, avail: 0, perf: 0, qual: 0, run: 0, out: 0, rej: 0, plan: 0, time: 510, good: 0 };
        
        const run = parseFloat(master.total_run) || 0;
        const out = parseFloat(master.total_product) || 0;
        const rej = parseFloat(master.reject) || 0;
        const time = SHIFT_DURATIONS[shiftId] || 510;

        let plan = parseFloat(master.planned_stop);
        if (isNaN(plan)) plan = 0; // Ground truth from DB column

        const availDenom = time - plan;
        const avail = availDenom > 0 ? (run / availDenom) * 100 : 0;
        const pot = run * TARGET_RATE;
        const perf = pot > 0 ? (out / pot) * 100 : 0;
        const qual = out > 0 ? ((out - rej) / out) * 100 : 0;
        
        // Return good product count for the Active Logic check
        return { oee: (avail * perf * qual) / 10000, avail, perf, qual, run, out, rej, plan, time, pot, good: out - rej };
    };

    // --- MEMOIZED DAILY TOTALS (WITH ACTIVE SHIFT LOGIC) ---
    const dailyStats = useMemo(() => {
        if (!dayData) return { oee: 0, avail: 0, perf: 0, qual: 0, run:0, out:0, rej:0, plan:0, time:0 };
        
        let d = { run: 0, out: 0, rej: 0, plan: 0, time: 0 };
        let activeShiftsCount = 0;
        
        Object.keys(dayData).forEach(key => {
            const s = dayData[key];
            if (s && s.master) {
                const stats = calculateOEE(s.master, key);
                
                // --- ACTIVE SHIFT LOGIC ---
                // Only include this shift in Daily Aggregation if it has started running.
                // Condition: Runtime >= 5 mins OR Good Products > 0
                const isActive = stats.run >= 5 || stats.good > 0;

                if (isActive) {
                    d.run += stats.run; 
                    d.out += stats.out; 
                    d.rej += stats.rej; 
                    d.plan += stats.plan; 
                    d.time += stats.time; // Only add shift time if active!
                    activeShiftsCount++;
                }
            }
        });

        // Prevent NaN if day hasn't started
        if (activeShiftsCount === 0) return { oee: 0, avail: 0, perf: 0, qual: 0, run:0, out:0, rej:0, plan:0, time:0 };

        const availDenom = d.time - d.plan;
        const avail = availDenom > 0 ? (d.run / availDenom) * 100 : 0;
        const perf = (d.run * TARGET_RATE) > 0 ? (d.out / (d.run * TARGET_RATE)) * 100 : 0;
        const qual = d.out > 0 ? ((d.out - d.rej) / d.out) * 100 : 0;

        return { ...d, oee: (avail * perf * qual) / 10000, avail, perf, qual };
    }, [dayData]);

    // --- HANDLERS ---
    const updateMaster = (key, val) => {
        if (!dayData) return;
        const updated = { ...dayData };
        const shiftId = activeTab;
        const shiftTime = SHIFT_DURATIONS[shiftId];
        
        if (!updated[shiftId].master) updated[shiftId].master = {};

        updated[shiftId].master[key] = val;

        if (key === 'total_run') updated[shiftId].master.total_stop = shiftTime - (parseFloat(val) || 0);
        else if (key === 'total_stop') updated[shiftId].master.total_run = shiftTime - (parseFloat(val) || 0);

        setDayData(updated);
    };

    const handleSave = async () => {
        if (!dayData) return;
        const current = dayData[activeTab];
        const finalShiftStats = calculateOEE(current.master, activeTab);

        // 1. GET TOKEN
        const token = localStorage.getItem('user_token'); 
        
        const masterWithNewOEE = {
            ...current.master,
            planned_stop: parseFloat(current.master.planned_stop) || 0,
            unplanned_stop: parseFloat(current.master.unplanned_stop) || 0,
            
            availability_value_shift: finalShiftStats.avail,
            performance_value_shift: finalShiftStats.perf,
            quality_value_shift: finalShiftStats.qual,
            oee_value_shift: finalShiftStats.oee,
            
            availability_value_daily: dailyStats.avail,
            performance_value_daily: dailyStats.perf,
            quality_value_daily: dailyStats.qual,
            oee_value_daily: dailyStats.oee
        };

        const reason = window.prompt(`REASON FOR SHIFT ${activeTab} OVERRIDE:`);
        if (!reason || reason.length < 5) return alert("Valid reason required.");

        setLoading(true);
        try {
            await axios.post(
                `${API_BASE}/saveOverrideData`, 
                {
                    master: masterWithNewOEE,
                    events: current.events,
                    changeReason: reason,
                    daily_recalc: dailyStats,
                    all_shift_ids: Object.keys(dayData).map(k => dayData[k].master?.id).filter(id => id),
                    originalFullDay: originalDayData, 
                    updatedFullDay: { ...dayData, [activeTab]: { ...current, master: masterWithNewOEE } }   
                },
                // 2. SEND HEADERS HERE
                {
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            alert("✅ Success: Ground Truth Updated.");
            fetchDay(); 
        } catch (err) {
            alert("Save failed: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const s1 = dayData ? calculateOEE(dayData['1']?.master, '1') : null;
    const s2 = dayData ? calculateOEE(dayData['2']?.master, '2') : null;
    const s3 = dayData ? calculateOEE(dayData['3']?.master, '3') : null;
    const currentStats = dayData ? calculateOEE(dayData[activeTab]?.master, activeTab) : { oee:0, avail:0, perf:0, qual:0 };

    return (
        <div style={{ backgroundColor: '#f1f5f9', minHeight: '100vh', fontFamily: 'Inter, sans-serif', paddingBottom: '100px' }}>
            {/* Nav */}
            <nav style={{ background: '#fff', padding: '12px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ padding: '8px', background: '#0f172a', borderRadius: '10px' }}><Activity size={18} color="#fff" /></div>
                    <span style={{ fontWeight: '800', fontSize: '15px', color: '#0f172a' }}>OEE DAILY CONTEXT</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '4px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <input type="date" value={searchDate} onChange={e => setSearchDate(e.target.value)} style={{ border: 'none', background: 'transparent', padding: '8px 12px', fontSize: '13px', fontWeight: '700', outline: 'none' }} />
                    <button onClick={fetchDay} style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}>
                        {loading ? 'Fetching...' : 'Fetch Day'}
                    </button>
                </div>
            </nav>

            <div style={{ maxWidth: '1400px', margin: '30px auto', padding: '0 40px' }}>
                
                {/* Top Scoreboard */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                    <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '30px', borderRadius: '24px', color: '#fff' }}>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', marginBottom: '8px' }}>24H DAILY OEE</div>
                        <div style={{ fontSize: '52px', fontWeight: '900' }}>{f(dailyStats.oee)}%</div>
                    </div>
                    <MetricTop label="Availability" val={f(dailyStats.avail)} color="#3b82f6" />
                    <MetricTop label="Performance" val={f(dailyStats.perf)} color="#8b5cf6" />
                    <MetricTop label="Quality" val={f(dailyStats.qual)} color="#10b981" />
                </div>

                {/* TAB SELECTOR */}
                <div style={{ display: 'flex', background: '#e2e8f0', padding: '4px', borderRadius: '14px', marginBottom: '20px', width: 'fit-content' }}>
                    {['1', '2', '3'].map(num => (
                        <button key={num} onClick={() => setActiveTab(num)} style={{ 
                            padding: '10px 30px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '800', fontSize: '13px',
                            background: activeTab === num ? '#fff' : 'transparent', color: activeTab === num ? '#0f172a' : '#64748b'
                        }}>SHIFT {num}</button>
                    ))}
                </div>

                {/* MAIN OVERRIDE & PREVIEW CONTAINER */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '40px' }}>
                    
                    {/* LEFT: INPUTS (GROUND TRUTH) */}
                    <div style={{ background: '#fff', borderRadius: '24px', padding: '30px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#0f172a' }}>SHIFT {activeTab} OVERRIDE</h3>
                            <button onClick={handleSave} disabled={loading} style={{ 
                                background: loading ? '#94a3b8' : '#ef4444', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '10px', fontWeight: '800', fontSize: '12px', display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer' 
                            }}>
                                <Save size={16} /> {loading ? 'SAVING...' : 'COMMIT CHANGES'}
                            </button>
                        </div>

                        <h4 style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '15px' }}>TIME METRICS (MIN)</h4>
                        <InputBlock label="Run Time" val={dayData?.[activeTab]?.master?.total_run} onChange={v => updateMaster('total_run', v)} unit="m" />
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '15px' }}>
                            <InputBlock label="Planned Stop" val={dayData?.[activeTab]?.master?.planned_stop} onChange={v => updateMaster('planned_stop', v)} unit="m" />
                            <InputBlock label="Unplanned Stop" val={dayData?.[activeTab]?.master?.unplanned_stop} onChange={v => updateMaster('unplanned_stop', v)} unit="m" />
                        </div>

                        <h4 style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '15px', marginTop: '25px' }}>PRODUCTION METRICS (PCS)</h4>
                        <InputBlock label="Total Output" val={dayData?.[activeTab]?.master?.total_product} onChange={v => updateMaster('total_product', v)} unit="pcs" />
                        <InputBlock label="Total Rejects" val={dayData?.[activeTab]?.master?.reject} onChange={v => updateMaster('reject', v)} unit="pcs" />
                    </div>

                    {/* RIGHT: LIVE PREVIEW & LOGIC */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <MetricCard label="Availability" val={f(currentStats.avail)} color="#3b82f6" />
                            <MetricCard label="Performance" val={f(currentStats.perf)} color="#8b5cf6" />
                            <MetricCard label="Quality" val={f(currentStats.qual)} color="#10b981" />
                            <div style={{ background: '#0f172a', borderRadius: '20px', padding: '25px', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <div style={{ fontSize: '11px', fontWeight: '700', opacity: 0.7, marginBottom: '5px' }}>PROJECTED OEE</div>
                                <div style={{ fontSize: '32px', fontWeight: '900' }}>{f(currentStats.oee)}%</div>
                            </div>
                        </div>

                        <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                            <div onClick={() => setShowLogic(!showLogic)} style={{ padding: '20px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: showLogic ? '#f8fafc' : '#fff' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Calculator size={18} color="#64748b" />
                                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#475569' }}>Shift Calculation Logic</span>
                                </div>
                                {showLogic ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
                            </div>
                            
                            {showLogic && (
                                <div style={{ padding: '0 25px 25px 25px', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px', marginTop: '15px' }}>
                                        <LogicRow label="Availability" formula="Run / (ShiftTime - Planned)" calc={`${f(currentStats.run,0)} / (${currentStats.time} - ${f(currentStats.plan,0)})`} result={`${f(currentStats.avail)}%`} />
                                        <LogicRow label="Performance" formula="Output / (Run × 5333)" calc={`${f(currentStats.out,0)} / (${f(currentStats.run,0)} × 5333)`} result={`${f(currentStats.perf)}%`} />
                                        <LogicRow label="Quality" formula="(Output - Rejects) / Output" calc={`(${f(currentStats.out,0)} - ${f(currentStats.rej,0)}) / ${f(currentStats.out,0)}`} result={`${f(currentStats.qual)}%`} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* DAILY AGGREGATION & PROOF */}
                <div style={{ background: '#fff', borderRadius: '24px', padding: '30px', border: '1px solid #e2e8f0', marginBottom: '30px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#64748b', marginBottom: '20px' }}>24H DAILY AGGREGATION</h3>
                    <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '30px' }}>
                        <thead style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase' }}>
                            <tr><th>Shift</th><th>Run</th><th>Plan</th><th>Output</th><th>Rejects</th></tr>
                        </thead>
                        <tbody style={{ fontWeight: '700', color: '#334155' }}>
                            {[s1, s2, s3].map((s, i) => {
                                // Check if shift is active to grey it out visually or mark it
                                const isActive = s && (s.run >= 5 || (s.out - s.rej) > 0);
                                return s && (
                                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', opacity: isActive ? 1 : 0.4 }}>
                                        <td style={{ padding: '12px 0' }}>Shift {i+1} {!isActive && <span style={{fontSize:'9px', background:'#e2e8f0', padding:'2px 6px', borderRadius:'4px', marginLeft:'5px'}}>INACTIVE</span>}</td>
                                        <td>{f(s.run,0)}</td>
                                        <td>{f(s.plan,0)}</td>
                                        <td>{f(s.out,0)}</td>
                                        <td>{f(s.rej,0)}</td>
                                    </tr>
                                );
                            })}
                            <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                                <td style={{ padding: '15px 10px', color: '#0f172a' }}>TOTAL</td>
                                <td style={{ color: '#3b82f6' }}>{f(dailyStats.run,0)}</td>
                                <td>{f(dailyStats.plan,0)}</td>
                                <td style={{ color: '#8b5cf6' }}>{f(dailyStats.out,0)}</td>
                                <td style={{ color: '#ef4444' }}>{f(dailyStats.rej,0)}</td>
                            </tr>
                        </tbody>
                    </table>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                        <CalcBox label="Daily Avail" top={f(dailyStats.run,0)} bottom={f(dailyStats.time - dailyStats.plan,0)} result={f(dailyStats.avail)} />
                        <CalcBox label="Daily Perf" top={f(dailyStats.out,0)} bottom={f(dailyStats.run * TARGET_RATE,0)} result={f(dailyStats.perf)} />
                        <CalcBox label="Daily Qual" top={f(dailyStats.out - dailyStats.rej,0)} bottom={f(dailyStats.out,0)} result={f(dailyStats.qual)} />
                    </div>
                </div>

                {/* DOWNTIME LOGS */}
                <div style={{ background: '#fff', borderRadius: '24px', padding: '30px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#0f172a' }}>Event Stream (Logs)</h3>
                        <div style={{fontSize: '11px', color: '#94a3b8', fontStyle: 'italic'}}>*Logs are for reference and do not affect calculated OEE.</div>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr style={{ textAlign: 'left', color: '#94a3b8', fontSize: '11px' }}><th style={{ padding: '12px' }}>MIN</th><th>TYPE</th><th>REASON</th><th></th></tr></thead>
                        <tbody>
                            {dayData?.[activeTab]?.events?.map((ev, idx) => (
                                <tr key={ev.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                                    <td style={{ padding: '10px' }}>
                                        <input type="number" value={ev.duration_minutes} readOnly style={{ width: '60px', padding: '6px', borderRadius: '6px', border: '1px solid #e2e8f0', fontWeight: '700', background: '#f1f5f9', color: '#94a3b8' }} />
                                    </td>
                                    <td><span style={{ fontSize: '9px', fontWeight: '900', padding: '4px 8px', borderRadius: '6px', background: ev.category === 'Planned' ? '#dcfce7' : '#fee2e2', color: ev.category === 'Planned' ? '#166534' : '#991b1b' }}>{ev.category}</span></td>
                                    <td style={{fontSize: '12px', fontWeight: '700', color: '#475569'}}>
                                        {reasons.find(r => r.id == ev.reason_id)?.name || 'Unknown'}
                                    </td>
                                    <td style={{ textAlign: 'right' }}></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    );
};

// --- SUB-COMPONENTS ---
const MetricCard = ({ label, val, color }) => (
    <div style={{ background: '#fff', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
        <p style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', margin: '0 0 5px 0' }}>{label.toUpperCase()}</p>
        <p style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a', margin: 0 }}>{val}%</p>
        <div style={{ height: '4px', background: `${color}20`, borderRadius: '10px', marginTop: '10px' }}>
            <div style={{ width: `${val}%`, background: color, height: '100%', borderRadius: '10px' }} />
        </div>
    </div>
);

const MetricTop = ({ label, val, color }) => (
    <div style={{ background: '#fff', padding: '25px', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
        <p style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', margin: '0 0 8px 0' }}>{label.toUpperCase()}</p>
        <p style={{ fontSize: '32px', fontWeight: '900', color: '#0f172a', margin: 0 }}>{val}%</p>
        <div style={{ height: '4px', background: `${color}20`, borderRadius: '10px', marginTop: '10px' }}>
            <div style={{ width: `${val}%`, background: color, height: '100%', borderRadius: '10px' }} />
        </div>
    </div>
);

const InputBlock = ({ label, val, onChange, unit }) => (
    <div>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '6px' }}>{label}</label>
        <div style={{ position: 'relative' }}>
            <input type="number" value={val || 0} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: '800', fontSize: '16px', outline: 'none', color: '#0f172a' }} />
            <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>{unit}</span>
        </div>
    </div>
);

const LogicRow = ({ label, formula, calc, result }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 60px', alignItems: 'center', fontSize: '11px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
        <div style={{ fontWeight: '800', color: '#64748b' }}>{label}</div>
        <div style={{ fontStyle: 'italic', color: '#94a3b8' }}>{formula}</div>
        <div style={{ fontFamily: 'monospace', color: '#475569' }}>{calc}</div>
        <div style={{ fontWeight: '900', color: '#0f172a', textAlign: 'right' }}>{result}</div>
    </div>
);

const CalcBox = ({ label, top, bottom, result }) => (
    <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
        <p style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', margin: '0 0 10px 0' }}>{label.toUpperCase()}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <div style={{ fontSize: '12px', fontWeight: '700' }}>
                <div style={{ borderBottom: '1px solid #cbd5e1', padding: '2px 5px' }}>{top}</div>
                <div style={{ padding: '2px 5px' }}>{bottom}</div>
            </div>
            <Equal size={14} color="#cbd5e1" />
            <div style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a' }}>{result}%</div>
        </div>
    </div>
);

export default DayOverrideManager;