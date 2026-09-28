// Format converter engine: probe, single convert, and parallel batch convert.
// Codecs run on the Rust `image` crate (libpng-equivalent PNG, JPEG, BMP,
// TIFF, TGA, QOI, GIF-first-frame, ICO, PNM). Pixel ops (flatten, resize)
// run in place with rayon-friendly loops. WebP output is lossless only
// (upstream limitation of image 0.25), JPEG carries the quality control.

use image::codecs::bmp::BmpEncoder;
use image::codecs::farbfeld::FarbfeldEncoder;
use image::codecs::gif::GifEncoder;
use image::codecs::hdr::HdrEncoder;
use image::codecs::ico::{IcoEncoder, IcoFrame};
use image::codecs::jpeg::JpegEncoder;
use image::codecs::openexr::OpenExrEncoder;
use image::codecs::png::{CompressionType, FilterType as PngFilter, PngEncoder};
use image::codecs::pnm::PnmEncoder;
use image::codecs::qoi::QoiEncoder;
use image::codecs::tga::TgaEncoder;
use image::codecs::tiff::TiffEncoder;
use image::codecs::webp::WebPEncoder;
use image::imageops::FilterType as ResizeFilter;
use image::{DynamicImage, ExtendedColorType, ImageEncoder, ImageReader};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Cursor;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex, OnceLock,
};
use tauri::{AppHandle, Emitter};

/// Extensions accepted as converter input (lowercase, without dot).
pub const INPUT_EXTS: &[&str] = &[
    "png", "jpg", "jpeg", "webp", "bmp", "tiff", "tif", "gif", "tga", "ico", "pnm", "pbm",
    "pgm", "ppm", "pam", "qoi", "psd", "dds", "exr", "hdr", "rgbe", "ff",
];

/// Output formats offered by the converter UI.
pub const OUTPUT_FORMATS: &[&str] = &[
    "png", "jpg", "webp", "gif", "bmp", "tiff", "tga", "ico", "pnm", "qoi", "hdr", "ff", "exr",
];

/// Opaque-output formats that need alpha flattened onto a matte color.
fn needs_flatten(fmt: &str) -> bool {
    matches!(fmt, "jpg" | "jpeg" | "bmp")
}

fn ext_of(path: &str) -> String {
    path.rsplit('.')
        .next()
        .unwrap_or("")
        .to_lowercase()
}

pub fn input_supported(path: &str) -> bool {
    INPUT_EXTS.contains(&ext_of(path).as_str())
}

// ---------- probe ----------

#[derive(Serialize)]
pub struct ProbeResult {
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub file_size: u64,
}

/// Fast metadata probe: dimensions + size, no full decode.
#[tauri::command]
pub fn cmd_probe_image(path: String) -> Result<ProbeResult, String> {
    let meta = std::fs::metadata(&path).map_err(|e| format!("Cannot read file: {e}"))?;
    if meta.len() > 512 * 1024 * 1024 {
        return Err("File exceeds 512MB probe limit".into());
    }
    if ext_of(&path) == "psd" {
        let raw = std::fs::read(&path).map_err(|e| format!("Cannot read file: {e}"))?;
        let psd = psd::Psd::from_bytes(&raw).map_err(|e| format!("PSD parse error: {e:?}"))?;
        return Ok(ProbeResult {
            width: psd.width(),
            height: psd.height(),
            format: "psd".into(),
            file_size: meta.len(),
        });
    }
    let reader = ImageReader::open(&path).map_err(|e| format!("Cannot open image: {e}"))?;
    let reader = reader
        .with_guessed_format()
        .map_err(|e| format!("Unknown image format: {e}"))?;
    let format = reader
        .format()
        .map(|f| format!("{f:?}").to_lowercase())
        .unwrap_or_else(|| "unknown".into());
    let (w, h) = reader
        .into_dimensions()
        .map_err(|e| format!("Cannot read dimensions: {e}"))?;
    Ok(ProbeResult {
        width: w,
        height: h,
        format,
        file_size: meta.len(),
    })
}

// ---------- options ----------

#[derive(Deserialize, Clone, Default)]
pub struct ResizeSpec {
    #[serde(default)]
    pub mode: String, // "original" | "long-edge" | "exact" | "percent" | "preset"
    pub long_edge: Option<u32>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    #[serde(default)]
    pub fit: String, // "fit" | "stretch" | "fill"
    pub percent: Option<f32>,
    pub preset: Option<u32>,
}

#[derive(Deserialize, Clone)]
pub struct ConvertOptions {
    pub format: String,
    pub quality: Option<u8>, // JPEG 1-100
    pub png_best: Option<bool>, // true = best compression, false = fast
    pub matte: Option<[u8; 3]>, // flatten color for opaque outputs
    pub resize: Option<ResizeSpec>,
    pub filter: Option<String>, // nearest|triangle|catmull|gaussian|lanczos
    pub no_enlarge: Option<bool>, // never upscale
}

fn parse_filter(s: &str) -> ResizeFilter {
    match s.to_lowercase().as_str() {
        "nearest" => ResizeFilter::Nearest,
        "triangle" => ResizeFilter::Triangle,
        "catmull" => ResizeFilter::CatmullRom,
        "gaussian" => ResizeFilter::Gaussian,
        _ => ResizeFilter::Lanczos3,
    }
}

/// Tone-map float HDR images (EXR/RGBE) to LDR with a Reinhard curve.
/// Also used by the generic image opener so HDR thumbnails look right.
pub fn tone_map_ldr(img: DynamicImage) -> DynamicImage {
    match img {
        DynamicImage::ImageRgba32F(_) | DynamicImage::ImageRgb32F(_) => {
            let rgba = img.to_rgba32f();
            let (w, h) = (rgba.width(), rgba.height());
            let mut out = image::RgbaImage::new(w, h);
            for (dst, src) in out.pixels_mut().zip(rgba.pixels()) {
                let m = |v: f32| ((v.max(0.0) / (1.0 + v.max(0.0))) * 255.0).round().clamp(0.0, 255.0) as u8;
                dst[0] = m(src[0]);
                dst[1] = m(src[1]);
                dst[2] = m(src[2]);
                dst[3] = (src[3].clamp(0.0, 1.0) * 255.0).round() as u8;
            }
            DynamicImage::ImageRgba8(out)
        }
        other => other,
    }
}

/// Compute the target size. Never returns a zero dimension.
fn target_size(src_w: u32, src_h: u32, spec: &ResizeSpec, no_enlarge: bool) -> (u32, u32) {
    let sw = src_w.max(1) as f32;
    let sh = src_h.max(1) as f32;
    let clamp = |v: f32| v.round().clamp(1.0, 16384.0) as u32;
    let mut tw: u32;
    let mut th: u32;
    match spec.mode.as_str() {
        "long-edge" => {
            let edge = spec.long_edge.unwrap_or(1920).clamp(16, 16384);
            let s = edge as f32 / sw.max(sh);
            tw = clamp(sw * s);
            th = clamp(sh * s);
        }
        "exact" => {
            let w = spec.width.unwrap_or(src_w).clamp(1, 16384) as f32;
            let h = spec.height.unwrap_or(src_h).clamp(1, 16384) as f32;
            match spec.fit.as_str() {
                "stretch" => {
                    tw = clamp(w);
                    th = clamp(h);
                }
                "fill" => {
                    // cover + center crop happens after resize_exact
                    let s = (w / sw).max(h / sh);
                    tw = clamp(sw * s);
                    th = clamp(sh * s);
                }
                _ => {
                    // fit inside the box, aspect preserved
                    let s = (w / sw).min(h / sh);
                    tw = clamp(sw * s);
                    th = clamp(sh * s);
                }
            }
        }
        "percent" => {
            let p = spec.percent.unwrap_or(100.0).clamp(1.0, 800.0) / 100.0;
            tw = clamp(sw * p);
            th = clamp(sh * p);
        }
        "preset" => {
            let edge = spec.preset.unwrap_or(1920).clamp(16, 16384);
            let s = edge as f32 / sw.max(sh);
            tw = clamp(sw * s);
            th = clamp(sh * s);
        }
        _ => {
            tw = src_w.max(1);
            th = src_h.max(1);
        }
    }
    if no_enlarge {
        tw = tw.min(src_w.max(1));
        th = th.min(src_h.max(1));
    }
    (tw.max(1), th.max(1))
}

