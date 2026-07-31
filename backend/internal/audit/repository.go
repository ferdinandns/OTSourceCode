package audit

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"

	domain "emertrack/internal/domain"
)


type auditRepository struct {
	db *gorm.DB
}

func NewAuditRepository(db *gorm.DB) domain.AuditRepository {
	return &auditRepository{db: db}
}

func (r *auditRepository) Log(ctx context.Context, log *domain.AuditLog) error {
	return r.db.WithContext(ctx).Create(log).Error
}

func (r *auditRepository) applyFilters(q *gorm.DB, startDate, endDate string, entityID *uint) *gorm.DB {
	if entityID != nil {
		q = q.Where("entity_id = ?", *entityID)
	}
	if startDate != "" {
		start, err := parseDate(startDate)
		if err == nil {
			q = q.Where("created_at >= ?", start)
		}
	}
	if endDate != "" {
		end, err := parseDate(endDate)
		if err == nil {
			end = end.Add(24*time.Hour - 1*time.Second)
			q = q.Where("created_at <= ?", end)
		}
	}
	return q
}

// List returns paginated audit logs.
func (r *auditRepository) List(
	ctx context.Context,
	startDate, endDate string,
	entityID *uint,
	page, pageSize int,
) ([]domain.AuditResponse, int64, error) {

	var (
		total int64
		logs  []domain.AuditLog
	)

	base := r.db.WithContext(ctx).Model(&domain.AuditLog{})
	base = r.applyFilters(base, startDate, endDate, entityID)

	if err := base.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	err := base.
		Preload("User", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, nik, name, department_id")
		}).
		Preload("User.Department").
		Order("created_at DESC").
		Offset(offset).
		Limit(pageSize).
		Find(&logs).Error

	if err != nil {
		return nil, 0, err
	}

	return convertToAuditResponses(logs), total, nil
}

// Export returns all audit logs matching the filters without pagination.
func (r *auditRepository) Export(
	ctx context.Context,
	startDate, endDate string,
	entityID *uint,
) ([]domain.AuditResponse, error) {

	var logs []domain.AuditLog
	q := r.db.WithContext(ctx).Model(&domain.AuditLog{})
	q = r.applyFilters(q, startDate, endDate, entityID)

	err := q.
		Preload("User", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, nik, name, department_id")
		}).
		Preload("User.Department").
		Order("created_at DESC").
		Find(&logs).Error

	if err != nil {
		return nil, err
	}

	return convertToAuditResponses(logs), nil
}

func convertToAuditResponses(logs []domain.AuditLog) []domain.AuditResponse {
	var responses []domain.AuditResponse
	for _, l := range logs {
		responses = append(responses, domain.AuditResponse{
			ID:          l.ID,
			Action:      l.Action,
			Menu:        l.Menu,
			EntityID:    l.EntityID,
			Description: l.Description,
			CreatedAt:   l.CreatedAt.Format("02-01-2006 15:04:05"),
			User: domain.UserCompactResponse{
				Name:       l.User.Name,
				Department: l.User.Department.Name,
			},
		})
	}
	return responses
}

func parseDate(dateStr string) (time.Time, error) {
	layouts := []string{"2006-01-02", "02-01-2006"}
	for _, layout := range layouts {
		t, err := time.Parse(layout, dateStr)
		if err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("cannot parse date %s", dateStr)
}
