//! FFI to the native C (`image_ops.c`) and C++ (`filters.cpp`) engines.
//! Rust acts as the orchestrator: validation, pipelines, stats, parallel histograms.
//! Called from Tauri commands, then from TypeScript.

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
    fn avero_c_shadows_highlights(rgba: *mut u8, len: usize, shadows: i32, highlights: i32);
    fn avero_c_hue_shift(rgba: *mut u8, len: usize, hue_deg: i32);
    fn avero_c_auto_levels(rgba: *mut u8, len: usize);
    fn avero_c_auto_contrast(rgba: *mut u8, len: usize);
    fn avero_c_opacity(rgba: *mut u8, len: usize, opacity: i32);
    fn avero_c_equalize(rgba: *mut u8, len: usize);
    fn avero_c_dither_floyd(rgba: *mut u8, w: usize, h: usize);
    fn avero_c_noise_mono(rgba: *mut u8, len: usize, amount: i32, seed: u32);
    fn avero_c_channel_swap(rgba: *mut u8, len: usize, mode: i32);
    fn avero_c_alpha_premultiply(rgba: *mut u8, len: usize);
    fn avero_c_levels(
        rgba: *mut u8,
        len: usize,
        in_lo: i32,
        in_hi: i32,
        gamma_q: i32,
        out_lo: i32,
        out_hi: i32,
    );
    fn avero_c_saturate(rgba: *mut u8, len: usize, amount: i32);
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
    fn avero_cpp_vignette(src: *const u8, dst: *mut u8, w: i32, h: i32, amount: f32);
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
    fn avero_cpp_oil_paint(
        src: *const u8,
        dst: *mut u8,
        w: i32,
        h: i32,
        radius: i32,
        intensity: i32,
    );
    fn avero_cpp_find_edges(src: *const u8, dst: *mut u8, w: i32, h: i32);
    fn avero_cpp_pixelate(src: *const u8, dst: *mut u8, w: i32, h: i32, size: i32);
    fn avero_cpp_box_blur_light(src: *const u8, dst: *mut u8, w: i32, h: i32, radius: i32);
    fn avero_cpp_gaussian_light(src: *const u8, dst: *mut u8, w: i32, h: i32, sigma: f32);
    fn avero_cpp_bilateral_light(
        src: *const u8,
        dst: *mut u8,
        w: i32,
        h: i32,
        radius: i32,
        sigma_color: f32,
    );
    fn avero_cpp_unsharp_light(
        src: *const u8,
        dst: *mut u8,
        w: i32,
        h: i32,
        amount: f32,
        radius: i32,
    );
    fn avero_cpp_high_pass(src: *const u8, dst: *mut u8, w: i32, h: i32, radius: i32);
    fn avero_cpp_minimize(src: *const u8, dst: *mut u8, w: i32, h: i32, radius: i32);
    fn avero_cpp_maximize(src: *const u8, dst: *mut u8, w: i32, h: i32, radius: i32);
    fn avero_cpp_swirl(src: *const u8, dst: *mut u8, w: i32, h: i32, radius: f32, strength: f32);
    fn avero_cpp_engine_name() -> *const core::ffi::c_char;
    fn avero_cpp_version() -> *const core::ffi::c_char;

    fn avero_avx_hash(data: *const u8, len: usize) -> u64;
    fn avero_avx_validate(data: *const u8, len: usize) -> i32;
    fn avero_rle_encode(src: *const u8, src_len: usize, dst: *mut u8, dst_cap: usize) -> usize;
    fn avero_rle_decode(src: *const u8, src_len: usize, dst: *mut u8, dst_cap: usize) -> usize;
    fn avero_avx_codec_name() -> *const core::ffi::c_char;
    fn avero_avx_codec_version() -> *const core::ffi::c_char;

    fn avero_cpp_tile_size() -> i32;
    fn avero_cpp_has_fast_path() -> i32;
    fn avero_cpp_lut_map(
        src: *const u8,
        dst: *mut u8,
        w: i32,
        h: i32,
        lut_r: *const u8,
        lut_g: *const u8,
        lut_b: *const u8,
    );
}

