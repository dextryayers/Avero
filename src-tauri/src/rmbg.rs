// RMBG background removal (U2-Net family ONNX export, e.g. model-rmbg-1.4.onnx).
// Pure helpers (normalize, resize, tensor layout) are unit tested without a
// model; the ort session path needs the .onnx in <exe-dir>/models/.
// Graph input/output names are read from the session, never hardcoded, so
// any rembg style export keeps working.

use serde::{Deserialize, Serialize};
use std::sync::{Mutex, OnceLock};

use crate::segment::{guided_refine, upscale_gray};

/// File name expected next to the executable, inside the models folder.
pub const RMBG_FILE: &str = "model-rmbg-1.4.onnx";
/// Working square the export expects (verified against the model graph:
/// it rejects anything but 1024 on the spatial dims).
pub const RMBG_INPUT: u32 = 1024;
/// ImageNet normalize used by this export family.
pub const RMBG_MEAN: [f32; 3] = [0.485, 0.456, 0.406];
pub const RMBG_STD: [f32; 3] = [0.229, 0.224, 0.225];

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RmbgStatus {
    pub found: bool,
    pub path: String,
    pub size_mb: f64,
}

/// Candidate model path: <exe-dir>/models/model-rmbg-1.4.onnx.
pub fn default_rmbg_path() -> String {
    let base = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    base.join("models")
        .join(RMBG_FILE)
        .to_string_lossy()
        .into_owned()
}

#[tauri::command]
pub fn cmd_rmbg_status() -> RmbgStatus {
    let path = default_rmbg_path();
    let size_mb = std::fs::metadata(&path).map(|m| m.len() as f64 / 1048576.0).unwrap_or(0.0);
    let found = size_mb > 1.0;
    RmbgStatus { found, path, size_mb }
}

static RMBG_SESSIONS: OnceLock<Mutex<std::collections::HashMap<String, ort::session::Session>>> =
    OnceLock::new();

fn rmbg_lock(
) -> Result<std::sync::MutexGuard<'static, std::collections::HashMap<String, ort::session::Session>>, String> {
    RMBG_SESSIONS
        .get_or_init(|| Mutex::new(std::collections::HashMap::new()))
        .lock()
        .map_err(|e| format!("rmbg session lock poisoned: {e}"))
}

fn ensure_rmbg_session(model_path: &str) -> Result<(), String> {
    let mut guard = rmbg_lock()?;
    if guard.contains_key(model_path) {
        return Ok(());
    }
    if !std::path::Path::new(model_path).is_file() {
        return Err(format!(
            "RMBG model not found at {model_path}. Place model-rmbg-1.4.onnx in <exe-dir>/models/."
        ));
    }
    let session = ort::session::Session::builder()
        .map_err(|e| format!("ort builder: {e}"))?
        .with_optimization_level(ort::session::builder::GraphOptimizationLevel::Level3)
        .map_err(|e| format!("ort opt level: {e}"))?
        .with_intra_threads(rmbg_threads())
        .map_err(|e| format!("ort threads: {e}"))?
        .commit_from_file(model_path)
        .map_err(|e| format!("load model {model_path}: {e}"))?;
    guard.insert(model_path.to_string(), session);
    Ok(())
}

fn use_rmbg_session<R>(model_path: &str, f: impl FnOnce(&mut ort::session::Session) -> Result<R, String>) -> Result<R, String> {
    ensure_rmbg_session(model_path)?;
    let mut guard = rmbg_lock()?;
    let session = guard
        .get_mut(model_path)
        .ok_or("rmbg session missing after load")?;
    f(session)
}

// ---------------------------------------------------------------------------
// Pure math (unit-tested, no ort, no model).
// ---------------------------------------------------------------------------

