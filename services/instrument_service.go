package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"lab-connect/backend-api/database"
	"lab-connect/backend-api/models"
	"lab-connect/backend-api/structs"
	"log"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type InstrumentService struct {
	db *gorm.DB
}

func (s *InstrumentService) GetDB() {
	panic("unimplemented")
}

// ============================================
// CHECKLIST SERVICE METHODS
// ============================================

// CreateChecklistTemplate - Create new checklist template
func (s *InstrumentService) CreateChecklistTemplate(req structs.CreateChecklistTemplateRequest) error {
	initialJSON, err := json.Marshal(req.InitialChecklistItems)
	if err != nil {
		return err
	}

	finalJSON, err := json.Marshal(req.FinalChecklistItems)
	if err != nil {
		return err
	}

	template := models.InstrumentChecklistTemplate{
		InstrumentType:        req.InstrumentType,
		TemplateName:          req.TemplateName,
		Description:           req.Description,
		InitialChecklistItems: string(initialJSON),
		FinalChecklistItems:   string(finalJSON),
		IsActive:              true,
	}

	return s.db.Create(&template).Error
}

// UpdateChecklistConfig - Update checklist config for specific instrument
func (s *InstrumentService) UpdateChecklistConfig(req structs.UpdateChecklistConfigRequest) error {
	// Check if config exists
	var config models.InstrumentChecklistConfig
	err := s.db.Where("instrument_id = ?", req.InstrumentID).First(&config).Error

	if err != nil {
		// Create new config if not exists
		config = models.InstrumentChecklistConfig{
			InstrumentID: req.InstrumentID,
		}
	}

	// Update fields if provided
	if req.InitialChecklistItems != nil {
		initialJSON, err := json.Marshal(*req.InitialChecklistItems)
		if err != nil {
			return err
		}
		initialStr := string(initialJSON)
		config.InitialChecklistItems = &initialStr
	}

	if req.FinalChecklistItems != nil {
		finalJSON, err := json.Marshal(*req.FinalChecklistItems)
		if err != nil {
			return err
		}
		finalStr := string(finalJSON)
		config.FinalChecklistItems = &finalStr
	}

	if req.RequireAllInitialOK != nil {
		config.RequireAllInitialOK = *req.RequireAllInitialOK
	}

	if req.RequireAllFinalOK != nil {
		config.RequireAllFinalOK = *req.RequireAllFinalOK
	}

	// Save or update
	if config.Id == 0 {
		return s.db.Create(&config).Error
	}
	return s.db.Save(&config).Error
}

// GetAllChecklistTemplates - Get all templates
func (s *InstrumentService) GetAllChecklistTemplates() ([]structs.ChecklistTemplateResponse, error) {
	var templates []models.InstrumentChecklistTemplate
	if err := s.db.Find(&templates).Error; err != nil {
		return nil, err
	}

	response := make([]structs.ChecklistTemplateResponse, len(templates))
	for i, template := range templates {
		var initialItems []structs.ChecklistItemResponse
		var finalItems []structs.ChecklistItemResponse

		json.Unmarshal([]byte(template.InitialChecklistItems), &initialItems)
		json.Unmarshal([]byte(template.FinalChecklistItems), &finalItems)

		response[i] = structs.ChecklistTemplateResponse{
			Id:                template.Id,
			InstrumentType:    template.InstrumentType,
			TemplateName:      template.TemplateName,
			Description:       template.Description,
			InitialItemsCount: len(initialItems),
			FinalItemsCount:   len(finalItems),
			IsActive:          template.IsActive,
			CreatedAt:         template.CreatedAt,
			UpdatedAt:         template.UpdatedAt,
		}
	}

	return response, nil
}

// GetChecklistTemplateDetail - Get template with items
func (s *InstrumentService) GetChecklistTemplateDetail(templateID uint) (*structs.ChecklistTemplateDetailResponse, error) {
	var template models.InstrumentChecklistTemplate
	if err := s.db.First(&template, templateID).Error; err != nil {
		return nil, err
	}

	var initialItems []structs.ChecklistItemResponse
	var finalItems []structs.ChecklistItemResponse

	json.Unmarshal([]byte(template.InitialChecklistItems), &initialItems)
	json.Unmarshal([]byte(template.FinalChecklistItems), &finalItems)

	return &structs.ChecklistTemplateDetailResponse{
		Id:                    template.Id,
		InstrumentType:        template.InstrumentType,
		TemplateName:          template.TemplateName,
		Description:           template.Description,
		InitialChecklistItems: initialItems,
		FinalChecklistItems:   finalItems,
		IsActive:              template.IsActive,
		CreatedAt:             template.CreatedAt,
		UpdatedAt:             template.UpdatedAt,
	}, nil
}

// UpdateChecklistTemplate - Update template
func (s *InstrumentService) UpdateChecklistTemplate(templateID uint, req structs.CreateChecklistTemplateRequest) error {
	initialJSON, err := json.Marshal(req.InitialChecklistItems)
	if err != nil {
		return err
	}

	finalJSON, err := json.Marshal(req.FinalChecklistItems)
	if err != nil {
		return err
	}

	updates := map[string]interface{}{
		"template_name":           req.TemplateName,
		"description":             req.Description,
		"initial_checklist_items": string(initialJSON),
		"final_checklist_items":   string(finalJSON),
	}

	return s.db.Model(&models.InstrumentChecklistTemplate{}).
		Where("id = ?", templateID).
		Updates(updates).Error
}

// DeleteChecklistTemplate - Delete template
func (s *InstrumentService) DeleteChecklistTemplate(templateID uint) error {
	// Check if any instruments are using this template
	var template models.InstrumentChecklistTemplate
	if err := s.db.First(&template, templateID).Error; err != nil {
		return err
	}

	// Count instruments using this type
	var count int64
	s.db.Model(&models.Instrument{}).
		Where("type = ?", template.InstrumentType).
		Count(&count)

	if count > 0 {
		return fmt.Errorf("cannot delete template: %d instruments are using this type", count)
	}

	return s.db.Delete(&template).Error
}

// GetInstrumentsWithChecklistStatus - Get instruments with checklist config status
func (s *InstrumentService) GetInstrumentsWithChecklistStatus(instrumentType string) ([]structs.InstrumentChecklistStatusResponse, error) {
	query := s.db.Model(&models.Instrument{}).
		Select("instruments.id, instruments.kode_instrument, instruments.nama, instruments.type").
		Joins("LEFT JOIN instrument_checklist_configs ON instruments.id = instrument_checklist_configs.instrument_id")

	if instrumentType != "" {
		query = query.Where("instruments.type = ?", instrumentType)
	}

	var results []struct {
		Id             uint
		KodeInstrument string
		Nama           string
		Type           string
		ConfigID       *uint
	}

	if err := query.
		Select("instruments.id, instruments.kode_instrument, instruments.nama, instruments.type, instrument_checklist_configs.id as config_id").
		Scan(&results).Error; err != nil {
		return nil, err
	}

	response := make([]structs.InstrumentChecklistStatusResponse, len(results))
	for i, result := range results {
		hasCustom := result.ConfigID != nil

		var initialCount, finalCount int
		if hasCustom {
			// Get counts from custom config
			var config models.InstrumentChecklistConfig
			if err := s.db.First(&config, *result.ConfigID).Error; err == nil {
				if config.InitialChecklistItems != nil {
					var items []structs.ChecklistItemResponse
					json.Unmarshal([]byte(*config.InitialChecklistItems), &items)
					initialCount = len(items)
				}
				if config.FinalChecklistItems != nil {
					var items []structs.ChecklistItemResponse
					json.Unmarshal([]byte(*config.FinalChecklistItems), &items)
					finalCount = len(items)
				}
			}
		}

		response[i] = structs.InstrumentChecklistStatusResponse{
			Id:                 result.Id,
			KodeInstrument:     result.KodeInstrument,
			Nama:               result.Nama,
			Type:               result.Type,
			HasCustomChecklist: hasCustom,
			InitialItemsCount:  &initialCount,
			FinalItemsCount:    &finalCount,
		}
	}

	return response, nil
}

// GetInstrumentChecklistConfigDetail - Get config detail with items
func (s *InstrumentService) GetInstrumentChecklistConfigDetail(instrumentID uint) (*structs.InstrumentChecklistConfigDetailResponse, error) {
	// Get instrument
	var instrument models.Instrument
	if err := s.db.First(&instrument, instrumentID).Error; err != nil {
		return nil, err
	}

	// Get custom config if exists
	var config models.InstrumentChecklistConfig
	hasCustom := s.db.Where("instrument_id = ?", instrumentID).First(&config).Error == nil

	response := &structs.InstrumentChecklistConfigDetailResponse{
		InstrumentID:    instrumentID,
		InstrumentName:  instrument.Nama,
		InstrumentType:  instrument.Type,
		HasCustomConfig: hasCustom,
	}

	if hasCustom {
		// Parse custom items
		if config.InitialChecklistItems != nil {
			var items []structs.ChecklistItemResponse
			json.Unmarshal([]byte(*config.InitialChecklistItems), &items)
			response.InitialChecklistItems = items
		}
		if config.FinalChecklistItems != nil {
			var items []structs.ChecklistItemResponse
			json.Unmarshal([]byte(*config.FinalChecklistItems), &items)
			response.FinalChecklistItems = items
		}
		response.RequireAllInitialOK = config.RequireAllInitialOK
		response.RequireAllFinalOK = config.RequireAllFinalOK
	} else {
		// Get from template
		var template models.InstrumentChecklistTemplate
		if err := s.db.Where("instrument_type = ? AND is_active = ?", instrument.Type, true).First(&template).Error; err == nil {
			var initialItems []structs.ChecklistItemResponse
			var finalItems []structs.ChecklistItemResponse

			json.Unmarshal([]byte(template.InitialChecklistItems), &initialItems)
			json.Unmarshal([]byte(template.FinalChecklistItems), &finalItems)

			response.InitialChecklistItems = initialItems
			response.FinalChecklistItems = finalItems
			response.RequireAllInitialOK = true
			response.RequireAllFinalOK = false
		}
	}

	return response, nil
}

func NewInstrumentService() *InstrumentService {
	return &InstrumentService{
		db: database.DB,
	}
}

// ============================================
// LIST INSTRUMENT SERVICES (Section 3)
// ============================================

// GetAllInstruments - Section 3.1
func (s *InstrumentService) GetAllInstruments(filter structs.InstrumentFilterRequest) (*structs.PaginatedInstrumentResponse, error) {
	var instruments []models.Instrument
	var total int64

	query := s.db.Model(&models.Instrument{})

	// Apply filters
	if filter.Site != "" {
		query = query.Where("lokasi_site = ?", filter.Site)
	}

	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}

	if filter.Type != "" {
		query = query.Where("type = ?", filter.Type)
	}

	if filter.Lokasi != "" {
		query = query.Where("lokasi_instrument LIKE ?", "%"+filter.Lokasi+"%")
	}

	if filter.Search != "" {
		query = query.Where(
			"nama LIKE ? OR kode_instrument LIKE ? OR merk LIKE ?",
			"%"+filter.Search+"%",
			"%"+filter.Search+"%",
			"%"+filter.Search+"%",
		)
	}

	// Count total
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	// Apply sorting
	sortBy := "created_at"
	sortOrder := "DESC"
	if filter.SortBy != "" {
		sortBy = filter.SortBy
	}
	if filter.SortOrder != "" {
		sortOrder = strings.ToUpper(filter.SortOrder)
	}
	query = query.Order(fmt.Sprintf("%s %s", sortBy, sortOrder))

	// Apply pagination
	offset := (filter.Page - 1) * filter.Limit
	query = query.Offset(offset).Limit(filter.Limit)

	// Preload relationships
	if err := query.
		Preload("PICUser").
		Preload("PICStockOpname").
		Find(&instruments).Error; err != nil {
		return nil, err
	}

	// Transform to response
	data := make([]structs.InstrumentListResponse, len(instruments))
	for i, instrument := range instruments {
		picStockOpname := ""
		if instrument.PICStockOpname != nil {
			picStockOpname = instrument.PICStockOpname.Name
		}

		data[i] = structs.InstrumentListResponse{
			Id:                 instrument.Id,
			NamaInstrument:     instrument.Nama,
			NomorKontrol:       instrument.KodeInstrument,
			PICInstrument:      instrument.PICUser.Name,
			LokasiInstrument:   instrument.LokasiInstrument,
			LokasiSite:         instrument.LokasiSite,
			TanggalKalibrasi:   instrument.TanggalKalibrasi,
			EDKalibrasi:        instrument.TenggatKalibrasi,
			Status:             instrument.Status,
			TanggalStockOpname: instrument.TanggalStockOpname,
			PICStockOpname:     &picStockOpname,
			KalibrasiColorCode: s.getKalibrasiColorCode(instrument.TenggatKalibrasi),
			BridgePCID:         instrument.BridgePCID,
			BridgePort:         instrument.BridgePort,
			BridgeBaudrate:     instrument.BridgeBaudrate,
			BridgeStatus:       instrument.BridgeStatus,
			LastBridgeSeen:     instrument.LastBridgeSeen,
		}
	}

	totalPages := int(math.Ceil(float64(total) / float64(filter.Limit)))

	return &structs.PaginatedInstrumentResponse{
		Data:       data,
		Total:      total,
		Page:       filter.Page,
		Limit:      filter.Limit,
		TotalPages: totalPages,
	}, nil
}

