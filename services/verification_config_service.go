package services

import (
	"lab-connect/backend-api/database"
	"lab-connect/backend-api/models"
	"time"

	"gorm.io/gorm"
)

type VerificationConfigService struct {
	db *gorm.DB
}

func NewVerificationConfigService() *VerificationConfigService {
	return &VerificationConfigService{db: database.DB}
}

// GetOrCreateConfig retrieves (or lazily creates) the verification config for an instrument.
func (s *VerificationConfigService) GetOrCreateConfig(instrumentID uint) (*models.InstrumentVerificationConfig, error) {
	var config models.InstrumentVerificationConfig
	err := s.db.Where("instrument_id = ?", instrumentID).First(&config).Error
	if err == gorm.ErrRecordNotFound {
		config = models.InstrumentVerificationConfig{
			InstrumentID: instrumentID,
			IntervalDays: 1,
			CustomSteps:  models.CustomStepArray{},
			UpdatedBy:    nil, // nullable — no FK violation on creation
		}

		if err := s.db.Create(&config).Error; err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	}
	return &config, nil
}

// UpdateConfig saves interval + custom steps and returns the updated config.
func (s *VerificationConfigService) UpdateConfig(
	instrumentID uint,
	intervalDays int,
	rawSteps []struct {
		ID          string `json:"id"`
		Description string `json:"description"`
		Order       int    `json:"order"`
	},
	updatedBy uint,
) (*models.InstrumentVerificationConfig, error) {
	config, err := s.GetOrCreateConfig(instrumentID)
	if err != nil {
		return nil, err
	}

	steps := make(models.CustomStepArray, len(rawSteps))
	for i, rs := range rawSteps {
		steps[i] = models.CustomStep{
			ID:          rs.ID,
			Description: rs.Description,
			Order:       rs.Order,
		}
	}

	if intervalDays < 1 {
		intervalDays = 1
	}

	updatedByPtr := &updatedBy
	config.IntervalDays = intervalDays
	config.CustomSteps = steps
	config.UpdatedBy = updatedByPtr

	if err := s.db.Save(config).Error; err != nil {
		return nil, err
	}

	return config, nil
}

// RecalculateDueDate is called after a successful (Complies) verification.
// It sets DueDate = verifiedAt + IntervalDays for the instrument.
func (s *VerificationConfigService) RecalculateDueDate(instrumentID uint, verifiedAt time.Time) error {
	config, err := s.GetOrCreateConfig(instrumentID)
	if err != nil {
		return err
	}
	due := verifiedAt.AddDate(0, 0, config.IntervalDays)
	config.DueDate = &due
	return s.db.Save(config).Error
}

// MarkOverdueInstrumentsUnavailable scans all configs with a past DueDate where
// the instrument has not been verified yet today, and flips the instrument status
// to "Unavailable". Call this from a cron job or on each list request.
func (s *VerificationConfigService) MarkOverdueInstrumentsUnavailable() error {
	now := time.Now()
	var configs []models.InstrumentVerificationConfig
	if err := s.db.Where("due_date IS NOT NULL AND due_date < ?", now).
		Preload("Instrument").Find(&configs).Error; err != nil {
		return err
	}

	for _, cfg := range configs {
		// Check if verified (Complies) today already
		today := now.Truncate(24 * time.Hour)
		var count int64
		s.db.Model(&models.InstrumentVerification{}).
			Where("instrument_id = ? AND DATE(verified_at) = ? AND status = ?",
				cfg.InstrumentID, today.Format("2006-01-02"), "Complies").
			Count(&count)

		if count == 0 && cfg.Instrument.Status != "Unavailable" {
			s.db.Model(&models.Instrument{}).
				Where("id = ?", cfg.InstrumentID).
				Update("status", "Unavailable")
		}
	}
	return nil
}
