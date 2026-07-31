package services

import (
	"gorm.io/gorm"
)

type MixingTankResult struct {
	KodeProduk string `json:"kode_produk" gorm:"column:kode_produk"`
	TankID     uint   `json:"tank_id" gorm:"column:tank_id"`
	Nama       string `json:"nama" gorm:"column:nama"`
	Ruangan    string `json:"ruangan" gorm:"column:ruangan"`
}

type StorageTankResult struct {
	TankID     uint   `json:"tank_id" gorm:"column:tank_id"`
	KodeTank   string `json:"kode_tank" gorm:"column:kode_tank"`
	MixingTank string `json:"mixing_tank" gorm:"column:mixing_tank"`
}

func GetMixingTank(db *gorm.DB) (map[string][]MixingTankResult, error) {
	var results []MixingTankResult

	err := db.Table("tb_produk as p").
		Select("p.kode_produk, mt.id as tank_id, mt.nama, mt.ruangan").
		Joins("JOIN tb_mixing_tank_produk as mtp ON p.id = mtp.produk_id").
		Joins("JOIN tb_mixing_tanks as mt ON mtp.mixing_tank_id = mt.id").
		Distinct().
		Scan(&results).Error

	if err != nil {
		return nil, err
	}

	groupedData := make(map[string][]MixingTankResult)

	for _, row := range results {
		groupedData[row.KodeProduk] = append(groupedData[row.KodeProduk], row)
	}

	return groupedData, nil
}

func GetStorageTank(db *gorm.DB, id int) ([]StorageTankResult, error) {
	var storageTanks []StorageTankResult

	query := `
		WITH TargetWorkOrder AS (
			SELECT LOWER(TRIM(mixing_tank::text)) AS base_tank
			FROM tb_work_orders
			WHERE id = ?
		),
		MappedMixingTanks AS (
			SELECT base_tank AS tank_name FROM TargetWorkOrder
			UNION
			SELECT 'tetra 1'::text FROM TargetWorkOrder WHERE base_tank = 'silverson'
			UNION
			SELECT 'silverson'::text FROM TargetWorkOrder WHERE base_tank = 'tetra 1'
			UNION
			SELECT 'tetra 3'::text FROM TargetWorkOrder WHERE base_tank = 'tetra 2'
			UNION
			SELECT 'tetra 2'::text FROM TargetWorkOrder WHERE base_tank = 'tetra 3'
		),
		AllStorageCandidates AS (
			SELECT id, kode_tank, mixing_tank
			FROM tb_storage_tanks
			WHERE LOWER(TRIM(mixing_tank::text)) IN (SELECT tank_name FROM MappedMixingTanks)
		),
		UsedStorageTanks AS (
    		SELECT DISTINCT UPPER(TRIM(w1.storage_tank::text)) AS storage_tank
    		FROM tb_work_orders w1
    		WHERE w1.storage_tank IS NOT NULL
      			AND w1.kirim_ke_sample_fg IS NULL
      			AND w1.id = (
          			SELECT MAX(w2.id)
          			FROM tb_work_orders w2
          			WHERE UPPER(TRIM(w2.storage_tank::text)) = UPPER(TRIM(w1.storage_tank::text))
      			)
		)
		SELECT DISTINCT c.id as tank_id, c.kode_tank, c.mixing_tank
		FROM AllStorageCandidates c
		WHERE UPPER(TRIM(c.kode_tank::text)) NOT IN (SELECT storage_tank FROM UsedStorageTanks)
		ORDER BY c.mixing_tank ASC;
	`

	// Eksekusi raw query dan langsung map hasilnya ke slice structs menggunakan Scan()
	err := db.Raw(query, id).Scan(&storageTanks).Error
	if err != nil {
		return nil, err
	}

	return storageTanks, nil
}
