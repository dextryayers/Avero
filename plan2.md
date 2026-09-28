# PLAN 2 — Perbaikan Total Tools Tanpa Bug, Ratusan Sub-Tools Baru, Right Panel ala Photoshop, Top Tools Lengkap

> Status: RENCANA (belum dieksekusi). Dokumen ini menjadi acuan tunggal eksekusi bertahap.
> Prinsip: satu per satu, tiap tool harus terlihat hasilnya, tercatat di history, ada hint, ada kursor, dan lolos uji otomatis.
> Bahasa: seluruh string user-facing tetap Bahasa Inggris (konsisten dengan codebase saat ini).

---

## 0. Hasil audit awal (fakta lapangan, sudah diverifikasi dari kode)

1. **Registri tools saat ini**: 17 family, 232 sub-tools (`ToolBar.tsx` baris 637). `ToolId` di `useEditorStore.ts` + `PAINT_TOOLS` + `RETOUCH_MAP` + `DISTORT_MAP` + `CROP_RATIOS` + `IS_SELECTION_TOOL` + `IS_SHAPE_TOOL` + `SHAPE_KIND_OF` di `toolPresets.ts` sudah sinkron.
2. **Dispatch CanvasArea** (`CanvasArea.tsx`, 4110 baris): satu `onMouseDown` raksasa + `paintTo` / `retouchTo` / `distortTo` / `cloneTo` / `eraseBackgroundTo` / `magicEraseAt` / `historyBrushTo` / flood / gradient / shape / text. Pola proteksi photo-layer sudah ada: brush melukis di paint-layer transparan baru, eraser di-retarget ke stroke layer.
3. **BUG ERASER TERKONFIRMASI (keluhan user "menghapus BG/canvas")**:
   - Blok retarget eraser (baris ~3506) hanya mencakup `eraser | eraser-hard | eraser-soft | eraser-block`.
   - `background-eraser` dan `magic-eraser` TIDAK ikut retarget. `magicEraseAt` memakai `activeLayerId` mentah (baris 1292) sehingga Magic Eraser menghapus FOTO/BG langsung. Background Eraser juga menulis ke layer aktif apa adanya.
   - Di paint layer kosong, Magic Eraser flood di area transparan sehingga terasa mati (tidak ada feedback).
4. **Top bar** (`ToolOptionsBar.tsx`, 528 baris): peta `retouchHint` hanya mencakup ±50 tool lama. Tool 2026 (`brush-dry`, `heal-freckle`, `dodge-high`, `sponge-sat`, `blur-surface`, `eraser-soft/block`, `clone-soft`, `pattern-dots`, `fill-solid`, `gradient-diamond`, `pen-free`, `line-arrow`, `text-3d/neon/gradient`, shape baru, `sepia/bw/film-fade/split-tone/hdr`, dsb.) jatuh ke hint generik. Set `usesBrushSliders` / `needsColor` belum diaudit ulang untuk semua tool baru.
5. **Right panel** (`RightPanel.tsx`, 685 baris): 15 tab (Layers, Select, Mask, Adjust, Filter, Memory, Text, Color, RAW, Batch, Git, Art, Plug, Mock, Hist). Belum ada: tab Channels, tab Paths, tab Character/Paragraph, tab Brush Settings/Swatches, Layer Effects (drop shadow, glow, stroke), lock transparan/pixel terpisah,altime filter pencarian layer, dan Properties kontekstual ala Photoshop.
6. **Risiko regresi utama**: император `onMouseDown` raksasa + tidak ada test yang menegaskan kelengkapan registri. Setiap penambahan tool wajib diikuti test harness (Fase F).

---

## FASE A — Perbaikan total tools tanpa bug (satu per satu, per family)

Tujuan: 232 sub-tools yang ada SEMUANYA bekerja maksimal dan profesional. Tidak ada tool mati, tidak ada hint generik yang salah, tidak ada crash.

### A.0. Fondasi anti-regresi (kerjakan dulu sebelum menyentuh tools)
- [ ] A.0.1. Buat `src/engine/tools.test.ts`: assert setiap `ToolId` di `TOOL_FAMILIES` ada di union `ToolId`, ada di `TOOL_LABEL`/`TOOL_MAP`/`FAMILY_OF`, dan punya tepat satu jalur dispatch (paint | retouch | distort | crop | selection | shape | utility | click-action).
- [ ] A.0.2. Test assert setiap tool punya `description` + `usage` tidak kosong dan `shortcut` valid.
- [ ] A.0.3. Test assert tidak ada duplikat `id` antar family dan tidak ada family kosong.
- [ ] A.0.4. Jalankan `npm run typecheck` + `npm test` hijau sebagai baseline. Catat hasilnya di plan ini.

