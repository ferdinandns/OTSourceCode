package services

import (
	"encoding/json"
	"fmt"
	"io"
	"lab-connect/backend-api/models"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode"

	"github.com/jung-kurt/gofpdf"
	"gorm.io/gorm"
)

type PDFGeneratorService struct {
	db *gorm.DB
	tr func(string) string
}

func NewPDFGeneratorService(db *gorm.DB) *PDFGeneratorService {
	return &PDFGeneratorService{db: db}
}

type TableColumn struct {
	Key       string  `json:"key"`
	Header    string  `json:"header"`
	Unit      string  `json:"unit"`
	IsNumeric bool    `json:"is_numeric"`
	Width     float64 `json:"width"`
	Enabled   bool    `json:"enabled"`
	Regex     string  `json:"regex"`
}

type PDFData struct {
	LogoPath          string
	CompanyName       string
	SiteName          string
	InstrumentName    string
	InstrumentCode    string
	InstrumentType    string
	SerialNumber      string
	Brand             string
	Location          string
	CalibrationDate   time.Time
	CalibrationExpiry time.Time
	PICInstrument     string
	UsageID           uint
	KategoriSampel    string
	Sampel            []string
	UserName          string
	UserRole          string
	StartTime         time.Time
	EndTime           time.Time
	TotalItems        int
	InitialChecklist  []models.ChecklistResponse
	FinalCondition    string
	FinalChecklist    []models.ChecklistResponse
	AdditionalData    map[string]interface{}
	Instrument        models.Instrument
	Results           []ResultData
}

type ResultData struct {
	ItemNumber int
	NoQCBatch  string
	RawData    string
	ParsedData map[string]interface{}
	Timestamp  time.Time
	IsReread   bool
	HasError   bool
	ErrorMsg   string
}

// ============================================
// MAIN ENTRY POINT
// ============================================

// GeneratePDFWithResults generates a PDF and immediately copies it to the
// instrument's configured file_path / file_path_2 directories.
func (s *PDFGeneratorService) GeneratePDFWithResults(usageID uint, resultIDs []uint, logoPath string) (string, error) {
	fmt.Printf("[PDF] Generating PDF for usage #%d\n", usageID)

	var usage models.InstrumentUsage
	if err := s.db.
		Preload("Instrument.InstrumentConfig").
		Preload("Instrument.PICUser").
		Preload("User").
		First(&usage, usageID).Error; err != nil {
		return "", fmt.Errorf("failed to fetch usage: %v", err)
	}

	if usage.Instrument.InstrumentConfig != nil {
		fmt.Printf("[PDF] ✅ InstrumentConfig preloaded (ID=%d)\n", usage.Instrument.InstrumentConfig.Id)
	} else {
		fmt.Printf("[PDF] ❌ InstrumentConfig NULL after preload\n")
	}

	if usage.Instrument.BridgePCID != "" {
		return s.generateBridgePDF(usageID, resultIDs, logoPath, usage)
	}
	return s.generateDirectPDF(usageID, resultIDs, logoPath, usage)
}

// ============================================
// BRIDGE MODE
// ============================================
func (s *PDFGeneratorService) generateBridgePDF(usageID uint, resultIDs []uint, logoPath string, usage models.InstrumentUsage) (string, error) {
	var results []models.UsageResult
	var query *gorm.DB
	if len(resultIDs) > 0 {
		query = s.db.Where("id IN ?", resultIDs)
	} else {
		query = s.db.Where("instrument_usage_id = ?", usageID)
	}
	if err := query.Order("item_number ASC").Find(&results).Error; err != nil {
		return "", fmt.Errorf("failed to fetch results: %v", err)
	}

	config := usage.Instrument.InstrumentConfig
	var bridgeResults []models.UsageResult
	skippedCount := 0

	for _, result := range results {
		if result.BridgeReadingID == nil {
			// Manual input — include as-is, buildPDFData will parse it as direct
			bridgeResults = append(bridgeResults, result)
			continue
		}
		var bridge models.BridgeReading
		if err := s.db.First(&bridge, *result.BridgeReadingID).Error; err != nil {
			skippedCount++
			continue
		}
		if config != nil && config.RegexPattern != "" && config.PDFColumns != nil {
			bridge = s.enrichBridgeReadingWithSiblings(bridge, result.ItemNumber, result.InstrumentUsageID, config)
		}
		if bridge.Value == "" && bridge.AdditionalData == nil {
			skippedCount++
			continue
		}
		result.BridgeReading = bridge
		bridgeResults = append(bridgeResults, result)
	}

	if len(bridgeResults) == 0 {
		return "", fmt.Errorf("no valid readings found for this usage")
	}

	pdfData := s.buildPDFData(usage, bridgeResults, logoPath, true)

	return s.createPDF(pdfData, usageID, "Bridge")
}

func (s *PDFGeneratorService) enrichBridgeReadingWithSiblings(primary models.BridgeReading, itemNumber int, usageID uint, config *models.InstrumentConfig) models.BridgeReading {
	var linkedBridgeIDs []uint
	s.db.Table("usage_results").
		Where("instrument_usage_id = ? AND item_number = ?", usageID, itemNumber).
		Pluck("bridge_reading_id", &linkedBridgeIDs)

	if len(linkedBridgeIDs) <= 1 {
		windowSize := uint(15)
		var nearby []models.BridgeReading
		s.db.Where("id BETWEEN ? AND ? AND pc_id = ?", primary.Id, primary.Id+windowSize, primary.PCID).
			Order("id ASC").Find(&nearby)
		rawLines := s.collectRawLines([]models.BridgeReading{primary})
		for _, nb := range nearby {
			if nb.Id == primary.Id {
				continue
			}
			rawLines = append(rawLines, s.collectRawLines([]models.BridgeReading{nb})...)
		}
		return s.buildEnrichedBridgeReading(primary, rawLines, itemNumber)
	}

	var siblings []models.BridgeReading
	s.db.Where("id IN ?", linkedBridgeIDs).Order("id ASC").Find(&siblings)
	return s.buildEnrichedBridgeReading(primary, s.collectRawLines(siblings), itemNumber)
}

func (s *PDFGeneratorService) collectRawLines(readings []models.BridgeReading) []string {
	seen := map[string]bool{}
	var lines []string
	for _, r := range readings {
		if r.Value != "" && !seen[r.Value] {
			lines = append(lines, r.Value)
			seen[r.Value] = true
		}
		if r.AdditionalData != nil {
			var ad map[string]interface{}
			if json.Unmarshal(r.AdditionalData, &ad) == nil {
				if rd, ok := ad["raw_data"].(string); ok && rd != "" && !seen[rd] {
					lines = append(lines, rd)
					seen[rd] = true
				}
			}
		}
	}
	return lines
}

func (s *PDFGeneratorService) buildEnrichedBridgeReading(primary models.BridgeReading, rawLines []string, itemNumber int) models.BridgeReading {
	if len(rawLines) == 0 {
		return primary
	}
	enrichedAD := map[string]interface{}{}
	if primary.AdditionalData != nil {
		json.Unmarshal(primary.AdditionalData, &enrichedAD)
	}
	enrichedAD["raw_data"] = strings.Join(rawLines, "\n")
	enrichedBytes, _ := json.Marshal(enrichedAD)
	primary.AdditionalData = enrichedBytes
	fmt.Printf("[PDF Bridge] Item #%d: enriched with %d raw lines\n", itemNumber, len(rawLines))
	return primary
}

// ============================================
// DIRECT MODE
// ============================================
func (s *PDFGeneratorService) generateDirectPDF(usageID uint, resultIDs []uint, logoPath string, usage models.InstrumentUsage) (string, error) {
	var results []models.UsageResult
	var query *gorm.DB
	if len(resultIDs) > 0 {
		query = s.db.Where("id IN ?", resultIDs) // cukup filter by ID
	} else {
		query = s.db.Where("instrument_usage_id = ?", usageID) // fallback normal read
	}
	if err := query.Order("item_number ASC").Find(&results).Error; err != nil {
		return "", fmt.Errorf("failed to fetch results: %v", err)
	}
	pdfData := s.buildPDFData(usage, results, logoPath, false)
	return s.createPDF(pdfData, usageID, "Direct")
}

// ============================================
// BUILD PDF DATA
// ============================================
func (s *PDFGeneratorService) buildPDFData(usage models.InstrumentUsage, results []models.UsageResult, logoPath string, isBridge bool) *PDFData {
	var sampel []string
	if len(usage.Sampel) > 0 {
		json.Unmarshal([]byte(usage.Sampel), &sampel)
	}

	var additionalData map[string]interface{}
	if string(usage.AdditionalData) != "{}" {
		json.Unmarshal([]byte(usage.AdditionalData), &additionalData)
	} else {
		additionalData = make(map[string]interface{})
	}

	var initialChecklist []models.ChecklistResponse
	if string(usage.InitialCondition) != "" && string(usage.InitialCondition) != "null" {
		if err := json.Unmarshal([]byte(usage.InitialCondition), &initialChecklist); err != nil {
			var checklistMap map[string]struct {
				Note  string      `json:"note"`
				OK    bool        `json:"ok"`
				Value interface{} `json:"value"`
			}
			if err := json.Unmarshal([]byte(usage.InitialCondition), &checklistMap); err == nil {
				for key, item := range checklistMap {
					id := 0
					if _, err := fmt.Sscanf(key, "item_%d", &id); err == nil {
						initialChecklist = append(initialChecklist, models.ChecklistResponse{
							ID: id, Value: item.Value, OK: item.OK, Note: item.Note,
						})
					}
				}
				sort.Slice(initialChecklist, func(i, j int) bool {
					return initialChecklist[i].ID < initialChecklist[j].ID
				})
			}
		}
	}

	resultData := make([]ResultData, 0, len(results))
	for _, result := range results {
		// Manual input results (no bridge reading) always use direct parsing
		if isBridge && result.BridgeReadingID != nil {
			resultData = append(resultData, s.parseBridgeResult(result, usage.Instrument.InstrumentConfig))
		} else {
			resultData = append(resultData, s.parseDirectResult(result))
		}
	}

	endTime := time.Now()
	if usage.EndTime != nil {
		endTime = *usage.EndTime
	}

	finalCondition := "OK"
	var finalChecklist []models.ChecklistResponse
	if usage.FinalCondition != "" {
		var finalConditionData map[string]interface{}
		if err := json.Unmarshal([]byte(usage.FinalCondition), &finalConditionData); err == nil {
			if status, ok := finalConditionData["status"].(string); ok && status != "" {
				finalCondition = status
			}
			if checklistRaw, ok := finalConditionData["checklist_results"]; ok {
				checklistBytes, _ := json.Marshal(checklistRaw)
				var checklistData struct {
					Items []struct {
						ID    int         `json:"id"`
						Label string      `json:"label"`
						Type  string      `json:"type"`
						Value interface{} `json:"value"`
						Notes string      `json:"notes"`
					} `json:"items"`
				}
				if err := json.Unmarshal(checklistBytes, &checklistData); err == nil {
					for i, item := range checklistData.Items {
						ok := false
						if item.Type == "boolean" {
							ok, _ = item.Value.(bool)
						} else if item.Type == "text" || item.Type == "number" {
							ok = fmt.Sprintf("%v", item.Value) != ""
						}
						finalChecklist = append(finalChecklist, models.ChecklistResponse{
							ID: i + 1, Value: item.Value, OK: ok, Note: item.Notes,
						})
					}
				}
			}
		} else {
			finalCondition = usage.FinalCondition
		}
	}

	return &PDFData{
		LogoPath: logoPath, CompanyName: "Bintang Toedjoe", SiteName: usage.Instrument.LokasiSite,
		InstrumentName: usage.Instrument.Nama, InstrumentCode: usage.Instrument.KodeInstrument,
		InstrumentType: usage.Instrument.Type, SerialNumber: usage.Instrument.NomorSeri,
		Brand: usage.Instrument.Merk, Location: usage.Instrument.LokasiInstrument,
		CalibrationDate: usage.Instrument.TanggalKalibrasi, CalibrationExpiry: usage.Instrument.TenggatKalibrasi,
		PICInstrument: usage.Instrument.PICUser.Name, UsageID: usage.Id,
		KategoriSampel: usage.KategoriSampel, Sampel: sampel,
		UserName: usage.User.Name, UserRole: usage.User.Role,
		StartTime: usage.StartTime, EndTime: endTime, TotalItems: len(resultData),
		InitialChecklist: initialChecklist, AdditionalData: additionalData,
		Instrument: usage.Instrument, Results: resultData,
		FinalCondition: finalCondition, FinalChecklist: finalChecklist,
	}
}

// ============================================
// PARSE HELPERS
// ============================================
func (s *PDFGeneratorService) parseBridgeResult(result models.UsageResult, config *models.InstrumentConfig) ResultData {
	bridge := result.BridgeReading
	rawValue := bridge.Value
	if rawValue == "" {
		rawValue = "N/A"
	}

	parsedData := map[string]interface{}{}
	if bridge.AdditionalData != nil {
		var additionalMap map[string]interface{}
		if err := json.Unmarshal(bridge.AdditionalData, &additionalMap); err == nil {
			for k, v := range additionalMap {
				if k != "read_at" && k != "pc_id" {
					parsedData[k] = v
				}
			}
		}
	}

	if config != nil && config.RegexPattern != "" && config.PDFColumns != nil {
		rawText := rawValue
		if rd, ok := parsedData["raw_data"].(string); ok && rd != "" {
			rawText = rd
		}
		if rawText != "" && rawText != "N/A" {
			extracted := s.extractFieldsFromRaw(rawText, config)
			for k, v := range extracted {
				if _, exists := parsedData[k]; !exists {
					parsedData[k] = v
				}
			}
		}
	}

	meaningfulKeys := 0
	for k := range parsedData {
		if k != "read_at" && k != "pc_id" && k != "unit" && k != "raw_data" && k != "_raw_value" {
			meaningfulKeys++
		}
	}
	if meaningfulKeys == 0 {
		parsedData["value"] = rawValue
	} else {
		parsedData["_raw_value"] = rawValue
	}

	parsedData["read_at"] = bridge.ReadAt.Format("2006-01-02 15:04:05")
	parsedData["pc_id"] = bridge.PCID
	if bridge.Unit != nil {
		parsedData["unit"] = *bridge.Unit
	}

	return ResultData{
		ItemNumber: result.ItemNumber, NoQCBatch: result.NoQCBatch,
		RawData: rawValue, ParsedData: parsedData, Timestamp: bridge.ReadAt,
		IsReread: result.IsReread, HasError: rawValue == "N/A",
		ErrorMsg: func() string {
			if rawValue == "N/A" {
				return "No reading value"
			}
			return ""
		}(),
	}
}
func (s *PDFGeneratorService) extractFieldsFromRaw(rawText string, config *models.InstrumentConfig) map[string]interface{} {
	result := map[string]interface{}{}
	globalRe, err := regexp.Compile(config.RegexPattern)
	if err != nil {
		return result
	}

	type pdfColDef struct {
		Key     string `json:"key"`
		Regex   string `json:"regex"`
		Enabled bool   `json:"enabled"`
	}
	var cols []pdfColDef
	if err := json.Unmarshal(config.PDFColumns, &cols); err != nil {
		return result
	}

	hasPerColumnRegex := false
	for _, col := range cols {
		if col.Enabled && col.Regex != "" {
			hasPerColumnRegex = true
			break
		}
	}

	if hasPerColumnRegex {
		// Per-column regex — unchanged, works correctly
		for _, col := range cols {
			if !col.Enabled || col.Key == "" || col.Regex == "" {
				continue
			}
			colRe, err := regexp.Compile(col.Regex)
			if err != nil {
				continue
			}
			if m := colRe.FindStringSubmatch(rawText); len(m) > 1 {
				result[col.Key] = strings.TrimSpace(m[1])
			}
		}
	} else {
		// ✅ FIX: Global alternation regex — iterate ALL matches, extract named groups
		groupNames := globalRe.SubexpNames()
		for _, m := range globalRe.FindAllStringSubmatch(rawText, -1) {
			for i, name := range groupNames {
				if name != "" && i < len(m) && m[i] != "" {
					if _, exists := result[name]; !exists { // first match wins
						result[name] = strings.TrimSpace(m[i])
					}
				}
			}
		}
	}
	return result
}

func (s *PDFGeneratorService) parseDirectResult(result models.UsageResult) ResultData {
	// Guard against empty result data
	if result.ResultData == "" || result.ResultData == "null" {
		return ResultData{
			ItemNumber: result.ItemNumber,
			NoQCBatch:  result.NoQCBatch,
			ParsedData: map[string]interface{}{"value": "-"},
			Timestamp:  result.CreatedAt,
			IsReread:   result.IsReread,
		}
	}

	var parsedData map[string]interface{}
	if err := json.Unmarshal([]byte(result.ResultData), &parsedData); err != nil {
		return ResultData{
			ItemNumber: result.ItemNumber, NoQCBatch: result.NoQCBatch,
			HasError: true, ErrorMsg: "Failed to parse result data", Timestamp: result.CreatedAt,
		}
	}

	cleanedData := make(map[string]interface{})
	for k, v := range parsedData {
		if isNumericKey(k) {
			continue
		}
		cleanedData[k] = v
	}

	hasError := false
	errorMsg := ""
	if errField, ok := cleanedData["error"].(bool); ok && errField {
		hasError = true
		if msg, ok := cleanedData["message"].(string); ok {
			errorMsg = msg
		}
	}

	rawData := ""
	if raw, ok := cleanedData["raw_data"]; ok && raw != nil {
		rawData = fmt.Sprintf("%v", raw)
	}

	return ResultData{
		ItemNumber: result.ItemNumber, NoQCBatch: result.NoQCBatch,
		RawData: rawData, ParsedData: cleanedData, Timestamp: result.CreatedAt,
		IsReread: result.IsReread, HasError: hasError, ErrorMsg: errorMsg,
	}
}

func isNumericKey(key string) bool {
	if key == "" {
		return false
	}
	dotSeen := false
	for _, r := range key {
		if r == '.' {
			if dotSeen {
				return false
			}
			dotSeen = true
			continue
		}
		if !unicode.IsDigit(r) {
			return false
		}
	}
	return true
}

// ============================================
// CREATE PDF — always copies to file_path
// ============================================
func (s *PDFGeneratorService) createPDF(data *PDFData, usageID uint, mode string) (string, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	s.tr = pdf.UnicodeTranslatorFromDescriptor("cp1252")
	pdf.SetMargins(15, 10, 15)
	pdf.SetAutoPageBreak(false, 0)

	s.renderSinglePage(pdf, data, mode)

	sampel := "nosampel"
	if len(data.Sampel) > 0 && data.Sampel[0] != "" {
		sampel = data.Sampel[0]
	}

	batch := "nobatch"
	if len(data.Results) > 0 && data.Results[0].NoQCBatch != "" {
		batch = data.Results[0].NoQCBatch
	}

	filename := fmt.Sprintf("%s_%s_%s_%s.pdf",
		sanitizeFilename(data.InstrumentName),
		sanitizeFilename(sampel),
		sanitizeFilename(batch),
		time.Now().Format("20060102_150405"))

	outputDir := "./exports/pdf"
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create output directory: %v", err)
	}

	outputPath := filepath.Join(outputDir, filename)
	if err := pdf.OutputFileAndClose(outputPath); err != nil {
		return "", fmt.Errorf("failed to save PDF: %v", err)
	}

	fmt.Printf("[PDF] ✅ Generated: %s\n", outputPath)

	// Always copy to configured file_path / file_path_2 immediately.
	if data.Instrument.InstrumentConfig != nil {
		s.copyToConfiguredPaths(
			outputPath,
			filename,
			data.Instrument.InstrumentConfig.FilePath,
			data.Instrument.InstrumentConfig.FilePath2,
		)
	}

	return outputPath, nil
}

func (s *PDFGeneratorService) copyToConfiguredPaths(srcPath, filename, path1, path2 string) {
	for _, dir := range []string{path1, path2} {
		if dir == "" {
			continue
		}
		if err := os.MkdirAll(dir, 0755); err != nil {
			fmt.Printf("[PDF] ⚠️ Cannot create configured path %q: %v\n", dir, err)
			continue
		}
		dst := filepath.Join(dir, filename)
		if err := copyFile(srcPath, dst); err != nil {
			fmt.Printf("[PDF] ⚠️ Failed to copy PDF to %q: %v\n", dst, err)
		} else {
			fmt.Printf("[PDF] ✅ PDF saved to configured path: %s\n", dst)
		}
	}
}

func copyFile(src, dst string) error {
	// Ensure target directory exists
	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return fmt.Errorf("mkdir %s: %w", filepath.Dir(dst), err)
	}

	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	if _, err = io.Copy(out, in); err != nil {
		return err
	}
	return out.Sync()
}

// ============================================
// RENDERING (unchanged from original)
// ============================================

func (s *PDFGeneratorService) renderSinglePage(pdf *gofpdf.Fpdf, data *PDFData, mode string) {
	const (
		pageH    = 297.0
		marginB  = 8.0
		safeMaxY = pageH - marginB
	)

	pdf.AddPage()

	if data.LogoPath != "" && fileExists(data.LogoPath) {
		pdf.Image(data.LogoPath, 15, 8, 18, 0, false, "", 0, "")
	}
	pdf.SetFont("Arial", "B", 11)
	pdf.SetY(9)
	pdf.CellFormat(0, 5, data.CompanyName, "", 1, "R", false, 0, "")
	pdf.SetFont("Arial", "", 7)
	pdf.CellFormat(0, 3, "Site: "+data.SiteName, "", 1, "R", false, 0, "")

	pdf.SetY(18)
	pdf.SetFont("Arial", "B", 11)
	pdf.SetTextColor(0, 102, 204)
	pdf.CellFormat(0, 5, "INSTRUMENT TEST REPORT", "", 1, "C", false, 0, "")
	pdf.SetTextColor(0, 0, 0)

	pdf.SetY(25.0)
	currentY := s.renderTwoColumnInfo(pdf, data)

	if len(data.InitialChecklist) > 0 {
		pdf.SetXY(20, currentY+1)
		pdf.SetFont("Arial", "B", 6.5)
		pdf.Cell(0, 3.5, "Initial Condition:")
		pdf.Ln(3.5)
		s.renderChecklistItemsCompact(pdf, data.InitialChecklist, data.InstrumentName, data.Instrument.Id, 4)
		currentY = pdf.GetY()
	}
	if len(data.FinalChecklist) > 0 {
		pdf.SetXY(20, currentY+0.5)
		pdf.SetFont("Arial", "B", 6.5)
		pdf.Cell(0, 3.5, "Final Condition:")
		pdf.Ln(3.5)
		s.renderFinalChecklistItemsCompact(pdf, data.FinalChecklist, data.InstrumentName, data.Instrument.Id, 4)
		currentY = pdf.GetY()
	}

	pdf.SetXY(15, currentY+2)
	s.renderResultsSummaryInline(pdf, data)
	afterSummaryY := pdf.GetY() + 2

	pdf.SetXY(15, afterSummaryY)
	pdf.SetFont("Arial", "B", 7.5)
	pdf.SetTextColor(0, 102, 204)
	pdf.Cell(0, 5, "DETAILED TEST RESULTS")
	pdf.SetTextColor(0, 0, 0)
	pdf.Ln(5.5)

	columns := s.buildTableColumns(data.Results, data.Instrument)
	itemW, batchW := 15.0, 28.0

	fixedWidths := map[string]float64{
		"ph":          59.2,
		"ph_value":    59.2,
		"temperature": 51.8,
		"density":     59.2,
		"value":       59.2,
		"brix":        40.0,
		"nd":          40.0,
		"moisture":    55.0,
		"weight":      55.0,
	}
	for i := range columns {
		if w, ok := fixedWidths[columns[i].Key]; ok {
			columns[i].Width = w
		}
	}

	usedW := 0.0
	for _, col := range columns {
		usedW += col.Width
	}

	scale := 1.0
	timeW := 180.0 - itemW - batchW - usedW // Time mengisi sisa

	s.renderSmartTableHeader(pdf, columns, itemW, batchW, timeW, scale)
	for _, result := range data.Results {
		if pdf.GetY()+5 > safeMaxY {
			pdf.AddPage()
			pdf.SetY(12)
			s.renderSmartTableHeader(pdf, columns, itemW, batchW, timeW, scale)
		}
		s.renderSmartTableRow(pdf, result, columns, itemW, batchW, timeW, scale)
	}

	signatureH := 76.0
	afterTableY := pdf.GetY() + 4
	if afterTableY+signatureH > safeMaxY {
		pdf.AddPage()
		afterTableY = 12
	}
	pdf.SetY(afterTableY)
	s.addSignature(pdf, data)

	pdf.SetY(pdf.GetY() + 2)
	pdf.SetFont("Arial", "I", 6.5)
	pdf.SetTextColor(128, 128, 128)
	pdf.CellFormat(0, 3, "Generated by Lab Connect | "+time.Now().Format("02 Jan 2006, 15:04:05"), "", 1, "C", false, 0, "")
	pdf.SetTextColor(0, 0, 0)

}

func (s *PDFGeneratorService) renderTwoColumnInfo(pdf *gofpdf.Fpdf, data *PDFData) float64 {
	leftX, rightX := 20.0, 105.0
	currentY := 28.0
	lineHeight := 4.2

	infoItems := []struct{ label, value string }{
		{"Instrument", data.InstrumentName},
		{"No. Kontrol", data.InstrumentCode},
		{"Kategori Sampel", data.KategoriSampel},
		{"Sampel", strings.Join(data.Sampel, ", ")},
		{"Lokasi", data.Location},
		{"QC Analyst", fmt.Sprintf("%s (%s)", data.UserName, data.UserRole)},
		{"PIC", data.PICInstrument},
		{"Cal. Expiry", data.CalibrationExpiry.Format("02/01/2006")},
		{"Start Time", data.StartTime.Format("02/01/06 15:04")},
		{"End Time", data.EndTime.Format("02/01/06 15:04")},
		{"Duration", fmt.Sprintf("%.0f min", data.EndTime.Sub(data.StartTime).Minutes())},
		{"Total Items", fmt.Sprintf("%d items", data.TotalItems)},
	}

	for i, item := range infoItems {
		x := leftX
		if i%2 == 1 {
			x = rightX
		}
		pdf.SetXY(x, currentY)
		pdf.SetFont("Arial", "B", 6.5)
		pdf.Cell(28, lineHeight, item.label+":")
		pdf.SetFont("Arial", "", 6.5)
		pdf.Cell(50, lineHeight, item.value)
		if i%2 == 1 {
			currentY += lineHeight
		}
	}
	return currentY
}

func (s *PDFGeneratorService) renderChecklistItemsCompact(pdf *gofpdf.Fpdf, checklist []models.ChecklistResponse, instrumentName string, instrumentID uint, maxItems int) {
	leftX := 23.0
	startY := pdf.GetY()
	labels := s.getChecklistLabels(instrumentName, instrumentID) // ← now uses the parameter
	pdf.SetFont("Arial", "", 6.5)
	shown := 0
	for _, item := range checklist {
		if shown >= maxItems {
			pdf.SetXY(leftX, startY)
			pdf.Cell(0, 3.5, fmt.Sprintf("... and %d more items", len(checklist)-shown))
			startY += 3.5
			break
		}
		pdf.SetXY(leftX, startY)
		status := "x"
		if item.OK {
			pdf.SetTextColor(0, 128, 0)
			status = "v"
		} else {
			pdf.SetTextColor(255, 0, 0)
		}
		valueStr := fmt.Sprintf("%v", item.Value)
		if len(valueStr) > 25 {
			valueStr = valueStr[:22] + "..."
		}
		label := labels[item.ID]
		if label == "" {
			if item.Note != "" && len(item.Note) < 40 {
				label = item.Note
			} else {
				label = fmt.Sprintf("Item #%d", item.ID)
			}
		}
		if len(label) > 40 {
			label = label[:37] + "..."
		}
		pdf.Cell(0, 3.5, fmt.Sprintf("[%s] %s: %s", status, label, valueStr))
		pdf.SetTextColor(0, 0, 0)
		startY += 3.5
		shown++
	}
	pdf.SetY(startY)
}

