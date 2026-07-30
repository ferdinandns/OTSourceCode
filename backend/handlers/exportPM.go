package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"

	"sample-qc-backend/models"
)

type ExportDiversifikasiPMHandler struct {
	DB *sql.DB
}

func (h *ExportDiversifikasiPMHandler) Export(c *gin.Context) {
	mode := c.DefaultQuery("mode", "all")
	from := c.Query("from")
	to := c.Query("to")
	kodeItem := c.Query("kodeItem")

	baseQuery := `
		SELECT
			pm.id, pm.nomor_pm, pm.revision, pm.parent_id, pm.status_project,
			pm.created_at, pm.kode_item, pm.nama_material,
			pm.manufacture, pm.no_batch_material,
			pm.pm_tgl_analisa, pm.pm_tgl_report,
			pm.pm_hasil_analisa, pm.pm_keterangan,
			pm.trial_kode_produk, pm.trial_no_batch, pm.trial_hasil_final,
			pm.link_file_diversifikasi, pm.kesimpulan,
			pm.created_at, pm.updated_at,
			COALESCE(
				json_agg(
					json_build_object(
						'id',                    p.id,
						'kodeProduk',            COALESCE(p.kode_produk, ''),
						'produkTglKirimQC',      p.produk_tgl_kirim_qc,
						'produkTglKeluarHasil',  p.produk_tgl_keluar_hasil,
						'evaluasiAsKemasan',     COALESCE(p.evaluasi_as_kemasan, ''),
						'produkFisik',           COALESCE(p.produk_fisik, ''),
						'produkKimia',           COALESCE(p.produk_kimia, ''),
						'produkMikrobiologi',    COALESCE(p.produk_mikrobiologi, ''),
						'produkSensori',         COALESCE(p.produk_sensori, ''),
						'produkCekKarakteristik',COALESCE(p.produk_cek_karakteristik, ''),
						'stabtestFisik',         COALESCE(p.stabtest_fisik, ''),
						'stabtestKimia',         COALESCE(p.stabtest_kimia, ''),
						'stabtestMikrobiologi',  COALESCE(p.stabtest_mikrobiologi, ''),
						'stabtestSensoriDFCT',   COALESCE(p.stabtest_sensori_dfct, ''),
						'stabtestKeterangan',    COALESCE(p.stabtest_keterangan, ''),
						'stabtestStatus',        COALESCE(p.stabtest_status, '')
					) ORDER BY p.id
				) FILTER (WHERE p.id IS NOT NULL),
				'[]'
			) AS products
		FROM diversifikasi_pm pm
		LEFT JOIN diversifikasi_produk_pm p ON p.diversifikasi_pm_id = pm.id
		WHERE pm.deleted_at IS NULL
		  AND pm.parent_id IS NULL`

	args := []interface{}{}
	argIdx := 1

	if mode == "custom" {
		if from != "" && to != "" {
			baseQuery += fmt.Sprintf(
				` AND pm.created_at::date BETWEEN $%d AND $%d`,
				argIdx,
				argIdx+1,
			)
			fromDate, _ := time.ParseInLocation("2006-01-02", from, wib)
			toDate, _ := time.ParseInLocation("2006-01-02", to, wib)

			args = append(
				args,
				fromDate.Format("2006-01-02"),
				toDate.Format("2006-01-02"),
			)
			argIdx += 2
		}
		if kodeItem != "" {
			baseQuery += fmt.Sprintf(` AND pm.kode_item = $%d`, argIdx)
			args = append(args, kodeItem)
			argIdx++
		}
	}

	baseQuery += ` GROUP BY pm.id ORDER BY pm.created_at DESC`

	rows, err := h.DB.Query(baseQuery, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var allPM []models.DiversifikasiPMWithProducts

	for rows.Next() {
		var item models.DiversifikasiPMWithProducts
		var productsJSON []byte
		var createdAt, updatedAt sql.NullTime

		err := rows.Scan(
			&item.ID, &item.NomorPM, &item.Revision, &item.ParentID, &item.StatusProject,
			&item.TglPenerimaan, &item.KodeItem, &item.NamaMaterial,
			&item.Manufacture, &item.NoBatchMaterial,
			&item.PmTglAnalisa, &item.PmTglReport,
			&item.PmHasilAnalisa, &item.PmKeterangan,
			&item.TrialKodeProduk, &item.TrialNoBatch, &item.TrialHasilFinal,
			&item.LinkFileDiversifikasi, &item.Kesimpulan,
			&createdAt, &updatedAt,
			&productsJSON,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		item.CreatedAt = createdAt.Time
		item.UpdatedAt = updatedAt.Time
		item.Products = unmarshalProductsPMExport(productsJSON)
		item.Revisions = h.getRevisionsPMExport(item.NomorPM, item.ID)
		allPM = append(allPM, item)
	}

	f, err := buildExportPMXLSX(allPM, mode, from, to, kodeItem)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat file XLSX: " + err.Error()})
		return
	}

	now := time.Now()
	fileName := fmt.Sprintf("Diversifikasi_PM_%s.xlsx", now.Format("02012006"))

	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, fileName))
	c.Header("Cache-Control", "no-cache")

	if err := f.Write(c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
	}
}