### A.1. Family Move (7 tools: move, artboard, path-select, direct-select, move-auto, transform-free, align-center)
- [ ] A.1.1. `move`: verifikasi drag + snap guides + Shift behavior + cursor.
- [ ] A.1.2. `artboard`: verifikasi create via shapeDrag kind artboard + masuk ArtboardPanel.
- [ ] A.1.3. `path-select`: verifikasi auto-aktif layer shape/text + notify bila kosong.
- [ ] A.1.4. `direct-select`: verifikasi rotate shape hanya bila spec ada + notify bila bukan shape/text.
- [ ] A.1.5. `move-auto`: verifikasi alpha pick per-pixel + fallback empty-area + tidak crash di luar kanvas.
- [ ] A.1.6. `transform-free`: verifikasi ensureTransform + drag + hint panel.
- [ ] A.1.7. `align-center`: verifikasi center tepat + history? (saat ini tanpa history: putuskan tambah history entry "Align center" agar undoable).

### A.2. Family Select Marquee (10 tools)
- [ ] A.2.1. `select-rect` / `select-ellipse` / `select-square`: drag, Shift tambah, Alt kurang, feather dari panel.
- [ ] A.2.2. `single-row` / `single-column`: klik 1px, tidak boleh dragBOARD berubah.
- [ ] A.2.3. `select-rounded`: radius konsisten + feather.
- [ ] A.2.4. `select-grow` / `select-shrink`: tepat ±4px + notify bila belum ada seleksi.
- [ ] A.2.5. `select-feather` / `select-border`: tepat 6px / (-4 + 2px) + notify bila belum ada seleksi.

### A.3. Family Lasso/Wand (15 tools)
- [ ] A.3.1. `select-lasso` freehand close-path + `select-polygon` click + double-click close.
- [ ] A.3.2. `magnetic-lasso`: snap + expand + feather.
- [ ] A.3.3. `object-select` / `quick-select`: brushSize memengaruhi expand.
- [ ] A.3.4. `wand` / `wand-plus` / `wand-minus`: tolerance dari options bar + grow/shrink 2px.
- [ ] A.3.5. `color-range`: hex pick + tolerance + event selection-changed.
- [ ] A.3.6. `select-subject`: wand dari titik klik (bukan tengah) + expand 3 + feather.
- [ ] A.3.7. `ai-subject` / `ai-bg-remove`: mask dibuat + notify refine.
- [ ] A.3.8. `sky-select` / `background-select` / `focus-select`: band 62%, corner tone, elips tengah + feather.

### A.4. Family Crop (16 tools)
- [ ] A.4.1. Semua rasio (`crop`, `perspective-crop`, `crop-169/43/11/32/free/straighten/219/45/916/golden`): kunci rasio saat drag + Enter apply + Esc cancel.
- [ ] A.4.2. `perspective-crop`: putuskan perilaku final (rect crop + notify) dan samakan dengan usage text.
- [ ] A.4.3. `crop-straighten`: reset viewRotate + history label benar.
- [ ] A.4.4. `slice` / `slice-select`: create, select, move, activeSlice highlight.
- [ ] A.4.5. `frame`: placeholder frame + render.
- [ ] A.4.6. `ai-upscale`: 2x semua layer + mask ikut membesar + undoable + notify dimensi.

### A.5. Family Measure (12 tools)
- [ ] A.5.1. `eyedropper`: pick dari composite + kembali ke brush + cursor hex.
- [ ] A.5.2. `color-sampler` / `sampler-avg`: pin max 8 + set brush color konsisten keduanya.
- [ ] A.5.3. `ruler` / `measure-angle` / `measure-area` / `protractor`: drag + label px/deg + tersimpan di measures (max 8 terakhir).
- [ ] A.5.4. `snap-toggle`: toggle + cursor ON/OFF.
- [ ] A.5.5. `note`: dialog teks + pin. `count`: nomor max+1 anti-duplikat.
- [ ] A.5.6. `guide-clear` / `grid-toggle`: klik langsung + cursor + notify.