// CreateInstrument - Section 3.2
func (s *InstrumentService) CreateInstrument(req structs.CreateInstrumentRequest, createdBy uint) (*structs.CreateInstrumentResponse, error) {
	// Check if nomor kontrol already exists
	var existingInstrument models.Instrument
	if err := s.db.Where("kode_instrument = ?", req.NomorKontrol).First(&existingInstrument).Error; err == nil {
		return nil, errors.New("nomor kontrol already exists")
	}

	// Validate nomor kontrol format (XXX-XXX-XXX)
	if !s.validateNomorKontrol(req.NomorKontrol) {
		return nil, errors.New("invalid nomor kontrol format. Must be XXX-XXX-XXX")
	}

	// Validate PIC exists
	var picUser models.User
	if err := s.db.First(&picUser, req.PICInstrumentID).Error; err != nil {
		return nil, errors.New("PIC user not found")
	}

	// Determine instrument type from nama
	instrumentType := s.determineInstrumentType(req.NamaInstrument)

	instrument := models.Instrument{
		KodeInstrument:   req.NomorKontrol,
		Nama:             req.NamaInstrument,
		NomorSeri:        req.NomorSeri,
		Merk:             req.NamaMerk,
		Type:             instrumentType,
		LokasiInstrument: req.Ruangan,
		LokasiSite:       req.LokasiSite,
		Status:           "Available",
		PicUserID:        req.PICInstrumentID,
		TanggalKalibrasi: req.TanggalKalibrasi,
		TenggatKalibrasi: req.EDKalibrasi,
		MassaANT:         req.MassaANT,
	}

	if err := s.db.Create(&instrument).Error; err != nil {
		return nil, err
	}

	return &structs.CreateInstrumentResponse{
		Id:             instrument.Id,
		NomorKontrol:   instrument.KodeInstrument,
		NamaInstrument: instrument.Nama,
		Message:        "Instrument created successfully",
	}, nil
}

// GetInstrumentDetail - Section 3.3
// Replace GetInstrumentDetail function in instrument_service.go
// This ensures unified_history is properly populated

func (s *InstrumentService) GetInstrumentDetail(instrumentID uint) (*structs.InstrumentDetailResponse, error) {
	var instrument models.Instrument

	// ✅ Preload ALL relationships
	if err := s.db.
		Preload("PICUser").
		Preload("PICStockOpname").
		Preload("InstrumentConfig").
		First(&instrument, instrumentID).Error; err != nil {
		return nil, err
	}

	// ✅ Get usage history
	var usageHistory []models.InstrumentUsage
	s.db.Where("instrument_id = ?", instrumentID).
		Order("start_time DESC").
		Limit(50).
		Preload("User").
		Find(&usageHistory)

	usageIDs := make([]uint, len(usageHistory))
	for i, u := range usageHistory {
		usageIDs[i] = u.Id
	}

	var rereadParentIDs []uint
	if len(usageIDs) > 0 {
		s.db.Model(&models.InstrumentUsage{}).
			Where("parent_usage_id IN ?", usageIDs).
			Distinct("parent_usage_id").
			Pluck("parent_usage_id", &rereadParentIDs)
	}

	rereadSet := make(map[uint]bool)
	for _, id := range rereadParentIDs {
		rereadSet[id] = true
	}

	// ✅ Get verification history
	var verificationHistory []models.InstrumentVerification
	s.db.Where("instrument_id = ?", instrumentID).
		Preload("User").
		Preload("Steps"). // ✅ TAMBAH
		Order("verified_at DESC").
		Limit(50).
		Find(&verificationHistory)

	// ✅ Build UNIFIED history
	var unifiedHistory []structs.UnifiedHistoryItem

	// Add usage history
	for _, usage := range usageHistory {
		userName := "-"
		if usage.User.Name != "" {
			userName = usage.User.Name
		}

		var sampelList []string
		if usage.Sampel != "" {
			json.Unmarshal([]byte(usage.Sampel), &sampelList)
		}

		unifiedHistory = append(unifiedHistory, structs.UnifiedHistoryItem{
			Type:           "usage",
			Id:             usage.Id,
			Timestamp:      usage.StartTime,
			User:           userName,
			Status:         usage.StatusPenggunaan,
			IsExported:     usage.IsExported,
			DownloadCount:  usage.DownloadCount,
			EndTime:        usage.EndTime,
			KategoriSampel: usage.KategoriSampel,
			Sampel:         sampelList,
			HasReread:      rereadSet[usage.Id],
			ParentUsageID:  usage.ParentUsageID,
		})
	}

	// Add verification history
	for _, verification := range verificationHistory {
		userName := "-"
		if verification.User.Name != "" {
			userName = verification.User.Name
		}

		var lastCompletedAt *time.Time
		for _, step := range verification.Steps {
			if step.CompletedAt != nil {
				if lastCompletedAt == nil || step.CompletedAt.After(*lastCompletedAt) {
					lastCompletedAt = step.CompletedAt
				}
			}
		}

		unifiedHistory = append(unifiedHistory, structs.UnifiedHistoryItem{
			Type:         "verification",
			Id:           verification.Id,
			Timestamp:    verification.VerifiedAt,
			User:         userName,
			Status:       verification.Status,
			ValidUntil:   &verification.ValidUntil,
			RoomTemp:     verification.RoomTemp,
			RoomHumidity: verification.RoomHumidity,
			Notes:        verification.Notes,
			CompletedAt:  lastCompletedAt,
		})
	}

	// ✅ Sort by timestamp DESC (newest first)
	sort.Slice(unifiedHistory, func(i, j int) bool {
		return unifiedHistory[i].Timestamp.After(unifiedHistory[j].Timestamp)
	})

	// ✅ Limit to 50 most recent
	if len(unifiedHistory) > 50 {
		unifiedHistory = unifiedHistory[:50]
	}

	verificationHistoryItems := make([]structs.VerificationHistoryItem, len(verificationHistory))
	for i, verif := range verificationHistory {
		userName := "-"
		if verif.User.Name != "" {
			userName = verif.User.Name
		}

		verificationHistoryItems[i] = structs.VerificationHistoryItem{
			ID:         verif.Id,
			VerifiedAt: verif.VerifiedAt,
			VerifiedBy: userName,
			ValidUntil: verif.ValidUntil,
			Status:     verif.Status,
		}
	}

	// ✅ Usage history items (untuk backward compatibility)
	usageHistoryItems := make([]structs.UsageHistoryItem, len(usageHistory))
	for i, usage := range usageHistory {
		userName := "-"
		if usage.User.Name != "" {
			userName = usage.User.Name
		}

		usageHistoryItems[i] = structs.UsageHistoryItem{
			Id:               usage.Id,
			TanggalWaktu:     usage.StartTime,
			User:             userName,
			IsExported:       usage.IsExported,
			StatusPenggunaan: usage.StatusPenggunaan,
			DownloadCount:    usage.DownloadCount,
			HasReread:        rereadSet[usage.Id],
			ParentUsageID:    usage.ParentUsageID,
		}
	}

	// ✅ Map verification history dengan tipe yang BENAR
	riwayatVerifikasi := make([]structs.InstrumentVerificationItem, len(verificationHistory))
	for i, verif := range verificationHistory {
		userName := "-"
		if verif.User.Name != "" {
			userName = verif.User.Name
		}

		riwayatVerifikasi[i] = structs.InstrumentVerificationItem{
			Id:             verif.Id,
			VerifiedBy:     userName,
			VerifiedAt:     verif.VerifiedAt,
			Remarks:        verif.Notes, // Notes mapping ke Remarks
			PreviousStatus: "",          // Bisa diisi jika ada data
			NewStatus:      verif.Status,
		}
	}

	// ✅ Map usage history
	riwayatPenggunaan := make([]structs.UsageHistoryItem, len(usageHistory))
	for i, usage := range usageHistory {
		userName := "-"
		if usage.User.Name != "" {
			userName = usage.User.Name
		}

		riwayatPenggunaan[i] = structs.UsageHistoryItem{
			Id:               usage.Id,
			TanggalWaktu:     usage.StartTime,
			User:             userName,
			IsExported:       usage.IsExported,
			StatusPenggunaan: usage.StatusPenggunaan,
			DownloadCount:    usage.DownloadCount,
			HasReread:        rereadSet[usage.Id],
			ParentUsageID:    usage.ParentUsageID,
		}
	}

	// ✅ Build response dengan field yang benar
	response := structs.InstrumentDetailResponse{
		Id:               instrument.Id,
		NamaInstrument:   instrument.Nama,
		NomorKontrol:     instrument.KodeInstrument,
		NomorSeri:        instrument.NomorSeri,
		NamaMerk:         instrument.Merk,
		Type:             instrument.Type,
		LokasiInstrument: instrument.LokasiInstrument,
		LokasiSite:       instrument.LokasiSite,
		PICInstrument: structs.UserBasicInfo{
			Id:   instrument.PICUser.Id,
			Name: instrument.PICUser.Name,
		},
		TanggalKalibrasi:   instrument.TanggalKalibrasi,
		EDKalibrasi:        instrument.TenggatKalibrasi,
		KalibrasiColorCode: s.getKalibrasiColorCode(instrument.TenggatKalibrasi),
		TanggalStockOpname: instrument.TanggalStockOpname,
		Status:             instrument.Status,
		MassaANT:           instrument.MassaANT,

		// ✅ TAMBAHKAN 3 FIELD INI:
		RiwayatPenggunaan: riwayatPenggunaan,
		RiwayatVerifikasi: riwayatVerifikasi,
		UnifiedHistory:    unifiedHistory,

		BridgePCID:     instrument.BridgePCID,
		BridgePort:     instrument.BridgePort,
		BridgeBaudrate: instrument.BridgeBaudrate,
		SharedAccess:   instrument.SharedAccess,
	}

	// ✅ PIC Stock Opname (nullable)
	if instrument.PICStockOpname != nil {
		response.PICStockOpname = &structs.UserBasicInfo{
			Id:   instrument.PICStockOpname.Id,
			Name: instrument.PICStockOpname.Name,
		}
	}

	// ✅ Configuration (nullable)
	if instrument.InstrumentConfig != nil {
		response.Configuration = &structs.InstrumentConfigDetail{
			Id:                 instrument.InstrumentConfig.Id,
			BaudRate:           instrument.InstrumentConfig.BaudRate,
			DataBits:           instrument.InstrumentConfig.DataBits,
			StopBits:           instrument.InstrumentConfig.StopBits,
			Parity:             instrument.InstrumentConfig.Parity,
			ComPort:            instrument.InstrumentConfig.ComPort,
			IPAddress:          instrument.InstrumentConfig.IPAddress,
			TCPPort:            instrument.InstrumentConfig.TCPPort,
			Timeout:            instrument.InstrumentConfig.Timeout,
			RegexPattern:       instrument.InstrumentConfig.RegexPattern,
			FilePath:           instrument.InstrumentConfig.FilePath,
			FilePath2:          instrument.InstrumentConfig.FilePath2,
			CustomCommands:     instrument.InstrumentConfig.CustomCommands,
			ReadCommand:        instrument.InstrumentConfig.ReadCommand,
			ReadingMode:        instrument.InstrumentConfig.ReadingMode,
			NeedsBatch:         instrument.InstrumentConfig.NeedsBatch,
			NeedsSample:        instrument.InstrumentConfig.NeedsSample,
			ReadingSchema:      instrument.InstrumentConfig.ReadingSchema,
			PDFColumns:         instrument.InstrumentConfig.PDFColumns,
			LinesPerItem:       instrument.InstrumentConfig.LinesPerItem,
			RegexFilterEnabled: instrument.InstrumentConfig.RegexFilterEnabled,
		}
	}

	return &response, nil
}

