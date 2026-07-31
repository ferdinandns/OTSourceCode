package inspection

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"emertrack/internal/audit"
	"emertrack/internal/domain"
	"emertrack/pkg/util"
	"emertrack/pkg/ws"

	"gorm.io/gorm"
)

const id_ = "user_id"
const id = "id = ?"
const menuInspection = "Pemeriksaan Sarpras"

type inspectionService struct {
	inspRepo    domain.InspectionRepository
	sarprasRepo domain.SarprasRepository
	stRepo      domain.SarprasTypeRepository
	refillRepo  domain.RefillRepository
	notifSvc    domain.NotificationService
	auditSvc    domain.AuditService
	userRepo    domain.UserRepository
	db          *gorm.DB
}

type InspectionServiceDeps struct {
	InspRepo    domain.InspectionRepository
	SarprasRepo domain.SarprasRepository
	StRepo      domain.SarprasTypeRepository
	RefillRepo  domain.RefillRepository
	NotifSvc    domain.NotificationService
	AuditSvc    domain.AuditService
	UserRepo    domain.UserRepository
	DB          *gorm.DB
}

func NewService(deps InspectionServiceDeps) domain.InspectionService {
	return &inspectionService{
		inspRepo:    deps.InspRepo,
		sarprasRepo: deps.SarprasRepo,
		stRepo:      deps.StRepo,
		refillRepo:  deps.RefillRepo,
		notifSvc:    deps.NotifSvc,
		auditSvc:    deps.AuditSvc,
		userRepo:    deps.UserRepo,
		db:          deps.DB,
	}
}

func (s *inspectionService) isExpiryParameter(ctx context.Context, sarprasTypeID, paramID uint) bool {
	expiryParamID, err := s.stRepo.FindExpiryParamID(ctx, sarprasTypeID)
	if err != nil || expiryParamID == nil {
		return false
	}
	return *expiryParamID == paramID
}

// GetInspectionForm returns the form data for a given sarpras, respecting active refill.
func (s *inspectionService) GetInspectionForm(ctx context.Context, sarprasID uint) (*domain.InspectionFormResponse, error) {
	sarpras, err := s.sarprasRepo.FindByID(ctx, sarprasID)
	if err != nil {
		return nil, fmt.Errorf("sarpras tidak ditemukan: %w", err)
	}

	params, err := s.stRepo.GetParametersByType(ctx, sarpras.SarprasTypeID)
	if err != nil {
		return nil, fmt.Errorf("gagal memuat parameter: %w", err)
	}

	activeRefill, _ := s.refillRepo.GetActiveRefillBySarprasID(ctx, sarprasID)

	expiryParamID := sarpras.SarprasType.ExpiryParamID

	paramResponses := make([]domain.InspectionParameterResponse, len(params))
	for i, p := range params {
		editable := true
		refillInfo := ""
		if expiryParamID != nil && *expiryParamID == p.ID && activeRefill != nil {
			editable = false
			refillInfo = "Sedang dilakukan pengisian ulang oleh GA"
		}
		paramResponses[i] = domain.InspectionParameterResponse{
			ID:         p.ID,
			Name:       p.Name,
			Desc:       p.Desc,
			OrderNo:    p.OrderNo,
			Editable:   editable,
			RefillInfo: refillInfo,
		}
	}

	canInspect := false
	if sarpras.Status == domain.SarprasNotReady || sarpras.DueDate == nil {
		canInspect = true
	} else {
		canInspect = domain.CanInspect(sarpras.DueDate)
	}

	return &domain.InspectionFormResponse{
		SarprasID:   sarpras.ID,
		SarprasCode: sarpras.Code,
		SarprasName: sarpras.SarprasType.Name,
		DueDate:     sarpras.DueDate,
		CanInspect:  canInspect,
		Parameters:  paramResponses,
	}, nil
}

