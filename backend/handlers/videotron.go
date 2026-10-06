package handlers

import (
	"context"
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type VideotronHandler struct {
	db *sql.DB
}

func NewVideotronHandler(db *sql.DB) *VideotronHandler {
	return &VideotronHandler{db: db}
}

type VideotronResponse struct {
	GeneratedAt time.Time          `json:"generatedAt"`
	RM          VideotronSection   `json:"rm"`
	PM          VideotronSection   `json:"pm"`
}

type VideotronSection struct {
	TotalDivers    int                `json:"totalDivers"`
	Analisa        VideotronStat      `json:"analisa"`
	StatusLabscale VideotronStat      `json:"statusLabscale"`
	StatusTrial    VideotronStat      `json:"statusTrial"`
	Rows           []VideotronRow     `json:"rows"`
}

type VideotronStat struct {
	Released int `json:"released"`
	Total    int `json:"total"`
}

type VideotronRow struct {
	ID            int    `json:"id"`
	Nomor         string `json:"nomor"`
	NamaMaterial  string `json:"namaMaterial"`
	Manufacture   string `json:"manufacture"`
	NoBatch       string `json:"noBatch"`
	StatusProject string `json:"statusProject"`
	Hasil         string `json:"hasil"`
	UpdatedAt     string `json:"updatedAt"`
}

func (h *VideotronHandler) GetVideotron(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	resp := VideotronResponse{
		GeneratedAt: time.Now(),
		RM:          h.fetchRMSection(ctx),
		PM:          h.fetchPMSection(ctx),
	}

	c.JSON(http.StatusOK, resp)
}

func (h *VideotronHandler) fetchRMSection(ctx context.Context) VideotronSection {
	section := VideotronSection{}

	// Stats
	_ = h.db.QueryRowContext(ctx, `
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE rm_status = 'Release')
		FROM diversifikasi_rm
		WHERE deleted_at IS NULL AND parent_id IS NULL
	`).Scan(&section.TotalDivers, &section.Analisa.Released)
	section.Analisa.Total = section.TotalDivers

	// Scale up stats
	_ = h.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FILTER (WHERE scale_up_status = 'Release')
		FROM diversifikasi_rm
		WHERE deleted_at IS NULL AND parent_id IS NULL
	`).Scan(&section.StatusTrial.Released)
	section.StatusTrial.Total = section.TotalDivers

	// Labscale stats
	_ = h.db.QueryRowContext(ctx, `
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE stabtest_status = 'Release')
		FROM diversifikasi_produk p
		JOIN diversifikasi_rm rm ON rm.id = p.diversifikasi_rm_id
		WHERE rm.deleted_at IS NULL AND rm.parent_id IS NULL
	`).Scan(&section.StatusLabscale.Total, &section.StatusLabscale.Released)

	// Rows
	rows, err := h.db.QueryContext(ctx, `
		SELECT id, nomor_rm, nama_material, manufacture, no_batch_material,
		       status_project, COALESCE(rm_status, ''), updated_at
		FROM diversifikasi_rm
		WHERE deleted_at IS NULL AND parent_id IS NULL
		ORDER BY updated_at DESC
		LIMIT 100
	`)
	if err != nil {
		section.Rows = []VideotronRow{}
		return section
	}
	defer rows.Close()

	section.Rows = h.scanRows(rows)
	return section
}

func (h *VideotronHandler) fetchPMSection(ctx context.Context) VideotronSection {
	section := VideotronSection{}

	_ = h.db.QueryRowContext(ctx, `
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE pm_hasil_analisa = 'Release')
		FROM diversifikasi_pm
		WHERE deleted_at IS NULL AND parent_id IS NULL
	`).Scan(&section.TotalDivers, &section.Analisa.Released)
	section.Analisa.Total = section.TotalDivers

	_ = h.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FILTER (WHERE trial_hasil_final = 'MS')
		FROM diversifikasi_pm
		WHERE deleted_at IS NULL AND parent_id IS NULL
	`).Scan(&section.StatusTrial.Released)
	section.StatusTrial.Total = section.TotalDivers

	section.StatusLabscale = section.Analisa

	rows, err := h.db.QueryContext(ctx, `
		SELECT id, nomor_pm, nama_material, manufacture, no_batch_material,
		       status_project, COALESCE(pm_hasil_analisa, ''), updated_at
		FROM diversifikasi_pm
		WHERE deleted_at IS NULL AND parent_id IS NULL
		ORDER BY updated_at DESC
		LIMIT 100
	`)
	if err != nil {
		section.Rows = []VideotronRow{}
		return section
	}
	defer rows.Close()

	section.Rows = h.scanRows(rows)
	return section
}

func (h *VideotronHandler) scanRows(rows *sql.Rows) []VideotronRow {
	out := []VideotronRow{}
	for rows.Next() {
		var r VideotronRow
		var updatedAt sql.NullTime
		if err := rows.Scan(
			&r.ID, &r.Nomor, &r.NamaMaterial, &r.Manufacture, &r.NoBatch,
			&r.StatusProject, &r.Hasil, &updatedAt,
		); err != nil {
			continue
		}
		if updatedAt.Valid {
			r.UpdatedAt = updatedAt.Time.Format(time.RFC3339)
		}
		out = append(out, r)
	}
	return out
}