// UpdateConfiguration - Section 3.4
func (s *InstrumentService) UpdateConfiguration(instrumentID uint, req structs.UpdateConfigurationRequest) (*structs.InstrumentConfigDetail, error) {
	var instrument models.Instrument
	if err := s.db.Preload("InstrumentConfig").First(&instrument, instrumentID).Error; err != nil {
		return nil, err
	}

	// Create config if not exists
	if instrument.InstrumentConfig == nil {
		config := models.InstrumentConfig{
			InstrumentID: instrumentID,
		}
		if err := s.db.Create(&config).Error; err != nil {
			return nil, err
		}
		instrument.InstrumentConfig = &config
	}

	// Update only provided fields
	// Update only provided fields
	updates := make(map[string]interface{})

	activeTab := ""
	if req.ActiveTab != nil {
		activeTab = *req.ActiveTab
	}

	switch activeTab {
	case "tcp":
		if req.IPAddress != nil {
			updates["ip_address"] = *req.IPAddress
		} else {
			updates["ip_address"] = nil
		}
		if req.TCPPort != nil {
			updates["tcp_port"] = *req.TCPPort
		} else {
			updates["tcp_port"] = nil
		}
		if req.Timeout != nil {
			updates["timeout"] = *req.Timeout
		} else {
			updates["timeout"] = nil
		}

	case "connectivity":
		if req.ComPort != nil {
			updates["com_port"] = *req.ComPort
		} else {
			updates["com_port"] = nil
		}
		if req.BaudRate != nil {
			updates["baud_rate"] = *req.BaudRate
		} else {
			updates["baud_rate"] = nil
		}
		if req.DataBits != nil {
			updates["data_bits"] = *req.DataBits
		} else {
			updates["data_bits"] = nil
		}
		if req.StopBits != nil {
			updates["stop_bits"] = *req.StopBits
		} else {
			updates["stop_bits"] = nil
		}
		if req.Parity != nil {
			updates["parity"] = *req.Parity
		} else {
			updates["parity"] = nil
		}

	case "parsing":
		if req.RegexPattern != nil {
			updates["regex_pattern"] = *req.RegexPattern
		}
		if req.LinesPerItem != nil {
			updates["lines_per_item"] = *req.LinesPerItem
		}
		if req.RegexFilterEnabled != nil {
			updates["regex_filter_enabled"] = *req.RegexFilterEnabled
		}

	case "pdf":
		if req.FilePath != nil {
			updates["file_path"] = *req.FilePath
		} else {
			updates["file_path"] = nil
		}
		if req.FilePath2 != nil {
			updates["file_path2"] = *req.FilePath2
		} else {
			updates["file_path2"] = nil
		}
		if req.PDFColumns != nil {
			updates["pdf_columns"] = datatypes.JSON([]byte(*req.PDFColumns))
		}

	default:
		// fallback jika active_tab tidak dikirim (behavior lama)
		if req.BaudRate != nil {
			updates["baud_rate"] = *req.BaudRate
		}
		if req.DataBits != nil {
			updates["data_bits"] = *req.DataBits
		}
		if req.StopBits != nil {
			updates["stop_bits"] = *req.StopBits
		}
		if req.Parity != nil {
			updates["parity"] = *req.Parity
		}
		if req.ComPort != nil {
			updates["com_port"] = *req.ComPort
		}
		if req.IPAddress != nil {
			updates["ip_address"] = *req.IPAddress
		}
		if req.TCPPort != nil {
			updates["tcp_port"] = *req.TCPPort
		}
		if req.Timeout != nil {
			updates["timeout"] = *req.Timeout
		}
		if req.RegexPattern != nil {
			updates["regex_pattern"] = *req.RegexPattern
		}
		if req.FilePath != nil {
			updates["file_path"] = *req.FilePath
		}
		if req.FilePath2 != nil {
			updates["file_path2"] = *req.FilePath2
		}
		if req.ReadingMode != nil {
			updates["reading_mode"] = *req.ReadingMode
		}
		if req.NeedsBatch != nil {
			updates["needs_batch"] = *req.NeedsBatch
		}
		if req.NeedsSample != nil {
			updates["needs_sample"] = *req.NeedsSample
		}
		if req.ReadingSchema != nil && len(req.ReadingSchema) > 0 {
			updates["reading_schema"] = string(req.ReadingSchema)
		}
		if req.LinesPerItem != nil {
			updates["lines_per_item"] = *req.LinesPerItem
		}
		if req.RegexFilterEnabled != nil {
			updates["regex_filter_enabled"] = *req.RegexFilterEnabled
		}
		if req.CustomCommands != nil {
			updates["custom_commands"] = *req.CustomCommands
		}
		if req.ReadCommand != nil {
			updates["read_command"] = *req.ReadCommand
		}
		if req.PDFColumns != nil {
			updates["pdf_columns"] = datatypes.JSON([]byte(*req.PDFColumns))
		}
	}

	if err := s.db.Model(&instrument.InstrumentConfig).Updates(updates).Error; err != nil {
		return nil, err
	}

	// Reload config
	var updatedConfig models.InstrumentConfig
	if err := s.db.First(&updatedConfig, instrument.InstrumentConfig.Id).Error; err != nil {
		return nil, err
	}

	// Update instrument status to Available if was Unconfigured
	if instrument.Status == "Unconfigured" {
		s.db.Model(&instrument).Update("status", "Available")
	}

	return &structs.InstrumentConfigDetail{
		Id:                 updatedConfig.Id,
		BaudRate:           updatedConfig.BaudRate,
		DataBits:           updatedConfig.DataBits,
		StopBits:           updatedConfig.StopBits,
		Parity:             updatedConfig.Parity,
		ComPort:            updatedConfig.ComPort,
		IPAddress:          updatedConfig.IPAddress,
		TCPPort:            updatedConfig.TCPPort,
		Timeout:            updatedConfig.Timeout,
		RegexPattern:       updatedConfig.RegexPattern,
		FilePath:           updatedConfig.FilePath,
		FilePath2:          updatedConfig.FilePath2,
		PDFColumns:         updatedConfig.PDFColumns,
		ReadingMode:        updatedConfig.ReadingMode,
		NeedsBatch:         updatedConfig.NeedsBatch,
		NeedsSample:        updatedConfig.NeedsSample,
		ReadingSchema:      updatedConfig.ReadingSchema,
		LinesPerItem:       updatedConfig.LinesPerItem,
		RegexFilterEnabled: updatedConfig.RegexFilterEnabled,
	}, nil
}

// UpdateInstrument - Section 3.5
func (s *InstrumentService) UpdateInstrument(instrumentID uint, req structs.UpdateInstrumentRequest) (*structs.InstrumentDetailResponse, error) {
	var instrument models.Instrument
	if err := s.db.First(&instrument, instrumentID).Error; err != nil {
		return nil, err
	}

	updates := make(map[string]interface{})

	if req.NomorSeri != nil {
		updates["nomor_seri"] = *req.NomorSeri
	}
	if req.NamaMerk != nil {
		updates["merk"] = *req.NamaMerk
	}
	if req.Ruangan != nil {
		updates["lokasi_instrument"] = *req.Ruangan
	}
	if req.LokasiSite != nil {
		updates["lokasi_site"] = *req.LokasiSite
	}
	if req.PICInstrumentID != nil {
		// Validate PIC exists
		var picUser models.User
		if err := s.db.First(&picUser, *req.PICInstrumentID).Error; err != nil {
			return nil, errors.New("PIC user not found")
		}
		updates["pic_user_id"] = *req.PICInstrumentID
	}
	if req.MassaANT != nil {
		updates["massa_ant"] = *req.MassaANT
	}

	// Stock Opname
	if req.TanggalStockOpname != nil {
		updates["tanggal_stock_opname"] = *req.TanggalStockOpname
	} else if req.UseCurrentTimeStock != nil && *req.UseCurrentTimeStock {
		now := time.Now()
		updates["tanggal_stock_opname"] = now
	}

	if req.PICStockOpnameID != nil {
		updates["pic_stock_opname_id"] = *req.PICStockOpnameID
	}

	// Kalibrasi
	if req.TanggalKalibrasi != nil {
		updates["tanggal_kalibrasi"] = *req.TanggalKalibrasi
	} else if req.UseCurrentTimeCal != nil && *req.UseCurrentTimeCal {
		now := time.Now()
		updates["tanggal_kalibrasi"] = now
	}

	if req.EDKalibrasi != nil {
		updates["tenggat_kalibrasi"] = *req.EDKalibrasi
	} else if req.UseCurrentTimeED != nil && *req.UseCurrentTimeED {
		now := time.Now()
		updates["tenggat_kalibrasi"] = now
	}

	if req.SharedAccess != nil {
		updates["shared_access"] = *req.SharedAccess
	}

	// ✅ Handle Bridge Fields
	if req.BridgePCID != nil {
		if *req.BridgePCID == "" {
			// If empty string, set to NULL
			updates["bridge_pc_id"] = nil
		} else {
			updates["bridge_pc_id"] = *req.BridgePCID
		}
	}

	if req.BridgePort != nil {
		if *req.BridgePort == "" {
			updates["bridge_port"] = nil
		} else {
			updates["bridge_port"] = *req.BridgePort
		}
	}

	if req.BridgeBaudrate != nil {
		if *req.BridgeBaudrate == 0 {
			updates["bridge_baudrate"] = nil
		} else {
			updates["bridge_baudrate"] = *req.BridgeBaudrate
		}
	}

	if req.Status != nil && *req.Status != "" {
		updates["status"] = *req.Status
	}

	if err := s.db.Model(&instrument).Updates(updates).Error; err != nil {
		return nil, err
	}

	// Return updated detail
	return s.GetInstrumentDetail(instrumentID)
}

// DeleteInstrument - Section 3.5
func (s *InstrumentService) DeleteInstrument(instrumentID uint) error {
	var instrument models.Instrument
	if err := s.db.First(&instrument, instrumentID).Error; err != nil {
		return err
	}

	// Check if instrument has usage history
	var usageCount int64
	if err := s.db.Model(&models.InstrumentUsage{}).Where("instrument_id = ?", instrumentID).Count(&usageCount).Error; err != nil {
		return err
	}

	if usageCount > 0 {
		return errors.New("cannot delete instrument with usage history")
	}

	return s.db.Delete(&instrument).Error
}

// ============================================
// READ INSTRUMENT SERVICES (Section 4)
// ============================================

// GetInstrumentCategories - Section 4.1
func (s *InstrumentService) GetInstrumentCategories(site string) ([]string, error) {
	var categories []string

	if err := s.db.Model(&models.Instrument{}).
		Where("lokasi_site = ?", site).
		Distinct("type").
		Pluck("type", &categories).Error; err != nil {
		return nil, err
	}

	return categories, nil
}

// GetInstrumentsByType - Section 4.2
// Get instruments filtered by type/category
func (s *InstrumentService) GetInstrumentsByType(instrumentType string, userSite string) ([]structs.InstrumentListResponse, error) {
	var instruments []models.Instrument

	query := s.db.Model(&models.Instrument{}).
		Preload("PICUser").
		Preload("PICStockOpname").
		Preload("InstrumentConfig")

	// Filter by type (Equipment or Instrument)
	// instrumentType from URL: "equipment" or "instrument"
	// Database Type field: "Equipment" or "Instrument"

	switch instrumentType {
	case "equipment":
		// ✅ Alat kecil / Simple Device
		query = query.Where("type = ?", "Equipment")
	case "instrument":
		// ✅ Alat besar
		query = query.Where("type = ?", "Instrument")
	default:
		// If invalid category, return empty result
		return []structs.InstrumentListResponse{}, nil
	}

	// Filter by site if not superadmin
	if userSite != "" {
		query = query.Where("lokasi_site = ?", userSite)
	}

	// ✅ Add ordering for better UX
	query = query.Order("nama ASC")

	if err := query.Find(&instruments).Error; err != nil {
		return nil, err
	}

	// ✅ Transform to response with proper field mapping
	response := make([]structs.InstrumentListResponse, len(instruments))
	for i, inst := range instruments {
		picStockOpname := ""
		if inst.PICStockOpname != nil {
			picStockOpname = inst.PICStockOpname.Name
		}

		response[i] = structs.InstrumentListResponse{
			Id:                 inst.Id,
			NomorKontrol:       inst.KodeInstrument,
			NamaInstrument:     inst.Nama,
			Type:               inst.Type,
			LokasiInstrument:   inst.LokasiInstrument,
			LokasiSite:         inst.LokasiSite,
			PICInstrument:      inst.PICUser.Name,
			Status:             inst.Status,
			TanggalKalibrasi:   inst.TanggalKalibrasi,
			EDKalibrasi:        inst.TenggatKalibrasi,
			TanggalStockOpname: inst.TanggalStockOpname,
			PICStockOpname:     &picStockOpname,
			KalibrasiColorCode: s.getKalibrasiColorCode(inst.TenggatKalibrasi),
		}
	}

	return response, nil
}

