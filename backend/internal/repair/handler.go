package repair

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"emertrack/internal/domain"
	"emertrack/internal/middleware"
	"emertrack/pkg/response"
	"emertrack/pkg/upload"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc      domain.RepairService
	uploader *upload.Uploader
}

const id_invalid = "ID Tidak Valid"

func NewHandler(svc domain.RepairService, uploader *upload.Uploader) *Handler {
	return &Handler{svc: svc, uploader: uploader}
}

// GET /repairs
func (h *Handler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	search := c.Query("search")

	filter := domain.RepairFilter{
		Search:   search,
		Page:     page,
		PageSize: pageSize,
	}

	if v := c.Query("sarpras_id"); v != "" {
		id, _ := strconv.ParseUint(v, 10, 64)
		uid := uint(id)
		filter.SarprasID = &uid
	}
	if v := c.Query("status"); v != "" {
		s := domain.RepairStatus(v)
		filter.Status = &s
	}

	// PIC can only see their own repairs
	claims, ok := middleware.GetClaims(c)
	if ok {
		for _, role := range claims.Roles {
			if role == string(domain.RolePICResponsibility) {
				uid := claims.UserID
				filter.PICID = &uid
				break
			}
		}
	}

	rows, total, err := h.svc.ListRepairs(c.Request.Context(), filter)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}

	totalPages := int(total) / pageSize
	if int(total)%pageSize != 0 {
		totalPages++
	}

	response.Success(c.Writer, gin.H{
		"data":        rows,
		"total":       total,
		"page":        page,
		"page_size":   pageSize,
		"total_pages": totalPages,
	})
}

// GET /repairs/:id
func (h *Handler) GetDetail(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Error(c.Writer, http.StatusBadRequest, "ID tidak valid")
		return
	}

	detail, err := h.svc.GetRepairDetail(c.Request.Context(), uint(id))
	if err != nil {
		response.Error(c.Writer, http.StatusNotFound, err.Error())
		return
	}

	response.Success(c.Writer, detail)
}

func (h *Handler) FillActionPlan(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		response.Error(c.Writer, http.StatusUnauthorized, "unauthorized")
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Error(c.Writer, http.StatusBadRequest, id_invalid)
		return
	}

	var body struct {
		ActionPlan string    `json:"action_plan" binding:"required"`
		DueDate    time.Time `json:"due_date" binding:"required"`
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		response.Error(c.Writer, http.StatusBadRequest, "action_plan dan due_date wajib diisi dengan format yang benar")
		return
	}

	if err := h.svc.FillActionPlan(c.Request.Context(), uint(id), claims.UserID, body.ActionPlan, body.DueDate); err != nil {
		response.Error(c.Writer, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c.Writer, gin.H{"message": "Action plan berhasil disimpan"})
}

// POST /repairs/:id/evidence  (multipart/form-data, field: photos[])
func (h *Handler) SubmitEvidence(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		response.Error(c.Writer, http.StatusUnauthorized, "unauthorized")
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Error(c.Writer, http.StatusBadRequest, id_invalid)
		return
	}

	form, err := c.MultipartForm()
	if err != nil {
		response.Error(c.Writer, http.StatusBadRequest, "form tidak valid")
		return
	}

	files := form.File["photos[]"]
	if len(files) == 0 {
		// Try without brackets
		files = form.File["photos"]
	}
	if len(files) == 0 {
		response.Error(c.Writer, http.StatusBadRequest, "minimal satu foto bukti wajib diunggah")
		return
	}

	var photoPaths []string
	for i, header := range files {
		file, err := header.Open()
		if err != nil {
			response.Error(c.Writer, http.StatusBadRequest, fmt.Sprintf("gagal membuka file %d", i))
			return
		}
		path, err := h.uploader.SaveRepairEvidence(c.Request.Context(), file, header, "repairs")
		file.Close()
		if err != nil {
			response.Error(c.Writer, http.StatusInternalServerError, "Gagal menyimpan foto: "+err.Error())
			return
		}
		photoPaths = append(photoPaths, path)
	}

	notes := c.PostForm("notes")

	if err := h.svc.SubmitEvidence(c.Request.Context(), uint(id), claims.UserID, photoPaths, notes); err != nil {
		response.Error(c.Writer, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c.Writer, gin.H{"message": "Bukti perbaikan berhasil diupload"})
}

func (h *Handler) ListPICHistory(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		response.Unauthorized(c.Writer)
		return
	}

	hasRole := false
	for _, role := range claims.Roles {
		if role == "pic_responsibility" {
			hasRole = true
			break
		}
	}
	if !hasRole {
		response.Error(c.Writer, http.StatusForbidden, "Hanya PIC yang dapat melihat riwayat perbaikan")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	search := c.Query("search")
	var status *domain.RepairStatus
	if s := c.Query("status"); s != "" {
		st := domain.RepairStatus(s)
		status = &st
	}

	filter := domain.RepairHistoryFilter{
		Page:     page,
		PageSize: pageSize,
		Search:   search,
		Status:   status,
	}

	rows, total, err := h.svc.ListPICHistory(c.Request.Context(), claims.UserID, filter)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}

	totalPages := int(total) / pageSize
	if int(total)%pageSize != 0 {
		totalPages++
	}

	response.Success(c.Writer, gin.H{
		"data":        rows,
		"total":       total,
		"page":        page,
		"page_size":   pageSize,
		"total_pages": totalPages,
	})
}

// GET /repairs/monitoring
func (h *Handler) ListMonitoring(c *gin.Context) {
	// Only QS may access
	claims, ok := middleware.GetClaims(c)
	if !ok {
		response.Unauthorized(c.Writer)
		return
	}
	hasQS := false
	for _, role := range claims.Roles {
		if role == "qs" {
			hasQS = true
			break
		}
	}
	if !hasQS {
		response.Error(c.Writer, http.StatusForbidden, "Hanya QS yang dapat mengakses monitoring repair")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	search := c.Query("search")

	var departmentID *uint
	deptParam := c.Query("department_id")
	if deptParam == "all" || deptParam == "0" {
		zero := uint(0)
		departmentID = &zero
	} else if deptParam != "" {
		id, err := strconv.ParseUint(deptParam, 10, 64)
		if err == nil {
			uid := uint(id)
			departmentID = &uid
		}
	}

	filter := domain.RepairMonitoringFilter{
		DepartmentID: departmentID,
		Search:       search,
		Page:         page,
		PageSize:     pageSize,
	}

	rows, total, err := h.svc.ListMonitoring(c.Request.Context(), filter)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}

	totalPages := int(total) / pageSize
	if int(total)%pageSize != 0 {
		totalPages++
	}

	response.Success(c.Writer, gin.H{
		"data":        rows,
		"total":       total,
		"page":        page,
		"page_size":   pageSize,
		"total_pages": totalPages,
	})
}

func (h *Handler) ListAllHistory(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	var deptID *uint
	if dept := c.Query("department_id"); dept != "" {
		id, err := strconv.ParseUint(dept, 10, 32)
		if err == nil {
			uid := uint(id)
			deptID = &uid
		}
	}

	filter := domain.RepairAllHistoryFilter{
		DepartmentID: deptID,
		Search:       c.Query("search"),
		Page:         page,
		PageSize:     pageSize,
	}

	data, total, err := h.svc.ListAllHistory(c.Request.Context(), filter)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c.Writer, gin.H{
		"data":      data,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}