package audit

import (
	"emertrack/internal/domain"
	"gorm.io/gorm"
)

func Record(tx *gorm.DB, userID uint, action, menu, description string, entityID uint, data interface{}) error {
	if description == "" {
		description = "No description provided"
	}

	var eID *uint
	if entityID != 0 {
		eID = &entityID
	}

	// 3. Inisialisasi struct
	auditLog := &domain.AuditLog{
		UserID:      userID,
		Action:      action,
		Menu:        menu,
		EntityID:    eID,
		Description: description,
	}

	return tx.Create(auditLog).Error
}
