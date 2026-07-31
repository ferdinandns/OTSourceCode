package sarpras

import (
	"fmt"
	"net/http"
	"strconv"

	"emertrack/internal/domain"
	"emertrack/internal/dto"
	"emertrack/pkg/response"

	"github.com/gin-gonic/gin"
)

const content_disposition = "Content-Disposition"
const application_vnc = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
const invalid_format = "Format payload tidak valid: "

type Handler struct {
	service domain.SarprasService
}

func NewHandler(service domain.SarprasService) *Handler {
	return &Handler{service: service}
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

func validate(c *gin.Context, payload any) bool {
	if err := c.ShouldBindJSON(payload); err != nil {
		if response.ValidationError(c.Writer, err) {
			return true
		}
		response.BadRequest(c.Writer, "Format data tidak valid")
		return true
	}
	return false
}

// ─── Sarpras Type ─────────────────────────────────────────────────────────────

func (h *Handler) RequestCreateSarprasType(c *gin.Context) {
	var payload dto.CreateSarprasTypeRequest
	if validate(c, &payload) {
		return
	}
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c.Writer)
		return
	}
	_, err = h.service.RequestCreateSarprasType(c.Request.Context(), userID, ToSarprasTypeDomain(&payload), payload.Notes)
	if err != nil {
		if response.FieldValidationError(c.Writer, err) {
			return
		}
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}
	response.SuccessMessage(c.Writer, "Berhail Request Penambahan Jenis Sarpras")
}

func (h *Handler) RequestEditSarprasType(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c.Writer, INVALID_ID)
		return
	}
	var payload dto.UpdateSarprasTypeRequest
	if validate(c, &payload) {
		return
	}
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c.Writer)
		return
	}
	_, err = h.service.RequestEditSarprasType(c.Request.Context(), userID, uint(id), ToUpdateSarprasTypeDomain(&payload), payload.Notes)
	if err != nil {
		if response.FieldValidationError(c.Writer, err) {
			
		}
	}
	response.SuccessMessage(c.Writer, "Berhail Request Pengubahan Data Jenis Sarpras")
}

func (h *Handler) RequestDeleteSarprasType(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c.Writer, INVALID_ID)
		return
	}
	var payload dto.DeleteRequest
	if validate(c, &payload) {
		return
	}
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c.Writer)
		return
	}
	_, err = h.service.RequestDeleteSarprasType(c.Request.Context(), userID, uint(id), payload.Notes)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}
	response.SuccessMessage(c.Writer, "Successfully Request Delete Data")
}

func (h *Handler) GetSarprasTypeDetail(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.Error(c.Writer, http.StatusBadRequest, "Invalid ID format")
		return
	}

	resultDomain, err := h.service.GetSarprasTypeDetail(c.Request.Context(), uint(id))
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}

	var parametersDTO []dto.ParameterResponse
	for _, p := range resultDomain.Parameters {
		parametersDTO = append(parametersDTO, dto.ParameterResponse{
			ID:      p.ID,
			Name:    p.Name,
			Desc:    p.Desc,
			OrderNo: p.OrderNo,
		})
	}

	// ── CHANGED: InspInterval → InspIntervalMonths ──
	responseDTO := dto.SarprasTypeDetailResponse{
		ID:                 resultDomain.ID,
		Code:               resultDomain.Code,
		SarprasName:        resultDomain.SarprasName,
		PICDepartment:      resultDomain.PICDepartment,
		InspIntervalMonths: resultDomain.InspIntervalMonths,
		Parameters:         parametersDTO,
	}

	response.Success(c.Writer, responseDTO)
}

func (h *Handler) ListSarprasTypes(c *gin.Context) {
	filter := make(map[string]interface{})
	if search := c.Query("search"); search != "" {
		filter["search"] = search
	}
	rows, err := h.service.ListSarprasTypes(c.Request.Context(), filter)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}
	responses := make([]dto.SarprasTypeResponse, len(rows))
	for i, row := range rows {
		responses[i] = ToSarprasTypeResponse(row)
	}
	response.Success(c.Writer, responses)
}

