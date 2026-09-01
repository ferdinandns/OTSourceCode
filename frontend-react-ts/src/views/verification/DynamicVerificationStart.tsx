import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SidebarMenu from '../../components/SidebarMenu';
import api from '../../services/api';

// Components
import VerificationHeader from '../../components/VerificationHeader';
import ConnectionStatus from '../../components/ConnectionStatus';
import VerificationStepper from '../../components/VerificationStepper';
import StepRenderer from '../../components/StepRenderer';
import OverrideModal from '../../components/OverrideModal';
import CancelModal from '../../components/CancelModal';

// Hooks
import { useDynamicVerificationState } from '../../hooks/verification/useDynamicVerificationState';
import { useDynamicVerificationActions } from '../../hooks/verification/useDynamicVerificationActions';

const DynamicVerificationStart: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const instrumentId = parseInt(id || '0');

    const { state, setters } = useDynamicVerificationState();
    const actions = useDynamicVerificationActions({ instrumentId, state, setters });

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const isVerificationInProgress = !!(state.verification && state.verification.status === 'In Progress');

    // Intercept browser back/forward button
    useEffect(() => {
        if (!isVerificationInProgress) return;

        // Push a dummy state so the back button triggers popstate instead of navigating
        window.history.pushState(null, '', window.location.pathname);

        const handlePopState = (e: PopStateEvent) => {
            // Re-push so the URL doesn't change
            window.history.pushState(null, '', window.location.pathname);
            setters.setShowCancelModal(true);
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [isVerificationInProgress]);

    // ============================================
    // EFFECTS
    // ============================================
    useEffect(() => {
        actions.fetchInstrumentDetail();
    }, [instrumentId]);

    useEffect(() => {
        if (!state.verification && state.instrument) {
            actions.checkInstrumentConnection();
        }
    }, [state.instrument]);

    // Prevent accidental browser close during verification
    useEffect(() => {
        const isVerificationInProgress = state.verification && state.verification.status === 'In Progress';

        if (!isVerificationInProgress) return;

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '';
            return '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [state.verification]);

    // ============================================
    // HANDLERS
    // ============================================
    const handleBackButton = () => {
        if (state.verification) {
            setters.setShowCancelModal(true);
        } else {
            navigate('/verifications');
        }
    };

    const handleStepClick = (index: number) => {
        const step = state.verification?.steps[index];
        if (step && actions.isStepAccessible(step.step_number)) {
            setters.setCurrentStepIndex(index);
        }
    };

    const handleExecuteStep = async (stepNumber: number, inputData: any) => {
        try {
            const result = await actions.executeStep(stepNumber, inputData);

            // ✅ Jangan proses apapun kalau masih nunggu bridge
            if (result?.status === 'Waiting Bridge') {
                return;
            }

            if (result?.needs_override) {
                setters.setShowOverrideModal(true, stepNumber);
            }

            if (result?.verification_completed) {
                setTimeout(() => {
                    navigate(`/instruments/${instrumentId}`);
                }, 1800);
            }
        } catch (error) {
            // Error already handled in actions
        }
    };

    // ============================================
    // RENDER
    // ============================================
    if (state.loading && !state.instrument) {
        return (
            <div className="container-fluid mt-3">
                <SidebarMenu
                    isHorizontal={false}
                    isSidebarOpen={isSidebarOpen}
                    toggleSidebar={toggleSidebar}
                />
                <div className="d-flex justify-content-center align-items-center" style={{ height: '70vh' }}>
                    <div className="text-center">
                        <div className="spinner-border text-primary mb-3" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                        <p className="text-muted">Loading instrument...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!state.instrument) {
        return (
            <div className="container-fluid mt-3">
                <SidebarMenu
                    isHorizontal={false}
                    isSidebarOpen={isSidebarOpen}
                    toggleSidebar={toggleSidebar}
                />
                <div className="container" style={{ maxWidth: '800px' }}>
                    <div className="alert alert-danger">
                        <i className="bi bi-exclamation-triangle me-2"></i>
                        Instrument not found
                    </div>
                    <button className="btn btn-secondary" onClick={() => navigate('/verifications')}>
                        <i className="bi bi-arrow-left me-2"></i>
                        Back to List
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid mt-3 mb-4">
            <SidebarMenu
                isHorizontal={false}
                isSidebarOpen={isSidebarOpen}
                toggleSidebar={toggleSidebar}
            />

            <div className="container" style={{ maxWidth: '1000px' }}>
                <div className="card border-0 shadow-sm">
                    <div className="card-body p-4">
                        {/* Header */}
                        <VerificationHeader
                            instrument={{
                                instrument_id: state.instrument.instrument_id,
                                instrument_type: state.instrument.instrument_type,
                                no_kontrol: state.instrument.no_kontrol,
                                nama_instrument: state.instrument.nama_instrument,
                                status: state.instrument.status,
                                configuration: state.instrument.configuration
                            }}
                            verification={state.verification ? {
                                verification_id: state.verification.verification_id,
                                instrument_id: state.verification.instrument_id,
                                instrument_type: state.verification.instrument_type,
                                template_id: state.verification.template_id,
                                template_name: state.verification.template_name,
                                steps: state.verification.steps,
                                global_rules: state.verification.global_rules,
                                requires_connection: state.verification.requires_connection,
                                connection_type: state.verification.connection_type,
                                status: state.verification.status,
                                total_steps: state.verification.total_steps,
                                required_steps: state.verification.required_steps,
                                current_step_number: state.verification.current_step_number,
                                available_references: state.verification.available_references
                            } : null}
                            onCancel={() => setters.setShowCancelModal(true)}
                            onBack={handleBackButton}
                        />

                        {/* Error Alert */}
                        {state.error && (
                            <div className="alert alert-danger alert-dismissible fade show">
                                <i className="bi bi-exclamation-circle me-2"></i>
                                {state.error}
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setters.setError('')}
                                ></button>
                            </div>
                        )}

                        {!state.verification ? (
                            // ========================================
                            // INITIAL FORM - Start Verification
                            // ========================================
                            <div>
                                <ConnectionStatus
                                    instrument={{
                                        instrument_id: state.instrument.instrument_id,
                                        instrument_type: state.instrument.instrument_type,
                                        no_kontrol: state.instrument.no_kontrol,
                                        nama_instrument: state.instrument.nama_instrument,
                                        status: state.instrument.status,
                                        configuration: state.instrument.configuration
                                    }}
                                    status={state.connectionStatus}
                                    message={state.connectionMessage}
                                    onRetry={actions.checkInstrumentConnection}
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
                                                value={state.roomTemp}
                                                onChange={(e) => setters.setRoomTemp(e.target.value)}
                                                placeholder="e.g., 25.0"
                                            />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label">Room Humidity (%) *</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                className="form-control"
                                                value={state.roomHumidity}
                                                onChange={(e) => setters.setRoomHumidity(e.target.value)}
                                                placeholder="e.g., 50.0"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        className="btn btn-primary btn-lg mt-4"
                                        onClick={actions.handleStartVerification}
                                        disabled={!actions.canStartVerification() || state.loading}
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
                            // ========================================
                            // VERIFICATION FLOW - Dynamic Steps
                            // ========================================
                            <div>
                                {/* Progress Stepper */}
                                <VerificationStepper
                                    steps={state.verification.steps}
                                    currentStepIndex={state.currentStepIndex}
                                    onStepClick={handleStepClick}
                                />

                                {/* Current Step Renderer */}
                                <div className="mt-4">
                                    {actions.getCurrentStep() && (
                                        <StepRenderer
                                            step={actions.getCurrentStep()!}
                                            verification={state.verification}
                                            loading={state.loading}
                                            onExecute={handleExecuteStep}
                                            lastStepResult={state.lastStepResult}   // ✅ ADD
                                            onContinueAfterResult={async () => {
                                                // Snapshot result before clearing — the setter is async
                                                const result = state.lastStepResult;
                                                setters.setLastStepResult(null);

                                                if (result?.verification_completed) {
                                                    actions.handleCompleteVerification();
                                                    return;
                                                }

                                                // ✅ BUG 1 FIX: Always prefer next_step_number from the
                                                // fresh backend response. Never rely on state.verification.steps
                                                // here — it may still be the pre-refresh snapshot, causing
                                                // step 2 (still "Pending" in stale state) to be skipped.
                                                if (result?.next_step_number != null) {
                                                    actions.advanceToNextStep(result.next_step_number);
                                                    return;
                                                }

                                                // Fallback: fetch a fresh progress snapshot then navigate.
                                                try {
                                                    const progressResponse = await api.get(
                                                        `/api/verifications/${state.verification!.verification_id}/progress`
                                                    );
                                                    const freshSteps = progressResponse.data.data.steps;
                                                    setters.setVerification({ ...state.verification!, steps: freshSteps });

                                                    const nextStep = freshSteps.find(
                                                        (s: any) => s.status === 'Ready' || s.status === 'Pending'
                                                    );
                                                    if (nextStep) {
                                                        const nextIndex = freshSteps.findIndex(
                                                            (s: any) => s.step_number === nextStep.step_number
                                                        );
                                                        setters.setCurrentStepIndex(nextIndex >= 0 ? nextIndex : 0);
                                                    } else {
                                                        actions.handleCompleteVerification();
                                                    }
                                                } catch {
                                                    actions.handleCompleteVerification();
                                                }
                                            }}

                                            onOverride={() => {                      // ✅ ADD (was missing too)
                                                const currentStep = actions.getCurrentStep();
                                                if (currentStep) {
                                                    setters.setShowOverrideModal(true, currentStep.step_number);
                                                }
                                            }}
                                        />
                                    )}

                                    {/* Waiting Bridge Indicator */}
                                    {state.lastStepResult?.status === 'Waiting Bridge' && (
                                        <div className="alert alert-info d-flex align-items-center gap-3 mt-3">
                                            <div className="spinner-border spinner-border-sm text-info flex-shrink-0" role="status">
                                                <span className="visually-hidden">Waiting...</span>
                                            </div>
                                            <div>
                                                <strong>Waiting for instrument reading...</strong>
                                                <div className="small text-muted mt-1">
                                                    Please trigger the instrument. Data will be received automatically via Bridge.
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                </div>

                                {/* Complete Verification Button - fallback if auto-complete didn't trigger */}
                                {state.verification.status === 'In Progress' &&
                                    state.currentStepIndex === state.verification.steps.length - 1 &&
                                    (['Completed', 'Complies', 'Not Complies'].includes(
                                        actions.getCurrentStep()?.status ?? ''
                                    )) && (
                                        <div className="mt-4 text-center">
                                            <button
                                                className="btn btn-success btn-lg"
                                                onClick={() => actions.handleCompleteVerification()}
                                                disabled={state.loading}
                                            >
                                                {state.loading ? (
                                                    <span className="spinner-border spinner-border-sm me-2"></span>
                                                ) : (
                                                    <i className="bi bi-check-circle me-2"></i>
                                                )}
                                                Complete Verification
                                            </button>
                                        </div>
                                    )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Override Modal */}
            {/* Override Modal */}
            <OverrideModal
                show={state.showOverrideModal}
                loading={state.loading}
                step={actions.getCurrentStep()}  // Pass the entire step object
                measuredValue={state.lastStepResult?.measured_value || null}
                selectedReference={state.lastStepResult?.reference_id || null}
                references={state.verification?.available_references?.[
                    actions.getCurrentStep()?.reference_type || ''
                ] || []}
                minRange={state.lastStepResult?.min_range || null}
                maxRange={state.lastStepResult?.max_range || null}
                overrideReason={state.overrideReason}
                onReasonChange={setters.setOverrideReason}
                onClose={() => {
                    setters.setShowOverrideModal(false);
                    setters.setOverrideReason('');
                }}
                onOverride={actions.handleOverride}
            />

            <CancelModal
                show={state.showCancelModal}
                loading={state.loading}
                onClose={() => {
                    setters.setShowCancelModal(false);
                }}
                onConfirm={async () => {
                    await actions.handleCancelVerification();
                    // handleCancelVerification already calls navigate('/verifications')
                }}
            />
        </div>
    );
};

export default DynamicVerificationStart;