package sarpras

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"mime/multipart"
	"os"
	"strings"
	"time"

	"emertrack/internal/approval"
	"emertrack/internal/audit"
	"emertrack/internal/domain"
	pdf "emertrack/pkg/pdf"
	"emertrack/pkg/qrcode"
	"emertrack/pkg/util"
	"emertrack/pkg/ws"

	"gorm.io/gorm"
)

const MST = "Master Sarpras Type"
const MS = "Master Sarpras"
const row = "baris %d: %w"

type sarprasService struct {
	sarprasTypeRepo domain.SarprasTypeRepository
	sarprasRepo     domain.SarprasRepository
	masterRepo      domain.MasterRepository
	approvalRepo    domain.ApprovalRepository
	notifService    domain.NotificationService
	db              *gorm.DB
	queryHelper     *sarprasQueryHelper
}

func NewSarprasService(
	stRepo domain.SarprasTypeRepository,
	sRepo domain.SarprasRepository,
	mRepo domain.MasterRepository,
	aRepo domain.ApprovalRepository,
	nServ domain.NotificationService,
	db *gorm.DB,
) domain.SarprasService {
	return &sarprasService{
		sarprasTypeRepo: stRepo,
		sarprasRepo:     sRepo,
		masterRepo:      mRepo,
		approvalRepo:    aRepo,
		notifService:    nServ,
		db:              db,
		queryHelper:     newSarprasQueryHelper(db),
	}
}

// submitApproval is a shared helper (unchanged logic, kept for completeness).
func (s *sarprasService) submitApproval(
	ctx context.Context,
	userID uint,
	apr *domain.ApprovalRequest,
	auditMeta domain.AuditMeta,
) (*domain.ApprovalResponse, error) {
	tx := s.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}

	if err := s.approvalRepo.CreateTx(ctx, tx, apr); err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := audit.Record(tx, userID,
		auditMeta.Action, auditMeta.Menu, auditMeta.Message,
		auditMeta.EntityID, auditMeta.Payload,
	); err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	go ws.BroadcastSarprasUpdated()
	go ws.BroadcastApprovalUpdated()

	identifier := "-"
	if payloadMap, ok := auditMeta.Payload.(map[string]interface{}); ok {
		if code, exists := payloadMap["code"]; exists && code != "" {
			identifier = fmt.Sprintf("%v", code)
		} else if name, exists := payloadMap["name"]; exists && name != "" {
			identifier = fmt.Sprintf("%v", name)
		}
	}

	if apr.EntityType != "SarprasBulk" {
		if err := s.notifService.NotifyApprovers(
			ctx, userID,
			util.FormatEntityType(apr.EntityType), util.FormatAction(string(apr.Action)),
			identifier, apr.Notes, apr.ID,
		); err != nil {
			fmt.Printf("Warning: failed to send notifications: %v\n", err)
		}
	}

	result, err := s.approvalRepo.FindByID(ctx, apr.ID)
	if err != nil {
		return nil, err
	}

	res := approval.MapToResponse(result)
	return &res, nil
}

// ─── SARPRAS TYPE ─────────────────────────────────────────────────────────────

