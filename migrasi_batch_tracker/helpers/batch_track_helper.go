package helpers

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// ExpandBatch mengubah input batch seperti "CG001-CG003" menjadi daftar batch individual.
func ExpandBatch(batchStr string) []string {
	var result []string
	parts := strings.Split(batchStr, ",")

	// Regex untuk menangkap prefix huruf dan angka di belakangnya
	re := regexp.MustCompile(`^([A-Z]+)(\d+)$`)

	for _, part := range parts {
		part = strings.TrimSpace(part)

		if strings.Contains(part, "-") {
			ranges := strings.Split(part, "-")
			if len(ranges) == 2 {
				start := strings.TrimSpace(ranges[0])
				end := strings.TrimSpace(ranges[1])

				m1 := re.FindStringSubmatch(start)
				m2 := re.FindStringSubmatch(end)

				if len(m1) == 3 && len(m2) == 3 && m1[1] == m2[1] {
					prefix := m1[1]
					startNum, _ := strconv.Atoi(m1[2])
					endNum, _ := strconv.Atoi(m2[2])
					padLen := len(m1[2]) // Ambil panjang digit asli untuk padding (misal "001" -> 3)

					for i := startNum; i <= endNum; i++ {
						// Format string dinamis seperti "%s%03d" -> "CG001"
						format := fmt.Sprintf("%%s%%0%dd", padLen)
						result = append(result, fmt.Sprintf(format, prefix, i))
					}
				} else {
					result = append(result, part) // Fallback jika regex tidak cocok
				}
			}
		} else {
			if part != "" {
				result = append(result, part)
			}
		}
	}
	return result
}

// FindMissingBatches membandingkan daftar batch yang seharusnya ada dengan yang ditemukan untuk deteksi data yang hilang.
func FindMissingBatches(all, found []string) []string {
	foundMap := make(map[string]bool)
	for _, v := range found {
		foundMap[v] = true
	}

	var missing []string
	for _, v := range all {
		if !foundMap[v] {
			missing = append(missing, v)
		}
	}
	return missing
}

// func UpdateOrInsert(tx *gorm.DB, woId []uint, userId uint, tableName, columnName string) error {
// 	if len(woId) == 0{
// 		return nil
// 	}

// 	var data []map[string]any

// 	for _, id := range woId{
// 		data = append(data, map[string]any{
// 			"id":id,
// 			columnName: userId,
// 		})
// 	}

// 	return tx.Table(tableName).Clauses(clause.OnConflict{
// 		Columns: []clause.Column{{Name: "id"}},
// 		DoUpdates: clause.AssignmentColumns([]string{columnName}),
// 	}).Create(data).Error
// }
