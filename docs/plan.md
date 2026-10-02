# Plan Pengembangan Open Source Photo Editor Professional
## Cross Platform Installer Native Linux dan Windows

**Stack Utama:** Rust + TypeScript via Tauri v2  
**Output:** Installer Native Offline, bukan web. Windows .exe/.msi, Linux .deb/.AppImage/.rpm  
**Lisensi Rencana:** GPL v3 atau AGPL v3 untuk core, MIT untuk plugin SDK  
**Posisi Produk:** Alternatif modern untuk GIMP dan Photoshop dengan UX seperti Figma

---

## 1. Visi dan Positioning

### 1.1 Visi
Membangun editor foto dan gambar raster profesional yang gratis, open source, modern, cepat, dan berjalan native di Linux dan Windows tanpa ketergantungan cloud. Fokus pada performa GPU, workflow non destructive, dan AI lokal offline.

### 1.2 Masalah yang Diselesaikan
* GIMP: Gratis tapi UX membingungkan, workflow destructive, performa filter lambat
* Photoshop: Berbayar, berat, butuh cloud untuk AI
* Photopea: Berbasis web, butuh internet, performa terbatas untuk file besar
* Krita: Fokus ke digital painting, bukan photo editing

### 1.3 Target Pengguna
1. Fotografer dan retoucher
2. Desainer grafis dan konten kreator
3. UMKM yang butuh batch editing produk
4. Pengguna Linux yang tidak punya opsi Photoshop
5. Kontributor open source dan pembuat plugin

---

## 2. Prinsip Desain Produk

1. Performance First: Semua preview filter harus 60fps untuk file 4K di GPU
2. Non Destructive by Default: Edit tidak pernah merusak pixel asli
3. Familiar tapi Modern: User Photoshop bisa langsung pakai, tapi terasa seperti Figma
4. Offline First: Semua fitur inti dan AI utama jalan tanpa internet
5. Extensible: Semua bisa di extend via plugin JS/Python/WASM

---

## 3. Tech Stack Final untuk Installer Native

### 3.1 Arsitektur Hybrid Rust dan TypeScript
```
Layer UI (TypeScript + React + Tailwind)
  |
  | IPC Tauri (Command dan Event)
  |
Layer Core Engine (Rust)
  |-> Canvas Engine (wgpu + Vulkan/DirectX12/Metal)
  |-> Image Processing (image-rs + libvips + LittleCMS)
  |-> File I/O (psd crate, tiff, png, jpeg, avif, webp, libraw)
  |-> AI Engine (ONNX Runtime + Candle)
  |
OS Native Window (WebView Tauri, bukan browser)
```

### 3.2 Rincian Teknologi
* **Frontend UI:** TypeScript 5, React 18, Vite, Tailwind CSS, Zustand untuk state, Konva/Fabric untuk manipulasi canvas 2D di atas wgpu
* **Backend Core:** Rust stable, Tokio async, Tauri v2 API
* **Rendering:** wgpu untuk GPU pipeline, hardware acceleration di Windows DirectX12 dan Linux Vulkan
* **Color Management:** LittleCMS2 via binding, support ICC profile, 16bit dan 32bit per channel
* **Build Installer:** Tauri Bundler, NSIS dan WiX untuk Windows, deb/AppImage/rpm untuk Linux, GitHub Actions untuk CI cross compile
* **AI Runtime:** ONNX Runtime Rust binding, model SAM, Lama Inpaint, Real ESRGAN

### 3.3 Struktur Direktori Project
```
PSD/
  src/                 # Frontend TypeScript React
    components/
    canvas/
    panels/
    stores/
    hooks/
  src-tauri/           # Backend Rust
    src/
      commands/        # IPC handler
      engine/
        canvas/
        layers/
        filters/
        color/
      io/
        psd/
        raw/
      ai/
    Cargo.toml
    tauri.conf.json
  resources/           # Icon, template, color profile
  plugins/             # Contoh plugin SDK
  plan.md
```

---

## 4. Desain UI UX Modern dan Profesional

### 4.1 Konsep UX Utama
Mengadopsi layout familiar Photoshop tapi dengan sentuhan Figma yang bersih dan minimal.

