package refill

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"emertrack/internal/domain"
	"emertrack/internal/middleware"
	"emertrack/pkg/response"
	"emertrack/pkg/upload"

	"github.com/gin-gonic/gin"
)

type RefillHandler struct {
	service  domain.RefillService
	uploader *upload.Uploader
}

func NewRefillHandler(svc domain.RefillService, uploader *upload.Uploader) *RefillHandler {
	return &RefillHandler{service: svc, uploader: uploader}
}

func hasRefillAccess(claims middleware.ClaimsData) bool {
	return isGA(claims) || isQS(claims)
}

func isGA(claims middleware.ClaimsData) bool {
	if hasRole(claims, "admin") {
		return true
	}
	dept := strings.ToLower(claims.DepartmentName)
	return strings.Contains(dept, "general affair") || strings.Contains(dept, "ga")
}

func isQS(claims middleware.ClaimsData) bool {
	if hasRole(claims, "admin") {
		return true
	}
	return hasRole(claims, "qs")
}

func hasRole(claims middleware.ClaimsData, role string) bool {
	for _, r := range claims.Roles {
		if strings.EqualFold(r, role) {
			return true
		}
	}
	return false
}

func (h *RefillHandler) GetAparList(c *gin.Context) {
	limit, _ := strconv.Atoi(c.Query("limit"))
	offset, _ := strconv.Atoi(c.Query("offset"))
	claims, ok := middleware.GetClaims(c)
	if !ok {
		response.Error(c.Writer, http.StatusUnauthorized, "unauthorized")
		return
	}

	if !hasRefillAccess(claims) {
		response.Error(c.Writer, http.StatusForbidden,
			"Akses ditolak. Hanya departemen GA atau role QS yang dapat mengakses data refill")
		return
	}

	params := domain.GetAparListParams{
		EDStatus: c.Query("ed_status"),
		Search:   c.Query("search"),
		Limit:    limit,
		Offset:   offset,
	}

	rows, totalAll, totalActive, totalExpired, err := h.service.ListApar(params)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError,
			fmt.Sprintf("Gagal mengambil data APAR: %s", err.Error()))
		return
	}

	response.Success(c.Writer, gin.H{
		"data":          rows,
		"total":         totalAll,
		"total_active":  totalActive,
		"total_expired": totalExpired,
		"limit":         params.Limit,
		"offset":        params.Offset,
	})
}

func (h *RefillHandler) GetAparDetail(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		response.Error(c.Writer, http.StatusUnauthorized, "unauthorized")
		return
	}

	if !hasRefillAccess(claims) {
		response.Error(c.Writer, http.StatusForbidden,
			"Akses ditolak. Hanya departemen GA atau role QS yang dapat mengakses data refill")
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Error(c.Writer, http.StatusBadRequest, "ID tidak valid")
		return
	}

	row, err := h.service.GetAparDetail(uint(id))
	if err != nil {
		response.Error(c.Writer, http.StatusNotFound, err.Error())
		return
	}

	response.Success(c.Writer, gin.H{"data": row})
}

