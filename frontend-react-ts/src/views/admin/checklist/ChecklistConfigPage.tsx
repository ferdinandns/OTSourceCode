import { useState, useEffect, useRef } from 'react';

interface ChecklistItem {
  id: number;
  label: string;
  type: 'boolean' | 'text' | 'number';
  required: boolean;
  critical_ok: boolean;
  help_text?: string;
  placeholder?: string;
  min_value?: number;
  max_value?: number;
}

interface Props {
  instrumentId?: string;
  instrumentName?: string;
  existingInitialItems?: ChecklistItem[];
  existingFinalItems?: ChecklistItem[];
  existingRequireAllInitialOK?: boolean;
  existingRequireAllFinalOK?: boolean;
  onSave: (data: {
    initialItems: ChecklistItem[];
    finalItems: ChecklistItem[];
    requireAllInitialOK: boolean;
    requireAllFinalOK: boolean;
  }) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export default function ChecklistConfigPage({
  instrumentName,
  existingInitialItems = [],
  existingFinalItems = [],
  existingRequireAllInitialOK = true,
  existingRequireAllFinalOK = false,
  onSave,
  onCancel,
  isSaving = false,
}: Props) {
  const [activeTab, setActiveTab] = useState<'initial' | 'final'>('initial');
  const [initialItems, setInitialItems] = useState<ChecklistItem[]>([]);
  const [finalItems, setFinalItems] = useState<ChecklistItem[]>([]);
  const [requireAllInitialOK, setRequireAllInitialOK] = useState(true);
  const [requireAllFinalOK, setRequireAllFinalOK] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);

  // 🔧 FIX: Use ref to track if component is initialized
  const isInitialized = useRef(false);

  // 🔧 FIX: Only initialize once on mount or when key props change from PARENT
  useEffect(() => {
    console.log('📊 ChecklistConfigPage mounted/updated:', {
      instrumentName,
      existingInitialItemsCount: existingInitialItems?.length,
      existingFinalItemsCount: existingFinalItems?.length,
      existingRequireAllInitialOK,
      existingRequireAllFinalOK,
      isInitialized: isInitialized.current
    });
    
    // Initialize state from props
    setInitialItems(Array.isArray(existingInitialItems) ? existingInitialItems : []);
    setFinalItems(Array.isArray(existingFinalItems) ? existingFinalItems : []);
    setRequireAllInitialOK(existingRequireAllInitialOK ?? true);
    setRequireAllFinalOK(existingRequireAllFinalOK ?? false);
    
    isInitialized.current = true;
  }, [
    instrumentName, // Only re-run if instrument changes
    // Don't include array items directly - they cause re-render on every change
    existingInitialItems?.length,
    existingFinalItems?.length,
  ]);

  const getNextId = (items: ChecklistItem[]) => {
    return items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
  };

  const addNewItem = (type: 'initial' | 'final') => {
    const items = type === 'initial' ? initialItems : finalItems;
    const setItems = type === 'initial' ? setInitialItems : setFinalItems;

    const newItem: ChecklistItem = {
      id: getNextId(items),
      label: '',
      type: 'boolean',
      required: false,
      critical_ok: false,
      help_text: '',
      placeholder: '',
    };

    console.log('➕ Adding new item:', { type, newItem });
    setItems([...items, newItem]);
    setEditingItemId(newItem.id);
  };

