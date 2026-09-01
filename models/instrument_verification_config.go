package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"
)

// CustomStep is a simple free-text step defined per-instrument by the user.
type CustomStep struct {
	ID          string `json:"id"`          // UUID so React can key it
	Description string `json:"description"` // Free-text step description
	Order       int    `json:"order"`       // Display order
}

// CustomStepArray is a JSON-serialisable slice of CustomStep.
type CustomStepArray []CustomStep

func (c CustomStepArray) Value() (driver.Value, error) {
	if c == nil {
		return json.Marshal([]CustomStep{})
	}
	return json.Marshal(c)
}

func (c *CustomStepArray) Scan(value interface{}) error {
	if value == nil {
		*c = []CustomStep{}
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}
	return json.Unmarshal(bytes, c)
}

// InstrumentVerificationConfig stores per-instrument verification schedule and custom steps.
// 1-to-1 with Instrument.
type InstrumentVerificationConfig struct {
	Id           uint `json:"id" gorm:"primaryKey"`
	InstrumentID uint `json:"instrument_id" gorm:"not null;uniqueIndex"`

	// How often this instrument must be verified (in days). 1 = daily (default).
	IntervalDays int `json:"interval_days" gorm:"default:1"`

	// The date by which the next verification must be completed.
	// Re-calculated as VerifiedAt + IntervalDays each time a verification Complies.
	DueDate *time.Time `json:"due_date" gorm:"type:timestamp"`

	// Free-text custom steps defined by the user for this specific instrument.
	// Displayed as a checklist alongside template-driven steps during verification.
	CustomSteps CustomStepArray `json:"custom_steps" gorm:"type:jsonb;default:'[]'"`

	UpdatedBy *uint     `json:"updated_by"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Relations
	Instrument Instrument `gorm:"foreignKey:InstrumentID;constraint:OnDelete:CASCADE"`
	User       User       `gorm:"foreignKey:UpdatedBy;constraint:OnDelete:SET NULL"`
}

func (InstrumentVerificationConfig) TableName() string {
	return "instrument_verification_configs"
}
