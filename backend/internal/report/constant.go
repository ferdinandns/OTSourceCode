package report

const GET_SARPRAS_REPORT = `
    SELECT
        s.id,
        sch.id                AS schedule_id,
        i.id                  AS inspection_id,
        st.name               AS jenis_sarpras,
        s.code                AS nomor_sarpras,
        d.name                AS department,
        site.code             AS site,
        sch.status            AS schedule_status,
        sch.due_date          AS scheduled_date,

        -- Status sarpras saat inspeksi dijadwalkan/dilakukan (historical)
        COALESCE(sch.sarpras_status_snapshot, s.status::VARCHAR) AS sarpras_status,

        COALESCE(u.name, '-') AS nama_pemeriksa,
        i.inspected_at        AS tanggal_diperiksa,

        CASE
            WHEN i.id IS NULL THEN ''
            ELSE COALESCE(rs.action_plan, '')
        END AS action_plan,

        -- Alasan NOK berdasarkan hasil inspeksi saat itu
        CASE
            WHEN i.id IS NULL THEN 'Belum Diperiksa'
            ELSE COALESCE(nok.nok_names, '')
        END AS nok_names

    FROM inspection_schedules sch
    JOIN sarpras s        ON s.id    = sch.sarpras_id
    JOIN sarpras_types st ON st.id   = s.sarpras_type_id
    JOIN departments d    ON d.id    = s.location_dept_id
    JOIN sites site       ON site.id = d.site_id
    LEFT JOIN inspections i         ON i.schedule_id    = sch.id
    LEFT JOIN users u               ON u.id             = i.checker_id
    LEFT JOIN repair_orders ro      ON ro.inspection_id = i.id
    LEFT JOIN repair_submissions rs ON rs.id            = ro.active_submission_id
    LEFT JOIN (
        SELECT
            ii.inspection_id,
            string_agg(
                p.name || ' (' || COALESCE(ii.notes, 'Tanpa Catatan') || ')',
                ' || '
            ) AS nok_names
        FROM inspection_items ii
        JOIN parameters p ON p.id = ii.parameter_id
        WHERE ii.status = 'NOK'
        GROUP BY ii.inspection_id
    ) nok ON nok.inspection_id = i.id
    WHERE 1=1
`

const DEPT_ID = ` AND d.id = $%d`

const SARPRAS_STATUS = `
    AND COALESCE(sch.sarpras_status_snapshot, s.status::VARCHAR) = $%d
`

const SCHEDULE_STATUS = ` AND sch.status = $%d`

const START_TO = `
    AND i.inspected_at >= $%d
    AND i.inspected_at <= $%d
`

const ORDER = `
    ORDER BY
        CASE sch.status
            WHEN 'pending'     THEN 0
            WHEN 'overdue'     THEN 1
            WHEN 'in_progress' THEN 2
            WHEN 'done'        THEN 3
        END ASC,
        i.inspected_at DESC NULLS LAST
`