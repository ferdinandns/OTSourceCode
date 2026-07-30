import React, { useState } from 'react';
import ProcessTable from './ProcessTable';

const BatchReportPreview = ({ reportData = {} }) => {
  const [activeTab, setActiveTab] = useState('lot1');
  const [isExporting, setIsExporting] = useState(false);

  // Add a console.log to see what React is actually receiving
  console.log("What is reportData?", reportData);

  // Temporarily change this to 'false' to force the UI to bypass the loading screen
  if (false) { 
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <h2 className="text-xl font-bold text-gray-500">Loading batch data...</h2>
      </div>
    );
  }

  // 1. Function to handle the PDF download
  const handleExport = async () => {
    setIsExporting(true);
    try {
      // 1. Capture the current local date and time
      const now = new Date();
      const timestamp = now.toLocaleString('id-ID', { 
        dateStyle: 'medium', 
        timeStyle: 'short' 
      });

      // 2. Add the timestamp to the data object
      const dataToExport = {
        ...reportData,
        printed_at: timestamp // This fills the {printed_at} tag in Word
      };

      const response = await fetch('http://localhost:8002/part/generateBatchPDF', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToExport),
      });

      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Batch_Report_${reportData.nomor_batch || 'Export'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error("Export Error:", error);
      alert("Error generating PDF. Check backend console.");
    } finally {
      setIsExporting(false);
    }
  };

  const mockData = {
    nama_produk: "Paracetamol 500mg",
    nomor_batch: "B2026-001",
    tanggal_proses: "2026-03-04",
    recipe: "REC-99",
    suhu_set1: 25, suhu_min1: 24, suhu_max1: 26, suhu_avg1: 25.1,
    rh_set1: 50, rh_min1: 45, rh_max1: 55, rh_avg1: 50.2,
    discharge1_impeller_set1: 1500,
    // Add a few more if you want to test specific tables
  };

  // Destructure your data for cleaner code (Assuming reportData holds your fetched DB data)
  const {
  binder_speed_avg1, binder_speed_avg2, binder_speed_max1, binder_speed_max2,
  binder_speed_min1, binder_speed_min2, binder_speed_set1, binder_speed_set2,
  binder_waktu_avg1, binder_waktu_avg2, binder_waktu_max1, binder_waktu_max2,
  binder_waktu_min1, binder_waktu_min2, binder_waktu_set1, binder_waktu_set2,
  discharge10_chopper_avg1, discharge10_chopper_avg2, discharge10_chopper_max1, discharge10_chopper_max2,
  discharge10_chopper_min1, discharge10_chopper_min2, discharge10_chopper_set1, discharge10_chopper_set2,
  discharge10_impeller_avg1, discharge10_impeller_avg2, discharge10_impeller_max1, discharge10_impeller_max2,
  discharge10_impeller_min1, discharge10_impeller_min2, discharge10_impeller_set1, discharge10_impeller_set2,
  discharge10_waktu_avg1, discharge10_waktu_avg2, discharge10_waktu_max1, discharge10_waktu_max2,
  discharge10_waktu_min1, discharge10_waktu_min2, discharge11_chopper_avg1, discharge11_chopper_avg2,
  discharge11_chopper_max1, discharge11_chopper_max2, discharge11_chopper_min1, discharge11_chopper_min2,
  discharge11_chopper_set1, discharge11_chopper_set2, discharge11_impeller_avg1, discharge11_impeller_avg2,
  discharge11_impeller_max1, discharge11_impeller_max2, discharge11_impeller_min1, discharge11_impeller_min2,
  discharge11_impeller_set1, discharge11_impeller_set2, discharge11_waktu_avg1, discharge11_waktu_avg2,
  discharge11_waktu_max1, discharge11_waktu_max2, discharge11_waktu_min1, discharge11_waktu_min2,
  discharge12_chopper_avg1, discharge12_chopper_avg2, discharge12_chopper_max1, discharge12_chopper_max2,
  discharge12_chopper_min1, discharge12_chopper_min2, discharge12_chopper_set1, discharge12_chopper_set2,
  discharge12_impeller_avg1, discharge12_impeller_avg2, discharge12_impeller_max1, discharge12_impeller_max2,
  discharge12_impeller_min1, discharge12_impeller_min2, discharge12_impeller_set1, discharge12_impeller_set2,
  discharge12_waktu_avg1, discharge12_waktu_avg2, discharge12_waktu_max1, discharge12_waktu_max2,
  discharge12_waktu_min1, discharge12_waktu_min2, discharge1_chopper_avg1, discharge1_chopper_avg2,
  discharge1_chopper_max1, discharge1_chopper_max2, discharge1_chopper_min1, discharge1_chopper_min2,
  discharge1_chopper_set1, discharge1_chopper_set2, discharge1_impeller_avg1, discharge1_impeller_avg2,
  discharge1_impeller_max1, discharge1_impeller_max2, discharge1_impeller_min1, discharge1_impeller_min2,
  discharge1_impeller_set1, discharge1_impeller_set2, discharge1_waktu_avg1, discharge1_waktu_avg2,
  discharge1_waktu_max1, discharge1_waktu_max2, discharge1_waktu_min1, discharge1_waktu_min2,
  discharge2_chopper_avg1, discharge2_chopper_avg2, discharge2_chopper_max1, discharge2_chopper_max2,
  discharge2_chopper_min1, discharge2_chopper_min2, discharge2_chopper_set1, discharge2_chopper_set2,
  discharge2_impeller_avg1, discharge2_impeller_avg2, discharge2_impeller_max1, discharge2_impeller_max2,
  discharge2_impeller_min1, discharge2_impeller_min2, discharge2_impeller_set1, discharge2_impeller_set2,
  discharge2_waktu_avg1, discharge2_waktu_avg2, discharge2_waktu_max1, discharge2_waktu_max2,
  discharge2_waktu_min1, discharge2_waktu_min2, discharge3_chopper_avg1, discharge3_chopper_avg2,
  discharge3_chopper_max1, discharge3_chopper_max2, discharge3_chopper_min1, discharge3_chopper_min2,
  discharge3_chopper_set1, discharge3_chopper_set2, discharge3_impeller_avg1, discharge3_impeller_avg2,
  discharge3_impeller_max1, discharge3_impeller_max2, discharge3_impeller_min1, discharge3_impeller_min2,
  discharge3_impeller_set1, discharge3_impeller_set2, discharge3_waktu_avg1, discharge3_waktu_avg2,
  discharge3_waktu_max1, discharge3_waktu_max2, discharge3_waktu_min1, discharge3_waktu_min2,
  discharge4_chopper_avg1, discharge4_chopper_avg2, discharge4_chopper_max1, discharge4_chopper_max2,
  discharge4_chopper_min1, discharge4_chopper_min2, discharge4_chopper_set1, discharge4_chopper_set2,
  discharge4_impeller_avg1, discharge4_impeller_avg2, discharge4_impeller_max1, discharge4_impeller_max2,
  discharge4_impeller_min1, discharge4_impeller_min2, discharge4_impeller_set1, discharge4_impeller_set2,
  discharge4_waktu_avg1, discharge4_waktu_avg2, discharge4_waktu_max1, discharge4_waktu_max2,
  discharge4_waktu_min1, discharge4_waktu_min2, discharge5_chopper_avg1, discharge5_chopper_avg2,
  discharge5_chopper_max1, discharge5_chopper_max2, discharge5_chopper_min1, discharge5_chopper_min2,
  discharge5_chopper_set1, discharge5_chopper_set2, discharge5_impeller_avg1, discharge5_impeller_avg2,
  discharge5_impeller_max1, discharge5_impeller_max2, discharge5_impeller_min1, discharge5_impeller_min2,
  discharge5_impeller_set1, discharge5_impeller_set2, discharge5_waktu_avg1, discharge5_waktu_avg2,
  discharge5_waktu_max1, discharge5_waktu_max2, discharge5_waktu_min1, discharge5_waktu_min2,
  discharge6_chopper_avg1, discharge6_chopper_avg2, discharge6_chopper_max1, discharge6_chopper_max2,
  discharge6_chopper_min1, discharge6_chopper_min2, discharge6_chopper_set1, discharge6_chopper_set2,
  discharge6_impeller_avg1, discharge6_impeller_avg2, discharge6_impeller_max1, discharge6_impeller_max2,
  discharge6_impeller_min1, discharge6_impeller_min2, discharge6_impeller_set1, discharge6_impeller_set2,
  discharge6_waktu_avg1, discharge6_waktu_avg2, discharge6_waktu_max1, discharge6_waktu_max2,
  discharge6_waktu_min1, discharge6_waktu_min2, discharge7_chopper_avg1, discharge7_chopper_avg2,
  discharge7_chopper_max1, discharge7_chopper_max2, discharge7_chopper_min1, discharge7_chopper_min2,
  discharge7_chopper_set1, discharge7_chopper_set2, discharge7_impeller_avg1, discharge7_impeller_avg2,
  discharge7_impeller_max1, discharge7_impeller_max2, discharge7_impeller_min1, discharge7_impeller_min2,
  discharge7_impeller_set1, discharge7_impeller_set2, discharge7_waktu_avg1, discharge7_waktu_avg2,
  discharge7_waktu_max1, discharge7_waktu_max2, discharge7_waktu_min1, discharge7_waktu_min2,
  discharge8_chopper_avg1, discharge8_chopper_avg2, discharge8_chopper_max1, discharge8_chopper_max2,
  discharge8_chopper_min1, discharge8_chopper_min2, discharge8_chopper_set1, discharge8_chopper_set2,
  discharge8_impeller_avg1, discharge8_impeller_avg2, discharge8_impeller_max1, discharge8_impeller_max2,
  discharge8_impeller_min1, discharge8_impeller_min2, discharge8_impeller_set1, discharge8_impeller_set2,
  discharge8_waktu_avg1, discharge8_waktu_avg2, discharge8_waktu_max1, discharge8_waktu_max2,
  discharge8_waktu_min1, discharge8_waktu_min2, discharge9_chopper_avg1, discharge9_chopper_avg2,
  discharge9_chopper_max1, discharge9_chopper_max2, discharge9_chopper_min1, discharge9_chopper_min2,
  discharge9_chopper_set1, discharge9_chopper_set2, discharge9_impeller_avg1, discharge9_impeller_avg2,
  discharge9_impeller_max1, discharge9_impeller_max2, discharge9_impeller_min1, discharge9_impeller_min2,
  discharge9_impeller_set1, discharge9_impeller_set2, discharge9_waktu_avg1, discharge9_waktu_avg2,
  discharge9_waktu_max1, discharge9_waktu_max2, discharge9_waktu_min1, discharge9_waktu_min2,
  drying_airflow_avg1, drying_airflow_avg2, drying_airflow_max1, drying_airflow_max2,
  drying_airflow_min1, drying_airflow_min2, drying_airflow_set1, drying_airflow_set2,
  drying_exhaust_avg1, drying_exhaust_avg2, drying_exhaust_max1, drying_exhaust_max2,
  drying_exhaust_min1, drying_exhaust_min2, drying_exhaust_set1, drying_exhaust_set2,
  drying_filter_avg1, drying_filter_avg2, drying_filter_max1, drying_filter_max2,
  drying_filter_min1, drying_filter_min2, drying_filter_set1, drying_filter_set2,
  drying_filtershake_max1, drying_filtershake_max2, drying_filtershake_min1, drying_filtershake_min2,
  drying_filtershake_set1, drying_filtershake_set2, drying_pengeringan_avg1, drying_pengeringan_avg2,
  drying_pengeringan_max1, drying_pengeringan_max2, drying_pengeringan_min1, drying_pengeringan_min2,
  drying_pengeringan_set1, drying_pengeringan_set2, drying_temp_avg1, drying_temp_avg2,
  drying_temp_max1, drying_temp_max2, drying_temp_min1, drying_temp_min2,
  drying_temp_set1, drying_temp_set2, finalmix_discharge1_avg1, finalmix_discharge1_avg2,
  finalmix_discharge1_max1, finalmix_discharge1_max2, finalmix_discharge1_min1, finalmix_discharge1_min2,
  finalmix_discharge1_set1, finalmix_discharge1_set2, finalmix_discharge2_avg1, finalmix_discharge2_avg2,
  finalmix_discharge2_max1, finalmix_discharge2_max2, finalmix_discharge2_min1, finalmix_discharge2_min2,
  finalmix_discharge2_set1, finalmix_discharge2_set2, finalmix_discharge3_avg1, finalmix_discharge3_avg2,
  finalmix_discharge3_max1, finalmix_discharge3_max2, finalmix_discharge3_min1, finalmix_discharge3_min2,
  finalmix_discharge3_set1, finalmix_discharge3_set2, finalmix_speed1_avg1, finalmix_speed1_avg2,
  finalmix_speed1_max1, finalmix_speed1_max2, finalmix_speed1_min1, finalmix_speed1_min2,
  finalmix_speed1_set1, finalmix_speed1_set2, finalmix_speed2_avg1, finalmix_speed2_avg2,
  finalmix_speed2_max1, finalmix_speed2_max2, finalmix_speed2_min1, finalmix_speed2_min2,
  finalmix_speed2_set1, finalmix_speed2_set2, finalmix_speed3_avg1, finalmix_speed3_avg2,
  finalmix_speed3_max1, finalmix_speed3_max2, finalmix_speed3_min1, finalmix_speed3_min2,
  finalmix_speed3_set1, finalmix_speed3_set2, finalmix_waktu1_avg1, finalmix_waktu1_avg2,
  finalmix_waktu1_max1, finalmix_waktu1_max2, finalmix_waktu1_min1, finalmix_waktu1_min2,
  finalmix_waktu2_avg1, finalmix_waktu2_avg2, finalmix_waktu2_max1, finalmix_waktu2_max2,
  finalmix_waktu2_min1, finalmix_waktu2_min2, finalmix_waktu3_avg1, finalmix_waktu3_avg2,
  finalmix_waktu3_max1, finalmix_waktu3_max2, finalmix_waktu3_min1, finalmix_waktu3_min2,
  loading_bed_avg1, loading_bed_avg2, loading_bed_max1, loading_bed_max2,
  loading_bed_min1, loading_bed_min2, loading_bed_set1, loading_bed_set2,
  loading_valve_set1, loading_valve_min1, loading_valve_max1,loading_valve_avg1,
  loading_valve_set2, loading_valve_min2, loading_valve_max2, loading_valve_avg2,
  loading_filter_avg1, loading_filter_avg2, loading_filter_max1, loading_filter_max2,
  loading_filter_min1, loading_filter_min2, loading_filter_set1, loading_filter_set2,
  loading_filtershake_avg1, loading_filtershake_avg2, loading_filtershake_max1, loading_filtershake_max2,
  loading_filtershake_min1, loading_filtershake_min2, loading_filtershake_set1, loading_filtershake_set2,
  loading_flow_avg1, loading_flow_avg2, loading_flow_max1, loading_flow_max2,
  loading_flow_min1, loading_flow_min2, loading_flow_set1, loading_flow_set2,
  loading_temp_avg1, loading_temp_avg2, loading_temp_max1, loading_temp_max2,
  loading_temp_min1, loading_temp_min2, loading_temp_set1, loading_temp_set2,
  loading_time_avg1, loading_time_avg2, loading_time_max1, loading_time_max2,
  loading_time_min1, loading_time_min2, loading_time_set1, loading_time_set2,
  mix1_chopper_avg1, mix1_chopper_avg2, mix1_chopper_max1, mix1_chopper_max2,
  mix1_chopper_min1, mix1_chopper_min2, mix1_chopper_set1, mix1_chopper_set2,
  mix1_impeller_avg1, mix1_impeller_avg2, mix1_impeller_max1, mix1_impeller_max2,
  mix1_impeller_min1, mix1_impeller_min2, mix1_impeller_set1, mix1_impeller_set2,
  mix1_waktu_avg1, mix1_waktu_avg2, mix1_waktu_max1, mix1_waktu_max2,
  mix1_waktu_min1, mix1_waktu_min2, mix1_waktu_set1, mix1_waktu_set2,
  mix2_chopper_avg1, mix2_chopper_avg2, mix2_chopper_max1, mix2_chopper_max2,
  mix2_chopper_min1, mix2_chopper_min2, mix2_chopper_set1, mix2_chopper_set2,
  mix2_impeller_avg1, mix2_impeller_avg2, mix2_impeller_max1, mix2_impeller_max2,
  mix2_impeller_min1, mix2_impeller_min2, mix2_impeller_set1, mix2_impeller_set2,
  mix2_waktu_avg1, mix2_waktu_avg2, mix2_waktu_max1, mix2_waktu_max2,
  mix2_waktu_min1, mix2_waktu_min2, mix2_waktu_set1, mix2_waktu_set2,
  mix3_chopper_avg1, mix3_chopper_avg2, mix3_chopper_max1, mix3_chopper_max2,
  mix3_chopper_min1, mix3_chopper_min2, mix3_chopper_set1, mix3_chopper_set2,
  mix3_impeller_avg1, mix3_impeller_avg2, mix3_impeller_max1, mix3_impeller_max2,
  mix3_impeller_min1, mix3_impeller_min2, mix3_impeller_set1, mix3_impeller_set2,
  mix3_waktu_avg1, mix3_waktu_avg2, mix3_waktu_max1, mix3_waktu_max2,
  mix3_waktu_min1, mix3_waktu_min2, mix3_waktu_set1, mix3_waktu_set2,
  mix4_chopper_avg1, mix4_chopper_avg2, mix4_chopper_max1, mix4_chopper_max2,
  mix4_chopper_min1, mix4_chopper_min2, mix4_chopper_set1, mix4_chopper_set2,
  mix4_impeller_avg1, mix4_impeller_avg2, mix4_impeller_max1, mix4_impeller_max2,
  mix4_impeller_min1, mix4_impeller_min2, mix4_impeller_set1, mix4_impeller_set2,
  mix4_waktu_avg1, mix4_waktu_avg2, mix4_waktu_max1, mix4_waktu_max2,
  mix4_waktu_min1, mix4_waktu_min2, mix4_waktu_set1, mix4_waktu_set2,
  mixing_waktu_avg1, mixing_waktu_avg2, mixing_waktu_max1, mixing_waktu_max2,
  mixing_waktu_min1, mixing_waktu_min2, nama_produk, nomor_batch,
  recipe, rh_avg1, rh_avg2, rh_max1,
  rh_max2, rh_min1, rh_min2, rh_set1,
  rh_set2, suhu_avg1, suhu_avg2, suhu_max1,
  suhu_max2, suhu_min1, suhu_min2, suhu_set1,
  suhu_set2, tanggal_proses, transfer_end_avg1, transfer_end_avg2,
  transfer_end_max1, transfer_end_max2, transfer_end_min1, transfer_end_min2,
  transfer_end_set1, transfer_end_set2, transfer_flow_avg1, transfer_flow_avg2,
  transfer_flow_max1, transfer_flow_max2, transfer_flow_min1, transfer_flow_min2,
  transfer_flow_set1, transfer_flow_set2, transfer_inlet_avg1, transfer_inlet_avg2,
  transfer_inlet_max1, transfer_inlet_max2, transfer_inlet_min1, transfer_inlet_min2,
  transfer_inlet_set1, transfer_inlet_set2, transfer_start_avg1, transfer_start_avg2,
  transfer_start_max1, transfer_start_max2, transfer_start_min1, transfer_start_min2,
  transfer_start_set1, transfer_start_set2, vacuum1_filter_clear_avg1, vacuum1_filter_clear_avg2,
  vacuum1_filter_clear_max1, vacuum1_filter_clear_max2, vacuum1_filter_clear_min1, vacuum1_filter_clear_min2,
  vacuum1_filter_clear_set1, vacuum1_filter_clear_set2, vacuum1_impeller_avg1, vacuum1_impeller_avg2,
  vacuum1_impeller_max1, vacuum1_impeller_max2, vacuum1_impeller_min1, vacuum1_impeller_min2,
  vacuum1_impeller_set1, vacuum1_impeller_set2, vacuum1_waktu_avg1, vacuum1_waktu_avg2,
  vacuum1_waktu_max1, vacuum1_waktu_max2, vacuum1_waktu_min1, vacuum1_waktu_min2,
  vacuum2_filter_clear_avg1, vacuum2_filter_clear_avg2, vacuum2_filter_clear_max1, vacuum2_filter_clear_max2,
  vacuum2_filter_clear_min1, vacuum2_filter_clear_min2, vacuum2_filter_clear_set1, vacuum2_filter_clear_set2,
  vacuum2_impeller_avg1, vacuum2_impeller_avg2, vacuum2_impeller_max1, vacuum2_impeller_max2,
  vacuum2_impeller_min1, vacuum2_impeller_min2, vacuum2_impeller_set1, vacuum2_impeller_set2,
  vacuum2_waktu_avg1, vacuum2_waktu_avg2, vacuum2_waktu_max1, vacuum2_waktu_max2,
  vacuum2_waktu_min1, vacuum2_waktu_min2
} = reportData;
const clean = (val) => {
    if (val === null || val === undefined || val === '') return '-';
    // If it's a number (or a string that looks like a number), round to 1 decimal
    const num = parseFloat(val);
    return isNaN(num) ? '-' : num.toFixed(1); 
};


  return (
    <div className="p-6 max-w-6xl mx-auto bg-gray-50 min-h-screen">
      
      {/* HEADER SECTION */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Preview: Batch Information</h1>
        
        {/* THE EXPORT BUTTON */}
        <button 
          onClick={handleExport}
          disabled={isExporting}
          className={`flex items-center space-x-2 px-6 py-2 rounded shadow-lg font-bold text-white transition-all ${
            isExporting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
          }`}
        >
          {isExporting ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              Converting to PDF...
            </>
          ) : (
            'Export to PDF'
          )}
        </button>
      </div>

      {/* In your Batch Information Table */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white p-4 rounded shadow-sm mb-6 border">
  <div>
    <p className="text-gray-500 text-xs font-bold uppercase">Start Time</p>
    <p className="font-semibold text-sm">{reportData.batch_start_time || '-'}</p>
  </div>
  <div>
    <p className="text-gray-500 text-xs font-bold uppercase">End Time</p>
    <p className="font-semibold text-sm">{reportData.batch_end_time || '-'}</p>
  </div>
  <div>
    <p className="text-gray-500 text-xs font-bold uppercase">Total Duration</p>
    <p className="font-semibold text-sm text-blue-600 font-mono">
       {reportData.batch_total_duration || '-'}
    </p>
  </div>
  <div>
    <p className="text-gray-500 text-xs font-bold uppercase">Recipe</p>
    <p className="font-semibold text-sm">Standard Recipe</p>
  </div>
</div>

      {/* DYNAMIC GENERAL INFO */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-white p-6 rounded shadow-sm mb-6 border border-gray-100">
  
  {/* Row 1: The Core Identity */}
  <div>
    <strong className="block text-gray-400 text-[10px] uppercase tracking-wider mb-1">Nama Produk</strong>
    <span className="text-gray-800 font-bold">{reportData.product_name || "Unknown Product"}</span>
  </div>
  
  <div>
    <strong className="block text-gray-400 text-[10px] uppercase tracking-wider mb-1">Nomor Batch</strong>
    <span className="text-gray-800 font-bold">{reportData.nomor_batch || "-"}</span>
  </div>

  <div>
    <strong className="block text-gray-400 text-[10px] uppercase tracking-wider mb-1">Recipe Name</strong>
    <span className="text-blue-600 font-bold">{reportData.recipe_name || "Standard"}</span>
  </div>

  <div>
    <strong className="block text-gray-400 text-[10px] uppercase tracking-wider mb-1">Tanggal Proses</strong>
    <span className="text-gray-800 font-bold">{reportData.tanggal_proses || "-"}</span>
  </div>

  {/* Row 2: The Timeline Data (Optional but recommended) */}
  <div className="pt-2 border-t md:border-t-0">
    <strong className="block text-gray-400 text-[10px] uppercase tracking-wider mb-1">Start Time</strong>
    <span className="text-gray-700 font-medium">{reportData.batch_start_time || "--:--"}</span>
  </div>

  <div className="pt-2 border-t md:border-t-0">
    <strong className="block text-gray-400 text-[10px] uppercase tracking-wider mb-1">End Time</strong>
    <span className="text-gray-700 font-medium">{reportData.batch_end_time || "--:--"}</span>
  </div>

  <div className="pt-2 border-t md:border-t-0">
    <strong className="block text-gray-400 text-[10px] uppercase tracking-wider mb-1">Total Duration</strong>
    <span className="text-indigo-600 font-bold font-mono text-sm">{reportData.batch_total_duration || "-"}</span>
  </div>

</div>

      {/* TAB NAVIGATION */}
      <div className="flex space-x-4 mb-6 border-b">
        <button 
          className={`pb-2 px-2 transition-colors ${activeTab === 'lot1' ? 'border-b-2 border-blue-600 font-bold text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('lot1')}
        >
          Lot 1 Data
        </button>
        <button 
          className={`pb-2 px-2 transition-colors ${activeTab === 'lot2' ? 'border-b-2 border-blue-600 font-bold text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('lot2')}
        >
          Lot 2 Data
        </button>
      </div>

      {/* --- TAB CONTENT: LOT 1 --- */}
      {activeTab === 'lot1' && (
        <div className="space-y-6">

          

          {/* --- FRONT SECTIONS (LOT 1) --- */}
          <h2 className="text-xl font-bold text-gray-800 border-b pb-2 mt-4 mb-4">MONITORING RUANGAN (LOT 1)</h2>
          <ProcessTable 
            title="Suhu & RH" 
            dataRows={[
              { label: 'SUHU', set: "20 - 27", min: reportData.suhu_min1, max: reportData.suhu_max1, avg: reportData.suhu_avg1 },
              { label: 'RH', set: "<70", min: reportData.rh_min1, max: reportData.rh_max1, avg: reportData.rh_avg1 }
            ]} 
          />

          <h2 className="text-xl font-bold text-gray-800 border-b pb-2 mt-8 mb-4">BINDER SOLUTION (LOT 1)</h2>
          <ProcessTable 
            title="Speed & Waktu" 
            dataRows={[
              { label: 'Speed (RPM)', set: reportData.pma_recipe_pump_speed1 ?? '-', min: reportData.binder_speed_min1, max: reportData.binder_speed_max1, avg: reportData.binder_speed_avg1 },
              { label: 'Waktu (menit)', set: '-', min: reportData.binder_waktu_min1, max: reportData.binder_waktu_max1, avg: reportData.binder_waktu_avg1 }
            ]} 
          />

          <h2 className="text-xl font-bold text-gray-800 border-b pb-2 mt-8 mb-4">TRANSFER GRANUL BASAH (LOT 1)</h2>
          <h2 className="text-xl font-bold text-gray-800 border-b pb-2 mt-8 mb-4">GRANULASI (LOT 1)</h2>
          
          <ProcessTable 
            title="Input Material I" 
            dataRows={[
              { label: 'Impeller loading speed (RPM)', set: reportData.pma_recipe_loading_speed ?? '-', min: reportData.input1_impeller_min1, max: reportData.input1_impeller_max1, avg: reportData.input1_impeller_avg1 },
              { label: 'Filter clear interval time (sec)', set: reportData.pma_recipe_filter_interval ?? '-', min: reportData.input1_filter_clear_min1, max: reportData.input1_filter_clear_max1, avg: reportData.input1_filter_clear_avg1 },
              { label: 'Waktu loading (menit)', set: '-', min: reportData.input1_waktu_min1, max: reportData.input1_waktu_max1, avg: reportData.input1_waktu_avg1 }
            ]} 
          />

          <ProcessTable 
            title="Mixing I" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.mix1_recipe_impeller ?? '-', min: reportData.mix1_impeller_min1, max: reportData.mix1_impeller_max1, avg: reportData.mix1_impeller_avg1 },
              { label: 'Chopper (RPM)', set: reportData.mix1_recipe_chopper ?? '-', min: reportData.mix1_chopper_min1, max: reportData.mix1_chopper_max1, avg: reportData.mix1_chopper_avg1 },
              { label: 'Waktu (menit)', set: reportData.mix1_recipe_time ?? '-', min: reportData.mix1_waktu_min1, max: reportData.mix1_waktu_max1, avg: reportData.mix1_waktu_avg1 }
            ]} 
          />
          <ProcessTable 
            title="Input Material II" 
            dataRows={[
              { label: 'Impeller loading speed (RPM)', set: reportData.pma_recipe_loading_speed ?? '-', min: reportData.input2_impeller_min1, max: reportData.input2_impeller_max1, avg: reportData.input2_impeller_avg1 },
              { label: 'Filter clear interval time (sec)', set: reportData.pma_recipe_filter_interval ?? '-', min: reportData.input2_filter_clear_min1, max: reportData.input2_filter_clear_max1, avg: reportData.input2_filter_clear_avg1 },
              { label: 'Waktu loading (menit)', set: '-', min: reportData.input2_waktu_min1, max: reportData.input2_waktu_max1, avg: reportData.input2_waktu_avg1 }
            ]} 
          />
          <ProcessTable 
            title="Mixing II" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.mix2_recipe_impeller ?? '-', min: reportData.mix2_impeller_min1, max: reportData.mix2_impeller_max1, avg: reportData.mix2_impeller_avg1 },
              { label: 'Chopper (RPM)', set: reportData.mix2_recipe_chopper ?? '-', min: reportData.mix2_chopper_min1, max: reportData.mix2_chopper_max1, avg: reportData.mix2_chopper_avg1 },
              { label: 'Waktu (menit)', set: reportData.mix2_recipe_time ?? '-', min: reportData.mix2_waktu_min1, max: reportData.mix2_waktu_max1, avg: reportData.mix2_waktu_avg1 }
            ]} 
          />
          <ProcessTable 
            title="Mixing III" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.mix3_recipe_impeller ?? '-', min: reportData.mix3_impeller_min1, max: reportData.mix3_impeller_max1, avg: reportData.mix3_impeller_avg1 },
              { label: 'Chopper (RPM)', set: reportData.mix3_recipe_chopper ?? '-', min: reportData.mix3_chopper_min1, max: reportData.mix3_chopper_max1, avg: reportData.mix3_chopper_avg1 },
              { label: 'Waktu (menit)', set: reportData.mix3_recipe_time ?? '-', min: reportData.mix3_waktu_min1, max: reportData.mix3_waktu_max1, avg: reportData.mix3_waktu_avg1 },
              { label: '% Pump Speed', set: reportData.mix3_recipe_pump ?? '-', min: reportData.mix3_pump_min1, max: reportData.mix3_pump_max1, avg: reportData.mix3_pump_avg1 },
              { label: 'Ampere (A)', set: '-', min: reportData.mix3_ampere_min1, max: reportData.mix3_ampere_max1, avg: reportData.mix3_ampere_avg1 }
            ]} 
          />
          <ProcessTable 
            title="Mixing IV" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.mix4_recipe_impeller ?? '-', min: reportData.mix4_impeller_min1, max: reportData.mix4_impeller_max1, avg: reportData.mix4_impeller_avg1 },
              { label: 'Chopper (RPM)', set: reportData.mix4_recipe_chopper ?? '-', min: reportData.mix4_chopper_min1, max: reportData.mix4_chopper_max1, avg: reportData.mix4_chopper_avg1 },
              { label: 'Waktu (menit)', set: reportData.mix4_recipe_time ?? '-', min: reportData.mix4_waktu_min1, max: reportData.mix4_waktu_max1, avg: reportData.mix4_waktu_avg1 },
              { label: '% Pump Speed', set: reportData.mix4_recipe_pump ?? '-', min: reportData.mix4_pump_min1, max: reportData.mix4_pump_max1, avg: reportData.mix4_pump_avg1 },
              { label: 'Ampere (A)', set: '-', min: reportData.mix4_ampere_min1, max: reportData.mix4_ampere_max1, avg: reportData.mix4_ampere_avg1 }
            ]} 
          />
          
          <ProcessTable 
            title="Discharge I (Lot 1)" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.discharge1_recipe_impeller ?? '-', min: reportData.discharge1_impeller_min1, max: reportData.discharge1_impeller_max1, avg: reportData.discharge1_impeller_avg1 },
              { label: 'Chopper (RPM)', set: reportData.discharge1_recipe_chopper ?? '-', min: reportData.discharge1_chopper_min1, max: reportData.discharge1_chopper_max1, avg: reportData.discharge1_chopper_avg1 },
              { label: 'Waktu (menit)', set: reportData.discharge1_recipe_time ?? '-', min: reportData.discharge1_waktu_min1, max: reportData.discharge1_waktu_max1, avg: reportData.discharge1_waktu_avg1 }
            ]} 
          />
          <ProcessTable 
            title="Discharge II (Lot 1)" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.discharge2_recipe_impeller ?? '-', min: reportData.discharge2_impeller_min1, max: reportData.discharge2_impeller_max1, avg: reportData.discharge2_impeller_avg1 },
              { label: 'Chopper (RPM)', set: reportData.discharge2_recipe_chopper ?? '-', min: reportData.discharge2_chopper_min1, max: reportData.discharge2_chopper_max1, avg: reportData.discharge2_chopper_avg1 },
              { label: 'Waktu (menit)', set: reportData.discharge2_recipe_time ?? '-', min: reportData.discharge2_waktu_min1, max: reportData.discharge2_waktu_max1, avg: reportData.discharge2_waktu_avg1 }
            ]} 
          />
          <ProcessTable 
            title="Discharge III (Lot 1)" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.discharge3_recipe_impeller ?? '-', min: reportData.discharge3_impeller_min1, max: reportData.discharge3_impeller_max1, avg: reportData.discharge3_impeller_avg1 },
              { label: 'Chopper (RPM)', set: reportData.discharge3_recipe_chopper ?? '-', min: reportData.discharge3_chopper_min1, max: reportData.discharge3_chopper_max1, avg: reportData.discharge3_chopper_avg1 },
              { label: 'Waktu (menit)', set: reportData.discharge3_recipe_time ?? '-', min: reportData.discharge3_waktu_min1, max: reportData.discharge3_waktu_max1, avg: reportData.discharge3_waktu_avg1 }
            ]} 
          />
          <ProcessTable 
            title="Discharge IV (Lot 1)" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.discharge4_recipe_impeller ?? '-', min: reportData.discharge4_impeller_min1, max: reportData.discharge4_impeller_max1, avg: reportData.discharge4_impeller_avg1 },
              { label: 'Chopper (RPM)', set: reportData.discharge4_recipe_chopper ?? '-', min: reportData.discharge4_chopper_min1, max: reportData.discharge4_chopper_max1, avg: reportData.discharge4_chopper_avg1 },
              { label: 'Waktu (menit)', set: reportData.discharge4_recipe_time ?? '-', min: reportData.discharge4_waktu_min1, max: reportData.discharge4_waktu_max1, avg: reportData.discharge4_waktu_avg1 }
            ]} 
          />
          <ProcessTable 
            title="Discharge V (Lot 1)" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.discharge5_recipe_impeller ?? '-', min: reportData.discharge5_impeller_min1, max: reportData.discharge5_impeller_max1, avg: reportData.discharge5_impeller_avg1 },
              { label: 'Chopper (RPM)', set: reportData.discharge5_recipe_chopper ?? '-', min: reportData.discharge5_chopper_min1, max: reportData.discharge5_chopper_max1, avg: reportData.discharge5_chopper_avg1 },
              { label: 'Waktu (menit)', set: reportData.discharge5_recipe_time ?? '-', min: reportData.discharge5_waktu_min1, max: reportData.discharge5_waktu_max1, avg: reportData.discharge5_waktu_avg1 }
            ]} 
          />
          <ProcessTable 
            title="Discharge VI (Lot 1)" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.discharge6_recipe_impeller ?? '-', min: reportData.discharge6_impeller_min1, max: reportData.discharge6_impeller_max1, avg: reportData.discharge6_impeller_avg1 },
              { label: 'Chopper (RPM)', set: reportData.discharge6_recipe_chopper ?? '-', min: reportData.discharge6_chopper_min1, max: reportData.discharge6_chopper_max1, avg: reportData.discharge6_chopper_avg1 },
              { label: 'Waktu (menit)', set: reportData.discharge6_recipe_time ?? '-', min: reportData.discharge6_waktu_min1, max: reportData.discharge6_waktu_max1, avg: reportData.discharge6_waktu_avg1 }
            ]} 
          />
          <ProcessTable 
            title="Discharge VII (Lot 1)" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.discharge7_recipe_impeller ?? '-', min: reportData.discharge7_impeller_min1, max: reportData.discharge7_impeller_max1, avg: reportData.discharge7_impeller_avg1 },
              { label: 'Chopper (RPM)', set: reportData.discharge7_recipe_chopper ?? '-', min: reportData.discharge7_chopper_min1, max: reportData.discharge7_chopper_max1, avg: reportData.discharge7_chopper_avg1 },
              { label: 'Waktu (menit)', set: reportData.discharge7_recipe_time ?? '-', min: reportData.discharge7_waktu_min1, max: reportData.discharge7_waktu_max1, avg: reportData.discharge7_waktu_avg1 }
            ]} 
          />
          <ProcessTable 
            title="Discharge VIII (Lot 1)" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.discharge8_recipe_impeller ?? '-', min: reportData.discharge8_impeller_min1, max: reportData.discharge8_impeller_max1, avg: reportData.discharge8_impeller_avg1 },
              { label: 'Chopper (RPM)', set: reportData.discharge8_recipe_chopper ?? '-', min: reportData.discharge8_chopper_min1, max: reportData.discharge8_chopper_max1, avg: reportData.discharge8_chopper_avg1 },
              { label: 'Waktu (menit)', set: reportData.discharge8_recipe_time ?? '-', min: reportData.discharge8_waktu_min1, max: reportData.discharge8_waktu_max1, avg: reportData.discharge8_waktu_avg1 }
            ]} 
          />
          <ProcessTable 
            title="Discharge IX (Lot 1)" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.discharge9_recipe_impeller ?? '-', min: reportData.discharge9_impeller_min1, max: reportData.discharge9_impeller_max1, avg: reportData.discharge9_impeller_avg1 },
              { label: 'Chopper (RPM)', set: reportData.discharge9_recipe_chopper ?? '-', min: reportData.discharge9_chopper_min1, max: reportData.discharge9_chopper_max1, avg: reportData.discharge9_chopper_avg1 },
              { label: 'Waktu (menit)', set: reportData.discharge9_recipe_time ?? '-', min: reportData.discharge9_waktu_min1, max: reportData.discharge9_waktu_max1, avg: reportData.discharge9_waktu_avg1 }
            ]} 
          />
          <ProcessTable 
            title="Discharge X (Lot 1)" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.discharge10_recipe_impeller ?? '-', min: reportData.discharge10_impeller_min1, max: reportData.discharge10_impeller_max1, avg: reportData.discharge10_impeller_avg1 },
              { label: 'Chopper (RPM)', set: reportData.discharge10_recipe_chopper ?? '-', min: reportData.discharge10_chopper_min1, max: reportData.discharge10_chopper_max1, avg: reportData.discharge10_chopper_avg1 },
              { label: 'Waktu (menit)', set: reportData.discharge10_recipe_time ?? '-', min: reportData.discharge10_waktu_min1, max: reportData.discharge10_waktu_max1, avg: reportData.discharge10_waktu_avg1 }
            ]} 
          />
          <ProcessTable 
            title="Discharge XI (Lot 1)" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.discharge11_recipe_impeller ?? '-', min: reportData.discharge11_impeller_min1, max: reportData.discharge11_impeller_max1, avg: reportData.discharge11_impeller_avg1 },
              { label: 'Chopper (RPM)', set: reportData.discharge11_recipe_chopper ?? '-', min: reportData.discharge11_chopper_min1, max: reportData.discharge11_chopper_max1, avg: reportData.discharge11_chopper_avg1 },
              { label: 'Waktu (menit)', set: reportData.discharge11_recipe_time ?? '-', min: reportData.discharge11_waktu_min1, max: reportData.discharge11_waktu_max1, avg: reportData.discharge11_waktu_avg1 }
            ]} 
          />
          <ProcessTable 
            title="Discharge XII (Lot 1)" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.discharge12_recipe_impeller ?? '-', min: reportData.discharge12_impeller_min1, max: reportData.discharge12_impeller_max1, avg: reportData.discharge12_impeller_avg1 },
              { label: 'Chopper (RPM)', set: reportData.discharge12_recipe_chopper ?? '-', min: reportData.discharge12_chopper_min1, max: reportData.discharge12_chopper_max1, avg: reportData.discharge12_chopper_avg1 },
              { label: 'Waktu (menit)', set: reportData.discharge12_recipe_time ?? '-', min: reportData.discharge12_waktu_min1, max: reportData.discharge12_waktu_max1, avg: reportData.discharge12_waktu_avg1 }
            ]} 
          />

          <h2 className="text-xl font-bold text-gray-800 border-b pb-2 mt-8 mb-4">LOADING (LOT 1)</h2>
