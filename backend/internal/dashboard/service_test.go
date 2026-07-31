package dashboard_test

import (
	"context"
	"errors"
	"testing"

	"emertrack/internal/dashboard"
	"emertrack/internal/domain"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type mockDashboardRepo struct{ mock.Mock }

func (m *mockDashboardRepo) GetSummary(ctx context.Context, filter domain.TableFilter) (domain.DashboardSummary, error) {
	args := m.Called(ctx, filter)
	return args.Get(0).(domain.DashboardSummary), args.Error(1)
}

func (m *mockDashboardRepo) ListDashboardTable(ctx context.Context, filter domain.TableFilter) ([]domain.DashboardTableRow, int64, error) {
	args := m.Called(ctx, filter)
	var rows []domain.DashboardTableRow
	if v := args.Get(0); v != nil {
		rows = v.([]domain.DashboardTableRow)
	}
	return rows, args.Get(1).(int64), args.Error(2)
}

func TestGetDashboardData_Success(t *testing.T) {
	repo := new(mockDashboardRepo)
	svc := dashboard.NewService(repo)
	ctx := context.Background()
	filter := domain.TableFilter{Page: 1, PageSize: 10}
	expected := domain.DashboardSummary{TotalAssets: 42}

	repo.On("GetSummary", ctx, filter).Return(expected, nil)

	res, err := svc.GetDashboardData(ctx, filter)
	assert.NoError(t, err)
	assert.Equal(t, 42, res.TotalAssets)
	repo.AssertExpectations(t)
}

func TestListDashboardTable_ClampsPagination(t *testing.T) {
	repo := new(mockDashboardRepo)
	svc := dashboard.NewService(repo)
	ctx := context.Background()

	filter := domain.TableFilter{Page: -1, PageSize: 500}
	expectedFilter := domain.TableFilter{Page: 1, PageSize: 10}
	rows := []domain.DashboardTableRow{{SarprasCode: "APAR-001"}}

	repo.On("ListDashboardTable", ctx, expectedFilter).Return(rows, int64(1), nil)

	res, total, err := svc.ListDashboardTable(ctx, filter)
	assert.NoError(t, err)
	assert.Equal(t, int64(1), total)
	assert.Len(t, res, 1)
	repo.AssertExpectations(t)
}

func TestListDashboardTable_RepositoryError(t *testing.T) {
	repo := new(mockDashboardRepo)
	svc := dashboard.NewService(repo)
	ctx := context.Background()
	filter := domain.TableFilter{Page: 1, PageSize: 10}

	repo.On("ListDashboardTable", ctx, filter).Return(nil, int64(0), errors.New("timeout"))

	_, _, err := svc.ListDashboardTable(ctx, filter)
	assert.Error(t, err)
	repo.AssertExpectations(t)
}
