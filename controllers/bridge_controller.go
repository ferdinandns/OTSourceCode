package controllers

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"lab-connect/backend-api/database"
	"lab-connect/backend-api/models"
	"lab-connect/backend-api/services"
	"lab-connect/backend-api/structs"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
)

type BridgeController struct{}

func NewBridgeController() *BridgeController {
	return &BridgeController{}
}

type BridgeDataPayload struct {
	PCID           string                 `json:"pc_id" binding:"required"`
	Location       string                 `json:"location"`
	InstrumentID   uint                   `json:"instrument_id" binding:"required"`
	InstrumentName string                 `json:"instrument_name"`
	Timestamp      time.Time              `json:"timestamp"`
	Value          string                 `json:"value" binding:"required"`
	Unit           string                 `json:"unit"`
	Hostname       string                 `json:"hostname"`
	AdditionalData map[string]interface{} `json:"additional_data"`
}

// GetBridgeConfig - Endpoint untuk bridge fetch config dinamis
// GET /api/bridge/config/:pc_id
// GetBridgeConfig - Endpoint untuk bridge fetch config dinamis
// GET /api/bridge/config/:pc_id
func (c *BridgeController) GetBridgeConfig(ctx *gin.Context) {
	pcID := ctx.Param("pc_id")

	var instruments []models.Instrument
	err := database.DB.
		Where("bridge_pc_id = ? AND status IN ?", pcID, []string{"Available", "In Use", "In Used"}).
		Preload("InstrumentConfig").
		Find(&instruments).Error

	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to fetch instruments",
		})
		return
	}

	type BridgeInstrumentConfig struct {
		ID           uint   `json:"id"`
		Name         string `json:"name"`
		Code         string `json:"code"`
		Port         string `json:"port"`
		Baudrate     int    `json:"baudrate"`
		DataBits     int    `json:"data_bits"`
		StopBits     int    `json:"stop_bits"`
		Parity       string `json:"parity"`
		ReadCommand  string `json:"read_command"`
		RegexPattern string `json:"regex_pattern"`
		IPAddress    string `json:"ip_address,omitempty"`
		TCPPort      int    `json:"tcp_port,omitempty"`
		Timeout      int    `json:"timeout,omitempty"`
	}

	var bridgeConfig []BridgeInstrumentConfig

	for _, inst := range instruments {
		if inst.InstrumentConfig == nil {
			continue
		}

		cfg := inst.InstrumentConfig

		config := BridgeInstrumentConfig{
			ID:           inst.Id,
			Name:         inst.Nama,
			Code:         inst.KodeInstrument,
			Port:         cfg.ComPort,
			Baudrate:     cfg.BaudRate,
			DataBits:     cfg.DataBits,
			StopBits:     cfg.StopBits,
			Parity:       cfg.Parity,
			ReadCommand:  cfg.ReadCommand,
			RegexPattern: cfg.RegexPattern,
			IPAddress:    cfg.IPAddress,
			TCPPort:      cfg.TCPPort,
			Timeout:      cfg.Timeout,
		}

		bridgeConfig = append(bridgeConfig, config)
	}

	// Update last_seen...

	ctx.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data": gin.H{
			"pc_id":       pcID,
			"instruments": bridgeConfig,
			"count":       len(bridgeConfig),
			"fetched_at":  time.Now(),
		},
	})
}

func isMeasurementData(value string) bool {
	if strings.Contains(value, "<Melting_Point>") {
		return true
	}

	// Refractometer: "Brix= 79.48% nD=1.48936 t=20.00"
	// Generic: contains digits with decimal points
	measurementPatterns := []string{
		"Brix=",
		"nD=",
		"value=",
		"pH=",
		"Result=",
	}

	for _, pattern := range measurementPatterns {
		if strings.Contains(value, pattern) {
			return true
		}
	}

	// Skip known metadata patterns
	metadataPatterns := []string{
		"USER ID=",
		"SAMPLE=",
		"S/N=",
		"**",
		"HISTORY",
		"REPORT",
		"DATE=",
		"TIME=",
	}

	for _, pattern := range metadataPatterns {
		if strings.Contains(value, pattern) {
			return false
		}
	}

	// Fallback: if it has numbers, treat as measurement
	re := regexp.MustCompile(`\d+\.\d+`)
	return re.MatchString(value)
}

