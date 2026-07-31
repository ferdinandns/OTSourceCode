package helpers

import "time"

// DiffMinutes menghitung selisih menit antara dua waktu, mengembalikan nil jika salah satu nilai kosong.
func DiffMinutes(start, end *time.Time) *int {
	if start == nil || end == nil {
		return nil
	}
	diff := int(end.Sub(*start).Minutes())
	return &diff
}

// MaxDate mengembalikan tanggal terbesar dari dua input waktu.
func MaxDate(a, b *time.Time) *time.Time {
	if a == nil {
		return b
	}
	if b == nil {
		return a
	}
	if a.After(*b) {
		return a
	}
	return b
}

// FormatTime mengubah waktu menjadi format yang konsisten untuk dikirim ke frontend.
func FormatTime(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.Format("2006-01-02 15:04:05")
}
