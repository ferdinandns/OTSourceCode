package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"sample-qc-backend/models"

	"github.com/gin-gonic/gin"
)

type MasterItemHandler struct {
	DB *sql.DB
}

func (h *MasterItemHandler) GetAll(c *gin.Context) {
	rows, err := h.DB.Query(
		"SELECT id, kode_item, nama_material, manufacture, created_at, updated_at FROM master_items ORDER BY kode_item ASC",
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	results := []models.MasterItem{}
	for rows.Next() {
		var item models.MasterItem
		if err := rows.Scan(&item.ID, &item.KodeItem, &item.NamaMaterial, &item.Manufacture, &item.CreatedAt, &item.UpdatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		results = append(results, item)
	}
	c.JSON(http.StatusOK, results)
}

func (h *MasterItemHandler) GetByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	var item models.MasterItem
	err = h.DB.QueryRow(
		"SELECT id, kode_item, nama_material, manufacture, created_at, updated_at FROM master_items WHERE id = $1", id,
	).Scan(&item.ID, &item.KodeItem, &item.NamaMaterial, &item.Manufacture, &item.CreatedAt, &item.UpdatedAt)
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

func (h *MasterItemHandler) Create(c *gin.Context) {
	var req struct {
		KodeItem     string `json:"kodeItem" binding:"required"`
		NamaMaterial string `json:"namaMaterial" binding:"required"`
		Manufacture  string `json:"manufacture"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var exists bool
	if err := h.DB.QueryRow(
		"SELECT EXISTS(SELECT 1 FROM master_items WHERE kode_item = $1 AND COALESCE(manufacture, '') = $2)",
		req.KodeItem, req.Manufacture,
	).Scan(&exists); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if exists {
		c.JSON(http.StatusConflict, gin.H{"error": "Item already exists for this manufacturer"})
		return
	}

	var newID int
	if err := h.DB.QueryRow(
		"INSERT INTO master_items (kode_item, nama_material, manufacture) VALUES ($1, $2, $3) RETURNING id",
		req.KodeItem, req.NamaMaterial, req.Manufacture,
	).Scan(&newID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id": newID, "kodeItem": req.KodeItem,
		"namaMaterial": req.NamaMaterial, "manufacture": req.Manufacture,
		"message": "Created successfully",
	})
}

func (h *MasterItemHandler) Update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	var req struct {
		KodeItem     string `json:"kodeItem" binding:"required"`
		NamaMaterial string `json:"namaMaterial" binding:"required"`
		Manufacture  string `json:"manufacture"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.DB.Exec(
		"UPDATE master_items SET kode_item=$1, nama_material=$2, manufacture=$3, updated_at=CURRENT_TIMESTAMP WHERE id=$4",
		req.KodeItem, req.NamaMaterial, req.Manufacture, id,
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

func (h *MasterItemHandler) Delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	result, err := h.DB.Exec("DELETE FROM master_items WHERE id = $1", id)
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

type MasterItemPMHandler struct {
	DB *sql.DB
}

func (h *MasterItemPMHandler) GetAll(c *gin.Context) {
	rows, err := h.DB.Query(
		"SELECT id, kode_item, nama_material, manufacture, created_at, updated_at FROM master_items_pm ORDER BY kode_item ASC",
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	results := []models.MasterItemPM{}
	for rows.Next() {
		var item models.MasterItemPM
		if err := rows.Scan(&item.ID, &item.KodeItem, &item.NamaMaterial, &item.Manufacture, &item.CreatedAt, &item.UpdatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		results = append(results, item)
	}
	c.JSON(http.StatusOK, results)
}

func (h *MasterItemPMHandler) GetByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	var item models.MasterItemPM
	err = h.DB.QueryRow(
		"SELECT id, kode_item, nama_material, manufacture, created_at, updated_at FROM master_items_pm WHERE id = $1", id,
	).Scan(&item.ID, &item.KodeItem, &item.NamaMaterial, &item.Manufacture, &item.CreatedAt, &item.UpdatedAt)
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

func (h *MasterItemPMHandler) Create(c *gin.Context) {
	var req struct {
		KodeItem     string `json:"kodeItem" binding:"required"`
		NamaMaterial string `json:"namaMaterial" binding:"required"`
		Manufacture  string `json:"manufacture"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var exists bool
	if err := h.DB.QueryRow(
		"SELECT EXISTS(SELECT 1 FROM master_items_pm WHERE kode_item = $1 AND COALESCE(manufacture, '') = $2)",
		req.KodeItem, req.Manufacture,
	).Scan(&exists); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if exists {
		c.JSON(http.StatusConflict, gin.H{"error": "Item already exists for this manufacturer"})
		return
	}

	var newID int
	if err := h.DB.QueryRow(
		"INSERT INTO master_items_pm (kode_item, nama_material, manufacture) VALUES ($1, $2, $3) RETURNING id",
		req.KodeItem, req.NamaMaterial, req.Manufacture,
	).Scan(&newID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id": newID, "kodeItem": req.KodeItem,
		"namaMaterial": req.NamaMaterial, "manufacture": req.Manufacture,
		"message": "Created successfully",
	})
}

func (h *MasterItemPMHandler) Update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	var req struct {
		KodeItem     string `json:"kodeItem" binding:"required"`
		NamaMaterial string `json:"namaMaterial" binding:"required"`
		Manufacture  string `json:"manufacture"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.DB.Exec(
		"UPDATE master_items_pm SET kode_item=$1, nama_material=$2, manufacture=$3, updated_at=CURRENT_TIMESTAMP WHERE id=$4",
		req.KodeItem, req.NamaMaterial, req.Manufacture, id,
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

func (h *MasterItemPMHandler) Delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	result, err := h.DB.Exec("DELETE FROM master_items_pm WHERE id = $1", id)
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
