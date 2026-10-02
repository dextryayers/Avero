# PLAN 4 - Part 2: Eraser Paper Bug TOTAL + Full Upgrade Fungsi Semua Tools

> Status: FASE 1 + FASE 2 + FASE 3 + FASE 5 + FASE 6 + FASE 7 DIEKSEKUSI
> (eraser total, move 7/7, marquee 22/22, crop 25/25, measure 22/22, brush 59/59).
> Fase 4, 8-20 berjalan berurutan. Setiap sub-tool diverifikasi satu per satu
> sesuai peran dan fungsinya.
> Baseline: plan3 Fase 0-17 (klaim 422 sub-tools). Plan4 adalah PART 2: menutup lubang
> yang masih terbukti ada di kode (bukan klaim), dengan harness audit otomatis sebagai bukti.
> Bahasa UI tetap Bahasa Inggris. Tanpa em dash di src. Tanpa AI tools di workspace.
> Aturan keras plan2 tetap berlaku (7 titik registrasi, efek visual berbeda per sub-tool,
> history entry, cursor, notify untuk click-action, lolos harness).

## Temuan audit kode (bukti, bukan dugaan)

- T1. Tombol "Clear strokes" di top bar eraser menghapus layer aktif TANPA guard kind/lock
  (`ToolOptionsBar.tsx`: `clearRect` langsung). Kertas Background ikut terhapus. INI sumber
  keluhan "eraser menghapus kanvas kertas" yang masih terjadi.
- T2. `background-eraser` / `magic-eraser` di kertas: mousedown mendorong snapshot history
  + `setIsPainting(true)` DULU, guard kertas baru bekerja di dalam `eraseBackgroundTo` /
  `magicEraseAt`. Akibat: history phantom + spam notify tiap mousemove + stroke buntu.
- T3. `magic-eraser` flood-fill di SETIAP mousemove (seharusnya click-only). Berat + hasil
  menyebar saat drag.
- T4. Round-trip `.avx` TIDAK menyimpan flag foto (`layerManager.photoLayers` hilang saat load).
  Akibat: brush menyatu ke foto + eraser memakan pixel foto setelah reopen project.
- T5. Drag-drop (`handleDrop`) dan paste (`pasteClipboardAsLayer`) menggambar bitmap langsung
  TANPA menandai foto. Akibat sama seperti T4 untuk gambar yang di-drop/paste.
- T6. Paste buta asal: tidak ada metadata foto di clipboard internal, sehingga paste dari
  foto vs paste dari goresan tidak bisa dibedakan perlindungannya.
- T7. `resolveEraserTarget` + guard fungsi (fase plan3) BENAR dan dikunci 13 test di
  `eraser.test.ts`. Tidak diubah perilakunya, hanya caller + flag yang diperbaiki.

## Aturan verifikasi tiap sub-tool (berlaku semua fase plan4)

1. Pilih tool dari flyout toolbar, lakukan aksi sesuai usage-nya di kanvas uji.
2. `npx tsc --noEmit` hijau, `npx vitest run` hijau, `npx vite build` hijau.
3. Matriks guard: layer terkunci menolak dengan notify, layer hidden menolak,
   undo mengembalikan pixel persis, seleksi aktif dihormati, mask mode dihormati.
4. Harness `dispatchAudit.test.ts` hijau: tiap tool di `TOOL_FAMILIES` punya dispatch kind
   non-null, top-bar kind valid, hint terdaftar, dan mapping preset/mode sesuai kind-nya.
5. Tidak ada `TODO`/`FIXME` baru. Tidak ada string Indonesia di UI. Tidak ada em dash di src.
6. Setiap perbaikan perilaku diikat MINIMAL 1 regression test otomatis.

---

## FASE 1 - Family Eraser TOTAL (6 tools) - DIEKSEKUSI

- [x] 1.1. `ToolOptionsBar` Clear strokes: tolak kind `"background"` + locked/hidden dengan
  notify (sebelumnya `clearRect` tanpa guard). File: `ToolOptionsBar.tsx`.
- [x] 1.2. Pre-check kertas di mousedown `CanvasArea`: `background-eraser` / `magic-eraser`
  dengan layer kertas aktif -> notify SEKALI + abort SEBELUM snapshot/history/painting.
  File: `CanvasArea.tsx` (cabang guarded stroke).
