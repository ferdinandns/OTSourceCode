# Frontend NextJS - BatchTrack System

Aplikasi frontend untuk **BatchTrack System** yang dibangun menggunakan **NextJS 16** (App Router), **React 19**, **TailwindCSS**, dan **shadcn/ui**. Aplikasi ini merupakan hasil migrasi dari sistem lama (Laravel) menuju arsitektur modern (Golang + NextJS) untuk meningkatkan performa dan skalabilitas dalam melacak *leadtime* tiap proses produksi/batch.

---

## 🏛 Arsitektur Sistem

Aplikasi ini menggunakan pola **Client-Server terpisah**, di mana frontend NextJS berinteraksi sepenuhnya dengan backend API Golang (Microservices/REST API).

### 1. Struktur Folder (App Router)
- **`app/`**: Berisi routing utama aplikasi.
  - `(auth)`: Route group untuk halaman publik seperti `/login`.
  - `(dashboard)`: Route group terproteksi yang menggunakan `layout.tsx` khusus untuk menampilkan Sidebar, Topbar, dan mengecek otorisasi pengguna.
- **`components/`**: Berisi komponen-komponen UI yang dapat digunakan kembali.
  - `sessionManager.tsx`: Komponen krusial (berjalan secara *headless* di root layout) yang mengatur lifecycle token, memantau *idle timeout*, dan me-*refresh* token secara otomatis di latar belakang.
- **`lib/`**: Berisi *helper* dan *utility* terpusat.
  - `api.ts`: *Wrapper* sentral untuk `fetch()` bawaan. Semua *request* ke backend harus melewati modul ini agar header `Authorization` (JWT) otomatis disematkan, dan error 401 (Unauthorized) otomatis memicu event kedaluwarsa sesi secara global.
  - `jwt.ts` & `access.ts`: Modul untuk mendekode isi token di sisi klien dan mengurus *Role-Based Access Control* (RBAC) agar UI bisa menyembunyikan/menampilkan menu yang sesuai tanpa terus menerus memanggil API (Stateful UI).

### 2. Alur Data & State
Frontend bersifat **Stateless** terhadap autentikasi; sumber kebenaran (source of truth) tetap ada di Backend Go. Frontend hanya menyimpan JWT ke dalam HTTP-only Cookie (atau Standard Cookie yang diset via backend/frontend) dan membacanya untuk keperluan render kondisi UI yang cepat.

---

## 🚀 Panduan Setup Instalasi Lokal

Ikuti langkah-langkah di bawah ini untuk menjalankan frontend di mesin lokal Anda:

### Prasyarat
- Node.js versi 20 atau lebih baru (Disarankan menggunakan NVM).
- Backend Go (berjalan di port tertentu, misal: `:8011`).

### Langkah-langkah
1. **Clone repositori dan masuk ke direktori proyek:**
   ```bash
   git clone <repo-url>
   cd frontend-nextjs-pct
   ```

2. **Install Dependensi:**
   ```bash
   npm install
   ```

3. **Konfigurasi Environment Variable:**
   Buat file `.env.local` di root direktori (jika belum ada) dan sesuaikan URL API mengarah ke Backend Go lokal Anda:
   ```env
   NEXT_PUBLIC_API_BASE_URL=http://localhost:8011
   ```

4. **Jalankan Server Development:**
   ```bash
   npm run dev
   ```
   *Aplikasi akan berjalan di `http://localhost:8005` (Berdasarkan `package.json` Anda: `next start -p 8005` untuk production atau dev default port 3000)*

5. **Build untuk Production:**
   ```bash
   npm run build
   npm run start
   ```
   **Catatan Deployment Windows (`build.bat`)**: 
   Jika Anda akan men-*deploy* aplikasi ini di server Windows secara mandiri, Anda dapat menjalankan script `build.bat` yang telah disediakan di root direktori. Script ini melakukan hal berikut:
   - Menjalankan `npm run build` yang dikonfigurasi untuk mengeluarkan hasil *build* tipe `standalone` (diatur di `next.config.ts`).
   - Menyalin folder `public` dan `.next/static` secara otomatis ke dalam direktori `.next/standalone`.
   - Menghasilkan folder deployment ringan yang tidak lagi bergantung pada *folder* `node_modules` global, sehingga lebih mudah dikompres dan dipindahkan ke server target.

---

## 🔌 Interaksi API (Frontend & Backend Go)

Interaksi dengan backend Golang diatur secara ketat melalui JWT (JSON Web Token) dan konsep *Gateway/Interceptor* sederhana di frontend:

1. **Autentikasi (Login)**: 
   - User memasukkan kredensial, dikirim ke `/api/v1/login`.
   - Backend memvalidasi ke DB (SQL Server). Jika sukses, backend mengembalikan `token` (JWT).
   - Frontend menyimpan token beserta metadata user (`nama`, `level`, `area`) ke dalam Cookie untuk dibaca oleh `SessionManager` dan `Sidebar`.

2. **Pemanggilan Endpoint Privat**:
   - Seluruh endpoint privat di-fetch menggunakan `apiFetch()` dari `lib/api.ts`.
   - Modul ini secara otomatis menyisipkan header `Authorization: Bearer <token>`.

3. **Manajemen Sesi Otomatis**:
   - `SessionManager` akan membaca waktu *expire* (`exp`) dari payload JWT menggunakan utility di `lib/jwt.ts`.
   - **Silent Refresh**: Jika sisa umur token tinggal 15 menit dan user terpantau aktif (menggerakkan kursor, mengetik), `SessionManager` diam-diam memanggil `/api/v1/refresh-token` ke backend. Backend Go merespons dengan token baru, dan frontend memperbarui Cookie tanpa me-refresh halaman.
   - **Idle Timeout**: Jika user tidak menyentuh layar selama 1 jam, sesi langsung ditutup paksa di sisi frontend demi keamanan (menampilkan modal re-login).
   - **Fail-Safe 401**: Jika sewaktu-waktu backend Golang membalas HTTP 401 (misal: token dicabut oleh admin di backend), `apiFetch()` memancarkan `SESSION_EXPIRED_EVENT`. `SessionManager` menangkap event tersebut dan langsung memblokir layar dengan modal re-login.

4. **Role-Based Access Control (RBAC)**:
   - UI menggunakan fungsi `hasAccess()` dari `lib/access.ts` untuk menampilkan elemen UI berdasarkan Role. 
   - Konfigurasi permission di frontend dibuat identik dengan *middleware* Golang (contoh: `middleware.AccessLevel("administrator")`) untuk menjaga sinkronisasi logika bisnis di kedua sisi aplikasi.
