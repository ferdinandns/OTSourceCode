package repair

// LIST_ALL with LEFT JOIN to active submission for action_plan & due_date
const LIST_ALL = `
	SELECT
		ro.id,
		s.id,
		s.code,
		st.name,
		d.name,
		u_checker.name,
		i.inspected_at,
		COALESCE(rs.action_plan, ''),
		rs.due_date,
		COALESCE(u_pic.name, ''),
		s.status,
		ro.status,
		ro.updated_at
	FROM repair_orders ro
	JOIN sarpras s ON s.id = ro.sarpras_id
	JOIN sarpras_types st ON st.id = s.sarpras_type_id
	JOIN departments d ON d.id = s.location_dept_id
	JOIN inspections i ON i.id = ro.inspection_id
	JOIN users u_checker ON u_checker.id = i.checker_id
	LEFT JOIN users u_pic ON u_pic.id = ro.pic_id
	LEFT JOIN repair_submissions rs ON rs.id = ro.active_submission_id
	%s
	ORDER BY ro.created_at DESC
	LIMIT $%d OFFSET $%d`

const COUNT_LIST = `
	SELECT COUNT(*)
	FROM repair_orders ro
	JOIN sarpras s ON s.id = ro.sarpras_id
	JOIN sarpras_types st ON st.id = s.sarpras_type_id
	%s`

// GET_DETAIL_BASE (tanpa submissions)
const GET_DETAIL_BASE = `
	SELECT
		ro.id,
		u.name AS pic_name,
		s.code,
		st.name,
		d.name,
		COALESCE(i.inspected_at, ro.created_at),
		ro.status,
		COALESCE(latest_rev.feedback, '') AS reviewer_feedback,
		COALESCE(u_rev.name, '') AS reviewer_name,
		COALESCE(i.id, 0)
	FROM repair_orders ro
	JOIN sarpras s ON s.id = ro.sarpras_id
	JOIN sarpras_types st ON st.id = s.sarpras_type_id
	JOIN departments d ON d.id = s.location_dept_id
	LEFT JOIN inspections i ON i.id = ro.inspection_id
	LEFT JOIN users u ON u.id = ro.pic_id
	LEFT JOIN users u_rev ON u_rev.id = ro.reviewer_id
	LEFT JOIN LATERAL (
		SELECT feedback, reviewer_id, reviewed_at
		FROM review_orders
		WHERE repair_order_id = ro.id
		ORDER BY reviewed_at DESC
		LIMIT 1
	) latest_rev ON true
	WHERE ro.id = $1`

const EVIDENCE_PATH_BY_SUBMISSION = `SELECT file_path FROM repair_evidences WHERE submission_id = $1 ORDER BY uploaded_at`

// GET_NOK_PARAM excludes the expiry (ED / Masa Berlaku) parameter: it is
// handled via a separate GA refill notification flow, not by the repair PIC,
// so it should never appear in the repair order's "Parameter NOK" list.
const GET_NOK_PARAM = `
	SELECT p.name
	FROM inspection_items ii
	JOIN parameters p ON p.id = ii.parameter_id
	JOIN inspections insp ON insp.id = ii.inspection_id
	JOIN repair_orders ro ON ro.inspection_id = insp.id
	JOIN sarpras s ON s.id = ro.sarpras_id
	JOIN sarpras_types st ON st.id = s.sarpras_type_id
	WHERE ro.id = $1 AND ii.status = 'NOK'
	  AND (st.expiry_param_id IS NULL OR p.id <> st.expiry_param_id)
	ORDER BY p.order_no`

// GET_NOK_ITEMS excludes the expiry (ED / Masa Berlaku) parameter for the
// same reason as GET_NOK_PARAM above.
const GET_NOK_ITEMS = `
	SELECT p.name, ii.notes, ii.photo_path
	FROM inspection_items ii
	JOIN parameters p ON p.id = ii.parameter_id
	JOIN inspections insp ON insp.id = ii.inspection_id
	JOIN sarpras s ON s.id = insp.sarpras_id
	JOIN sarpras_types st ON st.id = s.sarpras_type_id
	WHERE ii.inspection_id = $1 AND ii.status = 'NOK'
	  AND (st.expiry_param_id IS NULL OR p.id <> st.expiry_param_id)
	ORDER BY p.order_no`