- [x] 1.3. `magic-eraser` click-only: mousemove mengabaikan magic-eraser (flood sekali
  per klik). File: `CanvasArea.tsx` (move handler).
- [x] 1.4. Flag foto persisten di `.avx`: `AvxLayer.photo?`, `normalizeAvxFile` menjaga flag,
  save menulis `photo: isPhotoLayer(id)`, open memanggil `layerManager.markPhoto(nid)`
  (method baru). File: `projectIo.ts`, `layerManager.ts`.
- [x] 1.5. `handleDrop` menandai foto via `markPhoto` setelah `drawImage`. File: `CanvasArea.tsx`.
- [x] 1.6. Clipboard sadar foto: `copyActiveLayer` merekam `isPhoto` sumber,
  `pasteClipboardAsLayer` menandai hasil paste hanya bila sumbernya foto.
  File: `shortcuts.ts`.
- [x] 1.7. Regression test: `normalizeAvxFile` menjaga `photo`, `needsFreshPaintLayer`
  tetap, semantik `resolveEraserTarget` tak berubah (13 test lama hijau).
- [x] 1.8. `eraser-block` SEJATI: sebelumnya disc identik dengan `eraser-hard`.
  Sekarang `blockEraseTo` mencap kotak axis-aligned (selection-aware, Strength live
  via destination-out alpha). File: `CanvasArea.tsx`.
- [x] 1.9. Strength (opacity) + Flow LIVE untuk semua paint eraser (round sprite +
  block). Sebelumnya alpha dipaksa 1 sehingga slider Strength mati. `eraser-hard`
  tetap full force by design. File: `CanvasArea.tsx` (`paintTo`).
- Kunci: kertas TIDAK PERNAH jadi target erase lewat jalur APAPUN (stroke, clear,
  flood, photo-eraser). Foto TERLINDUNGI lintas save/load/drop/paste. Tiap sub-tool
  berbeda perilaku sesuai perannya (disc/soft/block/tolerance/flood).
- Hasil: `npx tsc --noEmit` hijau, `npx vitest run` hijau, `npx vite build` hijau.

---

## FASE 2 - Family Move (7 tools) - DIEKSEKUSI

- [x] 2.1. `move`: drag + snap (guides/grid/center) + cursor + guard lock/hidden/no-layer
  di choke point. Terverifikasi di branch mousedown + mousemove.
- [x] 2.2. `artboard`: drag create via shapeDrag kind artboard + registrasi store rect
  aktual + guard. Terverifikasi.
- [x] 2.3. `path-select`: pick vector/text teratas + notify kosong + guard + drag lanjut.
- [x] 2.4. `direct-select`: mousedown guard spec+lock, drag rotate live re-render,
  mouseup clear. Terverifikasi.
- [x] 2.5. `move-auto`: alpha pick topmost + fall through drag + guard.
- [x] 2.6. `transform-free`: ensureTransform + drag + Transform panel + handles.
- [x] 2.7. `align-center`: klik + Center Now + history "Align center" + guard.
- [x] 2.8. FIX MoveDrag origin baca active layer FRESH (anti-teleport setelah move-auto /
  path-select switch layer di handler yang sama). File: `CanvasArea.tsx`.
- [x] 2.9. Harness: 7/7 tool terdaftar + `dispatchKindOf` sesuai desain (6 move + artboard
  shape). File: `dispatchAudit.test.ts`.
- Kunci: tidak ada teleport layer, tidak ada drag tanpa guard.
- Hasil: `npx tsc --noEmit` hijau, `npx vitest run` hijau.

## FASE 3 - Family Select Marquee (22 tools) - DIEKSEKUSI

- [x] 3.1. `select-rect`: drag + commit rect + combineMode (selMode + Shift add /
  Alt subtract override) + feather/expand + event + ants.
- [x] 3.2. `select-ellipse` (+Shift kunci lingkaran) / `select-circle` (selalu lingkaran):
  drag lock + commit ellipse. Terverifikasi.
- [x] 3.3. `select-square`: square lock live + commit re-lock + feather.
- [x] 3.4. `select-rounded` (radius 24) / `select-stadium` (radius 9999): commit
  rounded-rect + feather. Terverifikasi.
- [x] 3.5. FIX `select-crosshair`: move handler dulu pre-double drag DAN commit mirror
  lagi = area 4x salah. Sekarang state mentah, preview mirror, commit mirror sekali.
  File: `CanvasArea.tsx` (move + preview render).
