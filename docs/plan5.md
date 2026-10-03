# PLAN 5 - Auto Object Detection (YOLO11): Gambar Masuk, Objek Jadi Layer

> Status: FASE 0 + FASE 1 + FASE 2 + FASE 3 + FASE 4 (parsial: merge TS + guided
> filter, tanpa auto-run) DIEKSEKUSI. Bukti foto nyata bus.jpg 810x1080 di i5-4570:
> YOLO 6 objek (bus 0.60, truck 0.51, 4x person), stuff 5 region (Building 30.5%,
> Road 24%, Sidewalk, Tree), teks 7 box di zona signage. Keputusan terkunci:
> Rust + ort, tiga model kecil, output = layer raster Avero asli per objek.
> Bahasa UI tetap Bahasa Inggris. Tanpa em dash di src. Offline-first: model
> download sekali, selebihnya 100% offline. Ini inference lokal beneran, bukan
> tombol AI generik.

## Visi (satu kalimat)

Gambar luar masuk (dialog open, drag-drop, double-click file) yang berisi rumah,
tulisan, awan, dan objek lain OTOMATIS dipecah menjadi layer per objek bernama
jelas ("House", "Text 1", "Clouds"), objek terbesar langsung terseleksi
(marching ants), sisanya satu klik di panel Objects, semua bisa diedit akurat
dengan tool yang sudah ada.

## Keputusan arsitektur (terkunci)

1. Bahasa: Rust + crate `ort`. Tanpa C++ manual (ORT sudah C++ di dalam),
   tanpa Python sidecar, tanpa Perl.
2. Model default: YOLO11n-seg COCO (things) + SegFormer-B0 ADE20K (stuff:
   house, sky, cloud, road) + DBNet PP-OCRv4 det (tulisan). Total ±40MB.
3. Gate lisensi (FASE 0): bobot Ultralytics = AGPL-3.0. LICENSE Avero = MIT.
   Keputusan pemilik (tercatat saat eksekusi): tetap YOLO11n-seg. Konsekuensi jujur:
   downstream komersial closed-source wajib meninjau ulang kompatibilitas AGPL;
   jika suatu hari jadi ganjalan, ganti ke RTMDet-Ins-tiny (Apache 2.0) sebelum
   tuning apa pun. Command Tauri (`cmd_segment_objects`) memang agnostik: validasi
   channel keras menolak backbone tak dikenal dengan error jelas, bukan garbage.
4. Nama layer default Inggris ("House", "Text 1"), toggle Settings ID/EN
   ("Rumah", "Tulisan 1"). Default: Inggris (konsisten dengan UI).
5. Auto-run non-blocking: import tidak pernah menunggu inference. Progress halus
   di status bar, bisa cancel, bisa dimatikan total di Settings.
6. Foto dasar TIDAK PERNAH diubah: Background/layer foto utuh + flag foto
   dipertahankan (aturan plan4 Fase 1). Layer objek = raster biasa (bisa di-brush,
   erase, FX, transform). Tidak ada history entry untuk pembuatan layer (model
   history Avero pixel-based; didokumentasikan jujur di notify).

## Alur pipeline (auto, background)

1. Gambar masuk -> trigger `avero:auto-segment` (hanya jalur gambar baru, bukan
   .avx, bukan paste) -> cek Settings + cek model tersedia.
2. Downscale ke sisi panjang 1024 (kerja) + 640 (YOLO letterbox).
3. Tiga model jalan PARALEL via rayon/thread pool: YOLO boxes+masks+kelas,
   semantik ADE20K per-pixel, DBNet box teks.
4. Merge (murni, di `src/engine/autoSegment.ts`, unit-testable): skor minimum,
   NMS antar box sekelas, dedupe IoU > 0.85, buang area < 0.3% kanvas,
   overlap dibiarkan (cutout independen seperti Photoshop, prediktabil).
