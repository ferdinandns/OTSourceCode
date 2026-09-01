// src/views/verification/components/VerificationProgress.tsx

import React from 'react';
import { VerificationStepInfo } from '../types/verification';

interface VerificationProgressProps {
    currentStep: VerificationStepInfo;
    allSteps?: VerificationStepInfo[]; // Optional: all steps for dynamic display
}

const VerificationProgress: React.FC<VerificationProgressProps> = ({ 
    currentStep, 
    allSteps 
}) => {
    // Use provided steps or fallback to hardcoded ones
    const steps = allSteps?.map((step, index) => ({
        id: `step-${step.step_number}`,
        label: step.step_name,
        number: step.step_number,
        status: step.status
    })) || [
        { id: 'form', label: 'Form', number: 1, status: 'Completed' },
        { id: 'verify-zero', label: 'Verify Zero', number: 2, status: 'Pending' },
        { id: 'verify-weight-min', label: 'Weight Min', number: 3, status: 'Pending' },
        { id: 'verify-weight-max', label: 'Weight Max', number: 4, status: 'Pending' }
    ];

    const getStepStatus = (stepNumber: number): boolean => {
        return stepNumber <= currentStep.step_number;
    };

    const getStatusColor = (status?: string): string => {
        switch (status) {
            case 'Completed':
            case 'Complies':
                return 'bg-success';
            case 'In Progress':
                return 'bg-primary';
            case 'Failed':
            case 'Not Complies':
                return 'bg-danger';
            case 'Ready':
                return 'bg-info';
            default:
                return 'bg-secondary';
        }
    };

    return (
        <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center">
                {steps.map((step, index) => (
                    <React.Fragment key={step.id}>
                        <div className={`flex-fill text-center ${
                            currentStep.step_number === step.number ? 'fw-bold' : ''
                        }`}>
                            <div className={`badge ${
                                step.status 
                                    ? getStatusColor(step.status)
                                    : getStepStatus(step.number) 
                                        ? 'bg-primary' 
                                        : 'bg-secondary'
                            } mb-2`}>
                                {step.status === 'Completed' && (
                                    <i className="bi bi-check-circle-fill me-1"></i>
                                )}
                                {step.number}
                            </div>
                            <div className="small">{step.label}</div>
                        </div>
                        {index < steps.length - 1 && <div className="flex-fill border-top"></div>}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

export default VerificationProgress;