// SubmitInspection validates and stores an inspection, handling refill-aware logic.
func (s *inspectionService) SubmitInspection(ctx context.Context, req *domain.SubmitInspectionRequest, checkerID uint) (*domain.InspectionSubmitResult, error) {
	sarpras, err := s.sarprasRepo.FindByID(ctx, req.SarprasID)
	if checkerID == 0 {
		return nil, errors.New("unauthorized: missing checker_id")
	}

	if err != nil {
		return nil, fmt.Errorf("sarpras tidak ditemukan: %w", err)
	}

	if sarpras.DueDate != nil && !domain.CanInspect(sarpras.DueDate) {
		return nil, errors.New("pemeriksaan belum dapat dilakukan: belum memasuki periode H-10 sebelum jatuh tempo")
	}

	s.correctPrematureExpiryClaim(ctx, sarpras, req)

	activeRefill, _ := s.refillRepo.GetActiveRefillBySarprasID(ctx, req.SarprasID)

	if activeRefill != nil {
		for _, item := range req.Items {
			if s.isExpiryParameter(ctx, sarpras.SarprasTypeID, item.ParameterID) {
				return nil, errors.New("parameter Masa Berlaku tidak perlu dinilai karena sedang dalam proses refill oleh GA")
			}
		}
	}

	overallStatus, errMsgs := s.validateAndDetermineStatus(req)
	if len(errMsgs) > 0 {
		return nil, errors.New(strings.Join(errMsgs, "|"))
	}

	now := time.Now()

	result, err := s.executeSubmitTx(ctx, req, sarpras, overallStatus, activeRefill, now, checkerID)
	if err != nil {
		return nil, err
	}

	s.broadcastSubmitUpdates(overallStatus, activeRefill)
	return result, nil
}

// Prevent checker jahil from marking expiry parameter as NOK when it's not actually expired, to avoid unnecessary refill requests.
func (s *inspectionService) correctPrematureExpiryClaim(ctx context.Context, sarpras *domain.Sarpras, req *domain.SubmitInspectionRequest) {
	now := time.Now()
	isActuallyExpired := sarpras.ExpiredDate != nil && !sarpras.ExpiredDate.After(now)
	if isActuallyExpired {
		return
	}

	for i, item := range req.Items {
		if item.Status != domain.ResultNOK {
			continue
		}
		if !s.isExpiryParameter(ctx, sarpras.SarprasTypeID, item.ParameterID) {
			continue
		}
		log.Printf("Sarpras %s: parameter Masa Berlaku ditandai NOK oleh checker tapi expired_date (%v) belum lewat — dikoreksi otomatis jadi OK", sarpras.Code, sarpras.ExpiredDate)
		req.Items[i].Status = domain.ResultOK
		req.Items[i].Notes = ""
	}
}

func (s *inspectionService) executeSubmitTx(
	ctx context.Context,
	req *domain.SubmitInspectionRequest,
	sarpras *domain.Sarpras,
	overallStatus domain.InspectionResult,
	activeRefill *domain.RefillStatus,
	now time.Time,
	checkerID uint,
) (*domain.InspectionSubmitResult, error) {
	tx := s.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	scheduleID := s.findActiveSchedule(tx, req.SarprasID)

	insp := &domain.Inspection{
		ScheduleID:    scheduleID,
		SarprasID:     req.SarprasID,
		CheckerID:     checkerID,
		InspectedAt:   now,
		OverallStatus: overallStatus,
	}
	if err := tx.Omit("Sarpras", "Checker", "Items").Create(insp).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("gagal menyimpan pemeriksaan: %w", err)
	}

	if err := s.saveInspectionItems(tx, insp.ID, req); err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := s.closeSchedule(tx, scheduleID, checkerID, now); err != nil {
		tx.Rollback()
		return nil, err
	}

	var result *domain.InspectionSubmitResult
	var auditDesc string
	var err error

	onlyExpiryNOK := s.onlyExpiryParameterNOK(ctx, req, sarpras.SarprasTypeID)

	if overallStatus == domain.ResultOK {
		result, auditDesc, err = s.processOKOutcome(tx, sarpras, req, now, scheduleID)
	} else if onlyExpiryNOK {
		result, auditDesc, err = s.processExpiryNeedsRefillOutcome(tx, sarpras, req, insp.ID, now)
	} else {
		result, auditDesc, err = s.processNOKOutcomeWithRefill(ctx, tx, sarpras, req, insp.ID, now, scheduleID)
	}

	if err != nil {
		tx.Rollback()
		return nil, err
	}

	result.InspectionID = insp.ID

	if err := audit.Record(tx, checkerID, "SUBMIT_INSPECTION", menuInspection, auditDesc, insp.ID, nil); err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("gagal mencatat audit log: %w", err)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	return result, nil
}

