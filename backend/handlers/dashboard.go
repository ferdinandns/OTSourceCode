package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"sample-qc-backend/middleware"
	"sample-qc-backend/models"

	"github.com/gin-gonic/gin"
)

const (
	dashboardDefaultLimit = 10
	dashboardMaxLimit     = 100
)

var allowedDashboardType = map[string]struct{}{
	"RM": {},
	"PM": {},
}
var allowedDashboardStatus = map[string]struct{}{
	"Done":        {},
	"On Progress": {},
	"Drop":        {},
}

type DashboardResponse struct {
	DiverRM DashboardRM `json:"diverRM"`
	DiverPM DashboardPM `json:"diverPM"`
}
type DashboardRM struct {
	TotalDivers    int              `json:"totalDivers"`
	AnalisaRM      CardStat         `json:"analisaRM"`
	StatusLabscale CardStat         `json:"statusLabscale"`
	StatusScaleUp  CardStat         `json:"statusScaleUp"`
	TableData      DashboardRMTable `json:"tableData"`
}
type DashboardPM struct {
	TotalDivers int              `json:"totalDivers"`
	AnalisaPM   CardStat         `json:"analisaPM"`
	StatusTrial CardStat         `json:"statusTrial"`
	TableData   DashboardPMTable `json:"tableData"`
}
type DashboardRMTable struct {
	Data []DashboardRMRow `json:"data"`
	models.PaginationMeta
}
type DashboardPMTable struct {
	Data []DashboardPMRow `json:"data"`
	models.PaginationMeta
}
type CardStat struct {
	Released int `json:"released"`
	Total    int `json:"total"`
}
type DashboardRMRow struct {
	ID              int                 `json:"id"`
	NomorRM         string              `json:"nomorRM"`
	NamaMaterial    string              `json:"namaMaterial"`
	Manufacture     string              `json:"manufacture"`
	NoBatchMaterial string              `json:"noBatchMaterial"`
	StatusProject   string              `json:"statusProject"`
	HasilRM         string              `json:"hasilRM"`
	HasilAlokasi    string              `json:"hasilAlokasi"`
	HasilScaleUp    string              `json:"hasilScaleUp"`
	Products        []ProductStatusItem `json:"products"`
	CreatedAt       string              `json:"createdAt"`
	UpdatedAt       string              `json:"updatedAt"`
}
type DashboardPMRow struct {
	ID              int                 `json:"id"`
	NomorPM         string              `json:"nomorPM"`
	NamaMaterial    string              `json:"namaMaterial"`
	Manufacture     string              `json:"manufacture"`
	NoBatchMaterial string              `json:"noBatchMaterial"`
	StatusProject   string              `json:"statusProject"`
	HasilPM         string              `json:"hasilPM"`
	HasilAlokasi    string              `json:"hasilAlokasi"`
	HasilTrial      string              `json:"hasilTrial"`
	Products        []ProductStatusItem `json:"products"`
	CreatedAt       string              `json:"createdAt"`
	UpdatedAt       string              `json:"updatedAt"`
}
type ProductStatusItem struct {
	KodeProduk string `json:"kodeProduk"`
	Status     string `json:"status"`
}
type DashboardHandler struct {
	db *sql.DB
}

func NewDashboardHandler(db *sql.DB) *DashboardHandler {
	return &DashboardHandler{db: db}
}
func newCtxDashboard(c *gin.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(c.Request.Context(), 10*time.Second)
}
func handleDashboardDBError(c *gin.Context, op string, err error) bool {
	if err == nil {
		return false
	}
	tid := middleware.TraceID(c)
	log.Printf("[Dashboard] traceID=%s op=%s err=%v", tid, op, err)
	switch {
	case isCtxError(err):
		middleware.RespondError(c, http.StatusGatewayTimeout, "TIMEOUT",
			"Request timeout, silakan coba kembali")
	default:
		middleware.RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR",
			"Terjadi kesalahan pada server")
	}
	return true
}
func isCtxError(err error) bool {
	return err == context.DeadlineExceeded || err == context.Canceled
}

type dashboardTableParams struct {
	page   int
	limit  int
	typ    string
	status string
}

