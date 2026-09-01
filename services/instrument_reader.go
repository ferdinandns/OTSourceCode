package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"lab-connect/backend-api/database"
	"lab-connect/backend-api/models"
	"lab-connect/backend-api/structs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"gorm.io/gorm"
)

// batchPDFColDef defines one column in the pdf_columns configuration.
// The Regex field is optional — only used in Mode B (multi-line block extraction).
type batchPDFColDef struct {
	Key     string `json:"key"`
	Regex   string `json:"regex"` // per-column extraction pattern (Mode B only)
	Enabled bool   `json:"enabled"`
}

type InstrumentReaderService struct {
	db            *gorm.DB
	serialReader  *SerialReaderService
	tcpReader     *TCPReaderService
	tibboReader   *TibboReaderService
	instrumentSvc *InstrumentService
	pdfGenerator  *PDFGeneratorService
}

func NewInstrumentReaderService(
	serialReader *SerialReaderService,
	tcpReader *TCPReaderService,
	tibboReader *TibboReaderService,
	pdfGenerator *PDFGeneratorService,
) *InstrumentReaderService {
	return &InstrumentReaderService{
		db:            database.DB,
		serialReader:  serialReader,
		tcpReader:     tcpReader,
		tibboReader:   tibboReader,
		instrumentSvc: NewInstrumentService(),
		pdfGenerator:  pdfGenerator,
	}
}

// ============================================
// READ INSTRUMENT PROCESS (Section 4.3 - 4.9)
// ============================================

// StartReadProcess - Section 4.3
func (s *InstrumentReaderService) StartReadProcess(req structs.StartReadRequest, userID uint) (*structs.StartReadResponse, error) {
	// Validate instrument status
	available, status, err := s.instrumentSvc.CheckInstrumentAvailability(req.InstrumentID)
	if err != nil {
		return nil, err
	}

	if !available {
		return nil, fmt.Errorf("instrument is not available. Current status: %s", status)
	}

	// Validate initial condition
	isValid, err := s.instrumentSvc.ValidateInitialCondition(req.InstrumentID, req.InitialCondition)
	if err != nil {
		return nil, err
	}

	if !isValid {
		// Update status to Unavailable
		s.instrumentSvc.UpdateInstrumentStatus(req.InstrumentID, "Unavailable")
		return nil, errors.New("instrument initial condition is not valid. Status changed to Unavailable")
	}

	// Convert initial condition to JSON
	initialConditionJSON, err := json.Marshal(req.InitialCondition)
	if err != nil {
		return nil, err
	}

	// Convert additional data to JSON
	additionalDataJSON, err := json.Marshal(req.AdditionalData)
	if err != nil {
		return nil, err
	}

	// Convert sampel to JSON array
	sampelJSON, err := json.Marshal(req.Sampel)
	if err != nil {
		return nil, err
	}

	// Convert NoQCBatch to JSON array
	noQCBatchJSON, err := json.Marshal(req.NoQCBatch)
	if err != nil {
		return nil, err
	}

	// Calculate total items
	totalItems := 0
	for _, batch := range req.NoQCBatch {
		totalItems += batch.JumlahItem
	}

	// Create usage record
	usage := models.InstrumentUsage{
		InstrumentID:     req.InstrumentID,
		UserID:           userID,
		StartTime:        time.Now(),
		KategoriSampel:   req.KategoriSampel,
		Sampel:           string(sampelJSON),
		NoQCBatch:        string(noQCBatchJSON),
		JumlahItem:       totalItems,
		InitialCondition: string(initialConditionJSON),
		AdditionalData:   string(additionalDataJSON),
		StatusPenggunaan: "Read Process",
		IsExported:       false,
	}

	if err := s.db.Create(&usage).Error; err != nil {
		return nil, err
	}

	// Update instrument status to "In Used"
	if err := s.instrumentSvc.UpdateInstrumentStatus(req.InstrumentID, "In Used"); err != nil {
		return nil, err
	}

	return &structs.StartReadResponse{
		UsageID:          usage.Id,
		InstrumentID:     req.InstrumentID,
		Status:           "In Used",
		StatusPenggunaan: "Read Process",
		StartTime:        usage.StartTime,
		Message:          "Read process started successfully",
	}, nil
}

// ProcessReadInstrument - Section 4.4
func (s *InstrumentReaderService) ProcessReadInstrument(req structs.ProcessReadRequest) (*structs.ProcessReadResponse, error) {
	// Get usage record
	usage, err := s.instrumentSvc.GetUsageByID(req.UsageID)
	if err != nil {
		return nil, err
	}

	// Validate status
	if usage.StatusPenggunaan != "Read Process" && usage.StatusPenggunaan != "Re-read" {
		return nil, errors.New("invalid usage status for reading")
	}

	// Get instrument configuration
	config, err := s.instrumentSvc.GetInstrumentConfiguration(usage.InstrumentID)
	if err != nil {
		return nil, errors.New("instrument configuration not found")
	}

	// Determine connection type and read data
	var resultData map[string]interface{}
	var readErr error

	// Check if it's direct connectivity (Serial or TCP)
	if config.ComPort != "" {
		// Serial connection
		resultData, readErr = s.serialReader.ReadData(config)
	} else if config.IPAddress != "" {
		// TCP/IP connection
		resultData, readErr = s.tcpReader.ReadData(config)
	} else {
		// Tibbo connection or manual input
		// For Tibbo, implement similar logic
		resultData, readErr = s.tibboReader.ReadData(config)
	}

	if readErr != nil {
		return &structs.ProcessReadResponse{
			Success:    false,
			ResultData: nil,
			Message:    fmt.Sprintf("Failed to read instrument: %s", readErr.Error()),
		}, readErr
	}

	return &structs.ProcessReadResponse{
		Success:    true,
		ResultData: resultData,
		Message:    "Data read successfully",
	}, nil
}

// SaveReadResult - Section 4.5
func (s *InstrumentReaderService) SaveReadResult(req structs.ReadResultRequest) (*structs.ReadResultResponse, error) {
	// Get usage record
	usage, err := s.instrumentSvc.GetUsageByID(req.UsageID)
	if err != nil {
		return nil, err
	}

	// Validate usage status
	if usage.StatusPenggunaan != "Read Process" && usage.StatusPenggunaan != "Re-read" {
		return nil, errors.New("invalid usage status for saving result")
	}

	// Convert result data to JSON
	resultDataJSON, err := json.Marshal(req.ResultData)
	if err != nil {
		return nil, err
	}

	// Check if this is a re-read
	isReread := usage.ParentUsageID != nil

	// Save result
	result := models.UsageResult{
		InstrumentUsageID: req.UsageID,
		NoQCBatch:         req.NoQCBatch,
		ItemNumber:        req.ItemNumber,
		ResultData:        string(resultDataJSON),
		IsReread:          isReread,
		CreatedAt:         time.Now(),
	}

	if err := s.db.Create(&result).Error; err != nil {
		return nil, err
	}

	// Update usage final condition
	if err := s.db.Model(&models.InstrumentUsage{}).
		Where("id = ?", req.UsageID).
		Update("final_condition", req.FinalCondition).Error; err != nil {
		return nil, err
	}

	// Calculate remaining items
	var completedItems int64
	s.db.Model(&models.UsageResult{}).
		Where("instrument_usage_id = ?", req.UsageID).
		Where("is_reread = ?", false).
		Count(&completedItems)

	remainingItems := usage.JumlahItem - int(completedItems)

	// If final condition is NOT OK and there are remaining items, stop the process
	if req.FinalCondition == "NOT_OK" && remainingItems > 0 {
		s.instrumentSvc.UpdateUsageStatus(req.UsageID, "Done Read")
		// set result_status if this is a re-read
		if usage.ParentUsageID != nil {
			s.db.Model(&models.InstrumentUsage{}).
				Where("id = ?", req.UsageID).
				Update("result_status", "awaiting_approval")
		}
		return &structs.ReadResultResponse{
			ResultID:       result.Id,
			UsageID:        req.UsageID,
			NoQCBatch:      req.NoQCBatch,
			ItemNumber:     req.ItemNumber,
			ResultData:     req.ResultData,
			FinalCondition: req.FinalCondition,
			RemainingItems: remainingItems,
			Message:        fmt.Sprintf("Result saved. Process stopped due to NOT OK condition. %d items remaining", remainingItems),
		}, nil
	}

	// If all items completed, update status to Done Read
	if remainingItems <= 0 {
		s.instrumentSvc.UpdateUsageStatus(req.UsageID, "Done Read")
		if usage.ParentUsageID != nil {
			s.db.Model(&models.InstrumentUsage{}).
				Where("id = ?", req.UsageID).
				Update("result_status", "awaiting_approval")
		}
	}

	return &structs.ReadResultResponse{
		ResultID:       result.Id,
		UsageID:        req.UsageID,
		NoQCBatch:      req.NoQCBatch,
		ItemNumber:     req.ItemNumber,
		ResultData:     req.ResultData,
		FinalCondition: req.FinalCondition,
		RemainingItems: remainingItems,
		Message:        "Result saved successfully",
	}, nil
}

