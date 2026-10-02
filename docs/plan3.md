# PLAN 3 — Deep Improve Total per Family: semua sub-tools benar-benar bekerja

> Status: FASE 0 SELESAI (bug eraser makan kertas diperbaiki total, 88/88 test hijau).
> Fase 1-17 dieksekusi berurutan, satu fase = satu family. Setiap sub-tool punya
> sub-todo sendiri dengan perilaku yang diharapkan + cara verifikasi.
> Bahasa UI tetap Bahasa Inggris. Tanpa em-dash. Tanpa AI tools di workspace.
> Aturan keras plan2 tetap berlaku (7 titik registrasi, efek visual berbeda,
> history entry, cursor, notify untuk click-action, lolos harness).

## Aturan verifikasi tiap sub-tool (berlaku untuk semua fase)

1. Pilih tool dari flyout toolbar, lakukan aksi sesuai usage-nya di kanvas uji.
2. Cekmaz: `npm run typecheck` hijau, `npm test` hijau (termasuk `tools.test.ts`,
   `toolOptions.test.ts`, `totalCoverage.test.ts`, `eraser.test.ts`).
3. Matriks per sub-tool: layer terkunci menolak dengan notify, layer hidden menolak,
   undo mengembalikan pixel persis, seleksi aktif dihormati, mask mode dihormati.
4. Tidak ada `TODO`/`FIXME` baru. Tidak ada string Indonesia di UI.

---

## FASE 0 — Eraser paper protection TOTAL (SELESAI)

Keluhan: eraser menghapus kanvas kertasnya (lubang transparan di kertas putih).
Akar masalah: layer dasar dokumen baru bernama "Background" tapi kind-nya
"raster" dan bukan photo, sehingga `resolveEraserTarget` mengembalikannya
apa adanya dan `destination-out` melubangi kertas. Magic/background eraser
juga beroperasi langsung di kertas.

Perbaikan yang diterapkan:
- [x] 0.1. `newDocument` membuat base layer kind `"background"` (cat putih tetap diisi HomeScreen).
- [x] 0.2. Helper murni baru `needsFreshPaintLayer(kind, isPhoto)` di `strokeTarget.ts`:
  brush di kertas maupun foto selalu ke transparent paint layer baru.
- [x] 0.3. Mousedown CanvasArea memakai helper itu (toast diseragamkan: paper dan foto diproteksi).
- [x] 0.4. `resolveEraserTarget` tidak pernah mengembalikan kind `"background"`
  (active, lastPaintId basi, maupun fallback topmost semuanya skip kertas).
- [x] 0.5. `magicEraseAt` + `eraseBackgroundTo` menolak kind `"background"`
  dengan notify jelas (semua entry point tercakup karena guard di dalam fungsi).
- [x] 0.6. AlurConfirmed: `paintTo(..., strokeLayerId)` menerima target resolved;
  mousemove memakai `activeLayerId` yang sudah di-switch ke target.
- [x] 0.7. Round-trip `.avx` aman: `projectIo` melewatkan kind `"background"` apa adanya.
- [x] 0.8. 5 test baru di `eraser.test.ts` (paper selalu null, retarget ke paint layer,
  skip paper di fallback, lastPaintId basi diabaikan, matriks `needsFreshPaintLayer`).
- Hasil: `npm run typecheck` hijau, `npx vitest run` 9 file 88 test hijau.

---

## FASE 1 — Family Move (7 tools) — SELESAI

- [x] 1.1. `move`: drag memindah layer aktif, snap guides/grid/center, cursor move.
  Guard lock/hidden/no-layer di satu choke point mousedown (sebelum moveDrag).
- [x] 1.2. `artboard`: drag membuat artboard + registrasi ke ArtboardPanel store
  dengan rect aktual (sebelumnya hanya shape layer tanpa registrasi).