<ProcessTable 
  title="Loading Parameters" 
  dataRows={[
    { label: 'Inlet temperature', set: reportData.loading_recipe_temp || '-', min: clean(reportData.loading_temp_min1), max: clean(reportData.loading_temp_max1), avg: clean(reportData.loading_temp_avg1) },
    { label: 'Air Flow', set: reportData.loading_recipe_flow || '-', min: clean(reportData.loading_flow_min1), max: clean(reportData.loading_flow_max1), avg: clean(reportData.loading_flow_avg1) },
    { label: 'Filter Clear Interval', set: reportData.loading_recipe_filter || '-', min: clean(reportData.loading_filter_min1), max: clean(reportData.loading_filter_max1), avg: clean(reportData.loading_filter_avg1) },
    { label: 'Number of Filter Shake', set: reportData.loading_recipe_filtershake || '-', min: clean(reportData.loading_filtershake_min1), max: clean(reportData.loading_filtershake_max1), avg: clean(reportData.loading_filtershake_avg1) },
    { label: 'Time', set: reportData.loading_recipe_time || '-', min: clean(reportData.loading_time_avg1), max: clean(reportData.loading_time_avg1), avg: clean(reportData.loading_time_avg1) },
    { label: '% Valve', set: reportData.loading_recipe_valve || '-', min: clean(reportData.loading_valve_min1), max: clean(reportData.loading_valve_max1), avg: clean(reportData.loading_valve_avg1) }
  ]} 
