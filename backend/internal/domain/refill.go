package domain

import (
	"context"
	"time"

	"gorm.io/gorm"
)

type AparListRow struct {
	SarprasID      uint       `json:"sarpras_id"`
	SarprasType    string     `json:"sarpras_type"`
	SarprasNo      string     `json:"sarpras_no"`
	LocationDpt    string     `json:"location_department"`
	ExpiredDate    *time.Time `json:"expired_date"`
	EDStatus       string     `json:"ed_status"`
	ProgressRefill string     `json:"progress_refill"`
	DueDateRefill  *time.Time `json:"due_date_refill"`
	PONumber       *string    `json:"po_number"`
	ItemID         *uint      `json:"item_id"`
	ItemStatus     *string    `json:"item_status"`
}

type RefillOrder struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	PONumber    string    `gorm:"column:po_number;not null" json:"po_number"`
	DueDate     time.Time `gorm:"column:due_date;not null" json:"due_date"`
	SubmittedBy uint      `gorm:"column:submitted_by" json:"submitted_by"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	Submitter User `gorm:"foreignKey:SubmittedBy" json:"-"`
}

func (RefillOrder) TableName() string { return "refill_orders" }

type RefillOrderItem struct {
	ID            uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	RefillOrderID uint       `gorm:"column:refill_order_id" json:"refill_order_id"`
	SarprasID     uint       `gorm:"column:sarpras_id" json:"sarpras_id"`
	Status        string     `gorm:"column:status;default:waiting_evidence" json:"status"`
	NewExpireDate *time.Time `gorm:"column:new_expire_date" json:"new_expire_date"`
	EvidencePath  *string    `gorm:"column:evidence_path" json:"evidence_path"`
	UpdateReason  *string    `gorm:"column:update_reason" json:"update_reason"`
	EvidenceBy    *uint      `gorm:"column:evidence_by" json:"evidence_by"`
	EvidenceAt    *time.Time `gorm:"column:evidence_at" json:"evidence_at"`
	ReviewedBy    *uint      `gorm:"column:reviewed_by" json:"reviewed_by"`
	ReviewedAt    *time.Time `gorm:"column:reviewed_at" json:"reviewed_at"`
	RejectReason  *string    `gorm:"column:reject_reason" json:"reject_reason"`
	CreatedAt     time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt     time.Time  `gorm:"autoUpdateTime" json:"updated_at"`

	RefillOrder  RefillOrder `gorm:"foreignKey:RefillOrderID" json:"-"`
	Sarpras      Sarpras     `gorm:"foreignKey:SarprasID" json:"-"`
	Reviewer     *User       `gorm:"foreignKey:ReviewedBy" json:"-"`
	EvidenceUser *User       `gorm:"foreignKey:EvidenceBy" json:"-"`
}

func (RefillOrderItem) TableName() string { return "refill_order_items" }

type SarprasUsageLog struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	SarprasID uint      `gorm:"column:sarpras_id;not null" json:"sarpras_id"`
	Reason    string    `gorm:"column:reason;not null" json:"reason"`
	MarkedBy  uint      `gorm:"column:marked_by;not null" json:"marked_by"`
	MarkedAt  time.Time `gorm:"column:marked_at;not null" json:"marked_at"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`

	Sarpras      Sarpras `gorm:"foreignKey:SarprasID" json:"-"`
	MarkedByUser User    `gorm:"foreignKey:MarkedBy" json:"-"`
}

func (SarprasUsageLog) TableName() string { return "sarpras_usage_logs" }

type GetAparListParams struct {
	EDStatus string
	Search   string
	Limit    int
	Offset   int
}

type SubmitPORequest struct {
	SarprasIDs []uint    `json:"sarpras_ids" binding:"required,min=1"`
	PONumber   string    `json:"po_number"   binding:"required"`
	DueDate    time.Time `json:"due_date"    binding:"required"`
}

type SubmitEvidenceRequest struct {
	ItemID        uint      `json:"item_id"         binding:"required"`
	NewExpireDate time.Time `json:"new_expire_date" binding:"required"`
	EvidencePath  []string  `json:"evidence_path"   binding:"required"`
	UpdateReason  string    `json:"update_reason"`
}

type VerifyDetailResponse struct {
	ItemID        uint       `json:"item_id"`
	SarprasID     uint       `json:"sarpras_id"`
	SarprasType   string     `json:"sarpras_type"`
	SarprasNo     string     `json:"sarpras_no"`
	Location      string     `json:"location"`
	ExpiredDate   time.Time  `json:"expired_date"`
	NewExpireDate *time.Time `json:"new_expire_date"`
	EvidencePath  string     `json:"evidence_path"`
	UpdateReason  string     `json:"update_reason"`
	EvidenceBy    string     `json:"evidence_by"`
	EvidenceAt    time.Time  `json:"evidence_at"`
	PONumber      string     `json:"po_number"`
	DueDate       time.Time  `json:"due_date"`
}

type VerifyRefillRequest struct {
	ItemID       uint   `json:"item_id"      binding:"required"`
	SarprasID    uint   `json:"sarpras_id"   binding:"required"`
	Status       string `json:"status"       binding:"required,oneof=approved rejected"`
	RejectReason string `json:"reject_reason"`
}

type MarkAsUsedRequest struct {
	SarprasIDs []uint `json:"sarpras_ids" binding:"required,min=1"`
	Reason     string `json:"reason"      binding:"required"`
}

type AparNearExpiry struct {
	SarprasID   uint
	SarprasNo   string
	ExpiredDate time.Time
}

type RefillStatus struct {
	IsActive bool
	Status   string
	DueDate  *time.Time
}

// RefillPendingItem represents a refill item still sitting in
// waiting_review for at least verificationReminderThresholdDays, used to
// nudge QS periodically (see RefillService.SendVerificationReminders).
type RefillPendingItem struct {
	ItemID      uint
	SarprasCode string
	EvidenceAt  time.Time
}

type RefillDueItem struct {
	ItemID        uint
	RefillOrderID uint
	SarprasID     uint
	SarprasCode   string
	SarprasName   string
	PONumber      string
	DueDate       time.Time
	SubmittedBy   uint
}

type RefillRepository interface {
	GetAparList(params GetAparListParams) ([]AparListRow, int, int, int, error)
	GetAparDetail(sarprasID uint) (*AparListRow, error)
	GetAparsExpiringOrExpired(daysAhead int) ([]AparNearExpiry, error)
	GetRefillPendingVerification(daysThreshold int) ([]RefillPendingItem, error)
	CreateOrder(order *RefillOrder, items []RefillOrderItem) error
	CreateOrderTx(tx *gorm.DB, order *RefillOrder, items []RefillOrderItem) error
	ValidateSarprasForRefill(sarprasIDs []uint) ([]uint, error)
	ValidateSarprasForMarkUsed(sarprasIDs []uint) ([]uint, error)
	UpdateItemEvidence(itemID uint, userID uint, newDate time.Time, path string, reason string) error
	UpdateItemEvidenceTx(tx *gorm.DB, itemID uint, newDate time.Time, path string, reason string, evidenceBy uint) error
	GetEmailsByDepartment(deptName string) ([]string, error)
	GetEmailsByRole(role string) ([]string, error)
	GetVerifyDetail(itemID uint) (*VerifyDetailResponse, error)
	GetActiveRefillBySarprasID(ctx context.Context, sarprasID uint) (*RefillStatus, error)

	GetItemByID(itemID uint) (*RefillOrderItem, error)
	GetItemByIDTx(tx *gorm.DB, itemID uint) (*RefillOrderItem, error)
	UpdateItemVerificationTx(tx *gorm.DB, itemID uint, status string, reviewerID uint, rejectReason string) error

	GetSarprasByID(sarprasID uint) (*Sarpras, error)
	GetSarprasByIDTx(tx *gorm.DB, sarprasID uint) (*Sarpras, error)
	UpdateSarprasExpiryTx(tx *gorm.DB, sarprasID uint, newExpiry *time.Time, newStatus interface{}) error
	HasActiveRepairOrderTx(tx *gorm.DB, sarprasID uint) (bool, error)
	GetPendingEvidenceItemsForReminder(daysWindow int) ([]RefillDueItem, error)

	MarkSarprasUsedTx(tx *gorm.DB, sarprasIDs []uint, usedDate time.Time) error
	CreateUsageLogsTx(tx *gorm.DB, logs []SarprasUsageLog) error

	GetUserByID(userID uint) (*User, error)
}

type RefillService interface {
	ListApar(params GetAparListParams) ([]AparListRow, int, int, int, error)
	GetAparDetail(sarprasID uint) (*AparListRow, error)
	ValidateApar(sarprasIDs []uint) ([]uint, error)
	SubmitPO(req SubmitPORequest, submittedBy uint) error
	SubmitEvidence(req SubmitEvidenceRequest, evidenceBy uint) error
	GetVerifyDetail(itemID uint) (*VerifyDetailResponse, error)
	VerifyItem(req VerifyRefillRequest, reviewerID uint) error
	MarkAsUsed(req MarkAsUsedRequest, markedBy uint) error
	SendExpiryReminders() error
	SendVerificationReminders() error
	SendPOReminders() error
}