func (s *sarprasService) RequestCreateSarprasType(ctx context.Context, userID uint, req *domain.SarprasType, notes string) (*domain.ApprovalResponse, error) {
	var fieldErrs domain.FieldErrors

	existingByCode, err := s.sarprasTypeRepo.FindByCode(ctx, req.Code)
	if err != nil && existingByCode != nil {
		fieldErrs = append(fieldErrs, domain.NewFieldError("code", fmt.Sprintf("Kode %s sudah digunakan", req.Code)))
	}

	existingByName, err := s.sarprasTypeRepo.FindByName(ctx, req.Name)
	if err != nil && existingByName != nil {
		fieldErrs = append(fieldErrs, domain.NewFieldError("name", fmt.Sprintf("Nam %s sudah digunakan", req.Name)))
	}

	if len(fieldErrs) > 0 {
		return nil, fieldErrs
	}

	picDept, err := s.masterRepo.FindByIdDepartment(ctx, req.PICDeptID)
	if err != nil {
		return nil, fmt.Errorf("PIC department not found: %w", err)
	}

	payload := map[string]interface{}{
		"code":                 req.Code,
		"name":                 req.Name,
		"is_apar":              req.IsAPAR,
		"pic_dept_id":          req.PICDeptID,
		"pic_dept_code":        picDept.Code,
		"pic_dept_name":        picDept.Name,
		"insp_interval_months": req.InspIntervalMonths,
		"expiry_param_id":      req.ExpiryParamID,
		"parameters":           req.Parameters,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf(FAILED_SERIALIZE_PAYLOAD, err)
	}

	apr := &domain.ApprovalRequest{
		EntityType:  "SarprasType",
		EntityID:    nil,
		Action:      domain.ApprovalCreate,
		RequestedBy: userID,
		PayloadJSON: string(payloadBytes),
		Status:      domain.ApprovalPending,
		Notes:       notes,
	}

	msg := fmt.Sprintf("Request Tambah jenis sarpras: %s", req.Name)
	return s.submitApproval(ctx, userID, apr, domain.AuditMeta{
		Action:   "REQUEST_CREATE",
		Menu:     MST,
		Message:  msg,
		EntityID: 0,
		Payload:  payload,
	})
}

func (s *sarprasService) RequestEditSarprasType(ctx context.Context, userID, id uint, req *domain.SarprasType, notes string) (*domain.ApprovalResponse, error) {
	payload := map[string]interface{}{
		"id":                   id,
		"name":                 req.Name,
		"insp_interval_months": req.InspIntervalMonths,
		"expiry_param_id":      req.ExpiryParamID,
		"parameters":           req.Parameters,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf(FAILED_SERIALIZE_PAYLOAD, err)
	}

	stID := id
	apr := &domain.ApprovalRequest{
		EntityType:  "SarprasType",
		EntityID:    &stID,
		Action:      domain.ApprovalEdit,
		RequestedBy: userID,
		PayloadJSON: string(payloadBytes),
		Status:      domain.ApprovalPending,
		Notes:       notes,
	}

	msg := fmt.Sprintf("Request Ubah jenis sarpras: %s", req.Name)
	return s.submitApproval(ctx, userID, apr, domain.AuditMeta{
		Action:   "REQUEST_EDIT",
		Menu:     MST,
		Message:  msg,
		EntityID: id,
		Payload:  payload,
	})
}

func (s *sarprasService) RequestDeleteSarprasType(ctx context.Context, userID, id uint, notes string) (*domain.ApprovalResponse, error) {
	target, err := s.sarprasTypeRepo.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("sarpras type not found: %w", err)
	}

	payload := map[string]interface{}{
		"code": target.Code,
		"name": target.Name,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf(FAILED_SERIALIZE_PAYLOAD, err)
	}

	stID := id
	apr := &domain.ApprovalRequest{
		EntityType:  "SarprasType",
		EntityID:    &stID,
		Action:      domain.ApprovalDelete,
		RequestedBy: userID,
		PayloadJSON: string(payloadBytes),
		Status:      domain.ApprovalPending,
		Notes:       notes,
	}

	msg := fmt.Sprintf("Request Hapus jenis sarpras: %s", target.Code)
	return s.submitApproval(ctx, userID, apr, domain.AuditMeta{
		Action:   "REQUEST_DELETE",
		Menu:     MST,
		Message:  msg,
		EntityID: id,
		Payload:  payload,
	})
}

func (s *sarprasService) GetSarprasTypeDetail(ctx context.Context, id uint) (*domain.SarprasTypeDetail, error) {
	data, err := s.sarprasTypeRepo.Detail(ctx, id)
	if err != nil {
		return nil, err
	}
	if data == nil {
		return nil, errors.New("sarpras type not found")
	}
	return data, nil
}

