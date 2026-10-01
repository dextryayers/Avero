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
- Kunci: crop undoable per layer (snapshot semua layer + mask + reset transform).
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

## FASE 6 — Family Brush (59 tools)

- [ ] 6.1. 7 klasik (brush/pencil/airbrush/soft/color-replacement/mixer/overlay):
  stamp terlihat, alpha/size/hardness dari slider, composite benar.
- [ ] 6.2. 8 sketch + 8 art + 6 manual 2026: scatter/composite/sizeMul berbeda per preset
  (uji pairwise-distinct sudah dikunci `totalCoverage.test.ts`).
- [ ] 6.3. 30 Brush Atelier II (dry-flat s/d fur-short): tiap preset beda terasa di kanvas.
- [ ] 6.4. Proteksi kertas+foto: brush di keduanya SELALU buat paint layer baru + toast sekali.
- [ ] 6.5. Flow/Spacing/Jitter/Smoothing/Angle/Round/Blend semua live di stroke engine.
- [ ] 6.6. Mask mode: brush mengecat mask putih (reveal), bukan pixel.
- Kunci: tidak ada preset yang rasa kloningan.

## FASE 7 — Family Eraser (6 tools, verifikasi ulang pasca Fase 0)

- [ ] 7.1. `eraser` / `hard` / `soft` / `block`: hardness 80/100/0/100 + hanya hapus stroke,
  kertas dan foto utuh (uji manual wajib: lukis di kertas lalu erase).
- [ ] 7.2. `background-eraser`: hanya hapus warna mirip sample + tolak kertas + lock/hidden guard.
- [ ] 7.3. `magic-eraser`: flood tolerance bar + tolak kertas + notify area kosong + history hanya bila berubah.
- [ ] 7.4. Tombol Clear strokes: konfirmasi + snapshot + foto/kertas utuh.
- [ ] 7.5. Eraser + paintMask: mengecat mask hitam (hide), bukan hapus pixel.
- [ ] 7.6. Uji regresi otomatis `eraser.test.ts` hijau (13 test).
- Kunci: TIDAK ADA LUBANG di kertas dalam skenario apa pun (uji: fresh doc, doc foto, doc lama raster).

## FASE 8 — Family Heal (39 tools)

- [ ] 8.1. Inti (`spot-heal`, `healing-brush`/`patch` + Alt source + hint sekali, `red-eye`,
  `content-move`, `content-fill`): tiap mode memberi efek berbeda.
- [ ] 8.2. 10 varian 2026 (dust s/d teeth): terdaftar RETOUCH_MAP, efek beda.
- [ ] 8.3. 24 Heal II (mole s/d rust-spot): tiap mode retouch beda algoritmanya
  (dikunci distinct 24 mode di `totalCoverage.test.ts`), bukan alias.
- Kunci: heal di kertas aman via paint-layer rule (brush-family? heal bukan brush:
  heal langsung di layer aktif; di kertas putih efek tak terlihat tapi tak merusak).

## FASE 9 — Family Stamp (10 tools)

- [ ] 9.1. `clone` / `mirror` / `rotate` / `soft`: Alt source + snapshot anti-smear + alpha soft 60%.
- [ ] 9.2. Aligned toggle: on = offset lintas stroke, off = reset per stroke.
- [ ] 9.3. `pattern-stamp` / `dots` / `texture-stamp`: motif picker live saat drag (bukan cuma mousedown).
- [ ] 9.4. `pattern-fill`: motif picker + selection-safe + guard lock/hidden.
- [ ] 9.5. `history-brush` / `art-history-brush`: source snapshot pra-stroke.
- Kunci: indikator source + tombol Clear di top bar sinkron dengan store.

## FASE 10 — Family Tone (36 tools)

- [ ] 10.1. Inti dodge/burn/sponge/vibrance + 8 light brush: buildup lembut + Strength live.
- [ ] 10.2. 4 manual (high/shadow/sat/desat) + 20 Tone II: tiap mode beda
  (dikunci distinct 20 mode), exposure stops via Strength.
- Kunci: dodge/burn hanya cerah/gelap sesuai namanya (uji pada gray 128).

## FASE 11 — Family Detail (58 tools)

- [ ] 11.1. blur/sharpen/smudge/noise/liquify/warp legacy: smudge pick warna per dab awal.
- [ ] 11.2. 8 distort klasik + 14 Distort II: tiap kind mengubah blok dab secara berbeda
  (dikunci 14 kinds distinct), scratch pool dipakai, tidak bocor memori.