const LIST_PIC_HISTORY = `
	SELECT
		ro.id,
		s.id,
		s.code,
		st.name,
		d.name,
		'' AS checker_name,
		NULL AS inspected_at,
		COALESCE(rs.action_plan, ''),
		rs.due_date,
		COALESCE(u_pic.name, ''),
		s.status,
		ro.status,
		ro.updated_at
	FROM repair_orders ro
	JOIN sarpras s ON s.id = ro.sarpras_id
	JOIN sarpras_types st ON st.id = s.sarpras_type_id
	JOIN departments d ON d.id = s.location_dept_id
	LEFT JOIN users u_pic ON u_pic.id = ro.pic_id
	LEFT JOIN repair_submissions rs ON rs.id = ro.active_submission_id
	WHERE ro.pic_id = $1 AND ro.status IN ('approved', 'rejected')
	%s
	ORDER BY ro.updated_at DESC
	LIMIT $%d OFFSET $%d`

const COUNT_PIC_HISTORY = `
	SELECT COUNT(*)
	FROM repair_orders ro
	JOIN sarpras s ON s.id = ro.sarpras_id
	JOIN sarpras_types st ON st.id = s.sarpras_type_id
	WHERE ro.pic_id = $1 AND ro.status IN ('approved', 'rejected')
	%s`

const GET_SUBMISSION_WITH_REVIEW = `
    SELECT 
        rs.id,
        rs.attempt,
        rs.action_plan,
        rs.due_date,
        rs.status,
        rs.created_at,
        rev.verdict,
        rev.feedback,
        rev.reviewed_at,
        COALESCE(u_rev.name, '') AS reviewer_name
    FROM repair_submissions rs
    LEFT JOIN LATERAL (
        SELECT verdict, feedback, reviewed_at, reviewer_id
        FROM review_orders
        WHERE submission_id = rs.id
        ORDER BY reviewed_at DESC
        LIMIT 1
    ) rev ON true
    LEFT JOIN users u_rev ON u_rev.id = rev.reviewer_id
    WHERE rs.repair_order_id = $1
    ORDER BY rs.attempt ASC
`

const LIST_MONITORING_REPAIR = `
    SELECT 
        ro.id,
        s.id,
        s.code,
        st.name,
        COALESCE(dept_pic.name, '') AS pic_department,
        COALESCE(u_pic.name, '') AS pic_name,
        COALESCE(u_checker.name, '') AS checker_name,
        COALESCE(rs.action_plan, '') AS action_plan,
        ro.status,
        ro.created_at,
        rs.due_date,
        ro.reviewer_id,
        COALESCE(u_rev.name, '') AS reviewer_name
    FROM repair_orders ro
    JOIN sarpras s ON s.id = ro.sarpras_id
    JOIN sarpras_types st ON st.id = s.sarpras_type_id
    LEFT JOIN users u_pic ON u_pic.id = ro.pic_id
    LEFT JOIN departments dept_pic ON dept_pic.id = u_pic.department_id
    LEFT JOIN inspections i ON i.id = ro.inspection_id
    LEFT JOIN users u_checker ON u_checker.id = i.checker_id
    LEFT JOIN repair_submissions rs ON rs.id = ro.active_submission_id
    LEFT JOIN users u_rev ON u_rev.id = ro.reviewer_id
    WHERE 1=1
    %s
    ORDER BY 
        CASE ro.status
            WHEN 'submitted' THEN 1
            WHEN 'in_review' THEN 2
            WHEN 'in_progress' THEN 3
            ELSE 4
        END,
        ro.created_at DESC
    LIMIT $%d OFFSET $%d
`

const COUNT_MONITORING_REPAIR = `
    SELECT COUNT(*)
    FROM repair_orders ro
    JOIN sarpras s ON s.id = ro.sarpras_id
    JOIN sarpras_types st ON st.id = s.sarpras_type_id
    LEFT JOIN users u_pic ON u_pic.id = ro.pic_id
    LEFT JOIN departments dept_pic ON dept_pic.id = u_pic.department_id
    WHERE 1=1
    %s
`

