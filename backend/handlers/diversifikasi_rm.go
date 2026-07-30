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
)

const (
	maxProductsPerReqRM = 50
	maxLenShortRM       = 100
	maxLenMediumRM      = 255
	maxLenLongRM        = 1000
)

var allowedStatusRM = map[string]struct{}{
	"Done":        {},
	"On Progress": {},
	"Drop":        {},
}

var allowedStabtestStatusRM = map[string]struct{}{
	"Reject":      {},
	"Release":     {},
	"On Progress": {},
	"N/A":         {},
	"":            {},
}

type DiversifikasiRMHandler struct {
	DB *sql.DB
}

var errRMParentAlreadyLinked = errors.New("rm: parent already linked")
var errRMStaleOrMissing = errors.New("rm: stale or missing record")

type DiversifikasiRMListResponse struct {
	Data []models.DiversifikasiRMListItem `json:"data"`
	models.PaginationMeta
	StatusCounts map[string]int `json:"statusCounts"`
}

const selectColsRM = `
	rm.id, rm.nomor_rm, rm.parent_id, rm.status_project,
	rm.tgl_kirim_cpro, rm.tgl_terima_ts,
	rm.kode_item, rm.nama_material, rm.manufacture, rm.no_batch_material,
	rm.rm_tgl_kirim_qc, rm.rm_tgl_keluar_hasil_analisa,
	rm.rm_fisik, rm.rm_kimia, rm.rm_mikrobiologi,
	rm.rm_sensori_material, rm.rm_cek_karakteristik, rm.rm_status,
	rm.perlu_analisa_andev, rm.andev_kimia, rm.andev_verifikasi_ma, rm.andev_status,
	rm.scale_up_kode_produk, rm.no_batch_scale_up, rm.scale_up_status,
	rm.tgl_dilakukan_scale_up, rm.scale_up_tgl_kirim_qc, rm.scale_up_tgl_keluar_hasil_analisa,
	rm.link_file_diversifikasi, rm.kesimpulan,
	rm.created_at, rm.updated_at`

const productAggRM = `
	COALESCE(
		json_agg(
			json_build_object(
				'id',                    p.id,
				'diversifikasiRmId',     p.diversifikasi_rm_id,
				'kodeProduk',            COALESCE(p.kode_produk, ''),
				'produkTglKirimQC',      p.produk_tgl_kirim_qc,
				'produkTglKeluarHasil',  p.produk_tgl_keluar_hasil,
				'produkFisik',           COALESCE(p.produk_fisik, ''),
				'produkKimia',           COALESCE(p.produk_kimia, ''),
				'produkMikrobiologi',    COALESCE(p.produk_mikrobiologi, ''),
				'produkSensori',         COALESCE(p.produk_sensori, ''),
				'produkCekKarakteristik',COALESCE(p.produk_cek_karakteristik, ''),
				'stabtestFisik',         COALESCE(p.stabtest_fisik, ''),
				'stabtestKimia',         COALESCE(p.stabtest_kimia, ''),
				'stabtestMikrobiologi',  COALESCE(p.stabtest_mikrobiologi, ''),
				'stabtestSensoriDFCT',   COALESCE(p.stabtest_sensori_dfct, ''),
				'stabtestStatus',        COALESCE(p.stabtest_status, ''),
				'keterangan',            COALESCE(p.keterangan, '')
			) ORDER BY p.id ASC
		) FILTER (WHERE p.id IS NOT NULL),
		'[]'
	) AS products`

func newCtxRM(c *gin.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(c.Request.Context(), 5*time.Second)
}

func buildRMBaseWhere(search string) (string, []any) {
	clauses := []string{"rm.deleted_at IS NULL", "rm.parent_id IS NULL"}
	args := []any{}
	if search != "" {
		n := len(args) + 1
		clauses = append(clauses, fmt.Sprintf(
			`(rm.nomor_rm ILIKE $%[1]d OR rm.kode_item ILIKE $%[1]d OR rm.nama_material ILIKE $%[1]d OR rm.manufacture ILIKE $%[1]d)`,
			n,
		))
		args = append(args, "%"+search+"%")
	}
	return "WHERE " + strings.Join(clauses, " AND "), args
}

func buildRMFullWhere(search, status string) (string, []any) {
	where, args := buildRMBaseWhere(search)
	if status != "" && status != "all" {
		if _, ok := allowedStatusRM[status]; ok {
			n := len(args) + 1
			where += fmt.Sprintf(" AND rm.status_project = $%d", n)
			args = append(args, status)
		}
	}
	return where, args
}

func validateRMFields(kodeItem, namaMaterial, statusProject string) string {
	if strings.TrimSpace(kodeItem) == "" {
		return "Kode item wajib diisi"
	}
	if strings.TrimSpace(namaMaterial) == "" {
		return "Nama material wajib diisi"
	}
	if statusProject != "" {
		if _, ok := allowedStatusRM[statusProject]; !ok {
			return "Nilai status project tidak valid"
		}
	}
	return ""
}

