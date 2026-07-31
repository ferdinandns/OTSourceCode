@echo off
:: =========================================================================================
:: Script Build Produksi (Standalone)
:: 
:: Arsitektur Deployment:
:: NextJS (mulai v12+) mendukung mode "standalone" yang meng-compile seluruh aplikasi 
:: beserta dependensinya menjadi satu folder mandiri (.next/standalone).
:: Keuntungannya: Kita tidak perlu meng-upload folder node_modules yang sangat besar
:: (ratusan MB) ke server. Cukup jalankan server.js dengan Node.js.
:: =========================================================================================

echo ===================================================
echo 1. Membersihkan sisa build lama di lokal...
echo ===================================================
if exist .next\standalone-baru rmdir /s /q .next\standalone-baru

echo.
echo ===================================================
echo 2. Memulai Proses Build Next.js...
echo ===================================================
call npm run build

echo.
echo ===================================================
echo 3. Memindahkan Folder ke struktur standalone...
echo ===================================================
xcopy /E /I /Y public .next\standalone\public
xcopy /E /I /Y .next\static .next\standalone\.next\static

echo.
echo ===================================================
echo 4. Membuat File ecosystem.config.js Otomatis...
echo ===================================================
echo module.exports = { > .next\standalone\ecosystem.config.js
echo   apps: [ >> .next\standalone\ecosystem.config.js
echo     { >> .next\standalone\ecosystem.config.js
echo       name: "frontend-pct", >> .next\standalone\ecosystem.config.js
echo       script: "server.js", >> .next\standalone\ecosystem.config.js
echo       env: { >> .next\standalone\ecosystem.config.js
echo         PORT: 8005, >> .next\standalone\ecosystem.config.js
echo         NODE_ENV: "production" >> .next\standalone\ecosystem.config.js
echo       } >> .next\standalone\ecosystem.config.js
echo     } >> .next\standalone\ecosystem.config.js
echo   ] >> .next\standalone\ecosystem.config.js
echo }; >> .next\standalone\ecosystem.config.js

echo.
echo ===================================================
echo 5. Mengubah nama folder menjadi standalone-baru...
echo ===================================================
ren .next\standalone standalone-baru

echo.
echo ===================================================
echo Selesai! Salin folder .next\standalone-baru ke server.
echo ===================================================
pause