package services

import (
	"errors"
	"fmt"
	"lab-connect/backend-api/database"
	"lab-connect/backend-api/models"
	"lab-connect/backend-api/structs"
	"log"
	"regexp"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"
)

type VerificationService struct {
	db           *gorm.DB
	serialReader *SerialReaderService
	tcpReader    *TCPReaderService
	tibboReader  *TibboReaderService
}

func NewVerificationService() *VerificationService {
	tcpReader := NewTCPReaderService()
	return &VerificationService{
		db:           database.DB,
		serialReader: NewSerialReaderService(),
		tcpReader:    tcpReader,
		tibboReader:  NewTibboReaderService(tcpReader),
	}
}

func (s *VerificationService) GetDB() *gorm.DB {
	return s.db
}

// ============================================
// TEMPLATE MANAGEMENT
// ============================================

func (s *VerificationService) CreateTemplate(req structs.CreateTemplateRequest, userID uint) (*structs.TemplateDetailResponse, error) {
	// Convert DTO steps to model steps
	steps := make(models.StepConfigArray, len(req.Steps))
	for i, stepDTO := range req.Steps {
		steps[i] = models.StepConfig{
			StepNumber:      stepDTO.StepNumber,
			StepName:        stepDTO.StepName,
			StepType:        stepDTO.StepType,
			Description:     stepDTO.Description,
			Required:        stepDTO.Required,
			InputType:       stepDTO.InputType,
			Unit:            stepDTO.Unit,
			ValidationRules: stepDTO.ValidationRules,
			DependsOn:       stepDTO.DependsOn,
			ReferenceType:   stepDTO.ReferenceType,
			ReadingCount:    stepDTO.ReadingCount,
			CalculationExpr: stepDTO.CalculationExpr,
			UIComponent:     stepDTO.UIComponent,
			Metadata:        stepDTO.Metadata,
		}
	}

	template := models.VerificationTemplate{
		TemplateName:           req.TemplateName,
		InstrumentType:         req.InstrumentType,
		Description:            req.Description,
		Version:                1,
		Steps:                  steps,
		GlobalRules:            req.GlobalRules,
		RequiresConnection:     req.RequiresConnection,
		ConnectionType:         req.ConnectionType,
		AutoCompleteOnSuccess:  req.AutoCompleteOnSuccess,
		AllowPartialCompletion: req.AllowPartialCompletion,
		IsActive:               true,
		IsDefault:              req.IsDefault,
		CreatedBy:              userID,
		UpdatedBy:              &userID,
	}

	// If setting as default, unset other defaults for this instrument type
	if req.IsDefault {
		if err := s.db.Model(&models.VerificationTemplate{}).
			Where("instrument_type = ? AND is_default = ?", req.InstrumentType, true).
			Update("is_default", false).Error; err != nil {
			return nil, err
		}
	}

	if err := s.db.Create(&template).Error; err != nil {
		return nil, err
	}

	return s.GetTemplateDetail(template.Id)
}

func (s *VerificationService) UpdateTemplate(templateID uint, req structs.UpdateTemplateRequest, userID uint) (*structs.TemplateDetailResponse, error) {
	var template models.VerificationTemplate
	if err := s.db.First(&template, templateID).Error; err != nil {
		return nil, errors.New("template not found")
	}

	// Update fields if provided
	if req.TemplateName != nil {
		template.TemplateName = *req.TemplateName
	}
	if req.Description != nil {
		template.Description = *req.Description
	}
	if req.Steps != nil {
		steps := make(models.StepConfigArray, len(*req.Steps))
		for i, stepDTO := range *req.Steps {
			steps[i] = models.StepConfig{
				StepNumber:      stepDTO.StepNumber,
				StepName:        stepDTO.StepName,
				StepType:        stepDTO.StepType,
				Description:     stepDTO.Description,
				Required:        stepDTO.Required,
				InputType:       stepDTO.InputType,
				Unit:            stepDTO.Unit,
				ValidationRules: stepDTO.ValidationRules,
				DependsOn:       stepDTO.DependsOn,
				ReferenceType:   stepDTO.ReferenceType,
				ReadingCount:    stepDTO.ReadingCount,
				CalculationExpr: stepDTO.CalculationExpr,
				UIComponent:     stepDTO.UIComponent,
				Metadata:        stepDTO.Metadata,
			}
		}
		template.Steps = steps
		template.Version++
	}
	if req.GlobalRules != nil {
		template.GlobalRules = *req.GlobalRules
	}
	if req.RequiresConnection != nil {
		template.RequiresConnection = *req.RequiresConnection
	}
	if req.ConnectionType != nil {
		template.ConnectionType = *req.ConnectionType
	}
	if req.AutoCompleteOnSuccess != nil {
		template.AutoCompleteOnSuccess = *req.AutoCompleteOnSuccess
	}
	if req.AllowPartialCompletion != nil {
		template.AllowPartialCompletion = *req.AllowPartialCompletion
	}
	if req.IsActive != nil {
		template.IsActive = *req.IsActive
	}
	if req.IsDefault != nil && *req.IsDefault {
		// Unset other defaults
		s.db.Model(&models.VerificationTemplate{}).
			Where("instrument_type = ? AND id != ? AND is_default = ?", template.InstrumentType, templateID, true).
			Update("is_default", false)
		template.IsDefault = true
	}

	template.UpdatedBy = &userID

	if err := s.db.Save(&template).Error; err != nil {
		return nil, err
	}

	return s.GetTemplateDetail(template.Id)
}

func (s *VerificationService) GetTemplates(instrumentType string, activeOnly bool) ([]structs.TemplateListResponse, error) {
	var templates []models.VerificationTemplate

	query := s.db.Model(&models.VerificationTemplate{}).
		Preload("Creator").
		Preload("Updater")

	if instrumentType != "" {
		query = query.Where("instrument_type = ?", instrumentType)
	}
	if activeOnly {
		query = query.Where("is_active = ?", true)
	}

	if err := query.Order("created_at DESC").Find(&templates).Error; err != nil {
		return nil, err
	}

	response := make([]structs.TemplateListResponse, len(templates))
	for i, tmpl := range templates {
		// Count instruments using this template
		var count int64
		s.db.Model(&models.InstrumentTemplate{}).Where("template_id = ?", tmpl.Id).Count(&count)

		response[i] = structs.TemplateListResponse{
			ID:                     tmpl.Id,
			TemplateName:           tmpl.TemplateName,
			InstrumentType:         tmpl.InstrumentType,
			Description:            tmpl.Description,
			Version:                tmpl.Version,
			StepCount:              len(tmpl.Steps),
			RequiresConnection:     tmpl.RequiresConnection,
			IsActive:               tmpl.IsActive,
			IsDefault:              tmpl.IsDefault,
			InstrumentCount:        int(count),
			CreatedBy:              getUsername(tmpl.Creator),
			UpdatedBy:              getUsername(tmpl.Updater),
			CreatedAt:              tmpl.CreatedAt,
			UpdatedAt:              tmpl.UpdatedAt,
			GlobalRules:            tmpl.GlobalRules,
			AutoCompleteOnSuccess:  tmpl.AutoCompleteOnSuccess,
			AllowPartialCompletion: tmpl.AllowPartialCompletion,
		}
	}

	return response, nil
}

func (s *VerificationService) GetTemplateDetail(templateID uint) (*structs.TemplateDetailResponse, error) {
	var template models.VerificationTemplate
	if err := s.db.Preload("Creator").Preload("Updater").First(&template, templateID).Error; err != nil {
		return nil, errors.New("template not found")
	}

	// Convert steps to DTO
	steps := make([]structs.StepConfigDTO, len(template.Steps))
	for i, step := range template.Steps {
		steps[i] = structs.StepConfigDTO{
			StepNumber:      step.StepNumber,
			StepName:        step.StepName,
			StepType:        step.StepType,
			Description:     step.Description,
			Required:        step.Required,
			InputType:       step.InputType,
			Unit:            step.Unit,
			ValidationRules: step.ValidationRules,
			DependsOn:       step.DependsOn,
			ReferenceType:   step.ReferenceType,
			ReadingCount:    step.ReadingCount,
			CalculationExpr: step.CalculationExpr,
			UIComponent:     step.UIComponent,
			Metadata:        step.Metadata,
		}
	}

	// Get instruments using this template
	var instrumentMappings []models.InstrumentTemplate
	s.db.Preload("Instrument").Where("template_id = ?", templateID).Find(&instrumentMappings)

	usedByInstruments := make([]structs.InstrumentBasicInfo, len(instrumentMappings))
	for i, mapping := range instrumentMappings {
		usedByInstruments[i] = structs.InstrumentBasicInfo{
			ID:        mapping.Instrument.Id,
			NoKontrol: mapping.Instrument.KodeInstrument,
			Name:      mapping.Instrument.Nama,
			Type:      mapping.Instrument.Type,
			IsActive:  mapping.IsActive,
		}
	}

	return &structs.TemplateDetailResponse{
		ID:                     template.Id,
		TemplateName:           template.TemplateName,
		InstrumentType:         template.InstrumentType,
		Description:            template.Description,
		Version:                template.Version,
		Steps:                  steps,
		GlobalRules:            template.GlobalRules,
		RequiresConnection:     template.RequiresConnection,
		ConnectionType:         template.ConnectionType,
		AutoCompleteOnSuccess:  template.AutoCompleteOnSuccess,
		AllowPartialCompletion: template.AllowPartialCompletion,
		IsActive:               template.IsActive,
		IsDefault:              template.IsDefault,
		CreatedBy:              buildUserBasicInfo(template.Creator),
		UpdatedBy:              buildUserBasicInfo(template.Updater),
		CreatedAt:              template.CreatedAt,
		UpdatedAt:              template.UpdatedAt,
		UsedByInstruments:      usedByInstruments,
	}, nil
}