### A.6. Family Brush (29 tools: 7 klasik + 8 sketch + 8 art + 6 manual 2026)
- [ ] A.6.1. Tiap paint tool: stamp terlihat, alpha/size/hardness dari slider, scatter hanya yang ber-scatter, composite benar (multiply/lighter/overlay).
- [ ] A.6.2. `mixer-brush` / `brush-wet` / `art-oil` / `art-smear`: wet-mix terlihat beda dari brush biasa.
- [ ] A.6.3. `pattern-stamp` / `texture-stamp` / `art-canvas` / `pattern-dots`: motif checker vs dots terlihat beda.
- [ ] A.6.4. `overlay-brush` / `sketch-neon` / `art-glaze` / `sketch-highlighter`: mode overlay/lighter, bukan source-over biasa.
- [ ] A.6.5. `art-poster` + `color-replacement`: dua tahap (paint lalu retouch) berjalan berurutan.
- [ ] A.6.6. Proteksi photo-layer: brush di foto SELALU buat paint layer baru + toast sekali + `lastPaintRef` tercatat.

### A.7. Family Eraser (6 tools) — PRIORITAS (keluhan user)
- [ ] A.7.1. Masukkan `background-eraser` + `magic-eraser` ke blok retarget photo-layer (samakan dengan 4 eraser lain).
- [ ] A.7.2. `magicEraseAt`: pakai `strokeLayerId` hasil retarget, bukan `activeLayerId` mentah.
- [ ] A.7.3. `eraseBackgroundTo`: pakai `strokeLayerId` hasil retarget (cek pemanggilan dari `paintTo` + alur `forceId`).
- [ ] A.7.4. Magic Eraser di paint layer kosong: beri feedback notify ("nothing to erase here") + jangan push history kosong.
- [ ] A.7.5. `eraser` / `eraser-hard` / `eraser-soft` / `eraser-block`: hardness 80/100/0/100 + alpha + cursor ring + hanya hapus stroke di paint layer, foto aman. Uji: lukis di foto → erase → foto utuh, stroke hilang.
- [ ] A.7.6. Eraser + `paintMask`: pastikan mengecat mask hitam (menyembunyikan), bukan menghapus pixel.
- [ ] A.7.7. Tambah test regresi: simulasi erase di photo layer → assert layer foto tidak berubah (hash pixel sama), stroke layer berubah.

### A.8. Family Heal (15 tools)
- [ ] A.8.1. `spot-heal` (heal), `healing-brush`/`patch` (heal-source + Alt source + hint sekali), `red-eye` (deteksi merah), `content-move`, `content-fill` (drag painting, sudah diperbaiki).
- [ ] A.8.2. Varian 2026 (`heal-dust/wrinkle/blemish/sky/skin/object/freckle/eye/teeth`): tiap mode retouch memberi efek visual berbeda + terdaftar di `RETOUCH_MAP`.

### A.9. Family Stamp (10 tools)
- [ ] A.9.1. `clone` / `clone-mirror` / `clone-rotate` / `clone-soft`: Alt source + snapshot anti-smear per stroke + alpha soft 60%.
- [ ] A.9.2. `pattern-stamp` / `pattern-dots` / `texture-stamp`: cache motif per (size,color,kind).
- [ ] A.9.3. `pattern-fill`: respect selection + locked/hidden guard + history.
- [ ] A.9.4. `history-brush` / `art-history-brush`: source = snapshot pra-stroke + pre-render canvas per stroke.

### A.10. Family Tone (18 tools) + Detail (26 tools) + LocalFX (17 tools)
- [ ] A.10.1. Tiap `RetouchMode` (61 mode) memberi perubahan pixel terukur: buat test loop yang menjalankan `retouchTo`-setara per mode di atas kanvas uji dan assert ada pixel berubah (kecuali mode yang memang no-op di kondisi tertentu).
- [ ] A.10.2. `liquify`/`warp` legacy → smudge + pickSmudgeColor tiap dab awal.
- [ ] A.10.3. Distort 8 kind: twirl/ccw, pinch, spherize, ripple, wave, zigzag, crystal — tiap kind mengubah blok dab secara berbeda + scratch pool dipakai.
- [ ] A.10.4. `ai-denoise` / `ai-colorize` / `ai-sky`: tambah filter/adjustment yang benar + notify.

### A.11. Family Paint (6), Vector (5), Type (9), Shape (19), Navigate (11)
- [ ] A.11.1. Gradient linear/radial/diamond: selection-safe via temp canvas (tidak menghapus luar seleksi) + gradTo + opacity.
- [ ] A.11.2. `fill` flood + tolerance + OOM guard 9MP + `fill-solid` / `fill-clear` selection-safe.
- [ ] A.11.3. `pen` / `pen-free` / `line` (+Shift 45°) / `line-arrow` (kepala panah) / `curvature-pen` (S-curve): ketebalan dari brushSize, history per garis.
- [ ] A.11.4. Text 9 varian: render benar (outline/glow/shadow/arc/3d/neon/gradient), spec tersimpan, undoable, vertical CJK.
- [ ] A.11.5. Shape 19 kind: render benar di `textShape.ts` + transform presisi (center + skala dari base rw/rh, bukan w/W) + Shift square untuk rect/ellipse/rounded/donut.
- [ ] A.11.6. Navigate: hand/pan, rotate-view drag + double-click reset, zoom click/Alt, zoom-50/100/200/400/800/fit, rotate-reset. Cursor per tool benar.

