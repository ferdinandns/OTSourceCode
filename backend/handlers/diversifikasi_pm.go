package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"sample-qc-backend/middleware"
	"sample-qc-backend/models"

	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
)

const (
	dbTimeout      = 5 * time.Second
	pgDuplicateKey = "23505"

	maxInsertRetries   = 3
	retryBackoffBase   = 20 * time.Millisecond
	maxProductsDefault = 100
	maxProductsLimit   = 500
	maxProductsPerReq  = 50
)
const (
	maxLenShort  = 100
	maxLenMedium = 255
	maxLenLong   = 1000

	maxLenKodeProduk = 100
	maxLenStabtest   = 255
	maxLenEvaluasi   = 500
)

var allowedStatusPM = map[string]struct{}{
	"Done":        {},
	"On Progress": {},
	"Drop":        {},
}
var allowedStabtestStatus = map[string]struct{}{
	"Reject":      {},
	"Release":     {},
	"On Progress": {},
	"N/A":         {},
	"":            {},
}

type DiversifikasiPMHandler struct {
	DB *sql.DB
}

func NewDiversifikasiPMHandler(db *sql.DB) *DiversifikasiPMHandler {
	return &DiversifikasiPMHandler{DB: db}
}

var errParentAlreadyLinked = errors.New("parent already linked")
var errStaleOrMissing = errors.New("stale or missing record")

type DiversifikasiPMListResponse struct {
	Data []models.DiversifikasiPMListItem `json:"data"`
	models.PaginationMeta
	StatusCounts map[string]int `json:"statusCounts"`
}

const selectColsPM = `
	pm.id, pm.nomor_pm, pm.revision, pm.parent_id, pm.status_project,
	pm.tgl_penerimaan, pm.kode_item, pm.nama_material, pm.manufacture, pm.no_batch_material,
	pm.pm_tgl_analisa, pm.pm_tgl_report, pm.pm_hasil_analisa, pm.pm_keterangan,
	pm.trial_kode_produk, pm.trial_no_batch, pm.trial_hasil_final,
	pm.link_file_diversifikasi, pm.kesimpulan,
	pm.created_at, pm.updated_at, pm.created_by, pm.updated_by`
const productAggPM = `
	COALESCE(
		json_agg(
			json_build_object(
				'id',                    p.id,
				'diversifikasiPmId',     p.diversifikasi_pm_id,
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
				'stabtestStatus',        COALESCE(p.stabtest_status, ''),
				'createdAt',             p.created_at,
				'updatedAt',             p.updated_at
			)
		) FILTER (WHERE p.id IS NOT NULL),
		'[]'
	) AS products`