// UjiUlang - Section 4.6
func (s *InstrumentReaderService) UjiUlang(req structs.UjiUlangRequest, userID uint) (*structs.UjiUlangResponse, error) {
	// Get parent usage
	parentUsage, err := s.instrumentSvc.GetUsageByID(req.UsageID)
	if err != nil {
		return nil, err
	}

	// Get the result to be re-tested
	var result models.UsageResult
	if err := s.db.First(&result, req.ResultID).Error; err != nil {
		return nil, errors.New("result not found")
	}

	// Validate supervisor exists
	var supervisor models.User
	if err := s.db.Where("id = ? AND role IN ?", req.SupervisorID, []string{"supervisor", "superadmin"}).First(&supervisor).Error; err != nil {
		return nil, errors.New("supervisor not found or invalid")
	}

	// Create new usage record for re-read
	newUsage := models.InstrumentUsage{
		InstrumentID:     parentUsage.InstrumentID,
		UserID:           userID,
		StartTime:        time.Now(),
		KategoriSampel:   parentUsage.KategoriSampel,
		Sampel:           parentUsage.Sampel,
		NoQCBatch:        parentUsage.NoQCBatch,
		JumlahItem:       1, // Only re-test one item
		InitialCondition: parentUsage.InitialCondition,
		AdditionalData:   parentUsage.AdditionalData,
		StatusPenggunaan: "Re-read",
		IsExported:       false,
		ParentUsageID:    &req.UsageID,
		RereadReason:     req.Alasan,
		ApprovedBy:       nil, // Will be set when approved
	}

	if err := s.db.Create(&newUsage).Error; err != nil {
		return nil, err
	}

	// Send notification to supervisor (implement notification service)
	// s.notificationService.SendRereadNotification(req.SupervisorID, newUsage.Id, req.Alasan)

	return &structs.UjiUlangResponse{
		NewUsageID:    newUsage.Id,
		ParentUsageID: req.UsageID,
		Status:        "Re-read",
		NeedsApproval: true,
		Message:       "Uji ulang started. Waiting for supervisor approval",
	}, nil
}

// ApproveUjiUlang - Section 4.6
func (s *InstrumentReaderService) ApproveUjiUlang(usageID, supervisorID uint, approved bool, comment string) error {
	// Get usage
	usage, err := s.instrumentSvc.GetUsageByID(usageID)
	if err != nil {
		return err
	}

	// Validate it's a re-read
	if usage.StatusPenggunaan != "Re-read" {
		return errors.New("this is not a re-read usage")
	}

	now := time.Now()
	updates := map[string]interface{}{
		"approved_by": supervisorID,
		"approved_at": now,
	}

	if !approved {
		// If not approved, mark as rejected
		updates["status_penggunaan"] = "Rejected"
	}

	return s.db.Model(&models.InstrumentUsage{}).
		Where("id = ?", usageID).
		Updates(updates).Error
}

// ExportToPDF - Section 4.7
// ExportToPDF - Updated with actual PDF generation
func (s *InstrumentReaderService) ExportToPDF(req structs.ExportPDFRequest) (*structs.ExportPDFResponse, error) {
	// Get usage
	usage, err := s.instrumentSvc.GetUsageByID(req.UsageID)
	if err != nil {
		return nil, err
	}

	// If it's a re-read, check if approved
	if usage.StatusPenggunaan == "Re-read" {
		if usage.ApprovedBy == nil {
			return nil, errors.New("re-read result must be approved by supervisor before export")
		}
	}

	// Get logo path from environment or config
	logoPath := os.Getenv("COMPANY_LOGO_PATH")
	if logoPath == "" {
		logoPath = "./assets/logo.png" // Default path
	}

	// Generate PDF
	pdfPath, err := s.pdfGenerator.GeneratePDFWithResults(req.UsageID, req.ResultIDs, logoPath)
	if err != nil {
		return nil, fmt.Errorf("failed to generate PDF: %v", err)
	}

	// Mark as exported
	if err := s.instrumentSvc.MarkUsageAsExported(req.UsageID); err != nil {
		return nil, err
	}

	// TODO: Upload to SDMS Server if configured
	// s.uploadToSDMS(pdfPath)

	return &structs.ExportPDFResponse{
		Success:  true,
		PDFPath:  pdfPath,
		Exported: true,
		Message:  fmt.Sprintf("PDF generated successfully: %s", filepath.Base(pdfPath)),
	}, nil
}

// EndReadProcess - Section 4.9
func (s *InstrumentReaderService) EndReadProcess(instrumentID uint, req structs.EndProcessRequest) (*structs.EndProcessResponse, error) {
	// Get usage
	usage, err := s.instrumentSvc.GetUsageByID(req.UsageID)
	if err != nil {
		return nil, err
	}

	// Validate instrument ID matches
	if usage.InstrumentID != instrumentID {
		return nil, errors.New("instrument ID mismatch")
	}

	// Update end time
	now := time.Now()
	updates := map[string]interface{}{
		"end_time":          now,
		"final_condition":   req.FinalCondition,
		"status_penggunaan": "Done Read",
	}

	if usage.ParentUsageID != nil {
		updates["result_status"] = "awaiting_approval"
	}

	if err := s.db.Model(&models.InstrumentUsage{}).
		Where("id = ?", req.UsageID).
		Updates(updates).Error; err != nil {
		return nil, err
	}

	// Count total items read
	var totalItemsRead int64
	s.db.Model(&models.UsageResult{}).
		Where("instrument_usage_id = ?", req.UsageID).
		Count(&totalItemsRead)

	// Count exported items
	var totalExported int64
	if usage.IsExported {
		totalExported = totalItemsRead
	}

	// Update instrument status based on final condition
	newStatus := "Available"
	if req.FinalCondition == "NOT_OK" {
		newStatus = "Unavailable"
	}

	if err := s.instrumentSvc.UpdateInstrumentStatus(instrumentID, newStatus); err != nil {
		return nil, err
	}

	return &structs.EndProcessResponse{
		Success:            true,
		InstrumentStatus:   newStatus,
		EndTime:            now,
		TotalItemsRead:     int(totalItemsRead),
		TotalItemsExported: int(totalExported),
		Message:            fmt.Sprintf("Read process ended. Instrument status updated to %s", newStatus),
	}, nil
}

// TestConnection - Section 3.4.1
func (s *InstrumentReaderService) TestConnection(req structs.TestConnectionRequest) (*structs.TestConnectionResponse, error) {
	// Get instrument configuration
	config, err := s.instrumentSvc.GetInstrumentConfiguration(req.InstrumentID)
	if err != nil {
		return &structs.TestConnectionResponse{
			Success: false,
			Message: "Configuration not found",
		}, err
	}

	var testResult bool
	var message string
	var data string

	// Test based on connection type
	if config.ComPort != "" {
		// Test Serial connection
		testResult, message, data = s.serialReader.TestConnection(config, req.SerialNumber)
	} else if config.IPAddress != "" {
		// Test TCP/IP connection
		testResult, message, data = s.tcpReader.TestConnection(config, req.SerialNumber)
	} else {
		return &structs.TestConnectionResponse{
			Success: false,
			Message: "No connection configuration found",
		}, errors.New("no connection configured")
	}

	return &structs.TestConnectionResponse{
		Success: testResult,
		Message: message,
		Data:    data,
	}, nil
}

// ============================================
// HELPER METHODS
// ============================================

// GetCurrentActiveUsage
func (s *InstrumentReaderService) GetCurrentActiveUsage(instrumentID uint) (*models.InstrumentUsage, error) {
	var usage models.InstrumentUsage
	if err := s.db.Where("instrument_id = ? AND end_time IS NULL", instrumentID).
		Order("start_time DESC").
		First(&usage).Error; err != nil {
		return nil, err
	}
	return &usage, nil
}

// ValidateUserCanAccessUsage
func (s *InstrumentReaderService) ValidateUserCanAccessUsage(usageID, userID uint) (bool, error) {
	var usage models.InstrumentUsage
	if err := s.db.First(&usage, usageID).Error; err != nil {
		return false, err
	}

	// User can access if they created the usage or they're admin/superadmin
	return usage.UserID == userID, nil
}

// GetResultsByUsageID
func (s *InstrumentReaderService) GetResultsByUsageID(usageID uint) ([]models.UsageResult, error) {
	var results []models.UsageResult
	if err := s.db.Where("instrument_usage_id = ?", usageID).
		Order("item_number ASC").
		Find(&results).Error; err != nil {
		return nil, err
	}
	return results, nil
}

// CalculateStatistics - Helper untuk menghitung statistik hasil pembacaan
func (s *InstrumentReaderService) CalculateStatistics(results []models.UsageResult) map[string]interface{} {
	stats := map[string]interface{}{
		"total_results": len(results),
		"reread_count":  0,
	}

	rereadCount := 0
	for _, result := range results {
		if result.IsReread {
			rereadCount++
		}
	}
	stats["reread_count"] = rereadCount

	return stats
}

