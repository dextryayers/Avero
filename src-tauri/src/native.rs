//! FFI ke native engine C (`image_ops.c`) dan C++ (`filters.cpp`).
//! Rust menjadi orchestrator: validasi, pipeline, statistik, histogram paralel.
//! Dipanggil dari Tauri command, lalu dari TypeScript.

use rayon::prelude::*;
use serde::{Deserialize, Serialize};

extern "C" {
    fn avero_c_gray(rgba: *mut u8, len: usize);
    fn avero_c_invert(rgba: *mut u8, len: usize);
    fn avero_c_brightness(rgba: *mut u8, len: usize, amount: i32);
    fn avero_c_contrast(rgba: *mut u8, len: usize, amount: i32);
    fn avero_c_threshold(rgba: *mut u8, len: usize, level: i32);
    fn avero_c_desaturate(rgba: *mut u8, len: usize, amount: i32);
    fn avero_c_exposure(rgba: *mut u8, len: usize, ev: f32);
    fn avero_c_gamma(rgba: *mut u8, len: usize, gamma: f32);
    fn avero_c_vibrance(rgba: *mut u8, len: usize, amount: i32);
    fn avero_c_warmth(rgba: *mut u8, len: usize, warmth: i32);
    fn avero_c_posterize(rgba: *mut u8, len: usize, levels: i32);
    fn avero_c_sepia(rgba: *mut u8, len: usize, amount: i32);
    fn avero_c_color_balance(rgba: *mut u8, len: usize, cr: i32, mg: i32, yb: i32);
    fn avero_c_shadows_highlights(
        rgba: *mut u8,
        len: usize,
        shadows: i32,
        highlights: i32,
    );
    fn avero_c_hue_shift(rgba: *mut u8, len: usize, hue_deg: i32);
    fn avero_c_auto_levels(rgba: *mut u8, len: usize);
    fn avero_c_auto_contrast(rgba: *mut u8, len: usize);
    fn avero_c_opacity(rgba: *mut u8, len: usize, opacity: i32);
    fn avero_c_equalize(rgba: *mut u8, len: usize);
    fn avero_c_dither_floyd(rgba: *mut u8, w: usize, h: usize);
    fn avero_c_noise_mono(rgba: *mut u8, len: usize, amount: i32, seed: u32);
    fn avero_c_channel_swap(rgba: *mut u8, len: usize, mode: i32);
    fn avero_c_alpha_premultiply(rgba: *mut u8, len: usize);
    fn avero_c_engine_name() -> *const core::ffi::c_char;
    fn avero_c_version() -> *const core::ffi::c_char;

    fn avero_cpp_box_blur(src: *const u8, dst: *mut u8, w: i32, h: i32, radius: i32);
    fn avero_cpp_sharpen(src: *const u8, dst: *mut u8, w: i32, h: i32, amount: f32);
    fn avero_cpp_unsharp(src: *const u8, dst: *mut u8, w: i32, h: i32, amount: f32, radius: i32);
    fn avero_cpp_emboss(src: *const u8, dst: *mut u8, w: i32, h: i32);
    fn avero_cpp_motion_blur(
        src: *const u8,
        dst: *mut u8,
        w: i32,
        h: i32,
        radius: i32,
        angle_deg: f32,
    );
    fn avero_cpp_gaussian(src: *const u8, dst: *mut u8, w: i32, h: i32, sigma: f32);
    fn avero_cpp_median(src: *const u8, dst: *mut u8, w: i32, h: i32, radius: i32);
    fn avero_cpp_sobel(src: *const u8, dst: *mut u8, w: i32, h: i32);
    fn avero_cpp_vignette(src: *mut u8, dst: *mut u8, w: i32, h: i32, amount: f32);
    fn avero_cpp_chroma(src: *const u8, dst: *mut u8, w: i32, h: i32, amount: i32);
    fn avero_cpp_grain(src: *const u8, dst: *mut u8, w: i32, h: i32, amount: i32, seed: u32);
    fn avero_cpp_halftone(src: *const u8, dst: *mut u8, w: i32, h: i32, size: i32);
    fn avero_cpp_tilt_shift(
        src: *const u8,
        dst: *mut u8,
        w: i32,
        h: i32,
        blur: f32,
        focus_y: i32,
        focus_h: i32,
    );
    fn avero_cpp_oil_paint(src: *const u8, dst: *mut u8, w: i32, h: i32, radius: i32, intensity: i32);
    fn avero_cpp_find_edges(src: *const u8, dst: *mut u8, w: i32, h: i32);
    fn avero_cpp_pixelate(src: *const u8, dst: *mut u8, w: i32, h: i32, size: i32);
    fn avero_cpp_box_blur_light(src: *const u8, dst: *mut u8, w: i32, h: i32, radius: i32);
    fn avero_cpp_gaussian_light(src: *const u8, dst: *mut u8, w: i32, h: i32, sigma: f32);
    fn avero_cpp_bilateral_light(src: *const u8, dst: *mut u8, w: i32, h: i32, radius: i32, sigma_color: f32);
    fn avero_cpp_unsharp_light(src: *const u8, dst: *mut u8, w: i32, h: i32, amount: f32, radius: i32);
    fn avero_cpp_engine_name() -> *const core::ffi::c_char;
    fn avero_cpp_version() -> *const core::ffi::c_char;
}

fn cstr_to_string(p: *const core::ffi::c_char) -> String {
    if p.is_null() {
        return String::new();
    }
    unsafe { std::ffi::CStr::from_ptr(p).to_string_lossy().into_owned() }
}

fn check_rgba(rgba: &[u8]) -> Result<(), String> {
    if rgba.is_empty() {
        return Err("buffer kosong".into());
    }
    if rgba.len() % 4 != 0 {
        return Err(format!("len {} bukan kelipatan 4 (RGBA)", rgba.len()));
    }
    Ok(())
}

fn check_wh(width: u32, height: u32, len: usize) -> Result<(i32, i32), String> {
    let w = width as i32;
    let h = height as i32;
    if w <= 0 || h <= 0 {
        return Err("dimensi tidak valid".into());
    }
    let expected = (w as usize) * (h as usize) * 4;
    if len != expected {
        return Err(format!("len {len} != w*h*4 {expected}"));
    }
    Ok((w, h))
}

/// Operasi in-place C pada buffer RGBA8. Dipanggil sekali IPC per operasi.
#[allow(non_snake_case)]
#[derive(Debug, Deserialize)]
#[serde(tag = "op", rename_all = "camelCase")]
pub enum NativeOp {
    Gray,
    Invert,
    Brightness { amount: i32 },
    Contrast { amount: i32 },
    Threshold { level: i32 },
    Desaturate { amount: i32 },
    Exposure { ev: f32 },
    Gamma { gamma: f32 },
    Vibrance { amount: i32 },
    Warmth { warmth: i32 },
    Posterize { levels: i32 },
    Sepia { amount: i32 },
    ColorBalance { cr: i32, mg: i32, yb: i32 },
    ShadowsHighlights { shadows: i32, highlights: i32 },
    HueShift { hueDeg: i32 },
    AutoLevels,
    AutoContrast,
    Opacity { opacity: i32 },
    Equalize,
    Dither { width: u32, height: u32 },
    NoiseMono { amount: i32, seed: Option<u32> },
    ChannelSwap { mode: i32 },
    AlphaPremultiply,
}

/// Operasi C++ dua-pass (src -> dst).
#[allow(non_snake_case)]
#[derive(Debug, Deserialize)]
#[serde(tag = "op", rename_all = "camelCase")]
pub enum NativeFilterOp {
    BoxBlur { radius: i32 },
    Sharpen { amount: f32 },
    Unsharp { amount: f32, radius: i32 },
    Emboss,
    MotionBlur { radius: i32, angle: f32 },
    Gaussian { sigma: f32 },
    Median { radius: i32 },
    Sobel,
    Vignette { amount: f32 },
    Chroma { amount: i32 },
    Grain { amount: i32, seed: Option<u32> },
    Halftone { size: i32 },
    TiltShift { blur: f32, focusY: i32, focusH: i32 },
    OilPaint { radius: i32, intensity: i32 },
    FindEdges,
    Pixelate { size: i32 },
    BoxBlurLight { radius: i32 },
    GaussianLight { sigma: f32 },
    BilateralLight { radius: i32, sigmaColor: f32 },
    UnsharpLight { amount: f32, radius: i32 },
}

#[derive(Serialize)]
pub struct NativeInfo {
    pub c_engine: String,
    pub c_version: String,
    pub cpp_engine: String,
    pub cpp_version: String,
    pub rust_version: String,
    pub languages: Vec<String>,
    pub features: Vec<String>,
    pub ready: bool,
}

