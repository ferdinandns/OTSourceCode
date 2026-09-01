// OPTIONAL: Update models/instrumentusage.go
// Make EndTime nullable since it's only set when reading completes

package models

import (
	"time"

	"gorm.io/gorm"
)

type InstrumentUsage struct {
	Id           uint `json:"id" gorm:"primaryKey"`
	InstrumentID uint `json:"instrument_id" gorm:"not null"`
	UserID       uint `json:"user_id" gorm:"not null"`

	// Waktu Penggunaan
	StartTime time.Time  `json:"start_time" gorm:"not null"`
	EndTime   *time.Time `json:"end_time"` // ← CHANGED: Make nullable (remove not null)

	// Data Sampel
	KategoriSampel string `json:"kategori_sampel" gorm:"type:varchar(255)"`
	Sampel         string `json:"sampel" gorm:"type:text"`      // JSON array
	NoQCBatch      string `json:"no_qc_batch" gorm:"type:text"` // JSON array
	JumlahItem     int    `json:"jumlah_item"`

	// Kondisi Instrument
	InitialCondition string `json:"initial_condition" gorm:"type:text"`      // JSON
	FinalCondition   string `json:"final_condition" gorm:"type:varchar(50)"` // OK/NOT OK

	// Status
	StatusPenggunaan string `json:"status_penggunaan" gorm:"type:varchar(50)"` // Read Process, Done Read, Re-read
	IsExported       bool   `json:"is_exported" gorm:"default:false"`

	// Additional Fields per Instrument Type
	AdditionalData string `json:"additional_data" gorm:"type:text"` // JSON untuk data tambahan

	// Re-read tracking
	ParentUsageID    *uint      `json:"parent_usage_id"` // Jika ini adalah uji ulang
	RereadReason     string     `json:"reread_reason" gorm:"type:text"`
	RereadItemNumber *int       `json:"reread_item_number"` // Specific item number
	ApprovedBy       *uint      `json:"approved_by"`        // Supervisor approval
	ApprovedAt       *time.Time `json:"approved_at"`

	ResultStatus string `json:"result_status" gorm:"default:'approved';index"`
	// Values: 'approved', 'pending', 'awaiting_approval', 'rejected'

	// NEW: Rejection tracking fields
	RejectedBy  *uint      `json:"rejected_by"`
	RejectedAt  *time.Time `json:"rejected_at"`
	RejectNotes string     `json:"reject_notes"`

	SyncStatus string     `json:"sync_status" gorm:"type:varchar(10);not null;default:'synced';index"`
	SyncedAt   *time.Time `json:"synced_at"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	// Relasi
	Instrument     Instrument       `gorm:"foreignKey:InstrumentID;constraint:OnDelete:CASCADE"`
	User           User             `gorm:"foreignKey:UserID;constraint:OnDelete:SET NULL"`
	Approver       *User            `gorm:"foreignKey:ApprovedBy;constraint:OnDelete:SET NULL"`
	ParentUsage    *InstrumentUsage `gorm:"foreignKey:ParentUsageID;constraint:OnDelete:SET NULL"`
	UsageResults   []UsageResult    `gorm:"foreignKey:InstrumentUsageID"`
	ApprovedByUser *User            `gorm:"foreignKey:ApprovedBy" json:"approved_by_user,omitempty"`
	RejectedByUser *User            `gorm:"foreignKey:RejectedBy" json:"rejected_by_user,omitempty"`
	ProgressData   string           `json:"progress_data" gorm:"type:text"`
	DownloadCount  int              `gorm:"default:0" json:"download_count"`
	ResumedBy      *uint            `json:"resumed_by"`
	ResumedAt      *time.Time       `json:"resumed_at"`
}

func (InstrumentUsage) TableName() string {
	return "instrument_usages"
}

// IsReread returns true if this usage is a re-read
func (u *InstrumentUsage) IsReread() bool {
	return u.ParentUsageID != nil
}

// IsPendingApproval returns true if this re-read is awaiting supervisor approval
func (u *InstrumentUsage) IsPendingApproval() bool {
	return u.IsReread() && u.ResultStatus == "awaiting_approval"
}

// CanExport returns true if the results can be exported
func (u *InstrumentUsage) CanExport() bool {
	// Original readings can always be exported
	if !u.IsReread() {
		return true
	}

	// Re-reads can only be exported if approved
	return u.ResultStatus == "approved"
}

// RequiresApproval returns true if this usage requires supervisor approval
func (u *InstrumentUsage) RequiresApproval() bool {
	return u.IsReread() && (u.ResultStatus == "pending" || u.ResultStatus == "awaiting_approval")
}
