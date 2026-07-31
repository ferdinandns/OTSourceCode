package repair

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"emertrack/internal/domain"
	"gorm.io/gorm"
)

const ask_id = "id = ?"

type repairRepository struct {
	db    *gorm.DB
	rawDB *sql.DB
}

func NewRepository(db *gorm.DB, rawDB *sql.DB) domain.RepairRepository {
	return &repairRepository{db: db, rawDB: rawDB}
}

func (r *repairRepository) Create(ctx context.Context, order *domain.RepairOrder) error {
	return r.db.WithContext(ctx).Omit("Sarpras", "PIC", "Submissions").Create(order).Error
}

func (r *repairRepository) FindByID(ctx context.Context, id uint) (*domain.RepairOrder, error) {
	var order domain.RepairOrder
	err := r.db.WithContext(ctx).
		Preload("Sarpras.SarprasType").
		Preload("Sarpras.LocationDept").
		Preload("PIC").
		Preload("Submissions", func(db *gorm.DB) *gorm.DB {
			return db.Order("attempt DESC")
		}).
		First(&order, id).Error
	return &order, err
}

func (r *repairRepository) UpdateStatus(ctx context.Context, id uint, status domain.RepairStatus) error {
	return r.db.WithContext(ctx).
		Model(&domain.RepairOrder{}).
		Where(ask_id, id).
		Update("status", status).Error
}

func (r *repairRepository) UpdateActiveSubmission(ctx context.Context, repairOrderID uint, submissionID uint) error {
	return r.db.WithContext(ctx).
		Model(&domain.RepairOrder{}).
		Where(ask_id, repairOrderID).
		Update("active_submission_id", submissionID).Error
}

func (r *repairRepository) CreateSubmission(ctx context.Context, submission *domain.RepairSubmission) error {
	return r.db.WithContext(ctx).Create(submission).Error
}

func (r *repairRepository) GetActiveSubmission(ctx context.Context, repairOrderID uint) (*domain.RepairSubmission, error) {
	var activeID uint
	err := r.db.WithContext(ctx).
		Model(&domain.RepairOrder{}).
		Select("active_submission_id").
		Where(ask_id, repairOrderID).
		Scan(&activeID).Error
	if err != nil {
		return nil, err
	}
	if activeID == 0 {
		return nil, nil
	}

	var sub domain.RepairSubmission
	err = r.db.WithContext(ctx).
		Preload("Evidences").
		First(&sub, activeID).Error
	if err != nil {
		return nil, err
	}
	return &sub, nil
}

func (r *repairRepository) GetSubmissionsByRepairOrder(ctx context.Context, repairOrderID uint) ([]domain.RepairSubmission, error) {
	var subs []domain.RepairSubmission
	err := r.db.WithContext(ctx).
		Where("repair_order_id = ?", repairOrderID).
		Order("attempt ASC").
		Find(&subs).Error
	return subs, err
}

func (r *repairRepository) GetSubmissionWithEvidences(ctx context.Context, submissionID uint) (*domain.RepairSubmission, error) {
	var sub domain.RepairSubmission
	err := r.db.WithContext(ctx).
		Preload("Evidences").
		First(&sub, submissionID).Error
	return &sub, err
}

func (r *repairRepository) UpdateSubmissionStatus(ctx context.Context, submissionID uint, status string) error {
	return r.db.WithContext(ctx).
		Model(&domain.RepairSubmission{}).
		Where(ask_id, submissionID).
		Update("status", status).Error
}

func (r *repairRepository) AddEvidenceToSubmission(ctx context.Context, evidence *domain.RepairEvidence) error {
	return r.db.WithContext(ctx).Create(evidence).Error
}

func (r *repairRepository) DeleteEvidencesBySubmission(ctx context.Context, submissionID uint) error {
	return r.db.WithContext(ctx).
		Where("submission_id = ?", submissionID).
		Delete(&domain.RepairEvidence{}).Error
}

