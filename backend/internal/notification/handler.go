package notification

import (
	"net/http"
	"strconv"

	"emertrack/internal/domain"
	"emertrack/internal/middleware"
	"emertrack/pkg/jwt"
	"emertrack/pkg/response"
	"emertrack/pkg/ws"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type Handler struct {
	notifService domain.NotificationService
	jwtMgr       *jwt.Manager
}

func NewHandler(ns domain.NotificationService, jwtMgr *jwt.Manager) *Handler {
	return &Handler{notifService: ns, jwtMgr: jwtMgr}
}

func (h *Handler) WSConnect(c *gin.Context) {
	// Get token from query param because WebSocket cannot send headers.
	tokenStr := c.Query("token")
	if tokenStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	claims, err := h.jwtMgr.Validate(tokenStr)
	if err != nil || claims.Type != "ws" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	ws.GlobalHub.Register(claims.UserID, conn)
	defer ws.GlobalHub.Unregister(claims.UserID, conn)

	// Keep alive.
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

func (h *Handler) GetWSToken(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	wsToken, err := h.jwtMgr.GenerateWSToken(userID.(uint))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat WS token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"token": wsToken}})
}

func (h *Handler) GetMyNotifications(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	notifs, err := h.notifService.GetUserNotifications(c.Request.Context(), claims.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil notifikasi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": notifs})
}

func (h *Handler) MarkAsRead(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	notifID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tidak valid"})
		return
	}

	err = h.notifService.MarkAsRead(c.Request.Context(), uint(notifID), claims.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update status notifikasi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Notifikasi ditandai sudah dibaca"})
}

func (h *Handler) MarkAllAsRead(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		response.Unauthorized(c.Writer)
		return
	}

	if err := h.notifService.MarkAllAsRead(c.Request.Context(), claims.UserID); err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c.Writer, gin.H{"message": "Semua notifikasi telah ditandai sebagai dibaca"})
}

func (h *Handler) DeleteNotification(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	notifID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tidak valid"})
		return
	}

	err = h.notifService.DeleteNotification(c.Request.Context(), uint(notifID), claims.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus notifikasi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Notifikasi dihapus"})
}

func (h *Handler) DeleteAllnotifications(c *gin.Context) {
	claims, ok := middleware.GetClaims(c)
	if !ok {
		response.Unauthorized(c.Writer)
		return
	}
	if err := h.notifService.DeleteAllNotifications(c.Request.Context(), claims.UserID); err != nil {
		response.Error(c.Writer, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c.Writer, gin.H{"message": "Semua notifikasi berhasil dihapus"})
}
