package inspection

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"emertrack/internal/domain"
	"emertrack/internal/middleware"
	"emertrack/pkg/response"
	"emertrack/pkg/upload"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc      domain.InspectionService
	uploader *upload.Uploader
}

func NewHandler(svc domain.InspectionService, uploader *upload.Uploader) *Handler {
	return &Handler{svc: svc, uploader: uploader}
}

func (h *Handler) UploadImage(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		response.Error(c.Writer, http.StatusBadRequest, "File tidak ditemukan")
		return
	}
	defer file.Close()

	path, err := h.uploader.SaveInspectionPhoto(c.Request.Context(), file, header, "inspections")
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"photo_path": path,
		"url":        h.uploader.URL(path),
	})
}

func (h *Handler) Claim(c *gin.Context) {
	scheduleID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.Error(c.Writer, http.StatusBadRequest, "ID jadwal tidak valid")
		return
	}

	claims, ok := middleware.GetClaims(c)
	if !ok {
		response.Error(c.Writer, http.StatusUnauthorized, "unauthorized")
		return
	}

	if err := h.svc.ClaimInspection(c.Request.Context(), uint(scheduleID), claims.UserID); err != nil {
		response.Error(c.Writer, http.StatusConflict, err.Error())
		return
	}

	response.Success(c.Writer, gin.H{"message": "Berhasil mengambil tugas inspeksi"})
}

func (h *Handler) Cancel(c *gin.Context) {
	scheduleID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.Error(c.Writer, http.StatusBadRequest, "ID jadwal tidak valid")
		return
	}

	claims, ok := middleware.GetClaims(c)
	if !ok {
		response.Error(c.Writer, http.StatusUnauthorized, "unauthorized")
		return
	}

	if err := h.svc.CancelClaim(c.Request.Context(), uint(scheduleID), claims.UserID); err != nil {
		response.Error(c.Writer, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c.Writer, gin.H{"message": "Berhasil membatalkan tugas, tugas kembali terbuka"})
}

// GET /inspections/form/:sarpras_id
func (h *Handler) GetForm(c *gin.Context) {
	sarprasID, err := strconv.ParseUint(c.Param("sarpras_id"), 10, 64)
	if err != nil {
		response.Error(c.Writer, http.StatusBadRequest, "ID tidak valid")
		return
	}

	form, err := h.svc.GetInspectionForm(c.Request.Context(), uint(sarprasID))
	if err != nil {
		response.Error(c.Writer, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c.Writer, form)
}

// POST /inspections  (multipart/form-data)
func (h *Handler) Submit(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		response.Error(c.Writer, http.StatusUnauthorized, "unauthorized")
		return
	}

	if err := c.Request.ParseMultipartForm(32 << 20); err != nil {
		response.Error(c.Writer, http.StatusBadRequest, "gagal parse multipart: "+err.Error())
		return
	}

	sarprasID, _ := strconv.Atoi(c.PostForm("sarpras_id"))
	items, statusCode, err := h.extractInspectionItems(c)
	if err != nil {
		response.Error(c.Writer, statusCode, err.Error())
		return
	}

	req := domain.SubmitInspectionRequest{
		SarprasID: uint(sarprasID),
		Items:     items,
	}

	result, err := h.svc.SubmitInspection(c.Request.Context(), &req, claims.UserID)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c.Writer, result)
}

func (h *Handler) extractInspectionItems(c *gin.Context) ([]domain.SubmitItemRequest, int, error) {
	var items []domain.SubmitItemRequest

	for i := 0; ; i++ {
		paramIDStr := c.PostForm(fmt.Sprintf("items[%d][parameter_id]", i))
		if paramIDStr == "" {
			break
		}

		item, statusCode, err := h.parseSingleItem(c, i)
		if err != nil {
			return nil, statusCode, err
		}

		items = append(items, item)
	}

	if len(items) == 0 {
		return nil, http.StatusBadRequest, errors.New("minimal satu parameter harus diisi")
	}

	return items, http.StatusOK, nil
}