// ─── Sarpras ──────────────────────────────────────────────────────────────────

func (h *Handler) RequestCreateSarpras(c *gin.Context) {
	var payload dto.CreateSarprasRequest
	if validate(c, &payload) {
		return
	}
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c.Writer)
		return
	}
	result, err := h.service.RequestCreateSarpras(c.Request.Context(), userID, ToSarprasDomain(&payload), payload.Notes)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}
	response.Created(c.Writer, result)
}

func (h *Handler) RequestEditSarpras(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c.Writer, INVALID_ID)
		return
	}
	var payload dto.EditSarprasRequest
	if validate(c, &payload) {
		return
	}
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c.Writer)
		return
	}
	reqDomain := &domain.Sarpras{LocationDetail: payload.LocationDetail}
	result, err := h.service.RequestEditSarpras(c.Request.Context(), userID, uint(id), reqDomain, payload.Notes)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c.Writer, result)
}

func (h *Handler) RequestDeleteSarpras(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c.Writer, "ID tidak valid")
		return
	}
	var payload dto.DeleteRequest
	if validate(c, &payload) {
		return
	}
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c.Writer)
		return
	}
	result, err := h.service.RequestDeleteSarpras(c.Request.Context(), userID, uint(id), payload.Notes)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c.Writer, result)
}

func (h *Handler) GetSarpras(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c.Writer, INVALID_ID)
		return
	}
	result, err := h.service.GetSarpras(c.Request.Context(), uint(id))
	if err != nil {
		response.NotFound(c.Writer, "Data tidak ditemukan")
		return
	}
	response.Success(c.Writer, result)
}

func (h *Handler) GetDetail(c *gin.Context) {
	code := c.Param("code")
	if code == "" {
		response.BadRequest(c.Writer, "Code tidak boleh kosong")
		return
	}
	result, err := h.service.GetSarprasDetail(c.Request.Context(), code)
	if err != nil {
		response.Error(c.Writer, http.StatusNotFound, DATA_NOT_FOUND)
		return
	}
	response.Success(c.Writer, result)
}

func (h *Handler) ListSarpras(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	// Validasi limit
	if limit < 1 {
		limit = 10
	}
	if limit > 100 {
		limit = 100
	}

	var locationDeptID *uint
	if v := c.Query("location_dept_id"); v != "" {
		if id, err := strconv.ParseUint(v, 10, 64); err == nil {
			temp := uint(id)
			locationDeptID = &temp
		}
	}

	var sarprasTypeID *uint
	if v := c.Query("sarpras_type_id"); v != "" {
		if id, err := strconv.ParseUint(v, 10, 64); err == nil {
			temp := uint(id)
			sarprasTypeID = &temp
		}
	}

	sortBy := c.DefaultQuery("sort_by", "")
	sortOrder := c.DefaultQuery("sort_order", "ASC")

	filter := domain.SarprasFilter{
		Search:         c.Query("search"),
		LocationDeptID: locationDeptID,
		SarprasTypeID:  sarprasTypeID,
		Limit:          limit,
		Offset:         offset,
		SortBy:         sortBy,
		SortOrder:      sortOrder,
	}

	rows, total, err := h.service.ListSarpras(c.Request.Context(), filter)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c.Writer, map[string]interface{}{
		"items": rows,
		"meta": map[string]interface{}{
			"total":  total,
			"limit":  limit,
			"offset": offset,
			"page":   offset/limit + 1,
		},
	})
}

func (h *Handler) GetByQRCode(c *gin.Context) {
	code := c.Param("code")
	result, err := h.service.GetByQRCode(c.Request.Context(), code)
	if err != nil {
		response.NotFound(c.Writer, DATA_NOT_FOUND)
		return
	}
	response.Success(c.Writer, result)
}

