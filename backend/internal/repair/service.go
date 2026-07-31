package repair

import (
	"context"
	"errors"
	"fmt"
	"time"
	"strings"
	"os"

	"emertrack/config"
	"emertrack/internal/audit"
	"emertrack/internal/domain"
	"emertrack/pkg/email"
	"emertrack/pkg/util"
	"emertrack/pkg/ws"

	"gorm.io/gorm"
)

const menuRepair = "Perbaikan Sarpras"
const id = "id = ?"
const unfound_repairoder = "repair order tidak ditemukan: %w"

type repairService struct {
	repairRepo  domain.RepairRepository
	sarprasRepo domain.SarprasRepository
	userRepo    domain.UserRepository
	auditSvc    domain.AuditService
	notifSvc    domain.NotificationService
	mailer      *email.Mailer
	config      *config.Config
	db          *gorm.DB
}

type RepairServiceDeps struct {
	RepairRepo  domain.RepairRepository
	UserRepo    domain.UserRepository
	SarprasRepo domain.SarprasRepository
	AuditSvc    domain.AuditService
	NotifSvc    domain.NotificationService
	Mailer      *email.Mailer
	Config      *config.Config
	DB          *gorm.DB
}

func NewService(deps RepairServiceDeps) domain.RepairService {
	return &repairService{
		repairRepo:  deps.RepairRepo,
		sarprasRepo: deps.SarprasRepo,
		userRepo:    deps.UserRepo,
		auditSvc:    deps.AuditSvc,
		notifSvc:    deps.NotifSvc,
		mailer:      deps.Mailer,
		config:      deps.Config,
		db:          deps.DB,
	}
}

func (s *repairService) ListRepairs(ctx context.Context, filter domain.RepairFilter) ([]domain.RepairRow, int64, error) {
	return s.repairRepo.ListAll(ctx, filter)
}

func (s *repairService) GetRepairDetail(ctx context.Context, repairOrderID uint) (*domain.RepairDetailResponse, error) {
	return s.repairRepo.GetDetail(ctx, repairOrderID)
}

// FillActionPlan creates a new submission (new attempt)
func (s *repairService) FillActionPlan(ctx context.Context, repairOrderID uint, picID uint, actionPlan string, dueDate time.Time) error {
	order, err := s.repairRepo.FindByID(ctx, repairOrderID)
	if err != nil {
		return fmt.Errorf(unfound_repairoder, err)
	}

	if !(order.Status == domain.RepairAssigned || order.Status == domain.RepairRejected) {
		return errors.New("action plan hanya dapat diisi saat status 'assigned' atau 'rejected'")
	}

	maxDueDate := time.Now().Truncate(24*time.Hour).AddDate(0, 3, 0)
	if dueDate.Truncate(24 * time.Hour).After(maxDueDate) {
		return errors.New("due date tidak boleh lebih dari 3 bulan dari sekarang")
	}

	submissions, err := s.repairRepo.GetSubmissionsByRepairOrder(ctx, repairOrderID)
	if err != nil {
		return err
	}
	nextAttempt := 1
	if len(submissions) > 0 {
		nextAttempt = submissions[len(submissions)-1].Attempt + 1
	}

	tx := s.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	sub := &domain.RepairSubmission{
		RepairOrderID: repairOrderID,
		Attempt:       nextAttempt,
		ActionPlan:    actionPlan,
		DueDate:       &dueDate,
		Status:        "draft",
	}
	if err := tx.Create(sub).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("gagal membuat submission: %w", err)
	}

	if err := tx.Model(&domain.RepairOrder{}).Where(id, repairOrderID).Updates(map[string]interface{}{
		"status":               domain.RepairInProgress,
		"active_submission_id": sub.ID,
	}).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("gagal update repair order: %w", err)
	}

	if err := tx.Model(&domain.Sarpras{}).Where(id, order.SarprasID).
		Update("status", domain.SarprasWillBeRepaired).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("gagal update status sarpras: %w", err)
	}

	scheduleID := getScheduleIDByRepairOrder(tx, repairOrderID)
	if err := util.UpdateScheduleSnapshot(tx, scheduleID, string(domain.SarprasWillBeRepaired)); err != nil {
		tx.Rollback()
		return fmt.Errorf("Gagal update snapshot: %w", err)
	}

	desc := fmt.Sprintf(
		"Action plan untuk perbaikan sarpras : %s dibuat. Rencana: %s. Batas perbaikan: %s",
		order.Sarpras.Code, actionPlan, dueDate.Format("02-01-2006"),
	)
	if err := audit.Record(tx, picID, "FILL_ACTION_PLAN", menuRepair, desc, repairOrderID, nil); err != nil {
		tx.Rollback()
		return fmt.Errorf("gagal mencatat audit log: %w", err)
	}

	if err := tx.Commit().Error; err != nil {
		return err
	}

	go ws.BroadcastRepairUpdated()

	return nil
}

