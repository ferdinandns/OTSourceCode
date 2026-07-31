package master

import (
	"context"
	"encoding/json"
	"fmt"

	"emertrack/internal/audit"
	"emertrack/internal/domain"
	"emertrack/pkg/util"
	"emertrack/pkg/ws"

	"gorm.io/gorm"
)

// S and D are used as audit context strings for site and department operations.
const S = "Master Site"
const D = "Master Department"

type masterService struct {
	masterRepo domain.MasterRepository
	notifSvc   domain.NotificationService
	db         *gorm.DB
}

func NewMasterService(mr domain.MasterRepository, ns domain.NotificationService, db *gorm.DB) domain.MasterService {
	return &masterService{
		masterRepo: mr,
		notifSvc:   ns,
		db:         db,
	}
}

// --- SITES ---

func (s *masterService) RequestCreateSite(ctx context.Context, userID uint, req *domain.Site) (*domain.ApprovalRequest, error) {
	tx := s.db.WithContext(ctx).Begin()
	payload, _ := json.Marshal(req)

	approval := &domain.ApprovalRequest{
		EntityType:  "Site",
		EntityID:    nil,
		Action:      domain.ApprovalCreate,
		RequestedBy: userID,
		PayloadJSON: string(payload),
		Status:      domain.ApprovalPending,
	}

	if err := tx.Create(approval).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	msg := fmt.Sprintf("Request create new site: %s", req.Name)

	if err := audit.Record(tx, userID, "REQUEST_CREATE", S, msg, 0, req); err != nil {
		tx.Rollback()
		return nil, err
	}
	tx.Commit()
	go ws.BroadcastApprovalUpdated()
	_ = s.notifSvc.NotifyApprovers(ctx, userID,
		util.FormatEntityType("Site"), util.FormatAction("create"),
		req.Name, "", approval.ID)
	return approval, nil
}

func (s *masterService) RequestEditSite(ctx context.Context, userID, id uint, req *domain.Site) (*domain.ApprovalRequest, error) {
	tx := s.db.WithContext(ctx).Begin()

	safePayload := &domain.Site{
		Name: req.Name,
	}
	payloadBytes, _ := json.Marshal(safePayload)
	targetID := id

	approval := &domain.ApprovalRequest{
		EntityType:  "Site",
		EntityID:    &targetID,
		Action:      domain.ApprovalEdit,
		RequestedBy: userID,
		PayloadJSON: string(payloadBytes),
		Status:      domain.ApprovalPending,
	}

	if err := tx.Create(approval).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	msg := fmt.Sprintf("Request edit site: %s", req.Name)

	if err := audit.Record(tx, userID, "REQUEST_EDIT", S, msg, id, safePayload); err != nil {
		tx.Rollback()
		return nil, err
	}

	tx.Commit()
	go ws.BroadcastApprovalUpdated()
	_ = s.notifSvc.NotifyApprovers(ctx, userID,
		util.FormatEntityType("Site"), util.FormatAction("edit"),
		req.Name, "", approval.ID)
	return approval, nil
}

func (s *masterService) RequestDeleteSite(ctx context.Context, userID, id uint) (*domain.ApprovalRequest, error) {
	refs, err := s.masterRepo.CheckSiteReferences(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to check site references: %w", err)
	}
	if refs.HasReferences() {
		return nil, fmt.Errorf("%s", refs.Describe("site"))
	}

	tx := s.db.WithContext(ctx).Begin()

	target, err := s.masterRepo.FindByIdSite(ctx, id)
	if err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("Site not found: %w", err)
	}

	targetID := id

	approval := &domain.ApprovalRequest{
		EntityType:  "Site",
		EntityID:    &targetID,
		Action:      domain.ApprovalDelete,
		RequestedBy: userID,
		Status:      domain.ApprovalPending,
	}

	if err := tx.Create(approval).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	pBytes, _ := json.Marshal(target)
	approval.PayloadJSON = string(pBytes)

	msg := fmt.Sprintf("Request delete site: %s", target.Code)

	if err := audit.Record(tx, userID, "REQUEST_DELETE", S, msg, id, nil); err != nil {
		tx.Rollback()
		return nil, err
	}

	tx.Commit()
	go ws.BroadcastApprovalUpdated()
	_ = s.notifSvc.NotifyApprovers(ctx, userID,
		util.FormatEntityType("Site"), util.FormatAction("delete"),
		target.Code, "", approval.ID)
	return approval, nil
}

