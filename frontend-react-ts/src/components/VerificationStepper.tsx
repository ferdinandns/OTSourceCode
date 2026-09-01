// VerificationStepper.tsx
import React from 'react';

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
}

export interface VerificationStepperProps {
    steps: StepInfo[];
    currentStepIndex: number;
    onStepClick: (index: number) => void;
}

const VerificationStepper: React.FC<VerificationStepperProps> = ({
    steps,
    currentStepIndex,
    onStepClick
}) => {
    const getStepStatusIcon = (step: StepInfo) => {
        switch (step.status) {
            case 'Completed':
                return <i className="bi bi-check-circle-fill text-success"></i>;
            case 'In Progress':
                return <i className="bi bi-arrow-right-circle-fill text-primary"></i>;
            case 'Failed':
                return <i className="bi bi-x-circle-fill text-danger"></i>;
            case 'Pending':
                return <i className="bi bi-circle text-muted"></i>;
            default:
                return <i className="bi bi-circle text-muted"></i>;
        }
    };

    const getStepClass = (index: number, step: StepInfo) => {
        let className = 'step-item';
        
        if (index === currentStepIndex) {
            className += ' active';
        }
        
        if (step.status === 'Completed') {
            className += ' completed';
        }
        
        if (step.status === 'Failed') {
            className += ' failed';
        }
        
        // Make clickable if completed or ready
        if (step.status === 'Completed' || step.status === 'Ready' || index === currentStepIndex) {
            className += ' clickable';
        }
        
        return className;
    };

    const canClickStep = (step: StepInfo) => {
        return step.status === 'Completed' || step.status === 'Ready' || step.status === 'In Progress';
    };

    return (
        <div className="verification-stepper mb-4">
            <div className="stepper-container">
                {steps.map((step, index) => (
                    <div 
                        key={step.step_number}
                        className={getStepClass(index, step)}
                        onClick={() => canClickStep(step) && onStepClick(index)}
                        style={{ cursor: canClickStep(step) ? 'pointer' : 'default' }}
                    >
                        <div className="step-number">
                            {getStepStatusIcon(step)}
                            <span className="ms-1">{step.step_number}</span>
                        </div>
                        <div className="step-label">
                            <div className="step-name">{step.step_name}</div>
                            {step.required && (
                                <span className="badge badge-sm bg-warning text-dark ms-1">Required</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <style>{`
                .verification-stepper {
                    padding: 1rem 0;
                }

                .stepper-container {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    position: relative;
                    padding: 0 1rem;
                }

                .stepper-container::before {
                    content: '';
                    position: absolute;
                    top: 20px;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: #dee2e6;
                    z-index: 0;
                }

                .step-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    position: relative;
                    z-index: 1;
                    min-width: 80px;
                }

                .step-item.clickable {
                    cursor: pointer;
                }

                .step-item.clickable:hover .step-number {
                    transform: scale(1.1);
                }

                .step-number {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: white;
                    border: 2px solid #dee2e6;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 600;
                    font-size: 14px;
                    transition: all 0.3s;
                    color: #6c757d;
                }

                .step-item.active .step-number {
                    border-color: #0d6efd;
                    background: #e7f1ff;
                    color: #0d6efd;
                    box-shadow: 0 0 0 4px rgba(13, 110, 253, 0.1);
                }

                .step-item.completed .step-number {
                    border-color: #198754;
                    background: #d1e7dd;
                }

                .step-item.failed .step-number {
                    border-color: #dc3545;
                    background: #f8d7da;
                }

                .step-label {
                    margin-top: 8px;
                    text-align: center;
                    max-width: 100px;
                }

                .step-name {
                    font-size: 12px;
                    font-weight: 500;
                    color: #495057;
                    line-height: 1.2;
                }

                .step-item.active .step-name {
                    color: #0d6efd;
                    font-weight: 600;
                }

                .badge-sm {
                    font-size: 0.65rem;
                    padding: 0.15rem 0.3rem;
                }

                @media (max-width: 768px) {
                    .stepper-container {
                        flex-direction: column;
                        align-items: stretch;
                    }

                    .stepper-container::before {
                        display: none;
                    }

                    .step-item {
                        flex-direction: row;
                        justify-content: flex-start;
                        margin-bottom: 1rem;
                        min-width: auto;
                    }

                    .step-label {
                        margin-top: 0;
                        margin-left: 12px;
                        text-align: left;
                        max-width: none;
                    }
                }
            `}</style>
        </div>
    );
};

export default VerificationStepper;