func (s *sarprasService) ListSarprasTypes(ctx context.Context, filter map[string]interface{}) ([]domain.SarprasTypeRow, error) {
	return s.sarprasTypeRepo.List(ctx, filter)
}

// ─── SARPRAS ──────────────────────────────────────────────────────────────────

func (s *sarprasService) RequestCreateSarpras(ctx context.Context, userID uint, req *domain.Sarpras, notes string) (*domain.ApprovalResponse, error) {

	defaultSiteID, err := s.queryHelper.getDefaultSiteID(ctx)
	if err != nil {
		return nil, err
	}
	// Set otomatis ke entity domain sarpras
	req.SiteID = defaultSiteID
	st, err := s.sarprasTypeRepo.FindByID(ctx, req.SarprasTypeID)
	if err != nil {
		return nil, fmt.Errorf("sarpras type not found: %w", err)
	}
	if st.PICDeptID == 0 {
		return nil, fmt.Errorf("Sarpras Type '%s' doesn't have PIC's department", st.Name)
	}

	locDept, err := s.masterRepo.FindByIdDepartment(ctx, req.LocationDeptID)
	if err != nil {
		return nil, fmt.Errorf("Location Department not found: %w", err)
	}

	picDept, err := s.masterRepo.FindByIdDepartment(ctx, st.PICDeptID)
	if err != nil {
		return nil, fmt.Errorf("PIC department not found: %w", err)
	}

	if req.ExpiredDate != nil {
		now := time.Now()

		today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		expired := time.Date(
			req.ExpiredDate.Year(),
			req.ExpiredDate.Month(),
			req.ExpiredDate.Day(),
			0, 0, 0, 0,
			req.ExpiredDate.Location(),
		)

		if expired.Before(today) {
			return nil, errors.New("expired date cannot be in the past")
		}
	}

	req.RiskScore = domain.CalculateRiskScore(*req)
	req.RiskLevel = domain.ResolveRiskLevel(req.RiskScore)

	generatedCode := fmt.Sprintf("%s-%s-%s", st.Code, locDept.Code, picDept.Code)

	payload := map[string]interface{}{
		"code":               generatedCode,
		"sarpras_type_id":    req.SarprasTypeID,
		"sarpras_type__name": st.Name,
		"location_dept_id":   req.LocationDeptID,
		"location_dept_name": locDept.Name,
		"location_detail":    req.LocationDetail,
		"site_id":            req.SiteID,
		"risk_level":         req.RiskLevel,
		"risk_score":         req.RiskScore,
		"expired_date":       req.ExpiredDate,
		"is_critical":        req.IsCritical,
		"has_alternative":    req.HasAlternative,
		"has_risk_location":  req.HasRiskLocation,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf(FAILED_SERIALIZE_PAYLOAD, err)
	}

	apr := &domain.ApprovalRequest{
		EntityType:  "Sarpras",
		Action:      domain.ApprovalCreate,
		RequestedBy: userID,
		PayloadJSON: string(payloadBytes),
		Status:      domain.ApprovalPending,
		Notes:       notes,
	}

	msg := fmt.Sprintf("Request Tambah sarpras: %s", generatedCode)
	return s.submitApproval(ctx, userID, apr, domain.AuditMeta{
		Action:   "REQUEST_CREATE",
		Menu:     MS,
		Message:  msg,
		EntityID: 0,
		Payload:  payload,
	})
}