/// Blend RGBA over an opaque matte. No-op when fully opaque.
fn flatten_over(img: DynamicImage, matte: [u8; 3]) -> DynamicImage {    let mut rgba = img.to_rgba8();
    let (mr, mg, mb) = (matte[0] as f32, matte[1] as f32, matte[2] as f32);
    for px in rgba.pixels_mut() {
        let a = px[3] as f32 / 255.0;
        if a >= 1.0 {
            continue;
        }
        let ia = 1.0 - a;
        px[0] = (px[0] as f32 * a + mr * ia).round().clamp(0.0, 255.0) as u8;
        px[1] = (px[1] as f32 * a + mg * ia).round().clamp(0.0, 255.0) as u8;
        px[2] = (px[2] as f32 * a + mb * ia).round().clamp(0.0, 255.0) as u8;
        px[3] = 255;
    }
    DynamicImage::ImageRgba8(rgba)
}

fn center_crop(img: DynamicImage, w: u32, h: u32) -> DynamicImage {
    use image::GenericImageView;
    let (sw, sh) = img.dimensions();
    if sw <= w && sh <= h {
        return img;
    }
    let x = sw.saturating_sub(w) / 2;
    let y = sh.saturating_sub(h) / 2;
    img.crop_imm(x, y, w.min(sw), h.min(sh))
}

/// Core converter: bytes in, encoded bytes + dims out. Pure and unit-testable.
pub fn convert_bytes(input: &[u8], opts: &ConvertOptions) -> Result<(Vec<u8>, u32, u32), String> {
    if input.is_empty() {
        return Err("Empty image data".into());
    }
    if input.len() > 512 * 1024 * 1024 {
        return Err("Image exceeds 512MB convert limit".into());
    }
    let fmt = opts.format.to_lowercase();
    if !OUTPUT_FORMATS.contains(&fmt.as_str()) {
        return Err(format!("Unsupported output format: {fmt}"));
    }
    let mut img = image::load_from_memory(input)
        .map_err(|e| format!("Unsupported or corrupt image: {e}"))?;
    // HDR sources (EXR/RGBE) arrive as float buffers; tone-map to LDR first.
    img = tone_map_ldr(img);
    let (sw, sh) = (img.width().max(1), img.height().max(1));

    // Resize (strong quality path, adjustable filter, default Lanczos3).
    if let Some(spec) = &opts.resize {
        if spec.mode != "original" && !spec.mode.is_empty() {
            let no_enlarge = opts.no_enlarge.unwrap_or(false);
            let (tw, th) = target_size(sw, sh, spec, no_enlarge);
            let filter = parse_filter(opts.filter.as_deref().unwrap_or("lanczos"));
            let stretch = spec.mode == "exact" && spec.fit == "stretch";
            img = if tw != sw || th != sh {
                if stretch {
                    img.resize_exact(tw, th, filter)
                } else if spec.mode == "exact" && spec.fit == "fill" {
                    center_crop(img.resize_exact(tw, th, filter), spec.width.unwrap_or(tw).clamp(1, 16384), spec.height.unwrap_or(th).clamp(1, 16384))
                } else {
                    img.resize_exact(tw, th, filter)
                }
            } else {
                img
            };
        }
    }

    // Flatten transparency for opaque formats.
    if needs_flatten(&fmt) {
        img = flatten_over(img, opts.matte.unwrap_or([255, 255, 255]));
    }

    // Icons are capped at 256px by spec; fit the longest edge down.
    if fmt == "ico" {
        let (iw, ih) = (img.width().max(1), img.height().max(1));
        let edge = iw.max(ih);
        if edge > 256 {
            let s = 256.0 / edge as f32;
            let tw = ((iw as f32 * s).round() as u32).clamp(1, 256);
            let th = ((ih as f32 * s).round() as u32).clamp(1, 256);
            img = img.resize_exact(tw, th, parse_filter(opts.filter.as_deref().unwrap_or("lanczos")));
        }
    }

    let (w, h) = (img.width(), img.height());
    let mut out: Vec<u8> = Vec::new();
    match fmt.as_str() {
        "png" => {
            let comp = if opts.png_best.unwrap_or(false) {
                CompressionType::Best
            } else {
                CompressionType::Default
            };
            let rgba = img.to_rgba8();
            PngEncoder::new_with_quality(&mut out, comp, PngFilter::Adaptive)
                .write_image(rgba.as_raw(), w, h, ExtendedColorType::Rgba8)
                .map_err(|e| format!("PNG encode failed: {e}"))?;
        }
        "jpg" | "jpeg" => {
            let q = opts.quality.unwrap_or(92).clamp(1, 100);
            let rgb = img.to_rgb8();
            JpegEncoder::new_with_quality(&mut out, q)
                .write_image(rgb.as_raw(), w, h, ExtendedColorType::Rgb8)
                .map_err(|e| format!("JPEG encode failed: {e}"))?;
        }
        "webp" => {
            // Upstream image 0.25 supports lossless WebP output only.
            let rgba = img.to_rgba8();
            WebPEncoder::new_lossless(&mut out)
                .write_image(rgba.as_raw(), w, h, ExtendedColorType::Rgba8)
                .map_err(|e| format!("WebP encode failed: {e}"))?;
        }
        "bmp" => {
            let rgb = img.to_rgb8();
            BmpEncoder::new(&mut out)
                .write_image(rgb.as_raw(), w, h, ExtendedColorType::Rgb8)
                .map_err(|e| format!("BMP encode failed: {e}"))?;
        }
        "tiff" => {
            let rgba = img.to_rgba8();
            let mut cur = Cursor::new(&mut out);
            TiffEncoder::new(&mut cur)
                .write_image(rgba.as_raw(), w, h, ExtendedColorType::Rgba8)
                .map_err(|e| format!("TIFF encode failed: {e}"))?;
        }
        "tga" => {
            let rgba = img.to_rgba8();
            TgaEncoder::new(&mut out)
                .write_image(rgba.as_raw(), w, h, ExtendedColorType::Rgba8)
                .map_err(|e| format!("TGA encode failed: {e}"))?;
        }
        "qoi" => {
            let rgba = img.to_rgba8();
            QoiEncoder::new(&mut out)
                .write_image(rgba.as_raw(), w, h, ExtendedColorType::Rgba8)
                .map_err(|e| format!("QOI encode failed: {e}"))?;
        }
        "gif" => {
            // Static GIF (first frame); the encoder quantizes to 256 colors.
            let rgba = img.to_rgba8();
            GifEncoder::new(&mut out)
                .encode(rgba.as_raw(), w, h, ExtendedColorType::Rgba8)
                .map_err(|e| format!("GIF encode failed: {e}"))?;
        }
        "ico" => {
            let rgba = img.to_rgba8();
            let frame = IcoFrame::as_png(rgba.as_raw(), w, h, ExtendedColorType::Rgba8)
                .map_err(|e| format!("ICO frame failed: {e}"))?;
            IcoEncoder::new(&mut out)
                .encode_images(&[frame])
                .map_err(|e| format!("ICO encode failed: {e}"))?;
        }
        "pnm" => {
            let rgba = img.to_rgba8();
            PnmEncoder::new(&mut out)
                .encode(rgba.as_raw().as_slice(), w, h, ExtendedColorType::Rgba8)
                .map_err(|e| format!("PNM encode failed: {e}"))?;
        }
        "hdr" => {
            // Radiance RGBE carries no alpha; composite over the matte first.
            let flat = flatten_over(img, opts.matte.unwrap_or([255, 255, 255])).to_rgb8();
            let f: Vec<image::Rgb<f32>> = flat
                .pixels()
                .map(|p| image::Rgb([p[0] as f32 / 255.0, p[1] as f32 / 255.0, p[2] as f32 / 255.0]))
                .collect();
            HdrEncoder::new(&mut out)
                .encode(&f, w as usize, h as usize)
                .map_err(|e| format!("HDR encode failed: {e}"))?;
        }
        "ff" => {
            // Farbfeld is 16-bit big-endian RGBA; upscale 8-bit samples.
            let rgba = img.to_rgba8();
            let mut be = Vec::with_capacity((w as usize) * (h as usize) * 8);
            for px in rgba.pixels() {
                for ch in px.0 {
                    be.extend_from_slice(&((ch as u16 * 257).to_be_bytes()));
                }
            }
            FarbfeldEncoder::new(&mut out)
                .encode(&be, w, h)
                .map_err(|e| format!("Farbfeld encode failed: {e}"))?;
        }
        "exr" => {
            // OpenEXR stores float samples; expand LDR bytes to native-endian f32.
            let rgba = img.to_rgba8();
            let mut fimg = image::Rgba32FImage::new(w, h);
            for (dst, src) in fimg.pixels_mut().zip(rgba.pixels()) {
                dst[0] = src[0] as f32 / 255.0;
                dst[1] = src[1] as f32 / 255.0;
                dst[2] = src[2] as f32 / 255.0;
                dst[3] = src[3] as f32 / 255.0;
            }
            let mut cur = Cursor::new(&mut out);
            OpenExrEncoder::new(&mut cur)
                .write_image(bytemuck::cast_slice(fimg.as_raw()), w, h, ExtendedColorType::Rgba32F)
                .map_err(|e| format!("EXR encode failed: {e}"))?;
        }
        _ => return Err(format!("Unsupported output format: {fmt}")),
    }
    Ok((out, w, h))
}