#[tauri::command]
pub fn cmd_native_info() -> NativeInfo {
    NativeInfo {
        c_engine: cstr_to_string(unsafe { avero_c_engine_name() }),
        c_version: cstr_to_string(unsafe { avero_c_version() }),
        cpp_engine: cstr_to_string(unsafe { avero_cpp_engine_name() }),
        cpp_version: cstr_to_string(unsafe { avero_cpp_version() }),
        rust_version: env!("CARGO_PKG_VERSION").to_string(),
        languages: vec!["Penyesuaian".into(), "Filter".into(), "Analisis".into(), "Antrean".into()],
        features: vec![
            "23 operasi penyesuaian cepat, diproses langsung di tempat tanpa menyalin gambar".into(),
            "20 filter studio, diproses dua arah, dengan varian hemat per ubin".into(),
            "Analisis histogram, statistik warna, tolok ukur, dan anggaran memori".into(),
            "Antrean proses bertumpuk dan renderer kanvas per ubin untuk dokumen besar".into(),
        ],
        ready: true,
    }
}

/// Satu operasi C in-place. Return buffer yang sudah dimodifikasi.
#[tauri::command]
pub fn cmd_native_apply_op(rgba: Vec<u8>, op: NativeOp) -> Result<Vec<u8>, String> {
    check_rgba(&rgba)?;
    let mut buf = rgba;
    let len = buf.len();
    let ptr = buf.as_mut_ptr();
    unsafe {
        match op {
            NativeOp::Gray => avero_c_gray(ptr, len),
            NativeOp::Invert => avero_c_invert(ptr, len),
            NativeOp::Brightness { amount } => {
                avero_c_brightness(ptr, len, amount.clamp(-100, 100))
            }
            NativeOp::Contrast { amount } => {
                avero_c_contrast(ptr, len, amount.clamp(-100, 100))
            }
            NativeOp::Threshold { level } => {
                avero_c_threshold(ptr, len, level.clamp(0, 255))
            }
            NativeOp::Desaturate { amount } => {
                avero_c_desaturate(ptr, len, amount.clamp(0, 100))
            }
            NativeOp::Exposure { ev } => avero_c_exposure(ptr, len, ev.clamp(-6.0, 6.0)),
            NativeOp::Gamma { gamma } => avero_c_gamma(ptr, len, gamma.clamp(0.1, 4.0)),
            NativeOp::Vibrance { amount } => {
                avero_c_vibrance(ptr, len, amount.clamp(-100, 100))
            }
            NativeOp::Warmth { warmth } => avero_c_warmth(ptr, len, warmth.clamp(-100, 100)),
            NativeOp::Posterize { levels } => {
                avero_c_posterize(ptr, len, levels.clamp(2, 32))
            }
            NativeOp::Sepia { amount } => avero_c_sepia(ptr, len, amount.clamp(0, 100)),
            NativeOp::ColorBalance { cr, mg, yb } => avero_c_color_balance(
                ptr,
                len,
                cr.clamp(-100, 100),
                mg.clamp(-100, 100),
                yb.clamp(-100, 100),
            ),
            NativeOp::ShadowsHighlights { shadows, highlights } => avero_c_shadows_highlights(
                ptr,
                len,
                shadows.clamp(-100, 100),
                highlights.clamp(-100, 100),
            ),
            NativeOp::HueShift { hueDeg } => avero_c_hue_shift(ptr, len, hueDeg),
            NativeOp::AutoLevels => avero_c_auto_levels(ptr, len),
            NativeOp::AutoContrast => avero_c_auto_contrast(ptr, len),
            NativeOp::Opacity { opacity } => avero_c_opacity(ptr, len, opacity.clamp(0, 100)),
            NativeOp::Equalize => avero_c_equalize(ptr, len),
            NativeOp::Dither { width, height } => {
                let (ww, hh) = (width as usize, height as usize);
                if ww * hh * 4 == len {
                    avero_c_dither_floyd(ptr, ww, hh);
                }
            }
            NativeOp::NoiseMono { amount, seed } => {
                avero_c_noise_mono(ptr, len, amount.clamp(0, 64), seed.unwrap_or(42))
            }
            NativeOp::ChannelSwap { mode } => avero_c_channel_swap(ptr, len, mode.clamp(0, 5)),
            NativeOp::AlphaPremultiply => avero_c_alpha_premultiply(ptr, len),
        }
    }
    Ok(buf)
}

