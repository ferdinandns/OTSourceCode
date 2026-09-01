import { useState } from 'react';
import type { ChecklistByName, InstrumentWithStatus } from '../../../types/checklist';
import SidebarMenu from '../../../components/SidebarMenu';

interface Props {
  byNameConfigs: ChecklistByName[];
  instruments: InstrumentWithStatus[];
  onCreateByName: (instrumentType: string, instrumentName: string) => void;
  onEditByName: (configId: number) => void;
  onDeleteByName: (configId: number) => void;
  onConfigureInstrument: (instrumentId: number) => void;
  isLoading?: boolean;
}

export default function ChecklistManagementPage({
  byNameConfigs,
  instruments,
  onCreateByName,
  onEditByName,
  onDeleteByName,
  onConfigureInstrument,
  isLoading = false,
}: Props) {
  const [activeTab, setActiveTab] = useState<'by-name' | 'instruments'>('by-name');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Get unique instrument names from instruments
  const uniqueInstrumentNames = Array.from(
    new Set(instruments.map(i => `${i.type}|${i.nama}`))
  ).map(key => {
    const [type, name] = key.split('|');
    const instrCount = instruments.filter(i => i.type === type && i.nama === name).length;
    const hasConfig = byNameConfigs.some(c => c.instrument_name === name);

    return {
      instrument_type: type,
      instrument_name: name,
      instrument_count: instrCount,
      has_custom_checklist: hasConfig,
    };
  });

  const filteredNames = uniqueInstrumentNames.filter(item => {
    const matchesSearch = item.instrument_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || item.instrument_type === filterType;
    return matchesSearch && matchesType;
  });

  const filteredInstruments = instruments.filter(inst => {
    const matchesSearch =
      inst.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inst.kode_instrument.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === 'all' || inst.type === filterType;

    return matchesSearch && matchesType;
  });

  const handleDeleteByName = (configId: number, configName: string) => {
    if (confirm(`Are you sure you want to delete checklist for "${configName}"?\n\nThis will affect all instruments with this name.`)) {
      onDeleteByName(configId);
    }
  };

  const handleCreateNewByName = () => {
    const instrumentType = prompt('Enter instrument type:', 'Equipment');
    if (!instrumentType) return;

    const instrumentName = prompt('Enter instrument name (e.g., "Timbangan", "pH Meter"):');
    if (!instrumentName) return;

    onCreateByName(instrumentType, instrumentName);
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
            <p className="text-muted">Loading checklist configurations...</p>
          </div>
        </div>
      </div>
    );
  }

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
        <div className="d-flex align-items-start gap-3 mb-3">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="btn btn-link text-dark p-0 mt-1"
            style={{ fontSize: '1.75rem' }}
          >
            <i className="bi bi-list"></i>
          </button>
          <div className="flex-grow-1">
            <h4 className="mb-1 fw-bold">
              <i className="bi bi-list-check me-2 text-primary"></i>
              Initial & Final Condition Management
            </h4>
            <p className="text-muted mb-0 small">
              Konfigurasi kondisi awal dan akhir yang harus diperiksa sebelum dan setelah penggunaan instrument
            </p>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="row g-3 mb-3">
          <div className="col-md-4">
            <div className="card border-0 shadow-sm bg-primary bg-gradient text-white h-100">
              <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="mb-1 opacity-75 small">Total Configurations</h6>
                    <h3 className="mb-0 fw-bold">{byNameConfigs.length}</h3>
                    <small className="opacity-75">By-Name Configs</small>
                  </div>
                  <i className="bi bi-tag-fill" style={{ fontSize: '2.5rem', opacity: 0.3 }}></i>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card border-0 shadow-sm bg-success bg-gradient text-white h-100">
              <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="mb-1 opacity-75 small">Custom Overrides</h6>
                    <h3 className="mb-0 fw-bold">{instruments.filter(i => i.has_custom_checklist).length}</h3>
                    <small className="opacity-75">Individual Configs</small>
                  </div>
                  <i className="bi bi-gear-fill" style={{ fontSize: '2.5rem', opacity: 0.3 }}></i>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card border-0 shadow-sm bg-info bg-gradient text-white h-100">
              <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="mb-1 opacity-75 small">Total Instruments</h6>
                    <h3 className="mb-0 fw-bold">{instruments.length}</h3>
                    <small className="opacity-75">Being Managed</small>
                  </div>
                  <i className="bi bi-cpu-fill" style={{ fontSize: '2.5rem', opacity: 0.3 }}></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <ul className="nav nav-pills mb-3 bg-light p-2 rounded shadow-sm">
          <li className="nav-item flex-fill">
            <button
              className={`nav-link w-100 ${activeTab === 'by-name' ? 'active' : ''}`}
              onClick={() => setActiveTab('by-name')}
            >
              <i className="bi bi-tag me-2"></i>
              By Instrument Name
              <span className="badge bg-white text-primary ms-2">{byNameConfigs.length}</span>
            </button>
          </li>
          <li className="nav-item flex-fill">
            <button
              className={`nav-link w-100 ${activeTab === 'instruments' ? 'active' : ''}`}
              onClick={() => setActiveTab('instruments')}
            >
              <i className="bi bi-cpu me-2"></i>
              Individual Override
              <span className="badge bg-white text-primary ms-2">{instruments.filter(i => i.has_custom_checklist).length}</span>
            </button>
          </li>
        </ul>

        {/* By Name Tab */}
        {activeTab === 'by-name' && (
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-bottom py-3">
              <div className="row align-items-center g-2">
                <div className="col-md-6">
                  <h6 className="mb-1 fw-bold">
                    <i className="bi bi-tags-fill text-primary me-2"></i>
                    Berdasarkan Jenis Instrument
                  </h6>
                  <small className="text-muted">
                    Instrument dengan jenis yang sama akan menggunakan konfigurasi yang sama
                  </small>
                </div>
                <div className="col-md-6">
                  <div className="row g-2">
                    <div className="col-md-7">
                      <div className="input-group input-group-sm">
                        <span className="input-group-text bg-white">
                          <i className="bi bi-search"></i>
                        </span>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Search name..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="col-md-5">
                      <select
                        className="form-select form-select-sm"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                      >
                        <option value="all">All Types</option>
                        <option value="Equipment">Equipment</option>
                        <option value="Instrument">Instrument</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body p-3">
              <div className="alert alert-info border-0 mb-3 py-2">
                <i className="bi bi-info-circle-fill me-2"></i>
                <small>
                  Konfigurasi persyaratan kondisi awal dan akhir berdasarkan nama instrument. Misalnya, semua instrument dengan nama "Timbangan" akan menggunakan syarat yang sama.
                </small>
              </div>

              {filteredNames.length === 0 ? (
                <div className="text-center text-muted py-5">
                  <i className="bi bi-inbox fs-1 d-block mb-3 opacity-25"></i>
                  <p className="mb-0">No instrument names found</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover table-sm align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th className="fw-semibold">Instrument Name</th>
                        <th className="fw-semibold">Type</th>
                        <th className="text-center fw-semibold">Count</th>
                        <th className="text-center fw-semibold">
                          <i className="bi bi-box-arrow-in-right me-1"></i>
                          Initial
                        </th>
                        <th className="text-center fw-semibold">
                          <i className="bi bi-box-arrow-right me-1"></i>
                          Final
                        </th>
                        <th className="text-end fw-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredNames.map((item) => {
                        const config = byNameConfigs.find(
                          c => c.instrument_name === item.instrument_name
                        );

                        return (
                          <tr key={`${item.instrument_type}-${item.instrument_name}`}>
                            <td>
                              <div className="fw-semibold">{item.instrument_name}</div>
                              {config && (
                                <small className="text-muted">{config.description}</small>
                              )}
                            </td>
                            <td>
                              <span className={`badge ${item.instrument_type === 'Equipment' ? 'bg-primary' : 'bg-success'}`}>
                                {item.instrument_type}
                              </span>
                            </td>
                            <td className="text-center">
                              <span className="badge bg-info bg-opacity-10 text-info">
                                <i className="bi bi-hash"></i>
                                {item.instrument_count}
                              </span>
                            </td>
                            <td className="text-center">
                              {config ? (
                                <span className="badge bg-success bg-opacity-10 text-success">
                                  {config.initial_items_count}
                                </span>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                            <td className="text-center">
                              {config ? (
                                <span className="badge bg-warning bg-opacity-10 text-warning">
                                  {config.final_items_count}
                                </span>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                            <td className="text-end">
                              {config ? (
                                <div className="btn-group btn-group-sm">
                                  <button
                                    className="btn btn-outline-primary"
                                    onClick={() => onEditByName(config.id)}
                                  >
                                    <i className="bi bi-pencil-square me-1"></i>
                                    Edit
                                  </button>
                                  <button
                                    className="btn btn-outline-danger"
                                    onClick={() => handleDeleteByName(config.id, item.instrument_name)}
                                  >
                                    <i className="bi bi-trash-fill"></i>
                                  </button>
                                </div>
                              ) : (
                                <button
                                  className="btn btn-sm btn-primary"
                                  onClick={() => onCreateByName(item.instrument_type, item.instrument_name)}
                                >
                                  <i className="bi bi-plus-circle me-1"></i>
                                  Configure
                                </button>
                              )}
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
        )}

        {/* Individual Instruments Tab */}
        {activeTab === 'instruments' && (
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-bottom py-3">
              <div className="row align-items-center g-2">
                <div className="col-md-6">
                  <h6 className="mb-1 fw-bold">
                    <i className="bi bi-gear-fill text-success me-2"></i>
                    Individual Instrument Override
                  </h6>
                  <small className="text-muted">
                    Custom checklist for specific instruments (overrides by-name config)
                  </small>
                </div>
                <div className="col-md-6">
                  <div className="row g-2">
                    <div className="col-md-7">
                      <div className="input-group input-group-sm">
                        <span className="input-group-text bg-white">
                          <i className="bi bi-search"></i>
                        </span>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Search instrument..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="col-md-5">
                      <select
                        className="form-select form-select-sm"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                      >
                        <option value="all">All Types</option>
                        <option value="Equipment">Equipment</option>
                        <option value="Instrument">Instrument</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body p-3">
              <div className="alert alert-info border-0 mb-3 py-2">
                <i className="bi bi-info-circle-fill me-2"></i>
                <small>
                  Configure custom checklists for specific instruments. If not configured,
                  the instrument will use the checklist configured for its name.
                </small>
              </div>

              {filteredInstruments.length === 0 ? (
                <div className="text-center text-muted py-5">
                  <i className="bi bi-inbox fs-1 d-block mb-3 opacity-25"></i>
                  <p className="mb-0">No instruments found</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover table-sm align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th className="fw-semibold">Control Number</th>
                        <th className="fw-semibold">Instrument Name</th>
                        <th className="fw-semibold">Type</th>
                        <th className="fw-semibold">Status</th>
                        <th className="text-center fw-semibold">
                          <i className="bi bi-box-arrow-in-right me-1"></i>
                          Initial
                        </th>
                        <th className="text-center fw-semibold">
                          <i className="bi bi-box-arrow-right me-1"></i>
                          Final
                        </th>
                        <th className="text-end fw-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInstruments.map((instrument) => (
                        <tr key={instrument.id}>
                          <td>
                            <code className="text-primary small">{instrument.kode_instrument}</code>
                          </td>
                          <td className="fw-medium">{instrument.nama}</td>
                          <td>
                            <span className={`badge ${instrument.type === 'Equipment' ? 'bg-primary' : 'bg-success'}`}>
                              {instrument.type}
                            </span>
                          </td>
                          <td>
                            {instrument.has_custom_checklist ? (
                              <span className="badge bg-danger bg-opacity-10 text-danger">
                                <i className="bi bi-gear-fill me-1"></i>
                                Custom
                              </span>
                            ) : (
                              <span className="badge bg-secondary bg-opacity-10 text-secondary">
                                <i className="bi bi-tag me-1"></i>
                                By-Name
                              </span>
                            )}
                          </td>
                          <td className="text-center">
                            {instrument.has_custom_checklist ? (
                              <span className="badge bg-success bg-opacity-10 text-success">
                                {instrument.initial_items_count || 0}
                              </span>
                            ) : (
                              <span className="text-muted small">-</span>
                            )}
                          </td>
                          <td className="text-center">
                            {instrument.has_custom_checklist ? (
                              <span className="badge bg-warning bg-opacity-10 text-warning">
                                {instrument.final_items_count || 0}
                              </span>
                            ) : (
                              <span className="text-muted small">-</span>
                            )}
                          </td>
                          <td className="text-end">
                            <button
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => onConfigureInstrument(instrument.id)}
                            >
                              <i className="bi bi-gear me-1"></i>
                              {instrument.has_custom_checklist ? 'Edit' : 'Add'} Override
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}