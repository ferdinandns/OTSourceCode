import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import SidebarMenu from '../../components/SidebarMenu';

// -------------------------------------------------------
// Types — mirror the backend StepConfigDTO / TemplateDetailResponse
// -------------------------------------------------------
interface ValidationRules {
    [key: string]: number | string | boolean;
}

interface StepMetadata {
    [key: string]: string | number | boolean | number[];
}

interface TemplateStep {
    step_number: number;
    step_name: string;
    step_type: string;
    description: string;
    required: boolean;
    input_type?: string;
    unit?: string;
    validation_rules?: ValidationRules;
    depends_on?: number[];
    reference_type?: string;
    reading_count?: number;
    calculation_expr?: string;
    ui_component?: string;
    metadata?: StepMetadata;
}

interface TemplateDetail {
    id: number;
    template_name: string;
    instrument_type: string;
    description: string;
    version: number;
    steps: TemplateStep[];
    requires_connection: boolean;
    auto_complete_on_success: boolean;
    allow_partial_completion: boolean;
    is_active: boolean;
    is_default: boolean;
}

interface InstrumentTemplateAssignment {
    instrument_id: number;
    no_kontrol: string;
    instrument_name: string;
    template_id: number;
    template_name: string;
}

// -------------------------------------------------------
// Step type labels & colors
// -------------------------------------------------------
const STEP_TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
    auto_read: { label: 'Auto Read', color: 'primary', icon: 'bi-cpu' },
    manual_input: { label: 'Manual Input', color: 'success', icon: 'bi-keyboard' },
    selection: { label: 'Selection', color: 'info', icon: 'bi-list-check' },
    multi_reading: { label: 'Multi Reading', color: 'warning', icon: 'bi-bar-chart' },
    calculation: { label: 'Calculation', color: 'danger', icon: 'bi-calculator' },
};

const getStepTypeMeta = (type: string) =>
    STEP_TYPE_META[type] ?? { label: type, color: 'secondary', icon: 'bi-question-circle' };

