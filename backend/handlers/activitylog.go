package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"sample-qc-backend/models"

	"github.com/gin-gonic/gin"
)

func LogActivity(db *sql.DB, name, division, action, tableName, noData, detail string) {
	_, err := db.Exec(`
		INSERT INTO activity_logs (time, name, division, action, table_name, no_data, detail)
		VALUES (NOW(), $1, $2, $3, $4, $5, $6)`,
		name, division, action, tableName, noData, detail,
	)
	if err != nil {
		fmt.Printf("⚠️  LogActivity error: %v\n", err)
	}
}

func BuildDiff(oldData, newData map[string]string) (summary string, detail string) {
	var changedFields []string
	var detailLines []string

	for key, newVal := range newData {
		oldVal := oldData[key]
		if strings.TrimSpace(oldVal) == strings.TrimSpace(newVal) {
			continue
		}
		changedFields = append(changedFields, key)
		if oldVal == "" {
			oldVal = "(kosong)"
		}
		if newVal == "" {
			newVal = "(kosong)"
		}
		detailLines = append(detailLines, fmt.Sprintf("%s: %q → %q", key, oldVal, newVal))
	}
	summary = strings.Join(changedFields, ", ")
	detail = strings.Join(detailLines, "\n")
	return
}

type ActivityLogHandler struct {
	DB *sql.DB
}

func NewActivityLogHandler(db *sql.DB) *ActivityLogHandler {
	return &ActivityLogHandler{DB: db}
}

type ActivityLogListResponse struct {
	Data []models.ActivityLog `json:"data"`
	models.PaginationMeta
}

func (h *ActivityLogHandler) GetAll(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 200 {
		limit = 50
	}

	search := strings.TrimSpace(c.Query("search"))
	action := strings.TrimSpace(c.Query("action"))
	tableName := strings.TrimSpace(c.Query("table"))

	var pattern interface{}
	if search != "" {
		pattern = "%" + search + "%"
	}
	var actionFilter interface{}
	if action != "" && action != "all" {
		actionFilter = action
	}
	var tableFilter interface{}
	if tableName != "" && tableName != "all" {
		tableFilter = tableName
	}

	const whereClause = `
		WHERE (CAST($1 AS TEXT) IS NULL OR (
			name      ILIKE CAST($1 AS TEXT) OR
			division  ILIKE CAST($1 AS TEXT) OR
			no_data   ILIKE CAST($1 AS TEXT) OR
			detail    ILIKE CAST($1 AS TEXT)
		))
		AND (CAST($2 AS TEXT) IS NULL OR action     = CAST($2 AS TEXT))
		AND (CAST($3 AS TEXT) IS NULL OR table_name = CAST($3 AS TEXT))`

	const countQuery = `SELECT COUNT(*) FROM activity_logs` + whereClause

	var total int
	if err := h.DB.QueryRow(countQuery, pattern, actionFilter, tableFilter).Scan(&total); err != nil {
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
		SELECT id, time, name, division, action, table_name, no_data, detail
		FROM   activity_logs
		` + whereClause + `
		ORDER  BY time DESC
		LIMIT  $4 OFFSET $5`
	rows, err := h.DB.Query(dataQuery, pattern, actionFilter, tableFilter, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data: " + err.Error()})
		return
	}
	defer rows.Close()

	logs := make([]models.ActivityLog, 0, limit)
	for rows.Next() {
		var entry models.ActivityLog
		var rawTime time.Time
		if err := rows.Scan(
			&entry.ID, &rawTime, &entry.Name, &entry.Division,
			&entry.Action, &entry.TableName, &entry.NoData, &entry.Detail,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca data: " + err.Error()})
			return
		}
		entry.Time = formatWIB(rawTime)
		logs = append(logs, entry)
	}
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca data: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, ActivityLogListResponse{
		Data: logs,
		PaginationMeta: models.PaginationMeta{
			Total:      total,
			Page:       page,
			PerPage:    limit,
			TotalPages: totalPages,
		},
	})
}
