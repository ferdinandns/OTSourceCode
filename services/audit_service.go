package services

import (
	"encoding/json"
	"fmt"
	"lab-connect/backend-api/models"

	"gorm.io/gorm"
)

type AuditService struct {
	db *gorm.DB
}

func NewAuditService(db *gorm.DB) *AuditService {
	return &AuditService{db: db}
}

type AuditEntry struct {
	UserID      *uint
	Username    string
	Action      string // INSERT, UPDATE, DELETE, SELECT
	TargetTable string
	RecordID    string
	OldValues   interface{}
	NewValues   interface{}
	Endpoint    string
	IPAddress   string
}

func (s *AuditService) Log(entry AuditEntry) error {
	log := models.AuditLog{
		UserID:      entry.UserID,
		Username:    entry.Username,
		Action:      entry.Action,
		TargetTable: entry.TargetTable,
		RecordID:    entry.RecordID,
		Endpoint:    entry.Endpoint,
		IPAddress:   entry.IPAddress,
	}

	if entry.OldValues != nil {
		b, err := json.Marshal(entry.OldValues)
		if err == nil {
			log.OldValues = b
		}
	}

	if entry.NewValues != nil {
		b, err := json.Marshal(entry.NewValues)
		if err == nil {
			log.NewValues = b
		}
	}

	if err := s.db.Create(&log).Error; err != nil {
		fmt.Printf("[AuditService] Failed to write audit log: %v\n", err)
		return err
	}

	return nil
}

// LogAsync writes audit log in a goroutine so it never blocks the request
func (s *AuditService) LogAsync(entry AuditEntry) {
	go func() {
		_ = s.Log(entry)
	}()
}

// ============================================
// QUERY / LIST
// ============================================

type AuditFilter struct {
	UserID    string
	Action    string
	TableName string
	DateFrom  string
	DateTo    string
	Search    string
	Page      int
	Limit     int
}

type PaginatedAuditResponse struct {
	Data       []models.AuditLog `json:"data"`
	Total      int64             `json:"total"`
	Page       int               `json:"page"`
	Limit      int               `json:"limit"`
	TotalPages int               `json:"total_pages"`
}

func (s *AuditService) GetAuditLogs(filter AuditFilter) (*PaginatedAuditResponse, error) {
	query := s.db.Model(&models.AuditLog{})

	if filter.UserID != "" {
		query = query.Where("user_id = ?", filter.UserID)
	}
	if filter.Action != "" {
		query = query.Where("action = ?", filter.Action)
	}
	if filter.TableName != "" {
		query = query.Where("target_table = ?", filter.TableName)
	}
	if filter.DateFrom != "" {
		query = query.Where("created_at >= ?", filter.DateFrom)
	}
	if filter.DateTo != "" {
		query = query.Where("created_at <= ?", filter.DateTo+" 23:59:59")
	}
	if filter.Search != "" {
		like := "%" + filter.Search + "%"
		query = query.Where("username ILIKE ? OR target_table ILIKE ? OR record_id ILIKE ? OR endpoint ILIKE ?", like, like, like, like)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.Limit < 1 {
		filter.Limit = 20
	}

	offset := (filter.Page - 1) * filter.Limit

	var logs []models.AuditLog
	if err := query.
		Order("created_at DESC").
		Offset(offset).
		Limit(filter.Limit).
		Find(&logs).Error; err != nil {
		return nil, err
	}

	totalPages := int(total) / filter.Limit
	if int(total)%filter.Limit != 0 {
		totalPages++
	}

	return &PaginatedAuditResponse{
		Data:       logs,
		Total:      total,
		Page:       filter.Page,
		Limit:      filter.Limit,
		TotalPages: totalPages,
	}, nil
}

// GetDistinctTables - for filter dropdown
func (s *AuditService) GetDistinctTables() ([]string, error) {
	var tables []string
	err := s.db.Model(&models.AuditLog{}).
		Distinct("target_table").
		Order("target_table ASC").
		Pluck("target_table", &tables).Error
	return tables, err
}