func (s *repairService) SubmitEvidence(ctx context.Context, repairOrderID uint, picID uint, filePaths []string, notes string) error {
	if err := s.validateSubmitEvidenceRequest(filePaths); err != nil {
		return err
	}

	order, sarpras, pic, activeSub, err := s.fetchSubmitEvidenceData(ctx, repairOrderID, picID)
	if err != nil {
		return err
	}

	if err := s.executeSubmitEvidenceTx(ctx, repairOrderID, picID, filePaths, activeSub.ID, sarpras.ID, order.Sarpras.Code); err != nil {
		return err
	}

	go func() {
		s.sendSubmitEvidenceNotifications(
			context.Background(),
			repairOrderID,
			sarpras.Code,
			sarpras.SarprasType.Name,
			pic.Name,
			notes,
			picID,
		)
	}()

	return nil
}

// validateSubmitEvidenceRequest checks that at least one file is provided.
func (s *repairService) validateSubmitEvidenceRequest(filePaths []string) error {
	if len(filePaths) == 0 {
		return errors.New("minimal satu file bukti perbaikan wajib diunggah")
	}
	return nil
}

// fetchSubmitEvidenceData retrieves order, sarpras, pic, and active submission.
func (s *repairService) fetchSubmitEvidenceData(ctx context.Context, repairOrderID, picID uint) (*domain.RepairOrder, *domain.Sarpras, *domain.User, *domain.RepairSubmission, error) {
	order, err := s.repairRepo.FindByID(ctx, repairOrderID)
	if err != nil {
		return nil, nil, nil, nil, fmt.Errorf("repair order tidak ditemukan: %w", err)
	}

	if order.Status != domain.RepairInProgress && order.Status != domain.RepairRejected {
		return nil, nil, nil, nil, errors.New("bukti hanya dapat diunggah saat status 'in_progress' atau 'rejected'")
	}

	sarpras, err := s.sarprasRepo.FindByID(ctx, order.SarprasID)
	if err != nil {
		return nil, nil, nil, nil, fmt.Errorf("sarpras tidak ditemukan: %w", err)
	}

	pic, err := s.userRepo.FindByID(ctx, picID)
	if err != nil {
		return nil, nil, nil, nil, fmt.Errorf("PIC tidak ditemukan: %w", err)
	}

	activeSub, err := s.repairRepo.GetActiveSubmission(ctx, repairOrderID)
	if err != nil || activeSub == nil {
		return nil, nil, nil, nil, errors.New("tidak ada submission aktif, isi action plan terlebih dahulu")
	}

	return order, sarpras, pic, activeSub, nil
}

// executeSubmitEvidenceTx runs the transaction: save evidence, update status, audit.
func (s *repairService) executeSubmitEvidenceTx(ctx context.Context, repairOrderID, picID uint, filePaths []string, submissionID, sarprasID uint, sarprasCode string) error {
	tx := s.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	if err := s.saveEvidencesInTx(tx, submissionID, picID, filePaths); err != nil {
		tx.Rollback()
		return err
	}

	if err := s.updateStatusesInTx(tx, repairOrderID, submissionID, sarprasID); err != nil {
		tx.Rollback()
		return err
	}

	scheduleID := getScheduleIDByRepairOrder(tx, repairOrderID)
	if err := util.UpdateScheduleSnapshot(tx, scheduleID, string(domain.SarprasWaitingVerification)); err != nil {
		tx.Rollback()
		return fmt.Errorf("gagal update snapshot: %w", err)
	}

	desc := fmt.Sprintf(
		"Bukti perbaikan diunggah untuk perbaikan sarpras %s. Menunggu verifikasi oleh Quality System.",
		sarprasCode,
	)
	if err := audit.Record(tx, picID, "SUBMIT_EVIDENCE", menuRepair, desc, repairOrderID, nil); err != nil {
		tx.Rollback()
		return fmt.Errorf("gagal mencatat audit log: %w", err)
	}

	if err := tx.Commit().Error; err != nil {
		return err
	}
	return nil
}

