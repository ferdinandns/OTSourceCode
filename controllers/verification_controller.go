package controllers

import (
	"fmt"
	"lab-connect/backend-api/middlewares"
	"lab-connect/backend-api/models"
	"lab-connect/backend-api/services"
	"lab-connect/backend-api/structs"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
)

type VerificationController struct {
	service  *services.VerificationService
	validate *validator.Validate
}

func NewVerificationController(service *services.VerificationService) *VerificationController {
	return &VerificationController{
		service:  service,
		validate: validator.New(),
	}
}

// ============================================
// LIST INSTRUMENTS FOR VERIFICATION
// GET /api/verifications/instruments
// ============================================

func (c *VerificationController) GetInstrumentsForVerification(ctx *gin.Context) {
	userSite, _ := middlewares.GetUserSite(ctx)

	instruments, err := c.service.GetInstrumentsForVerification(userSite)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to fetch instruments", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Instruments retrieved successfully", instruments)
}

// ============================================
// DYNAMIC VERIFICATION - V2 ENDPOINTS
// ============================================

// StartVerification - Start verification with template (V2)
// POST /api/verifications/start
func (c *VerificationController) StartVerification(ctx *gin.Context) {
	userID, _ := middlewares.GetUserID(ctx)

	var req structs.StartVerificationRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if err := c.validate.Struct(req); err != nil {
		respondWithValidationError(ctx, err)
		return
	}

	result, err := c.service.StartVerification(req, userID)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to start verification", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Verification started successfully", result)
}

// ExecuteStep - Execute a verification step dynamically
// POST /api/verifications/execute-step
func (c *VerificationController) ExecuteStep(ctx *gin.Context) {
	userRole, _ := middlewares.GetUserRole(ctx)

	var req structs.ExecuteStepRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if err := c.validate.Struct(req); err != nil {
		respondWithValidationError(ctx, err)
		return
	}

	result, err := c.service.ExecuteStep(req, userRole)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to execute step", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Step executed successfully", result)
}

// GetVerificationProgress - Get current verification progress
// GET /api/verifications/:id/progress
func (c *VerificationController) GetVerificationProgress(ctx *gin.Context) {
	verificationID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid verification ID", err)
		return
	}

	progress, err := c.service.GetVerificationProgress(verificationID)
	if err != nil {
		respondWithError(ctx, http.StatusNotFound, "Verification not found", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Progress retrieved successfully", progress)
}

// CompleteVerification - Complete verification
// POST /api/verifications/:id/complete
func (c *VerificationController) CompleteVerification(ctx *gin.Context) {
	verificationID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid verification ID", err)
		return
	}

	var req struct {
		Notes string `json:"notes"`
	}
	ctx.ShouldBindJSON(&req)

	result, err := c.service.CompleteVerification(verificationID, req.Notes)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to complete verification", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Verification completed successfully", result)
}

// CancelVerification - Cancel in-progress verification
// POST /api/verifications/:id/cancel
func (c *VerificationController) CancelVerification(ctx *gin.Context) {
	verificationID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid verification ID", err)
		return
	}

	// Optional body — supports breakdown mode
	var req struct {
		Breakdown      bool   `json:"breakdown"`
		StepNumber     int    `json:"step_number"`
		OverrideReason string `json:"override_reason"`
		Notes          string `json:"notes"`
	}
	// ShouldBindJSON is best-effort; ignore errors for backwards compat
	_ = ctx.ShouldBindJSON(&req)

	if req.Breakdown {
		if err := c.service.BreakdownVerification(verificationID, req.StepNumber, req.OverrideReason, req.Notes); err != nil {
			respondWithError(ctx, http.StatusInternalServerError, "Failed to breakdown verification", err)
			return
		}
		respondWithSuccess(ctx, http.StatusOK, "Verification marked as breakdown", nil)
		return
	}

	if err := c.service.CancelVerification(verificationID); err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to cancel verification", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Verification cancelled successfully", nil)
}

// ============================================
// TEMPLATE MANAGEMENT
// ============================================

// CreateTemplate - Create new verification template
// POST /api/verification-templates
func (c *VerificationController) CreateTemplate(ctx *gin.Context) {
	userID, _ := middlewares.GetUserID(ctx)

	var req structs.CreateTemplateRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if err := c.validate.Struct(req); err != nil {
		respondWithValidationError(ctx, err)
		return
	}

	result, err := c.service.CreateTemplate(req, userID)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to create template", err)
		return
	}

	respondWithSuccess(ctx, http.StatusCreated, "Template created successfully", result)
}

