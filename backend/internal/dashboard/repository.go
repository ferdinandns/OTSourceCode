package dashboard

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"emertrack/internal/domain"
	"emertrack/pkg/util"
)

type repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) domain.DashboardRepository {
	return &repository{db}
}

func (r *repository) GetSummary(ctx context.Context, filter domain.TableFilter) (domain.DashboardSummary, error) {
	var summary domain.DashboardSummary
	summary.StatusStats = []domain.StatusAnalysis{}
	summary.TypeStats = []domain.TypeAnalysis{}
	summary.DepartmentComplianceStats = []domain.DepartmentComplianceStat{}

	baseConds, baseArgs, argIdx := r.buildBaseConditions(filter)

	globalWhere, globalArgs := r.buildWhereClause(true, true, baseConds, baseArgs, argIdx, filter)
	queryGlobal := COUNT_SUMMARY_BASE + globalWhere
	err := r.db.QueryRowContext(ctx, queryGlobal, globalArgs...).Scan(&summary.TotalAssets, &summary.TotalRiskWeight)
	if err != nil {
		return summary, err
	}

	statusWhere, statusArgs := r.buildWhereClause(false, true, baseConds, baseArgs, argIdx, filter)
	statusStats, err := r.fetchStatusStats(ctx, statusWhere, statusArgs)
	if err != nil {
		return summary, err
	}
	summary.StatusStats = statusStats

	typeWhere, typeArgs := r.buildWhereClause(true, false, baseConds, baseArgs, argIdx, filter)
	typeStats, err := r.fetchTypeStats(ctx, typeWhere, typeArgs)
	if err != nil {
		return summary, err
	}
	summary.TypeStats = typeStats

	deptStats, err := r.fetchDepartmentComplianceStats(ctx, filter.Year)
	if err != nil {
		return summary, err
	}
	summary.DepartmentComplianceStats = deptStats

	return summary, nil
}

// buildBaseConditions returns the base WHERE conditions, arguments, and next argument index.
func (r *repository) buildBaseConditions(filter domain.TableFilter) ([]string, []interface{}, int) {
	conds := []string{}
	args := []interface{}{}
	idx := 1

	if filter.Period != "" {
		conds = append(conds, fmt.Sprintf(PERIOD_FILTER, idx))
		args = append(args, filter.Period)
		idx++
	}
	if filter.DeptId != 0 {
		conds = append(conds, fmt.Sprintf(DEPTID_FILTER, idx))
		args = append(args, filter.DeptId)
		idx++
	}
	if filter.Search != "" {
		conds = append(conds, fmt.Sprintf(SEARCH_FILTER, idx, idx+1, idx+2))
		likeVal := "%" + strings.ToLower(filter.Search) + "%"
		args = append(args, likeVal, likeVal, likeVal)
		idx += 3
	}

	return conds, args, idx
}

// buildWhereClause constructs the WHERE clause and argument list based on inclusion flags.
func (r *repository) buildWhereClause(includeStatus, includeType bool, baseConds []string, baseArgs []interface{}, argIdx int, filter domain.TableFilter) (string, []interface{}) {
	conds := append([]string{}, baseConds...)
	args := append([]interface{}{}, baseArgs...)
	currIdx := argIdx

	if includeStatus && filter.Status != "" {
		conds = append(conds, fmt.Sprintf(STATUS_FILTER, currIdx))
		args = append(args, filter.Status)
		currIdx++
	}
	if includeType && filter.TypeId != 0 {
		conds = append(conds, fmt.Sprintf(SARPRAS_TYPES_FILTER, currIdx))
		args = append(args, filter.TypeId)
		currIdx++
	}

	if len(conds) == 0 {
		return "", args
	}
	return " WHERE " + strings.Join(conds, " AND "), args
}

func (r *repository) fetchStatusStats(ctx context.Context, where string, args []interface{}) ([]domain.StatusAnalysis, error) {
	query := STATUS_STATISTIC_BASE + where + " GROUP BY s.status"
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []domain.StatusAnalysis
	var totalRisk float64

	for rows.Next() {
		var sa domain.StatusAnalysis
		if err := rows.Scan(&sa.Status, &sa.Count, &sa.TotalRisk); err != nil {
			return nil, err
		}
		totalRisk += sa.TotalRisk
		stats = append(stats, sa)
	}

	for i := range stats {
		if totalRisk > 0 {
			val := (stats[i].TotalRisk / totalRisk) * 100
			stats[i].Percentage = float64(int(val*10+0.5)) / 10
		}
	}

	return stats, nil
}

