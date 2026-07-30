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

type ExportDiversifikasiRMHandler struct {
	DB *sql.DB
}

func (h *ExportDiversifikasiRMHandler) Export(c *gin.Context) {
	mode := c.DefaultQuery("mode", "all")
	from := c.Query("from")
	to := c.Query("to")
	kodeItem := c.Query("kodeItem")

	baseQuery := `
		SELECT rm.id, rm.nomor_rm, rm.revision, rm.parent_id, rm.status_project,
			rm.tgl_kirim_cpro, rm.tgl_terima_ts, rm.kode_item, rm.nama_material,
			rm.manufacture, rm.no_batch_material,
			rm.rm_tgl_kirim_qc, rm.rm_tgl_keluar_hasil_analisa,
			rm.rm_fisik, rm.rm_kimia, rm.rm_mikrobiologi,
			rm.rm_sensori_material, rm.rm_cek_karakteristik, rm.rm_status,
			rm.perlu_analisa_andev, rm.andev_kimia, rm.andev_verifikasi_ma, rm.andev_status,
			rm.scale_up_kode_produk, rm.no_batch_scale_up, rm.scale_up_status,
			rm.tgl_dilakukan_scale_up, rm.scale_up_tgl_kirim_qc,
			rm.scale_up_tgl_keluar_hasil_analisa,
			rm.link_file_diversifikasi, rm.kesimpulan,
			rm.created_at, rm.updated_at,
			COALESCE(
				json_agg(
					json_build_object(
						'id', p.id,
						'kodeProduk', COALESCE(p.kode_produk,''),
						'produkTglKirimQC', p.produk_tgl_kirim_qc,
						'produkTglKeluarHasil', p.produk_tgl_keluar_hasil,
						'produkFisik', COALESCE(p.produk_fisik,''),
						'produkKimia', COALESCE(p.produk_kimia,''),
						'produkMikrobiologi', COALESCE(p.produk_mikrobiologi,''),
						'produkSensori', COALESCE(p.produk_sensori,''),
						'produkCekKarakteristik', COALESCE(p.produk_cek_karakteristik,''),
						'stabtestFisik', COALESCE(p.stabtest_fisik,''),
						'stabtestKimia', COALESCE(p.stabtest_kimia,''),
						'stabtestMikrobiologi', COALESCE(p.stabtest_mikrobiologi,''),
						'stabtestSensoriDFCT', COALESCE(p.stabtest_sensori_dfct,''),
						'stabtestStatus', COALESCE(p.stabtest_status,''),
						'keterangan', COALESCE(p.keterangan,'')
					) ORDER BY p.id
				) FILTER (WHERE p.id IS NOT NULL),
				'[]'
			) AS products
		FROM diversifikasi_rm rm
		LEFT JOIN diversifikasi_produk p ON p.diversifikasi_rm_id = rm.id
		WHERE rm.deleted_at IS NULL`

	args := []interface{}{}
	argIdx := 1

	if mode == "custom" {
		if from != "" && to != "" {
			baseQuery += fmt.Sprintf(` AND rm.tgl_kirim_cpro::date BETWEEN $%d AND $%d`, argIdx, argIdx+1)
			args = append(args, from, to)
			argIdx += 2
		}
		if kodeItem != "" {
			baseQuery += fmt.Sprintf(` AND rm.kode_item = $%d`, argIdx)
			args = append(args, kodeItem)
			argIdx++
		}
	}

	baseQuery += ` GROUP BY rm.id ORDER BY rm.created_at DESC`

	rows, err := h.DB.Query(baseQuery, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type rmRow struct {
		models.DiversifikasiRMWithProducts
	}

	var allRM []models.DiversifikasiRMWithProducts

	for rows.Next() {
		var item models.DiversifikasiRMWithProducts
		var productsJSON []byte

		err := rows.Scan(
			&item.ID, &item.NomorRM, &item.Revision, &item.ParentID, &item.StatusProject,
			&item.TglKirimCPro, &item.TglTerimaTS, &item.KodeItem,
			&item.NamaMaterial, &item.Manufacture, &item.NoBatchMaterial,
			&item.RmTglKirimQC, &item.RmTglKeluarHasilAnalisa,
			&item.RmFisik, &item.RmKimia, &item.RmMikrobiologi,
			&item.RmSensoriMaterial, &item.RmCekKarakteristik, &item.RmStatus,
			&item.PerluAnalisaAndev, &item.AndevKimia, &item.AndevVerifikasiMA, &item.AndevStatus,
			&item.ScaleUpKodeProduk, &item.NoBatchScaleUp, &item.ScaleUpStatus,
			&item.TglDilakukanScaleUp, &item.ScaleUpTglKirimQC,
			&item.ScaleUpTglKeluarHasilAnalisa,
			&item.LinkFileDiversifikasi, &item.Kesimpulan,
			&item.CreatedAt, &item.UpdatedAt,
			&productsJSON,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		item.Products = unmarshalProductsExport(productsJSON)
		item.Revisions = h.getRevisionsExport(item.NomorRM, item.ID)
		allRM = append(allRM, item)
	}

	f, err := buildExportXLSX(allRM, mode, from, to, kodeItem)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat file XLSX: " + err.Error()})
		return
	}

	now := time.Now()
	fileName := fmt.Sprintf("Diversifikasi_RM_%s.xlsx", now.Format("02012006"))

	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, fileName))
	c.Header("Cache-Control", "no-cache")

	if err := f.Write(c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
	}
}

