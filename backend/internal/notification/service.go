package notification

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"emertrack/internal/domain"
	"emertrack/pkg/email"
	"emertrack/pkg/util"
	"emertrack/pkg/ws"
)

type service struct {
	notifRepo domain.NotificationRepository
	userRepo  domain.UserRepository
	mailer    *email.Mailer
}

func NewService(nr domain.NotificationRepository, ur domain.UserRepository, m *email.Mailer) domain.NotificationService {
	return &service{
		notifRepo: nr,
		userRepo:  ur,
		mailer:    m,
	}
}

func (s *service) GetUserNotifications(ctx context.Context, userID uint) ([]domain.Notification, error) {
	return s.notifRepo.FindUserNotifications(ctx, userID)
}

func (s *service) MarkAsRead(ctx context.Context, id uint, userID uint) error {
	return s.notifRepo.MarkAsRead(ctx, id, userID)
}

func (s *service) MarkAllAsRead(ctx context.Context, userID uint) error {
	return s.notifRepo.MarkAllAsRead(ctx, userID)
}

// NotifyApprovers sends notifications to approvers.
func (s *service) NotifyApprovers(ctx context.Context, requesterID uint, entityType, action, identifier, notes string, referenceID uint) error {
	requesterName := s.getRequesterName(ctx, requesterID)

	approvers, err := s.userRepo.GetApprovers(ctx)
	if err != nil {
		return fmt.Errorf("failed to fetch approvers: %w", err)
	}
	if len(approvers) == 0 {
		return nil
	}

	subject := fmt.Sprintf("Approval Required: %s %s", action, entityType)
	displayNotes := notes
	if displayNotes == "" {
		displayNotes = "-"
	}
	baseURL := os.Getenv("FRONTEND_BASE_URL")
	baseURL = strings.TrimRight(baseURL, "/")
	frontendURL := fmt.Sprintf("%s/dashboard/my-task", baseURL)
	htmlBody := s.buildApprovalEmailHTML(subject, requesterName, entityType, action, identifier, displayNotes, frontendURL)
	systemMsg := fmt.Sprintf("Request %s %s (%s) diajukan oleh %s.", util.FormatAction(action), util.FormatEntityType(entityType), identifier, requesterName)

	for _, u := range approvers {
		s.sendApprovalNotificationToUser(ctx, u, referenceID, systemMsg, subject, htmlBody)
	}
	return nil
}

func (s *service) getRequesterName(ctx context.Context, requesterID uint) string {
	if requester, err := s.userRepo.FindByID(ctx, requesterID); err == nil && requester != nil {
		return requester.Name
	}
	return "System"
}

func (s *service) buildApprovalEmailHTML(subject, requesterName, entityType, action, identifier, notes, frontendURL string) string {
	return fmt.Sprintf(NotifyApprovalsToSpvQs, subject, requesterName, entityType, action, identifier, notes, frontendURL)
}

func (s *service) sendApprovalNotificationToUser(ctx context.Context, user domain.User, referenceID uint, systemMsg, subject, htmlBody string) {
	refID := referenceID
	notif := &domain.Notification{
		UserID:      user.ID,
		Type:        "APPROVAL_REQUEST",
		Message:     systemMsg,
		ReferenceID: &refID,
	}
	if err := s.notifRepo.Create(ctx, notif); err != nil {
		log.Printf("Failed to create notification: %v", err)
		return
	}

	if ws.GlobalHub != nil {
		ws.GlobalHub.SendToUser(user.ID, "NEW_NOTIFICATION", map[string]interface{}{
			"id":           notif.ID,
			"type":         notif.Type,
			"message":      notif.Message,
			"reference_id": notif.ReferenceID,
			"is_read":      false,
			"created_at":   notif.CreatedAt,
		})
	} else {
		log.Println("WebSocket hub not initialized, skipping real-time notification for approval")
	}

	if s.mailer == nil {
		log.Printf("Mailer is nil, skipping email to %s", user.Email)
		return
	}
	go func(userEmail string) {
		log.Printf("⏳ Attempting to send HTML email to: %s...", userEmail)
		if err := s.mailer.SendHTML(userEmail, subject, htmlBody); err != nil {
			log.Printf("Failed to send email to %s: %v", userEmail, err)
		} else {
			log.Printf("Successfully sent HTML email to %s!", userEmail)
		}
	}(user.Email)
}