func (s *inspectionService) findActiveSchedule(tx *gorm.DB, sarprasID uint) *uint {
	var schedule domain.InspectionSchedule
	if err := tx.Where("sarpras_id = ? AND status = ?", sarprasID, domain.ScheduleInProgress).First(&schedule).Error; err == nil {
		return &schedule.ID
	}
	return nil
}

func (s *inspectionService) closeSchedule(tx *gorm.DB, scheduleID *uint, checkerID uint, now time.Time) error {
	if scheduleID == nil {
		return nil
	}
	return tx.Model(&domain.InspectionSchedule{}).
		Where(id, *scheduleID).
		Updates(map[string]interface{}{
			"status":     domain.ScheduleDone,
			"checker_id": checkerID,
			"updated_at": now,
		}).Error
}

func (s *inspectionService) broadcastSubmitUpdates(overallStatus domain.InspectionResult, activeRefill *domain.RefillStatus) {
	go ws.BroadcastInspectionUpdated()
	go ws.BroadcastSarprasUpdated()
	if overallStatus == domain.ResultNOK && activeRefill == nil {
		go ws.BroadcastRepairUpdated()
	}
}

func (s *inspectionService) validateAndDetermineStatus(req *domain.SubmitInspectionRequest) (domain.InspectionResult, []string) {
	overallStatus := domain.ResultOK
	var errMsgs []string
	for _, item := range req.Items {
		if item.PhotoPath == "" {
			errMsgs = append(errMsgs, fmt.Sprintf("foto wajib diisi (parameter_id: %d)", item.ParameterID))
		}
		if item.Status == domain.ResultNOK {
			overallStatus = domain.ResultNOK
			if item.Notes == "" {
				errMsgs = append(errMsgs, fmt.Sprintf("keterangan NOK wajib diisi (parameter_id: %d)", item.ParameterID))
			}
		}
	}
	return overallStatus, errMsgs
}

func (s *inspectionService) saveInspectionItems(tx *gorm.DB, inspID uint, req *domain.SubmitInspectionRequest) error {
	for _, item := range req.Items {
		ii := &domain.InspectionItem{
			InspectionID: inspID,
			ParameterID:  item.ParameterID,
			Status:       item.Status,
			Notes:        item.Notes,
			PhotoPath:    item.PhotoPath,
		}
		if err := tx.Omit("Parameter").Create(ii).Error; err != nil {
			return fmt.Errorf("gagal menyimpan item pemeriksaan: %w", err)
		}
	}
	return nil
}

func (s *inspectionService) processOKOutcome(tx *gorm.DB, sarpras *domain.Sarpras, req *domain.SubmitInspectionRequest, now time.Time, scheduleID *uint) (*domain.InspectionSubmitResult, string, error) {
	interval := sarpras.SarprasType.InspIntervalMonths
	if interval <= 0 {
		interval = 1
	}

	nextDue := now.AddDate(0, interval, 0)

	updates := map[string]interface{}{
		"status":         domain.SarprasReady,
		"due_date":       nextDue,
		"last_inspected": now,
	}
	if err := tx.Model(&domain.Sarpras{}).Where(id, req.SarprasID).Updates(updates).Error; err != nil {
		return nil, "", fmt.Errorf("gagal update status sarpras: %w", err)
	}

	if err := util.UpdateScheduleSnapshot(tx, scheduleID, string(domain.SarprasReady)); err != nil {
		return nil, "", fmt.Errorf("Gagal update snapshot: %w", err)
	}

	auditDesc := fmt.Sprintf("Pemeriksaan sarpras %s selesai dengan hasil OK. Pemeriksaan berikutnya: %s", sarpras.Code, nextDue.Format("02-01-2006"))
	return &domain.InspectionSubmitResult{
		OverallStatus: domain.ResultOK,
		SarprasStatus: domain.SarprasReady,
		NextDueDate:   &nextDue,
	}, auditDesc, nil
}