const REVIEW_ATTACHMENTS_BY_SUBMISSION = `
    SELECT ra.file_path
    FROM review_attachments ra
    JOIN review_orders ro ON ro.id = ra.review_order_id
    WHERE ro.submission_id = $1
    ORDER BY ra.uploaded_at
`

const LIST_ALL_HISTORY = `
    SELECT 
        ro.id,
        s.id,
        s.code,
        st.name,
        COALESCE(dept_pic.name, '') AS pic_department,
        COALESCE(u_pic.name, '') AS pic_name,
        COALESCE(u_checker.name, '') AS checker_name,
        COALESCE(rs.action_plan, '') AS action_plan,
        ro.status,
        ro.created_at,
        rs.due_date,
        ro.reviewer_id,
        COALESCE(u_rev.name, '') AS reviewer_name,
        ro.updated_at
    FROM repair_orders ro
    JOIN sarpras s ON s.id = ro.sarpras_id
    JOIN sarpras_types st ON st.id = s.sarpras_type_id
    LEFT JOIN users u_pic ON u_pic.id = ro.pic_id
    LEFT JOIN departments dept_pic ON dept_pic.id = u_pic.department_id
    LEFT JOIN inspections i ON i.id = ro.inspection_id
    LEFT JOIN users u_checker ON u_checker.id = i.checker_id
    LEFT JOIN repair_submissions rs ON rs.id = ro.active_submission_id
    LEFT JOIN users u_rev ON u_rev.id = ro.reviewer_id
    WHERE ro.status IN ('approved', 'rejected')
    %s
    ORDER BY ro.updated_at DESC
    LIMIT $%d OFFSET $%d
`

const COUNT_ALL_HISTORY = `
    SELECT COUNT(*)
    FROM repair_orders ro
    JOIN sarpras s ON s.id = ro.sarpras_id
    JOIN sarpras_types st ON st.id = s.sarpras_type_id
    LEFT JOIN users u_pic ON u_pic.id = ro.pic_id
    LEFT JOIN departments dept_pic ON dept_pic.id = u_pic.department_id
    WHERE ro.status IN ('approved', 'rejected')
    %s
`

const SARPRAS_ID = ` AND ro.sarpras_id = $%d`

const PIC_ID = ` AND ro.pic_id = $%d`

const STATUS = ` AND ro.status = $%d`

const SEARCH = ` AND (s.code ILIKE $%d OR st.name ILIKE $%d)`

const REPAIR_REMINDER = `
SELECT
    ro.id,
    ro.pic_id,
    s.code,
    st.name,
    sub.id             AS submission_id,
    sub.action_plan,
    sub.due_date,
    COALESCE((
        SELECT COUNT(*)
        FROM repair_evidences ev
        WHERE ev.submission_id = sub.id
    ), 0)              AS evidence_count
FROM repair_orders ro
JOIN sarpras s         ON ro.sarpras_id = s.id
JOIN sarpras_types st  ON s.sarpras_type_id = st.id
LEFT JOIN repair_submissions sub ON ro.active_submission_id = sub.id
WHERE ro.status IN ('assigned', 'in_progress')
`

