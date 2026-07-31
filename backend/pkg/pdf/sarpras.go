package pdfgen

import (
	_ "embed"
	"fmt"
	"strings"
	"time"
	_ "embed"

	"emertrack/internal/domain"

	"github.com/johnfercher/maroto/v2"
	"github.com/johnfercher/maroto/v2/pkg/components/image"
	"github.com/johnfercher/maroto/v2/pkg/components/line"
	"github.com/johnfercher/maroto/v2/pkg/components/text"
	"github.com/johnfercher/maroto/v2/pkg/consts/align"
	"github.com/johnfercher/maroto/v2/pkg/consts/extension"
	"github.com/johnfercher/maroto/v2/pkg/consts/fontstyle"
	"github.com/johnfercher/maroto/v2/pkg/props"
)

//go:embed assets/logo-kch.png
var logoBytes []byte

// SarprasReportParams parameter untuk generate laporan PDF
type SarprasReportParams struct {
	Items       []domain.SarprasRow
	PrinterName string
	DeptName    string
	TypeName    string
	SiteName    string
	SortBy      string
	SortOrder   string
}

// Lebar kolom dalam satuan maroto grid (total = 12)
// No | Nama | Nomor Seri | Site | Departemen | Risk | Detail Lokasi
const (
	colNo     = 1
	colNama   = 2
	colSerial = 2
	colSite   = 2 // diperlebar: cukup tampung "B7 Cikarang" dalam 1 baris
	colDept   = 2
	colRisk   = 1 // dipersempit: teks "very_high" pendek
	colDetail = 2
)

