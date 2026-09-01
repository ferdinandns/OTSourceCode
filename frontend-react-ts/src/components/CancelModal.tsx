import React from 'react';

interface CancelModalProps {
    show: boolean;
    loading: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

const CancelModal: React.FC<CancelModalProps> = ({
    show,
    loading,
    onClose,
    onConfirm
}) => {
    if (!show) return null;

    return (
        <div
            className="modal fade show d-block"
            style={{
                backgroundColor: 'rgba(0,0,0,0.5)',
                zIndex: 1050
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget && !loading) {
                    onClose();
                }
            }}
        >
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                    <div className="modal-header bg-danger text-white">
                        <h5 className="modal-title">
                            <i className="bi bi-exclamation-triangle me-2"></i>
                            Konfirmasi Batalkan Verifikasi
                        </h5>
                        <button
                            type="button"
                            className="btn-close btn-close-white"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!loading) onClose();
                            }}
                            disabled={loading}
                        ></button>
                    </div>

                    <div className="modal-body">
                        <div className="alert alert-warning">
                            <i className="bi bi-info-circle me-2"></i>
                            <strong>Perhatian!</strong> Verifikasi sedang dalam proses.
                        </div>

                        <p>Apakah Anda yakin ingin membatalkan?</p>

                        <div className="card bg-light">
                            <div className="card-body">
                                <h6>Yang akan terjadi:</h6>
                                <ul className="mb-0">
                                    <li>Data verifikasi akan dihapus</li>
                                    <li>Kembali ke daftar verifikasi</li>
                                    <li>Harus diulang dari awal</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button
                            className="btn btn-secondary"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onClose();
                            }}
                            disabled={loading}
                            type="button"
                        >
                            Tidak, Lanjutkan
                        </button>

                        <button
                            className="btn btn-danger"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onConfirm();
                            }}
                            disabled={loading}
                            type="button"
                        >
                            {loading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2"></span>
                                    Membatalkan...
                                </>
                            ) : (
                                <>Ya, Batalkan</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CancelModal;