func (s *sarprasService) RequestEditSarpras(ctx context.Context, userID, id uint, req *domain.Sarpras, notes string) (*domain.ApprovalResponse, error) {
	target, err := s.sarprasRepo.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("sarpras not found: %w", err)
	}

	payload := map[string]interface{}{
		"code":                target.Code,
		"old_location_detail": target.LocationDetail,
		"new_location_detail": req.LocationDetail,
		"risk_level":          target.RiskLevel,
		"risk_score":          target.RiskScore,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf(FAILED_SERIALIZE_PAYLOAD, err)
	}

	sID := id
	apr := &domain.ApprovalRequest{
		EntityType:  "Sarpras",
		EntityID:    &sID,
		Action:      domain.ApprovalEdit,
		RequestedBy: userID,
		PayloadJSON: string(payloadBytes),
		Status:      domain.ApprovalPending,
		Notes:       notes,
	}

	msg := fmt.Sprintf("Request Ubah sarpras: %s", target.Code)
	return s.submitApproval(ctx, userID, apr, domain.AuditMeta{
		Action:   "REQUEST_EDIT",
		Menu:     MS,
		Message:  msg,
		EntityID: id,
		Payload:  payload,
	})
}

func (s *sarprasService) RequestDeleteSarpras(ctx context.Context, userID, id uint, notes string) (*domain.ApprovalResponse, error) {
	target, err := s.sarprasRepo.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("sarpras not found: %w", err)
	}

	payload := map[string]interface{}{
		"code":            target.Code,
		"location_detail": target.LocationDetail,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf(FAILED_SERIALIZE_PAYLOAD, err)
	}

	sID := id
	apr := &domain.ApprovalRequest{
		EntityType:  "Sarpras",
		EntityID:    &sID,
		Action:      domain.ApprovalDelete,
		RequestedBy: userID,
		PayloadJSON: string(payloadBytes),
		Status:      domain.ApprovalPending,
		Notes:       notes,
	}

	msg := fmt.Sprintf("Request Hapus sarpras: %s", target.Code)
	return s.submitApproval(ctx, userID, apr, domain.AuditMeta{
		Action:   "REQUEST_DELETE",
		Menu:     MS,
		Message:  msg,
		EntityID: id,
		Payload:  payload,
	})
}

func (s *sarprasService) GetSarpras(ctx context.Context, id uint) (*domain.Sarpras, error) {
	return s.sarprasRepo.FindByID(ctx, id)
}

func (s *sarprasService) GetSarprasDetail(ctx context.Context, code string) (*domain.SarprasDetailResponse, error) {
	data, err := s.sarprasRepo.FindByCode(ctx, code)
	if err != nil {
		return nil, err
	}

	checker, err := s.sarprasRepo.GetLastChecker(ctx, data.ID)
	if err != nil {
		checker = "-"
	}

	base := os.Getenv("FRONTEND_BASE_URL")
	if base == "" {
		base = "http://localhost:3000"
	}
	base = strings.TrimRight(base, "/")
	qrContent := fmt.Sprintf("%s/list-sarpras/%s", base, data.Code)
	qrBase64, err := qrcode.GenerateBase64(qrContent)
	if err != nil {
		return nil, fmt.Errorf("failed to generate QR code: %w", err)
	}

	return &domain.SarprasDetailResponse{
		ID:                data.ID,
		Code:              data.Code,
		Name:              data.SarprasType.Name,
		Status:            string(data.Status),
		RiskLevel:         string(data.RiskLevel),
		Type:              data.SarprasType.Name,
		SerialNumber:      data.Code,
		Site:              data.LocationDept.Site.Name,
		Department:        data.LocationDept.Name,
		Location:          data.LocationDetail,
		Pemeriksa:         checker,
		PICResponsibility: data.SarprasType.PICDept.Name,
		LastInspected:     data.LastInspected,
		NextDueDate:       data.DueDate,
		// ── ADDED: surface the interval in months ──
		InspIntervalMonths: data.SarprasType.InspIntervalMonths,
		QRCode:             "data:image/png;base64," + qrBase64,
	}, nil
}

func (s *sarprasService) ListSarpras(ctx context.Context, filter domain.SarprasFilter) ([]domain.SarprasRow, int64, error) {
	return s.sarprasRepo.List(ctx, filter)
}

func (s *sarprasService) GetByQRCode(ctx context.Context, code string) (*domain.Sarpras, error) {
	return s.sarprasRepo.FindByCode(ctx, code)
}

