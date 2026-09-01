import React, { useState, useEffect } from 'react';

interface StepInfo {
    step_number: number;
    step_name: string;
    step_type: string;
    description: string;
    required: boolean;
    status: string;
    depends_on: number[];
    reference_type?: string;
    input_type?: string;
    unit?: string;
    ui_component?: string;
    reading_count?: number;
    measured_value?: number | null;
    expected_value?: number | null;
    min_value?: number | null;
    max_value?: number | null;
    readings?: number[];
    validation_msg?: string;
    reference_id?: number | null;
    calculation_expr?: string;
    metadata?: Record<string, any>;
}

interface VerificationData {
    verification_id: number;
    instrument_id: number;
    instrument_type: string;
    template_id: number;
    template_name: string;
    steps: StepInfo[];
    global_rules: any;
    requires_connection: boolean;
    connection_type: string;
    status: string;
    total_steps: number;
    required_steps: number;
    current_step_number: number;
    available_references: Record<string, any[]>;
}

interface StepResult {
    success: boolean;
    step_number: number;
    step_name: string;
    step_type: string;
    status: string;
    measured_value?: number | null;
    expected_value?: number | null;
    min_range?: number | null;
    max_range?: number | null;
    unit?: string | null;
    validation_msg: string;
    can_continue: boolean;
    needs_override: boolean;
    reference_name?: string | null;
    reference_id?: number | null;
    readings?: number[];
    next_step_number?: number | null;
    verification_completed?: boolean;
    verification_status?: string;
    result_data?: Record<string, any> | null;
}

// ✅ Updated interface with all required props
export interface StepRendererProps {
    step: StepInfo;
    verification: VerificationData;
    loading: boolean;
    onExecute: (stepNumber: number, inputData: any) => Promise<any>;
    lastStepResult?: StepResult | null;
    onContinueAfterResult?: () => void;
    onOverride?: () => void;
}

