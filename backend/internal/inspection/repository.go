package inspection

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"emertrack/internal/domain"

	"gorm.io/gorm"
)

type inspectionRepository struct {
	db    *gorm.DB
	rawDB *sql.DB
}

func NewRepository(db *gorm.DB, rawDB *sql.DB) domain.InspectionRepository {
	return &inspectionRepository{db: db, rawDB: rawDB}
}

func (r *inspectionRepository) Create(ctx context.Context, insp *domain.Inspection) error {
	return r.db.WithContext(ctx).Omit("Sarpras", "Checker", "Items").Create(insp).Error
}

func (r *inspectionRepository) CreateItem(ctx context.Context, item *domain.InspectionItem) error {
	return r.db.WithContext(ctx).Omit("Parameter").Create(item).Error
}

func (r *inspectionRepository) FindByID(ctx context.Context, id uint) (*domain.Inspection, error) {
	var insp domain.Inspection
	err := r.db.WithContext(ctx).
		Preload("Items.Parameter").
		Preload("Checker", func(db *gorm.DB) *gorm.DB {
			return db.Select("id", "name", "department_id")
		}).
		Preload("Checker.Department").
		Preload("Sarpras.SarprasType").
		Preload("Sarpras.LocationDept").
		First(&insp, id).Error
	return &insp, err
}

func (r *inspectionRepository) GetLatestBySarpras(ctx context.Context, sarprasID uint) (*domain.Inspection, error) {
	var insp domain.Inspection
	err := r.db.WithContext(ctx).
		Where("sarpras_id = ?", sarprasID).
		Order("inspected_at DESC").
		First(&insp).Error
	if err != nil {
		return nil, err
	}
	return &insp, nil
}

