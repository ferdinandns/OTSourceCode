package report

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"emertrack/internal/domain"
)

type reportRepository struct {
	rawDB *sql.DB
}

func NewRepository(rawDB *sql.DB) domain.ReportRepository {
	return &reportRepository{rawDB: rawDB}
}

func (r *reportRepository) GetSarprasReport(ctx context.Context, deptID, status, scheduleStatus, startDate, endDate string) ([]domain.ReportSarprasRow, error) {
	query, args := r.buildReportQuery(deptID, status, scheduleStatus, startDate, endDate)

	rows, err := r.rawDB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []domain.ReportSarprasRow
	for rows.Next() {
		row, err := r.scanReportRow(rows)
		if err != nil {
			return nil, err
		}
		results = append(results, row)
	}
	return results, rows.Err()
}

func (r *reportRepository) buildReportQuery(deptID, status, scheduleStatus, startDate, endDate string) (string, []interface{}) {
	query := GET_SARPRAS_REPORT
	fmt.Println(query)
	args := []interface{}{}
	idx := 1

	if deptID != "" {
		query += fmt.Sprintf(DEPT_ID, idx)
		args = append(args, deptID)
		idx++
	}
	if status != "" {
		query += fmt.Sprintf(SARPRAS_STATUS, idx)
		args = append(args, status)
		idx++
	}
	if scheduleStatus != "" {
		query += fmt.Sprintf(SCHEDULE_STATUS, idx)
		args = append(args, scheduleStatus)
		idx++
	}
	if startDate != "" && endDate != "" {
		query += fmt.Sprintf(START_TO, idx, idx+1)
		args = append(args, startDate, endDate)
		idx += 2
	}

	query += ORDER
	return query, args
}

func (r *reportRepository) scanReportRow(rows *sql.Rows) (domain.ReportSarprasRow, error) {
	var row domain.ReportSarprasRow
	var nokNames string
	var scheduleID sql.NullInt64
	var inspectionID sql.NullInt64
	var inspectedAt sql.NullTime
	var actionPlan sql.NullString

	err := rows.Scan(
		&row.ID,
		&scheduleID,
		&inspectionID,
		&row.JenisSarpras,
		&row.NomorSarpras,
		&row.Department,
		&row.Site,
		&row.ScheduleStatus,
		&row.ScheduledDate,
		&row.Status,
		&row.NamaPemeriksa,
		&inspectedAt,
		&actionPlan,
		&nokNames,
	)
	if err != nil {
		return row, err
	}

	if scheduleID.Valid {
		uid := uint(scheduleID.Int64)
		row.ScheduleID = &uid
	}
	if inspectionID.Valid {
		uid := uint(inspectionID.Int64)
		row.InspectionID = &uid
	}
	if inspectedAt.Valid {
		row.TanggalPeriksa = &inspectedAt.Time
	}
	if actionPlan.Valid {
		row.ActionPlan = actionPlan.String
	}

	row.NOKParameters = r.parseNOKParameters(nokNames)
	return row, nil
}

func (r *reportRepository) parseNOKParameters(nokNames string) []string {
	if nokNames == "" {
		return []string{}
	}
	if strings.HasPrefix(nokNames, "Habis Digunakan:") || nokNames == "Belum Diperiksa" {
		return []string{nokNames}
	}
	return strings.Split(nokNames, " || ")
}
