package structs

import "time"

// ExecuteStepRequest - Generic step execution request
type ExecuteStepRequest struct {
	VerificationID uint                   `json:"verification_id" validate:"required"`
	StepNumber     int                    `json:"step_number" validate:"required"`
	StepType       string                 `json:"step_type" validate:"required"`
	InputData      map[string]interface{} `json:"input_data"`      // User inputs
	ReferenceID    *uint                  `json:"reference_id"`    // Optional reference
	MinRange       *float64               `json:"min_range"`       // Optional admin override
	MaxRange       *float64               `json:"max_range"`       // Optional admin override
	AutoRead       bool                   `json:"auto_read"`       // Trigger automatic reading
	SkipValidation bool                   `json:"skip_validation"` // Admin can skip validation
}

// ExecuteStepResponse - Generic step execution response
// ExecuteStepResponse - Generic step execution response
type ExecuteStepResponse struct {
	Success        bool                   `json:"success"`
	StepNumber     int                    `json:"step_number"`
	StepName       string                 `json:"step_name"`
	StepType       string                 `json:"step_type"`
	Status         string                 `json:"status"` // Pending, Complies, Not Complies, Completed
	MeasuredValue  *float64               `json:"measured_value,omitempty"`
	ExpectedValue  *float64               `json:"expected_value,omitempty"`
	MinRange       *float64               `json:"min_range,omitempty"`
	MaxRange       *float64               `json:"max_range,omitempty"`
	Readings       []float64              `json:"readings,omitempty"` // For multi-reading steps
	ResultData     map[string]interface{} `json:"result_data,omitempty"`
	ValidationMsg  string                 `json:"validation_msg"`
	CanContinue    bool                   `json:"can_continue"`
	NeedsOverride  bool                   `json:"needs_override"`
	NextStepNumber *int                   `json:"next_step_number,omitempty"`
	Message        string                 `json:"message"`

	ReferenceID   *uint   `json:"reference_id,omitempty"`
	ReferenceType *string `json:"reference_type,omitempty"`
	ReferenceName *string `json:"reference_name,omitempty"`
	Unit          string  `json:"unit,omitempty"`

	VerificationCompleted bool   `json:"verification_completed"`
	VerificationStatus    string `json:"verification_status"`
}

// ============================================
// TEMPLATE MANAGEMENT
// ============================================

// CreateTemplateRequest - Create new verification template
type CreateTemplateRequest struct {
	TemplateName           string                 `json:"template_name" validate:"required"`
	InstrumentType         string                 `json:"instrument_type" validate:"required"`
	Description            string                 `json:"description"`
	Steps                  []StepConfigDTO        `json:"steps" validate:"required,min=1"`
	GlobalRules            map[string]interface{} `json:"global_rules"`
	RequiresConnection     bool                   `json:"requires_connection"`
	ConnectionType         string                 `json:"connection_type"`
	AutoCompleteOnSuccess  bool                   `json:"auto_complete_on_success"`
	AllowPartialCompletion bool                   `json:"allow_partial_completion"`
	IsDefault              bool                   `json:"is_default"`
	IsActive               bool                   `json:"is_active"`
}

// UpdateTemplateRequest - Update existing template
type UpdateTemplateRequest struct {
	TemplateName           *string                 `json:"template_name"`
	Description            *string                 `json:"description"`
	Steps                  *[]StepConfigDTO        `json:"steps"`
	GlobalRules            *map[string]interface{} `json:"global_rules"`
	RequiresConnection     *bool                   `json:"requires_connection"`
	ConnectionType         *string                 `json:"connection_type"`
	AutoCompleteOnSuccess  *bool                   `json:"auto_complete_on_success"`
	AllowPartialCompletion *bool                   `json:"allow_partial_completion"`
	IsActive               *bool                   `json:"is_active"`
	IsDefault              *bool                   `json:"is_default"`
}