### A.12. Kunci penerimaan Fase A
- [ ] Semua 232 tools lolos `tools.test.ts` baru.
- [ ] `npm run typecheck` hijau, `npm test` hijau.
- [ ] QA manual per family (checklist di atas) dicentang dengan bukti perilaku.
- [ ] Tidak ada `TODO`/`FIXME` baru yang terkait tools.

---

## FASE B — Perbaikan eraser tuntas (proteksi BG/canvas)

> Ini fase khusus karena keluhan eksplisit user. Boleh dikerjakan langsung setelah A.0 + A.7, tanpa menunggu Fase A selesai total.

- [ ] B.1. Satukan logika retarget dalam satu fungsi `resolveStrokeTarget(tool, activeId): { id, kind }` dipakai paint + semua 6 eraser + background/magic eraser. Hapus duplikasi cabang.
- [ ] B.2. Aturan emas (tulis sebagai komentar + test):
  1. Brush/retouch di photo layer → paint layer transparan baru.
  2. Eraser apa pun TIDAK PERNAH menulis ke photo layer; selalu ke stroke layer (last paint atau topmost editable).
  3. `background-eraser`/`magic-eraser` mengikuti aturan 2 (sekarang dilanggar).
  4. Undo mengembalikan pixel persis (snapshot pra-stroke).
- [ ] B.3. Tambah indikator visual: saat eraser aktif dan target = stroke layer di atas foto, tampilkan badge "Erasing: <nama layer>" di HUD (sebagian sudah ada via setCursor, pastikan konsisten 6 tool).
- [ ] B.4. Kasus uji manual wajib: (1) buka foto, lukis, erase → foto utuh; (2) magic eraser klik langit di foto → hanya stroke layer yang berubah / notify bila kosong; (3) background eraser di tepi objek foto → foto tidak bolong di luar stroke; (4) undo tiap langkah kembali sempurna.
- [ ] B.5. Test otomatis: `eraser.test.ts` — buat doc uji + foto dummy + stroke dummy, jalankan path retarget, assert hash foto sama + hash stroke berubah.

---

## FASE C — Ratusan sub-tools baru (target: 232 → 400+, semua berfungsi)

Aturan keras tiap tool baru (tanpa kecuali):
1. Terdaftar di 7 titik: `ToolId`, `TOOL_FAMILIES` (id, icon, label, shortcut, description, usage), preset/map yang sesuai (`PAINT_TOOLS`+`paintPreset` | `RETOUCH_MAP` | `DISTORT_MAP` | `CROP_RATIOS`+`IS_CROP_TOOL` | `IS_SELECTION_TOOL` | `IS_SHAPE_TOOL`+`SHAPE_KIND_OF`), hint `ToolOptionsBar`, pesan `toolFallback` bila utility, dispatch `CanvasArea`, shortcut/cycle.
2. Punya efek visual BERBEDA dari saudaranya (dilarang clone rasa).
3. Punya history entry + cursor + notify bila click-action.
4. Lolos `tools.test.ts` (otomatis ikut karena berbasis registri).
5. Mendukung editing foto/gambar (bukan hiasan).

### C.1. Brush +30 (photo-painting primero)
- Kering/basah lanjutan: `dry-flat`, `dry-round`, `wet-glaze`, `wet-palette`, `oil-fan`, `oil-filbert`, `water-bloom`, `water-salt`, `gouache-flat`, `gouache-velvet`, `acrylic-bristle`, `air-soft`, `air-texture`, `pencil-2b`, `pencil-6b`, `charcoal-vine`, `chalk-oil`, `crayon-wax`, `pastel-hard`, `ink-brush`, `ink-nib`, `liner-fine`, `marker-chisel`, `neon-tube`, `glow-soft`, `glitter-fine`, `glitter-chunk`, `smoke-thin`, `smoke-bill`, `fur-short`.
- Tiap preset: hardness/alphaMul/composite/sizeMul/scatter berbeda + masuk `paintPreset` via case baru (bukan default generik).

