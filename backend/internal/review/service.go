package review

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"emertrack/internal/domain"
	"emertrack/pkg/upload"
	"emertrack/pkg/ws"

	"github.com/jung-kurt/gofpdf/v2"
)

const (
	menuReview = "Verifikasi Perbaikan"
	id         = "id = ?"
)

type reviewService struct {
	reviewRepo  domain.ReviewRepository
	sarprasRepo domain.SarprasRepository
	repairSvc   domain.RepairService
	uploader    *upload.Uploader
}

func NewService(
	reviewRepo domain.ReviewRepository,
	sarprasRepo domain.SarprasRepository,
	repairSvc domain.RepairService,
	uploader *upload.Uploader,
) domain.ReviewService {
	return &reviewService{
		reviewRepo:  reviewRepo,
		sarprasRepo: sarprasRepo,
		repairSvc:   repairSvc,
		uploader:    uploader,
	}
}

func (s *reviewService) ListPendingReviews(ctx context.Context, filter domain.ReviewFilter) ([]domain.ReviewRow, int64, error) {
	return s.reviewRepo.ListPendingReviews(ctx, filter)
}

func (s *reviewService) GetReviewDetail(ctx context.Context, repairOrderID uint) (*domain.ReviewDetailResponse, error) {
	return s.reviewRepo.GetReviewDetail(ctx, repairOrderID)
}

func (s *reviewService) SubmitReview(ctx context.Context, repairOrderID uint, reviewerID uint, req domain.ReviewSubmitRequest) error {
	if err := s.validateReviewRequest(req); err != nil {
		return err
	}

	order, err := s.reviewRepo.GetRepairOrderForReview(ctx, repairOrderID)
	if err != nil {
		return fmt.Errorf("gagal mengambil repair order: %w", err)
	}

	if order.Status != domain.RepairSubmitted && order.Status != domain.RepairInReview {
		return errors.New("hanya repair order dengan status 'submitted' atau 'in_review' yang dapat direview")
	}

	if err := s.reviewRepo.SubmitCompleteReview(ctx, repairOrderID, reviewerID, req); err != nil {
		return err
	}

	go func() {
		var notifStatus domain.RepairStatus
		if req.Verdict == domain.ReviewApprove {
			notifStatus = domain.RepairApproved
		} else {
			notifStatus = domain.RepairRejected
		}
		_ = s.repairSvc.NotifyPICAboutReviewResult(context.Background(), repairOrderID, order.PICID, notifStatus, req.Feedback)
	}()

	s.broadcastUpdates()
	return nil
}

func (s *reviewService) ClaimReview(ctx context.Context, repairOrderID uint, reviewerID uint) error {
	if err := s.reviewRepo.ClaimReview(ctx, repairOrderID, reviewerID); err != nil {
		return err
	}

	go ws.BroadcastReviewUpdated()
	return nil
}

func (s *reviewService) CancelClaimReview(ctx context.Context, repairOrderID uint, reviewerID uint) error {
	if err := s.reviewRepo.CancelClaimReview(ctx, repairOrderID, reviewerID); err != nil {
		return err
	}

	go ws.BroadcastReviewUpdated()
	return nil
}

func (s *reviewService) GetReviewSummary(ctx context.Context) (*domain.ReviewSummary, error) {
	return s.reviewRepo.GetReviewSummary(ctx)
}

func (s *reviewService) validateReviewRequest(req domain.ReviewSubmitRequest) error {
	if req.Feedback == "" {
		return errors.New("feedback wajib diisi sebelum memberikan keputusan review")
	}
	return nil
}

func (s *reviewService) GetReviewHistory(ctx context.Context, repairOrderID uint) ([]domain.ReviewOrder, error) {
	reviews, _, err := s.reviewRepo.ListReviewsByRepairOrderID(ctx, repairOrderID, 1000, 0)
	return reviews, err
}

func (s *reviewService) ListReviewsByRepairOrderID(ctx context.Context, repairOrderID uint, limit, offset int) ([]domain.ReviewOrder, int64, error) {
	return s.reviewRepo.ListReviewsByRepairOrderID(ctx, repairOrderID, limit, offset)
}

func (s *reviewService) ListQSHistory(ctx context.Context, reviewerID uint, filter domain.ReviewHistoryFilter) ([]domain.ReviewHistoryRow, int64, error) {
	return s.reviewRepo.ListQSHistory(ctx, reviewerID, filter)
}

func (s *reviewService) GetHistoryDetail(ctx context.Context, reviewID uint) (*domain.ReviewHistoryDetail, error) {
	return s.reviewRepo.GetReviewHistoryDetail(ctx, reviewID)
}

const (
	pageW      = 180.0
	colLabel   = 45.0
	colValue   = pageW - colLabel
	rowH       = 6.5
	sectionGap = 5.0
)