func (s *VerificationService) DeleteTemplate(templateID uint) error {
	var template models.VerificationTemplate
	if err := s.db.First(&template, templateID).Error; err != nil {
		return errors.New("template not found")
	}

	// Check if template is in use
	var count int64
	s.db.Model(&models.InstrumentTemplate{}).Where("template_id = ?", templateID).Count(&count)
	if count > 0 {
		return errors.New("template is in use by instruments, cannot delete")
	}

	template.IsActive = false
	return s.db.Save(&template).Error
}

func (s *VerificationService) CloneTemplate(req structs.CloneTemplateRequest, userID uint) (*structs.TemplateDetailResponse, error) {
	var sourceTemplate models.VerificationTemplate
	if err := s.db.First(&sourceTemplate, req.SourceTemplateID).Error; err != nil {
		return nil, errors.New("source template not found")
	}

	description := sourceTemplate.Description
	if req.NewDescription != nil {
		description = *req.NewDescription
	}

	newTemplate := models.VerificationTemplate{
		TemplateName:           req.NewTemplateName,
		InstrumentType:         sourceTemplate.InstrumentType,
		Description:            description,
		Version:                1,
		Steps:                  sourceTemplate.Steps,
		GlobalRules:            sourceTemplate.GlobalRules,
		RequiresConnection:     sourceTemplate.RequiresConnection,
		ConnectionType:         sourceTemplate.ConnectionType,
		AutoCompleteOnSuccess:  sourceTemplate.AutoCompleteOnSuccess,
		AllowPartialCompletion: sourceTemplate.AllowPartialCompletion,
		IsActive:               true,
		IsDefault:              req.MakeDefault,
		CreatedBy:              userID,
		UpdatedBy:              &userID,
	}

	if req.MakeDefault {
		s.db.Model(&models.VerificationTemplate{}).
			Where("instrument_type = ? AND is_default = ?", sourceTemplate.InstrumentType, true).
			Update("is_default", false)
	}

	if err := s.db.Create(&newTemplate).Error; err != nil {
		return nil, err
	}

	return s.GetTemplateDetail(newTemplate.Id)
}

// ============================================
// INSTRUMENT TEMPLATE ASSIGNMENT
// ============================================

func (s *VerificationService) AssignTemplateToInstrument(req structs.AssignTemplateRequest, userID uint) (*structs.InstrumentTemplateResponse, error) {
	// Verify instrument exists
	var instrument models.Instrument
	if err := s.db.First(&instrument, req.InstrumentID).Error; err != nil {
		return nil, errors.New("instrument not found")
	}

	// Verify template exists
	var template models.VerificationTemplate
	if err := s.db.First(&template, req.TemplateID).Error; err != nil {
		return nil, errors.New("template not found")
	}

	// Check if assignment already exists
	var existing models.InstrumentTemplate
	err := s.db.Where("instrument_id = ?", req.InstrumentID).First(&existing).Error

	switch err {
	case gorm.ErrRecordNotFound:
		// Create new assignment
		assignment := models.InstrumentTemplate{
			InstrumentID:   req.InstrumentID,
			TemplateID:     req.TemplateID,
			OverrideConfig: req.OverrideConfig,
			IsActive:       true,
			UpdatedBy:      &userID,
		}
		if err := s.db.Create(&assignment).Error; err != nil {
			return nil, err
		}
	case nil:
		// Update existing
		existing.TemplateID = req.TemplateID
		existing.OverrideConfig = req.OverrideConfig
		existing.IsActive = true
		existing.UpdatedBy = &userID
		if err := s.db.Save(&existing).Error; err != nil {
			return nil, err
		}
	default:
		return nil, err
	}

	return s.GetInstrumentTemplate(req.InstrumentID)
}

func (s *VerificationService) GetInstrumentTemplate(instrumentID uint) (*structs.InstrumentTemplateResponse, error) {
	var assignment models.InstrumentTemplate
	if err := s.db.Preload("Instrument").Preload("Template").Preload("User").
		Where("instrument_id = ?", instrumentID).First(&assignment).Error; err != nil {
		return nil, errors.New("template assignment not found")
	}

	return &structs.InstrumentTemplateResponse{
		InstrumentID:   assignment.InstrumentID,
		NoKontrol:      assignment.Instrument.KodeInstrument,
		InstrumentName: assignment.Instrument.Nama,
		TemplateID:     assignment.TemplateID,
		TemplateName:   assignment.Template.TemplateName,
		OverrideConfig: assignment.OverrideConfig,
		IsActive:       assignment.IsActive,
		UpdatedBy:      getUsername(assignment.User),
		UpdatedAt:      assignment.UpdatedAt,
	}, nil
}

// ============================================
// HELPER FUNCTIONS
// ============================================

func getUsername(user models.User) string {
	if user.Id == 0 {
		return "System"
	}
	return user.Name
}

func buildUserBasicInfo(user models.User) structs.UserBasicInfo {
	return structs.UserBasicInfo{
		Id:   user.Id,
		Name: user.Name,
	}
}

func (s *VerificationService) StartVerification(req structs.StartVerificationRequest, userID uint) (*structs.StartVerificationResponse, error) {
	// Get instrument
	var instrument models.Instrument
	if err := s.db.First(&instrument, req.InstrumentID).Error; err != nil {
		return nil, errors.New("instrument not found")
	}

	// Check if already verified today
	today := time.Now().Truncate(24 * time.Hour)
	var existingVerification models.InstrumentVerification
	err := s.db.Where("instrument_id = ? AND DATE(verified_at) = ? AND status IN ?",
		req.InstrumentID, today.Format("2006-01-02"), []string{"In Progress", "Complies"}).
		First(&existingVerification).Error

	if err == nil {
		return nil, errors.New("instrument already has an active verification today")
	}

	// Get template - either specified or default for instrument type
	var template models.VerificationTemplate
	if req.TemplateID != nil {
		if err := s.db.First(&template, *req.TemplateID).Error; err != nil {
			return nil, errors.New("specified template not found")
		}
	} else {
		err = s.db.Where("instrument_type = ? AND is_default = ? AND is_active = ?",
			instrument.Nama, true, true).First(&template).Error
		if err != nil {
			return nil, fmt.Errorf("no default template found for instrument type '%s'. "+
				"Please set a default template for this type.", instrument.Nama)
		}

	}

	// Create verification record
	verification := models.InstrumentVerification{
		InstrumentID:     req.InstrumentID,
		TemplateID:       &template.Id,
		VerifiedBy:       userID,
		VerifiedAt:       time.Now(),
		ValidUntil:       time.Now().AddDate(0, 0, 1),
		Status:           "In Progress",
		RoomTemp:         req.RoomTemp,
		RoomHumidity:     req.RoomHumidity,
		VerificationData: req.InitialData,
	}

	if !database.IsDBAvailable() {
		log.Println("[Offline] DB unavailable — queuing instrument_verification")
		if err := EnqueueVerification(verification); err != nil { // ← CP2
			return nil, err
		}
	} else if err := s.db.Create(&verification).Error; err != nil { // ← CP2
		return nil, err
	}

	// Create verification steps from template
	for _, stepConfig := range template.Steps {
		step := models.VerificationStep{
			VerificationID: verification.Id,
			StepNumber:     stepConfig.StepNumber,
			StepName:       stepConfig.StepName,
			StepType:       stepConfig.StepType,
			Status:         "Pending",
			StepConfig:     stepConfig,
			InputData:      make(models.JSONB),
			ReadingData:    make(models.JSONB),
			ResultData:     make(models.JSONB),
			ReferenceType:  stepConfig.ReferenceType,
			Readings:       models.Float64Array{},
		}

		// Set first step or steps with no dependencies to Ready
		if len(stepConfig.DependsOn) == 0 {
			step.Status = "Ready"
		}

		if err := s.db.Create(&step).Error; err != nil {
			return nil, err
		}
	}

	// Build response
	steps := make([]structs.VerificationStepInfo, len(template.Steps))
	for i, stepConfig := range template.Steps {
		status := "Pending"
		if len(stepConfig.DependsOn) == 0 {
			status = "Ready"
		}

		steps[i] = structs.VerificationStepInfo{
			StepNumber:    stepConfig.StepNumber,
			StepName:      stepConfig.StepName,
			StepType:      stepConfig.StepType,
			Description:   stepConfig.Description,
			Required:      stepConfig.Required,
			Status:        status,
			DependsOn:     stepConfig.DependsOn,
			ReferenceType: stepConfig.ReferenceType,
			InputType:     stepConfig.InputType,
			Unit:          stepConfig.Unit,
			UIComponent:   stepConfig.UIComponent,
		}
	}

	// Get available references grouped by type
	availableReferences := s.getAvailableReferences(req.InstrumentID)

	// Determine first step
	currentStepNumber := 1
	for _, step := range steps {
		if len(step.DependsOn) == 0 {
			currentStepNumber = step.StepNumber
			break
		}
	}

	return &structs.StartVerificationResponse{
		VerificationID:      verification.Id,
		InstrumentID:        instrument.Id,
		InstrumentType:      instrument.Nama,
		TemplateID:          template.Id,
		TemplateName:        template.TemplateName,
		Steps:               steps,
		GlobalRules:         template.GlobalRules,
		RequiresConnection:  template.RequiresConnection,
		ConnectionType:      template.ConnectionType,
		Status:              "In Progress",
		TotalSteps:          len(steps),
		RequiredSteps:       countRequiredSteps(template.Steps),
		CurrentStepNumber:   currentStepNumber,
		AvailableReferences: availableReferences,
		Message:             "Verification started successfully",
	}, nil
}