func (r *inspectionRepository) ListActiveTasks(ctx context.Context, filter domain.InspectionFilter) ([]domain.InspectionRow, int64, error) {
	page, ps := filter.Page, filter.PageSize
	if page < 1 {
		page = 1
	}
	if ps < 1 {
		ps = 20
	}

	where := ""
	var args []interface{}
	idx := 1

	if filter.SarprasID != nil {
		where += fmt.Sprintf(SARPRAS_ID, idx)
		args = append(args, *filter.SarprasID)
		idx++
	}

	if filter.Search != "" {
		where += fmt.Sprintf(SEARCH, idx, idx)
		args = append(args, "%"+filter.Search+"%")
		idx++
	}

	if filter.UserID != 0 {
		where += fmt.Sprintf(USER_ID, idx)
		args = append(args, filter.UserID)
		idx++

		where += fmt.Sprintf(IS_USER_SUPERVISOR, idx, idx)
		args = append(args, filter.UserID)
		idx++
	}

	countQuery := fmt.Sprintf(COUNT_ACTIVE_TASKS, where)

	var total int64
	r.rawDB.QueryRowContext(ctx, countQuery, args...).Scan(&total)

	args = append(args, ps, (page-1)*ps)
	dataQuery := fmt.Sprintf(LIST_ALL, where, idx, idx+1)

	rows, err := r.rawDB.QueryContext(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var result []domain.InspectionRow
	for rows.Next() {
		var row domain.InspectionRow
		if err := rows.Scan(
			&row.ID, &row.SarprasID, &row.SarprasCode, &row.SarprasName,
			&row.DepartmentName, &row.CheckerName,
			&row.CheckerID,
			&row.InspectedAt, &row.ScheduleStatus, &row.SarprasStatus, &row.NextDueDate,
		); err != nil {
			return nil, 0, err
		}
		result = append(result, row)
	}
	return result, total, nil
}

func (r *inspectionRepository) UpdateOverdueSchedules(ctx context.Context) error {
	now := time.Now()
	result := r.db.WithContext(ctx).
		Model(&domain.InspectionSchedule{}).
		Where("due_date < ? AND status IN (?)", now, []domain.ScheduleStatus{domain.SchedulePending, domain.ScheduleInProgress}).
		Update("status", domain.ScheduleOverdue)
	return result.Error
}

func (r *inspectionRepository) UpdateMarkAsNotReady(ctx context.Context) error {
	result := r.db.WithContext(ctx).
		Model(&domain.Sarpras{}).
		Where("id IN (SELECT sarpras_id FROM inspection_schedules WHERE status = 'overdue')").
		Where("status IN ?", []domain.SarprasStatus{domain.SarprasReady, domain.SarprasNeedRepair}).
		Update("status", domain.SarprasNotReady)
	return result.Error
}

func (r *inspectionRepository) ListHistory(ctx context.Context, filter domain.InspectionHistoryFilter) ([]domain.InspectionHistoryRow, int64, error) {
	page, ps := filter.Page, filter.PageSize
	if page < 1 {
		page = 1
	}
	if ps < 1 {
		ps = 20
	}

	where := ""
	var args []interface{}
	idx := 1

	if filter.SarprasID != nil {
		where += fmt.Sprintf(" AND s.id = $%d", idx)
		args = append(args, *filter.SarprasID)
		idx++
	}
	if filter.CheckerID != nil {
		where += fmt.Sprintf(" AND i.checker_id = $%d", idx)
		args = append(args, *filter.CheckerID)
		idx++
	}
	if filter.Search != "" {
		where += fmt.Sprintf(" AND (s.code ILIKE $%d OR st.name ILIKE $%d)", idx, idx+1)
		args = append(args, "%"+filter.Search+"%", "%"+filter.Search+"%")
		idx += 2
	}

	countQuery := fmt.Sprintf(COUNT_HISTORY, where)
	var total int64
	if err := r.rawDB.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, ps, (page-1)*ps)
	dataQuery := fmt.Sprintf(LIST_HISTORY, where, idx, idx+1)
	rows, err := r.rawDB.QueryContext(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var result []domain.InspectionHistoryRow
	for rows.Next() {
		var row domain.InspectionHistoryRow
		var repairID sql.NullInt64
		var repairStatus sql.NullString
		if err := rows.Scan(
			&row.InspectionID, &row.SarprasID, &row.SarprasCode, &row.SarprasName,
			&row.DepartmentName, &row.CheckerName, &row.InspectedAt, &row.OverallStatus,
			&repairID, &repairStatus,
		); err != nil {
			return nil, 0, err
		}
		if repairID.Valid {
			uid := uint(repairID.Int64)
			row.RepairOrderID = &uid
			if repairStatus.Valid {
				st := domain.RepairStatus(repairStatus.String)
				row.RepairStatus = &st
			}
		}
		result = append(result, row)
	}
	return result, total, nil
}

func (r *inspectionRepository) ListMonitoring(ctx context.Context, filter domain.InspectionMonitoringFilter) ([]domain.InspectionMonitoringRow, int64, error) {
	page, ps := filter.Page, filter.PageSize
	if page < 1 {
		page = 1
	}
	if ps < 1 {
		ps = 20
	}

	where := ""
	var args []interface{}
	idx := 1

	if filter.SarprasType != nil {
		where += fmt.Sprintf(" AND st.id = $%d", idx)
		args = append(args, *filter.SarprasType)
		idx++
	}
	if filter.DepartmentID != nil && *filter.DepartmentID != 0 {
		where += fmt.Sprintf(" AND d.id = $%d", idx)
		args = append(args, *filter.DepartmentID)
		idx++
	}
	if filter.Search != "" {
		where += fmt.Sprintf(" AND (s.code ILIKE $%d OR st.name ILIKE $%d)", idx, idx+1)
		args = append(args, "%"+filter.Search+"%", "%"+filter.Search+"%")
		idx += 2
	}

	countQuery := fmt.Sprintf(COUNT_MONITORING, where)
	var total int64
	if err := r.rawDB.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count monitoring gagal: %w", err)
	}

	limitPlaceholder := fmt.Sprintf("$%d", idx)
	offsetPlaceholder := fmt.Sprintf("$%d", idx+1)
	dataQuery := fmt.Sprintf(LIST_MONITORING, where, limitPlaceholder, offsetPlaceholder)

	args = append(args, ps, (page-1)*ps)
	rows, err := r.rawDB.QueryContext(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query monitoring gagal: %w", err)
	}
	defer rows.Close()

	var result []domain.InspectionMonitoringRow
	for rows.Next() {
		var row domain.InspectionMonitoringRow
		var checkerID sql.NullInt64
		if err := rows.Scan(
			&row.InspectionID,
			&row.SarprasID,
			&row.SarprasCode,
			&row.SarprasName,
			&row.DepartmentName,
			&row.CheckerName,
			&checkerID,
			&row.CreatedAt,
			&row.ScheduleStatus,
			&row.SarprasStatus,
			&row.NextDueDate,
		); err != nil {
			return nil, 0, fmt.Errorf("scan monitoring gagal: %w", err)
		}
		if checkerID.Valid {
			row.CheckerID = uint(checkerID.Int64)
		} else {
			row.CheckerID = 0
		}
		result = append(result, row)
	}
	return result, total, nil
}