func (h *ExportDiversifikasiRMHandler) getRevisionsExport(nomorRM string, excludeID int) []models.DiversifikasiRMWithProducts {
	revisions := make([]models.DiversifikasiRMWithProducts, 0)

	query := `
		SELECT rm.id, rm.nomor_rm, rm.revision, rm.parent_id, rm.status_project,
			rm.tgl_kirim_cpro, rm.tgl_terima_ts, rm.kode_item, rm.nama_material,
			rm.manufacture, rm.no_batch_material,
			rm.rm_tgl_kirim_qc, rm.rm_tgl_keluar_hasil_analisa,
			rm.rm_fisik, rm.rm_kimia, rm.rm_mikrobiologi,
			rm.rm_sensori_material, rm.rm_cek_karakteristik, rm.rm_status,
			rm.perlu_analisa_andev, rm.andev_kimia, rm.andev_verifikasi_ma, rm.andev_status,
			rm.scale_up_kode_produk, rm.no_batch_scale_up, rm.scale_up_status,
			rm.tgl_dilakukan_scale_up, rm.scale_up_tgl_kirim_qc,
			rm.scale_up_tgl_keluar_hasil_analisa,
			rm.link_file_diversifikasi, rm.kesimpulan,
			rm.created_at, rm.updated_at,
			COALESCE(
				json_agg(
					json_build_object(
						'id', p.id,
						'kodeProduk', COALESCE(p.kode_produk,''),
						'produkTglKirimQC', p.produk_tgl_kirim_qc,
						'produkTglKeluarHasil', p.produk_tgl_keluar_hasil,
						'produkFisik', COALESCE(p.produk_fisik,''),
						'produkKimia', COALESCE(p.produk_kimia,''),
						'produkMikrobiologi', COALESCE(p.produk_mikrobiologi,''),
						'produkSensori', COALESCE(p.produk_sensori,''),
						'produkCekKarakteristik', COALESCE(p.produk_cek_karakteristik,''),
						'stabtestFisik', COALESCE(p.stabtest_fisik,''),
						'stabtestKimia', COALESCE(p.stabtest_kimia,''),
						'stabtestMikrobiologi', COALESCE(p.stabtest_mikrobiologi,''),
						'stabtestSensoriDFCT', COALESCE(p.stabtest_sensori_dfct,''),
						'stabtestStatus', COALESCE(p.stabtest_status,''),
						'keterangan', COALESCE(p.keterangan,'')
					) ORDER BY p.id
				) FILTER (WHERE p.id IS NOT NULL),
				'[]'
			) AS products
		FROM diversifikasi_rm rm
		LEFT JOIN diversifikasi_produk p ON p.diversifikasi_rm_id = rm.id
		WHERE rm.nomor_rm = $1 AND rm.id != $2
		  AND rm.parent_id IS NOT NULL AND rm.deleted_at IS NULL
		GROUP BY rm.id
		ORDER BY rm.created_at ASC`

	rows, err := h.DB.Query(query, nomorRM, excludeID)
	if err != nil {
		return revisions
	}
	defer rows.Close()

	for rows.Next() {
		var item models.DiversifikasiRMWithProducts
		var productsJSON []byte
		err := rows.Scan(
			&item.ID, &item.NomorRM, &item.Revision, &item.ParentID, &item.StatusProject,
			&item.TglKirimCPro, &item.TglTerimaTS, &item.KodeItem,
			&item.NamaMaterial, &item.Manufacture, &item.NoBatchMaterial,
			&item.RmTglKirimQC, &item.RmTglKeluarHasilAnalisa,
			&item.RmFisik, &item.RmKimia, &item.RmMikrobiologi,
			&item.RmSensoriMaterial, &item.RmCekKarakteristik, &item.RmStatus,
			&item.PerluAnalisaAndev, &item.AndevKimia, &item.AndevVerifikasiMA, &item.AndevStatus,
			&item.ScaleUpKodeProduk, &item.NoBatchScaleUp, &item.ScaleUpStatus,
			&item.TglDilakukanScaleUp, &item.ScaleUpTglKirimQC,
			&item.ScaleUpTglKeluarHasilAnalisa,
			&item.LinkFileDiversifikasi, &item.Kesimpulan,
			&item.CreatedAt, &item.UpdatedAt,
			&productsJSON,
		)
		if err != nil {
			continue
		}
		item.Products = unmarshalProductsExport(productsJSON)
		revisions = append(revisions, item)
	}
	return revisions
}

