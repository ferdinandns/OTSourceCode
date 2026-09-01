import { useState } from "react";
import { SearchableSelect } from "./SearchableSelect";

interface InputField {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "boolean";
  default?: any;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[] | string[];
  required?: boolean;
  placeholder?: string;
}

interface OutputField {
  name: string;
  label: string;
  unit?: string;
  precision?: number;
}

interface ReadingSchema {
  inputs: InputField[];
  outputs: OutputField[];
}

interface Props {
  schema: ReadingSchema;
  needsBatch?: boolean;
  needsSample?: boolean;
  readingMode: "auto" | "single" | "manual-trigger";
  usageData: any;
  onInputChange: (field: string, value: any) => void;
  onBatchUpdate: (index: number, field: string, value: any) => void;
  onAddBatch: () => void;
  onRemoveBatch: (index: number) => void;
  onStartRead: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  totalItems: number;
  recentBatches: string[];
  sampelOptions: string[];
  selectedSampel: string;
  kategoriSampel: string;
  onKategoriChange: (value: string) => void;
  onSampelChange: (value: string) => void;

  showMtsicsSelector?: boolean;
  mtsicsCommand?: string;
  onMtsicsCommandChange?: (command: string) => void;
  instrumentConfig?: any;

  kategoriOptions?: string[];

}

