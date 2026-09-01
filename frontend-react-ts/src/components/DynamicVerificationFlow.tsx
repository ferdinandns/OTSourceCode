// DynamicVerificationFlow.tsx - Final Fixed Version with Correct Types

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import SidebarMenu from '../components/SidebarMenu';

// Component imports
import VerificationHeader from './VerificationHeader';
import ConnectionStatus from './ConnectionStatus';
import StepRenderer from './StepRenderer';
import VerificationStepper from './VerificationStepper';
import OverrideModal from './OverrideModal';

interface VerificationFlow {
    loading: boolean;
    error: string;
    verification: VerificationData | null;
    currentStepIndex: number;
    instrument: InstrumentDetail | null;
    connectionStatus: 'unknown' | 'checking' | 'ready' | 'failed' | 'not-required';
    connectionMessage: string;
    lastStepResult: any | null;
    showOverrideModal: boolean;
    overrideReason: string;
    overrideStepNumber: number | null;
}

interface VerificationData {
    verification_id: number;
    instrument_id: number;
    instrument_type: string;
    template_id: number;
    template_name: string;
    steps: StepInfo[];
    global_rules: any;
    requires_connection: boolean;
    connection_type: string;
    status: string;
    total_steps: number;
    required_steps: number;
    current_step_number: number;
    available_references: Record<string, any[]>;
}

interface StepInfo {
    step_number: number;
    step_name: string;
    step_type: string;
    description: string;
    required: boolean;
    status: string;
    depends_on: number[];
    reference_type?: string;
    input_type?: string;
    unit?: string;
    ui_component?: string;
    validation_rules?: any;
}

interface InstrumentDetail {
    instrument_id: number;
    instrument_type: string;
    no_kontrol: string;
    nama_instrument: string;
    status: string;
    configuration?: any;
}

