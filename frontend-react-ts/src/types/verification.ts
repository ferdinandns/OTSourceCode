
export interface InstrumentDetail {
    id: number;
    instrument_id: number;
    instrument_type: string;
    no_kontrol: string;
    nama_instrument: string;
    status: string;
    configuration?: {
        com_port?: string;
        ip_address?: string;
        tcp_port?: number;
        baud_rate?: number;
        timeout?: number;
    };
}

export interface Reference {
    id: number;
    no_kontrol: string;
    name: string;
    nominal_value?: number | null;
    buffer_value?: number | null;
    min_tolerance: number;
    max_tolerance: number;
    expiry_date?: string | null;  // 🔴 ADD THIS - important for validation
    status?: string;              // 🔴 ADD THIS - Active/Inactive
}

export type ConnectionStatus = 'unknown' | 'checking' | 'ready' | 'failed' | 'not-required';

// ============================================
// DYNAMIC STEP INTERFACES (from backend)
// ============================================

export interface VerificationStepInfo {
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
    
    // 🔴 ADD THESE MISSING PROPERTIES
    reading_count?: number;           // For multi_reading steps
    calculation_expr?: string;        // For calculation steps
    validation_rules?: Record<string, any>;  // Validation rules from template
    metadata?: Record<string, any>;   // Additional metadata
    
    // 🔴 ADD THESE EXECUTION RESULT FIELDS
    measured_value?: number | null;
    expected_value?: number | null;
    min_value?: number | null;
    max_value?: number | null;
    readings?: number[];
    validation_msg?: string;
    reference_id?: number | null;
    started_at?: string | null;
    completed_at?: string | null;
    duration?: number | null;
}

export interface VerificationData {
    verification_id: number;
    instrument_id: number;
    instrument_type: string;
    template_id: number;
    template_name: string;
    steps: VerificationStepInfo[];
    global_rules: any;
    requires_connection: boolean;
    connection_type: string;
    status: string;
    total_steps: number;
    required_steps: number;
    current_step_number: number;
    available_references: Record<string, Reference[]>;
}

export interface VerificationStepDetail {
    step_number: number;
    step_name: string;
    step_type: string;
    description: string;
    required: boolean;
    status: string;
    input_data?: Record<string, any>;
    reading_data?: Record<string, any>;
    result_data?: Record<string, any>;
    validation_msg?: string;
    expected_value?: number | null;
    min_value?: number | null;
    max_value?: number | null;
    measured_value?: number | null;
    readings?: number[];
    reference_id?: number | null;
    reference_type?: string;
    started_at?: string | null;
    completed_at?: string | null;
    duration?: number | null;
    
    // 🔴 ADD THESE FOR COMPLETE DETAIL
    override_reason?: string;
    overridden_by?: number | null;
    overridden_at?: string | null;
}

// ============================================
// DYNAMIC VERIFICATION STATE
// ============================================

export interface DynamicVerificationState {
    // Loading & Error
    loading: boolean;
    error: string;

    // Instrument
    instrument: InstrumentDetail | null;

    // Connection
    connectionStatus: ConnectionStatus;
    connectionMessage: string;

    // Form data
    roomTemp: string;
    roomHumidity: string;

    // Verification Data (from backend)
    verification: VerificationData | null;
    
    // Current step index
    currentStepIndex: number;

    // Modals
    showOverrideModal: boolean;
    overrideReason: string;
    overrideStepNumber: number | null;
    showCancelModal: boolean;
    lastStepResult: StepExecutionResult | null;  
}

export interface StepExecutionResult {
    success: boolean;
    step_number: number;
    step_name: string;
    step_type: string;
    status: string;
    measured_value?: number | null;
    expected_value?: number | null;
    min_range?: number | null;
    max_range?: number | null;
    readings?: number[];
    result_data?: Record<string, any>;
    validation_msg: string;
    can_continue: boolean;
    needs_override: boolean;
    next_step_number?: number | null;
    message: string;
    verification_completed?: boolean;
    verification_status?: string;
    reference_id?: number | null;
    reference_type?: string | null;
    reference_name?: string | null;
    unit?: string;
}