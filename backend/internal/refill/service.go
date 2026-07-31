package refill

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"emertrack/internal/audit"
	"emertrack/internal/domain"

	"emertrack/pkg/email"
	"emertrack/pkg/ws"

	"gorm.io/gorm"
)

const fail_start_transaction = "gagal memulai transaksi: %w"
const fail_audit_log = "gagal mencatat audit log: %w"
const fail_commit_transaction = "gagal commit transaksi: %w"

const expiryReminderWindowDays = 60
const verificationReminderThresholdDays = 3

type refillService struct {
	repo     domain.RefillRepository
	db       *gorm.DB
	auditSvc domain.AuditService
	mailer   *email.Mailer
	notifSvc domain.NotificationService
}

func NewRefillService(
	repo domain.RefillRepository,
	db *gorm.DB,
	auditSvc domain.AuditService,
	mailer *email.Mailer,
	notifSvcSvc domain.NotificationService) domain.RefillService {
	return &refillService{
		repo:     repo,
		db:       db,
		auditSvc: auditSvc,
		mailer:   mailer,
		notifSvc: notifSvcSvc}
}

func (s *refillService) ListApar(params domain.GetAparListParams) ([]domain.AparListRow, int, int, int, error) {
	return s.repo.GetAparList(params)
}

func (s *refillService) GetAparDetail(sarprasID uint) (*domain.AparListRow, error) {
	row, err := s.repo.GetAparDetail(sarprasID)
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, errors.New("sarpras tidak ditemukan")
	}
	return row, nil
}

func (s *refillService) ValidateApar(sarprasIDs []uint) ([]uint, error) {
	return s.repo.ValidateSarprasForRefill(sarprasIDs)
}

func (s *refillService) SubmitPO(req domain.SubmitPORequest, submittedBy uint) error {
	if strings.TrimSpace(req.PONumber) == "" {
		return errors.New("po_number wajib diisi")
	}
	if len(req.SarprasIDs) == 0 {
		return errors.New("minimal 1 sarpras harus dipilih")
	}

	validIDs, err := s.repo.ValidateSarprasForRefill(req.SarprasIDs)
	if err != nil {
		return err
	}
	if len(validIDs) == 0 {
		return errors.New("tidak ada APAR/APAB yang memenuhi syarat (expired dalam 30 hari atau sudah dalam proses refill)")
	}
	if len(validIDs) != len(req.SarprasIDs) {
		return fmt.Errorf("beberapa APAR tidak memenuhi syarat: %v", diffIDs(req.SarprasIDs, validIDs))
	}
	if req.DueDate.Before(time.Now().Truncate(24 * time.Hour)) {
		return errors.New("Due Date tidak boleh kurang dari hari ini")
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return fmt.Errorf(fail_start_transaction, tx.Error)
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			panic(r)
		}
	}()

	order := &domain.RefillOrder{
		PONumber:    req.PONumber,
		DueDate:     req.DueDate,
		SubmittedBy: submittedBy,
	}
	items := make([]domain.RefillOrderItem, 0, len(validIDs))
	for _, sid := range validIDs {
		items = append(items, domain.RefillOrderItem{SarprasID: sid})
	}

	if err := s.repo.CreateOrderTx(tx, order, items); err != nil {
		tx.Rollback()
		return err
	}

	desc := fmt.Sprintf("Submit PO untuk %d APAR (due date: %s)", len(validIDs), req.DueDate.Format("2006-01-02"))
	if err := audit.Record(tx, submittedBy, "SUBMIT_PO", "refill", desc, order.ID, nil); err != nil {
		tx.Rollback()
		return fmt.Errorf(fail_audit_log, err)
	}

	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf(fail_commit_transaction, err)
	}

	go ws.BroadcastRefillUpdated()

	return nil
}

func (s *refillService) SubmitEvidence(req domain.SubmitEvidenceRequest, evidenceBy uint) error {
	if err := s.validateEvidenceRequest(req); err != nil {
		return err
	}

	item, err := s.executeEvidenceTransaction(req, evidenceBy)
	if err != nil {
		return err
	}

	go s.sendEvidenceNotifications(req, item, evidenceBy)

	return nil
}

func (s *refillService) validateEvidenceRequest(req domain.SubmitEvidenceRequest) error {
	if len(req.EvidencePath) == 0 {
		return errors.New("minimal satu file bukti wajib diunggah")
	}
	return nil
}

