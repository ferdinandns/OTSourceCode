package dashboard

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"emertrack/internal/domain"
)

type Handler struct {
	svc domain.DashboardService
}

func NewHandler(svc domain.DashboardService) *Handler {
	return &Handler{svc}
}

func (h *Handler) GetSummary(c *gin.Context) {
	deptID, _ := strconv.Atoi(c.Query("dept_id"))
	typeID, _ := strconv.Atoi(c.Query("type_id"))
	year, _ := strconv.Atoi(c.Query("year")) 

	filter := domain.TableFilter{
		Status: c.Query("status"),
		Period: c.Query("period"),
		DeptId: deptID,
		TypeId: typeID,
		Search: c.Query("search"),
		Year:   year,
	}

	data, err := h.svc.GetDashboardData(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat data dashboard"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Data dashboard berhasil dimuat",
		"data":    data,
	})
}

func (h *Handler) GetTable(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	deptID, _ := strconv.Atoi(c.Query("dept_id"))
	typeID, _ := strconv.Atoi(c.Query("type_id"))

	filter := domain.TableFilter{
		Page:      page,
		PageSize:  pageSize,
		Status:    c.Query("status"),
		Period:    c.Query("period"),
		DeptId:    deptID,
		TypeId:    typeID,
		Search:    c.Query("search"),
		SortBy:    c.Query("sort_by"),
		SortOrder: c.Query("sort_order"),
	}

	data, total, err := h.svc.ListDashboardTable(c.Request.Context(), filter)
	if err != nil {
		fmt.Println("[dashboard] GetTable error:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   data,
		"meta": gin.H{
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		},
	})
}