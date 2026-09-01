package controllers

import (
	"fmt"
	"lab-connect/backend-api/database"
	"lab-connect/backend-api/helpers"
	"lab-connect/backend-api/models"
	"lab-connect/backend-api/structs"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// PasswordExpiryDays is how many days before a password is considered expired.
const PasswordExpiryDays = 90

// isPasswordExpired returns true when the password is older than PasswordExpiryDays
// or has never been set (nil).
func isPasswordExpired(changedAt *time.Time) bool {
	if changedAt == nil {
		return true
	}
	return time.Since(*changedAt) > time.Duration(PasswordExpiryDays)*24*time.Hour
}

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

func FindUsers(c *gin.Context) {
	var users []models.User
	database.DB.Find(&users)

	c.JSON(http.StatusOK, structs.SuccessResponse{
		Success: true,
		Message: "Lists Data Users",
		Data:    users,
	})
}

func CreateUser(c *gin.Context) {
	var req structs.UserCreateRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusUnprocessableEntity, structs.ErrorResponse{
			Success: false,
			Message: "Validation Errors",
			Errors:  helpers.TranslateErrorMessage(err),
		})
		return
	}

	// Validate role
	if err := helpers.ValidateRole(req.Role); err != nil {
		c.JSON(http.StatusUnprocessableEntity, structs.ErrorResponse{
			Success: false,
			Message: "Validation Errors",
			Errors:  map[string]string{"Role": err.Error()},
		})
		return
	}

	// Auto-generate username from full name if not provided
	if strings.TrimSpace(req.Username) == "" {
		req.Username = ensureUniqueUsername(generateUsername(req.Name))
	}

	userGroup := structs.RoleToGroup[req.Role]
	now := time.Now()

	user := models.User{
		Name:               req.Name,
		Username:           req.Username,
		Email:              req.Email,
		Password:           helpers.HashPassword(req.Password),
		Role:               req.Role,
		UserGroup:          userGroup,
		Status:             "active", // admin-created users are active by default
		LokasiUtamaId:      &req.LokasiUtamaId,
		PasswordChangedAt:  &now, // starts the 90-day clock
		MustChangePassword: true, // admin-set password must be changed on first login
	}

	if err := database.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, structs.ErrorResponse{
			Success: false,
			Message: "Failed to create user",
			Errors:  helpers.TranslateErrorMessage(err),
		})
		return
	}

	for _, lokasiId := range req.LokasiTambahanIds {
		database.DB.Create(&models.UserLokasi{UserId: user.Id, LokasiId: lokasiId})
	}

	c.JSON(http.StatusCreated, structs.SuccessResponse{
		Success: true,
		Message: "User created successfully",
		Data: structs.UserResponse{
			Id:        user.Id,
			Name:      user.Name,
			Username:  user.Username,
			Email:     user.Email,
			UserGroup: user.UserGroup,
			Role:      user.Role,
			Status:    user.Status,
			CreatedAt: user.CreatedAt.Format("2006-01-02 15:04:05"),
			UpdatedAt: user.UpdatedAt.Format("2006-01-02 15:04:05"),
		},
	})
}

func FindUserById(c *gin.Context) {
	id := c.Param("id")

	var user models.User
	if err := database.DB.
		Preload("LokasiUtama").
		Preload("LokasiAktif").
		Preload("LokasiTambahan.Lokasi").
		First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, structs.ErrorResponse{
			Success: false,
			Message: "User not found",
			Errors:  helpers.TranslateErrorMessage(err),
		})
		return
	}

	lokasiTambahan := []structs.LokasiResponse{}
	for _, ul := range user.LokasiTambahan {
		lokasiTambahan = append(lokasiTambahan, structs.LokasiResponse{
			Id:   ul.Lokasi.Id,
			Nama: ul.Lokasi.Nama,
			Kode: ul.Lokasi.Kode,
		})
	}

	response := structs.UserResponse{
		Id:                 user.Id,
		Name:               user.Name,
		Username:           user.Username,
		Email:              user.Email,
		UserGroup:          user.UserGroup,
		Role:               user.Role,
		Status:             user.Status,
		MustChangePassword: user.MustChangePassword,
		LokasiUtamaId:      user.LokasiUtamaId,
		LokasiAktifId:      user.LokasiAktifId,
		CreatedAt:          user.CreatedAt.Format("2006-01-02 15:04:05"),
		UpdatedAt:          user.UpdatedAt.Format("2006-01-02 15:04:05"),
		LokasiTambahan:     lokasiTambahan,
	}

	if user.LokasiUtama != nil {
		response.LokasiUtama = &structs.LokasiResponse{
			Id:   user.LokasiUtama.Id,
			Nama: user.LokasiUtama.Nama,
			Kode: user.LokasiUtama.Kode,
		}
	}
	if user.LokasiAktif != nil {
		response.LokasiAktif = &structs.LokasiResponse{
			Id:   user.LokasiAktif.Id,
			Nama: user.LokasiAktif.Nama,
			Kode: user.LokasiAktif.Kode,
		}
	}

	c.JSON(http.StatusOK, structs.SuccessResponse{
		Success: true,
		Message: "User Found",
		Data:    response,
	})
}