/// Bilinear sample of one RGBA channel row.
fn sample_bilinear(rgba: &[u8], w: u32, h: u32, c: usize, x: f32, y: f32) -> f32 {
    let wi = w as i64;
    let hi = h as i64;
    let x0 = (x.floor() as i64).clamp(0, wi - 1) as usize;
    let y0 = (y.floor() as i64).clamp(0, hi - 1) as usize;
    let x1 = (x0 + 1).min(w as usize - 1);
    let y1 = (y0 + 1).min(h as usize - 1);
    let fx = (x - x.floor()).clamp(0.0, 1.0);
    let fy = (y - y.floor()).clamp(0.0, 1.0);
    let at = |xx: usize, yy: usize| rgba[(yy * w as usize + xx) * 4 + c] as f32 / 255.0;
    let top = at(x0, y0) * (1.0 - fx) + at(x1, y0) * fx;
    let bot = at(x0, y1) * (1.0 - fx) + at(x1, y1) * fx;
    top * (1.0 - fy) + bot * fy
}

/// RGBA -> ImageNet normalized NCHW float tensor at the working square.
pub fn rmbg_input(rgba: &[u8], w: u32, h: u32) -> Result<(Vec<f32>, [usize; 4]), String> {
    if w < 8 || h < 8 || w > 4096 || h > 4096 {
        return Err(format!("rmbg size out of range: {w}x{h}"));
    }
    if rgba.len() != (w as usize) * (h as usize) * 4 {
        return Err(format!(
            "RGBA size mismatch: got {} bytes for {w}x{h}",
            rgba.len()
        ));
    }
    let s = RMBG_INPUT as usize;
    let mut out = vec![0f32; 3 * s * s];
    for y in 0..s {
        for x in 0..s {
            // plain resize (export expects a square side)
            let sx = (x as f32 + 0.5) * w as f32 / s as f32 - 0.5;
            let sy = (y as f32 + 0.5) * h as f32 / s as f32 - 0.5;
            for c in 0..3 {
                // matte edges stay smooth: bilinear, not nearest
                out[c * s * s + y * s + x] =
                    (sample_bilinear(rgba, w, h, c, sx, sy) - RMBG_MEAN[c]) / RMBG_STD[c];
            }
        }
    }
    Ok((out, [1usize, 3, s, s]))
}

/// Raw model plane -> soft 0..255 alpha matte. Accepts EITHER logits or
/// probabilities: values outside 0..1 go through sigmoid first, then a
/// min-max stretch maps the matte to the full range.
pub fn normalize_mask(raw: &[f32]) -> Vec<u8> {
    if raw.is_empty() {
        return vec![];
    }
    let mut lo = f32::INFINITY;
    let mut hi = f32::NEG_INFINITY;
    for &v in raw {
        if v.is_finite() {
            lo = lo.min(v);
            hi = hi.max(v);
        }
    }
    if !lo.is_finite() {
        return vec![0u8; raw.len()];
    }
    let prob: Vec<f32> = if lo < 0.0 || hi > 1.0 {
        raw.iter()
            .map(|&v| 1.0 / (1.0 + (-v.clamp(-30.0, 30.0)).exp()))
            .collect()
    } else {
        raw.to_vec()
    };
    let mut lo2 = f32::INFINITY;
    let mut hi2 = f32::NEG_INFINITY;
    for &v in &prob {
        lo2 = lo2.min(v);
        hi2 = hi2.max(v);
    }
    let span = (hi2 - lo2).max(1e-6);
    prob.iter()
        .map(|&v| (((v - lo2) / span) * 255.0 + 0.5).clamp(0.0, 255.0) as u8)
        .collect()
}
/// Upscaling reuses segment::upscale_gray (bilinear), so this module keeps
/// no scaler of its own.

/// Otsu threshold over a soft matte: the cutoff that best separates
/// foreground from background. Flat mattes fall back to 128.
pub fn otsu_threshold(soft: &[u8]) -> u8 {
    if soft.is_empty() {
        return 128;
    }
    let mut hist = [0u32; 256];
    for &v in soft {
        hist[v as usize] += 1;
    }
    let total = soft.len() as f64;
    let mut sum_all = 0f64;
    for (i, &c) in hist.iter().enumerate() {
        sum_all += i as f64 * c as f64;
    }
    let mut sum_b = 0f64;
    let mut w_b = 0u32;
    let mut best = 0f64;
    let mut thr = 128u8;
    for t in 0..256 {
        w_b += hist[t];
        if w_b == 0 {
            continue;
        }
        let w_f = soft.len() as u32 - w_b;
        if w_f == 0 {
            break;
        }
        sum_b += t as f64 * hist[t] as f64;
        let m_b = sum_b / w_b as f64;
        let m_f = (sum_all - sum_b) / w_f as f64;
        let between = w_b as f64 * w_f as f64 * (m_b - m_f) * (m_b - m_f);
        if between > best {
            best = between;
            thr = t as u8;
        }
    }
    if best <= 0.0 || (w_b as f64) >= total {
        128
    } else {
        thr
    }
}