// saveEvidencesInTx persists all evidence files in a transaction.
func (s *repairService) saveEvidencesInTx(tx *gorm.DB, submissionID, picID uint, filePaths []string) error {
	for _, path := range filePaths {
		ev := &domain.RepairEvidence{
			SubmissionID: submissionID,
			FilePath:     path,
			UploadedBy:   &picID,
			UploadedAt:   time.Now(),
		}
		if err := tx.Create(ev).Error; err != nil {
			return fmt.Errorf("gagal menyimpan bukti: %w", err)
		}
	}
	return nil
}

func (s *repairService) updateStatusesInTx(tx *gorm.DB, repairOrderID, submissionID, sarprasID uint) error {
	if err := tx.Model(&domain.RepairOrder{}).Where(id, repairOrderID).
		Update("status", domain.RepairSubmitted).Error; err != nil {
		return fmt.Errorf("gagal update repair order status: %w", err)
	}

	if err := tx.Model(&domain.RepairSubmission{}).Where(id, submissionID).
		Update("status", "submitted").Error; err != nil {
		return fmt.Errorf("gagal update submission status: %w", err)
	}

	if err := tx.Model(&domain.Sarpras{}).Where(id, sarprasID).
		Update("status", domain.SarprasWaitingVerification).Error; err != nil {
		return fmt.Errorf("gagal update sarpras status: %w", err)
	}

	return nil
}

// sendSubmitEvidenceNotifications sends async notifications to reviewer and PIC.
func (s *repairService) sendSubmitEvidenceNotifications(ctx context.Context, repairOrderID uint, sarprasCode, sarprasName, picName, notes string, picID uint) {
	errNotif := s.notifSvc.NotifyReviewer(ctx, repairOrderID, sarprasCode, sarprasName, picName, notes)
	if errNotif != nil {
		fmt.Printf("Gagal mengirim notifikasi ke reviewer: %v\n", errNotif)
	}

	ws.BroadcastRepairUpdated()
	ws.BroadcastReviewUpdated()
}

// SendRepairReminders sends daily reminders to PIC about:
// - missing action plan (daily until submission exists)
// - upcoming due dates H-7, H-3, H-2, H-1, H-0
// - overdue without evidence (daily until evidence uploaded)
func (s *repairService) SendRepairReminders(ctx context.Context) error {
	rows, err := s.repairRepo.GetRepairReminders(ctx)
	if err != nil {
		return err
	}
	today := time.Now().Truncate(24 * time.Hour)
	for _, row := range rows {
		if !row.SubmissionID.Valid {
			s.sendReminderActionPlanMissing(ctx, row)
			continue
		}
		if row.DueDate.Valid {
			daysDiff := int(row.DueDate.Time.Truncate(24*time.Hour).Sub(today).Hours() / 24)
			switch {
			case daysDiff == 7 || daysDiff == 3 || daysDiff == 2 || daysDiff == 1 || daysDiff == 0:
				s.sendReminderDueDate(ctx, row, daysDiff)
				continue
			case daysDiff < 0 && row.EvidenceCount == 0:
				s.sendReminderOverdue(ctx, row)
				continue
			}
		}
	}
	return nil
}

