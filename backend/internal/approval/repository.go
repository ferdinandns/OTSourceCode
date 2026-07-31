package approval

import (
	"context"
	"time"

	"emertrack/internal/domain"

	"gorm.io/gorm"
)

type approvalRepository struct {
	db *gorm.DB
}

func NewApprovalRepository(db *gorm.DB) domain.ApprovalRepository {
	return &approvalRepository{db: db}
}

func (r *approvalRepository) Create(ctx context.Context, req *domain.ApprovalRequest) error {
	return r.db.WithContext(ctx).Create(req).Error
}

// CreateTx inserts an approval record within an existing transaction.
// Use this when approval creation must be atomic with other operations (e.g. audit log).
func (r *approvalRepository) CreateTx(ctx context.Context, tx *gorm.DB, req *domain.ApprovalRequest) error {
	return tx.WithContext(ctx).Create(req).Error
}

func (r *approvalRepository) FindByID(ctx context.Context, id uint) (*domain.ApprovalRequest, error) {
	var req domain.ApprovalRequest
	err := r.db.WithContext(ctx).
		Preload("Requester.Department").
		Preload("Reviewer.Department").
		First(&req, id).Error
	return &req, err
}

func (r *approvalRepository) Update(ctx context.Context, req *domain.ApprovalRequest) error {
	return r.db.WithContext(ctx).Save(req).Error
}

func (r *approvalRepository) List(ctx context.Context, f domain.ApprovalFilter) ([]domain.ApprovalResponse, int64, error) {
	page, pageSize := f.Page, f.PageSize
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	limit := pageSize
	offset := (page - 1) * pageSize

	var total int64
	if err := r.db.WithContext(ctx).Raw(CountListPending).Scan(&total).Error; err != nil {
		return nil, 0, err
	}
	if total == 0 {
		return []domain.ApprovalResponse{}, 0, nil
	}

	rows, err := r.db.WithContext(ctx).Raw(ListPending, limit, offset).Rows()
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var results []domain.ApprovalResponse
	for rows.Next() {
		var (
			id            uint
			entityType    string
			entityID      *uint
			action        string
			requesterName string
			status        string
			createdAt     time.Time
		)
		if err := rows.Scan(&id, &entityType, &entityID, &action, &requesterName, &status, &createdAt); err != nil {
			return nil, 0, err
		}

		resp := domain.ApprovalResponse{
			ID:         id,
			EntityType: entityType,
			Action:     action,
			Status:     domain.ApprovalStatus(status),
			CreatedAt:  createdAt.Format("2006-01-02 15:04:05"),
			Requester: domain.UserCompact{
				Name: requesterName,
			},
		}
		results = append(results, resp)
	}
	return results, total, nil
}

func (r *approvalRepository) UpdateTx(tx *gorm.DB, req *domain.ApprovalRequest) error {
	return tx.Save(req).Error
}

func (r *approvalRepository) GetRequesterName(ctx context.Context, userID uint) (string, error) {
	var name string
	err := r.db.WithContext(ctx).Raw(GetRequesterName, userID).Scan(&name).Error
	if err != nil {
		return "", err
	}
	return name, nil
}

func (r *approvalRepository) CountBulkItems(ctx context.Context, approvalID uint) (int, error) {
	var count int
	err := r.db.WithContext(ctx).Raw(CountBulkItems, approvalID).Scan(&count).Error
	return count, err
}

func (r *approvalRepository) GetSiteName(ctx context.Context) (string, error) {
	var name string
	err := r.db.WithContext(ctx).Raw(GetSiteName).Scan(&name).Error
	return name, err
}

func (r *approvalRepository) GetSarprasTypeName(ctx context.Context, id uint) (string, error) {
	var name string
	err := r.db.WithContext(ctx).Raw(GetSarprasTypeName, id).Scan(&name).Error
	return name, err
}

func (r *approvalRepository) GetSarprasName(ctx context.Context, id uint) (string, error) {
	var name string
	err := r.db.WithContext(ctx).Raw(GetSarprasName, id).Scan(&name).Error
	return name, err
}

func (r *approvalRepository) GetDepartmentName(ctx context.Context, id uint) (string, error) {
	var name string
	err := r.db.WithContext(ctx).Raw(GetDepartmentName, id).Scan(&name).Error
	return name, err
}
