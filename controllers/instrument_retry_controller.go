package controllers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// RetryItem — stop the running goroutine, re-read one item, resume.
// POST /api/instruments/usage/:usage_id/retry-item
// Body: { "item_number": 3 }
func (c *InstrumentController) RetryItem(ctx *gin.Context) {
	usageID, err := parseUintParam(ctx, "usage_id")
	if err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid usage ID", err)
		return
	}

	var req struct {
		ItemNumber int `json:"item_number" binding:"required,min=1"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		respondWithError(ctx, http.StatusBadRequest, "Invalid request body — item_number is required", err)
		return
	}

	result, err := c.readerService.RetryItem(usageID, req.ItemNumber)
	if err != nil {
		respondWithError(ctx, http.StatusInternalServerError, "Failed to retry item", err)
		return
	}

	respondWithSuccess(ctx, http.StatusOK, result.Message, result)
}
