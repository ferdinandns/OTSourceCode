package report

import (
	"context"
	_ "embed"
	"fmt"
	"strings"
	"time"

	"emertrack/internal/domain"
	"github.com/xuri/excelize/v2"
)

//go:embed assets/logo-kch.png
var logoImage []byte

type reportService struct {
	repo        domain.ReportRepository
	sarprasRepo domain.SarprasRepository
}

func NewService(repo domain.ReportRepository, sarprasRepo domain.SarprasRepository) domain.ReportService {
	return &reportService{repo: repo, sarprasRepo: sarprasRepo}
}

func (s *reportService) GetSarprasReport(
	ctx context.Context,
	deptID, status, scheduleStatus, startDate, endDate string,
) ([]domain.ReportSarprasRow, error) {

	data, err := s.repo.GetSarprasReport(ctx, deptID, status, scheduleStatus, startDate, endDate)
	if err != nil {
		return nil, err
	}

	if len(data) == 0 {
		return []domain.ReportSarprasRow{}, nil
	}

	return data, nil
}

func (s *reportService) ExportExcel(ctx context.Context, deptID, status, scheduleStatus, startDate, endDate, userName string) (*excelize.File, error) {
	data, err := s.GetSarprasReport(ctx, deptID, status, scheduleStatus, startDate, endDate)
	if err != nil {
		return nil, err
	}

	f := excelize.NewFile()
	sheet := "Sheet1"

	// Disable gridlines for a cleaner appearance.
	_ = f.SetSheetView(sheet, 0, &excelize.ViewOptions{
		ShowGridLines: &[]bool{false}[0],
	})

	titleStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 14, Color: "003D7A"},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Color: "FFFFFF"},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"003D7A"}, Pattern: 1},
		Border: []excelize.Border{
			{Type: "left", Color: "CCCCCC", Style: 1}, {Type: "top", Color: "CCCCCC", Style: 1},
			{Type: "bottom", Color: "CCCCCC", Style: 1}, {Type: "right", Color: "CCCCCC", Style: 1},
		},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})
	borderStyle, _ := f.NewStyle(&excelize.Style{
		Border: []excelize.Border{
			{Type: "left", Color: "E2E8F0", Style: 1}, {Type: "top", Color: "E2E8F0", Style: 1},
			{Type: "bottom", Color: "E2E8F0", Style: 1}, {Type: "right", Color: "E2E8F0", Style: 1},
		},
		Alignment: &excelize.Alignment{Vertical: "center", WrapText: true},
	})
	centerBorderStyle, _ := f.NewStyle(&excelize.Style{
		Border: []excelize.Border{
			{Type: "left", Color: "E2E8F0", Style: 1}, {Type: "top", Color: "E2E8F0", Style: 1},
			{Type: "bottom", Color: "E2E8F0", Style: 1}, {Type: "right", Color: "E2E8F0", Style: 1},
		},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})
	// Orange text and italics to distinguish rows where the reason starts with "Habis Digunakan".
	usedStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Color: "C05621", Italic: true},
		Border: []excelize.Border{
			{Type: "left", Color: "E2E8F0", Style: 1}, {Type: "top", Color: "E2E8F0", Style: 1},
			{Type: "bottom", Color: "E2E8F0", Style: 1}, {Type: "right", Color: "E2E8F0", Style: 1},
		},
		Alignment: &excelize.Alignment{Vertical: "center", WrapText: true},
	})
	infoStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Size: 9, Italic: true},
		Alignment: &excelize.Alignment{Horizontal: "right", Vertical: "center"},
	})

	f.SetRowHeight(sheet, 1, 15)
	f.SetRowHeight(sheet, 2, 70)
	f.MergeCell(sheet, "A2", "C2")
	errLogo := f.AddPictureFromBytes(sheet, "A2", &excelize.Picture{
		Extension: ".png",
		File:      logoImage,
		Format: &excelize.GraphicOptions{
			ScaleX:  0.15,
			ScaleY:  0.3,
			OffsetX: 68,
			OffsetY: 10,
		},
	})
	if errLogo != nil {
		fmt.Println("Warning: Logo gagal dimuat:", errLogo)
		f.SetCellValue(sheet, "A2", "KALBE CONSUMER HEALTH")
	}

	f.MergeCell(sheet, "D2", "H2")
	f.SetCellValue(sheet, "D2", "LAPORAN PEMERIKSAAN SARPRAS EMERGENCY")
	f.SetCellStyle(sheet, "D2", "D2", titleStyle)

	f.SetCellValue(sheet, "I2", "Tanggal Cetak :\n "+time.Now().Format("02 Jan 2006 15:04"))
	f.SetCellStyle(sheet, "I2", "I2", infoStyle)

	f.SetRowHeight(sheet, 3, 20)
	f.MergeCell(sheet, "I3", "I3")
	f.SetCellValue(sheet, "I3", fmt.Sprintf("Dicetak oleh :\n %s", userName))
	f.SetCellStyle(sheet, "I3", "I3", infoStyle)

	f.SetColWidth(sheet, "A", "A", 8)
	f.SetColWidth(sheet, "B", "B", 22)
	f.SetColWidth(sheet, "C", "C", 24)
	f.SetColWidth(sheet, "D", "D", 22)
	f.SetColWidth(sheet, "E", "E", 14)
	f.SetColWidth(sheet, "F", "F", 18)
	f.SetColWidth(sheet, "G", "G", 22)
	f.SetColWidth(sheet, "H", "H", 22)
	f.SetColWidth(sheet, "I", "I", 60)

	headers := []string{"No", "Nama Sarpras", "Nomor Sarpras", "Departemen", "Site", "Status", "Nama Pemeriksa", "Tanggal Diperiksa", "Keterangan Parameter NOK & Justifikasi"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 4)
		f.SetCellValue(sheet, cell, h)
	}
	f.SetCellStyle(sheet, "A4", "I4", headerStyle)
	f.SetRowHeight(sheet, 4, 25)

	rowIdx := 5
	for i, row := range data {
		tgl := "-"
		if row.TanggalPeriksa != nil {
			tgl = row.TanggalPeriksa.Format("02/01/2006")
		}

		var keterangan string
		isUsed := false
		if row.Status == "ready" {
			keterangan = "-"
		} else if len(row.NOKParameters) > 0 {
			keterangan = strings.Join(row.NOKParameters, ", ")
			isUsed = strings.HasPrefix(keterangan, "Habis Digunakan:")
		} else {
			keterangan = "-"
		}

		statusFormat := strings.ReplaceAll(row.Status, "_", " ")
		if len(statusFormat) > 0 {
			statusFormat = strings.ToUpper(statusFormat[:1]) + statusFormat[1:]
		}

		f.SetCellValue(sheet, fmt.Sprintf("A%d", rowIdx), i+1)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", rowIdx), row.JenisSarpras)
		f.SetCellValue(sheet, fmt.Sprintf("C%d", rowIdx), row.NomorSarpras)
		f.SetCellValue(sheet, fmt.Sprintf("D%d", rowIdx), row.Department)
		f.SetCellValue(sheet, fmt.Sprintf("E%d", rowIdx), row.Site)
		f.SetCellValue(sheet, fmt.Sprintf("F%d", rowIdx), statusFormat)
		f.SetCellValue(sheet, fmt.Sprintf("G%d", rowIdx), row.NamaPemeriksa)
		f.SetCellValue(sheet, fmt.Sprintf("H%d", rowIdx), tgl)
		f.SetCellValue(sheet, fmt.Sprintf("I%d", rowIdx), keterangan)

		// Estimate row height so long text wraps without clipping.
		rowHeight := calcRowHeight([]struct {
			text  string
			colCh int
		}{
			{row.JenisSarpras, 22},
			{row.NomorSarpras, 24},
			{row.Department, 22},
			{row.NamaPemeriksa, 22},
			{keterangan, 60},
		})
		f.SetRowHeight(sheet, rowIdx, rowHeight)

		f.SetCellStyle(sheet, fmt.Sprintf("A%d", rowIdx), fmt.Sprintf("A%d", rowIdx), centerBorderStyle)
		f.SetCellStyle(sheet, fmt.Sprintf("B%d", rowIdx), fmt.Sprintf("D%d", rowIdx), borderStyle)
		f.SetCellStyle(sheet, fmt.Sprintf("E%d", rowIdx), fmt.Sprintf("H%d", rowIdx), centerBorderStyle)

		if isUsed {
			f.SetCellStyle(sheet, fmt.Sprintf("I%d", rowIdx), fmt.Sprintf("I%d", rowIdx), usedStyle)
		} else {
			f.SetCellStyle(sheet, fmt.Sprintf("I%d", rowIdx), fmt.Sprintf("I%d", rowIdx), borderStyle)
		}

		rowIdx++
	}

	return f, nil
}

// calcRowHeight estimates the row height (in points) needed to wrap text across
// multiple cells. It approximates the number of text lines per column based on
// column width and average character width, then returns the maximum across
// all columns plus padding.
func calcRowHeight(cols []struct {
	text  string
	colCh int // column width in Excel character units
}) float64 {
	const (
		lineHeightPt   = 15.0
		paddingPt      = 4.0
		minHeight      = 20.0
		pxPerColUnit   = 7.0
		colMarginPx    = 5.0
		avgCharWidthPx = 6.5
	)

	maxLines := 1
	for _, col := range cols {
		if col.colCh <= 0 || col.text == "" {
			continue
		}
		colWidthPx := float64(col.colCh)*pxPerColUnit + colMarginPx
		charsPerLine := int(colWidthPx / avgCharWidthPx)
		if charsPerLine < 1 {
			charsPerLine = 1
		}

		runeCount := len([]rune(col.text))
		lines := (runeCount + charsPerLine - 1) / charsPerLine
		if lines < 1 {
			lines = 1
		}
		if lines > maxLines {
			maxLines = lines
		}
	}

	height := float64(maxLines)*lineHeightPt + paddingPt
	if height < minHeight {
		height = minHeight
	}
	return height
}
