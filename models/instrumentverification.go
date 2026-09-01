package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

// ============================================
// JSONB TYPES
// ============================================

// JSONB type for dynamic data storage
type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(value interface{}) error {
	if value == nil {
		*j = make(JSONB)
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}
	return json.Unmarshal(bytes, j)
}

// StepConfigArray for array of step configs
type StepConfigArray []StepConfig

func (s StepConfigArray) Value() (driver.Value, error) {
	if s == nil {
		return json.Marshal([]StepConfig{})
	}
	return json.Marshal(s)
}

func (s *StepConfigArray) Scan(value interface{}) error {
	if value == nil {
		*s = []StepConfig{}
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}
	return json.Unmarshal(bytes, s)
}

// Float64Array for array of float64
type Float64Array []float64

func (f Float64Array) Value() (driver.Value, error) {
	if f == nil {
		return json.Marshal([]float64{})
	}
	return json.Marshal(f)
}

func (f *Float64Array) Scan(value interface{}) error {
	if value == nil {
		*f = []float64{}
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}
	return json.Unmarshal(bytes, f)
}

// ============================================
// STEP CONFIGURATION
// ============================================

// StepConfig defines the configuration for a verification step
type StepConfig struct {
	StepNumber      int    `json:"step_number"`
	StepName        string `json:"step_name"`
	StepType        string `json:"step_type"` // auto_read, manual_input, selection, multi_reading, calculation
	Description     string `json:"description"`
	Required        bool   `json:"required"`
	InputType       string `json:"input_type,omitempty"`       // number, text, dropdown, multi_select, checkbox
	Unit            string `json:"unit,omitempty"`             // g, mL, pH, μS/cm, etc.
	ValidationRules JSONB  `json:"validation_rules,omitempty"` // min, max, pattern, tolerance, etc.
	DependsOn       []int  `json:"depends_on,omitempty"`       // Steps that must complete first
	ReferenceType   string `json:"reference_type,omitempty"`   // anak_timbang, buffer_ph, buffer_cond
	ReadingCount    int    `json:"reading_count,omitempty"`    // For multi-reading steps
	CalculationExpr string `json:"calculation_expr,omitempty"` // For calculated values
	UIComponent     string `json:"ui_component,omitempty"`     // Custom UI component name
	Metadata        JSONB  `json:"metadata,omitempty"`         // Additional config (read_mode, etc.)
}

func (s *StepConfig) Scan(value interface{}) error {
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New(fmt.Sprint("Failed to unmarshal JSONB value:", value))
	}

	return json.Unmarshal(bytes, s)
}

// ✅ Implement driver.Valuer interface
func (s StepConfig) Value() (driver.Value, error) {
	return json.Marshal(s)
}

// ============================================
// VERIFICATION TEMPLATE
// ============================================

// VerificationTemplate - Template that defines verification flow for instrument types
type VerificationTemplate struct {
	Id             uint            `json:"id" gorm:"primaryKey"`
	TemplateName   string          `json:"template_name" gorm:"type:varchar(255);not null;"`
	InstrumentType string          `json:"instrument_type" gorm:"type:varchar(100);not null;index"`
	Description    string          `json:"description" gorm:"type:text"`
	Version        int             `json:"version" gorm:"default:1"`
	Steps          StepConfigArray `json:"steps" gorm:"type:jsonb;not null"`

	// Global validation rules
	GlobalRules JSONB `json:"global_rules" gorm:"type:jsonb"`

	// Connection requirements
	RequiresConnection bool   `json:"requires_connection" gorm:"default:true"`
	ConnectionType     string `json:"connection_type,omitempty"` // serial, tcp, tibbo, none

	// Completion behavior
	AutoCompleteOnSuccess  bool `json:"auto_complete_on_success" gorm:"default:false"`
	AllowPartialCompletion bool `json:"allow_partial_completion" gorm:"default:false"`

	IsActive  bool      `json:"is_active" gorm:"default:true"`
	IsDefault bool      `json:"is_default" gorm:"default:false"` // Default template for instrument type
	CreatedBy uint      `json:"created_by"`
	UpdatedBy *uint     `json:"updated_by"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Relations
	Creator User `gorm:"foreignKey:CreatedBy;constraint:OnDelete:SET NULL"`
	Updater User `gorm:"foreignKey:UpdatedBy;constraint:OnDelete:SET NULL"`
}

// TableName specifies the table name
func (VerificationTemplate) TableName() string {
	return "verification_templates"
}

// ============================================
// INSTRUMENT VERIFICATION (Main Record)
// ============================================

// InstrumentVerification - Main verification record
type InstrumentVerification struct {
	Id           uint      `json:"id" gorm:"primaryKey"`
	InstrumentID uint      `json:"instrument_id" gorm:"not null;index"`
	TemplateID   *uint     `json:"template_id"` // Which template was used
	VerifiedBy   uint      `json:"verified_by" gorm:"not null"`
	VerifiedAt   time.Time `json:"verified_at" gorm:"not null"`
	ValidUntil   time.Time `json:"valid_until" gorm:"not null"`

	// Status: In Progress, Complies, Not Complies, Breakdown, Cancelled
	Status string `json:"status" gorm:"type:varchar(50);not null;default:'In Progress'"`

	// Environmental conditions
	RoomTemp     *float64 `json:"room_temp"`
	RoomHumidity *float64 `json:"room_humidity"`

	// Summary data (aggregated from steps)
	VerificationData JSONB `json:"verification_data" gorm:"type:jsonb"`

	// Notes
	Notes string `json:"notes" gorm:"type:text"`

	SyncStatus string     `json:"sync_status" gorm:"type:varchar(10);not null;default:'synced';index"`
	SyncedAt   *time.Time `json:"synced_at"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Relations
	Instrument  Instrument            `gorm:"foreignKey:InstrumentID;constraint:OnDelete:CASCADE"`
	Template    *VerificationTemplate `gorm:"foreignKey:TemplateID;constraint:OnDelete:SET NULL"`
	User        User                  `gorm:"foreignKey:VerifiedBy;constraint:OnDelete:SET NULL"`
	Steps       []VerificationStep    `gorm:"foreignKey:VerificationID;constraint:OnDelete:CASCADE"`
	CancelledAt *time.Time            `gorm:"type:timestamp" json:"cancelled_at,omitempty"`

	ApprovalStatus string     `json:"approval_status"`
	ApprovedBy     *uint      `json:"approved_by,omitempty"`
	ApprovedAt     *time.Time `json:"approved_at,omitempty"`
	ApprovalNotes  string     `json:"approval_notes"`
}