// parseBridgeValue parses the raw instrument value string into structured map
// Input example: "Brix= 79.48% nD=1.48936 t=20.00"
// Output: {"brix": "79.48", "nd": "1.48936", "temp": "20.00", "raw_data": "..."}
func parseBridgeValue(value string, additionalData map[string]interface{}) map[string]interface{} {
	if strings.Contains(value, "<Melting_Point>") {
		// additional_data sudah diparse di bridge, langsung pakai
		result := map[string]interface{}{
			"raw_data":  value,
			"parsed":    true,
			"timestamp": time.Now().Format("2006-01-02 15:04:05"),
		}
		for k, v := range additionalData {
			result[k] = v
		}
		return result
	}

	result := map[string]interface{}{
		"raw_data":  value,
		"parsed":    true,
		"timestamp": time.Now().Format("2006-01-02 15:04:05"),
	}

	// Copy additional_data fields (metadata from previous lines if bridge sends them)
	for k, v := range additionalData {
		result[k] = v
	}

	// Parse refractometer format: "Brix= 79.48% nD=1.48936 t=20.00"
	patterns := map[string]*regexp.Regexp{
		"brix": regexp.MustCompile(`Brix=\s*([\d.]+)`),
		"nd":   regexp.MustCompile(`nD=([\d.]+)`),
		"temp": regexp.MustCompile(`t=([\d.]+)`),
		// Add more patterns for other instrument types:
		"ph":    regexp.MustCompile(`pH=\s*([\d.]+)`),
		"value": regexp.MustCompile(`Result=\s*([\d.]+)`),
	}

	for key, re := range patterns {
		if m := re.FindStringSubmatch(value); len(m) > 1 {
			result[key] = m[1]
		}
	}

	return result
}

// ReceiveBridgeData - Endpoint untuk terima data dari bridge
// POST /api/bridge/data
func (c *BridgeController) ReceiveBridgeData(ctx *gin.Context) {
	var payload BridgeDataPayload

	if err := ctx.ShouldBindJSON(&payload); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid payload",
			"error":   err.Error(),
		})
		return
	}

	var instrument models.Instrument
	if err := database.DB.First(&instrument, payload.InstrumentID).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Instrument not found",
			"error":   err.Error(),
		})
		return
	}

	now := time.Now()
	database.DB.Model(&instrument).Updates(map[string]interface{}{
		"bridge_status":    "connected",
		"last_bridge_seen": now,
	})

	// ✅ FIXED: Proper handling of AdditionalData for JSONB
	reading := models.BridgeReading{
		PCID:         payload.PCID,
		InstrumentID: payload.InstrumentID,
		Value:        payload.Value,
		ReadAt:       payload.Timestamp,
	}

	// ✅ Marshal map to JSON bytes, then convert to datatypes.JSON
	if len(payload.AdditionalData) > 0 {
		additionalDataJSON, err := json.Marshal(payload.AdditionalData)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{
				"status":  "error",
				"message": "Failed to encode additional_data",
				"error":   err.Error(),
			})
			return
		}
		reading.AdditionalData = datatypes.JSON(additionalDataJSON)
	} else {
		reading.AdditionalData = datatypes.JSON([]byte("{}"))
	}

	if payload.Unit != "" {
		reading.Unit = &payload.Unit
	}

	if err := database.DB.Create(&reading).Error; err != nil {
		println("⚠️ Failed to save reading:", err.Error())
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to save bridge reading",
			"error":   err.Error(), // ✅ Add actual error for debugging
		})
		return
	}

	// ✅ NEW: Find active usage for this instrument
	var activeUsage models.InstrumentUsage
	err := database.DB.Where("instrument_id = ? AND end_time IS NULL AND status_penggunaan IN ?",
		payload.InstrumentID,
		[]string{"Read Process", "Re-read"}).
		Order("start_time DESC").
		First(&activeUsage).Error

	if err == nil {
		// Determine if this line contains actual measurement data
		// Refractometer sends: "Brix= 79.48% nD=1.48936 t=20.00" (data line)
		// vs metadata: "USER ID=ADMIN SAMPLE=032J" or "ATAGO RX-7000i S/N=..."
		isMeasurementLine := isMeasurementData(payload.Value)

		if !isMeasurementLine {
			// Skip metadata lines — don't create usage_result stubs for them
			fmt.Printf("[Bridge] ℹ️ Skipping metadata line: %s\n", payload.Value)
			// Still save to bridge_readings (already done above), just don't create usage_result
			goto respondOK
		}

		// Parse the measurement line into structured JSON
		resultData := parseBridgeValue(payload.Value, payload.AdditionalData)
		resultJSON, _ := json.Marshal(resultData)

		// Get next item number
		var maxItemNumber int
		database.DB.Model(&models.UsageResult{}).
			Where("instrument_usage_id = ?", activeUsage.Id).
			Select("COALESCE(MAX(item_number), 0)").
			Scan(&maxItemNumber)

		nextItemNumber := maxItemNumber + 1

		// Get current batch info
		var batches []struct {
			NoQCBatch  string `json:"no_qc_batch"`
			JumlahItem int    `json:"jumlah_item"`
		}
		json.Unmarshal([]byte(activeUsage.NoQCBatch), &batches)

		currentBatch := ""
		itemIndex := nextItemNumber - 1 // 0-based index of the item being saved
		for _, batch := range batches {
			if itemIndex < batch.JumlahItem {
				currentBatch = batch.NoQCBatch
				break
			}
			itemIndex -= batch.JumlahItem
		}

		readingIDPtr := &reading.Id
		usageResult := models.UsageResult{
			InstrumentUsageID: activeUsage.Id,
			BridgeReadingID:   readingIDPtr,
			NoQCBatch:         currentBatch,
			ItemNumber:        nextItemNumber,
			ResultData:        string(resultJSON), // ✅ NOW POPULATED
			IsReread:          activeUsage.StatusPenggunaan == "Re-read",
			CreatedAt:         time.Now(),
		}

		if err := database.DB.Create(&usageResult).Error; err != nil {
			fmt.Printf("[Bridge] ⚠️ Failed to create usage_result: %v\n", err)
		} else {
			fmt.Printf("[Bridge] ✅ Created usage_result #%d with data: %s\n",
				usageResult.Id, string(resultJSON))
		}
	}

respondOK:
	// ✅ UPDATE: Set bridge PC status to online
	database.DB.Model(&models.BridgePC{}).
		Where("pc_id = ?", payload.PCID).
		Updates(map[string]interface{}{
			"last_seen": now,
			"status":    "online",
		})

	ctx.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Data received successfully",
		"data": gin.H{
			"pc_id":           payload.PCID,
			"instrument":      payload.InstrumentName,
			"value":           payload.Value,
			"reading_id":      reading.Id,
			"linked_to_usage": err == nil,
			"received_at":     time.Now(),
		},
	})
}

