package review

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
	svc      domain.ReviewService
	uploader *upload.Uploader
}

func NewHandler(svc domain.ReviewService, uploader *upload.Uploader) *Handler {
	return &Handler{svc: svc, uploader: uploader}
}

// GET /reviews
// Query: search, site_id, dept_id, sort_by, sort_dir, page, page_size
func (h *Handler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	filter := domain.ReviewFilter{
		Search:   c.Query("search"),
		SortBy:   c.Query("sort_by"),
		SortDir:  c.Query("sort_dir"),
		Page:     page,
		PageSize: pageSize,
	}

	if v := c.Query("site_id"); v != "" {
		id, _ := strconv.ParseUint(v, 10, 64)
		uid := uint(id)
		filter.SiteID = &uid
	}
	if v := c.Query("dept_id"); v != "" {
		id, _ := strconv.ParseUint(v, 10, 64)
		uid := uint(id)
		filter.DeptID = &uid
	}

	rows, total, err := h.svc.ListPendingReviews(c.Request.Context(), filter)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}

	claims, ok := middleware.GetClaims(c)
	if !ok {
		response.Error(c.Writer, http.StatusUnauthorized, "unauthorized")
		return
	}

	for i := range rows {
		if rows[i].ReviewerID != nil && *rows[i].ReviewerID == int64(claims.UserID) {
			rows[i].IsMyReview = true
		} else {
			rows[i].IsMyReview = false
		}
	}

	summary, err := h.svc.GetReviewSummary(c.Request.Context())
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
		"summary":     summary,
	})
}

// GET /reviews/:id
func (h *Handler) GetDetail(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Error(c.Writer, http.StatusBadRequest, ID_INVALID)
		return
	}

	detail, err := h.svc.GetReviewDetail(c.Request.Context(), uint(id))
	if err != nil {
		response.Error(c.Writer, http.StatusNotFound, err.Error())
		return
	}

	response.Success(c.Writer, detail)
}

func (h *Handler) Submit(c *gin.Context) {
	userID, err := h.getReviewerID(c)
	if err != nil {
		response.Error(c.Writer, http.StatusUnauthorized, err.Error())
		return
	}

	reviewID, err := h.parseReviewID(c)
	if err != nil {
		response.Error(c.Writer, http.StatusBadRequest, err.Error())
		return
	}

	verdict, feedback, err := h.parseVerdictAndFeedback(c)
	if err != nil {
		response.Error(c.Writer, http.StatusBadRequest, err.Error())
		return
	}

	attachments, err := h.uploadReviewAttachments(c)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}

	req := domain.ReviewSubmitRequest{
		Verdict:     verdict,
		Feedback:    feedback,
		Attachments: attachments,
	}
	if err := h.svc.SubmitReview(c.Request.Context(), reviewID, userID, req); err != nil {
		response.Error(c.Writer, http.StatusBadRequest, err.Error())
		return
	}

	msg := "Perbaikan berhasil disetujui"
	if verdict == domain.ReviewReject {
		msg = "Perbaikan ditolak, PIC akan melakukan perbaikan ulang"
	}
	response.Success(c.Writer, gin.H{"message": msg})
}

func (h *Handler) getReviewerID(c *gin.Context) (uint, error) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		return 0, errors.New("unauthorized")
	}
	return claims.UserID, nil
}

func (h *Handler) parseReviewID(c *gin.Context) (uint, error) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		return 0, errors.New(ID_INVALID)
	}
	return uint(id), nil
}

func (h *Handler) parseVerdictAndFeedback(c *gin.Context) (domain.ReviewVerdict, string, error) {
	verdict := c.PostForm("verdict")
	feedback := c.PostForm("feedback")
	if verdict == "" || feedback == "" {
		return "", "", errors.New("verdict dan feedback wajib diisi")
	}
	v := domain.ReviewVerdict(verdict)
	if v != domain.ReviewApprove && v != domain.ReviewReject {
		return "", "", errors.New("verdict harus 'approve' atau 'reject'")
	}
	return v, feedback, nil
}

func (h *Handler) uploadReviewAttachments(c *gin.Context) ([]string, error) {
	form, err := c.MultipartForm()
	if err != nil {
		return nil, nil
	}
	files := form.File["attachments"]
	if len(files) == 0 {
		return nil, nil
	}

	var paths []string
	for _, fileHeader := range files {
		file, err := fileHeader.Open()
		if err != nil {
			return nil, errors.New("gagal membuka file attachment")
		}
		defer file.Close()

		path, err := h.uploader.SaveReviewAttachment(
			c.Request.Context(),
			file,
			fileHeader,
			"reviews/attachment",
		)
		if err != nil {
			return nil, errors.New("gagal upload lampiran")
		}
		paths = append(paths, path)
	}
	return paths, nil
}