// -------------------------------------------------------
// Main Component
// -------------------------------------------------------
const EditVerificationSteps: React.FC = () => {
    const navigate = useNavigate();
    const { instrumentType } = useParams<{ instrumentType: string }>();
    const decodedType = decodeURIComponent(instrumentType ?? '');

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [template, setTemplate] = useState<TemplateDetail | null>(null);
    const [steps, setSteps] = useState<TemplateStep[]>([]);

    const dragIndex = React.useRef<number | null>(null);
    const [dragOver, setDragOver] = useState<number | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError('');
            const res = await api.get(`/api/verification-templates`, {
                params: { instrument_type: decodedType, active_only: true }
            });
            const templates = res.data.data ?? [];

            if (!Array.isArray(templates) || templates.length === 0) {
                // No template for this type yet — valid empty state, not an error
                setTemplate(null);
                setSteps([]);
                setLoading(false);
                return;
            }

            const tmpl = templates.find((t: any) => t.is_default) ?? templates[0];
            const detail = await api.get(`/api/verification-templates/${tmpl.id}`);
            setTemplate(detail.data.data);
            setSteps(detail.data.data.steps ?? []);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load template');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!decodedType) {
            setError('Invalid instrument type — please navigate here from the instrument list.');
            setLoading(false);
            return;
        }
        fetchData();
    }, [decodedType]);
    // -------------------------------------------------------
    // Save: PUT /api/verification-templates/:templateId
    // -------------------------------------------------------
    const handleSave = async () => {
        try {
            setSaving(true);
            setError('');

            const renumbered = steps.map((s, i) => ({ ...s, step_number: i + 1 }));

            if (template) {
                // Update existing template
                await api.put(`/api/verification-templates/${template.id}`, {
                    steps: renumbered,
                });
            } else {
                // No template exists for this type yet — create one
                await api.post(`/api/verification-templates`, {
                    template_name: `${decodedType} Verification`,
                    instrument_type: decodedType,
                    steps: renumbered,
                    is_default: true,
                    is_active: true,        // ← add this
                    requires_connection: false,
                    global_rules: { allow_override: true, require_override_reason: true },
                });
            }

            // Refresh so version bump and any backend changes are reflected
            await fetchData();

            setSuccess('Template steps saved successfully!');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to save template');
        } finally {
            setSaving(false);
        }
    };

    // -------------------------------------------------------
    // Step CRUD helpers
    // -------------------------------------------------------
    const updateStep = (index: number, patch: Partial<TemplateStep>) => {
        setSteps(prev => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
    };

    const deleteStep = (index: number) => {
        setSteps(prev => {
            const next = prev.filter((_, i) => i !== index);
            return next.map((s, i) => ({ ...s, step_number: i + 1 }));
        });
    };

    const moveStep = (index: number, direction: 'up' | 'down') => {
        setSteps(prev => {
            const next = [...prev];
            const target = direction === 'up' ? index - 1 : index + 1;
            if (target < 0 || target >= next.length) return prev;
            [next[index], next[target]] = [next[target], next[index]];
            return next.map((s, i) => ({ ...s, step_number: i + 1 }));
        });
    };

    const addStep = () => {
        const newStep: TemplateStep = {
            step_number: steps.length + 1,
            step_name: 'New Step',
            step_type: 'manual_input',
            description: '',
            required: true,
            input_type: 'checkbox',
            unit: '',
            validation_rules: {},
            depends_on: [],
            metadata: {},
        };
        setSteps(prev => [...prev, newStep]);
    };

    // -------------------------------------------------------
    // Drag & drop
    // -------------------------------------------------------
    const handleDragStart = (index: number) => { dragIndex.current = index; };
    const handleDragOver = (e: React.DragEvent, index: number) => { e.preventDefault(); setDragOver(index); };
    const handleDrop = (dropIndex: number) => {
        const from = dragIndex.current;
        if (from === null || from === dropIndex) { setDragOver(null); return; }
        setSteps(prev => {
            const next = [...prev];
            const [moved] = next.splice(from, 1);
            next.splice(dropIndex, 0, moved);
            return next.map((s, i) => ({ ...s, step_number: i + 1 }));
        });
        dragIndex.current = null;
        setDragOver(null);
    };
    const handleDragEnd = () => { dragIndex.current = null; setDragOver(null); };

    // -------------------------------------------------------
    // Render: loading
    // -------------------------------------------------------
    if (loading) {
        return (
            <div className="container-fluid mt-3">
                <div className="d-flex justify-content-center align-items-center" style={{ height: '70vh' }}>
                    <div className="text-center">
                        <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
                            <span className="visually-hidden">Loading...</span>
                        </div>
                        <p className="text-muted">Loading template steps...</p>
                    </div>
                </div>
            </div>
        );
    }

    // -------------------------------------------------------
    // Render: main
    // -------------------------------------------------------
    return (
        <div className="container-fluid mt-3 mb-5">
            <SidebarMenu
                isHorizontal={false}
                isSidebarOpen={isSidebarOpen}
                toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            />

            <div className="container" style={{ maxWidth: '900px' }}>

                {/* ── Header ── */}
                <div className="d-flex align-items-center gap-3 mb-4">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="btn btn-link text-dark p-0"
                        style={{ fontSize: '1.75rem' }}
                    >
                        <i className="bi bi-list"></i>
                    </button>
                    <div className="flex-grow-1">
                        <h4 className="fw-bold mb-0">
                            <i className="bi bi-pencil-square text-primary me-2"></i>
                            Edit Verification Steps
                        </h4>
                        <small className="text-muted">
                            Editing template for: <strong>{decodedType}</strong>
                        </small>
                    </div>
                    <button onClick={() => navigate(-1)} className="btn btn-outline-secondary btn-sm">
                        <i className="bi bi-arrow-left me-1"></i>Back
                    </button>
                </div>

                {/* ── Alerts ── */}
                {error && (
                    <div className="alert alert-danger alert-dismissible fade show" role="alert">
                        <i className="bi bi-exclamation-triangle-fill me-2"></i>
                        {error}
                        <button type="button" className="btn-close" onClick={() => setError('')}></button>
                    </div>
                )}
                {success && (
                    <div className="alert alert-success fade show" role="alert">
                        <i className="bi bi-check-circle-fill me-2"></i>
                        {success}
                    </div>
                )}

                {/* ── Template info banner ── */}
                {template && (
                    <div className="card border-0 shadow-sm mb-4 bg-light">
                        <div className="card-body py-2 px-3">
                            <div className="d-flex align-items-center gap-3 flex-wrap">
                                <div>
                                    <span className="text-muted small">Template:</span>{' '}
                                    <strong>{template.template_name}</strong>
                                </div>
                                <div>
                                    <span className="text-muted small">Type:</span>{' '}
                                    <span className="badge bg-secondary">{template.instrument_type}</span>
                                </div>
                                <div>
                                    <span className="text-muted small">Version:</span>{' '}
                                    <span className="badge bg-light text-dark border">v{template.version}</span>
                                </div>
                                {template.is_default && (
                                    <span className="badge bg-warning text-dark">
                                        <i className="bi bi-star-fill me-1"></i>Default
                                    </span>
                                )}
                                <div className="ms-auto">
                                    <small className="text-muted">
                                        <i className="bi bi-info-circle me-1"></i>
                                        Saving will increment the template version.
                                    </small>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── No template assigned ── */}
                {!template && !error && (
                    <div className="card border-0 shadow-sm mb-4">
                        <div className="card-header bg-transparent border-0 pt-3 pb-0 d-flex align-items-center justify-content-between">
                            <div>
                                <h6 className="fw-semibold mb-0">
                                    <i className="bi bi-list-ol text-primary me-2"></i>
                                    Verification Steps
                                </h6>
                                <small className="text-muted">
                                    No template exists for <strong>{decodedType}</strong> yet. Add steps and save to create one.
                                </small>
                            </div>
                            <button className="btn btn-sm btn-primary" onClick={addStep}>
                                <i className="bi bi-plus-lg me-1"></i>Add Step
                            </button>
                        </div>
                        <div className="card-body">
                            {steps.length === 0 ? (
                                <div className="text-center text-muted py-4 border border-dashed rounded">
                                    <i className="bi bi-clipboard-plus d-block mb-2" style={{ fontSize: '2.5rem' }}></i>
                                    <p className="mb-0">No steps yet.</p>
                                    <small>Click "Add Step" to create the first step for this instrument type.</small>
                                </div>
                            ) : (
                                <div className="d-flex flex-column gap-2">
                                    {steps.map((step, index) => (
                                        <StepCard
                                            key={`${step.step_number}-${index}`}
                                            step={step}
                                            index={index}
                                            total={steps.length}
                                            isDragOver={dragOver === index}
                                            onUpdate={(patch) => updateStep(index, patch)}
                                            onDelete={() => deleteStep(index)}
                                            onMove={(dir) => moveStep(index, dir)}
                                            onDragStart={() => handleDragStart(index)}
                                            onDragOver={(e) => handleDragOver(e, index)}
                                            onDrop={() => handleDrop(index)}
                                            onDragEnd={handleDragEnd}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Steps editor ── */}
                {template && (
                    <div className="card border-0 shadow-sm mb-4">
                        <div className="card-header bg-transparent border-0 pt-3 pb-0 d-flex align-items-center justify-content-between">
                            <div>
                                <h6 className="fw-semibold mb-0">
                                    <i className="bi bi-list-ol text-primary me-2"></i>
                                    Verification Steps
                                </h6>
                                <small className="text-muted">
                                    Drag rows to reorder. Double-click a name to rename it.
                                </small>
                            </div>
                            <button className="btn btn-sm btn-primary" onClick={addStep}>
                                <i className="bi bi-plus-lg me-1"></i>Add Step
                            </button>
                        </div>
                        <div className="card-body">
                            {steps.length === 0 ? (
                                <div className="text-center text-muted py-4 border border-dashed rounded">
                                    <i className="bi bi-clipboard-plus d-block mb-2" style={{ fontSize: '2.5rem' }}></i>
                                    <p className="mb-0">No steps yet.</p>
                                    <small>Click "Add Step" to create one.</small>
                                </div>
                            ) : (
                                <div className="d-flex flex-column gap-2">
                                    {steps.map((step, index) => (
                                        <StepCard
                                            key={`${step.step_number}-${index}`}
                                            step={step}
                                            index={index}
                                            total={steps.length}
                                            isDragOver={dragOver === index}
                                            onUpdate={(patch) => updateStep(index, patch)}
                                            onDelete={() => deleteStep(index)}
                                            onMove={(dir) => moveStep(index, dir)}
                                            onDragStart={() => handleDragStart(index)}
                                            onDragOver={(e) => handleDragOver(e, index)}
                                            onDrop={() => handleDrop(index)}
                                            onDragEnd={handleDragEnd}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Save bar ── */}
                {!error && (
                    <div className="d-flex justify-content-end gap-2">
                        <button className="btn btn-outline-secondary" onClick={() => navigate(-1)}>
                            Batal
                        </button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving || steps.length === 0}>
                            {saving ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                    Menyimpan...
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-floppy me-2"></i>
                                    {template ? 'Simpan Template' : 'Buat Template Baru'}
                                </>
                            )}
                        </button>
                    </div>
                )}

            </div>

            <style>{`
        .border-dashed { border-style: dashed !important; }
        .step-card { transition: box-shadow 0.15s; }
        .step-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
      `}</style>
        </div>
    );
};

// -------------------------------------------------------
// StepCard — expandable row for each template step
// -------------------------------------------------------
interface StepCardProps {
    step: TemplateStep;
    index: number;
    total: number;
    isDragOver: boolean;
    onUpdate: (patch: Partial<TemplateStep>) => void;
    onDelete: () => void;
    onMove: (dir: 'up' | 'down') => void;
    onDragStart: () => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: () => void;
    onDragEnd: () => void;
}

const StepCard: React.FC<StepCardProps> = ({
    step, index, total, isDragOver,
    onUpdate, onDelete, onMove,
    onDragStart, onDragOver, onDrop, onDragEnd,
}) => {
    const [expanded, setExpanded] = useState(false);
    const [editingName, setEditingName] = useState(false);
    const [nameDraft, setNameDraft] = useState(step.step_name);
    const meta = getStepTypeMeta(step.step_type);

    const commitName = () => {
        const trimmed = nameDraft.trim();
        if (trimmed) onUpdate({ step_name: trimmed });
        else setNameDraft(step.step_name);
        setEditingName(false);
    };

    // Parse validation_rules for display/editing
    const validationStr = step.validation_rules
        ? JSON.stringify(step.validation_rules, null, 2)
        : '{}';

    const handleValidationChange = (raw: string) => {
        try {
            const parsed = JSON.parse(raw);
            onUpdate({ validation_rules: parsed });
        } catch {
            // don't update on invalid JSON
        }
    };

    const dependsOnStr = (step.depends_on ?? []).join(', ');
    const handleDependsOnChange = (val: string) => {
        const nums = val.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
        onUpdate({ depends_on: nums });
    };

    return (
        <div
            className={`card step-card border ${isDragOver ? 'border-primary border-2 bg-light' : 'border-light'}`}
            draggable
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            style={{ cursor: 'grab' }}
        >
            {/* ── Card header row ── */}
            <div className="card-body py-2 px-3">
                <div className="d-flex align-items-center gap-2">
                    {/* Drag handle */}
                    <i className="bi bi-grip-vertical text-muted flex-shrink-0" style={{ cursor: 'grab' }}></i>

                    {/* Step number badge */}
                    <span className="badge bg-primary rounded-pill flex-shrink-0" style={{ minWidth: '28px' }}>
                        {index + 1}
                    </span>

                    {/* Step type badge */}
                    <span className={`badge bg-${meta.color} bg-opacity-10 text-${meta.color} border border-${meta.color} flex-shrink-0`}
                        style={{ fontSize: '0.7rem' }}>
                        <i className={`bi ${meta.icon} me-1`}></i>
                        {meta.label}
                    </span>

                    {/* Step name — inline editable */}
                    {editingName ? (
                        <input
                            autoFocus
                            className="form-control form-control-sm flex-grow-1"
                            value={nameDraft}
                            maxLength={100}
                            onChange={e => setNameDraft(e.target.value)}
                            onBlur={commitName}
                            onKeyDown={e => {
                                if (e.key === 'Enter') commitName();
                                if (e.key === 'Escape') { setNameDraft(step.step_name); setEditingName(false); }
                            }}
                            onClick={e => e.stopPropagation()}
                        />
                    ) : (
                        <span
                            className="fw-semibold flex-grow-1 small"
                            style={{ cursor: 'text' }}
                            onDoubleClick={e => { e.stopPropagation(); setEditingName(true); }}
                            title="Double-click to rename"
                        >
                            {step.step_name}
                            {step.required && (
                                <span className="text-danger ms-1" title="Required">*</span>
                            )}
                        </span>
                    )}

                    {/* Depends on indicator */}
                    {(step.depends_on ?? []).length > 0 && (
                        <span className="badge bg-light text-muted border flex-shrink-0" style={{ fontSize: '0.65rem' }}>
                            <i className="bi bi-arrow-return-right me-1"></i>
                            after {(step.depends_on ?? []).join(', ')}
                        </span>
                    )}

                    {/* Controls */}
                    <div className="d-flex gap-1 flex-shrink-0 ms-1" onClick={e => e.stopPropagation()}>
                        <button
                            className="btn btn-xs btn-outline-secondary"
                            style={{ padding: '0.1rem 0.35rem', fontSize: '0.7rem' }}
                            onClick={() => onMove('up')} disabled={index === 0} title="Move up"
                        >
                            <i className="bi bi-chevron-up"></i>
                        </button>
                        <button
                            className="btn btn-xs btn-outline-secondary"
                            style={{ padding: '0.1rem 0.35rem', fontSize: '0.7rem' }}
                            onClick={() => onMove('down')} disabled={index === total - 1} title="Move down"
                        >
                            <i className="bi bi-chevron-down"></i>
                        </button>
                        <button
                            className="btn btn-xs btn-outline-primary"
                            style={{ padding: '0.1rem 0.35rem', fontSize: '0.7rem' }}
                            onClick={() => setExpanded(v => !v)}
                            title={expanded ? 'Collapse' : 'Expand'}
                        >
                            <i className={`bi bi-chevron-${expanded ? 'up' : 'down'}-circle`}></i>
                        </button>
                        <button
                            className="btn btn-xs btn-outline-danger"
                            style={{ padding: '0.1rem 0.35rem', fontSize: '0.7rem' }}
                            onClick={onDelete} title="Delete step"
                        >
                            <i className="bi bi-trash"></i>
                        </button>
                    </div>
                </div>

                {/* ── Expanded detail editor ── */}
                {expanded && (
                    <div className="mt-3 border-top pt-3" onClick={e => e.stopPropagation()}>
                        <div className="row g-2">

                            {/* Step Type */}
                            <div className="col-md-4">
                                <label className="form-label small fw-semibold mb-1">Step Type</label>
                                <select
                                    className="form-select form-select-sm"
                                    value={step.step_type}
                                    onChange={e => onUpdate({ step_type: e.target.value })}
                                >
                                    {Object.entries(STEP_TYPE_META).map(([val, { label }]) => (
                                        <option key={val} value={val}>{label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Input Type — dropdown */}
                            <div className="col-md-4">
                                <label className="form-label small fw-semibold mb-1">
                                    Input Type
                                    <span className="text-muted fw-normal ms-1 small">(how user interacts)</span>
                                </label>
                                <select
                                    className="form-select form-select-sm"
                                    value={step.input_type ?? ''}
                                    onChange={e => onUpdate({ input_type: e.target.value })}
                                >
                                    <option value="">— none —</option>
                                    <option value="checkbox">Checkbox (confirm action)</option>
                                    <option value="number">Number (numeric entry)</option>
                                    <option value="text">Text (free text)</option>
                                    <option value="auto">Auto (instrument reads)</option>
                                </select>
                            </div>

                            {/* Unit */}
                            <div className="col-md-4">
                                <label className="form-label small fw-semibold mb-1">Unit</label>
                                <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={step.unit ?? ''}
                                    placeholder="e.g. g, pH, °C, %"
                                    onChange={e => onUpdate({ unit: e.target.value })}
                                />
                            </div>

                            {/* Description */}
                            <div className="col-12">
                                <label className="form-label small fw-semibold mb-1">Description</label>
                                <textarea
                                    className="form-control form-control-sm"
                                    rows={2}
                                    value={step.description}
                                    onChange={e => onUpdate({ description: e.target.value })}
                                />
                            </div>

                            {/* Reference Type — dropdown */}
                            <div className="col-md-6">
                                <label className="form-label small fw-semibold mb-1">
                                    Reference Type
                                    <span className="text-muted fw-normal ms-1 small">(standard used)</span>
                                </label>
                                <select
                                    className="form-select form-select-sm"
                                    value={step.reference_type ?? ''}
                                    onChange={e => onUpdate({ reference_type: e.target.value })}
                                >
                                    <option value="">— none —</option>
                                    <option value="anak_timbang">Anak Timbang (standard weight)</option>
                                    <option value="buffer_ph4">Buffer pH 4</option>
                                    <option value="buffer_ph7">Buffer pH 7</option>
                                    <option value="buffer_ph10">Buffer pH 10</option>
                                    <option value="certificate">Certificate / Sertifikat</option>
                                    <option value="thermometer">Thermometer reference</option>
                                </select>
                            </div>

                            {/* UI Component — dropdown */}
                            <div className="col-md-6">
                                <label className="form-label small fw-semibold mb-1">
                                    UI Component
                                    <span className="text-muted fw-normal ms-1 small">(frontend widget)</span>
                                </label>
                                <select
                                    className="form-select form-select-sm"
                                    value={step.ui_component ?? ''}
                                    onChange={e => onUpdate({ ui_component: e.target.value })}
                                >
                                    <option value="">— default —</option>
                                    <option value="ZeroVerificationStep">ZeroVerificationStep (zero check)</option>
                                    <option value="WeightVerificationStep">WeightVerificationStep (weight reading)</option>
                                    <option value="PHBufferStep">PHBufferStep (pH buffer placement)</option>
                                    <option value="PHReadingStep">PHReadingStep (pH batch read)</option>
                                    <option value="ManualCheckStep">ManualCheckStep (checkbox confirm)</option>
                                    <option value="NumericInputStep">NumericInputStep (number entry)</option>
                                    <option value="AutoReadStep">AutoReadStep (generic auto read)</option>
                                </select>
                            </div>

                            {/* Depends On */}
                            <div className="col-md-6">
                                <label className="form-label small fw-semibold mb-1">
                                    Depends On
                                    <span className="text-muted fw-normal ms-1">(comma-separated step numbers)</span>
                                </label>
                                <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={dependsOnStr}
                                    placeholder="e.g. 1, 2"
                                    onChange={e => handleDependsOnChange(e.target.value)}
                                />
                            </div>

                            {/* Required toggle */}
                            <div className="col-md-6 d-flex align-items-end">
                                <div className="form-check form-switch mb-0">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id={`required-${index}`}
                                        checked={step.required}
                                        onChange={e => onUpdate({ required: e.target.checked })}
                                    />
                                    <label className="form-check-label small" htmlFor={`required-${index}`}>
                                        Required step
                                    </label>
                                </div>
                            </div>

                            {/* Validation Rules — JSON editor */}
                            <div className="col-12">
                                <label className="form-label small fw-semibold mb-1">
                                    Validation Rules
                                    <span className="text-muted fw-normal ms-1">(JSON)</span>
                                </label>
                                <ValidationRulesEditor
                                    value={validationStr}
                                    onChange={handleValidationChange}
                                />
                            </div>

                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// -------------------------------------------------------
// ValidationRulesEditor — JSON textarea with live parse feedback
// -------------------------------------------------------
interface ValidationRulesEditorProps {
    value: string;
    onChange: (raw: string) => void;
}

const ValidationRulesEditor: React.FC<ValidationRulesEditorProps> = ({ value, onChange }) => {
    const [draft, setDraft] = useState(value);
    const [jsonError, setJsonError] = useState('');

    // Sync when parent value changes (e.g. on step switch)
    useEffect(() => { setDraft(value); setJsonError(''); }, [value]);

    const handleChange = (raw: string) => {
        setDraft(raw);
        try {
            JSON.parse(raw);
            setJsonError('');
            onChange(raw);
        } catch (e: any) {
            setJsonError(e.message);
        }
    };

    return (
        <>
            <textarea
                className={`form-control form-control-sm font-monospace ${jsonError ? 'is-invalid' : ''}`}
                rows={4}
                value={draft}
                onChange={e => handleChange(e.target.value)}
                spellCheck={false}
                style={{ fontSize: '0.75rem' }}
            />
            {jsonError && (
                <div className="invalid-feedback">{jsonError}</div>
            )}
            {!jsonError && draft !== '{}' && (
                <div className="form-text text-success">
                    <i className="bi bi-check-circle me-1"></i>Valid JSON
                </div>
            )}
        </>
    );
};

export default EditVerificationSteps;