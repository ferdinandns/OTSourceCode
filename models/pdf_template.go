package models

import (
	"time"
)

// PDFTemplate - Template konfigurasi PDF per instrument type
type PDFTemplate struct {
	Id             uint   `json:"id" gorm:"primaryKey"`
	InstrumentType string `json:"instrument_type" gorm:"type:varchar(100);uniqueIndex"`
	TemplateName   string `json:"template_name" gorm:"type:varchar(255)"`

	// Sections yang mau ditampilkan (JSON array)
	// ["cover", "instrument_info", "test_conditions", "results", "signature"]
	Sections string `json:"sections" gorm:"type:text"`

	// Custom fields untuk display (JSON object)
	// {"fields": ["temperature", "humidity", "operator"], "show_charts": true}
	CustomConfig string `json:"custom_config" gorm:"type:text"`

	// Company branding
	HeaderText    string `json:"header_text" gorm:"type:text"`
	FooterText    string `json:"footer_text" gorm:"type:text"`
	LogoPath      string `json:"logo_path" gorm:"type:varchar(255)"`
	WatermarkText string `json:"watermark_text" gorm:"type:varchar(100)"`

	IsActive  bool      `json:"is_active" gorm:"default:true"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// PDFTemplateSection - Section configuration
type PDFTemplateSection struct {
	Name    string   `json:"name"`  // "cover", "results", dll
	Title   string   `json:"title"` // "Test Results"
	Enabled bool     `json:"enabled"`
	Order   int      `json:"order"`
	Fields  []string `json:"fields"` // Field names to display
}
