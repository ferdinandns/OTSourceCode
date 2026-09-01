package controllers

import (
	"fmt"
	"lab-connect/backend-api/database"
	"lab-connect/backend-api/helpers"
	"lab-connect/backend-api/models"
	"lab-connect/backend-api/structs"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode"

	"github.com/gin-gonic/gin"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

// generateUsername derives "first.last" from a full name.
func generateUsername(fullName string) string {
	// 1. Strip diacritics via NFD normalisation + remove non-spacing marks
	t := transform.Chain(norm.NFD, transform.RemoveFunc(func(r rune) bool {
		return unicode.Is(unicode.Mn, r) // Mn = non-spacing mark
	}), norm.NFC)
	cleaned, _, _ := transform.String(t, fullName)

	// 2. Keep only letters, spaces, and dots; discard everything else
	re := regexp.MustCompile(`[^a-zA-Z. ]+`)
	cleaned = re.ReplaceAllString(cleaned, "")

	// Replace dots with spaces so we can split uniformly
	cleaned = strings.ReplaceAll(cleaned, ".", " ")

	// 3. Split into words, drop empty tokens
	words := []string{}
	for _, w := range strings.Fields(cleaned) {
		if w != "" {
			words = append(words, w)
		}
	}

	if len(words) == 0 {
		return "user"
	}
	if len(words) == 1 {
		return strings.ToLower(words[0])
	}

	first := strings.ToLower(words[0])
	last := strings.ToLower(words[len(words)-1])
	return first + "." + last
}

// ensureUniqueUsername appends a numeric suffix if the base username is taken.
// e.g. "budi.santoso" → "budi.santoso2" → "budi.santoso3" …
func ensureUniqueUsername(base string) string {
	candidate := base
	for i := 2; i <= 999; i++ {
		var count int64
		database.DB.Model(&models.User{}).Where("username = ?", candidate).Count(&count)
		if count == 0 {
			return candidate
		}
		candidate = base + strings.TrimLeft(string(rune('0'+i)), "")
		// simpler: use fmt
		candidate = base + fmt.Sprintf("%d", i)
	}
	return base
}

func Register(c *gin.Context) {
	var req structs.RegisterRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusUnprocessableEntity, structs.ErrorResponse{
			Success: false,
			Message: "Validasi Errors",
			Errors:  helpers.TranslateErrorMessage(err),
		})
		return
	}

	// Auto-generate username from full name if not provided
	if strings.TrimSpace(req.Username) == "" {
		req.Username = ensureUniqueUsername(generateUsername(req.Name))
	}

	// Validate lokasi utama
	var lokasiUtama models.Lokasi
	if err := database.DB.First(&lokasiUtama, req.LokasiUtamaId).Error; err != nil {
		c.JSON(http.StatusBadRequest, structs.ErrorResponse{
			Success: false,
			Message: "Lokasi utama tidak ditemukan",
			Errors:  map[string]string{"LokasiUtamaId": "Lokasi utama tidak valid"},
		})
		return
	}

	// New users start as "pending" — supervisor must activate them
	now := time.Now()
	user := models.User{
		Name:              req.Name,
		Username:          req.Username,
		Email:             req.Email,
		Password:          helpers.HashPassword(req.Password),
		Role:              "user",            // lowercase — must match ValidRoles & RoleToGroup
		UserGroup:         structs.GroupUser, // = 5; avoids zero-value causing middleware mismatches
		Status:            "pending",
		LokasiUtamaId:     &req.LokasiUtamaId,
		PasswordChangedAt: &now, // seeds the 90-day expiry clock from registration
	}

	tx := database.DB.Begin()

	if err := tx.Create(&user).Error; err != nil {
		tx.Rollback()
		if helpers.IsDuplicateEntryError(err) {
			c.JSON(http.StatusConflict, structs.ErrorResponse{
				Success: false,
				Message: "Duplicate entry error",
				Errors:  helpers.TranslateErrorMessage(err),
			})
		} else {
			c.JSON(http.StatusInternalServerError, structs.ErrorResponse{
				Success: false,
				Message: "Failed to create user",
				Errors:  helpers.TranslateErrorMessage(err),
			})
		}
		return
	}

	if len(req.LokasiTambahanIds) > 0 {
		for _, lokasiId := range req.LokasiTambahanIds {
			var lokasi models.Lokasi
			if err := tx.First(&lokasi, lokasiId).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusBadRequest, structs.ErrorResponse{
					Success: false,
					Message: "Lokasi tambahan tidak valid",
					Errors:  map[string]string{"LokasiTambahanIds": "Salah satu lokasi tidak ditemukan"},
				})
				return
			}
			userLokasi := models.UserLokasi{UserId: user.Id, LokasiId: lokasiId}
			if err := tx.Create(&userLokasi).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, structs.ErrorResponse{
					Success: false,
					Message: "Failed to assign lokasi tambahan",
					Errors:  map[string]string{"LokasiTambahan": "Gagal menyimpan lokasi tambahan"},
				})
				return
			}
		}
	}

	tx.Commit()

	database.DB.Preload("LokasiUtama").Preload("LokasiTambahan.Lokasi").First(&user, user.Id)

	lokasiUtamaRes := structs.LokasiResponse{
		Id:   user.LokasiUtama.Id,
		Nama: user.LokasiUtama.Nama,
		Kode: user.LokasiUtama.Kode,
	}

	lokasiTambahanRes := []structs.LokasiResponse{}
	for _, ul := range user.LokasiTambahan {
		lokasiTambahanRes = append(lokasiTambahanRes, structs.LokasiResponse{
			Id:   ul.Lokasi.Id,
			Nama: ul.Lokasi.Nama,
			Kode: ul.Lokasi.Kode,
		})
	}

	c.JSON(http.StatusCreated, structs.SuccessResponse{
		Success: true,
		Message: "Registration successful. Your account is pending approval by a supervisor.",
		Data: structs.UserResponse{
			Id:             user.Id,
			Name:           user.Name,
			Username:       user.Username,
			Email:          user.Email,
			Status:         user.Status,
			LokasiUtama:    &lokasiUtamaRes,
			LokasiTambahan: lokasiTambahanRes,
			CreatedAt:      user.CreatedAt.Format("2006-01-02 15:04:05"),
			UpdatedAt:      user.UpdatedAt.Format("2006-01-02 15:04:05"),
		},
	})
}
