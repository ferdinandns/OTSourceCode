package refill

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"emertrack/internal/domain"
	"emertrack/pkg/paginator"

	"github.com/lib/pq"
	"gorm.io/gorm"
)

type refillRepo struct {
	db    *gorm.DB
	rawDB *sql.DB
}

func NewRefillRepository(db *gorm.DB, rawDB *sql.DB) domain.RefillRepository {
	return &refillRepo{db: db, rawDB: rawDB}
}

func (r *refillRepo) GetAparList(params domain.GetAparListParams) ([]domain.AparListRow, int, int, int, error) {
	limit, offset := paginator.ValidateLimitOffset(params.Limit, params.Offset)

	where := "WHERE stt.is_apar = true"
	args := []interface{}{}
	idx := 1

	switch params.EDStatus {
	case "expired":
		where += " AND st.expired_date < NOW()::date"
	case "active":
		where += " AND st.expired_date >= NOW()::date"
	}

	if params.Search != "" {
		where += fmt.Sprintf(" AND (st.code ILIKE $%d OR stt.name ILIKE $%d)", idx, idx)
		args = append(args, "%"+params.Search+"%")
		idx++
	}

	summarySQL := querySummaryCounts + " " + where
	var totalAll, totalExpired, totalActive int
	if err := r.rawDB.QueryRow(summarySQL, args...).Scan(&totalAll, &totalExpired, &totalActive); err != nil {
		return nil, 0, 0, 0, fmt.Errorf("summary query: %w", err)
	}

	mainSQL := queryAparListBase + " " + where + " " + queryAparListOrderBy +
		fmt.Sprintf(" LIMIT $%d OFFSET $%d", idx, idx+1)
	args = append(args, limit, offset)

	rows, err := r.rawDB.Query(mainSQL, args...)
	if err != nil {
		return nil, 0, 0, 0, fmt.Errorf("main query: %w", err)
	}
	defer rows.Close()

	var result []domain.AparListRow
	for rows.Next() {
		var row domain.AparListRow
		var dueDateRefill sql.NullTime
		var poNumber sql.NullString
		var itemID sql.NullInt64
		var itemStatus sql.NullString

		if err := rows.Scan(
			&row.SarprasID,
			&row.SarprasType,
			&row.SarprasNo,
			&row.LocationDpt,
			&row.ExpiredDate,
			&row.EDStatus,
			&row.ProgressRefill,
			&dueDateRefill,
			&poNumber,
			&itemID,
			&itemStatus,
		); err != nil {
			return nil, 0, 0, 0, fmt.Errorf("scan row: %w", err)
		}

		if dueDateRefill.Valid {
			row.DueDateRefill = &dueDateRefill.Time
		}
		if poNumber.Valid {
			row.PONumber = &poNumber.String
		}
		if itemID.Valid {
			u := uint(itemID.Int64)
			row.ItemID = &u
		}
		if itemStatus.Valid {
			row.ItemStatus = &itemStatus.String
		}
		result = append(result, row)
	}

	return result, totalAll, totalActive, totalExpired, rows.Err()
}

func (r *refillRepo) GetAparDetail(sarprasID uint) (*domain.AparListRow, error) {
	var row domain.AparListRow
	var dueDateRefill sql.NullTime
	var poNumber sql.NullString
	var itemID sql.NullInt64
	var itemStatus sql.NullString

	err := r.rawDB.QueryRow(queryAparDetail, sarprasID).Scan(
		&row.SarprasID,
		&row.SarprasType,
		&row.SarprasNo,
		&row.LocationDpt,
		&row.ExpiredDate,
		&row.EDStatus,
		&row.ProgressRefill,
		&dueDateRefill,
		&poNumber,
		&itemID,
		&itemStatus,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("refill GetAparDetail query: %w", err)
	}

	if dueDateRefill.Valid {
		row.DueDateRefill = &dueDateRefill.Time
	}
	if poNumber.Valid {
		row.PONumber = &poNumber.String
	}
	if itemID.Valid {
		u := uint(itemID.Int64)
		row.ItemID = &u
	}
	if itemStatus.Valid {
		row.ItemStatus = &itemStatus.String
	}
	return &row, nil
}

