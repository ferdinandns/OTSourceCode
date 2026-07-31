package domain

import (
	"context"
	"time"

	dto "emertrack/internal/dto"
	"github.com/xuri/excelize/v2"
)

type AuditLog struct {
	ID          uint   `gorm:"primaryKey"`
	UserID      uint   `gorm:"not null;index"`
	Action      string `gorm:"size:50;not null"`
	Menu        string `gorm:"size:100;not null"`
	EntityID    *uint  `gorm:"index"`
	Description string `gorm:"type:text"`
	CreatedAt   time.Time

	User User `gorm:"foreignKey:UserID;constraint;OnDelete:RESTRICT"`
}

type AuditResponse struct {
	ID          uint                `json:"id"`
	Action      string              `json:"action"`
	Menu        string              `json:"menu"`
	EntityID    *uint               `json:"entity_id"`
	Description string              `json:"description"`
	CreatedAt   string              `json:"created_at"`
	User        UserCompactResponse `json:"user"`
}

type AuditMeta struct {
	Action   string
	Menu     string
	Message  string
	EntityID uint
	Payload  interface{}
}

type UserCompactResponse struct {
	Name       string `json:"name"`
	Department string `json:"department"`
}


type AuditRepository interface {
	Log(ctx context.Context, log *AuditLog) error
	List(ctx context.Context, startDate, endDate string, entityID *uint, page, pageSize int) ([]AuditResponse, int64, error)
	Export(ctx context.Context, startDate, endDate string, entityID *uint) ([]AuditResponse, error)
}

type AuditService interface {
	Log(ctx context.Context, userID uint, action, menu, desc string, entityID *uint) error
	List(ctx context.Context, startDate, endDate string, entityID *uint, page, pageSize int) (*dto.PaginatedResponse, error)
	ExportExcel(ctx context.Context, startDate, endDate string, entityID *uint) (*excelize.File, error)
}