/// Satu filter C++. Butuh width/height yang cocok dengan len.
#[tauri::command]
pub fn cmd_native_apply_filter(
    rgba: Vec<u8>,
    width: u32,
    height: u32,
    op: NativeFilterOp,
) -> Result<Vec<u8>, String> {
    check_rgba(&rgba)?;
    let (w, h) = check_wh(width, height, rgba.len())?;
    let mut out = vec![0u8; rgba.len()];
    let src = rgba.as_ptr();
    let dst = out.as_mut_ptr();
    unsafe {
        match op {
            NativeFilterOp::BoxBlur { radius } => {
                avero_cpp_box_blur(src, dst, w, h, radius.clamp(0, 256))
            }
            NativeFilterOp::Sharpen { amount } => {
                avero_cpp_sharpen(src, dst, w, h, amount.clamp(0.0, 8.0))
            }
            NativeFilterOp::Unsharp { amount, radius } => avero_cpp_unsharp(
                src,
                dst,
                w,
                h,
                amount.clamp(0.0, 8.0),
                radius.clamp(1, 64),
            ),
            NativeFilterOp::Emboss => avero_cpp_emboss(src, dst, w, h),
            NativeFilterOp::MotionBlur { radius, angle } => {
                avero_cpp_motion_blur(src, dst, w, h, radius.clamp(1, 256), angle)
            }
            NativeFilterOp::Gaussian { sigma } => {
                avero_cpp_gaussian(src, dst, w, h, sigma.clamp(0.1, 64.0))
            }
            NativeFilterOp::Median { radius } => {
                avero_cpp_median(src, dst, w, h, radius.clamp(0, 16))
            }
            NativeFilterOp::Sobel => avero_cpp_sobel(src, dst, w, h),
            NativeFilterOp::Vignette { amount } => {
                avero_cpp_vignette(
                    rgba.as_ptr() as *mut u8,
                    dst,
                    w,
                    h,
                    amount.clamp(0.0, 1.0),
                )
            }
            NativeFilterOp::Chroma { amount } => {
                avero_cpp_chroma(src, dst, w, h, amount.clamp(0, 32))
            }
            NativeFilterOp::Grain { amount, seed } => avero_cpp_grain(
                src,
                dst,
                w,
                h,
                amount.clamp(0, 64),
                seed.unwrap_or(42),
            ),
            NativeFilterOp::Halftone { size } => {
                avero_cpp_halftone(src, dst, w, h, size.clamp(2, 64))
            }
            NativeFilterOp::TiltShift { blur, focusY, focusH } => avero_cpp_tilt_shift(
                src,
                dst,
                w,
                h,
                blur.clamp(0.0, 32.0),
                focusY.clamp(0, h),
                focusH.clamp(8, h),
            ),
            NativeFilterOp::OilPaint { radius, intensity } => avero_cpp_oil_paint(
                src,
                dst,
                w,
                h,
                radius.clamp(1, 12),
                intensity.clamp(2, 64),
            ),
            NativeFilterOp::FindEdges => avero_cpp_find_edges(src, dst, w, h),
            NativeFilterOp::Pixelate { size } => {
                avero_cpp_pixelate(src, dst, w, h, size.clamp(2, 128))
            }
            NativeFilterOp::BoxBlurLight { radius } => {
                avero_cpp_box_blur_light(src, dst, w, h, radius.clamp(0, 16))
            }
            NativeFilterOp::GaussianLight { sigma } => {
                avero_cpp_gaussian_light(src, dst, w, h, sigma.clamp(0.1, 8.0))
            }
            NativeFilterOp::BilateralLight { radius, sigmaColor } => avero_cpp_bilateral_light(
                src,
                dst,
                w,
                h,
                radius.clamp(1, 4),
                sigmaColor.clamp(5.0, 100.0),
            ),
            NativeFilterOp::UnsharpLight { amount, radius } => avero_cpp_unsharp_light(
                src,
                dst,
                w,
                h,
                amount.clamp(0.0, 4.0),
                radius.clamp(1, 6),
            ),
        }
    }
    Ok(out)
}

// ---------- Rust engine: histogram, stats, pipeline, benchmark (rayon) ----------

#[derive(Serialize)]
pub struct NativeHistogram {
    pub r: Vec<u32>,
    pub g: Vec<u32>,
    pub b: Vec<u32>,
    pub lum: Vec<u32>,
    pub width: u32,
    pub height: u32,
    pub total: u32,
}