// GetBridgeStatus - Check bridge connection status
// GET /api/bridge/status/:pc_id
// GetBridgeStatus - GET /api/bridge/status/:pc_id
// GetBridgeStatus - GET /api/bridge/status/:pc_id
// ✅ UPDATED: Now returns bridge_running from database
func (bc *BridgeController) GetBridgeStatus(ctx *gin.Context) {
	pcID := ctx.Param("pc_id")

	var bridge models.BridgePC
	if err := database.DB.Where("pc_id = ?", pcID).First(&bridge).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Bridge PC not found",
		})
		return
	}

	// ✅ Determine connection status
	isOnline := bridge.Status == "online"

	// ✅ Check if connection is stale
	if bridge.LastSeen != nil && isOnline {
		timeSinceLastSeen := time.Since(*bridge.LastSeen)
		if timeSinceLastSeen > 30*time.Second {
			isOnline = false
		}
	}

	// ✅ Bridge status from database (not calculated)
	bridgeRunning := bridge.BridgeRunning
	bridgeStatus := "stopped"
	if bridgeRunning && isOnline {
		bridgeStatus = "running"
	} else if !isOnline {
		bridgeStatus = "offline"
	}

	// Get instrument counts
	var totalInstruments int64
	var connectedInstruments int64

	database.DB.Model(&models.Instrument{}).
		Where("bridge_pc_id = ?", pcID).
		Count(&totalInstruments)

	database.DB.Model(&models.Instrument{}).
		Where("bridge_pc_id = ? AND bridge_status = ?", pcID, "connected").
		Count(&connectedInstruments)

	// ✅ Return with bridge_running from database
	ctx.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data": gin.H{
			"pc_id":            bridge.PCID,
			"hostname":         bridge.Hostname,
			"location":         bridge.Location,
			"ip_address":       bridge.IPAddress,
			"status":           bridge.Status,
			"online":           isOnline,
			"bridge_status":    bridgeStatus,
			"bridge_running":   bridgeRunning, // ✅ From database, not calculated!
			"last_seen":        bridge.LastSeen,
			"instrument_count": totalInstruments,
			"connected_count":  connectedInstruments,
		},
	})
}

// RegisterBridge - Bridge registration
// POST /api/bridge/register
func (c *BridgeController) RegisterBridge(ctx *gin.Context) {
	var payload struct {
		PCID        string `json:"pc_id" binding:"required"`
		Location    string `json:"location"`
		Hostname    string `json:"hostname"`
		IPAddress   string `json:"ip_address"`
		Instruments []uint `json:"instrument_ids"`
	}

	if err := ctx.ShouldBindJSON(&payload); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "Invalid payload",
		})
		return
	}

	now := time.Now()
	bridgePC := models.BridgePC{
		PCID:     payload.PCID,
		Hostname: payload.Hostname,
		Location: payload.Location,
		Status:   "online",
		LastSeen: &now,
	}
	if payload.IPAddress != "" {
		bridgePC.IPAddress = &payload.IPAddress
	}

	var existing models.BridgePC
	err := database.DB.Where("pc_id = ?", payload.PCID).First(&existing).Error

	if err != nil {
		if err := database.DB.Create(&bridgePC).Error; err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": "Failed to register bridge",
			})
			return
		}
	} else {
		database.DB.Model(&existing).Updates(bridgePC)
	}

	ctx.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Bridge registered successfully",
		"data": gin.H{
			"pc_id":    payload.PCID,
			"location": payload.Location,
			"hostname": payload.Hostname,
		},
	})
}

// GetAllBridgePCs - List semua bridge PCs
// GET /api/bridge/pcs
func (c *BridgeController) GetAllBridgePCs(ctx *gin.Context) {
	var bridgePCs []models.BridgePC

	if err := database.DB.Find(&bridgePCs).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to fetch bridge PCs",
		})
		return
	}

	type PCWithCount struct {
		models.BridgePC
		InstrumentCount int64 `json:"instrument_count"`
	}

	var result []PCWithCount
	for _, pc := range bridgePCs {
		var count int64
		database.DB.Model(&models.Instrument{}).
			Where("bridge_pc_id = ?", pc.PCID).
			Count(&count)

		result = append(result, PCWithCount{
			BridgePC:        pc,
			InstrumentCount: count,
		})
	}

	ctx.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   result,
	})
}

// GetBridgeReadings - Get history readings dari bridge
// GET /api/bridge/readings?pc_id=xxx&instrument_id=xxx&limit=50
func (c *BridgeController) GetBridgeReadings(ctx *gin.Context) {
	pcID := ctx.Query("pc_id")
	instrumentID := ctx.Query("instrument_id")

	query := database.DB.Model(&models.BridgeReading{}).
		Preload("Instrument").
		Order("read_at DESC").
		Limit(50)

	if pcID != "" {
		query = query.Where("pc_id = ?", pcID)
	}
	if instrumentID != "" {
		query = query.Where("instrument_id = ?", instrumentID)
	}

	var readings []models.BridgeReading
	if err := query.Find(&readings).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to fetch readings",
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   readings,
		"count":  len(readings),
	})
}