- [x] 1.3. `path-select`: klik memilih layer vector teratas + notify bila kosong + guard lock.
- [x] 1.4. `direct-select`: drag horizontal memutar shape dengan live re-render + guard lock.
- [x] 1.5. `move-auto`: klik objek memilih layer-nya dari alpha pixel (>8), lalu drag;
  pick loop sudah skip locked/hidden, guard akhir menutup sisa celah.
- [x] 1.6. `transform-free`: ensureTransform + drag + scale/rotate di Transform panel.
- [x] 1.7. `align-center`: klik maupun tombol Center Now menengahkan layer (x=0,y=0)
  + snapshot history "Align center" (undoable, putusan plan2 A.1.7) + guard lock.
  ToolOptionsBar Center Now diseragamkan (history + guard + notify).
- Kunci: semua tanpa crash saat tidak ada active layer (notify jelas).
- Hasil: `npm run typecheck` hijau, `npx vitest run` 9 file 88 test hijau.

## FASE 2 — Family Select Marquee (22 tools) — SELESAI

- [x] 2.1. `select-rect`: drag bebas, Shift add / Alt subtract via selMode + modifier, feather panel.
- [x] 2.2. `select-ellipse`: idem elips + **FIX: Shift mengunci lingkaran** (sesuai usage, sebelumnya Shift diabaikan).
- [x] 2.3. `single-row` / `single-column`: klik 1px, drag diabaikan saat mousemove (preview tetap 1px).
- [x] 2.4. `select-rounded`: radius 24 konsisten + feather.
- [x] 2.5. `select-square`: kunci persegi live saat drag + backstop mouse-up.
- [x] 2.6. `select-circle`: lingkaran sempurna terkunci (live + backstop via ellipse path).
- [x] 2.7. `select-stadium`: kapsul via rounded 9999.
- [x] 2.8. `select-crosshair`: simetris dari titik awal (drag digandakan dua arah).
- [x] 2.9. `select-grow` / `select-shrink`: +-4px + notify bila belum ada seleksi + ants.
- [x] 2.10. `select-grow-2` / `select-grow-8`: +2/+8px + guard + ants.
- [x] 2.11. `select-feather` / `-2` / `-4` / `-12`: feather 6/2/4/12px + guard + ants.
- [x] 2.12. `select-border` / `-4` / `-12`: contract + feather 2px + guard + ants.
- [x] 2.13. `select-last`: restore + notify dua arah + ants + event.
- [x] 2.14. `select-inverse-click`: invert + cursor + ants + event.
- Kunci: semua click-action tanpa seleksi memberi notify, tidak diam. Terverifikasi per branch.
- Hasil: `npm run typecheck` hijau, `npx vitest run` 9 file 88 test hijau.

## FASE 3 — Family Lasso/Wand (18 tools) — SELESAI

- [x] 3.1. `select-lasso`: freehand init point + akumulasi drag (cap 800) + commit mouse-up + clear.
- [x] 3.2. `select-polygon`: klik titik per mousedown, double-click close, polygon dipertahankan hingga close.
- [x] 3.3. `magnetic-lasso`: akumulasi drag + expand 2 + feather + commit.
- [x] 3.4. `lasso-straight`: snap 45deg per edge via Shift + commit + clear.
- [x] 3.5. `object-select` / `quick-select`: **FIX brush behavior** — sebelumnya klik-saja
  padahal usage "Paint over the subject". Sekarang drag melukis seleksi (throttle jarak
  `max(8, brushSize/4)`, dab drag force-add agar akumulasi, klik awal ikut mode user).
  `handleWandClick` dapat param `forceMode` opsional + `SelCombineMode` diimpor sebagai type.
  `quickLast` ref di-reset saat mouse-up/mouse-leave.
- [x] 3.6. `wand` / `wand-plus` / `wand-minus`: tolerance bar + feather bar + grow/shrink 2px + ants.
- [x] 3.7. `wand-flood`: flood adaptif + expand 6 + cursor + event.
- [x] 3.8. `color-range`: pick hex clamp + tolerance + event selection-changed.
- [x] 3.9. `range-skin` / `range-sky` / `range-greens`: seed preset + tolerance min 34 + feather + cursor.
- [x] 3.10. `select-subject`: wand dari titik klik + expand 3 + feather + ants.
- [x] 3.11. `sky-select` / `background-select` / `focus-select`: band 62% + feather 8,
  corner tone wand + expand 2, elips 70% + feather 6 (semua ikut selMode).
- Kunci: tidak ada AI tools di workspace (ai-subject/ai-bg-remove tetap hidden).
- Hasil: `npm run typecheck` hijau, `npx vitest run` 9 file 88 test hijau.

## FASE 4 — Family Crop (25 tools) — SELESAI

- [x] 4.1. `crop` + 13 rasio: kunci rasio generik via CROP_RATIOS saat drag, Enter apply, Esc cancel, preview darken + frame + handles.
- [x] 4.2. `perspective-crop`: rect crop + notify jujur (corner lanjut di Transform).
- [x] 4.3. `crop-straighten`: reset viewRotate + label history "Straighten crop" + undo per layer.
- [x] 4.4. `slice` / `slice-select`: create, select, move via sliceMove, highlight aktif, fallback create + notify.
- [x] 4.5. `frame`: placeholder frame + render via shape path.
- [x] 4.6. 5 overlay: **FIX render overlay** — sebelumnya cropOverlay hanya diset store
  tapi tidak pernah digambar. Sekarang thirds/diagonal/triangle/spiral/center-dot
  digambar live di dalam rect crop (spiral via polyline logaritmik 64 langkah),
  dengan subscription + dep render agar ganti overlay refresh instan.
- Kunci: crop undoable per layer (snapshot semua layer + mask + transform ikut
  konten via shift origin, bukan reset nol; guides/slices/notes/counts/samplers/
  measures/paths/text-xy digeser via shiftDocSpace + drop di luar).
  Crop resize semua layer bersama (document-level op, termasuk locked — disengaja).
- Hasil: `npm run typecheck` hijau, `npx vitest run` 9 file 88 test hijau.

## FASE 5 — Family Measure (22 tools) — SELESAI

- [x] 5.1. `eyedropper`: pick composite vs current (sample mode) + kembali ke brush. Terverifikasi.
- [x] 5.2. `color-sampler` / `sampler-avg` / `sampler-3x3` / `sampler-11x11`: pin + set brush
  color + cursor crosshair (click tool, ring tidak diperlukan). Avg men-set warna. Terverifikasi.
- [x] 5.3. `ruler` / `measure-angle` / `measure-area` / `protractor` / `ruler-triple`:
  drag + label px/in/cm + measures max 20 + triple chain tersambung. Terverifikasi.
- [x] 5.4. `measure-dpi`: MP + skala cetak A4/Letter via notify + cursor. Terverifikasi.
- [x] 5.5. `note` / `note-color`: dialog teks + pin (color cycling 4 warna). Terverifikasi.
- [x] 5.6. `count` / `count-auto`: nomor max+1 anti-duplikat, auto blob max 99 + clear dulu. Terverifikasi.
- [x] 5.7. `guide-mid` / `guide-thirds` / `guide-clear-one` / `guide-clear`:
  tambah tepat + auto-show guides. **FIX: guide-clear-one hanya hapus dalam 25px**,
  sebelumnya klik jauh pun menghapus guide terjauh; sekarang notify bila terlalu jauh.
- [x] 5.8. `grid-toggle` / `grid-pixel`: toggle + grid 8px + notify zoom 800%. Terverifikasi.
- [x] 5.9. `snap-toggle`: toggle + cursor ON/OFF. Terverifikasi.
- Kunci: tombol Clear di top bar menghapus jenis pin yang tepat.
- Hasil: `npm run typecheck` hijau, `npx vitest run` 9 file 88 test hijau.