const RepairReminderActionPlan = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#1e293b;background:#f4f7f9;">
      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
        <tr>
          <td align="center">

            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0"
              style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">

              <tr>
                <td style="background:#f59e0b;padding:22px 32px;">
                  <h2 style="margin:0;color:#ffffff;font-size:19px;font-weight:800;letter-spacing:0.04em;">
                    EMERTRACK
                  </h2>
                  <p style="margin:5px 0 0;color:#fde68a;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">
                    Repair Reminder
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:32px;">

                  <h3 style="margin:0 0 16px;font-size:17px;font-weight:700;color:#0f172a;">
                    Action Plan Belum Diisi
                  </h3>

                  <p style="margin:0 0 20px;line-height:1.6;color:#334155;">
                    Anda telah ditunjuk sebagai <strong>PIC (Person in Charge)</strong> untuk melakukan
                    perbaikan sarpras berikut, namun <strong>Action Plan</strong> masih belum diisi.
                    Mohon segera melengkapi Action Plan agar proses perbaikan dapat dilanjutkan
                    dan bukti perbaikan nantinya dapat diunggah.
                  </p>

                  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0"
                    style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
                    <tr>
                      <td style="padding:16px 18px;">

                        <table style="width:100%%;border-collapse:collapse;font-size:13px;">

                          <tr>
                            <td style="padding:6px 0;color:#64748b;width:140px;vertical-align:top;">
                              Jenis Sarpras
                            </td>
                            <td style="padding:6px 0;color:#0f172a;font-weight:600;">
                              %s
                            </td>
                          </tr>

                          <tr>
                            <td style="padding:6px 0;color:#64748b;vertical-align:top;">
                              Nomor Sarpras
                            </td>
                            <td style="padding:6px 0;color:#0f172a;font-weight:600;">
                              %s
                            </td>
                          </tr>

                        </table>

                      </td>
                    </tr>
                  </table>

                  <div style="text-align:center;margin-top:28px;">
                    <a href="%s"
                      style="display:inline-block;background:#f59e0b;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:13px;">
                      Lengkapi Action Plan
                    </a>
                  </div>

                </td>
              </tr>

              <tr>
                <td style="background:#eef4fa;padding:18px 32px;border-top:1px solid #e2e8f0;">
                  <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#003d7a;">
                    EMERTRACK
                  </p>

                  <p style="margin:0;font-size:11px;line-height:1.6;color:#64748b;">
                    Email ini dikirim secara otomatis oleh sistem EMERTRACK.
                    Mohon tidak membalas email ini secara langsung.
                  </p>
                </td>
              </tr>

            </table>

          </td>
        </tr>
      </table>
    </body>
    </html>
    `

    const RepairReminder = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#1e293b;background:#f4f7f9;">
      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
        <tr>
          <td align="center">

            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0"
              style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">

              <tr>
                <td style="background:#2563eb;padding:22px 32px;">
                  <h2 style="margin:0;color:#ffffff;font-size:19px;font-weight:800;letter-spacing:0.04em;">
                    EMERTRACK
                  </h2>
                  <p style="margin:5px 0 0;color:#bfdbfe;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">
                    Repair Reminder
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:32px;">

                  <h3 style="margin:0 0 16px;font-size:17px;font-weight:700;color:#0f172a;">
                    Pengingat Batas Waktu Perbaikan
                  </h3>

                  <p style="margin:0 0 20px;line-height:1.6;color:#334155;">
                    %s
                  </p>

                  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0"
                    style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
                    <tr>
                      <td style="padding:16px 18px;">

                        <table style="width:100%%;border-collapse:collapse;font-size:13px;">

                          <tr>
                            <td style="padding:6px 0;color:#64748b;width:140px;vertical-align:top;">
                              Jenis Sarpras
                            </td>
                            <td style="padding:6px 0;color:#0f172a;font-weight:600;">
                              %s
                            </td>
                          </tr>

                          <tr>
                            <td style="padding:6px 0;color:#64748b;vertical-align:top;">
                              Nomor Sarpras
                            </td>
                            <td style="padding:6px 0;color:#0f172a;font-weight:600;">
                              %s
                            </td>
                          </tr>

                          <tr>
                            <td style="padding:6px 0;color:#64748b;vertical-align:top;">
                              Batas Perbaikan
                            </td>
                            <td style="padding:6px 0;color:#0f172a;font-weight:600;">
                              %s
                            </td>
                          </tr>

                        </table>

                      </td>
                    </tr>
                  </table>

                  <div style="text-align:center;margin-top:28px;">
                    <a href="%s"
                      style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:13px;">
                      Lihat Detail Perbaikan
                    </a>
                  </div>

                </td>
              </tr>

              <tr>
                <td style="background:#eef4fa;padding:18px 32px;border-top:1px solid #e2e8f0;">
                  <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#003d7a;">
                    EMERTRACK
                  </p>

                  <p style="margin:0;font-size:11px;line-height:1.6;color:#64748b;">
                    Email ini dikirim secara otomatis oleh sistem EMERTRACK.
                    Mohon tidak membalas email ini secara langsung.
                  </p>
                </td>
              </tr>

            </table>

          </td>
        </tr>
      </table>
    </body>
    </html>`

    const RepairReminderOverdue = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#1e293b;background:#f4f7f9;">
      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
        <tr>
          <td align="center">

            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0"
              style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">

              <tr>
                <td style="background:#dc2626;padding:22px 32px;">
                  <h2 style="margin:0;color:#ffffff;font-size:19px;font-weight:800;letter-spacing:0.04em;">
                    EMERTRACK
                  </h2>
                  <p style="margin:5px 0 0;color:#fecaca;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">
                    Repair Overdue
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:32px;">

                  <h3 style="margin:0 0 16px;font-size:17px;font-weight:700;color:#0f172a;">
                    Perbaikan Melewati Batas Waktu
                  </h3>

                  <p style="margin:0 0 20px;line-height:1.6;color:#334155;">
                    Perbaikan untuk sarpras berikut telah <strong>melewati batas waktu</strong>,
                    namun sistem belum menemukan bukti perbaikan yang diunggah.
                    Mohon segera menyelesaikan pekerjaan atau mengunggah bukti apabila
                    perbaikan telah selesai dilakukan.
                  </p>

                  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0"
                    style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
                    <tr>
                      <td style="padding:16px 18px;">

                        <table style="width:100%%;border-collapse:collapse;font-size:13px;">

                          <tr>
                            <td style="padding:6px 0;color:#64748b;width:140px;vertical-align:top;">
                              Jenis Sarpras
                            </td>
                            <td style="padding:6px 0;color:#0f172a;font-weight:600;">
                              %s
                            </td>
                          </tr>

                          <tr>
                            <td style="padding:6px 0;color:#64748b;vertical-align:top;">
                              Nomor Sarpras
                            </td>
                            <td style="padding:6px 0;color:#0f172a;font-weight:600;">
                              %s
                            </td>
                          </tr>

                          <tr>
                            <td style="padding:6px 0;color:#64748b;vertical-align:top;">
                              Batas Perbaikan
                            </td>
                            <td style="padding:6px 0;color:#dc2626;font-weight:700;">
                              %s
                            </td>
                          </tr>

                          <tr>
                            <td style="padding:6px 0;color:#64748b;vertical-align:top;">
                              Status
                            </td>
                            <td style="padding:6px 0;color:#dc2626;font-weight:700;">
                              OVERDUE
                            </td>
                          </tr>

                        </table>

                      </td>
                    </tr>
                  </table>

                  <div style="margin-top:20px;padding:14px 16px;background:#fef2f2;border-left:4px solid #dc2626;border-radius:6px;">
                    <strong style="color:#b91c1c;">Tindakan yang perlu dilakukan:</strong>
                    <ul style="margin:10px 0 0 18px;padding:0;color:#475569;line-height:1.8;">
                      <li>Selesaikan proses perbaikan sesegera mungkin.</li>
                      <li>Unggah bukti perbaikan melalui EMERTRACK.</li>
                      <li>Pastikan seluruh informasi perbaikan telah lengkap.</li>
                    </ul>
                  </div>

                  <div style="text-align:center;margin-top:28px;">
                    <a href="%s"
                      style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:13px;">
                      Unggah Bukti Perbaikan
                    </a>
                  </div>

                </td>
              </tr>

              <tr>
                <td style="background:#eef4fa;padding:18px 32px;border-top:1px solid #e2e8f0;">
                  <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#003d7a;">
                    EMERTRACK
                  </p>

                  <p style="margin:0;font-size:11px;line-height:1.6;color:#64748b;">
                    Email ini dikirim secara otomatis oleh sistem EMERTRACK.
                    Mohon tidak membalas email ini secara langsung.
                  </p>
                </td>
              </tr>

            </table>

          </td>
        </tr>
      </table>
    </body>
    </html>
    `