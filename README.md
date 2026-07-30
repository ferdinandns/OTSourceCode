# Sparepart Management System

Sistem manajemen sparepart berbasis web dengan Golang, PostgreSQL, Tailwind CSS, Alpine.js, dan HTMX.

---

## Tech Stack

| Layer       | Library/Tool                        |
|-------------|-------------------------------------|
| Web Server  | Gin v1.10                           |
| Database    | PostgreSQL via pgx/v5               |
| Session     | gorilla/sessions (cookie-based)     |
| Templates   | html/template (Go standard library) |
| PDF         | chromedp (headless Chrome)          |
| CSS         | Tailwind CSS + daisyUI (npm build)  |
| JS          | Alpine.js + HTMX (npm build)        |

---

## Prasyarat

- Go 1.22+
- PostgreSQL 14+
- Node.js 18+ & npm
- Google Chrome / Chromium (untuk PDF generation via chromedp)
