import { useState } from "react";
import { ComparisonModal } from "../../components/ComparisonModal";
import { usePendingApprovals } from "../../hooks/instrument/usePendingApprovals";
import { PendingApproval } from "../../types/instrument";
import SidebarMenu from "../../components/SidebarMenu";

export default function PendingApprovalPage() {
  const {
    approvals,
    isLoading,
    error,
    refetch,
    approveReread,
    processApproval,
  } = usePendingApprovals();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(
    null
  );
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleViewComparison = (approval: PendingApproval) => {
    setSelectedApproval(approval);
    setShowComparisonModal(true);
  };

  const handleApprove = (approval: PendingApproval, notes?: string) => {
    if (
      confirm(
        `Are you sure you want to approve this re-read for ${approval.instrument_name}?`
      )
    ) {
      approveReread.mutate(
        {
          usageId: approval.usage_id,
          notes: notes || "",
        },
        {
          onSuccess: () => {
            alert("Re-read approved successfully!");
            refetch();
          },
        }
      );
    }
  };

  const handleReject = (approval: PendingApproval, notes: string) => {
  if (!notes || notes.trim() === "") {
    alert("Please provide a reason for rejection");
    return;
  }

  if (confirm(`Are you sure you want to reject this re-read for ${approval.instrument_name}?`)) {
    processApproval.mutate(
      { usageId: approval.usage_id, approved: false, notes },
      {
        onSuccess: () => {
          alert("Re-read rejected successfully!");
          setShowComparisonModal(false);
          setSelectedApproval(null);
          refetch();
        },
      }
    );
  }
};

  if (isLoading) {
    return (
      <div className="container mt-5">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading pending approvals...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-5">
        <div className="alert alert-danger">
          <h5>Error Loading Approvals</h5>
          <p>{error.message}</p>
          <button className="btn btn-primary" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid mt-3 mb-5">
      <div className="row">
        <div className="col-auto">
          <SidebarMenu
            isHorizontal={false}
            isSidebarOpen={isSidebarOpen}
            toggleSidebar={toggleSidebar}
          />

          <button
            onClick={toggleSidebar}
            className="btn btn-link text-dark p-0 mt-3"
            style={{ fontSize: '1.75rem' }}
          >
            <i className="bi bi-list"></i>
          </button>
        </div>
        {/* Header */}
        <div className="col-md-11">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2>
              <i className="bi bi-clipboard-check me-2"></i>
              Pending Re-read Approvals
            </h2>
            <button className="btn btn-outline-primary" onClick={() => refetch()}>
              <i className="bi bi-arrow-clockwise me-2"></i>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {!approvals || approvals.length === 0 ? (
        <div className="alert alert-info text-center">
          <i className="bi bi-info-circle fs-1"></i>
          <p className="mt-3 mb-0">
            No pending re-read approvals at this time.
          </p>
        </div>
      ) : (
        <>
          {/* Approvals Table */}
          <div className="card">
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Instrument</th>
                      <th>Batch</th>
                      <th>Type</th>
                      <th>Completed</th>
                      <th>Changes</th>
                      <th>Reason</th>
                      <th>Requested By</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvals.map((approval) => (
                      <tr key={approval.usage_id}>
                        <td>
                          <div>
                            <strong>{approval.instrument_code}</strong>
                          </div>
                          <small className="text-muted">
                            {approval.instrument_name}
                          </small>
                        </td>
                        <td>{approval.batch_number}</td>
                        <td>
                          {approval.reread_type === "item" ? (
                            <span className="badge bg-warning text-dark">
                              Item #{approval.item_number}
                            </span>
                          ) : (
                            <span className="badge bg-info">Full Batch</span>
                          )}
                        </td>
                        <td>
                          <small>{formatDate(approval.submitted_at || approval.requested_at)}</small>
                        </td>
                        <td>
                          {approval.has_changes ? (
                            <span className="badge bg-warning text-dark">
                              <i className="bi bi-exclamation-triangle me-1"></i>
                              {approval.changed_items.length} item(s)
                            </span>
                          ) : (
                            <span className="badge bg-secondary">
                              No changes
                            </span>
                          )}
                        </td>
                        <td>
                          <small className="text-muted">
                            {approval.reason}
                          </small>
                        </td>
                        <td>{approval.user_name}</td>
                        <td className="text-center">
                          <div className="btn-group btn-group-sm" role="group">
                            <button
                              className="btn btn-outline-info"
                              onClick={() => handleViewComparison(approval)}
                              title="View comparison"
                            >
                              <i className="bi bi-eye"></i>
                            </button>
                            <button
                              className="btn btn-outline-success"
                              onClick={() => handleApprove(approval)}
                              title="Approve"
                              disabled={approveReread.isPending}
                            >
                              <i className="bi bi-check-lg"></i>
                            </button>
                            <button
                              className="btn btn-outline-danger"
                              onClick={() => handleViewComparison(approval)}
                              title="Reject"
                              disabled={false}
                            >
                              <i className="bi bi-x-lg"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div className="row mt-4">
            <div className="col-md-4">
              <div className="card bg-light">
                <div className="card-body text-center">
                  <h3 className="mb-0">{approvals.length}</h3>
                  <small className="text-muted">Pending Approvals</small>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card bg-warning bg-opacity-25">
                <div className="card-body text-center">
                  <h3 className="mb-0">
                    {approvals.filter((a) => a.has_changes).length}
                  </h3>
                  <small className="text-muted">With Changes</small>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card bg-info bg-opacity-25">
                <div className="card-body text-center">
                  <h3 className="mb-0">
                    {approvals.filter((a) => !a.has_changes).length}
                  </h3>
                  <small className="text-muted">No Changes</small>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Comparison Modal */}
      <ComparisonModal
        show={showComparisonModal}
        onClose={() => {
          setShowComparisonModal(false);
          setSelectedApproval(null);
        }}
        approval={selectedApproval}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
}