### 4.2 Layout Aplikasi
```
+----------------------------------------------------------+
| Title Bar + Menu Bar (File Edit Image Layer Filter View) |
+-----+--------------------------------------+-------------+
|Tools|         Canvas Area (Infinite)       | Properties  |
| Bar |  + Artboards + Rulers + Guides      | Panel       |
|  W  |  + Zoom, Pan, Grid                  | + Layers    |
|  48 |                                     | + Adjust    |
|  px |                                     | + History   |
+-----+--------------------------------------+-------------+
| Status Bar: Zoom, Color Profile, Doc Size, GPU Status    |
+----------------------------------------------------------+
| Timeline (opsional untuk animasi/parallax)               |
+----------------------------------------------------------+
```

### 4.3 Design System
* **Tema:** Dark Mode default profesional #1E1E1E, Light Mode #F5F5F5, High Contrast untuk aksesibilitas
* **Typography:** Inter untuk UI, JetBrains Mono untuk nilai numerik
* **Icon:** Lucide atau Phosphor, style outline konsisten 1.5px
* **Warna Aksen:** Biru #0A84FF untuk seleksi, tidak mengganggu akurasi warna foto
* **Radius:** 8px untuk panel, 6px untuk button, 4px untuk input
* **Shadow:** Soft shadow untuk floating panel, tidak berlebihan

### 4.4 Interaksi Kunci Modern
1. **Command Palette:** Ctrl+K untuk cari semua aksi, seperti VS Code. Contoh ketik blur atau export
2. **Contextual Properties Panel:** Panel kanan berubah sesuai tool yang aktif
3. **Non Destructive Slider:** Semua adjustment pakai slider real time dengan preview GPU
4. **Gesture:** Scroll zoom, space drag, middle click pan, pinch di trackpad Linux
5. **Custom Workspace:** Save dan load workspace untuk fotografi, retouching, dan desain
6. **Tooltips Kaya:** Hover tool tampil preview animasi 2 detik cara pakai

### 4.5 Alur UX Penting
* Buka file PSD 500MB tetap responsif dengan progres bar dan thumbnail
* Drag and drop gambar langsung jadi layer baru
* Auto save setiap 2 menit dan recovery saat crash
* Onboarding 30 detik untuk user baru dengan sample project

---

## 5. Fitur Lengkap

### 5.1 Fitur Inti Editor Raster
* Canvas infinite dengan artboard multiple
* Layer: Raster, Text, Shape Vector, Smart Object, Group, Mask, Clipping Mask
* Blend Mode lengkap 27 mode: Normal, Multiply, Screen, Overlay, dll
* Transform: Free transform, warp, perspective, liquify
* Selection: Marquee, Lasso, Magic Wand, Quick Selection, Pen Path
* Masking dan channel alpha
* Grid, guide, snap, dan ruler presisi sub pixel

### 5.2 Tool Standar Profesional
* Brush engine dengan pressure sensitivity untuk tablet Wacom
* Eraser, Clone Stamp, Healing Brush, Patch Tool
* Gradient, Paint Bucket, Eyedropper, Color Picker LAB
* Type tool dengan OpenType, paragraph, warp text
* Shape tool: Rectangle, Ellipse, Polygon, Custom Shape vector
* Crop dengan preset ratio dan straighten
* Eyedropper dengan ring loupe

### 5.3 Adjustment dan Filter Non Destructive
* Adjustment Layer: Brightness/Contrast, Levels, Curves, Exposure, Hue/Saturation, Color Balance, Black and White, Photo Filter, Channel Mixer, Color Lookup, Invert, Posterize, Threshold, Gradient Map, Selective Color
* Filter GPU: Blur Gaussian/Box/Motion, Sharpen, Noise, Distort, Pixelate, Stylize
* Filter Stack dengan reorder dan opacity per filter
* 16bit dan 32bit editing dengan dithering

### 5.4 Manajemen Warna dan File
* Color Management full ICC, profile sRGB, AdobeRGB, ProPhoto
* Soft proofing CMYK
* Support file: PSD, PSB, TIFF, JPG, PNG, WEBP, AVIF, BMP, TGA, RAW via libraw (CR2, NEF, ARW, RAF), PDF import
* Export: JPG, PNG, WEBP, AVIF, TIFF, PDF dengan preset kualitas
* Buka dan simpan PSD dengan layer, mask, text editable tetap terjaga

