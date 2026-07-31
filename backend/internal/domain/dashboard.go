package domain

import (
	"context"
)

type DashboardSummary struct {
	TotalAssets               int                        `json:"total_assets"`
	TotalRiskWeight           float64                    `json:"total_risk_weight"`
	StatusStats               []StatusAnalysis           `json:"status_stats"`
	TypeStats                 []TypeAnalysis              `json:"type_stats"`
	DepartmentComplianceStats []DepartmentComplianceStat `json:"department_compliance_stats"`
	RecentActivities          []DashboardTableRow        `json:"recent_activities"`
}

type DepartmentComplianceStat struct {
	DepartmentName       string  `json:"department_name"`
	TotalSarpras         int     `json:"total_sarpras"`
	OnTimeCount          int     `json:"on_time_count"`
	OverdueCount         int     `json:"overdue_count"`
	CompliancePercentage float64 `json:"compliance_percentage"`
}

type StatusAnalysis struct {
	Status     string  `json:"status"`
	Count      int     `json:"count"`
	TotalRisk  float64 `json:"total_risk"`
	Percentage float64 `json:"percentage"`
}

type TypeAnalysis struct {
	TypeName string `json:"type_name"`
	Count    int    `json:"count"`
}

type DashboardTableRow struct {
	ID             uint   `json:"id"`
	SarprasName    string `json:"nama"`
	SarprasCode    string `json:"nomor"`
	DepartmentName string `json:"departemen"`
	CheckerName    string `json:"pemeriksa"`
	Status         string `json:"status"`
	LastCheck      string `json:"terakhir"`
	NextCheck      string `json:"selanjutnya"`
}

type TableFilter struct {
	Page      int
	PageSize  int
	Status    string 
	Period	  string
	DeptId    int   
	TypeId    int    
	Search    string 
	SortBy    string
	SortOrder string
	Year      int 
}

type DashboardRepository interface {
	GetSummary(ctx context.Context, filter TableFilter) (DashboardSummary, error)
	ListDashboardTable(ctx context.Context, filter TableFilter) ([]DashboardTableRow, int64, error)
}

type DashboardService interface {
	GetDashboardData(ctx context.Context, filter TableFilter) (DashboardSummary, error)
	ListDashboardTable(ctx context.Context, filter TableFilter) ([]DashboardTableRow, int64, error)
}