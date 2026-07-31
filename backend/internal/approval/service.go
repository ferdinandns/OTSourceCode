package approval

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"emertrack/internal/audit"
	"emertrack/internal/domain"
	"emertrack/pkg/util"
	"emertrack/pkg/ws"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const id = "id = ?"

type approvalService struct {
	approvalRepo    domain.ApprovalRepository
	sarprasTypeRepo domain.SarprasTypeRepository
	sarprasRepo     domain.SarprasRepository
	sarprasService  domain.SarprasService
	notifSvc        domain.NotificationService
	db              *gorm.DB
}

func NewApprovalService(repo domain.ApprovalRepository, stRepo domain.SarprasTypeRepository, sRepo domain.SarprasRepository, sService domain.SarprasService,
	notifSvc domain.NotificationService, db *gorm.DB) domain.ApprovalService {
	return &approvalService{
		approvalRepo:    repo,
		sarprasTypeRepo: stRepo,
		sarprasRepo:     sRepo,
		sarprasService:  sService,
		notifSvc:        notifSvc,
		db:              db,
	}
}

func (s *approvalService) Approve(ctx context.Context, reviewerID, approvalID uint, notes string) (string, error) {
	tx := s.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return "", tx.Error
	}

	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	appr, err := s.approvalRepo.FindByID(ctx, approvalID)
	if err != nil {
		tx.Rollback()
		return "", err
	}

	if appr.Status != domain.ApprovalPending {
		tx.Rollback()
		return "", fmt.Errorf("approval request is already %s", appr.Status)
	}

	identifier := ExtractIdentifier(appr)

	if err := s.executeApproval(ctx, tx, appr); err != nil {
		tx.Rollback()
		return "", err
	}

	now := time.Now()
	appr.Status = domain.ApprovalApproved
	appr.ReviewedBy = &reviewerID
	appr.ReviewedAt = &now
	appr.Notes = notes

	if err := tx.Model(appr).Omit(clause.Associations).Updates(map[string]interface{}{
		"status":      domain.ApprovalApproved,
		"reviewed_by": reviewerID,
		"reviewed_at": now,
		"notes":       notes,
	}).Error; err != nil {
		tx.Rollback()
		return "", err
	}

	menu := GetMenuLabel(appr.EntityType)
	actionDesc := util.FormatAction(string(appr.Action))

	var msg string
	if appr.EntityType == "SarprasBulk" {
		requesterName, _ := s.approvalRepo.GetRequesterName(ctx, appr.RequestedBy)
		msg = fmt.Sprintf("%s %s %s (Via Excel) Yang Diajukan oleh %s", domain.ApprovalApprove, actionDesc, menu, requesterName)
	} else {
		msg = fmt.Sprintf("%s %s %s: %s", domain.ApprovalApprove, actionDesc, menu, identifier)
	}

	if err := audit.Record(tx, reviewerID, string(domain.VerifyApproved), menu, msg, appr.ID, appr.PayloadJSON); err != nil {
		tx.Rollback()
		return "", err
	}

	if err := tx.Commit().Error; err != nil {
		return "", err
	}

	go func() {
		entityType := appr.EntityType
		if appr.EntityType != "SarprasBulk" {
			entityType = util.FormatEntityType(appr.EntityType)
		}
		_ = s.notifSvc.NotifyRequesterApprovalResult(
			context.Background(),
			domain.ApprovalResultNotif{
				RequesterID:   appr.RequestedBy,
				ApprovalID:    appr.ID,
				Status:        "approved",
				Action:        util.FormatAction(string(appr.Action)),
				EntityType:    entityType,
				Identifier:    identifier,
				ReviewerNotes: notes,
				TotalItems:    s.countBulkItems(appr),
			},
		)
	}()
	go ws.BroadcastApprovalUpdated()

	return msg, nil
}