func (s *sarprasService) GenerateQRCode(ctx context.Context, sarprasID uint) ([]byte, error) {
	return []byte("qr-code-bytes-placeholder"), nil
}

// Export PDF
func (s *sarprasService) ExportPDF(ctx context.Context, userID uint, filter domain.ExportSarprasPDFRequest) ([]byte, error) {
	pdfFilter := domain.SarprasFilter{
		SarprasTypeID:  filter.SarprasTypeID,
		LocationDeptID: filter.LocationDeptID,
		ExportMode:     true,
		SortBy:         filter.SortBy,
		SortOrder:      filter.SortOrder,
	}

	items, _, err := s.sarprasRepo.List(ctx, pdfFilter)
	if err != nil {
		return nil, err
	}

	printerName := "System"
	if name, err := s.queryHelper.getUserFullName(ctx, userID); err == nil {
		printerName = name
	}

	deptName := "Semua Departemen"
	typeName := "Semua Jenis Sarpras"
	if filter.LocationDeptID != nil && len(items) > 0 {
		deptName = items[0].LocationDeptName
	}
	if filter.SarprasTypeID != nil && len(items) > 0 {
		typeName = items[0].SarprasTypeName
	}

	// Ambil nama site default
	var site domain.Site
	if err := s.db.WithContext(ctx).First(&site).Error; err != nil {
		return nil, fmt.Errorf("gagal membaca data site: %w", err)
	}

	return pdf.GenerateSarprasReport(pdf.SarprasReportParams{
		Items:       items,
		PrinterName: printerName,
		DeptName:    deptName,
		TypeName:    typeName,
		SiteName:    site.Name,
		SortBy:      filter.SortBy,
		SortOrder:   filter.SortOrder,
	})
}

func (s *sarprasService) UpdateStatusExpiry(ctx context.Context) error {
	return s.sarprasRepo.UpdateStatusByExpiry(ctx)
}

// parseBulkImportRows iterates over the non‑empty Excel rows and returns the
// parsed rows together with initial valid/error counts.
func (s *sarprasService) parseBulkImportRows(
	ctx context.Context,
	excelData *bulkImportExcelData,
	defaultSiteCode string,
	typeCache map[string]*domain.SarprasType,
	deptCache map[string]*domain.Department,
) ([]domain.BulkParseRow, int, int) {
	var result []domain.BulkParseRow
	validCount, errorCount := 0, 0

	for _, entry := range excelData.nonEmpty {
		row := s.parseBulkImportRow(ctx, entry, defaultSiteCode, excelData.colIdx, typeCache, deptCache)
		result = append(result, row)
		if row.Valid {
			validCount++
		} else {
			errorCount++
		}
	}
	return result, validCount, errorCount
}

// enforceAparExpiryRule marks rows invalid when they contain an expired_date
// for a non‑APAR/APAB type, and returns the updated valid/error counts.
func (s *sarprasService) enforceAparExpiryRule(
	rows []domain.BulkParseRow,
	typeCache map[string]*domain.SarprasType,
) (int, int) {
	validCount, errorCount := 0, 0
	for i := range rows {
		row := &rows[i]
		if !row.Valid {
			errorCount++
			continue
		}
		if row.ExpiredDate == "" {
			validCount++
			continue
		}
		codeUpper := strings.ToUpper(row.SarprasTypeCode)
		st, ok := typeCache[codeUpper]
		if !ok {
			row.Valid = false
			row.Errors = append(row.Errors, fmt.Sprintf("jenis sarpras '%s' tidak dikenali", row.SarprasTypeCode))
			errorCount++
			continue
		}
		if !st.IsAPAR {
			row.Valid = false
			row.Errors = append(row.Errors, "Tanggal kadaluarsa hanya diizinkan untuk jenis APAR / APAB")
			errorCount++
			continue
		}
		validCount++
	}
	return validCount, errorCount
}