// GetTemplates - List all templates
// GET /api/verification-templates
func (c *VerificationController) GetTemplates(ctx *gin.Context) {
	instrumentType := ctx.Query("instrument_type")
	activeOnly := ctx.Query("active_only") == "true"

	templates, err := c.service.GetTemplates(instrumentType, activeOnly)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to fetch templates", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Templates retrieved successfully", templates)
}

// GetTemplateDetail - Get template details
// GET /api/verification-templates/:id
func (c *VerificationController) GetTemplateDetail(ctx *gin.Context) {
	templateID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid template ID", err)
		return
	}

	template, err := c.service.GetTemplateDetail(templateID)
	if err != nil {
		respondWithError(ctx, http.StatusNotFound, "Template not found", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Template retrieved successfully", template)
}

// UpdateTemplate - Update existing template
// PUT /api/verification-templates/:id
func (c *VerificationController) UpdateTemplate(ctx *gin.Context) {
	userID, _ := middlewares.GetUserID(ctx)
	templateID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid template ID", err)
		return
	}

	var req structs.UpdateTemplateRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	result, err := c.service.UpdateTemplate(templateID, req, userID)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to update template", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Template updated successfully", result)
}

// DeleteTemplate - Soft delete template
// DELETE /api/verification-templates/:id
func (c *VerificationController) DeleteTemplate(ctx *gin.Context) {
	templateID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid template ID", err)
		return
	}

	if err := c.service.DeleteTemplate(templateID); err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to delete template", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Template deleted successfully", nil)
}

// CloneTemplate - Clone existing template
// POST /api/verification-templates/:id/clone
func (c *VerificationController) CloneTemplate(ctx *gin.Context) {
	userID, _ := middlewares.GetUserID(ctx)
	sourceTemplateID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid template ID", err)
		return
	}

	var req structs.CloneTemplateRequest
	req.SourceTemplateID = sourceTemplateID
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	result, err := c.service.CloneTemplate(req, userID)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to clone template", err)
		return
	}

	respondWithSuccess(ctx, http.StatusCreated, "Template cloned successfully", result)
}

// ============================================
// INSTRUMENT TEMPLATE ASSIGNMENT
// ============================================

// AssignTemplateToInstrument - Assign template to instrument
// POST /api/instruments/:id/assign-template
func (c *VerificationController) AssignTemplateToInstrument(ctx *gin.Context) {
	userID, _ := middlewares.GetUserID(ctx)
	instrumentID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid instrument ID", err)
		return
	}

	var req structs.AssignTemplateRequest
	req.InstrumentID = instrumentID
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	result, err := c.service.AssignTemplateToInstrument(req, userID)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to assign template", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Template assigned successfully", result)
}

// GetInstrumentTemplate - Get instrument's assigned template
// GET /api/instruments/:id/template
func (c *VerificationController) GetInstrumentTemplate(ctx *gin.Context) {
	instrumentID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid instrument ID", err)
		return
	}

	template, err := c.service.GetInstrumentTemplate(instrumentID)
	if err != nil {
		respondWithError(ctx, http.StatusNotFound, "Template assignment not found", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Template retrieved successfully", template)
}

// ============================================
// REFERENCE MANAGEMENT
// ============================================

// CreateReference - Create verification reference
// POST /api/verification-references
func (c *VerificationController) CreateReference(ctx *gin.Context) {
	var req structs.CreateReferenceRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	result, err := c.service.CreateReference(req)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to create reference", err)
		return
	}

	respondWithSuccess(ctx, http.StatusCreated, "Reference created successfully", result)
}

// GetReferencesForInstrument - Get references for instrument
// GET /api/instruments/:id/references
func (c *VerificationController) GetReferencesForInstrument(ctx *gin.Context) {
	instrumentID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid instrument ID", err)
		return
	}

	referenceType := ctx.Query("type")

	references, err := c.service.GetReferencesForInstrument(instrumentID, referenceType)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to fetch references", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "References retrieved successfully", references)
}

// ============================================
// VERIFICATION HISTORY & DETAILS
// ============================================

// GetVerificationHistory - Get verification history with filters
// GET /api/verifications/history
func (c *VerificationController) GetVerificationHistory(ctx *gin.Context) {
	var filter structs.VerificationHistoryRequest
	if err := ctx.ShouldBindQuery(&filter); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid query parameters", err)
		return
	}

	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.Limit < 1 {
		filter.Limit = 20
	}

	history, err := c.service.GetVerificationHistory(filter)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to fetch history", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "History retrieved successfully", history)
}