func (s *refillService) executeEvidenceTransaction(req domain.SubmitEvidenceRequest, evidenceBy uint) (*domain.RefillOrderItem, error) {
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, fmt.Errorf(fail_start_transaction, tx.Error)
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			panic(r)
		}
	}()

	item, err := s.repo.GetItemByIDTx(tx, req.ItemID)
	if err != nil {
		tx.Rollback()
		return nil, err
	}

	pathJSON, err := json.Marshal(req.EvidencePath)
	if err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("gagal memproses path file bukti: %w", err)
	}

	if err := s.repo.UpdateItemEvidenceTx(tx, req.ItemID, req.NewExpireDate, string(pathJSON), req.UpdateReason, evidenceBy); err != nil {
		tx.Rollback()
		return nil, err
	}

	sarpras, err := s.repo.GetSarprasByIDTx(tx, item.SarprasID)
	if err != nil {
		tx.Rollback()
		return nil, err
	}

	desc := fmt.Sprintf("Bukti refill diunggah untuk Sarpras (%s). New expire date: %s, Catatan: %s",
		sarpras.Code, req.NewExpireDate.Format("2006-01-02"), req.UpdateReason)
	if err := audit.Record(tx, evidenceBy, "SUBMIT_EVIDENCE", "refill", desc, req.ItemID, nil); err != nil {
		tx.Rollback()
		return nil, fmt.Errorf(fail_audit_log, err)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf(fail_commit_transaction, err)
	}

	return item, nil
}

func (s *refillService) sendEvidenceNotifications(req domain.SubmitEvidenceRequest, item *domain.RefillOrderItem, evidenceBy uint) {
	ws.BroadcastRefillUpdated()

	sarpras, err := s.repo.GetSarprasByID(item.SarprasID)
	if err != nil {
		fmt.Printf("[refill] gagal memuat sarpras untuk notifikasi: %v\n", err)
		return
	}

	uploaderName := "Tim GA"
	if uploader, err := s.repo.GetUserByID(evidenceBy); err == nil && uploader != nil {
		uploaderName = uploader.Name
	}

	err = s.notifSvc.NotifyRefillEvidenceSubmitted(
		context.Background(),
		req.ItemID,
		sarpras.Code,
		sarpras.SarprasType.Name,
		uploaderName,
		req.NewExpireDate.Format("2006-01-02"),
		req.UpdateReason,
	)
	if err != nil {
		fmt.Printf("[refill] gagal mengirim notifikasi evidence: %v\n", err)
	}
}

func (s *refillService) MarkAsUsed(req domain.MarkAsUsedRequest, markedBy uint) error {
	if strings.TrimSpace(req.Reason) == "" {
		return errors.New("keterangan penggunaan (reason) wajib diisi")
	}
	if len(req.SarprasIDs) == 0 {
		return errors.New("minimal 1 sarpras harus dipilih")
	}

	validIDs, err := s.repo.ValidateSarprasForMarkUsed(req.SarprasIDs)
	if err != nil {
		return err
	}
	if len(validIDs) == 0 {
		return errors.New("tidak ada APAR/APAB yang dapat ditandai — pastikan tidak sedang dalam proses refill aktif")
	}
	if len(validIDs) != len(req.SarprasIDs) {
		return fmt.Errorf("beberapa sarpras tidak memenuhi syarat: %v", diffIDs(req.SarprasIDs, validIDs))
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return fmt.Errorf(fail_start_transaction, tx.Error)
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			panic(r)
		}
	}()

	yesterday := time.Now().AddDate(0, 0, -1).Truncate(24 * time.Hour)

	if err := s.repo.MarkSarprasUsedTx(tx, validIDs, yesterday); err != nil {
		tx.Rollback()
		return fmt.Errorf("gagal update status sarpras: %w", err)
	}

	now := time.Now()
	logs := make([]domain.SarprasUsageLog, 0, len(validIDs))
	for _, sid := range validIDs {
		logs = append(logs, domain.SarprasUsageLog{
			SarprasID: sid,
			Reason:    req.Reason,
			MarkedBy:  markedBy,
			MarkedAt:  now,
		})
	}
	if err := s.repo.CreateUsageLogsTx(tx, logs); err != nil {
		tx.Rollback()
		return fmt.Errorf("gagal menyimpan usage log: %w", err)
	}

	desc := fmt.Sprintf("Menandai %d APAR/APAB sebagai telah digunakan. Keterangan: %s", len(validIDs), req.Reason)
	if err := audit.Record(tx, markedBy, "MARK_USED", "refill", desc, 0, nil); err != nil {
		tx.Rollback()
		return fmt.Errorf(fail_audit_log, err)
	}

	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf(fail_commit_transaction, err)
	}

	go func() {
		ws.BroadcastRefillUpdated()
		_ = s.notifSvc.NotifyAPARMarksUsed(context.Background(), validIDs, markedBy, req.Reason)
	}()
	return nil
}

