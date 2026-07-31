package sarpras

import (
	"context"
	"fmt"
	"mime/multipart"
	"strings"
	"time"

	"emertrack/internal/domain"

	"github.com/xuri/excelize/v2"
)

const bulkImportMaxRows = 5000

var bulkImportRequiredCols = []string{
	"sarpras_type_code", "location_dept_code",
	"location_detail", "is_critical", "has_alternative", "has_risk_location",
}

type bulkImportNonEmptyRow struct {
	data     []string
	excelRow int
}

type bulkImportExcelData struct {
	colIdx   map[string]int
	nonEmpty []bulkImportNonEmptyRow
}

type bulkImportMasterCache struct {
	types map[string]*domain.SarprasType
	depts map[string]*domain.Department
	sites map[string]*domain.Site
}

type bulkValidateRowError struct {
	Row    int
	Errors []string
}

func newBulkImportMasterCache() *bulkImportMasterCache {
	return &bulkImportMasterCache{
		types: map[string]*domain.SarprasType{},
		depts: map[string]*domain.Department{},
		sites: map[string]*domain.Site{},
	}
}

func loadBulkImportExcel(file multipart.File, header *multipart.FileHeader) (*bulkImportExcelData, func(), error) {
	if !strings.HasSuffix(strings.ToLower(header.Filename), ".xlsx") {
		return nil, nil, fmt.Errorf("Format file tidak didukung. Harap menggunakan template yang tersedia.")
	}

	f, err := excelize.OpenReader(file)
	if err != nil {
		return nil, nil, fmt.Errorf("gagal membaca file Excel: %w", err)
	}

	sheetName := f.GetSheetName(0)
	allRows, err := f.GetRows(sheetName)
	if err != nil {
		f.Close()
		return nil, nil, fmt.Errorf("gagal membaca sheet: %w", err)
	}

	headerRowIdx, err := findBulkImportHeaderRow(allRows)
	if err != nil {
		f.Close()
		return nil, nil, err
	}

	colIdx := buildBulkImportColIndex(allRows[headerRowIdx])
	if err := validateBulkImportRequiredColumns(colIdx); err != nil {
		f.Close()
		return nil, nil, err
	}

	dataRows := allRows[headerRowIdx+3:]
	nonEmpty := collectNonEmptyBulkImportRows(dataRows, headerRowIdx)
	if err := validateBulkImportRowCount(len(nonEmpty)); err != nil {
		f.Close()
		return nil, nil, err
	}

	return &bulkImportExcelData{colIdx: colIdx, nonEmpty: nonEmpty}, func() { _ = f.Close() }, nil
}

func findBulkImportHeaderRow(allRows [][]string) (int, error) {
	for i, row := range allRows {
		if len(row) > 0 && strings.EqualFold(strings.TrimSpace(row[0]), "sarpras_type_code") {
			return i, nil
		}
	}
	return -1, fmt.Errorf("Kolom 'sarpras_type_code' tidak ditemukan di baris manapun. Pastikan menggunakan template yang benar")
}

func buildBulkImportColIndex(headerRow []string) map[string]int {
	colIdx := map[string]int{}
	for i, h := range headerRow {
		colIdx[strings.TrimSpace(strings.ToLower(h))] = i
	}
	return colIdx
}

func validateBulkImportRequiredColumns(colIdx map[string]int) error {
	for _, col := range bulkImportRequiredCols {
		if _, ok := colIdx[col]; !ok {
			return fmt.Errorf("kolom wajib '%s' tidak ditemukan di header", col)
		}
	}
	return nil
}

func collectNonEmptyBulkImportRows(dataRows [][]string, headerRowIdx int) []bulkImportNonEmptyRow {
	var nonEmpty []bulkImportNonEmptyRow
	for i, r := range dataRows {
		if isBulkImportRowEmpty(r) {
			continue
		}
		nonEmpty = append(nonEmpty, bulkImportNonEmptyRow{
			data:     r,
			excelRow: headerRowIdx + 4 + i,
		})
	}
	return nonEmpty
}