// NotifyApproversForBulk sends notifications for a bulk import.
func (s *service) NotifyApproversForBulk(ctx context.Context, requesterID uint, itemCount int, notes string, referenceID uint) error {
	requesterName := "System"
	if requester, err := s.userRepo.FindByID(ctx, requesterID); err == nil && requester != nil {
		requesterName = requester.Name
	}

	approvers, err := s.userRepo.GetApprovers(ctx)
	if err != nil {
		return fmt.Errorf("failed to fetch approvers: %w", err)
	}
	if len(approvers) == 0 {
		return nil
	}

	subject := fmt.Sprintf("Sarpras Import Approval Required (%d items)", itemCount)
	baseURL := os.Getenv("FRONTEND_BASE_URL")
	baseURL = strings.TrimRight(baseURL, "/")
	frontendURL := fmt.Sprintf("%s/dashboard/my-task", baseURL)
	displayNotes := notes
	if displayNotes == "" {
		displayNotes = "-"
	}

	htmlBody := fmt.Sprintf(NotifyApproversForBulkSarpras, requesterName, itemCount, displayNotes, frontendURL)

	systemMsg := fmt.Sprintf("Terdapat Request Tambah Sarpras (Via Excel) oleh %s dan membutuhkan persetujuan.", requesterName)

	for _, u := range approvers {
		refID := referenceID
		notif := &domain.Notification{
			UserID:      u.ID,
			Type:        "BULK_IMPORT_REQUEST",
			Message:     systemMsg,
			ReferenceID: &refID,
		}
		if err := s.notifRepo.Create(ctx, notif); err != nil {
			log.Printf("Failed to create notification for bulk import: %v", err)
			continue
		}

		if ws.GlobalHub != nil {
			ws.GlobalHub.SendToUser(u.ID, "NEW_NOTIFICATION", map[string]interface{}{
				"id":           notif.ID,
				"type":         notif.Type,
				"message":      notif.Message,
				"reference_id": notif.ReferenceID,
				"is_read":      false,
				"created_at":   notif.CreatedAt,
			})
		} else {
			log.Println("WebSocket hub not initialized, skipping real-time notification for bulk import")
		}

		go func(email string) {
			if err := s.mailer.SendHTML(email, subject, htmlBody); err != nil {
				log.Printf("❌ Failed to send bulk import email to %s: %v", email, err)
			}
		}(u.Email)
	}
	return nil
}

func (s *service) NotifyRequesterApprovalResult(ctx context.Context, res domain.ApprovalResultNotif) error {
	requester, err := s.userRepo.FindByID(ctx, res.RequesterID)
	if err != nil {
		return fmt.Errorf("requester not found: %w", err)
	}

	message := s.buildApprovalResultMessage(res)

	notif := &domain.Notification{
		UserID:      requester.ID,
		Type:        "APPROVAL_RESULT",
		Message:     message,
		ReferenceID: &res.ApprovalID,
	}
	if err := s.notifRepo.Create(ctx, notif); err != nil {
		log.Printf("⚠️ Failed to create notification: %v", err)
	}

	s.sendApprovalResultEmail(requester.Email, res.Status, message)

	if ws.GlobalHub != nil {
		ws.GlobalHub.SendToUser(requester.ID, "NEW_NOTIFICATION", map[string]interface{}{
			"id":           notif.ID,
			"type":         notif.Type,
			"message":      notif.Message,
			"reference_id": notif.ReferenceID,
			"is_read":      false,
			"created_at":   notif.CreatedAt,
		})
	} else {
		log.Println("WebSocket hub not initialized, skipping real-time notification for approval result")
	}
	return nil
}

// buildApprovalResultMessage constructs the message based on entity type and status.
func (s *service) buildApprovalResultMessage(res domain.ApprovalResultNotif) string {
	statusLabel := "DISETUJUI"
	if res.Status != "approved" {
		statusLabel = "DITOLAK"
	}

	if res.EntityType == "SarprasBulk" {
		msg := fmt.Sprintf("Pengajuan Tambah Sarpras (Via Excel) telah %s.", statusLabel)
		if res.Status == "rejected" {
			notes := res.ReviewerNotes
			if notes == "" {
				notes = "(Tidak ada catatan)"
			}
			msg += fmt.Sprintf(" Catatan: %s", notes)
		}
		return msg
	}

	if res.Status == "approved" {
		return fmt.Sprintf("Pengajuan %s %s (%s) telah %s.",
			util.FormatAction(res.Action),
			util.FormatEntityType(res.EntityType),
			res.Identifier,
			statusLabel,
		)
	}

	notes := res.ReviewerNotes
	if notes == "" {
		notes = "(Tidak ada catatan)"
	}
	return fmt.Sprintf("Pengajuan %s %s (%s) telah %s. Catatan: %s",
		util.FormatAction(res.Action),
		util.FormatEntityType(res.EntityType),
		res.Identifier,
		statusLabel,
		notes,
	)
}

