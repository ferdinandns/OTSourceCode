import { useState } from 'react';
import { DynamicVerificationState } from '../../types/verification';

export const useDynamicVerificationState = () => {
    const [state, setState] = useState<DynamicVerificationState>({
        loading: true,
        error: '',
        instrument: null,
        connectionStatus: 'unknown',
        connectionMessage: '',
        roomTemp: '',
        roomHumidity: '',
        verification: null,
        currentStepIndex: 0,
        showOverrideModal: false,
        overrideReason: '',
        overrideStepNumber: null,
        showCancelModal: false,
        lastStepResult: null
    });

    const setters = {
        setLoading: (loading: boolean) => 
            setState(prev => ({ ...prev, loading })),
        
        setError: (error: string) => 
            setState(prev => ({ ...prev, error })),
        
        setInstrument: (instrument: any) => 
            setState(prev => ({ ...prev, instrument })),
        
        setConnectionStatus: (status: DynamicVerificationState['connectionStatus'], message: string) => 
            setState(prev => ({ ...prev, connectionStatus: status, connectionMessage: message })),
        
        setRoomTemp: (temp: string) => 
            setState(prev => ({ ...prev, roomTemp: temp })),
        
        setRoomHumidity: (humidity: string) => 
            setState(prev => ({ ...prev, roomHumidity: humidity })),
        
        setVerification: (verification: any) => 
            setState(prev => ({ ...prev, verification })),
        
        setCurrentStepIndex: (index: number) => 
            setState(prev => ({ ...prev, currentStepIndex: index })),
        
        setShowOverrideModal: (show: boolean, stepNumber: number | null = null) => 
            setState(prev => ({ ...prev, showOverrideModal: show, overrideStepNumber: stepNumber })),
        
        setOverrideReason: (reason: string) => 
            setState(prev => ({ ...prev, overrideReason: reason })),
        
        setLastStepResult: (result: any) => 
            setState(prev => ({ ...prev, lastStepResult: result })),

        setShowCancelModal: (show: boolean) => 
            setState(prev => ({ ...prev, showCancelModal: show })),
        
        resetState: () => 
            setState({
                loading: true,
                error: '',
                instrument: null,
                connectionStatus: 'unknown',
                connectionMessage: '',
                roomTemp: '',
                roomHumidity: '',
                verification: null,
                currentStepIndex: 0,
                showOverrideModal: false,
                overrideReason: '',
                overrideStepNumber: null,
                showCancelModal: false,
                lastStepResult: null
            })
    };

    return { state, setters };
};