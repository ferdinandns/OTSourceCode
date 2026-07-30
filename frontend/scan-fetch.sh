# scan-fetch.ps1 — Jalankan dari root folder frontend (tempat src/ berada)
# Usage di PowerShell: .\scan-fetch.ps1

$targetDir = "src"
$skipFiles = @("useApi.ts", "useApi.tsx", "AuthProvider.tsx", "auth-provider.tsx")

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Scan fetch() manual di: $targetDir" -ForegroundColor Cyan
Write-Host "========================================`n"

$found = $false

Get-ChildItem -Path $targetDir -Recurse -Include "*.ts", "*.tsx" | ForEach-Object {
    $file = $_

    # Lewati file yang memang boleh pakai fetch
    if ($skipFiles -contains $file.Name) { return }

    $matches = Select-String -Path $file.FullName -Pattern "fetch\(" -CaseSensitive
    if ($matches) {
        $found = $true
        $relativePath = $file.FullName.Replace((Get-Location).Path + "\", "")
        Write-Host "📄 $relativePath" -ForegroundColor Yellow
        foreach ($match in $matches) {
            Write-Host ("   Line " + $match.LineNumber + ": " + $match.Line.Trim()) -ForegroundColor Gray
        }
        Write-Host ""
    }
}

if (-not $found) {
    Write-Host "✅ Tidak ada fetch() manual ditemukan di luar file yang dikecualikan." -ForegroundColor Green
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " File di atas perlu diganti dengan useApi" -ForegroundColor Cyan
Write-Host ""
Write-Host " Contoh penggantian:" -ForegroundColor White
Write-Host ""
Write-Host " // Sebelum" -ForegroundColor Red
Write-Host " const res = await fetch('/api/data', { headers: { Authorization: ``Bearer `$``{token}`` } })" -ForegroundColor Red
Write-Host " const data = await res.json()" -ForegroundColor Red
Write-Host ""
Write-Host " // Sesudah" -ForegroundColor Green
Write-Host " const api = useApi()" -ForegroundColor Green
Write-Host " const data = await api.get('/api/data')" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan