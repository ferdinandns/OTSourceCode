package mytask

import (
	"net/http"
	"strings"

	"emertrack/internal/domain"
	"emertrack/internal/middleware"
	"emertrack/pkg/response"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc domain.MyTaskService
}

func NewHandler(svc domain.MyTaskService) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) GetMyTasks(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		response.Unauthorized(c.Writer)
		return
	}

	isGA := strings.Contains(strings.ToLower(claims.DepartmentName), "general affair")

	tasks, err := h.svc.GetMyTasks(
		c.Request.Context(),
		claims.UserID,
		claims.Roles,
		claims.IsSupervisor,
		isGA,
	)
	if err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c.Writer, tasks)
}