// GetVerificationDetail - Get detailed verification info
// GET /api/verifications/:id
func (c *VerificationController) GetVerificationDetail(ctx *gin.Context) {
	verificationID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid verification ID", err)
		return
	}

	verification, err := c.service.GetVerificationDetail(verificationID)
	if err != nil {
		respondWithError(ctx, http.StatusNotFound, "Verification not found", err)
		return
	}

	detail := c.convertVerificationToDTO(verification) // ← add this
	respondWithSuccess(ctx, http.StatusOK, "Verification detail retrieved", detail)
}

// DownloadVerificationPDF - Generate and download PDF report
// GET /api/verifications/:id/download-pdf
func (c *VerificationController) DownloadVerificationPDF(ctx *gin.Context) {
	verificationID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid verification ID", err)
		return
	}

	log.Printf("📄 [PDF] Download request for verification ID: %d", verificationID)

	// Get verification detail from service (returns *models.InstrumentVerification)
	verification, err := c.service.GetVerificationDetail(verificationID)
	if err != nil {
		log.Printf("❌ [PDF] Verification not found: %v", err)
		respondWithError(ctx, http.StatusNotFound, "Verification not found", err)
		return
	}

	// Convert to DTO for PDF generation
	detail := c.convertVerificationToDTO(verification)

	log.Printf("✅ [PDF] Verification detail retrieved")

	pdfService := services.NewPDFGeneratorService(c.service.GetDB())
	logoPath := "./assets/logo.png"

	pdfPath, err := pdfService.GenerateVerificationPDF(detail, logoPath)
	if err != nil {
		log.Printf("❌ [PDF] Generation failed: %v", err)
		respondWithError(ctx, http.StatusInternalServerError, "Failed to generate PDF", err)
		return
	}

	log.Printf("✅ [PDF] Generated successfully: %s", pdfPath)

	pdfBytes, err := os.ReadFile(pdfPath)
	if err != nil {
		log.Printf("❌ [PDF] Failed to read file: %v", err)
		respondWithError(ctx, http.StatusInternalServerError, "Failed to read PDF file", err)
		return
	}

	filename := fmt.Sprintf("Verification_%d_%d.pdf", verificationID, time.Now().Unix())

	ctx.Header("Content-Type", "application/pdf")
	ctx.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	ctx.Header("Content-Length", fmt.Sprintf("%d", len(pdfBytes)))

	ctx.Data(http.StatusOK, "application/pdf", pdfBytes)
	log.Printf("✅ [PDF] Download complete: %s (%d bytes)", filename, len(pdfBytes))
}

// Helper to convert model to DTO
func (c *VerificationController) convertVerificationToDTO(v *models.InstrumentVerification) *structs.VerificationDetailResponse {
	steps := make([]structs.VerificationStepDetail, len(v.Steps))
	for i, step := range v.Steps {
		// Extract measured value from input_data if not set
		measuredValue := step.MeasuredValue
		if measuredValue == nil && step.InputData != nil {
			if val, ok := step.InputData["value"]; ok {
				if f, ok := toFloat64(val); ok {
					measuredValue = &f
				}
			}
		}

		// Get min/max from step_config if not set
		minValue := step.MinValue
		maxValue := step.MaxValue
		if (minValue == nil || maxValue == nil) && step.StepConfig.ValidationRules != nil {
			if minVal, ok := toFloat64(step.StepConfig.ValidationRules["min"]); ok {
				minValue = &minVal
			}
			if maxVal, ok := toFloat64(step.StepConfig.ValidationRules["max"]); ok {
				maxValue = &maxVal
			}
		}

		steps[i] = structs.VerificationStepDetail{
			StepNumber:     step.StepNumber,
			StepName:       step.StepName,
			StepType:       step.StepType,
			Status:         step.Status,
			Description:    step.StepConfig.Description,
			InputData:      step.InputData,
			ReadingData:    step.ReadingData,
			ResultData:     step.ResultData,
			ValidationMsg:  step.ValidationMsg,
			ExpectedValue:  step.ExpectedValue,
			MinValue:       minValue,
			MaxValue:       maxValue,
			MeasuredValue:  measuredValue,
			Readings:       step.Readings,
			ReferenceID:    step.ReferenceID,
			ReferenceType:  step.ReferenceType,
			OverrideReason: step.OverrideReason,
			OverriddenBy:   step.OverriddenBy,
			OverriddenAt:   step.OverriddenAt,
			StartedAt:      step.StartedAt,
			CompletedAt:    step.CompletedAt,
			Duration:       step.Duration,
			Required:       step.StepConfig.Required,
		}
	}

	return &structs.VerificationDetailResponse{
		ID:             v.Id,
		InstrumentID:   v.InstrumentID,
		NoKontrol:      v.Instrument.KodeInstrument,
		NamaInstrument: v.Instrument.Nama,
		InstrumentType: v.Instrument.Type,
		VerifiedBy: structs.UserBasicInfo{
			Id:   v.User.Id,
			Name: v.User.Name,
		},
		VerifiedAt:       v.VerifiedAt,
		ValidUntil:       v.ValidUntil,
		Status:           v.Status,
		RoomTemp:         v.RoomTemp,
		RoomHumidity:     v.RoomHumidity,
		Notes:            v.Notes,
		Steps:            steps,
		VerificationData: v.VerificationData,
		CreatedAt:        v.CreatedAt,
		UpdatedAt:        v.UpdatedAt,
		ApprovalStatus:   v.ApprovalStatus,
		ApprovedBy:       v.ApprovedBy,
		ApprovedAt:       v.ApprovedAt,
		ApprovalNotes:    v.ApprovalNotes,
	}
}

