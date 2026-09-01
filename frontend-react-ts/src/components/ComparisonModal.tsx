import React from "react";
import { PendingApproval, ChangedItem } from "../types/instrument";

interface ComparisonModalProps {
  show: boolean;
  onClose: () => void;
  approval: PendingApproval | null;
  onApprove: (approval: PendingApproval, notes?: string) => void;
  onReject: (approval: PendingApproval, notes: string) => void;
}

export const ComparisonModal: React.FC<ComparisonModalProps> = ({
  show,
  onClose,
  approval,
  onApprove,
  onReject,
}) => {
  const [rejectNotes, setRejectNotes] = React.useState("");
  const [showRejectInput, setShowRejectInput] = React.useState(false);

  if (!show || !approval) return null;

  // ✅ AFTER — safe destructuring with fallbacks
  const original_reading = approval.original_reading;
  const reread_result = approval.reread_result;
  const comparison = approval.comparison ?? { has_changes: false, changed_items: [], condition_changed: false };

  // If comparison data hasn't loaded yet, show a simpler view
  if (!original_reading || !reread_result) {
    return (
      <div className="modal fade show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onClick={onClose}>
        <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title">Re-read Comparison</h5>
              <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
            </div>
            <div className="modal-body">
              <div className="alert alert-warning">
                <i className="bi bi-exclamation-triangle me-2"></i>
                Comparison data is not available yet. The re-read may still be processing.
              </div>
              <p><strong>Instrument:</strong> {approval.instrument_code} - {approval.instrument_name}</p>
              <p><strong>Batch:</strong> {approval.batch_number}</p>
              <p><strong>Reason:</strong> {approval.reason}</p>
              <p><strong>Requested by:</strong> {approval.user_name}</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleApprove = () => {
    onApprove(approval);
    onClose();
  };

  const handleReject = () => {
    if (!rejectNotes.trim()) {
      alert("Please provide a reason for rejection");
      return;
    }
    onReject(approval, rejectNotes);
    setRejectNotes("");
    setShowRejectInput(false);
    onClose();
  };

  const parseFinalCondition = (raw: string) => {
    if (!raw) return null;
    try {
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return null;
    }
  };

  const parseResultValue = (raw: string) => {
    if (!raw) return raw;
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return parsed?.value ?? raw;
    } catch {
      return raw;
    }
  };


  return (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content">
          {/* Header */}
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              <i className="bi bi-file-diff me-2"></i>
              Re-read Comparison
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
            ></button>
          </div>

          {/* Body */}
          <div className="modal-body">
            {/* Info Banner */}
            <div className="alert alert-info mb-4">
              <div className="row">
                <div className="col-md-6">
                  <strong>Instrument:</strong> {approval.instrument_code} -{" "}
                  {approval.instrument_name}
                  <br />
                  <strong>Batch:</strong> {approval.batch_number}
                </div>
                <div className="col-md-6">
                  <strong>Reason:</strong> {approval.reason}
                  <br />
                  <strong>Completed:</strong> {formatDate(approval.submitted_at || approval.requested_at)}
                  <br />
                  <strong>Requested by:</strong> {approval.user_name}
                </div>
              </div>
            </div>

            {/* Before/After Comparison */}
            <div className="row">
              {/* ORIGINAL READING */}
              <div className="col-md-6 mb-3">
                <div className="card border-secondary h-100">
                  <div className="card-header bg-secondary text-white">
                    <h6 className="mb-0">
                      <i className="bi bi-file-earmark me-2"></i>
                      Original Reading (Before)
                    </h6>
                    <small>Usage #{original_reading.usage_id}</small>
                  </div>
                  <div className="card-body">
                    <p className="mb-2">
                      <strong>Read at:</strong> {formatDate(original_reading.read_at)}
                    </p>
                    <p className="mb-2">
                      <strong>Read by:</strong> {original_reading.user_name}
                    </p>
                    <p className="mb-3">
                      <strong>Final Condition:</strong>{" "}
                      <span
                        className={`badge ${original_reading.final_condition === "OK"
                          ? "bg-success"
                          : "bg-danger"
                          }`}
                      >
                        {(() => {
                          const fc = parseFinalCondition(original_reading.final_condition);
                          const status = fc?.status ?? original_reading.final_condition ?? "—";
                          return (
                            <span className={`badge ${status === "OK" ? "bg-success" : "bg-danger"}`}>
                              {status}
                            </span>
                          );
                        })()}
                      </span>
                    </p>

                    <h6>Results:</h6>
                    <div className="table-responsive">
                      <table className="table table-sm table-bordered">
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th>Value</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {original_reading.results.map((result) => (
                            <tr key={result.item_number}>
                              <td>#{result.item_number}</td>
                              <td>
                                {result.value} {result.unit}
                              </td>
                              <td>
                                <span
                                  className={`badge ${result.status === "OK" ? "bg-success" : "bg-danger"
                                    }`}
                                >
                                  {result.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* RE-READ RESULT */}
              <div className="col-md-6 mb-3">
                <div className="card border-primary h-100">
                  <div className="card-header bg-primary text-white">
                    <h6 className="mb-0">
                      <i className="bi bi-arrow-repeat me-2"></i>
                      Re-read Result (After)
                    </h6>
                    <small>Usage #{reread_result.usage_id}</small>
                  </div>
                  <div className="card-body">
                    <p className="mb-2">
                      <strong>Read at:</strong> {formatDate(reread_result.read_at)}
                    </p>
                    <p className="mb-2">
                      <strong>Read by:</strong> {reread_result.user_name}
                    </p>
                    <p className="mb-3">
                      <strong>Final Condition:</strong>{" "}
                      <span
                        className={`badge ${reread_result.final_condition === "OK"
                          ? "bg-success"
                          : "bg-danger"
                          }`}
                      >
                        {(() => {
                          const fc = parseFinalCondition(reread_result.final_condition);
                          const status = fc?.status ?? reread_result.final_condition ?? "Pending";
                          return (
                            <span className={`badge ${status === "OK" ? "bg-success" : status === "Pending" ? "bg-warning text-dark" : "bg-danger"}`}>
                              {status}
                              {comparison.condition_changed && (
                                <i className="bi bi-arrow-left-right ms-2"></i>
                              )}
                            </span>
                          );
                        })()}
                      </span>
                    </p>

                    <h6>Results:</h6>
                    <div className="table-responsive">
                      <table className="table table-sm table-bordered">
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th>Value</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reread_result.results.map((result) => {
                            // Check if this item changed
                            const changed = comparison.changed_items.find(
                              (c: ChangedItem) => c.item_number === result.item_number
                            );

                            return (
                              <tr
                                key={result.item_number}
                                className={changed ? "table-warning" : ""}
                              >
                                <td>
                                  #{result.item_number}
                                  {changed && (
                                    <i className="bi bi-star-fill text-warning ms-1"></i>
                                  )}
                                </td>
                                <td>
                                  {result.value} {result.unit}                            
                                </td>
                                <td>
                                  <span
                                    className={`badge ${result.status === "OK" ? "bg-success" : "bg-danger"
                                      }`}
                                  >
                                    {result.status}
                                    {changed?.status_changed && (
                                      <i className="bi bi-arrow-left-right ms-1"></i>
                                    )}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Changes Summary */}
            {comparison.has_changes ? (
              <div className="alert alert-warning mt-3">
                <h6>
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  Changes Detected
                </h6>
                <ul className="mb-0">
                  {comparison.changed_items.map((change: ChangedItem) => (
                    <li key={change.item_number}>
                      <strong>Item #{change.item_number}:</strong>{" "}
                      {parseResultValue(change.original_value)} → {parseResultValue(change.reread_value)}
                      {change.difference && (
                        <span className="text-muted">
                          {" "}(Δ {change.difference > 0 ? "+" : ""}{change.difference.toFixed(4)})
                        </span>
                      )}
                      {change.status_changed && (
                        <span className="ms-2">
                          <span className="badge bg-secondary">
                            Status: {change.original_status} → {change.reread_status}
                          </span>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="alert alert-info mt-3">
                <i className="bi bi-info-circle me-2"></i>
                No changes detected between original and re-read results.
              </div>
            )}

            {/* Reject Input */}
            {showRejectInput && (
              <div className="mt-3">
                <label htmlFor="rejectNotes" className="form-label">
                  <strong>Rejection Reason:</strong>
                </label>
                <textarea
                  id="rejectNotes"
                  className="form-control"
                  rows={3}
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Please explain why you are rejecting this re-read..."
                  required
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
            {showRejectInput ? (
              <>
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => {
                    setShowRejectInput(false);
                    setRejectNotes("");
                  }}
                >
                  Cancel Reject
                </button>
                <button className="btn btn-danger" onClick={handleReject}>
                  <i className="bi bi-x-circle me-2"></i>
                  Confirm Rejection
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn btn-danger"
                  onClick={() => setShowRejectInput(true)}
                >
                  <i className="bi bi-x-circle me-2"></i>
                  Reject
                </button>
                <button className="btn btn-success" onClick={handleApprove}>
                  <i className="bi bi-check-circle me-2"></i>
                  Approve
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};