// sendApprovalResultEmail sends an email notification asynchronously if mailer is configured.
func (s *service) sendApprovalResultEmail(email, status, message string) {
	if s.mailer == nil {
		log.Printf("⚠️ Mailer is nil, skipping email to %s", email)
		return
	}

	statusLabel := "DISETUJUI"
	if status != "approved" {
		statusLabel = "DITOLAK"
	}
	subject := fmt.Sprintf("Hasil Pengajuan - %s", statusLabel)
	body := message + "\n"

	go func() {
		if err := s.mailer.Send(email, subject, body); err != nil {
			log.Printf("Failed to send email to %s: %v", email, err)
		}
	}()
}

// NotifyNewInspection sends notification to checkers when a new inspection schedule is ready.
func (s *service) NotifyNewInspection(ctx context.Context, scheduleID uint, sarprasCode, sarprasName string, deptID, typeID uint) error {
	checkers, err := s.userRepo.FindCheckersByDeptAndType(ctx, deptID, typeID)
	if err != nil {
		return fmt.Errorf("failed to fetch checkers: %w", err)
	}

	if len(checkers) == 0 {
		return nil
	}

	subject := fmt.Sprintf("Jadwal Inspeksi Baru: %s", sarprasCode)
	baseURL := os.Getenv("FRONTEND_BASE_URL")
	baseURL = strings.TrimRight(baseURL, "/")
	frontendURL := fmt.Sprintf("%s/dashboard/inspection", baseURL)

	htmlBody := fmt.Sprintf(NotifyNewInspection, sarprasName, sarprasCode, frontendURL)

	systemMsg := fmt.Sprintf("Tugas pemeriksaan baru: %s (%s) tersedia untuk di-claim.", sarprasName, sarprasCode)

	for _, c := range checkers {
		refID := scheduleID
		notif := &domain.Notification{
			UserID:      c.ID,
			Type:        "NEW_INSPECTION",
			Message:     systemMsg,
			ReferenceID: &refID,
		}

		if err := s.notifRepo.Create(ctx, notif); err != nil {
			log.Printf("⚠️ Failed to create notification for checker %d: %v", c.ID, err)
		}

		if ws.GlobalHub != nil {
			ws.GlobalHub.SendToUser(c.ID, "NEW_NOTIFICATION", map[string]interface{}{
				"id":           notif.ID,
				"type":         notif.Type,
				"message":      notif.Message,
				"reference_id": notif.ReferenceID,
				"is_read":      false,
				"created_at":   notif.CreatedAt,
			})
		} else {
			log.Println("WebSocket hub not initialized, skipping real-time notification for new inspection")
		}

		go func(userEmail string) {
			if err := s.mailer.SendHTML(userEmail, subject, htmlBody); err != nil {
				log.Printf("❌ Failed to send email to %s: %v", userEmail, err)
			}
		}(c.Email)
	}

	return nil
}

// NotifyRepairPIC sends notification to the assigned technician (PIC) for a repair job.
func (s *service) NotifyRepairPIC(ctx context.Context, repairID uint, sarprasCode, sarprasName string, picID uint, notes string) error {
	pic, err := s.userRepo.FindByID(ctx, picID)
	if err != nil || pic == nil {
		return fmt.Errorf("failed to fetch PIC for repair: %w", err)
	}

	subject := fmt.Sprintf("Penugasan Perbaikan: %s", sarprasCode)
	baseURL := os.Getenv("FRONTEND_BASE_URL")
	baseURL = strings.TrimRight(baseURL, "/")
	frontendURL := fmt.Sprintf("%s/dashboard/repair", baseURL)
	displayNotes := notes
	if displayNotes == "" {
		displayNotes = "-"
	}

	htmlBody := fmt.Sprintf(NotifyRepairPIC, sarprasName, sarprasCode, displayNotes, frontendURL)

	systemMsg := fmt.Sprintf("Anda ditugaskan sebagai PIC untuk perbaikan %s (%s).", sarprasName, sarprasCode)

	refID := repairID
	notif := &domain.Notification{
		UserID:      pic.ID,
		Type:        "NEW_REPAIR_ASSIGNMENT",
		Message:     systemMsg,
		ReferenceID: &refID,
	}

	if err := s.notifRepo.Create(ctx, notif); err != nil {
		log.Printf("⚠️ Failed to create notification for PIC %d: %v", pic.ID, err)
	}

	if ws.GlobalHub != nil {
		ws.GlobalHub.SendToUser(pic.ID, "NEW_NOTIFICATION", map[string]interface{}{
			"id":           notif.ID,
			"type":         notif.Type,
			"message":      notif.Message,
			"reference_id": notif.ReferenceID,
			"is_read":      false,
			"created_at":   notif.CreatedAt,
		})
	} else {
		log.Println("WebSocket hub not initialized, skipping real-time notification for repair PIC")
	}

	go func(userEmail string) {
		if err := s.mailer.SendHTML(userEmail, subject, htmlBody); err != nil {
			log.Printf("❌ Failed to send email to PIC %s: %v", userEmail, err)
		}
	}(pic.Email)

	return nil
}