func (s *VerificationService) ExecuteStep(req structs.ExecuteStepRequest, userRole string) (*structs.ExecuteStepResponse, error) {
	// Get verification
	var verification models.InstrumentVerification
	if err := s.db.Preload("Instrument").Preload("Instrument.InstrumentConfig").
		Preload("Template").First(&verification, req.VerificationID).Error; err != nil {
		return nil, errors.New("verification not found")
	}

	// Get step
	var step models.VerificationStep
	if err := s.db.Where("verification_id = ? AND step_number = ?", req.VerificationID, req.StepNumber).
		First(&step).Error; err != nil {
		return nil, errors.New("step not found")
	}

	if req.SkipValidation {
		return s.handleOverrideStep(&step, req, userRole)
	}

	// Check if step is ready
	if step.Status != "Ready" && step.Status != "Pending" && step.Status != "Waiting Bridge" {

		return nil, fmt.Errorf("step is not ready for execution (current status: %s)", step.Status)
	}

	// Check dependencies
	if len(step.StepConfig.DependsOn) > 0 {
		for _, depStepNum := range step.StepConfig.DependsOn {
			var depStep models.VerificationStep
			if err := s.db.Where("verification_id = ? AND step_number = ?", req.VerificationID, depStepNum).
				First(&depStep).Error; err != nil {
				return nil, fmt.Errorf("dependency step %d not found", depStepNum)
			}
			if !depStep.IsCompleted() {
				return nil, fmt.Errorf("dependency step %d is not completed", depStepNum)
			}
		}
	}

	// Execute step based on type
	startTime := time.Now()
	step.StartedAt = &startTime
	step.Status = "In Progress"
	s.db.Save(&step)

	var result *structs.ExecuteStepResponse
	var err error

	switch step.StepType {
	case "auto_read":
		// Check if this is a batch multi-line read (e.g., pH Meter reading all buffers at once)
		readMode, _ := step.StepConfig.Metadata["read_mode"].(string)
		parseFormat, _ := step.StepConfig.Metadata["parse_format"].(string)
		if readMode == "batch" && parseFormat == "multi_line" {
			result, err = s.executeBatchMultiLineStep(&step, &verification, req, userRole)
		} else {
			result, err = s.executeAutoReadStep(&step, &verification, req, userRole)
		}
	case "manual_input":
		result, err = s.executeManualInputStep(&step, req)
	case "selection":
		result, err = s.executeSelectionStep(&step, req)
	case "multi_reading":
		result, err = s.executeMultiReadingStep(&step, &verification, req)
	case "calculation":
		result, err = s.executeCalculationStep(&step, req)
	default:
		return nil, fmt.Errorf("unknown step type: %s", step.StepType)
	}

	if err != nil {
		step.Status = "Failed"
		step.ValidationMsg = err.Error()
		s.db.Save(&step)
		return nil, err
	}

	// Update step timing
	completedTime := time.Now()
	step.CompletedAt = &completedTime
	step.CalculateDuration()

	// Update next steps if this one succeeded
	if step.IsCompleted() {
		s.updateDependentSteps(req.VerificationID, req.StepNumber)
	}

	s.db.Save(&step)

	// Determine next step
	result.NextStepNumber = s.getNextStepNumber(req.VerificationID, req.StepNumber)

	// ✅ AUTO-COMPLETE: if no next step remains and the verification is still In Progress,
	// automatically finalise it so the frontend can redirect to the detail/PDF view.
	if result.NextStepNumber == nil {
		var v models.InstrumentVerification
		if dbErr := s.db.Preload("Steps").First(&v, req.VerificationID).Error; dbErr == nil {
			if v.Status == "In Progress" {

				// ✅ Jangan auto-complete kalau ada step yang masih waiting bridge
				hasWaitingBridge := false
				for _, vs := range v.Steps {
					if vs.Status == "Waiting Bridge" {
						hasWaitingBridge = true
						break
					}
				}
				if hasWaitingBridge {
					return result, nil
				}

				allDone := true
				for _, vs := range v.Steps {
					if vs.StepConfig.Required && !vs.IsCompleted() {
						allDone = false
						break
					}
				}
				if allDone {
					overallComplies := true
					for _, vs := range v.Steps {
						if vs.IsFailed() || vs.Status == "Not Complies" {
							overallComplies = false
							break
						}
					}
					if overallComplies {
						v.Status = "Complies"
					} else {
						v.Status = "Not Complies"
					}
					s.db.Save(&v)
					result.VerificationCompleted = true
					result.VerificationStatus = v.Status
				}
			}
		}
	}

	return result, nil
}

func (s *VerificationService) handleOverrideStep(step *models.VerificationStep, req structs.ExecuteStepRequest, userRole string) (*structs.ExecuteStepResponse, error) {
	// Only admins can override
	if userRole != "administrator" && userRole != "superadmin" {
		return nil, errors.New("only administrators can override step validations")
	}

	// Get action from input data
	action, _ := req.InputData["action"].(string)
	reason, _ := req.InputData["override_reason"].(string)
	forceStatus, _ := req.InputData["force_status"].(string)

	if reason == "" {
		return nil, errors.New("override reason is required")
	}

	// Update step based on action
	now := time.Now()

	switch action {
	case "breakdown":
		step.Status = "Failed"
		step.ValidationMsg = fmt.Sprintf("Instrument breakdown: %s", reason)
		step.OverrideReason = reason
		step.CompletedAt = &now

	case "continue":
		if forceStatus != "" {
			step.Status = forceStatus
		} else {
			step.Status = "Completed"
		}
		step.ValidationMsg = fmt.Sprintf("Override approved: %s", reason)
		step.OverrideReason = reason
		step.CompletedAt = &now

	default:
		return nil, errors.New("invalid override action")
	}

	// Save step
	if err := s.db.Save(step).Error; err != nil {
		return nil, err
	}

	// Build response
	response := &structs.ExecuteStepResponse{
		Success:       true,
		StepNumber:    step.StepNumber,
		StepName:      step.StepName,
		StepType:      step.StepType,
		Status:        step.Status,
		ValidationMsg: step.ValidationMsg,
		CanContinue:   action == "continue",
		NeedsOverride: false,
		Message:       fmt.Sprintf("Override %s processed successfully", action),
	}

	// Get next step if continuing
	if action == "continue" {
		nextStepNum := s.getNextStepNumber(req.VerificationID, req.StepNumber)
		response.NextStepNumber = nextStepNum

		// Update dependent steps
		s.updateDependentSteps(req.VerificationID, req.StepNumber)
	}

	return response, nil
}

// ============================================
// STEP EXECUTION HANDLERS
// ============================================
func (s *VerificationService) processAutoReadValue(
	step *models.VerificationStep,
	verification *models.InstrumentVerification,
	req structs.ExecuteStepRequest,
	userRole string,
	value float64,
) (*structs.ExecuteStepResponse, error) {

	// Get expected range dari reference
	var minRange, maxRange, expectedValue *float64
	var referenceID *uint
	var referenceType, referenceName string

	if req.ReferenceID != nil {
		var reference models.VerificationReference
		if err := s.db.First(&reference, *req.ReferenceID).Error; err != nil {
			return nil, errors.New("reference not found")
		}

		minRange = reference.MinTolerance
		maxRange = reference.MaxTolerance
		expectedValue = reference.NominalValue
		if expectedValue == nil {
			expectedValue = reference.BufferValue
		}

		referenceID = &reference.Id
		referenceType = reference.ReferenceType
		referenceName = reference.Name

		step.ReferenceID = req.ReferenceID
		step.ReferenceType = reference.ReferenceType
		step.ExpectedValue = expectedValue
		step.MinValue = minRange
		step.MaxValue = maxRange
	}

	// Admin dapat override range
	if (userRole == "administrator" || userRole == "superadmin") && !req.SkipValidation {
		if req.MinRange != nil {
			minRange = req.MinRange
			step.MinValue = minRange
		}
		if req.MaxRange != nil {
			maxRange = req.MaxRange
			step.MaxValue = maxRange
		}
	}

	// Validasi
	validationResult := s.validateReading(value, minRange, maxRange, step.StepConfig.ValidationRules)

	step.MeasuredValue = &value
	step.Status = validationResult.ComplianceType
	step.ValidationMsg = fmt.Sprintf("%v", validationResult.Messages)
	step.ReadingData = models.JSONB{
		"value":        value,
		"timestamp":    time.Now(),
		"reference_id": req.ReferenceID,
		"source":       "bridge", // ← marker bahwa ini dari bridge
	}

	if err := s.db.Save(step).Error; err != nil {
		return nil, err
	}

	canContinue := validationResult.ComplianceType == "Complies" || !step.StepConfig.Required
	needsOverride := validationResult.ComplianceType == "Not Complies" && step.StepConfig.Required

	return &structs.ExecuteStepResponse{
		Success:        true,
		StepNumber:     step.StepNumber,
		StepName:       step.StepName,
		StepType:       step.StepType,
		Status:         step.Status,
		MeasuredValue:  &value,
		ExpectedValue:  expectedValue,
		MinRange:       minRange,
		MaxRange:       maxRange,
		ValidationMsg:  step.ValidationMsg,
		CanContinue:    canContinue,
		NeedsOverride:  needsOverride,
		NextStepNumber: nil, // diisi caller (ExecuteStep)
		Message:        fmt.Sprintf("Reading completed: %.4f %s", value, step.StepConfig.Unit),
		ReferenceID:    referenceID,
		ReferenceType:  &referenceType,
		ReferenceName:  &referenceName,
		Unit:           step.StepConfig.Unit,
	}, nil
}