/>

          <h2 className="text-xl font-bold text-gray-800 border-b pb-2 mt-8 mb-4">DRYING (LOT 1)</h2>
<ProcessTable 
  title="Drying Parameters" 
  dataRows={[
    { label: 'Inlet temperature', set: reportData.drying_recipe_temp || '-', min: clean(reportData.drying_temp_min1), max: clean(reportData.drying_temp_max1), avg: clean(reportData.drying_temp_avg1) },
    { label: 'Air Flow', set: reportData.drying_recipe_flow || '-', min: clean(reportData.drying_airflow_min1), max: clean(reportData.drying_airflow_max1), avg: clean(reportData.drying_airflow_avg1) },
    { label: 'Filter Clear Interval', set: reportData.drying_recipe_filter || '-', min: clean(reportData.drying_filter_min1), max: clean(reportData.drying_filter_max1), avg: clean(reportData.drying_filter_avg1) },
    { label: 'Number of Filter Shake', set: reportData.drying_recipe_filtershake || '-', min: clean(reportData.drying_filtershake_min1), max: clean(reportData.drying_filtershake_max1), avg: clean(reportData.drying_filtershake_avg1) },
    { label: 'Waktu Pengeringan', set: reportData.drying_recipe_time || '-', min: reportData.drying_pengeringan_avg1, max: reportData.drying_pengeringan_avg1, avg: reportData.drying_pengeringan_avg1 },
    { label: 'Exhaust temperature', set: reportData.drying_recipe_exhaust || '-', min: '-', max: '-', avg: '-' }
  ]} 
