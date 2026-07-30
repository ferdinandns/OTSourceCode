package handlers

import (
	"database/sql"
	"log"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	_ "time/tzdata"

	"sample-qc-backend/models"

	"github.com/gin-gonic/gin"
)

type RecycleBinHandler struct {
	DB *sql.DB
}

func NewRecycleBinHandler(db *sql.DB) *RecycleBinHandler {
	return &RecycleBinHandler{DB: db}
}

type RecycleBinItem struct {
	ID           int    `json:"id"`
	Type         string `json:"type"`
	NomorDoc     string `json:"nomorDoc"`
	KodeItem     string `json:"kodeItem"`
	NamaMaterial string `json:"namaMaterial"`
	Manufacture  string `json:"manufacture"`
	DeletedAt    string `json:"deletedAt"`
	DeletedBy    string `json:"deletedBy"`
	SisaHari     int    `json:"sisaHari"`
}

type RecycleBinListResponse struct {
	Data []RecycleBinItem `json:"data"`
	models.PaginationMeta
}

func (h *RecycleBinHandler) GetAll(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 200 {
		limit = 50
	}

	search := strings.TrimSpace(c.Query("search"))
	var pattern interface{}
	if search != "" {
		pattern = "%" + search + "%"
	}

	const whereClause = `
		WHERE (CAST($1 AS TEXT) IS NULL OR (
			nomor_doc     ILIKE CAST($1 AS TEXT) OR
			kode_item     ILIKE CAST($1 AS TEXT) OR
			nama_material ILIKE CAST($1 AS TEXT) OR
			manufacture   ILIKE CAST($1 AS TEXT) OR
			deleted_by    ILIKE CAST($1 AS TEXT)
		))`

	const countQuery = `
		SELECT COUNT(*)
		FROM (
			SELECT id, nomor_rm AS nomor_doc, kode_item, nama_material,
			       manufacture, deleted_at, deleted_by, 'RM' AS doc_type
			FROM   diversifikasi_rm
			WHERE  deleted_at IS NOT NULL

			UNION ALL

			SELECT id, nomor_pm AS nomor_doc, kode_item, nama_material,
			       manufacture, deleted_at, deleted_by, 'PM' AS doc_type
			FROM   diversifikasi_pm
			WHERE  deleted_at IS NOT NULL
		) sub` + whereClause

	var total int
	if err := h.DB.QueryRow(countQuery, pattern).Scan(&total); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghitung total data: " + err.Error()})
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
		SELECT id, nomor_doc, kode_item, nama_material,
		       manufacture, deleted_at, deleted_by, doc_type
		FROM (
			SELECT id, nomor_rm AS nomor_doc, kode_item, nama_material,
			       manufacture, deleted_at, deleted_by, 'RM' AS doc_type
			FROM   diversifikasi_rm
			WHERE  deleted_at IS NOT NULL

			UNION ALL

			SELECT id, nomor_pm AS nomor_doc, kode_item, nama_material,
			       manufacture, deleted_at, deleted_by, 'PM' AS doc_type
			FROM   diversifikasi_pm
			WHERE  deleted_at IS NOT NULL
		) sub` + whereClause + `
		ORDER  BY deleted_at DESC
		LIMIT  $2 OFFSET $3`

	rows, err := h.DB.Query(dataQuery, pattern, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data: " + err.Error()})
		return
	}
	defer rows.Close()

	todayWIB := todayWIB()

	items := make([]RecycleBinItem, 0, limit)

	for rows.Next() {
		var item RecycleBinItem
		var deletedBy sql.NullString
		var deletedAtRaw time.Time

		if err := rows.Scan(
			&item.ID, &item.NomorDoc, &item.KodeItem, &item.NamaMaterial,
			&item.Manufacture, &deletedAtRaw, &deletedBy, &item.Type,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca data: " + err.Error()})
			return
		}

		item.DeletedBy = deletedBy.String
		item.DeletedAt = formatWIB(deletedAtRaw)

		deletedDay := startOfDayWIB(deletedAtRaw)
		expiredDay := deletedDay.AddDate(0, 0, 29)
		sisaHari := int(math.Ceil(expiredDay.Sub(todayWIB).Hours()/24)) + 1
		if sisaHari < 0 {
			sisaHari = 0
		}
		item.SisaHari = sisaHari

		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca data: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, RecycleBinListResponse{
		Data: items,
		PaginationMeta: models.PaginationMeta{
			Total:      total,
			Page:       page,
			PerPage:    limit,
			TotalPages: totalPages,
		},
	})
}

func (h *RecycleBinHandler) Restore(c *gin.Context) {
	docType := c.Param("type")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var table string
	switch docType {
	case "rm":
		table = "diversifikasi_rm"
	case "pm":
		table = "diversifikasi_pm"
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Type tidak valid, gunakan 'rm' atau 'pm'"})
		return
	}

	result, err := h.DB.Exec(
		`UPDATE `+table+` SET deleted_at = NULL, deleted_by = NULL WHERE id = $1 AND deleted_at IS NOT NULL`,
		id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan di recycle bin"})
		return
	}

	var nomorDoc, tableName string
	switch docType {
	case "rm":
		h.DB.QueryRow(`SELECT nomor_rm FROM diversifikasi_rm WHERE id = $1`, id).Scan(&nomorDoc)
		tableName = "Diversifikasi RM"
	case "pm":
		h.DB.QueryRow(`SELECT nomor_pm FROM diversifikasi_pm WHERE id = $1`, id).Scan(&nomorDoc)
		tableName = "Diversifikasi PM"
	}

	LogActivity(h.DB, c.GetString("userName"), c.GetString("userDivision"),
		"restore", tableName, nomorDoc, "Memulihkan dari Recycle Bin")

	c.JSON(http.StatusOK, gin.H{"message": "Data berhasil dipulihkan"})
}

func (h *RecycleBinHandler) ForceDelete(c *gin.Context) {
	docType := c.Param("type")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var table, produkTable, fkCol string
	switch docType {
	case "rm":
		table = "diversifikasi_rm"
		produkTable = "diversifikasi_produk"
		fkCol = "diversifikasi_rm_id"
	case "pm":
		table = "diversifikasi_pm"
		produkTable = "diversifikasi_produk_pm"
		fkCol = "diversifikasi_pm_id"
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Type tidak valid"})
		return
	}

	tx, err := h.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer tx.Rollback()

	if _, err = tx.Exec(`DELETE FROM `+produkTable+` WHERE `+fkCol+` = $1`, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	result, err := tx.Exec(
		`DELETE FROM `+table+` WHERE id = $1 AND deleted_at IS NOT NULL`, id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan di recycle bin"})
		return
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Data dihapus permanen"})
}

func StartAutoCleanup(db *sql.DB) {
	go func() {
		log.Println("Auto cleanup recycle bin started (interval: 1 jam)")
		for {
			cleanupExpired(db)
			time.Sleep(1 * time.Hour)
		}
	}()
}

func cleanupExpired(db *sql.DB) {
	expiredBefore := todayWIB().AddDate(0, 0, -29)

	type cleanupStep struct {
		label string
		sql   string
	}

	steps := []cleanupStep{
		{
			"produk RM",
			`DELETE FROM diversifikasi_produk
			 WHERE diversifikasi_rm_id IN (
			   SELECT id FROM diversifikasi_rm
			   WHERE deleted_at IS NOT NULL AND deleted_at < $1
			 )`,
		},
		{
			"RM",
			`DELETE FROM diversifikasi_rm WHERE deleted_at IS NOT NULL AND deleted_at < $1`,
		},
		{
			"produk PM",
			`DELETE FROM diversifikasi_produk_pm
			 WHERE diversifikasi_pm_id IN (
			   SELECT id FROM diversifikasi_pm
			   WHERE deleted_at IS NOT NULL AND deleted_at < $1
			 )`,
		},
		{
			"PM",
			`DELETE FROM diversifikasi_pm WHERE deleted_at IS NOT NULL AND deleted_at < $1`,
		},
	}

	for _, s := range steps {
		res, err := db.Exec(s.sql, expiredBefore)
		if err != nil {
			log.Printf("Cleanup %s error: %v", s.label, err)
			continue
		}
		if n, _ := res.RowsAffected(); n > 0 {
			log.Printf("Auto cleanup: %d data %s dihapus permanen", n, s.label)
		}
	}
}
