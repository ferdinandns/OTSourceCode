import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { DynamicVerificationState } from '../../types/verification';

interface UseDynamicVerificationActionsProps {
    instrumentId: number;
    state: DynamicVerificationState;
    setters: any;
}

export const useDynamicVerificationActions = ({
    instrumentId,
    state,
    setters
}: UseDynamicVerificationActionsProps) => {
    const navigate = useNavigate();

    // ============================================
    // FETCH INSTRUMENT DETAIL
    // ============================================
    const fetchInstrumentDetail = async () => {
        try {
            setters.setLoading(true);
            const response = await api.get(`/api/instruments/${instrumentId}`);
            const data = response.data.data;

            setters.setInstrument({
                id: data.id,
                instrument_id: data.id,
                instrument_type: data.type,
                no_kontrol: data.nomor_kontrol || data.kode_instrument,
                nama_instrument: data.nama || data.nama_instrument,
                status: data.status,
                configuration: data.configuration,
            });
            setters.setError('');
        } catch (err: any) {
            setters.setError(err.response?.data?.message || 'Failed to fetch instrument');
        } finally {
            setters.setLoading(false);
        }
    };

    // ============================================
    // CHECK INSTRUMENT CONNECTION
    // ============================================
    const checkInstrumentConnection = async () => {
        if (!needsConnection()) {
            setters.setConnectionStatus(
                'not-required',
                'Manual input instrument - no connection required'
            );
            return;
        }

        // ✅ Untuk instrument serial/TCP, pembacaan dilakukan via Bridge.
        // Tidak perlu test-connection ke server — langsung set ready.
        const hasBridgePc = !!(state.instrument?.configuration?.com_port
            || state.instrument?.configuration?.com_port);

        if (hasBridgePc) {
            setters.setConnectionStatus(
                'ready',
                'Instrument will be read via Bridge when verification step is executed.'
            );
            return;
        }

        // Fallback: TCP direct (Tibbo atau TCP tanpa Bridge)
        try {
            setters.setConnectionStatus('checking', 'Checking instrument connection...');

            const response = await api.post(`/api/instruments/${instrumentId}/test-connection`, {
                instrument_id: instrumentId
            });

            if (response.data.data?.success) {
                setters.setConnectionStatus(
                    'ready',
                    response.data.data.message || 'Instrument ready'
                );
            } else {
                setters.setConnectionStatus(
                    'failed',
                    response.data.data.message || 'Connection test failed'
                );
            }
        } catch (err: any) {
            setters.setConnectionStatus(
                'failed',
                err.response?.data?.message || 'Failed to connect to instrument'
            );
        }
    };

    // ============================================
    // START VERIFICATION
    // ============================================
    const handleStartVerification = async () => {
        if (!state.roomTemp || !state.roomHumidity) {
            setters.setError('Room temperature and humidity are required');
            return;
        }

        try {
            setters.setLoading(true);

            const response = await api.post('/api/verifications/start', {
                instrument_id: instrumentId,
                room_temp: parseFloat(state.roomTemp),
                room_humidity: parseFloat(state.roomHumidity)
            });

            const verificationData = response.data.data;
            setters.setVerification(verificationData);

            // Find first available step (no dependencies or Ready status)
            const firstStepIndex = verificationData.steps.findIndex(
                (step: any) => step.status === 'Ready' || step.depends_on?.length === 0
            );
            setters.setCurrentStepIndex(firstStepIndex >= 0 ? firstStepIndex : 0);

            setters.setError('');
        } catch (err: any) {
            setters.setError(err.response?.data?.message || 'Failed to start verification');
        } finally {
            setters.setLoading(false);
        }
    };

    // ============================================
    // EXECUTE STEP (Generic)
    // ============================================
    const executeStep = async (stepNumber: number, inputData: any = {}) => {
        if (!state.verification) return;

        // ✅ FIX: Look up step directly from verification.steps array to avoid stale closure.
        // getCurrentStep() uses state captured at hook definition time and can be stale,
        // especially on the last step or after rapid state updates.
        const currentStep = state.verification.steps.find(s => s.step_number === stepNumber);
        const executingStepType = currentStep?.step_type;

        // ✅ FIX: Ensure reference_id is sent as a proper integer (not a string from select value)
        const referenceId = inputData.reference_id != null
            ? parseInt(String(inputData.reference_id), 10)
            : undefined;

        try {
            setters.setLoading(true);

            const response = await api.post('/api/verifications/execute-step', {
                verification_id: state.verification.verification_id,
                step_number: stepNumber,
                step_type: executingStepType,   // ✅ from direct steps lookup, not stale closure
                input_data: inputData,
                reference_id: referenceId,      // ✅ always an integer
                auto_read: true
            });

            const result = response.data.data;

            if (result.status === 'Waiting Bridge') {
                setters.setLastStepResult(result);
                startProgressPolling();
                return result;
            }

            // ✅ CRITICAL: Store result FIRST before refreshing
            if (setters.setLastStepResult) {
                setters.setLastStepResult({
                    ...result,
                    reference_id: result.reference_id || inputData.reference_id
                });
            }

            // Refresh verification progress
            await fetchVerificationProgress();

            setters.setError('');

            // ✅ DON'T auto-navigate to next step if this is an auto_read step
            // Let the user see the result first


            return result;
        } catch (err: any) {
            console.error('❌ Step execution failed:', err);
            setters.setError(err.response?.data?.message || 'Failed to execute step');
            throw err;
        } finally {
            setters.setLoading(false);
        }
    };

    const startProgressPolling = () => {
        const verificationId = state.verification?.verification_id;
        const snapshotVerification = state.verification;

        if (!verificationId) return;

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
                    setters.setVerification({
                        ...snapshotVerification,
                        steps: freshSteps
                    });

                    // ✅ Cek apakah step yang baru selesai complies atau tidak
                    const justCompletedStep = freshSteps.find(
                        (s: any) => s.status === 'Not Complies' || s.status === 'Complies'
                    );
                    if (justCompletedStep) {
                        setters.setLastStepResult({
                            step_number: justCompletedStep.step_number,
                            status: justCompletedStep.status,
                            measured_value: justCompletedStep.measured_value,
                            min_range: justCompletedStep.min_value,
                            max_range: justCompletedStep.max_value,
                            validation_msg: justCompletedStep.validation_msg,
                            needs_override: justCompletedStep.status === 'Not Complies',
                            can_continue: justCompletedStep.status === 'Complies',
                        });
                    }

                    setters.setLoading(false);
                    setters.setError('');
                }
            } catch (err) {
                console.error('Polling error:', err);
                clearInterval(pollInterval);
                setters.setLoading(false);
            }
        }, 2000);

        setTimeout(() => {
            clearInterval(pollInterval);
            setters.setLoading(false);
            setters.setError('Instrument read timeout. Please trigger the instrument and try again.');
        }, 10 * 60 * 1000);
    };
    // ============================================
    // FETCH VERIFICATION PROGRESS
    // ============================================
    const fetchVerificationProgress = async () => {
        if (!state.verification) return;

        // ✅ FIX: Capture verification ID immediately before the async gap.
        // Reading state.verification inside an async callback risks getting a stale
        // reference if state updates happen between the await points.
        const verificationId = state.verification.verification_id;
        const currentVerification = state.verification;

        try {
            const response = await api.get(
                `/api/verifications/${verificationId}/progress`
            );

            // Update steps status in verification data
            setters.setVerification({
                ...currentVerification,
                steps: response.data.data.steps
            });
        } catch (err) {
            console.error('Failed to fetch progress:', err);
        }
    };

    // ============================================
    // CANCEL VERIFICATION
    // ============================================
    const handleCancelVerification = async () => {
        if (!state.verification) return;

        try {
            setters.setLoading(true);
            await api.post(`/api/verifications/${state.verification.verification_id}/cancel`);
            navigate('/verifications');
        } catch (err: any) {
            setters.setError(err.response?.data?.message || 'Failed to cancel verification');
        } finally {
            setters.setLoading(false);
            setters.setShowCancelModal(false);
        }
    };

    // ============================================
    // COMPLETE VERIFICATION
    // ============================================
    const handleCompleteVerification = async (notes: string = '') => {
        if (!state.verification) return;
        try {
            setters.setLoading(true);
            await api.post(
                `/api/verifications/${state.verification.verification_id}/complete`,
                { notes }
            );

            navigate(`/instruments/${state.verification.instrument_id}`);;
        } catch (err: any) {
            setters.setError(err.response?.data?.message || 'Failed to complete verification');
        } finally {
            setters.setLoading(false);
        }
    };

    // ============================================
    // OVERRIDE HANDLER
    // ============================================
    const handleOverride = async (action: 'continue' | 'breakdown' = 'continue') => {
        if (!state.verification || !state.overrideStepNumber || !state.overrideReason) {
            setters.setError('Override reason is required');
            return;
        }

        try {
            setters.setLoading(true);

            if (action === 'breakdown') {
                // 1. Cancel the verification with breakdown status.
                //    We use the cancel endpoint and pass breakdown metadata via notes.
                //    This avoids trying to force-fail individual steps via execute-step
                //    (which the backend ignores since force_status lives only in input_data JSON).
                await api.post(
                    `/api/verifications/${state.verification.verification_id}/cancel`,
                    {
                        notes: `Instrument breakdown at step ${state.overrideStepNumber}: ${state.overrideReason}`,
                        breakdown: true,
                        step_number: state.overrideStepNumber,
                        override_reason: state.overrideReason
                    }
                );

                // 2. Mark instrument Unavailable
                await api.put(`/api/instruments/${instrumentId}`, {
                    status: 'Unavailable'
                }).catch(console.error);

                setters.setShowOverrideModal(false);
                setters.setOverrideReason('');
                navigate(`/instruments/${instrumentId}`);

            } else {
                // 1. Mark current step as Completed (override/continue)
                await api.post('/api/verifications/execute-step', {
                    verification_id: state.verification.verification_id,
                    step_number: state.overrideStepNumber,
                    step_type: getCurrentStep()?.step_type,
                    input_data: {
                        override_reason: state.overrideReason,
                        action: 'continue',
                        force_status: 'Completed'
                    },
                    skip_validation: true
                });

                setters.setShowOverrideModal(false);
                setters.setOverrideReason('');
                setters.setLastStepResult(null);

                // 2. Fetch fresh progress and use response directly (avoid stale state)
                const progressResponse = await api.get(
                    `/api/verifications/${state.verification.verification_id}/progress`
                );
                const freshSteps = progressResponse.data.data.steps;

                // 3. Update state with fresh steps
                setters.setVerification({ ...state.verification, steps: freshSteps });

                // 4. Find next Ready/Pending step from fresh data
                const nextStep = freshSteps.find(
                    (s: any) => s.status === 'Ready' || s.status === 'Pending'
                );

                if (nextStep) {
                    const nextIndex = freshSteps.findIndex(
                        (s: any) => s.step_number === nextStep.step_number
                    );
                    setters.setCurrentStepIndex(nextIndex);
                } else {
                    // No more steps → complete and navigate
                    await api.post(
                        `/api/verifications/${state.verification.verification_id}/complete`,
                        { notes: state.overrideReason }
                    ).catch(console.error);
                    navigate(`/instruments/${instrumentId}`);
                }
            }

        } catch (err: any) {
            setters.setError(err.response?.data?.message || 'Failed to process override');
        } finally {
            setters.setLoading(false);
        }
    };

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    const needsConnection = (): boolean => {
        return !!(
            state.instrument?.configuration?.com_port ||
            state.instrument?.configuration?.ip_address
        );
    };

    const canStartVerification = (): boolean => {
        return (
            !!state.roomTemp &&
            !!state.roomHumidity
        );
    };

    const getCurrentStep = () => {
        if (!state.verification) return null;
        return state.verification.steps[state.currentStepIndex];
    };

    const getStepStatus = (stepNumber: number): string => {
        if (!state.verification) return 'unknown';
        const step = state.verification.steps.find(s => s.step_number === stepNumber);
        return step?.status || 'unknown';
    };

    const isStepAccessible = (stepNumber: number): boolean => {
        const status = getStepStatus(stepNumber);
        return ['Completed', 'Ready', 'In Progress'].includes(status);
    };

    const advanceToNextStep = (nextStepNumber: number) => {
        if (!state.verification) return;
        const nextStepIndex = state.verification.steps.findIndex(
            s => s.step_number === nextStepNumber
        );
        if (nextStepIndex >= 0) {
            setters.setCurrentStepIndex(nextStepIndex);
        }
    };


    return {
        fetchInstrumentDetail,
        checkInstrumentConnection,
        handleStartVerification,
        executeStep,
        fetchVerificationProgress,
        handleCancelVerification,
        handleCompleteVerification,
        handleOverride,
        needsConnection,
        canStartVerification,
        getCurrentStep,
        getStepStatus,
        isStepAccessible,
        advanceToNextStep
    };
};