// NotifyReviewer sends notification to QS when a repair is ready for verification.
func (s *service) NotifyReviewer(ctx context.Context, repairOrderID uint, sarprasCode, sarprasName, picName, notes string) error {
	qsUsers, err := s.userRepo.FindByRole(ctx, domain.RoleQS)
	if err != nil {
		return fmt.Errorf("failed to fetch QS users: %w", err)
	}
	if len(qsUsers) == 0 {
		return nil
	}
	subject := fmt.Sprintf("Perbaikan Siap Diverifikasi: %s", sarprasCode)

	baseURL := os.Getenv("FRONTEND_BASE_URL")
	baseURL = strings.TrimRight(baseURL, "/")
	frontendURL := fmt.Sprintf("%s/dashboard/reviews", baseURL)
	displayNotes := notes
	if displayNotes == "" {
		displayNotes = "-"
	}
	htmlBody := fmt.Sprintf(string(NotifyReviewer), sarprasName, sarprasCode, picName, displayNotes, frontendURL)
	systemMsg := fmt.Sprintf("Perbaikan %s (%s) selesai, siap diverifikasi.", sarprasName, sarprasCode)
	for _, qs := range qsUsers {
		refID := repairOrderID
		notif := &domain.Notification{
			UserID:      qs.ID,
			Type:        "REVIEW_READY",
			Message:     systemMsg,
			ReferenceID: &refID,
		}
		if err := s.notifRepo.Create(ctx, notif); err != nil {
			log.Printf("⚠️ Failed to create notification for QS %d: %v", qs.ID, err)
			continue
		}
		if ws.GlobalHub != nil {
			ws.GlobalHub.SendToUser(qs.ID, "NEW_NOTIFICATION", map[string]interface{}{
				"id":           notif.ID,
				"type":         notif.Type,
				"message":      notif.Message,
				"reference_id": notif.ReferenceID,
				"is_read":      false,
				"created_at":   notif.CreatedAt,
			})
		} else {
			log.Println("WebSocket hub not initialized, skipping real-time notification for reviewer")
		}
		go func(email string) {
			if err := s.mailer.SendHTML(email, subject, htmlBody); err != nil {
				log.Printf("❌ Failed to send email to QS %s: %v", email, err)
			}
		}(qs.Email)
	}
	return nil
}

