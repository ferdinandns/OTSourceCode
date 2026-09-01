package controllers

import (
	"lab-connect/backend-api/services"
	"lab-connect/backend-api/structs"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type RS232Data struct {
	Timestamp float64 `json:"timestamp"`
	Value     string  `json:"value"`
	Source    string  `json:"source"`
	Port      string  `json:"port"`
}

func ReceiveRS232Data(c *gin.Context) {
	var data RS232Data

	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, structs.ErrorResponse{
			Status:  "error",
			Message: "Invalid data format",
		})
		return
	}

	// Log data yang diterima
	println("📥 Received RS-232 data:", data.Value, "at", time.Now().Format("15:04:05"))

	// Broadcast ke semua WebSocket clients
	wsService := services.GetWebSocketService()
	if wsService != nil {
		wsService.BroadcastData(data)
	}

	c.JSON(http.StatusOK, structs.SuccessResponse{
		Status:  "success",
		Message: "Data received and broadcasted",
		Data:    data,
	})
}
