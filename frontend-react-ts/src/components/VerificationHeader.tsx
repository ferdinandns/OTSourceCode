// VerificationHeader.tsx
import React from 'react';

interface InstrumentDetail {
    instrument_id: number;
    instrument_type: string;
    no_kontrol: string;
    nama_instrument: string;
    status: string;
    configuration?: any;
}

interface VerificationData {
    verification_id: number;
    instrument_id: number;
    instrument_type: string;
    template_id: number;
    template_name: string;
    steps: any[];
    global_rules: any;
    requires_connection: boolean;
    connection_type: string;
    status: string;
    total_steps: number;
    required_steps: number;
    current_step_number: number;
    available_references: Record<string, any[]>;
}

export interface VerificationHeaderProps {
    instrument: InstrumentDetail;
    verification: VerificationData | null;
    onCancel: () => void | Promise<void>;
    onBack: () => void | Promise<void>;
}

const VerificationHeader: React.FC<VerificationHeaderProps> = ({
    instrument,
    verification,
    onCancel,
    onBack
}) => {
    return (
        <div className="mb-4">
            <div className="d-flex justify-content-between align-items-start mb-3">
                <div>
                    <h4 className="mb-1">
                        {verification ? (
                            <>
                                <i className="bi bi-clipboard-check text-primary me-2"></i>
                                Verification in Progress
                            </>
                        ) : (
                            <>
                                <i className="bi bi-clipboard-plus text-secondary me-2"></i>
                                Start Verification
                            </>
                        )}
                    </h4>
                    <div className="text-muted">
                        <small>
                            <strong>{instrument.no_kontrol}</strong> - {instrument.nama_instrument}
                        </small>
                    </div>
                </div>
                <div>
                    {verification ? (
                        <button 
                            className="btn btn-outline-danger btn-sm me-2"
                            onClick={onCancel}
                        >
                            <i className="bi bi-x-circle me-1"></i>
                            Cancel
                        </button>
                    ) : null}
                    <button 
                        className="btn btn-outline-secondary btn-sm"
                        onClick={onBack}
                    >
                        <i className="bi bi-arrow-left me-1"></i>
                        Back
                    </button>
                </div>
            </div>

            {verification && (
                <div className="row g-2">
                    <div className="col-md-3">
                        <div className="card border-0 bg-light">
                            <div className="card-body p-2">
                                <small className="text-muted d-block">Template</small>
                                <strong className="small">{verification.template_name}</strong>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-3">
                        <div className="card border-0 bg-light">
                            <div className="card-body p-2">
                                <small className="text-muted d-block">Total Steps</small>
                                <strong className="small">{verification.total_steps}</strong>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-3">
                        <div className="card border-0 bg-light">
                            <div className="card-body p-2">
                                <small className="text-muted d-block">Status</small>
                                <strong className="small">
                                    <span className="badge bg-info">{verification.status}</span>
                                </strong>
                            </div>
                        </div>
                    </div>
                    <div className="col-md-3">
                        <div className="card border-0 bg-light">
                            <div className="card-body p-2">
                                <small className="text-muted d-block">Type</small>
                                <strong className="small">{instrument.instrument_type}</strong>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VerificationHeader;