/>

          <h2 className="text-xl font-bold text-gray-800 border-b pb-2 mt-8 mb-4">TRANSFER GRANUL KERING (LOT 1)</h2>
          <ProcessTable 
            title="Transfer Parameters" 
            dataRows={[
              { label: 'Start time', set: reportData.transfer_start_set1, min: reportData.transfer_start_min1, max: reportData.transfer_start_max1, avg: reportData.transfer_start_avg1 },
    { label: 'End time', set: reportData.transfer_end_set1, min: reportData.transfer_end_min1, max: reportData.transfer_end_max1, avg: reportData.transfer_end_avg1 },
    { label: 'Inlet Temperature', set: reportData.transfer_recipe_temp || '-', min: reportData.transfer_inlet_min1, max: reportData.transfer_inlet_max1, avg: reportData.transfer_inlet_avg1 },
    { label: 'Air Flow', set: reportData.transfer_recipe_flow || '-', min: reportData.transfer_flow_min1, max: reportData.transfer_flow_max1, avg: reportData.transfer_flow_avg1 }
  ]}
          />

          <h2 className="text-xl font-bold text-gray-800 border-b pb-2 mt-8 mb-4">PENGAYAKAN & FINAL MIXING (LOT 1)</h2>
          {/* Discharge I */}
