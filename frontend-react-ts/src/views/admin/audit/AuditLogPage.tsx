import { useState } from "react";
import { useAuditLogs, useAuditTables, AuditLog } from "../../../hooks/audit/useAuditLogs";
import SidebarMenu from "../../../components/SidebarMenu";

const ACTION_COLORS: Record<string, string> = {
  INSERT: "bg-success",
  UPDATE: "bg-warning text-dark",
  DELETE: "bg-danger",
  SELECT: "bg-info text-dark",
};

const ACTION_ICONS: Record<string, string> = {
  INSERT: "bi-plus-circle-fill",
  UPDATE: "bi-pencil-fill",
  DELETE: "bi-trash-fill",
  SELECT: "bi-eye-fill",
};

function JsonViewer({ data, label }: { data: any; label: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!data || Object.keys(data).length === 0) return <span className="text-muted small">—</span>;
  return (
    <div>
      <button
        className="btn btn-link btn-sm p-0 text-decoration-none"
        onClick={() => setExpanded(!expanded)}
      >
        <i className={`bi ${expanded ? "bi-chevron-up" : "bi-chevron-down"} me-1`}></i>
        {label}
      </button>
      {expanded && (
        <pre
          className="mt-1 p-2 rounded small bg-light border"
          style={{ maxHeight: 200, overflowY: "auto", fontSize: "0.72rem" }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function AuditLogPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [tableName, setTableName] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  // Selected row for detail modal
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const { data, isLoading } = useAuditLogs({
    page,
    limit,
    search: search || undefined,
    action: action || undefined,
    table_name: tableName || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });

  const { data: tables } = useAuditTables();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const handleReset = () => {
    setSearch("");
    setAction("");
    setTableName("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  return (
    <div className="container-fluid mt-3">
      <SidebarMenu
        isHorizontal={false}
        isSidebarOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <div className="d-flex align-items-center mb-3 gap-2">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="btn btn-link text-dark p-0"
          style={{ fontSize: "1.5rem" }}
        >
          <i className="bi bi-list" />
        </button>
        <div>
          <h5 className="mb-0 fw-bold">Audit Trail</h5>
          <small className="text-muted">Complete log of all system activity</small>
        </div>
      </div>

      {/* Filters */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body p-3">
          <form onSubmit={handleSearch}>
            <div className="row g-2">
              <div className="col-md-4">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Search username, table, endpoint..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className="col-md-2">
                <select
                  className="form-select form-select-sm"
                  value={action}
                  onChange={e => setAction(e.target.value)}
                >
                  <option value="">All Actions</option>
                  <option value="INSERT">INSERT</option>
                  <option value="UPDATE">UPDATE</option>
                  <option value="DELETE">DELETE</option>
                  <option value="SELECT">SELECT</option>
                </select>
              </div>
              <div className="col-md-2">
                <select
                  className="form-select form-select-sm"
                  value={tableName}
                  onChange={e => setTableName(e.target.value)}
                >
                  <option value="">All Tables</option>
                  {tables?.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  placeholder="From"
                />
              </div>
              <div className="col-md-2">
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  placeholder="To"
                />
              </div>
            </div>
            <div className="mt-2 d-flex gap-2">
              <button type="submit" className="btn btn-primary btn-sm rounded-3">
                <i className="bi bi-search me-1" />Search
              </button>
              <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={handleReset}>
                <i className="bi bi-x-circle me-1" />Reset
              </button>
              {data && (
                <span className="text-muted small align-self-center ms-2">
                  {data.total.toLocaleString()} records found
                </span>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Table */}
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-0">
          {isLoading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status" />
              <p className="mt-2 text-muted">Loading audit logs...</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0 align-middle" style={{ fontSize: "0.85rem" }}>
                <thead className="table-light">
                  <tr>
                    <th className="ps-3">Timestamp</th>
                    <th>Action</th>
                    <th>Table</th>
                    <th>Record ID</th>
                    <th>User</th>
                    <th>Endpoint</th>
                    <th>Changes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data?.data.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-5 text-muted">
                        <i className="bi bi-inbox fs-2 d-block mb-2" />
                        No audit records found
                      </td>
                    </tr>
                  ) : (
                    data?.data.map(log => (
                      <tr key={log.id} style={{ cursor: "pointer" }} onClick={() => setSelected(log)}>
                        <td className="ps-3 text-nowrap">
                          <span className="text-muted small">
                            {new Date(log.created_at).toLocaleString("id-ID", {
                              day: "2-digit", month: "short", year: "numeric",
                              hour: "2-digit", minute: "2-digit", second: "2-digit"
                            })}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${ACTION_COLORS[log.action] || "bg-secondary"}`}>
                            <i className={`bi ${ACTION_ICONS[log.action] || "bi-circle"} me-1`} />
                            {log.action}
                          </span>
                        </td>
                        <td>
                          <code className="small">{log.table_name}</code>
                        </td>
                        <td>
                          <span className="text-muted small">{log.record_id || "—"}</span>
                        </td>
                        <td>
                          <span className="fw-semibold">{log.username || "—"}</span>
                          {log.user_id && (
                            <span className="text-muted small ms-1">(#{log.user_id})</span>
                          )}
                        </td>
                        <td>
                          <span className="text-muted small text-truncate d-inline-block" style={{ maxWidth: 200 }}>
                            {log.endpoint || "—"}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex gap-2">
                            {log.old_values && Object.keys(log.old_values).length > 0 && (
                              <span className="badge bg-light text-danger border border-danger small">
                                <i className="bi bi-dash-circle me-1" />before
                              </span>
                            )}
                            {log.new_values && Object.keys(log.new_values).length > 0 && (
                              <span className="badge bg-light text-success border border-success small">
                                <i className="bi bi-plus-circle me-1" />after
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <i className="bi bi-chevron-right text-muted small" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <div className="d-flex justify-content-between align-items-center mt-3">
          <small className="text-muted">
            Page {data.page} of {data.total_pages} ({data.total.toLocaleString()} total)
          </small>
          <div className="d-flex gap-2">
            <button
              className="btn btn-outline-secondary btn-sm rounded-3"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <i className="bi bi-chevron-left" />
            </button>
            {Array.from({ length: Math.min(5, data.total_pages) }, (_, i) => {
              const p = Math.max(1, Math.min(page - 2, data.total_pages - 4)) + i;
              return (
                <button
                  key={p}
                  className={`btn btn-sm rounded-3 ${p === page ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              );
            })}
            <button
              className="btn btn-outline-secondary btn-sm rounded-3"
              disabled={page >= data.total_pages}
              onClick={() => setPage(p => p + 1)}
            >
              <i className="bi bi-chevron-right" />
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onClick={() => setSelected(null)}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable" onClick={e => e.stopPropagation()}>
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <div>
                  <h5 className="modal-title fw-bold">Audit Detail</h5>
                  <small className="text-muted">
                    {new Date(selected.created_at).toLocaleString("id-ID", {
                      weekday: "long", day: "2-digit", month: "long", year: "numeric",
                      hour: "2-digit", minute: "2-digit", second: "2-digit"
                    })}
                  </small>
                </div>
                <button className="btn-close" onClick={() => setSelected(null)} />
              </div>
              <div className="modal-body pt-2">
                <div className="row g-3 mb-3">
                  <div className="col-6">
                    <label className="text-muted small">Action</label>
                    <div>
                      <span className={`badge ${ACTION_COLORS[selected.action] || "bg-secondary"}`}>
                        <i className={`bi ${ACTION_ICONS[selected.action] || "bi-circle"} me-1`} />
                        {selected.action}
                      </span>
                    </div>
                  </div>
                  <div className="col-6">
                    <label className="text-muted small">Table</label>
                    <div><code>{selected.table_name}</code></div>
                  </div>
                  <div className="col-6">
                    <label className="text-muted small">Record ID</label>
                    <div className="fw-semibold">{selected.record_id || "—"}</div>
                  </div>
                  <div className="col-6">
                    <label className="text-muted small">User</label>
                    <div className="fw-semibold">
                      {selected.username || "—"}
                      {selected.user_id && <span className="text-muted small ms-1">(#{selected.user_id})</span>}
                    </div>
                  </div>
                  <div className="col-6">
                    <label className="text-muted small">Endpoint</label>
                    <div className="small text-muted">{selected.endpoint || "—"}</div>
                  </div>
                  <div className="col-6">
                    <label className="text-muted small">IP Address</label>
                    <div className="small text-muted">{selected.ip_address || "—"}</div>
                  </div>
                </div>

                {/* Old / New values side by side */}
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="text-muted small fw-bold">
                      <i className="bi bi-dash-circle text-danger me-1" />Before (Old Values)
                    </label>
                    {selected.old_values && Object.keys(selected.old_values).length > 0 ? (
                      <pre className="p-2 rounded small bg-light border mt-1" style={{ maxHeight: 300, overflowY: "auto", fontSize: "0.72rem" }}>
                        {JSON.stringify(selected.old_values, null, 2)}
                      </pre>
                    ) : (
                      <div className="text-muted small mt-1">No previous values</div>
                    )}
                  </div>
                  <div className="col-md-6">
                    <label className="text-muted small fw-bold">
                      <i className="bi bi-plus-circle text-success me-1" />After (New Values)
                    </label>
                    {selected.new_values && Object.keys(selected.new_values).length > 0 ? (
                      <pre className="p-2 rounded small bg-light border mt-1" style={{ maxHeight: 300, overflowY: "auto", fontSize: "0.72rem" }}>
                        {JSON.stringify(selected.new_values, null, 2)}
                      </pre>
                    ) : (
                      <div className="text-muted small mt-1">No new values</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}