package helpers

import (
	"lab-connect/backend-api/config"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var jwtKey = []byte(config.GetEnv("JWT_SECRET", "secret_key"))

// GenerateJWT berfungsi untuk membuat token JWT
func GenerateToken(username string) string {

	//mengatur waktu kadaluarsa token (1 jam dari sekarang)
	expirationTime := time.Now().Add(8 * time.Hour)

	//membuat klaim token
	claims := &jwt.RegisteredClaims{
		Subject:   username,
		ExpiresAt: jwt.NewNumericDate(expirationTime),
	}

	//membuat token dengan klaim yang telah dibuat
	//menggunakan algoritma HS256
	token, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(jwtKey)

	return token
}