// NotifyRefillEvidenceSubmitted sends notification to QS when refill evidence is submitted.
func (s *service) NotifyRefillEvidenceSubmitted(ctx context.Context, itemID uint, sarprasCode, sarprasName, uploaderName, newExpireDate, notes string) error {
	qsUsers, err := s.userRepo.FindByRole(ctx, domain.RoleQS)
	if err != nil {
		return fmt.Errorf("failed to fetch QS users: %w", err)
	}
	if len(qsUsers) == 0 {
		return nil
	}

	subject := fmt.Sprintf("Bukti Refill Siap Diverifikasi: %s", sarprasCode)
	baseURL := os.Getenv("FRONTEND_BASE_URL")
	baseURL = strings.TrimRight(baseURL, "/")
	frontendURL := fmt.Sprintf("%s/dashboard/refill/verify", baseURL)

	displayNotes := notes
	if displayNotes == "" {
		displayNotes = "-"
	}
	htmlBody := fmt.Sprintf(string(NotifyRefillEvidenceEmail), sarprasName, sarprasCode, uploaderName, newExpireDate, displayNotes, frontendURL)

	systemMsg := fmt.Sprintf("Bukti refill untuk APAR %s telah diunggah, menunggu verifikasi.", sarprasCode)

	for _, qs := range qsUsers {
		refID := itemID
		notif := &domain.Notification{
			UserID:      qs.ID,
			Type:        "REFILL_SUBMITTED",
			Message:     systemMsg,
			ReferenceID: &refID,
		}
		if err := s.notifRepo.Create(ctx, notif); err != nil {
			log.Printf("⚠️ Failed to create notification for QS %d: %v", qs.ID, err)
			continue
		}
		if ws.GlobalHub != nil {
			ws.GlobalHub.SendToUser(qs.ID, "NEW_NOTIFICATION", map[string]interface{}{
				"id":           notif.ID,
				"type":         notif.Type,
				"message":      notif.Message,
				"reference_id": notif.ReferenceID,
				"is_read":      false,
				"created_at":   notif.CreatedAt,
			})
		} else {
			log.Println("WebSocket hub not initialized, skipping real-time notification for refill evidence")
		}

		go func(email string) {
			if err := s.mailer.SendHTML(email, subject, htmlBody); err != nil {
				log.Printf("❌ Failed to send email to QS %s: %v", email, err)
			}
		}(qs.Email)
	}

	return nil
}

// NotifyRefillReviewResult sends notification to GA about refill review result.
func (s *service) NotifyRefillReviewResult(ctx context.Context, itemID uint, gaID uint, status string, rejectReason string, sarprasCode string) error {
	var message string
	if status == "approved" {
		message = fmt.Sprintf("Bukti refill untuk Sarpras (%s) telah DISETUJUI.", sarprasCode)
	} else {
		message = fmt.Sprintf("Bukti refill untuk Sarpras (%s) telah DITOLAK. Alasan: %s", sarprasCode, rejectReason)
	}
	notif := &domain.Notification{
		UserID:      gaID,
		Type:        "REFILL_REVIEW_RESULT",
		Message:     message,
		ReferenceID: &itemID,
	}
	if err := s.notifRepo.Create(ctx, notif); err != nil {
		return fmt.Errorf("failed to create notification: %w", err)
	}
	if ws.GlobalHub != nil {
		ws.GlobalHub.SendToUser(gaID, "NEW_NOTIFICATION", map[string]interface{}{
			"id":           notif.ID,
			"type":         notif.Type,
			"message":      notif.Message,
			"reference_id": notif.ReferenceID,
			"is_read":      false,
			"created_at":   notif.CreatedAt,
		})
	} else {
		log.Println("WebSocket hub not initialized, skipping real-time notification for refill review result")
	}
	return nil
}

// NotifyAPARMarksUsed sends notification to GA when APAR/APAB units are marked as used.
func (s *service) NotifyAPARMarksUsed(ctx context.Context, sarprasIDs []uint, markedBy uint, reason string) error {
	gaUsers, err := s.userRepo.FindByDepartmentName(ctx, "General Affair")
	if err != nil {
		log.Printf("Failed to get GA users: %v", err)
		return nil
	}
	if len(gaUsers) == 0 {
		log.Println("No GA users found for mark used notification")
		return nil
	}

	subject := "⚠️ Peringatan: APAR/APAB Telah Digunakan – Segera Refill"

	baseURL := os.Getenv("FRONTEND_BASE_URL")
	baseURL = strings.TrimRight(baseURL, "/")
	frontendURL := fmt.Sprintf("%s/dashboard/refill", baseURL)

	marker, _ := s.userRepo.FindByID(ctx, markedBy)
	markerName := "QS"
	if marker != nil && marker.Name != "" {
		markerName = marker.Name
	}

	htmlBody := fmt.Sprintf(NotifyAPARMarksUsed, len(sarprasIDs), markerName, reason, frontendURL)

	systemMsg := fmt.Sprintf("%d APAR/APAB telah digunakan. Segera lakukan refill.", len(sarprasIDs))

	for _, ga := range gaUsers {
		notif := &domain.Notification{
			UserID:      ga.ID,
			Type:        "MARK_USED_REFILL",
			Message:     systemMsg,
			ReferenceID: nil,
		}
		if err := s.notifRepo.Create(ctx, notif); err != nil {
			log.Printf("⚠️ Failed to send notification to GA %d: %v", ga.ID, err)
			continue
		}
		if ws.GlobalHub != nil {
			ws.GlobalHub.SendToUser(ga.ID, "NEW_NOTIFICATION", map[string]interface{}{
				"id":           notif.ID,
				"type":         notif.Type,
				"message":      notif.Message,
				"reference_id": notif.ReferenceID,
				"is_read":      false,
				"created_at":   notif.CreatedAt,
			})
		} else {
			log.Println("WebSocket hub not initialized, skipping real-time notification for mark used")
		}
		go func(email string) {
			if err := s.mailer.SendHTML(email, subject, htmlBody); err != nil {
				log.Printf("❌ Failed to send mark used email to GA %s: %v", email, err)
			}
		}(ga.Email)
	}
	return nil
}