func validateRMProducts(products []models.DiversifikasiProduk) string {
	if len(products) > maxProductsPerReqRM {
		return fmt.Sprintf("Maksimal %d produk per request", maxProductsPerReqRM)
	}
	for i, p := range products {
		pfx := fmt.Sprintf("Produk[%d]", i+1)
		checks := []struct {
			field  string
			val    string
			maxLen int
		}{
			{pfx + " Kode Produk", p.KodeProduk, maxLenMediumRM},
			{pfx + " Stabtest Keterangan", p.Keterangan, maxLenLongRM},
		}
		for _, ch := range checks {
			if len(ch.val) > ch.maxLen {
				return fmt.Sprintf("%s maksimal %d karakter", ch.field, ch.maxLen)
			}
		}
		if _, ok := allowedStabtestStatusRM[p.StabtestStatus]; !ok {
			return fmt.Sprintf("%s: nilai stabtest_status tidak valid", pfx)
		}
	}
	return ""
}

func handleRMDBError(c *gin.Context, op string, id any, err error) bool {
	if err == nil {
		return false
	}
	tid := middleware.TraceID(c)
	log.Printf("[RM] traceID=%s op=%s id=%v err=%v", tid, op, id, err)

	switch {
	case errors.Is(err, context.DeadlineExceeded), errors.Is(err, context.Canceled):
		middleware.RespondError(c, http.StatusGatewayTimeout, "TIMEOUT",
			"Request timeout, silakan coba kembali")
	default:
		middleware.RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR",
			"Terjadi kesalahan pada server")
	}
	return true
}

func scanRMListRow(rows *sql.Rows) (models.DiversifikasiRMListItem, error) {
	var item models.DiversifikasiRMListItem

	var (
		tglKirimCPro, tglTerimaTS                sql.NullTime
		rmTglKirimQC, rmTglKeluarHasilAnalisa    sql.NullTime
		tglDilakukanScaleUp                      sql.NullTime
		scaleUpTglKirimQC, scaleUpTglKeluarHasil sql.NullTime
		createdAt, updatedAt                     sql.NullTime
		productsJSON                             []byte
	)

	err := rows.Scan(
		&item.ID, &item.NomorRM, &item.ParentID, &item.StatusProject,
		&tglKirimCPro, &tglTerimaTS,
		&item.KodeItem, &item.NamaMaterial, &item.Manufacture, &item.NoBatchMaterial,
		&rmTglKirimQC, &rmTglKeluarHasilAnalisa,
		&item.RmFisik, &item.RmKimia, &item.RmMikrobiologi,
		&item.RmSensoriMaterial, &item.RmCekKarakteristik, &item.RmStatus,
		&item.PerluAnalisaAndev, &item.AndevKimia, &item.AndevVerifikasiMA, &item.AndevStatus,
		&item.ScaleUpKodeProduk, &item.NoBatchScaleUp, &item.ScaleUpStatus,
		&tglDilakukanScaleUp, &scaleUpTglKirimQC, &scaleUpTglKeluarHasil,
		&item.LinkFileDiversifikasi, &item.Kesimpulan,
		&createdAt, &updatedAt,
		&productsJSON,
	)
	if err != nil {
		return item, err
	}

	item.TglKirimCPro = nullTimeToPtr(tglKirimCPro)
	item.TglTerimaTS = nullTimeToPtr(tglTerimaTS)
	item.RmTglKirimQC = nullTimeToPtr(rmTglKirimQC)
	item.RmTglKeluarHasilAnalisa = nullTimeToPtr(rmTglKeluarHasilAnalisa)
	item.TglDilakukanScaleUp = nullTimeToPtr(tglDilakukanScaleUp)
	item.ScaleUpTglKirimQC = nullTimeToPtr(scaleUpTglKirimQC)
	item.ScaleUpTglKeluarHasilAnalisa = nullTimeToPtr(scaleUpTglKeluarHasil)
	item.CreatedAt = nullTimeToString(createdAt)
	item.UpdatedAt = nullTimeToString(updatedAt)

	item.Products = unmarshalProductsRM(productsJSON)
	return item, nil
}

type productRMJSON struct {
	ID                     int     `json:"id"`
	DiversifikasiRmId      int     `json:"diversifikasiRmId"`
	KodeProduk             string  `json:"kodeProduk"`
	ProdukTglKirimQC       *string `json:"produkTglKirimQC"`
	ProdukTglKeluarHasil   *string `json:"produkTglKeluarHasil"`
	ProdukFisik            string  `json:"produkFisik"`
	ProdukKimia            string  `json:"produkKimia"`
	ProdukMikrobiologi     string  `json:"produkMikrobiologi"`
	ProdukSensori          string  `json:"produkSensori"`
	ProdukCekKarakteristik string  `json:"produkCekKarakteristik"`
	StabtestFisik          string  `json:"stabtestFisik"`
	StabtestKimia          string  `json:"stabtestKimia"`
	StabtestMikrobiologi   string  `json:"stabtestMikrobiologi"`
	StabtestSensoriDFCT    string  `json:"stabtestSensoriDFCT"`
	StabtestStatus         string  `json:"stabtestStatus"`
	Keterangan             string  `json:"keterangan"`
}