// TableName specifies the table name
func (InstrumentVerification) TableName() string {
	return "instrument_verifications"
}

// ============================================
// VERIFICATION STEP
// ============================================

// VerificationStep - Individual step execution record
type VerificationStep struct {
	Id             uint   `json:"id" gorm:"primaryKey"`
	VerificationID uint   `json:"verification_id" gorm:"not null;index"`
	StepNumber     int    `json:"step_number" gorm:"not null"`
	StepName       string `json:"step_name" gorm:"type:varchar(100);not null"`
	StepType       string `json:"step_type" gorm:"type:varchar(50);not null"`

	// Status: Pending, In Progress, Ready, Complies, Not Complies, Completed, Skipped, Failed
	Status string `json:"status" gorm:"type:varchar(50);not null;default:'Pending'"`

	// Step configuration (from template)
	StepConfig StepConfig `json:"step_config" gorm:"type:jsonb"`

	// Execution data
	InputData     JSONB  `json:"input_data" gorm:"type:jsonb"`    // User inputs
	ReadingData   JSONB  `json:"reading_data" gorm:"type:jsonb"`  // Instrument readings
	ResultData    JSONB  `json:"result_data" gorm:"type:jsonb"`   // Calculated results
	ValidationMsg string `json:"validation_msg" gorm:"type:text"` // Validation feedback

	// Reference handling (if applicable)
	ReferenceID   *uint  `json:"reference_id"`
	ReferenceType string `json:"reference_type" gorm:"type:varchar(50)"`

	// Tolerance/Range (if applicable)
	ExpectedValue *float64 `json:"expected_value"`
	MinValue      *float64 `json:"min_value"`
	MaxValue      *float64 `json:"max_value"`
	MeasuredValue *float64 `json:"measured_value"`

	// Multiple readings support
	Readings Float64Array `json:"readings" gorm:"type:jsonb"`

	// Override capability
	OverrideReason string     `json:"override_reason" gorm:"type:text"`
	OverriddenBy   *uint      `json:"overridden_by"`
	OverriddenAt   *time.Time `json:"overridden_at"`

	// Timing
	StartedAt   *time.Time `json:"started_at"`
	CompletedAt *time.Time `json:"completed_at"`
	Duration    *int       `json:"duration"` // seconds

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Relations
	Verification InstrumentVerification `gorm:"foreignKey:VerificationID;constraint:OnDelete:CASCADE"`
	Reference    *VerificationReference `gorm:"foreignKey:ReferenceID;constraint:OnDelete:SET NULL"`
	OverrideUser *User                  `gorm:"foreignKey:OverriddenBy;constraint:OnDelete:SET NULL"`
}

// TableName specifies the table name
func (VerificationStep) TableName() string {
	return "verification_steps"
}

// ============================================
// VERIFICATION REFERENCE (Standards/Buffers)
// ============================================