#[tauri::command]
pub fn cmd_native_histogram(rgba: Vec<u8>, width: u32, height: u32) -> Result<NativeHistogram, String> {
    check_rgba(&rgba)?;
    check_wh(width, height, rgba.len())?;
    let chunks: Vec<[u32; 4]> = rgba
        .par_chunks_exact(4)
        .map(|px| {
            let r = px[0] as usize;
            let g = px[1] as usize;
            let b = px[2] as usize;
            let lum = (0.299 * px[0] as f32 + 0.587 * px[1] as f32 + 0.114 * px[2] as f32) as usize;
            let bins = [0u32; 4];
            // di-map bertahap via fold di bawah, jadi penanda saja
            // kita pakai per-thread histogram lalu reduce
            let _ = (r, g, b, lum);
            bins
        })
        .collect::<Vec<_>>(); // dummy collect agar rayon aktif
    // implementasi rayon yang benar: fold + reduce
    let (r, g, b, lum) = rgba
        .par_chunks_exact(4)
        .fold(
            || (vec![0u32; 256], vec![0u32; 256], vec![0u32; 256], vec![0u32; 256]),
            |(mut rr, mut gg, mut bb, mut ll), px| {
                rr[px[0] as usize] += 1;
                gg[px[1] as usize] += 1;
                bb[px[2] as usize] += 1;
                let y = (0.299 * px[0] as f32 + 0.587 * px[1] as f32 + 0.114 * px[2] as f32) as usize;
                ll[y.min(255)] += 1;
                (rr, gg, bb, ll)
            },
        )
        .reduce(
            || (vec![0u32; 256], vec![0u32; 256], vec![0u32; 256], vec![0u32; 256]),
            |(ra, ga, ba, la), (rb, gb, bb, lb)| {
                let r = ra.into_iter().zip(rb).map(|(a, b)| a + b).collect();
                let g = ga.into_iter().zip(gb).map(|(a, b)| a + b).collect();
                let b = ba.into_iter().zip(bb).map(|(a, b)| a + b).collect();
                let l = la.into_iter().zip(lb).map(|(a, b)| a + b).collect();
                (r, g, b, l)
            },
        );
    // cegah warning unused chunks
    let _ = chunks.len();
    Ok(NativeHistogram {
        r,
        g,
        b,
        lum,
        width,
        height,
        total: (rgba.len() / 4) as u32,
    })
}

#[derive(Serialize)]
pub struct NativeStats {
    pub mean_r: f32,
    pub mean_g: f32,
    pub mean_b: f32,
    pub std_r: f32,
    pub std_g: f32,
    pub std_b: f32,
    pub min_r: u8,
    pub max_r: u8,
    pub min_g: u8,
    pub max_g: u8,
    pub min_b: u8,
    pub max_b: u8,
    pub pixels: u32,
}

#[tauri::command]
pub fn cmd_native_stats(rgba: Vec<u8>) -> Result<NativeStats, String> {
    check_rgba(&rgba)?;
    let n = (rgba.len() / 4) as f32;
    let (sum_r, sum_g, sum_b, min_r, max_r, min_g, max_g, min_b, max_b) = rgba
        .par_chunks_exact(4)
        .fold(
            || (0u64, 0u64, 0u64, 255u8, 0u8, 255u8, 0u8, 255u8, 0u8),
            |(sr, sg, sb, mnr, mxr, mng, mxg, mnb, mxb), px| {
                (
                    sr + px[0] as u64,
                    sg + px[1] as u64,
                    sb + px[2] as u64,
                    mnr.min(px[0]),
                    mxr.max(px[0]),
                    mng.min(px[1]),
                    mxg.max(px[1]),
                    mnb.min(px[2]),
                    mxb.max(px[2]),
                )
            },
        )
        .reduce(
            || (0, 0, 0, 255, 0, 255, 0, 255, 0),
            |(a_r, a_g, a_b, a_mnr, a_mxr, a_mng, a_mxg, a_mnb, a_mxb),
             (b_r, b_g, b_b, b_mnr, b_mxr, b_mng, b_mxg, b_mnb, b_mxb)| {
                (
                    a_r + b_r,
                    a_g + b_g,
                    a_b + b_b,
                    a_mnr.min(b_mnr),
                    a_mxr.max(b_mxr),
                    a_mng.min(b_mng),
                    a_mxg.max(b_mxg),
                    a_mnb.min(b_mnb),
                    a_mxb.max(b_mxb),
                )
            },
        );
    let mean_r = sum_r as f32 / n;
    let mean_g = sum_g as f32 / n;
    let mean_b = sum_b as f32 / n;
    let var = rgba
        .par_chunks_exact(4)
        .map(|px| {
            let dr = px[0] as f32 - mean_r;
            let dg = px[1] as f32 - mean_g;
            let db = px[2] as f32 - mean_b;
            (dr * dr, dg * dg, db * db)
        })
        .reduce(|| (0.0, 0.0, 0.0), |(a0, a1, a2), (b0, b1, b2)| {
            (a0 + b0, a1 + b1, a2 + b2)
        });
    Ok(NativeStats {
        mean_r,
        mean_g,
        mean_b,
        std_r: (var.0 / n).sqrt(),
        std_g: (var.1 / n).sqrt(),
        std_b: (var.2 / n).sqrt(),
        min_r,
        max_r,
        min_g,
        max_g,
        min_b,
        max_b,
        pixels: n as u32,
    })
}

