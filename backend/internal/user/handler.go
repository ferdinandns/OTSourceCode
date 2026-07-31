package user

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"emertrack/internal/domain"
	"emertrack/internal/dto"
	"emertrack/pkg/email"
	"emertrack/pkg/jwt"
	"emertrack/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	gojwt "github.com/golang-jwt/jwt/v5"
)

const userNotFound = "User not found"

type Handler struct {
	userSvc domain.UserService
	jwtMgr  *jwt.Manager
}

func NewHandler(svc domain.UserService, jm *jwt.Manager) *Handler {
	return &Handler{userSvc: svc, jwtMgr: jm}
}

func getUserID(c *gin.Context) (uint, error) {
	idRaw, exists := c.Get("user_id")
	if !exists {
		return 0, fmt.Errorf("unauthorized: user_id not found in context")
	}

	switch v := idRaw.(type) {
	case uint:
		return v, nil
	case uint64:
		return uint(v), nil
	case int:
		return uint(v), nil
	case float64:
		return uint(v), nil
	default:
		return 0, fmt.Errorf("unauthorized: invalid user_id type")
	}
}

func mapToUserResponse(u *domain.User) dto.UserResponse {
	roles := make([]string, len(u.Roles))
	for i, r := range u.Roles {
		roles[i] = string(r.Role)
	}
	return dto.UserResponse{
		ID:             u.ID,
		NIK:            u.NIK,
		Name:           u.Name,
		Email:          u.Email,
		SiteID:         u.SiteID,
		SiteName:       u.Site.Name,
		DepartmentID:   u.DepartmentID,
		DepartmentName: u.Department.Name,
		Roles:          roles,
		IsSupervisor:   u.IsSupervisor,
		IsActive:       u.IsActive,
	}
}

// --- AUTHENTICATION ---

func (h *Handler) Login(c *gin.Context) {
	var req dto.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c.Writer, "Invalid email or password format")
		return
	}

	user, err := h.userSvc.ValidateLogin(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		response.Error(c.Writer, http.StatusUnauthorized, err.Error())
		return
	}

	var roles []domain.Role
	var rolesString []string
	for _, ur := range user.Roles {
		roles = append(roles, ur.Role)
		rolesString = append(rolesString, string(ur.Role))
	}

	departmentName := user.Department.Name

	accessToken, refreshToken, err := h.jwtMgr.GenerateTokenPair(user.ID, user.Name, departmentName, rolesString, user.IsSupervisor)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, "Gagal membuat sesi login")
		return
	}

	accessMaxAge := 0 
	if req.RememberMe {
		accessMaxAge = 30 * 24 * 60 * 60 
	}
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "access_token",
		Value:    accessToken,
		HttpOnly: true,
		Secure:   true, 
		SameSite: http.SameSiteNoneMode,
		Path:     "/",
		MaxAge:   accessMaxAge,
	})

	refreshMaxAge := 0
	if req.RememberMe {
		refreshMaxAge = 30 * 24 * 60 * 60
	}
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteNoneMode,
		Path:     "/api/v1/refresh",
		MaxAge:   refreshMaxAge,
	})

	perms := domain.GetEffectivePermissions(roles, user.IsSupervisor)
	menus := domain.GetAvailableMenus(perms)
	menuIDs := make([]string, len(menus))
	for i, m := range menus {
		menuIDs[i] = m.ID
	}

	if strings.Contains(strings.ToLower(user.Department.Name), "general affair") {
		perms = append(perms, "view:refill", "manage:refill")
		menuIDs = append(menuIDs, "refill")
	}

	userProfile := domain.UserProfile{
		ID:                 user.ID,
		Email:              user.Email,
		FullName:           user.Name,
		IsSupervisor:       user.IsSupervisor,
		Roles:              roles,
		DepartmentName:     user.Department.Name,
		MustChangePassword: user.MustChangePassword,
	}

	response.Success(c.Writer, domain.LoginResponse{
		User:        userProfile,
		Permissions: perms,
		Menus:       menuIDs,
	})
}

func (h *Handler) Logout(c *gin.Context) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "access_token",
		Value:    "",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteNoneMode,
		Path:     "/",
		MaxAge:   -1,
	})
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "refresh_token",
		Value:    "",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteNoneMode,
		Path:     "/api/v1/refresh",
		MaxAge:   -1,
	})
	response.SuccessMessage(c.Writer, "Logged out successfully")
}

