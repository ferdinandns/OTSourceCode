# Batch Tracker System - Backend API (Go)

Batch Tracker System adalah aplikasi untuk melacak pergerakan batch produk dalam berbagai tahap manufaktur, dari persiapan bahan baku (PPIC) hingga produk akhir dikirim (Shipment). Repository ini berisi kode untuk sisi Backend API yang dibangun menggunakan bahasa pemrograman Go (Golang) dan framework Gin.

## Arsitektur Sistem

Aplikasi ini menggunakan pola arsitektur berbasis layer (layered architecture) yang terinspirasi dari Model-View-Controller (MVC) yang diadaptasi untuk pengembangan API RESTful di Go.

*   **`models/`**: Mendefinisikan representasi struktur data (schema) tabel database menggunakan ORM (GORM), serta struktur payload Request dan Response.
*   **`handlers/`**: Berfungsi sebagai pengontrol rute HTTP (Controllers). Mengambil HTTP context dari framework `gin`, mem-parsing JSON payload, mengekstrak informasi otorisasi dari JWT, dan merutekan tugas ke Service yang tepat.
*   **`services/`**: Tempat logika bisnis utama dijalankan. Di sini diletakkan operasi database transaksional (seperti menggeser state batch ke tahap selanjutnya), penulisan _audit trail_, dan penghitungan metrik _lead time_. Layer ini dipisahkan agar satu handler bisa menggunakan lebih dari satu service, dan mempermudah unit-testing logika bisnis tanpa harus me-mock HTTP context.
*   **`routes/`**: Tempat mendaftarkan path API (misal `/api/v1/ppic/kirim`) dan menghubungkannya dengan handler serta middleware yang relevan.
*   **`middleware/`**: Menangani pra-pemrosesan setiap request, terutama untuk keperluan otentikasi (Auth JWT) dan pengecekan akses (RBAC).

**Alur Logika Transisi Batch:**
Setiap kali status batch bergeser (misal: dari "Potong Stock" ke "Validasi 1 Warehouse"), *service layer* akan mengeksekusi proses dalam satu block **DB Transaction** yang atomic:
1. Update `tb_work_orders` (mengubah timestamp kolom tertentu yang menandakan selesainya proses).
2. Insert catatan histori ke `tb_admin_audit_trail`.
3. Mengupdate log identitas eksekutor (CreatedBy) dan Keterangan operasional.

## Panduan Setup Instalasi Lokal

### Prasyarat (Prerequisites)
1. **Go** (versi 1.25 atau lebih baru). Unduh di [golang.org](https://go.dev/).
2. **Database PostgreSQL** (atau database SQL lain yang didukung GORM dan sesuai dengan konfigurasi proyek).

### Langkah-langkah Menjalankan Lokal

1. **Clone repository & masuk ke direktori proyek:**
   ```bash
   cd c:\...\migrasi_batch_tracker
   ```

2. **Siapkan konfigurasi `.env`:**
   Pastikan terdapat file `.env` di direktori root. File ini harus berisi kredensial koneksi ke database aplikasi dan database eksternal (weightrack). Contoh isian:
   ```env
   DB_HOST=localhost
   DB_USER=postgres
   DB_PASSWORD=secret
   DB_NAME=batch_tracker_db
   DB_PORT=5432
   
   # Konfigurasi Weightrack DB
   WEIGHTRACK_DB_HOST=...
   ...
   ```

3. **Install Dependencies:**
   Secara otomatis modul Go dapat diunduh dengan perintah:
   ```bash
   go mod tidy
   ```

4. **Jalankan Aplikasi:**
   Kompilasi dan jalankan secara langsung:
   ```bash
   go run main.go
   ```
   Atau untuk membuat file executable (build):
   ```bash
   ./build.bat # Untuk Windows
   ```
   Server secara default akan berjalan di port tertentu sesuai .env (biasanya tertulis di terminal saat start, misalnya `http://localhost:8080`).

## Dokumentasi Singkat Interaksi API

Aplikasi ini menggunakan tipe autentikasi token JWT (JSON Web Token).
Sebagian besar endpoint memerlukan Bearer Token pada header request:
```
Authorization: Bearer <token_jwt_anda>
```

Berikut adalah contoh interaksi payload:

### 1. Endpoint Aksi (State Transition)
Digunakan untuk memajukan status batch. Mayoritas menerima format JSON seragam (ID tunggal atau array).
*   **POST** `/api/v1/action/kirim-ppic`
    *   **Payload:** `{"id": [1, 2, 3], "ket": "Catatan tambahan"}`
*   **POST** `/api/v1/action/compounding`
    *   **Payload:** `{"id": 1, "tank_id": 5, "ket": "Mulai mixing"}`

### 2. Endpoint Data View
Digunakan untuk menampilkan daftar batch pada stage tertentu. Tidak membutuhkan payload POST.
*   **GET** `/api/v1/view/ppic`
*   **GET** `/api/v1/view/potong-stock`
*   **Response Standar:**
    ```json
    {
      "meta": {
        "code": 200,
        "message": "Data dimuat",
        "status": "success",
        "count": 10
      },
      "data": [
        { "id": 1, "no_batch": "B123", "kode_ruah": "R001", "lead_time": 120.5 }
      ]
    }
    ```

> Untuk detail rute penuh, silakan merujuk pada file `routes/route.go`.