func isBulkImportRowEmpty(row []string) bool {
	for _, cell := range row {
		if strings.TrimSpace(cell) != "" {
			return false
		}
	}
	return true
}

func validateBulkImportRowCount(count int) error {
	if count == 0 {
		return fmt.Errorf("Tidak ada data. Isi datanya terlebih dahulu")
	}
	if count > bulkImportMaxRows {
		return fmt.Errorf("Maksimum 5.000 baris per upload, file berisi %d baris", count)
	}
	return nil
}

func bulkImportGetCell(row []string, key string, colIdx map[string]int) string {
	idx, ok := colIdx[key]
	if !ok || idx >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[idx])
}

func (s *sarprasService) requireSingleDefaultSiteCode(ctx context.Context) (string, error) {
	var sites []domain.Site
	if err := s.db.WithContext(ctx).Find(&sites).Error; err != nil {
		return "", fmt.Errorf("gagal membaca data site: %w", err)
	}
	if len(sites) == 0 {
		return "", fmt.Errorf("tidak ada data site di master database")
	}
	if len(sites) > 1 {
		return "", fmt.Errorf("terdapat lebih dari satu site (%d). Saat ini hanya support satu site default", len(sites))
	}
	return sites[0].Code, nil
}

func (s *sarprasService) getBulkValidateDefaultSiteCode(ctx context.Context) string {
	var sites []domain.Site
	s.db.WithContext(ctx).Find(&sites)
	if len(sites) == 1 {
		return sites[0].Code
	}
	return ""
}

func (s *sarprasService) cachedSarprasType(ctx context.Context, code string, cache map[string]*domain.SarprasType) *domain.SarprasType {
	key := strings.ToUpper(code)
	if st, seen := cache[key]; seen {
		return st
	}
	st, err := s.sarprasTypeRepo.FindByCode(ctx, key)
	if err != nil || st == nil {
		cache[key] = nil
		return nil
	}
	cache[key] = st
	return st
}

func (s *sarprasService) cachedDepartment(ctx context.Context, code string, cache map[string]*domain.Department) *domain.Department {
	key := strings.ToUpper(code)
	if dept, seen := cache[key]; seen {
		return dept
	}
	dept, err := s.masterRepo.FindByCodeDepartment(ctx, key)
	if err != nil || dept == nil {
		cache[key] = nil
		return nil
	}
	cache[key] = dept
	return dept
}

func (s *sarprasService) cachedSite(ctx context.Context, code string, cache map[string]*domain.Site) *domain.Site {
	key := strings.ToUpper(code)
	if site, seen := cache[key]; seen {
		return site
	}
	site, err := s.masterRepo.FindByCodeSite(ctx, key)
	if err != nil || site == nil {
		cache[key] = nil
		return nil
	}
	cache[key] = site
	return site
}

func validateBulkParseTypeCode(typeCode string) []string {
	if typeCode == "" {
		return []string{"sarpras_type_code wajib diisi"}
	}
	if len(typeCode) > 20 {
		return []string{"sarpras_type_code maks 20 karakter"}
	}
	return nil
}

func validateBulkParseDeptCode(deptCode string) []string {
	if deptCode == "" {
		return []string{"location_dept_code wajib diisi"}
	}
	if len(deptCode) > 30 {
		return []string{"location_dept_code maks 30 karakter"}
	}
	return nil
}

func validateBulkParseLocDetail(locDetail string) []string {
	if locDetail == "" {
		return []string{"location_detail wajib diisi"}
	}
	if len(locDetail) > 255 {
		return []string{"location_detail maks 255 karakter"}
	}
	return nil
}