// ReadDataNow - Read data immediately from instrument
func (s *InstrumentReaderService) ReadDataNow(instrumentID, usageID uint) (map[string]interface{}, error) {
	// Get instrument configuration
	config, err := s.instrumentSvc.GetInstrumentConfiguration(instrumentID)
	if err != nil {
		return nil, err
	}

	// Get usage
	usage, err := s.instrumentSvc.GetUsageByID(usageID)
	if err != nil {
		return nil, err
	}

	// Read data based on connection type
	var resultData map[string]interface{}
	var readErr error

	if config.ComPort != "" {
		// Serial connection
		resultData, readErr = s.serialReader.ReadData(config)
	} else if config.IPAddress != "" {
		// TCP/IP connection
		resultData, readErr = s.tcpReader.ReadData(config)
	} else {
		return nil, errors.New("no connection configured")
	}

	if readErr != nil {
		return nil, readErr
	}

	// Save result to database
	resultJSON, _ := json.Marshal(resultData)

	// Get next item number
	var maxItemNumber int
	s.db.Model(&models.UsageResult{}).
		Where("instrument_usage_id = ?", usageID).
		Select("COALESCE(MAX(item_number), 0)").
		Scan(&maxItemNumber)

	result := models.UsageResult{
		InstrumentUsageID: usageID,
		NoQCBatch:         usage.NoQCBatch,
		ItemNumber:        maxItemNumber + 1,
		ResultData:        string(resultJSON),
		IsReread:          false,
		CreatedAt:         time.Now(),
	}

	if err := s.db.Create(&result).Error; err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"result_id":   result.Id,
		"item_number": result.ItemNumber,
		"raw_data":    resultData["raw_data"],
		"parsed_data": resultData,
		"timestamp":   result.CreatedAt,
	}, nil
}

// GetLiveResults - Get results for active usage
func (s *InstrumentReaderService) GetLiveResults(usageID uint) ([]models.UsageResult, error) {
	var results []models.UsageResult

	// ✅ CRITICAL: WHERE clause HARUS ada instrument_usage_id
	if err := s.db.Where("instrument_usage_id = ?", usageID).
		Order("item_number ASC").
		Find(&results).Error; err != nil {
		return nil, err
	}

	return results, nil
}

// Add these methods to services/instrument_reader.go
// Place them after the existing methods

// ============================================
// AUTO-READ METHODS (NEW)
// ============================================

// StartAutoReadLoop - Start automatic reading loop for n items
func (s *InstrumentReaderService) StartAutoReadLoop(req structs.StartReadRequest, userID uint) (*structs.AutoReadResponse, error) {
	var usage *models.InstrumentUsage

	isReread := false
	existingUsageID := uint(0)

	if req.AdditionalData != nil {
		if val, ok := req.AdditionalData["existing_usage_id"].(float64); ok {
			existingUsageID = uint(val)
			isReread = true
		}
		if val, ok := req.AdditionalData["is_reread"].(bool); ok && val {
			isReread = true
		}
		if val, ok := req.AdditionalData["reread_usage_id"].(float64); ok {
			existingUsageID = uint(val)
			isReread = true
		}
	}

	if isReread && existingUsageID > 0 {
		// RE-READ MODE: pakai existing usage
		fmt.Printf("[Auto-Read] 🔄 Re-read mode, existing usage #%d\n", existingUsageID)

		if err := s.db.First(&usage, existingUsageID).Error; err != nil {
			return nil, fmt.Errorf("failed to find existing usage record: %v", err)
		}

		if usage.StatusPenggunaan != "Re-read" {
			return nil, fmt.Errorf("usage #%d is not in Re-read status (current: %s)", existingUsageID, usage.StatusPenggunaan)
		}

		if err := s.db.Model(&models.InstrumentUsage{}).
			Where("id = ?", existingUsageID).
			Updates(map[string]interface{}{
				"status_penggunaan": "Read Process",
			}).Error; err != nil {
			return nil, fmt.Errorf("failed to update usage status: %v", err)
		}

		if err := s.instrumentSvc.UpdateInstrumentStatus(usage.InstrumentID, "In Use"); err != nil {
			return nil, fmt.Errorf("failed to update instrument status: %v", err)
		}

		fmt.Printf("[Auto-Read] ✅ Re-read started, instrument set to 'In Use'\n")

	} else {
		// NORMAL MODE
		fmt.Printf("[Auto-Read] 📝 Normal mode, creating new usage record\n")

		available, currentStatus, err := s.instrumentSvc.CheckInstrumentAvailability(req.InstrumentID)
		if err != nil {
			return nil, err
		}

		if !available {
			if currentStatus == "In Use" {
				// Cek apakah ada usage aktif yang belum selesai (bridge sempat disconnect)
				incompleteUsage, findErr := s.findActiveIncompleteUsage(req.InstrumentID)
				if findErr == nil && incompleteUsage != nil {
					fmt.Printf("[Auto-Read] ⚠️ Resuming incomplete usage #%d\n", incompleteUsage.Id)
					usage = incompleteUsage
					// Pastikan instrument tetap "In Use"
					_ = s.instrumentSvc.UpdateInstrumentStatus(req.InstrumentID, "In Use")
					// Langsung lompat ke hitung totalItems — tidak perlu create usage baru
					goto calculateItems
				}
				// Stuck "In Use" tanpa usage aktif — force reset
				fmt.Printf("[Auto-Read] ⚠️ Instrument stuck 'In Use' with no active usage — resetting\n")
				_ = s.instrumentSvc.UpdateInstrumentStatus(req.InstrumentID, "Available")
				// Lanjut ke flow normal di bawah
			} else {
				return nil, fmt.Errorf("instrument is not available. Current status: %s", currentStatus)
			}
		}

		// Validate initial condition (hanya untuk usage baru, bukan resume)
		isValid, err := s.instrumentSvc.ValidateInitialCondition(req.InstrumentID, req.InitialCondition)
		if err != nil {
			return nil, err
		}
		if !isValid {
			_ = s.instrumentSvc.UpdateInstrumentStatus(req.InstrumentID, "Unavailable")
			return nil, errors.New("instrument initial condition is not valid")
		}

		usage, err = s.createUsageRecord(req, userID)
		if err != nil {
			return nil, err
		}

		if err := s.instrumentSvc.UpdateInstrumentStatus(req.InstrumentID, "In Use"); err != nil {
			return nil, err
		}

		fmt.Printf("[Auto-Read] ✅ New usage created (ID: %d)\n", usage.Id)
	}

calculateItems:
	// Untuk resume: ambil totalItems dari usage yang ada (sisa item yang belum dibaca)
	totalItems := 0
	if usage != nil && usage.JumlahItem > 0 {
		// Hitung berapa item yang sudah tersimpan
		var completedItems int64
		s.db.Model(&models.UsageResult{}).
			Where("instrument_usage_id = ?", usage.Id).
			Count(&completedItems)

		remaining := usage.JumlahItem - int(completedItems)
		if remaining > 0 {
			totalItems = remaining
			fmt.Printf("[Auto-Read] 📊 Resuming: %d/%d items remaining\n", remaining, usage.JumlahItem)
		} else {
			// Semua item sudah ada — usage ini sudah selesai sebenarnya
			fmt.Printf("[Auto-Read] ⚠️ All %d items already completed for usage #%d\n", usage.JumlahItem, usage.Id)
			_ = s.instrumentSvc.UpdateInstrumentStatus(usage.InstrumentID, "Available")
			return nil, fmt.Errorf("usage #%d already has all %d items completed", usage.Id, usage.JumlahItem)
		}
	} else {
		// Usage baru: hitung dari request
		for _, batch := range req.NoQCBatch {
			totalItems += batch.JumlahItem
		}
	}

	if totalItems <= 0 {
		return nil, errors.New("no items to read")
	}

	go s.executeAutoReadLoop(usage.Id, usage.InstrumentID, totalItems)

	return &structs.AutoReadResponse{
		UsageID:      usage.Id,
		InstrumentID: usage.InstrumentID, // pakai dari usage, bukan req
		TotalItems:   totalItems,
		Status:       "In Progress",
		Message:      fmt.Sprintf("Auto-read started for %d items", totalItems),
	}, nil
}

// findActiveIncompleteUsage - Cari usage yang masih In Use/Read Process tapi belum punya end_time
func (s *InstrumentReaderService) findActiveIncompleteUsage(instrumentID uint) (*models.InstrumentUsage, error) {
	var usage models.InstrumentUsage
	err := s.db.Where(
		"instrument_id = ? AND end_time IS NULL AND status_penggunaan IN ?",
		instrumentID,
		[]string{"Read Process", "Re-read"},
	).Order("start_time DESC").First(&usage).Error
	if err != nil {
		return nil, err
	}
	return &usage, nil
}

