package sarpras

import (
	"fmt"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"

	"emertrack/internal/domain"
	"emertrack/internal/dto"
)

const yesORno = "ya / tidak"

// ToSarprasTypeDomain maps CreateSarprasTypeRequest DTO → SarprasType domain.
func ToSarprasTypeDomain(req *dto.CreateSarprasTypeRequest) *domain.SarprasType {
	params := make([]domain.Parameter, len(req.Parameters))
	for i, p := range req.Parameters {
		params[i] = domain.Parameter{
			Name:    p.ParameterName,
			Desc:    p.ParameterDesc,
			OrderNo: p.OrderNo,
		}
	}

	return &domain.SarprasType{
		Code:      req.Code,
		Name:      req.Name,
		IsAPAR:    req.IsAPAR,
		PICDeptID: req.PICDeptID,
		InspIntervalMonths: req.InspIntervalMonths,
		Parameters:         params,
	}
}

// ToUpdateSarprasTypeDomain maps UpdateSarprasTypeRequest DTO → SarprasType domain.
func ToUpdateSarprasTypeDomain(req *dto.UpdateSarprasTypeRequest) *domain.SarprasType {
	params := make([]domain.Parameter, len(req.Parameters))
	for i, p := range req.Parameters {
		var pID uint
		if p.ID != nil {
			pID = *p.ID
		}
		params[i] = domain.Parameter{
			ID:      pID,
			Name:    p.ParameterName,
			Desc:    p.ParameterDesc,
			OrderNo: p.OrderNo,
		}
	}

	return &domain.SarprasType{
		Name: req.Name,
		InspIntervalMonths: req.InspIntervalMonths,
		Parameters:         params,
	}
}

// ToSarprasDomain maps CreateSarprasRequest DTO → Sarpras domain.
func ToSarprasDomain(req *dto.CreateSarprasRequest) *domain.Sarpras {
	var expiredDate *time.Time
	if req.ExpiredDate != nil && *req.ExpiredDate != "" {
		if t, err := time.Parse("2006-01-02", *req.ExpiredDate); err == nil {
			expiredDate = &t
		}
	}
	return &domain.Sarpras{
		SarprasTypeID:   req.SarprasTypeID,
		LocationDeptID:  req.LocationDeptID,
		SiteID:          req.SiteID,
		LocationDetail:  req.LocationDetail,
		IsCritical:      req.IsCritical,
		HasAlternative:  req.HasAlternative,
		HasRiskLocation: req.HasRiskLocation,
		ExpiredDate:     expiredDate,
	}
}

// ToSarprasTypeResponse maps SarprasTypeRow → SarprasTypeResponse DTO.
func ToSarprasTypeResponse(row domain.SarprasTypeRow) dto.SarprasTypeResponse {
	return dto.SarprasTypeResponse{
		ID:          row.ID,
		Code:        row.Code,
		Name:        row.Name,
		IsAPAR:      row.IsAPAR,
		PICDeptCode: row.PICDeptCode,
		PICDeptName: row.PICDeptName,
		InspIntervalMonths: row.InspIntervalMonths,
		CreatedAt:          row.CreatedAt.Format("2006-01-02 15:04:05"),
		UpdatedAt:          row.UpdatedAt.Format("2006-01-02 15:04:05"),
	}
}

