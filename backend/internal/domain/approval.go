package domain

import (
	"context"
	"time"

	"gorm.io/gorm"
)

type ApprovalAction string

const (
	ApprovalCreate ApprovalAction = "create"
	ApprovalEdit   ApprovalAction = "edit"
	ApprovalDelete ApprovalAction = "delete"
)

type ApprovalStatus string

const (
	ApprovalPending  ApprovalStatus = "pending"
	ApprovalApproved ApprovalStatus = "approved"
	ApprovalRejected ApprovalStatus = "rejected"
)

type ApprovalRequest struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	EntityType  string         `gorm:"size:50;not null" json:"entity_type"`
	EntityID    *uint          `gorm:"index" json:"entity_id"`
	Action      ApprovalAction `gorm:"type:approval_action_enum;not null" json:"action"`
	RequestedBy uint           `gorm:"not null" json:"requested_by"`
	PayloadJSON string         `gorm:"type:jsonb" json:"payload_json"`
	Status      ApprovalStatus `gorm:"type:approval_status_enum;default:'pending'" json:"status"`
	ReviewedBy  *uint          `json:"reviewed_by"`
	Notes       string         `gorm:"type:text" json:"notes"`
	ReviewedAt  *time.Time     `json:"reviewed_at"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`

	Requester User `gorm:"foreignKey:RequestedBy;constraint:OnDelete:RESTRICT" json:"-"`
	Reviewer  User `gorm:"foreignKey:ReviewedBy;constraint:OnDelete:SET NULL" json:"-"`
}

type ApprovalFilter struct {
	Status     *ApprovalStatus
	EntityType string
	Search     string
	Page       int
	PageSize   int
}

type ApprovalResponse struct {
	ID          uint           `json:"id"`
	EntityType  string         `json:"entity_type"`
	Action      string         `json:"action"`
	Status      ApprovalStatus `json:"status"`
	PayloadJSON string         `json:"payload_json"`
	Notes       string         `json:"notes"`
	CreatedAt   string         `json:"created_at"`
	ReviewedAt  string         `json:"reviewed_at,omitempty"`
	Requester   UserCompact    `json:"requester"`
	Reviewer    *UserCompact   `json:"reviewer,omitempty"`
}

type ApprovalRepository interface {
	Create(ctx context.Context, req *ApprovalRequest) error
	FindByID(ctx context.Context, id uint) (*ApprovalRequest, error)
	Update(ctx context.Context, req *ApprovalRequest) error
	List(ctx context.Context, filter ApprovalFilter) ([]ApprovalResponse, int64, error)

	CreateTx(ctx context.Context, tx *gorm.DB, req *ApprovalRequest) error
	UpdateTx(tx *gorm.DB, req *ApprovalRequest) error
	CountBulkItems(ctx context.Context, approvalID uint) (int, error)
	GetRequesterName(ctx context.Context, userID uint) (string, error)
	GetSiteName(ctx context.Context) (string, error)
	GetSarprasTypeName(ctx context.Context, id uint) (string, error)
	GetSarprasName(ctx context.Context, id uint) (string, error)
	GetDepartmentName(ctx context.Context, id uint) (string, error)
}

type ApprovalService interface {
	Approve(ctx context.Context, reviewerID, approvalID uint, notes string) (string, error)
	Reject(ctx context.Context, reviewerID, approvalID uint, notes string) (string, error)
	GetApprovalDetail(ctx context.Context, id uint) (*ApprovalResponse, error)
	ListApprovals(ctx context.Context, filter ApprovalFilter) ([]ApprovalResponse, int64, error)
}
