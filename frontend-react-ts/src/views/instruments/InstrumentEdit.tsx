import { useParams, useNavigate } from "react-router-dom";
import { useInstrumentDetail } from "../../hooks/instrument/useInstrumentDetail";
import { useInstrumentMutation } from "../../hooks/instrument/useInstrumentMutation";
import { useUsers, useUserSupervisors } from "../../hooks/user/useUsers";
import { useAuth, GROUP_SUPERVISOR } from "../../context/AuthContext";
import { useBridgePCs } from "../../hooks/bridge/useBridge";
import { useState, useEffect } from "react";

export default function InstrumentEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { hasMinGroup } = useAuth();
  const isSupervisorPlus = hasMinGroup(GROUP_SUPERVISOR); // group <= 3

  const { data: queryData, isLoading, isError, error } = useInstrumentDetail(id!);
  const { update, remove } = useInstrumentMutation();
  const { data: allUsers = [] } = useUsers(isSupervisorPlus);
  const { data: supervisors = [] } = useUserSupervisors();
  const { data: bridgePCsData } = useBridgePCs();

  // Analysts see supervisors list; supervisor+ see full user list
  const picUsers = isSupervisorPlus ? allUsers : supervisors;
  const bridgePCs = bridgePCsData?.data || [];

  const [form, setForm] = useState<any>({
    nama_instrument: "",
    nomor_kontrol: "",
    pic_user_id: "",
    stock_opname_date: "",
    pic_stock_opname_id: "",
    calibration_date: "",
    expiration_date: "",
    location_instrument: "",
    location_site: "",
    status: "",
    bridge_pc_id: "",
    bridge_port: "",
    bridge_baudrate: "",
    shared_access: false,
  });

  useEffect(() => {
    const d = queryData?.data || queryData;
    if (d) {
      setForm({
        nama_instrument: d.nama_instrument || "",
        nomor_kontrol: d.nomor_kontrol || "",
        pic_user_id: d.pic_instrument?.id || "",
        stock_opname_date: d.tanggal_stock_opname || "",
        pic_stock_opname_id: d.pic_stock_opname?.id || "",
        calibration_date: d.tanggal_kalibrasi || "",
        expiration_date: d.ed_kalibrasi || "",
        location_instrument: d.lokasi_instrument || "",
        location_site: d.lokasi_site || "",
        bridge_pc_id: d.bridge_pc_id || "",
        bridge_port: d.bridge_port || "",
        bridge_baudrate: d.bridge_baudrate || "",
        status: d.status || "",
        shared_access: d.shared_access ?? false,

      });
    }
  }, [queryData]);

  const formatDateTimeForBackend = (dateString: string) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? null : date.toISOString();
    } catch { return null; }
  };

  const formatDateForInput = (dateString: string) =>
    dateString ? dateString.slice(0, 16) : "";

  const submit = () => {
    const payload: any = {};
    if (form.pic_user_id) {
      const v = Number(form.pic_user_id);
      if (!isNaN(v) && v > 0) payload.pic_instrument_id = v;
    }
    if (form.pic_stock_opname_id) {
      const v = Number(form.pic_stock_opname_id);
      if (!isNaN(v) && v > 0) payload.pic_stock_opname_id = v;
    }
    if (form.location_instrument) payload.ruangan = form.location_instrument;
    if (form.location_site) payload.lokasi_site = form.location_site;
    const stockDate = formatDateTimeForBackend(form.stock_opname_date);
    if (stockDate) payload.tanggal_stock_opname = stockDate;
    const calDate = formatDateTimeForBackend(form.calibration_date);
    if (calDate) payload.tanggal_kalibrasi = calDate;
    const edDate = formatDateTimeForBackend(form.expiration_date);
    if (edDate) payload.ed_kalibrasi = edDate;
    payload.bridge_pc_id = form.bridge_pc_id || "";
    payload.bridge_port = form.bridge_port || "";
    payload.bridge_baudrate = form.bridge_baudrate ? Number(form.bridge_baudrate) : 0;
    payload.shared_access = form.shared_access;

    if (form.status) payload.status = form.status;
    update.mutate(
      { id: Number(id), data: payload },
      {
        onSuccess: () => { alert("Instrument berhasil diupdate!"); navigate("/instruments"); },
        onError: (err: any) => alert("Gagal update: " + (err?.response?.data?.message || err.message)),
      }
    );
  };

  const handleDelete = () => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus instrument ini?")) return;
    remove.mutate(Number(id), {
      onSuccess: () => navigate("/instruments"),
      onError: (err: any) => alert("Gagal delete: " + (err?.response?.data?.message || err.message)),
    });
  };

  if (isLoading) return (
    <div className="container mt-3 text-center py-5">
      <div className="spinner-border text-primary" role="status" />
      <p className="mt-3 text-muted">Loading instrument data...</p>
    </div>
  );

  if (isError) return (
    <div className="container mt-3">
      <div className="alert alert-danger">
        Gagal memuat data instrument
        <details className="mt-2">
          <summary>Debug Info</summary>
          <pre className="mt-2 small bg-light p-2" style={{ maxHeight: 200, overflow: 'auto' }}>
            {JSON.stringify({ error: error instanceof Error ? error.message : error, queryData }, null, 2)}
          </pre>
        </details>
      </div>
      <button className="btn btn-secondary" onClick={() => navigate("/instruments")}>Kembali ke List</button>
    </div>
  );

  if (!queryData) return (
    <div className="container mt-3">
      <div className="alert alert-warning">Data instrument tidak ditemukan</div>
      <button className="btn btn-secondary" onClick={() => navigate("/instruments")}>Kembali ke List</button>
    </div>
  );

  return (
    <div className="container mt-3" style={{ maxWidth: 800 }}>
      <h3 className="mb-4">Edit Instrument</h3>

      {/* Basic Info — read only */}
      <div className="card mb-3">
        <div className="card-body p-3">
          <div className="row g-2">
            <div className="col-md-8">
              <label className="form-label small mb-1">Nama Instrument</label>
              <input className="form-control form-control-sm" value={form.nama_instrument} readOnly disabled />
            </div>
            <div className="col-md-4">
              <label className="form-label small mb-1">No. Kontrol</label>
              <input className="form-control form-control-sm" value={form.nomor_kontrol} readOnly disabled />
            </div>
          </div>
        </div>
      </div>

      {/* PIC & Location */}
      <div className="card mb-3">
        <div className="card-header py-2 bg-light">
          <h6 className="mb-0"><i className="bi bi-person-badge me-2" />PIC & Location</h6>
        </div>
        <div className="card-body p-3">
          <div className="row g-2 mb-2">
            <div className="col-md-6">
              <label className="form-label small mb-1">
                PIC Instrument
                {!isSupervisorPlus && (
                  <span className="badge bg-light text-muted ms-2 fw-normal" style={{ fontSize: '0.65rem' }}>
                    Supervisors only
                  </span>
                )}
              </label>
              <select className="form-select form-select-sm" value={form.pic_user_id}
                onChange={e => setForm({ ...form, pic_user_id: e.target.value })}>
                <option value="">Pilih PIC</option>
                {picUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="col-md-6">
              {hasMinGroup(1) ? (
                <>
                  <label className="form-label small mb-1">
                    Status
                    <span className="badge bg-danger ms-2 fw-normal" style={{ fontSize: '0.65rem' }}>
                      Superadmin only
                    </span>
                  </label>
                  <select className="form-select form-select-sm" value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option value="">-- No Change --</option>
                    <option value="Available">Available</option>
                    <option value="Unverified">Unverified</option>
                    <option value="Unavailable">Unavailable</option>
                  </select>
                </>
              ) : (
                <div />
              )}
            </div>
          </div>
          <div className="row g-2">
            <div className="col-md-8">
              <label className="form-label small mb-1">Ruangan</label>
              <input className="form-control form-control-sm" placeholder="Masukkan lokasi ruangan"
                value={form.location_instrument}
                onChange={e => setForm({ ...form, location_instrument: e.target.value })} />
            </div>
            <div className="col-md-4">
              <label className="form-label small mb-1">Site</label>
              <select className="form-select form-select-sm" value={form.location_site}
                onChange={e => setForm({ ...form, location_site: e.target.value })}>
                <option value="">Pilih Site</option>
                <option value="PLG">PLG</option>
                <option value="CKR">CKR</option>
              </select>
            </div>
          </div>
          {/* Shared Access Toggle — supervisor+ only */}
          {isSupervisorPlus && (
            <div className="row g-2 mt-1">
              <div className="col-12">
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="sharedAccessToggle"
                    checked={form.shared_access}
                    onChange={e => setForm({ ...form, shared_access: e.target.checked })}
                  />
                  <label className="form-check-label" htmlFor="sharedAccessToggle">
                    <strong>Shared Access</strong>
                    <span className="text-muted ms-2 small">
                      Aktifkan agar session reading dapat dilanjutkan oleh pengguna lain
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dates */}
      <div className="card mb-3">
        <div className="card-header py-2 bg-light">
          <h6 className="mb-0"><i className="bi bi-calendar-event me-2" />Dates</h6>
        </div>
        <div className="card-body p-3">
          <div className="row g-2 mb-2">
            <div className="col-md-6">
              <label className="form-label small mb-1">Tanggal Stock Opname</label>
              <input type="datetime-local" className="form-control form-control-sm"
                value={formatDateForInput(form.stock_opname_date)}
                onChange={e => setForm({ ...form, stock_opname_date: e.target.value })} />
            </div>
            <div className="col-md-6">
              <label className="form-label small mb-1">Tanggal Kalibrasi</label>
              <input type="datetime-local" className="form-control form-control-sm"
                value={formatDateForInput(form.calibration_date)}
                onChange={e => setForm({ ...form, calibration_date: e.target.value })} />
            </div>
          </div>
          <div className="row g-2 mb-2">
            <div className="col-md-6">
              <label className="form-label small mb-1">Tanggal ED Kalibrasi</label>
              <input type="datetime-local" className="form-control form-control-sm"
                value={formatDateForInput(form.expiration_date)}
                onChange={e => setForm({ ...form, expiration_date: e.target.value })} />
            </div>
            <div className="col-md-6">
              <label className="form-label small mb-1">
                PIC Stock Opname
                {!isSupervisorPlus && (
                  <span className="badge bg-light text-muted ms-2 fw-normal" style={{ fontSize: '0.65rem' }}>
                    Supervisors only
                  </span>
                )}
              </label>
              <select className="form-select form-select-sm" value={form.pic_stock_opname_id}
                onChange={e => setForm({ ...form, pic_stock_opname_id: e.target.value })}>
                <option value="">Pilih PIC</option>
                {picUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Bridge Configuration */}
      <div className="card mb-3">
        <div className="card-header py-2 bg-light">
          <h6 className="mb-0"><i className="bi bi-hdd-network me-2" />Bridge Configuration</h6>
        </div>
        <div className="card-body p-3">
          <div className="row g-2">
            <div className="col-md-4">
              <label className="form-label small mb-1">Bridge PC</label>
              <select className="form-select form-select-sm" value={form.bridge_pc_id}
                onChange={e => setForm({ ...form, bridge_pc_id: e.target.value })}>
                <option value="">No Bridge PC</option>
                {bridgePCs.map((pc: any) => (
                  <option key={pc.pc_id} value={pc.pc_id}>{pc.pc_id} - {pc.location}</option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label small mb-1">Bridge Port</label>
              <input className="form-control form-control-sm" placeholder="COM1, COM2"
                value={form.bridge_port}
                onChange={e => setForm({ ...form, bridge_port: e.target.value })} />
            </div>
            <div className="col-md-4">
              <label className="form-label small mb-1">Baudrate</label>
              <select className="form-select form-select-sm" value={form.bridge_baudrate}
                onChange={e => setForm({ ...form, bridge_baudrate: e.target.value })}>
                <option value="">Select</option>
                {[1200, 2400, 4800, 9600, 14400, 38400, 19200, 57600, 115200].map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="d-flex justify-content-between">
        {isSupervisorPlus ? (
          <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={remove.isPending}>
            <i className="bi bi-trash me-1" />{remove.isPending ? "Menghapus..." : "Delete"}
          </button>
        ) : <div />}

        <button className="btn btn-success btn-sm" onClick={submit} disabled={update.isPending}>
          <i className="bi bi-check-circle me-1" />{update.isPending ? "Menyimpan..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}