func unmarshalProductsRM(data []byte) []models.DiversifikasiProduk {
	out := make([]models.DiversifikasiProduk, 0)
	if len(data) == 0 || string(data) == "null" || string(data) == "[]" {
		return out
	}

	var raw []productRMJSON
	if err := json.Unmarshal(data, &raw); err != nil {
		log.Printf("[RM] unmarshalProductsRM json error: %v", err)
		return out
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
		out = append(out, models.DiversifikasiProduk{
			ID:                     r.ID,
			DiversifikasiRMID:      r.DiversifikasiRmId,
			KodeProduk:             r.KodeProduk,
			ProdukFisik:            r.ProdukFisik,
			ProdukKimia:            r.ProdukKimia,
			ProdukMikrobiologi:     r.ProdukMikrobiologi,
			ProdukSensori:          r.ProdukSensori,
			ProdukCekKarakteristik: r.ProdukCekKarakteristik,
			StabtestFisik:          r.StabtestFisik,
			StabtestKimia:          r.StabtestKimia,
			StabtestMikrobiologi:   r.StabtestMikrobiologi,
			StabtestSensoriDFCT:    r.StabtestSensoriDFCT,
			StabtestStatus:         r.StabtestStatus,
			Keterangan:             r.Keterangan,
			ProdukTglKirimQC:       parseDatePtr(r.ProdukTglKirimQC),
			ProdukTglKeluarHasil:   parseDatePtr(r.ProdukTglKeluarHasil),
		})
	}
	return out
}

