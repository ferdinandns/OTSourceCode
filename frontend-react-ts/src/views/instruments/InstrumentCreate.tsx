import { useMemo, useState } from "react";
import { useInstrumentMutation } from "../../hooks/instrument/useInstrumentMutation";
import { useNavigate } from "react-router-dom";
import { useUsers, useUserSupervisors } from "../../hooks/user/useUsers";
import { useAuth, GROUP_SUPERVISOR } from "../../context/AuthContext";
import { useInstruments } from "../../hooks/instrument/useInstrument";

export default function InstrumentCreate() {
  const navigate = useNavigate();
  const { hasMinGroup } = useAuth();
  const isSupervisorPlus = hasMinGroup(GROUP_SUPERVISOR); // group <= 3
  const { create } = useInstrumentMutation();

  // Supervisor+ fetches full user list; analysts fetch supervisor-only list
  const { data: allUsers = [], isLoading: loadingAll, error: allError } = useUsers(isSupervisorPlus);
  const { data: supervisors = [], isLoading: loadingSupervisors, error: supervisorsError } = useUserSupervisors();

  const picUsers = isSupervisorPlus ? allUsers : supervisors;
  const loadingPic = isSupervisorPlus ? loadingAll : loadingSupervisors;
  const picError = isSupervisorPlus ? allError : supervisorsError;

  const [form, setForm] = useState({
    site_location: "",
    room: "",
    serial_number: "",
    name: "",
    brand: "",
    control_number: "",
    pic_user_id: "",
    ant_mass: "",
    tanggal_kalibrasi: "",
    ed_kalibrasi: "",
    type: "",
  });

  const [controlNumberParts, setControlNumberParts] = useState({
    part1: "",
    part2: "",
    part3: "",
  });

  const updateControlNumber = (part: string, value: string) => {
    const newParts = { ...controlNumberParts, [part]: value };
    setControlNumberParts(newParts);
    setForm({ ...form, control_number: `${newParts.part1}-${newParts.part2}-${newParts.part3}` });
  };

  const isFormValid = () =>
    form.site_location &&
    form.room &&
    form.serial_number &&
    form.name &&
    form.brand &&
    form.control_number &&
    form.pic_user_id &&
    form.tanggal_kalibrasi &&
    form.ed_kalibrasi &&
    controlNumberParts.part1.length === 3 &&
    controlNumberParts.part2.length === 3 &&
    controlNumberParts.part3.length === 3 &&
    form.type;

  const submit = () => {
    if (!isFormValid()) {
      alert("Mohon lengkapi semua field yang wajib diisi!");
      return;
    }

    const formatDateToISO = (d: string) => d ? `${d}T00:00:00Z` : "";

    create.mutate({
      lokasi_site: form.site_location,
      ruangan: form.room,
      nomor_seri: form.serial_number,
      nama_instrument: form.name,
      nama_merk: form.brand,
      nomor_kontrol: form.control_number,
      pic_instrument_id: Number(form.pic_user_id),
      tanggal_kalibrasi: formatDateToISO(form.tanggal_kalibrasi),
      ed_kalibrasi: formatDateToISO(form.ed_kalibrasi),
      massa_ant: form.ant_mass ? Number(form.ant_mass) : undefined,
      type: form.type,
    }, {
      onSuccess: () => {
        alert("Instrument berhasil dibuat!");
        navigate("/instruments");
      },
      onError: (error: any) => {
        const details = error.response?.data?.details;
        alert(`Error:\n${details ? JSON.stringify(details, null, 2) : error.response?.data?.message || "Gagal membuat instrument"}`);
      },
    });
  };

  // Ambil daftar nama unik dari instruments yang sudah ada
  const { data: instrumentsData } = useInstruments();

  const existingNames = useMemo(() => {
    const raw = instrumentsData?.data?.data ?? [];
    // Akses snake_case sesuai response backend
    const names = raw.map((i: any) => i.nama_instrument ?? i.NamaInstrument).filter(Boolean);
    return [...new Set(names)].sort() as string[];
  }, [instrumentsData]);

  const [isManualName, setIsManualName] = useState(false);

  return (
    <div className="container mt-4 mb-5">
      {/* Header */}
      <div className="d-flex align-items-center mb-4">
        <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate("/instruments")}>
          ← Back
        </button>
        <div className="ms-3">
          <h3 className="mb-1 fw-bold">Add New Instrument</h3>
          <p className="text-muted mb-0 small">Fill in the details below to register a new instrument</p>
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="card-body p-4">

          {/* Section 1: Location & Type */}
          <div className="row g-3 mb-4">
            <div className="col-md-4">
              <label className="form-label fw-semibold small">Lokasi Site <span className="text-danger">*</span></label>
              <select className="form-select form-select-sm" value={form.site_location}
                onChange={e => setForm({ ...form, site_location: e.target.value })}>
                <option value="">Pilih Site</option>
                <option value="PLG">PLG</option>
                <option value="CKR">CKR</option>
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label fw-semibold small">Ruangan <span className="text-danger">*</span></label>
              <input className="form-control form-control-sm" placeholder="Nama ruangan"
                value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} />
            </div>

            <div className="col-md-4">
              <label className="form-label fw-semibold small">Tipe Instrument <span className="text-danger">*</span></label>
              <select className="form-select form-select-sm" value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="">Pilih Tipe</option>
                <option value="Equipment (Simple Device)">Equipment (Simple Device)</option>
                <option value="Instrument">Instrument</option>
              </select>
            </div>
          </div>

          <hr className="my-4" />

          {/* Section 2: Instrument Details */}
          <h6 className="fw-bold mb-3 text-primary">Instrument Details</h6>
          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <label className="form-label fw-semibold small">
                Nama Instrument <span className="text-danger">*</span>
              </label>
              <select
                className="form-select form-select-sm"
                value={isManualName ? "__manual__" : form.name}
                onChange={e => {
                  if (e.target.value === "__manual__") {
                    setIsManualName(true);
                    setForm({ ...form, name: "" });
                  } else {
                    setIsManualName(false);
                    setForm({ ...form, name: e.target.value });
                  }
                }}
              >
                <option value="">Pilih nama instrument</option>
                {existingNames.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
                <option value="__manual__">— Tambah Manual —</option>
              </select>

              {isManualName && (
                <div className="mt-2">
                  <input
                    className="form-control form-control-sm"
                    placeholder="Ketik nama instrument baru..."
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    autoFocus
                  />
                  <small className="text-muted">
                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0 text-secondary"
                      onClick={() => {
                        setIsManualName(false);
                        setForm({ ...form, name: "" });
                      }}
                    >
                      ← Kembali ke dropdown
                    </button>
                  </small>
                </div>
              )}
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold small">Nama Merk <span className="text-danger">*</span></label>
              <input className="form-control form-control-sm" placeholder="Masukkan nama merk"
                value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} />
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold small">Nomor Seri <span className="text-danger">*</span></label>
              <input className="form-control form-control-sm" placeholder="Masukkan nomor seri"
                value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} />
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold small">
                PIC Instrument <span className="text-danger">*</span>
                {!isSupervisorPlus && (
                  <span className="badge bg-light text-muted ms-2 fw-normal" style={{ fontSize: '0.65rem' }}>
                    Supervisors only
                  </span>
                )}
              </label>
              {picError && (
                <div className="alert alert-warning py-1 px-2 mb-1">
                  <small>⚠️ Gagal memuat data PIC</small>
                </div>
              )}
              <select className="form-select form-select-sm" value={form.pic_user_id}
                onChange={e => setForm({ ...form, pic_user_id: e.target.value })}
                disabled={loadingPic}>
                <option value="">{loadingPic ? "⏳ Memuat..." : "Pilih PIC"}</option>
                {picUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name} — {u.role}</option>
                ))}
              </select>
            </div>
          </div>

          <hr className="my-4" />

          {/* Section 3: Control Number */}
          <h6 className="fw-bold mb-3 text-primary">Instrument Number</h6>
          <div className="mb-4">
            <label className="form-label fw-semibold small">Format: XXX-XXX-XXX <span className="text-danger">*</span></label>
            <div className="row g-2">
              {[
                { key: "part1", placeholder: "2QC", label: "Kepemilikan" },
                { key: "part2", placeholder: "TMB", label: "Singkatan" },
                { key: "part3", placeholder: "008", label: "Urutan" },
              ].map(({ key, placeholder, label }) => (
                <div className="col-md-4" key={key}>
                  <input
                    className="form-control form-control-sm text-center fw-bold"
                    placeholder={placeholder}
                    maxLength={3}
                    value={controlNumberParts[key as keyof typeof controlNumberParts]}
                    onChange={e => updateControlNumber(key, key === "part3" ? e.target.value : e.target.value.toUpperCase())}
                  />
                  <small className="text-muted d-block mt-1">{label}</small>
                </div>
              ))}
            </div>
            <div className="mt-3 p-2 bg-light rounded">
              <strong className="small">Preview: </strong>
              <span className={`badge ${form.control_number.length === 11 ? 'bg-success' : 'bg-secondary'}`}>
                {form.control_number || "___-___-___"}
              </span>
              {form.control_number && form.control_number.length !== 11 && (
                <span className="text-danger ms-2 small">⚠️ Harus 11 karakter</span>
              )}
            </div>
          </div>

          <hr className="my-4" />

          {/* Section 4: Calibration Dates */}
          <h6 className="fw-bold mb-3 text-primary">Calibration Information</h6>
          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <label className="form-label fw-semibold small">Tanggal Kalibrasi <span className="text-danger">*</span></label>
              <input type="date" className="form-control form-control-sm"
                value={form.tanggal_kalibrasi} onChange={e => setForm({ ...form, tanggal_kalibrasi: e.target.value })} />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold small">ED Kalibrasi <span className="text-danger">*</span></label>
              <input type="date" className="form-control form-control-sm"
                value={form.ed_kalibrasi} onChange={e => setForm({ ...form, ed_kalibrasi: e.target.value })} />
            </div>
          </div>

          {/* Conditional: Massa ANT */}
          {form.name.toLowerCase().includes("anak timbang") && (
            <>
              <hr className="my-4" />
              <h6 className="fw-bold mb-3 text-primary">Additional Information</h6>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label fw-semibold small">Massa ANT (gram)</label>
                  <input type="number" step="0.001" className="form-control form-control-sm"
                    placeholder="100.500" value={form.ant_mass}
                    onChange={e => setForm({ ...form, ant_mass: e.target.value })} />
                  <small className="text-muted">Khusus untuk anak timbang</small>
                </div>
              </div>
            </>
          )}

        </div>

        {/* Footer */}
        <div className="card-footer bg-light border-0 p-3">
          <div className="d-flex justify-content-end gap-2">
            <button className="btn btn-outline-secondary" onClick={() => navigate("/instruments")}>
              Cancel
            </button>
            <button className="btn btn-primary px-4" onClick={submit}
              disabled={!isFormValid() || create.isPending}>
              {create.isPending ? "Menyimpan..." : "Submit Instrument"}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 text-center">
        <small className="text-muted"><span className="text-danger">*</span> indicates required fields</small>
      </div>
    </div>
  );
}