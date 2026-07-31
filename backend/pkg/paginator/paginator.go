package paginator

import (
	"math"
	"net/http"
	"strconv"
)

type Pagination struct {
	Page   int
	Limit  int
	Offset int
}

func FromRequest(r *http.Request) Pagination {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	// Hitung page untuk keperluan response metadata (jika diperlukan)
	page := 1
	if limit > 0 {
		page = (offset / limit) + 1
	}

	return Pagination{
		Page:   page,
		Limit:  limit,
		Offset: offset,
	}
}

func TotalPages(total int64, pageSize int) int {
	if total == 0 || pageSize == 0 {
		return 0
	}
	return int(math.Ceil(float64(total) / float64(pageSize)))
}

func (p Pagination) Meta(total int64) map[string]interface{} {
	return map[string]interface{}{
		"page":        p.Page,
		"page_size":   p.Limit,
		"total":       total,
		"total_pages": TotalPages(total, p.Limit),
	}
}

func ValidateLimitOffset(limit, offset int) (int, int) {
	if limit > 100 {
		limit = 100
	}
	if limit < 0 {
		limit = 0
	}
	if offset < 0 {
		offset = 0
	}
	return limit, offset
}