func (r *refillRepo) ValidateSarprasForRefill(sarprasIDs []uint) ([]uint, error) {
	sqlDB, err := r.db.DB()
	if err != nil {
		return nil, err
	}
	rows, err := sqlDB.Query(queryValidateSarprasForRefill, pq.Array(sarprasIDs))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var validIDs []uint
	for rows.Next() {
		var id uint
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		validIDs = append(validIDs, id)
	}
	return validIDs, rows.Err()
}

func (r *refillRepo) GetAparsExpiringOrExpired(daysAhead int) ([]domain.AparNearExpiry, error) {
	rows, err := r.rawDB.Query(queryAparsExpiringOrExpired, daysAhead)
	if err != nil {
		return nil, fmt.Errorf("expiring-or-expired query: %w", err)
	}
	defer rows.Close()

	var result []domain.AparNearExpiry
	for rows.Next() {
		var a domain.AparNearExpiry
		if err = rows.Scan(&a.SarprasID, &a.SarprasNo, &a.ExpiredDate); err != nil {
			return nil, err
		}
		result = append(result, a)
	}
	return result, rows.Err()
}

func (r *refillRepo) GetRefillPendingVerification(daysThreshold int) ([]domain.RefillPendingItem, error) {
	rows, err := r.rawDB.Query(queryRefillPendingVerification, daysThreshold)
	if err != nil {
		return nil, fmt.Errorf("pending-verification query: %w", err)
	}
	defer rows.Close()

	var result []domain.RefillPendingItem
	for rows.Next() {
		var p domain.RefillPendingItem
		if err := rows.Scan(&p.ItemID, &p.SarprasCode, &p.EvidenceAt); err != nil {
			return nil, err
		}
		result = append(result, p)
	}
	return result, rows.Err()
}

func (r *refillRepo) CreateOrder(order *domain.RefillOrder, items []domain.RefillOrderItem) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(order).Error; err != nil {
			return err
		}
		for i := range items {
			items[i].RefillOrderID = order.ID
			items[i].Status = "waiting_evidence"
		}
		return tx.Create(&items).Error
	})
}

func (r *refillRepo) UpdateItemEvidence(itemID uint, userID uint, newDate time.Time, path string, reason string) error {
	now := time.Now()
	return r.db.Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&domain.RefillOrderItem{}).
			Where("id = ? AND status IN ('waiting_evidence','rejected')", itemID).
			Updates(map[string]interface{}{
				"new_expire_date": newDate,
				"evidence_path":   path,
				"update_reason":   reason,
				"evidence_by":     userID,
				"evidence_at":     now,
				"status":          "waiting_review",
				"updated_at":      now,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return fmt.Errorf("item tidak ditemukan atau sudah tidak bisa diupdate (status tidak sesuai)")
		}
		return nil
	})
}

func (r *refillRepo) GetVerifyDetail(itemID uint) (*domain.VerifyDetailResponse, error) {
	var resp domain.VerifyDetailResponse
	var evidencePath sql.NullString
	var newExpireDate sql.NullTime
	var evidenceBy sql.NullString

	err := r.rawDB.QueryRow(queryVerifyDetail, itemID).Scan(
		&resp.ItemID, &resp.SarprasID, &resp.SarprasType, &resp.SarprasNo,
		&resp.Location, &resp.ExpiredDate,
		&newExpireDate, &evidencePath, &resp.UpdateReason,
		&evidenceBy, &resp.EvidenceAt,
		&resp.PONumber, &resp.DueDate,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if newExpireDate.Valid {
		resp.NewExpireDate = &newExpireDate.Time
	}
	if evidencePath.Valid {
		resp.EvidencePath = evidencePath.String
	}
	if evidenceBy.Valid {
		resp.EvidenceBy = evidenceBy.String
	}
	return &resp, nil
}

func (r *refillRepo) GetEmailsByDepartment(deptName string) ([]string, error) {
	var emails []string
	err := r.db.Raw(queryEmailsByDepartment, deptName).Scan(&emails).Error
	return emails, err
}

func (r *refillRepo) GetEmailsByRole(role string) ([]string, error) {
	var emails []string
	err := r.db.Raw(queryEmailsByRole, role).Scan(&emails).Error
	return emails, err
}

func (r *refillRepo) GetActiveRefillBySarprasID(ctx context.Context, sarprasID uint) (*domain.RefillStatus, error) {
	var item domain.RefillOrderItem
	err := r.db.WithContext(ctx).
		Where("sarpras_id = ? AND status IN ('waiting_evidence', 'waiting_review')", sarprasID).
		Order("created_at DESC").
		First(&item).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	var dueDate *time.Time
	if item.RefillOrderID != 0 {
		var order domain.RefillOrder
		if err := r.db.Select("due_date").First(&order, item.RefillOrderID).Error; err == nil {
			dueDate = &order.DueDate
		}
	}
	return &domain.RefillStatus{
		IsActive: true,
		Status:   item.Status,
		DueDate:  dueDate,
	}, nil
}

func (r *refillRepo) CreateOrderTx(tx *gorm.DB, order *domain.RefillOrder, items []domain.RefillOrderItem) error {
	if err := tx.Create(order).Error; err != nil {
		return err
	}
	for i := range items {
		items[i].RefillOrderID = order.ID
		items[i].Status = "waiting_evidence"
	}
	return tx.Create(&items).Error
}

func (r *refillRepo) GetItemByID(itemID uint) (*domain.RefillOrderItem, error) {
	var item domain.RefillOrderItem
	if err := r.db.First(&item, itemID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("item refill tidak ditemukan")
		}
		return nil, err
	}
	return &item, nil
}

