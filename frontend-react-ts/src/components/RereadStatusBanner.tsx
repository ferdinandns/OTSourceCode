import React from "react";
import { ResultStatus } from "../types/instrument";

interface RereadStatusBannerProps {
  status: ResultStatus;
  rereadReason?: string;
  approvedBy?: number;
  approvedAt?: string;
  rejectedBy?: number;
  rejectedAt?: string;
  rejectNotes?: string;
}

export const RereadStatusBanner: React.FC<RereadStatusBannerProps> = ({
  status,
  rereadReason,
  approvedBy,
  approvedAt,
  rejectedBy,
  rejectedAt,
  rejectNotes,
}) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusConfig = {
    pending: {
      icon: "bi-hourglass-split",
      color: "warning",
      bgColor: "bg-warning",
      title: "Re-read In Progress",
      message: "Complete the reading to submit for supervisor approval.",
    },
    awaiting_approval: {
      icon: "bi-clock-history",
      color: "info",
      bgColor: "bg-info",
      title: "Awaiting Supervisor Approval",
      message:
        "Re-read completed. Waiting for supervisor to review results. You cannot export until approved.",
    },
    approved: {
      icon: "bi-check-circle",
      color: "success",
      bgColor: "bg-success",
      title: "Re-read Approved",
      message: approvedAt
        ? `Approved on ${formatDate(approvedAt)}. You can now export the results.`
        : "Results approved. You can now export.",
    },
    rejected: {
      icon: "bi-x-circle",
      color: "danger",
      bgColor: "bg-danger",
      title: "Re-read Rejected",
      message: rejectNotes
        ? `Rejected: ${rejectNotes}`
        : "Re-read results were rejected by supervisor.",
    },
  };

  const config = statusConfig[status];

  return (
    <div className={`alert alert-${config.color} d-flex align-items-start`}>
      <div className="me-3">
        <i className={`bi ${config.icon} fs-3`}></i>
      </div>
      <div className="flex-grow-1">
        <h5 className="alert-heading mb-2">{config.title}</h5>
        <p className="mb-2">{config.message}</p>
        {rereadReason && (
          <div className="mb-0">
            <small className="text-muted">
              <strong>Reason for re-read:</strong> {rereadReason}
            </small>
          </div>
        )}
        {status === "rejected" && rejectedAt && (
          <div className="mt-2">
            <small className="text-muted">
              Rejected on {formatDate(rejectedAt)}
            </small>
          </div>
        )}
      </div>
    </div>
  );
};