func UpdateUser(c *gin.Context) {
	id := c.Param("id")

	var user models.User
	if err := database.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, structs.ErrorResponse{
			Success: false,
			Message: "User not found",
		})
		return
	}

	var req structs.UserUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusUnprocessableEntity, structs.ErrorResponse{
			Success: false,
			Message: "Validation errors",
			Errors:  helpers.TranslateErrorMessage(err),
		})
		return
	}

	if err := helpers.ValidateRole(req.Role); err != nil {
		c.JSON(http.StatusUnprocessableEntity, structs.ErrorResponse{
			Success: false,
			Message: "Validation Errors",
			Errors:  map[string]string{"Role": err.Error()},
		})
		return
	}

	tx := database.DB.Begin()

	user.Name = req.Name
	user.Username = req.Username
	user.Email = req.Email
	user.Role = req.Role
	user.UserGroup = structs.RoleToGroup[req.Role]

	if req.Status == "active" || req.Status == "pending" || req.Status == "deactive" {
		user.Status = req.Status
	}

	if req.Password != nil && *req.Password != "" {
		now := time.Now()
		user.Password = helpers.HashPassword(*req.Password)
		user.PasswordChangedAt = &now
		user.MustChangePassword = false
	}

	user.LokasiUtamaId = req.LokasiUtamaId
	user.LokasiAktifId = req.LokasiAktifId

	if err := tx.Save(&user).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, structs.ErrorResponse{
			Success: false,
			Message: "Failed to update user",
		})
		return
	}

	if err := tx.Where("user_id = ?", user.Id).Delete(&models.UserLokasi{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, structs.ErrorResponse{
			Success: false,
			Message: "Failed to update user locations",
		})
		return
	}

	for _, lokasiId := range req.LokasiTambahanIds {
		if err := tx.Create(&models.UserLokasi{UserId: user.Id, LokasiId: lokasiId}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, structs.ErrorResponse{
				Success: false,
				Message: "Failed to add user locations",
			})
			return
		}
	}

	tx.Commit()

	c.JSON(http.StatusOK, structs.SuccessResponse{
		Success: true,
		Message: "User updated successfully",
		Data: structs.UserResponse{
			Id:            user.Id,
			Name:          user.Name,
			Username:      user.Username,
			Email:         user.Email,
			UserGroup:     user.UserGroup,
			Role:          user.Role,
			Status:        user.Status,
			LokasiUtamaId: user.LokasiUtamaId,
			LokasiAktifId: user.LokasiAktifId,
			CreatedAt:     user.CreatedAt.Format("2006-01-02 15:04:05"),
			UpdatedAt:     user.UpdatedAt.Format("2006-01-02 15:04:05"),
		},
	})
}

// UpdateUserStatus — PATCH /users/:id/status
func UpdateUserStatus(c *gin.Context) {
	id := c.Param("id")

	var user models.User
	if err := database.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, structs.ErrorResponse{
			Success: false,
			Message: "User not found",
		})
		return
	}

	var req structs.UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusUnprocessableEntity, structs.ErrorResponse{
			Success: false,
			Message: "Validation errors",
			Errors:  helpers.TranslateErrorMessage(err),
		})
		return
	}

	if err := database.DB.Model(&user).Update("status", req.Status).Error; err != nil {
		c.JSON(http.StatusInternalServerError, structs.ErrorResponse{
			Success: false,
			Message: "Failed to update status",
		})
		return
	}

	c.JSON(http.StatusOK, structs.SuccessResponse{
		Success: true,
		Message: fmt.Sprintf("User status updated to '%s'", req.Status),
		Data: structs.UserResponse{
			Id:       user.Id,
			Name:     user.Name,
			Username: user.Username,
			Status:   req.Status,
		},
	})
}

func DeleteUser(c *gin.Context) {
	id := c.Param("id")

	var user models.User
	if err := database.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, structs.ErrorResponse{
			Success: false,
			Message: "User not found",
			Errors:  map[string]string{"User": "User tidak ditemukan"},
		})
		return
	}

	tx := database.DB.Begin()

	if err := tx.Where("user_id = ?", user.Id).Delete(&models.UserLokasi{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, structs.ErrorResponse{
			Success: false,
			Message: "Failed to delete user locations",
			Errors:  helpers.TranslateErrorMessage(err),
		})
		return
	}

	if err := tx.Delete(&user).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, structs.ErrorResponse{
			Success: false,
			Message: "Failed to delete user",
			Errors:  helpers.TranslateErrorMessage(err),
		})
		return
	}

	tx.Commit()

	c.JSON(http.StatusOK, structs.SuccessResponse{
		Success: true,
		Message: "User deleted successfully",
		Data:    nil,
	})
}

func GetSupervisorsByLocation(c *gin.Context) {
	location := c.Query("location")

	var users []models.User
	query := database.DB.Where("user_group = ?", 3)
	if location != "" {
		query = query.Where("lokasi_utama_id = ? OR lokasi_aktif_id = ?", location, location)
	}

	if err := query.Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, structs.ErrorResponse{
			Success: false,
			Message: "Failed to fetch supervisors",
			Errors:  helpers.TranslateErrorMessage(err),
		})
		return
	}

	var supervisors []structs.UserResponse
	for _, user := range users {
		supervisors = append(supervisors, structs.UserResponse{
			Id:        user.Id,
			Name:      user.Name,
			Username:  user.Username,
			Email:     user.Email,
			UserGroup: user.UserGroup,
			Role:      user.Role,
		})
	}

	c.JSON(http.StatusOK, structs.SuccessResponse{
		Success: true,
		Message: "Supervisors list",
		Data:    supervisors,
	})
}