export default function DynamicReadingForm({
  schema,
  needsBatch = true,
  needsSample = true,
  readingMode,
  usageData,
  onInputChange,
  onBatchUpdate,
  onAddBatch,
  onRemoveBatch,
  onStartRead,
  onCancel,
  isLoading = false,
  totalItems,
  recentBatches,
  sampelOptions,
  selectedSampel,
  kategoriSampel,
  onKategoriChange,
  onSampelChange,

  showMtsicsSelector = false,
  mtsicsCommand = "SI",
  onMtsicsCommandChange,
  instrumentConfig,
  kategoriOptions = [],
}: Props) {
  const [inputValues, setInputValues] = useState<Record<string, any>>(() => {
    const initialValues: Record<string, any> = {};
    schema.inputs.forEach((input) => {
      initialValues[input.name] = input.default ?? (input.type === "number" ? 0 : "");
    });
    return initialValues;
  });

  const handleInputChange = (name: string, value: any) => {
    setInputValues(prev => ({ ...prev, [name]: value }));
    onInputChange(name, value);
  };

  const [manualKategori, setManualKategori] = useState(false);
  const [manualSampel, setManualSampel] = useState(false);

  const renderInput = (input: InputField) => {
    switch (input.type) {
      case "number":
        return (
          <input
            type="number"
            className="form-control"
            value={inputValues[input.name] ?? input.default ?? ""}
            onChange={(e) => handleInputChange(input.name, parseFloat(e.target.value) || 0)}
            min={input.min}
            max={input.max}
            step={input.step}
            placeholder={input.placeholder}
          />
        );
      case "select":
        return (
          <select
            className="form-control"
            value={inputValues[input.name] ?? input.default ?? ""}
            onChange={(e) => handleInputChange(input.name, e.target.value)}
          >
            <option value="">-- Pilih {input.label} --</option>
            {Array.isArray(input.options)
              ? input.options.map((opt) =>
                typeof opt === "string" ? (
                  <option key={opt} value={opt}>{opt}</option>
                ) : (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                )
              )
              : null}
          </select>
        );
      case "boolean":
        return (
          <div className="btn-group w-100">
            <button
              type="button"
              className={`btn ${inputValues[input.name] === true ? "btn-success" : "btn-outline-success"}`}
              onClick={() => handleInputChange(input.name, true)}
            >
              Ya
            </button>
            <button
              type="button"
              className={`btn ${inputValues[input.name] === false ? "btn-danger" : "btn-outline-danger"}`}
              onClick={() => handleInputChange(input.name, false)}
            >
              Tidak
            </button>
          </div>
        );
      default:
        return (
          <input
            type="text"
            className="form-control"
            value={inputValues[input.name] ?? input.default ?? ""}
            onChange={(e) => handleInputChange(input.name, e.target.value)}
            placeholder={input.placeholder}
          />
        );
    }
  };

  const getButtonText = () => {
    switch (readingMode) {
      case "single": return "Baca Sekarang";
      case "manual-trigger": return "Mulai Pengukuran";
      default: return `Mulai Auto-Read (${totalItems} item)`;
    }
  };

  const getButtonIcon = () => {
    switch (readingMode) {
      case "single": return "bi bi-eye";
      case "manual-trigger": return "bi bi-play-circle";
      default: return "bi bi-robot";
    }
  };

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-primary text-white">
        <h5 className="mb-0">
          <i className="bi bi-gear me-2"></i>Pengaturan Pembacaan
        </h5>
      </div>

      <div className="card-body">
        {/* Dynamic Inputs */}
        {schema.inputs.length > 0 && (
          <div className="mb-4">
            <h6 className="fw-bold mb-3 text-primary">
              <i className="bi bi-sliders me-2"></i>Parameter Instrument
            </h6>
            {schema.inputs.map((input) => (
              <div key={input.name} className="mb-3">
                <label className="form-label">
                  {input.label}
                  {input.required && <span className="text-danger ms-1">*</span>}
                </label>
                {renderInput(input)}
              </div>
            ))}
          </div>
        )}

        {showMtsicsSelector && (
          <div className="mb-4">
            <div className="card bg-light border-0">
              <div className="card-header bg-info text-white">
                <h6 className="mb-0">
                  <i className="bi bi-terminal me-2"></i>
                  MT-SICS Command Selection
                </h6>
              </div>
              <div className="card-body">
                <p className="text-muted small mb-3">
                  <i className="bi bi-info-circle me-1"></i>
                  Pilih perintah yang akan digunakan untuk membaca data dari balance
                </p>

                <div className="btn-group w-100" role="group">
                  <button
                    type="button"
                    className={`btn ${mtsicsCommand === 'S' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => onMtsicsCommandChange?.('S')}
                  >
                    <div className="d-flex flex-column align-items-center py-2">
                      <strong className="fs-5">S</strong>
                      <small className="text-muted">Stable Weight</small>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`btn ${mtsicsCommand === 'SI' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => onMtsicsCommandChange?.('SI')}
                  >
                    <div className="d-flex flex-column align-items-center py-2">
                      <strong className="fs-5">SI</strong>
                      <small className="text-muted">Immediate</small>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`btn ${mtsicsCommand === 'SR' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => onMtsicsCommandChange?.('SR')}
                  >
                    <div className="d-flex flex-column align-items-center py-2">
                      <strong className="fs-5">SR</strong>
                      <small className="text-muted">Repeated</small>
                    </div>
                  </button>
                </div>

                <div className="mt-3">
                  {mtsicsCommand === 'S' && (
                    <div className="alert alert-info mb-0">
                      <small>
                        <i className="bi bi-hourglass-half me-1"></i>
                        Menunggu berat stabil sebelum mengirim nilai (direkomendasikan untuk pengukuran presisi tinggi)
                      </small>
                    </div>
                  )}
                  {mtsicsCommand === 'SI' && (
                    <div className="alert alert-success mb-0">
                      <small>
                        <i className="bi bi-lightning me-1"></i>
                        Mengirim berat segera tanpa menunggu stabil (direkomendasikan untuk auto-read)
                      </small>
                    </div>
                  )}
                  {mtsicsCommand === 'SR' && (
                    <div className="alert alert-warning mb-0">
                      <small>
                        <i className="bi bi-arrow-repeat me-1"></i>
                        Mengirim berat berulang kali hingga dihentikan (untuk monitoring real-time)
                      </small>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Kategori Sampel */}
        {needsSample && (
          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <label className="form-label fw-bold mb-0">Kategori Sampel *</label>
              <button
                type="button"
                className="btn btn-link btn-sm p-0 text-decoration-none"
                style={{ fontSize: '12px' }}
                onClick={() => {
                  setManualKategori(!manualKategori);
                  onKategoriChange(''); // reset saat toggle
                }}
              >
                <i className={`bi bi-${manualKategori ? 'search' : 'pencil'} me-1`}></i>
                {manualKategori ? 'Pilih dari daftar' : 'Input manual'}
              </button>
            </div>
            {manualKategori ? (
              <input
                type="text"
                className="form-control"
                placeholder="Ketik kategori sampel..."
                value={kategoriSampel}
                onChange={(e) => onKategoriChange(e.target.value)}
              />
            ) : (
              <SearchableSelect
                options={kategoriOptions}
                value={kategoriSampel}
                onChange={onKategoriChange}
                placeholder="Cari kategori sampel..."
              />
            )}
          </div>
        )}

        {/* Sampel */}
        {needsSample && kategoriSampel && (
          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <label className="form-label fw-bold mb-0">Sampel *</label>
              <button
                type="button"
                className="btn btn-link btn-sm p-0 text-decoration-none"
                style={{ fontSize: '12px' }}
                onClick={() => {
                  setManualSampel(!manualSampel);
                  onSampelChange(''); // reset saat toggle
                }}
              >
                <i className={`bi bi-${manualSampel ? 'search' : 'pencil'} me-1`}></i>
                {manualSampel ? 'Pilih dari daftar' : 'Input manual'}
              </button>
            </div>
            {manualSampel ? (
              <input
                type="text"
                className="form-control"
                placeholder="Ketik nama sampel..."
                value={selectedSampel}
                onChange={(e) => onSampelChange(e.target.value)}
              />
            ) : (
              <SearchableSelect
                options={sampelOptions}
                value={selectedSampel}
                onChange={onSampelChange}
                placeholder="Cari sampel..."
              />
            )}
          </div>
        )}

        {/* Batch Info (opsional) */}
        {needsBatch && (
          <div className="mb-4">
            <label className="form-label fw-bold">
              Informasi Batch (Total: {totalItems} item)
            </label>
            {usageData.no_qc_batch.map((batch: any, idx: number) => (
              <div key={idx} className="input-group mb-2">
                <span className="input-group-text">#{idx + 1}</span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Nomor Batch"
                  value={batch.no_qc_batch}
                  onChange={(e) => onBatchUpdate(idx, "no_qc_batch", e.target.value.toUpperCase())}
                  list={`recent-batches-${idx}`}
                  style={{ textTransform: 'uppercase' }}
                />
                <datalist id={`recent-batches-${idx}`}>
                  {recentBatches.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
                <input
                  type="number"
                  className="form-control"
                  style={{ maxWidth: "100px" }}
                  placeholder="Jml"
                  min="1"
                  value={batch.jumlah_item}
                  onChange={(e) => onBatchUpdate(idx, "jumlah_item", parseInt(e.target.value) || 1)}
                />
                {idx > 0 && (
                  <button
                    className="btn btn-outline-danger"
                    onClick={() => onRemoveBatch(idx)}
                  >
                    <i className="bi bi-trash"></i>
                  </button>
                )}
              </div>
            ))}
            <button
              className="btn btn-sm btn-outline-primary mt-1"
              onClick={onAddBatch}
            >
              <i className="bi bi-plus me-1"></i>Tambah Batch
            </button>
          </div>
        )}

        {/* Info */}
        <div className={`alert alert-${readingMode === "single" ? "info" : "primary"}`}>
          <i className="bi bi-info-circle me-2"></i>
          <strong>{readingMode === "single" ? "Single Read" : "Auto-Read"}:</strong>{" "}
          {readingMode === "single"
            ? "Tekan tombol untuk membaca langsung."
            : `Sistem akan membaca otomatis ${totalItems} item.`}
        </div>

        {/* Action Buttons */}
        <div className="d-flex gap-2 mt-4">
          <button
            className={`btn btn-${readingMode === "single" ? "info" : "success"} btn-lg`}
            onClick={onStartRead}
            disabled={
              isLoading ||
              (needsSample && !selectedSampel) ||
              (needsBatch && totalItems === 0)
            }
          >
            {isLoading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                Memproses...
              </>
            ) : (
              <>
                <i className={`${getButtonIcon()} me-2`}></i>
                {getButtonText()}
              </>
            )}
          </button>
          <button className="btn btn-outline-secondary" onClick={onCancel}>
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}