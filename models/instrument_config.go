package models

import (
	"encoding/json"
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type InstrumentConfig struct {
	Id           uint `json:"id" gorm:"primaryKey"`
	InstrumentID uint `json:"instrument_id" gorm:"unique;not null"`

	// Serial Configuration
	BaudRate int    `json:"baud_rate"`
	DataBits int    `json:"data_bits"`
	StopBits int    `json:"stop_bits"`
	Parity   string `json:"parity" gorm:"type:varchar(50)"`
	ComPort  string `json:"com_port" gorm:"type:varchar(100)"`

	// TCP/IP Configuration
	IPAddress string `json:"ip_address" gorm:"type:varchar(100)"`
	TCPPort   int    `json:"tcp_port"`
	Timeout   int    `json:"timeout"`

	// Data Processing
	RegexPattern string `json:"regex_pattern" gorm:"type:text"`
	BlockAnchor  string `json:"block_anchor" gorm:"type:varchar(255)"`

	// Multi-line support and filtering
	LinesPerItem       int  `json:"lines_per_item" gorm:"default:1;not null"`
	RegexFilterEnabled bool `json:"regex_filter_enabled" gorm:"default:false;not null"`

	CustomCommands string `json:"custom_commands" gorm:"type:text"`
	ReadCommand    string `json:"read_command" gorm:"type:varchar(50);default:'S'"`

	ReadingMode   string          `json:"reading_mode" gorm:"type:varchar(50);default:auto"`
	NeedsBatch    bool            `json:"needs_batch" gorm:"default:true"`
	NeedsSample   bool            `json:"needs_sample" gorm:"default:true"`
	ReadingSchema json.RawMessage `json:"reading_schema" gorm:"type:jsonb"`

	// File Paths
	FilePath  string `json:"file_path" gorm:"type:varchar(255)"`
	FilePath2 string `json:"file_path2" gorm:"type:varchar(255)"`

	PDFColumns datatypes.JSON `gorm:"type:json" json:"pdf_columns"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	Instrument Instrument `gorm:"foreignKey:InstrumentID;constraint:OnDelete:CASCADE"`
}

// Helper methods
func (c *InstrumentConfig) GetLinesPerItem() int {
	if c.LinesPerItem <= 0 {
		return 1
	}
	return c.LinesPerItem
}

func (c *InstrumentConfig) IsRegexFilterEnabled() bool {
	return c.RegexFilterEnabled
}

func (c *InstrumentConfig) HasMultiLineSupport() bool {
	return c.LinesPerItem > 1
}