// 🆕 StartInstrument - Start instrument via bridge control API
// POST /api/bridge/:pc_id/instrument/:inst_id/start
func (c *BridgeController) StartInstrument(ctx *gin.Context) {
	pcID := ctx.Param("pc_id")
	instID := ctx.Param("inst_id")

	// Get bridge PC info
	var bridgePC models.BridgePC
	if err := database.DB.Where("pc_id = ?", pcID).First(&bridgePC).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Bridge PC not found",
		})
		return
	}

	// Check if PC is online
	if bridgePC.Status != "online" {
		ctx.JSON(http.StatusServiceUnavailable, gin.H{
			"status":  "error",
			"message": "Bridge PC is offline",
		})
		return
	}

	// Get bridge control port from config (default 8081)
	controlPort := 8081
	controlURL := fmt.Sprintf("http://localhost:%d/instrument/start/%s", controlPort, instID)

	// If bridge has IP address, use it
	if bridgePC.IPAddress != nil && *bridgePC.IPAddress != "" {
		controlURL = fmt.Sprintf("http://%s:%d/instrument/start/%s", *bridgePC.IPAddress, controlPort, instID)
	}

	// Call bridge control API
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Post(controlURL, "application/json", nil)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to connect to bridge control API",
			"error":   err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		ctx.JSON(resp.StatusCode, gin.H{
			"status":  "error",
			"message": "Bridge control API returned error",
			"error":   string(body),
		})
		return
	}

	// ✅ UPDATE: Set instrument status to connecting in database
	instIDUint, _ := strconv.ParseUint(instID, 10, 32)
	database.DB.Model(&models.Instrument{}).
		Where("id = ?", instIDUint).
		Updates(map[string]interface{}{
			"bridge_status": "connecting",
		})

	ctx.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Instrument start command sent",
		"data":    string(body),
	})
}

// 🆕 StopInstrument - Stop instrument via bridge control API
// POST /api/bridge/:pc_id/instrument/:inst_id/stop
func (c *BridgeController) StopInstrument(ctx *gin.Context) {
	pcID := ctx.Param("pc_id")
	instID := ctx.Param("inst_id")

	var bridgePC models.BridgePC
	if err := database.DB.Where("pc_id = ?", pcID).First(&bridgePC).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Bridge PC not found",
		})
		return
	}

	if bridgePC.Status != "online" {
		ctx.JSON(http.StatusServiceUnavailable, gin.H{
			"status":  "error",
			"message": "Bridge PC is offline",
		})
		return
	}

	controlPort := 8081
	controlURL := fmt.Sprintf("http://localhost:%d/instrument/stop/%s", controlPort, instID)

	if bridgePC.IPAddress != nil && *bridgePC.IPAddress != "" {
		controlURL = fmt.Sprintf("http://%s:%d/instrument/stop/%s", *bridgePC.IPAddress, controlPort, instID)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Post(controlURL, "application/json", nil)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to connect to bridge control API",
			"error":   err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		ctx.JSON(resp.StatusCode, gin.H{
			"status":  "error",
			"message": "Bridge control API returned error",
			"error":   string(body),
		})
		return
	}

	// ✅ UPDATE: Set instrument status to disconnected in database
	instIDUint, _ := strconv.ParseUint(instID, 10, 32)
	database.DB.Model(&models.Instrument{}).
		Where("id = ?", instIDUint).
		Updates(map[string]interface{}{
			"bridge_status": "disconnected",
		})

	ctx.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Instrument stop command sent",
		"data":    string(body),
	})
}