func (s *VerificationService) executeAutoReadStep(
	step *models.VerificationStep,
	verification *models.InstrumentVerification,
	req structs.ExecuteStepRequest,
	userRole string,
) (*structs.ExecuteStepResponse, error) {

	// Cek bridge_value dulu
	if bridgeVal, ok := req.InputData["bridge_value"]; ok {
		if value, ok2 := toFloat64(bridgeVal); ok2 {
			return s.processAutoReadValue(step, verification, req, userRole, value)
		}
	}

	// ✅ Timeout pending lama
	tenMinutesAgo := time.Now().Add(-10 * time.Minute)
	s.db.Model(&models.VerificationReadRequest{}).
		Where("instrument_id = ? AND status = ? AND requested_at < ?",
			verification.InstrumentID, "pending", tenMinutesAgo).
		Updates(map[string]interface{}{"status": "timeout"})

	config := verification.Instrument.InstrumentConfig
	if config == nil {
		return nil, errors.New("instrument has no configuration")
	}

	// ✅ TCP/IP → langsung baca, tidak perlu pending request
	if config.IPAddress != "" && config.TCPPort != 0 {
		log.Printf("[AutoRead] TCP/IP instrument, reading directly...")
		value, err := s.readInstrumentValue(verification.Instrument)
		if err != nil {
			return nil, fmt.Errorf("failed to read TCP/IP instrument: %v", err)
		}
		return s.processAutoReadValue(step, verification, req, userRole, value)
	}

	// ✅ Tibbo → langsung baca
	if config.IPAddress != "" && config.TCPPort == 0 {
		log.Printf("[AutoRead] Tibbo instrument, reading directly...")
		value, err := s.readInstrumentValue(verification.Instrument)
		if err != nil {
			return nil, fmt.Errorf("failed to read Tibbo instrument: %v", err)
		}
		return s.processAutoReadValue(step, verification, req, userRole, value)
	}

	// ✅ RS-232 → buat satu pending request, tunggu bridge
	if config.ComPort != "" {
		log.Printf("[AutoRead] RS-232 instrument, creating bridge pending request...")
		readReq := models.VerificationReadRequest{
			VerificationID: req.VerificationID,
			StepNumber:     req.StepNumber,
			InstrumentID:   verification.InstrumentID,
			ReferenceID:    req.ReferenceID,
			StepType:       step.StepType,
			Status:         "pending",
			RequestedAt:    time.Now(),
		}
		if err := s.db.Create(&readReq).Error; err != nil {
			return nil, err
		}

		step.Status = "Waiting Bridge"
		s.db.Save(&step)

		return &structs.ExecuteStepResponse{
			Success:     true,
			StepNumber:  step.StepNumber,
			StepName:    step.StepName,
			StepType:    step.StepType,
			Status:      "Waiting Bridge",
			CanContinue: false,
			Message:     "Waiting for RS-232 instrument reading via bridge...",
		}, nil
	}

	return nil, errors.New("instrument has no valid connection configuration")
}

// executeBatchMultiLineStep handles instruments (e.g. pH Meter) that send a full
// structured printout in one burst. The raw lines are stored verbatim as documentation.
// Validation is done by scanning for "Actual pH" lines (in order) and comparing them
// against the per-buffer rules defined in validation_rules (ph4_min/ph4_max, ph7_min/ph7_max).

func (s *VerificationService) executeBatchMultiLineStep(step *models.VerificationStep, verification *models.InstrumentVerification, req structs.ExecuteStepRequest, userRole string) (*structs.ExecuteStepResponse, error) {

	// 1. Read ALL raw lines from the instrument — no parsing, store as-is
	rawLines, err := s.readInstrumentRawLines(verification.Instrument)
	if err != nil {
		return nil, fmt.Errorf("failed to read instrument: %v", err)
	}
	if len(rawLines) == 0 {
		return nil, errors.New("instrument returned no data")
	}

	// Deduplicate: the pH meter often sends the same printout twice.
	// Keep only the first occurrence by detecting the repeat start.
	rawLines = deduplicatePrintout(rawLines)

	// Join into a single raw text block for storage
	rawText := strings.Join(rawLines, "\n")
	log.Printf("[BatchRead] Captured %d lines of raw instrument output", len(rawLines))

	// 2. Build buffer order from prior step metadata
	//    e.g. step 1 metadata: buffer_type="ph7", step 2: buffer_type="ph4"
	readStepsRaw, _ := step.StepConfig.Metadata["read_steps"].([]interface{})
	type bufferOrder struct {
		stepNumber int
		bufferType string // "ph4" or "ph7"
	}
	var bufferSeq []bufferOrder
	for _, rsRaw := range readStepsRaw {
		rsNum := 0
		switch v := rsRaw.(type) {
		case float64:
			rsNum = int(v)
		case int:
			rsNum = v
		}
		var priorStep models.VerificationStep
		if err := s.db.Where("verification_id = ? AND step_number = ?", req.VerificationID, rsNum).
			First(&priorStep).Error; err != nil {
			return nil, fmt.Errorf("prior step %d not found", rsNum)
		}
		bufferType, _ := priorStep.StepConfig.Metadata["buffer_type"].(string)
		bufferSeq = append(bufferSeq, bufferOrder{stepNumber: rsNum, bufferType: bufferType})
	}

	// 3. Extract "Actual pH" values from raw lines in the order they appear.
	//    The pH meter prints them like:  "Actual pH  4.01 pH"
	actualPHValues := extractActualPHValues(rawLines)
	log.Printf("[BatchRead] Extracted %d 'Actual pH' values: %v", len(actualPHValues), actualPHValues)

	// 4. Validate each buffer
	rules := step.StepConfig.ValidationRules
	allComplies := true

	type bufferResult struct {
		BufferType  string  `json:"buffer_type"`
		ActualValue float64 `json:"actual_value"`
		Min         float64 `json:"min"`
		Max         float64 `json:"max"`
		Complies    bool    `json:"complies"`
	}
	var bufferResults []bufferResult
	var validationMsgs []string

	for i, buf := range bufferSeq {
		if i >= len(actualPHValues) {
			return nil, fmt.Errorf("instrument output contained %d 'Actual pH' readings but expected %d", len(actualPHValues), len(bufferSeq))
		}
		val := actualPHValues[i]
		minKey := buf.bufferType + "_min"
		maxKey := buf.bufferType + "_max"
		minVal, _ := rules[minKey].(float64)
		maxVal, _ := rules[maxKey].(float64)

		complies := val >= minVal && val <= maxVal
		if !complies {
			allComplies = false
			validationMsgs = append(validationMsgs, fmt.Sprintf("%s: %.4f pH ✗ (range %.4f–%.4f)", buf.bufferType, val, minVal, maxVal))
		} else {
			validationMsgs = append(validationMsgs, fmt.Sprintf("%s: %.4f pH ✓ (range %.4f–%.4f)", buf.bufferType, val, minVal, maxVal))
		}
		bufferResults = append(bufferResults, bufferResult{
			BufferType:  buf.bufferType,
			ActualValue: val,
			Min:         minVal,
			Max:         maxVal,
			Complies:    complies,
		})
	}

	// 5. Persist — store raw printout verbatim, plus structured results
	complianceType := "Complies"
	if !allComplies {
		complianceType = "Not Complies"
	}

	// ✅ FIX: Don't set a misleading single numeric measured_value.
	// This is a multi-line batch read — the meaningful data is in reading_data.
	// Set measured_value to nil and mark the step as "done read" in result_data.
	step.MeasuredValue = nil // ← no single value to show
	step.Status = complianceType
	step.ValidationMsg = strings.Join(validationMsgs, "; ")
	step.ReadingData = models.JSONB{
		"raw_text":       rawText,
		"raw_lines":      rawLines,
		"buffer_results": bufferResults,
		"timestamp":      time.Now(),
		"status":         "done read", // ← human-readable marker
	}
	step.ResultData = models.JSONB{
		"raw_text":       rawText,
		"buffer_results": bufferResults,
		"all_complies":   allComplies,
		"status":         "done read",
	}

	if len(bufferResults) > 0 {
		overallMin := bufferResults[0].Min
		overallMax := bufferResults[0].Max
		for _, br := range bufferResults[1:] {
			if br.Min < overallMin {
				overallMin = br.Min
			}
			if br.Max > overallMax {
				overallMax = br.Max
			}
		}
		step.MinValue = &overallMin
		step.MaxValue = &overallMax
	}

	if err := s.db.Save(step).Error; err != nil {
		return nil, err
	}

	canContinue := allComplies || !step.StepConfig.Required
	needsOverride := !allComplies && step.StepConfig.Required

	summary := fmt.Sprintf("pH Meter printout captured (%d lines)", len(rawLines))
	if allComplies {
		summary += " — all buffers within specification"
	} else {
		summary += " — one or more buffers out of specification"
	}

	return &structs.ExecuteStepResponse{
		Success:       true,
		StepNumber:    step.StepNumber,
		StepName:      step.StepName,
		StepType:      step.StepType,
		Status:        complianceType,
		MeasuredValue: nil, // ← no single value; UI should show buffer_results instead
		ValidationMsg: step.ValidationMsg,
		CanContinue:   canContinue,
		NeedsOverride: needsOverride,
		ResultData: map[string]interface{}{
			"raw_text":       rawText,
			"buffer_results": bufferResults,
			"all_complies":   allComplies,
			"status":         "done read",
		},
		Message: summary,
		Unit:    step.StepConfig.Unit,
	}, nil
}

// readInstrumentRawLines fetches all lines from the instrument verbatim (no numeric parsing).
func (s *VerificationService) readInstrumentRawLines(instrument models.Instrument) ([]string, error) {
	if instrument.InstrumentConfig == nil {
		return nil, errors.New("instrument configuration not found")
	}
	config := instrument.InstrumentConfig

	if config.ComPort != "" {
		return s.serialReader.ReadAllLines(config)
	} else if config.IPAddress != "" && config.TCPPort != 0 {
		return s.tcpReader.ReadAllLines(config)
	} else if config.IPAddress != "" {
		return s.tibboReader.ReadAllLines(config)
	}
	return nil, errors.New("no valid connection configuration found")
}

// extractActualPHValues scans raw lines for "Actual pH" entries and returns the
// numeric pH values in the order they appear (Buffer 1 first, then Buffer 2, etc.).
// It matches lines like: "Actual pH  4.01 pH" or "Actual pH  6.99 pH"
func extractActualPHValues(lines []string) []float64 {
	re := regexp.MustCompile(`(?i)actual\s+ph\s+([\d.]+)`)
	var values []float64
	for _, line := range lines {
		m := re.FindStringSubmatch(line)
		if m != nil {
			if v, err := strconv.ParseFloat(m[1], 64); err == nil {
				values = append(values, v)
			}
		}
	}
	return values
}