// GenerateSarprasReport menghasilkan file PDF laporan sarpras
func GenerateSarprasReport(params SarprasReportParams) ([]byte, error) {
	m := maroto.New()
	now := time.Now().Format("02 Jan 2006 15:04")

	// ── Logo ─────────────────────────────────────────────────────────────────
	m.AddRow(18,
		text.NewCol(4, ""),
		image.NewFromBytesCol(4, logoBytes, extension.Png, props.Rect{
			Percent: 90,
			Center:  true,
		}),
		text.NewCol(4, ""),
	)
	m.AddRow(3, text.NewCol(12, ""))

	// ── Judul ────────────────────────────────────────────────────────────────
	title := "List Sarana Prasarana Emergency"
	if params.SiteName != "" {
		title += " - " + strings.ToUpper(params.SiteName)
	}
	m.AddRow(10, text.NewCol(12, title, props.Text{
		Size:  13,
		Style: fontstyle.Bold,
		Align: align.Center,
		Color: &props.Color{Red: 0, Green: 61, Blue: 122},
	}))
	m.AddRow(2, line.NewCol(12, props.Line{
		Thickness: 1.2,
		Color:     &props.Color{Red: 0, Green: 61, Blue: 122},
	}))
	m.AddRow(4, text.NewCol(12, ""))

	// ── Metadata ─────────────────────────────────────────────────────────────
	m.AddRow(8,
		text.NewCol(6, fmt.Sprintf("Departemen : %s", params.DeptName), props.Text{
			Size: 9, Style: fontstyle.Bold,
		}),
		text.NewCol(6, fmt.Sprintf("Jenis Sarpras : %s", params.TypeName), props.Text{
			Size: 9, Style: fontstyle.Bold, Align: align.Right,
		}),
	)
	m.AddRow(6,
		text.NewCol(6, fmt.Sprintf("Dicetak oleh : %s", params.PrinterName), props.Text{
			Size: 8, Style: fontstyle.Italic,
		}),
		text.NewCol(6, fmt.Sprintf("Tanggal Cetak: %s", now), props.Text{
			Size: 8, Align: align.Right, Style: fontstyle.Italic,
		}),
	)
	m.AddRow(5, text.NewCol(12, ""))

	// ── Header tabel ─────────────────────────────────────────────────────────
	headerColor := &props.Color{Red: 0, Green: 61, Blue: 122}
	m.AddRow(9,
		text.NewCol(colNo, "No", props.Text{
			Size: 9, Style: fontstyle.Bold, Align: align.Center, Color: headerColor,
		}),
		text.NewCol(colNama, "Nama Sarpras", props.Text{
			Size: 9, Style: fontstyle.Bold, Color: headerColor, Left: 2,
		}),
		text.NewCol(colSerial, "Nomor Sarpras", props.Text{
			Size: 9, Style: fontstyle.Bold, Color: headerColor, Left: 2,
		}),
		text.NewCol(colSite, "Site", props.Text{
			Size: 9, Style: fontstyle.Bold, Color: headerColor, Left: 2,
		}),
		text.NewCol(colDept, "Departemen", props.Text{
			Size: 9, Style: fontstyle.Bold, Color: headerColor, Left: 2,
		}),
		text.NewCol(colRisk, "Risk", props.Text{
			Size: 9, Style: fontstyle.Bold, Color: headerColor, Left: 1,
		}),
		text.NewCol(colDetail, "Detail Lokasi", props.Text{
			Size: 9, Style: fontstyle.Bold, Color: headerColor, Left: 2,
		}),
	)
	m.AddRow(1, line.NewCol(12, props.Line{
		Thickness: 1.0,
		Color:     &props.Color{Red: 0, Green: 61, Blue: 122},
	}))

	// ── Helper warna risk level ───────────────────────────────────────────────
	riskColor := func(level string) *props.Color {
		switch strings.ToLower(level) {
		case "low":
			return &props.Color{Red: 40, Green: 167, Blue: 69}
		case "medium":
			return &props.Color{Red: 200, Green: 120, Blue: 0}
		case "high":
			return &props.Color{Red: 220, Green: 38, Blue: 38}
		case "very_high":
			return &props.Color{Red: 160, Green: 0, Blue: 0}
		default:
			return &props.Color{Red: 60, Green: 60, Blue: 60}
		}
	}

	// Lebar fisik tiap kolom (mm) — dipakai untuk estimasi wrap
	// Total usable width ≈ 190mm (A4 portrait, margin kiri+kanan 10mm each)
	const totalMM = 190.0
	const totalCols = colNo + colNama + colSerial + colSite + colDept + colRisk + colDetail // = 12
	unit := totalMM / totalCols
	physicalWidths := []float64{
		float64(colNo) * unit,
		float64(colNama) * unit,
		float64(colSerial) * unit,
		float64(colSite) * unit,
		float64(colDept) * unit,
		float64(colRisk) * unit,
		float64(colDetail) * unit,
	}

	// ── Baris data ───────────────────────────────────────────────────────────
	for i, item := range params.Items {
		siteName := item.SiteName
		riskLabel := formatRiskLabel(string(item.RiskLevel))

		cellTexts := []string{
			fmt.Sprintf("%d", i+1),
			item.SarprasTypeName,
			item.Code,
			siteName,
			item.LocationDeptName,
			riskLabel,
			item.LocationDetail,
		}

		rowH := estimateRowHeight(cellTexts, physicalWidths, 8.0)

		// Zebra striping: baris genap sedikit lebih redup (maroto belum support bg color per row,
		// tapi kita bisa simulate dengan garis bawah yang lebih tebal di baris genap)
		separatorThickness := 0.3
		if i%2 == 0 {
			separatorThickness = 0.5
		}

		m.AddRow(rowH,
			text.NewCol(colNo, fmt.Sprintf("%d", i+1), props.Text{
				Size: 8, Align: align.Center,
				Top: (rowH - 8) / 2, // vertikal center kasar
			}),
			text.NewCol(colNama, item.SarprasTypeName, props.Text{
				Size: 8, Left: 2, Top: 1,
			}),
			text.NewCol(colSerial, item.Code, props.Text{
				Size: 8, Style: fontstyle.Bold, Left: 2, Top: 1,
			}),
			text.NewCol(colSite, siteName, props.Text{
				Size: 8, Left: 2, Top: 1,
			}),
			text.NewCol(colDept, item.LocationDeptName, props.Text{
				Size: 8, Left: 2, Top: 1,
			}),
			text.NewCol(colRisk, riskLabel, props.Text{
				Size:  8,
				Style: fontstyle.Bold,
				Color: riskColor(string(item.RiskLevel)),
				Left:  1,
				Top:   1,
			}),
			text.NewCol(colDetail, item.LocationDetail, props.Text{
				Size: 8, Style: fontstyle.Italic, Left: 2, Top: 1,
			}),
		)
		m.AddRow(1, line.NewCol(12, props.Line{
			Thickness: separatorThickness,
			Color:     &props.Color{Red: 200, Green: 210, Blue: 220},
		}))
	}

	// ── Footer: total item ────────────────────────────────────────────────────
	m.AddRow(4, text.NewCol(12, ""))
	m.AddRow(7, line.NewCol(12, props.Line{
		Thickness: 0.5,
		Color:     &props.Color{Red: 0, Green: 61, Blue: 122},
	}))
	m.AddRow(7,
		text.NewCol(8, fmt.Sprintf("Total: %d item", len(params.Items)), props.Text{
			Size: 8, Style: fontstyle.Bold,
		}),
		text.NewCol(4, "EMERTRACK", props.Text{
			Size: 8, Style: fontstyle.Italic, Align: align.Right,
			Color: &props.Color{Red: 120, Green: 120, Blue: 120},
		}),
	)

	doc, err := m.Generate()
	if err != nil {
		return nil, err
	}
	return doc.GetBytes(), nil
}

