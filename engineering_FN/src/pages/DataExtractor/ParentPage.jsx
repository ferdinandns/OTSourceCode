import React, { useState, useEffect } from 'react';
import BatchReportPreview from './BatchReportPreview'; 

// Add this at the very top of ParentPage.jsx, under your imports
console.log("PARENT PAGE LOADED AT:", new Date().toLocaleTimeString());

const BatchPage = () => {
  // 1. User Input States
  const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [selectedLine, setSelectedLine] = useState('Line 1');
  
  // NEW: State to hold the list of batches and the currently selected one
  const [batchList, setBatchList] = useState([]); 
  const [selectedBatch, setSelectedBatch] = useState('');
  // --- LOT AWARENESS STATE ---
  const isLot1Only = selectedBatch && selectedBatch.endsWith('-1');
  const isLot2Only = selectedBatch && selectedBatch.endsWith('-2');

  // 2. Data & UI States
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  // 3. The Fetch Function
  const fetchBatchData = async () => {
    if (!selectedDate || !selectedLine || !selectedBatch) {
      setError("Please fill in Date, Line, and Batch Number.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:8002/part/GetSuhuMonitoringData', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          selectedDate, 
          line: selectedLine,
          batch: selectedBatch 
        }),
      });


      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Failed to fetch data from database.");
      }

      const responseJson = await response.json();
      // 🎯 THE FIX: Smartly extract the inner 'data' object if the wrapper exists!
      const dbData = responseJson.data ? responseJson.data : responseJson; 
      
      console.log("RAW DATA FROM BACKEND:", dbData);
      
      // Quick helper functions
      const formatNum = (val) => {
  if (val === null || val === undefined || val === '') return '-';
  
  const num = Number(val);
  return isNaN(num) ? '-' : parseFloat(num.toFixed(2));
};
      const formatRH = (val) => val != null ? `${Number(val).toFixed(2)}%` : '-';

      const pmaMappings = {};

      const isLot1Only = selectedBatch.endsWith('-1');
      const isLot2Only = selectedBatch.endsWith('-2');
      const fillBoth = !isLot1Only && !isLot2Only; 

      // 🛠️ THE FIX: Look for the key ending in '1' since that is what the backend sends
      const assignLotData = (baseKey) => {
    const backendKey = `${baseKey}1`;
    const val = formatNum(dbData[backendKey]); 
    
    pmaMappings[`${baseKey}1`] = (isLot1Only || fillBoth) ? val : '-'; 
    pmaMappings[`${baseKey}2`] = (isLot2Only || fillBoth) ? val : '-'; 
};

      // 1. Generate Input Material 1 & 2
      for (let i = 1; i <= 2; i++) {
        ['impeller', 'filter_clear', 'waktu'].forEach(param => {
          pmaMappings[`input${i}_${param}_set1`] = '-';
          pmaMappings[`input${i}_${param}_set2`] = '-';
          ['min', 'max', 'avg'].forEach(metric => assignLotData(`input${i}_${param}_${metric}`));
        });
      }

      // 2. Generate Mixing 1 & 2 (Standard Parameters)
      for (let i = 1; i <= 2; i++) {
        ['impeller', 'chopper', 'waktu'].forEach(param => {
          pmaMappings[`mix${i}_${param}_set1`] = '-'; 
          pmaMappings[`mix${i}_${param}_set2`] = '-';
          ['min', 'max', 'avg'].forEach(metric => assignLotData(`mix${i}_${param}_${metric}`));
        });
      }

      // 3. Generate Mixing 3 & 4 (Includes Pump & Ampere)
      for (let i = 3; i <= 4; i++) {
        ['impeller', 'chopper', 'waktu', 'pump', 'ampere'].forEach(param => {
          pmaMappings[`mix${i}_${param}_set1`] = '-'; 
          pmaMappings[`mix${i}_${param}_set2`] = '-';
          ['min', 'max', 'avg'].forEach(metric => assignLotData(`mix${i}_${param}_${metric}`));
        });
      }

      // 4. Generate Discharge 1 through 12
      for (let i = 1; i <= 12; i++) {
        ['impeller', 'chopper', 'waktu'].forEach(param => {
          pmaMappings[`discharge${i}_${param}_set1`] = '-';
          pmaMappings[`discharge${i}_${param}_set2`] = '-';
          ['min', 'max', 'avg'].forEach(metric => assignLotData(`discharge${i}_${param}_${metric}`));
        });
      }

      // 5. Generate Suhu, RH, and Binder Solution (Lot Aware)
      ['suhu', 'rh', 'binder_speed', 'binder_waktu'].forEach(param => {
        ['set', 'min', 'max', 'avg'].forEach(metric => {
          const rawValue = dbData[`${param}_${metric}1`]; // Grab the raw value from the database
          
          let finalVal = '-';
          if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
              // We use formatNum() for min/max/avg, but leave 'set' as its original whole number!
              finalVal = metric === 'set' ? rawValue : formatNum(rawValue);
          }
          
          pmaMappings[`${param}_${metric}1`] = (isLot1Only || fillBoth) ? finalVal : '-';
          pmaMappings[`${param}_${metric}2`] = (isLot2Only || fillBoth) ? finalVal : '-';
        });
      });

     const fbdClonedMappings = {};
      Object.keys(dbData).forEach(key => {
        // 1. Check if the key is "Lot-less" (Mixing, FBD, or EPH)
        if (!key.endsWith('1') && !key.endsWith('2')) {
          const rawValue = dbData[key];
          let formattedValue = '-';

          if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
            // We round everything to 1 decimal EXCEPT time/waktu keys
            formattedValue = key.includes('time') || key.includes('waktu') 
              ? rawValue 
              : Number(rawValue).toFixed(1);
          }

          // 2. Clone for both lots
          fbdClonedMappings[`${key}1`] = formattedValue;
          fbdClonedMappings[`${key}2`] = formattedValue;
        }
      });



      // Combine the user's input with the database results 
      const finalData = {
        ...dbData,
        ...fbdClonedMappings,
        ...pmaMappings, 
      
        nomor_batch: selectedBatch,
        tanggal_proses: selectedDate,
        nama_produk: "Saka Tablet (Auto-filled)", 
        recipe: "Standard Recipe",
        
        /*
        suhu_min1: formatNum(dbData.suhu_min1),
        suhu_max1: formatNum(dbData.suhu_max1),
        suhu_avg1: formatNum(dbData.suhu_avg1),
        
        rh_min1: formatRH(dbData.rh_min1),
        rh_max1: formatRH(dbData.rh_max1),
        rh_avg1: formatRH(dbData.rh_avg1),

        binder_speed_set1: formatNum(dbData.binder_speed_set1),
        binder_speed_min1: formatNum(dbData.binder_speed_min1),
        binder_speed_max1: formatNum(dbData.binder_speed_max1),
        binder_speed_avg1: formatNum(dbData.binder_speed_avg1),

        binder_waktu_set1: formatNum(dbData.binder_waktu_set1),
        binder_waktu_min1: formatNum(dbData.binder_waktu_min1),
        binder_waktu_max1: formatNum(dbData.binder_waktu_max1),
        binder_waktu_avg1: formatNum(dbData.binder_waktu_avg1),

        // --- CLONE TO LOT 2 ---
        suhu_min2: formatNum(dbData.suhu_min1),
        suhu_max2: formatNum(dbData.suhu_max1),
        suhu_avg2: formatNum(dbData.suhu_avg1),
        
        rh_min2: formatRH(dbData.rh_min1),
        rh_max2: formatRH(dbData.rh_max1),
        rh_avg2: formatRH(dbData.rh_avg1),

        binder_speed_set2: formatNum(dbData.binder_speed_set1),
        binder_speed_min2: formatNum(dbData.binder_speed_min1),
        binder_speed_max2: formatNum(dbData.binder_speed_max1),
        binder_speed_avg2: formatNum(dbData.binder_speed_avg1),

        binder_waktu_set2: formatNum(dbData.binder_waktu_set1),
        binder_waktu_min2: formatNum(dbData.binder_waktu_min1),
        binder_waktu_max2: formatNum(dbData.binder_waktu_max1),
        binder_waktu_avg2: formatNum(dbData.binder_waktu_avg1),

        // ... inside your finalData object ...

        // --- FORMAT LOT 1 FBD LOADING DATA ---
        loading_temp_min1: formatNum(dbData.loading_temp_min1),
        loading_temp_max1: formatNum(dbData.loading_temp_max1),
        loading_temp_avg1: formatNum(dbData.loading_temp_avg1),

        loading_flow_min1: formatNum(dbData.loading_flow_min1),
        loading_flow_max1: formatNum(dbData.loading_flow_max1),
        loading_flow_avg1: formatNum(dbData.loading_flow_avg1),

        loading_time_min1: formatNum(dbData.loading_time_min1),
        loading_time_max1: formatNum(dbData.loading_time_max1),
        loading_time_avg1: formatNum(dbData.loading_time_avg1),

        // NEW: Map Valve data
        loading_valve_min1: formatNum(dbData.loading_valve_min1),
        loading_valve_max1: formatNum(dbData.loading_valve_max1),
        loading_valve_avg1: formatNum(dbData.loading_valve_avg1),

        loading_filter_min1: formatNum(dbData.loading_filter_min1),
        loading_filter_max1: formatNum(dbData.loading_filter_max1),
        loading_filter_avg1: formatNum(dbData.loading_filter_avg1),

        loading_filtershake_min1: formatNum(dbData.loading_filtershake_min1),
        loading_filtershake_max1: formatNum(dbData.loading_filtershake_max1),
        loading_filtershake_avg1: formatNum(dbData.loading_filtershake_avg1),

        // Leave Bed Jogging explicitly blank for now
        loading_bed_min1: '-',
        loading_bed_max1: '-',
        loading_bed_avg1: '-',

        // --- CLONE LOT 1 FBD DATA TO LOT 2 ---
        loading_temp_min2: formatNum(dbData.loading_temp_min1),
        loading_temp_max2: formatNum(dbData.loading_temp_max1),
        loading_temp_avg2: formatNum(dbData.loading_temp_avg1),

        loading_flow_min2: formatNum(dbData.loading_flow_min1),
        loading_flow_max2: formatNum(dbData.loading_flow_max1),
        loading_flow_avg2: formatNum(dbData.loading_flow_avg1),

        loading_time_min2: formatNum(dbData.loading_time_min1),
        loading_time_max2: formatNum(dbData.loading_time_max1),
        loading_time_avg2: formatNum(dbData.loading_time_avg1),

        // Add these inside your initial state object
  input1_impeller_set1: '', input1_impeller_min1: '', input1_impeller_max1: '', input1_impeller_avg1: '',
  input1_filter_clear_set1: '', input1_filter_clear_min1: '', input1_filter_clear_max1: '', input1_filter_clear_avg1: '',
  input1_waktu_min1: '', input1_waktu_max1: '', input1_waktu_avg1: '',

  input2_impeller_set1: '', input2_impeller_min1: '', input2_impeller_max1: '', input2_impeller_avg1: '',
  input2_filter_clear_set1: '', input2_filter_clear_min1: '', input2_filter_clear_max1: '', input2_filter_clear_avg1: '',
  input2_waktu_min1: '', input2_waktu_max1: '', input2_waktu_avg1: '',

        // NEW: Clone Valve data
        loading_valve_min2: formatNum(dbData.loading_valve_min1),
        loading_valve_max2: formatNum(dbData.loading_valve_max1),
        loading_valve_avg2: formatNum(dbData.loading_valve_avg1),

        loading_filter_min2: formatNum(dbData.loading_filter_min1),
        loading_filter_max2: formatNum(dbData.loading_filter_max1),
        loading_filter_avg2: formatNum(dbData.loading_filter_avg1),

        loading_filtershake_min2: formatNum(dbData.loading_filtershake_min1),
        loading_filtershake_max2: formatNum(dbData.loading_filtershake_max1),
        loading_filtershake_avg2: formatNum(dbData.loading_filtershake_avg1),

        // Leave Bed Jogging explicitly blank for Lot 2
        loading_bed_min2: '-',
        loading_bed_max2: '-',
        loading_bed_avg2: '-',*/
      };

      setReportData(finalData);

      console.log("CLONED DATA RECEIVED:", finalData);

    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message);
      // We don't necessarily want to wipe out the whole UI on an error anymore, 
      // but clearing it ensures they don't export old data.
      setReportData(null); 
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const response = await fetch('http://localhost:8002/part/getAvailableBatches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selectedDate, line: selectedLine })
        });
        
        if (response.ok) {
          const data = await response.json();
          setBatchList(data);
          
          // If the database found batches, automatically select the first one in the list
          if (data.length > 0) {
            setSelectedBatch(data[0].BATCH);
          } else {
            setSelectedBatch(''); // Clear it if no batches ran that day
          }
        }
      } catch (err) {
        console.error("Failed to fetch batch list:", err);
        setBatchList([]);
      }
    };

    // Trigger the fetch immediately
    fetchBatches();
  }, [selectedDate, selectedLine]);

  return (
    <div className="min-h-screen bg-gray-200 p-6">
      
      {/* --- CONTROL PANEL --- */}
      <div className="max-w-6xl mx-auto bg-white p-6 rounded-lg shadow-md mb-6 border border-gray-300">
        <h2 className="text-xl font-bold mb-4 border-b pb-2">Batch Report Generator</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          
          {/* Line Selection */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Production Line</label>
            <select 
              value={selectedLine} 
              onChange={(e) => setSelectedLine(e.target.value)}
              className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500"
            >
              <option value="Line 1">Line 1</option>
              <option value="Line 3">Line 3</option>
            </select>
          </div>

          {/* Date Selection */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Date</label>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Batch Number Dropdown */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Batch Number</label>
            <select 
              value={selectedBatch} 
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500"
              disabled={batchList.length === 0}
            >
              {batchList.length === 0 ? (
                <option value="">No batches found</option>
              ) : (
                batchList.map((item, index) => (
                  <option key={index} value={item.BATCH}>
                    {item.DISPLAY} {/* <-- UPDATED: Now shows the machine tags */}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Fetch Button */}
          <div>
            <button 
              onClick={fetchBatchData}
              disabled={isLoading}
              className={`w-full py-2 px-4 rounded font-bold text-white shadow transition-colors ${
                isLoading ? 'bg-blue-300 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isLoading ? 'Fetching Database...' : 'Generate Preview'}
            </button>
          </div>

        </div>

        {/* Error Message Display */}
        {error && (
          <div className="mt-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>

      {/* --- PREVIEW COMPONENT --- */}
      {/* This is always rendered now!
        We pass `reportData || {}` so if reportData is null, it passes an empty object.
        The opacity transition gives a nice visual cue when data is loading.
      */}
      <div className={`transition-opacity duration-300 ${isLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
        <BatchReportPreview reportData={reportData || {}} />
      </div>

    </div>
  );
};

export default BatchPage;