func (h *Handler) Claim(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		response.Error(c.Writer, http.StatusUnauthorized, "unauthorized")
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Error(c.Writer, http.StatusBadRequest, ID_INVALID)
		return
	}

	if err := h.svc.ClaimReview(c.Request.Context(), uint(id), claims.UserID); err != nil {
		response.Error(c.Writer, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c.Writer, gin.H{"message": "Berhasil claim review"})
}

// POST /reviews/:id/cancel
func (h *Handler) CancelClaim(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		response.Error(c.Writer, http.StatusUnauthorized, "unauthorized")
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Error(c.Writer, http.StatusBadRequest, ID_INVALID)
		return
	}

	if err := h.svc.CancelClaimReview(c.Request.Context(), uint(id), claims.UserID); err != nil {
		response.Error(c.Writer, http.StatusBadRequest, err.Error())
		return
	}

	response.Success(c.Writer, gin.H{"message": "Berhasil cancel claim review"})
}

func (h *Handler) ListQSHistory(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		response.Unauthorized(c.Writer)
		return
	}
	hasRole := false
	for _, role := range claims.Roles {
		if role == "qs" {
			hasRole = true
			break
		}
	}
	if !hasRole {
		response.Error(c.Writer, http.StatusForbidden, "Hanya QS yang dapat melihat riwayat review")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	search := c.Query("search")
	var verdict *domain.ReviewVerdict
	if v := c.Query("verdict"); v != "" {
		vd := domain.ReviewVerdict(v)
		verdict = &vd
	}

	filter := domain.ReviewHistoryFilter{
		Page:     page,
		PageSize: pageSize,
		Search:   search,
		Verdict:  verdict,
	}

	rows, total, err := h.svc.ListQSHistory(c.Request.Context(), claims.UserID, filter)
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

// GET /repairs/:id/reviews
func (h *Handler) GetRepairReviews(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.Error(c.Writer, http.StatusBadRequest, "ID tidak valid")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	if pageSize < 1 {
		pageSize = 10
	}
	if pageSize > 50 {
		pageSize = 50
	}
	limit := pageSize
	offset := (page - 1) * pageSize

	reviews, total, err := h.svc.ListReviewsByRepairOrderID(c.Request.Context(), uint(id), limit, offset)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}

	var result []map[string]interface{}
	for _, rev := range reviews {
		reviewerName := ""
		if rev.ReviewerID != nil && rev.Reviewer.ID != 0 {
			reviewerName = rev.Reviewer.Name
		} else if rev.Reviewer.Name != "" {
			reviewerName = rev.Reviewer.Name
		}
		result = append(result, map[string]interface{}{
			"id":            rev.ID,
			"verdict":       rev.Verdict,
			"feedback":      rev.Feedback,
			"reviewer_name": reviewerName,
			"reviewed_at":   rev.ReviewedAt,
		})
	}

	totalPages := int(total) / pageSize
	if int(total)%pageSize != 0 {
		totalPages++
	}

	response.Success(c.Writer, gin.H{
		"data":        result,
		"total":       total,
		"page":        page,
		"page_size":   pageSize,
		"total_pages": totalPages,
	})
}

func (h *Handler) GetHistoryDetail(c *gin.Context) {
	reviewID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c.Writer, "ID tidak valid")
		return
	}

	detail, err := h.svc.GetHistoryDetail(c.Request.Context(), uint(reviewID))
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}
	if detail == nil {
		response.NotFound(c.Writer, "Riwayat review tidak ditemukan")
		return
	}

	response.Success(c.Writer, detail)
}

func (h *Handler) ExportHistoryPDF(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		response.Unauthorized(c.Writer)
		return
	}

	var verdict *domain.ReviewVerdict
	if v := c.Query("verdict"); v != "" {
		vv := domain.ReviewVerdict(v)
		verdict = &vv
	}

	filter := domain.ReviewHistoryFilter{
		Verdict: verdict,
		Search:  c.Query("search"),
	}

	data, filename, err := h.svc.ExportHistory(c.Request.Context(), claims.UserID, filter)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}

	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/pdf", data)
}
