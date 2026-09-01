import React from 'react';
import { Reference, VerificationStepInfo } from '../types/verification';

interface OverrideModalProps {
    show: boolean;
    loading: boolean;
    step: VerificationStepInfo | null;
    measuredValue: number | null;
    selectedReference: number | null;
    references: Reference[];
    minRange: number | null;
    maxRange: number | null;
    overrideReason: string;
    onReasonChange: (reason: string) => void;
    onClose: () => void;
    onOverride: (action: 'continue' | 'breakdown') => void;
}

const OverrideModal: React.FC<OverrideModalProps> = ({
    show,
    loading,
    step,
    measuredValue,
    selectedReference,
    references,
    minRange,
    maxRange,
    overrideReason,
    onReasonChange,
    onClose,
    onOverride
}) => {
    if (!show || !step) return null;

    // Get selected reference details
    const selectedRef = selectedReference 
        ? references.find(r => r.id === selectedReference) 
        : null;

    // Determine step label and icon based on step type
    const getStepIcon = () => {
        switch (step.step_type) {
            case 'auto_read':
                return 'bi-arrow-down-circle';
            case 'manual_input':
                return 'bi-pencil-square';
            case 'selection':
                return 'bi-list-check';
            case 'multi_reading':
                return 'bi-collection';
            case 'calculation':
                return 'bi-calculator';
            default:
                return 'bi-question-circle';
        }
    };

    // Get validation range display
    const getRangeDisplay = () => {
        if (minRange !== null && maxRange !== null) {
            return `${minRange.toFixed(4)} - ${maxRange.toFixed(4)} ${step.unit || ''}`;
        }
        if (step.validation_rules?.expected_value) {
            return `Expected: ${step.validation_rules.expected_value} ${step.unit || ''}`;
        }
        return 'Not specified';
    };

    // Get measured value display
    const getMeasuredValueDisplay = () => {
        if (measuredValue !== null) {
            return `${measuredValue.toFixed(4)} ${step.unit || ''}`;
        }
        return 'N/A';
    };

    // Get deviation display
    const getDeviationDisplay = () => {
        if (measuredValue === null || minRange === null || maxRange === null) return null;
        
        if (measuredValue < minRange) {
            return `${(minRange - measuredValue).toFixed(4)} ${step.unit || ''} (below minimum)`;
        }
        if (measuredValue > maxRange) {
            return `${(measuredValue - maxRange).toFixed(4)} ${step.unit || ''} (above maximum)`;
        }
        return null;
    };

    return (
        <div
            className="modal fade show d-block"
            tabIndex={-1}
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={(e) => {
                if (e.target === e.currentTarget && !loading) {
                    onClose();
                }
            }}
        >
            <div className="modal-dialog modal-dialog-centered modal-lg">
                <div className="modal-content">
                    {/* Header */}
                    <div className="modal-header bg-warning text-dark">
                        <div>
                            <h5 className="modal-title mb-1">
                                <i className={`bi ${getStepIcon()} me-2`}></i>
                                Verifikasi Tidak Memenuhi Syarat
                            </h5>
                            <small className="text-muted">
                                Step {step.step_number} - {step.step_name}
                                {step.required && (
                                    <span className="badge bg-warning text-dark ms-2">Required</span>
                                )}
                            </small>
                        </div>
                        <button
                            type="button"
                            className="btn-close"
                            onClick={() => !loading && onClose()}
                            disabled={loading}
                            aria-label="Close"
                        ></button>
                    </div>

                    <div className="modal-body">
                        {/* Alert */}
                        <div className="alert alert-warning d-flex align-items-center mb-4">
                            <i className="bi bi-info-circle-fill fs-4 me-3"></i>
                            <div>
                                <strong>Perhatian!</strong> Hasil verifikasi tidak memenuhi kriteria yang ditentukan.
                                <br />
                                <small className="text-muted">
                                    Mohon pilih tindakan yang sesuai dan berikan penjelasan detail.
                                </small>
                            </div>
                        </div>

                        {/* Result Card */}
                        {(measuredValue !== null || selectedReference) && (
                            <div className="card border-danger mb-4">
                                <div className="card-header bg-danger text-white">
                                    <h6 className="mb-0">
                                        <i className="bi bi-clipboard-data me-2"></i>
                                        Hasil Verifikasi
                                    </h6>
                                </div>
                                <div className="card-body">
                                    <div className="row g-3">
                                        {/* Reference Info (if applicable) */}
                                        {selectedRef && (
                                            <div className="col-md-4">
                                                <label className="text-muted small">Reference</label>
                                                <div className="fw-bold">
                                                    {selectedRef.no_kontrol}
                                                </div>
                                                <small className="text-muted">
                                                    {selectedRef.name}
                                                </small>
                                                {selectedRef.nominal_value && (
                                                    <div className="small text-muted mt-1">
                                                        Nominal: {selectedRef.nominal_value} {step.unit || ''}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Measured Value */}
                                        {measuredValue !== null && (
                                            <div className="col-md-4">
                                                <label className="text-muted small">Nilai Terukur</label>
                                                <div className="fw-bold fs-5 text-danger">
                                                    {getMeasuredValueDisplay()}
                                                </div>
                                            </div>
                                        )}

                                        {/* Valid Range */}
                                        {(minRange !== null || maxRange !== null) && (
                                            <div className="col-md-4">
                                                <label className="text-muted small">Range Valid</label>
                                                <div className="fw-bold">
                                                    {getRangeDisplay()}
                                                </div>
                                                <small className="text-muted">Batas toleransi</small>
                                            </div>
                                        )}
                                    </div>

                                    {/* Deviation & Status */}
                                    {(minRange !== null || maxRange !== null) && measuredValue !== null && (
                                        <div className="mt-3 pt-3 border-top">
                                            <div className="d-flex justify-content-between align-items-center">
                                                <span className="text-muted">Status:</span>
                                                <span className="badge bg-danger fs-6">
                                                    <i className="bi bi-x-circle me-1"></i>
                                                    NOT COMPLIES
                                                </span>
                                            </div>
                                            {getDeviationDisplay() && (
                                                <div className="d-flex justify-content-between align-items-center mt-2">
                                                    <span className="text-muted">Deviasi:</span>
                                                    <span className="text-danger fw-bold">
                                                        {getDeviationDisplay()}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Reason Input */}
                        <div className="mb-4">
                            <label className="form-label fw-bold">
                                Alasan / Keterangan <span className="text-danger">*</span>
                            </label>
                            <textarea
                                className={`form-control ${
                                    overrideReason && overrideReason.length < 10
                                        ? 'is-invalid'
                                        : overrideReason.length >= 10
                                            ? 'is-valid'
                                            : ''
                                }`}
                                rows={5}
                                value={overrideReason}
                                onChange={(e) => onReasonChange(e.target.value)}
                                placeholder={`Jelaskan secara detail:

1. Kondisi instrument saat ini
2. Kemungkinan penyebab hasil tidak sesuai
3. Apakah instrument masih aman digunakan?
4. Rekomendasi tindakan selanjutnya

Minimal 10 karakter.`}
                                disabled={loading}
                                maxLength={500}
                            />

                            <div className="d-flex justify-content-between mt-1">
                                <small className={`${
                                    overrideReason.length < 10
                                        ? 'text-danger'
                                        : overrideReason.length < 50
                                            ? 'text-warning'
                                            : 'text-success'
                                }`}>
                                    {overrideReason.length < 10 ? (
                                        <>
                                            <i className="bi bi-exclamation-circle me-1"></i>
                                            Minimal 10 karakter ({10 - overrideReason.length} lagi)
                                        </>
                                    ) : overrideReason.length < 50 ? (
                                        <>
                                            <i className="bi bi-check-circle me-1"></i>
                                            Valid, tapi sebaiknya lebih detail
                                        </>
                                    ) : (
                                        <>
                                            <i className="bi bi-check-circle-fill me-1"></i>
                                            Penjelasan lengkap
                                        </>
                                    )}
                                </small>
                                <small className="text-muted">
                                    {overrideReason.length} / 500 karakter
                                </small>
                            </div>
                        </div>

                        {/* Action Cards */}
                        <div className="row g-3">
                            <div className="col-md-6">
                                <div className="card h-100 border-danger">
                                    <div className="card-body">
                                        <div className="d-flex align-items-center mb-2">
                                            <div className="rounded-circle bg-danger bg-opacity-10 p-2 me-3">
                                                <i className="bi bi-x-circle fs-4 text-danger"></i>
                                            </div>
                                            <div>
                                                <h6 className="mb-0 text-danger">Breakdown</h6>
                                                <small className="text-muted">Instrument tidak layak pakai</small>
                                            </div>
                                        </div>
                                        <ul className="small text-muted mb-0 ps-3">
                                            <li>Status berubah "Unavailable"</li>
                                            <li>Tidak dapat digunakan</li>
                                            <li>Perlu perbaikan/kalibrasi</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            <div className="col-md-6">
                                <div className="card h-100 border-warning">
                                    <div className="card-body">
                                        <div className="d-flex align-items-center mb-2">
                                            <div className="rounded-circle bg-warning bg-opacity-10 p-2 me-3">
                                                <i className="bi bi-arrow-right-circle fs-4 text-warning"></i>
                                            </div>
                                            <div>
                                                <h6 className="mb-0 text-warning">Lanjut (Override)</h6>
                                                <small className="text-muted">Pengecualian khusus</small>
                                            </div>
                                        </div>
                                        <ul className="small text-muted mb-0 ps-3">
                                            <li>Instrument tetap bisa digunakan</li>
                                            <li>Dengan catatan khusus</li>
                                            <li>Tercatat dalam laporan</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer bg-light">
                        <button
                            className="btn btn-secondary"
                            onClick={() => !loading && onClose()}
                            disabled={loading}
                        >
                            <i className="bi bi-x-lg me-2"></i>
                            Batal
                        </button>

                        <button
                            className="btn btn-danger"
                            onClick={() => onOverride('breakdown')}
                            disabled={!overrideReason || overrideReason.length < 10 || loading}
                        >
                            {loading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2"></span>
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-x-circle me-2"></i>
                                    Breakdown
                                </>
                            )}
                        </button>

                        <button
                            className="btn btn-warning text-white"
                            onClick={() => onOverride('continue')}
                            disabled={!overrideReason || overrideReason.length < 10 || loading}
                        >
                            {loading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2"></span>
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-arrow-right me-2"></i>
                                    Lanjut (Override)
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OverrideModal;