func (h *ExportDiversifikasiPMHandler) getRevisionsPMExport(
	nomorPM string, excludeID int,
) []models.DiversifikasiPMWithProducts {

	revisions := make([]models.DiversifikasiPMWithProducts, 0)

	query := `
		SELECT
			pm.id, pm.nomor_pm, pm.revision, pm.parent_id, pm.status_project,
			pm.created_at, pm.kode_item, pm.nama_material,
			pm.manufacture, pm.no_batch_material,
			pm.pm_tgl_analisa, pm.pm_tgl_report,
			pm.pm_hasil_analisa, pm.pm_keterangan,
			pm.trial_kode_produk, pm.trial_no_batch, pm.trial_hasil_final,
			pm.link_file_diversifikasi, pm.kesimpulan,
			pm.created_at, pm.updated_at,
			COALESCE(
				json_agg(
					json_build_object(
						'id',                    p.id,
						'kodeProduk',            COALESCE(p.kode_produk, ''),
						'produkTglKirimQC',      p.produk_tgl_kirim_qc,
						'produkTglKeluarHasil',  p.produk_tgl_keluar_hasil,
						'evaluasiAsKemasan',     COALESCE(p.evaluasi_as_kemasan, ''),
						'produkFisik',           COALESCE(p.produk_fisik, ''),
						'produkKimia',           COALESCE(p.produk_kimia, ''),
						'produkMikrobiologi',    COALESCE(p.produk_mikrobiologi, ''),
						'produkSensori',         COALESCE(p.produk_sensori, ''),
						'produkCekKarakteristik',COALESCE(p.produk_cek_karakteristik, ''),
						'stabtestFisik',         COALESCE(p.stabtest_fisik, ''),
						'stabtestKimia',         COALESCE(p.stabtest_kimia, ''),
						'stabtestMikrobiologi',  COALESCE(p.stabtest_mikrobiologi, ''),
						'stabtestSensoriDFCT',   COALESCE(p.stabtest_sensori_dfct, ''),
						'stabtestKeterangan',    COALESCE(p.stabtest_keterangan, ''),
						'stabtestStatus',        COALESCE(p.stabtest_status, '')
					) ORDER BY p.id
				) FILTER (WHERE p.id IS NOT NULL),
				'[]'
			) AS products
		FROM diversifikasi_pm pm
		LEFT JOIN diversifikasi_produk_pm p ON p.diversifikasi_pm_id = pm.id
		WHERE pm.nomor_pm = $1
		  AND pm.id != $2
		  AND pm.parent_id IS NOT NULL
		  AND pm.deleted_at IS NULL
		GROUP BY pm.id
		ORDER BY pm.created_at ASC`

	rows, err := h.DB.Query(query, nomorPM, excludeID)
	if err != nil {
		return revisions
	}
	defer rows.Close()

	for rows.Next() {
		var item models.DiversifikasiPMWithProducts
		var productsJSON []byte
		var createdAt, updatedAt sql.NullTime

		err := rows.Scan(
			&item.ID, &item.NomorPM, &item.Revision, &item.ParentID, &item.StatusProject,
			&item.TglPenerimaan, &item.KodeItem, &item.NamaMaterial,
			&item.Manufacture, &item.NoBatchMaterial,
			&item.PmTglAnalisa, &item.PmTglReport,
			&item.PmHasilAnalisa, &item.PmKeterangan,
			&item.TrialKodeProduk, &item.TrialNoBatch, &item.TrialHasilFinal,
			&item.LinkFileDiversifikasi, &item.Kesimpulan,
			&createdAt, &updatedAt,
			&productsJSON,
		)
		if err != nil {
			continue
		}
		item.CreatedAt = createdAt.Time
		item.UpdatedAt = updatedAt.Time
		item.Products = unmarshalProductsPMExport(productsJSON)
		revisions = append(revisions, item)
	}
	return revisions
}