// deduplicatePrintout removes repeated copies of the same printout.
// The pH meter sends the printout twice; we detect the repeat by looking for
// the second occurrence of the first non-empty line and truncating there.
func deduplicatePrintout(lines []string) []string {
	if len(lines) < 2 {
		return lines
	}
	// Find first non-empty line as the "header" marker
	header := ""
	for _, l := range lines {
		if strings.TrimSpace(l) != "" {
			header = strings.TrimSpace(l)
			break
		}
	}
	if header == "" {
		return lines
	}
	// Find second occurrence
	foundFirst := false
	for i, l := range lines {
		if strings.TrimSpace(l) == header {
			if !foundFirst {
				foundFirst = true
				continue
			}
			// Second occurrence found — truncate
			log.Printf("[BatchRead] Duplicate printout detected at line %d, truncating", i)
			return lines[:i]
		}
	}
	return lines
}

func (s *VerificationService) executeManualInputStep(step *models.VerificationStep, req structs.ExecuteStepRequest) (*structs.ExecuteStepResponse, error) {
	if req.InputData == nil {
		return nil, errors.New("input data required for manual input step")
	}

	// Validate input against rules
	validationResult := s.validateManualInput(req.InputData, step.StepConfig.ValidationRules)

	step.InputData = req.InputData
	step.Status = validationResult.ComplianceType
	step.ValidationMsg = fmt.Sprintf("%v", validationResult.Messages)

	// Extract numeric value for storage and response display
	var measuredValue *float64
	if raw, ok := req.InputData["value"]; ok {
		if f, ok := toFloat64(raw); ok {
			step.MeasuredValue = &f
			measuredValue = &f
		}
	}

	// Extract min/max from validation_rules for response display
	var minRange, maxRange *float64
	if step.StepConfig.ValidationRules != nil {
		if minVal, ok := toFloat64(step.StepConfig.ValidationRules["min"]); ok {
			step.MinValue = &minVal
			minRange = &minVal
		}
		if maxVal, ok := toFloat64(step.StepConfig.ValidationRules["max"]); ok {
			step.MaxValue = &maxVal
			maxRange = &maxVal
		}
		// Swap if accidentally inverted in template
		if minRange != nil && maxRange != nil && *minRange > *maxRange {
			*minRange, *maxRange = *maxRange, *minRange
		}
	}

	needsOverride := validationResult.ComplianceType == "Not Complies" && step.StepConfig.Required

	return &structs.ExecuteStepResponse{
		Success:       true,
		StepNumber:    step.StepNumber,
		StepName:      step.StepName,
		StepType:      step.StepType,
		Status:        step.Status,
		MeasuredValue: measuredValue,
		MinRange:      minRange,
		MaxRange:      maxRange,
		ValidationMsg: step.ValidationMsg,
		CanContinue:   validationResult.ComplianceType == "Complies" || !step.StepConfig.Required,
		NeedsOverride: needsOverride,
		Message:       "Manual input recorded",
	}, nil
}

func (s *VerificationService) executeSelectionStep(step *models.VerificationStep, req structs.ExecuteStepRequest) (*structs.ExecuteStepResponse, error) {
	if req.InputData == nil {
		return nil, errors.New("selection required")
	}

	step.InputData = req.InputData
	step.Status = "Completed"

	return &structs.ExecuteStepResponse{
		Success:     true,
		StepNumber:  step.StepNumber,
		StepName:    step.StepName,
		StepType:    step.StepType,
		Status:      step.Status,
		CanContinue: true,
		Message:     "Selection recorded",
	}, nil
}

func (s *VerificationService) executeMultiReadingStep(step *models.VerificationStep, verification *models.InstrumentVerification, req structs.ExecuteStepRequest) (*structs.ExecuteStepResponse, error) {
	readingCount := step.StepConfig.ReadingCount
	if readingCount < 1 {
		readingCount = 3 // default
	}

	readings := make([]float64, readingCount)
	for i := 0; i < readingCount; i++ {
		value, err := s.readInstrumentValue(verification.Instrument)
		if err != nil {
			return nil, fmt.Errorf("failed to read value %d: %v", i+1, err)
		}
		readings[i] = value
		time.Sleep(1 * time.Second) // Small delay between readings
	}

	// Calculate statistics
	avg, stdDev := calculateStatistics(readings)

	step.Readings = readings
	step.MeasuredValue = &avg
	step.ResultData = models.JSONB{
		"readings":  readings,
		"average":   avg,
		"std_dev":   stdDev,
		"count":     readingCount,
		"timestamp": time.Now(),
	}

	// Validate average against rules
	validationResult := s.validateReading(avg, step.MinValue, step.MaxValue, step.StepConfig.ValidationRules)
	step.Status = validationResult.ComplianceType
	step.ValidationMsg = fmt.Sprintf("%v", validationResult.Messages)

	return &structs.ExecuteStepResponse{
		Success:       true,
		StepNumber:    step.StepNumber,
		StepName:      step.StepName,
		StepType:      step.StepType,
		Status:        step.Status,
		MeasuredValue: &avg,
		Readings:      readings,
		ResultData: map[string]interface{}{
			"average": avg,
			"std_dev": stdDev,
		},
		ValidationMsg: step.ValidationMsg,
		CanContinue:   validationResult.ComplianceType == "Complies",
		Message:       fmt.Sprintf("Multi-reading completed: avg=%.4f, std_dev=%.4f", avg, stdDev),
	}, nil
}

func (s *VerificationService) executeCalculationStep(step *models.VerificationStep, req structs.ExecuteStepRequest) (*structs.ExecuteStepResponse, error) {
	// This would use an expression evaluator to calculate based on previous steps
	// For now, simplified version
	if req.InputData == nil {
		return nil, errors.New("calculation data required")
	}

	step.InputData = req.InputData
	step.ResultData = req.InputData
	step.Status = "Completed"

	return &structs.ExecuteStepResponse{
		Success:     true,
		StepNumber:  step.StepNumber,
		StepName:    step.StepName,
		StepType:    step.StepType,
		Status:      step.Status,
		ResultData:  req.InputData,
		CanContinue: true,
		Message:     "Calculation completed",
	}, nil
}

func (s *VerificationService) validateReading(value float64, minRange, maxRange *float64, rules models.JSONB) structs.StepValidationResult {
	messages := []string{}
	warnings := []string{}
	errors := []string{}
	isValid := true
	complianceType := "Complies"

	// Check range
	if minRange != nil && maxRange != nil {
		if value < *minRange || value > *maxRange {
			isValid = false
			complianceType = "Not Complies"
			errors = append(errors, fmt.Sprintf("Value %.4f is outside range [%.4f - %.4f]", value, *minRange, *maxRange))
		} else {
			messages = append(messages, fmt.Sprintf("Value %.4f is within range [%.4f - %.4f]", value, *minRange, *maxRange))
		}
	}

	// Additional validation rules
	if rules != nil {
		if tolerance, ok := rules["tolerance"].(float64); ok {
			if minRange != nil && maxRange != nil {
				midpoint := (*minRange + *maxRange) / 2
				if abs(value-midpoint) > tolerance {
					warnings = append(warnings, fmt.Sprintf("Value deviates from midpoint by more than tolerance: %.4f", tolerance))
				}
			}
		}
	}

	return structs.StepValidationResult{
		IsValid:        isValid,
		ComplianceType: complianceType,
		Messages:       messages,
		Errors:         errors,
		Warnings:       warnings,
	}
}

func (s *VerificationService) validateManualInput(inputData map[string]interface{}, rules models.JSONB) structs.StepValidationResult {
	messages := []string{}
	warnings := []string{}
	errs := []string{}
	isValid := true
	complianceType := "Complies"

	// ── 1. Extract numeric value from input ──────────────────────────────────
	// The frontend sends the value under the key "value".
	var value *float64
	if raw, ok := inputData["value"]; ok {
		switch v := raw.(type) {
		case float64:
			value = &v
		case int:
			f := float64(v)
			value = &f
		case string:
			var f float64
			if _, err := fmt.Sscanf(v, "%f", &f); err == nil {
				value = &f
			}
		}
	}

	if value == nil {
		// No parseable numeric value — still record input but cannot range-check
		messages = append(messages, "Manual input received (no numeric value to validate)")
		return structs.StepValidationResult{
			IsValid:        true,
			ComplianceType: "Complies",
			Messages:       messages,
		}
	}

	// ── 2. Apply min / max from validation_rules ─────────────────────────────
	if rules != nil {
		// JSON numbers unmarshal as float64 in Go
		minVal, hasMin := toFloat64(rules["min"])
		maxVal, hasMax := toFloat64(rules["max"])

		if hasMin && hasMax {
			// Guard against accidentally swapped min/max in the template
			if minVal > maxVal {
				minVal, maxVal = maxVal, minVal
			}

			if *value < minVal || *value > maxVal {
				isValid = false
				complianceType = "Not Complies"
				errs = append(errs, fmt.Sprintf(
					"Value %.4f is outside acceptable range [%.4f – %.4f]",
					*value, minVal, maxVal,
				))
			} else {
				messages = append(messages, fmt.Sprintf(
					"Value %.4f is within acceptable range [%.4f – %.4f]",
					*value, minVal, maxVal,
				))
			}

			// ── 3. Tolerance check (warn only, does not affect compliance) ──
			if tolerance, ok := toFloat64(rules["tolerance"]); ok {
				midpoint := (minVal + maxVal) / 2
				if abs(*value-midpoint) > tolerance {
					warnings = append(warnings, fmt.Sprintf(
						"Value deviates from midpoint (%.4f) by more than tolerance (%.4f)",
						midpoint, tolerance,
					))
				}
			}
		} else if hasMin {
			if *value < minVal {
				isValid = false
				complianceType = "Not Complies"
				errs = append(errs, fmt.Sprintf("Value %.4f is below minimum %.4f", *value, minVal))
			}
		} else if hasMax {
			if *value > maxVal {
				isValid = false
				complianceType = "Not Complies"
				errs = append(errs, fmt.Sprintf("Value %.4f exceeds maximum %.4f", *value, maxVal))
			}
		}

		// ── 4. Required fields check ─────────────────────────────────────────
		if requiredFields, ok := rules["required_fields"].([]interface{}); ok {
			for _, field := range requiredFields {
				fieldName, _ := field.(string)
				if fieldName != "" {
					if _, exists := inputData[fieldName]; !exists {
						isValid = false
						complianceType = "Not Complies"
						errs = append(errs, fmt.Sprintf("Required field missing: %s", fieldName))
					}
				}
			}
		}
	}

	if len(messages) == 0 && len(errs) == 0 {
		messages = append(messages, "Manual input received")
	}

	return structs.StepValidationResult{
		IsValid:        isValid,
		ComplianceType: complianceType,
		Messages:       append(messages, errs...),
		Errors:         errs,
		Warnings:       warnings,
	}
}