func (r *repairRepository) ListAll(ctx context.Context, f domain.RepairFilter) ([]domain.RepairRow, int64, error) {
	page, ps := f.Page, f.PageSize
	if page < 1 {
		page = 1
	}
	if ps < 1 {
		ps = 20
	}

	where := "WHERE 1=1"
	var args []interface{}
	idx := 1

	if f.SarprasID != nil {
		where += fmt.Sprintf(" AND ro.sarpras_id = $%d", idx)
		args = append(args, *f.SarprasID)
		idx++
	}
	if f.PICID != nil {
		where += fmt.Sprintf(" AND ro.pic_id = $%d", idx)
		args = append(args, *f.PICID)
		idx++
	}
	if f.Status != nil {
		where += fmt.Sprintf(" AND ro.status = $%d", idx)
		args = append(args, *f.Status)
		idx++
	}
	if f.Search != "" {
		where += fmt.Sprintf(SEARCH, idx, idx)
		args = append(args, "%"+f.Search+"%")
		idx++
	}

	// If PIC is set with no status filter, restrict status list (exclude approved)
	if f.PICID != nil && f.Status == nil {
		allowedStatuses := []domain.RepairStatus{
			domain.RepairAssigned,
			domain.RepairInProgress,
			domain.RepairSubmitted,
			domain.RepairInReview,
			domain.RepairRejected,
		}
		placeholders := make([]string, len(allowedStatuses))
		for i, st := range allowedStatuses {
			placeholders[i] = fmt.Sprintf("$%d", idx)
			args = append(args, st)
			idx++
		}
		where += fmt.Sprintf(" AND ro.status IN (%s)", strings.Join(placeholders, ","))
	}

	var total int64
	countQuery := fmt.Sprintf(COUNT_LIST, where)
	r.rawDB.QueryRowContext(ctx, countQuery, args...).Scan(&total)

	args = append(args, ps, (page-1)*ps)
	rows, err := r.rawDB.QueryContext(ctx, fmt.Sprintf(LIST_ALL, where, idx, idx+1), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var result []domain.RepairRow
	for rows.Next() {
		var row domain.RepairRow
		var actionPlan, picName string
		var dueDate, statusDate *time.Time
		if err := rows.Scan(
			&row.ID, &row.SarprasID, &row.SarprasCode, &row.SarprasName,
			&row.DepartmentName, &row.CheckerName, &row.InspectedAt,
			&actionPlan, &dueDate, &picName,
			&row.SarprasStatus, &row.RepairStatus, &statusDate,
		); err != nil {
			return nil, 0, err
		}
		row.ActionPlan = actionPlan
		row.RepairDueDate = dueDate
		row.PICName = picName
		row.RepairStatusDate = statusDate
		result = append(result, row)
	}

	for i, row := range result {
		nokParams, _ := r.getNOKParamNames(ctx, row.ID)
		result[i].NOKParameters = nokParams
	}

	return result, total, rows.Err()
}

func (r *repairRepository) getNOKParamNames(ctx context.Context, repairOrderID uint) ([]string, error) {
	rows, err := r.rawDB.QueryContext(ctx, GET_NOK_PARAM, repairOrderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var names []string
	for rows.Next() {
		var name string
		rows.Scan(&name)
		names = append(names, name)
	}
	return names, nil
}

func (r *repairRepository) GetDetail(ctx context.Context, repairOrderID uint) (*domain.RepairDetailResponse, error) {
	base, inspectionID, err := r.fetchBaseDetail(ctx, repairOrderID)
	if err != nil {
		return nil, err
	}

	nokDetails, err := r.GetNOKItems(ctx, inspectionID)
	if err != nil {
		return nil, err
	}
	base.NOKDetails = nokDetails

	submissions, err := r.fetchSubmissionsWithDetails(ctx, repairOrderID)
	if err != nil {
		return nil, err
	}
	base.Submissions = submissions

	return base, nil
}

func (r *repairRepository) fetchBaseDetail(ctx context.Context, repairOrderID uint) (*domain.RepairDetailResponse, uint, error) {
	var resp domain.RepairDetailResponse
	var inspectionID uint

	err := r.rawDB.QueryRowContext(ctx, GET_DETAIL_BASE, repairOrderID).Scan(
		&resp.RepairOrderID,
		&resp.PICName,
		&resp.SarprasCode,
		&resp.SarprasName,
		&resp.Department,
		&resp.InspectedAt,
		&resp.Status,
		&resp.ReviewerFeedback,
		&resp.ReviewerName,
		&inspectionID,
	)
	if err != nil {
		return nil, 0, err
	}
	return &resp, inspectionID, nil
}

func (r *repairRepository) fetchSubmissionsWithDetails(ctx context.Context, repairOrderID uint) ([]domain.SubmissionDetail, error) {
	rows, err := r.rawDB.QueryContext(ctx, GET_SUBMISSION_WITH_REVIEW, repairOrderID)
	if err != nil {
		return nil, fmt.Errorf("query submissions gagal: %w", err)
	}
	defer rows.Close()

	var submissions []domain.SubmissionDetail
	for rows.Next() {
		sub, err := r.scanSubmissionRow(rows)
		if err != nil {
			return nil, err
		}

		evidences, err := r.fetchEvidencesForSubmission(ctx, sub.ID)
		if err != nil {
			return nil, fmt.Errorf("gagal ambil evidence untuk submission %d: %w", sub.ID, err)
		}
		sub.Evidences = evidences

		attachments, err := r.fetchReviewAttachmentsForSubmission(ctx, sub.ID)
		if err != nil {
			return nil, fmt.Errorf("gagal ambil review attachments untuk submission %d: %w", sub.ID, err)
		}
		sub.ReviewAttachments = attachments

		submissions = append(submissions, sub)
	}
	return submissions, rows.Err()
}

func (r *repairRepository) scanSubmissionRow(rows *sql.Rows) (domain.SubmissionDetail, error) {
	var sub domain.SubmissionDetail
	var verdict, feedback, reviewerName sql.NullString
	var reviewedAt sql.NullTime

	err := rows.Scan(
		&sub.ID, &sub.Attempt, &sub.ActionPlan, &sub.DueDate,
		&sub.Status, &sub.CreatedAt,
		&verdict, &feedback, &reviewedAt, &reviewerName,
	)
	if err != nil {
		return sub, err
	}

	if verdict.Valid {
		sub.Verdict = verdict.String
	}
	if feedback.Valid {
		sub.Feedback = feedback.String
	}
	if reviewedAt.Valid {
		sub.ReviewedAt = &reviewedAt.Time
	}
	if reviewerName.Valid {
		sub.ReviewerName = reviewerName.String
	}
	return sub, nil
}

func (r *repairRepository) fetchEvidencesForSubmission(ctx context.Context, submissionID uint) ([]string, error) {
	rows, err := r.rawDB.QueryContext(ctx, EVIDENCE_PATH_BY_SUBMISSION, submissionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var paths []string
	for rows.Next() {
		var path string
		if err := rows.Scan(&path); err != nil {
			return nil, err
		}
		paths = append(paths, path)
	}
	return paths, rows.Err()
}

func (r *repairRepository) fetchReviewAttachmentsForSubmission(ctx context.Context, submissionID uint) ([]string, error) {
	rows, err := r.rawDB.QueryContext(ctx, REVIEW_ATTACHMENTS_BY_SUBMISSION, submissionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var paths []string
	for rows.Next() {
		var path string
		if err := rows.Scan(&path); err != nil {
			return nil, err
		}
		paths = append(paths, path)
	}
	return paths, rows.Err()
}

func (r *repairRepository) GetNOKItems(ctx context.Context, inspectionID uint) ([]domain.NOKParameterDetail, error) {
	if inspectionID == 0 {
		return []domain.NOKParameterDetail{}, nil
	}
	rows, err := r.rawDB.QueryContext(ctx, GET_NOK_ITEMS, inspectionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []domain.NOKParameterDetail
	for rows.Next() {
		var d domain.NOKParameterDetail
		if err := rows.Scan(&d.ParameterName, &d.Notes, &d.PhotoURL); err != nil {
			return nil, err
		}
		result = append(result, d)
	}
	return result, rows.Err()
}

func (r *repairRepository) ListPICHistory(ctx context.Context, picID uint, filter domain.RepairHistoryFilter) ([]domain.RepairRow, int64, error) {
	page, ps := filter.Page, filter.PageSize
	if page < 1 {
		page = 1
	}
	if ps < 1 {
		ps = 20
	}

	where := ""
	var args []interface{}
	idx := 2

	if filter.Status != nil {
		where += fmt.Sprintf(" AND ro.status = $%d", idx)
		args = append(args, *filter.Status)
		idx++
	}
	if filter.Search != "" {
		where += fmt.Sprintf(SEARCH, idx, idx)
		args = append(args, "%"+filter.Search+"%")
		idx++
	}

	countQuery := fmt.Sprintf(COUNT_PIC_HISTORY, where)
	var total int64
	if err := r.rawDB.QueryRowContext(ctx, countQuery, append([]interface{}{picID}, args...)...).Scan(&total); err != nil {
		return nil, 0, err
	}

	limitArgs := append([]interface{}{picID}, args...)
	limitArgs = append(limitArgs, ps, (page-1)*ps)
	dataQuery := fmt.Sprintf(LIST_PIC_HISTORY, where, idx, idx+1)
	rows, err := r.rawDB.QueryContext(ctx, dataQuery, limitArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var result []domain.RepairRow
	for rows.Next() {
		var row domain.RepairRow
		var actionPlan, picName string
		var dueDate, statusDate *time.Time
		var inspectedAt *time.Time
		if err := rows.Scan(
			&row.ID, &row.SarprasID, &row.SarprasCode, &row.SarprasName,
			&row.DepartmentName, &row.CheckerName, &inspectedAt,
			&actionPlan, &dueDate, &picName,
			&row.SarprasStatus, &row.RepairStatus, &statusDate,
		); err != nil {
			return nil, 0, err
		}
		row.ActionPlan = actionPlan
		row.RepairDueDate = dueDate
		row.InspectedAt = inspectedAt
		row.PICName = picName
		row.RepairStatusDate = statusDate
		result = append(result, row)
	}
	return result, total, nil
}

func (r *repairRepository) ListMonitoring(ctx context.Context, filter domain.RepairMonitoringFilter) ([]domain.RepairMonitoringRow, int64, error) {
	page, ps := filter.Page, filter.PageSize
	if page < 1 {
		page = 1
	}
	if ps < 1 {
		ps = 20
	}

	conditions := " AND ro.status IN ('assigned', 'in_progress', 'submitted', 'in_review')"
	args := []interface{}{}
	idx := 1

	if filter.DepartmentID != nil && *filter.DepartmentID != 0 {
		conditions += fmt.Sprintf(" AND dept_pic.id = $%d", idx)
		args = append(args, *filter.DepartmentID)
		idx++
	}
	if filter.Search != "" {
		conditions += fmt.Sprintf(SEARCH, idx, idx+1)
		args = append(args, "%"+filter.Search+"%", "%"+filter.Search+"%")
		idx += 2
	}

	countQuery := fmt.Sprintf(COUNT_MONITORING_REPAIR, conditions)
	var total int64
	if err := r.rawDB.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count monitoring repair gagal: %w", err)
	}

	args = append(args, ps, (page-1)*ps)
	dataQuery := fmt.Sprintf(LIST_MONITORING_REPAIR, conditions, idx, idx+1)
	rows, err := r.rawDB.QueryContext(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query monitoring repair gagal: %w", err)
	}
	defer rows.Close()

	var result []domain.RepairMonitoringRow
	for rows.Next() {
		var row domain.RepairMonitoringRow
		var picDepartment, picName, checkerName, actionPlan, reviewerName sql.NullString
		var dueDate sql.NullTime
		var reviewerID sql.NullInt64

		err := rows.Scan(
			&row.RepairOrderID,
			&row.SarprasID,
			&row.SarprasCode,
			&row.SarprasName,
			&picDepartment,
			&picName,
			&checkerName,
			&actionPlan,
			&row.RepairStatus,
			&row.CreatedAt,
			&dueDate,
			&reviewerID,
			&reviewerName,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scan monitoring repair gagal: %w", err)
		}

		row.PICDepartment = picDepartment.String
		row.PICName = picName.String
		row.CheckerName = checkerName.String
		row.ActionPlan = actionPlan.String
		if dueDate.Valid {
			row.DueDate = &dueDate.Time
		}
		if reviewerID.Valid {
			rid := uint(reviewerID.Int64)
			row.ReviewerID = &rid
		}
		row.ReviewerName = reviewerName.String
		result = append(result, row)
	}
	return result, total, nil
}

func (r *repairRepository) ListAllHistory(ctx context.Context, filter domain.RepairAllHistoryFilter) ([]domain.RepairMonitoringRow, int64, error) {
	conditions, args, idx := r.buildAllHistoryConditions(filter)

	total, err := r.countAllHistory(ctx, conditions, args)
	if err != nil {
		return nil, 0, err
	}
	if total == 0 {
		return []domain.RepairMonitoringRow{}, 0, nil
	}

	rows, err := r.queryAllHistory(ctx, conditions, args, idx, filter.Page, filter.PageSize)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	result, err := r.scanAllHistoryRows(rows)
	if err != nil {
		return nil, 0, err
	}
	return result, total, nil
}

func (r *repairRepository) buildAllHistoryConditions(filter domain.RepairAllHistoryFilter) (string, []interface{}, int) {
	conditions := ""
	args := []interface{}{}
	idx := 1

	if filter.DepartmentID != nil && *filter.DepartmentID != 0 {
		conditions += fmt.Sprintf(" AND dept_pic.id = $%d", idx)
		args = append(args, *filter.DepartmentID)
		idx++
	}
	if filter.Search != "" {
		conditions += fmt.Sprintf(SEARCH, idx, idx+1)
		args = append(args, "%"+filter.Search+"%", "%"+filter.Search+"%")
		idx += 2
	}

	return conditions, args, idx
}

func (r *repairRepository) countAllHistory(ctx context.Context, conditions string, args []interface{}) (int64, error) {
	countQuery := fmt.Sprintf(COUNT_ALL_HISTORY, conditions)
	var total int64
	if err := r.rawDB.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return 0, fmt.Errorf("count all history gagal: %w", err)
	}
	return total, nil
}

func (r *repairRepository) queryAllHistory(ctx context.Context, conditions string, args []interface{}, idx, page, pageSize int) (*sql.Rows, error) {
	ps := pageSize
	if ps < 1 {
		ps = 20
	}
	offset := (page - 1) * ps

	dataArgs := append(args, ps, offset)
	dataQuery := fmt.Sprintf(LIST_ALL_HISTORY, conditions, idx, idx+1)
	rows, err := r.rawDB.QueryContext(ctx, dataQuery, dataArgs...)
	if err != nil {
		return nil, fmt.Errorf("query all history gagal: %w", err)
	}
	return rows, nil
}

func (r *repairRepository) scanAllHistoryRows(rows *sql.Rows) ([]domain.RepairMonitoringRow, error) {
	var result []domain.RepairMonitoringRow
	for rows.Next() {
		var row domain.RepairMonitoringRow
		var picDepartment, picName, checkerName, actionPlan, reviewerName sql.NullString
		var dueDate sql.NullTime
		var reviewerID sql.NullInt64
		var updatedAt sql.NullTime

		err := rows.Scan(
			&row.RepairOrderID,
			&row.SarprasID,
			&row.SarprasCode,
			&row.SarprasName,
			&picDepartment,
			&picName,
			&checkerName,
			&actionPlan,
			&row.RepairStatus,
			&row.CreatedAt,
			&dueDate,
			&reviewerID,
			&reviewerName,
			&updatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan all history gagal: %w", err)
		}

		row.PICDepartment = picDepartment.String
		row.PICName = picName.String
		row.CheckerName = checkerName.String
		row.ActionPlan = actionPlan.String
		if dueDate.Valid {
			row.DueDate = &dueDate.Time
		}
		if reviewerID.Valid {
			rid := uint(reviewerID.Int64)
			row.ReviewerID = &rid
		}
		row.ReviewerName = reviewerName.String
		if updatedAt.Valid {
			row.CreatedAt = updatedAt.Time
		}
		result = append(result, row)
	}
	return result, nil
}

func (r *repairRepository) GetRepairReminders(ctx context.Context) ([]domain.RepairReminderRow, error) {
	rows, err := r.db.WithContext(ctx).Raw(REPAIR_REMINDER).Rows()
	if err != nil {
		return nil, fmt.Errorf("Failed query repair reminders: %w", err)
	}
	defer rows.Close()
	var result []domain.RepairReminderRow
	for rows.Next() {
		var row domain.RepairReminderRow
		if err := rows.Scan(
			&row.RepairID,
			&row.PicID,
			&row.SarprasCode,
			&row.SarprasName,
			&row.SubmissionID,
			&row.ActionPlan,
			&row.DueDate,
			&row.EvidenceCount,
		); err != nil {
			fmt.Printf("Failed scan repair reminder row: %w", err)
			continue
		}
		result = append(result, row)
	}
	return result, nil
}