// 🆕 RestartInstrument - Restart instrument via bridge control API
// POST /api/bridge/:pc_id/instrument/:inst_id/restart
func (c *BridgeController) RestartInstrument(ctx *gin.Context) {
	pcID := ctx.Param("pc_id")
	instID := ctx.Param("inst_id")

	var bridgePC models.BridgePC
	if err := database.DB.Where("pc_id = ?", pcID).First(&bridgePC).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Bridge PC not found",
		})
		return
	}

	if bridgePC.Status != "online" {
		ctx.JSON(http.StatusServiceUnavailable, gin.H{
			"status":  "error",
			"message": "Bridge PC is offline",
		})
		return
	}

	controlPort := 8081
	controlURL := fmt.Sprintf("http://localhost:%d/instrument/restart/%s", controlPort, instID)

	if bridgePC.IPAddress != nil && *bridgePC.IPAddress != "" {
		controlURL = fmt.Sprintf("http://%s:%d/instrument/restart/%s", *bridgePC.IPAddress, controlPort, instID)
	}

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Post(controlURL, "application/json", nil)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to connect to bridge control API",
			"error":   err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		ctx.JSON(resp.StatusCode, gin.H{
			"status":  "error",
			"message": "Bridge control API returned error",
			"error":   string(body),
		})
		return
	}

	// ✅ UPDATE: Set instrument status to restarting in database
	instIDUint, _ := strconv.ParseUint(instID, 10, 32)
	database.DB.Model(&models.Instrument{}).
		Where("id = ?", instIDUint).
		Updates(map[string]interface{}{
			"bridge_status": "restarting",
		})

	ctx.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Instrument restart command sent",
		"data":    string(body),
	})
}

// 🆕 GetInstrumentStatus - Get instrument status from bridge
// GET /api/bridge/:pc_id/instrument/:inst_id/status
func (c *BridgeController) GetInstrumentStatus(ctx *gin.Context) {
	pcID := ctx.Param("pc_id")
	instID := ctx.Param("inst_id")

	var bridgePC models.BridgePC
	if err := database.DB.Where("pc_id = ?", pcID).First(&bridgePC).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Bridge PC not found",
		})
		return
	}

	if bridgePC.Status != "online" {
		ctx.JSON(http.StatusOK, gin.H{
			"status": "success",
			"data": gin.H{
				"status":  "offline",
				"message": "Bridge PC is offline",
			},
		})
		return
	}

	controlPort := 8081
	controlURL := fmt.Sprintf("http://localhost:%d/instrument/status/%s", controlPort, instID)

	if bridgePC.IPAddress != nil && *bridgePC.IPAddress != "" {
		controlURL = fmt.Sprintf("http://%s:%d/instrument/status/%s", *bridgePC.IPAddress, controlPort, instID)
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(controlURL)
	if err != nil {
		ctx.JSON(http.StatusOK, gin.H{
			"status": "success",
			"data": gin.H{
				"status":  "unknown",
				"message": "Cannot connect to bridge control API",
			},
		})
		return
	}
	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)

	ctx.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   string(body),
	})
}

func (bc *BridgeController) StopBridge(ctx *gin.Context) {
	pcID := ctx.Param("pc_id")

	var bridge models.BridgePC
	if err := database.DB.Where("pc_id = ?", pcID).First(&bridge).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Bridge PC not found",
		})
		return
	}

	// 🆕 Send command via WebSocket
	SendBridgeCommand("STOP_BRIDGE", pcID)

	ctx.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "STOP command sent to bridge",
	})
}

func (bc *BridgeController) StartBridge(ctx *gin.Context) {
	pcID := ctx.Param("pc_id")

	var bridge models.BridgePC
	if err := database.DB.Where("pc_id = ?", pcID).First(&bridge).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Bridge PC not found",
		})
		return
	}

	// 🆕 Send command via WebSocket
	SendBridgeCommand("START_BRIDGE", pcID)

	ctx.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "START command sent to bridge",
	})
}

func (bc *BridgeController) RestartBridge(ctx *gin.Context) {
	pcID := ctx.Param("pc_id")

	var bridge models.BridgePC
	if err := database.DB.Where("pc_id = ?", pcID).First(&bridge).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Bridge PC not found",
		})
		return
	}

	// 🆕 Send command via WebSocket
	SendBridgeCommand("RESTART_BRIDGE", pcID)

	ctx.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "RESTART command sent to bridge",
	})
}