func (s *repairService) sendReminderActionPlanMissing(ctx context.Context, row domain.RepairReminderRow) {
	note := "Reminder: Mohon isi action plan perbaikan untuk sarpras ini agar bisa mengunggah bukti perbaikan."

	if err := s.notifSvc.NotifyRepairPIC(
		ctx,
		row.RepairID,
		row.SarprasCode,
		row.SarprasName,
		row.PicID,
		note,
	); err != nil {
		fmt.Printf("Gagal kirim reminder action plan ke PIC : %d (%v)\n", row.PicID, err)
		return
	}

	pic, err := s.userRepo.FindByID(ctx, row.PicID)
	if err != nil || pic == nil {
		return
	}

	baseURL := strings.TrimRight(os.Getenv("FRONTEND_BASE_URL"), "/")
	frontendURL := fmt.Sprintf("%s/dashboard/repair", baseURL)

	htmlBody := fmt.Sprintf(
		RepairReminderActionPlan,
		row.SarprasName,
		row.SarprasCode,
		frontendURL,
	)

	go s.mailer.SendHTML(
		pic.Email,
		fmt.Sprintf("Reminder Action Plan Perbaikan: %s", row.SarprasCode),
		htmlBody,
	)
}

func (s *repairService) sendReminderDueDate(ctx context.Context, row domain.RepairReminderRow, daysDiff int) {
	note := fmt.Sprintf(
		"Reminder: Batas perbaikan %s untuk sarpras %s tinggal H-%d.",
		row.DueDate.Time.Format("02-01-2006"),
		row.SarprasCode,
		daysDiff,
	)

	if err := s.notifSvc.NotifyRepairPIC(
		ctx,
		row.RepairID,
		row.SarprasCode,
		row.SarprasName,
		row.PicID,
		note,
	); err != nil {
		fmt.Printf("Gagal kirim reminder due date ke PIC %d: %v\n", row.PicID, err)
		return
	}

	pic, err := s.userRepo.FindByID(ctx, row.PicID)
	if err != nil || pic == nil {
		return
	}

	var reminderText string

	if daysDiff == 0 {
		reminderText = fmt.Sprintf(
			"Hari ini merupakan batas akhir penyelesaian perbaikan untuk sarpras <strong>%s</strong>. Mohon segera menyelesaikan pekerjaan dan mengunggah bukti perbaikan.",
			row.SarprasCode,
		)
	} else {
		reminderText = fmt.Sprintf(
			"Batas waktu perbaikan untuk sarpras <strong>%s</strong> akan berakhir dalam <strong>H-%d</strong>. Mohon pastikan proses perbaikan selesai sebelum melewati batas waktu.",
			row.SarprasCode,
			daysDiff,
		)
	}

	baseURL := strings.TrimRight(os.Getenv("FRONTEND_BASE_URL"), "/")
	frontendURL := fmt.Sprintf("%s/dashboard/repair", baseURL)

	htmlBody := fmt.Sprintf(
		RepairReminder,
		reminderText,
		row.SarprasName,
		row.SarprasCode,
		row.DueDate.Time.Format("02 January 2006"),
		frontendURL,
	)

	go s.mailer.SendHTML(
		pic.Email,
		fmt.Sprintf("Reminder Batas Perbaikan: %s", row.SarprasCode),
		htmlBody,
	)
}

func (s *repairService) sendReminderOverdue(ctx context.Context, row domain.RepairReminderRow) {
	note := fmt.Sprintf(
		"PERINGATAN: Perbaikan untuk sarpras %s (%s) telah melewati batas (%s) dan belum ada bukti.",
		row.SarprasName,
		row.SarprasCode,
		row.DueDate.Time.Format("02-01-2006"),
	)

	if err := s.notifSvc.NotifyRepairPIC(
		ctx,
		row.RepairID,
		row.SarprasCode,
		row.SarprasName,
		row.PicID,
		note,
	); err != nil {
		fmt.Printf("gagal kirim overdue reminder ke PIC %d: %v\n", row.PicID, err)
		return
	}

	pic, err := s.userRepo.FindByID(ctx, row.PicID)
	if err != nil || pic == nil {
		return
	}

	baseURL := strings.TrimRight(os.Getenv("FRONTEND_BASE_URL"), "/")
	frontendURL := fmt.Sprintf("%s/dashboard/repair", baseURL)

	htmlBody := fmt.Sprintf(
		RepairReminderOverdue,
		row.SarprasName,
		row.SarprasCode,
		row.DueDate.Time.Format("02 January 2006"),
		frontendURL,
	)

	go s.mailer.SendHTML(
		pic.Email,
		fmt.Sprintf("PERINGATAN Perbaikan Overdue: %s", row.SarprasCode),
		htmlBody,
	)
}