func (h *DiversifikasiRMHandler) GetAllPaginated(c *gin.Context) {
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
		if _, ok := allowedStatusRM[status]; !ok {
			middleware.RespondError(c, http.StatusBadRequest, "VALIDATION_ERROR",
				"Nilai status tidak valid. Pilihan: Done, On Progress, Drop")
			return
		}
	}

	baseWhere, baseArgs := buildRMBaseWhere(search)
	fullWhere, fullArgs := buildRMFullWhere(search, status)

	ctx, cancel := newCtxRM(c)
	defer cancel()

	var total int
	countQuery := `SELECT COUNT(*) FROM diversifikasi_rm rm ` + fullWhere
	if err := h.DB.QueryRowContext(ctx, countQuery, fullArgs...).Scan(&total); err != nil {
		handleRMDBError(c, "GetAllPaginated.count", "-", err)
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

	dataQuery := fmt.Sprintf(`
		SELECT
			%s,
			%s
		FROM  diversifikasi_rm rm
		LEFT  JOIN diversifikasi_produk p ON p.diversifikasi_rm_id = rm.id
		%s
		GROUP BY rm.id
		ORDER BY rm.created_at DESC
		LIMIT  $%d OFFSET $%d`,
		selectColsRM, productAggRM, fullWhere, limitN, offsetN,
	)

	rows, err := h.DB.QueryContext(ctx, dataQuery, dataArgs...)
	if err != nil {
		handleRMDBError(c, "GetAllPaginated.data", "-", err)
		return
	}
	defer rows.Close()

	data := make([]models.DiversifikasiRMListItem, 0, limit)
	for rows.Next() {
		item, scanErr := scanRMListRow(rows)
		if scanErr != nil {
			handleRMDBError(c, "GetAllPaginated.scan", "-", scanErr)
			return
		}
		data = append(data, item)
	}
	if err := rows.Err(); err != nil {
		handleRMDBError(c, "GetAllPaginated.rows", "-", err)
		return
	}

	statusQuery := `SELECT status_project, COUNT(*) FROM diversifikasi_rm rm ` +
		baseWhere + ` GROUP BY status_project`

	statusRows, err := h.DB.QueryContext(ctx, statusQuery, baseArgs...)
	if err != nil {
		handleRMDBError(c, "GetAllPaginated.statusCount", "-", err)
		return
	}
	defer statusRows.Close()

	statusCounts := map[string]int{"Done": 0, "On Progress": 0, "Drop": 0}
	for statusRows.Next() {
		var s string
		var cnt int
		if err := statusRows.Scan(&s, &cnt); err != nil {
			log.Printf("[RM] traceID=%s statusCount.scan err=%v", middleware.TraceID(c), err)
			continue
		}
		if _, ok := allowedStatusRM[s]; ok {
			statusCounts[s] = cnt
		}
	}
	if err := statusRows.Err(); err != nil {
		handleRMDBError(c, "GetAllPaginated.statusRows", "-", err)
		return
	}

	c.JSON(http.StatusOK, DiversifikasiRMListResponse{
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

func (h *DiversifikasiRMHandler) generateNomorRM(month, year int) (string, error) {
	prefix := fmt.Sprintf("RM_%02d_%04d_", month, year)

	var maxNomor sql.NullString
	err := h.DB.QueryRow(`
		SELECT MAX(nomor_rm) FROM diversifikasi_rm
		WHERE  nomor_rm LIKE $1
		  AND  parent_id IS NULL`,
		prefix+"%",
	).Scan(&maxNomor)
	if err != nil {
		return "", err
	}

	nextNum := 1
	if maxNomor.Valid && len(maxNomor.String) > len(prefix) {
		suffix := maxNomor.String[len(prefix):]
		if n, err := strconv.Atoi(suffix); err == nil {
			nextNum = n + 1
		}
	}
	return fmt.Sprintf("%s%03d", prefix, nextNum), nil
}

const selectCols = `
	rm.id, rm.nomor_rm, rm.revision, rm.parent_id, rm.status_project,
	rm.tgl_kirim_cpro, rm.tgl_terima_ts, rm.kode_item, rm.nama_material,
	rm.manufacture, rm.no_batch_material,
	rm.rm_tgl_kirim_qc, rm.rm_tgl_keluar_hasil_analisa,
	rm.rm_fisik, rm.rm_kimia, rm.rm_mikrobiologi,
	rm.rm_sensori_material, rm.rm_cek_karakteristik, rm.rm_status,
	rm.perlu_analisa_andev, rm.andev_kimia, rm.andev_verifikasi_ma, rm.andev_status,
	rm.scale_up_kode_produk,
	rm.no_batch_scale_up, rm.scale_up_status, rm.tgl_dilakukan_scale_up,
	rm.scale_up_tgl_kirim_qc, rm.scale_up_tgl_keluar_hasil_analisa,
	rm.link_file_diversifikasi, rm.kesimpulan,
	rm.created_at, rm.updated_at, rm.created_by, rm.updated_by`

const productAgg = `
	COALESCE(
		json_agg(
			json_build_object(
				'id', p.id,
				'diversifikasiRmId', p.diversifikasi_rm_id,
				'kodeProduk', COALESCE(p.kode_produk, ''),
				'produkTglKirimQC', p.produk_tgl_kirim_qc,
				'produkTglKeluarHasil', p.produk_tgl_keluar_hasil,
				'produkFisik', COALESCE(p.produk_fisik, ''),
				'produkKimia', COALESCE(p.produk_kimia, ''),
				'produkMikrobiologi', COALESCE(p.produk_mikrobiologi, ''),
				'produkSensori', COALESCE(p.produk_sensori, ''),
				'produkCekKarakteristik', COALESCE(p.produk_cek_karakteristik, ''),
				'stabtestFisik', COALESCE(p.stabtest_fisik, ''),
				'stabtestKimia', COALESCE(p.stabtest_kimia, ''),
				'stabtestMikrobiologi', COALESCE(p.stabtest_mikrobiologi, ''),
				'stabtestSensoriDFCT', COALESCE(p.stabtest_sensori_dfct, ''),
				'stabtestStatus', COALESCE(p.stabtest_status, ''),
				'keterangan', COALESCE(p.keterangan, ''),
				'createdAt', p.created_at,
				'updatedAt', p.updated_at
			)
		) FILTER (WHERE p.id IS NOT NULL),
		'[]'
	) as products`

func scanRM(row interface{ Scan(...interface{}) error }) (models.DiversifikasiRMWithProducts, []byte, error) {
	var item models.DiversifikasiRMWithProducts
	var productsJSON []byte
	err := row.Scan(
		&item.ID, &item.NomorRM, &item.Revision, &item.ParentID, &item.StatusProject,
		&item.TglKirimCPro, &item.TglTerimaTS, &item.KodeItem,
		&item.NamaMaterial, &item.Manufacture, &item.NoBatchMaterial,
		&item.RmTglKirimQC, &item.RmTglKeluarHasilAnalisa,
		&item.RmFisik, &item.RmKimia, &item.RmMikrobiologi,
		&item.RmSensoriMaterial, &item.RmCekKarakteristik, &item.RmStatus,
		&item.PerluAnalisaAndev, &item.AndevKimia, &item.AndevVerifikasiMA, &item.AndevStatus,
		&item.ScaleUpKodeProduk,
		&item.NoBatchScaleUp, &item.ScaleUpStatus, &item.TglDilakukanScaleUp,
		&item.ScaleUpTglKirimQC, &item.ScaleUpTglKeluarHasilAnalisa,
		&item.LinkFileDiversifikasi, &item.Kesimpulan,
		&item.CreatedAt, &item.UpdatedAt, &item.CreatedBy, &item.UpdatedBy,
		&productsJSON,
	)
	return item, productsJSON, err
}

func (h *DiversifikasiRMHandler) GetAll(c *gin.Context) {
	query := fmt.Sprintf(`
		SELECT %s, %s
		FROM diversifikasi_rm rm
		LEFT JOIN diversifikasi_produk p ON p.diversifikasi_rm_id = rm.id
		WHERE rm.parent_id IS NULL AND rm.deleted_at IS NULL
		GROUP BY rm.id
		ORDER BY rm.created_at DESC`, selectCols, productAgg)

	rows, err := h.DB.Query(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	results := make([]models.DiversifikasiRMWithProducts, 0)
	for rows.Next() {
		item, productsJSON, err := scanRM(rows)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		item.Products = unmarshalProducts(productsJSON)
		item.Revisions = h.getRevisions(item.NomorRM, item.ID)
		results = append(results, item)
	}
	c.JSON(http.StatusOK, results)
}

func (h *DiversifikasiRMHandler) getRevisions(nomorRM string, excludeID int) []models.DiversifikasiRMWithProducts {
	revisions := make([]models.DiversifikasiRMWithProducts, 0)
	query := fmt.Sprintf(`
		SELECT %s, %s
		FROM diversifikasi_rm rm
		LEFT JOIN diversifikasi_produk p ON p.diversifikasi_rm_id = rm.id
		WHERE rm.nomor_rm = $1
		  AND rm.id != $2
		  AND rm.parent_id IS NOT NULL
		  AND rm.deleted_at IS NULL
		GROUP BY rm.id
		ORDER BY rm.created_at ASC`, selectCols, productAgg)

	rows, err := h.DB.Query(query, nomorRM, excludeID)
	if err != nil {
		return revisions
	}
	defer rows.Close()

	for rows.Next() {
		item, productsJSON, err := scanRM(rows)
		if err != nil {
			continue
		}
		item.Products = unmarshalProducts(productsJSON)
		item.Revisions = []models.DiversifikasiRMWithProducts{}
		revisions = append(revisions, item)
	}
	return revisions
}

func (h *DiversifikasiRMHandler) Create(c *gin.Context) {
	var req models.CreateDiversifikasiRMRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondError(c, http.StatusBadRequest, "VALIDATION_ERROR",
			"Format data tidak valid")
		return
	}

	if msg := validateRMFields(req.KodeItem, req.NamaMaterial, req.StatusProject); msg != "" {
		middleware.RespondError(c, http.StatusBadRequest, "VALIDATION_ERROR", msg)
		return
	}
	if msg := validateRMProducts(req.Products); msg != "" {
		middleware.RespondError(c, http.StatusBadRequest, "VALIDATION_ERROR", msg)
		return
	}

	now := time.Now()
	var nomorRM string
	var revision int

	if req.ParentID != nil {
		var existingNomor string
		var maxRevision int
		err := h.DB.QueryRow(
			`SELECT nomor_rm FROM diversifikasi_rm WHERE id = $1 AND deleted_at IS NULL`,
			req.ParentID,
		).Scan(&existingNomor)
		if errors.Is(err, sql.ErrNoRows) {
			middleware.RespondError(c, http.StatusBadRequest, "NOT_FOUND",
				"Data induk tidak ditemukan")
			return
		}
		if err != nil {
			middleware.RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR",
				"Terjadi kesalahan pada server")
			return
		}
		_ = h.DB.QueryRow(
			`SELECT COALESCE(MAX(revision), 0) FROM diversifikasi_rm WHERE nomor_rm = $1`,
			existingNomor,
		).Scan(&maxRevision)
		nomorRM = existingNomor
		revision = maxRevision + 1
	} else {
		var err error
		nomorRM, err = h.generateNomorRM(int(now.Month()), now.Year())
		if err != nil {
			middleware.RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR",
				"Gagal generate nomor RM")
			return
		}
		revision = 0
	}

	tx, err := h.DB.Begin()
	if err != nil {
		middleware.RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR",
			"Terjadi kesalahan pada server")
		return
	}
	defer tx.Rollback()

	var newID int
	err = tx.QueryRow(`
		INSERT INTO diversifikasi_rm (
			nomor_rm, revision, parent_id, status_project,
			tgl_kirim_cpro, tgl_terima_ts, kode_item, nama_material,
			manufacture, no_batch_material,
			rm_tgl_kirim_qc, rm_tgl_keluar_hasil_analisa,
			rm_fisik, rm_kimia, rm_mikrobiologi, rm_sensori_material,
			rm_cek_karakteristik, rm_status,
			perlu_analisa_andev, andev_kimia, andev_verifikasi_ma, andev_status,
			scale_up_kode_produk,
			no_batch_scale_up, scale_up_status, tgl_dilakukan_scale_up,
			scale_up_tgl_kirim_qc, scale_up_tgl_keluar_hasil_analisa,
			link_file_diversifikasi, kesimpulan, created_by
		) VALUES (
			$1,$2,NULL,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
			$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30
		) RETURNING id`,
		nomorRM, revision, req.StatusProject,
		req.TglKirimCPro, req.TglTerimaTS, req.KodeItem, req.NamaMaterial,
		req.Manufacture, req.NoBatchMaterial,
		req.RmTglKirimQC, req.RmTglKeluarHasilAnalisa,
		req.RmFisik, req.RmKimia, req.RmMikrobiologi, req.RmSensoriMaterial,
		req.RmCekKarakteristik, req.RmStatus,
		req.PerluAnalisaAndev, req.AndevKimia, req.AndevVerifikasiMA, req.AndevStatus,
		req.ScaleUpKodeProduk,
		req.NoBatchScaleUp, req.ScaleUpStatus, req.TglDilakukanScaleUp,
		req.ScaleUpTglKirimQC, req.ScaleUpTglKeluarHasilAnalisa,
		req.LinkFileDiversifikasi, req.Kesimpulan, req.CreatedBy,
	).Scan(&newID)
	if err != nil {
		middleware.RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR",
			"Gagal menyimpan data")
		return
	}

	if req.ParentID != nil {
		res, err := tx.Exec(
			`UPDATE diversifikasi_rm SET parent_id = $1 WHERE id = $2 AND parent_id IS NULL`,
			newID, req.ParentID,
		)
		if err != nil {
			middleware.RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR",
				"Gagal mengaitkan parent")
			return
		}
		if ra, _ := res.RowsAffected(); ra == 0 {
			middleware.RespondError(c, http.StatusConflict, "CONFLICT",
				"Parent sudah terhubung ke data lain")
			return
		}
	}

	for i, product := range req.Products {
		_, err := tx.Exec(`
			INSERT INTO diversifikasi_produk (
				diversifikasi_rm_id, kode_produk,
				produk_tgl_kirim_qc, produk_tgl_keluar_hasil,
				produk_fisik, produk_kimia, produk_mikrobiologi, produk_sensori,
				produk_cek_karakteristik,
				stabtest_fisik, stabtest_kimia, stabtest_mikrobiologi,
				stabtest_sensori_dfct, stabtest_status, keterangan
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
			newID, product.KodeProduk,
			product.ProdukTglKirimQC, product.ProdukTglKeluarHasil,
			product.ProdukFisik, product.ProdukKimia, product.ProdukMikrobiologi,
			product.ProdukSensori, product.ProdukCekKarakteristik,
			product.StabtestFisik, product.StabtestKimia, product.StabtestMikrobiologi,
			product.StabtestSensoriDFCT, product.StabtestStatus, product.Keterangan,
		)
		if err != nil {
			log.Printf("[RM] Create.insertProduct[%d] err=%v", i, err)
			middleware.RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR",
				"Gagal menyimpan produk")
			return
		}
	}

	if err := tx.Commit(); err != nil {
		middleware.RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR",
			"Gagal menyimpan data")
		return
	}

	LogActivity(h.DB, c.GetString("userName"), c.GetString("userDivision"),
		"create", "Diversifikasi RM", nomorRM, "Membuat data baru "+nomorRM)

	c.JSON(http.StatusCreated, gin.H{
		"id":      newID,
		"nomorRM": nomorRM,
		"message": "Berhasil dibuat",
	})
}

func (h *DiversifikasiRMHandler) Update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		middleware.RespondError(c, http.StatusBadRequest, "VALIDATION_ERROR", "ID tidak valid")
		return
	}

	var req models.UpdateDiversifikasiRMRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondError(c, http.StatusBadRequest, "VALIDATION_ERROR",
			"Format data tidak valid")
		return
	}

	if msg := validateRMFields(req.KodeItem, req.NamaMaterial, req.StatusProject); msg != "" {
		middleware.RespondError(c, http.StatusBadRequest, "VALIDATION_ERROR", msg)
		return
	}
	if msg := validateRMProducts(req.Products); msg != "" {
		middleware.RespondError(c, http.StatusBadRequest, "VALIDATION_ERROR", msg)
		return
	}

	var old struct {
		nomorRM, status, kodeItem, namaMaterial, manufacture,
		noBatch, rmFisik, rmKimia, rmMikro, rmSensori,
		rmCek, rmStatus, perluAndev, andevKimia, andevVerif,
		andevStatus, scaleUpKode, noBatchSU, scaleUpStatus,
		linkFile, kesimpulan string
	}
	err = h.DB.QueryRow(`
		SELECT nomor_rm,
		       COALESCE(status_project,''),     COALESCE(kode_item,''),
		       COALESCE(nama_material,''),       COALESCE(manufacture,''),
		       COALESCE(no_batch_material,''),
		       COALESCE(rm_fisik,''),            COALESCE(rm_kimia,''),
		       COALESCE(rm_mikrobiologi,''),     COALESCE(rm_sensori_material,''),
		       COALESCE(rm_cek_karakteristik,''),COALESCE(rm_status,''),
		       COALESCE(perlu_analisa_andev,''), COALESCE(andev_kimia,''),
		       COALESCE(andev_verifikasi_ma,''), COALESCE(andev_status,''),
		       COALESCE(scale_up_kode_produk,''),COALESCE(no_batch_scale_up,''),
		       COALESCE(scale_up_status,''),
		       COALESCE(link_file_diversifikasi,''), COALESCE(kesimpulan,'')
		FROM   diversifikasi_rm
		WHERE  id = $1 AND deleted_at IS NULL`, id,
	).Scan(
		&old.nomorRM, &old.status, &old.kodeItem, &old.namaMaterial, &old.manufacture,
		&old.noBatch, &old.rmFisik, &old.rmKimia, &old.rmMikro, &old.rmSensori,
		&old.rmCek, &old.rmStatus, &old.perluAndev, &old.andevKimia, &old.andevVerif,
		&old.andevStatus, &old.scaleUpKode, &old.noBatchSU, &old.scaleUpStatus,
		&old.linkFile, &old.kesimpulan,
	)
	if errors.Is(err, sql.ErrNoRows) {
		middleware.RespondError(c, http.StatusNotFound, "NOT_FOUND", "Data tidak ditemukan")
		return
	}
	if err != nil {
		middleware.RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR",
			"Terjadi kesalahan pada server")
		return
	}

	tx, err := h.DB.Begin()
	if err != nil {
		middleware.RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR",
			"Terjadi kesalahan pada server")
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
		UPDATE diversifikasi_rm SET
			status_project=$1,
			tgl_kirim_cpro=$2, tgl_terima_ts=$3, kode_item=$4,
			nama_material=$5, manufacture=$6, no_batch_material=$7,
			rm_tgl_kirim_qc=$8, rm_tgl_keluar_hasil_analisa=$9,
			rm_fisik=$10, rm_kimia=$11, rm_mikrobiologi=$12,
			rm_sensori_material=$13, rm_cek_karakteristik=$14, rm_status=$15,
			perlu_analisa_andev=$16, andev_kimia=$17, andev_verifikasi_ma=$18, andev_status=$19,
			scale_up_kode_produk=$20,
			no_batch_scale_up=$21, scale_up_status=$22, tgl_dilakukan_scale_up=$23,
			scale_up_tgl_kirim_qc=$24, scale_up_tgl_keluar_hasil_analisa=$25,
			link_file_diversifikasi=$26, kesimpulan=$27,
			updated_by=$28, updated_at=CURRENT_TIMESTAMP
		WHERE id=$29 AND deleted_at IS NULL`,
		req.StatusProject,
		req.TglKirimCPro, req.TglTerimaTS, req.KodeItem,
		req.NamaMaterial, req.Manufacture, req.NoBatchMaterial,
		req.RmTglKirimQC, req.RmTglKeluarHasilAnalisa,
		req.RmFisik, req.RmKimia, req.RmMikrobiologi,
		req.RmSensoriMaterial, req.RmCekKarakteristik, req.RmStatus,
		req.PerluAnalisaAndev, req.AndevKimia, req.AndevVerifikasiMA, req.AndevStatus,
		req.ScaleUpKodeProduk,
		req.NoBatchScaleUp, req.ScaleUpStatus, req.TglDilakukanScaleUp,
		req.ScaleUpTglKirimQC, req.ScaleUpTglKeluarHasilAnalisa,
		req.LinkFileDiversifikasi, req.Kesimpulan,
		req.UpdatedBy, id,
	)
	if err != nil {
		middleware.RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR",
			"Gagal memperbarui data")
		return
	}
	if ra, _ := res.RowsAffected(); ra == 0 {
		middleware.RespondError(c, http.StatusNotFound, "NOT_FOUND", "Data tidak ditemukan")
		return
	}

	if _, err := tx.Exec(
		`DELETE FROM diversifikasi_produk WHERE diversifikasi_rm_id = $1`, id,
	); err != nil {
		middleware.RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR",
			"Gagal memperbarui produk")
		return
	}

	for i, product := range req.Products {
		_, err := tx.Exec(`
			INSERT INTO diversifikasi_produk (
				diversifikasi_rm_id, kode_produk,
				produk_tgl_kirim_qc, produk_tgl_keluar_hasil,
				produk_fisik, produk_kimia, produk_mikrobiologi, produk_sensori,
				produk_cek_karakteristik,
				stabtest_fisik, stabtest_kimia, stabtest_mikrobiologi,
				stabtest_sensori_dfct, stabtest_status, keterangan
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
			id, product.KodeProduk,
			product.ProdukTglKirimQC, product.ProdukTglKeluarHasil,
			product.ProdukFisik, product.ProdukKimia, product.ProdukMikrobiologi,
			product.ProdukSensori, product.ProdukCekKarakteristik,
			product.StabtestFisik, product.StabtestKimia, product.StabtestMikrobiologi,
			product.StabtestSensoriDFCT, product.StabtestStatus, product.Keterangan,
		)
		if err != nil {
			log.Printf("[RM] Update.insertProduct[%d] err=%v", i, err)
			middleware.RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR",
				"Gagal menyimpan produk")
			return
		}
	}

	if err := tx.Commit(); err != nil {
		middleware.RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR",
			"Gagal menyimpan perubahan")
		return
	}

	oldMap := rmToMap(
		old.status, "", "", old.kodeItem, old.namaMaterial, old.manufacture, old.noBatch,
		"", "", old.rmFisik, old.rmKimia, old.rmMikro, old.rmSensori, old.rmCek, old.rmStatus,
		old.perluAndev, old.andevKimia, old.andevVerif, old.andevStatus,
		old.scaleUpKode, old.noBatchSU, old.scaleUpStatus, "", "", "",
		old.linkFile, old.kesimpulan,
	)
	newMap := rmToMap(
		req.StatusProject, "", "", req.KodeItem, req.NamaMaterial, req.Manufacture,
		req.NoBatchMaterial, "", "", req.RmFisik, req.RmKimia, req.RmMikrobiologi,
		req.RmSensoriMaterial, req.RmCekKarakteristik, req.RmStatus,
		req.PerluAnalisaAndev, req.AndevKimia, req.AndevVerifikasiMA, req.AndevStatus,
		req.ScaleUpKodeProduk, req.NoBatchScaleUp, req.ScaleUpStatus, "", "", "",
		req.LinkFileDiversifikasi, req.Kesimpulan,
	)
	summary, diffDetail := BuildDiff(oldMap, newMap)
	if summary == "" {
		summary = "(tidak ada perubahan)"
	}
	LogActivity(h.DB, c.GetString("userName"), c.GetString("userDivision"),
		"update", "Diversifikasi RM", old.nomorRM, "Update: "+summary+"||"+diffDetail)

	c.JSON(http.StatusOK, gin.H{"message": "Berhasil diperbarui"})
}

func (h *DiversifikasiRMHandler) Delete(c *gin.Context) {
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

	var nomorRM string
	ctx, cancel := newCtxRM(c)
	defer cancel()

	err = h.DB.QueryRowContext(ctx,
		`SELECT nomor_rm FROM diversifikasi_rm WHERE id = $1 AND deleted_at IS NULL`, id,
	).Scan(&nomorRM)
	if errors.Is(err, sql.ErrNoRows) {
		middleware.RespondError(c, http.StatusNotFound, "NOT_FOUND", "Data tidak ditemukan")
		return
	}
	if err != nil {
		middleware.RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR",
			"Terjadi kesalahan pada server")
		return
	}

	res, err := h.DB.ExecContext(ctx, `
		UPDATE diversifikasi_rm
		SET    deleted_at = NOW(), deleted_by = $1
		WHERE  nomor_rm   = $2
		  AND  deleted_at IS NULL`,
		deletedBy, nomorRM,
	)
	if err != nil {
		middleware.RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR",
			"Gagal menghapus data")
		return
	}
	if ra, _ := res.RowsAffected(); ra == 0 {
		middleware.RespondError(c, http.StatusNotFound, "NOT_FOUND", "Data tidak ditemukan")
		return
	}

	LogActivity(h.DB, c.GetString("userName"), c.GetString("userDivision"),
		"delete", "Diversifikasi RM", nomorRM, "Menghapus ke Recycle Bin")

	c.JSON(http.StatusOK, gin.H{"message": "Berhasil dihapus"})
}

func unmarshalProducts(data []byte) []models.DiversifikasiProduk {
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
		if v, ok := r["diversifikasiRmId"].(float64); ok {
			p.DiversifikasiRMID = int(v)
		}
		if v, ok := r["kodeProduk"].(string); ok {
			p.KodeProduk = v
		}
		if v, ok := r["produkFisik"].(string); ok {
			p.ProdukFisik = v
		}
		if v, ok := r["produkKimia"].(string); ok {
			p.ProdukKimia = v
		}
		if v, ok := r["produkMikrobiologi"].(string); ok {
			p.ProdukMikrobiologi = v
		}
		if v, ok := r["produkSensori"].(string); ok {
			p.ProdukSensori = v
		}
		if v, ok := r["produkCekKarakteristik"].(string); ok {
			p.ProdukCekKarakteristik = v
		}
		if v, ok := r["stabtestFisik"].(string); ok {
			p.StabtestFisik = v
		}
		if v, ok := r["stabtestKimia"].(string); ok {
			p.StabtestKimia = v
		}
		if v, ok := r["stabtestMikrobiologi"].(string); ok {
			p.StabtestMikrobiologi = v
		}
		if v, ok := r["stabtestSensoriDFCT"].(string); ok {
			p.StabtestSensoriDFCT = v
		}
		if v, ok := r["stabtestStatus"].(string); ok {
			p.StabtestStatus = v
		}
		if v, ok := r["keterangan"].(string); ok {
			p.Keterangan = v
		}

		parseDateField := func(key string) *time.Time {
			v, ok := r[key].(string)
			if !ok || v == "" {
				return nil
			}
			for _, layout := range []string{time.RFC3339, "2006-01-02T15:04:05", "2006-01-02 15:04:05", "2006-01-02"} {
				if t, err := time.Parse(layout, v); err == nil {
					return &t
				}
			}
			return nil
		}
		p.ProdukTglKirimQC = parseDateField("produkTglKirimQC")
		p.ProdukTglKeluarHasil = parseDateField("produkTglKeluarHasil")
		products = append(products, p)
	}
	return products
}
