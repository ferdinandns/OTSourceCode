package approval_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"emertrack/internal/approval"
	"emertrack/internal/domain"
	"emertrack/mocks"

	"github.com/stretchr/testify/assert"
	"gorm.io/gorm"
)

func setupApprovalService(t *testing.T) (domain.ApprovalService, *mocks.ApprovalRepository) {
	repo := new(mocks.ApprovalRepository)
	stRepo := new(mocks.SarprasTypeRepository)
	sRepo := new(mocks.SarprasRepository)
	sSvc := new(mocks.SarprasService)
	notifSvc := new(mocks.NotificationService)
	svc := approval.NewApprovalService(repo, stRepo, sRepo, sSvc, notifSvc, &gorm.DB{})
	return svc, repo
}

func TestGetApprovalDetail_Success(t *testing.T) {
	svc, repo := setupApprovalService(t)
	ctx := context.Background()
	now := time.Now()
	row := &domain.ApprovalRequest{
		ID: 1, EntityType: "Sarpras", Action: domain.ApprovalCreate,
		Status: domain.ApprovalPending, PayloadJSON: `{"code":"APAR-001"}`,
		CreatedAt: now,
		Requester: domain.User{ID: 2, Name: "Requester", Email: "req@test.com", Department: domain.Department{Name: "ENG"}},
	}

	repo.On("FindByID", ctx, uint(1)).Return(row, nil)

	res, err := svc.GetApprovalDetail(ctx, 1)
	assert.NoError(t, err)
	assert.NotNil(t, res)
	assert.Equal(t, "Sarpras", res.EntityType)
	assert.Equal(t, "Requester", res.Requester.Name)
	repo.AssertExpectations(t)
}

func TestGetApprovalDetail_NotFound(t *testing.T) {
	svc, repo := setupApprovalService(t)
	ctx := context.Background()

	repo.On("FindByID", ctx, uint(99)).Return(nil, errors.New("not found"))

	res, err := svc.GetApprovalDetail(ctx, 99)
	assert.Error(t, err)
	assert.Nil(t, res)
	repo.AssertExpectations(t)
}

func TestListApprovals_DelegatesToRepo(t *testing.T) {
	svc, repo := setupApprovalService(t)
	ctx := context.Background()
	filter := domain.ApprovalFilter{Page: 1, PageSize: 10}
	expected := []domain.ApprovalResponse{{ID: 1, EntityType: "Site"}}

	repo.On("List", ctx, filter).Return(expected, int64(1), nil)

	res, total, err := svc.ListApprovals(ctx, filter)
	assert.NoError(t, err)
	assert.Equal(t, int64(1), total)
	assert.Len(t, res, 1)
	repo.AssertExpectations(t)
}

func TestMapToResponse_WithReviewer(t *testing.T) {
	now := time.Now()
	reviewerID := uint(3)
	row := &domain.ApprovalRequest{
		ID: 5, EntityType: "Department", Action: domain.ApprovalEdit,
		Status: domain.ApprovalApproved, ReviewedBy: &reviewerID, ReviewedAt: &now,
		CreatedAt: now,
		Requester: domain.User{ID: 1, Name: "Alice", Department: domain.Department{Name: "HSE"}},
		Reviewer:  domain.User{ID: 3, Name: "Bob", Department: domain.Department{Name: "QS"}},
	}

	res := approval.MapToResponse(row)
	assert.Equal(t, uint(5), res.ID)
	assert.NotNil(t, res.Reviewer)
	assert.Equal(t, "Bob", res.Reviewer.Name)
}

func TestApprove_RequiresDB(t *testing.T) {
	t.Skip("Approve uses gorm transaction; full coverage requires sqlmock")
}