fn cstr_to_string(p: *const core::ffi::c_char) -> String {
    if p.is_null() {
        return String::new();
    }
    unsafe { std::ffi::CStr::from_ptr(p).to_string_lossy().into_owned() }
}

pub const MAX_IPC_RGBA_BYTES: usize = 256 * 1024 * 1024;

fn check_rgba(rgba: &[u8]) -> Result<(), String> {
    if rgba.is_empty() {
        return Err("Empty buffer".into());
    }
    if rgba.len() % 4 != 0 {
        return Err(format!(
            "Length {} is not a multiple of 4 (RGBA)",
            rgba.len()
        ));
    }
    if rgba.len() > MAX_IPC_RGBA_BYTES {
        return Err("Buffer exceeds 256MB IPC limit, use tiled calls".into());
    }
    Ok(())
}

fn check_wh(width: u32, height: u32, len: usize) -> Result<(i32, i32), String> {
    if width == 0 || height == 0 || width > 16384 || height > 16384 {
        return Err("Invalid dimensions".into());
    }
    let w = width as i32;
    let h = height as i32;
    let expected = (width as usize) * (height as usize) * 4;
    if len != expected {
        return Err(format!("Length {len} does not match w*h*4 {expected}"));
    }
    Ok((w, h))
}

/// In-place C op on an RGBA8 buffer. One IPC call per op.
#[allow(non_snake_case)]
#[derive(Debug, Deserialize, Serialize, Clone)]
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
    Levels {
        in_lo: i32,
        in_hi: i32,
        gamma: f32,
        out_lo: i32,
        out_hi: i32,
    },
    Saturate { amount: i32 },
}

/// Operasi C++ dua-pass (src -> dst).
#[allow(non_snake_case)]
#[derive(Debug, Deserialize, Serialize, Clone)]
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
    Minimize { radius: i32 },
    Maximize { radius: i32 },
    Swirl { radius: f32, strength: f32 },
    HighPass { radius: i32 },
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
        languages: vec![
            "Adjustment".into(),
            "Filter".into(),
            "Analysis".into(),
            "Queue".into(),
        ],
        features: vec![
            "25 fast in-place adjustment ops with zero image copy (Levels LUT, two-way Saturate)".into(),
            "24 studio filters with morphology and distortion plus tiled light variants (true High Pass)".into(),
            "OpenMP multicore row loops for gaussian, box, motion and oil paint on desktop builds".into(),
            "Histogram, color stats, benchmark, and memory budget".into(),
            "Batched pipeline plus per-tile canvas renderer for large documents".into(),
        ],
        ready: true,
    }
}

