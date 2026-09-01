package controllers

import (
	"encoding/json"
	"fmt"
	"io"
	"lab-connect/backend-api/database"
	"lab-connect/backend-api/middlewares"
	"lab-connect/backend-api/models"
	"lab-connect/backend-api/services"
	"lab-connect/backend-api/structs"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"gorm.io/gorm"
)

type InstrumentController struct {
	instrumentService *services.InstrumentService
	readerService     *services.InstrumentReaderService
	validate          *validator.Validate
}

func NewInstrumentController(
	instrumentService *services.InstrumentService,
	readerService *services.InstrumentReaderService,
) *InstrumentController {
	return &InstrumentController{
		instrumentService: instrumentService,
		readerService:     readerService,
		validate:          validator.New(),
	}
}

// ============================================
// LIST INSTRUMENT ENDPOINTS (Section 3)
// ============================================

// GetAllInstruments - Section 3.1
// GET /api/instruments
func (c *InstrumentController) GetAllInstruments(ctx *gin.Context) {
	// Get user info from JWT middleware using helper
	userRole, _ := middlewares.GetUserRole(ctx)
	userSite, _ := middlewares.GetUserSite(ctx)

	// Parse filter & pagination
	var filter structs.InstrumentFilterRequest
	if err := ctx.ShouldBindQuery(&filter); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid query parameters", err)
		return
	}

	// Apply site filter based on user role
	if userRole != "superadmin" && userRole != "administrator" {
		filter.Site = userSite
	}

	// Set default pagination
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.Limit < 1 {
		filter.Limit = 10
	}

	result, err := c.instrumentService.GetAllInstruments(filter)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to fetch instruments", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Instruments retrieved successfully", result)
}

// CreateInstrument - Section 3.2
// POST /api/instruments
func (c *InstrumentController) CreateInstrument(ctx *gin.Context) {
	userID, _ := middlewares.GetUserID(ctx)
	userRole, _ := middlewares.GetUserRole(ctx)
	userSite, _ := middlewares.GetUserSite(ctx)

	var req structs.CreateInstrumentRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Validate request
	if err := c.validate.Struct(req); err != nil {
		respondWithValidationError(ctx, err)
		return
	}

	// If not superadmin, use user's site
	if userRole != "superadmin" {
		req.LokasiSite = userSite
	}

	result, err := c.instrumentService.CreateInstrument(req, userID)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to create instrument", err)
		return
	}

	respondWithSuccess(ctx, http.StatusCreated, "Instrument created successfully", result)
}

// GetInstrumentDetail - Section 3.3
// GET /api/instruments/:id
func (c *InstrumentController) GetInstrumentDetail(ctx *gin.Context) {
	instrumentID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid instrument ID", err)
		return
	}

	result, err := c.instrumentService.GetInstrumentDetail(instrumentID)
	if err != nil {
		respondWithError(ctx, http.StatusNotFound, "Instrument not found", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Instrument detail retrieved successfully", result)
}

// UpdateInstrumentConfiguration - Section 3.4
// PUT /api/instruments/:id/configuration
func (c *InstrumentController) UpdateInstrumentConfiguration(ctx *gin.Context) {
	instrumentID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid instrument ID", err)
		return
	}

	var req structs.UpdateConfigurationRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if err := c.validate.Struct(req); err != nil {
		respondWithValidationError(ctx, err)
		return
	}

	result, err := c.instrumentService.UpdateConfiguration(instrumentID, req)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to update configuration", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Configuration updated successfully", result)
}

// TestConnection - Section 3.4.1
// POST /api/instruments/:id/test-connection
func (c *InstrumentController) TestConnection(ctx *gin.Context) {
	instrumentID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid instrument ID", err)
		return
	}

	var req structs.TestConnectionRequest
	req.InstrumentID = instrumentID

	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	result, err := c.readerService.TestConnection(req)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Connection test failed", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Connection test completed", result)
}

// UpdateInstrument - Section 3.5
// PUT /api/instruments/:id
func (c *InstrumentController) UpdateInstrument(ctx *gin.Context) {
	userID, _ := middlewares.GetUserID(ctx)

	instrumentID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid instrument ID", err)
		return
	}

	// Check permission: Superadmin, Administrator, or PIC Instrument
	instrument, err := c.instrumentService.GetInstrumentByID(instrumentID)
	if err != nil {
		respondWithError(ctx, http.StatusNotFound, "Instrument not found", err)
		return
	}

	if !middlewares.HasMinGroup(ctx, 4) && instrument.PicUserID != userID {
		respondWithError(ctx, http.StatusForbidden, "You don't have permission to edit this instrument", nil)
		return
	}

	var req structs.UpdateInstrumentRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if err := c.validate.Struct(req); err != nil {
		respondWithValidationError(ctx, err)
		return
	}

	result, err := c.instrumentService.UpdateInstrument(instrumentID, req)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to update instrument", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Instrument updated successfully", result)
}

// DeleteInstrument - Section 3.5
// DELETE /api/instruments/:id
func (c *InstrumentController) DeleteInstrument(ctx *gin.Context) {
	instrumentID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid instrument ID", err)
		return
	}

	err = c.instrumentService.DeleteInstrument(instrumentID)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to delete instrument", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Instrument deleted successfully", nil)
}

// ============================================
// READ INSTRUMENT ENDPOINTS (Section 4)
// ============================================

// GetInstrumentCategories - Section 4.1
// GET /api/instruments/categories
func (c *InstrumentController) GetInstrumentCategories(ctx *gin.Context) {
	userSite, _ := middlewares.GetUserSite(ctx)

	categories, err := c.instrumentService.GetInstrumentCategories(userSite)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to fetch categories", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Categories retrieved successfully", structs.CategoryInstrumentResponse{
		Categories: categories,
	})
}

// GetInstrumentsByType - Section 4.2
// GET /api/instruments/by-type/:type
func (c *InstrumentController) GetInstrumentsByType(ctx *gin.Context) {
	instrumentType := ctx.Param("type")
	userSite, _ := middlewares.GetUserSite(ctx)

	instruments, err := c.instrumentService.GetInstrumentsByType(instrumentType, userSite)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to fetch instruments", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Instruments retrieved successfully", instruments)
}