func (r *inspectionRepository) GetRepairOrderByInspection(ctx context.Context, inspectionID uint) (*domain.RepairOrder, error) {
	var repairOrder domain.RepairOrder
	if err := r.db.WithContext(ctx).
		Where("inspection_id = ?", inspectionID).
		First(&repairOrder).Error; err != nil {
		return nil, err
	}
	return &repairOrder, nil
}

func (r *inspectionRepository) GetSubmissionsByRepairOrder(ctx context.Context, repairOrderID uint) ([]domain.RepairSubmission, error) {
	var submissions []domain.RepairSubmission
	if err := r.db.WithContext(ctx).
		Preload("Evidences").
		Where("repair_order_id = ?", repairOrderID).
		Order("attempt ASC").
		Find(&submissions).Error; err != nil {
		return nil, err
	}
	return submissions, nil
}

func (r *inspectionRepository) GetReviewBySubmission(ctx context.Context, submissionID uint) (*domain.ReviewOrder, error) {
	var review domain.ReviewOrder
	if err := r.db.WithContext(ctx).
		Preload("Attachments").
		Where("submission_id = ?", submissionID).
		First(&review).Error; err != nil {
		return nil, err
	}
	return &review, nil
}

func (r *inspectionRepository) GetReviewerByID(ctx context.Context, reviewerID uint) (*domain.User, error) {
	var reviewer domain.User
	if err := r.db.WithContext(ctx).First(&reviewer, reviewerID).Error; err != nil {
		return nil, err
	}
	return &reviewer, nil
}

func (r *inspectionRepository) GetSarprasForScheduling(ctx context.Context) ([]domain.SarprasSchedulingData, error) {
	var result []domain.SarprasSchedulingData
	err := r.db.WithContext(ctx).
		Table("sarpras s").
		Select("s.id, s.due_date, st.insp_interval_months").
		Joins("JOIN sarpras_types st ON st.id = s.sarpras_type_id").
		Where("s.status IN (?, ?)", domain.SarprasReady, domain.SarprasNotReady).
		Scan(&result).Error
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (r *inspectionRepository) HasActiveSchedule(ctx context.Context, sarprasID uint) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&domain.InspectionSchedule{}).
		Where("sarpras_id = ? AND status IN (?)", sarprasID, []domain.ScheduleStatus{
			domain.SchedulePending,
			domain.ScheduleInProgress,
		}).
		Count(&count).Error
	return count > 0, err
}

func (r *inspectionRepository) HasScheduleForDueDate(ctx context.Context, sarprasID uint, dueDate time.Time) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&domain.InspectionSchedule{}).
		Where("sarpras_id = ? AND due_date = ?", sarprasID, dueDate).
		Count(&count).Error
	return count > 0, err
}

func (r *inspectionRepository) CreateSchedule(ctx context.Context, schedule *domain.InspectionSchedule) error {
	return r.db.WithContext(ctx).Create(schedule).Error
}

func (r *inspectionRepository) GetSchedulesForReminder(ctx context.Context) ([]domain.InspectionSchedule, error) {
	rows, err := r.rawDB.QueryContext(ctx, GET_SCHEDULES_FOR_REMINDER)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var schedules []domain.InspectionSchedule
	for rows.Next() {
		var s domain.InspectionSchedule
		var checkerID sql.NullInt64
		err := rows.Scan(&s.ID, &s.SarprasID, &checkerID, &s.DueDate, &s.Status, &s.CreatedAt)
		if err != nil {
			return nil, err
		}
		if checkerID.Valid {
			id := uint(checkerID.Int64)
			s.CheckerID = &id
		}
		schedules = append(schedules, s)
	}
	return schedules, rows.Err()
}

func scanTime(t *time.Time) interface{} {
	if t == nil {
		return nil
	}
	return t
}