func (s *masterService) ListSites(ctx context.Context, filter map[string]interface{}) ([]domain.Site, error) {
	return s.masterRepo.ListSite(ctx, filter)
}

// --- DEPARTMENTS ---

func (s *masterService) RequestCreateDepartment(ctx context.Context, userID uint, req *domain.Department, notes string) (*domain.ApprovalRequest, error) {
	tx := s.db.WithContext(ctx).Begin()

	payloadMap := map[string]interface{}{
		"code":    req.Code,
		"name":    req.Name,
		"is_qs":   req.IsQs,
		"site_id": req.SiteID,
		"notes":   notes,
	}
	payload, _ := json.Marshal(payloadMap)

	approval := &domain.ApprovalRequest{
		EntityType:  "Department",
		EntityID:    nil,
		Action:      domain.ApprovalCreate,
		RequestedBy: userID,
		PayloadJSON: string(payload),
		Status:      domain.ApprovalPending,
		Notes:       notes,
	}

	if err := tx.Create(approval).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	msg := fmt.Sprintf("Request create department: %s", req.Name)

	if err := audit.Record(tx, userID, "REQUEST_CREATE", D, msg, 0, payloadMap); err != nil {
		tx.Rollback()
		return nil, err
	}
	tx.Commit()
	go ws.BroadcastApprovalUpdated()
	_ = s.notifSvc.NotifyApprovers(ctx, userID,
		util.FormatEntityType("Department"), util.FormatAction("create"),
		req.Name, "", approval.ID)
	return approval, nil
}

func (s *masterService) RequestEditDepartment(ctx context.Context, userID, id uint, req *domain.Department, notes string) (*domain.ApprovalRequest, error) {
	tx := s.db.WithContext(ctx).Begin()

	safePayload := map[string]interface{}{
		"name":    req.Name,
		"site_id": req.SiteID,
		"notes":   notes,
	}
	payloadBytes, _ := json.Marshal(safePayload)
	targetID := id

	approval := &domain.ApprovalRequest{
		EntityType:  "Department",
		EntityID:    &targetID,
		Action:      domain.ApprovalEdit,
		RequestedBy: userID,
		PayloadJSON: string(payloadBytes),
		Status:      domain.ApprovalPending,
		Notes:       notes,
	}

	if err := tx.Create(approval).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	msg := fmt.Sprintf("Request edit department: %s", req.Name)

	if err := audit.Record(tx, userID, "REQUEST_EDIT", D, msg, id, safePayload); err != nil {
		tx.Rollback()
		return nil, err
	}

	tx.Commit()
	go ws.BroadcastApprovalUpdated()
	_ = s.notifSvc.NotifyApprovers(ctx, userID,
		util.FormatEntityType("Department"), util.FormatAction("edit"),
		req.Name, "", approval.ID)
	return approval, nil
}

func (s *masterService) RequestDeleteDepartment(ctx context.Context, userID, id uint) (*domain.ApprovalRequest, error) {
	refs, err := s.masterRepo.CheckDepartmentReferences(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to check department references: %w", err)
	}
	if refs.HasReferences() {
		return nil, fmt.Errorf("%s", refs.Describe("department"))
	}

	tx := s.db.WithContext(ctx).Begin()

	target, err := s.masterRepo.FindByIdDepartment(ctx, id)
	if err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("Department not found: %w", err)
	}

	targetID := id

	approval := &domain.ApprovalRequest{
		EntityType:  "Department",
		EntityID:    &targetID,
		Action:      domain.ApprovalDelete,
		RequestedBy: userID,
		Status:      domain.ApprovalPending,
	}

	pBytes, _ := json.Marshal(target)
	approval.PayloadJSON = string(pBytes)

	if err := tx.Create(approval).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	msg := fmt.Sprintf("Request delete department: %s", target.Name)

	if err := audit.Record(tx, userID, "REQUEST_DELETE", D, msg, id, nil); err != nil {
		tx.Rollback()
		return nil, err
	}
	tx.Commit()
	go ws.BroadcastApprovalUpdated()
	_ = s.notifSvc.NotifyApprovers(ctx, userID,
		util.FormatEntityType("Department"), util.FormatAction("delete"),
		target.Name, "", approval.ID)
	return approval, nil
}

func (s *masterService) ListDepartments(ctx context.Context, filter map[string]interface{}) ([]domain.DepartmentRow, error) {
	return s.masterRepo.ListDepartment(ctx, filter)
}