func (s *InstrumentReaderService) executeAutoReadLoop(usageID, instrumentID uint, totalItems int) {
	fmt.Printf("[Auto-Read] Starting loop for Usage #%d: %d items\n", usageID, totalItems)

	// Get instrument info
	var instrument models.Instrument
	if err := s.db.Preload("InstrumentConfig").First(&instrument, instrumentID).Error; err != nil {
		fmt.Printf("[Auto-Read] ❌ Failed to get instrument: %v\n", err)
		s.updateUsageStatus(usageID, "Failed", "Configuration error")
		s.instrumentSvc.UpdateInstrumentStatus(instrumentID, "Available")
		return
	}

	// Check if instrument uses bridge
	usesBridge := instrument.BridgePCID != ""

	if usesBridge {
		fmt.Printf("[Auto-Read] 🌉 Using BRIDGE mode (PC: %s)\n", instrument.BridgePCID)
		s.monitorBridgeProgress(usageID, totalItems)
	} else {
		fmt.Printf("[Auto-Read] 🔌 Using DIRECT mode (Serial/TCP)\n")
		s.executeAutoReadDirect(usageID, instrumentID, totalItems, &instrument)
	}

	// ✅ After reading completes, set instrument back to Available
	fmt.Printf("[Auto-Read] 🏁 Reading completed. Setting instrument to Available.\n")
	s.instrumentSvc.UpdateInstrumentStatus(instrumentID, "Available")
}

// Add this to services/instrument_reader.go
// This replaces the executeAutoReadDirect method with a smarter version

func (s *InstrumentReaderService) executeAutoReadDirect(usageID, instrumentID uint, totalItems int, instrument *models.Instrument) {
	// Get configuration
	config := instrument.InstrumentConfig
	if config == nil {
		fmt.Printf("[Auto-Read] ❌ No configuration found\n")
		s.updateUsageStatus(usageID, "Failed", "Configuration error")
		s.instrumentSvc.UpdateInstrumentStatus(instrumentID, "Available")
		return
	}

	// Get usage details for batch info
	usage, err := s.instrumentSvc.GetUsageByID(usageID)
	if err != nil {
		fmt.Printf("[Auto-Read] ❌ Failed to get usage: %v\n", err)
		s.instrumentSvc.UpdateInstrumentStatus(instrumentID, "Available")
		return
	}

	// Parse NoQCBatch to get batch distribution
	var batches []structs.BatchData
	if err := json.Unmarshal([]byte(usage.NoQCBatch), &batches); err != nil {
		fmt.Printf("[Auto-Read] ❌ Failed to parse batches: %v\n", err)
		s.updateUsageStatus(usageID, "Failed", "Invalid batch data")
		s.instrumentSvc.UpdateInstrumentStatus(instrumentID, "Available")
		return
	}

	// ✅ ✅ ✅ ADD THIS SECTION - Extract MT-SICS command
	mtsicsCommand := "SI" // Default command
	var additionalData map[string]interface{}
	if usage.AdditionalData != "" {
		if err := json.Unmarshal([]byte(usage.AdditionalData), &additionalData); err == nil {
			if cmd, ok := additionalData["mtsics_command"].(string); ok && cmd != "" {
				mtsicsCommand = cmd
				fmt.Printf("[Auto-Read] 📋 Using MT-SICS command from config: %s\n", mtsicsCommand)
			}
		}
	}
	fmt.Printf("[Auto-Read] 🔧 MT-SICS Command: %s\n", mtsicsCommand)

	// 🆕 AUTO-DETECT: Check if instrument sends multiple lines per print
	readingMode := s.detectReadingMode(config, totalItems)

	switch readingMode {
	case "batch":
		fmt.Printf("[Auto-Read] 🔍 BATCH+REGEX mode — read all, then parse with regex\n")
		s.executeBatchRegexRead(usageID, instrumentID, totalItems, config, batches, mtsicsCommand)
	case "multi-line":
		fmt.Printf("[Auto-Read] 📋 MULTI-LINE mode (pH meter style)\n")
		s.executeMultiLineRead(usageID, instrumentID, totalItems, config, batches, mtsicsCommand)
	default:
		fmt.Printf("[Auto-Read] 📊 SINGLE-LINE mode (balance/scale style)\n")
		s.executeSingleLineRead(usageID, instrumentID, totalItems, config, batches, mtsicsCommand)
	}
}

// 🆕 Detect reading mode based on configuration
func (s *InstrumentReaderService) detectReadingMode(config *models.InstrumentConfig, totalItems int) string {
	// Priority 1: Explicit config in database
	if config.ReadingMode != "" {
		return config.ReadingMode // "single-line", "multi-line", or "batch"
	}

	// Priority 1b: lines_per_item > 1 means multi-line instrument (e.g. pH meter).
	// Check this BEFORE regex_pattern so a pH meter that also has a regex_pattern
	// is NOT incorrectly routed to batch mode.
	if config.LinesPerItem > 1 {
		fmt.Printf("[Auto-Read] 📋 lines_per_item=%d → MULTI-LINE mode\n", config.LinesPerItem)
		return "multi-line"
	}

	// Priority 1c: regex_pattern only (and lines_per_item <= 1) → batch mode.
	if config.RegexPattern != "" {
		fmt.Printf("[Auto-Read] 🔍 regex_pattern configured, switching to BATCH mode\n")
		return "batch"
	}

	// Priority 2: Check instrument name/type patterns
	instrumentName := strings.ToLower(config.Instrument.Nama)

	// Multi-line instruments (typically send formatted reports)
	multiLinePatterns := []string{
		"ph meter", "ph-meter", "mettler toledo",
		"titrator", "spectrophotometer", "chromatograph",
	}

	for _, pattern := range multiLinePatterns {
		if strings.Contains(instrumentName, pattern) {
			return "multi-line"
		}
	}

	// Single-line instruments (typically send single measurement)
	singleLinePatterns := []string{
		"balance", "timbangan", "scale", "weight",
		"thermometer", "hygrometer",
	}

	for _, pattern := range singleLinePatterns {
		if strings.Contains(instrumentName, pattern) {
			return "single-line"
		}
	}

	// Priority 3: Default to single-line (safest for backward compatibility)
	fmt.Println("[Auto-Read] ⚠️ Could not auto-detect mode, using SINGLE-LINE (safe default)")
	return "single-line"
}

// executeBatchRegexRead reads ALL raw lines from the instrument at once.
//
// TWO MODES — detected automatically from pdf_columns config:
//
// MODE A — Single-line capture (simple instruments, e.g. balance, refractometer single-line):
//
//	Global regex_pattern has capture groups → each matching LINE = one item.
//	Capture group N maps to pdf_columns[N-1].key.
//	Example regex:  `Brix=\s*([\d.]+)%\s+nD=([\d.]+)\s+t=([\d.]+)`
//
// MODE B — Multi-line block (complex instruments, e.g. polarimeter):
//
//	Global regex_pattern acts as BLOCK DELIMITER — each match marks the start
//	of a new reading block. Each pdf_column defines its OWN regex to extract
//	its value from the block text.
//	Example delimiter:  `Rt\s+\d{4}`  (sequence number line)
//	Example column:     {"key":"ar", "regex":"A\.R\.=\s*([+-]?[\d.]+)°"}
//
// Instrument config:
//
//	regex_pattern  — required in both modes
//	pdf_columns    — [{key, header, unit, is_numeric, width, enabled, regex?}, ...]
func (s *InstrumentReaderService) executeBatchRegexRead(usageID, instrumentID uint, totalItems int, config *models.InstrumentConfig, batches []structs.BatchData, mtsicsCommand string) {
	fmt.Printf("[Batch-Regex] 🔄 Starting BATCH read for %d items\n", totalItems)
	fmt.Printf("[Batch-Regex] 🔍 Global regex_pattern: %s\n", config.RegexPattern)

	s.updateProgress(usageID, 0, totalItems, "reading_batch")

	// ── 1. Validate & compile global regex ───────────────────────────────────
	if config.RegexPattern == "" {
		s.updateUsageStatus(usageID, "Failed", "batch mode requires regex_pattern to be configured")
		s.instrumentSvc.UpdateInstrumentStatus(instrumentID, "Available")
		return
	}
	globalRe, err := regexp.Compile(config.RegexPattern)
	if err != nil {
		s.updateUsageStatus(usageID, "Failed", fmt.Sprintf("invalid regex_pattern: %v", err))
		s.instrumentSvc.UpdateInstrumentStatus(instrumentID, "Available")
		return
	}

	// ── 2. Load & parse pdf_columns ──────────────────────────────────────────
	var pdfCols []batchPDFColDef
	if config.PDFColumns != nil {
		json.Unmarshal(config.PDFColumns, &pdfCols)
	}

	// Detect mode: if ANY enabled column has its own "regex" field → Mode B
	hasPerColumnRegex := false
	for _, col := range pdfCols {
		if col.Enabled && col.Regex != "" {
			hasPerColumnRegex = true
			break
		}
	}

	fmt.Printf("[Batch-Regex] 🔀 Mode: %s\n", func() string {
		if hasPerColumnRegex {
			return "B (multi-line block + per-column regex)"
		}
		return "A (single-line capture groups)"
	}())

	// ── 3. Read ALL raw lines ─────────────────────────────────────────────────
	var rawLines []string
	var readErr error

	if config.ComPort != "" {
		rawLines, readErr = s.serialReader.ReadAllLines(config)
	} else if config.IPAddress != "" && config.TCPPort != 0 {
		rawLines, readErr = s.tcpReader.ReadAllLines(config)
	} else if config.IPAddress != "" {
		rawLines, readErr = s.tibboReader.ReadAllLines(config)
	} else {
		s.updateUsageStatus(usageID, "Failed", "no valid connection configured")
		s.instrumentSvc.UpdateInstrumentStatus(instrumentID, "Available")
		return
	}

	if readErr != nil && len(rawLines) == 0 {
		fmt.Printf("[Batch-Regex] ❌ Read error: %v\n", readErr)
		s.updateUsageStatus(usageID, "Failed", fmt.Sprintf("failed to read instrument: %v", readErr))
		s.instrumentSvc.UpdateInstrumentStatus(instrumentID, "Available")
		return
	}
	if readErr != nil {
		fmt.Printf("[Batch-Regex] ⚠️ Read completed with warning: %v\n", readErr)
	}

	fmt.Printf("[Batch-Regex] 📥 Received %d raw lines\n", len(rawLines))
	rawText := strings.Join(rawLines, "\n")

	var allResults []map[string]interface{}

	if hasPerColumnRegex {
		// ════════════════════════════════════════════════════════════════════════
		// MODE B: Split into blocks using global regex as delimiter,
		//         then apply per-column regex to each block.
		// ════════════════════════════════════════════════════════════════════════
		allResults = s.extractBlocksWithPerColumnRegex(rawLines, rawText, globalRe, pdfCols)
	} else {
		// ════════════════════════════════════════════════════════════════════════
		// MODE A: Each matching line = one item.
		//         Capture groups map to pdf_columns in order.
		// ════════════════════════════════════════════════════════════════════════
		allResults = s.extractLineMatches(rawLines, rawText, globalRe, pdfCols)
	}

	if len(allResults) == 0 {
		s.updateUsageStatus(usageID, "Failed",
			fmt.Sprintf("regex_pattern '%s' produced 0 items from %d lines — check the pattern", config.RegexPattern, len(rawLines)))
		s.instrumentSvc.UpdateInstrumentStatus(instrumentID, "Available")
		return
	}

	if len(allResults) != totalItems {
		fmt.Printf("[Batch-Regex] ⚠️ Expected %d items but extracted %d — saving all\n", totalItems, len(allResults))
	}

	statusMsg := fmt.Sprintf("Batch read: %d raw lines → %d items extracted (expected %d)", len(rawLines), len(allResults), totalItems)
	s.saveMultipleResults(usageID, instrumentID, len(allResults), allResults, batches, statusMsg)
}