func (s *refillService) GetVerifyDetail(itemID uint) (*domain.VerifyDetailResponse, error) {
	return s.repo.GetVerifyDetail(itemID)
}

func (s *refillService) VerifyItem(req domain.VerifyRefillRequest, reviewerID uint) error {
	if err := s.validateVerifyRequest(req); err != nil {
		return err
	}

	item, err := s.executeVerifyTransaction(req, reviewerID)
	if err != nil {
		return err
	}

	go s.sendVerificationNotifications(req, item, reviewerID)

	return nil
}

func (s *refillService) validateVerifyRequest(req domain.VerifyRefillRequest) error {
	if req.Status == "rejected" && strings.TrimSpace(req.RejectReason) == "" {
		return errors.New("alasan reject wajib diisi")
	}
	return nil
}

func (s *refillService) executeVerifyTransaction(req domain.VerifyRefillRequest, reviewerID uint) (*domain.RefillOrderItem, error) {
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, fmt.Errorf(fail_start_transaction, tx.Error)
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			panic(r)
		}
	}()

	item, err := s.repo.GetItemByIDTx(tx, req.ItemID)
	if err != nil {
		tx.Rollback()
		return nil, err
	}
	if item.SarprasID != req.SarprasID {
		tx.Rollback()
		return nil, fmt.Errorf("item %d tidak terdaftar untuk sarpras %d", req.ItemID, req.SarprasID)
	}
	if item.Status != "waiting_review" {
		tx.Rollback()
		return nil, fmt.Errorf("item dengan status %s tidak dapat diverifikasi", item.Status)
	}

	sarpras, err := s.repo.GetSarprasByIDTx(tx, req.SarprasID)
	if err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := s.repo.UpdateItemVerificationTx(tx, req.ItemID, req.Status, reviewerID, req.RejectReason); err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("gagal update item: %w", err)
	}
	if req.Status == "rejected" {
		item.Status = req.Status
		item.RejectReason = &req.RejectReason
	} else {
		item.Status = req.Status
	}

	if req.Status == "approved" && item.NewExpireDate != nil {
		if err := s.applyApprovedExpiry(tx, req.SarprasID, item.NewExpireDate, sarpras); err != nil {
			tx.Rollback()
			return nil, err
		}
	}

	if err := s.auditVerifyTransaction(tx, req, reviewerID, sarpras.Code); err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf(fail_commit_transaction, err)
	}

	if reloaded, err := s.repo.GetItemByID(req.ItemID); err == nil {
		item = reloaded
	} else {
		fmt.Printf("[refill] warning: failed to reload item after commit: %v\n", err)
	}
	return item, nil
}

func (s *refillService) applyApprovedExpiry(tx *gorm.DB, sarprasID uint, newExpiry *time.Time, sarpras *domain.Sarpras) error {
	now := time.Now()

	hasActiveRepair, err := s.repo.HasActiveRepairOrderTx(tx, sarprasID)
	if err != nil {
		return fmt.Errorf("gagal cek status perbaikan aktif: %w", err)
	}

	var newStatus interface{}
	switch {
	case hasActiveRepair:
		newStatus = domain.SarprasNeedRepair
	case sarpras.LastInspected != nil && (sarpras.DueDate == nil || !sarpras.DueDate.Before(now)):
		newStatus = "ready"
	default:
		newStatus = "not_ready"
	}

	if err := s.repo.UpdateSarprasExpiryTx(tx, sarprasID, newExpiry, newStatus); err != nil {
		return fmt.Errorf("gagal update sarpras: %w", err)
	}
	return nil
}

func (s *refillService) auditVerifyTransaction(tx *gorm.DB, req domain.VerifyRefillRequest, reviewerID uint, sarprasCode string) error {
	verifyAction := s.verifyAction(req.Status)
	desc := fmt.Sprintf("Verifikasi refill Sarpras (%s) dengan status %s", sarprasCode, verifyAction)
	if req.Status == "rejected" {
		desc += fmt.Sprintf(" (alasan: %s)", req.RejectReason)
	}
	if err := audit.Record(tx, reviewerID, "VERIFY_REFILL", "refill", desc, req.ItemID, nil); err != nil {
		return fmt.Errorf("gagal catat audit: %w", err)
	}
	return nil
}

func (s *refillService) verifyAction(action string) string {
	switch strings.ToLower(action) {
	case "approved":
		return "Disetujui"
	case "rejected":
		return "Ditolak"
	default:
		return action
	}
}