func (h *RefillHandler) ValidateApar(c *gin.Context) {
	var req struct {
		SarprasIDs []uint `json:"sarpras_ids"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c.Writer, http.StatusBadRequest, "Invalid Request")
		return
	}

	validIDs, err := h.service.ValidateApar(req.SarprasIDs)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
	}
	response.Success(c.Writer, gin.H{
		"valid_ids": validIDs,
	})
}

func (h *RefillHandler) PostPO(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		response.Error(c.Writer, http.StatusUnauthorized, "unauthorized")
		return
	}

	if !isGA(claims) {
		response.Error(c.Writer, http.StatusForbidden,
			"Hanya departemen General Affairs yang dapat melakukan ini")
		return
	}

	var req domain.SubmitPORequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c.Writer, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.service.SubmitPO(req, claims.UserID); err != nil {
		response.Error(c.Writer, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c.Writer, gin.H{"message": "Nomor PO berhasil disubmit"})
}

func (h *RefillHandler) PostEvidence(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		response.Error(c.Writer, http.StatusUnauthorized, "unauthorized")
		return
	}

	if !isGA(claims) {
		response.Error(c.Writer, http.StatusForbidden, "Hanya departemen General Affairs yang dapat melakukan ini")
		return
	}

	form, err := c.MultipartForm()
	if err != nil {
		response.Error(c.Writer, http.StatusBadRequest, "form tidak valid atau melebihi batas 10 MB")
		return
	}

	itemIDStr := c.PostForm("item_id")
	if itemIDStr == "" {
		response.Error(c.Writer, http.StatusBadRequest, "item_id wajib diisi")
		return
	}
	itemID64, err := strconv.ParseUint(itemIDStr, 10, 64)
	if err != nil {
		response.Error(c.Writer, http.StatusBadRequest, "item_id tidak valid")
		return
	}

	newExpireDateStr := c.PostForm("new_expire_date")
	newExpireDate, err := parseFlexibleDate(newExpireDateStr)
	if err != nil || newExpireDateStr == "" {
		response.Error(c.Writer, http.StatusBadRequest, "Format new_expire_date tidak valid")
		return
	}

	updateReason := c.PostForm("update_reason")

	files := form.File["evidence[]"]
	if len(files) == 0 {
		files = form.File["evidence"]
	}

	if len(files) == 0 {
		response.Error(c.Writer, http.StatusBadRequest, "minimal satu bukti refill wajib diunggah")
		return
	}

	var photoPaths []string
	for i, header := range files {
		file, err := header.Open()
		if err != nil {
			response.Error(c.Writer, http.StatusBadRequest, fmt.Sprintf("gagal membuka file %d", i))
			return
		}

		path, err := h.uploader.SaveRepairEvidence(c.Request.Context(), file, header, "refills")
		file.Close()

		if err != nil {
			response.Error(c.Writer, http.StatusInternalServerError, "Gagal menyimpan foto: "+err.Error())
			return
		}
		photoPaths = append(photoPaths, path)
	}

	req := domain.SubmitEvidenceRequest{
		ItemID:        uint(itemID64),
		NewExpireDate: newExpireDate,
		UpdateReason:  updateReason,
		EvidencePath:  photoPaths,
	}

	if err := h.service.SubmitEvidence(req, claims.UserID); err != nil {
		response.Error(c.Writer, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c.Writer, gin.H{
		"message": "Semua bukti refill berhasil diupload, menunggu verifikasi QS",
	})
}

func (h *RefillHandler) GetVerifyDetail(c *gin.Context) {
	itemID, err := strconv.ParseUint(c.Param("item_id"), 10, 64)
	if err != nil {
		response.Error(c.Writer, http.StatusBadRequest, "ID tidak valid")
		return
	}
	detail, err := h.service.GetVerifyDetail(uint(itemID))
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}
	if detail == nil {
		response.Error(c.Writer, http.StatusNotFound, "Item tidak ditemukan atau tidak dalam status waiting_review")
		return
	}
	response.Success(c.Writer, gin.H{"data": detail})
}

func (h *RefillHandler) PostVerify(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		response.Error(c.Writer, http.StatusUnauthorized, "unauthorized")
		return
	}

	if !isQS(claims) {
		response.Error(c.Writer, http.StatusForbidden,
			"Hanya role QS yang dapat melakukan verifikasi")
		return
	}

	var req domain.VerifyRefillRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c.Writer, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.service.VerifyItem(req, claims.UserID); err != nil {
		response.Error(c.Writer, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c.Writer, gin.H{"message": "Verifikasi berhasil diupdate"})
}

func (h *RefillHandler) MarkAsUsed(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		response.Error(c.Writer, http.StatusUnauthorized, "unauthorized")
		return
	}

	if !isQS(claims) {
		response.Error(c.Writer, http.StatusForbidden,
			"Hanya role QS yang dapat menandai APAR/APAB sebagai telah digunakan")
		return
	}

	var req domain.MarkAsUsedRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c.Writer, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.service.MarkAsUsed(req, claims.UserID); err != nil {
		response.Error(c.Writer, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c.Writer, gin.H{
		"message": fmt.Sprintf("%d APAR/APAB berhasil ditandai sebagai telah digunakan dan statusnya menjadi not ready. Tim GA dapat segera membuat Refill Order.", len(req.SarprasIDs)),
	})
}

func parseFlexibleDate(s string) (time.Time, error) {
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t, nil
	}
	return time.Parse("2006-01-02", s)
}