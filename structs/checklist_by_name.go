package structs

import (
	"lab-connect/backend-api/models"
	"time"
)

// ==================== CHECKLIST BY NAME STRUCTS ====================

// ChecklistByNameSummary - Summary list untuk admin page
type ChecklistByNameSummary struct {
	ID                  uint      `json:"id"`
	InstrumentName      string    `json:"instrument_name"`
	InitialItemsCount   int       `json:"initial_items_count"`
	FinalItemsCount     int       `json:"final_items_count"`
	RequireAllInitialOK bool      `json:"require_all_initial_ok"`
	RequireAllFinalOK   bool      `json:"require_all_final_ok"`
	Description         string    `json:"description"`
	IsActive            bool      `json:"is_active"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

// ChecklistByNameDetail - Detail untuk edit page
type ChecklistByNameDetail struct {
	ID                    uint                   `json:"id"`
	InstrumentName        string                 `json:"instrument_name"`
	InitialChecklistItems []models.ChecklistItem `json:"initial_checklist_items"`
	FinalChecklistItems   []models.ChecklistItem `json:"final_checklist_items"`
	RequireAllInitialOK   bool                   `json:"require_all_initial_ok"`
	RequireAllFinalOK     bool                   `json:"require_all_final_ok"`
	Description           string                 `json:"description"`
	IsActive              bool                   `json:"is_active"`
	CreatedAt             time.Time              `json:"created_at"`
	UpdatedAt             time.Time              `json:"updated_at"`
}

// CreateChecklistByNameRequest - Request untuk create/update
// 🔧 FIXED: Removed InstrumentType validation requirement
type CreateChecklistByNameRequest struct {
	InstrumentName        string                 `json:"instrument_name" validate:"required"`
	InitialChecklistItems []models.ChecklistItem `json:"initial_checklist_items" validate:"required"`
	FinalChecklistItems   []models.ChecklistItem `json:"final_checklist_items" validate:"required"`
	RequireAllInitialOK   bool                   `json:"require_all_initial_ok"`
	RequireAllFinalOK     bool                   `json:"require_all_final_ok"`
	Description           string                 `json:"description"`
}

// InstrumentNameWithChecklistStatus - Untuk list instrument names dengan status checklist
type InstrumentNameWithChecklistStatus struct {
	InstrumentName     string `json:"instrument_name"`
	InstrumentCount    int    `json:"instrument_count"` // Jumlah instrument dengan nama ini
	HasCustomChecklist bool   `json:"has_custom_checklist"`
}

// ChecklistResponse - Response dengan source info
type ChecklistResponse struct {
	Source              string                 `json:"source"` // "individual", "by_name", "template"
	InstrumentID        uint                   `json:"instrument_id"`
	InstrumentName      string                 `json:"instrument_name"`
	InstrumentType      string                 `json:"instrument_type"`
	Items               []models.ChecklistItem `json:"items"`
	RequireAllInitialOK bool                   `json:"require_all_initial_ok"`
	RequireAllFinalOK   bool                   `json:"require_all_final_ok"`
}
