import React, { useState, useEffect } from 'react';
import { Download, Search } from 'lucide-react';

// Mock API function to simulate data fetching
const fetchFormData = async (id) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Mock data based on the work order form
  const mockData = {
    'PWO-296235': {
      wrwoNumber: 'PWO-296235',
      wrwoNumberPM: 'PM',
      startDate: '2025-11-30',
      completeDate: '2025-11-30',
      woDescription: 'Perawatan Bulanan Chopper GEA PMA',
      requestorApproved: '',
      changeControlData: '',
      woType: 'Preventive',
      woStatus: 'Released',
      activityType: 'Maintenance',
      activityCause: 'Preventive',
      assetNumber: 'CKR-02-03-010-010-020',
      assetArea: 'ILE3',
      glCharging: 'ILE3-321',
      assetActivity: 'Chopper PMA',
      supervisorNotes: '',
      operations: [
        { id: 10, description: 'Periksa tekanan air seal chopper, standar 0.5bar', resources: 'MTC', executedBy: '', actualStart: '/', techniciansNotes: '' },
        { id: 20, description: 'Cleaning pre filter water chiller chopper', resources: 'MTC', executedBy: '', actualStart: '/', techniciansNotes: '' },
        { id: 30, description: 'Setelah pencucian, periksa seal chopper terhadap kebocoran', resources: 'MTC', executedBy: '', actualStart: '/', techniciansNotes: '' },
        { id: 40, description: 'Periksa seal chopper, bersihkan semua kotoran dan sisa produk yang menempel pada permukaan seal, ganti jika diperlukan', resources: 'MTC', executedBy: '', actualStart: '/', techniciansNotes: '' },
        { id: 50, description: 'Periksa apakah terdapat air atau debu sisa produk pada seal chopper', resources: 'MTC', executedBy: '', actualStart: '/', techniciansNotes: '' },
        { id: 60, description: 'Cek motor chopper (koneksi & tahanan)', resources: 'MTC', executedBy: '', actualStart: '/', techniciansNotes: '' }
      ],
      failureAnalysis: '',
      failureDescription: '',
      reportCause: '',
      rootCause: '',
      resolution: '',
      recordedBy: ''
    },
    'PWO-296236': {
      wrwoNumber: 'PWO-296236',
      wrwoNumberPM: 'PM',
      startDate: '2025-12-01',
      completeDate: '2025-12-01',
      woDescription: 'Inspeksi Rutin Sistem Pompa',
      requestorApproved: '',
      changeControlData: '',
      woType: 'Preventive',
      woStatus: 'Planning',
      activityType: 'Inspection',
      activityCause: 'Preventive',
      assetNumber: 'PMP-01-02-005-020-015',
      assetArea: 'ILE2',
      glCharging: 'ILE2-210',
      assetActivity: 'Pump Inspection',
      supervisorNotes: '',
      operations: [
        { id: 10, description: 'Periksa kondisi pompa dan bearing', resources: 'MTC', executedBy: '', actualStart: '/', techniciansNotes: '' },
        { id: 20, description: 'Cek kebocoran seal pompa', resources: 'MTC', executedBy: '', actualStart: '/', techniciansNotes: '' },
        { id: 30, description: 'Periksa tekanan discharge pompa', resources: 'MTC', executedBy: '', actualStart: '/', techniciansNotes: '' }
      ],
      failureAnalysis: '',
      failureDescription: '',
      reportCause: '',
      rootCause: '',
      resolution: '',
      recordedBy: ''
    },
    'PWO-296237': {
      wrwoNumber: 'PWO-296237',
      wrwoNumberPM: 'PM',
      startDate: '2025-12-05',
      completeDate: '2025-12-05',
      woDescription: 'Kalibrasi Temperature Sensor',
      requestorApproved: '',
      changeControlData: '',
      woType: 'Preventive',
      woStatus: 'Released',
      activityType: 'Maintenance',
      activityCause: 'Preventive',
      assetNumber: 'SEN-03-01-020-015-010',
      assetArea: 'ILE1',
      glCharging: 'ILE1-150',
      assetActivity: 'Sensor Calibration',
      supervisorNotes: '',
      operations: [
        { id: 10, description: 'Verifikasi sensor temperature dengan standard', resources: 'MTC', executedBy: '', actualStart: '/', techniciansNotes: '' },
        { id: 20, description: 'Lakukan kalibrasi jika diperlukan', resources: 'MTC', executedBy: '', actualStart: '/', techniciansNotes: '' }
      ],
      failureAnalysis: '',
      failureDescription: '',
      reportCause: '',
      rootCause: '',
      resolution: '',
      recordedBy: ''
    }
  };
  
  return mockData[id] || null;
};