type productPMJSON struct {
	ID                     int     `json:"id"`
	KodeProduk             string  `json:"kodeProduk"`
	ProdukTglKirimQC       *string `json:"produkTglKirimQC"`
	ProdukTglKeluarHasil   *string `json:"produkTglKeluarHasil"`
	EvaluasiAsKemasan      string  `json:"evaluasiAsKemasan"`
	ProdukFisik            string  `json:"produkFisik"`
	ProdukKimia            string  `json:"produkKimia"`
	ProdukMikrobiologi     string  `json:"produkMikrobiologi"`
	ProdukSensori          string  `json:"produkSensori"`
	ProdukCekKarakteristik string  `json:"produkCekKarakteristik"`
	StabtestFisik          string  `json:"stabtestFisik"`
	StabtestKimia          string  `json:"stabtestKimia"`
	StabtestMikrobiologi   string  `json:"stabtestMikrobiologi"`
	StabtestSensoriDFCT    string  `json:"stabtestSensoriDFCT"`
	StabtestKeterangan     string  `json:"stabtestKeterangan"`
	StabtestStatus         string  `json:"stabtestStatus"`
}

func unmarshalProductsPMExport(data []byte) []models.DiversifikasiProdukPM {
	products := make([]models.DiversifikasiProdukPM, 0)
	if len(data) == 0 || string(data) == "null" || string(data) == "[]" {
		return products
	}
	var raw []productPMJSON
	if err := json.Unmarshal(data, &raw); err != nil {
		return products
	}
	parseT := func(s *string) *time.Time {
		if s == nil || *s == "" {
			return nil
		}
		for _, layout := range []string{time.RFC3339, "2006-01-02T15:04:05", "2006-01-02"} {
			if t, err := time.Parse(layout, *s); err == nil {
				return &t
			}
		}
		return nil
	}
	for _, r := range raw {
		products = append(products, models.DiversifikasiProdukPM{
			ID:                     r.ID,
			KodeProduk:             r.KodeProduk,
			EvaluasiAsKemasan:      r.EvaluasiAsKemasan,
			ProdukFisik:            r.ProdukFisik,
			ProdukKimia:            r.ProdukKimia,
			ProdukMikrobiologi:     r.ProdukMikrobiologi,
			ProdukSensori:          r.ProdukSensori,
			ProdukCekKarakteristik: r.ProdukCekKarakteristik,
			StabtestFisik:          r.StabtestFisik,
			StabtestKimia:          r.StabtestKimia,
			StabtestMikrobiologi:   r.StabtestMikrobiologi,
			StabtestSensoriDFCT:    r.StabtestSensoriDFCT,
			StabtestKeterangan:     r.StabtestKeterangan,
			StabtestStatus:         r.StabtestStatus,
			ProdukTglKirimQC:       parseT(r.ProdukTglKirimQC),
			ProdukTglKeluarHasil:   parseT(r.ProdukTglKeluarHasil),
		})
	}
	return products
}