// extractLineMatches — Mode A
// Each line that matches globalRe becomes one item.
// Capture group N → pdfCols[N-1].key.
func (s *InstrumentReaderService) extractLineMatches(
	rawLines []string,
	rawText string,
	globalRe *regexp.Regexp,
	pdfCols []batchPDFColDef,
) []map[string]interface{} {
	numGroups := globalRe.NumSubexp()
	fmt.Printf("[Batch-Regex/A] %d capture group(s), %d pdf_column(s)\n", numGroups, len(pdfCols))

	var results []map[string]interface{}
	for _, line := range rawLines {
		m := globalRe.FindStringSubmatch(line)
		if m == nil {
			continue
		}

		resultMap := map[string]interface{}{
			"raw_data":  line,
			"raw_text":  rawText,
			"matched":   m[0],
			"parsed":    true,
			"timestamp": time.Now().Format("2006-01-02 15:04:05"),
		}

		if len(pdfCols) > 0 && numGroups > 0 {
			for g := 1; g <= numGroups && g-1 < len(pdfCols); g++ {
				if pdfCols[g-1].Key != "" {
					resultMap[pdfCols[g-1].Key] = m[g]
					fmt.Printf("[Batch-Regex/A]   group[%d] → '%s' = %s\n", g, pdfCols[g-1].Key, m[g])
				}
			}
		} else {
			// No pdf_columns — fallback to generic "value"
			if len(m) > 1 {
				resultMap["value"] = m[1]
			} else {
				resultMap["value"] = m[0]
			}
		}
		results = append(results, resultMap)
	}
	return results
}

// extractBlocksWithPerColumnRegex — Mode B
// Splits raw lines into blocks using globalRe as a delimiter.
// Each block = one instrument reading. Each pdf_column's own regex
// is applied to the block text to extract its value.
//
// Delimiter behaviour:
//
//	The line matching globalRe is treated as the LAST line of the current
//	block (e.g. a sequence number that terminates the printout).
//	If the delimiter appears at the START of a block instead, set
//	reading_mode = "batch-block-start" — not yet implemented, easy to add.
func (s *InstrumentReaderService) extractBlocksWithPerColumnRegex(
	rawLines []string,
	rawText string,
	globalRe *regexp.Regexp,
	pdfCols []batchPDFColDef,
) []map[string]interface{} {
	// ── Split lines into blocks ───────────────────────────────────────────────
	// Accumulate lines until we hit the delimiter line, then flush the block.
	var blocks [][]string
	var current []string

	for _, line := range rawLines {
		current = append(current, line)
		if globalRe.MatchString(line) {
			// Delimiter found — this line closes the current block
			blocks = append(blocks, current)
			current = nil
		}
	}
	// Flush any trailing lines that didn't end with a delimiter
	if len(current) > 0 {
		blocks = append(blocks, current)
	}

	fmt.Printf("[Batch-Regex/B] Split into %d block(s)\n", len(blocks))

	// ── Compile per-column regexes once ──────────────────────────────────────
	type compiledCol struct {
		Key string
		Re  *regexp.Regexp
	}
	var compiledCols []compiledCol
	for _, col := range pdfCols {
		if !col.Enabled || col.Key == "" {
			continue
		}
		if col.Regex == "" {
			fmt.Printf("[Batch-Regex/B] ⚠️ Column '%s' has no regex — will be empty\n", col.Key)
			compiledCols = append(compiledCols, compiledCol{Key: col.Key, Re: nil})
			continue
		}
		re, err := regexp.Compile(col.Regex)
		if err != nil {
			fmt.Printf("[Batch-Regex/B] ❌ Invalid regex for column '%s': %v\n", col.Key, err)
			compiledCols = append(compiledCols, compiledCol{Key: col.Key, Re: nil})
			continue
		}
		compiledCols = append(compiledCols, compiledCol{Key: col.Key, Re: re})
	}

	// ── Extract values from each block ───────────────────────────────────────
	var results []map[string]interface{}
	for blockIdx, block := range blocks {
		blockText := strings.Join(block, "\n")

		resultMap := map[string]interface{}{
			"raw_data":  blockText,
			"raw_text":  rawText,
			"parsed":    true,
			"timestamp": time.Now().Format("2006-01-02 15:04:05"),
		}

		for _, col := range compiledCols {
			if col.Re == nil {
				resultMap[col.Key] = ""
				continue
			}
			m := col.Re.FindStringSubmatch(blockText)
			if m == nil {
				resultMap[col.Key] = ""
				fmt.Printf("[Batch-Regex/B]   block[%d] col '%s': no match\n", blockIdx, col.Key)
			} else {
				value := m[0]
				if len(m) > 1 {
					value = m[1] // first capture group = the value
				}
				resultMap[col.Key] = value
				fmt.Printf("[Batch-Regex/B]   block[%d] col '%s' = %s\n", blockIdx, col.Key, value)
			}
		}

		results = append(results, resultMap)
	}
	return results
}