<ProcessTable 
  title="Discharge I" 
  dataRows={[
    { label: 'Prod. Discharge valve position (%)', set: reportData.discharge_1_recipe_valve ?? '-', min: clean(reportData.finalmix_discharge1_min1), max: clean(reportData.finalmix_discharge1_max1), avg: clean(reportData.finalmix_discharge1_avg1) },
    { label: 'Speed (RPM)', set: reportData.discharge_1_recipe_speed ?? '-', min: clean(reportData.finalmix_speed1_min1), max: clean(reportData.finalmix_speed1_max1), avg: clean(reportData.finalmix_speed1_avg1) },
    { label: 'Waktu (minutes)', set: reportData.discharge_1_recipe_time ?? '-', min: reportData.finalmix_waktu1_min1, max: reportData.finalmix_waktu1_max1, avg: reportData.finalmix_waktu1_avg1 }
  ]} 
/>

{/* Discharge II */}
<ProcessTable 
  title="Discharge II" 
  dataRows={[
    { label: 'Prod. Discharge valve position (%)', set: reportData.discharge_2_recipe_valve ?? '-', min: clean(reportData.finalmix_discharge2_min1), max: clean(reportData.finalmix_discharge2_max1), avg: clean(reportData.finalmix_discharge2_avg1) },
    { label: 'Speed (RPM)', set: reportData.discharge_2_recipe_speed ?? '-', min: clean(reportData.finalmix_speed2_min1), max: clean(reportData.finalmix_speed2_max1), avg: clean(reportData.finalmix_speed2_avg1) },
    { label: 'Waktu (minutes)', set: reportData.discharge_2_recipe_time ?? '-', min: reportData.finalmix_waktu2_min1, max: reportData.finalmix_waktu2_max1, avg: reportData.finalmix_waktu2_avg1 }
  ]} 