// GenerateErrorReport creates an Excel file containing rows that had errors (without the site_code column).
func GenerateErrorReport(rows []domain.BulkParseRow) ([]byte, error) {
	f := excelize.NewFile()
	defer f.Close()

	const sheet = "Baris Error"
	f.SetSheetName("Sheet1", sheet)

	hStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "FFFFFF", Size: 10, Family: "Arial"},
		Fill:      excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"C53030"}},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})
	errStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Color: "C53030", Size: 10, Family: "Arial"},
		Fill:      excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"FFF5F5"}},
		Alignment: &excelize.Alignment{Vertical: "center", WrapText: true},
	})
	dataStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Size: 10, Family: "Arial", Color: "2D3748"},
		Alignment: &excelize.Alignment{Vertical: "center"},
		Border:    []excelize.Border{{Type: "bottom", Color: "E2E8F0", Style: 1}},
	})

	type col struct {
		letter, label string
		width         float64
	}
	cols := []col{
		{"A", "Baris Excel", 12},
		{"B", "sarpras_type_code", 22},
		{"C", "location_dept_code", 22},
		{"D", "location_detail", 40},
		{"E", "is_critical", 14},
		{"F", "has_alternative", 16},
		{"G", "has_risk_location", 18},
		{"H", "expired_date", 16},
		{"I", "Error Detail", 60},
	}
	for _, c := range cols {
		cell := c.letter + "1"
		f.SetCellValue(sheet, cell, c.label)
		f.SetCellStyle(sheet, cell, cell, hStyle)
		f.SetColWidth(sheet, c.letter, c.letter, c.width)
	}
	f.SetRowHeight(sheet, 1, 28)

	boolStr := func(v bool) string {
		if v {
			return "ya"
		}
		return "tidak"
	}

	for i, row := range rows {
		r := i + 2
		vals := []interface{}{
			row.Row, row.SarprasTypeCode, row.LocationDeptCode,
			row.LocationDetail, boolStr(row.IsCritical), boolStr(row.HasAlternative),
			boolStr(row.HasRiskLocation), row.ExpiredDate,
			strings.Join(row.Errors, "\n"),
		}
		for j, c := range cols {
			cell := fmt.Sprintf("%s%d", c.letter, r)
			f.SetCellValue(sheet, cell, vals[j])
			if c.letter == "I" {
				f.SetCellStyle(sheet, cell, cell, errStyle)
			} else {
				f.SetCellStyle(sheet, cell, cell, dataStyle)
			}
		}
		f.SetRowHeight(sheet, r, 22)
	}

	f.SetPanes(sheet, &excelize.Panes{
		Freeze: true, YSplit: 1, TopLeftCell: "A2", ActivePane: "bottomLeft",
	})

	buf, err := f.WriteToBuffer()
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func GenerateImportTemplate(sarprasTypes []domain.SarprasTypeRow, depts []domain.DepartmentRow) ([]byte, error) {
	f := excelize.NewFile()
	defer f.Close()

	const sheet = "Import Sarpras"
	f.SetSheetName("Sheet1", sheet)

	cols := buildTemplateColumns()
	styles, err := createStyles(f)
	if err != nil {
		return nil, err
	}

	applyHeaderAndDataRows(f, sheet, cols, styles)
	applyRowHeights(f, sheet)
	applyFreezePane(f, sheet)

	if err := applyDataValidations(f, sheet, sarprasTypes, depts); err != nil {
		return nil, err
	}

	applyProtection(f, sheet, len(cols))
	applyAutoFilter(f, sheet, len(cols))

	if err := buildPetunjukSheet(f, sarprasTypes, depts); err != nil {
		return nil, fmt.Errorf("petunjuk sheet: %w", err)
	}
	if err := buildMasterDataSheet(f, extractCodes(sarprasTypes), extractDeptCodes(depts)); err != nil {
		return nil, fmt.Errorf("master data sheet: %w", err)
	}

	idx, _ := f.GetSheetIndex(sheet)
	f.SetActiveSheet(idx)

	f.SetDocProps(&excelize.DocProperties{
		Title:       "Template Import Sarpras EmerTrack",
		Creator:     "EmerTrack System",
		Description: "Template bulk import sarpras. Site akan diisi otomatis oleh sistem.",
	})

	buf, err := f.WriteToBuffer()
	if err != nil {
		return nil, fmt.Errorf("write buffer: %w", err)
	}
	return buf.Bytes(), nil
}

// ── Helper: column definition ────────────────────────────────────────────────

type templateColumn struct {
	Header   string
	Format   string
	Required bool
	Width    float64
}

func buildTemplateColumns() []templateColumn {
	return []templateColumn{
		{"sarpras_type_code", "Dropdown", true, 22},
		{"location_dept_code", "Dropdown", true, 22},
		{"location_detail", "Teks, maks 255 karakter", true, 42},
		{"is_critical", yesORno, true, 18},
		{"has_alternative", yesORno, true, 18},
		{"has_risk_location", yesORno, true, 18},
		{"expired_date", "YYYY-MM-DD", false, 20},
	}
}

// ── Helper: styles ────────────────────────────────────────────────────────────

type templateStyles struct {
	header  int
	guide   int
	req     int
	opt     int
	data    int
	dataAlt int
}

