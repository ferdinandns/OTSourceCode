package email

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"
	"strings"
	"time"
)

type Config struct {
	Host     string
	Port     int
	Username string
	Password string
	From     string
	LogoURL string
}

type Mailer struct {
	cfg Config
}

func New(cfg Config) *Mailer {
	return &Mailer{cfg: cfg}
}

func (m *Mailer) Send(to, subject, body string) error {
	return m.SendHTML(to, subject, plainToHTML(subject, body, m.cfg.LogoURL))
}

func (m *Mailer) SendHTML(to, subject, htmlBody string) error {
	msg := buildMessage(m.cfg.From, to, subject, htmlBody)
	addr := fmt.Sprintf("%s:%d", m.cfg.Host, m.cfg.Port)

	tlsCfg := &tls.Config{
		ServerName: m.cfg.Host,
		MinVersion: tls.VersionTLS12,
	}

	conn, err := net.DialTimeout("tcp", addr, 10*time.Second)
	if err != nil {
		return fmt.Errorf("Failed to connect SMTP: %w", err)
	}

	client, err := smtp.NewClient(conn, m.cfg.Host)
	if err != nil {
		return fmt.Errorf("Failed to create SMTP Client: %w", err)
	}
	defer client.Close()

	if err = client.StartTLS(tlsCfg); err != nil {
		return fmt.Errorf("STARTTLS failed: %w", err)
	}

	auth := smtp.PlainAuth("", m.cfg.Username, m.cfg.Password, m.cfg.Host)
	if err = client.Auth(auth); err != nil {
		return fmt.Errorf("SMTP Auth Failed %w", err)
	}

	if err = client.Mail(m.cfg.From); err != nil {
		return err
	}
	if err = client.Rcpt(to); err != nil {
		return err
	}

	wc, err := client.Data()
	if err != nil {
		return err
	}

	defer wc.Close()

	_, err = fmt.Fprint(wc, msg)
	return err
}

func buildMessage(from, to, subject, htmlBody string) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("From: EMERTRACK <%s>\r\n", from))
	sb.WriteString(fmt.Sprintf("To: %s\r\n", to))
	sb.WriteString(fmt.Sprintf("Subject: %s\r\n", subject))
	sb.WriteString(fmt.Sprintf("MIME-Version: 1.0\r\n"))
	sb.WriteString(fmt.Sprintf("Content-Type: text/html; charset=UTF-8\r\n"))
	sb.WriteString("\r\n")
	sb.WriteString(htmlBody)
	return sb.String()
}

// plainToHTML wraps a plain-text body into a formal, branded HTML email that
// mirrors the EMERTRACK dashboard's navy (#003d7a) theme.
func plainToHTML(subject, body, logoURL string) string {
	lines := strings.Split(body, "\n")
	var paras strings.Builder
	for _, line := range lines {
		if line == "" {
			paras.WriteString(`<div style="height:12px;"></div>`)
		} else {
			paras.WriteString(fmt.Sprintf(`<p style="margin:0 0 12px;line-height:1.6;color:#334155;">%s</p>`, line))
		}
	}

	logoBlock := `<h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:800;letter-spacing:0.06em;">EMERTRACK</h1>`
	if logoURL != "" {
		logoBlock = fmt.Sprintf(`<img src="%s" alt="EMERTRACK" style="height:32px;object-fit:contain;display:block;">`, logoURL)
	}

	return fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#1e293b;background:#f4f7f9;">
  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">

          <!-- Header -->
          <tr>
            <td style="background:#003d7a;padding:24px 32px;">
              %s
              <p style="margin:6px 0 0;color:#a9c2e0;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;">Emergency Tracking System</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 20px;font-size:17px;font-weight:700;color:#0f172a;">%s</h2>
              <div style="margin-bottom:8px;">
                %s
              </div>
              <p style="margin:24px 0 0;line-height:1.6;color:#64748b;font-size:13px;">
                Mohon untuk segera menindaklanjuti informasi di atas sesuai dengan prosedur yang berlaku. Jika Anda memiliki pertanyaan lebih lanjut, silakan hubungi administrator sistem EMERTRACK.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#eef4fa;padding:20px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#003d7a;">EMERTRACK</p>
              <p style="margin:0;font-size:11px;line-height:1.6;color:#64748b;">
                Email ini dikirim secara otomatis oleh sistem EMERTRACK. Mohon tidak membalas email ini secara langsung.
              </p>
            </td>
          </tr>

        </table>
        <p style="margin:16px 0 0;font-size:11px;color:#94a3b8;">© %s EMERTRACK. All rights reserved.</p>
      </td>
    </tr>
  </table>
</body>
</html>`, logoBlock, subject, paras.String(), currentYear())
}

func currentYear() string {
	return time.Now().Format("2006")
}