func (s *PDFGeneratorService) renderFinalChecklistItemsCompact(pdf *gofpdf.Fpdf, checklist []models.ChecklistResponse, instrumentName string, instrumentID uint, maxItems int) {
	leftX := 23.0
	startY := pdf.GetY()
	labels := s.getFinalChecklistLabels(instrumentName, instrumentID) // ← now uses the parameter
	pdf.SetFont("Arial", "", 6.5)
	shown := 0
	for i, item := range checklist {
		if shown >= maxItems {
			pdf.SetXY(leftX, startY)
			pdf.Cell(0, 3.5, fmt.Sprintf("... and %d more items", len(checklist)-shown))
			startY += 3.5
			break
		}
		pdf.SetXY(leftX, startY)
		status := "x"
		if item.OK {
			pdf.SetTextColor(0, 128, 0)
			status = "v"
		} else {
			pdf.SetTextColor(255, 0, 0)
		}
		valueStr := fmt.Sprintf("%v", item.Value)
		if len(valueStr) > 25 {
			valueStr = valueStr[:22] + "..."
		}
		label := labels[i+1]
		if label == "" {
			label = fmt.Sprintf("Item #%d", i+1)
		}
		if len(label) > 40 {
			label = label[:37] + "..."
		}
		pdf.Cell(0, 3.5, fmt.Sprintf("[%s] %s: %s", status, label, valueStr))
		pdf.SetTextColor(0, 0, 0)
		startY += 3.5
		shown++
	}
	pdf.SetY(startY)
}

func (s *PDFGeneratorService) renderChecklistItems(pdf *gofpdf.Fpdf, checklist []models.ChecklistResponse, instrumentName string, instrumentID uint) {
	s.renderChecklistItemsCompact(pdf, checklist, instrumentName, instrumentID, 6)
}

func (s *PDFGeneratorService) renderFinalChecklistItems(pdf *gofpdf.Fpdf, checklist []models.ChecklistResponse, instrumentName string, instrumentID uint) {
	s.renderFinalChecklistItemsCompact(pdf, checklist, instrumentName, instrumentID, 6)
}

func (s *PDFGeneratorService) getChecklistLabels(instrumentName string, instrumentID uint) map[int]string {
	labels := make(map[int]string)

	// 1. Load by-name labels first (base)
	var cb models.InstrumentChecklistByName
	if err := s.db.Where("instrument_name = ? AND is_active = ?", instrumentName, true).First(&cb).Error; err == nil {
		var items []models.ChecklistItem
		if json.Unmarshal([]byte(cb.InitialChecklistItems), &items) == nil {
			for _, item := range items {
				labels[item.ID] = item.Label
			}
		}
	}

	// 2. Overlay individual override labels (additive, same as service logic)
	if instrumentID > 0 {
		var config models.InstrumentChecklistConfig
		if err := s.db.Where("instrument_id = ?", instrumentID).First(&config).Error; err == nil {
			if config.InitialChecklistItems != nil {
				var items []models.ChecklistItem
				if json.Unmarshal([]byte(*config.InitialChecklistItems), &items) == nil {
					for _, item := range items {
						labels[item.ID] = item.Label // override or add
					}
				}
			}
		}
	}

	return labels
}

func (s *PDFGeneratorService) getFinalChecklistLabels(instrumentName string, instrumentID uint) map[int]string {
	labels := make(map[int]string)

	var cb models.InstrumentChecklistByName
	if err := s.db.Where("instrument_name = ? AND is_active = ?", instrumentName, true).First(&cb).Error; err == nil {
		var items []models.ChecklistItem
		if json.Unmarshal([]byte(cb.FinalChecklistItems), &items) == nil {
			for i, item := range items {
				labels[i+1] = item.Label
			}
		}
	}

	if instrumentID > 0 {
		var config models.InstrumentChecklistConfig
		if err := s.db.Where("instrument_id = ?", instrumentID).First(&config).Error; err == nil {
			if config.FinalChecklistItems != nil {
				var items []models.ChecklistItem
				if json.Unmarshal([]byte(*config.FinalChecklistItems), &items) == nil {
					for _, item := range items {
						labels[item.ID] = item.Label
					}
				}
			}
		}
	}

	return labels
}

func (s *PDFGeneratorService) renderResultsSummaryInline(pdf *gofpdf.Fpdf, data *PDFData) {
	success, errors, rereads := s.calculateStats(data.Results)
	successRate := 0.0
	if data.TotalItems > 0 {
		successRate = float64(success) / float64(data.TotalItems) * 100
	}
	pdf.SetFont("Arial", "B", 7)
	pdf.Cell(22, 5, "SUMMARY:")
	pdf.SetFont("Arial", "", 7)
	pdf.Cell(30, 5, fmt.Sprintf("Total: %d", data.TotalItems))
	pdf.Cell(30, 5, fmt.Sprintf("Success: %d (%.1f%%)", success, successRate))
	pdf.Cell(28, 5, fmt.Sprintf("Failed: %d", errors))
	pdf.Cell(28, 5, fmt.Sprintf("Re-reads: %d", rereads))
	pdf.Ln(5)
}

