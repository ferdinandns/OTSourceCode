package migrations

import (
	"fmt"
	"log"
	"strings"

	"emertrack/internal/domain"
	"gorm.io/gorm"
)

// AutoMigrate menjalankan migrasi otomatis untuk semua model.
func AutoMigrate(db *gorm.DB) error {
	// 1. Buat enum types terlebih dahulu
	if err := createEnums(db); err != nil {
		return fmt.Errorf("Failed to create enum : %w", err)
	}

	// 2. Migrasi tabel
	if err := db.AutoMigrate(
		// User & auth
		&domain.User{},
		&domain.UserRole{},
		&domain.UserSarprasType{},

		// Master data
		&domain.Site{},
		&domain.Department{},

		// Sarpras
		&domain.SarprasType{},
		&domain.Parameter{},
		&domain.Sarpras{},

		// Inspection
		&domain.InspectionSchedule{},
		&domain.Inspection{},
		&domain.InspectionItem{},

		// Repair
		&domain.RepairOrder{},
		&domain.RepairSubmission{},
		&domain.RepairEvidence{},

		// Review
		&domain.ReviewOrder{},
		&domain.ReviewAttachment{},

		// Refill
		&domain.RefillOrder{},
		&domain.RefillOrderItem{},
		&domain.SarprasUsageLog{},

		// Approval
		&domain.ApprovalRequest{},

		// Notification
		&domain.Notification{},

		// Audit
		&domain.AuditLog{},
	); err != nil {
		return fmt.Errorf("Failed migrate the table : %w", err)
	}

	return nil
}

// Enums
func createEnums(db *gorm.DB) error {
	enums := map[string][]string{
		"approval_action_enum":   {"create", "edit", "delete"},
		"approval_status_enum":   {"pending", "approved", "rejected"},
		"inspection_result_enum": {"OK", "NOK"},
		"refill_item_status":     {"in_progress", "waiting_review", "approved", "rejected"},
		"refill_order_status":    {"pending", "waiting_review", "completed", "rejected"},
		"repair_status_enum":     {"assigned", "in_progress", "submitted", "approved", "rejected", "in_review"},
		"risk_level_enum":        {"low", "medium", "high", "very_high"},
		"sarpras_status_enum":    {"not_ready", "ready", "need_repair", "will_be_repaired", "waiting_verification"},
		"schedule_status_enum":   {"pending", "done", "overdue", "in_progress"},
		"user_role_enum":         {"admin", "checker", "pic_responsibility", "qs"},
	}

	for name, values := range enums {
		var exists bool
		err := db.Raw("SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = ?)", name).Scan(&exists).Error
		if err != nil {
			return fmt.Errorf("Failed to check enum %s: %w", name, err)
		}
		if exists {
			continue
		}

		// Buat enum
		query := fmt.Sprintf("CREATE TYPE %s AS ENUM ('%s')", name, strings.Join(values, "', '"))
		if err := db.Exec(query).Error; err != nil {
			return fmt.Errorf("Failed to create enum %s: %w", name, err)
		}
		log.Printf("✅ Enum %s created successfully\n", name)
	}

	return nil
}
