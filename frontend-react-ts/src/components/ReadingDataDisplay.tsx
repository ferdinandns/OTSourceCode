// src/components/ReadingDataDisplay.tsx
import React from 'react';
import { UISchemaField } from '../types/instrument';

interface ReadingDataDisplayProps {
    data: Record<string, any> | null;
    uiSchema: UISchemaField[];
    isReading: boolean;
    lastUpdate?: Date;
}

const ReadingDataDisplay: React.FC<ReadingDataDisplayProps> = ({
    data,
    uiSchema,
    isReading,
    lastUpdate
}) => {
    const formatValue = (value: any, field: UISchemaField) => {
        if (value === null || value === undefined) return '-';
        
        if (field.input === 'number' && field.decimal) {
            return Number(value).toFixed(field.decimal);
        }
        
        if (field.input === 'date' && value) {
            return new Date(value).toLocaleDateString('id-ID');
        }
        
        return String(value);
    };

    if (!data && !isReading) {
        return (
            <div className="card border-0 shadow-sm">
                <div className="card-body text-center py-5">
                    <i className="bi bi-speedometer2 text-muted fs-1 d-block mb-3"></i>
                    <h5 className="text-muted">Belum Ada Data Reading</h5>
                    <p className="text-muted mb-0">
                        Klik "Start Reading" untuk memulai pembacaan instrument
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-bottom">
                <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center">
                        <i className="bi bi-graph-up text-success fs-5 me-2"></i>
                        <h5 className="mb-0">Hasil Reading</h5>
                    </div>
                    {isReading && (
                        <span className="badge bg-success">
                            <span className="spinner-border spinner-border-sm me-1"></span>
                            Reading...
                        </span>
                    )}
                </div>
                {lastUpdate && (
                    <p className="text-muted small mb-0 mt-1">
                        <i className="bi bi-clock me-1"></i>
                        Last update: {lastUpdate.toLocaleTimeString('id-ID')}
                    </p>
                )}
            </div>
            <div className="card-body">
                {isReading && !data ? (
                    <div className="text-center py-4">
                        <div className="spinner-border text-primary mb-3" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                        <p className="text-muted">Menunggu data dari instrument...</p>
                    </div>
                ) : data ? (
                    <div className="row g-3">
                        {uiSchema.map((field) => (
                            <div key={field.field} className="col-md-6">
                                <div className="p-3 border rounded">
                                    <label className="form-label text-muted small mb-1">
                                        {field.label}
                                    </label>
                                    <div className="fs-4 fw-bold text-primary">
                                        {formatValue(data[field.field], field)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="alert alert-info">
                        <i className="bi bi-info-circle me-2"></i>
                        Tidak ada data yang tersedia
                    </div>
                )}

                {/* Raw Data (for debugging) */}
                {data && Object.keys(data).length > 0 && (
                    <details className="mt-3">
                        <summary className="text-muted small cursor-pointer">
                            <i className="bi bi-code-square me-1"></i>
                            Lihat Raw Data
                        </summary>
                        <pre className="mt-2 p-3 bg-light rounded small">
                            {JSON.stringify(data, null, 2)}
                        </pre>
                    </details>
                )}
            </div>
        </div>
    );
};

export default ReadingDataDisplay;