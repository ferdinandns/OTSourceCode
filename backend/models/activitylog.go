package models

import "time"

type ActivityLog struct {
	ID        int       `json:"id"`
	Time      string    `json:"time"`
	Name      string    `json:"name"`
	Division  string    `json:"division"`
	Action    string    `json:"action"`
	TableName string    `json:"table"`
	NoData    string    `json:"noData"`
	Detail    string    `json:"detail"`
	TimeRaw   time.Time `json:"-"`
}

type ActivityLogResponse struct {
	Data       []ActivityLog `json:"data"`
	Total      int           `json:"total"`
	Page       int           `json:"page"`
	PerPage    int           `json:"perPage"`
	TotalPages int           `json:"totalPages"`
}