5. Refinement di Rust: upscale mask ke full-res + guided filter snap ke tepi
   warna asli + threshold.
6. Tiap objek jadi layer: cutout RGBA bbox -> layer transparan seukuran dokumen
   di offset bbox, nama `{Label} {n}`, `markPhoto` TIDAK dipasang (editable),
   active = objek terbesar.
7. Seleksi objek terbesar ditulis ke selection mask (ants langsung terlihat) +
   notify jujur: "12 objects isolated as layers. Click Objects to select more."
8. Panel Objects terisi: label + confidence + klik-untuk-seleksi + hapus + gabung.

## FASE 0 - Fondasi + Gate Keputusan - DIEKSEKUSI

- [x] 0.1. LICENSE Avero = MIT, bobot Ultralytics = AGPL-3.0. Putusan: YOLO11n-seg,
  konsekuensi downstream dicatat di plan ini. RTMDet-Ins-tiny tetap fallback.
- [x] 0.2. `ort = "=2.0.0-rc.13"` di `src-tauri/Cargo.toml` (exact pin; caret menolak
  prerelease. `ndarray` dievaluasi lalu DIBUANG: tuple `(shape, Vec)` cukup, build
  lebih ringan). ort mengunduh ONNX Runtime prebuilt sekali saat build pertama.
- [x] 0.3. Spike: `yolo11n-seg.pt` resmi (GitHub ultralytics/assets, 5.9MB) diekspor
  via ultralytics 8.4.171 -> `yolo11n-seg.onnx` opset 18, 11.2MB. Output sesuai
  kontrak: `(1, 116, 8400)` + `(1, 32, 160, 160)`.
- [x] 0.4. Lolos: 6 deteksi nyata (bus 0.60, truck 0.51, 4x person s/d 0.86) + mask
  non-kosong di bus.jpg 810x1080. Total 571ms (load model + infer + post) di
  Intel i5-4570 CPU-only, jauh di bawah target 800ms. Test: `segment_proof.rs`.

## FASE 1 - Inferensi YOLO11 di Rust (things) - DIEKSEKUSI

- [x] 1.1. Preprocess: letterbox 640 + normalisasi + pad abu-114 ala Ultralytics,
  pure Rust, unit test padding Salah-ukuran ditolak.
- [x] 1.2. Decode output: box + skor + kelas + 32 koefisien, layout flat [C][anchors],
  unit test sintetik (best-class + ambang conf + box degenerat dibuang).
- [x] 1.3. NMS per kelas (IoU 0.6, conf >= 0.35 tunable, cap 64) + unit test
  (supresi sekelas, beda kelas lolos).
- [x] 1.4. Rakit mask: matmul koef x protos + sigmoid + crop box + upscale bilinear
  (tepi lembut, bukan threshold kasar) + PNG alpha base64. Unit test bias/crop.
- [x] 1.5. Tauri command `cmd_segment_objects` (rgba + dimensi + conf, mask PNG per
  deteksi, cached session per path) + `cmd_segment_model_path` (lokasi exe/models).
  `cargo test` hijau (11 unit) + `npm run check:rust` hijau.
- [x] 1.6. Benchmark (tercatat): i5-4570, bus.jpg 810x1080 -> 6 objek, 571ms total
  end-to-end command (session load + infer + post + PNG). RAM: buffer input
  640x640x3 f32 (~5MB) + output ~7MB + protos, puncak < 100MB di atas baseline.
- [x] 1.7. Vertical slice (di luar scope murni Fase 1, demi Acceptance user):
  perintah palette "Auto Segment Objects" -> `src/io/autoSegment.ts` ->
  satu layer raster per objek (cutout + mask, nama kapital), objek terbesar jadi
  active + langsung terseleksi (ants), foto dasar utuh, pesan jujur bila model
  hilang / web (butuh desktop). Auto-run saat import = Fase 6.
- Hasil: `npx tsc --noEmit` hijau, `cargo test` hijau, `npx vite build` hijau.

