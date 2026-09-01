import { useParams } from 'react-router-dom';
import {
  useBridgeStatus,
  useBridgeReadings,
  useStartInstrument,
  useStopInstrument,
  useRestartInstrument,
  useStartBridge,
  useStopBridge,
  useRestartBridge
} from '../../../hooks/bridge/useBridge';
import { useInstruments } from '../../../hooks/instrument/useInstrument';
import { useState, useMemo } from 'react';
import SidebarMenu from '../../../components/SidebarMenu';
export default function BridgePCDetail() {
  const { pcId } = useParams<{ pcId: string }>();
  const [selectedInstrument, setSelectedInstrument] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'bridge' | 'instrument';
    action: 'start' | 'stop' | 'restart';
    instrumentId?: number;
    instrumentName?: string;
  } | null>(null);

  const { data: statusData, isLoading: statusLoading, error: statusError } = useBridgeStatus(pcId!);
  const { data: readingsData } = useBridgeReadings(pcId);
  const { data: instrumentsData, refetch: refetchInstruments } = useInstruments();

  const startInstrumentMutation = useStartInstrument();
  const stopInstrumentMutation = useStopInstrument();
  const restartInstrumentMutation = useRestartInstrument();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };
  const startBridgeMutation = useStartBridge();
  const stopBridgeMutation = useStopBridge();
  const restartBridgeMutation = useRestartBridge();

  // DEKLARASI SEMUA VARIABLES DULU
  const status = statusData?.data;
  const allReadings = readingsData?.data || [];
  const allInstruments = instrumentsData?.data?.data || [];
  const bridgeRunning = status?.bridge_running || false;

  // BARU DEFINE HELPER FUNCTION 
  const getBridgeServiceStatus = useMemo(() => {
    if (!status?.online) {
      return {
        status: 'offline',
        color: 'secondary',
        icon: 'circle',
        text: 'PC Offline',
        description: 'Bridge PC is not connected'
      };
    }

    if (status?.last_seen) {
      const lastSeen = new Date(status.last_seen);
      const timeSinceLastSeen = Date.now() - lastSeen.getTime();

      if (timeSinceLastSeen > 30000) {
        return {
          status: 'disconnected',
          color: 'warning',
          icon: 'exclamation-triangle',
          text: 'Connection Lost',
          description: `Last seen ${Math.floor(timeSinceLastSeen / 1000)}s ago`
        };
      }
    }

    if (bridgeRunning) {
      return {
        status: 'running',
        color: 'success',
        icon: 'play-circle-fill',
        text: 'Running',
        description: 'Bridge service is active'
      };
    } else {
      return {
        status: 'stopped',
        color: 'danger',
        icon: 'stop-circle-fill',
        text: 'Stopped',
        description: 'Bridge service is paused'
      };
    }
  }, [status, bridgeRunning]);

  const assignedInstruments = useMemo(() =>
    allInstruments.filter((inst: any) => inst.bridge_pc_id === pcId),
    [allInstruments, pcId]
  );

  const readingsByInstrument = useMemo(() =>
    assignedInstruments.reduce((acc: any, inst: any) => {
      acc[inst.id] = allReadings.filter((r: any) => r.instrument_id === inst.id);
      return acc;
    }, {}),
    [assignedInstruments, allReadings]
  );

  const displayReadings = selectedInstrument
    ? readingsByInstrument[selectedInstrument] || []
    : allReadings;

  const handleStartBridge = () => {
    setConfirmAction({ type: 'bridge', action: 'start' });
  };

  const handleStopBridge = () => {
    setConfirmAction({ type: 'bridge', action: 'stop' });
  };

  const handleRestartBridge = () => {
    setConfirmAction({ type: 'bridge', action: 'restart' });
  };

  const handleStartInstrument = (instrumentId: number, instrumentName: string) => {
    setConfirmAction({ type: 'instrument', action: 'start', instrumentId, instrumentName });
  };

  const handleStopInstrument = (instrumentId: number, instrumentName: string) => {
    setConfirmAction({ type: 'instrument', action: 'stop', instrumentId, instrumentName });
  };

  const handleRestartInstrument = (instrumentId: number, instrumentName: string) => {
    setConfirmAction({ type: 'instrument', action: 'restart', instrumentId, instrumentName });
  };

  const executeAction = async () => {
    if (!confirmAction || !pcId) return;

    try {
      if (confirmAction.type === 'bridge') {
        switch (confirmAction.action) {
          case 'start':
            await startBridgeMutation.mutateAsync(pcId);
            break;
          case 'stop':
            await stopBridgeMutation.mutateAsync(pcId);
            break;
          case 'restart':
            await restartBridgeMutation.mutateAsync(pcId);
            break;
        }
        alert(`Bridge ${confirmAction.action.toUpperCase()} command sent successfully!`);
      } else {
        const payload = { pcId, instrumentId: confirmAction.instrumentId! };

        switch (confirmAction.action) {
          case 'start':
            await startInstrumentMutation.mutateAsync(payload);
            break;
          case 'stop':
            await stopInstrumentMutation.mutateAsync(payload);
            break;
          case 'restart':
            await restartInstrumentMutation.mutateAsync(payload);
            break;
        }

        // ✅ Refetch instruments data immediately after action
        setTimeout(() => {
          refetchInstruments();
        }, 500);

        alert(`Instrument ${confirmAction.action.toUpperCase()} command sent successfully!`);
      }
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.message || error.message}`);
    } finally {
      setConfirmAction(null);
    }
  };

  const isPending =
    startInstrumentMutation.isPending ||
    stopInstrumentMutation.isPending ||
    restartInstrumentMutation.isPending ||
    startBridgeMutation.isPending ||
    stopBridgeMutation.isPending ||
    restartBridgeMutation.isPending;

  if (statusLoading) {
    return (
      <div className="container mt-4 text-center">
        <div className="spinner-border text-primary"></div>
        <p className="mt-3">Loading Bridge PC: {pcId}</p>
      </div>
    );
  }

  if (statusError) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger">
          <h5>Failed to load Bridge PC status</h5>
          <p>PC ID: {pcId}</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="container mt-4">
        <div className="alert alert-warning">
          <h5>Bridge PC not found</h5>
          <p>PC ID: {pcId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      {/* Sidebar */}
      <SidebarMenu
        isHorizontal={false}
        isSidebarOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
      />
      {/* Header with Bridge Power Control */}
      <div className="d-flex align-items-center gap-2 mb-4">

        <button
          onClick={() => setIsSidebarOpen(true)}
          className="btn btn-link text-dark p-0"
          style={{ fontSize: '1.75rem' }}
        >
          <i className="bi bi-list"></i>
        </button>
        <div>
          <h3 className="mb-1">Bridge PC: {pcId}</h3>
          <p className="text-muted mb-0">
            {status?.hostname} • {status?.location}
          </p>
        </div>

        <div className="btn-group ms-auto" role="group">
          {bridgeRunning ? (
            <>
              <button
                className="btn btn-warning"
                onClick={handleRestartBridge}
                disabled={isPending || !status?.online}
                title="Restart entire Bridge service"
              >
                <i className="bi bi-arrow-clockwise me-2"></i>
                Restart Bridge
              </button>
              <button
                className="btn btn-danger"
                onClick={handleStopBridge}
                disabled={isPending || !status?.online}
                title="Stop entire Bridge service (gracefully)"
              >
                <i className="bi bi-power me-2"></i>
                Stop Bridge
              </button>
            </>
          ) : (
            <button
              className="btn btn-success btn-lg"
              onClick={handleStartBridge}
              disabled={isPending || !status?.online}
              title="Start entire Bridge service"
            >
              <i className="bi bi-play-circle me-2"></i>
              Start Bridge
            </button>
          )}
        </div>
      </div>

      {/* Warning if bridge stopped */}
      {!bridgeRunning && status?.online && (
        <div className="alert alert-warning d-flex align-items-center mb-4">
          <i className="bi bi-exclamation-triangle-fill me-3 fs-4"></i>
          <div>
            <strong>Bridge Service Stopped</strong>
            <p className="mb-0">The bridge service is not running. Click "Start Bridge" to enable instrument connections.</p>
          </div>
        </div>
      )}

      {/* Status Cards */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card">
            <div className="card-body">
              <h6 className="card-subtitle mb-3 text-muted">PC Status</h6>
              <h4>
                {status?.online ? (
                  <span className="text-success">
                    <i className="bi bi-circle-fill me-2"></i>Online
                  </span>
                ) : (
                  <span className="text-secondary">
                    <i className="bi bi-circle-fill me-2"></i>Offline
                  </span>
                )}
              </h4>
              <p className="text-muted small mb-0">
                Last seen: {status?.last_seen ? new Date(status.last_seen).toLocaleString() : 'Never'}
              </p>
            </div>
          </div>
        </div>

        {/* ✅ Bridge Service Status with Enhanced Display */}
        <div className="col-md-3">
          <div className="card">
            <div className="card-body">
              <h6 className="card-subtitle mb-3 text-muted">Bridge Service</h6>
              <h4>
                <span className={`text-${getBridgeServiceStatus.color}`}>
                  <i className={`bi bi-${getBridgeServiceStatus.icon} me-2`}></i>
                  {getBridgeServiceStatus.text}
                </span>
              </h4>
              <p className="text-muted small mb-0">
                {getBridgeServiceStatus.description}
              </p>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card">
            <div className="card-body">
              <h6 className="card-subtitle mb-3 text-muted">Location</h6>
              <p className="mb-1"><strong>{status?.location}</strong></p>
              <p className="text-muted small mb-0">{status?.ip_address || 'No IP'}</p>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card">
            <div className="card-body">
              <h6 className="card-subtitle mb-3 text-muted">Instruments</h6>
              <h4>{assignedInstruments.length}</h4>
              <p className="text-muted small mb-0">
                {status?.connected_count || 0} connected
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ Connection Details Card */}
      <div className="card mb-4">
        <div className="card-header">
          <h6 className="mb-0">Connection Details</h6>
        </div>
        <div className="card-body">
          <table className="table table-sm table-borderless mb-0">
            <tbody>
              <tr>
                <td className="text-muted" style={{ width: '150px' }}>PC Status:</td>
                <td>
                  <span className={`badge bg-${status?.online ? 'success' : 'secondary'}`}>
                    {status?.online ? 'Online' : 'Offline'}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="text-muted">Service State:</td>
                <td>
                  <span className={`badge bg-${getBridgeServiceStatus.color}`}>
                    {getBridgeServiceStatus.text}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="text-muted">Last Communication:</td>
                <td>
                  {status?.last_seen ? (
                    <>
                      {new Date(status.last_seen).toLocaleString()}
                      <span className="text-muted ms-2">
                        ({Math.floor((Date.now() - new Date(status.last_seen).getTime()) / 1000)}s ago)
                      </span>
                    </>
                  ) : (
                    <span className="text-muted">Never</span>
                  )}
                </td>
              </tr>
              <tr>
                <td className="text-muted">Active Instruments:</td>
                <td>
                  <strong>{status?.connected_count || 0}</strong> of <strong>{status?.instrument_count || 0}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Instruments List */}
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="mb-0">Assigned Instruments</h5>
        </div>
        <div className="card-body">
          {assignedInstruments.length === 0 ? (
            <div className="alert alert-info mb-0">
              No instruments assigned to this PC yet.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Port</th>
                    <th>Status</th>
                    <th>Last Seen</th>
                    <th>Readings</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedInstruments.map((inst: any) => {
                    const readingCount = readingsByInstrument[inst.id]?.length || 0;
                    const isConnected = inst.bridge_status === 'connected';

                    return (
                      <tr key={inst.id}>
                        <td><code>{inst.nomor_kontrol}</code></td>
                        <td>{inst.nama_instrument}</td>
                        <td>
                          <span className="badge bg-secondary">{inst.bridge_port || 'N/A'}</span>
                        </td>
                        <td>
                          {isConnected ? (
                            <span className="badge bg-success">Connected</span>
                          ) : (
                            <span className="badge bg-secondary">Disconnected</span>
                          )}
                        </td>
                        <td className="text-muted small">
                          {inst.last_bridge_seen ? new Date(inst.last_bridge_seen).toLocaleString() : '-'}
                        </td>
                        <td>
                          <span className="badge bg-primary">{readingCount}</span>
                        </td>
                        <td>
                          <div className="btn-group btn-group-sm" role="group">
                            <button
                              className="btn btn-outline-primary"
                              onClick={() => setSelectedInstrument(inst.id)}
                              title="View Readings"
                            >
                              <i className="bi bi-eye"></i>
                            </button>

                            {status?.online && bridgeRunning && (
                              <>
                                {isConnected ? (
                                  <>
                                    <button
                                      className="btn btn-outline-warning"
                                      onClick={() => handleRestartInstrument(inst.id, inst.nama_instrument)}
                                      disabled={isPending}
                                      title="Restart"
                                    >
                                      <i className="bi bi-arrow-clockwise"></i>
                                    </button>
                                    <button
                                      className="btn btn-outline-danger"
                                      onClick={() => handleStopInstrument(inst.id, inst.nama_instrument)}
                                      disabled={isPending}
                                      title="Stop"
                                    >
                                      <i className="bi bi-stop-circle"></i>
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    className="btn btn-outline-success"
                                    onClick={() => handleStartInstrument(inst.id, inst.nama_instrument)}
                                    disabled={isPending}
                                    title="Start"
                                  >
                                    <i className="bi bi-play-circle"></i>
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Recent Readings */}
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            {selectedInstrument
              ? `Readings: ${assignedInstruments.find((i: any) => i.id === selectedInstrument)?.NamaInstrument}`
              : 'All Recent Readings'
            }
          </h5>
          {selectedInstrument && (
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setSelectedInstrument(null)}
            >
              Show All
            </button>
          )}
        </div>
        <div className="card-body">
          {displayReadings.length === 0 ? (
            <div className="alert alert-info mb-0">
              {selectedInstrument
                ? 'No readings for this instrument yet.'
                : 'No readings yet.'
              }
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Instrument</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {displayReadings.slice(0, 100).map((reading: any) => (
                    <tr key={reading.id}>
                      <td className="text-muted small">
                        {new Date(reading.read_at).toLocaleString()}
                      </td>
                      <td>
                        {assignedInstruments.find((i: any) => i.id === reading.instrument_id)?.NamaInstrument || 'Unknown'}
                      </td>
                      <td>
                        <code className="text-break">{reading.value}</code>
                        {reading.unit && <span className="text-muted ms-1">{reading.unit}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {displayReadings.length > 50 && (
                <p className="text-muted text-center mb-0">
                  Showing 50 of {displayReadings.length} readings
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Confirm {confirmAction.action.toUpperCase()}
                  {confirmAction.type === 'bridge' ? ' Bridge' : ' Instrument'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setConfirmAction(null)}
                ></button>
              </div>
              <div className="modal-body">
                {confirmAction.type === 'bridge' ? (
                  <>
                    <p>
                      Are you sure you want to <strong>{confirmAction.action}</strong> the entire Bridge service?
                    </p>
                    <div className="alert alert-warning">
                      <i className="bi bi-exclamation-triangle me-2"></i>
                      <strong>PC: {pcId}</strong>
                    </div>
                    {confirmAction.action === 'stop' && (
                      <div className="alert alert-danger">
                        <i className="bi bi-shield-check me-2"></i>
                        <strong>Graceful Shutdown:</strong> All COM ports will be closed properly to prevent hardware damage.
                      </div>
                    )}
                    {confirmAction.action === 'restart' && (
                      <div className="alert alert-info">
                        <i className="bi bi-info-circle me-2"></i>
                        Bridge will stop gracefully, wait 2 seconds, then restart all instruments.
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p>
                      Are you sure you want to <strong>{confirmAction.action}</strong> this instrument?
                    </p>
                    <div className="alert alert-warning">
                      <i className="bi bi-exclamation-triangle me-2"></i>
                      <strong>{confirmAction.instrumentName}</strong>
                    </div>
                    {confirmAction.action === 'stop' && (
                      <p className="text-danger small mb-0">
                        <i className="bi bi-info-circle me-1"></i>
                        COM port will be closed gracefully to prevent hardware errors.
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setConfirmAction(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`btn btn-${confirmAction.action === 'stop' ? 'danger' :
                    confirmAction.action === 'restart' ? 'warning' : 'success'
                    }`}
                  onClick={executeAction}
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Processing...
                    </>
                  ) : (
                    `Yes, ${confirmAction.action}`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}