/>

{/* Discharge III */}
<ProcessTable 
  title="Discharge III" 
  dataRows={[
    { label: 'Prod. Discharge valve position (%)', set: reportData.discharge_3_recipe_valve ?? '-', min: clean(reportData.finalmix_discharge3_min1), max: clean(reportData.finalmix_discharge3_max1), avg: clean(reportData.finalmix_discharge3_avg1) },
    { label: 'Speed (RPM)', set: reportData.discharge_3_recipe_speed ?? '-', min: clean(reportData.finalmix_speed3_min1), max: clean(reportData.finalmix_speed3_max1), avg: clean(reportData.finalmix_speed3_avg1) },
    { label: 'Waktu (minutes)', set: reportData.discharge_3_recipe_time ?? '-', min: reportData.finalmix_waktu3_min1, max: reportData.finalmix_waktu3_max1, avg: reportData.finalmix_waktu3_avg1 }
  ]} 
/>

          <h2 className="text-xl font-bold text-gray-800 border-b pb-2 mt-8 mb-4">MIXING (LOT 1)</h2>
          <ProcessTable 
  title="Mixing Parameters" 
  dataRows={[
    { 
      label: 'Waktu mixing', 
      set: '-', 
      min: clean(reportData.mixing_time_min1), 
      max: clean(reportData.mixing_time_max1), 
      avg: clean(reportData.mixing_time_avg1) 
    }
  ]} 
