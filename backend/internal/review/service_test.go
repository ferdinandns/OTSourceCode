package review_test

import (
	"context"
	"errors"
	"testing"

	"emertrack/internal/domain"
	"emertrack/internal/review"
	"emertrack/mocks"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"gorm.io/gorm"
)

type mockReviewRepo struct{ mock.Mock }

func (m *mockReviewRepo) ListPendingReviews(ctx context.Context, filter domain.ReviewFilter) ([]domain.ReviewRow, int64, error) {
	args := m.Called(ctx, filter)
	var rows []domain.ReviewRow
	if v := args.Get(0); v != nil {
		rows = v.([]domain.ReviewRow)
	}
	return rows, args.Get(1).(int64), args.Error(2)
}

func (m *mockReviewRepo) GetReviewDetail(ctx context.Context, repairOrderID uint) (*domain.ReviewDetailResponse, error) {
	args := m.Called(ctx, repairOrderID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.ReviewDetailResponse), args.Error(1)
}

func (m *mockReviewRepo) SubmitReview(ctx context.Context, repairOrderID uint, reviewerID uint, verdict domain.ReviewVerdict, feedback string) error {
	return m.Called(ctx, repairOrderID, reviewerID, verdict, feedback).Error(0)
}

func (m *mockReviewRepo) GetReviewSummary(ctx context.Context) (*domain.ReviewSummary, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.ReviewSummary), args.Error(1)
}

func (m *mockReviewRepo) ListReviewsByRepairOrderID(ctx context.Context, repairOrderID uint, limit, offset int) ([]domain.ReviewOrder, int64, error) {
	args := m.Called(ctx, repairOrderID, limit, offset)
	var rows []domain.ReviewOrder
	if v := args.Get(0); v != nil {
		rows = v.([]domain.ReviewOrder)
	}
	return rows, args.Get(1).(int64), args.Error(2)
}

func (m *mockReviewRepo) ListQSHistory(ctx context.Context, reviewerID uint, filter domain.ReviewHistoryFilter) ([]domain.ReviewHistoryRow, int64, error) {
	args := m.Called(ctx, reviewerID, filter)
	var rows []domain.ReviewHistoryRow
	if v := args.Get(0); v != nil {
		rows = v.([]domain.ReviewHistoryRow)
	}
	return rows, args.Get(1).(int64), args.Error(2)
}

func (m *mockReviewRepo) GetReviewHistoryDetail(ctx context.Context, reviewID uint) (*domain.ReviewHistoryDetail, error) {
	args := m.Called(ctx, reviewID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.ReviewHistoryDetail), args.Error(1)
}

func setupReviewService(t *testing.T) (domain.ReviewService, *mockReviewRepo) {
	repo := new(mockReviewRepo)
	repairSvc := new(mocks.RepairService)
	sarprasRepo := new(mocks.SarprasRepository)
	svc := review.NewService(repo, sarprasRepo, repairSvc, &gorm.DB{})
	return svc, repo
}

func TestListPendingReviews_Success(t *testing.T) {
	svc, repo := setupReviewService(t)
	ctx := context.Background()
	filter := domain.ReviewFilter{Page: 1, PageSize: 10}
	rows := []domain.ReviewRow{{RepairOrderID: 1, SarprasCode: "APAR-001"}}

	repo.On("ListPendingReviews", ctx, filter).Return(rows, int64(1), nil)

	res, total, err := svc.ListPendingReviews(ctx, filter)
	assert.NoError(t, err)
	assert.Equal(t, int64(1), total)
	assert.Len(t, res, 1)
	repo.AssertExpectations(t)
}

func TestGetReviewDetail_Success(t *testing.T) {
	svc, repo := setupReviewService(t)
	ctx := context.Background()
	expected := &domain.ReviewDetailResponse{RepairOrderID: 1, SarprasCode: "APAR-001"}

	repo.On("GetReviewDetail", ctx, uint(1)).Return(expected, nil)

	res, err := svc.GetReviewDetail(ctx, 1)
	assert.NoError(t, err)
	assert.Equal(t, "APAR-001", res.SarprasCode)
	repo.AssertExpectations(t)
}

func TestSubmitReview_MissingFeedback(t *testing.T) {
	svc, _ := setupReviewService(t)
	ctx := context.Background()

	err := svc.SubmitReview(ctx, 1, 5, domain.ReviewSubmitRequest{Verdict: domain.ReviewApprove, Feedback: ""})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "feedback wajib diisi")
}

func TestGetReviewSummary_Success(t *testing.T) {
	svc, repo := setupReviewService(t)
	ctx := context.Background()
	expected := &domain.ReviewSummary{WaitingReview: 3}

	repo.On("GetReviewSummary", ctx).Return(expected, nil)

	res, err := svc.GetReviewSummary(ctx)
	assert.NoError(t, err)
	assert.Equal(t, int64(3), res.WaitingReview)
	repo.AssertExpectations(t)
}

func TestGetHistoryDetail_Error(t *testing.T) {
	svc, repo := setupReviewService(t)
	ctx := context.Background()

	repo.On("GetReviewHistoryDetail", ctx, uint(99)).Return(nil, errors.New("not found"))

	res, err := svc.GetHistoryDetail(ctx, 99)
	assert.Error(t, err)
	assert.Nil(t, res)
	repo.AssertExpectations(t)
}

func TestClaimReview_RequiresDB(t *testing.T) {
	t.Skip("ClaimReview interacts with gorm.DB directly; use sqlmock or integration test")
}