func (s *sarprasService) BulkImportParse(
	ctx context.Context,
	file multipart.File,
	header *multipart.FileHeader,
) (*domain.BulkParseResponse, error) {
	excelData, closeFile, err := loadBulkImportExcel(file, header)
	if err != nil {
		return nil, err
	}
	defer closeFile()

	defaultSiteCode, err := s.requireSingleDefaultSiteCode(ctx)
	if err != nil {
		return nil, err
	}

	typeCache := map[string]*domain.SarprasType{}
	deptCache := map[string]*domain.Department{}

	rows, validCount, errorCount := s.parseBulkImportRows(ctx, excelData, defaultSiteCode, typeCache, deptCache)

	validCount, errorCount = s.enforceAparExpiryRule(rows, typeCache)

	return &domain.BulkParseResponse{
		TotalRows: len(rows),
		ValidRows: validCount,
		ErrorRows: errorCount,
		AllValid:  errorCount == 0,
		Rows:      rows,
	}, nil
}

// =============================================================================
// Service — Validate (master DB check)
// =============================================================================

func (s *sarprasService) BulkImportValidate(
	ctx context.Context,
	req domain.BulkExecuteRequest,
) (*domain.BulkValidateResponse, error) {
	cache := newBulkImportMasterCache()
	defaultSiteCode := s.getBulkValidateDefaultSiteCode(ctx)

	var rowErrors []bulkValidateRowError
	for _, item := range req.Items {
		if errs := s.validateBulkImportItem(ctx, item, defaultSiteCode, cache); len(errs) > 0 {
			rowErrors = append(rowErrors, bulkValidateRowError{Row: item.Row, Errors: errs})
		}
	}

	// Additional validation: expired_date only allowed for APAR/APAB types
	typeCache := map[string]*domain.SarprasType{}
	for _, item := range req.Items {
		if item.ExpiredDate != nil && *item.ExpiredDate != "" {
			st, err := s.getSarprasType(ctx, item.SarprasTypeCode, typeCache)
			if err == nil && st != nil && !st.IsAPAR {
				rowErrors = append(rowErrors, bulkValidateRowError{
					Row:    item.Row,
					Errors: []string{"Jenis Sarpras yang bukan APAR / APAB tidak perlu mengisi"},
				})
			}
		}
	}

	return buildBulkValidateResponse(req.Items, rowErrors), nil
}

// =============================================================================
// Service — Execute
// =============================================================================

func (s *sarprasService) RequestCreateSarprasImport(ctx context.Context, userID uint, req domain.BulkExecuteRequest, notes string) (*domain.ApprovalResponse, error) {
	// Validasi awal (agar user langsung tahu error sebelum masuk approval)
	valRes, err := s.BulkImportValidate(ctx, req)
	if err != nil {
		return nil, err
	}
	if !valRes.Valid {
		return nil, fmt.Errorf("terdapat %d baris tidak valid. Perbaiki dan upload ulang", valRes.ErrorRows)
	}

	// Payload berisi seluruh items (tanpa notes karena notes approval sudah terpisah)
	payload := map[string]interface{}{
		"items": req.Items,
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("gagal serialize payload bulk import: %w", err)
	}

	apr := &domain.ApprovalRequest{
		EntityType:  "SarprasBulk",
		EntityID:    nil,
		Action:      domain.ApprovalCreate,
		RequestedBy: userID,
		PayloadJSON: string(payloadBytes),
		Status:      domain.ApprovalPending,
		Notes:       notes,
	}

	msg := fmt.Sprintf("Request %s %s (Via Excel) total: %d item", domain.RequestCreateDesc, domain.MenuSarpras, len(req.Items))
	res, err := s.submitApproval(ctx, userID, apr, domain.AuditMeta{
		Action:   "REQUEST_CREATE",
		Menu:     string(domain.MenuSarpras),
		Message:  msg,
		EntityID: 0,
		Payload:  payload,
	})
	if err != nil {
		return nil, err
	}

	if err := s.notifService.NotifyApproversForBulk(ctx, userID, len(req.Items), notes, apr.ID); err != nil {
		fmt.Printf("Warning: failed to send bulk notifications: %v\n", err)
	}

	return res, nil
}

