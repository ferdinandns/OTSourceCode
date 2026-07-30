package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"sample-qc-backend/models"

	"github.com/gin-gonic/gin"
)

type MasterProductHandler struct {
	DB *sql.DB
}

func (h *MasterProductHandler) GetAll(c *gin.Context) {
	rows, err := h.DB.Query(
		"SELECT id, kode_produk, created_at, updated_at FROM master_products ORDER BY kode_produk ASC",
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	results := []models.MasterProduct{}
	for rows.Next() {
		var item models.MasterProduct
		if err := rows.Scan(&item.ID, &item.KodeProduk, &item.CreatedAt, &item.UpdatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		results = append(results, item)
	}
	c.JSON(http.StatusOK, results)
}

func (h *MasterProductHandler) GetByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	var item models.MasterProduct
	err = h.DB.QueryRow(
		"SELECT id, kode_produk, created_at, updated_at FROM master_products WHERE id = $1", id,
	).Scan(&item.ID, &item.KodeProduk, &item.CreatedAt, &item.UpdatedAt)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *MasterProductHandler) Create(c *gin.Context) {
	var req struct {
		KodeProduk string `json:"kodeProduk"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.KodeProduk == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "kodeProduk wajib diisi"})
		return
	}

	var exists bool
	if err := h.DB.QueryRow(
		"SELECT EXISTS(SELECT 1 FROM master_products WHERE kode_produk = $1)",
		req.KodeProduk,
	).Scan(&exists); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if exists {
		c.JSON(http.StatusConflict, gin.H{"error": "Kode produk sudah terdaftar"})
		return
	}

	var newID int
	if err := h.DB.QueryRow(
		"INSERT INTO master_products (kode_produk) VALUES ($1) RETURNING id",
		req.KodeProduk,
	).Scan(&newID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":         newID,
		"kodeProduk": req.KodeProduk,
		"message":    "Created successfully",
	})
}

func (h *MasterProductHandler) Update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	var req struct {
		KodeProduk string `json:"kodeProduk"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.KodeProduk == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "kodeProduk wajib diisi"})
		return
	}

	result, err := h.DB.Exec(
		"UPDATE master_products SET kode_produk=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2",
		req.KodeProduk, id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Updated successfully"})
}

func (h *MasterProductHandler) Delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	result, err := h.DB.Exec("DELETE FROM master_products WHERE id = $1", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Deleted successfully"})
}