func appLog(tid, op string, id any, msg string) {
	log.Printf("[PM] traceID=%s op=%s id=%v %s", tid, op, id, msg)
}
func logDBError(tid, op string, id any, err error) {
	var pqErr *pq.Error
	if errors.As(err, &pqErr) {
		log.Printf("[PM] traceID=%s op=%s id=%v pgCode=%s constraint=%s detail=%s",
			tid, op, id, pqErr.Code, pqErr.Constraint, pqErr.Detail)
		return
	}
	log.Printf("[PM] traceID=%s op=%s id=%v err=%v", tid, op, id, err)
}
func handleDBError(c *gin.Context, op string, id any, err error) bool {
	if err == nil {
		return false
	}
	tid := middleware.TraceID(c)
	logDBError(tid, op, id, err)

	switch {
	case errors.Is(err, context.DeadlineExceeded), errors.Is(err, context.Canceled):
		middleware.RespondError(c, http.StatusGatewayTimeout, "TIMEOUT",
			"Request timeout, silakan coba kembali")
	case isDuplicateKey(err):
		middleware.RespondError(c, http.StatusConflict, "CONFLICT",
			"Data dengan nomor PM ini sudah ada")
	default:
		middleware.RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR",
			"Terjadi kesalahan pada server")
	}
	return true
}
func isDuplicateKey(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == pgDuplicateKey
}
func newCtx(c *gin.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(c.Request.Context(), dbTimeout)
}
func nullTimeToString(nt sql.NullTime) string {
	if !nt.Valid {
		return ""
	}
	return formatWIB(nt.Time)
}
func nullTimeToPtr(nt sql.NullTime) *string {
	if !nt.Valid {
		return nil
	}
	s := formatWIB(nt.Time)
	return &s
}
func validateMaxLen(field, s string, maxLen int) string {
	if len(s) > maxLen {
		return fmt.Sprintf("%s maksimal %d karakter", field, maxLen)
	}
	return ""
}
func validatePMFields(
	kodeItem, namaMaterial, statusProject, manufacture,
	noBatch, pmHasil, pmKet, trialKode, trialNoBatch, trialHasil, link, kesimpulan string,
) string {
	switch {
	case strings.TrimSpace(kodeItem) == "":
		return "Kode item wajib diisi"
	case strings.TrimSpace(namaMaterial) == "":
		return "Nama material wajib diisi"
	}
	if statusProject != "" {
		if _, ok := allowedStatusPM[statusProject]; !ok {
			return "Nilai status tidak valid"
		}
	}
	for _, ch := range []struct {
		field  string
		val    string
		maxLen int
	}{
		{"Kode Item", kodeItem, maxLenMedium},
		{"Nama Material", namaMaterial, maxLenMedium},
		{"Manufacture", manufacture, maxLenMedium},
		{"No Batch Material", noBatch, maxLenShort},
		{"PM Hasil Analisa", pmHasil, maxLenMedium},
		{"PM Keterangan", pmKet, maxLenLong},
		{"Trial Kode Produk", trialKode, maxLenMedium},
		{"Trial No Batch", trialNoBatch, maxLenShort},
		{"Trial Hasil Final", trialHasil, maxLenMedium},
		{"Link File", link, maxLenLong},
		{"Kesimpulan", kesimpulan, maxLenLong},
	} {
		if msg := validateMaxLen(ch.field, ch.val, ch.maxLen); msg != "" {
			return msg
		}
	}
	return ""
}
func validateProducts(products []models.DiversifikasiProdukPM) string {
	if len(products) > maxProductsPerReq {
		return fmt.Sprintf("Maksimal %d produk per request", maxProductsPerReq)
	}
	for i, p := range products {
		pfx := fmt.Sprintf("Produk[%d]", i+1)
		for _, ch := range []struct {
			field  string
			val    string
			maxLen int
		}{
			{pfx + " Kode Produk", p.KodeProduk, maxLenKodeProduk},
			{pfx + " Evaluasi As Kemasan", p.EvaluasiAsKemasan, maxLenEvaluasi},
			{pfx + " Produk Fisik", p.ProdukFisik, maxLenStabtest},
			{pfx + " Produk Kimia", p.ProdukKimia, maxLenStabtest},
			{pfx + " Produk Mikrobiologi", p.ProdukMikrobiologi, maxLenStabtest},
			{pfx + " Produk Sensori", p.ProdukSensori, maxLenStabtest},
			{pfx + " Produk Cek Karakteristik", p.ProdukCekKarakteristik, maxLenStabtest},
			{pfx + " Stabtest Fisik", p.StabtestFisik, maxLenStabtest},
			{pfx + " Stabtest Kimia", p.StabtestKimia, maxLenStabtest},
			{pfx + " Stabtest Mikrobiologi", p.StabtestMikrobiologi, maxLenStabtest},
			{pfx + " Stabtest Sensori DFCT", p.StabtestSensoriDFCT, maxLenStabtest},
			{pfx + " Stabtest Keterangan", p.StabtestKeterangan, maxLenLong},
		} {
			if msg := validateMaxLen(ch.field, ch.val, ch.maxLen); msg != "" {
				return msg
			}
		}
		if _, ok := allowedStabtestStatus[p.StabtestStatus]; !ok {
			return fmt.Sprintf("%s: nilai stabtest_status tidak valid", pfx)
		}
	}
	return ""
}
func buildPMBaseWhere(search string) (string, []any) {
	clauses := []string{"deleted_at IS NULL", "parent_id IS NULL"}
	args := []any{}
	if search != "" {
		n := len(args) + 1
		clauses = append(clauses, fmt.Sprintf(
			`(nomor_pm ILIKE $%[1]d OR kode_item ILIKE $%[1]d OR nama_material ILIKE $%[1]d OR manufacture ILIKE $%[1]d)`,
			n,
		))
		args = append(args, "%"+search+"%")
	}
	return "WHERE " + strings.Join(clauses, " AND "), args
}
func buildPMFullWhere(search, status string) (string, []any) {
	where, args := buildPMBaseWhere(search)
	if status != "" && status != "all" {
		if _, ok := allowedStatusPM[status]; ok {
			n := len(args) + 1
			where += fmt.Sprintf(" AND status_project = $%d", n)
			args = append(args, status)
		}
	}
	return where, args
}
func insertProductsPM(
	ctx context.Context,
	tx *sql.Tx,
	parentID int,
	products []models.DiversifikasiProdukPM,
) error {
	const q = `
		INSERT INTO diversifikasi_produk_pm (
			diversifikasi_pm_id, kode_produk,
			produk_tgl_kirim_qc, produk_tgl_keluar_hasil, evaluasi_as_kemasan,
			produk_fisik, produk_kimia, produk_mikrobiologi, produk_sensori,
			produk_cek_karakteristik, stabtest_fisik, stabtest_kimia,
			stabtest_mikrobiologi, stabtest_sensori_dfct,
			stabtest_keterangan, stabtest_status
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`

	for i, p := range products {
		if _, err := tx.ExecContext(ctx, q,
			parentID, p.KodeProduk,
			p.ProdukTglKirimQC, p.ProdukTglKeluarHasil, p.EvaluasiAsKemasan,
			p.ProdukFisik, p.ProdukKimia, p.ProdukMikrobiologi,
			p.ProdukSensori, p.ProdukCekKarakteristik,
			p.StabtestFisik, p.StabtestKimia, p.StabtestMikrobiologi,
			p.StabtestSensoriDFCT, p.StabtestKeterangan, p.StabtestStatus,
		); err != nil {
			return fmt.Errorf("product[%d] kode=%s: %w", i, p.KodeProduk, err)
		}
	}
	return nil
}
func withTx(ctx context.Context, db *sql.DB, fn func(*sql.Tx) error) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginTx: %w", err)
	}
	if err := fn(tx); err != nil {
		if rbErr := tx.Rollback(); rbErr != nil && !errors.Is(rbErr, sql.ErrTxDone) {
			log.Printf("[PM] rollback error (original err=%v): %v", err, rbErr)
		}
		return err
	}
	return tx.Commit()
}
func (h *DiversifikasiPMHandler) GetAll(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 200 {
		limit = 50
	}
	search := strings.TrimSpace(c.Query("search"))
	status := c.Query("status")

	if status != "" && status != "all" {
		if _, ok := allowedStatusPM[status]; !ok {
			middleware.RespondError(c, http.StatusBadRequest, "VALIDATION_ERROR",
				"Nilai status tidak valid")
			return
		}
	}
	baseWhere, baseArgs := buildPMBaseWhere(search)
	fullWhere, fullArgs := buildPMFullWhere(search, status)
	ctx, cancel := newCtx(c)
	defer cancel()

	var total int
	if err := h.DB.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM diversifikasi_pm `+fullWhere,
		fullArgs...,
	).Scan(&total); err != nil {
		handleDBError(c, "GetAll.count", "-", err)
		return
	}
	totalPages := (total + limit - 1) / limit
	if totalPages == 0 {
		totalPages = 1
	}
	if page > totalPages {
		page = totalPages
	}
	offset := (page - 1) * limit
	dataArgs := append(append([]any{}, fullArgs...), limit, offset)
	limitN := len(dataArgs) - 1
	offsetN := len(dataArgs)
	rows, err := h.DB.QueryContext(ctx, fmt.Sprintf(`
		SELECT
			pm.id, pm.nomor_pm, pm.parent_id, pm.status_project,
			pm.tgl_penerimaan, pm.kode_item, pm.nama_material,
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
						'diversifikasiPmId',     p.diversifikasi_pm_id,
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
					) ORDER BY p.id ASC
				) FILTER (WHERE p.id IS NOT NULL),
				'[]'
			) AS products
		FROM  diversifikasi_pm pm
		LEFT  JOIN diversifikasi_produk_pm p ON p.diversifikasi_pm_id = pm.id
		%s
		GROUP BY pm.id
		ORDER BY pm.created_at DESC
		LIMIT  $%d OFFSET $%d`, fullWhere, limitN, offsetN),
		dataArgs...,
	)
	if err != nil {
		handleDBError(c, "GetAll.data", "-", err)
		return
	}
	defer rows.Close()

	data := make([]models.DiversifikasiPMListItem, 0, limit)
	for rows.Next() {
		var item models.DiversifikasiPMListItem
		var tglPenerimaan, pmTglAnalisa, pmTglReport sql.NullTime
		var createdAt, updatedAt sql.NullTime
		var productsJSON []byte
		if err := rows.Scan(
			&item.ID, &item.NomorPM, &item.ParentID, &item.StatusProject,
			&tglPenerimaan, &item.KodeItem, &item.NamaMaterial,
			&item.Manufacture, &item.NoBatchMaterial,
			&pmTglAnalisa, &pmTglReport,
			&item.PmHasilAnalisa, &item.PmKeterangan,
			&item.TrialKodeProduk, &item.TrialNoBatch, &item.TrialHasilFinal,
			&item.LinkFileDiversifikasi, &item.Kesimpulan,
			&createdAt, &updatedAt,
			&productsJSON,
		); err != nil {
			handleDBError(c, "GetAll.scan", item.ID, err)
			return
		}
		item.TglPenerimaan = nullTimeToPtr(tglPenerimaan)
		item.PmTglAnalisa = nullTimeToPtr(pmTglAnalisa)
		item.PmTglReport = nullTimeToPtr(pmTglReport)
		item.CreatedAt = nullTimeToString(createdAt)
		item.UpdatedAt = nullTimeToString(updatedAt)
		item.Products = unmarshalProductsForList(productsJSON)
		data = append(data, item)
	}
	if err := rows.Err(); err != nil {
		handleDBError(c, "GetAll.rows", "-", err)
		return
	}
	statusRows, err := h.DB.QueryContext(ctx,
		`SELECT status_project, COUNT(*) FROM diversifikasi_pm `+
			baseWhere+` GROUP BY status_project`,
		baseArgs...,
	)
	if err != nil {
		handleDBError(c, "GetAll.statusCount", "-", err)
		return
	}
	defer statusRows.Close()

	statusCounts := map[string]int{"Done": 0, "On Progress": 0, "Drop": 0}
	for statusRows.Next() {
		var s string
		var cnt int
		if err := statusRows.Scan(&s, &cnt); err != nil {
			logDBError(middleware.TraceID(c), "GetAll.statusCount.scan", "-", err)
			continue
		}
		if _, ok := allowedStatusPM[s]; ok {
			statusCounts[s] = cnt
		}
	}
	if err := statusRows.Err(); err != nil {
		handleDBError(c, "GetAll.statusRows", "-", err)
		return
	}
	c.JSON(http.StatusOK, DiversifikasiPMListResponse{
		Data: data,
		PaginationMeta: models.PaginationMeta{
			Total:      total,
			Page:       page,
			PerPage:    limit,
			TotalPages: totalPages,
		},
		StatusCounts: statusCounts,
	})
}
func unmarshalProductsForList(data []byte) []models.DiversifikasiProdukPM {
	if len(data) == 0 || string(data) == "null" || string(data) == "[]" {
		return []models.DiversifikasiProdukPM{}
	}
	var raw []productJSON
	if err := json.Unmarshal(data, &raw); err != nil {
		log.Printf("[PM] unmarshalProductsForList json error: %v", err)
		return []models.DiversifikasiProdukPM{}
	}
	out := make([]models.DiversifikasiProdukPM, 0, len(raw))
	for _, r := range raw {
		out = append(out, models.DiversifikasiProdukPM{
			ID:                     r.ID,
			DiversifikasiPMID:      r.DiversifikasiPmId,
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
		})
	}
	return out
}
func (h *DiversifikasiPMHandler) GetProducts(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		middleware.RespondError(c, http.StatusBadRequest, "VALIDATION_ERROR", "ID tidak valid")
		return
	}
	pLimit, _ := strconv.Atoi(c.DefaultQuery("limit", strconv.Itoa(maxProductsDefault)))
	if pLimit < 1 || pLimit > maxProductsLimit {
		pLimit = maxProductsDefault
	}
	pOffset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if pOffset < 0 {
		pOffset = 0
	}
	ctx, cancel := newCtx(c)
	defer cancel()

	rows, err := h.DB.QueryContext(ctx, `
		SELECT id, diversifikasi_pm_id, COALESCE(kode_produk, ''),
		       produk_tgl_kirim_qc, produk_tgl_keluar_hasil,
		       COALESCE(evaluasi_as_kemasan, ''),
		       COALESCE(produk_fisik, ''),           COALESCE(produk_kimia, ''),
		       COALESCE(produk_mikrobiologi, ''),     COALESCE(produk_sensori, ''),
		       COALESCE(produk_cek_karakteristik, ''),
		       COALESCE(stabtest_fisik, ''),          COALESCE(stabtest_kimia, ''),
		       COALESCE(stabtest_mikrobiologi, ''),   COALESCE(stabtest_sensori_dfct, ''),
		       COALESCE(stabtest_keterangan, ''),     COALESCE(stabtest_status, ''),
		       created_at, updated_at
		FROM   diversifikasi_produk_pm
		WHERE  diversifikasi_pm_id = $1
		ORDER  BY id ASC
		LIMIT  $2 OFFSET $3`,
		id, pLimit, pOffset,
	)
	if err != nil {
		handleDBError(c, "GetProducts.query", id, err)
		return
	}
	defer rows.Close()

	products := make([]models.DiversifikasiProdukPMResponse, 0)
	for rows.Next() {
		var p models.DiversifikasiProdukPMResponse
		var tglKirim, tglKeluar, createdAt, updatedAt sql.NullTime
		if err := rows.Scan(
			&p.ID, &p.DiversifikasiPMID, &p.KodeProduk,
			&tglKirim, &tglKeluar,
			&p.EvaluasiAsKemasan,
			&p.ProdukFisik, &p.ProdukKimia,
			&p.ProdukMikrobiologi, &p.ProdukSensori,
			&p.ProdukCekKarakteristik,
			&p.StabtestFisik, &p.StabtestKimia,
			&p.StabtestMikrobiologi, &p.StabtestSensoriDFCT,
			&p.StabtestKeterangan, &p.StabtestStatus,
			&createdAt, &updatedAt,
		); err != nil {
			handleDBError(c, "GetProducts.scan", id, err)
			return
		}
		p.ProdukTglKirimQC = nullTimeToPtr(tglKirim)
		p.ProdukTglKeluarHasil = nullTimeToPtr(tglKeluar)
		p.CreatedAt = nullTimeToString(createdAt)
		p.UpdatedAt = nullTimeToString(updatedAt)
		products = append(products, p)
	}
	if err := rows.Err(); err != nil {
		handleDBError(c, "GetProducts.rows", id, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": products, "total": len(products)})
}
func (h *DiversifikasiPMHandler) Create(c *gin.Context) {
	var req models.CreateDiversifikasiPMRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondError(c, http.StatusBadRequest, "VALIDATION_ERROR",
			"Format data tidak valid")
		return
	}
	if msg := validatePMFields(
		req.KodeItem, req.NamaMaterial, req.StatusProject, req.Manufacture,
		req.NoBatchMaterial, req.PmHasilAnalisa, req.PmKeterangan,
		req.TrialKodeProduk, req.TrialNoBatch, req.TrialHasilFinal,
		req.LinkFileDiversifikasi, req.Kesimpulan,
	); msg != "" {
		middleware.RespondError(c, http.StatusBadRequest, "VALIDATION_ERROR", msg)
		return
	}
	if msg := validateProducts(req.Products); msg != "" {
		middleware.RespondError(c, http.StatusBadRequest, "VALIDATION_ERROR", msg)
		return
	}
	ctx, cancel := newCtx(c)
	defer cancel()

	now := time.Now()
	var revision int
	var inheritedNomor string
	if req.ParentID != nil {
		err := h.DB.QueryRowContext(ctx,
			`SELECT nomor_pm FROM diversifikasi_pm WHERE id = $1 AND deleted_at IS NULL`,
			req.ParentID,
		).Scan(&inheritedNomor)
		if errors.Is(err, sql.ErrNoRows) {
			middleware.RespondError(c, http.StatusBadRequest, "NOT_FOUND",
				"Data induk tidak ditemukan")
			return
		}
		if err != nil {
			handleDBError(c, "Create.lookupParent", *req.ParentID, err)
			return
		}
		var maxRevision int
		if err := h.DB.QueryRowContext(ctx,
			`SELECT COALESCE(MAX(revision), 0) FROM diversifikasi_pm WHERE nomor_pm = $1`,
			inheritedNomor,
		).Scan(&maxRevision); err != nil {
			logDBError(middleware.TraceID(c), "Create.maxRevision", inheritedNomor, err)
		}
		revision = maxRevision + 1
	}
	var newID int
	var nomorPM string
	var lastErr error
	for attempt := 0; attempt < maxInsertRetries; attempt++ {
		if attempt > 0 {
			time.Sleep(retryBackoffBase * time.Duration(attempt))
			appLog(middleware.TraceID(c), "Create.retry", "-",
				fmt.Sprintf("attempt=%d", attempt))
		}
		var txErr error
		newID, nomorPM, txErr = h.execCreateTx(ctx, req, inheritedNomor,
			int(now.Month()), now.Year(), revision)
		if txErr == nil {
			lastErr = nil
			break
		}
		lastErr = txErr

		if errors.Is(txErr, errParentAlreadyLinked) {
			middleware.RespondError(c, http.StatusConflict, "CONFLICT",
				"Parent sudah terhubung ke data lain")
			return
		}
		if !isDuplicateKey(txErr) {
			handleDBError(c, "Create.execTx", "-", txErr)
			return
		}
		logDBError(middleware.TraceID(c),
			fmt.Sprintf("Create.duplicate.attempt%d", attempt+1), "-", txErr)
	}
	if lastErr != nil {
		appLog(middleware.TraceID(c), "Create.exhausted", "-",
			fmt.Sprintf("failed after %d retries", maxInsertRetries))
		middleware.RespondError(c, http.StatusConflict, "CONFLICT",
			"Gagal membuat data setelah beberapa percobaan, silakan coba kembali")
		return
	}
	LogActivity(h.DB, c.GetString("userName"), c.GetString("userDivision"),
		"create", "Diversifikasi PM", nomorPM, "Membuat data baru "+nomorPM)

	c.JSON(http.StatusCreated, gin.H{
		"id":      newID,
		"nomorPM": nomorPM,
		"message": "Berhasil dibuat",
	})
}
func (h *DiversifikasiPMHandler) execCreateTx(
	ctx context.Context,
	req models.CreateDiversifikasiPMRequest,
	inheritedNomor string,
	month, year, revision int,
) (int, string, error) {

	var newID int
	var nomorPM string
	err := withTx(ctx, h.DB, func(tx *sql.Tx) error {
		var err error
		if req.ParentID != nil {
			nomorPM = inheritedNomor
		} else {
			nomorPM, err = generateNomorPMInTx(ctx, tx, month, year)
			if err != nil {
				return fmt.Errorf("generateNomor: %w", err)
			}
		}
		err = tx.QueryRowContext(ctx, `
			INSERT INTO diversifikasi_pm (
				nomor_pm, revision, parent_id, status_project,
				tgl_penerimaan, kode_item, nama_material, manufacture, no_batch_material,
				pm_tgl_analisa, pm_tgl_report, pm_hasil_analisa, pm_keterangan,
				trial_kode_produk, trial_no_batch, trial_hasil_final,
				link_file_diversifikasi, kesimpulan, created_by
			) VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
			RETURNING id`,
			nomorPM, revision, req.StatusProject,
			req.TglPenerimaan, req.KodeItem, req.NamaMaterial, req.Manufacture,
			req.NoBatchMaterial, req.PmTglAnalisa, req.PmTglReport,
			req.PmHasilAnalisa, req.PmKeterangan, req.TrialKodeProduk,
			req.TrialNoBatch, req.TrialHasilFinal,
			req.LinkFileDiversifikasi, req.Kesimpulan, req.CreatedBy,
		).Scan(&newID)
		if err != nil {
			return err
		}
		if req.ParentID != nil {
			res, err := tx.ExecContext(ctx,
				`UPDATE diversifikasi_pm SET parent_id = $1 WHERE id = $2 AND parent_id IS NULL`,
				newID, req.ParentID,
			)
			if err != nil {
				return fmt.Errorf("updateParentID: %w", err)
			}
			if ra, _ := res.RowsAffected(); ra == 0 {
				return errParentAlreadyLinked
			}
		}
		return insertProductsPM(ctx, tx, newID, req.Products)
	})
	if err != nil {
		return 0, "", err
	}
	return newID, nomorPM, nil
}
func generateNomorPMInTx(ctx context.Context, tx *sql.Tx, month, year int) (string, error) {
	prefix := fmt.Sprintf("PM_%02d_%04d_", month, year)

	if _, err := tx.ExecContext(ctx,
		`INSERT INTO nomor_pm_counter (prefix, last_counter)
		 VALUES ($1, 0) ON CONFLICT (prefix) DO NOTHING`, prefix,
	); err != nil {
		return "", fmt.Errorf("upsert counter: %w", err)
	}
	var last int
	if err := tx.QueryRowContext(ctx,
		`SELECT last_counter FROM nomor_pm_counter WHERE prefix = $1 FOR UPDATE`,
		prefix,
	).Scan(&last); err != nil {
		return "", fmt.Errorf("lock counter: %w", err)
	}
	next := last + 1
	if _, err := tx.ExecContext(ctx,
		`UPDATE nomor_pm_counter SET last_counter = $1 WHERE prefix = $2`,
		next, prefix,
	); err != nil {
		return "", fmt.Errorf("update counter: %w", err)
	}
	return fmt.Sprintf("%s%03d", prefix, next), nil
}
func (h *DiversifikasiPMHandler) Update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		middleware.RespondError(c, http.StatusBadRequest, "VALIDATION_ERROR", "ID tidak valid")
		return
	}

	var req models.UpdateDiversifikasiPMRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondError(c, http.StatusBadRequest, "VALIDATION_ERROR",
			"Format data tidak valid")
		return
	}
	if msg := validatePMFields(
		req.KodeItem, req.NamaMaterial, req.StatusProject, req.Manufacture,
		req.NoBatchMaterial, req.PmHasilAnalisa, req.PmKeterangan,
		req.TrialKodeProduk, req.TrialNoBatch, req.TrialHasilFinal,
		req.LinkFileDiversifikasi, req.Kesimpulan,
	); msg != "" {
		middleware.RespondError(c, http.StatusBadRequest, "VALIDATION_ERROR", msg)
		return
	}
	if msg := validateProducts(req.Products); msg != "" {
		middleware.RespondError(c, http.StatusBadRequest, "VALIDATION_ERROR", msg)
		return
	}
	ctx, cancel := newCtx(c)
	defer cancel()
	var old struct {
		nomorPM, status, kodeItem, namaMaterial, manufacture,
		noBatch, pmHasil, pmKet, trialKode, trialNoBatch,
		trialHasil, linkFile, kesimpulan string
		updatedAt sql.NullTime
	}
	err = h.DB.QueryRowContext(ctx, `
		SELECT nomor_pm,
		       COALESCE(status_project,''),     COALESCE(kode_item,''),
		       COALESCE(nama_material,''),       COALESCE(manufacture,''),
		       COALESCE(no_batch_material,''),
		       COALESCE(pm_hasil_analisa,''),    COALESCE(pm_keterangan,''),
		       COALESCE(trial_kode_produk,''),   COALESCE(trial_no_batch,''),
		       COALESCE(trial_hasil_final,''),   COALESCE(link_file_diversifikasi,''),
		       COALESCE(kesimpulan,''),
		       updated_at
		FROM   diversifikasi_pm
		WHERE  id = $1 AND deleted_at IS NULL`, id,
	).Scan(
		&old.nomorPM, &old.status, &old.kodeItem, &old.namaMaterial, &old.manufacture,
		&old.noBatch, &old.pmHasil, &old.pmKet, &old.trialKode, &old.trialNoBatch,
		&old.trialHasil, &old.linkFile, &old.kesimpulan, &old.updatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		middleware.RespondError(c, http.StatusNotFound, "NOT_FOUND", "Data tidak ditemukan")
		return
	}
	if err != nil {
		handleDBError(c, "Update.fetchOld", id, err)
		return
	}
	err = withTx(ctx, h.DB, func(tx *sql.Tx) error {
		res, err := tx.ExecContext(ctx, `
			UPDATE diversifikasi_pm SET
				status_project=$1,       tgl_penerimaan=$2,
				kode_item=$3,            nama_material=$4,
				manufacture=$5,          no_batch_material=$6,
				pm_tgl_analisa=$7,       pm_tgl_report=$8,
				pm_hasil_analisa=$9,     pm_keterangan=$10,
				trial_kode_produk=$11,   trial_no_batch=$12,
				trial_hasil_final=$13,   link_file_diversifikasi=$14,
				kesimpulan=$15,          updated_by=$16,
				updated_at=CURRENT_TIMESTAMP
			WHERE id=$17
			  AND deleted_at IS NULL
			  AND (updated_at = $18 OR ($18::timestamptz IS NULL AND updated_at IS NULL))`,
			req.StatusProject, req.TglPenerimaan, req.KodeItem, req.NamaMaterial,
			req.Manufacture, req.NoBatchMaterial,
			req.PmTglAnalisa, req.PmTglReport, req.PmHasilAnalisa, req.PmKeterangan,
			req.TrialKodeProduk, req.TrialNoBatch, req.TrialHasilFinal,
			req.LinkFileDiversifikasi, req.Kesimpulan, req.UpdatedBy,
			id, old.updatedAt,
		)
		if err != nil {
			return err
		}
		if ra, _ := res.RowsAffected(); ra == 0 {
			return errStaleOrMissing
		}

		if _, err := tx.ExecContext(ctx,
			`DELETE FROM diversifikasi_produk_pm WHERE diversifikasi_pm_id = $1`, id,
		); err != nil {
			return fmt.Errorf("deleteProducts: %w", err)
		}
		return insertProductsPM(ctx, tx, id, req.Products)
	})
	if errors.Is(err, errStaleOrMissing) {
		var exists bool
		_ = h.DB.QueryRowContext(ctx,
			`SELECT EXISTS(SELECT 1 FROM diversifikasi_pm WHERE id=$1 AND deleted_at IS NULL)`, id,
		).Scan(&exists)
		if !exists {
			middleware.RespondError(c, http.StatusNotFound, "NOT_FOUND", "Data tidak ditemukan")
		} else {
			middleware.RespondError(c, http.StatusConflict, "CONFLICT",
				"Data telah diubah oleh pengguna lain, silakan refresh dan coba kembali")
		}
		return
	}
	if err != nil {
		handleDBError(c, "Update.tx", id, err)
		return
	}
	oldMap := pmToMap(
		old.status, "", old.kodeItem, old.namaMaterial, old.manufacture, old.noBatch,
		"", "", old.pmHasil, old.pmKet,
		old.trialKode, old.trialNoBatch, old.trialHasil, old.linkFile, old.kesimpulan,
	)
	newMap := pmToMap(
		req.StatusProject, "", req.KodeItem, req.NamaMaterial, req.Manufacture,
		req.NoBatchMaterial, "", "", req.PmHasilAnalisa, req.PmKeterangan,
		req.TrialKodeProduk, req.TrialNoBatch, req.TrialHasilFinal,
		req.LinkFileDiversifikasi, req.Kesimpulan,
	)
	summary, diffDetail := BuildDiff(oldMap, newMap)
	if summary == "" {
		summary = "(tidak ada perubahan)"
	}
	LogActivity(h.DB, c.GetString("userName"), c.GetString("userDivision"),
		"update", "Diversifikasi PM", old.nomorPM, "Update: "+summary+"||"+diffDetail)

	c.JSON(http.StatusOK, gin.H{"message": "Berhasil diperbarui"})
}

func (h *DiversifikasiPMHandler) Delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		middleware.RespondError(c, http.StatusBadRequest, "VALIDATION_ERROR", "ID tidak valid")
		return
	}
	deletedBy := c.GetString("userName")
	if deletedBy == "" {
		deletedBy = c.Query("deletedBy")
	}
	if deletedBy == "" {
		deletedBy = "Admin"
	}
	ctx, cancel := newCtx(c)
	defer cancel()

	var nomorPM string
	err = withTx(ctx, h.DB, func(tx *sql.Tx) error {
		err := tx.QueryRowContext(ctx,
			`SELECT nomor_pm FROM diversifikasi_pm WHERE id = $1 AND deleted_at IS NULL`, id,
		).Scan(&nomorPM)
		if errors.Is(err, sql.ErrNoRows) {
			return errStaleOrMissing
		}
		if err != nil {
			return err
		}
		res, err := tx.ExecContext(ctx, `
			UPDATE diversifikasi_pm
			SET    deleted_at = NOW(), deleted_by = $1
			WHERE  nomor_pm   = $2
			  AND  deleted_at IS NULL`,
			deletedBy, nomorPM,
		)
		if err != nil {
			return err
		}
		if ra, _ := res.RowsAffected(); ra == 0 {
			return errStaleOrMissing
		}
		return nil
	})
	if errors.Is(err, errStaleOrMissing) {
		middleware.RespondError(c, http.StatusNotFound, "NOT_FOUND", "Data tidak ditemukan")
		return
	}
	if err != nil {
		handleDBError(c, "Delete.tx", id, err)
		return
	}
	LogActivity(h.DB, c.GetString("userName"), c.GetString("userDivision"),
		"delete", "Diversifikasi PM", nomorPM, "Menghapus ke Recycle Bin")

	c.JSON(http.StatusOK, gin.H{"message": "Berhasil dihapus"})
}

func (h *DiversifikasiPMHandler) getRevisionsPM(
	ctx context.Context,
	nomorPM string,
	excludeID int,
) []models.DiversifikasiPMWithProducts {

	revisions := make([]models.DiversifikasiPMWithProducts, 0)

	ctx, cancel := context.WithTimeout(ctx, dbTimeout)
	defer cancel()

	rows, err := h.DB.QueryContext(ctx, fmt.Sprintf(`
		SELECT %s, %s
		FROM   diversifikasi_pm pm
		LEFT   JOIN diversifikasi_produk_pm p ON p.diversifikasi_pm_id = pm.id
		WHERE  pm.nomor_pm = $1
		  AND  pm.id != $2
		  AND  pm.parent_id IS NOT NULL
		  AND  pm.deleted_at IS NULL
		GROUP  BY pm.id
		ORDER  BY pm.created_at ASC`, selectColsPM, productAggPM),
		nomorPM, excludeID,
	)
	if err != nil {
		logDBError("-", "getRevisionsPM.query", nomorPM, err)
		return revisions
	}
	defer rows.Close()

	for rows.Next() {
		item, productsJSON, err := scanPM(rows)
		if err != nil {
			logDBError("-", "getRevisionsPM.scan", nomorPM, err)
			continue
		}
		item.Products = unmarshalProductsPM(productsJSON)
		item.Revisions = []models.DiversifikasiPMWithProducts{}
		revisions = append(revisions, item)
	}
	return revisions
}

func scanPM(row interface{ Scan(...interface{}) error }) (models.DiversifikasiPMWithProducts, []byte, error) {
	var item models.DiversifikasiPMWithProducts
	var productsJSON []byte
	var createdAt, updatedAt sql.NullTime
	err := row.Scan(
		&item.ID, &item.NomorPM, &item.Revision, &item.ParentID, &item.StatusProject,
		&item.TglPenerimaan, &item.KodeItem, &item.NamaMaterial,
		&item.Manufacture, &item.NoBatchMaterial,
		&item.PmTglAnalisa, &item.PmTglReport, &item.PmHasilAnalisa, &item.PmKeterangan,
		&item.TrialKodeProduk, &item.TrialNoBatch, &item.TrialHasilFinal,
		&item.LinkFileDiversifikasi, &item.Kesimpulan,
		&createdAt, &updatedAt,
		&item.CreatedBy, &item.UpdatedBy,
		&productsJSON,
	)
	if err != nil {
		return item, nil, err
	}
	item.CreatedAt = createdAt.Time
	item.UpdatedAt = updatedAt.Time
	return item, productsJSON, nil
}

type productJSON struct {
	ID                     int     `json:"id"`
	DiversifikasiPmId      int     `json:"diversifikasiPmId"`
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

func unmarshalProductsPM(data []byte) []models.DiversifikasiProdukPM {
	products := make([]models.DiversifikasiProdukPM, 0)
	if len(data) == 0 || string(data) == "null" || string(data) == "[]" {
		return products
	}
	var raw []productJSON
	if err := json.Unmarshal(data, &raw); err != nil {
		log.Printf("[PM] unmarshalProductsPM json error: %v", err)
		return products
	}
	parseDatePtr := func(s *string) *time.Time {
		if s == nil || *s == "" {
			return nil
		}
		for _, layout := range []string{
			time.RFC3339, "2006-01-02T15:04:05", "2006-01-02 15:04:05", "2006-01-02",
		} {
			if t, err := time.Parse(layout, *s); err == nil {
				return &t
			}
		}
		return nil
	}
	for _, r := range raw {
		products = append(products, models.DiversifikasiProdukPM{
			ID:                     r.ID,
			DiversifikasiPMID:      r.DiversifikasiPmId,
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
			ProdukTglKirimQC:       parseDatePtr(r.ProdukTglKirimQC),
			ProdukTglKeluarHasil:   parseDatePtr(r.ProdukTglKeluarHasil),
		})
	}
	return products
}