func (s *InstrumentService) GetInstrumentsByName(instrumentType string, namaInstrument string, userSite string) ([]structs.InstrumentCodeItem, error) {
	var instruments []models.Instrument

	query := s.db.Model(&models.Instrument{}).
		Preload("PICUser").
		Preload("InstrumentConfig")

	// Filter by type
	switch instrumentType {
	case "equipment":
		query = query.Where("type = ?", "Equipment")
	case "instrument":
		query = query.Where("type = ?", "Instrument")
	default:
		return []structs.InstrumentCodeItem{}, nil
	}

	// Filter by nama
	query = query.Where("nama = ?", namaInstrument)

	// Filter by site
	if userSite != "" {
		query = query.Where("lokasi_site = ?", userSite)
	}

	// Order by kode_instrument
	query = query.Order("kode_instrument ASC")

	if err := query.Find(&instruments).Error; err != nil {
		return nil, err
	}

	// Transform to response
	// Transform to response
	response := make([]structs.InstrumentCodeItem, len(instruments))
	for i, inst := range instruments {
		// Fetch current active usage ID if instrument is "In Used"

		var currentUsageID uint
		var currentUserID uint
		var currentUserName string

		if inst.Status == "In Used" || inst.Status == "In Use" {
			var activeUsage models.InstrumentUsage
			err := s.db.
				Preload("User"). // ← tambah Preload User
				Where("instrument_id = ? AND status_penggunaan NOT IN ?",
					inst.Id,
					[]string{"Done Read", "Cancelled"}).
				Order("start_time DESC").
				First(&activeUsage).Error
			if err == nil {
				currentUsageID = activeUsage.Id
				currentUserID = activeUsage.UserID      // ← tambah
				currentUserName = activeUsage.User.Name // ← tambah
			}
		}

		response[i] = structs.InstrumentCodeItem{
			Id:               inst.Id,
			KodeInstrument:   inst.KodeInstrument,
			Nama:             inst.Nama,
			Type:             inst.Type,
			Status:           inst.Status,
			LokasiInstrument: inst.LokasiInstrument,
			LokasiSite:       inst.LokasiSite,
			PICInstrument:    inst.PICUser.Name,
			TanggalKalibrasi: inst.TanggalKalibrasi,
			EDKalibrasi:      inst.TenggatKalibrasi,
			CurrentUsageID:   currentUsageID,
			CurrentUserID:    currentUserID,
			CurrentUserName:  currentUserName,
			SharedAccess:     inst.SharedAccess,
		}
	}

	return response, nil
}

// Section 4.2.1 - List Nama Instrument
func (s *InstrumentService) GetUniqueInstrumentNamesByType(instrumentType string, userSite string) ([]structs.InstrumentNameGroup, error) {
	var results []struct {
		Nama  string
		Count int64
		Type  string
	}

	query := s.db.Model(&models.Instrument{})

	// Filter by type
	switch instrumentType {
	case "equipment":
		query = query.Where("type = ?", "Equipment")
	case "instrument":
		query = query.Where("type = ?", "Instrument")
	default:
		return []structs.InstrumentNameGroup{}, nil
	}

	// Filter by site
	if userSite != "" {
		query = query.Where("lokasi_site = ?", userSite)
	}

	// Group by nama and count
	if err := query.
		Select("nama, type, COUNT(*) as count").
		Group("nama, type").
		Order("nama ASC").
		Scan(&results).Error; err != nil {
		return nil, err
	}

	// Transform to response
	response := make([]structs.InstrumentNameGroup, len(results))
	for i, result := range results {
		response[i] = structs.InstrumentNameGroup{
			Nama:  result.Nama,
			Type:  result.Type,
			Count: int(result.Count),
		}
	}

	return response, nil
}

// GetUsageHistory
func (s *InstrumentService) GetUsageHistory(instrumentID uint, page, limit int) (map[string]interface{}, error) {
	var usages []models.InstrumentUsage
	var total int64

	offset := (page - 1) * limit

	query := s.db.Model(&models.InstrumentUsage{}).
		Where("instrument_id = ?", instrumentID)

	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	if err := query.
		Preload("User").
		Preload("ApprovedByUser"). // ✅ FIXED: Changed from Approver to ApprovedByUser
		Order("created_at DESC").
		Offset(offset).
		Limit(limit).
		Find(&usages).Error; err != nil {
		return nil, err
	}

	data := make([]map[string]interface{}, len(usages))
	for i, usage := range usages {
		userData := map[string]interface{}{
			"id":   usage.User.Id,
			"name": usage.User.Name,
		}

		item := map[string]interface{}{
			"id":                usage.Id,
			"start_time":        usage.StartTime,
			"end_time":          usage.EndTime,
			"user":              userData,
			"kategori_sampel":   usage.KategoriSampel,
			"jumlah_item":       usage.JumlahItem,
			"final_condition":   usage.FinalCondition,
			"status_penggunaan": usage.StatusPenggunaan,
			"is_exported":       usage.IsExported,
		}

		if usage.ParentUsageID != nil {
			item["parent_usage_id"] = *usage.ParentUsageID
			item["reread_reason"] = usage.RereadReason
		}

		// ✅ FIXED: Use ApprovedByUser instead of Approver
		if usage.ApprovedByUser != nil {
			item["approved_by"] = map[string]interface{}{
				"id":   usage.ApprovedByUser.Id,
				"name": usage.ApprovedByUser.Name,
			}
			item["approved_at"] = usage.ApprovedAt
		}

		data[i] = item
	}

	totalPages := int(math.Ceil(float64(total) / float64(limit)))

	return map[string]interface{}{
		"data":        data,
		"total":       total,
		"page":        page,
		"limit":       limit,
		"total_pages": totalPages,
	}, nil
}

// GetInstrumentByID - Helper
func (s *InstrumentService) GetInstrumentByID(instrumentID uint) (*models.Instrument, error) {
	var instrument models.Instrument
	if err := s.db.First(&instrument, instrumentID).Error; err != nil {
		return nil, err
	}
	return &instrument, nil
}

// ============================================
// HELPER METHODS
// ============================================

// getKalibrasiColorCode - Section 3.3
func (s *InstrumentService) getKalibrasiColorCode(edKalibrasi time.Time) string {
	now := time.Now()
	duration := edKalibrasi.Sub(now)

	// Merah: ED sudah lewat atau hari ini
	if duration <= 0 {
		return "red"
	}

	// Kuning: <= 3 minggu (21 hari)
	if duration <= 21*24*time.Hour {
		return "yellow"
	}

	// Hitam: >= 6 bulan
	return "black"
}

// getStatusColor - Section 4.2
func (s *InstrumentService) getStatusColor(status string) string {
	colorMap := map[string]string{
		"Available":    "green",
		"In Used":      "blue",
		"Unverified":   "orange",
		"Unconfigured": "purple",
		"Unavailable":  "red",
		"Damaged":      "darkred",
	}

	if color, exists := colorMap[status]; exists {
		return color
	}
	return "gray"
}

// validateNomorKontrol
func (s *InstrumentService) validateNomorKontrol(nomorKontrol string) bool {
	// Format: XXX-XXX-XXX (11 karakter total)
	if len(nomorKontrol) != 11 {
		return false
	}

	parts := strings.Split(nomorKontrol, "-")
	if len(parts) != 3 {
		return false
	}

	for _, part := range parts {
		if len(part) != 3 {
			return false
		}
	}

	return true
}

// determineInstrumentType
func (s *InstrumentService) determineInstrumentType(nama string) string {
	namaLower := strings.ToLower(nama)

	// Alat Besar (Instrument)
	bigInstruments := []string{"hplc", "gc", "aas", "ftir", "uv", "spectrophotometer"}
	for _, big := range bigInstruments {
		if strings.Contains(namaLower, big) {
			return "Instrument"
		}
	}

	// Alat Kecil (Equipment)
	return "Equipment"
}

// UpdateInstrumentStatus - Helper untuk update status
func (s *InstrumentService) UpdateInstrumentStatus(instrumentID uint, status string) error {
	return s.db.Model(&models.Instrument{}).
		Where("id = ?", instrumentID).
		Update("status", status).Error
}

// ValidateInitialCondition - Helper untuk validasi kondisi awal
func (s *InstrumentService) ValidateInitialCondition(instrumentID uint, initialCondition map[string]interface{}) (bool, error) {
	// Get instrument type to determine validation rules
	var instrument models.Instrument
	if err := s.db.First(&instrument, instrumentID).Error; err != nil {
		return false, err
	}

	// TODO: Implement specific validation rules based on instrument type
	// For now, return true
	return true, nil
}

// CheckInstrumentAvailability
func (s *InstrumentService) CheckInstrumentAvailability(instrumentID uint) (bool, string, error) {
	var instrument models.Instrument
	if err := s.db.First(&instrument, instrumentID).Error; err != nil {
		return false, "", err
	}

	// Check if status is Available
	if instrument.Status != "Available" {
		return false, instrument.Status, nil
	}

	// Check if calibration is still valid
	if time.Now().After(instrument.TenggatKalibrasi) {
		// Update status to Unavailable
		s.UpdateInstrumentStatus(instrumentID, "Unavailable")
		return false, "Unavailable - Calibration expired", nil
	}

	return true, instrument.Status, nil
}

// GetInstrumentConfiguration
func (s *InstrumentService) GetInstrumentConfiguration(instrumentID uint) (*models.InstrumentConfig, error) {
	var config models.InstrumentConfig
	if err := s.db.Where("instrument_id = ?", instrumentID).First(&config).Error; err != nil {
		return nil, err
	}
	return &config, nil
}

// SaveUsageToHistory - Helper untuk menyimpan usage
func (s *InstrumentService) SaveUsageToHistory(usage *models.InstrumentUsage) error {
	if !database.IsDBAvailable() { // ← CP2
		log.Println("[Offline] DB unavailable — queuing instrument_usage")
		return EnqueueUsage(*usage) // ← CP2
	} // ← CP2
	return s.db.Create(usage).Error
}

// GetUsageByID
func (s *InstrumentService) GetUsageByID(usageID uint) (*models.InstrumentUsage, error) {
	var usage models.InstrumentUsage
	if err := s.db.
		Preload("Instrument").
		Preload("User").
		Preload("UsageResults").
		First(&usage, usageID).Error; err != nil {
		return nil, err
	}
	return &usage, nil
}

// UpdateUsageStatus
func (s *InstrumentService) UpdateUsageStatus(usageID uint, status string) error {
	return s.db.Model(&models.InstrumentUsage{}).
		Where("id = ?", usageID).
		Update("status_penggunaan", status).Error
}

// MarkUsageAsExported
func (s *InstrumentService) MarkUsageAsExported(usageID uint) error {
	return s.db.Model(&models.InstrumentUsage{}).
		Where("id = ?", usageID).
		Update("is_exported", true).Error
}

func (s *InstrumentService) MarkUsageAsSaved(usageID uint) error {
	return s.db.Model(&models.InstrumentUsage{}).
		Where("id = ?", usageID).
		Updates(map[string]interface{}{
			"is_exported":    true,
			"download_count": gorm.Expr("download_count + 1"),
		}).Error
}

func (s *InstrumentService) SavePDFToConfiguredPath(usageID uint) (string, error) {
	// 1. Generate PDF
	pdfPath, err := s.ExportReadingToPDF(usageID, "")
	if err != nil {
		return "", fmt.Errorf("failed to generate PDF: %w", err)
	}

	// 2. Load instrument config for target path
	var usage models.InstrumentUsage
	if err := s.db.Preload("Instrument.InstrumentConfig").First(&usage, usageID).Error; err != nil {
		return "", fmt.Errorf("failed to fetch usage: %w", err)
	}

	config := usage.Instrument.InstrumentConfig
	if config == nil || config.FilePath == "" {
		return "", fmt.Errorf("instrument has no configured file_path")
	}

	// 3. Copy to file_path
	if err := copyPDFFile(pdfPath, config.FilePath); err != nil {
		return "", fmt.Errorf("failed to save PDF to file_path: %w", err)
	}
	log.Printf("[SavePDF] ✅ Saved to %s", config.FilePath)

	// 4. Copy to file_path_2 if configured (non-fatal)
	if config.FilePath2 != "" {
		if err := copyPDFFile(pdfPath, config.FilePath2); err != nil {
			log.Printf("[SavePDF] ⚠️ Could not save to file_path_2 (%s): %v", config.FilePath2, err)
		} else {
			log.Printf("[SavePDF] ✅ Saved to %s", config.FilePath2)
		}
	}

	// 5. Increment download_count — this is what the badge shows
	if err := s.db.Model(&models.InstrumentUsage{}).
		Where("id = ?", usageID).
		Updates(map[string]interface{}{
			"is_exported":    true,
			"download_count": gorm.Expr("download_count + 1"),
		}).Error; err != nil {
		log.Printf("[SavePDF] ⚠️ Failed to increment download_count for usage %d: %v", usageID, err)
	}

	return config.FilePath, nil
}

// copyPDFFile copies src → dst, creating missing directories.
func copyPDFFile(src, dst string) error {
	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return fmt.Errorf("mkdir: %w", err)
	}
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}

// ConvertAdditionalDataToJSON
func (s *InstrumentService) ConvertAdditionalDataToJSON(data map[string]interface{}) (string, error) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return "", err
	}
	return string(jsonData), nil
}

// ParseJSONToMap
func (s *InstrumentService) ParseJSONToMap(jsonStr string) (map[string]interface{}, error) {
	var data map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &data); err != nil {
		return nil, err
	}
	return data, nil
}

