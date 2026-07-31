package jwt

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID        uint     `json:"user_id"`
	Roles         []string `json:"roles"`
	FullName      string   `json:"full_name"`
	DepartmetName string   `json:"department_name"`
	IsSupervisor  bool     `json:"is_supervisor"`
	Type          string   `json:"type"`
	jwt.RegisteredClaims
}

type Manager struct {
	secret          []byte
	accessTokenTTL  time.Duration
	refreshTokenTTL time.Duration
}

func NewManager(secret string, accessTTL, refreshTTL time.Duration) *Manager {
	return &Manager{
		secret:          []byte(secret),
		accessTokenTTL:  accessTTL,
		refreshTokenTTL: refreshTTL,
	}
}

func (m *Manager) GenerateTokenPair(userID uint, fullName, departmentName string, roles []string, isSupervisor bool) (access, refresh string, err error) {
	access, err = m.generate(userID, fullName, departmentName, roles, isSupervisor, "access", m.accessTokenTTL)
	if err != nil {
		return "", "", err
	}
	refresh, err = m.generate(userID, fullName, departmentName, roles, isSupervisor, "refresh", m.refreshTokenTTL)
	return access, refresh, err
}

func (m *Manager) generate(userID uint, fullName, departmentName string, roles []string, isSupervisor bool, tokenType string, ttl time.Duration) (string, error) {
	claims := &Claims{
		UserID:        userID,
		FullName:      fullName,
		DepartmetName: departmentName,
		Roles:         roles,
		IsSupervisor:  isSupervisor,
		Type:          tokenType,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(ttl)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secret)
}

func (m *Manager) Validate(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return m.secret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

func (m *Manager) GenerateWSToken(userID uint) (string, error) {
	// WS token: short-lived 30 detik, tidak perlu roles/isSupervisor
	// Type = "ws" agar tidak bisa dipakai sebagai access token biasa
	return m.generate(userID, "", "", nil, false, "ws", 30*time.Second)
}