func createStyles(f *excelize.File) (*templateStyles, error) {
	navyColor := string(domain.ColorNavy)
	whiteColor := string(domain.ColorWhite)
	guidBColor := string(domain.ColorGuideB)
	guidTColor := string(domain.ColorGuideT)
	reqBColor := string(domain.ColorReqB)
	reqTColor := string(domain.ColorReqT)
	optBColor := string(domain.ColorOptB)
	optTColor := string(domain.ColorOptT)
	altRowColor := string(domain.ColorAltRow)

	headerStyle, err := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: whiteColor, Size: 11, Family: "Arial"},
		Fill:      excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{navyColor}},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center", WrapText: true},
		Border: []excelize.Border{
			{Type: "bottom", Color: whiteColor, Style: 2},
			{Type: "right", Color: "5585B5", Style: 1},
		},
		Protection: &excelize.Protection{Locked: true},
	})
	if err != nil {
		return nil, fmt.Errorf("header style: %w", err)
	}

	guideStyle, err := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Italic: true, Color: guidTColor, Size: 9, Family: "Arial"},
		Fill:      excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{guidBColor}},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center", WrapText: true},
		Border: []excelize.Border{
			{Type: "bottom", Color: "CBD5E0", Style: 1},
			{Type: "right", Color: "CBD5E0", Style: 1},
		},
		Protection: &excelize.Protection{Locked: true},
	})
	if err != nil {
		return nil, fmt.Errorf("guide style: %w", err)
	}

	reqStyle, err := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: reqTColor, Size: 9, Family: "Arial"},
		Fill:      excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{reqBColor}},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
		Border: []excelize.Border{
			{Type: "bottom", Color: "FED7D7", Style: 1},
			{Type: "right", Color: "FED7D7", Style: 1},
		},
		Protection: &excelize.Protection{Locked: true},
	})
	if err != nil {
		return nil, fmt.Errorf("req style: %w", err)
	}

	optStyle, err := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Color: optTColor, Size: 9, Family: "Arial"},
		Fill:      excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{optBColor}},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
		Border: []excelize.Border{
			{Type: "bottom", Color: "E2E8F0", Style: 1},
			{Type: "right", Color: "E2E8F0", Style: 1},
		},
		Protection: &excelize.Protection{Locked: true},
	})
	if err != nil {
		return nil, fmt.Errorf("opt style: %w", err)
	}

	dataStyle, err := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Size: 10, Family: "Arial", Color: "2D3748"},
		Alignment: &excelize.Alignment{Vertical: "center", Horizontal: "center"},
		Border: []excelize.Border{
			{Type: "bottom", Color: "E2E8F0", Style: 1},
			{Type: "right", Color: "E2E8F0", Style: 1},
		},
		Protection: &excelize.Protection{Locked: false},
	})
	if err != nil {
		return nil, fmt.Errorf("data style: %w", err)
	}

	dataAltStyle, err := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Size: 10, Family: "Arial", Color: "2D3748"},
		Fill:      excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{altRowColor}},
		Alignment: &excelize.Alignment{Vertical: "center", Horizontal: "center"},
		Border: []excelize.Border{
			{Type: "bottom", Color: "E2E8F0", Style: 1},
			{Type: "right", Color: "E2E8F0", Style: 1},
		},
		Protection: &excelize.Protection{Locked: false},
	})
	if err != nil {
		return nil, fmt.Errorf("data alt style: %w", err)
	}

	return &templateStyles{
		header:  headerStyle,
		guide:   guideStyle,
		req:     reqStyle,
		opt:     optStyle,
		data:    dataStyle,
		dataAlt: dataAltStyle,
	}, nil
}

// ── Helper: header & data rows ──────────────────────────────────────────────

func applyHeaderAndDataRows(f *excelize.File, sheet string, cols []templateColumn, styles *templateStyles) {
	for i, col := range cols {
		letter, _ := excelize.ColumnNumberToName(i + 1)

		// Header (baris 1)
		cell := letter + "1"
		f.SetCellValue(sheet, cell, col.Header)
		f.SetCellStyle(sheet, cell, cell, styles.header)

		// Format (baris 2)
		cell = letter + "2"
		f.SetCellValue(sheet, cell, col.Format)
		f.SetCellStyle(sheet, cell, cell, styles.guide)

		// Required/Opsional (baris 3)
		cell = letter + "3"
		if col.Required {
			f.SetCellValue(sheet, cell, "⬤ Wajib")
			f.SetCellStyle(sheet, cell, cell, styles.req)
		} else {
			f.SetCellValue(sheet, cell, "○ Wajib untuk APR dan APB")
			f.SetCellStyle(sheet, cell, cell, styles.opt)
		}

		// Data rows (4-504)
		for row := 4; row <= 504; row++ {
			cell := fmt.Sprintf("%s%d", letter, row)
			style := styles.data
			if row%2 == 0 {
				style = styles.dataAlt
			}
			f.SetCellStyle(sheet, cell, cell, style)
		}

		f.SetColWidth(sheet, letter, letter, col.Width)
	}
}