func (s *approvalService) Reject(ctx context.Context, reviewerID, approvalID uint, notes string) (string, error) {
	tx := s.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return "", tx.Error
	}

	appr, err := s.approvalRepo.FindByID(ctx, approvalID)
	if err != nil {
		tx.Rollback()
		return "", err
	}

	if appr.Status != domain.ApprovalPending {
		tx.Rollback()
		return "", fmt.Errorf("approval request is already %s", appr.Status)
	}

	now := time.Now()
	appr.Status = domain.ApprovalRejected
	appr.ReviewedBy = &reviewerID
	appr.ReviewedAt = &now
	appr.Notes = notes

	if err := tx.Model(appr).Omit(clause.Associations).Updates(map[string]interface{}{
		"status":      domain.ApprovalRejected,
		"reviewed_by": reviewerID,
		"reviewed_at": now,
		"notes":       notes,
	}).Error; err != nil {
		tx.Rollback()
		return "", err
	}

	menu := GetMenuLabel(appr.EntityType)
	actionDesc := util.FormatAction(string(appr.Action))
	identifier := ExtractIdentifier(appr)

	var msg string
	if appr.EntityType == "SarprasBulk" {
		requesterName, _ := s.approvalRepo.GetRequesterName(ctx, appr.RequestedBy)
		msg = fmt.Sprintf("%s %s %s (Via Excel) Yang Diajukan oleh %s", domain.ApprovalReject, actionDesc, menu, requesterName)
	} else {
		msg = fmt.Sprintf("%s %s %s: %s", domain.ApprovalReject, actionDesc, menu, identifier)
	}

	if err := audit.Record(tx, reviewerID, string(domain.VerifyRejected), menu, msg, appr.ID, appr.PayloadJSON); err != nil {
		tx.Rollback()
		return "", err
	}

	if err := tx.Commit().Error; err != nil {
		return "", err
	}

	go func() {
		entityType := appr.EntityType
		if appr.EntityType != "SarprasBulk" {
			entityType = util.FormatEntityType(appr.EntityType)
		}
		_ = s.notifSvc.NotifyRequesterApprovalResult(
			context.Background(),
			domain.ApprovalResultNotif{
				RequesterID:   appr.RequestedBy,
				ApprovalID:    appr.ID,
				Status:        "rejected",
				Action:        util.FormatAction(string(appr.Action)),
				EntityType:    entityType,
				Identifier:    identifier,
				ReviewerNotes: notes,
				TotalItems:    s.countBulkItems(appr),
			},
		)
	}()
	go ws.BroadcastApprovalUpdated()

	return msg, nil
}

func (s *approvalService) countBulkItems(appr *domain.ApprovalRequest) int {
	if appr.EntityType != "SarprasBulk" {
		return 0
	}
	count, err := s.approvalRepo.CountBulkItems(context.Background(), appr.ID)
	if err != nil {
		return 0
	}
	return count
}

func (s *approvalService) GetApprovalDetail(ctx context.Context, id uint) (*domain.ApprovalResponse, error) {
	row, err := s.approvalRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}

	res := MapToResponse(row)
	return &res, nil
}

func (s *approvalService) ListApprovals(ctx context.Context, f domain.ApprovalFilter) ([]domain.ApprovalResponse, int64, error) {
	return s.approvalRepo.List(ctx, f)
}

func (s *approvalService) executeApproval(ctx context.Context, tx *gorm.DB, appr *domain.ApprovalRequest) error {
	switch appr.EntityType {
	case "Sarpras":
		return s.handleSarprasApproval(ctx, tx, appr)
	case "SarprasBulk":
		return s.handleBulkSarprasApproval(ctx, tx, appr)
	case "SarprasType":
		return s.handleSarprasTypeApproval(ctx, tx, appr)
	case "Department":
		return s.handleDepartmentApproval(tx, appr)
	case "Site":
		return s.handleGenericApproval(tx, appr, &domain.Site{})
	default:
		return fmt.Errorf("unknown entity type: %s", appr.EntityType)
	}
}

func (s *approvalService) handleSarprasTypeApproval(ctx context.Context, tx *gorm.DB, appr *domain.ApprovalRequest) error {
	var st domain.SarprasType
	if appr.Action != domain.ApprovalDelete {
		if err := json.Unmarshal([]byte(appr.PayloadJSON), &st); err != nil {
			return err
		}
	}

	switch appr.Action {
	case domain.ApprovalCreate:
		return s.handleCreateSarprasTypeApproval(tx, &st)
	case domain.ApprovalEdit:
		return s.handleEditSarprasTypeApproval(tx, appr, &st)
	case domain.ApprovalDelete:
		return tx.Delete(&domain.SarprasType{}, appr.EntityID).Error
	default:
		return nil
	}
}

func (s *approvalService) handleCreateSarprasTypeApproval(tx *gorm.DB, st *domain.SarprasType) error {
	st.ID = 0
	st.ExpiryParamID = nil

	if err := tx.Omit("Parameters", "PICDept").Create(st).Error; err != nil {
		return err
	}

	for i := range st.Parameters {
		st.Parameters[i].SarprasTypeID = st.ID
		st.Parameters[i].ID = 0
		if err := tx.Create(&st.Parameters[i]).Error; err != nil {
			return err
		}
	}

	return s.setExpiryParamID(tx, st)
}