#[derive(Serialize)]
pub struct ConvertReport {
    pub path: String,
    pub width: u32,
    pub height: u32,
    pub bytes: u64,
}

/// Rasterize a PSD file to PNG bytes via the PSD engine (flattened composite).
fn psd_to_png_bytes(raw: &[u8]) -> Result<Vec<u8>, String> {
    if raw.is_empty() {
        return Err("Empty PSD file".into());
    }
    let psd = psd::Psd::from_bytes(raw).map_err(|e| format!("PSD parse error: {e:?}"))?;
    let (w, h) = (psd.width(), psd.height());
    if w == 0 || h == 0 || w > 16384 || h > 16384 {
        return Err("PSD dimensions out of range".into());
    }
    let rgba = psd
        .flatten_layers_rgba(&|(_, _)| true)
        .map_err(|e| format!("PSD rasterize error: {e:?}"))?;
    let mut buf = Vec::new();
    PngEncoder::new_with_quality(&mut buf, CompressionType::Fast, PngFilter::NoFilter)
        .write_image(&rgba, w, h, ExtendedColorType::Rgba8)
        .map_err(|e| format!("PSD raster encode failed: {e}"))?;
    Ok(buf)
}

/// Convert one file with full options. Creates the output folder on demand.
#[tauri::command]
pub fn cmd_convert_image(
    input: String,
    output: String,
    options: ConvertOptions,
) -> Result<ConvertReport, String> {
    if !input_supported(&input) {
        return Err(format!("Input format not supported: {input}"));
    }
    let raw = std::fs::read(&input).map_err(|e| format!("Cannot read input: {e}"))?;
    let bytes = if ext_of(&input) == "psd" {
        psd_to_png_bytes(&raw)?
    } else {
        raw
    };
    let (encoded, w, h) = convert_bytes(&bytes, &options)?;
    if let Some(parent) = std::path::Path::new(&output).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(|e| format!("Cannot create output folder: {e}"))?;
        }
    }
    std::fs::write(&output, &encoded).map_err(|e| format!("Cannot write output: {e}"))?;
    Ok(ConvertReport {
        path: output,
        width: w,
        height: h,
        bytes: encoded.len() as u64,
    })
}