func (s *inspectionService) processNOKOutcomeWithRefill(
	ctx context.Context,
	tx *gorm.DB,
	sarpras *domain.Sarpras,
	req *domain.SubmitInspectionRequest,
	inspID uint,
	now time.Time,
	scheduleID *uint,
) (*domain.InspectionSubmitResult, string, error) {
	interval := sarpras.SarprasType.InspIntervalMonths
	if interval <= 0 {
		interval = 1
	}

	nextDue := now.AddDate(0, interval, 0)

	updates := map[string]interface{}{
		"status":         domain.SarprasNeedRepair,
		"last_inspected": now,
		"due_date":       nextDue,
	}
	if err := tx.Model(&domain.Sarpras{}).Where(id, req.SarprasID).Updates(updates).Error; err != nil {
		return nil, "", fmt.Errorf("gagal update status sarpras: %w", err)
	}

	if err := util.UpdateScheduleSnapshot(tx, scheduleID, string(domain.SarprasNeedRepair)); err != nil {
		return nil, "", fmt.Errorf("gagal update snapshot: %w", err)
	}

	picUser, err := s.userRepo.FindDefaultPICByDepartmentID(tx.Statement.Context, tx, sarpras.SarprasType.PICDeptID)
	if err != nil {
		return nil, "", fmt.Errorf("tidak ada user PIC untuk departemen %d: %w", sarpras.SarprasType.PICDeptID, err)
	}

	repairOrder := &domain.RepairOrder{
		InspectionID: inspID,
		SarprasID:    req.SarprasID,
		PICID:        picUser.ID,
		Status:       domain.RepairAssigned,
	}
	if err := tx.Omit("Sarpras", "PIC", "Evidences").Create(repairOrder).Error; err != nil {
		return nil, "", fmt.Errorf("gagal membuat repair order: %w", err)
	}

	var nokNotes string
	for _, item := range req.Items {
		if item.Status == domain.ResultNOK && !s.isExpiryParameter(ctx, sarpras.SarprasTypeID, item.ParameterID) {
			nokNotes += fmt.Sprintf("- %s\n", item.Notes)
		}
	}

	go func() {
		_ = s.notifSvc.NotifyRepairPIC(
			context.Background(),
			repairOrder.ID,
			sarpras.Code,
			sarpras.SarprasType.Name,
			repairOrder.PICID,
			nokNotes,
		)
	}()

	auditDesc := fmt.Sprintf("Pemeriksaan sarpras %s selesai dengan hasil NOK. Perbaikan akan diteruskan kepada PIC Responsibility.", sarpras.Code)
	return &domain.InspectionSubmitResult{
		OverallStatus: domain.ResultNOK,
		SarprasStatus: domain.SarprasNeedRepair,
		RepairOrderID: &repairOrder.ID,
	}, auditDesc, nil
}

