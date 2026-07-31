package refill

const (
	querySummaryCounts = `
		SELECT
			COALESCE(COUNT(*), 0) AS total,
			COALESCE(SUM(CASE 
				WHEN st.expired_date IS NULL OR st.expired_date < NOW()::date THEN 1 
				ELSE 0 
			END), 0) AS total_expired,
			COALESCE(SUM(CASE 
				WHEN st.expired_date IS NOT NULL AND st.expired_date >= NOW()::date THEN 1 
				ELSE 0 
			END), 0) AS total_active
		FROM sarpras st
		JOIN sarpras_types stt ON stt.id = st.sarpras_type_id
	`

	queryAparListBase = `
		SELECT
			st.id,
			stt.name,
			st.code,
			d.name,
			COALESCE(st.expired_date, '1900-01-01') AS expired_date,
			CASE 
				WHEN st.expired_date IS NULL THEN 'expired'
				WHEN st.expired_date < NOW()::date THEN 'expired' 
				ELSE 'active' 
			END AS ed_status,
			CASE
				WHEN roi.id IS NULL AND st.expired_date <= NOW() + INTERVAL '2 months' THEN 'Opened'
				WHEN roi.status = 'waiting_evidence' THEN 'On Progress'
				WHEN roi.status = 'waiting_review'   THEN 'Waiting Review'
				WHEN roi.status = 'approved'         THEN 'Done'
				WHEN roi.status = 'rejected'         THEN 'Rejected'
				ELSE '-'
			END AS progress_refill,
			ro.due_date,
			ro.po_number,
			roi.id,
			roi.status
		FROM sarpras st
		JOIN sarpras_types stt ON stt.id = st.sarpras_type_id
		JOIN departments d ON d.id = st.location_dept_id
		LEFT JOIN LATERAL (
			SELECT roi2.*
			FROM refill_order_items roi2
			WHERE roi2.sarpras_id = st.id
			AND roi2.status <> 'approved'
			ORDER BY roi2.created_at DESC
			LIMIT 1
		) roi ON true
		LEFT JOIN refill_orders ro ON ro.id = roi.refill_order_id
	`

	queryAparListOrderBy = `
		ORDER BY
			CASE WHEN st.expired_date < NOW()::date THEN 0 ELSE 1 END,
			st.expired_date ASC
	`

	queryAparDetail = `
		SELECT
			st.id,
			stt.name AS sarpras_type,
			st.code AS sarpras_no,
			d.name,
			st.expired_date,
			CASE WHEN st.expired_date < NOW()::date THEN 'expired' ELSE 'active' END AS ed_status,
			COALESCE(
				CASE roi.status
					WHEN 'waiting_evidence' THEN 'On Progress'
					WHEN 'waiting_review'   THEN 'Waiting Review'
					WHEN 'approved'         THEN 'Done'
					WHEN 'rejected'         THEN 'Rejected'
					ELSE '-'
				END,
				'-'
			) AS progress_refill,
			ro.due_date,
			ro.po_number,
			roi.id AS item_id,
			roi.status AS item_status
		FROM sarpras st
		JOIN sarpras_types stt ON stt.id = st.sarpras_type_id
		JOIN departments d ON d.id = st.location_dept_id
		LEFT JOIN LATERAL (
			SELECT roi2.*
			FROM refill_order_items roi2
			WHERE roi2.sarpras_id = st.id
			  AND roi2.status <> 'approved'
			ORDER BY roi2.created_at DESC
			LIMIT 1
		) roi ON true
		LEFT JOIN refill_orders ro ON ro.id = roi.refill_order_id
		WHERE st.id = $1
		  AND stt.is_apar = true
	`

	// queryAparsExpiringOrExpired returns APAR/APAB units that are ALREADY
	// expired OR will expire within the given number of days, and that don't
	// already have an active (non-final) refill item running for them.
	//
	// NOTE: the previous version of this query used `BETWEEN NOW() AND
	// NOW()+N days`, which silently excluded anything already past its
	// expired_date. That's why already-expired APAR never triggered a
	// reminder before.
	queryAparsExpiringOrExpired = `
		SELECT st.id, st.code, st.expired_date
		FROM sarpras st
		JOIN sarpras_types stt ON stt.id = st.sarpras_type_id
		WHERE stt.is_apar = true
		  AND st.expired_date <= (NOW()::date + ($1 * INTERVAL '1 day'))
		  AND NOT EXISTS (
			  SELECT 1
			  FROM refill_order_items roi
			  WHERE roi.sarpras_id = st.id
				AND roi.status NOT IN ('approved', 'rejected')
		  )
	`

	// queryRefillPendingVerification returns refill items still sitting in
	// waiting_review for at least the given number of days. Used to remind
	// QS periodically instead of relying only on the one-time notification
	// sent right when evidence was submitted.
	queryRefillPendingVerification = `
		SELECT roi.id, st.code, roi.evidence_at
		FROM refill_order_items roi
		JOIN sarpras st ON st.id = roi.sarpras_id
		WHERE roi.status = 'waiting_review'
		  AND roi.evidence_at IS NOT NULL
		  AND roi.evidence_at <= (NOW() - ($1 * INTERVAL '1 day'))
	`

	queryVerifyDetail = `
		SELECT 
			roi.id, roi.sarpras_id, stt.name AS sarpras_type, st.code AS sarpras_no,
			d.name AS department_name, st.expired_date,
			roi.new_expire_date, roi.evidence_path, roi.update_reason,
			u.name AS evidence_by, roi.evidence_at,
			ro.po_number, ro.due_date
		FROM refill_order_items roi
		JOIN sarpras st ON st.id = roi.sarpras_id
		JOIN sarpras_types stt ON stt.id = st.sarpras_type_id
		JOIN departments d ON d.id = st.location_dept_id
		LEFT JOIN refill_orders ro ON ro.id = roi.refill_order_id
		LEFT JOIN users u ON u.id = roi.evidence_by
		WHERE st.id = $1 AND roi.status = 'waiting_review'
	`

	queryValidateSarprasForRefill = `
		SELECT st.id
		FROM sarpras st
		JOIN sarpras_types stt ON stt.id = st.sarpras_type_id
		WHERE st.id = ANY($1)
		AND stt.is_apar = true
		AND st.expired_date IS NOT NULL
		AND (
			st.expired_date <= NOW()::date
			OR 
			st.expired_date - INTERVAL '2 months' <= NOW()::date
		)
		AND NOT EXISTS (
			SELECT 1
			FROM refill_order_items roi
			WHERE roi.sarpras_id = st.id
				AND roi.status NOT IN ('approved', 'rejected')
		)
	`

	queryValidateSarprasForMarkUsed = `
		SELECT st.id
		FROM sarpras st
		JOIN sarpras_types stt ON stt.id = st.sarpras_type_id
		WHERE st.id = ANY($1)
		AND stt.is_apar = true
		AND st.status NOT IN ('not_ready')
		AND NOT EXISTS (
			SELECT 1
			FROM refill_order_items roi
			WHERE roi.sarpras_id = st.id
				AND roi.status NOT IN ('approved', 'rejected')
		)
	`

	queryEmailsByDepartment = `
		SELECT u.email
		FROM users u
		JOIN departments d ON d.id = u.department_id
		WHERE d.name = $1
		  AND u.email IS NOT NULL
		  AND u.email != ''
	`

	queryEmailsByRole = `
		SELECT u.email
		FROM users u
		JOIN user_roles ur ON ur.user_id = u.id
		WHERE ur.role = $1
		  AND u.email IS NOT NULL
		  AND u.email != ''
	`

	RefillPOReminderApproaching = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#1e293b;background:#f4f7f9;">
      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
        <tr><td align="center">
          <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr><td style="background:#d97706;padding:22px 32px;">
              <h2 style="margin:0;color:#ffffff;font-size:19px;font-weight:800;letter-spacing:0.04em;">EMERTRACK</h2>
              <p style="margin:5px 0 0;color:#fde68a;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">Refill PO Reminder</p>
            </td></tr>
            <tr><td style="padding:32px;">
              <h3 style="margin:0 0 16px;font-size:17px;font-weight:700;color:#0f172a;">Batas Waktu PO Refill Akan Segera Habis</h3>
              <p style="margin:0 0 20px;line-height:1.6;color:#334155;">Bukti refill untuk sarpras berikut belum diunggah, dan batas waktu PO akan habis dalam <strong>%d hari</strong>. Mohon segera unggah bukti refill.</p>
              <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
                <tr><td style="padding:16px 18px;">
                  <table style="width:100%%;border-collapse:collapse;font-size:13px;">
                    <tr><td style="padding:6px 0;color:#64748b;width:140px;vertical-align:top;">Jenis Sarpras</td><td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td></tr>
                    <tr><td style="padding:6px 0;color:#64748b;vertical-align:top;">Nomor Sarpras</td><td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td></tr>
                    <tr><td style="padding:6px 0;color:#64748b;vertical-align:top;">Nomor PO</td><td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td></tr>
                    <tr><td style="padding:6px 0;color:#64748b;vertical-align:top;">Batas Waktu PO</td><td style="padding:6px 0;color:#b45309;font-weight:700;">%s</td></tr>
                  </table>
                </td></tr>
              </table>
              <div style="text-align:center;margin-top:28px;">
                <a href="%s" style="display:inline-block;background:#d97706;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:13px;">Unggah Bukti Refill</a>
              </div>
            </td></tr>
            <tr><td style="background:#eef4fa;padding:18px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#003d7a;">EMERTRACK</p>
              <p style="margin:0;font-size:11px;line-height:1.6;color:#64748b;">Email ini dikirim secara otomatis oleh sistem EMERTRACK. Mohon tidak membalas email ini secara langsung.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>`

    RefillPOReminderOverdue = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#1e293b;background:#f4f7f9;">
      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
        <tr><td align="center">
          <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr><td style="background:#dc2626;padding:22px 32px;">
              <h2 style="margin:0;color:#ffffff;font-size:19px;font-weight:800;letter-spacing:0.04em;">EMERTRACK</h2>
              <p style="margin:5px 0 0;color:#fecaca;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">Refill PO Overdue</p>
            </td></tr>
            <tr><td style="padding:32px;">
              <h3 style="margin:0 0 16px;font-size:17px;font-weight:700;color:#0f172a;">Batas Waktu PO Refill Telah Terlewat</h3>
              <p style="margin:0 0 20px;line-height:1.6;color:#334155;">Bukti refill untuk sarpras berikut <strong>belum diunggah</strong> dan batas waktu PO sudah terlewat. Mohon segera selesaikan proses refill dan unggah bukti.</p>
              <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
                <tr><td style="padding:16px 18px;">
                  <table style="width:100%%;border-collapse:collapse;font-size:13px;">
                    <tr><td style="padding:6px 0;color:#64748b;width:140px;vertical-align:top;">Jenis Sarpras</td><td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td></tr>
                    <tr><td style="padding:6px 0;color:#64748b;vertical-align:top;">Nomor Sarpras</td><td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td></tr>
                    <tr><td style="padding:6px 0;color:#64748b;vertical-align:top;">Nomor PO</td><td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td></tr>
                    <tr><td style="padding:6px 0;color:#64748b;vertical-align:top;">Batas Waktu PO</td><td style="padding:6px 0;color:#dc2626;font-weight:700;">%s</td></tr>
                    <tr><td style="padding:6px 0;color:#64748b;vertical-align:top;">Status</td><td style="padding:6px 0;color:#dc2626;font-weight:700;">OVERDUE</td></tr>
                  </table>
                </td></tr>
              </table>
              <div style="text-align:center;margin-top:28px;">
                <a href="%s" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:13px;">Unggah Bukti Refill</a>
              </div>
            </td></tr>
            <tr><td style="background:#eef4fa;padding:18px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#003d7a;">EMERTRACK</p>
              <p style="margin:0;font-size:11px;line-height:1.6;color:#64748b;">Email ini dikirim secara otomatis oleh sistem EMERTRACK. Mohon tidak membalas email ini secara langsung.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>`
)
