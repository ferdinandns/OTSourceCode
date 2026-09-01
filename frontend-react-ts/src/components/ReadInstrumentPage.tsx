import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useInstrumentDetail } from "../hooks/instrument/useInstrumentDetail";
import {
  useStartAutoRead,
  useReadProgress,
  useLiveResults,
  useRetryItem
} from "../hooks/instrument/useInstrumentReading";
import { useChecklist, useValidateChecklist } from "../hooks/instrument/useChecklist";

import axiosInstance from "../api/instrument";
import DynamicReadingForm from "./DynamicReadingForm";
import SidebarMenu from "./SidebarMenu";
import { getProducts } from "../api/product";
import { SearchableSelect } from "./SearchableSelect";
import { useQueryClient } from "@tanstack/react-query";

// ==================== CONSTANTS ====================
const REREAD_CONTEXT_KEY = "pending_reread_context";

// ==================== PERSISTENCE HELPERS ====================
const SESSION_KEY_STEP = (id: string) => `reading_step_${id}`;
const SESSION_KEY_USAGE = (id: string) => `reading_usage_${id}`;

const persistStep = (id: string, step: ReadingStep) =>
  sessionStorage.setItem(SESSION_KEY_STEP(id), step);

const persistUsageId = (id: string, uid: number | null) => {
  if (uid != null) sessionStorage.setItem(SESSION_KEY_USAGE(id), String(uid));
  else sessionStorage.removeItem(SESSION_KEY_USAGE(id));
};

const clearPersistedReadingState = (id: string) => {
  sessionStorage.removeItem(SESSION_KEY_STEP(id));
  sessionStorage.removeItem(SESSION_KEY_USAGE(id));
};

const getPersistedStep = (id: string): ReadingStep | null =>
  sessionStorage.getItem(SESSION_KEY_STEP(id)) as ReadingStep | null;

const getPersistedUsageId = (id: string): number | null => {
  const v = sessionStorage.getItem(SESSION_KEY_USAGE(id));
  return v ? parseInt(v) : null;
};

// ==================== TYPES ====================
interface BatchData {
  no_qc_batch: string;
  jumlah_item: number;
}

interface ChecklistResponse {
  id: number;
  value: boolean | string | number;
  ok: boolean;
  note: string;
}

interface UsageFormData {
  kategori_sampel: string;
  sampel: string[];
  no_qc_batch: BatchData[];
  initial_condition: Record<string, any>;
  additional_data: Record<string, any>;
  checklist_responses: ChecklistResponse[];
  mtsics_command?: string;
}

interface RereadContext {
  isReread: boolean;
  rereadUsageId: number;
  parentUsageId: string;
  batchNumber: string;
  itemNumber?: number | null;
  reason: string;
  kategoriSampel: string;
  sampel: string[];
}

// 'manual-input' is the new step for unconfigured / manual instruments
type ReadingStep = "checklist" | "initial" | "auto-reading" | "manual-input" | "result";

// ==================== LOADING COMPONENT ====================
const LoadingSpinner = () => (
  <div className="container-fluid mt-3">
    <div className="row">
      <div className="col-md-9">
        <div className="text-center mt-5">
          <div className="spinner-border text-primary" />
          <p className="mt-2">Loading instrument...</p>
        </div>
      </div>
    </div>
  </div>
);

// ==================== REREAD BANNER ====================
const RereadBanner = ({ context }: { context: RereadContext }) => (
  <div className="alert alert-warning border-warning mb-3">
    <div className="d-flex align-items-center">
      <i className="bi bi-arrow-repeat fs-3 me-3"></i>
      <div className="flex-grow-1">
        <h6 className="mb-1 fw-bold">
          <i className="bi bi-info-circle me-2"></i>
          Re-read Mode Active
        </h6>
        <small>
          <strong>Batch:</strong> {context.batchNumber}
          {context.itemNumber && (
            <>
              {" "}
              | <strong>Item #:</strong> {context.itemNumber}
            </>
          )}
        </small>
        <br />
        <small className="text-muted">
          <strong>Reason:</strong> {context.reason}
        </small>
        <br />
        <small className="badge bg-warning text-dark mt-1">
          Results will require supervisor approval before export
        </small>
      </div>
    </div>
  </div>
);

// ==================== CHECKLIST COMPONENT ====================
const ChecklistForm = ({
  checklistItems,
  responses,
  onResponseChange,
  onValidate,
  onCancel,
  isValidating,
}: {
  instrumentId: string;
  checklistItems: any[];
  responses: ChecklistResponse[];
  onResponseChange: (responses: ChecklistResponse[]) => void;
  onValidate: () => void;
  onCancel: () => void;
  isValidating: boolean;
}) => {
  const handleValueChange = (itemId: number, value: any, ok: boolean) => {
    const updated = responses.map((r) =>
      r.id === itemId ? { ...r, value, ok } : r
    );
    onResponseChange(updated);
  };

  const handleNoteChange = (itemId: number, note: string) => {
    const updated = responses.map((r) =>
      r.id === itemId ? { ...r, note } : r
    );
    onResponseChange(updated);
  };

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-info text-white">
        <h5 className="mb-0">
          <i className="bi bi-list-check me-2"></i>Initial Condition Checklist
        </h5>
      </div>
      <div className="card-body">
        <div className="alert alert-info">
          <i className="bi bi-info-circle me-2"></i>
          Please verify all items before starting the reading process. Items marked with{" "}
          <span className="badge bg-danger">Critical</span> must be OK to proceed.
        </div>

        {checklistItems.map((item) => {
          const response = responses.find((r) => r.id === item.id);

          return (
            <div key={item.id} className="mb-4 p-3 border rounded">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <label className="form-label fw-bold mb-0">
                  {item.label}
                  {item.required && <span className="text-danger ms-1">*</span>}
                  {item.critical_ok && (
                    <span className="badge bg-danger ms-2">Critical</span>
                  )}
                </label>
              </div>

              {item.help_text && (
                <small className="text-muted d-block mb-2">
                  <i className="bi bi-question-circle me-1"></i>
                  {item.help_text}
                </small>
              )}

              {item.type === "boolean" && (
                <div className="btn-group w-100" role="group">
                  <button
                    type="button"
                    className={`btn ${response?.value === true && response?.ok
                      ? "btn-success"
                      : "btn-outline-success"
                      }`}
                    onClick={() => handleValueChange(item.id, true, true)}
                  >
                    <i className="bi bi-check-circle me-1"></i>OK
                  </button>
                  <button
                    type="button"
                    className={`btn ${response?.value === false && !response?.ok
                      ? "btn-danger"
                      : "btn-outline-danger"
                      }`}
                    onClick={() => handleValueChange(item.id, false, false)}
                  >
                    <i className="bi bi-x-circle me-1"></i>NOT OK
                  </button>
                </div>
              )}

              {item.type === "text" && (
                <input
                  type="text"
                  className="form-control"
                  placeholder={item.placeholder || "Enter text"}
                  value={(response?.value as string) || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    const ok = value.trim().length > 0;
                    handleValueChange(item.id, value, ok);
                  }}
                />
              )}

              {item.type === "number" && (
                <input
                  type="number"
                  className="form-control"
                  placeholder={item.placeholder || "Enter number"}
                  value={(response?.value as number) || ""}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    const ok = !isNaN(value);
                    handleValueChange(item.id, value, ok);
                  }}
                />
              )}

              <input
                type="text"
                className="form-control mt-2"
                placeholder="Add note (optional)"
                value={response?.note || ""}
                onChange={(e) => handleNoteChange(item.id, e.target.value)}
              />
            </div>
          );
        })}

        <div className="d-flex gap-2 mt-4">
          <button
            className="btn btn-primary btn-lg"
            onClick={onValidate}
            disabled={isValidating}
          >
            {isValidating ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                Validating...
              </>
            ) : (
              <>
                <i className="bi bi-check-circle me-2"></i>
                Validate & Continue
              </>
            )}
          </button>
          <button className="btn btn-outline-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== AUTO-READ PROGRESS ====================