// processRefillReminderOutcome handles the case where only expiry parameter is NOK and a refill is active.
func (s *inspectionService) processExpiryNeedsRefillOutcome(tx *gorm.DB, sarpras *domain.Sarpras, req *domain.SubmitInspectionRequest, inspID uint, now time.Time) (*domain.InspectionSubmitResult, string, error) {
	if err := tx.Model(&domain.Sarpras{}).Where(id, req.SarprasID).Update("last_inspected", now).Error; err != nil {
		return nil, "", fmt.Errorf("gagal update last_inspected: %w", err)
	}

	go func() {
		_ = s.notifSvc.SendRefillReminder(context.Background(), sarpras.ID, inspID, sarpras.Code, sarpras.SarprasType.Name)
	}()

	auditDesc := fmt.Sprintf("Pemeriksaan sarpras %s: parameter Masa Berlaku tidak OK, Notifikasi permintaan refill dikirim ke PIC Departemen %s.", sarpras.Code, sarpras.SarprasType.PICDept.Name)
	return &domain.InspectionSubmitResult{
		OverallStatus: domain.ResultNOK,
		SarprasStatus: sarpras.Status,
	}, auditDesc, nil
}

// onlyExpiryParameterNOK checks if all NOK items are for the expiry parameter.
func (s *inspectionService) onlyExpiryParameterNOK(ctx context.Context, req *domain.SubmitInspectionRequest, sarprasTypeID uint) bool {
	hasNOK := false
	for _, item := range req.Items {
		if item.Status == domain.ResultNOK {
			hasNOK = true
			if item.Status == domain.ResultNOK && !s.isExpiryParameter(ctx, sarprasTypeID, item.ParameterID) {
				return false
			}
		}
	}
	return hasNOK
}

func (s *inspectionService) ListActiveTasks(ctx context.Context, filter domain.InspectionFilter) ([]domain.InspectionRow, int64, error) {
	return s.inspRepo.ListActiveTasks(ctx, filter)
}

func (s *inspectionService) ListHistory(ctx context.Context, filter domain.InspectionHistoryFilter) ([]domain.InspectionHistoryRow, int64, error) {
	return s.inspRepo.ListHistory(ctx, filter)
}

func (s *inspectionService) ListMonitoring(ctx context.Context, filter domain.InspectionMonitoringFilter) ([]domain.InspectionMonitoringRow, int64, error) {
	return s.inspRepo.ListMonitoring(ctx, filter)
}

func (s *inspectionService) GetInspectionDetail(ctx context.Context, id uint) (*domain.InspectionDetailResponse, error) {
	insp, err := s.inspRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}

	resp := MapInspectionToResponse(insp)
	resp.Repair = s.loadRepairInfo(ctx, id)

	return resp, nil
}

func (s *inspectionService) ClaimInspection(ctx context.Context, scheduleID uint, userID uint) error {
	var schedule domain.InspectionSchedule
	if err := s.db.WithContext(ctx).First(&schedule, scheduleID).Error; err != nil {
		return errors.New("jadwal tidak ditemukan")
	}

	switch schedule.Status {
	case domain.SchedulePending, domain.ScheduleOverdue:
		prevStatus := schedule.Status
		result := s.db.WithContext(ctx).
			Model(&domain.InspectionSchedule{}).
			Where("id = ? AND status IN ?", scheduleID, []string{string(domain.SchedulePending), string(domain.ScheduleOverdue)}).
			Updates(map[string]interface{}{
				"checker_id":      userID,
				"status":          domain.ScheduleInProgress,
				"previous_status": prevStatus,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return errors.New("Tugas ini sudah tidak tersedia atau sudah diambil checker lain")
		}

	case domain.ScheduleInProgress:
		if schedule.CheckerID == nil || *schedule.CheckerID != userID {
			return errors.New("tugas ini sedang diperiksa oleh checker lain")
		}
	default:
		return errors.New("jadwal ini sudah selesai")
	}

	go ws.BroadcastInspectionUpdated()
	return nil
}

func (s *inspectionService) CancelClaim(ctx context.Context, scheduleID uint, userID uint) error {
	var schedule domain.InspectionSchedule
	err := s.db.WithContext(ctx).
		Where("id = ? AND checker_id = ? AND status = ?", scheduleID, userID, domain.ScheduleInProgress).
		First(&schedule).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("kamu tidak berhak membatalkan tugas ini")
		}
		return err
	}

	newStatus := domain.SchedulePending
	if schedule.PreviousStatus != nil {
		newStatus = *schedule.PreviousStatus
	}

	result := s.db.WithContext(ctx).
		Model(&domain.InspectionSchedule{}).
		Where(id, scheduleID).
		Updates(map[string]interface{}{
			"checker_id":      nil,
			"status":          newStatus,
			"previous_status": nil,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("gagal membatalkan tugas")
	}

	go ws.BroadcastInspectionUpdated()
	return nil
}