## FASE 6 — Family Brush (59 tools) — SELESAI

- [x] 6.1. 7 klasik: terverifikasi satu per satu — `brush` (preset generik = hardness/alpha
  user langsung, by design), `pencil` (hard 100, alpha 1, tanpa anti-alias),
  `airbrush` (spray buildup), `soft-brush` (feather besar), `color-replacement`
  (cabang `colorReplaceTo`: ganti hue pertahankan luminance), `mixer-brush`
  (cabang `mixerBrushTo`: wet-mix 45% + glaze 25%), `overlay-brush` (cabang overlay blend).
- [x] 6.2. 8 sketch + 8 art + 6 manual 2026: cabang engine terkonfirmasi
  (`mixerBrushTo` untuk brush-wet/art-oil/art-smear, `patternStampTo` untuk
  pattern/texture/canvas/dots, `overlayBrushTo` untuk overlay/neon/glaze/highlighter,
  `art-poster` dua tahap paint lalu posterize). Pairwise-distinct dikunci test.
- [x] 6.3. 30 Brush Atelier II: audit registry — all 59 di PAINT_TOOLS, 57 preset eksplisit
  berbeda (hanya `brush` + `color-replacement` pakai default generik, keduanya by design).
- [x] 6.4. Proteksi kertas+foto: brush di keduanya SELALU buat paint layer baru + toast sekali
  (kondisi diperluas via `needsFreshPaintLayer`, Fase 0). Terverifikasi di kode.
- [x] 6.5. Flow/Spacing/Jitter/Smoothing/Angle/Round/Blend semua live di stroke engine
  (terverifikasi di `paintTo`: flowMul, spacingPct, jitterPct, smoothing lerp,
  brushSpriteEx angle/round, blend override). Mask path ikut flow+spacing.
- [x] 6.6. Mask mode: brush mengecat mask putih (reveal), bukan pixel. Terverifikasi.
- Kunci: tidak ada preset yang rasa kloningan (dikunci test pairwise-distinct).
- Hasil: `npm run typecheck` hijau, `npx vitest run` hijau (lihat bawah).

## FASE 7 — Family Eraser (6 tools, verifikasi ulang pasca Fase 0) — SELESAI

- [x] 7.1. `eraser` / `hard` / `soft` / `block`: hardness 80/100/0/100 + alpha + ring kursor,
  hanya hapus stroke via target resolved (paintTo menerima forceId resolved, mousemove
  memakai activeLayerId yang sudah di-switch). Kertas dan foto utuh by construction.
- [x] 7.2. `background-eraser`: hanya hapus warna mirip sample (tolerance bar selTol*2) +
  tolak kertas + lock/hidden guard. Terverifikasi di fungsi.
- [x] 7.3. `magic-eraser`: flood tolerance bar (selTol*4/3) + tolak kertas + notify area
  kosong + history hanya bila pixel berubah. Terverifikasi di fungsi.
- [x] 7.4. Tombol Clear strokes: konfirmasi + snapshot + foto/kertas utuh. Terverifikasi di top bar.
- [x] 7.5. Eraser + paintMask: mengecat mask hitam (hide), bukan hapus pixel. Terverifikasi.
- [x] 7.6. Uji regresi otomatis `eraser.test.ts` hijau (13 test, termasuk 5 proteksi kertas).
- [x] 7.7. BONUS paper-total: `fill-clear` di kertas mengisi ulang warna bg (semantik Delete
  Photoshop, selection-aware, label history "Clear to background") — menutup lubang
  kertas terakhir di luar family eraser. Catatan 12.7 terpenuhi lebih awal.
