import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAfterReading } from "../../hooks/instrument/useAfterReading";
import SidebarMenu from "../../components/SidebarMenu";


// ==================== TYPES ====================
interface BatchResult {
  id: number;
  no_qc_batch: string;
  item_number: number;
  result_data: any;
  is_reread: boolean;
  created_at: string;
  pending_approval?: boolean; // For UI display
}

interface RereadHistory {
  usage_id: number;
  reason: string;
  requested_at: string;
  approved_by?: string;
  approved_at?: string;
  status: string;
  reject_notes?: string;
  result_status: string;
  item_number?: number;
}

interface AfterReadingData {
  usage_id: number;
  instrument_id: number;
  instrument_name: string;
  kategori_sampel: string;
  sampel: string[];
  no_qc_batch: string[];
  status: string;
  batch_results: BatchResult[];
  reread_history: RereadHistory[];
  can_export: boolean;
  requires_approval: boolean;
  // ✅ Added for reread tracking
  parent_usage_id?: number;
  result_status?: string;
  reread_batch_status?: Record<string, string>; // batch -> "pending"|"awaiting_approval"|"approved"
  current_reread_id?: number;
  current_reread_status?: string; // "pending", "approved", "rejected"
  final_checklist_items?: any[];
  require_all_final_ok?: boolean;
}

const REREAD_CONTEXT_KEY = 'pending_reread_context';


// ✅ Helper function to safely parse result_data
const parseResultData = (result: BatchResult) => {
  try {
    if (typeof result.result_data === 'object' && result.result_data !== null) {
      return result.result_data;
    }
    if (typeof result.result_data === 'string') {
      return JSON.parse(result.result_data);
    }
    return result.result_data;
  } catch (error) {
    console.error('Failed to parse result_data:', error);
    return { error: 'Failed to parse data', raw: result.result_data };
  }
};



// ✅ Helper function to format result data for display
const formatResultData = (result: BatchResult) => {
  const parsed = parseResultData(result);

  if (!parsed || parsed?.error) {
    return `ERROR: ${parsed?.message || parsed?.error || 'Unknown error'}`;
  }

  // ✅ Named measurement fields (from parseBridgeValue)
  const measurementFields = ['brix', 'nd', 'temp', 'ph', 'value', 'result'];
  const measurements = measurementFields
    .filter(k => parsed[k] !== undefined && parsed[k] !== null && parsed[k] !== '')
    .map(k => `${k.toUpperCase()}: ${parsed[k]}`);

  if (measurements.length > 0) {
    return measurements.join(' | ');
  }

  // ✅ Generic value field
  if (parsed?.value !== undefined) {
    return `Value: ${parsed.value}${parsed.unit ? ' ' + parsed.unit : ''}`;
  }

  // ✅ Skip internal/metadata fields
  const skipFields = ['read_at', 'pc_id', '_raw_value', 'timestamp', 'parsed', 'raw_text'];
  const displayFields: string[] = [];

  for (const [key, value] of Object.entries(parsed || {})) {
    if (!skipFields.includes(key) && value !== null && value !== undefined && value !== '') {
      displayFields.push(`${key}: ${value}`);
    }
  }

  // ✅ Fallback to raw_data (never show null)
  if (displayFields.length === 0) {
    return parsed?.raw_data || JSON.stringify(parsed);
  }

  return displayFields.join(', ');
};


// ==================== REREAD MODAL COMPONENT ====================


