import { useState, useRef } from "react";
import * as Papa from "papaparse";
import * as XLSX from "xlsx";
import { useProductMutation } from "../hooks/product/useProduct";

interface ImportResult {
  imported: number;
  skipped: number;
  failed: { row: number; reason: string }[];
}

interface ImportProductModalProps {
  show: boolean;
  onClose: () => void;
}

const REQUIRED_FIELDS = ["kategori_sampel", "item_code", "item_name", "lokasi_site"];
const VALID_CATEGORIES = ["RM", "PM", "RUAH", "FINISHED_GOOD", "STABTEST", "MIKRO", "PROSES", "WS", "LAINNYA", "EHM"];
const VALID_SITES = ["PLG", "CKR"];

export default function ImportProductModal({ show, onClose }: ImportProductModalProps) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { create } = useProductMutation();

  const reset = () => {
    setRows([]);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const parseFile = (file: File) => {
    setResult(null);

    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (r: Papa.ParseResult<Record<string, string>>) => setRows(r.data),
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
        setRows(data as any[]);
      };
      reader.readAsBinaryString(file);
    }
  };

  const validateRow = (row: any): string | null => {
    for (const field of REQUIRED_FIELDS) {
      if (!row[field] || String(row[field]).trim() === "") {
        return `Missing required field: ${field}`;
      }
    }
    if (!VALID_CATEGORIES.includes(row.kategori_sampel)) {
      return `Invalid kategori_sampel: "${row.kategori_sampel}"`;
    }
    if (!VALID_SITES.includes(row.lokasi_site)) {
      return `Invalid lokasi_site: "${row.lokasi_site}" (must be PLG or CKR)`;
    }
    return null;
  };

  const handleImport = async () => {
    setImporting(true);
    const summary: ImportResult = { imported: 0, skipped: 0, failed: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because row 1 is header

      const validationError = validateRow(row);
      if (validationError) {
        summary.failed.push({ row: rowNum, reason: validationError });
        continue;
      }

      await new Promise<void>((resolve) => {
        create.mutate(
          {
            kategori_sampel: String(row.kategori_sampel).trim(),
            item_code: String(row.item_code).trim(),
            item_name: String(row.item_name).trim(),
            keterangan: row.keterangan ? String(row.keterangan).trim() : "",
            lokasi_site: String(row.lokasi_site).trim(),
          },
          {
            onSuccess: () => {
              summary.imported++;
              resolve();
            },
            onError: (error: any) => {
              const msg = error?.response?.data?.message
                || error?.response?.data?.error
                || error.message;
              // Treat duplicate as skip
              if (msg?.toLowerCase().includes("already exists")) {
                summary.skipped++;
              } else {
                summary.failed.push({ row: rowNum, reason: msg || "Unknown error" });
              }
              resolve();
            },
          }
        );
      });
    }

    setResult(summary);
    setImporting(false);
  };

  if (!show) return null;

  return (
    <div
      className="modal show d-block"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          {/* Header */}
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="bi bi-file-earmark-arrow-up me-2"></i>
              Import Products from CSV / Excel
            </h5>
            <button className="btn-close" onClick={handleClose} />
          </div>

          <div className="modal-body">
            {/* Column Instructions */}
            <div className="alert alert-info mb-3">
              <strong><i className="bi bi-info-circle me-1"></i> File Format Instructions</strong>
              <p className="mb-1 mt-2 small">Your file must include these columns (column names must match exactly):</p>
              <div className="table-responsive">
                <table className="table table-sm table-bordered mb-0 small">
                  <thead className="table-light">
                    <tr>
                      <th>Column</th>
                      <th>Required</th>
                      <th>Allowed Values</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td><code>kategori_sampel</code></td><td>✅ Yes</td><td>RM, PM, RUAH, FINISHED_GOOD, STABTEST, MIKRO, PROSES, WS, EHM</td></tr>
                    <tr><td><code>item_code</code></td><td>✅ Yes</td><td>Any text (Oracle item code)</td></tr>
                    <tr><td><code>item_name</code></td><td>✅ Yes</td><td>Any text</td></tr>
                    <tr><td><code>lokasi_site</code></td><td>✅ Yes</td><td>PLG, CKR</td></tr>
                    <tr><td><code>keterangan</code></td><td>❌ Optional</td><td>Any text</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="mb-0 mt-2 small text-muted">
                Other columns (id, item_id, created_by, etc.) will be ignored — they are auto-generated by the system.
              </p>
            </div>

            {/* File Upload */}
            {!result && (
              <div className="mb-3">
                <label className="form-label fw-semibold">Select File</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="form-control"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) parseFile(file);
                  }}
                />
                <div className="form-text">Accepted formats: .csv, .xlsx, .xls</div>
              </div>
            )}

            {/* Preview */}
            {rows.length > 0 && !result && (
              <div className="mb-3">
                <p className="fw-semibold mb-1">
                  Preview <span className="badge bg-secondary">{rows.length} rows</span>
                </p>
                <div className="table-responsive" style={{ maxHeight: 220 }}>
                  <table className="table table-sm table-bordered table-hover mb-0 small">
                    <thead className="table-light sticky-top">
                      <tr>
                        <th>#</th>
                        <th>kategori_sampel</th>
                        <th>item_code</th>
                        <th>item_name</th>
                        <th>keterangan</th>
                        <th>lokasi_site</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 20).map((row, i) => (
                        <tr key={i}>
                          <td className="text-muted">{i + 2}</td>
                          <td>{row.kategori_sampel}</td>
                          <td>{row.item_code}</td>
                          <td>{row.item_name}</td>
                          <td>{row.keterangan || "-"}</td>
                          <td>{row.lokasi_site}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > 20 && (
                  <p className="text-muted small mt-1">…and {rows.length - 20} more rows</p>
                )}
              </div>
            )}

            {/* Import Result */}
            {result && (
              <div>
                <div className="row g-2 mb-3">
                  <div className="col-4">
                    <div className="card text-center border-success">
                      <div className="card-body py-2">
                        <div className="fs-3 fw-bold text-success">{result.imported}</div>
                        <div className="small text-muted">Imported</div>
                      </div>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="card text-center border-warning">
                      <div className="card-body py-2">
                        <div className="fs-3 fw-bold text-warning">{result.skipped}</div>
                        <div className="small text-muted">Skipped (duplicate)</div>
                      </div>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="card text-center border-danger">
                      <div className="card-body py-2">
                        <div className="fs-3 fw-bold text-danger">{result.failed.length}</div>
                        <div className="small text-muted">Failed</div>
                      </div>
                    </div>
                  </div>
                </div>

                {result.failed.length > 0 && (
                  <div className="alert alert-danger">
                    <strong>Failed rows:</strong>
                    <ul className="mb-0 mt-1 small">
                      {result.failed.map((f, i) => (
                        <li key={i}>Row {f.row}: {f.reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Progress */}
            {importing && (
              <div className="text-center py-3">
                <div className="spinner-border text-primary" role="status" />
                <p className="mt-2 text-muted small">Importing rows, please wait...</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer">
            {!result ? (
              <>
                <button className="btn btn-secondary" onClick={handleClose} disabled={importing}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleImport}
                  disabled={rows.length === 0 || importing}
                >
                  {importing ? (
                    <><span className="spinner-border spinner-border-sm me-2" />Importing...</>
                  ) : (
                    <><i className="bi bi-upload me-2"></i>Import {rows.length} Rows</>
                  )}
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-secondary" onClick={reset}>
                  Import Another File
                </button>
                <button className="btn btn-success" onClick={handleClose}>
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}