#[derive(Deserialize)]
pub struct PipelineRequest {
    pub rgba: Vec<u8>,
    pub width: u32,
    pub height: u32,
    pub ops: Vec<NativeOp>,
    pub filters: Vec<NativeFilterOp>,
}

/// Pipeline Rust: jalankan ops C berurutan lalu filter C++ berurutan tanpa round-trip IPC.
/// Satu invoke untuk seluruh urutan, jauh lebih cepat untuk batch.
#[tauri::command]
pub fn cmd_native_pipeline(req: PipelineRequest) -> Result<Vec<u8>, String> {
    check_rgba(&req.rgba)?;
    let (w, h) = check_wh(req.width, req.height, req.rgba.len())?;
    let mut buf = req.rgba;
    // fase C ops in-place
    for op in req.ops {
        let len = buf.len();
        let ptr = buf.as_mut_ptr();
        unsafe {
            match op {
                NativeOp::Gray => avero_c_gray(ptr, len),
                NativeOp::Invert => avero_c_invert(ptr, len),
                NativeOp::Brightness { amount } => {
                    avero_c_brightness(ptr, len, amount.clamp(-100, 100))
                }
                NativeOp::Contrast { amount } => {
                    avero_c_contrast(ptr, len, amount.clamp(-100, 100))
                }
                NativeOp::Threshold { level } => {
                    avero_c_threshold(ptr, len, level.clamp(0, 255))
                }
                NativeOp::Desaturate { amount } => {
                    avero_c_desaturate(ptr, len, amount.clamp(0, 100))
                }
                NativeOp::Exposure { ev } => avero_c_exposure(ptr, len, ev.clamp(-6.0, 6.0)),
                NativeOp::Gamma { gamma } => avero_c_gamma(ptr, len, gamma.clamp(0.1, 4.0)),
                NativeOp::Vibrance { amount } => {
                    avero_c_vibrance(ptr, len, amount.clamp(-100, 100))
                }
                NativeOp::Warmth { warmth } => {
                    avero_c_warmth(ptr, len, warmth.clamp(-100, 100))
                }
                NativeOp::Posterize { levels } => {
                    avero_c_posterize(ptr, len, levels.clamp(2, 32))
                }
                NativeOp::Sepia { amount } => avero_c_sepia(ptr, len, amount.clamp(0, 100)),
                NativeOp::ColorBalance { cr, mg, yb } => avero_c_color_balance(
                    ptr,
                    len,
                    cr.clamp(-100, 100),
                    mg.clamp(-100, 100),
                    yb.clamp(-100, 100),
                ),
                NativeOp::ShadowsHighlights { shadows, highlights } => {
                    avero_c_shadows_highlights(
                        ptr,
                        len,
                        shadows.clamp(-100, 100),
                        highlights.clamp(-100, 100),
                    )
                }
                NativeOp::HueShift { hueDeg } => avero_c_hue_shift(ptr, len, hueDeg),
                NativeOp::AutoLevels => avero_c_auto_levels(ptr, len),
                NativeOp::AutoContrast => avero_c_auto_contrast(ptr, len),
                NativeOp::Opacity { opacity } => {
                    avero_c_opacity(ptr, len, opacity.clamp(0, 100))
                }
                NativeOp::Equalize => avero_c_equalize(ptr, len),
                NativeOp::Dither { width, height } => {
                    let (ww, hh) = (width as usize, height as usize);
                    if ww * hh * 4 == len {
                        avero_c_dither_floyd(ptr, ww, hh);
                    }
                }
                NativeOp::NoiseMono { amount, seed } => {
                    avero_c_noise_mono(ptr, len, amount.clamp(0, 64), seed.unwrap_or(42))
                }
                NativeOp::ChannelSwap { mode } => avero_c_channel_swap(ptr, len, mode.clamp(0, 5)),
                NativeOp::AlphaPremultiply => avero_c_alpha_premultiply(ptr, len),
            }
        }
    }
    // fase C++ filter: src->dst ping-pong
    for f in req.filters {
        let mut out = vec![0u8; buf.len()];
        let src = buf.as_ptr();
        let dst = out.as_mut_ptr();
        unsafe {
            match f {
                NativeFilterOp::BoxBlur { radius } => {
                    avero_cpp_box_blur(src, dst, w, h, radius.clamp(0, 256))
                }
                NativeFilterOp::Sharpen { amount } => {
                    avero_cpp_sharpen(src, dst, w, h, amount.clamp(0.0, 8.0))
                }
                NativeFilterOp::Unsharp { amount, radius } => avero_cpp_unsharp(
                    src,
                    dst,
                    w,
                    h,
                    amount.clamp(0.0, 8.0),
                    radius.clamp(1, 64),
                ),
                NativeFilterOp::Emboss => avero_cpp_emboss(src, dst, w, h),
                NativeFilterOp::MotionBlur { radius, angle } => {
                    avero_cpp_motion_blur(src, dst, w, h, radius.clamp(1, 256), angle)
                }
                NativeFilterOp::Gaussian { sigma } => {
                    avero_cpp_gaussian(src, dst, w, h, sigma.clamp(0.1, 64.0))
                }
                NativeFilterOp::Median { radius } => {
                    avero_cpp_median(src, dst, w, h, radius.clamp(0, 16))
                }
                NativeFilterOp::Sobel => avero_cpp_sobel(src, dst, w, h),
                NativeFilterOp::Vignette { amount } => {
                    avero_cpp_vignette(
                        buf.as_ptr() as *mut u8,
                        dst,
                        w,
                        h,
                        amount.clamp(0.0, 1.0),
                    )
                }
                NativeFilterOp::Chroma { amount } => {
                    avero_cpp_chroma(src, dst, w, h, amount.clamp(0, 32))
                }
                NativeFilterOp::Grain { amount, seed } => avero_cpp_grain(
                    src,
                    dst,
                    w,
                    h,
                    amount.clamp(0, 64),
                    seed.unwrap_or(42),
                ),
                NativeFilterOp::Halftone { size } => {
                    avero_cpp_halftone(src, dst, w, h, size.clamp(2, 64))
                }
                NativeFilterOp::TiltShift { blur, focusY, focusH } => avero_cpp_tilt_shift(
                    src,
                    dst,
                    w,
                    h,
                    blur.clamp(0.0, 32.0),
                    focusY.clamp(0, h),
                    focusH.clamp(8, h),
                ),
                NativeFilterOp::OilPaint { radius, intensity } => avero_cpp_oil_paint(
                    src,
                    dst,
                    w,
                    h,
                    radius.clamp(1, 12),
                    intensity.clamp(2, 64),
                ),
                NativeFilterOp::FindEdges => avero_cpp_find_edges(src, dst, w, h),
                NativeFilterOp::Pixelate { size } => {
                    avero_cpp_pixelate(src, dst, w, h, size.clamp(2, 128))
                }
                NativeFilterOp::BoxBlurLight { radius } => {
                    avero_cpp_box_blur_light(src, dst, w, h, radius.clamp(0, 16))
                }
                NativeFilterOp::GaussianLight { sigma } => {
                    avero_cpp_gaussian_light(src, dst, w, h, sigma.clamp(0.1, 8.0))
                }
                NativeFilterOp::BilateralLight { radius, sigmaColor } => avero_cpp_bilateral_light(
                    src,
                    dst,
                    w,
                    h,
                    radius.clamp(1, 4),
                    sigmaColor.clamp(5.0, 100.0),
                ),
                NativeFilterOp::UnsharpLight { amount, radius } => avero_cpp_unsharp_light(
                    src,
                    dst,
                    w,
                    h,
                    amount.clamp(0.0, 4.0),
                    radius.clamp(1, 6),
                ),
            }
        }
        buf = out;
    }
    Ok(buf)
}