// toFloat64 safely converts JSON-unmarshalled numeric values (float64, int, int64) to float64.
func toFloat64(v interface{}) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case int:
		return float64(n), true
	case int64:
		return float64(n), true
	}
	return 0, false
}

// ============================================
// STEP MANAGEMENT HELPERS
// ============================================

func (s *VerificationService) updateDependentSteps(verificationID uint, completedStepNumber int) {
	var allSteps []models.VerificationStep
	s.db.Where("verification_id = ?", verificationID).Find(&allSteps)

	for _, step := range allSteps {
		if step.Status == "Pending" && contains(step.StepConfig.DependsOn, completedStepNumber) {
			// Check if all dependencies are met
			allDepsMet := true
			for _, depStepNum := range step.StepConfig.DependsOn {
				var depStep models.VerificationStep
				if err := s.db.Where("verification_id = ? AND step_number = ?", verificationID, depStepNum).
					First(&depStep).Error; err != nil || !depStep.IsCompleted() {
					allDepsMet = false
					break
				}
			}

			if allDepsMet {
				step.Status = "Ready"
				s.db.Save(&step)
			}
		}
	}
}

func (s *VerificationService) getNextStepNumber(verificationID uint, currentStepNumber int) *int {
	var nextStep models.VerificationStep
	err := s.db.Where("verification_id = ? AND step_number > ? AND status IN ?",
		verificationID, currentStepNumber,
		[]string{"Ready", "Pending", "Waiting Bridge"}, // ← tambah Waiting Bridge
	).
		Order("step_number ASC").
		First(&nextStep).Error

	if err == nil {
		return &nextStep.StepNumber
	}
	return nil
}

// ============================================
// BATCH EXECUTION
// ============================================

func (s *VerificationService) BatchExecuteSteps(req structs.BatchExecuteStepsRequest, userRole string) (*structs.BatchExecuteStepsResponse, error) {
	results := make([]structs.ExecuteStepResponse, 0)
	successCount := 0
	failedCount := 0

	for _, stepReq := range req.Steps {
		result, err := s.ExecuteStep(stepReq, userRole)
		if err != nil {
			failedCount++
			if req.StopOnFailure {
				return &structs.BatchExecuteStepsResponse{
					Success:         false,
					VerificationID:  req.VerificationID,
					TotalSteps:      len(req.Steps),
					SuccessfulSteps: successCount,
					FailedSteps:     failedCount,
					Results:         results,
					Message:         fmt.Sprintf("Batch execution stopped due to failure: %v", err),
				}, nil
			}
			result = &structs.ExecuteStepResponse{
				Success:    false,
				StepNumber: stepReq.StepNumber,
				Message:    err.Error(),
			}
		} else {
			successCount++
		}
		results = append(results, *result)
	}

	return &structs.BatchExecuteStepsResponse{
		Success:         failedCount == 0,
		VerificationID:  req.VerificationID,
		TotalSteps:      len(req.Steps),
		SuccessfulSteps: successCount,
		FailedSteps:     failedCount,
		Results:         results,
		Message:         fmt.Sprintf("Batch execution completed: %d succeeded, %d failed", successCount, failedCount),
	}, nil
}

// ============================================
// VERIFICATION PROGRESS & COMPLETION
// ============================================

func (s *VerificationService) GetVerificationProgress(verificationID uint) (*structs.VerificationProgressResponse, error) {
	var verification models.InstrumentVerification
	if err := s.db.Preload("Instrument").Preload("Steps").First(&verification, verificationID).Error; err != nil {
		return nil, errors.New("verification not found")
	}

	totalSteps := len(verification.Steps)
	completedSteps := 0
	pendingSteps := 0
	failedSteps := 0

	var currentStep *structs.VerificationStepInfo
	steps := make([]structs.VerificationStepDetail, len(verification.Steps))

	for i, step := range verification.Steps {
		if step.IsCompleted() {
			completedSteps++
		} else if step.IsFailed() {
			failedSteps++
		} else if step.IsPending() {
			pendingSteps++
		}

		// Build detailed step info
		steps[i] = structs.VerificationStepDetail{
			StepNumber:     step.StepNumber,
			StepName:       step.StepName,
			StepType:       step.StepType,
			Description:    step.StepConfig.Description,
			Required:       step.StepConfig.Required,
			Status:         step.Status,
			InputData:      step.InputData,
			ReadingData:    step.ReadingData,
			ResultData:     step.ResultData,
			ValidationMsg:  step.ValidationMsg,
			ExpectedValue:  step.ExpectedValue,
			MinValue:       step.MinValue,
			MaxValue:       step.MaxValue,
			MeasuredValue:  step.MeasuredValue,
			Readings:       step.Readings,
			ReferenceID:    step.ReferenceID,
			ReferenceType:  step.ReferenceType,
			OverrideReason: step.OverrideReason,
			OverriddenBy:   step.OverriddenBy,
			OverriddenAt:   step.OverriddenAt,
			StartedAt:      step.StartedAt,
			CompletedAt:    step.CompletedAt,
			Duration:       step.Duration,
		}

		// Find current step
		if step.IsReady() && currentStep == nil {
			currentStep = &structs.VerificationStepInfo{
				StepNumber:    step.StepNumber,
				StepName:      step.StepName,
				StepType:      step.StepType,
				Description:   step.StepConfig.Description,
				Required:      step.StepConfig.Required,
				Status:        step.Status,
				DependsOn:     step.StepConfig.DependsOn,
				ReferenceType: step.ReferenceType,
				InputType:     step.StepConfig.InputType,
				Unit:          step.StepConfig.Unit,
				UIComponent:   step.StepConfig.UIComponent,
			}
		}
	}

	completionPercent := 0.0
	if totalSteps > 0 {
		completionPercent = float64(completedSteps) / float64(totalSteps) * 100
	}

	canComplete := completedSteps == totalSteps || (completedSteps+pendingSteps == totalSteps && pendingSteps > 0)
	canContinue := pendingSteps > 0 || currentStep != nil

	return &structs.VerificationProgressResponse{
		VerificationID:    verification.Id,
		InstrumentID:      verification.InstrumentID,
		Status:            verification.Status,
		CompletionPercent: completionPercent,
		TotalSteps:        totalSteps,
		CompletedSteps:    completedSteps,
		PendingSteps:      pendingSteps,
		FailedSteps:       failedSteps,
		CurrentStep:       currentStep,
		Steps:             steps,
		CanComplete:       canComplete,
		CanContinue:       canContinue,
		Message:           fmt.Sprintf("%d of %d steps completed", completedSteps, totalSteps),
	}, nil
}

func (s *VerificationService) CompleteVerification(verificationID uint, notes string) (*structs.VerificationProgressResponse, error) {
	var verification models.InstrumentVerification
	if err := s.db.Preload("Steps").First(&verification, verificationID).Error; err != nil {
		return nil, errors.New("verification not found")
	}

	// Check if all required steps are completed
	allRequiredCompleted := true
	overallComplies := true

	for _, step := range verification.Steps {
		if step.StepConfig.Required && !step.IsCompleted() {
			allRequiredCompleted = false
		}
		if step.IsFailed() || step.Status == "Not Complies" {
			overallComplies = false
		}
	}

	if !allRequiredCompleted {
		return nil, errors.New("all required steps must be completed before finishing verification")
	}

	// Update verification status
	if overallComplies {
		verification.Status = "Complies"
	} else {
		verification.Status = "Not Complies"
	}
	verification.Notes = notes

	verification.ApprovalStatus = "pending_approval" // ← add this

	if err := s.db.Save(&verification).Error; err != nil {
		return nil, err
	}

	s.db.Model(&models.VerificationReadRequest{}).
		Where("verification_id = ? AND status = ?", verificationID, "pending").
		Updates(map[string]interface{}{"status": "fulfilled"})

	return s.GetVerificationProgress(verificationID)
}

func (s *VerificationService) CancelVerification(verificationID uint) error {
	var verification models.InstrumentVerification
	if err := s.db.Preload("Steps").First(&verification, verificationID).Error; err != nil {
		return errors.New("verification not found")
	}

	// Check if verification can be cancelled
	if verification.Status == "Completed" {
		return errors.New("cannot cancel a completed verification")
	}

	if verification.Status == "Cancelled" {
		return errors.New("verification is already cancelled")
	}

	// Begin transaction
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Update verification status
	verification.Status = "Cancelled"
	verification.CancelledAt = timePtr(time.Now())

	if err := tx.Save(&verification).Error; err != nil {
		tx.Rollback()
		return err
	}

	// Reset all steps to cancelled state
	if err := tx.Model(&models.VerificationStep{}).
		Where("verification_id = ?", verificationID).
		Updates(map[string]interface{}{
			"status": "Cancelled",
		}).Error; err != nil {
		tx.Rollback()
		return err
	}

	tx.Model(&models.VerificationReadRequest{}).
		Where("verification_id = ? AND status = ?", verificationID, "pending").
		Updates(map[string]interface{}{"status": "cancelled"})

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		return err
	}

	return nil
}