func applyRowHeights(f *excelize.File, sheet string) {
	f.SetRowHeight(sheet, 1, 32)
	f.SetRowHeight(sheet, 2, 24)
	f.SetRowHeight(sheet, 3, 22)
	for row := 4; row <= 504; row++ {
		f.SetRowHeight(sheet, row, 22)
	}
}

func applyFreezePane(f *excelize.File, sheet string) {
	f.SetPanes(sheet, &excelize.Panes{
		Freeze:      true,
		YSplit:      3,
		TopLeftCell: "A4",
		ActivePane:  "bottomLeft",
	})
}

// ── Helper: data validations ─────────────────────────────────────────────────

func applyDataValidations(f *excelize.File, sheet string, sarprasTypes []domain.SarprasTypeRow, depts []domain.DepartmentRow) error {
	typeCodes := extractCodes(sarprasTypes)
	deptCodes := extractDeptCodes(depts)

	// Dropdown sarpras_type_code
	if err := addDropdownValidation(f, sheet, "A4:A504", fmt.Sprintf("_MasterData!$A$1:$A$%d", len(typeCodes))); err != nil {
		return err
	}

	// Dropdown location_dept_code
	if err := addDropdownValidation(f, sheet, "B4:B504", fmt.Sprintf("_MasterData!$B$1:$B$%d", len(deptCodes))); err != nil {
		return err
	}

	// Dropdown boolean (kolom 4,5,6)
	for _, colIdx := range []int{4, 5, 6} {
		letter, _ := excelize.ColumnNumberToName(colIdx)
		if err := addBooleanValidation(f, sheet, fmt.Sprintf("%s4:%s504", letter, letter)); err != nil {
			return err
		}
	}

	// Date validation for expired_date (kolom 7) - enforce YYYY-MM-DD
	{
		letter, _ := excelize.ColumnNumberToName(7)
		dv := excelize.NewDataValidation(true)
		dv.Sqref = fmt.Sprintf("%s4:%s504", letter, letter)
		dv.Type = "custom"
		dv.Formula1 = fmt.Sprintf("=AND(LEN(%s4)=10,ISNUMBER(DATEVALUE(%s4)),MID(%s4,5,1)=\"-\",MID(%s4,8,1)=\"-\")", letter, letter, letter, letter)
		dv.SetError(
			excelize.DataValidationErrorStyleStop,
			"Format expired_date salah",
			"expired_date harus format YYYY-MM-DD",
		)
		if err := f.AddDataValidation(sheet, dv); err != nil {
			return err
		}
	}

	return nil
}

func addDropdownValidation(f *excelize.File, sheet, sqref, formula string) error {
	dv := excelize.NewDataValidation(true)
	dv.Sqref = sqref
	dv.Type = "list"
	dv.Formula1 = formula
	dv.ShowDropDown = false
	dv.SetError(
		excelize.DataValidationErrorStyleStop,
		"Kode Tidak Valid",
		"Pilih kode dari daftar yang tersedia",
	)
	return f.AddDataValidation(sheet, dv)
}

func addBooleanValidation(f *excelize.File, sheet, sqref string) error {
	dv := excelize.NewDataValidation(true)
	dv.Sqref = sqref
	dv.SetDropList([]string{"ya", "tidak"})
	dv.SetError(
		excelize.DataValidationErrorStyleStop,
		"Nilai Tidak Valid",
		"Isi dengan 'ya' atau 'tidak'",
	)
	return f.AddDataValidation(sheet, dv)
}

// ── Helper: protection & filter ─────────────────────────────────────────────

func applyProtection(f *excelize.File, sheet string, colCount int) {
	f.ProtectSheet(sheet, &excelize.SheetProtectionOptions{
		SelectLockedCells:   true,
		SelectUnlockedCells: true,
		Sort:                true,
		AutoFilter:          true,
	})
}

func applyAutoFilter(f *excelize.File, sheet string, colCount int) {
	lastLetter, _ := excelize.ColumnNumberToName(colCount)
	f.AutoFilter(sheet, fmt.Sprintf("A1:%s1", lastLetter), []excelize.AutoFilterOptions{})
}

// ── Helper: code extraction ──────────────────────────────────────────────────

func extractCodes(types []domain.SarprasTypeRow) []string {
	codes := make([]string, len(types))
	for i, t := range types {
		codes[i] = t.Code
	}
	return codes
}

func extractDeptCodes(depts []domain.DepartmentRow) []string {
	codes := make([]string, len(depts))
	for i, d := range depts {
		codes[i] = d.Code
	}
	return codes
}

// buildPetunjukSheet creates the "Petunjuk" sheet without site_code reference.
func buildPetunjukSheet(f *excelize.File, sarprasTypes []domain.SarprasTypeRow, depts []domain.DepartmentRow) error {
	const sheet = "Petunjuk"

	navyColor := string(domain.ColorNavy)
	whiteColor := string(domain.ColorWhite)
	reqBColor := string(domain.ColorReqB)
	reqTColor := string(domain.ColorReqT)

	titleStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 16, Color: navyColor, Family: "Arial"},
		Alignment: &excelize.Alignment{Vertical: "center"},
	})
	h2Style, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 12, Color: navyColor, Family: "Arial"},
		Alignment: &excelize.Alignment{Vertical: "center"},
	})
	bodyStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Size: 11, Color: "2D3748", Family: "Arial"},
		Alignment: &excelize.Alignment{Vertical: "center", WrapText: true},
	})
	warnStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 11, Color: reqTColor, Family: "Arial"},
		Fill:      excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{reqBColor}},
		Alignment: &excelize.Alignment{Vertical: "center", WrapText: true},
	})
	tableHeaderStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 10, Color: whiteColor, Family: "Arial"},
		Fill:      excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{navyColor}},
		Alignment: &excelize.Alignment{Vertical: "center", Horizontal: "left"},
	})
	tableDataStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Size: 10, Color: "2D3748", Family: "Arial"},
		Alignment: &excelize.Alignment{Vertical: "center"},
		Border: []excelize.Border{
			{Type: "bottom", Color: "E2E8F0", Style: 1},
		},
	})

	type entry struct {
		row    int
		value  string
		style  int
		height float64
	}

	entries := []entry{
		{1, "📋  Petunjuk Pengisian Template Import Sarpras", titleStyle, 40},
		{3, "1. CARA PENGISIAN", h2Style, 28},
		{4, "• Isi data mulai dari baris ke-4. Baris 1–3 adalah header — jangan diubah atau dihapus.", bodyStyle, 22},
		{5, "• Kolom bertanda ⬤ Wajib harus diisi. Kolom ○ Opsional boleh dikosongkan.", bodyStyle, 22},
		{6, "• Kolom sarpras_type_code dan location_dept_code sudah berupa dropdown — klik sel lalu pilih dari daftar yang tersedia.", bodyStyle, 36},
		{7, "• Gunakan dropdown Excel untuk kolom is_critical, has_alternative, has_risk_location (ya / tidak).", bodyStyle, 22},
		{8, "• Format expired_date: YYYY-MM-DD. Contoh: 2027-06-30.", bodyStyle, 22},
		{10, "2. ATURAN VALIDASI", h2Style, 28},
		{11, "⚠  expired_date WAJIB diisi untuk jenis sarpras APAR dan APAB.", warnStyle, 28},
		{12, "• Site akan ditentukan otomatis oleh sistem (tidak perlu diisi di Excel).", bodyStyle, 22},
		{13, "• Jika ada satu baris error pun, sistem TIDAK akan mengimport data apapun (all-or-nothing).", bodyStyle, 22},
		{15, "3. SETELAH MENGISI", h2Style, 28},
		{16, "• Simpan file (.xlsx), lalu upload melalui halaman Tambah Sarpras → tab 'Import via Excel'.", bodyStyle, 22},
		{17, "• Sistem memvalidasi format tiap baris secara lokal, lalu memverifikasi ke database.", bodyStyle, 22},
		{18, "• Jika ada baris error: download file error report, perbaiki, lalu upload ulang.", bodyStyle, 22},
	}

	for _, e := range entries {
		cellStart := fmt.Sprintf("A%d", e.row)
		cellEnd := fmt.Sprintf("B%d", e.row)
		f.SetCellValue(sheet, cellStart, e.value)
		f.MergeCell(sheet, cellStart, cellEnd)
		f.SetCellStyle(sheet, cellStart, cellEnd, e.style)
		f.SetRowHeight(sheet, e.row, e.height)
	}

	currentRow := 20

	// ── Referensi Jenis Sarpras ────────────────────────────────────────
	cell := fmt.Sprintf("A%d", currentRow)
	f.SetCellValue(sheet, cell, "4. REFERENSI JENIS SARPRAS")
	f.MergeCell(sheet, cell, fmt.Sprintf("B%d", currentRow))
	f.SetCellStyle(sheet, cell, fmt.Sprintf("B%d", currentRow), h2Style)
	f.SetRowHeight(sheet, currentRow, 28)
	currentRow++

	f.SetCellValue(sheet, fmt.Sprintf("A%d", currentRow), "Kode")
	f.SetCellValue(sheet, fmt.Sprintf("B%d", currentRow), "Nama Jenis Sarpras")
	f.SetCellStyle(sheet, fmt.Sprintf("A%d", currentRow), fmt.Sprintf("B%d", currentRow), tableHeaderStyle)
	f.SetRowHeight(sheet, currentRow, 22)
	currentRow++

	for _, t := range sarprasTypes {
		f.SetCellValue(sheet, fmt.Sprintf("A%d", currentRow), t.Code)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", currentRow), t.Name)
		f.SetCellStyle(sheet, fmt.Sprintf("A%d", currentRow), fmt.Sprintf("B%d", currentRow), tableDataStyle)
		f.SetRowHeight(sheet, currentRow, 20)
		currentRow++
	}

	currentRow += 2

	// ── Referensi Departemen ─────────────────────────────────────────────
	cell = fmt.Sprintf("A%d", currentRow)
	f.SetCellValue(sheet, cell, "5. REFERENSID DEPARTEMEN")
	f.MergeCell(sheet, cell, fmt.Sprintf("B%d", currentRow))
	f.SetCellStyle(sheet, cell, fmt.Sprintf("B%d", currentRow), h2Style)
	f.SetRowHeight(sheet, currentRow, 28)
	currentRow++

	f.SetCellValue(sheet, fmt.Sprintf("A%d", currentRow), "Kode")
	f.SetCellValue(sheet, fmt.Sprintf("B%d", currentRow), "Nama Departemen")
	f.SetCellStyle(sheet, fmt.Sprintf("A%d", currentRow), fmt.Sprintf("B%d", currentRow), tableHeaderStyle)
	f.SetRowHeight(sheet, currentRow, 22)
	currentRow++

	for _, d := range depts {
		f.SetCellValue(sheet, fmt.Sprintf("A%d", currentRow), d.Code)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", currentRow), d.Name)
		f.SetCellStyle(sheet, fmt.Sprintf("A%d", currentRow), fmt.Sprintf("B%d", currentRow), tableDataStyle)
		f.SetRowHeight(sheet, currentRow, 20)
		currentRow++
	}

	f.SetColWidth(sheet, "A", "A", 20)
	f.SetColWidth(sheet, "B", "B", 80)
	return nil
}