func (s *sarprasService) ExecuteBulkImportInTx(ctx context.Context, tx *gorm.DB, items []domain.BulkImportItemRequest, userID uint) (int, error) {
	// Ambil default site (hanya satu)
	var defaultSite domain.Site
	if err := tx.First(&defaultSite).Error; err != nil {
		return 0, fmt.Errorf("tidak ada data site di database: %w", err)
	}

	typeCache := map[string]*domain.SarprasType{}
	deptCache := map[string]*domain.Department{}
	picDeptCache := map[uint]*domain.Department{}
	totalInserted := 0

	for _, item := range items {
		st, err := s.getSarprasType(ctx, item.SarprasTypeCode, typeCache)
		if err != nil {
			return totalInserted, fmt.Errorf(row, item.Row, err)
		}

		dept, err := s.getDepartment(ctx, item.LocationDeptCode, deptCache)
		if err != nil {
			return totalInserted, fmt.Errorf(row, item.Row, err)
		}

		picDept, err := s.getDepartmentByID(ctx, st.PICDeptID, picDeptCache)
		if err != nil {
			return totalInserted, fmt.Errorf(row, item.Row, err)
		}

		newCode, err := s.generateCode(ctx, tx, st, dept, picDept)
		if err != nil {
			return totalInserted, fmt.Errorf(row, item.Row, err)
		}

		sarpras := s.buildSarpras(item, st, dept, defaultSite, newCode)
		if err := s.sarprasRepo.CreateTx(tx, &sarpras); err != nil {
			return totalInserted, fmt.Errorf("baris %d: gagal insert sarpras: %w", item.Row, err)
		}

		schedule := domain.InspectionSchedule{
			SarprasID: sarpras.ID,
			Status:    domain.SchedulePending,
			DueDate:   time.Now(),
		}
		if err := tx.Omit("Sarpras").Create(&schedule).Error; err != nil {
			return totalInserted, fmt.Errorf("baris %d: gagal buat jadwal inspeksi: %w", item.Row, err)
		}

		totalInserted++
	}

	return totalInserted, nil
}

func (s *sarprasService) GetTemplateMetadata(ctx context.Context) ([]domain.SarprasTypeRow, []domain.DepartmentRow, error) {
	typeRows, err := s.sarprasTypeRepo.List(ctx, map[string]interface{}{})
	if err != nil {
		return nil, nil, fmt.Errorf("gagal ambil data jenis sarpras: %w", err)
	}

	deptRows, err := s.masterRepo.ListDepartment(ctx, map[string]interface{}{})
	if err != nil {
		return nil, nil, fmt.Errorf("gagal ambil data departemen: %w", err)
	}

	return typeRows, deptRows, nil
}

// ---------- helpers ----------

func (s *sarprasService) getSarprasType(ctx context.Context, code string, cache map[string]*domain.SarprasType) (*domain.SarprasType, error) {
	key := strings.ToUpper(code)
	if st, ok := cache[key]; ok {
		return st, nil
	}
	st, err := s.sarprasTypeRepo.FindByCode(ctx, key)
	if err != nil || st == nil {
		return nil, fmt.Errorf("jenis sarpras '%s' tidak ditemukan", code)
	}
	cache[key] = st
	return st, nil
}

func (s *sarprasService) getDepartment(ctx context.Context, code string, cache map[string]*domain.Department) (*domain.Department, error) {
	key := strings.ToUpper(code)
	if dept, ok := cache[key]; ok {
		return dept, nil
	}
	dept, err := s.masterRepo.FindByCodeDepartment(ctx, key)
	if err != nil || dept == nil {
		return nil, fmt.Errorf("departemen '%s' tidak ditemukan", code)
	}
	cache[key] = dept
	return dept, nil
}