// ============================================
// HELPER: Enhanced Status with Bridge Running State
// ============================================

// UpdateGetBridgeStatus - Enhanced version with bridge_running status
// You can replace the existing GetBridgeStatus with this
func (bc *BridgeController) GetBridgeStatusEnhanced(ctx *gin.Context) {
	pcID := ctx.Param("pc_id")

	var bridge models.BridgePC
	if err := database.DB.Where("pc_id = ?", pcID).First(&bridge).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{
			"status":  "error",
			"message": "Bridge PC not found",
		})
		return
	}

	// Get instrument stats
	var totalInstruments int64
	var connectedInstruments int64

	database.DB.Model(&models.Instrument{}).
		Where("bridge_pc_id = ?", pcID).
		Count(&totalInstruments)

	database.DB.Model(&models.Instrument{}).
		Where("bridge_pc_id = ? AND bridge_status = ?", pcID, "connected").
		Count(&connectedInstruments)

	// Determine if bridge service is running
	// Bridge is "running" if:
	// - Status is "online"
	// - Last seen within 30 seconds
	// - At least one instrument is connected
	isOnline := bridge.Status == "online"
	isRunning := false
	bridgeStatus := "stopped"

	if bridge.LastSeen != nil && isOnline {
		timeSinceLastSeen := time.Since(*bridge.LastSeen)
		if timeSinceLastSeen < 30*time.Second {
			isRunning = true
			bridgeStatus = "running"
		}
	}

	ctx.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Bridge status retrieved",
		"data": gin.H{
			"pc_id":            bridge.PCID,
			"hostname":         bridge.Hostname,
			"location":         bridge.Location,
			"ip_address":       bridge.IPAddress,
			"status":           bridge.Status,
			"online":           isOnline,
			"bridge_status":    bridgeStatus, // "running" or "stopped"
			"bridge_running":   isRunning,    // true/false
			"last_seen":        bridge.LastSeen,
			"instrument_count": totalInstruments,
			"connected_count":  connectedInstruments,
			"created_at":       bridge.CreatedAt,
			"updated_at":       bridge.UpdatedAt,
		},
	})

}