// GeneratePDFWithSelectedResults
func (s *InstrumentService) GeneratePDFWithSelectedResults(usageID uint, resultIDs []uint) (string, error) {
	pdfService := NewPDFGeneratorService(s.db)
	logoPath := "" // ← Tambah ini

	return pdfService.GeneratePDFWithResults(usageID, resultIDs, logoPath) // ← Tambah logoPath
}

// GetCustomCommands - Parse custom commands JSON
func (s *InstrumentService) GetCustomCommands(instrumentID uint) ([]structs.MTSICSCommand, error) {
	config, err := s.GetInstrumentConfiguration(instrumentID)
	if err != nil {
		return nil, err
	}

	if config.CustomCommands == "" {
		return []structs.MTSICSCommand{}, nil
	}

	var commands []structs.MTSICSCommand
	if err := json.Unmarshal([]byte(config.CustomCommands), &commands); err != nil {
		return nil, err
	}

	return commands, nil
}

// SaveCustomCommands - Save custom commands for instrument
func (s *InstrumentService) SaveCustomCommands(instrumentID uint, commands []structs.MTSICSCommand) error {
	commandsJSON, err := json.Marshal(commands)
	if err != nil {
		return err
	}

	return s.db.Model(&models.InstrumentConfig{}).
		Where("instrument_id = ?", instrumentID).
		Updates(map[string]interface{}{
			"custom_commands": string(commandsJSON),
		}).Error
}

// GetChecklistForInstrument - Get checklist dengan priority: Individual > Name > Type Template
func (s *InstrumentService) GetChecklistForInstrument(instrumentID uint, checklistType string) (*structs.GetChecklistResponse, error) {
	var instrument models.Instrument
	if err := s.db.First(&instrument, instrumentID).Error; err != nil {
		return nil, errors.New("instrument not found")
	}

	var checklistItems []models.ChecklistItem
	var requireAllOK bool

	// Priority 1: By-name config (base checklist)
	var nameConfig models.InstrumentChecklistByName
	if s.db.Where("instrument_name = ?", instrument.Nama).First(&nameConfig).Error == nil {
		if checklistType == "initial" {
			json.Unmarshal([]byte(nameConfig.InitialChecklistItems), &checklistItems)
			requireAllOK = nameConfig.RequireAllInitialOK
		} else {
			json.Unmarshal([]byte(nameConfig.FinalChecklistItems), &checklistItems)
			requireAllOK = nameConfig.RequireAllFinalOK
		}
	}

	// Fallback: Type template (only if no by-name found)
	if len(checklistItems) == 0 {
		var template models.InstrumentChecklistTemplate
		if s.db.Where("instrument_type = ? AND is_active = ?", instrument.Type, true).First(&template).Error == nil {
			if checklistType == "initial" {
				json.Unmarshal([]byte(template.InitialChecklistItems), &checklistItems)
			} else {
				json.Unmarshal([]byte(template.FinalChecklistItems), &checklistItems)
			}
			requireAllOK = true
		}
	}

	// Additive: Individual config appended on top
	var individualConfig models.InstrumentChecklistConfig
	if s.db.Where("instrument_id = ?", instrumentID).First(&individualConfig).Error == nil {
		var extraItems []models.ChecklistItem
		var itemsJSON string

		if checklistType == "initial" && individualConfig.InitialChecklistItems != nil {
			itemsJSON = *individualConfig.InitialChecklistItems
		} else if checklistType == "final" && individualConfig.FinalChecklistItems != nil {
			itemsJSON = *individualConfig.FinalChecklistItems
		}

		if itemsJSON != "" {
			json.Unmarshal([]byte(itemsJSON), &extraItems)
			checklistItems = append(checklistItems, extraItems...) // ← append, not replace
		}
	}

	if len(checklistItems) == 0 {
		return nil, errors.New("no checklist configuration found for this instrument")
	}

	// Build response
	var items []structs.ChecklistItemResponse
	for _, item := range checklistItems {
		items = append(items, structs.ChecklistItemResponse{
			ID:          item.ID,
			Label:       item.Label,
			Type:        item.Type,
			Required:    item.Required,
			CriticalOK:  item.CriticalOK,
			HelpText:    item.HelpText,
			Placeholder: item.Placeholder,
			MinValue:    item.MinValue,
			MaxValue:    item.MaxValue,
		})
	}

	return &structs.GetChecklistResponse{
		InstrumentID:   instrumentID,
		InstrumentName: instrument.Nama,
		InstrumentType: instrument.Type,
		ChecklistType:  checklistType,
		ChecklistItems: items,
		RequireAllOK:   requireAllOK,
	}, nil
}

// ValidateChecklist - Validasi checklist responses
func (s *InstrumentService) ValidateChecklist(req structs.ValidateChecklistRequest) (*structs.ValidateChecklistResponse, error) {
	// Get instrument
	var instrument models.Instrument
	if err := s.db.First(&instrument, req.InstrumentID).Error; err != nil {
		return nil, errors.New("instrument not found")
	}

	// Get checklist template
	checklistResp, err := s.GetChecklistForInstrument(req.InstrumentID, req.ChecklistType)
	if err != nil {
		return nil, err
	}

	// Validate each response
	var failedItems []int
	var criticalFailed bool
	allOK := true

	responseMap := make(map[int]structs.ChecklistResponseItem)
	for _, resp := range req.Responses {
		responseMap[resp.ID] = resp
	}

	for _, item := range checklistResp.ChecklistItems {
		resp, exists := responseMap[item.ID]

		// Check if required item is missing
		if item.Required && !exists {
			failedItems = append(failedItems, item.ID)
			allOK = false
			if item.CriticalOK {
				criticalFailed = true
			}
			continue
		}

		if !exists {
			continue
		}

		// Validate based on type
		isValid := s.validateChecklistItem(item, resp)

		if !isValid || !resp.OK {
			failedItems = append(failedItems, item.ID)
			allOK = false

			if item.CriticalOK {
				criticalFailed = true
			}
		}
	}

	// Determine if can proceed
	canProceed := true
	instrumentStatus := instrument.Status

	if req.ChecklistType == "initial" {
		// For initial checklist
		if checklistResp.RequireAllOK && !allOK {
			canProceed = false
		}

		if criticalFailed {
			canProceed = false
			instrumentStatus = "Unavailable"
		}
	} else {
		// For final checklist, usually more lenient
		if criticalFailed {
			instrumentStatus = "Unavailable"
		} else if allOK {
			instrumentStatus = "Available"
		}
		// Can always proceed to save final checklist
		canProceed = true
	}

	message := "All checks passed"
	if !allOK {
		message = fmt.Sprintf("%d item(s) failed validation", len(failedItems))
		if criticalFailed {
			message += ". Critical items failed - instrument marked as Unavailable"
		}
	}

	return &structs.ValidateChecklistResponse{
		IsValid:          len(failedItems) == 0 || canProceed,
		AllOK:            allOK,
		FailedItems:      failedItems,
		CriticalFailed:   criticalFailed,
		InstrumentStatus: instrumentStatus,
		Message:          message,
		CanProceed:       canProceed,
	}, nil
}

// validateChecklistItem - Helper to validate individual item
func (s *InstrumentService) validateChecklistItem(item structs.ChecklistItemResponse, resp structs.ChecklistResponseItem) bool {
	switch item.Type {
	case "boolean":
		_, ok := resp.Value.(bool)
		return ok

	case "number":
		val, ok := resp.Value.(float64)
		if !ok {
			return false
		}

		if item.MinValue != nil && val < *item.MinValue {
			return false
		}
		if item.MaxValue != nil && val > *item.MaxValue {
			return false
		}
		return true

	case "text":
		str, ok := resp.Value.(string)
		if !ok {
			return false
		}
		return len(str) > 0

	default:
		return false
	}
}

// ProcessChecklistAndDetermineCondition - Process checklist dan tentukan OK/NOT OK
func (s *InstrumentService) ProcessChecklistAndDetermineCondition(responses []structs.ChecklistResponseItem) (string, map[string]interface{}) {
	allOK := true
	details := make(map[string]interface{})

	for _, resp := range responses {
		if !resp.OK {
			allOK = false
		}

		details[fmt.Sprintf("item_%d", resp.ID)] = map[string]interface{}{
			"value": resp.Value,
			"ok":    resp.OK,
			"note":  resp.Note,
		}
	}

	condition := "OK"
	if !allOK {
		condition = "NOT_OK"
	}

	return condition, details
}

// GetChecklistByNameDetail - Get detail for specific name config
func (s *InstrumentService) GetChecklistByNameDetail(configID uint) (*structs.ChecklistByNameDetail, error) {
	var config models.InstrumentChecklistByName
	if err := database.DB.First(&config, configID).Error; err != nil {
		return nil, err
	}

	var initialItems []models.ChecklistItem
	var finalItems []models.ChecklistItem

	json.Unmarshal([]byte(config.InitialChecklistItems), &initialItems)
	json.Unmarshal([]byte(config.FinalChecklistItems), &finalItems)

	return &structs.ChecklistByNameDetail{
		ID:                    config.Id,
		InstrumentName:        config.InstrumentName,
		InitialChecklistItems: initialItems,
		FinalChecklistItems:   finalItems,
		RequireAllInitialOK:   config.RequireAllInitialOK,
		RequireAllFinalOK:     config.RequireAllFinalOK,
		Description:           config.Description,
		IsActive:              config.IsActive,
		CreatedAt:             config.CreatedAt,
		UpdatedAt:             config.UpdatedAt,
	}, nil
}

// CreateChecklistByName - Create new checklist config for instrument name
func (s *InstrumentService) CreateChecklistByName(req structs.CreateChecklistByNameRequest) error {
	// Check if config already exists
	var existing models.InstrumentChecklistByName
	err := database.DB.Where("instrument_name = ?", req.InstrumentName).First(&existing).Error

	if err == nil {
		return errors.New("checklist configuration already exists for this instrument name")
	}

	// Marshal items to JSON
	initialJSON, err := json.Marshal(req.InitialChecklistItems)
	if err != nil {
		fmt.Println("❌ Error marshaling initial items:", err)
		return err
	}

	finalJSON, err := json.Marshal(req.FinalChecklistItems)
	if err != nil {
		fmt.Println("❌ Error marshaling final items:", err)
		return err
	}

	config := models.InstrumentChecklistByName{
		InstrumentName:        req.InstrumentName,
		InitialChecklistItems: string(initialJSON),
		FinalChecklistItems:   string(finalJSON),
		RequireAllInitialOK:   req.RequireAllInitialOK,
		RequireAllFinalOK:     req.RequireAllFinalOK,
		Description:           req.Description,
		IsActive:              true,
	}

	fmt.Println("✅ Creating config:", config.InstrumentName)

	err = database.DB.Create(&config).Error
	if err != nil {
		fmt.Println("❌ Database error:", err)
		return err
	}

	fmt.Println("✅ Config created successfully, ID:", config.Id)
	return nil
}

// UpdateChecklistByName - Update existing checklist config by name
func (s *InstrumentService) UpdateChecklistByName(configID uint, req structs.CreateChecklistByNameRequest) error {
	var config models.InstrumentChecklistByName
	if err := database.DB.First(&config, configID).Error; err != nil {
		return err
	}

	initialJSON, err := json.Marshal(req.InitialChecklistItems)
	if err != nil {
		return err
	}

	finalJSON, err := json.Marshal(req.FinalChecklistItems)
	if err != nil {
		return err
	}

	config.InstrumentName = req.InstrumentName
	config.InitialChecklistItems = string(initialJSON)
	config.FinalChecklistItems = string(finalJSON)
	config.RequireAllInitialOK = req.RequireAllInitialOK
	config.RequireAllFinalOK = req.RequireAllFinalOK
	config.Description = req.Description

	return database.DB.Save(&config).Error
}

// DeleteChecklistByName - Delete checklist config by name
func (s *InstrumentService) DeleteChecklistByName(configID uint) error {
	return database.DB.Delete(&models.InstrumentChecklistByName{}, configID).Error
}

// 🔧 FIXED: Remove InstrumentType from checklist by name functions
// Replace these functions in your instrument_service.go

