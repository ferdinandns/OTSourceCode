package models

import (
	"time"
)

type UsageResult struct {
	Id                uint      `json:"id" gorm:"primaryKey"`
	InstrumentUsageID uint      `json:"instrument_usage_id" gorm:"not null"`
	NoQCBatch         string    `json:"no_qc_batch" gorm:"type:varchar(255)"`
	ItemNumber        int       `json:"item_number"`                  // Item ke berapa
	ResultData        string    `json:"result_data" gorm:"type:text"` // JSON hasil pembacaan
	IsReread          bool      `json:"is_reread" gorm:"default:false"`
	CreatedAt         time.Time `json:"created_at"`
	BridgeReadingID   *uint 		`json:"bridge_reading_id" gorm:"index"`
	// Relasi
	InstrumentUsage InstrumentUsage `gorm:"foreignKey:InstrumentUsageID;constraint:OnDelete:CASCADE"`
	BridgeReading	BridgeReading   `gorm:"foreignKey:BridgeReadingID;constraint:OnDelete:SET NULL"`
}
