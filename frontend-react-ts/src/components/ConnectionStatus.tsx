// ConnectionStatus.tsx
import React from 'react';

interface InstrumentDetail {
    instrument_id: number;
    instrument_type: string;
    no_kontrol: string;
    nama_instrument: string;
    status: string;
    configuration?: any;
}

export interface ConnectionStatusProps {
    instrument: InstrumentDetail;
    status: 'unknown' | 'checking' | 'ready' | 'failed' | 'not-required';
    message: string;
    onRetry: () => void | Promise<void>;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
    instrument,
    status,
    message,
    onRetry
}) => {
    const getStatusBadge = () => {
        switch (status) {
            case 'checking':
                return (
                    <span className="badge bg-warning">
                        <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                        Checking...
                    </span>
                );
            case 'ready':
                return (
                    <span className="badge bg-success">
                        <i className="bi bi-check-circle me-1"></i>
                        Connected
                    </span>
                );
            case 'failed':
                return (
                    <span className="badge bg-danger">
                        <i className="bi bi-x-circle me-1"></i>
                        Failed
                    </span>
                );
            case 'not-required':
                return (
                    <span className="badge bg-secondary">
                        <i className="bi bi-pencil me-1"></i>
                        Manual Input
                    </span>
                );
            default:
                return (
                    <span className="badge bg-secondary">
                        <i className="bi bi-question-circle me-1"></i>
                        Unknown
                    </span>
                );
        }
    };

    const getAlertClass = () => {
        switch (status) {
            case 'ready':
                return 'alert-success';
            case 'failed':
                return 'alert-danger';
            case 'checking':
                return 'alert-warning';
            case 'not-required':
                return 'alert-info';
            default:
                return 'alert-secondary';
        }
    };

    const getIcon = () => {
        switch (status) {
            case 'ready':
                return 'bi-check-circle-fill';
            case 'failed':
                return 'bi-exclamation-triangle-fill';
            case 'checking':
                return 'bi-hourglass-split';
            case 'not-required':
                return 'bi-info-circle-fill';
            default:
                return 'bi-question-circle-fill';
        }
    };

    // Show connection info if instrument has configuration
    const hasConnection = !!(
        instrument.configuration?.com_port || 
        instrument.configuration?.ip_address
    );

    return (
        <div className="mb-4">
            <h5 className="mb-3">
                <i className="bi bi-plugin me-2"></i>
                Connection Status
            </h5>

            <div className={`alert ${getAlertClass()} d-flex align-items-center justify-content-between`}>
                <div className="d-flex align-items-center">
                    <i className={`bi ${getIcon()} me-2`}></i>
                    <div>
                        <div className="mb-1">
                            {getStatusBadge()}
                        </div>
                        <div className="small">{message}</div>
                    </div>
                </div>

                {status === 'failed' && (
                    <button 
                        className="btn btn-sm btn-outline-danger"
                        onClick={onRetry}
                    >
                        <i className="bi bi-arrow-clockwise me-1"></i>
                        Retry
                    </button>
                )}
            </div>

            {hasConnection && (
                <div className="card border-0 bg-light">
                    <div className="card-body p-3">
                        <h6 className="card-subtitle mb-2 text-muted">
                            <i className="bi bi-gear me-1"></i>
                            Connection Configuration
                        </h6>
                        <div className="row g-2 small">
                            {instrument.configuration?.com_port && (
                                <div className="col-md-6">
                                    <strong>COM Port:</strong> {instrument.configuration.com_port}
                                </div>
                            )}
                            {instrument.configuration?.baud_rate && (
                                <div className="col-md-6">
                                    <strong>Baud Rate:</strong> {instrument.configuration.baud_rate}
                                </div>
                            )}
                            {instrument.configuration?.ip_address && (
                                <div className="col-md-6">
                                    <strong>IP Address:</strong> {instrument.configuration.ip_address}
                                </div>
                            )}
                            {instrument.configuration?.tcp_port && (
                                <div className="col-md-6">
                                    <strong>TCP Port:</strong> {instrument.configuration.tcp_port}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConnectionStatus;