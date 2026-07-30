package handlers

func rmToMap(
	statusProject, tglKirimCPro, tglTerimaTS, kodeItem, namaMaterial,
	manufacture, noBatchMaterial, rmTglKirimQC, rmTglKeluarHasilAnalisa,
	rmFisik, rmKimia, rmMikrobiologi, rmSensoriMaterial, rmCekKarakteristik,
	rmStatus, perluAnalisaAndev, andevKimia, andevVerifikasiMA, andevStatus,
	scaleUpKodeProduk, noBatchScaleUp, scaleUpStatus, tglDilakukanScaleUp,
	scaleUpTglKirimQC, scaleUpTglKeluarHasilAnalisa,
	linkFileDiversifikasi, kesimpulan string,
) map[string]string {
	return map[string]string{
		"status_project":                    statusProject,
		"tgl_kirim_cpro":                    tglKirimCPro,
		"tgl_terima_ts":                     tglTerimaTS,
		"kode_item":                         kodeItem,
		"nama_material":                     namaMaterial,
		"manufacture":                       manufacture,
		"no_batch_material":                 noBatchMaterial,
		"rm_tgl_kirim_qc":                   rmTglKirimQC,
		"rm_tgl_keluar_hasil_analisa":       rmTglKeluarHasilAnalisa,
		"rm_fisik":                          rmFisik,
		"rm_kimia":                          rmKimia,
		"rm_mikrobiologi":                   rmMikrobiologi,
		"rm_sensori_material":               rmSensoriMaterial,
		"rm_cek_karakteristik":              rmCekKarakteristik,
		"rm_status":                         rmStatus,
		"perlu_analisa_andev":               perluAnalisaAndev,
		"andev_kimia":                       andevKimia,
		"andev_verifikasi_ma":               andevVerifikasiMA,
		"andev_status":                      andevStatus,
		"scale_up_kode_produk":              scaleUpKodeProduk,
		"no_batch_scale_up":                 noBatchScaleUp,
		"scale_up_status":                   scaleUpStatus,
		"tgl_dilakukan_scale_up":            tglDilakukanScaleUp,
		"scale_up_tgl_kirim_qc":             scaleUpTglKirimQC,
		"scale_up_tgl_keluar_hasil_analisa": scaleUpTglKeluarHasilAnalisa,
		"link_file_diversifikasi":           linkFileDiversifikasi,
		"kesimpulan":                        kesimpulan,
	}
}
func pmToMap(
	statusProject, tglPenerimaan, kodeItem, namaMaterial, manufacture,
	noBatchMaterial, pmTglAnalisa, pmTglReport, pmHasilAnalisa, pmKeterangan,
	trialKodeProduk, trialNoBatch, trialHasilFinal,
	linkFileDiversifikasi, kesimpulan string,
) map[string]string {
	return map[string]string{
		"status_project":          statusProject,
		"tgl_penerimaan":          tglPenerimaan,
		"kode_item":               kodeItem,
		"nama_material":           namaMaterial,
		"manufacture":             manufacture,
		"no_batch_material":       noBatchMaterial,
		"pm_tgl_analisa":          pmTglAnalisa,
		"pm_tgl_report":           pmTglReport,
		"pm_hasil_analisa":        pmHasilAnalisa,
		"pm_keterangan":           pmKeterangan,
		"trial_kode_produk":       trialKodeProduk,
		"trial_no_batch":          trialNoBatch,
		"trial_hasil_final":       trialHasilFinal,
		"link_file_diversifikasi": linkFileDiversifikasi,
		"kesimpulan":              kesimpulan,
	}
}
func nullStr(v interface{}) string {
	if v == nil {
		return ""
	}
	return ""
}