func parseDashboardTableParams(c *gin.Context) (dashboardTableParams, string) {
	p := dashboardTableParams{page: 1, limit: dashboardDefaultLimit, typ: "all", status: "all"}

	if v, err := strconv.Atoi(c.DefaultQuery("page", "1")); err == nil && v >= 1 {
		p.page = v
	}
	if v, err := strconv.Atoi(c.DefaultQuery("limit", strconv.Itoa(dashboardDefaultLimit))); err == nil {
		if v < 1 {
			v = dashboardDefaultLimit
		} else if v > dashboardMaxLimit {
			v = dashboardMaxLimit
		}
		p.limit = v
	}
	if t := c.Query("type"); t != "" && t != "all" {
		if _, ok := allowedDashboardType[t]; !ok {
			return p, "Nilai type tidak valid. Pilihan: all, RM, PM"
		}
		p.typ = t
	}
	if s := c.Query("status"); s != "" && s != "all" {
		if _, ok := allowedDashboardStatus[s]; !ok {
			return p, "Nilai status tidak valid. Pilihan: all, Done, On Progress, Drop"
		}
		p.status = s
	}
	return p, ""
}
func buildTableUnionWhere(
	alias string,
	status string,
	from, to time.Time,
	baseArgOffset int,
) (string, []any) {
	clauses := []string{
		fmt.Sprintf("%s.deleted_at IS NULL", alias),
		fmt.Sprintf("%s.parent_id IS NULL", alias),
		fmt.Sprintf("%s.created_at >= $%d", alias, baseArgOffset+1),
		fmt.Sprintf("%s.created_at <= $%d", alias, baseArgOffset+2),
	}
	args := []any{from, to}
	if status != "" && status != "all" {
		if _, ok := allowedDashboardStatus[status]; ok {
			clauses = append(
				clauses,
				fmt.Sprintf("%s.status_project = $%d", alias, baseArgOffset+3),
			)
			args = append(args, status)
		}
	}
	return "WHERE " + strings.Join(clauses, " AND "), args
}
func buildUnionQuery(typ, status string, from, to time.Time) (countQuery, dataQuery string, args []any) {
	rmSelect := `
		SELECT
			rm.id                                        AS id,
			'RM'                                         AS type,
			rm.nomor_rm                                  AS nomor,
			COALESCE(rm.nama_material,   '')             AS nama_material,
			COALESCE(rm.manufacture,     '')             AS manufacture,
			COALESCE(rm.no_batch_material,'')            AS no_batch_material,
			COALESCE(rm.status_project,  '')             AS status_project,
			COALESCE(rm.rm_status,       '')             AS hasil_analisa,
			COALESCE(rm.scale_up_status, '')             AS hasil_scale_up,
			COALESCE(
				(SELECT json_agg(json_build_object(
					'kodeProduk', COALESCE(p.kode_produk,''),
					'status',     COALESCE(p.stabtest_status,'')
				) ORDER BY p.id)
				 FROM diversifikasi_produk p
				 WHERE p.diversifikasi_rm_id = rm.id),
				'[]'::json
			)                                            AS products_json,
			rm.created_at,
			rm.updated_at
		FROM diversifikasi_rm rm
	`

	pmSelect := `
		SELECT
			pm.id                                        AS id,
			'PM'                                         AS type,
			pm.nomor_pm                                  AS nomor,
			COALESCE(pm.nama_material,   '')             AS nama_material,
			COALESCE(pm.manufacture,     '')             AS manufacture,
			COALESCE(pm.no_batch_material,'')            AS no_batch_material,
			COALESCE(pm.status_project,  '')             AS status_project,
			COALESCE(pm.pm_hasil_analisa,'')             AS hasil_analisa,
			COALESCE(pm.trial_hasil_final,'')            AS hasil_scale_up,
			COALESCE(
				(SELECT json_agg(json_build_object(
					'kodeProduk', COALESCE(pp.kode_produk,''),
					'status',     COALESCE(pp.stabtest_status,'')
				) ORDER BY pp.id)
				 FROM diversifikasi_produk_pm pp
				 WHERE pp.diversifikasi_pm_id = pm.id),
				'[]'::json
			)                                            AS products_json,
			pm.created_at,
			pm.updated_at
		FROM diversifikasi_pm pm
	`
	var parts []string
	args = []any{}
	if typ == "all" || typ == "RM" {
		whereRM, argsRM := buildTableUnionWhere("rm", status, from, to, 0)
		parts = append(parts, fmt.Sprintf("(%s %s)", rmSelect, whereRM))
		args = append(args, argsRM...)
	}
	if typ == "all" || typ == "PM" {
		pmArgOffset := len(args)
		wherePM, argsPM := buildTableUnionWhere("pm", status, from, to, pmArgOffset)
		parts = append(parts, fmt.Sprintf("(%s %s)", pmSelect, wherePM))
		args = append(args, argsPM...)
	}
	unionSQL := strings.Join(parts, " UNION ALL ")
	countQuery = fmt.Sprintf(`SELECT COUNT(*) FROM (%s) AS u`, unionSQL)
	limitN := len(args) + 1
	offsetN := len(args) + 2
	dataQuery = fmt.Sprintf(`
		SELECT id, type, nomor, nama_material, manufacture, no_batch_material,
		       status_project, hasil_analisa, hasil_scale_up, products_json,
		       created_at, updated_at
		FROM (%s) AS u
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d`,
		unionSQL, limitN, offsetN,
	)
	return countQuery, dataQuery, args
}

