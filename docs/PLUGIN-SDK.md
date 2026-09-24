# Plugin SDK 1.0 (JS)

Plugin adalah fungsi murni tanpa DOM.

```js
// d: Uint8ClampedArray RGBA, params: objek, W: lebar, H: tinggi
const s = (params.strength ?? 50) / 100;
for (let i = 0; i < d.length; i += 4) {
  d[i] = d[i] * (1 - s) + (255 - d[i]) * s;
}
```

## Aturan
- Maks 50 baris untuk panel editor, tanpa `fetch`, tanpa `document`, tanpa `window`
- Timeout 5 detik, error ditangkap dan ditampilkan
- Params dideklarasikan di `params: [{ key, label, min, max, def }]`
- Terapkan ke layer aktif via panel Plug

## Contoh bawaan
- Duotone Biru, Vignette Halus, Film Grain di `src/plugins/sdk.ts`
- Python via PyO3 dan WASM sandbox masuk trek 1.0, API `d, params, W, H` tetap stabil
