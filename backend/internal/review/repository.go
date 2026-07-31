package review

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"emertrack/internal/audit"
	"emertrack/internal/domain"
	"emertrack/pkg/util"

	"gorm.io/gorm"
)

type reviewRepository struct {
	db    *gorm.DB
	rawDB *sql.DB
}

func NewRepository(db *gorm.DB, rawDB *sql.DB) domain.ReviewRepository {
	return &reviewRepository{db: db, rawDB: rawDB}
}

// ListPendingReviews returns all repair orders with status = 'submitted'
func (r *reviewRepository) ListPendingReviews(ctx context.Context, f domain.ReviewFilter) ([]domain.ReviewRow, int64, error) {
	page, ps := f.Page, f.PageSize
	if page < 1 {
		page = 1
	}
	if ps < 1 {
		ps = 20
	}

	where := "WHERE ro.status IN ('submitted', 'in_review')"
	var args []interface{}
	idx := 1

	if f.Search != "" {
		where += fmt.Sprintf(SEARCH_FILTER, idx, idx, idx)
		args = append(args, "%"+f.Search+"%")
		idx++
	}
	if f.SiteID != nil {
		where += fmt.Sprintf(SITE_FILTER, idx)
		args = append(args, *f.SiteID)
		idx++
	}
	if f.DeptID != nil {
		where += fmt.Sprintf(DEPT_FILTER, idx)
		args = append(args, *f.DeptID)
		idx++
	}

	var total int64
	r.rawDB.QueryRowContext(ctx, fmt.Sprintf(COUNT_TOTAL, where), args...).Scan(&total)

	sortCol := "ro.updated_at"
	sortDir := "DESC"
	switch f.SortBy {
	case "sarpras_code":
		sortCol = "s.code"
	case "sarpras_name":
		sortCol = "st.name"
	case "department":
		sortCol = "d.name"
	case "pic_name":
		sortCol = "u_pic.name"
	case "submitted_at":
		sortCol = "ro.updated_at"
	}
	if f.SortDir == "asc" {
		sortDir = "ASC"
	}

	args = append(args, ps, (page-1)*ps)
	rows, err := r.rawDB.QueryContext(ctx, fmt.Sprintf(LIST_PENDING, where, sortCol, sortDir, idx, idx+1), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var result []domain.ReviewRow
	for rows.Next() {
		var row domain.ReviewRow
		var submittedAt *time.Time
		if err := rows.Scan(
			&row.RepairOrderID, &row.SarprasID, &row.SarprasCode, &row.SarprasName,
			&row.Site, &row.Department,
			&row.PICName, &submittedAt,
			&row.RepairStatus, &row.SarprasStatus, &row.ReviewerID,
		); err != nil {
			return nil, 0, err
		}
		row.SubmittedAt = submittedAt
		result = append(result, row)
	}

	for i, row := range result {
		nokParams, _ := r.getNOKParamNames(ctx, row.RepairOrderID)
		result[i].NOKParameters = nokParams
	}

	return result, total, nil
}

func (r *reviewRepository) getNOKParamNames(ctx context.Context, repairOrderID uint) ([]string, error) {
	rows, err := r.rawDB.QueryContext(ctx, GET_NOK_PARAM_NAMES, repairOrderID)
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

// GetReviewDetail returns full detail for QS review page
func (r *reviewRepository) GetReviewDetail(ctx context.Context, repairOrderID uint) (*domain.ReviewDetailResponse, error) {
	var resp domain.ReviewDetailResponse
	var inspectionID uint

	err := r.rawDB.QueryRowContext(ctx, GET_REVIEW_DETAIL, repairOrderID).Scan(
		&resp.RepairOrderID, &resp.SarprasCode, &resp.SarprasName,
		&resp.Site, &resp.Department, &resp.LocationDetail,
		&resp.PICName, &resp.ReportDate, &resp.RepairDoneAt,
		&resp.Status, &resp.ActionPlan, &inspectionID,
	)
	if err != nil {
		return nil, fmt.Errorf("review detail not found: %w", err)
	}

	resp.Category = resp.SarprasName

	nokDetails, err := r.getNOKItems(ctx, inspectionID)
	if err != nil {
		return nil, err
	}
	resp.NOKDetails = nokDetails

	var activeSubID uint
	err = r.db.WithContext(ctx).
		Model(&domain.RepairOrder{}).
		Select("active_submission_id").
		Where("id = ?", repairOrderID).
		Scan(&activeSubID).Error
	if err == nil && activeSubID != 0 {
		evidRows, err := r.rawDB.QueryContext(ctx, REPAIR_EVIDENCE, activeSubID)
		if err == nil {
			defer evidRows.Close()
			for evidRows.Next() {
				var path string
				if err := evidRows.Scan(&path); err == nil {
					resp.Evidences = append(resp.Evidences, path)
				}
			}
		}
	}

	return &resp, nil
}

func (r *reviewRepository) getNOKItems(ctx context.Context, inspectionID uint) ([]domain.NOKParameterDetail, error) {
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

func (r *reviewRepository) SubmitReview(ctx context.Context, repairOrderID uint, reviewerID uint, verdict domain.ReviewVerdict, feedback string) error {
	return nil
}

func (r *reviewRepository) GetReviewSummary(ctx context.Context) (*domain.ReviewSummary, error) {
	var summary domain.ReviewSummary
	err := r.rawDB.QueryRowContext(ctx, GET_SUMMARY).Scan(&summary.Approved, &summary.Rejected, &summary.InReview, &summary.WaitingReview)
	return &summary, err
}

func (r *reviewRepository) ListReviewsByRepairOrderID(ctx context.Context, repairOrderID uint, limit, offset int) ([]domain.ReviewOrder, int64, error) {
	var reviews []domain.ReviewOrder
	var total int64

	if err := r.db.WithContext(ctx).Model(&domain.ReviewOrder{}).Where("repair_order_id = ?", repairOrderID).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if total == 0 {
		return []domain.ReviewOrder{}, 0, nil
	}

	err := r.db.WithContext(ctx).
		Where("repair_order_id = ?", repairOrderID).
		Preload("Reviewer").
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&reviews).Error

	return reviews, total, err
}

func (r *reviewRepository) ListQSHistory(ctx context.Context, reviewerID uint, filter domain.ReviewHistoryFilter) ([]domain.ReviewHistoryRow, int64, error) {
	page, ps := filter.Page, filter.PageSize
	if page < 1 {
		page = 1
	}
	if ps < 1 {
		ps = 20
	}
	offset := (page - 1) * ps

	where := ""
	var args []interface{}
	idx := 2

	if filter.Verdict != nil {
		where += fmt.Sprintf(" AND rev.verdict = $%d", idx)
		args = append(args, *filter.Verdict)
		idx++
	}
	if filter.Search != "" {
		where += fmt.Sprintf(" AND (s.code ILIKE $%d OR st.name ILIKE $%d)", idx, idx)
		args = append(args, "%"+filter.Search+"%")
		idx += 2
	}

	countQuery := fmt.Sprintf(COUNT_QS_HISTORY, where)
	var total int64
	countArgs := append([]interface{}{reviewerID}, args...)
	if err := r.rawDB.QueryRowContext(ctx, countQuery, countArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}
	if total == 0 {
		return []domain.ReviewHistoryRow{}, 0, nil
	}

	dataArgs := append([]interface{}{reviewerID}, args...)
	dataArgs = append(dataArgs, ps, offset)
	dataQuery := fmt.Sprintf(LIST_QS_HISTORY, where, idx, idx+1)
	rows, err := r.rawDB.QueryContext(ctx, dataQuery, dataArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var result []domain.ReviewHistoryRow
	for rows.Next() {
		var row domain.ReviewHistoryRow
		if err := rows.Scan(
			&row.ReviewID, &row.RepairOrderID, &row.SarprasCode, &row.SarprasName,
			&row.DepartmentName, &row.Verdict, &row.Feedback, &row.ReviewedAt,
			&row.ReviewerName, &row.RepairStatus,
		); err != nil {
			return nil, 0, err
		}
		result = append(result, row)
	}
	return result, total, nil
}

func (r *reviewRepository) GetReviewHistoryDetail(ctx context.Context, reviewID uint) (*domain.ReviewHistoryDetail, error) {
	var detail domain.ReviewHistoryDetail
	var evidenceStr, nokDetailsJSON string

	err := r.rawDB.QueryRowContext(ctx, GET_REVIEW_HISTORY_DETAIL, reviewID).Scan(
		&detail.ReviewID, &detail.RepairOrderID, &detail.SarprasCode, &detail.SarprasName,
		&detail.DepartmentName, &detail.Verdict, &detail.Feedback, &detail.ReviewedAt,
		&detail.ReviewerName, &detail.RepairStatus, &detail.ActionPlan,
		&evidenceStr, &nokDetailsJSON,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if evidenceStr != "" {
		detail.EvidencePaths = strings.Split(evidenceStr, "|")
	}

	if nokDetailsJSON != "" && nokDetailsJSON != "[]" {
		if err := json.Unmarshal([]byte(nokDetailsJSON), &detail.NOKDetails); err != nil {
			detail.NOKDetails = []domain.NOKDetail{}
		}
	} else {
		detail.NOKDetails = []domain.NOKDetail{}
	}

	return &detail, nil
}

func (r *reviewRepository) GetAllHistoryForExport(ctx context.Context, reviewerID uint, filter domain.ReviewHistoryFilter) ([]domain.ReviewHistoryDetail, error) {
	conditions := ""
	args := []interface{}{reviewerID}
	idx := 2

	if filter.Verdict != nil {
		conditions += fmt.Sprintf(" AND rev.verdict = $%d", idx)
		args = append(args, *filter.Verdict)
		idx++
	}
	if filter.Search != "" {
		conditions += fmt.Sprintf(" AND (s.code ILIKE $%d OR st.name ILIKE $%d)", idx, idx+1)
		likeVal := "%" + filter.Search + "%"
		args = append(args, likeVal, likeVal)
		idx += 2
	}

	query := fmt.Sprintf(GET_ALL_HISTORY_FOR_EXPORT, conditions)
	rows, err := r.rawDB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []domain.ReviewHistoryDetail
	for rows.Next() {
		var detail domain.ReviewHistoryDetail
		var evidenceStr, nokDetailsJSON string

		err := rows.Scan(
			&detail.ReviewID,
			&detail.RepairOrderID,
			&detail.SarprasCode,
			&detail.SarprasName,
			&detail.DepartmentName,
			&detail.Verdict,
			&detail.Feedback,
			&detail.ReviewedAt,
			&detail.ReviewerName,
			&detail.RepairStatus,
			&detail.ActionPlan,
			&evidenceStr,
			&nokDetailsJSON,
		)
		if err != nil {
			return nil, err
		}

		if evidenceStr != "" {
			detail.EvidencePaths = strings.Split(evidenceStr, "|")
		}
		if nokDetailsJSON != "" && nokDetailsJSON != "[]" {
			if err := json.Unmarshal([]byte(nokDetailsJSON), &detail.NOKDetails); err != nil {
				detail.NOKDetails = []domain.NOKDetail{}
			}
		} else {
			detail.NOKDetails = []domain.NOKDetail{}
		}

		results = append(results, detail)
	}
	return results, rows.Err()
}

// ClaimReview sets the repair order status to 'in_review' and assigns the reviewer.
func (r *reviewRepository) ClaimReview(ctx context.Context, repairOrderID uint, reviewerID uint) error {
	res := r.db.WithContext(ctx).
		Model(&domain.RepairOrder{}).
		Where("id = ? AND status = ?", repairOrderID, domain.RepairSubmitted).
		Updates(map[string]interface{}{
			"status":      domain.RepairInReview,
			"reviewer_id": reviewerID,
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return errors.New("repair order ini sudah tidak tersedia atau sudah di-claim reviewer lain")
	}
	return nil
}

// CancelClaimReview reverts the repair order back to 'submitted' and clears the reviewer.
func (r *reviewRepository) CancelClaimReview(ctx context.Context, repairOrderID uint, reviewerID uint) error {
	res := r.db.WithContext(ctx).
		Model(&domain.RepairOrder{}).
		Where("id = ? AND reviewer_id = ? AND status = ?", repairOrderID, reviewerID, domain.RepairInReview).
		Updates(map[string]interface{}{
			"status":      domain.RepairSubmitted,
			"reviewer_id": nil,
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return errors.New("kamu tidak berhak membatalkan claim review ini")
	}
	return nil
}

// GetRepairOrderForReview returns the repair order including its sarpras.
func (r *reviewRepository) GetRepairOrderForReview(ctx context.Context, repairOrderID uint) (*domain.RepairOrder, error) {
	var order domain.RepairOrder
	err := r.db.WithContext(ctx).Preload("Sarpras").First(&order, repairOrderID).Error
	return &order, err
}

// SubmitCompleteReview performs the entire review workflow inside a single database transaction.
func (r *reviewRepository) SubmitCompleteReview(ctx context.Context, repairOrderID uint, reviewerID uint, req domain.ReviewSubmitRequest) error {
	tx := r.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return tx.Error
	}
	defer func() {
		if rec := recover(); rec != nil {
			tx.Rollback()
		}
	}()

	now := time.Now()

	// Determine active submission ID
	var activeSubID uint
	if err := tx.Model(&domain.RepairOrder{}).
		Select("active_submission_id").
		Where("id = ?", repairOrderID).
		Scan(&activeSubID).Error; err != nil {
		tx.Rollback()
		return err
	}
	var subID *uint
	if activeSubID != 0 {
		subID = &activeSubID
	}

	// Obtain sarpras information for status update and audit message
	type sarprasInfo struct {
		SarprasID   uint   `gorm:"column:sarpras_id"`
		SarprasCode string `gorm:"column:code"`
	}
	var info sarprasInfo
	if err := tx.Raw(`
		SELECT ro.sarpras_id, s.code
		FROM repair_orders ro
		JOIN sarpras s ON s.id = ro.sarpras_id
		WHERE ro.id = ?
	`, repairOrderID).Scan(&info).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("gagal ambil info sarpras: %w", err)
	}

	newRepairStatus := domain.RepairApproved
	newSarprasStatus := domain.SarprasReady
	auditAction := "REVIEW_APPROVE"
	submissionStatus := "approved"

	if req.Verdict == domain.ReviewReject {
		newRepairStatus = domain.RepairRejected
		newSarprasStatus = domain.SarprasNeedRepair
		auditAction = "REVIEW_REJECT"
		submissionStatus = "rejected"
	} else {
		// Approve: sarpras hanya boleh berstatus ready kalau tidak ada refill
		// (parameter Masa Berlaku/ED) yang masih aktif untuk sarpras yang sama.
		// Kalau masih ada, jangan overwrite ke ready — biarkan tetap
		// need_repair supaya tidak "menipu" status padahal refill belum kelar
		// (race condition antara alur repair dan alur refill).
		hasActiveRefill, err := r.hasActiveRefill(tx, info.SarprasID)
		if err != nil {
			tx.Rollback()
			return fmt.Errorf("gagal cek status refill aktif: %w", err)
		}
		if hasActiveRefill {
			newSarprasStatus = domain.SarprasNeedRepair
		}
	}

	var auditMsg string
	if req.Verdict == domain.ReviewApprove {
		if newSarprasStatus == domain.SarprasReady {
			auditMsg = fmt.Sprintf("QS menyetujui perbaikan sarpras %s. Feedback: %s. Status sarpras menjadi READY.", info.SarprasCode, req.Feedback)
		} else {
			auditMsg = fmt.Sprintf("QS menyetujui perbaikan sarpras %s. Feedback: %s. Status sarpras tetap NEED_REPAIR karena masih ada proses refill (Masa Berlaku) yang belum selesai.", info.SarprasCode, req.Feedback)
		}
	} else {
		auditMsg = fmt.Sprintf("QS menolak perbaikan sarpras %s. Feedback: %s. Status dikembalikan ke need_repair.", info.SarprasCode, req.Feedback)
	}

	// Upsert review record keyed by (repair_order_id, submission_id)
	v := req.Verdict
	var review domain.ReviewOrder
	err := tx.Where("repair_order_id = ? AND submission_id = ?", repairOrderID, subID).
		First(&review).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		review = domain.ReviewOrder{
			RepairOrderID: repairOrderID,
			SubmissionID:  subID,
			ReviewerID:    &reviewerID,
			Verdict:       &v,
			Feedback:      req.Feedback,
			ReviewedAt:    &now,
			CreatedAt:     now,
			UpdatedAt:     now,
		}
		if createErr := tx.Create(&review).Error; createErr != nil {
			tx.Rollback()
			return fmt.Errorf("gagal menyimpan data review: %w", createErr)
		}
	} else if err != nil {
		tx.Rollback()
		return fmt.Errorf("gagal mencari review: %w", err)
	} else {
		review.ReviewerID = &reviewerID
		review.Verdict = &v
		review.Feedback = req.Feedback
		review.ReviewedAt = &now
		review.UpdatedAt = now
		if updateErr := tx.Save(&review).Error; updateErr != nil {
			tx.Rollback()
			return fmt.Errorf("gagal memperbarui data review: %w", updateErr)
		}
	}
	reviewID := review.ID

	// Clean and re-insert attachments
	if err := tx.Where("review_order_id = ?", reviewID).Delete(&domain.ReviewAttachment{}).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("gagal membersihkan attachment lama: %w", err)
	}
	for _, path := range req.Attachments {
		att := &domain.ReviewAttachment{
			ReviewOrderID: reviewID,
			FilePath:      path,
			UploadedAt:    now,
		}
		if err := tx.Create(att).Error; err != nil {
			tx.Rollback()
			return fmt.Errorf("gagal simpan attachment review: %w", err)
		}
	}

	// Update repair order
	upd := map[string]interface{}{
		"status":      newRepairStatus,
		"reviewer_id": reviewerID,
		"updated_at":  now,
	}
	if err := tx.Model(&domain.RepairOrder{}).Where("id = ?", repairOrderID).Updates(upd).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("gagal update repair order: %w", err)
	}

	// Update sarpras status
	if err := tx.Model(&domain.Sarpras{}).Where("id = ?", info.SarprasID).Update("status", newSarprasStatus).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("gagal update status sarpras: %w", err)
	}

	// Update active submission status to reflect the review result
	if err := tx.Model(&domain.RepairSubmission{}).Where("id = ?", activeSubID).Update("status", submissionStatus).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("gagal update submission status: %w", err)
	}

	// Refresh schedule snapshot (if applicable)
	scheduleID := r.getScheduleID(tx, repairOrderID)
	if err := util.UpdateScheduleSnapshot(tx, scheduleID, string(newSarprasStatus)); err != nil {
		tx.Rollback()
		return fmt.Errorf("gagal update snapshot: %w", err)
	}

	// Audit log
	if err := audit.Record(tx, reviewerID, auditAction, "Verifikasi Perbaikan", auditMsg, repairOrderID, nil); err != nil {
		tx.Rollback()
		return fmt.Errorf("gagal mencatat audit log: %w", err)
	}

	return tx.Commit().Error
}

// hasActiveRefill returns true if the sarpras has a refill order item that is
// still in progress (waiting_evidence / waiting_review). Used so that
// approving a repair order doesn't prematurely mark the sarpras "ready"
// while its ED (expiry) parameter is still being refilled by GA.
func (r *reviewRepository) hasActiveRefill(tx *gorm.DB, sarprasID uint) (bool, error) {
	var count int64
	if err := tx.Table("refill_order_items").
		Where("sarpras_id = ? AND status IN ('waiting_evidence', 'waiting_review')", sarprasID).
		Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *reviewRepository) getScheduleID(tx *gorm.DB, repairOrderID uint) *uint {
	var scheduleID *uint
	tx.Table("inspections i").
		Select("i.schedule_id").
		Joins("JOIN repair_orders ro ON ro.inspection_id = i.id").
		Where("ro.id = ?", repairOrderID).
		Scan(&scheduleID)
	return scheduleID
}