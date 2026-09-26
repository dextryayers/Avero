#Requires -Version 5.1
# Build native Windows installer + portable folder for AVERO STUDIO.
# Run from repo root: powershell -ExecutionPolicy Bypass -File release\build-windows.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

Write-Host "== AVERO STUDIO native build ==" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }

npx tauri build --bundles nsis,msi
if ($LASTEXITCODE -ne 0) { throw "Tauri build failed" }

$bundle = Join-Path $root "src-tauri\target\release\bundle"
$portable = Join-Path $root "release\AVERO-STUDIO-Portable"
if (Test-Path -LiteralPath $portable) { Remove-Item -LiteralPath $portable -Recurse -Force }
New-Item -ItemType Directory -Path $portable | Out-Null

$exe = Join-Path $root "src-tauri\target\release\avero-studio.exe"
if (Test-Path -LiteralPath $exe) {
  Copy-Item -LiteralPath $exe -Destination (Join-Path $portable "AVERO-STUDIO.exe")
}

$nsis = Join-Path $bundle "nsis"
if (Test-Path -LiteralPath $nsis) {
  Copy-Item -Path (Join-Path $nsis "*.exe") -Destination $portable -Force -ErrorAction SilentlyContinue
}
$msiDir = Join-Path $bundle "msi"
if (Test-Path -LiteralPath $msiDir) {
  Copy-Item -Path (Join-Path $msiDir "*.msi") -Destination $portable -Force -ErrorAction SilentlyContinue
}

Copy-Item -LiteralPath (Join-Path $PSScriptRoot "README.txt") -Destination (Join-Path $portable "README.txt") -Force

Write-Host ""
Write-Host "Done. Outputs:" -ForegroundColor Green
Write-Host "  Installers : $bundle\nsis + \msi"
Write-Host "  Portable   : $portable"
Write-Host ""
Write-Host "Note: the app UI renders with the OS WebView2 (Edge engine, shared with Windows)." -ForegroundColor Yellow
Write-Host "No browser window or localhost branding is shown: all dialogs are now native/branded."
