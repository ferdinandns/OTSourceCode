package sort

import (
	"fmt"
	"strings"
)

type ColumnMapper map[string]string

func BuildOrderBy(sortable ColumnMapper, sortBy, sortOrder, defaultSort string) string {
	col := ""
	order := ""

	// Tentukan kolom
	if expr, ok := sortable[sortBy]; ok {
		col = expr
	} else {
		if defaultSort != "" {
			return " ORDER BY " + defaultSort
		}
		return " ORDER BY id ASC"
	}

	switch strings.ToUpper(sortOrder) {
	case "ASC":
		order = "ASC"
	case "DESC":
		order = "DESC"
	default:
		order = "ASC"
	}

	return fmt.Sprintf(" ORDER BY %s %s", col, order)
}

func SafeOrderBy(sortable ColumnMapper, sortBy, sortOrder string) string {
	return BuildOrderBy(sortable, sortBy, sortOrder, "")
}