type dashboardUnionRow struct {
	id              int
	rowType         string
	nomor           string
	namaMaterial    string
	manufacture     string
	noBatchMaterial string
	statusProject   string
	hasilAnalisa    string
	hasilScaleUp    string
	productsJSON    []byte
	createdAt       string
	updatedAt       string
}

func scanDashboardUnionRow(rows *sql.Rows) (dashboardUnionRow, error) {
	var r dashboardUnionRow
	var createdAt, updatedAt sql.NullTime
	err := rows.Scan(
		&r.id, &r.rowType, &r.nomor,
		&r.namaMaterial, &r.manufacture, &r.noBatchMaterial,
		&r.statusProject, &r.hasilAnalisa, &r.hasilScaleUp,
		&r.productsJSON,
		&createdAt, &updatedAt,
	)
	if err != nil {
		return r, err
	}
	if createdAt.Valid {
		r.createdAt = formatWIB(createdAt.Time)
	}
	if updatedAt.Valid {
		r.updatedAt = formatWIB(updatedAt.Time)
	}
	return r, nil
}
func unmarshalDashboardProducts(data []byte) []ProductStatusItem {
	out := make([]ProductStatusItem, 0)
	if len(data) == 0 || string(data) == "null" || string(data) == "[]" {
		return out
	}
	var raw []struct {
		KodeProduk string `json:"kodeProduk"`
		Status     string `json:"status"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		log.Printf("[Dashboard] unmarshalDashboardProducts err=%v", err)
		return out
	}
	for _, r := range raw {
		out = append(out, ProductStatusItem{KodeProduk: r.KodeProduk, Status: r.Status})
	}
	return out
}
func dashboardLabscaleStatus(products []ProductStatusItem) string {
	if len(products) == 0 {
		return ""
	}
	for _, p := range products {
		if p.Status == "Release" {
			return "Release"
		}
	}
	return "On Progress"
}
func (h *DashboardHandler) GetDashboard(c *gin.Context) {
	ctx, cancel := newCtxDashboard(c)
	defer cancel()

	fromStr := c.DefaultQuery("from", "")
	toStr := c.DefaultQuery("to", "")

	var fromDate, toDate time.Time
	var err error
	if fromStr == "" {
		fromDate = time.Date(time.Now().Year(), time.Now().Month(), 1, 0, 0, 0, 0, wib)
	} else {
		fromDate, err = time.Parse("2006-01-02", fromStr)
		if err != nil {
			middleware.RespondError(c, http.StatusBadRequest, "VALIDATION_ERROR",
				"Format tanggal 'from' tidak valid (gunakan YYYY-MM-DD)")
			return
		}
	}
	if toStr == "" {
		toDate = time.Now()
	} else {
		toDate, err = time.Parse("2006-01-02", toStr)
		if err != nil {
			middleware.RespondError(c, http.StatusBadRequest, "VALIDATION_ERROR",
				"Format tanggal 'to' tidak valid (gunakan YYYY-MM-DD)")
			return
		}
	}
	toDate = time.Date(toDate.Year(), toDate.Month(), toDate.Day(), 23, 59, 59, 0, wib)
	tableParams, validationMsg := parseDashboardTableParams(c)
	if validationMsg != "" {
		middleware.RespondError(c, http.StatusBadRequest, "VALIDATION_ERROR", validationMsg)
		return
	}
	rmSummary, err := h.getRMSummary(ctx, fromDate, toDate)
	if handleDashboardDBError(c, "GetDashboard.rmSummary", err) {
		return
	}
	pmSummary, err := h.getPMSummary(ctx, fromDate, toDate)
	if handleDashboardDBError(c, "GetDashboard.pmSummary", err) {
		return
	}
	rmTable, pmTable, err := h.getDashboardTable(ctx, tableParams, fromDate, toDate)
	if handleDashboardDBError(c, "GetDashboard.table", err) {
		return
	}
	c.JSON(http.StatusOK, DashboardResponse{
		DiverRM: DashboardRM{
			TotalDivers:    rmSummary.totalDivers,
			AnalisaRM:      rmSummary.analisaRM,
			StatusLabscale: rmSummary.statusLabscale,
			StatusScaleUp:  rmSummary.statusScaleUp,
			TableData:      rmTable,
		},
		DiverPM: DashboardPM{
			TotalDivers: pmSummary.totalDivers,
			AnalisaPM:   pmSummary.analisaPM,
			StatusTrial: pmSummary.statusTrial,
			TableData:   pmTable,
		},
	})
}

type rmSummaryResult struct {
	totalDivers    int
	analisaRM      CardStat
	statusLabscale CardStat
	statusScaleUp  CardStat
}
type pmSummaryResult struct {
	totalDivers int
	analisaPM   CardStat
	statusTrial CardStat
}

func (h *DashboardHandler) getRMSummary(ctx context.Context, from, to time.Time) (rmSummaryResult, error) {
	result := rmSummaryResult{}

	err := h.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM diversifikasi_rm
		WHERE deleted_at IS NULL AND parent_id IS NULL
		  AND created_at >= $1 AND created_at <= $2`,
		from, to,
	).Scan(&result.totalDivers)
	if err != nil {
		return result, err
	}
	rows, err := h.db.QueryContext(ctx, `
		SELECT id, COALESCE(rm_status,''), COALESCE(scale_up_status,'')
		FROM diversifikasi_rm
		WHERE deleted_at IS NULL AND parent_id IS NULL
		  AND created_at >= $1 AND created_at <= $2`,
		from, to,
	)
	if err != nil {
		return result, err
	}
	defer rows.Close()
	type rmStatRow struct {
		id            int
		rmStatus      string
		scaleUpStatus string
	}
	var statRows []rmStatRow
	rmReleasedCount := 0
	scaleUpReleasedCount := 0
	for rows.Next() {
		var r rmStatRow
		if err := rows.Scan(&r.id, &r.rmStatus, &r.scaleUpStatus); err != nil {
			continue
		}
		statRows = append(statRows, r)
		if r.rmStatus == "Release" {
			rmReleasedCount++
		}
		if r.scaleUpStatus == "Release" {
			scaleUpReleasedCount++
		}
	}
	if err := rows.Err(); err != nil {
		return result, err
	}
	total := len(statRows)
	labscaleTotalProducts := 0
	labscaleReleasedProducts := 0
	for _, sr := range statRows {
		products, _, err := h.getRMProducts(ctx, sr.id)
		if err != nil {
			continue
		}
		for _, p := range products {
			labscaleTotalProducts++
			if p.Status == "Release" {
				labscaleReleasedProducts++
			}
		}
	}
	result.analisaRM = CardStat{Released: rmReleasedCount, Total: total}
	result.statusLabscale = CardStat{Released: labscaleReleasedProducts, Total: labscaleTotalProducts}
	result.statusScaleUp = CardStat{Released: scaleUpReleasedCount, Total: total}
	return result, nil
}
func (h *DashboardHandler) getPMSummary(ctx context.Context, from, to time.Time) (pmSummaryResult, error) {
	result := pmSummaryResult{}

	err := h.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM diversifikasi_pm
		WHERE deleted_at IS NULL AND parent_id IS NULL
		  AND created_at >= $1 AND created_at <= $2`,
		from, to,
	).Scan(&result.totalDivers)
	if err != nil {
		return result, err
	}
	rows, err := h.db.QueryContext(ctx, `
		SELECT COALESCE(pm_hasil_analisa,''), COALESCE(trial_hasil_final,'')
		FROM diversifikasi_pm
		WHERE deleted_at IS NULL AND parent_id IS NULL
		  AND created_at >= $1 AND created_at <= $2`,
		from, to,
	)
	if err != nil {
		return result, err
	}
	defer rows.Close()

	pmReleasedCount := 0
	trialMSCount := 0
	total := 0
	for rows.Next() {
		var pmStatus, trialHasil string
		if err := rows.Scan(&pmStatus, &trialHasil); err != nil {
			continue
		}
		total++
		if pmStatus == "Release" {
			pmReleasedCount++
		}
		if trialHasil == "MS" {
			trialMSCount++
		}
	}
	if err := rows.Err(); err != nil {
		return result, err
	}
	result.analisaPM = CardStat{Released: pmReleasedCount, Total: total}
	result.statusTrial = CardStat{Released: trialMSCount, Total: total}
	return result, nil
}
func (h *DashboardHandler) getDashboardTable(
	ctx context.Context,
	p dashboardTableParams,
	from, to time.Time,
) (DashboardRMTable, DashboardPMTable, error) {
	emptyRM := DashboardRMTable{
		Data:           make([]DashboardRMRow, 0),
		PaginationMeta: models.PaginationMeta{Total: 0, Page: p.page, PerPage: p.limit, TotalPages: 1},
	}
	emptyPM := DashboardPMTable{
		Data:           make([]DashboardPMRow, 0),
		PaginationMeta: models.PaginationMeta{Total: 0, Page: p.page, PerPage: p.limit, TotalPages: 1},
	}
	countQ, dataQ, baseArgs := buildUnionQuery(p.typ, p.status, from, to)
	var total int
	if err := h.db.QueryRowContext(ctx, countQ, baseArgs...).Scan(&total); err != nil {
		return emptyRM, emptyPM, err
	}
	totalPages := (total + p.limit - 1) / p.limit
	if totalPages < 1 {
		totalPages = 1
	}
	if p.page > totalPages {
		p.page = totalPages
	}
	offset := (p.page - 1) * p.limit
	dataArgs := append(append([]any{}, baseArgs...), p.limit, offset)
	rows, err := h.db.QueryContext(ctx, dataQ, dataArgs...)
	if err != nil {
		return emptyRM, emptyPM, err
	}
	defer rows.Close()

	rmRows := make([]DashboardRMRow, 0)
	pmRows := make([]DashboardPMRow, 0)
	for rows.Next() {
		u, scanErr := scanDashboardUnionRow(rows)
		if scanErr != nil {
			log.Printf("[Dashboard] getDashboardTable.scan err=%v", scanErr)
			return emptyRM, emptyPM, scanErr
		}
		products := unmarshalDashboardProducts(u.productsJSON)

		switch u.rowType {
		case "RM":
			rmRows = append(rmRows, DashboardRMRow{
				ID:              u.id,
				NomorRM:         u.nomor,
				NamaMaterial:    u.namaMaterial,
				Manufacture:     u.manufacture,
				NoBatchMaterial: u.noBatchMaterial,
				StatusProject:   u.statusProject,
				HasilRM:         u.hasilAnalisa,
				HasilAlokasi:    dashboardLabscaleStatus(products),
				HasilScaleUp:    u.hasilScaleUp,
				Products:        products,
				CreatedAt:       u.createdAt,
				UpdatedAt:       u.updatedAt,
			})
		case "PM":
			pmRows = append(pmRows, DashboardPMRow{
				ID:              u.id,
				NomorPM:         u.nomor,
				NamaMaterial:    u.namaMaterial,
				Manufacture:     u.manufacture,
				NoBatchMaterial: u.noBatchMaterial,
				StatusProject:   u.statusProject,
				HasilPM:         u.hasilAnalisa,
				HasilAlokasi:    dashboardLabscaleStatus(products),
				HasilTrial:      u.hasilScaleUp,
				Products:        products,
				CreatedAt:       u.createdAt,
				UpdatedAt:       u.updatedAt,
			})
		}
	}
	if err := rows.Err(); err != nil {
		return emptyRM, emptyPM, err
	}
	meta := models.PaginationMeta{
		Total:      total,
		Page:       p.page,
		PerPage:    p.limit,
		TotalPages: totalPages,
	}
	rmTable := DashboardRMTable{Data: rmRows, PaginationMeta: meta}
	pmTable := DashboardPMTable{Data: pmRows, PaginationMeta: meta}
	return rmTable, pmTable, nil
}
func (h *DashboardHandler) getRMProducts(ctx context.Context, rmID int) ([]ProductStatusItem, int, error) {
	rows, err := h.db.QueryContext(ctx, `
		SELECT COALESCE(kode_produk,''), COALESCE(stabtest_status,'')
		FROM diversifikasi_produk
		WHERE diversifikasi_rm_id = $1
		ORDER BY id`,
		rmID,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var products []ProductStatusItem
	released := 0
	for rows.Next() {
		var p ProductStatusItem
		if err := rows.Scan(&p.KodeProduk, &p.Status); err != nil {
			continue
		}
		products = append(products, p)
		if p.Status == "Release" {
			released++
		}
	}
	return products, released, rows.Err()
}