#[derive(Serialize)]
pub struct BenchmarkResult {
    pub ops: String,
    pub pixels: u32,
    pub millis: u128,
    pub mpix_per_sec: f64,
}

#[tauri::command]
pub fn cmd_native_benchmark(width: u32, height: u32, iterations: Option<u32>) -> BenchmarkResult {
    let w = width.clamp(1, 4096) as usize;
    let h = height.clamp(1, 4096) as usize;
    let n = (w * h) as u32;
    let it = iterations.unwrap_or(20).clamp(1, 200);
    let mut buf = vec![128u8; w * h * 4];
    for i in (0..buf.len()).step_by(4) {
        buf[i + 3] = 255;
    }
    let t0 = std::time::Instant::now();
    for _ in 0..it {
        unsafe {
            avero_c_contrast(buf.as_mut_ptr(), buf.len(), 20);
            avero_c_vibrance(buf.as_mut_ptr(), buf.len(), 30);
        }
        let mut out = vec![0u8; buf.len()];
        unsafe {
            avero_cpp_gaussian(buf.as_ptr(), out.as_mut_ptr(), w as i32, h as i32, 2.0);
        }
        buf = out;
    }
    let ms = t0.elapsed().as_millis();
    let secs = (ms as f64 / 1000.0).max(0.001);
    BenchmarkResult {
        ops: format!("C contrast+vibrance + C++ gaussian x{it}"),
        pixels: n,
        millis: ms,
        mpix_per_sec: (n as f64 * it as f64 / 1_000_000.0) / secs,
    }
}

