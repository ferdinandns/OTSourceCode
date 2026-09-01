package models

import (
	"time"

	"gorm.io/datatypes"
)

type AuditLog struct {
	Id          uint           `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID      *uint          `json:"user_id"`
	Username    string         `json:"username"`
	Action      string         `json:"action"`
	TargetTable string         `json:"table_name"` // ← renamed field, keep json tag as-is
	RecordID    string         `json:"record_id"`
	OldValues   datatypes.JSON `json:"old_values"`
	NewValues   datatypes.JSON `json:"new_values"`
	Endpoint    string         `json:"endpoint"`
	IPAddress   string         `json:"ip_address"`
	CreatedAt   time.Time      `json:"created_at"`
}

func (AuditLog) TableName() string {
	return "audit_logs"
}
