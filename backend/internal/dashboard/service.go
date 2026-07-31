package dashboard

import (
	"context"
	"time"

	"emertrack/internal/domain"
)

type dashboardService struct {
	dashboardRepo domain.DashboardRepository
}

func NewService(dashboardRepo domain.DashboardRepository) domain.DashboardService {
	return &dashboardService{dashboardRepo: dashboardRepo}
}

func (s *dashboardService) GetDashboardData(ctx context.Context, filter domain.TableFilter) (domain.DashboardSummary, error) {
	if filter.Year <= 0 {
		filter.Year = time.Now().Year()
	}
	return s.dashboardRepo.GetSummary(ctx, filter)
}

func (s *dashboardService) ListDashboardTable(ctx context.Context, filter domain.TableFilter) ([]domain.DashboardTableRow, int64, error) {
	if filter.PageSize <= 0 || filter.PageSize > 100 {
		filter.PageSize = 10
	}
	if filter.Page <= 0 {
		filter.Page = 1
	}
	return s.dashboardRepo.ListDashboardTable(ctx, filter)
}