func (s *reviewService) ExportHistory(ctx context.Context, reviewerID uint, filter domain.ReviewHistoryFilter) ([]byte, string, error) {
	details, err := s.reviewRepo.GetAllHistoryForExport(ctx, reviewerID, filter)
	if err != nil {
		return nil, "", err
	}
	if len(details) == 0 {
		return nil, "", errors.New("tidak ada data untuk diekspor")
	}

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 20, 15)
	pdf.SetAutoPageBreak(true, 25)

	pdf.SetHeaderFunc(func() {
		pdf.SetFont("Helvetica", "B", 13)
		pdf.SetFillColor(30, 80, 160)
		pdf.SetTextColor(255, 255, 255)
		pdf.CellFormat(pageW, 10, "Laporan Riwayat Review QS", "", 1, "C", true, 0, "")
		pdf.SetTextColor(0, 0, 0)
		pdf.SetFont("Helvetica", "I", 8)
		pdf.SetTextColor(120, 120, 120)
		pdf.CellFormat(pageW, 5, fmt.Sprintf("Dicetak pada: %s", time.Now().Format("02 Jan 2006, 15:04:05")), "", 1, "R", false, 0, "")
		pdf.SetTextColor(0, 0, 0)
		pdf.Ln(3)
	})

	pdf.SetFooterFunc(func() {
		pdf.SetY(-15)
		pdf.SetFont("Helvetica", "I", 8)
		pdf.SetTextColor(150, 150, 150)
		pdf.CellFormat(pageW, 5, fmt.Sprintf("Halaman %d", pdf.PageNo()), "", 0, "C", false, 0, "")
		pdf.SetTextColor(0, 0, 0)
	})

	pdf.AddPage()

	for idx, d := range details {
		if idx > 0 {
			pdf.AddPage()
		}
		s.renderReviewCard(ctx, pdf, d, idx+1)
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, "", err
	}

	filename := fmt.Sprintf("review_history_%s.pdf", time.Now().Format("2006-01-02"))
	return buf.Bytes(), filename, nil
}

func (s *reviewService) renderReviewCard(ctx context.Context, pdf *gofpdf.Fpdf, d domain.ReviewHistoryDetail, num int) {
	pdf.SetFillColor(240, 244, 255)
	pdf.SetFont("Helvetica", "B", 11)
	pdf.CellFormat(pageW, 8,
		fmt.Sprintf("  #%d  %s  (%s)", num, d.SarprasName, d.SarprasCode),
		"LBR", 1, "L", true, 0, "")
	pdf.Ln(2)

	infoRows := []struct{ label, value string }{
		{"Departemen", d.DepartmentName},
		{"Keputusan", verdictLabel(d.Verdict)},
		{"Reviewer", d.ReviewerName},
		{"Tanggal Review", d.ReviewedAt.Format("02 Jan 2006, 15:04")},
	}

	for _, row := range infoRows {
		pdf.SetFont("Helvetica", "B", 9)
		pdf.SetFillColor(248, 249, 252)
		pdf.CellFormat(colLabel, rowH, row.label, "1", 0, "L", true, 0, "")
		pdf.SetFont("Helvetica", "", 9)
		pdf.SetFillColor(255, 255, 255)
		pdf.CellFormat(colValue, rowH, row.value, "1", 1, "L", true, 0, "")
	}
	pdf.Ln(sectionGap)

	s.renderSectionBlock(pdf, "Feedback", d.Feedback)
	s.renderSectionBlock(pdf, "Action Plan", d.ActionPlan)

	if len(d.NOKDetails) > 0 {
		s.renderSectionHeader(pdf, "Parameter NOK")
		for i, nok := range d.NOKDetails {
			pdf.SetFont("Helvetica", "B", 9)
			pdf.CellFormat(pageW, rowH,
				fmt.Sprintf("  %d. %s", i+1, nok.ParameterName),
				"LR", 1, "L", false, 0, "")
			if nok.Notes != "" {
				pdf.SetFont("Helvetica", "", 9)
				pdf.SetLeftMargin(20)
				pdf.MultiCell(pageW-5, 5, nok.Notes, "", "L", false)
				pdf.SetLeftMargin(15)
			}
			if nok.PhotoURL != "" {
				s.tryRenderImage(ctx, pdf, nok.PhotoURL, 50)
			}
		}
		pdf.CellFormat(pageW, 0, "", "LBR", 1, "", false, 0, "")
		pdf.Ln(sectionGap)
	}

	if len(d.EvidencePaths) > 0 {
		s.renderSectionHeader(pdf, "Lampiran Evidence")
		for i, ev := range d.EvidencePaths {
			if isImageFile(ev) {
				pdf.SetFont("Helvetica", "I", 8)
				pdf.CellFormat(pageW, 5, fmt.Sprintf("  Gambar %d:", i+1), "LR", 1, "L", false, 0, "")
				s.tryRenderImage(ctx, pdf, ev, 60)
			} else {
				fullURL := buildMinioURL(ev)
				pdf.SetFont("Helvetica", "", 9)
				pdf.SetTextColor(30, 80, 160)
				pdf.CellFormat(pageW, rowH,
					fmt.Sprintf("  %d. %s", i+1, fullURL),
					"LR", 1, "L", false, 0, "")
				pdf.SetTextColor(0, 0, 0)
			}
		}
		pdf.CellFormat(pageW, 0, "", "LBR", 1, "", false, 0, "")
		pdf.Ln(sectionGap)
	}

	pdf.SetDrawColor(180, 180, 200)
	pdf.Line(15, pdf.GetY(), 195, pdf.GetY())
	pdf.Ln(6)
}