- [x] 3.6. `single-row` / `single-column`: klik 1px full-span + drag diabaikan
  (preview tetap 1px) + commit 1px.
- [x] 3.7. Click-ops `grow(+2/+8)` / `shrink` / `feather(2/4/6/12)` / `border(4/12)` /
  `last` / `inverse-click`: guard tanpa-seleksi (notify, bukan diam) + cursor +
  event + ants. Terverifikasi satu per satu di branch mousedown.
- [x] 3.8. Harness: 22/22 tool, marquee = selection, click-ops = click.
  File: `dispatchAudit.test.ts`.
- Kunci: tidak ada marquee yang commit bentuk salah, tidak ada click-op yang diam.
- Hasil: `npx tsc --noEmit` hijau, `npx vitest run` hijau.

## FASE 4 - Family Lasso/Wand (18 tools)

- [ ] 4.1. `select-lasso` / `polygon` / `magnetic-lasso` / `lasso-straight`: commit + clear.
- [ ] 4.2. `object-select` / `quick-select`: brush painting + throttle + forceMode.
- [ ] 4.3. `wand` / `plus` / `minus` / `flood`: tolerance bar + feather + grow/shrink.
- [ ] 4.4. `color-range` / `range-skin` / `range-sky` / `range-greens` / `select-subject` /
  `sky-select` / `background-select` / `focus-select`: seed + tolerance + feather + cursor.
- [ ] 4.5. Harness: tidak ada AI tools di workspace, tiap mode RETOUCH/wand berbeda.

## FASE 5 - Family Crop (25 tools) - DIEKSEKUSI

- [x] 5.1. `crop` + 13 rasio + free: ratio lock live di mousemove + preview + handles.
  Rect persist sampai Apply/Cancel.
- [x] 5.2. `perspective-crop`: rect crop + notify jujur. `crop-straighten`: rotate reset
  + label history manusiawi + undo per layer.
- [x] 5.3. `slice`: drag create + commit. `slice-select`: hit pick + move + fallback
  create + notify. `frame`: drag create via shape path.
- [x] 5.4. 5 overlay: render live di rect crop + pills top bar + klik overlay kembali
  ke crop. Terverifikasi.
- [x] 5.5. FIX single keyboard path: useEffect Enter/Esc lokal di CanvasArea DIHAPUS
  (double-apply + fire saat mengetik di input). Satu jalur via App event.
  File: `CanvasArea.tsx`.
- [x] 5.6. Apply tanpa rect + area <2px: notify jelas (tidak diam). History label
  manusiawi per rasio ("Crop 16:9", bukan "Crop crop-169"). File: `CanvasArea.tsx`.
- [x] 5.7. Harness: 25/25, rasio = crop, slice/select/overlay = click, frame = shape
  (drag-create, bukan click util). File: `dispatchAudit.test.ts`.
- Kunci: tidak ada crop yang apply ganda, tidak ada Enter yang bocor ke input.
- Hasil: `npx tsc --noEmit` hijau, `npx vitest run` hijau.

## FASE 6 - Family Measure (22 tools) - DIEKSEKUSI

- [x] 6.1. `eyedropper`: pick composite/current (sample mode) + kembali ke brush.
  4 sampler: pin + set brush color (avg 5x5/3x3/11x11) + cursor.
- [x] 6.2. `ruler` / `angle` / `area` / `protractor` / `ruler-triple` / `measure-dpi`:
  drag + label unit px/in/cm + triple chain + notify MP/cetak.
- [x] 6.3. `note` / `note-color` (cycling 4 warna) / `count` (nomor max+1) / `count-auto`
  (blob max 99 + clear dulu): dialog + pin + cursor.
- [x] 6.4. `guide-mid` / `guide-thirds` / `guide-clear-one` (guard 25px + notify jauh) /
  `guide-clear` / `grid-toggle` / `grid-pixel` (8px + notify zoom) / `snap-toggle`:
  toggle tepat + notify. Terverifikasi satu per satu di branch mousedown.
- [x] 6.5. Harness: 22/22, dropper = eyedropper, drag = measure, sisanya click.
  File: `dispatchAudit.test.ts`.
- Kunci: tidak ada measure tool yang klik-nya diam.
- Hasil: `npx tsc --noEmit` hijau, `npx vitest run` hijau.

## FASE 7 - Family Brush (59 tools) - DIEKSEKUSI

- [x] 7.1. 7 klasik + 8 sketch + 8 art + 6 manual: cabang engine eksplisit per tool
  di `paintTo` (history/mixer/pattern/overlay/poster/color-replace). Terverifikasi.
- [x] 7.2. 30 Atelier II: registry PAINT_TOOLS + preset distinct pairwise.
- [x] 7.3. FIX 3 pasangan kloningan (harness menemukan, bukan klaim): `sketch-ink`
  vs `pencil` (ink sizeMul 0.85, garis lebih halus), `art-watercolor` vs `airbrush`
  (wash 1.25x lebih lebar + faint), `sketch-chalk` vs `sketch-pastel` (chalk dustier
  1.25x + faint). File: `toolPresets.ts`.
- [x] 7.4. Proteksi kertas+foto: fresh paint layer + toast (termasuk flag T4/T5/T6).
- [x] 7.5. Flow/Spacing/Jitter/Smoothing/Angle/Round/Blend live + mask path.
  Terverifikasi di `paintTo`.
- [x] 7.6. Harness: 59/59 di PAINT_TOOLS + dispatch paint + fingerprint distinct
  (kecuali `brush` generik by design + 10 cabang engine). File: `dispatchAudit.test.ts`.
- Kunci: tidak ada dua brush bernama beda yang berperilaku identik.
- Hasil: `npx tsc --noEmit` hijau, `npx vitest run` hijau.

## FASE 8 - Family Heal (39 tools)

- [ ] 8.1. Inti: spot/healing/patch/red-eye/content-move/content-fill + Alt source.
- [ ] 8.2. 10 varian + 24 Heal II: RETOUCH_MAP + RETOUCH_TWEAK fingerprint distinct.
- [ ] 8.3. Heal tidak memakai destination-out (tidak melubangi kertas/foto).
- [ ] 8.4. Harness: tiap heal tool terdaftar + mode berbeda dikunci test.

## FASE 9 - Family Stamp (10 tools)

- [ ] 9.1. `clone` / `mirror` / `rotate` / `soft`: Alt source + cursor + guard.
- [ ] 9.2. Aligned toggle lintas stroke + reset.
- [ ] 9.3. `pattern-stamp` / `dots` / `texture-stamp` / `pattern-fill` /
  `history-brush` / `art-history-brush`: motif live + snapshot + click-only di mana perlu.
- [ ] 9.4. Harness: CLONE_TOOLS sinkron dengan branch clone CanvasArea.

## FASE 10 - Family Tone (36 tools)

- [ ] 10.1. dodge/burn/sponge/vibrance + 8 light: buildup + Strength live.
- [ ] 10.2. 4 manual + 20 Tone II: fingerprint distinct + radius presisi.
- [ ] 10.3. Harness: tiap tone tool beda mode/tweak (tidak ada alias identik).

## FASE 11 - Family Detail + Distort (58 tools)

- [ ] 11.1. blur/sharpen/smudge/noise/liquify/warp legacy + smudge pick per dab.
- [ ] 11.2. 8 distort klasik + 14 Distort II: cabang eksplisit + fallback aman + bounds.
- [ ] 11.3. 26 Detail Gallery: mode berbeda dikunci test.
- [ ] 11.4. Harness: DISTORT_MAP vs DISTORT kinds di engine (audit script 0 unhandled).

## FASE 12 - Family Paint Fill/Gradient (19 tools)

- [ ] 12.1. 7 gradient: guard+notify + selection-safe + history tunggal.
- [ ] 12.2. fill flood + tolerance + OOM guard + contiguous/global.
- [ ] 12.3. solid/foreground/background/clear/pattern/content/history/transparent-protect/
  bucket: tepat sasaran + guard + label history benar (`fill-clear` di kertas = isi bg).
- [ ] 12.4. Harness: GRADIENT_TOOLS + FILL_TOOLS sinkron dengan branch CanvasArea.

## FASE 13 - Family Vector Pen (11 tools)

- [ ] 13.1. pen/free/line/arrow/curvature: path + history + guard lock.
- [ ] 13.2. 6 preset PEN_STYLES eksplisit (tanpa fallback diam).
- [ ] 13.3. Harness: PEN_TOOLS vs PEN_STYLES vs branch CanvasArea.

## FASE 14 - Family Type (19 tools)