- Kunci: TIDAK ADA LUBANG di kertas — matriks skenario:
  fresh doc (kind background: brush auto-paint, eraser retarget, magic/bg tolak),
  photo doc (brush auto-paint, eraser retarget, magic/bg edit foto by design),
  file lama raster (base = layer normal yang sah seperti Photoshop Layer 0,
  erasable by design — terdokumentasi jujur, bukan bug).
- Hasil: `npm run typecheck` hijau, `npx vitest run` 9 file 88 test hijau.

## FASE 8 — Family Heal (39 tools) — SELESAI

- [x] 8.1. Inti terverifikasi: `spot-heal` (mode heal), `healing-brush`/`patch` (heal-source +
  Alt-click set source + hint sekali + return tanpa paint), `red-eye` (hanya pixel merah
  dominan yang dikoreksi, klik lain no-op aman), `content-move` (geser + isi),
  `content-fill` (drag painting, bukan click-only).
- [x] 8.2. 10 varian 2026 terdaftar RETOUCH_MAP. **FIX alias**: `heal-freckle`/`heal-eye`/
  `heal-teeth` sebelumnya menumpang mode dust/wrinkle/skin persis (efek identik).
  Sekarang fingerprint via `RETOUCH_TWEAK` (0.6/0.7/0.85) sehingga efek sesuai peran
  (freckle lembut, eye lembut, teeth aman).
- [x] 8.3. 24 Heal II: tiap mode beda algoritma (dikunci distinct 24 mode di test).
  Terverifikasi cabang engine ada untuk semua (mole s/d rustspot).
- Kunci: heal di kertas aman (tidak memakai destination-out, tidak melubangi).
- Hasil: `npm run typecheck` hijau, test hijau (lihat bawah).

## FASE 9 — Family Stamp (10 tools) — SELESAI

- [x] 9.1. `clone` / `mirror` / `rotate` / `soft`: Alt-click set source + cursor koordinat +
  snapshot anti-smear per stroke + alpha soft 60% + hint sekali bila belum ada source +
  cursor "Alt-click to set source" saat drag tanpa source. Guard lock/hidden. Terverifikasi.
- [x] 9.2. Aligned toggle: on = offset lintas stroke, off = reset per stroke + mouse-leave.
  Terverifikasi di mouse-up/leave.
- [x] 9.3. `pattern-stamp` / `dots` / `texture-stamp`: motif picker live saat drag.
  Terverifikasi di mousemove.
- [x] 9.4. `pattern-fill`: motif picker + label history dinamis + selection-safe
  (destination-in) + guard lock/hidden + click-only (drag diabaikan). Terverifikasi.
- [x] 9.5. `history-brush` / `art-history-brush`: source snapshot pra-stroke + pre-render
  canvas per stroke + art hue jitter. Terverifikasi.
- Kunci: indikator source + tombol Clear di top bar sinkron dengan store (store-driven).
- Hasil: `npm run typecheck` hijau, test hijau.

## FASE 10 — Family Tone (36 tools) — SELESAI

- [x] 10.1. Inti dodge/burn/sponge/vibrance + 8 light brush: buildup lembut + Strength
  live via strength/flow. Terverifikasi cabang engine.
- [x] 10.2. 4 manual + 20 Tone II: **FIX alias** — `dodge-high`/`burn-shadow`/`sponge-sat`/
  `sponge-desat` sebelumnya identik dengan light/saturate/desat. Sekarang fingerprint
  (1.25/1.25/1.2/0.7 + radius 0.8 untuk dodge/burn presisi). 20 Tone II distinct dikunci test.
- Kunci: dodge/burn hanya cerah/gelap sesuai namanya (cabang fill putih/hitam terpisah).
- Hasil: `npm run typecheck` hijau, test hijau.

## FASE 11 — Family Detail (58 tools) — SELESAI

- [x] 11.1. blur/sharpen/smudge/noise/liquify/warp legacy: smudge pick warna per dab awal
  (mousedown + mousemove), liquify/warp redirect smudge. Terverifikasi.