// POST /api/bridge/verification-data
func (c *BridgeController) ReceiveVerificationData(ctx *gin.Context) {
	var payload struct {
		PCID         string    `json:"pc_id" binding:"required"`
		InstrumentID uint      `json:"instrument_id" binding:"required"`
		Value        string    `json:"value" binding:"required"`
		Timestamp    time.Time `json:"timestamp"`
	}
	if err := ctx.ShouldBindJSON(&payload); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": err.Error()})
		return
	}

	log.Printf("[VerifData] ▶ Received: instrument_id=%d value=%q",
		payload.InstrumentID, payload.Value)

	now := time.Now()

	// ✅ Selalu simpan ke bridge_readings
	reading := models.BridgeReading{
		PCID:           payload.PCID,
		InstrumentID:   payload.InstrumentID,
		Value:          payload.Value,
		ReadAt:         now,
		AdditionalData: datatypes.JSON([]byte("{}")),
	}
	if err := database.DB.Create(&reading).Error; err != nil {
		log.Printf("[VerifData] ⚠️ Failed to save bridge reading: %v", err)
	}

	// ✅ Update bridge PC last_seen
	database.DB.Model(&models.BridgePC{}).
		Where("pc_id = ?", payload.PCID).
		Updates(map[string]interface{}{
			"last_seen": now,
			"status":    "online",
		})

	// ✅ Update instrument bridge_status
	database.DB.Model(&models.Instrument{}).
		Where("id = ?", payload.InstrumentID).
		Updates(map[string]interface{}{
			"bridge_status":    "connected",
			"last_bridge_seen": now,
		})

	// Cari pending read request
	var readReq models.VerificationReadRequest
	err := database.DB.
		Joins("JOIN instrument_verifications iv ON iv.id = verification_read_requests.verification_id").
		Where("verification_read_requests.instrument_id = ?", payload.InstrumentID).
		Where("verification_read_requests.status = ?", "pending").
		Where("iv.status = ?", "In Progress").
		Order("verification_read_requests.requested_at DESC").
		First(&readReq).Error

	if err != nil {
		log.Printf("[VerifData] ℹ️ No active pending request for instrument %d, saved to bridge_readings only", payload.InstrumentID)
		ctx.JSON(http.StatusOK, gin.H{"status": "success", "message": "No pending request, data saved to bridge readings"})
		return
	}

	numericVal, parseErr := extractNumericFromString(payload.Value)
	if parseErr != nil {
		log.Printf("[VerifData] ❌ Cannot parse value %q: %v", payload.Value, parseErr)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": fmt.Sprintf("Cannot parse numeric value from: %q", payload.Value),
		})
		return
	}

	log.Printf("[VerifData] ✅ Parsed value: %.4f from %q", numericVal, payload.Value)

	verSvc := services.NewVerificationService()
	stepReq := structs.ExecuteStepRequest{
		VerificationID: readReq.VerificationID,
		StepNumber:     readReq.StepNumber,
		StepType:       readReq.StepType,
		ReferenceID:    readReq.ReferenceID,
		InputData: map[string]interface{}{
			"bridge_value": numericVal,
		},
	}

	_, err = verSvc.ExecuteStep(stepReq, "operator")
	if err != nil {
		log.Printf("[VerifData] ❌ ExecuteStep failed: %v", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": err.Error()})
		return
	}

	database.DB.Model(&readReq).Updates(map[string]interface{}{
		"status":       "fulfilled",
		"fulfilled_at": now,
	})

	log.Printf("[VerifData] ✅ Fulfilled: verif_id=%d step=%d value=%.4f",
		readReq.VerificationID, readReq.StepNumber, numericVal)

	ctx.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Verification reading received",
		"value":   numericVal,
	})
}

// extractNumericFromString - ekstrak angka pertama dari string apapun
// Handle format: "1.0023", "  1.0023 kg", "ST,GS,+  1.0023 kg", "1,0023", dll
func extractNumericFromString(raw string) (float64, error) {
	raw = strings.TrimSpace(raw)

	// Coba parse langsung dulu (angka bersih)
	if val, err := strconv.ParseFloat(raw, 64); err == nil {
		return val, nil
	}

	// Ganti koma dengan titik (format Eropa: "1,0023")
	normalized := strings.ReplaceAll(raw, ",", ".")

	// Ekstrak angka pertama dengan regex
	// Handle: positif/negatif, desimal, scientific notation
	re := regexp.MustCompile(`[-+]?\d+\.?\d*(?:[eE][-+]?\d+)?`)
	match := re.FindString(normalized)
	if match == "" {
		return 0, fmt.Errorf("no numeric value found in %q", raw)
	}

	val, err := strconv.ParseFloat(match, 64)
	if err != nil {
		return 0, fmt.Errorf("failed to parse %q from %q: %v", match, raw, err)
	}

	return val, nil
}

// GET /api/bridge/verification-pending/:pc_id
func (c *BridgeController) GetPendingVerificationReads(ctx *gin.Context) {
	pcID := ctx.Param("pc_id")

	var instruments []models.Instrument
	database.DB.Where("bridge_pc_id = ?", pcID).Find(&instruments)

	instIDs := make([]uint, len(instruments))
	for i, inst := range instruments {
		instIDs[i] = inst.Id
	}

	tenMinutesAgo := time.Now().Add(-10 * time.Minute)

	var pending []models.VerificationReadRequest
	database.DB.
		Joins("JOIN instrument_verifications iv ON iv.id = verification_read_requests.verification_id").
		Where("verification_read_requests.instrument_id IN ?", instIDs).
		Where("verification_read_requests.status = ?", "pending").
		Where("verification_read_requests.requested_at > ?", tenMinutesAgo).
		Where("iv.status = ?", "In Progress").
		Find(&pending)

	ctx.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   pending,
		"count":  len(pending),
	})
}