// SendRefillReminder sends reminder to GA about expired refill.
func (s *service) SendRefillReminder(ctx context.Context, sarprasID uint, inspectionID uint, sarprasCode, sarprasName string) error {
	gaUsers, err := s.userRepo.FindByDepartmentName(ctx, "General Affair")
	if err != nil {
		return fmt.Errorf("failed to fetch GA users: %w", err)
	}
	if len(gaUsers) == 0 {
		return nil
	}

	subject := fmt.Sprintf("Permintaan Refill APAR/APAB: %s", sarprasCode)
	baseURL := os.Getenv("FRONTEND_BASE_URL")
	baseURL = strings.TrimRight(baseURL, "/")
	frontendURL := fmt.Sprintf("%s/dashboard/refill", baseURL)

	htmlBody := fmt.Sprintf(NotifyRefillReminder, sarprasName, sarprasCode, frontendURL)

	systemMsg := fmt.Sprintf("%s (%s) melewati masa expired dan memerlukan refill.", sarprasName, sarprasCode)

	for _, user := range gaUsers {
		notif := &domain.Notification{
			UserID:      user.ID,
			Type:        "REFILL_REMINDER",
			Message:     systemMsg,
			ReferenceID: &inspectionID,
		}
		if err := s.notifRepo.Create(ctx, notif); err != nil {
			log.Printf("⚠️ Failed to create notification for GA user %d: %v", user.ID, err)
			continue
		}

		if ws.GlobalHub != nil {
			ws.GlobalHub.SendToUser(user.ID, "NEW_NOTIFICATION", map[string]interface{}{
				"id":           notif.ID,
				"type":         notif.Type,
				"message":      notif.Message,
				"reference_id": notif.ReferenceID,
				"is_read":      false,
				"created_at":   notif.CreatedAt,
			})
		} else {
			log.Println("WebSocket hub not initialized, skipping real-time notification for refill reminder")
		}

		go func(email string) {
			if err := s.mailer.SendHTML(email, subject, htmlBody); err != nil {
				log.Printf("❌ Failed to send refill reminder email to %s: %v", email, err)
			}
		}(user.Email)
	}

	return nil
}

func (s *service) NotifyRefillPODue(ctx context.Context, itemID uint, submittedBy uint, sarprasType, sarprasCode string, poNumber string, dueDate time.Time, daysDiff int, isOverdue bool) error {
	user, err := s.userRepo.FindByID(ctx, submittedBy)
	if err != nil {
		return fmt.Errorf("failed to fetch PO submitter: %w", err)
	}

	baseURL := strings.TrimRight(os.Getenv("FRONTEND_BASE_URL"), "/")
	frontendURL := fmt.Sprintf("%s/dashboard/refill", baseURL)
	dueDateLabel := dueDate.Format("02 January 2006")

	var subject, systemMsg, htmlBody string
	if isOverdue {
		subject = fmt.Sprintf("PERINGATAN PO Refill Overdue: %s", sarprasCode)
		systemMsg = fmt.Sprintf("PERINGATAN: PO (%s) untuk sarpras %s telah melewati batas waktu dan belum ada bukti refill.", poNumber, sarprasCode)
		htmlBody = fmt.Sprintf(RefillPOReminderOverdue, sarprasType, sarprasCode, poNumber, dueDateLabel, frontendURL)
	} else {
		subject = fmt.Sprintf("Reminder PO Refill: %s (%d hari lagi)", sarprasCode, daysDiff)
		systemMsg = fmt.Sprintf("PO (%s) untuk sarpras %s akan jatuh tempo dalam %d hari. Mohon segera unggah bukti refill.", poNumber, sarprasCode, daysDiff)
		htmlBody = fmt.Sprintf(RefillPOReminderApproaching, daysDiff, sarprasType, sarprasCode, poNumber, dueDateLabel, frontendURL)
	}

	notif := &domain.Notification{
		UserID:      user.ID,
		Type:        "REFILL_PO_DUE",
		Message:     systemMsg,
		ReferenceID: &itemID,
	}
	if err := s.notifRepo.Create(ctx, notif); err != nil {
		return fmt.Errorf("failed to create PO due notification: %w", err)
	}

	if ws.GlobalHub != nil {
		ws.GlobalHub.SendToUser(user.ID, "NEW_NOTIFICATION", map[string]interface{}{
			"id":           notif.ID,
			"type":         notif.Type,
			"message":      notif.Message,
			"reference_id": notif.ReferenceID,
			"is_read":      false,
			"created_at":   notif.CreatedAt,
		})
	} else {
		log.Println("WebSocket hub not initialized, skipping real-time notification for PO due reminder")
	}

	go func(email string) {
		if err := s.mailer.SendHTML(email, subject, htmlBody); err != nil {
			log.Printf("❌ Failed to send PO due email to %s: %v", email, err)
		}
	}(user.Email)

	return nil
}