func validateBulkParseBoolFields(isCritStr, hasAltStr, hasRiskStr string) []string {
	var errs []string
	for _, bf := range []struct{ val, name string }{
		{isCritStr, "is_critical"},
		{hasAltStr, "has_alternative"},
		{hasRiskStr, "has_risk_location"},
	} {
		if !IsValidBool(bf.val) {
			errs = append(errs, fmt.Sprintf("%s harus 'ya' atau 'tidak', dapat: '%s'", bf.name, bf.val))
		}
	}
	return errs
}

func validateBulkParseExpiredDate(expDate string) []string {
	if expDate == "" {
		return nil
	}
	if _, err := time.Parse("2006-01-02", expDate); err != nil {
		return []string{fmt.Sprintf("expired_date '%s' bukan format YYYY-MM-DD", expDate)}
	}
	return nil
}

func bulkParseAPARError(st *domain.SarprasType, expDate string) []string {
	if st != nil && st.IsAPAR && expDate == "" {
		return []string{"APAB dan APAR wajib mengisi expired_date"}
	}
	return nil
}

func (s *sarprasService) validateBulkParseMasterRefs(
	ctx context.Context,
	typeCode, deptCode string,
	typeCache map[string]*domain.SarprasType,
	deptCache map[string]*domain.Department,
) ([]string, *domain.SarprasType) {
	var errs []string
	var st *domain.SarprasType

	if typeCode != "" {
		st = s.cachedSarprasType(ctx, typeCode, typeCache)
		if st == nil {
			errs = append(errs, fmt.Sprintf("Jenis sarpras '%s' tidak ditemukan di master", typeCode))
		}
	}

	if deptCode != "" && s.cachedDepartment(ctx, deptCode, deptCache) == nil {
		errs = append(errs, fmt.Sprintf("Departemen '%s' tidak ditemukan di master", deptCode))
	}

	return errs, st
}

func (s *sarprasService) parseBulkImportRow(
	ctx context.Context,
	entry bulkImportNonEmptyRow,
	defaultSiteCode string,
	colIdx map[string]int,
	typeCache map[string]*domain.SarprasType,
	deptCache map[string]*domain.Department,
) domain.BulkParseRow {
	r := entry.data
	typeCode := bulkImportGetCell(r, "sarpras_type_code", colIdx)
	deptCode := bulkImportGetCell(r, "location_dept_code", colIdx)
	locDetail := bulkImportGetCell(r, "location_detail", colIdx)
	isCritStr := bulkImportGetCell(r, "is_critical", colIdx)
	hasAltStr := bulkImportGetCell(r, "has_alternative", colIdx)
	hasRiskStr := bulkImportGetCell(r, "has_risk_location", colIdx)
	expDate := bulkImportGetCell(r, "expired_date", colIdx)

	var errs []string
	errs = append(errs, validateBulkParseTypeCode(typeCode)...)
	errs = append(errs, validateBulkParseDeptCode(deptCode)...)
	errs = append(errs, validateBulkParseLocDetail(locDetail)...)
	errs = append(errs, validateBulkParseBoolFields(isCritStr, hasAltStr, hasRiskStr)...)
	errs = append(errs, validateBulkParseExpiredDate(expDate)...)

	masterErrs, st := s.validateBulkParseMasterRefs(ctx, typeCode, deptCode, typeCache, deptCache)
	errs = append(errs, masterErrs...)
	errs = append(errs, bulkParseAPARError(st, expDate)...)

	ic := IsBoolTrue(isCritStr)
	ha := IsBoolTrue(hasAltStr)
	hr := IsBoolTrue(hasRiskStr)
	score := CalcRiskScore(ic, ha, hr)
	level := ResolveRiskLevel(score)

	return domain.BulkParseRow{
		Row:              entry.excelRow,
		SarprasTypeCode:  typeCode,
		LocationDeptCode: deptCode,
		SiteCode:         defaultSiteCode,
		LocationDetail:   locDetail,
		IsCritical:       ic,
		HasAlternative:   ha,
		HasRiskLocation:  hr,
		ExpiredDate:      expDate,
		RiskScore:        score,
		RiskLevel:        level,
		Valid:            len(errs) == 0,
		Errors:           errs,
	}
}