func buildExportPMXLSX(
	allPM []models.DiversifikasiPMWithProducts,
	mode, from, to, kodeItem string,
) (*excelize.File, error) {

	f := excelize.NewFile()
	sheet := "Diversifikasi PM"
	f.SetSheetName("Sheet1", sheet)

	const (
		colorTitle      = "2E3192"
		colorGroupInfo  = "3D43B8"
		colorGroupPM    = "0369A1"
		colorGroupProd  = "6D28D9"
		colorGroupTrial = "047857"
		colorSubInfo    = "5C63CC"
		colorSubPM      = "0284B3"
		colorSubProd    = "8B5CF6"
		colorSubTrial   = "10B981"
		colorRowEven    = "EEF2FF"
		colorRowOdd     = "FFFFFF"
		colorRevision   = "FEF9C3"
		colorHeaderText = "FFFFFF"
		colorTitleText  = "FFFFFF"
	)

	centerAlign := &excelize.Alignment{Horizontal: "center", Vertical: "center", WrapText: false}
	leftAlign := &excelize.Alignment{Horizontal: "left", Vertical: "center", WrapText: false}

	makeFill := func(hex string) excelize.Fill {
		return excelize.Fill{Type: "pattern", Color: []string{hex}, Pattern: 1}
	}
	makeBorder := func() []excelize.Border {
		return []excelize.Border{
			{Type: "left", Color: "D1D5DB", Style: 1},
			{Type: "right", Color: "D1D5DB", Style: 1},
			{Type: "top", Color: "D1D5DB", Style: 1},
			{Type: "bottom", Color: "D1D5DB", Style: 1},
		}
	}

	boldWhiteSm := excelize.Font{Bold: true, Color: colorHeaderText, Size: 8, Family: "Arial"}
	dataFont := excelize.Font{Size: 9, Family: "Arial"}

	makeGroupStyle := func(bgHex string) int {
		sid, _ := f.NewStyle(&excelize.Style{
			Font:      &excelize.Font{Bold: true, Color: colorHeaderText, Size: 9, Family: "Arial"},
			Fill:      makeFill(bgHex),
			Alignment: centerAlign,
			Border:    makeBorder(),
		})
		return sid
	}
	makeSubStyle := func(bgHex string) int {
		sid, _ := f.NewStyle(&excelize.Style{
			Font:      &boldWhiteSm,
			Fill:      makeFill(bgHex),
			Alignment: centerAlign,
			Border:    makeBorder(),
		})
		return sid
	}
	makeDarkColStyle := func() int {
		sid, _ := f.NewStyle(&excelize.Style{
			Font:      &excelize.Font{Bold: true, Color: colorHeaderText, Size: 9, Family: "Arial"},
			Fill:      makeFill("1E2A7A"),
			Alignment: centerAlign,
			Border:    makeBorder(),
		})
		return sid
	}
	makeDataStyle := func(bgHex string, center bool) int {
		align := leftAlign
		if center {
			align = centerAlign
		}
		sid, _ := f.NewStyle(&excelize.Style{
			Font:      &dataFont,
			Fill:      makeFill(bgHex),
			Alignment: align,
			Border:    makeBorder(),
		})
		return sid
	}
	makeTitleStyle := func() int {
		sid, _ := f.NewStyle(&excelize.Style{
			Font:      &excelize.Font{Bold: true, Color: colorTitleText, Size: 13, Family: "Arial"},
			Fill:      makeFill(colorTitle),
			Alignment: centerAlign,
		})
		return sid
	}

	type colDef struct {
		sub   string
		group string
		width float64
	}

	prodCols := []colDef{
		{"Kode Produk", "ALOKASI PRODUK LABSCALE", 14},
		{"Lead Time", "ALOKASI PRODUK LABSCALE", 11},
		{"Tgl Kirim QC", "ALOKASI PRODUK LABSCALE", 13},
		{"Tgl Keluar Hasil", "ALOKASI PRODUK LABSCALE", 15},
		{"Evaluasi Kemasan", "ALOKASI PRODUK LABSCALE", 15},
		{"Fisik", "ALOKASI PRODUK LABSCALE", 9},
		{"Kimia", "ALOKASI PRODUK LABSCALE", 9},
		{"Mikro", "ALOKASI PRODUK LABSCALE", 9},
		{"Sensori", "ALOKASI PRODUK LABSCALE", 10},
		{"Cek Karakt.", "ALOKASI PRODUK LABSCALE", 12},
		{"Fisik (Stabtest)", "ALOKASI PRODUK LABSCALE", 14},
		{"Kimia (Stabtest)", "ALOKASI PRODUK LABSCALE", 14},
		{"Mikro (Stabtest)", "ALOKASI PRODUK LABSCALE", 14},
		{"Sensori DFCT", "ALOKASI PRODUK LABSCALE", 13},
		{"Keterangan Stabtest", "ALOKASI PRODUK LABSCALE", 25},
		{"Status Stabtest", "ALOKASI PRODUK LABSCALE", 14},
	}

	cols := []colDef{
		{"No (PM)", "fixed", 18},
		{"Status Project", "fixed", 13},
		{"Tgl Penerimaan", "INFORMASI UMUM", 13},
		{"Kode Item", "INFORMASI UMUM", 12},
		{"Nama Material", "INFORMASI UMUM", 35},
		{"Manufacture", "INFORMASI UMUM", 33},
		{"No Batch", "INFORMASI UMUM", 13},
		{"Lead Time", "PACKAGING MATERIAL", 11},
		{"Tgl Analisa", "PACKAGING MATERIAL", 13},
		{"Tgl Report", "PACKAGING MATERIAL", 13},
		{"Hasil Analisa", "PACKAGING MATERIAL", 13},
		{"Keterangan", "PACKAGING MATERIAL", 30},
	}
	cols = append(cols, prodCols...)
	cols = append(cols, []colDef{
		{"Kode Produk", "TRIAL MESIN", 14},
		{"No Batch", "TRIAL MESIN", 13},
		{"Hasil Final", "TRIAL MESIN", 11},
		{"Link File", "TRIAL MESIN", 35},
		{"Kesimpulan", "TRIAL MESIN", 35},
	}...)

	totalCols := len(cols)

	titleCell, _ := excelize.CoordinatesToCellName(1, 1)
	titleEnd, _ := excelize.CoordinatesToCellName(totalCols, 1)
	f.MergeCell(sheet, titleCell, titleEnd)
	f.SetCellValue(sheet, titleCell, "Diversifikasi Packaging Material")
	f.SetRowHeight(sheet, 1, 22)
	f.SetCellStyle(sheet, titleCell, titleEnd, makeTitleStyle())

	type groupSpan struct {
		start, end int
		name       string
	}
	var groupSpans []groupSpan
	prevGroup := ""
	var currentSpan *groupSpan

	for ci, col := range cols {
		colNum := ci + 1
		if col.group != prevGroup {
			if currentSpan != nil {
				groupSpans = append(groupSpans, *currentSpan)
			}
			currentSpan = &groupSpan{start: colNum, end: colNum, name: col.group}
			prevGroup = col.group
		} else {
			currentSpan.end = colNum
		}
	}
	if currentSpan != nil {
		groupSpans = append(groupSpans, *currentSpan)
	}

	styleGroup := map[string]int{
		"fixed":                   makeDarkColStyle(),
		"INFORMASI UMUM":          makeGroupStyle(colorGroupInfo),
		"PACKAGING MATERIAL":      makeGroupStyle(colorGroupPM),
		"ALOKASI PRODUK LABSCALE": makeGroupStyle(colorGroupProd),
		"TRIAL MESIN":             makeGroupStyle(colorGroupTrial),
	}
	styleSub := map[string]int{
		"fixed":                   makeDarkColStyle(),
		"INFORMASI UMUM":          makeSubStyle(colorSubInfo),
		"PACKAGING MATERIAL":      makeSubStyle(colorSubPM),
		"ALOKASI PRODUK LABSCALE": makeSubStyle(colorSubProd),
		"TRIAL MESIN":             makeSubStyle(colorSubTrial),
	}

	f.SetRowHeight(sheet, 2, 18)
	f.SetRowHeight(sheet, 3, 30)

	for _, gs := range groupSpans {
		startCell, _ := excelize.CoordinatesToCellName(gs.start, 2)
		endCell, _ := excelize.CoordinatesToCellName(gs.end, 2)

		if gs.name == "fixed" {
			for ci := gs.start; ci <= gs.end; ci++ {
				cell2, _ := excelize.CoordinatesToCellName(ci, 2)
				cell3, _ := excelize.CoordinatesToCellName(ci, 3)
				f.MergeCell(sheet, cell2, cell3)
				f.SetCellValue(sheet, cell2, cols[ci-1].sub)
				f.SetCellStyle(sheet, cell2, cell3, styleGroup["fixed"])
			}
		} else {
			if gs.start != gs.end {
				f.MergeCell(sheet, startCell, endCell)
			}
			f.SetCellValue(sheet, startCell, gs.name)
			f.SetCellStyle(sheet, startCell, endCell, styleGroup[gs.name])
			for ci := gs.start; ci <= gs.end; ci++ {
				cell3, _ := excelize.CoordinatesToCellName(ci, 3)
				f.SetCellValue(sheet, cell3, cols[ci-1].sub)
				f.SetCellStyle(sheet, cell3, cell3, styleSub[gs.name])
			}
		}
	}

	colNames := []string{
		"A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U",
		"V", "W", "X", "Y", "Z", "AA", "AB", "AC", "AD", "AE", "AF", "AG", "AH", "AI", "AJ", "AK", "AL", "AM", "AN",
	}
	for ci, col := range cols {
		if ci < len(colNames) {
			f.SetColWidth(sheet, colNames[ci], colNames[ci], col.width)
		}
	}

	dataRow := 4

	fmtDate := func(t *time.Time) string {
		if t == nil || t.Year() <= 1 {
			return ""
		}
		return t.Format("02-01-2006")
	}

	leadTime := func(start, end *time.Time) string {
		if start == nil {
			return ""
		}
		s := start.Truncate(24 * time.Hour)
		var e time.Time
		if end != nil {
			e = end.Truncate(24 * time.Hour)
		} else {
			e = time.Now().Truncate(24 * time.Hour)
		}
		days := int(math.Round(e.Sub(s).Hours() / 24))
		if days < 0 {
			return ""
		}
		return fmt.Sprintf("%d hari", days)
	}

	writePM := func(pm models.DiversifikasiPMWithProducts, rowIndex int, isRevision bool) {
		products := pm.Products
		if len(products) == 0 {
			products = []models.DiversifikasiProdukPM{{}}
		}
		numProdRows := len(products)

		bgBase := colorRowOdd
		if rowIndex%2 == 0 {
			bgBase = colorRowEven
		}
		if isRevision {
			bgBase = colorRevision
		}

		styleCenter := makeDataStyle(bgBase, true)
		styleLeft := makeDataStyle(bgBase, false)

		mergeColsMain := []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12}
		trialStart := 12 + 16 + 1
		for i := trialStart; i <= trialStart+4; i++ {
			mergeColsMain = append(mergeColsMain, i)
		}

		mainValues := map[int]interface{}{
			1:  pm.NomorPM,
			2:  pm.StatusProject,
			3:  fmtDate(pm.TglPenerimaan),
			4:  pm.KodeItem,
			5:  pm.NamaMaterial,
			6:  pm.Manufacture,
			7:  pm.NoBatchMaterial,
			8:  leadTime(pm.PmTglAnalisa, pm.PmTglReport),
			9:  fmtDate(pm.PmTglAnalisa),
			10: fmtDate(pm.PmTglReport),
			11: pm.PmHasilAnalisa,
			12: pm.PmKeterangan,
			29: pm.TrialKodeProduk,
			30: pm.TrialNoBatch,
			31: pm.TrialHasilFinal,
			32: pm.LinkFileDiversifikasi,
			33: pm.Kesimpulan,
		}

		for _, ci := range mergeColsMain {
			val := mainValues[ci]
			if val == nil {
				val = ""
			}
			sty := styleCenter
			if ci == 5 || ci == 6 || ci == 12 || ci == 32 || ci == 33 {
				sty = styleLeft
			}
			if numProdRows > 1 {
				topCell, _ := excelize.CoordinatesToCellName(ci, dataRow)
				botCell, _ := excelize.CoordinatesToCellName(ci, dataRow+numProdRows-1)
				f.MergeCell(sheet, topCell, botCell)
				f.SetCellValue(sheet, topCell, val)
				f.SetCellStyle(sheet, topCell, botCell, sty)
			} else {
				cell, _ := excelize.CoordinatesToCellName(ci, dataRow)
				f.SetCellValue(sheet, cell, val)
				f.SetCellStyle(sheet, cell, cell, sty)
			}
		}

		for pi, prod := range products {
			pr := dataRow + pi

			prodValues := map[int]interface{}{
				13: prod.KodeProduk,
				14: leadTime(prod.ProdukTglKirimQC, prod.ProdukTglKeluarHasil),
				15: fmtDate(prod.ProdukTglKirimQC),
				16: fmtDate(prod.ProdukTglKeluarHasil),
				17: prod.EvaluasiAsKemasan,
				18: prod.ProdukFisik,
				19: prod.ProdukKimia,
				20: prod.ProdukMikrobiologi,
				21: prod.ProdukSensori,
				22: prod.ProdukCekKarakteristik,
				23: prod.StabtestFisik,
				24: prod.StabtestKimia,
				25: prod.StabtestMikrobiologi,
				26: prod.StabtestSensoriDFCT,
				27: prod.StabtestKeterangan,
				28: prod.StabtestStatus,
			}

			for ci := 13; ci <= 28; ci++ {
				cell, _ := excelize.CoordinatesToCellName(ci, pr)
				val := prodValues[ci]
				if val == nil {
					val = ""
				}
				sty := styleCenter
				if ci == 27 {
					sty = styleLeft
				}
				f.SetCellValue(sheet, cell, val)
				f.SetCellStyle(sheet, cell, cell, sty)
			}

			f.SetRowHeight(sheet, pr, 16)
		}

		dataRow += numProdRows
	}

	rowIdx := 0
	for _, pm := range allPM {
		writePM(pm, rowIdx, false)
		rowIdx++
		for _, rev := range pm.Revisions {
			writePM(rev, rowIdx, true)
			rowIdx++
		}
	}

	f.SetPanes(sheet, &excelize.Panes{
		Freeze:      true,
		Split:       false,
		XSplit:      2,
		YSplit:      3,
		TopLeftCell: "C4",
		ActivePane:  "bottomRight",
	})

	return f, nil
}