func (s *approvalService) handleEditSarprasTypeApproval(tx *gorm.DB, appr *domain.ApprovalRequest, st *domain.SarprasType) error {
	if appr.EntityID == nil {
		return fmt.Errorf("entity ID cannot be nil for edit action")
	}
	if err := tx.Model(&domain.SarprasType{}).Where(id, *appr.EntityID).
		Select("Name", "InspIntervalMonths").
		Updates(map[string]interface{}{
			"name":                 st.Name,
			"insp_interval_months": st.InspIntervalMonths,
		}).Error; err != nil {
		return err
	}
	if err := s.syncSarprasTypeParameters(tx, *appr.EntityID, st.Parameters); err != nil {
		return err
	}
	st.ID = *appr.EntityID
	return s.setExpiryParamID(tx, st)
}

// setExpiryParamID looks for a parameter whose Name equals domain.ExpiryParamName
// and updates the SarprasType row accordingly. If not found, it clears the field.
func (s *approvalService) setExpiryParamID(tx *gorm.DB, st *domain.SarprasType) error {
	for _, p := range st.Parameters {
		if p.Name == domain.ExpiryParamName && p.ID != 0 {
			return tx.Model(&domain.SarprasType{}).Where(id, st.ID).
				Update("expiry_param_id", p.ID).Error
		}
	}
	return tx.Model(&domain.SarprasType{}).Where(id, st.ID).
		Update("expiry_param_id", nil).Error
}

func (s *approvalService) handleSarprasApproval(ctx context.Context, tx *gorm.DB, appr *domain.ApprovalRequest) error {
	var data domain.Sarpras

	if appr.EntityType == "SarprasBulk" {
		return s.handleBulkSarprasApproval(ctx, tx, appr)
	}

	if appr.Action != domain.ApprovalDelete {
		if err := json.Unmarshal([]byte(appr.PayloadJSON), &data); err != nil {
			return err
		}
	}

	switch appr.Action {
	case domain.ApprovalCreate:
		return s.handleCreateSarprasApproval(ctx, tx, data)

	case domain.ApprovalEdit:
		if appr.EntityID == nil {
			return fmt.Errorf("entity ID cannot be nil for edit action")
		}
		var editPayload struct {
			Code              string `json:"code"`
			OldLocationDetail string `json:"old_location_detail"`
			NewLocationDetail string `json:"new_location_detail"`
			RiskLevel         string `json:"risk_level"`
			RiskScore         int    `json:"risk_score"`
		}
		if err := json.Unmarshal([]byte(appr.PayloadJSON), &editPayload); err != nil {
			return err
		}
		return tx.Model(&domain.Sarpras{}).Where(id, *appr.EntityID).
			Update("location_detail", editPayload.NewLocationDetail).Error

	case domain.ApprovalDelete:
		if appr.EntityID == nil {
			return fmt.Errorf("entity ID cannot be nil for delete action")
		}
		return s.cascadeDeleteSarpras(tx, *appr.EntityID)
	}

	return nil
}

func (s *approvalService) cascadeDeleteSarpras(tx *gorm.DB, sarprasID uint) error {
	if err := s.deleteRepairChain(tx, sarprasID); err != nil {
		return err
	}
	if err := s.deleteInspectionChain(tx, sarprasID); err != nil {
		return err
	}
	if err := s.deleteRemainingSarprasAssociations(tx, sarprasID); err != nil {
		return err
	}
	return s.sarprasRepo.DeleteTx(tx, sarprasID)
}