### 5.5 Fitur Unik dan Pembeda
1. **Node Based Filter Graph:** Toggle antara layer stack biasa dan node graph visual untuk compositing kompleks
2. **Git untuk Gambar:** History visual dengan branching, snapshot, dan compare slider sebelum dan sesudah
3. **AI Lokal Offline:**
   * Auto Select Object dan Subject dengan SAM
   * Background Remover 1 klik
   * Generative Fill dan Erase dengan Lama Inpaint
   * Upscale 4x dengan Real ESRGAN
   * Auto Color Grading tiru referensi
   * Prompt to Edit: ketik perintah teks jadi filter
4. **Batch Automation AI:** Edit 1000 foto produk auto hapus background, resize, dan watermark
5. **Mockup 3D Otomatis:** Drag desain ke foto kaos, botol, buku langsung warp perspektif
6. **Infinite Canvas plus Artboard:** Gabungan Figma dan Photoshop untuk carousel dan social media
7. **Plugin Marketplace:** Install plugin JS/Python/WASM 1 klik, SDK terbuka

### 5.6 Fitur Produktivitas
* Action dan Macro recorder
* Batch processor dengan queue
* Template dan preset filter
* Cloud opsional sinkronisasi setting, bukan file
* Shortcut fully customizable dan import Photoshop shortcut

---

## 6. Rencana Fase Pengembangan Sangat Detail

### FASE 0: Inisiasi dan Fondasi Project
**Durasi:** 2 sampai 3 minggu
**Tujuan:** Setup repo, CI, dan fondasi installer jalan di Windows dan Linux

**Task Detail:**
1. Inisiasi repo Git, struktur Tauri + Rust + React + TypeScript + Vite + Tailwind
2. Konfigurasi ESLint, Prettier, Rust fmt dan clippy
3. Setup Tauri bundler untuk target Windows x64 MSI/NSIS dan Linux deb/AppImage
4. Setup GitHub Actions: build dan test di Windows latest dan Ubuntu latest tiap push
5. Buat design token dan theme dark/light dasar
6. Buat layout shell kosong: title bar, tool bar, canvas placeholder, panel kanan
7. Implementasi auto updater via Tauri updater

**Deliverable:** Aplikasi kosong bisa di install di Windows dan Linux, CI hijau
**Kriteria Selesai:** Installer berhasil di build di kedua OS dan bisa dibuka tanpa error

### FASE 1: MVP Core Engine dan Canvas
**Durasi:** 6 sampai 8 minggu
**Tujuan:** Bisa buka, edit, dan simpan file dasar dengan performa layak

**Task Detail:**
1. Engine Canvas:
   * Implementasi viewport dengan pan dan zoom infinite 10 persen sampai 3200 persen
   * Tile based rendering untuk file besar di atas 100MB
   * Ruler dan guide dengan snap
2. Sistem Layer:
   * Layer stack: create, delete, reorder, visibility, opacity, lock
   * Blend mode dasar 10 mode pertama
   * Layer group dan flat merge
3. Tool Dasar:
   * Brush raster dengan hardness, opacity, flow, spacing
   * Eraser dan eyedropper
   * Move tool dan transform translate dan scale
   * Undo dan Redo stack tak terbatas dengan history panel
4. File I/O Dasar:
   * Buka dan simpan PNG, JPG, WEBP via image-rs
   * Buka PSD sederhana via psd crate (raster layer saja)
   * Export dengan quality slider
5. UI MVP:
   * Tool bar 12 tool pertama
   * Layers panel dengan thumbnail
   * Color picker dan properties panel
   * Status bar

**Deliverable:** MVP bisa dipakai untuk edit foto sederhana dan save
**Kriteria Selesai:** Buka JPG 24MP, tambah brush stroke, undo, save kembali tanpa corrupt

### FASE 2: Advanced Editing dan Non Destructive Workflow
**Durasi:** 8 sampai 10 minggu
**Tujuan:** Workflow profesional non destructive lengkap

**Task Detail:**
1. Selection Engine:
   * Marquee, Lasso polygonal dan freehand, Magic Wand dengan tolerance, Quick Selection
   * Feather, expand, contract, inverse, save selection ke channel
   * Marching ants rendering GPU
2. Masking:
   * Layer mask bitmap, vector mask, clipping mask
   * Mask feather dan density
3. Adjustment Layer Non Destructive:
   * Implementasi 15 adjustment layer dengan GPU shader
   * Stack reorder, enable/disable per adjustment
   * Clipping adjustment ke layer di bawah
