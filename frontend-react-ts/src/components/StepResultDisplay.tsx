// StepResultDisplay.tsx
import React from 'react';

interface StepResult {
    success: boolean;
    step_number: number;
    step_name: string;
    step_type: string;
    status: string;
    measured_value?: number;
    expected_value?: number;
    min_range?: number;
    max_range?: number;
    unit?: string;
    validation_msg: string;
    can_continue: boolean;
    needs_override: boolean;
    reference_name?: string;
}

interface StepResultDisplayProps {
    result: StepResult;
    onContinue: () => void;
    onOverride?: () => void;
}

const StepResultDisplay: React.FC<StepResultDisplayProps> = ({
    result,
    onContinue,
    onOverride
}) => {
    const getStatusBadge = () => {
        if (result.status === 'Completed' || result.status === 'Complies') {
            return <span className="badge bg-success">✓ Complies</span>;
        } else if (result.status === 'Not Complies') {
            return <span className="badge bg-danger">✗ Not Complies</span>;
        } else {
            return <span className="badge bg-warning">Warning</span>;
        }
    };

    const isInRange = () => {
        if (result.measured_value === undefined) return null;
        if (result.min_range === undefined || result.max_range === undefined) return null;
        
        return result.measured_value >= result.min_range && 
               result.measured_value <= result.max_range;
    };

    return (
        <div className="card border-0 shadow-sm mt-4">
            <div className="card-body">
                <div className="text-center mb-4">
                    <h5 className="mb-3">
                        <i className="bi bi-clipboard-data text-primary me-2"></i>
                        Step Result
                    </h5>
                    {getStatusBadge()}
                </div>

                {/* Reading Display */}
                {result.measured_value !== undefined && (
                    <div className="row g-3 mb-4">
                        <div className="col-md-4">
                            <div className="card bg-light border-0">
                                <div className="card-body text-center p-3">
                                    <small className="text-muted d-block mb-1">Measured Value</small>
                                    <h3 className="mb-0 text-primary">
                                        {result.measured_value.toFixed(4)}
                                        {result.unit && <small className="ms-1">{result.unit}</small>}
                                    </h3>
                                </div>
                            </div>
                        </div>

                        {result.expected_value !== undefined && (
                            <div className="col-md-4">
                                <div className="card bg-light border-0">
                                    <div className="card-body text-center p-3">
                                        <small className="text-muted d-block mb-1">Expected Value</small>
                                        <h4 className="mb-0">
                                            {result.expected_value.toFixed(4)}
                                            {result.unit && <small className="ms-1">{result.unit}</small>}
                                        </h4>
                                    </div>
                                </div>
                            </div>
                        )}

                        {result.min_range !== undefined && result.max_range !== undefined && (
                            <div className="col-md-4">
                                <div className="card bg-light border-0">
                                    <div className="card-body text-center p-3">
                                        <small className="text-muted d-block mb-1">Acceptable Range</small>
                                        <h4 className="mb-0">
                                            {result.min_range.toFixed(4)} - {result.max_range.toFixed(4)}
                                            {result.unit && <small className="ms-1">{result.unit}</small>}
                                        </h4>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Reference Info */}
                {result.reference_name && (
                    <div className="alert alert-info">
                        <i className="bi bi-info-circle me-2"></i>
                        <strong>Reference:</strong> {result.reference_name}
                    </div>
                )}

                {/* Validation Message */}
                {result.validation_msg && (
                    <div className={`alert ${
                        result.status === 'Complies' ? 'alert-success' : 
                        result.status === 'Not Complies' ? 'alert-danger' : 
                        'alert-warning'
                    }`}>
                        <i className={`bi ${
                            result.status === 'Complies' ? 'bi-check-circle' : 
                            result.status === 'Not Complies' ? 'bi-x-circle' : 
                            'bi-exclamation-triangle'
                        } me-2`}></i>
                        {result.validation_msg}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="d-flex gap-2 justify-content-center mt-4">
                    {result.can_continue && (
                        <button
                            className="btn btn-primary btn-lg"
                            onClick={onContinue}
                        >
                            <i className="bi bi-arrow-right-circle me-2"></i>
                            Continue to Next Step
                        </button>
                    )}

                    {result.needs_override && onOverride && (
                        <button
                            className="btn btn-warning btn-lg"
                            onClick={onOverride}
                        >
                            <i className="bi bi-shield-exclamation me-2"></i>
                            Override & Continue
                        </button>
                    )}

                    {!result.can_continue && !result.needs_override && (
                        <div className="alert alert-danger w-100">
                            <i className="bi bi-stop-circle me-2"></i>
                            Cannot continue. Please retry the step or contact administrator.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StepResultDisplay;