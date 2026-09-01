import { useState, useEffect } from "react";
import axiosInstance from "../services/api";

interface Result {
  id: number;
  no_qc_batch: string;
  item_number: number;
  result_data: Record<string, any>;
  created_at: string;
  instrument_usage_id: number;
}

interface PDFGeneratorButtonProps {
  usageId: number;
  instrumentName?: string;
  disabled?: boolean;
  className?: string;
  onSaveToPath?: (usageId: number) => Promise<void>;
  onSuccess?: (pdfPath: string) => void;
  onError?: (error: string) => void;
  onDownloadComplete?: () => void;
}

export default function PDFGeneratorButton({
  usageId,
  instrumentName = "Instrument",
  disabled = false,
  className = "",
  onSaveToPath,
  onSuccess,
  onError,
  onDownloadComplete,
}: PDFGeneratorButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [selectedResultIds, setSelectedResultIds] = useState<number[]>([]);
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);
  const [pdfGenerated, setPdfGenerated] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (showResultModal) {
      setSelectedResultIds([]);
      if (results.length === 0) {
        loadResults();
      }
    }
  }, [showResultModal]);

  const loadResults = async () => {
    try {
      setIsLoadingResults(true);
      const response = await axiosInstance.get(
        `/api/instruments/usage/${usageId}/results`
      );

      let allResults = [];
      if (response.data?.data?.results) {
        allResults = response.data.data.results;
      } else if (response.data?.results) {
        allResults = response.data.results;
      } else if (Array.isArray(response.data?.data)) {
        allResults = response.data.data;
      } else if (Array.isArray(response.data)) {
        allResults = response.data;
      }

      const filteredResults = allResults.filter((result: any) => {
        const resultUsageId = result.instrument_usage_id || result.InstrumentUsageID;
        return resultUsageId === usageId;
      });

      setResults(
        filteredResults.sort((a: any, b: any) => a.item_number - b.item_number)
      );
    } catch (err) {
      console.error("❌ Error loading results:", err);
      alert("❌ Failed to load results");
    } finally {
      setIsLoadingResults(false);
    }
  };

  const handleViewDetail = (result: Result) => {
    setSelectedResult(result);
    setShowDetailModal(true);
  };

  const handleToggleResult = (resultId: number) => {
    setSelectedResultIds(prev =>
      prev.includes(resultId)
        ? prev.filter(id => id !== resultId)
        : [...prev, resultId]
    );
  };

  const handleSelectAll = () => {
    if (selectedResultIds.length === results.length) {
      setSelectedResultIds([]);
    } else {
      setSelectedResultIds(results.map(r => r.id));
    }
  };

  // Step 1: Generate PDF on server (no file_path copy yet)
  const handleGeneratePDF = async () => {
    if (selectedResultIds.length === 0) {
      alert("⚠️ Please select at least one result");
      return;
    }
    try {
      setIsGenerating(true);
      const response = await axiosInstance.post("/api/instruments/export-pdf", {
        usage_id: usageId,
        result_ids: selectedResultIds,
        skip_path_copy: true,
      });
      if (response.data?.data?.pdf_path) {
        setPdfGenerated(true);
        setIsSaved(false);
        setShowResultModal(false);
        onSuccess?.(response.data.data.pdf_path);
      }
    } catch (err: any) {
      console.error("❌ Error generating PDF:", err);
      const errorMsg = err.response?.data?.message || "Failed to generate PDF";
      onError?.(errorMsg);
      alert(`❌ ${errorMsg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Step 2: Save PDF to server file_path only — no browser download
  const handleSaveToPath = async () => {
    try {
      setIsSaving(true);
      if (onSaveToPath) {
        await onSaveToPath(usageId);
      }
      setIsSaved(true);
      onDownloadComplete?.();
    } catch (err: any) {
      console.error("Error saving PDF to path:", err);
      alert("❌ Failed to save PDF. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderResultData = (data: Record<string, any>) => {
    if (!data || Object.keys(data).length === 0) {
      return <p className="text-muted">No data available</p>;
    }
    return (
      <table className="table table-sm table-bordered">
        <thead className="table-light">
          <tr>
            <th style={{ width: "40%" }}>Parameter</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data).map(([key, value]) => (
            <tr key={key}>
              <td className="fw-bold">{key}</td>
              <td>
                {typeof value === "object" ? (
                  <pre className="mb-0">{JSON.stringify(value, null, 2)}</pre>
                ) : (
                  String(value)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <>
      <div className={`d-flex gap-2 align-items-center ${className}`}>
        {!pdfGenerated ? (
          // State 1: not yet generated
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowResultModal(true)}
            disabled={disabled || isGenerating}
          >
            <i className="bi bi-file-pdf me-1"></i>
            Generate PDF
          </button>
        ) : isSaved ? (
          // State 3: saved — show success badge + regenerate
          <>
            <span className="badge bg-success py-2 px-3">
              <i className="bi bi-check-circle me-1"></i>
              Saved
            </span>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => {
                setShowResultModal(true);
                setPdfGenerated(false);
                setIsSaved(false);
              }}
              title="Regenerate PDF"
            >
              <i className="bi bi-arrow-clockwise"></i>
            </button>
          </>
        ) : (
          // State 2: generated, waiting for save
          <>
            <button
              className="btn btn-success btn-sm"
              onClick={handleSaveToPath}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1"></span>
                  Saving...
                </>
              ) : (
                <>
                  <i className="bi bi-folder-check me-1"></i>
                  Save PDF
                </>
              )}
            </button>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => {
                setShowResultModal(true);
                setPdfGenerated(false);
              }}
              disabled={isGenerating}
              title="Regenerate PDF"
            >
              <i className="bi bi-arrow-clockwise"></i>
            </button>
          </>
        )}
      </div>

      {/* Result Selection Modal */}
      {showResultModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowResultModal(false)}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-list-check me-2"></i>
                  Select Results for PDF Export
                  {selectedResultIds.length > 0 && (
                    <span className="badge bg-primary ms-2">
                      {selectedResultIds.length} selected
                    </span>
                  )}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowResultModal(false)}
                ></button>
              </div>

              <div className="modal-body" style={{ maxHeight: "60vh", overflowY: "auto" }}>
                {isLoadingResults ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-primary"></div>
                    <p className="mt-2">Loading results...</p>
                  </div>
                ) : results.length > 0 ? (
                  <>
                    <div className="d-flex justify-content-between align-items-center mb-3 p-3 bg-light rounded">
                      <div>
                        <strong className="text-primary">
                          <i className="bi bi-clipboard-data me-2"></i>
                          {results.length} Result{results.length !== 1 ? "s" : ""} Available
                        </strong>
                        <small className="text-muted d-block mt-1">
                          from Usage Session #{usageId}
                        </small>
                      </div>
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={handleSelectAll}
                      >
                        {selectedResultIds.length === results.length ? (
                          <><i className="bi bi-square me-1"></i>Deselect All</>
                        ) : (
                          <><i className="bi bi-check-square me-1"></i>Select All</>
                        )}
                      </button>
                    </div>

                    <div className="list-group">
                      {results.map((result) => (
                        <div
                          key={result.id}
                          className={`list-group-item ${
                            selectedResultIds.includes(result.id) ? "list-group-item-primary" : ""
                          }`}
                        >
                          <div className="d-flex align-items-start">
                            <input
                              type="checkbox"
                              className="form-check-input me-3 mt-1"
                              checked={selectedResultIds.includes(result.id)}
                              onChange={() => handleToggleResult(result.id)}
                              style={{ width: "20px", height: "20px", cursor: "pointer" }}
                            />
                            <div className="flex-grow-1">
                              <div className="d-flex justify-content-between align-items-start mb-2">
                                <div>
                                  <strong className="text-primary">Item #{result.item_number}</strong>
                                  <span className="badge bg-secondary ms-2">{result.no_qc_batch}</span>
                                  <small className="text-muted d-block mt-1">
                                    <i className="bi bi-clock me-1"></i>
                                    {new Date(result.created_at).toLocaleString("id-ID")}
                                  </small>
                                </div>
                                <button
                                  className="btn btn-sm btn-outline-info"
                                  onClick={() => handleViewDetail(result)}
                                  title="View Details"
                                >
                                  <i className="bi bi-eye"></i>
                                </button>
                              </div>

                              {result.result_data && Object.keys(result.result_data).length > 0 && (
                                <div className="mt-2 p-2 bg-light rounded">
                                  <small className="text-muted d-block mb-1">
                                    <strong>Data Preview:</strong>
                                  </small>
                                  <div className="d-flex flex-wrap gap-2">
                                    {Object.entries(result.result_data)
                                      .slice(0, 4)
                                      .map(([key, value]) => (
                                        <span key={key} className="badge bg-secondary">
                                          {key}: {String(value)}
                                        </span>
                                      ))}
                                    {Object.keys(result.result_data).length > 4 && (
                                      <span className="badge bg-info">
                                        +{Object.keys(result.result_data).length - 4} more
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="alert alert-warning">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    <strong>No results found for this usage session</strong>
                    <p className="mb-0 mt-2 small">Possible reasons:</p>
                    <ul className="small mb-0 mt-1">
                      <li>No items were tested in this session</li>
                      <li>Results were not saved properly during reading</li>
                      <li>The auto-read process encountered errors</li>
                    </ul>
                    <div className="mt-2">
                      <small className="text-muted"><strong>Usage ID:</strong> {usageId}</small>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowResultModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleGeneratePDF}
                  disabled={selectedResultIds.length === 0 || isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Generating...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-file-pdf me-2"></i>
                      Generate PDF ({selectedResultIds.length})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result Detail Modal */}
      {showDetailModal && selectedResult && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowDetailModal(false)}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="bi bi-clipboard-data me-2"></i>
                  Result Details - Item #{selectedResult.item_number}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowDetailModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="row mb-3">
                  <div className="col-md-6">
                    <p className="mb-2"><strong>No QC Batch:</strong> {selectedResult.no_qc_batch}</p>
                    <p className="mb-2"><strong>Item Number:</strong> #{selectedResult.item_number}</p>
                  </div>
                  <div className="col-md-6">
                    <p className="mb-2">
                      <strong>Created:</strong>{" "}
                      {new Date(selectedResult.created_at).toLocaleString("id-ID")}
                    </p>
                    <p className="mb-2"><strong>Usage ID:</strong> {selectedResult.instrument_usage_id}</p>
                  </div>
                </div>
                <hr />
                <h6 className="mb-3">
                  <i className="bi bi-table me-2"></i>Measurement Data
                </h6>
                {renderResultData(selectedResult.result_data)}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowDetailModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}