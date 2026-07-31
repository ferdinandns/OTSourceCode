package handlers

import (
	"migrasi_batch_tracker/helpers"
	"migrasi_batch_tracker/models"
	"migrasi_batch_tracker/services"
	"net/http"
	"regexp"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// UserHandler menangani manajemen data user, termasuk CRUD, reset password, dan detail area.
type UserHandler struct {
	userDB *gorm.DB
}

func NewGetUserList(db *gorm.DB) *UserHandler {
	return &UserHandler{userDB: db}
}

// GetUserListHandler mengembalikan daftar user sesuai area dan level yang sedang login.
func (h *UserHandler) GetUserListHandler(c *gin.Context) {
	userArea, existArea := c.MustGet("area").(string)
	userLevel, existLevel := c.MustGet("level").(string)

	if !existArea || !existLevel {
		response := helpers.APIResponse("Akses ditolak.", http.StatusUnauthorized, "error", nil)
		c.JSON(http.StatusUnauthorized, response)
		return
	}

	users, total, err := services.GetUserListService(h.userDB, userArea, userLevel)

	if err != nil {
		response := helpers.APIResponse("Gagal memuat list data user", http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponseList("Berhasil memuat data user", http.StatusOK, "success", total, users)
	c.JSON(http.StatusOK, response)
}

// CreateUserHandler menerima data user baru dan menyimpannya lewat service.
func (h *UserHandler) CreateUserHandler(c *gin.Context) {
	var req models.AddUser

	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("Format input tidak valid: "+err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	err := services.CreateUserService(h.userDB, req)
	if err != nil {
		response := helpers.APIResponse("Gagal proses: "+err.Error(), http.StatusInternalServerError, "error", nil)
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	response := helpers.APIResponse("Data pengguna berhasil ditambahkan!", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}

// EditUserHandler memproses perubahan data user dan validasi password jika diperlukan.
func (h *UserHandler) EditUserHandler(c *gin.Context) {
	idTarget, _ := strconv.Atoi(c.Param("id"))

	idCallerFloat, exist := c.MustGet("user_id").(float64)
	idCaller := uint(idCallerFloat)
	nama, _ := c.MustGet("nama").(string)
	area, _ := c.MustGet("area").(string)
	level, _ := c.MustGet("level").(string)
	alamatIp := c.ClientIP()

	if !exist {
		response := helpers.APIResponse("Akses ditolak. Unauthorized.", http.StatusUnauthorized, "error", nil)
		c.JSON(http.StatusUnauthorized, response)
		return
	}

	var req models.EditUser
	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("Format input tidak valid: "+err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	if req.NewPassword != "" {
		if req.NewPassword != req.ConfirmPassword {
			response := helpers.APIResponse("Konfirmasi password tidak cocok!", http.StatusBadRequest, "error", nil)
			c.JSON(http.StatusBadRequest, response)
			return
		}
		if req.OldPassword == "" {
			response := helpers.APIResponse("Password lama harus diisi!", http.StatusBadRequest, "error", nil)
			c.JSON(http.StatusBadRequest, response)
			return
		}

		hasUpper := regexp.MustCompile(`[A-Z]`).MatchString(req.NewPassword)
		hasLower := regexp.MustCompile(`[a-z]`).MatchString(req.NewPassword)
		hasSymbol := regexp.MustCompile(`[^a-zA-Z0-9\s]`).MatchString(req.NewPassword)

		if !hasUpper || !hasLower || !hasSymbol {
			response := helpers.APIResponse("Password lama harus mengandung kombinasi huruf besar, huruf kecil dan simbol!", http.StatusBadRequest, "error", nil)
			c.JSON(http.StatusBadRequest, response)
			return
		}
	}

	err := services.EditUserService(h.userDB, req, idCaller, uint(idTarget), nama, area, level, alamatIp)
	if err != nil {
		response := helpers.APIResponse(err.Error(), http.StatusForbidden, "error", nil)
		c.JSON(http.StatusForbidden, response)
		return
	}

	message := "Data user berhasil diperbarui."
	forceLogout := false
	if idCaller == uint(idTarget) {
		message += " Silakan login dengan password baru anda!"
		forceLogout = true
	}

	response := helpers.APIResponse(message, http.StatusOK, "success", gin.H{"force_logout": forceLogout})
	c.JSON(http.StatusOK, response)
}

func (h *UserHandler) DeleteUserHandler(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	err := services.DeleteUserService(h.userDB, uint(id))
	if err != nil {
		response := helpers.APIResponse("Gagal menghapus data user", http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	response := helpers.APIResponse("Berhasil menghapus data user", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}

func (h *UserHandler) ResetPasswordUserHandler(c *gin.Context) {
	idTarget, _ := strconv.Atoi(c.Param("id"))

	idCallerFloat, exist := c.MustGet("user_id").(float64)
	idCaller := uint(idCallerFloat)
	level, _ := c.MustGet("level").(string)

	if !exist {
		response := helpers.APIResponse("Akses ditolak. Unauthorized.", http.StatusUnauthorized, "error", nil)
		c.JSON(http.StatusUnauthorized, response)
		return
	}

	var req models.EditUser
	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("Format input tidak valid: "+err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	err := services.ResetPasswordUserService(h.userDB, req, idCaller, uint(idTarget), level)
	if err != nil {
		response := helpers.APIResponse(err.Error(), http.StatusForbidden, "error", nil)
		c.JSON(http.StatusForbidden, response)
		return
	}

	message := "Password berhasil direset."
	forceLogout := false
	if idCaller == uint(idTarget) {
		message += " Silakan login dengan password baru anda!"
		forceLogout = true
	}

	response := helpers.APIResponse(message, http.StatusOK, "success", gin.H{"force_logout": forceLogout})
	c.JSON(http.StatusOK, response)
}

// user_list_handler.go
func (h *UserHandler) UpdateDetailAreaHandler(c *gin.Context) {
	idTarget, _ := strconv.Atoi(c.Param("id"))

	idCallerFloat, exist := c.MustGet("user_id").(float64)
	idCaller := uint(idCallerFloat)
	nama, _ := c.MustGet("nama").(string)
	area, _ := c.MustGet("area").(string)
	level, _ := c.MustGet("level").(string)

	if !exist {
		response := helpers.APIResponse("Akses ditolak. Unauthorized.", http.StatusUnauthorized, "error", nil)
		c.JSON(http.StatusUnauthorized, response)
		return
	}

	var req models.Login
	if err := c.ShouldBindJSON(&req); err != nil {
		response := helpers.APIResponse("Format input tidak valid: "+err.Error(), http.StatusBadRequest, "error", nil)
		c.JSON(http.StatusBadRequest, response)
		return
	}

	caller := models.User{Nama: nama, Area: area}
	alamatIp := c.ClientIP()

	err := services.UpdateDetailAreaService(h.userDB, idTarget, req, idCaller, level, caller, alamatIp)
	if err != nil {
		response := helpers.APIResponse(err.Error(), http.StatusForbidden, "error", nil)
		c.JSON(http.StatusForbidden, response)
		return
	}

	response := helpers.APIResponse("Detail area berhasil diubah.", http.StatusOK, "success", nil)
	c.JSON(http.StatusOK, response)
}

func (h *UserHandler) UserRoutes(rg *gin.RouterGroup) {
	route := rg.Group("/users")
	{
		route.GET("/", h.GetUserListHandler)
		route.POST("/", h.CreateUserHandler)
		route.PUT("/:id", h.EditUserHandler)
		route.DELETE("/:id", h.DeleteUserHandler)
		route.PUT("/reset-password/:id", h.ResetPasswordUserHandler)
		route.PUT("/update-detail-area/:id", h.UpdateDetailAreaHandler)
	}
}
