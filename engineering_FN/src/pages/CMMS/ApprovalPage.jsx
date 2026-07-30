import React, { useState, useEffect } from 'react';
import { CheckSquare, Square, Eye, X } from 'lucide-react';
import axios from 'axios';

const SupervisorApproval = () => {
  const [pendingList, setPendingList] = useState([]);
  const [selectedWOs, setSelectedWOs] = useState([]);
  const [modalData, setModalData] = useState(null); 
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Fetch Pending List on Load
  useEffect(() => {
    fetchPendingList();
  }, []);

  const fetchPendingList = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('http://10.126.15.197:8002/part/work-orders/pending');
      if (!res.ok) throw new Error("Failed to fetch");
      
      const data = await res.json();
      
      // SAFETY CHECK: Ensure data is an array before setting state
      if (Array.isArray(data)) {
        setPendingList(data);
      } else {
        console.error("API returned non-array:", data);
        setPendingList([]); 
      }
    } catch (err) {
      console.error(err);
      setPendingList([]); 
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Fetch Full Details for the Modal
  const openDetailModal = async (woNumber) => {
    try {
      const res = await fetch(`http://10.126.15.197:8002/part/work-order/details/${woNumber}`);
      if (!res.ok) throw new Error("Failed to load details");
      
      const data = await res.json();
      setModalData(data);
      setShowModal(true);
    } catch (err) {
      alert("Failed to load details");
    }
  };

  // 3. Handle Checkbox Selection
  const toggleSelect = (woNumber) => {
    setSelectedWOs(prev => 
      prev.includes(woNumber) 
        ? prev.filter(id => id !== woNumber) 
        : [...prev, woNumber]
    );
  };

  const toggleSelectAll = () => {
    if (selectedWOs.length === pendingList.length) {
      setSelectedWOs([]); 
    } else {
      setSelectedWOs(pendingList.map(item => item.wo_number)); 
    }
  };


// 4. Handle Bulk Approve (WITH TOKEN)
  const handleBulkApprove = async () => {
    if (selectedWOs.length === 0) return;
    
    // Get the token from storage
    const token = localStorage.getItem('user_token'); 

    if (!window.confirm(`Are you sure you want to approve ${selectedWOs.length} Work Orders?`)) return;

    try {
      const res = await fetch('http://10.126.15.197:8002/part/work-orders/bulk-approve', {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // <--- SEND TOKEN HERE
        },
        body: JSON.stringify({ 
            wo_numbers: selectedWOs
            // We removed 'approver_name' from here!
        })
      });

      if (res.ok) {
        alert("Approved successfully!");
        setSelectedWOs([]);
        fetchPendingList(); 
        setShowModal(false);
      } else {
        alert("Failed: You might not be authorized.");
      }
    } catch (err) {
      console.error(err);
      alert("Error approving");
    }
  };

  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Supervisor Approval Queue</h1>
          {selectedWOs.length > 0 && (
            <button 
              onClick={handleBulkApprove}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold shadow transition-colors"
            >
              Approve Selected ({selectedWOs.length})
            </button>
          )}
        </div>

        {/* --- TABLE --- */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-4 w-12 text-center cursor-pointer" onClick={toggleSelectAll}>
                  {pendingList.length > 0 && selectedWOs.length === pendingList.length 
                    ? <CheckSquare size={20} className="text-blue-600" /> 
                    : <Square size={20} className="text-gray-400" />}
                </th>
                <th className="p-4 text-sm font-bold text-gray-600">WO Number</th>
                <th className="p-4 text-sm font-bold text-gray-600">Date</th>
                <th className="p-4 text-sm font-bold text-gray-600">Machine / Asset</th>
                <th className="p-4 text-sm font-bold text-gray-600">Technician</th>
                <th className="p-4 text-sm font-bold text-gray-600 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {/* SAFETY CHECK: Check if loading, then check if empty */}
              {isLoading ? (
                 <tr><td colSpan="6" className="p-8 text-center text-gray-500">Loading pending requests...</td></tr>
              ) : !pendingList || pendingList.length === 0 ? (
                <tr><td colSpan="6" className="p-8 text-center text-gray-500">No pending approvals found.</td></tr>
              ) : (
                // Use Optional Chaining (?.) just in case
                pendingList?.map((wo, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-blue-50 transition-colors">
                    <td className="p-4 text-center cursor-pointer" onClick={() => toggleSelect(wo.wo_number)}>
                      {selectedWOs.includes(wo.wo_number) 
                        ? <CheckSquare size={20} className="text-blue-600" /> 
                        : <Square size={20} className="text-gray-300" />}
                    </td>
                    <td className="p-4 font-medium text-gray-800">{wo.wo_number}</td>
                    <td className="p-4 text-gray-600">{new Date(wo.scheduled_date).toLocaleDateString('en-GB')}</td>
                    <td className="p-4 text-gray-600">
                      <div className="font-semibold">{wo.machine_name}</div>
                      <div className="text-xs text-gray-400">{wo.asset_number}</div>
                    </td>
                    <td className="p-4 text-gray-600">{wo.technician_name || '-'}</td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => openDetailModal(wo.wo_number)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center justify-center gap-1"
                      >
                        <Eye size={16} /> Review
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- READ-ONLY MODAL --- */}
      {showModal && modalData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative">
            
            <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center z-10">
              <h2 className="text-xl font-bold">Review: {modalData.wo_number}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-full"><X size={24}/></button>
            </div>

            <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded border">
                    <div>
                        <div className="text-xs text-gray-500">Technician</div>
                        <div className="font-semibold">{modalData.technician_name || '-'}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500">Machine Asset</div>
                        <div className="font-semibold">{modalData.asset_number || '-'}</div>
                    </div>
                    <div className="col-span-2">
                        <div className="text-xs text-gray-500">Description</div>
                        <div>{modalData.wo_description || '-'}</div>
                    </div>
                </div>

                <div>
                    <h3 className="font-bold mb-2">Operations Log</h3>
                    <table className="w-full text-sm border">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="border p-2 w-10">#</th>
                                <th className="border p-2 text-left">Task</th>
                                <th className="border p-2 text-left">Tech Notes</th>
                                <th className="border p-2 w-32">Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* SAFETY CHECK: Optional Chaining on operations */}
                            {modalData.operations?.length > 0 ? (
                                modalData.operations.map((op, i) => (
                                    <tr key={i}>
                                        <td className="border p-2 text-center">{(i+1)*10}</td>
                                        <td className="border p-2">{op.description}</td>
                                        <td className="border p-2 text-blue-700 font-medium">{op.technician_note || '-'}</td>
                                        <td className="border p-2 text-xs text-gray-500">
                                            {modalData.start_time ? new Date(modalData.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="4" className="p-4 text-center">No operations recorded.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t p-4 flex justify-end gap-3">
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupervisorApproval;