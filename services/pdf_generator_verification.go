package services

import (
	"encoding/json"
	"fmt"
	"lab-connect/backend-api/models"
	"lab-connect/backend-api/structs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/jung-kurt/gofpdf"
	"gorm.io/gorm"
)

// GenerateVerificationPDF - Generate PDF report untuk verification
func (s *PDFGeneratorService) GenerateVerificationPDF(detail *structs.VerificationDetailResponse, logoPath string) (string, error) {
	fmt.Printf("\n========================================\n")
	fmt.Printf("[VERIFICATION PDF] Starting generation\n")
	fmt.Printf("========================================\n")
	fmt.Printf("[VERIF] Verification ID: %d\n", detail.ID)
	fmt.Printf("[VERIF] Instrument: %s (%s)\n", detail.NamaInstrument, detail.NoKontrol)
	fmt.Printf("[VERIF] Status: %s\n", detail.Status)
	fmt.Printf("[VERIF] Steps: %d\n", len(detail.Steps))
	fmt.Printf("========================================\n")

	// Sort steps by step number so they always appear sequentially
	sort.Slice(detail.Steps, func(i, j int) bool {
		return detail.Steps[i].StepNumber < detail.Steps[j].StepNumber
	})

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.SetAutoPageBreak(true, 20)
	pdf.AddPage()

	// Logo handling
	if logoPath != "" {
		if _, err := os.Stat(logoPath); err == nil {
			pdf.Image(logoPath, 15, 10, 30, 0, false, "", 0, "")
			if err := pdf.Error(); err != nil {
				fmt.Printf("[VERIF] ⚠️ Logo error (continuing without logo): %v\n", err)
				pdf.ClearError()
			}
		} else {
			fmt.Printf("[VERIF] Logo not found: %s (continuing without logo)\n", logoPath)
		}
	}

	// ========================================
	// HEADER
	// ========================================
	pdf.SetFont("Arial", "B", 18)
	pdf.SetY(20)
	pdf.SetTextColor(0, 102, 204)
	pdf.CellFormat(0, 10, "LAPORAN VERIFIKASI INSTRUMENT", "", 0, "C", false, 0, "")
	pdf.Ln(8)

	pdf.SetFont("Arial", "", 10)
	pdf.SetTextColor(100, 100, 100)
	pdf.CellFormat(0, 6, fmt.Sprintf("Verification ID: #%d", detail.ID), "", 1, "C", false, 0, "")
	pdf.SetTextColor(0, 0, 0)
	pdf.Ln(8)

	// ========================================
	// INSTRUMENT INFO
	// ========================================
	pdf.SetFont("Arial", "B", 12)
	pdf.SetFillColor(240, 240, 240)
	pdf.CellFormat(0, 8, " Informasi Instrument", "", 1, "L", true, 0, "")
	pdf.Ln(2)

	pdf.SetFont("Arial", "", 10)
	s.addRow(pdf, "Nama Instrument", detail.NamaInstrument)
	s.addRow(pdf, "Nomor Kontrol", detail.NoKontrol)
	s.addRow(pdf, "Tipe Instrument", detail.InstrumentType)
	s.addRow(pdf, "ID Instrument", fmt.Sprintf("%d", detail.InstrumentID))
	pdf.Ln(5)

	// ========================================
	// VERIFICATION INFO
	// ========================================
	pdf.SetFont("Arial", "B", 12)
	pdf.SetFillColor(240, 240, 240)
	pdf.CellFormat(0, 8, " Informasi Verifikasi", "", 1, "L", true, 0, "")
	pdf.Ln(2)

	pdf.SetFont("Arial", "", 10)
	s.addRow(pdf, "Verification ID", fmt.Sprintf("%d", detail.ID))
	s.addRow(pdf, "Diverifikasi Oleh", fmt.Sprintf("%s (User ID: %d)", detail.VerifiedBy.Name, detail.VerifiedBy.Id))
	s.addRow(pdf, "Tanggal Verifikasi", detail.VerifiedAt.Format("02 Jan 2006 15:04:05"))
	s.addRow(pdf, "Valid Hingga", detail.ValidUntil.Format("02 Jan 2006 15:04:05"))

	// Status dengan warna
	pdf.SetFont("Arial", "B", 10)
	pdf.Cell(60, 6, "Status Verifikasi")
	pdf.SetFont("Arial", "B", 10)
	if detail.Status == "Complies" {
		pdf.SetTextColor(0, 128, 0)
		pdf.Cell(0, 6, ": "+detail.Status+" (SESUAI)")
	} else {
		pdf.SetTextColor(255, 0, 0)
		pdf.Cell(0, 6, ": "+detail.Status+" (TIDAK SESUAI)")
	}
	pdf.SetTextColor(0, 0, 0)
	pdf.Ln(6)
	pdf.Ln(5)

	// ========================================
	// KONDISI RUANGAN
	// ========================================
	pdf.SetFont("Arial", "B", 12)
	pdf.SetFillColor(240, 240, 240)
	pdf.CellFormat(0, 8, " Kondisi Ruangan", "", 1, "L", true, 0, "")
	pdf.Ln(2)

	pdf.SetFont("Arial", "", 10)
	if detail.RoomTemp != nil {
		s.addRow(pdf, "Suhu Ruangan", fmt.Sprintf("%.1f C", *detail.RoomTemp))
	} else {
		s.addRow(pdf, "Suhu Ruangan", "Tidak direkam")
	}
	if detail.RoomHumidity != nil {
		s.addRow(pdf, "Kelembaban Ruangan (RH)", fmt.Sprintf("%.1f %%", *detail.RoomHumidity))
	} else {
		s.addRow(pdf, "Kelembaban Ruangan (RH)", "Tidak direkam")
	}
	pdf.Ln(5)

	// ========================================
	// VERIFICATION STEPS — summary table
	// ========================================
	pdf.SetFont("Arial", "B", 12)
	pdf.SetFillColor(240, 240, 240)
	pdf.CellFormat(0, 8, fmt.Sprintf(" Tahapan Verifikasi (%d Step)", len(detail.Steps)), "", 1, "L", true, 0, "")
	pdf.Ln(2)

	printStepTableHeader(pdf)

	pdf.SetFont("Arial", "", 8)
	compliesCount := 0

	for i, step := range detail.Steps {
		if pdf.GetY() > 245 {
			pdf.AddPage()
			printStepTableHeader(pdf)
			pdf.SetFont("Arial", "", 8)
		}

		// Step number
		pdf.CellFormat(10, 7, fmt.Sprintf("%d", step.StepNumber), "1", 0, "C", false, 0, "")

		// Step name
		stepName := step.StepName
		if len(stepName) > 28 {
			stepName = stepName[:25] + "..."
		}
		pdf.CellFormat(40, 7, stepName, "1", 0, "L", false, 0, "")

		// Status with color
		if step.Status == "Complies" || step.Status == "Completed" {
			pdf.SetTextColor(0, 128, 0)
			compliesCount++
		} else {
			pdf.SetTextColor(255, 0, 0)
		}
		pdf.CellFormat(22, 7, step.Status, "1", 0, "C", false, 0, "")
		pdf.SetTextColor(0, 0, 0)

		// Measured value / confirmation
		measuredValue := "-"
		switch step.StepType {
		case "manual_input":
			// Show the confirmation from input_data
			confirmed := extractManualInputConfirmation(step.InputData)
			measuredValue = confirmed
		default:
			if step.MeasuredValue != nil {
				measuredValue = fmt.Sprintf("%.4f", *step.MeasuredValue)
			}
		}
		pdf.CellFormat(28, 7, measuredValue, "1", 0, "C", false, 0, "")

		// Range
		rangeValue := "-"
		if step.MinValue != nil && step.MaxValue != nil {
			rangeValue = fmt.Sprintf("%.1f-%.1f", *step.MinValue, *step.MaxValue)
		}
		pdf.CellFormat(38, 7, rangeValue, "1", 0, "C", false, 0, "")

		// Completed time
		completedTime := "-"
		if step.CompletedAt != nil {
			completedTime = step.CompletedAt.Format("15:04")
		}
		pdf.CellFormat(22, 7, completedTime, "1", 0, "C", false, 0, "")

		// Reference ID
		refID := "-"
		if step.ReferenceID != nil {
			refID = fmt.Sprintf("%d", *step.ReferenceID)
		}
		pdf.CellFormat(20, 7, refID, "1", 1, "C", false, 0, "")

		// Override reason (if any)
		if step.OverrideReason != "" {
			pdf.SetFont("Arial", "I", 7)
			pdf.SetTextColor(200, 0, 0)
			pdf.MultiCell(0, 4, "  Override: "+step.OverrideReason, "", "L", false)
			pdf.SetTextColor(0, 0, 0)
			pdf.SetFont("Arial", "", 8)
		}

		fmt.Printf("[VERIF] Step %d: %s - %s\n", i+1, step.StepName, step.Status)
	}

	pdf.Ln(8)

	// ========================================
	// MANUAL INPUT DETAILS
	// ========================================
	for _, step := range detail.Steps {
		if step.StepType != "manual_input" {
			continue
		}
		inputVal := extractManualInputConfirmation(step.InputData)
		if inputVal == "Confirmed" || inputVal == "" {
			continue
		}

		pdf.SetFont("Arial", "B", 12)
		pdf.SetFillColor(240, 240, 240)
		pdf.CellFormat(0, 8, fmt.Sprintf(" Input Data — Step %d: %s", step.StepNumber, step.StepName), "", 1, "L", true, 0, "")
		pdf.Ln(2)
		pdf.SetFont("Arial", "", 10)
		s.addRow(pdf, "Nilai yang Dimasukkan", inputVal)
		if step.Description != "" {
			s.addRow(pdf, "Deskripsi", step.Description)
		}
		pdf.Ln(3)
	}

	// ========================================
	// RAW INSTRUMENT PRINTOUT (batch/multi-line steps)
	// ========================================
	for _, step := range detail.Steps {
		rawText := extractRawText(step.ResultData)
		if rawText == "" {
			rawText = extractRawText(step.ReadingData)
		}
		if rawText == "" {
			continue
		}

		pdf.SetFont("Arial", "B", 12)
		pdf.SetFillColor(240, 240, 240)
		pdf.CellFormat(0, 8, fmt.Sprintf(" Hasil Pembacaan Instrument — Step %d: %s", step.StepNumber, step.StepName), "", 1, "L", true, 0, "")
		pdf.Ln(2)

		// Monospace-style box
		pdf.SetFont("Courier", "", 8)
		pdf.SetFillColor(248, 248, 248)
		pdf.SetDrawColor(180, 180, 180)

		lines := strings.Split(rawText, "\n")
		for _, line := range lines {
			// Clean non-printable / ESC control chars
			line = sanitizePrintoutLine(line)
			if pdf.GetY() > 260 {
				pdf.AddPage()
			}
			pdf.CellFormat(0, 5, line, "", 1, "L", true, 0, "")
		}

		pdf.SetFont("Arial", "", 10)
		pdf.SetFillColor(255, 255, 255)
		pdf.SetDrawColor(0, 0, 0)
		pdf.Ln(5)
	}

	// ========================================
	// NOTES
	// ========================================
	if detail.Notes != "" {
		pdf.SetFont("Arial", "B", 12)
		pdf.SetFillColor(240, 240, 240)
		pdf.CellFormat(0, 8, " Catatan", "", 1, "L", true, 0, "")
		pdf.Ln(2)

		pdf.SetFont("Arial", "", 9)
		pdf.MultiCell(0, 5, detail.Notes, "", "L", false)
		pdf.Ln(5)
	}

	// ========================================
	// FOOTER
	// ========================================
	pdf.SetY(-35)
	pdf.SetFont("Arial", "I", 8)
	pdf.SetTextColor(128, 128, 128)
	pdf.CellFormat(0, 5, fmt.Sprintf("Dokumen digenerate pada: %s", time.Now().Format("02 Jan 2006 15:04:05")), "", 1, "C", false, 0, "")
	pdf.CellFormat(0, 5, "Sistem Lab Connect v1.0 - Quality Control System", "", 1, "C", false, 0, "")
	pdf.SetTextColor(0, 0, 0)

	if err := pdf.Error(); err != nil {
		return "", fmt.Errorf("PDF generation error: %v", err)
	}

	// Save PDF
	exportDir := "./exports/pdf"
	if err := os.MkdirAll(exportDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create export directory: %v", err)
	}

	filename := fmt.Sprintf("verification_%s_%s.pdf",
		sanitizeFilename(detail.NoKontrol),
		time.Now().Format("20060102_150405"))

	outputPath := filepath.Join(exportDir, filename)
	if err := pdf.OutputFileAndClose(outputPath); err != nil {
		return "", fmt.Errorf("failed to save PDF: %v", err)
	}

	fileInfo, err := os.Stat(outputPath)
	if err != nil {
		return "", fmt.Errorf("PDF file verification failed: %v", err)
	}
	fileSize := fileInfo.Size()
	if fileSize == 0 {
		os.Remove(outputPath)
		return "", fmt.Errorf("PDF file is empty (0 bytes)")
	}

	fmt.Printf("[VERIF] ✅ PDF saved: %s (%.2f KB)\n", outputPath, float64(fileSize)/1024)

	// Copy to instrument-configured export paths (file_path / file_path_2).
	// VerificationDetailResponse does not carry config paths, so we fetch them
	// from the instrument config record directly.
	s.copyVerifToConfiguredPaths(outputPath, filename, detail.InstrumentID)

	// Mark the verification as exported and increment the save counter.
	if err := s.db.Model(&models.InstrumentVerification{}).
		Where("id = ?", detail.ID).
		Updates(map[string]interface{}{
			"is_exported": true,
			"saved_count": gorm.Expr("saved_count + 1"),
		}).Error; err != nil {
		fmt.Printf("[VERIF] ⚠️ Failed to update export stats for verification %d: %v\n", detail.ID, err)
	} else {
		fmt.Printf("[VERIF] ✅ Export stats updated (verification %d)\n", detail.ID)
	}

	return outputPath, nil
}

// copyVerifToConfiguredPaths looks up the InstrumentConfig for the given
// instrument and copies the generated PDF to file_path and file_path_2.
func (s *PDFGeneratorService) copyVerifToConfiguredPaths(srcPath, filename string, instrumentID uint) {
	var config struct {
		FilePath  string `gorm:"column:file_path"`
		FilePath2 string `gorm:"column:file_path_2"`
	}
	if err := s.db.
		Table("instrument_configs").
		Select("file_path, file_path_2").
		Where("instrument_id = ?", instrumentID).
		First(&config).Error; err != nil {
		fmt.Printf("[VERIF] ⚠️ Could not load config for instrument %d (skipping copy): %v\n", instrumentID, err)
		return
	}
	s.copyToConfiguredPaths(srcPath, filename, config.FilePath, config.FilePath2)
}

// ========================================
// HELPERS
// ========================================

// printStepTableHeader prints the column headers for the step summary table.
func printStepTableHeader(pdf *gofpdf.Fpdf) {
	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(200, 220, 255)
	pdf.CellFormat(10, 8, "No", "1", 0, "C", true, 0, "")
	pdf.CellFormat(40, 8, "Nama Step", "1", 0, "C", true, 0, "")
	pdf.CellFormat(22, 8, "Status", "1", 0, "C", true, 0, "")
	pdf.CellFormat(28, 8, "Nilai Terukur", "1", 0, "C", true, 0, "")
	pdf.CellFormat(38, 8, "Range Min-Max", "1", 0, "C", true, 0, "")
	pdf.CellFormat(22, 8, "Waktu", "1", 0, "C", true, 0, "")
	pdf.CellFormat(20, 8, "Ref ID", "1", 1, "C", true, 0, "")
}