// Helper function to convert interface to float64
func toFloat64(val interface{}) (float64, bool) {
	switch v := val.(type) {
	case float64:
		return v, true
	case float32:
		return float64(v), true
	case int:
		return float64(v), true
	case int64:
		return float64(v), true
	case string:
		var f float64
		if _, err := fmt.Sscanf(v, "%f", &f); err == nil {
			return f, true
		}
	}
	return 0, false
}

// ============================================
// SUPERVISOR APPROVAL
// ============================================

// ApproveVerification - Supervisor approves or rejects a completed verification
// POST /api/verifications/:id/approve
func (c *VerificationController) ApproveVerification(ctx *gin.Context) {
	supervisorID, _ := middlewares.GetUserID(ctx)

	verificationID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid verification ID", err)
		return
	}

	var req structs.ApproveVerificationRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	result, err := c.service.ApproveVerification(verificationID, supervisorID, req)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to process approval", err)
		return
	}

	msg := "Verification approved successfully"
	if !req.Approved {
		msg = "Verification rejected successfully"
	}
	respondWithSuccess(ctx, http.StatusOK, msg, result)
}

// ============================================
// BATCH OPERATIONS
// ============================================

// BatchExecuteSteps - Execute multiple steps at once
// POST /api/verifications/batch-execute
func (c *VerificationController) BatchExecuteSteps(ctx *gin.Context) {
	userRole, _ := middlewares.GetUserRole(ctx)

	var req structs.BatchExecuteStepsRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	result, err := c.service.BatchExecuteSteps(req, userRole)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to execute steps", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Steps executed successfully", result)
}

// ============================================
// HELPER FUNCTIONS (Use capitalized names to avoid conflicts)
// ============================================

func RespondWithValidationError(ctx *gin.Context, err error) {
	ctx.JSON(http.StatusBadRequest, gin.H{
		"success": false,
		"message": "Validation failed",
		"error":   err.Error(),
	})
}

func (c *VerificationController) FulfillReadRequest(ctx *gin.Context) {
	var req struct {
		VerificationID uint    `json:"verification_id" binding:"required"`
		StepNumber     int     `json:"step_number" binding:"required"`
		Value          float64 `json:"value" binding:"required"`
		RawData        string  `json:"raw_data,omitempty"` // untuk debug
		Timestamp      string  `json:"timestamp,omitempty"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request", err)
		return
	}

	// Log bridge response
	log.Printf("🌉 [Bridge] Received reading: V=%d, Step=%d, Value=%.4f",
		req.VerificationID, req.StepNumber, req.Value)

	// Call service to process the reading
	result, err := c.service.ProcessBridgeReading(
		req.VerificationID,
		req.StepNumber,
		req.Value,
		req.RawData,
	)
	if err != nil {
		log.Printf("❌ [Bridge] Failed to process reading: %v", err)
		respondWithError(ctx, http.StatusInternalServerError, "Failed to process reading", err)
		return
	}

	log.Printf("✅ [Bridge] Reading processed: %s", result.Status)
	respondWithSuccess(ctx, http.StatusOK, "Reading recorded", result)
}
