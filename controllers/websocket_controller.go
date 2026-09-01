package controllers

import (
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"lab-connect/backend-api/database"
	"lab-connect/backend-api/models"
)

var (
	wsUpgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}

	wsClients      = make(map[*websocket.Conn]bool)
	wsClientsMutex sync.Mutex
)

func WebSocketController(c *gin.Context) {
	conn, err := wsUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("❌ WebSocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	wsClientsMutex.Lock()
	wsClients[conn] = true
	wsClientsMutex.Unlock()

	log.Printf("✅ WebSocket client connected (total: %d)", len(wsClients))

	defer func() {
		wsClientsMutex.Lock()
		delete(wsClients, conn)
		wsClientsMutex.Unlock()
		log.Printf("❌ WebSocket client disconnected (remaining: %d)", len(wsClients))
	}()

	for {
		var msg map[string]interface{}
		err := conn.ReadJSON(&msg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		msgType, ok := msg["type"].(string)
		if !ok {
			continue
		}

		switch msgType {
		case "heartbeat":
			handleHeartbeat(msg)
		case "status_update":
			// ✅ TAMBAHKAN: Handle explicit status updates
			handleStatusUpdate(msg)
		case "instrument_status":
			handleInstrumentStatus(msg)
		default:
			log.Printf("📥 Received from bridge: %v", msg)
		}
	}
}

func BroadcastMessage(message interface{}) {
	wsClientsMutex.Lock()
	defer wsClientsMutex.Unlock()

	for client := range wsClients {
		err := client.WriteJSON(message)
		if err != nil {
			log.Printf("❌ WebSocket write error: %v", err)
			client.Close()
			delete(wsClients, client)
		}
	}

	log.Printf("📤 Broadcast to %d clients: %v", len(wsClients), message)
}

func StartWebSocketBroadcast() {
	log.Println("🚀 WebSocket broadcast handler started")
}

func SendBridgeCommand(command, pcID string) {
	message := map[string]interface{}{
		"type":      "control",
		"command":   command,
		"pc_id":     pcID,
		"timestamp": time.Now().Format(time.RFC3339),
	}

	BroadcastMessage(message)
}

// ✅ PERBAIKAN: handleHeartbeat - Update database dengan status REAL
func handleHeartbeat(msg map[string]interface{}) {
	pcID, ok := msg["pc_id"].(string)
	if !ok {
		return
	}

	// ✅ Ambil bridge_running dari heartbeat (ini sudah benar sekarang)
	bridgeRunning, _ := msg["bridge_running"].(bool)
	instrumentCount, _ := msg["instrument_count"].(float64)
	instrumentsActive, _ := msg["instruments_active"].(float64)

	now := time.Now()
	status := "online"

	// ✅ CRITICAL: Update database dengan bridge_running state
	updates := map[string]interface{}{
		"last_seen":      now,
		"status":         status,
		"bridge_running": bridgeRunning, // ✅ Save to database!
	}

	database.DB.Model(&models.BridgePC{}).
		Where("pc_id = ?", pcID).
		Updates(updates)

	bridgeStatus := "stopped"
	if bridgeRunning {
		bridgeStatus = "running"
	}

	log.Printf("💚 Heartbeat from %s: service=%s, instruments=%d/%d",
		pcID, bridgeStatus, int(instrumentsActive), int(instrumentCount))
}

// ✅ BARU: handleStatusUpdate - Handle explicit status changes
func handleStatusUpdate(msg map[string]interface{}) {
	pcID, ok := msg["pc_id"].(string)
	if !ok {
		return
	}

	bridgeRunning, _ := msg["bridge_running"].(bool)
	action, _ := msg["action"].(string)

	now := time.Now()
	status := "online"

	// ✅ CRITICAL: Update database dengan bridge_running state
	updates := map[string]interface{}{
		"last_seen":      now,
		"status":         status,
		"bridge_running": bridgeRunning, // ✅ Save to database!
	}

	database.DB.Model(&models.BridgePC{}).
		Where("pc_id = ?", pcID).
		Updates(updates)

	if action != "" {
		log.Printf("🔔 Status Update from %s: %s (running: %v)", pcID, action, bridgeRunning)
	} else {
		log.Printf("🔔 Status Update from %s: running=%v", pcID, bridgeRunning)
	}
}

func handleInstrumentStatus(msg map[string]interface{}) {
	pcID, ok := msg["pc_id"].(string)
	if !ok {
		return
	}

	instrumentID, ok := msg["instrument_id"].(float64)
	if !ok {
		return
	}

	status, ok := msg["status"].(string)
	if !ok {
		return
	}

	now := time.Now()

	// ✅ Update instrument status in database
	updates := map[string]interface{}{
		"bridge_status":    status,
		"last_bridge_seen": now,
	}

	result := database.DB.Model(&models.Instrument{}).
		Where("id = ?", uint(instrumentID)).
		Updates(updates)

	if result.Error != nil {
		log.Printf("❌ Failed to update instrument %d status: %v", uint(instrumentID), result.Error)
		return
	}

	log.Printf("✅ Instrument status updated: PC=%s, ID=%d, status=%s",
		pcID, uint(instrumentID), status)
}

// SendBridgeCommandWithData - Send bridge control commands with additional data payload
func SendBridgeCommandWithData(command, pcID string, data map[string]interface{}) error {
	message := map[string]interface{}{
		"type":      "control",
		"command":   command,
		"pc_id":     pcID,
		"data":      data,
		"timestamp": time.Now().Format(time.RFC3339),
	}

	wsClientsMutex.Lock()
	defer wsClientsMutex.Unlock()

	if len(wsClients) == 0 {
		return fmt.Errorf("no WebSocket clients connected")
	}

	for client := range wsClients {
		err := client.WriteJSON(message)
		if err != nil {
			log.Printf("❌ WebSocket write error: %v", err)
			client.Close()
			delete(wsClients, client)
		}
	}

	log.Printf("📤 Sent command '%s' to bridge %s with data: %v", command, pcID, data)
	return nil
}
