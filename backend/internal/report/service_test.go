package report_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"emertrack/internal/domain"
	"emertrack/internal/report"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type mockReportRepo struct{ mock.Mock }

func (m *mockReportRepo) GetSarprasReport(ctx context.Context, deptID, status, scheduleStatus, startDate, endDate string) ([]domain.ReportSarprasRow, error) {
	args := m.Called(ctx, deptID, status, scheduleStatus, startDate, endDate)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]domain.ReportSarprasRow), args.Error(1)
}

func TestGetSarprasReport_Success(t *testing.T) {
	repo := new(mockReportRepo)
	svc := report.NewService(repo)
	ctx := context.Background()
	now := time.Now()
	expected := []domain.ReportSarprasRow{{NomorSarpras: "APAR-001", TanggalPeriksa: &now}}

	repo.On("GetSarprasReport", ctx, "", "", "", "", "").Return(expected, nil)

	res, err := svc.GetSarprasReport(ctx, "", "", "", "", "")
	assert.NoError(t, err)
	assert.Len(t, res, 1)
	repo.AssertExpectations(t)
}

func TestGetSarprasReport_EmptyReturnsSlice(t *testing.T) {
	repo := new(mockReportRepo)
	svc := report.NewService(repo)
	ctx := context.Background()

	repo.On("GetSarprasReport", ctx, "1", "ready", "", "", "").Return([]domain.ReportSarprasRow{}, nil)

	res, err := svc.GetSarprasReport(ctx, "1", "ready", "", "", "")
	assert.NoError(t, err)
	assert.NotNil(t, res)
	assert.Len(t, res, 0)
	repo.AssertExpectations(t)
}

func TestGetSarprasReport_Error(t *testing.T) {
	repo := new(mockReportRepo)
	svc := report.NewService(repo)
	ctx := context.Background()

	repo.On("GetSarprasReport", ctx, "", "", "", "", "").Return(nil, errors.New("db error"))

	res, err := svc.GetSarprasReport(ctx, "", "", "", "", "")
	assert.Error(t, err)
	assert.Nil(t, res)
	repo.AssertExpectations(t)
}

func TestExportExcel_Success(t *testing.T) {
	repo := new(mockReportRepo)
	svc := report.NewService(repo)
	ctx := context.Background()
	now := time.Now()
	rows := []domain.ReportSarprasRow{{
		JenisSarpras: "APAR", NomorSarpras: "APAR-001", Department: "ENG",
		Site: "CKR", Status: "ready", NamaPemeriksa: "Budi", TanggalPeriksa: &now,
	}}

	repo.On("GetSarprasReport", ctx, "", "", "", "", "").Return(rows, nil)

	f, err := svc.ExportExcel(ctx, "", "", "", "", "", "Tester")
	assert.NoError(t, err)
	assert.NotNil(t, f)
	repo.AssertExpectations(t)
}