func (h *Handler) Me(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c.Writer)
		return
	}

	user, err := h.userSvc.GetUser(c.Request.Context(), userID)
	if err != nil {
		response.NotFound(c.Writer, userNotFound)
		return
	}

	var roles []domain.Role
	isChecker := false // Flag untuk ngecek apakah dia checker

	for _, ur := range user.Roles {
		roles = append(roles, ur.Role)
		// Gunakan konstanta role yang kamu punya, misal "checker" atau domain.RoleChecker
		if ur.Role == "checker" {
			isChecker = true
		}
	}

	// Siapkan wadah mapping sarpras
	var assignedSarpras []domain.AssignedSarpras

	// Eksekusi mapping kalau dia checker
	if isChecker {
		for _, assignment := range user.Assignments {
			assignedSarpras = append(assignedSarpras, domain.AssignedSarpras{
				ID:   assignment.SarprasTypeID,
				Name: assignment.SarprasType.Name,
				Code: assignment.SarprasType.Code, // pastikan domain SarprasType punya field Code
			})
		}
	}

	perms := domain.GetEffectivePermissions(roles, user.IsSupervisor)
	menus := domain.GetAvailableMenus(perms)
	menuIDs := make([]string, len(menus))
	for i, m := range menus {
		menuIDs[i] = m.ID
	}

	if strings.Contains(strings.ToLower(user.Department.Name), "general affair") {
		menuIDs = append(menuIDs, "refill")
	}

	response.Success(c.Writer, gin.H{
		"user_id":          user.ID,
		"full_name":        user.Name,
		"email":            user.Email,
		"nik":              user.NIK,
		"site_id":          user.SiteID,
		"site_name":        user.Site.Name,
		"department_id":    user.DepartmentID,
		"department_name":  user.Department.Name,
		"menus":            menuIDs,
		"roles":            roles,
		"is_supervisor":    user.IsSupervisor,
		"assigned_sarpras": assignedSarpras, 
	})
}

// --- CRUD USER ---

func (h *Handler) Create(c *gin.Context) {
	var req dto.CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c.Writer, err.Error())
		return
	}

	actorID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c.Writer)
		return
	}

	// Mapping DTO -> Domain
	domainUser := &domain.User{
		NIK:          req.NIK,
		Name:         req.Name,
		Email:        req.Email,
		SiteID:       req.SiteID,
		DepartmentID: req.DepartmentID,
		IsSupervisor: req.IsSupervisor,
		CreatedBy:    &actorID,
		UpdatedBy:    &actorID,
	}

	// Convert roles from DTO (strings) to domain.Role
	domainRoles := domain.RolesFromStrings(req.Roles)

	_, err = h.userSvc.CreateUser(c.Request.Context(), actorID, domainUser, domainRoles, req.SarprasTypeIDs)
	if err != nil {
		if response.FieldValidationError(c.Writer, err) {
			return
		}
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}

	response.Created(c.Writer, "Berhasil Menambahkan User!")
}

func (h *Handler) Update(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	var req dto.EditUserRequest

	decoder := json.NewDecoder(c.Request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&req); err != nil {
		response.BadRequest(c.Writer, "JSON Error: "+err.Error())
		return
	}

	actorID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c.Writer)
		return
	}

	domainUser := &domain.User{}

	domainUser.Name = req.Name
	domainUser.Email = req.Email
	domainUser.SiteID = req.SiteID
	domainUser.DepartmentID = req.DepartmentID

	if req.IsActive != nil {
		domainUser.IsActive = *req.IsActive
	}
	if req.IsSupervisor != nil {
		domainUser.IsSupervisor = *req.IsSupervisor
	}

	var domainRoles []domain.Role
	for _, r := range req.Roles {
		domainRoles = append(domainRoles, domain.Role(r))
	}

	_, err = h.userSvc.UpdateUser(c.Request.Context(), actorID, uint(id), domainUser, domainRoles, req.SarprasTypeIDs)
	if err != nil {
		if response.FieldValidationError(c.Writer, err) {
			return 
		}
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}

	response.SuccessMessage(c.Writer, "Berhasil Mengubah Data User!")
}

func (h *Handler) Delete(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	actorID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c.Writer)
		return
	}

	if err := h.userSvc.DeleteUser(c.Request.Context(), actorID, uint(id)); err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}

	response.SuccessMessage(c.Writer, "Berhasil Menghapus Data User!")
}

func (h *Handler) GetByID(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)

	res, err := h.userSvc.GetUser(c.Request.Context(), uint(id))
	if err != nil {
		response.NotFound(c.Writer, userNotFound)
		return
	}

	response.Success(c.Writer, mapToUserResponse(res))
}

