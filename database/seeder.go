package database

import (
	"encoding/json"
	"lab-connect/backend-api/models"
	"lab-connect/backend-api/structs"
	"log"
	"strings"
)

// ✅ Main seeder function - CALL THIS FROM database.go
func RunSeeder() {
	SeedLokasi()
	seedVerificationTemplates()
	seedVerificationReferences()
}

func SeedLokasi() {
	lokasi := []models.Lokasi{
		{Nama: "Cikarang", Kode: "CKR"},
		{Nama: "Pulo Gadung", Kode: "PLG"},
	}

	for _, l := range lokasi {
		// Check if exists
		var existing models.Lokasi
		if err := DB.Where("kode = ?", l.Kode).First(&existing).Error; err != nil {
			// Not exists, create
			if err := DB.Create(&l).Error; err != nil {
				log.Printf("Failed to seed lokasi %s: %v\n", l.Nama, err)
			} else {
				log.Printf("Seeded lokasi: %s\n", l.Nama)
			}
		}
	}
}

func seedVerificationTemplates() {
	var count int64
	DB.Model(&models.VerificationTemplate{}).Count(&count)

	if count > 0 {
		log.Println("⏭️  Verification templates already seeded")
		return
	}

	log.Println("🌱 Seeding verification templates...")
}

func seedVerificationReferences() {
	var count int64
	DB.Model(&models.VerificationReference{}).Count(&count)

	if count > 0 {
		log.Println("⏭️  Verification references already seeded")
		return
	}

	log.Println("🌱 Seeding verification references...")

	// ✅ Get ALL instruments first
	var allInstruments []models.Instrument
	DB.Find(&allInstruments)

	log.Printf("🔍 Found %d total instruments", len(allInstruments))

	references := []models.VerificationReference{}

	// ✅ Filter TIMBANGAN by name
	var timbangan []models.Instrument
	for _, inst := range allInstruments {
		nama := strings.ToLower(inst.Nama)
		if strings.Contains(nama, "timbang") ||
			strings.Contains(nama, "balance") ||
			strings.Contains(nama, "scale") {
			timbangan = append(timbangan, inst)
		}
	}

	log.Printf("🔍 Found %d timbangan (by name)", len(timbangan))

	// Seed anak timbang for each timbangan
	for _, instrument := range timbangan {
		log.Printf("  ✓ Adding references for: %s", instrument.Nama)

		weights := []struct {
			noKontrol string
			name      string
			nominal   float64
			minTol    float64
			maxTol    float64
		}{
			{"ANT-010", "Anak Timbang 10g", 10.0000, 9.9998, 10.0002},
			{"ANT-050", "Anak Timbang 50g", 50.0000, 49.9995, 50.0005},
			{"ANT-100", "Anak Timbang 100g", 100.0000, 99.9990, 100.0010},
			{"ANT-200", "Anak Timbang 200g", 200.0000, 199.9980, 200.0020},
			{"ANT-500", "Anak Timbang 500g", 500.0000, 499.9950, 500.0050},
			{"ANT-1000", "Anak Timbang 1kg", 1000.0000, 999.9900, 1000.0100},
		}

		for _, weight := range weights {
			nominal := weight.nominal
			minTol := weight.minTol
			maxTol := weight.maxTol

			references = append(references, models.VerificationReference{
				InstrumentID:  instrument.Id,
				ReferenceType: "anak_timbang",
				NoKontrol:     weight.noKontrol,
				Name:          weight.name,
				NominalValue:  &nominal,
				MinTolerance:  &minTol,
				MaxTolerance:  &maxTol,
				Status:        "Active",
			})
		}
	}

	// ✅ Filter pH METER by name
	var phMeters []models.Instrument
	for _, inst := range allInstruments {
		nama := strings.ToLower(inst.Nama)
		if strings.Contains(nama, "ph") && !strings.Contains(nama, "cond") {
			phMeters = append(phMeters, inst)
		}
	}

	log.Printf("🔍 Found %d pH meters (by name)", len(phMeters))

	for _, instrument := range phMeters {
		log.Printf("  ✓ Adding references for: %s", instrument.Nama)

		buffers := []struct {
			noKontrol string
			name      string
			value     float64
			minTol    float64
			maxTol    float64
		}{
			{"BUF-PH4", "Buffer pH 4.01", 4.01, 3.98, 4.04},
			{"BUF-PH7", "Buffer pH 7.00", 7.00, 6.97, 7.03},
			{"BUF-PH10", "Buffer pH 10.01", 10.01, 9.98, 10.04},
		}

		for _, buffer := range buffers {
			value := buffer.value
			minTol := buffer.minTol
			maxTol := buffer.maxTol

			references = append(references, models.VerificationReference{
				InstrumentID:  instrument.Id,
				ReferenceType: "buffer_ph",
				NoKontrol:     buffer.noKontrol,
				Name:          buffer.name,
				BufferValue:   &value,
				MinTolerance:  &minTol,
				MaxTolerance:  &maxTol,
				Status:        "Active",
			})
		}
	}

	// ✅ Filter pH & CONDUCTIVITY METER by name
	var phCondMeters []models.Instrument
	for _, inst := range allInstruments {
		nama := strings.ToLower(inst.Nama)
		if (strings.Contains(nama, "ph") && strings.Contains(nama, "cond")) ||
			strings.Contains(nama, "ph & cond") ||
			strings.Contains(nama, "conductivity") {
			phCondMeters = append(phCondMeters, inst)
		}
	}

	log.Printf("🔍 Found %d pH & Conductivity meters (by name)", len(phCondMeters))

	for _, instrument := range phCondMeters {
		log.Printf("  ✓ Adding references for: %s", instrument.Nama)

		// pH Buffers
		phBuffers := []struct {
			noKontrol string
			name      string
			value     float64
			minTol    float64
			maxTol    float64
		}{
			{"BUF-PH4", "Buffer pH 4.01", 4.01, 3.98, 4.04},
			{"BUF-PH7", "Buffer pH 7.00", 7.00, 6.97, 7.03},
		}

		for _, buffer := range phBuffers {
			value := buffer.value
			minTol := buffer.minTol
			maxTol := buffer.maxTol

			references = append(references, models.VerificationReference{
				InstrumentID:  instrument.Id,
				ReferenceType: "buffer_ph",
				NoKontrol:     buffer.noKontrol,
				Name:          buffer.name,
				BufferValue:   &value,
				MinTolerance:  &minTol,
				MaxTolerance:  &maxTol,
				Status:        "Active",
			})
		}

		// Conductivity Buffer
		condValue := 1413.0
		condMinTol := 1400.0
		condMaxTol := 1426.0

		references = append(references, models.VerificationReference{
			InstrumentID:  instrument.Id,
			ReferenceType: "buffer_cond",
			NoKontrol:     "BUF-COND-1413",
			Name:          "Buffer Conductivity 1413 µS/cm",
			BufferValue:   &condValue,
			MinTolerance:  &condMinTol,
			MaxTolerance:  &condMaxTol,
			Status:        "Active",
		})
	}

	// Insert all references
	if len(references) > 0 {
		if err := DB.Create(&references).Error; err != nil {
			log.Printf("❌ Failed to seed verification references: %v", err)
		} else {
			log.Printf("✅ Seeded %d verification references", len(references))
		}
	} else {
		log.Println("⚠️  No instruments found for verification references")
		log.Println("💡 Make sure you have instruments with names containing:")
		log.Println("   - 'timbang', 'balance', or 'scale' for weighing instruments")
		log.Println("   - 'ph' for pH meters")
		log.Println("   - 'conductivity' or 'cond' for conductivity meters")
	}
}

func SeedMettlerToledoCommands() {
	commands := []structs.MTSICSCommand{
		{Command: "S", Description: "Kirim nilai berat stabil (stable weight only)"},
		{Command: "SI", Description: "Kirim nilai berat instan (tidak tunggu stabil)"},
		{Command: "SIR", Description: "Kirim nilai berat terus-menerus (continuous send)"},
		{Command: "SIRQ", Description: "Hentikan pengiriman terus-menerus"},
		{Command: "T", Description: "Tare – set berat sekarang jadi nol"},
		{Command: "Z", Description: "Zero – set nol mekanik (re-zero)"},
		{Command: "D", Description: "Print hasil penimbangan"},
		{Command: "P", Description: "Print hasil (alias D)"},
		{Command: "I", Description: "Info balance: model, serial, versi"},
		{Command: "@", Description: "Status balance saat ini"},
		{Command: "K", Description: "Jalankan kalibrasi internal otomatis"},
		{Command: "K A", Description: "Jalankan kalibrasi eksternal (dengan bobot luar)"},
		{Command: "C", Description: "Clear display (hapus tampilan / reset layar)"},
		{Command: "Q", Description: "Stop / Abort proses aktif"},
		{Command: "UL", Description: "Tampilkan daftar satuan yang tersedia"},
		{Command: "U g", Description: "Ganti satuan ke gram"},
		{Command: "U mg", Description: "Ganti satuan ke miligram"},
		{Command: "U ct", Description: "Ganti satuan ke carat"},
		{Command: "U oz", Description: "Ganti satuan ke ons"},
		{Command: "R", Description: "Ulangi hasil cetak terakhir"},
		{Command: "@MT", Description: "Tampilkan versi protokol MT-SICS"},
	}

	commandsJSON, _ := json.Marshal(commands)

	// Find instrument 2QC-TMB-010
	var instrument models.Instrument
	if err := DB.Where("kode_instrument = ?", "2QC-TMB-010").First(&instrument).Error; err != nil {
		log.Printf("⚠️  Instrument 2QC-TMB-010 not found, skipping MT-SICS commands seed")
		return
	}

	// Update or create config
	var config models.InstrumentConfig
	err := DB.Where("instrument_id = ?", instrument.Id).First(&config).Error

	if err != nil {
		// Create new config
		config = models.InstrumentConfig{
			InstrumentID:   instrument.Id,
			CustomCommands: string(commandsJSON),
			ReadCommand:    "S",
		}
		DB.Create(&config)
		log.Println("✅ Created MT-SICS commands for 2QC-TMB-010")
	} else {
		// Update existing
		DB.Model(&config).Updates(map[string]interface{}{
			"custom_commands": string(commandsJSON),
			"read_command":    "S",
		})
		log.Println("✅ Updated MT-SICS commands for 2QC-TMB-010")
	}
}
