package audit

import (
	"context"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"

	domain "emertrack/internal/domain"
	dto "emertrack/internal/dto"
)


type auditService struct {
	repo domain.AuditRepository
}

func NewAuditService(r domain.AuditRepository) domain.AuditService {
	return &auditService{repo: r}
}

func (s *auditService) Log(ctx context.Context, userID uint, action, menu, desc string, entityID *uint) error {
	log := &domain.AuditLog{
		UserID:      userID,
		Action:      action,
		Menu:        menu,
		Description: desc,
		EntityID:    entityID,
	}
	return s.repo.Log(ctx, log)
}

func (s *auditService) List(ctx context.Context, startDate, endDate string, entityID *uint, page, pageSize int) (*dto.PaginatedResponse, error) {
	data, total, err := s.repo.List(ctx, startDate, endDate, entityID, page, pageSize)
	if err != nil {
		return nil, err
	}
	if pageSize < 1 {
		pageSize = 20
	}
	totalPages := int(math.Ceil(float64(total) / float64(pageSize)))
	return &dto.PaginatedResponse{
		Data:       data,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: totalPages,
	}, nil
}

func (s *auditService) ExportExcel(ctx context.Context, startDate, endDate string, entityID *uint) (*excelize.File, error) {
	data, err := s.repo.Export(ctx, startDate, endDate, entityID)
	if err != nil {
		return nil, err
	}

	f := excelize.NewFile()
	sheet := "Sheet1"

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
	infoStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Size: 9, Italic: true},
		Alignment: &excelize.Alignment{Horizontal: "right", Vertical: "center"},
	})

	f.SetRowHeight(sheet, 1, 15)
	f.SetRowHeight(sheet, 2, 40)

	f.MergeCell(sheet, "A1", "F1")
	f.SetCellValue(sheet, "A1", "AUDIT TRAIL REPORT")
	f.SetCellStyle(sheet, "A1", "F1", titleStyle)

	f.MergeCell(sheet, "A2", "F2")
	f.SetCellValue(sheet, "A2", fmt.Sprintf("Dicetak pada: %s", time.Now().Format("02 Jan 2006 15:04:05")))
	f.SetCellStyle(sheet, "A2", "F2", infoStyle)

	headers := []string{"No", "Waktu", "User", "Departemen", "Modul / Aksi", "Deskripsi"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 4)
		f.SetCellValue(sheet, cell, h)
	}
	f.SetCellStyle(sheet, "A4", "F4", headerStyle)
	f.SetRowHeight(sheet, 4, 25)

	f.SetColWidth(sheet, "A", "A", 6)
	f.SetColWidth(sheet, "B", "B", 22)
	f.SetColWidth(sheet, "C", "C", 22)
	f.SetColWidth(sheet, "D", "D", 22)
	f.SetColWidth(sheet, "E", "E", 24)
	f.SetColWidth(sheet, "F", "F", 60)

	rowIdx := 5
	for i, d := range data {
		actionText := strings.ReplaceAll(d.Action, "_", " ")
		actionText = strings.ToUpper(actionText)

		f.SetCellValue(sheet, fmt.Sprintf("A%d", rowIdx), i+1)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", rowIdx), d.CreatedAt)
		f.SetCellValue(sheet, fmt.Sprintf("C%d", rowIdx), d.User.Name)
		f.SetCellValue(sheet, fmt.Sprintf("D%d", rowIdx), d.User.Department)
		f.SetCellValue(sheet, fmt.Sprintf("E%d", rowIdx), fmt.Sprintf("%s / %s", d.Menu, actionText))
		f.SetCellValue(sheet, fmt.Sprintf("F%d", rowIdx), d.Description)

		rowHeight := calcRowHeight([]struct {
			text  string
			colCh int
		}{
			{d.User.Name, 22},
			{d.User.Department, 22},
			{fmt.Sprintf("%s / %s", d.Menu, actionText), 24},
			{d.Description, 60},
		})
		f.SetRowHeight(sheet, rowIdx, rowHeight)

		f.SetCellStyle(sheet, fmt.Sprintf("A%d", rowIdx), fmt.Sprintf("A%d", rowIdx), centerBorderStyle)
		f.SetCellStyle(sheet, fmt.Sprintf("B%d", rowIdx), fmt.Sprintf("B%d", rowIdx), centerBorderStyle)
		f.SetCellStyle(sheet, fmt.Sprintf("C%d", rowIdx), fmt.Sprintf("D%d", rowIdx), borderStyle)
		f.SetCellStyle(sheet, fmt.Sprintf("E%d", rowIdx), fmt.Sprintf("E%d", rowIdx), centerBorderStyle)
		f.SetCellStyle(sheet, fmt.Sprintf("F%d", rowIdx), fmt.Sprintf("F%d", rowIdx), borderStyle)

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
	colCh int
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