// GetInstrumentNamesByType - Section 4.2.1
// GET /api/instruments/by-type/:type/names
func (c *InstrumentController) GetInstrumentNamesByType(ctx *gin.Context) {
	instrumentType := ctx.Param("type")
	userSite, _ := middlewares.GetUserSite(ctx)

	names, err := c.instrumentService.GetUniqueInstrumentNamesByType(instrumentType, userSite)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to fetch instrument names", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Instrument names retrieved successfully", names)
}

// GetInstrumentsByName - Section 4.2.2
// GET /api/instruments/by-type/:type/nama/:nama
func (c *InstrumentController) GetInstrumentsByName(ctx *gin.Context) {
	instrumentType := ctx.Param("type")
	namaInstrument := ctx.Param("nama")
	userSite, _ := middlewares.GetUserSite(ctx)

	instruments, err := c.instrumentService.GetInstrumentsByName(instrumentType, namaInstrument, userSite)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to fetch instruments", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Instruments retrieved successfully", instruments)
}

// StartReadProcess - Section 4.3
// POST /api/instruments/:id/start-read
func (c *InstrumentController) StartReadProcess(ctx *gin.Context) {
	userID, _ := middlewares.GetUserID(ctx)

	instrumentID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid instrument ID", err)
		return
	}

	var req structs.StartReadRequestWithChecklist
	req.InstrumentID = instrumentID

	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Parse reread context once at the top
	isReread := false
	var existingRereadUsageID uint
	if req.AdditionalData != nil {
		if v, ok := req.AdditionalData["is_reread"].(bool); ok && v {
			isReread = true
		}
		if v, ok := req.AdditionalData["reread_usage_id"].(float64); ok && v > 0 {
			existingRereadUsageID = uint(v)
		}
	}

	// Reread path — skip instrument check, return existing usage
	if isReread && existingRereadUsageID > 0 {
		existingUsage, err := c.instrumentService.GetUsageByID(existingRereadUsageID)
		if err != nil {
			respondWithError(ctx, http.StatusNotFound, "Reread usage not found", err)
			return
		}

		respondWithSuccess(ctx, http.StatusOK, "Reread process resumed", map[string]interface{}{
			"usage_id":        existingUsage.Id,
			"instrument_id":   existingUsage.InstrumentID,
			"is_reread":       true,
			"parent_usage_id": existingUsage.ParentUsageID,
		})
		return
	}

	// Normal flow — check availability
	instrument, err := c.instrumentService.GetInstrumentByID(instrumentID)
	if err != nil {
		respondWithError(ctx, http.StatusNotFound, "Instrument not found", err)
		return
	}

	if instrument.Status != "Available" {
		respondWithError(ctx, http.StatusBadRequest, "Instrument is not available. Current status: "+instrument.Status, nil)
		return
	}

	// Build initial condition from checklist (isReread already known, no redeclaration)
	initialConditionData := make(map[string]interface{})
	if !isReread && len(req.ChecklistResponses) > 0 {
		for _, resp := range req.ChecklistResponses {
			key := fmt.Sprintf("item_%d", resp.ID)
			initialConditionData[key] = map[string]interface{}{
				"value": resp.Value,
				"ok":    resp.OK,
				"note":  resp.Note,
			}
		}
	}

	manualReq := structs.StartReadRequest{
		InstrumentID:     req.InstrumentID,
		InitialCondition: initialConditionData,
		KategoriSampel:   req.KategoriSampel,
		Sampel:           req.Sampel,
		NoQCBatch:        req.NoQCBatch,
		AdditionalData:   req.AdditionalData,
	}

	result, err := c.readerService.StartReadProcess(manualReq, userID)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to start read process", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Read process started successfully", result)
}

// ProcessReadInstrument - Section 4.4
// POST /api/instruments/process-read
func (c *InstrumentController) ProcessReadInstrument(ctx *gin.Context) {
	var req structs.ProcessReadRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if err := c.validate.Struct(req); err != nil {
		respondWithValidationError(ctx, err)
		return
	}

	result, err := c.readerService.ProcessReadInstrument(req)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to process read", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Read processed successfully", result)
}

// SaveReadResult - Section 4.5
// POST /api/instruments/save-result
func (c *InstrumentController) SaveReadResult(ctx *gin.Context) {
	var req structs.ReadResultRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if err := c.validate.Struct(req); err != nil {
		respondWithValidationError(ctx, err)
		return
	}

	result, err := c.readerService.SaveReadResult(req)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to save result", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Result saved successfully", result)
}

func (c *InstrumentController) GetBridgeReadingHistory(ctx *gin.Context) {
	usageID, err := parseUintParam(ctx, "usage_id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid usage ID", err)
		return
	}

	// Get usage to verify instrument
	usage, err := c.instrumentService.GetUsageByID(usageID)
	if err != nil {
		respondWithError(ctx, http.StatusNotFound, "Usage not found", err)
		return
	}

	// Get bridge readings linked to this usage's results
	var results []models.UsageResult
	if err := database.DB.Where("instrument_usage_id = ?", usageID).
		Preload("BridgeReading").
		Order("item_number ASC").
		Find(&results).Error; err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to fetch readings", err)
		return
	}

	// Transform response
	type BridgeReadingItem struct {
		ItemNumber      int                    `json:"item_number"`
		BridgeReadingID *uint                  `json:"bridge_reading_id"`
		Value           string                 `json:"value"`
		Unit            string                 `json:"unit"`
		ReadAt          time.Time              `json:"read_at"`
		AdditionalData  map[string]interface{} `json:"additional_data"`
	}

	readings := make([]BridgeReadingItem, 0)
	for _, result := range results {
		// ✅ FIX: Check BridgeReadingID instead of BridgeReading
		if result.BridgeReadingID != nil {
			unit := ""
			if result.BridgeReading.Unit != nil {
				unit = *result.BridgeReading.Unit
			}

			// ✅ FIXED: Convert datatypes.JSON to map[string]interface{}
			var additionalDataMap map[string]interface{}
			if result.BridgeReading.AdditionalData != nil {
				if err := json.Unmarshal(result.BridgeReading.AdditionalData, &additionalDataMap); err != nil {
					// If unmarshal fails, use empty map
					additionalDataMap = make(map[string]interface{})
				} else {
					// Successfully unmarshaled
				}
			} else {
				// If nil, use empty map
				additionalDataMap = make(map[string]interface{})
			}

			readings = append(readings, BridgeReadingItem{
				ItemNumber:      result.ItemNumber,
				BridgeReadingID: result.BridgeReadingID,
				Value:           result.BridgeReading.Value,
				Unit:            unit,
				ReadAt:          result.BridgeReading.ReadAt,
				AdditionalData:  additionalDataMap, // ✅ Now it's a map
			})
		}
	}

	respondWithSuccess(ctx, http.StatusOK, "Bridge readings retrieved", gin.H{
		"usage_id":        usageID,
		"instrument_id":   usage.InstrumentID,
		"total_items":     len(results),
		"bridge_items":    len(readings),
		"direct_items":    len(results) - len(readings),
		"bridge_readings": readings,
	})
}