// BreakdownVerification marks a verification as "Not Complies" due to instrument breakdown.
// The triggering step is marked "Failed" with the override reason recorded.
// All remaining Pending/Ready steps are bulk-skipped so CompleteVerification won't block.
// The verification status is then set to "Not Complies" in one transaction.
func (s *VerificationService) BreakdownVerification(verificationID uint, stepNumber int, overrideReason, notes string) error {
	var verification models.InstrumentVerification
	if err := s.db.Preload("Steps").First(&verification, verificationID).Error; err != nil {
		return errors.New("verification not found")
	}

	if verification.Status != "In Progress" {
		return fmt.Errorf("cannot breakdown a verification with status: %s", verification.Status)
	}

	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	now := time.Now()

	// Mark the breakdown step as Failed with reason recorded
	if stepNumber > 0 {
		if err := tx.Model(&models.VerificationStep{}).
			Where("verification_id = ? AND step_number = ?", verificationID, stepNumber).
			Updates(map[string]interface{}{
				"status":          "Failed",
				"validation_msg":  fmt.Sprintf("Instrument breakdown: %s", overrideReason),
				"override_reason": overrideReason,
				"completed_at":    now,
			}).Error; err != nil {
			tx.Rollback()
			return err
		}
	}

	// Skip all remaining Pending/Ready steps so the completion check passes
	if err := tx.Model(&models.VerificationStep{}).
		Where("verification_id = ? AND status IN ? AND step_number != ?",
			verificationID, []string{"Pending", "Ready"}, stepNumber).
		Updates(map[string]interface{}{
			"status":         "Skipped",
			"validation_msg": fmt.Sprintf("Auto-skipped: instrument breakdown at step %d", stepNumber),
		}).Error; err != nil {
		tx.Rollback()
		return err
	}

	// Set verification to Not Complies
	breakdownNotes := fmt.Sprintf("Instrument breakdown at step %d: %s", stepNumber, overrideReason)
	if notes != "" {
		breakdownNotes = notes
	}
	verification.Status = "Not Complies"
	verification.Notes = breakdownNotes

	if err := tx.Save(&verification).Error; err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit().Error
}

// Helper function
func timePtr(t time.Time) *time.Time {
	return &t
}

// ============================================
// REFERENCES
// ============================================

func (s *VerificationService) CreateReference(req structs.CreateReferenceRequest) (*models.VerificationReference, error) {
	reference := models.VerificationReference{
		InstrumentID:    req.InstrumentID,
		ReferenceType:   req.ReferenceType,
		NoKontrol:       req.NoKontrol,
		Name:            req.Name,
		NominalValue:    req.NominalValue,
		BufferValue:     req.BufferValue,
		MinTolerance:    req.MinTolerance,
		MaxTolerance:    req.MaxTolerance,
		Status:          "Active",
		CalibrationDate: req.CalibrationDate,
		ExpiryDate:      req.ExpiryDate,
	}

	if err := s.db.Create(&reference).Error; err != nil {
		return nil, err
	}

	return &reference, nil
}

func (s *VerificationService) GetReferencesForInstrument(instrumentID uint, referenceType string) ([]models.VerificationReference, error) {
	var references []models.VerificationReference

	// First, get the instrument to know its type
	var instrument models.Instrument
	if err := s.db.First(&instrument, instrumentID).Error; err != nil {
		return nil, errors.New("instrument not found")
	}

	log.Printf("🔍 Getting references for instrument type: %s", instrument.Nama)

	// For balances, fetch all anak timbang references regardless of instrument_id
	if instrument.Nama == "Timbangan" || instrument.Nama == "Balance" {
		query := s.db.Where("reference_type = ?", "anak_timbang")

		// Option A: Get ALL active anak timbang references
		if err := query.Where("status = ?", "Active").Find(&references).Error; err != nil {
			return nil, err
		}

		log.Printf("✅ Found %d anak timbang references", len(references))
		return references, nil
	}

	// For other instrument types, use the old method
	query := s.db.Where("instrument_id = ?", instrumentID)
	if referenceType != "" {
		query = query.Where("reference_type = ?", referenceType)
	}

	if err := query.Where("status = ?", "Active").Find(&references).Error; err != nil {
		return nil, err
	}

	return references, nil
}

func (s *VerificationService) getAvailableReferences(instrumentID uint) map[string]interface{} {
	references := make(map[string]interface{})

	// Get instrument to know its type
	var instrument models.Instrument
	if err := s.db.First(&instrument, instrumentID).Error; err != nil {
		log.Printf("❌ Instrument not found: %v", err)
		return references
	}

	log.Printf("🔍 Getting available references for instrument type: %s", instrument.Nama)

	var allRefs []models.VerificationReference

	// For balances, get ALL anak timbang references
	if instrument.Nama == "Timbangan" || instrument.Nama == "Balance" {
		s.db.Where("reference_type = ? AND status = ?", "anak_timbang", "Active").
			Order("nominal_value ASC").
			Find(&allRefs)
	} else {
		// For other instruments, get references by instrument_id
		s.db.Where("instrument_id = ? AND status = ?", instrumentID, "Active").
			Find(&allRefs)
	}

	// Group by type
	grouped := make(map[string][]models.VerificationReference)
	for _, ref := range allRefs {
		grouped[ref.ReferenceType] = append(grouped[ref.ReferenceType], ref)
	}

	for refType, refs := range grouped {
		references[refType] = refs
		log.Printf("   - Type: %s, Count: %d", refType, len(refs))
	}

	return references
}

// ============================================
// INSTRUMENT VALUE READING
// ============================================

func (s *VerificationService) readInstrumentValue(instrument models.Instrument) (float64, error) {
	if instrument.InstrumentConfig == nil {
		return 0, errors.New("instrument configuration not found")
	}

	config := instrument.InstrumentConfig

	// Determine connection type by checking populated fields
	if config.ComPort != "" {
		// Serial connection - passes entire config
		return s.serialReader.ReadValue(config)
	} else if config.IPAddress != "" && config.TCPPort != 0 {
		// TCP connection - passes entire config
		return s.tcpReader.ReadValue(config)
	} else if config.IPAddress != "" {
		// Tibbo connection - passes entire config
		return s.tibboReader.ReadValue(config)
	}

	return 0, errors.New("no valid connection configuration found")
}

// ============================================
// VERIFICATION HISTORY & DETAILS
// ============================================