/// Drop foreground components smaller than min_frac of all foreground.
/// Kills isolated sky specks while the connected subject survives.
/// Returns (cleaned binary mask, removed component count).
pub fn clean_small_components(bin: &[u8], w: usize, h: usize, min_frac: f32) -> (Vec<u8>, usize) {
    if bin.len() != w * h || w == 0 || h == 0 {
        return (vec![0u8; w * h], 0);
    }
    // Union-find over foreground pixels (nonzero), 4-connected.
    let n = w * h;
    let mut parent: Vec<usize> = (0..n).collect();
    fn find(parent: &mut [usize], mut x: usize) -> usize {
        while parent[x] != x {
            parent[x] = parent[parent[x]];
            x = parent[x];
        }
        x
    }
    for y in 0..h {
        for x in 0..w {
            let i = y * w + x;
            if bin[i] == 0 {
                continue;
            }
            if x > 0 && bin[i - 1] != 0 {
                let (a, b) = (find(&mut parent, i), find(&mut parent, i - 1));
                if a != b {
                    parent[a] = b;
                }
            }
            if y > 0 && bin[i - w] != 0 {
                let (a, b) = (find(&mut parent, i), find(&mut parent, i - w));
                if a != b {
                    parent[a] = b;
                }
            }
        }
    }
    let mut area = vec![0usize; n];
    let mut total_fg = 0usize;
    for i in 0..n {
        if bin[i] == 0 {
            continue;
        }
        total_fg += 1;
        let r = find(&mut parent, i);
        area[r] += 1;
    }
    if total_fg == 0 {
        return (vec![0u8; n], 0);
    }
    let min_area = ((total_fg as f32 * min_frac).ceil() as usize).max(1);
    let mut out = vec![0u8; n];
    let mut seen_root = vec![false; n];
    let mut comp_removed = 0usize;
    for i in 0..n {
        if bin[i] == 0 {
            continue;
        }
        let r = find(&mut parent, i);
        if area[r] >= min_area {
            out[i] = 255;
        } else if !seen_root[r] {
            seen_root[r] = true;
            comp_removed += 1;
        }
    }
    (out, comp_removed)
}

/// Bridge 1px gaps (3x3 dilate) so thin structures like minarets survive
/// as one component instead of shattering into dropped specks.
pub fn close_small_gaps(bin: &[u8], w: usize, h: usize) -> Vec<u8> {
    if bin.len() != w * h || w == 0 || h == 0 {
        return vec![0u8; w * h];
    }
    let mut dil = vec![0u8; w * h];
    for y in 0..h {
        for x in 0..w {
            if bin[y * w + x] == 0 {
                continue;
            }
            for dy in -1..=1 {
                for dx in -1..=1 {
                    let nx = x as isize + dx;
                    let ny = y as isize + dy;
                    if nx >= 0 && ny >= 0 && nx < w as isize && ny < h as isize {
                        dil[ny as usize * w + nx as usize] = 255;
                    }
                }
            }
        }
    }
    // Erode back once: keeps bridged gaps, restores original contours.
    let mut out = vec![0u8; w * h];
    for y in 0..h {
        for x in 0..w {
            let mut all = true;
            for dy in -1..=1 {
                for dx in -1..=1 {
                    let nx = x as isize + dx;
                    let ny = y as isize + dy;
                    let v = if nx >= 0 && ny >= 0 && nx < w as isize && ny < h as isize {
                        dil[ny as usize * w + nx as usize]
                    } else {
                        0
                    };
                    if v == 0 {
                        all = false;
                        break;
                    }
                }
                if !all {
                    break;
                }
            }
            out[y * w + x] = if all { 255 } else { 0 };
        }
    }
    out
}