const DynamicVerificationFlow: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const instrumentId = parseInt(id || '0');

    const [state, setState] = useState<VerificationFlow>({
        loading: true,
        error: '',
        verification: null,
        currentStepIndex: 0,
        instrument: null,
        connectionStatus: 'unknown',
        connectionMessage: '',
        lastStepResult: null,
        showOverrideModal: false,
        overrideReason: '',
        overrideStepNumber: null
    });

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [roomData, setRoomData] = useState({
        roomTemp: '',
        roomHumidity: ''
    });

    // Fetch instrument details
    useEffect(() => {
        fetchInstrumentDetail();
    }, [instrumentId]);

    // Check connection when instrument is loaded
    useEffect(() => {
        if (state.instrument && !state.verification) {
            checkInstrumentConnection();
        }
    }, [state.instrument]);

    const fetchInstrumentDetail = async () => {
        try {
            setState(prev => ({ ...prev, loading: true }));
            const response = await api.get(`/api/instruments/${instrumentId}`);
            const data = response.data.data;

            setState(prev => ({
                ...prev,
                instrument: {
                    instrument_id: data.id,
                    instrument_type: data.type,
                    no_kontrol: data.nomor_kontrol,
                    nama_instrument: data.nama_instrument,
                    status: data.status,
                    configuration: data.configuration,
                },
                loading: false
            }));
        } catch (err: any) {
            setState(prev => ({
                ...prev,
                error: err.response?.data?.message || 'Failed to fetch instrument',
                loading: false
            }));
        }
    };

    const checkInstrumentConnection = async () => {
        if (!needsConnection()) {
            setState(prev => ({
                ...prev,
                connectionStatus: 'not-required',
                connectionMessage: 'Manual input instrument - no connection required'
            }));
            return;
        }

        try {
            setState(prev => ({
                ...prev,
                connectionStatus: 'checking',
                connectionMessage: 'Checking instrument connection...'
            }));

            const response = await api.post(`/api/instruments/${instrumentId}/test-connection`, {
                instrument_id: instrumentId
            });

            if (response.data.data.success) {
                setState(prev => ({
                    ...prev,
                    connectionStatus: 'ready',
                    connectionMessage: response.data.data.message || 'Instrument ready'
                }));
            } else {
                setState(prev => ({
                    ...prev,
                    connectionStatus: 'failed',
                    connectionMessage: response.data.data.message || 'Connection test failed'
                }));
            }
        } catch (err: any) {
            setState(prev => ({
                ...prev,
                connectionStatus: 'failed',
                connectionMessage: err.response?.data?.message || 'Failed to connect to instrument'
            }));
        }
    };

    const needsConnection = (): boolean => {
        return !!(state.instrument?.configuration?.com_port || state.instrument?.configuration?.ip_address);
    };

    const handleStartVerification = async () => {
        if (!roomData.roomTemp || !roomData.roomHumidity) {
            setState(prev => ({ ...prev, error: 'Room temperature and humidity are required' }));
            return;
        }

        try {
            setState(prev => ({ ...prev, loading: true }));
            const response = await api.post('/api/verifications/start', {
                instrument_id: instrumentId,
                room_temp: parseFloat(roomData.roomTemp),
                room_humidity: parseFloat(roomData.roomHumidity)
            });

            setState(prev => ({
                ...prev,
                verification: response.data.data,
                loading: false,
                error: ''
            }));
        } catch (err: any) {
            setState(prev => ({
                ...prev,
                error: err.response?.data?.message || 'Failed to start verification',
                loading: false
            }));
        }
    };

    const handleExecuteStep = async (stepNumber: number, inputData: any) => {
        try {
            setState(prev => ({ ...prev, loading: true }));

            const response = await api.post('/api/verifications/execute-step', {
                verification_id: state.verification?.verification_id,
                step_number: stepNumber,
                step_type: getCurrentStep()?.step_type,
                input_data: inputData,
                reference_id: inputData.reference_id,
                auto_read: true
            });

            const result = response.data.data;

            // ✅ Handle Waiting Bridge
            if (result.status === 'Waiting Bridge') {
                setState(prev => ({
                    ...prev,
                    lastStepResult: result,
                    loading: false
                }));
                startProgressPolling(state.verification!.verification_id);
                return result;
            }

            setState(prev => ({
                ...prev,
                lastStepResult: result,
                loading: false
            }));

            await fetchVerificationProgress();
            return result;

        } catch (err: any) {
            setState(prev => ({
                ...prev,
                error: err.response?.data?.message || 'Failed to execute step',
                loading: false
            }));
            throw err;
        }
    };

    const startProgressPolling = (verificationId: number) => {
        // Capture snapshot verification untuk spread nanti
        const snapshotVerification = state.verification;
        if (!snapshotVerification) return;

        const pollInterval = setInterval(async () => {
            try {
                const progressRes = await api.get(
                    `/api/verifications/${verificationId}/progress`
                );
                const freshSteps = progressRes.data.data.steps;

                const stillWaiting = freshSteps.find(
                    (s: any) => s.status === 'Waiting Bridge'
                );

                if (!stillWaiting) {
                    clearInterval(pollInterval);
                    setState(prev => ({
                        ...prev,
                        verification: prev.verification
                            ? { ...prev.verification, steps: freshSteps }
                            : prev.verification,
                        lastStepResult: prev.lastStepResult
                            ? { ...prev.lastStepResult, status: 'done' }
                            : prev.lastStepResult
                    }));
                }
            } catch (err) {
                console.error('Polling error:', err);
                clearInterval(pollInterval);
            }
        }, 2000);

        // Auto-cleanup setelah 5 menit
        setTimeout(() => {
            clearInterval(pollInterval);
            setState(prev => ({
                ...prev,
                error: 'Instrument read timeout. Please trigger the instrument and try again.',
                loading: false
            }));
        }, 5 * 60 * 1000);
    };

    const handleContinueAfterResult = () => {
        if (!state.verification || !state.lastStepResult) return;

        const nextStepNumber = state.lastStepResult.next_step_number;
        const steps = state.verification.steps;
        const verificationId = state.verification.verification_id;
        const isVerificationCompleted = state.lastStepResult.verification_completed;

        // ✅ All steps done OR backend signals completion → show summary then navigate
        const allStepsCompleted = steps.every(
            s => s.status === 'Completed' || s.status === 'Complies' || s.status === 'Not Complies'
        );

        if (isVerificationCompleted || !nextStepNumber || allStepsCompleted) {
            const verificationId = state.verification.verification_id;

            setState(prev => ({ ...prev, lastStepResult: null, loading: true }));
            api.post(`/api/verifications/${verificationId}/complete`, { notes: '' })
                .then(() => {
                    navigate(`/instruments/${instrumentId}`);
                })
                .catch(err => {
                    console.error('Complete verification error:', err);
                    // Still navigate to detail even on error
                    navigate(`/instruments/${instrumentId}`);
                })
                .finally(() => {
                    setState(prev => ({ ...prev, loading: false }));
                });
            return;
        }

        // Navigate to next step
        const nextStepIndex = steps.findIndex(s => s.step_number === nextStepNumber);
        setState(prev => ({
            ...prev,
            lastStepResult: null,
            currentStepIndex: nextStepIndex >= 0 ? nextStepIndex : prev.currentStepIndex + 1
        }));
    };

    const handleShowOverride = () => {
        setState(prev => ({
            ...prev,
            showOverrideModal: true,
            overrideStepNumber: state.lastStepResult?.step_number || null
        }));
    };

    const handleSubmitOverride = async (action: 'continue' | 'breakdown') => {
        if (!state.verification || !state.overrideStepNumber || !state.overrideReason) {
            setState(prev => ({ ...prev, error: 'Override reason is required' }));
            return;
        }

        try {
            setState(prev => ({ ...prev, loading: true }));

            if (action === 'breakdown') {
                // 1. Mark the step as Failed
                await api.post('/api/verifications/execute-step', {
                    verification_id: state.verification.verification_id,
                    step_number: state.overrideStepNumber,
                    step_type: 'auto_read',
                    input_data: {
                        action: 'breakdown',
                        override_reason: state.overrideReason,
                        force_status: 'Failed'
                    },
                    skip_validation: true
                });

                // 2. Complete the verification so DB writes "Not Complies" (not left as "In Progress")
                await api.post(
                    `/api/verifications/${state.verification.verification_id}/complete`,
                    { notes: `Instrument breakdown: ${state.overrideReason}` }
                ).catch(console.error);

                // 3. Mark instrument Unavailable via correct method (PUT not PATCH)
                await api.put(`/api/instruments/${state.verification.instrument_id}`, {
                    status: 'Unavailable'
                }).catch(console.error);

                alert('Instrument marked as Unavailable. Verification recorded as Not Complies.');
                navigate(`/instruments/${instrumentId}`);
            } else {
                await api.post('/api/verifications/execute-step', {
                    verification_id: state.verification.verification_id,
                    step_number: state.overrideStepNumber,
                    step_type: 'auto_read',
                    input_data: {
                        action: 'continue',
                        override_reason: state.overrideReason,
                        force_status: 'Completed'
                    },
                    skip_validation: true
                });

                setState(prev => ({
                    ...prev,
                    showOverrideModal: false,
                    overrideReason: '',
                    overrideStepNumber: null,
                    lastStepResult: null,
                    loading: false
                }));

                await fetchVerificationProgress();

                const nextStepIndex = state.currentStepIndex + 1;
                if (nextStepIndex < state.verification.steps.length) {
                    setState(prev => ({ ...prev, currentStepIndex: nextStepIndex }));
                } else {
                    // ✅ FIX: Last step overridden → complete and navigate to instrument page
                    await api.post(
                        `/api/verifications/${state.verification.verification_id}/complete`,
                        { notes: state.overrideReason }
                    ).catch(console.error);
                    navigate(`/instruments/${instrumentId}`);
                }
            }

        } catch (err: any) {
            console.error('Override error:', err);
            setState(prev => ({
                ...prev,
                error: err.response?.data?.message || 'Failed to process override',
                loading: false
            }));
        }
    };

    const fetchVerificationProgress = async () => {
        if (!state.verification) return;

        try {
            const response = await api.get(
                `/api/verifications/${state.verification.verification_id}/progress`
            );

            setState(prev => ({
                ...prev,
                verification: {
                    ...prev.verification!,
                    steps: response.data.data.steps.map((s: any) => ({
                        step_number: s.step_number,
                        step_name: s.step_name,
                        step_type: s.step_type,
                        description: s.description,
                        required: s.required,
                        status: s.status,
                        depends_on: s.depends_on || [],
                        reference_type: s.reference_type,
                        input_type: s.input_type,
                        unit: s.unit,
                        ui_component: s.ui_component,
                        measured_value: s.measured_value,
                        expected_value: s.expected_value,
                        min_value: s.min_value,
                        max_value: s.max_value,
                        readings: s.readings,
                        validation_msg: s.validation_msg,
                        reference_id: s.reference_id,
                        validation_rules: s.validation_rules
                    }))
                }
            }));
        } catch (err) {
            console.error('Failed to fetch progress:', err);
        }
    };

    const handleCancelVerification = async () => {
        if (!state.verification) return;

        const confirmMessage = `Are you sure you want to cancel this verification?

Instrument: ${state.instrument?.nama_instrument}
Template: ${state.verification.template_name}
Progress: ${state.verification.steps.filter(s => s.status === 'Completed').length}/${state.verification.total_steps} steps completed

This action cannot be undone.`;

        if (window.confirm(confirmMessage)) {
            try {
                setState(prev => ({ ...prev, loading: true }));
                await api.post(`/api/verifications/${state.verification.verification_id}/cancel`);

                alert('Verification cancelled successfully');
                navigate('/verifications');
            } catch (err: any) {
                setState(prev => ({
                    ...prev,
                    error: err.response?.data?.message || 'Failed to cancel verification',
                    loading: false
                }));
            }
        }
    };

    const getCurrentStep = (): StepInfo | null => {
        if (!state.verification) return null;
        return state.verification.steps[state.currentStepIndex] || null;
    };

    const canStartVerification = (): boolean => {
        return (
            !!roomData.roomTemp &&
            !!roomData.roomHumidity &&
            (!needsConnection() || state.connectionStatus === 'ready')
        );
    };

    if (state.loading && !state.instrument) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ height: '70vh' }}>
                <div className="text-center">
                    <div className="spinner-border text-primary mb-3" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="text-muted">Loading instrument...</p>
                </div>
            </div>
        );
    }

    if (!state.instrument) {
        return (
            <div className="container mt-3">
                <div className="alert alert-danger">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    Instrument not found
                </div>
                <button className="btn btn-secondary" onClick={() => navigate('/verifications')}>
                    <i className="bi bi-arrow-left me-2"></i>
                    Back to List
                </button>
            </div>
        );
    }

    const currentStep = getCurrentStep();

    return (
        <div className="container-fluid mt-3 mb-4">
            <SidebarMenu
                isHorizontal={false}
                isSidebarOpen={isSidebarOpen}
                toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            />

            <div className="container" style={{ maxWidth: '1000px' }}>
                <div className="card border-0 shadow-sm">
                    <div className="card-body p-4">
                        <VerificationHeader
                            instrument={state.instrument}
                            verification={state.verification}
                            onCancel={handleCancelVerification}
                            onBack={() => navigate('/verifications')}
                        />

                        {state.error && (
                            <div className="alert alert-danger alert-dismissible fade show">
                                <i className="bi bi-exclamation-circle me-2"></i>
                                {state.error}
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setState(prev => ({ ...prev, error: '' }))}
                                ></button>
                            </div>
                        )}

                        {!state.verification ? (
                            // Initial Form
                            <div>
                                <ConnectionStatus
                                    instrument={state.instrument}
                                    status={state.connectionStatus}
                                    message={state.connectionMessage}
                                    onRetry={checkInstrumentConnection}
                                />

                                <div className="mt-4">
                                    <h5 className="mb-3">Environmental Conditions</h5>
                                    <div className="row g-3">
                                        <div className="col-md-6">
                                            <label className="form-label">Room Temperature (°C) *</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                className="form-control"
                                                value={roomData.roomTemp}
                                                onChange={(e) => setRoomData(prev => ({
                                                    ...prev,
                                                    roomTemp: e.target.value
                                                }))}
                                            />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label">Room Humidity (%) *</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                className="form-control"
                                                value={roomData.roomHumidity}
                                                onChange={(e) => setRoomData(prev => ({
                                                    ...prev,
                                                    roomHumidity: e.target.value
                                                }))}
                                            />
                                        </div>
                                    </div>

                                    <button
                                        className="btn btn-primary btn-lg mt-4"
                                        onClick={handleStartVerification}
                                        disabled={!canStartVerification() || state.loading}
                                    >
                                        {state.loading ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2"></span>
                                                Starting...
                                            </>
                                        ) : (
                                            <>
                                                <i className="bi bi-play-circle me-2"></i>
                                                Start Verification
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            // Verification Flow
                            <div>
                                <VerificationStepper
                                    steps={state.verification.steps}
                                    currentStepIndex={state.currentStepIndex}
                                    onStepClick={(index) => {
                                        const step = state.verification!.steps[index];
                                        if (step.status === 'Completed' || step.status === 'Ready') {
                                            setState(prev => ({
                                                ...prev,
                                                currentStepIndex: index,
                                                lastStepResult: null
                                            }));
                                        }
                                    }}
                                />

                                <div className="mt-4">
                                    {currentStep && (
                                        <StepRenderer
                                            step={currentStep}
                                            verification={state.verification}
                                            loading={state.loading}
                                            onExecute={handleExecuteStep}
                                            lastStepResult={state.lastStepResult}
                                            onContinueAfterResult={handleContinueAfterResult}
                                            onOverride={handleShowOverride}
                                        />
                                    )}
                                    
                                    {state.lastStepResult?.status === 'Waiting Bridge' && (
                                        <div className="alert alert-info d-flex align-items-center gap-3 mt-3">
                                            <div className="spinner-border spinner-border-sm text-info flex-shrink-0" />
                                            <div>
                                                <strong>Waiting for instrument reading...</strong>
                                                <div className="small text-muted mt-1">
                                                    Please trigger the instrument. Data will be received automatically via Bridge.
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Override Modal */}
            {state.showOverrideModal && currentStep && (
                <OverrideModal
                    show={state.showOverrideModal}
                    loading={state.loading}
                    step={currentStep}
                    measuredValue={state.lastStepResult?.measured_value || null}
                    selectedReference={state.lastStepResult?.reference_id || null}
                    references={
                        currentStep.reference_type && state.verification
                            ? state.verification.available_references[currentStep.reference_type] || []
                            : []
                    }
                    minRange={state.lastStepResult?.min_range || null}
                    maxRange={state.lastStepResult?.max_range || null}
                    overrideReason={state.overrideReason}
                    onReasonChange={(reason) => setState(prev => ({ ...prev, overrideReason: reason }))}
                    onClose={() => setState(prev => ({
                        ...prev,
                        showOverrideModal: false,
                        overrideReason: ''
                    }))}
                    onOverride={handleSubmitOverride}
                />
            )}
        </div>
    );
};

export default DynamicVerificationFlow;