func resolveBulkValidateSiteCode(itemSiteCode, defaultSiteCode string) string {
	siteCode := strings.ToUpper(itemSiteCode)
	if siteCode == "" && defaultSiteCode != "" {
		return defaultSiteCode
	}
	return siteCode
}

func (s *sarprasService) validateBulkImportTypeCode(ctx context.Context, code string, cache *bulkImportMasterCache) []string {
	if code == "" {
		return nil
	}
	if s.cachedSarprasType(ctx, code, cache.types) == nil {
		return []string{fmt.Sprintf("Jenis sarpras '%s' tidak ditemukan di master", code)}
	}
	return nil
}

func (s *sarprasService) validateBulkImportDeptCode(ctx context.Context, code string, cache *bulkImportMasterCache) []string {
	if code == "" {
		return nil
	}
	if s.cachedDepartment(ctx, code, cache.depts) == nil {
		return []string{fmt.Sprintf("Departemen '%s' tidak ditemukan di master", code)}
	}
	return nil
}

func (s *sarprasService) validateBulkImportSiteCode(ctx context.Context, siteCode string, cache *bulkImportMasterCache) []string {
	if siteCode == "" {
		return nil
	}
	if s.cachedSite(ctx, siteCode, cache.sites) == nil {
		return []string{fmt.Sprintf("Site '%s' tidak ditemukan di master", siteCode)}
	}
	return nil
}

func validateBulkExecuteExpiredDate(expiredDate *string) []string {
	if expiredDate == nil || *expiredDate == "" {
		return nil
	}
	if _, err := time.Parse("2006-01-02", *expiredDate); err != nil {
		return []string{"expired_date harus format YYYY-MM-DD"}
	}
	return nil
}

func (s *sarprasService) validateBulkImportAPAR(ctx context.Context, item domain.BulkImportItemRequest, cache *bulkImportMasterCache) []string {
	if item.SarprasTypeCode == "" {
		return nil
	}
	st := s.cachedSarprasType(ctx, item.SarprasTypeCode, cache.types)
	if st == nil || !st.IsAPAR {
		return nil
	}
	if item.ExpiredDate == nil || *item.ExpiredDate == "" {
		return []string{"APAB dan APAR wajib mengisi expired_date"}
	}
	return nil
}

func (s *sarprasService) validateBulkImportItem(
	ctx context.Context,
	item domain.BulkImportItemRequest,
	defaultSiteCode string,
	cache *bulkImportMasterCache,
) []string {
	siteCode := resolveBulkValidateSiteCode(item.SiteCode, defaultSiteCode)

	var errs []string
	errs = append(errs, s.validateBulkImportTypeCode(ctx, item.SarprasTypeCode, cache)...)
	errs = append(errs, s.validateBulkImportDeptCode(ctx, item.LocationDeptCode, cache)...)
	errs = append(errs, s.validateBulkImportSiteCode(ctx, siteCode, cache)...)
	errs = append(errs, validateBulkExecuteExpiredDate(item.ExpiredDate)...)
	errs = append(errs, s.validateBulkImportAPAR(ctx, item, cache)...)
	return errs
}

func buildBulkValidateResponse(items []domain.BulkImportItemRequest, rowErrors []bulkValidateRowError) *domain.BulkValidateResponse {
	res := &domain.BulkValidateResponse{
		Valid:     len(rowErrors) == 0,
		TotalRows: len(items),
		ErrorRows: len(rowErrors),
	}
	for _, e := range rowErrors {
		res.RowErrors = append(res.RowErrors, struct {
			Row    int      `json:"row"`
			Errors []string `json:"errors"`
		}{e.Row, e.Errors})
	}
	return res
}