// UjiUlang - Section 4.6
// POST /api/instruments/uji-ulang
func (c *InstrumentController) UjiUlang(ctx *gin.Context) {
	userID, _ := middlewares.GetUserID(ctx)

	var req structs.UjiUlangRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if err := c.validate.Struct(req); err != nil {
		respondWithValidationError(ctx, err)
		return
	}

	result, err := c.readerService.UjiUlang(req, userID)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to perform uji ulang", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Uji ulang started successfully", result)
}

// ApproveUjiUlang - Section 4.6 (Supervisor Approval)
// POST /api/instruments/approve-uji-ulang
func (c *InstrumentController) ApproveUjiUlang(ctx *gin.Context) {
	userID, _ := middlewares.GetUserID(ctx)

	var req structs.ApproveUjiUlangRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if err := c.validate.Struct(req); err != nil {
		respondWithValidationError(ctx, err)
		return
	}

	err := c.readerService.ApproveUjiUlang(req.UsageID, userID, req.Approved, req.Comment)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to approve uji ulang", err)
		return
	}

	message := "Uji ulang approved successfully"
	if !req.Approved {
		message = "Uji ulang rejected"
	}

	respondWithSuccess(ctx, http.StatusOK, message, nil)
}

// ExportToPDF - Section 4.7
// POST /api/instruments/export-pdf
func (c *InstrumentController) ExportToPDF(ctx *gin.Context) {
	var req structs.ExportPDFRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if err := c.validate.Struct(req); err != nil {
		respondWithValidationError(ctx, err)
		return
	}

	// ✅ Validate that result_ids is not empty
	// if len(req.ResultIDs) == 0 {
	// 	respondWithError(ctx, http.StatusBadRequest, "At least one result must be selected", nil)
	// 	return
	// }

	// ✅ Generate PDF with selected results
	pdfPath, err := c.instrumentService.GeneratePDFWithSelectedResults(req.UsageID, req.ResultIDs)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to export to PDF", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Exported to PDF successfully", gin.H{
		"pdf_path":     pdfPath,
		"usage_id":     req.UsageID,
		"result_count": len(req.ResultIDs),
	})
}

// SaveToFileCapture - Section 4.8
// POST /api/instruments/save-file
func (c *InstrumentController) SaveToFileCapture(ctx *gin.Context) {
	userSite, _ := middlewares.GetUserSite(ctx)

	var req structs.SaveFileRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if err := c.validate.Struct(req); err != nil {
		respondWithValidationError(ctx, err)
		return
	}

	result, err := c.readerService.SaveToFileCapture(req, userSite)
	if err != nil {
		// ✅ More descriptive error — tells user if it's a path config issue
		if strings.Contains(err.Error(), "file path not configured") {
			respondWithError(ctx, http.StatusBadRequest,
				"File path not configured for this destination. Please set it in instrument configuration.", err)
			return
		}
		respondWithError(ctx, http.StatusInternalServerError, "Failed to save file", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "File saved successfully", result)
}

func (c *InstrumentController) SaveUsagePDF(ctx *gin.Context) {
	usageID, err := strconv.ParseUint(ctx.Param("usage_id"), 10, 32)
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid usage ID", err)
		return
	}

	// Generate the PDF
	pdfPath, err := c.instrumentService.ExportReadingToPDF(uint(usageID), "")
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to generate PDF", err)
		return
	}

	// Load the instrument's configured file_path
	var usage models.InstrumentUsage
	if err := database.DB.Preload("Instrument.InstrumentConfig").First(&usage, usageID).Error; err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to load usage", err)
		return
	}

	config := usage.Instrument.InstrumentConfig
	if config == nil || config.FilePath == "" {
		respondWithError(ctx, http.StatusBadRequest, "Instrument has no configured file_path", nil)
		return
	}

	// Copy PDF to file_path
	if err := copyFile(pdfPath, config.FilePath); err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to save PDF to file_path: "+err.Error(), nil)
		return
	}

	// Copy to file_path_2 if configured (non-fatal)
	if config.FilePath2 != "" {
		if err := copyFile(pdfPath, config.FilePath2); err != nil {
			fmt.Printf("[SavePDF] ⚠️ Could not save to file_path_2 (%s): %v\n", config.FilePath2, err)
		}
	}

	// Increment download_count
	database.DB.Model(&models.InstrumentUsage{}).
		Where("id = ?", usageID).
		Updates(map[string]interface{}{
			"is_exported":    true,
			"download_count": gorm.Expr("download_count + 1"),
		})

	respondWithSuccess(ctx, http.StatusOK, "PDF saved successfully", gin.H{
		"path": config.FilePath,
	})
}

func copyFile(src, dst string) error {
	// If dst is a directory, use src filename inside it
	if info, err := os.Stat(dst); err == nil && info.IsDir() {
		dst = filepath.Join(dst, filepath.Base(src))
	}

	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return err
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

// POST /api/instruments/:id/end-read
func (c *InstrumentController) EndReadProcess(ctx *gin.Context) {
	instrumentID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid instrument ID", err)
		return
	}

	var req structs.EndProcessRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if err := c.validate.Struct(req); err != nil {
		respondWithValidationError(ctx, err)
		return
	}

	result, err := c.readerService.EndReadProcess(instrumentID, req)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to end read process", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Read process ended successfully", result)
}