func (s *approvalService) deleteRepairChain(tx *gorm.DB, sarprasID uint) error {
	var repairOrderIDs []uint
	if err := tx.Model(&domain.RepairOrder{}).Where("sarpras_id = ?", sarprasID).Pluck("id", &repairOrderIDs).Error; err != nil {
		return fmt.Errorf("gagal ambil repair orders: %w", err)
	}
	if len(repairOrderIDs) == 0 {
		return nil
	}

	if err := tx.Model(&domain.RepairOrder{}).Where("id IN ?", repairOrderIDs).Update("active_submission_id", nil).Error; err != nil {
		return fmt.Errorf("gagal reset active_submission_id: %w", err)
	}

	var reviewOrderIDs []uint
	if err := tx.Model(&domain.ReviewOrder{}).Where("repair_order_id IN ?", repairOrderIDs).Pluck("id", &reviewOrderIDs).Error; err != nil {
		return fmt.Errorf("gagal ambil review orders: %w", err)
	}
	if len(reviewOrderIDs) > 0 {
		if err := tx.Where("review_order_id IN ?", reviewOrderIDs).Delete(&domain.ReviewAttachment{}).Error; err != nil {
			return fmt.Errorf("gagal hapus review attachments: %w", err)
		}
		if err := tx.Where("id IN ?", reviewOrderIDs).Delete(&domain.ReviewOrder{}).Error; err != nil {
			return fmt.Errorf("gagal hapus review orders: %w", err)
		}
	}

	var submissionIDs []uint
	if err := tx.Model(&domain.RepairSubmission{}).Where("repair_order_id IN ?", repairOrderIDs).Pluck("id", &submissionIDs).Error; err != nil {
		return fmt.Errorf("gagal ambil repair submissions: %w", err)
	}
	if len(submissionIDs) > 0 {
		if err := tx.Where("submission_id IN ?", submissionIDs).Delete(&domain.RepairEvidence{}).Error; err != nil {
			return fmt.Errorf("gagal hapus repair evidences: %w", err)
		}
		if err := tx.Where("id IN ?", submissionIDs).Delete(&domain.RepairSubmission{}).Error; err != nil {
			return fmt.Errorf("gagal hapus repair submissions: %w", err)
		}
	}

	if err := tx.Where("id IN ?", repairOrderIDs).Delete(&domain.RepairOrder{}).Error; err != nil {
		return fmt.Errorf("gagal hapus repair orders: %w", err)
	}
	return nil
}

func (s *approvalService) deleteInspectionChain(tx *gorm.DB, sarprasID uint) error {
	var inspectionIDs []uint
	if err := tx.Model(&domain.Inspection{}).Where("sarpras_id = ?", sarprasID).Pluck("id", &inspectionIDs).Error; err != nil {
		return fmt.Errorf("gagal ambil inspections: %w", err)
	}
	if len(inspectionIDs) > 0 {
		if err := tx.Where("inspection_id IN ?", inspectionIDs).Delete(&domain.InspectionItem{}).Error; err != nil {
			return fmt.Errorf("gagal hapus inspection items: %w", err)
		}
		if err := tx.Where("id IN ?", inspectionIDs).Delete(&domain.Inspection{}).Error; err != nil {
			return fmt.Errorf("gagal hapus inspections: %w", err)
		}
	}
	return nil
}

func (s *approvalService) deleteRemainingSarprasAssociations(tx *gorm.DB, sarprasID uint) error {
	if err := tx.Where("sarpras_id = ?", sarprasID).Delete(&domain.InspectionSchedule{}).Error; err != nil {
		return fmt.Errorf("gagal hapus inspection schedules: %w", err)
	}
	if err := tx.Where("sarpras_id = ?", sarprasID).Delete(&domain.RefillOrderItem{}).Error; err != nil {
		return fmt.Errorf("gagal hapus refill order items: %w", err)
	}
	if err := tx.Where("sarpras_id = ?", sarprasID).Delete(&domain.SarprasUsageLog{}).Error; err != nil {
		return fmt.Errorf("gagal hapus usage logs: %w", err)
	}
	return nil
}

func (s *approvalService) handleCreateSarprasApproval(ctx context.Context, tx *gorm.DB, data domain.Sarpras) error {
	lastCode, err := s.sarprasRepo.GetLatestCodeTx(tx, data.SarprasTypeID, data.LocationDeptID)
	if err != nil {
		return err
	}

	data.Code = s.generateNextCode(data.Code, lastCode)
	data.Status = domain.SarprasNotReady
	data.ID = 0

	if err := s.sarprasRepo.CreateTx(tx, &data); err != nil {
		return err
	}

	newSchedule := domain.InspectionSchedule{
		SarprasID: data.ID,
		CheckerID: nil,
		Status:    domain.SchedulePending,
		DueDate:   time.Now(),
	}

	if err := tx.Omit(clause.Associations).Create(&newSchedule).Error; err != nil {
		return err
	}

	sarprasName := "Sarpras Baru"
	if data.SarprasType.Name != "" {
		sarprasName = data.SarprasType.Name
	}

	go func() {
		errNotif := s.notifSvc.NotifyNewInspection(
			context.Background(),
			newSchedule.ID,
			data.Code,
			sarprasName,
			data.LocationDeptID,
			data.SarprasTypeID,
		)
		if errNotif != nil {
			fmt.Printf("⚠️ Gagal ngirim notif jadwal baru: %v\n", errNotif)
		}
	}()
	return nil
}

func (s *approvalService) handleBulkSarprasApproval(ctx context.Context, tx *gorm.DB, appr *domain.ApprovalRequest) error {
	var payload struct {
		Items []domain.BulkImportItemRequest `json:"items"`
	}
	if err := json.Unmarshal([]byte(appr.PayloadJSON), &payload); err != nil {
		return fmt.Errorf("gagal parse payload bulk import: %w", err)
	}

	total, err := s.sarprasService.ExecuteBulkImportInTx(ctx, tx, payload.Items, appr.RequestedBy)
	if err != nil {
		return err
	}

	_ = total
	return nil
}

