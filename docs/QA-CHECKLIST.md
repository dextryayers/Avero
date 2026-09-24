# QA Checklist 1.0

## Installer
- [ ] Windows .msi/.exe terinstall dan dibuka offline
- [ ] Linux .deb/.AppImage dibuka di Ubuntu 22.04/24.04 dan Fedora
- [ ] Auto updater endpoint GitHub Releases valid
- [ ] Startup di bawah 2 detik di SSD

## Fase 0-1
- [ ] New 1920x1080, brush, eraser, undo/redo
- [ ] Open PNG JPG WEBP PSD, export PNG JPG
- [ ] Zoom 10-3200 persen, pan, ruler

## Fase 2
- [ ] Rect/lasso/wand seleksi + feather + inverse + deselect
- [ ] Brush menghormati seleksi
- [ ] Mask add, paint mask, feather, density, delete, undo mask benar
- [ ] 9 adjustment tambah, reorder, opacity, enable
- [ ] 6 filter tambah dan preview real-time
- [ ] Text layer edit font/size/warna, shape rect/ellipse/polygon
- [ ] Transform move/scale/rotate/flip
- [ ] PSD info tampil layer list

## Fase 3
- [ ] Working space sRGB/AdobeRGB/ProPhoto, proofing CMYK, gamut warning
- [ ] Histogram RGB Lum update
- [ ] RAW panel exposure/WB/highlight/shadow mengubah preview
- [ ] StatusBar tampil tiles, MB, heap

## Fase 4
- [ ] AI hapus background tanpa internet
- [ ] Select subject membuat seleksi
- [ ] Inpaint seleksi, upscale 2x jadi layer baru
- [ ] Color transfer dengan referensi
- [ ] Prompt contoh sunset, bw, hapus background
- [ ] Recorder merekam tambah adjustment/filter, preset tersimpan
- [ ] Batch queue jalan ke preset

## Fase 5
- [ ] Node graph rebuild dari stack, drag node, toggle ON/OFF live
- [ ] Git snapshot, branch, compare slider A/B
- [ ] Artboard tambah dan export per artboard
- [ ] 3 plugin contoh berjalan, custom plugin install
- [ ] Mockup warp jadi layer baru

## Fase 6
- [ ] 4 workspace mengubah tab dan prompt bar
- [ ] Onboarding sample project
- [ ] Autosave recovery banner tiap 2 menit
- [ ] `npm run test` 3 suite lolos, `cargo test` lolos
- [ ] Crash/close paksa tidak hilangkan sesi terakhir (recovery)