  const updateItem = (type: 'initial' | 'final', id: number, updates: Partial<ChecklistItem>) => {
    const items = type === 'initial' ? initialItems : finalItems;
    const setItems = type === 'initial' ? setInitialItems : setFinalItems;

    setItems(items.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const deleteItem = (type: 'initial' | 'final', id: number) => {
    const items = type === 'initial' ? initialItems : finalItems;
    const setItems = type === 'initial' ? setInitialItems : setFinalItems;

    if (confirm('Are you sure you want to delete this item?')) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const moveItem = (type: 'initial' | 'final', id: number, direction: 'up' | 'down') => {
    const items = type === 'initial' ? initialItems : finalItems;
    const setItems = type === 'initial' ? setInitialItems : setFinalItems;

    const index = items.findIndex(item => item.id === id);
    if (index === -1) return;

    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === items.length - 1) return;

    const newItems = [...items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];

    setItems(newItems);
  };

  const handleSave = () => {
    // Validate
    const allItems = [...initialItems, ...finalItems];
    for (const item of allItems) {
      if (!item.label.trim()) {
        alert('All items must have a label');
        return;
      }
    }

    console.log('💾 Saving checklist config:', {
      initialItems,
      finalItems,
      requireAllInitialOK,
      requireAllFinalOK
    });

    onSave({
      initialItems,
      finalItems,
      requireAllInitialOK,
      requireAllFinalOK,
    });
  };

  const renderItemEditor = (item: ChecklistItem, type: 'initial' | 'final', index: number) => {
    const items = type === 'initial' ? initialItems : finalItems;
    const isEditing = editingItemId === item.id;

    return (
      <div key={item.id} className="card mb-3 border">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div className="flex-grow-1">
              <div className="input-group mb-2">
                <span className="input-group-text">#{index + 1}</span>
                <input
                  type="text"
                  className="form-control fw-bold"
                  placeholder="Enter requirement/parameter label *"
                  value={item.label}
                  onChange={(e) => updateItem(type, item.id, { label: e.target.value })}
                />
              </div>

              {isEditing && (
                <div className="border-start border-3 border-primary ps-3">
                  {/* Help Text */}
                  <div className="mb-2">
                    <label className="form-label small mb-1">Help Text / Explanation</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Additional guidance for users"
                      value={item.help_text || ''}
                      onChange={(e) => updateItem(type, item.id, { help_text: e.target.value })}
                    />
                  </div>

                  {/* Input Type */}
                  <div className="row mb-2">
                    <div className="col-md-4">
                      <label className="form-label small mb-1">Input Type</label>
                      <select
                        className="form-select form-select-sm"
                        value={item.type}
                        onChange={(e) => updateItem(type, item.id, { type: e.target.value as any })}
                      >
                        <option value="boolean">Yes/No (Boolean)</option>
                        <option value="text">Free Text</option>
                        <option value="number">Number</option>
                      </select>
                    </div>

                    {/* Number Range */}
                    {item.type === 'number' && (
                      <>
                        <div className="col-md-4">
                          <label className="form-label small mb-1">Min Value</label>
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            placeholder="Min"
                            value={item.min_value || ''}
                            onChange={(e) => updateItem(type, item.id, { min_value: parseFloat(e.target.value) || undefined })}
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label small mb-1">Max Value</label>
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            placeholder="Max"
                            value={item.max_value || ''}
                            onChange={(e) => updateItem(type, item.id, { max_value: parseFloat(e.target.value) || undefined })}
                          />
                        </div>
                      </>
                    )}

                    {/* Placeholder for text/number */}
                    {(item.type === 'text' || item.type === 'number') && (
                      <div className="col-md-4">
                        <label className="form-label small mb-1">Placeholder</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Input placeholder"
                          value={item.placeholder || ''}
                          onChange={(e) => updateItem(type, item.id, { placeholder: e.target.value })}
                        />
                      </div>
                    )}
                  </div>

                  {/* Flags */}
                  <div className="row">
                    <div className="col-md-6">
                      <div className="form-check form-switch">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id={`required-${item.id}`}
                          checked={item.required}
                          onChange={(e) => updateItem(type, item.id, { required: e.target.checked })}
                        />
                        <label className="form-check-label small" htmlFor={`required-${item.id}`}>
                          Required Field
                        </label>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="form-check form-switch">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id={`critical-${item.id}`}
                          checked={item.critical_ok}
                          onChange={(e) => updateItem(type, item.id, { critical_ok: e.target.checked })}
                        />
                        <label className="form-check-label small" htmlFor={`critical-${item.id}`}>
                          <span className="badge bg-danger">Critical</span>
                          <small className="ms-1">(If NOT OK → Instrument Unavailable)</small>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="btn-group-vertical ms-2">
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setEditingItemId(isEditing ? null : item.id)}
                title={isEditing ? 'Collapse' : 'Expand'}
              >
                <i className={`bi bi-chevron-${isEditing ? 'up' : 'down'}`}></i>
              </button>
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={() => moveItem(type, item.id, 'up')}
                disabled={index === 0}
                title="Move Up"
              >
                <i className="bi bi-arrow-up"></i>
              </button>
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={() => moveItem(type, item.id, 'down')}
                disabled={index === items.length - 1}
                title="Move Down"
              >
                <i className="bi bi-arrow-down"></i>
              </button>
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={() => deleteItem(type, item.id)}
                title="Delete"
              >
                <i className="bi bi-trash"></i>
              </button>
            </div>
          </div>

          {/* Summary badges */}
          {!isEditing && (
            <div className="d-flex gap-2 flex-wrap">
              <span className="badge bg-secondary">{item.type}</span>
              {item.required && <span className="badge bg-info">Required</span>}
              {item.critical_ok && <span className="badge bg-danger">Critical</span>}
              {item.help_text && <span className="badge bg-light text-dark">{item.help_text}</span>}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="container-fluid mt-3">
      <div className="row">
        <div className="col-12">
          {/* Header */}
          <div className="card mb-3 border-0 shadow-sm">
            <div className="card-body">
              <h4 className="mb-1">
                <i className="bi bi-gear-fill me-2"></i>
                Configure Checklist
              </h4>
              <p className="text-muted mb-0">
                {instrumentName ? (
                  <>Custom checklist for <strong>{instrumentName}</strong></>
                ) : (
                  'Configure checklist items'
                )}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <ul className="nav nav-tabs mb-3">
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'initial' ? 'active' : ''}`}
                onClick={() => setActiveTab('initial')}
              >
                <i className="bi bi-play-circle me-2"></i>
                Initial Condition ({initialItems.length} items)
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'final' ? 'active' : ''}`}
                onClick={() => setActiveTab('final')}
              >
                <i className="bi bi-stop-circle me-2"></i>
                Final Condition ({finalItems.length} items)
              </button>
            </li>
          </ul>

          {/* Tab Content */}
          <div className="row">
            <div className="col-md-8">
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-light">
                  <div className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">
                      {activeTab === 'initial' ? 'Initial' : 'Final'} Checklist Items
                    </h5>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => addNewItem(activeTab)}
                    >
                      <i className="bi bi-plus-lg me-1"></i>
                      Add Item
                    </button>
                  </div>
                </div>
                <div className="card-body" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  {activeTab === 'initial' ? (
                    initialItems.length === 0 ? (
                      <div className="text-center text-muted py-5">
                        <i className="bi bi-inbox fs-1 d-block mb-3"></i>
                        <p>No initial checklist items yet</p>
                        <button
                          className="btn btn-primary"
                          onClick={() => addNewItem('initial')}
                        >
                          <i className="bi bi-plus-lg me-2"></i>
                          Add First Item
                        </button>
                      </div>
                    ) : (
                      initialItems.map((item, idx) => renderItemEditor(item, 'initial', idx))
                    )
                  ) : (
                    finalItems.length === 0 ? (
                      <div className="text-center text-muted py-5">
                        <i className="bi bi-inbox fs-1 d-block mb-3"></i>
                        <p>No final checklist items yet</p>
                        <button
                          className="btn btn-primary"
                          onClick={() => addNewItem('final')}
                        >
                          <i className="bi bi-plus-lg me-2"></i>
                          Add First Item
                        </button>
                      </div>
                    ) : (
                      finalItems.map((item, idx) => renderItemEditor(item, 'final', idx))
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Settings Panel */}
            <div className="col-md-4">
              <div className="card border-0 shadow-sm mb-3">
                <div className="card-header bg-warning text-dark">
                  <h6 className="mb-0">
                    <i className="bi bi-sliders me-2"></i>
                    Validation Settings
                  </h6>
                </div>
                <div className="card-body">
                  <div className="form-check form-switch mb-3">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="requireAllInitial"
                      checked={requireAllInitialOK}
                      onChange={(e) => setRequireAllInitialOK(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="requireAllInitial">
                      <strong>Require All Initial OK</strong>
                      <br />
                      <small className="text-muted">
                        If enabled, all initial items must be OK to start reading
                      </small>
                    </label>
                  </div>

                  <div className="form-check form-switch">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="requireAllFinal"
                      checked={requireAllFinalOK}
                      onChange={(e) => setRequireAllFinalOK(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="requireAllFinal">
                      <strong>Require All Final OK</strong>
                      <br />
                      <small className="text-muted">
                        If enabled, all final items must be OK to mark instrument as Available
                      </small>
                    </label>
                  </div>
                </div>
              </div>

              {/* Help Card */}
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-info text-white">
                  <h6 className="mb-0">
                    <i className="bi bi-question-circle me-2"></i>
                    Quick Guide
                  </h6>
                </div>
                <div className="card-body">
                  <small>
                    <strong>Input Types:</strong>
                    <ul className="mb-2">
                      <li><strong>Yes/No:</strong> Simple checkbox (OK/NOT OK)</li>
                      <li><strong>Free Text:</strong> User can type anything</li>
                      <li><strong>Number:</strong> Numeric input with optional min/max</li>
                    </ul>

                    <strong>Flags:</strong>
                    <ul className="mb-0">
                      <li><strong>Required:</strong> User must fill this field</li>
                      <li><strong>Critical:</strong> If NOT OK, instrument becomes Unavailable</li>
                    </ul>
                  </small>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="card mt-3 mb-3 border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <small className="text-muted">
                    <i className="bi bi-info-circle me-1"></i>
                    Initial: {initialItems.length} items • Final: {finalItems.length} items
                  </small>
                </div>
                <div className="d-flex gap-2">
                  <button
                    className="btn btn-secondary"
                    onClick={onCancel}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-success"
                    onClick={handleSave}
                    disabled={isSaving || (initialItems.length === 0 && finalItems.length === 0)}
                  >
                    {isSaving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle me-2"></i>
                        Save Configuration
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}