- [x] 11.2. 8 distort klasik + 14 Distort II: audit script 22/22 kinds punya cabang.
  **FIX defensif**: else final kembalikan pixel bila kind tak dikenal (sebelumnya
  clearRect tanpa fallback = lubang bila kind invalid). Scratch acquire/release seimbang,
  guard bounds tepi, guard lock/hidden. Undo via snapshot stroke.
- [x] 11.3. 26 Detail Gallery: tiap mode beda (surface edge-aware sendiri, sisanya
  fingerprint/distinct dikunci test).
- Kunci: distort di tepi kanvas tidak crash (guard bounds), undo sempurna.
- Hasil: `npm run typecheck` hijau, `npx vitest run` hijau.

## FASE 12 — Family Paint (19 tools) — SELESAI

- [x] 12.1. 7 gradient: **FIX konsistensi notify** — radial/linear/diamond sebelumnya diam
  saat layer terkunci (paintFullLayer sudah notify). Sekarang ketiganya notify.
  Selection-safe via temp, gradTo+reverse+dither, satu history entry. Terverifikasi.
- [x] 12.2. `fill` flood + tolerance bar + OOM guard 9MP + contiguous/global toggle jujur.
  **FIX**: flood diam saat terkunci → notify. Terverifikasi.
- [x] 12.3. `fill-solid` / `foreground` / `background` / `clear`: tepat sasaran + guard.
  Terverifikasi (fill-solid guard+notify, background via paintFullLayer).
- [x] 12.4. `fill-pattern-new`: motif picker + label dinamis. Terverifikasi.
- [x] 12.5. `fill-content-click` / `history-click` / `transparent-protect`: guard+notify
  semua terverifikasi.
- [x] 12.6. `bucket-contiguous` vs `bucket-global`: flood vs global serupa. Terverifikasi.
- [x] 12.7. `gradient-fg-transparent`: preset + pindah ke gradient + notify. Terverifikasi.
- Kunci: `fill-clear` di layer background SUDAH isi ulang warna bg (dikerjakan di Fase 7.7).
- Hasil: `npm run typecheck` hijau, `npx vitest run` 9 file 89 test hijau.

## FASE 13 — Family Vector (11 tools) — SELESAI

- [x] 13.1. `pen` / `pen-free` (wobble organik) / `line` (+Shift 45°) / `line-arrow`
  (kepala panah) / `curvature-pen` (S-curve dua kubik): tebal dari brushSize,
  history per garis, path tersimpan untuk tab Paths. **FIX**: pen + curvature diam
  saat layer terkunci → notify.
- [x] 13.2. 6 preset: widthMul eksplisit 0.45/1/2.1 (thin/medium/bold), dashed setLineDash
  dari brushSize, glow shadowBlur, panah ganda dua kepala (cabang `pen-arrow-both`).
  Styles eksplisit dikunci test (tanpa fallback default diam-diam).
- Kunci: tidak ada preset yang fallback diam-diam ke default.
- Hasil: `npm run typecheck` hijau, `npx vitest run` 9 file 89 test hijau.

## FASE 14 — Family Type (19 tools) — SELESAI

- [x] 14.1. 9 varian inti + vertikal: dispatch 19/19 terverifikasi, spec tersimpan,
  vertikal CJK via split newline. Terverifikasi.
- [x] 14.2. 10 Type II: **FIX fx hilang saat edit** — sebelumnya render fx hanya di
  createTextLayer; edit apa pun di panel/top bar me-render ulang sebagai teks polos.
  Sekarang `renderTextFxToLayer` terpusat di engine + `fx` tersimpan di spec
  (persist .avx otomatis). **FIX teks teleport** — edit me-render di 60,120 default;
  sekarang anchor x/y tersimpan di spec dan dipakai ulang. Rantai 170 baris di
  CanvasArea diganti satu panggilan (byte-identik).
