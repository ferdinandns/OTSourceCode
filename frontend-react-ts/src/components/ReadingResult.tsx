import { useState } from "react";
import PDFGeneratorButton from "./PDFGeneratorButton";

interface ReadingResultProps {
  usageId: number | null;
  instrumentName?: string;
  totalItems?: number;
  completedItems?: number;
  onReset: () => void;
  onViewDetails: () => void;
}

const ReadingResult = ({
  usageId,
  instrumentName = "Instrument",
  totalItems = 0,
  completedItems = 0,
  onReset,
  onViewDetails,
}: ReadingResultProps) => {
  const [showPDFPreview, setShowPDFPreview] = useState(false);

  const successRate = totalItems > 0 
    ? ((completedItems / totalItems) * 100).toFixed(1) 
    : "0";

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-success text-white">
        <h5 className="mb-0">
          <i className="bi bi-check-circle me-2"></i>
          Read Process Completed
        </h5>
      </div>
      
      <div className="card-body">
        {/* Success Alert */}
        <div className="alert alert-success">
          <div className="d-flex align-items-start">
            <i className="bi bi-check-circle-fill fs-1 me-3 text-success"></i>
            <div className="flex-grow-1">
              <h5 className="alert-heading mb-2">
                All items have been processed successfully!
              </h5>
              <hr />
              <div className="row g-3 mt-2">
                <div className="col-md-3">
                  <div className="text-center">
                    <div className="fs-2 fw-bold text-primary">
                      {completedItems}
                    </div>
                    <div className="text-muted small">Items Completed</div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="text-center">
                    <div className="fs-2 fw-bold text-info">{totalItems}</div>
                    <div className="text-muted small">Total Items</div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="text-center">
                    <div className="fs-2 fw-bold text-success">
                      {successRate}%
                    </div>
                    <div className="text-muted small">Success Rate</div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="text-center">
                    <div className="fs-2 fw-bold text-dark">
                      USG-{usageId}
                    </div>
                    <div className="text-muted small">Usage ID</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PDF Section */}
        <div className="card border-primary mb-3">
          <div className="card-header bg-primary text-white">
            <h6 className="mb-0">
              <i className="bi bi-file-pdf me-2"></i>
              Generate Test Report (PDF)
            </h6>
          </div>
          <div className="card-body">
            <p className="mb-3">
              Generate a comprehensive PDF report containing:
            </p>
            <ul className="mb-3">
              <li>
                <i className="bi bi-check text-success me-1"></i>
                Company logo and instrument information
              </li>
              <li>
                <i className="bi bi-check text-success me-1"></i>
                Sample category and sample details
              </li>
              <li>
                <i className="bi bi-check text-success me-1"></i>
                Complete test results for all {totalItems} items
              </li>
              <li>
                <i className="bi bi-check text-success me-1"></i>
                Operator information and timestamps
              </li>
              <li>
                <i className="bi bi-check text-success me-1"></i>
                ALCOA compliance verification
              </li>
            </ul>

            {usageId && (
              <PDFGeneratorButton
                usageId={usageId}
                instrumentName={instrumentName}
                className="w-100"
                onSuccess={(path) => {
                  console.log("PDF generated successfully:", path);
                  setShowPDFPreview(true);
                }}
                onError={(error) => {
                  console.error("PDF generation error:", error);
                }}
              />
            )}

            {showPDFPreview && (
              <div className="alert alert-info mt-3 mb-0">
                <i className="bi bi-info-circle me-2"></i>
                <strong>PDF Generated!</strong> The report has been created
                successfully. Click "Download PDF" to save it to your device.
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="row g-2">
          <div className="col-md-6">
            <button
              className="btn btn-primary w-100"
              onClick={onReset}
            >
              <i className="bi bi-arrow-clockwise me-2"></i>
              Start New Read Process
            </button>
          </div>
          <div className="col-md-6">
            <button
              className="btn btn-outline-secondary w-100"
              onClick={onViewDetails}
            >
              <i className="bi bi-eye me-2"></i>
              View Instrument Details
            </button>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-4 p-3 bg-light rounded">
          <h6 className="mb-2">
            <i className="bi bi-info-circle me-2"></i>
            Next Steps
          </h6>
          <ol className="mb-0 small">
            <li>Generate and download the PDF report</li>
            <li>Verify all data is accurate and complete</li>
            <li>
              Submit the report for supervisor approval (if required)
            </li>
            <li>
              Archive the report according to laboratory procedures
            </li>
          </ol>
        </div>
      </div>

      <div className="card-footer bg-light">
        <small className="text-muted">
          <i className="bi bi-clock-history me-1"></i>
          Completed at: {new Date().toLocaleString("id-ID")}
        </small>
      </div>
    </div>
  );
};

export default ReadingResult;