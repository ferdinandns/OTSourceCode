import { useParams, useNavigate, Link } from "react-router-dom";
import { useInstrumentDetail } from "../../hooks/instrument/useInstrumentDetail";
import { useState, useMemo } from "react";
import SidebarMenu from "../../components/SidebarMenu";
import axiosInstance from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { StatusBadge } from "../../components/StatusBadge";

// Tells the backend to copy the already-generated PDF into file_path / file_path_2.
async function savePDFToServer(endpoint: string, body?: object): Promise<void> {
  try {
    await axiosInstance.post(endpoint, body ?? {});
    console.log(`[PDF] ✅ Saved to server path via ${endpoint}`);
  } catch (err: any) {
    console.warn(`[PDF] ⚠️ save-to-path failed (${endpoint}):`, err?.response?.data?.message ?? err?.message);
  }
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
}

function parseFilename(header: string | undefined, fallback: string): string {
  if (!header) return fallback;
  const patterns = [
    /filename\*=UTF-8''([^;]+)/,
    /filename="([^"]+)"/,
    /filename=([^;]+)/,
  ];
  for (const pattern of patterns) {
    const match = header.match(pattern);
    if (match?.[1]) return decodeURIComponent(match[1].trim());
  }
  return fallback;
}

export default function InstrumentView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { data, isLoading, refetch } = useInstrumentDetail(id!);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'danger' } | null>(null);
  const { isSupervisorOrAbove } = useAuth();

  const showToast = (message: string, type: 'success' | 'danger') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); // default 10 rows
  const [searchQuery, setSearchQuery] = useState("");

  // ============================================
  // VERIFICATION DETAIL MODAL STATE
  // ============================================
  const [verificationModal, setVerificationModal] = useState<{
    open: boolean;
    verificationId: number | null;
    data: any | null;
    loading: boolean;
    approving: boolean;
    approvalNotes: string;
  }>({
    open: false,
    verificationId: null,
    data: null,
    loading: false,
    approving: false,
    approvalNotes: '',
  });

  const openVerificationModal = async (verificationId: number) => {
    setVerificationModal(prev => ({ ...prev, open: true, verificationId, loading: true, data: null, approvalNotes: '' }));
    try {
      const res = await axiosInstance.get(`/api/verifications/${verificationId}`);
      setVerificationModal(prev => ({ ...prev, loading: false, data: res.data.data }));
    } catch (err: any) {
      setVerificationModal(prev => ({ ...prev, loading: false }));
      showToast('Failed to load verification detail', 'danger');
    }
  };

  const closeVerificationModal = () => {
    setVerificationModal({ open: false, verificationId: null, data: null, loading: false, approving: false, approvalNotes: '' });
  };

  const handleVerificationApproval = async (approved: boolean) => {
    if (!verificationModal.verificationId) return;
    setVerificationModal(prev => ({ ...prev, approving: true }));
    try {
      await axiosInstance.post(`/api/verifications/${verificationModal.verificationId}/approve`, {
        approved,
        notes: verificationModal.approvalNotes,
      });
      showToast(approved ? 'Verification approved successfully' : 'Verification rejected', approved ? 'success' : 'danger');
      closeVerificationModal();
      refetch();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to process approval', 'danger');
      setVerificationModal(prev => ({ ...prev, approving: false }));
    }
  };

  // Extract data dengan fallback
  const responseData = data?.data || data;

  const unifiedHistory = responseData?.unified_history ||
    responseData?.UnifiedHistory ||
    [];

  console.log("=== UNIFIED HISTORY DEBUG ===", unifiedHistory);

  // Helper: parse sampel array from history item — defined early so filteredHistory can use it
  const parseSampel = (history: any): string => {
    const raw = history.sampel || history.Sampel;
    if (!raw) return "-";
    if (Array.isArray(raw)) return raw.join(", ") || "-";
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.join(", ") || "-";
      return String(raw);
    } catch {
      return String(raw);
    }
  };

  // Format tanggal helper used inside filter (defined before filteredHistory)
  const fmtDateStr = (dateString: string | Date | null | undefined): string => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "";
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0");
      return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
    } catch { return ""; }
  };

  // Filter unified history based on search query
  const filteredHistory = useMemo(() => {
    const cleaned = unifiedHistory.filter((history: any) => {
      const isRereadChild = !!(history.parent_usage_id || history.ParentUsageID)
      const hasNoEndTime = !(history.end_time || history.EndTime || history.endTime)
      if (isRereadChild && hasNoEndTime) return false
      return true
    })
    if (!searchQuery.trim()) return cleaned;

    return cleaned.filter((history: any) => {
      const q = searchQuery.toLowerCase();

      const fields = [
        history.type,
        history.user,
        history.User,
        history.status,
        history.Status,
        history.notes,
        history.Notes,
        history.kategori_sampel,
        history.KategoriSampel,
        // formatted start time
        fmtDateStr(history.timestamp || history.TanggalWaktu || history.tanggal_waktu),
        // formatted end time
        fmtDateStr(history.end_time || history.EndTime || history.endTime),
        // sampel (parsed)
        parseSampel(history),
        // valid_until for verifications
        fmtDateStr(history.valid_until || history.ValidUntil),
        // raw ISO strings as fallback
        history.timestamp,
        history.end_time,
        history.EndTime,
      ];

      return fields.some(f => f && f.toString().toLowerCase().includes(q));
    });
  }, [unifiedHistory, searchQuery]);

  // Format tanggal
  const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "-";
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch { return "-"; }
  };

  const formatDateTime = (dateString: string | Date | null | undefined) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "-";
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${day}-${month}-${year} ${hours}:${minutes}`;
    } catch { return "-"; }
  };

  // Format time only (HH:MM:SS)
  const formatTimeOnly = (dateString: string | Date | null | undefined) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "-";
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0"); // ✅ TAMBAH
      return `${hours}:${minutes}:${seconds}`;
    } catch { return "-"; }
  };

  const getValue = (obj: any, ...keys: string[]) => {
    if (!obj) return "-";
    for (const key of keys) {
      if (key.includes('.')) {
        const parts = key.split('.');
        let value = obj;
        let found = true;
        for (const part of parts) {
          if (value && value[part] !== undefined && value[part] !== null) {
            value = value[part];
          } else { found = false; break; }
        }
        if (found && value !== undefined && value !== null && value !== "") return value;
      } else {
        if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") return obj[key];
      }
    }
    return "-";
  };

  const getConfigValue = (obj: any, ...keys: string[]) => {
    if (!obj) return "-";
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null) {
        if (obj[key] === 0 || obj[key] === "") return obj[key] === 0 ? "0" : "Not Set";
        return obj[key];
      }
    }
    return "-";
  };

  if (isLoading) {
    return (
      <div className="container mt-3 text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3 text-muted">Loading instrument detail...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mt-3">
        <div className="alert alert-warning">
          <i className="bi bi-exclamation-triangle me-2"></i>
          Data instrument tidak ditemukan
        </div>
        <button className="btn btn-secondary" onClick={() => navigate("/instruments")}>
          Kembali ke List
        </button>
      </div>
    );
  }

  const instrumentName = getValue(responseData, 'nama_instrument', 'NamaInstrument', 'name', 'Nama');
  const controlNumber = getValue(responseData, 'nomor_kontrol', 'NomorKontrol', 'instrument_code', 'KodeInstrument', 'control_number');
  const picName = getValue(responseData, 'pic_instrument.name', 'PICInstrument.Name', 'pic_instrument', 'PICInstrument', 'pic_name');
  const site = getValue(responseData, 'lokasi_site', 'LokasiSite', 'site_location');
  const room = getValue(responseData, 'lokasi_instrument', 'LokasiInstrument', 'location_instrument', 'room');
  const calibrationDate = getValue(responseData, 'tanggal_kalibrasi', 'TanggalKalibrasi', 'calibration_date');
  const expiryDate = getValue(responseData, 'ed_kalibrasi', 'EDKalibrasi', 'calibration_expiry_date', 'tengat_kalibrasi', 'TenggatKalibrasi');
  const stockOpnameDate = getValue(responseData, 'tanggal_stock_opname', 'TanggalStockOpname', 'stock_opname_date');
  const picStockOpname = getValue(responseData, 'pic_stock_opname.name', 'PICStockOpname.Name', 'pic_stock_opname', 'PICStockOpname');

  // Configuration data
  const configData = responseData?.configuration || responseData?.Configuration || responseData?.InstrumentConfig || {};
  const baudRate = getConfigValue(configData, 'baud_rate', 'BaudRate');
  const parity = getConfigValue(configData, 'parity', 'Parity');
  const stopBits = getConfigValue(configData, 'stop_bits', 'StopBits', 'stop_bit');
  const dataBits = getConfigValue(configData, 'data_bits', 'DataBits', 'data_bit');
  const regexPattern = getConfigValue(configData, 'regex_pattern', 'RegexPattern');
  const ipAddress = getConfigValue(configData, 'ip_address', 'IPAddress');
  const tcpPort = getConfigValue(configData, 'tcp_port', 'TCPPort');
  const timeout = getConfigValue(configData, 'timeout', 'Timeout');
  const lastConfig = getValue(configData, 'updated_at', 'UpdatedAt') || getValue(responseData, 'updated_at');

  const hasConfig = configData && Object.keys(configData).length > 0;

  // Pagination calculations
  const totalItems = filteredHistory.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredHistory.slice(startIndex, endIndex);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const goToPage = (page: number) => setCurrentPage(Math.max(1, Math.min(page, totalPages)));

  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  const isSupervisor = isSupervisorOrAbove();

  return (
    <>
      <div className="container-fluid mt-3">
        {toast && (
          <div className="position-fixed top-0 end-0 p-3" style={{ zIndex: 9999 }}>
            <div className={`toast show align-items-center text-white bg-${toast.type} border-0`} role="alert">
              <div className="d-flex">
                <div className="toast-body d-flex align-items-center gap-2">
                  <i className={`bi ${toast.type === 'success' ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i>
                  {toast.message}
                </div>
                <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={() => setToast(null)} />
              </div>
            </div>
          </div>
        )}

        <SidebarMenu isHorizontal={false} isSidebarOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />

        <div className="container-fluid">
          {/* Header */}
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div className="d-flex align-items-center gap-2">
              <button onClick={() => setIsSidebarOpen(true)} className="btn btn-link text-dark p-0" style={{ fontSize: '1.5rem' }}>
                <i className="bi bi-list"></i>
              </button>
              <div>
                <h4 className="mb-0">{instrumentName} [{controlNumber}]</h4>
              </div>
            </div>
          </div>

          {/* ============================================
              MAIN INFO GRID
              - Supervisor+: 2 cards side by side (general + config)
              - Non-supervisor: general card full width
          ============================================ */}
          <div className="row g-3 mb-2">
            {/* General Info Card - always shown, full width for non-supervisor */}
            <div className={isSupervisor ? "col-md-6" : "col-12"}>
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body p-0">
                  <table className="table table-borderless mb-0" style={{ fontSize: '0.83rem' }}>
                    <tbody>
                      <tr>
                        <td className="bg-primary text-white fw-bold py-1 px-3" style={{ width: isSupervisor ? '40%' : '20%' }}>PIC Instrument</td>
                        <td className="py-1 px-3">{picName}</td>
                      </tr>
                      <tr>
                        <td className="bg-primary text-white fw-bold py-1 px-3">Lokasi Site</td>
                        <td className="py-1 px-3">{site}</td>
                      </tr>
                      <tr>
                        <td className="bg-primary text-white fw-bold py-1 px-3">Ruang</td>
                        <td className="py-1 px-3">{room}</td>
                      </tr>
                      <tr>
                        <td className="bg-primary text-white fw-bold py-1 px-3">Tanggal Kalibrasi</td>
                        <td className="py-1 px-3">{formatDate(calibrationDate)}</td>
                      </tr>
                      <tr>
                        <td className="bg-primary text-white fw-bold py-1 px-3">Tanggal ED Kalibrasi</td>
                        <td className="py-1 px-3">{formatDate(expiryDate)}</td>
                      </tr>
                      <tr>
                        <td className="bg-primary text-white fw-bold py-1 px-3">Tanggal Stock Opname</td>
                        <td className="py-1 px-3">{formatDate(stockOpnameDate)}</td>
                      </tr>
                      <tr>
                        <td className="bg-primary text-white fw-bold py-1 px-3">PIC Stock Opname</td>
                        <td className="py-1 px-3">{picStockOpname}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Config Card - only for supervisor and above */}
            {isSupervisor && (
              <div className="col-md-6">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body p-0">
                    {hasConfig ? (
                      <table className="table table-borderless mb-0" style={{ fontSize: '0.83rem' }}>
                        <tbody>
                          {baudRate !== "-" && (
                            <tr>
                              <td className="bg-success text-white fw-bold py-1 px-3" style={{ width: '40%' }}>Baud Rate</td>
                              <td className="py-1 px-3">{baudRate}</td>
                            </tr>
                          )}
                          {parity !== "-" && (
                            <tr>
                              <td className="bg-success text-white fw-bold py-1 px-3">Parity</td>
                              <td className="py-1 px-3">{parity}</td>
                            </tr>
                          )}
                          {stopBits !== "-" && (
                            <tr>
                              <td className="bg-success text-white fw-bold py-1 px-3">Stop Bit</td>
                              <td className="py-1 px-3">{stopBits}</td>
                            </tr>
                          )}
                          {dataBits !== "-" && (
                            <tr>
                              <td className="bg-success text-white fw-bold py-1 px-3">Data Bit</td>
                              <td className="py-1 px-3">{dataBits}</td>
                            </tr>
                          )}
                          {ipAddress !== "-" && (
                            <tr>
                              <td className="bg-success text-white fw-bold py-1 px-3">IP Address</td>
                              <td className="py-1 px-3">{ipAddress}</td>
                            </tr>
                          )}
                          {tcpPort !== "-" && (
                            <tr>
                              <td className="bg-success text-white fw-bold py-1 px-3">TCP Port</td>
                              <td className="py-1 px-3">{tcpPort}</td>
                            </tr>
                          )}
                          {timeout !== "-" && (
                            <tr>
                              <td className="bg-success text-white fw-bold py-1 px-3">Timeout</td>
                              <td className="py-1 px-3">{timeout} sec</td>
                            </tr>
                          )}
                          {regexPattern !== "-" && regexPattern !== "Not Set" && (
                            <tr>
                              <td className="bg-success text-white fw-bold py-1 px-3">Set Regular Expression</td>
                              <td className="py-1 px-3"><code>{regexPattern}</code></td>
                            </tr>
                          )}
                          {lastConfig !== "-" && (
                            <tr>
                              <td className="bg-success text-white fw-bold py-1 px-3">Last Configuration</td>
                              <td className="py-1 px-3">{formatDateTime(lastConfig)}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-4 text-center text-muted">
                        <i className="bi bi-gear fs-1 d-block mb-2"></i>
                        <p className="mb-0">Configuration not set</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="d-flex gap-2 mb-2 flex-wrap">
            <button className="btn btn-secondary" onClick={() => navigate("/instruments")}>
              <i className="bi bi-arrow-left me-2"></i>
              Kembali ke List Instrument
            </button>
            {isSupervisor && (
              <>
                <Link to={`/instruments/edit/${id}`} className="btn btn-primary">
                  Edit Instrument
                </Link>
                <Link to={`/instruments/config/${id}`} className="btn btn-success">
                  Edit Configuration
                </Link>
              </>
            )}
            <div className="ms-auto">
              <div className="input-group" style={{ width: '280px' }}>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Search riwayat..."
                  value={searchQuery}
                  onChange={handleSearch}
                />
                <button className="btn btn-outline-secondary btn-sm" type="button">
                  <i className="bi bi-search"></i>
                </button>
              </div>
            </div>
          </div>

          {/* ============================================
              RIWAYAT TABLE
          ============================================ */}
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center py-2">
              <h6 className="mb-0">Riwayat Instrument (Usage &amp; Verification)</h6>
              <span className="badge bg-light text-primary">
                {totalItems} record{totalItems !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover mb-0" style={{ fontSize: '0.83rem' }}>
                  <thead className="table-light">
                    <tr>
                      <th className="py-2 px-2" style={{ width: '80px' }}>Type</th>
                      <th className="py-2 px-2" style={{ width: '100px' }}>Start Time</th>
                      <th className="py-2 px-2" style={{ width: '100px' }}>End Time</th>
                      <th className="py-2 px-2" style={{ width: '100px' }}>Status</th>
                      <th className="py-2 px-2" style={{ width: '100px' }}>User</th>
                      <th className="py-2 px-2" style={{ width: '100px' }}>Kategori</th>
                      <th className="py-2 px-2">Sample</th>
                      <th className="py-2 px-2" style={{ width: '120px' }}>Details</th>
                      <th className="py-2 px-2 text-center" style={{ width: '110px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentItems && currentItems.length > 0 ? (
                      currentItems.map((history: any, index: number) => {
                        const historyType = history.type || 'usage';
                        const timestamp = history.timestamp || history.TanggalWaktu || history.tanggal_waktu;
                        const endTime = historyType === 'usage'
                          ? (history.end_time || history.EndTime || history.endTime)
                          : (history.completed_at || history.CompletedAt)
                        const user = history.user || history.User || '-';
                        const status = history.status || history.Status || '-';

                        // Usage-specific
                        const isExported = history.is_exported || history.IsExported || false;
                        const downloadCount = history.download_count || history.DownloadCount || 0;
                        const usageId = history.id || history.Id;
                        const kategoriSampel = history.kategori_sampel || history.KategoriSampel || '-';
                        const sampelDisplay = parseSampel(history);

                        // Verification-specific
                        const validUntil = history.valid_until || history.ValidUntil;
                        const roomTemp = history.room_temp || history.RoomTemp;
                        const roomHumidity = history.room_humidity || history.RoomHumidity;
                        const notes = history.notes || history.Notes || '';

                        return (
                          <tr key={`${historyType}-${index}`}>
                            {/* Type Badge */}
                            <td className="py-1 px-2 align-middle">
                              <span className={`badge ${historyType === 'verification' ? 'bg-info text-white' : 'bg-success'}`}
                                style={{ fontSize: '0.7rem' }}>
                                {historyType === 'verification' ? 'Verif' : 'Usage'}
                              </span>
                            </td>

                            {/* Start Timestamp */}
                            <td className="py-1 px-2 align-middle text-nowrap">
                              <div>{formatDate(timestamp)} {formatTimeOnly(timestamp)}</div>
                            </td>

                            {/* End Read */}
                            <td className="py-1 px-2 align-middle text-nowrap">
                              {endTime ? (
                                <div>{formatDate(endTime)} {formatTimeOnly(endTime)}</div>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>

                            {/* Status/Action */}
                            <td className="py-1 px-2 align-middle">
                              {historyType === 'verification' ? (
                                <div className="d-flex flex-column gap-1">
                                  <span className={`badge ${status === 'Complies' ? 'bg-success' :
                                    status === 'Not Complies' ? 'bg-danger' :
                                      status === 'In Progress' ? 'bg-warning' : 'bg-secondary'
                                    }`} style={{ fontSize: '0.68rem' }}>
                                    {status}
                                  </span>
                                  {(() => {
                                    const approvalStatus = history.approval_status || history.ApprovalStatus;
                                    if (!approvalStatus || approvalStatus === 'not_required') return null;
                                    const cfg: Record<string, { cls: string; label: string }> = {
                                      pending_approval: { cls: 'bg-warning text-dark', label: '⏳ Pending' },
                                      approved: { cls: 'bg-success', label: '✓ Approved' },
                                      rejected: { cls: 'bg-danger', label: '✗ Rejected' },
                                    };
                                    const badge = cfg[approvalStatus];
                                    return badge ? <span className={`badge ${badge.cls}`} style={{ fontSize: '0.65rem' }}>{badge.label}</span> : null;
                                  })()}
                                </div>
                              ) : (
                                <StatusBadge
                                  status={status}
                                  hasReread={history.has_reread || history.HasReread || false}
                                  parentUsageId={history.parent_usage_id || history.ParentUsageID || null}
                                  size="sm"
                                />
                              )}
                            </td>

                            {/* User */}
                            <td className="py-1 px-2 align-middle">
                              <span>{user}</span>
                            </td>

                            {/* Kategori Sample - usage only */}
                            <td className="py-1 px-2 align-middle">
                              {historyType === 'usage' ? (
                                <span>{kategoriSampel}</span>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>

                            {/* Sample - usage only, no truncation, wraps naturally */}
                            <td className="py-1 px-2 align-middle">
                              {historyType === 'usage' ? (
                                sampelDisplay !== '-' ? (
                                  <span>{sampelDisplay}</span>
                                ) : <span className="text-muted">-</span>
                              ) : (
                                // Verification: show temp/humidity here as additional context
                                (roomTemp || roomHumidity) ? (
                                  <span className="text-muted">
                                    {roomTemp && `${roomTemp}°C`}
                                    {roomTemp && roomHumidity && ' | '}
                                    {roomHumidity && `${roomHumidity}%`}
                                  </span>
                                ) : <span className="text-muted">-</span>
                              )}
                            </td>

                            {/* Details Column - compact */}
                            <td className="py-1 px-2 align-middle" style={{ fontSize: '0.75rem' }}>
                              {historyType === 'verification' ? (
                                <div>
                                  {validUntil && (
                                    <div className="text-muted">
                                      <i className="bi bi-calendar-check me-1"></i>
                                      s/d {formatDate(validUntil)}
                                    </div>
                                  )}
                                  {notes && (
                                    <div className="text-muted fst-italic">
                                      {notes.substring(0, 22)}{notes.length > 22 ? '…' : ''}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="d-flex align-items-center gap-1 flex-wrap">
                                  {downloadCount > 0 && (
                                    <span className="badge bg-success" style={{ fontSize: '0.65rem' }}>
                                      <i className="bi bi-download me-1"></i>{downloadCount}x
                                    </span>
                                  )}
                                  {isExported && (
                                    <span className="badge bg-info" style={{ fontSize: '0.65rem' }}>
                                      <i className="bi bi-file-pdf"></i> PDF
                                    </span>
                                  )}
                                  {!isExported && downloadCount === 0 && (
                                    <span className="text-muted" style={{ fontSize: '0.7rem' }}>—</span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Actions Column */}
                            <td className="py-1 px-2 align-middle text-center">
                              {historyType === 'verification' ? (
                                <div className="btn-group btn-group-sm">
                                  <button
                                    className="btn btn-outline-info btn-sm"
                                    title="View Details"
                                    style={{ padding: '2px 6px' }}
                                    onClick={() => openVerificationModal(history.id)}
                                  >
                                    <i className="bi bi-eye"></i>
                                  </button>
                                  <button
                                    className="btn btn-outline-secondary btn-sm"
                                    title="Download PDF"
                                    style={{ padding: '2px 6px' }}
                                    onClick={async () => {
                                      try {
                                        await savePDFToServer(
                                          `/api/verifications/${history.id}/save-pdf`,
                                          { instrument_id: responseData?.id }
                                        );
                                        const response = await axiosInstance.get(
                                          `/api/verifications/${history.id}/download-pdf`,
                                          { responseType: 'blob' }
                                        );
                                        const filename = parseFilename(
                                          response.headers['content-disposition'],
                                          `Verification_${history.id}.pdf`
                                        );
                                        triggerBrowserDownload(
                                          new Blob([response.data], { type: 'application/pdf' }),
                                          filename
                                        );
                                        refetch();
                                      } catch (err: any) {
                                        console.error('❌ Error downloading PDF:', err);
                                        if (err.response?.status === 401) {
                                          alert('Session expired. Please login again.');
                                          navigate('/login');
                                        } else {
                                          alert('Download failed: ' + (err.response?.data?.message || err.message || 'Unknown error'));
                                        }
                                      }
                                    }}
                                  >
                                    <i className="bi bi-file-pdf"></i>
                                  </button>
                                </div>
                              ) : (
                                usageId ? (
                                  status === "Re-read" ||
                                    status === "Read Process" ||
                                    !!(history.parent_usage_id || history.ParentUsageID) ||
                                    status === "Failed" ? (
                                    <button
                                      className="btn btn-sm btn-outline-secondary"
                                      disabled
                                      title="PDF tidak tersedia"
                                      style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                                    >
                                      <i className="bi bi-file-pdf me-1"></i>PDF
                                    </button>
                                  ) : (
                                    <div className="d-flex gap-1 justify-content-center flex-wrap">
                                      <button
                                        className="btn btn-sm btn-outline-primary"
                                        title="Lihat Hasil Pembacaan"
                                        style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                                        onClick={() => {
                                          window.open(
                                            `http://10.167.167.146:5173/instruments/after-reading/${usageId}`,
                                            '_blank'
                                          );
                                        }}
                                      >
                                        <i className="bi bi-eye"></i>
                                      </button>
                                      <button
                                        className="btn btn-sm btn-outline-success"
                                        title="Simpan PDF ke server"
                                        style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                                        onClick={async () => {
                                          try {
                                            const res = await axiosInstance.post(`/api/instruments/usage/${usageId}/save-pdf`);
                                            showToast(res.data?.message || 'PDF berhasil disimpan', 'success');
                                            refetch();
                                          } catch (err: any) {
                                            console.error('❌ Save PDF failed:', err);
                                            if (err.response?.status === 401) {
                                              navigate('/login');
                                            } else {
                                              showToast(
                                                'Gagal menyimpan PDF: ' + (err.response?.data?.message || err.message || 'Unknown error'),
                                                'danger'
                                              );
                                            }
                                          }
                                        }}
                                      >
                                        <i className="bi bi-file-earmark-arrow-down"></i>
                                      </button>
                                    </div>
                                  )
                                ) : (
                                  <span className="text-muted" style={{ fontSize: '0.7rem' }}>N/A</span>
                                )
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="text-center py-4 text-muted">
                          <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                          {searchQuery ? 'Tidak ada hasil yang cocok' : 'Belum ada riwayat'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalItems > 0 && (
                <div className="card-footer bg-light py-2">
                  <div className="row align-items-center">
                    <div className="col-md-5">
                      <div className="d-flex align-items-center gap-2">
                        <label className="mb-0 text-nowrap small">Show:</label>
                        <select
                          className="form-select form-select-sm"
                          style={{ width: 'auto' }}
                          value={itemsPerPage}
                          onChange={handleItemsPerPageChange}
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                        <span className="text-muted small text-nowrap">
                          {startIndex + 1}–{Math.min(endIndex, totalItems)} / {totalItems}
                        </span>
                      </div>
                    </div>

                    <div className="col-md-7">
                      <nav>
                        <ul className="pagination pagination-sm justify-content-end mb-0">
                          <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                            <button className="page-link" onClick={() => goToPage(1)} disabled={currentPage === 1}>‹‹</button>
                          </li>
                          <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                            <button className="page-link" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>‹</button>
                          </li>

                          {getPageNumbers().map((page, index) => (
                            typeof page === 'number' ? (
                              <li key={index} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                                <button className="page-link" onClick={() => goToPage(page)}>{page}</button>
                              </li>
                            ) : (
                              <li key={index} className="page-item disabled">
                                <span className="page-link">…</span>
                              </li>
                            )
                          ))}

                          <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                            <button className="page-link" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>›</button>
                          </li>
                          <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                            <button className="page-link" onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages}>››</button>
                          </li>
                        </ul>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================
          VERIFICATION DETAIL MODAL
      ============================================ */}
      {verificationModal.open && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}
          onClick={(e) => { if (e.target === e.currentTarget) closeVerificationModal(); }}
        >
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header bg-info text-white">
                <h5 className="modal-title">
                  <i className="bi bi-clipboard2-check me-2"></i>
                  Verification Detail
                  {verificationModal.data && (
                    <span className="ms-2 fs-6 fw-normal opacity-75">
                      #{verificationModal.data.id} — {verificationModal.data.nama_instrument}
                    </span>
                  )}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={closeVerificationModal} />
              </div>

              <div className="modal-body">
                {verificationModal.loading ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-info" role="status" />
                    <div className="mt-2 text-muted">Loading verification detail...</div>
                  </div>
                ) : verificationModal.data ? (() => {
                  const vd = verificationModal.data;
                  const canApprove =
                    isSupervisorOrAbove() &&
                    (vd.status === 'Complies' || vd.status === 'Not Complies' || vd.status === 'Completed') &&
                    (!vd.approval_status || vd.approval_status === 'not_required' || vd.approval_status === 'pending_approval');

                  return (
                    <>
                      <div className="row g-3 mb-4">
                        <div className="col-md-4">
                          <div className="card border-0 bg-light h-100">
                            <div className="card-body py-2 px-3">
                              <div className="text-muted small mb-1">Instrument</div>
                              <div className="fw-semibold">{vd.nama_instrument}</div>
                              <div className="text-muted small">{vd.no_kontrol}</div>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="card border-0 bg-light h-100">
                            <div className="card-body py-2 px-3">
                              <div className="text-muted small mb-1">Verified By</div>
                              <div className="fw-semibold">{vd.verified_by?.name || '-'}</div>
                              <div className="text-muted small">{vd.verified_at ? formatDateTime(vd.verified_at) : '-'}</div>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-2">
                          <div className="card border-0 bg-light h-100">
                            <div className="card-body py-2 px-3">
                              <div className="text-muted small mb-1">Result</div>
                              <span className={`badge fs-6 ${vd.status === 'Complies' ? 'bg-success' : vd.status === 'Not Complies' ? 'bg-danger' : 'bg-secondary'}`}>
                                {vd.status}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-2">
                          <div className="card border-0 bg-light h-100">
                            <div className="card-body py-2 px-3">
                              <div className="text-muted small mb-1">Approval</div>
                              {(() => {
                                const s = vd.approval_status;
                                const cfg: Record<string, { cls: string; label: string }> = {
                                  pending_approval: { cls: 'bg-warning text-dark', label: 'Pending' },
                                  approved: { cls: 'bg-success', label: 'Approved' },
                                  rejected: { cls: 'bg-danger', label: 'Rejected' },
                                  not_required: { cls: 'bg-secondary', label: 'N/A' },
                                };
                                const b = cfg[s] || cfg['not_required'];
                                return <span className={`badge fs-6 ${b.cls}`}>{b.label}</span>;
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>

                      {(vd.room_temp || vd.room_humidity) && (
                        <div className="alert alert-light border mb-3 py-2">
                          <i className="bi bi-thermometer-half me-1 text-info"></i>
                          Room Temp: <strong>{vd.room_temp ?? '-'}°C</strong>
                          <span className="mx-3">|</span>
                          <i className="bi bi-droplet me-1 text-info"></i>
                          Humidity: <strong>{vd.room_humidity ?? '-'}% RH</strong>
                        </div>
                      )}

                      <h6 className="fw-semibold mb-2">
                        <i className="bi bi-list-check me-1 text-info"></i>
                        Verification Steps
                      </h6>
                      <div className="table-responsive mb-4">
                        <table className="table table-sm table-bordered align-middle mb-0">
                          <thead className="table-light">
                            <tr>
                              <th style={{ width: '3%' }}>#</th>
                              <th style={{ width: '20%' }}>Step</th>
                              <th style={{ width: '10%' }}>Type</th>
                              <th style={{ width: '10%' }}>Status</th>
                              <th style={{ width: '12%' }}>Measured</th>
                              <th style={{ width: '12%' }}>Range</th>
                              <th>Validation</th>
                              <th style={{ width: '12%' }}>Completed At</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(vd.steps || []).map((step: any) => {
                              let measuredValue = step.measured_value;
                              if (!measuredValue && step.input_data) {
                                if (step.input_data.value) measuredValue = parseFloat(step.input_data.value);
                                else if (step.input_data.measured_value) measuredValue = parseFloat(step.input_data.measured_value);
                                else if (step.input_data.reading) measuredValue = parseFloat(step.input_data.reading);
                              }

                              let minValue = step.min_value;
                              let maxValue = step.max_value;
                              if ((!minValue || !maxValue) && step.step_config?.validation_rules) {
                                const rules = step.step_config.validation_rules;
                                if (rules.min !== undefined) minValue = rules.min;
                                if (rules.max !== undefined) maxValue = rules.max;
                              }

                              const description = step.description || step.step_config?.description || '';

                              return (
                                <tr key={step.step_number}>
                                  <td className="text-center text-muted small">{step.step_number}</td>
                                  <td>
                                    <div className="fw-semibold small">{step.step_name}</div>
                                    {description && <div className="text-muted" style={{ fontSize: '0.72rem' }}>{description}</div>}
                                    {step.override_reason && (
                                      <div className="text-warning" style={{ fontSize: '0.72rem' }}>
                                        <i className="bi bi-exclamation-triangle me-1"></i>Override: {step.override_reason}
                                      </div>
                                    )}
                                  </td>
                                  <td>
                                    <span className="badge bg-secondary" style={{ fontSize: '0.7rem' }}>
                                      {step.step_type?.replace('_', ' ')}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={`badge ${step.status === 'Complies' || step.status === 'Completed' ? 'bg-success' :
                                      step.status === 'Not Complies' || step.status === 'Failed' ? 'bg-danger' :
                                        step.status === 'In Progress' ? 'bg-warning text-dark' : 'bg-secondary'
                                      }`} style={{ fontSize: '0.7rem' }}>
                                      {step.status}
                                    </span>
                                  </td>
                                  <td className="text-center small">
                                    {measuredValue != null && !isNaN(measuredValue)
                                      ? <strong>{Number(measuredValue).toFixed(4)}</strong>
                                      : step.reading_data?.value
                                        ? <strong>{Number(step.reading_data.value).toFixed(4)}</strong>
                                        : <span className="text-muted">-</span>}
                                  </td>
                                  <td className="text-center small text-muted">
                                    {minValue != null && maxValue != null
                                      ? `${minValue} – ${maxValue}`
                                      : step.step_config?.validation_rules?.min != null && step.step_config?.validation_rules?.max != null
                                        ? `${step.step_config.validation_rules.min} – ${step.step_config.validation_rules.max}`
                                        : '-'}
                                  </td>
                                  <td className="small">
                                    {step.validation_msg
                                      ? <span className={step.status === 'Complies' || step.status === 'Completed' ? 'text-success' : 'text-danger'}>{step.validation_msg}</span>
                                      : step.step_type === 'manual_input' && measuredValue
                                        ? <span className="text-success">Manual input recorded: {measuredValue}</span>
                                        : <span className="text-muted">-</span>}
                                  </td>
                                  <td className="small text-muted">
                                    {step.completed_at ? formatDateTime(step.completed_at) : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {canApprove && (
                        <div className="card border-warning mb-0">
                          <div className="card-header bg-warning bg-opacity-10 fw-semibold">
                            <i className="bi bi-person-check me-1 text-warning"></i>
                            Supervisor Approval
                          </div>
                          <div className="card-body">
                            <label className="form-label small fw-semibold">Notes (optional)</label>
                            <textarea
                              className="form-control form-control-sm"
                              rows={2}
                              placeholder="Add approval or rejection notes..."
                              value={verificationModal.approvalNotes}
                              onChange={(e) => setVerificationModal(prev => ({ ...prev, approvalNotes: e.target.value }))}
                              disabled={verificationModal.approving}
                            />
                          </div>
                        </div>
                      )}

                      {vd.approval_status === 'approved' && (
                        <div className="alert alert-success mb-0">
                          <i className="bi bi-check-circle me-1"></i>
                          <strong>Approved</strong> on {vd.approved_at ? formatDateTime(vd.approved_at) : '-'}
                          {vd.approval_notes && <> — <em>{vd.approval_notes}</em></>}
                        </div>
                      )}
                      {vd.approval_status === 'rejected' && (
                        <div className="alert alert-danger mb-0">
                          <i className="bi bi-x-circle me-1"></i>
                          <strong>Rejected</strong> on {vd.approved_at ? formatDateTime(vd.approved_at) : '-'}
                          {vd.approval_notes && <> — <em>{vd.approval_notes}</em></>}
                        </div>
                      )}
                    </>
                  );
                })() : (
                  <div className="text-center text-muted py-4">No data available</div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeVerificationModal}>Close</button>
                {verificationModal.data && (() => {
                  const vd = verificationModal.data;
                  const canApprove =
                    isSupervisorOrAbove() &&
                    (vd.status === 'Complies' || vd.status === 'Not Complies' || vd.status === 'Completed') &&
                    (!vd.approval_status || vd.approval_status === 'not_required' || vd.approval_status === 'pending_approval');
                  if (!canApprove) return null;
                  return (
                    <>
                      <button type="button" className="btn btn-danger" disabled={verificationModal.approving} onClick={() => handleVerificationApproval(false)}>
                        {verificationModal.approving ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-x-circle me-1"></i>}
                        Reject
                      </button>
                      <button type="button" className="btn btn-success" disabled={verificationModal.approving} onClick={() => handleVerificationApproval(true)}>
                        {verificationModal.approving ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-check-circle me-1"></i>}
                        Approve
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}