// StepConfigDTO - Data transfer object for step configuration
type StepConfigDTO struct {
	StepNumber      int                    `json:"step_number" validate:"required"`
	StepName        string                 `json:"step_name" validate:"required"`
	StepType        string                 `json:"step_type" validate:"required,oneof=auto_read manual_input selection multi_reading calculation"`
	Description     string                 `json:"description"`
	Required        bool                   `json:"required"`
	InputType       string                 `json:"input_type,omitempty"`
	Unit            string                 `json:"unit,omitempty"`
	ValidationRules map[string]interface{} `json:"validation_rules,omitempty"`
	DependsOn       []int                  `json:"depends_on,omitempty"`
	ReferenceType   string                 `json:"reference_type,omitempty"`
	ReadingCount    int                    `json:"reading_count,omitempty"`
	CalculationExpr string                 `json:"calculation_expr,omitempty"`
	UIComponent     string                 `json:"ui_component,omitempty"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
}

// TemplateListResponse - Template list item
type TemplateListResponse struct {
	ID                     uint                   `json:"id"`
	TemplateName           string                 `json:"template_name"`
	InstrumentType         string                 `json:"instrument_type"`
	Description            string                 `json:"description"`
	Version                int                    `json:"version"`
	StepCount              int                    `json:"step_count"`
	RequiresConnection     bool                   `json:"requires_connection"`
	IsActive               bool                   `json:"is_active"`
	IsDefault              bool                   `json:"is_default"`
	InstrumentCount        int                    `json:"instrument_count"` // How many instruments use this
	CreatedBy              string                 `json:"created_by"`
	UpdatedBy              string                 `json:"updated_by"`
	CreatedAt              time.Time              `json:"created_at"`
	UpdatedAt              time.Time              `json:"updated_at"`
	GlobalRules            map[string]interface{} `json:"global_rules,omitempty"`
	AutoCompleteOnSuccess  bool                   `json:"auto_complete_on_success"`
	AllowPartialCompletion bool                   `json:"allow_partial_completion"`
}

// TemplateDetailResponse - Full template details
type TemplateDetailResponse struct {
	ID                     uint                   `json:"id"`
	TemplateName           string                 `json:"template_name"`
	InstrumentType         string                 `json:"instrument_type"`
	Description            string                 `json:"description"`
	Version                int                    `json:"version"`
	Steps                  []StepConfigDTO        `json:"steps"`
	GlobalRules            map[string]interface{} `json:"global_rules"`
	RequiresConnection     bool                   `json:"requires_connection"`
	ConnectionType         string                 `json:"connection_type"`
	AutoCompleteOnSuccess  bool                   `json:"auto_complete_on_success"`
	AllowPartialCompletion bool                   `json:"allow_partial_completion"`
	IsActive               bool                   `json:"is_active"`
	IsDefault              bool                   `json:"is_default"`
	CreatedBy              UserBasicInfo          `json:"created_by"`
	UpdatedBy              UserBasicInfo          `json:"updated_by"`
	CreatedAt              time.Time              `json:"created_at"`
	UpdatedAt              time.Time              `json:"updated_at"`
	UsedByInstruments      []InstrumentBasicInfo  `json:"used_by_instruments,omitempty"`
}

// InstrumentBasicInfo - Basic instrument information
type InstrumentBasicInfo struct {
	ID         uint   `json:"id"`
	NoKontrol  string `json:"no_kontrol"`
	Name       string `json:"name"`
	Type       string `json:"type"`
	IsActive   bool   `json:"is_active"`
	SiteID     string `json:"site_id"`
	LocationID string `json:"location_id"`
}

// ============================================
// INSTRUMENT TEMPLATE MAPPING
// ============================================

// AssignTemplateRequest - Assign template to instrument
type AssignTemplateRequest struct {
	InstrumentID   uint                   `json:"instrument_id" validate:"required"`
	TemplateID     uint                   `json:"template_id" validate:"required"`
	OverrideConfig map[string]interface{} `json:"override_config"` // Optional overrides
}

// UpdateInstrumentTemplateRequest - Update instrument template mapping
type UpdateInstrumentTemplateRequest struct {
	TemplateID     *uint                   `json:"template_id"`
	OverrideConfig *map[string]interface{} `json:"override_config"`
	IsActive       *bool                   `json:"is_active"`
}

// InstrumentTemplateResponse - Instrument's template assignment
type InstrumentTemplateResponse struct {
	InstrumentID   uint                   `json:"instrument_id"`
	NoKontrol      string                 `json:"no_kontrol"`
	InstrumentName string                 `json:"instrument_name"`
	TemplateID     uint                   `json:"template_id"`
	TemplateName   string                 `json:"template_name"`
	OverrideConfig map[string]interface{} `json:"override_config"`
	IsActive       bool                   `json:"is_active"`
	UpdatedBy      string                 `json:"updated_by"`
	UpdatedAt      time.Time              `json:"updated_at"`
}

// ============================================
// STEP INFO STRUCTURES
// ============================================

// VerificationStepInfo - Basic step information
type VerificationStepInfo struct {
	StepNumber    int    `json:"step_number"`
	StepName      string `json:"step_name"`
	StepType      string `json:"step_type"`
	Description   string `json:"description"`
	Required      bool   `json:"required"`
	Status        string `json:"status"`
	DependsOn     []int  `json:"depends_on,omitempty"`
	ReferenceType string `json:"reference_type,omitempty"`
	InputType     string `json:"input_type,omitempty"`
	Unit          string `json:"unit,omitempty"`
	UIComponent   string `json:"ui_component,omitempty"`
}

// VerificationStepDetail - Detailed step information with execution data
type VerificationStepDetail struct {
	StepNumber     int                    `json:"step_number"`
	StepName       string                 `json:"step_name"`
	StepType       string                 `json:"step_type"`
	Description    string                 `json:"description"`
	Required       bool                   `json:"required"`
	Status         string                 `json:"status"`
	InputData      map[string]interface{} `json:"input_data,omitempty"`
	ReadingData    map[string]interface{} `json:"reading_data,omitempty"`
	ResultData     map[string]interface{} `json:"result_data,omitempty"`
	ValidationMsg  string                 `json:"validation_msg,omitempty"`
	ExpectedValue  *float64               `json:"expected_value,omitempty"`
	MinValue       *float64               `json:"min_value,omitempty"`
	MaxValue       *float64               `json:"max_value,omitempty"`
	MeasuredValue  *float64               `json:"measured_value,omitempty"`
	Readings       []float64              `json:"readings,omitempty"`
	ReferenceID    *uint                  `json:"reference_id,omitempty"`
	ReferenceType  string                 `json:"reference_type,omitempty"`
	OverrideReason string                 `json:"override_reason,omitempty"`
	OverriddenBy   *uint                  `json:"overridden_by,omitempty"`
	OverriddenAt   *time.Time             `json:"overridden_at,omitempty"`
	StartedAt      *time.Time             `json:"started_at,omitempty"`
	CompletedAt    *time.Time             `json:"completed_at,omitempty"`
	Duration       *int                   `json:"duration,omitempty"`
}

// ============================================
// ENHANCED START VERIFICATION
// ============================================

// StartVerificationRequestV2 - Enhanced start request
type StartVerificationRequestV2 struct {
	InstrumentID uint                   `json:"instrument_id" validate:"required"`
	TemplateID   *uint                  `json:"template_id"` // Optional: override default
	RoomTemp     *float64               `json:"room_temp"`
	RoomHumidity *float64               `json:"room_humidity"`
	InitialData  map[string]interface{} `json:"initial_data"` // Any additional startup data
}

// StartVerificationResponseV2 - Enhanced start response
type StartVerificationResponseV2 struct {
	VerificationID      uint                   `json:"verification_id"`
	InstrumentID        uint                   `json:"instrument_id"`
	InstrumentType      string                 `json:"instrument_type"`
	TemplateID          uint                   `json:"template_id"`
	TemplateName        string                 `json:"template_name"`
	Steps               []VerificationStepInfo `json:"steps"`
	GlobalRules         map[string]interface{} `json:"global_rules"`
	RequiresConnection  bool                   `json:"requires_connection"`
	ConnectionType      string                 `json:"connection_type"`
	Status              string                 `json:"status"`
	TotalSteps          int                    `json:"total_steps"`
	RequiredSteps       int                    `json:"required_steps"`
	CurrentStepNumber   int                    `json:"current_step_number"`
	AvailableReferences map[string]interface{} `json:"available_references"` // References grouped by type
	Message             string                 `json:"message"`
}

// ============================================
// GET VERIFICATION PROGRESS
// ============================================

// VerificationProgressResponse - Current verification progress
type VerificationProgressResponse struct {
	VerificationID    uint                     `json:"verification_id"`
	InstrumentID      uint                     `json:"instrument_id"`
	Status            string                   `json:"status"`
	CompletionPercent float64                  `json:"completion_percent"`
	TotalSteps        int                      `json:"total_steps"`
	CompletedSteps    int                      `json:"completed_steps"`
	PendingSteps      int                      `json:"pending_steps"`
	FailedSteps       int                      `json:"failed_steps"`
	CurrentStep       *VerificationStepInfo    `json:"current_step,omitempty"`
	Steps             []VerificationStepDetail `json:"steps"`
	CanComplete       bool                     `json:"can_complete"`
	CanContinue       bool                     `json:"can_continue"`
	Message           string                   `json:"message"`
}

// ============================================
// BATCH OPERATIONS
// ============================================

// BatchExecuteStepsRequest - Execute multiple steps at once
type BatchExecuteStepsRequest struct {
	VerificationID uint                 `json:"verification_id" validate:"required"`
	Steps          []ExecuteStepRequest `json:"steps" validate:"required,min=1"`
	StopOnFailure  bool                 `json:"stop_on_failure"` // Stop if any step fails
}

// BatchExecuteStepsResponse - Batch execution results
type BatchExecuteStepsResponse struct {
	Success         bool                  `json:"success"`
	VerificationID  uint                  `json:"verification_id"`
	TotalSteps      int                   `json:"total_steps"`
	SuccessfulSteps int                   `json:"successful_steps"`
	FailedSteps     int                   `json:"failed_steps"`
	Results         []ExecuteStepResponse `json:"results"`
	Message         string                `json:"message"`
}

// ============================================
// TEMPLATE CLONING
// ============================================

// CloneTemplateRequest - Clone existing template
type CloneTemplateRequest struct {
	SourceTemplateID uint    `json:"source_template_id" validate:"required"`
	NewTemplateName  string  `json:"new_template_name" validate:"required"`
	NewDescription   *string `json:"new_description"`
	MakeDefault      bool    `json:"make_default"`
}

// ============================================
// STEP VALIDATION RESULT
// ============================================

// StepValidationResult - Result of step validation
type StepValidationResult struct {
	IsValid        bool                   `json:"is_valid"`
	ComplianceType string                 `json:"compliance_type"` // Complies, Not Complies, Warning
	Messages       []string               `json:"messages"`
	Errors         []string               `json:"errors,omitempty"`
	Warnings       []string               `json:"warnings,omitempty"`
	Details        map[string]interface{} `json:"details,omitempty"`
}

// ============================================
// BULK TEMPLATE IMPORT/EXPORT
// ============================================

// ExportTemplateResponse - Template export format
type ExportTemplateResponse struct {
	FormatVersion string                 `json:"format_version"` // e.g., "1.0"
	ExportedAt    time.Time              `json:"exported_at"`
	ExportedBy    string                 `json:"exported_by"`
	Template      TemplateDetailResponse `json:"template"`
}

// ImportTemplateRequest - Import template
type ImportTemplateRequest struct {
	TemplateData       TemplateDetailResponse `json:"template_data" validate:"required"`
	OverwriteExisting  bool                   `json:"overwrite_existing"`
	PreserveVersioning bool                   `json:"preserve_versioning"`
}

// ============================================
// REFERENCE MANAGEMENT
// ============================================

// CreateReferenceRequest - Create new verification reference
type CreateReferenceRequest struct {
	InstrumentID    uint       `json:"instrument_id" validate:"required"`
	ReferenceType   string     `json:"reference_type" validate:"required"` // anak_timbang, buffer_ph, buffer_cond
	NoKontrol       string     `json:"no_kontrol" validate:"required"`
	Name            string     `json:"name" validate:"required"`
	NominalValue    *float64   `json:"nominal_value"` // For weights
	BufferValue     *float64   `json:"buffer_value"`  // For pH/conductivity buffers
	MinTolerance    *float64   `json:"min_tolerance"`
	MaxTolerance    *float64   `json:"max_tolerance"`
	CalibrationDate *time.Time `json:"calibration_date"`
	ExpiryDate      *time.Time `json:"expiry_date"`
}

// UpdateReferenceRequest - Update reference
type UpdateReferenceRequest struct {
	NoKontrol       *string    `json:"no_kontrol"`
	Name            *string    `json:"name"`
	NominalValue    *float64   `json:"nominal_value"`
	BufferValue     *float64   `json:"buffer_value"`
	MinTolerance    *float64   `json:"min_tolerance"`
	MaxTolerance    *float64   `json:"max_tolerance"`
	Status          *string    `json:"status"`
	CalibrationDate *time.Time `json:"calibration_date"`
	ExpiryDate      *time.Time `json:"expiry_date"`
}

// ReferenceResponse - Reference detail response
type ReferenceResponse struct {
	ID              uint       `json:"id"`
	InstrumentID    uint       `json:"instrument_id"`
	ReferenceType   string     `json:"reference_type"`
	NoKontrol       string     `json:"no_kontrol"`
	Name            string     `json:"name"`
	NominalValue    *float64   `json:"nominal_value,omitempty"`
	BufferValue     *float64   `json:"buffer_value,omitempty"`
	MinTolerance    *float64   `json:"min_tolerance,omitempty"`
	MaxTolerance    *float64   `json:"max_tolerance,omitempty"`
	Status          string     `json:"status"`
	CalibrationDate *time.Time `json:"calibration_date,omitempty"`
	ExpiryDate      *time.Time `json:"expiry_date,omitempty"`
	IsExpired       bool       `json:"is_expired"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// ============================================
// VERIFICATION HISTORY
// ============================================

// VerificationHistoryRequest - Filter for verification history
type VerificationHistoryRequest struct {
	InstrumentID *uint      `form:"instrument_id"`
	Status       string     `form:"status"`
	StartDate    *time.Time `form:"start_date"`
	EndDate      *time.Time `form:"end_date"`
	Page         int        `form:"page"`
	Limit        int        `form:"limit"`
}

// VerificationHistoryItem - Single verification in history list
type VerificationHistoryItem struct {
	ID               uint      `json:"id"`
	InstrumentID     uint      `json:"instrument_id"`
	InstrumentName   string    `json:"instrument_name"`
	NoKontrol        string    `json:"no_kontrol"`
	InstrumentType   string    `json:"instrument_type"`
	TemplateName     string    `json:"template_name"`
	VerifiedBy       string    `json:"verified_by"`
	VerifiedAt       time.Time `json:"verified_at"`
	ValidUntil       time.Time `json:"valid_until"`
	Status           string    `json:"status"`
	TotalSteps       int       `json:"total_steps"`
	CompletedSteps   int       `json:"completed_steps"`
	ComplianceStatus string    `json:"compliance_status"` // All Complies, Partial, Not Complies
}

// PaginatedResponse - Generic paginated response
type PaginatedResponse struct {
	Data       interface{} `json:"data"`
	Total      int         `json:"total"`
	Page       int         `json:"page"`
	Limit      int         `json:"limit"`
	TotalPages int         `json:"total_pages"`
}

// ============================================
// VERIFICATION DETAIL
// ============================================

// VerificationDetailResponse - Full verification details for display/PDF
type VerificationDetailResponse struct {
	ID               uint                     `json:"id"`
	InstrumentID     uint                     `json:"instrument_id"`
	NoKontrol        string                   `json:"no_kontrol"`
	NamaInstrument   string                   `json:"nama_instrument"`
	InstrumentType   string                   `json:"instrument_type"`
	TemplateID       uint                     `json:"template_id"`
	TemplateName     string                   `json:"template_name"`
	VerifiedBy       UserBasicInfo            `json:"verified_by"`
	VerifiedAt       time.Time                `json:"verified_at"`
	ValidUntil       time.Time                `json:"valid_until"`
	Status           string                   `json:"status"`
	RoomTemp         *float64                 `json:"room_temp,omitempty"`
	RoomHumidity     *float64                 `json:"room_humidity,omitempty"`
	VerificationData map[string]interface{}   `json:"verification_data,omitempty"`
	Notes            string                   `json:"notes,omitempty"`
	Steps            []VerificationStepDetail `json:"steps"`
	CreatedAt        time.Time                `json:"created_at"`
	UpdatedAt        time.Time                `json:"updated_at"`

	// Supervisor approval
	ApprovalStatus string     `json:"approval_status"`
	ApprovedBy     *uint      `json:"approved_by,omitempty"`
	ApprovedAt     *time.Time `json:"approved_at,omitempty"`
	ApprovalNotes  string     `json:"approval_notes,omitempty"`
}

// ============================================
// SUPERVISOR APPROVAL
// ============================================

// ApproveVerificationRequest - Request body for supervisor approve/reject
type ApproveVerificationRequest struct {
	Approved bool   `json:"approved" validate:"required"`
	Notes    string `json:"notes"`
}

// ApproveVerificationResponse - Response after approval action
type ApproveVerificationResponse struct {
	VerificationID uint      `json:"verification_id"`
	ApprovalStatus string    `json:"approval_status"`
	ApprovedBy     uint      `json:"approved_by"`
	ApprovedAt     time.Time `json:"approved_at"`
	Message        string    `json:"message"`
}

// ============================================
// VERIFICATION LIST (for instruments page)
// ============================================

// VerificationListResponse - Instrument verification status for list
type VerificationListResponse struct {
	InstrumentID    uint       `json:"instrument_id"`
	InstrumentType  string     `json:"instrument_type"`
	NoKontrol       string     `json:"no_kontrol"`
	NamaInstrument  string     `json:"nama_instrument"`
	LastVerifiedAt  *time.Time `json:"last_verified_at"`
	LastVerifiedBy  string     `json:"last_verified_by"`
	ValidUntil      *time.Time `json:"valid_until"`
	Status          string     `json:"status"`
	CanVerifyToday  bool       `json:"can_verify_today"`
	DueDate         *time.Time `json:"due_date"`
	IntervalDays    int        `json:"interval_days"`
	IsOverdue       bool       `json:"is_overdue"`
	CustomStepCount int        `json:"custom_step_count"`
}

// ============================================
// OLD SYSTEM STRUCTS (for backward compatibility)
// ============================================

// StartVerificationRequest - Old start request (kept for compatibility)
type StartVerificationRequest struct {
	InstrumentID uint                   `json:"instrument_id" validate:"required"`
	TemplateID   *uint                  `json:"template_id"` // Optional: override default
	RoomTemp     *float64               `json:"room_temp"`
	RoomHumidity *float64               `json:"room_humidity"`
	InitialData  map[string]interface{} `json:"initial_data"` // Any additional startup data
}

// StartVerificationResponse - Old start response (kept for compatibility)
type StartVerificationResponse struct {
	VerificationID      uint                   `json:"verification_id"`
	InstrumentID        uint                   `json:"instrument_id"`
	InstrumentType      string                 `json:"instrument_type"`
	TemplateID          uint                   `json:"template_id"`
	TemplateName        string                 `json:"template_name"`
	Steps               []VerificationStepInfo `json:"steps"`
	GlobalRules         map[string]interface{} `json:"global_rules"`
	RequiresConnection  bool                   `json:"requires_connection"`
	ConnectionType      string                 `json:"connection_type"`
	Status              string                 `json:"status"`
	TotalSteps          int                    `json:"total_steps"`
	RequiredSteps       int                    `json:"required_steps"`
	CurrentStepNumber   int                    `json:"current_step_number"`
	AvailableReferences map[string]interface{} `json:"available_references"`
	Message             string                 `json:"message"`
}

// VerificationTemplateResponse - Old template response (kept for compatibility)
type VerificationTemplateResponse struct {
	Steps           []VerificationStepInfo `json:"steps"`
	ValidationRules map[string]interface{} `json:"validation_rules"`
}

// VerifyZeroRequest - Verify zero step (Balance specific)
type VerifyZeroRequest struct {
	VerificationID uint `json:"verification_id" validate:"required"`
}

// VerifyZeroResponse - Zero verification response
type VerifyZeroResponse struct {
	Success     bool    `json:"success"`
	ZeroValue   float64 `json:"zero_value"`
	Status      string  `json:"status"`
	Message     string  `json:"message"`
	CanContinue bool    `json:"can_continue"`
}

// VerifyWeightRequest - Verify weight step (Balance specific)
type VerifyWeightRequest struct {
	VerificationID uint     `json:"verification_id" validate:"required"`
	StepNumber     int      `json:"step_number" validate:"required"`
	ReferenceID    uint     `json:"reference_id" validate:"required"`
	MinRange       *float64 `json:"min_range"` // Admin override
	MaxRange       *float64 `json:"max_range"` // Admin override
}

// VerifyWeightResponse - Weight verification response
type VerifyWeightResponse struct {
	Success       bool    `json:"success"`
	StepNumber    int     `json:"step_number"`
	MeasuredValue float64 `json:"measured_value"`
	MinRange      float64 `json:"min_range"`
	MaxRange      float64 `json:"max_range"`
	Status        string  `json:"status"`
	Message       string  `json:"message"`
	CanContinue   bool    `json:"can_continue"`
	NeedsOverride bool    `json:"needs_override"`
}

// VerifyPHConductivityRequest - pH/Conductivity verification request
type VerifyPHConductivityRequest struct {
	VerificationID uint     `json:"verification_id" validate:"required"`
	StepNumber     int      `json:"step_number" validate:"required"`
	ReferenceID    uint     `json:"reference_id" validate:"required"`
	MinRange       *float64 `json:"min_range"` // Admin override
	MaxRange       *float64 `json:"max_range"` // Admin override
}

// VerifyPHConductivityResponse - pH/Conductivity verification response
type VerifyPHConductivityResponse struct {
	Success       bool    `json:"success"`
	StepNumber    int     `json:"step_number"`
	MeasuredValue float64 `json:"measured_value"`
	MinRange      float64 `json:"min_range"`
	MaxRange      float64 `json:"max_range"`
	Status        string  `json:"status"`
	Message       string  `json:"message"`
	CanContinue   bool    `json:"can_continue"`
	NeedsOverride bool    `json:"needs_override"`
}

// OverrideVerificationRequest - Override verification result
type OverrideVerificationRequest struct {
	VerificationID uint   `json:"verification_id" validate:"required"`
	StepNumber     int    `json:"step_number" validate:"required"`
	Reason         string `json:"reason" validate:"required"`
	Action         string `json:"action" validate:"required,oneof=continue breakdown"` // continue or breakdown
}

// CompleteVerificationRequest - Complete verification
type CompleteVerificationRequest struct {
	VerificationID uint   `json:"verification_id" validate:"required"`
	Notes          string `json:"notes"`
}

// CompleteVerificationResponse - Completion response
type CompleteVerificationResponse struct {
	Success        bool      `json:"success"`
	VerificationID uint      `json:"verification_id"`
	Status         string    `json:"status"`
	ValidUntil     time.Time `json:"valid_until"`
	Message        string    `json:"message"`
}

// CancelVerificationRequest - Cancel verification request
type CancelVerificationRequest struct {
	VerificationID uint `json:"verification_id" validate:"required"`
}

// UpdateToleranceRequest - Update tolerance settings
type UpdateToleranceRequest struct {
	InstrumentID uint    `json:"instrument_id" validate:"required"`
	MinTolerance float64 `json:"min_tolerance" validate:"required"`
	MaxTolerance float64 `json:"max_tolerance" validate:"required"`
}

// ToleranceResponse - Tolerance settings
type ToleranceResponse struct {
	InstrumentID uint    `json:"instrument_id"`
	MinTolerance float64 `json:"min_tolerance"`
	MaxTolerance float64 `json:"max_tolerance"`
}

type InstrumentVerificationConfigResponse struct {
	InstrumentID int             `json:"instrument_id"`
	IntervalDays int             `json:"interval_days"`
	DueDate      *time.Time      `json:"due_date"`
	CustomSteps  []CustomStepDTO `json:"custom_steps"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

type CustomStepDTO struct {
	ID          string `json:"id"`
	Description string `json:"description"`
	Order       int    `json:"order"`
}
