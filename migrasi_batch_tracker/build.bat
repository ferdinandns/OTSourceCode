@echo off
echo ===================================================
echo Memulai Proses Build Backend Go (Lokal)
echo ===================================================

:: 1. Membersihkan sisa build lama jika ada
echo 1. Membersihkan file build lama...
if exist backend_pct_go-baru.exe del /f /q backend_pct_go-baru.exe

:: 2. Mengatur Environment Variables untuk Windows (pengganti perintah 'env')
echo 2. Menyiapkan environment (GOOS=windows, GOARCH=amd64)...
set GOOS=windows
set GOARCH=amd64

:: 3. Menjalankan proses kompilasi (optimasi strip debug info)
echo 3. Mengkompilasi kode Go...
go build -ldflags="-s -w" -o backend_pct_go-baru.exe main.go

:: 4. Pengecekan hasil
if exist backend_pct_go-baru.exe (
    echo.
    echo ===================================================
    echo BUILD SUKSES! 
    echo File 'backend_pct_go-baru.exe' siap disalin ke server.
    echo ===================================================
) else (
    echo.
    echo ===================================================
    echo [ERROR] Build gagal. Silakan cek pesan error Go di atas.
    echo ===================================================
)

pause