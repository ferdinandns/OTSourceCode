package approval

import (
	"fmt"
	"net/http"
	"strconv"

	"emertrack/internal/domain"
	"emertrack/pkg/paginator"
	"emertrack/pkg/response"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service domain.ApprovalService
}

func NewHandler(s domain.ApprovalService) *Handler {
	return &Handler{service: s}
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

func (h *Handler) Approve(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c.Writer)
		return
	}

	var req struct {
		Notes string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c.Writer, err.Error())
		return
	}

	msg, err := h.service.Approve(c.Request.Context(), userID, uint(id), req.Notes)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}

	response.SuccessMessage(c.Writer, msg)
}

func (h *Handler) Reject(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	userID, err := getUserID(c)
	if err != nil {
		response.Unauthorized(c.Writer)
		return
	}

	var req struct {
		Notes string `json:"notes" validate:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c.Writer, err.Error())
		return
	}

	msg, err := h.service.Reject(c.Request.Context(), userID, uint(id), req.Notes)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}

	response.SuccessMessage(c.Writer, msg)
}

func (h *Handler) GetDetail(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)

	res, err := h.service.GetApprovalDetail(c.Request.Context(), uint(id))
	if err != nil {
		response.NotFound(c.Writer, "Approval request not found")
		return
	}

	response.Success(c.Writer, res)
}

func (h *Handler) List(c *gin.Context) {
	p := paginator.FromRequest(c.Request)

	filter := domain.ApprovalFilter{
		Page:     p.Page,
		PageSize: p.Limit,
	}
	rows, total, err := h.service.ListApprovals(c.Request.Context(), filter)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(
		c.Writer, gin.H{
			"data": rows,
			"meta": p.Meta(total),
		},
	)
}