// extractManualInputConfirmation returns a human-readable confirmation string
// from the input_data stored for a manual_input (checkbox) step.
func extractManualInputConfirmation(inputData interface{}) string {
	if inputData == nil {
		return "Confirmed"
	}
	fmt.Printf("[PDF DEBUG] InputData type: %T, value: %v\n", inputData, inputData)
	// Normalize: if []byte, unmarshal first
	var m map[string]interface{}
	switch v := inputData.(type) {
	case map[string]interface{}:
		m = v
	case []byte:
		if err := json.Unmarshal(v, &m); err != nil {
			return "Confirmed"
		}
	default:
		return "Confirmed"
	}

	if checked, ok := m["checked"].(bool); ok {
		if checked {
			return "✓ Confirmed"
		}
		return "✗ Not confirmed"
	}
	if val, ok := m["value"]; ok && val != nil {
		return fmt.Sprintf("%v", val)
	}
	return "Confirmed"
}

// extractRawText pulls the raw_text string from a JSONB/map field.
func extractRawText(data interface{}) string {
	if data == nil {
		return ""
	}
	fmt.Printf("[PDF DEBUG] RawText type: %T\n", data)

	// Already a parsed map
	if m, ok := data.(map[string]interface{}); ok {
		if rt, ok := m["raw_text"].(string); ok && rt != "" {
			return rt
		}
	}

	// Raw bytes from GORM scan
	if b, ok := data.([]byte); ok {
		if len(b) == 0 {
			return ""
		}
		var m map[string]interface{}
		if err := json.Unmarshal(b, &m); err == nil {
			if rt, ok := m["raw_text"].(string); ok && rt != "" {
				return rt
			}
		}
	}

	// models.JSONB may implement Stringer or be a named type wrapping []byte
	// Try converting via fmt as last resort
	if s, ok := data.(fmt.Stringer); ok {
		raw := s.String()
		var m map[string]interface{}
		if err := json.Unmarshal([]byte(raw), &m); err == nil {
			if rt, ok := m["raw_text"].(string); ok && rt != "" {
				return rt
			}
		}
	}

	return ""
}

// sanitizePrintoutLine removes ESC/control characters that gofpdf cannot render,
// while keeping printable ASCII.
func sanitizePrintoutLine(line string) string {
	var out strings.Builder
	for _, r := range line {
		if r >= 32 && r < 127 {
			out.WriteRune(r)
		} else if r == '\t' {
			out.WriteString("  ")
		}
		// drop everything else (ESC sequences, degree symbol bytes, etc.)
	}
	return out.String()
}

// addRow helper for label-value rows
func (s *PDFGeneratorService) addRow(pdf *gofpdf.Fpdf, label, value string) {
	pdf.SetFont("Arial", "B", 10)
	pdf.Cell(60, 6, label)
	pdf.SetFont("Arial", "", 10)
	pdf.Cell(0, 6, ": "+value)
	pdf.Ln(6)
}