// 🆕 Execute multi-line reading (for pH meters, etc.)
func (s *InstrumentReaderService) executeMultiLineRead(
	usageID, instrumentID uint,
	totalItems int,
	config *models.InstrumentConfig,
	batches []structs.BatchData,
	mtsicsCommand string,
) {
	fmt.Printf("[Auto-Read] 🔄 Starting MULTI-LINE read for %d items (%d lines/item)\n", totalItems, config.LinesPerItem)
	fmt.Println("[Auto-Read] 📋 Operator: tekan tombol PRINT untuk setiap item")

	cancelCh, doneCh := GlobalAutoReadManager.Register(usageID)
	defer close(doneCh)
	defer GlobalAutoReadManager.UnregisterIfMatch(usageID, cancelCh)

	linesPerItem := config.LinesPerItem
	if linesPerItem <= 0 {
		linesPerItem = 1
	}

	var usage models.InstrumentUsage
	s.db.First(&usage, usageID)
	isReread := usage.ParentUsageID != nil

	currentItemNumber := 1
	successCount := 0
	batchIndex := 0
	itemInBatch := 1
	currentBatch := batches[0]

	for currentItemNumber <= totalItems {
		fmt.Printf("[Auto-Read] ⏳ Menunggu PRINT item #%d dari %d (Batch: %s, %d/%d)\n",
			currentItemNumber, totalItems, currentBatch.NoQCBatch, itemInBatch, currentBatch.JumlahItem)

		s.updateProgress(usageID, currentItemNumber-1, totalItems,
			fmt.Sprintf("waiting_print_item_%d", currentItemNumber))

		// Cancel check SEBELUM blocking read
		select {
		case <-cancelCh:
			fmt.Printf("[Auto-Read] ⛔ Cancelled at item #%d\n", currentItemNumber)
			return
		default:
		}

		var resultData map[string]interface{}
		var readErr error

		if config.ComPort != "" {
			resultData, readErr = s.serialReader.ReadData(config)
		} else if config.IPAddress != "" {
			resultData, readErr = s.tcpReader.ReadNLines(config, linesPerItem)
		} else {
			readErr = fmt.Errorf("no valid connection configured")
		}

		if readErr != nil {
			fmt.Printf("[Auto-Read] ❌ Error pada item #%d: %v\n", currentItemNumber, readErr)
			s.updateUsageStatus(usageID, "Failed", fmt.Sprintf(
				"Gagal baca item %d: %s. Berhasil: %d/%d item.",
				currentItemNumber, readErr.Error(), successCount, totalItems,
			))
			s.instrumentSvc.UpdateInstrumentStatus(instrumentID, "Available")
			return
		}

		// Post-read cancel check — WAJIB ada sebelum s.db.Create
		// Ini yang mencegah duplikasi: kalau RetryItem sudah cancel kita
		// saat kita sedang blocking read, hasil read ini dibuang.
		select {
		case <-cancelCh:
			fmt.Printf("[Auto-Read] ⛔ Cancelled after read item #%d — result discarded\n", currentItemNumber)
			return
		default:
		}

		resultJSON, _ := json.Marshal(resultData)
		result := models.UsageResult{
			InstrumentUsageID: usageID,
			BridgeReadingID:   nil,
			NoQCBatch:         currentBatch.NoQCBatch,
			ItemNumber:        currentItemNumber,
			ResultData:        string(resultJSON),
			IsReread:          isReread,
			CreatedAt:         time.Now(),
		}

		if err := s.db.Create(&result).Error; err != nil {
			fmt.Printf("[Auto-Read] ❌ Gagal simpan item #%d: %v\n", currentItemNumber, err)
			s.updateUsageStatus(usageID, "Failed", fmt.Sprintf("Database error pada item %d", currentItemNumber))
			s.instrumentSvc.UpdateInstrumentStatus(instrumentID, "Available")
			return
		}

		fmt.Printf("[Auto-Read] ✅ Item #%d tersimpan (Result ID: %d)\n", currentItemNumber, result.Id)
		successCount++
		s.updateProgress(usageID, currentItemNumber, totalItems,
			fmt.Sprintf("item_%d_done", currentItemNumber))

		currentItemNumber++
		itemInBatch++
		if itemInBatch > currentBatch.JumlahItem && batchIndex < len(batches)-1 {
			batchIndex++
			currentBatch = batches[batchIndex]
			itemInBatch = 1
		}

		if currentItemNumber <= totalItems {
			time.Sleep(500 * time.Millisecond)
		}
	}

	if isReread {
		fmt.Printf("[Auto-Read] 🎉 RE-READ selesai! %d item berhasil\n", successCount)
		now := time.Now()
		s.db.Model(&models.InstrumentUsage{}).
			Where("id = ?", usageID).
			Updates(map[string]interface{}{
				"status_penggunaan": "Re-read",
				"result_status":     "awaiting_approval",
				"end_time":          &now,
				"updated_at":        time.Now(),
			})
	} else {
		fmt.Printf("[Auto-Read] 🎉 Selesai! %d/%d item berhasil\n", successCount, totalItems)
		s.updateUsageStatus(usageID, "Done Read",
			fmt.Sprintf("Berhasil membaca semua %d item", successCount))
	}

	s.instrumentSvc.UpdateInstrumentStatus(instrumentID, "Available")
}

func (s *InstrumentReaderService) executeSingleLineRead(
	usageID, instrumentID uint,
	totalItems int,
	config *models.InstrumentConfig,
	batches []structs.BatchData,
	mtsicsCommand string,
) {
	cancelCh, doneCh := GlobalAutoReadManager.Register(usageID)
	defer close(doneCh)
	defer GlobalAutoReadManager.UnregisterIfMatch(usageID, cancelCh)

	var usage models.InstrumentUsage
	s.db.First(&usage, usageID)

	fmt.Printf("[Auto-Read] 🔄 Starting SINGLE-LINE read for %d items\n", totalItems)
	fmt.Printf("[Auto-Read] 🔧 Using MT-SICS command: %s\n", mtsicsCommand)
	fmt.Println("[Auto-Read] 📊 Press PRINT for each item when ready")

	isReread := usage.ParentUsageID != nil
	if isReread {
		fmt.Printf("[Auto-Read] 🔄 RE-READ MODE detected via ParentUsageID\n")
	}

	currentItemNumber := 1
	successCount := 0
	batchIndex := 0
	itemInBatch := 1
	currentBatch := batches[0]

	for currentItemNumber <= totalItems {
		// Cancel check SEBELUM blocking read
		select {
		case <-cancelCh:
			fmt.Printf("[Auto-Read] ⛔ Goroutine cancelled at item #%d\n", currentItemNumber)
			return
		default:
		}

		fmt.Printf("[Auto-Read] Reading Item #%d of %d (Batch: %s, Item %d/%d)\n",
			currentItemNumber, totalItems, currentBatch.NoQCBatch, itemInBatch, currentBatch.JumlahItem)

		s.updateProgress(usageID, currentItemNumber, totalItems, "reading")

		resultData, readErr := s.readFromInstrument(config, mtsicsCommand)

		if readErr != nil {
			fmt.Printf("[Auto-Read] ❌❌❌ CRITICAL ERROR on Item #%d: %v\n", currentItemNumber, readErr)
			s.updateUsageStatus(usageID, "Failed", fmt.Sprintf(
				"Auto-read stopped at item %d due to error: %s. Successfully completed: %d/%d items.",
				currentItemNumber, readErr.Error(), successCount, totalItems,
			))
			s.instrumentSvc.UpdateInstrumentStatus(instrumentID, "Available")
			return
		}

		// Post-read cancel check — WAJIB ada sebelum s.db.Create
		select {
		case <-cancelCh:
			fmt.Printf("[Auto-Read] ⛔ Cancelled after read item #%d — result discarded\n", currentItemNumber)
			return
		default:
		}

		resultJSON, _ := json.Marshal(resultData)
		result := models.UsageResult{
			InstrumentUsageID: usageID,
			BridgeReadingID:   nil,
			NoQCBatch:         currentBatch.NoQCBatch,
			ItemNumber:        currentItemNumber,
			ResultData:        string(resultJSON),
			IsReread:          isReread,
			CreatedAt:         time.Now(),
		}

		if err := s.db.Create(&result).Error; err != nil {
			fmt.Printf("[Auto-Read] ❌ Failed to save Item #%d: %v\n", currentItemNumber, err)
			s.updateUsageStatus(usageID, "Failed", fmt.Sprintf("Database error at item %d", currentItemNumber))
			s.instrumentSvc.UpdateInstrumentStatus(instrumentID, "Available")
			return
		}

		fmt.Printf("[Auto-Read] ✅ Item #%d saved successfully\n", currentItemNumber)
		successCount++
		s.updateProgress(usageID, currentItemNumber, totalItems, "completed")

		currentItemNumber++
		itemInBatch++

		if itemInBatch > currentBatch.JumlahItem && batchIndex < len(batches)-1 {
			batchIndex++
			currentBatch = batches[batchIndex]
			itemInBatch = 1
		}

		time.Sleep(1 * time.Second)
	}

	if isReread {
		fmt.Printf("[Auto-Read] 🎉 RE-READ SUCCESS! All %d items completed\n", totalItems)
		now := time.Now()
		s.db.Model(&models.InstrumentUsage{}).
			Where("id = ?", usageID).
			Updates(map[string]interface{}{
				"status_penggunaan": "Re-read",
				"result_status":     "awaiting_approval",
				"end_time":          &now,
				"updated_at":        time.Now(),
			})
	} else {
		fmt.Printf("[Auto-Read] 🎉 SUCCESS! All %d items completed\n", totalItems)
		s.updateUsageStatus(usageID, "Done Read", fmt.Sprintf("Successfully read all %d items", totalItems))
	}

	s.instrumentSvc.UpdateInstrumentStatus(instrumentID, "Available")
}