#[derive(Serialize)]
pub struct MemoryBudget {
    pub width: u32,
    pub height: u32,
    pub layers: u32,
    pub bytes_per_layer: u64,
    pub total_bytes: u64,
    pub total_mb: f64,
    pub light_saving_mb: f64,
    pub light_total_mb: f64,
    pub recommendation: String,
}

#[tauri::command]
pub fn cmd_native_memory_budget(width: u32, height: u32, layers: u32) -> MemoryBudget {
    let w = width.clamp(1, 16384) as u64;
    let h = height.clamp(1, 16384) as u64;
    let l = layers.clamp(1, 128) as u64;
    let per = w * h * 4;
    let total = per * l;
    let full_overhead = per; // C++ box blur tmp
    let light_overhead = (w * 4 * 2) + (512 * 512 * 4); // tiled
    let saving = if full_overhead > light_overhead { full_overhead - light_overhead } else { 0 };
    let total_f = total + full_overhead;
    let light_f = total + light_overhead;
    let rec = if total_f > 512 * 1024 * 1024 {
        "Gunakan Light pipeline (tiled 512, radius <=16) untuk hemat RAM.".to_string()
    } else if total_f > 256 * 1024 * 1024 {
        "Disarankan Light filter untuk dokumen besar.".to_string()
    } else {
        "RAM aman untuk pipeline penuh.".to_string()
    };
    MemoryBudget {
        width: w as u32,
        height: h as u32,
        layers: l as u32,
        bytes_per_layer: per,
        total_bytes: total,
        total_mb: total_f as f64 / 1024.0 / 1024.0,
        light_saving_mb: saving as f64 / 1024.0 / 1024.0,
        light_total_mb: light_f as f64 / 1024.0 / 1024.0,
        recommendation: rec,
    }
}

#[tauri::command]
pub fn cmd_native_pipeline_light(req: PipelineRequest) -> Result<Vec<u8>, String> {
    // delegasi ke pipeline biasa tapi paksa varian Light jika ada
    // remap BoxBlur->BoxBlurLight, Gaussian->GaussianLight, dll jika radius besar
    let ops = req.ops;
    let filters = req
        .filters
        .into_iter()
        .map(|f| match f {
            NativeFilterOp::BoxBlur { radius } => NativeFilterOp::BoxBlurLight {
                radius: radius.clamp(0, 16),
            },
            NativeFilterOp::Gaussian { sigma } => NativeFilterOp::GaussianLight {
                sigma: sigma.clamp(0.1, 8.0),
            },
            NativeFilterOp::Unsharp { amount, radius } => NativeFilterOp::UnsharpLight {
                amount,
                radius: radius.clamp(1, 6),
            },
            other => other,
        })
        .collect();
    cmd_native_pipeline(PipelineRequest {
        rgba: req.rgba,
        width: req.width,
        height: req.height,
        ops,
        filters,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gray_darkens_color() {
        let mut px = vec![200u8, 100u8, 50u8, 255u8];
        let len = px.len();
        unsafe {
            avero_c_gray(px.as_mut_ptr(), len);
        }
        assert_eq!(px[0], px[1]);
        assert_eq!(px[1], px[2]);
        assert_eq!(px[3], 255);
    }

    #[test]
    fn reject_bad_len() {
        assert!(check_rgba(&[1, 2, 3]).is_err());
        assert!(check_rgba(&[1, 2, 3, 4]).is_ok());
    }

    #[test]
    fn pipeline_gray_then_blur() {
        let w = 2u32;
        let h = 2u32;
        let rgba = vec![255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255];
        let out = cmd_native_pipeline(PipelineRequest {
            rgba,
            width: w,
            height: h,
            ops: vec![NativeOp::Gray],
            filters: vec![NativeFilterOp::BoxBlur { radius: 1 }],
        })
        .unwrap();
        assert_eq!(out.len(), 16);
    }

    #[test]
    fn stats_mean() {
        let rgba = vec![10, 20, 30, 255, 10, 20, 30, 255];
        let s = cmd_native_stats(rgba).unwrap();
        assert!((s.mean_r - 10.0).abs() < 0.01);
        assert_eq!(s.pixels, 2);
    }

    #[test]
    fn histogram_counts() {
        let rgba = vec![0, 0, 0, 255, 255, 255, 255, 255];
        let h = cmd_native_histogram(rgba, 2, 1).unwrap();
        assert_eq!(h.r[0], 1);
        assert_eq!(h.r[255], 1);
        assert_eq!(h.total, 2);
    }
}
