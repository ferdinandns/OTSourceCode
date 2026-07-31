package handlers

import (
	"migrasi_batch_tracker/helpers"
	"migrasi_batch_tracker/models"
	"migrasi_batch_tracker/services"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

// AuthHandler menangani endpoint login, logout, dan refresh token untuk autentikasi user.
type AuthHandler struct {
	appDB *gorm.DB
}

type CustomClaims struct {
	UserID     uint   `json:"user_id"`
	Username   string `json:"username"`
	Nama       string `json:"nama"`
	Level      string `json:"level"`
	Area       string `json:"area"`
	DetailArea string `json:"detail_area"`
	jwt.RegisteredClaims
}

// NewAuthHandler membuat instance handler autentikasi dengan dependency database aplikasi.
func NewAuthHandler(appDB *gorm.DB) *AuthHandler {
	return &AuthHandler{
		appDB: appDB,
	}
}

// Login menerima kredensial user, memvalidasi lewat service, lalu mengembalikan token JWT.
func (h *AuthHandler) Login(c *gin.Context) {
	var req models.Login

	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("Username dan Password wajib diisi!", http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	// Panggil Service Layer
	user, err := services.LoginService(h.appDB, req.Username, req.Password, c.ClientIP())
	if err != nil {
		response := helpers.APIResponse(err.Error(), http.StatusUnauthorized, "error", nil)
		c.JSON(http.StatusUnauthorized, response)
		return
	}

	// Generate JWT
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id":     user.ID,
		"username":    user.Username,
		"nama":        user.Nama,
		"level":       user.Level,
		"area":        user.Area,
		"detail_area": user.Detail_area,
		"exp":         time.Now().Add(time.Hour + 1).Unix(),
	})

	jwtSecret := []byte(os.Getenv("JWTSECRET"))
	tokenString, errToken := token.SignedString(jwtSecret)

	if errToken != nil {
		response := helpers.APIResponse("Gagal membuat token login!", http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Login Sukses!",
		"token":   tokenString,
		"user": gin.H{
			"id":          user.ID,
			"username":    user.Username,
			"nama":        user.Nama,
			"level":       user.Level,
			"area":        user.Area,
			"detail_area": user.Detail_area,
		},
	})
}

// Logout mencatat aktivitas user keluar dan menutup sesi autentikasi.
func (h *AuthHandler) Logout(c *gin.Context) {
	// Ambil data user dari context (diset oleh middleware RequireAuth)
	userIDFloat, exists := c.MustGet("user_id").(float64)
	if !exists {
		response := helpers.APIResponse("Akses ditolak. Unauthorized.", http.StatusUnauthorized, "error", nil)
		c.JSON(http.StatusUnauthorized, response)
		return
	}

	userID := uint(userIDFloat)
	nama, _ := c.MustGet("nama").(string)
	area, _ := c.MustGet("area").(string)
	ipAddress := c.ClientIP()

	// Panggil Service untuk mencatat aktivitas logout
	err := services.LogoutService(h.appDB, userID, nama, area, ipAddress)
	if err != nil {
		response := helpers.APIResponse("Gagal memproses logout", http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Berhasil logout",
	})
}

// RefreshToken memperpanjang masa aktif token lama agar user tidak perlu login ulang terlalu sering.
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	// Ambil token dari header Authorization
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		response := helpers.APIResponse("Header Authorization tidak ditemukan", http.StatusUnauthorized, "error", nil)
		c.JSON(http.StatusUnauthorized, response)
		return
	}

	// Format harus "Bearer <token>"
	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		response := helpers.APIResponse("Format token tidak valid", http.StatusUnauthorized, "error", nil)
		c.JSON(http.StatusUnauthorized, response)
		return
	}
	tokenString := parts[1]

	// Ambil Secret Key
	jwtSecret := []byte(os.Getenv("JWTSECRET"))

	// Parse token lama
	claims := &CustomClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})

	// Jika token sudah benar-benar mati / rusak
	if err != nil || !token.Valid {
		response := helpers.APIResponse("Sesi telah kedaluwarsa sepenuhnya, silakan login ulang", http.StatusUnauthorized, "error", nil)
		c.JSON(http.StatusUnauthorized, response)
		return
	}

	// Perpanjang waktu expired menjadi 1 Jam dari sekarang
	expirationTime := time.Now().Add(time.Hour + 1)
	claims.ExpiresAt = jwt.NewNumericDate(expirationTime)

	// Buat token baru dengan claims yang sudah di-update
	newToken := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	newTokenString, errToken := newToken.SignedString(jwtSecret)

	if errToken != nil {
		response := helpers.APIResponse("Gagal memproses perpanjangan sesi", http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	// Kirim balik token baru
	c.JSON(http.StatusOK, gin.H{
		"message": "Token berhasil diperbarui",
		"token":   newTokenString,
	})
}

func (h *AuthHandler) RegisterPublicRoutes(rg *gin.RouterGroup) {
	rg.POST("/login", h.Login)
}

// Memisahkan routing private (wajib token)
func (h *AuthHandler) RegisterPrivateRoutes(rg *gin.RouterGroup) {
	rg.POST("/logout", h.Logout)
	rg.POST("/refresh-token", h.RefreshToken) // Refresh token butuh token lama
}