const StepRenderer: React.FC<StepRendererProps> = ({
    step,
    verification,
    loading,
    onExecute,
    lastStepResult,
    onContinueAfterResult,
    onOverride
}) => {
    const [inputData, setInputData] = useState<any>({});
    const [selectedReference, setSelectedReference] = useState<string>('');
    const [validationMessage, setValidationMessage] = useState<string>('');
    const [showResultOverlay, setShowResultOverlay] = useState<boolean>(false);
    const [executionResult, setExecutionResult] = useState<StepResult | null>(null);

    // Reset form when step changes
    useEffect(() => {
        setInputData({});
        setSelectedReference('');
        setValidationMessage('');
        setShowResultOverlay(false);
        setExecutionResult(null);
    }, [step.step_number]);

    // Check if we have a result to display for this specific step
    useEffect(() => {
        if (lastStepResult && lastStepResult.step_number === step.step_number && lastStepResult.status !== 'Waiting Bridge') {
            setExecutionResult(lastStepResult);
            setShowResultOverlay(true);
        }
    }, [lastStepResult, step.step_number]);

    const handleExecute = async () => {
        const data: any = { ...inputData };
        if (selectedReference) {
            data.reference_id = parseInt(selectedReference);
        }

        try {
            const result = await onExecute(step.step_number, data);

            if (result) {
                // ✅ Jangan tampilkan overlay untuk Waiting Bridge
                if (result.status === 'Waiting Bridge') {
                    return;
                }

                setExecutionResult(result);
                if (
                    step.step_type === 'calculation' &&
                    result.can_continue &&
                    !result.needs_override
                ) {
                    if (onContinueAfterResult) onContinueAfterResult();
                } else {
                    setShowResultOverlay(true);
                }
            }
        } catch (error: any) {
            setValidationMessage(error.message || 'Failed to execute step');
        }
    };

    const handleContinue = () => {
        setShowResultOverlay(false);
        setExecutionResult(null);
        if (onContinueAfterResult) {
            onContinueAfterResult();
        }
    };

    const handleOverrideClick = () => {
        setShowResultOverlay(false);
        if (onOverride) {
            onOverride();
        }
    };

    const canExecute = () => {
        if (step.status === 'Completed' || step.status === 'Complies' || step.status === 'Not Complies') return false;
        if (step.status === 'In Progress') return false;
        if (loading) return false;

        switch (step.step_type) {
            case 'auto_read':
                // For auto_read, we need a reference selected if reference_type is specified
                if (step.reference_type) {
                    return !!selectedReference;
                }
                return true;
            case 'manual_input':
                return !!inputData.value;
            case 'selection':
                return !!selectedReference;
            case 'multi_reading':
                return true;
            case 'calculation':
                return true;
            default:
                return true;
        }
    };

    const getExecuteButtonText = () => {
        if (step.step_type === 'auto_read') {
            return step.reference_type ? 'Read & Verify' : 'Auto Read';
        }
        if (step.step_type === 'multi_reading') {
            return 'Start Multiple Readings';
        }
        return 'Execute Step';
    };

    const getStatusBadge = () => {
        switch (step.status) {
            case 'Completed':
                return <span className="badge bg-success">Completed</span>;
            case 'Complies':
                return <span className="badge bg-success">Complies ✓</span>;
            case 'Not Complies':
                return <span className="badge bg-danger">Not Complies ✗</span>;
            case 'In Progress':
                return <span className="badge bg-primary">In Progress</span>;
            case 'Ready':
                return <span className="badge bg-info">Ready</span>;
            case 'Pending':
                return <span className="badge bg-secondary">Pending</span>;
            case 'Failed':
                return <span className="badge bg-danger">Failed</span>;
            default:
                return <span className="badge bg-secondary">{step.status}</span>;
        }
    };

    // ============================================
    // RESULT OVERLAY COMPONENT (NEW)
    // ============================================
    const ResultOverlay = () => {
        if (!showResultOverlay || !executionResult) return null;

        const getResultStatusColor = () => {
            if (executionResult.status === 'Complies') return 'success';
            if (executionResult.status === 'Not Complies') return 'danger';
            return 'warning';
        };

        const statusColor = getResultStatusColor();

        return (
            <div className="result-overlay position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
                <div className="card border-0 shadow-lg" style={{ maxWidth: '600px', width: '90%' }}>
                    <div className={`card-header bg-${statusColor} text-white`}>
                        <h5 className="mb-0">
                            <i className={`bi ${executionResult.status === 'Complies' ? 'bi-check-circle' : 'bi-exclamation-triangle'} me-2`}></i>
                            Step Execution Result
                        </h5>
                    </div>
                    <div className="card-body">
                        {/* Status Badge */}
                        <div className="text-center mb-4">
                            <span className={`badge bg-${statusColor} fs-6 px-4 py-2`}>
                                {executionResult.status === 'Complies' ? '✓ COMPLIES' : '✗ NOT COMPLIES'}
                            </span>
                        </div>

                        {/* Reference Info */}
                        {executionResult.reference_name && (
                            <div className="alert alert-info py-2">
                                <i className="bi bi-bookmark-check me-2"></i>
                                <strong>Reference:</strong> {executionResult.reference_name}
                            </div>
                        )}

                        {/* Measured Value */}
                        {executionResult.measured_value != null && (
                            <div className="row g-3 mb-3">
                                <div className="col-md-4">
                                    <div className="card bg-light border-0">
                                        <div className="card-body text-center p-3">
                                            <small className="text-muted d-block">Measured</small>
                                            <h3 className="mb-0 text-primary fw-bold">
                                                {executionResult.measured_value.toFixed(4)}
                                            </h3>
                                            {executionResult.unit && <small className="text-muted">{executionResult.unit}</small>}
                                        </div>
                                    </div>
                                </div>

                                {executionResult.expected_value != null && (
                                    <div className="col-md-4">
                                        <div className="card bg-light border-0">
                                            <div className="card-body text-center p-3">
                                                <small className="text-muted d-block">Expected</small>
                                                <h4 className="mb-0">
                                                    {executionResult.expected_value.toFixed(4)}
                                                </h4>
                                                {executionResult.unit && <small className="text-muted">{executionResult.unit}</small>}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {executionResult.min_range != null && executionResult.max_range != null && (
                                    <div className="col-md-4">
                                        <div className="card bg-light border-0">
                                            <div className="card-body text-center p-3">
                                                <small className="text-muted d-block">Range</small>
                                                <h6 className="mb-0">
                                                    {executionResult.min_range.toFixed(4)}
                                                    <br />-<br />
                                                    {executionResult.max_range.toFixed(4)}
                                                </h6>
                                                {executionResult.unit && <small className="text-muted">{executionResult.unit}</small>}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Multiple Readings */}
                        {executionResult.readings && executionResult.readings.length > 0 && (
                            <div className="mb-3">
                                <strong className="d-block mb-2">
                                    {step.step_type === 'auto_read' && step.metadata?.read_mode === 'batch'
                                        ? 'Batch Readings:'
                                        : 'Readings:'}
                                </strong>
                                <div className="d-flex flex-wrap gap-2">
                                    {executionResult.readings.map((reading, idx) => (
                                        <span key={idx} className="badge bg-light text-dark border fs-6">
                                            {reading != null ? reading.toFixed(4) : 'N/A'} {executionResult.unit || ''}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Buffer Results - shown when measured_value is null (batch multi-line step) */}
                        {executionResult.measured_value == null && executionResult.result_data?.buffer_results && (
                            <div className="mb-3">
                                <strong className="d-block mb-2">Buffer Results:</strong>
                                <div className="table-responsive">
                                    <table className="table table-sm table-bordered mb-0">
                                        <thead className="table-light">
                                            <tr>
                                                <th>Buffer</th>
                                                <th>Actual Value</th>
                                                <th>Range</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(executionResult.result_data.buffer_results as any[]).map((br, i) => (
                                                <tr key={i}>
                                                    <td>{br.buffer_type?.toUpperCase()}</td>
                                                    <td>{br.actual_value?.toFixed(4)} {executionResult.unit || ''}</td>
                                                    <td>{br.min?.toFixed(4)} – {br.max?.toFixed(4)}</td>
                                                    <td>
                                                        <span className={`badge ${br.complies ? 'bg-success' : 'bg-danger'}`}>
                                                            {br.complies ? '✓ Complies' : '✗ Not Complies'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}


                        {/* Validation Message */}
                        {executionResult.validation_msg && (
                            <div className={`alert alert-${statusColor} mb-3`}>
                                <i className={`bi ${executionResult.status === 'Complies' ? 'bi-info-circle' : 'bi-exclamation-triangle'} me-2`}></i>
                                {executionResult.validation_msg}
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="d-flex gap-2 justify-content-end mt-4">
                            {executionResult.needs_override && onOverride && (
                                <button
                                    className="btn btn-warning"
                                    onClick={handleOverrideClick}
                                >
                                    <i className="bi bi-shield-exclamation me-2"></i>
                                    Override & Continue
                                </button>
                            )}

                            {executionResult.can_continue && (
                                <button
                                    className={`btn ${executionResult.verification_completed ? 'btn-success' : 'btn-primary'}`}
                                    onClick={handleContinue}
                                >
                                    {executionResult.verification_completed ? (
                                        <>
                                            <i className="bi bi-check-circle-fill me-2"></i>
                                            View Verification Report
                                        </>
                                    ) : (
                                        <>
                                            <i className="bi bi-arrow-right-circle me-2"></i>
                                            Continue to Next Step
                                        </>
                                    )}
                                </button>
                            )}

                            {!executionResult.can_continue && !executionResult.needs_override && (
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setShowResultOverlay(false)}
                                >
                                    <i className="bi bi-x-circle me-2"></i>
                                    Close
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // ============================================
    // RESULT DISPLAY COMPONENT (for completed steps)
    // ============================================
    const StepResult = () => {
        // Only show for completed steps that aren't showing the overlay
        if (showResultOverlay) return null;
        if (step.status !== 'Completed' && step.status !== 'Complies' && step.status !== 'Not Complies') {
            return null;
        }

        return (
            <div className="card border-0 bg-light mt-4">
                <div className="card-header bg-white">
                    <h6 className="mb-0">
                        <i className="bi bi-clipboard-check me-2 text-primary"></i>
                        Step Result
                    </h6>
                </div>
                <div className="card-body">
                    <div className="row g-3">
                        {/* Reference Info */}
                        {step.reference_id && (
                            <div className="col-md-6">
                                <div className="d-flex align-items-start">
                                    <i className="bi bi-bezier2 text-muted me-2 mt-1"></i>
                                    <div>
                                        <small className="text-muted d-block">Reference</small>
                                        <span className="fw-medium">
                                            {verification.available_references[step.reference_type || '']
                                                ?.find((r: any) => r.id === step.reference_id)?.name
                                                || `Reference #${step.reference_id}`}
                                        </span>
                                        {step.reference_type && (
                                            <small className="text-muted d-block">
                                                {step.reference_type.replace('_', ' ')}
                                            </small>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Measured Value */}
                        {step.measured_value !== undefined && step.measured_value !== null && (
                            <div className="col-md-6">
                                <div className="d-flex align-items-start">
                                    <i className="bi bi-rulers text-muted me-2 mt-1"></i>
                                    <div>
                                        <small className="text-muted d-block">Measured Value</small>
                                        <span className="fw-bold fs-5">
                                            {step.measured_value.toFixed(4)} {step.unit || ''}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Expected Value */}
                        {step.expected_value !== undefined && step.expected_value !== null && (
                            <div className="col-md-6">
                                <div className="d-flex align-items-start">
                                    <i className="bi bi-bullseye text-muted me-2 mt-1"></i>
                                    <div>
                                        <small className="text-muted d-block">Expected Value</small>
                                        <span className="fw-medium">
                                            {step.expected_value.toFixed(4)} {step.unit || ''}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tolerance Range */}
                        {step.min_value !== undefined && step.min_value !== null &&
                            step.max_value !== undefined && step.max_value !== null && (
                                <div className="col-md-6">
                                    <div className="d-flex align-items-start">
                                        <i className="bi bi-arrows-expand text-muted me-2 mt-1"></i>
                                        <div>
                                            <small className="text-muted d-block">Tolerance Range</small>
                                            <span className="fw-medium">
                                                {step.min_value.toFixed(4)} - {step.max_value.toFixed(4)} {step.unit || ''}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                        {/* Multiple Readings */}
                        {step.readings && step.readings.length > 0 && (
                            <div className="col-12">
                                <div className="d-flex align-items-start">
                                    <i className="bi bi-collection text-muted me-2 mt-1"></i>
                                    <div className="flex-grow-1">
                                        <small className="text-muted d-block">Readings</small>
                                        <div className="d-flex flex-wrap gap-2 mt-1">
                                            {step.readings.map((reading, idx) => (
                                                <span key={idx} className="badge bg-light text-dark border">
                                                    {reading.toFixed(4)} {step.unit || ''}
                                                </span>
                                            ))}
                                        </div>
                                        {step.readings.length > 1 && (
                                            <div className="mt-2 small">
                                                <span className="text-muted me-3">
                                                    Avg: {(step.readings.reduce((a, b) => a + b, 0) / step.readings.length).toFixed(4)} {step.unit || ''}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Validation Message */}
                        {step.validation_msg && (
                            <div className="col-12">
                                <div className={`alert ${step.status === 'Complies' ? 'alert-success' : 'alert-warning'} mb-0 py-2`}>
                                    <i className={`bi ${step.status === 'Complies' ? 'bi-check-circle' : 'bi-exclamation-triangle'} me-2`}></i>
                                    <small>{step.validation_msg}</small>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // ============================================
    // STEP CONTENT BY TYPE
    // ============================================
    const renderStepContent = () => {
        switch (step.step_type) {
            case 'auto_read':
                const references = step.reference_type
                    ? verification.available_references[step.reference_type] || []
                    : [];

                return (
                    <div className="card border-0 bg-light">
                        <div className="card-body">
                            <div className="text-center py-3">
                                <i className="bi bi-arrow-down-circle display-4 text-primary mb-3"></i>
                                <h5>Automatic Reading & Verification</h5>
                                <p className="text-muted">
                                    The system will automatically read the value from the instrument and verify against the selected reference.
                                </p>
                            </div>

                            {/* Reference Selection */}
                            {step.reference_type && (
                                <div className="mt-3">
                                    <label className="form-label fw-bold">
                                        Select Reference {step.reference_type.replace('_', ' ')}
                                        <span className="text-danger">*</span>
                                    </label>
                                    <select
                                        className="form-select"
                                        value={selectedReference}
                                        onChange={(e) => setSelectedReference(e.target.value)}
                                        disabled={step.status === 'Completed' || step.status === 'Complies' || step.status === 'Not Complies'}
                                    >
                                        <option value="">-- Select Reference --</option>
                                        {references.map((ref: any) => {
                                            const displayValue = ref.nominal_value || ref.buffer_value;
                                            const isExpired = ref.expiry_date && new Date(ref.expiry_date) < new Date();
                                            return (
                                                <option key={ref.id} value={ref.id} disabled={isExpired}>
                                                    {ref.name} ({ref.no_kontrol})
                                                    {displayValue && ` - ${displayValue} ${step.unit || ''}`}
                                                    {isExpired && ' (Expired)'}
                                                </option>
                                            );
                                        })}
                                    </select>
                                    {references.length === 0 && (
                                        <div className="alert alert-warning mt-2">
                                            <i className="bi bi-exclamation-triangle me-2"></i>
                                            No references available. Please contact administrator.
                                        </div>
                                    )}
                                </div>
                            )}

                            {step.unit && (
                                <div className="mt-2 text-center">
                                    <span className="badge bg-info">Unit: {step.unit}</span>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'manual_input':
                return (
                    <div className="card border-0 bg-light">
                        <div className="card-body">
                            <h5 className="mb-3">Manual Input Required</h5>
                            <div className="mb-3">
                                <label className="form-label">
                                    Enter Value {step.unit && `(${step.unit})`}
                                </label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    className="form-control"
                                    value={inputData.value || ''}
                                    onChange={(e) => setInputData({ value: e.target.value })}
                                    placeholder={`Enter ${step.step_name.toLowerCase()}`}
                                    disabled={step.status === 'Completed' || step.status === 'Complies' || step.status === 'Not Complies'}
                                />
                            </div>
                        </div>
                    </div>
                );

            case 'selection':
                const selectionRefs = step.reference_type
                    ? verification.available_references[step.reference_type] || []
                    : [];

                return (
                    <div className="card border-0 bg-light">
                        <div className="card-body">
                            <h5 className="mb-3">Select Reference</h5>
                            <div className="mb-3">
                                <label className="form-label">
                                    Choose {step.reference_type?.replace(/_/g, ' ')}
                                </label>
                                <select
                                    className="form-select"
                                    value={selectedReference}
                                    onChange={(e) => setSelectedReference(e.target.value)}
                                    disabled={step.status === 'Completed'}
                                >
                                    <option value="">-- Select Reference --</option>
                                    {selectionRefs.map((ref: any) => {
                                        const displayValue = ref.nominal_value || ref.buffer_value;
                                        return (
                                            <option key={ref.id} value={ref.id}>
                                                {ref.name} ({ref.no_kontrol})
                                                {displayValue && ` - ${displayValue} ${step.unit || ''}`}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        </div>
                    </div>
                );

            case 'multi_reading':
                const readingCount = step.reading_count || 3;
                return (
                    <div className="card border-0 bg-light">
                        <div className="card-body">
                            <div className="text-center py-4">
                                <i className="bi bi-collection display-4 text-info mb-3"></i>
                                <h5>Multiple Readings</h5>
                                <p className="text-muted">
                                    This step will take <strong>{readingCount}</strong> readings from the instrument.
                                </p>
                                {step.unit && (
                                    <div className="badge bg-info text-dark">Unit: {step.unit}</div>
                                )}
                            </div>
                        </div>
                    </div>
                );

            case 'calculation':
                return (
                    <div className="card border-0 bg-light">
                        <div className="card-body">
                            <div className="text-center py-4">
                                <i className="bi bi-calculator display-4 text-success mb-3"></i>
                                <h5>Automatic Calculation</h5>
                                <p className="text-muted">
                                    This step will calculate the result based on previous steps.
                                </p>
                                {step.calculation_expr && (
                                    <div className="mt-2">
                                        <code className="bg-dark text-light p-2 rounded">
                                            {step.calculation_expr}
                                        </code>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );

            default:
                return (
                    <div className="alert alert-warning">
                        <i className="bi bi-info-circle me-2"></i>
                        Unknown step type: <strong>{step.step_type}</strong>
                    </div>
                );
        }
    };

    return (
        <div className="step-renderer">
            {/* Result Overlay Modal */}
            <ResultOverlay />

            <div className="d-flex justify-content-between align-items-start mb-3">
                <div>
                    <h5 className="mb-1">
                        Step {step.step_number}: {step.step_name}
                    </h5>
                    {step.description && (
                        <p className="text-muted small mb-1">{step.description}</p>
                    )}
                </div>
                <div className="d-flex gap-2">
                    {step.required && (
                        <span className="badge bg-warning text-dark">Required</span>
                    )}
                    {getStatusBadge()}
                </div>
            </div>

            {renderStepContent()}

            {validationMessage && (
                <div className="alert alert-danger mt-3">
                    <i className="bi bi-exclamation-circle me-2"></i>
                    {validationMessage}
                </div>
            )}

            {/* Execute Button */}
            {step.status !== 'Completed' &&
                step.status !== 'Complies' &&
                step.status !== 'Not Complies' &&
                step.status !== 'In Progress' && (
                    <div className="mt-3">
                        <button
                            className="btn btn-primary"
                            onClick={handleExecute}
                            disabled={!canExecute() || loading}
                        >
                            {loading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2"></span>
                                    Reading Instrument...
                                </>
                            ) : (
                                <>
                                    <i className={`bi ${step.step_type === 'auto_read' ? 'bi-arrow-down-circle' : 'bi-play-circle'
                                        } me-2`}></i>
                                    {getExecuteButtonText()}
                                </>
                            )}
                        </button>
                    </div>
                )}

            {/* Step Result */}
            <StepResult />

            {/* Dependencies Info */}
            {step.depends_on && step.depends_on.length > 0 && (
                <div className="alert alert-info mt-3 py-2">
                    <i className="bi bi-diagram-3 me-2"></i>
                    <small>
                        <strong>Dependencies:</strong> This step depends on step(s): {step.depends_on.join(', ')}
                    </small>
                </div>
            )}
        </div>
    );
};

export default StepRenderer;