// GetUsageHistory - Additional endpoint untuk riwayat
// GET /api/instruments/:id/usage-history
func (c *InstrumentController) GetUsageHistory(ctx *gin.Context) {
	instrumentID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid instrument ID", err)
		return
	}

	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(ctx.DefaultQuery("limit", "20"))

	history, err := c.instrumentService.GetUsageHistory(instrumentID, page, limit)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to fetch usage history", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Usage history retrieved successfully", history)
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// parseUintParam - Parse uint parameter from URL
func parseUintParam(ctx *gin.Context, param string) (uint, error) {
	id, err := strconv.ParseUint(ctx.Param(param), 10, 32)
	if err != nil {
		return 0, err
	}
	return uint(id), nil
}

// respondWithError - Send error response
func respondWithError(ctx *gin.Context, statusCode int, message string, err error) {
	response := structs.ErrorResponse{
		Status:  "error",
		Message: message,
	}

	if err != nil {
		response.Details = err.Error()
	}

	ctx.JSON(statusCode, response)
}

// respondWithSuccess - Send success response
func respondWithSuccess(ctx *gin.Context, statusCode int, message string, data interface{}) {
	ctx.JSON(statusCode, structs.SuccessResponse{
		Status:  "success",
		Message: message,
		Data:    data,
	})
}

// respondWithValidationError - Send validation error response
func respondWithValidationError(ctx *gin.Context, err error) {
	validationErrors := make(map[string]string)

	if errs, ok := err.(validator.ValidationErrors); ok {
		for _, e := range errs {
			validationErrors[e.Field()] = formatValidationError(e)
		}
	}

	ctx.JSON(http.StatusBadRequest, structs.ErrorResponse{
		Status:  "error",
		Message: "Validation failed",
		Details: validationErrors,
	})
}

// GetUsageStatus - Get current usage status
// GET /api/instruments/usage/:usage_id
func (c *InstrumentController) GetUsageStatus(ctx *gin.Context) {
	usageID, err := parseUintParam(ctx, "usage_id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid usage ID", err)
		return
	}

	usage, err := c.instrumentService.GetUsageByID(usageID)
	if err != nil {
		respondWithError(ctx, http.StatusNotFound, "Usage not found", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Usage status retrieved", usage)
}

// formatValidationError - Format validation error message
func formatValidationError(err validator.FieldError) string {
	switch err.Tag() {
	case "required":
		return err.Field() + " is required"
	case "email":
		return err.Field() + " must be a valid email"
	case "min":
		return err.Field() + " must be at least " + err.Param()
	case "max":
		return err.Field() + " must be at most " + err.Param()
	case "len":
		return err.Field() + " must be exactly " + err.Param() + " characters"
	case "oneof":
		return err.Field() + " must be one of: " + err.Param()
	default:
		return err.Field() + " is invalid"
	}
}

// ReadDataNow - Trigger immediate read from instrument
// POST /api/instruments/:id/read-now
func (c *InstrumentController) ReadDataNow(ctx *gin.Context) {
	instrumentID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid instrument ID", err)
		return
	}

	var req struct {
		UsageID uint `json:"usage_id" binding:"required"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Trigger read
	result, err := c.readerService.ReadDataNow(instrumentID, req.UsageID)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to read data", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Data read successfully", result)
}

// GetLiveData - Get live results for usage
// GET /api/instruments/usage/:usage_id/results
func (c *InstrumentController) GetLiveData(ctx *gin.Context) {
	usageID, err := parseUintParam(ctx, "usage_id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid usage ID", err)
		return
	}

	results, err := c.readerService.GetLiveResults(usageID)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to fetch results", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Results retrieved", gin.H{
		"usage_id": usageID,
		"results":  results,
		"count":    len(results),
	})
}

// Add this new endpoint to instrument_controller.go

// StartAutoReadLoop - NEW ENDPOINT: Auto-read n items
// POST /api/instruments/:id/start-auto-read
func (c *InstrumentController) StartAutoReadLoop(ctx *gin.Context) {
	userID, _ := middlewares.GetUserID(ctx)
	instrumentID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid instrument ID", err)
		return
	}

	var req structs.StartReadRequest
	req.InstrumentID = instrumentID

	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if err := c.validate.Struct(req); err != nil {
		respondWithValidationError(ctx, err)
		return
	}

	// ✅ Check if this is a re-read — skip availability check if so,
	// because the instrument may be in "Re-read" or "In Use" status.
	isReread := false
	if req.AdditionalData != nil {
		if val, ok := req.AdditionalData["is_reread"].(bool); ok && val {
			isReread = true
		}
		if _, ok := req.AdditionalData["existing_usage_id"].(float64); ok {
			isReread = true
		}
		if _, ok := req.AdditionalData["reread_usage_id"].(float64); ok {
			isReread = true
		}
	}

	if !isReread {
		// Check instrument status only for normal (non-reread) reads
		instrument, err := c.instrumentService.GetInstrumentByID(instrumentID)
		if err != nil {
			respondWithError(ctx, http.StatusNotFound, "Instrument not found", err)
			return
		}

		if instrument.Status != "Available" {
			respondWithError(ctx, http.StatusBadRequest, "Instrument is not available. Current status: "+instrument.Status, nil)
			return
		}
	}

	// Start auto-read process
	result, err := c.readerService.StartAutoReadLoop(req, userID)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to start auto-read process", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Auto-read process started", result)
}

// GetReadProgress - Get current progress of auto-read
// GET /api/instruments/usage/:usage_id/progress
func (c *InstrumentController) GetReadProgress(ctx *gin.Context) {
	usageID, err := parseUintParam(ctx, "usage_id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid usage ID", err)
		return
	}

	progress, err := c.readerService.GetReadProgress(usageID)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to get progress", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Progress retrieved", progress)
}

// ExportToPDF - Section 4.7 (Updated)
// POST /api/instruments/export-pdf

// DownloadPDF - NEW: Download generated PDF
// GET /api/instruments/usage/:usage_id/download-pdf
func (c *InstrumentController) DownloadPDF(ctx *gin.Context) {
	usageID, err := parseUintParam(ctx, "usage_id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid usage ID", err)
		return
	}

	// Generate PDF
	pdfPath, err := c.readerService.GeneratePDFForUsage(usageID)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to generate PDF", err)
		return
	}

	// Check if file exists
	if _, err := os.Stat(pdfPath); os.IsNotExist(err) {
		respondWithError(ctx, http.StatusNotFound, "PDF file not found", err)
		return
	}

	database.DB.Model(&models.InstrumentUsage{}).
		Where("id = ?", usageID).
		UpdateColumn("download_count", gorm.Expr("download_count + 1"))

	// Set headers for download
	filename := filepath.Base(pdfPath)
	ctx.Header("Content-Description", "File Transfer")
	ctx.Header("Content-Transfer-Encoding", "binary")
	ctx.Header("Content-Disposition", "attachment; filename="+filename)
	ctx.Header("Content-Type", "application/pdf")

	// Serve file
	ctx.File(pdfPath)
}

// GetCustomCommands - Get available custom commands for instrument
// GET /api/instruments/:id/custom-commands
func (c *InstrumentController) GetCustomCommands(ctx *gin.Context) {
	instrumentID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid instrument ID", err)
		return
	}

	commands, err := c.instrumentService.GetCustomCommands(instrumentID)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to fetch commands", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Commands retrieved successfully", commands)
}

// ExecuteCustomCommand - Execute custom command on instrument
// POST /api/instruments/:id/execute-command
func (c *InstrumentController) ExecuteCustomCommand(ctx *gin.Context) {
	instrumentID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid instrument ID", err)
		return
	}

	var req structs.ExecuteCommandRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if err := c.validate.Struct(req); err != nil {
		respondWithValidationError(ctx, err)
		return
	}

	// Execute command via reader service
	result, err := c.readerService.ExecuteCommand(instrumentID, req.Command)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to execute command", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Command executed successfully", structs.ExecuteCommandResponse{
		Command: req.Command,
		Result:  result,
		Success: true,
		Message: "Command executed successfully",
	})
}

// GetChecklist - Get checklist template untuk instrument
// GET /api/instruments/:id/checklist?type=initial|final
func (c *InstrumentController) GetChecklist(ctx *gin.Context) {
	instrumentID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid instrument ID", err)
		return
	}

	checklistType := ctx.DefaultQuery("type", "initial")
	if checklistType != "initial" && checklistType != "final" {
		respondWithError(ctx, http.StatusBadRequest, "Invalid checklist type. Use 'initial' or 'final'", nil)
		return
	}

	result, err := c.instrumentService.GetChecklistForInstrument(instrumentID, checklistType)
	if err != nil {
		respondWithError(ctx, http.StatusNotFound, "Checklist not found", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Checklist retrieved successfully", result)
}

// ValidateChecklist - Validate checklist responses
// POST /api/instruments/validate-checklist
func (c *InstrumentController) ValidateChecklist(ctx *gin.Context) {
	var req structs.ValidateChecklistRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if err := c.validate.Struct(req); err != nil {
		respondWithValidationError(ctx, err)
		return
	}

	result, err := c.instrumentService.ValidateChecklist(req)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to validate checklist", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Checklist validated", result)
}

func (c *InstrumentController) CreateChecklistTemplate(ctx *gin.Context) {
	var req structs.CreateChecklistTemplateRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if err := c.validate.Struct(req); err != nil {
		respondWithValidationError(ctx, err)
		return
	}

	err := c.instrumentService.CreateChecklistTemplate(req)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to create template", err)
		return
	}

	respondWithSuccess(ctx, http.StatusCreated, "Checklist template created successfully", nil)
}

// UpdateChecklistConfig - Update checklist config untuk instrument tertentu
// PUT /api/instruments/:id/checklist-config
func (c *InstrumentController) UpdateChecklistConfig(ctx *gin.Context) {
	instrumentID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid instrument ID", err)
		return
	}

	var req structs.UpdateChecklistConfigRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	req.InstrumentID = instrumentID

	if err := c.validate.Struct(req); err != nil {
		respondWithValidationError(ctx, err)
		return
	}

	err = c.instrumentService.UpdateChecklistConfig(req)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to update checklist config", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Checklist config updated successfully", nil)
}

func (c *InstrumentController) UpdateInstrumentStatus(ctx *gin.Context) {
	instrumentID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid instrument ID", err)
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
		Reason string `json:"reason"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	allowed := map[string]bool{"Available": true, "Unavailable": true, "Maintenance": true}
	if !allowed[req.Status] {
		respondWithError(ctx, http.StatusBadRequest, "Invalid status value. Must be Available, Unavailable, or Maintenance", nil)
		return
	}

	if err := c.instrumentService.UpdateInstrumentStatus(instrumentID, req.Status); err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to update instrument status", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Instrument status updated successfully", gin.H{
		"instrument_id": instrumentID,
		"status":        req.Status,
		"reason":        req.Reason,
	})
}