func (r *refillRepo) GetItemByIDTx(tx *gorm.DB, itemID uint) (*domain.RefillOrderItem, error) {
	var item domain.RefillOrderItem
	if err := tx.First(&item, itemID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("item refill tidak ditemukan")
		}
		return nil, err
	}
	return &item, nil
}

func (r *refillRepo) UpdateItemEvidenceTx(tx *gorm.DB, itemID uint, newDate time.Time, path string, reason string, evidenceBy uint) error {
	now := time.Now()
	result := tx.Model(&domain.RefillOrderItem{}).
		Where("id = ? AND status IN ('waiting_evidence','rejected')", itemID).
		Updates(map[string]interface{}{
			"new_expire_date": newDate,
			"evidence_path":   path,
			"update_reason":   reason,
			"evidence_by":     evidenceBy,
			"evidence_at":     now,
			"status":          "waiting_review",
			"updated_at":      now,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("item tidak ditemukan atau sudah tidak bisa diupdate (status tidak sesuai)")
	}
	return nil
}

func (r *refillRepo) UpdateItemVerificationTx(tx *gorm.DB, itemID uint, status string, reviewerID uint, rejectReason string) error {
	now := time.Now()
	updates := map[string]interface{}{
		"status":      status,
		"reviewed_by": reviewerID,
		"reviewed_at": now,
		"updated_at":  now,
	}
	if status == "rejected" {
		updates["reject_reason"] = rejectReason
	} else {
		updates["reject_reason"] = nil
	}

	result := tx.Model(&domain.RefillOrderItem{}).
		Where("id = ? AND status = 'waiting_review'", itemID).
		Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("item tidak ditemukan atau bukan dalam status waiting_review")
	}
	return nil
}

func (r *refillRepo) GetSarprasByID(sarprasID uint) (*domain.Sarpras, error) {
	var sarpras domain.Sarpras
	if err := r.db.First(&sarpras, sarprasID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("sarpras tidak ditemukan")
		}
		return nil, err
	}
	return &sarpras, nil
}

func (r *refillRepo) GetSarprasByIDTx(tx *gorm.DB, sarprasID uint) (*domain.Sarpras, error) {
	var sarpras domain.Sarpras
	if err := tx.First(&sarpras, sarprasID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("sarpras tidak ditemukan")
		}
		return nil, err
	}
	return &sarpras, nil
}

// UpdateSarprasExpiryTx updates expired_date + status after an approved
// refill. newStatus comes pre-decided from the service layer (ready /
// not_ready / domain.SarprasNeedRepair) so this stays a plain write.
func (r *refillRepo) UpdateSarprasExpiryTx(tx *gorm.DB, sarprasID uint, newExpiry *time.Time, newStatus interface{}) error {
	return tx.Model(&domain.Sarpras{}).
		Where("id = ?", sarprasID).
		Updates(map[string]interface{}{
			"expired_date": newExpiry,
			"status":       newStatus,
			"updated_at":   time.Now(),
		}).Error
}

