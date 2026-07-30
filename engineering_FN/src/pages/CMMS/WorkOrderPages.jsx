import React, { useState, useEffect } from 'react';
import { Download, Search } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const initialFormDataState = {
  wrwoNumber: '',
  wrwoNumberPM: 'PM',
  startDate: '',
  wrwoCompletePM: 'PM', 
  completeDate: '',
  woDescription: '',
  requestor: '-',
  approvedBy: '',
  changeControlData: '',
  woType: 'Preventive Maintenance',
  woStatus: 'Released',
  activityType: 'Maintenance',
  activityCause: 'Preventive',
  assetNumber: '',
  assetArea: '',
  glCharging: '',
  assetActivity: '',
  supervisorNotes: '',
  operations: [],
  revisedDrawing: '',
  drawingDate: '',
  failureDescription: 'NA',
  reportCause: 'NA',
  rootCause: 'NA',
  resolution: 'NA',
  recordedBy: ''
};

const getWOSuggestions = (input, allWorkOrders) => {
  if (!input) return [];
  return allWorkOrders.filter(wo => wo.toLowerCase().includes(input.toLowerCase()));
};

const ServiceRequestForm = () => {
  const [formData, setFormData] = useState(initialFormDataState);
  const [woInput, setWoInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allWorkOrders, setAllWorkOrders] = useState([]);

  useEffect(() => {
    const fetchAllWorkOrders = async () => {
      try {
        const response = await fetch('http://10.126.15.197:8002/part/live-work-orders');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        const woNumbers = data.map(item => item.wo_number);
        setAllWorkOrders(woNumbers);
      } catch (err) {
        console.error('Error fetching work order list:', err);
      }
    };
    fetchAllWorkOrders();
  }, []);

  useEffect(() => {
    if (woInput.length > 0) {
      const filtered = getWOSuggestions(woInput, allWorkOrders);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [woInput, allWorkOrders]);

const loadData = async (woNumber) => {
    setLoading(true);
    setShowSuggestions(false);

    try {
      // 1. Fetch the data
      const response = await fetch(`http://10.126.15.197:8002/part/work-order/details/${woNumber}`);
      if (!response.ok) {
        throw new Error(`Network response was not ok (status: ${response.status})`);
      }
      
      // DEFINITION: 'data' is defined here
      const data = await response.json();

      // Helper to format Database Date to Input Format (YYYY-MM-DDTHH:mm)
      const formatDateTime = (dateString) => {
        if (!dateString) return '';
        try {
          return new Date(dateString).toISOString().slice(0, 16);
        } catch (e) {
          return '';
        }
      };

      // DEFINITION: 'mainStart' and 'mainComplete' are defined here
      const mainStart = formatDateTime(data.start_time);
      const mainComplete = formatDateTime(data.completed_time);

      // USAGE: Now we can safely use 'data', 'mainStart', and 'mainComplete'
      const formattedOperations = data.operations.map((op, index) => ({
        id: (index + 1) * 10,
        description: op.description,
        resources: 'MTC',
        executedBy: data.technician_name || 'MTC',
        
        // Apply the MAIN time to this row
        actualStart: mainStart,
        actualComplete: mainComplete,
        
        // Get the specific note for this row
        techniciansNotes: op.technician_note || '', 
      }));

      const scheduledDate = data.scheduled_date ? data.scheduled_date.split('T')[0] : '';

      const formattedData = {
        ...initialFormDataState,
        wrwoNumber: woNumber,
        wrwoNumberPM: 'PM',
        startDate: scheduledDate,
        wrwoCompletePM: 'PM',
        completeDate: scheduledDate, 
        woDescription: data.wo_description,
        woType: data.woType || 'Preventive',
        woStatus: data.status || 'Released',
        assetNumber: data.asset_number,
        assetArea: data.asset_Area,
        glCharging: data.gl_Charging,
        assetActivity: data.asset_Activity,
        operations: formattedOperations,
        requestor: '-',
        approvedBy: '',
      };

      setFormData(formattedData);
      setWoInput(woNumber);
      
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWoInputChange = (e) => {
    const value = e.target.value;
    setWoInput(value);
    if (value.length >= 10) {
      const exactMatch = allWorkOrders.find(wo => wo === value);
      if (exactMatch) loadData(exactMatch);
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
        actualStart: '',
        actualComplete: '',
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

const exportToPDF = async () => {
    const input = document.getElementById('printable-form');
    
    const canvas = await html2canvas(input, {
      scale: 3, 
      useCORS: true,
      logging: false,
      scrollY: -window.scrollY,
      windowWidth: document.documentElement.offsetWidth,
      windowHeight: document.documentElement.offsetHeight,
      
      onclone: (documentClone) => {
          const element = documentClone.getElementById('printable-form');
          
          // 1. Reset Page Layout
          element.style.transform = 'none';
          element.style.margin = '0';
          
          // 2. Hide labels that contain "/ PM" or "/ --"
          const labels = element.querySelectorAll('label, span, div');
          labels.forEach(label => {
            if (label.textContent.includes('/ PM') || label.textContent.includes('/ --')) {
              label.style.display = 'none';
            }
          });
          
          // 3. Select ALL inputs, textareas, and selects
          const inputs = element.querySelectorAll('input, textarea, select');
          
          inputs.forEach(input => {
            const textDiv = document.createElement('div');
            
            // Get value
            let value = input.value;
            if (input.tagName === 'SELECT' && input.selectedIndex >= 0) {
               value = input.options[input.selectedIndex].text;
            }

            textDiv.textContent = value;
            
            const style = window.getComputedStyle(input);

            if (input.closest('tbody')) {
                textDiv.style.fontSize = '12px'; 
                textDiv.style.fontWeight = '500'; // Medium weight for readability
            } else {
                textDiv.style.fontSize = '12px';
            }
            
            // Layout styles
            textDiv.style.width = '100%';
            textDiv.style.display = 'flex';
            
            // --- OPTIMIZED FIX FOR CUT-OFF TEXT ---
            // 1. Use 'visible' to prevent any clipping
            textDiv.style.overflow = 'visible'; 
            
            // 2. Optimal line-height for preventing cutoff
            textDiv.style.lineHeight = '1.5';
            
            // 3. Center vertically - this is key
            textDiv.style.alignItems = 'center'; 
            textDiv.style.justifyContent = 'flex-start';
            
            // 4. Set explicit height with extra room
            const inputHeight = input.offsetHeight;
            textDiv.style.minHeight = inputHeight + 'px';
            textDiv.style.height = 'auto';
            
            // 5. Better padding distribution
            textDiv.style.padding = '4px 8px';
            
            textDiv.style.boxSizing = 'border-box';
            textDiv.style.backgroundColor = 'transparent';
            
            // Special handling for Textareas (Descriptions)
            if (input.tagName === 'TEXTAREA') {
                textDiv.style.alignItems = 'flex-start'; 
                textDiv.style.padding = '6px 8px'; 
                textDiv.style.whiteSpace = 'pre-wrap'; 
                textDiv.style.lineHeight = '1.6';
                textDiv.style.minHeight = (input.offsetHeight + 4) + 'px';
                // BIGGER font for textareas
                textDiv.style.fontSize = '14px';
            } else {
                textDiv.style.whiteSpace = 'nowrap';
                // BIGGER font for regular inputs
                textDiv.style.fontSize = '13px';
            }
            
            // Copy Font Styles
            textDiv.style.fontFamily = style.fontFamily;
            textDiv.style.fontWeight = style.fontWeight;
            textDiv.style.color = style.color;
            
            // Preserve bottom border if it existed
            if (style.borderBottomWidth !== '0px' && style.borderBottomStyle !== 'none') {
                textDiv.style.borderBottom = style.borderBottom;
            }

            // Swap
            input.style.display = 'none';
            if (input.parentNode) {
                input.parentNode.appendChild(textDiv);
            }
          });
      }
    });

    const imgData = canvas.toDataURL('image/jpeg', 1.0);
    const pdf = new jsPDF('l', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const imgProps = pdf.getImageProperties(imgData);
    const imgRatio = imgProps.width / imgProps.height;
    const pageRatio = pdfWidth / pdfHeight;

    let renderWidth = pdfWidth;
    let renderHeight = pdfHeight;

    if (imgRatio > pageRatio) {
      renderHeight = renderWidth / imgRatio;
    } else {
      renderWidth = renderHeight * imgRatio;
    }

    const xOffset = (pdfWidth - renderWidth) / 2;
    const yOffset = (pdfHeight - renderHeight) / 2;

    pdf.addImage(imgData, 'JPEG', xOffset, yOffset, renderWidth, renderHeight);
    pdf.save(`WO-${formData.wrwoNumber || 'Draft'}.pdf`);
  };
  
 return (
    <div className="min-h-screen bg-transparent py-8 px-4">
      {/* Search Bar */}
      <div className="max-w-[1600px] mx-auto mb-6 print:hidden">
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
            {loading && <div className="mt-2 text-gray-600 text-sm">Loading data...</div>}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="max-w-[1600px] mx-auto">
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
              <div className="text-[12px] text-right leading-tight">
                <div>Page : Page 1 of 1</div>
                <div>Printed Date : {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit', second: '2-digit'})}</div>
                <div>User : JIYAN.SALSABILA - SFL-OU</div>
              </div>
            </div>

            {/* Top Section - 6 Columns for maximum width */}
            <div className="grid grid-cols-6 gap-1 mb-2">
              {/* Columns 1-2: WR/WO fields in 2 columns */}
              <div className="col-span-2 grid grid-cols-2 gap-1">
                {/* WR/WO Number */}
                <div className="border border-black p-1.5">
                  <div className="text-[12px] mb-0.5">WR/WO Number</div>
                  <div className="flex gap-1 items-center">
                    <input
                      type="text"
                      name="wrwoNumberPM"
                      value={formData.wrwoNumberPM}
                      onChange={handleInputChange}
                      readOnly={true}  // <--- Makes it uneditable
                      className="w-8 text-xs text-center border-gray-400 bg-transparent cursor-default outline-none py-0 leading-none"
                    />
                    <span className="text-xs">/</span>
                    <input
                      type="text"
                      name="wrwoNumber"
                      value={formData.wrwoNumber}
                      onChange={handleInputChange}
                      readOnly={true}
                      className="flex-1 text-xs border-gray-400 focus:outline-none focus:border-black focus:bg-yellow-50 py-0 leading-none"
                    />
                  </div>
                </div>

                {/* WR Requestor / Approved By */}
                <div className="border border-black p-1.5">
                  <div className="text-[12px] mb-0.5">WR Requestor / Approved by</div>
                  <div className="flex gap-1 items-center">
                    <input
                      type="text"
                      name="requestor"
                      value={formData.requestor}
                      onChange={handleInputChange}
                      readOnly={true}
                      className="w-8 text-xs text-center border-gray-400 bg-transparent cursor-default outline-none py-0 leading-none"
                    />
                    <span className="text-xs">/</span>
                    <input
                      type="text"
                      name="approvedBy"
                      value={formData.approvedBy}
                      onChange={handleInputChange}
                      className="flex-1 text-xs border-gray-400 focus:outline-none focus:border-black focus:bg-yellow-50 py-0 leading-none"
                    />
                  </div>
                </div>

                {/* WR/WO Start Date */}
                <div className="border border-black p-1.5">
                  <div className="text-[12px] mb-0.5">WR/WO Start Date Target</div>
                  <div className="flex gap-1 items-center">
                    <input
                      type="text"
                      name="wrwoStartPM"
                      value={formData.wrwoNumberPM}
                      onChange={handleInputChange}
                      readOnly={true}
                      className="w-8 text-xs text-center border-gray-400 bg-transparent cursor-default outline-none py-0 leading-none"
                    />
                    <span className="text-xs">/</span>
                    <input
                      type="date"
                      name="startDate"
                      value={formData.startDate}
                      onChange={handleInputChange}
                      readOnly={true}
                      className="flex-1 text-xs border-gray-400 focus:outline-none focus:border-black focus:bg-yellow-50 py-0 leading-none"
                    />
                  </div>
                </div>

                {/* WR/WO Complete Date */}
                <div className="border border-black p-1.5">
                  <div className="text-[12px] mb-0.5">WR/WO Complete Date Target</div>
                  <div className="flex gap-1 items-center">
                    <input
                      type="text"
                      name="wrwoCompletePM"
                      value={formData.wrwoCompletePM}
                      onChange={handleInputChange}
                      readOnly={true}
                      className="w-8 text-xs text-center border-gray-400 bg-transparent cursor-default outline-none py-0 leading-none"
                    />
                    <span className="text-xs">/</span>
                    <input
                      type="date"
                      name="completeDate"
                      value={formData.completeDate}
                      onChange={handleInputChange}
                      readOnly={true}
                      className="flex-1 text-xs border-gray-400 focus:outline-none focus:border-black focus:bg-yellow-50 py-0 leading-none"
                    />
                  </div>
                </div>
              </div>

              {/* Columns 3-4: WO Description */}
              <div className="col-span-3 border border-black p-1.5">
                <div className="text-[12px] mb-0.5">WO Description</div>
                <textarea
                  name="woDescription"
                  value={formData.woDescription}
                  onChange={handleInputChange}
                  readOnly={true}
                  rows="3"
                  className="w-full text-xs border border-gray-300 p-1 focus:outline-none focus:border-black focus:bg-yellow-50 resize-none h-[calc(100%-16px)]"
                />
              </div>

              {/* Column 5: Change Control Data */}
              <div className="col-span-1 border border-black p-1.5">
                <div className="text-[12px] mb-0.5">Change Control Data</div>
                <textarea
                  name="changeControlData"
                  value={formData.changeControlData}
                  onChange={handleInputChange}
                  readOnly={true}
                  rows="3"
                  className="w-full text-xs border border-gray-300 p-1 focus:outline-none focus:border-black focus:bg-yellow-50 resize-none h-[calc(100%-16px)]"
                />
              </div>
            </div>

            {/* Middle Section - 6 Columns for full landscape */}
            <div className="grid grid-cols-6 gap-1 mb-2">
              {/* Column 1: WO Type, Activity Type */}
              <div className="flex flex-col gap-1">
                <div className="border border-black p-1.5">
                  <div className="text-[12px] mb-0.5">WO Type</div>
                  <select
                    name="woType"
                    value={formData.woType}
                    onChange={handleInputChange}
                    readOnly={true}
                    className="w-full text-xs border-gray-400 focus:outline-none focus:border-black focus:bg-yellow-50 bg-white py-0 leading-none"
                  >
                    <option>Preventive Maintenance</option>
                    <option>Corrective</option>
                    <option>Maintenance</option>
                  </select>
                </div>
                <div className="border border-black p-1.5">
                  <div className="text-[12px] mb-0.5">Activity Type</div>
                  <select
                    name="activityType"
                    value={formData.activityType}
                    onChange={handleInputChange}
                    readOnly={true}
                    className="w-full text-xs border-gray-400 focus:outline-none focus:border-black focus:bg-yellow-50 bg-white py-0 leading-none"
                  >
                    <option>Maintenance</option>
                    <option>Inspection</option>
                    <option>Repair</option>
                  </select>
                </div>
              </div>

              {/* Column 2: WO Status, Activity Cause */}
              <div className="flex flex-col gap-1">
                <div className="border border-black p-1.5">
                  <div className="text-[12px] mb-0.5">WO Status</div>
                  <select
                    name="woStatus"
                    value={formData.woStatus}
                    onChange={handleInputChange}
                    readOnly={true}
                    className="w-full text-xs border-gray-400 focus:outline-none focus:border-black focus:bg-yellow-50 bg-white py-0 leading-none"
                  >
                    <option>Released</option>
                    <option>Planning</option>
                    <option>In Progress</option>
                    <option>Completed</option>
                  </select>
                </div>
                <div className="border border-black p-1.5">
                  <div className="text-[12px] mb-0.5">Activity Cause</div>
                  <select
                    name="activityCause"
                    value={formData.activityCause}
                    onChange={handleInputChange}
                    readOnly={true}
                    className="w-full text-xs border-gray-400 focus:outline-none focus:border-black focus:bg-yellow-50 bg-white py-0 leading-none"
                  >
                    <option>Preventive</option>
                    <option>Breakdown</option>
                    <option>Scheduled</option>
                  </select>
                </div>
              </div>

              {/* Column 3: Asset Number, Asset Area */}
              <div className="flex flex-col gap-1">
                <div className="border border-black p-1.5">
                  <div className="text-[12px] mb-0.5">Asset Number</div>
                  <input
                    type="text"
                    name="assetNumber"
                    value={formData.assetNumber}
                    onChange={handleInputChange}
                    readOnly={true}
                    className="w-full text-xs border-gray-400 focus:outline-none focus:border-black focus:bg-yellow-50 py-0 leading-none"
                  />
                </div>
                <div className="border border-black p-1.5">
                  <div className="text-[12px] mb-0.5">Asset Area</div>
                  <input
                    type="text"
                    name="assetArea"
                    value={formData.assetArea}
                    onChange={handleInputChange}
                    readOnly={true}
                    className="w-full text-xs border-gray-400 focus:outline-none focus:border-black focus:bg-yellow-50 py-0 leading-none"
                  />
                </div>
              </div>

              {/* Column 4: GL Charging, Asset Activity */}
              <div className="flex flex-col gap-1">
                <div className="border border-black p-1.5">
                  <div className="text-[12px] mb-0.5">GL Charging</div>
                  <input
                    type="text"
                    name="glCharging"
                    value={formData.glCharging}
                    onChange={handleInputChange}
                    readOnly={true}
                    className="w-full text-xs border-gray-400 focus:outline-none focus:border-black focus:bg-yellow-50 py-0 leading-none"
                  />
                </div>
                <div className="border border-black p-1.5">
                  <div className="text-[12px] mb-0.5">Asset Activity</div>
                  <input
                    type="text"
                    name="assetActivity"
                    value={formData.assetActivity}
                    onChange={handleInputChange}
                    readOnly={true}
                    className="w-full text-xs border-gray-400 focus:outline-none focus:border-black focus:bg-yellow-50 py-0 leading-none"
                  />
                </div>
              </div>

              {/* Columns 5-6: Supervisor Notes spanning 2 columns */}
              <div className="col-span-2 border border-black p-1.5">
                <div className="text-[12px] mb-0.5">Supervisor Notes</div>
                <textarea
                  name="supervisorNotes"
                  value={formData.supervisorNotes}
                  onChange={handleInputChange}
                  className="w-full text-xs border border-gray-300 p-1 focus:outline-none focus:border-black focus:bg-yellow-50 resize-none h-[calc(100%-16px)]"
                />
              </div>
            </div>

            {/* Operations Table */}
            <div className="mb-2">
              <table className="w-full border-collapse border border-black">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-black p-1 text-[14px] text-center font-semibold" style={{width: '45px'}}>Operation</th>
                    <th className="border border-black p-1 text-[14px] text-center font-semibold" style={{width: '25%'}}>Description</th>
                    <th className="border border-black p-1 text-[14px] text-center font-semibold" style={{width: '65px'}}>Resources</th>
                    <th className="border border-black p-1 text-[14px] text-center font-semibold " style={{width: '95px'}}>Executed by Technician</th>
                    <th className="border border-black p-1 text-[14px] text-center font-semibold" style={{width: '160px'}}>Actual Start / Complete</th>
                    <th className="border border-black p-1 text-[14px] text-center font-semibold">Technician's Notes</th>
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
                          className="w-full px-1 text-[12px] text-center focus:outline-none focus:bg-yellow-50 py-0 leading-none"
                        />
                      </td>
                      <td className="border border-black p-0.5">
                        <textarea
                          value={op.description}
                          onChange={(e) => handleOperationChange(idx, 'description', e.target.value)}
                          className="w-full px-1 text-[12px] focus:outline-none focus:bg-yellow-50 resize-none leading-tight"
                          rows="2"
                        />
                      </td>
                      <td className="border border-black p-0.5">
                        <input
                          type="text"
                          value={op.resources}
                          onChange={(e) => handleOperationChange(idx, 'resources', e.target.value)}
                          className="w-full px-1 text-[12px] text-center focus:outline-none focus:bg-yellow-50 py-0 leading-none"
                        />
                      </td>
                      <td className="border border-black p-0.5">
                        <input
                          type="text"
                          value={op.executedBy}
                          onChange={(e) => handleOperationChange(idx, 'executedBy', e.target.value)}
                          className="w-full px-1 text-[12px] text-center focus:outline-none focus:bg-yellow-50 py-0 leading-none text-blue-700"
                        />
                      </td>
                      <td className="border border-black p-0.5">
                        <div className="flex flex-col gap-1">
                          <input
                            type="datetime-local"
                            value={op.actualStart}
                            onChange={(e) => handleOperationChange(idx, 'actualStart', e.target.value)}
                            className="w-full px-1 text-[12px] focus:outline-none focus:bg-yellow-50 border-b border-gray-200 py-0 leading-none text-blue-700"
                          />
                          <input
                            type="datetime-local"
                            value={op.actualComplete}
                            onChange={(e) => handleOperationChange(idx, 'actualComplete', e.target.value)}
                            className="w-full px-1 text-[12px] focus:outline-none focus:bg-yellow-50 py-0 leading-none text-blue-700"
                          />
                        </div>
                      </td>
                      <td className="border border-black p-0.5">
                        <textarea
                          value={op.techniciansNotes}
                          onChange={(e) => handleOperationChange(idx, 'techniciansNotes', e.target.value)}
                          className="w-full px-1 text-[12px] focus:outline-none focus:bg-yellow-50 resize-none leading-tight h-full text-blue-700"
                          rows="2"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Inventory and Failure Analysis Section */}
            <div className="grid grid-cols-2 mb-2 border border-black">
              {/* LEFT COLUMN: Inventory Table */}
              <div className="border-r border-black flex flex-col">
                {/* Header Row */}
                <div className="flex border-b border-black bg-gray-100">
                  <div className="flex-1 border-r border-black p-1 text-[12px] font-semibold">Inventory Part -- Direct Purchase</div>
                  <div className="w-[40px] border-r border-black p-1 text-[12px] font-semibold text-center">Qty</div>
                  <div className="w-[40px] border-r border-black p-1 text-[12px] font-semibold text-center">Unit</div>
                  <div className="w-[60px] p-1 text-[12px] font-semibold text-center">Issued</div>
                </div>
                <div className="flex-1 min-h-[200px] bg-white"></div>
              </div>

              {/* RIGHT COLUMN: Failure Analysis */}
              <div className="flex flex-col justify-between">
                <div className="p-2">
                  <div className="text-[12px] font-semibold underline mb-2">Failure Analysis (by Supervisor and Technician):</div>
                  
                  <div className="flex flex-col gap-2">
                    {['Failure Description', 'Report Cause', 'Root Cause', 'Resolution'].map((label) => (
                       <div key={label} className="flex items-start">
                          <div className="text-[12px] font-semibold w-24 pt-0.5 shrink-0">{label} :</div>
                          <textarea
                            name={label === 'Failure Description' ? 'failureDescription' : label === 'Report Cause' ? 'reportCause' : label === 'Root Cause' ? 'rootCause' : 'resolution'}
                            value={formData[label === 'Failure Description' ? 'failureDescription' : label === 'Report Cause' ? 'reportCause' : label === 'Root Cause' ? 'rootCause' : 'resolution']}
                            onChange={handleInputChange}
                            rows="2"
                            className="flex-1 text-[12px] border-b border-gray-300 focus:border-black focus:bg-yellow-50 focus:outline-none resize-none bg-transparent leading-tight mt-0 text-blue-700"
                          />
                       </div>
                    ))}
                  </div>
                </div>

{/* Footer: Revised Drawing */}
            <div className="border-t border-black p-1.5 text-[12px] flex items-end mt-2">
              <span className="mb-0.5">Need revised as built drawing? Y/N</span>
              <input
                type="text"
                name="revisedDrawing"
                value={formData.revisedDrawing}
                onChange={handleInputChange}
                className="w-8 border-b border-black mx-1 text-center focus:outline-none focus:bg-yellow-50 py-0 leading-none"
              />
              <span className="mb-0.5 ml-2">, recorded by drawing PIC :</span>
              <input
                type="text"
                name="recordedBy"
                value={formData.recordedBy}
                onChange={handleInputChange}
                className="flex-1 border-b border-black mx-1 focus:outline-none focus:bg-yellow-50 py-0 leading-none"
              />
              <span className="mb-0.5 ml-2">date</span>
              <input
                type="date"
                name="drawingDate"
                value={formData.drawingDate}
                onChange={handleInputChange}
                className="border-b border-black ml-1 focus:outline-none focus:bg-yellow-50 py-0 leading-none"
              />
            </div>
          </div>
        </div>

        {/* Warehouse Info Text */}
        <div className="border border-black p-1.5 mb-2">
          <div className="text-[12px] mb-0.5">Warehouse officer writes more parts used for WO on next pages sign by technician</div>
          <div className="text-[12px] mb-0.5">Unused parts returned to sparepart warehouse ? Yes / No by _______</div>
          <div className="text-[12px]">Supervisor check issued part before closing WO, total parts type issued = _____ items</div>
        </div>

        {/* Approval Grid with E-Sign */}
        <div className="grid grid-cols-3 gap-2 mb-2">
          
{/* Column 1: Approved Date (UPDATED) */}
          <div className="border border-black p-1.5 flex items-center relative">
            <div className="text-[12px] font-semibold z-10">
              Approved Date : 
              
                 {/* Displays "24 Nov 2025" in Blue */}
                 <span className="ml-1 text-blue-800 font-bold">
                   {new Date().toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })} 
                 </span>
            </div>
          </div>

{/* Column 2: Approved By (WITH SIGNATURE, DATE & NAME) */}
          <div className="border border-black p-1.5 relative h-14 flex flex-col justify-between">
            {/* Label */}
            <div className="text-[12px] font-semibold z-10 relative">
              Approved By : {formData.approvedBy !== '-' ? formData.approvedBy : 'Not Yet Approved'}
            </div>

            {/* Signature Layer - Centered Vertically & Horizontally */}
            <div className="absolute inset-0 flex flex-col items-center justify-end pointer-events-none pb-1">
              
              {/* Row 1: Signature Image + Date */}
              <div className="flex items-end gap-2 mb-0.5">
                <img 
                  src="/ESIGN.png" 
                  alt="Signature" 
                  className="h-8 w-auto object-contain opacity-90" /* Reduced height slightly to fit name */
                />
                
                <span className="text-[12px] font-bold text-blue-800 opacity-80 mb-1">
                  {new Date().toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  })}
                </span>
              </div>

              {/* Row 2: Name Underneath */}
              <span className="text-[12px] font-bold text-blue-800 opacity-80 leading-none">
                Fauzi Perdana 
              </span>

            </div>
          </div>

          {/* Column 3: System Approval */}
          <div className="border border-black p-1.5 flex items-center">
            <div className="text-[12px] font-semibold">(Approved By System)</div>
          </div>
        </div>

        <div className="text-[12px] text-gray-600">
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
            margin: 5mm;
          }
          body {
            visibility: hidden;
            background-color: white;
            margin: 0;
            padding: 0;
            overflow: hidden;
          }
          #printable-form {
            visibility: visible;
            position: absolute;
            left: 0;
            top: 0;
            margin: 0;
            padding: 0;
            transform: scale(0.95); 
            transform-origin: top left;
            width: 105.2%;
            z-index: 9999; 
            background-color: white;
            box-shadow: none !important;
            border: 2px solid black !important; 
          }
          #printable-form > div {
            padding: 12px !important;
          }
          #printable-form .mb-4 {
            margin-bottom: 5px !important;
          }
          #printable-form * {
            visibility: visible;
          }
          #printable-form .mb-2 {
            margin-bottom: 2px !important;
          }
          #printable-form .p-1\.5 {
            padding: 3px !important;
          }
          .print\\:hidden {
            display: none !important;
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