func (s *PDFGeneratorService) renderSmartTableHeader(pdf *gofpdf.Fpdf, cols []TableColumn, itemW, batchW, timeW, scale float64) {
	pdf.SetFillColor(0, 102, 204)
	pdf.SetTextColor(255, 255, 255)
	pdf.SetFont("Arial", "B", 7)
	pdf.CellFormat(itemW, 6, "Item", "1", 0, "C", true, 0, "")
	pdf.CellFormat(batchW, 6, "Batch", "1", 0, "C", true, 0, "")
	for _, col := range cols {
		header := col.Header
		if col.Unit != "" {
			header = s.tr(fmt.Sprintf("%s (%s)", col.Header, col.Unit))
		}
		pdf.CellFormat(col.Width*scale, 6, header, "1", 0, "C", true, 0, "")
	}
	pdf.CellFormat(timeW, 6, "Time", "1", 1, "C", true, 0, "")
	pdf.SetTextColor(0, 0, 0)
	pdf.SetFont("Arial", "", 6.5)
}

func (s *PDFGeneratorService) renderSmartTableRow(pdf *gofpdf.Fpdf, result ResultData, cols []TableColumn, itemW, batchW, timeW, scale float64) {
	if result.HasError {
		pdf.SetFillColor(255, 200, 200)
	} else if result.IsReread {
		pdf.SetFillColor(255, 255, 200)
	} else {
		pdf.SetFillColor(255, 255, 255)
	}
	itemNum := fmt.Sprintf("#%d", result.ItemNumber)
	if result.IsReread {
		itemNum += "(R)"
	}
	pdf.CellFormat(itemW, 5, itemNum, "1", 0, "C", true, 0, "")
	pdf.CellFormat(batchW, 5, result.NoQCBatch, "1", 0, "L", true, 0, "")
	for _, col := range cols {
		value := s.extractValue(result.ParsedData, col)
		if result.HasError {
			value = "ERR"
		}
		align := "R"
		pdf.CellFormat(col.Width*scale, 5, value, "1", 0, align, true, 0, "")
	}
	pdf.CellFormat(timeW, 5, result.Timestamp.Format("02/01/2006 15:04"), "1", 1, "C", true, 0, "")
}

func (s *PDFGeneratorService) addSignature(pdf *gofpdf.Fpdf, data *PDFData) {
	pdf.SetFont("Arial", "B", 8)
	pdf.Ln(6)
	boxW, boxH := 85.0, 32.0
	startY := pdf.GetY()
	centerX := (210.0 - boxW) / 2
	pdf.SetXY(centerX, startY)
	s.renderSignatureBox(pdf, "TESTED BY", data.UserName, data.UserRole, data.EndTime.Format("02/01/2006"), boxW, boxH)
	pdf.SetXY(centerX, startY+boxH+6)
	pdf.SetY(startY + (boxH * 2) + 10)
	pdf.SetFont("Arial", "I", 6.5)
	pdf.SetTextColor(100, 100, 100)
}

func (s *PDFGeneratorService) renderSignatureBox(pdf *gofpdf.Fpdf, title, name, role, date string, w, h float64) {
	x, y := pdf.GetX(), pdf.GetY()
	pdf.Rect(x, y, w, h, "D")
	pdf.SetFont("Arial", "B", 7)
	pdf.SetXY(x+3, y+2)
	pdf.Cell(w-6, 4, title)
	pdf.SetFont("Arial", "", 7)
	pdf.SetXY(x+3, y+7) // ← dari y+h-14 jadi y+7
	pdf.Cell(w-6, 4, name)
	pdf.SetFont("Arial", "I", 6.5)
	pdf.SetXY(x+3, y+11) // ← sesuaikan
	pdf.Cell(w-6, 3.5, role)
	pdf.SetFont("Arial", "", 6.5)
	pdf.SetXY(x+3, y+15) // ← sesuaikan
	pdf.Cell(w-6, 3.5, date)
}

func (s *PDFGeneratorService) buildTableColumns(results []ResultData, instrument models.Instrument) []TableColumn {
	if instrument.InstrumentConfig != nil && instrument.InstrumentConfig.PDFColumns != nil {
		var columns []TableColumn
		if err := json.Unmarshal(instrument.InstrumentConfig.PDFColumns, &columns); err == nil {
			var enabled []TableColumn
			for _, col := range columns {
				if col.Enabled && col.Key != "" {
					enabled = append(enabled, col)
				}
			}
			if len(enabled) > 0 {
				return enabled
			}
		}
	}
	return s.autoDetectColumns(results, instrument.Type)
}

func (s *PDFGeneratorService) autoDetectColumns(results []ResultData, instrumentType string) []TableColumn {
	if len(results) == 0 {
		return []TableColumn{{Key: "value", Header: "Result", Width: 150, Enabled: true}}
	}
	keySet := make(map[string]bool)
	for _, result := range results {
		for key := range result.ParsedData {
			if key == "read_at" || key == "pc_id" || key == "unit" ||
				key == "_raw_value" || key == "raw_data" || key == "raw_text" ||
				key == "matched" || key == "parsed" || key == "timestamp" {
				continue
			}
			keySet[key] = true
		}
	}
	if cols := s.getColumnConfig(instrumentType, keySet); len(cols) > 0 {
		return cols
	}
	return s.generateColumns(keySet)
}