// formatRiskLabel mengubah "very_high" → "Very High"
func formatRiskLabel(level string) string {
	parts := strings.Split(level, "_")
	for i, p := range parts {
		if len(p) > 0 {
			parts[i] = strings.ToUpper(p[:1]) + strings.ToLower(p[1:])
		}
	}
	return strings.Join(parts, " ")
}

// estimateRowHeight memperkirakan tinggi baris (mm).
// Menggunakan word-wrap simulation agar hasil lebih akurat dari maroto.
func estimateRowHeight(texts []string, colWidthsMM []float64, fontSizePt float64) float64 {
	// 1pt = 0.353mm; karakter rata-rata di font sans-serif ≈ 0.52× ukuran font
	charWidthMM := fontSizePt * 0.52 * 0.353
	lineHeightMM := fontSizePt * 0.353 * 1.5

	maxLines := 1
	for i, t := range texts {
		if i >= len(colWidthsMM) || len(t) == 0 {
			continue
		}
		// Kurangi padding kiri (2mm) dan sedikit margin kanan (1mm)
		usableWidth := colWidthsMM[i] - 3
		if usableWidth < charWidthMM {
			usableWidth = charWidthMM
		}
		charsPerLine := int(usableWidth / charWidthMM)
		if charsPerLine < 1 {
			charsPerLine = 1
		}

		// Word-wrap simulation: hitung baris berdasarkan kata, bukan karakter mentah
		lines := countWrappedLines(t, charsPerLine)
		if lines > maxLines {
			maxLines = lines
		}
	}

	const paddingMM = 2.5
	return paddingMM + float64(maxLines)*lineHeightMM + paddingMM
}

// countWrappedLines mensimulasikan word-wrap dan mengembalikan jumlah baris.
func countWrappedLines(text string, charsPerLine int) int {
	words := strings.Fields(text)
	if len(words) == 0 {
		return 1
	}
	lines := 1
	currentLen := 0
	for _, w := range words {
		wLen := len([]rune(w))
		if currentLen == 0 {
			currentLen = wLen
		} else if currentLen+1+wLen <= charsPerLine {
			currentLen += 1 + wLen
		} else {
			lines++
			currentLen = wLen
		}
	}
	return lines
}
