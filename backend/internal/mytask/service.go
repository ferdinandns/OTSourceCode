package mytask

import (
	"context"
	"emertrack/internal/domain"
)

type myTaskService struct {
	repo domain.MyTaskRepository
}

func NewService(repo domain.MyTaskRepository) domain.MyTaskService {
	return &myTaskService{repo: repo}
}

func (s *myTaskService) GetMyTasks(ctx context.Context, userID uint, roles []string, isSupervisor bool, isGA bool) (*domain.MyTasksResponse, error) {
	return s.repo.GetMyTasks(ctx, userID, roles, isSupervisor, isGA)
}
