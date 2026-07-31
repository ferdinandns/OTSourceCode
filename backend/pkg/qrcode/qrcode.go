package qrcode

import (
	"encoding/base64"
	"github.com/skip2/go-qrcode"
)

func GenerateBase64(content string) (string, error) {
	var png []byte
	png, err := qrcode.Encode(content, qrcode.Medium, 256)
	if err != nil {
		return "", err
	}

	return base64.StdEncoding.EncodeToString(png), nil
}