// UPDATE StartAutoReadLoop - dengan checklist validation
func (c *InstrumentController) StartAutoReadLoopWithChecklist(ctx *gin.Context) {
	userID, _ := middlewares.GetUserID(ctx)
	instrumentID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid instrument ID", err)
		return
	}

	var req structs.StartReadRequestWithChecklist
	req.InstrumentID = instrumentID

	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if err := c.validate.Struct(req); err != nil {
		respondWithValidationError(ctx, err)
		return
	}

	// ✅ NEW: Check if this is a re-read
	isReread := false
	var rereadUsageID uint
	if req.AdditionalData != nil {
		if isRereadVal, ok := req.AdditionalData["is_reread"].(bool); ok && isRereadVal {
			isReread = true
		}
		// Get reread_usage_id if provided
		if rereadIDVal, ok := req.AdditionalData["reread_usage_id"].(float64); ok {
			rereadUsageID = uint(rereadIDVal)
		}
	}

	var condition string
	var details map[string]interface{}

	// ✅ MODIFIED: Only validate checklist for NEW readings, skip for re-reads
	if !isReread {
		// Validate initial checklist for new readings
		validateReq := structs.ValidateChecklistRequest{
			InstrumentID:  instrumentID,
			ChecklistType: "initial",
			Responses:     req.ChecklistResponses,
		}

		validationResult, err := c.instrumentService.ValidateChecklist(validateReq)
		if err != nil {
			respondWithError(ctx, http.StatusInternalServerError, "Failed to validate checklist", err)
			return
		}

		if !validationResult.CanProceed {
			respondWithError(ctx, http.StatusBadRequest, validationResult.Message, nil)
			return
		}

		// If critical failed, update instrument status
		if validationResult.CriticalFailed {
			c.instrumentService.UpdateInstrumentStatus(instrumentID, "Unavailable")
			respondWithError(ctx, http.StatusBadRequest, "Instrument condition not suitable. Status updated to Unavailable", nil)
			return
		}

		// Process checklist to get initial_condition
		condition, details = c.instrumentService.ProcessChecklistAndDetermineCondition(req.ChecklistResponses)
	} else {
		// ✅ NEW: For re-reads, use empty/default condition
		condition = "Re-read"
		details = map[string]interface{}{
			"is_reread": true,
			"message":   "Re-read process - checklist validation skipped",
		}
	}

	// Convert to old StartReadRequest format
	oldReq := structs.StartReadRequest{
		InstrumentID:     req.InstrumentID,
		InitialCondition: details,
		KategoriSampel:   req.KategoriSampel,
		Sampel:           req.Sampel,
		NoQCBatch:        req.NoQCBatch,
		AdditionalData:   req.AdditionalData,
	}

	// Add condition to additional_data
	if oldReq.AdditionalData == nil {
		oldReq.AdditionalData = make(map[string]interface{})
	}
	oldReq.AdditionalData["initial_condition_status"] = condition

	// ✅ NEW: If reread_usage_id is provided, pass it to the reader service
	if isReread && rereadUsageID > 0 {
		oldReq.AdditionalData["existing_usage_id"] = rereadUsageID
	}

	// Start auto-read
	result, err := c.readerService.StartAutoReadLoop(oldReq, userID)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to start auto-read process", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Auto-read process started", result)
}