func buildMasterDataSheet(f *excelize.File, sarprasTypeCodes []string, deptCodes []string) error {
	const sheet = "_MasterData"
	f.NewSheet(sheet)

	for i, code := range sarprasTypeCodes {
		f.SetCellValue(sheet, fmt.Sprintf("A%d", i+1), code)
	}
	for i, code := range deptCodes {
		f.SetCellValue(sheet, fmt.Sprintf("B%d", i+1), code)
	}

	return f.SetSheetVisible(sheet, false)
}

// =============================================================================
// Helpers
// =============================================================================

func IsBoolTrue(v string) bool {
	s := strings.TrimSpace(strings.ToLower(v))
	return s == "ya" || s == "yes" || s == "true" || s == "1"
}

func IsValidBool(v string) bool {
	s := strings.TrimSpace(strings.ToLower(v))
	switch s {
	case "ya", "tidak", "yes", "no", "true", "false", "1", "0":
		return true
	}
	return false
}

func CalcRiskScore(isCritical, hasAlternative, hasRiskLocation bool) int {
	score := 1
	if isCritical {
		score += 4
	}
	if !hasAlternative {
		score += 2
	}
	if hasRiskLocation {
		score += 3
	} else {
		score += 1
	}
	return score
}

func ResolveRiskLevel(score int) string {
	switch {
	case score >= 10:
		return "very_high"
	case score >= 8:
		return "high"
	case score >= 6:
		return "medium"
	default:
		return "low"
	}
}

func GenerateNextCodeBulk(prefix, lastCode string) string {
	nextSeq := 1
	if lastCode != "" {
		parts := strings.Split(lastCode, "-")
		if len(parts) > 0 {
			var seq int
			fmt.Sscanf(parts[len(parts)-1], "%d", &seq)
			nextSeq = seq + 1
		}
	}
	return fmt.Sprintf("%s-%03d", prefix, nextSeq)
}