func (h *Handler) GetUserDetail(c *gin.Context) {
	idParam := c.Param("id")
	userID, err := strconv.Atoi(idParam)
	if err != nil {
		response.Error(c.Writer, http.StatusBadRequest, "Invalid User ID")
		return
	}

	userDomain, err := h.userSvc.GetUser(c.Request.Context(), uint(userID))
	if err != nil {
		response.Error(c.Writer, http.StatusNotFound, userNotFound)
		return
	}

	var roles []string
	for _, r := range userDomain.Roles {
		roles = append(roles, string(r.Role))
	}

	// Ekstrak ID dan Nama Sarpras ke dalam array of object
	var assignedSarpras []dto.AssignedSarprasResponse
	if !userDomain.IsSupervisor {
		for _, assignment := range userDomain.Assignments {
			assignedSarpras = append(assignedSarpras, dto.AssignedSarprasResponse{
				ID:   assignment.SarprasTypeID,
				Name: assignment.SarprasType.Name,
			})
		}
	} else {
		// Jika dia supervisor, paksa assignedSarpras jadi nil atau array kosong
		assignedSarpras = []dto.AssignedSarprasResponse{}
	}

	// Mapping ke DTO
	resp := dto.UserDetailResponse{
		ID:              userDomain.ID,
		NIK:             userDomain.NIK,
		Name:            userDomain.Name,
		Email:           userDomain.Email,
		SiteID:          userDomain.SiteID,
		SiteName:        userDomain.Site.Name,
		DepartmentID:    userDomain.DepartmentID,
		DepartmentName:  userDomain.Department.Name,
		IsActive:        userDomain.IsActive,
		IsSupervisor:    userDomain.IsSupervisor,
		Roles:           roles,
		AssignedSarpras: assignedSarpras,
	}

	response.Success(c.Writer, resp)
}

func (h *Handler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	filter := domain.UserFilter{
		Search:    c.Query("search"),
		Page:      page,
		PageSize:  pageSize,
		SortBy:    c.Query("sort_by"),
		SortOrder: c.Query("sort_order"),
	}

	if r := c.Query("role"); r != "" {
		role := domain.Role(r)
		filter.Role = &role
	}
	if d := c.Query("department_id"); d != "" {
		deptID, _ := strconv.ParseUint(d, 10, 32)
		dID := uint(deptID)
		filter.DepartmentID = &dID
	}

	rows, total, err := h.userSvc.ListUsers(c.Request.Context(), filter)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}

	var usersDTO []dto.UserListResponse
	for _, row := range rows {
		var roles []string
		for _, r := range row.Roles {
			roles = append(roles, string(r))
		}

		usersDTO = append(usersDTO, dto.UserListResponse{
			ID:             row.ID,
			Name:           row.Name,
			Email:          row.Email,
			DepartmentName: row.DepartmentName,
			Roles:          roles,
			IsSupervisor:   row.IsSupervisor,
			IsActive:       row.IsActive,
		})
	}

	ps := filter.PageSize
	if ps < 1 {
		ps = 20
	}
	totalPages := int(math.Ceil(float64(total) / float64(ps)))

	if usersDTO == nil {
		usersDTO = []dto.UserListResponse{}
	}

	response.Success(c.Writer, dto.PaginatedResponse{
		Data:       usersDTO,
		Total:      total,
		Page:       page,
		PageSize:   ps,
		TotalPages: totalPages,
	})
}

func (h *Handler) GetApproverEmails(c *gin.Context) {
	emails, err := h.userSvc.GetApproversEmail(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch approver emails"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": emails})
}

// ChangePassword handles password change request.
func (h *Handler) ChangePassword(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c.Writer)
		return
	}

	req, err := h.bindAndValidateChangePassword(c)
	if err != nil {
		response.BadRequest(c.Writer, err.Error())
		return
	}

	// 🔍 DEBUG: Log the user ID and old password length
	log.Printf("[DEBUG ChangePassword] userID: %d, oldPassword length: %d", userID, len(req.OldPassword))

	// 🔍 DEBUG: Fetch user to see MustChangePassword value
	user, err := h.userSvc.GetUser(c.Request.Context(), userID)
	if err == nil {
		log.Printf("[DEBUG ChangePassword] user found: ID=%d, MustChangePassword=%v", user.ID, user.MustChangePassword)
	} else {
		log.Printf("[DEBUG ChangePassword] failed to fetch user: %v", err)
	}

	if err := h.userSvc.ChangePassword(c.Request.Context(), userID, req.OldPassword, req.NewPassword); err != nil {
		response.Error(c.Writer, http.StatusBadRequest, err.Error())
		return
	}

	response.SuccessMessage(c.Writer, "Successfully change password")
}

// bindAndValidateChangePassword binds JSON and validates password fields.
// Returns the validated request or an error with a user-friendly message.
func (h *Handler) bindAndValidateChangePassword(c *gin.Context) (*dto.ChangePasswordRequest, error) {
	var req dto.ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		return nil, h.formatBindingError(err)
	}
	return &req, nil
}

// formatBindingError converts binding/validation errors into a user-friendly message.
func (h *Handler) formatBindingError(err error) error {
	if errs, ok := err.(validator.ValidationErrors); ok {
		for _, e := range errs {
			if e.Field() == "NewPassword" {
				switch e.Tag() {
				case "min":
					return errors.New("Password baru minimal harus 8 karakter")
				case "required":
					return errors.New("Password baru wajib diisi")
				}
			}
		}
		return errors.New("Format input tidak sesuai")
	}
	return errors.New("Gagal memproses request")
}

