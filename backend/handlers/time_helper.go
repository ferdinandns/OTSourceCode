package handlers

import "time"

var wib, _ = time.LoadLocation("Asia/Jakarta")

func formatWIB(t time.Time) string {
	return t.In(wib).Format(time.RFC3339)
}

func todayWIB() time.Time {
	now := time.Now().In(wib)
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, wib)
}

func startOfDayWIB(t time.Time) time.Time {
	tWIB := t.In(wib)
	return time.Date(tWIB.Year(), tWIB.Month(), tWIB.Day(), 0, 0, 0, 0, wib)
}