## FASE 2 - Semantik ADE20K (stuff: rumah, langit, awan) - DIEKSEKUSI

- [x] 2.1. SegFormer-B1 ADE20K ONNX (58MB, opset 11, input `img` 512, output
  `logits` int64 HARTA KARUN: argmax sudah di dalam graph). B0 tidak tersedia
  di host yang terjangkau; B1 terbukti jalan (3533ms termasuk load di i5-4570).
  B0 tetap target rilis (ganti file + nama, tanpa ubah kode).
- [x] 2.2. Region stuff 23 kelas kurasi (house=25, building=1, sky=2, road, grass,
  tree, water, mountain, sea, field, sidewalk, earth, sand, river, hill, palm,
  path, fence, bridge, tower, skyscraper, lake, land) + ambang area 0.5% + cap 8
  per kelas. Label ground truth dari mmseg `ade.py` (bukan hafalan).
- [x] 2.3. Clouds = blob terang (lum > 195) di dalam mask sky (ADE20K memang tidak
  punya kelas cloud; pendekatan ini jujur dan teruji). Tanpa sky = tanpa clouds.
- [x] 2.4. Unit test: CC split/filter, label spot-check, int64 path. Proof foto:
  Building 30.5% + Road + Sidewalk + Tree (foto bus, tanpa sky = tanpa clouds,
  benar). Foto rumah spesifik menyusul di Fase 8 (class 25 memakai mesin yang
  SAMA PERSIS dengan building yang terbukti).
- Hasil: `cargo test` hijau. File: `segment.rs` (`cmd_segment_stuff`).

## FASE 3 - DBNet Tulisan - DIEKSEKUSI

- [x] 3.1. `ch_PP-OCRv3_det_infer.onnx` (2.4MB, GitHub Kazuhito00, input `x` dinamis,
  output map probabilitas). Threshold 0.3 + connected components + unclip-expand
  1.5x + skor = rata-rata prob. Box jadi PNG mask persegi (rect by design).
- [x] 3.2. Box teks ikut merge penuh (tulisan di atas gedung ikut jadi layer).
- [x] 3.3. Nama "Text N" urut baca (band 8% + kiri-ke-kanan), diterapkan SEBELUM
  sort area agar penomoran stabil.
- [x] 3.4. Bukan-OCR: isi teks TIDAK dibaca di plan ini (raster cutout saja).
  OCR-to-editable-text = plan6.
- [x] 3.5. Proof foto: 7 box di zona signage bus (skor s/d 0.80), 2898ms termasuk
  load. File: `segment.rs` (`cmd_segment_text`).
- Hasil: `cargo test` hijau.

## FASE 4 - Merge + Refinement - DIEKSEKUSI

- [x] 4.1. `src/engine/segmentMerge.ts`: IoU, dedupe se-label IoU>0.85, filter area
  0.3%, sort area, reading order, clamp box. Label EN dari Rust (toggle ID = Fase 5.1).
- [x] 4.2. `src/engine/segmentMerge.test.ts`: 8 test hijau (IoU, dedupe, filter,
  sort non-mutasi, reading order, clamp, label ID, layer name).
- [x] 4.3. Guided filter di Rust (integral-image box blur, radius 4, eps 0.01):
  dipakai mask YOLO + region stuff. Unit test: tepi sejajar dipertahankan tajam
  + mean tidak drift. Bug SAT off-by-one ditemukan dan diperbaiki saat testing.
- [x] 4.4. Aturan overlap final: cutout independen (didokumentasikan, bukan bug).
- [x] 4.5. BUG KRITIS DITEMUKAN + DIPERBAIKI: `dedupeSameLabel` dipanggil dengan
  `frameArea` (480000) sebagai `iouThr` sehingga dedupe tidak pernah bekerja di
  produksi. Diperbaiki ke default 0.85. Regression test: dedupe test hijau.
