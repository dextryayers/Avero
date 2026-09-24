# PSD Studio

Open source professional raster photo editor for Linux and Windows.
Installer native offline via Tauri v2 with Rust engine and TypeScript React UI.

## Stack
- Frontend: TypeScript, React 19, Vite, Tailwind CSS v4, Zustand, Lucide icons
- Backend: Rust, Tauri v2, image-rs, psd crate
- Output: Windows `.msi` / NSIS `.exe`, Linux `.deb` / `.AppImage` / `.rpm`

## Quick start
```bash
npm install
npm run dev        # Vite only
npm run tauri dev  # Full desktop app
npm run build      # Frontend build
npm run tauri build # Native installer
```

## Project phases
- Fase 0: Fondasi installer, CI, design system, shell UI
- Fase 1: MVP canvas, layer, tool dasar, IO PNG/JPG/WEBP/PSD
- Fase 2: Non destructive, selection, mask, filter GPU
- Fase 3: Color management, RAW
- Fase 4: AI lokal offline, automation
- Fase 5: Node graph, plugin SDK
- Fase 6: Polish dan rilis 1.0

See `plan.md` for full detail.

## Scripts
- `npm run typecheck` - TypeScript check
- `npm run lint` - ESLint
- `npm run format` - Prettier write
- `cargo fmt` and `cargo clippy` in `src-tauri`