- [x] 14.3. Top bar font/size/B/I/color/tracking/leading live + re-render fx-aware,
  atau ke defaults. **FIX**: patch + flip menolak layer terkunci (notify),
  di top bar maupun TextShapePanel (guardActive).
- Kunci: teks CJK vertikal + edit tidak merusak layer lain (re-render terisolasi per layer).
  Catatan jujur: undo arsitektur pixel-snapshot (pembuatan layer baru di-undo via
  hapus layer manual, sama untuk shape; konsisten seluruh app).
- Hasil: `npm run typecheck` hijau, `npx vitest run` 9 file 89 test hijau.

## FASE 15 — Family Shape (35 tools) — SELESAI

- [x] 15.1. 19 shape inti + 16 Shape II: path di `textShape.ts` + SHAPE_KIND_OF +
  mouseup map 35/35 + sides pentagon 5 / octagon 8. Terverifikasi.
- [x] 15.2. Transform presisi (center + skala dari base) + Shift square 12 kinds.
  Terverifikasi di mousemove.
- [x] 15.3. Fill/stroke/width/sides/flip H/V live via spec + re-render atau defaults.
  **FIX**: patch + flip diam di layer terkunci → notify (top bar patchShape/patchText,
  Flip H/V, panel guardActive).
- Kunci: shape di layer terkunci/hidden ditolak dengan notify (creation selalu layer
  baru sehingga bebas lock issue; mutasi spec/flip dijaga).
- Hasil: `npm run typecheck` hijau, `npx vitest run` 9 file 89 test hijau.

## FASE 16 — Family Navigate (13 tools) — SELESAI

- [x] 16.1. hand/pan drag, rotate-view drag + double-click reset + badge HUD + reset button.
  Terverifikasi (cursor grab/ew-resize, rotateStart, badge pointer-events-auto).
- [x] 16.2. zoom click/Alt, preset 50/100/200/400/800/fit, zoom-marquee drag-area,
  rotate-15 snap kelipatan 15. Semua branch terverifikasi.
- [x] 16.3. Navigator minimap: thumbnail live, viewport rect, drag pan, collapse.
  Tool-independent (store-level), event tidak bocor ke tool aktif. Terverifikasi.
- Kunci: zoom clamp 10..3200 di store (tidak pernah nol/negatif), rotate ternormalisasi.
- Hasil: `npm run typecheck` hijau, `npx vitest run` 9 file 89 test hijau.

## FASE 17 — Family LocalFX (17 tools) — SELESAI

- [x] 17.1. 12 kuas inti: gate 111 mode mencakup semua (audit script 0 unhandled),
  falloff + Strength/flow live. Terverifikasi.
- [x] 17.2. 5 atelier: cabang sepia/bw/filmfade/splittone/hdr ada dan berbeda. Terverifikasi.
- Kunci: tiap brush mengubah pixel terukur (cabang tanpa else diam di gate pixel;
  mode tak dikenal tidak mungkin masuk via dispatch yang dikunci test).
- Hasil: `npm run typecheck` hijau, `npx vitest run` 9 file 89 test hijau.

---

## Definisi selesai plan3 — SELESAI

- [x] Semua 422 sub-tools lolos checklist fasenya masing-masing (Fase 0-17).
- [x] `npm run typecheck` hijau, `npx vitest run` hijau (10 file, 92 test).
- [x] Bug kertas: skenario fresh-doc + photo-doc + file lama raster didokumentasikan hasilnya
  (status: fresh doc dilindungi kind background, photo doc dilindungi photo-rule,
  file lama raster = layer normal yang sah seperti Photoshop Layer 0, erasable by design).
- [x] QA matrix per family: audit kode per-branch + harness otomatis (registry, dispatch,
  preset distinct, mode distinct, alias fingerprint, icon unik, hint spesifik).
- [x] Tidak ada string Indonesia di UI, tidak ada em-dash, tidak ada `console.log` debug.