const RereadModal = ({
  show,
  onClose,
  onConfirm,
  batchNumber,
  itemNumber,
  isLoading,
}: {
  show: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  batchNumber: string;
  itemNumber: number | null;
  isLoading: boolean;
}) => {
  const [reason, setReason] = useState("");

  const handleSubmit = () => {
    if (!reason.trim()) {
      alert("Alasan uji ulang harus diisi");
      return;
    }
    onConfirm(reason);
  };

  if (!show) return null;

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header bg-warning text-dark">
            <h5 className="modal-title">
              <i className="bi bi-arrow-repeat me-2"></i>
              Konfirmasi Uji Ulang
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="alert alert-info">
              <i className="bi bi-info-circle me-2"></i>
              Anda akan melakukan uji ulang untuk:
              <div className="mt-2">
                <strong>Batch:</strong> {batchNumber}
                {itemNumber !== null && (
                  <>
                    <br />
                    <strong>Item #:</strong> {itemNumber}
                  </>
                )}
              </div>
            </div>

            <div className="alert alert-warning mb-3">
              <small>
                <i className="bi bi-info-circle me-1"></i>
                Setelah mengajukan, Anda dapat langsung melakukan pembacaan ulang.
                Hasil pembacaan akan menunggu persetujuan supervisor sebelum dapat di-export.
              </small>
            </div>

            <div className="mb-3">
              <label className="form-label fw-bold">
                Alasan Uji Ulang <span className="text-danger">*</span>
              </label>
              <textarea
                className="form-control"
                rows={4}
                placeholder="Jelaskan alasan mengapa diperlukan uji ulang..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn-warning"
              onClick={handleSubmit}
              disabled={isLoading || !reason.trim()}
            >
              {isLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Memproses...
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle me-2"></i>
                  Ajukan Uji Ulang
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


// ==================== BATCH SELECTION MODAL COMPONENT ====================
const BatchSelectionModal = ({
  show,
  onClose,
  onSave,
  onReread,
  availableBatches,
  afterReadingData,
  selectedBatches,
  onBatchesChange,
  finalCondition,
  onConditionChange,
  onChecklistChange,
  isSaving,
  isReread,
  finalChecklistConfig,
}: {
  show: boolean;
  onClose: () => void;
  onSave: () => void;
  onReread: () => void;
  onExport: () => void;
  afterReadingData: AfterReadingData | null;
  selectedBatches: string[];              // ✅ CHANGED
  availableBatches: string[];
  onBatchesChange: (batches: string[]) => void;  // ✅ CHANGED
  finalCondition: "OK" | "NOT OK" | "";
  onConditionChange: (condition: "OK" | "NOT OK") => void;
  finalChecklistResults?: any;
  onChecklistChange?: (results: any) => void;
  isSaving: boolean;
  isReread?: boolean;
  finalChecklistConfig?: any[];
  requireAllFinalOK?: boolean;
}) => {
  const [checklistItems, setChecklistItems] = useState<any[]>([]);
  useEffect(() => {
    if (show && finalChecklistConfig && finalChecklistConfig.length > 0) {
      const initializedItems = finalChecklistConfig.map((item: any) => ({
        ...item,
        value: item.type === 'boolean' ? null : '',
        notes: ''
      }));
      setChecklistItems(initializedItems);
    } else if (show) {
      setChecklistItems([]);
    }
  }, [show, finalChecklistConfig]);


  const handleChecklistItemChange = (itemId: number, field: string, value: any) => {
    const updated = checklistItems.map(item =>
      item.id === itemId ? { ...item, [field]: value } : item
    );
    setChecklistItems(updated);

    const allOK = updated.every(item => {
      if (item.type === 'boolean') return item.value === true;
      if (item.type === 'text') return (item.value || '').trim().length > 0;
      if (item.type === 'number') return !isNaN(item.value) && item.value !== '';
      return true;
    });

    // ← Auto-derive final condition from checklist
    onConditionChange(allOK ? "OK" : "NOT OK");

    if (onChecklistChange) {
      onChecklistChange({
        items: updated,
        all_ok: allOK,
        completed_at: new Date().toISOString(),
      });
    }
  };

  // ✅ NEW: Toggle a batch in/out of the selection
  const handleBatchToggle = (batch: string) => {
    if (selectedBatches.includes(batch)) {
      onBatchesChange(selectedBatches.filter(b => b !== batch));
    } else {
      onBatchesChange([...selectedBatches, batch]);
    }
  };

  // ✅ NEW: Select all / deselect all
  const handleSelectAll = () => {
    if (selectedBatches.length === availableBatches.length) {
      onBatchesChange([]);
    } else {
      onBatchesChange([...availableBatches]);
    }
  };

  if (!show) return null;

  const allSelected = selectedBatches.length === availableBatches.length && availableBatches.length > 0;

  return (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title">
              {isReread ? (
                <><i className="bi bi-check-circle me-2"></i>Submit Reread Results</>
              ) : (
                <><i className="bi bi-check-circle me-2"></i>Selesai Pembacaan Data</>
              )}
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          <div className="modal-body">

            {/* Info for rereads */}
            {isReread && (
              <div className="alert alert-info mb-3">
                <i className="bi bi-info-circle me-2"></i>
                <strong>Reread Submission:</strong> Results will be submitted to supervisor for approval.
                <br />
                <strong>Batch:</strong> {availableBatches[0]}
              </div>
            )}

            {/* Final Checklist */}
            {checklistItems.length > 0 && (
              <div className="mb-4">
                <h6 className="fw-bold mb-3">
                  <i className="bi bi-clipboard-check me-2"></i>Kondisi Akhir
                </h6>
                <div className="border rounded p-3">
                  {checklistItems.map((item, index) => (
                    <div key={item.id} className="mb-3 pb-3 border-bottom">
                      <div className="d-flex align-items-start">
                        <span className="badge bg-secondary me-2">{index + 1}</span>
                        <div className="flex-grow-1">
                          <label className="form-label mb-1">
                            {item.label}
                            {item.required && <span className="text-danger ms-1">*</span>}
                          </label>
                          {item.help_text && (
                            <small className="text-muted d-block mb-2">{item.help_text}</small>
                          )}

                          {/* ✅ FIXED: use "boolean" to match backend model */}
                          {item.type === 'boolean' && (
                            <div className="btn-group btn-group-sm w-100" role="group">
                              <button type="button"
                                className={`btn ${item.value === true ? 'btn-success' : 'btn-outline-success'}`}
                                onClick={() => handleChecklistItemChange(item.id, 'value', true)}>
                                <i className="bi bi-check-circle me-1"></i>OK
                              </button>
                              <button type="button"
                                className={`btn ${item.value === false ? 'btn-danger' : 'btn-outline-danger'}`}
                                onClick={() => handleChecklistItemChange(item.id, 'value', false)}>
                                <i className="bi bi-x-circle me-1"></i>NOT OK
                              </button>
                            </div>
                          )}
                          {item.type === 'text' && (
                            <input type="text" className="form-control form-control-sm"
                              placeholder={item.placeholder || 'Enter text'} value={item.value || ''}
                              onChange={(e) => handleChecklistItemChange(item.id, 'value', e.target.value)} />
                          )}
                          {item.type === 'number' && (
                            <input type="number" className="form-control form-control-sm"
                              placeholder={item.placeholder} min={item.min_value} max={item.max_value}
                              value={item.value || ''}
                              onChange={(e) => handleChecklistItemChange(item.id, 'value', parseFloat(e.target.value))} />
                          )}

                          {/* Notes — hidden for boolean, it's self-explanatory */}
                          {item.type !== 'boolean' && (
                            <textarea className="form-control form-control-sm mt-2" rows={2}
                              placeholder="Catatan (opsional)" value={item.notes || ''}
                              onChange={(e) => handleChecklistItemChange(item.id, 'notes', e.target.value)} />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fallback manual condition — only if no checklist configured */}
            {checklistItems.length === 0 && (
              <div className="mb-4">
                <label className="form-label fw-bold">
                  Kondisi Akhir <span className="text-danger">*</span>
                </label>
                <div className="btn-group w-100" role="group">
                  <button type="button"
                    className={`btn ${finalCondition === "OK" ? "btn-success" : "btn-outline-success"}`}
                    onClick={() => onConditionChange("OK")}>
                    <i className="bi bi-check-circle me-1"></i> OK
                  </button>
                  <button type="button"
                    className={`btn ${finalCondition === "NOT OK" ? "btn-danger" : "btn-outline-danger"}`}
                    onClick={() => onConditionChange("NOT OK")}>
                    <i className="bi bi-x-circle me-1"></i> NOT OK
                  </button>
                </div>
              </div>
            )}

            {/* ✅ NEW: Multi-batch checkbox selection (hidden for rerreads) */}
            {!isReread && (
              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="form-label fw-bold mb-0">
                    Pilih Batch untuk Finalisasi <span className="text-danger">*</span>
                  </label>
                  {availableBatches.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0 text-decoration-none"
                      onClick={handleSelectAll}
                    >
                      {allSelected ? "Batal Semua" : "Pilih Semua"}
                    </button>
                  )}
                </div>
                <div className="border rounded p-3">
                  {availableBatches.length === 0 ? (
                    <p className="text-muted mb-0 small">Tidak ada batch tersedia</p>
                  ) : (
                    availableBatches.map((batch) => {
                      const batchStatus = afterReadingData?.reread_batch_status?.[batch];
                      const isPending = batchStatus === "awaiting_approval" || batchStatus === "pending";
                      const isApproved = batchStatus === "approved";
                      const isRejected = batchStatus === "rejected";
                      const hasReread = !!batchStatus;

                      return (
                        <div
                          key={batch}
                          className={`d-flex align-items-center justify-content-between p-2 rounded mb-2 ${selectedBatches.includes(batch) ? "bg-success bg-opacity-10 border border-success" : "bg-light"
                            }`}
                        >
                          <div className="form-check mb-0">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              id={`batch-check-${batch}`}
                              checked={selectedBatches.includes(batch)}
                              onChange={() => handleBatchToggle(batch)}
                            />
                            <label className="form-check-label fw-semibold" htmlFor={`batch-check-${batch}`}>
                              {batch}
                            </label>
                          </div>
                          <div className="d-flex align-items-center gap-2">
                            {hasReread && (
                              <>
                                {isPending && (
                                  <span className="badge bg-warning text-dark">
                                    <i className="bi bi-hourglass-split me-1"></i>Awaiting Approval
                                  </span>
                                )}
                                {isApproved && (
                                  <span className="badge bg-success">
                                    <i className="bi bi-check-circle me-1"></i>Reread Approved
                                  </span>
                                )}
                                {isRejected && (
                                  <span className="badge bg-danger">
                                    <i className="bi bi-x-circle me-1"></i>Reread Rejected
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {selectedBatches.length > 0 && (
                  <small className="text-muted mt-1 d-block">
                    {selectedBatches.length} dari {availableBatches.length} batch dipilih
                  </small>
                )}
              </div>
            )}

          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Batal
            </button>
            {/* Reread button — only when exactly 1 batch is selected and not a reread */}
            {!isReread && selectedBatches.length === 1 && (
              <button type="button" className="btn btn-warning" onClick={onReread}>
                <i className="bi bi-arrow-repeat me-2"></i>
                Uji Ulang
              </button>
            )}
            <button
              type="button"
              className="btn btn-success"
              onClick={onSave}
              disabled={
                isSaving ||
                !finalCondition ||
                (!isReread && selectedBatches.length === 0) ||
                (checklistItems.length > 0 && checklistItems.some(item => item.value === null))
              }
            >
              {isSaving ? (
                <><span className="spinner-border spinner-border-sm me-1"></span>Menyimpan...</>
              ) : isReread ? "Submit for Approval" : `Simpan (${selectedBatches.length} Batch)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== MAIN COMPONENT ====================
export default function AfterReadingPage() {
  const { usageId } = useParams();
  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);


  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const {
    data: afterReadingData,
    isLoading,
    saveResult,
    requestReread,
    exportToPDF,
    isSaving,
    isExporting,
  } = useAfterReading(usageId ? parseInt(usageId) : null);

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showRereadModal, setShowRereadModal] = useState(false);
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [selectedItemNumber, setSelectedItemNumber] = useState<number | null>(null);
  const [finalCondition, setFinalCondition] = useState<"OK" | "NOT OK" | "">("");
  const [finalChecklistResults, setFinalChecklistResults] = useState<any>(null);

  const isReread = afterReadingData?.status === "Re-read";
  const rereadBatch = isReread && afterReadingData?.no_qc_batch?.length > 0
    ? afterReadingData.no_qc_batch[0]
    : "";

  const exportUsageId = afterReadingData?.parent_usage_id ?? (usageId ? parseInt(usageId) : null);

  // Auto-select first batch when data loads
  useEffect(() => {
    if (afterReadingData?.no_qc_batch && afterReadingData.no_qc_batch.length > 0) {
      setSelectedBatches(afterReadingData.no_qc_batch);
    }
  }, [afterReadingData]);


  // ✅ CORRECT: Only opens when button is clicked
  const handleEndReading = () => {
    // For rereads, auto-select batch
    if (isReread && rereadBatch) {
      setSelectedBatches([rereadBatch]);
    }
    setShowBatchModal(true);
  };

  const handleSaveResult = async () => {

    if (isReread && afterReadingData?.current_reread_status === "approved") {
      alert("This reread has already been approved. No need to re-submit.");
      setShowBatchModal(false);
      return;
    }
    if (selectedBatches.length === 0) {
      alert("Pilih batch terlebih dahulu");
      return;
    }
    if (!finalCondition) {
      alert("Pilih kondisi akhir terlebih dahulu");
      return;
    }

    try {
      const payload: any = {
        final_condition: finalCondition,
        selected_batches: selectedBatches,
      };

      if (finalChecklistResults && finalChecklistResults.items && finalChecklistResults.items.length > 0) {
        payload.final_checklist_results = finalChecklistResults;
      }

      await saveResult.mutateAsync(payload);

      setShowBatchModal(false);
      setFinalCondition("");
      setFinalChecklistResults(null);

      if (isReread) {
        // ✅ FIX 3: After saving reread, go back to PARENT's after-reading page
        // so supervisor can see all batches together and approve before export.
        const parentId = afterReadingData?.parent_usage_id;
        if (parentId) {
          alert("Hasil uji ulang berhasil disimpan! Menunggu persetujuan supervisor sebelum dapat di-export.");
          navigate(`/instruments/after-reading/${parentId}`);
        } else {
          alert("Hasil uji ulang berhasil disimpan!");
          navigate(`/instruments/${afterReadingData?.instrument_id}`);
        }
      } else {
        alert("Data berhasil disimpan!");
        navigate(`/instruments/${afterReadingData?.instrument_id}`);
      }
    } catch (error: any) {
      console.error("Save error:", error);
      const errorMsg = error.response?.data?.error ||
        error.response?.data?.message ||
        error.message;
      alert(`Gagal menyimpan data: ${errorMsg}`);
    }
  };

  // ✅ UPDATED: Navigate with re-read context
  // ✅ COMPLETE FIXED: Handle multiple response structures
  const handleRequestReread = async (reason: string) => {
    try {
      console.log('🔄 Step 1: Requesting reread...');
      console.log('  Current usageId:', usageId);
      console.log('  Selected batches:', selectedBatches);
      console.log('  Selected item:', selectedItemNumber);
      console.log('  Reason:', reason);

      // Send reread request
      const response = await requestReread.mutateAsync({
        batch_number: selectedBatches[0],
        item_number: selectedItemNumber,
        reason,
      });

      console.log('✅ Step 2: Full API response:', response);

      // ✅ CRITICAL FIX: Handle nested response structure
      // Response can be: { data: { usage_id: ... } } 
      // Or: { data: { data: { usage_id: ... } } }
      let responseData;

      if (response.data) {
        // Check if there's a nested data object
        if (response.data.data && typeof response.data.data === 'object') {
          responseData = response.data.data;
          console.log('  Using nested data object');
        } else {
          responseData = response.data;
          console.log('  Using direct data object');
        }
      } else {
        responseData = response;
        console.log('  Using response directly');
      }

      console.log('  Parsed responseData:', responseData);

      // ✅ Extract IDs with fallback
      // Extract new re-read usage ID from backend response (must NOT fall back to parent usageId)
      const rereadUsageId = responseData.usage_id ||
        responseData.reread_usage_id ||
        responseData.new_usage_id;

      const instrumentId = responseData.instrument_id ||
        afterReadingData?.instrument_id;

      console.log('🎯 Step 3: Extracted values:');
      console.log('  reread_usage_id:', rereadUsageId);
      console.log('  instrument_id:', instrumentId);

      // ✅ Validate we have required IDs
      if (!rereadUsageId || rereadUsageId === 0) {
        console.error('❌ No valid usage_id found in response');
        console.error('  Full response:', response);
        console.error('  Parsed data:', responseData);
        alert('Error: ID usage re-read tidak ditemukan. Response: ' + JSON.stringify(responseData));
        return;
      }

      if (!instrumentId) {
        console.error('❌ No instrument_id available');
        alert('Error: ID instrument tidak ditemukan');
        return;
      }

      // Close modals immediately
      setShowRereadModal(false);
      setShowBatchModal(false);

      // Show success message
      alert("Permintaan berhasil! Data lama telah dihapus. Anda akan diarahkan ke halaman pembacaan.");

      // Prepare navigation state
      const navigationState = {
        isReread: true,
        rereadUsageId: Number(rereadUsageId),
        parentUsageId: usageId,
        batchNumber: selectedBatches[0],
        itemNumber: selectedItemNumber,
        reason: reason,
        kategoriSampel: afterReadingData?.kategori_sampel || '',
        sampel: afterReadingData?.sampel || [],
      };

      // ✅ Store in sessionStorage as backup
      sessionStorage.setItem(REREAD_CONTEXT_KEY, JSON.stringify(navigationState));
      console.log('💾 Step 4: Stored reread context');
      console.log('  Context:', navigationState);

      const readPath = `/instruments/read/${instrumentId}`;

      console.log('🚀 Step 5: Navigating to:', readPath);

      // Small delay to ensure backend completes
      await new Promise(resolve => setTimeout(resolve, 500));

      // Navigate
      navigate(readPath, {
        state: navigationState,
        replace: false
      });

      console.log('✅ Navigation complete');

    } catch (error: any) {
      console.error("❌ Error occurred:", error);
      console.error("  Error name:", error.name);
      console.error("  Error message:", error.message);
      console.error("  Response data:", error.response?.data);
      console.error("  Response status:", error.response?.status);

      // Close modals on error
      setShowRereadModal(false);

      // ✅ Better error message handling
      let errorMessage = 'Terjadi kesalahan tidak diketahui';

      if (error.response?.data) {
        const errorData = error.response.data;

        // Check for various error message formats
        if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.details) {
          errorMessage = errorData.details;
        }

        // Special handling for "already in progress" error
        if (errorMessage.includes('already in progress')) {
          errorMessage = 'Status penggunaan sedang dalam proses re-read. Silakan refresh halaman dan coba lagi.';
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      alert(`Gagal mengirim permintaan uji ulang: ${errorMessage}`);
    }
  };

  const handleItemReread = (batchNumber: string, itemNumber: number) => {
    setSelectedBatches([batchNumber]);
    setSelectedItemNumber(itemNumber);
    setShowRereadModal(true);
  };

  const handleBatchReread = () => {
    setSelectedItemNumber(null);
    setShowBatchModal(false);
    setShowRereadModal(true);
  };

  const handleExportPDF = async () => {
    if (selectedBatches.length === 0) {
      alert("Pilih batch terlebih dahulu");
      return;
    }

    try {
      // ✅ FIX: Pass targetUsageId so export always uses root/parent usage ID
      // This merges all batches (original + approved rereads) into one PDF
      const result = await exportToPDF.mutateAsync({
        batchNumber: selectedBatches[0],
        targetUsageId: exportUsageId ?? undefined,
      });
      if (result?.pdf_path) {
        window.open(`http://10.167.167.146:8080${result.pdf_path}`, "_blank");
        alert("PDF berhasil di-generate!");
      }
    } catch (error: any) {
      console.error("Export error:", error);
      const errorMsg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Gagal export PDF";
      alert(`Gagal export PDF: ${errorMsg}`);
    }
  };

  if (isLoading) {
    return (
      <div className="container-fluid mt-3">
        <div className="row">
          <div className="col-md-3">
            <SidebarMenu
              isHorizontal={false}
              isSidebarOpen={isSidebarOpen}
              toggleSidebar={toggleSidebar}
            />
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="btn btn-link text-dark p-0 me-3"
              style={{ fontSize: '1.5rem' }}
            >
              <i className="bi bi-list"></i>
            </button>
          </div>
          <div className="col-md-9">
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "60vh" }}>
              <div className="text-center">
                <div className="spinner-border text-primary mb-3" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="text-muted">Memuat data...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!afterReadingData) {
    return (
      <div className="container-fluid mt-3">
        <div className="row">
          <div className="col-md-3">
            <SidebarMenu
              isHorizontal={false}
              isSidebarOpen={isSidebarOpen}
              toggleSidebar={toggleSidebar}
            />
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="btn btn-link text-dark p-0 me-3"
              style={{ fontSize: '1.5rem' }}
            >
              <i className="bi bi-list"></i>
            </button>
          </div>
          <div className="col-md-9">
            <div className="alert alert-danger">
              <i className="bi bi-exclamation-triangle me-2"></i>
              Data tidak ditemukan. Usage ID mungkin tidak valid atau data belum tersedia.
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => navigate(-1)}
            >
              <i className="bi bi-arrow-left me-2"></i>
              Kembali
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid mt-3">
      <div className="row">
        <div className="col-md-2">
          <SidebarMenu
            isHorizontal={false}
            isSidebarOpen={isSidebarOpen}
            toggleSidebar={toggleSidebar}
          />
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="btn btn-link text-dark p-0 me-3"
            style={{ fontSize: '1.5rem' }}
          >
            <i className="bi bi-list"></i>
          </button>
        </div>

        <div className="col-md-12">
          {/* Header */}
          <div className="card mb-3 border-0 shadow-sm">
            <div className="card-body">
              <h4 className="mb-2">
                <i className="bi bi-clipboard-check me-2"></i>
                Hasil Pembacaan Data
              </h4>
              <div className="d-flex gap-2 flex-wrap">
                <span className="badge bg-info">{afterReadingData.instrument_name}</span>
                <span className="badge bg-secondary">{afterReadingData.kategori_sampel}</span>
                <span
                  className={`badge ${afterReadingData.status === "Done Read"
                    ? "bg-success"
                    : afterReadingData.status === "Re-read"
                      ? "bg-warning"
                      : "bg-primary"
                    }`}
                >
                  {afterReadingData.status}
                </span>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="card mb-3 border-0 shadow-sm">
            <div className="card-header bg-light">
              <h5 className="mb-0">
                <i className="bi bi-info-circle me-2"></i>
                Ringkasan Pembacaan
              </h5>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-6">
                  <p className="mb-2">
                    <strong>Kategori Sampel:</strong> {afterReadingData.kategori_sampel || '-'}
                  </p>
                  <p className="mb-2">
                    <strong>Sampel:</strong> {Array.isArray(afterReadingData.sampel) ? afterReadingData.sampel.join(", ") : '-'}
                  </p>
                </div>
                <div className="col-md-6">
                  <p className="mb-2">
                    <strong>Jumlah Batch:</strong> {Array.isArray(afterReadingData.no_qc_batch) ? afterReadingData.no_qc_batch.length : 0}
                  </p>
                  <p className="mb-2">
                    <strong>Total Item Terbaca:</strong> {Array.isArray(afterReadingData.batch_results) ? afterReadingData.batch_results.length : 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Batch Results */}
          <div className="card mb-3 border-0 shadow-sm">
            <div className="card-header bg-light">
              <h5 className="mb-0">
                <i className="bi bi-table me-2"></i>
                Data Per Batch
              </h5>
            </div>
            <div className="card-body">
              {Array.isArray(afterReadingData.no_qc_batch) && afterReadingData.no_qc_batch.map((batch, batchIndex) => {
                const batchResults = Array.isArray(afterReadingData.batch_results)
                  ? afterReadingData.batch_results.filter((r) => r.no_qc_batch === batch)
                  : [];

                return (
                  <div key={`batch-${batch}-${batchIndex}`} className="mb-4">
                    <h6 className="fw-bold">
                      <i className="bi bi-box me-2"></i>
                      Batch: {batch} ({batchResults.length} items)
                    </h6>
                    <div className="table-responsive">
                      <table className="table table-bordered table-hover table-sm">
                        <thead className="table-light">
                          <tr>
                            <th>Item #</th>
                            <th>Data Pembacaan</th>
                            <th>Waktu</th>
                            <th>Status</th>
                            <th>Approval</th>
                            <th className="text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batchResults.length > 0 ? batchResults.map((result) => (
                            <tr key={`result-${result.id}`}>
                              <td className="text-center">{result.item_number}</td>
                              <td>
                                <div style={{ fontSize: "0.85rem", maxHeight: "100px", overflow: "auto", whiteSpace: "pre-wrap" }}>
                                  {formatResultData(result)}
                                </div>
                              </td>
                              <td>
                                <small>
                                  {new Date(result.created_at).toLocaleString("id-ID")}
                                </small>
                              </td>
                              <td className="text-center">
                                {result.is_reread ? (
                                  <span className="badge bg-warning">Re-read</span>
                                ) : (
                                  <span className="badge bg-success">Original</span>
                                )}
                              </td>
                              <td className="text-center">
                                {result.is_reread ? (
                                  (() => {
                                    const batchStatus = afterReadingData.reread_batch_status?.[result.no_qc_batch];
                                    if (batchStatus === "approved") return <span className="badge bg-success">Approved</span>;
                                    if (batchStatus === "awaiting_approval") return <span className="badge bg-warning text-dark">Awaiting Approval</span>;
                                    return <span className="badge bg-secondary">Pending</span>;
                                  })()
                                ) : (
                                  <span className="badge bg-light text-dark">—</span>
                                )}
                              </td>
                              <td className="text-center">
                                {(() => {
                                  const batchPending = ["awaiting_approval", "pending"].includes(
                                    afterReadingData.reread_batch_status?.[batch] ?? ""
                                  );
                                  return (
                                    <button
                                      className="btn btn-warning btn-sm"
                                      onClick={() => handleItemReread(batch, result.item_number)}
                                      title={batchPending ? "Ada uji ulang yang sedang menunggu persetujuan" : "Uji ulang item ini"}
                                      disabled={batchPending}  // ✅ FIX: Block new reread while one is pending approval
                                    >
                                      <i className="bi bi-arrow-repeat me-1"></i>
                                      Uji Ulang
                                    </button>
                                  );
                                })()}
                              </td>
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={5} className="text-center text-muted">
                                Tidak ada data untuk batch ini
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
              {(!Array.isArray(afterReadingData.no_qc_batch) || afterReadingData.no_qc_batch.length === 0) && (
                <div className="alert alert-warning">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  Tidak ada data batch tersedia
                </div>
              )}
            </div>
          </div>

          {/* Approval notice for parent usage with pending reread */}
          {(() => {
            const batchStatuses = Object.values(afterReadingData.reread_batch_status ?? {});
            const hasPending = batchStatuses.some(s => s === "awaiting_approval" || s === "pending");
            const hasRejected = batchStatuses.some(s => s === "rejected");

            if (hasPending) return (
              <div className="alert alert-warning mb-3">
                <i className="bi bi-hourglass-split me-2"></i>
                <strong>Menunggu Persetujuan Supervisor</strong>
                <p className="mb-0 mt-1 small">
                  Salah satu batch sedang dalam proses uji ulang dan memerlukan persetujuan supervisor sebelum dapat di-export.
                </p>
              </div>
            );

            if (hasRejected) return (
              <div className="alert alert-danger mb-3">
                <i className="bi bi-x-circle me-2"></i>
                <strong>Uji Ulang Ditolak</strong>
                <p className="mb-0 mt-1 small">
                  Supervisor telah menolak hasil uji ulang. Anda dapat melakukan uji ulang kembali atau melanjutkan dengan data original.
                </p>
              </div>
            );

            return null;
          })()}

          {/* Actions */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body">
              <div className="d-flex gap-2 justify-content-end">
                <button
                  className="btn btn-secondary"
                  onClick={() => navigate(`/instruments/${afterReadingData.instrument_id}`)}
                >
                  <i className="bi bi-arrow-left me-2"></i>
                  Kembali
                </button>
                {/* Hide End & Finalize when reread is awaiting approval */}
                {(() => {
                  const batchStatuses = Object.values(afterReadingData.reread_batch_status ?? {});
                  const hasBlockingReread = batchStatuses.some(
                    s => s === "awaiting_approval" || s === "pending"
                  );
                  return !hasBlockingReread && (
                    <button className="btn btn-success" onClick={handleEndReading}>
                      <i className="bi bi-flag-fill me-2"></i>
                      End & Finalize
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <BatchSelectionModal
        show={showBatchModal}
        onClose={() => {
          setShowBatchModal(false);
          // ← NOTHING ELSE HERE
        }}
        onSave={handleSaveResult}
        onReread={handleBatchReread}
        onExport={handleExportPDF}
        afterReadingData={afterReadingData}
        availableBatches={afterReadingData?.no_qc_batch || []}
        selectedBatches={selectedBatches}
        onBatchesChange={setSelectedBatches}
        finalCondition={finalCondition}
        onConditionChange={setFinalCondition}
        finalChecklistResults={finalChecklistResults}
        onChecklistChange={setFinalChecklistResults}
        isSaving={isSaving || isExporting}
        isReread={isReread}
        finalChecklistConfig={afterReadingData?.final_checklist_items}
        requireAllFinalOK={afterReadingData?.require_all_final_ok}
      />

      <RereadModal
        show={showRereadModal}
        onClose={() => {
          setShowRereadModal(false);
          setSelectedItemNumber(null);
        }}
        onConfirm={handleRequestReread}
        batchNumber={selectedBatches[0]}
        itemNumber={selectedItemNumber}
        isLoading={requestReread.isPending}
      />
    </div>
  );
}