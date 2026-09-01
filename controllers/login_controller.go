package controllers

import (
	"lab-connect/backend-api/config"
	"lab-connect/backend-api/database"
	"lab-connect/backend-api/models"
	"lab-connect/backend-api/structs"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var jwtKey = []byte(config.GetEnv("JWT_SECRET", "secret_key"))

func Login(c *gin.Context) {
	var req structs.UserLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find user
	var user models.User
	if err := database.DB.Preload("LokasiUtama").
		Where("username = ?", req.Username).
		First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Username or Password is incorrect"})
		return
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Username or Password is incorrect"})
		return
	}

	// After verifying credentials, before issuing token:

	// 1. Status check
	if user.Status == "pending" {
		c.JSON(http.StatusForbidden, structs.ErrorResponse{
			Success: false,
			Message: "Your account is pending approval. Please contact your supervisor.",
		})
		return
	}
	if user.Status == "deactive" {
		c.JSON(http.StatusForbidden, structs.ErrorResponse{
			Success: false,
			Message: "Your account has been deactivated. Please contact an administrator.",
		})
		return
	}

	// 2. Password expiry check (90 days)
	// Also treat NULL password_changed_at as expired (e.g. legacy / self-registered users
	// whose clock was never seeded).
	mustChangePassword := user.MustChangePassword
	if !mustChangePassword {
		if user.PasswordChangedAt == nil {
			mustChangePassword = true
			database.DB.Model(&user).Update("must_change_password", true)
		} else {
			expiry := user.PasswordChangedAt.AddDate(0, 3, 0)
			if time.Now().After(expiry) {
				mustChangePassword = true
				database.DB.Model(&user).Update("must_change_password", true)
			}
		}
	}

	// Set lokasi aktif
	if req.LokasiId != nil {
		lokasiID := *req.LokasiId
		isAllowed := false

		// Check lokasi utama
		if user.LokasiUtamaId != nil && *user.LokasiUtamaId == lokasiID {
			isAllowed = true
		}

		// Check lokasi tambahan
		if !isAllowed {
			var count int64
			database.DB.Model(&models.UserLokasi{}).
				Where("user_id = ? AND lokasi_id = ?", user.Id, lokasiID).
				Count(&count)
			isAllowed = count > 0
		}

		if !isAllowed {
			c.JSON(http.StatusForbidden, structs.ErrorResponse{
				Success: false,
				Message: "You don't have access to the specified site",
				Errors:  map[string]string{"lokasi_id": "This site is not associated with your account"},
			})
			return
		}

		user.LokasiAktifId = &lokasiID
	} else if user.LokasiUtamaId != nil {
		// Default ke lokasi utama
		user.LokasiAktifId = user.LokasiUtamaId
	}

	// Update lokasi aktif di database
	database.DB.Model(&user).Update("lokasi_aktif_id", user.LokasiAktifId)
	// Generate JWT token
	expirationTime := time.Now().Add(480 * time.Minute) // token valid for 15 minutes
	claims := &jwt.RegisteredClaims{
		Subject:   user.Username,
		ExpiresAt: jwt.NewNumericDate(expirationTime),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(jwtKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	// Prepare response
	var lokasiAktif *structs.LokasiResponse
	if user.LokasiAktifId != nil {
		var lokasi models.Lokasi
		if err := database.DB.First(&lokasi, *user.LokasiAktifId).Error; err == nil {
			lokasiAktif = &structs.LokasiResponse{
				Id:   lokasi.Id,
				Nama: lokasi.Nama,
				Kode: lokasi.Kode,
			}
		}
	}

	response := structs.UserResponse{
		Id:                 user.Id,
		Name:               user.Name,
		Username:           user.Username,
		Email:              user.Email,
		Role:               user.Role,      // ← add this
		UserGroup:          user.UserGroup, // ← add this
		LokasiAktif:        lokasiAktif,
		MustChangePassword: mustChangePassword,
		Token:              &tokenString,
	}

	c.JSON(http.StatusOK, structs.SuccessResponse{
		Success: true,
		Status:  "success",
		Message: "Login successful",
		Data:    response,
	})
}