4. Text dan Shape:
   * Text tool dengan font system, size, leading, tracking, anti aliasing
   * Shape vector rectangle, ellipse, polygon dengan fill dan stroke
   * Path pen bezier dasar
5. Filter GPU:
   * Blur Gaussian, Box Blur, Motion Blur, Sharpen, Noise
   * Semua filter jalan di wgpu shader dengan preview real time
6. PSD Full Support Tahap 1:
   * Simpan dan baca layer, group, opacity, blend mode, mask sederhana
   * Pertahankan text layer sebagai raster saat save jika belum support editable

**Deliverable:** Editor sudah bisa untuk retouching menengah
**Kriteria Selesai:** Buka PSD dari Photoshop dengan 20 layer tetap tampil benar, edit adjustment dan save balik tetap kompatibel

### FASE 3: Color Management Professional dan RAW
**Durasi:** 5 sampai 7 minggu
**Tujuan:** Akurasi warna kelas studio dan dukungan fotografer

**Task Detail:**
1. Color Management:
   * Integrasi LittleCMS2 untuk konversi profile
   * Assign dan Convert profile sRGB, AdobeRGB, ProPhoto
   * 16bit per channel editing pipeline
   * Histogram RGB, CMYK, Luminosity real time
   * Soft proofing dan gamut warning
2. RAW Developer:
   * Integrasi libraw untuk decode CR2, NEF, ARW, RAF, DNG
   * Panel develop: Exposure, White Balance, Highlight, Shadow, Lens Correction
   * Preview RAW non destructive sebelum masuk canvas
3. Transform Lanjutan:
   * Free transform dengan perspective, warp, distort
   * Content aware scale tahap awal
4. Performance:
   * Tile caching dan lazy loading untuk file di atas 500MB
   * Benchmark buka PSD 1GB di bawah 5 detik di SSD
   * Memory budget monitor di status bar

**Deliverable:** Fotografer bisa pakai untuk workflow RAW ke final
**Kriteria Selesai:** Buka RAW 45MP, edit exposure dan save ke PSD 16bit tanpa banding

### FASE 4: AI Lokal Offline dan Automation
**Durasi:** 8 sampai 10 minggu
**Tujuan:** Fitur pembeda utama yang tidak ada di GIMP

**Task Detail:**
1. AI Runtime Setup:
   * Integrasi ONNX Runtime di Rust, model downloader dan cache
   * Model dijalankan di CPU dan GPU jika tersedia, fallback CPU
   * Panel AI dengan progress dan cancel
2. Fitur AI:
   * Background Remover dengan U2Net
   * Auto Select Subject dan Object dengan SAM mobile
   * Inpaint dan Generative Erase dengan Lama
   * Upscale 2x dan 4x dengan Real ESRGAN
   * Auto Color Transfer tiru tone referensi
3. Automation:
   * Action recorder: rekam langkah jadi macro
   * Batch queue: apply action ke 100 file dengan progress dan log
   * Template preset: buat dan share preset filter
4. Prompt to Edit:
   * Input teks natural jadi filter, contoh buat langit lebih dramatis
   * Mapping prompt ke kombinasi filter dan AI yang ada

**Deliverable:** AI jalan full offline setelah download model sekali
**Kriteria Selesai:** Hapus background foto 12MP di bawah 3 detik di GPU mid range, batch 100 foto selesai tanpa crash

### FASE 5: Node Graph, Workflow Modern, dan Plugin System
**Durasi:** 6 sampai 8 minggu
**Tujuan:** Workflow pro dan ekosistem open source

**Task Detail:**
1. Node Based Compositing:
   * Toggle view antara Layer Stack dan Node Graph
   * Node: Input Image, Filter, Adjustment, Blend, Output
   * Connection drag and drop, preview per node
   * Auto convert layer stack ke node graph
2. Git untuk Gambar:
   * Snapshot visual tiap save dengan thumbnail
   * Branching: buat varian edit tanpa duplicate file
   * Compare slider dan diff highlight
   * Timeline history dengan label
3. Infinite Canvas dan Artboard:
   * Multiple artboard dalam 1 dokumen
   * Export per artboard dengan preset social media