const AutoReadProgress = ({
  usageId,
  progressData = {},
  timeoutRemaining,
  liveResults = [],
}: {
  usageId: number | null;
  progressData?: any;
  readLogs?: string[];
  timeoutRemaining: number;
  liveResults?: any[];
}) => {
  const queryClient = useQueryClient();
  const retryItem = useRetryItem();
  const [retryingItem, setRetryingItem] = useState<number | null>(null);
  const [retryLogs, setRetryLogs] = useState<string[]>([]);
 
  const progress = progressData || {};
  const current = progress.completed_items || 0;
  const total = progress.total_items || 0;
  const status = progress.status || "Processing";
  const currentStatus: string = progress.current_status || "";
  const granularMatch = currentStatus.match(/item[_\-]?(\d+)/i);
  const granularItem = granularMatch ? parseInt(granularMatch[1]) : current;
  const percentage = total > 0 ? Math.min(100, (granularItem / total) * 100) : 0;
  const [bridgeStats, setBridgeStats] = useState<any>(null);
 
  const isPaused = status === "Paused";
  const isRunning = status === "Read Process" || status === "Processing";
 
  useEffect(() => {
    if (!usageId) return;
    const fetchBridgeStats = async () => {
      try {
        const response = await axiosInstance.get(
          `/api/instruments/usage/${usageId}/bridge-readings`
        );
        setBridgeStats(response.data.data);
      } catch {
        // Bridge stats optional
      }
    };
    fetchBridgeStats();
    const interval = setInterval(fetchBridgeStats, 5000);
    return () => clearInterval(interval);
  }, [usageId]);
 
  const getTimeoutColor = () => {
    if (timeoutRemaining > 45) return "success";
    if (timeoutRemaining > 30) return "info";
    if (timeoutRemaining > 15) return "warning";
    return "danger";
  };
 
  const handleRetry = async (itemNumber: number) => {
    if (!usageId) return;
    const confirmed = window.confirm(
      `Ulang item #${itemNumber}?\n\nData item ini akan dihapus dan alat akan membaca ulang. Proses akan lanjut ke item berikutnya setelah selesai.`
    );
    if (!confirmed) return;
 
    setRetryingItem(itemNumber);
    const ts = () => new Date().toLocaleTimeString();
    setRetryLogs((prev) => [
      ...prev,
      `[${ts()}] ⏸ Menghentikan goroutine & menghapus hasil item #${itemNumber}...`,
    ]);
 
    try {
      const result = await retryItem.mutateAsync({ usageId, itemNumber });
      setRetryLogs((prev) => [
        ...prev,
        `[${ts()}] ✅ Item #${itemNumber} berhasil diulang. Lanjut dari item #${result.data?.resumed_from_item ?? itemNumber + 1}`,
      ]);
      // Refresh live data
      queryClient.invalidateQueries({ queryKey: ["live-results", usageId] });
      queryClient.invalidateQueries({ queryKey: ["read-progress", usageId] });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message;
      setRetryLogs((prev) => [
        ...prev,
        `[${ts()}] ❌ Gagal mengulang item #${itemNumber}: ${msg}`,
      ]);
      alert(`Gagal mengulang item #${itemNumber}: ${msg}`);
    } finally {
      setRetryingItem(null);
    }
  };
 
  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-primary text-white">
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            <i className="bi bi-robot me-2"></i>
            {isPaused ? "Auto-Read — Mengulang Item..." : "Auto-Read in Progress"}
          </h5>
          <span className="badge bg-light text-dark">
            {current} / {total} items
          </span>
        </div>
      </div>
      <div className="card-body">
 
        {isPaused && (
          <div className="alert alert-warning d-flex align-items-center mb-3">
            <div className="spinner-border spinner-border-sm me-2 text-warning" />
            <span>
              Sistem sedang mengulang pembacaan item. Harap tunggu dan siapkan sampel di alat...
            </span>
          </div>
        )}
 
        <div className="progress mb-3" style={{ height: "30px" }}>
          <div
            className={`progress-bar progress-bar-striped ${isPaused ? "bg-warning" : "progress-bar-animated bg-success"}`}
            role="progressbar"
            style={{ width: `${percentage}%` }}
          >
            {percentage.toFixed(1)}%
          </div>
        </div>
 
        <div className="row g-3 mb-3">
          <div className="col-md-6">
            <div className="card bg-light">
              <div className="card-body">
                <h6 className="card-subtitle mb-2 text-muted">
                  <i className="bi bi-activity me-2"></i>Status
                </h6>
                <span
                  className={`badge ${
                    isPaused
                      ? "bg-warning text-dark"
                      : isRunning
                      ? "bg-primary"
                      : status === "Done Read"
                      ? "bg-success"
                      : status === "Failed"
                      ? "bg-danger"
                      : "bg-secondary"
                  }`}
                >
                  {isPaused ? "Mengulang Item..." : status}
                </span>
                {currentStatus && (
                  <div className="mt-1">
                    <small className="text-muted font-monospace">
                      {currentStatus.replace(/_/g, " ")}
                    </small>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="card bg-light">
              <div className="card-body">
                <h6 className="card-subtitle mb-2 text-muted">
                  <i className="bi bi-clock me-2"></i>Item Timeout
                </h6>
                <span className={`badge bg-${getTimeoutColor()}`}>
                  {timeoutRemaining}s remaining
                </span>
              </div>
            </div>
          </div>
        </div>
 
        {bridgeStats && (
          <div className="alert alert-info mb-3">
            <h6>
              <i className="bi bi-hdd-network me-2"></i>Bridge Connection
            </h6>
            <div className="row">
              <div className="col-6">
                <small><strong>PC ID:</strong> {bridgeStats.pc_id}</small>
              </div>
              <div className="col-6">
                <small><strong>Total Readings:</strong> {bridgeStats.total_readings}</small>
              </div>
            </div>
          </div>
        )}
 
        {liveResults && liveResults.length > 0 && (
          <div className="card border-success mb-3">
            <div className="card-header bg-success text-white py-2 d-flex justify-content-between align-items-center">
              <span>
                <i className="bi bi-table me-2"></i>
                Live Results — {liveResults.length} item(s) captured
              </span>
              <small className="opacity-75">
                <i className="bi bi-info-circle me-1"></i>
                Klik "Ulang" jika hasil salah
              </small>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-sm table-bordered mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: "50px" }}>#</th>
                      <th>Batch</th>
                      {(() => {
                        const first = liveResults[0];
                        if (!first?.result_data) return null;
                        let rd: any = {};
                        try {
                          rd = typeof first.result_data === "string"
                            ? JSON.parse(first.result_data)
                            : first.result_data;
                        } catch {}
                        return Object.keys(rd)
                          .filter(k => !["raw_data","raw_text","matched","parsed","line_count","timestamp"].includes(k))
                          .map(k => <th key={k}>{k}</th>);
                      })()}
                      <th>Waktu</th>
                      <th style={{ width: "90px" }} className="text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveResults.map((r: any, idx: number) => {
                      let rd: any = {};
                      try {
                        rd = typeof r.result_data === "string"
                          ? JSON.parse(r.result_data)
                          : (r.result_data || {});
                      } catch {}
                      const displayKeys = Object.keys(rd).filter(
                        k => !["raw_data","raw_text","matched","parsed","line_count","timestamp"].includes(k)
                      );
                      const itemNum = r.item_number ?? idx + 1;
                      const isThisRetrying = retryingItem === itemNum;
                      const isAnyRetrying = retryingItem !== null;
 
                      return (
                        <tr
                          key={idx}
                          className={isThisRetrying ? "table-warning" : ""}
                        >
                          <td>
                            <span className="badge bg-secondary">{itemNum}</span>
                          </td>
                          <td>
                            <code className="small">{r.no_qc_batch ?? "—"}</code>
                          </td>
                          {displayKeys.map(k => (
                            <td key={k} className="fw-semibold">
                              {String(rd[k])}
                            </td>
                          ))}
                          <td className="text-muted small">
                            {r.created_at
                              ? new Date(r.created_at).toLocaleTimeString()
                              : "—"}
                          </td>
                          <td className="text-center">
                            {isThisRetrying ? (
                              <span className="spinner-border spinner-border-sm text-warning" />
                            ) : (
                              <button
                                className="btn btn-warning btn-sm"
                                title={`Hapus & ulang item #${itemNum}`}
                                disabled={isAnyRetrying || isPaused}
                                onClick={() => handleRetry(itemNum)}
                              >
                                <i className="bi bi-arrow-repeat"></i>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
 
        {retryLogs.length > 0 && (
          <div className="card bg-dark text-light mt-3">
            <div className="card-header py-1">
              <small>
                <i className="bi bi-arrow-repeat me-1"></i>Retry Log
              </small>
            </div>
            <div
              className="card-body p-2"
              style={{ fontFamily: "monospace", fontSize: "0.8rem", maxHeight: "140px", overflowY: "auto" }}
            >
              {retryLogs.map((log, i) => (
                <div
                  key={i}
                  className={
                    log.includes("❌") ? "text-danger"
                    : log.includes("✅") ? "text-success"
                    : log.includes("⏸") ? "text-warning"
                    : "text-light"
                  }
                >
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}
 
      </div>
      <div className="card-footer bg-light">
        <small className="text-muted">Usage ID: {usageId}</small>
      </div>
    </div>
  );
};

// ==================== MANUAL INPUT READING ====================
interface ManualItem {
  batchNo: string;
  itemNumber: number;
  value: string;
  unit: string;
  status: "OK" | "NOT OK";
  saved: boolean;
  saving: boolean;
}

const ManualInputReading = ({
  instrumentId,
  usageData,
  onCancel,
  onComplete,
  isRereadMode,
  rereadContext,
  recentBatches,
  sampelOptions,
  selectedSampel,
  kategoriSampel,
  onKategoriChange,
  onSampelChange,
  onBatchUpdate,
  onAddBatch,
  onRemoveBatch,
  totalItems,
  kategoriOptions,
  onStarted,
  initialPhase,
  initialUsageId,
}: {
  instrumentId: string;
  usageData: UsageFormData;
  onCancel: () => void;
  onComplete: (usageId: number) => void;
  isRereadMode: boolean;
  rereadContext: RereadContext | null;
  recentBatches: string[];
  sampelOptions: string[];
  selectedSampel: string;
  kategoriSampel: string;
  onKategoriChange: (v: string) => void;
  onSampelChange: (v: string) => void;
  onBatchUpdate: (index: number, field: string, value: any) => void;
  onAddBatch: () => void;
  onRemoveBatch: (index: number) => void;
  totalItems: number;
  kategoriOptions: string[];
  onStarted?: (usageId: number) => void;
  initialPhase?: "setup" | "entry";
  initialUsageId?: number | null;
}) => {
  const [phase, setPhase] = useState<"setup" | "entry">(initialPhase ?? "setup");
  const [usageId, setUsageId] = useState<number | null>(initialUsageId ?? null);
  const [items, setItems] = useState<ManualItem[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [finalCondition, setFinalCondition] = useState<"OK" | "NOT OK">("OK");
  const [logs, setLogs] = useState<string[]>([]);
  const [manualKategori, setManualKategori] = useState(false);
  const [manualSampel, setManualSampel] = useState(false);

  useEffect(() => {
    if (initialPhase === "entry" && initialUsageId) {
      axiosInstance.get(`/api/instruments/usage/${initialUsageId}/results`)
        .then(res => {
          const results = res.data?.data?.results || [];
          if (results.length > 0) {
            const loadedItems: ManualItem[] = results.map((r: any) => {
              // Parse batchNo — bisa string biasa atau JSON array
              let batchNo = r.no_qc_batch ?? "";
              try {
                const parsed = JSON.parse(batchNo);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  batchNo = String(parsed[0]);
                } else if (typeof parsed === "string") {
                  batchNo = parsed;
                }
              } catch { /* bukan JSON, pakai as-is */ }

              return {
                batchNo,
                itemNumber: r.item_number,
                value: (() => {
                  try {
                    const rd = typeof r.result_data === "string"
                      ? JSON.parse(r.result_data) : r.result_data;
                    return String(rd?.value ?? "");
                  } catch { return ""; }
                })(),
                unit: "",
                status: "OK" as const,
                saved: true,
                saving: false,
              };
            });
            setItems(loadedItems);
          } else {
            // Belum ada hasil — load struktur dari backend usage
            axiosInstance.get(`/api/instruments/usage/${initialUsageId}`)
              .then(usageRes => {
                const usage = usageRes.data?.data;
                if (!usage) return;
                try {
                  const parsed = JSON.parse(usage.no_qc_batch);
                  if (Array.isArray(parsed)) {
                    // Cek format: array of objects atau array of strings
                    if (parsed[0] && typeof parsed[0] === "object" && "no_qc_batch" in parsed[0]) {
                      setItems(buildItemList(parsed));
                    } else if (typeof parsed[0] === "string") {
                      const batches = parsed.map((b: string) => ({
                        no_qc_batch: b,
                        jumlah_item: 1
                      }));
                      setItems(buildItemList(batches));
                    }
                  }
                } catch { }
              })
              .catch(() => { });
          }
        })
        .catch(() => {
          setItems(buildItemList(usageData.no_qc_batch));
        });
    }
  }, []);

  const addLog = (msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${ts}] ${msg}`]);
  };

  const buildItemList = (batches: BatchData[]): ManualItem[] => {
    const list: ManualItem[] = [];
    for (const batch of batches) {
      for (let i = 1; i <= batch.jumlah_item; i++) {
        list.push({
          batchNo: batch.no_qc_batch,
          itemNumber: i,
          value: "",
          unit: "",
          status: "OK",
          saved: false,
          saving: false,
        });
      }
    }
    return list;
  };

  const isSetupValid = () => {
    if (!usageData.kategori_sampel) return false;
    for (const b of usageData.no_qc_batch) {
      if (!b.no_qc_batch.trim() || b.jumlah_item < 1) return false;
    }
    return true;
  };

  const handleStartManualRead = async () => {
    if (!isSetupValid()) return;
    setIsStarting(true);
    try {
      addLog("Starting manual read process...");

      const payload = {
        kategori_sampel: usageData.kategori_sampel,
        sampel: usageData.sampel.length > 0 ? usageData.sampel : ["Sample 1"],
        no_qc_batch: usageData.no_qc_batch,
        jumlah_item: totalItems,
        initial_condition: {},
        additional_data: {
          reading_mode: "manual",
          ...(isRereadMode && rereadContext
            ? {
              is_reread: true,
              existing_usage_id: rereadContext.rereadUsageId,
              reread_usage_id: rereadContext.rereadUsageId,
              reread_reason: rereadContext.reason,
              parent_usage_id: rereadContext.parentUsageId,
            }
            : {}),
        },
        checklist_responses: isRereadMode ? [] : usageData.checklist_responses,
      };

      const result = await axiosInstance.post(
        `/api/instruments/${instrumentId}/start-read`,
        payload
      );


      const newUsageId = result.data?.data?.usage_id;
      if (!newUsageId) throw new Error("No usage_id returned from server");

      setUsageId(newUsageId);
      setItems(buildItemList(usageData.no_qc_batch));
      setPhase("entry");
      onStarted?.(newUsageId);
      addLog(`✅ Read process started. Usage ID: ${newUsageId}`);
      addLog(`📋 Please enter values for ${totalItems} item(s) below.`);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message;
      addLog(`❌ Failed to start: ${msg}`);
      alert(`Failed to start read process: ${msg}`);
    } finally {
      setIsStarting(false);
    }
  };

  const handleSaveItem = async (index: number) => {
    if (!usageId) return;
    const item = items[index];

    const batchNo = item.batchNo?.trim()
      || usageData.no_qc_batch[0]?.no_qc_batch?.trim()
      || "";

    if (!batchNo) {
      alert("Batch number tidak ditemukan. Coba refresh halaman.");
      return;
    }

    if (!item.value.trim()) {
      alert("Please enter a value before saving.");
      return;
    }

    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, saving: true } : it))
    );

    try {
      addLog(`Saving item ${item.itemNumber} (batch: ${item.batchNo})...`);

      await axiosInstance.post("/api/instruments/save-result", {
        usage_id: usageId,
        no_qc_batch: batchNo,
        item_number: item.itemNumber,
        result_data: { value: item.value, unit: item.unit },
        final_condition: item.status,
      });

      setItems((prev) =>
        prev.map((it, i) =>
          i === index ? { ...it, saved: true, saving: false } : it
        )
      );
      addLog(`✅ Item ${item.itemNumber} saved (${item.value} ${item.unit})`);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message;
      addLog(`❌ Failed to save item ${item.itemNumber}: ${msg}`);
      setItems((prev) =>
        prev.map((it, i) => (i === index ? { ...it, saving: false } : it))
      );
      alert(`Failed to save item: ${msg}`);
    }
  };

  const allItemsSaved = items.length > 0 && items.every((it) => it.saved);
  const savedCount = items.filter((it) => it.saved).length;

  const handleEndRead = async () => {
    if (!usageId || !allItemsSaved) return;
    setIsEnding(true);
    try {
      addLog("Ending read process...");
      await axiosInstance.post(`/api/instruments/${instrumentId}/end-read`, {
        usage_id: usageId,
        final_condition: finalCondition,
        checklist_responses: [],
      });
      addLog(`✅ Read process completed. Final condition: ${finalCondition}`);
      onComplete(usageId);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message;
      addLog(`❌ Failed to end read: ${msg}`);
      alert(`Failed to end read process: ${msg}`);
    } finally {
      setIsEnding(false);
    }
  };

  const updateItem = (index: number, field: keyof ManualItem, value: any) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, [field]: value } : it))
    );
  };

  if (phase === "setup") {
    return (
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-secondary text-white">
          <h5 className="mb-0">
            <i className="bi bi-pencil-square me-2"></i>
            Manual Input — Setup
          </h5>
        </div>
        <div className="card-body">
          <div className="alert alert-info">
            <i className="bi bi-info-circle me-2"></i>
            This instrument is in <strong>manual input mode</strong>. You will
            enter reading values yourself for each sample item.
          </div>

          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <label className="form-label fw-semibold mb-0">
                Kategori Sampel <span className="text-danger">*</span>
              </label>
              <button
                type="button"
                className="btn btn-link btn-sm p-0 text-decoration-none"
                style={{ fontSize: '12px' }}
                onClick={() => {
                  setManualKategori(!manualKategori);
                  onKategoriChange('');
                }}
              >
                <i className={`bi bi-${manualKategori ? 'search' : 'pencil'} me-1`}></i>
                {manualKategori ? 'Pilih dari daftar' : 'Input manual'}
              </button>
            </div>
            {manualKategori ? (
              <input
                type="text"
                className="form-control"
                placeholder="Ketik kategori sampel..."
                value={kategoriSampel}
                onChange={(e) => onKategoriChange(e.target.value)}
              />
            ) : (
              <SearchableSelect
                options={kategoriOptions}
                value={kategoriSampel}
                onChange={onKategoriChange}
                placeholder="Search kategori sampel..."
              />
            )}
          </div>

          {(sampelOptions.length > 0 || manualSampel || manualKategori) && kategoriSampel && (
            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="form-label fw-semibold mb-0">Sampel</label>
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 text-decoration-none"
                  style={{ fontSize: '12px' }}
                  onClick={() => {
                    setManualSampel(!manualSampel);
                    onSampelChange('');
                  }}
                >
                  <i className={`bi bi-${manualSampel ? 'search' : 'pencil'} me-1`}></i>
                  {manualSampel ? 'Pilih dari daftar' : 'Input manual'}
                </button>
              </div>
              {manualSampel ? (
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ketik nama sampel..."
                  value={selectedSampel}
                  onChange={(e) => onSampelChange(e.target.value)}
                />
              ) : (
                <SearchableSelect
                  options={sampelOptions}
                  value={selectedSampel}
                  onChange={onSampelChange}
                  placeholder="Search sampel..."
                />
              )}
            </div>
          )}

          <div className="mb-3">
            <label className="form-label fw-semibold">
              No. QC Batch &amp; Jumlah Item{" "}
              <span className="text-danger">*</span>
            </label>
            {usageData.no_qc_batch.map((batch, idx) => (
              <div key={idx} className="d-flex gap-2 mb-2 align-items-center">
                <div className="flex-grow-1">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="No. QC Batch"
                    value={batch.no_qc_batch}
                    list={`batch-suggestions-${idx}`}
                    style={{ textTransform: 'uppercase' }}
                    onChange={(e) =>
                      onBatchUpdate(idx, "no_qc_batch", e.target.value.toUpperCase())
                    }
                  />
                  {recentBatches.length > 0 && (
                    <datalist id={`batch-suggestions-${idx}`}>
                      {recentBatches.map((b) => (
                        <option key={b} value={b} />
                      ))}
                    </datalist>
                  )}
                </div>
                <div style={{ width: "100px" }}>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Qty"
                    min={1}
                    value={batch.jumlah_item}
                    onChange={(e) =>
                      onBatchUpdate(
                        idx,
                        "jumlah_item",
                        parseInt(e.target.value) || 1
                      )
                    }
                  />
                </div>
                {usageData.no_qc_batch.length > 1 && (
                  <button
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => onRemoveBatch(idx)}
                  >
                    <i className="bi bi-trash"></i>
                  </button>
                )}
              </div>
            ))}
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={onAddBatch}
            >
              <i className="bi bi-plus me-1"></i>Add Batch
            </button>
            <div className="mt-2 text-muted small">
              Total items:{" "}
              <strong className="text-primary">{totalItems}</strong>
            </div>
          </div>

          <div className="d-flex gap-2 mt-4">
            <button
              className="btn btn-primary btn-lg"
              onClick={handleStartManualRead}
              disabled={!isSetupValid() || isStarting}
            >
              {isStarting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Starting...
                </>
              ) : (
                <>
                  <i className="bi bi-play-circle me-2"></i>
                  Start &amp; Enter Values
                </>
              )}
            </button>
            <button className="btn btn-outline-secondary" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-primary text-white">
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            <i className="bi bi-input-cursor-text me-2"></i>
            Manual Input — Enter Values
          </h5>
          <span className="badge bg-light text-dark">
            {savedCount} / {items.length} saved
          </span>
        </div>
      </div>

      <div className="card-body">
        <div className="progress mb-3" style={{ height: "20px" }}>
          <div
            className="progress-bar bg-success"
            style={{
              width: `${items.length ? (savedCount / items.length) * 100 : 0}%`,
            }}
          >
            {items.length
              ? ((savedCount / items.length) * 100).toFixed(0)
              : 0}
            %
          </div>
        </div>

        {(() => {
          const batchKeys = items.length > 0
            ? [...new Set(items.map(it => it.batchNo))]
            : usageData.no_qc_batch.map(b => b.no_qc_batch).filter(Boolean);

          return batchKeys.map((batchNo) => {
            const batchItems = items.filter((it) => it.batchNo === batchNo);
            return (
              <div key={batchNo} className="mb-4">
                <h6 className="fw-bold text-secondary border-bottom pb-1 mb-3">
                  <i className="bi bi-tag me-1"></i>
                  Batch: <code>{batchNo}</code>
                </h6>
                {batchItems.map((item) => {
                  const globalIdx = items.findIndex(
                    (it) => it.batchNo === item.batchNo && it.itemNumber === item.itemNumber
                  );
                  return (
                    <div
                      key={`${item.batchNo}-${item.itemNumber}`}
                      className={`card mb-2 border ${item.saved ? "border-success bg-success bg-opacity-10" : "border-secondary"}`}
                    >
                      <div className="card-body py-2 px-3">
                        <div className="row g-2 align-items-center">
                          <div className="col-auto">
                            <span className="badge bg-secondary">Item #{item.itemNumber}</span>
                          </div>
                          <div className="col">
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="Value (e.g. 98.5)"
                              value={item.value}
                              disabled={item.saved}
                              onChange={(e) => updateItem(globalIdx, "value", e.target.value)}
                            />
                          </div>
                          <div className="col-2">
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="Unit"
                              value={item.unit}
                              disabled={item.saved}
                              onChange={(e) => updateItem(globalIdx, "unit", e.target.value)}
                            />
                          </div>
                          <div className="col-auto">
                            <div className="btn-group btn-group-sm">
                              <button
                                type="button"
                                className={`btn ${item.status === "OK" ? "btn-success" : "btn-outline-success"}`}
                                disabled={item.saved}
                                onClick={() => updateItem(globalIdx, "status", "OK")}
                              >OK</button>
                              <button
                                type="button"
                                className={`btn ${item.status === "NOT OK" ? "btn-danger" : "btn-outline-danger"}`}
                                disabled={item.saved}
                                onClick={() => updateItem(globalIdx, "status", "NOT OK")}
                              >NOT OK</button>
                            </div>
                          </div>
                          <div className="col-auto">
                            {item.saved ? (
                              <span className="text-success fw-bold">
                                <i className="bi bi-check-circle-fill me-1"></i>Saved
                              </span>
                            ) : (
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => handleSaveItem(globalIdx)}
                                disabled={item.saving || !item.value.trim()}
                              >
                                {item.saving
                                  ? <span className="spinner-border spinner-border-sm"></span>
                                  : <><i className="bi bi-save me-1"></i>Save</>
                                }
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          });
        })()}

        {allItemsSaved && (
          <div className="alert alert-success mt-3">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
              <div>
                <h6 className="mb-1">
                  <i className="bi bi-check-circle-fill me-2"></i>
                  All items entered! Set final instrument condition:
                </h6>
                <div className="btn-group">
                  <button
                    type="button"
                    className={`btn ${finalCondition === "OK"
                      ? "btn-success"
                      : "btn-outline-success"
                      }`}
                    onClick={() => setFinalCondition("OK")}
                  >
                    <i className="bi bi-check-circle me-1"></i>OK
                  </button>
                  <button
                    type="button"
                    className={`btn ${finalCondition === "NOT OK"
                      ? "btn-danger"
                      : "btn-outline-danger"
                      }`}
                    onClick={() => setFinalCondition("NOT OK")}
                  >
                    <i className="bi bi-x-circle me-1"></i>NOT OK
                  </button>
                </div>
              </div>
              <button
                className="btn btn-success btn-lg"
                onClick={handleEndRead}
                disabled={isEnding}
              >
                {isEnding ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Finishing...
                  </>
                ) : (
                  <>
                    <i className="bi bi-flag-fill me-2"></i>
                    Finish & Submit Results
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {logs.length > 0 && (
          <div className="card bg-dark text-light mt-3">
            <div className="card-header py-1">
              <small>
                <i className="bi bi-terminal me-1"></i>Process Log
              </small>
            </div>
            <div
              className="card-body p-2"
              style={{
                fontFamily: "monospace",
                fontSize: "0.8rem",
                maxHeight: "180px",
                overflowY: "auto",
              }}
            >
              {logs.map((log, i) => (
                <div
                  key={i}
                  className={
                    log.includes("❌")
                      ? "text-danger"
                      : log.includes("✅")
                        ? "text-success"
                        : "text-light"
                  }
                >
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card-footer bg-light d-flex justify-content-between align-items-center">
        <small className="text-muted">Usage ID: {usageId}</small>
        <small className="text-muted">
          {savedCount}/{items.length} items saved
        </small>
      </div>
    </div>
  );
};

// ==================== READING RESULT ====================
const ReadingResult = ({ usageId, onReset, onViewDetails }: any) => {
  const navigate = useNavigate();
  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-success text-white">
        <h5 className="mb-0">
          <i className="bi bi-check-circle me-2"></i>Reading Process Completed
        </h5>
      </div>
      <div className="card-body">
        <div className="alert alert-success">
          <i className="bi bi-check-circle me-2"></i>
          All items have been successfully read!
        </div>
        <div className="d-flex gap-2 justify-content-end">
          <button className="btn btn-secondary" onClick={onReset}>
            <i className="bi bi-arrow-clockwise me-2"></i>Start New Reading
          </button>
          <button className="btn btn-info" onClick={onViewDetails}>
            <i className="bi bi-eye me-2"></i>View Instrument Details
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/instruments/after-reading/${usageId}`)}
          >
            <i className="bi bi-clipboard-check me-2"></i>View Results & Finalize
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== MAIN COMPONENT ====================
export default function ReadInstrumentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useInstrumentDetail(id!);

  if (isLoading || !data?.data) return <LoadingSpinner />;
  return (
    <ReadInstrumentPageContent
      data={data}
      refetch={refetch}
      id={id!}
      navigate={navigate}
    />
  );
}

// ==================== CONTENT COMPONENT ====================
function ReadInstrumentPageContent({
  data,
  refetch,
  id,
  navigate,
}: {
  data: any;
  refetch: () => void;
  id: string;
  navigate: any;
}) {
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const urlUsageId = searchParams.get("usage_id");

  let rereadContext = location.state as RereadContext | null;
  if (!rereadContext?.isReread) {
    const stored = sessionStorage.getItem(REREAD_CONTEXT_KEY);
    if (stored) {
      try {
        rereadContext = JSON.parse(stored);
        sessionStorage.removeItem(REREAD_CONTEXT_KEY);
      } catch {
        // ignore
      }
    }
  } else {
    sessionStorage.removeItem(REREAD_CONTEXT_KEY);
  }

  const isRereadMode = rereadContext?.isReread === true;
  const rereadInitialized = useRef(false);
  const [allowAutoNavigate, setAllowAutoNavigate] = useState(!isRereadMode);
  useEffect(() => {
    if (urlUsageId) {
      setAllowAutoNavigate(true);
    }
  }, []);
  const [productList, setproductList] = useState<{ kategori: string; itemName: string; itemCode: string }[]>([]);
  const [kategoriOptions, setKategoriOptions] = useState<string[]>([]);

  const instrumentData = data.data;
  const instrumentName =
    instrumentData.nama_instrument || instrumentData.name || "Instrument";
  const configuration =
    instrumentData.configuration || instrumentData.Configuration || {};
  const hasConfig = Object.keys(configuration).length > 0;

  const rawReadingMode = configuration.reading_mode ?? "auto";
  const isManualMode = !hasConfig || rawReadingMode === "manual";

  // ==================== PERSISTED STATE ====================
  // On mount, restore readingStep and usageId from sessionStorage (if available).
  // Re-read mode always starts fresh — its own useEffect handles initialization.
  const [readingStep, setReadingStep] = useState<ReadingStep>(() => {
    if (isRereadMode) return "checklist";
    if (urlUsageId) return isManualMode ? "manual-input" : "auto-reading";
    return getPersistedStep(id) ?? "checklist";
  });

  const [usageId, setUsageId] = useState<number | null>(() => {
    if (isRereadMode) return null;
    if (urlUsageId) return parseInt(urlUsageId); // ← pakai usage_id dari URL
    return getPersistedUsageId(id);
  });

  const [isResumingManual, setIsResumingManual] = useState(() => {
    if (isRereadMode) return false;
    // Resume dari sessionStorage (refresh)
    if (!!getPersistedUsageId(id) && getPersistedStep(id) === "manual-input") return true;
    // Resume dari URL (user lain / lintas browser)
    if (urlUsageId && isManualMode) return true;
    return false;
  });

  // Wrapper: update state AND persist to sessionStorage simultaneously
  const updateReadingStep = (step: ReadingStep) => {
    setReadingStep(step);
    persistStep(id, step);
  };

  const updateUsageId = (uid: number | null) => {
    setUsageId(uid);
    persistUsageId(id, uid);
  };

  // ==================== END PERSISTED STATE ====================

  const [readLogs, setReadLogs] = useState<string[]>([]);
  const [usageData, setUsageData] = useState<UsageFormData>({
    kategori_sampel: "",
    sampel: [],
    no_qc_batch: [{ no_qc_batch: "", jumlah_item: 1 }],
    initial_condition: {},
    additional_data: {},
    checklist_responses: [],
    mtsics_command: "SI",
  });
  // Restore usageData saat resume manual reading
  useEffect(() => {
    if (!isResumingManual || !usageId) return;

    axiosInstance.get(`/api/instruments/usage/${usageId}`)
      .then(res => {
        const usage = res.data?.data;
        if (!usage) return;

        let batches: BatchData[] = [{ no_qc_batch: "", jumlah_item: 1 }];
        try {
          const parsed = JSON.parse(usage.no_qc_batch);
          if (Array.isArray(parsed)) {
            // Format array of objects: [{no_qc_batch, jumlah_item}]
            if (parsed[0] && typeof parsed[0] === "object" && "no_qc_batch" in parsed[0]) {
              batches = parsed;
            }
            // Format array of strings: ["BATCH001", "BATCH002"]
            else if (typeof parsed[0] === "string") {
              batches = parsed.map((b: string) => ({ no_qc_batch: b, jumlah_item: 1 }));
            }
          }
        } catch { }

        setUsageData(prev => ({
          ...prev,
          kategori_sampel: usage.kategori_sampel || prev.kategori_sampel,
          no_qc_batch: batches,
        }));
      })
      .catch(() => { });
  }, []);

  const [sampelOptions, setSampelOptions] = useState<string[]>([]);
  const [selectedSampel, setSelectedSampel] = useState<string>("");
  const [recentBatches, setRecentBatches] = useState<string[]>([]);
  const [timeoutRemaining, setTimeoutRemaining] = useState(600);
  const [showMtsicsSelector, setShowMtsicsSelector] = useState(false);

  const startAutoReadMutation = useStartAutoRead();
  const validateChecklistMutation = useValidateChecklist();

  const { data: progressData } = useReadProgress(
    usageId,
    readingStep === "auto-reading"
  );

  const { data: liveResultsData } = useLiveResults(
    usageId,
    readingStep === "auto-reading"
  );

  const { data: checklistData, isLoading: isLoadingChecklist } = useChecklist(
    id,
    "initial",
    readingStep === "checklist" && !isRereadMode
  );

  const totalItems = usageData.no_qc_batch.reduce(
    (sum, batch) => sum + batch.jumlah_item,
    0
  );

  const rawSchema = configuration.reading_schema;
  const readingSchema =
    typeof rawSchema === "string"
      ? (() => {
        try {
          return JSON.parse(rawSchema);
        } catch {
          return { inputs: [], outputs: [] };
        }
      })()
      : typeof rawSchema === "object" && rawSchema !== null
        ? rawSchema
        : { inputs: [], outputs: [] };

  const needsBatch = configuration.needs_batch ?? true;
  const needsSample = configuration.needs_sample ?? true;
  const readingMode = rawReadingMode as "auto" | "single" | "manual-trigger";

  const progress = progressData?.data || {};
  const status = progress.status || "Processing";
  const current = progress.completed_items || 0;

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setReadLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  const fetchRecentBatches = async () => {
    try {
      const response = await axiosInstance.get(
        `/api/instruments/${id}/usage-history`
      );
      if (response.data?.data?.unified_history) {
        const batches = new Set<string>();
        response.data.data.unified_history.forEach((item: any) => {
          if (item.type === "usage" && item.no_qc_batch) {
            try {
              const parsed = JSON.parse(item.no_qc_batch);
              if (Array.isArray(parsed))
                parsed.forEach((b: string) => batches.add(b.toUpperCase())); // ← tambah .toUpperCase()
            } catch {
              if (typeof item.no_qc_batch === "string")
                batches.add(item.no_qc_batch.toUpperCase()); // ← tambah .toUpperCase()
            }
          }
        });
        setRecentBatches(Array.from(batches));
      }
    } catch {
      setRecentBatches([]);
    }
  };

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await getProducts({ limit: 1000 });
        const items = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.data?.data)
            ? res.data.data
            : [];

        setproductList(items.map((p: any) => ({
          kategori: p.kategori_sampel,
          itemName: p.item_name,
          itemCode: p.item_code,
        })));
        const cats = [...new Set(items.map((p: any) => p.kategori_sampel as string))] as string[];
        setKategoriOptions(cats);
      } catch (e) {
        console.error("fetchProducts error:", e);
        setKategoriOptions([]);
      }
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    if (isRereadMode && rereadContext && !rereadInitialized.current) {
      rereadInitialized.current = true;

      // Clear any stale persisted state so re-read always starts clean
      clearPersistedReadingState(id);

      const itemCount = rereadContext.itemNumber
        ? 1
        : usageData.no_qc_batch[0]?.jumlah_item || 1;
      setSampelOptions(
        rereadContext.kategoriSampel
          ? productList
            .filter((p) => p.kategori === rereadContext.kategoriSampel)
            .map((p) => `${p.itemCode} - ${p.itemName}`)
          : []
      );

      setUsageData({
        kategori_sampel: rereadContext.kategoriSampel || "",
        sampel: rereadContext.sampel || [],
        no_qc_batch: [
          {
            no_qc_batch: rereadContext.batchNumber?.toUpperCase() || "", // ← tambah .toUpperCase()
            jumlah_item: itemCount,
          },
        ],
        initial_condition: {},
        additional_data: {
          is_reread: true,
          reread_usage_id: rereadContext.rereadUsageId,
          existing_usage_id: rereadContext.rereadUsageId,
          reread_reason: rereadContext.reason,
          parent_usage_id: rereadContext.parentUsageId,
          reread_item_number: rereadContext.itemNumber,
        },
        checklist_responses: [],
        mtsics_command: "SI",
      });
      if (rereadContext.sampel?.length > 0)
        setSelectedSampel(rereadContext.sampel[0]);

      // Use plain setters here (not updateX wrappers) — re-read must NOT persist these
      setUsageId(rereadContext.rereadUsageId);
      setReadingStep(isManualMode ? "manual-input" : "initial");
      setAllowAutoNavigate(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (checklistData?.data?.checklist_items && !isRereadMode) {
      const initialResponses = checklistData.data.checklist_items.map(
        (item: any) => ({
          id: item.id,
          value: item.type === "boolean" ? false : item.type === "number" ? 0 : "",
          ok: false,
          note: "",
        })
      );
      setUsageData((prev) => ({
        ...prev,
        checklist_responses: initialResponses,
      }));
    }
  }, [checklistData, isRereadMode]);

  useEffect(() => {
    if (!isRereadMode) fetchRecentBatches();
  }, [id, isRereadMode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (usageData.kategori_sampel) {
      const filtered = productList
        .filter((p) => p.kategori === usageData.kategori_sampel)
        .map((p) => `${p.itemCode} - ${p.itemName}`);
      setSampelOptions(filtered);
      if (!isRereadMode && !isResumingManual) {
        setSelectedSampel("");
        setUsageData((prev) => ({ ...prev, sampel: [] }));
      }
    } else {
      setSampelOptions([]);
      if (!isResumingManual) setSelectedSampel("");
    }
  }, [usageData.kategori_sampel, productList, isRereadMode]);

  useEffect(() => {
    const isTcpConnection =
      configuration.ip_address && configuration.ip_address !== "";
    const iname = instrumentData.nama?.toLowerCase() || "";
    const isMettlerToledo =
      iname.includes("mettler") || iname.includes("toledo");
    setShowMtsicsSelector(isTcpConnection && isMettlerToledo);
  }, [configuration, instrumentData]);

  useEffect(() => {
    if (status !== "Processing" || readingStep !== "auto-reading") return;
    const interval = setInterval(() => {
      setTimeoutRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [status, readingStep]);

  useEffect(() => {
    if (current > 0) setTimeoutRemaining(600);
  }, [current]);

  useEffect(() => {
    const p = progressData?.data;
    if (!p) return;

    const isTerminal =
      p.status === "Done Read" ||
      p.status === "Completed with Errors" ||
      p.status === "Re-read" ||
      p.status === "Failed";

    if (isTerminal && allowAutoNavigate && usageId) {
      addLog(`✅ Auto-read completed: ${p.status}`);
      clearPersistedReadingState(id); // clear before navigating away
      navigate(`/instruments/after-reading/${usageId}`);
      return;
    }

    if (allowAutoNavigate && readingStep === "auto-reading" && isTerminal) {
      clearPersistedReadingState(id); // clear before navigating away
      navigate(`/instruments/after-reading/${usageId}`);
    }
  }, [progressData, allowAutoNavigate, usageId, readingStep]);

  const handleValidateChecklist = async () => {
    try {
      const result = await validateChecklistMutation.mutateAsync({
        instrumentId: parseInt(id!),
        checklistType: "initial",
        responses: usageData.checklist_responses,
      });

      if (result.data.can_proceed) {
        addLog("✅ Checklist validated successfully");
        updateReadingStep(isManualMode ? "manual-input" : "initial");
      } else {
        // 1. Show critical failure notification
        addLog("❌ Critical checklist item failed — instrument set to Unavailable");
        alert(
          `⚠️ Critical Validation Failed\n\n${result.data.message || "A critical checklist item was marked NOT OK."}\n\nThe instrument will be set to Unavailable and the reading process has been stopped.`
        );

        // 2. Call API to set instrument status to unavailable
        try {
          await axiosInstance.patch(`/api/instruments/${id}/status`, {
            status: "Unavailable",
            reason: result.data.message || "Critical checklist item failed",
          });
          addLog("🔒 Instrument status updated to Unavailable");
          refetch(); // Refresh instrument data to reflect new status
        } catch (statusErr: any) {
          addLog("⚠️ Failed to update instrument status: " + (statusErr.response?.data?.message || statusErr.message));
        }

        // 3. Stay on checklist step — do NOT proceed
        // (no updateReadingStep call = reading process is blocked)
      }
    } catch (err: any) {
      alert(
        "Failed to validate checklist: " +
        (err.response?.data?.message || err.message)
      );
    }
  };

  const handleStartAutoRead = async () => {
    try {
      addLog(
        `Starting ${isRereadMode ? "RE-READ" : "AUTO-READ"} for ${totalItems} items...`
      );

      const payload: any = {
        kategori_sampel: usageData.kategori_sampel,
        sampel:
          usageData.sampel.length > 0 ? usageData.sampel : ["Sample 1"],
        no_qc_batch: usageData.no_qc_batch,
        jumlah_item: totalItems,
        initial_condition: usageData.initial_condition,
        additional_data: {
          ...usageData.additional_data,
          mtsics_command: usageData.mtsics_command,
        },
        checklist_responses: isRereadMode ? [] : usageData.checklist_responses,
      };

      if (isRereadMode && rereadContext) {
        payload.additional_data = {
          ...payload.additional_data,
          is_reread: true,
          existing_usage_id: rereadContext.rereadUsageId,
          reread_usage_id: rereadContext.rereadUsageId,
          reread_context: {
            parent_usage_id: rereadContext.parentUsageId,
            original_batch: rereadContext.batchNumber,
            original_item: rereadContext.itemNumber,
            reread_reason: rereadContext.reason,
          },
        };
      }

      const result = await startAutoReadMutation.mutateAsync({
        id: id!,
        data: payload,
      });

      if (result.data?.usage_id) {
        const receivedUsageId = result.data.usage_id;
        updateUsageId(receivedUsageId);
        updateReadingStep("auto-reading");
        setAllowAutoNavigate(true);
        addLog(`✅ Auto-read started! Usage ID: ${receivedUsageId}`);
        refetch();
      } else {
        throw new Error("Invalid API response: missing usage_id");
      }
    } catch (err: any) {
      const errorData = err.response?.data;
      let errorMsg = `Failed to start ${isRereadMode ? "re-read" : "auto-read"}`;
      if (errorData?.message) errorMsg += `: ${errorData.message}`;
      if (errorData?.error) errorMsg += `\nDetails: ${errorData.error}`;
      addLog(`❌ Error: ${err.response?.data?.message || err.message}`);
      alert(errorMsg);
    }
  };

  const handleReset = () => {
    // Clear persisted state so the next visit starts fresh
    clearPersistedReadingState(id);

    updateReadingStep("checklist");
    updateUsageId(null);
    setReadLogs([]);
    setUsageData({
      kategori_sampel: "",
      sampel: [],
      no_qc_batch: [{ no_qc_batch: "", jumlah_item: 1 }],
      initial_condition: {},
      additional_data: {},
      checklist_responses: [],
      mtsics_command: "SI",
    });
    setSelectedSampel("");
    setTimeoutRemaining(60);
    setAllowAutoNavigate(false);
    fetchRecentBatches();
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="container mt-3">
      <div className="row">
        <div className="col-md-2">
          <SidebarMenu
            isHorizontal={false}
            isSidebarOpen={isSidebarOpen}
            toggleSidebar={() => setIsSidebarOpen((p) => !p)}
          />
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="btn btn-link text-dark p-0 me-3"
            style={{ fontSize: "1.5rem" }}
          >
            <i className="bi bi-list"></i>
          </button>
        </div>

        <div className="col-md-12">
          <div className="card mb-3">
            <div className="card-body">
              <h4 className="mb-2">{instrumentName}</h4>
              <div className="d-flex gap-2 flex-wrap">
                <span className="badge bg-info">
                  {instrumentData?.status || "Unknown"}
                </span>
                <span className="badge bg-secondary">
                  {instrumentData?.nomor_kontrol ||
                    instrumentData?.instrument_code ||
                    "-"}
                </span>
                {isManualMode && (
                  <span className="badge bg-warning text-dark">
                    <i className="bi bi-pencil me-1"></i>Manual Input Mode
                  </span>
                )}
              </div>
            </div>
          </div>

          {isRereadMode && rereadContext && (
            <RereadBanner context={rereadContext} />
          )}

          {isManualMode ? (
            <>
              {readingStep === "checklist" && !isRereadMode && (
                <>
                  {isLoadingChecklist && (
                    <div className="card">
                      <div className="card-body text-center">
                        <div className="spinner-border text-primary" />
                        <p className="mt-2">Loading checklist...</p>
                      </div>
                    </div>
                  )}

                  {/* Checklist exists → show it */}
                  {!isLoadingChecklist && checklistData?.data && (
                    <ChecklistForm
                      instrumentId={id!}
                      checklistItems={checklistData.data.checklist_items}
                      responses={usageData.checklist_responses}
                      onResponseChange={(r) =>
                        setUsageData({ ...usageData, checklist_responses: r })
                      }
                      onValidate={handleValidateChecklist}
                      onCancel={() => navigate(`/instruments/${id}`)}
                      isValidating={validateChecklistMutation.isPending}
                    />
                  )}

                  {/* No checklist configured → skip straight to manual input */}
                  {!isLoadingChecklist && !checklistData?.data && (
                    <ManualInputReading
                      instrumentId={id!}
                      usageData={usageData}
                      onCancel={() => navigate(`/instruments/${id}`)}
                      onComplete={(uid) => {
                        clearPersistedReadingState(id);
                        setUsageId(uid);
                        navigate(`/instruments/after-reading/${uid}`);
                      }}
                      isRereadMode={isRereadMode}
                      rereadContext={rereadContext}
                      recentBatches={recentBatches}
                      sampelOptions={sampelOptions}
                      selectedSampel={selectedSampel}
                      kategoriSampel={usageData.kategori_sampel}
                      onKategoriChange={(v) => setUsageData({ ...usageData, kategori_sampel: v })}
                      onSampelChange={(v) => {
                        setSelectedSampel(v);
                        setUsageData({ ...usageData, sampel: v ? [v] : [] });
                      }}
                      onBatchUpdate={(index, field, value) => {
                        const newBatches = [...usageData.no_qc_batch];
                        newBatches[index] = { ...newBatches[index], [field]: value };
                        setUsageData({ ...usageData, no_qc_batch: newBatches });
                      }}
                      onAddBatch={() => setUsageData({ ...usageData, no_qc_batch: [...usageData.no_qc_batch, { no_qc_batch: "", jumlah_item: 1 }] })}
                      onRemoveBatch={(index) => setUsageData({ ...usageData, no_qc_batch: usageData.no_qc_batch.filter((_, i) => i !== index) })}
                      totalItems={totalItems}
                      kategoriOptions={kategoriOptions}
                      onStarted={(uid) => {
                        updateUsageId(uid);
                        updateReadingStep("manual-input");
                      }}
                    />
                  )}
                </>
              )}

              {/* Reread skips checklist entirely */}
              {readingStep === "checklist" && isRereadMode && (
                <ManualInputReading
                  instrumentId={id!}
                  usageData={usageData}
                  onCancel={() => navigate(`/instruments/${id}`)}
                  onComplete={(uid) => {
                    clearPersistedReadingState(id);
                    setUsageId(uid);
                    navigate(`/instruments/after-reading/${uid}`);
                  }}
                  isRereadMode={isRereadMode}
                  rereadContext={rereadContext}
                  recentBatches={recentBatches}
                  sampelOptions={sampelOptions}
                  selectedSampel={selectedSampel}
                  kategoriSampel={usageData.kategori_sampel}
                  onKategoriChange={(v) => setUsageData({ ...usageData, kategori_sampel: v })}
                  onSampelChange={(v) => {
                    setSelectedSampel(v);
                    setUsageData({ ...usageData, sampel: v ? [v] : [] });
                  }}
                  onBatchUpdate={(index, field, value) => {
                    const newBatches = [...usageData.no_qc_batch];
                    newBatches[index] = { ...newBatches[index], [field]: value };
                    setUsageData({ ...usageData, no_qc_batch: newBatches });
                  }}
                  onAddBatch={() =>
                    setUsageData({
                      ...usageData,
                      no_qc_batch: [...usageData.no_qc_batch, { no_qc_batch: "", jumlah_item: 1 }],
                    })
                  }
                  onRemoveBatch={(index) =>
                    setUsageData({
                      ...usageData,
                      no_qc_batch: usageData.no_qc_batch.filter((_, i) => i !== index),
                    })
                  }
                  totalItems={totalItems}
                  kategoriOptions={kategoriOptions}
                  onStarted={(uid) => {
                    console.log("🔍 onStarted called with uid:", uid);
                    updateUsageId(uid);
                    updateReadingStep("manual-input");
                    console.log("🔍 sessionStorage after update:", {
                      step: sessionStorage.getItem(`reading_step_${id}`),
                      usage: sessionStorage.getItem(`reading_usage_${id}`),
                    });
                  }}
                />
              )}


              {readingStep === "manual-input" && (
                <ManualInputReading
                  instrumentId={id!}
                  usageData={usageData}
                  onCancel={() => navigate(`/instruments/${id}`)}
                  onComplete={(uid) => {
                    clearPersistedReadingState(id);
                    setUsageId(uid);
                    navigate(`/instruments/after-reading/${uid}`);
                  }}
                  isRereadMode={isRereadMode}
                  rereadContext={rereadContext}
                  recentBatches={recentBatches}
                  sampelOptions={sampelOptions}
                  selectedSampel={selectedSampel}
                  kategoriSampel={usageData.kategori_sampel}
                  onKategoriChange={(v) => setUsageData({ ...usageData, kategori_sampel: v })}
                  onSampelChange={(v) => {
                    setSelectedSampel(v);
                    setUsageData({ ...usageData, sampel: v ? [v] : [] });
                  }}
                  onBatchUpdate={(index, field, value) => {
                    const newBatches = [...usageData.no_qc_batch];
                    newBatches[index] = { ...newBatches[index], [field]: value };
                    setUsageData({ ...usageData, no_qc_batch: newBatches });
                  }}
                  onAddBatch={() => setUsageData({ ...usageData, no_qc_batch: [...usageData.no_qc_batch, { no_qc_batch: "", jumlah_item: 1 }] })}
                  onRemoveBatch={(index) => setUsageData({ ...usageData, no_qc_batch: usageData.no_qc_batch.filter((_, i) => i !== index) })}
                  totalItems={totalItems}
                  kategoriOptions={kategoriOptions}
                  initialPhase={isResumingManual ? "entry" : "setup"}
                  initialUsageId={isResumingManual ? usageId : null}
                  onStarted={(uid) => {
                    setIsResumingManual(false);
                    updateUsageId(uid);
                    updateReadingStep("manual-input"); // ← persist untuk refresh, komponen tidak unmount
                  }}
                />
              )}

              {readingStep === "result" && (
                <ReadingResult
                  usageId={usageId}
                  onReset={handleReset}
                  onViewDetails={() => navigate(`/instruments/${id}`)}
                />
              )}
            </>
          ) : (
            <>
              {isLoadingChecklist && readingStep === "checklist" && !isRereadMode ? (
                <div className="card">
                  <div className="card-body text-center">
                    <div className="spinner-border text-primary" />
                    <p className="mt-2">Loading checklist...</p>
                  </div>
                </div>
              ) : (
                <>
                  {readingStep === "checklist" &&
                    checklistData?.data &&
                    !isRereadMode && (
                      <ChecklistForm
                        instrumentId={id!}
                        checklistItems={checklistData.data.checklist_items}
                        responses={usageData.checklist_responses}
                        onResponseChange={(r) =>
                          setUsageData({
                            ...usageData,
                            checklist_responses: r,
                          })
                        }
                        onValidate={handleValidateChecklist}
                        onCancel={() => navigate(`/instruments/${id}`)}
                        isValidating={validateChecklistMutation.isPending}
                      />
                    )}

                  {readingStep === "checklist" &&
                    !isLoadingChecklist &&
                    (!checklistData?.data || isRereadMode) && (
                      <DynamicReadingForm
                        schema={readingSchema}
                        needsBatch={needsBatch}
                        needsSample={needsSample}
                        readingMode={readingMode}
                        usageData={usageData}
                        onInputChange={(field, value) =>
                          setUsageData((prev) => ({
                            ...prev,
                            initial_condition: {
                              ...prev.initial_condition,
                              [field]: value,
                            },
                          }))
                        }
                        onBatchUpdate={(index, field, value) => {
                          const newBatches = [...usageData.no_qc_batch];
                          newBatches[index] = {
                            ...newBatches[index],
                            [field]: value,
                          };
                          setUsageData({
                            ...usageData,
                            no_qc_batch: newBatches,
                          });
                        }}
                        onAddBatch={() =>
                          setUsageData({
                            ...usageData,
                            no_qc_batch: [
                              ...usageData.no_qc_batch,
                              { no_qc_batch: "", jumlah_item: 1 },
                            ],
                          })
                        }
                        onRemoveBatch={(index) => {
                          const newBatches = usageData.no_qc_batch.filter(
                            (_, i) => i !== index
                          );
                          setUsageData({
                            ...usageData,
                            no_qc_batch: newBatches,
                          });
                        }}
                        onStartRead={handleStartAutoRead}
                        onCancel={() => navigate(`/instruments/${id}`)}
                        isLoading={startAutoReadMutation.isPending}
                        totalItems={totalItems}
                        recentBatches={recentBatches}
                        sampelOptions={sampelOptions}
                        selectedSampel={selectedSampel}
                        kategoriSampel={usageData.kategori_sampel}
                        onKategoriChange={(value) =>
                          setUsageData({
                            ...usageData,
                            kategori_sampel: value,
                          })
                        }
                        onSampelChange={(value) => {
                          setSelectedSampel(value);
                          setUsageData({
                            ...usageData,
                            sampel: value ? [value] : [],
                          });
                        }}
                        showMtsicsSelector={showMtsicsSelector}
                        mtsicsCommand={usageData.mtsics_command}
                        onMtsicsCommandChange={(cmd) =>
                          setUsageData({ ...usageData, mtsics_command: cmd })
                        }
                        instrumentConfig={configuration}
                        kategoriOptions={kategoriOptions}
                      />
                    )}

                  {readingStep === "initial" && (
                    <DynamicReadingForm
                      schema={readingSchema}
                      needsBatch={needsBatch}
                      needsSample={needsSample}
                      readingMode={readingMode}
                      usageData={usageData}
                      onInputChange={(field, value) =>
                        setUsageData((prev) => ({
                          ...prev,
                          initial_condition: {
                            ...prev.initial_condition,
                            [field]: value,
                          },
                        }))
                      }
                      onBatchUpdate={(index, field, value) => {
                        const newBatches = [...usageData.no_qc_batch];
                        newBatches[index] = { ...newBatches[index], [field]: value };
                        setUsageData({ ...usageData, no_qc_batch: newBatches });
                      }}
                      onAddBatch={() =>
                        setUsageData({
                          ...usageData,
                          no_qc_batch: [...usageData.no_qc_batch, { no_qc_batch: "", jumlah_item: 1 }],
                        })
                      }
                      onRemoveBatch={(index) => {
                        const newBatches = usageData.no_qc_batch.filter((_, i) => i !== index);
                        setUsageData({ ...usageData, no_qc_batch: newBatches });
                      }}
                      onStartRead={handleStartAutoRead}
                      onCancel={() => navigate(`/instruments/${id}`)}
                      isLoading={startAutoReadMutation.isPending}
                      totalItems={totalItems}
                      recentBatches={recentBatches}
                      sampelOptions={sampelOptions}
                      selectedSampel={selectedSampel}
                      kategoriSampel={usageData.kategori_sampel}
                      onKategoriChange={(value) => setUsageData({ ...usageData, kategori_sampel: value })}
                      onSampelChange={(value) => {
                        setSelectedSampel(value);
                        setUsageData({ ...usageData, sampel: value ? [value] : [] });
                      }}
                      showMtsicsSelector={showMtsicsSelector}
                      mtsicsCommand={usageData.mtsics_command}
                      onMtsicsCommandChange={(cmd) => setUsageData({ ...usageData, mtsics_command: cmd })}
                      instrumentConfig={configuration}
                      kategoriOptions={kategoriOptions}
                    />
                  )}

                  {readingStep === "auto-reading" && (
                    <AutoReadProgress
                      usageId={usageId}
                      progressData={progressData?.data}
                      readLogs={readLogs}
                      timeoutRemaining={timeoutRemaining}
                      liveResults={liveResultsData?.data?.results}
                    />
                  )}

                  {readingStep === "result" && (
                    <ReadingResult
                      usageId={usageId}
                      onReset={handleReset}
                      onViewDetails={() => navigate(`/instruments/${id}`)}
                    />
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