func (s *sarprasService) getDepartmentByID(ctx context.Context, id uint, cache map[uint]*domain.Department) (*domain.Department, error) {
	if dept, ok := cache[id]; ok {
		return dept, nil
	}
	dept, err := s.masterRepo.FindByIdDepartment(ctx, id)
	if err != nil || dept == nil {
		return nil, fmt.Errorf("PIC department (ID %d) tidak ditemukan", id)
	}
	cache[id] = dept
	return dept, nil
}

func (s *sarprasService) generateCode(ctx context.Context, tx *gorm.DB, st *domain.SarprasType, dept, picDept *domain.Department) (string, error) {
	prefix := fmt.Sprintf("%s-%s-%s", st.Code, dept.Code, picDept.Code)

	maxNum, err := s.queryHelper.getNextSarprasSequence(tx, st.ID, dept.ID, prefix)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("%s-%03d", prefix, maxNum+1), nil
}

func (s *sarprasService) buildSarpras(item domain.BulkImportItemRequest, st *domain.SarprasType, dept *domain.Department, defaultSite domain.Site, code string) domain.Sarpras {
	sarpras := domain.Sarpras{
		SarprasTypeID:   st.ID,
		LocationDeptID:  dept.ID,
		SiteID:          defaultSite.ID,
		LocationDetail:  strings.TrimSpace(item.LocationDetail),
		IsCritical:      item.IsCritical,
		HasAlternative:  item.HasAlternative,
		HasRiskLocation: item.HasRiskLocation,
		Status:          domain.SarprasNotReady,
		Code:            code,
	}
	sarpras.RiskScore = domain.CalculateRiskScore(sarpras)
	sarpras.RiskLevel = domain.ResolveRiskLevel(sarpras.RiskScore)

	if item.ExpiredDate != nil && *item.ExpiredDate != "" {
		if t, err := time.Parse("2006-01-02", *item.ExpiredDate); err == nil {
			sarpras.ExpiredDate = &t
		}
	}
	return sarpras
}

func (s *sarprasService) CheckEligibility(ctx context.Context, userID uint, code string) (*domain.CheckerEligibility, error) {
	// 1. Get sarpras data
	sarpras, err := s.sarprasRepo.FindByCode(ctx, code)
	if err != nil {
		return nil, err
	}

	// 2. Get user department
	userDeptID, err := s.queryHelper.getUserDepartmentID(ctx, userID)
	if err != nil {
		return nil, err
	}

	// 3. Department must match
	if userDeptID != sarpras.LocationDeptID {
		return &domain.CheckerEligibility{Eligible: false, Reason: "dept_mismatch", Message: "Anda tidak memiliki akses untuk memeriksa sarpras ini (beda departemen)"}, nil
	}

	// 4. Check checker assignment for this sarpras type
	assigned, err := s.queryHelper.isCheckerAssigned(ctx, userID, sarpras.SarprasTypeID)
	if err != nil {
		return nil, err
	}
	if !assigned {
		return &domain.CheckerEligibility{Eligible: false, Reason: "type_not_assigned", Message: "Anda tidak terdaftar untuk memeriksa jenis sarpras ini"}, nil
	}

	// 5. Retrieve active schedule
	scheduleID, err := s.queryHelper.getActiveScheduleID(ctx, sarpras.ID)
	if err != nil {
		return nil, err
	}
	if scheduleID == 0 {
		return &domain.CheckerEligibility{Eligible: false, Reason: "no_schedule", Message: "Belum ada jadwal pemeriksaan yang aktif untuk sarpras ini"}, nil
	}

	// 6. H-10 rule
	now := time.Now()
	var isDue bool
	if sarpras.DueDate == nil {
		isDue = true
	} else {
		isDue = now.After(*sarpras.DueDate) || sarpras.DueDate.Sub(now).Hours() <= 240
	}

	return &domain.CheckerEligibility{
		Eligible:   true,
		IsDue:      isDue,
		SarprasID:  sarpras.ID,
		ScheduleID: scheduleID,
	}, nil
}