4. Plugin SDK:
   * API JS/TypeScript untuk buat filter dan panel
   * API Python via PyO3 untuk skrip automation
   * WASM sandbox untuk plugin aman
   * Marketplace lokal: install, enable, disable plugin
   * Dokumentasi SDK dan 3 contoh plugin resmi
5. Mockup 3D Otomatis:
   * Deteksi bidang perspektif dan warp otomatis

**Deliverable:** User pro bisa pakai node graph dan komunitas bisa buat plugin
**Kriteria Selesai:** Buat plugin filter custom dalam 50 baris JS dan muncul di menu Filter

### FASE 6: Polish, Kolaborasi, dan Rilis 1.0
**Durasi:** 6 sampai 8 minggu
**Tujuan:** Stabil, cepat, dan siap distribusi publik

**Task Detail:**
1. Polish UI UX:
   * Command Palette Ctrl+K lengkap untuk semua aksi
   * Custom shortcut editor dan import Photoshop shortcut
   * Workspace preset: Photography, Retouching, Painting, Minimal
   * Onboarding interaktif dan sample project
   * Animasi micro interaction dan loading state
2. Performance dan Stabilitas:
   * Profiling dan optimasi startup di bawah 2 detik
   * Stress test 50 layer 4K, memory leak check
   * Crash reporter dan auto recovery file
   * Unit test coverage minimal 70 persen untuk engine Rust, E2E test untuk UI
3. Distribusi Installer:
   * Signing installer Windows dan checksum untuk Linux
   * Update channel stable dan beta via Tauri updater
   * Landing page dan dokumentasi user
   * Build reproducible di GitHub Releases
4. Kolaborasi Opsional:
   * Realtime cursor share via WebRTC untuk review, bukan edit bareng full
   * Export share link preview
5. Rilis Open Source:
   * CONTRIBUTING guide, Code of Conduct, issue template
   * Roadmap publik dan voting fitur
   * Video demo dan dokumentasi lengkap

**Deliverable:** Release 1.0 stable di GitHub dengan installer untuk Windows dan Linux
**Kriteria Selesai:** Lulus QA checklist 100 kasus, tidak ada crash blocker, installer terverifikasi di Windows 10/11 dan Ubuntu 22.04/24.04 serta Fedora

---

## 7. Rencana Build dan Distribusi Installer

* **Windows:** NSIS installer .exe untuk user umum, MSI untuk enterprise, portable zip. Build di GitHub Actions Windows runner. Sign dengan cert self signed awal, EV cert saat traction naik.
* **Linux:** .deb untuk Ubuntu/Debian, .rpm untuk Fedora, AppImage untuk universal. Build di Ubuntu 22.04 runner untuk kompatibilitas glibc terluas.
* **Update:** Tauri updater dengan endpoint GitHub Releases, delta update untuk hemat bandwidth
* **CI/CD:** Tiap push ke main build nightly, tag v* build release, test otomatis di kedua OS

---

## 8. Pengujian dan Kualitas

* Unit test Rust untuk engine layer, filter, dan IO PSD
* Integration test buka dan save roundtrip PSD compare pixel
* E2E test Playwright untuk UI Tauri
* Manual QA checklist: buka 20 file PSD nyata dari Photoshop, test tablet Wacom, test GPU integrated dan discrete
* Performance benchmark track tiap release

---

## 9. Risiko dan Mitigasi

1. PSD spec kompleks dan tertutup: mitigasi pakai psd crate plus fallback rasterize jika fitur tidak support, beri warning ke user
2. Performa file besar lambat: mitigasi tile rendering, GPU cache, dan progressive loading
3. Model AI berat untuk low end PC: mitigasi sediakan model lite dan opsi cloud off
4. Fragmentasi Linux: mitigasi fokus ke AppImage plus deb sebagai utama, test di 3 distro populer

---

## 10. Roadmap Setelah 1.0

* 1.1: Animasi timeline dan export GIF dan video pendek
* 1.2: Kolaborasi cloud opsional dan asset library
* 1.3: iPad dan macOS port jika demand tinggi
* 2.0: 3D dan video layer sederhana

---

## 11. Langkah Selanjutnya yang Disarankan

1. Setujui tech stack Rust plus TypeScript ini
2. Generate scaffold Tauri project di D:\koding\PSD
3. Mulai Fase 0 minggu pertama
4. Buat Figma mockup UI berdasarkan layout di bab 4

Dokumen ini siap jadi acuan untuk mulai coding installer native.