// GetAllChecklistTemplates - Admin list all templates
// GET /api/admin/checklist-templates
func (c *InstrumentController) GetAllChecklistTemplates(ctx *gin.Context) {
	templates, err := c.instrumentService.GetAllChecklistTemplates()
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to fetch templates", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Templates retrieved successfully", templates)
}

// GetChecklistTemplateDetail - Get template detail
// GET /api/admin/checklist-templates/:id
func (c *InstrumentController) GetChecklistTemplateDetail(ctx *gin.Context) {
	templateID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid template ID", err)
		return
	}

	template, err := c.instrumentService.GetChecklistTemplateDetail(templateID)
	if err != nil {
		respondWithError(ctx, http.StatusNotFound, "Template not found", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Template retrieved successfully", template)
}

// UpdateChecklistTemplate - Update existing template
// PUT /api/admin/checklist-templates/:id
func (c *InstrumentController) UpdateChecklistTemplate(ctx *gin.Context) {
	templateID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid template ID", err)
		return
	}

	var req structs.CreateChecklistTemplateRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if err := c.validate.Struct(req); err != nil {
		respondWithValidationError(ctx, err)
		return
	}

	err = c.instrumentService.UpdateChecklistTemplate(templateID, req)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to update template", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Template updated successfully", nil)
}

// DeleteChecklistTemplate - Delete template
// DELETE /api/admin/checklist-templates/:id
func (c *InstrumentController) DeleteChecklistTemplate(ctx *gin.Context) {
	templateID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid template ID", err)
		return
	}

	err = c.instrumentService.DeleteChecklistTemplate(templateID)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to delete template", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Template deleted successfully", nil)
}

// GetInstrumentsWithChecklistStatus - Get all instruments with checklist status
// GET /api/admin/instruments-checklist-status
func (c *InstrumentController) GetInstrumentsWithChecklistStatus(ctx *gin.Context) {
	instrumentType := ctx.Query("type")

	instruments, err := c.instrumentService.GetInstrumentsWithChecklistStatus(instrumentType)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to fetch instruments", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Instruments retrieved successfully", instruments)
}

// GetInstrumentChecklistConfig - Get custom checklist config for instrument
// GET /api/instruments/:id/checklist-config
func (c *InstrumentController) GetInstrumentChecklistConfig(ctx *gin.Context) {
	instrumentID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid instrument ID", err)
		return
	}

	config, err := c.instrumentService.GetInstrumentChecklistConfigDetail(instrumentID)
	if err != nil {
		respondWithError(ctx, http.StatusNotFound, "Config not found", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Config retrieved successfully", config)
}

// GET /api/admin/checklist-by-name
func (c *InstrumentController) GetAllChecklistByName(ctx *gin.Context) {
	instrumentType := ctx.Query("type")

	configs, err := c.instrumentService.GetAllChecklistByName(instrumentType)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to fetch configs", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Configs retrieved successfully", configs)
}

// GetChecklistByNameDetail - Get detail for specific name config
// GET /api/admin/checklist-by-name/:id
func (c *InstrumentController) GetChecklistByNameDetail(ctx *gin.Context) {
	configID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid config ID", err)
		return
	}

	config, err := c.instrumentService.GetChecklistByNameDetail(configID)
	if err != nil {
		respondWithError(ctx, http.StatusNotFound, "Config not found", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Config retrieved successfully", config)
}

// CreateChecklistByName - Create new checklist for instrument name
// POST /api/admin/checklist-by-name
func (c *InstrumentController) CreateChecklistByName(ctx *gin.Context) {
	var req structs.CreateChecklistByNameRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if err := c.validate.Struct(req); err != nil {
		respondWithValidationError(ctx, err)
		return
	}

	err := c.instrumentService.CreateChecklistByName(req)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to create config", err)
		return
	}

	respondWithSuccess(ctx, http.StatusCreated, "Checklist by name created successfully", nil)
}

// UpdateChecklistByName - Update existing checklist by name
// PUT /api/admin/checklist-by-name/:id
func (c *InstrumentController) UpdateChecklistByName(ctx *gin.Context) {
	configID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid config ID", err)
		return
	}

	var req structs.CreateChecklistByNameRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if err := c.validate.Struct(req); err != nil {
		respondWithValidationError(ctx, err)
		return
	}

	err = c.instrumentService.UpdateChecklistByName(configID, req)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to update config", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Checklist by name updated successfully", nil)
}

// DeleteChecklistByName - Delete checklist by name
// DELETE /api/admin/checklist-by-name/:id
func (c *InstrumentController) DeleteChecklistByName(ctx *gin.Context) {
	configID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid config ID", err)
		return
	}

	err = c.instrumentService.DeleteChecklistByName(configID)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to delete config", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Checklist by name deleted successfully", nil)
}