- [ ] 11.3. 26 Detail Gallery (tilt s/d motion + surface/field/clarity/denoise): tiap mode beda.
- Kunci: distort di tepi kanvas tidak crash (guard bounds), undo sempurna.

## FASE 12 — Family Paint (19 tools)

- [ ] 12.1. 7 gradient (linear/radial/diamond/conic/soft/reflected/noise):
  selection-safe via temp canvas + gradTo + reverse + dither, satu history entry.
- [ ] 12.2. `fill` flood + tolerance bar + OOM guard 9MP + contiguous/global toggle jujur.
- [ ] 12.3. `fill-solid` / `foreground` / `background` / `clear`: tepat sasaran.
- [ ] 12.4. `fill-pattern-new`: motif picker + label dinamis.
- [ ] 12.5. `fill-content-click` / `history-click` / `transparent-protect`: sesuai nama.
- [ ] 12.6. `bucket-contiguous` vs `bucket-global`: flood vs global serupa.
- [ ] 12.7. `gradient-fg-transparent`: preset + pindah ke gradient + notify.
- Kunci: CATATAN untuk fase ini: `fill-clear` di layer background sebaiknya isi ulang
  warna bg (seperti Delete di Photoshop), bukan transparan. Putuskan + implementasi di fase ini.

## FASE 13 — Family Vector (11 tools)

- [ ] 13.1. `pen` / `pen-free` / `line` (+Shift 45°) / `line-arrow` / `curvature-pen` (S-curve):
  tebal dari brushSize, history per garis, path tersimpan untuk tab Paths.
- [ ] 13.2. 6 preset (`thin/medium/bold/dashed/arrow-both/glow`): widthMul eksplisit,
  dashed setLineDash, glow shadowBlur, panah ganda dua kepala.
- Kunci: tidak ada preset yang fallback diam-diam ke default.

## FASE 14 — Family Type (19 tools)

- [ ] 14.1. 9 varian inti + vertikal: render benar, spec tersimpan, undoable.
- [ ] 14.2. 10 Type II (typewriter s/d retro): tiap fx render berbeda
  (font/typewriter/blocky tracking/condensed scaleX/emboss/engrave/chrome/fire/ice/retro).
- [ ] 14.3. Top bar font/size/B/I/color/tracking/leading live ke layer aktif + re-render,
  atau ke defaults untuk layer baru.
- Kunci: teks CJK vertikal + undo teks tidak merusak layer lain.

## FASE 15 — Family Shape (35 tools)

- [ ] 15.1. 19 shape inti + 16 Shape II: path di `textShape.ts` + SHAPE_KIND_OF +
  uji render tidak kosong (sides pentagon 5 / octagon 8, bukan 6).
- [ ] 15.2. Transform presisi (center + skala dari base, bukan w/W) + Shift square
  untuk 12 kinds (rect/ellipse/rounded/donut/star/polygon/pentagon/octagon/plus/cross/badge/chevron).
- [ ] 15.3. Fill/stroke/width/sides/flip H/V live via spec + re-render atau defaults.
- Kunci: shape di layer terkunci/hidden ditolak dengan notify.

## FASE 16 — Family Navigate (13 tools)

- [ ] 16.1. hand/pan drag, rotate-view drag + double-click reset + badge HUD + reset button.
- [ ] 16.2. zoom click/Alt, preset 50/100/200/400/800/fit (zoom-400 wajib bekerja),
  zoom-marquee drag-area, rotate-15 snap kelipatan 15.
- [ ] 16.3. Navigator minimap: thumbnail live, viewport rect, drag pan, collapse.
- Kunci: zoom clamp 10..3200, tidak pernah nol/negatif.

## FASE 17 — Family LocalFX (17 tools)

- [ ] 17.1. 12 kuas inti (exposure s/d vignette): falloff lembut + Strength live.
- [ ] 17.2. 5 atelier (sepia/bw/film-fade/split-tone/hdr): tone wash manual yang benar.
- Kunci: tiap brush mengubah pixel terukur (tidak ada no-op diam).

---

## Definisi selesai plan3

- [ ] Semua 422 sub-tools lolos checklist fasenya masing-masing.
- [ ] `npm run typecheck` hijau, `npx vitest run` hijau (wajib 88+ test, tidak boleh turun).
- [ ] Bug kertas: skenario fresh-doc + photo-doc + file lama raster didokumentasikan hasilnya.
- [ ] QA matrix manual per family dicentang dengan bukti perilaku di kanvas uji.
- [ ] Tidak ada string Indonesia di UI, tidak ada em-dash, tidak ada `console.log` debug.