### C.2. Heal/Retouch +24 (fokus foto wajah & produk)
- Noda & kulit: `heal-mole`, `heal-acne`, `heal-scar-fade`, `heal-shine` (kurangi kilap minyak), `heal-pores`, `heal-tan-line`, `heal-veins` (mata merah veins), `heal-chapped` (bibir), `heal-stray-hair`, `heal-flyaway`.
- Produk & scene: `heal-price-tag` (penghapus label harga), `heal-tourist`, `heal-wire` (kabel listrik), `heal-trash`, `heal-reflection`, `heal-glare`, `heal-shadow-lift`, `heal-fog-cut`, `heal-grain-match`, `heal-texture-copy`, `heal-fabric`, `heal-glass`, `heal-chrome`, `heal-rust-spot`.
- Petakan ke mode retouch baru yang benar-benar beda algoritmanya (tambah `RetouchMode`: `shine`, `pores`, `fogcut`, `glare`, `lift`, `grainmatch`, ...), bukan alias semua ke `dust`.

### C.3. Tone/Light +20 (grading foto profesional)
- `dodge-mid`, `dodge-detail`, `burn-edge`, `burn-depth`, `sponge-warm`, `sponge-cool`, `vibrance-skin`, `vibrance-foliage`, `temp-sunset`, `temp-arctic`, `tint-cinema`, `clarity-skin` (clarity negatif lembut), `clarity-detail`, `dehaze-sky`, `dehaze-portrait`, `grain-push`, `grain-pull`, `fade-blacks`, `fade-whites`, `split-gold` (split tone emas-biru).

### C.4. Detail/Blur Gallery +18
- `blur-tilt-strong`, `blur-zoom` (radial zoom), `blur-spin` (radial spin), `blur-frosted` (kaca buram), `blur-mosaic-soft`, `sharpen-halo-fix`, `sharpen-print`, `sharpen-screen`, `clarity-structure`, `denoise-luma`, `denoise-chroma`, `grain-35mm`, `grain-120mm`, `grain-push2`, `lens-swirl` (bokeh putar), `lens-bubble`, `motion-zoom`, `motion-spin`.

### C.5. Distort/Warp +14
- `distort-bulge`, `distort-dent`, `distort-squeeze`, `distort-stretch`, `distort-swirl-tight`, `distort-waves-big`, `distort-glass` (refraksi), `distort-heat` (haze panas), `distort-melt`, `distort-flag` (bendera), `distort-ripple-big`, `distort-arc-top`, `distort-arc-bottom`, `distort-perspective` (indikasi manual + panel Transform).

### C.6. Select/Mask +16
- Marquee: `select-circle` (lock lingkaran), `select-stadium`, `select-crosshair` (dari titik tengah), `select-last` (muat seleksi terakhir), `select-inverse-click`, `select-feather-2/4/12` (varian feather cepat), `select-grow-2/8`, `select-border-4/12`.
- Lasso: `lasso-straight` (hold-Shift snap 45°), `wand-flood` (flood tanpa batas toleransi adaptif), `range-skin`, `range-sky`, `range-greens` (color-range preset foto).

### C.7. Crop/Frame +10
- Rasio foto: `crop-55` (5:4 large format), `crop-65` (6:4.5 medium format), `crop-11-max`? (ganti: `crop-a4`, `crop-letter`, `crop-47` passport 4:6? , `crop-58` moto 5:7?), overlay bantu: `crop-thirds`, `crop-diagonal`, `crop-triangle-guide`, `crop-golden-spiral`, `crop-center-dot`.
- Implementasi jujur: rasio via `CROP_RATIOS`, overlay via render guide saat cropDrag aktif (bukan janji palsu).

### C.8. Paint/Fill/Gradient +12
- Gradient: `gradient-conic` (aproksimasi angular), `gradient-diamond-soft`, `gradient-reflected` (mirror), `gradient-noise` (dithered blend anti-banding), `gradient-fg-transparent` (shortcut preset).
- Fill: `fill-foreground`, `fill-background`, `fill-pattern-new` (tile 3 motif baru: dots/stripes/grid), `fill-content-click` (content fill sekali klik), `fill-history-click`, `fill-transparent-protect` (fill menjaga transparan), `bucket-contiguous` vs `bucket-global` (toggle flood).

### C.9. Vector/Pen/Shape +22
- Pen: `pen-anchor` (tambah anchor), `pen-delete-anchor`, `pen-convert` (smooth/corner), `pen-stroke-thin/medium/bold` (preset ketebalan), `pen-dashed`, `pen-arrow-both`.
- Shape baru: `shape-trapezoid-wide`, `shape-parallelogram`, `shape-pentagon`, `shape-octagon`, `shape-shield`, `shape-badge`, `shape-ribbon`, `shape-cloud`, `shape-speech`, `shape-gear`, `shape-drop` (tetes), `shape-leaf`, `shape-lightning`, `shape-crown`, `shape-pin` (map pin), `shape-ticket`.
- Tiap shape: path di `textShape.ts` + `SHAPE_KIND_OF` + uji render tidak kosong.

