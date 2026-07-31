package upload

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"image/jpeg"
	_ "image/png"
	"io"
	"mime/multipart"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"golang.org/x/image/draw"
)

const MaxSizeMB = 1
const symbol = "%s_%d%s"

type Config struct {
	S3Endpoint  string
	S3AccessKey string
	S3SecretKey string
	S3Bucket    string
	S3Region    string
	BasePath    string
	BaseURL     string

	MaxInspectionMB int64
	MaxRepairMB     int64
}

type Uploader struct {
	cfg      Config
	s3Client *s3.Client
}

func New(cfg Config) (*Uploader, error) {
	awsCfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithRegion(cfg.S3Region),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.S3AccessKey, cfg.S3SecretKey, "")),
	)
	if err != nil {
		return nil, fmt.Errorf("gagal meload config s3: %w", err)
	}

	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(cfg.S3Endpoint)
		o.UsePathStyle = true // WAJIB untuk MinIO lokal
	})

	return &Uploader{
		cfg:      cfg,
		s3Client: client,
	}, nil
}

func (u *Uploader) SaveInspectionPhoto(ctx context.Context, file multipart.File, header *multipart.FileHeader, subDir string) (string, error) {
	data, err := io.ReadAll(io.LimitReader(file, 10*1024*1024))
	if err != nil {
		return "", fmt.Errorf("Failed to read file: %w", err)
	}

	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return "", fmt.Errorf("Invalid image: %w", err)
	}

	img = resizeIfNeeded(img, 1920, 1920)
	compressed, err := compressJPEG(img, u.cfg.MaxInspectionMB)
	if err != nil {
		return "", fmt.Errorf("Compression failed: %w", err)
	}

	ext := ".jpg"
	origName := strings.TrimSuffix(filepath.Base(header.Filename), filepath.Ext(header.Filename))
	filename := fmt.Sprintf(symbol, sanitize(origName), time.Now().UnixMilli(), ext)

	objectKey := filepath.Join(subDir, filename)
	objectKey = strings.ReplaceAll(objectKey, "\\", "/")

	// Upload gambar kompresi ke MinIO
	_, err = u.s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(u.cfg.S3Bucket),
		Key:         aws.String(objectKey),
		Body:        bytes.NewReader(compressed),
		ContentType: aws.String("image/jpeg"),
	})
	if err != nil {
		return "", fmt.Errorf("Failed to upload to S3: %w", err)
	}

	return objectKey, nil
}

// 2. FUNGSI UNTUK PERBAIKAN (Semua File, Tanpa Kompresi, Max 10MB)
func (u *Uploader) SaveRepairEvidence(ctx context.Context, file multipart.File, header *multipart.FileHeader, subDir string) (string, error) {
	// a. Validasi Ukuran File (Maksimal 10 MB)
	maxBytes := u.cfg.MaxRepairMB * 1024 * 1024

	if header.Size > maxBytes {
		return "", fmt.Errorf("ukuran file terlalu besar (maksimal %d MB), ukuran saat ini: %.2f MB", u.cfg.MaxRepairMB, float64(header.Size)/(1024*1024))
	}

	// b. Validasi Ekstensi File
	ext := strings.ToLower(filepath.Ext(header.Filename))
	allowedExts := map[string]bool{
		".jpg": true, ".jpeg": true, ".png": true,
		".pdf": true, ".doc": true, ".docx": true,
		".xls": true, ".xlsx": true,
	}

	if !allowedExts[ext] {
		return "", fmt.Errorf("ekstensi file %s tidak didukung untuk bukti perbaikan", ext)
	}

	// c. Generate Nama File Unik
	origName := strings.TrimSuffix(filepath.Base(header.Filename), ext)
	filename := fmt.Sprintf(symbol, sanitize(origName), time.Now().UnixMilli(), ext)

	objectKey := filepath.Join(subDir, filename)
	objectKey = strings.ReplaceAll(objectKey, "\\", "/")

	// d. Ambil Content Type
	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	// e. Upload Langsung (Streaming) ke MinIO
	_, err := u.s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(u.cfg.S3Bucket),
		Key:         aws.String(objectKey),
		Body:        file,
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return "", fmt.Errorf("gagal upload dokumen ke S3: %w", err)
	}

	return objectKey, nil
}