// ---------- batch ----------

#[derive(Deserialize, Clone)]
pub struct BatchJob {
    pub input: String,
    pub output: String,
}

#[derive(Serialize, Clone)]
pub struct BatchProgress {
    pub batch_id: String,
    pub done: usize,
    pub total: usize,
    pub current: String,
    pub ok: bool,
    pub error: Option<String>,
}

#[derive(Serialize)]
pub struct BatchSummary {
    pub batch_id: String,
    pub ok: usize,
    pub failed: usize,
    pub errors: Vec<String>,
}

static CANCEL_FLAGS: OnceLock<Mutex<HashMap<String, Arc<AtomicBool>>>> = OnceLock::new();

fn cancel_flags() -> &'static Mutex<HashMap<String, Arc<AtomicBool>>> {
    CANCEL_FLAGS.get_or_init(|| Mutex::new(HashMap::new()))
}

#[tauri::command]
pub fn cmd_convert_cancel(batch_id: String) -> Result<bool, String> {
    let map = cancel_flags().lock().map_err(|e| e.to_string())?;
    if let Some(flag) = map.get(&batch_id) {
        flag.store(true, Ordering::Relaxed);
        Ok(true)
    } else {
        Ok(false)
    }
}

fn convert_one_job(input: &str, output: &str, options: &ConvertOptions) -> Result<ConvertReport, String> {
    if !input_supported(input) {
        return Err(format!("Input format not supported: {input}"));
    }
    let raw = std::fs::read(input).map_err(|e| format!("Cannot read input: {e}"))?;
    // Photoshop files rasterize through the PSD engine first, then convert.
    let bytes = if ext_of(input) == "psd" {
        psd_to_png_bytes(&raw)?
    } else {
        raw
    };
    let (encoded, w, h) = convert_bytes(&bytes, options)?;
    if let Some(parent) = std::path::Path::new(output).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(|e| format!("Cannot create output folder: {e}"))?;
        }
    }
    std::fs::write(output, &encoded).map_err(|e| format!("Cannot write output: {e}"))?;
    Ok(ConvertReport {
        path: output.to_string(),
        width: w,
        height: h,
        bytes: encoded.len() as u64,
    })
}

