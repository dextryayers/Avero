# Contributing ke PSD Studio

Terima kasih ingin berkontribusi ke editor foto open source untuk Linux dan Windows.

## Cara mulai
1. `npm install`
2. `npm run dev` untuk UI, `npm run tauri dev` untuk app desktop
3. `npm run typecheck`, `npm run format:check`
4. Rust: `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test` di `src-tauri`

## Standar kode
- TypeScript strict, tanpa `any` kecuali terpaksa dengan alasan
- Semua edit gambar harus non-destructive: tambah adjustment/filter/mask, jangan mutasi pixel asli tanpa history
- AI harus offline-first: heuristik lokal jalan tanpa internet, model ONNX opsional di `~/.psd-studio/models`
- Plugin JS hanya boleh pakai `(d, params, W, H)`, tanpa DOM, tanpa fetch, timeout 5 detik
- UI dark profesional, Tailwind, ikon Lucide, teks ringkas

## Struktur
- `src/engine/ai`: runtime, segment, restore, prompt
- `src/engine`: selection, adjustments, filters, color, textShape, mockup, recovery
- `src/stores`: editor, pro, ai, automation, node, git, artboard, plugin, workspace
- `src/components`: panel per fase
- `src-tauri/src`: commands, io, pro, ai, document

## Pull request
- Satu PR satu fitur, sertakan cara uji manual
- Update QA checklist di `docs/QA-CHECKLIST.md` bila tambah fitur
- Pastikan `npm run build` dan `cargo check` lolos