// Function to get suggestions based on input
const getWOSuggestions = (input) => {
  const allWOs = ['PWO-296235', 'PWO-296236', 'PWO-296237'];
  if (!input) return [];
  return allWOs.filter(wo => wo.toLowerCase().includes(input.toLowerCase()));
};

const ServiceRequestForm = () => {
  const [formData, setFormData] = useState({
    wrwoNumber: '',
    wrwoNumberPM: 'PM',
    startDate: '',
    completeDate: '',
    woDescription: '',
    requestorApproved: '',
    changeControlData: '',
    woType: 'Preventive',
    woStatus: 'Released',
    activityType: 'Maintenance',
    activityCause: 'Preventive',
    assetNumber: '',
    assetArea: '',
    glCharging: '',
    assetActivity: '',
    supervisorNotes: '',
    operations: [],
    failureAnalysis: '',
    failureDescription: '',
    reportCause: '',
    rootCause: '',
    resolution: '',
    recordedBy: ''
  });

  const [woInput, setWoInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (woInput.length > 0) {
      const filtered = getWOSuggestions(woInput);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [woInput]);

  const loadData = async (woNumber) => {
    setLoading(true);
    setShowSuggestions(false);

    try {
      const data = await fetchFormData(woNumber);
      if (data) {
        setFormData(data);
        setWoInput(woNumber);
      }
    } catch (error) {
      console.error('Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const handleWoInputChange = (e) => {
    const value = e.target.value;
    setWoInput(value);
    
    // Auto-load if exact match found
    if (value.length >= 10) {
      const exactMatch = getWOSuggestions(value).find(wo => wo === value);
      if (exactMatch) {
        loadData(exactMatch);
      }
    }
  };

  const handleSuggestionClick = (suggestion) => {
    loadData(suggestion);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleOperationChange = (index, field, value) => {
    const newOps = [...formData.operations];
    newOps[index] = { ...newOps[index], [field]: value };
    setFormData(prev => ({ ...prev, operations: newOps }));
  };

  const addOperation = () => {
    setFormData(prev => ({
      ...prev,
      operations: [...prev.operations, { 
        id: (prev.operations.length + 1) * 10, 
        description: '', 
        resources: 'MTC',
        executedBy: '',
        actualStart: '/',
        techniciansNotes: ''
      }]
    }));
  };

  const removeOperation = (index) => {
    setFormData(prev => ({
      ...prev,
      operations: prev.operations.filter((_, i) => i !== index)
    }));
  };

  const exportToPDF = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 py-8 px-4">
      {/* Search Bar - Hidden in print */}
      <div className="max-w-[1200px] mx-auto mb-6 print:hidden">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="relative">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={woInput}
                  onChange={handleWoInputChange}
                  onFocus={() => woInput && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Enter WO Number (e.g., PWO-296235)"
                  className="w-full px-4 py-3 pr-10 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:outline-none text-lg"
                  disabled={loading}
                />
                <Search className="absolute right-3 top-3.5 text-gray-400" size={24} />
                
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border-2 border-blue-400 rounded-lg shadow-xl">
                    {suggestions.map((suggestion, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 text-gray-800 font-medium"
                      >
                        {suggestion}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={exportToPDF}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-md"
              >
                <Download size={20} />
                Export PDF
              </button>
            </div>
            {loading && (
              <div className="mt-2 text-gray-600 text-sm">Loading data...</div>
            )}
          </div>
        </div>
      </div>

      {/* Form Content - Styled like original document with outer border */}
      <div className="max-w-[1200px] mx-auto">
        <div id="printable-form" className="bg-white shadow-2xl border-4 border-gray-800 print:border-2 print:shadow-none">
          <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-start mb-4 pb-3 border-b-2 border-black">
              <div>
                <div className="text-lg font-bold">PT. SAKA FARMA</div>
                <div className="text-sm">LABORATORIES</div>
                <div className="text-xs">A Kalbe Company</div>
              </div>
              <div className="text-2xl font-bold text-center flex-1">WORK ORDER FORM</div>
              <div className="text-[10px] text-right leading-tight">
                <div>Page : Page 1 of 1</div>
                <div>Printed Date : {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit', second: '2-digit'})}</div>
                <div>User : JIYAN.SALSABILA - SFL-OU</div>
              </div>
            </div>

            {/* Top Section */}
            <div className="grid grid-cols-12 gap-1 mb-2">
              <div className="col-span-2 border border-black p-1.5">
                <div className="text-[9px] mb-0.5">WR/WO Number</div>
                <div className="flex gap-1 items-center">
                  <input
                    type="text"
                    name="wrwoNumberPM"
                    value={formData.wrwoNumberPM}
                    onChange={handleInputChange}
                    className="w-8 text-xs border-b border-gray-400 focus:outline-none focus:border-black focus:bg-yellow-50"
                  />
                  <span className="text-xs">/</span>
                  <input
                    type="text"
                    name="wrwoNumber"
                    value={formData.wrwoNumber}
                    onChange={handleInputChange}
                    className="flex-1 text-xs border-b border-gray-400 focus:outline-none focus:border-black focus:bg-yellow-50"
                  />
                </div>
              </div>
              <div className="col-span-2 border border-black p-1.5">
                <div className="text-[9px] mb-0.5">WR/WO Start Date Target</div>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  className="w-full text-xs border-b border-gray-400 focus:outline-none focus:border-black focus:bg-yellow-50"
                />
              </div>
              <div className="col-span-4 border border-black p-1.5 row-span-2">
                <div className="text-[9px] mb-0.5">WO Description</div>
                <textarea
                  name="woDescription"
                  value={formData.woDescription}
                  onChange={handleInputChange}
                  rows="3"
                  className="w-full text-xs border border-gray-300 p-1 focus:outline-none focus:border-black focus:bg-yellow-50 resize-none"
                />
              </div>
              <div className="col-span-4 border border-black p-1.5 row-span-2">
                <div className="text-[9px] mb-0.5">Change Control Data</div>
                <textarea
                  name="changeControlData"
                  value={formData.changeControlData}
                  onChange={handleInputChange}
                  rows="3"
                  className="w-full text-xs border border-gray-300 p-1 focus:outline-none focus:border-black focus:bg-yellow-50 resize-none"
                />
              </div>
              <div className="col-span-2 border border-black p-1.5">
                <div className="text-[9px] mb-0.5">WR/WO Complete Date Target</div>
                <input
                  type="date"
                  name="completeDate"
                  value={formData.completeDate}
                  onChange={handleInputChange}
                  className="w-full text-xs border-b border-gray-400 focus:outline-none focus:border-black focus:bg-yellow-50"
                />
              </div>
              <div className="col-span-2 border border-black p-1.5">
                <div className="text-[9px] mb-0.5">WR Requestor / Approved by</div>
                <input
                  type="text"
                  name="requestorApproved"
                  value={formData.requestorApproved}
                  onChange={handleInputChange}
                  className="w-full text-xs border-b border-gray-400 focus:outline-none focus:border-black focus:bg-yellow-50"
                />
              </div>
            </div>

            {/* Middle Section - Asset Details */}
            <div className="grid grid-cols-12 gap-1 mb-2">
              <div className="col-span-2 border border-black p-1.5">
                <div className="text-[9px] mb-0.5">WO Type</div>
                <select
                  name="woType"
                  value={formData.woType}
                  onChange={handleInputChange}
                  className="w-full text-xs border-b border-gray-400 focus:outline-none focus:border-black focus:bg-yellow-50 bg-white"
                >
                  <option>Preventive</option>
                  <option>Corrective</option>
                  <option>Maintenance</option>
                </select>
              </div>
              <div className="col-span-3 border border-black p-1.5">
                <div className="text-[9px] mb-0.5">Asset Number</div>
                <input
                  type="text"
                  name="assetNumber"
                  value={formData.assetNumber}
                  onChange={handleInputChange}
                  className="w-full text-xs border-b border-gray-400 focus:outline-none focus:border-black focus:bg-yellow-50"
                />
              </div>
              <div className="col-span-7 border border-black p-1.5 row-span-2">
                <div className="text-[9px] mb-0.5">Supervisor Notes</div>
                <textarea
                  name="supervisorNotes"
                  value={formData.supervisorNotes}
                  onChange={handleInputChange}
                  rows="3"
                  className="w-full text-xs border border-gray-300 p-1 focus:outline-none focus:border-black focus:bg-yellow-50 resize-none"
                />
              </div>
              <div className="col-span-2 border border-black p-1.5">
                <div className="text-[9px] mb-0.5">WO Status</div>
                <select
                  name="woStatus"
                  value={formData.woStatus}
                  onChange={handleInputChange}
                  className="w-full text-xs border-b border-gray-400 focus:outline-none focus:border-black focus:bg-yellow-50 bg-white"
                >
                  <option>Released</option>
                  <option>Planning</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                </select>
              </div>
              <div className="col-span-3 border border-black p-1.5">
                <div className="text-[9px] mb-0.5">Asset Area</div>
                <input
                  type="text"
                  name="assetArea"
                  value={formData.assetArea}
                  onChange={handleInputChange}
                  className="w-full text-xs border-b border-gray-400 focus:outline-none focus:border-black focus:bg-yellow-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-12 gap-1 mb-2">
              <div className="col-span-2 border border-black p-1.5">
                <div className="text-[9px] mb-0.5">Activity Type</div>
                <select
                  name="activityType"
                  value={formData.activityType}
                  onChange={handleInputChange}
                  className="w-full text-xs border-b border-gray-400 focus:outline-none focus:border-black focus:bg-yellow-50 bg-white"
                >
                  <option>Maintenance</option>
                  <option>Inspection</option>
                  <option>Repair</option>
                </select>
              </div>
              <div className="col-span-2 border border-black p-1.5">
                <div className="text-[9px] mb-0.5">GL Charging</div>
                <input
                  type="text"
                  name="glCharging"
                  value={formData.glCharging}
                  onChange={handleInputChange}
                  className="w-full text-xs border-b border-gray-400 focus:outline-none focus:border-black focus:bg-yellow-50"
                />
              </div>
              <div className="col-span-2 border border-black p-1.5">
                <div className="text-[9px] mb-0.5">Activity Cause</div>
                <select
                  name="activityCause"
                  value={formData.activityCause}
                  onChange={handleInputChange}
                  className="w-full text-xs border-b border-gray-400 focus:outline-none focus:border-black focus:bg-yellow-50 bg-white"
                >
                  <option>Preventive</option>
                  <option>Breakdown</option>
                  <option>Scheduled</option>
                </select>
              </div>
              <div className="col-span-3 border border-black p-1.5">
                <div className="text-[9px] mb-0.5">Asset Activity</div>
                <input
                  type="text"
                  name="assetActivity"
                  value={formData.assetActivity}
                  onChange={handleInputChange}
                  className="w-full text-xs border-b border-gray-400 focus:outline-none focus:border-black focus:bg-yellow-50"
                />
              </div>
            </div>

            {/* Operations Table */}
            <div className="mb-2">
              <table className="w-full border-collapse border border-black">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-black p-1 text-[9px] text-left font-semibold" style={{width: '40px'}}>Operation</th>
                    <th className="border border-black p-1 text-[9px] text-left font-semibold">Description</th>
                    <th className="border border-black p-1 text-[9px] text-left font-semibold" style={{width: '60px'}}>Resources</th>
                    <th className="border border-black p-1 text-[9px] text-left font-semibold" style={{width: '80px'}}>Executed by Technician</th>
                    <th className="border border-black p-1 text-[9px] text-left font-semibold" style={{width: '80px'}}>Actual Start / Complete</th>
                    <th className="border border-black p-1 text-[9px] text-left font-semibold" style={{width: '120px'}}>Technician's Notes</th>
                    <th className="border border-black p-1 text-[9px] print:hidden" style={{width: '40px'}}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.operations.map((op, idx) => (
                    <tr key={idx}>
                      <td className="border border-black p-0.5">
                        <input
                          type="text"
                          value={op.id}
                          onChange={(e) => handleOperationChange(idx, 'id', e.target.value)}
                          className="w-full px-1 text-[10px] focus:outline-none focus:bg-yellow-50"
                        />
                      </td>
                      <td className="border border-black p-0.5">
                        <textarea
                          value={op.description}
                          onChange={(e) => handleOperationChange(idx, 'description', e.target.value)}
                          className="w-full px-1 text-[10px] focus:outline-none focus:bg-yellow-50 resize-none leading-tight"
                          rows="2"
                        />
                      </td>
                      <td className="border border-black p-0.5">
                        <input
                          type="text"
                          value={op.resources}
                          onChange={(e) => handleOperationChange(idx, 'resources', e.target.value)}
                          className="w-full px-1 text-[10px] focus:outline-none focus:bg-yellow-50"
                        />
                      </td>
                      <td className="border border-black p-0.5">
                        <input
                          type="text"
                          value={op.executedBy}
                          onChange={(e) => handleOperationChange(idx, 'executedBy', e.target.value)}
                          className="w-full px-1 text-[10px] focus:outline-none focus:bg-yellow-50"
                        />
                      </td>
                      <td className="border border-black p-0.5">
                        <input
                          type="text"
                          value={op.actualStart}
                          onChange={(e) => handleOperationChange(idx, 'actualStart', e.target.value)}
                          className="w-full px-1 text-[10px] focus:outline-none focus:bg-yellow-50"
                        />
                      </td>
                      <td className="border border-black p-0.5">
                        <textarea
                          value={op.techniciansNotes}
                          onChange={(e) => handleOperationChange(idx, 'techniciansNotes', e.target.value)}
                          className="w-full px-1 text-[10px] focus:outline-none focus:bg-yellow-50 resize-none leading-tight"
                          rows="2"
                        />
                      </td>
                      <td className="border border-black p-0.5 text-center print:hidden">
                        <button
                          onClick={() => removeOperation(idx)}
                          className="text-red-600 hover:text-red-800 text-xs px-1"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                onClick={addOperation}
                className="mt-2 px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 print:hidden"
              >
                + Add Operation
              </button>
            </div>

            {/* Inventory and Failure Analysis Section */}
            <div className="mb-2">
              <table className="w-full border-collapse border border-black">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-black p-1 text-[9px] text-left font-semibold" style={{width: '200px'}}>Inventory Part -- Direct Purchase</th>
                    <th className="border border-black p-1 text-[9px] text-left font-semibold" style={{width: '50px'}}>Qty</th>
                    <th className="border border-black p-1 text-[9px] text-left font-semibold" style={{width: '50px'}}>Unit</th>
                    <th className="border border-black p-1 text-[9px] text-left font-semibold" style={{width: '70px'}}>Issued</th>
                    <th className="border border-black p-1 text-[9px] text-left font-semibold" colSpan="2">Failure Analysis (by Supervisor and Technician):</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-black p-1 text-[9px]" colSpan="4">
                      <div className="flex items-center gap-2">
                        <span>Need revised as built drawing? Y/N</span>
                        <span className="ml-auto">recorded by drawing PIC</span>
                        <input
                          type="text"
                          name="recordedBy"
                          value={formData.recordedBy}
                          onChange={handleInputChange}
                          className="border-b border-gray-400 focus:outline-none focus:border-black focus:bg-yellow-50 w-24 text-[10px]"
                        />
                        <span>date</span>
                      </div>
                    </td>
                    <td className="border border-black p-1" colSpan="2"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Footer Section */}
            <div className="border border-black p-1.5 mb-2">
              <div className="text-[9px] mb-0.5">Warehouse officer writes more parts used for WO on next pages sign by technician</div>
              <div className="text-[9px] mb-0.5">Unused parts returned to sparepart warehouse ? Yes / No by _______</div>
              <div className="text-[9px]">Supervisor check issued part before closing WO, total parts type issued = _____ items</div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-2">
              <div className="border border-black p-1.5">
                <div className="text-[9px] font-semibold">Approved Date : Not Yet Approved</div>
              </div>
              <div className="border border-black p-1.5">
                <div className="text-[9px] font-semibold">Approved By : Not Yet Approved</div>
              </div>
              <div className="border border-black p-1.5">
                <div className="text-[9px] font-semibold">(Approved By System)</div>
              </div>
            </div>

            <div className="text-[9px] text-gray-600">
              CR-EN-G001.00<br />
              (20 May 2020)
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 0.5cm;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:border-2 {
            border-width: 2px !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          #printable-form {
            box-shadow: none !important;
            border-width: 2px !important;
          }
        }
        @media screen {
          body {
            background: linear-gradient(to bottom right, #f3f4f6, #e5e7eb);
          }
        }
      `}</style>
    </div>
  );
};

export default ServiceRequestForm;