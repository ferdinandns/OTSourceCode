// src/components/InstrumentReadingLayout.tsx
import React from 'react';
import InstrumentHeader from './InstrumentHeader';

interface ConnectionStatusBadgeProps {
    status: 'checking' | 'ready' | 'failed' | 'disconnected' | 'reading';
}

const ConnectionStatusBadge: React.FC<ConnectionStatusBadgeProps> = ({ status }) => {
    const statusConfig = {
        checking: { icon: 'bi-arrow-repeat', text: 'Checking...', color: 'warning', spinner: true },
        ready: { icon: 'bi-check-circle-fill', text: 'Connected', color: 'success', spinner: false },
        failed: { icon: 'bi-x-circle-fill', text: 'Connection Failed', color: 'danger', spinner: false },
        disconnected: { icon: 'bi-plug', text: 'Disconnected', color: 'secondary', spinner: false },
        reading: { icon: 'bi-arrow-repeat', text: 'Reading...', color: 'primary', spinner: true },
    };

    const config = statusConfig[status];

    return (
        <span className={`badge bg-${config.color} d-inline-flex align-items-center`}>
            {config.spinner ? (
                <span className="spinner-border spinner-border-sm me-2"></span>
            ) : (
                <i className={`${config.icon} me-2`}></i>
            )}
            {config.text}
        </span>
    );
};

interface InstrumentReadingLayoutProps {
    instrumentName: string;
    instrumentCode: string;
    instrumentType: string;
    connectionStatus: 'checking' | 'ready' | 'failed' | 'disconnected' | 'reading';
    needsConnection: boolean;
    children: React.ReactNode;
    actions?: React.ReactNode;
}

const InstrumentReadingLayout: React.FC<InstrumentReadingLayoutProps> = ({
    instrumentName,
    instrumentCode,
    instrumentType,
    connectionStatus,
    needsConnection,
    children,
    actions
}) => {
    return (
        <div className="container-fluid mt-3 mb-5">
            {/* Instrument Header */}
            <InstrumentHeader name={instrumentName} />

            {/* Instrument Info Card */}
            <div className="card border-0 shadow-sm mb-3">
                <div className="card-body">
                    <div className="row align-items-center">
                        <div className="col-md-4">
                            <div className="d-flex align-items-center">
                                <div className="bg-primary bg-opacity-10 rounded-3 p-3 me-3">
                                    <i className="bi bi-cpu-fill fs-3 text-primary"></i>
                                </div>
                                <div>
                                    <h5 className="mb-1">{instrumentName}</h5>
                                    <p className="text-muted small mb-0">
                                        <i className="bi bi-tag me-1"></i>
                                        {instrumentCode}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="text-center">
                                <small className="text-muted d-block mb-1">Type</small>
                                <span className="badge bg-info">
                                    {instrumentType.toUpperCase()}
                                </span>
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="text-end">
                                <small className="text-muted d-block mb-1">Connection Status</small>
                                <ConnectionStatusBadge status={connectionStatus} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Connection Alert for instruments that need connection */}
            {needsConnection && connectionStatus !== 'ready' && connectionStatus !== 'reading' && (
                <div className={`alert alert-${connectionStatus === 'failed' ? 'danger' : 'warning'} mb-3`}>
                    <div className="d-flex align-items-center">
                        <i className={`bi ${connectionStatus === 'failed' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill'} me-2 fs-5`}></i>
                        <div>
                            <strong>
                                {connectionStatus === 'checking' && 'Checking Connection...'}
                                {connectionStatus === 'failed' && 'Connection Failed!'}
                                {connectionStatus === 'disconnected' && 'Not Connected'}
                            </strong>
                            <p className="mb-0 small">
                                {connectionStatus === 'checking' && 'Memverifikasi koneksi ke instrument...'}
                                {connectionStatus === 'failed' && 'Pastikan instrument menyala dan kabel terpasang dengan benar.'}
                                {connectionStatus === 'disconnected' && 'Instrument tidak terhubung. Klik "Test Connection" untuk mencoba lagi.'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Manual Input Note for instruments without connection */}
            {!needsConnection && (
                <div className="alert alert-info mb-3">
                    <i className="bi bi-keyboard me-2"></i>
                    <strong>Manual Input Mode:</strong> Instrument ini tidak memerlukan koneksi otomatis.
                    Data akan diinput secara manual.
                </div>
            )}

            {/* Main Content */}
            <div className="row">
                <div className="col-12">
                    {children}
                </div>
            </div>

            {/* Action Buttons */}
            {actions && (
                <div className="card border-0 shadow-sm mt-3">
                    <div className="card-body">
                        <div className="d-flex justify-content-end gap-2">
                            {actions}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InstrumentReadingLayout;