func (h *Handler) parseSingleItem(c *gin.Context, index int) (domain.SubmitItemRequest, int, error) {
	paramID, err := strconv.ParseUint(c.PostForm(fmt.Sprintf("items[%d][parameter_id]", index)), 10, 64)
	if err != nil {
		return domain.SubmitItemRequest{}, http.StatusBadRequest, fmt.Errorf("parameter_id tidak valid pada index %d", index)
	}

	statusStr := c.PostForm(fmt.Sprintf("items[%d][status]", index))
	if statusStr != "OK" && statusStr != "NOK" {
		return domain.SubmitItemRequest{}, http.StatusBadRequest, fmt.Errorf("status harus OK atau NOK pada index %d", index)
	}

	notes := c.PostForm(fmt.Sprintf("items[%d][notes]", index))
	status := domain.InspectionResult(statusStr)
	if status == domain.ResultNOK && notes == "" {
		return domain.SubmitItemRequest{}, http.StatusBadRequest, fmt.Errorf("keterangan NOK wajib diisi pada index %d", index)
	}

	fileKey := fmt.Sprintf("items[%d][photo]", index)
	file, header, err := c.Request.FormFile(fileKey)
	if err != nil {
		return domain.SubmitItemRequest{}, http.StatusBadRequest, fmt.Errorf("foto wajib diunggah untuk parameter index %d: %s", index, err.Error())
	}
	defer file.Close()

	photoPath, err := h.uploader.SaveInspectionPhoto(c.Request.Context(), file, header, "inspections")
	if err != nil {
		return domain.SubmitItemRequest{}, http.StatusInternalServerError, fmt.Errorf("gagal menyimpan foto: %w", err)
	}

	item := domain.SubmitItemRequest{
		ParameterID: uint(paramID),
		Status:      status,
		Notes:       notes,
		PhotoPath:   photoPath,
	}

	return item, http.StatusOK, nil
}

// GET /inspections
func (h *Handler) ListActive(c *gin.Context) {
	filter, page, pageSize := h.parseFilter(c)

	rows, total, err := h.svc.ListActiveTasks(c.Request.Context(), filter)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}

	h.renderPaginationResponse(c, rows, total, page, pageSize)
}

func (h *Handler) ListHistory(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		response.Unauthorized(c.Writer)
		return
	}
	userID := claims.UserID

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	search := c.Query("search")

	var sarprasID *uint
	if v := c.Query("sarpras_id"); v != "" {
		id, _ := strconv.ParseUint(v, 10, 64)
		uid := uint(id)
		sarprasID = &uid
	}

	filter := domain.InspectionHistoryFilter{
		SarprasID: sarprasID,
		CheckerID: &userID,
		Search:    search,
		Page:      page,
		PageSize:  pageSize,
	}

	rows, total, err := h.svc.ListHistory(c.Request.Context(), filter)
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

// Monitoring inspection for QS
func (h *Handler) ListMonitoring(c *gin.Context) {
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

	filter := domain.InspectionMonitoringFilter{
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

// GET /inspections/:id
func (h *Handler) GetDetail(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Error(c.Writer, http.StatusBadRequest, "ID tidak valid")
		return
	}

	insp, err := h.svc.GetInspectionDetail(c.Request.Context(), uint(id))
	if err != nil {
		response.Error(c.Writer, http.StatusNotFound, "Inspection tidak ditemukan")
		return
	}

	response.Success(c.Writer, insp)
}

func (h *Handler) parseFilter(c *gin.Context) (domain.InspectionFilter, int, int) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	search := c.Query("search")

	filter := domain.InspectionFilter{
		Search:   search,
		Page:     page,
		PageSize: pageSize,
		UserID:   c.MustGet("user_id").(uint),
	}

	if v := c.Query("sarpras_id"); v != "" {
		id, _ := strconv.ParseUint(v, 10, 64)
		uid := uint(id)
		filter.SarprasID = &uid
	}

	return filter, page, pageSize
}

func (h *Handler) renderPaginationResponse(c *gin.Context, rows interface{}, total int64, page, pageSize int) {
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