// GenerateSchedulesDueSoon creates inspection schedules for sarpras approaching due date.
func (s *inspectionService) GenerateSchedulesDueSoon(ctx context.Context) error {
	sarprasList, err := s.inspRepo.GetSarprasForScheduling(ctx)
	log.Printf("Jumlah sarpras: %d", len(sarprasList))
	if err != nil {
		return fmt.Errorf("gagal mengambil data sarpras: %w", err)
	}

	now := time.Now()
	for _, sp := range sarprasList {
		targetDue := s.calculateTargetDue(sp, now)

		if targetDue.Sub(now).Hours()/24 > 10 {
			continue
		}

		hasActive, err := s.inspRepo.HasActiveSchedule(ctx, sp.ID)
		if err != nil || hasActive {
			continue
		}

		exists, err := s.inspRepo.HasScheduleForDueDate(ctx, sp.ID, targetDue)
		if err != nil || exists {
			continue
		}

		newSchedule := &domain.InspectionSchedule{
			SarprasID: sp.ID,
			CheckerID: nil,
			Status:    domain.SchedulePending,
			DueDate:   targetDue,
			CreatedAt: now,
			UpdatedAt: now,
		}
		if err := s.inspRepo.CreateSchedule(ctx, newSchedule); err != nil {
			log.Printf("Gagal membuat jadwal untuk sarpras %d: %v", sp.ID, err)
		}
	}
	return nil
}

func (s *inspectionService) UpdateOverdueAndNotReady(ctx context.Context) error {
	if err := s.inspRepo.UpdateOverdueSchedules(ctx); err != nil {
		return fmt.Errorf("update overdue schedules: %w", err)
	}
	if err := s.sarprasRepo.UpdateStatusByExpiry(ctx); err != nil {
		return fmt.Errorf("update status expiry: %w", err)
	}
	if err := s.inspRepo.UpdateMarkAsNotReady(ctx); err != nil {
		return fmt.Errorf("update mark as not ready: %w", err)
	}
	return nil
}

// SendInspectionReminders sends reminders for upcoming or overdue inspections.
func (s *inspectionService) SendInspectionReminders(ctx context.Context) error {
	schedules, err := s.inspRepo.GetSchedulesForReminder(ctx)
	if err != nil {
		return nil
	}
	if len(schedules) == 0 {
		log.Println("Tidak ada jadwal pemeriksaan")
		return nil
	}

	today := time.Now().Truncate(24 * time.Hour)
	for _, schedule := range schedules {
		s.processReminderForSchedule(ctx, schedule, today)
	}
	return nil
}

func (s *inspectionService) processReminderForSchedule(ctx context.Context, schedule domain.InspectionSchedule, today time.Time) {
	sarpras, err := s.getSarprasWithType(ctx, schedule.SarprasID)
	if err != nil {
		log.Printf("Gagal mengambil sarpras id %d: %v", schedule.SarprasID, err)
		return
	}

	checkerIDs := s.getTargetCheckers(ctx, schedule, sarpras)
	if len(checkerIDs) == 0 {
		log.Printf("Tidak ada checker untuk sarpras ID %d", sarpras.ID)
		return
	}

	daysDiff := int(schedule.DueDate.Truncate(24*time.Hour).Sub(today).Hours() / 24)

	// Hanya kirim pada H-10, H-7, H-3, H-1, atau Overdue
	if !(daysDiff == 10 || daysDiff == 7 || daysDiff == 3 || daysDiff == 1 || daysDiff < 0) {
		return
	}

	isOverdue := daysDiff < 0

	for _, uid := range checkerIDs {
		if err := s.notifSvc.SendInspectionReminder(
			ctx,
			uid,
			schedule.ID,
			sarpras.Code,
			daysDiff,
			isOverdue,
		); err != nil {
			log.Printf("Gagal kirim reminder ke checker %d: %v", uid, err)
		}
	}
}

