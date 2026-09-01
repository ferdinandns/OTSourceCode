package models

import "time"

type InstrumentRereadHistory struct {
	Id          uint   `json:"id" gorm:"primaryKey"`
	UsageID     uint   `json:"usage_id" gorm:"not null;index"`
	BatchNumber string `json:"batch_number" gorm:"type:varchar(255);not null"`
	ItemNumber  *int   `json:"item_number"` // NULL = whole batch
	Reason      string `json:"reason" gorm:"type:text;not null"`

	// Old data
	OldResultData     string `json:"old_result_data" gorm:"type:text"`
	OldFinalCondition string `json:"old_final_condition" gorm:"type:varchar(50)"`

	// New data
	NewResultData     string `json:"new_result_data" gorm:"type:text"`
	NewFinalCondition string `json:"new_final_condition" gorm:"type:varchar(50)"`

	// Tracking
	RequestedBy uint       `json:"requested_by"`
	RequestedAt time.Time  `json:"requested_at"`
	CompletedAt *time.Time `json:"completed_at"`

	// Approval
	Status     string     `json:"status" gorm:"type:varchar(50);default:'in_progress'"` // in_progress, completed
	ApprovedBy *uint      `json:"approved_by"`
	ApprovedAt *time.Time `json:"approved_at"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Relations
	Usage           InstrumentUsage `gorm:"foreignKey:UsageID;constraint:OnDelete:CASCADE"`
	RequestedByUser User            `gorm:"foreignKey:RequestedBy"`
	ApprovedByUser  *User           `gorm:"foreignKey:ApprovedBy"`
}

func (InstrumentRereadHistory) TableName() string {
	return "instrument_reread_history"
}