func (s *InstrumentService) GetAllChecklistByName(instrumentType string) ([]structs.ChecklistByNameSummary, error) {
	var configs []models.InstrumentChecklistByName
	query := database.DB.Order("instrument_name")

	// 🔧 REMOVED: instrumentType filter - we don't use it anymore
	// if instrumentType != "" {
	// 	query = query.Where("instrument_type = ?", instrumentType)
	// }

	if err := query.Find(&configs).Error; err != nil {
		return nil, err
	}

	var summaries []structs.ChecklistByNameSummary
	for _, config := range configs {
		var initialItems []models.ChecklistItem
		var finalItems []models.ChecklistItem

		json.Unmarshal([]byte(config.InitialChecklistItems), &initialItems)
		json.Unmarshal([]byte(config.FinalChecklistItems), &finalItems)

		summaries = append(summaries, structs.ChecklistByNameSummary{
			ID:                  config.Id,
			InstrumentName:      config.InstrumentName,
			InitialItemsCount:   len(initialItems),
			FinalItemsCount:     len(finalItems),
			RequireAllInitialOK: config.RequireAllInitialOK,
			RequireAllFinalOK:   config.RequireAllFinalOK,
			Description:         config.Description,
			IsActive:            config.IsActive,
			CreatedAt:           config.CreatedAt,
			UpdatedAt:           config.UpdatedAt,
		})
	}

	return summaries, nil
}

func (s *InstrumentService) GetInstrumentNamesByTypeForChecklist(instrumentType string, site string) ([]structs.InstrumentNameWithChecklistStatus, error) {
	var results []structs.InstrumentNameWithChecklistStatus

	// 🔧 FIXED: Removed instrument_type from join condition
	query := `
		SELECT DISTINCT 
			i.nama as instrument_name,
			COUNT(DISTINCT i.id) as instrument_count,
			CASE WHEN cbn.id IS NOT NULL THEN true ELSE false END as has_custom_checklist
		FROM instruments i
		LEFT JOIN instrument_checklist_by_names cbn 
			ON cbn.instrument_name = i.nama
		WHERE i.type = ? AND i.lokasi_site = ?
		GROUP BY i.nama, cbn.id
		ORDER BY i.nama
	`

	err := database.DB.Raw(query, instrumentType, site).Scan(&results).Error
	return results, err
}

func (s *InstrumentService) GetChecklistForInstrumentUpdated(instrumentID uint, checklistType string) (interface{}, error) {
	// Get instrument info
	var instrument models.Instrument
	if err := database.DB.First(&instrument, instrumentID).Error; err != nil {
		return nil, err
	}

	// Priority 1: Individual instrument config
	var individualConfig models.InstrumentChecklistConfig
	err := database.DB.Where("instrument_id = ?", instrumentID).First(&individualConfig).Error
	if err == nil {
		// Has individual config
		var items []models.ChecklistItem
		var itemsJSON string

		if checklistType == "initial" && individualConfig.InitialChecklistItems != nil {
			itemsJSON = *individualConfig.InitialChecklistItems
		} else if checklistType == "final" && individualConfig.FinalChecklistItems != nil {
			itemsJSON = *individualConfig.FinalChecklistItems
		}

		if itemsJSON != "" {
			json.Unmarshal([]byte(itemsJSON), &items)
			return structs.ChecklistResponse{
				Source:              "individual",
				InstrumentID:        instrumentID,
				InstrumentName:      instrument.Nama,
				InstrumentType:      instrument.Type,
				Items:               items,
				RequireAllInitialOK: individualConfig.RequireAllInitialOK,
				RequireAllFinalOK:   individualConfig.RequireAllFinalOK,
			}, nil
		}
	}

	// Priority 2: By-name config
	// 🔧 FIXED: Only match by instrument_name, not instrument_type
	var nameConfig models.InstrumentChecklistByName
	err = database.DB.Where("instrument_name = ?", instrument.Nama).First(&nameConfig).Error
	if err == nil {
		// Has name-based config
		var items []models.ChecklistItem
		if checklistType == "initial" {
			json.Unmarshal([]byte(nameConfig.InitialChecklistItems), &items)
		} else {
			json.Unmarshal([]byte(nameConfig.FinalChecklistItems), &items)
		}

		return structs.ChecklistResponse{
			Source:              "by_name",
			InstrumentID:        instrumentID,
			InstrumentName:      instrument.Nama,
			InstrumentType:      instrument.Type,
			Items:               items,
			RequireAllInitialOK: nameConfig.RequireAllInitialOK,
			RequireAllFinalOK:   nameConfig.RequireAllFinalOK,
		}, nil
	}

	// Priority 3: Type template
	var template models.InstrumentChecklistTemplate
	err = database.DB.Where("instrument_type = ?", instrument.Type).First(&template).Error
	if err != nil {
		return nil, errors.New("no checklist configuration found")
	}

	var items []models.ChecklistItem
	if checklistType == "initial" {
		json.Unmarshal([]byte(template.InitialChecklistItems), &items)
	} else {
		json.Unmarshal([]byte(template.FinalChecklistItems), &items)
	}

	return structs.ChecklistResponse{
		Source:              "template",
		InstrumentID:        instrumentID,
		InstrumentName:      instrument.Nama,
		InstrumentType:      instrument.Type,
		Items:               items,
		RequireAllInitialOK: true, // Template default
		RequireAllFinalOK:   false,
	}, nil
}

func (s *InstrumentService) GetAfterReadingData(usageID uint) (map[string]interface{}, error) {
	var usage models.InstrumentUsage

	if err := s.db.
		Preload("Instrument").
		Preload("User").
		Preload("UsageResults", func(db *gorm.DB) *gorm.DB {
			return db.Order("item_number ASC")
		}).
		First(&usage, usageID).Error; err != nil {
		return nil, err
	}

	var sampel []string
	if len(usage.Sampel) > 0 {
		json.Unmarshal([]byte(usage.Sampel), &sampel)
	}

	rootUsageID := usageID
	var parentUsageID *uint
	if usage.ParentUsageID != nil {
		rootUsageID = *usage.ParentUsageID
		parentUsageID = usage.ParentUsageID
	}

	var allResults []models.UsageResult

	if usage.ParentUsageID != nil {
		// Viewing a reread: load parent results, replace only the reread items
		var parentResults []models.UsageResult
		s.db.Where("instrument_usage_id = ?", *usage.ParentUsageID).
			Order("item_number ASC").
			Find(&parentResults)

		// Build keys for items this reread covers
		rereadItemKeys := make(map[string]bool)
		for _, rr := range usage.UsageResults {
			key := fmt.Sprintf("%s|%d", rr.NoQCBatch, rr.ItemNumber)
			rereadItemKeys[key] = true
		}

		// Keep parent results that are NOT replaced by this reread
		for _, r := range parentResults {
			key := fmt.Sprintf("%s|%d", r.NoQCBatch, r.ItemNumber)
			if !rereadItemKeys[key] {
				allResults = append(allResults, r)
			}
		}
		// Add this reread's results
		allResults = append(allResults, usage.UsageResults...)

	} else {
		// Viewing parent: replace items that have approved child reread results
		var childRereads []models.InstrumentUsage
		s.db.Where("parent_usage_id = ?", usageID).
			Preload("UsageResults").
			Find(&childRereads)

		rereadItemResults := make(map[string]models.UsageResult)
		for _, child := range childRereads {
			if child.ResultStatus == "approved" || child.ResultStatus == "awaiting_approval" ||
				child.StatusPenggunaan == "Done Read" || child.StatusPenggunaan == "Re-read" {
				for i, r := range child.UsageResults {
					var targetItemNumber int
					if child.RereadItemNumber != nil {
						targetItemNumber = *child.RereadItemNumber
					} else {
						targetItemNumber = i + 1
					}
					key := fmt.Sprintf("%s|%d", r.NoQCBatch, targetItemNumber)
					rereadItemResults[key] = r
				}
			}
		}

		for _, r := range usage.UsageResults {
			key := fmt.Sprintf("%s|%d", r.NoQCBatch, r.ItemNumber)
			if rereadResult, isReplaced := rereadItemResults[key]; isReplaced {
				allResults = append(allResults, rereadResult)
			} else {
				allResults = append(allResults, r)
			}
		}
	}

	// Build unique batches from all results
	batchSet := make(map[string]bool)
	for _, result := range allResults {
		if result.NoQCBatch != "" {
			batchSet[result.NoQCBatch] = true
		}
	}

	// Fallback: also get batches from the root usage NoQCBatch
	var rootUsage models.InstrumentUsage
	if usage.ParentUsageID != nil {
		s.db.First(&rootUsage, *usage.ParentUsageID)
	} else {
		rootUsage = usage
	}

	var rootBatchData []struct {
		NoQCBatch  string `json:"no_qc_batch"`
		JumlahItem int    `json:"jumlah_item"`
	}
	if rootUsage.NoQCBatch != "" {
		if err := json.Unmarshal([]byte(rootUsage.NoQCBatch), &rootBatchData); err == nil {
			for _, batch := range rootBatchData {
				if batch.NoQCBatch != "" {
					batchSet[batch.NoQCBatch] = true
				}
			}
		}
	}

	uniqueBatches := make([]string, 0, len(batchSet))
	for batch := range batchSet {
		uniqueBatches = append(uniqueBatches, batch)
	}

	rereadBatchStatus := make(map[string]string)
	requiresApproval := false

	var childRereadsForStatus []models.InstrumentUsage
	s.db.Where("parent_usage_id = ?", rootUsageID).Find(&childRereadsForStatus)

	for _, child := range childRereadsForStatus {
		var additionalData map[string]interface{}
		if child.AdditionalData != "" {
			json.Unmarshal([]byte(child.AdditionalData), &additionalData)
		}
		batchNumber := ""
		if b, ok := additionalData["reread_batch"].(string); ok {
			batchNumber = b
		}
		if batchNumber == "" {
			var batchData []struct {
				NoQCBatch string `json:"no_qc_batch"`
			}
			if json.Unmarshal([]byte(child.NoQCBatch), &batchData) == nil && len(batchData) > 0 {
				batchNumber = batchData[0].NoQCBatch
			}
		}

		status := child.ResultStatus
		if status == "" {
			status = "pending"
		}

		if batchNumber != "" {
			rereadBatchStatus[batchNumber] = status
		}

		if status == "awaiting_approval" || status == "pending" {
			requiresApproval = true
		}
	}

	canExport := (rootUsage.StatusPenggunaan == "Done Read") && len(allResults) > 0 && !requiresApproval

	// Get reread history
	var rereadHistory []models.InstrumentUsage
	s.db.Where("parent_usage_id = ?", rootUsageID).
		Preload("User").
		Find(&rereadHistory)

	rereadData := make([]map[string]interface{}, 0)
	for _, reread := range rereadHistory {
		item := map[string]interface{}{
			"usage_id":      reread.Id,
			"reason":        reread.RereadReason,
			"requested_at":  reread.StartTime,
			"status":        reread.StatusPenggunaan,
			"result_status": reread.ResultStatus,
		}
		if reread.RereadItemNumber != nil {
			item["item_number"] = *reread.RereadItemNumber
		}
		if reread.ApprovedBy != nil {
			var supervisor models.User
			if s.db.First(&supervisor, *reread.ApprovedBy).Error == nil {
				item["approved_by"] = supervisor.Name
			}
			if reread.ApprovedAt != nil {
				item["approved_at"] = reread.ApprovedAt
			}
		}
		if reread.RejectedBy != nil {
			item["reject_notes"] = reread.RejectNotes
		}
		rereadData = append(rereadData, item)
	}

	// Format merged results for display
	batchResults := make([]map[string]interface{}, 0)
	for _, result := range allResults {
		var resultData interface{}
		if result.ResultData != "" {
			if err := json.Unmarshal([]byte(result.ResultData), &resultData); err != nil {
				resultData = map[string]interface{}{
					"error":    true,
					"message":  "Failed to parse result data",
					"raw_data": result.ResultData,
				}
			}
		}

		batchResults = append(batchResults, map[string]interface{}{
			"id":               result.Id,
			"no_qc_batch":      result.NoQCBatch,
			"item_number":      result.ItemNumber,
			"result_data":      resultData,
			"is_reread":        result.IsReread,
			"created_at":       result.CreatedAt,
			"pending_approval": rereadBatchStatus[result.NoQCBatch] == "awaiting_approval",
		})
	}

	response := map[string]interface{}{
		"usage_id":            rootUsage.Id, // Always return root usage ID
		"instrument_id":       rootUsage.InstrumentID,
		"instrument_name":     rootUsage.Instrument.Nama,
		"kategori_sampel":     rootUsage.KategoriSampel,
		"sampel":              sampel,
		"no_qc_batch":         uniqueBatches,
		"status":              rootUsage.StatusPenggunaan,
		"batch_results":       batchResults,
		"reread_history":      rereadData,
		"can_export":          canExport,
		"requires_approval":   requiresApproval,
		"reread_batch_status": rereadBatchStatus,
		"result_status":       rootUsage.ResultStatus,
	}

	if parentUsageID != nil {
		response["parent_usage_id"] = *parentUsageID
		// Also include which reread this is
		response["current_reread_id"] = usageID
		response["current_reread_status"] = usage.ResultStatus
	}

	finalChecklist, checklistErr := s.GetChecklistForInstrument(rootUsage.InstrumentID, "final")
	if checklistErr == nil && len(finalChecklist.ChecklistItems) > 0 {
		response["final_checklist_items"] = finalChecklist.ChecklistItems
		response["require_all_final_ok"] = finalChecklist.RequireAllOK
	} else {
		response["final_checklist_items"] = []interface{}{}
		response["require_all_final_ok"] = false
	}

	return response, nil
}