func (h *Handler) GetUserService() domain.UserService {
	return h.userSvc
}

func getResetSecret() []byte {
	secret := os.Getenv("RESET_PASSWORD_SECRET")
	return []byte(secret)
}

// POST /api/v1/forgot-password
func (h *Handler) ForgotPassword(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c.Writer, "Format email tidak valid")
		return
	}

	// 1. Cari user berdasarkan email
	user, err := h.userSvc.GetUserByEmail(c.Request.Context(), req.Email)
	if err == nil && user != nil {

		// 2. Buat Token JWT
		token := gojwt.NewWithClaims(gojwt.SigningMethodHS256, gojwt.MapClaims{
			"user_id":  user.ID,
			"old_hash": user.PasswordHash,
			"exp":      time.Now().Add(15 * time.Minute).Unix(),
		})

		tokenString, err := token.SignedString(getResetSecret())
		if err == nil {
			frontendURL := os.Getenv("FRONTEND_BASE_URL")
			resetLink := fmt.Sprintf("%s/login/reset-password?token=%s", frontendURL, tokenString)

			// 3. Setup Konfigurasi Mailer dari .env
			port, _ := strconv.Atoi(os.Getenv("SMTP_PORT"))
			if port == 0 {
				port = 587
			}

			mailerCfg := email.Config{
				Host:     os.Getenv("SMTP_HOST"),
				Port:     port,
				Username: os.Getenv("SMTP_USER"),
				Password: os.Getenv("SMTP_PASS"),
				From:     os.Getenv("SMTP_FROM"),
			}
			mailer := email.New(mailerCfg)
			body := fmt.Sprintf(`Kami menerima permintaan untuk mereset password akun Anda di sistem EMERTRACK.

Silakan klik tautan di bawah ini untuk mengatur ulang password Anda:

<a href="%s" style="display:inline-block;padding:10px 20px;background-color:#16a34a;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">Reset Password Sekarang</a>

Tautan ini hanya berlaku selama 15 menit. Jika Anda tidak merasa melakukan permintaan ini, silakan abaikan email ini dengan aman.`, resetLink)

			// 5. Kirim Email (Asynchronous dengan Goroutine)
			go func() {
				// Gunakan fungsi Send (bukan SendHTML), agar plainToHTML kamu ikut tereksekusi
				err := mailer.Send(user.Email, "Permintaan Reset Password", body)
				if err != nil {
					fmt.Println("[ERROR] Gagal mengirim email reset password:", err)
				} else {
					fmt.Println("[INFO] Email reset password berhasil dikirim ke", user.Email)
				}
			}()
		}
	}

	// Selalu kembalikan respon sukses demi keamanan (Email Enumeration Protection)
	response.SuccessMessage(c.Writer, "Jika email terdaftar di sistem, instruksi pembaruan password telah dikirim.")
}

// POST /api/v1/reset-password
func (h *Handler) ResetPassword(c *gin.Context) {
	var req struct {
		Token       string `json:"token" binding:"required"`
		NewPassword string `json:"new_password" binding:"required,min=8"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c.Writer, "Password baru minimal harus 8 karakter")
		return
	}

	// 1. Parse dan Validasi Tanda Tangan JWT
	token, err := gojwt.Parse(req.Token, func(token *gojwt.Token) (interface{}, error) {
		return getResetSecret(), nil
	})
	if err != nil || !token.Valid {
		response.BadRequest(c.Writer, "Tautan reset tidak valid atau telah kedaluwarsa")
		return
	}

	claims, ok := token.Claims.(gojwt.MapClaims)
	if !ok {
		response.BadRequest(c.Writer, "Format data token rusak")
		return
	}

	userID := uint(claims["user_id"].(float64))
	oldHashFromToken := claims["old_hash"].(string)

	// 2. Tarik data user terbaru untuk cek keabsahan hash
	user, err := h.userSvc.GetUser(c.Request.Context(), userID)
	if err != nil {
		response.NotFound(c.Writer, "User tidak ditemukan")
		return
	}

	if user.PasswordHash != oldHashFromToken {
		response.BadRequest(c.Writer, "Tautan ini sudah kedaluwarsa karena telah digunakan sebelumnya")
		return
	}

	// 4. Eksekusi update password (Bypass password lama dengan memaksa MustChangePassword = true)
	err = h.userSvc.ForceResetPassword(c.Request.Context(), user.ID, req.NewPassword)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, "Gagal memperbarui password: "+err.Error())
		return
	}

	response.SuccessMessage(c.Writer, "Password berhasil diperbarui. Silakan masuk kembali.")
}
