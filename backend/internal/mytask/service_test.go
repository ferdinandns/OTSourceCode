package mytask_test

import (
	"context"
	"errors"
	"testing"

	"emertrack/internal/domain"
	"emertrack/internal/mytask"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type mockMyTaskRepo struct{ mock.Mock }

func (m *mockMyTaskRepo) GetMyTasks(ctx context.Context, userID uint, roles []string, isSupervisor bool, isGA bool) (*domain.MyTasksResponse, error) {
	args := m.Called(ctx, userID, roles, isSupervisor, isGA)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.MyTasksResponse), args.Error(1)
}

func TestGetMyTasks_Success(t *testing.T) {
	repo := new(mockMyTaskRepo)
	svc := mytask.NewService(repo)
	ctx := context.Background()
	roles := []string{"qs"}
	expected := &domain.MyTasksResponse{
		Approvals:   []domain.TaskItem{{ID: 1, Title: "Approval 1"}},
		Inspections: []domain.TaskItem{{ID: 2, Title: "Inspect APAR"}},
	}

	repo.On("GetMyTasks", ctx, uint(10), roles, true, false).Return(expected, nil)

	res, err := svc.GetMyTasks(ctx, 10, roles, true, false)
	assert.NoError(t, err)
	assert.Len(t, res.Approvals, 1)
	assert.Len(t, res.Inspections, 1)
	repo.AssertExpectations(t)
}

func TestGetMyTasks_Error(t *testing.T) {
	repo := new(mockMyTaskRepo)
	svc := mytask.NewService(repo)
	ctx := context.Background()

	repo.On("GetMyTasks", ctx, uint(99), []string(nil), false, false).Return(nil, errors.New("db error"))

	res, err := svc.GetMyTasks(ctx, 99, nil, false, false)
	assert.Error(t, err)
	assert.Nil(t, res)
	repo.AssertExpectations(t)
}
