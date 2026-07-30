package handlers

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"sample-qc-backend/utils"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	DB *sql.DB
}

func NewAuthHandler(db *sql.DB) *AuthHandler {
	return &AuthHandler{DB: db}
}

type LoginRequest struct {
	Identifier string `json:"identifier" binding:"required"`
	Password   string `json:"password" binding:"required"`
}
type LoginResponse struct {
	ID           int    `json:"id"`
	Name         string `json:"name"`
	Email        string `json:"email"`
	Division     string `json:"division"`
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}
type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Identifier dan password wajib diisi"})
		return
	}
	var user LoginResponse
	var hashedPassword string
	err := h.DB.QueryRow(`
		SELECT id, name, email, division, password
		FROM users
		WHERE LOWER(name) = LOWER($1) OR LOWER(email) = LOWER($1)
		LIMIT 1
	`, req.Identifier).Scan(&user.ID, &user.Name, &user.Email, &user.Division, &hashedPassword)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Nama/Email atau Password salah"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Terjadi kesalahan server"})
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Nama/Email atau Password salah"})
		return
	}
	accessToken, err := utils.GenerateAccessToken(user.ID, user.Name, user.Division)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat access token"})
		return
	}
	refreshToken, err := utils.GenerateRefreshToken(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat refresh token"})
		return
	}
	refreshExpiry := time.Now().Add(utils.RefreshTokenDuration)
	_, err = h.DB.Exec(`
		UPDATE users
		SET refresh_token        = $1,
		    refresh_token_expiry = $2,
		    last_activity        = NOW()
		WHERE id = $3
	`, refreshToken, refreshExpiry, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan sesi"})
		return
	}
	user.AccessToken = accessToken
	user.RefreshToken = refreshToken
	c.JSON(http.StatusOK, user)
}

func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Refresh token wajib diisi"})
		return
	}
	claims, err := utils.ParseRefreshToken(req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Refresh token tidak valid atau sudah expired",
			"code":  "REFRESH_EXPIRED",
		})
		return
	}
	var storedToken sql.NullString
	var refreshExpiry sql.NullTime
	var lastActivity sql.NullTime
	var name, division string
	err = h.DB.QueryRow(`
		SELECT name, division, refresh_token, refresh_token_expiry, last_activity
		FROM users
		WHERE id = $1
	`, claims.UserID).Scan(&name, &division, &storedToken, &refreshExpiry, &lastActivity)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Terjadi kesalahan server"})
		return
	}
	if !storedToken.Valid || storedToken.String != req.RefreshToken {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Refresh token tidak dikenali",
			"code":  "REFRESH_INVALID",
		})
		return
	}
	if refreshExpiry.Valid && time.Now().After(refreshExpiry.Time) {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Sesi telah berakhir, silakan login kembali",
			"code":  "REFRESH_EXPIRED",
		})
		return
	}
	if lastActivity.Valid && time.Since(lastActivity.Time) > 24*time.Hour {
		_, _ = h.DB.Exec(
			`UPDATE users SET refresh_token = NULL, refresh_token_expiry = NULL WHERE id = $1`,
			claims.UserID,
		)
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Sesi habis karena tidak aktif selama 24 jam",
			"code":  "IDLE_TIMEOUT",
		})
		return
	}
	newAccessToken, err := utils.GenerateAccessToken(claims.UserID, name, division)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat access token baru"})
		return
	}
	newRefreshToken, err := utils.GenerateRefreshToken(claims.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat refresh token baru"})
		return
	}
	newRefreshExpiry := time.Now().Add(utils.RefreshTokenDuration)
	_, err = h.DB.Exec(`
		UPDATE users
		SET refresh_token        = $1,
		    refresh_token_expiry = $2,
		    last_activity        = NOW()
		WHERE id = $3
	`, newRefreshToken, newRefreshExpiry, claims.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui sesi"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"access_token":  newAccessToken,
		"refresh_token": newRefreshToken,
	})
}
func (h *AuthHandler) Logout(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Tidak terautentikasi"})
		return
	}
	_, err := h.DB.Exec(`
		UPDATE users
		SET refresh_token        = NULL,
		    refresh_token_expiry = NULL,
		    last_activity        = NULL
		WHERE id = $1
	`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal logout"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Logout berhasil"})
}
func extractBearerToken(authHeader string) string {
	if strings.HasPrefix(authHeader, "Bearer ") {
		return strings.TrimPrefix(authHeader, "Bearer ")
	}
	return ""
}