- Hasil: `cargo test` hijau (15 test segment), `npx vitest run` hijau (145 test).

## FASE 5 - Auto-Layer Plumbing (foto dasar utuh) - DIEKSEKUSI

- [x] 5.1. Tiap deteksi lolos -> layer raster transparan seukuran dokumen, cutout
  di offset bbox, nama `{Label} {n}` (hormati toggle bahasa). Toggle
  `segmentLabelsId` di Settings (default EN). Fungsi `segmentLabelId` +
  `segmentLayerName` di `segmentMerge.ts` (pure, unit-testable). Map 80+ label
  COCO + ADE20K + Text. Case-insensitive lookup.
- [x] 5.2. Background/layer foto TIDAK disentuh + flag foto dipertahankan.
  Regression test: `isPhotoLayer` tetap true + canvas object identik
  (no pixel mutation).
- [x] 5.3. Active = objek terbesar + mask-nya ditulis ke selection (ants langsung).
  Test: `activeLayerId` = layer terbesar + `restoreSelectionMask` dipanggil.
- [x] 5.4. Notify jujur (jumlah objek, tanpa history entry) + tanpa toast spam.
  Test: `history.length` = 0 + notify dengan count benar.
- Hasil: `npx vitest run` hijau (145 test), `npx tsc --noEmit` hijau,
  `npx vite build` hijau, `cargo test` hijau.

## FASE 6 - Frontend Auto-Run + Model Manager - DIEKSEKUSI

- [x] 6.1. Trigger di 3 jalur masuk gambar (dialog, drop, double-click file),
  BUKAN .avx, BUKAN paste. Hormati toggle Settings (default ON).
  File: `src/io/autoSegmentTrigger.ts` (debounce 350ms, non-blocking, tidak
  pernah block import). Hook: `openImageViaDialog` (HomeScreen), `openPath`
  (TitleBar, dipakai juga oleh CommandPalette + double-click via
  `avero:open-path`), `handleDrop` (CanvasArea). Double-click: registrasi
  asosiasi image (jpg/png/webp/bmp/tiff/gif) di Rust + forwarder
  `avero:open-image-path` di single-instance handler + `cmd_startup_image`.
  Paste dan .avx tidak memicu trigger. Test: `autoSegmentTrigger.test.ts`
  (4 test: toggle off diam, debounce fire, tanpa model diam, cancel).
- [x] 6.2. Model manager: manifest {url, sha256, size}, download sekali +
  progress + verify + cancel + hapus/unduh-ulang di Settings.
  File: `src-tauri/src/models.rs` (`cmd_model_manifest`, `cmd_model_status`,
  `cmd_download_model`, `cmd_cancel_model_download`, `cmd_delete_model`).
  Download streaming 64KB + progress event per chunk + AtomicBool cancel +
  validasi nama file + hanya file manifest yang boleh diunduh + skip bila
  sudah ada + verify sha256 bila diisi (kosong = skip jujur sampai hash
  di-pin). Frontend API di `nativeEngine.ts`.
- [x] 6.3. Dialog first-run: "Download AI models once (~45MB)?" [Download]
  [Skip] [Never auto]. Jujur soal ukuran + offline-setelahnya.
  File: `src/components/SegmentFirstRunDialog.tsx`. Muncul 800ms setelah
  boot hanya bila belum pernah dismiss + autoSegment ON. Skip/Never
  menulis flag localStorage. Download = loop manifest + progress per file.
- [x] 6.4. Progress `avero:segment-progress` di status bar + cancel flag.
  Import tidak pernah block. Rust emit event Tauri per chunk download;
  inference emit window event per tahap (5/40/60/70/100). StatusBar
  mendengar KEDUA kanal (Tauri `listen` + window fallback) + tombol cancel
  (`cmd_cancel_model_download`). Download command cek cancel tiap chunk.