// 🆕 Helper to save multiple results (for multi-line mode)
func (s *InstrumentReaderService) saveMultipleResults(usageID, instrumentID uint, totalItems int, allResults []map[string]interface{}, batches []structs.BatchData, statusMessage string) {
	currentItemNumber := 1
	successCount := 0
	batchIndex := 0
	itemInBatch := 1
	currentBatch := batches[0]

	fmt.Printf("[Auto-Read] 💾 Saving %d results to database...\n", len(allResults))
	var usage models.InstrumentUsage
	s.db.First(&usage, usageID)

	isReread := usage.ParentUsageID != nil
	if isReread {
		fmt.Printf("[Auto-Read] 🔄 RE-READ MODE detected via ParentUsageID. Results will be marked as re-read\n")
	}

	for i, resultData := range allResults {
		// Determine batch assignment
		if itemInBatch > currentBatch.JumlahItem && batchIndex < len(batches)-1 {
			batchIndex++
			currentBatch = batches[batchIndex]
			itemInBatch = 1
		}

		fmt.Printf("[Auto-Read] Saving Item #%d of %d (Batch: %s, Item %d/%d)\n",
			currentItemNumber, len(allResults), currentBatch.NoQCBatch, itemInBatch, currentBatch.JumlahItem)

		// Update progress BEFORE save so frontend poll sees item-in-progress
		s.updateProgress(usageID, currentItemNumber-1, totalItems, fmt.Sprintf("saving_item_%d", currentItemNumber))

		// Prepare result data
		resultJSON, err := json.Marshal(resultData)
		if err != nil {
			fmt.Printf("[Auto-Read] ⚠️ Failed to marshal Item #%d: %v, skipping\n", currentItemNumber, err)
			currentItemNumber++
			itemInBatch++
			continue
		}

		result := models.UsageResult{
			InstrumentUsageID: usageID,
			BridgeReadingID:   nil,
			NoQCBatch:         currentBatch.NoQCBatch,
			ItemNumber:        currentItemNumber,
			ResultData:        string(resultJSON),
			IsReread:          isReread,
			CreatedAt:         time.Now(),
		}

		if err := s.db.Create(&result).Error; err != nil {
			fmt.Printf("[Auto-Read] ❌ Failed to save Item #%d to database: %v\n", currentItemNumber, err)
			currentItemNumber++
			itemInBatch++
			continue
		}

		rereadIndicator := ""
		if isReread {
			rereadIndicator = " [RE-READ]"
		}

		// Build human-readable summary of parsed values for progress log
		parsedSummary := ""
		for k, v := range resultData {
			if k == "raw_data" || k == "raw_text" || k == "timestamp" || k == "parsed" || k == "line_count" || k == "matched" {
				continue
			}
			if parsedSummary != "" {
				parsedSummary += ", "
			}
			parsedSummary += fmt.Sprintf("%s=%v", k, v)
		}

		fmt.Printf("[Auto-Read] ✅ Item #%d saved (Result ID: %d)%s — %s\n",
			currentItemNumber, result.Id, rereadIndicator, parsedSummary)
		successCount++
		// Update progress AFTER save with parsed values so frontend shows real data
		s.updateProgress(usageID, currentItemNumber, totalItems, fmt.Sprintf("item_%d_done: %s", currentItemNumber, parsedSummary))

		currentItemNumber++
		itemInBatch++

		// Sleep between items so the frontend's 2s poll can catch intermediate states.
		// Without this, all items save in <200ms and the UI jumps straight to Done Read.
		if i < len(allResults)-1 {
			time.Sleep(600 * time.Millisecond)
		} else {
			// After last item, pause before marking Done Read so frontend
			// can render 100% progress before auto-navigating away.
			time.Sleep(1500 * time.Millisecond)
		}
	}

	// ✅ CRITICAL FIX: Determine final status based on context
	s.db.First(&usage, usageID)

	finalStatus := "Done Read"
	finalMessage := statusMessage

	isReread = usage.ParentUsageID != nil

	if successCount == 0 {
		finalStatus = "Failed"
		finalMessage = "Failed to save any results to database"
		fmt.Printf("[Auto-Read] ❌ FAILURE: No items were saved to database\n")
	} else if successCount < len(allResults) {
		// ✅ For re-read, still mark as awaiting approval even with partial results
		if isReread {
			finalStatus = "Re-read"
			finalMessage = fmt.Sprintf("Partially completed: saved %d/%d items. Awaiting supervisor approval.", successCount, len(allResults))
		} else {
			finalStatus = "Done Read"
			finalMessage = fmt.Sprintf("Partially completed: saved %d/%d items. %s", successCount, len(allResults), statusMessage)
		}
		fmt.Printf("[Auto-Read] ⚠️ Partial success: %d/%d items saved\n", successCount, len(allResults))
	} else {
		// ✅ ALL items saved successfully
		if isReread {
			finalStatus = "Re-read"
			finalMessage = "Re-read completed successfully. Awaiting supervisor approval."
		} else {
			finalStatus = "Done Read"
			finalMessage = fmt.Sprintf("Successfully read all %d items", successCount)
		}
		fmt.Printf("[Auto-Read] 🎉 SUCCESS! All %d items saved to database\n", successCount)
	}

	// ✅ Update usage status and result_status
	updates := map[string]interface{}{
		"status_penggunaan": finalStatus,
		"updated_at":        time.Now(),
	}

	// ✅ Selalu set end_time saat proses selesai (Done Read, Failed, atau Re-read)
	now := time.Now()
	updates["end_time"] = &now

	if isReread {
		updates["result_status"] = "awaiting_approval"
		fmt.Printf("[Auto-Read] Re-read completed. Status: %s, end_time: set, Result Status: awaiting_approval\n", finalStatus)
	}

	s.db.Model(&models.InstrumentUsage{}).
		Where("id = ?", usageID).
		Updates(updates)

	// Update instrument status back to available
	s.instrumentSvc.UpdateInstrumentStatus(instrumentID, "Available")

	fmt.Printf("[Auto-Read] Final Status: %s\n", finalStatus)
	fmt.Printf("[Auto-Read] Final Message: %s\n", finalMessage)
}

// Helper for serial multi-line (if needed)
func (s *InstrumentReaderService) readMultipleFromSerial(config *models.InstrumentConfig, expectedLines int) ([]map[string]interface{}, error) {
	results := make([]map[string]interface{}, 0, expectedLines)

	for i := 0; i < expectedLines; i++ {
		fmt.Printf("[Auto-Read Serial] Reading item %d/%d - Press PRINT now\n", i+1, expectedLines)

		resultData, err := s.serialReader.ReadData(config)
		if err != nil {
			return nil, fmt.Errorf("failed to read item %d: %v", i+1, err)
		}

		results = append(results, resultData)

		if i < expectedLines-1 {
			time.Sleep(2 * time.Second)
		}
	}

	return results, nil
}

// monitorBridgeProgress - Monitor progress for bridge mode
func (s *InstrumentReaderService) monitorBridgeProgress(usageID uint, totalItems int) {
	fmt.Printf("[Auto-Read Bridge Monitor] Started for usage #%d\n", usageID)

	timeout := time.After(30 * time.Minute) // Max 30 min wait
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	lastCount := 0

	for {
		select {
		case <-timeout:
			fmt.Printf("[Auto-Read Bridge Monitor] ⚠️ Timeout reached\n")
			s.updateUsageStatus(usageID, "Failed", "Timeout waiting for bridge data")
			s.instrumentSvc.UpdateInstrumentStatus(
				s.getInstrumentIDFromUsage(usageID),
				"Available",
			)
			return

		case <-ticker.C:
			// Count completed items
			var completedCount int64
			s.db.Model(&models.UsageResult{}).
				Where("instrument_usage_id = ? AND bridge_reading_id IS NOT NULL", usageID).
				Count(&completedCount)

			if completedCount > int64(lastCount) {
				fmt.Printf("[Auto-Read Bridge Monitor] Progress: %d/%d items\n",
					completedCount, totalItems)
				lastCount = int(completedCount)

				s.updateProgress(usageID, int(completedCount), totalItems, "receiving")
			}

			// Check if completed
			if completedCount >= int64(totalItems) {
				fmt.Printf("[Auto-Read Bridge Monitor] ✅ All items received!\n")
				s.updateUsageStatus(usageID, "Done Read",
					fmt.Sprintf("Successfully received all %d items from bridge", totalItems))

				now := time.Now()
				s.db.Model(&models.InstrumentUsage{}).
					Where("id = ?", usageID).
					Update("end_time", now)

				s.instrumentSvc.UpdateInstrumentStatus(
					s.getInstrumentIDFromUsage(usageID),
					"Available",
				)
				return
			}
		}
	}
}

// Helper to get instrument_id from usage
func (s *InstrumentReaderService) getInstrumentIDFromUsage(usageID uint) uint {
	var usage models.InstrumentUsage
	s.db.First(&usage, usageID)
	return usage.InstrumentID
}

// readFromInstrument - Helper to read data based on connection type
func (s *InstrumentReaderService) readFromInstrument(config *models.InstrumentConfig, mtsicsCommand string) (map[string]interface{}, error) {
	if config.ComPort != "" {
		return s.serialReader.ReadData(config)
	} else if config.IPAddress != "" {
		// ✅ Use MT-SICS command for TCP connections
		if mtsicsCommand != "" {
			fmt.Printf("[Auto-Read] Using MT-SICS command: %s\n", mtsicsCommand)
			value, err := s.tcpReader.ReadValueWithCommand(config, mtsicsCommand)
			if err != nil {
				return nil, err
			}
			// Convert float64 value to map[string]interface{} format
			return map[string]interface{}{
				"value":     value,
				"raw_data":  fmt.Sprintf("%.5f", value),
				"parsed":    true,
				"timestamp": time.Now().Format("2006-01-02 15:04:05"),
			}, nil
		}
		return s.tcpReader.ReadData(config)
	} else {
		return s.tibboReader.ReadData(config)
	}
}

// saveReadError - Save error result
func (s *InstrumentReaderService) saveReadError(usageID uint, batchNo string, itemNumber int, errorMsg string) {
	errorResult := map[string]interface{}{
		"error":   true,
		"message": errorMsg,
		"time":    time.Now().Format("2006-01-02 15:04:05"),
	}

	resultJSON, _ := json.Marshal(errorResult)

	result := models.UsageResult{
		InstrumentUsageID: usageID,
		NoQCBatch:         batchNo,
		ItemNumber:        itemNumber,
		ResultData:        string(resultJSON),
		IsReread:          false,
		CreatedAt:         time.Now(),
	}

	s.db.Create(&result)
}

