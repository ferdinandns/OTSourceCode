package controllers

import (
	"crypto/rand"
	"encoding/hex"
	"lab-connect/backend-api/database"
	"lab-connect/backend-api/helpers"
	"lab-connect/backend-api/models"
	"lab-connect/backend-api/structs"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// ForgotPassword — POST /api/forgot-password
// User submits their username. Backend generates a reset token valid for 1 hour
// and returns it directly (no email — the token is shown on the page for the user to copy,
// or an admin can share it via another channel).
func ForgotPassword(c *gin.Context) {
	var req structs.ForgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, structs.ErrorResponse{
			Success: false,
			Message: "Validation error",
			Errors:  helpers.TranslateErrorMessage(err),
		})
		return
	}

	var user models.User
	if err := database.DB.Where("username = ?", req.Username).First(&user).Error; err != nil {
		// Return a generic message so we don't leak which usernames exist
		c.JSON(http.StatusOK, structs.SuccessResponse{
			Success: true,
			Message: "If the username exists, a reset token has been generated. Please contact your supervisor to obtain the token.",
		})
		return
	}

	// Generate a secure random hex token
	tokenBytes := make([]byte, 16)
	if _, err := rand.Read(tokenBytes); err != nil {
		c.JSON(http.StatusInternalServerError, structs.ErrorResponse{
			Success: false,
			Message: "Failed to generate reset token",
		})
		return
	}
	tokenStr := hex.EncodeToString(tokenBytes)
	expiry := time.Now().Add(1 * time.Hour)

	if err := database.DB.Model(&user).Updates(map[string]interface{}{
		"password_reset_token":        tokenStr,
		"password_reset_token_expiry": expiry,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, structs.ErrorResponse{
			Success: false,
			Message: "Failed to store reset token",
		})
		return
	}

	// Return the token directly so the page can display it.
	// In production you could remove the token from this response and
	// have a supervisor-only endpoint retrieve it instead.
	c.JSON(http.StatusOK, structs.SuccessResponse{
		Success: true,
		Message: "Reset token generated. Use it on the reset password page within 1 hour.",
		Data: gin.H{
			"token":      tokenStr,
			"expires_at": expiry.Format("2006-01-02 15:04:05"),
		},
	})
}

// ResetPassword — POST /api/reset-password
// User submits the token + new password.
func ResetPassword(c *gin.Context) {
	var req structs.ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, structs.ErrorResponse{
			Success: false,
			Message: "Validation error",
			Errors:  helpers.TranslateErrorMessage(err),
		})
		return
	}

	var user models.User
	if err := database.DB.
		Where("password_reset_token = ? AND password_reset_token_expiry > ?", req.Token, time.Now()).
		First(&user).Error; err != nil {
		c.JSON(http.StatusBadRequest, structs.ErrorResponse{
			Success: false,
			Message: "Invalid or expired reset token.",
		})
		return
	}

	now := time.Now()
	if err := database.DB.Model(&user).Updates(map[string]interface{}{
		"password":                    helpers.HashPassword(req.NewPassword),
		"password_changed_at":         now,
		"must_change_password":        false,
		"password_reset_token":        nil,
		"password_reset_token_expiry": nil,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, structs.ErrorResponse{
			Success: false,
			Message: "Failed to update password",
		})
		return
	}

	c.JSON(http.StatusOK, structs.SuccessResponse{
		Success: true,
		Message: "Password reset successfully. You can now log in with your new password.",
	})
}
