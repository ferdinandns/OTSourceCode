// src/views/verification/components/FormStep.tsx

import React from 'react';
import { InstrumentDetail, ConnectionStatus } from '../types/verification';

interface FormStepProps {
    instrument: InstrumentDetail;
    roomTemp: string;
    roomHumidity: string;
    connectionStatus: ConnectionStatus;
    loading: boolean;
    onRoomTempChange: (value: string) => void;
    onRoomHumidityChange: (value: string) => void;
    onStartVerification: () => void;
    canStartVerification: boolean;
}

const FormStep: React.FC<FormStepProps> = ({
    instrument,
    roomTemp,
    roomHumidity,
    connectionStatus,
    loading,
    onRoomTempChange,
    onRoomHumidityChange,
    onStartVerification,
    canStartVerification
}) => {
    const needsConnection = !!(instrument.configuration?.com_port || instrument.configuration?.ip_address);

    return (
        <div>
            {/* Connection Alert - Only show for instruments with connection */}
            {needsConnection && (
                <>
                    {connectionStatus === 'checking' && (
                        <div className="alert alert-info">
                            <div className="d-flex align-items-center">
                                <span className="spinner-border spinner-border-sm me-2"></span>
                                <span>Checking instrument connection...</span>
                            </div>
                        </div>
                    )}

                    {connectionStatus === 'ready' && (
                        <div className="alert alert-success">
                            <i className="bi bi-check-circle-fill me-2"></i>
                            <strong>Connected!</strong> Instrument siap untuk verifikasi.
                        </div>
                    )}

                    {connectionStatus === 'failed' && (
                        <div className="alert alert-warning">
                            <i className="bi bi-exclamation-triangle-fill me-2"></i>
                            <strong>Connection Issue!</strong> Tidak dapat terhubung ke instrument.
                            Pastikan instrument menyala dan kabel terpasang dengan benar.
                        </div>
                    )}
                </>
            )}

            {/* Manual Input Instrument Note */}
            {!needsConnection && (
                <div className="alert alert-info mb-4">
                    <i className="bi bi-info-circle me-2"></i>
                    <strong>Manual Input Mode:</strong> Instrument ini tidak memerlukan koneksi otomatis.
                    Data akan diinput secara manual selama proses verifikasi.
                </div>
            )}

            <h5 className="mb-3">Informasi Ruangan</h5>
            <div className="row g-3">
                <div className="col-md-6">
                    <label className="form-label">No. Kontrol</label>
                    <input
                        type="text"
                        className="form-control"
                        value={instrument.no_kontrol}
                        readOnly
                    />
                </div>
                <div className="col-md-6">
                    <label className="form-label">Status</label>
                    <input
                        type="text"
                        className="form-control"
                        value={instrument.status}
                        readOnly
                    />
                </div>
                <div className="col-md-6">
                    <label className="form-label">Suhu Ruangan (°C) *</label>
                    <input
                        type="number"
                        step="0.1"
                        className="form-control"
                        value={roomTemp}
                        onChange={(e) => onRoomTempChange(e.target.value)}
                        placeholder="25.5"
                    />
                </div>
                <div className="col-md-6">
                    <label className="form-label">RH Ruangan (%) *</label>
                    <input
                        type="number"
                        step="0.1"
                        className="form-control"
                        value={roomHumidity}
                        onChange={(e) => onRoomHumidityChange(e.target.value)}
                        placeholder="60.0"
                    />
                </div>
            </div>

            <div className="mt-4">
                <button
                    className="btn btn-primary btn-lg"
                    onClick={onStartVerification}
                    disabled={!canStartVerification}
                >
                    {loading ? (
                        <>
                            <span className="spinner-border spinner-border-sm me-2"></span>
                            Processing...
                        </>
                    ) : !canStartVerification && needsConnection && connectionStatus !== 'ready' ? (
                        <>
                            <i className="bi bi-exclamation-circle me-2"></i>
                            Waiting for Connection
                        </>
                    ) : (
                        <>
                            <i className="bi bi-play-fill me-2"></i>
                            Start Verification
                        </>
                    )}
                </button>

                {/* Smart hint text */}
                {!canStartVerification && (
                    <p className="text-muted small mt-2 mb-0">
                        <i className="bi bi-info-circle me-1"></i>
                        {!roomTemp || !roomHumidity ?
                            'Lengkapi Suhu dan RH Ruangan' :
                            needsConnection && connectionStatus !== 'ready' ?
                                'Menunggu koneksi instrument...' :
                                'Mohon lengkapi form'
                        }
                    </p>
                )}
            </div>
        </div>
    );
};

export default FormStep;