// GetInstrumentNamesByTypeForChecklist - Get unique names with checklist status
// GET /api/admin/instrument-names-checklist-status
func (c *InstrumentController) GetInstrumentNamesByTypeForChecklist(ctx *gin.Context) {
	instrumentType := ctx.Query("type")
	userSite, _ := middlewares.GetUserSite(ctx)

	if instrumentType == "" {
		respondWithError(ctx, http.StatusBadRequest, "type parameter is required", nil)
		return
	}

	names, err := c.instrumentService.GetInstrumentNamesByTypeForChecklist(instrumentType, userSite)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to fetch instrument names", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Instrument names retrieved successfully", names)
}

// ============================================
// AFTER READING ENDPOINTS
// ============================================

// GetAfterReadingData - Get data for after reading page
// GET /api/instruments/usage/:usage_id/after-reading
func (c *InstrumentController) GetAfterReadingData(ctx *gin.Context) {
	usageIDStr := ctx.Param("usage_id")
	usageID, err := strconv.ParseUint(usageIDStr, 10, 32)
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid usage ID", err)
		return
	}

	data, err := c.instrumentService.GetAfterReadingData(uint(usageID))
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to fetch after reading data", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "After reading data retrieved successfully", data)
}

// SaveReadingResult - Save selected batch result and final condition
// POST /api/instruments/usage/:usage_id/save-result
func (c *InstrumentController) SaveReadingResult(ctx *gin.Context) {
	usageIDStr := ctx.Param("usage_id")
	usageID, err := strconv.ParseUint(usageIDStr, 10, 32)
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid usage ID", err)
		return
	}

	userID, _ := middlewares.GetUserID(ctx)

	var req struct {
		FinalCondition        string                 `json:"final_condition" binding:"required"`
		SelectedBatches       []string               `json:"selected_batches"` // ✅ plural, array
		FinalChecklistResults map[string]interface{} `json:"final_checklist_results"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	err = c.instrumentService.SaveReadingResult(
		uint(usageID),
		userID,
		req.FinalCondition,
		strings.Join(req.SelectedBatches, ","), // ✅ join array → string
		req.FinalChecklistResults,
	)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to save reading result", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Reading result saved successfully", nil)
}

// ============================================
// RE-READ FLOW ENDPOINTS
// ============================================
// RequestReread - Request re-read WITHOUT supervisor selection
// POST /api/instruments/usage/:usage_id/request-reread
func (c *InstrumentController) RequestReread(ctx *gin.Context) {
	usageIDStr := ctx.Param("usage_id")
	usageID, err := strconv.ParseUint(usageIDStr, 10, 32)
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid usage ID", err)
		return
	}

	userID, exists := middlewares.GetUserID(ctx)
	if !exists {
		respondWithError(ctx, http.StatusUnauthorized, "User not authenticated", nil)
		return
	}

	var req struct {
		BatchNumber string `json:"batch_number" binding:"required"`
		ItemNumber  *int   `json:"item_number"`
		Reason      string `json:"reason" binding:"required"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Validate reason is not empty
	if req.Reason == "" {
		respondWithError(ctx, http.StatusBadRequest, "Reason is required", nil)
		return
	}

	newUsageID, err := c.instrumentService.RequestReread(
		uint(usageID),
		userID,
		req.BatchNumber,
		req.ItemNumber,
		req.Reason,
	)

	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to request reread", err)
		return
	}

	// Get instrument ID for redirect URL
	usage, err := c.instrumentService.GetUsageByID(newUsageID)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to get usage info", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Reread request created successfully", gin.H{
		"new_usage_id": newUsageID,
		"message":      "You can now perform the re-reading immediately",
		"redirect_to":  fmt.Sprintf("/instruments/read/%d?usage_id=%d", usage.InstrumentID, newUsageID),
	})
}