// updateProgress - Update reading progress
func (s *InstrumentReaderService) updateProgress(usageID uint, currentItem, totalItems int, status string) {
	progressData := map[string]interface{}{
		"current_item": currentItem,
		"total_items":  totalItems,
		"status":       status,
		"percentage":   float64(currentItem) / float64(totalItems) * 100,
		"updated_at":   time.Now(),
	}

	progressJSON, _ := json.Marshal(progressData)

	s.db.Model(&models.InstrumentUsage{}).
		Where("id = ?", usageID).
		Update("progress_data", string(progressJSON))
}

// updateUsageStatus - Update usage status with message
func (s *InstrumentReaderService) updateUsageStatus(usageID uint, status, message string) {
	var usage models.InstrumentUsage
	s.db.First(&usage, usageID)

	updates := map[string]interface{}{
		"status_penggunaan": status,
	}

	// ✅ Set end_time dulu SEBELUM re-read branch bisa override status
	if status == "Done Read" || status == "Failed" {
		now := time.Now()
		updates["end_time"] = &now
	}

	// ✅ Re-read branch: override status tapi JANGAN hapus end_time dari map
	if usage.ParentUsageID != nil && status == "Done Read" {
		updates["status_penggunaan"] = "Re-read"
		updates["result_status"] = "awaiting_approval"
		// end_time tetap ada di updates map dari blok di atas
		now := time.Now()
		updates["end_time"] = &now // explicit, jaga-jaga
		fmt.Printf("[Auto-Read] Re-read completed → status: Re-read, result_status: awaiting_approval, end_time: set\n")
	}

	s.db.Model(&models.InstrumentUsage{}).
		Where("id = ?", usageID).
		Updates(updates)

	fmt.Printf("[Auto-Read] Status updated: %s - %s\n", status, message)
}

// GetReadProgress - Get current reading progress
func (s *InstrumentReaderService) GetReadProgress(usageID uint) (map[string]interface{}, error) {
	usage, err := s.instrumentSvc.GetUsageByID(usageID)
	if err != nil {
		return nil, err
	}

	// Parse progress data
	var progressData map[string]interface{}
	if usage.ProgressData != "" {
		json.Unmarshal([]byte(usage.ProgressData), &progressData)
	}

	// Count completed results
	var completedCount int64
	s.db.Model(&models.UsageResult{}).
		Where("instrument_usage_id = ?", usageID).
		Count(&completedCount)

	// Get latest result
	var latestResult models.UsageResult
	s.db.Where("instrument_usage_id = ?", usageID).
		Order("created_at DESC").
		First(&latestResult)

	response := map[string]interface{}{
		"usage_id":         usageID,
		"status":           usage.StatusPenggunaan,
		"total_items":      usage.JumlahItem,
		"completed_items":  completedCount,
		"progress_percent": float64(completedCount) / float64(usage.JumlahItem) * 100,
		"start_time":       usage.StartTime,
		"end_time":         usage.EndTime,
	}

	if progressData != nil {
		response["current_item"] = progressData["current_item"]
		response["current_status"] = progressData["status"]
	}

	if latestResult.Id > 0 {
		response["latest_result"] = map[string]interface{}{
			"item_number": latestResult.ItemNumber,
			"batch":       latestResult.NoQCBatch,
			"created_at":  latestResult.CreatedAt,
		}
	}

	return response, nil
}

// createUsageRecord - Helper to create usage record
func (s *InstrumentReaderService) createUsageRecord(req structs.StartReadRequest, userID uint) (*models.InstrumentUsage, error) {
	// Validate instrument
	available, status, err := s.instrumentSvc.CheckInstrumentAvailability(req.InstrumentID)
	if err != nil {
		return nil, err
	}
	if !available {
		return nil, fmt.Errorf("instrument is not available. Current status: %s", status)
	}

	// Validate initial condition
	isValid, err := s.instrumentSvc.ValidateInitialCondition(req.InstrumentID, req.InitialCondition)
	if err != nil {
		return nil, err
	}
	if !isValid {
		s.instrumentSvc.UpdateInstrumentStatus(req.InstrumentID, "Unavailable")
		return nil, errors.New("instrument initial condition is not valid")
	}

	// Convert to JSON
	initialConditionJSON, _ := json.Marshal(req.InitialCondition)
	additionalDataJSON, _ := json.Marshal(req.AdditionalData)
	sampelJSON, _ := json.Marshal(req.Sampel)
	noQCBatchJSON, _ := json.Marshal(req.NoQCBatch)

	// Calculate total items
	totalItems := 0
	for _, batch := range req.NoQCBatch {
		totalItems += batch.JumlahItem
	}

	// Create usage record
	usage := models.InstrumentUsage{
		InstrumentID:     req.InstrumentID,
		UserID:           userID,
		StartTime:        time.Now(),
		KategoriSampel:   req.KategoriSampel,
		Sampel:           string(sampelJSON),
		NoQCBatch:        string(noQCBatchJSON),
		JumlahItem:       totalItems,
		InitialCondition: string(initialConditionJSON),
		AdditionalData:   string(additionalDataJSON),
		StatusPenggunaan: "Read Process",
		IsExported:       false,
		ProgressData:     "",
	}

	if err := s.db.Create(&usage).Error; err != nil {
		return nil, err
	}

	return &usage, nil
}

// GeneratePDFForUsage - New method untuk generate PDF langsung dari usage ID
func (s *InstrumentReaderService) GeneratePDFForUsage(usageID uint) (string, error) {
	logoPath := os.Getenv("COMPANY_LOGO_PATH")
	if logoPath == "" {
		logoPath = "./assets/logo.png"
	}

	pdfPath, err := s.pdfGenerator.GeneratePDFWithResults(usageID, []uint{}, logoPath)
	if err != nil {
		return "", err
	}

	// Mark as exported
	s.instrumentSvc.MarkUsageAsExported(usageID)

	return pdfPath, nil
}

func (s *InstrumentReaderService) SaveToFileCapture(req structs.SaveFileRequest, userSite string) (*structs.SaveFileResponse, error) {
	// Get usage
	usage, err := s.instrumentSvc.GetUsageByID(req.UsageID)
	if err != nil {
		return nil, err
	}

	// Get result
	var result models.UsageResult
	if err := s.db.First(&result, req.ResultID).Error; err != nil {
		return nil, errors.New("result not found")
	}

	// Get instrument configuration to get file paths
	config, err := s.instrumentSvc.GetInstrumentConfiguration(usage.InstrumentID)
	if err != nil {
		return nil, errors.New("instrument configuration not found")
	}

	// Determine file path based on destination ID and user site
	var filePath string
	switch req.DestinationID {
	case 1:
		filePath = config.FilePath // Path 1 (QC)
	case 2:
		filePath = config.FilePath2 // Path 2 (AnDev)
	default:
		return nil, errors.New("invalid destination ID")
	}

	if filePath == "" {
		return nil, errors.New("file path not configured for this destination")
	}

	// Generate filename with timestamp
	filename := fmt.Sprintf("instrument_%d_result_%d_%s.dat",
		usage.InstrumentID,
		result.Id,
		time.Now().Format("20060102_150405"))

	fullPath := filepath.Join(filePath, filename)

	// Create directory if not exists
	if err := os.MkdirAll(filePath, 0755); err != nil {
		return nil, fmt.Errorf("failed to create directory: %v", err)
	}

	// Write result data to file
	if err := os.WriteFile(fullPath, []byte(result.ResultData), 0644); err != nil {
		return nil, fmt.Errorf("failed to write file: %v", err)
	}

	// Mark as exported
	if err := s.instrumentSvc.MarkUsageAsExported(req.UsageID); err != nil {
		return nil, err
	}

	return &structs.SaveFileResponse{
		Success:  true,
		FilePath: fullPath,
		Message:  "File saved successfully according to ALCOA standards",
	}, nil
}

// ExecuteCommand - Execute custom command on instrument
func (s *InstrumentReaderService) ExecuteCommand(instrumentID uint, command string) (string, error) {
	// Get instrument config
	var instrument models.Instrument
	if err := s.db.Preload("InstrumentConfig").First(&instrument, instrumentID).Error; err != nil {
		return "", errors.New("instrument not found")
	}

	if instrument.InstrumentConfig == nil {
		return "", errors.New("instrument not configured")
	}

	config := instrument.InstrumentConfig

	// Determine which reader to use
	var result string
	var err error

	if config.ComPort != "" {
		// Serial connection
		result, err = s.serialReader.SendCommand(config, command)
	} else if config.IPAddress != "" {
		// TCP/IP connection
		result, err = s.tcpReader.SendCommand(config, command)
	} else if config.FilePath != "" {
		// Tibbo connection
		result, err = s.tibboReader.SendCommand(config, command)
	} else {
		return "", errors.New("no valid connection configuration")
	}

	if err != nil {
		return "", fmt.Errorf("failed to execute command: %w", err)
	}

	return result, nil
}