// SaveReadingResult - Save final condition and selected batch
func (s *InstrumentService) SaveReadingResult(
	usageID uint,
	userID uint,
	finalCondition string,
	selectedBatch string,
	finalChecklistResults map[string]interface{},
) error {
	var usage models.InstrumentUsage
	if err := s.db.First(&usage, usageID).Error; err != nil {
		return err
	}

	log.Printf("🔍 SaveReadingResult — usageID: %d, ParentUsageID: %v, ResultStatus: %s, Status: %s\n",
		usageID, usage.ParentUsageID, usage.ResultStatus, usage.StatusPenggunaan)

	isReread := usage.ParentUsageID != nil

	if isReread && (usage.ResultStatus == "approved" || usage.ResultStatus == "rejected") {
		log.Printf("ℹ️ Skipped — already %s\n", usage.ResultStatus)
		return nil
	}

	return s.db.Transaction(func(tx *gorm.DB) error {
		var finalConditionJSON string
		if finalChecklistResults != nil && len(finalChecklistResults) > 0 {
			finalConditionData := map[string]interface{}{
				"status":               finalCondition,
				"checklist_results":    finalChecklistResults,
				"completed_at":         time.Now(),
				"completed_by_user_id": userID,
			}
			jsonBytes, err := json.Marshal(finalConditionData)
			if err != nil {
				return err
			}
			finalConditionJSON = string(jsonBytes)
		} else {
			finalConditionJSON = finalCondition
		}

		updates := map[string]interface{}{
			"final_condition":   finalConditionJSON,
			"status_penggunaan": "Done Read",
			"end_time":          time.Now(),
		}

		// ✅ Single clean block — no duplicate
		if isReread {
			updates["result_status"] = "awaiting_approval"
		}

		log.Printf("📝 Applying updates — isReread: %v, updates: %+v\n", isReread, updates)

		if err := tx.Model(&models.InstrumentUsage{}).
			Where("id = ?", usageID).
			Updates(updates).Error; err != nil {
			return err
		}

		if finalCondition == "NOT OK" {
			tx.Model(&models.Instrument{}).
				Where("id = ?", usage.InstrumentID).
				Update("status", "Unavailable")
		} else {
			tx.Model(&models.Instrument{}).
				Where("id = ?", usage.InstrumentID).
				Update("status", "Available")
		}

		log.Printf("✅ SaveReadingResult done — usageID: %d, isReread: %v\n", usageID, isReread)
		return nil
	})
}

// ============================================
// RE-READ SERVICE METHODS
// ============================================
// RequestReread - Create re-read request and allow immediate reading
// UPDATED: No longer requires supervisorID parameter
func (s *InstrumentService) RequestReread(
	parentUsageID uint,
	userID uint,
	batchNumber string,
	itemNumber *int,
	reason string,
) (uint, error) {
	var newUsageID uint

	err := s.db.Transaction(func(tx *gorm.DB) error {
		var parentUsage models.InstrumentUsage
		if err := tx.First(&parentUsage, parentUsageID).Error; err != nil {
			return errors.New("parent usage not found")
		}

		// ✅ FIX 1: Use jumlahItem = 1 for item-level rerreads
		jumlahItem := parentUsage.JumlahItem
		if itemNumber != nil {
			jumlahItem = 1 // Only re-reading one specific item
		}

		rereadBatchData := []map[string]interface{}{
			{
				"no_qc_batch": batchNumber,
				"jumlah_item": jumlahItem,
			},
		}

		rereadBatchJSON, err := json.Marshal(rereadBatchData)
		if err != nil {
			return err
		}

		rereadContext := map[string]interface{}{
			"reread_batch":       batchNumber,
			"reread_item_number": itemNumber,
			"parent_usage_id":    parentUsageID,
			"is_reread":          true,
		}

		rereadContextJSON, err := json.Marshal(rereadContext)
		if err != nil {
			return err
		}

		newUsage := models.InstrumentUsage{
			InstrumentID:     parentUsage.InstrumentID,
			UserID:           userID,
			StartTime:        time.Now(),
			KategoriSampel:   parentUsage.KategoriSampel,
			Sampel:           parentUsage.Sampel,
			NoQCBatch:        string(rereadBatchJSON),
			JumlahItem:       jumlahItem, // ✅ FIXED
			InitialCondition: parentUsage.InitialCondition,
			AdditionalData:   string(rereadContextJSON),
			StatusPenggunaan: "Re-read",
			ParentUsageID:    &parentUsageID,
			RereadReason:     reason,
			RereadItemNumber: itemNumber,
			ResultStatus:     "pending",
		}

		if err := tx.Create(&newUsage).Error; err != nil {
			return err
		}

		newUsageID = newUsage.Id

		fmt.Printf("✅ Re-read request created (ID: %d) for batch: %s, jumlahItem: %d\n", newUsageID, batchNumber, jumlahItem)
		if itemNumber != nil {
			fmt.Printf("   → Item #%d only\n", *itemNumber)
		} else {
			fmt.Printf("   → Full batch (%d items)\n", jumlahItem)
		}

		return nil
	})

	return newUsageID, err
}

// CompleteReread - Called after user finishes re-reading
func (s *InstrumentService) CompleteReread(usageID uint) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var usage models.InstrumentUsage
		if err := tx.Preload("Instrument").First(&usage, usageID).Error; err != nil {
			return err
		}

		// Verify this is a re-read
		if usage.StatusPenggunaan != "Re-read" {
			return errors.New("this is not a re-read usage")
		}

		// Verify status is pending
		if usage.ResultStatus != "pending" && usage.ResultStatus != "awaiting_approval" {
			return fmt.Errorf("re-read already processed (status: %s)", usage.ResultStatus)
		}

		// Verify reading is complete (has end_time)
		if usage.EndTime == nil {
			return errors.New("re-read is not yet completed. Please finish the reading first")
		}

		// Update to awaiting approval
		now := time.Now()
		if err := tx.Model(&usage).Updates(map[string]interface{}{
			"result_status": "awaiting_approval",
			"updated_at":    now,
		}).Error; err != nil {
			return err
		}

		// Set instrument back to Available
		if err := tx.Model(&models.Instrument{}).
			Where("id = ?", usage.InstrumentID).
			Update("status", "Available").Error; err != nil {
			return err
		}

		fmt.Printf("✅ Re-read completed (ID: %d). Awaiting supervisor approval.\n", usageID)

		return nil
	})
}

// GetPendingRereadApprovals - Get pending re-read approvals with before/after comparison
// UPDATED: Now returns comparison data
func (s *InstrumentService) GetPendingRereadApprovals(supervisorID uint, userSite string) ([]map[string]interface{}, error) {
	var pendingUsages []models.InstrumentUsage

	query := s.db.Preload("Instrument").
		Preload("User").
		Joins("JOIN instruments ON instruments.id = instrument_usages.instrument_id").
		Where("instrument_usages.parent_usage_id IS NOT NULL").
		Where("instrument_usages.result_status = ?", "awaiting_approval")

	// Only filter by site if provided — avoids silently returning nothing
	if userSite != "" {
		query = query.Where("instruments.lokasi_site = ?", userSite)
	}

	err := query.Order("instrument_usages.updated_at DESC").Find(&pendingUsages).Error
	if err != nil {
		return nil, err
	}

	result := make([]map[string]interface{}, 0)
	for _, usage := range pendingUsages {
		// Parse reread context from additional_data
		var additionalData map[string]interface{}
		var batchNumber string
		var itemNumber *int

		if usage.AdditionalData != "" {
			json.Unmarshal([]byte(usage.AdditionalData), &additionalData)

			// Try multiple keys — AdditionalData gets overwritten by StartAutoReadLoop
			if batch, ok := additionalData["reread_batch"].(string); ok && batch != "" {
				batchNumber = batch
			} else if ctx, ok := additionalData["reread_context"].(map[string]interface{}); ok {
				if batch, ok := ctx["original_batch"].(string); ok {
					batchNumber = batch
				}
			}

			if item, ok := additionalData["reread_item_number"].(float64); ok {
				itemNum := int(item)
				itemNumber = &itemNum
			} else if ctx, ok := additionalData["reread_context"].(map[string]interface{}); ok {
				if itemVal, ok := ctx["original_item"].(float64); ok {
					itemNum := int(itemVal)
					itemNumber = &itemNum
				}
			}
		}

		// Final fallback — always get batch from NoQCBatch
		if batchNumber == "" && usage.NoQCBatch != "" {
			var batchData []struct {
				NoQCBatch string `json:"no_qc_batch"`
			}
			if json.Unmarshal([]byte(usage.NoQCBatch), &batchData) == nil && len(batchData) > 0 {
				batchNumber = batchData[0].NoQCBatch
			}
		}

		// Get result count
		var resultCount int64
		s.db.Model(&models.UsageResult{}).
			Where("instrument_usage_id = ?", usage.Id).
			Count(&resultCount)

		item := map[string]interface{}{
			"usage_id":        usage.Id,
			"instrument_id":   usage.InstrumentID,
			"instrument_name": usage.Instrument.Nama,
			"instrument_code": usage.Instrument.KodeInstrument,
			"user_name":       usage.User.Name,
			"user_id":         usage.UserID,
			"reason":          usage.RereadReason,
			"requested_at":    usage.StartTime,
			"submitted_at":    usage.UpdatedAt,
			"batch_number":    batchNumber,
			"kategori_sampel": usage.KategoriSampel,
			"result_count":    resultCount,
			"result_status":   usage.ResultStatus,
		}

		if usage.ParentUsageID != nil {
			var parentUsage models.InstrumentUsage
			s.db.Preload("UsageResults").First(&parentUsage, *usage.ParentUsageID)

			// Reload this usage with its results
			var rereadUsage models.InstrumentUsage
			s.db.Preload("UsageResults").First(&rereadUsage, usage.Id)

			comparison := s.buildComparisonData(&parentUsage, &rereadUsage)
			item["has_changes"] = comparison["has_changes"]
			item["changed_items"] = comparison["changed_items"]

			item["original_reading"] = s.buildReadingDataForModal(&parentUsage)
			item["reread_result"] = s.buildReadingDataForModal(&rereadUsage)
			item["comparison"] = comparison
		} else {
			item["has_changes"] = false
			item["changed_items"] = []interface{}{}
		}

		if itemNumber != nil {
			item["item_number"] = *itemNumber
			item["reread_type"] = "item"
		} else {
			item["reread_type"] = "batch"
		}

		result = append(result, item)
	}

	return result, nil
}

// Helper: Build reading data structure
func (s *InstrumentService) buildReadingData(usage *models.InstrumentUsage) map[string]interface{} {
	if usage == nil {
		return nil
	}

	userName := ""
	if usage.User.Name != "" {
		userName = usage.User.Name
	}

	return map[string]interface{}{
		"usage_id":        usage.Id,
		"read_at":         usage.EndTime,
		"final_condition": usage.FinalCondition,
		"results":         usage.UsageResults,
		"user_name":       userName,
	}
}

func (s *InstrumentService) buildReadingDataForModal(usage *models.InstrumentUsage) map[string]interface{} {
	if usage == nil {
		return nil
	}

	userName := ""
	if usage.User.Name != "" {
		userName = usage.User.Name
	}

	var readAt interface{}
	if usage.EndTime != nil {
		readAt = usage.EndTime
	} else {
		readAt = usage.StartTime
	}

	// Keys to skip — internal/metadata fields
	skipKeys := map[string]bool{
		"raw_data": true, "raw_text": true, "matched": true,
		"parsed": true, "timestamp": true, "error": true, "message": true,
	}

	formattedResults := make([]map[string]interface{}, 0)
	for _, r := range usage.UsageResults {
		var parsed map[string]interface{}
		json.Unmarshal([]byte(r.ResultData), &parsed)

		// Build display value from all meaningful fields
		unit := ""
		if u, ok := parsed["unit"]; ok {
			unit = fmt.Sprintf("%v", u)
		}

		// Collect data fields (excluding metadata keys and numeric artifact keys)
		dataFields := make(map[string]interface{})
		for k, v := range parsed {
			if skipKeys[k] || isNumericMapKey(k) {
				continue
			}
			dataFields[k] = v
		}

		// Build a human-readable value string:
		// If single field "value" exists, use it directly.
		// Otherwise join all fields as "key: val" pairs.
		value := ""
		if v, ok := dataFields["value"]; ok && len(dataFields) == 1 {
			value = fmt.Sprintf("%v", v)
		} else {
			parts := []string{}
			for k, v := range dataFields {
				if k != "unit" {
					parts = append(parts, fmt.Sprintf("%s: %v", k, v))
				}
			}
			sort.Strings(parts)
			value = strings.Join(parts, " | ")
		}

		formattedResults = append(formattedResults, map[string]interface{}{
			"item_number": r.ItemNumber,
			"value":       value,
			"unit":        unit,
			"status":      "OK",
			"raw_data":    dataFields,
		})
	}

	return map[string]interface{}{
		"usage_id":        usage.Id,
		"read_at":         readAt,
		"final_condition": usage.FinalCondition,
		"user_name":       userName,
		"results":         formattedResults,
	}
}

