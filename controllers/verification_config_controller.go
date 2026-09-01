package controllers

import (
	"lab-connect/backend-api/middlewares"
	"lab-connect/backend-api/services"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
)

type VerificationConfigController struct {
	service  *services.VerificationConfigService
	validate *validator.Validate
}

func NewVerificationConfigController(service *services.VerificationConfigService) *VerificationConfigController {
	return &VerificationConfigController{
		service:  service,
		validate: validator.New(),
	}
}

// GetInstrumentVerificationConfig
// GET /api/instruments/:id/verification-config
func (c *VerificationConfigController) GetConfig(ctx *gin.Context) {
	instrumentID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid instrument ID", err)
		return
	}

	config, err := c.service.GetOrCreateConfig(instrumentID)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to get verification config", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Config retrieved", config)
}

// UpdateInstrumentVerificationConfig
// PUT /api/instruments/:id/verification-config
func (c *VerificationConfigController) UpdateConfig(ctx *gin.Context) {
	userID, _ := middlewares.GetUserID(ctx)
	instrumentID, err := parseUintParam(ctx, "id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid instrument ID", err)
		return
	}

	var req struct {
		IntervalDays int `json:"interval_days"`
		CustomSteps  []struct {
			ID          string `json:"id"`
			Description string `json:"description"`
			Order       int    `json:"order"`
		} `json:"custom_steps"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	config, err := c.service.UpdateConfig(instrumentID, req.IntervalDays, req.CustomSteps, userID)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to update verification config", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, "Config updated successfully", config)
}