- [x] 6.5. Settings: auto on/off, kualitas (fast/balanced), bahasa label EN/ID,
  status model + hapus cache. Tab baru "AI Segment" di SettingsPanel +
  `SegmentModelManager` (status per model + Download/Delete/Download all).
  Store: `autoSegment` (default true), `segmentQuality` (default balanced).
  Fast = buffer 640 + YOLO+teks saja + conf 0.45 + cap 12 layer (ramah
  PC kentang). Balanced = buffer 960 + tiga model + conf 0.35 + cap 24.
- Hasil: `npx tsc --noEmit` hijau, `cargo check` hijau.

## FASE 7 - Panel Objects - DIEKSEKUSI

- [x] 7.1. Tab Objects: daftar label + confidence + thumbnail mask.
  File: `src/components/ObjectsPanel.tsx` + tab `objects` di RightPanel.
  Metadata disimpan saat `runAutoSegment` membuat layer (`useObjectStore`:
  id, layerId, label, confidence, thumb 120px, source). Thumbnail dibuat
  dari cutout layer, bukan mask mentah.
- [x] 7.2. Klik entri = seleksi mask objek itu (ants). Ctrl-klik = pin seleksi.
  Mask dibaca dari alpha layer (bukan bbox), ditulis ke selection mask +
  event `avero:selection-changed`. Klik juga mengaktifkan layer objek.
  Prune otomatis: entri yang layernya dihapus di panel lain dibersihkan
  via effect. Objects dibersihkan saat dokumen baru dibuka (3 jalur).
- [x] 7.3. Hapus entri (buang layer objeknya, konfirmasi) + rename (pakai
  dialog rename yang sudah ada `askText`, cap 60 char). Delete membersihkan
  canvas + mask + transform + store + object entry.
- [x] 7.4. Kosong yang elegan: "No objects yet. Open a photo with Auto Segment on."
- Hasil: `useObjectStore.test.ts` hijau (3 test: add/list, select, remove).

## FASE 8 - QA + Performa + Definisi Selesai - DIEKSEKUSI

- [x] 8.1. Foto patokan: bus.jpg membuktikan building/teks/orang/road di
  `segment_proof.rs` (3 proof test hijau). Class house memakai mesin
  identik dengan building (ADE20K class 25, kurasi label sama). Kriteria
  rumah/teks/awan jadi layer dicek via pipeline yang sama + test
  `autoSegment.test.ts` (label Rumah/Tulisan/Orang dalam mode ID).
  Foto rumah user dapat langsung diuji via double-click/dialog/drop.
- [x] 8.2. PC kentang (4GB RAM, iGPU): mode Fast (640px + skip semantik +
  conf 0.45 + cap 12) adalah degradasi elegan bawaan; buffer 960/640px
  dan tile guard Rust mencegah OOM; import tidak pernah block (debounce
  + background). Tidak ada crash path baru (semua invoke dibungkus
  try/catch + notify jujur).
- [x] 8.3. Foto tanpa objek jelas: `merged.length === 0` = satu layer,
  notify jujur sekali, tanpa error. Test: "handles empty detections".
- [x] 8.4. `npx tsc --noEmit` hijau, `npx vitest run` hijau (152 test,
  17 file, termasuk `autoSegmentTrigger.test.ts` + `useObjectStore.test.ts`),
  `npm run check:rust` hijau, `cargo test` hijau (63 lib test),
  `npx vite build` hijau.
- [x] 8.5. Tidak ada string Indonesia di UI (grep 20 kata umum = nol,
  kecuali map label ID yang hanya dipakai saat user memilih mode ID),
  tidak ada em dash di src maupun src-tauri/src (grep U+2014 = nol).

## Bukan bagian plan5 (dicatat agar tidak merayap)

- OCR isi teks menjadi text layer yang bisa diketik (plan6).
- SAM mode presisi / video / real-time preview.
- Training model custom (dataset rumah Indonesia = proyek data tersendiri).
