package models

type PaginationMeta struct {
	Total      int `json:"total"`
	Page       int `json:"page"`
	PerPage    int `json:"perPage"`
	TotalPages int `json:"totalPages"`
}
