package review

const (
    ID_INVALID = "ID Tidak Valid"

    SEARCH_FILTER = ` AND (s.code ILIKE $%d OR st.name ILIKE $%d OR d.name ILIKE $%d)`
    SITE_FILTER   = ` AND si.id = $%d`
    DEPT_FILTER   = ` AND d.id = $%d`
    COUNT_TOTAL   = ` SELECT COUNT(*) FROM repair_orders ro 
                    JOIN sarpras s ON s.id = ro.sarpras_id 
                    JOIN sarpras_types st ON st.id = s.sarpras_type_id 
                    JOIN departments d ON d.id = s.location_dept_id 
                    JOIN sites si ON si.id = d.site_id %s`

    LIST_PENDING = `
                    SELECT
                        ro.id,
                        s.id,
                        s.code,
                        st.name,
                        si.name,
                        d.name,
                        COALESCE(u_pic.name, ''),
                        ro.updated_at,
                        ro.status,
                        s.status,
                        ro.reviewer_id 
                    FROM repair_orders ro
                    JOIN sarpras s ON s.id = ro.sarpras_id
                    JOIN sarpras_types st ON st.id = s.sarpras_type_id
                    JOIN departments d ON d.id = s.location_dept_id
                    JOIN sites si ON si.id = d.site_id
                    LEFT JOIN users u_pic ON u_pic.id = ro.pic_id
                    %s
                    ORDER BY %s %s
                    LIMIT $%d OFFSET $%d`

    // GET_NOK_PARAM_NAMES excludes the expiry (ED / Masa Berlaku) parameter:
    // it's handled via a separate GA refill notification flow, not by the
    // repair PIC/QS review, so it shouldn't appear in the review list.
    GET_NOK_PARAM_NAMES = `
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
    // same reason as GET_NOK_PARAM_NAMES above.
    GET_NOK_ITEMS = `
        SELECT p.name, COALESCE(ii.notes, ''), COALESCE(ii.photo_path, '')
        FROM inspection_items ii
        JOIN parameters p ON p.id = ii.parameter_id
        JOIN inspections insp ON insp.id = ii.inspection_id
        JOIN sarpras s ON s.id = insp.sarpras_id
        JOIN sarpras_types st ON st.id = s.sarpras_type_id
        WHERE ii.inspection_id = $1 AND ii.status = 'NOK'
          AND (st.expiry_param_id IS NULL OR p.id <> st.expiry_param_id)
        ORDER BY p.order_no`

    GET_REVIEW_DETAIL = `
    SELECT
        ro.id,
        s.code,
        st.name,
        si.name,
        d.name,
        COALESCE(s.location_detail, ''),
        COALESCE(u_pic.name, ''),
        i.inspected_at,
        ro.updated_at,
        ro.status,
        COALESCE(rs.action_plan, ''),
        COALESCE(i.id, 0)
    FROM repair_orders ro
    JOIN sarpras s ON s.id = ro.sarpras_id
    JOIN sarpras_types st ON st.id = s.sarpras_type_id
    JOIN departments d ON d.id = s.location_dept_id
    JOIN sites si ON si.id = d.site_id
    LEFT JOIN inspections i ON i.id = ro.inspection_id
    LEFT JOIN users u_pic ON u_pic.id = ro.pic_id
    LEFT JOIN repair_submissions rs ON rs.id = ro.active_submission_id
    WHERE ro.id = $1`

    REPAIR_EVIDENCE = `SELECT file_path FROM repair_evidences WHERE submission_id = $1 ORDER BY uploaded_at`

    GET_SUMMARY = `
        SELECT
            COUNT(*) FILTER (WHERE ro.status = 'approved')   AS approved,
            COUNT(*) FILTER (WHERE ro.status = 'rejected')   AS rejected,
            COUNT(*) FILTER (WHERE ro.status = 'in_review')  AS in_review,
            COUNT(*) FILTER (WHERE ro.status = 'submitted')  AS waiting_review
        FROM repair_orders ro
    `

    LIST_QS_HISTORY = `
    SELECT 
        rev.id AS review_id,
        ro.id AS repair_order_id,
        s.code AS sarpras_code,
        st.name AS sarpras_name,
        d.name AS department_name,
        rev.verdict,
        rev.feedback,
        rev.reviewed_at,
        COALESCE(u_rev.name, '') AS reviewer_name,
        ro.status AS repair_status
    FROM review_orders rev
    JOIN repair_orders ro ON ro.id = rev.repair_order_id
    JOIN sarpras s ON s.id = ro.sarpras_id
    JOIN sarpras_types st ON st.id = s.sarpras_type_id
    JOIN departments d ON d.id = s.location_dept_id
    LEFT JOIN users u_rev ON u_rev.id = rev.reviewer_id
    WHERE rev.reviewer_id = $1
    %s
    ORDER BY rev.reviewed_at DESC
    LIMIT $%d OFFSET $%d
`

    COUNT_QS_HISTORY = `
    SELECT COUNT(*)
    FROM review_orders rev
    JOIN repair_orders ro ON ro.id = rev.repair_order_id
    WHERE rev.reviewer_id = $1
    %s
`

    LIST_REVIEWS_BY_REPAIR = `
    SELECT 
        rev.id,
        rev.repair_order_id,
        rev.verdict,
        rev.feedback,
        rev.reviewed_at,
        COALESCE(u.name, '') AS reviewer_name
    FROM review_orders rev
    LEFT JOIN users u ON u.id = rev.reviewer_id
    WHERE rev.repair_order_id = $1
    ORDER BY rev.reviewed_at DESC
    LIMIT $2 OFFSET $3
`

    COUNT_REVIEWS_BY_REPAIR = `
    SELECT COUNT(*)
    FROM review_orders rev
    WHERE rev.repair_order_id = $1
`

    GET_REVIEW_HISTORY_DETAIL = `
        SELECT 
            rev.id AS review_id,
            ro.id AS repair_order_id,
            s.code AS sarpras_code,
            st.name AS sarpras_name,
            d.name AS department_name,
            rev.verdict,
            rev.feedback,
            rev.reviewed_at,
            COALESCE(u_rev.name, '') AS reviewer_name,
            ro.status AS repair_status,
            COALESCE(rs.action_plan, '') AS action_plan,
            COALESCE(
                (SELECT STRING_AGG(ev.file_path, '|')
                FROM repair_evidences ev
                WHERE ev.submission_id = ro.active_submission_id
                ), ''
            ) AS evidence_paths,
            COALESCE(
                (SELECT JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'parameter_name', p.name,
                        'notes', ii.notes,
                        'photo_url', ii.photo_path
                    )
                )
                FROM inspection_items ii
                JOIN parameters p ON p.id = ii.parameter_id
                WHERE ii.inspection_id = ro.inspection_id AND ii.status = 'NOK'
                  AND (st.expiry_param_id IS NULL OR p.id <> st.expiry_param_id)
                ), '[]'
            ) AS nok_details
        FROM review_orders rev
        JOIN repair_orders ro ON ro.id = rev.repair_order_id
        JOIN sarpras s ON s.id = ro.sarpras_id
        JOIN sarpras_types st ON st.id = s.sarpras_type_id
        JOIN departments d ON d.id = s.location_dept_id
        LEFT JOIN repair_submissions rs ON rs.id = ro.active_submission_id
        LEFT JOIN users u_rev ON u_rev.id = rev.reviewer_id
        WHERE rev.id = $1
        `

    GET_ALL_HISTORY_FOR_EXPORT = `