func (r *repository) fetchTypeStats(ctx context.Context, where string, args []interface{}) ([]domain.TypeAnalysis, error) {
	query := SARPRAS_STATISTIC_BASE + where + " GROUP BY st.name"
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []domain.TypeAnalysis
	for rows.Next() {
		var ta domain.TypeAnalysis
		if err := rows.Scan(&ta.TypeName, &ta.Count); err != nil {
			return nil, err
		}
		stats = append(stats, ta)
	}
	return stats, nil
}

// fetchDepartmentComplianceStats returns, per department, compliance computed
// per inspection SCHEDULE within the given year (see DEPARTMENT_COMPLIANCE_STATS
// comment in constant.go) — not a live snapshot of sarpras.due_date.
func (r *repository) fetchDepartmentComplianceStats(ctx context.Context, year int) ([]domain.DepartmentComplianceStat, error) {
	rows, err := r.db.QueryContext(ctx, DEPARTMENT_COMPLIANCE_STATS, year)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []domain.DepartmentComplianceStat
	for rows.Next() {
		var ds domain.DepartmentComplianceStat
		if err := rows.Scan(&ds.DepartmentName, &ds.TotalSarpras, &ds.OverdueCount); err != nil {
			return nil, err
		}
		ds.OnTimeCount = ds.TotalSarpras - ds.OverdueCount
		if ds.TotalSarpras > 0 {
			val := (float64(ds.OnTimeCount) / float64(ds.TotalSarpras)) * 100
			ds.CompliancePercentage = float64(int(val*10+0.5)) / 10
		}
		stats = append(stats, ds)
	}
	return stats, nil
}

func (r *repository) ListDashboardTable(ctx context.Context, filter domain.TableFilter) ([]domain.DashboardTableRow, int64, error) {
	var total int64
	var result []domain.DashboardTableRow

	allowedSortColumns := map[string]string{
		"name":           "st.name",
		"code":           "s.code",
		"department":     "d.name",
		"checker":        "u.name",
		"status":         "s.status",
		"last_inspected": "s.last_inspected",
		"next_check":     "s.due_date",
	}

	args := []interface{}{}
	argIdx := 1
	conditions := []string{}

	if filter.Status != "" {
		conditions = append(conditions, fmt.Sprintf(STATUS_FILTER, argIdx))
		args = append(args, filter.Status)
		argIdx++
	}

	if filter.Period != "" {
		conditions = append(conditions, fmt.Sprintf(PERIOD_FILTER, argIdx))
		args = append(args, filter.Period)
		argIdx++
	}

	if filter.DeptId != 0 {
		conditions = append(conditions, fmt.Sprintf(DEPTID_FILTER, argIdx))
		args = append(args, filter.DeptId)
		argIdx++
	}

	if filter.TypeId != 0 {
		conditions = append(conditions, fmt.Sprintf(SARPRAS_TYPES_FILTER, argIdx))
		args = append(args, filter.TypeId)
		argIdx++
	}

	if filter.Search != "" {
		conditions = append(conditions, fmt.Sprintf(
			SEARCH_FILTER,
			argIdx, argIdx+1, argIdx+2,
		))
		likeVal := "%" + strings.ToLower(filter.Search) + "%"
		args = append(args, likeVal, likeVal, likeVal)
		argIdx += 3
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = " WHERE " + strings.Join(conditions, " AND ")
	}

	baseJoin := BASE_JOIN

	countQuery := "SELECT COUNT(s.id)" + baseJoin + whereClause
	orderClause := util.BuildOrderClause(filter.SortBy, filter.SortOrder, "s.due_date", "DESC", allowedSortColumns)
	fmt.Println("COUNT QUERY:", countQuery)
	fmt.Println("ARGS:", args)
	err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("error count: %w", err)
	}

	offset := (filter.Page - 1) * filter.PageSize
	args = append(args, filter.PageSize, offset)

	selectQuery := fmt.Sprintf(LIST_TABLE,
		baseJoin,
		whereClause,
		orderClause,
		argIdx,
		argIdx+1,
	)

	rows, err := r.db.QueryContext(ctx, selectQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("error query: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var row domain.DashboardTableRow
		err := rows.Scan(
			&row.ID, &row.SarprasName, &row.SarprasCode,
			&row.DepartmentName, &row.CheckerName,
			&row.Status, &row.LastCheck, &row.NextCheck,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("error scan: %w", err)
		}
		result = append(result, row)
	}

	return result, total, nil
}