const {
  post,
  db4,
  db3,
  db2,
  db,
  dbTest,
  query,
  query2,
  query3,
  query4,
  query5,
} = require("../database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("../helpers/nodemailers");
const { request, response } = require("express");
const { log } = require("util");
const { data } = require("jquery");
const { timestamp } = require("node-opcua");
const mysql = require("mysql2/promise");
const cors = require("cors");
const express = require("express");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const libre = require("libreoffice-convert");
const { execFile } = require('child_process');
const downsample = require('downsample-lttb');


const path = require('path'); // <--- ADD THIS LINE
const readline = require('readline');


const app = express(); // Tambahkan ini jika belum ada

const fs = require('fs');
const csv = require('csv-parser');

//db  = 55, paramachine_saka
//db2 = 55, ems_saka
//db3 =  138, parmammachine
//db4 = 138,ems_saka

const corsOptions = {
  origin: "http://http://10.126.15.7:3000/", // Ganti dengan domain Grafana Anda
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

const CSV_FILE_PATH = 'C:\\Users\\Acer\\Documents\\GitHub\\engineering1\\src\\backend\\excel\\PMP MAINTENANCE 2025 - NOV 25.csv';
const DB_TABLE_NAME = 'extracted_maintenance_data'; 
const HEADER_ROW_INDEX = 5;
const FINAL_COLUMNS = ['machine_name', 'asset_number', 'wo_no'];

const processArchiveForShift = async (dateStr, shiftNum) => {
    // A. Define Times & Convert to Timestamps (Numbers)
    const getShiftRange = (dStr, sNum) => {
        const nextDay = new Date(dStr); 
        nextDay.setDate(nextDay.getDate() + 1);
        const nextStr = nextDay.toISOString().split('T')[0];
        
        let startStr, endStr;

        if (sNum === 1) { startStr = `${dStr} 06:30:00`; endStr = `${dStr} 15:00:00`; }
        else if (sNum === 2) { startStr = `${dStr} 15:00:00`; endStr = `${dStr} 22:45:00`; }
        else if (sNum === 3) { startStr = `${dStr} 22:45:00`; endStr = `${nextStr} 06:30:00`; }

        // Convert to Unix Timestamp (Seconds) for DB Query
        // (Includes the / 1000 fix for your database)
        return { 
            start: new Date(startStr).getTime() / 1000, 
            end: new Date(endStr).getTime() / 1000,
            startStr: startStr 
        };
    };

    const currentShiftRange = getShiftRange(dateStr, shiftNum);
    const allShifts = [getShiftRange(dateStr, 1), getShiftRange(dateStr, 2), getShiftRange(dateStr, 3)];

    // B. Query Raw DB (`CMT-VIBRATION_oee_fette_mentah_data`)
    const queries = [currentShiftRange, ...allShifts].map(range => {
        const sql = `
            SELECT 
                MAX(data_format_0) as max_run,       MIN(data_format_0) as min_run,
                MAX(data_format_4) as max_prod,      MIN(data_format_4) as min_prod,
                MAX(data_format_2) as max_planned,   MIN(data_format_2) as min_planned,
                MAX(data_format_3) as max_unplanned, MIN(data_format_3) as min_unplanned,
                MAX(data_format_6) as max_reject,    MIN(data_format_6) as min_reject
            FROM \`CMT-VIBRATION_oee_fette_mentah_data\` 
            WHERE \`time@timestamp\` BETWEEN ? AND ?
        `;
        return new Promise((resolve, reject) => {
            db4.query(sql, [range.start, range.end], (err, res) => {
                if (err) return reject(err);
                // Calculate duration in minutes (using SECONDS timestamps: divide by 60)
                const duration = (range.end - range.start) / 60; 
                resolve({ ...res[0], duration });
            });
        });
    });

    const [shiftResult, s1Res, s2Res, s3Res] = await Promise.all(queries);

    // C. Calculate Stats
    const calculateStats = (resultsArray) => {
        let tRun = 0, tUnplan = 0, tPlan = 0, tTime = 0, tOut = 0, tRej = 0;
        const list = Array.isArray(resultsArray) ? resultsArray : [resultsArray];

        list.forEach(r => {
            tRun += (r.max_run || 0) - (r.min_run || 0);
            tUnplan += (r.max_unplanned || 0) > 0 ? (r.max_unplanned - r.min_unplanned) : 0;
            tPlan += (r.max_planned || 0) - (r.min_planned || 0);
            tOut += (r.max_prod || 0) - (r.min_prod || 0);
            tRej += (r.max_reject || 0) - (r.min_reject || 0);
            tTime += r.duration; 
        });

        // Calculate Stop Time (Total Time - Run Time)
        const tStop = tTime - tRun; 

        const avail = tTime - tPlan > 0 ? ((tRun - tUnplan) / (tTime - tPlan)) * 100 : 0;
        const perf = (tRun * 5800) > 0 ? (tOut / (tRun * 5800)) * 100 : 0; // Updated Target Rate to 5800
        const qual = tOut > 0 ? ((tOut - tRej) / tOut) * 100 : 0;
        const oee = (avail * perf * qual) / 10000;

        return { avail, perf, qual, oee, tOut, tRej, tGood: tOut - tRej, tTime, tRun, tStop };
    };

    const shiftStats = calculateStats(shiftResult);
    const dailyStats = calculateStats([s1Res, s2Res, s3Res]);

    // D. Integers for HMI
    const toInt = (val) => Math.round(val * 100);

    const hmi = {
        avail: toInt(shiftStats.avail), 
        perf: toInt(shiftStats.perf), 
        qual: toInt(shiftStats.qual), 
        oee: toInt(shiftStats.oee), 
    };

    // E. Insert (CLEANED UP - No "...value2")
    const sqlInsert = `
        INSERT INTO oee_master_logs (
            production_date, shift_name,
            availability_value_shift, availability_value_daily,
            performance_value_shift, performance_value_daily,
            quality_value_shift, quality_value_daily,
            oee_value_shift, oee_value_daily,
            hmi_avail_value, hmi_perf_value, 
            hmi_qual_value, hmi_oee_shift_value, 
            total_product, total_good, reject,
            total_shift_time, total_run, total_stop
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
            availability_value_shift = VALUES(availability_value_shift),
            availability_value_daily = VALUES(availability_value_daily),
            performance_value_shift = VALUES(performance_value_shift),
            performance_value_daily = VALUES(performance_value_daily),
            quality_value_shift = VALUES(quality_value_shift),
            quality_value_daily = VALUES(quality_value_daily),
            oee_value_shift = VALUES(oee_value_shift),
            oee_value_daily = VALUES(oee_value_daily),
            hmi_avail_value = VALUES(hmi_avail_value),
            hmi_perf_value = VALUES(hmi_perf_value),
            hmi_qual_value = VALUES(hmi_qual_value),
            hmi_oee_shift_value = VALUES(hmi_oee_shift_value),
            total_product = VALUES(total_product),
            total_good = VALUES(total_good),
            reject = VALUES(reject),
            total_shift_time = VALUES(total_shift_time),
            total_run = VALUES(total_run),
            total_stop = VALUES(total_stop)
    `;

    const values = [
        currentShiftRange.startStr, 
        shiftNum,
        
        shiftStats.avail, dailyStats.avail,
        shiftStats.perf, dailyStats.perf,
        shiftStats.qual, dailyStats.qual,
        shiftStats.oee, dailyStats.oee,
        
        hmi.avail, // Removed hmi.avail2
        hmi.perf,  // Removed hmi.perf2
        hmi.qual,  // Removed hmi.qual2
        hmi.oee,   // Removed hmi.oee2

        shiftStats.tOut, 
        shiftStats.tGood, 
        shiftStats.tRej,

        // NEW COLUMNS DATA
        shiftStats.tTime, 
        shiftStats.tRun,  
        shiftStats.tStop  
    ];

    await new Promise((resolve, reject) => db4.query(sqlInsert, values, (err) => err ? reject(err) : resolve()));
    return { shiftStats, dailyStats, hmi };
};


// --- HELPER: Saves OEE Data (Fills ALL Columns + Correct Timestamps) ---
// --- HELPER: Saves OEE Data (Fills ALL Columns + Correct Timestamps) ---
const saveToLog = (dateStr, shiftNum, shiftData, dailyData) => {
    return new Promise((resolve, reject) => {
        const safeInt = (val) => Math.round(val || 0);

        let timestampStr = dateStr; 
        if (shiftNum === 1) timestampStr = `${dateStr} 06:30:00`;
        else if (shiftNum === 2) timestampStr = `${dateStr} 15:00:00`;
        else if (shiftNum === 3) timestampStr = `${dateStr} 22:45:00`;

        const hmi_avail = safeInt(shiftData.avail * 100);
        const hmi_perf  = safeInt(shiftData.perf * 100);
        const hmi_qual  = safeInt(shiftData.qual * 100);
        const hmi_oee   = safeInt(shiftData.oee * 100);

        const sqlInsert = `
            INSERT INTO oee_master_logs (
                production_date, shift_name,
                availability_value_shift, performance_value_shift, quality_value_shift, oee_value_shift,
                availability_value_daily, performance_value_daily, quality_value_daily, oee_value_daily,
                hmi_avail_value, hmi_perf_value, hmi_qual_value, hmi_oee_shift_value,
                total_product, total_good, reject,
                total_shift_time, total_run, total_stop,
                planned_dur, unplanned_dur
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                production_date = VALUES(production_date),
                availability_value_shift = VALUES(availability_value_shift),
                performance_value_shift = VALUES(performance_value_shift),
                quality_value_shift = VALUES(quality_value_shift),
                oee_value_shift = VALUES(oee_value_shift),
                availability_value_daily = VALUES(availability_value_daily),
                performance_value_daily = VALUES(performance_value_daily),
                quality_value_daily = VALUES(quality_value_daily),
                oee_value_daily = VALUES(oee_value_daily),
                hmi_avail_value = VALUES(hmi_avail_value),
                hmi_perf_value = VALUES(hmi_perf_value),
                hmi_qual_value = VALUES(hmi_qual_value),
                hmi_oee_shift_value = VALUES(hmi_oee_shift_value),
                total_product = VALUES(total_product),
                total_good = VALUES(total_good),
                reject = VALUES(reject),
                total_shift_time = VALUES(total_shift_time),
                total_run = VALUES(total_run),
                total_stop = VALUES(total_stop),
                planned_dur = VALUES(planned_dur),
                unplanned_dur = VALUES(unplanned_dur)
        `;

        const values = [
            timestampStr, 
            shiftNum,
            shiftData.avail, shiftData.perf, shiftData.qual, shiftData.oee,
            dailyData.avail, dailyData.perf, dailyData.qual, dailyData.oee,
            hmi_avail, hmi_perf, hmi_qual, hmi_oee,
            shiftData.tOut, shiftData.tGood, shiftData.tRej,
            shiftData.tTime, shiftData.tRun, shiftData.tStop,
            shiftData.tPlan, shiftData.tUnplan // ✅ New columns mapped here
        ];

        db4.query(sqlInsert, values, (err) => {
            if (err) {
                console.error(`❌ DB Write Error (Shift ${shiftNum}):`, err.message);
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

    const formatStats = (s) => ({
    oee: s.oee.toFixed(2) + "%",
    availability: s.avail.toFixed(2) + "%",
    performance: s.perf.toFixed(2) + "%",
    quality: s.qual.toFixed(2) + "%",
    stats: s // Raw numbers
});

const performSyncForDate = async (dayStr) => {
    const nextDate = new Date(dayStr);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDayStr = nextDate.toISOString().split('T')[0];

    const shiftsDef = [
        { id: 1, start: `${dayStr} 06:30:00`, time: "06:30:00" },
        { id: 2, start: `${dayStr} 15:00:00`, time: "15:00:00" },
        { id: 3, start: `${dayStr} 22:45:00`, time: "22:45:00" }
    ];

    for (const s of shiftsDef) {
        const OFFSET = 7 * 3600;
        const startTs = (new Date(s.start).getTime() / 1000) + OFFSET;
        // Shift 3 ends the next day at 06:30
        const endTs = s.id === 3 
            ? (new Date(`${nextDayStr} 06:30:00`).getTime() / 1000) + OFFSET
            : (new Date(`${dayStr} ${s.id === 1 ? '15:00:00' : '22:45:00'}`).getTime() / 1000) + OFFSET;

        const sqlExtract = `
            SELECT data_format_0 as run_time, data_format_1 as stop_time, 
                   data_format_2 as planned, data_format_3 as unplanned,
                   data_format_4 as total_prod, data_format_5 as total_good,
                   data_format_6 as rejects
            FROM \`CMT-VIBRATION_oee_fette_mentaj_data\` 
            WHERE \`time@timestamp\` BETWEEN ? AND ?
            ORDER BY \`time@timestamp\` DESC LIMIT 1`;

        await new Promise((resolve, reject) => {
            db4.query(sqlExtract, [startTs, endTs], (err, results) => {
                if (err) return reject(err);
                const row = results[0] || { run_time: 0, stop_time: 0, planned: 0, unplanned: 0, total_prod: 0, total_good: 0, rejects: 0 };
                
                const fullLogDateTime = `${dayStr} ${s.time}`;
                const sqlLoad = `
                    INSERT INTO fette_shift_logs 
                    (log_date, shift_id, run_time, stop_time, total_prod, total_good, reject_count, planned_stop, unplanned_stop)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE 
                        run_time = VALUES(run_time), stop_time = VALUES(stop_time),
                        total_prod = VALUES(total_prod), total_good = VALUES(total_good),
                        reject_count = VALUES(reject_count), planned_stop = VALUES(planned_stop),
                        unplanned_stop = VALUES(unplanned_stop), last_updated_by = 'BACKFILL'`;

                db4.query(sqlLoad, [fullLogDateTime, s.id, row.run_time, row.stop_time, row.total_prod, row.total_good, row.rejects, row.planned, row.unplanned], (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
        });
    }
  };

  // 1. Format Unix Seconds to Readable Date (WIB)
const formatTimestampWIB = (unix_ts_seconds) => {
    if (!unix_ts_seconds) return null;
    const date = new Date(unix_ts_seconds * 1000); 
    return date.toLocaleString('id-ID', { 
        timeZone: 'Asia/Jakarta', 
        year: 'numeric', month: '2-digit', day: '2-digit', 
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    }).replace(/\//g, '-').replace(',', '');
};

// 2. Format Unix Seconds to Readable Date (Local System Time)
const formatTimestampLocal = (unix_ts_seconds) => {
    if (!unix_ts_seconds) return null;
    const date = new Date(unix_ts_seconds * 1000); 
    return date.toLocaleString('id-ID', { 
        year: 'numeric', month: '2-digit', day: '2-digit', 
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    }).replace(/\//g, '-').replace(',', '');
};

const convertUtcToWib = (dateStr, timeStr) => {
    // Combine into a UTC ISO string: "2026-02-11T12:55:56.000Z"
    const isoString = `${dateStr}T${timeStr}.000Z`;
    const date = new Date(isoString);
    
    // Return formatted WIB string
    return date.toLocaleString('id-ID', { 
        timeZone: 'Asia/Jakarta', 
        year: 'numeric', month: '2-digit', day: '2-digit', 
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    }).replace(/\//g, '-').replace(',', '');
};

// 3. Convert String Date (YYYY-MM-DD HH:mm:ss) to Unix Seconds
// This is needed so the Frontend can calculate the colors (Green/Red)
const stringDateToUnix = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.getTime() / 1000; // Convert ms to seconds
};

/*
const getLoadingData = async (fbdTable, fbdBatchSearch, batchStart, batchEnd) => {
    const fbdSql = `
        SELECT 
            MIN(data_format_1) AS loading_temp_min1,
            MAX(data_format_1) AS loading_temp_max1,
            AVG(data_format_1) AS loading_temp_avg1,
            MIN(data_format_2) AS loading_flow_min1,
            MAX(data_format_2) AS loading_flow_max1,
            AVG(data_format_2) AS loading_flow_avg1,
            MIN(data_format_3) AS loading_time_min1,
            MAX(data_format_3) AS loading_time_max1,
            AVG(data_format_3) AS loading_time_avg1,
            MIN(data_format_4) AS loading_valve_min1,
            MAX(data_format_4) AS loading_valve_max1,
            AVG(data_format_4) AS loading_valve_avg1,
            MIN(data_format_5) AS loading_filter_min1,
            MAX(data_format_5) AS loading_filter_max1,
            AVG(data_format_5) AS loading_filter_avg1,
            MIN(data_format_6) AS loading_filtershake_min1,
            MAX(data_format_6) AS loading_filtershake_max1,
            AVG(data_format_6) AS loading_filtershake_avg1
        FROM \`ems_saka\`.\`${fbdTable}\`
        WHERE CONVERT(data_format_0 USING utf8) LIKE ?
        AND \`time@timestamp\` BETWEEN ? AND ?
    `;

    const [rows] = await db4.promise().query(fbdSql, [`%${fbdBatchSearch}%`, batchStart, batchEnd]);
    return rows[0] || {};
}; */

// --- HELPER: PMA GRANULATION LOGIC (SUPPORTS LINE 1 & 3) ---
const getPmaPhasesData1 = async (line, batchSearch, batchStart, batchEnd) => {
    let pmaSql = '';
    let dbConn;

    if (line === 'Line 1') {
        dbConn = db4;
        pmaSql = `
            SELECT 
                LOWER(TRIM(CONVERT(data_format_1 USING utf8))) AS phase,
                MIN(data_format_2) AS impeller_min, MAX(data_format_2) AS impeller_max, AVG(data_format_2) AS impeller_avg,
                MIN(data_format_3) AS filter_min, MAX(data_format_3) AS filter_max, AVG(data_format_3) AS filter_avg,
                MIN(data_format_4) AS waktu_min, MAX(data_format_4) AS waktu_max, AVG(data_format_4) AS waktu_avg,
                MIN(data_format_5) AS chopper_min, MAX(data_format_5) AS chopper_max, AVG(data_format_5) AS chopper_avg,
                MIN(data_format_6) AS pump_min, MAX(data_format_6) AS pump_max, AVG(data_format_6) AS pump_avg,
                MIN(data_format_7) AS ampere_min, MAX(data_format_7) AS ampere_max, AVG(data_format_7) AS ampere_avg
            FROM \`ems_saka\`.\`cMT-FHDGEA1_EBR_PMA_new_data\`
            WHERE CONVERT(data_format_0 USING utf8) LIKE ?
            AND \`time@timestamp\` BETWEEN ? AND ?
            GROUP BY LOWER(TRIM(CONVERT(data_format_1 USING utf8)))
        `;
    } else if (line === 'Line 3') {
        dbConn = dbTest;
        pmaSql = `
            SELECT 
                LOWER(TRIM(processid)) AS phase,
                MIN(impeller_rpm) AS impeller_min, MAX(impeller_rpm) AS impeller_max, AVG(impeller_rpm) AS impeller_avg,
                MIN(filterclear_interval_sec) AS filter_min, MAX(filterclear_interval_sec) AS filter_max, AVG(filterclear_interval_sec) AS filter_avg,
                MIN(processtime_min) AS waktu_min, MAX(processtime_min) AS waktu_max, AVG(processtime_min) AS waktu_avg,
                MIN(Chopper_rpm) AS chopper_min, MAX(Chopper_rpm) AS chopper_max, AVG(Chopper_rpm) AS chopper_avg,
                MIN(pump_speed) AS pump_min, MAX(pump_speed) AS pump_max, AVG(pump_speed) AS pump_avg,
                MIN(impeller_ampere) AS ampere_min, MAX(impeller_ampere) AS ampere_max, AVG(impeller_ampere) AS ampere_avg
            FROM \`test\`.\`NodeRed_PMA_L3\`
            WHERE batchid LIKE ?
            AND \`timestamp\` BETWEEN ? AND ?
            GROUP BY LOWER(TRIM(processid))
        `;
    }

    const [rows] = await dbConn.promise().query(pmaSql, [`%${batchSearch}%`, batchStart, batchEnd]);
    
    // ==========================================
    // 🛑 DEBUG LOGGER
    // ==========================================
    console.log(`\n--- PMA DATA FOR BATCH: ${batchSearch} (${line}) ---`);
    console.log(`Total Phase Groups Found: ${rows.length}`);
    rows.forEach((row, index) => {
        console.log(`Row ${index + 1}: ->${row.phase}<- (Length: ${row.phase?.length})`);
    });
    console.log(`------------------------------------------\n`);

    const pmaResult = {};
    const assignMetrics = (prefix, row) => {
        // Core metrics
        pmaResult[`${prefix}_impeller_min`] = row.impeller_min;
        pmaResult[`${prefix}_impeller_max`] = row.impeller_max;
        pmaResult[`${prefix}_impeller_avg`] = row.impeller_avg;
        
        pmaResult[`${prefix}_waktu_min`] = row.waktu_min;
        pmaResult[`${prefix}_waktu_max`] = row.waktu_max;
        pmaResult[`${prefix}_waktu_avg`] = row.waktu_avg;

        // Chopper (Used in Mixing & Discharge)
        pmaResult[`${prefix}_chopper_min`] = row.chopper_min;
        pmaResult[`${prefix}_chopper_max`] = row.chopper_max;
        pmaResult[`${prefix}_chopper_avg`] = row.chopper_avg;

        // Filter Clear (Used strictly in Input Material)
        pmaResult[`${prefix}_filter_clear_min`] = row.filter_min;
        pmaResult[`${prefix}_filter_clear_max`] = row.filter_max;
        pmaResult[`${prefix}_filter_clear_avg`] = row.filter_avg;

        // Pump Speed & Ampere (Used strictly in Mixing III & IV)
        pmaResult[`${prefix}_pump_min`] = row.pump_min;
        pmaResult[`${prefix}_pump_max`] = row.pump_max;
        pmaResult[`${prefix}_pump_avg`] = row.pump_avg;
        
        pmaResult[`${prefix}_ampere_min`] = row.ampere_min;
        pmaResult[`${prefix}_ampere_max`] = row.ampere_max;
        pmaResult[`${prefix}_ampere_avg`] = row.ampere_avg;
    };

    rows.forEach(row => {
        // Scrub the hidden bytes and force lowercase
        const phase = row.phase.replace(/\0/g, '').trim(); 
        
        // ==========================================
        // 1. INPUT MATERIAL (Reverse Cascade: 2 then 1)
        // ==========================================
        if (phase.includes('input material 2') || phase.includes('input material ii') || phase.includes('vacuum loading 2') || phase.includes('vacuum loading ii')) {
            assignMetrics('input2', row);
        }
        else if (phase === 'input material' || phase.includes('input material 1') || phase.includes('input material i') || phase.includes('vacuum loading 1') || phase.includes('vacuum loading i')) {
            // Because 'ii' is checked first, this 'i' will never accidentally trigger on Lot 2
            assignMetrics('input1', row);
        }
        
        // ==========================================
        // 2. MIXING (Reverse Cascade: 4 -> 3 -> 2 -> 1)
        // ==========================================
        else if (phase.includes('mixing 4') || phase.includes('mixing iv')) {
            assignMetrics('mix4', row);
        }
        else if (phase.includes('mixing 3') || phase.includes('mixing iii')) {
            assignMetrics('mix3', row);
        }
        else if (phase.includes('mixing 2') || phase.includes('mixing ii')) {
            assignMetrics('mix2', row);
        }
        else if (phase === 'mixing' || phase.includes('mixing 1') || phase.includes('mixing i')) {
            assignMetrics('mix1', row);
        }

        // ==========================================
        // 3. DISCHARGE
        // ==========================================
        else if (phase.startsWith('discharge ')) {
            const num = phase.replace('discharge ', '');
            assignMetrics(`discharge${num}`, row);
        }
    });
    return pmaResult;
};

/*
const getPmaPhasesData = async (line, batchSearch, batchStart, batchEnd) => {
    let dbConn, dbName, tableName, ampereCol, chopperCol;

    // Set configuration based on the selected line
    if (line === 'Line 1') {
        dbConn = dbTest; 
        dbName = 'test'; // Change this if your NodeRed_PMA_L1 is actually in the 'test' database
        tableName = 'NodeRed_PMA_L1'; 
        ampereCol = 'impeler_ampere'; // L1 Spelling
        chopperCol = 'chopper_rpm';   // L1 Spelling
    } else if (line === 'Line 3') {
        dbConn = dbTest;
        dbName = 'test';
        tableName = 'NodeRed_PMA_L3';
        ampereCol = 'impeller_ampere'; // L3 Spelling
        chopperCol = 'Chopper_rpm';    // L3 Spelling
    } else {
        return {};
    }

    // ==========================================
    // STEP 1: FETCH EXACT BATCH ID
    // ==========================================
    const findBatchSql = `
        SELECT batchid 
        FROM \`${dbName}\`.\`${tableName}\`
        WHERE batchid LIKE ? AND \`timestamp\` BETWEEN ? AND ?
        LIMIT 1
    `;
    const [batchRows] = await dbConn.promise().query(findBatchSql, [`%${batchSearch}%`, batchStart, batchEnd]);
    
    // Fallback to the search term if for some reason the query is empty
    const exactBatchId = batchRows.length > 0 ? batchRows[0].batchid : batchSearch;

    // ==========================================
    // STEP 2: FETCH PHASE DATA USING EXACT ID
    // ==========================================
    const pmaSql = `
        SELECT 
            LOWER(TRIM(processid)) AS phase,
            MIN(impeller_rpm) AS impeller_min, MAX(impeller_rpm) AS impeller_max, AVG(impeller_rpm) AS impeller_avg,
            MIN(filterclear_interval_sec) AS filter_min, MAX(filterclear_interval_sec) AS filter_max, AVG(filterclear_interval_sec) AS filter_avg,
            MIN(processtime_min) AS waktu_min, MAX(processtime_min) AS waktu_max, AVG(processtime_min) AS waktu_avg,
            MIN(${chopperCol}) AS chopper_min, MAX(${chopperCol}) AS chopper_max, AVG(${chopperCol}) AS chopper_avg,
            MIN(pump_speed) AS pump_min, MAX(pump_speed) AS pump_max, AVG(pump_speed) AS pump_avg,
            MIN(${ampereCol}) AS ampere_min, MAX(${ampereCol}) AS ampere_max, AVG(${ampereCol}) AS ampere_avg
        FROM \`${dbName}\`.\`${tableName}\`
        WHERE batchid = ?
        AND \`timestamp\` BETWEEN ? AND ?
        GROUP BY LOWER(TRIM(processid))
    `;

    const [rows] = await dbConn.promise().query(pmaSql, [exactBatchId, batchStart, batchEnd]);
    
    // ==========================================
    // 🛑 DEBUG LOGGER
    // ==========================================
    console.log(`\n--- PMA DATA FOR BATCH: ${exactBatchId} (${line}) ---`);
    console.log(`Total Phase Groups Found: ${rows.length}`);
    rows.forEach((row, index) => {
        console.log(`Row ${index + 1}: ->${row.phase}<- (Length: ${row.phase?.length})`);
    });
    console.log(`------------------------------------------\n`);

    const pmaResult = {};
    const assignMetrics = (prefix, row) => {
        // Core metrics
        pmaResult[`${prefix}_impeller_min`] = row.impeller_min;
        pmaResult[`${prefix}_impeller_max`] = row.impeller_max;
        pmaResult[`${prefix}_impeller_avg`] = row.impeller_avg;
        
        pmaResult[`${prefix}_waktu_min`] = row.waktu_min;
        pmaResult[`${prefix}_waktu_max`] = row.waktu_max;
        pmaResult[`${prefix}_waktu_avg`] = row.waktu_avg;

        // Chopper
        pmaResult[`${prefix}_chopper_min`] = row.chopper_min;
        pmaResult[`${prefix}_chopper_max`] = row.chopper_max;
        pmaResult[`${prefix}_chopper_avg`] = row.chopper_avg;

        // Filter Clear
        pmaResult[`${prefix}_filter_clear_min`] = row.filter_min;
        pmaResult[`${prefix}_filter_clear_max`] = row.filter_max;
        pmaResult[`${prefix}_filter_clear_avg`] = row.filter_avg;

        // Pump Speed & Ampere
        pmaResult[`${prefix}_pump_min`] = row.pump_min;
        pmaResult[`${prefix}_pump_max`] = row.pump_max;
        pmaResult[`${prefix}_pump_avg`] = row.pump_avg;
        
        pmaResult[`${prefix}_ampere_min`] = row.ampere_min;
        pmaResult[`${prefix}_ampere_max`] = row.ampere_max;
        pmaResult[`${prefix}_ampere_avg`] = row.ampere_avg;
    };

    rows.forEach(row => {
        // The NodeRed tables probably don't have hidden \0 bytes, but it's safe to keep the scrubber
        const phase = row.phase.replace(/\0/g, '').trim(); 
        
        // 1. INPUT MATERIAL
        if (phase.includes('input material 2') || phase.includes('input material ii') || phase.includes('vacuum loading 2') || phase.includes('vacuum loading ii')) {
            assignMetrics('input2', row);
        }
        else if (phase === 'input material' || phase.includes('input material 1') || phase.includes('input material i') || phase.includes('vacuum loading 1') || phase.includes('vacuum loading i')) {
            assignMetrics('input1', row);
        }
        
        // 2. MIXING
        else if (phase.includes('mixing 4') || phase.includes('mixing iv')) {
            assignMetrics('mix4', row);
        }
        else if (phase.includes('mixing 3') || phase.includes('mixing iii')) {
            assignMetrics('mix3', row);
        }
        else if (phase.includes('mixing 2') || phase.includes('mixing ii')) {
            assignMetrics('mix2', row);
        }
        else if (phase === 'mixing' || phase.includes('mixing 1') || phase.includes('mixing i')) {
            assignMetrics('mix1', row);
        }

        // 3. DISCHARGE
        else if (phase.startsWith('discharge ')) {
            const num = phase.replace('discharge ', '');
            assignMetrics(`discharge${num}`, row);
        }
    });

    return pmaResult;
}; */

const getPmaPhasesData = async (line, batch, batchStart, batchEnd) => {
    const results = {};
    
    // --- ENTRY LOG ---
    // This should now correctly print "Checking Line: Line 1 | Batch: STMXGE64979-1"
    console.log(`\n[PMA Helper Start] Checking Line: "${line}" | Batch: "${batch}"`);

    try {
        // 2. The SQL query now safely uses the real 'batch' variable
        const sql = `
            SELECT 
                step, 
                step_desc,
                MIN(impeller_rpm) as min_imp, MAX(impeller_rpm) as max_imp, AVG(impeller_rpm) as avg_imp,
                MIN(chopper_rpm) as min_chop, MAX(chopper_rpm) as max_chop, AVG(chopper_rpm) as avg_chop,
                MIN(pump_speed) as min_pump, MAX(pump_speed) as max_pump, AVG(pump_speed) as avg_pump,
                MIN(impeler_ampere) as min_amp, MAX(impeler_ampere) as max_amp, AVG(impeler_ampere) as avg_amp,
                MIN(filterclear_interval_sec) as min_fc, MAX(filterclear_interval_sec) as max_fc, AVG(filterclear_interval_sec) as avg_fc,
                (MAX(timestamp) - MIN(timestamp)) / 60 as duration_minutes
            FROM \`test\`.\`NodeRed_PMA_L1\`
            WHERE batchid LIKE ?
            GROUP BY step, step_desc
            ORDER BY MIN(timestamp) ASC;
        `;
        
        const [rows] = await dbTest.promise().query(sql, [`%${batch}%`]);
        console.log(`[PMA Telemetry] Batch: "${batch}" | Phase Rows Found: ${rows.length}`);
        console.log(`\n=== 🛠️ RAW SQL ROWS FOR PMA BATCH: ${batch} ===`);
        console.table(rows.map(r => ({ 
            step: r.step, 
            desc: r.step_desc, 
            min_imp: r.min_imp, 
            duration: r.duration_minutes 
        })));
        console.log(`====================================================\n`);

        // Counters for phases that repeat (like Input Material and Discharge)
        let inputMatCount = 1;
        let dischargeCount = 1;

        // Formatter to keep decimals clean
        const fmt = (val) => val != null ? parseFloat(Number(val).toFixed(2)) : null;

        // 2. Map the SQL output to your React Frontend keys
        for (const row of rows) {
            const desc = (row.step_desc || '').toLowerCase();
            const minImp = fmt(row.min_imp); const maxImp = fmt(row.max_imp); const avgImp = fmt(row.avg_imp);
            const minChop = fmt(row.min_chop); const maxChop = fmt(row.max_chop); const avgChop = fmt(row.avg_chop);
            const minPump = fmt(row.min_pump); const maxPump = fmt(row.max_pump); const avgPump = fmt(row.avg_pump);
            const minAmp = fmt(row.min_amp); const maxAmp = fmt(row.max_amp); const avgAmp = fmt(row.avg_amp);
            
            // ➕ ADD THE FILTER CLEAR VARIABLES RIGHT HERE:
            const minFc = fmt(row.min_fc); const maxFc = fmt(row.max_fc); const avgFc = fmt(row.avg_fc);
            
            const duration = fmt(row.duration_minutes);

            if (desc.includes('input material')) {
                if (inputMatCount <= 2) {
    results[`input${inputMatCount}_impeller_min1`] = minImp; 
    results[`input${inputMatCount}_impeller_max1`] = maxImp; 
    results[`input${inputMatCount}_impeller_avg1`] = avgImp;

    // 🚨 MAKE SURE THESE 3 LINES ARE HERE WITH UNDERSCORES:
    results[`input${inputMatCount}_filter_clear_min1`] = minFc;
    results[`input${inputMatCount}_filter_clear_max1`] = maxFc;
    results[`input${inputMatCount}_filter_clear_avg1`] = avgFc;

    results[`input${inputMatCount}_waktu_min1`] = duration; 
    results[`input${inputMatCount}_waktu_max1`] = duration; 
    results[`input${inputMatCount}_waktu_avg1`] = duration;
    inputMatCount++;
}
            }
            // -- MIXING PHASES --
            else if (desc.includes('mixing')) {
                let mixNum = null;
                // Safely determine which mixing phase it is
                if (desc.includes('iv') || desc.includes(' 4')) mixNum = 4;
                else if (desc.includes('iii') || desc.includes(' 3')) mixNum = 3;
                else if (desc.includes('ii') || desc.includes(' 2')) mixNum = 2;
                else if (desc.includes(' i') || desc.includes(' 1') || desc === 'mixing') mixNum = 1;

                if (mixNum) {
                    results[`mix${mixNum}_impeller_min1`] = minImp; results[`mix${mixNum}_impeller_max1`] = maxImp; results[`mix${mixNum}_impeller_avg1`] = avgImp;
                    results[`mix${mixNum}_chopper_min1`] = minChop; results[`mix${mixNum}_chopper_max1`] = maxChop; results[`mix${mixNum}_chopper_avg1`] = avgChop;
                    results[`mix${mixNum}_waktu_min1`] = duration; results[`mix${mixNum}_waktu_max1`] = duration; results[`mix${mixNum}_waktu_avg1`] = duration;
                    
                    // Mix 3 and 4 have pump and ampere
                    if (mixNum >= 3) {
                        results[`mix${mixNum}_pump_min1`] = minPump; results[`mix${mixNum}_pump_max1`] = maxPump; results[`mix${mixNum}_pump_avg1`] = avgPump;
                        results[`mix${mixNum}_ampere_min1`] = minAmp; results[`mix${mixNum}_ampere_max1`] = maxAmp; results[`mix${mixNum}_ampere_avg1`] = avgAmp;
                    }
                }
            }
            // -- DISCHARGE PHASES --
            else if (desc.includes('discharge')) {
                if (dischargeCount <= 12) {
                    results[`discharge${dischargeCount}_impeller_min1`] = minImp; results[`discharge${dischargeCount}_impeller_max1`] = maxImp; results[`discharge${dischargeCount}_impeller_avg1`] = avgImp;
                    results[`discharge${dischargeCount}_chopper_min1`] = minChop; results[`discharge${dischargeCount}_chopper_max1`] = maxChop; results[`discharge${dischargeCount}_chopper_avg1`] = avgChop;
                    results[`discharge${dischargeCount}_waktu_min1`] = duration; results[`discharge${dischargeCount}_waktu_max1`] = duration; results[`discharge${dischargeCount}_waktu_avg1`] = duration;
                    dischargeCount++;
                }
            }
        }
        
        return results;

    } catch (error) {
        console.error(`[PMA Telemetry ERROR] Failed to fetch data:`, error.message);
        return results; 
    }
};

const getPMARecipeData = async (line, batch, dayStart, dayEnd) => {
    const results = {};
    const baseBatch = batch.split('-')[0].trim();
    
    if (line !== 'Line 1') return results;

    try {
        const sqlRecipe = `
            SELECT * FROM \`test\`.\`NodeRed_recipe_GEA_L1\` 
            WHERE \`PMA_BacthID\` LIKE ? 
            ORDER BY \`unix_timestamp\` DESC 
            LIMIT 1
        `;
        
        const [rows] = await dbTest.promise().query(sqlRecipe, [`%${baseBatch}%`]);

        console.log(`[PMA Recipe] Searching Batch: "${baseBatch}" | Rows Found: ${rows.length}`);

        if (rows && rows.length > 0) {
            const row = rows[0];
            
            const getVal = (targetName) => {
                if (row[targetName] !== undefined) return row[targetName];
                const normalizedTarget = targetName.toLowerCase().replace(/-/g, '_');
                const actualKey = Object.keys(row).find(key => 
                    key.toLowerCase().replace(/-/g, '_') === normalizedTarget
                );
                return actualKey !== undefined ? row[actualKey] : null; 
            };

            // --- HELPER TO ASSIGN LOT 1 & LOT 2 SETPOINTS SIMULTANEOUSLY ---
            // --- HELPER TO ASSIGN BOTH REACT UI AND PDF SETPOINTS ---
            const setLotKeys = (prefix, imp, chop, time, pump = null) => {
                // 1. Keys for the PDF Template (_set1, _set2)
                results[`${prefix}_impeller_set1`] = imp; results[`${prefix}_impeller_set2`] = imp;
                results[`${prefix}_waktu_set1`] = time; results[`${prefix}_waktu_set2`] = time;
                
                if (chop !== null) { 
                    results[`${prefix}_chopper_set1`] = chop; results[`${prefix}_chopper_set2`] = chop; 
                }
                if (pump !== null) { 
                    results[`${prefix}_pump_set1`] = pump; results[`${prefix}_pump_set2`] = pump; 
                }

                // 2. Keys for the React Frontend UI (_recipe_)
                results[`${prefix}_recipe_impeller`] = imp;
                results[`${prefix}_recipe_time`] = time;
                
                if (chop !== null) results[`${prefix}_recipe_chopper`] = chop;
                if (pump !== null) results[`${prefix}_recipe_pump`] = pump;
            };

            // --- BINDER SPEED ---
            const binderSpeed = getVal('PMA-SolutionPumpSpeed1');
            results['binder_speed_set1'] = binderSpeed; 
            results['binder_speed_set2'] = binderSpeed;
            results['pma_recipe_pump_speed1'] = binderSpeed; // React UI Key

            // --- INPUT MATERIAL I & II ---
            const loadSpeed = getVal('PMA-ImpellerLoadingSpeed');
            const filterInterval = getVal('PMA-FilterClearIntervalTime');
            
            // React UI Keys
            results['pma_recipe_loading_speed'] = loadSpeed;
            results['pma_recipe_filter_interval'] = filterInterval;

            // PDF Keys
            ['input1', 'input2'].forEach(prefix => {
                results[`${prefix}_impeller_set1`] = loadSpeed;
                results[`${prefix}_impeller_set2`] = loadSpeed;
                results[`${prefix}_filter_clear_set1`] = filterInterval;
                results[`${prefix}_filter_clear_set2`] = filterInterval;
            });

            // --- MIXING I - IV ---
            setLotKeys('mix1', getVal('PMA-ImpellerSpeed1'), getVal('PMA-ChopperSpeed1'), getVal('PMA-ProcessTimeTripLevelMin1'));
            setLotKeys('mix2', getVal('PMA-ImpellerSpeed2'), getVal('PMA-ChopperSpeed2'), getVal('PMA-ProcessTimeTripLevelMin2'));
            setLotKeys('mix3', getVal('PMA-ImpellerSpeed3'), getVal('PMA-ChopperSpeed3'), getVal('PMA-ProcessTimeTripLevelMin3'), getVal('PMA-SolutionPumpSpeed2'));
            setLotKeys('mix4', getVal('PMA-ImpellerSpeed4'), getVal('PMA-ChopperSpeed4'), getVal('PMA-ProcessTimeTripLevelMin4'), getVal('PMA-SolutionPumpSpeed3'));

            // --- DISCHARGE I - XII ---
            for (let i = 1; i <= 12; i++) {
                const dbIndex = i + 4; // Discharge 1 maps to ImpellerSpeed5, etc.
                setLotKeys(
                    `discharge${i}`, 
                    getVal(`PMA-ImpellerSpeed${dbIndex}`), 
                    getVal(`PMA-ChopperSpeed${dbIndex}`), 
                    getVal(`PMA-ProcessTimeTripLevelMin${dbIndex}`)
                );
            }
        } // <--- The missing bracket is safely back home here!
        
        return results;

    } catch (error) {
        console.error(`[PMA Recipe ERROR] Failed to fetch data:`, error.message);
        return results; 
    }
};

const getFBDPhaseData1 = async (line, batch, dayStart, dayEnd) => {
    const baseBatch = batch.split('-')[0].trim(); 
    const results = {};

    // For now, we only process Line 1. Line 3 can be added here later.
    if (line !== 'Line 1') return results; 

    const stateTableName = 'mezanine.tengah_CtrlIntrfceFBDL1_data';
    const sensorTableName = 'cMT-FHDGEA1_EBR_FBD_new_data';

    // --- 1. GET TIME SEGMENTS ---
   const sqlState = `
    SELECT \`time@timestamp\` AS ts, data_format_6 AS description, data_format_3 AS hours, data_format_4 AS minutes
    FROM \`parammachine_saka\`.\`${stateTableName}\`
    WHERE data_format_7 LIKE ? 
    AND \`time@timestamp\` BETWEEN ? AND ?
    ORDER BY \`time@timestamp\` ASC
`;
    
    const [stateRows] = await db4.promise().query(sqlState, [`%${baseBatch}%`, dayStart, dayEnd]);

    console.log(`--- FBD STATE LOG FOR BATCH: ${batch} ---`);
    console.log(`Total state rows found: ${stateRows.length}`);

    let segments = { loading: [], drying: [] };
    let currentPhase = null;
    let currentSegment = null;

    stateRows.forEach(row => {
        let phase = null;
        if (row.description && row.description.includes('Transfer Granul - load')) phase = 'loading';
        else if (row.description && row.description.includes('endpoint 30,7 Temp. ex')) phase = 'drying';

        if (phase) {
            const totalMins = (parseInt(row.hours) * 60) + parseInt(row.minutes);
            
            if (currentPhase !== phase) {
                if (currentSegment) segments[currentPhase].push(currentSegment);
                currentPhase = phase;
                currentSegment = { startTs: row.ts, endTs: row.ts, startMins: totalMins, endMins: totalMins };
            } else {
                currentSegment.endTs = row.ts;
                currentSegment.endMins = totalMins;
            }
        } else {
            if (currentSegment) {
                segments[currentPhase].push(currentSegment);
                currentPhase = null;
                currentSegment = null;
            }
        }
    });
    if (currentSegment) segments[currentPhase].push(currentSegment);

    let totalLoadingTime = 0;
    let totalDryingTime = 0;
    segments.loading.forEach(seg => totalLoadingTime += (seg.endMins - seg.startMins));
    segments.drying.forEach(seg => totalDryingTime += (seg.endMins - seg.startMins));

    console.log(`Segments Found:`, {
        loading_count: segments.loading.length,
        drying_count: segments.drying.length
    });

    // --- 2. GET SENSOR DATA ---
    const sqlSensor = `
    SELECT \`time@timestamp\` AS ts, data_format_1 AS temp, data_format_2 AS airflow, data_format_4 AS valve, data_format_5 AS filter_clear, data_format_6 AS filter_shake
    FROM \`ems_saka\`.\`${sensorTableName}\`
    WHERE data_format_0 LIKE ? 
    AND \`time@timestamp\` BETWEEN ? AND ?
`;
    
    const [sensorRows] = await db4.promise().query(sqlSensor, [`%${baseBatch}%`, dayStart, dayEnd]);

    const isInSegment = (ts, phaseSegments) => phaseSegments.some(seg => ts >= seg.startTs && ts <= seg.endTs);
    const loadingSensorData = sensorRows.filter(r => isInSegment(r.ts, segments.loading));
    const dryingSensorData = sensorRows.filter(r => isInSegment(r.ts, segments.drying));

    console.log(`Filtered Sensor Rows: Loading (${loadingSensorData.length}), Drying (${dryingSensorData.length})`);
    console.log(`------------------------------------------`);

    // --- 3. CALCULATE METRICS ---
    const calculateMetrics = (prefix, groupRows, mappingArray) => {
        mappingArray.forEach(m => {
            const values = groupRows.map(r => parseFloat(r[m.dbKey])).filter(v => !isNaN(v));
            if (values.length > 0) {
                results[`${prefix}_${m.tagKey}_min`] = Math.min(...values);
                results[`${prefix}_${m.tagKey}_max`] = Math.max(...values);
                results[`${prefix}_${m.tagKey}_avg`] = values.reduce((a, b) => a + b, 0) / values.length;
            }
        });
    };

    if (loadingSensorData.length > 0) {
        calculateMetrics('loading', loadingSensorData, [
            { dbKey: 'temp', tagKey: 'temp' },
            { dbKey: 'airflow', tagKey: 'flow' },
            { dbKey: 'filter_clear', tagKey: 'filter' },
            { dbKey: 'filter_shake', tagKey: 'filtershake' },
            { dbKey: 'valve', tagKey: 'valve' }
        ]);
        results['loading_time_avg'] = totalLoadingTime; 
    }

    if (dryingSensorData.length > 0) {
    calculateMetrics('drying', dryingSensorData, [
        { dbKey: 'temp', tagKey: 'temp' },
        { dbKey: 'airflow', tagKey: 'airflow' },
        { dbKey: 'filter_clear', tagKey: 'filter' },
        { dbKey: 'filter_shake', tagKey: 'filtershake' },
        // This creates 'drying_exhaust_avg', 'drying_exhaust_min', etc.
        { dbKey: 'data_format_3', tagKey: 'exhaust' } 
    ]);
    
    // This ensures the duration is always sent
    results['drying_pengeringan_avg'] = totalDryingTime;
} else if (totalDryingTime > 0) {
    // If we have a time window but NO sensor data, at least send the duration
    results['drying_pengeringan_avg'] = totalDryingTime;
}

    return results;
};

/* const getFBDPhaseData = async (line, batch, dayStart, dayEnd) => {
    // We keep the -1/-2 suffix removal logic so we can find the base batch ID
    const baseBatch = batch.split('-')[0].trim(); 
    const results = {};

    // For now, we only process Line 1.
    if (line !== 'Line 1') return results; 

    const stateTableName = '  ';
    
    // UPDATED: Sensor table name to the new NodeRed table
    const sensorTableName = 'NodeRed_FBD_L1'; 

    // --- 1. GET TIME SEGMENTS (Unchanged) ---
    // The state table remains the same (mezanine) since it dictates the time windows
    const sqlState = `
    SELECT \`time@timestamp\` AS ts, data_format_6 AS description, data_format_3 AS hours, data_format_4 AS minutes
    FROM \`parammachine_saka\`.\`${stateTableName}\`
    WHERE data_format_7 LIKE ? 
    AND \`time@timestamp\` BETWEEN ? AND ?
    ORDER BY \`time@timestamp\` ASC
    `;
    
    const [stateRows] = await db4.promise().query(sqlState, [`%${baseBatch}%`, dayStart, dayEnd]);

    console.log(`--- FBD STATE LOG FOR BATCH: ${batch} ---`);
    console.log(`Total state rows found: ${stateRows.length}`);

    let segments = { loading: [], drying: [] };
    let currentPhase = null;
    let currentSegment = null;

    stateRows.forEach(row => {
        let phase = null;
        if (row.description && row.description.includes('Transfer Granul - load')) phase = 'loading';
        else if (row.description && row.description.includes('endpoint 30,7 Temp. ex')) phase = 'drying';

        if (phase) {
            const totalMins = (parseInt(row.hours) * 60) + parseInt(row.minutes);
            
            if (currentPhase !== phase) {
                if (currentSegment) segments[currentPhase].push(currentSegment);
                currentPhase = phase;
                currentSegment = { startTs: row.ts, endTs: row.ts, startMins: totalMins, endMins: totalMins };
            } else {
                currentSegment.endTs = row.ts;
                currentSegment.endMins = totalMins;
            }
        } else {
            if (currentSegment) {
                segments[currentPhase].push(currentSegment);
                currentPhase = null;
                currentSegment = null;
            }
        }
    });
    if (currentSegment) segments[currentPhase].push(currentSegment);

    let totalLoadingTime = 0;
    let totalDryingTime = 0;
    segments.loading.forEach(seg => totalLoadingTime += (seg.endMins - seg.startMins));
    segments.drying.forEach(seg => totalDryingTime += (seg.endMins - seg.startMins));

    console.log(`Segments Found:`, {
        loading_count: segments.loading.length,
        drying_count: segments.drying.length
    });

    // --- 2. GET SENSOR DATA (UPDATED) ---
    // Switched to use dbTest and the explicit column names from NodeRed_FBD_L1
    const sqlSensor = `
    SELECT 
        \`timestamp\` AS ts, 
        inlet_temp AS temp, 
        inlet_airflow AS airflow, 
        valve AS valve, 
        filterclear_intervaltime AS filter_clear, 
        numberofshake AS filter_shake,
        product_temp AS exhaust 
    FROM \`test\`.\`${sensorTableName}\`
    WHERE batch LIKE ? 
    AND \`timestamp\` BETWEEN ? AND ?
    `;
    
    // UPDATED: Executing the query on dbTest instead of db4
    const [sensorRows] = await dbTest.promise().query(sqlSensor, [`%${baseBatch}%`, dayStart, dayEnd]);

    const isInSegment = (ts, phaseSegments) => phaseSegments.some(seg => ts >= seg.startTs && ts <= seg.endTs);
    
    // The filter logic remains unchanged since we aliased the columns in the SQL query
    let loadingSensorData = [];
    let dryingSensorData = [];

    if (segments.loading && segments.loading.length > 0) {
        loadingSensorData = sensorRows.filter(r => isInSegment(r.ts, segments.loading));
    }
    
    if (segments.drying && segments.drying.length > 0) {
        dryingSensorData = sensorRows.filter(r => isInSegment(r.ts, segments.drying));
    }

    console.log(`Filtered Sensor Rows: Loading (${loadingSensorData.length}), Drying (${dryingSensorData.length})`);
    console.log(`------------------------------------------`);

    // --- 3. CALCULATE METRICS (Unchanged) ---
    const calculateMetrics = (prefix, groupRows, mappingArray) => {
        mappingArray.forEach(m => {
            const values = groupRows.map(r => parseFloat(r[m.dbKey])).filter(v => !isNaN(v));
            if (values.length > 0) {
                results[`${prefix}_${m.tagKey}_min`] = Math.min(...values);
                results[`${prefix}_${m.tagKey}_max`] = Math.max(...values);
                results[`${prefix}_${m.tagKey}_avg`] = values.reduce((a, b) => a + b, 0) / values.length;
            }
        });
    };

    if (loadingSensorData.length > 0) {
        calculateMetrics('loading', loadingSensorData, [
            { dbKey: 'temp', tagKey: 'temp' },
            { dbKey: 'airflow', tagKey: 'flow' },
            { dbKey: 'filter_clear', tagKey: 'filter' },
            { dbKey: 'filter_shake', tagKey: 'filtershake' },
            { dbKey: 'valve', tagKey: 'valve' }
        ]);
        results['loading_time_avg'] = totalLoadingTime; 
    }

    if (dryingSensorData.length > 0) {
        calculateMetrics('drying', dryingSensorData, [
            { dbKey: 'temp', tagKey: 'temp' },
            { dbKey: 'airflow', tagKey: 'airflow' },
            { dbKey: 'filter_clear', tagKey: 'filter' },
            { dbKey: 'filter_shake', tagKey: 'filtershake' },
            // UPDATED: Changed from 'data_format_3' to our explicit alias 'exhaust'
            { dbKey: 'exhaust', tagKey: 'exhaust' } 
        ]);
        
        results['drying_pengeringan_avg'] = totalDryingTime;
    } else if (totalDryingTime > 0) {
        results['drying_pengeringan_avg'] = totalDryingTime;
    }

    return results;
};

/* const getFBDRecipeData = async (line, batch, dayStart, dayEnd) => {
    const results = {};
    const baseBatch = batch.split('-')[0].trim();

    if (line !== 'Line 1') return results;

    const tableName = 'NodeRed_recipe_FBD_L1';

    try {
        const sqlRecipe = `
            SELECT * FROM \`test\`.\`${tableName}\` 
            WHERE FBD_BatchID LIKE ? 
            ORDER BY \`unix_timestamp\` DESC 
            LIMIT 1
        `;
        
        const [rows] = await dbTest.promise().query(sqlRecipe, [`%${baseBatch}%`]);

        if (rows && rows.length > 0) {
            const row = rows[0];

            // --- DIAGNOSTIC LOG (Optional: Remove after it works) ---
            // This will show you exactly what the column names are in your terminal
            // console.log("Actual Database Columns:", Object.keys(row));

            // Helper to handle hyphen vs underscore inconsistency
            const getVal = (col) => row[col] ?? row[col.replace(/-/g, '_')] ?? '-';

            // --- LOADING SETPOINTS ---
            results['loading_recipe_temp'] = getVal('FBD_InletAirTemp');
            results['loading_recipe_flow'] = getVal('FBD_FluidsingAirFlow1');
            results['loading_recipe_filter'] = getVal('FBD_FilterClearIntervalTime');
            results['loading_recipe_filtershake'] = getVal('FBD_NumberOfFilterShakes');
            results['loading_recipe_time'] = getVal('FBD-ProcessTimeTripMin');
            results['loading_recipe_valve'] = getVal('FBD_InletAirPosition1');

            // --- DRYING SETPOINTS ---
            results['drying_recipe_temp'] = getVal('FBD_InletAirTemp1');
            results['drying_recipe_flow'] = getVal('FBD_FluidsingAirFlow2');
            results['drying_recipe_filter'] = getVal('FBD_FilterClearIntervalTime1');
            results['drying_recipe_filtershake'] = getVal('FBD_NumberOfFilterShakes1');
            results['drying_recipe_time'] = getVal('FBD-ProcessTimeTripMin1');
            results['drying_recipe_exhaust'] = getVal('FBD_ExhaustAirTemperatureTrip2');

            // --- TRANSFER SETPOINTS ---
            results['transfer_recipe_temp'] = getVal('FBD_InletAirTemp3');
            results['transfer_recipe_flow'] = getVal('FBD_FluidsingAirFlow3');

            // --- DISCHARGE SETPOINTS (Using your discharge_1 naming) ---
            results['discharge_1_recipe_valve'] = getVal('FBD-ExhaustValvePosition3');
            results['discharge_2_recipe_valve'] = getVal('FBD-ExhaustValvePosition4');
            results['discharge_3_recipe_valve'] = getVal('FBD-ExhaustValvePosition5');
        }

        return results;

    } catch (error) {
        console.error(`Error fetching FBD Recipe Data:`, error);
        return results; 
    }
};
*/

const getFBDPhaseData = async (line, batch, dayStart, dayEnd) => {
    const results = {};
    
    // --- DYNAMIC LOT DETECTION ---
    // If the frontend passes 'STMXGF64981-2', lotSuffix becomes '2'
    const lotSuffix = batch.split('-')[1]?.trim() || '1'; 

    if (line !== 'Line 1') return results; 

    try {
        // Query exact batch with suffix (preventing Lot 1 & Lot 2 merging)
        const sql = `
            SELECT 
                LOWER(TRIM(step_desc)) AS desc_lower,
                MIN(inlet_temp) as min_temp, MAX(inlet_temp) as max_temp, AVG(inlet_temp) as avg_temp,
                MIN(inlet_airflow) as min_flow, MAX(inlet_airflow) as max_flow, AVG(inlet_airflow) as avg_flow,
                MIN(filterclear_intervaltime) as min_filter, MAX(filterclear_intervaltime) as max_filter, AVG(filterclear_intervaltime) as avg_filter,
                MIN(numberofshake) as min_shake, MAX(numberofshake) as max_shake, AVG(numberofshake) as avg_shake,
                MIN(valve) as min_valve, MAX(valve) as max_valve, AVG(valve) as avg_valve,
                MIN(product_temp) as min_exhaust, MAX(product_temp) as max_exhaust, AVG(product_temp) as avg_exhaust,
                (MAX(\`timestamp\`) - MIN(\`timestamp\`)) / 60 as duration_minutes
            FROM \`test\`.\`NodeRed_FBD_L1\`
            WHERE batch LIKE ? 
            AND \`timestamp\` BETWEEN ? AND ?
            GROUP BY LOWER(TRIM(step_desc))
        `;
        
        const [rows] = await dbTest.promise().query(sql, [`%${batch}%`, dayStart, dayEnd]);

        console.log(`\n--- FBD TELEMETRY LOG FOR BATCH: ${batch} (Lot ${lotSuffix}) ---`);
        
        const fmt = (val) => {
            if (val === null || val === undefined || val === '') return null;
            const num = Number(val);
            return isNaN(num) ? null : parseFloat(num.toFixed(2));
        };

        rows.forEach(row => {
            const desc = row.desc_lower || '';
            
            // Injecting lotSuffix dynamically into the keys
            const assignMetrics = (prefix, timeKey, flowKey) => {
                results[`${prefix}_temp_min${lotSuffix}`] = fmt(row.min_temp);
                results[`${prefix}_temp_max${lotSuffix}`] = fmt(row.max_temp);
                results[`${prefix}_temp_avg${lotSuffix}`] = fmt(row.avg_temp);

                results[`${prefix}_${flowKey}_min${lotSuffix}`] = fmt(row.min_flow);
                results[`${prefix}_${flowKey}_max${lotSuffix}`] = fmt(row.max_flow);
                results[`${prefix}_${flowKey}_avg${lotSuffix}`] = fmt(row.avg_flow);

                results[`${prefix}_filter_min${lotSuffix}`] = fmt(row.min_filter);
                results[`${prefix}_filter_max${lotSuffix}`] = fmt(row.max_filter);
                results[`${prefix}_filter_avg${lotSuffix}`] = fmt(row.avg_filter);

                results[`${prefix}_filtershake_min${lotSuffix}`] = fmt(row.min_shake);
                results[`${prefix}_filtershake_max${lotSuffix}`] = fmt(row.max_shake);
                results[`${prefix}_filtershake_avg${lotSuffix}`] = fmt(row.avg_shake);

                results[`${prefix}_${timeKey}_min${lotSuffix}`] = fmt(row.duration_minutes);
                results[`${prefix}_${timeKey}_max${lotSuffix}`] = fmt(row.duration_minutes);
                results[`${prefix}_${timeKey}_avg${lotSuffix}`] = fmt(row.duration_minutes);
            };

            if (desc.includes('loading')) {
                assignMetrics('loading', 'time', 'flow'); 
                results[`loading_valve_min${lotSuffix}`] = fmt(row.min_valve);
                results[`loading_valve_max${lotSuffix}`] = fmt(row.max_valve);
                results[`loading_valve_avg${lotSuffix}`] = fmt(row.avg_valve);
                
            } else if (desc.includes('drying') || desc.includes('endpoint')) {
                assignMetrics('drying', 'pengeringan', 'airflow'); 
                results[`drying_exhaust_min${lotSuffix}`] = fmt(row.min_exhaust);
                results[`drying_exhaust_max${lotSuffix}`] = fmt(row.max_exhaust);
                results[`drying_exhaust_avg${lotSuffix}`] = fmt(row.avg_exhaust);
            }
        });

        return results;

    } catch (error) {
        console.error(`[FBD Telemetry ERROR] Failed to fetch data:`, error.message);
        return results; 
    }
};

const getFBDRecipeData = async (line, batch) => {
    const results = {};
    if (line !== 'Line 1') return results;

    console.log(`\n[FBD Telemetry] 🔍 Searching for Batch: "${batch}"`);

    try {
        const sql = `
            SELECT 
                step, 
                step_desc,
                MIN(inlet_temp) as min_inlet, MAX(inlet_temp) as max_inlet, AVG(inlet_temp) as avg_inlet,
                MIN(product_temp) as min_prod, MAX(product_temp) as max_prod, AVG(product_temp) as avg_prod,
                MIN(inlet_airflow) as min_flow, MAX(inlet_airflow) as max_flow, AVG(inlet_airflow) as avg_flow,
                MIN(filterclear_intervaltime) as min_fc, MAX(filterclear_intervaltime) as max_fc, AVG(filterclear_intervaltime) as avg_fc,
                MIN(numberofshake) as min_shake, MAX(numberofshake) as max_shake, AVG(numberofshake) as avg_shake,
                MIN(valve) as min_valve, MAX(valve) as max_valve, AVG(valve) as avg_valve,
                (MAX(timestamp) - MIN(timestamp)) / 60 as duration_minutes
            FROM \`test\`.\`NodeRed_FBD_L1\`
            WHERE batch LIKE ?
            GROUP BY step, step_desc
            ORDER BY MIN(timestamp) ASC;
        `;
        
        // 🚨 NOTE: Are FBD batches stored with the "-1" suffix in telemetry? 
        // If not, you might need to use baseBatch like you did in the recipe helper!
        const [rows] = await dbTest.promise().query(sql, [`%${batch}%`]);
        
        console.log(`[FBD Telemetry] ✅ Found ${rows.length} rows for batch "${batch}".`);

        // 🛠️ CHECKPOINT 1: RAW SQL RESULTS
        if (rows.length > 0) {
            console.log(`\n=== 🛠️ RAW SQL ROWS FOR FBD BATCH: ${batch} ===`);
            console.table(rows.map(r => ({ 
                step: r.step, 
                desc: r.step_desc, 
                min_inlet: r.min_inlet,
                min_flow: r.min_flow,
                duration: r.duration_minutes 
            })));
            console.log(`===================================================\n`);
        } else {
            console.log(`[FBD Telemetry] ⚠️ WARNING: Database returned 0 rows! Check the batch name string.`);
        }

        const fmt = (val) => {
            if (val === null || val === undefined || val === '') return null;
            const num = Number(val);
            return isNaN(num) ? null : parseFloat(num.toFixed(2));
        };

        let dischargeCount = 1;

        for (const row of rows) {
            const desc = (row.step_desc || '').toLowerCase();

            const minInlet = fmt(row.min_inlet); const maxInlet = fmt(row.max_inlet); const avgInlet = fmt(row.avg_inlet);
            const minProd = fmt(row.min_prod); const maxProd = fmt(row.max_prod); const avgProd = fmt(row.avg_prod);
            const minFlow = fmt(row.min_flow); const maxFlow = fmt(row.max_flow); const avgFlow = fmt(row.avg_flow);
            const minFc = fmt(row.min_fc); const maxFc = fmt(row.max_fc); const avgFc = fmt(row.avg_fc);
            const minShake = fmt(row.min_shake); const maxShake = fmt(row.max_shake); const avgShake = fmt(row.avg_shake);
            const minValve = fmt(row.min_valve); const maxValve = fmt(row.max_valve); const avgValve = fmt(row.avg_valve);
            const duration = fmt(row.duration_minutes);

            const assignMetrics = (prefix) => {
    // Inlet Temp
    results[`${prefix}_temp_min1`] = minInlet; 
    results[`${prefix}_temp_max1`] = maxInlet; 
    results[`${prefix}_temp_avg1`] = avgInlet;

    // Exhaust Temp (mapped from product_temp column)
    results[`${prefix}_exhaust_min1`] = minProd; 
    results[`${prefix}_exhaust_max1`] = maxProd; 
    results[`${prefix}_exhaust_avg1`] = avgProd;

    // Airflow (using _airflow_ to match React)
    results[`${prefix}_airflow_min1`] = minFlow; 
    results[`${prefix}_airflow_max1`] = maxFlow; 
    results[`${prefix}_airflow_avg1`] = avgFlow;

    // Filter Clear Interval
    results[`${prefix}_filter_min1`] = minFc; 
    results[`${prefix}_filter_max1`] = maxFc; 
    results[`${prefix}_filter_avg1`] = avgFc;

    // Number of Filter Shake (using _filtershake_ to match React)
    results[`${prefix}_filtershake_min1`] = minShake; 
    results[`${prefix}_filtershake_max1`] = maxShake; 
    results[`${prefix}_filtershake_avg1`] = avgShake;

    // Valve
    results[`${prefix}_valve_min1`] = minValve; 
    results[`${prefix}_valve_max1`] = maxValve; 
    results[`${prefix}_valve_avg1`] = avgValve;

    // Time / Duration (using both _waktu_ and _time_ to cover both bases)
    results[`${prefix}_time_min1`] = duration; 
    results[`${prefix}_time_max1`] = duration; 
    results[`${prefix}_time_avg1`] = duration;

    results[`${prefix}_waktu_min1`] = duration; 
    results[`${prefix}_waktu_max1`] = duration; 
    results[`${prefix}_waktu_avg1`] = duration;
};

            // 3. Route the data based on step description
            
            // 🚨 We check Transfer FIRST so "transfer granul - loading" doesn't get hijacked by the Loading block
            if (desc.includes('transfer') || desc.includes('transfer granul - loading')) {
                assignMetrics('transfer');
                
            } else if (desc.includes('loading')) {
                assignMetrics('loading');
                
            } else if (desc.includes('drying') || desc.includes('heat machine') || desc.includes('endpoint')) {
                // Captures "endpoint 30,7 Temp. exhaust" and "Heat Machine"
                assignMetrics('drying');
                
            } else if (desc.includes('discharge')) {
                if (dischargeCount <= 3) { 
                    assignMetrics(`discharge_${dischargeCount}`);
                    dischargeCount++;
                }
            }
        }

        // 🛠️ CHECKPOINT 2: FINAL MAPPED PAYLOAD
        console.log(`\n=== 📦 MAPPED FBD TELEMETRY PAYLOAD ===`);
        console.log(results);
        console.log(`=======================================\n`);

        return results;

    } catch (error) {
        console.error(`[FBD Telemetry ERROR] Failed to fetch data:`, error.message);
        return results; 
    }
};

const getMixerData = async (batchStart, batchEnd) => {
    // We query data_format_0 which represents the mixing time/parameter
    const sql = `
        SELECT data_format_0 AS mixing_val
        FROM parammachine_saka.\`cMT-FHDGEA1_EBR_Finalmix_new_data\`
        WHERE \`time@timestamp\` BETWEEN ? AND ?
    `;

    const [rows] = await db3.promise().query(sql, [batchStart, batchEnd]);

    const results = {
        mixing_time_min: 0,
        mixing_time_max: 0,
        mixing_time_avg: 0
    };

    if (rows.length > 0) {
        const values = rows.map(r => parseFloat(r.mixing_val)).filter(v => !isNaN(v));
        if (values.length > 0) {
            results.mixing_time_min = Math.min(...values);
            results.mixing_time_max = Math.max(...values);
            results.mixing_time_avg = values.reduce((a, b) => a + b, 0) / values.length;
        }
    }

    return results;
};

const getEPHPhaseData1 = async (line, batch, dayStart, dayEnd) => {
    const baseBatch = batch.replace(/-[12]$/, '').trim();
    const results = {};
    if (line !== 'Line 1') return results;

    const stateTableName = 'mezanine.tengah_CtrlIntrfceEPHL1_data';
        const sensorTableName = 'cMT-FHDGEA1_EBR_EPH_new_data';

    
    // --- 1. THE DIAGNOSTIC QUERY ---
    // First, let's see if the table is even alive
    const [allRowsToday] = await db4.promise().query(
        `SELECT data_format_7 FROM \`parammachine_saka\`.\`${stateTableName}\` WHERE \`time@timestamp\` BETWEEN ? AND ? LIMIT 1`, 
        [dayStart, dayEnd]
    );
    
    if (allRowsToday.length === 0) {
        console.log(`!!! ALERT: EPH Table is TOTALLY EMPTY for this time range (${dayStart} to ${dayEnd})`);
    }

    // --- 2. THE MAIN QUERY (Matching FBD style) ---
    const sqlState = `
        SELECT \`time@timestamp\` AS ts, data_format_6 AS description, data_format_3 AS hours, data_format_4 AS minutes
        FROM \`parammachine_saka\`.\`${stateTableName}\`
        WHERE data_format_7 LIKE ? 
        AND \`time@timestamp\` BETWEEN ? AND ?
        ORDER BY \`time@timestamp\` ASC
    `;
    
    const [stateRows] = await db4.promise().query(sqlState, [`%${baseBatch}%`, dayStart, dayEnd]);

    console.log(`--- EPH DEBUG ---`);
    console.log(`Batch: ${baseBatch} | Range: ${dayStart}-${dayEnd}`);
    console.log(`Total state rows found: ${stateRows.length}`);

    // LOG: See the first few descriptions to check for Pengayakan strings
    if (stateRows.length > 0) {
        console.log(`Sample Mezzanine Description: "${stateRows[0].description}"`);
    }

    let segments = { discharge1: [], discharge2: [], discharge3: [] };
    let currentPhase = null;
    let currentSegment = null;

    stateRows.forEach(row => {
    let phase = null;
    
    // Convert Buffer/BLOB to String before calling toLowerCase()
    const desc = row.description 
        ? row.description.toString().toLowerCase() 
        : '';

    if (desc.includes('discharge 1')) phase = 'discharge1';
    else if (desc.includes('discharge 2')) phase = 'discharge2';
    else if (desc.includes('discharge 3')) phase = 'discharge3';

        if (phase) {
            const totalMins = (parseInt(row.hours) * 60) + parseInt(row.minutes);
            if (currentPhase !== phase) {
                if (currentSegment) segments[currentPhase].push(currentSegment);
                currentPhase = phase;
                currentSegment = { startTs: row.ts, endTs: row.ts, startMins: totalMins, endMins: totalMins };
            } else {
                currentSegment.endTs = row.ts;
                currentSegment.endMins = totalMins;
            }
        } else if (currentSegment) {
            segments[currentPhase].push(currentSegment);
            currentPhase = null;
            currentSegment = null;
        }
    });
    if (currentSegment) segments[currentPhase].push(currentSegment);

    console.log(`Windows Found: D1(${segments.discharge1.length}), D2(${segments.discharge2.length}), D3(${segments.discharge3.length})`);

    // Calculate Durations
    const calcDuration = (phaseSegments) => phaseSegments.reduce((acc, seg) => acc + (seg.endMins - seg.startMins), 0);
    results['discharge1_waktu_avg'] = calcDuration(segments.discharge1);
    results['discharge2_waktu_avg'] = calcDuration(segments.discharge2);
    results['discharge3_waktu_avg'] = calcDuration(segments.discharge3);

    // --- 2. GET SENSOR DATA ---
    const sqlSensor = `
        SELECT \`time@timestamp\` AS ts, data_format_2 AS valve, data_format_3 AS speed
        FROM \`ems_saka\`.\`${sensorTableName}\`
        WHERE data_format_0 LIKE ? 
        AND \`time@timestamp\` BETWEEN ? AND ?
    `;
    
    const [sensorRows] = await db4.promise().query(sqlSensor, [`%${baseBatch}%`, dayStart, dayEnd]);

    const isInSegment = (ts, phaseSegments) => phaseSegments.some(seg => ts >= seg.startTs && ts <= seg.endTs);

    const d1Data = sensorRows.filter(r => isInSegment(r.ts, segments.discharge1));
    const d2Data = sensorRows.filter(r => isInSegment(r.ts, segments.discharge2));
    const d3Data = sensorRows.filter(r => isInSegment(r.ts, segments.discharge3));

    console.log(`Filtered EPH Sensors: D1(${d1Data.length}), D2(${d2Data.length}), D3(${d3Data.length})`);
    console.log(`------------------------------------------`);

    // --- 3. CALCULATE METRICS ---
    const calculateMetrics = (prefix, groupRows, mappingArray) => {
        mappingArray.forEach(m => {
            const values = groupRows.map(r => parseFloat(r[m.dbKey])).filter(v => !isNaN(v));
            if (values.length > 0) {
                results[`${prefix}_${m.tagKey}_min`] = Math.min(...values);
                results[`${prefix}_${m.tagKey}_max`] = Math.max(...values);
                results[`${prefix}_${m.tagKey}_avg`] = values.reduce((a, b) => a + b, 0) / values.length;
            }
        });
    };

    const sensorMap = [{ dbKey: 'valve', tagKey: 'valve' }, { dbKey: 'speed', tagKey: 'speed' }];
    if (d1Data.length > 0) calculateMetrics('discharge1', d1Data, sensorMap);
    if (d2Data.length > 0) calculateMetrics('discharge2', d2Data, sensorMap);
    if (d3Data.length > 0) calculateMetrics('discharge3', d3Data, sensorMap);

    return results;
};

/*const getEPHPhaseData = async (line, batch, dayStart, dayEnd) => {
    const baseBatch = batch.replace(/-[12]$/, '').trim();
    const results = {};
    if (line !== 'Line 1') return results;

    const stateTableName = 'mezanine.tengah_CtrlIntrfceEPHL1_data';
    // UPDATED: Sensor table name to the new NodeRed table
    const sensorTableName = 'NodeRed_EPH_L1';

    // --- 1. THE DIAGNOSTIC QUERY ---
    // First, let's see if the table is even alive
    const [allRowsToday] = await db4.promise().query(
        `SELECT data_format_7 FROM \`parammachine_saka\`.\`${stateTableName}\` WHERE \`time@timestamp\` BETWEEN ? AND ? LIMIT 1`, 
        [dayStart, dayEnd]
    );
    
    if (allRowsToday.length === 0) {
        console.log(`!!! ALERT: EPH Table is TOTALLY EMPTY for this time range (${dayStart} to ${dayEnd})`);
    }

    // --- 2. THE MAIN QUERY (Matching FBD style) ---
    const sqlState = `
        SELECT \`time@timestamp\` AS ts, data_format_6 AS description, data_format_3 AS hours, data_format_4 AS minutes
        FROM \`parammachine_saka\`.\`${stateTableName}\`
        WHERE data_format_7 LIKE ? 
        AND \`time@timestamp\` BETWEEN ? AND ?
        ORDER BY \`time@timestamp\` ASC
    `;
    
    const [stateRows] = await db4.promise().query(sqlState, [`%${baseBatch}%`, dayStart, dayEnd]);

    console.log(`--- EPH DEBUG ---`);
    console.log(`Batch: ${baseBatch} | Range: ${dayStart}-${dayEnd}`);
    console.log(`Total state rows found: ${stateRows.length}`);

    // LOG: See the first few descriptions to check for Pengayakan strings
    if (stateRows.length > 0) {
        console.log(`Sample Mezzanine Description: "${stateRows[0].description}"`);
    }

    let segments = { discharge1: [], discharge2: [], discharge3: [] };
    let currentPhase = null;
    let currentSegment = null;

    stateRows.forEach(row => {
        let phase = null;
        
        // Convert Buffer/BLOB to String before calling toLowerCase()
        const desc = row.description 
            ? row.description.toString().toLowerCase() 
            : '';

        if (desc.includes('discharge 1')) phase = 'discharge1';
        else if (desc.includes('discharge 2')) phase = 'discharge2';
        else if (desc.includes('discharge 3')) phase = 'discharge3';

        if (phase) {
            const totalMins = (parseInt(row.hours) * 60) + parseInt(row.minutes);
            if (currentPhase !== phase) {
                if (currentSegment) segments[currentPhase].push(currentSegment);
                currentPhase = phase;
                currentSegment = { startTs: row.ts, endTs: row.ts, startMins: totalMins, endMins: totalMins };
            } else {
                currentSegment.endTs = row.ts;
                currentSegment.endMins = totalMins;
            }
        } else if (currentSegment) {
            segments[currentPhase].push(currentSegment);
            currentPhase = null;
            currentSegment = null;
        }
    });
    if (currentSegment) segments[currentPhase].push(currentSegment);

    console.log(`Windows Found: D1(${segments.discharge1.length}), D2(${segments.discharge2.length}), D3(${segments.discharge3.length})`);

    // Calculate Durations
    const calcDuration = (phaseSegments) => phaseSegments.reduce((acc, seg) => acc + (seg.endMins - seg.startMins), 0);
    results['discharge1_waktu_avg'] = calcDuration(segments.discharge1);
    results['discharge2_waktu_avg'] = calcDuration(segments.discharge2);
    results['discharge3_waktu_avg'] = calcDuration(segments.discharge3);

    // --- 2. GET SENSOR DATA (UPDATED) ---
    // Changed to use dbTest and explicit column names from NodeRed_EPH_L1
    const sqlSensor = `
        SELECT 
            \`timestamp\` AS ts, 
            valve AS valve, 
            speed AS speed
        FROM \`test\`.\`${sensorTableName}\`
        WHERE batchid LIKE ? 
        AND \`timestamp\` BETWEEN ? AND ?
    `;
    
    // UPDATED: Executing the query on dbTest instead of db4
    const [sensorRows] = await dbTest.promise().query(sqlSensor, [`%${baseBatch}%`, dayStart, dayEnd]);

    const isInSegment = (ts, phaseSegments) => phaseSegments.some(seg => ts >= seg.startTs && ts <= seg.endTs);

    const d1Data = sensorRows.filter(r => isInSegment(r.ts, segments.discharge1));
    const d2Data = sensorRows.filter(r => isInSegment(r.ts, segments.discharge2));
    const d3Data = sensorRows.filter(r => isInSegment(r.ts, segments.discharge3));

    console.log(`Filtered EPH Sensors: D1(${d1Data.length}), D2(${d2Data.length}), D3(${d3Data.length})`);
    console.log(`------------------------------------------`);

    // --- 3. CALCULATE METRICS (Unchanged) ---
    const calculateMetrics = (prefix, groupRows, mappingArray) => {
        mappingArray.forEach(m => {
            const values = groupRows.map(r => parseFloat(r[m.dbKey])).filter(v => !isNaN(v));
            if (values.length > 0) {
                results[`${prefix}_${m.tagKey}_min`] = Math.min(...values);
                results[`${prefix}_${m.tagKey}_max`] = Math.max(...values);
                results[`${prefix}_${m.tagKey}_avg`] = values.reduce((a, b) => a + b, 0) / values.length;
            }
        });
    };

    const sensorMap = [{ dbKey: 'valve', tagKey: 'valve' }, { dbKey: 'speed', tagKey: 'speed' }];
    if (d1Data.length > 0) calculateMetrics('discharge1', d1Data, sensorMap);
    if (d2Data.length > 0) calculateMetrics('discharge2', d2Data, sensorMap);
    if (d3Data.length > 0) calculateMetrics('discharge3', d3Data, sensorMap);

    return results;
};*/

const getEPHPhaseData = async (line, batch, dayStart, dayEnd) => {
   const results = {};
    
    // --- DYNAMIC LOT DETECTION ---
    const lotSuffix = batch.split('-')[1]?.trim() || '1'; 

    if (line !== 'Line 1') return results;

    try {
        const sql = `
            SELECT 
                step,
                LOWER(TRIM(step_desc)) AS desc_lower,
                MIN(valve) as min_valve, MAX(valve) as max_valve, AVG(valve) as avg_valve,
                MIN(speed) as min_speed, MAX(speed) as max_speed, AVG(speed) as avg_speed,
                (MAX(\`timestamp\`) - MIN(\`timestamp\`)) / 60 as duration_minutes
            FROM \`test\`.\`NodeRed_EPH_L1\`
            WHERE batchid LIKE ? 
            AND \`timestamp\` BETWEEN ? AND ?
            GROUP BY step, LOWER(TRIM(step_desc))
            ORDER BY step ASC
        `;

        const [rows] = await dbTest.promise().query(sql, [`%${batch}%`, dayStart, dayEnd]);

        const fmt = (val) => {
            if (val === null || val === undefined || val === '') return null;
            const num = Number(val);
            return isNaN(num) ? null : parseFloat(num.toFixed(2));
        };

        rows.forEach(row => {
            const desc = row.desc_lower || '';

            let index = null;
            if (desc.includes('discharge')) {
                const match = desc.match(/\d+/);
                if (match) index = match[0];
            } else if (row.step) {
                index = row.step;
            }

            if (index) {
                // Injecting lotSuffix dynamically into the keys
                results[`finalmix_discharge${index}_min${lotSuffix}`] = fmt(row.min_valve);
                results[`finalmix_discharge${index}_max${lotSuffix}`] = fmt(row.max_valve);
                results[`finalmix_discharge${index}_avg${lotSuffix}`] = fmt(row.avg_valve);

                results[`finalmix_speed${index}_min${lotSuffix}`] = fmt(row.min_speed);
                results[`finalmix_speed${index}_max${lotSuffix}`] = fmt(row.max_speed);
                results[`finalmix_speed${index}_avg${lotSuffix}`] = fmt(row.avg_speed);

                results[`finalmix_waktu${index}_min${lotSuffix}`] = fmt(row.duration_minutes);
                results[`finalmix_waktu${index}_max${lotSuffix}`] = fmt(row.duration_minutes);
                results[`finalmix_waktu${index}_avg${lotSuffix}`] = fmt(row.duration_minutes);
            }
        });

        return results;

    } catch (error) {
        console.error(`[EPH Telemetry ERROR] Failed to fetch data:`, error.message);
        return results;
    }
};

const getEPHRecipeData = async (line, batch, dayStart, dayEnd) => {
    const results = {};
    const baseBatch = batch.split('-')[0].trim();
    
    if (line !== 'Line 1') return results;

    try {
        // FIXED: Now using `EPH_BatchID` and `unix_timestamp` exactly as they appear in the DB
        const sqlRecipe = `
            SELECT * FROM \`test\`.\`NodeRed_recipe_EPH_L1\` 
            WHERE \`EPH_BatchID\` LIKE ? 
            ORDER BY \`unix_timestamp\` DESC 
            LIMIT 1
        `;
        
        const [rows] = await dbTest.promise().query(sqlRecipe, [`%${baseBatch}%`]);

        // LOGGING: This should now say "Rows Found: 1" in your terminal!
        console.log(`[EPH Recipe] Searching Batch: "${baseBatch}" | Rows Found: ${rows.length}`);

        if (rows && rows.length > 0) {
            const row = rows[0];
            
            // Smart search to handle hyphens vs underscores automatically
            const getVal = (targetName) => {
                if (row[targetName] !== undefined) return row[targetName];
                const normalizedTarget = targetName.toLowerCase().replace(/-/g, '_');
                const actualKey = Object.keys(row).find(key => 
                    key.toLowerCase().replace(/-/g, '_') === normalizedTarget
                );
                return actualKey !== undefined ? row[actualKey] : null; 
            };

            // --- DISCHARGE 1 SETPOINTS ---
            results['discharge_1_recipe_valve'] = getVal('FBD-ExhaustValvePosition3');
            results['discharge_1_recipe_speed'] = getVal('EPH-DrymillSpeed2');
            results['discharge_1_recipe_time'] = getVal('EPH-ProcessTimeTripMin');

            // --- DISCHARGE 2 SETPOINTS ---
            results['discharge_2_recipe_valve'] = getVal('FBD-ExhaustValvePosition4');
            results['discharge_2_recipe_speed'] = getVal('EPH-DrymillSpeed3');
            results['discharge_2_recipe_time'] = getVal('EPH-ProcessTimeTripMin2');

            // --- DISCHARGE 3 SETPOINTS ---
            results['discharge_3_recipe_valve'] = getVal('FBD-ExhaustValvePosition5');
            results['discharge_3_recipe_speed'] = getVal('EPH-DrymillSpeed4');
            results['discharge_3_recipe_time'] = getVal('EPH-ProcessTimeTripMin3');
        }
        
        return results;

    } catch (error) {
        // If the query fails, it will print the exact SQL error here so we can see it
        console.error(`[EPH Recipe ERROR] Failed to fetch data:`, error.message);
        return results; 
    }
};

const getBinderData = async (startTime, endTime) => {
    // We only need the numeric columns for our Min/Max/Avg calculations
    const sql = `
        SELECT 
            data_format_6 AS speed, 
            data_format_7 AS waktu
        FROM \`parammachine_saka\`.\`mezanine.tengah_Ebr_Binder1_data\`
        WHERE \`time@timestamp\` BETWEEN ? AND ?
    `;

    // Make sure to use the correct database connection here (db3 or db4)
    const [rows] = await db4.promise().query(sql, [startTime, endTime]);

    const results = {
        binder_speed_min: null,
        binder_speed_max: null,
        binder_speed_avg: null,
        binder_waktu_min: null,
        binder_waktu_max: null,
        binder_waktu_avg: null
    };

    if (rows.length > 0) {
        // Extract and filter valid numbers
        const speeds = rows.map(r => parseFloat(r.speed)).filter(v => !isNaN(v));
        const waktus = rows.map(r => parseFloat(r.waktu)).filter(v => !isNaN(v));

        if (speeds.length > 0) {
            results.binder_speed_min = Math.min(...speeds);
            results.binder_speed_max = Math.max(...speeds);
            results.binder_speed_avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
        }

        if (waktus.length > 0) {
            results.binder_waktu_min = Math.min(...waktus);
            results.binder_waktu_max = Math.max(...waktus);
            results.binder_waktu_avg = waktus.reduce((a, b) => a + b, 0) / waktus.length;
        }
    }

    return results;
};

const getMonitoringData = async (monitorTable, startTime, endTime) => {
    // If we don't have a table name, fail gracefully
    if (!monitorTable) {
        console.log('No monitoring table provided to helper.');
        return {};
    }

    const sql = `
        SELECT 
            MIN(data_format_0)/10.0 AS suhu_min1, 
            MAX(data_format_0)/10.0 AS suhu_max1, 
            ROUND(AVG(data_format_0)/10.0, 1) AS suhu_avg1, 
            
            MIN(data_format_1)/10.0 AS rh_min1, 
            MAX(data_format_1)/10.0 AS rh_max1, 
            ROUND(AVG(data_format_1)/10.0, 1) AS rh_avg1 
            
        FROM \`ems_saka\`.\`${monitorTable}\` 
        WHERE \`time@timestamp\` BETWEEN ? AND ?
    `;

    try {
        const [rows] = await db4.promise().query(sql, [startTime, endTime]);

        // If the query returns a row but the values are null (no data found in that window)
        if (rows.length === 0 || rows[0].suhu_min1 === null) {
            return {
                suhu_min1: null, suhu_max1: null, suhu_avg1: null,
                rh_min1: null, rh_max1: null, rh_avg1: null
            };
        }

        // Return the first row directly, which contains our aliased keys
        return rows[0]; 
    } catch (error) {
        console.error("Error in getMonitoringData:", error);
        return {};
    }
};

const getRecipeData = async (line, batchSearch) => {
    if (line !== 'Line 1') return { recipe_name: null, product_name: null };

    // Use the base batch (e.g., STMXGF62898)
    const baseBatch = batchSearch.split('-')[0].trim();
    const searchParam = `%${baseBatch}%`;

    try {
        // --- STEP 1: TRY EPH TABLE (Better Names) ---
        const ephSql = `
            SELECT EPH_RecipeName AS recipe_name, EPH_RecipeDescription AS product_name
            FROM \`test\`.\`NodeRed_recipe_EPH_L1\`
            WHERE EPH_BatchID LIKE ?
            ORDER BY unix_timestamp DESC LIMIT 1
        `;
        const [ephRows] = await dbTest.promise().query(ephSql, [searchParam]);

        if (ephRows.length > 0 && ephRows[0].product_name) {
            console.log(`Recipe found in EPH for ${baseBatch}`);
            return {
                recipe_name: ephRows[0].recipe_name,
                product_name: ephRows[0].product_name.toString().trim()
            };
        }

        // --- STEP 2: FALLBACK TO FBD TABLE (If EPH is empty) ---
        const fbdSql = `
            SELECT FBD_RecipeName AS recipe_name, FBD_RecipeDescription AS product_name
            FROM \`test\`.\`NodeRed_recipe_FBD_L1\`
            WHERE FBD_BatchID LIKE ?
            ORDER BY unix_timestamp DESC LIMIT 1
        `;
        const [fbdRows] = await dbTest.promise().query(fbdSql, [searchParam]);

        if (fbdRows.length > 0) {
            console.log(`Recipe found in FBD (Fallback) for ${baseBatch}`);
            return {
                recipe_name: fbdRows[0].recipe_name,
                product_name: fbdRows[0].product_name.toString().trim()
            };
        }

        return { recipe_name: 'Not Found', product_name: 'Unknown Product' };

    } catch (err) {
        console.error("Error in getRecipeData cascade:", err);
        return { recipe_name: 'Error', product_name: 'Error' };
    }
};

function cleanDateString(dateStr) {
    const monthsId = { 'Mei': 'May', 'Agu': 'Aug', 'Okt': 'Oct', 'Des': 'Dec' };
    let cleaned = dateStr;
    for (const [idMon, enMon] of Object.entries(monthsId)) {
        cleaned = cleaned.replace(idMon, enMon);
    }
    return cleaned;
}

// Helper to safely format extracted dates to YYYY-MM-DD
function formatScheduleDate(rawDateStr) {
    try {
        const cleaned = cleanDateString(rawDateStr);
        const parsedDate = new Date(cleaned);
        if (!isNaN(parsedDate)) {
            return parsedDate.toISOString().split('T')[0];
        }
    } catch (e) {
        console.error("Date formatting error:", e);
    }
    return "1970-01-01";
}

const SENSOR_MAPPING = {
    'Z-Axis': {
        table: 'vibrationPMAL1_vibration1pmaL1_data',
        columns: {
            'data_format_0': { key: 'hf_rms_accel', scale: 1000 },
            'data_format_1': { key: 'rms_velocity', scale: 1000 },
            'data_format_2': { key: 'peak_accel', scale: 1000 },
            'data_format_3': { key: 'peak_vel_freq', scale: 1000 },
            'data_format_4': { key: 'rms_accel', scale: 1000 },
            'data_format_5': { key: 'kurtosis', scale: 10 },
            'data_format_6': { key: 'crest_factor', scale: 1000 },
            'data_format_7': { key: 'peak_velocity', scale: 1000 }
        }
    },
    'X-Axis': {
        table: 'vibrationPMAL1_vibration2pmaL1_data',
        columns: {
            'data_format_0': { key: 'rms_velocity', scale: 1000 },
            'data_format_1': { key: 'peak_accel', scale: 1000 },
            'data_format_2': { key: 'peak_vel_freq', scale: 1000 },
            'data_format_3': { key: 'rms_accel', scale: 1000 },
            'data_format_4': { key: 'kurtosis', scale: 10 },
            'data_format_5': { key: 'crest_factor', scale: 1000 },
            'data_format_6': { key: 'peak_velocity', scale: 1000 },
            'data_format_7': { key: 'hf_rms_accel', scale: 1000 }
        }
    },
    'Temperature': {
        table: 'vibrationPMAL1_vibration3pmaL1_data',
        columns: {
            'data_format_0': { key: 'temperature', scale: 1000 }
        }
    }
};

// Helper: Calculate MIN, MAX, AVG accurately before downsampling
const calculateStats = (values) => {
    if (values.length === 0) return { min: 0, max: 0, avg: 0 };
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;

    for (let i = 0; i < values.length; i++) {
        let val = values[i];
        if (val < min) min = val;
        if (val > max) max = val;
        sum += val;
    }

    return {
        min: Number(min.toFixed(3)),
        max: Number(max.toFixed(3)),
        avg: Number((sum / values.length).toFixed(3))
    };
};

module.exports = {
  fetchOee: async (request, response) => {
    let fetchQuerry =
      " SELECT `data_index` as 'id', `time@timestamp` as 'time',COALESCE(`data_format_0`, 0) AS 'avability',  COALESCE(`data_format_1`, 0) AS 'performance',  COALESCE(`data_format_2`, 0) AS 'quality',  COALESCE(`data_format_3`, 0) AS 'oee',  COALESCE(`data_format_4`, 0) AS 'output',  COALESCE(`data_format_5`, 0) AS 'runTime',  COALESCE(`data_format_6`, 0) AS 'stopTime',COALESCE(`data_format_7`, 0) AS 'idleTime' FROM " +
      " " +
      "`" +
      request.query.machine +
      "`" +
      "where `time@timestamp` between" +
      " " +
      request.query.start +
      " " +
      "and" +
      " " +
      request.query.finish;

    db3.query(fetchQuerry, (err, result) => {
      return response.status(200).send(result);
    });
  },

  fetchVariableOee: async (request, response) => {
    let fetchQuerry =
      "SELECT AVG(`data_format_0`) as Ava, AVG(`data_format_1`) as Per,  AVG(`data_format_2`) as Qua, AVG(`data_format_3`) AS  oee   FROM " +
      " " +
      "`" +
      request.query.machine +
      "`" +
      " " +
      " where `time@timestamp` between" +
      " " +
      request.query.start +
      " " +
      "and" +
      " " +
      request.query.finish;

    db3.query(fetchQuerry, (err, result) => {
      return response.status(200).send(result);
    });
  },

  fetchDataHardness: async (request, response) => {
    const { nobatch } = request.body;
    let fetchQuerry = `SELECT  id as x , hardness AS y FROM instrument WHERE nobatch= ${db2.escape(
      nobatch
    )} ORDER BY id DESC `;
    db2.query(fetchQuerry, (err, result) => {
      return response.status(200).send(result);
    });
  },
  fetchDataTickness: async (request, response) => {
    const { nobatch } = request.body;
    let fetchQuerry = `SELECT  id as x , thickness AS y FROM instrument WHERE nobatch= ${db2.escape(
      nobatch
    )} ORDER BY id DESC `;
    db2.query(fetchQuerry, (err, result) => {
      return response.status(200).send(result);
    });
  },
  fetchDataDiameter: async (request, response) => {
    const { nobatch } = request.body;
    let fetchQuerry = `SELECT  id as x , diameter AS y FROM instrument WHERE nobatch= ${db2.escape(
      nobatch
    )} `;
    db2.query(fetchQuerry, (err, result) => {
      return response.status(200).send(result);
    });
  },

  fetchDataInstrument: async (request, response) => {
    let fetchQuerry = `select * from instrument ORDER BY id DESC`;
    db2.query(fetchQuerry, (err, result) => {
      return response.status(200).send(result);
    });
  },

  fetchDataLine1: async (request, response) => {
    const date = request.query.date;

    let fetchquerry = `SELECT Mesin , SUM(total)AS Line1 FROM part WHERE MONTH(tanggal) = ${date} AND Line='Line1' GROUP BY Mesin`;
    db.query(fetchquerry, (err, result) => {
      return response.status(200).send(result);
    });
  },
  fetchDataLine2: async (request, response) => {
    const date = request.query.date;

    let fetchquerry = `SELECT Mesin , SUM(total)AS Line2 FROM part WHERE MONTH(tanggal) = ${date} AND Line='Line2' GROUP BY Mesin`;
    db.query(fetchquerry, (err, result) => {
      return response.status(200).send(result);
    });
  },
  fetchDataLine3: async (request, response) => {
    const date = request.query.date;
    let fetchquerry = `SELECT Mesin , SUM(total)AS Line3 FROM part WHERE MONTH(tanggal) = ${date} AND Line='Line3' GROUP BY Mesin`;
    db.query(fetchquerry, (err, result) => {
      return response.status(200).send(result);
    });
  },
  fetchDataLine4: async (request, response) => {
    let fetchquerry =
      "SELECT Mesin , SUM(total)AS Line4 FROM part WHERE MONTH(tanggal) = 4 AND WHERE Line='Line4' GROUP BY Mesin";
    db.query(fetchquerry, (err, result) => {
      return response.status(200).send(result);
    });
  },
  fetchDataPareto: async (request, response) => {
    const date = request.query.date;

    let fatchquerry = `SELECT Line, SUM(total) AS y FROM parammachine_saka.part WHERE MONTH(tanggal) = ${date} GROUP BY Line ORDER BY Line ASC;`;
    db.query(fatchquerry, (err, result) => {
      return response.status(200).send(result);
    });
  },

  getData: async (request, response) => {
    const date = request.query.date;

    var fatchquerry = `SELECT * FROM parammachine_saka.part WHERE MONTH(tanggal) = ${date};`;

    db.query(fatchquerry, (err, result) => {
      return response.status(200).send(result);
    });
  },
  
  fetchEdit: async (request, response) => {
    var fatchquerry = `SELECT * FROM parammachine_saka.part`;

    db.query(fatchquerry, (err, result) => {
      return response.status(200).send(result);
    });
  },

  //==========================================DATA INPUT =================================================

  addData: async (request, response) => {
    const {
      Mesin,
      Line,
      Pekerjaan,
      Detail,
      Tanggal,
      Quantity,
      Unit,
      Pic,
      Tawal,
      Tahir,
      Total,
    } = request.body;
    let postQuery = `INSERT INTO part VALUES (null, ${db.escape(
      Mesin
    )}, ${db.escape(Line)}, ${db.escape(Pekerjaan)}, ${db.escape(
      Detail
    )}, ${db.escape(Tanggal)}, ${db.escape(Quantity)}, ${db.escape(
      Unit
    )}, ${db.escape(Pic)}, ${db.escape(Tawal)}, ${db.escape(
      Tahir
    )}, ${db.escape(Total)})`;
    db.query(postQuery, (err, result) => {
      if (err) {
        return response.status(400).send(err.message);
      } else {
        let fatchquerry = "SELECT * FROM part";
        db.query(fatchquerry, (err, result) => {
          return response.status(200).send(result);
        });
      }
    });
  },

  editData: async (request, response) => {
    let dataUpdate = [];
    let idParams = request.params.id;
    for (let prop in request.body) {
      dataUpdate.push(`${prop} = ${db.escape(request.body[prop])}`);
    }
    let updateQuery = `UPDATE part set ${dataUpdate} where id = ${db.escape(
      idParams
    )}`;

    db.query(updateQuery, (err, result) => {
      if (err) response.status(500).send(err);
      response.status(200).send(result);
    });
  },

  deletData: async (request, response) => {
    let idParams = request.params.id;
    let deleteQuery = `DELETE FROM part WHERE id = ${db.escape(idParams)}`;
    db.query(deleteQuery, (err, result) => {
      if (err) {
        return response.status(400).send(err.message);
      } else {
        return response
          .status(200)
          .send({ isSucess: true, message: "Succes delete data" });
      }
    });
  },

  lineData: async (request, response) => {
    let queryData = "SELECT * FROM parammachine_saka.line_db";

    db2.query(queryData, (err, result) => {
      return response.status(200).send(result);
    });
  },

  procesData: async (request, response) => {
    let data = request.query.line_name;

    let queryData = `SELECT * FROM parammachine_saka.proces_db where line_name = ${db.escape(
      data
    )} `;
    db2.query(queryData, (err, result) => {
      return response.status(200).send(result);
    });
  },

  machineData: async (request, response) => {
    let data = request.query.line_name;
    let data2 = request.query.proces_name;

    let queryData = `SELECT * FROM parammachine_saka.machine_db where line_name = ${db.escape(
      data
    )} AND proces_name = ${db.escape(data2)}`;
    db2.query(queryData, (err, result) => {
      return response.status(200).send(result);
    });
  },

  locationData: async (request, response) => {
    let data = request.query.line_name;
    let data2 = request.query.proces_name;
    let data3 = request.query.machine_name;
    let queryData = `SELECT * FROM parammachine_saka.location_db where line_name = ${db.escape(
      data
    )} AND proces_name = ${db.escape(data2)} AND machine_name = ${db.escape(
      data3
    )} `;
    db2.query(queryData, (err, result) => {
      return response.status(200).send(result);
    });
  },

  

  //=====================================(Login & Register)===============================================================================

  register: async (req, res) => {
    const { username, email, name, password } = req.body;

    let getEmailQuery = `SELECT * FROM users WHERE email=${db.escape(email)}`;
    let isEmailExist = await query(getEmailQuery);
    if (isEmailExist.length > 0) {
      return res.status(400).send({ message: "Email has been used" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);
    const defaultImage =
      "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png";
    let addUserQuery = `INSERT INTO users VALUES (null, 
    ${db.escape(username)}, 
    ${db.escape(email)}, 
    ${db.escape(hashPassword)}, 
    ${db.escape(name)}, 
    false,
    1,
    null,
    null)`;
    let addUserResult = await query(addUserQuery);

    let mail = {
      from: `Admin <khaerul.fariz98@gmail.com>`,
      to: `${email}`,
      subject: `Acount Verification`,
      html: `<a href="http://10.126.15.137/" > Verification Click here</a>`,
    };

    let response = await nodemailer.sendMail(mail);

    return res
      .status(200)
      .send({ data: addUserResult, message: "Register success" });
  },
  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      //console.log(req.body);
      // if (db.connection.state === "disconnected") {
      //   await db.connection.connect();
      // }
      // console.log(db.connection.state);

      const isEmailExist = await query(
        `SELECT * FROM users WHERE email = ${db.escape(email)}`
      );

      if (isEmailExist.length == 0) {
        return res.status(400).send({ message: "email & password infailid1" });
      }

      const isValid = await bcrypt.compare(password, isEmailExist[0].password);

      if (!isValid) {
        return res.status(400).send({ message: "email & password infailid2" });
      }

      // THE FIX: Inject the department into the payload here
      let payload = {
        name: isEmailExist[0].name,
        id: isEmailExist[0].id_users,
        isAdmin: isEmailExist[0].isAdmin,
        level: isEmailExist[0].level,
        imagePath: isEmailExist[0].imagePath,
        department: isEmailExist[0].department // <--- Added this line!
      };
      
      console.log("🚨 SCREAM TEST - PAYLOAD IS:", payload);
      const token = jwt.sign(payload, "khaerul", { expiresIn: "1h" });
      // const token = jwt.sign(payload, "khaerul");
      //const token = jwt.sign(payload, "khaerul", { expiresIn: 600 }); // 5 menit

      console.log("Generated Token Payload:", payload); // Helpful to verify on the server side
      
      delete isEmailExist[0].password;
      return res.status(200).send({
        token,
        message: "email & password sucess",
        data: isEmailExist[0],
      });
    } catch (error) {
      res.status(error.status || 500).send(error);
      console.log(error);
    }
  },
  
 loginData: async (req, res) => {
    try {
      // Extract the core user details from the decoded token
      const userId = req.user.id; 
      const userName = req.user.name; 
      
      // NEW: Grab the department since it is now in the token!
      const userDepartment = req.user.department; 
      
      const loginTime = new Date();
      
      return res.status(200).send({
        message: "Login activity tracked successfully",
        data: {
          userId: userId,
          userName: userName,
          department: userDepartment, // Send it back to the frontend
          loginTime: loginTime
        }
      });
    } catch (error) {
      console.error('❌ Error tracking login:', error);
      res.status(error.statusCode || 500).send({message: 'Error tracking login', error: error.message});
    }
  },

  logoutData: async (req, res) => {
    try {
      // console.log('\n========== LOGOUT TRACKING ==========');
      // console.log('📥 Received token in header:', req.headers.authorization ? 'Yes' : 'No');
      // console.log('🔓 Decoded user from token:', req.user);
      
      const userId = req.user.id; // Extract user_id from token
      const userName = req.user.name; // Extract user name from token
      const logoutTime = new Date();
      
      // console.log('👤 User ID:', userId);
      // console.log('📛 User Name:', userName);
      // console.log('🕐 Logout Time:', logoutTime.toLocaleString());
      // console.log('=====================================\n');
      
      // Log the logout activity to database or perform any tracking needed
      
      return res.status(200).send({
        message: "Logout activity tracked successfully",
        data: {
          userId: userId,
          userName: userName,
          logoutTime: logoutTime
        }
      });
    } catch (error) {
      console.error("❌ Error tracking logout:", error);
      res.status(error.statusCode || 500).send(error);
    }
  },

  fetchAlluser: async (req, res) => {
    try {
      const users = await query(`SELECT * FROM users`);
      return res.status(200).send(users);
    } catch (error) {
      res.status(error.statusCode || 500).send(error);
    }
  },

  checkLogin: async (req, res) => {
    try {
      const users = await query(
        `SELECT * FROM users WHERE id_users = ${db.escape(req.user.id)}`
      );
      return res.status(200).send({
        data: {
          name: users[0].name,
          id: users[0].id_users,
          isAdmin: users[0].isAdmin,
          level: users[0].level,
          imagePath: users[0].imagePath,
        },
      });
    } catch (error) {
      res.status(error.statusCode || 500).send(error);
    }
  },

  updateUsers: async (request, response) => {
    let idParams = request.params.id;
    let levelParams = request.body.level;

    let updateQuery = `UPDATE parammachine_saka.users set level = ${db.escape(
      levelParams
    )} where id_users  = ${db.escape(idParams)}`;

    db.query(updateQuery, (err, result) => {
      if (err) {
        return response.status(400).send(err.message);
      } else {
        return response
          .status(200)
          .send({ isSucess: true, message: "Succes update data" });
      }
    });
  },

  editUsers: (request, response) => {
    let idParams = request.params.id;
    let updateQuery = `UPDATE parammachine_saka.users set level = NULL where id_users  = ${db.escape(
      idParams
    )}`;
    db.query(updateQuery, (err, result) => {
      if (err) {
        return response.status(400).send(err.message);
      } else {
        return response
          .status(200)
          .send({ isSucess: true, message: "Succes update data" });
      }
    });
  },

  deleteUseers: async (request, response) => {
    let idParams = request.params.id;
    let query = `DELETE FROM parammachine_saka.users WHERE id_users = ${db.escape(
      idParams
    )}`;

    db.query(query, (err, result) => {
      if (err) {
        return response.status(400).send(err.message);
      } else {
        return response
          .status(200)
          .send({ isSucess: true, message: "Succes delete data" });
      }
    });
  },

  changePassword: async (request, response) => {
    try {
      const { email, newPassword } = request.body;
      console.log(email, newPassword);

      const isEmailExist = await query(
        `SELECT * FROM users WHERE email = ${db.escape(email)}`
      );
      if (isEmailExist.length == 0) {
        return res.status(400).send({ message: "email & password infailid1" });
      }
      const salt = await bcrypt.genSalt(10);
      const hashPassword = await bcrypt.hash(newPassword, salt);
      await query(
        `UPDATE parammachine_saka.users SET password = ${db.escape(
          hashPassword
        )} WHERE email = ${db.escape(email)}`
      );
      return response
        .status(200)
        .send({ message: "password changed successfully" });
    } catch (error) {
      response.status(error.status || 500).send(error);
      console.log(error);
    }
  },

  //=========================UTILITY=============================================

  fetchEMSn14: async (request, response) => {
    let fetchQuerry =
      "SELECT * FROM parammachine_saka.`cMT-PowerMeterMezzanine_R._N14_& _N14_data`;";
    db2.query(fetchQuerry, (err, result) => {
      return response.status(200).send(result);
    });
  },

  //========================OPE=================================================

  fetchOPE: async (request, response) => {
    const date = request.query.date;
    let query =
      "SELECT AVG(data_format_0) AS Ava, AVG(data_format_1) AS Per, AVG(data_format_2) AS Qua, AVG(data_format_3) AS OEE FROM ( SELECT *      FROM parammachine_saka.`mezanine.tengah_Cm1_data`      UNION ALL      SELECT *      FROM parammachine_saka.`mezanine.tengah_Cm2_data`      UNION ALL      SELECT *      FROM parammachine_saka.`mezanine.tengah_Cm3_data`      UNION ALL      SELECT *      FROM parammachine_saka.`mezanine.tengah_Cm4_data`      UNION ALL      SELECT *      FROM parammachine_saka.`mezanine.tengah_Cm5_data`    ) AS subquery WHERE MONTH(FROM_UNIXTIME(`time@timestamp`)) = " +
      date;
    db2.query(query, (err, result) => {
      return response.status(200).send(result);
    });
  },

  fetchAvaLine: async (request, response) => {
    const date = request.query.date;
    let query =
      "SELECT AVG(data_format_0) AS Ava1 FROM ( SELECT *  FROM parammachine_saka.`mezanine.tengah_Cm1_data`      UNION ALL      SELECT *      FROM parammachine_saka.`mezanine.tengah_Cm2_data`      UNION ALL      SELECT *      FROM parammachine_saka.`mezanine.tengah_Cm3_data`      UNION ALL      SELECT *      FROM parammachine_saka.`mezanine.tengah_Cm4_data`      UNION ALL      SELECT *      FROM parammachine_saka.`mezanine.tengah_Cm5_data`    ) AS subquery WHERE MONTH(FROM_UNIXTIME(`time@timestamp`)) = " +
      date;
    db2.query(query, (err, result) => {
      return response.status(200).send(result);
    });
  },

  fetchAvaMachine: async (request, response) => {
    const date = request.query.date;
    let query =
      "SELECT CAST(FORMAT(AVG(data_format_0),2) AS CHAR) AS indexLabel, 'Avability CM1' AS label, AVG(data_format_0) AS y FROM parammachine_saka.`mezanine.tengah_Cm1_data` WHERE MONTH(FROM_UNIXTIME(`time@timestamp`)) = " +
      `${db.escape(date)}` +
      " UNION ALL SELECT CAST(FORMAT(AVG(data_format_0),2) AS CHAR) AS indexLabel, 'Avability CM2' AS label, AVG(data_format_0) AS y FROM parammachine_saka.`mezanine.tengah_Cm2_data` WHERE MONTH(FROM_UNIXTIME(`time@timestamp`)) = " +
      `${db.escape(date)}` +
      " UNION ALL SELECT CAST(FORMAT(AVG(data_format_0),2) AS CHAR) AS indexLabel, 'Avability CM3' AS label, AVG(data_format_0) AS y FROM parammachine_saka.`mezanine.tengah_Cm3_data` WHERE MONTH(FROM_UNIXTIME(`time@timestamp`)) = " +
      `${db.escape(date)}` +
      " UNION ALL SELECT CAST(FORMAT(AVG(data_format_0),2) AS CHAR) AS indexLabel, 'Avability CM4' AS label, AVG(data_format_0) AS y FROM parammachine_saka.`mezanine.tengah_Cm4_data` WHERE MONTH(FROM_UNIXTIME(`time@timestamp`)) = " +
      `${db.escape(date)}` +
      " UNION ALL SELECT CAST(FORMAT(AVG(data_format_0),2) AS CHAR) AS indexLabel, 'Avability CM5' AS label, AVG(data_format_0) AS y FROM parammachine_saka.`mezanine.tengah_Cm5_data` WHERE MONTH(FROM_UNIXTIME(`time@timestamp`)) = " +
      `${db.escape(date)}` +
      // " UNION ALL SELECT CAST(FORMAT(AVG(data_format_0),2) AS CHAR) AS indexLabel, 'Avability HM1' AS label, AVG(data_format_0) AS y FROM parammachine_saka.`mezanine.tengah_HM1_data` WHERE MONTH(FROM_UNIXTIME(`time@timestamp`)) = " +
      // `${db.escape(date)}` +
      " ORDER BY y DESC;";

    db2.query(query, (err, result) => {
      return response.status(200).send(result);
    });
  },

  //=================Maintenance Report ==============================================================
  reportMTC: async (request, response) => {
    const {
      line,
      proces,
      machine,
      location,
      pic,
      tanggal,
      start,
      finish,
      total,
      sparepart,
      quantity,
      unit,
      PMjob,
      PMactual,
      safety,
      quality,
      status,
      detail,
      breakdown,
    } = request.body;

    let queryData = `INSERT INTO parammachine_saka.mtc_report VALUES (null, 
      ${db.escape(line)}, ${db.escape(proces)}, ${db.escape(
      machine
    )}, ${db.escape(location)},
      ${db.escape(pic)}, ${db.escape(tanggal)}, ${db.escape(
      start
    )}, ${db.escape(finish)}, 
      ${db.escape(total)}, ${db.escape(sparepart)}, ${db.escape(
      quantity
    )}, ${db.escape(unit)},
      ${db.escape(PMjob)}, ${db.escape(PMactual)}, ${db.escape(
      safety
    )}, ${db.escape(quality)},
      ${db.escape(status)}, ${db.escape(detail)} ,${db.escape(breakdown)}
      )`;

    console.log(queryData);

    db.query(queryData, (err, result) => {
      if (err) {
        return response.status(400).send(err.message);
      } else {
        let fatchquerry = "SELECT * FROM parammachine_saka.mtc_report";
        db.query(fatchquerry, (err, result) => {
          return response
            .status(200)
            .send({ message: "data successfully added" });
        });
      }
    });
  },

  reportPRD: async (request, response) => {
    const {
      datetime,
      outputCM1,
      outputCM2,
      outputCM3,
      outputCM4,
      outputCM5,
      afkirCM1,
      afkirCM2,
      afkirCM3,
      afkirCM4,
      afkirCM5,
      percentageCm1,
      percentageCm2,
      percentageCm3,
      percentageCm4,
      percentageCm5,
      totalBox,
      totalMB,
      information,
    } = request.body;

    let queryData = `INSERT INTO parammachine_saka.prod_report VALUES (null,${db.escape(
      datetime
    )},${db.escape(outputCM1)}, ${db.escape(outputCM2)},${db.escape(
      outputCM3
    )},${db.escape(outputCM4)}, ${db.escape(outputCM5)},${db.escape(
      afkirCM1
    )}, ${db.escape(afkirCM2)}, ${db.escape(afkirCM3)},${db.escape(
      afkirCM4
    )}, ${db.escape(afkirCM5)}, ${db.escape(percentageCm1)},${db.escape(
      percentageCm2
    )},${db.escape(percentageCm3)},${db.escape(percentageCm4)},${db.escape(
      percentageCm5
    )}, ${db.escape(totalBox)},${db.escape(totalMB)},${db.escape(
      information
    )})`;

    db.query(queryData, (err, result) => {
      if (err) {
        return response.status(400).send(err.message);
      } else {
        let fatchquerry = "SELECT * FROM parammachine_saka.prod_report";
        db.query(fatchquerry, (err, result) => {
          return response
            .status(200)
            .send({ message: "data successfully added" });
        });
      }
    });
  },

  lastUpdatePRD: async (request, response) => {
    let queryData =
      "SELECT datetime FROM parammachine_saka.prod_report ORDER BY id DESC LIMIT 1;";
    db.query(queryData, (err, result) => {
      return response.status(200).send(result);
    });
  },

  lastUpdateMTC: async (request, response) => {
    let queryData =
      "SELECT tanggal FROM parammachine_saka.mtc_report ORDER BY tanggal DESC LIMIT 1;";
    db.query(queryData, (err, result) => {
      return response.status(200).send(result);
    });
  },

  //-------------------------DATA REPORT-------------MTC-------------

  dataReportMTC: async (request, response) => {
    const date = request.query.date;

    let queryData = `SELECT * FROM parammachine_saka.mtc_report WHERE MONTH(tanggal) = ${db.escape(
      date
    )};`;
    db.query(queryData, (err, result) => {
      return response.status(200).send(result);
    });
  },

  //=========================POWER MANAGEMENT============================================================

  getPowerData: async (request, response) => {
    const { area, start, finish } = request.query;

    const cleanString = area.replace(/(cMT-Gedung-UTY_|_data)/g, "");

    let queryData =
      "SELECT label,  x,  y  FROM ( SELECT (@counter := @counter + 1) AS x, label, y FROM ( SELECT p1.date AS label, p1.id AS x, p2.`" +
      cleanString +
      "` - p1.`" +
      cleanString +
      "` AS y  FROM  parammachine_saka.power_data p1 JOIN  parammachine_saka.power_data p2 ON p2.date = ( SELECT MIN(date)   FROM parammachine_saka.power_data WHERE date > p1.date  ) UNION ALL  SELECT DATE_FORMAT(FROM_UNIXTIME(p1.`time@timestamp`), '%Y-%m-%d') AS label, p1.data_index AS x, p2.`data_format_0` - p1.`data_format_0` AS y  FROM   parammachine_saka.`" +
      area +
      "` p1 JOIN ems_saka.`" +
      area +
      "` p2 ON DATE_FORMAT(FROM_UNIXTIME(p2.`time@timestamp`), '%Y-%m-%d') = ( SELECT MIN(DATE_FORMAT(FROM_UNIXTIME(`time@timestamp`), '%Y-%m-%d'))  FROM ems_saka.`" +
      area +
      "` WHERE DATE_FORMAT(FROM_UNIXTIME(`time@timestamp`), '%Y-%m-%d') > DATE_FORMAT(FROM_UNIXTIME(p1.`time@timestamp`), '%Y-%m-%d')              )      ) AS subquery      CROSS JOIN (SELECT @counter := 0) AS counter_init  ) AS result  HAVING      label >= '" +
      start +
      "'      AND label <= '" +
      finish +
      "'";
    console.log(queryData);

    db4.query(queryData, (err, result) => {
      return response.status(200).send(result);
    });
  },

  getPowerMonthly: async (request, response) => {
    const { area, start, finish } = request.query;
    const cleanString = area.replace(/(cMT-Gedung-UTY_|_data)/g, "");

    let queryData =
      " SELECT      DATE_FORMAT(label, '%b') AS label, MONTH(label) AS x,     SUM(y) AS y  FROM (      SELECT          p1.date AS label,          p1.id AS x,          p2.`" +
      cleanString +
      "` - p1.`" +
      cleanString +
      "` AS y      FROM          parammachine_saka.power_data p1      JOIN          parammachine_saka.power_data p2 ON p2.date = (              SELECT MIN(date)              FROM parammachine_saka.power_data              WHERE date > p1.date          )      UNION ALL      SELECT          DATE_FORMAT(FROM_UNIXTIME(p1.`time@timestamp`), '%Y-%m-%d') AS label,          p1.data_index AS x,          p2.`data_format_0` - p1.`data_format_0` AS y      FROM          parammachine_saka.`" +
      area +
      "` p1      JOIN          parammachine_saka.`" +
      area +
      "` p2          ON DATE_FORMAT(FROM_UNIXTIME(p2.`time@timestamp`), '%Y-%m-%d') = (              SELECT MIN(DATE_FORMAT(FROM_UNIXTIME(`time@timestamp`), '%Y-%m-%d'))              FROM parammachine_saka.`" +
      area +
      "`              WHERE DATE_FORMAT(FROM_UNIXTIME(`time@timestamp`), '%Y-%m-%d') > DATE_FORMAT(FROM_UNIXTIME(p1.`time@timestamp`), '%Y-%m-%d')          )  ) AS subquery  WHERE      MONTH(label) >= " +
      start +
      "      AND MONTH(label) <= " +
      finish +
      "  GROUP BY      MONTH(label)  ORDER BY      MONTH(label);  ";
    console.log(queryData);
    db4.query(queryData, (err, result) => {
      return response.status(200).send(result);
    });
  },

  getPowerSec: async (request, response) => {
    const { area, start, finish } = request.query;

    let queryData =
      "SELECT (`data_index`) AS id, FROM_UNIXTIME(`time@timestamp`) AS datetime, (`data_format_6`) as freq, (`data_format_0`) as PtoP,  (`data_format_3`) as PtoN,(`data_format_7`) as Crnt FROM ems_saka.`" +
      area +
      "`where `time@timestamp` between " +
      start +
      " AND " +
      finish +
      ";";

    db4.query(queryData, (err, result) => {
      return response.status(200).send(result);
    });
  },

  getAvgPower: async (request, response) => {
    const { area, start, finish } = request.query;

    let queryData =
      "SELECT avg(`data_format_0`) AS RR, avg(`data_format_1`) as SS, avg(`data_format_2`) as TT, avg(`data_format_3`) as RN, avg(`data_format_4`) as SN, avg(`data_format_5`) as TN FROM ems_saka.`" +
      area +
      "` where `time@timestamp` between " +
      start +
      " AND " +
      finish +
      " ;";

    db4.query(queryData, (err, result) => {
      return response.status(200).send(result);
    });
  },

  getRangeSet: async (request, response) => {
    let queryData = "SELECT * FROM power_setpoint";
    db4.query(queryData, (err, result) => {
      return response.status(200).send(result);
    });
  },
  //===============================CHILLER COMPRESOR==================================================================

  getChillerData: async (request, response) => {
    const { chiller, kompresor, start, finish } = request.query;

    let queryData = `
    SELECT 
    DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d %H:%i:%s') AS time,
     s.data_format_0 AS 'Status Chiller',
    COALESCE(a.data_format_0, 'No Alarm') AS 'Alarm Chiller',
    COALESCE(p.data_format_0, 'No Setpoint') AS 'Active Setpoint',
    e.data_format_0 AS 'EvapLWT',
    ewt.data_format_0 AS 'EvapEWT',
    c.data_format_0 AS 'Unit Capacity',
    d.data_format_0 AS 'Status Kompresor',
    f.data_format_0 AS 'Unit Capacity',
    g.data_format_0 AS 'Evap Presure',
    h.data_format_0 AS "Cond Presure",
    i.data_format_0 AS "Evap sat Temperature",
    j.data_format_0 AS "Cond sat Temperature",
    k.data_format_0 AS "Suction Temperature",
    l.data_format_0 AS "Discharge Temperature",
    m.data_format_0 AS "Evap Approach",
    n.data_format_0 AS "Cond Approach",
    o.data_format_0 AS "Oil Presure",
    q.data_format_0 AS "EXV Position",
    r.data_format_0 AS "Run Hour Kompressor",
    t.data_format_0 AS "Ampere Kompressor",
    u.data_format_0 AS "No of Start"
    FROM 
    parammachine_saka.\`CMT-DB-Chiller-UTY_R-Status${chiller}_data\` AS s
  LEFT JOIN 
    parammachine_saka.\`CMT-DB-Chiller-UTY_R-Alarm${chiller}_data\` AS a
  ON 
    DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`), '%Y-%m-%d %H:%i')
LEFT JOIN 
    parammachine_saka.\`CMT-DB-Chiller-UTY_R-ActiSetpoi${chiller}_data\` AS p
  ON 
    DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(p.\`time@timestamp\`), '%Y-%m-%d %H:%i')
  LEFT JOIN 
    parammachine_saka.\`CMT-DB-Chiller-UTY_R-EvapLWT${chiller}_data\` AS e
  ON 
    DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(e.\`time@timestamp\`), '%Y-%m-%d %H:%i')
  LEFT JOIN 
    parammachine_saka.\`CMT-DB-Chiller-UTY_R-EvapEWT${chiller}_data\` AS ewt
  ON 
    DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(ewt.\`time@timestamp\`), '%Y-%m-%d %H:%i')
  LEFT JOIN 
    parammachine_saka.\`CMT-DB-Chiller-UTY_R-UnitCap${chiller}_data\` AS c
  ON   
    DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(c.\`time@timestamp\`), '%Y-%m-%d %H:%i')
  LEFT JOIN
    parammachine_saka.\`CMT-DB-Chiller-UTY_R-Status${kompresor}${chiller}_data\` AS d
  ON
    DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d %H:%i')
  LEFT JOIN 
    parammachine_saka.\`CMT-DB-Chiller-UTY_R-Capacity${kompresor}${chiller}_data\` AS f
  ON
    DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(f.\`time@timestamp\`), '%Y-%m-%d %H:%i')
  LEFT JOIN
    parammachine_saka.\`CMT-DB-Chiller-UTY_R-EvapPress${kompresor}${chiller}_data\` AS g
  ON
    DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(g.\`time@timestamp\`), '%Y-%m-%d %H:%i')
  LEFT JOIN
    parammachine_saka.\`CMT-DB-Chiller-UTY_R-CondPress${kompresor}${chiller}_data\` AS h
  ON
    DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(h.\`time@timestamp\`), '%Y-%m-%d %H:%i')
  LEFT JOIN
    parammachine_saka.\`CMT-DB-Chiller-UTY_R-EvapSatTe${kompresor}${chiller}_data\` AS i
  ON
    DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(i.\`time@timestamp\`), '%Y-%m-%d %H:%i')
  LEFT JOIN
    parammachine_saka.\`CMT-DB-Chiller-UTY_R-ConSatTem${kompresor}${chiller}_data\` AS j
  ON
    DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(j.\`time@timestamp\`), '%Y-%m-%d %H:%i')
  LEFT JOIN
    parammachine_saka.\`CMT-DB-Chiller-UTY_R-SuctiTemp${kompresor}${chiller}_data\`AS k
  ON
    DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(k.\`time@timestamp\`), '%Y-%m-%d %H:%i')
  LEFT JOIN
    parammachine_saka.\`CMT-DB-Chiller-UTY_R-DischTemp${kompresor}${chiller}_data\`AS l
  ON
    DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(l.\`time@timestamp\`), '%Y-%m-%d %H:%i')
  LEFT JOIN
    parammachine_saka.\`CMT-DB-Chiller-UTY_R-EvapAppro${kompresor}${chiller}_data\`AS m
  ON
    DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(m.\`time@timestamp\`), '%Y-%m-%d %H:%i')
  LEFT JOIN
    parammachine_saka.\`CMT-DB-Chiller-UTY_R-CondAppro${kompresor}${chiller}_data\`AS n
  ON
    DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(n.\`time@timestamp\`), '%Y-%m-%d %H:%i')
  LEFT JOIN
    parammachine_saka.\`CMT-DB-Chiller-UTY_R-OilPresDf${kompresor}${chiller}_data\`AS o
  ON
    DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(o.\`time@timestamp\`), '%Y-%m-%d %H:%i')
  LEFT JOIN
    parammachine_saka.\`CMT-DB-Chiller-UTY_R-EXVPositi${kompresor}${chiller}_data\`AS q
  ON
    DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(q.\`time@timestamp\`), '%Y-%m-%d %H:%i')
  LEFT JOIN
    parammachine_saka.\`CMT-DB-Chiller-UTY_R-RunHour${kompresor}${chiller}_data\`AS r
  ON
    DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(r.\`time@timestamp\`), '%Y-%m-%d %H:%i')
  LEFT JOIN
    parammachine_saka.\`CMT-DB-Chiller-UTY_R-Ampere${kompresor}${chiller}_data\`AS t
  ON
    DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(t.\`time@timestamp\`), '%Y-%m-%d %H:%i')
  LEFT JOIN
    parammachine_saka.\`CMT-DB-Chiller-UTY_R-No.Start${kompresor}${chiller}_data\`AS u
  ON
    DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(u.\`time@timestamp\`), '%Y-%m-%d %H:%i')
     WHERE 
    DATE(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR) BETWEEN '${start}' AND '${finish}'
    group by s.data_index
    order by DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i');
`;
    console.log(queryData);
    db.query(queryData, (err, result) => {
      return response.status(200).send(result);
    });
  },

  getGraphChiller: async (request) => {
    const { area, chiller, kompresor, start, finish } = request.query;

    // parammachine_saka.\`CMT-DB-Chiller-UTY_${area}_${kompresor}_${chiller}_data\`
    const queryData = `
    SELECT
        DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d %H:%i:%s') AS label,
        data_index AS x,
        data_format_0 AS yr
    FROM
        parammachine_saka.\`CMT-DB-Chiller-UTY_${area}_${kompresor}_${chiller}_data\`
    WHERE
        FROM_UNIXTIME(\`time@timestamp\`) >= '${start}'
        AND FROM_UNIXTIME(\`time@timestamp\`) <= '${finish}'
    ORDER BY
        \`time@timestamp\`;
  `;
    console.log(queryData);

    db.query(queryData, (err, result) => {
      return response.status(200).send(result);
    });
  },

  //=====================EMS Backend====================================

  getTableEMS: async (request, response) => {
    const queryData = `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE (TABLE_NAME LIKE '%cMT-DB-EMS-UTY2%' OR TABLE_NAME LIKE '_data') AND TABLE_NAME NOT LIKE '%_data_format' AND TABLE_NAME NOT LIKE '%_data_section';`;

    db4.query(queryData, (err, result) => {
      return response.status(200).send(result);
    });
  },

  getTempChart: async (request, response) => {
    const { area, start, finish, format } = request.query;
    
    // Adjusted: Removed '+ INTERVAL 1 DAY' and added '- INTERVAL 7 HOUR'
    const queryData = `
      SELECT
        DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) - INTERVAL 7 HOUR, '%Y-%m-%d %H:%i:%s') AS label,
        data_index AS x,
        data_format_${format} AS y
      FROM \`${area}\`
      WHERE
        DATE(FROM_UNIXTIME(\`time@timestamp\`) - INTERVAL 7 HOUR) BETWEEN '${start}' AND '${finish}'
      ORDER BY
        \`time@timestamp\`;
    `;

    db4.query(queryData, (err, result) => {
      if (err) {
        console.error("Error executing query:", err);
        return response.status(500).send("Internal Server Error");
      }

      const parsedResult = result.map((entry) => ({
        ...entry,
        y: parseFloat(entry.y) / 10,
      }));

      return response.status(200).send(parsedResult);
    });
  },

  getAllDataEMS: async (request, response) => {
    const { area, start, finish } = request.query;
    const queryData = `SELECT
    data_index AS id,
    DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`)+ INTERVAL 1 DAY, '%Y-%m-%d %H:%i:%s') AS date,
    ROUND(data_format_0/10, 2) AS temp,
    ROUND(data_format_1/10, 2) AS RH,
    ROUND(data_format_2/10, 2) AS DP
    FROM \`${area}\`
    WHERE
      DATE(FROM_UNIXTIME(\`time@timestamp\`)+ INTERVAL 1 DAY) BETWEEN '${start}' AND '${finish}'
    ORDER BY
      \`time@timestamp\``;

    db4.query(queryData, (err, result) => {
      return response.status(200).send(result);
    });
  },

  // Water Management Backend
  waterSystem: async (request, response) => {
    const { area, start, finish } = request.query;
    const queryGet = `SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`), '%Y-%m-%d') AS label,
      data_index AS x,
      round(data_format_0,2) AS y
      FROM \`${area}\`
      WHERE
        DATE(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}'
      ORDER BY
      \`time@timestamp\``;

    db3.query(queryGet, (err, result) => {
      return response.status(200).send(result);
    });
  },

  waterSankey: async (request, response) => {
    const { start, finish } = request.query;
    const queryGet = `SELECT 
    a AS "Pdam",
    b AS "Domestik",
    c AS "Softwater",
    d AS "Boiler",
    e AS "InletPretreatment",
    f AS "OutletPretreatment",
    g AS "RejectOsmotron",
    h AS "Chiller",
    i AS "Taman",
    j AS "WWTPBiologi",
    k AS "WWTPKimia",
    l AS "WWTPOutlet",
    m AS "Cip",
    n AS "Hotwater",
    o AS "Lab",
    p AS "AtasLabQC",
    q AS "AtasToiletLt2",
    r AS "Workshop",
    s AS "AirMancur"
    FROM 
    (SELECT SUM(data_format_0) as a 
         FROM parammachine_saka.\`cMT-DB-WATER-UTY3_PDAM_Sehari_data\` WHERE
    date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' ) as sum1,
    (SELECT SUM(data_format_0) as b 
         FROM parammachine_saka.\`cMT-DB-WATER-UTY3_Dom_sehari_data\` WHERE
    date(FROM_UNIXTIME(\`time@timestamp\`) ) BETWEEN '${start}' AND '${finish}' ) as sum2,
    (SELECT SUM(data_format_0) as c 
         FROM parammachine_saka.\`cMT-DB-WATER-UTY3_Softwater_sehari_data\` WHERE
    date(FROM_UNIXTIME(\`time@timestamp\`) ) BETWEEN '${start}' AND '${finish}' ) as sum3,
    (SELECT SUM(data_format_0) as d 
         FROM parammachine_saka.\`cMT-DB-WATER-UTY3_Boiler_sehari_data\` WHERE
    date(FROM_UNIXTIME(\`time@timestamp\`) ) BETWEEN '${start}' AND '${finish}' ) as sum4,
    (SELECT SUM(data_format_0) as e 
         FROM parammachine_saka.\`cMT-DB-WATER-UTY3_Inlet_Sehari_data\` WHERE
    date(FROM_UNIXTIME(\`time@timestamp\`) ) BETWEEN '${start}' AND '${finish}' ) as sum5,
    (SELECT SUM(data_format_0) as f 
         FROM parammachine_saka.\`cMT-DB-WATER-UTY3_Outlet_sehari_data\` WHERE
    date(FROM_UNIXTIME(\`time@timestamp\`) ) BETWEEN '${start}' AND '${finish}' ) as sum6,
    (SELECT SUM(data_format_0) as g 
         FROM parammachine_saka.\`cMT-DB-WATER-UTY3_RO_sehari_data\` WHERE
    date(FROM_UNIXTIME(\`time@timestamp\`) ) BETWEEN '${start}' AND '${finish}' ) as sum7,
    (SELECT SUM(data_format_0) as h 
         FROM parammachine_saka.\`cMT-DB-WATER-UTY3_Chiller_sehari_data\` WHERE
    date(FROM_UNIXTIME(\`time@timestamp\`) ) BETWEEN '${start}' AND '${finish}' ) as sum8,
    (SELECT SUM(data_format_0) as i 
         FROM parammachine_saka.\`cMT-DB-WATER-UTY3_Taman_sehari_data\` WHERE
    date(FROM_UNIXTIME(\`time@timestamp\`) ) BETWEEN '${start}' AND '${finish}' ) as sum9,
    (SELECT SUM(data_format_0) as j 
         FROM parammachine_saka.\`cMT-DB-WATER-UTY3_WWTP_Biologi_1d_data\` WHERE
    date(FROM_UNIXTIME(\`time@timestamp\`) ) BETWEEN '${start}' AND '${finish}' ) as sum10,
    (SELECT SUM(data_format_0) as k 
         FROM parammachine_saka.\`cMT-DB-WATER-UTY3_WWTP_Kimia_1d_data\` WHERE
    date(FROM_UNIXTIME(\`time@timestamp\`) ) BETWEEN '${start}' AND '${finish}' ) as sum11,
    (SELECT SUM(data_format_0) as l 
         FROM parammachine_saka.\`cMT-DB-WATER-UTY3_WWTP_Outlet_1d_data\` WHERE
    date(FROM_UNIXTIME(\`time@timestamp\`) ) BETWEEN '${start}' AND '${finish}' ) as sum12,
    (SELECT SUM(data_format_0) as m 
         FROM parammachine_saka.\`cMT-DB-WATER-UTY3_CIP_Sehari_data\` WHERE
    date(FROM_UNIXTIME(\`time@timestamp\`) ) BETWEEN '${start}' AND '${finish}' ) as sum13,
    (SELECT SUM(data_format_0) as n 
         FROM parammachine_saka.\`cMT-DB-WATER-UTY3_Hotwater_Sehari_data\` WHERE
    date(FROM_UNIXTIME(\`time@timestamp\`) ) BETWEEN '${start}' AND '${finish}' ) as sum14,
    (SELECT SUM(data_format_0) as o 
         FROM parammachine_saka.\`cMT-DB-WATER-UTY3_Lab_Sehari_data\` WHERE
    date(FROM_UNIXTIME(\`time@timestamp\`) ) BETWEEN '${start}' AND '${finish}' ) as sum15,
    (SELECT SUM(data_format_0) as p 
         FROM parammachine_saka.\`cMT-DB-WATER-UTY3_Atas QC_Sehari_data\` WHERE
    date(FROM_UNIXTIME(\`time@timestamp\`) ) BETWEEN '${start}' AND '${finish}' ) as sum16,
    (SELECT SUM(data_format_0) as q 
         FROM parammachine_saka.\`cMT-DB-WATER-UTY3_AtsToilet_Sehari_data\` WHERE
    date(FROM_UNIXTIME(\`time@timestamp\`) ) BETWEEN '${start}' AND '${finish}' ) as sum17,
    (SELECT SUM(data_format_0) as r 
         FROM parammachine_saka.\`cMT-DB-WATER-UTY3_Workshop_Sehari_data\` WHERE
    date(FROM_UNIXTIME(\`time@timestamp\`) ) BETWEEN '${start}' AND '${finish}' ) as sum18,
    (SELECT SUM(data_format_0) as s 
         FROM parammachine_saka.\`cMT-DB-WATER-UTY3_AirMancur_Sehari_data\` WHERE
    date(FROM_UNIXTIME(\`time@timestamp\`) ) BETWEEN '${start}' AND '${finish}' ) as sum19`;

    db3.query(queryGet, (err, result) => {
      return response.status(200).send(result);
    });
  },

  // Export Data Water Consumption Daily Backend
  ExportWaterConsumptionDaily: async (request, response) => {
    const { start, finish } = request.query;
    const queryGet = `SELECT 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%d-%m-%Y') AS Tanggal,
    round(d.data_format_0,2) as Domestik,
    round(c.data_format_0,2) as Chiller,
    round(s.data_format_0,2) as Softwater,
    round(b.data_format_0,2) as Boiler,
    round(ip.data_format_0,2) as Inlet_Pretreatment,
    round(op.data_format_0,2) as Outlet_Pretreatment,
    round(ro.data_format_0,2) as Reject_Osmotron,
    round(t.data_format_0,2) as Taman,
    round(iwk.data_format_0,2) as Inlet_WWTP_Kimia,
    round(iwb.data_format_0,2) as Inlet_WWTP_Biologi,
    round(ow.data_format_0,2) as Outlet_WWTP,
    round(cip.data_format_0,2) as CIP,
    round(h.data_format_0,2) as Hotwater,
    round(l.data_format_0,2) as Lab,
    round(atl.data_format_0,2) as Atas_Toilet_Lt2,
    round(atlq.data_format_0,2) as Atas_Lab_QC,
    round(w.data_format_0,2) as Workshop,
    round(os.data_format_0,2) as Osmotron,
    round(lo.data_format_0,2) as Loopo,
    round(p.data_format_0,2) as Produksi,
    round(wa.data_format_0,2) as washing,
    round(l1.data_format_0,2) as lantai1,
    round(pd.data_format_0,2) as pdam
         \` FROM parammachine_saka.\`cMT-DB-WATER-UTY3_Dom_sehari_data\` as d
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Chiller_sehari_data\` as c on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(c.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Softwater_sehari_data\` as s on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Boiler_sehari_data\` as b on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(b.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Inlet_Sehari_data\` as ip on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(ip.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Outlet_sehari_data\` as op on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(op.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_RO_sehari_data\` as ro on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(ro.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Taman_sehari_data\` as t on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(t.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_WWTP_Kimia_1d_data\` as iwk on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(iwk.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_WWTP_Biologi_1d_data\` as iwb on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(iwb.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_WWTP_Outlet_1d_data\` as ow on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(ow.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_CIP_Sehari_data\` as cip on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(cip.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Hotwater_Sehari_data\` as h on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(h.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Lab_Sehari_data\` as l on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(l.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_AtsToilet_Sehari_data\` as atl on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(atl.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Atas QC_Sehari_data\` as atlq on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(atlq.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Workshop_Sehari_data\` as w on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(w.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_AirMancur_Sehari_data\` as am on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(am.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Osmotron_Sehari_data\` as os on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(os.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Loopo_Sehari_data\` as lo on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(lo.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Produksi_Sehari_data\` as p on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(p.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Washing_Sehari_data\` as wa on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(wa.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Lantai1_Sehari_data\` as l1 on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(l1.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_PDAM_Sehari_data\` as pd on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(pd.\`time@timestamp\`), '%Y-%m-%d')
    where  date(FROM_UNIXTIME(d.\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' 
    order by date(FROM_UNIXTIME(d.\`time@timestamp\`));`;

    db3.query(queryGet, (err, result) => {
      return response.status(200).send(result);
    });
  },

  // Export Data Water Totalizer Daily Backend
  ExportWaterTotalizerDaily: async (request, response) => {
    const { start, finish } = request.query;
    const queryGet = `SELECT 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%d-%m-%Y') AS Tanggal,
    round(d.data_format_0,2) as Domestik,
    round(c.data_format_0,2) as Chiller,
    round(s.data_format_0,2) as Softwater,
    round(b.data_format_0,2) as Boiler,
    round(ip.data_format_0,2) as Inlet_Pretreatment,
    round(op.data_format_0,2) as Outlet_Pretreatment,
    round(ro.data_format_0,2) as Reject_Osmotron,
    round(t.data_format_0,2) as Taman,
    round(iwk.data_format_0,2) as Inlet_WWTP_Kimia,
    round(iwb.data_format_0,2) as Inlet_WWTP_Biologi,
    round(ow.data_format_0,2) as Outlet_WWTP,
    round(cip.data_format_0,2) as CIP,
    round(h.data_format_0,2) as Hotwater,
    round(l.data_format_0,2) as Lab,
    round(atl.data_format_0,2) as Atas_Toilet_Lt2,
    round(atlq.data_format_0,2) as Atas_Lab_QC,
    round(w.data_format_0,2) as Workshop,
    round(am.data_format_0,2) as Air_Mancur,
    round(os.data_format_0,2) as Osmotron,
    round(lo.data_format_0,2) as Loopo,
    round(p.data_format_0,2) as Produksi,
    round(wa.data_format_0,2) as washing,
    round(l1.data_format_0,2) as lantai1,
    round(pd.data_format_0,2) as pdam
         \` FROM parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Domestik_data\` as d
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Chiller_data\` as c on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(c.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Softwater_data\` as s on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Boiler_data\` as b on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(b.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Inlet_Pt_data\` as ip on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(ip.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Outlet_Pt_data\` as op on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(op.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_RO_data\` as ro on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(ro.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Taman_data\` as t on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(t.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_WWTP_Kimia_data\` as iwk on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(iwk.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_WWTP_Biologi_data\` as iwb on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(iwb.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_WWTP_Outlet_data\` as ow on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(ow.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_CIP_data\` as cip on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(cip.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Hotwater_data\` as h on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(h.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Lab_data\` as l on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(l.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Atas Toilet2_data\` as atl on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(atl.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Atas Lab QC_data\` as atlq on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(atlq.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Workshop_data\` as w on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(w.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Air Mancur_data\` as am on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(am.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Osmotron_data\` as os on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(os.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Loopo_data\` as lo on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(lo.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Produksi_data\` as p on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(p.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Washing_data\` as wa on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(wa.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Lantai1_data\` as l1 on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(l1.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_PDAM_data\` as pd on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(pd.\`time@timestamp\`), '%Y-%m-%d')
    where  date(FROM_UNIXTIME(d.\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}'`;

    db3.query(queryGet, (err, result) => {
      return response.status(200).send(result);
    });
  },

  // Export Data Water Consumption Daily Backend
  ExportWaterConsumptionMonthly: async (request, response) => {
    const { start, finish } = request.query;
    const queryGet = `SELECT 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%m-%Y') AS Bulan,
    sum(round(d.data_format_0,2)) as Domestik,
    sum(round(c.data_format_0,2)) as Chiller,
    sum(round(s.data_format_0,2)) as Softwater,
    sum(round(b.data_format_0,2)) as Boiler,
    sum(round(ip.data_format_0,2)) as Inlet_Pretreatment,
    sum(round(op.data_format_0,2)) as Outlet_Pretreatment,
    sum(round(ro.data_format_0,2)) as Reject_Osmotron,
    sum(round(t.data_format_0,2)) as Taman,
    sum(round(iwk.data_format_0,2)) as Inlet_WWTP_Kimia,
    sum(round(iwb.data_format_0,2)) as Inlet_WWTP_Biologi,
    sum(round(ow.data_format_0,2)) as Outlet_WWTP,
    sum(round(cip.data_format_0,2)) as CIP,
    sum(round(h.data_format_0,2)) as Hotwater,
    sum(round(l.data_format_0,2)) as Lab,
    sum(round(atl.data_format_0,2)) as Atas_Toilet_Lt2,
    sum(round(atlq.data_format_0,2)) as Atas_Lab_QC,
    sum(round(w.data_format_0,2)) as Workshop,
    sum(round(am.data_format_0,2)) as Air_Mancur,
    sum(round(os.data_format_0,2))as Osmotron,
    sum(round(lo.data_format_0,2)) as Loopo,
    sum(round(p.data_format_0,2)) as Produksi,
    sum(round(wa.data_format_0,2)) as washing,
    sum(round(l1.data_format_0,2)) as lantai1,
    sum(round(pd.data_format_0,2)) as pdam
         \` FROM parammachine_saka.\`cMT-DB-WATER-UTY3_Dom_sehari_data\` as d
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Chiller_sehari_data\` as c on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(c.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Softwater_sehari_data\` as s on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Boiler_sehari_data\` as b on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(b.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Inlet_Sehari_data\` as ip on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(ip.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Outlet_sehari_data\` as op on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(op.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_RO_sehari_data\` as ro on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(ro.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Taman_sehari_data\` as t on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(t.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_WWTP_Kimia_1d_data\` as iwk on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(iwk.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_WWTP_Biologi_1d_data\` as iwb on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(iwb.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_WWTP_Outlet_1d_data\` as ow on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(ow.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_CIP_Sehari_data\` as cip on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(cip.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Hotwater_Sehari_data\` as h on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(h.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Lab_Sehari_data\` as l on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(l.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_AtsToilet_Sehari_data\` as atl on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(atl.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Atas QC_Sehari_data\` as atlq on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(atlq.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Workshop_Sehari_data\` as w on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(w.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_AirMancur_Sehari_data\` as am on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(am.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Osmotron_Sehari_data\` as os on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(os.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Loopo_Sehari_data\` as lo on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(lo.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Produksi_Sehari_data\` as p on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(p.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Washing_Sehari_data\` as wa on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(wa.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Lantai1_Sehari_data\` as l1 on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(l1.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_PDAM_Sehari_data\` as pd on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(pd.\`time@timestamp\`), '%Y-%m-%d')
    where  DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m') BETWEEN '${start}' AND '${finish}' 
    GROUP BY YEAR(date(FROM_UNIXTIME(d.\`time@timestamp\`))), 
    MONTH(date(FROM_UNIXTIME(d.\`time@timestamp\`)))`;

    db3.query(queryGet, (err, result) => {
      return response.status(200).send(result);
    });
  },

  // Export Data Water Totalizer Monthly Backend
  ExportWaterTotalizerMonthly: async (request, response) => {
    const { start, finish } = request.query;
    const queryGet = `SELECT 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%m-%Y') AS Bulan,
    round(d.data_format_0,2) as Domestik,
    round(c.data_format_0,2) as Chiller,
    round(s.data_format_0,2) as Softwater,
    round(b.data_format_0,2) as Boiler,
    round(ip.data_format_0,2) as Inlet_Pretreatment,
    round(op.data_format_0,2) as Outlet_Pretreatment,
    round(ro.data_format_0,2) as Reject_Osmotron,
    round(t.data_format_0,2) as Taman,
    round(iwk.data_format_0,2) as Inlet_WWTP_Kimia,
    round(iwb.data_format_0,2) as Inlet_WWTP_Biologi,
    round(ow.data_format_0,2) as Outlet_WWTP,
    round(cip.data_format_0,2) as CIP,
    round(h.data_format_0,2) as Hotwater,
    round(l.data_format_0,2) as Lab,
    round(atl.data_format_0,2) as Atas_Toilet_Lt2,
    round(atlq.data_format_0,2) as Atas_Lab_QC,
    round(w.data_format_0,2) as Workshop,
    round(am.data_format_0,2) as Air_Mancur,
    round(os.data_format_0,2) as Osmotron,
    round(lo.data_format_0,2) as Loopo,
    round(p.data_format_0,2) as Produksi,
    round(wa.data_format_0,2) as washing,
    round(l1.data_format_0,2) as lantai1,
    round(pd.data_format_0,2) as pdam
    FROM (Select
      max(DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%d-%m-%Y')) as Tgld,
      d.data_index as id
           \` FROM parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Domestik_data\` as d 
      GROUP BY YEAR(date(FROM_UNIXTIME(d.\`time@timestamp\`))), 
      MONTH(date(FROM_UNIXTIME(d.\`time@timestamp\`)))) as tgl,
          parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Domestik_data\` as d
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Chiller_data\` as c on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(c.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Softwater_data\` as s on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Boiler_data\` as b on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(b.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Inlet_Pt_data\` as ip on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(ip.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Outlet_Pt_data\` as op on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(op.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_RO_data\` as ro on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(ro.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Taman_data\` as t on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(t.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_WWTP_Kimia_data\` as iwk on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(iwk.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_WWTP_Biologi_data\` as iwb on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(iwb.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_WWTP_Outlet_data\` as ow on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(ow.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_CIP_data\` as cip on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(cip.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Hotwater_data\` as h on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(h.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Lab_data\` as l on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(l.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Atas Toilet2_data\` as atl on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(atl.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Atas Lab QC_data\` as atlq on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(atlq.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Workshop_data\` as w on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(w.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Air Mancur_data\` as am on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(am.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Osmotron_data\` as os on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(os.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Loopo_data\` as lo on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(lo.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Produksi_data\` as p on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(p.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Washing_data\` as wa on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(wa.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Lantai1_data\` as l1 on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(l1.\`time@timestamp\`), '%Y-%m-%d')
          left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_PDAM_data\` as pd on 
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(pd.\`time@timestamp\`), '%Y-%m-%d')
    where DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%d-%m-%Y') = Tgld and
    DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m') BETWEEN '${start}' AND '${finish}'`;

    db3.query(queryGet, (err, result) => {
      return response.status(200).send(result);
    });
  },

  // Export Data Water Consumption Yearly Backend
  ExportWaterConsumptionYearly: async (request, response) => {
    const { start, finish } = request.query;
    const queryGet = `SELECT 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y') AS Tahun,
      sum(round(d.data_format_0,2)) as Domestik,
      sum(round(c.data_format_0,2)) as Chiller,
      sum(round(s.data_format_0,2)) as Softwater,
      sum(round(b.data_format_0,2)) as Boiler,
      sum(round(ip.data_format_0,2)) as Inlet_Pretreatment,
      sum(round(op.data_format_0,2)) as Outlet_Pretreatment,
      sum(round(ro.data_format_0,2)) as Reject_Osmotron,
      sum(round(t.data_format_0,2)) as Taman,
      sum(round(iwk.data_format_0,2)) as Inlet_WWTP_Kimia,
      sum(round(iwb.data_format_0,2)) as Inlet_WWTP_Biologi,
      sum(round(ow.data_format_0,2)) as Outlet_WWTP,
      sum(round(cip.data_format_0,2)) as CIP,
      sum(round(h.data_format_0,2)) as Hotwater,
      sum(round(l.data_format_0,2)) as Lab,
      sum(round(atl.data_format_0,2)) as Atas_Toilet_Lt2,
      sum(round(atlq.data_format_0,2)) as Atas_Lab_QC,
      sum(round(w.data_format_0,2)) as Workshop,
      sum(round(am.data_format_0,2)) as Air_Mancur,
      sum(round(os.data_format_0,2))as Osmotron,
      sum(round(lo.data_format_0,2)) as Loopo,
      sum(round(p.data_format_0,2)) as Produksi,
      sum(round(wa.data_format_0,2)) as washing,
      sum(round(l1.data_format_0,2)) as lantai1,
      sum(round(pd.data_format_0,2)) as pdam
           \` FROM parammachine_saka.\`cMT-DB-WATER-UTY3_Dom_sehari_data\` as d
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Chiller_sehari_data\` as c on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(c.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Softwater_sehari_data\` as s on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Boiler_sehari_data\` as b on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(b.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Inlet_Sehari_data\` as ip on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(ip.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Outlet_sehari_data\` as op on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(op.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_RO_sehari_data\` as ro on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(ro.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Taman_sehari_data\` as t on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(t.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_WWTP_Kimia_1d_data\` as iwk on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(iwk.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_WWTP_Biologi_1d_data\` as iwb on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(iwb.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_WWTP_Outlet_1d_data\` as ow on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(ow.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_CIP_Sehari_data\` as cip on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(cip.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Hotwater_Sehari_data\` as h on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(h.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Lab_Sehari_data\` as l on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(l.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_AtsToilet_Sehari_data\` as atl on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(atl.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Atas QC_Sehari_data\` as atlq on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(atlq.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Workshop_Sehari_data\` as w on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(w.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_AirMancur_Sehari_data\` as am on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(am.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Osmotron_Sehari_data\` as os on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(os.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Loopo_Sehari_data\` as lo on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(lo.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Produksi_Sehari_data\` as p on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(p.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Washing_Sehari_data\` as wa on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(wa.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Lantai1_Sehari_data\` as l1 on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(l1.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_PDAM_Sehari_data\` as pd on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(pd.\`time@timestamp\`), '%Y-%m-%d')
      where  DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y') BETWEEN '${start}' AND '${finish}' 
      GROUP BY YEAR(date(FROM_UNIXTIME(d.\`time@timestamp\`)))`;

    db3.query(queryGet, (err, result) => {
      return response.status(200).send(result);
    });
  },

  // Export Data Water Totalizer Yearly Backend
  ExportWaterTotalizerYearly: async (request, response) => {
    const { start, finish } = request.query;
    const queryGet = `SELECT 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y') AS Tahun,
      round(d.data_format_0,2) as Domestik,
      round(c.data_format_0,2) as Chiller,
      round(s.data_format_0,2) as Softwater,
      round(b.data_format_0,2) as Boiler,
      round(ip.data_format_0,2) as Inlet_Pretreatment,
      round(op.data_format_0,2) as Outlet_Pretreatment,
      round(ro.data_format_0,2) as Reject_Osmotron,
      round(t.data_format_0,2) as Taman,
      round(iwk.data_format_0,2) as Inlet_WWTP_Kimia,
      round(iwb.data_format_0,2) as Inlet_WWTP_Biologi,
      round(ow.data_format_0,2) as Outlet_WWTP,
      round(cip.data_format_0,2) as CIP,
      round(h.data_format_0,2) as Hotwater,
      round(l.data_format_0,2) as Lab,
      round(atl.data_format_0,2) as Atas_Toilet_Lt2,
      round(atlq.data_format_0,2) as Atas_Lab_QC,
      round(w.data_format_0,2) as Workshop,
      round(am.data_format_0,2) as Air_Mancur,
      round(os.data_format_0,2) as Osmotron,
      round(lo.data_format_0,2) as Loopo,
      round(p.data_format_0,2) as Produksi,
      round(wa.data_format_0,2) as washing,
      round(l1.data_format_0,2) as lantai1,
      round(pd.data_format_0,2) as pdam
      FROM (Select
        max(DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%d-%m-%Y')) as Tgld,
        d.data_index as id
             \` FROM parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Domestik_data\` as d 
        GROUP BY YEAR(date(FROM_UNIXTIME(d.\`time@timestamp\`)))) as tgl,
            parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Domestik_data\` as d
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Chiller_data\` as c on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(c.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Softwater_data\` as s on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Boiler_data\` as b on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(b.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Inlet_Pt_data\` as ip on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(ip.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Outlet_Pt_data\` as op on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(op.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_RO_data\` as ro on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(ro.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Taman_data\` as t on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(t.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_WWTP_Kimia_data\` as iwk on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(iwk.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_WWTP_Biologi_data\` as iwb on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(iwb.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_WWTP_Outlet_data\` as ow on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(ow.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_CIP_data\` as cip on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(cip.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Hotwater_data\` as h on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(h.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Lab_data\` as l on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(l.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Atas Toilet2_data\` as atl on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(atl.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Atas Lab QC_data\` as atlq on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(atlq.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Workshop_data\` as w on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(w.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Air Mancur_data\` as am on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(am.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Osmotron_data\` as os on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(os.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Loopo_data\` as lo on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(lo.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Produksi_data\` as p on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(p.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Washing_data\` as wa on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(wa.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_Lantai1_data\` as l1 on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(l1.\`time@timestamp\`), '%Y-%m-%d')
            left join parammachine_saka.\`cMT-DB-WATER-UTY3_Met_PDAM_data\` as pd on 
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d') = DATE_FORMAT(FROM_UNIXTIME(pd.\`time@timestamp\`), '%Y-%m-%d')
      where DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%d-%m-%Y') = Tgld and
      DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y') BETWEEN '${start}' AND '${finish}'`;

    db3.query(queryGet, (err, result) => {
      return response.status(200).send(result);
    });
  },

  // Power Management 2 Backend
  PowerDaily: async (request, response) => {
  const { area, start, finish } = request.query;
  
  const queryGet = `
    WITH OrderedData AS (
      SELECT 
        data_index AS x,
        -- Apply the 7-hour WIB timezone fix directly to the label
        DATE_FORMAT(DATE_SUB(FROM_UNIXTIME(\`time@timestamp\`), INTERVAL 7 HOUR), '%Y-%m-%d') AS label,
        data_format_0,
        -- Use LAG to instantly grab the previous row's value
        LAG(data_format_0) OVER (ORDER BY data_index) AS previous_format_0
      FROM ems_saka.\`${area}\`
      WHERE data_format_0 > 0
    )
    SELECT 
      x,
      label,
      ROUND(data_format_0 - previous_format_0, 2) AS y
    FROM OrderedData
    WHERE 
      -- Filter using the pre-calculated label and template literals
      label BETWEEN '${start}' AND '${finish}'
      AND previous_format_0 IS NOT NULL;
  `;

  // Reverted to your standard single-parameter query execution
  db4.query(queryGet, (err, result) => {
    if (err) {
      console.error("PowerDaily Query Error:", err);
      // Send the actual SQL error message to the frontend for easier debugging
      return response.status(500).send({ error: "Database query failed", details: err.sqlMessage });
    }
    return response.status(200).send(result);
  });
},

PowerCostDaily: async (request, response) => {
  const { area, start, finish } = request.query;

  try {
    // 1. Fetch the electricity price from the portal
    const getPrice = new Promise((resolve, reject) => {
      const priceQuery = `SELECT * FROM ems_saka.Parameter_Portal ORDER BY id DESC LIMIT 1;`;
      db4.query(priceQuery, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    // 2. Fetch the daily power usage (using the optimized LAG query with the timezone fix)
    const getVolume = new Promise((resolve, reject) => {
      const volumeQuery = `
        WITH OrderedData AS (
          SELECT 
            data_index AS x,
            DATE_FORMAT(DATE_SUB(FROM_UNIXTIME(\`time@timestamp\`), INTERVAL 7 HOUR), '%Y-%m-%d') AS label,
            data_format_0,
            LAG(data_format_0) OVER (ORDER BY data_index) AS previous_format_0
          FROM ems_saka.\`${area}\`
          WHERE data_format_0 > 0
        )
        SELECT 
          x,
          label,
          ROUND(data_format_0 - previous_format_0, 2) AS y
        FROM OrderedData
        WHERE 
          label BETWEEN '${start}' AND '${finish}'
          AND previous_format_0 IS NOT NULL;
      `;
      db4.query(volumeQuery, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    // 3. Execute both queries simultaneously
    const [paramResult, volumeResult] = await Promise.all([getPrice, getVolume]);

    // 4. Extract the electricity price safely
    const currentPowerPrice = paramResult[0]?.Parameter_Listrik || 0; 

    // 5. Fuse the data together with the new cost math
    const finalData = volumeResult.map(day => ({
      label: day.label,
      x: day.x,
      y: Number(day.y || 0),                   // Daily kWh
      cost: Number(day.y || 0) * currentPowerPrice // Total Cost in Rupiah
    }));

    return response.status(200).send(finalData);

  } catch (error) {
    console.error("Power Cost Calculation Error:", error);
    // Keep the awesome debugging trick so it sends SQL errors to your Network tab!
    return response.status(500).send({ 
      error: "Database query failed during cost calculation", 
      details: error.sqlMessage || error.message 
    });
  }
},
  // PowerDaily: async (request, response) => {
  //   const { area, start, finish } = request.query;

  //   // Konversi tanggal untuk logika pemilihan database
  //   const startDate = new Date(start);
  //   const finishDate = new Date(finish);
  //   const startYear = startDate.getFullYear();
  //   const finishYear = finishDate.getFullYear();

  //   let queryGet;
  //   let db;

  //   if (
  //     startYear === 2024 &&
  //     finishYear === 2024 &&
  //     startDate >= new Date("2024-01-01") &&
  //     finishDate <= new Date("2024-07-15")
  //   ) {
  //     // Jika tanggal antara 1 Januari 2024 - 15 Juli 2024, gunakan db3
  //     db = db3;
  //     queryGet = `
  //     SELECT
  //       data_index AS x,
  //       data_format_0 AS y,
  //       DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) + INTERVAL 4 HOUR, '%Y-%m-%d') AS label
  //     FROM \`parammachine_saka\`.\`${area}\`
  //     WHERE date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}'
  //     AND data_format_0 > 0
  //     ORDER BY data_index;
  //   `;
  //   } else if (
  //     startYear === 2024 &&
  //     finishYear === 2024 &&
  //     startDate >= new Date("2024-07-16") &&
  //     finishDate <= new Date("2024-12-31")
  //   ) {
  //     // Jika tanggal antara 16 Juli 2024 - 31 Desember 2024, gunakan db4
  //     db = db4;
  //     queryGet = `
  //     SELECT
  //       data_index AS x,
  //       data_format_0 AS y,
  //       DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) + INTERVAL 4 HOUR, '%Y-%m-%d') AS label
  //     FROM \`ems_saka\`.\`${area}\`
  //     WHERE date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}'
  //     AND data_format_0 > 0
  //     ORDER BY data_index;
  //   `;
  //   } else {
  //     // Jika input selain di atas (tahun >= 2024), gunakan db4 sebagai default
  //     db = db4;
  //     queryGet = `
  //     SELECT
  //       data_index AS x,
  //       data_format_0 AS y,
  //       DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) + INTERVAL 4 HOUR, '%Y-%m-%d') AS label
  //     FROM \`ems_saka\`.\`${area}\`
  //     WHERE date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}'
  //     AND data_format_0 > 0
  //     ORDER BY data_index;
  //   `;
  //   }

  //   // Eksekusi query ke database
  //   db.query(queryGet, (err, result) => {
  //     if (err) {
  //       console.error(err);
  //       return response.status(500).send({ error: "Failed to fetch data" });
  //     }
  //     return response.status(200).send(result);
  //   });
  //   console.log(queryGet);
  // },

  PowerMonthly: async (request, response) => {
    const { area, start, finish } = request.query;
    const queryGet = `SELECT
    s1.\`time@timestamp\`*1000 as x,
    DATE_FORMAT(FROM_UNIXTIME(s1.\`time@timestamp\`) , '%Y-%m') AS label,
    round(sum(s1.data_format_0 -
      (select s2.data_format_0 as previous from
      ems_saka.\`${area}\` as s2
      where s2.data_index < s1.data_index and s2.data_format_0 > 0 order by s2.data_index  desc limit 1)),2) as y
    From ems_saka.\`${area}\` as s1 
    where  DATE_FORMAT(FROM_UNIXTIME(s1.\`time@timestamp\`), '%Y-%m') BETWEEN '${start}' AND '${finish}' and s1.data_format_0 > 0
    GROUP BY YEAR(date(FROM_UNIXTIME(s1.\`time@timestamp\`))), 
    MONTH(date(FROM_UNIXTIME(s1.\`time@timestamp\`)))`;

    db4.query(queryGet, (err, result) => {
      return response.status(200).send(result);
    });
  },

  PowerSankey: async (request, response) => {
    const { start, finish } = request.query;
    const queryGet = `select MVMDP as "MVMDP",
    lvmdp1 as  "LVMDP1",
    lvmdp2 as  "LVMDP2",
    SP16 as  "SolarPanel16",
    SP712 as  "SolarPanel712",
    utility as  "SDP1Utility",
    utilitylt2 as  "PPLP1UtilityLt2",
    chiller as  "PP1Chiller",
    utilitylt1 as  "PPLP1UtilityLt1",
    genset as "PP1Genset",
    boilerPW as  "PP1BoilerPW",
    kompressor as  "PP1Kompressor",
    HWP as  "PP1HWP",
    pump as  "PP1PUMPS",
    lift as  "PP1Lift",
    ac11 as  "PP1AC11",
    ac12 as  "PP1AC12",
    ac13 as  "PP1AC13",
    ac23 as  "PP1AC23",
    produksi1 as  "SDP1Produksi",
    produksi2 as  "SDP2Produksi",
    hydrant as  "PP2Hydrant",
    puyer as  "PP2Puyer",
    fatigon as  "PP2Fatigon",
    mixagrib as  "PP2Mixagrib",
    lablt2 as  "PP2LabLt2",
    fasilitas as  "PP2Fasilitas",
    packwh as  "PP2PackWH",
    pro11 as  "LP2PRO11",
    pro12 as  "LP2PRO12",
    pro13 as  "LP2PRO13",
    pro23 as  "LP2PRO23",
    pro31 as  "LP2PRO31",
    pro41 as  "LP2PRO41",
    wh11 as  "LP2WH11",
    mezz11 as  "PPLP2Mezz11",
    posjaga1 as  "PPLP1PosJaga1",
    PosJaga2 as  "PPLP1PosJaga2",
    koperasi as  "PPLP1Koperasi",
    gcpgenset as  "GCPGenset",
    sdpgenset as  "SDPGenset",
    chiller1 as  "PPChiller1",
    chiller2 as  "PPChiller2",
    chiller3 as  "PPChiller3",
    ac31rnd as "PP2AC31RND",
    pro31rnd as "LP2PRO31RND"
    from
      (SELECT sum(kwh1) as MVMDP from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl1,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_MVMDP_data\` as s2
		where s2.data_index < l1.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh1 
      from ems_saka.\`cMT-Gedung-UTY_MVMDP_data\` as l1 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}'AND data_format_0>0)  as table1
      where kwh1>0) as total1, 

      (SELECT sum(kwh2) as lvmdp1 from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl2,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_LVMDP1_data\` as s2
		where s2.data_index < l2.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh2
      from ems_saka.\`cMT-Gedung-UTY_LVMDP1_data\` as l2 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table2
      where kwh2>0) as total2, 

      (SELECT sum(kwh3) as lvmdp2 from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl3,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_LVMDP2_data\` as s2
		where s2.data_index < l3.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh3
      from ems_saka.\`cMT-Gedung-UTY_LVMDP2_data\` as l3 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table3
      where kwh3>0) as total3,

      (SELECT sum(kwh4) as SP16 from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl4,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_Inverter1-6_SP_data\` as s2
		where s2.data_index < l4.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh4
      from ems_saka.\`cMT-Gedung-UTY_Inverter1-6_SP_data\` as l4 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table4
      where kwh4>0) as total4, 
      
      (SELECT sum(kwh5) as SP712 from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl5,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_Inverter7-12_SP_data\` as s2
		where s2.data_index < l5.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh5
      from ems_saka.\`cMT-Gedung-UTY_Inverter7-12_SP_data\` as l5 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table5
      where kwh5>0) as total5, 

      (SELECT sum(kwh6) as utility from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl6,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_SDP.1-Utility_data\` as s2
		where s2.data_index < l6.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh6
      from ems_saka.\`cMT-Gedung-UTY_SDP.1-Utility_data\` as l6 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table6
      where kwh6>0) as total6, 

      (SELECT sum(kwh7) as utilitylt2 from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl7,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_PPLP.1-UTY_Lt.2_data\` as s2
		where s2.data_index < l7.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh7
      from ems_saka.\`cMT-Gedung-UTY_PPLP.1-UTY_Lt.2_data\` as l7 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table7
      where kwh7>0) as total7, 

      (SELECT sum(kwh8) as chiller from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl8,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_PP.1-Chiller_data\` as s2
		where s2.data_index < l8.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh8
      from ems_saka.\`cMT-Gedung-UTY_PP.1-Chiller_data\` as l8 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table8
      where kwh8>0) as total8, 

      (SELECT sum(kwh9) as utilitylt1 from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl9,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_PPLP.1-UTY_Lt.1_data\` as s2
		where s2.data_index < l9.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh9
      from ems_saka.\`cMT-Gedung-UTY_PPLP.1-UTY_Lt.1_data\` as l9 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table9
      where kwh9>0) as total9, 

      (SELECT sum(kwh10) as genset from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl10,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_PP.1-Genset_data\` as s2
		where s2.data_index < l10.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh10
      from ems_saka.\`cMT-Gedung-UTY_PP.1-Genset_data\` as l10 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table10
      where kwh10>0) as total10, 

      (SELECT sum(kwh11) as boilerPW from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl11,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_PP.1-Boiler&PW_data\` as s2
		where s2.data_index < l11.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh11
      from ems_saka.\`cMT-Gedung-UTY_PP.1-Boiler&PW_data\` as l11 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table11
      where kwh11>0) as total11, 

      (SELECT sum(kwh12) as kompressor from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl12,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_PP.1-Kompressor_data\` as s2
		where s2.data_index < l12.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh12
      from ems_saka.\`cMT-Gedung-UTY_PP.1-Kompressor_data\` as l12 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table12
      where kwh12>0) as total12, 

      (SELECT sum(kwh13) as HWP from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl13,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_PP.1-HWP_data\` as s2
		where s2.data_index < l13.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh13
      from ems_saka.\`cMT-Gedung-UTY_PP.1-HWP_data\` as l13 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table13
      where kwh13>0) as total13, 

      (SELECT sum(kwh14) as pump from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl14,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_PP.1-PUMPS_data\` as s2
		where s2.data_index < l14.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh14
      from ems_saka.\`cMT-Gedung-UTY_PP.1-PUMPS_data\` as l14 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table14
      where kwh14>0) as total14, 

      (SELECT sum(kwh15) as lift from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl15,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_PP.1-Lift_data\` as s2
		where s2.data_index < l15.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh15
      from ems_saka.\`cMT-Gedung-UTY_PP.1-Lift_data\` as l15 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table15
      where kwh15>0) as total15, 

      (SELECT sum(kwh16) as ac11 from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl16,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_PP.1-AC1.1_data\` as s2
		where s2.data_index < l16.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh16
      from ems_saka.\`cMT-Gedung-UTY_PP.1-AC1.1_data\` as l16 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table16
      where kwh16>0) as total16, 

      (SELECT sum(kwh17) as ac12 from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl17,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_PP.1-AC1.2_data\` as s2
		where s2.data_index < l17.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh17
      from ems_saka.\`cMT-Gedung-UTY_PP.1-AC1.2_data\` as l17 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table17
      where kwh17>0) as total17, 

      (SELECT sum(kwh18) as ac13 from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl18,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_PP.1-AC1.3_data\` as s2
		where s2.data_index < l18.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh18
      from ems_saka.\`cMT-Gedung-UTY_PP.1-AC1.3_data\` as l18 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table18
      where kwh18>0) as total18, 

      (SELECT sum(kwh19) as ac23 from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl19,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_PP.1-AC2.3_data\` as s2
		where s2.data_index < l19.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh19
      from ems_saka.\`cMT-Gedung-UTY_PP.1-AC2.3_data\` as l19 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table19
      where kwh19>0) as total19, 

      (SELECT sum(kwh20) as produksi1 from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl20,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_SDP.1-Produksi_data\` as s2
		where s2.data_index < l20.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh20
      from ems_saka.\`cMT-Gedung-UTY_SDP.1-Produksi_data\` as l20 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table20
      where kwh20>0) as total20, 

      (SELECT sum(kwh21) as produksi2 from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl21,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_SDP.2-Produksi_data\` as s2
		where s2.data_index < l21.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh21
      from ems_saka.\`cMT-Gedung-UTY_SDP.2-Produksi_data\` as l21 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table21
      where kwh21>0) as total21, 

      (SELECT sum(kwh22) as hydrant from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl22,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_PP.2-Hydrant_data\` as s2
		where s2.data_index < l22.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh22
      from ems_saka.\`cMT-Gedung-UTY_PP.2-Hydrant_data\` as l22 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table22
      where kwh22>0) as total22, 

      (SELECT sum(kwh23) as fatigon from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl23,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_PP.2-Fatigon_data\` as s2
		where s2.data_index < l23.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh23
      from ems_saka.\`cMT-Gedung-UTY_PP.2-Fatigon_data\` as l23 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table23
      where kwh23>0) as total23, 

      (SELECT sum(kwh24) as puyer from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl24,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_PP.2-Puyer_data\` as s2
		where s2.data_index < l24.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh24
      from ems_saka.\`cMT-Gedung-UTY_PP.2-Puyer_data\` as l24 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table24
      where kwh24>0) as total24, 

      (SELECT sum(kwh25) as mixagrib from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl25,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_PP.2-Mixagrib_data\` as s2
		where s2.data_index < l25.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh25
      from ems_saka.\`cMT-Gedung-UTY_PP.2-Mixagrib_data\` as l25 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table25
      where kwh25>0) as total25, 

      (SELECT sum(kwh26) as lablt2 from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl26,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_PP.2-LabLt.2_data\` as s2
		where s2.data_index < l26.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh26
      from ems_saka.\`cMT-Gedung-UTY_PP.2-LabLt.2_data\` as l26 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table26
      where kwh26>0) as total26, 

      (SELECT sum(kwh27) as fasilitas from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl27,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_PP.2-Fasilitas_data\` as s2
		where s2.data_index < l27.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh27
      from ems_saka.\`cMT-Gedung-UTY_PP.2-Fasilitas_data\` as l27 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table27
      where kwh27>0) as total27, 

      (SELECT sum(kwh28) as packwh from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl28,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_PP.2-PackWH_data\` as s2
		where s2.data_index < l28.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh28
      from ems_saka.\`cMT-Gedung-UTY_PP.2-PackWH_data\` as l28 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table28
      where kwh28>0) as total28, 

      (SELECT sum(kwh29) as pro11 from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl29,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_LP.2-PRO1.1_data\` as s2
		where s2.data_index < l29.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh29
      from ems_saka.\`cMT-Gedung-UTY_LP.2-PRO1.1_data\` as l29 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table29
      where kwh29>0) as total29, 

      (SELECT sum(kwh30) as pro12 from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl30,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_LP.2-PRO1.2_data\` as s2
		where s2.data_index < l30.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh30
      from ems_saka.\`cMT-Gedung-UTY_LP.2-PRO1.2_data\` as l30 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table30
      where kwh30>0) as total30, 

      (SELECT sum(kwh31) as pro13 from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl31,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_LP.2-PRO1.3_data\` as s2
		where s2.data_index < l31.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh31
      from ems_saka.\`cMT-Gedung-UTY_LP.2-PRO1.3_data\` as l31 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table31
      where kwh31>0) as total31, 

      (SELECT sum(kwh32) as pro23 from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl32,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_LP.2-PRO2.3_data\` as s2
		where s2.data_index < l32.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh32
      from ems_saka.\`cMT-Gedung-UTY_LP.2-PRO2.3_data\` as l32 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table32
      where kwh32>0) as total32, 

      (SELECT sum(kwh33) as pro31 from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl33,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_LP.2-PRO3.1_data\` as s2
		where s2.data_index < l33.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh33
      from ems_saka.\`cMT-Gedung-UTY_LP.2-PRO3.1_data\` as l33 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table33
      where kwh33>0) as total33, 

      (SELECT sum(kwh34) as pro41 from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl34,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_LP.2-PRO4.1_data\` as s2
		where s2.data_index < l34.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh34
      from ems_saka.\`cMT-Gedung-UTY_LP.2-PRO4.1_data\` as l34 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table34
      where kwh34>0) as total34, 

      (SELECT sum(kwh35) as wh11 from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl35,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_LP.2WH1.1_data\` as s2
		where s2.data_index < l35.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh35
      from ems_saka.\`cMT-Gedung-UTY_LP.2WH1.1_data\` as l35 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table35
      where kwh35>0) as total35, 

      (SELECT sum(kwh36) as mezz11 from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl36,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_LP.2MEZZ1.1_data\` as s2
		where s2.data_index < l36.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh36
      from ems_saka.\`cMT-Gedung-UTY_LP.2MEZZ1.1_data\` as l36 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table36
      where kwh36>0) as total36, 

      (SELECT sum(kwh37) as posjaga1 from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl37,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_PPLP.2-PosJaga1_data\` as s2
		where s2.data_index < l37.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh37
      from ems_saka.\`cMT-Gedung-UTY_PPLP.2-PosJaga1_data\` as l37 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table37
      where kwh37>0) as total37, 

      (SELECT sum(kwh38) as PosJaga2 from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl38,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_PPLP.2-PosJaga2_data\` as s2
		where s2.data_index < l38.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh38
      from ems_saka.\`cMT-Gedung-UTY_PPLP.2-PosJaga2_data\` as l38 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table38
      where kwh38>0) as total38, 

      (SELECT sum(kwh40) as koperasi from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl40,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_PPLP.2-Koperasi_data\` as s2
		where s2.data_index < l40.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh40
      from ems_saka.\`cMT-Gedung-UTY_PPLP.2-Koperasi_data\` as l40 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table40
      where kwh40>0) as total40, 

      (SELECT sum(kwh41) as gcpgenset from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl41,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_GCP_Genset_data\` as s2
		where s2.data_index < l41.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh41
      from ems_saka.\`cMT-Gedung-UTY_GCP_Genset_data\` as l41 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table41
      where kwh41>0) as total41, 

      (SELECT sum(kwh42) as sdpgenset from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl42,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_SDP_Genset_data\` as s2
		where s2.data_index < l42.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh42
      from ems_saka.\`cMT-Gedung-UTY_SDP_Genset_data\` as l42 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table42
      where kwh42>0) as total42, 

      (SELECT sum(kwh47) as chiller1 from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl47,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_Chiller1_data\` as s2
		where s2.data_index < l47.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh47
      from ems_saka.\`cMT-Gedung-UTY_Chiller1_data\` as l47 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table47
      where kwh47>0) as total47, 

      (SELECT sum(kwh48) as chiller2 from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl48,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_Chiller2_data\` as s2
		where s2.data_index < l48.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh48
      from ems_saka.\`cMT-Gedung-UTY_Chiller2_data\` as l48 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table48
      where kwh48>0) as total48, 

      (SELECT sum(kwh49) as chiller3 from (SELECT
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl49,
      data_format_0-(select s2.data_format_0 as previous from
		ems_saka.\`cMT-Gedung-UTY_Chiller3_data\` as s2
		where s2.data_index < l49.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh49
      from ems_saka.\`cMT-Gedung-UTY_Chiller3_data\` as l49 WHERE
      date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table49
      where kwh49>0) as total49,

      (SELECT sum(kwh50) as ac31rnd from (SELECT
        DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl50,
        data_format_0-(select s2.data_format_0 as previous from
      ems_saka.\`cMT-Gedung-UTY_PP.2-AC 3.1 RND_data\` as s2
      where s2.data_index < l50.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh50
        from ems_saka.\`cMT-Gedung-UTY_PP.2-AC 3.1 RND_data\` as l50 WHERE
        date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}' AND data_format_0>0)  as table50
        where kwh50>0) as total50,

        (SELECT sum(kwh51) as pro31rnd from (SELECT
          DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) , '%Y-%m-%d') AS tgl51,
          data_format_0-(select s2.data_format_0 as previous from
        ems_saka.\`cMT-Gedung-UTY_LP.2-PRO 3.1 RND_data\` as s2
        where s2.data_index < l51.data_index and s2.data_format_0 order by s2.data_index  desc limit 1) as kwh51
          from ems_saka.\`cMT-Gedung-UTY_LP.2-PRO 3.1 RND_data\` as l51 WHERE
          date(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '2024-06-01' AND '2024-06-05' AND data_format_0>0)  as table51
          where kwh51>0) as total51
    `;

    db4.query(queryGet, (err, result) => {
      return response.status(200).send(result);
    });
  },
  // Purified Water Backend
  PurifiedWater: async (request, response) => {
    const { area, start, finish } = request.query;
    const queryGet = `SELECT
        DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`)+ INTERVAL 4  HOUR, '%Y-%m-%d %H:%i') AS label,
        data_index AS x,
        round(data_format_0,2) AS y
        FROM \`${area}\`
        WHERE
          DATE(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}'
        ORDER BY
        \`time@timestamp\``;

    db.query(queryGet, (err, result) => {
      return response.status(200).send(result);
    });
  },

  // Chiller Chart Backend
  ChillerGraph: async (request, response) => {
    const { area, start, finish, chiller, komp } = request.query;

    const areaFormatted = area.replace(/[-.]/g, "_");

    const queryGet = `
            SELECT
                DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) - INTERVAL 6 HOUR, '%Y-%m-%d %H:%i') AS label,
                \`time@timestamp\` * 1000 AS x,
                data_format_0 AS y
            FROM
                \`newdb\`.\`${areaFormatted}${komp}${chiller}_data\`
            WHERE
                DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) - INTERVAL 6 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'

            UNION ALL

            SELECT
                DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) - INTERVAL 6 HOUR, '%Y-%m-%d %H:%i') AS label,
                \`time@timestamp\` * 1000 AS x,
                data_format_0 AS y
            FROM
                \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_${area}${komp}${chiller}_data\`
            WHERE
                DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) - INTERVAL 6 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'

            ORDER BY
                x;
        `;

    //console.log(queryGet);
    db3.query(queryGet, (err, result) => {
      if (err) {
        return response.status(500).send(err);
      }
      return response.status(200).send(result);
    });
  },

  // Chiller Status Backend
  ChillerStatus: async (request, response) => {
    const { start, finish, chiller, komp } = request.query;
    
    const queryGet = `
    SELECT * FROM (
      SELECT
        DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`)- INTERVAL 6 HOUR, '%Y-%m-%d %H:%i:%s') AS time,
        CASE WHEN a.data_format_0 = 0 THEN "OFF" WHEN a.data_format_0 = 1 THEN "ON" END AS Alarm_Chiller,
        CASE WHEN a1.data_format_0 = 0 THEN "OFF" WHEN a1.data_format_0 = 1 THEN "ON" END AS Status_Chiller,
        CASE WHEN f.data_format_0 = 0 THEN "OFF" WHEN f.data_format_0 = 1 THEN "ON" END AS Fan_Kondensor,
        CASE WHEN d.data_format_0 = 0 THEN "OFF" WHEN d.data_format_0 = 1 THEN "ON" END AS Status_Kompresor
        
      FROM
        \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-AlarmCH${chiller}_data\` AS a
      LEFT JOIN
        \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-StatusCH${chiller}_data\` AS a1
        ON DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a1.\`time@timestamp\`), '%Y-%m-%d %H:%i')
      LEFT JOIN
        \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-StatFanKondCH${chiller}_data\` AS f
        ON DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(f.\`time@timestamp\`), '%Y-%m-%d %H:%i')
      LEFT JOIN
        \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-Status${komp}${chiller}_data\` AS d
        ON DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d %H:%i')
      WHERE 
        DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`)- INTERVAL 6 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
  
      UNION ALL
  
      SELECT
        DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`)- INTERVAL 6 HOUR, '%Y-%m-%d %H:%i:%s') AS time,
        CASE WHEN a.data_format_0 = 0 THEN "OFF" WHEN a.data_format_0 = 1 THEN "ON" END AS Alarm_Chiller,
        CASE WHEN a1.data_format_0 = 0 THEN "OFF" WHEN a1.data_format_0 = 1 THEN "ON" END AS Status_Chiller,
        CASE WHEN f.data_format_0 = 0 THEN "OFF" WHEN f.data_format_0 = 1 THEN "ON" END AS Fan_Kondensor,
        CASE WHEN d.data_format_0 = 0 THEN "OFF" WHEN d.data_format_0 = 1 THEN "ON" END AS Status_Kompresor
        
      FROM
        \`newdb\`.\`R_AlarmCH${chiller}_data\` AS a
      LEFT JOIN
        \`newdb\`.\`R_StatusCH${chiller}_data\` AS a1
        ON DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a1.\`time@timestamp\`), '%Y-%m-%d %H:%i')
      LEFT JOIN
        \`newdb\`.\`H_StatFanKondCH${chiller}_data\` AS f
        ON DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(f.\`time@timestamp\`), '%Y-%m-%d %H:%i')
      LEFT JOIN
        \`newdb\`.\`R_Status${komp}${chiller}_data\` AS d
        ON DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(d.\`time@timestamp\`), '%Y-%m-%d %H:%i')
      WHERE 
        DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`)- INTERVAL 6 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
    ) AS combined
    ORDER BY time;
    `;

    //console.log(queryGet);
    db3.query(queryGet, (err, result) => {
      if (err) {
        console.error(err);
        return response.status(500).send({ error: "Database query error" });
      }
      return response.status(200).send(result);
    });
  },

  // Chiller Status Backend
  ChillerKondisi: async (request, response) => {
    const { start, finish, chiller, komp, oliats } = request.query;

    const queryGet = `
      SELECT * FROM (
        SELECT
          DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d %H:%i:%s') AS time,
          CASE WHEN b.data_format_0 = 0 THEN "Kotor" WHEN b.data_format_0 = 1 THEN "Bersih" END AS Bodi_Chiller,
          CASE WHEN c.data_format_0 = 0 THEN "Kotor" WHEN c.data_format_0 = 1 THEN "Bersih" END AS KisiKisi_Kondensor,
          CASE
            WHEN y.data_format_0 = 4 THEN "0%"
            WHEN y.data_format_0 = 0 THEN "25%"
            WHEN y.data_format_0 = 1 THEN "50%"
            WHEN y.data_format_0 = 2 THEN "75%"
            WHEN y.data_format_0 = 3 THEN "100%"
          END AS Lvl_Oil_Sight_Glass_Atas,
          CASE
            WHEN z.data_format_0 = 4 THEN "0%"
            WHEN z.data_format_0 = 0 THEN "25%"
            WHEN z.data_format_0 = 1 THEN "50%"
            WHEN z.data_format_0 = 2 THEN "75%"
            WHEN z.data_format_0 = 3 THEN "100%"
          END AS Lvl_Oil_Sight_Glass_Bawah,
          CASE
            WHEN aa.data_format_0 = 0 THEN "Clear"
            WHEN aa.data_format_0 = 1 THEN "Buble"
          END AS Jalur_Sight_Glass_EXP_Valve
        FROM
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-AlarmCH${chiller}_data\` AS a
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_H-BodiChillerCH${chiller}_data\` AS b
          ON DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(b.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_H-KisiKondenCH${chiller}_data\` AS c
          ON DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(c.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_H-${oliats}Ats${komp}${chiller}_data\` AS y
          ON DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(y.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_H-OliGlsBwh${komp}${chiller}_data\` AS z
          ON DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(z.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_H-GlsExpVlv${komp}${chiller}_data\` AS aa
          ON DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(aa.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        WHERE 
          DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
  
        UNION ALL
  
        SELECT
          DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d %H:%i:%s') AS time,
          CASE WHEN b.data_format_0 = 0 THEN "Kotor" WHEN b.data_format_0 = 1 THEN "Bersih" END AS Bodi_Chiller,
          CASE WHEN c.data_format_0 = 0 THEN "Kotor" WHEN c.data_format_0 = 1 THEN "Bersih" END AS KisiKisi_Kondensor,
          CASE
            WHEN y.data_format_0 = 4 THEN "0%"
            WHEN y.data_format_0 = 0 THEN "25%"
            WHEN y.data_format_0 = 1 THEN "50%"
            WHEN y.data_format_0 = 2 THEN "75%"
            WHEN y.data_format_0 = 3 THEN "100%"
          END AS Lvl_Oil_Sight_Glass_Atas,
          CASE
            WHEN z.data_format_0 = 4 THEN "0%"
            WHEN z.data_format_0 = 0 THEN "25%"
            WHEN z.data_format_0 = 1 THEN "50%"
            WHEN z.data_format_0 = 2 THEN "75%"
            WHEN z.data_format_0 = 3 THEN "100%"
          END AS Lvl_Oil_Sight_Glass_Bawah,
          CASE
            WHEN aa.data_format_0 = 0 THEN "Clear"
            WHEN aa.data_format_0 = 1 THEN "Buble"
          END AS Jalur_Sight_Glass_EXP_Valve
        FROM
          newdb.\`R_AlarmCH${chiller}_data\` AS a
        LEFT JOIN
          newdb.\`H_BodiChillerCH${chiller}_data\` AS b
          ON DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(b.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`H_KisiKondenCH${chiller}_data\` AS c
          ON DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(c.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`H_${oliats}Ats${komp}${chiller}_data\` AS y
          ON DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(y.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`H_OliGlsBwh${komp}${chiller}_data\` AS z
          ON DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(z.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`H_GlsExpVlv${komp}${chiller}_data\` AS aa
          ON DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(aa.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        WHERE 
          DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
      ) AS combined
      ORDER BY time;
    `;

    //console.log(queryGet);
    db3.query(queryGet, (err, result) => {
      if (err) {
        console.error(err);
        return response.status(500).send({ error: "Database query error" });
      }
      return response.status(200).send(result);
    });
  },

  // Chiller Nama Backend
  ChillerNama: async (request, response) => {
    const { start, finish, chiller } = request.query;

    const queryGet = `
      SELECT * FROM (
        SELECT
          DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d %H:%i:%s') AS time,
          CASE
            WHEN s.data_format_0 = 0 THEN "Andi"
            WHEN s.data_format_0 = 1 THEN "Toni"
            WHEN s.data_format_0 = 2 THEN "Nur Quraisin"
            WHEN s.data_format_0 = 3 THEN "Jimmy"
          END AS Operator,
          CASE
            WHEN b13.data_format_0 = 0 THEN "Nur Ngaeni"
            WHEN b13.data_format_0 = 1 THEN "Syahrul"
            WHEN b13.data_format_0 = 2 THEN "Yudi"
          END AS Engineer,
          CASE
            WHEN b14.data_format_0 = 0 THEN "Ujang"
            WHEN b14.data_format_0 = 1 THEN "Natan"
          END AS Utility_SPV
        FROM
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-AlarmCH${chiller}_data\` AS a
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_H-NamaOperCH${chiller}_data\` AS s
          ON DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_H-NamaTekCH${chiller}_data\` AS b13
          ON DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(b13.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_H-NamaSpvCH${chiller}_data\` AS b14
          ON DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(b14.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        WHERE 
          DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
  
        UNION ALL
  
        SELECT
          DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d %H:%i:%s') AS time,
          CASE
            WHEN s.data_format_0 = 0 THEN "Andi"
            WHEN s.data_format_0 = 1 THEN "Toni"
            WHEN s.data_format_0 = 2 THEN "Nur Quraisin"
            WHEN s.data_format_0 = 3 THEN "Jimmy"
          END AS Operator,
          CASE
            WHEN b13.data_format_0 = 0 THEN "Nur Ngaeni"
            WHEN b13.data_format_0 = 1 THEN "Syahrul"
            WHEN b13.data_format_0 = 2 THEN "Yudi"
          END AS Engineer,
          CASE
            WHEN b14.data_format_0 = 0 THEN "Ujang"
            WHEN b14.data_format_0 = 1 THEN "Natan"
          END AS Utility_SPV
        FROM
          newdb.\`R_AlarmCH${chiller}_data\` AS a
        LEFT JOIN
          newdb.\`H_NamaOperCH${chiller}_data\` AS s
          ON DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`H_NamaTekCH${chiller}_data\` AS b13
          ON DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(b13.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`H_NamaSpvCH${chiller}_data\` AS b14
          ON DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(b14.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        WHERE 
          DATE_FORMAT(FROM_UNIXTIME(a.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
      ) AS combined
      ORDER BY time;
    `;

    //console.log(queryGet);
    db3.query(queryGet, (err, result) => {
      if (err) {
        console.error(err);
        return response.status(500).send({ error: "Database query error" });
      }
      return response.status(200).send(result);
    });
  },

  // Chiller Data 1 Backend
  ChillerData1: async (request, response) => {
    const { start, finish, chiller } = request.query;

    const queryGet = `
      SELECT * FROM (
        SELECT
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d %H:%i:%s') AS time,
          a1.data_format_0 AS "Active_Setpoint",
          a2.data_format_0 AS "Evap_LWT",
          a3.data_format_0 AS "Evap_EWT",
          a4.data_format_0 AS "Unit_Capacity_Full",
          a5.data_format_0 AS "Outdoor_Temperature"
        FROM
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-AlarmCH${chiller}_data\` AS s
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-ActiSetpoiCH${chiller}_data\` AS a1
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a1.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-EvapLWTCH${chiller}_data\` AS a2
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a2.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-EvapEWTCH${chiller}_data\` AS a3
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a3.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-UnitCapCH${chiller}_data\` AS a4
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a4.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-OutTempCH${chiller}_data\` AS a5
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a5.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        WHERE 
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
  
        UNION ALL
  
        SELECT
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d %H:%i:%s') AS time,
          a1.data_format_0 AS "Active_Setpoint",
          a2.data_format_0 AS "Evap_LWT",
          a3.data_format_0 AS "Evap_EWT",
          a4.data_format_0 AS "Unit_Capacity_Full",
          a5.data_format_0 AS "Outdoor_Temperature"
        FROM
          newdb.\`R_AlarmCH${chiller}_data\` AS s
        LEFT JOIN
          newdb.\`R_ActiSetpoiCH${chiller}_data\` AS a1
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a1.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`R_EvapLWTCH${chiller}_data\` AS a2
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a2.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`R_EvapEWTCH${chiller}_data\` AS a3
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a3.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`R_UnitCapCH${chiller}_data\` AS a4
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a4.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`R_OutTempCH${chiller}_data\` AS a5
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a5.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        WHERE 
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
      ) AS combined
      ORDER BY time;
    `;

    db3.query(queryGet, (err, result) => {
      if (err) {
        console.error(err);
        return response.status(500).send({ error: "Database query error" });
      }
      return response.status(200).send(result);
    });
  },

  // Chiller Data 2 Backend
  ChillerData2: async (request, response) => {
    const { start, finish, chiller, komp } = request.query;

    const queryGet = `
      SELECT * FROM (
        SELECT
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d %H:%i:%s') AS time,
          a1.data_format_0 AS "Unit_Capacity_Kompresor",
          a2.data_format_0 AS "Evap_Pressure_Kompresor",
          a3.data_format_0 AS "Cond_Pressure_Kompresor",
          a4.data_format_0 AS "Evap_Sat_Temperature_Kompresor",
          a5.data_format_0 AS "Cond_Sat_Temperature_Kompresor"
        FROM
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-AlarmCH${chiller}_data\` AS s
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-Capacity${komp}${chiller}_data\` AS a1
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a1.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-EvapPress${komp}${chiller}_data\` AS a2
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a2.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-CondPress${komp}${chiller}_data\` AS a3
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a3.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-EvapSatTe${komp}${chiller}_data\` AS a4
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a4.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-ConSatTem${komp}${chiller}_data\` AS a5
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a5.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        WHERE 
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
  
        UNION ALL
  
        SELECT
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d %H:%i:%s') AS time,
          a1.data_format_0 AS "Unit_Capacity_Kompresor",
          a2.data_format_0 AS "Evap_Pressure_Kompresor",
          a3.data_format_0 AS "Cond_Pressure_Kompresor",
          a4.data_format_0 AS "Evap_Sat_Temperature_Kompresor",
          a5.data_format_0 AS "Cond_Sat_Temperature_Kompresor"
        FROM
          newdb.\`R_AlarmCH${chiller}_data\` AS s
        LEFT JOIN
          newdb.\`R_Capacity${komp}${chiller}_data\` AS a1
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a1.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`R_EvapPress${komp}${chiller}_data\` AS a2
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a2.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`R_CondPress${komp}${chiller}_data\` AS a3
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a3.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`R_EvapSatTe${komp}${chiller}_data\` AS a4
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a4.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`R_ConSatTem${komp}${chiller}_data\` AS a5
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a5.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        WHERE 
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
      ) AS combined
      ORDER BY time;
    `;

    db3.query(queryGet, (err, result) => {
      if (err) {
        console.error(err);
        return response.status(500).send({ error: "Database query error" });
      }
      return response.status(200).send(result);
    });
  },

  // Chiller Data 3 Backend
  ChillerData3: async (request, response) => {
    const { start, finish, chiller, komp } = request.query;

    const queryGet = `
      SELECT * FROM (
        SELECT
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d %H:%i:%s') AS time,
          a1.data_format_0 AS "Suction_Temperature_Kompresor",
          a2.data_format_0 AS "Discharge_Temperature_Kompresor",
          a3.data_format_0 AS "Suction_SH_Kompresor",
          a4.data_format_0 AS "Discharge_SH_Kompresor"
        FROM
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-AlarmCH${chiller}_data\` AS s
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-SuctiTemp${komp}${chiller}_data\` AS a1
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a1.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-DischTemp${komp}${chiller}_data\` AS a2
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a2.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-SuctionSH${komp}${chiller}_data\` AS a3
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a3.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-DischarSH${komp}${chiller}_data\` AS a4
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a4.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        WHERE 
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
  
        UNION ALL
  
        SELECT
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d %H:%i:%s') AS time,
          a1.data_format_0 AS "Suction_Temperature_Kompresor",
          a2.data_format_0 AS "Discharge_Temperature_Kompresor",
          a3.data_format_0 AS "Suction_SH_Kompresor",
          a4.data_format_0 AS "Discharge_SH_Kompresor"
        FROM
          newdb.\`R_AlarmCH${chiller}_data\` AS s
        LEFT JOIN
          newdb.\`R_SuctiTemp${komp}${chiller}_data\` AS a1
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a1.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`R_DischTemp${komp}${chiller}_data\` AS a2
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a2.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`R_SuctionSH${komp}${chiller}_data\` AS a3
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a3.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`R_DischarSH${komp}${chiller}_data\` AS a4
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a4.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        WHERE 
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
      ) AS combined
      ORDER BY time;
    `;

    db3.query(queryGet, (err, result) => {
      if (err) {
        console.error(err);
        return response.status(500).send({ error: "Database query error" });
      }
      return response.status(200).send(result);
    });
  },

  // Chiller Data 4 Backend
  ChillerData4: async (request, response) => {
    const { start, finish, chiller, komp } = request.query;

    const queryGet = `
      SELECT * FROM (
        SELECT
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d %H:%i:%s') AS time,
          a1.data_format_0 AS "Evap_Approach_Kompresor",
          a2.data_format_0 AS "Evap_Design_Approach_Kompresor",
          a3.data_format_0 AS "Cond_Approach_Kompresor",
          a4.data_format_0 AS "Oil_Pressure_Kompresor",
          a5.data_format_0 AS "Oil_Pressure_Differential_Kompresor"
        FROM
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-AlarmCH${chiller}_data\` AS s
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-EvapAppro${komp}${chiller}_data\` AS a1
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a1.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-EvaDsgApp${komp}${chiller}_data\` AS a2
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a2.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-CondAppro${komp}${chiller}_data\` AS a3
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a3.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-OilPress${komp}${chiller}_data\` AS a4
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a4.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-OilPresDf${komp}${chiller}_data\` AS a5
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a5.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        WHERE 
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
  
        UNION ALL
  
        SELECT
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d %H:%i:%s') AS time,
          a1.data_format_0 AS "Evap_Approach_Kompresor",
          a2.data_format_0 AS "Evap_Design_Approach_Kompresor",
          a3.data_format_0 AS "Cond_Approach_Kompresor",
          a4.data_format_0 AS "Oil_Pressure_Kompresor",
          a5.data_format_0 AS "Oil_Pressure_Differential_Kompresor"
        FROM
          newdb.\`R_AlarmCH${chiller}_data\` AS s
        LEFT JOIN
          newdb.\`R_EvapAppro${komp}${chiller}_data\` AS a1
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a1.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`R_EvaDsgApp${komp}${chiller}_data\` AS a2
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a2.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`R_CondAppro${komp}${chiller}_data\` AS a3
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a3.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`R_OilPress${komp}${chiller}_data\` AS a4
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a4.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`R_OilPresDf${komp}${chiller}_data\` AS a5
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a5.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        WHERE 
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
      ) AS combined
      ORDER BY time;
    `;

    db3.query(queryGet, (err, result) => {
      if (err) {
        console.error(err);
        return response.status(500).send({ error: "Database query error" });
      }
      return response.status(200).send(result);
    });
  },

  // Chiller Data 5 Backend
  ChillerData5: async (request, response) => {
    const { start, finish, chiller, komp, fan } = request.query;

    const queryGet = `
      SELECT * FROM (
        SELECT
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d %H:%i:%s') AS time,
          a1.data_format_0 AS "EXV_Position_Kompresor",
          a2.data_format_0 AS "Run_Hour_Kompressor",
          a3.data_format_0 AS "Ampere_Kompressor",
          a4.data_format_0 AS "No_Of_Start_Kompresor",
          a5.data_format_0 AS "Total_Fan_ON_Kompresor"
        FROM
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-AlarmCH${chiller}_data\` AS s
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-EXVPositi${komp}2_data\` AS a1
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a1.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-RunHour${komp}${chiller}_data\` AS a2
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a2.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-Ampere${komp}${chiller}_data\` AS a3
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a3.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-No.Start${komp}${chiller}_data\` AS a4
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a4.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_H-FanOut${fan}${komp}${chiller}_data\` AS a5
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a5.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        WHERE 
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
  
        UNION ALL
  
        SELECT
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d %H:%i:%s') AS time,
          a1.data_format_0 AS "EXV_Position_Kompresor",
          a2.data_format_0 AS "Run_Hour_Kompressor",
          a3.data_format_0 AS "Ampere_Kompressor",
          a4.data_format_0 AS "No_Of_Start_Kompresor",
          a5.data_format_0 AS "Total_Fan_ON_Kompresor"
        FROM
          newdb.\`R_AlarmCH${chiller}_data\` AS s
        LEFT JOIN
          newdb.\`R_EXVPositi${komp}2_data\` AS a1
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a1.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`R_RunHour${komp}${chiller}_data\` AS a2
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a2.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`R_Ampere${komp}${chiller}_data\` AS a3
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a3.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`R_No_Start${komp}${chiller}_data\` AS a4
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a4.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`H_FanOut${fan}${komp}${chiller}_data\` AS a5
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a5.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        WHERE 
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
      ) AS combined
      ORDER BY time;
    `;

    //console.log(queryGet);
    db3.query(queryGet, (err, result) => {
      if (err) {
        console.error(err);
        return response.status(500).send({ error: "Database query error" });
      }
      return response.status(200).send(result);
    });
  },

  // Chiller Data 6 Backend
  ChillerData6: async (request, response) => {
    const { start, finish, chiller, komp } = request.query;

    const queryGet = `
      SELECT * FROM (
        SELECT
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d %H:%i:%s') AS time,
          a1.data_format_0 AS "Tekanan_Return_Chiller",
          round(a2.data_format_0, 2) AS "Tekanan_Supply_Chiller",
          round(a3.data_format_0, 2) AS "Inlet_Softwater",
          a4.data_format_0 AS "Pompa_CHWS_1",
          round(a5.data_format_0, 2) AS "Suhu_sebelum_Pompa_Supply"
        FROM
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-AlarmCH${chiller}_data\` AS s
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_H-TknReturnCH${chiller}_data\` AS a1
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a1.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_H-TknSupplyCH${chiller}_data\` AS a2
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a2.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_H-InletSoftCH${chiller}_data\` AS a3
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a3.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_O-StatONPS${chiller}_data\` AS a4
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a4.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_H-ShuSebPmSupCH${chiller}_data\` AS a5
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a5.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        WHERE 
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
  
        UNION ALL
  
        SELECT
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d %H:%i:%s') AS time,
          a1.data_format_0 AS "Tekanan_Return_Chiller",
          round(a2.data_format_0, 2) AS "Tekanan_Supply_Chiller",
          round(a3.data_format_0, 2) AS "Inlet_Softwater",
          a4.data_format_0 AS "Pompa_CHWS_1",
          round(a5.data_format_0, 2) AS "Suhu_sebelum_Pompa_Supply"
        FROM
          newdb.\`R_AlarmCH${chiller}_data\` AS s
        LEFT JOIN
          newdb.\`H_TknReturnCH${chiller}_data\` AS a1
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a1.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`H_TknSupplyCH${chiller}_data\` AS a2
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a2.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`H_InletSoftCH${chiller}_data\` AS a3
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a3.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`O_StatONPS${chiller}_data\` AS a4
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a4.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`H_ShuSebPmSupCH${chiller}_data\` AS a5
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a5.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        WHERE 
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
      ) AS combined
      ORDER BY time;
    `;

    //console.log(queryGet);
    db3.query(queryGet, (err, result) => {
      if (err) {
        console.error(err);
        return response.status(500).send({ error: "Database query error" });
      }
      return response.status(200).send(result);
    });
  },

  // Chiller Data 7 Backend
  ChillerData7: async (request, response) => {
    const { start, finish, chiller, komp } = request.query;

    const queryGet = `
      SELECT * FROM (
        SELECT
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d %H:%i:%s') AS time,
          round(a1.data_format_0, 2) AS "Suhu_sesudah_Pompa_Supply",
          round(a2.data_format_0, 2) AS "Tekanan_Sebelum_Pompa_Supply",
          round(a3.data_format_0, 2) AS "Tekanan_Sesudah_Pompa_Supply",
          round(a4.data_format_0, 2) AS "Pompa_CHWR_1",
          round(a5.data_format_0, 2) AS "Suhu_sebelum_Pompa_Return"
        FROM
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-AlarmCH${chiller}_data\` AS s
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_H-ShuSesPmSupCH${chiller}_data\` AS a1
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a1.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_H-PreSebPmSupCH${chiller}_data\` AS a2
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a2.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_H-PreSesPomSpCH${chiller}_data\` AS a3
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a3.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_O-StatONPR${chiller}_data\` AS a4
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a4.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_H-SuhSbPomRetCH${chiller}_data\` AS a5
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a5.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        WHERE 
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
  
        UNION ALL
  
        SELECT
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d %H:%i:%s') AS time,
          round(a1.data_format_0, 2) AS "Suhu_sesudah_Pompa_Supply",
          round(a2.data_format_0, 2) AS "Tekanan_Sebelum_Pompa_Supply",
          round(a3.data_format_0, 2) AS "Tekanan_Sesudah_Pompa_Supply",
          round(a4.data_format_0, 2) AS "Pompa_CHWR_1",
          round(a5.data_format_0, 2) AS "Suhu_sebelum_Pompa_Return"
        FROM
          newdb.\`R_AlarmCH${chiller}_data\` AS s
        LEFT JOIN
          newdb.\`H_ShuSesPmSupCH${chiller}_data\` AS a1
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a1.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`H_PreSebPmSupCH${chiller}_data\` AS a2
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a2.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`H_PreSesPomSpCH${chiller}_data\` AS a3
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a3.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`O_StatONPR${chiller}_data\` AS a4
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a4.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`H_SuhSbPomRetCH${chiller}_data\` AS a5
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a5.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        WHERE 
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
      ) AS combined
      ORDER BY time;
    `;

    //console.log(queryGet);
    db3.query(queryGet, (err, result) => {
      if (err) {
        console.error(err);
        return response.status(500).send({ error: "Database query error" });
      }
      return response.status(200).send(result);
    });
  },

  // Chiller Data 8 Backend
  ChillerData8: async (request, response) => {
    const { start, finish, chiller, komp } = request.query;

    const queryGet = `
      SELECT * FROM (
        SELECT
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d %H:%i:%s') AS time,
          round(a1.data_format_0, 2) AS "Suhu_sesudah_Pompa_Return",
          round(a2.data_format_0, 2) AS "Tekanan_Sebelum_Pompa_Return",
          round(a3.data_format_0, 2) AS "Tekanan_Sesudah_Pompa_Return",
          round(a4.data_format_0, 2) AS "Tegangan_RS",
          round(a5.data_format_0, 2) AS "Tegangan_ST"
        FROM
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-AlarmCH${chiller}_data\` AS s
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_H-SuhSesPmRetCH${chiller}_data\` AS a1
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a1.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_H-PreSebPomRtCH${chiller}_data\` AS a2
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a2.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_H-PrSesPomRetCH${chiller}_data\` AS a3
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a3.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_RP-TegR-SCH${chiller}_data\` AS a4
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a4.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_RP-TegS-TCH${chiller}_data\` AS a5
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a5.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        WHERE 
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
  
        UNION ALL
  
        SELECT
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d %H:%i:%s') AS time,
          round(a1.data_format_0, 2) AS "Suhu_sesudah_Pompa_Return",
          round(a2.data_format_0, 2) AS "Tekanan_Sebelum_Pompa_Return",
          round(a3.data_format_0, 2) AS "Tekanan_Sesudah_Pompa_Return",
          round(a4.data_format_0, 2) AS "Tegangan_RS",
          round(a5.data_format_0, 2) AS "Tegangan_ST"
        FROM
          newdb.\`R_AlarmCH${chiller}_data\` AS s
        LEFT JOIN
          newdb.\`H_SuhSesPmRetCH${chiller}_data\` AS a1
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a1.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`H_PreSebPomRtCH${chiller}_data\` AS a2
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a2.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`H_PrSesPomRetCH${chiller}_data\` AS a3
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a3.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`RP_TegR_SCH${chiller}_data\` AS a4
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a4.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`RP_TegS_TCH${chiller}_data\` AS a5
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a5.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        WHERE 
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
      ) AS combined
      ORDER BY time;
    `;

    //console.log(queryGet);
    db3.query(queryGet, (err, result) => {
      if (err) {
        console.error(err);
        return response.status(500).send({ error: "Database query error" });
      }
      return response.status(200).send(result);
    });
  },

  // Chiller Data 9 Backend
  ChillerData9: async (request, response) => {
    const { start, finish, chiller, komp } = request.query;

    const queryGet = `
      SELECT * FROM (
        SELECT
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d %H:%i:%s') AS time,
          round(a1.data_format_0, 2) AS "Tegangan_TR",
          round(a2.data_format_0, 2) AS "Ampere_RS",
          round(a3.data_format_0, 2) AS "Ampere_ST",
          round(a4.data_format_0, 2) AS "Ampere_TR",
          round(a5.data_format_0, 2) AS "Grounding_Ampere"
        FROM
          parammachine_saka.\`CMT-DB-Chiller-UTY3_R-AlarmCH${chiller}_data\` AS s
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_RP-TegT-RCH${chiller}_data\` AS a1
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a1.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_RP-AmpR-SCH${chiller}_data\` AS a2
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a2.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_RP-AmpS-TCH${chiller}_data\` AS a3
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a3.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_RP-AmpT-RCH${chiller}_data\` AS a4
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a4.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          parammachine_saka.\`CMT-DB-Chiller-UTY3_H-GroundAmperCH${chiller}_data\` AS a5
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a5.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        WHERE 
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
  
        UNION ALL
  
        SELECT
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d %H:%i:%s') AS time,
          round(a1.data_format_0, 2) AS "Tegangan_TR",
          round(a2.data_format_0, 2) AS "Ampere_RS",
          round(a3.data_format_0, 2) AS "Ampere_ST",
          round(a4.data_format_0, 2) AS "Ampere_TR",
          round(a5.data_format_0, 2) AS "Grounding_Ampere"
        FROM
          newdb.\`R_AlarmCH${chiller}_data\` AS s
        LEFT JOIN
          newdb.\`RP_TegT_RCH${chiller}_data\` AS a1
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a1.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`RP_AmpR_SCH${chiller}_data\` AS a2
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a2.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`RP_AmpS_TCH${chiller}_data\` AS a3
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a3.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`RP_AmpT_RCH${chiller}_data\` AS a4
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a4.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        LEFT JOIN
          newdb.\`H_GroundAmperCH${chiller}_data\` AS a5
          ON DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`), '%Y-%m-%d %H:%i') = DATE_FORMAT(FROM_UNIXTIME(a5.\`time@timestamp\`), '%Y-%m-%d %H:%i')
        WHERE 
          DATE_FORMAT(FROM_UNIXTIME(s.\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
      ) AS combined
      ORDER BY time;
    `;

    //console.log(queryGet);
    db3.query(queryGet, (err, result) => {
      if (err) {
        console.error(err);
        return response.status(500).send({ error: "Database query error" });
      }
      return response.status(200).send(result);
    });
  },

  // Building RND Suhu Backend
  BuildingRNDSuhu: async (request, response) => {
    const { area, start, finish } = request.query;
    const queryGet = `SELECT
          DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`)+ INTERVAL 4 HOUR, '%Y-%m-%d %H:%i') AS label,
          \`time@timestamp\`*1000  AS x,
          round(data_format_0,2) AS y
          FROM parammachine_saka.\`${area}\`
          WHERE
          DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`)+ INTERVAL 4 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
          ORDER BY
          \`time@timestamp\`;`;

    db.query(queryGet, (err, result) => {
      return response.status(200).send(result);
    });
  },

  // Building RND Suhu Backend
  BuildingRNDDP: async (request, response) => {
    const { area, start, finish } = request.query;
    const queryGet = `SELECT
          DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`)+ INTERVAL 4 HOUR, '%Y-%m-%d %H:%i') AS label,
          \`time@timestamp\`*1000  AS x,
          round(data_format_2/10,2) AS y
          FROM parammachine_saka.\`${area}\`
          WHERE
          DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`)+ INTERVAL 4 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
          ORDER BY
          \`time@timestamp\`;`;

    db.query(queryGet, (err, result) => {
      return response.status(200).send(result);
    });
  },

  // Building RND Suhu Backend
  BuildingRNDRH: async (request, response) => {
    const { area, start, finish } = request.query;
    const queryGet = `SELECT
          DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`)+ INTERVAL 4 HOUR, '%Y-%m-%d %H:%i') AS label,
          \`time@timestamp\`*1000  AS x,
          round(data_format_1,2) AS y
          FROM parammachine_saka.\`${area}\`
          WHERE
          DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`)+ INTERVAL 4 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
          ORDER BY
          \`time@timestamp\`;`;

    db.query(queryGet, (err, result) => {
      return response.status(200).send(result);
    });
  },

  // Building RND Suhu Backend
  BuildingRNDAll: async (request, response) => {
    const { area, start, finish } = request.query;
    const queryGet = `SELECT
          DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`)+ INTERVAL 4 HOUR, '%Y-%m-%d %H:%i') AS tgl,
          round(data_format_0,2) AS temp,
          round(data_format_1,2) AS RH,
          round(data_format_2/10,2) AS DP
          FROM parammachine_saka.\`${area}\`
          WHERE
          DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`)+ INTERVAL 4 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
          ORDER BY
          \`time@timestamp\`;`;

    db.query(queryGet, (err, result) => {
      return response.status(200).send(result);
    });
  },

  // Loopo Chart Backend
  Loopo: async (request, response) => {
    const { area, start, finish } = request.query;
    const queryGet = `SELECT
          DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d %H:%i') AS label,
          \`time@timestamp\`*1000 AS x,
          round(data_format_0,2) AS y
          FROM parammachine_saka.\`cMT-DB-WATER-UTY3_${area}_data\`
          WHERE
          DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
          ORDER BY
          \`time@timestamp\``;
    console.log(queryGet);
    db3.query(queryGet, (err, result) => {
      return response.status(200).send(result);
    });
  },

  // Osmotron Chart Backend
  Osmotron: async (request, response) => {
    const { area, start, finish } = request.query;
    const queryGet = `SELECT
          DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d %H:%i') AS label,
          \`time@timestamp\`*1000 AS x,
          round(data_format_0,2) AS y
          FROM parammachine_saka.\`cMT-DB-WATER-UTY3_${area}_data\`
          WHERE
          DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`)- INTERVAL 7 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
          ORDER BY
          \`time@timestamp\``;
    console.log(queryGet);
    db3.query(queryGet, (err, result) => {
      return response.status(200).send(result);
    });
  },

  // Building RND Suhu Backend
  BuildingWH1Suhu: async (request, response) => {
    const { area, start, finish } = request.query;
    const queryGet = `SELECT
        DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`)+ INTERVAL 4 HOUR, '%Y-%m-%d %H:%i') AS label,
        \`time@timestamp\`*1000  AS x,
        round(data_format_0,2) AS y
        FROM parammachine_saka.\`cMT-DehumRNDLt3danWH1_${area}_data\`
        WHERE
        DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`)+ INTERVAL 4 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
        ORDER BY
        \`time@timestamp\`;`;

    db3.query(queryGet, (err, result) => {
      return response.status(200).send(result);
    });
  },
  // Building RND RH Backend
  BuildingWH1RH: async (request, response) => {
    const { area, start, finish } = request.query;
    const queryGet = `SELECT
          DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`)+ INTERVAL 4 HOUR, '%Y-%m-%d %H:%i') AS label,
          \`time@timestamp\`*1000  AS x,
          round(data_format_1,2) AS y
          FROM parammachine_saka.\`cMT-DehumRNDLt3danWH1_${area}_data\`
          WHERE
          DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`)+ INTERVAL 4 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
          ORDER BY
          \`time@timestamp\`;`;

    db3.query(queryGet, (err, result) => {
      return response.status(200).send(result);
    });
  },

  // Building RND Suhu Backend
  BuildingWH1All: async (request, response) => {
    const { area, start, finish } = request.query;
    const queryGet = `SELECT
          DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`)+ INTERVAL 4 HOUR, '%Y-%m-%d %H:%i') AS tgl,
          round(data_format_0,2) AS temp,
          round(data_format_1,2) AS RH
          FROM parammachine_saka.\`cMT-DehumRNDLt3danWH1_${area}_data\`
          WHERE
          DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`)+ INTERVAL 4 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
          ORDER BY
          \`time@timestamp\`;`;

    db3.query(queryGet, (err, result) => {
      return response.status(200).send(result);
    });
  },

  // Alarm List Backend
  AlarmList: async (request, response) => {
    const { type, start, finish } = request.query;
    const queryGet = `SELECT
          DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`)+ INTERVAL 11 HOUR, '%Y-%m-%d %H:%i:%s') AS Tanggal,
          data_format_0 AS Event
          FROM parammachine_saka.\`${type}\`
          WHERE
          DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`)+ INTERVAL 11 HOUR, '%Y-%m-%d') BETWEEN '${start}' AND '${finish}'
          ORDER BY
          \`time@timestamp\`;`;

    db.query(queryGet, (err, result) => {
      return response.status(200).send(result);
    });
  },

  //==============EBR========================================EBR==========================================

  GetDataEBR_PMA: async (request, response) => {
    const { batch, date, machine } = request.query;
    console.log(batch);

    if (machine == "Wetmill") {
      var querryGet = ` SELECT data_index, 
       DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) + INTERVAL 4 HOUR, '%Y-%m-%d %H:%i:%s') AS label,
       REPLACE(REPLACE(REPLACE(REPLACE(CONVERT(data_format_0 USING utf8), '\0', ''), '\b', ''), '$', ''), CHAR(0x00), '') AS data_format_0_string,
       data_format_1,
       data_format_2,
       data_format_3
FROM ems_saka.\`cMT-FHDGEA1_EBR_${machine}_data\`
WHERE REPLACE(REPLACE(REPLACE(REPLACE(CONVERT(data_format_0 USING utf8), '\0', ''), '\b', ''), '$', ''), CHAR(0x00), '') LIKE '%${batch}%'`;
      console.log("wetmill", querryGet);
    } else {
      var querryGet = ` SELECT data_index, 
      DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`) + INTERVAL 4 HOUR, '%Y-%m-%d %H:%i:%s') AS label,
REPLACE(REPLACE(REPLACE(REPLACE(CONVERT(data_format_0 USING utf8), '\0', ''), '\b', ''), '$', ''), CHAR(0x00), '') AS data_format_0_string,
      REPLACE(REPLACE(REPLACE(REPLACE(CONVERT(data_format_1 USING utf8), '\0', ''), '\b', ''), '$', ''), CHAR(0x00), '') AS data_format_1_string,
      data_format_2,
      data_format_3,
      data_format_4,
      data_format_5,
      data_format_6,
      data_format_7
FROM ems_saka.\`cMT-FHDGEA1_EBR_${machine}_data\`
WHERE REPLACE(REPLACE(REPLACE(REPLACE(CONVERT(data_format_0 USING utf8), '\0', ''), '\b', ''), '$', ''), CHAR(0x00), '') LIKE '%${batch}%'`;
      console.log("yglain", querryGet);
    }

    db2.query(querryGet, (err, result) => {
      return response.status(200).send(result);
    });
  },

  //==============VIBRATE========================================VIBRATE==========================================

  fetchVibrate: async (request, response) => {
    const tableName = request.query.machine;
    const start = request.query.start;
    const finish = request.query.finish;

    const fetchQuery = `
    SELECT COALESCE(data_index, 0) AS id,
           \`time@timestamp\` AS time,
           data_format_0
    FROM \`${tableName}\`
    WHERE \`time@timestamp\` BETWEEN ${start} AND ${finish}
  `;

    // Fungsi pengecekan tabel di database
    const checkTableExists = (dbConn, machine, callback) => {
      const checkQuery = `SHOW TABLES LIKE '${machine}'`;
      dbConn.query(checkQuery, (err, result) => {
        if (err) return callback(err, false);
        return callback(null, result.length > 0);
      });
    };

    // Cek tabel di DB1
    checkTableExists(db, tableName, (err1, existsInDB1) => {
      if (err1)
        return response
          .status(500)
          .send({ error: "Error checking table in DB1", detail: err1 });

      if (existsInDB1) {
        // Jalankan query di DB1
        db.query(fetchQuery, (err, result) => {
          if (err)
            return response
              .status(500)
              .send({ error: "DB1 query error", detail: err });
          return response.status(200).send(result);
        });
      } else {
        // Cek tabel di DB2
        checkTableExists(db3, tableName, (err2, existsInDB2) => {
          if (err2)
            return response
              .status(500)
              .send({ error: "Error checking table in DB2", detail: err2 });

          if (existsInDB2) {
            // Jalankan query di DB2
            db3.query(fetchQuery, (err, result) => {
              if (err)
                return response
                  .status(500)
                  .send({ error: "DB2 query error", detail: err });
              return response.status(200).send(result);
            });
          } else {
            // Tabel tidak ditemukan di kedua DB
            return response
              .status(404)
              .send({ error: "Table not found in both databases" });
          }
        });
      }
    });
  },

  fetch138: async (request, response) => {
    let fetchQuerry =
      "select * from `cMT-VibrasiHVAC_CMH AHU E 1.01_data` ORDER BY id DESC";
    db3.query(fetchQuerry, (err, result) => {
      return response.status(200).send(result);
    });
  },

  vibrateChart: async (request, response) => {
    const tableName = request.query.machine;
    const start = request.query.start;
    const finish = request.query.finish;

    const fetchQuery = `
      SELECT COALESCE(data_index, 0) AS x,
            \`time@timestamp\` AS label,
            data_format_0 AS y
      FROM \`${tableName}\`
      WHERE \`time@timestamp\` BETWEEN ${start} AND ${finish}
    `;

    const checkTableExists = (dbConn, machine, callback) => {
      const checkQuery = `SHOW TABLES LIKE '${machine}'`;
      dbConn.query(checkQuery, (err, result) => {
        if (err) return callback(err, false);
        return callback(null, result.length > 0);
      });
    };

    // Cek tabel di DB1
    checkTableExists(db, tableName, (err1, existsInDB1) => {
      if (err1)
        return response
          .status(500)
          .send({ error: "Error checking table in DB1", detail: err1 });

      if (existsInDB1) {
        // Jalankan query di DB1
        db.query(fetchQuery, (err, result) => {
          if (err)
            return response
              .status(500)
              .send({ error: "DB1 query error", detail: err });
          return response.status(200).send(result);
        });
      } else {
        // Cek tabel di DB2
        checkTableExists(db3, tableName, (err2, existsInDB2) => {
          if (err2)
            return response
              .status(500)
              .send({ error: "Error checking table in DB2", detail: err2 });

          if (existsInDB2) {
            // Jalankan query di DB2
            db3.query(fetchQuery, (err, result) => {
              if (err)
                return response
                  .status(500)
                  .send({ error: "DB2 query error", detail: err });
              return response.status(200).send(result);
            });
          } else {
            // Tabel tidak ditemukan di kedua DB
            return response
              .status(404)
              .send({ error: "Table not found in both databases" });
          }
        });
      }
    });
  },

  trialChiller: async (request, response) => {
    let fetchQuerry = "select * from `CMT-Chiller_H-BodiChillerCH1_data`";
    db3.query(fetchQuerry, (err, result) => {
      return response.status(200).send(result);
    });
  },

  //==============INSTRUMENT IPC ========================================INSTRUMENT IPC==========================================

  getMoistureData: async (request, response) => {
    const { start, finish } = request.query;
    const queryGet = `SELECT * FROM sakaplant_prod_ipc_ma_staging 
    WHERE created_date BETWEEN '${start}' AND '${finish}'
    ORDER BY id_setup ASC;`;
    db4.query(queryGet, (err, result) => {
      console.log(queryGet);
      return response.status(200).send(result);
    });
  },

  getMoistureGraph: async (request, response) => {
    const { start, finish } = request.query;
    const queryGet = `
      SELECT
      created_date AS label,
      id_setup AS x, 
      end_weight AS y 
      FROM sakaplant_prod_ipc_ma_staging
      WHERE created_date BETWEEN '${start}' AND '${finish}'
      ORDER BY id_setup ASC;`;

    console.log(queryGet);
    db4.query(queryGet, (err, result) => {
      return response.status(200).send(result);
    });
  },

  getSartoriusData: async (request, response) => {
    const { start, finish } = request.query;
    const queryGet = `SELECT * FROM sakaplant_prod_ipc_scale_staging 
    WHERE DATE(created_date) 
    BETWEEN '${start}' AND '${finish}' 
    ORDER BY id_setup ASC;`;
    console.log(queryGet);

    db4.query(queryGet, (err, result) => {
      return response.status(200).send(result);
    });
  },

  getSartoriusGraph: async (request, response) => {
    const { start, finish } = request.query;
    const queryGet = `
    SELECT 
      created_date AS label, 
      id_setup AS x, 
      scale_weight AS y 
    FROM sakaplant_prod_ipc_scale_staging 
    WHERE DATE(created_date) 
    BETWEEN '${start}' AND '${finish}' 
    ORDER BY id_setup ASC;

  `;
    db4.query(queryGet, (err, result) => {
      if (err) {
        console.error(err);
        return response.status(500).send({ error: "Failed to fetch data" });
      }
      return response.status(200).send(result);
    });
  },

  getMettlerData: async (request, response) => {
    let fetchQuerry = "select * from `Mettler_Scales`";
    db4.query(fetchQuerry, (err, result) => {
      return response.status(200).send(result);
    });
  },

  //==============INSTRUMENT HARDNESS 141 ========================================INSTRUMENT HARDNESS 141 ==========================================
  getHardnessData: async (request, response) => {
    const { start, finish } = request.query;
    const queryGet = `SELECT * FROM ipc_hardness 
      WHERE created_date BETWEEN '${start}' AND '${finish}'
      ORDER BY id ASC;`;
    db4.query(queryGet, (err, result) => {
      return response.status(200).send(result);
    });
  },

  getHardnessGraph: async (request, response) => {
    const { start, finish } = request.query;
    const queryGet = `SELECT
          CONCAT(DATE(created_date), ' ', TIME(time_insert)) AS label,
          id AS x, 
          h_value AS y 
          FROM ipc_hardness 
          WHERE created_date BETWEEN '${start}' AND '${finish}'
          ORDER BY id ASC;`;
    db4.query(queryGet, (err, result) => {
      return response.status(200).send(result);
    });
  },

  getThicknessGraph: async (request, response) => {
    const { start, finish } = request.query;
    const queryGet = `SELECT
          CONCAT(DATE(created_date), ' ', TIME(time_insert)) AS label,
          id AS x, 
          t_value AS y 
          FROM ipc_hardness 
          WHERE created_date BETWEEN '${start}' AND '${finish}'
          ORDER BY id ASC;`;
    db4.query(queryGet, (err, result) => {
      return response.status(200).send(result);
    });
  },

  getDiameterGraph: async (request, response) => {
    const { start, finish } = request.query;
    const queryGet = `SELECT
          CONCAT(DATE(created_date), ' ', TIME(time_insert)) AS label,
          id AS x, 
          d_value AS y 
          FROM ipc_hardness 
          WHERE created_date BETWEEN '${start}' AND '${finish}'
          ORDER BY id ASC;`;
    db4.query(queryGet, (err, result) => {
      return response.status(200).send(result);
    });
  },

  //==============POWER METER MEZANINE ========================================POWER METER MEZANINE ==========================================

  fetchPower: async (request, response) => {
    let fetchQuerry =
      "SELECT COALESCE(`data_index`, 0) as 'id',`time@timestamp` as 'time', `data_format_0` FROM " +
      " " +
      "`" +
      request.query.machine +
      "`" +
      "WHERE `time@timestamp` BETWEEN" +
      " " +
      request.query.start +
      ` ` +
      "and" +
      ` ` +
      request.query.finish;

    db4.query(fetchQuerry, (err, result) => {
      return response.status(200).send(result);
    });
  },

  PowerMeterGraph: async (request, response) => {
    let fetchQuerry =
      "SELECT COALESCE(`data_index`, 0) as 'x', `time@timestamp` as 'label', `data_format_0` as 'y' FROM " +
      " " +
      "`" +
      request.query.machine +
      "`" +
      "WHERE `time@timestamp` BETWEEN" +
      " " +
      request.query.start +
      ` ` +
      "and" +
      ` ` +
      request.query.finish;

    db4.query(fetchQuerry, (err, result) => {
      return response.status(200).send(result);
    });
  },

  //==============BATCH RECORD LINE 1 ========================================BATCH RECORD LINE 1 ==========================================
  PMARecord1: async (request, response) => {
    const { start, finish } = request.query;
    const queryGet = `
        SELECT 
            data_index AS x, 
            CONVERT(data_format_0 USING utf8) AS BATCH,
            DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS label
        FROM 
            \`ems_saka\`.\`cMT-FHDGEA1_EBR_PMA_new_data\`
        WHERE 
            DATE(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}'
        GROUP BY 
            data_format_0
        ORDER BY
            label;
    `;
    try {
      const result = await new Promise((resolve, reject) => {
        db4.query(queryGet, (err, result) => {
          if (err) {
            return reject(err);
          }
          resolve(result);
        });
      });
      return response.status(200).send(result);
    } catch (error) {
      console.error(error);
      return response.status(500).send("Database query failed");
    }
  },

  BinderRecord1: async (request, response) => {
    const { start, finish } = request.query;
    const queryGet = `
        SELECT 
            data_index AS x, 
            CONVERT(data_format_0 USING utf8) AS BATCH,
            DATE(FROM_UNIXTIME(\`time@timestamp\`) + INTERVAL 4 HOUR) AS label
        FROM 
            \`parammachine_saka\`.\`mezanine.tengah_Ebr_Binder1_data\`
        WHERE 
            DATE(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}'
        GROUP BY 
            data_format_0
        ORDER BY
            label;
    `;
    try {
      const result = await new Promise((resolve, reject) => {
        db3.query(queryGet, (err, result) => {
          if (err) {
            return reject(err);
          }
          resolve(result);
        });
      });
      return response.status(200).send(result);
    } catch (error) {
      console.error(error);
      return response.status(500).send("Database query failed");
    }
  },

  WetmillRecord1: async (request, response) => {
    const { start, finish, data } = request.query;
    const wetArea = "cMT-FHDGEA1_EBR_Wetmill_new_data";

    // If no batch provided, return list of batches (existing behavior)
    if (!data) {
      console.log("[WetmillRecord1] List mode | start:", start, "finish:", finish);
      const queryGet = `
        SELECT 
            data_index AS x, 
            CONVERT(data_format_0 USING utf8) AS BATCH,
            DATE(FROM_UNIXTIME(\`time@timestamp\`) + INTERVAL 4 HOUR) AS label
        FROM 
            \`ems_saka\`.\`${wetArea}\`
        WHERE 
            DATE(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}'
        GROUP BY 
            data_format_0
        ORDER BY
            label;
      `;
      try {
        const result = await new Promise((resolve, reject) => {
          db4.query(queryGet, (err, result) => {
            if (err) return reject(err);
            resolve(result);
          });
        });
        return response.status(200).send(result);
      } catch (error) {
        console.error(error);
        return response.status(500).send("Database query failed");
      }
    }

    // Batch provided: return detailed rows for that batch
    console.log("[WetmillRecord1] Batch mode | data:", data, "start:", start, "finish:", finish);
    const getMappedColumns = (area, excludeCols = []) => {
      return new Promise((resolve, reject) => {
        const queryCols = `
          SELECT COLUMN_NAME
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = 'ems_saka'
            AND TABLE_NAME = ?
            AND COLUMN_NAME NOT IN (${excludeCols.map(() => "?").join(", ")})
        `;
        const queryMap = `
          SELECT data_format_index, comment FROM \`${area}_format\`
        `;
        db4.query(queryCols, [area, ...excludeCols], (err, colResults) => {
          if (err) return reject(err);
          db4.query(queryMap, (err2, mapResults) => {
            if (err2) return reject(err2);

            const columns = colResults.map(({ COLUMN_NAME }) => {
              const match = COLUMN_NAME.match(/data_format_(\d+)/);
              if (match) {
                const index = parseInt(match[1], 10);
                const mapping = mapResults.find((m) => m.data_format_index === index);
                if (mapping) {
                  return `\`${COLUMN_NAME}\` AS \`${mapping.comment}\``;
                }
              }
              return `\`${COLUMN_NAME}\``;
            });

            resolve(columns);
          });
        });
      });
    };

    try {
      const wetColumns = await getMappedColumns(wetArea, [
        "data_format_0",
        "time@timestamp",
        "data_index",
      ]);

      let where = `CONVERT(\`${wetArea}\`.\`data_format_0\` USING utf8) LIKE ?`;
      const params = [`%${data}%`];
      if (start && finish) {
        where += ` AND DATE(FROM_UNIXTIME(\`${wetArea}\`.\`time@timestamp\`)) BETWEEN ? AND ?`;
        params.push(start, finish);
      }

      const query = `
        SELECT 
          DATE_FORMAT(FROM_UNIXTIME(FLOOR(\`time@timestamp\`)), '%Y-%m-%d %H:%i') AS WET_time,
          ${wetColumns.join(", ")},
          CONVERT(\`data_format_0\` USING utf8) AS WET_BATCH
        FROM \`ems_saka\`.\`${wetArea}\`
        WHERE ${where}
        ORDER BY \`time@timestamp\` ASC;
      `;
      console.log("[WetmillRecord1] Query:\n", query);
      console.log("[WetmillRecord1] Params:", params);

      const result = await new Promise((resolve, reject) => {
        db4.query(query, params, (err, result) => {
          if (err) return reject(err);
          resolve(result);
        });
      });
      console.log("[WetmillRecord1] Rows:", result?.length || 0);
      return response.status(200).send(result);
    } catch (error) {
      console.error(error);
      return response.status(500).send("Database query failed");
    }
  },    

  FBDRecord1: async (request, response) => {
    const { start, finish } = request.query;
    const queryGet = `
        SELECT 
            data_index AS x, 
            CONVERT(data_format_0 USING utf8) AS BATCH,
            DATE(FROM_UNIXTIME(\`time@timestamp\`) + INTERVAL 4 HOUR) AS label
        FROM 
            \`ems_saka\`.\`cMT-FHDGEA1_EBR_FBD_new_data\`
        WHERE 
            DATE(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}'
        GROUP BY 
            data_format_0
        ORDER BY
            label;
    `;

    console.log(queryGet);
    try {
      const result = await new Promise((resolve, reject) => {
        db4.query(queryGet, (err, result) => {
          if (err) {
            return reject(err);
          }
          resolve(result);
        });
      });
      return response.status(200).send(result);
    } catch (error) {
      console.error(error);
      return response.status(500).send("Database query failed");
    }
  },

  EPHRecord1: async (request, response) => {
    const { start, finish } = request.query;
    const queryGet = `
        SELECT 
            data_index AS x, 
            CONVERT(data_format_0 USING utf8) AS BATCH,
            DATE(FROM_UNIXTIME(\`time@timestamp\`) + INTERVAL 4 HOUR) AS label
        FROM 
            \`ems_saka\`.\`cMT-FHDGEA1_EBR_EPH_new_data\`
        WHERE 
            DATE(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}'
        GROUP BY 
            data_format_0
        ORDER BY
            label;
    `;
    try {
      const result = await new Promise((resolve, reject) => {
        db4.query(queryGet, (err, result) => {
          if (err) {
            return reject(err);
          }
          resolve(result);
        });
      });
      return response.status(200).send(result);
    } catch (error) {
      console.error(error);
      return response.status(500).send("Database query failed");
    }
  },

  TumblerRecord1: async (request, response) => {
    const { start, finish } = request.query;
    const queryGet = `
        SELECT 
            data_index AS x, 
            CONVERT(data_format_0 USING utf8) AS BATCH,
            DATE(FROM_UNIXTIME(\`time@timestamp\`) + INTERVAL 4 HOUR) AS label
        FROM 
            \`ems_saka\`.\`cMT-FHDGEA1_EBR_Finalmix_data\`
        WHERE 
            DATE(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}'
        GROUP BY 
            data_format_0
        ORDER BY
            label;
    `;
    try {
      const result = await new Promise((resolve, reject) => {
        db2.query(queryGet, (err, result) => {
          if (err) {
            return reject(err);
          }
          resolve(result);
        });
      });
      return response.status(200).send(result);
    } catch (error) {
      console.error(error);
      return response.status(500).send("Database query failed");
    }
  },

  FetteRecord1: async (request, response) => {
    const { start, finish } = request.query;
    const queryGet = `
        SELECT 
            data_index AS x, 
            CONVERT(data_format_0 USING utf8) AS BATCH,
            DATE(FROM_UNIXTIME(\`time@timestamp\`) + INTERVAL 4 HOUR) AS label
        FROM 
            \`parammachine_saka\`.\`mezanine.tengah_EBR_FetteLine1_data\`
        WHERE 
            DATE(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}'
        GROUP BY 
            data_format_0
        ORDER BY
            label;
    `;
    try {
      const result = await new Promise((resolve, reject) => {
        db3.query(queryGet, (err, result) => {
          if (err) {
            return reject(err);
          }
          resolve(result);
        });
      });
      return response.status(200).send(result);
    } catch (error) {
      console.error(error);
      return response.status(500).send("Database query failed");
    }
  },

  // DedusterRecord1: async (request, response) => {
  //   try {
  //     const result = await new Promise((resolve, reject) => {
  //       db4.query(queryGet, (err, result) => {
  //         if (err) {
  //           return reject(err);
  //         }
  //         resolve(result);
  //       });
  //     });
  //     return response.status(200).send(result);
  //   } catch (error) {
  //     console.error(error);
  //     return response.status(500).send("Database query failed");
  //   }
  // },

  // LifterRecord1: async (request, response) => {
  //   try {
  //     const result = await new Promise((resolve, reject) => {
  //       db4.query(queryGet, (err, result) => {
  //         if (err) {
  //           return reject(err);
  //         }
  //         resolve(result);
  //       });
  //     });
  //     return response.status(200).send(result);
  //   } catch (error) {
  //     console.error(error);
  //     return response.status(500).send("Database query failed");
  //   }
  // },

  // MetalDetectorRecord1: async (request, response) => {
  //   try {
  //     const result = await new Promise((resolve, reject) => {
  //       db4.query(queryGet, (err, result) => {
  //         if (err) {
  //           return reject(err);
  //         }
  //         resolve(result);
  //       });
  //     });
  //     return response.status(200).send(result);
  //   } catch (error) {
  //     console.error(error);
  //     return response.status(500).send("Database query failed");
  //   }
  // },

  // IJPRecord1: async (request, response) => {
  //   try {
  //     const result = await new Promise((resolve, reject) => {
  //       db4.query(queryGet, (err, result) => {
  //         if (err) {
  //           return reject(err);
  //         }
  //         resolve(result);
  //       });
  //     });
  //     return response.status(200).send(result);
  //   } catch (error) {
  //     console.error(error);
  //     return response.status(500).send("Database query failed");
  //   }
  // },

  HMRecord1: async (request, response) => {
    const { start, finish } = request.query;
    const queryGet = `
        SELECT 
            data_index AS x, 
            batchname AS BATCH,
            DATE(FROM_UNIXTIME(\`time@timestamp\` / 1000) + INTERVAL 4 HOUR) AS label
        FROM 
            \`parammachine_saka\`.\`hm_striping_1B\`
        WHERE 
            DATE(FROM_UNIXTIME(\`time@timestamp\` / 1000)) BETWEEN '${start}' AND '${finish}'
        GROUP BY 
            BATCH
        ORDER BY
            label;
    `;
    db.query(queryGet, (err, result) => {
      if (err) {
        console.log(err);
        return response.status(500).send("Database query failed");
      }
      return response.status(200).send(result);
    });
  },

  CM1Record1: async (request, response) => {
    const { start, finish } = request.query;
    const queryGet = `
        SELECT 
            data_index AS x, 
            CONVERT(data_format_0 USING utf8) AS BATCH,
            DATE(FROM_UNIXTIME(\`time@timestamp\`) + INTERVAL 4 HOUR) AS label
        FROM 
            \`parammachine_saka\`.\`mezanine.tengah_Cm1_data\`
        WHERE 
            DATE(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}'
        GROUP BY 
            data_format_0
        ORDER BY
            label;
    `;
    try {
      const result = await new Promise((resolve, reject) => {
        db4.query(queryGet, (err, result) => {
          if (err) {
            return reject(err);
          }
          resolve(result);
        });
      });
      return response.status(200).send(result);
    } catch (error) {
      console.error(error);
      return response.status(500).send("Database query failed");
    }
  },

  PMARecord3: async (request, response) => {
    const { start, finish } = request.query;
    const queryGet = `
        SELECT 
            data_index AS x, 
            CONVERT(data_format_0 USING utf8) AS BATCH,
            DATE(FROM_UNIXTIME(\`time@timestamp\`) + INTERVAL 4 HOUR) AS label
        FROM 
            \`parammachine_saka\`.\`cMT-GEA-L3_EBR_PMA_L3_data\`
        WHERE 
            DATE(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}'
        GROUP BY 
            data_format_0
        ORDER BY
            label;
    `;
    try {
      const result = await new Promise((resolve, reject) => {
        db3.query(queryGet, (err, result) => {
          if (err) {
            return reject(err);
          }
          resolve(result);
        });
      });
      return response.status(200).send(result);
    } catch (error) {
      console.error(error);
      return response.status(500).send("Database query failed");
    }
  },

  // BinderRecord3: async (request, response) => {
  //   try {
  //     const result = await new Promise((resolve, reject) => {
  //       db3.query(queryGet, (err, result) => {
  //         if (err) {
  //           return reject(err);
  //         }
  //         resolve(result);
  //       });
  //     });
  //     return response.status(200).send(result);
  //   } catch (error) {
  //     console.error(error);
  //     return response.status(500).send("Database query failed");
  //   }
  // },
  /*
  WetmillRecord3: async (request, response) => {
    const { start, finish } = request.query;
    const queryGet = `
        SELECT 
            data_index AS x, 
            CONVERT(data_format_0 USING utf8) AS BATCH,
            DATE(FROM_UNIXTIME(\`time@timestamp\`) + INTERVAL 4 HOUR) AS label
        FROM 
            \`parammachine_saka\`.\`cMT-GEA-L3_EBR_WETMILL_data\`
        WHERE 
            DATE(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}'
        GROUP BY 
            data_format_0
        ORDER BY
            label;
    `;
    try {
      const result = await new Promise((resolve, reject) => {
        db3.query(queryGet, (err, result) => {
          if (err) {
            return reject(err);
          }
          resolve(result);
        });
      });
      return response.status(200).send(result);
    } catch (error) {
      console.error(error);
      return response.status(500).send("Database query failed");
    }
  }, */

  WetmillRecord3: async (request, response) => {
    const { start, finish } = request.query;
    const queryGet = `
        SELECT DISTINCT
            data_index AS x, 
            CAST(data_format_0 AS CHAR) AS BATCH,
            DATE(FROM_UNIXTIME(\`time@timestamp\`) + INTERVAL 4 HOUR) AS label
        FROM 
            \`parammachine_saka\`.\`cMT-GEA-L3_EBR_WETMILL_data\`
        WHERE 
            DATE(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}'
        ORDER BY
            label DESC;
    `;
    try {
      const result = await new Promise((resolve, reject) => {
        db3.query(queryGet, (err, result) => {
          if (err) {
            return reject(err);
          }
          resolve(result);
        });
      });
      return response.status(200).send(result);
    } catch (error) {
      console.error(error);
      return response.status(500).send("Database query failed");
    }
  },

    FBDRecord3: async (request, response) => {
      const { start, finish } = request.query;
      const queryGet = `
          SELECT 
              data_index AS x, 
              CONVERT(data_format_0 USING utf8) AS BATCH,
              DATE(FROM_UNIXTIME(\`time@timestamp\`) + INTERVAL 4 HOUR) AS label
          FROM 
              \`parammachine_saka\`.\`cMT-GEA-L3_EBR_FBD_L3_data\`
          WHERE 
              DATE(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}'
          GROUP BY 
              data_format_0
          ORDER BY
              label;
      `;
      try {
        const result = await new Promise((resolve, reject) => {
          db3.query(queryGet, (err, result) => {
            if (err) {
              return reject(err);
            }
            resolve(result);
          });
        });
        return response.status(200).send(result);
      } catch (error) {
        console.error(error);
        return response.status(500).send("Database query failed");
      }
    },

  EPHRecord3: async (request, response) => {
    const { start, finish } = request.query;
    const queryGet = `
        SELECT 
            data_index AS x, 
            CONVERT(data_format_0 USING utf8) AS BATCH,
            DATE(FROM_UNIXTIME(\`time@timestamp\`) + INTERVAL 4 HOUR) AS label
        FROM 
            \`parammachine_saka\`.\`cMT-GEA-L3_EBR_EPH_L3_data\`
        WHERE 
            DATE(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN '${start}' AND '${finish}'
        GROUP BY 
            data_format_0
        ORDER BY
            label;
    `;
    try {
      const result = await new Promise((resolve, reject) => {
        db3.query(queryGet, (err, result) => {
          if (err) {
            return reject(err);
          }
          resolve(result);
        });
      });
      return response.status(200).send(result);
    } catch (error) {
      console.error(error);
      return response.status(500).send("Database query failed");
    }
  },

  // TumblerRecord3: async (request, response) => {
  //   try {
  //     const result = await new Promise((resolve, reject) => {
  //       db2.query(queryGet, (err, result) => {
  //         if (err) {
  //           return reject(err);
  //         }
  //         resolve(result);
  //       });
  //     });
  //     return response.status(200).send(result);
  //   } catch (error) {
  //     console.error(error);
  //     return response.status(500).send("Database query failed");
  //   }
  // },

  // FetteRecord3: async (request, response) => {
  //   try {
  //     const result = await new Promise((resolve, reject) => {
  //       db4.query(queryGet, (err, result) => {
  //         if (err) {
  //           return reject(err);
  //         }
  //         resolve(result);
  //       });
  //     });
  //     return response.status(200).send(result);
  //   } catch (error) {
  //     console.error(error);
  //     return response.status(500).send("Database query failed");
  //   }
  // },

  // DedusterRecord3: async (request, response) => {
  //   try {
  //     const result = await new Promise((resolve, reject) => {
  //       db4.query(queryGet, (err, result) => {
  //         if (err) {
  //           return reject(err);
  //         }
  //         resolve(result);
  //       });
  //     });
  //     return response.status(200).send(result);
  //   } catch (error) {
  //     console.error(error);
  //     return response.status(500).send("Database query failed");
  //   }
  // },

  // LifterRecord3: async (request, response) => {
  //   try {
  //     const result = await new Promise((resolve, reject) => {
  //       db4.query(queryGet, (err, result) => {
  //         if (err) {
  //           return reject(err);
  //         }
  //         resolve(result);
  //       });
  //     });
  //     return response.status(200).send(result);
  //   } catch (error) {
  //     console.error(error);
  //     return response.status(500).send("Database query failed");
  //   }
  // },

  // MetalDetectorRecord3: async (request, response) => {
  //   try {
  //     const result = await new Promise((resolve, reject) => {
  //       db4.query(queryGet, (err, result) => {
  //         if (err) {
  //           return reject(err);
  //         }
  //         resolve(result);
  //       });
  //     });
  //     return response.status(200).send(result);
  //   } catch (error) {
  //     console.error(error);
  //     return response.status(500).send("Database query failed");
  //   }
  // },

  // IJPRecord3: async (request, response) => {
  //   try {
  //     const result = await new Promise((resolve, reject) => {
  //       db4.query(queryGet, (err, result) => {
  //         if (err) {
  //           return reject(err);
  //         }
  //         resolve(result);
  //       });
  //     });
  //     return response.status(200).send(result);
  //   } catch (error) {
  //     console.error(error);
  //     return response.status(500).send("Database query failed");
  //   }
  // },


    // Wetmill New Backend Line 3
  SearchWetmillRecord3: async (request, response) => {
    const { data, start, finish } = request.query;
    if (!data) {
      return response.status(400).send({ error: "Batch data is required" });
    }
    
    const wetArea = "cMT-GEA-L3_EBR_WETMILL_new_data";

    const getMappedColumns = (area, excludeCols = []) => {
      return new Promise((resolve, reject) => {
        const queryCols = `
          SELECT COLUMN_NAME
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = 'parammachine_saka'
            AND TABLE_NAME = ?
            AND COLUMN_NAME NOT IN (${excludeCols.map(() => "?").join(", ")})
        `;
        const queryMap = `
          SELECT data_format_index, comment FROM \`${area}_format\`
        `;
        db3.query(queryCols, [area, ...excludeCols], (err, colResults) => {
          if (err) return reject(err);
          db3.query(queryMap, (err2, mapResults) => {
            if (err2) return reject(err2);

            const columns = colResults.map(({ COLUMN_NAME }) => {
              const match = COLUMN_NAME.match(/data_format_(\d+)/);
              if (match) {
                const index = parseInt(match[1], 10);
                const mapping = mapResults.find(
                  (m) => m.data_format_index === index
                );
                if (mapping) {
                  return `\`${COLUMN_NAME}\` AS \`${mapping.comment}\``;
                }
              }
              return `\`${COLUMN_NAME}\``;
            });

            resolve(columns);
          });
        });
      });
    };

    try {
      const wetColumns = await getMappedColumns(wetArea, [
        "data_format_0",
        "time@timestamp",
        "data_index",
      ]);

      const query = `
        SELECT 
          DATE_FORMAT(FROM_UNIXTIME(FLOOR(\`time@timestamp\`)), '%Y-%m-%d %H:%i') AS WET_time,
          ${wetColumns.join(", ")},
          CAST(\`data_format_0\` AS CHAR) AS WET_BATCH
        FROM \`parammachine_saka\`.\`${wetArea}\`
        WHERE
          CAST(\`data_format_0\` AS CHAR) LIKE ?
          AND DATE(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN ? AND ?
        ORDER BY \`time@timestamp\` ASC;
      `;

      const result = await new Promise((resolve, reject) => {
        db3.query(query, [`%${data}%`, start, finish], (err, result) => {
          if (err) return reject(err);
          resolve(result);
        });
      });
      return response.status(200).send(result);
    } catch (error) {
      console.error(error);
      return response.status(500).send("Database query failed: " + error.message);
    }
  },

  HMRecord3: async (request, response) => {
    const { start, finish } = request.query;
    const queryGet = `
        SELECT 
            data_index AS x, 
            batchname AS BATCH,
            DATE(FROM_UNIXTIME(\`time@timestamp\` / 1000) + INTERVAL 4 HOUR) AS label
        FROM 
            \`parammachine_saka\`.\`hm_striping_1B\`
        WHERE 
            DATE(FROM_UNIXTIME(\`time@timestamp\` / 1000)) BETWEEN '${start}' AND '${finish}'
        GROUP BY 
            BATCH
        ORDER BY
            label;
    `;
    db.query(queryGet, (err, result) => {
      if (err) {
        console.log(err);
        return response.status(500).send("Database query failed");
      }
      return response.status(200).send(result);
    });
  },

  // CM1Record3: async (request, response) => {
  //   try {
  //     const result = await new Promise((resolve, reject) => {
  //       db4.query(queryGet, (err, result) => {
  //         if (err) {
  //           return reject(err);
  //         }
  //         resolve(result);
  //       });
  //     });
  //     return response.status(200).send(result);
  //   } catch (error) {
  //     console.error(error);
  //     return response.status(500).send("Database query failed");
  //   }
  // },

  //==============SEARCH BATCH RECORD NEW========================================SEARCH BATCH RECORD NEW==========================================

  SearchPMARecord1: async (request, response) => {
    const { data } = request.query;
    const pmaArea = "cMT-FHDGEA1_EBR_PMA_new_data";
    const wetArea = "cMT-FHDGEA1_EBR_Wetmill_new_data";

    const getMappedColumns = (area, excludeCols = []) => {
      return new Promise((resolve, reject) => {
        const queryCols = `
          SELECT COLUMN_NAME
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = 'ems_saka'
            AND TABLE_NAME = ?
            AND COLUMN_NAME NOT IN (${excludeCols.map(() => "?").join(", ")})
        `;
        const queryMap = `
          SELECT data_format_index, comment FROM \`${area}_format\`
        `;
        db4.query(queryCols, [area, ...excludeCols], (err, colResults) => {
          if (err) return reject(err);
          db4.query(queryMap, (err2, mapResults) => {
            if (err2) return reject(err2);

            const columns = colResults.map(({ COLUMN_NAME }) => {
              const match = COLUMN_NAME.match(/data_format_(\d+)/);
              if (match) {
                const index = parseInt(match[1], 10);
                const mapping = mapResults.find(
                  (m) => m.data_format_index === index
                );
                if (mapping) {
                  return `\`${area}\`.\`${COLUMN_NAME}\` AS \`${mapping.comment}\``;
                }
              }
              return `\`${area}\`.\`${COLUMN_NAME}\``;
            });

            resolve(columns);
          });
        });
      });
    };

    try {
      const [pmaColumns, wetColumns] = await Promise.all([
        getMappedColumns(pmaArea, [
          "data_format_0",
          "data_format_1",
          "time@timestamp",
          "data_index",
        ]),
        getMappedColumns(wetArea, [
          "data_format_0",
          "time@timestamp",
          "data_index",
        ]),
      ]);

      const query = `
        SELECT
          DATE_FORMAT(FROM_UNIXTIME(FLOOR(\`${pmaArea}\`.\`time@timestamp\`)), '%Y-%m-%d %H:%i') AS PMA_time,
          ${pmaColumns.join(",")},
          CONVERT(\`${pmaArea}\`.\`data_format_0\` USING utf8) AS PMA_BATCH,
          CONVERT(\`${pmaArea}\`.\`data_format_1\` USING utf8) AS PMA_PROCESS,

          DATE_FORMAT(FROM_UNIXTIME(FLOOR(\`${wetArea}\`.\`time@timestamp\`)), '%Y-%m-%d %H:%i') AS WET_time,
          ${wetColumns.join(",")},
          CONVERT(\`${wetArea}\`.\`data_format_0\` USING utf8) AS WET_PROCESS

        FROM \`ems_saka\`.\`${pmaArea}\`
        LEFT JOIN \`ems_saka\`.\`${wetArea}\`
          ON ABS(\`${pmaArea}\`.\`time@timestamp\` - \`${wetArea}\`.\`time@timestamp\`) <= 60
        WHERE
          CONVERT(\`${pmaArea}\`.\`data_format_0\` USING utf8) LIKE ?
        ORDER BY \`${pmaArea}\`.\`time@timestamp\` ASC;
      `;

      //console.log(query);
      db4.query(query, [`%${data}%`], (err, result) => {
        if (err) {
          console.error(err);
          return response.status(500).send("Database query failed");
        }
        return response.status(200).send(result);
      });
    } catch (err) {
      console.error(err);
      return response.status(500).send("Error combining PMA & WET data");
    }
  },

  SearchWetMillRecord1: async (request, response) => {
    const { data, start, finish } = request.query;
    const wetArea = "cMT-FHDGEA1_EBR_Wetmill_new_data";

    const getMappedColumns = (area, excludeCols = []) => {
      return new Promise((resolve, reject) => {
        const queryCols = `
          SELECT COLUMN_NAME
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = 'ems_saka'
            AND TABLE_NAME = ?
            AND COLUMN_NAME NOT IN (${excludeCols.map(() => "?").join(", ")})
        `;
        const queryMap = `
          SELECT data_format_index, comment FROM \`${area}_format\`
        `;
        db4.query(queryCols, [area, ...excludeCols], (err, colResults) => {
          if (err) return reject(err);
          db4.query(queryMap, (err2, mapResults) => {
            if (err2) return reject(err2);

            const columns = colResults.map(({ COLUMN_NAME }) => {
              const match = COLUMN_NAME.match(/data_format_(\d+)/);
              if (match) {
                const index = parseInt(match[1], 10);
                const mapping = mapResults.find((m) => m.data_format_index === index);
                if (mapping) {
                  return `\`${area}\`.\`${COLUMN_NAME}\` AS \`${mapping.comment}\``;
                }
              }
              return `\`${area}\`.\`${COLUMN_NAME}\``;
            });

            resolve(columns);
          });
        });
      });
    };

    try {
      const wetColumns = await getMappedColumns(wetArea, [
        "data_format_0",
        "time@timestamp",
        "data_index",
      ]);

      let where = `CONVERT(\`${wetArea}\`.\`data_format_0\` USING utf8) LIKE ?`;
      const params = [`%${data}%`];
      if (start && finish) {
        where += ` AND DATE(FROM_UNIXTIME(\`${wetArea}\`.\`time@timestamp\`)) BETWEEN ? AND ?`;
        params.push(start, finish);
      }

      const query = `
        SELECT 
          DATE_FORMAT(FROM_UNIXTIME(FLOOR(\`${wetArea}\`.\`time@timestamp\`)), '%Y-%m-%d %H:%i') AS WET_time,
          ${wetColumns.join(", ")},
          CONVERT(\`${wetArea}\`.\`data_format_0\` USING utf8) AS WET_BATCH
        FROM \`ems_saka\`.\`${wetArea}\`
        WHERE ${where}
        ORDER BY \`${wetArea}\`.\`time@timestamp\` ASC;
      `;

      db4.query(query, params, (err, result) => {
        if (err) {
          console.error(err);
          return response.status(500).send("Database query failed");
        }
        return response.status(200).send(result);
      });
    } catch (err) {
      console.error(err);
      return response.status(500).send("Error fetching Wetmill data");
    }
  },

  SearchBinderRecord1: async (request, response) => {
    const { data } = request.query;
    const area = "mezanine.tengah_Ebr_Binder1_data"; // Static value

    const getAllColumns = () => {
      return new Promise((resolve, reject) => {
        const query = `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'parammachine_saka'
        AND TABLE_NAME = '${area}'
      `;
        db.query(query, [area], (err, results) => {
          if (err) return reject(err);
          const columns = results.map((result) => result.COLUMN_NAME);
          resolve(columns);
        });
      });
    };

    const getColumnMappings = () => {
      return new Promise((resolve, reject) => {
        const query = `
        SELECT data_format_index, comment
        FROM \`${area}_format\`
      `;
        db.query(query, (err, results) => {
          if (err) return reject(err);
          resolve(results);
        });
      });
    };

    try {
      const columns = await getAllColumns();
      const columnMappings = await getColumnMappings();

      const mappedColumns = columns.map((col) => {
        const match = col.match(/data_format_(\d+)/);
        if (match) {
          const index = parseInt(match[1], 10);
          const mapping = columnMappings.find(
            (mapping) => mapping.data_format_index === index
          );
          if (mapping) {
            return `\`${col}\` AS \`${mapping.comment}\``;
          }
        }
        return `\`${col}\``;
      });

      const queryGet = `
          SELECT
            ${mappedColumns.join(", ")},
            CONVERT(\`data_format_0\` USING utf8) AS \`BATCH\`,
            CONVERT(\`data_format_1\` USING utf8) AS \`PROCESS\`
          FROM
            \`parammachine_saka\`.\`${area}\`
          GROUP BY
            \`BATCH\`
          ORDER BY
            MIN(DATE(FROM_UNIXTIME(\`time@timestamp\`))) ASC;
        `;
      db.query(queryGet, [`%${data}%`], (err, result) => {
        if (err) {
          console.log(err);
          return response.status(500).send("Database query failed");
        }
        return response.status(200).send(result);
      });
    } catch (error) {
      console.log(error);
      return response.status(500).send("Database query failed");
    }
  },

  SearchFBDRecord1: async (request, response) => {
    const { data } = request.query;
    const area = "cMT-FHDGEA1_EBR_FBD_new_data"; // Static value

    const getAllColumns = () => {
      return new Promise((resolve, reject) => {
        const query = `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'ems_saka'
        AND TABLE_NAME = ?
        AND COLUMN_NAME NOT IN ('data_format_0', 'data_format_1')
      `;
        db4.query(query, [area], (err, results) => {
          if (err) return reject(err);
          const columns = results.map((result) => result.COLUMN_NAME);
          resolve(columns);
        });
      });
    };

    const getColumnMappings = () => {
      return new Promise((resolve, reject) => {
        const query = `
        SELECT data_format_index, comment
        FROM \`${area}_format\`
      `;
        db4.query(query, (err, results) => {
          if (err) return reject(err);
          resolve(results);
        });
      });
    };

    try {
      const columns = await getAllColumns();
      const columnMappings = await getColumnMappings();

      const mappedColumns = columns.map((col) => {
        const match = col.match(/data_format_(\d+)/);
        if (match) {
          const index = parseInt(match[1], 10);
          const mapping = columnMappings.find(
            (mapping) => mapping.data_format_index === index
          );
          if (mapping) {
            return `\`${col}\` AS \`${mapping.comment}\``;
          }
        }
        return `\`${col}\``;
      });

      const queryGet = `
      SELECT
        ${mappedColumns.join(", ")},
        CONVERT(\`data_format_0\` USING utf8) AS \`BATCH\`,
        CONVERT(\`data_format_1\` USING utf8) AS \`PROCESS\`
      FROM
        \`ems_saka\`.\`${area}\`
      WHERE
        CONVERT(\`data_format_0\` USING utf8) LIKE ?
      ORDER BY
        DATE(FROM_UNIXTIME(\`time@timestamp\`)) ASC;
    `;

      db4.query(queryGet, [`%${data}%`], (err, result) => {
        if (err) {
          console.log(err);
          return response.status(500).send("Database query failed");
        }
        return response.status(200).send(result);
      });
    } catch (error) {
      console.log(error);
      return response.status(500).send("Database query failed");
    }
  },

  SearchEPHRecord1: async (request, response) => {
    const { data } = request.query;
    const area = "cMT-FHDGEA1_EBR_EPH_new_data"; // Static value

    const getAllColumns = () => {
      return new Promise((resolve, reject) => {
        const query = `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'ems_saka'
        AND TABLE_NAME = ?
        AND COLUMN_NAME NOT IN ('data_format_0', 'data_format_1')
      `
      ;
        db4.query(query, [area], (err, results) => {
          if (err) return reject(err);
          const columns = results.map((result) => result.COLUMN_NAME);
          resolve(columns);
        });
      });
    };

    const getColumnMappings = () => {
      return new Promise((resolve, reject) => {
        const query = `
        SELECT data_format_index, comment
        FROM \`${area}_format\`
      `;
        db4.query(query, (err, results) => {
          if (err) return reject(err);
          resolve(results);
        });
      });
    };

    try {
      const columns = await getAllColumns();
      const columnMappings = await getColumnMappings();

      const mappedColumns = columns.map((col) => {
        const match = col.match(/data_format_(\d+)/);
        if (match) {
          const index = parseInt(match[1], 10);
          const mapping = columnMappings.find(
            (mapping) => mapping.data_format_index === index
          );
          if (mapping) {
            return `\`${col}\` AS \`${mapping.comment}\``;
          }
        }
        return `\`${col}\``;
      });

      const queryGet = `
      SELECT
        ${mappedColumns.join(", ")},
        CONVERT(\`data_format_0\` USING utf8) AS \`BATCH\`,
        CONVERT(\`data_format_1\` USING utf8) AS \`PROCESS\`
      FROM
        \`ems_saka\`.\`${area}\`
      WHERE
        CONVERT(\`data_format_0\` USING utf8) LIKE ?
      ORDER BY
        DATE(FROM_UNIXTIME(\`time@timestamp\`)) ASC;
    `;

      db4.query(queryGet, [`%${data}%`], (err, result) => {
        if (err) {
          console.log(err);
          return response.status(500).send("Database query failed");
        }
        return response.status(200).send(result);
      });
    } catch (error) {
      console.log(error);
      return response.status(500).send("Database query failed");
    }
  },

  SearchTumblerRecord1: async (request, response) => {
    const { data } = request.query;
    const area = "cMT-FHDGEA1_EBR_Finalmix_data"; // Static value

    const getAllColumns = () => {
      return new Promise((resolve, reject) => {
        const query = `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'ems_saka'
        AND TABLE_NAME = ?
        AND COLUMN_NAME NOT IN ('data_format_0')
      `;
        db2.query(query, [area], (err, results) => {
          if (err) return reject(err);
          const columns = results.map((result) => result.COLUMN_NAME);
          resolve(columns);
        });
      });
    };

    const getColumnMappings = () => {
      return new Promise((resolve, reject) => {
        const query = `
        SELECT data_format_index, comment
        FROM \`${area}_format\`
      `;
        db2.query(query, (err, results) => {
          if (err) return reject(err);
          resolve(results);
        });
      });
    };

    try {
      const columns = await getAllColumns();
      const columnMappings = await getColumnMappings();

      const mappedColumns = columns.map((col) => {
        const match = col.match(/data_format_(\d+)/);
        if (match) {
          const index = parseInt(match[1], 10);
          const mapping = columnMappings.find(
            (mapping) => mapping.data_format_index === index
          );
          if (mapping) {
            return `\`${col}\` AS \`${mapping.comment}\``;
          }
        }
        return `\`${col}\``;
      });

      const queryGet = `
      SELECT
        ${mappedColumns.join(", ")},
        CONVERT(\`data_format_0\` USING utf8) AS \`BATCH\`
      FROM
        \`ems_saka\`.\`${area}\`
      WHERE
        CONVERT(\`data_format_0\` USING utf8) LIKE ?
      ORDER BY
        DATE(FROM_UNIXTIME(\`time@timestamp\`)) ASC;
    `;

      db2.query(queryGet, [`%${data}%`], (err, result) => {
        if (err) {
          console.log(err);
          return response.status(500).send("Database query failed");
        }
        return response.status(200).send(result);
      });
    } catch (error) {
      console.log(error);
      return response.status(500).send("Database query failed");
    }
  },

  SearchFetteRecord1: async (request, response) => {
    const { data } = request.query;
    const area = "mezanine.tengah_EBR_FetteLine1_data"; // Static value

    const getAllColumns = () => {
      return new Promise((resolve, reject) => {
        const query = `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'parammachine_saka'
        AND TABLE_NAME = ?
        AND COLUMN_NAME NOT IN ('data_format_0')
      `;
        db3.query(query, [area], (err, results) => {
          if (err) return reject(err);
          const columns = results.map((result) => result.COLUMN_NAME);
          resolve(columns);
        });
      });
    };

    const getColumnMappings = () => {
      return new Promise((resolve, reject) => {
        const query = `
        SELECT data_format_index, comment
        FROM \`${area}_format\`
      `;
        db3.query(query, (err, results) => {
          if (err) return reject(err);
          resolve(results);
        });
      });
    };

    try {
      const columns = await getAllColumns();
      const columnMappings = await getColumnMappings();

      const mappedColumns = columns.map((col) => {
        const match = col.match(/data_format_(\d+)/);
        if (match) {
          const index = parseInt(match[1], 10);
          const mapping = columnMappings.find(
            (mapping) => mapping.data_format_index === index
          );
          if (mapping) {
            return `\`${col}\` AS \`${mapping.comment}\``;
          }
        }
        return `\`${col}\``;
      });

      const queryGet = `
      SELECT
        ${mappedColumns.join(", ")},
        CONVERT(\`data_format_0\` USING utf8) AS \`BATCH\`
      FROM
        \`parammachine_saka\`.\`${area}\`
      WHERE
        CONVERT(\`data_format_0\` USING utf8) LIKE ?
      ORDER BY
        DATE(FROM_UNIXTIME(\`time@timestamp\`)) ASC;
    `;

      db3.query(queryGet, [`%${data}%`], (err, result) => {
        if (err) {
          console.log(err);
          return response.status(500).send("Database query failed");
        }
        return response.status(200).send(result);
      });
    } catch (error) {
      console.log(error);
      return response.status(500).send("Database query failed");
    }
  },

  /* Old Backend PMA3
  SearchPMARecord3: async (request, response) => {
    const { data } = request.query;
    const pmaArea = "cMT-GEA-L3_EBR_PMA_L3_data";
    const wetArea = "cMT-GEA-L3_EBR_WETMILL_data";

    const getMappedColumns = (area, excludeCols = []) => {
      return new Promise((resolve, reject) => {
        const queryCols = `
          SELECT COLUMN_NAME
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = 'parammachine_saka'
            AND TABLE_NAME = ?
            AND COLUMN_NAME NOT IN (${excludeCols.map(() => "?").join(", ")})
        `;
        const queryMap = `
          SELECT data_format_index, comment FROM \`${area}_format\`
        `;
        db3.query(queryCols, [area, ...excludeCols], (err, colResults) => {
          if (err) return reject(err);
          db3.query(queryMap, (err2, mapResults) => {
            if (err2) return reject(err2);

            const columns = colResults.map(({ COLUMN_NAME }) => {
              const match = COLUMN_NAME.match(/data_format_(\d+)/);
              if (match) {
                const index = parseInt(match[1], 10);
                const mapping = mapResults.find(
                  (m) => m.data_format_index === index
                );
                if (mapping) {
                  return `\`${area}\`.\`${COLUMN_NAME}\` AS \`${mapping.comment}\``;
                }
              }
              return `\`${area}\`.\`${COLUMN_NAME}\``;
            });

            resolve(columns);
          });
        });
      });
    };

    try {
      const [pmaColumns, wetColumns] = await Promise.all([
        getMappedColumns(pmaArea, [
          "data_format_0",
          "data_format_1",
          "time@timestamp",
          "data_index",
        ]),
        getMappedColumns(wetArea, [
          "data_format_0",
          "time@timestamp",
          "data_index",
        ]),
      ]);

      const query = `
        SELECT 
          DATE_FORMAT(FROM_UNIXTIME(FLOOR(\`${pmaArea}\`.\`time@timestamp\`)), '%Y-%m-%d %H:%i') AS PMA_time,
          ${pmaColumns.join(",")},
          CONVERT(\`${pmaArea}\`.\`data_format_0\` USING utf8) AS PMA_BATCH,
          CONVERT(\`${pmaArea}\`.\`data_format_1\` USING utf8) AS PMA_PROCESS,

          DATE_FORMAT(FROM_UNIXTIME(FLOOR(\`${wetArea}\`.\`time@timestamp\`)), '%Y-%m-%d %H:%i') AS WET_time,
          ${wetColumns.join(",")},
          CONVERT(\`${wetArea}\`.\`data_format_0\` USING utf8) AS WET_PROCESS

        FROM \`parammachine_saka\`.\`${pmaArea}\`
        LEFT JOIN \`parammachine_saka\`.\`${wetArea}\`
          ON ABS(\`${pmaArea}\`.\`time@timestamp\` - \`${wetArea}\`.\`time@timestamp\`) <= 60
        WHERE
          CONVERT(\`${pmaArea}\`.\`data_format_0\` USING utf8) LIKE ?
        ORDER BY \`${pmaArea}\`.\`time@timestamp\` ASC;
      `;

      //console.log(query);
      db3.query(query, [`%${data}%`], (err, result) => {
        if (err) {
          console.error(err);
          return response.status(500).send("Database query failed");
        }
        return response.status(200).send(result);
      });
    } catch (err) {
      console.error(err);
      return response.status(500).send("Error combining PMA & WET data");
    }
  }, 
  */

 SearchPMARecord3: async (request, response) => {
    const { data, start, finish } = request.query;
    console.log("🔍 SearchPMARecord3 DEBUG - Received request");
    console.log("  data:", data);
    console.log("  start:", start);
    console.log("  finish:", finish);
    
    if (!data) {
      console.log("❌ SearchPMARecord3 ERROR - Batch data is required");
      return response.status(400).send({ error: "Batch data is required" });
    }
    
    const pmaArea = "cMT-GEA-L3_EBR_PMA_L3_data";
    const wetArea = "cMT-GEA-L3_EBR_WETMILL_data";

    const getMappedColumns = (area, excludeCols = []) => {
      return new Promise((resolve, reject) => {
        const queryCols = `
          SELECT COLUMN_NAME
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = 'parammachine_saka'
            AND TABLE_NAME = ?
            AND COLUMN_NAME NOT IN (${excludeCols.map(() => "?").join(", ")})
        `;
        const queryMap = `
          SELECT data_format_index, comment FROM \`${area}_format\`
        `;
        console.log("📋 Fetching columns for:", area);
        db3.query(queryCols, [area, ...excludeCols], (err, colResults) => {
          if (err) {
            console.error("❌ Column fetch error:", err);
            return reject(err);
          }
          console.log("  Found columns:", colResults ? colResults.length : 0);
          db3.query(queryMap, (err2, mapResults) => {
            if (err2) {
              console.error("❌ Format mapping error:", err2);
              return reject(err2);
            }
            console.log("  Found mappings:", mapResults ? mapResults.length : 0);

            const columns = colResults.map(({ COLUMN_NAME }) => {
              const match = COLUMN_NAME.match(/data_format_(\d+)/);
              if (match) {
                const index = parseInt(match[1], 10);
                const mapping = mapResults.find(
                  (m) => m.data_format_index === index
                );
                if (mapping) {
                  return `\`${area}\`.\`${COLUMN_NAME}\` AS \`${mapping.comment}\``;
                }
              }
              return `\`${area}\`.\`${COLUMN_NAME}\``;
            });

            resolve(columns);
          });
        });
      });
    };

    try {
      console.log("📝 Fetching dynamic columns...");
      const [pmaColumns, wetColumns] = await Promise.all([
        getMappedColumns(pmaArea, [
          "data_format_0",
          "data_format_1",
          "time@timestamp",
          "data_index",
        ]),
        getMappedColumns(wetArea, [
          "data_format_0",
          "time@timestamp",
          "data_index",
        ]),
      ]);
      
      // console.log("✅ Columns fetched successfully");
      // console.log("  PMA columns:", pmaColumns.length);
      // console.log("  WET columns:", wetColumns.length);

      const query = `
        SELECT 
          DATE_FORMAT(FROM_UNIXTIME(FLOOR(\`${pmaArea}\`.\`time@timestamp\`)), '%Y-%m-%d %H:%i') AS PMA_time,
          ${pmaColumns.join(", ")},
          CAST(\`${pmaArea}\`.\`data_format_0\` AS CHAR) AS PMA_BATCH,
          CAST(\`${pmaArea}\`.\`data_format_1\` AS CHAR) AS PMA_PROCESS,

          DATE_FORMAT(FROM_UNIXTIME(FLOOR(\`${wetArea}\`.\`time@timestamp\`)), '%Y-%m-%d %H:%i') AS WET_time,
          ${wetColumns.join(", ")},
          CAST(\`${wetArea}\`.\`data_format_0\` AS CHAR) AS WET_PROCESS

        FROM \`parammachine_saka\`.\`${pmaArea}\`
        LEFT JOIN \`parammachine_saka\`.\`${wetArea}\`
          ON ABS(\`${pmaArea}\`.\`time@timestamp\` - \`${wetArea}\`.\`time@timestamp\`) <= 60
        WHERE
          CAST(\`${pmaArea}\`.\`data_format_0\` AS CHAR) LIKE ?
          AND DATE(FROM_UNIXTIME(\`${pmaArea}\`.\`time@timestamp\`)) BETWEEN ? AND ?
        ORDER BY \`${pmaArea}\`.\`time@timestamp\` ASC;
      `;

      console.log("📝 SearchPMARecord3 QUERY:");
      console.log(query);
      console.log("📋 Parameters: [%"+data+"%,", start, ",", finish, "]");

      const result = await new Promise((resolve, reject) => {
        console.log("🔌 Executing query with db3 connection...");
        db3.query(query, [`%${data}%`, start, finish], (err, result) => {
          if (err) {
            console.error("❌ Database Error:", err);
            console.error("  Error Code:", err.code);
            console.error("  Error Message:", err.message);
            return reject(err);
          }
          console.log("✅ Query successful! Rows returned:", result ? result.length : 0);
          if (result && result.length > 0) {
            console.log("  First row keys:", Object.keys(result[0]));
            console.log("  First row sample:", result[0]);
          }
          resolve(result);
        });
      });
      return response.status(200).send(result);
    } catch (error) {
      console.error("❌ SearchPMARecord3 CATCH ERROR:", error);
      return response.status(500).send("Database query failed: " + error.message);
    }
  }, 

  /* FBD3 Old Backend
  SearchFBDRecord3: async (request, response) => {
    const { data } = request.query;
    const area = "cMT-GEA-L3_Data_FBD_L3_data";

    const getAllColumns = () => {
      return new Promise((resolve, reject) => {
        const query = `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'parammachine_saka'
        AND TABLE_NAME = ?
        AND COLUMN_NAME NOT IN ('data_format_0')
      `;
        db3.query(query, [area], (err, results) => {
          if (err) return reject(err);
          const columns = results.map((result) => result.COLUMN_NAME);
          resolve(columns);
        });
      });
    };

    const getColumnMappings = () => {
      return new Promise((resolve, reject) => {
        const query = `
        SELECT data_format_index, comment
        FROM \`${area}_format\`
      `;
        db.query(query, (err, results) => {
          if (err) return reject(err);
          resolve(results);
        });
      });
    };

    try {
      const columns = await getAllColumns();
      const columnMappings = await getColumnMappings();

      const mappedColumns = columns.map((col) => {
        const match = col.match(/data_format_(\d+)/);
        if (match) {
          const index = parseInt(match[1], 10);
          const mapping = columnMappings.find(
            (mapping) => mapping.data_format_index === index
          );
          if (mapping) {
            return `\`${col}\` AS \`${mapping.comment}\``;
          }
        }
        return `\`${col}\``;
      });

      const queryGet = `
      SELECT
        ${mappedColumns.join(", ")},
        CONVERT(\`data_format_0\` USING utf8) AS \`BATCH\`
        FROM
        \`parammachine_saka\`.\`${area}\`
      WHERE
        CONVERT(\`data_format_0\` USING utf8) LIKE ?
      ORDER BY
        DATE(FROM_UNIXTIME(\`time@timestamp\`)) ASC;
    `;
      db.query(queryGet, [`%${data}%`], (err, result) => {
        if (err) {
          console.log(err);
          return response.status(500).send("Database query failed");
        }
        return response.status(200).send(result);
      });
    } catch (error) {
      console.log(error);
      return response.status(500).send("Database query failed");
    }
  },

  EPH Old Backend
  SearchEPHRecord3: async (request, response) => {
    const { data } = request.query;
    const area = "cMT-GEA-L3_EBR_EPH_L3_data";

    const getAllColumns = () => {
      return new Promise((resolve, reject) => {
        const query = `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'parammachine_saka'
        AND TABLE_NAME = ?
        AND COLUMN_NAME NOT IN ('data_format_0')
      `;
        db.query(query, [area], (err, results) => {
          if (err) return reject(err);
          const columns = results.map((result) => result.COLUMN_NAME);
          resolve(columns);
        });
      });
    };

    const getColumnMappings = () => {
      return new Promise((resolve, reject) => {
        const query = `
        SELECT data_format_index, comment
        FROM \`${area}_format\`
      `;
        db.query(query, (err, results) => {
          if (err) return reject(err);
          resolve(results);
        });
      });
    };

    try {
      const columns = await getAllColumns();
      const columnMappings = await getColumnMappings();

      const mappedColumns = columns.map((col) => {
        const match = col.match(/data_format_(\d+)/);
        if (match) {
          const index = parseInt(match[1], 10);
          const mapping = columnMappings.find(
            (mapping) => mapping.data_format_index === index
          );
          if (mapping) {
            return `\`${col}\` AS \`${mapping.comment}\``;
          }
        }
        return `\`${col}\``;
      });

      const queryGet = `
      SELECT
        ${mappedColumns.join(", ")},
        CONVERT(\`data_format_0\` USING utf8) AS \`BATCH\`
        FROM
        \`parammachine_saka\`.\`${area}\`
      WHERE
        CONVERT(\`data_format_0\` USING utf8) LIKE ?
      ORDER BY
        DATE(FROM_UNIXTIME(\`time@timestamp\`)) ASC;
    `;
      db.query(queryGet, [`%${data}%`], (err, result) => {
        if (err) {
          console.log(err);
          return response.status(500).send("Database query failed");
        }
        return response.status(200).send(result);
      });
    } catch (error) {
      console.log(error);
      return response.status(500).send("Database query failed");
    }
  },
  */

    // FBD New Backend Line 3
    SearchFBDRecord3: async (request, response) => {
    const { data, start, finish } = request.query;
    if (!data) {
      return response.status(400).send({ error: "Batch data is required" });
    }
    
    const fbdArea = "cMT-GEA-L3_EBR_FBD_L3_data";

    const getMappedColumns = (area, excludeCols = []) => {
      return new Promise((resolve, reject) => {
        const queryCols = `
          SELECT COLUMN_NAME
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = 'parammachine_saka'
            AND TABLE_NAME = ?
            AND COLUMN_NAME NOT IN (${excludeCols.map(() => "?").join(", ")})
        `;
        const queryMap = `
          SELECT data_format_index, comment FROM \`${area}_format\`
        `;
        db3.query(queryCols, [area, ...excludeCols], (err, colResults) => {
          if (err) return reject(err);
          db3.query(queryMap, (err2, mapResults) => {
            if (err2) return reject(err2);

            const columns = colResults.map(({ COLUMN_NAME }) => {
              const match = COLUMN_NAME.match(/data_format_(\d+)/);
              if (match) {
                const index = parseInt(match[1], 10);
                const mapping = mapResults.find(
                  (m) => m.data_format_index === index
                );
                if (mapping) {
                  return `\`${COLUMN_NAME}\` AS \`${mapping.comment}\``;
                }
              }
              return `\`${COLUMN_NAME}\``;
            });

            resolve(columns);
          });
        });
      });
    };

    try {
      const fbdColumns = await getMappedColumns(fbdArea, [
        "data_format_0",
        "time@timestamp",
        "data_index",
      ]);

      const query = `
        SELECT 
          DATE_FORMAT(FROM_UNIXTIME(FLOOR(\`time@timestamp\`)), '%Y-%m-%d %H:%i') AS FBD_time,
          ${fbdColumns.join(", ")},
          CAST(\`data_format_0\` AS CHAR) AS FBD_BATCH
        FROM \`parammachine_saka\`.\`${fbdArea}\`
        WHERE
          CAST(\`data_format_0\` AS CHAR) LIKE ?
          AND DATE(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN ? AND ?
        ORDER BY \`time@timestamp\` ASC;
      `;

      const result = await new Promise((resolve, reject) => {
        db3.query(query, [`%${data}%`, start, finish], (err, result) => {
          if (err) return reject(err);
          resolve(result);
        });
      });
      return response.status(200).send(result);
    } catch (error) {
      console.error(error);
      return response.status(500).send("Database query failed: " + error.message);
    }
  },

    // EPH New Backend Line 3
  SearchEPHRecord3: async (request, response) => {
    const { data, start, finish } = request.query;
    if (!data) {
      return response.status(400).send({ error: "Batch data is required" });
    }
    
    const ephArea = "cMT-GEA-L3_EBR_EPH_L3_data";

    const getMappedColumns = (area, excludeCols = []) => {
      return new Promise((resolve, reject) => {
        const queryCols = `
          SELECT COLUMN_NAME
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = 'parammachine_saka'
            AND TABLE_NAME = ?
            AND COLUMN_NAME NOT IN (${excludeCols.map(() => "?").join(", ")})
        `;
        const queryMap = `
          SELECT data_format_index, comment FROM \`${area}_format\`
        `;
        db3.query(queryCols, [area, ...excludeCols], (err, colResults) => {
          if (err) return reject(err);
          db3.query(queryMap, (err2, mapResults) => {
            if (err2) return reject(err2);

            const columns = colResults.map(({ COLUMN_NAME }) => {
              const match = COLUMN_NAME.match(/data_format_(\d+)/);
              if (match) {
                const index = parseInt(match[1], 10);
                const mapping = mapResults.find(
                  (m) => m.data_format_index === index
                );
                if (mapping) {
                  return `\`${COLUMN_NAME}\` AS \`${mapping.comment}\``;
                }
              }
              return `\`${COLUMN_NAME}\``;
            });

            resolve(columns);
          });
        });
      });
    };

    try {
      const ephColumns = await getMappedColumns(ephArea, [
        "data_format_0",
        "time@timestamp",
        "data_index",
      ]);

      const query = `
        SELECT 
          DATE_FORMAT(FROM_UNIXTIME(FLOOR(\`time@timestamp\`)), '%Y-%m-%d %H:%i') AS EPH_time,
          ${ephColumns.join(", ")},
          CAST(\`data_format_0\` AS CHAR) AS EPH_BATCH
        FROM \`parammachine_saka\`.\`${ephArea}\`
        WHERE
          CAST(\`data_format_0\` AS CHAR) LIKE ?
          AND DATE(FROM_UNIXTIME(\`time@timestamp\`)) BETWEEN ? AND ?
        ORDER BY \`time@timestamp\` ASC;
      `;

      const result = await new Promise((resolve, reject) => {
        db3.query(query, [`%${data}%`, start, finish], (err, result) => {
          if (err) return reject(err);
          resolve(result);
        });
      });
      return response.status(200).send(result);
    } catch (error) {
      console.error(error);
      return response.status(500).send("Database query failed: " + error.message);
    }
  },

  SearchHMRecord3: async (request, response) => {
    const { data } = request.query;
    const area = "cMT-GEA-L3_EBR_EPH_L3_data";

    const getAllColumns = () => {
      return new Promise((resolve, reject) => {
        const query = `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'parammachine_saka'
        AND TABLE_NAME = ?
        AND COLUMN_NAME NOT IN ('data_format_0')
      `;
        db.query(query, [area], (err, results) => {
          if (err) return reject(err);
          const columns = results.map((result) => result.COLUMN_NAME);
          resolve(columns);
        });
      });
    };

    const getColumnMappings = () => {
      return new Promise((resolve, reject) => {
        const query = `
        SELECT data_format_index, comment
        FROM \`${area}_format\`
      `;
        db.query(query, (err, results) => {
          if (err) return reject(err);
          resolve(results);
        });
      });
    };

    try {
      const columns = await getAllColumns();
      const columnMappings = await getColumnMappings();

      const mappedColumns = columns.map((col) => {
        const match = col.match(/data_format_(\d+)/);
        if (match) {
          const index = parseInt(match[1], 10);
          const mapping = columnMappings.find(
            (mapping) => mapping.data_format_index === index
          );
          if (mapping) {
            return `\`${col}\` AS \`${mapping.comment}\``;
          }
        }
        return `\`${col}\``;
      });

      const queryGet = `
      SELECT
        ${mappedColumns.join(", ")},
        CONVERT(\`data_format_0\` USING utf8) AS \`BATCH\`
        FROM
        \`parammachine_saka\`.\`${area}\`
      WHERE
        CONVERT(\`data_format_0\` USING utf8) LIKE ?
      ORDER BY
        DATE(FROM_UNIXTIME(\`time@timestamp\`)) ASC;
    `;
      db.query(queryGet, [`%${data}%`], (err, result) => {
        if (err) {
          console.log(err);
          return response.status(500).send("Database query failed");
        }
        return response.status(200).send(result);
      });
    } catch (error) {
      console.log(error);
      return response.status(500).send("Database query failed");
    }
  },

  //==============CRUD CRUD PORTAL========================================CRUD CRUD PORTAL==========================================
  //PARAMETER PORTAL ENJOY

  //create
  CreateParameter: async (request, response) => {
    const {
      Parameter_Air,
      Parameter_Gas,
      Parameter_Listrik,
      Parameter_Air_2,
      Parameter_Gas_2,
      Parameter_Listrik_2,
      Parameter_Out_1,
      Parameter_Out_2,
      Parameter_Out_3,
      Parameter_Out_4,
      Parameter_Out_5,
      Created_date,
      Created_time,
      User,
    } = request.body;

    const insertQuery = `INSERT INTO ems_saka.Parameter_Portal 
                       (Parameter_Air, Parameter_Gas, Parameter_Listrik, Parameter_Air_2, Parameter_Gas_2, Parameter_Listrik_2, 
                        Parameter_Out_1, Parameter_Out_2, Parameter_Out_3, 
                        Parameter_Out_4, Parameter_Out_5, Created_date, Created_time, User) 
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const insertValues = [
      Parameter_Air,
      Parameter_Gas,
      Parameter_Listrik,
      Parameter_Air_2,
      Parameter_Gas_2,
      Parameter_Listrik_2,
      Parameter_Out_1,
      Parameter_Out_2,
      Parameter_Out_3,
      Parameter_Out_4,
      Parameter_Out_5,
      Created_date,
      Created_time,
      User,
    ];

    db4.query(insertQuery, insertValues, (err, result) => {
      if (err) {
        return response.status(400).send(err.message);
      } else {
        // Query untuk fetch data
        const fetchQuery =
          "SELECT * FROM ems_saka.Parameter_Portal ORDER BY id DESC LIMIT 1;";
        db4.query(fetchQuery, (err, result) => {
          if (err) {
            return response.status(400).send(err.message);
          } else {
            return response
              .status(200)
              .send({ message: "Data successfully added" });
          }
        });
      }
    });
  },

  //GET
  GetParameter: async (request, response) => {
    var fatchquerry = `SELECT * FROM ems_saka.Parameter_Portal ORDER BY id DESC LIMIT 1;`;
    // console.log("====================================");
    // console.log("test bro");
    // console.log("====================================");
    db4.query(fatchquerry, (err, result) => {
      return response.status(200).send(result);
    });
  },

  //JAM PORTAL ENJOY

  //create
  CreateJam: async (request, response) => {
    const {
      Jam_Listrik_1,
      Jam_Listrik_2,
      Jam_Listrik_3,
      Jam_Listrik_4,
      Jam_Gas_1,
      Jam_Gas_2,
      Jam_Gas_3,
      Jam_Gas_4,
      Jam_Air_1,
      Jam_Air_2,
      Jam_Air_3,
      Jam_Air_4,
      Created_date,
      Created_time,
      User,
    } = request.body;

    const insertQuery = `INSERT INTO ems_saka.Jam_Portal 
                       (Jam_Listrik_1, Jam_Listrik_2, Jam_Listrik_3, 
                        Jam_Listrik_4, Jam_Gas_1, Jam_Gas_2, Jam_Gas_3, Jam_Gas_4, Jam_Air_1, Jam_Air_2, Jam_Air_3, Jam_Air_4,  
                        Created_date, Created_time, User) 
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const insertValues = [
      Jam_Listrik_1,
      Jam_Listrik_2,
      Jam_Listrik_3,
      Jam_Listrik_4,
      Jam_Gas_1,
      Jam_Gas_2,
      Jam_Gas_3,
      Jam_Gas_4,
      Jam_Air_1,
      Jam_Air_2,
      Jam_Air_3,
      Jam_Air_4,
      Created_date,
      Created_time,
      User,
    ];
    db4.query(insertQuery, insertValues, (err, result) => {
      if (err) {
        return response.status(400).send(err.message);
      } else {
        // Query untuk fetch data
        const fetchQuery = "SELECT * FROM ems_saka.Jam_Portal";
        db4.query(fetchQuery, (err, result) => {
          if (err) {
            return response.status(400).send(err.message);
          } else {
            return response
              .status(200)
              .send({ message: "Data successfully added" });
          }
        });
      }
    });
  },

  //GET
  GetJam: async (request, response) => {
    var fatchquerry = `SELECT * FROM ems_saka.Jam_Portal ORDER BY id DESC LIMIT 1;`;

    db4.query(fatchquerry, (err, result) => {
      return response.status(200).send(result);
    });
  },

  //LIMIT PORTAL ENJOY

  //create
  CreateLimit: async (request, response) => {
    const {
      Limit_Listrik,
      Limit_Gas,
      Limit_Air,
      Created_date,
      Created_time,
      User,
    } = request.body;

    const insertQuery = `INSERT INTO ems_saka.Limit_Portal 
                       (Limit_Listrik, Limit_Gas, Limit_Air, 
                        Created_date, Created_time, User) 
                       VALUES (?, ?, ?, ?, ?, ?)`;

    const insertValues = [
      Limit_Listrik,
      Limit_Gas,
      Limit_Air,
      Created_date,
      Created_time,
      User,
    ];
    db4.query(insertQuery, insertValues, (err, result) => {
      if (err) {
        return response.status(400).send(err.message);
      } else {
        // Query untuk fetch data
        const fetchQuery = "SELECT * FROM ems_saka.Limit_Portal";
        db4.query(fetchQuery, (err, result) => {
          if (err) {
            return response.status(400).send(err.message);
          } else {
            return response
              .status(200)
              .send({ message: "Data successfully added" });
          }
        });
      }
    });
  },

  //GET
  GetLimit: async (request, response) => {
    var fatchquerry = `SELECT * FROM ems_saka.Limit_Portal ORDER BY id DESC LIMIT 1;`;

    db4.query(fatchquerry, (err, result) => {
      return response.status(200).send(result);
    });
  },

  //==============TEST VALUE DATA DAILY========================================TEST VALUE DATA DAILY==========================================
  GetDailyVibrasi138: async (request, response) => {
    const fatchquerry = `

    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-VibrasiHVAC_2_Current_FT1.01_data\` FROM \`parammachine_saka\`.\`cMT-VibrasiHVAC_2_Current_FT1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-VibrasiHVAC_Data_AHU_E1.01_data\` FROM \`parammachine_saka\`.\`cMT-VibrasiHVAC_Data_AHU_E1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-VibrasiHVAC_Data_AHU_F1.01_data\` FROM \`parammachine_saka\`.\`cMT-VibrasiHVAC_Data_AHU_F1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-VibrasiHVAC_Data_AHU_F1.02_data\` FROM \`parammachine_saka\`.\`cMT-VibrasiHVAC_Data_AHU_F1.02_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-VibrasiHVAC_Data_AHU_FT1.01_data\` FROM \`parammachine_saka\`.\`cMT-VibrasiHVAC_Data_AHU_FT1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-VibrasiHVAC_Data_AHU_FT1.02_data\` FROM \`parammachine_saka\`.\`cMT-VibrasiHVAC_Data_AHU_FT1.02_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-VibrasiHVAC_Data_AHU_G1.01_data\` FROM \`parammachine_saka\`.\`cMT-VibrasiHVAC_Data_AHU_G1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-VibrasiHVAC_Data_AHU_G1.02_data\` FROM \`parammachine_saka\`.\`cMT-VibrasiHVAC_Data_AHU_G1.02_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-VibrasiHVAC_Data_AHU_LA2.01_data\` FROM \`parammachine_saka\`.\`cMT-VibrasiHVAC_Data_AHU_LA2.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-VibrasiHVAC_Data_AHU_MG1.01_data\` FROM \`parammachine_saka\`.\`cMT-VibrasiHVAC_Data_AHU_MG1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-VibrasiHVAC_Data_AHU_MG1.02_data\` FROM \`parammachine_saka\`.\`cMT-VibrasiHVAC_Data_AHU_MG1.02_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-VibrasiHVAC_Data_AHU_WG1.01_data\` FROM \`parammachine_saka\`.\`cMT-VibrasiHVAC_Data_AHU_WG1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-VibrasiHVAC_Data_AHU_WG1.02_data\` FROM \`parammachine_saka\`.\`cMT-VibrasiHVAC_Data_AHU_WG1.02_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-VibrasiHVAC_Data_RFU_FT1.01_data\` FROM \`parammachine_saka\`.\`cMT-VibrasiHVAC_Data_RFU_FT1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-VibrasiHVAC_Data_RFU_MG1.02_data\` FROM \`parammachine_saka\`.\`cMT-VibrasiHVAC_Data_RFU_MG1.02_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-VibrasiHVAC_M_Temp_FT1.01_data\` FROM \`parammachine_saka\`.\`cMT-VibrasiHVAC_M_Temp_FT1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-VibrasiHVAC_X_ACC_G_FT1.01_data\` FROM \`parammachine_saka\`.\`cMT-VibrasiHVAC_X_ACC_G_FT1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-VibrasiHVAC_X_AXISVCF_FT1.01_data\` FROM \`parammachine_saka\`.\`cMT-VibrasiHVAC_X_AXISVCF_FT1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-VibrasiHVAC_X_Axis_Ve_FT1.01_data\` FROM \`parammachine_saka\`.\`cMT-VibrasiHVAC_X_Axis_Ve_FT1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-VibrasiHVAC_XaxisRMS-S1_data\` FROM \`parammachine_saka\`.\`cMT-VibrasiHVAC_XaxisRMS-S1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-VibrasiHVAC_Z_ACC_G_FT1.01_data\` FROM \`parammachine_saka\`.\`cMT-VibrasiHVAC_Z_ACC_G_FT1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-VibrasiHVAC_Z_AXISVCF_FT1.01_data\` FROM \`parammachine_saka\`.\`cMT-VibrasiHVAC_Z_AXISVCF_FT1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-VibrasiHVAC_Z_AXIS_RM_FT1.01_data\` FROM \`parammachine_saka\`.\`cMT-VibrasiHVAC_Z_AXIS_RM_FT1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-VibrasiHVAC_ZaxisRMS-S1_data\` FROM \`parammachine_saka\`.\`cMT-VibrasiHVAC_ZaxisRMS-S1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;

    `;

    db3.query(fatchquerry, (err, result) => {
      if (err) {
        console.log(err);
        return response.status(500).send("Database query failed");
      }
      return response.status(200).send(result);
    });
  },

  GetDailyGedung138: async (request, response) => {
    const fatchquerry = `
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_Chiller1_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_Chiller1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_Chiller2_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_Chiller2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_Chiller3_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_Chiller3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_Fatigon_Detik_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_Fatigon_Detik_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_GCP_Genset_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_GCP_Genset_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_Inverter1-6_SP_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_Inverter1-6_SP_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_Inverter7-12_SP_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_Inverter7-12_SP_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_LP.2-PRO1.1_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_LP.2-PRO1.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_LP.2-PRO1.2_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_LP.2-PRO1.2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_LP.2-PRO1.3_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_LP.2-PRO1.3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_LP.2-PRO2.3_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_LP.2-PRO2.3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_LP.2-PRO3.1_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_LP.2-PRO3.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_LP.2-PRO4.1_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_LP.2-PRO4.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_LP.2-PRO 3.1 RND_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_LP.2-PRO 3.1 RND_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_LP.2MEZZ1.1_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_LP.2MEZZ1.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_LP.2WH1.1_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_LP.2WH1.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_LVMDP1_Detik_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_LVMDP1_Detik_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_LVMDP1_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_LVMDP1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_LVMDP2_Detik_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_LVMDP2_Detik_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_LVMDP2_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_LVMDP2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_MVMDP_Detik_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_MVMDP_Detik_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_MVMDP_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_MVMDP_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_Mixagrip_Detik_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_Mixagrip_Detik_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PP.1-AC1.1_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PP.1-AC1.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PP.1-AC1.2_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PP.1-AC1.2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PP.1-AC1.3_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PP.1-AC1.3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PP.1-AC2.3_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PP.1-AC2.3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PP.1-Boiler&PW_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PP.1-Boiler&PW_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PP.1-Chiller_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PP.1-Chiller_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PP.1-Genset_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PP.1-Genset_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PP.1-HWP_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PP.1-HWP_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PP.1-Kompressor_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PP.1-Kompressor_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PP.1-Lift_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PP.1-Lift_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PP.1-PUMPS_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PP.1-PUMPS_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PP.1AGV_WH1_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PP.1AGV_WH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PP.1AGV_WH2_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PP.1AGV_WH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PP.1WWTP_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PP.1WWTP_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PP.2-AC 3.1 RND_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PP.2-AC 3.1 RND_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PP.2-Fasilitas_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PP.2-Fasilitas_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PP.2-Fatigon_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PP.2-Fatigon_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PP.2-Hydrant_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PP.2-Hydrant_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PP.2-LabLt.2_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PP.2-LabLt.2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PP.2-Mixagrib_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PP.2-Mixagrib_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PP.2-PackWH_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PP.2-PackWH_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PP.2-Puyer_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PP.2-Puyer_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PP.2DumbWaiter_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PP.2DumbWaiter_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PP.2Pumpit_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PP.2Pumpit_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PP.Lab.Lt2_Detik_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PP.Lab.Lt2_Detik_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PPLP.1-UTY_Lt.1_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PPLP.1-UTY_Lt.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PPLP.1-UTY_Lt.2_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PPLP.1-UTY_Lt.2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PPLP.2-Koperasi_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PPLP.2-Koperasi_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PPLP.2-PosJaga1_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PPLP.2-PosJaga1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PPLP.2-PosJaga2_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PPLP.2-PosJaga2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PPLP.2-Workshop_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PPLP.2-Workshop_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_PPLP.2OfficeLt1_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_PPLP.2OfficeLt1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_Puyer_Detik_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_Puyer_Detik_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_SDP.1-Produksi_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_SDP.1-Produksi_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_SDP.1-Utility_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_SDP.1-Utility_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_SDP.2-Produksi_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_SDP.2-Produksi_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-Gedung-UTY_SDP_Genset_data\` FROM \`ems_saka\`.\`cMT-Gedung-UTY_SDP_Genset_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;

  `;
    console.log(fatchquerry);
    db3.query(fatchquerry, (err, result) => {
      if (err) {
        console.log(err);
        return response.status(500).send("Database query failed");
      }
      return response.status(200).send(result);
    });
  },

  GetDailyChiller138: async (request, response) => {
    const fetchquery = `
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-BodiChillerCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-BodiChillerCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-BodiChillerCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-BodiChillerCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-BodiChillerCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-BodiChillerCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-FanOutdorK1CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-FanOutdorK1CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-FanOutdorK1CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-FanOutdorK1CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-FanOutdorK1CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-FanOutdorK1CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-FanOutdrK2CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-FanOutdrK2CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-FanOutdrK2CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-FanOutdrK2CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-FanOutdrK2CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-FanOutdrK2CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-GlsExpVlvK1CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-GlsExpVlvK1CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-GlsExpVlvK1CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-GlsExpVlvK1CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-GlsExpVlvK1CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-GlsExpVlvK1CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-GlsExpVlvK2CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-GlsExpVlvK2CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-GlsExpVlvK2CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-GlsExpVlvK2CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-GlsExpVlvK2CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-GlsExpVlvK2CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-GroundAmperCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-GroundAmperCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-GroundAmperCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-GroundAmperCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-GroundAmperCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-GroundAmperCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-InletSoftCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-InletSoftCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-InletSoftCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-InletSoftCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-InletSoftCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-InletSoftCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-JamMonitorCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-JamMonitorCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-JamMonitorCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-JamMonitorCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-JamMonitorCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-JamMonitorCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-KisiKondenCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-KisiKondenCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-KisiKondenCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-KisiKondenCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-KisiKondenCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-KisiKondenCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-NamaOperCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-NamaOperCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-NamaOperCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-NamaOperCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-NamaOperCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-NamaOperCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-NamaSpvCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-NamaSpvCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-NamaSpvCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-NamaSpvCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-NamaSpvCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-NamaSpvCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-NamaTekCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-NamaTekCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-NamaTekCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-NamaTekCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-NamaTekCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-NamaTekCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-OlGlasAtsK2CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-OlGlasAtsK2CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-OlGlasAtsK2CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-OlGlasAtsK2CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-OlGlasAtsK2CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-OlGlasAtsK2CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-OliGlsAtsK1CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-OliGlsAtsK1CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-OliGlsAtsK1CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-OliGlsAtsK1CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-OliGlsAtsK1CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-OliGlsAtsK1CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-OliGlsBwhK1CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-OliGlsBwhK1CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-OliGlsBwhK1CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-OliGlsBwhK1CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-OliGlsBwhK1CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-OliGlsBwhK1CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-OliGlsBwhK2CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-OliGlsBwhK2CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-OliGlsBwhK2CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-OliGlsBwhK2CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-OliGlsBwhK2CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-OliGlsBwhK2CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-PrSesPomRetCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-PrSesPomRetCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-PrSesPomRetCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-PrSesPomRetCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-PrSesPomRetCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-PrSesPomRetCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-PreSebPmSupCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-PreSebPmSupCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-PreSebPmSupCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-PreSebPmSupCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-PreSebPmSupCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-PreSebPmSupCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-PreSebPomRtCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-PreSebPomRtCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-PreSebPomRtCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-PreSebPomRtCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-PreSebPomRtCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-PreSebPomRtCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-PreSesPomSpCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-PreSesPomSpCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-PreSesPomSpCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-PreSesPomSpCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-PreSesPomSpCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-PreSesPomSpCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-ShuSebPmSupCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-ShuSebPmSupCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-ShuSebPmSupCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-ShuSebPmSupCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-ShuSebPmSupCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-ShuSebPmSupCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-ShuSesPmSupCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-ShuSesPmSupCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-ShuSesPmSupCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-ShuSesPmSupCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-ShuSesPmSupCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-ShuSesPmSupCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-StatFanKondCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-StatFanKondCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-StatFanKondCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-StatFanKondCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-StatFanKondCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-StatFanKondCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-SuhSbPomRetCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-SuhSbPomRetCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-SuhSbPomRetCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-SuhSbPomRetCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-SuhSbPomRetCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-SuhSbPomRetCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-SuhSesPmRetCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-SuhSesPmRetCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-SuhSesPmRetCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-SuhSesPmRetCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-SuhSesPmRetCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-SuhSesPmRetCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-TknReturnCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-TknReturnCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-TknReturnCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-TknReturnCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-TknReturnCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-TknReturnCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-TknSupplyCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-TknSupplyCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-TknSupplyCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-TknSupplyCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_H-TknSupplyCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_H-TknSupplyCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_O-StatONPR1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_O-StatONPR1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_O-StatONPR2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_O-StatONPR2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_O-StatONPR3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_O-StatONPR3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_O-StatONPS1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_O-StatONPS1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_O-StatONPS2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_O-StatONPS2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_O-StatONPS3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_O-StatONPS3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-ActiSetpoiCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-ActiSetpoiCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-ActiSetpoiCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-ActiSetpoiCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-ActiSetpoiCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-ActiSetpoiCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-AlarmCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-AlarmCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-AlarmCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-AlarmCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-AlarmCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-AlarmCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-AmpereK1CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-AmpereK1CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-AmpereK1CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-AmpereK1CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-AmpereK1CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-AmpereK1CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-AmpereK2CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-AmpereK2CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-AmpereK2CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-AmpereK2CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-AmpereK2CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-AmpereK2CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-CapacityK1CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-CapacityK1CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-CapacityK1CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-CapacityK1CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-CapacityK1CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-CapacityK1CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-CapacityK2CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-CapacityK2CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-CapacityK2CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-CapacityK2CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-CapacityK2CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-CapacityK2CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-ConSatTemK1CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-ConSatTemK1CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-ConSatTemK1CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-ConSatTemK1CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-ConSatTemK1CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-ConSatTemK1CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-ConSatTemK2CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-ConSatTemK2CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-ConSatTemK2CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-ConSatTemK2CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-ConSatTemK2CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-ConSatTemK2CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-CondApproK1CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-CondApproK1CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-CondApproK1CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-CondApproK1CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-CondApproK1CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-CondApproK1CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-CondApproK2CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-CondApproK2CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-CondApproK2CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-CondApproK2CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-CondApproK2CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-CondApproK2CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-CondPressK1CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-CondPressK1CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-CondPressK1CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-CondPressK1CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-CondPressK1CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-CondPressK1CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-CondPressK2CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-CondPressK2CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-CondPressK2CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-CondPressK2CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-CondPressK2CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-CondPressK2CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-DischTempK1CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-DischTempK1CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-DischTempK1CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-DischTempK1CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-DischTempK1CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-DischTempK1CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-DischTempK2CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-DischTempK2CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-DischTempK2CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-DischTempK2CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-DischTempK2CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-DischTempK2CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-DischarSHK1CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-DischarSHK1CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-DischarSHK1CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-DischarSHK1CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-DischarSHK1CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-DischarSHK1CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-DischarSHK2CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-DischarSHK2CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-DischarSHK2CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-DischarSHK2CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-DischarSHK2CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-DischarSHK2CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EXVPositiK1CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EXVPositiK1CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EXVPositiK1CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EXVPositiK1CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EXVPositiK1CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EXVPositiK1CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EXVPositiK2CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EXVPositiK2CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EXVPositiK2CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EXVPositiK2CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EXVPositiK2CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EXVPositiK2CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvaDsgAppK1CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvaDsgAppK1CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvaDsgAppK1CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvaDsgAppK1CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvaDsgAppK1CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvaDsgAppK1CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvaDsgAppK2CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvaDsgAppK2CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvaDsgAppK2CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvaDsgAppK2CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvaDsgAppK2CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvaDsgAppK2CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvapApproK1CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvapApproK1CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvapApproK1CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvapApproK1CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvapApproK1CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvapApproK1CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvapApproK2CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvapApproK2CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvapApproK2CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvapApproK2CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvapApproK2CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvapApproK2CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvapEWTCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvapEWTCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvapEWTCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvapEWTCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvapEWTCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvapEWTCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvapLWTCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvapLWTCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvapLWTCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvapLWTCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvapLWTCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvapLWTCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvapPressK1CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvapPressK1CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvapPressK1CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvapPressK1CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvapPressK1CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvapPressK1CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvapPressK2CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvapPressK2CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvapPressK2CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvapPressK2CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvapPressK2CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvapPressK2CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvapSatTeK1CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvapSatTeK1CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvapSatTeK1CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvapSatTeK1CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvapSatTeK1CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvapSatTeK1CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvapSatTeK2CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvapSatTeK2CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvapSatTeK2CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvapSatTeK2CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-EvapSatTeK2CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-EvapSatTeK2CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-No.StartK1CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-No.StartK1CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-No.StartK1CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-No.StartK1CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-No.StartK1CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-No.StartK1CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-No.StartK2CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-No.StartK2CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-No.StartK2CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-No.StartK2CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-No.StartK2CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-No.StartK2CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-OilPresDfK1CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-OilPresDfK1CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-OilPresDfK1CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-OilPresDfK1CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-OilPresDfK1CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-OilPresDfK1CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-OilPresDfK2CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-OilPresDfK2CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-OilPresDfK2CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-OilPresDfK2CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-OilPresDfK2CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-OilPresDfK2CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-OilPressK1CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-OilPressK1CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-OilPressK1CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-OilPressK1CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-OilPressK1CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-OilPressK1CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-OilPressK2CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-OilPressK2CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-OilPressK2CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-OilPressK2CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-OilPressK2CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-OilPressK2CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-OutTempCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-OutTempCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-OutTempCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-OutTempCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-OutTempCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-OutTempCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-RunHourK1CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-RunHourK1CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-RunHourK1CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-RunHourK1CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-RunHourK1CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-RunHourK1CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-RunHourK2CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-RunHourK2CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-RunHourK2CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-RunHourK2CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-RunHourK2CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-RunHourK2CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-StatusCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-StatusCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-StatusCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-StatusCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-StatusCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-StatusCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-StatusK1CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-StatusK1CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-StatusK1CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-StatusK1CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-StatusK1CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-StatusK1CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-StatusK2CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-StatusK2CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-StatusK2CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-StatusK2CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-StatusK2CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-StatusK2CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-SuctiTempK1CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-SuctiTempK1CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-SuctiTempK1CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-SuctiTempK1CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-SuctiTempK1CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-SuctiTempK1CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-SuctiTempK2CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-SuctiTempK2CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-SuctiTempK2CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-SuctiTempK2CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-SuctiTempK2CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-SuctiTempK2CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-SuctionSHK1CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-SuctionSHK1CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-SuctionSHK1CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-SuctionSHK1CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-SuctionSHK1CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-SuctionSHK1CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-SuctionSHK2CH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-SuctionSHK2CH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-SuctionSHK2CH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-SuctionSHK2CH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-SuctionSHK2CH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-SuctionSHK2CH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-UnitCapCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-UnitCapCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-UnitCapCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-UnitCapCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_R-UnitCapCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_R-UnitCapCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_RP-AmpR-SCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_RP-AmpR-SCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_RP-AmpR-SCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_RP-AmpR-SCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_RP-AmpR-SCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_RP-AmpR-SCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_RP-AmpS-TCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_RP-AmpS-TCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_RP-AmpS-TCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_RP-AmpS-TCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_RP-AmpS-TCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_RP-AmpS-TCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_RP-AmpT-RCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_RP-AmpT-RCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_RP-AmpT-RCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_RP-AmpT-RCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_RP-AmpT-RCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_RP-AmpT-RCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_RP-TegR-SCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_RP-TegR-SCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_RP-TegR-SCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_RP-TegR-SCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_RP-TegR-SCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_RP-TegR-SCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_RP-TegS-TCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_RP-TegS-TCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_RP-TegS-TCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_RP-TegS-TCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_RP-TegS-TCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_RP-TegS-TCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_RP-TegT-RCH1_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_RP-TegT-RCH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_RP-TegT-RCH2_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_RP-TegT-RCH2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-Chiller-UTY3_RP-TegT-RCH3_data\` FROM \`parammachine_saka\`.\`CMT-DB-Chiller-UTY3_RP-TegT-RCH3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1; 
    `;

    //console.log(fetchquery);
    db3.query(fetchquery, (err, result) => {
      if (err) {
        console.log(err);
        return response.status(500).send("Database query failed");
      }
      return response.status(200).send(result);
    });
  },

  GetDailyBoiler138: async (request, response) => {
    const fatchquerry = `
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_BahanBakaBoiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_BahanBakaBoiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_BahanBakaBoiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_BahanBakaBoiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_BahanBakaBoiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_BahanBakaBoiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_BodiBoiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_BodiBoiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_BodiBoiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_BodiBoiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_BodiBoiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_BodiBoiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_Boiler1Gas_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_Boiler1Gas_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_Boiler1Solar_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_Boiler1Solar_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_Boiler2Gas_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_Boiler2Gas_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_Boiler2Solar_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_Boiler2Solar_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_Boiler3Gas_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_Boiler3Gas_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_Boiler3Solar_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_Boiler3Solar_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_CekBocorBoiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_CekBocorBoiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_CekBocorBoiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_CekBocorBoiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_CekBocorBoiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_CekBocorBoiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_ConductivBoiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_ConductivBoiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_ConductivBoiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_ConductivBoiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_ConductivBoiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_ConductivBoiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_FeedWaterBoiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_FeedWaterBoiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_FeedWaterBoiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_FeedWaterBoiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_FeedWaterBoiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_FeedWaterBoiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_GasB-EffBoiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_GasB-EffBoiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_GasB-EffBoiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_GasB-EffBoiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_GasB-EffBoiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_GasB-EffBoiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_GasFuelCoBoiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_GasFuelCoBoiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_GasFuelCoBoiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_GasFuelCoBoiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_GasFuelCoBoiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_GasFuelCoBoiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_HardSoft1Boiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_HardSoft1Boiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_HardSoft1Boiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_HardSoft1Boiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_HardSoft1Boiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_HardSoft1Boiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_HardSoft2Boiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_HardSoft2Boiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_HardSoft2Boiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_HardSoft2Boiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_HardSoft2Boiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_HardSoft2Boiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_HourMeterBoiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_HourMeterBoiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_HourMeterBoiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_HourMeterBoiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_HourMeterBoiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_HourMeterBoiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_IgnicountBoiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_IgnicountBoiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_IgnicountBoiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_IgnicountBoiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_IgnicountBoiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_IgnicountBoiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_JamMonitoBoiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_JamMonitoBoiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_JamMonitoBoiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_JamMonitoBoiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_JamMonitoBoiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_JamMonitoBoiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_LvlChemicBoiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_LvlChemicBoiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_LvlChemicBoiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_LvlChemicBoiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_LvlChemicBoiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_LvlChemicBoiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_NamUtySpvBoiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_NamUtySpvBoiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_NamUtySpvBoiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_NamUtySpvBoiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_NamUtySpvBoiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_NamUtySpvBoiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_NamaOperaBoiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_NamaOperaBoiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_NamaOperaBoiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_NamaOperaBoiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_NamaOperaBoiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_NamaOperaBoiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_NamaOperator4_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_NamaOperator4_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_NamaTekniBoiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_NamaTekniBoiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_NamaTekniBoiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_NamaTekniBoiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_NamaTekniBoiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_NamaTekniBoiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_OilB-EffBoiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_OilB-EffBoiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_OilB-EffBoiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_OilB-EffBoiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_OilB-EffBoiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_OilB-EffBoiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_OilFuelCoBoiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_OilFuelCoBoiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_OilFuelCoBoiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_OilFuelCoBoiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_OilFuelCoBoiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_OilFuelCoBoiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_OilPressBoiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_OilPressBoiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_OilPressBoiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_OilPressBoiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_OilPressBoiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_OilPressBoiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_PresSoft1Boiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_PresSoft1Boiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_PresSoft1Boiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_PresSoft1Boiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_PresSoft1Boiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_PresSoft1Boiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_PresSoft2Boiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_PresSoft2Boiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_PresSoft2Boiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_PresSoft2Boiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_PresSoft2Boiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_PresSoft2Boiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_RegeSoft1Boiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_RegeSoft1Boiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_RegeSoft1Boiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_RegeSoft1Boiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_RegeSoft1Boiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_RegeSoft1Boiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_RegeSoft2Boiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_RegeSoft2Boiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_RegeSoft2Boiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_RegeSoft2Boiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_RegeSoft2Boiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_RegeSoft2Boiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_StatusBoiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_StatusBoiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_StatusBoiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_StatusBoiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_StatusBoiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_StatusBoiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_SteamOutBoiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_SteamOutBoiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_SteamOutBoiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_SteamOutBoiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_SteamOutBoiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_SteamOutBoiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_SteamPresBoiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_SteamPresBoiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_SteamPresBoiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_SteamPresBoiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_SteamPresBoiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_SteamPresBoiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_StockChemBoiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_StockChemBoiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_StockChemBoiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_StockChemBoiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_StockChemBoiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_StockChemBoiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_SurfaBlowBoiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_SurfaBlowBoiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_SurfaBlowBoiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_SurfaBlowBoiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_SurfaBlowBoiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_SurfaBlowBoiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_TankCondeBoiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_TankCondeBoiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_TankCondeBoiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_TankCondeBoiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_TankCondeBoiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_TankCondeBoiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_TankSolarBoiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_TankSolarBoiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_TankSolarBoiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_TankSolarBoiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_TankSolarBoiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_TankSolarBoiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_TankiSolarBoiler_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_TankiSolarBoiler_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_TankiSolarGenset_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_TankiSolarGenset_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_TankiSolarHydrant_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_TankiSolarHydrant_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_TankiSolarUtama1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_TankiSolarUtama1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_TankiSolarUtama2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_TankiSolarUtama2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_ToNeBlowBoiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_ToNeBlowBoiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_ToNeBlowBoiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_ToNeBlowBoiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_ToNeBlowBoiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_ToNeBlowBoiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_ToNeSootBoiler1_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_ToNeSootBoiler1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_ToNeSootBoiler2_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_ToNeSootBoiler2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_ToNeSootBoiler3_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_ToNeSootBoiler3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_TotBoilerm3N_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_TotBoilerm3N_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_TotBoilermmbtu_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_TotBoilermmbtu_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_TotEffGasBoil_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_TotEffGasBoil_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_TotEffSolarBoi_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_TotEffSolarBoi_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-BOILER-UTY_TotOutSteamBoil_data\` FROM parammachine_saka.\`cMT-DB-BOILER-UTY_TotOutSteamBoil_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    `;

    db4.query(fatchquerry, (err, result) => {
      if (err) {
        console.log(err);
        return response.status(500).send("Database query failed");
      }
      return response.status(200).send(result);
    });
  },

  GetDailyInstrumentIPC: async (request, response) => {
    const fatchquerry = `
    SELECT created_date AS Tanggal_Moisture FROM sakaplant_prod_ipc_ma_staging ORDER BY id_setup DESC LIMIT 1;
    SELECT created_date AS Tanggal_Sartorius FROM sakaplant_prod_ipc_scale_staging ORDER BY id_setup DESC LIMIT 1;
    `;
    db4.query(fatchquerry, (err, result) => {
      if (err) {
        console.log(err);
        return response.status(500).send("Database query failed");
      }
      return response.status(200).send(result);
    });
  },

  GetDailyHVAC55: async (request, response) => {
    const fatchquerry = ` 
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-HVAC-LINE-A_ F6 AHU 3.01 His_data\` FROM \`parammachine_saka\`.\`cMT-HVAC-LINE-A_ F6 AHU 3.01 His_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-HVAC-LINE-A_ F6 AHU 3.02 His_data\` FROM \`parammachine_saka\`.\`cMT-HVAC-LINE-A_ F6 AHU 3.02 His_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-HVAC-LINE-A_ F9 AHU 3.01 His_data\` FROM \`parammachine_saka\`.\`cMT-HVAC-LINE-A_ F9 AHU 3.01 His_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-HVAC-LINE-A_ F9 AHU 3.02 His_data\` FROM \`parammachine_saka\`.\`cMT-HVAC-LINE-A_ F9 AHU 3.02 His_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-HVAC-LINE-A_DP F6 AHU 3.01_data\` FROM \`parammachine_saka\`.\`cMT-HVAC-LINE-A_DP F6 AHU 3.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-HVAC-LINE-A_DP F6 AHU 3.02_data\` FROM \`parammachine_saka\`.\`cMT-HVAC-LINE-A_DP F6 AHU 3.02_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-HVAC-LINE-A_DP F9 AHU 3.01_data\` FROM \`parammachine_saka\`.\`cMT-HVAC-LINE-A_DP F9 AHU 3.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-HVAC-LINE-A_DP F9 AHU 3.02_data\` FROM \`parammachine_saka\`.\`cMT-HVAC-LINE-A_DP F9 AHU 3.02_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-HVAC-LINE-A_DP H13 AHU 3.01_data\` FROM \`parammachine_saka\`.\`cMT-HVAC-LINE-A_DP H13 AHU 3.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-HVAC-LINE-A_DP H13 AHU 3.02_data\` FROM \`parammachine_saka\`.\`cMT-HVAC-LINE-A_DP H13 AHU 3.02_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-HVAC-LINE-A_EMS_LINA_HMI-01_data\` FROM \`parammachine_saka\`.\`cMT-HVAC-LINE-A_EMS_LINA_HMI-01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-HVAC-LINE-A_EMS_LINA_HMI-02_data\` FROM \`parammachine_saka\`.\`cMT-HVAC-LINE-A_EMS_LINA_HMI-02_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-HVAC-LINE-A_EMS_LINA_HMI-03_data\` FROM \`parammachine_saka\`.\`cMT-HVAC-LINE-A_EMS_LINA_HMI-03_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-HVAC-LINE-A_EMS_LINA_HMI-04_data\` FROM \`parammachine_saka\`.\`cMT-HVAC-LINE-A_EMS_LINA_HMI-04_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-HVAC-LINE-A_EMS_LINA_HMI-05_data\` FROM \`parammachine_saka\`.\`cMT-HVAC-LINE-A_EMS_LINA_HMI-05_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-HVAC-LINE-A_EMS_LINA_HMI-06_data\` FROM \`parammachine_saka\`.\`cMT-HVAC-LINE-A_EMS_LINA_HMI-06_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-HVAC-LINE-A_EMS_LINA_HMI-07_data\` FROM \`parammachine_saka\`.\`cMT-HVAC-LINE-A_EMS_LINA_HMI-07_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-HVAC-LINE-A_EMS_LINA_HMI-08_data\` FROM \`parammachine_saka\`.\`cMT-HVAC-LINE-A_EMS_LINA_HMI-08_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-HVAC-LINE-A_EMS_LINA_HMI-09_data\` FROM \`parammachine_saka\`.\`cMT-HVAC-LINE-A_EMS_LINA_HMI-09_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-HVAC-LINE-A_EMS_LINA_HMI-10_data\` FROM \`parammachine_saka\`.\`cMT-HVAC-LINE-A_EMS_LINA_HMI-10_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-HVAC-LINE-A_EMS_LINA_HMI-11_data\` FROM \`parammachine_saka\`.\`cMT-HVAC-LINE-A_EMS_LINA_HMI-11_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-HVAC-LINE-A_EMS_LINA_HMI-12_data\` FROM \`parammachine_saka\`.\`cMT-HVAC-LINE-A_EMS_LINA_HMI-12_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-HVAC-LINE-A_EMS_LINA_HMI-13_data\` FROM \`parammachine_saka\`.\`cMT-HVAC-LINE-A_EMS_LINA_HMI-13_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-HVAC-LINE-A_EMS_LINA_HMI-14_data\` FROM \`parammachine_saka\`.\`cMT-HVAC-LINE-A_EMS_LINA_HMI-14_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-HVAC-LINE-A_H13 AHU 3.01 Hi_data\` FROM \`parammachine_saka\`.\`cMT-HVAC-LINE-A_H13 AHU 3.01 Hi_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-HVAC-LINE-A_H13 AHU 3.02 Hi_data\` FROM \`parammachine_saka\`.\`cMT-HVAC-LINE-A_H13 AHU 3.02 Hi_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    `;
    db3.query(fatchquerry, (err, result) => {
      if (err) {
        console.log(err);
        return response.status(500).send("Database query failed");
      }
      return response.status(200).send(result);
    });
  },

  GetDailyPower55: async (request, response) => {
    const fatchquerry = `
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_DP F6 E 1.01_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_DP F6 E 1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_DP F6 F 1.01_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_DP F6 F 1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_DP F6 F 1.02_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_DP F6 F 1.02_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_DP F6 FT 1.01_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_DP F6 FT 1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_DP F6 FT 1.02_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_DP F6 FT 1.02_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_DP F6 G 1.01_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_DP F6 G 1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_DP F6 G 1.02_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_DP F6 G 1.02_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_DP F6 LA 2.01_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_DP F6 LA 2.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_DP F6 MG 1.01_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_DP F6 MG 1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_DP F6 MG 1.02_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_DP F6 MG 1.02_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_DP F6 WG 1.01_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_DP F6 WG 1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_DP F6 WG 1.02_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_DP F6 WG 1.02_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_DP F9 E 1.01_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_DP F9 E 1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_DP F9 F 1.01_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_DP F9 F 1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_DP F9 F 1.02_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_DP F9 F 1.02_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_DP F9 FT 1.01_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_DP F9 FT 1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_DP F9 FT 1.02_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_DP F9 FT 1.02_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_DP F9 LA 2.01_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_DP F9 LA 2.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_DP F9 MG 1.01_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_DP F9 MG 1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_DP F9 MG 1.02_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_DP F9 MG 1.02_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_DP F9 WG 1.01_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_DP F9 WG 1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_DP F9 WG 1.02_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_DP F9 WG 1.02_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_DP H13 E 1.01_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_DP H13 E 1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_DP H13 FT 1.01_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_DP H13 FT 1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_DP H13 FT 1.02_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_DP H13 FT 1.02_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_DP H13 MG 1.01_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_DP H13 MG 1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_DP H13 MG 1.02_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_DP H13 MG 1.02_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_DP H13 WG 1.01_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_DP H13 WG 1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_DP H13 WG 1.02_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_DP H13 WG 1.02_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_M_Curren2_FT1.01_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_M_Curren2_FT1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_M_Current_FT1.01_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_M_Current_FT1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_M_Temp_FT1.01_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_M_Temp_FT1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_Totalizer%Chiler_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_Totalizer%Chiler_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_X-Z_AX_RM_FT1.01_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_X-Z_AX_RM_FT1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_XZR_AX_RM_FT1.01_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_XZR_AX_RM_FT1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_X_ACC_G_FT1.01_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_X_ACC_G_FT1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_X_AXISVCF_FT1.01_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_X_AXISVCF_FT1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_X_Axis_Ve_FT1.01_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_X_Axis_Ve_FT1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_Z_ACC_G_FT1.01_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_Z_ACC_G_FT1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_Z_AXISVCF_FT1.01_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_Z_AXISVCF_FT1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_Z_Axis_Ve_FT1.01_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_Z_Axis_Ve_FT1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_kWh_Chiller_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_kWh_Chiller_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_kWh_Fasilitas_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_kWh_Fasilitas_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_kWh_Hydrant_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_kWh_Hydrant_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_kWh_LVMDP 1_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_kWh_LVMDP 1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_kWh_LVMDP 2_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_kWh_LVMDP 2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_kWh_MVMDP_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_kWh_MVMDP_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_kWh_SDP2_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_kWh_SDP2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_m3_ inlet pretre_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_m3_ inlet pretre_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_m3_Boiler_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_m3_Boiler_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_m3_Domestik_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_m3_Domestik_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_m3_Outdoor_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_m3_Outdoor_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-PowerMeterMezzanine_m3_PDAM_data\` FROM \`parammachine_saka\`.\`cMT-PowerMeterMezzanine_m3_PDAM_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    `;

    db3.query(fatchquerry, (err, result) => {
      if (err) {
        console.log(err);
        return response.status(500).send("Database query failed");
      }
      return response.status(200).send(result);
    });
  },

  // GetDailyINV_HVAC: async (request, response) => {
  //   const fatchquerry = `
  //   SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-INV-HVAC-UTY_1_Current_FT1.01_data\` FROM \`parammachine_saka\`.\`CMT-DB-INV-HVAC-UTY_1_Current_FT1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  //   SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_CMT-DB-INV-HVAC-UTY_2_Current_FT1.01_data\` FROM \`parammachine_saka\`.\`CMT-DB-INV-HVAC-UTY_2_Current_FT1.01_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
  //   `;

  //   db3.query(fatchquerry, (err, result) => {
  //     if (err) {
  //       console.log(err);
  //       return response.status(500).send("Database query failed");
  //     }
  //     return response.status(200).send(result);
  //   });
  // },

  GetDailyWATER: async (request, response) => {
    const fatchquerry = `
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_AirMancur_Sehari_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_AirMancur_Sehari_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Atas QC_Sehari_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Atas QC_Sehari_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_AtsToilet_Sehari_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_AtsToilet_Sehari_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Boiler_sehari_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Boiler_sehari_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_CIP_Sehari_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_CIP_Sehari_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Chiller_sehari_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Chiller_sehari_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Dom_sehari_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Dom_sehari_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_FT270A_6.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_FT270A_6.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Hotwater_Sehari_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Hotwater_Sehari_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Inlet_Sehari_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Inlet_Sehari_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Lab_Sehari_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Lab_Sehari_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Lantai1_Sehari_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Lantai1_Sehari_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Loopo_Sehari_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Loopo_Sehari_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Met_Air Mancur_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Met_Air Mancur_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Met_Atas Lab QC_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Met_Atas Lab QC_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Met_Atas Toilet2_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Met_Atas Toilet2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Met_Boiler_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Met_Boiler_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Met_CIP_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Met_CIP_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Met_Chiller_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Met_Chiller_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Met_Domestik_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Met_Domestik_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Met_Hotwater_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Met_Hotwater_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Met_Inlet_Pt_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Met_Inlet_Pt_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Met_Lab_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Met_Lab_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Met_Lantai1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Met_Lantai1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Met_Loopo_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Met_Loopo_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Met_Osmotron_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Met_Osmotron_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Met_Outlet_Pt_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Met_Outlet_Pt_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Met_PDAM_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Met_PDAM_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Met_Produksi_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Met_Produksi_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Met_RO_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Met_RO_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Met_Softwater_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Met_Softwater_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Met_Taman_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Met_Taman_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Met_Washing_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Met_Washing_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Met_Workshop_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Met_Workshop_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Osmotron_Sehari_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Osmotron_Sehari_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Outlet_sehari_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Outlet_sehari_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_PDAM_Sehari_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_PDAM_Sehari_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Produksi_Sehari_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Produksi_Sehari_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_QE845A_6.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_QE845A_6.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_QE845A_8.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_QE845A_8.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_RO_sehari_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_RO_sehari_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Softwater_sehari_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Softwater_sehari_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_TE845A_8.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_TE845A_8.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Taman_sehari_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Taman_sehari_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_WWTP_Biologi_1d_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_WWTP_Biologi_1d_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_WWTP_Biologi_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_WWTP_Biologi_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_WWTP_Kimia_1d_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_WWTP_Kimia_1d_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_WWTP_Kimia_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_WWTP_Kimia_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_WWTP_Outlet_1d_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_WWTP_Outlet_1d_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_WWTP_Outlet_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_WWTP_Outlet_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Washing_Sehari_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Washing_Sehari_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_Workshop_Sehari_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_Workshop_Sehari_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_alarm_airmancur_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_alarm_airmancur_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_alarm_boiler_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_alarm_boiler_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_alarm_chiller_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_alarm_chiller_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_alarm_cip_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_alarm_cip_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_alarm_domestik_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_alarm_domestik_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_alarm_hotwater_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_alarm_hotwater_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_alarm_inletpr_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_alarm_inletpr_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_alarm_lab_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_alarm_lab_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_alarm_labqc_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_alarm_labqc_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_alarm_lantai1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_alarm_lantai1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_alarm_loopo_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_alarm_loopo_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_alarm_osmotron_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_alarm_osmotron_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_alarm_outletpr_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_alarm_outletpr_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_alarm_pdam_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_alarm_pdam_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_alarm_produksi_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_alarm_produksi_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_alarm_ro_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_alarm_ro_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_alarm_softwater_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_alarm_softwater_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_alarm_taman_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_alarm_taman_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_alarm_toiletlt2_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_alarm_toiletlt2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_alarm_washing_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_alarm_washing_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_alarm_workshop_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_alarm_workshop_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_alarm_wwtpbio_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_alarm_wwtpbio_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_alarm_wwtpkimia_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_alarm_wwtpkimia_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_alarm_wwtpoutlet_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_alarm_wwtpoutlet_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_lopo_A845A_2.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_lopo_A845A_2.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_lopo_FT845A_8.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_lopo_FT845A_8.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_lopo_LT560A_1.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_lopo_LT560A_1.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_lopo_P845A_1.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_lopo_P845A_1.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_lopo_PT845A_1.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_lopo_PT845A_1.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_lopo_PT845A_8.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_lopo_PT845A_8.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_lopo_QE845A_4.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_lopo_QE845A_4.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_lopo_QE845A_5.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_lopo_QE845A_5.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_lopo_RunHour_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_lopo_RunHour_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_lopo_TT845A_3.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_lopo_TT845A_3.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_lopo_V845A_3.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_lopo_V845A_3.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_B270A_6.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_B270A_6.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_ET270A_6.11_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_ET270A_6.11_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_ET270A_6.12_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_ET270A_6.12_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_FIT270A_5.2_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_FIT270A_5.2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_FIT270_5.50_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_FIT270_5.50_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_FT270A_5.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_FT270A_5.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_FT270A_5.51_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_FT270A_5.51_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_FT270A_6.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_FT270A_6.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_FT270A_6.2_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_FT270A_6.2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_P270A_11.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_P270A_11.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_P270A_12.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_P270A_12.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_P270A_13.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_P270A_13.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_P270A_1.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_P270A_1.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_P270A_5.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_P270A_5.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_P270A_5.2_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_P270A_5.2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_P270A_6.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_P270A_6.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_P270A_7.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_P270A_7.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_PDY270A_5.4_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_PDY270A_5.4_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_PDY270A_5.7_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_PDY270A_5.7_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_PT270A_1.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_PT270A_1.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_PT270A_5.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_PT270A_5.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_PT270A_5.4_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_PT270A_5.4_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_PT270A_5.5_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_PT270A_5.5_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_PT270A_5.6_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_PT270A_5.6_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_PT270A_5.7_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_PT270A_5.7_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_PT270A_5.8_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_PT270A_5.8_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_PT270A_6.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_PT270A_6.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_PT270A_6.2_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_PT270A_6.2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_PT270A_6.3_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_PT270A_6.3_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_QE270A_11.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_QE270A_11.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_QE270A_12.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_QE270A_12.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_QE270A_5.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_QE270A_5.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_QE270A_6.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_QE270A_6.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_QE270A_6.2_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_QE270A_6.2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_TE270A_5.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_TE270A_5.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_TE270A_6.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_TE270A_6.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_TT270A_5.2_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_TT270A_5.2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_V270A_5.10_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_V270A_5.10_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_V270A_5.50_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_V270A_5.50_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_V270A_5.51_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_V270A_5.51_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_V270A_6.2_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_V270A_6.2_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_V270A_6.5_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_V270A_6.5_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_W270A_5.1_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_W270A_5.1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
      SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-WATER-UTY3_osmo_WCF_Factor_data\` FROM \`parammachine_saka\`.\`cMT-DB-WATER-UTY3_osmo_WCF_Factor_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    `;

    db3.query(fatchquerry, (err, result) => {   
      if (err) {
        console.log(err);
        return response.status(500).send("Database query failed");
      }
      return response.status(200).send(result);
    });
  },

  GetDailyDehum: async (request, response) => {
    const fatchquerry = `
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DehumRNDLt3danWH1_PrekursorWH1_data\` FROM parammachine_saka.\`cMT-DehumRNDLt3danWH1_PrekursorWH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DehumRNDLt3danWH1_RakLayer3-C56WH1_data\` FROM parammachine_saka.\`cMT-DehumRNDLt3danWH1_RakLayer3-C56WH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DehumRNDLt3danWH1_RakLayer3-C64WH1_data\` FROM parammachine_saka.\`cMT-DehumRNDLt3danWH1_RakLayer3-C64WH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DehumRNDLt3danWH1_RakLayer3-C72WH1_data\` FROM parammachine_saka.\`cMT-DehumRNDLt3danWH1_RakLayer3-C72WH1_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    `;

    db3.query(fatchquerry, (err, result) => {
      if (err) {
        console.log(err);
        return response.status(500).send("Database query failed");
      }
      return response.status(200).send(result);
    });
  },

  GetDailyEMSUTY: async (request, response) => {
    const fatchquerry = `
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_Area_N33_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_Area_N33_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_Area_P10_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_Area_P10_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_Area_W25toN33_Nw_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_Area_W25toN33_Nw_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_Area_W25toP10_Nw_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_Area_W25toP10_Nw_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_GAC_WH2_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_GAC_WH2_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_GBAC1_WH1_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_GBAC1_WH1_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_GBAC2_WH1_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_GBAC2_WH1_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_PackagingF_Ln1_N_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_PackagingF_Ln1_N_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_PackagingF_Ln2_N_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_PackagingF_Ln2_N_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_PackagingF_Ln3_N_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_PackagingF_Ln3_N_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R.K27_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R.K27_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R.K30_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R.K30_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R.K31_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R.K31_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R.K32_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R.K32_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R.K33_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R.K33_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R.K34_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R.K34_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R.K35_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R.K35_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R.K36_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R.K36_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R.N03_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R.N03_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R.N04_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R.N04_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R.N05_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R.N05_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R.N06_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R.N06_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R.Tools1_WG_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R.Tools1_WG_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R.W03_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R.W03_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R.W04_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R.W04_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R.W05_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R.W05_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R.W06-1_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R.W06-1_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R.W06-2_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R.W06-2_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R.W09_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R.W09_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R.W17(Spare)_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R.W17(Spare)_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R.W18_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R.W18_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R.W19_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R.W19_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R.W20_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R.W20_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R.W21_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R.W21_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R.W22_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R.W22_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R.W23_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R.W23_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R.W24_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R.W24_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R.W25_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R.W25_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_N07_Coridor_Nw_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_N07_Coridor_Nw_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_N07_Machine_Nw_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_N07_Machine_Nw_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_N08_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_N08_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_N10_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_N10_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_N11_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_N11_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_N13_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_N13_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_N14_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_N14_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_N15_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_N15_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_N16_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_N16_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_N18_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_N18_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_N20_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_N20_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_N28_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_N28_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_P01_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_P01_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_P02_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_P02_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_P03_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_P03_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_P05_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_P05_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_P06_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_P06_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_P11_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_P11_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_P12_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_P12_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_P13_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_P13_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_P14_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_P14_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_X01_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_X01_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_X02_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_X02_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_X03_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_X03_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_X04_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_X04_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_X05_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_X05_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_X06_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_X06_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_X09_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_X09_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_X10_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_X10_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    SELECT DATE(FROM_UNIXTIME(\`time@timestamp\`)) AS \`Tanggal_cMT-DB-EMS-UTY2_R_X11_New_data\` FROM ems_saka.\`cMT-DB-EMS-UTY2_R_X11_New_data\` ORDER BY \`time@timestamp\` DESC LIMIT 1;
    `;

    db4.query(fatchquerry, (err, result) => {
      if (err) {
        console.log(err);
        return response.status(500).send("Database query failed");
      }
      return response.status(200).send(result);
    });
  },

  GrafanaWater: async (request, response) => {
    const { area } = request.query;
    const queryGet = `
    SELECT 
    x,
    y
    FROM (
        SELECT 
            \`time@timestamp\` AS x,
            CASE 
                WHEN @prev_value IS NULL THEN 0
                ELSE data_format_0 - @prev_value
            END AS y,
            @prev_value := data_format_0
        FROM 
            (
                SELECT \`time@timestamp\`, data_format_0
                FROM \`parammachine_saka\`.\`${area}\`
                WHERE \`time@timestamp\` >= UNIX_TIMESTAMP(DATE_FORMAT(NOW(), '%Y-%m-01')) -- Tanggal 1 bulan ini
                  AND \`time@timestamp\` < UNIX_TIMESTAMP(DATE(NOW())) -- Hingga kemarin
            ) AS combined_data
        ORDER BY 
            \`time@timestamp\`
    ) AS inner_query;
    `;
    db3.query(queryGet, (err, result) => {
      if (err) {
        console.log(err);
        return response.status(500).send("Database query failed");
      }
      return response.status(200).send(result);
    });
  },

  GrafanaPower: async (request, response) => {
    const { area } = request.query;
    const queryGet = `
    SELECT 
    x,
    y
    FROM (
        SELECT 
            \`time@timestamp\` AS x,
            CASE 
                WHEN @prev_value IS NULL THEN 0
                ELSE data_format_0 - @prev_value
            END AS y,
            @prev_value := data_format_0
        FROM 
            (
                SELECT \`time@timestamp\`, data_format_0
                FROM \`ems_saka\`.\`${area}\`
                WHERE \`time@timestamp\` >= UNIX_TIMESTAMP(DATE_FORMAT(NOW(), '%Y-%m-01')) -- Tanggal 1 bulan ini
                  AND \`time@timestamp\` < UNIX_TIMESTAMP(DATE(NOW())) -- Hingga kemarin
            ) AS combined_data
        ORDER BY 
            \`time@timestamp\`
    ) AS inner_query;
    `;
    db4.query(queryGet, (err, result) => {
      if (err) {
        console.log(err);
        return response.status(500).send("Database query failed");
      }
      return response.status(200).send(result);
    });
  },

  GrafanaMVMDPyear: async (request, response) => {
  const { area } = request.query;
  
  const queryGet = `
    WITH OrderedData AS (
      SELECT 
        -- 1. Apply the 7-hour WIB timezone fix to group the days correctly
        DATE(DATE_SUB(FROM_UNIXTIME(\`time@timestamp\`), INTERVAL 7 HOUR)) AS true_date,
        data_format_0,
        -- 2. Use LAG to instantly grab the previous reading for the subtraction
        LAG(data_format_0) OVER (ORDER BY \`time@timestamp\`) AS previous_format_0
      FROM \`ems_saka\`.\`${area}\`
      WHERE data_format_0 > 0
    ),
    DailyDiffs AS (
      SELECT 
        true_date,
        YEAR(true_date) AS year,
        MONTH(true_date) AS month,
        (data_format_0 - previous_format_0) AS daily_diff
      FROM OrderedData
      WHERE previous_format_0 IS NOT NULL
    )
    SELECT 
      year,
      month,
      -- 3. Pass the first available date of that month as the label for CanvasJS
      DATE_FORMAT(MIN(true_date), '%Y-%m-%d') AS time, 
      SUM(ABS(daily_diff)) AS monthly_total
    FROM DailyDiffs
    GROUP BY year, month
    ORDER BY year, month;
  `;

  db3.query(queryGet, (err, result) => {
    if (err) {
      console.error("GrafanaMVMDPyear Error:", err);
      // Send the actual SQL error message to the frontend network tab for easy debugging
      return response.status(500).send({ 
        error: "Database query failed", 
        details: err.sqlMessage || err.message 
      });
    }
    return response.status(200).send(result);
  });
},

  GrafanaPDAMyear: async (request, response) => {
    const { area } = request.query;
    const queryGet = `
    SELECT 
        YEAR(d1.date) AS year,
        MONTH(d1.date) AS month,
        DATE(FROM_UNIXTIME(UNIX_TIMESTAMP(d1.date))) AS time,
        SUM(ABS(d1.daily_diff)) AS monthly_total
    FROM (
        SELECT 
            DATE(FROM_UNIXTIME(t1.\`time@timestamp\`)) AS date,
            t1.data_format_0 - COALESCE(t2.data_format_0, 0) AS daily_diff
        FROM (
            SELECT \`time@timestamp\`, data_format_0
            FROM \`parammachine_saka\`.\`${area}\`
        ) t1
        LEFT JOIN (
            SELECT \`time@timestamp\`, data_format_0
            FROM \`parammachine_saka\`.\`${area}\`
        ) t2
        ON DATE(FROM_UNIXTIME(t1.\`time@timestamp\`)) = DATE_SUB(DATE(FROM_UNIXTIME(t2.\`time@timestamp\`)), INTERVAL 1 DAY)
    ) d1
    WHERE d1.daily_diff IS NOT NULL
    GROUP BY year, month
    ORDER BY year, month;
    `;

    db3.query(queryGet, (err, result) => {
      if (err) {
        console.log(err);
        return response.status(500).send("Database query failed");
      }
      return response.status(200).send(result);
    });
  },

  waterCostSystem: async (request, response) => {
  const { area, start, finish } = request.query;

  try {
    const getPrice = new Promise((resolve, reject) => {
      const priceQuery = `SELECT * FROM ems_saka.Parameter_Portal ORDER BY id DESC LIMIT 1;`;
      db4.query(priceQuery, (err, result) => {
        if (err) reject(err); 
        else resolve(result);
      });
    });

    const getVolume = new Promise((resolve, reject) => {
      const volumeQuery = `
  SELECT
    -- Bypasses server timezones by calculating strictly from the 1970 epoch
    DATE_FORMAT(DATE_ADD('1970-01-01 00:00:00', INTERVAL \`time@timestamp\` SECOND), '%Y-%m-%d') AS label,
    data_index AS x,
    round(data_format_0, 2) AS y
  FROM \`${area}\`
  WHERE 
    DATE(DATE_ADD('1970-01-01 00:00:00', INTERVAL \`time@timestamp\` SECOND)) BETWEEN ? AND ?
  ORDER BY \`time@timestamp\`
`;
      db3.query(volumeQuery, [start, finish], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    const [paramResult, volumeResult] = await Promise.all([getPrice, getVolume]);

    // FIXED: Now correctly pointing to the 'Parameter_Air' column from DBeaver
    const currentWaterPrice = paramResult[0]?.Parameter_Air || 0; 

    const finalData = volumeResult.map(day => ({
      label: day.label,
      x: day.x,
      y: Number(day.y || 0),                   
      cost: Number(day.y || 0) * currentWaterPrice 
    }));

    return response.status(200).send(finalData);

  } catch (error) {
    console.error("Cost Calculation Error:", error);
    return response.status(500).send("Database query failed during cost calculation");
  }
},

  
  //-------------------------Mesin Report--------------------------

  HM1Report: async (request, response) => {
    const { tanggal, shift, area } = request.query;

    if (!tanggal || !shift) {
      return response
        .status(400)
        .send({ error: "Tanggal dan shift harus diisi" });
    }

    const checkExistQuery = `
      SELECT 1 FROM Downtime_Mesin
      WHERE DATE(start) = ? AND shift = ?
      LIMIT 1
    `;

    db3.query(checkExistQuery, [tanggal, shift], (err, existResult) => {
      if (err) {
        console.error("Database check error:", err);
        return response.status(500).send({ error: "Database check error" });
      }

      const sendFilteredResponse = () => {
        const selectQuery = `
          SELECT 
            id,
            DATE_FORMAT(start, '%H:%i') AS start,
            DATE_FORMAT(finish, '%H:%i') AS finish,
            total_menit
          FROM Downtime_Mesin
          WHERE DATE(start) = ? AND shift = ? AND downtime_type IS NULL AND mesin = ?
        `;

        //console.log(selectQuery);
        db3.query(selectQuery, [tanggal, shift, area], (err, rows) => {
          console.log('Backend Raw Query Results:', rows); 
          if (err) {
            console.error("Select error:", err);
            return response.status(500).send({ error: "Select error" });
          }
          return response.status(200).send(rows);
        });
      };
      

      if (existResult.length > 0) {
        return sendFilteredResponse();
      }

      let queryGet = "";
      if (shift === "1") {
        queryGet = `
          SELECT
            FROM_UNIXTIME(\`time@timestamp\`) AS waktu,
            \`time@timestamp\` AS raw_timestamp,
            data_format_0 AS y
          FROM \`parammachine_saka\`.\`mezanine.tengah_runn_${area}_data\`
          WHERE
            DATE_SUB(FROM_UNIXTIME(\`time@timestamp\`), INTERVAL 7 HOUR) BETWEEN '${tanggal} 06:30:00' AND '${tanggal} 15:00:00'
            AND data_format_0 = 0
          ORDER BY \`time@timestamp\`
        `;
      } else if (shift === "2") {
        queryGet = `
          SELECT
            FROM_UNIXTIME(\`time@timestamp\`) AS waktu,
            \`time@timestamp\` AS raw_timestamp,
            data_format_0 AS y
          FROM \`parammachine_saka\`.\`mezanine.tengah_runn_${area}_data\`
          WHERE
            DATE_SUB(FROM_UNIXTIME(\`time@timestamp\`), INTERVAL 7 HOUR) BETWEEN '${tanggal} 15:00:00' AND '${tanggal} 23:00:00'
            AND data_format_0 = 0
          ORDER BY \`time@timestamp\`
        `;
      } else if (shift === "3") {
        queryGet = `
          SELECT
            FROM_UNIXTIME(\`time@timestamp\`) AS waktu,
            \`time@timestamp\` AS raw_timestamp,
            data_format_0 AS y
          FROM \`parammachine_saka\`.\`mezanine.tengah_runn_${area}_data\`
          WHERE (
            DATE_SUB(FROM_UNIXTIME(\`time@timestamp\`), INTERVAL 7 HOUR) BETWEEN '${tanggal} 23:00:00' AND '${tanggal} 00:00:00'
            OR
            DATE_SUB(FROM_UNIXTIME(\`time@timestamp\`), INTERVAL 7 HOUR) BETWEEN '${tanggal} 00:00:00' AND '${tanggal} 06:30:00'
          )
          AND data_format_0 = 0
          ORDER BY \`time@timestamp\`
        `;
      } else {
        return response.status(400).send({ error: "Shift tidak valid" });
      }

      console.log(queryGet);
      db3.query(queryGet, (err, result) => {
        if (err) {
          console.error("Database query error:", err);
          return response.status(500).send({ error: "Database query error" });
        }

        const grouped = [];
        let currentGroup = null;
        let prevTime = null;

        for (let row of result) {
          const currentTime = new Date(row.waktu);

          if (!currentGroup || (prevTime && currentTime - prevTime > 60000)) {
            if (currentGroup) {
              grouped.push({
                start: currentGroup.start,
                finish: currentGroup.finish,
                total_minutes: Math.round(
                  (currentGroup.finish - currentGroup.start) / 60000
                ),
              });
            }
            currentGroup = {
              start: currentTime,
              finish: currentTime,
            };
          } else {
            currentGroup.finish = currentTime;
          }

          prevTime = currentTime;
        }

        if (currentGroup) {
          grouped.push({
            start: currentGroup.start,
            finish: currentGroup.finish,
            total_minutes: Math.round(
              (currentGroup.finish - currentGroup.start) / 60000
            ),
          });
        }

        const filtered = grouped.filter((item) => item.total_minutes >= 3);

        if (filtered.length === 0) {
          return response.status(200).send([]);
        }

        const checkExistingQuery = `
          SELECT shift, start, finish
          FROM Downtime_Mesin
          WHERE DATE(start) = ? AND shift = ?
        `;

        db3.query(checkExistingQuery, [tanggal, shift], (err, existingRows) => {
          if (err) {
            console.error("Check existing entries error:", err);
            return response
              .status(500)
              .send({ error: "Check existing entries error" });
          }

          const existingSet = new Set(
            existingRows.map(
              (row) =>
                `${
                  row.shift
                }|${row.start.toISOString()}|${row.finish.toISOString()}`
            )
          );

          const newEntries = filtered.filter((item) => {
            const key = `${shift}|${item.start.toISOString()}|${item.finish.toISOString()}`;
            return !existingSet.has(key);
          });

          if (newEntries.length === 0) {
            return sendFilteredResponse();
          }

          const insertValues = newEntries.map((item) => [
            parseInt(shift),
            new Date(item.start.getTime() - 7 * 60 * 60 * 1000),
            new Date(item.finish.getTime() - 7 * 60 * 60 * 1000),
            item.total_minutes,
            area,
          ]);

          const insertQuery = `
            INSERT INTO Downtime_Mesin (shift, start, finish, total_menit, mesin)
            VALUES ?
          `;

          db3.query(insertQuery, [insertValues], (insertErr) => {
            if (insertErr) {
              console.error("Insert error:", insertErr);
              return response.status(500).send({ error: "Insert error" });
            }

            return sendFilteredResponse();
          });
        });
      });
    });
  },

  alldowntime: async (request, response) => {
    const { type } = request.query;

    // Cek apakah parameter type ada
    if (!type) {
      return response
        .status(400)
        .send({ error: "Parameter 'type' diperlukan" });
    }

    // Query hanya kolom keterangan_downtime dengan filter downtime_type
    const queryData = `SELECT detail FROM parammachine_saka.alldowntime_db WHERE downtime_type = '${type}'`;

    console.log(queryData);
    db3.query(queryData, (err, result) => {
      if (err) {
        return response
          .status(500)
          .send({ error: "Database error", detail: err });
      }

      return response.status(200).send(result);
    });
  },

  HM1InsertDowntime: async (req, res) => {
    const {
      id,
      downtime_type,
      downtime_detail,
      username,
      submitted_at,
      keterangan,
    } = req.body;

    // Validasi field
    if (
      !id ||
      !downtime_type ||
      !downtime_detail ||
      !username ||
      !submitted_at ||
      !keterangan
    ) {
      return res.status(400).send({ error: "Semua field harus diisi" });
    }

    try {
      const checkQuery = `
        SELECT * FROM Downtime_Mesin
        WHERE id = ?
          AND downtime_type IS NULL
          AND detail IS NULL
          AND user IS NULL
          AND submit_date IS NULL
          AND keterangan IS NULL
        LIMIT 1
      `;

      db3.query(checkQuery, [id], (err, results) => {
        if (err) {
          console.error("Check error:", err);
          return res.status(500).send({ error: "Gagal cek data di database" });
        }

        if (results.length === 0) {
          return res
            .status(400)
            .send({ error: "Data tidak ditemukan atau sudah terisi" });
        }

        // Update data jika valid
        const updateQuery = `
          UPDATE Downtime_Mesin
          SET downtime_type = ?, detail = ?, user = ?, submit_date = ?, keterangan = ?
          WHERE id = ?
            AND downtime_type IS NULL
            AND detail IS NULL
            AND user IS NULL
            AND submit_date IS NULL
            AND keterangan IS NULL
        `;

        db3.query(
          updateQuery,
          [
            downtime_type,
            downtime_detail,
            username,
            submitted_at,
            keterangan,
            id,
          ],
          (err, result) => {
            if (err) {
              console.error("Update error:", err);
              return res
                .status(500)
                .send({ error: "Gagal update data di database" });
            }
            return res
              .status(200)
              .send({ success: true, message: "Data berhasil diupdate" });
          }
        );
      });
    } catch (err) {
      console.error("Server error:", err);
      res.status(500).send({ error: "Terjadi kesalahan pada server" });
    }
  },

  HM1InsertDowntimeWithSubRows: async (req, res) => {
    const { mainRow, subRows } = req.body;
    const parsedId = parseInt(mainRow?.id);

    console.log("Parsed ID:", parsedId);
    console.log("SubRows:", subRows);

    if (!Array.isArray(subRows) || subRows.length === 0) {
      return res
        .status(400)
        .send({ error: "Data subRows kosong atau tidak valid" });
    }

    if (!parsedId || isNaN(parsedId)) {
      return res.status(400).send({ error: "ID tidak valid" });
    }

    const deleteQuery = `DELETE FROM Downtime_Mesin WHERE id = ?`;
    const insertQuery = `
    INSERT INTO Downtime_Mesin
    (shift, start, finish, total_menit, mesin, downtime_type, detail, user, submit_date, keterangan)
    VALUES ?
  `;

    try {
      db3.query(deleteQuery, [parsedId], (deleteErr, deleteResult) => {
        if (deleteErr) {
          console.error("Delete error:", deleteErr);
          return res.status(500).send({ error: "Gagal hapus data lama" });
        }

        console.log("Rows deleted:", deleteResult.affectedRows);

        const values = subRows.map((item) => {
          const fullStart = `${item.tanggal} ${item.start}`;
          const fullFinish = `${item.tanggal} ${item.finish}`;

          return [
            item.shift,
            fullStart,
            fullFinish,
            item.total_menit,
            item.mesin || item.area,
            item.downtime_type,
            item.detail || item.downtime_detail,
            item.user || item.username,
            item.submit_date || item.submitted_at,
            item.keterangan || "",
          ];
        });

        db3.query(insertQuery, [values], (insertErr, insertResult) => {
          if (insertErr) {
            console.error("Insert error:", insertErr);
            return res.status(500).send({ error: "Gagal insert data baru" });
          }

          return res.status(200).send({
            success: true,
            message: "Data berhasil diganti dengan sub-row baru",
          });
        });
      });
    } catch (error) {
      console.error("Server error:", error);
      return res.status(500).send({ error: "Terjadi kesalahan di server" });
    }
  },


  // New function to fetch ONLY planned downtime records


// You would then register this in your router:
// router.get('/GetPlannedDowntime', GetPlannedDowntime);

  //-------------------------Data Login--------------------------

  GetPlannedDowntime: async (request, response) => {
    const { tanggal, shift, area } = request.query;

    if (!tanggal || !shift || !area) {
        return response
            .status(400)
            .send({ error: "Tanggal, shift, dan area harus diisi." });
    }

    // FIX: Normalize the shift parameter to match the database value ('1', '2', or '3').
    const normalizedShift = shift.toString().replace(/\D/g, '').trim(); 
    if (!normalizedShift) {
        return response.status(400).send({ error: "Shift tidak valid." });
    }

    // The Direct SQL Query
    const plannedQuery = `
        SELECT 
            id,
            DATE_FORMAT(start, '%H:%i') AS start,
            DATE_FORMAT(finish, '%H:%i') AS finish,
            total_menit,
            downtime_type,
            detail,
            keterangan
        FROM 
            Downtime_Mesin
        WHERE 
            DATE(start) = ? 
            AND TRIM(shift) = ? 
            AND TRIM(mesin) = ?
            AND downtime_type = 'Planned'  -- **<< Filters only 'Planned' records**
        ORDER BY start
    `;

    const queryParams = [tanggal, normalizedShift, area];

    db3.query(plannedQuery, queryParams, (err, rows) => {
        if (err) {
            console.error("Planned Downtime Select error:", err);
            return response.status(500).send({ error: "Database error fetching planned data." });
        }
        
        return response.status(200).send(rows);
    });
},
/*
  LoginData: async (req, res) => {
    const { name, id, isAdmin, level, imagePath, loginAt, email } = req.body;

    // Validasi field (cek null atau undefined, bukan hanya falsy)
    if (
      name == null ||
      id == null ||
      isAdmin == null ||
      level == null ||
      imagePath == null
    ) {
      return res.status(400).send({ error: "Semua field harus diisi" });
    }

    let clientIp = (
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket.remoteAddress ||
      ""
    ).replace(/^::ffff:/, "");
    const insertQuery = `
      INSERT INTO Log_Data_Login (name, id_char, isAdmin, level, imagePath, ip_address, Date, email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const insertValues = [
      name,
      id,
      isAdmin,
      level,
      imagePath,
      clientIp,
      loginAt,
      email,
    ];

    db3.query(insertQuery, insertValues, (insertErr) => {
      if (insertErr) {
        console.error("Insert error:", insertErr);
        return res.status(500).send({ error: "Gagal menyimpan data login" });
      }

      return res.status(200).send({ message: "Data login berhasil disimpan" });
    });
  }, */

  LogData: async (req, res) => {
    const queryData = `SELECT * FROM parammachine_saka.Log_Data_Login ORDER BY STR_TO_DATE(Date, '%m/%d/%Y, %r') DESC`;
    console.log(queryData);

    db3.query(queryData, (err, result) => {
      if (err) {
        return res.status(500).send({ error: "Database error", detail: err });
      }
      return res.status(200).send(result);
    });
  },
 
  /*
  LogoutData: async (req, res) => {
    const { id_char, logout_time } = req.body;

    if (!id_char || !logout_time) {
      return res
        .status(400)
        .send({ error: "id_char dan logout_time harus diisi" });
    }

    // Update baris terakhir yang masih aktif
    const updateQuery = `
      UPDATE parammachine_saka.Log_Data_Login
      SET logout_time = ?, status = 'completed'
      WHERE id_char = ? AND (status IS NULL OR status = 'active')
      ORDER BY ID DESC LIMIT 1
    `;

    db3.query(updateQuery, [logout_time, id_char], (err, result) => {
      if (err) {
        return res.status(500).send({ error: "Database error", detail: err });
      }
      return res.status(200).send({ message: "Logout time berhasil diupdate" });
    });
  }, 
  
  */

// Function to fetch downtime records based on user filters
// Function to fetch downtime records based on user filters
downtimeAnalysis: async (request, response) => {
    const { tanggal, shift, area } = request.query; 

    // Validate essential fields
    if (!tanggal || !shift || !area) {
        return response.status(400).send({ error: "Tanggal, shift, dan area (machine) harus diisi" });
    }

    // 🔴 FIX: Use '?' placeholders for secure, parameterized query
    const queryGetChartData = `
        SELECT 
            id,
            total_menit, 
            downtime_type,
            detail,
            keterangan
        FROM 
            Downtime_Mesin
        WHERE 
            DATE(start) = ? 
            AND shift = ? 
            AND mesin = ?
            AND downtime_type IS NOT NULL 
            AND detail IS NOT NULL
        ORDER BY
            start ASC;
    `;
    
    // Create an array of values corresponding to the placeholders (?)
    const queryValues = [tanggal, shift, area];

    try {
        // 🔴 FIX: Convert to promise for cleaner error handling 
        const result = await new Promise((resolve, reject) => {
            // Pass the query string and the array of values
            db3.query(queryGetChartData, queryValues, (err, data) => {
                if (err) return reject(err);
                resolve(data);
            });
        });
        
        // Success: Return the results
        return response.status(200).send(result);
        
    } catch (error) {
        // This catch now handles both the promise rejection and any other runtime errors
        console.error("Server error in downtimeAnalysis:", error);
        return response.status(500).send({ error: "Terjadi kesalahan pada server saat fetching analysis data" });
    }
}, // <-- Ensure this is correctly part of module.exports
bulkImportPMPData: async (request, response) => {
    try {
      const { jobs, category } = request.body;

      // Validate input
      if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
        return response.status(400).send({ error: "Missing job data array." });
      }
      if (!category) {
        return response.status(400).send({ error: "Missing category." });
      }

      console.log(`📥 Received ${jobs.length} jobs to import with category: ${category}`);

      // Map jobs to database columns
      const valuesToInsert = jobs.map(job => [
        job.wo_number,
        job.machine_name,
        job.asset_number,
        category, // category column
        'Pending', // status column
        new Date() // created_at
      ]);

      // Build INSERT query
      const sql = `
        INSERT INTO pmp_pending_jobs 
        (wo_number, machine_name, asset_number, category, status, created_at) 
        VALUES ?
      `;

      db4.query(sql, [valuesToInsert], (err, result) => {
        if (err) {
          console.error('❌ Database Insertion Error:', err.message);
          return response.status(500).send({ 
            error: "Database insertion failed", 
            details: err.message 
          });
        }
        console.log(`✨ Successfully imported ${result.affectedRows} pending jobs.`);
        return response.status(201).send({ 
          message: "Import successful", 
          createdCount: result.affectedRows 
        });
      });

    } catch (error) {
      console.error('❌ Import Error:', error.message);
      return response.status(500).send({ 
        error: "Import processing failed", 
        details: error.message 
      });
    }
  },

createPMPData: async (request, response) => {
        const { machine_name, asset_number, wo_no, operations, month } = request.body;
        
        const sql = "INSERT INTO extracted_maintenance_data (machine_name, asset_number, wo_no, operations, month) VALUES (?, ?, ?, ?, ?)";
        
        db4.query(sql, [machine_name, asset_number, wo_no, operations, month], (err, result) => {
            if (err) {
                console.error('❌ Database CREATE Error:', err.message);
                return response.status(500).send({ error: "Database insertion failed", details: err.message });
            }
            console.log(`✨ Record created with ID: ${result.insertId}`);
            return response.status(201).send({ message: "Record created", insertedId: result.insertId });
        });
    },

    /**
     * READ: Get all PMP records
     * Called by: GET /part/pmp-data
     */
    readPMPData: async (request, response) => {
        const sql = "SELECT * FROM extracted_maintenance_data ORDER BY record_id DESC";
        
        db4.query(sql, (err, result) => {
            if (err) {
                console.error('❌ Database READ Error:', err.message);
                return response.status(500).send({ error: "Database read failed", details: err.message });
            }
            return response.status(200).send(result);
        });
    },

    /**
     * UPDATE: Update an existing PMP record
     * Called by: PUT /part/pmp-data/:id
     */
    updatePMPData: async (request, response) => {
        const { id } = request.params;
        const { machine_name, asset_number, wo_no, operations, month } = request.body;
        
        const sql = "UPDATE extracted_maintenance_data SET machine_name = ?, asset_number = ?, wo_no = ?, operations = ?, month = ? WHERE record_id = ?";
        
        db4.query(sql, [machine_name, asset_number, wo_no, operations, month, id], (err, result) => {
            if (err) {
                console.error('❌ Database UPDATE Error:', err.message);
                return response.status(500).send({ error: "Database update failed", details: err.message });
            }
            if (result.affectedRows === 0) {
                return response.status(404).send({ error: "Record not found, no update performed." });
            }
            console.log(`✨ Record ${id} updated.`);
            return response.status(200).send({ message: "Record updated" });
        });
    },

    /**
     * DELETE: Delete a PMP record
     * Called by: DELETE /part/pmp-data/:id
     */
    deletePMPData: async (request, response) => {
        const { id } = request.params;
        const sql = "DELETE FROM extracted_maintenance_data WHERE record_id = ?";
        
        db4.query(sql, [id], (err, result) => {
            if (err) {
                console.error('❌ Database DELETE Error:', err.message);
                return response.status(500).send({ error: "Database delete failed", details: err.message });
            }
            if (result.affectedRows === 0) {
                return response.status(404).send({ error: "Record not found, no deletion performed." });
            }
            console.log(`✨ Record ${id} deleted.`);
            return response.status(200).send({ message: "Record deleted" });
        });
    },

    getMachinesList: async (request, response) => {
        const sql = "SELECT machine_id, machine_name, asset_number FROM pmp_machines";
        
        db4.query(sql, (err, result) => {
            if (err) {
                console.error('❌ Database READ Error (pmp_machines):', err.message);
                return response.status(500).send({ error: "Database read failed", details: err.message });
            }
            return response.status(200).send(result);
        });
    },


    // Master Data PMP Machines CRUD Operations //
    getMachinesList: async (request, response) => {
        const sql = "SELECT machine_id, machine_name, asset_number FROM pmp_machines ORDER BY machine_name";
        
        db4.query(sql, (err, result) => {
            if (err) {
                console.error('❌ Database READ Error (pmp_machines):', err.message);
                return response.status(500).send({ error: "Database read failed", details: err.message });
            }
            return response.status(200).send(result);
        });
    },

    /**
     * READ: Get all default operations for a *specific machine*
     * Called by: GET /part/default-operations/:machine_id
     */
    getDefaultOperations: async (request, response) => {
        const { machine_id } = request.params;
        const sql = "SELECT * FROM pmp_default_operations WHERE machine_id = ? ORDER BY default_op_id";
        
        db4.query(sql, [machine_id], (err, result) => {
            if (err) {
                console.error('❌ Database READ Error (default_ops):', err.message);
                return response.status(500).send({ error: "Database read failed", details: err.message });
            }
            return response.status(200).send(result);
        });
    },

    /**
     * CREATE: Add a new default operation
     * Called by: POST /part/default-operations
     */
   createDefaultOperation: async (request, response) => {
        // Now expecting an array of descriptions
        const { machine_id, descriptions } = request.body; 

        if (!machine_id || !descriptions || !Array.isArray(descriptions) || descriptions.length === 0) {
            return response.status(400).send({ error: "Invalid input: machine_id and a non-empty descriptions array are required." });
        }

        // --- Build a Bulk Insert Query ---
        // 1. Create the placeholders: (?, ?), (?, ?), (?, ?)
        const placeholders = descriptions.map(() => "(?, ?)").join(', ');
        
        // 2. Create the data array: [1, 'Desc1', 1, 'Desc2', 1, 'Desc3']
        const values = [];
        descriptions.forEach(desc => {
            values.push(machine_id, desc);
        });

        const sql = `INSERT INTO pmp_default_operations (machine_id, description) VALUES ${placeholders}`;
        
        db4.query(sql, values, (err, result) => {
            if (err) {
                console.error('❌ Database BATCH CREATE Error (default_ops):', err.message);
                return response.status(500).send({ error: "Database insertion failed", details: err.message });
            }
            console.log(`✨ ${result.affectedRows} default operations created.`);
            return response.status(201).send({ message: "Operations created", insertedRows: result.affectedRows });
        });
    },

    /**
     * DELETE: Delete a default operation
     * Called by: DELETE /part/default-operations/:op_id
     */
    deleteDefaultOperation: async (request, response) => {
        const { op_id } = request.params;
        const sql = "DELETE FROM pmp_default_operations WHERE default_op_id = ?";
        
        db4.query(sql, [op_id], (err, result) => {
            if (err) {
                console.error('❌ Database DELETE Error (default_ops):', err.message);
                return response.status(500).send({ error: "Database delete failed", details: err.message });
            }
            if (result.affectedRows === 0) {
                return response.status(404).send({ error: "Operation not found" });
            }
            console.log(`✨ Default operation ${op_id} deleted.`);
            return response.status(200).send({ message: "Operation deleted" });
        });
    },

    getAllOperationsList: async (request, response) => {
        // 'DISTINCT' ensures we only get one copy of each description
        const sql = "SELECT DISTINCT description FROM pmp_default_operations ORDER BY description";
        
        db4.query(sql, (err, result) => {
            if (err) {
                console.error('❌ Database READ Error (all_ops):', err.message);
                return response.status(500).send({ error: "Database read failed", details: err.message });
            }
            // Send back a simple array of strings: ["Check oil", "Clean filter", ...]
            const descriptions = result.map(op => op.description);
            return response.status(200).send(descriptions);
        });
    },

    bulkImportPMPData: async (request, response) => {
    console.log('Starting bulk import from JSON...');
    
    // 1. Get the array of jobs from the request body
    const jobs = request.body; 

    if (!Array.isArray(jobs) || jobs.length === 0) {
      return response.status(400).send({ error: "Missing job data array." });
    }

    let createdCount = 0;
    const errors = [];
    const db4Promise = db4.promise();

    try {
      // 2. Get ALL machines and default ops into maps
      const [machines] = await db4Promise.query('SELECT machine_id, asset_number FROM pmp_machines');
      const [defaultOps] = await db4Promise.query('SELECT machine_id, description FROM pmp_default_operations');

      const machineMap = new Map(); // Map<asset_number, machine_id>
      machines.forEach(m => machineMap.set(m.asset_number, m.machine_id));

      const opsMap = new Map(); // Map<machine_id, string[]>
      defaultOps.forEach(op => {
        if (!opsMap.has(op.machine_id)) {
          opsMap.set(op.machine_id, []);
        }
        opsMap.get(op.machine_id).push(op.description);
      });
      
      console.log(`Loaded ${machineMap.size} machines and ${opsMap.size} operation templates.`);

      // 3. Process each job from the JSON array
      for (const job of jobs) {
        const { asset_number, wo_number, scheduled_date } = job;

        if (!asset_number || !wo_number || !scheduled_date) {
          errors.push(`Skipping row, incomplete data: ${JSON.stringify(job)}`);
          continue; 
        }

        const machineId = machineMap.get(asset_number);
        if (!machineId) {
          errors.push(`Machine not found for asset number: ${asset_number}`);
          continue;
        }

        // --- This is the core logic ---
        try {
          // A) Create the Work Order
          const [woResult] = await db2Promise.query(
            'INSERT INTO pmp_work_orders (machine_id, wo_number, scheduled_date, status) VALUES (?, ?, ?, ?)',
            [machineId, wo_number, scheduled_date, 'Open']
          );
          const newWorkOrderId = woResult.insertId;

          // B) Find its default operations
          const operationsToCopy = opsMap.get(machineId);

          // C) Copy the operations
          if (operationsToCopy && operationsToCopy.length > 0) {
            const opsPlaceholders = operationsToCopy.map(() => '(?, ?)').join(', ');
            const opsValues = [];
            operationsToCopy.forEach(desc => {
              opsValues.push(newWorkOrderId, desc);
            });
            
            await db4Promise.query(
              `INSERT INTO pmp_work_order_operations (work_order_id, description) VALUES ${opsPlaceholders}`,
              opsValues
            );
          }
          createdCount++;

        } catch (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            errors.push(`Skipped: Work Order ${wo_number} already exists.`);
          } else {
            errors.push(`Failed to import WO ${wo_number}: ${err.message}`);
          }
        }
      }

    } catch (err) {
      console.error('Fatal import error:', err);
      return response.status(500).send({ error: `Fatal import error: ${err.message}` });
    }

    // 4. Finished! Send response.
    console.log(`Import finished. ${createdCount} jobs created.`);
    if (errors.length > 0) {
      return response.status(207).send({ 
        message: `Import partially successful. ${createdCount} jobs created.`,
        createdCount: createdCount,
        errors: errors 
      });
    }

    return response.status(201).send({ 
      message: `Import successful. ${createdCount} jobs created.`,
      createdCount: createdCount
    });
  },

  bulkImportPendingJobs: async (request, response) => {
    try {
      console.log('📦 bulkImportPendingJobs - incoming keys:', request.body && Object.keys(request.body));
      if (request.rawBody) {
        console.log('📦 bulkImportPendingJobs - raw body length:', request.rawBody.length);
        try {
          const rawParsed = JSON.parse(request.rawBody);
          console.log('📦 bulkImportPendingJobs - raw JSON keys:', rawParsed && Object.keys(rawParsed));
        } catch (e) {
          console.log('📦 bulkImportPendingJobs - raw body not JSON, first 200 chars:', request.rawBody.slice(0, 200));
        }
      }

      // Robust extraction for different payload shapes
      const payload = request.body;
      let jobsRaw = Array.isArray(payload) ? payload : (payload?.jobs ?? payload?.data ?? payload?.payload?.jobs ?? payload?.payload?.data);
      let category = payload?.category ?? payload?.payload?.category ?? payload?.importCategory;

      // If jobs is a JSON string, attempt to parse
      if (typeof jobsRaw === 'string') {
        try { jobsRaw = JSON.parse(jobsRaw); } catch (e) { /* ignore parse error */ }
      }

      // Validate input presence
      if (!Array.isArray(jobsRaw) || jobsRaw.length === 0) {
        return response.status(400).send({ error: "Missing job data array." });
      }
      if (!category || typeof category !== 'string') {
        // Default category if not provided
        category = 'Maintenance';
      }

      // Normalize keys and drop unusable rows
      const normalizedJobs = jobsRaw
        .map(job => ({
          wo_number: job?.wo_number ?? job?.WO_NUMBER ?? job?.woNumber ?? job?.WO ?? job?.pwo ?? job?.PWO,
          machine_name: job?.machine_name ?? job?.machine ?? job?.machineName ?? job?.MACHINE_NAME,
          asset_number: job?.asset_number ?? job?.asset ?? job?.assetNumber ?? job?.ASSET_NUMBER,
        }))
        .filter(job => job.wo_number && (job.asset_number || job.machine_name));

      if (normalizedJobs.length === 0) {
        return response.status(400).send({ error: "No valid job rows after normalization." });
      }

      console.log(`📥 Received ${jobsRaw.length} jobs; ${normalizedJobs.length} valid after normalization; category: ${category}`);

      // Resolve machine_id from asset_number or machine_name (with normalization)
      const normalizeAsset = (val) => String(val || '').trim().replace(/[-\s]/g, '').toUpperCase();
      const normalizeName = (val) => String(val || '').trim().toLowerCase();

      const db4Promise = db4.promise();
      const [machines] = await db4Promise.query('SELECT machine_id, asset_number, machine_name FROM pmp_machines');
      const assetToId = new Map();
      const nameToId = new Map();
      machines.forEach(m => {
        const aKey = normalizeAsset(m.asset_number);
        const nKey = normalizeName(m.machine_name);
        if (aKey) assetToId.set(aKey, m.machine_id);
        if (nKey) nameToId.set(nKey, m.machine_id);
      });

      const errors = [];
      const valuesToInsert = [];
      const missingMachines = [];

      // First pass: try to match existing machines
      normalizedJobs.forEach((job, idx) => {
        const assetKeyRaw = job.asset_number !== undefined && job.asset_number !== null ? job.asset_number : '';
        const nameKeyRaw = job.machine_name ? job.machine_name : undefined;
        const assetKey = normalizeAsset(assetKeyRaw);
        const nameKey = nameKeyRaw ? normalizeName(nameKeyRaw) : undefined;
        const machineId = (assetKey && assetToId.get(assetKey)) || (nameKey ? nameToId.get(nameKey) : undefined);

        if (!machineId) {
          missingMachines.push({ idx, assetKeyRaw, nameKeyRaw });
          return;
        }

        valuesToInsert.push([
          machineId,
          job.wo_number,
          'Pending',
          category,
          new Date()
        ]);
      });

      // If we have missing machines, attempt to auto-register them in pmp_machines (asset_number + machine_name)
      if (missingMachines.length) {
        const uniqueNewMachines = new Map(); // key: normalized asset|name
        missingMachines.forEach(({ assetKeyRaw, nameKeyRaw }) => {
          const key = `${normalizeAsset(assetKeyRaw)}|${normalizeName(nameKeyRaw)}`;
          if (!uniqueNewMachines.has(key)) {
            uniqueNewMachines.set(key, {
              asset_number: assetKeyRaw || null,
              machine_name: nameKeyRaw || assetKeyRaw || 'Pending Machine',
            });
          }
        });

        const insertRows = Array.from(uniqueNewMachines.values())
          .filter(r => r.asset_number || r.machine_name);

        if (insertRows.length) {
          console.log(`🆕 Attempting to register ${insertRows.length} machines to pmp_machines for unmatched assets/names...`);
          try {
            const sqlInsertMachines = 'INSERT IGNORE INTO pmp_machines (asset_number, machine_name) VALUES ?';
            const rows = insertRows.map(r => [r.asset_number, r.machine_name]);
            await db4Promise.query(sqlInsertMachines, [rows]);
          } catch (e) {
            console.log('⚠️ Auto-register machines failed:', e.message);
          }

          // Refresh maps after attempting inserts
          const [machines2] = await db4Promise.query('SELECT machine_id, asset_number, machine_name FROM pmp_machines');
          assetToId.clear();
          nameToId.clear();
          machines2.forEach(m => {
            const aKey = normalizeAsset(m.asset_number);
            const nKey = normalizeName(m.machine_name);
            if (aKey) assetToId.set(aKey, m.machine_id);
            if (nKey) nameToId.set(nKey, m.machine_id);
          });

          // Retry unmatched rows
          missingMachines.forEach(({ idx, assetKeyRaw, nameKeyRaw }) => {
            const assetKey = normalizeAsset(assetKeyRaw);
            const nameKey = nameKeyRaw ? normalizeName(nameKeyRaw) : undefined;
            const machineId = (assetKey && assetToId.get(assetKey)) || (nameKey ? nameToId.get(nameKey) : undefined);
            const job = normalizedJobs[idx];
            if (machineId && job) {
              valuesToInsert.push([
                machineId,
                job.wo_number,
                'Pending',
                category,
                new Date()
              ]);
            } else {
              errors.push(`Row ${idx}: machine not found for asset ${assetKeyRaw}${nameKeyRaw ? ` / name ${nameKeyRaw}` : ''}`);
            }
          });
        }
      }

      if (valuesToInsert.length === 0) {
        return response.status(400).send({ error: "No valid job rows after machine lookup.", details: errors });
      }

      console.log(`📦 Machine map size: assets=${assetToId.size} names=${nameToId.size}; ready to insert ${valuesToInsert.length} rows (skipped ${errors.length})`);
      if (errors.length) {
        console.log('📄 Sample unmatched rows (first 10):', errors.slice(0, 10));
      }

      // Build INSERT query aligned to table columns
      const sql = `
        INSERT INTO pmp_pending_jobs 
        (machine_id, wo_number, status, category, created_at) 
        VALUES ?
      `;

      db4.query(sql, [valuesToInsert], (err, result) => {
        if (err) {
          console.error('❌ Database Insertion Error:', err.message);
          return response.status(500).send({ 
            error: "Database insertion failed", 
            details: err.message 
          });
        }
        console.log(`✨ Successfully imported ${result.affectedRows} pending jobs.`);
        return response.status(201).send({ 
          message: "Import successful", 
          createdCount: result.affectedRows,
          received: jobsRaw.length,
          normalized: normalizedJobs.length,
          inserted: valuesToInsert.length,
          skippedCount: errors.length,
          skippedSamples: errors.slice(0, 10)
        });
      });

    } catch (error) {
      console.error('❌ Import Error:', error.message);
      return response.status(500).send({ 
        error: "Import processing failed", 
        details: error.message 
      });
    }
  },

readPendingJobs: async (request, response) => {
        const sql = `
            SELECT 
                pj.pending_id, 
                pj.wo_number,
                pj.created_at,
                m.machine_name,
                m.asset_number
            FROM pmp_pending_jobs AS pj
            JOIN pmp_machines AS m ON pj.machine_id = m.machine_id
            WHERE pj.status = 'Pending' -- or 'Assigned', depending on your logic
            ORDER BY pj.wo_number;
        `;
        
        db4.query(sql, (err, result) => {
            if (err) {
                console.error('❌ Database READ Error:', err.message);
                return response.status(500).send({ error: "Read failed" });
            }
            return response.status(200).send(result);
        });
    },

    createPendingJob: async (request, response) => {
        // Note: We get machine_id directly from the frontend
        const { machine_id, wo_number } = request.body;

        if (!machine_id || !wo_number) {
            return response.status(400).send({ error: "Missing machine_id or wo_number" });
        }
        
        const sql = "INSERT INTO pmp_pending_jobs (machine_id, wo_number, status) VALUES (?, ?, ?)";
        
        db4.query(sql, [machine_id, wo_number, 'Pending'], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return response.status(409).send({ error: "That Work Order number already exists." });
                }
                console.error('❌ Database CREATE Error (pending_job):', err.message);
                return response.status(500).send({ error: "Database insertion failed", details: err.message });
            }
            return response.status(201).send({ message: "Pending job created", insertedId: result.insertId });
        });
    },

    /**
     * UPDATE: Update a pending job (e.g., fix a typo in the WO number)
     * Called by: PUT /part/pending-job/:id
     */
    updatePendingJob: async (request, response) => {
        const { id } = request.params; // This is the 'pending_id'
        const { machine_id, wo_number } = request.body;
        
        const sql = "UPDATE pmp_pending_jobs SET machine_id = ?, wo_number = ? WHERE pending_id = ?";

        db4.query(sql, [machine_id, wo_number, id], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return response.status(409).send({ error: "That Work Order number already exists." });
                }
                console.error('❌ Database UPDATE Error (pending_job):', err.message);
                return response.status(500).send({ error: "Database update failed", details: err.message });
            }
            if (result.affectedRows === 0) {
                return response.status(404).send({ error: "Job not found" });
            }
            return response.status(200).send({ message: "Pending job updated" });
        });
    },

    /**
     * DELETE: Delete a job from the pending list
     * Called by: DELETE /part/pending-job/:id
     */
    deletePendingJob: async (request, response) => {
        const { id } = request.params; // This is the 'pending_id'
        const sql = "DELETE FROM pmp_pending_jobs WHERE pending_id = ?";
        
        db4.query(sql, [id], (err, result) => {
            if (err) {
                console.error('❌ Database DELETE Error (pending_job):', err.message);
                return response.status(500).send({ error: "Database delete failed", details: err.message });
            }
            if (result.affectedRows === 0) {
                return response.status(404).send({ error: "Job not found" });
            }
            return response.status(200).send({ message: "Pending job deleted" });
        });
    },

    /**
     * ASSIGN JOBS: This is the core logic.
     * It moves jobs from 'pending' to 'live' work orders.
     * Called by: POST /part/assign-jobs
     */
   assignJobs: async (request, response) => {
    const { jobIds, scheduled_date } = request.body; 

    if (!jobIds || !scheduled_date || jobIds.length === 0) {
        return response.status(400).send({ error: "Missing job IDs or scheduled date." });
    }

    // 1. Get the promise-wrapped pool
    const pool = db4.promise();
    let connection;
    let assignedCount = 0;
    const errors = [];

    try {
        // 2. CHECK OUT a dedicated connection from the pool
        connection = await pool.getConnection();

        for (const pendingId of jobIds) {
            try {
                // 3. Start the transaction on THIS SPECIFIC connection
                await connection.beginTransaction(); 

                // 1. Get the pending job info (using 'connection', not 'pool')
                const [pendingRows] = await connection.query(
                    'SELECT machine_id, wo_number FROM pmp_pending_jobs WHERE pending_id = ? AND status = ?',
                    [pendingId, 'Pending']
                );

                if (pendingRows.length === 0) {
                    throw new Error(`Job ID ${pendingId} is not pending.`);
                }
                const pendingJob = pendingRows[0];
                const machineId = pendingJob.machine_id;

                // 2. Create the new "live" work order
                const [woResult] = await connection.query(
                    'INSERT INTO pmp_work_orders (machine_id, wo_number, scheduled_date, status) VALUES (?, ?, ?, ?)',
                    [machineId, pendingJob.wo_number, scheduled_date, 'Open']
                );
                const newWorkOrderId = woResult.insertId;

                // 3. Find all default operations
                const [opsToCopy] = await connection.query(
                    'SELECT description FROM pmp_default_operations WHERE machine_id = ?',
                    [machineId]
                );

                // 4. Copy those operations
                if (opsToCopy.length > 0) {
                    const opsPlaceholders = opsToCopy.map(() => '(?, ?)').join(', ');
                    const opsValues = [];
                    opsToCopy.forEach(op => {
                        opsValues.push(newWorkOrderId, op.description);
                    });
                    
                    await connection.query(
                        `INSERT INTO pmp_work_order_operations (work_order_id, description) VALUES ${opsPlaceholders}`,
                        opsValues
                    );
                }

                // 5. Update the pending job to "Assigned"
                await connection.query(
                    "UPDATE pmp_pending_jobs SET status = 'Assigned' WHERE pending_id = ?",
                    [pendingId]
                );

                // 6. Commit changes for THIS job
                await connection.commit();
                assignedCount++;

            } catch (err) {
                // If any step failed, roll back the transaction
                await connection.rollback();
                
                if (err.code === 'ER_DUP_ENTRY') {
                    errors.push(`Failed for WO ${pendingId}: This Work Order number already exists in the live table.`);
                } else {
                    errors.push(`Failed for WO ${pendingId}: ${err.message}`);
                }
            }
        } // End of for...loop

    } catch (globalErr) {
         // Catch issues getting the connection itself
         console.error("Database Connection Error:", globalErr);
         return response.status(500).send({ error: "Failed to connect to the database." });
    } finally {
        // 4. ALWAYS release the connection back to the pool, even if things crashed!
        if (connection) {
            connection.release();
        }
    }

    // --- Response Logic ---
    if (errors.length > 0 && assignedCount === 0) {
        return response.status(409).send({ 
            message: `All ${jobIds.length} jobs failed to assign. See errors.`,
            assignedCount: 0,
            errors: errors,
        });
    }
    if (errors.length > 0) {
        return response.status(207).send({ 
            message: `Assignment partially successful. ${assignedCount} jobs assigned.`,
            assignedCount: assignedCount,
            errors: errors,
        });
    }
    return response.status(201).send({
        message: `Assignment complete. ${assignedCount} jobs assigned.`,
        assignedCount: assignedCount,
        errors: [],
    });
},

    updatePMPTechnician: async (request, response) => {
        const { id } = request.params;
        
        const { 
            technician_name, 
            technician_note, 
            status,
            start_time,
            completed_time 
        } = request.body;

        // --- THE FIX ---
        // Manually format the date string to 'YYYY-MM-DD HH:MM:SS'
        // This stops Node.js/MySQL driver from doing timezone math (-7 hours).
        const formatDateForSQL = (isoString) => {
            if (!isoString) return null;
            // Takes "2025-11-23T10:30" and makes it "2025-11-23 10:30:00"
            return isoString.replace('T', ' ') + ':00';
        };

        const formattedStart = formatDateForSQL(start_time);
        const formattedComplete = formatDateForSQL(completed_time);

        const sql = `
            UPDATE pmp_work_orders 
            SET 
                technician_name = ?,
                technician_note = ?,
                status = ?,
                start_time = ?, 
                completed_time = ?
            WHERE work_order_id = ?
        `;
        
        db4.query(sql, [technician_name, technician_note, status, formattedStart, formattedComplete, id], (err, result) => {
            if (err) {
                console.error('❌ Database TECH UPDATE Error:', err.message);
                return response.status(500).send({ error: "Database update failed", details: err.message });
            }
            if (result.affectedRows === 0) {
                return response.status(404).send({ error: "Record not found" });
            }
            return response.status(200).send({ message: "Record updated by technician" });
        });
    },

    getOperationsForWorkOrder: async (request, response) => {
    try {
      const { work_order_id } = request.params;

      // Helper function to run DB queries with Promises (avoids callback hell)
      const queryDB = (sql, params) => {
        return new Promise((resolve, reject) => {
          db4.query(sql, params, (err, res) => {
            if (err) reject(err);
            else resolve(res);
          });
        });
      };

      // 1. First, try to fetch operations specifically saved for this Work Order
      let sql = "SELECT * FROM pmp_work_order_operations WHERE work_order_id = ?";
      let operations = await queryDB(sql, [work_order_id]);

      // 2. If records exist, return them immediately (Technician has already started working)
      if (operations.length > 0) {
        return response.status(200).send(operations);
      }

      // 3. If EMPTY, we need to fetch the DEFAULT operations for the machine.
      // Step 3a: Get the machine_id associated with this work_order_id
      const workOrderResult = await queryDB(
        "SELECT machine_id FROM pmp_work_orders WHERE work_order_id = ?", 
        [work_order_id]
      );

      if (workOrderResult.length === 0) {
        return response.status(404).send({ error: "Work Order not found" });
      }

      const machineId = workOrderResult[0].machine_id;

      // Step 3b: Fetch the default operations template for this machine
      // (Assuming your template table is named 'pmp_default_operations')
      sql = "SELECT * FROM pmp_default_operations WHERE machine_id = ? ORDER BY default_op_id";
      const defaultOps = await queryDB(sql, [machineId]);

      // 4. Return the defaults (The frontend will treat them as new unsaved lines)
      return response.status(200).send(defaultOps);

    } catch (error) {
      console.error('❌ Error fetching operations:', error.message);
      return response.status(500).send({ error: "Server error", details: error.message });
    }
  },

    /**
     * UPDATE: Update a *single* operation's status and note
     * Called by: PUT /part/work-order-operation/:operation_id
     */
   updateWorkOrderOperation: async (request, response) => {
        const { operation_id } = request.params;
        const { technician_note } = request.body; // Only get the note

        const sql = "UPDATE pmp_work_order_operations SET technician_note = ? WHERE operation_id = ?";
        
        db4.query(sql, [technician_note, operation_id], (err, result) => {
            if (err) {
                console.error('❌ Database UPDATE Error (wo_ops):', err.message);
                return response.status(500).send({ error: "Update failed", details: err.message });
            }
            if (result.affectedRows === 0) {
                return response.status(404).send({ error: "Operation not found" });
            }
            return response.status(200).send({ message: "Operation note updated" });
        });
    },

    unassignWorkOrder: async (request, response) => {
        const { id } = request.params; // This 'id' is the 'work_order_id'
        const db4Promise = db4.promise();
        let connection;

        try {
            connection = await db4Promise.getConnection();
            await connection.beginTransaction(); // START TRANSACTION

            // 1. Get the job's WO Number and Status before deleting
            const [jobRows] = await connection.query(
                'SELECT wo_number, status FROM pmp_work_orders WHERE work_order_id = ?',
                [id]
            );

            if (jobRows.length === 0) {
                throw new Error('Work Order not found.');
            }
            
            const job = jobRows[0];
            
            // 2. Add a business rule: CANNOT unassign a job that's already in progress or finished
            if (job.status !== 'Open') {
                throw new Error(`Cannot unassign job. Status is already '${job.status}'.`);
            }

            // 3. Delete the "live" work order.
            //    This will auto-delete its tasks in 'pmp_work_order_operations'
            await connection.query('DELETE FROM pmp_work_orders WHERE work_order_id = ?', [id]);

            // 4. Update the "pending" job, setting its status back to 'Pending'
            await connection.query(
                "UPDATE pmp_pending_jobs SET status = 'Pending' WHERE wo_number = ?",
                [job.wo_number]
            );

            // 5. If all steps worked, commit the changes
            await connection.commit();
            
            console.log(`✨ Job ${id} (WO: ${job.wo_number}) unassigned and returned to pending list.`);
            return response.status(200).send({ message: `Work Order ${job.wo_number} has been unassigned.` });

        } catch (err) {
            // If any step failed, roll back all changes
            if (connection) await connection.rollback();
            console.error(`Failed to unassign job ${id}:`, err.message);
            return response.status(500).send({ error: `Failed to unassign job: ${err.message}` });
        } finally {
            if (connection) connection.release();
        }
    },

getLiveWorkOrders: async (request, response) => {
        const sql = `
            SELECT 
                -- 1. List the normal columns you need explicitly
                wo.work_order_id,
                wo.machine_id,
                wo.wo_number,
                wo.scheduled_date,
                wo.status,
                wo.technician_name,
                wo.technician_note,
                wo.approved_by,
                wo.approved_date,

                -- 2. THE FIX: Format the time columns as Strings
                -- This stops the timezone conversion (+7 hours / -7 hours)
                DATE_FORMAT(wo.start_time, '%Y-%m-%dT%H:%i') as start_time,
                DATE_FORMAT(wo.completed_time, '%Y-%m-%dT%H:%i') as completed_time,

                -- 3. Get the joined data
                m.machine_name 
            FROM pmp_work_orders AS wo
            LEFT JOIN pmp_machines AS m ON wo.machine_id = m.machine_id
            ORDER BY wo.scheduled_date DESC;
        `;
        
        db4.query(sql, (err, result) => {
            if (err) {
                console.error('❌ Database READ Error (live_work_orders):', err.message);
                return response.status(500).send({ error: "Database read failed", details: err.message });
            }
            return response.status(200).send(result);
        });
    },


    createMachine: async (request, response) => {
        const { machine_name, asset_number } = request.body;
        
        const sql = "INSERT INTO pmp_machines (machine_name, asset_number) VALUES (?, ?)";
        
        db4.query(sql, [machine_name, asset_number], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return response.status(409).send({ error: "Duplicate Entry", details: "That Asset Number already exists." });
                }
                console.error('❌ Database CREATE Error (pmp_machines):', err.message);
                return response.status(500).send({ error: "Database insertion failed", details: err.message });
            }
            console.log(`✨ Machine created with ID: ${result.insertId}`);
            return response.status(201).send({ message: "Machine created", insertedId: result.insertId });
        });
    },

    /**
     * READ: Get all machines
     * Called by: GET /part/machines
     */
    readMachines: async (request, response) => {
        // This is the same as your 'getMachinesList' function
        const sql = "SELECT * FROM pmp_machines ORDER BY machine_name";
        
        db4.query(sql, (err, result) => {
            if (err) {
                console.error('❌ Database READ Error (pmp_machines):', err.message);
                return response.status(500).send({ error: "Database read failed", details: err.message });
            }
            return response.status(200).send(result);
        });
    },

    /**
     * UPDATE: Update an existing machine
     * Called by: PUT /part/machines/:id
     */
    updateMachine: async (request, response) => {
        const { id } = request.params;
        const { machine_name, asset_number } = request.body;
        
        const sql = "UPDATE pmp_machines SET machine_name = ?, asset_number = ? WHERE machine_id = ?";
        
        db4.query(sql, [machine_name, asset_number, id], (err, result) => {
            if (err) {
                 if (err.code === 'ER_DUP_ENTRY') {
                    return response.status(409).send({ error: "Duplicate Entry", details: "That Asset Number already exists." });
                }
                console.error('❌ Database UPDATE Error (pmp_machines):', err.message);
                return response.status(500).send({ error: "Database update failed", details: err.message });
            }
            if (result.affectedRows === 0) {
                return response.status(404).send({ error: "Machine not found" });
            }
            console.log(`✨ Machine ${id} updated.`);
            return response.status(200).send({ message: "Machine updated" });
        });
    },

    /**
     * DELETE: Delete a machine
     * Called by: DELETE /part/machines/:id
     */
    deleteMachine: async (request, response) => {
        const { id } = request.params;
        const sql = "DELETE FROM pmp_machines WHERE machine_id = ?";
        
        db4.query(sql, [id], (err, result) => {
            if (err) {
                // Handle foreign key constraint error
                if (err.code === 'ER_ROW_IS_REFERENCED_2') {
                     return response.status(409).send({ error: "Cannot delete: Machine is in use", details: "This machine has pending jobs or operations. You must delete them first." });
                }
                console.error('❌ Database DELETE Error (pmp_machines):', err.message);
                return response.status(500).send({ error: "Database delete failed", details: err.message });
            }
            if (result.affectedRows === 0) {
                return response.status(404).send({ error: "Machine not found" });
            }
            console.log(`✨ Machine ${id} deleted.`);
            return response.status(200).send({ message: "Machine deleted" });
        });
    },

    getOpenJobCount: async (request, response) => {
        const sql = "SELECT COUNT(*) as openJobs FROM pmp_work_orders WHERE status = 'Open'";
        
        db4.query(sql, (err, result) => {
            if (err) {
                console.error('❌ Database COUNT Error (work_orders):', err.message);
                return response.status(500).send({ error: "Database read failed", details: err.message });
            }
            // Send back the count, e.g., { "openJobs": 5 }
            return response.status(200).send(result[0]);
        });
    },

   getCompletedJobs: async (request, response) => {
        // 1. Get the filters
        const { month, year, date } = request.query;

        let sql = `
            SELECT 
                wo.work_order_id,
                wo.wo_number,
                wo.status,
                wo.technician_name,
                wo.approved_by,
                DATE_FORMAT(wo.completed_time, '%Y-%m-%dT%H:%i') as completed_time,
                DATE_FORMAT(wo.approved_date, '%Y-%m-%d') as approved_date,
                m.machine_name 
            FROM pmp_work_orders AS wo
            LEFT JOIN pmp_machines AS m ON wo.machine_id = m.machine_id
            WHERE wo.status = 'Completed'
        `;

        const params = [];

        // 2. Apply Filters (PRIORITY: Date > Month/Year)
        if (date) {
            // If a specific date is provided, filter by that EXACT date
            sql += ` AND DATE(wo.completed_time) = ?`;
            params.push(date);
        } 
        else {
            // Otherwise, check for Month/Year
            if (month && year) {
                sql += ` AND MONTH(wo.completed_time) = ? AND YEAR(wo.completed_time) = ?`;
                params.push(month, year);
            } else if (year) {
                sql += ` AND YEAR(wo.completed_time) = ?`;
                params.push(year);
            }
        }

        // 3. Always sort by newest first
        sql += ` ORDER BY wo.completed_time DESC`;
        
        db4.query(sql, params, (err, result) => {
            if (err) {
                console.error('❌ Database READ Error (completed_jobs):', err.message);
                return response.status(500).send({ error: "Read failed", details: err.message });
            }
            return response.status(200).send(result);
        });
    },

    getEBRData: async (request, response) => {
        // Get filter parameters from the URL query
        const { start_time, end_time, batch } = request.query;

        // --- 1. Identify the table and connection ---
        // I'm using 'db' (DB_DATABASE1) and the table name from your screenshot.
        // PLEASE VERIFY this is the correct table name.
// --- 1. Identify the table and connection ---
        const TABLE_NAME = "`cMT-GEA-L3_PMA_KWmeter_data`"; 
        const connectionToUse = db; // Using 'db2' for parammachine_saka

        // --- 2. Build the SQL Query (UPDATED) ---
        let params = [];
        let sql = `
            SELECT 
                \`time@timestamp\` as timestamp, 
                data_format_0 as batch_id, 
                data_format_1 as process_id, 
                data_format_2 as 'Chopper RPM',
                data_format_3 as 'Chopper Current',
                data_format_4 as 'Impeller RPM',
                data_format_5 as 'Impeller Current',
                data_format_6 as 'Impeller KWh'
            FROM ${TABLE_NAME}
            WHERE 1=1
        `; // 'WHERE 1=1' is a trick to make appending 'AND' clauses easy

        // Dynamically add filters if they were provided
        if (start_time && end_time) {
            sql += " AND \`time@timestamp\` BETWEEN ? AND ?";
            params.push(start_time, end_time);
        }
        if (batch) {
            sql += " AND data_format_0 = ?";
            params.push(batch);
        }

        sql += " ORDER BY \`time@timestamp\` DESC"; // Show newest first

        // --- 3. Execute the Query (using callback style) ---
        connectionToUse.query(sql, params, (err, result) => {
            if (err) {
                console.error('❌ Database READ Error (EBR Data):', err.message);
                return response.status(500).send({ error: "Database read failed", details: err.message });
            }
            return response.status(200).send(result);
        });
    },

    /**
     * Fetches all combined details for a single Work Order by its WO Number.
     * This is used to auto-fill the entire form.
     */
getWorkOrderDetailsByNumber: async (request, response) => {
        const { wo_number } = request.params;

        // 1. GET MAIN DETAILS
        const mainSql = `
            SELECT 
                w.work_order_id, 
                w.machine_id, 
                w.technician_name, 
                
                -- --- THE FIX IS HERE ---
                -- We format it inside SQL. This prevents Node.js from doing timezone math.
                -- The 'T' in the middle makes it ready for the frontend input.
                DATE_FORMAT(w.start_time, '%Y-%m-%dT%H:%i') as start_time,
                DATE_FORMAT(w.completed_time, '%Y-%m-%dT%H:%i') as completed_time,
                -- -----------------------

                w.scheduled_date, 
                w.approved_by,
                w.approved_date,
                m.asset_number, 
                m.asset_Area, 
                m.gl_Charging, 
                m.asset_Activity, 
                m.wo_description 
            FROM pmp_work_orders w
            JOIN pmp_machines m ON w.machine_id = m.machine_id
            WHERE w.wo_number = ?
        `;

        db4.query(mainSql, [wo_number], (err, mainResult) => {
            if (err) return response.status(500).send({ error: "Read failed", details: err.message });
            if (mainResult.length === 0) return response.status(404).send({ error: "Work Order not found" });

            const mainData = mainResult[0];
            const { work_order_id } = mainData; 

            // 2. GET OPERATIONS 
            const operationsSql = `
                SELECT 
                    operation_id AS id, 
                    description, 
                    technician_note 
                FROM pmp_work_order_operations 
                WHERE work_order_id = ?
                ORDER BY operation_id ASC;
            `;
            
            db4.query(operationsSql, [work_order_id], (opsErr, opsResult) => {
                if (opsErr) return response.status(500).send({ error: "Read failed", details: opsErr.message });

                const responseData = {
                    ...mainData,
                    operations: opsResult 
                };

                return response.status(200).send(responseData);
            });
        });
    },

    approveWorkOrder: async (request, response) => {
        const { wo_number } = request.params;
        const { approver_name } = request.body; // e.g., "Fauzi Perdana"

        // Update the row with the name and CURRENT timestamp
        const sql = `
            UPDATE pmp_work_orders 
            SET approved_by = ?, approved_date = NOW() 
            WHERE wo_number = ?
        `;

        db4.query(sql, [approver_name, wo_number], (err, result) => {
            if (err) {
                console.error("❌ Approval Error:", err);
                return response.status(500).send({ error: "Approval failed" });
            }
            return response.status(200).send({ message: "Work Order Approved", approvedBy: approver_name });
        });
    },

    submitForApproval: async (request, response) => {
        const { wo_number } = request.params;
        
        // Update status to 'Pending Approval'
        const sql = "UPDATE pmp_work_orders SET status = 'Pending Approval' WHERE wo_number = ?";

        db4.query(sql, [wo_number], (err, result) => {
            if (err) return response.status(500).send({ error: "Submission failed" });
            return response.status(200).send({ message: "Submitted for Approval", status: "Pending Approval" });
        });
    },

    // 1. Fetch list of WOs waiting for approval
    getPendingApprovals: async (request, response) => {
        const sql = `
            SELECT 
                w.wo_number, 
                w.scheduled_date, 
                w.technician_name, 
                m.machine_name, 
                m.asset_number
            FROM pmp_work_orders w
            JOIN pmp_machines m ON w.machine_id = m.machine_id
            WHERE w.status = 'Pending Approval'
            ORDER BY w.scheduled_date DESC
        `;

        db4.query(sql, (err, result) => {
            if (err) return response.status(500).send({ error: "Fetch failed" });
            return response.status(200).send(result);
        });
    },

    // 2. Approve Multiple WOs at once
    bulkApproveWorkOrders: async (request, response) => {
        const { wo_numbers } = request.body;

        // 1. Get the user data from the middleware
        // (This works because your middleware did: req.user = verifiedUser)
        const user = request.user; 
        
        // Safety check: In case middleware failed or wasn't used
        if (!user) {
            return response.status(401).send({ error: "User not authenticated" });
        }

        // 2. Get the name. 
        // IMPORTANT: Check your database/login code to see what you called it.
        // It is usually user.username, user.name, or user.fullname.
        const approver_name = user.username || user.name || "Unknown Supervisor";

        if (!wo_numbers || wo_numbers.length === 0) {
            return response.status(400).send({ error: "No WOs selected" });
        }

        const placeholders = wo_numbers.map(() => '?').join(',');
        
        const sql = `
            UPDATE pmp_work_orders 
            SET status = 'Completed', approved_by = ?, approved_date = NOW() 
            WHERE wo_number IN (${placeholders})
        `;

        const params = [approver_name, ...wo_numbers];

        db4.query(sql, params, (err, result) => {
            if (err) return response.status(500).send({ error: "Bulk approval failed" });
            return response.status(200).send({ message: "Selected WOs Approved by " + approver_name });
        });
    },

    getUsers: async (request, response) => {
        const sql = "SELECT id_users, name FROM users WHERE level = 4 ORDER BY name ASC";

        // 1. Check if connection is dead/closed
        if (db.state === 'disconnected' || db4.state === 'protocol_error') {
            console.log("⚠️ DB4 was closed. Reconnecting...");
            db4.connect(); // Force wake up
        }

        try {
            db.query(sql, (err, result) => {
                if (err) {
                    console.error("❌ SQL Error:", err.message);
                    // If it's still closed, we can't do anything but fail
                    return response.status(500).send({ error: "Database connection failed." });
                }
                return response.status(200).send(result);
            });
        } catch (error) {
            console.error("Server Error:", error);
            return response.status(500).send({ error: "Internal Server Error" });
        }
    },


    // GET LIVE WORK ORDERS (Filtered by Token ID)
// GET LIVE WORK ORDERS (Filtered by Token ID)
 liveWorkOrders: async (request, response) => {
      // 1. Get User Info from the Token
      const currentUser = request.user;

      if (!currentUser) {
        return response.status(401).send({ error: "Unauthorized. No token found." });
      }

      // 2. Ensure DB connection is alive
      if (db4.state === 'disconnected' || db4.state === 'protocol_error') {
        console.log("⚠️ DB4 was closed. Reconnecting...");
        db4.connect();
      }

      // console.log(`🔍 Fetching ALL incomplete PWO (user context: ${currentUser.id})`);

      try {
        const sqlAll = `
          SELECT 
            wo.work_order_id,
            wo.wo_number,
            wo.status,
            wo.category,
            wo.scheduled_date,
            wo.technician_id,
            m.machine_name,
            m.asset_number
          FROM pmp_work_orders AS wo
          LEFT JOIN pmp_machines AS m ON wo.machine_id = m.machine_id
          WHERE wo.status != 'Completed'
          AND wo.wo_number LIKE 'PWO%'
          ORDER BY wo.scheduled_date ASC
        `;

        db4.query(sqlAll, [], (err, rows) => {
          if (err) {
            console.error("❌ Error fetching all incomplete PWO:", err);
            return response.status(500).send({ error: err.message });
          }

          console.log(`✅ Successfully fetched ${rows.length} incomplete PWO tasks`);
          return response.status(200).json(rows);
        });

      } catch (error) {
        console.error("❌ Unexpected error in liveWorkOrders:", error);
        return response.status(500).send({ error: error.message });
      }
    },

    // NEW: Only PWO assigned to the logged-in user
    liveWorkOrdersAssigned: async (request, response) => {
      const currentUser = request.user;

      if (!currentUser) {
        return response.status(401).send({ error: "Unauthorized. No token found." });
      }

      if (db4.state === 'disconnected' || db4.state === 'protocol_error') {
        console.log("⚠️ DB4 was closed. Reconnecting...");
        db4.connect();
      }

      // console.log(`🔍 Fetching ASSIGNED incomplete PWO for user ${currentUser.id}`);

      try {
        const sqlMyPwo = `
          SELECT 
            wo.work_order_id,
            wo.wo_number,
            wo.status,
            wo.category,
            wo.scheduled_date,
            wo.technician_id,
            m.machine_name,
            m.asset_number
          FROM pmp_work_orders AS wo
          LEFT JOIN pmp_machines AS m ON wo.machine_id = m.machine_id
          WHERE wo.status != 'Completed'
          AND wo.wo_number LIKE 'PWO%'
          AND wo.technician_id = ?
          ORDER BY wo.scheduled_date ASC
        `;

        db4.query(sqlMyPwo, [currentUser.id], (err, rows) => {
          if (err) {
            console.error("❌ Error fetching assigned PWO:", err);
            return response.status(500).send({ error: err.message });
          }

          // console.log(`✅ Assigned PWO for user ${currentUser.id}: ${rows.length}`);
          return response.status(200).json(rows);
        });

      } catch (error) {
        console.error("❌ Unexpected error in liveWorkOrdersAssigned:", error);
        return response.status(500).send({ error: error.message });
      }
    },
/*
    liveWorkOrders: async (req, res) => {
  try {
    const userId = req.user.id; // Get user ID from token
    console.log('Fetching work orders for user ID:', userId);
    
    // Query work orders assigned to this user
    const query = `
      SELECT * FROM work_orders 
      WHERE assigned_technician_id = ${db.escape(userId)}
      ORDER BY scheduled_date ASC
    `;
    
    db.query(query, (err, result) => {
      if (err) {
        console.error('Error fetching work orders:', err);
        return res.status(500).send({ error: 'Database error' });
      }
      return res.status(200).send(result);
    });
  } catch (error) {
    console.error('Error in liveWorkOrders:', error);
    res.status(500).send({ error: 'Server error' });
  }
},
    */

getTechnicians: async (req, res) => {
    try {
      console.log('\n========== GET TECHNICIANS ==========');
      console.log('Fetching all users with level 4 (technicians)');
      
      const getTechniciansQuery = `SELECT id_users, name, email, username, level, imagePath FROM users WHERE level = 4`;
      
      const technicians = await query(getTechniciansQuery);
      
      console.log(`Found ${technicians.length} technicians`);
      console.log('====================================\n');
      
      return res.status(200).send({
        message: "Technicians fetched successfully",
        data: technicians
      });
    } catch (error) {
      console.error('❌ Error fetching technicians:', error);
      res.status(error.statusCode || 500).send({
        message: 'Error fetching technicians',
        error: error.message
      });
    }
  },

 getVortexData: async (req, res) => {
    try {
      console.log('\n========== GET VORTEX DATA ==========');
      console.log('Fetching all records from vortex_flowmeter');

      // We format the date here so the frontend receives a clean string
      const sql = `
        SELECT 
          id, 
          totalizer, 
          flowmeter, 
          suhu, 
          tekanan, 
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as formatted_date
        FROM vortex_flowmeter 
        ORDER BY created_at ASC
      `;

      const data = await new Promise((resolve, reject) => {
        db3.query(sql, (err, result) => {
          if (err) return reject(err);
          resolve(result);
        });
      });

      console.log(`Found ${data.length} records`);
      console.log('====================================\n');

      return res.status(200).send({
        message: "Vortex data fetched successfully",
        data: data
      });

    } catch (error) {
      console.error('❌ Error fetching vortex data:', error);
      res.status(error.statusCode || 500).send({
        message: 'Error fetching vortex data',
        error: error.message
      });
    }
  },

getOEEAvailability1: async (req, res) => {
    try {
        console.log('\n========== GET OEE AVAILABILITY (TWO-COLUMN MODE) ==========');

        // Simple query: Fetch everything for the shift in one row
        const sql = `
            SELECT 
                MAX(runtime) as max_run,
                MAX(planned_stoptime) as max_planned,
                MIN(planned_stoptime) as min_planned,
                MAX(unplanned_stoptime) as max_unplanned,
                MIN(unplanned_stoptime) as min_unplanned
            FROM fette_machine_dummy 
            WHERE record_time BETWEEN '2025-12-22 06:30:00' AND '2025-12-22 15:00:00'
        `;

        const dbResults = await new Promise((resolve, reject) => {
            db4.query(sql, (err, result) => {
                if (err) return reject(err);
                resolve(result[0]); // Returns the single row of aggregates
            });
        });

        const SHIFT_TOTAL_MINUTES = 510;
        const DATA_INTERVAL = 10; // Change to 1 when machine interval changes

        // 1. Calculate Durations using the Delta logic
        // We add the interval to unplanned to capture the single-row event correctly
        const plannedDowntime = (dbResults.max_planned || 0) - (dbResults.min_planned || 0);
        const unplannedDowntime = (dbResults.max_unplanned || 0) > 0 
            ? (dbResults.max_unplanned - dbResults.min_unplanned) 
            : 0;
            
        // 2. Runtime (Max cumulative value in shift)
        const totalRuntime = dbResults.max_run || 0;

        // 3. Availability Formula: (Runtime - Unplanned - Planned) / (510 - Planned)
        const numerator = totalRuntime - unplannedDowntime;
        const denominator = SHIFT_TOTAL_MINUTES - plannedDowntime;

        let availabilityPercentage = 0;
        if (denominator > 0) {
            availabilityPercentage = (numerator / denominator) * 100;
        }

        return res.status(200).send({
            message: "Availability calculated with new table structure",
            data: {
                runtime: totalRuntime,           // Results in 390
                planned_downtime: plannedDowntime, // Results in 110
                unplanned_downtime: unplannedDowntime, // Results in 10
                availability: availabilityPercentage.toFixed(2) + "%"
            }
        });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).send({ message: 'Error', error: error.message });
    }
},

getOEEPerformance1: async (req, res) => {
    try {
        console.log('\n========== GET & SAVE OEE PERFORMANCE DATA ==========');
        console.log('Calculating Performance for Shift 1 (06:30 - 15:00)');

        // SQL to fetch cumulative totals using your new table structure
        const sqlFetch = `
            SELECT 
                MAX(total_product) as max_product,
                MIN(total_product) as min_product,
                MAX(runtime) as max_run
            FROM fette_machine_dummy 
            WHERE record_time BETWEEN '2025-12-22 06:30:00' AND '2025-12-22 15:00:00'
        `;

        const dbResults = await new Promise((resolve, reject) => {
            db4.query(sqlFetch, (err, result) => {
                if (err) return reject(err);
                resolve(result[0]);
            });
        });

        // --- OEE PERFORMANCE CALCULATION ---
        const TARGET_PER_MINUTE = 5833; 
        
        // 1. Calculate Actual Total Output (Yield)
        const totalOutput = (dbResults.max_product || 0) - (dbResults.min_product || 0);

        // 2. Get Actual Runtime (Matches your frontend key 'actual_runtime')
        const runtime = dbResults.max_run || 0;

        // 3. Calculate Potential Output (Runtime * Target)
        const potentialOutput = runtime * TARGET_PER_MINUTE;

        // 4. Performance Formula
        let performancePercentage = 0;
        if (potentialOutput > 0) {
            performancePercentage = (totalOutput / potentialOutput) * 100;
        }

        const performanceString = performancePercentage.toFixed(2) + "%";

        // --- DATABASE INSERT LOGIC ---
        // Ensuring historical tracking in your new performance log table
        const sqlInsert = `
            INSERT INTO oee_performance_logs_dummy 
            (shift_name, actual_output, actual_runtime, potential_output, performance_value)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        const insertValues = [
            'Shift 1', 
            totalOutput, 
            runtime, 
            potentialOutput, 
            performancePercentage.toFixed(2)
        ];

        await new Promise((resolve, reject) => {
            db4.query(sqlInsert, insertValues, (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });

        console.log(`✅ Performance logged: ${performanceString}`);
        console.log('====================================================\n');

        // Returning the data object with keys that match your frontend
        return res.status(200).send({
            message: "Performance calculated and logged successfully",
            data: {
                actual_output: totalOutput,
                actual_runtime: runtime,
                ideal_target_rate: TARGET_PER_MINUTE,
                potential_output: potentialOutput,
                performance: performanceString
            }
        });

    } catch (error) {
        console.error('❌ Error processing Performance data:', error);
        res.status(500).send({
            message: 'Error processing Performance data',
            error: error.message
        });
    }
},

getOEEQuality1: async (req, res) => {
    try {
        console.log('\n========== GET OEE QUALITY DATA ==========');
        console.log('Calculating Quality for Shift 1 (06:30 - 15:00)');

        // SQL to fetch the cumulative totals for Product and Rejects
        const sql = `
            SELECT 
                MAX(total_product) as max_product,
                MIN(total_product) as min_product,
                MAX(reject) as max_reject,
                MIN(reject) as min_reject
            FROM fette_machine_dummy 
            WHERE record_time BETWEEN '2025-12-22 06:30:00' AND '2025-12-22 15:00:00'
        `;

        const dbResults = await new Promise((resolve, reject) => {
            db4.query(sql, (err, result) => {
                if (err) return reject(err);
                resolve(result[0]);
            });
        });

        // --- OEE QUALITY CALCULATION ---
        
        // 1. Calculate Actual Yield (Total Product produced in shift)
        const totalProduct = dbResults.max_product - dbResults.min_product;

        // 2. Calculate Total Rejects in shift
        const totalRejects = dbResults.max_reject - dbResults.min_reject;

        // 3. Calculate Good Product (Total - Reject)
        const goodProduct = totalProduct - totalRejects;

        // 4. Quality Formula: (Total Product - Reject) / Total Product
        let qualityPercentage = 0;
        if (totalProduct > 0) {
            qualityPercentage = (goodProduct / totalProduct) * 100;
        }

        console.log(`Calculation Complete: ${qualityPercentage.toFixed(2)}%`);
        console.log('==========================================\n');

        return res.status(200).send({
            message: "OEE Quality calculated successfully",
            data: {
                total_product: totalProduct,
                total_rejects: totalRejects,
                good_product: goodProduct,
                quality: qualityPercentage.toFixed(2) + "%"
            }
        });

    } catch (error) {
        console.error('❌ Error calculating Quality data:', error);
        res.status(500).send({
            message: 'Error calculating Quality data',
            error: error.message
        });
    }
},

generateDummyData24H: async (req, res) => {
    try {
        console.log('\n========== GENERATING 24H DATA (WITH SHIFT RESETS) ==========');
        
        // 1. Clear Table
        await new Promise((resolve, reject) => {
            db4.query("TRUNCATE TABLE fette_machine_dummy", (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        // 2. Setup Time Range (Today 06:30 to Tomorrow 06:30)
        const START_TIME = new Date('2025-12-22T06:30:00'); 
        const END_TIME = new Date('2025-12-23T06:30:00');   

        const TARGET_RPM = 1500;
        const PRODUCT_PER_MIN = 5833;

        // 3. Initialize Accumulators
        let accRuntime = 0;
        let accPlanned = 0;
        let accUnplanned = 0;
        let accProduct = 0;
        let accReject = 0;

        let currentTime = new Date(START_TIME);
        let batchValues = [];
        let rowCount = 0;

        // 4. Minute-by-Minute Loop
        while (currentTime <= END_TIME) {
            const hour = currentTime.getHours();
            const minute = currentTime.getMinutes();

            // --- RESET LOGIC (CRITICAL CHANGE) ---
            // If it is exactly the start of Shift 2 or Shift 3, RESET counters to 0
            if (hour === 15 && minute === 0) {
                console.log('🔄 Shift 2 Started: Resetting Counters to 0');
                accRuntime = 0; accPlanned = 0; accUnplanned = 0; accProduct = 0; accReject = 0;
            }
            if (hour === 22 && minute === 45) {
                console.log('🔄 Shift 3 Started: Resetting Counters to 0');
                accRuntime = 0; accPlanned = 0; accUnplanned = 0; accProduct = 0; accReject = 0;
            }
            
            // --- STATE MACHINE ---
            let isRunning = false;
            let isPlannedStop = false;
            let isUnplannedStop = false;

            // SHIFT 1 Logic (06:30 - 15:00)
            if (hour < 15 || (hour === 15 && minute === 0)) {
                if ((hour === 6 && minute >= 30) || (hour === 7 && minute === 0)) isPlannedStop = true; // Briefing
                else if (hour === 10 && minute < 15) isPlannedStop = true; // Break
                else if (hour === 12 && minute >= 15 && minute < 25) isUnplannedStop = true; // Fault
                else isRunning = true;
            }
            // SHIFT 2 Logic (15:00 - 22:45)
            else if (hour < 22 || (hour === 22 && minute <= 45)) {
                if (hour === 15 && minute < 30) isPlannedStop = true; // Handover
                else if (hour === 19 && minute < 30) isPlannedStop = true; // Dinner
                else if (hour === 21 && minute < 5) isUnplannedStop = true; // Jam
                else isRunning = true;
            }
            // SHIFT 3 Logic (22:45 - 06:30)
            else {
                // Logic for crossing midnight
                if ((hour === 22 && minute >= 45) || (hour === 23 && minute < 15)) isPlannedStop = true; // Handover
                else if (hour === 3 && minute < 15) isPlannedStop = true; // Snack
                else if (hour === 5 && minute < 10) isUnplannedStop = true; // Feeder Issue
                else isRunning = true;
            }

            // Override for exact shift boundaries (Handover starts)
            if (hour === 15 && minute === 0) { isPlannedStop = true; isRunning = false; }
            if (hour === 22 && minute === 45) { isPlannedStop = true; isRunning = false; }

            // --- INCREMENT ACCUMULATORS ---
            let rpm = 0;
            if (isRunning) {
                accRuntime += 1; 
                
                // Randomized Product (5400 - 5700)
                const randomProduct = Math.floor(Math.random() * 301) + 5400;
                accProduct += randomProduct;

                // Randomized Rejects (30 - 80)
                const randomReject = Math.floor(Math.random() * 51) + 30;
                accReject += randomReject;
                
                rpm = TARGET_RPM;
            } 
            else if (isPlannedStop) {
                accPlanned += 1;
            } 
            else if (isUnplannedStop) {
                accUnplanned += 1;
            }

            // --- PREPARE SQL ROW ---
            const year = currentTime.getFullYear();
            const month = String(currentTime.getMonth() + 1).padStart(2, '0');
            const day = String(currentTime.getDate()).padStart(2, '0');
            const hourStr = String(hour).padStart(2, '0');
            const minStr = String(minute).padStart(2, '0');
            const sqlTime = `${year}-${month}-${day} ${hourStr}:${minStr}:00`;

            batchValues.push([
                sqlTime, accRuntime, accPlanned, accUnplanned, accProduct, accReject, rpm
            ]);

            // Advance Time
            currentTime.setMinutes(currentTime.getMinutes() + 1);
            rowCount++;
        }

        // 5. Bulk Insert
        const chunkSize = 1000;
        for (let i = 0; i < batchValues.length; i += chunkSize) {
            const chunk = batchValues.slice(i, i + chunkSize);
            const sql = `INSERT INTO fette_machine_dummy (record_time, runtime, planned_stoptime, unplanned_stoptime, total_product, reject, rpm) VALUES ?`;
            
            await new Promise((resolve, reject) => {
                db4.query(sql, [chunk], (err) => {
                    if (err) reject(err);
                    resolve();
                });
            });
        }

        console.log(`✅ Success: Generated ${rowCount} rows with Shift Resets.`);
        res.status(200).send({ message: "Data generated with shift resets", rows: rowCount });

    } catch (error) {
        console.error('❌ Generation Failed:', error);
        res.status(500).send({ error: error.message });
    }
},

getUniversalOEE: async (req, res) => {
    try {
        // 1. Get parameters
        const { shift, date } = req.query; 
        const selectedShift = parseInt(shift) || 1;
        const selectedDate = date ? new Date(date) : new Date('2025-12-22'); // Default for testing
        
        // Date Formatting
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(selectedDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        // Next Day helper for Shift 3
        const nextDay = new Date(selectedDate);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayStr = nextDay.toISOString().split('T')[0];

        // 2. Define Time Range
        let startTimeStr, endTimeStr;
        switch (selectedShift) {
            case 1: startTimeStr = `${dateStr} 06:30:00`; endTimeStr = `${dateStr} 15:00:00`; break;
            case 2: startTimeStr = `${dateStr} 15:00:00`; endTimeStr = `${dateStr} 22:45:00`; break;
            case 3: startTimeStr = `${dateStr} 22:45:00`; endTimeStr = `${nextDayStr} 06:30:00`; break;
            default: return res.status(400).send({ message: "Invalid Shift ID" });
        }

        // Convert to Unix Timestamp (Double) + 7 Hour Offset
        const OFFSET_SECONDS = 7 * 3600; 
        const startTimestamp = (new Date(startTimeStr).getTime() / 1000) + OFFSET_SECONDS;
        const endTimestamp = (new Date(endTimeStr).getTime() / 1000) + OFFSET_SECONDS;

        console.log(`\n🔍 Calculating OEE for Shift ${selectedShift} on ${dateStr}`);

        // 3. Query (Snapshot Logic - Last Row)
        const sql = `
            SELECT 
                data_format_0 as last_run,
                data_format_4 as last_prod,       -- total_output
                data_format_2 as last_planned,    -- planned_dur
                data_format_3 as last_unplanned,  -- unplanned_dur
                data_format_6 as last_reject      -- total_reject
            FROM \`CMT-VIBRATION_oee_fette_mentah_data\` 
            WHERE \`time@timestamp\` BETWEEN ? AND ?
            ORDER BY \`time@timestamp\` DESC
            LIMIT 1
        `;

        const dbResults = await new Promise((resolve, reject) => {
            db4.query(sql, [startTimestamp, endTimestamp], (err, result) => {
                if (err) return reject(err);
                resolve(result[0] || {}); 
            });
        });

        // 4. Calculations (Reset Logic: Direct Reads)
        const SHIFT_MINUTES = (new Date(endTimeStr) - new Date(startTimeStr)) / 1000 / 60; 
        const TARGET_PER_MINUTE = 5833;

        const runtime = parseFloat(dbResults.last_run) || 0;
        const totalOutput = parseFloat(dbResults.last_prod) || 0;
        const totalRejects = parseFloat(dbResults.last_reject) || 0;
        const plannedDowntime = parseFloat(dbResults.last_planned) || 0;
        const unplannedDowntime = parseFloat(dbResults.last_unplanned) || 0;

        // Formulas
        const availNumerator = runtime;
        const availDenominator = SHIFT_MINUTES - plannedDowntime;
        const availability = availDenominator > 0 ? (availNumerator / availDenominator) * 100 : 0;

        const potentialOutput = runtime * TARGET_PER_MINUTE;
        const performance = potentialOutput > 0 ? (totalOutput / potentialOutput) * 100 : 0;

        const goodProduct = totalOutput - totalRejects;
        const quality = totalOutput > 0 ? (goodProduct / totalOutput) * 100 : 0;

        const oeeScore = (availability * performance * quality) / 10000;

        // 5. ⚡ AUTO-ARCHIVE TRIGGER ⚡
        // This is the magic. We save the EXACT numbers we just calculated.
        saveToLog(dateStr, selectedShift, {
            avail: availability,
            perf: performance,
            qual: quality,
            oee: oeeScore,
            tOut: totalOutput,
            tGood: goodProduct,
            tRej: totalRejects,
            tTime: SHIFT_MINUTES,
            tRun: runtime,
            tStop: SHIFT_MINUTES - runtime // Stop time derived from Shift - Run
        });

        // 6. Send Response
        res.status(200).send({
            message: `OEE Calculated & Archived for Shift ${selectedShift}`,
            shift_info: { shift_id: selectedShift, duration_minutes: SHIFT_MINUTES },
            data: {
                oee: oeeScore.toFixed(2) + "%",
                availability: {
                    availability: availability.toFixed(2) + "%",
                    numerator: availNumerator,
                    denominator: availDenominator,
                    runtime: runtime,
                    unplanned_downtime: unplannedDowntime,
                    planned_downtime: plannedDowntime
                },
                performance: {
                    performance: performance.toFixed(2) + "%",
                    actual_output: totalOutput,
                    target_rate: TARGET_PER_MINUTE,
                    actual_runtime: runtime,
                    potential_output: potentialOutput
                },
                quality: {
                    quality: quality.toFixed(2) + "%",
                    total_product: totalOutput,
                    total_rejects: totalRejects,
                    good_product: goodProduct
                }
            }
        });

    } catch (error) {
        console.error('❌ Universal Controller Error:', error);
        res.status(500).send({ message: 'Error calculating OEE', error: error.message });
    }
},

getUnifiedOEE: async (req, res) => {
        try {
            // 1. GET PARAMETERS (Must define 'archive' here!)
            const { date, archive } = req.query; 
            
            const selectedDate = date ? new Date(date) : new Date(); 
            
            // Date Formatting
            const getDateStr = (d) => d.toISOString().split('T')[0];
            const dayStr = getDateStr(selectedDate);
            
            const nextDate = new Date(selectedDate);
            nextDate.setDate(nextDate.getDate() + 1);
            const nextDayStr = getDateStr(nextDate);

            console.log(`\n🚀 SUPER CONTROLLER: Processing ${dayStr} (Archive Mode: ${archive || 'false'})`);

            // Define All 3 Shifts
            const shiftsDef = [
                { id: 1, start: `${dayStr} 06:30:00`, end: `${dayStr} 15:00:00` },
                { id: 2, start: `${dayStr} 15:00:00`, end: `${dayStr} 22:45:00` },
                { id: 3, start: `${dayStr} 22:45:00`, end: `${nextDayStr} 06:30:00` }
            ];

            // 2. Fetch ALL Raw Data
            const shiftPromises = shiftsDef.map(s => {
                const OFFSET = 7 * 3600; 
                const startTs = (new Date(s.start).getTime() / 1000) + OFFSET;
                const endTs = (new Date(s.end).getTime() / 1000) + OFFSET;

                const sql = `
                    SELECT 
                        data_format_0 as last_run, data_format_4 as last_prod, 
                        data_format_2 as last_planned, data_format_3 as last_unplanned, 
                        data_format_6 as last_reject
                    FROM \`CMT-VIBRATION_oee_fette_mentaj_data\` 
                    WHERE \`time@timestamp\` BETWEEN ? AND ?
                    ORDER BY \`time@timestamp\` DESC LIMIT 1
                `;

                return new Promise(resolve => {
                    db4.query(sql, [startTs, endTs], (err, res) => {
                        const row = (res && res[0]) ? res[0] : {};
                        const dur = (new Date(s.end) - new Date(s.start)) / 1000 / 60;
                        resolve({ ...row, duration_min: dur, id: s.id });
                    });
                });
            });

            const allShiftsData = await Promise.all(shiftPromises);

            // --- MATH HELPER ---
            const TARGET_RATE = 5333;
            const calculateOEE = (run, out, rej, plan, unplan, time) => {
                const r = parseFloat(run) || 0;
                const o = parseFloat(out) || 0;
                const j = parseFloat(rej) || 0;
                const p = parseFloat(plan) || 0;
                const u = parseFloat(unplan) || 0;
                const t = parseFloat(time) || 0;

                const good = o - j;
                
                // Availability
                const availNum = r;
                const availDenom = t - p;
                const avail = availDenom > 0 ? (availNum / availDenom) * 100 : 0;

                // Performance
                const pot = (t - p) * TARGET_RATE;
                const perf = pot > 0 ? (o / pot) * 100 : 0;

                // Quality
                const qual = o > 0 ? (good / o) * 100 : 0;

                // OEE
                const score = (avail * perf * qual) / 10000;

                return {
                    avail, perf, qual, oee: score,
                    tOut: o, tGood: good, tRej: j,
                    tTime: t, tRun: r, tStop: t - r,
                    tPlan: p, tUnplan: u
                };
            };

            // 3. Process Shifts & Aggregate Daily Stats
            const shiftsResults = {}; 
            let dRun = 0, dOut = 0, dRej = 0, dPlan = 0, dUnplan = 0, dTime = 0;
            let activeShifts = 0;

            allShiftsData.forEach(s => {
                const stats = calculateOEE(
                    s.last_run, s.last_prod, s.last_reject, 
                    s.last_planned, s.last_unplanned, s.duration_min
                );
                shiftsResults[s.id] = stats;

                const isActive = stats.tRun >= 5 || stats.tGood > 0;
                if (isActive) {
                    dRun += stats.tRun;
                    dOut += stats.tOut;
                    dRej += stats.tRej;
                    dPlan += stats.tPlan;
                    dUnplan += stats.tUnplan;
                    dTime += stats.tTime; 
                    activeShifts++;
                }
            });

            const dailyStats = calculateOEE(dRun, dOut, dRej, dPlan, dUnplan, dTime);

            // =========================================================
            // 4. ⚡ CONDITIONAL ARCHIVING ⚡
            // =========================================================
            if (archive === 'true') {
                // Get target_shift from the request (e.g., "1")
                const { target_shift } = req.query;

                const archivePromises = allShiftsData.map(s => {
                    
                    // 🛑 FILTER LOGIC:
                    // If a target_shift is provided, SKIP any shift that doesn't match.
                    if (target_shift && s.id != target_shift) {
                        return Promise.resolve(); // Do nothing for this shift
                    }

                    const sStats = shiftsResults[s.id];
                    return saveToLog(dayStr, s.id, sStats, dailyStats);
                });
                
                await Promise.all(archivePromises);
                
                if (target_shift) {
                    console.log(`💾 [Archive] Saved ONLY Shift ${target_shift} for ${dayStr}`);
                } else {
                    console.log(`💾 [Archive] Saved ALL shifts for ${dayStr}`);
                }

            } else {
                console.log(`👀 [Read-Only] OEE Calculated without saving.`);
            }

            // 5. Send Response
            res.status(200).send({
                message: `Unified OEE Data for ${dayStr}`,
                date: dayStr,
                active_shifts: activeShifts,
                daily: {
                    oee: dailyStats.oee.toFixed(2) + "%",
                    availability: dailyStats.avail.toFixed(2) + "%",
                    performance: dailyStats.perf.toFixed(2) + "%",
                    quality: dailyStats.qual.toFixed(2) + "%",
                    raw: dailyStats
                },
                shifts: {
                    1: formatStats(shiftsResults[1]),
                    2: formatStats(shiftsResults[2]),
                    3: formatStats(shiftsResults[3])
                }
            });

        } catch (error) {
            console.error('❌ Unified Controller Error:', error);
            res.status(500).send({ message: 'Error calculating Unified OEE', error: error.message });
        }
    },

    getFetteOEE: async (req, res) => {
    try {
        const { date } = req.query;
        // 1. Setup Date Formatting
        const selectedDate = date ? new Date(date) : new Date();
        const dayStr = selectedDate.toISOString().split('T')[0];

        console.log(`\n📊 FETTE OEE READER: Fetching data for ${dayStr}`);

        // 2. Query all shifts for the day using the specific shift start times
        const sql = `
            SELECT * FROM fette_shift_logs 
            WHERE log_date IN (?, ?, ?) 
            ORDER BY shift_id ASC
        `;
        
        const shiftTimes = [
            `${dayStr} 06:30:00`, 
            `${dayStr} 15:00:00`, 
            `${dayStr} 22:45:00`
        ];

        db4.query(sql, shiftTimes, (err, rows) => {
            if (err) throw err;

            // --- MATH HELPER ---
            const TARGET_RATE = 5333;

            const calculateStats = (row) => {
                const r = parseFloat(row.run_time) || 0;
                const s = parseFloat(row.stop_time) || 0;
                const o = parseFloat(row.total_prod) || 0;
                const g = parseFloat(row.total_good) || 0;
                const p = parseFloat(row.planned_stop) || 0;
                
                const t = r + s; // Total duration from log

                // OEE Components
                const avail = (t - p) > 0 ? (r / (t - p)) * 100 : 0;
                const perf = (r * TARGET_RATE) > 0 ? (o / (r * TARGET_RATE)) * 100 : 0;
                const qual = o > 0 ? (g / o) * 100 : 0;
                const score = (avail * perf * qual) / 10000;

                return {
                    oee: score.toFixed(2) + "%",
                    availability: avail.toFixed(2) + "%",
                    performance: perf.toFixed(2) + "%",
                    quality: qual.toFixed(2) + "%",
                    raw: {
                        tRun: r, tStop: s, tOut: o, tGood: g, 
                        tPlan: p, tTime: t, tRej: row.reject_count || 0
                    }
                };
            };

            // 3. Organize Results
            const response = {
                date: dayStr,
                active_shifts: 0,
                daily: {},
                shifts: { 1: null, 2: null, 3: null }
            };

            let dRun = 0, dStop = 0, dOut = 0, dGood = 0, dPlan = 0;

            rows.forEach(row => {
                const stats = calculateStats(row);
                response.shifts[row.shift_id] = stats;

                // Aggregate if there was any activity
                if (row.run_time > 0 || row.total_prod > 0) {
                    dRun += row.run_time;
                    dStop += row.stop_time;
                    dOut += row.total_prod;
                    dGood += row.total_good;
                    dPlan += row.planned_stop;
                    response.active_shifts++;
                }
            });

            // 4. Calculate Daily Total
            response.daily = calculateStats({
                run_time: dRun, stop_time: dStop, total_prod: dOut, 
                total_good: dGood, planned_stop: dPlan
            });

            res.status(200).send(response);
        });

    } catch (error) {
        console.error('❌ Fette Reader Error:', error);
        res.status(500).send({ message: 'Error reading Fette ETL data', error: error.message });
    }
},

getUnifiedOEE2: async (req, res) => {
    try {
        // 1. Get query parameters (Added archive & target_shift)
        const { date, archive, target_shift } = req.query; 
        const selectedDate = date ? new Date(date) : new Date(); 
        const dayStr = selectedDate.toISOString().split('T')[0];

        // Define shift times matching your log_date column exactly
        const shiftTimes = { 1: "06:30:00", 2: "15:00:00", 3: "22:45:00" };

        // 2. Fetch Raw Data from NEW Table
        const shiftPromises = [1, 2, 3].map(shiftId => {
            const sql = `
                SELECT 
                    run_time, stop_time, total_prod, total_good,
                    reject_count, planned_stop, unplanned_stop, shift_id
                FROM fette_shift_logs 
                WHERE log_date = ? AND shift_id = ?
                LIMIT 1`;

            const fullLogDateTime = `${dayStr} ${shiftTimes[shiftId]}:00`;

            return new Promise(resolve => {
                db4.query(sql, [fullLogDateTime, shiftId], (err, results) => {
                    const row = (results && results[0]) ? results[0] : {
                        run_time: 0, stop_time: 0, total_prod: 0, total_good: 0,
                        reject_count: 0, planned_stop: 0, unplanned_stop: 0, shift_id: shiftId
                    };
                    resolve(row);
                });
            });
        });

        const results = await Promise.all(shiftPromises);

        // --- MATH HELPERS ---
        const TARGET_RATE = 5333;
        const SHIFT_DURATIONS = { 1: 510, 2: 465, 3: 465 }; 

        const calculateOEE = (row, shiftId) => {
            const r = parseFloat(row.run_time) || 0;
            const o = parseFloat(row.total_prod) || 0;
            const g = parseFloat(row.total_good) || 0;
            const j = parseFloat(row.reject_count) || 0;
            const p = parseFloat(row.planned_stop) || 0;
            const u = parseFloat(row.unplanned_stop) || 0;
            
            const t = shiftId ? SHIFT_DURATIONS[shiftId] : (row.total_time || 0);

            const availDenom = t - p;
            const avail = availDenom > 0 ? (r / availDenom) * 100 : 0;

            const pot = (t - p) * TARGET_RATE;
            const perf = pot > 0 ? (o / pot) * 100 : 0;

            const qual = o > 0 ? (g / o) * 100 : 0;

            const score = (avail * perf * qual) / 10000;

            return {
                oee: score.toFixed(2) + "%",
                availability: avail.toFixed(2) + "%",
                performance: perf.toFixed(2) + "%",
                quality: qual.toFixed(2) + "%",
                raw: { 
                    tRun: r, tStop: row.stop_time, tOut: o, tGood: g, 
                    tRej: j, tPlan: p, tUnplan: u, tTime: t 
                }
            };
        };

        // 3. Calculate Results
        const shiftsResults = {}; 
        let dRun = 0, dOut = 0, dGood = 0, dRej = 0, dPlan = 0, dUnplan = 0, dTime = 0;
        let activeShifts = 0;

        results.forEach(row => {
            const stats = calculateOEE(row, row.shift_id);
            shiftsResults[row.shift_id] = stats;

            if (row.run_time > 0 || row.total_prod > 0) {
                dRun += row.run_time; 
                dOut += row.total_prod; 
                dGood += row.total_good;
                dRej += row.reject_count; 
                dPlan += row.planned_stop;
                dUnplan += row.unplanned_stop; 
                dTime += SHIFT_DURATIONS[row.shift_id]; 
                activeShifts++;
            }
        });

        const dailyStats = calculateOEE({
            run_time: dRun, total_prod: dOut, total_good: dGood, 
            reject_count: dRej, planned_stop: dPlan, unplanned_stop: dUnplan,
            total_time: dTime 
        }, null);


        // =========================================================
        // 4. ⚡ CONDITIONAL ARCHIVING (NEWLY ADDED) ⚡
        // =========================================================
        if (archive === 'true') {
            const archivePromises = [1, 2, 3].map(shiftId => {
                
                // If a specific shift is requested (Cron), skip the others
                if (target_shift && shiftId != target_shift) {
                    return Promise.resolve();
                }

                const sStats = shiftsResults[shiftId];
                
                // Format the shift data by stripping the "%" sign for the database
                const shiftDataFormatted = {
                    avail: parseFloat(sStats.availability),
                    perf:  parseFloat(sStats.performance),
                    qual:  parseFloat(sStats.quality),
                    oee:   parseFloat(sStats.oee),
                    tOut:  sStats.raw.tOut,
                    tGood: sStats.raw.tGood,
                    tRej:  sStats.raw.tRej,
                    tTime: sStats.raw.tTime,
                    tRun:  sStats.raw.tRun,
                    tStop: sStats.raw.tStop || 0 
                };

                // Format the daily data
                const dailyDataFormatted = {
                    avail: parseFloat(dailyStats.availability),
                    perf:  parseFloat(dailyStats.performance),
                    qual:  parseFloat(dailyStats.quality),
                    oee:   parseFloat(dailyStats.oee),
                };

                // Fire into your existing Save function
                return saveToLog(dayStr, shiftId, shiftDataFormatted, dailyDataFormatted);
            });
            
            await Promise.all(archivePromises);
            
            if (target_shift) {
                console.log(`💾 [Archive] Saved ONLY Shift ${target_shift} for ${dayStr} (from fette_shift_logs)`);
            } else {
                console.log(`💾 [Archive] Saved ALL shifts for ${dayStr} (from fette_shift_logs)`);
            }
        }

        // 5. Send Response
        res.status(200).send({
            date: dayStr,
            active_shifts: activeShifts,
            daily: dailyStats,
            shifts: shiftsResults
        });

    } catch (error) {
        console.error("Controller Error:", error);
        res.status(500).send({ message: 'Error calculating Unified OEE', error: error.message });
    }
},


generateDummyDataWeekly: async (req, res) => {
    try {
        console.log('\n========== GENERATING WEEKLY DATA (DEC 22 - DEC 26) ==========');
        
        // 1. Clear Table
        await new Promise((resolve, reject) => {
            db4.query("TRUNCATE TABLE fette_machine_dummy", (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        // 2. Setup Time Range (Monday Morning to Saturday Morning)
        // Ends on Saturday 06:30 so Friday's Shift 3 is complete
        const START_TIME = new Date('2025-12-20T06:30:00'); 
        const END_TIME = new Date('2025-12-27T06:30:00');   

        const TARGET_RPM = 1500;
        
        // 3. Initialize Accumulators
        let accRuntime = 0;
        let accPlanned = 0;
        let accUnplanned = 0;
        let accProduct = 0;
        let accReject = 0;

        let currentTime = new Date(START_TIME);
        let batchValues = [];
        let rowCount = 0;

        // 4. Minute-by-Minute Loop
        while (currentTime <= END_TIME) {
            const hour = currentTime.getHours();
            const minute = currentTime.getMinutes();

            // --- SHIFT RESET LOGIC ---
            // We reset at the start of EVERY shift (S1, S2, S3)
            // 06:30 (Start S1), 15:00 (Start S2), 22:45 (Start S3)
            // Note: We skip the very first 06:30 on Monday to avoid resetting initialized 0s
            const isStart = currentTime.getTime() === START_TIME.getTime();
            
            if (!isStart) {
                if (
                    (hour === 6 && minute === 30) ||  // Start of Day/Shift 1
                    (hour === 15 && minute === 0) ||  // Start of Shift 2
                    (hour === 22 && minute === 45)    // Start of Shift 3
                ) {
                    // console.log(`🔄 Resetting Counters at ${currentTime.toLocaleString()}`);
                    accRuntime = 0; accPlanned = 0; accUnplanned = 0; accProduct = 0; accReject = 0;
                }
            }
            
            // --- STATE MACHINE ---
            let isRunning = false;
            let isPlannedStop = false;
            let isUnplannedStop = false;

            // SHIFT 1 Logic (06:30 - 15:00)
            if (hour < 15 || (hour === 15 && minute === 0)) {
                if ((hour === 6 && minute >= 30) || (hour === 7 && minute === 0)) isPlannedStop = true; // Briefing
                else if (hour === 10 && minute < 15) isPlannedStop = true; // Break
                else if (hour === 12 && minute >= 15 && minute < 25) isUnplannedStop = true; // Fault
                else isRunning = true;
            }
            // SHIFT 2 Logic (15:00 - 22:45)
            else if (hour < 22 || (hour === 22 && minute <= 45)) {
                if (hour === 15 && minute < 30) isPlannedStop = true; // Handover
                else if (hour === 19 && minute < 30) isPlannedStop = true; // Dinner
                else if (hour === 21 && minute < 5) isUnplannedStop = true; // Jam
                else isRunning = true;
            }
            // SHIFT 3 Logic (22:45 - 06:30)
            else {
                if ((hour === 22 && minute >= 45) || (hour === 23 && minute < 15)) isPlannedStop = true; // Handover
                else if (hour === 3 && minute < 15) isPlannedStop = true; // Snack
                else if (hour === 5 && minute < 10) isUnplannedStop = true; // Feeder Issue
                else isRunning = true;
            }

            // Exact Boundary Overrides
            if (hour === 6 && minute === 30) { isPlannedStop = true; isRunning = false; }
            if (hour === 15 && minute === 0) { isPlannedStop = true; isRunning = false; }
            if (hour === 22 && minute === 45) { isPlannedStop = true; isRunning = false; }

            // --- INCREMENT ACCUMULATORS ---
            let rpm = 0;
            if (isRunning) {
                accRuntime += 1; 
                
                // Randomized Product (5500 - 5800)
                const randomProduct = Math.floor(Math.random() * 501) + 5200;
                accProduct += randomProduct;

                // Randomized Rejects (10 - 60)
                const randomReject = Math.floor(Math.random() * 101) + 10;
                accReject += randomReject;
                
                rpm = TARGET_RPM;
            } 
            else if (isPlannedStop) {
                accPlanned += 1;
            } 
            else if (isUnplannedStop) {
                accUnplanned += 1;
            }

            // --- SQL PREP ---
            const year = currentTime.getFullYear();
            const month = String(currentTime.getMonth() + 1).padStart(2, '0');
            const day = String(currentTime.getDate()).padStart(2, '0');
            const hourStr = String(hour).padStart(2, '0');
            const minStr = String(minute).padStart(2, '0');
            const sqlTime = `${year}-${month}-${day} ${hourStr}:${minStr}:00`;

            batchValues.push([
                sqlTime, accRuntime, accPlanned, accUnplanned, accProduct, accReject, rpm
            ]);

            // Advance Time
            currentTime.setMinutes(currentTime.getMinutes() + 1);
            rowCount++;
        }

        // 5. Bulk Insert (Chunks of 2000 to handle the larger load)
        const chunkSize = 2000;
        for (let i = 0; i < batchValues.length; i += chunkSize) {
            const chunk = batchValues.slice(i, i + chunkSize);
            const sql = `INSERT INTO fette_machine_dummy (record_time, runtime, planned_stoptime, unplanned_stoptime, total_product, reject, rpm) VALUES ?`;
            
            await new Promise((resolve, reject) => {
                db4.query(sql, [chunk], (err) => {
                    if (err) reject(err);
                    resolve();
                });
            });
            console.log(`✅ Inserted chunk ${i} - ${i + chunk.length}`);
        }

        console.log(`🎉 SUCCESS! Generated ${rowCount} rows (Mon-Fri).`);
        res.status(200).send({ message: "Weekly data generated successfully", rows: rowCount });

    } catch (error) {
        console.error('❌ Generation Failed:', error);
        res.status(500).send({ error: error.message });
    }
},

getDailyOEE: async (req, res) => {
    try {
        console.log('\n========== CALCULATING DAILY AGGREGATED OEE ==========');
        const { date } = req.query;
        const selectedDate = date ? new Date(date) : new Date('2025-12-22');
        
        const getDateStr = (d) => d.toISOString().split('T')[0];
        const nextDate = new Date(selectedDate);
        nextDate.setDate(nextDate.getDate() + 1);

        const dayStr = getDateStr(selectedDate);
        const nextDayStr = getDateStr(nextDate);

        // Define the 3 Shift Windows
        const shifts = [
            { id: 1, start: `${dayStr} 06:30:00`, end: `${dayStr} 15:00:00` },
            { id: 2, start: `${dayStr} 15:00:00`, end: `${dayStr} 22:45:00` },
            { id: 3, start: `${dayStr} 22:45:00`, end: `${nextDayStr} 06:30:00` }
        ];

        // 1. Fetch Data for ALL 3 Shifts (Snapshot Logic)
        const shiftPromises = shifts.map(shift => {
            const OFFSET_SECONDS = 7 * 3600; 
            const startTimestamp = (new Date(shift.start).getTime() / 1000) + OFFSET_SECONDS;
            const endTimestamp = (new Date(shift.end).getTime() / 1000) + OFFSET_SECONDS;

            const sql = `
                SELECT 
                    data_format_0 as last_run,
                    data_format_4 as last_prod,       -- total_output
                    data_format_2 as last_planned,    -- planned_dur
                    data_format_3 as last_unplanned,  -- unplanned_dur
                    data_format_6 as last_reject      -- total_reject
                FROM \`CMT-VIBRATION_oee_fette_mentah_data\`
                WHERE \`time@timestamp\` BETWEEN ? AND ?
                ORDER BY \`time@timestamp\` DESC
                LIMIT 1
            `;
            
            return new Promise((resolve, reject) => {
                db4.query(sql, [startTimestamp, endTimestamp], (err, result) => {
                    if (err) return reject(err);
                    const durationMin = (new Date(shift.end) - new Date(shift.start)) / 1000 / 60;
                    const row = result[0] || {};
                    resolve({ ...row, duration_min: durationMin, shift_id: shift.id });
                });
            });
        });

        const results = await Promise.all(shiftPromises);

        // 2. Aggregate Totals (Dynamic Logic: Exclude Empty Shifts)
        let totalRuntime = 0;
        let totalUnplanned = 0;
        let totalPlanned = 0;
        let totalShiftTime = 0;
        let totalOutput = 0;
        let totalRejects = 0;
        
        let activeShiftsCount = 0; 

        results.forEach(r => {
            const sRuntime = parseFloat(r.last_run) || 0;
            const sOutput = parseFloat(r.last_prod) || 0;
            const sUnplanned = parseFloat(r.last_unplanned) || 0;
            const sPlanned = parseFloat(r.last_planned) || 0;
            const sReject = parseFloat(r.last_reject) || 0;
            
            // --- ⚡ SMART CHECK: Is this shift active? ---
            // If Runtime is 0 AND Output is 0, the machine was likely OFF/Not Scheduled.
            const isShiftActive = sRuntime > 0 || sOutput > 0;

            if (isShiftActive) {
                // ✅ This logic fixes BOTH Availability AND Performance
                // Because we only add sRuntime if the shift is active.
                totalRuntime += sRuntime;
                totalOutput += sOutput;
                totalRejects += sReject;
                totalUnplanned += sUnplanned;
                totalPlanned += sPlanned;
                
                // Only add shift duration if active (Fixes Availability Denominator)
                totalShiftTime += r.duration_min;
                
                activeShiftsCount++;
            } else {
                console.log(`Skipping Shift ${r.shift_id} (Inactive: 0 Runtime & 0 Output)`);
            }
        });

        console.log(`Calculated Daily OEE based on ${activeShiftsCount} active shifts.`);

        // 3. Apply Formulas to Daily Totals

        // Availability
        const availNumerator = totalRuntime - totalUnplanned;
        const availDenominator = totalShiftTime - totalPlanned;
        let availability = 0;
        if (availDenominator > 0) availability = (availNumerator / availDenominator) * 100;

        // Performance
        const TARGET_PER_MINUTE = 5833;
        
        // ✅ PERFORMANCE FIX IS HERE:
        // 'totalRuntime' now only contains runtime from S1 + S2 (if S3 was skipped).
        // Therefore, 'potentialOutput' is strictly (S1.Run + S2.Run) * Target.
        const potentialOutput = totalRuntime * TARGET_PER_MINUTE;
        
        let performance = 0;
        if (potentialOutput > 0) performance = (totalOutput / potentialOutput) * 100;

        // Quality
        const goodProduct = totalOutput - totalRejects;
        let quality = 0;
        if (totalOutput > 0) quality = (goodProduct / totalOutput) * 100;

        // --- 4. CALCULATE DAILY OEE SCORE ---
        const oeeScore = (availability * performance * quality) / 10000;

        console.log(`Daily OEE: ${oeeScore.toFixed(2)}%`);

        res.status(200).send({
            message: `Daily Aggregated OEE for ${dayStr}`,
            date: dayStr,
            data: {
                oee: oeeScore.toFixed(2) + "%",

                availability: {
                    value: availability.toFixed(2) + "%",
                    total_runtime: totalRuntime,
                    total_unplanned: totalUnplanned,
                    total_planned: totalPlanned,
                    total_shift_time: totalShiftTime
                },
                performance: {
                    value: performance.toFixed(2) + "%",
                    total_output: totalOutput,
                    potential_output: potentialOutput
                },
                quality: {
                    value: quality.toFixed(2) + "%",
                    total_output: totalOutput,
                    total_rejects: totalRejects,
                    good_product: goodProduct
                }
            }
        });

    } catch (error) {
        console.error('❌ Daily OEE Error:', error);
        res.status(500).send({ message: 'Error calculating Daily OEE', error: error.message });
    }
},

// SINGLE ARCHIVE (Existing)
    archiveCombinedOEE: async (req, res) => {
        try {
            const { date, shift } = req.query;
            if (!date || !shift) return res.status(400).send({ message: "Missing params" });
            const result = await processArchiveForShift(date, parseInt(shift));
            res.status(200).send({ message: "Archived", data: result });
        } catch (error) {
            console.error(error);
            res.status(500).send({ error: error.message });
        }
    },

    // BULK ARCHIVE (New)
    // BULK ARCHIVE
    archiveAll: async (req, res) => {
    try {
        console.log("🚀 STARTING BULK ARCHIVE...");
        
        // 1. Find all unique dates from the NEW table
        const dates = await new Promise((resolve, reject) => {
            // Convert 'time@timestamp' (double) to Date Object for grouping
            const sql = "SELECT DISTINCT DATE(FROM_UNIXTIME(`time@timestamp`)) as d FROM `CMT-VIBRATION_oee_fette_mentah_data` ORDER BY d ASC";
            
            db4.query(sql, (err, res) => {
                if (err) return reject(err);
                
                const localDates = res.map(row => {
                    const d = new Date(row.d);
                    const offset = d.getTimezoneOffset() * 60;
                    const localDate = new Date(d.getTime() - offset);
                    return localDate.toISOString().split('T')[0];
                });
                
                resolve(localDates);
            });
        });

        console.log(`Found ${dates.length} days with data:`, dates);

        // 2. Iterate and Archive
        let count = 0;
        for (const dateStr of dates) {
            await processArchiveForShift(dateStr, 1);
            await processArchiveForShift(dateStr, 2);
            await processArchiveForShift(dateStr, 3);
            process.stdout.write(`.`); 
            count += 3;
        }

        console.log(`\n✅ Bulk Archive Complete! Processed ${count} shifts.`);
        res.status(200).send({ message: `Successfully archived ${count} shifts across ${dates.length} days.` });

    } catch (error) {
        console.error("Bulk Archive Error:", error);
        res.status(500).send({ error: error.message });
    }
},

getWeeklyTrend: async (req, res) => {
        try {
            console.log('\n📈 Fetching Weekly Trend Data (Last 7 Days)...');

            const sql = `
                SELECT * FROM (
                    SELECT 
                        production_date,
                        -- ✅ FIX 1: Remove "AS alias". Keep raw DB column names
                        -- This ensures frontend finds "oee_value_daily", etc.
                        oee_value_daily,
                        availability_value_daily,
                        performance_value_daily,
                        quality_value_daily
                    FROM oee_master_logs
                    WHERE id IN (
                        SELECT MAX(id)
                        FROM oee_master_logs
                        GROUP BY DATE(production_date)
                    )
                    ORDER BY production_date DESC
                    LIMIT 7
                ) AS sub
                ORDER BY production_date ASC
            `;

            db4.query(sql, (err, result) => {
                if (err) {
                    console.error("SQL Error:", err);
                    return res.status(500).send({ error: err.message });
                }
                // ✅ FIX 2: Send 'result' directly (It is already an array)
                // Do NOT wrap it in { data: result }
                res.status(200).send(result);
            });

        } catch (error) {
            console.error('❌ Trend Error:', error);
            res.status(500).send({ error: error.message });
        }
    },
    
// --- 2. Get History Log (Simplified) ---
    getHistoryLog: (req, res) => {
        const { startDate, endDate } = req.query;
        const end = endDate || new Date().toISOString().split('T')[0];
        const start = startDate || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];

        // 1. Fetch RAW Data
        const sql = `
            SELECT * FROM oee_master_logs
            WHERE DATE(production_date) BETWEEN ? AND ?
            ORDER BY production_date DESC, shift_name DESC
        `;

        db4.query(sql, [start, end], (err, rows) => {
            if (err) {
                console.error("❌ History Log Error:", err);
                return res.status(500).send(err);
            }

            const groupedData = {};

            rows.forEach(row => {
                // 🛑 BUG FIX: DATE SHIFT
                // Old Code: new Date(row.production_date).toISOString().split('T')[0]  <-- Caused UTC rewind
                // New Code: Manual Local Formatting
                const d = new Date(row.production_date);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const dateKey = `${year}-${month}-${day}`; // Keeps it '2026-01-21'

                if (!groupedData[dateKey]) {
                    groupedData[dateKey] = {
                        date: dateKey,
                        daily: {
                            // Fetch the Daily Snapshot from the DB row directly
                            oee: row.oee_value_daily, 
                            availability: row.availability_value_daily,
                            performance: row.performance_value_daily,
                            quality: row.quality_value_daily,
                            
                            // Initialize counters
                            total_run: 0, 
                            total_stop: 0, 
                            total_output: 0, 
                            total_reject: 0
                        },
                        shifts: { 1: null, 2: null, 3: null }
                    };
                }

                // A. Store Shift Data
                groupedData[dateKey].shifts[row.shift_name] = {
                    ...row,
                    // Map the specific SHIFT columns
                    oee: row.oee_value_shift, 
                    avail: row.availability_value_shift,
                    perf: row.performance_value_shift,
                    qual: row.quality_value_shift
                };

                // B. Aggregate Daily Counters
                const dObj = groupedData[dateKey].daily;
                dObj.total_run += (row.total_run || 0);
                dObj.total_stop += (row.total_stop || 0);
                dObj.total_output += (row.total_product || 0);
                dObj.total_reject += (row.reject || 0);
            });

            res.status(200).send(Object.values(groupedData));
        });
    },

    // --- Get Assigned Jobs ---
// --- Get Assigned Jobs ---
// --- Get Assigned Jobs ---
  // --- Get Assigned Jobs (Cross-Server Application Join) ---
  getAssignedJobs: async (request, response) => {
    try {
      // Helper to wrap database queries in Promises (avoids callback hell)
      const queryDB = (connection, sql, params = []) => {
        return new Promise((resolve, reject) => {
          connection.query(sql, params, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
      };

      // 1. Fetch Work Orders from DB4 (EMS Database)
      const workOrderSql = `
        SELECT 
          wo.work_order_id AS id,
          wo.wo_number,
          wo.scheduled_date,
          wo.technician_id,
          wo.status,
          pm.machine_name,
          pm.asset_number
        FROM pmp_work_orders wo
        JOIN pmp_machines pm ON wo.machine_id = pm.machine_id
        ORDER BY wo.scheduled_date DESC
      `;
      
      const jobs = await queryDB(db4, workOrderSql);

      // 2. Extract unique Technician IDs
      const technicianIds = [...new Set(
        jobs
          .map(job => job.technician_id)
          .filter(id => id !== null && id !== undefined) // Remove nulls
      )];

      // 3. If there are technicians assigned, fetch their names from DB (User Database)
      let users = [];
      if (technicianIds.length > 0) {
        // Create placeholders (?,?,?) for the IN clause
        const placeholders = technicianIds.map(() => '?').join(',');
        
        const userSql = `
          SELECT id_users, name 
          FROM users 
          WHERE id_users IN (${placeholders})
        `;
        
        users = await queryDB(db, userSql, technicianIds);
      }

      // 4. Merge the Data (Attach names to jobs)
      const mergedJobs = jobs.map(job => {
        const technician = users.find(user => user.id_users === job.technician_id);
        return {
          ...job,
          technician_name: technician ? technician.name : "Unassigned" // Default if not found
        };
      });

      return response.status(200).send(mergedJobs);

    } catch (error) {
      console.error('❌ getAssignedJobs Error:', error.message);
      return response.status(500).send({ error: "Server error" });
    }
  },

  // --- Update Assigned Job ---
  updateAssignedJob: async (request, response) => {
    try {
      // 'pmp_id' from frontend maps to 'work_order_id' in DB
      const { pmp_id, scheduled_date, technician_id } = request.body;

      if (!pmp_id || !scheduled_date) {
        return response.status(400).send({ error: "Missing required fields: pmp_id, scheduled_date" });
      }

      // UPDATED: Updating the new table using 'work_order_id'
      const sql = `
        UPDATE pmp_work_orders 
        SET scheduled_date = ?, technician_id = ?
        WHERE work_order_id = ?
      `;

      db4.query(sql, [scheduled_date, technician_id || null, pmp_id], (err, result) => {
        if (err) {
          console.error('❌ Error updating assigned job:', err.message);
          return response.status(500).send({ error: "Failed to update job" });
        }

        if (result.affectedRows === 0) {
          return response.status(404).send({ error: "Job not found" });
        }

        console.log(`✅ Updated WO ID ${pmp_id}: date=${scheduled_date}, tech=${technician_id}`);
        return response.status(200).send({ message: "Job updated successfully" });
      });
    } catch (error) {
      console.error('❌ updateAssignedJob Error:', error.message);
      return response.status(500).send({ error: "Server error" });
    }
  },

  importMaintenanceData: async (req, res) => {
        // Default to 'data.csv' if no path is provided in body
        const filePath = req.body.filePath || 'C:\\Users\\Acer\\Documents\\GitHub\\engineering1\\public\\WO PM JAN.csv'; 
        
        // Construct the output path: same folder, appended with "_parsed.txt"
        const dir = path.dirname(filePath);
        const ext = path.extname(filePath);
        const baseName = path.basename(filePath, ext);
        const outputPath = path.join(dir, `${baseName}_parsed.txt`);

        console.log(`🚀 Parsing file: ${filePath}`);

        try {
            // --- 1. PARSE LOGIC (Same as before) ---
            const fileStream = fs.createReadStream(filePath);
            const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

            const allRecords = [];
            let currentRecord = null;
            
            const regexPWO = /PWO-(\d+)/;
            const regexDate = /(\d{2}\s+[A-Za-z]{3}\s+\d{4})/; 
            const regexOp = /^(\d+);+(.+)/; 

            for await (const line of rl) {
                // A. New PWO Detected
                const pwoMatch = line.match(regexPWO);
                if (pwoMatch) {
                    if (currentRecord) allRecords.push(currentRecord);
                    currentRecord = { 
                        pwoNumber: pwoMatch[0], 
                        date: null, 
                        asset: null, 
                        operations: [] 
                    };
                    continue;
                }
                
                if (!currentRecord) continue; 

                // B. Date Detected
                if (!currentRecord.date) {
                    const dateMatch = line.match(regexDate);
                    if (dateMatch) currentRecord.date = dateMatch[1];
                }

                // C. Asset Detected
                if (line.includes("Asset Number")) {
                    const parts = line.split(';');
                    let foundLabel = false;
                    for (const part of parts) {
                        if (part.includes("Asset Number")) { foundLabel = true; continue; }
                        if (foundLabel) {
                            const cleanPart = part.replace(/"/g, '').trim();
                            if (cleanPart.length > 5) { currentRecord.asset = cleanPart; break; }
                        }
                    }
                }

                // D. Operation Detected
                const opMatch = line.match(regexOp);
                if (opMatch) {
                    const rawText = opMatch[2];
                    const descriptionParts = rawText.split(';');
                    // Find first non-empty text
                    const description = descriptionParts.find(p => p.trim().length > 0);
                    if (description) {
                        currentRecord.operations.push({ 
                            step: opMatch[1], 
                            desc: description.replace(/"/g, '').trim() 
                        });
                    }
                }
            }
            // Push the last record
            if (currentRecord) allRecords.push(currentRecord);

            // --- 2. WRITE TO FILE (No Database) ---
            const outputContent = JSON.stringify(allRecords, null, 2);
            fs.writeFileSync(outputPath, outputContent);

            console.log(`✅ Success! Parsed data saved to: ${outputPath}`);

            return res.status(200).send({
                message: "File Parsed Successfully",
                originalFile: filePath,
                outputFile: outputPath,
                totalRecords: allRecords.length
            });

        } catch (error) {
            console.error('Fatal Parsing Error:', error);
            return res.status(500).send({ error: "Server Error during parsing", details: error.message });
        }
    },

    // Ensure you import your DB connection at the top
// const { db } = require('../config/db'); 

getFetteLogs: async (request, response) => {
        try {
            console.log("🔍 DEBUG: Checking connection...");
            
            // 1. Check which HOST we are actually connected to
            // This will print the IP address in your terminal
            dbTest.query("SELECT @@hostname as host, DATABASE() as db_name", (err, meta) => {
                if (err) console.error("❌ Meta Check Failed:", err.message);
                else console.log("✅ Connected to:", meta[0]);
            });

            // 2. Ask the database to list ALL tables it sees in 'test'
            dbTest.query("SHOW TABLES", (err, tables) => {
                if (err) {
                    console.error('❌ Error showing tables:', err.message);
                    return response.status(500).send({ error: "DB Error" });
                }

                // 3. Print the list to your terminal
                console.log("📂 Tables found in 'test':");
                console.table(tables);

                // 4. Try the query with BACKTICKS (Safe Mode)
                // Backticks ` ` handle spaces or weird characters in names
                const safeSql = "SELECT * FROM `NodeRed_oee_fette_pd_desc` LIMIT 1";
                
                dbTest.query(safeSql, (err2, result) => {
                    if (err2) {
                         return response.status(500).send({ 
                             message: "Still failing", 
                             tables_found: tables, 
                             error: err2.message 
                         });
                    }
                    return response.status(200).send({ message: "It worked with backticks!", data: result });
                });
            });

        } catch (error) {
            console.error('❌ Server Error:', error.message);
            return response.status(500).send({ error: "Server error" });
        }
    },

getDowntimeEvents: async (req, res) => {
    try {
        console.log('\n📉 Fetching Full Downtime Data (Planned + Unplanned + Events)...');
        const { start, end } = req.query;
        
        if (!start || !end) {
            return res.status(400).send({ error: "Start and End timestamps are required" });
        }

        // --- QUERY 1: Unplanned Budget ---
        const sqlUnplanned = `
            SELECT (dur_cekrollerpunch + dur_perbaikandeduster + dur_zerobalance + 
                    dur_tunggugranul + dur_settingulangipc + dur_tungguaproval) AS limit_val
            FROM \`NodeRed_oee_fette_ud_desc\`
            WHERE \`timestamp\` BETWEEN UNIX_TIMESTAMP(?) AND UNIX_TIMESTAMP(?)
            ORDER BY \`timestamp\` DESC LIMIT 1`;

        // --- QUERY 2: Planned Budget ---
        const sqlPlanned = `
            SELECT (dur_cusuminor + dur_cusumajor + dur_testrun + dur_bersihipc + 
                    dur_briefing + dur_veriftimbangan + dur_verifmetal + dur_sanit_matcon + 
                    dur_setupBN + dur_ipc_bobot_LC + dur_kumpulafkir + dur_gantimatcon + 
                    dur_timbanghasil + dur_cleanup + dur_closePPI + dur_istirahat + 
                    dur_istirahat_soljum) AS limit_val
            FROM \`NodeRed_oee_fette_pd_desc\`
            WHERE \`timestamp\` BETWEEN UNIX_TIMESTAMP(?) AND UNIX_TIMESTAMP(?)
            ORDER BY \`timestamp\` DESC LIMIT 1`;

        // --- QUERY 3: Timeline Events ---
        // --- QUERY 3: Timeline Events (FIXED: Subtracting 7 Hours) ---
const sqlEvents = `
    SELECT 
        -- 1. Format as String to lock the time
        DATE_FORMAT(MIN(corrected_time), '%Y-%m-%d %H:%i:%s') AS start_time, 
        DATE_FORMAT(MAX(corrected_time), '%Y-%m-%d %H:%i:%s') AS finish_time,
        
        ROUND(TIMESTAMPDIFF(SECOND, MIN(corrected_time), MAX(corrected_time)) / 60, 1) AS duration_minutes, 
        'Undefined' AS category
    FROM (
        SELECT Step1.*, 
        @group_id := IF(@prev_status = is_stopped, @group_id, @group_id + 1) AS group_id, 
        @prev_status := is_stopped
        FROM (
            SELECT 
                -- 2. CRITICAL FIX: SUBTRACT 7 Hours (25200 seconds)
                -- Because Mentaj data is 7 hours in the future
                FROM_UNIXTIME((\`time@timestamp\`) + (7 * 3600)) AS corrected_time,
                
                IF(\`data_format_1\` > @prev_val, 1, 0) AS is_stopped, 
                @prev_val := \`data_format_1\` AS tmp_var
            FROM \`CMT-VIBRATION_oee_fette_mentaj_data\`, (SELECT @prev_val := 0) AS vars_init_1
            ORDER BY \`time@timestamp\` ASC LIMIT 18446744073709551615
        ) Step1, (SELECT @group_id := 0, @prev_status := 0) AS vars_init_2
    ) Step2
    WHERE is_stopped = 1 AND corrected_time BETWEEN ? AND ?
    GROUP BY group_id ORDER BY start_time DESC`;

        // --- EXECUTION ---
        dbTest.query(sqlUnplanned, [start, end], (err1, resUnplanned) => {
            if (err1) return res.status(500).send({ error: err1.message });

            dbTest.query(sqlPlanned, [start, end], (err2, resPlanned) => {
                if (err2) return res.status(500).send({ error: err2.message });

                db4.query(sqlEvents, [start, end], (err3, resEvents) => {
                    if (err3) return res.status(500).send({ error: err3.message });

                    const unplannedLimit = resUnplanned.length > 0 ? resUnplanned[0].limit_val : 10;
                    const plannedLimit = resPlanned.length > 0 ? resPlanned[0].limit_val : 10;

                    res.status(200).send({
                        budget: { unplanned_limit: unplannedLimit, planned_limit: plannedLimit },
                        events: resEvents
                    });
                });
            });
        });

    } catch (error) {
        console.error('❌ Downtime Controller Error:', error);
        res.status(500).send({ error: error.message });
    }
},

getDowntimeByUnix: async (req, res) => {
    try {
        const { start_date, end_date } = req.query;

        if (!start_date || !end_date) {
            return res.status(400).send({ error: "Start and End dates are required" });
        }

        // --- 1. Prepare Timestamps ---
        const unixStart = Math.floor(new Date(start_date).getTime() / 1000);
        const unixEnd = Math.floor(new Date(end_date).getTime() / 1000);
        
        // Mentaj Machine Offset (+7 Hours / 25200 seconds)
        const MENTAJ_OFFSET = 25200; 
        const searchStart = unixStart + MENTAJ_OFFSET;
        const searchEnd = unixEnd + MENTAJ_OFFSET;

        console.log(`\n🔍 Searching: ${start_date} to ${end_date}`);

        // --- QUERY A: Fetch Stop Events (Time-Difference Logic) ---
        const sqlEvents = `
            SELECT 
                FROM_UNIXTIME(start_unix - 25200) AS start_time,
                FROM_UNIXTIME(end_unix - 25200) AS finish_time,
                (end_unix - start_unix) AS raw_seconds,
                ROUND((end_unix - start_unix) / 60, 1) AS duration_minutes,
                'Undefined' AS category
            FROM (
                SELECT 
                    MAX(Step1.is_stopped) AS is_stopped,
                    MIN(raw_unix_time) AS start_unix,
                    MAX(raw_unix_time) AS end_unix,
                    @group_id := IF(@prev_status = is_stopped, @group_id, @group_id + 1) AS group_id,
                    @prev_status := is_stopped
                FROM (
                    SELECT 
                        \`time@timestamp\` as raw_unix_time,
                        IF(\`data_format_0\` > @prev_run, 0, 1) AS is_stopped,
                        @prev_run := \`data_format_0\`
                    FROM 
                        \`CMT-VIBRATION_oee_fette_mentaj_data\`, 
                        (SELECT @prev_run := 0) AS vars_init_1 
                    WHERE 
                        \`time@timestamp\` BETWEEN ? AND ?
                    ORDER BY 
                        \`time@timestamp\` ASC
                ) Step1,
                (SELECT @group_id := 0, @prev_status := -1) AS vars_init_2 
                GROUP BY group_id
            ) Step2
            WHERE is_stopped = 1
            AND (end_unix - start_unix) > 0 
            ORDER BY start_unix DESC;
        `;

        // --- QUERY B: Fetch Planned Budget (FIXED) ---
        // 1. Changed source to 'CMT-VIBRATION_oee_fette_mentaj_data'
        // 2. Using 'data_format_2' which corresponds to 'planned_dur' (140)
        const sqlPlanned = `
            SELECT MAX(data_format_2) as total_planned_val
            FROM \`CMT-VIBRATION_oee_fette_mentaj_data\`
            WHERE \`time@timestamp\` BETWEEN ? AND ?
        `;

        // --- QUERY C: PLC Total (Shift Total) ---
        // Using 'data_format_1' which corresponds to 'stoptime' (234)
        const sqlPLC = `
            SELECT MAX(data_format_1) as plc_total_minutes
            FROM \`CMT-VIBRATION_oee_fette_mentaj_data\`
            WHERE \`time@timestamp\` BETWEEN ? AND ?
        `;

        // --- EXECUTION CHAIN ---
        db4.query(sqlEvents, [searchStart, searchEnd], (err1, eventsResults) => {
            if (err1) return res.status(500).send({ error: "Events Error: " + err1.message });

            // IMPORTANT: Switch to db4 and use searchStart/searchEnd for sqlPlanned now
            db4.query(sqlPlanned, [searchStart, searchEnd], (err2, plannedResults) => {
                if (err2) return res.status(500).send({ error: "Budget Error: " + err2.message });

                db4.query(sqlPLC, [searchStart, searchEnd], (err3, plcResults) => {
                    if (err3) return res.status(500).send({ error: "PLC Error: " + err3.message });

                    // Parse Results
                    const plannedLimit = plannedResults.length > 0 ? parseFloat(plannedResults[0].total_planned_val || 0) : 0;
                    
                    let totalDowntime = 0;
                    let source = "Calculated";

                    if (plcResults.length > 0 && plcResults[0].plc_total_minutes != null) {
                        totalDowntime = parseFloat(plcResults[0].plc_total_minutes);
                        source = "PLC (data_format_1)";
                    } else {
                        totalDowntime = eventsResults.reduce((sum, e) => sum + (parseFloat(e.duration_minutes) || 0), 0);
                    }

                    // Calculation: Unplanned = Total - Planned
                    const unplannedLimit = Math.max(0, totalDowntime - plannedLimit);

                    console.log(`\n📊 Final Calculation (${source}):`);
                    console.log(`   Total Time (F1):    ${totalDowntime.toFixed(1)}m`);
                    console.log(`   Planned Limit (F2): ${plannedLimit.toFixed(1)}m`);
                    console.log(`   Unplanned (Diff):   ${unplannedLimit.toFixed(1)}m`);

                    res.status(200).send({
                        budget: { 
                            planned_limit: parseFloat(plannedLimit.toFixed(1)),
                            unplanned_limit: parseFloat(unplannedLimit.toFixed(1)),
                            total_downtime: parseFloat(totalDowntime.toFixed(1)),
                            source: source
                        },
                        events: eventsResults
                    });
                });
            });
        });

    } catch (error) {
        console.error('❌ Controller Error:', error);
        res.status(500).send({ error: error.message });
    }
},

storeDowntimeEvents: async (req, res) => {
    try {
        // 1. Receive simple data from Frontend
        const { date, shift, events, start_range, end_range } = req.body; 
        // e.g., date: "2026-01-28", shift: "Shift 1"

        if (!date || !shift) return res.status(400).send({ error: "Date/Shift required" });

        // 2. Map "Shift 1" -> 1
        const shiftMap = { "Shift 1": 1, "Shift 2": 2, "Shift 3": 3 };
        const shiftNum = shiftMap[shift];

        // 3. FIND THE REAL SHIFT ID (The "Golden Key" Lookup)
        // We match the date AND the shift number to get the unique ID (e.g., 582)
        const idQuery = `
            SELECT id FROM oee_master_logs 
            WHERE DATE(production_date) = ? AND shift_name = ? 
            LIMIT 1
        `;

        db4.query(idQuery, [date, shiftNum], (err, idRes) => {
            if (err) return res.status(500).send({ error: "Lookup Failed" });
            
            // Critical Safety Check: Does the Master Log exist?
            if (idRes.length === 0) {
                return res.status(404).send({ error: "Shift Log not found in Master Table. Cannot save." });
            }

            const realShiftId = idRes[0].id; // <--- WE FOUND IT! (e.g. 582)

            // 4. NOW WE PROCEED WITH THE SAVE (Using realShiftId)
            const updatedBy = "User"; 
            const updatedAt = new Date();

            // A. Delete old data using the REAL ID
            const deleteSql = "DELETE FROM fette_shift_downtime_events WHERE shift_id = ?";
            
            db4.query(deleteSql, [realShiftId], (delErr) => {
                if (delErr) return res.status(500).send({ error: "Delete Failed" });

                if (!events || events.length === 0) {
                    return res.status(200).send({ message: "Report cleared." });
                }

                // B. Insert new data using the REAL ID
                const insertSql = `
                    INSERT INTO fette_shift_downtime_events 
                    (shift_id, production_date, start_time, end_time, duration_minutes, category, reason_name, reason_id, updated_by, updated_at)
                    VALUES ?
                `;

                const values = events.map(e => [
                    realShiftId,      // Using 582
                    date,             // Saving the string date is fine for reference
                    e.start_time,
                    e.end_time,
                    e.duration_minutes,
                    e.category,
                    e.reason_name,
                    e.reason_id,
                    updatedBy,
                    updatedAt
                ]);

                db4.query(insertSql, [values], (insErr, insRes) => {
                    if (insErr) return res.status(500).send({ error: "Insert Failed" });
                    res.status(200).send({ success: true, message: "Saved with ID " + realShiftId });
                });
            });
        });

    } catch (error) {
        res.status(500).send({ error: error.message });
    }
},

// --- 1. FETCH: Get Saved Events from the Permanent Table ---
getStoredDowntime: async (req, res) => {
    try {
        const { start_date, end_date } = req.query;

        // 1. Select all columns including the new 'reason_name' and metadata
        const sql = `
            SELECT 
                id, 
                shift_id, 
                start_time, 
                end_time, 
                duration_minutes, 
                category, 
                reason_name, 
                reason_id,
                updated_at, 
                updated_by 
            FROM fette_shift_downtime_events 
            WHERE start_time >= ? AND end_time <= ?
            ORDER BY start_time ASC
        `;

        // 2. Execute Query
        db4.query(sql, [start_date, end_date], (err, results) => {
            if (err) {
                console.error("Fetch Error:", err);
                return res.status(500).send({ error: "Database error" });
            }

            // 3. Logic: If results > 0, the report is "Submitted"
            const isSubmitted = results.length > 0;

            res.status(200).send({
                success: true,
                is_submitted: isSubmitted,
                // Send metadata from the first row (assuming batch update)
                last_updated_at: isSubmitted ? results[0].updated_at : null,
                last_updated_by: isSubmitted ? results[0].updated_by : null,
                events: results
            });
        });

    } catch (error) {
        res.status(500).send({ error: error.message });
    }
},

// --- 2. UPDATE: Assign Category & Reason ---
updateDowntime: async (req, res) => {
    try {
        const { id, category, reason_id } = req.body;
        
        if (!id || !category) return res.status(400).send({ error: "ID and Category are required" });

        const sql = `
            UPDATE fette_shift_downtime_events 
            SET category = ?, reason_id = ? 
            WHERE id = ?
        `;

        db4.query(sql, [category, reason_id || null, id], (err, result) => {
            if (err) return res.status(500).send({ error: err.message });
            res.status(200).send({ message: "Event Updated", affected: result.affectedRows });
        });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
},

// --- 3. SPLIT: Slice an Event into Two ---
splitDowntime: async (req, res) => {
    try {
        const { id, split_minutes } = req.body;

        // Validation
        if (!id || !split_minutes) return res.status(400).send({ error: "Event ID and Split Minutes are required" });

        // 1. Get a dedicated connection from the pool
        db4.getConnection((err, connection) => {
            if (err) return res.status(500).send({ error: "DB Connection failed: " + err.message });

            // A. Fetch the Original Event using the dedicated connection
            const fetchSql = "SELECT * FROM fette_shift_downtime_events WHERE id = ?";
            
            connection.query(fetchSql, [id], (err, results) => {
                if (err) {
                    connection.release(); // Release on error
                    return res.status(500).send({ error: err.message });
                }
                if (results.length === 0) {
                    connection.release();
                    return res.status(404).send({ error: "Event not found" });
                }

                const original = results[0];
                const originalDur = parseFloat(original.duration_minutes);
                const splitDur = parseFloat(split_minutes);

                // B. Validate Math
                if (splitDur >= originalDur || splitDur <= 0) {
                    connection.release();
                    return res.status(400).send({ error: `Split time (${splitDur}) must be smaller than total duration (${originalDur})` });
                }

                // C. Calculate New Times (TIMEZONE SAFE METHOD)
                const startTime = new Date(original.start_time);
                const splitPointDate = new Date(startTime.getTime() + splitDur * 60000); 

                const toLocalSQLString = (dateObj) => {
                    const pad = (n) => n < 10 ? '0' + n : n;
                    return dateObj.getFullYear() + '-' +
                        pad(dateObj.getMonth() + 1) + '-' +
                        pad(dateObj.getDate()) + ' ' +
                        pad(dateObj.getHours()) + ':' +
                        pad(dateObj.getMinutes()) + ':' +
                        pad(dateObj.getSeconds());
                };

                const splitPointStr = toLocalSQLString(splitPointDate);

                // D. TRANSACTION: Update Original + Insert New
                const updateOriginalSql = `
                    UPDATE fette_shift_downtime_events 
                    SET end_time = ?, duration_minutes = ? 
                    WHERE id = ?
                `;

                const insertNewSql = `
                    INSERT INTO fette_shift_downtime_events 
                    (shift_id, start_time, end_time, duration_minutes, category, parent_event_id) 
                    VALUES (?, ?, ?, ?, 'Undefined', ?)
                `;

                const remainderDur = originalDur - splitDur;

                // 2. Start Transaction on the connection
                connection.beginTransaction(err => {
                    if (err) {
                        connection.release();
                        return res.status(500).send({ error: err.message });
                    }

                    // Step 1: Shrink Original Event
                    connection.query(updateOriginalSql, [splitPointStr, splitDur, id], (err2) => {
                        if (err2) {
                            return connection.rollback(() => {
                                connection.release();
                                res.status(500).send({ error: "Update Failed: " + err2.message });
                            });
                        }

                        // Step 2: Create Remainder Event
                        let originalEndStr = original.end_time;
                        if (original.end_time instanceof Date) {
                            originalEndStr = toLocalSQLString(original.end_time);
                        }

                        connection.query(insertNewSql, [
                            original.shift_id, 
                            splitPointStr,  // New Start
                            originalEndStr, // Old End
                            remainderDur, 
                            original.id 
                        ], (err3) => {
                            if (err3) {
                                return connection.rollback(() => {
                                    connection.release();
                                    res.status(500).send({ error: "Insert Failed: " + err3.message });
                                });
                            }

                            // 3. Commit
                            connection.commit(err4 => {
                                if (err4) {
                                    return connection.rollback(() => {
                                        connection.release();
                                        res.status(500).send({ error: "Commit Failed: " + err4.message });
                                    });
                                }
                                
                                // 4. Success & Release
                                connection.release();
                                res.status(200).send({ message: "Split Successful", original_new_dur: splitDur, new_event_dur: remainderDur });
                            });
                        });
                    });
                });
            });
        });

    } catch (error) {
        console.error("Split Error:", error);
        res.status(500).send({ error: error.message });
    }
},

// --- 4. FETCH REASONS: Get list for the dropdown ---
getDowntimeReasons: async (req, res) => {
    try {
        const sql = `
            SELECT id, name, default_category 
            FROM fette_master_downtime_reasons 
            WHERE is_active = 1 
            ORDER BY name ASC
        `;

        db4.query(sql, (err, results) => {
            if (err) return res.status(500).send({ error: err.message });
            res.status(200).send(results);
        });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
},

// Add this to your Controller
runEtlProcess: async (req, res) => {
    // --- 1. CONFIGURATION (MAPPINGS) ---
    
    // MAP 1: Unplanned (UD Table) -> IDs from fette_master_downtime_reasons
    // These match the IDs (24-29) we created earlier.
    const UNPLANNED_MAP = {
        'dur_lain': 18,              // Lain-Lain
        'dur_cekrollerpunch': 19,    // Cek Roller Punch
        'dur_tunggugranul': 20,      // Tunggu Granul
        'dur_perbaikandeduster': 21, // Perbaikan Deduster
        'dur_settingulangipc': 22,   // Setting Ulang IPC
        'dur_zerobalance': 23,       // Zero Balance
        'dur_tungguaproval': 24,     // Tunggu Approval
  
    };

    // MAP 2: Planned (PD Table) -> IDs from fette_master_downtime_reasons
    // Sourced from your latest screenshot (image_d839ce.png)
    const PLANNED_MAP = {
        'dur_cusuminor': 1,          // Cusu Minor
        'dur_cusumajor': 2,         // Cusu Major
        'dur_testrun': 3,           // Test Run
        'dur_bersihipc': 4,         // Pembersihan Alat Ipc
        'dur_briefing': 5,          // Briefing
        'dur_veriftimbangan': 6,    // Verifikasi Timbangan
        'dur_verifmetal': 7,        // Verifikasi Metal Detector
        'dur_sanit_matcon': 8,      // Sanitasi + Tara Matcon
        'dur_setupBN': 9,           // Setup Ganti Bn
        'dur_ipc_bobot_LC': 10,     // Ipc Awal + Set Bobot + Lc
        'dur_kumpulafkir': 11,      // Kumpulkan Afkiran
        'dur_gantimatcon': 12,      // Ganti Matcon
        'dur_timbanghasil': 13,     // Timbang Hasil
        'dur_cleanup': 14,          // Cleanup Rutin (Roller & Punch)
        'dur_closePPI': 15,         // Close Ppi
        'dur_istirahat': 16,        // Istirahat
        'dur_istirahat_soljum': 17  // CORRECTED: Istirahat (Sholat Jumat) is ID 17
    };

    // --- HELPER 1: Precise ID Lookup using Start Time ---
    const findMasterLogId = async (eventStartTime) => {
    try {
        const eventTs = Math.floor(new Date(eventStartTime).getTime() / 1000);
        // Look back 24 hours (86400 seconds) to catch long shifts
        const sql = `
            SELECT id, production_date, shift_name 
            FROM oee_master_logs 
            WHERE UNIX_TIMESTAMP(production_date) <= ? 
              AND UNIX_TIMESTAMP(production_date) > (? - 86400) 
            ORDER BY production_date DESC 
            LIMIT 1
        `;
        const [rows] = await db4.promise().query(sql, [eventTs, eventTs]);

        if (rows.length === 0) {
            console.warn(`⚠️ Warning: No Master Log found for event at: ${eventStartTime}`);
            return 0; 
        }
        return rows[0].id;
    } catch (err) {
        console.error("SQL Error in findMasterLogId:", err);
        return 0;
    }
};

    // --- HELPER 2: The Incremental ETL Worker ---
const runSingleEtl = async (sourceTable, map, category) => {
    // 1. DYNAMIC CHECKPOINT: Find the last ID we successfully imported
    const [check] = await db4.promise().query(
        `SELECT MAX(original_log_id) as lastId FROM fette_shift_events WHERE source_table = ?`, 
        [sourceTable]
    );
    
    // If table is empty, start at 0. Otherwise, start after the last known ID.
    const lastProcessedId = check[0].lastId || 0; 

    console.log(`🚀 ${sourceTable}: Checking for new data after ID ${lastProcessedId}...`);

    // 2. FETCH ONLY NEW DATA
    // We can keep a high LIMIT (e.g., 5000) just in case, but it will usually find much less.
    const [rawRows] = await dbTest.promise().query(
        `SELECT * FROM ?? WHERE id > ? ORDER BY id ASC LIMIT 5000`, 
        [sourceTable, lastProcessedId]
    );

    if (rawRows.length === 0) {
        console.log(`✅ ${sourceTable}: No new data found.`);
        return { count: 0, rows: 0 };
    }

    let insertedCount = 0;
    let updatedCount = 0;

    for (let i = 1; i < rawRows.length; i++) {
        const prevRow = rawRows[i-1];
        const currRow = rawRows[i];

        for (const [key, currVal] of Object.entries(currRow)) {
            if (map[key]) {
                const prevVal = prevRow[key] || 0;
                let duration = parseFloat(currVal) < parseFloat(prevVal) 
                    ? parseFloat(currVal) 
                    : parseFloat(currVal) - parseFloat(prevVal);

                // Filter noise (stops shorter than 6 seconds)
                if (duration > 0.1) {
                    const reasonId = map[key];
                    const endTime = new Date(currRow.timestamp * 1000); 
                    const startTime = new Date(endTime.getTime() - (duration * 60000));

                    // 3. Find Matching Shift
                    let masterId = await findMasterLogId(startTime);
                    if (!masterId) masterId = 0;

                    // 4. INSERT / UPDATE
                    // The 'unique_event_source_reason' key you added handles the magic here.
                    const [result] = await db4.promise().query(
                        `INSERT INTO fette_shift_events 
                        (start_time, end_time, duration_minutes, category, reason_id, source_table, original_log_id, shift_id) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE 
                            shift_id = VALUES(shift_id),
                            reason_id = VALUES(reason_id)`, 
                        [startTime, endTime, duration, category, reasonId, sourceTable, currRow.id, masterId]
                    );

                    if (result.affectedRows === 1) insertedCount++;
                    else if (result.affectedRows === 2) updatedCount++;
                }
            }
        }
    }
    console.log(`✅ Finished ${sourceTable}: ${insertedCount} New, ${updatedCount} Updated.`);
    return { count: insertedCount, rows: rawRows.length };
};

    // --- 3. EXECUTE BOTH STREAMS ---
    try {
        console.log("🚀 Starting ETL Process...");

        // Run Unplanned ETL
        const udResult = await runSingleEtl('NodeRed_oee_fette_ud_desc', UNPLANNED_MAP, 'Unplanned');
        
        // Run Planned ETL
        const pdResult = await runSingleEtl('NodeRed_oee_fette_pd_desc', PLANNED_MAP, 'Planned');

        console.log(`✅ ETL Complete. Created ${udResult.count + pdResult.count} events.`);

        res.send({ 
            status: "success", 
            unplanned: { scanned: udResult.rows, created: udResult.count },
            planned:   { scanned: pdResult.rows, created: pdResult.count },
            total_created: udResult.count + pdResult.count
        });

    } catch (error) {
        console.error("❌ ETL Error:", error);
        res.status(500).send({ error: error.message });
    }
},

getShiftEvents: async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        let sql = `
            SELECT 
                e.*, 
                m.name as reason_name 
            FROM fette_shift_events e
            LEFT JOIN fette_master_downtime_reasons m ON e.reason_id = m.id
        `;
        
        const params = [];

        // If dates are provided, filter by them. Otherwise, show last 100 rows.
        if (start_date && end_date) {
            sql += ` WHERE e.start_time >= ? AND e.start_time <= ? ORDER BY e.start_time DESC`;
            params.push(start_date, end_date);
        } else {
            sql += ` ORDER BY e.start_time DESC LIMIT 100`;
        }

        db4.query(sql, params, (err, results) => {
            if (err) return res.status(500).send(err);
            res.status(200).send(results);
        });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
},

// --- NEW: Fetch Stored/ETL Events for History or Edit Mode ---
// GET /part/getStoredShiftEvents
// GET /part/getStoredShiftEvents
getStoredShiftEvents: async (req, res) => {
    try {
        const { date, shift, start_date, end_date } = req.query;

        // --- OPTION A: Query by Smart View (For the Accounting Canvas) ---
        if (date && shift) {
            const shiftMap = { "Shift 1": 1, "Shift 2": 2, "Shift 3": 3 };
            const shiftNum = shiftMap[shift];

            const sql = `
                SELECT * FROM fette_smart_stats_view 
                WHERE DATE(production_date) = ? AND shift_name = ?
                ORDER BY start_time ASC
            `;

            // Use standard callback (db4.query) without 'return' or 'await'
            db4.query(sql, [date, shiftNum], (err, results) => {
                if (err) return res.status(500).send({ error: err.message });
                res.send({ status: "success", events: results });
            });
            return; // Exit to prevent falling through
        }

        // --- OPTION B: Query Raw Table (For Comparison Baseline) ---
        if (start_date && end_date) {
            const sql = `
                SELECT e.*, r.name as reason_name 
                FROM fette_shift_events e
                LEFT JOIN fette_master_downtime_reasons r ON e.reason_id = r.id
                WHERE e.start_time >= ? AND e.start_time <= ?
                ORDER BY e.start_time ASC
            `;

            db4.query(sql, [start_date, end_date], (err, results) => {
                if (err) return res.status(500).send({ error: err.message });
                res.send({ status: "success", events: results });
            });
            return;
        }

        res.status(400).send({ error: "Missing required parameters (Date/Shift or Start/End)" });

    } catch (error) {
        console.error("Backend Error:", error);
        res.status(500).send({ error: error.message });
    }
},

// GET /part/getShiftId
// GET /part/getShiftId
getShiftId: async (req, res) => {
    try {
        const { date, shift } = req.query; 
        const shiftNameMap = { "Shift 1": 1, "Shift 2": 2, "Shift 3": 3 };
        const shiftNum = shiftNameMap[shift];

        console.log("--- DEBUG GET SHIFT ID ---");
        console.log("1. Received Date:", date);       // Should be "2026-01-21"
        console.log("2. Received Shift:", shift);     // Should be "Shift 1"
        console.log("3. Mapped Shift Num:", shiftNum);// Should be 1

        if (!date || !shift) return res.status(400).send({ error: "Missing params" });

        // FIX: Use a string-based search (LIKE) to avoid Timezone math issues with DATE()
        const sql = `
            SELECT id, production_date, shift_name 
            FROM oee_master_logs 
            WHERE production_date LIKE CONCAT(?, '%') 
            AND shift_name = ?
        `;

        db4.query(sql, [date, shiftNum], (err, results) => {
            if (err) {
                console.error("SQL Error:", err);
                return res.status(500).send({ error: err.message });
            }
            
            console.log("4. DB Results found:", results.length);
            
            if (results.length > 0) {
                console.log("✅ Match Found! ID:", results[0].id);
                res.json({ shift_id: results[0].id }); 
            } else {
                console.log("❌ No Match in DB.");
                res.json({ shift_id: null }); 
            }
        });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
},

// GET /part/getAllSmartEvents
getAllSmartEvents: async (req, res) => {
    try {
        const { start_date, end_date } = req.query;

        if (!start_date || !end_date) {
            return res.status(400).send({ error: "Start and End dates are required" });
        }

        // Logic: Query the Smart View across a range. 
        // The View already handles the Machine vs Supervisor priority internally.
        const sql = `
            SELECT * FROM fette_smart_stats_view 
            WHERE production_date >= ? AND production_date <= ?
            ORDER BY start_time ASC
        `;

        db4.query(sql, [start_date, end_date], (err, results) => {
            if (err) return res.status(500).send({ error: err.message });
            
            // Send raw results to the frontend
            res.send(results);
        });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
},


getAllMasterLogs: async (req, res) => {
        try {
            console.log('\n🔍 Fetching All Master Log Columns for Emergency Override...');

            // Comprehensive column list from schema
            const sql = `
                SELECT 
                    id, 
                    production_date, 
                    shift_name, 
                    availability_value_shift, 
                    availability_value_daily, 
                    performance_value_shift, 
                    performance_value_daily, 
                    quality_value_shift, 
                    quality_value_daily, 
                    oee_value_shift, 
                    oee_value_daily, 
                    hmi_avail_value, 
                    hmi_perf_value, 
                    hmi_qual_value, 
                    hmi_oee_shift_value, 
                    total_product, 
                    total_good 
                FROM oee_master_logs 
                ORDER BY production_date DESC 
                LIMIT 100
            `;

            db4.query(sql, (err, result) => {
                if (err) {
                    console.error("SQL Error:", err.message);
                    return res.status(500).send({ error: err.message });
                }
                // Sending result array directly to facilitate frontend mapping
                res.status(200).send(result);
            });

        } catch (error) {
            console.error('❌ Fetch Error:', error);
            res.status(500).send({ error: error.message });
        }
    },

    // --- 2. DYNAMIC BULK UPDATE ---
    updateMasterLogs: async (req, res) => {
        try {
            const { changes } = req.body; 
            console.log('\n🚨 Processing Emergency Multi-Column Override...');

            const updatePromises = Object.entries(changes).map(([id, fields]) => {
                return new Promise((resolve, reject) => {
                    // Builds a SET clause for any combination of the 17 columns
                    const setClause = Object.keys(fields).map(key => `${key} = ?`).join(', ');
                    const values = Object.values(fields);
                    
                    const sql = `UPDATE oee_master_logs SET ${setClause} WHERE id = ?`;
                    
                    db4.query(sql, [...values, id], (err, result) => {
                        if (err) return reject(err);
                        resolve(result);
                    });
                });
            });

            await Promise.all(updatePromises);
            console.log('✅ Emergency Update Successful');
            res.status(200).send({ message: "All changes successfully applied." });

        } catch (error) {
            console.error('❌ Update Error:', error);
            res.status(500).send({ error: error.message });
        }
    },

    processOverride: async (req, res) => {
    const { id, raw_data, calculated_metrics } = req.body;
    
    // We use a manual transaction to ensure both tables update or neither do
    db4.beginTransaction((err) => {
      if (err) return res.status(500).send(err);

      // 1. UPDATE MASTER LOGS
      const masterSql = `
        UPDATE oee_master_logs 
        SET availability_value_shift = ?, performance_value_shift = ?, quality_value_shift = ?, 
            oee_value_shift = ?, total_product = ?, total_good = ?, reject = ?
        WHERE id = ?`;
      
      const masterParams = [
        calculated_metrics.avail, calculated_metrics.perf, calculated_metrics.qual, 
        calculated_metrics.oee, raw_data.product, raw_data.good, raw_data.reject, id
      ];

      db4.query(masterSql, masterParams, (err) => {
        if (err) return db4.rollback(() => res.status(500).send(err));

        // 2. UPDATE SHIFT EVENTS
        const eventSql = `
          UPDATE fette_shift_events 
          SET unplanned_duration = ?, planned_duration = ?, downtime_description = ?
          WHERE master_log_id = ?`;

        const eventParams = [raw_data.unplanned, raw_data.planned, raw_data.desc, id];

        db4.query(eventSql, eventParams, (err) => {
          if (err) return db4.rollback(() => res.status(500).send(err));
          
          db4.commit((err) => {
            if (err) return db4.rollback(() => res.status(500).send(err));
            res.status(200).send({ message: "Production data successfully overridden." });
          });
        });
      });
    });
  },

  getOverrideData: async (req, res) => {
    try {
        const { shift_id } = req.query; // The primary key (e.g., 612)

        if (!shift_id) {
            return res.status(400).send({ message: "shift_id is required" });
        }

        // 1. Fetch the Master Log
        const [master] = await db4.promise().query(
            `SELECT * FROM oee_master_logs WHERE id = ?`, 
            [shift_id]
        );

        if (master.length === 0) {
            return res.status(404).send({ message: "Master log not found" });
        }

        // 2. Fetch all linked events
        const [events] = await db4.promise().query(
            `SELECT fse.*, fmr.name 
             FROM fette_shift_events fse
             LEFT JOIN fette_master_downtime_reasons fmr ON fse.reason_id = fmr.id
             WHERE fse.shift_id = ?
             ORDER BY fse.start_time ASC`,
            [shift_id]
        );

        res.status(200).send({
            master: master[0],
            events: events
        });

    } catch (error) {
        console.error("❌ Fetch Override Error:", error);
        res.status(500).send({ error: error.message });
    }
},

getOverrideDataBySearch: async (req, res) => {
    try {
        const { date, shift } = req.query; // e.g., date="2026-02-03", shift="1"

        if (!date || !shift) {
            return res.status(400).send({ 
                message: "Missing search parameters. Date and Shift are required." 
            });
        }

        // 1. Find the Master Log ID based on Date and Shift Name
        const findMasterSql = `
            SELECT * FROM oee_master_logs 
            WHERE DATE(production_date) = ? 
            AND shift_name = ?
            LIMIT 1
        `;

        const [masterRows] = await db4.promise().query(findMasterSql, [date, shift]);

        if (masterRows.length === 0) {
            return res.status(404).send({ 
                message: `No record found for Date: ${date} and Shift: ${shift}` 
            });
        }

        const masterRecord = masterRows[0];
        const masterId = masterRecord.id;

        // 2. Fetch all linked events for this Master ID
        // We join with the reasons table to get the description for the UI
        const fetchEventsSql = `
            SELECT 
                fse.*, 
                fmr.name as downtime_description 
            FROM fette_shift_events fse
            LEFT JOIN fette_master_downtime_reasons fmr ON fse.reason_id = fmr.id
            WHERE fse.shift_id = ?
            ORDER BY fse.start_time ASC
        `;

        const [eventRows] = await db4.promise().query(fetchEventsSql, [masterId]);

        // 3. Return the combined object
        res.status(200).send({
            master: masterRecord,
            events: eventRows
        });

    } catch (error) {
        console.error("❌ Search Controller Error:", error);
        res.status(500).send({ 
            message: "Internal Server Error during search", 
            error: error.message 
        });
    }
},

saveOverrideData: async (req, res) => {
    const connection = await db4.promise().getConnection();
    try {
        await connection.beginTransaction();
        const { 
            master, events, changeReason, daily_recalc, 
            all_shift_ids, originalFullDay, updatedFullDay 
        } = req.body;

        // --- 1. EXTRACT USER FROM TOKEN ---
        let modifiedBy = 'SYSTEM'; // Default fallback
        
        try {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1]; // Remove "Bearer "
            
            if (token) {
                // Decode the token to get the payload (no secret needed just to read)
                // Adjust 'username' or 'name' based on what your login token stores
                const decoded = jwt.decode(token); 
                modifiedBy = decoded?.username || decoded?.name || decoded?.sub || 'Unknown User';
            }
        } catch (e) {
            console.warn("Token decode failed, using default user.");
        }

        // --- FIX: DEFINE prodDate AND shiftIdInt HERE ---
        // Force local date parsing (prevent -1 day bug)
        const d = new Date(master.production_date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const prodDate = `${year}-${month}-${day}`; 

        const shiftIdInt = parseInt(master.shift_name); 

        console.log(`📝 Shift ${shiftIdInt} Override by: ${modifiedBy}`);
        console.log(`📝 Overriding Shift ${shiftIdInt} | Date: ${prodDate} (Local)`);

        // --- 2. UPDATE GROUND TRUTH (fette_shift_logs) ---
        const updateGroundTruthSql = `
            UPDATE fette_shift_logs 
            SET 
                run_time = ?, 
                stop_time = ?, 
                total_prod = ?, 
                total_good = ?, 
                reject_count = ?, 
                planned_stop = ?, 
                unplanned_stop = ?,
                is_edited = 1,
                last_updated_by = ?,
                updated_at = NOW()
            WHERE DATE(log_date) = ? AND shift_id = ?
        `;

        const totalGood = (parseFloat(master.total_product) || 0) - (parseFloat(master.reject) || 0);

        const [gtResult] = await connection.query(updateGroundTruthSql, [
            master.total_run,           // run_time
            master.total_stop,          // stop_time
            master.total_product,       // total_prod
            totalGood,                  // total_good
            master.reject,              // reject_count
            master.planned_stop || 0,   // planned_stop
            master.unplanned_stop || 0, // unplanned_stop
            modifiedBy,                 // <--- Replaced hardcoded string with real user
            prodDate,                   // Match DATE(log_date)
            shiftIdInt                  // Match shift_id
        ]);

        if (gtResult.affectedRows === 0) {
            console.warn(`⚠️ Warning: No row found in fette_shift_logs for ${prodDate} Shift ${shiftIdInt}`);
        }

        // --- 3. UPDATE MASTER LOG & HMI (oee_master_logs) ---
        const updateMasterSql = `
            UPDATE oee_master_logs 
            SET 
                total_run = ?, total_stop = ?, total_product = ?, reject = ?, total_good = ?,
                planned_dur = ?, unplanned_dur = ?, 
                availability_value_shift = ?, performance_value_shift = ?, quality_value_shift = ?, oee_value_shift = ?,
                hmi_avail_value = ?, hmi_perf_value = ?, hmi_qual_value = ?, hmi_oee_shift_value = ?
            WHERE id = ?
        `;

        const hmiAvail = (parseFloat(master.availability_value_shift) || 0) * 100;
        const hmiPerf  = (parseFloat(master.performance_value_shift) || 0) * 100;
        const hmiQual  = (parseFloat(master.quality_value_shift) || 0) * 100;
        const hmiOee   = (parseFloat(master.oee_value_shift) || 0) * 100;

        await connection.query(updateMasterSql, [
            master.total_run, 
            master.total_stop, 
            master.total_product, 
            master.reject, 
            totalGood,
            master.planned_stop || 0,   // Maps to planned_dur
            master.unplanned_stop || 0, // Maps to unplanned_dur
            master.availability_value_shift, 
            master.performance_value_shift, 
            master.quality_value_shift, 
            master.oee_value_shift,
            hmiAvail, hmiPerf, hmiQual, hmiOee,
            master.id
        ]);

        // --- 4. SYNC EVENTS (COMMENTED OUT AS PER YOUR CODE) ---
        /*
        // [Event syncing code commented out]
        */

        // --- 5. BROADCAST DAILY OEE ---
        if (all_shift_ids && all_shift_ids.length > 0) {
            await connection.query(
                `UPDATE oee_master_logs 
                 SET availability_value_daily = ?, performance_value_daily = ?, quality_value_daily = ?, oee_value_daily = ? 
                 WHERE id IN (?)`,
                [daily_recalc.avail, daily_recalc.perf, daily_recalc.qual, daily_recalc.oee, all_shift_ids]
            );
        }

        // --- 6. AUDIT LOG ---
        // FIX: Match placeholders (?) with values. Added one ? for modifiedBy.
        await connection.query(
            `INSERT INTO fette_override_audit_logs 
            (master_log_id, change_reason, user_name, original_data_json, new_data_json, created_at) 
            VALUES (?, ?, ?, ?, ?, NOW())`, 
            [
                master.id, 
                changeReason, 
                modifiedBy, // Your new user_name field
                JSON.stringify(originalFullDay), 
                JSON.stringify(updatedFullDay)
            ]
        );

        await connection.commit();
        res.status(200).send({ message: "Success: Data updated correctly." });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("❌ Save Override Error:", error);
        res.status(500).send({ error: error.message });
    } finally {
        connection.release();
    }
},

getAuditLogs: async (req, res) => {
    try {
        const { master_id } = req.query;
        let sql = `
            SELECT 
                al.*, 
                oml.production_date, 
                oml.shift_name 
            FROM fette_override_audit_logs al
            JOIN oee_master_logs oml ON al.master_log_id = oml.id
        `;
        
        const params = [];
        if (master_id) {
            sql += ` WHERE al.master_log_id = ?`;
            params.push(master_id);
        }
        
        sql += ` ORDER BY al.created_at DESC LIMIT 100`;

        const [rows] = await db4.promise().query(sql, params);
        res.status(200).send(rows);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
},

/* --- MachineDataController.js --- */

/* --- MachineDataController.js --- */

/* --- databaseControllers.js --- */

getShiftMetadata: async (req, res) => {
    try {
        const { date, startTime, endTime } = req.query; 

        // 1. Calculate Local Unix (WIB)
        const wibStart = new Date(`${date} ${startTime}`).getTime() / 1000;
        const wibEnd = new Date(`${date} ${endTime}`).getTime() / 1000;

        // 2. SHIFT TO UTC: Subtract 7 hours (25200 seconds)
        const utcStart = wibStart - 25200; 
        const utcEnd = wibEnd - 25200;

        const sql = `
            SELECT data_format_0, data_format_1, data_format_2, data_format_3
            FROM \`CMT-VIBRATION_oee_fette_+_data\`
            WHERE \`time@timestamp\` BETWEEN ? AND ?
            ORDER BY \`time@timestamp\` ASC
        `;

        db4.query(sql, [utcStart, utcEnd], (err, results) => {
            if (err) return res.status(500).send({ error: err.message });

            const op1Map = ["ADMIN", "MAY", "MNS", "DYS", "BSA", "MTI"];
            const op2Map = ["MAY", "MNS", "DYS", "BSA", "MTI"]; 
            const prodMap = ["STMXGE", "STMXGF"];
            
            const operators = new Set();
            const batchCodes = new Set();

            results.forEach(row => {
                // Mapping OP1 (0=ADMIN)
                if (row.data_format_0 !== null && op1Map[row.data_format_0]) {
                    operators.add(op1Map[row.data_format_0]);
                }
                // Mapping OP2 (0=MAY)
                if (row.data_format_1 !== null && op2Map[row.data_format_1]) {
                    operators.add(op2Map[row.data_format_1]);
                }

                // Cleaning Batch ID
                const cleanBatch = String(row.data_format_3 || "").replace(/[^a-zA-Z0-9]/g, "").trim();
                const prefix = prodMap[row.data_format_2] || "???";
                batchCodes.add(`${prefix}${cleanBatch}`);
            });

            res.status(200).send({
                operators: Array.from(operators).join(" & ") || "NONE FOUND",
                batches: Array.from(batchCodes),
                raw_entries: results.length
            });
        });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
},

getOverrideDayData: async (req, res) => {
    try {
        const { date } = req.query;
        
        // 1. FETCH GROUND TRUTH (fette_shift_logs)
        // We JOIN with oee_master_logs ONLY to get the 'id' for event lookup.
        // We alias the columns to match what the frontend expects (total_run, total_product, etc.)
        const sql = `
            SELECT 
                -- Ground Truth Metrics from fette_shift_logs
                fsl.run_time AS total_run,
                fsl.stop_time AS total_stop,
                fsl.total_prod AS total_product,
                fsl.reject_count AS reject,
                fsl.planned_stop,
                fsl.unplanned_stop,
                fsl.shift_id AS shift_name,
                fsl.log_date AS production_date,
                
                -- Link for Events
                oml.id AS master_id 
            FROM fette_shift_logs fsl
            LEFT JOIN oee_master_logs oml 
                ON DATE(fsl.log_date) = DATE(oml.production_date) 
                AND fsl.shift_id = oml.shift_name
            WHERE DATE(fsl.log_date) = ? 
            AND fsl.shift_id IN (1, 2, 3)
        `;

        const [rows] = await db4.promise().query(sql, [date]);

        if (rows.length === 0) return res.status(200).send({}); // Return empty object if no data

        // 2. FETCH EVENTS (Using the ID from oee_master_logs)
        // We only fetch events for shifts that actually have a Master Log ID
        const validMasterIds = rows.map(r => r.master_id).filter(id => id);
        
        let events = [];
        if (validMasterIds.length > 0) {
            const [eventRows] = await db4.promise().query(
                `SELECT * FROM fette_shift_events WHERE shift_id IN (?)`,
                [validMasterIds]
            );
            events = eventRows;
        }

        // 3. GROUP BY SHIFT
        const result = {};
        
        // Initialize 3 shifts to ensure frontend doesn't break
        [1, 2, 3].forEach(id => {
            result[id] = { master: null, events: [] };
        });

        rows.forEach(row => {
            // Ensure ID is passed for the "Add Event" button to work
            // If oee_master_logs is missing (sync issue), fallback to 0 or null
            row.id = row.master_id; 
            
            result[row.shift_name] = {
                master: row,
                events: events.filter(e => e.shift_id === row.master_id)
            };
        });

        res.status(200).send(result);

    } catch (error) {
        console.error("Get Override Data Error:", error);
        res.status(500).send({ error: error.message });
    }
},

getOverrideAuditLogs: async (req, res) => {
    try {
        const sql = `
            SELECT 
                a.*, 
                m.production_date, 
                m.shift_name as target_shift 
            FROM fette_override_audit_logs a
            JOIN oee_master_logs m ON a.master_log_id = m.id
            ORDER BY a.created_at DESC
        `;
        const [logs] = await db4.promise().query(sql);
        res.status(200).send(logs);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
},

syncFetteETL: async (req, res) => {
    try {
        const { date } = req.query;
        const selectedDate = date ? new Date(date) : new Date();
        const getDateStr = (d) => d.toISOString().split('T')[0];
        
        const dayStr = getDateStr(selectedDate);
        const nextDate = new Date(selectedDate);
        nextDate.setDate(nextDate.getDate() + 1);
        const nextDayStr = getDateStr(nextDate);

        const shiftsDef = [
            { id: 1, start: `${dayStr} 06:30:00`, end: `${dayStr} 15:00:00` },
            { id: 2, start: `${dayStr} 15:00:00`, end: `${dayStr} 22:45:00` },
            { id: 3, start: `${dayStr} 22:45:00`, end: `${nextDayStr} 06:30:00` }
        ];

        console.log(`\n⚙️ ETL PROCESS: Pure Extraction for ${dayStr}`);

        const syncPromises = shiftsDef.map(s => {
            const OFFSET = 7 * 3600; 
            const startTs = (new Date(s.start).getTime() / 1000) + OFFSET;
            const endTs = (new Date(s.end).getTime() / 1000) + OFFSET;

            // --- EXTRACT (Mapping directly to your provided image index) ---
            const sqlExtract = `
                SELECT 
                    data_format_0 as run_time, 
                    data_format_1 as stop_time, 
                    data_format_2 as planned, 
                    data_format_3 as unplanned,
                    data_format_4 as total_prod, 
                    data_format_5 as total_good,
                    data_format_6 as rejects
                FROM \`CMT-VIBRATION_oee_fette_mentaj_data\` 
                WHERE \`time@timestamp\` BETWEEN ? AND ?
                ORDER BY \`time@timestamp\` DESC LIMIT 1
            `;

            return new Promise((resolve, reject) => {
                db4.query(sqlExtract, [startTs, endTs], (err, results) => {
                    if (err) return reject(err);
                    
                    const row = results[0] || { 
                        run_time: 0, stop_time: 0, planned: 0, unplanned: 0, 
                        total_prod: 0, total_good: 0, rejects: 0 
                    };

                    const shiftStartTimes = {
                        1: "06:30:00",
                        2: "15:00:00",
                        3: "22:45:00"
                    };

                    // Create the full DATETIME string for the database
                    const fullLogDateTime = `${dayStr} ${shiftStartTimes[s.id]}`;
                    
                    // --- TRANSFORM (No math, just direct mapping) ---
                    const values = [
                        fullLogDateTime,
                        s.id,
                        parseFloat(row.run_time) || 0,
                        parseFloat(row.stop_time) || 0,
                        parseInt(row.total_prod) || 0,
                        parseInt(row.total_good) || 0,
                        parseInt(row.rejects) || 0,
                        parseFloat(row.planned) || 0,
                        parseFloat(row.unplanned) || 0
                    ];

                    // --- LOAD ---
                    const sqlLoad = `
                        INSERT INTO fette_shift_logs 
                        (log_date, shift_id, run_time, stop_time, total_prod, total_good, reject_count, planned_stop, unplanned_stop)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE 
                            run_time = VALUES(run_time),
                            stop_time = VALUES(stop_time),
                            total_prod = VALUES(total_prod),
                            total_good = VALUES(total_good),
                            reject_count = VALUES(reject_count),
                            planned_stop = VALUES(planned_stop),
                            unplanned_stop = VALUES(unplanned_stop),
                            last_updated_by = 'SYSTEM_SYNC'
                    `;

                    db4.query(sqlLoad, values, (err) => {
                        if (err) return reject(err);
                        resolve();
                    });
                });
            });
        });

        await Promise.all(syncPromises);
        res.status(200).send({ message: `Sync successful for ${dayStr}. Data moved to fette_shift_logs.` });

    } catch (error) {
        console.error('❌ ETL Error:', error);
        res.status(500).send({ message: 'Sync failed', error: error.message });
    }
},

backfillFetteETL: async (req, res) => {
    try {
        let currentDate = new Date('2026-02-08');
        const endDate = new Date('2026-02-10');
        
        while (currentDate <= endDate) {
            const dayStr = currentDate.toISOString().split('T')[0];
            console.log(`⏳ Backfilling: ${dayStr}`);
            await performSyncForDate(dayStr);
            currentDate.setDate(currentDate.getDate() + 1);
        }
        res.status(200).send({ message: "Historical backfill complete from Jan 1 to Feb 8." });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
},

overrideShiftData: async (req, res) => {
    const { date, shift_id, run_time, stop_time, total_prod, total_good, reject_count, planned_stop, unplanned_stop } = req.body;

    // Constants for Recalculation
    const TARGET_RATE = 5333; // Speed (Tablets/Min)
    const SHIFT_DURATIONS = { 1: 510, 2: 465, 3: 465 }; // Minutes

    try {
        console.log(`📝 Overriding data for ${date} Shift ${shift_id}...`);

        // --- STEP 1: UPDATE RAW TABLE (fette_shift_logs) ---
        // This fixes the Live Dashboard & Pie Charts
        const updateRawSql = `
            UPDATE fette_shift_logs 
            SET run_time = ?, stop_time = ?, total_prod = ?, total_good = ?, 
                reject_count = ?, planned_stop = ?, unplanned_stop = ?
            WHERE log_date = ? AND shift_id = ?
        `;
        
        await db4.promise().query(updateRawSql, [
            run_time, stop_time, total_prod, total_good, reject_count, planned_stop, unplanned_stop,
            date, shift_id
        ]);

        // --- STEP 2: RECALCULATE OEE PERCENTAGES ---
        const t = SHIFT_DURATIONS[shift_id]; 
        const r = parseFloat(run_time) || 0;
        const o = parseFloat(total_prod) || 0;
        const g = parseFloat(total_good) || 0;
        const p = parseFloat(planned_stop) || 0;

        // Availability
        const availDenom = t - p;
        const availVal = availDenom > 0 ? (r / availDenom) * 100 : 0;

        // Performance
        const pot = r * TARGET_RATE;
        const perfVal = pot > 0 ? (o / pot) * 100 : 0;

        // Quality
        const qualVal = o > 0 ? (g / o) * 100 : 0;

        // OEE
        const oeeVal = (availVal * perfVal * qualVal) / 10000;

        // --- STEP 3: UPDATE MASTER LOG (oee_master_logs) ---
        // This fixes the Historical Log Table
        // Note: We map 'date' to 'production_date' and 'shift_id' to 'shift_name'
        const updateMasterSql = `
            UPDATE oee_master_logs
            SET 
                -- Raw Values
                total_run = ?, total_stop = ?, total_product = ?, reject = ?, 
                
                -- Calculated Percentages (Shift Level)
                oee_value_shift = ?, availability_value_shift = ?, 
                performance_value_shift = ?, quality_value_shift = ?
            WHERE production_date = ? AND shift_name = ?
        `;

        await db4.promise().query(updateMasterSql, [
            r, stop_time, o, reject_count, // Raw Updates
            oeeVal, availVal, perfVal, qualVal, // Calculated Updates
            date, shift_id // Where Clause
        ]);

        console.log("✅ Sync Complete: Updated Raw Table & Recalculated Master Log.");
        res.status(200).send({ message: "Override successful and synced to Master Log." });

    } catch (error) {
        console.error("❌ Override Error:", error);
        res.status(500).send({ message: "Failed to override data", error: error.message });
    }
},

getAllLatestTimestamps: async (req, res) => {
    try {
        const dataSources = [
            // ==========================================
            // NEW TABLES (STAGING)
            // ==========================================
            { 
                key: 'IPC_Scale_Staging', 
                table: 'sakaplant_prod_ipc_scale_staging', 
                db: db4, 
                category: 'IPC', 
                columnName: 'created_date', 
                type: 'datetime', 
            },
            { 
                key: 'IPC_MA_Staging', 
                table: 'sakaplant_prod_ipc_ma_staging', 
                db: db4, 
                category: 'IPC', 
                columnName: 'created_date', 
                secondaryColumn: 'created_time', 
                type: 'split_datetime', 
            },
            {
                key: 'IPC_Hardness', 
                table: 'ipc_hardness', 
                db: db4, 
                category: 'IPC', 
                columnName: 'created_date', 
                secondaryColumn: 'time_insert', 
                type: 'split_datetime', 
            },

            // ==========================================
            // EXISTING TABLES (Line 1, Line 3, NodeRed)
            // ==========================================
            { key: 'EBR_FBD_L3',      table: 'cMT-GEA-L3_Data_FBD_L3_data',       db: db3, category: 'Line 3', columnName: 'time@timestamp', type: 'unix' },
            { key: 'EBR_PMA_L3',      table: 'cMT-GEA-L3_EBR_PMA_L3_data',        db: db3, category: 'Line 3', columnName: 'time@timestamp', type: 'unix' },
            { key: 'EBR_EPH_L3',      table: 'cMT-GEA-L3_EBR_EPH_L3_data',        db: db3, category: 'Line 3', columnName: 'time@timestamp', type: 'unix' },
            { key: 'EBR_WETMILL',     table: 'cMT-GEA-L3_EBR_WETMILL_data',       db: db3, category: 'Line 3', columnName: 'time@timestamp', type: 'unix' },
            { key: 'Current_PMA_L3',  table: 'cMT-GEA-L3_Current_PMA_L3_data',    db: db3, category: 'Line 3', columnName: 'time@timestamp', type: 'unix' },
            { key: 'Data_FBD_L3',     table: 'cMT-GEA-L3_Data_FBD_L3_data',       db: db3, category: 'Line 3', columnName: 'time@timestamp', type: 'unix' },
            { key: 'PMA_KWmeter',     table: 'cMT-GEA-L3_PMA_KWmeter_data',       db: db3, category: 'Line 3', columnName: 'time@timestamp', type: 'unix' },
            { key: 'PMA_RECIPE_FULL', table: 'cMT-GEA-L3_PMA_RECIPE_RECOR_data', db: db3, category: 'Line 3', columnName: 'time@timestamp', type: 'unix' },
            { key: 'Mezanine_Coating', table: 'mezanine.tengah_Coating-FilteNEW_data', db: db3, category: 'Line 1', columnName: 'time@timestamp', type: 'unix' },

            { key: 'PMA (L1)',        table: 'cMT-FHDGEA1_EBR_PMA_new_data',      db: db4, category: 'Line 1', columnName: 'time@timestamp', type: 'unix' },
            { key: 'FBD (L1)',        table: 'cMT-FHDGEA1_EBR_FBD_new_data',      db: db4, category: 'Line 1', columnName: 'time@timestamp', type: 'unix' },
            { key: 'EPH (L1)',        table: 'cMT-FHDGEA1_EBR_EPH_new_data',      db: db4, category: 'Line 1', columnName: 'time@timestamp', type: 'unix' },
            { key: 'Wetmill (L1)',    table: 'cMT-FHDGEA1_EBR_Wetmill_new_data',  db: db4, category: 'Line 1', columnName: 'time@timestamp', type: 'unix' },
            
            { key: 'NR_Coating',           table: 'NodeRed_Coating',                db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_CoatingFilter',     table: 'NodeRed_CoatingFilterNEW',       db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_EPH_L1',            table: 'NodeRed_EPH_L1',                 db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_EPH_L3',            table: 'NodeRed_EPH_L3',                 db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_EPH_L3_1',          table: 'NodeRed_EPH_L3_1',               db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_EPH_Vakum_L1',      table: 'NodeRed_EPH_Vakum_L1',           db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_FBD_L1',            table: 'NodeRed_FBD_L1',                 db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_FBD_L1_1',          table: 'NodeRed_FBD_L1_1',               db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_FBD_L1_Filter',     table: 'NodeRed_FBD_L1_FilterProduct',   db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_FBD_L3',            table: 'NodeRed_FBD_L3',                 db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_FBD_L3_1',          table: 'NodeRed_FBD_L3_1',               db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_FBD_L3_2',          table: 'NodeRed_FBD_L3_2',               db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_FBD_L3_Filter',     table: 'NodeRed_FBD_L3_FilterProduct',   db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_FinalMix',          table: 'NodeRed_FinalMix',               db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_GEA_FilterNew',     table: 'NodeRed_GEA_FilterNew',          db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_PMA_KWmeter',       table: 'NodeRed_PMA_KWmeter',            db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_PMA_L1',            table: 'NodeRed_PMA_L1',                 db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_PMA_L3',            table: 'NodeRed_PMA_L3',                 db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_PMA_L3_1',          table: 'NodeRed_PMA_L3_1',               db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_PMA_L3_2',          table: 'NodeRed_PMA_L3_2',               db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_PMA_L3_3',          table: 'NodeRed_PMA_L3_3',               db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_PMA_L3_4',          table: 'NodeRed_PMA_L3_4',               db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_TotalPD',           table: 'NodeRed_TotalPD',                db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_Vibration_Fette',   table: 'NodeRed_Vibration_Fette_L1',     db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_WETMILL_L3',        table: 'NodeRed_WETMILL_L3',             db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_WETMILL_L3_1',      table: 'NodeRed_WETMILL_L3_1',           db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_WH2_Monitoring',    table: 'NodeRed_WH2_Monitoring',         db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_Wetmill_L1',        table: 'NodeRed_Wetmill_L1',             db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_Wetmill_L1_1',      table: 'NodeRed_Wetmill_L1_1',           db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_Time_EPH_L1',       table: 'NodeRed_timeproses_EPH_L1',      db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_Time_FBD_L1',       table: 'NodeRed_timeproses_FBD_L1',      db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_Time_Granulasi',    table: 'NodeRed_timeproses_GRANULASI_L1',db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_Time_PMA_L1',       table: 'NodeRed_timeproses_PMA_L1',      db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_Time_Vacum_L1',     table: 'NodeRed_timeproses_VACUM_L1',    db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_Time_Vacum_Open',   table: 'NodeRed_timeproses_VACUM_OpenSystem', db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NR_Time_Wetmill_L1',   table: 'NodeRed_timeproses_WETMILL_L1',  db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NodeRed_WH1_Monitoring',   table: 'NodeRed_WH1_Monitoring',  db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
            { key: 'NodeRed_WH2_Monitoring',   table: 'NodeRed_WH2_Monitoring',  db: dbTest, category: 'NodeRed', columnName: 'timestamp', type: 'unix' },
           

        ];

        const queries = dataSources.map(async (source) => {
            let query = '';
            
            // --- QUERY CONSTRUCTION ---
            if (source.type === 'split_datetime') {
                query = `
                    SELECT \`${source.columnName}\`, \`${source.secondaryColumn}\`
                    FROM \`${source.table}\` 
                    ORDER BY \`${source.columnName}\` DESC, \`${source.secondaryColumn}\` DESC 
                    LIMIT 1
                `;
            } else {
                query = `
                    SELECT \`${source.columnName}\` 
                    FROM \`${source.table}\` 
                    ORDER BY \`${source.columnName}\` DESC 
                    LIMIT 1
                `;
            }
            
            try {
                const [rows] = await source.db.promise().query(query);
                
                let readableDate = 'No Data';
                let unixTimestamp = null;

                if (rows.length > 0) {
                    const row = rows[0];

                    // --- RESULT PARSING ---
                    if (source.type === 'split_datetime') {
                        const dateVal = row[source.columnName];
                        const timeVal = row[source.secondaryColumn];

                        if (dateVal && timeVal) {
                            const dateStr = (dateVal instanceof Date) 
                                ? dateVal.toLocaleDateString('sv-SE') 
                                : dateVal;
                                
                            readableDate = `${dateStr} ${timeVal}`;
                            unixTimestamp = new Date(readableDate).getTime() / 1000;
                        }
                    } 
                    else if (source.type === 'datetime') {
                        const rawVal = row[source.columnName];
                        
                        if (rawVal instanceof Date) {
                             const dateStr = rawVal.toLocaleDateString('sv-SE');
                             const timeStr = rawVal.toLocaleTimeString('id-ID', { hour12: false });
                             readableDate = `${dateStr} ${timeStr}`;
                             unixTimestamp = rawVal.getTime() / 1000;
                        } else {
                             readableDate = rawVal;
                             unixTimestamp = new Date(rawVal).getTime() / 1000;
                        }
                    } 
                    else {
                        // DEFAULT: Unix Timestamp (Integers/Floats)
                        const val = row[source.columnName];
                        if (val) {
                            unixTimestamp = parseFloat(val);
                            
                            // ==========================================
                            // 7-HOUR WIB SHIFT FOR LINE 1 & LINE 3
                            // ==========================================
                            if (source.category === 'Line 1' || source.category === 'Line 3') {
                                unixTimestamp = unixTimestamp - 25200; // 7 hours in seconds
                            }

                            if (source.category === 'NodeRed') {
                                readableDate = formatTimestampWIB(unixTimestamp);
                            } else {
                                readableDate = formatTimestampLocal(unixTimestamp);
                            }
                        }
                    }
                }

                return {
                    name: source.key,
                    table: source.table,
                    category: source.category,
                    timestamp: unixTimestamp, 
                    last_update: readableDate, 
                    status: unixTimestamp ? 'Active' : 'Inactive'
                };
            } catch (err) {
                console.error(`Error fetching ${source.key}:`, err.message);
                return {
                    name: source.key,
                    table: source.table,
                    category: source.category,
                    error: "Error",
                    last_update: null
                };
            }
        });

        const results = await Promise.all(queries);

        res.status(200).json({
            message: "Latest timestamps fetched successfully",
            total_sources: results.length,
            data: results
        });

    } catch (error) {
        console.error("Controller Error:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
},

getTableIntegrityLogs: async (req, res) => {
// NEW: We now accept dbName directly from React
    const { tableName, startDate, endDate, expectedRows = 1440, dbName, columnName } = req.query;
    const targetRows = parseInt(expectedRows);

    // ==========================================
    // EXPLICIT DATABASE SELECTION
    // ==========================================
    // Map the string passed by React to your actual MySQL/MariaDB connections
    const dbConnections = {
        'db': db,
        'db2': db2,
        'db3': db3,
        'db4': db4,
        'dbTest': dbTest
    };

    // Select the requested database, fallback to db4 if something goes wrong
    const targetDb = dbConnections[dbName] || db4;

    const col = `\`${columnName}\``;

    // ==========================================
    // SQL QUERIES
    // ==========================================
    const boundaryDatesQuery = `
        SELECT 
            DATE(FROM_UNIXTIME(FLOOR(MIN(${col})))) AS first_date,
            DATE(FROM_UNIXTIME(FLOOR(MAX(${col})))) AS last_date
        FROM \`${tableName}\`
    `;

    const logsQuery = `
        SELECT 
            d.check_date,
            IFNULL(t.actual_rows, 0) AS actual_rows,
            ? AS expected_rows,
            ROUND((IFNULL(t.actual_rows, 0) / ?) * 100, 2) AS integrity_percent,
            CASE 
                WHEN IFNULL(t.actual_rows, 0) = 0 THEN 'NO DATA'
                WHEN IFNULL(t.actual_rows, 0) < ? THEN 'GAP FOUND'
                ELSE 'OK'
            END AS status
        FROM (
            SELECT DATE_ADD(?, INTERVAL seq.n DAY) AS check_date
            FROM (
                SELECT (p0.n + p1.n*10 + p2.n*100) AS n
                FROM (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) p0,
                     (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) p1,
                     (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) p2
            ) seq
            WHERE DATE_ADD(?, INTERVAL seq.n DAY) <= ?
        ) d
        LEFT JOIN (
            SELECT 
                DATE(FROM_UNIXTIME(FLOOR(${col}))) AS log_date,
                COUNT(*) AS actual_rows
            FROM \`${tableName}\`
            WHERE FROM_UNIXTIME(${col}) BETWEEN ? AND ?
            GROUP BY log_date
        ) t ON d.check_date = t.log_date
        ORDER BY d.check_date ASC;
    `;

    try {
        const [boundaryDatesResult, logsResult] = await Promise.all([
            targetDb.promise().query(boundaryDatesQuery),
            targetDb.promise().query(logsQuery, [targetRows, targetRows, targetRows, startDate, startDate, endDate, startDate, endDate])
        ]);

        res.json({
            first_date: boundaryDatesResult[0][0]?.first_date || null,
            last_date: boundaryDatesResult[0][0]?.last_date || null,
            logs: logsResult[0]
        });

    } catch (err) {
        console.error(`Error on ${dbName} -> ${tableName}:`, err.message);
        res.status(500).json({ error: err.message });
    }
},

getHourlyHeatmap: async (req, res) => {
    const { tableName, date, dbName, columnName = 'time@timestamp' } = req.query;
    const dbConnections = { 'db': db, 'db2': db2, 'db3': db3, 'db4': db4, 'dbTest': dbTest };
    const targetDb = dbConnections[dbName] || db4;
    const col = `\`${columnName}\``;

    // This query groups rows by hour (0-23) for the selected date
    const query = `
        SELECT 
            HOUR(FROM_UNIXTIME(${col})) AS hour,
            COUNT(*) AS actual_rows,
            60 AS expected_rows
        FROM \`${tableName}\`
        WHERE DATE(FROM_UNIXTIME(${col})) = ?
        GROUP BY hour
        ORDER BY hour ASC;
    `;

    try {
        const [rows] = await targetDb.promise().query(query, [date]);
        // Fill in missing hours with 0 to ensure a full 24-hour grid
        const fullDay = Array.from({ length: 24 }, (_, i) => {
            const found = rows.find(r => r.hour === i);
            return found ? found : { hour: i, actual_rows: 0, expected_rows: 60 };
        });
        res.json(fullDay);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
},

    // --- 1. READ (Updated to fetch raw_timestamp for CRUD mapping) ---
    getWH2DashboardData: async (req, res) => {
    try {
        const { startDate, endDate, area, interval = 'hour' } = req.query;

        if (!startDate || !endDate || !area) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const areaMapping = {
            'Area 1': { temp: 'O2THG022_temp', hum: 'O2THG022_hum' },
            'Area 2': { temp: 'O2THG023_temp', hum: 'O2THG023_hum' },
            'Area 3': { temp: 'O2THG024_temp', hum: 'O2THG024_hum' }
        };

        // 1. Determine which areas to query (Safely handles "All" without crashing)
        let areasToQuery = [];
        if (area === 'All') {
            areasToQuery = Object.keys(areaMapping); // ['Area 1', 'Area 2', 'Area 3']
        } else {
            if (!areaMapping[area]) return res.status(400).json({ error: 'Invalid area' });
            areasToQuery = [area]; // ['Area 1']
        }

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0); 
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); 

        const startEpoch = Math.floor(start.getTime() / 1000); 
        const endEpoch = Math.floor(end.getTime() / 1000);

        // Duplicate the timestamps for however many queries we are stacking
        const queryParams = [].concat(...areasToQuery.map(() => [startEpoch, endEpoch]));

        // --- 2. BUILD THE STATS QUERY (Stacks the areas to get a global max/min/avg) ---
        const statsSubQueries = areasToQuery.map(a => {
            const cols = areaMapping[a];
            return `SELECT ${cols.temp} AS temp, ${cols.hum} AS hum FROM NodeRed_WH2_Monitoring WHERE timestamp >= ? AND timestamp <= ?`;
        });
        
        const statsQuery = `
            SELECT 
                ROUND(MAX(temp), 2) AS maxTemp, ROUND(MIN(temp), 2) AS minTemp, ROUND(AVG(temp), 2) AS avgTemp,
                ROUND(MAX(hum), 2) AS maxHum, ROUND(MIN(hum), 2) AS minHum, ROUND(AVG(hum), 2) AS avgHum
            FROM (${statsSubQueries.join(' UNION ALL ')}) AS combined_data
        `;

        // --- 3. BUILD THE INTERVAL QUERY (Stacks the areas for the Graph and Table) ---
        let intervalQuery;

        if (interval.toLowerCase() === 'minute') {
            const intervalSubQueries = areasToQuery.map(a => {
                const cols = areaMapping[a];
                return `
                    SELECT 
                        timestamp AS raw_timestamp, 
                        DATE_FORMAT(FROM_UNIXTIME(timestamp), '%Y-%m-%d %H:%i:%s') AS log_time,
                        '${a}' AS area,
                        ROUND(${cols.temp}, 2) AS temperature,
                        ROUND(${cols.hum}, 2) AS humidity
                    FROM NodeRed_WH2_Monitoring
                    WHERE timestamp >= ? AND timestamp <= ?
                `;
            });
            intervalQuery = intervalSubQueries.join(' UNION ALL ') + ' ORDER BY raw_timestamp ASC, area ASC';
            
        } else {
            const intervalMapping = {
                'hour':   '%Y-%m-%d %H:00:00',
                'day':    '%Y-%m-%d 00:00:00',
                'month':  '%Y-%m-01 00:00:00'
            };
            
            const sqlDateFormat = intervalMapping[interval.toLowerCase()];
            if (!sqlDateFormat) return res.status(400).json({ error: 'Invalid interval' });

            const intervalSubQueries = areasToQuery.map(a => {
                const cols = areaMapping[a];
                return `
                    SELECT 
                        MIN(timestamp) AS raw_timestamp, 
                        DATE_FORMAT(FROM_UNIXTIME(timestamp), '${sqlDateFormat}') AS log_time,
                        '${a}' AS area,
                        ROUND(AVG(${cols.temp}), 2) AS temperature,
                        ROUND(AVG(${cols.hum}), 2) AS humidity
                    FROM NodeRed_WH2_Monitoring
                    WHERE timestamp >= ? AND timestamp <= ?
                    GROUP BY log_time
                `;
            });
            intervalQuery = intervalSubQueries.join(' UNION ALL ') + ' ORDER BY raw_timestamp ASC, area ASC';
        }

        // --- 4. EXECUTE ---
        const [[statsRows], [intervalRows]] = await Promise.all([
            dbTest.promise().query(statsQuery, queryParams),
            dbTest.promise().query(intervalQuery, queryParams)
        ]);

        res.status(200).json({
            success: true,
            statistics: statsRows[0] || {}, 
            intervalData: intervalRows 
        });

    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
},

    // --- 2. UPDATE ---
    updateWH2DashboardData: async (req, res) => {
    try {
        const { area, raw_timestamp, temperature, humidity } = req.body;
        
        // 1. Get the user from the token (Assuming your auth middleware sets req.user)
        const userName = req.user ? req.user.name : 'Unknown User'; 

        if (!area || !raw_timestamp || temperature === undefined || humidity === undefined) {
            return res.status(400).json({ error: 'Missing update parameters' });
        }

        const areaMapping = {
            'Area 1': { temp: 'O2THG022_temp', hum: 'O2THG022_hum' },
            'Area 2': { temp: 'O2THG023_temp', hum: 'O2THG023_hum' },
            'Area 3': { temp: 'O2THG024_temp', hum: 'O2THG024_hum' }
        };
        const cols = areaMapping[area];

        // 2. READ BEFORE WRITE: Fetch the old data so we can log it
        const fetchOldQuery = `SELECT ${cols.temp} AS oldTemp, ${cols.hum} AS oldHum FROM NodeRed_WH2_Monitoring WHERE timestamp = ?`;
        const [oldRows] = await dbTest.promise().query(fetchOldQuery, [raw_timestamp]);
        
        if (oldRows.length === 0) {
            return res.status(404).json({ error: 'Data not found' });
        }

        const oldData = oldRows[0];

        // 3. Perform the actual UPDATE on the sensor table
        const updateQuery = `UPDATE NodeRed_WH2_Monitoring SET ${cols.temp} = ?, ${cols.hum} = ? WHERE timestamp = ?`;
        await dbTest.promise().query(updateQuery, [temperature, humidity, raw_timestamp]);

        // 4. Construct the JSON Details payload
        const auditDetails = {
            area: area,
            temperature: { old: oldData.oldTemp, new: Number(temperature) },
            humidity: { old: oldData.oldHum, new: Number(humidity) }
        };

        // 5. Save everything to the Audit Table
        const auditQuery = `
            INSERT INTO WH2_Audit_Logs (user_name, action_type, target_timestamp, details)
            VALUES (?, 'UPDATE', ?, ?)
        `;
        // JSON.stringify() converts the JavaScript object into a JSON string for MySQL
        await db4.promise().query(auditQuery, [userName, raw_timestamp, JSON.stringify(auditDetails)]);

        res.status(200).json({ success: true, message: 'Data updated and logged successfully' });

    } catch (error) {
        console.error('Error updating data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
},

    // --- 3. DELETE (Soft delete for specific area via NULL) ---
    deleteWH2DashboardData: async (req, res) => {
    try {
        const { area, raw_timestamp } = req.body;
        
        // 1. Get the user from the token
        const userName = req.user ? req.user.name : 'Unknown User';

        if (!area || !raw_timestamp) {
            return res.status(400).json({ error: 'Missing delete parameters' });
        }

        const areaMapping = {
            'Area 1': { temp: 'O2THG022_temp', hum: 'O2THG022_hum' },
            'Area 2': { temp: 'O2THG023_temp', hum: 'O2THG023_hum' },
            'Area 3': { temp: 'O2THG024_temp', hum: 'O2THG024_hum' }
        };

        // 2. Determine which areas are being deleted safely
        let areasToDelete = [];
        if (area === 'All') {
            areasToDelete = Object.keys(areaMapping); 
        } else {
            if (!areaMapping[area]) return res.status(400).json({ error: 'Invalid area' });
            areasToDelete = [area]; 
        }

        // 3. READ BEFORE WRITE: Dynamically construct the SELECT query
        let selectCols = [];
        areasToDelete.forEach(a => {
            const cols = areaMapping[a];
            selectCols.push(`${cols.temp} AS ${a.replace(' ', '')}_temp`);
            selectCols.push(`${cols.hum} AS ${a.replace(' ', '')}_hum`);
        });

        const fetchOldQuery = `SELECT ${selectCols.join(', ')} FROM NodeRed_WH2_Monitoring WHERE timestamp = ?`;
        const [oldRows] = await dbTest.promise().query(fetchOldQuery, [raw_timestamp]);
        
        if (oldRows.length === 0) {
            return res.status(404).json({ error: 'Data not found' });
        }
        const oldData = oldRows[0];

        // 4. Perform the Soft Delete (Dynamically SET specific columns to NULL)
        let updateCols = [];
        areasToDelete.forEach(a => {
            const cols = areaMapping[a];
            updateCols.push(`${cols.temp} = NULL`);
            updateCols.push(`${cols.hum} = NULL`);
        });

        const deleteQuery = `UPDATE NodeRed_WH2_Monitoring SET ${updateCols.join(', ')} WHERE timestamp = ?`;
        await dbTest.promise().query(deleteQuery, [raw_timestamp]);

        // --- 4.5 THE GARBAGE COLLECTION CHECK ---
        // Check if the entire row is now completely empty
        const checkEmptyQuery = `
            SELECT O2THG022_temp, O2THG022_hum, O2THG023_temp, O2THG023_hum, O2THG024_temp, O2THG024_hum
            FROM NodeRed_WH2_Monitoring WHERE timestamp = ?
        `;
        const [emptyCheckRows] = await dbTest.promise().query(checkEmptyQuery, [raw_timestamp]);
        
        if (emptyCheckRows.length > 0) {
            const row = emptyCheckRows[0];
            const isCompletelyEmpty = 
                row.O2THG022_temp === null && row.O2THG022_hum === null &&
                row.O2THG023_temp === null && row.O2THG023_hum === null &&
                row.O2THG024_temp === null && row.O2THG024_hum === null;

            // If it is completely empty, Hard Delete the row to prevent ghost rows in the UI
            if (isCompletelyEmpty) {
                await dbTest.promise().query(`DELETE FROM NodeRed_WH2_Monitoring WHERE timestamp = ?`, [raw_timestamp]);
            }
        }

        // 5. Save to the Audit Table 
        for (const targetArea of areasToDelete) {
            const oldTemp = oldData[`${targetArea.replace(' ', '')}_temp`];
            const oldHum = oldData[`${targetArea.replace(' ', '')}_hum`];

            if (oldTemp !== null || oldHum !== null) {
                const auditDetails = {
                    area: targetArea,
                    temperature: { old: oldTemp, new: null },
                    humidity: { old: oldHum, new: null }
                };

                const auditQuery = `
                    INSERT INTO WH2_Audit_Logs (user_name, action_type, target_timestamp, details)
                    VALUES (?, 'DELETE', ?, ?)
                `;
                await db4.promise().query(auditQuery, [userName, raw_timestamp, JSON.stringify(auditDetails)]);
            }
        }

        res.status(200).json({ success: true, message: 'Data deleted and logged successfully' });

    } catch (error) {
        console.error('Error deleting data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
},

    createWH2DashboardData: async (req, res) => {
    try {
        const { timestamp, area, temperature, humidity } = req.body;
        
        // 1. Get the user from the token
        const userName = req.user ? req.user.name : 'Unknown User';

        const epoch = Math.floor(new Date(timestamp).getTime() / 1000);

        const areaMapping = {
            'Area 1': { temp: 'O2THG022_temp', hum: 'O2THG022_hum' },
            'Area 2': { temp: 'O2THG023_temp', hum: 'O2THG023_hum' },
            'Area 3': { temp: 'O2THG024_temp', hum: 'O2THG024_hum' }
        };

        const cols = areaMapping[area];
        if (!cols) return res.status(400).json({ error: 'Invalid area' });

        // 2. Ensure data doesn't already exist to prevent overwrites
        const checkQuery = `SELECT timestamp FROM NodeRed_WH2_Monitoring WHERE timestamp = ?`;
        const [existingData] = await dbTest.promise().query(checkQuery, [epoch]);

        if (existingData.length > 0) {
            return res.status(409).json({ 
                error: 'Data already exists for this specific time. Please use Edit Mode if you need to change it.' 
            });
        }

        // 3. Perform the Insert
        const insertQuery = `
            INSERT INTO NodeRed_WH2_Monitoring (timestamp, ${cols.temp}, ${cols.hum})
            VALUES (?, ?, ?)
        `;
        await dbTest.promise().query(insertQuery, [epoch, temperature, humidity]);

        // 4. Construct the JSON Details payload (Old is null, New has data)
        const auditDetails = {
            area: area,
            temperature: { old: null, new: Number(temperature) },
            humidity: { old: null, new: Number(humidity) }
        };

        // 5. Save to the Audit Table
        const auditQuery = `
            INSERT INTO WH2_Audit_Logs (user_name, action_type, target_timestamp, details)
            VALUES (?, 'CREATE', ?, ?)
        `;
        await db4.promise().query(auditQuery, [userName, epoch, JSON.stringify(auditDetails)]);

        res.status(201).json({ success: true, message: 'Missing data successfully filled and logged.' });

    } catch (error) {
        console.error('Error creating data:', error);
        res.status(500).json({ error: 'Failed to create entry.' });
    }
},

getWH2AuditLogs: async (req, res) => {
    try {
        const { search, month, year, startDate, endDate } = req.query;

        // Base query
        let query = `SELECT * FROM WH2_Audit_Logs WHERE 1=1 `;
        let queryParams = [];

        // 1. Search Filter (Checks Name or Action Type)
        if (search) {
            query += ` AND (user_name LIKE ? OR action_type LIKE ?) `;
            queryParams.push(`%${search}%`, `%${search}%`);
        }

        // 2. Date Logic: Advanced vs Standard
        if (startDate && endDate) {
            // Advanced Range (e.g., '2026-04-10' to '2026-04-20')
            query += ` AND DATE(action_timestamp) >= ? AND DATE(action_timestamp) <= ? `;
            queryParams.push(startDate, endDate);
        } else if (month && year) {
            // Standard Month/Year 
            query += ` AND MONTH(action_timestamp) = ? AND YEAR(action_timestamp) = ? `;
            queryParams.push(month, year);
        }

        // Sort newest first
        query += ` ORDER BY action_timestamp DESC`;

        const [rows] = await db4.promise().query(query, queryParams);

        res.status(200).json({ success: true, logs: rows });

    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
},

getWarehouseUsers: async (req, res) => {
    try {
        // 1. Check if the middleware successfully attached the user
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
        }

        // 2. Extract the level safely. We use 'const' because we do not change this number below.
        const userLevel = req.user.level ? parseInt(req.user.level, 10) : 5;
        
        // 3. The Security Lock
        if (userLevel > 5) {
            return res.status(403).json({ error: 'Forbidden: Managers only.' });
        }

        // 4. The Query. We use 'const' because this string doesn't change.
        const query = `
            SELECT id_users, username, name, email, level 
            FROM users 
            WHERE department = 'Warehouse'
            ORDER BY name ASC
        `;
        
        const [users] = await db.promise().query(query);
        res.status(200).json({ success: true, users });

    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
},

updateUserLevel: async (req, res) => {
    try {
        const { target_user_id, new_level } = req.body;

        // 1. Security Check: Manager level required
        const userLevel = req.user.level ? parseInt(req.user.level, 10) : 1;
        
        // 2. THE LOCK: Kick out anyone who is NOT a 3 or a 5
        if (userLevel !== 3 && userLevel !== 5) {
            return res.status(403).json({ error: 'Forbidden: Requires Manager or Admin access.' });
        }

        // 2. THE ULTIMATE LOCK: The WHERE clause
        // By adding "AND department = 'Warehouse'", we make it physically 
        // impossible for this query to alter an IT or HR user, even if 
        // the manager somehow passes in the wrong target_user_id.
        const updateQuery = `
            UPDATE users 
            SET level = ? 
            WHERE id_users = ? AND department = 'Warehouse'
        `;

        const [result] = await db.promise().query(updateQuery, [new_level, target_user_id]);

        // 3. Verify it actually worked
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found, or user does not belong to the Warehouse department.' });
        }

        res.status(200).json({ success: true, message: 'User level updated successfully.' });

    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
},

// --- MAIN CONTROLLER CALLED BY FRONTEND ---
 GetSuhuMonitoringData: async (req, res) => {
    try {
        const { selectedDate, line, batch } = req.body;

        if (!selectedDate || !line || !batch) {
            return res.status(400).send({ error: "Date, Line, and Batch are required" });
        }

        // 1. Calculate Time Boundaries
        const startOfDay = new Date(`${selectedDate}T00:00:00+07:00`);
        const endOfDay = new Date(`${selectedDate}T23:59:59+07:00`);
        let dayStart = Math.floor(startOfDay.getTime() / 1000);
        let dayEnd = Math.floor(endOfDay.getTime() / 1000);
        
        if (line === 'Line 1' || line === 'Line 3') {
            dayStart += 25200;
            dayEnd += 25200;
        }

        let monitorTable = 'cMT-DB-EMS-UTY2_R_X06_New_data';
        
        // ==========================================
        // STEP 1: FIND EXACT BATCH TIME WINDOW (GLOBAL CALENDAR SEARCH)
        // ==========================================
        const baseBatch = batch.replace(/-[12]$/, '').trim();
        const searchLike = `%${baseBatch}%`;

        let batchStart = null;
        let batchEnd = null;
        const searchDate = selectedDate; 

        if (line === 'Line 1') {
            const [ [pma], [fbd], [eph] ] = await Promise.all([
                dbTest.promise().query(`SELECT MIN(\`timestamp\`) AS minT, MAX(\`timestamp\`) AS maxT FROM \`test\`.\`NodeRed_PMA_L1\` WHERE batchid LIKE ? AND DATE(FROM_UNIXTIME(\`timestamp\`)) = ?`, [searchLike, searchDate]),
                dbTest.promise().query(`SELECT MIN(\`timestamp\`) AS minT, MAX(\`timestamp\`) AS maxT FROM \`test\`.\`NodeRed_FBD_L1\` WHERE batch LIKE ? AND DATE(FROM_UNIXTIME(\`timestamp\`)) = ?`, [searchLike, searchDate]),
                dbTest.promise().query(`SELECT MIN(\`timestamp\`) AS minT, MAX(\`timestamp\`) AS maxT FROM \`test\`.\`NodeRed_EPH_L1\` WHERE batchid LIKE ? AND DATE(FROM_UNIXTIME(\`timestamp\`)) = ?`, [searchLike, searchDate])
            ]);

            let minArr = [pma[0]?.minT, fbd[0]?.minT, eph[0]?.minT].filter(val => val != null);
            let maxArr = [pma[0]?.maxT, fbd[0]?.maxT, eph[0]?.maxT].filter(val => val != null);

            if (minArr.length > 0) batchStart = Math.min(...minArr);
            if (maxArr.length > 0) batchEnd = Math.max(...maxArr);

        } else if (line === 'Line 3') {
            const [ [pma3], [fbd3], [eph3] ] = await Promise.all([
                dbTest.promise().query(`SELECT MIN(\`timestamp\`) AS minT, MAX(\`timestamp\`) AS maxT FROM \`test\`.\`NodeRed_PMA_L3\` WHERE batchid LIKE ? AND DATE(FROM_UNIXTIME(\`timestamp\`)) = ?`, [searchLike, searchDate]),
                dbTest.promise().query(`SELECT MIN(\`timestamp\`) AS minT, MAX(\`timestamp\`) AS maxT FROM \`test\`.\`NodeRed_FBD_L3\` WHERE batch LIKE ? AND DATE(FROM_UNIXTIME(\`timestamp\`)) = ?`, [searchLike, searchDate]),
                dbTest.promise().query(`SELECT MIN(\`timestamp\`) AS minT, MAX(\`timestamp\`) AS maxT FROM \`test\`.\`NodeRed_EPH_L3\` WHERE batch_id LIKE ? AND DATE(FROM_UNIXTIME(\`timestamp\`)) = ?`, [searchLike, searchDate])
            ]);

            let minArr = [pma3[0]?.minT, fbd3[0]?.minT, eph3[0]?.minT].filter(val => val != null);
            let maxArr = [pma3[0]?.maxT, fbd3[0]?.maxT, eph3[0]?.maxT].filter(val => val != null);

            if (minArr.length > 0) batchStart = Math.min(...minArr);
            if (maxArr.length > 0) batchEnd = Math.max(...maxArr);
        }

        if (!batchStart || !batchEnd) return res.status(404).send({ error: "Batch not found" });

        // ==========================================
        // STEP 1.5: CALCULATE BATCH TIMES
        // ==========================================
        const formatTime = (ts) => {
            const date = new Date(ts * 1000);
            return date.toLocaleTimeString('en-GB', { hour12: false });
        };

        const startTimeFormatted = formatTime(batchStart);
        const endTimeFormatted = formatTime(batchEnd);

        const durationSeconds = batchEnd - batchStart;
        const hours = Math.floor(durationSeconds / 3600);
        const minutes = Math.floor((durationSeconds % 3600) / 60);
        const seconds = durationSeconds % 60;
        
        const totalDurationFormatted = `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;

        // ==========================================
        // STEP 2: FETCH ALL DATA USING HELPERS
        // ==========================================
        const [
            monitoringData,
            pmaData,
            fbdData,
            ephData,
            mixerData,
            binderData,
            recipeData,
            fbdRecipeData,
            ephRecipeData,
            pmaRecipeData // <-- NEW: Added to destructuring array
        ] = await Promise.all([
            getMonitoringData(monitorTable, batchStart, batchEnd),
            getPmaPhasesData(line, batch),
            getFBDPhaseData(line, batch, dayStart, dayEnd),
            getEPHPhaseData(line, batch, dayStart, dayEnd),
            getMixerData(batchStart, batchEnd),
            getBinderData(batchStart, batchEnd),
            getRecipeData(line, batch, batchStart, batchEnd),
            getFBDRecipeData(line, batch, batchStart, batchEnd), // <-- NEW: Added to parallel execution
            getEPHRecipeData(line, batch, batchStart, batchEnd), // <-- NEW: Added to parallel execution
            getPMARecipeData(line, batch, batchStart, batchEnd)  // <-- NEW: Added to parallel execution
        ]);

        // ==========================================
        // STEP 3: ASSEMBLE FINAL PAYLOAD
        // ==========================================
        const combinedData = { 
            batch_start_time: startTimeFormatted,
            batch_end_time: endTimeFormatted,
            batch_total_duration: totalDurationFormatted,
            
            ...monitoringData,
            ...pmaData,
            ...fbdData,
            ...ephData,
            ...mixerData,
            ...binderData,
            ...recipeData,
            ...fbdRecipeData, // <-- NEW: Spread into the master JSON payload
            ...ephRecipeData,  // <-- NEW: Spread into the master JSON payload
            ...pmaRecipeData,   // <-- NEW: Spread into the master JSON payload

        };

        res.status(200).send(combinedData);
        // --- NEW LOG: Check the final assembled package ---
        console.log(`\n=== 🚀 FINAL PAYLOAD LEAVING SERVER ===`);
        console.log("Input 1 Min is:", combinedData.input1_impeller_min1);
        console.log(`========================================\n`);

    } catch (error) {
        console.error("Database error in GetSuhuMonitoringData:", error);
        res.status(500).send({ error: error.message });
    }
},

    generateBatchPDF: async (req, res) => {
        try {
            // 1. Get the data sent from your React frontend
            const reportData = req.body; 

            // 2. Load your clean Word template
            const templatePath = path.resolve(__dirname, "../controllers/FormTemplate.docx");
            const content = fs.readFileSync(templatePath, "binary");

            const zip = new PizZip(content);
            const doc = new Docxtemplater(zip, { 
                paragraphLoop: true, 
                linebreaks: true 
            });

            const mapSet = (prefix) => {
                const imp = reportData[`${prefix}_recipe_impeller`] ?? '-';
                const chop = reportData[`${prefix}_recipe_chopper`] ?? '-';
                const time = reportData[`${prefix}_recipe_time`] ?? '-';
                const pump = reportData[`${prefix}_recipe_pump`] ?? '-';

                reportData[`${prefix}_impeller_set1`] = imp; reportData[`${prefix}_impeller_set2`] = imp;
                reportData[`${prefix}_chopper_set1`] = chop; reportData[`${prefix}_chopper_set2`] = chop;
                reportData[`${prefix}_waktu_set1`] = time;   reportData[`${prefix}_waktu_set2`] = time;
                reportData[`${prefix}_pump_set1`] = pump;    reportData[`${prefix}_pump_set2`] = pump;
            };

            // Map all Mixing and Discharge phases
            ['mix1', 'mix2', 'mix3', 'mix4'].forEach(mapSet);
            for (let i = 1; i <= 12; i++) mapSet(`discharge${i}`);

            // Map Input Materials
            const loadSpeed = reportData['pma_recipe_loading_speed'] ?? '-';
            const filterInterval = reportData['pma_recipe_filter_interval'] ?? '-';
            ['input1', 'input2'].forEach(prefix => {
                reportData[`${prefix}_impeller_set1`] = loadSpeed; 
                reportData[`${prefix}_impeller_set2`] = loadSpeed;
                reportData[`${prefix}_filter_clear_set1`] = filterInterval; 
                reportData[`${prefix}_filter_clear_set2`] = filterInterval;
            });

            // Map Binder Speed
            const binderSpeed = reportData['pma_recipe_pump_speed1'] ?? '-';
            reportData['binder_speed_set1'] = binderSpeed; 
            reportData['binder_speed_set2'] = binderSpeed;
            // ---------------------------
            for (let i = 1; i <= 12; i++) {
                const ephValveSet = reportData[`discharge_${i}_recipe_valve`];
                const ephSpeedSet = reportData[`discharge_${i}_recipe_speed`];

                reportData[`finalmix_discharge${i}_set1`] = ephValveSet;
                reportData[`finalmix_discharge${i}_set2`] = ephValveSet;
                
                reportData[`finalmix_speed${i}_set1`] = ephSpeedSet;
                reportData[`finalmix_speed${i}_set2`] = ephSpeedSet;
            }

            // --- 🧹 GLOBAL PDF CLEANUP ---
            // Intercepts any literal "undefined" or null values and forces them to a clean dash '-'
            // This instantly fixes the "undefined" bug in the MIXING table and SET VALUE columns
            Object.keys(reportData).forEach(key => {
                if (reportData[key] === 'undefined' || reportData[key] === undefined || reportData[key] === null) {
                    reportData[key] = '-';
                }
            });

            doc.render(reportData);

            // 3. Inject the data into the template

            // 4. Generate the DOCX buffer
            const docxBuf = doc.getZip().generate({ type: "nodebuffer" });

            // 5. Convert to PDF using LibreOffice-convert
            console.log(`Generating PDF for Batch: ${reportData.nomor_batch}`);
            libre.convert(docxBuf, '.pdf', undefined, (err, pdfBuf) => {
                if (err) {
                    return res.status(500).send({ error: "PDF Conversion failed" });
                }

                // 6. Send the PDF back to the browser
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=Batch_Report_${reportData.nomor_batch}.pdf`);
                res.send(pdfBuf);
            });

        } catch (error) {
            console.error("Export error:", error);
            res.status(500).send({ error: error.message });
        }
    },
    getAvailableBatches: async (req, res) => {
    try {
        const { selectedDate, line } = req.body;
        if (!selectedDate || !line) return res.status(400).send("Date and Line are required");

        let combinedResults = [];

        // --- SAFE QUERY HELPER ---
        // This prevents one bad table from crashing the whole dropdown
        const safeQuery = async (db, sql, params, name) => {
            try {
                const [rows] = await db.promise().query(sql, params);
                return rows;
            } catch (err) {
                console.warn(`[WARNING] Failed to fetch batches for ${name}: ${err.message}`);
                return []; // Return empty array so the others can still load
            }
        };

        // ==========================================
        // FORK THE LOGIC BASED ON THE LINE SELECTED
        // ==========================================
        if (line === 'Line 1') {
            
            // Fetch from all 3 independently
            const pma = await safeQuery(dbTest, `SELECT batchid AS BATCH FROM \`test\`.\`NodeRed_PMA_L1\` WHERE DATE(FROM_UNIXTIME(\`timestamp\`)) = ? GROUP BY batchid`, [selectedDate], "PMA_L1");
            const fbd = await safeQuery(dbTest, `SELECT batch AS BATCH FROM \`test\`.\`NodeRed_FBD_L1\` WHERE DATE(FROM_UNIXTIME(\`timestamp\`)) = ? GROUP BY batch`, [selectedDate], "FBD_L1");
            const eph = await safeQuery(dbTest, `SELECT batchid AS BATCH FROM \`test\`.\`NodeRed_EPH_L1\` WHERE DATE(FROM_UNIXTIME(\`timestamp\`)) = ? GROUP BY batchid`, [selectedDate], "EPH_L1");

            // --- MAP BATCHES TO MACHINES ---
            const batchMap = new Map();

            // Helper to clean the batch ID and assign it to its machine
            const addToMap = (dataArray, machineName) => {
                dataArray.forEach(row => {
                    if (!row.BATCH) return;
                    
                    // Remove everything except letters, numbers, hyphens, and underscores
                    const cleanName = row.BATCH.replace(/[^a-zA-Z0-9-_]/g, '');
                    if (!cleanName) return;

                    // If batch doesn't exist in our map yet, create it
                    if (!batchMap.has(cleanName)) {
                        batchMap.set(cleanName, { name: cleanName, machines: [] });
                    }
                    
                    // Add the machine tag to this batch
                    batchMap.get(cleanName).machines.push(machineName);
                });
            };

            addToMap(pma, 'PMA');
            addToMap(fbd, 'FBD');
            addToMap(eph, 'EPH');

            // --- FORMAT FOR FRONTEND ---
            uniqueBatches = Array.from(batchMap.values()).map(data => {
                // If it has all 3, just show the clean name. 
                // If not, append the machines it was found on.
                let displayName = data.machines.length === 3 
                    ? data.name 
                    : `${data.name} (${data.machines.join(', ')})`;

                return { 
                    BATCH: data.name,      // The raw ID needed for your database queries
                    DISPLAY: displayName   // The human-readable text for the UI dropdown
                };
            });

        } else if (line === 'Line 3') {
            // Line 3 logic remains mostly the same, but adapted to the new { BATCH, DISPLAY } format
            const pma3 = await safeQuery(dbTest, `SELECT batchid AS BATCH FROM \`test\`.\`NodeRed_PMA_L3\` WHERE DATE(FROM_UNIXTIME(\`timestamp\`)) = ? GROUP BY batchid`, [selectedDate], "PMA_L3");
            
            const cleanedPma3 = pma3.map(row => {
                if (!row.BATCH) return null;
                return row.BATCH.replace(/[^a-zA-Z0-9-_]/g, '');
            }).filter(b => b);

            uniqueBatches = [...new Set(cleanedPma3)].map(batch => ({ 
                BATCH: batch, 
                DISPLAY: batch // Only one machine queried here so far, so they are identical
            }));

        } else {
            return res.status(400).send({ error: "Invalid Line selected" });
        }

        return res.status(200).send(uniqueBatches);

    } catch (error) {
        console.error("Critical Batch fetch error:", error);
        return res.status(500).send({ error: "Server processing failed" });
    }
},

 getLoadingData: async (fbdTable, fbdBatchSearch, batchStart, batchEnd) => {
        const fbdSql = `
            SELECT 
                MIN(data_format_1) AS loading_temp_min1,
                MAX(data_format_1) AS loading_temp_max1,
                AVG(data_format_1) AS loading_temp_avg1,
                MIN(data_format_2) AS loading_flow_min1,
                MAX(data_format_2) AS loading_flow_max1,
                AVG(data_format_2) AS loading_flow_avg1,
                MIN(data_format_3) AS loading_time_min1,
                MAX(data_format_3) AS loading_time_max1,
                AVG(data_format_3) AS loading_time_avg1,
                MIN(data_format_4) AS loading_valve_min1,
                MAX(data_format_4) AS loading_valve_max1,
                AVG(data_format_4) AS loading_valve_avg1,
                MIN(data_format_5) AS loading_filter_min1,
                MAX(data_format_5) AS loading_filter_max1,
                AVG(data_format_5) AS loading_filter_avg1,
                MIN(data_format_6) AS loading_filtershake_min1,
                MAX(data_format_6) AS loading_filtershake_max1,
                AVG(data_format_6) AS loading_filtershake_avg1
            FROM \`ems_saka\`.\`${fbdTable}\`
            WHERE CONVERT(data_format_0 USING utf8) LIKE ?
            AND \`time@timestamp\` BETWEEN ? AND ?
        `;

        // --- NEW SAFETY NET ---
        try {
            const [rows] = await db4.promise().query(fbdSql, [`%${fbdBatchSearch}%`, batchStart, batchEnd]);
            return rows[0] || {};
        } catch (error) {
            console.warn(`⚠️ Warning: FBD Table '${fbdTable}' missing or offline. Skipping FBD data.`);
            return {}; // Return an empty object so the PDF just shows dashes, instead of crashing the server
        }
    },

    getBatchMonitoring: async (req, res) => {
        try {
            const { selectedDate, line, batch } = req.body;

            // ... (keep your date/timestamp logic here) ...

            let pmaTable = line === 'Line 1' ? 'cMT-FHDGEA1_EBR_PMA_new_data' : 'cMT-GEA-L3_EBR_PMA_new_data';
            let fbdTable = line === 'Line 1' ? 'cMT-FHDGEA1_EBR_FBD_new_data' : 'cMT-GEA-L3_EBR_FBD_new_data';
            let monitorTable = line === 'Line 1' ? 'cMT-FHDGEA1_your_suhu_table' : 'cMT-DB-EMS-UTY2_R_X06_New_data';

            // ==========================================
            // STEP 1: FIND THE TIME WINDOW
            // ==========================================
            const boundsSql = `... (keep your bounds query here) ...`;
            const [boundsResult] = await db4.promise().query(boundsSql, [dayStart, dayEnd, `%${batch}%`]);
            
            const batchStart = boundsResult[0].batch_start;
            const batchEnd = boundsResult[0].batch_end;

            // Prepare the 12-character FBD string
            const fbdBatchSearch = batch.substring(0, 12);

            // ==========================================
            // STEP 2: ORCHESTRATE THE MINION CONTROLLERS
            // ==========================================
            const monitoringSql = `... (keep your Suhu query string here) ...`;
            const binderSql = `... (keep your Binder query string here) ...`;

            // Run everything simultaneously
            const [
                [monitoringRows], 
                [binderRows], 
                fbdData // Notice we are calling our new separate controller function!
            ] = await Promise.all([
                db4.promise().query(monitoringSql, [batchStart, batchEnd]),
                db4.promise().query(binderSql, [batchStart, batchEnd]),
                getLoadingData(fbdTable, fbdBatchSearch, batchStart, batchEnd) 
            ]);

            // STEP 3: Combine and send back to React
            const combinedData = {
                ...monitoringRows[0],
                ...binderRows[0],
                ...fbdData
            };

            res.status(200).send(combinedData);

        } catch (error) {
            console.error("Database error in getBatchMonitoring:", error);
            res.status(500).send({ error: error.message });
        }
    },

    getToday20SecAverages: async (req, res) => {
        try {
            const sql = `
                SELECT 
                    FROM_UNIXTIME(UNIX_TIMESTAMP(\`timestamp\`) DIV 20 * 20) AS bucket_time,
                    ROUND(AVG(velocity_mms), 4) AS avg_velocity,
                    ROUND(AVG(acceleration_g), 4) AS avg_acceleration
                FROM monitoring_k6cm
                WHERE DATE(\`timestamp\`) = CURDATE()
                GROUP BY bucket_time
                ORDER BY bucket_time ASC
            `;
            const [rows] = await db4.promise().query(sql);
            res.status(200).send(rows);
        } catch (error) {
            res.status(500).send({ error: error.message });
        }
    },

    getShiftAverages: async (req, res) => {
        try {
            const sql = `
                SELECT 
                    DATE(DATE_SUB(\`timestamp\`, INTERVAL 390 MINUTE)) AS production_date,
                    CASE 
                        WHEN TIME(\`timestamp\`) >= '06:30:00' AND TIME(\`timestamp\`) < '15:00:00' THEN 1
                        WHEN TIME(\`timestamp\`) >= '15:00:00' AND TIME(\`timestamp\`) < '22:45:00' THEN 2
                        ELSE 3
                    END AS shift_number,
                    ROUND(AVG(velocity_mms), 4) AS avg_velocity,
                    ROUND(AVG(acceleration_g), 4) AS avg_acceleration
                FROM monitoring_k6cm
                WHERE DATE(DATE_SUB(\`timestamp\`, INTERVAL 390 MINUTE)) >= DATE_SUB(CURDATE(), INTERVAL 3 DAY)
                GROUP BY production_date, shift_number
                ORDER BY production_date ASC, shift_number ASC
            `;
            const [rows] = await db4.promise().query(sql);
            res.status(200).send(rows);
        } catch (error) {
            res.status(500).send({ error: error.message });
        }
    },

    getDailyAverages: async (req, res) => {
        try {
            const sql = `
                SELECT 
                    DATE(DATE_SUB(\`timestamp\`, INTERVAL 390 MINUTE)) AS production_date,
                    ROUND(AVG(velocity_mms), 4) AS avg_velocity,
                    ROUND(AVG(acceleration_g), 4) AS avg_acceleration
                FROM monitoring_k6cm
                WHERE DATE(DATE_SUB(\`timestamp\`, INTERVAL 390 MINUTE)) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                GROUP BY production_date
                ORDER BY production_date ASC
            `;
            const [rows] = await db4.promise().query(sql);
            res.status(200).send(rows);
        } catch (error) {
            res.status(500).send({ error: error.message });
        }
    },

    uploadWorkOrders: async (req, res) => {
        try {
            // The JSON array from your Python script should be sent in the request body
            const workOrders = req.body;

            // Basic validation to ensure we actually received an array
            if (!Array.isArray(workOrders) || workOrders.length === 0) {
                return res.status(400).send({ message: "Invalid or empty JSON data provided." });
            }

            const sql = `
                INSERT INTO pmp_main_work_orders 
                (pwo_number, asset_number, schedule_date, description, area, operations, source_file, page_number)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                asset_number = VALUES(asset_number),
                schedule_date = VALUES(schedule_date),
                operations = VALUES(operations),
                description = VALUES(description)
            `;

            let successCount = 0;

            // Loop through the array and insert each Work Order
            for (const wo of workOrders) {
                // Stringify the operations array for the MariaDB JSON column
                const opsJsonString = JSON.stringify(wo.Operations);

                const values = [
                    wo.PWO_Number,
                    wo.Asset_Number,
                    wo.Schedule_Date,
                    wo.Description,
                    wo.Area,
                    opsJsonString,
                    wo.Source_File,
                    wo.Page
                ];

                await db4.promise().query(sql, values);
                successCount++;
            }

            // Send a success response matching your standard format
            res.status(200).send({ 
                message: "Work orders successfully imported", 
                recordsProcessed: successCount 
            });

        } catch (error) {
            // Catch any database errors and return a 500 status
            res.status(500).send({ error: error.message });
        }
    },

    // 1. Get all Open Work Orders for the Dashboard
  // 1. Get all Work Orders for the Dashboard
    getWorkOrders: async (req, res) => {
        try {
            const sql = `
                SELECT 
                    pwo_number, 
                    asset_number, 
                    DATE_FORMAT(schedule_date, '%Y-%m-%d') AS schedule_date,
                    description, 
                    area, 
                    status,
                    isClosed,
                    operations 
                FROM pmp_main_work_orders
                ORDER BY schedule_date ASC
            `;
            const [rows] = await db4.promise().query(sql);
            
            // Send the raw data straight to React!
            res.status(200).send(rows);
        } catch (error) {
            console.error("Error fetching work orders:", error);
            res.status(500).send({ error: error.message });
        }
    },

    // 2. Get a Specific PWO (For the Technician Form)
    getWorkOrderById: async (req, res) => {
        try {
            const { pwo_number } = req.params;
            const sql = `
                SELECT 
                    pwo_number,
                    asset_number,
                    description,
                    operations,
                    status
                FROM pmp_main_work_orders
                WHERE pwo_number = ?
            `;
            const [rows] = await db4.promise().query(sql, [pwo_number]);
            
            if (rows.length === 0) {
                return res.status(404).send({ message: 'Work Order not found' });
            }

            // MariaDB usually returns the JSON column as a string. 
            // We parse it here so the React frontend gets a clean JavaScript array.
            let pwoData = rows[0];
            if (typeof pwoData.operations === 'string') {
                pwoData.operations = JSON.parse(pwoData.operations);
            }

            res.status(200).send(pwoData);
        } catch (error) {
            console.error("Error fetching PWO by ID:", error);
            res.status(500).send({ error: error.message });
        }
    },

    // 3. Save the Technician's Notes
    updateWorkOrder: async (req, res) => {
        try {
            const { pwo_number } = req.params;
            const { operations, technician_summary, status } = req.body; 

            const sql = `
                UPDATE pmp_main_work_orders 
                SET 
                    operations = ?, 
                    status = ?
                WHERE pwo_number = ?
            `;
            
            // CRITICAL: We MUST stringify the array before sending it to MariaDB's JSON column
            const opsJsonString = JSON.stringify(operations);

            const [result] = await db4.promise().query(sql, [
                opsJsonString, 
                status || 'Completed', 
                pwo_number
            ]);

            if (result.affectedRows === 0) {
                return res.status(404).send({ message: "Work order not found or no changes made." });
            }

            res.status(200).send({ message: 'Work order updated successfully' });
        } catch (error) {
            console.error("Error updating work order:", error);
            res.status(500).send({ error: error.message });
        }
    },
    closeWorkOrder: async (req, res) => {
        try {
            const { pwo_number } = req.params;
            const sql = `UPDATE pmp_main_work_orders SET isClosed = 1 WHERE pwo_number = ?`;
            
            await db4.promise().query(sql, [pwo_number]);
            
            res.status(200).send({ message: "Work order closed successfully" });
        } catch (error) {
            console.error("Error closing work order:", error);
            res.status(500).send({ error: error.message });
        }
    },
    
    getInventoryParts: async (req, res) => {
        try {
            const sql = `
                SELECT 
                    Part_Number, 
                    Part_Description, 
                    Part_Location, 
                    Type, 
                    Description, 
                    Availability, 
                    Reorder_Min,
                    DATE_FORMAT(Last_Date, '%Y-%m-%d %H:%i:%s') AS Last_Date
                FROM sparepart_engineering
                ORDER BY Part_Number ASC
            `;
            const [rows] = await db4.promise().query(sql);
            
            // Send the raw data straight to React!
            res.status(200).send(rows);
        } catch (error) {
            console.error("Error fetching inventory parts:", error);
            res.status(500).send({ error: error.message });
        }
    },

    createSparepartLog: async (req, res) => {
        // 1. Grab a dedicated connection from db4 for the transaction
        const connection = await db4.promise().getConnection();

        try {
            // Extract the data sent from the React frontend
            const { Employee_Name, Division, Work_Order_Number, Description, Items_Taken } = req.body;

            // 2. Start the transaction! Everything after this is grouped together.
            await connection.beginTransaction();

            // 3. Insert the record into the Log Table
            // Express usually receives JSON as a Javascript Array. 
            // We must convert it back to a raw JSON string to save it in your LONGTEXT column.
            const itemsStringified = JSON.stringify(Items_Taken);
            
              const insertLogSql = `
                  INSERT INTO Sparepart_Logs (Employee_Name, Division, Work_Order_Number, Description, Items_Taken)
                  VALUES (?, ?, ?, ?, ?)
              `;
            await connection.query(insertLogSql, [Employee_Name, Division, Work_Order_Number, Description, itemsStringified]);

            // 4. Loop through the array of items and deduct the quantities
            // We expect Items_Taken to look like: [{ part_number: 'SPM...', qty: 2 }, ...]
            for (const item of Items_Taken) {
                const updateInventorySql = `
                    UPDATE sparepart_engineering 
                    SET Availability = Availability - ? 
                    WHERE Part_Number = ?
                `;
                
                // Execute the update for this specific part
                await connection.query(updateInventorySql, [item.qty, item.part_number]);
            }

            // 5. If we made it here without any errors, COMMIT the changes permanently!
            await connection.commit();
            res.status(201).send({ message: "Log created and inventory successfully updated." });

        } catch (error) {
            // 6. DISASTER RECOVERY: If anything failed (e.g., a typo in a part number), 
            // ROLLBACK undoes the log insert and any partial inventory updates.
            await connection.rollback();
            console.error("Transaction Error - Rollback triggered:", error);
            res.status(500).send({ error: "Failed to process transaction. No changes were made." });
            
        } finally {
            // 7. Always release the connection back to db4's pool so your server doesn't crash
            connection.release();
        }
    },

    getSparepartLogs: async (req, res) => {
        try {
            // 1. Fetch the data, format the date, and sort newest first
            const sql = `
                SELECT 
                    Log_ID, 
                    Employee_Name, 
                    Division,
                    DATE_FORMAT(Log_Date, '%Y-%m-%d %H:%i:%s') AS Log_Date, 
                    Work_Order_Number,
                    Description,
                    Items_Taken
                FROM Sparepart_Logs
                ORDER BY Log_Date DESC
            `;
            const [rows] = await db4.promise().query(sql);

            // 2. Parse the LONGTEXT strings back into real JSON arrays
            // If we don't do this, React will just see a massive, unreadable string.
            const formattedRows = rows.map(row => {
                let parsedItems = [];
                try {
                    parsedItems = JSON.parse(row.Items_Taken);
                } catch (parseError) {
                    console.warn(`Could not parse JSON for Log_ID ${row.Log_ID}`);
                }

                return {
                    ...row,
                    Items_Taken: parsedItems
                };
            });

            // 3. Send the clean data to the frontend
            res.status(200).send(formattedRows);

        } catch (error) {
            console.error("Error fetching sparepart logs:", error);
            res.status(500).send({ error: error.message });
        }
    },

    updateSparepartLog: async (req, res) => {
        try {
            const { id } = req.params; // Grabs the Log_ID from the URL
            const { Employee_Name, Division, Work_Order_Number, Description } = req.body;

            const sql = `
                UPDATE Sparepart_Logs 
                SET Employee_Name = ?, Division = ?, Work_Order_Number = ?, Description = ?
                WHERE Log_ID = ?
            `;
            
            await db4.promise().query(sql, [Employee_Name, Division, Work_Order_Number, Description, id]);

            res.status(200).send({ message: "Audit log updated successfully." });

        } catch (error) {
            console.error("Error updating sparepart log:", error);
            res.status(500).send({ error: "Failed to update log." });
        }
    },

    updateInventoryBatch: async (req, res) => {
        try {
            const { updates } = req.body; 

            if (!updates || !Array.isArray(updates) || updates.length === 0) {
                return res.status(400).send({ error: "Invalid or empty data payload." });
            }

            // Map the data (Remember, some of these will now be explicitly 'null')
            const valuesArray = updates.map(part => [
                part.partNumber, 
                part.description, 
                part.availability, 
                part.reorderMin, 
                part.reorderMax,
                new Date() 
            ]);

            // The PROTECTED Bulk Upsert Query
            // COALESCE(VALUES(Column), Column) protects existing data from being overwritten by missing CSV columns.
            const upsertSql = `
                INSERT INTO sparepart_engineering 
                (Part_Number, Part_Description, Availability, Reorder_Min, Reorder_Max, Last_Date) 
                VALUES ? 
                ON DUPLICATE KEY UPDATE 
                Part_Description = COALESCE(VALUES(Part_Description), Part_Description),
                Availability = COALESCE(VALUES(Availability), Availability),
                Reorder_Min = COALESCE(VALUES(Reorder_Min), Reorder_Min),
                Reorder_Max = COALESCE(VALUES(Reorder_Max), Reorder_Max),
                Last_Date = VALUES(Last_Date)
            `;

            await db4.promise().query(upsertSql, [valuesArray]);

            res.status(200).send({ message: "Bulk inventory synced successfully." });

        } catch (error) {
            console.error("Bulk sync failed:", error);
            res.status(500).send({ 
                error: "Failed to sync database records.", 
                details: error.message 
            });
        }
    },

    InventoryupdatePart: async (req, res) => {
        const { partNumber } = req.params;
        const { Location, Availability } = req.body;

        // Basic validation
        if (!partNumber) {
            return res.status(400).json({ error: "Part Number is required" });
        }

        try {
            // The SQL Update Query
            // We use NOW() to automatically stamp the exact time of the edit
            const updateSql = `
                UPDATE sparepart_engineering 
                SET Part_Location = ?, Availability = ?, Last_Date = NOW() 
                WHERE Part_Number = ?
            `;

            // Execute the query using db4 (matching your bulk update setup)
            const [result] = await db4.promise().query(updateSql, [Location, Availability, partNumber]);

            // Check if the part actually existed
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Part not found in the database." });
            }

            res.status(200).json({ message: "Inventory part updated successfully!" });

        } catch (error) {
            console.error("Error updating inventory part:", error);
            res.status(500).json({ 
                error: "Failed to update database record.", 
                details: error.message 
            });
        }
    },

    getGranulationData: async (req, res) => {
    try {
        const { line, machine, startDate, endDate, page, limit } = req.query;
        if (!line || !machine || !startDate || !endDate) {
            return res.status(400).json({ error: "Filter belum lengkap" });
        }

        const tableMapping = { 
            'Line 1': { 'PMA': 'NodeRed_PMA_L1', 'Wetmill': 'NodeRed_Wetmill_L1', 'FBD': 'NodeRed_FBD_L1', 'EPH': 'NodeRed_EPH_L1' },
            'Line 3': { 'PMA': 'NodeRed_PMA_L3', 'Wetmill': 'NodeRed_WETMILL_L3', 'FBD': 'NodeRed_FBD_L3_2', 'EPH': 'NodeRed_EPH_L3', 'PMA kW Meter': 'cMT-GEA-L3_PMA_KWmeter_data' }
        };
        
        const tableName = tableMapping[line]?.[machine];
        if (!tableName) return res.status(400).send({ error: "Tabel tidak ditemukan" });

        const startUnix = new Date(startDate).getTime() / 1000;
        const endUnix = new Date(endDate).getTime() / 1000;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // --- PILIH KONEKSI DB ---
        // Jika kW Meter pakai db3, selain itu pakai dbTest
        const activeDB = (machine === 'PMA kW Meter') ? db3 : dbTest;

        let sqlData, sqlCount, timeCol;

        if (machine === 'PMA kW Meter') {
            timeCol = `\`time@timestamp\``;
            
            // Query hitung total rows
            sqlCount = `SELECT COUNT(*) as total FROM \`${tableName}\` WHERE ${timeCol} BETWEEN ? AND ?`;

            // Query ambil data dengan pembatasan 14 karakter
            sqlData = `
                SELECT 
                    DATE_FORMAT(FROM_UNIXTIME(${timeCol}), '%d/%m/%Y %H:%i') as wib_time,
                    -- Kita bersihkan karakter '&' dan spasi/karakter null di ujung string
                    REPLACE(REPLACE(REPLACE(CAST(data_format_0 AS CHAR), '&', ''), '\\0', ''), ' ', '') as Batch_ID,
                    TRIM(BOTH '\\0' FROM REPLACE(CAST(data_format_1 AS CHAR), '&', '')) as Process_ID,
                    data_format_2 as Chopper_RPM,
                    data_format_3 as Chopper_Current,
                    data_format_4 as Impeller_RPM,
                    data_format_5 as Impeller_Current,
                    data_format_6 as Impeller_Kw
                FROM \`${tableName}\`
                WHERE ${timeCol} BETWEEN ? AND ?
                ORDER BY ${timeCol} ASC
                LIMIT ? OFFSET ?`;
        } else {
            timeCol = `\`timestamp\``;
            sqlCount = `SELECT COUNT(*) as total FROM \`${tableName}\` WHERE ${timeCol} BETWEEN ? AND ?`;
            sqlData = `
                SELECT 
                    DATE_FORMAT(FROM_UNIXTIME(${timeCol}), '%d/%m/%Y %H:%i') as wib_time,
                    t.* FROM \`${tableName}\` t
                WHERE t.${timeCol} BETWEEN ? AND ?
                ORDER BY t.${timeCol} ASC
                LIMIT ? OFFSET ?`;
        }

        const [countResult] = await activeDB.promise().query(sqlCount, [startUnix, endUnix]);
        const totalRows = countResult[0].total;

        const [rows] = await activeDB.promise().query(sqlData, [startUnix, endUnix, parseInt(limit), offset]);

        res.status(200).json({
            totalRows,
            totalPages: Math.ceil(totalRows / limit) || 0,
            currentPage: parseInt(page),
            data: rows
        });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
},

    getExportData: async (req, res) => {
        try {
            const { line, machine, startDate, endDate } = req.query;
            const tableMapping = { 
                'Line 1': { 'PMA': 'NodeRed_PMA_L1', 'Wetmill': 'NodeRed_Wetmill_L1', 'FBD': 'NodeRed_FBD_L1', 'EPH': 'NodeRed_EPH_L1' },
                'Line 3': { 'PMA': 'NodeRed_PMA_L3', 'Wetmill': 'NodeRed_WETMILL_L3', 'FBD': 'NodeRed_FBD_L3_2', 'EPH': 'NodeRed_EPH_L3', 'PMA kW Meter': 'cMT-GEA-L3_PMA_KWmeter_data' }
            };
            const tableName = tableMapping[line]?.[machine];
            if (!tableName) return res.status(400).send({ error: "Tabel tidak ditemukan" });

            const startUnix = new Date(startDate).getTime() / 1000;
            const endUnix = new Date(endDate).getTime() / 1000;

            // Pilih koneksi db3 atau dbTest
            const activeDB = (machine === 'PMA kW Meter') ? db3 : dbTest;

            let sqlExport;
            if (machine === 'PMA kW Meter') {
                sqlExport = `
                    SELECT 
                        DATE_FORMAT(FROM_UNIXTIME(\`time@timestamp\`), '%d/%m/%Y %H:%i:%s') as wib_time,
                        REPLACE(REPLACE(REPLACE(CAST(data_format_0 AS CHAR), '&', ''), '\\0', ''), ' ', '') as Batch_ID,
                        TRIM(BOTH '\\0' FROM REPLACE(CAST(data_format_1 AS CHAR), '&', '')) as Process_ID,
                        data_format_2 as Chopper_RPM,
                        data_format_3 as Chopper_Current,
                        data_format_4 as Impeller_RPM,
                        data_format_5 as Impeller_Current,
                        data_format_6 as Impeller_Kw
                    FROM \`${tableName}\`
                    WHERE \`time@timestamp\` BETWEEN ? AND ?
                    ORDER BY \`time@timestamp\` ASC`;
            
            } else {
                sqlExport = `
                    SELECT 
                        DATE_FORMAT(FROM_UNIXTIME(timestamp), '%d/%m/%Y %H:%i:%s') as wib_time,
                        t.* FROM \`${tableName}\` t
                    WHERE t.\`timestamp\` BETWEEN ? AND ?
                    ORDER BY t.\`timestamp\` ASC`;
            }

            const [rows] = await activeDB.promise().query(sqlExport, [startUnix, endUnix]);
            res.status(200).json(rows);
        } catch (error) {
            res.status(500).send({ error: error.message });
        }
    },

    getChartData: async (req, res) => {
    try {
        const { line, machine, startDate, endDate } = req.query;
        const tableName = tableMapping[line]?.[machine];
        const activeDB = (machine === 'PMA kW Meter') ? db3 : dbTest;
        const timeCol = (machine === 'PMA kW Meter') ? '`time@timestamp`' : '`timestamp`';

        // HITUNG INTERVAL BERDASARKAN RENTANG WAKTU
        const diffInHours = (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60);
        let interval;
        if (diffInHours <= 24) interval = 60; // 1 Menit
        else if (diffInHours <= 168) interval = 1800; // 30 Menit
        else interval = 3600; // 1 Jam

        let sqlChart;
        if (machine === 'PMA kW Meter') {
            sqlChart = `
                SELECT 
                    DATE_FORMAT(FROM_UNIXTIME(${timeCol}), '%d/%m %H:%i') as wib_time,
                    AVG(data_format_2) as Chopper_RPM,
                    AVG(data_format_4) as Impeller_RPM,
                    AVG(data_format_6) as Impeller_Kw
                FROM \`${tableName}\`
                WHERE ${timeCol} BETWEEN ? AND ?
                GROUP BY FLOOR(${timeCol} / ${interval})
                ORDER BY ${timeCol} ASC`;
        } else {
            // Untuk mesin standar (PMA L1, FBD, dll)
            // Sesuaikan nama kolom yang mau di-trend-kan
            sqlChart = `
                SELECT 
                    DATE_FORMAT(FROM_UNIXTIME(${timeCol}), '%d/%m %H:%i') as wib_time,
                    AVG(temp_inlet) as Temp_Inlet, 
                    AVG(temp_outlet) as Temp_Outlet
                FROM \`${tableName}\`
                WHERE ${timeCol} BETWEEN ? AND ?
                GROUP BY FLOOR(${timeCol} / ${interval})
                ORDER BY ${timeCol} ASC`;
        }

        const [rows] = await activeDB.promise().query(sqlChart, [startUnix, endUnix]);
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
},

// 1. READ ALL (Usually doesn't need to log who read it)
    SparepartgetAllParts: async (req, res) => {
        try {
            const [rows] = await db4.promise().query('SELECT * FROM sparepart_non_inventory_parts ORDER BY Part_Name ASC');
            res.status(200).json(rows);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // 2. CREATE NEW
    SparepartcreatePart: async (req, res) => {
        const { Part_Name, Quantity, Unit, Rack, Shelf_Location } = req.body;
        
        // Extract the user from the decoded JWT token! 
        // (Adjust .username or .name depending on what you packed into your JWT payload)
        const username = req.user?.username || req.user?.name || 'Authorized User'; 
        
        const conn = await db4.promise().getConnection();

        try {
            await conn.beginTransaction(); 

            // A. Insert the new part
            const insertSql = `INSERT INTO sparepart_non_inventory_parts (Part_Name, Quantity, Unit, Rack, Shelf_Location) VALUES (?, ?, ?, ?, ?)`;
            const [result] = await conn.query(insertSql, [Part_Name, Quantity, Unit, Rack, Shelf_Location]);
            
            // B. Write the log using the newly created ID
            const logSql = `INSERT INTO sparepart_non_inventory_history_logs (Part_ID, Part_Name, Old_Quantity, New_Quantity, Change_Type, Changed_By) VALUES (?, ?, NULL, ?, 'CREATE', ?)`;
            await conn.query(logSql, [result.insertId, Part_Name, Quantity, username]);

            await conn.commit(); 
            res.status(201).json({ message: "Part created successfully" });
        } catch (error) {
            await conn.rollback(); 
            res.status(500).json({ error: error.message });
        } finally {
            conn.release();
        }
    },

    // 3. UPDATE EXISTING
    SparepartupdatePart: async (req, res) => {
        const { id } = req.params;
        const { Part_Name, Quantity, Unit, Rack, Shelf_Location } = req.body;
        
        // Extract from token
        const username = req.user?.username || req.user?.name || 'Authorized User'; 
        
        const conn = await db4.promise().getConnection();

        try {
            await conn.beginTransaction();

            const [oldData] = await conn.query(`SELECT Quantity FROM sparepart_non_inventory_parts WHERE Part_ID = ?`, [id]);
            if (oldData.length === 0) throw new Error("Part not found");
            const oldQuantity = oldData[0].Quantity;

            const updateSql = `UPDATE sparepart_non_inventory_parts SET Part_Name = ?, Quantity = ?, Unit = ?, Rack = ?, Shelf_Location = ? WHERE Part_ID = ?`;
            await conn.query(updateSql, [Part_Name, Quantity, Unit, Rack, Shelf_Location, id]);

            if (oldQuantity !== parseInt(Quantity, 10)) {
                const logSql = `INSERT INTO sparepart_non_inventory_history_logs (Part_ID, Part_Name, Old_Quantity, New_Quantity, Change_Type, Changed_By) VALUES (?, ?, ?, ?, 'UPDATE', ?)`;
                await conn.query(logSql, [id, Part_Name, oldQuantity, Quantity, username]);
            }

            await conn.commit();
            res.status(200).json({ message: "Part updated successfully" });
        } catch (error) {
            await conn.rollback();
            res.status(500).json({ error: error.message });
        } finally {
            conn.release();
        }
    },

    // 4. DELETE
    SparepartdeletePart: async (req, res) => {
        const { id } = req.params;
        
        // Extract from token
        const username = req.user?.username || req.user?.name || 'Authorized User'; 
        
        const conn = await db4.promise().getConnection();

        try {
            await conn.beginTransaction();

            const [oldData] = await conn.query(`SELECT Part_Name, Quantity FROM sparepart_non_inventory_parts WHERE Part_ID = ?`, [id]);
            if (oldData.length === 0) throw new Error("Part not found");
            
            await conn.query(`DELETE FROM sparepart_non_inventory_parts WHERE Part_ID = ?`, [id]);

            const logSql = `INSERT INTO sparepart_non_inventory_history_logs (Part_ID, Part_Name, Old_Quantity, New_Quantity, Change_Type, Changed_By) VALUES (?, ?, ?, NULL, 'DELETE', ?)`;
            await conn.query(logSql, [id, oldData[0].Part_Name, oldData[0].Quantity, username]);

            await conn.commit();
            res.status(200).json({ message: "Part deleted successfully" });
        } catch (error) {
            await conn.rollback();
            res.status(500).json({ error: error.message });
        } finally {
            conn.release();
        }
    },

    SparepartgetInventoryLogs: async (req, res) => {
    try {
        // Query matching your exact table name from the DBeaver screenshot
        const sql = `
            SELECT 
                Log_ID, 
                Part_ID, 
                Part_Name, 
                Old_Quantity, 
                New_Quantity, 
                Change_Type, 
                Changed_By, 
                Changed_At 
            FROM sparepart_non_inventory_history_logs 
            ORDER BY Changed_At DESC 
            LIMIT 250
        `;
        
        const [rows] = await db4.promise().query(sql);
        res.status(200).json(rows);
    } catch (error) {
        console.error("Database error fetching inventory logs:", error);
        res.status(500).json({ error: error.message });
    }
},
    
    uploadAndExtractPDF: async (req, res) => {
        try {
            if (!req.files || Object.keys(req.files).length === 0) {
                return res.status(400).send({ error: "No file was uploaded." });
            }

            const fileKey = Object.keys(req.files)[0];
            const pdfFile = req.files[fileKey];
            const originalFileName = pdfFile.name;

            // 1. Save the file temporarily so Python can look at it
            const tempFilePath = path.join(__dirname, `../temp_${Date.now()}_${originalFileName}`);
            await pdfFile.mv(tempFilePath);

            // 2. Point to your python parser script
            const scriptPath = path.join(__dirname, '../parse_single.py');

            // 3. Run your working python script from Node
            execFile('python', [scriptPath, tempFilePath], async (error, stdout, stderr) => {
                // Delete the temporary file immediately to stay clean
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);

                if (error || stderr) {
                    console.error("Python exec fault:", error || stderr);
                    
                    // THE DIAGNOSTIC FIX: Send the actual error block back to React!
                    return res.status(500).send({ 
                        error: "Python engine failed.", 
                        details: stderr || error.message 
                    });
                }

                try {
                    // 1. Read the perfectly structured data array from Python
                    const parsedData = JSON.parse(stdout);
                    if (!parsedData || parsedData.length === 0) {
                        return res.status(422).send({ error: "No work orders could be extracted from this layout structure." });
                    }

                    console.log(`[DEBUG] Python extracted ${parsedData.length} work orders from file.`);
                    let processedCount = 0;

                    // 2. THE FIX: Loop through ALL extracted work orders instead of just taking parsedData[0]
                    for (const wo of parsedData) {
                        // THE FIX: Keep the full string (e.g., 'PWO-334234') without stripping it down to a negative number
                        const cleanPwoNum = String(wo.PWO_Number).trim(); 

                        if (!cleanPwoNum || cleanPwoNum === "Unknown") continue;

                        // 3. Database Upsert Strategy for each individual work order
                        const checkSql = `SELECT pwo_number FROM pmp_main_work_orders WHERE pwo_number = ?`;
                        const [existingRows] = await db4.promise().query(checkSql, [cleanPwoNum]);

                        if (existingRows.length > 0) {
                            // Update existing records
                            const updateSql = `
                                UPDATE pmp_main_work_orders 
                                SET asset_number = ?, schedule_date = ?, description = ?, area = ?, operations = ?, source_file = ?, page_number = ?
                                WHERE pwo_number = ?
                            `;
                            await db4.promise().query(updateSql, [
                                wo.Asset_Number, wo.Schedule_Date, wo.Description, wo.Area, 
                                JSON.stringify(wo.Operations), originalFileName, wo.Page, cleanPwoNum
                            ]);
                        } else {
                            // Insert brand new records
                            const insertSql = `
                                INSERT INTO pmp_main_work_orders 
                                (pwo_number, asset_number, schedule_date, description, area, operations, status, isClosed, source_file, page_number) 
                                VALUES (?, ?, ?, ?, ?, ?, 'Open', 0, ?, ?)
                            `;
                            await db4.promise().query(insertSql, [
                                cleanPwoNum, wo.Asset_Number, wo.Schedule_Date, wo.Description, wo.Area, 
                                JSON.stringify(wo.Operations), originalFileName, wo.Page 
                            ]);
                        }
                        processedCount++;
                    }

                    // Send back the total count of processed items to your React frontend
                    return res.status(200).send({
                        success: true,
                        message: `Successfully sync'd ${processedCount} work orders.`,
                        stepsExtracted: processedCount
                    });

                } catch (jsonErr) {
                    console.error("Failed to parse Python output stream:", jsonErr);
                    return res.status(500).send({ error: "Data pipeline alignment synchronization error." });
                }
            });

        } catch (err) {
            console.error("Upload handler crash:", err);
            res.status(500).send({ error: "Backend processing error: " + err.message });
        }
    },

    previewPDF: async (req, res) => {
        try {
            if (!req.files || Object.keys(req.files).length === 0) {
                return res.status(400).send({ error: "No file was uploaded." });
            }

            const fileKey = Object.keys(req.files)[0];
            const pdfFile = req.files[fileKey];
            const originalFileName = pdfFile.name;

            const tempFilePath = path.join(__dirname, `../temp_${Date.now()}_${originalFileName}`);
            await pdfFile.mv(tempFilePath);

            const scriptPath = path.resolve(__dirname, '..', 'parse_single.py');

            execFile('python3', [scriptPath, tempFilePath], (error, stdout, stderr) => {
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);

                if (error || stderr) {
                    console.error("Python engine error:", error || stderr);
                    return res.status(500).send({ error: "Python text extraction failed.", details: stderr });
                }

                try {
                    const parsedData = JSON.parse(stdout);
                    // Return data array straight back to user to verify layout visually
                    return res.status(200).send({
                        success: true,
                        sourceFile: originalFileName,
                        workOrders: parsedData
                    });
                } catch (jsonErr) {
                    return res.status(500).send({ error: "Failed to parse document format stream data." });
                }
            });
        } catch (err) {
            res.status(500).send({ error: "Backend staging failure: " + err.message });
        }
    },

    // --- 2. COMMIT ENDPOINT (SAVES EVERYTHING ONCE USER CONFIRMS) ---
    confirmSync: async (req, res) => {
    try {
        console.log("\n[DEBUG] confirm-sync received raw body:", req.body);

        let workOrders = req.body.workOrders || req.body.work_orders;
        let sourceFile = req.body.sourceFile || req.body.source_file;

        // --- THE ABSOLUTE BACKEND UN-NESTER FIX ---
        // If workOrders contains the nested server response: { success: true, workOrders: [...] }
        if (workOrders && !Array.isArray(workOrders) && workOrders.workOrders) {
            console.log("[DEBUG] Detected double-nested payload structure. Auto-flattening...");
            if (!sourceFile && workOrders.sourceFile) {
                sourceFile = workOrders.sourceFile;
            }
            workOrders = workOrders.workOrders; // Safely strip away the wrapper and grab the real array!
        }
        // ------------------------------------------

        // Final safety validation check
        if (!workOrders || !Array.isArray(workOrders)) {
            console.error("[DEBUG] Validation Hard-Failed: workOrders is missing or not an array!");
            return res.status(400).send({ 
                error: "Invalid data payload structure. 'workOrders' array field is required.",
                receivedKeys: Object.keys(req.body)
            });
        }

        console.log(`[DEBUG] Validation Passed. Processing ${workOrders.length} flat work orders...`);
        let syncCount = 0;

        for (const wo of workOrders) {
            const cleanPwoNum = String(wo.PWO_Number || wo.pwo_number).trim();
            if (!cleanPwoNum || cleanPwoNum === "Unknown") continue;

            const pageNumber = wo.Page || wo.page || null;

            // Database processing via db4
            const checkSql = `SELECT pwo_number FROM pmp_main_work_orders WHERE pwo_number = ?`;
            const [existingRows] = await db4.promise().query(checkSql, [cleanPwoNum]);

            if (existingRows.length > 0) {
                const updateSql = `
                    UPDATE pmp_main_work_orders 
                    SET asset_number = ?, schedule_date = ?, description = ?, area = ?, operations = ?, source_file = ?, page_number = ?
                    WHERE pwo_number = ?
                `;
                await db4.promise().query(updateSql, [
                    wo.Asset_Number || wo.asset_number, 
                    wo.Schedule_Date || wo.schedule_date, 
                    wo.Description || wo.description, 
                    wo.Area || wo.area, 
                    JSON.stringify(wo.Operations || wo.operations), 
                    sourceFile, 
                    pageNumber, 
                    cleanPwoNum
                ]);
            } else {
                const insertSql = `
                    INSERT INTO pmp_main_work_orders 
                    (pwo_number, asset_number, schedule_date, description, area, operations, status, isClosed, source_file, page_number) 
                    VALUES (?, ?, ?, ?, ?, ?, 'Open', 0, ?, ?)
                `;
                await db4.promise().query(insertSql, [
                    cleanPwoNum, 
                    wo.Asset_Number || wo.asset_number, 
                    wo.Schedule_Date || wo.schedule_date, 
                    wo.Description || wo.description, 
                    wo.Area || wo.area, 
                    JSON.stringify(wo.Operations || wo.operations), 
                    sourceFile, 
                    pageNumber
                ]);
            }
            syncCount++;
        }

        res.status(200).send({ success: true, message: `Successfully synced ${syncCount} Work Orders.` });
    } catch (err) {
        console.error("Database confirm execution failure:", err);
        res.status(500).send({ error: "Database commit processing crashed: " + err.message });
    }
},

VibrationData: (request, response) => {
        const { axis, start, finish } = request.query;
        const TARGET_POINTS = 1000; // Optimize Chart.js rendering to 1000 points max

        const config = SENSOR_MAPPING[axis];
        if (!config) {
            return response.status(400).send({ error: "Invalid axis or table mapping." });
        }

        // 2. Build the query exactly in your style
        // We calculate adjusted_unix so the downsampler has a clean numeric X-axis to work with
        const queryGet = `
            WITH OrderedData AS (
                SELECT 
                    (\`time@timestamp\` - 25200) AS adjusted_unix, 
                    DATE_FORMAT(DATE_SUB(FROM_UNIXTIME(\`time@timestamp\`), INTERVAL 7 HOUR), '%Y-%m-%d %H:%i:%s') AS label,
                    data_format_0,
                    data_format_1,
                    data_format_2,
                    data_format_3,
                    data_format_4,
                    data_format_5,
                    data_format_6,
                    data_format_7
                FROM ems_saka.\`${config.table}\`
            )
            SELECT * FROM OrderedData
            WHERE label BETWEEN '${start}' AND '${finish}'
            ORDER BY adjusted_unix ASC;
        `;

        db4.query(queryGet, (err, result) => {
            if (err) {
                console.error("VibrationData Query Error:", err);
                return response.status(500).send({ error: "Database query failed", details: err.sqlMessage });
            }

            if (result.length === 0) {
                return response.status(200).send({ data: {}, stats: {} });
            }

            // 3. Prepare structures for the payload
            const rawSeries = {};
            const finalPayload = {};
            const statsPayload = {};

            Object.values(config.columns).forEach(col => {
                rawSeries[col.key] = [];
            });

            // 4. Process scaling and separate columns into individual arrays
            // 4. Process scaling and separate columns into individual arrays
            for (let i = 0; i < result.length; i++) {
                const row = result[i];
                // LTTB requires X to be numeric, so we multiply the adjusted unix seconds by 1000 for standard JS milliseconds
                const xTime = row.adjusted_unix * 1000; 

                Object.keys(config.columns).forEach(dbCol => {
                    const mapInfo = config.columns[dbCol];
                    let rawValue = row[dbCol];

                    if (rawValue !== null && rawValue !== undefined) {
                        
                        // --- THE MATH FIX ---
                        if (mapInfo.key === 'crest_factor') {
                            // 1. Strip the negative sign to get the true physical peak
                            rawValue = Math.abs(rawValue);
                            
                            // 2. Fix the 1000x multiplier unit mismatch
                            // (Note: If you prefer, you can remove this /1000 here and just 
                            // change the 'scale' property to 1000 in your SENSOR_MAPPING object)
                        }
                        // --------------------

                        const scaledValue = rawValue / mapInfo.scale;
                        // Push as [x, y] format required by LTTB
                        rawSeries[mapInfo.key].push([xTime, scaledValue]);
                    }
                });
            }

            // 5. Calculate Stats and apply LTTB Downsampling
            Object.keys(rawSeries).forEach(key => {
                const seriesData = rawSeries[key];
                
                // Extract just the Y values to run perfect stats on the raw dataset
                const yValues = seriesData.map(point => point[1]);
                statsPayload[key] = calculateStats(yValues);

                // Apply LTTB downsampling
                let downsampled = seriesData;
                if (seriesData.length > TARGET_POINTS) {
                   downsampled = downsample.processData(seriesData, TARGET_POINTS);
                }

                // Format the output specifically for Chart.js {x, y} format
                finalPayload[key] = downsampled.map(point => ({
                    x: point[0],
                    y: point[1]
                }));
            });

            // 6. Return the standardized response
            return response.status(200).send({
                axis: axis,
                total_raw_rows: result.length,
                stats: statsPayload,
                data: finalPayload
            });
        });
    },





      

  

}