func (s *PDFGeneratorService) getColumnConfig(instrumentType string, keys map[string]bool) []TableColumn {
	switch strings.ToLower(strings.TrimSpace(instrumentType)) {
	case "timbangan", "balance", "scale":
		return []TableColumn{{Key: "value", Header: "Weight", Unit: "g", IsNumeric: true, Width: 120, Enabled: true}}
	case "refractometer", "refrakto":
		var cols []TableColumn
		if keys["brix"] {
			cols = append(cols, TableColumn{Key: "brix", Header: "Brix", Unit: "%", IsNumeric: true, Width: 50, Enabled: true})
		}
		key := "nd"
		if keys["nD"] {
			key = "nD"
		}
		if keys["nd"] || keys["nD"] {
			cols = append(cols, TableColumn{Key: key, Header: "nD", IsNumeric: true, Width: 60, Enabled: true})
		}
		tKey := "temp"
		if keys["temperature"] {
			tKey = "temperature"
		} else if keys["t"] {
			tKey = "t"
		}
		if keys["temp"] || keys["temperature"] || keys["t"] {
			cols = append(cols, TableColumn{Key: tKey, Header: "Temp", Unit: "°C", IsNumeric: true, Width: 40, Enabled: true})
		}
		if len(cols) == 0 {
			cols = append(cols, TableColumn{Key: "value", Header: "Result", Width: 150, Enabled: true})
		}
		return cols
	case "ph meter", "ph":
		return []TableColumn{
			{Key: "ph", Header: "pH", IsNumeric: true, Width: 80, Enabled: true},
			{Key: "temperature", Header: "Temp", Unit: "°C", IsNumeric: true, Width: 70, Enabled: true},
		}
	case "moisture analyzer", "moisture":
		return []TableColumn{
			{Key: "moisture", Header: "Moisture", Unit: "%", IsNumeric: true, Width: 90, Enabled: true},
			{Key: "weight", Header: "Weight", Unit: "g", IsNumeric: true, Width: 60, Enabled: true},
		}
	}
	return nil
}

func (s *PDFGeneratorService) generateColumns(keySet map[string]bool) []TableColumn {
	priority := []string{"value", "brix", "nd", "nD", "ph", "moisture", "weight", "temp", "temperature", "t"}
	var columns []TableColumn
	used := make(map[string]bool)
	for _, key := range priority {
		if keySet[key] {
			columns = append(columns, TableColumn{
				Key: key, Header: s.formatHeader(key), Unit: s.guessUnit(key),
				IsNumeric: s.isNumericField(key), Width: 80, Enabled: true,
			})
			used[key] = true
		}
	}
	for key := range keySet {
		if !used[key] {
			columns = append(columns, TableColumn{
				Key: key, Header: s.formatHeader(key), Unit: s.guessUnit(key),
				IsNumeric: s.isNumericField(key), Width: 80, Enabled: true,
			})
		}
	}
	if len(columns) == 0 {
		columns = append(columns, TableColumn{Key: "value", Header: "Result", Width: 150, Enabled: true})
	}
	return columns
}

func (s *PDFGeneratorService) extractValue(data map[string]interface{}, col TableColumn) string {
	value, exists := data[col.Key]
	if !exists {
		for k, v := range data {
			if strings.EqualFold(k, col.Key) {
				value = v
				exists = true
				break
			}
		}
	}
	if !exists {
		return "-"
	}
	switch v := value.(type) {
	case string:
		cleaned := strings.TrimSpace(v)
		if len(cleaned) > 20 {
			return cleaned[:17] + "..."
		}
		return cleaned
	case float64:
		if col.IsNumeric {
			if v == float64(int(v)) {
				return fmt.Sprintf("%d", int(v))
			}
			if col.Key == "nd" || col.Key == "nD" {
				return fmt.Sprintf("%.5f", v)
			}
			return fmt.Sprintf("%.2f", v)
		}
		return fmt.Sprintf("%v", v)
	case int:
		return fmt.Sprintf("%d", v)
	case bool:
		if v {
			return "v"
		}
		return "x"
	default:
		str := fmt.Sprintf("%v", v)
		if len(str) > 20 {
			return str[:17] + "..."
		}
		return str
	}
}

func (s *PDFGeneratorService) formatHeader(key string) string {
	m := map[string]string{
		"value": "Result", "brix": "Brix", "nd": "nD", "nD": "nD",
		"ph": "pH", "temperature": "Temperature", "temp": "Temp", "t": "Temp",
		"moisture": "Moisture", "weight": "Weight", "ar": "A.R.", "iss": "ISS",
	}
	if f, ok := m[key]; ok {
		return f
	}
	return strings.Title(strings.ReplaceAll(key, "_", " "))
}

func (s *PDFGeneratorService) guessUnit(key string) string {
	m := map[string]string{"brix": "%", "weight": "g", "moisture": "%", "temperature": "\xB0C", "temp": "°C", "t": "°C", "ar": "°", "iss": "°"}
	return m[key]
}

func (s *PDFGeneratorService) isNumericField(key string) bool {
	m := map[string]bool{
		"value": true, "brix": true, "nd": true, "nD": true, "ph": true,
		"temperature": true, "temp": true, "t": true, "moisture": true, "weight": true,
		"ar": true, "iss": true,
	}
	return m[key]
}

func (s *PDFGeneratorService) calculateStats(results []ResultData) (success, errors, rereads int) {
	for _, result := range results {
		if !result.HasError {
			success++
		} else {
			errors++
		}
		if result.IsReread {
			rereads++
		}
	}
	return
}

func sanitizeFilename(name string) string {
	return strings.NewReplacer("/", "-", "\\", "-", ":", "-", "*", "-", "?", "-", "\"", "-", "<", "-", ">", "-", "|", "-").Replace(name)
}

func fileExists(filename string) bool {
	_, err := os.Stat(filename)
	return !os.IsNotExist(err)
}
