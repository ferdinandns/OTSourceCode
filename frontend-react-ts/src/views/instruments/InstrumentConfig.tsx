import { useParams, useNavigate } from "react-router-dom";
import { useInstrumentDetail } from "../../hooks/instrument/useInstrumentDetail";
import { useState, useEffect } from "react";
import axiosInstance from "../../services/api";
import { useQueryClient } from "@tanstack/react-query";

interface ColumnConfig {
  key: string;
  header: string;
  unit: string;
  is_numeric: boolean;
  width: number;
  enabled: boolean;
}

export default function InstrumentConfig() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useInstrumentDetail(id!);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"connectivity" | "tcp" | "parsing" | "pdf">("tcp");

  const [form, setForm] = useState({
    baud_rate: "",
    parity: "",
    stop_bits: "",
    data_bits: "",
    com_port: "",
    regex_pattern: "",
    file_path: "",
    file_path_2: "",
    ip_address: "",
    tcp_port: "",
    timeout: "",
    // ✅ NEW FIELDS:
    lines_per_item: "1",
    regex_filter_enabled: false,
  });

  const [pdfColumns, setPdfColumns] = useState<ColumnConfig[]>([]);
  const [detectedFields, setDetectedFields] = useState<string[]>([]);

  const [regexTest, setRegexTest] = useState({
    sampleData: "",
    testResult: null as any,
    isValid: null as boolean | null,
  });

  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [initializedForId, setInitializedForId] = useState<number | null>(null);

  useEffect(() => {
    if (!data?.data?.configuration) return;

    const config = data.data.configuration;

    // Only skip if we already initialized for this exact config record
    if (initializedForId === config.id) return;

    setForm({
      baud_rate: config.baud_rate ? config.baud_rate.toString() : "",
      parity: config.parity ?? "",
      stop_bits: config.stop_bits ? config.stop_bits.toString() : "",
      data_bits: config.data_bits ? config.data_bits.toString() : "",
      com_port: config.com_port ?? "",
      regex_pattern: config.regex_pattern ?? "",
      file_path: config.file_path ?? "",
      file_path_2: config.file_path_2 ?? "",
      ip_address: config.ip_address ?? "",
      tcp_port: config.tcp_port ? config.tcp_port.toString() : "",
      timeout: config.timeout ? config.timeout.toString() : "",
      lines_per_item: config.lines_per_item > 0
        ? config.lines_per_item.toString()
        : "1",
      regex_filter_enabled: config.regex_filter_enabled ?? false,
    });

    if (config.pdf_columns) {
      try {
        const columns = typeof config.pdf_columns === "string"
          ? JSON.parse(config.pdf_columns)
          : config.pdf_columns;
        if (Array.isArray(columns) && columns.length > 0) {
          setPdfColumns(columns);
        } else {
          loadDefaultColumns(data.data.type);
        }
      } catch {
        loadDefaultColumns(data.data.type);
      }
    } else {
      loadDefaultColumns(data.data.type);
    }

    setInitializedForId(config.id);
  }, [data]);

  const loadDefaultColumns = (instrumentType: string) => {
    const type = instrumentType?.toLowerCase() || "";
    let defaults: ColumnConfig[] = [];

    if (type.includes("timbangan") || type.includes("balance") || type.includes("scale")) {
      defaults = [
        { key: "value", header: "Weight", unit: "g", is_numeric: true, width: 120, enabled: true }
      ];
    } else if (type.includes("refract")) {
      defaults = [
        { key: "brix", header: "Brix", unit: "%", is_numeric: true, width: 80, enabled: true },
        { key: "nd", header: "nD", unit: "", is_numeric: true, width: 80, enabled: true },
        { key: "temperature", header: "Temp", unit: "°C", is_numeric: true, width: 70, enabled: true }
      ];
    } else if (type.includes("ph")) {
      defaults = [
        { key: "ph", header: "pH", unit: "", is_numeric: true, width: 80, enabled: true },
        { key: "temperature", header: "Temp", unit: "°C", is_numeric: true, width: 80, enabled: true }
      ];
    } else if (type.includes("moisture")) {
      defaults = [
        { key: "moisture", header: "Moisture", unit: "%", is_numeric: true, width: 90, enabled: true },
        { key: "weight", header: "Weight", unit: "g", is_numeric: true, width: 90, enabled: true }
      ];
    } else {
      defaults = [
        { key: "value", header: "Result", unit: "", is_numeric: false, width: 150, enabled: true }
      ];
    }

    setPdfColumns(defaults);
  };

  useEffect(() => {
    if (regexTest.testResult?.groups) {
      const fields = Object.keys(regexTest.testResult.groups);
      setDetectedFields(fields);

      const existingKeys = pdfColumns.map(col => col.key);
      const newFields = fields.filter(field => !existingKeys.includes(field));

      if (newFields.length > 0) {
        const newColumns = newFields.map(field => ({
          key: field,
          header: formatHeader(field),
          unit: guessUnit(field),
          is_numeric: isNumericField(field),
          width: 100,
          enabled: true
        }));
        setPdfColumns([...pdfColumns, ...newColumns]);
      }
    }
  }, [regexTest.testResult]);

  const formatHeader = (key: string): string => {
    const map: Record<string, string> = {
      value: "Result", brix: "Brix", nd: "nD", ph: "pH",
      temperature: "Temperature", t: "Temp", moisture: "Moisture",
      weight: "Weight", user_id: "User ID", sample: "Sample",
      // ✅ Add common multi-line pH meter fields:
      user: "User", ph_value: "pH Value", ph_unit: "pH Unit",
      temp_unit: "Temp Unit"
    };
    return map[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
  };

  const guessUnit = (key: string): string => {
    const map: Record<string, string> = {
      brix: "%", weight: "g", moisture: "%",
      temperature: "°C", t: "°C", ph: "",
      ph_value: "", ph_unit: "", temp_unit: ""
    };
    return map[key] || "";
  };

  const isNumericField = (key: string): boolean => {
    return ['value', 'brix', 'nd', 'temperature', 't', 'moisture', 'weight', 'ph', 'ph_value'].includes(key);
  };

  const regexPresets = [
    { name: "Weight (g)", pattern: "(?P<value>[\\d.]+)\\s*g" },
    { name: "Refractometer", pattern: "Brix=\\s*(?P<brix>[\\d.]+)%\\s*nD=(?P<nd>[\\d.]+)\\s*t=(?P<temperature>[\\d.]+)" },
    { name: "pH Meter", pattern: "pH\\s*(?P<ph>[\\d.]+)" },
    {
      name: "pH Meter Multi-line",
      pattern: "User\\s+(?P<user>.+)|U1\\[1\\]\\s+(?P<ph_value>[\\d.]+)\\s*(?P<ph_unit>\\w+)?|T1\\[1\\]\\s+(?P<temperature>[\\d.]+)\\s*(?P<temp_unit>[^\\s]+)?"
    },
    { name: "Moisture Analyzer", pattern: "MC\\s*(?P<moisture>[\\d.]+)%\\s*W\\s*(?P<weight>[\\d.]+)g" },
  ];

  const loadPreset = (preset: { name: string; pattern: string }) => {
    // Single setForm call, handles both cases
    setForm(prev => ({
      ...prev,
      regex_pattern: preset.pattern,
      ...(preset.name === "pH Meter Multi-line" ? { lines_per_item: "3" } : {})
    }));
  };

  const handleTestRegex = async () => {
    if (!form.regex_pattern || !regexTest.sampleData) {
      alert("Please enter both regex pattern and sample data");
      return;
    }
    try {
      const response = await axiosInstance.post("/api/instruments/test-regex", {
        pattern: form.regex_pattern,
        sample: regexTest.sampleData
      });
      setRegexTest({
        ...regexTest,
        testResult: response.data.data,
        isValid: response.data.data.matched
      });
    } catch (error: any) {
      setRegexTest({
        ...regexTest,
        testResult: { matched: false, error: error.response?.data?.message || "Test failed" },
        isValid: false
      });
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const payload: any = { instrument_id: Number(id) };
      const response = await axiosInstance.post(`/api/instruments/${id}/test-connection`, payload);
      alert(response.data.data?.message || "Connection test successful!");
    } catch (error: any) {
      alert(error.response?.data?.message || "Connection test failed");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let payload: any = {
        active_tab: activeTab, // ← tambah ini
      };

      if (activeTab === "tcp") {
        payload.ip_address = form.ip_address || null;
        payload.tcp_port = form.tcp_port !== "" ? Number(form.tcp_port) : null;
        payload.timeout = form.timeout !== "" ? Number(form.timeout) : null;
      }

      if (activeTab === "connectivity") {
        payload.com_port = form.com_port || null;
        payload.baud_rate = form.baud_rate !== "" ? Number(form.baud_rate) : null;
        payload.data_bits = form.data_bits !== "" ? Number(form.data_bits) : null;
        payload.stop_bits = form.stop_bits !== "" ? Number(form.stop_bits) : null;
        payload.parity = form.parity || null;
      }

      if (activeTab === "parsing") {
        payload.regex_pattern = form.regex_pattern;
        payload.lines_per_item = Number(form.lines_per_item) || 1;
        payload.regex_filter_enabled = Boolean(form.regex_filter_enabled);
      }

      if (activeTab === "pdf") {
        payload.file_path = form.file_path;
        payload.file_path_2 = form.file_path_2;
        if (pdfColumns.length > 0) {
          payload.pdf_columns = JSON.stringify(pdfColumns);
        }
      }

      const response = await axiosInstance.put(
        `/api/instruments/${id}/configuration`,
        payload
      );

      const savedConfig = response.data?.data;
      if (savedConfig) {
        setForm(prev => ({
          ...prev,
          baud_rate: savedConfig.baud_rate?.toString() ?? prev.baud_rate,
          parity: savedConfig.parity ?? prev.parity,
          stop_bits: savedConfig.stop_bits?.toString() ?? prev.stop_bits,
          data_bits: savedConfig.data_bits?.toString() ?? prev.data_bits,
          com_port: savedConfig.com_port ?? prev.com_port,
          regex_pattern: savedConfig.regex_pattern ?? prev.regex_pattern,
          // ✅ Use ?? instead of || so empty string is respected
          file_path: savedConfig.file_path ?? prev.file_path,
          file_path_2: savedConfig.file_path_2 ?? prev.file_path_2,
          ip_address: savedConfig.ip_address ?? prev.ip_address,
          tcp_port: savedConfig.tcp_port?.toString() ?? prev.tcp_port,
          timeout: savedConfig.timeout?.toString() ?? prev.timeout,
          lines_per_item: savedConfig.lines_per_item?.toString() ?? prev.lines_per_item,
          regex_filter_enabled: savedConfig.regex_filter_enabled ?? prev.regex_filter_enabled,
        }));
      }

      alert(`${getTabLabel(activeTab)} configuration saved successfully!`);
    } catch (error: any) {
      console.error("Save error:", error.response?.data);
      alert(error.response?.data?.message || "Failed to save configuration");
    } finally {
      setIsSaving(false);
    }

    setInitializedForId(null);
    queryClient.invalidateQueries({ queryKey: ["instrument-detail", id] });
  };

  // Helper for alert message
  const getTabLabel = (tab: string) => {
    const labels: Record<string, string> = {
      tcp: "TCP/IP",
      connectivity: "Serial Port",
      parsing: "Data Parsing",
      pdf: "PDF Export",
    };
    return labels[tab] || tab;
  };

  const addCustomColumn = () => {
    setPdfColumns([...pdfColumns, {
      key: "",
      header: "",
      unit: "",
      is_numeric: false,
      width: 100,
      enabled: true
    }]);
  };

  const removeColumn = (index: number) => {
    setPdfColumns(pdfColumns.filter((_, i) => i !== index));
  };

  const updateColumn = (index: number, field: keyof ColumnConfig, value: any) => {
    const updated = [...pdfColumns];
    updated[index] = { ...updated[index], [field]: value };
    setPdfColumns(updated);
  };

  const moveColumn = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === pdfColumns.length - 1)) return;
    const updated = [...pdfColumns];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [updated[index], updated[swapIndex]] = [updated[swapIndex], updated[index]];
    setPdfColumns(updated);
  };

  if (isLoading || !data?.data) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3">Loading configuration...</p>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1">⚙️ Configuration</h3>
          <p className="text-muted mb-0">{data?.data?.nama_instrument || "Instrument"}</p>
        </div>
        <button className="btn btn-outline-secondary" onClick={() => navigate(-1)}>← Back</button>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white border-bottom">
          <ul className="nav nav-tabs card-header-tabs">
            <li className="nav-item">
              <button className={`nav-link ${activeTab === "tcp" ? "active" : ""}`} onClick={() => setActiveTab("tcp")}>TCP/IP</button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === "connectivity" ? "active" : ""}`} onClick={() => setActiveTab("connectivity")}>Serial Port</button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === "parsing" ? "active" : ""}`} onClick={() => setActiveTab("parsing")}>Data Parsing</button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === "pdf" ? "active" : ""}`} onClick={() => setActiveTab("pdf")}>PDF Export Config</button>
            </li>
          </ul>
        </div>

        <div className="card-body p-4">
          {activeTab === "connectivity" && (
            <div className="row g-4">
              <div className="col-md-6 mx-auto">
                <div className="mb-3">
                  <label className="form-label fw-bold">COM Port</label>
                  <input type="text" className="form-control" value={form.com_port} onChange={(e) => setForm({ ...form, com_port: e.target.value })} placeholder="COM3" />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Baud Rate</label>
                  <select className="form-select" value={form.baud_rate} onChange={(e) => setForm({ ...form, baud_rate: e.target.value })}>
                    <option value="">Select Baud Rate</option>
                    <option value="1200">1200</option>
                    <option value="2400">2400</option>
                    <option value="4800">4800</option>
                    <option value="9600">9600</option>
                    <option value="19200">19200</option>
                    <option value="38400">38400</option>
                    <option value="57600">57600</option>
                    <option value="115200">115200</option>
                    <option value="14400">14400</option>
                    
                  </select>
                </div>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Data Bits</label>
                    <select className="form-select" value={form.data_bits} onChange={(e) => setForm({ ...form, data_bits: e.target.value })}>
                      <option value="">Select</option>
                      <option value="7">7</option>
                      <option value="8">8</option>
                    </select>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Stop Bits</label>
                    <select className="form-select" value={form.stop_bits} onChange={(e) => setForm({ ...form, stop_bits: e.target.value })}>
                      <option value="">Select</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                    </select>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Parity</label>
                  <select className="form-select" value={form.parity} onChange={(e) => setForm({ ...form, parity: e.target.value })}>
                    <option value="">Select Parity</option>
                    <option value="None">None</option>
                    <option value="Even">Even</option>
                    <option value="Odd">Odd</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === "tcp" && (
            <div className="row g-4">
              <div className="col-md-6 mx-auto">
                <div className="mb-3">
                  <label className="form-label fw-bold">IP Address</label>
                  <input type="text" className="form-control" value={form.ip_address} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} placeholder="192.168.1.100" />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">TCP/IP Port</label>
                  <input type="number" className="form-control" value={form.tcp_port} onChange={(e) => setForm({ ...form, tcp_port: e.target.value })} placeholder="8080" />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Timeout (sec)</label>
                  <input type="number" className="form-control" value={form.timeout} onChange={(e) => setForm({ ...form, timeout: e.target.value })} placeholder="30" />
                </div>
              </div>
            </div>
          )}

          {activeTab === "parsing" && (
            <div>
              <div className="alert alert-info mb-4">
                <strong>Data Parsing Configuration</strong>
                <p className="mb-0 mt-2">Configure regex pattern to extract structured data from instrument output. Use Python-style named groups: <code>(?P&lt;field_name&gt;pattern)</code></p>
              </div>

              {/* ✅ NEW SECTION: Multi-line Configuration */}
              <div className="card bg-light mb-4">
                <div className="card-header">
                  <strong>📊 Multi-line Data Configuration</strong>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label fw-bold">
                          Jumlah Baris Data per Sampel
                          <span className="text-muted ms-2" style={{ fontWeight: 'normal', fontSize: '0.9em' }}>
                            (Baris data yang dihasilkan setiap sampel)
                          </span>
                        </label>
                        <input
                          type="number"
                          className="form-control"
                          min="1"
                          max="100"
                          value={form.lines_per_item}
                          onChange={(e) => setForm({ ...form, lines_per_item: e.target.value })}
                        />
                        <small className="text-muted">
                          Set to 3 for pH meters that output User, pH, and Temperature on separate lines.
                          Set to 1 for single-line instruments (default).
                        </small>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label fw-bold">Regex Filtering</label>
                        <div className="form-check form-switch mt-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="regexFilterSwitch"
                            checked={form.regex_filter_enabled}
                            onChange={(e) => setForm({ ...form, regex_filter_enabled: e.target.checked })}
                          />
                          <label className="form-check-label" htmlFor="regexFilterSwitch">
                            Enable Strict Filtering
                          </label>
                        </div>
                        <small className="text-muted">
                          When enabled, only data matching the regex pattern will be saved.
                          Non-matching data will be rejected.
                        </small>
                      </div>
                    </div>
                  </div>

                  {/* ✅ Visual Example when multi-line is enabled */}
                  {Number(form.lines_per_item) > 1 && (
                    <div className="alert alert-success mb-0">
                      <strong>✅ Multi-line Mode Active ({form.lines_per_item} lines per item)</strong>
                      <p className="mb-2 mt-2">The system will group {form.lines_per_item} consecutive lines into one measurement.</p>
                      {Number(form.lines_per_item) === 3 && (
                        <div className="bg-white p-2 rounded border mt-2" style={{ fontSize: '0.85em' }}>
                          <strong>Example (pH Meter):</strong>
                          <pre className="mb-0 mt-1" style={{ fontSize: '0.9em' }}>
                            Line 1: User    John Doe
                            Line 2: U1[1]   7.45 pH      {'}'} → Combined into 1 item
                            Line 3: T1[1]   25.3 C
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ✅ Warning when filter is enabled */}
                  {form.regex_filter_enabled && (
                    <div className="alert alert-warning mb-0 mt-3">
                      <strong>⚠️ Strict Filtering Enabled</strong>
                      <p className="mb-0 mt-1">
                        Data that doesn't match your regex pattern will be <strong>rejected</strong> and <strong>not saved</strong> to the database.
                        Make sure your pattern is correct!
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label fw-bold">Regex Presets</label>
                <div className="d-flex flex-wrap gap-2">
                  {regexPresets.map((preset, idx) => (
                    <button key={idx} className="btn btn-sm btn-outline-secondary" onClick={() => loadPreset(preset)}>
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label fw-bold">Regular Expression Pattern</label>
                <textarea className="form-control font-monospace" rows={3} value={form.regex_pattern} onChange={(e) => setForm({ ...form, regex_pattern: e.target.value })} placeholder="e.g., Brix=\s*(?P<brix>[\d.]+)%\s*nD=(?P<nd>[\d.]+)\s*t=(?P<temperature>[\d.]+)" style={{ fontSize: '0.9rem' }} />
                <small className="text-muted">Use Python named groups: <code>(?P&lt;field_name&gt;pattern)</code>. For multi-line instruments, use <code>|</code> to combine patterns.</small>
              </div>
              <div className="card bg-light">
                <div className="card-header"><strong>🧪 Test Regex Pattern</strong></div>
                <div className="card-body">
                  <div className="mb-3">
                    <label className="form-label">Sample Data from Instrument</label>
                    <input type="text" className="form-control font-monospace" value={regexTest.sampleData} onChange={(e) => setRegexTest({ ...regexTest, sampleData: e.target.value })} placeholder="Paste sample data here" />
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={handleTestRegex}>Test Pattern</button>
                  {regexTest.testResult && (
                    <div className={`mt-3 p-3 rounded ${regexTest.isValid ? 'bg-success bg-opacity-10 border border-success' : 'bg-danger bg-opacity-10 border border-danger'}`}>
                      {regexTest.testResult.matched ? (
                        <>
                          <div className="mb-2"><strong>✅ Pattern Matched!</strong></div>
                          {regexTest.testResult.groups && Object.keys(regexTest.testResult.groups).length > 0 ? (
                            <>
                              <div className="mb-2"><strong>Extracted Fields:</strong></div>
                              <table className="table table-sm table-bordered bg-white mb-0">
                                <thead><tr><th>Field Name</th><th>Value</th></tr></thead>
                                <tbody>
                                  {Object.entries(regexTest.testResult.groups).map(([key, value]) => (
                                    <tr key={key}><td><code>{key}</code></td><td><strong>{value as string}</strong></td></tr>
                                  ))}
                                </tbody>
                              </table>
                            </>
                          ) : <div className="text-muted">No named groups captured</div>}
                        </>
                      ) : regexTest.testResult.error ? (
                        <div><strong>❌ Invalid Regex Pattern</strong><div className="text-danger small mt-1">{regexTest.testResult.error}</div></div>
                      ) : <strong>❌ Pattern did not match</strong>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "pdf" && (
            <div>
              <div className="alert alert-info mb-4">
                <strong>📄 PDF Report Column Configuration</strong>
                <p className="mb-0 mt-2">Configure how data fields will appear in PDF reports. Reorder and enable/disable columns as needed.</p>
              </div>

              {/* ✅ NEW: File Path Configuration */}
              <div className="card bg-light mb-4">
                <div className="card-header">
                  <strong>📁 Export File Path Configuration</strong>
                </div>
                <div className="card-body">
                  <p className="text-muted small mb-3">
                    Exported PDF files will be automatically saved to the configured folder paths.
                    Use absolute paths (e.g. <code>\\server\QC\exports</code> or <code>/mnt/nas/qc</code>).
                  </p>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label fw-bold">
                        File Path 1 <span className="badge bg-primary ms-1">QC</span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text">
                          <i className="bi bi-folder2-open"></i>
                        </span>
                        <input
                          type="text"
                          className="form-control font-monospace"
                          value={form.file_path}
                          onChange={(e) => setForm({ ...form, file_path: e.target.value })}
                          placeholder="e.g. \\server\QC\exports or /mnt/qc/exports"
                        />
                        {form.file_path && (
                          <button
                            className="btn btn-outline-secondary"
                            type="button"
                            title="Clear"
                            onClick={() => setForm({ ...form, file_path: "" })}
                          >
                            <i className="bi bi-x"></i>
                          </button>
                        )}
                      </div>
                      <small className="text-muted">Primary export destination (QC department)</small>
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label fw-bold">
                        File Path 2 <span className="badge bg-secondary ms-1">Others</span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text">
                          <i className="bi bi-folder2-open"></i>
                        </span>
                        <input
                          type="text"
                          className="form-control font-monospace"
                          value={form.file_path_2}
                          onChange={(e) => setForm({ ...form, file_path_2: e.target.value })}
                          placeholder="e.g. \\server\AnDev\exports or /mnt/andev/exports"
                        />
                        {form.file_path_2 && (
                          <button
                            className="btn btn-outline-secondary"
                            type="button"
                            title="Clear"
                            onClick={() => setForm({ ...form, file_path_2: "" })}
                          >
                            <i className="bi bi-x"></i>
                          </button>
                        )}
                      </div>
                      <small className="text-muted">Secondary export destination</small>
                    </div>
                  </div>

                  {/* Status indicators */}
                  <div className="d-flex gap-3 mt-1">
                    <div className="d-flex align-items-center gap-2">
                      <span className={`badge ${form.file_path ? "bg-success" : "bg-secondary"}`}>
                        Path 1
                      </span>
                      <small className="text-muted">
                        {form.file_path ? "Configured" : "Not set — exports will use default location"}
                      </small>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span className={`badge ${form.file_path_2 ? "bg-success" : "bg-secondary"}`}>
                        Path 2
                      </span>
                      <small className="text-muted">
                        {form.file_path_2 ? "Configured" : "Not set"}
                      </small>
                    </div>
                  </div>
                </div>
              </div>
              {detectedFields.length > 0 && (
                <div className="alert alert-success mb-3">
                  <strong>✅ Detected Fields from Regex:</strong> {detectedFields.join(", ")}
                </div>
              )}
              <div className="mb-3">
                <button className="btn btn-sm btn-primary" onClick={addCustomColumn}>+ Add Custom Column</button>
              </div>
              {pdfColumns.length === 0 ? (
                <div className="text-center text-muted py-4">No columns configured. Click "Add Custom Column" to start.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-bordered">
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: '40px' }}></th>
                        <th style={{ width: '60px' }}>On/Off</th>
                        <th>Field Key</th>
                        <th>Header Text</th>
                        <th style={{ width: '100px' }}>Unit</th>
                        <th style={{ width: '80px' }}>Numeric</th>
                        <th style={{ width: '100px' }}>Width (px)</th>
                        <th style={{ width: '80px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pdfColumns.map((col, idx) => (
                        <tr key={idx} className={!col.enabled ? 'table-secondary' : ''}>
                          <td className="text-center">
                            <div className="d-flex flex-column gap-1">
                              <button className="btn btn-sm btn-outline-secondary py-0 px-2" onClick={() => moveColumn(idx, 'up')} disabled={idx === 0} title="Move Up">↑</button>
                              <button className="btn btn-sm btn-outline-secondary py-0 px-2" onClick={() => moveColumn(idx, 'down')} disabled={idx === pdfColumns.length - 1} title="Move Down">↓</button>
                            </div>
                          </td>
                          <td className="text-center">
                            <input type="checkbox" className="form-check-input" checked={col.enabled} onChange={(e) => updateColumn(idx, 'enabled', e.target.checked)} />
                          </td>
                          <td>
                            <input type="text" className="form-control form-control-sm font-monospace" value={col.key} onChange={(e) => updateColumn(idx, 'key', e.target.value)} placeholder="e.g., brix" />
                          </td>
                          <td>
                            <input type="text" className="form-control form-control-sm" value={col.header} onChange={(e) => updateColumn(idx, 'header', e.target.value)} placeholder="e.g., Brix" />
                          </td>
                          <td>
                            <input type="text" className="form-control form-control-sm" value={col.unit} onChange={(e) => updateColumn(idx, 'unit', e.target.value)} placeholder="%, g, °C" />
                          </td>
                          <td className="text-center">
                            <input type="checkbox" className="form-check-input" checked={col.is_numeric} onChange={(e) => updateColumn(idx, 'is_numeric', e.target.checked)} />
                          </td>
                          <td>
                            <input type="number" className="form-control form-control-sm" value={col.width} onChange={(e) => updateColumn(idx, 'width', Number(e.target.value))} min="50" max="300" />
                          </td>
                          <td className="text-center">
                            <button className="btn btn-sm btn-danger" onClick={() => removeColumn(idx)} title="Remove">🗑️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      <div className="d-flex justify-content-end gap-2 mt-4">
        <button className="btn btn-outline-dark px-4 py-2" onClick={handleTestConnection} disabled={isTesting}>
          {isTesting ? <><span className="spinner-border spinner-border-sm me-2"></span>Testing...</> : "Test Connection"}
        </button>
        <button className="btn btn-success px-4 py-2" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</> : "Save Changes"}
        </button>
      </div>
    </div>
  );
}