import { useBridgePCs } from '../../../hooks/bridge/useBridge';
import { useNavigate } from 'react-router-dom';
import { BridgePCWithCount } from '../../../types/bridge';
import { useState } from 'react';
import SidebarMenu from '../../../components/SidebarMenu';
import { useAuth, GROUP_SUPERVISOR } from "../../../context/AuthContext";

export default function BridgePCList() {
  const { data, isLoading } = useBridgePCs();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { hasMinGroup } = useAuth();
  const isSupervisorPlus = hasMinGroup(GROUP_SUPERVISOR);

  const bridgePCs: BridgePCWithCount[] = data?.data || [];

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const getStatusBadge = (pc: BridgePCWithCount) => {
    // Check last_seen to determine if actually online
    if (pc.last_seen) {
      const lastSeen = new Date(pc.last_seen);
      const timeSinceLastSeen = Date.now() - lastSeen.getTime();

      // If last seen > 30 seconds ago, consider offline
      if (timeSinceLastSeen > 30000) {
        return (
          <span className="badge bg-secondary">
            <i className="bi bi-circle-fill me-1" style={{ fontSize: '0.5rem' }}></i>
            Offline
          </span>
        );
      }

      // Recently seen = online
      return (
        <span className="badge bg-success">
          <i className="bi bi-circle-fill me-1" style={{ fontSize: '0.5rem' }}></i>
          Online
        </span>
      );
    }

    // No last_seen = offline
    return (
      <span className="badge bg-secondary">
        <i className="bi bi-circle-fill me-1" style={{ fontSize: '0.5rem' }}></i>
        Offline
      </span>
    );
  };

  const formatLastSeen = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="container-fluid mt-3">
        <SidebarMenu
          isHorizontal={false}
          isSidebarOpen={isSidebarOpen}
          toggleSidebar={toggleSidebar}
        />
        <div className="d-flex justify-content-center align-items-center" style={{ height: '70vh' }}>
          <div className="text-center">
            <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="text-muted">Loading Bridge PCs...</p>
          </div>
        </div>
      </div>
    );
  }
  const isPcOnline = (pc: BridgePCWithCount) => {
    if (!pc.last_seen) return false;

    const lastSeen = new Date(pc.last_seen);
    const timeSinceLastSeen = Date.now() - lastSeen.getTime();

    // Same logic as detail page: > 30 seconds = offline
    return timeSinceLastSeen <= 30000;
  };

  // Calculate accurate online/offline counts
  const onlineCount = bridgePCs.filter(pc => isPcOnline(pc)).length;
  const offlineCount = bridgePCs.filter(pc => !isPcOnline(pc)).length;
  const totalInstruments = bridgePCs.reduce((sum, pc) => sum + (pc.instrument_count || 0), 0);


  return (
    <div className="container-fluid mt-3">
      {/* Sidebar */}
      <SidebarMenu
        isHorizontal={false}
        isSidebarOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
      />

      {/* Main Content */}
      <div className="container-fluid" style={{ maxWidth: '1400px' }}>
        {/* Header with Hamburger */}
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div className="d-flex align-items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="btn btn-link text-dark p-0"
              style={{ fontSize: '1.75rem' }}
            >
              <i className="bi bi-list"></i>
            </button>
            <div>
              <h4 className="mb-1 fw-bold">
                <i className="bi bi-hdd-network-fill me-2 text-primary"></i>
                Bridge PC Management
              </h4>
              <p className="text-muted mb-0 small">
                Manage and monitor bridge PCs for instrument communication
              </p>
            </div>
          </div>
          <div className="d-flex justify-content-between align-items-center mb-3">
            {isSupervisorPlus ? (
              <button
                className="btn btn-primary"
                onClick={() => navigate('/bridge/register')}
              >
                <i className="bi bi-plus-circle me-2"></i>
                Register New PC
              </button>
            ) : (
              <div />
            )

            }

          </div>

        </div>

        {/* Statistics Cards */}
        <div className="row g-3 mb-4">
          <div className="col-md-3">
            <div className="card border-0 shadow-sm bg-primary bg-gradient text-white">
              <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="mb-1 opacity-75 small">Total Bridge PCs</h6>
                    <h3 className="mb-0 fw-bold">{bridgePCs.length}</h3>
                  </div>
                  <i className="bi bi-hdd-network" style={{ fontSize: '2.5rem', opacity: 0.3 }}></i>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card border-0 shadow-sm bg-success bg-gradient text-white">
              <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="mb-1 opacity-75 small">Online</h6>
                    <h3 className="mb-0 fw-bold">{onlineCount}</h3>
                  </div>
                  <i className="bi bi-check-circle-fill" style={{ fontSize: '2.5rem', opacity: 0.3 }}></i>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card border-0 shadow-sm bg-secondary bg-gradient text-white">
              <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="mb-1 opacity-75 small">Offline</h6>
                    <h3 className="mb-0 fw-bold">{offlineCount}</h3>
                  </div>
                  <i className="bi bi-x-circle-fill" style={{ fontSize: '2.5rem', opacity: 0.3 }}></i>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card border-0 shadow-sm bg-info bg-gradient text-white">
              <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="mb-1 opacity-75 small">Total Instruments</h6>
                    <h3 className="mb-0 fw-bold">{totalInstruments}</h3>
                  </div>
                  <i className="bi bi-gear-fill" style={{ fontSize: '2.5rem', opacity: 0.3 }}></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bridge PC Cards */}
        {bridgePCs.length === 0 ? (
          <div className="card border-0 shadow-sm">
            <div className="card-body text-center py-5">
              <i className="bi bi-hdd-network text-muted d-block mb-3" style={{ fontSize: '4rem' }}></i>
              <h5 className="text-muted mb-2">No Bridge PCs Registered</h5>
              <p className="text-muted mb-3">
                Click "Register New PC" to add your first bridge PC.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => navigate('/bridge/register')}
              >
                <i className="bi bi-plus-circle me-2"></i>
                Register New PC
              </button>
            </div>
          </div>
        ) : (
          <div className="row g-3">
            {bridgePCs.map((pc) => (
              <div key={pc.id} className="col-md-6 col-lg-4">
                <div className="card h-100 border-0 shadow-sm hover-lift" style={{ transition: 'transform 0.2s' }}>
                  <div className="card-body p-3">
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div>
                        <h6 className="fw-bold mb-1">
                          <i className="bi bi-pc-display-horizontal text-primary me-2"></i>
                          {pc.pc_id}
                        </h6>
                        <small className="text-muted">{pc.hostname}</small>
                      </div>
                      {getStatusBadge(pc)}
                    </div>

                    <div className="bg-light rounded p-2 mb-3">
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <i className="bi bi-geo-alt-fill text-primary"></i>
                        <div className="flex-grow-1">
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>Location</div>
                          <div className="fw-medium small">{pc.location}</div>
                        </div>
                      </div>

                      {pc.ip_address && (
                        <div className="d-flex align-items-center gap-2 mb-2">
                          <i className="bi bi-wifi text-primary"></i>
                          <div className="flex-grow-1">
                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>IP Address</div>
                            <div className="fw-medium small">
                              <code className="text-primary">{pc.ip_address}</code>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-clock-history text-primary"></i>
                        <div className="flex-grow-1">
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>Last Seen</div>
                          <div className="fw-medium small">{formatLastSeen(pc.last_seen)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <span className="badge bg-info bg-opacity-10 text-info">
                        <i className="bi bi-gear me-1"></i>
                        {pc.instrument_count || 0} Instrument{(pc.instrument_count || 0) !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <button
                      className="btn btn-sm btn-outline-primary w-100"
                      onClick={() => navigate(`/bridge/pcs/${pc.pc_id}`)}
                    >
                      <i className="bi bi-box-arrow-up-right me-1"></i>
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
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
}