// isNumericMapKey returns true if a key is a plain number — artifact from buggy regex parsers.
func isNumericMapKey(key string) bool {
	if key == "" {
		return false
	}
	dotSeen := false
	for _, r := range key {
		if r == '.' {
			if dotSeen {
				return false
			}
			dotSeen = true
			continue
		}
		if !unicode.IsDigit(r) {
			return false
		}
	}
	return true
}

// Helper: Build comparison between original and re-read
func (s *InstrumentService) buildComparisonData(original *models.InstrumentUsage, reread *models.InstrumentUsage) map[string]interface{} {
	if original == nil || reread == nil {
		return map[string]interface{}{
			"has_changes":   false,
			"changed_items": []interface{}{},
		}
	}

	changedItems := []map[string]interface{}{}
	hasChanges := false

	// ✅ FIX 4: Key by "batch|item" to prevent cross-batch item number collisions
	originalMap := make(map[string]models.UsageResult)
	for _, result := range original.UsageResults {
		key := fmt.Sprintf("%s|%d", result.NoQCBatch, result.ItemNumber)
		originalMap[key] = result
	}

	for _, rereadResult := range reread.UsageResults {
		key := fmt.Sprintf("%s|%d", rereadResult.NoQCBatch, rereadResult.ItemNumber)
		originalResult, exists := originalMap[key]
		if !exists {
			// This item wasn't in the original — skip (shouldn't happen in normal flow)
			continue
		}

		valueChanged := originalResult.ResultData != rereadResult.ResultData
		if valueChanged {
			hasChanges = true

			// Try to extract a numeric difference from parsed JSON
			var difference *float64
			var origParsed, rereadParsed map[string]interface{}
			if json.Unmarshal([]byte(originalResult.ResultData), &origParsed) == nil &&
				json.Unmarshal([]byte(rereadResult.ResultData), &rereadParsed) == nil {
				origValStr := fmt.Sprintf("%v", origParsed["value"])
				rereadValStr := fmt.Sprintf("%v", rereadParsed["value"])
				if origVal, err1 := strconv.ParseFloat(origValStr, 64); err1 == nil {
					if rereadVal, err2 := strconv.ParseFloat(rereadValStr, 64); err2 == nil {
						diff := rereadVal - origVal
						difference = &diff
					}
				}
			}

			changedItems = append(changedItems, map[string]interface{}{
				"item_number":    rereadResult.ItemNumber,
				"no_qc_batch":    rereadResult.NoQCBatch,
				"original_value": originalResult.ResultData,
				"reread_value":   rereadResult.ResultData,
				"difference":     difference,
				"value_changed":  true,
			})
		}
	}

	conditionChanged := original.FinalCondition != reread.FinalCondition
	if conditionChanged {
		hasChanges = true
	}

	return map[string]interface{}{
		"has_changes":              hasChanges,
		"changed_items":            changedItems,
		"original_final_condition": original.FinalCondition,
		"reread_final_condition":   reread.FinalCondition,
		"condition_changed":        conditionChanged,
	}
}

// ApproveReread - Supervisor approves or rejects re-read RESULTS
// UPDATED: Now checks result_status instead of just approved_by
func (s *InstrumentService) ApproveReread(usageID, supervisorID uint, approved bool, notes string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var usage models.InstrumentUsage
		if err := tx.First(&usage, usageID).Error; err != nil {
			return err
		}

		// ✅ FIX 2a: Check ParentUsageID instead of status string
		// "Re-read" status may differ depending on save path
		if usage.ParentUsageID == nil {
			return errors.New("this usage is not a re-read (no parent usage)")
		}

		if usage.ResultStatus == "approved" && approved {
			fmt.Printf("ℹ️ Re-read %d is already approved (no-op)\n", usageID)
			return nil
		}
		if usage.ResultStatus == "rejected" && !approved {
			fmt.Printf("ℹ️ Re-read %d is already rejected (no-op)\n", usageID)
			return nil
		}

		// Block re-processing with a different decision
		if usage.ResultStatus == "approved" || usage.ResultStatus == "rejected" {
			return fmt.Errorf("re-read has already been %s and cannot be changed", usage.ResultStatus)
		}

		// Must be awaiting_approval to process
		if usage.ResultStatus != "awaiting_approval" {
			return fmt.Errorf("re-read is not awaiting approval (current status: '%s'). "+
				"The user must complete the re-read and submit it first.", usage.ResultStatus)
		}

		now := time.Now()

		if approved {
			err := tx.Model(&usage).Updates(map[string]interface{}{
				"approved_by":       supervisorID,
				"approved_at":       now,
				"result_status":     "approved",
				"status_penggunaan": "Done Read", // Now exportable
				"updated_at":        now,
			}).Error
			if err != nil {
				return err
			}
			fmt.Printf("✅ Re-read APPROVED by supervisor %d for usage %d\n", supervisorID, usageID)
		} else {
			err := tx.Model(&usage).Updates(map[string]interface{}{
				"rejected_by":       supervisorID,
				"rejected_at":       now,
				"reject_notes":      notes,
				"result_status":     "rejected",
				"status_penggunaan": "Done Read", // ← ADD THIS
				"updated_at":        now,
			}).Error
			if err != nil {
				return err
			}
			fmt.Printf("❌ Re-read REJECTED by supervisor %d for usage %d. Reason: %s\n", supervisorID, usageID, notes)
		}
		return nil
	})
}

// ============================================
// EXPORT TO PDF - INTEGRATED WITH EXISTING PDFGeneratorService
// ============================================

// ExportReadingToPDF - Export batch results to PDF using existing PDFGeneratorService
// ✅ REPLACE the entire ExportReadingToPDF function with this:
func (s *InstrumentService) ExportReadingToPDF(usageID uint, batchNumber string) (string, error) {
	var usage models.InstrumentUsage
	if err := s.db.Preload("Instrument").
		Preload("Instrument.InstrumentConfig").
		Preload("Instrument.PICUser").
		Preload("User").
		First(&usage, usageID).Error; err != nil {
		return "", fmt.Errorf("failed to fetch usage: %w", err)
	}

	// ✅ BUG FIX 1: Block export if this is an unapproved reread
	if usage.ParentUsageID != nil {
		if usage.ResultStatus == "pending" || usage.ResultStatus == "awaiting_approval" || usage.ResultStatus == "" {
			return "", fmt.Errorf("reread results must be approved by supervisor before export (current status: %s)", usage.ResultStatus)
		}
	}

	// ✅ BUG FIX 2: If this is a reread, resolve to parent and collect merged results
	// so all original batches + approved reread batch appear in one PDF
	rootUsageID := usageID

	if usage.ParentUsageID != nil {
		rootUsageID = *usage.ParentUsageID
		// Reload as parent for PDF header/metadata
		if err := s.db.Preload("Instrument").
			Preload("Instrument.InstrumentConfig").
			Preload("Instrument.PICUser").
			Preload("User").
			First(&usage, rootUsageID).Error; err != nil {
			return "", fmt.Errorf("failed to fetch parent usage: %w", err)
		}
	}

	// ✅ Also block export if parent still has any pending child rereads
	var pendingChildCount int64
	s.db.Model(&models.InstrumentUsage{}).
		Where("parent_usage_id = ?", rootUsageID).
		Where("result_status IN ?", []string{"pending", "awaiting_approval", ""}).
		Count(&pendingChildCount)

	if pendingChildCount > 0 {
		return "", fmt.Errorf("cannot export: %d reread batch(es) are still awaiting supervisor approval", pendingChildCount)
	}

	// ✅ Collect merged result IDs: parent results replaced by approved reread results
	// This mirrors the same logic as GetAfterReadingData
	var parentResults []models.UsageResult
	s.db.Where("instrument_usage_id = ?", rootUsageID).
		Order("item_number ASC").
		Find(&parentResults)

	if len(parentResults) == 0 {
		s.db.Joins("JOIN instrument_usages ON instrument_usages.id = usage_results.instrument_usage_id").
			Where("instrument_usages.parent_usage_id = ? OR instrument_usages.id = ?", rootUsageID, rootUsageID).
			Order("usage_results.item_number ASC").
			Find(&parentResults)
	}
	// Load approved child rereads and their results
	var childRereads []models.InstrumentUsage
	s.db.Where("parent_usage_id = ?", rootUsageID).
		Where("result_status = ?", "approved").
		Preload("UsageResults").
		Find(&childRereads)

	// Build item-level replacement map: "batch|item" -> reread result ID
	rereadItemResultIDs := make(map[string]uint)
	for _, child := range childRereads {
		for i, r := range child.UsageResults {
			var targetItemNumber int
			if child.RereadItemNumber != nil {
				// Item-level reread: the reread targets a specific item in the parent
				targetItemNumber = *child.RereadItemNumber
			} else {
				// Full-batch reread: item numbers map 1:1
				targetItemNumber = i + 1
			}
			key := fmt.Sprintf("%s|%d", r.NoQCBatch, targetItemNumber)
			rereadItemResultIDs[key] = r.Id
		}
	}

	// Build final result ID list — original items replaced where reread is approved
	resultIDs := make([]uint, 0)
	for _, r := range parentResults {
		key := fmt.Sprintf("%s|%d", r.NoQCBatch, r.ItemNumber)
		if rereadID, replaced := rereadItemResultIDs[key]; replaced {
			resultIDs = append(resultIDs, rereadID) // use reread result
		} else {
			resultIDs = append(resultIDs, r.Id) // use original result
		}
	}

	// Add any reread results for items not in parent (edge case: full batch reread)
	addedIDs := make(map[uint]bool)
	for _, id := range resultIDs {
		addedIDs[id] = true
	}
	for _, child := range childRereads {
		for _, r := range child.UsageResults {
			if !addedIDs[r.Id] {
				resultIDs = append(resultIDs, r.Id)
			}
		}
	}

	if len(resultIDs) == 0 {
		return "", fmt.Errorf("no results found for export")
	}

	logoPath := "assets/Bintang_Toedjoe_logo.png"
	pdfGenerator := NewPDFGeneratorService(s.db)

	// ✅ Always generate PDF under the root (parent) usage ID
	pdfPath, err := pdfGenerator.GeneratePDFWithResults(rootUsageID, resultIDs, logoPath)
	if err != nil {
		return "", fmt.Errorf("failed to generate PDF: %w", err)
	}

	fmt.Printf("[AfterReading] PDF generated successfully: %s\n", pdfPath)
	return pdfPath, nil
}

// ============================================
// ALTERNATIVE: Export ALL batches to separate PDFs
// ============================================

// ExportAllBatchesToPDF - Export each batch to a separate PDF
func (s *InstrumentService) ExportAllBatchesToPDF(usageID uint) ([]string, error) {
	var usage models.InstrumentUsage
	err := s.db.Preload("UsageResults").First(&usage, usageID).Error
	if err != nil {
		return nil, fmt.Errorf("failed to fetch usage: %w", err)
	}

	// Group results by batch
	batchMap := make(map[string][]uint)
	for _, result := range usage.UsageResults {
		batchMap[result.NoQCBatch] = append(batchMap[result.NoQCBatch], result.Id)
	}

	pdfGenerator := NewPDFGeneratorService(s.db)
	logoPath := "assets/Bintang_Toedjoe_logo.png"

	pdfPaths := make([]string, 0, len(batchMap))

	// Generate PDF for each batch
	for batchNumber, resultIDs := range batchMap {
		pdfPath, err := pdfGenerator.GeneratePDFWithResults(usageID, resultIDs, logoPath)
		if err != nil {
			fmt.Printf("[AfterReading] Warning: Failed to generate PDF for batch %s: %v\n", batchNumber, err)
			continue
		}
		pdfPaths = append(pdfPaths, pdfPath)
		fmt.Printf("[AfterReading] Generated PDF for batch %s: %s\n", batchNumber, pdfPath)
	}

	if len(pdfPaths) == 0 {
		return nil, fmt.Errorf("failed to generate any PDFs")
	}

	return pdfPaths, nil
}

// ============================================
// HELPER: Get batch-specific results
// ============================================

// GetBatchResults - Get results for a specific batch number
func (s *InstrumentService) GetBatchResults(usageID uint, batchNumber string) ([]models.UsageResult, error) {
	var results []models.UsageResult
	err := s.db.Where("instrument_usage_id = ? AND no_qc_batch = ?", usageID, batchNumber).
		Order("item_number ASC").
		Find(&results).Error

	if err != nil {
		return nil, fmt.Errorf("failed to fetch batch results: %w", err)
	}
	return results, nil
}