- [ ] 14.1. 9 inti + vertikal: dispatch + spec + anchor x/y.
- [ ] 14.2. 10 Type II: fx tersimpan + render fx-aware + persist .avx.
- [ ] 14.3. Top bar + TextShapePanel live + guard lock.
- [ ] 14.4. Harness: TEXT_TOOLS vs cabang create/edit CanvasArea.

## FASE 15 - Family Shape (35 tools)

- [ ] 15.1. 19 inti + 16 Shape II: path + SHAPE_KIND_OF + mouseup map.
- [ ] 15.2. Transform presisi + Shift square + sides benar.
- [ ] 15.3. Fill/stroke/width/sides/flip live + guard.
- [ ] 15.4. Harness: IS_SHAPE_TOOL vs SHAPE_KIND_OF vs branch CanvasArea.

## FASE 16 - Family Navigate (13 tools)

- [ ] 16.1. hand/pan/rotate-view/rotate-reset/rotate-15 + badge + double-click reset.
- [ ] 16.2. zoom click/Alt + preset + marquee + clamp store.
- [ ] 16.3. Navigator: thumbnail + viewport + drag pan tanpa bocor event.
- [ ] 16.4. Harness: ZOOM_TOOLS + MOVE_TOOLS(navigate) vs branch CanvasArea.

## FASE 17 - Family LocalFX (17 tools)

- [ ] 17.1. 12 inti + 5 atelier: gate mode mencakup semua + Strength/flow live.
- [ ] 17.2. Harness: tiap mode mengubah pixel terukur (tidak ada cabang diam).

---

## FASE 18 - Right Side Tools (panel kanan)

- [ ] 18.1. Layers: add/duplicate/delete/merge/flatten + visibility/lock/opacity/blend/
  clip/reorder/rename/search/filter + context menu 10 aksi + mask/FX toolbar.
- [ ] 18.2. Dock studio: Layers/Effects/Styles/Text/Assets semua live (FX render loop,
  style preset CRUD, text style apply, asset paint).
- [ ] 18.3. Studio strip: Colour (wheel+HSL+opacity+recent+hex+save), Swatches
  (save/apply/delete), Stroke (width+color live), Brushes (search+arm).
- [ ] 18.4. Tab Select/Mask/Adjust/Filter/Memory/Text/Color/RAW/Batch/Art/Plug/Mock/Hist:
  tiap aksi panel bekerja (tambah/hapus/apply/clear + guard + notify).
- [ ] 18.5. Harness: tidak ada tombol tanpa handler (audit `onClick` vs stub).

## FASE 19 - Head Tools (TitleBar + menu + palette + settings)

- [ ] 19.1. Tiap item MENUS menjalankan aksi NYATA (tidak ada fallback palette untuk
  aksi inti edit/layer/select/view). Daftar pengecualian palette didokumentasikan.
- [ ] 19.2. Undo/redo menu via historyOps (pixel pulih, bukan meta saja).
- [ ] 19.3. Fill FG/BG, clear-fill, content-aware, merge, layer-copy/cut bekerja real.
- [ ] 19.4. CommandPalette: semua entri run + recent + navigasi keyboard.
- [ ] 19.5. Settings: tiap tab menerapkan + Shortcuts tab sinkron EDIT_SHORTCUTS.

## FASE 20 - Top Tools (ToolOptionsBar semua kind)

- [ ] 20.1. Tiap TopBarKind (paint/retouch/eraser/clone/select-marquee/select-auto/
  select-click/crop/crop-overlay/shape/text/pen/gradient/fill/measure/navigate/move/
  eyedropper/click) menampilkan kontrol LIVE yang tepat (bukan hint generik).
- [ ] 20.2. Auto-hide + mini chip + More popover + slider elegan tetap mulus.
- [ ] 20.3. Harness: `topBarKindOf` total atas ToolId + runMap select-click sinkron.

---

## Definisi selesai plan4

- [ ] Fase 1-20 checklist hijau seluruhnya.
- [ ] `npx tsc --noEmit` hijau, `npx vitest run` hijau, `npx vite build` hijau.
- [ ] Harness `dispatchAudit.test.ts` hijau (0 tool tanpa dispatch, 0 duplikat family).
- [ ] Skenario kertas: fresh-doc + photo-doc + reload-avx + drop/paste: kertas utuh,
  foto utuh, stroke selalu undoable.
- [ ] Tidak ada string Indonesia di UI, tidak ada em dash di src, tidak ada AI tools.