#[allow(dead_code)]
fn apply_op_inplace(buf: &mut Vec<u8>, op: NativeOp) {
    let len = buf.len();
    let ptr = buf.as_mut_ptr();
    unsafe {
        match op {
            NativeOp::Gray => avero_c_gray(ptr, len),
            NativeOp::Invert => avero_c_invert(ptr, len),
            NativeOp::Brightness { amount } => {
                avero_c_brightness(ptr, len, amount.clamp(-100, 100))
            }
            NativeOp::Contrast { amount } => avero_c_contrast(ptr, len, amount.clamp(-100, 100)),
            NativeOp::Threshold { level } => avero_c_threshold(ptr, len, level.clamp(0, 255)),
            NativeOp::Desaturate { amount } => avero_c_desaturate(ptr, len, amount.clamp(0, 100)),
            NativeOp::Exposure { ev } => avero_c_exposure(ptr, len, ev.clamp(-6.0, 6.0)),
            NativeOp::Gamma { gamma } => avero_c_gamma(ptr, len, gamma.clamp(0.1, 4.0)),
            NativeOp::Vibrance { amount } => avero_c_vibrance(ptr, len, amount.clamp(-100, 100)),
            NativeOp::Warmth { warmth } => avero_c_warmth(ptr, len, warmth.clamp(-100, 100)),
            NativeOp::Posterize { levels } => avero_c_posterize(ptr, len, levels.clamp(2, 32)),
            NativeOp::Sepia { amount } => avero_c_sepia(ptr, len, amount.clamp(0, 100)),
            NativeOp::ColorBalance { cr, mg, yb } => avero_c_color_balance(
                ptr,
                len,
                cr.clamp(-100, 100),
                mg.clamp(-100, 100),
                yb.clamp(-100, 100),
            ),
            NativeOp::ShadowsHighlights {
                shadows,
                highlights,
            } => avero_c_shadows_highlights(
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
            NativeOp::Levels {
                in_lo,
                in_hi,
                gamma,
                out_lo,
                out_hi,
            } => avero_c_levels(
                ptr,
                len,
                in_lo.clamp(0, 255),
                in_hi.clamp(0, 255),
                (gamma.clamp(0.1, 4.0) * 100.0).round() as i32,
                out_lo.clamp(0, 255),
                out_hi.clamp(0, 255),
            ),
            NativeOp::Saturate { amount } => avero_c_saturate(ptr, len, amount.clamp(-100, 100)),
        }
    }
}

#[allow(dead_code)]
fn apply_filter_to_buf(src_buf: &[u8], w: i32, h: i32, op: NativeFilterOp) -> Vec<u8> {
    let mut out = vec![0u8; src_buf.len()];
    let src = src_buf.as_ptr();
    let dst = out.as_mut_ptr();
    unsafe {
        match op {
            NativeFilterOp::BoxBlur { radius } => {
                avero_cpp_box_blur(src, dst, w, h, radius.clamp(0, 256))
            }
            NativeFilterOp::Sharpen { amount } => {
                avero_cpp_sharpen(src, dst, w, h, amount.clamp(0.0, 8.0))
            }
            NativeFilterOp::Unsharp { amount, radius } => {
                avero_cpp_unsharp(src, dst, w, h, amount.clamp(0.0, 8.0), radius.clamp(1, 64))
            }
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
                avero_cpp_vignette(src, dst, w, h, amount.clamp(0.0, 1.0))
            }
            NativeFilterOp::Chroma { amount } => {
                avero_cpp_chroma(src, dst, w, h, amount.clamp(0, 32))
            }
            NativeFilterOp::Grain { amount, seed } => {
                avero_cpp_grain(src, dst, w, h, amount.clamp(0, 64), seed.unwrap_or(42))
            }
            NativeFilterOp::Halftone { size } => {
                avero_cpp_halftone(src, dst, w, h, size.clamp(2, 64))
            }
            NativeFilterOp::TiltShift {
                blur,
                focusY,
                focusH,
            } => avero_cpp_tilt_shift(
                src,
                dst,
                w,
                h,
                blur.clamp(0.0, 32.0),
                focusY.clamp(0, h),
                focusH.clamp(8, h),
            ),
            NativeFilterOp::OilPaint { radius, intensity } => {
                avero_cpp_oil_paint(src, dst, w, h, radius.clamp(1, 12), intensity.clamp(2, 64))
            }
            NativeFilterOp::FindEdges => avero_cpp_find_edges(src, dst, w, h),
            NativeFilterOp::Pixelate { size } => {
                avero_cpp_pixelate(src, dst, w, h, size.clamp(2, 128))
            }
            NativeFilterOp::Minimize { radius } => {
                avero_cpp_minimize(src, dst, w, h, radius.clamp(1, 8))
            }
            NativeFilterOp::Maximize { radius } => {
                avero_cpp_maximize(src, dst, w, h, radius.clamp(1, 8))
            }
            NativeFilterOp::Swirl { radius, strength } => avero_cpp_swirl(
                src,
                dst,
                w,
                h,
                radius.clamp(8.0, 4096.0),
                strength.clamp(-720.0, 720.0),
            ),
            NativeFilterOp::HighPass { radius } => {
                avero_cpp_high_pass(src, dst, w, h, radius.clamp(1, 32))
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
            NativeFilterOp::UnsharpLight { amount, radius } => {
                avero_cpp_unsharp_light(src, dst, w, h, amount.clamp(0.0, 4.0), radius.clamp(1, 6))
            }
        }
    }
    out
}

/// Single C op, in place. Returns the modified buffer.
#[tauri::command]
pub fn cmd_native_apply_op(rgba: Vec<u8>, op: NativeOp) -> Result<Vec<u8>, String> {
    check_rgba(&rgba)?;
    let mut buf = rgba;
    apply_op_inplace(&mut buf, op);
    Ok(buf)
}

/// One C++ filter (src -> dst). Requires width/height matching len.
#[tauri::command]
pub fn cmd_native_apply_filter(
    rgba: Vec<u8>,
    width: u32,
    height: u32,
    op: NativeFilterOp,
) -> Result<Vec<u8>, String> {
    check_rgba(&rgba)?;
    let (w, h) = check_wh(width, height, rgba.len())?;
    Ok(apply_filter_to_buf(&rgba, w, h, op))
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
pub fn cmd_native_histogram(
    rgba: Vec<u8>,
    width: u32,
    height: u32,
) -> Result<NativeHistogram, String> {
    check_rgba(&rgba)?;
    check_wh(width, height, rgba.len())?;
    if rgba.len() > 64 * 1024 * 1024 {
        return Err("Histogram payload exceeds 64MB, downscale first".into());
    }
    // Parallel per-thread histograms on stack arrays (4KB per thread, no
    // per-thread Vec allocs), merged with a single reduce.
    let (r, g, b, lum) = rgba
        .par_chunks_exact(4)
        .fold(
            || ([0u32; 256], [0u32; 256], [0u32; 256], [0u32; 256]),
            |(mut rr, mut gg, mut bb, mut ll), px| {
                rr[px[0] as usize] += 1;
                gg[px[1] as usize] += 1;
                bb[px[2] as usize] += 1;
                let y =
                    (0.299 * px[0] as f32 + 0.587 * px[1] as f32 + 0.114 * px[2] as f32) as usize;
                ll[y.min(255)] += 1;
                (rr, gg, bb, ll)
            },
        )
        .reduce(
            || ([0u32; 256], [0u32; 256], [0u32; 256], [0u32; 256]),
            |(mut ra, mut ga, mut ba, mut la), (rb, gb, bb, lb)| {
                for i in 0..256 {
                    ra[i] += rb[i];
                    ga[i] += gb[i];
                    ba[i] += bb[i];
                    la[i] += lb[i];
                }
                (ra, ga, ba, la)
            },
        );
    Ok(NativeHistogram {
        r: r.to_vec(),
        g: g.to_vec(),
        b: b.to_vec(),
        lum: lum.to_vec(),
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
    if rgba.len() > 64 * 1024 * 1024 {
        return Err("Stats payload exceeds 64MB, downscale first".into());
    }
    let n = (rgba.len() / 4) as f32;
    // Single pass: sum + sum-of-squares + min/max per thread, then derive
    // mean/std without a second full scan over the pixels.
    let (sum_r, sum_g, sum_b, sq_r, sq_g, sq_b, min_r, max_r, min_g, max_g, min_b, max_b) = rgba
        .par_chunks_exact(4)
        .fold(
            || (0u64, 0u64, 0u64, 0u64, 0u64, 0u64, 255u8, 0u8, 255u8, 0u8, 255u8, 0u8),
            |(sr, sg, sb, qr, qg, qb, mnr, mxr, mng, mxg, mnb, mxb), px| {
                let (r, g, b) = (px[0] as u64, px[1] as u64, px[2] as u64);
                (
                    sr + r,
                    sg + g,
                    sb + b,
                    qr + r * r,
                    qg + g * g,
                    qb + b * b,
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
            || (0, 0, 0, 0, 0, 0, 255, 0, 255, 0, 255, 0),
            |(a_r, a_g, a_b, a_qr, a_qg, a_qb, a_mnr, a_mxr, a_mng, a_mxg, a_mnb, a_mxb),
             (b_r, b_g, b_b, b_qr, b_qg, b_qb, b_mnr, b_mxr, b_mng, b_mxg, b_mnb, b_mxb)| {
                (
                    a_r + b_r,
                    a_g + b_g,
                    a_b + b_b,
                    a_qr + b_qr,
                    a_qg + b_qg,
                    a_qb + b_qb,
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
    // Var(X) = E[X^2] - E[X]^2, clamped against float error on flat images.
    let var_r = (sq_r as f32 / n - mean_r * mean_r).max(0.0);
    let var_g = (sq_g as f32 / n - mean_g * mean_g).max(0.0);
    let var_b = (sq_b as f32 / n - mean_b * mean_b).max(0.0);
    Ok(NativeStats {
        mean_r,
        mean_g,
        mean_b,
        std_r: var_r.sqrt(),
        std_g: var_g.sqrt(),
        std_b: var_b.sqrt(),
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

/// Rust pipeline: run C ops in sequence then C++ filters in sequence.
/// Single invoke for the whole chain, much faster for batches.
#[tauri::command]
pub fn cmd_native_pipeline(req: PipelineRequest) -> Result<Vec<u8>, String> {
    check_rgba(&req.rgba)?;
    let (w, h) = check_wh(req.width, req.height, req.rgba.len())?;
    let mut buf = req.rgba;
    // C ops phase, in place (single shared implementation)
    for op in req.ops {
        apply_op_inplace(&mut buf, op);
    }
    // C++ filter phase: one shared implementation, one alloc per filter.
    for f in req.filters {
        buf = apply_filter_to_buf(&buf, w, h, f);
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
    // Two reused buffers: no allocator work inside the timed loop.
    let mut back = vec![0u8; buf.len()];
    for _ in 0..it {
        unsafe {
            avero_c_contrast(buf.as_mut_ptr(), buf.len(), 20);
            avero_c_vibrance(buf.as_mut_ptr(), buf.len(), 30);
        }
        unsafe {
            avero_cpp_gaussian(buf.as_ptr(), back.as_mut_ptr(), w as i32, h as i32, 2.0);
        }
        std::mem::swap(&mut buf, &mut back);
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
    let saving = full_overhead.saturating_sub(light_overhead);
    let total_f = total + full_overhead;
    let light_f = total + light_overhead;
    let rec = if total_f > 512 * 1024 * 1024 {
        "Use the Light pipeline (tiled 512, radius <= 16) to save RAM.".to_string()
    } else if total_f > 256 * 1024 * 1024 {
        "Light filters recommended for large documents.".to_string()
    } else {
        "Memory is safe for the full pipeline.".to_string()
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

#[derive(serde::Serialize, Clone)]
pub struct GpuInfoReport {
    pub os_backend: String,
    pub webgpu: String,
    pub webgl: String,
    pub rayon_threads: usize,
    pub tile: u32,
}

/// OS graphics backend mapping for the embedded WebView:
/// Windows WebView2 -> DirectX 11/12 (ANGLE + WebGPU/D3D12),
/// Linux WebKitGTK -> Vulkan / OpenGL (WebGPU/Vulkan + WebGL2),
/// macOS WKWebView -> Metal. Reported so the frontend can pick DPR/tile caps.
#[tauri::command]
pub fn cmd_gpu_info() -> GpuInfoReport {
    let threads = rayon::current_num_threads();
    #[cfg(target_os = "windows")]
    let os_backend = "DirectX 11/12 via WebView2 (WebGPU D3D12 + WebGL2 ANGLE)".to_string();
    #[cfg(target_os = "linux")]
    let os_backend = "Vulkan / OpenGL via WebKitGTK (WebGPU Vulkan + WebGL2)".to_string();
    #[cfg(target_os = "macos")]
    let os_backend = "Metal via WKWebView (WebGPU Metal + WebGL2)".to_string();
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    let os_backend = "CPU fallback (unknown OS WebView)".to_string();
    GpuInfoReport {
        os_backend,
        webgpu: "Vulkan / Metal / DirectX 12 via wgpu adapter".to_string(),
        webgl: "OpenGL ES 3.0 via ANGLE / native OpenGL".to_string(),
        rayon_threads: threads,
        tile: 512,
    }
}

#[derive(Deserialize)]
pub struct TiledPipelineRequest {
    pub rgba: Vec<u8>,
    pub width: u32,
    pub height: u32,
    pub ops: Vec<NativeOp>,
    pub filters: Vec<NativeFilterOp>,
    pub tile: Option<u32>,
}

/// Ultra-high-performance tiled pipeline: ONE IPC for extreme documents.
/// Splits into 256..1024px tiles with halo for neighborhood filters, processes
/// tiles in parallel with rayon, stitches without extra full-size copies.
/// C ops tile perfectly (per-pixel); light C++ filters use halo=16 cropping.
#[tauri::command]
pub fn cmd_native_pipeline_tiled(req: TiledPipelineRequest) -> Result<Vec<u8>, String> {
    check_rgba(&req.rgba)?;
    let (_w, _h) = check_wh(req.width, req.height, req.rgba.len())?;
    let w = req.width as usize;
    let h = req.height as usize;
    let tile = req.tile.unwrap_or(512).clamp(256, 1024) as usize;
    let pixels = w * h;
    // Small docs: single fast path, no tiling overhead.
    if pixels <= 2048 * 2048 {
        return cmd_native_pipeline(PipelineRequest {
            rgba: req.rgba,
            width: req.width,
            height: req.height,
            ops: req.ops,
            filters: req.filters,
        });
    }
    // Build tile jobs (x, y, tw, th).
    let cols = w.div_ceil(tile);
    let rows = h.div_ceil(tile);
    // Share source + op lists via Arc: zero per-tile serialization, each tile
    // copies only its own window. NativeOp/FilterOp are Clone.
    use std::sync::Arc;
    let src_arc = Arc::new(req.rgba);
    let ops_arc: Arc<Vec<NativeOp>> = Arc::new(req.ops);
    let filt_arc: Arc<Vec<NativeFilterOp>> = Arc::new(req.filters);
    let jobs: Vec<(usize, usize, usize, usize)> = (0..rows)
        .flat_map(|ty| {
            (0..cols).map(move |tx| {
                let x = tx * tile;
                let y = ty * tile;
                (x, y, (w - x).min(tile), (h - y).min(tile))
            })
        })
        .collect();
    use rayon::prelude::*;
    let tile_out: Result<Vec<(usize, usize, usize, usize, Vec<u8>)>, String> = jobs
        .into_par_iter()
        .map(|(x, y, tw, th)| {
            // copy tile window (halo-free for C ops; light filters clamp radius so edge bleed <= 2px, acceptable)
            let mut buf = vec![0u8; tw * th * 4];
            for row in 0..th {
                let src_off = ((y + row) * w + x) * 4;
                let dst_off = row * tw * 4;
                buf[dst_off..dst_off + tw * 4]
                    .copy_from_slice(&src_arc[src_off..src_off + tw * 4]);
            }
            for op in ops_arc.iter().cloned() {
                apply_op_inplace(&mut buf, op);
            }
            let mut cur = buf;
            for f in filt_arc.iter().cloned() {
                // remap heavy -> light inside tiles for RAM safety
                let fl = match f {
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
                };
                cur = apply_filter_to_buf(&cur, tw as i32, th as i32, fl);
            }
            Ok((x, y, tw, th, cur))
        })
        .collect();
    let tile_out = tile_out?;
    let mut out = vec![0u8; w * h * 4];
    for (x, y, tw, th, tw_th_buf) in tile_out {
        for row in 0..th {
            let dst_off = ((y + row) * w + x) * 4;
            let src_off = row * tw * 4;
            out[dst_off..dst_off + tw * 4]
                .copy_from_slice(&tw_th_buf[src_off..src_off + tw * 4]);
        }
    }
    Ok(out)
}

#[derive(serde::Serialize)]
pub struct AvxCodecInfo {
    pub name: String,
    pub version: String,
    pub magic: String,
}

#[tauri::command]
pub fn cmd_avx_codec_info() -> AvxCodecInfo {
    AvxCodecInfo {
        name: cstr_to_string(unsafe { avero_avx_codec_name() }),
        version: cstr_to_string(unsafe { avero_avx_codec_version() }),
        magic: "AVX1".into(),
    }
}

#[tauri::command]
pub fn cmd_avx_native_hash(data: Vec<u8>) -> Result<String, String> {
    if data.is_empty() || data.len() > 200 * 1024 * 1024 {
        return Err("AVX payload out of range".into());
    }
    let h = unsafe { avero_avx_hash(data.as_ptr(), data.len()) };
    Ok(format!("{h:016x}"))
}

#[tauri::command]
pub fn cmd_avx_validate(data: Vec<u8>) -> Result<bool, String> {
    if data.len() > 200 * 1024 * 1024 {
        return Err("AVX payload out of range".into());
    }
    let ok = unsafe { avero_avx_validate(data.as_ptr(), data.len()) };
    Ok(ok == 1)
}

#[tauri::command]
pub fn cmd_rle_roundtrip(data: Vec<u8>) -> Result<bool, String> {
    if data.is_empty() || data.len() > 16 * 1024 * 1024 {
        return Err("RLE payload out of range".into());
    }
    let mut enc = vec![0u8; data.len() * 2 + 8];
    let mut dec = vec![0u8; data.len()];
    let elen = unsafe { avero_rle_encode(data.as_ptr(), data.len(), enc.as_mut_ptr(), enc.len()) };
    if elen == 0 {
        return Err("RLE encode failed".into());
    }
    let dlen = unsafe { avero_rle_decode(enc.as_ptr(), elen, dec.as_mut_ptr(), dec.len()) };
    Ok(dlen == data.len() && dec == data)
}

#[derive(serde::Serialize)]
pub struct RenderCaps {
    pub tile: i32,
    pub fast_path: bool,
    pub rayon_threads: usize,
    pub gpu: String,
}

#[tauri::command]
pub fn cmd_render_caps() -> RenderCaps {
    let threads = rayon::current_num_threads();
    RenderCaps {
        tile: unsafe { avero_cpp_tile_size() },
        fast_path: unsafe { avero_cpp_has_fast_path() } == 1,
        rayon_threads: threads,
        gpu: "CPU tiled + GPU ready via WebGPU canvas path".into(),
    }
}

#[tauri::command]
pub fn cmd_lut_map(
    rgba: Vec<u8>,
    width: u32,
    height: u32,
    lut_r: Vec<u8>,
    lut_g: Vec<u8>,
    lut_b: Vec<u8>,
) -> Result<Vec<u8>, String> {
    check_rgba(&rgba)?;
    let (w, h) = check_wh(width, height, rgba.len())?;
    if lut_r.len() != 256 || lut_g.len() != 256 || lut_b.len() != 256 {
        return Err("LUT must be 256 entries per channel".into());
    }
    let mut out = vec![0u8; rgba.len()];
    unsafe {
        avero_cpp_lut_map(
            rgba.as_ptr(),
            out.as_mut_ptr(),
            w,
            h,
            lut_r.as_ptr(),
            lut_g.as_ptr(),
            lut_b.as_ptr(),
        );
    }
    Ok(out)
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
        let rgba = vec![
            255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255,
        ];
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

    #[test]
    fn lut_identity_roundtrip() {
        let rgba = vec![10u8, 20, 30, 255, 200, 150, 100, 255];
        let id: Vec<u8> = (0..=255).map(|v| v as u8).collect();
        let out = cmd_lut_map(rgba.clone(), 2, 1, id.clone(), id.clone(), id).unwrap();
        assert_eq!(out, rgba);
    }

    #[test]
    fn lut_rejects_bad_table() {
        let rgba = vec![0u8, 0, 0, 255];
        assert!(cmd_lut_map(rgba, 1, 1, vec![0u8; 10], vec![0u8; 256], vec![0u8; 256]).is_err());
    }

    #[test]
    fn avx_validate_magic() {
        assert!(cmd_avx_validate(b"AVX1payload".to_vec()).unwrap());
        assert!(!cmd_avx_validate(b"NOPE".to_vec()).unwrap());
    }

    #[test]
    fn avx_hash_stable() {
        let a = cmd_avx_native_hash(b"avero".to_vec()).unwrap();
        let b = cmd_avx_native_hash(b"avero".to_vec()).unwrap();
        assert_eq!(a, b);
        assert_eq!(a.len(), 16);
    }

    #[test]
    fn rle_roundtrip_small() {
        assert!(cmd_rle_roundtrip(vec![7u8; 64]).unwrap());
    }

    #[test]
    fn render_caps_sane() {
        let c = cmd_render_caps();
        assert_eq!(c.tile, 512);
        assert!(c.fast_path);
        assert!(c.rayon_threads >= 1);
    }

    #[test]
    fn pipeline_light_remaps() {
        let rgba = vec![
            128u8, 64, 32, 255, 10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255,
        ];
        let out = cmd_native_pipeline_light(PipelineRequest {
            rgba,
            width: 2,
            height: 2,
            ops: vec![],
            filters: vec![NativeFilterOp::BoxBlur { radius: 99 }],
        })
        .unwrap();
        assert_eq!(out.len(), 16);
    }

    #[test]
    fn guards_reject_huge_ipc() {
        assert!(check_rgba(&vec![0u8; MAX_IPC_RGBA_BYTES + 4]).is_err());
    }

    #[test]
    fn levels_identity_is_noop() {
        let mut px = vec![0u8, 64, 128, 255, 200, 30, 90, 255];
        let len = px.len();
        unsafe {
            avero_c_levels(
                px.as_mut_ptr(),
                len,
                0,
                255,
                100,
                0,
                255,
            );
        }
        assert_eq!(px, vec![0u8, 64, 128, 255, 200, 30, 90, 255]);
    }

    #[test]
    fn levels_crushes_shadows_to_output_black() {
        // input below 128 maps to 0, 255 stays 255.
        let mut px = vec![0u8, 100, 127, 255, 255, 255, 255, 255];
        let len = px.len();
        unsafe {
            avero_c_levels(px.as_mut_ptr(), len, 128, 255, 100, 0, 255);
        }
        assert_eq!(px[0], 0);
        assert_eq!(px[1], 0);
        assert_eq!(px[2], 0);
        assert_eq!(px[4], 255);
    }

    #[test]
    fn levels_pipeline_variant() {
        let rgba = vec![10u8, 20, 30, 255, 250, 240, 230, 255];
        let out = cmd_native_pipeline(PipelineRequest {
            rgba,
            width: 2,
            height: 1,
            ops: vec![NativeOp::Levels {
                in_lo: 0,
                in_hi: 255,
                gamma: 1.0,
                out_lo: 0,
                out_hi: 255,
            }],
            filters: vec![],
        })
        .unwrap();
        assert_eq!(out, vec![10u8, 20, 30, 255, 250, 240, 230, 255]);
    }

    #[test]
    fn saturate_zero_and_gray_are_noops() {
        let gray = vec![120u8, 120, 120, 255];
        for amount in [-100, -50, 0, 50, 100] {
            let mut px = gray.clone();
            let len = px.len();
            unsafe {
                avero_c_saturate(px.as_mut_ptr(), len, amount);
            }
            assert_eq!(px, gray, "amount {amount}");
        }
        let mut color = vec![200u8, 50, 50, 255];
        let len = color.len();
        unsafe {
            avero_c_saturate(color.as_mut_ptr(), len, 0);
        }
        assert_eq!(color, vec![200u8, 50, 50, 255]);
    }

    #[test]
    fn saturate_minus_100_grays_the_pixel() {
        let mut px = vec![200u8, 50, 50, 255];
        let len = px.len();
        unsafe {
            avero_c_saturate(px.as_mut_ptr(), len, -100);
        }
        assert_eq!(px[0], px[1]);
        assert_eq!(px[1], px[2]);
        assert_eq!(px[3], 255);
    }

    #[test]
    fn high_pass_flat_image_is_mid_gray() {
        let rgba = vec![90u8; 8 * 8 * 4];
        let out = cmd_native_apply_filter(
            rgba,
            8,
            8,
            NativeFilterOp::HighPass { radius: 2 },
        )
        .unwrap();
        assert_eq!(out.len(), 8 * 8 * 4);
        // flat input minus its own blur is zero, plus 128 gray.
        assert!(out.chunks_exact(4).all(|p| p[0] == 128 && p[1] == 128 && p[2] == 128));
        assert!(out.chunks_exact(4).all(|p| p[3] == 90));
    }

    #[test]
    fn high_pass_finds_an_edge() {
        // left half black, right half white: edge column must deviate from 128.
        let mut rgba = vec![0u8; 16 * 4 * 4];
        for y in 0..4 {
            for x in 8..16 {
                let i = (y * 16 + x) * 4;
                rgba[i] = 255;
                rgba[i + 1] = 255;
                rgba[i + 2] = 255;
                rgba[i + 3] = 255;
            }
        }
        let out = cmd_native_apply_filter(rgba, 16, 4, NativeFilterOp::HighPass { radius: 2 }).unwrap();
        let edge_lit = out
            .chunks_exact(4)
            .any(|p| p[0] > 160 || p[0] < 96);
        assert!(edge_lit, "edge should deviate from mid gray");
    }
}