### C.10. Type +10
- `text-typewriter`, `text-blocky` (pixel font render), `text-condensed` (scaleX 0.8), `text-expanded` (scaleX 1.25), `text-emboss`, `text-engrave`, `text-chrome` (gradient abu metalik), `text-fire` (gradient oranye + glow), `text-ice` (gradient biru + glow), `text-retro` (bayangan ganda offset).

### C.11. Measure/Annotate/Navigate +12
- `ruler-triple` (3 titik), `measure-dpi` (hitung dari ukuran cetak), `guide-mid` (tambah center H+V), `guide-thirds` (grid 3x3 guides), `guide-clear-one` (hapus guide terdekat), `grid-pixel` (grid 1px saat zoom 800), `note-color` (pin warna), `count-auto` (hitung blob kontras otomatis), `sampler-3x3`, `sampler-11x11`, `zoom-marquee` (drag zoom area), `rotate-15` (snap 15°).

### C.12. Kunci penerimaan Fase C
- [ ] Total sub-tools ≥ 400, tiap family bertambah, tidak ada family yang stagnan.
- [ ] `tools.test.ts` tetap hijau (registri lengkap otomatis).
- [ ] Uji visual sampling: tiap tool baru dibuka di flyout + dipakai sekali di kanvas uji, hasilnya berbeda dari tool terdekat.
- [ ] `ToolOptionsBar` punya hint + slider yang tepat untuk SEMUA tool baru (tanpa fallback generik yang menyesatkan).
- [ ] Shortcut tidak bertabrakan; cycling family tetap rapi.

---

## FASE D — Right panel bekerja seperti Photoshop + upgrade UI/UX

### D.1. Tab Layers (prioritas 1, dipakai tiap menit)
- [ ] D.1.1. Thumbnail live 40px tetap update tiap stroke (pakai tick, bukan full re-render).
- [ ] D.1.2. Blend mode: 27 mode sudah ada — verifikasi tiap mode memengaruhi composite (`blendToComposite`) + grouping di dropdown.
- [ ] D.1.3. Opacity slider + Fill slider terpisah (Photoshop punya keduanya; saat ini Fill belum ada → tambah `fillOpacity` di meta + render).
- [ ] D.1.4. Lock terpisah: lock pixels vs lock position vs lock all (saat ini satu `locked` → pecah jadi `lockPixels`, `lockPosition`, hormati di paint/move/erase).
- [ ] D.1.5. Klik thumbnail = properti layer; double-click nama = rename inline (saat ini via dialog? samakan satu pola).
- [ ] D.1.6. Filter/search layer (by name/kind), kind filter sudah ada (all/raster/text/shape/background) → tambah "visible only", "locked only".
- [ ] D.1.7. Layer Effects (fx): Drop Shadow, Outer Glow, Inner Glow, Stroke — panel + render non-destruktif di composite + tersimpan di `.avx`.
- [ ] D.1.8. Clipping mask toggle per layer + indikator + render benar.
- [ ] D.1.9. Merge Down (sudah ada) + Merge Visible + Flatten Image + Stamp Visible (Ctrl+Shift+Alt+E) — verifikasi satu per satu + konfirmasi destruktif.
- [ ] D.1.10. Link layers (multi-select + gerak bersama) — minimal: shift-klik multi active + move berlaku ke semua terpilih.
- [ ] D.1.11. New Fill/Adjustment/Photo layer via panel (solid color, gradient, pattern) sebagai layer asli.
- [ ] D.1.12. Group (folder) layers: buat group, collapse, pindah massal, opacity grup.

### D.2. Tab Properties kontekstual (ala Photoshop Properties)
- [ ] D.2.1. Panel Properties baru yang isinya mengikuti seleksi/tool: shape → fill/stroke/width/sides; text → font/size/color/bold/italic/tracking/leading; mask → feather/density; transform → x/y/scale/rotation; crop → ratio; image → dimensi/mode.
- [ ] D.2.2. Quick Actions kontekstual: Rasterize Type/Shape, Make Clipping Mask, Convert to Smart Object (aproksimasi jujur: bekukan + tandai), Merge, Trim, Reveal All.