func (s *VerificationService) GetVerificationHistory(filter structs.VerificationHistoryRequest) (*structs.PaginatedResponse, error) {
	query := s.db.Model(&models.InstrumentVerification{}).
		Preload("Instrument").
		Preload("User").
		Preload("Template")

	if filter.InstrumentID != nil {
		query = query.Where("instrument_id = ?", *filter.InstrumentID)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.StartDate != nil {
		query = query.Where("verified_at >= ?", *filter.StartDate)
	}
	if filter.EndDate != nil {
		query = query.Where("verified_at <= ?", *filter.EndDate)
	}

	var total int64
	query.Count(&total)

	var verifications []models.InstrumentVerification
	offset := (filter.Page - 1) * filter.Limit
	if err := query.Offset(offset).Limit(filter.Limit).Order("verified_at DESC").Find(&verifications).Error; err != nil {
		return nil, err
	}

	return &structs.PaginatedResponse{
		Data:       verifications,
		Total:      int(total),
		Page:       filter.Page,
		Limit:      filter.Limit,
		TotalPages: (int(total) + filter.Limit - 1) / filter.Limit,
	}, nil
}

func (s *VerificationService) GetVerificationDetail(verificationID uint) (*models.InstrumentVerification, error) {
	var verification models.InstrumentVerification
	if err := s.db.Preload("Instrument").
		Preload("Template").
		Preload("User").
		Preload("Steps").
		Preload("Steps.Reference").
		First(&verification, verificationID).Error; err != nil {
		return nil, errors.New("verification not found")
	}

	// Debug: Check if step configs are loaded
	for _, step := range verification.Steps {
		log.Printf("Step %d: Name=%s, Description=%s, StepConfig present=%v",
			step.StepNumber,
			step.StepName,
			step.StepConfig.Description,
			step.StepConfig.StepName != "") // StepConfig should have data
	}

	return &verification, nil
}

func (s *VerificationService) GetInstrumentsForVerification(site string) ([]structs.VerificationListResponse, error) {
	var instruments []models.Instrument

	db := s.db.Model(&models.Instrument{})
	if site != "" {
		db = db.Where("lokasi_site = ?", site)
	}

	if err := db.Find(&instruments).Error; err != nil {
		return nil, err
	}

	response := make([]structs.VerificationListResponse, 0)
	now := time.Now()
	today := now.Truncate(24 * time.Hour)

	configSvc := NewVerificationConfigService() // reuse the config service

	for _, instrument := range instruments {
		// Get verification config (due date, interval, custom steps)
		cfg, _ := configSvc.GetOrCreateConfig(instrument.Id)

		// Last non-cancelled verification
		var lastVerification models.InstrumentVerification
		err := s.db.Where("instrument_id = ? AND status != ?", instrument.Id, "Cancelled").
			Order("verified_at DESC").
			First(&lastVerification).Error

		canVerifyToday := true
		var lastVerifiedAt *time.Time
		var lastVerifiedBy string
		var validUntil *time.Time

		if err == nil {
			lastVerifiedAt = &lastVerification.VerifiedAt
			validUntil = &lastVerification.ValidUntil

			var user models.User
			if err := s.db.First(&user, lastVerification.VerifiedBy).Error; err == nil {
				lastVerifiedBy = user.Name
			}

			verifiedToday := lastVerification.VerifiedAt.Truncate(24 * time.Hour).Equal(today)
			isFullyVerified := lastVerification.Status == "Complies"
			canVerifyToday = !(verifiedToday && isFullyVerified)
		}

		// Determine overdue status
		isOverdue := false
		if cfg != nil && cfg.DueDate != nil {
			// Overdue if due date is in the past AND not yet verified today (Complies)
			if cfg.DueDate.Before(now) && canVerifyToday {
				isOverdue = true

				// Auto-mark instrument as Unavailable if overdue
				if instrument.Status != "Unavailable" && instrument.Status != "In Used" {
					s.db.Model(&models.Instrument{}).
						Where("id = ?", instrument.Id).
						Update("status", "Unavailable")
					instrument.Status = "Unavailable"
				}
			}
		}

		var dueDate *time.Time
		var intervalDays int
		var customStepCount int
		if cfg != nil {
			dueDate = cfg.DueDate
			intervalDays = cfg.IntervalDays
			customStepCount = len(cfg.CustomSteps)
		}

		response = append(response, structs.VerificationListResponse{
			InstrumentID:    instrument.Id,
			InstrumentType:  instrument.Type,
			NoKontrol:       instrument.KodeInstrument,
			NamaInstrument:  instrument.Nama,
			LastVerifiedAt:  lastVerifiedAt,
			LastVerifiedBy:  lastVerifiedBy,
			ValidUntil:      validUntil,
			Status:          instrument.Status,
			CanVerifyToday:  canVerifyToday,
			DueDate:         dueDate,
			IntervalDays:    intervalDays,
			IsOverdue:       isOverdue,
			CustomStepCount: customStepCount,
		})
	}

	return response, nil
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

func countRequiredSteps(steps models.StepConfigArray) int {
	count := 0
	for _, step := range steps {
		if step.Required {
			count++
		}
	}
	return count
}

func contains(slice []int, item int) bool {
	for _, v := range slice {
		if v == item {
			return true
		}
	}
	return false
}

func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}

func calculateStatistics(values []float64) (avg float64, stdDev float64) {
	if len(values) == 0 {
		return 0, 0
	}

	sum := 0.0
	for _, v := range values {
		sum += v
	}
	avg = sum / float64(len(values))

	variance := 0.0
	for _, v := range values {
		diff := v - avg
		variance += diff * diff
	}
	variance /= float64(len(values))
	stdDev = sqrt(variance)

	return
}

func sqrt(x float64) float64 {
	if x == 0 {
		return 0
	}
	z := x
	for i := 0; i < 10; i++ {
		z = (z + x/z) / 2
	}
	return z
}

func (s *VerificationService) ProcessBridgeReading(
	verificationID uint,
	stepNumber int,
	value float64,
	rawData string,
) (*structs.ExecuteStepResponse, error) {

	// 1. Mark read request as fulfilled
	now := time.Now()
	if err := s.db.Model(&models.VerificationReadRequest{}).
		Where("verification_id = ? AND step_number = ? AND status = ?",
			verificationID, stepNumber, "pending").
		Updates(map[string]interface{}{
			"status":       "fulfilled",
			"fulfilled_at": now,
		}).Error; err != nil {
		log.Printf("⚠️  Failed to update read request: %v", err)
	}

	// 2. Fetch verification & step
	var verification models.InstrumentVerification
	if err := s.db.Preload("Instrument").
		Preload("Steps", "step_number = ?", stepNumber).
		First(&verification, verificationID).Error; err != nil {
		return nil, fmt.Errorf("verification not found: %v", err)
	}

	if len(verification.Steps) == 0 {
		return nil, fmt.Errorf("step %d not found", stepNumber)
	}

	step := &verification.Steps[0]

	// 3. Process the reading value
	// ✅ Jika ini batch multi-line (pH meter), raw_data contains full lines
	if step.StepConfig.Metadata["read_mode"] == "batch" &&
		step.StepConfig.Metadata["parse_format"] == "multi_line" {

		// For batch multi-line, raw_data is the full instrument output
		return s.processBatchBridgeReading(step, &verification, rawData)
	}

	// Single value reading
	req := structs.ExecuteStepRequest{
		VerificationID: verificationID,
		StepNumber:     stepNumber,
		InputData: map[string]interface{}{
			"bridge_value": value,
		},
	}

	return s.processAutoReadValue(step, &verification, req, "bridge", value)
}

// processBatchBridgeReading handles multi-line batch readings (e.g., pH meter)
// ✅ FIXED: Use step.StepNumber instead of undefined stepNumber variable
func (s *VerificationService) processBatchBridgeReading(
	step *models.VerificationStep,
	verification *models.InstrumentVerification,
	rawData string,
) (*structs.ExecuteStepResponse, error) {

	// Split raw data into lines
	lines := strings.Split(strings.TrimSpace(rawData), "\n")
	lines = deduplicatePrintout(lines)

	log.Printf("[BatchBridge] Processing %d lines of pH meter output", len(lines))

	// Extract pH values
	actualPHValues := extractActualPHValues(lines)
	if len(actualPHValues) == 0 {
		return nil, errors.New("no 'Actual pH' readings found in instrument output")
	}

	// Build buffer sequence & validate
	readStepsRaw, _ := step.StepConfig.Metadata["read_steps"].([]interface{})
	type BufferInfo struct {
		StepNum    int
		BufferType string
	}
	var bufferSeq []BufferInfo

	for _, rsRaw := range readStepsRaw {
		rsNum := 0
		switch v := rsRaw.(type) {
		case float64:
			rsNum = int(v)
		case int:
			rsNum = v
		}
		var priorStep models.VerificationStep
		if err := s.db.Where("verification_id = ? AND step_number = ?",
			verification.Id, rsNum).First(&priorStep).Error; err != nil {
			return nil, fmt.Errorf("prior step %d not found", rsNum)
		}
		bufferType, _ := priorStep.StepConfig.Metadata["buffer_type"].(string)
		bufferSeq = append(bufferSeq, BufferInfo{
			StepNum:    rsNum,
			BufferType: bufferType,
		})
	}

	// Validate each buffer
	rules := step.StepConfig.ValidationRules
	allComplies := true

	type BufferResult struct {
		BufferType  string  `json:"buffer_type"`
		ActualValue float64 `json:"actual_value"`
		Min         float64 `json:"min"`
		Max         float64 `json:"max"`
		Complies    bool    `json:"complies"`
	}
	var bufferResults []BufferResult
	var validationMsgs []string

	for i, buf := range bufferSeq {
		if i >= len(actualPHValues) {
			return nil, fmt.Errorf("expected %d readings but got %d", len(bufferSeq), len(actualPHValues))
		}

		val := actualPHValues[i]
		minKey := buf.BufferType + "_min"
		maxKey := buf.BufferType + "_max"
		minVal, _ := toFloat64(rules[minKey])
		maxVal, _ := toFloat64(rules[maxKey])

		complies := val >= minVal && val <= maxVal
		if !complies {
			allComplies = false
			validationMsgs = append(validationMsgs,
				fmt.Sprintf("%s: %.4f pH ✗ (range %.4f–%.4f)", buf.BufferType, val, minVal, maxVal))
		} else {
			validationMsgs = append(validationMsgs,
				fmt.Sprintf("%s: %.4f pH ✓ (range %.4f–%.4f)", buf.BufferType, val, minVal, maxVal))
		}

		bufferResults = append(bufferResults, BufferResult{
			BufferType:  buf.BufferType,
			ActualValue: val,
			Min:         minVal,
			Max:         maxVal,
			Complies:    complies,
		})
	}

	// Update step
	complianceType := "Complies"
	if !allComplies {
		complianceType = "Not Complies"
	}

	step.MeasuredValue = nil
	step.Status = complianceType
	step.ValidationMsg = strings.Join(validationMsgs, "; ")
	step.ReadingData = models.JSONB{
		"raw_text":       strings.Join(lines, "\n"),
		"raw_lines":      lines,
		"buffer_results": bufferResults,
		"timestamp":      time.Now(),
		"source":         "bridge",
		"status":         "done read",
	}
	step.ResultData = models.JSONB{
		"raw_text":       strings.Join(lines, "\n"),
		"buffer_results": bufferResults,
		"all_complies":   allComplies,
	}

	completedTime := time.Now()
	step.CompletedAt = &completedTime
	step.CalculateDuration()

	if err := s.db.Save(step).Error; err != nil {
		return nil, err
	}

	// Update dependent steps
	s.updateDependentSteps(verification.Id, step.StepNumber) // ✅ use step.StepNumber

	canContinue := allComplies || !step.StepConfig.Required
	needsOverride := !allComplies && step.StepConfig.Required

	// Check for auto-complete
	nextStepNum := s.getNextStepNumber(verification.Id, step.StepNumber) // ✅ use step.StepNumber
	verificationCompleted := false
	if nextStepNum == nil {
		var v models.InstrumentVerification
		if dbErr := s.db.Preload("Steps").First(&v, verification.Id).Error; dbErr == nil {
			if v.Status == "In Progress" {
				allDone := true
				for _, vs := range v.Steps {
					if vs.StepConfig.Required && !vs.IsCompleted() {
						allDone = false
						break
					}
				}
				if allDone {
					overallComplies := true
					for _, vs := range v.Steps {
						if vs.IsFailed() || vs.Status == "Not Complies" {
							overallComplies = false
							break
						}
					}
					if overallComplies {
						v.Status = "Complies"
					} else {
						v.Status = "Not Complies"
					}
					s.db.Save(&v)
					verificationCompleted = true
				}
			}
		}
	}

	return &structs.ExecuteStepResponse{
		Success:               true,
		StepNumber:            step.StepNumber,
		StepName:              step.StepName,
		StepType:              step.StepType,
		Status:                complianceType,
		MeasuredValue:         nil,
		ValidationMsg:         step.ValidationMsg,
		CanContinue:           canContinue,
		NeedsOverride:         needsOverride,
		NextStepNumber:        nextStepNum,
		VerificationCompleted: verificationCompleted,
		ResultData: map[string]interface{}{
			"buffer_results": bufferResults,
			"all_complies":   allComplies,
		},
		Message: fmt.Sprintf("pH Meter reading captured (%d lines) via bridge", len(lines)),
		Unit:    step.StepConfig.Unit,
	}, nil
}