/// Parallel batch convert with per-file progress events and cancellation.
/// Event: `avero:convert-progress` with BatchProgress payload.
#[tauri::command]
pub fn cmd_convert_batch(
    app: AppHandle,
    batch_id: String,
    jobs: Vec<BatchJob>,
    options: ConvertOptions,
) -> Result<BatchSummary, String> {
    if jobs.is_empty() {
        return Err("Empty batch".into());
    }
    if jobs.len() > 2000 {
        return Err("Batch exceeds 2000 files".into());
    }
    let flag = Arc::new(AtomicBool::new(false));
    cancel_flags()
        .lock()
        .map_err(|e| e.to_string())?
        .insert(batch_id.clone(), Arc::clone(&flag));
    let total = jobs.len();
    let results: Vec<(bool, BatchProgress)> = jobs
        .into_par_iter()
        .map(|job| {
            if flag.load(Ordering::Relaxed) {
                return (
                    false,
                    BatchProgress {
                        batch_id: batch_id.clone(),
                        done: 0,
                        total,
                        current: job.input.clone(),
                        ok: false,
                        error: Some("Cancelled".into()),
                    },
                );
            }
            let short = job
                .input
                .rsplit(['/', '\\'])
                .next()
                .unwrap_or(&job.input)
                .to_string();
            match convert_one_job(&job.input, &job.output, &options) {
                Ok(_) => (
                    true,
                    BatchProgress {
                        batch_id: batch_id.clone(),
                        done: 0,
                        total,
                        current: short,
                        ok: true,
                        error: None,
                    },
                ),
                Err(e) => (
                    false,
                    BatchProgress {
                        batch_id: batch_id.clone(),
                        done: 0,
                        total,
                        current: short,
                        ok: false,
                        error: Some(e),
                    },
                ),
            }
        })
        .collect();
    // Sequential progress numbering in completion order.
    let mut ok = 0usize;
    let mut failed = 0usize;
    let mut errors: Vec<String> = Vec::new();
    for (i, (good, mut p)) in results.into_iter().enumerate() {
        p.done = i + 1;
        if good {
            ok += 1;
        } else {
            failed += 1;
            if let Some(e) = p.error.clone() {
                errors.push(format!("{}: {}", p.current, e));
            }
        }
        let _ = app.emit("avero:convert-progress", &p);
    }
    cancel_flags()
        .lock()
        .map_err(|e| e.to_string())?
        .remove(&batch_id);
    Ok(BatchSummary {
        batch_id,
        ok,
        failed,
        errors,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_rgba(w: u32, h: u32) -> Vec<u8> {
        let img = DynamicImage::ImageRgba8(image::RgbaImage::from_fn(w, h, |x, y| {
            image::Rgba([x as u8, y as u8, 128, 200])
        }));
        let mut buf = Vec::new();
        PngEncoder::new_with_quality(&mut buf, CompressionType::Fast, PngFilter::NoFilter)
            .write_image(
                img.as_bytes(),
                w,
                h,
                ExtendedColorType::Rgba8,
            )
            .unwrap();
        buf
    }

    fn opts(fmt: &str) -> ConvertOptions {
        ConvertOptions {
            format: fmt.into(),
            quality: Some(92),
            png_best: Some(false),
            matte: Some([255, 255, 255]),
            resize: None,
            filter: Some("lanczos".into()),
            no_enlarge: Some(false),
        }
    }

    #[test]
    fn convert_png_to_jpg_keeps_dims() {
        let src = test_rgba(64, 48);
        let (out, w, h) = convert_bytes(&src, &opts("jpg")).unwrap();
        assert_eq!((w, h), (64, 48));
        assert!(out.len() > 100);
        let back = image::load_from_memory(&out).unwrap();
        assert_eq!((back.width(), back.height()), (64, 48));
    }

    #[test]
    fn convert_png_to_webp_lossless_roundtrip() {
        let src = test_rgba(32, 32);
        let (out, w, h) = convert_bytes(&src, &opts("webp")).unwrap();
        assert_eq!((w, h), (32, 32));
        let back = image::load_from_memory_with_format(&out, image::ImageFormat::WebP).unwrap();
        assert_eq!((back.width(), back.height()), (32, 32));
    }

    #[test]
    fn convert_all_formats_encode() {
        let src = test_rgba(16, 16);
        for f in OUTPUT_FORMATS {
            let (out, w, h) = convert_bytes(&src, &opts(f)).unwrap();
            assert!(out.len() > 16, "empty output for {f}");
            assert_eq!((w, h), (16, 16));
        }
    }

    #[test]
    fn every_format_decodes_back_with_same_dims() {
        // Proves each encoder writes a real file in its own format.
        // TGA carries no magic bytes, so it decodes with an explicit format.
        use image::ImageFormat as F;
        let src = test_rgba(48, 32);
        for f in OUTPUT_FORMATS {
            let (out, w, h) = convert_bytes(&src, &opts(f)).unwrap();
            let back = if *f == "tga" {
                image::load_from_memory_with_format(&out, F::Tga)
            } else {
                image::load_from_memory(&out)
            }
            .unwrap_or_else(|_| panic!("cannot decode our own {f} output"));
            assert_eq!((back.width(), back.height()), (w, h), "dims drift for {f}");
            assert_eq!((w, h), (48, 32));
        }
    }

    #[test]
    fn jpeg_quality_changes_file_size() {
        // Gradient-heavy image so quality levels cannot tie.
        let img = DynamicImage::ImageRgba8(image::RgbaImage::from_fn(128, 128, |x, y| {
            image::Rgba([x as u8, y as u8, ((x + y) % 256) as u8, 255])
        }));
        let mut src = Vec::new();
        PngEncoder::new_with_quality(&mut src, CompressionType::Fast, PngFilter::NoFilter)
            .write_image(img.as_bytes(), 128, 128, ExtendedColorType::Rgba8)
            .unwrap();
        let mut low = opts("jpg");
        low.quality = Some(10);
        let mut high = opts("jpg");
        high.quality = Some(95);
        let (lo, _, _) = convert_bytes(&src, &low).unwrap();
        let (hi, _, _) = convert_bytes(&src, &high).unwrap();
        assert!(lo.len() < hi.len(), "quality 10 ({}) should beat quality 95 ({})", lo.len(), hi.len());
    }

    #[test]
    fn fill_resize_crops_to_exact_box() {
        let src = test_rgba(64, 64);
        let mut o = opts("png");
        o.resize = Some(ResizeSpec {
            mode: "exact".into(),
            width: Some(100),
            height: Some(50),
            fit: "fill".into(),
            ..Default::default()
        });
        let (_, w, h) = convert_bytes(&src, &o).unwrap();
        assert_eq!((w, h), (100, 50));
    }

    #[test]
    fn psd_garbage_fails_cleanly() {
        assert!(psd_to_png_bytes(&[]).is_err());
        assert!(psd_to_png_bytes(b"not a photoshop file at all.............").is_err());
    }

    #[test]
    fn resize_long_edge_math() {
        let spec = ResizeSpec {
            mode: "long-edge".into(),
            long_edge: Some(100),
            ..Default::default()
        };
        assert_eq!(target_size(400, 200, &spec, false), (100, 50));
        assert_eq!(target_size(200, 400, &spec, false), (50, 100));
    }

    #[test]
    fn resize_no_enlarge_clamps() {
        let spec = ResizeSpec {
            mode: "percent".into(),
            percent: Some(400.0),
            ..Default::default()
        };
        assert_eq!(target_size(100, 80, &spec, true), (100, 80));
        assert_eq!(target_size(100, 80, &spec, false), (400, 320));
    }

    #[test]
    fn resize_exact_fit_and_stretch() {
        let fit = ResizeSpec {
            mode: "exact".into(),
            width: Some(100),
            height: Some(100),
            fit: "fit".into(),
            ..Default::default()
        };
        assert_eq!(target_size(400, 200, &fit, false), (100, 50));
        let stretch = ResizeSpec {
            mode: "exact".into(),
            width: Some(100),
            height: Some(100),
            fit: "stretch".into(),
            ..Default::default()
        };
        assert_eq!(target_size(400, 200, &stretch, false), (100, 100));
    }

    #[test]
    fn rejects_unknown_format_and_empty() {
        let src = test_rgba(8, 8);
        assert!(convert_bytes(&src, &opts("avif")).is_err());
        assert!(convert_bytes(&[], &opts("png")).is_err());
    }

    #[test]
    fn matte_flattens_transparency() {
        let mut img = image::RgbaImage::from_pixel(4, 4, image::Rgba([255, 0, 0, 0]));
        img.put_pixel(0, 0, image::Rgba([255, 0, 0, 255]));
        let flat = flatten_over(DynamicImage::ImageRgba8(img), [255, 255, 255]);
        let px = flat.to_rgba8();
        assert_eq!(px.get_pixel(1, 1), &image::Rgba([255, 255, 255, 255]));
        assert_eq!(px.get_pixel(0, 0), &image::Rgba([255, 0, 0, 255]));
    }
}
