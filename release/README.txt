AVERO STUDIO - Native Windows Release
====================================

This folder is produced by release\build-windows.ps1:
  powershell -ExecutionPolicy Bypass -File release\build-windows.ps1

Contents:
- AVERO-STUDIO.exe ......... portable executable (no install needed)
- *.exe (Setup) ............ NSIS installer, installs to Program Files
- *.msi .................... MSI installer for enterprise deployment
- README.txt ............... this file

System requirements:
- Windows 10 1809+ / Windows 11 (x64)
- WebView2 Runtime (shared OS component, same engine as Edge).
  The installer downloads it automatically if missing
  (webviewInstallMode = downloadBootstrapper).
  The app never shows a browser window or "localhost" branding.

Data:
- Projects: .avx files, open/save from the app.
- Settings/recent: stored locally per user.
- Fully offline.

Build from source:
  npm install
  npm run build
  npx tauri build --bundles nsis,msi