// SendInspectionReminder sends reminder to checker about inspection.
func (s *service) SendInspectionReminder(ctx context.Context, userID uint, scheduleID uint, sarprasCode string, daysDiff int, isOverdue bool) error {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil
	}

	var subject, htmlBody, systemMsg string
	baseURL := os.Getenv("FRONTEND_BASE_URL")
	baseURL = strings.TrimRight(baseURL, "/")
	inspectionUrl := fmt.Sprintf("%s/dashboard/inspection", baseURL)

	if isOverdue {
		subject = fmt.Sprintf("EMERTRACK - Overdue Pemeriksaan Sarpras : %s", sarprasCode)
		htmlBody = fmt.Sprintf(string(InspectionReminderOverdue), sarprasCode, inspectionUrl)
		systemMsg = fmt.Sprintf("Pemeriksaan untuk sarpras %s telah OVERDUE!", sarprasCode)
	} else {
		subject = fmt.Sprintf("EMERTRACK - Reminder Pemeriksaan Sarpras : %s (H-%d)", sarprasCode, daysDiff)
		htmlBody = fmt.Sprintf(string(InspectionReminder), sarprasCode, daysDiff, inspectionUrl)
		systemMsg = fmt.Sprintf("Pemeriksaan untuk sarpras %s akan jatuh tempo dalam %d hari.", sarprasCode, daysDiff)
	}

	refID := scheduleID
	notif := &domain.Notification{
		UserID:      userID,
		Type:        "INSPECTION_REMINDER",
		Message:     systemMsg,
		ReferenceID: &refID,
	}
	if err := s.notifRepo.Create(ctx, notif); err != nil {
		return err
	}
	if ws.GlobalHub != nil {
		ws.GlobalHub.SendToUser(userID, "NEW_NOTIFICATION", map[string]interface{}{
			"id":           notif.ID,
			"type":         notif.Type,
			"message":      notif.Message,
			"reference_id": notif.ReferenceID,
			"is_read":      false,
			"created_at":   notif.CreatedAt,
		})
	} else {
		log.Println("WebSocket hub not initialized, skipping real-time notification for inspection reminder")
	}

	go func(email string) {
		if err := s.mailer.SendHTML(email, subject, htmlBody); err != nil {
			log.Printf("❌ Failed to send inspection reminder email to %s: %v", email, err)
		}
	}(user.Email)

	return nil
}