SELECT 
    rev.id AS review_id,
    ro.id AS repair_order_id,
    s.code AS sarpras_code,
    st.name AS sarpras_name,
    d.name AS department_name,
    rev.verdict,
    rev.feedback,
    rev.reviewed_at,
    COALESCE(u_rev.name, '') AS reviewer_name,
    ro.status AS repair_status,
    COALESCE(rs.action_plan, '') AS action_plan,
    COALESCE(
        (SELECT STRING_AGG(ev.file_path, '|')
        FROM repair_evidences ev
        WHERE ev.submission_id = ro.active_submission_id
        ), ''
    ) AS evidence_paths,
    COALESCE(
        (SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
                'parameter_name', p.name,
                'notes', ii.notes,
                'photo_url', ii.photo_path
            )
        )
        FROM inspection_items ii
        JOIN parameters p ON p.id = ii.parameter_id
        WHERE ii.inspection_id = ro.inspection_id AND ii.status = 'NOK'
          AND (st.expiry_param_id IS NULL OR p.id <> st.expiry_param_id)
        ), '[]'
    ) AS nok_details
FROM review_orders rev
JOIN repair_orders ro ON ro.id = rev.repair_order_id
JOIN sarpras s ON s.id = ro.sarpras_id
JOIN sarpras_types st ON st.id = s.sarpras_type_id
JOIN departments d ON d.id = s.location_dept_id
LEFT JOIN repair_submissions rs ON rs.id = ro.active_submission_id
LEFT JOIN users u_rev ON u_rev.id = rev.reviewer_id
WHERE rev.reviewer_id = $1
  AND ro.status IN ('approved', 'rejected')
  %s
ORDER BY rev.reviewed_at DESC
`
)