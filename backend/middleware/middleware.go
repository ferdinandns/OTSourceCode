package middleware

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

func TraceMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tid := c.GetHeader("X-Request-ID")
		if tid == "" {
			tid = uuid.New().String()
		}
		c.Set("traceID", tid)
		c.Header("X-Request-ID", tid)
		c.Next()
	}
}

func TraceID(c *gin.Context) string {
	v, _ := c.Get("traceID")
	if v == nil {
		return "-"
	}
	return fmt.Sprintf("%v", v)
}

func LoggerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		log.Printf(
			"[HTTP] traceID=%s method=%s path=%s status=%d latency=%s ip=%s",
			TraceID(c),
			c.Request.Method,
			c.Request.URL.Path,
			c.Writer.Status(),
			time.Since(start).Round(time.Millisecond),
			c.ClientIP(),
		)
	}
}

func RecoveryMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[PANIC] traceID=%s recovered: %v", TraceID(c), r)
				c.AbortWithStatusJSON(http.StatusInternalServerError, APIError{
					Code:    "INTERNAL_ERROR",
					Message: "Terjadi kesalahan tidak terduga pada server",
					TraceID: TraceID(c),
				})
			}
		}()
		c.Next()
	}
}

func SecurityHeadersMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Cache-Control", "no-store")
		c.Next()
	}
}

func RequestSizeLimiter(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
		c.Next()
	}
}

type IPRateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*visitor
	rate     int
	window   time.Duration
}

type visitor struct {
	count    int
	windowAt time.Time
}

func NewIPRateLimiter(rate int, window time.Duration) *IPRateLimiter {
	l := &IPRateLimiter{
		visitors: make(map[string]*visitor),
		rate:     rate,
		window:   window,
	}
	go l.cleanup()
	return l
}

func (l *IPRateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		if l.exceeded(ip) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, APIError{
				Code:    "RATE_LIMITED",
				Message: "Terlalu banyak permintaan, coba lagi nanti",
				TraceID: TraceID(c),
			})
			return
		}
		c.Next()
	}
}

func (l *IPRateLimiter) exceeded(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	v, ok := l.visitors[ip]
	if !ok || now.After(v.windowAt.Add(l.window)) {
		l.visitors[ip] = &visitor{count: 1, windowAt: now}
		return false
	}
	v.count++
	return v.count > l.rate
}

func (l *IPRateLimiter) cleanup() {
	ticker := time.NewTicker(5 * l.window)
	defer ticker.Stop()
	for range ticker.C {
		l.mu.Lock()
		cutoff := time.Now().Add(-l.window)
		for ip, v := range l.visitors {
			if v.windowAt.Before(cutoff) {
				delete(l.visitors, ip)
			}
		}
		l.mu.Unlock()
	}
}

type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	TraceID string `json:"traceId,omitempty"`
}

func RespondError(c *gin.Context, status int, code, message string) {
	c.AbortWithStatusJSON(status, APIError{
		Code:    code,
		Message: message,
		TraceID: TraceID(c),
	})
}

func RespondOK(c *gin.Context, data any) {
	c.JSON(http.StatusOK, gin.H{"data": data})
}

func OpenDB(dsn string) (*sql.DB, error) {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("sql.Open: %w", err)
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)
	db.SetConnMaxIdleTime(2 * time.Minute)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("db.Ping: %w", err)
	}
	return db, nil
}