func (h *Handler) GenerateQRCode(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c.Writer, INVALID_ID)
		return
	}
	result, err := h.service.GenerateQRCode(c.Request.Context(), uint(id))
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}
	c.Data(http.StatusOK, "image/png", result)
}

func (h *Handler) ExportPDF(c *gin.Context) {
	var req domain.ExportSarprasPDFRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Parameter filter tidak valid", "error": err.Error()})
		return
	}

	// Baca parameter sorting dari query string
	req.SortBy = c.DefaultQuery("sort_by", "")
	req.SortOrder = c.DefaultQuery("sort_order", "ASC")

	userID, err := getUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": err.Error()})
		return
	}

	pdfBytes, err := h.service.ExportPDF(c.Request.Context(), userID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": err.Error()})
		return
	}

	c.Header(content_disposition, "attachment; filename=laporan-sarpras.pdf")
	c.Data(http.StatusOK, "application/pdf", pdfBytes)
}

func (h *Handler) CheckEligibility(c *gin.Context) {
	code := c.Param("code")
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c.Writer)
		return
	}
	result, err := h.service.CheckEligibility(c.Request.Context(), userID, code)
	if err != nil {
		response.NotFound(c.Writer, DATA_NOT_FOUND)
		return
	}
	response.Success(c.Writer, result)
}

func (h *Handler) BulkImportParse(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		response.BadRequest(c.Writer, "File tidak ditemukan")
		return
	}
	defer file.Close()

	if header.Size > 10<<20 {
		response.BadRequest(c.Writer, "Ukuran file maksimum 10 MB")
	}

	res, err := h.service.BulkImportParse(c.Request.Context(), file, header)
	if err != nil {
		response.Error(c.Writer, http.StatusUnprocessableEntity, err.Error())
		return
	}

	response.Success(c.Writer, res)
}

func (h *Handler) BulkImportExportErrors(c *gin.Context) {
	var req struct {
		Rows []domain.BulkParseRow `json:"rows" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c.Writer, invalid_format+err.Error())
		return
	}

	buf, err := GenerateErrorReport(req.Rows)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, "Gagal generate file: "+err.Error())
		return
	}

	c.Header(content_disposition, `attachment; filename="sarpras_import_errors.xlsx"`)
	c.Header("Content-Type", application_vnc)
	c.Header("Cache-Control", "no-cache")
	c.Data(http.StatusOK, application_vnc, buf)
}

func (h *Handler) BulkImportValidate(c *gin.Context) {
	var req domain.BulkExecuteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c.Writer, invalid_format+err.Error())
		return
	}
	res, err := h.service.BulkImportValidate(c.Request.Context(), req)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c.Writer, res)
}

func (h *Handler) BulkImportExecute(c *gin.Context) {
	var req domain.BulkExecuteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c.Writer, invalid_format+err.Error())
		return
	}
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c.Writer)
		return
	}
	res, err := h.service.RequestCreateSarprasImport(c.Request.Context(), userID, req, req.Notes)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c.Writer, res)
}

func (h *Handler) DownloadTemplateExcel(c *gin.Context) {
	ctx := c.Request.Context()

	typeRows, deptRows, err := h.service.GetTemplateMetadata(ctx)
	if err != nil {
		response.BadRequest(c.Writer, "Gagal ambil data master: "+err.Error())
		return
	}

	buf, err := GenerateImportTemplate(typeRows, deptRows)
	if err != nil {
		response.BadRequest(c.Writer, "Gagal generate template: "+err.Error())
		return
	}

	c.Header(content_disposition, `attachment; filename="template_import_sarpras.xlsx"`)
	c.Header("Content-Type", application_vnc)
	c.Header("Cache-Control", "no-cache")
	c.Data(http.StatusOK, application_vnc, buf)
}

func (h *Handler) TriggerExpireApbr(c *gin.Context) {
	err := h.service.UpdateStatusExpiry(c.Request.Context())
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(
		c.Writer,
		gin.H{
			"message":"Trigger expire APAR dan APAB berhasil dilakukan.",

		},
	)
}