// RequestRereadHandler - COMPLETE FIX with proper response structure
func (ctrl *InstrumentController) RequestRereadHandler(c *gin.Context) {
	usageID, err := strconv.ParseUint(c.Param("usage_id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"success": false,
			"message": "Invalid usage ID",
		})
		return
	}

	var req struct {
		BatchNumber string `json:"batch_number" binding:"required"`
		ItemNumber  *int   `json:"item_number"`
		Reason      string `json:"reason" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"success": false,
			"message": "Invalid request data: " + err.Error(),
		})
		return
	}

	// Get current user from context
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{
			"status":  "error",
			"success": false,
			"message": "User not authenticated",
		})
		return
	}

	// Get original usage to validate and get instrument info
	var originalUsage models.InstrumentUsage
	if err := database.DB.Preload("Instrument").First(&originalUsage, usageID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"success": false,
			"message": "Original usage not found",
		})
		return
	}

	// ✅ CRITICAL FIX: Check if stuck in Re-read pending and auto-fix it
	if originalUsage.StatusPenggunaan == "Re-read" && originalUsage.ResultStatus == "pending" {
		fmt.Printf("⚠️ Usage #%d is stuck in Re-read pending. Auto-fixing...\n", usageID)

		// Auto-fix: Reset to Done Read
		database.DB.Model(&models.InstrumentUsage{}).
			Where("id = ?", usageID).
			Updates(map[string]interface{}{
				"status_penggunaan": "Done Read",
				"result_status":     "",
				"updated_at":        time.Now(),
			})

		// Refresh the usage
		database.DB.Preload("Instrument").First(&originalUsage, usageID)

		fmt.Printf("✅ Auto-fixed usage #%d to Done Read status\n", usageID)
	}

	// ✅ Call the service
	reusedUsageID, err := ctrl.instrumentService.RequestReread(
		uint(usageID),
		userID,
		req.BatchNumber,
		req.ItemNumber,
		req.Reason,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"success": false,
			"message": "Failed to prepare re-read: " + err.Error(),
		})
		return
	}

	// Calculate item count for response
	var itemCount int
	if req.ItemNumber != nil {
		itemCount = 1
	} else {
		// Parse batch data to get item count
		var batches []map[string]interface{}
		if err := json.Unmarshal([]byte(originalUsage.NoQCBatch), &batches); err == nil {
			for _, batch := range batches {
				if batchNo, ok := batch["no_qc_batch"].(string); ok && batchNo == req.BatchNumber {
					if count, ok := batch["jumlah_item"].(float64); ok {
						itemCount = int(count)
					}
					break
				}
			}
		}
	}

	// ✅ CRITICAL FIX: Return proper response structure
	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"success": true, // ✅ Must be true!
		"message": "Re-read request created successfully. You can start reading now.",
		"data": gin.H{
			"usage_id":        reusedUsageID, // ✅ At top level of data
			"reread_usage_id": reusedUsageID,
			"parent_usage_id": usageID,
			"batch_number":    req.BatchNumber,
			"item_number":     req.ItemNumber,
			"total_items":     itemCount,
			"result_status":   "pending",
			"instrument_id":   originalUsage.InstrumentID, // ✅ Include this
			"message":         "Old results have been deleted. You can proceed with reading.",
		},
	})
}

// CompleteReread - Called after user finishes re-reading
// POST /api/instruments/usage/:usage_id/complete-reread
func (c *InstrumentController) CompleteReread(ctx *gin.Context) {
	usageIDStr := ctx.Param("usage_id")
	usageID, err := strconv.ParseUint(usageIDStr, 10, 32)
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid usage ID", err)
		return
	}

	// Verify user is authenticated
	_, exists := middlewares.GetUserID(ctx)
	if !exists {
		respondWithError(ctx, http.StatusUnauthorized, "User not authenticated", nil)
		return
	}

	err = c.instrumentService.CompleteReread(uint(usageID))
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to complete reread", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Re-read completed and submitted for approval", gin.H{
		"message": "Supervisor will be notified to review your results",
	})
}

// ApproveReread - Supervisor approves or rejects re-read RESULTS
// POST /api/instruments/usage/:usage_id/approve-reread
func (c *InstrumentController) ApproveReread(ctx *gin.Context) {
	usageIDStr := ctx.Param("usage_id")
	usageID, err := strconv.ParseUint(usageIDStr, 10, 32)
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid usage ID", err)
		return
	}

	supervisorID, exists := middlewares.GetUserID(ctx)
	if !exists {
		respondWithError(ctx, http.StatusUnauthorized, "User not authenticated", nil)
		return
	}

	var req struct {
		Approved *bool  `json:"approved" binding:"required"`
		Notes    string `json:"notes"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// If rejecting, notes are required
	if !*req.Approved && req.Notes == "" {
		respondWithError(ctx, http.StatusBadRequest, "Notes are required when rejecting a re-read", nil)
		return
	}

	err = c.instrumentService.ApproveReread(uint(usageID), supervisorID, *req.Approved, req.Notes)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to process approval", err)
		return
	}

	action := "approved"
	if !*req.Approved {
		action = "rejected"
	}

	respondWithSuccess(ctx, http.StatusOK, fmt.Sprintf("Re-read %s successfully", action), gin.H{
		"approved": req.Approved,
		"notes":    req.Notes,
	})
}

// GetPendingRereadApprovals - Get pending re-read approvals with comparison data
// GET /api/instruments/usage/pending-reread-approvals
func (c *InstrumentController) GetPendingRereadApprovals(ctx *gin.Context) {
	userID, exists := middlewares.GetUserID(ctx)
	if !exists {
		respondWithError(ctx, http.StatusUnauthorized, "User not authenticated", nil)
		return
	}

	// ✅ Get site from JWT claims — same pattern as other endpoints
	userSite, _ := middlewares.GetUserSite(ctx) // or GetSite, GetLokasiSite, etc.

	approvals, err := c.instrumentService.GetPendingRereadApprovals(userID, userSite)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to fetch pending approvals", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Pending approvals retrieved successfully", approvals)
}

// ExportReadingToPDF - Export selected batch to PDF (with approval check)
// POST /api/instruments/usage/:usage_id/export-pdf
// NOTE: Update your existing ExportReadingToPDF method with this approval check
func (c *InstrumentController) ExportReadingToPDF(ctx *gin.Context) {
	usageIDStr := ctx.Param("usage_id")
	usageID, err := strconv.ParseUint(usageIDStr, 10, 32)
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid usage ID", err)
		return
	}

	var req struct {
		BatchNumber string `json:"batch_number" binding:"required"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Check if usage requires approval and is approved
	usage, err := c.instrumentService.GetUsageByID(uint(usageID))
	if err != nil {
		respondWithError(ctx, http.StatusNotFound, "Usage not found", err)
		return
	}

	// ✅ NEW: Check if re-read is approved before allowing export
	if usage.ParentUsageID != nil {
		// This is a re-read - check result_status
		if usage.ResultStatus != "approved" {
			respondWithError(ctx, http.StatusForbidden, "Re-read results must be approved by supervisor before export", nil)
			return
		}
	}

	pdfURL, err := c.instrumentService.ExportReadingToPDF(uint(usageID), req.BatchNumber)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to export PDF", err)
		return
	}

	// Increment download count
	database.DB.Model(&models.InstrumentUsage{}).
		Where("id = ?", usageID).
		UpdateColumn("download_count", gorm.Expr("download_count + 1"))

	respondWithSuccess(ctx, http.StatusOK, "PDF exported successfully", gin.H{
		"pdf_url": pdfURL,
	})
}

// POST /api/instruments/usage/:usage_id/resume
func (c *InstrumentController) ResumeUsage(ctx *gin.Context) {
	userID, _ := middlewares.GetUserID(ctx)

	usageID, err := parseUintParam(ctx, "usage_id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid usage ID", err)
		return
	}

	// Verify instrument is shared_access
	usage, err := c.instrumentService.GetUsageByID(usageID)
	if err != nil {
		respondWithError(ctx, http.StatusNotFound, "Usage not found", err)
		return
	}

	var instrument models.Instrument
	if err := database.DB.First(&instrument, usage.InstrumentID).Error; err != nil {
		respondWithError(ctx, http.StatusNotFound, "Instrument not found", err)
		return
	}

	if !instrument.SharedAccess {
		respondWithError(ctx, http.StatusForbidden, "This instrument does not allow shared access", nil)
		return
	}

	// Catat siapa yang resume
	now := time.Now()
	if err := database.DB.Model(&models.InstrumentUsage{}).
		Where("id = ?", usageID).
		Updates(map[string]interface{}{
			"resumed_by": userID,
			"resumed_at": now,
		}).Error; err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to record resume", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Resume recorded", map[string]interface{}{
		"usage_id":   usageID,
		"resumed_by": userID,
		"resumed_at": now,
	})
}
