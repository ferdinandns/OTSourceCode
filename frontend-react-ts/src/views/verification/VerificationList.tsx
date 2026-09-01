import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import SidebarMenu from '../../components/SidebarMenu';
import { GROUP_SUPERVISOR, useAuth } from '../../context/AuthContext';

interface VerificationInstrument {
  instrument_id: number;
  instrument_type: string;
  no_kontrol: string;
  nama_instrument: string;
  last_verified_at: string | null;
  last_verified_by: string;
  valid_until: string | null;
  status: string;
  can_verify_today: boolean;
  // NEW
  due_date: string | null;
  interval_days: number;
  is_overdue: boolean;
  custom_step_count: number;
}

const VerificationList: React.FC = () => {
  const navigate = useNavigate();
  const [instruments, setInstruments] = useState<VerificationInstrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [filterSite] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const { hasMinGroup } = useAuth();
  const isSupervisorPlus = hasMinGroup(GROUP_SUPERVISOR);
  const fetchInstruments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterSite) params.append('site', filterSite);
      const response = await api.get(`/api/verifications/instruments?${params}`);
      setInstruments(response.data.data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch instruments');
    } finally {
      setLoading(false);
    }
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  useEffect(() => {
    fetchInstruments();
  }, [filterSite]);

  const handleStartVerification = (instrumentId: number) => {
    navigate(`/verifications/start/${instrumentId}`);
  };

  const handleEditSteps = (instrumentType: string) => {
    navigate(`/verifications/edit-steps/${encodeURIComponent(instrumentType)}`);
  };

  const getStatusBadgeColor = (status: string) => {
    const colors: { [key: string]: string } = {
      Available: 'bg-success',
      Unverified: 'bg-warning',
      Unavailable: 'bg-danger',
      'In Used': 'bg-info',
    };
    return colors[status] || 'bg-secondary';
  };

  const filteredInstruments = instruments.filter((instrument) => {
    const matchesStatus =
      filterStatus === 'all'
        ? true
        : filterStatus === 'need_verification'
          ? instrument.can_verify_today
          : filterStatus === 'verified_today'
            ? !instrument.can_verify_today
            : filterStatus === 'overdue'
              ? instrument.is_overdue
              : instrument.status === filterStatus;

    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !query ||
      instrument.nama_instrument.toLowerCase().includes(query) ||
      instrument.no_kontrol.toLowerCase().includes(query) ||
      instrument.instrument_type.toLowerCase().includes(query);

    return matchesStatus && matchesSearch;
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDueDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getDueDateBadge = (instrument: VerificationInstrument) => {
    if (!instrument.due_date) return null;
    const due = new Date(instrument.due_date);
    const now = new Date();
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (instrument.is_overdue) {
      return (
        <span className="badge bg-danger">
          <i className="bi bi-exclamation-triangle-fill me-1"></i>
          Overdue {Math.abs(diffDays)}d
        </span>
      );
    }
    if (diffDays === 0) {
      return (
        <span className="badge bg-warning text-dark">
          <i className="bi bi-clock-fill me-1"></i>
          Due Today
        </span>
      );
    }
    if (diffDays <= 3) {
      return (
        <span className="badge bg-warning text-dark">
          <i className="bi bi-clock me-1"></i>
          Due in {diffDays}d
        </span>
      );
    }
    return (
      <span className="badge bg-light text-dark">
        <i className="bi bi-calendar-check me-1"></i>
        Due {formatDueDate(instrument.due_date)}
      </span>
    );
  };

  const overdueCount = instruments.filter((i) => i.is_overdue).length;

  if (loading) {
    return (
      <div className="container-fluid mt-3">
        <SidebarMenu isHorizontal={false} isSidebarOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
        <div className="d-flex justify-content-center align-items-center" style={{ height: '70vh' }}>
          <div className="text-center">
            <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="text-muted">Loading instruments...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid mt-3">
      <SidebarMenu isHorizontal={false} isSidebarOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />

      <div className="container-fluid" style={{ maxWidth: '1400px' }}>
        {/* Header */}
        <div className="d-flex align-items-center gap-3 mb-4">
          <button onClick={() => setIsSidebarOpen(true)} className="btn btn-link text-dark p-0" style={{ fontSize: '1.75rem' }}>
            <i className="bi bi-list"></i>
          </button>
          <div>
            <h2 className="fw-bold mb-1">Verifikasi Instrument</h2>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger alert-dismissible fade show" role="alert">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {error}
            <button type="button" className="btn-close" onClick={() => setError('')}></button>
          </div>
        )}

        {/* Overdue banner */}
        {overdueCount > 0 && (
          <div className="alert alert-danger d-flex align-items-center gap-2 mb-4" role="alert">
            <i className="bi bi-exclamation-triangle-fill fs-5"></i>
            <div>
              <strong>{overdueCount} instrument{overdueCount > 1 ? 's' : ''} overdue!</strong>{' '}
              Instrument tersebut telah diset ke status <strong>Unavailable</strong> secara otomatis.
            </div>
            <button className="btn btn-sm btn-outline-danger ms-auto" onClick={() => setFilterStatus('overdue')}>
              Lihat
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="row g-3 mb-4">
          <div className="col-6 col-md-3">
            <div className="card border-0 shadow-sm bg-primary bg-gradient text-white">
              <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="mb-1" style={{ fontSize: '0.8rem' }}>Total</h6>
                    <h3 className="mb-0 fw-bold">{instruments.length}</h3>
                  </div>
                  <i className="bi bi-clipboard-check" style={{ fontSize: '2rem', opacity: 0.3 }}></i>
                </div>
              </div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card border-0 shadow-sm bg-warning bg-gradient text-white">
              <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="mb-1" style={{ fontSize: '0.8rem' }}>Perlu Verifikasi</h6>
                    <h3 className="mb-0 fw-bold">{instruments.filter((i) => i.can_verify_today).length}</h3>
                  </div>
                  <i className="bi bi-exclamation-circle" style={{ fontSize: '2rem', opacity: 0.3 }}></i>
                </div>
              </div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card border-0 shadow-sm bg-success bg-gradient text-white">
              <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="mb-1" style={{ fontSize: '0.8rem' }}>Sudah Diverifikasi</h6>
                    <h3 className="mb-0 fw-bold">{instruments.filter((i) => !i.can_verify_today).length}</h3>
                  </div>
                  <i className="bi bi-check-circle" style={{ fontSize: '2rem', opacity: 0.3 }}></i>
                </div>
              </div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card border-0 shadow-sm bg-danger bg-gradient text-white">
              <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="mb-1" style={{ fontSize: '0.8rem' }}>Overdue</h6>
                    <h3 className="mb-0 fw-bold">{overdueCount}</h3>
                  </div>
                  <i className="bi bi-alarm" style={{ fontSize: '2rem', opacity: 0.3 }}></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body p-3">
            <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center gap-3">
              {/* Search */}
              <div className="input-group input-group-sm" style={{ maxWidth: '280px' }}>
                <span className="input-group-text bg-white border-end-0">
                  <i className="bi bi-search text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0 ps-0"
                  placeholder="Cari instrument, no. kontrol..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button className="btn btn-outline-secondary" onClick={() => setSearchQuery('')}>
                    <i className="bi bi-x"></i>
                  </button>
                )}
              </div>

              <div className="vr d-none d-md-block"></div>

              {/* Filter */}
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <i className="bi bi-funnel text-muted"></i>
                <span className="text-muted small me-1">Filter:</span>
                <div className="btn-group btn-group-sm flex-wrap" role="group">
                  <button
                    type="button"
                    onClick={() => setFilterStatus('all')}
                    className={`btn ${filterStatus === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
                  >
                    <i className="bi bi-grid me-1"></i>Semua ({instruments.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus('need_verification')}
                    className={`btn ${filterStatus === 'need_verification' ? 'btn-warning text-white' : 'btn-outline-warning'}`}
                  >
                    <i className="bi bi-exclamation-circle me-1"></i>
                    Perlu Verifikasi ({instruments.filter((i) => i.can_verify_today).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus('verified_today')}
                    className={`btn ${filterStatus === 'verified_today' ? 'btn-success' : 'btn-outline-success'}`}
                  >
                    <i className="bi bi-check-circle me-1"></i>
                    Sudah ({instruments.filter((i) => !i.can_verify_today).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus('overdue')}
                    className={`btn ${filterStatus === 'overdue' ? 'btn-danger' : 'btn-outline-danger'}`}
                  >
                    <i className="bi bi-alarm me-1"></i>
                    Overdue ({overdueCount})
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="row g-3">
          {filteredInstruments.map((instrument) => (
            <div key={instrument.instrument_id} className="col-md-6 col-lg-4">
              <div
                className={`card h-100 border-0 shadow-sm hover-lift ${instrument.is_overdue ? 'border-danger border-2' : ''}`}
                style={{ transition: 'transform 0.2s', borderWidth: instrument.is_overdue ? '2px' : undefined }}
              >
                <div className="card-body p-3">
                  {/* Header */}
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                        <span className="badge bg-light text-dark text-uppercase" style={{ fontSize: '0.7rem' }}>
                          {instrument.instrument_type}
                        </span>
                        <span className={`badge ${getStatusBadgeColor(instrument.status)}`}>
                          {instrument.status}
                        </span>
                        {getDueDateBadge(instrument)}
                      </div>
                      <h6 className="fw-bold mb-1">{instrument.nama_instrument}</h6>
                      <small className="text-muted">
                        <i className="bi bi-hash"></i>
                        {instrument.no_kontrol}
                      </small>
                    </div>
                    {/* Custom steps indicator */}
                    {instrument.custom_step_count > 0 && (
                      <span
                        className="badge bg-light text-primary border border-primary ms-2"
                        title={`${instrument.custom_step_count} custom step(s) configured`}
                        style={{ fontSize: '0.7rem' }}
                      >
                        <i className="bi bi-list-check me-1"></i>
                        {instrument.custom_step_count} steps
                      </span>
                    )}
                  </div>

                  {/* Last Verification Info */}
                  <div className="bg-light rounded p-2 mb-3">
                    {instrument.last_verified_at ? (
                      <div className="small">
                        <div className="d-flex align-items-center gap-2 mb-1">
                          <i className="bi bi-clock-history text-primary"></i>
                          <div className="flex-grow-1">
                            <span className="text-muted" style={{ fontSize: '0.75rem' }}>Terakhir: </span>
                            <span className="fw-medium">{formatDate(instrument.last_verified_at)}</span>
                          </div>
                        </div>
                        <div className="d-flex align-items-center gap-2 mb-1">
                          <i className="bi bi-person text-primary"></i>
                          <div className="flex-grow-1">
                            <span className="text-muted" style={{ fontSize: '0.75rem' }}>Oleh: </span>
                            <span className="fw-medium">{instrument.last_verified_by}</span>
                          </div>
                        </div>
                        {instrument.due_date && (
                          <div className="d-flex align-items-center gap-2">
                            <i className={`bi bi-calendar-event ${instrument.is_overdue ? 'text-danger' : 'text-primary'}`}></i>
                            <div className="flex-grow-1">
                              <span className="text-muted" style={{ fontSize: '0.75rem' }}>Due date: </span>
                              <span className={`fw-medium ${instrument.is_overdue ? 'text-danger' : ''}`}>
                                {formatDueDate(instrument.due_date)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-muted py-2">
                        <i className="bi bi-exclamation-circle d-block mb-1" style={{ fontSize: '1.25rem' }}></i>
                        <small>Belum pernah diverifikasi</small>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  {/* Action Buttons */}
                  <div className="d-flex gap-2">
                    <button
                      onClick={() => handleStartVerification(instrument.instrument_id)}
                      disabled={!instrument.can_verify_today}
                      className={`btn btn-sm flex-grow-1 ${instrument.can_verify_today ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      {instrument.can_verify_today ? (
                        <>
                          <i className="bi bi-check-circle me-1"></i>
                          Mulai Verifikasi
                        </>
                      ) : (
                        <>
                          <i className="bi bi-shield-check me-1"></i>
                          Sudah Diverifikasi
                        </>
                      )}
                    </button>

                    {/* Edit Steps button — superadmin only */}
                    {isSupervisorPlus && (
                      <button
                        onClick={() => handleEditSteps(instrument.nama_instrument)}
                        className="btn btn-sm btn-outline-secondary"
                        title="Edit verification steps & schedule"
                      >
                        <i className="bi bi-pencil-square"></i>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredInstruments.length === 0 && (
          <div className="card border-0 shadow-sm">
            <div className="card-body text-center py-5">
              <i className="bi bi-inbox text-muted d-block mb-3" style={{ fontSize: '4rem' }}></i>
              <h5 className="text-muted mb-2">Tidak ada instrument</h5>
              <p className="text-muted mb-0">Tidak ada instrument yang sesuai dengan filter yang dipilih.</p>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .hover-lift:hover {
          transform: translateY(-4px);
          box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important;
        }
      `}</style>
    </div>
  );
};

export default VerificationList;