func (s *inspectionService) getSarprasWithType(ctx context.Context, sarprasID uint) (domain.Sarpras, error) {
	var sarpras domain.Sarpras
	err := s.db.WithContext(ctx).Preload("SarprasType").First(&sarpras, sarprasID).Error
	return sarpras, err
}

func (s *inspectionService) getTargetCheckers(ctx context.Context, schedule domain.InspectionSchedule, sarpras domain.Sarpras) []uint {
	if schedule.CheckerID != nil {
		return []uint{*schedule.CheckerID}
	}

	checkers, err := s.userRepo.FindCheckersByDeptAndType(ctx, sarpras.LocationDeptID, sarpras.SarprasTypeID)
	if err != nil {
		log.Printf("Gagal mencari checker untuk sarpras %d: %v", sarpras.ID, err)
		return nil
	}

	var ids []uint
	for _, c := range checkers {
		ids = append(ids, c.ID)
	}
	return ids
}

func (s *inspectionService) loadRepairInfo(ctx context.Context, inspectionID uint) *domain.RepairInfo {
	repairOrder, err := s.inspRepo.GetRepairOrderByInspection(ctx, inspectionID)
	if err != nil {
		return nil
	}

	submissions, err := s.inspRepo.GetSubmissionsByRepairOrder(ctx, repairOrder.ID)
	if err != nil {
		return nil
	}

	repairInfo := &domain.RepairInfo{
		RepairOrderID: repairOrder.ID,
		Status:        repairOrder.Status,
	}

	for _, sub := range submissions {
		repairInfo.Submissions = append(repairInfo.Submissions, s.mapSubmissionInfo(ctx, sub))
	}

	return repairInfo
}

func (s *inspectionService) mapSubmissionInfo(ctx context.Context, sub domain.RepairSubmission) domain.SubmissionInfo {
	info := domain.SubmissionInfo{
		ID:         sub.ID,
		Attempt:    sub.Attempt,
		ActionPlan: sub.ActionPlan,
		DueDate:    sub.DueDate,
		Status:     sub.Status,
		CreatedAt:  sub.CreatedAt,
	}

	for _, ev := range sub.Evidences {
		info.Evidences = append(info.Evidences, ev.FilePath)
	}

	s.loadReviewInfo(ctx, sub.ID, &info)

	return info
}

func (s *inspectionService) loadReviewInfo(ctx context.Context, submissionID uint, info *domain.SubmissionInfo) {
	review, err := s.inspRepo.GetReviewBySubmission(ctx, submissionID)
	if err != nil {
		return
	}

	info.ReviewedAt = review.ReviewedAt
	info.Feedback = review.Feedback

	if review.Verdict != nil {
		info.Verdict = string(*review.Verdict)
	}

	if review.ReviewerID != nil {
		reviewer, err := s.inspRepo.GetReviewerByID(ctx, *review.ReviewerID)
		if err == nil {
			info.Reviewer = reviewer.Name
		}
	}

	for _, att := range review.Attachments {
		info.ReviewAttachments = append(info.ReviewAttachments, att.FilePath)
	}
}

func (s *inspectionService) calculateTargetDue(sp domain.SarprasSchedulingData, now time.Time) time.Time {
    if sp.DueDate != nil {
        return *sp.DueDate
    }

    return time.Date(
        now.Year(),
        now.Month(),
        1,
        23,
        59,
        59,
        0,
        now.Location(),
    ).AddDate(0, 1, -1)
}