func (s *approvalService) handleGenericApproval(tx *gorm.DB, appr *domain.ApprovalRequest, entity interface{}) error {
	if appr.Action != domain.ApprovalDelete {
		if err := json.Unmarshal([]byte(appr.PayloadJSON), entity); err != nil {
			return err
		}
	}

	switch appr.Action {
	case domain.ApprovalCreate:
		return tx.Omit("PICDept").Create(entity).Error
	case domain.ApprovalEdit:
		return s.handleGenericEdit(tx, appr, entity)
	case domain.ApprovalDelete:
		return tx.Delete(entity, appr.EntityID).Error
	default:
		return nil
	}
}

func (s *approvalService) handleDepartmentApproval(tx *gorm.DB, appr *domain.ApprovalRequest) error {
	var dept domain.Department

	fmt.Println("Payload JSON:", appr.PayloadJSON)
	if appr.Action != domain.ApprovalDelete {
		if err := json.Unmarshal([]byte(appr.PayloadJSON), &dept); err != nil {
			return err
		}

		fmt.Printf("Department after unmarshal: %+v\n", dept)
	}

	switch appr.Action {
	case domain.ApprovalCreate:
		return tx.Omit("Site").Create(&dept).Error
	case domain.ApprovalEdit:
		if appr.EntityID == nil {
			return fmt.Errorf("entity ID cannot be nil for edit action")
		}
		return tx.Model(&domain.Department{}).Where(id, *appr.EntityID).Omit("Site").Updates(&dept).Error
	case domain.ApprovalDelete:
		return tx.Delete(&domain.Department{}, appr.EntityID).Error
	default:
		return nil
	}
}

func (s *approvalService) handleGenericEdit(tx *gorm.DB, appr *domain.ApprovalRequest, entity interface{}) error {
	if appr.EntityID == nil {
		return fmt.Errorf("entity ID cannot be nil for edit action")
	}

	if st, ok := entity.(*domain.SarprasType); ok {
		return s.handleSarprasTypeEdit(tx, *appr.EntityID, st)
	}

	return tx.Model(entity).
		Where(id, *appr.EntityID).
		Omit("PICDept", "Parameters").
		Updates(entity).Error
}

func (s *approvalService) handleSarprasTypeEdit(tx *gorm.DB, entityID uint, st *domain.SarprasType) error {
	if err := tx.Model(st).
		Where(id, entityID).
		Select("Name", "InspIntervalMonths").
		Updates(st).Error; err != nil {
		return err
	}

	return s.syncSarprasTypeParameters(tx, entityID, st.Parameters)
}

func (s *approvalService) syncSarprasTypeParameters(tx *gorm.DB, parentID uint, parameters []domain.Parameter) error {
	if err := s.deleteOrphanedParameters(tx, parentID, parameters); err != nil {
		return err
	}
	return s.upsertParameters(tx, parentID, parameters)
}

func (s *approvalService) deleteOrphanedParameters(tx *gorm.DB, parentID uint, parameters []domain.Parameter) error {
	var incomingIDs []uint
	for _, p := range parameters {
		if p.ID != 0 {
			incomingIDs = append(incomingIDs, p.ID)
		}
	}

	deleteQuery := tx.Where("sarpras_type_id = ?", parentID)
	if len(incomingIDs) > 0 {
		deleteQuery = deleteQuery.Where("id NOT IN ?", incomingIDs)
	}

	return deleteQuery.Delete(&domain.Parameter{}).Error
}

func (s *approvalService) upsertParameters(tx *gorm.DB, parentID uint, parameters []domain.Parameter) error {
	for i := range parameters {
		parameters[i].SarprasTypeID = parentID

		if parameters[i].ID == 0 {
			if err := tx.Create(&parameters[i]).Error; err != nil {
				return err
			}
		} else {
			if err := tx.Model(&domain.Parameter{}).
				Where(id, parameters[i].ID).
				Select("Name", "Desc", "OrderNo").
				Updates(&parameters[i]).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *approvalService) generateNextCode(prefix string, lastCode string) string {
	nextSeq := 1
	if lastCode != "" {
		parts := strings.Split(lastCode, "-")
		if len(parts) > 0 {
			seq, _ := strconv.Atoi(parts[len(parts)-1])
			nextSeq = seq + 1
		}
	}
	return fmt.Sprintf("%s-%03d", prefix, nextSeq)
}