// HasActiveRepairOrderTx checks whether a sarpras still has an unresolved
// repair order — i.e. a RepairOrder row whose status hasn't reached a final
// state (approved/rejected). Matches domain.RepairOrder in repair.go:
// repair_orders has sarpras_id directly, no separate items table.
func (r *refillRepo) HasActiveRepairOrderTx(tx *gorm.DB, sarprasID uint) (bool, error) {
	var count int64
	err := tx.Model(&domain.RepairOrder{}).
		Where("sarpras_id = ? AND status NOT IN (?, ?)", sarprasID, domain.RepairApproved, domain.RepairRejected).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// MarkSarprasUsedTx marks a sarpras as used: sets expired_date to the given
// date (yesterday, from the service layer) so it immediately falls into
// "expired" status and shows up for refill, and flips status to not_ready.
//
// ASSUMPTION: same as above — Sarpras model fields (expired_date, status)
// are inferred from how they're already used elsewhere in this package.
func (r *refillRepo) MarkSarprasUsedTx(tx *gorm.DB, sarprasIDs []uint, usedDate time.Time) error {
	result := tx.Model(&domain.Sarpras{}).
		Where("id IN ?", sarprasIDs).
		Updates(map[string]interface{}{
			"expired_date": usedDate,
			"status":       "need_repair",
			"updated_at":   time.Now(),
		})
	if result.Error != nil {
		return result.Error
	}
	if int(result.RowsAffected) != len(sarprasIDs) {
		return fmt.Errorf("sebagian sarpras gagal ditandai sebagai used")
	}
	return nil
}

func (r *refillRepo) CreateUsageLogsTx(tx *gorm.DB, logs []domain.SarprasUsageLog) error {
	if len(logs) == 0 {
		return nil
	}
	return tx.Create(&logs).Error
}

func (r *refillRepo) GetUserByID(userID uint) (*domain.User, error) {
	var user domain.User
	if err := r.db.First(&user, userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("user tidak ditemukan")
		}
		return nil, err
	}
	return &user, nil
}

func (r *refillRepo) ValidateSarprasForMarkUsed(sarprasIDs []uint) ([]uint, error) {
	sqlDB, err := r.db.DB()
	if err != nil {
		return nil, err
	}
	rows, err := sqlDB.Query(queryValidateSarprasForMarkUsed, pq.Array(sarprasIDs))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var validIDs []uint
	for rows.Next() {
		var id uint
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		validIDs = append(validIDs, id)
	}
	return validIDs, rows.Err()
}

func (r *refillRepo) GetPendingEvidenceItemsForReminder(daysWindow int) ([]domain.RefillDueItem, error) {
	query := `
		SELECT roi.id, roi.refill_order_id, roi.sarpras_id, s.code, st.name,
		       ro.po_number, ro.due_date, ro.submitted_by
		FROM refill_order_items roi
		JOIN refill_orders ro ON ro.id = roi.refill_order_id
		JOIN sarpras s ON s.id = roi.sarpras_id
		JOIN sarpras_types st ON st.id = s.sarpras_type_id
		WHERE roi.status = 'waiting_evidence'
		  AND ro.due_date <= (NOW()::date + ($1 * INTERVAL '1 day'))
	`
	rows, err := r.rawDB.Query(query, daysWindow)
	if err != nil {
		return nil, fmt.Errorf("pending evidence items query: %w", err)
	}
	defer rows.Close()

	var result []domain.RefillDueItem
	for rows.Next() {
		var it domain.RefillDueItem
		if err := rows.Scan(&it.ItemID, &it.RefillOrderID, &it.SarprasID, &it.SarprasCode,
			&it.SarprasName, &it.PONumber, &it.DueDate, &it.SubmittedBy); err != nil {
			return nil, err
		}
		result = append(result, it)
	}
	return result, rows.Err()
}

func itoa(i int) string {
	if i == 0 {
		return "0"
	}
	buf := make([]byte, 0, 4)
	for i > 0 {
		buf = append([]byte{byte('0' + i%10)}, buf...)
		i /= 10
	}
	return string(buf)
}