### D.3. Tab baru yang belum ada
- [ ] D.3.1. **Channels**: R/G/B composite + alpha mask channel per layer mask; klik channel = seleksi dari luminance; toggle visibility per channel.
- [ ] D.3.2. **Paths**: daftar path pen (dari penDrag yang disimpan, bukan dibuang); stroke path dengan brush; path → selection; delete path.
- [ ] D.3.3. **Character + Paragraph**: font family list, size, tracking, leading, align, warp preset (arc di 2026 sudah ada — ekspos di sini).
- [ ] D.3.4. **Brush Settings**: spacing, jitter, scatter, texture toggle, dual-brush aproksimasi, smoothing; tersimpan per preset + dipakai `paintTo`.
- [ ] D.3.5. **Swatches**: set warna foto (skin/sky/foliage/brand) + custom user + klik = set brush color.

### D.4. Tab yang sudah ada — audit satu per satu
- [ ] D.4.1. Select: feather/tolerance/expand/contract/inverse/save-load selection — semua tombol bekerja + sinkron dengan seleksi kanvas.
- [ ] D.4.2. Mask: add/enable/feather/density/invert/delete + paintMask toggle + thumbnail mask.
- [ ] D.4.3. Adjust: 18 tipe adjustment — tiap tipe ada kontrol + enable/opacity/reorder/delete + preset simpan/muat.
- [ ] D.4.4. Filter: tiap filter ada kontrol + stack + gallery preview.
- [ ] D.4.5. Text: sinkron penuh dengan TextShapePanel + layer text terpilih.
- [ ] D.4.6. Color: picker + sampler list sinkron + working space + proof.
- [ ] D.4.7. RAW: semua slider memengaruhi develop + reset + indikator isRaw.
- [ ] D.4.8. Batch: queue tambah/jalankan/hapus + progress + log error per file.
- [ ] D.4.9. Git: snapshot/branch/compare/restore — verifikasi tidak merusak layerManager.
- [ ] D.4.10. Artboard: create/rename/resize/export per artboard.
- [ ] D.4.11. Plugin: install/enable/disable + sandbox error tidak crash app.
- [ ] D.4.12. Mockup: warp perspektif + render + reset.
- [ ] D.4.13. Memory/Lab: angka akurat (bukan placeholder) + tombol aksi nyata.
- [ ] D.4.14. History: undo/redo/jump + label jelas + clear + thumbnail (bila ada).

### D.5. Upgrade UI/UX panel kanan
- [ ] D.5.1. Tab bar: ikon + label + badge count (mis. Adjust(3), Filter(2)), overflow scroll, tooltip.
- [ ] D.5.2. Panel sections collapsible dengan ingatan state per tab.
- [ ] D.5.3. Empty states yang mengajari (bukan panel kosong): tiap tab kosong menampilkan 1 kalimat + tombol aksi utama.
- [ ] D.5.4. Konsistensi: slider + color input + number input satu gaya; Enter = apply, Esc = revert di semua numeric field.
- [ ] D.5.5. Density: padding/spacing seragam; panel 264px tetap muat tanpa scroll ganda.
- [ ] D.5.6. Aksesibilitas: semua kontrol bisa keyboard (Tab/Enter/panah), focus ring terlihat.
- [ ] D.5.7. Tidak ada teks Indonesia di UI; tidak ada placeholder mati ("coming soon" dilarang — yang belum jadi tidak ditampilkan).

---

## FASE E — Top tools bar (ToolOptionsBar) lengkap + perbanyak, semua normal

### E.1. Cakupan total (definisi selesai)
- [ ] E.1.1. Tiap dari 400+ ToolId menampilkan bar yang BENAR: nama tool + hint spesifik + kontrol yang relevan (tidak ada bar kosong, tidak ada hint tool lain).
- [ ] E.1.2. Matriks keputusan top bar didokumentasikan di komentar kode: paint→(color+size+hard+strength+flow?), retouch→(size+hard+strength), selection→(tolerance/feather/expand), crop→(ratio+apply/cancel), shape→(fill/stroke/width), text→(font/size/color), gradient→(gradTo+mode), measure→(unit), navigate→(info), click-action→(tombol aksi langsung, mis. Align Center = tombol "Center Now").
- [ ] E.1.3. Tambah kontrol yang hilang: Flow (paint), Spacing (paint), Tolerance (wand/fill/bg-eraser), Contiguous toggle (fill/magic), Sample: Current/All Layers (eyedropper/stamp/heal), Aligned toggle (clone/heal), Angle+Roundness (brush), Blend mode dropdown (brush), Pattern picker (pattern tools), Feather (select), Width/Height live (shape drag), Font/Size (text), Exposure stops (dodge/burn), Strength (semua retouch — sudah ada, verifikasi).