func (u *Uploader) URL(objectKey string) string {
	return fmt.Sprintf("%s/%s/%s", u.cfg.S3Endpoint, u.cfg.S3Bucket, objectKey)
}

func resizeIfNeeded(img image.Image, maxW, maxH int) image.Image {
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	if w <= maxW && h <= maxH {
		return img
	}
	scaleW := float64(maxW) / float64(w)
	scaleH := float64(maxH) / float64(h)
	scale := scaleW
	if scaleH < scaleW {
		scale = scaleH
	}
	newW := int(float64(w) * scale)
	newH := int(float64(h) * scale)
	dst := image.NewRGBA(image.Rect(0, 0, newW, newH))
	draw.BiLinear.Scale(dst, dst.Bounds(), img, img.Bounds(), draw.Over, nil)
	return dst
}

func compressJPEG(img image.Image, maxMB int64) ([]byte, error) {
	maxBytes := maxMB * 1024 * 1024
	quality := 92
	for quality >= 30 {
		var buf bytes.Buffer
		if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: quality}); err != nil {
			return nil, err
		}
		if int64(buf.Len()) <= maxBytes {
			return buf.Bytes(), nil
		}
		quality -= 8
	}
	var buf bytes.Buffer
	jpeg.Encode(&buf, img, &jpeg.Options{Quality: 30})
	return buf.Bytes(), nil
}

func sanitize(name string) string {
	replacer := strings.NewReplacer(" ", "_", "/", "_", "\\", "_", ":", "_")
	return replacer.Replace(name)
}

// SaveReviewAttachment menyimpan lampiran opsional dari reviewer (PDF, gambar, dll)
func (u *Uploader) SaveReviewAttachment(ctx context.Context, file multipart.File, header *multipart.FileHeader, subDir string) (string, error) {
	// Validasi ukuran — pakai MaxRepairMB karena kebutuhan sama
	maxBytes := u.cfg.MaxRepairMB * 1024 * 1024
	if header.Size > maxBytes {
		return "", fmt.Errorf("ukuran file terlalu besar (maksimal %d MB), ukuran saat ini: %.2f MB", u.cfg.MaxRepairMB, float64(header.Size)/(1024*1024))
	}

	// Validasi ekstensi
	ext := strings.ToLower(filepath.Ext(header.Filename))
	allowedExts := map[string]bool{
		".jpg": true, ".jpeg": true, ".png": true,
		".pdf": true, ".doc": true, ".docx": true,
		".xls": true, ".xlsx": true,
	}
	if !allowedExts[ext] {
		return "", fmt.Errorf("ekstensi file %s tidak didukung untuk lampiran review", ext)
	}

	// Generate nama file unik
	origName := strings.TrimSuffix(filepath.Base(header.Filename), ext)
	filename := fmt.Sprintf(symbol, sanitize(origName), time.Now().UnixMilli(), ext)

	objectKey := filepath.Join(subDir, filename)
	objectKey = strings.ReplaceAll(objectKey, "\\", "/")

	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	_, err := u.s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(u.cfg.S3Bucket),
		Key:         aws.String(objectKey),
		Body:        file,
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return "", fmt.Errorf("gagal upload lampiran review ke S3: %w", err)
	}

	return objectKey, nil
}

func (u *Uploader) DownloadFile(ctx context.Context, key string) (io.ReadCloser, error) {
	output, err := u.s3Client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(u.cfg.S3Bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, fmt.Errorf("gagal download file dari S3: %w", err)
	}
	return output.Body, nil
}
