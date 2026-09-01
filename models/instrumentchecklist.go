package models

import (
	"time"

	"gorm.io/gorm"
)

// InstrumentChecklistTemplate - Template checklist per tipe instrument
type InstrumentChecklistTemplate struct {
	Id             uint   `json:"id" gorm:"primaryKey"`
	InstrumentType string `json:"instrument_type" gorm:"type:varchar(100);not null;uniqueIndex"` // Equipment, Instrument
	TemplateName   string `json:"template_name" gorm:"type:varchar(255);not null"`
	Description    string `json:"description" gorm:"type:text"`

	// Checklist Items dalam format JSON array
	// Format: [{"id": 1, "label": "Alat dalam keadaan bersih", "type": "boolean"}, ...]
	InitialChecklistItems string `json:"initial_checklist_items" gorm:"type:text;not null"`
	FinalChecklistItems   string `json:"final_checklist_items" gorm:"type:text;not null"`

	IsActive  bool      `json:"is_active" gorm:"default:true"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Checklist configuration per NAMA instrument (e.g., "Timbangan", "pH Meter")
type InstrumentChecklistByName struct {
	Id             uint   `json:"id" gorm:"primaryKey"`
	InstrumentName string `json:"instrument_name" gorm:"type:varchar(255);not null"` // NO uniqueIndex - managed manually

	// Checklist Items (override dari template type)
	InitialChecklistItems string `json:"initial_checklist_items" gorm:"type:text;not null"`
	FinalChecklistItems   string `json:"final_checklist_items" gorm:"type:text;not null"`

	// Validation settings
	RequireAllInitialOK bool `json:"require_all_initial_ok" gorm:"default:true"`
	RequireAllFinalOK   bool `json:"require_all_final_ok" gorm:"default:false"`

	Description string    `json:"description" gorm:"type:text"`
	IsActive    bool      `json:"is_active" gorm:"default:true"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// InstrumentChecklistConfig - Konfigurasi checklist untuk instrument tertentu
// Jika instrument tertentu butuh checklist custom (bukan dari template umum)
type InstrumentChecklistConfig struct {
	Id           uint `json:"id" gorm:"primaryKey"`
	InstrumentID uint `json:"instrument_id" gorm:"uniqueIndex;not null"`

	// Override dari template, atau null jika pakai template
	InitialChecklistItems *string `json:"initial_checklist_items" gorm:"type:text"`
	FinalChecklistItems   *string `json:"final_checklist_items" gorm:"type:text"`

	// Additional fields untuk validasi otomatis
	RequireAllInitialOK bool `json:"require_all_initial_ok" gorm:"default:true"` // Semua harus OK untuk bisa start
	RequireAllFinalOK   bool `json:"require_all_final_ok" gorm:"default:false"`  // Boleh NOT OK di akhir

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	Instrument Instrument `gorm:"foreignKey:InstrumentID;constraint:OnDelete:CASCADE"`
}

// ChecklistItem - Struktur untuk parsing JSON checklist
type ChecklistItem struct {
	ID          int      `json:"id"`
	Label       string   `json:"label"`
	Type        string   `json:"type"`                // boolean, text, number
	Required    bool     `json:"required"`            // Apakah wajib diisi
	CriticalOK  bool     `json:"critical_ok"`         // Jika false, instrument jadi Unavailable
	HelpText    string   `json:"help_text"`           // Petunjuk tambahan
	Placeholder string   `json:"placeholder"`         // Untuk text/number input
	MinValue    *float64 `json:"min_value,omitempty"` // Untuk number validation
	MaxValue    *float64 `json:"max_value,omitempty"`
}

// ChecklistResponse - Response dari user saat isi checklist
type ChecklistResponse struct {
	ID    int         `json:"id"`
	Value interface{} `json:"value"` // bool, string, atau number
	OK    bool        `json:"ok"`    // Apakah item ini OK
	Note  string      `json:"note"`  // Catatan tambahan (optional)
}
