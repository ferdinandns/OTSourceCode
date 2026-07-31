package domain

import (
	"context"
	"time"

	"github.com/xuri/excelize/v2"
)

type ReportSarprasRow struct {
	ID             uint       `json:"id"`
	ScheduleID     *uint      `json:"schedule_id,omitempty"`
	InspectionID   *uint      `json:"inspection_id,omitempty"`
	JenisSarpras   string     `json:"jenis_sarpras"`
	NomorSarpras   string     `json:"nomor_sarpras"`
	Department     string     `json:"departemen"`
	Site           string     `json:"site"`
	ScheduleStatus string     `json:"schedule_status"`
	ScheduledDate  *time.Time `json:"scheduled_date,omitempty"`
	Status         string     `json:"status"`
	NamaPemeriksa  string     `json:"nama_pemeriksa"`
	TanggalPeriksa *time.Time `json:"tanggal_diperiksa,omitempty"`
	ActionPlan     string     `json:"action_plan"`
	NOKParameters  []string   `json:"nok_parameters"`
}

type ReportRepository interface {
	GetSarprasReport(ctx context.Context, deptID, status, scheduleStatus, startDate, endDate string) ([]ReportSarprasRow, error)
}

type ReportService interface {
	GetSarprasReport(ctx context.Context, deptID, status, scheduleStatus, startDate, endDate string) ([]ReportSarprasRow, error)
	ExportExcel(ctx context.Context, deptID, status, scheduleStatus, startDate, endDate, userName string) (*excelize.File, error)
}