func unmarshalProductsExport(data []byte) []models.DiversifikasiProduk {
	products := make([]models.DiversifikasiProduk, 0)
	if len(data) == 0 || string(data) == "null" || string(data) == "[]" {
		return products
	}
	var raw []map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		return products
	}
	for _, r := range raw {
		p := models.DiversifikasiProduk{}
		if v, ok := r["id"].(float64); ok {
			p.ID = int(v)
		}
		strField := func(key string) string {
			if v, ok := r[key].(string); ok {
				return v
			}
			return ""
		}
		p.KodeProduk = strField("kodeProduk")
		p.ProdukFisik = strField("produkFisik")
		p.ProdukKimia = strField("produkKimia")
		p.ProdukMikrobiologi = strField("produkMikrobiologi")
		p.ProdukSensori = strField("produkSensori")
		p.ProdukCekKarakteristik = strField("produkCekKarakteristik")
		p.StabtestFisik = strField("stabtestFisik")
		p.StabtestKimia = strField("stabtestKimia")
		p.StabtestMikrobiologi = strField("stabtestMikrobiologi")
		p.StabtestSensoriDFCT = strField("stabtestSensoriDFCT")
		p.StabtestStatus = strField("stabtestStatus")
		p.Keterangan = strField("keterangan")

		parseT := func(key string) *time.Time {
			v, ok := r[key].(string)
			if !ok || v == "" {
				return nil
			}
			for _, layout := range []string{time.RFC3339, "2006-01-02T15:04:05", "2006-01-02"} {
				if t, err := time.Parse(layout, v); err == nil {
					return &t
				}
			}
			return nil
		}
		p.ProdukTglKirimQC = parseT("produkTglKirimQC")
		p.ProdukTglKeluarHasil = parseT("produkTglKeluarHasil")
		products = append(products, p)
	}
	return products
}