/>


        </div>
        

        
      )}

      {/* --- TAB CONTENT: LOT 2 --- */}
      {activeTab === 'lot2' && (
        <div className="space-y-6">

        {/* --- FRONT SECTIONS (LOT 2) --- */}
          <h2 className="text-xl font-bold text-gray-800 border-b pb-2 mt-4 mb-4">MONITORING RUANGAN (LOT 2)</h2>
          <ProcessTable 
            title="Suhu & RH" 
            dataRows={[
              { label: 'SUHU', set: reportData.suhu_set2, min: reportData.suhu_min2, max: reportData.suhu_max2, avg: reportData.suhu_avg2 },
              { label: 'RH', set: reportData.rh_set2, min: reportData.rh_min2, max: reportData.rh_max2, avg: reportData.rh_avg2 }
            ]} 
          />

          <h2 className="text-xl font-bold text-gray-800 border-b pb-2 mt-8 mb-4">BINDER SOLUTION (LOT 2)</h2>
          <ProcessTable 
            title="Speed & Waktu" 
            dataRows={[
              { label: 'Speed (RPM)', set: reportData.binder_speed_set2, min: reportData.binder_speed_min2, max: reportData.binder_speed_max2, avg: reportData.binder_speed_avg2 },
              { label: 'Waktu (menit)', set: reportData.binder_waktu_set2, min: reportData.binder_waktu_min2, max: reportData.binder_waktu_max2, avg: reportData.binder_waktu_avg2 }
            ]} 
          />

          <h2 className="text-xl font-bold text-gray-800 border-b pb-2 mt-8 mb-4">GRANULASI (LOT 2)</h2>
          
          <ProcessTable 
            title="Input Material I" 
            dataRows={[
              { label: 'Impeller loading speed (RPM)', set: reportData.input1_impeller_set2, min: reportData.input1_impeller_min2, max: reportData.input1_impeller_max2, avg: reportData.input1_impeller_avg2 },
              { label: 'Filter clear interval time (sec)', set: reportData.input1_filter_clear_set2, min: reportData.input1_filter_clear_min2, max: reportData.input1_filter_clear_max2, avg: reportData.input1_filter_clear_avg2 },
              { label: 'Waktu loading (menit)', set: '-', min: reportData.input1_waktu_min2, max: reportData.input1_waktu_max2, avg: reportData.input1_waktu_avg2 }
            ]} 
          />
          <ProcessTable 
            title="Mixing I" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.mix1_impeller_set2, min: reportData.mix1_impeller_min2, max: reportData.mix1_impeller_max2, avg: reportData.mix1_impeller_avg2 },
              { label: 'Chopper (RPM)', set: reportData.mix1_chopper_set2, min: reportData.mix1_chopper_min2, max: reportData.mix1_chopper_max2, avg: reportData.mix1_chopper_avg2 },
              { label: 'Waktu (menit)', set: reportData.mix1_waktu_set2, min: reportData.mix1_waktu_min2, max: reportData.mix1_waktu_max2, avg: reportData.mix1_waktu_avg2 }
            ]} 
          />
          <ProcessTable 
            title="Input Material II" 
            dataRows={[
              { label: 'Impeller loading speed (RPM)', set: reportData.input2_impeller_set2, min: reportData.input2_impeller_min2, max: reportData.input2_impeller_max2, avg: reportData.input2_impeller_avg2 },
              { label: 'Filter clear interval time (sec)', set: reportData.input2_filter_clear_set2, min: reportData.input2_filter_clear_min2, max: reportData.input2_filter_clear_max2, avg: reportData.input2_filter_clear_avg2 },
              { label: 'Waktu loading (menit)', set: '-', min: reportData.input2_waktu_min2, max: reportData.input2_waktu_max2, avg: reportData.input2_waktu_avg2 }
            ]} 
          />
          <ProcessTable 
            title="Mixing II" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.mix2_impeller_set2, min: reportData.mix2_impeller_min2, max: reportData.mix2_impeller_max2, avg: reportData.mix2_impeller_avg2 },
              { label: 'Chopper (RPM)', set: reportData.mix2_chopper_set2, min: reportData.mix2_chopper_min2, max: reportData.mix2_chopper_max2, avg: reportData.mix2_chopper_avg2 },
              { label: 'Waktu (menit)', set: reportData.mix2_waktu_set2, min: reportData.mix2_waktu_min2, max: reportData.mix2_waktu_max2, avg: reportData.mix2_waktu_avg2 }
            ]} 
          />
          <ProcessTable 
            title="Mixing III" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.mix3_impeller_set2, min: reportData.mix3_impeller_min2, max: reportData.mix3_impeller_max2, avg: reportData.mix3_impeller_avg2 },
              { label: 'Chopper (RPM)', set: reportData.mix3_chopper_set2, min: reportData.mix3_chopper_min2, max: reportData.mix3_chopper_max2, avg: reportData.mix3_chopper_avg2 },
              { label: 'Waktu (menit)', set: reportData.mix3_waktu_set2, min: reportData.mix3_waktu_min2, max: reportData.mix3_waktu_max2, avg: reportData.mix3_waktu_avg2 }
            ]} 
          />
          <ProcessTable 
            title="Mixing IV" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.mix4_impeller_set2, min: reportData.mix4_impeller_min2, max: reportData.mix4_impeller_max2, avg: reportData.mix4_impeller_avg2 },
              { label: 'Chopper (RPM)', set: reportData.mix4_chopper_set2, min: reportData.mix4_chopper_min2, max: reportData.mix4_chopper_max2, avg: reportData.mix4_chopper_avg2 },
              { label: 'Waktu (menit)', set: reportData.mix4_waktu_set2, min: reportData.mix4_waktu_min2, max: reportData.mix4_waktu_max2, avg: reportData.mix4_waktu_avg2 }
            ]} 
          />

          <h2 className="text-xl font-bold text-gray-800 border-b pb-2">TRANSFER GRANUL BASAH (LOT 2)</h2>
          
          <ProcessTable 
            title="Discharge I (Lot 2)" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.discharge1_impeller_set2, min: reportData.discharge1_impeller_min2, max: reportData.discharge1_impeller_max2, avg: reportData.discharge1_impeller_avg2 },
              { label: 'Chopper (RPM)', set: reportData.discharge1_chopper_set2, min: reportData.discharge1_chopper_min2, max: reportData.discharge1_chopper_max2, avg: reportData.discharge1_chopper_avg2 },
              { label: 'Waktu (menit)', set: null, min: reportData.discharge1_waktu_min2, max: reportData.discharge1_waktu_max2, avg: reportData.discharge1_waktu_avg2 }
            ]} 
          />
          <ProcessTable 
            title="Discharge II (Lot 2)" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.discharge2_impeller_set2, min: reportData.discharge2_impeller_min2, max: reportData.discharge2_impeller_max2, avg: reportData.discharge2_impeller_avg2 },
              { label: 'Chopper (RPM)', set: reportData.discharge2_chopper_set2, min: reportData.discharge2_chopper_min2, max: reportData.discharge2_chopper_max2, avg: reportData.discharge2_chopper_avg2 },
              { label: 'Waktu (menit)', set: null, min: reportData.discharge2_waktu_min2, max: reportData.discharge2_waktu_max2, avg: reportData.discharge2_waktu_avg2 }
            ]} 
          />
          <ProcessTable 
            title="Discharge III (Lot 2)" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.discharge3_impeller_set2, min: reportData.discharge3_impeller_min2, max: reportData.discharge3_impeller_max2, avg: reportData.discharge3_impeller_avg2 },
              { label: 'Chopper (RPM)', set: reportData.discharge3_chopper_set2, min: reportData.discharge3_chopper_min2, max: reportData.discharge3_chopper_max2, avg: reportData.discharge3_chopper_avg2 },
              { label: 'Waktu (menit)', set: null, min: reportData.discharge3_waktu_min2, max: reportData.discharge3_waktu_max2, avg: reportData.discharge3_waktu_avg2 }
            ]} 
          />
          <ProcessTable 
            title="Discharge IV (Lot 2)" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.discharge4_impeller_set2, min: reportData.discharge4_impeller_min2, max: reportData.discharge4_impeller_max2, avg: reportData.discharge4_impeller_avg2 },
              { label: 'Chopper (RPM)', set: reportData.discharge4_chopper_set2, min: reportData.discharge4_chopper_min2, max: reportData.discharge4_chopper_max2, avg: reportData.discharge4_chopper_avg2 },
              { label: 'Waktu (menit)', set: null, min: reportData.discharge4_waktu_min2, max: reportData.discharge4_waktu_max2, avg: reportData.discharge4_waktu_avg2 }
            ]} 
          />
          <ProcessTable 
            title="Discharge V (Lot 2)" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.discharge5_impeller_set2, min: reportData.discharge5_impeller_min2, max: reportData.discharge5_impeller_max2, avg: reportData.discharge5_impeller_avg2 },
              { label: 'Chopper (RPM)', set: reportData.discharge5_chopper_set2, min: reportData.discharge5_chopper_min2, max: reportData.discharge5_chopper_max2, avg: reportData.discharge5_chopper_avg2 },
              { label: 'Waktu (menit)', set: null, min: reportData.discharge5_waktu_min2, max: reportData.discharge5_waktu_max2, avg: reportData.discharge5_waktu_avg2 }
            ]} 
          />
          <ProcessTable 
            title="Discharge VI (Lot 2)" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.discharge6_impeller_set2, min: reportData.discharge6_impeller_min2, max: reportData.discharge6_impeller_max2, avg: reportData.discharge6_impeller_avg2 },
              { label: 'Chopper (RPM)', set: reportData.discharge6_chopper_set2, min: reportData.discharge6_chopper_min2, max: reportData.discharge6_chopper_max2, avg: reportData.discharge6_chopper_avg2 },
              { label: 'Waktu (menit)', set: null, min: reportData.discharge6_waktu_min2, max: reportData.discharge6_waktu_max2, avg: reportData.discharge6_waktu_avg2 }
            ]} 
          />
          <ProcessTable 
            title="Discharge VII (Lot 2)" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.discharge7_impeller_set2, min: reportData.discharge7_impeller_min2, max: reportData.discharge7_impeller_max2, avg: reportData.discharge7_impeller_avg2 },
              { label: 'Chopper (RPM)', set: reportData.discharge7_chopper_set2, min: reportData.discharge7_chopper_min2, max: reportData.discharge7_chopper_max2, avg: reportData.discharge7_chopper_avg2 },
              { label: 'Waktu (menit)', set: null, min: reportData.discharge7_waktu_min2, max: reportData.discharge7_waktu_max2, avg: reportData.discharge7_waktu_avg2 }
            ]} 
          />
          <ProcessTable 
            title="Discharge VIII (Lot 2)" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.discharge8_impeller_set2, min: reportData.discharge8_impeller_min2, max: reportData.discharge8_impeller_max2, avg: reportData.discharge8_impeller_avg2 },
              { label: 'Chopper (RPM)', set: reportData.discharge8_chopper_set2, min: reportData.discharge8_chopper_min2, max: reportData.discharge8_chopper_max2, avg: reportData.discharge8_chopper_avg2 },
              { label: 'Waktu (menit)', set: null, min: reportData.discharge8_waktu_min2, max: reportData.discharge8_waktu_max2, avg: reportData.discharge8_waktu_avg2 }
            ]} 
          />
          <ProcessTable 
            title="Discharge IX (Lot 2)" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.discharge9_impeller_set2, min: reportData.discharge9_impeller_min2, max: reportData.discharge9_impeller_max2, avg: reportData.discharge9_impeller_avg2 },
              { label: 'Chopper (RPM)', set: reportData.discharge9_chopper_set2, min: reportData.discharge9_chopper_min2, max: reportData.discharge9_chopper_max2, avg: reportData.discharge9_chopper_avg2 },
              { label: 'Waktu (menit)', set: null, min: reportData.discharge9_waktu_min2, max: reportData.discharge9_waktu_max2, avg: reportData.discharge9_waktu_avg2 }
            ]} 
          />
          <ProcessTable 
            title="Discharge X (Lot 2)" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.discharge10_impeller_set2, min: reportData.discharge10_impeller_min2, max: reportData.discharge10_impeller_max2, avg: reportData.discharge10_impeller_avg2 },
              { label: 'Chopper (RPM)', set: reportData.discharge10_chopper_set2, min: reportData.discharge10_chopper_min2, max: reportData.discharge10_chopper_max2, avg: reportData.discharge10_chopper_avg2 },
              { label: 'Waktu (menit)', set: null, min: reportData.discharge10_waktu_min2, max: reportData.discharge10_waktu_max2, avg: reportData.discharge10_waktu_avg2 }
            ]} 
          />
          <ProcessTable 
            title="Discharge XI (Lot 2)" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.discharge11_impeller_set2, min: reportData.discharge11_impeller_min2, max: reportData.discharge11_impeller_max2, avg: reportData.discharge11_impeller_avg2 },
              { label: 'Chopper (RPM)', set: reportData.discharge11_chopper_set2, min: reportData.discharge11_chopper_min2, max: reportData.discharge11_chopper_max2, avg: reportData.discharge11_chopper_avg2 },
              { label: 'Waktu (menit)', set: null, min: reportData.discharge11_waktu_min2, max: reportData.discharge11_waktu_max2, avg: reportData.discharge11_waktu_avg2 }
            ]} 
          />
          <ProcessTable 
            title="Discharge XII (Lot 2)" 
            dataRows={[
              { label: 'Impeller (RPM)', set: reportData.discharge12_impeller_set2, min: reportData.discharge12_impeller_min2, max: reportData.discharge12_impeller_max2, avg: reportData.discharge12_impeller_avg2 },
              { label: 'Chopper (RPM)', set: reportData.discharge12_chopper_set2, min: reportData.discharge12_chopper_min2, max: reportData.discharge12_chopper_max2, avg: reportData.discharge12_chopper_avg2 },
              { label: 'Waktu (menit)', set: null, min: reportData.discharge12_waktu_min2, max: reportData.discharge12_waktu_max2, avg: reportData.discharge12_waktu_avg2 }
            ]} 
          />
          <h2 className="text-xl font-bold text-gray-800 border-b pb-2 mt-8 mb-4">LOADING (LOT 2)</h2>
          <ProcessTable 
            title="Loading Parameters" 
            dataRows={[
              { label: 'Inlet temperature', set: reportData.loading_temp_set2, min: reportData.loading_temp_min2, max: reportData.loading_temp_max2, avg: reportData.loading_temp_avg2 },
              { label: 'Air Flow', set: reportData.loading_flow_set2, min: reportData.loading_flow_min2, max: reportData.loading_flow_max2, avg: reportData.loading_flow_avg2 },
              { label: 'Filter Clear Interval', set: reportData.loading_filter_set2, min: reportData.loading_filter_min2, max: reportData.loading_filter_max2, avg: reportData.loading_filter_avg2 },
              { label: 'Number of Filter Shake', set: reportData.loading_filtershake_set2, min: reportData.loading_filtershake_min2, max: reportData.loading_filtershake_max2, avg: reportData.loading_filtershake_avg2 },
              { label: 'Bed Jogging', set: reportData.loading_bed_set2, min: reportData.loading_bed_min2, max: reportData.loading_bed_max2, avg: reportData.loading_bed_avg2 },
               { label: '% Valve', set: reportData.loading_valve_set2, min: reportData.loading_valve_min2, max: reportData.loading_valve_max2, avg: reportData.loading_valve_avg2 },
              { label: 'Time', set: reportData.loading_time_set2, min: reportData.loading_time_min2, max: reportData.loading_time_max2, avg: reportData.loading_time_avg2 }
            ]} 
          />


          <h2 className="text-xl font-bold text-gray-800 border-b pb-2 mt-8 mb-4">DRYING (LOT 2)</h2>
          <ProcessTable 
            title="Drying Parameters" 
            dataRows={[
              { label: 'Inlet temperature', set: reportData.drying_temp_set2, min: reportData.drying_temp_min2, max: reportData.drying_temp_max2, avg: reportData.drying_temp_avg2 },
              { label: 'Air Flow', set: reportData.drying_airflow_set2, min: reportData.drying_airflow_min2, max: reportData.drying_airflow_max2, avg: reportData.drying_airflow_avg2 },
              { label: 'Filter Clear Interval', set: reportData.drying_filter_set2, min: reportData.drying_filter_min2, max: reportData.drying_filter_max2, avg: reportData.drying_filter_avg2 },
              { label: 'Number of Filter Shake', set: reportData.drying_filtershake_set2, min: reportData.drying_filtershake_min2, max: reportData.drying_filtershake_max2, avg: reportData.drying_filter_avg2 },
              { label: 'Waktu Pengeringan', set: reportData.drying_pengeringan_set2, min: reportData.drying_pengeringan_min2, max: reportData.drying_pengeringan_max2, avg: reportData.drying_pengeringan_avg2 },
              { label: 'Exhaust temperature', set: reportData.drying_exhaust_set2, min: reportData.drying_exhaust_min2, max: reportData.drying_exhaust_max2, avg: reportData.drying_exhaust_avg2 }
            ]} 
          />

          <h2 className="text-xl font-bold text-gray-800 border-b pb-2 mt-8 mb-4">TRANSFER GRANUL KERING (LOT 2)</h2>
          <ProcessTable 
            title="Transfer Parameters" 
            dataRows={[
              { label: 'Start time', set: reportData.transfer_start_set2, min: reportData.transfer_start_min2, max: reportData.transfer_start_max2, avg: reportData.transfer_start_avg2 },
              { label: 'End time', set: reportData.transfer_end_set2, min: reportData.transfer_end_min2, max: reportData.transfer_end_max2, avg: reportData.transfer_end_avg2 },
              { label: 'Inlet Temperature', set: reportData.transfer_inlet_set2, min: reportData.transfer_inlet_min2, max: reportData.transfer_inlet_max2, avg: reportData.transfer_inlet_avg2 },
              { label: 'Air Flow', set: reportData.transfer_flow_set2, min: reportData.transfer_flow_min2, max: reportData.transfer_flow_max2, avg: reportData.transfer_flow_avg2 }
            ]} 
          />

          <h2 className="text-xl font-bold text-gray-800 border-b pb-2 mt-8 mb-4">PENGAYAKAN & FINAL MIXING (LOT 2)</h2>
          <ProcessTable 
            title="Discharge I" 
            dataRows={[
              { label: 'Prod. Discharge valve position (%)', set: reportData.finalmix_discharge1_set2, min: reportData.finalmix_discharge1_min2, max: reportData.finalmix_discharge1_max2, avg: reportData.finalmix_discharge1_avg2 },
              { label: 'Speed (RPM)', set: reportData.finalmix_speed1_set2, min: reportData.finalmix_speed1_min2, max: reportData.finalmix_speed1_max2, avg: reportData.finalmix_speed1_avg2 },
              { label: 'Waktu (minutes)', set: null, min: reportData.finalmix_waktu1_min2, max: reportData.finalmix_waktu1_max2, avg: reportData.finalmix_waktu1_avg2 }
            ]} 
          />
          <ProcessTable 
            title="Discharge II" 
            dataRows={[
              { label: 'Prod. Discharge valve position (%)', set: reportData.finalmix_discharge2_set2, min: reportData.finalmix_discharge2_min2, max: reportData.finalmix_discharge2_max2, avg: reportData.finalmix_discharge2_avg2 },
              { label: 'Speed (RPM)', set: reportData.finalmix_speed2_set2, min: reportData.finalmix_speed2_min2, max: reportData.finalmix_speed2_max2, avg: reportData.finalmix_speed2_avg2 },
              { label: 'Waktu (minutes)', set: null, min: reportData.finalmix_waktu2_min2, max: reportData.finalmix_waktu2_max2, avg: reportData.finalmix_waktu2_avg2 }
            ]} 
          />
          <ProcessTable 
            title="Discharge III" 
            dataRows={[
              { label: 'Prod. Discharge valve position (%)', set: reportData.finalmix_discharge3_set2, min: reportData.finalmix_discharge3_min2, max: reportData.finalmix_discharge3_max2, avg: reportData.finalmix_discharge3_avg2 },
              { label: 'Speed (RPM)', set: reportData.finalmix_speed3_set2, min: reportData.finalmix_speed3_min2, max: reportData.finalmix_speed3_max2, avg: reportData.finalmix_speed3_avg2 },
              { label: 'Waktu (minutes)', set: null, min: reportData.finalmix_waktu3_min2, max: reportData.finalmix_waktu3_max2, avg: reportData.finalmix_waktu3_avg2 }
            ]} 
          />

          <h2 className="text-xl font-bold text-gray-800 border-b pb-2 mt-8 mb-4">MIXING (LOT 2)</h2>
          <ProcessTable 
            title="Mixing Parameters" 
            dataRows={[
              { label: 'Waktu mixing', set: null, min: reportData.mixing_waktu_min2, max: reportData.mixing_waktu_max2, avg: reportData.mixing_waktu_avg2 }
            ]} 
          />
          
        </div>
      )}
    </div>
  );
};

export default BatchReportPreview;