package controllers

import (
	"lab-connect/backend-api/database"
	"lab-connect/backend-api/helpers"
	"lab-connect/backend-api/models"
	"lab-connect/backend-api/structs"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// getAuthUsername reads the username stored in the Gin context by AuthMiddleware().
// The JWT stores username in the Subject claim (see helpers/jwt.go), so the
// middleware should do: c.Set("username", claims.Subject)
func getAuthUsername(c *gin.Context) (string, bool) {
	v, exists := c.Get("username")
	if !exists {
		return "", false
	}
	username, ok := v.(string)
	return username, ok
}

// GetProfile returns the currently authenticated user's own profile.
// Route: GET /api/profile   Auth: AllAuthenticated()
func GetProfile(c *gin.Context) {
	username, ok := getAuthUsername(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, structs.ErrorResponse{
			Success: false,
			Message: "Unauthorized",
		})
		return
	}

	var user models.User
	if err := database.DB.
		Preload("LokasiUtama").
		Preload("LokasiAktif").
		Where("username = ?", username).
		First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, structs.ErrorResponse{
			Success: false,
			Message: "User not found",
			Errors:  helpers.TranslateErrorMessage(err),
		})
		return
	}

	c.JSON(http.StatusOK, structs.SuccessResponse{
		Success: true,
		Message: "Profile loaded",
		Data: structs.UserResponse{
			Id:            user.Id,
			Name:          user.Name,
			Username:      user.Username,
			Email:         user.Email,
			UserGroup:     user.UserGroup,
			Role:          user.Role,
			LokasiUtamaId: user.LokasiUtamaId,
			LokasiAktifId: user.LokasiAktifId,
			CreatedAt:     user.CreatedAt.Format("2006-01-02 15:04:05"),
			UpdatedAt:     user.UpdatedAt.Format("2006-01-02 15:04:05"),
		},
	})
}

// UpdateProfile lets any authenticated user change their own username and/or password.
// Name, email, role, lokasi — all require superadmin/manager via the admin routes.
// Route: PUT /api/profile   Auth: AllAuthenticated()
func UpdateProfile(c *gin.Context) {
	username, ok := getAuthUsername(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, structs.ErrorResponse{
			Success: false,
			Message: "Unauthorized",
		})
		return
	}

	var user models.User
	if err := database.DB.Where("username = ?", username).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, structs.ErrorResponse{
			Success: false,
			Message: "User not found",
		})
		return
	}

	var req structs.ProfileUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusUnprocessableEntity, structs.ErrorResponse{
			Success: false,
			Message: "Validation errors",
			Errors:  helpers.TranslateErrorMessage(err),
		})
		return
	}

	// Always verify current password before applying any change
	if !helpers.CheckPassword(req.CurrentPassword, user.Password) {
		c.JSON(http.StatusUnprocessableEntity, structs.ErrorResponse{
			Success: false,
			Message: "Validation errors",
			Errors:  map[string]string{"CurrentPassword": "Current password is incorrect"},
		})
		return
	}

	if req.Username != "" {
		user.Username = req.Username
	}

	if req.NewPassword != nil && *req.NewPassword != "" {
		now := time.Now()
		user.Password = helpers.HashPassword(*req.NewPassword)
		user.PasswordChangedAt = &now
		user.MustChangePassword = false
	}

	if err := database.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, structs.ErrorResponse{
			Success: false,
			Message: "Failed to update profile",
			Errors:  helpers.TranslateErrorMessage(err),
		})
		return
	}

	c.JSON(http.StatusOK, structs.SuccessResponse{
		Success: true,
		Message: "Profile updated successfully",
		Data: structs.UserResponse{
			Id:        user.Id,
			Name:      user.Name,
			Username:  user.Username,
			Email:     user.Email,
			UserGroup: user.UserGroup,
			Role:      user.Role,
			CreatedAt: user.CreatedAt.Format("2006-01-02 15:04:05"),
			UpdatedAt: user.UpdatedAt.Format("2006-01-02 15:04:05"),
		},
	})
}