// VerificationReference - Reference materials for verification (weights, buffers, etc.)
type VerificationReference struct {
	Id            uint   `json:"id" gorm:"primaryKey"`
	InstrumentID  uint   `json:"instrument_id" gorm:"not null;index"`
	ReferenceType string `json:"reference_type" gorm:"type:varchar(50);not null"` // anak_timbang, buffer_ph, buffer_cond
	NoKontrol     string `json:"no_kontrol" gorm:"type:varchar(50);not null"`
	Name          string `json:"name" gorm:"type:varchar(255)"`

	// For weights (anak timbang)
	NominalValue *float64 `json:"nominal_value"`

	// For buffers (pH, conductivity)
	BufferValue *float64 `json:"buffer_value"` // pH 4, pH 7, Cond 1413 μS/cm

	// Tolerance range
	MinTolerance *float64 `json:"min_tolerance"`
	MaxTolerance *float64 `json:"max_tolerance"`

	// Status
	Status string `json:"status" gorm:"type:varchar(50);default:'Active'"` // Active, Inactive, Expired

	// Calibration info
	CalibrationDate *time.Time `json:"calibration_date"`
	ExpiryDate      *time.Time `json:"expiry_date"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Relations
	Instrument Instrument `gorm:"foreignKey:InstrumentID;constraint:OnDelete:CASCADE"`
}

// TableName specifies the table name
func (VerificationReference) TableName() string {
	return "verification_references"
}

// ============================================
// INSTRUMENT TEMPLATE MAPPING
// ============================================

// InstrumentTemplate - Maps specific instruments to templates
type InstrumentTemplate struct {
	Id           uint `json:"id" gorm:"primaryKey"`
	InstrumentID uint `json:"instrument_id" gorm:"not null;uniqueIndex"`
	TemplateID   uint `json:"template_id" gorm:"not null"`

	// Override template settings per instrument
	OverrideConfig JSONB `json:"override_config" gorm:"type:jsonb"`

	IsActive  bool      `json:"is_active" gorm:"default:true"`
	UpdatedBy *uint     `json:"updated_by"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Relations
	Instrument Instrument           `gorm:"foreignKey:InstrumentID;constraint:OnDelete:CASCADE"`
	Template   VerificationTemplate `gorm:"foreignKey:TemplateID;constraint:OnDelete:RESTRICT"`
	User       User                 `gorm:"foreignKey:UpdatedBy;constraint:OnDelete:SET NULL"`
}

// TableName specifies the table name
func (InstrumentTemplate) TableName() string {
	return "instrument_templates"
}

// ============================================
// STEP EXECUTION LOG (for debugging)
// ============================================

// StepExecutionLog - Detailed log of step execution
type StepExecutionLog struct {
	Id                 uint      `json:"id" gorm:"primaryKey"`
	VerificationStepID uint      `json:"verification_step_id" gorm:"not null;index"`
	ExecutionOrder     int       `json:"execution_order"`
	Action             string    `json:"action" gorm:"type:varchar(100)"` // read, validate, calculate, override
	Input              JSONB     `json:"input" gorm:"type:jsonb"`
	Output             JSONB     `json:"output" gorm:"type:jsonb"`
	Success            bool      `json:"success"`
	ErrorMessage       string    `json:"error_message" gorm:"type:text"`
	ExecutedAt         time.Time `json:"executed_at"`

	// Relations
	Step VerificationStep `gorm:"foreignKey:VerificationStepID;constraint:OnDelete:CASCADE"`
}

// TableName specifies the table name
func (StepExecutionLog) TableName() string {
	return "step_execution_logs"
}

// ============================================
// HELPER METHODS
// ============================================

// Template helpers
func (t *VerificationTemplate) GetStepByNumber(stepNumber int) *StepConfig {
	for i := range t.Steps {
		if t.Steps[i].StepNumber == stepNumber {
			return &t.Steps[i]
		}
	}
	return nil
}

func (t *VerificationTemplate) GetRequiredSteps() []StepConfig {
	var required []StepConfig
	for _, step := range t.Steps {
		if step.Required {
			required = append(required, step)
		}
	}
	return required
}

func (t *VerificationTemplate) GetTotalSteps() int {
	return len(t.Steps)
}

func (s *VerificationStep) IsTerminal() bool {
	return s.Status == "Complies" ||
		s.Status == "Completed" ||
		s.Status == "Not Complies" ||
		s.Status == "Failed"
}
func (s *VerificationStep) IsFailed() bool {
	return s.Status == "Not Complies" || s.Status == "Failed"
}

func (s *VerificationStep) IsPending() bool {
	return s.Status == "Pending"
}

func (s *VerificationStep) IsReady() bool {
	return s.Status == "Ready"
}

func (s *VerificationStep) CalculateDuration() {
	if s.StartedAt != nil && s.CompletedAt != nil {
		duration := int(s.CompletedAt.Sub(*s.StartedAt).Seconds())
		s.Duration = &duration
	}
}

// Verification helpers
func (v *InstrumentVerification) IsInProgress() bool {
	return v.Status == "In Progress"
}

func (s *VerificationStep) IsCompleted() bool {
	return s.Status == "Complies" ||
		s.Status == "Completed" ||
		s.Status == "Not Complies" ||
		s.Status == "Failed"
}

// CanBeCancelled checks if verification can be cancelled
func (v *InstrumentVerification) CanBeCancelled() bool {
	// Only in-progress or pending verifications can be cancelled
	return v.Status == "In Progress" || v.Status == "Pending"
}

// Reference helpers
func (r *VerificationReference) IsExpired() bool {
	if r.ExpiryDate == nil {
		return false
	}
	return time.Now().After(*r.ExpiryDate)
}

func (r *VerificationReference) IsActive() bool {
	return r.Status == "Active" && !r.IsExpired()
}