### E.2. Perbanyak fungsi top bar (bukan sekadar label)
- [ ] E.2.1. Brush: Size, Hardness, Strength, Flow, Spacing, Angle, Roundness, Blend, Color — semua live memengaruhi `paintTo`/`brushSprite` (tambah `brushFlow`, `brushSpacing`, `brushAngle`, `brushRound`, `brushBlend` di store + engine).
- [ ] E.2.2. Eraser: Size, Hardness, Strength, Mode note "photo-safe" + tombol "Erase All Strokes on Layer" (dengan konfirmasi).
- [ ] E.2.3. Clone/Heal: Size, Strength, Sample (Current/Below/All), Aligned toggle, Source indicator + "Clear source" button.
- [ ] E.2.4. Select: New/Add/Subtract/Intersect mode buttons (Shift/Alt sudah ada — ekspos sebagai tombol), Feather, Tolerance, Expand, tombol Grow/Shrink/Inverse/Feather sekali klik.
- [ ] E.2.5. Crop: preset ratio pills (semua 12 rasio), overlay guide pills (thirds/diagonal/spiral), Apply/Cancel, Straighten angle.
- [ ] E.2.6. Shape: Fill, Stroke, Stroke width, Sides, tombol flip H/V — live ke `shapeSpecs` + re-render.
- [ ] E.2.7. Text: Font, Size, Bold/Italic, Color, Tracking, Leading — live ke `textSpecs` + re-render.
- [ ] E.2.8. Gradient: Mode (linear/radial/diamond/conic), gradTo (transparent/white/black), Reverse, Dither toggle.
- [ ] E.2.9. Fill: Tolerance, Contiguous, Sample size note; Pattern: motif picker (checker/dots/stripes/grid baru).
- [ ] E.2.10. Measure: Unit (px/inch/cm pada 72/300 DPI), Clear pins; Note/Count: Clear; Guide: Clear; Grid: Size.
- [ ] E.2.11. Navigate: Zoom %, Fit, 100%, Rotate deg + Reset; Move: X/Y/center buttons; Align: 6 tombol align + distribute.
- [ ] E.2.12. Mask mode indicator: saat `paintMask` aktif, top bar brush/eraser menampilkan badge "MASK" + tombol keluar mode.

### E.3. Kunci penerimaan Fase E
- [ ] E.3.1. Checklist 400+ tool × bar benar (bisa dibangkitkan semi-otomatis: screenshot tiap tool? minimal tabel checklist di plan ini dicentang per family).
- [ ] E.3.2. Setiap slider/toggle/dropdown diuji mengubah perilaku nyata di kanvas (bukan pajangan).
- [ ] E.3.3. Bar tidak overflow di 1280px: grup kontrol collapsible/ellipsis + tooltip.

---

## FASE F — Verifikasi total (definisi "tanpa bug")

- [ ] F.1. `npm run typecheck` hijau.
- [ ] F.2. `npm test` hijau termasuk `tools.test.ts` + `eraser.test.ts` baru.
- [ ] F.3. Skrip audit registri (bagian dari test): 0 tool tanpa dispatch, 0 tool tanpa hint, 0 shortcut ganda dalam satu family, 0 family kosong.
- [ ] F.4. QA matrix manual: tiap family × (paint/click/drag × undo/redo × locked layer × hidden layer × selection aktif × mask mode) — catat lolos/gagal per sel.
- [ ] F.5. Uji foto asli: buka JPG 24MP → retouch tiap family heal/tone/detail → erase → undo semua → save/reopen `.avx` identik.
- [ ] F.6. Uji regresi eraser khusus (B.4) diulang tiap rilis.
- [ ] F.7. Tidak ada string Indonesia di UI; tidak ada em-dash; tidak ada `console.log` debug.

---

## Urutan eksekusi yang disarankan

1. A.0 (harness) → 2. A.7 + Fase B (eraser, keluhan user) → 3. A.1–A.6, A.8–A.11 (per family) → 4. Fase C (tambah ratusan tool, per sub-family C.1–C.11) → 5. Fase E (top bar, karena butuh daftar tool final) → 6. Fase D (right panel, karena butuh engine + tool final) → 7. Fase F (verifikasi total).

Perkiraan file yang disentuh: `useEditorStore.ts` (ToolId + brush/layer fields), `toolPresets.ts`, `ToolBar.tsx`, `CanvasArea.tsx` (dispatch + engine fungsi), `ToolOptionsBar.tsx`, `toolFallback.ts`, `textShape.ts`, `selection.ts`, `layerManager.ts`, `RightPanel.tsx` + 15 panel anak, `shortcuts.ts` + `CommandPalette.tsx` (agar ratusan tool baru tetap tercari), `projectIo.ts` (persist field baru: fillOpacity, locks, fx, paths, brush settings, swatches), `tools.test.ts` + `eraser.test.ts` (baru).
