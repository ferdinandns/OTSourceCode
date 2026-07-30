package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
	"time"

	"sample-qc-backend/models"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type UserHandler struct {
	DB *sql.DB
}

func NewUserHandler(db *sql.DB) *UserHandler {
	return &UserHandler{DB: db}
}

type UserListResponse struct {
	Data []models.UserResponse `json:"data"`
	models.PaginationMeta
	TotalAll       int            `json:"totalAll"`
	DivisionCounts map[string]int `json:"divisionCounts"`
}

func (h *UserHandler) GetUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 200 {
		limit = 50
	}

	search := strings.TrimSpace(c.Query("search"))
	division := strings.TrimSpace(c.Query("division"))

	var pattern interface{}
	if search != "" {
		pattern = "%" + search + "%"
	}
	var divisionFilter interface{}
	if division != "" && division != "all" {
		divisionFilter = division
	}

	const whereClause = `
		WHERE (CAST($1 AS TEXT) IS NULL OR (
			name     ILIKE CAST($1 AS TEXT) OR
			email    ILIKE CAST($1 AS TEXT) OR
			division ILIKE CAST($1 AS TEXT)
		))
		AND (CAST($2 AS TEXT) IS NULL OR division = CAST($2 AS TEXT))`

	const countQuery = `SELECT COUNT(*) FROM users` + whereClause

	var total int
	if err := h.DB.QueryRow(countQuery, pattern, divisionFilter).Scan(&total); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghitung total data"})
		return
	}

	const divCountQuery = `
		SELECT division, COUNT(*)
		FROM   users
		WHERE  (CAST($1 AS TEXT) IS NULL OR (
			name     ILIKE CAST($1 AS TEXT) OR
			email    ILIKE CAST($1 AS TEXT) OR
			division ILIKE CAST($1 AS TEXT)
		))
		GROUP  BY division`

	divRows, err := h.DB.Query(divCountQuery, pattern)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghitung data per divisi"})
		return
	}
	defer divRows.Close()

	divisionCounts := map[string]int{
		"Admin": 0, "CPro": 0, "QC": 0, "TS": 0, "Andev": 0,
	}
	totalAll := 0
	for divRows.Next() {
		var div string
		var count int
		if err := divRows.Scan(&div, &count); err != nil {
			continue
		}
		divisionCounts[div] = count
		totalAll += count
	}
	if err := divRows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca data divisi"})
		return
	}

	totalPages := (total + limit - 1) / limit
	if totalPages == 0 {
		totalPages = 1
	}

	if page > totalPages {
		page = totalPages
	}

	offset := (page - 1) * limit

	const dataQuery = `
		SELECT id, name, email, division, password_encoded, created_at, updated_at
		FROM   users
		` + whereClause + `
		ORDER BY created_at DESC, id DESC
		LIMIT  $3 OFFSET $4`

	rows, err := h.DB.Query(dataQuery, pattern, divisionFilter, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data users"})
		return
	}
	defer rows.Close()

	users := make([]models.UserResponse, 0, limit)
	for rows.Next() {
		var u models.UserResponse
		var createdAt, updatedAt time.Time
		if err := rows.Scan(
			&u.ID, &u.Name, &u.Email, &u.Division,
			&u.PasswordEncoded, &createdAt, &updatedAt,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca data"})
			return
		}
		u.CreatedAt = formatWIB(createdAt)
		u.UpdatedAt = formatWIB(updatedAt)
		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca data"})
		return
	}

	c.JSON(http.StatusOK, UserListResponse{
		Data: users,
		PaginationMeta: models.PaginationMeta{
			Total:      total,
			Page:       page,
			PerPage:    limit,
			TotalPages: totalPages,
		},
		TotalAll:       totalAll,
		DivisionCounts: divisionCounts,
	})
}

func (h *UserHandler) CreateUser(c *gin.Context) {
	var req models.CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var exists bool
	if err := h.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)`, req.Email).Scan(&exists); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal cek email"})
		return
	}
	if exists {
		c.JSON(http.StatusConflict, gin.H{"error": "Email sudah terdaftar"})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memproses password"})
		return
	}

	var user models.UserResponse
	var createdAt, updatedAt time.Time
	if err := h.DB.QueryRow(`
		INSERT INTO users (name, email, password, password_encoded, division)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, name, email, division, password_encoded, created_at, updated_at
	`, req.Name, req.Email, string(hashedPassword), req.PasswordEncoded, req.Division).
		Scan(&user.ID, &user.Name, &user.Email, &user.Division,
			&user.PasswordEncoded, &createdAt, &updatedAt); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menambah user"})
		return
	}
	user.CreatedAt = formatWIB(createdAt)
	user.UpdatedAt = formatWIB(updatedAt)

	c.JSON(http.StatusCreated, user)
}

func (h *UserHandler) UpdateUser(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tidak valid"})
		return
	}

	var req models.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var existingPassword, existingPasswordEncoded string
	err = h.DB.QueryRow(`SELECT password, password_encoded FROM users WHERE id = $1`, id).
		Scan(&existingPassword, &existingPasswordEncoded)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "User tidak ditemukan"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data user"})
		return
	}

	var emailExists bool
	if err := h.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM users WHERE email = $1 AND id != $2)`, req.Email, id,
	).Scan(&emailExists); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal cek email"})
		return
	}
	if emailExists {
		c.JSON(http.StatusConflict, gin.H{"error": "Email sudah digunakan oleh user lain"})
		return
	}

	passwordToSave := existingPassword
	passwordEncodedToSave := existingPasswordEncoded
	if req.Password != "" {
		hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memproses password"})
			return
		}
		passwordToSave = string(hashed)
		passwordEncodedToSave = req.PasswordEncoded
	}

	var user models.UserResponse
	var createdAt, updatedAt time.Time
	if err := h.DB.QueryRow(`
		UPDATE users
		SET name = $1, email = $2, password = $3, password_encoded = $4,
		    division = $5, updated_at = NOW()
		WHERE id = $6
		RETURNING id, name, email, division, password_encoded, created_at, updated_at
	`, req.Name, req.Email, passwordToSave, passwordEncodedToSave, req.Division, id).
		Scan(&user.ID, &user.Name, &user.Email, &user.Division,
			&user.PasswordEncoded, &createdAt, &updatedAt); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update user"})
		return
	}
	user.CreatedAt = formatWIB(createdAt)
	user.UpdatedAt = formatWIB(updatedAt)

	c.JSON(http.StatusOK, user)
}

func (h *UserHandler) DeleteUser(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tidak valid"})
		return
	}

	result, err := h.DB.Exec(`DELETE FROM users WHERE id = $1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus user"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "User tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User berhasil dihapus"})
}