/// Fill background regions fully enclosed by foreground (arches, windows,
/// donut holes). Flood fills from every border pixel, whatever background
/// remains unreached is a hole.
pub fn fill_enclosed_holes(bin: &[u8], w: usize, h: usize) -> Vec<u8> {
    if bin.len() != w * h || w == 0 || h == 0 {
        return vec![0u8; w * h];
    }
    let n = w * h;
    let mut reached = vec![false; n];
    let mut stack: Vec<usize> = Vec::new();
    for x in 0..w {
        stack.push(x);
        stack.push((h - 1) * w + x);
    }
    for y in 0..h {
        stack.push(y * w);
        stack.push(y * w + w - 1);
    }
    while let Some(i) = stack.pop() {
        if reached[i] || bin[i] != 0 {
            continue;
        }
        reached[i] = true;
        let x = i % w;
        let y = i / w;
        if x > 0 {
            stack.push(i - 1);
        }
        if x + 1 < w {
            stack.push(i + 1);
        }
        if y > 0 {
            stack.push(i - w);
        }
        if y + 1 < h {
            stack.push(i + w);
        }
    }
    bin.iter()
        .enumerate()
        .map(|(i, &v)| if v == 0 && !reached[i] { 255 } else { v })
        .collect()
}

/// Threads sized to the machine (2..8): a 168MB model at 1024px is
/// thread hungry, 4 fixed threads underfeeds modern CPUs.
fn rmbg_threads() -> usize {
    std::thread::available_parallelism()
        .map(|n| (n.get() / 2).clamp(2, 8))
        .unwrap_or(4)
}
/// Luma guide at matte size for edge aware smoothing (bilinear).
pub fn luma_at_size(rgba: &[u8], w: u32, h: u32, tw: usize, th: usize) -> Vec<u8> {
    const LUMA: [f32; 3] = [0.299, 0.587, 0.114];
    let wu = w.max(1) as usize;
    let hu = h.max(1) as usize;
    if rgba.len() < wu * hu * 4 || tw == 0 || th == 0 {
        return vec![0u8; tw.max(1) * th.max(1)];
    }
    let mut out = vec![0u8; tw * th];
    for y in 0..th {
        let gy = (y as f32 + 0.5) * hu as f32 / th as f32 - 0.5;
        let y0 = (gy.floor() as isize).clamp(0, hu as isize - 1) as usize;
        let y1 = (y0 + 1).min(hu - 1);
        let fy = (gy - y0 as f32).clamp(0.0, 1.0);
        for x in 0..tw {
            let gx = (x as f32 + 0.5) * wu as f32 / tw as f32 - 0.5;
            let x0 = (gx.floor() as isize).clamp(0, wu as isize - 1) as usize;
            let x1 = (x0 + 1).min(wu - 1);
            let fx = (gx - x0 as f32).clamp(0.0, 1.0);
            let px = |xx: usize, yy: usize| {
                let i = (yy * wu + xx) * 4;
                (rgba[i] as f32 * LUMA[0] + rgba[i + 1] as f32 * LUMA[1] + rgba[i + 2] as f32 * LUMA[2]).clamp(0.0, 255.0)
            };
            let v = px(x0, y0) * (1.0 - fx) * (1.0 - fy)
                + px(x1, y0) * fx * (1.0 - fy)
                + px(x0, y1) * (1.0 - fx) * fy
                + px(x1, y1) * fx * fy;
            out[y * tw + x] = v.round().clamp(0.0, 255.0) as u8;
        }
    }
    out
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RmbgResult {
    /// Soft alpha matte, 0..255, row major at width by height.
    pub mask: Vec<u8>,
    pub width: u32,
    pub height: u32,
    pub millis: u128,
    /// Otsu suggestion computed on the matte: the smart default threshold.
    pub suggested: u8,
    /// Foreground kept after cleanup, 0..100 percent of raw foreground.
    pub kept_pct: f32,
    /// Isolated components dropped by the cleanup.
    pub removed: usize,
}

#[tauri::command]
pub fn cmd_rmbg_remove(
    model_path: Option<String>,
    rgba: Vec<u8>,
    width: u32,
    height: u32,
    cleanup: Option<bool>,
    smooth: Option<bool>,
) -> Result<RmbgResult, String> {
    let t0 = std::time::Instant::now();
    let w = width.max(8).min(4096);
    let h = height.max(8).min(4096);
    if rgba.len() != (w as usize) * (h as usize) * 4 {
        return Err(format!("RGBA size mismatch: got {} bytes for {w}x{h}", rgba.len()));
    }
    let path = model_path.unwrap_or_else(default_rmbg_path);
    let (tensor, dims) = rmbg_input(&rgba, w, h)?;
    let (mw, mh, plane) = use_rmbg_session(&path, |session| {
        let name = session
            .inputs()
            .first()
            .map(|o| o.name().to_string())
            .ok_or("rmbg model has no inputs")?;
        let input_tensor = ort::value::Tensor::from_array((dims, tensor))
            .map_err(|e| format!("ort input tensor: {e}"))?;
        let outputs = session
            .run(ort::inputs![name => input_tensor])
            .map_err(|e| format!("rmbg inference: {e}"))?;
        // First float plane wins: [1,1,H,W] matte, or channel 0 of [1,C,H,W].
        for (_name, value) in outputs.iter() {
            if let Ok((shape, data)) = value.try_extract_tensor::<f32>() {
                let shape: Vec<usize> = shape.iter().map(|&d| d as usize).collect();
                if shape.len() == 4 && shape[0] >= 1 && shape[1] >= 1 {
                    let (lw, lh) = (shape[3], shape[2]);
                    if lw < 4 || lh < 4 || lw * lh == 0 {
                        continue;
                    }
                    let plane: Vec<f32> = data.iter().take(lw * lh).copied().collect();
                    if plane.len() == lw * lh {
                        return Ok((lw, lh, plane));
                    }
                } else if shape.len() == 2 {
                    let (lw, lh) = (shape[1], shape[0]);
                    if lw >= 4 && lh >= 4 {
                        return Ok((lw, lh, data.to_vec()));
                    }
                }
            }
        }
        Err("no float matte output from rmbg model".to_string())
    })?;
    let soft = normalize_mask(&plane);
    // Smart matte: Otsu cutoff, bridge hairline gaps so thin towers stay
    // one piece, drop isolated specks, fill enclosed holes (arches), then
    // snap edges to the photo. Frontend can still re-threshold live.
    let suggested = otsu_threshold(&soft);
    let bin: Vec<u8> = soft.iter().map(|&v| if v >= suggested { 255 } else { 0 }).collect();
    let bridged = close_small_gaps(&bin, mw, mh);
    let fg_before = bridged.iter().filter(|&&v| v != 0).count();
    let (clean, removed) = if cleanup.unwrap_or(true) {
        let (c, r) = clean_small_components(&bridged, mw, mh, 0.004);
        (fill_enclosed_holes(&c, mw, mh), r)
    } else {
        (fill_enclosed_holes(&bridged, mw, mh), 0)
    };
    let fg_after = clean.iter().filter(|&&v| v != 0).count();
    let kept_pct = if fg_before == 0 {
        0.0
    } else {
        100.0 * fg_after as f32 / fg_before as f32
    };
    let refined = if smooth.unwrap_or(true) {
        let guide = luma_at_size(&rgba, w, h, mw, mh);
        guided_refine(&clean, &guide, mw, mh, 4, 0.01)
    } else {
        soft.iter()
            .zip(clean.iter())
            .map(|(&s, &c)| if c == 0 { 0 } else { s })
            .collect()
    };
    let mask = upscale_gray(&refined, mw, mh, w as usize, h as usize);
    Ok(RmbgResult {
        mask,
        width: w,
        height: h,
        millis: t0.elapsed().as_millis(),
        suggested,
        kept_pct,
        removed,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_path_points_at_exe_models() {
        let p = default_rmbg_path();
        assert!(p.ends_with("models/model-rmbg-1.4.onnx") || p.ends_with("models\\model-rmbg-1.4.onnx"));
        assert_eq!(RMBG_INPUT, 1024);
    }

    #[test]
    fn input_rejects_bad_sizes() {
        assert!(rmbg_input(&vec![0u8; 10 * 10 * 4], 10, 10).is_ok());
        assert!(rmbg_input(&vec![0u8; 10], 10, 10).is_err());
        assert!(rmbg_input(&vec![0u8; 4 * 4 * 4], 4, 4).is_err());
        let (t, dims) = rmbg_input(&vec![128u8; 10 * 10 * 4], 10, 10).unwrap();
        assert_eq!(dims, [1, 3, 1024, 1024]);
        assert_eq!(t.len(), 3 * 1024 * 1024);
    }

    #[test]
    fn normalize_handles_logits_and_probs() {
        // logits path: sigmoid first, then stretch
        let m = normalize_mask(&[-4.0, 0.0, 4.0]);
        assert_eq!(m, vec![0, 128, 255]);
        // probability path: straight min-max stretch
        let m = normalize_mask(&[0.2, 0.5, 0.8]);
        assert_eq!(m, vec![0, 128, 255]);
        // flat and hostile inputs never poison
        assert_eq!(normalize_mask(&[0.5, 0.5]), vec![0, 0]);
        assert_eq!(normalize_mask(&[]), Vec::<u8>::new());
        assert_eq!(normalize_mask(&[f32::NAN, f32::INFINITY]), vec![0, 0]);
    }

    #[test]
    fn smart_matte_helpers_behave() {
        let mut two = vec![30u8; 50];
        two.extend(vec![220u8; 50]);
        let t = otsu_threshold(&two);
        assert!(t > 30 && t < 220, "otsu={t}");
        // Flat mattes fall back instead of guessing wildly.
        assert_eq!(otsu_threshold(&[128u8; 10]), 128);
        assert_eq!(otsu_threshold(&[]), 128);
        // Connected subject survives, isolated specks go.
        // 10x10: block columns 0..5 (50px) plus two lone pixels.
        let mut bin = vec![0u8; 100];
        for y in 0..10 {
            for x in 0..6 {
                bin[y * 10 + x] = 255;
            }
        }
        bin[7 * 10 + 8] = 255;
        bin[1 * 10 + 9] = 255;
        let (clean, removed) = clean_small_components(&bin, 10, 10, 0.05);
        assert_eq!(removed, 2);
        assert_eq!(clean.iter().filter(|&&v| v != 0).count(), 60);
        // Empty and mismatched inputs stay safe.
        assert_eq!(clean_small_components(&[], 0, 0, 0.004), (vec![0u8; 0], 0));
        assert_eq!(clean_small_components(&[255u8; 4], 3, 3, 0.004), (vec![0u8; 9], 0));
        // Luma guide has the requested shape.
        let rgba = vec![255u8; 8 * 8 * 4];
        assert_eq!(luma_at_size(&rgba, 8, 8, 4, 4), vec![255u8; 16]);
        assert_eq!(luma_at_size(&[], 8, 8, 4, 4).len(), 16);
    }

    #[test]
    fn gaps_bridge_and_holes_fill() {
        // Two bars 1px apart become one component after closing.
        let mut bin = vec![0u8; 100];
        for y in 0..10 {
            for x in 0..4 {
                bin[y * 10 + x] = 255;
            }
            for x in 6..10 {
                bin[y * 10 + x] = 255;
            }
        }
        let bridged = close_small_gaps(&bin, 10, 10);
        let (clean, removed) = clean_small_components(&bridged, 10, 10, 0.05);
        assert_eq!(removed, 0);
        // Erosion trims the outer ring, the bridged 8x8 core stays whole.
        assert_eq!(clean.iter().filter(|&&v| v != 0).count(), 64);
        // A closed ring keeps its hole filled, an open one stays open.
        let mut ring = vec![0u8; 100];
        for i in 0..10 {
            ring[i] = 255;
            ring[90 + i] = 255;
            ring[i * 10] = 255;
            ring[i * 10 + 9] = 255;
        }
        let filled = fill_enclosed_holes(&ring, 10, 10);
        assert_eq!(filled.iter().filter(|&&v| v != 0).count(), 100);
        let mut open = vec![0u8; 100];
        for i in 0..10 {
            open[i] = 255;
        }
        assert_eq!(fill_enclosed_holes(&open, 10, 10), open);
        // Thread pool stays in the sane band on any machine.
        let t = rmbg_threads();
        assert!((2..=8).contains(&t), "threads={t}");
    }
}