func (s *refillService) sendVerificationNotifications(req domain.VerifyRefillRequest, item *domain.RefillOrderItem, reviewerID uint) {
	ws.BroadcastRefillUpdated()

	if item.EvidenceBy == nil {
		return
	}

	sarpras, err := s.repo.GetSarprasByID(item.SarprasID)
	if err != nil {
		fmt.Printf("[refill] failed to load sarpras for notification: %v\n", err)
		return
	}
	user, err := s.repo.GetUserByID(*item.EvidenceBy)
	if err != nil {
		fmt.Printf("[refill] failed to load user email: %v\n", err)
		return
	}

	_ = s.notifSvc.NotifyRefillReviewResult(context.Background(), req.ItemID, *item.EvidenceBy, req.Status, req.RejectReason, sarpras.Code)

	subject := fmt.Sprintf("Hasil Verifikasi Refill APAR - %s", strings.ToUpper(req.Status))
	body := fmt.Sprintf(
		"Bukti refill untuk sarpras ID %d (item %d) telah diverifikasi.\n\nStatus: %s\n",
		req.SarprasID, req.ItemID, strings.ToUpper(req.Status),
	)
	if req.Status == "rejected" {
		body += fmt.Sprintf("Alasan penolakan: %s\n\n", req.RejectReason)
		body += "Silakan perbaiki dan upload ulang bukti."
	} else {
		body += "Tanggal expired APAR telah diperbarui. Terima kasih."
	}
	if err := s.mailer.Send(user.Email, subject, body); err != nil {
		fmt.Printf("[refill-email] Gagal kirim ke %s: %v\n", user.Email, err)
	}
}

func (s *refillService) SendExpiryReminders() error {
	aparList, err := s.repo.GetAparsExpiringOrExpired(expiryReminderWindowDays)
	if err != nil {
		return err
	}

	today := time.Now().Truncate(24 * time.Hour)
	for _, a := range aparList {
		daysDiff := int(a.ExpiredDate.Truncate(24 * time.Hour).Sub(today).Hours() / 24)
		if !(daysDiff == 60 || daysDiff == 30 || daysDiff == 3 || daysDiff == 2 || daysDiff == 1 || daysDiff == 0 || daysDiff < 0) {
			continue
		}
		isExpired := daysDiff < 0 || daysDiff == 0
		if err := s.notifSvc.NotifyAparExpiryStatus(context.Background(), a.SarprasID, a.SarprasNo, a.ExpiredDate, isExpired); err != nil {
			fmt.Printf("[reminder] gagal notifikasi GA untuk sarpras %s: %v\n", a.SarprasNo, err)
		}
	}

	return nil
}

func (s *refillService) SendPOReminders() error {
	const refillPOReminderWindowDays = 7
	items, err := s.repo.GetPendingEvidenceItemsForReminder(refillPOReminderWindowDays)
	if err != nil {
		return err
	}

	today := time.Now().Truncate(24 * time.Hour)
	for _, it := range items {
		daysDiff := int(it.DueDate.Truncate(24*time.Hour).Sub(today).Hours() / 24)

		if !(daysDiff == 3 || daysDiff == 1 || daysDiff == 0 || daysDiff < 0) {
			continue
		}
		isOverdue := daysDiff < 0

		if err := s.notifSvc.NotifyRefillPODue(
			context.Background(),
			it.ItemID,
			it.SubmittedBy,
			it.SarprasName,
			it.SarprasCode,
			it.PONumber,
			it.DueDate,
			daysDiff,
			isOverdue,
		); err != nil {
			fmt.Printf("[refill-po-reminder] gagal kirim reminder untuk item %d: %v\n", it.ItemID, err)
		}
	}
	return nil
}


// For QS
func (s *refillService) SendVerificationReminders() error {
	pending, err := s.repo.GetRefillPendingVerification(verificationReminderThresholdDays)
	if err != nil {
		return err
	}

	now := time.Now()
	for _, p := range pending {
		daysPending := int(now.Sub(p.EvidenceAt).Hours() / 24)
		if err := s.notifSvc.NotifyPendingRefillVerification(context.Background(), p.ItemID, p.SarprasCode, daysPending); err != nil {
			fmt.Printf("[reminder] gagal notifikasi QS untuk item %d: %v\n", p.ItemID, err)
		}
	}

	return nil
}

func diffIDs(original, valid []uint) []uint {
	validMap := make(map[uint]bool)
	for _, id := range valid {
		validMap[id] = true
	}

	var invalid []uint
	for _, id := range original {
		if !validMap[id] {
			invalid = append(invalid, id)
		}
	}
	return invalid
}