func (s *repairService) sendEmail(ctx context.Context, picID uint, subject, note, closing string) {
	pic, _ := s.userRepo.FindByID(ctx, picID)
	if pic == nil {
		return
	}

	repairURL := fmt.Sprintf("%s/dashboard/repair/%d", s.config.App.FrontendBaseURL, picID)

	body := fmt.Sprintf(`
        Halo %s,<br><br>
        %s<br><br>
        %s<br><br>
        <a href="%s" style="
            display: inline-block;
            padding: 10px 20px;
            background-color: #E53E3E;
            color: #ffffff;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
        ">Buka Halaman Repair</a>
    `, pic.Name, note, closing, repairURL)

	go func(email string) {
		_ = s.mailer.SendHTML(email, subject, body)
	}(pic.Email)
}

func (s *repairService) NotifyPICAboutReviewResult(ctx context.Context, repairOrderID uint, picID uint, status domain.RepairStatus, reviewerFeedback string) error {
	pic, err := s.userRepo.FindByID(ctx, picID)
	if err != nil {
		return fmt.Errorf("PIC tidak ditemukan: %w", err)
	}
	order, err := s.repairRepo.FindByID(ctx, repairOrderID)
	if err != nil {
		return fmt.Errorf(unfound_repairoder, err)
	}
	sarpras, err := s.sarprasRepo.FindByID(ctx, order.SarprasID)
	if err != nil {
		return fmt.Errorf("sarpras tidak ditemukan: %w", err)
	}
	var message string
	if status == domain.RepairApproved {
		message = fmt.Sprintf("Perbaikan untuk %s (%s) telah DISETUJUI.", sarpras.SarprasType.Name, sarpras.Code)
	} else {
		message = fmt.Sprintf("Perbaikan untuk %s (%s) telah DITOLAK. Catatan: %s", sarpras.SarprasType.Name, sarpras.Code, reviewerFeedback)
	}
	notif := &domain.Notification{
		UserID:      pic.ID,
		Type:        "REPAIR_REVIEW_RESULT",
		Message:     message,
		ReferenceID: &repairOrderID,
	}
	if err := s.db.WithContext(ctx).Create(notif).Error; err != nil {
		fmt.Printf("⚠️ Gagal menyimpan notifikasi untuk PIC: %v\n", err)
	}
	go func() {
		subject := fmt.Sprintf("Hasil Review Perbaikan - %s", sarpras.Code)
		body := fmt.Sprintf("Halo %s,\n\nPerbaikan untuk sarpras %s (%s) telah diverifikasi oleh QS dengan status: %s.\n", pic.Name, sarpras.SarprasType.Name, sarpras.Code, status)
		if status == domain.RepairRejected {
			body += fmt.Sprintf("Catatan reviewer: %s\n", reviewerFeedback)
			body += "Silakan perbaiki dan upload ulang bukti perbaikan."
		} else {
			body += "Perbaikan telah disetujui. Terima kasih."
		}
		_ = s.mailer.Send(pic.Email, subject, body)
	}()
	go ws.BroadcastRepairUpdated()
	return nil
}

func (s *repairService) ListPICHistory(ctx context.Context, picID uint, filter domain.RepairHistoryFilter) ([]domain.RepairRow, int64, error) {
	return s.repairRepo.ListPICHistory(ctx, picID, filter)
}

func (s *repairService) ListMonitoring(ctx context.Context, filter domain.RepairMonitoringFilter) ([]domain.RepairMonitoringRow, int64, error) {
	return s.repairRepo.ListMonitoring(ctx, filter)
}

func (s *repairService) ListAllHistory(ctx context.Context, filter domain.RepairAllHistoryFilter) ([]domain.RepairMonitoringRow, int64, error) {
	return s.repairRepo.ListAllHistory(ctx, filter)
}

func getScheduleIDByRepairOrder(tx *gorm.DB, repairOrderID uint) *uint {
	var scheduleID *uint
	tx.Table("inspections i").
		Select("i.schedule_id").
		Joins("JOIN repair_orders ro ON ro.inspection_id = i.id").
		Where("ro.id = ?", repairOrderID).
		Scan(&scheduleID)
	return scheduleID
}