func (s *reviewService) renderSectionBlock(pdf *gofpdf.Fpdf, title, content string) {
	if content == "" {
		content = "-"
	}
	s.renderSectionHeader(pdf, title)
	pdf.SetFont("Helvetica", "", 9)
	pdf.SetLeftMargin(17)
	pdf.MultiCell(pageW-2, 5, content, "LR", "L", false)
	pdf.SetLeftMargin(15)
	pdf.CellFormat(pageW, 0, "", "LBR", 1, "", false, 0, "")
	pdf.Ln(sectionGap)
}

func (s *reviewService) renderSectionHeader(pdf *gofpdf.Fpdf, title string) {
	pdf.SetFont("Helvetica", "B", 9)
	pdf.SetFillColor(220, 230, 255)
	pdf.CellFormat(pageW, 6, "  "+title, "1", 1, "L", true, 0, "")
}

func (s *reviewService) tryRenderImage(ctx context.Context, pdf *gofpdf.Fpdf, path string, size float64) {
	imgData, err := s.downloadImage(ctx, path)
	if err != nil {
		s.renderImageFallback(pdf, path, "Gagal memuat")
		return
	}

	_, pageH := pdf.GetPageSize()
	_, _, _, marginBottom := pdf.GetMargins()
	bottomLimit := pageH - marginBottom
	neededSpace := size + 6

	if pdf.GetY()+neededSpace > bottomLimit {
		pdf.AddPage()
	}

	x := pdf.GetX() + 5
	y := pdf.GetY() + 2
	if addErr := s.addImageToPDF(pdf, imgData, path, x, y, size, size); addErr != nil {
		s.renderImageFallback(pdf, path, "Gagal menampilkan")
		return
	}
	pdf.Ln(size + 4)
}

func (s *reviewService) renderImageFallback(pdf *gofpdf.Fpdf, path, reason string) {
	pdf.SetFont("Helvetica", "I", 8)
	pdf.SetTextColor(180, 60, 60)
	pdf.CellFormat(pageW, 5,
		fmt.Sprintf("  [%s: %s]", reason, filepath.Base(path)),
		"LR", 1, "L", false, 0, "")
	pdf.SetTextColor(0, 0, 0)
}

func verdictLabel(v string) string {
	switch strings.ToUpper(v) {
	case "APPROVE", "APPROVED":
		return "Disetujui"
	case "REJECT", "REJECTED":
		return "Ditolak"
	default:
		return v
	}
}

func isImageFile(path string) bool {
	ext := strings.ToLower(filepath.Ext(path))
	imageExts := map[string]bool{
		".jpg": true, ".jpeg": true,
		".png":  true,
		".gif":  true,
		".bmp":  true,
		".webp": true,
	}
	return imageExts[ext]
}

func buildMinioURL(path string) string {
	if strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://") {
		return path
	}

	endpoint := strings.TrimRight(os.Getenv("S3_ENDPOINT"), "/")
	bucket := os.Getenv("S3_BUCKET")
	key := strings.TrimLeft(path, "/")

	return fmt.Sprintf("%s/%s/%s", endpoint, bucket, key)
}

func (s *reviewService) addImageToPDF(pdf *gofpdf.Fpdf, data []byte, path string, x, y, w, h float64) error {
	ext := strings.ToLower(filepath.Ext(path))
	if ext == "" || ext == "." {
		ext = "jpg"
	} else {
		ext = strings.TrimPrefix(ext, ".")
	}

	tmpFile, err := os.CreateTemp("", "pdf_img_*."+ext)
	if err != nil {
		return err
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.Write(data); err != nil {
		tmpFile.Close()
		return err
	}
	tmpFile.Close()

	imgType := "JPEG"
	switch ext {
	case "png":
		imgType = "PNG"
	case "gif":
		imgType = "GIF"
	case "webp":
		pdf.SetFont("Helvetica", "", 10)
		pdf.Cell(0, 5, fmt.Sprintf("🖼️ Gambar: %s (format WebP tidak didukung)", filepath.Base(path)))
		pdf.Ln(6)
		return nil
	}

	pdf.Image(tmpFile.Name(), x, y, w, h, false, imgType, 0, "")
	return nil
}

func (s *reviewService) downloadImage(ctx context.Context, path string) ([]byte, error) {
	if strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://") {
		resp, err := http.Get(path)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		return io.ReadAll(resp.Body)
	}

	if s.uploader == nil {
		return nil, errors.New("uploader not initialized")
	}
	reader, err := s.uploader.DownloadFile(ctx, path)
	if err != nil {
		return nil, err
	}
	defer reader.Close()
	return io.ReadAll(reader)
}

func (s *reviewService) broadcastUpdates() {
	go ws.BroadcastReviewUpdated()
	go ws.BroadcastSarprasUpdated()
}