func buildExportXLSX(
	allRM []models.DiversifikasiRMWithProducts,
	mode, from, to, kodeItem string,
) (*excelize.File, error) {

	f := excelize.NewFile()
	sheet := "Diversifikasi RM"
	f.SetSheetName("Sheet1", sheet)
	const (
		colorTitle      = "2E3192"
		colorGroupInfo  = "3D43B8"
		colorGroupAndev = "C2410C"
		colorGroupRM    = "0369A1"
		colorGroupProd  = "6D28D9"
		colorGroupScale = "047857"
		colorSubInfo    = "5C63CC"
		colorSubAndev   = "D97040"
		colorSubRM      = "0EA5E9"
		colorSubProd    = "8B5CF6"
		colorSubScale   = "10B981"
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

	boldWhite := excelize.Font{Bold: true, Color: colorHeaderText, Size: 9, Family: "Arial"}
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

	_ = boldWhite

	type colDef struct {
		sub   string
		group string
		width float64
	}

	prodSubHeaders := []colDef{
		{"Kode Produk", "ALOKASI PRODUK", 14},
		{"Lead Time", "ALOKASI PRODUK", 11},
		{"Tgl Kirim QC", "ALOKASI PRODUK", 13},
		{"Tgl Keluar Hasil", "ALOKASI PRODUK", 15},
		{"Fisik", "ALOKASI PRODUK", 9},
		{"Kimia", "ALOKASI PRODUK", 9},
		{"Mikro", "ALOKASI PRODUK", 9},
		{"Sensori", "ALOKASI PRODUK", 10},
		{"Cek Karakt.", "ALOKASI PRODUK", 12},
		{"Fisik (Stabtest)", "ALOKASI PRODUK", 14},
		{"Kimia (Stabtest)", "ALOKASI PRODUK", 14},
		{"Mikro (Stabtest)", "ALOKASI PRODUK", 14},
		{"Sensori DFCT", "ALOKASI PRODUK", 13},
		{"Status Stabtest", "ALOKASI PRODUK", 14},
		{"Keterangan", "ALOKASI PRODUK", 25},
	}

	cols := []colDef{
		{"No (RM)", "fixed", 18},
		{"Status Project", "fixed", 13},
		{"Tgl Kirim CPro", "INFORMASI UMUM", 13},
		{"Tgl Terima TS", "INFORMASI UMUM", 13},
		{"Kode Item", "INFORMASI UMUM", 12},
		{"Nama Material", "INFORMASI UMUM", 35},
		{"Manufacture", "INFORMASI UMUM", 33},
		{"No Batch", "INFORMASI UMUM", 13},
		{"Perlu Analisa?", "ANDEV", 13},
		{"Kimia", "ANDEV", 9},
		{"Verifikasi MA", "ANDEV", 13},
		{"Status", "ANDEV", 11},
		{"Lead Time", "RAW MATERIAL", 11},
		{"Tgl Kirim QC", "RAW MATERIAL", 13},
		{"Tgl Keluar", "RAW MATERIAL", 13},
		{"Fisik", "RAW MATERIAL", 9},
		{"Kimia", "RAW MATERIAL", 9},
		{"Mikro", "RAW MATERIAL", 9},
		{"Sensori", "RAW MATERIAL", 10},
		{"Cek Karakt.", "RAW MATERIAL", 12},
		{"Status", "RAW MATERIAL", 11},
	}
	cols = append(cols, prodSubHeaders...)
	cols = append(cols, []colDef{
		{"Kode Produk", "SCALE UP / COMMERCIAL", 14},
		{"No Batch", "SCALE UP / COMMERCIAL", 13},
		{"Status", "SCALE UP / COMMERCIAL", 11},
		{"Tgl Scale Up", "SCALE UP / COMMERCIAL", 13},
		{"Tgl Kirim QC", "SCALE UP / COMMERCIAL", 13},
		{"Tgl Keluar", "SCALE UP / COMMERCIAL", 13},
		{"Link File", "SCALE UP / COMMERCIAL", 35},
		{"Kesimpulan", "SCALE UP / COMMERCIAL", 35},
	}...)

	totalCols := len(cols)

	titleCell, _ := excelize.CoordinatesToCellName(1, 1)
	titleEnd, _ := excelize.CoordinatesToCellName(totalCols, 1)
	f.MergeCell(sheet, titleCell, titleEnd)
	f.SetCellValue(sheet, titleCell, "Diversifikasi Raw Material")
	f.SetRowHeight(sheet, 1, 22)
	titleStyle := makeTitleStyle()
	f.SetCellStyle(sheet, titleCell, titleEnd, titleStyle)

	styleGroup := map[string]int{
		"fixed":                 makeDarkColStyle(),
		"INFORMASI UMUM":        makeGroupStyle(colorGroupInfo),
		"ANDEV":                 makeGroupStyle(colorGroupAndev),
		"RAW MATERIAL":          makeGroupStyle(colorGroupRM),
		"ALOKASI PRODUK":        makeGroupStyle(colorGroupProd),
		"SCALE UP / COMMERCIAL": makeGroupStyle(colorGroupScale),
	}
	styleSub := map[string]int{
		"fixed":                 makeDarkColStyle(),
		"INFORMASI UMUM":        makeSubStyle(colorSubInfo),
		"ANDEV":                 makeSubStyle(colorSubAndev),
		"RAW MATERIAL":          makeSubStyle(colorSubRM),
		"ALOKASI PRODUK":        makeSubStyle(colorSubProd),
		"SCALE UP / COMMERCIAL": makeSubStyle(colorSubScale),
	}

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
				subLabel := cols[ci-1].sub
				f.SetCellValue(sheet, cell2, subLabel)
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
		"V", "W", "X", "Y", "Z",
		"AA", "AB", "AC", "AD", "AE", "AF", "AG", "AH", "AI", "AJ", "AK", "AL", "AM", "AN", "AO", "AP",
	}
	for ci, col := range cols {
		if ci < len(colNames) {
			f.SetColWidth(sheet, colNames[ci], colNames[ci], col.width)
		}
	}

	dataRow := 4

	fmtDate := func(t *time.Time) string {
		if t == nil {
			return ""
		}
		if t.Year() <= 1 {
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

	writeRM := func(rm models.DiversifikasiRMWithProducts, rowIndex int, isRevision bool) {
		products := rm.Products
		if len(products) == 0 {
			products = []models.DiversifikasiProduk{{}}
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

		mergeColsMain := []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21}
		scaleUpStart := 21 + 15 + 1
		for i := scaleUpStart; i <= scaleUpStart+7; i++ {
			mergeColsMain = append(mergeColsMain, i)
		}

		mainValues := map[int]interface{}{
			1:  rm.NomorRM,
			2:  rm.StatusProject,
			3:  fmtDate(rm.TglKirimCPro),
			4:  fmtDate(rm.TglTerimaTS),
			5:  rm.KodeItem,
			6:  rm.NamaMaterial,
			7:  rm.Manufacture,
			8:  rm.NoBatchMaterial,
			9:  rm.PerluAnalisaAndev,
			10: rm.AndevKimia,
			11: rm.AndevVerifikasiMA,
			12: rm.AndevStatus,
			13: leadTime(rm.RmTglKirimQC, rm.RmTglKeluarHasilAnalisa),
			14: fmtDate(rm.RmTglKirimQC),
			15: fmtDate(rm.RmTglKeluarHasilAnalisa),
			16: rm.RmFisik,
			17: rm.RmKimia,
			18: rm.RmMikrobiologi,
			19: rm.RmSensoriMaterial,
			20: rm.RmCekKarakteristik,
			21: rm.RmStatus,
			37: rm.ScaleUpKodeProduk,
			38: rm.NoBatchScaleUp,
			39: rm.ScaleUpStatus,
			40: fmtDate(rm.TglDilakukanScaleUp),
			41: fmtDate(rm.ScaleUpTglKirimQC),
			42: fmtDate(rm.ScaleUpTglKeluarHasilAnalisa),
			43: rm.LinkFileDiversifikasi,
			44: rm.Kesimpulan,
		}

		for _, ci := range mergeColsMain {
			val := mainValues[ci]
			if val == nil {
				val = ""
			}
			if numProdRows > 1 {
				topCell, _ := excelize.CoordinatesToCellName(ci, dataRow)
				botCell, _ := excelize.CoordinatesToCellName(ci, dataRow+numProdRows-1)
				f.MergeCell(sheet, topCell, botCell)
				f.SetCellValue(sheet, topCell, val)
				sty := styleCenter
				if ci == 6 || ci == 7 || ci == 43 || ci == 44 {
					sty = styleLeft
				}
				f.SetCellStyle(sheet, topCell, botCell, sty)
			} else {
				cell, _ := excelize.CoordinatesToCellName(ci, dataRow)
				f.SetCellValue(sheet, cell, val)
				sty := styleCenter
				if ci == 6 || ci == 7 || ci == 43 || ci == 44 {
					sty = styleLeft
				}
				f.SetCellStyle(sheet, cell, cell, sty)
			}
		}

		for pi, prod := range products {
			pr := dataRow + pi

			prodValues := map[int]interface{}{
				22: prod.KodeProduk,
				23: leadTime(prod.ProdukTglKirimQC, prod.ProdukTglKeluarHasil),
				24: fmtDate(prod.ProdukTglKirimQC),
				25: fmtDate(prod.ProdukTglKeluarHasil),
				26: prod.ProdukFisik,
				27: prod.ProdukKimia,
				28: prod.ProdukMikrobiologi,
				29: prod.ProdukSensori,
				30: prod.ProdukCekKarakteristik,
				31: prod.StabtestFisik,
				32: prod.StabtestKimia,
				33: prod.StabtestMikrobiologi,
				34: prod.StabtestSensoriDFCT,
				35: prod.StabtestStatus,
				36: prod.Keterangan,
			}

			for ci := 22; ci <= 36; ci++ {
				cell, _ := excelize.CoordinatesToCellName(ci, pr)
				val := prodValues[ci]
				if val == nil {
					val = ""
				}
				f.SetCellValue(sheet, cell, val)
				sty := styleCenter
				if ci == 36 {
					sty = styleLeft
				}
				f.SetCellStyle(sheet, cell, cell, sty)
			}

			f.SetRowHeight(sheet, pr, 16)
		}

		dataRow += numProdRows
	}

	rowIdx := 0
	for _, rm := range allRM {
		writeRM(rm, rowIdx, false)
		rowIdx++
		for _, rev := range rm.Revisions {
			writeRM(rev, rowIdx, true)
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
