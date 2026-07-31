package master

import (
	"fmt"
	"net/http"
	"strconv"

	"emertrack/internal/domain"
	"emertrack/internal/dto"
	"emertrack/pkg/response"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service domain.MasterService
}

func NewHandler(s domain.MasterService) *Handler {
	return &Handler{service: s}
}

func getUserID(c *gin.Context) (uint, error) {
	idRaw, exists := c.Get("user_id")
	if !exists {
		return 0, fmt.Errorf("unauthorized: user_id not found in context")
	}

	// Dynamically check the type because user_id may come from JWT as different numeric types.
	switch v := idRaw.(type) {
	case uint:
		return v, nil
	case uint64:
		return uint(v), nil
	case int:
		return uint(v), nil
	case float64:
		// This case occurs when user_id comes from a particular JWT library.
		return uint(v), nil
	default:
		return 0, fmt.Errorf("unauthorized: invalid user_id type")
	}
}

// --- SITES ---

func (h *Handler) RequestCreateSite(c *gin.Context) {
	var req dto.CreateSiteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c.Writer, err.Error())
		return
	}

	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c.Writer)
		return
	}

	site := &domain.Site{
		Code: req.Code,
		Name: req.Name,
	}

	res, err := h.service.RequestCreateSite(c.Request.Context(), userID, site)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}
	response.Created(c.Writer, res)
}

func (h *Handler) RequestEditSite(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)

	// Use a dedicated Update DTO to restrict editable fields.
	var req dto.UpdateSiteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c.Writer, err.Error())
		return
	}

	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c.Writer)
		return
	}

	site := &domain.Site{
		Name: req.Name,
	}

	res, err := h.service.RequestEditSite(c.Request.Context(), userID, uint(id), site)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c.Writer, res)
}

func (h *Handler) RequestDeleteSite(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c.Writer)
		return
	}

	res, err := h.service.RequestDeleteSite(c.Request.Context(), userID, uint(id))
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c.Writer, res)
}

func (h *Handler) ListSites(c *gin.Context) {
	filter := make(map[string]interface{})
	if s := c.Query("search"); s != "" {
		filter["search"] = s
	}

	rows, err := h.service.ListSites(c.Request.Context(), filter)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}

	var res []dto.SiteResponse
	for _, d := range rows {
		res = append(res, dto.SiteResponse{
			ID:        d.ID,
			Code:      d.Code,
			Name:      d.Name,
			CreatedAt: d.CreatedAt.Format("2006-01-02 15:04:05"),
		})
	}

	if res == nil {
		res = []dto.SiteResponse{}
	}
	response.Success(c.Writer, res)
}

// --- DEPARTMENTS ---

func (h *Handler) RequestCreateDepartment(c *gin.Context) {
	var req dto.CreateDepartmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c.Writer, err.Error())
		return
	}

	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c.Writer)
		return
	}

	dept := &domain.Department{
		Code:   req.Code,
		Name:   req.Name,
		IsQs:   req.IsQs,
		SiteID: req.SiteID,
	}

	res, err := h.service.RequestCreateDepartment(c.Request.Context(), userID, dept, req.Notes)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}
	response.Created(c.Writer, res)
}

func (h *Handler) RequestEditDepartment(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)

	// Use a dedicated Update DTO to restrict editable fields.
	var req dto.UpdateDepartmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c.Writer, err.Error())
		return
	}

	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c.Writer)
		return
	}

	dept := &domain.Department{
		Name:   req.Name,
		SiteID: req.SiteID,
	}

	res, err := h.service.RequestEditDepartment(c.Request.Context(), userID, uint(id), dept, req.Notes)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c.Writer, res)
}

func (h *Handler) RequestDeleteDepartment(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c.Writer)
		return
	}

	res, err := h.service.RequestDeleteDepartment(c.Request.Context(), userID, uint(id))
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c.Writer, res)
}

func (h *Handler) ListDepartments(c *gin.Context) {
	filter := make(map[string]interface{})
	if s := c.Query("search"); s != "" {
		filter["search"] = s
	}

	rows, err := h.service.ListDepartments(c.Request.Context(), filter)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}

	var res []dto.DepartmentResponse
	for _, d := range rows {
		res = append(res, dto.DepartmentResponse{
			ID:        d.ID,
			Code:      d.Code,
			Name:      d.Name,
			IsQs:      d.IsQs,
			SiteCode:  d.SiteCode,
			SiteDesc:  d.SiteName,
			CreatedAt: d.CreatedAt.Format("2006-01-02 15:04:05"),
		})
	}

	if res == nil {
		res = []dto.DepartmentResponse{}
	}
	response.Success(c.Writer, res)
}