func (s *service) NotifyAparExpiryStatus(ctx context.Context, sarprasID uint, sarprasCode string, expiredDate time.Time, isExpired bool) error {
	gaUsers, err := s.userRepo.FindByDepartmentName(ctx, "General Affair")
	if err != nil {
		return fmt.Errorf("failed to fetch GA users: %w", err)
	}
	if len(gaUsers) == 0 {
		return nil
	}

	baseURL := strings.TrimRight(os.Getenv("FRONTEND_BASE_URL"), "/")
	frontendURL := fmt.Sprintf("%s/dashboard/refill", baseURL)

	var subject, systemMsg, htmlBody string
	if isExpired {
		subject = fmt.Sprintf("APAR/APAB Sudah Expired: %s", sarprasCode)
		systemMsg = fmt.Sprintf("%s telah melewati masa berlaku (expired pada %s). Segera lakukan refill.", sarprasCode, expiredDate.Format("02-01-2006"))
		htmlBody = fmt.Sprintf(NotifyExpiryOverdue, sarprasCode, sarprasCode, expiredDate.Format("02-01-2006"), frontendURL)
	} else {
		daysLeft := int(time.Until(expiredDate).Hours() / 24)
		subject = fmt.Sprintf("Reminder Masa Berlaku APAR/APAB: %s", sarprasCode)
		systemMsg = fmt.Sprintf("%s akan melewati masa berlaku dalam %d hari (%s). Mohon persiapkan refill.", sarprasCode, daysLeft, expiredDate.Format("02-01-2006"))
		htmlBody = fmt.Sprintf(NotifyExpiryWarning, daysLeft, sarprasCode, sarprasCode, expiredDate.Format("02-01-2006"), daysLeft, frontendURL)
	}

	for _, user := range gaUsers {
		notif := &domain.Notification{
			UserID:      user.ID,
			Type:        "APAR_EXPIRY_STATUS",
			Message:     systemMsg,
			ReferenceID: &sarprasID,
		}
		if err := s.notifRepo.Create(ctx, notif); err != nil {
			log.Printf("⚠️ Failed to create expiry notification for GA user %d: %v", user.ID, err)
			continue
		}
		if ws.GlobalHub != nil {
			ws.GlobalHub.SendToUser(user.ID, "NEW_NOTIFICATION", map[string]interface{}{
				"id": notif.ID, "type": notif.Type, "message": notif.Message,
				"reference_id": notif.ReferenceID, "is_read": false, "created_at": notif.CreatedAt,
			})
		}
		go func(email string) {
			if err := s.mailer.SendHTML(email, subject, htmlBody); err != nil {
				log.Printf("❌ Failed to send expiry status email to %s: %v", email, err)
			}
		}(user.Email)
	}
	return nil
}


func (s *service) NotifyPendingRefillVerification(ctx context.Context, itemID uint, sarprasCode string, daysPending int) error {
	qsUsers, err := s.userRepo.FindByRole(ctx, domain.RoleQS)
	if err != nil {
		return fmt.Errorf("failed to fetch QS users: %w", err)
	}
	if len(qsUsers) == 0 {
		return nil
	}

	subject := fmt.Sprintf("Reminder: Verifikasi Refill Tertunda - %s", sarprasCode)
	systemMsg := fmt.Sprintf("Bukti refill untuk APAR %s sudah menunggu verifikasi selama %d hari. Mohon segera diproses.", sarprasCode, daysPending)

	baseURL := os.Getenv("FRONTEND_BASE_URL")
	baseURL = strings.TrimRight(baseURL, "/")
	frontendURL := fmt.Sprintf("%s/dashboard/reviews", baseURL)
	htmlBody := fmt.Sprintf(
		`Halo,<br><br>%s<br><br><a href="%s" style="display:inline-block;padding:10px 20px;background-color:#E53E3E;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">Buka Halaman Review</a>`,
		systemMsg, frontendURL,
	)

	for _, qs := range qsUsers {
		refID := itemID
		notif := &domain.Notification{
			UserID:      qs.ID,
			Type:        "REFILL_VERIFICATION_PENDING",
			Message:     systemMsg,
			ReferenceID: &refID,
		}
		if err := s.notifRepo.Create(ctx, notif); err != nil {
			log.Printf("⚠️ Failed to create pending-verification notification for QS %d: %v", qs.ID, err)
			continue
		}
		if ws.GlobalHub != nil {
			ws.GlobalHub.SendToUser(qs.ID, "NEW_NOTIFICATION", map[string]interface{}{
				"id":           notif.ID,
				"type":         notif.Type,
				"message":      notif.Message,
				"reference_id": notif.ReferenceID,
				"is_read":      false,
				"created_at":   notif.CreatedAt,
			})
		} else {
			log.Println("WebSocket hub not initialized, skipping real-time notification for pending refill verification")
		}
		go func(email string) {
			if err := s.mailer.SendHTML(email, subject, htmlBody); err != nil {
				log.Printf("❌ Failed to send pending-verification email to %s: %v", email, err)
			}
		}(qs.Email)
	}
	return nil
}

func (s *service) DeleteNotification(ctx context.Context, id uint, userID uint) error {
	return s.notifRepo.Delete(ctx, id, userID)
}

func (s *service) DeleteAllNotifications(ctx context.Context, userID uint) error {
	return s.notifRepo.DeleteAll(ctx, userID)
}
