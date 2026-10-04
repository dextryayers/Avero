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

/// Fraction of frame border pixels that are foreground. Flat graphics
/// (logos on white) fool the model into keeping the whole page, which
/// shows up as a border owned by foreground.
pub fn border_fg_ratio(bin: &[u8], w: usize, h: usize) -> f32 {
    if bin.len() != w * h || w < 3 || h < 3 {
        return 0.0;
    }
    let mut fg = 0usize;
    let mut n = 0usize;
    for x in 0..w {
        for &y in &[0, h - 1] {
            n += 1;
            if bin[y * w + x] != 0 {
                fg += 1;
            }
        }
    }
    for y in 1..h - 1 {
        for &x in &[0, w - 1] {
            n += 1;
            if bin[y * w + x] != 0 {
                fg += 1;
            }
        }
    }
    if n == 0 {
        0.0
    } else {
        fg as f32 / n as f32
    }
}

/// Flip foreground and background.
pub fn invert_mask(bin: &[u8]) -> Vec<u8> {
    bin.iter().map(|&v| if v != 0 { 0 } else { 255 }).collect()
}

/// Pick the orientation whose background owns the frame edges. Flips only
/// on decisive evidence: the flipped mask barely touches the border while
/// the original clearly does. Correct photo mattes never satisfy this, so
/// they pass through untouched. Returns (mask, was_flipped).
pub fn orient_subject(bin: Vec<u8>, w: usize, h: usize) -> (Vec<u8>, bool) {
    let b = border_fg_ratio(&bin, w, h);
    if b < 0.01 {
        return (bin, false);
    }
    let flipped = invert_mask(&bin);
    let f = border_fg_ratio(&flipped, w, h);
    if f < 0.15 && b > f + 0.20 {
        (flipped, true)
    } else {
        (bin, false)
    }
}

/// Label 4-connected foreground components. Returns (id per pixel with
/// u32::MAX for background, area per component, touches-border per
/// component).
fn label_components(bin: &[u8], w: usize, h: usize) -> (Vec<u32>, Vec<usize>, Vec<bool>) {
    let n = w * h;
    let mut ids = vec![u32::MAX; n];
    let mut sizes: Vec<usize> = Vec::new();
    let mut touches: Vec<bool> = Vec::new();
    let mut stack: Vec<usize> = Vec::new();
    for i in 0..n {
        if bin[i] == 0 || ids[i] != u32::MAX {
            continue;
        }
        let cid = sizes.len() as u32;
        let mut size = 0usize;
        let mut tb = false;
        stack.push(i);
        ids[i] = cid;
        while let Some(p) = stack.pop() {
            size += 1;
            let x = p % w;
            let y = p / w;
            if x == 0 || y == 0 || x == w - 1 || y == h - 1 {
                tb = true;
            }
            if x > 0 && bin[p - 1] != 0 && ids[p - 1] == u32::MAX {
                ids[p - 1] = cid;
                stack.push(p - 1);
            }
            if x + 1 < w && bin[p + 1] != 0 && ids[p + 1] == u32::MAX {
                ids[p + 1] = cid;
                stack.push(p + 1);
            }
            if y > 0 && bin[p - w] != 0 && ids[p - w] == u32::MAX {
                ids[p - w] = cid;
                stack.push(p - w);
            }
            if y + 1 < h && bin[p + w] != 0 && ids[p + w] == u32::MAX {
                ids[p + w] = cid;
                stack.push(p + w);
            }
        }
        sizes.push(size);
        touches.push(tb);
    }
    (ids, sizes, touches)
}

/// Drop foreground components touching the frame edge: leftover page,
/// backdrop, or wall fragments around the subject. Returns (mask, dropped).
pub fn drop_border_components(bin: &[u8], w: usize, h: usize) -> (Vec<u8>, usize) {
    if bin.len() != w * h || w == 0 || h == 0 {
        return (vec![0u8; w * h], 0);
    }
    let (ids, _sizes, touches) = label_components(bin, w, h);
    let drop: Vec<bool> = touches.iter().map(|&t| t).collect();
    let dropped = drop.iter().filter(|&&d| d).count();
    let out: Vec<u8> = bin
        .iter()
        .enumerate()
        .map(|(i, &v)| {
            if v != 0 && ids[i] != u32::MAX && drop[ids[i] as usize] {
                0
            } else {
                v
            }
        })
        .collect();
    (out, dropped)
}

/// Keep only the `keep` largest components (0 = off). Returns (mask, dropped).
pub fn keep_largest_components(bin: &[u8], w: usize, h: usize, keep: usize) -> (Vec<u8>, usize) {
    if bin.len() != w * h || w == 0 || h == 0 {
        return (vec![0u8; w * h], 0);
    }
    if keep == 0 {
        return (bin.to_vec(), 0);
    }
    let (ids, sizes, _touches) = label_components(bin, w, h);
    if sizes.len() <= keep {
        return (bin.to_vec(), 0);
    }
    let mut order: Vec<usize> = (0..sizes.len()).collect();
    order.sort_unstable_by(|&a, &b| sizes[b].cmp(&sizes[a]));
    let keep_set: Vec<bool> = {
        let mut k = vec![false; sizes.len()];
        for &c in order.iter().take(keep) {
            k[c] = true;
        }
        k
    };
    let dropped = sizes.len() - keep;
    let out: Vec<u8> = bin
        .iter()
        .enumerate()
        .map(|(i, &v)| {
            if v != 0 && ids[i] != u32::MAX && !keep_set[ids[i] as usize] {
                0
            } else {
                v
            }
        })
        .collect();
    (out, dropped)
}

/// Page color when the frame corners are provably uniform (flat graphics:
/// logo on a white page, screenshot on solid backdrop). Pooled stddev under
/// 10 per channel counts as uniform; anything textured returns None.
pub fn page_color_if_uniform(rgba: &[u8], w: usize, h: usize) -> Option<[f32; 3]> {
    if w < 16 || h < 16 || rgba.len() < w * h * 4 {
        return None;
    }
    let r = 6usize;
    let mut sum = [0u64; 3];
    let mut sq = [0u64; 3];
    let mut n = 0u64;
    for (cx, cy) in [(r, r), (w - 1 - r, r), (r, h - 1 - r), (w - 1 - r, h - 1 - r)] {
        for y in cy - r..=cy + r {
            for x in cx - r..=cx + r {
                let p = (y * w + x) * 4;
                for k in 0..3 {
                    let v = rgba[p + k] as u64;
                    sum[k] += v;
                    sq[k] += v * v;
                }
                n += 1;
            }
        }
    }
    if n == 0 {
        return None;
    }
    let nf = n as f64;
    let mut mean = [0f32; 3];
    for k in 0..3 {
        let m = sum[k] as f64 / nf;
        let var = (sq[k] as f64 / nf - m * m).max(0.0);
        if var.sqrt() > 10.0 {
            return None;
        }
        mean[k] = m as f32;
    }
    Some(mean)
}

/// Foreground where the source color differs from the page color beyond
/// tolerance, sampled at matte size. Deterministic and exact on flat
/// graphics where the neural matte guesses backwards.
pub fn flat_bg_mask(
    rgba: &[u8],
    sw: usize,
    sh: usize,
    page: [f32; 3],
    tol: f32,
    mw: usize,
    mh: usize,
) -> Vec<u8> {
    if mw == 0 || mh == 0 || sw == 0 || sh == 0 || rgba.len() < sw * sh * 4 {
        return vec![0u8; mw * mh];
    }
    let mut out = vec![0u8; mw * mh];
    for y in 0..mh {
        for x in 0..mw {
            let sx = (x * sw / mw).min(sw - 1);
            let sy = (y * sh / mh).min(sh - 1);
            let p = (sy * sw + sx) * 4;
            let d = ((rgba[p] as f32 - page[0]).powi(2)
                + (rgba[p + 1] as f32 - page[1]).powi(2)
                + (rgba[p + 2] as f32 - page[2]).powi(2))
            .sqrt();
            out[y * mw + x] = if d > tol { 255 } else { 0 };
        }
    }
    out
}
/// Page/backdrop estimate: mean color of small patches in the four
/// corners. Real photos have background in at least some corners; flat
/// graphics have the page color in all of them.
pub fn corner_bg_color(rgba: &[u8], w: usize, h: usize) -> [f32; 3] {
    if w == 0 || h == 0 || rgba.len() < w * h * 4 {
        return [0.0, 0.0, 0.0];
    }
    let r = 4usize.min(w / 4).min(h / 4);
    let patch = |cx: usize, cy: usize| {
        let mut sum = [0u64; 3];
        let mut n = 0u64;
        for y in cy.saturating_sub(r)..=(cy + r).min(h - 1) {
            for x in cx.saturating_sub(r)..=(cx + r).min(w - 1) {
                let p = (y * w + x) * 4;
                sum[0] += rgba[p] as u64;
                sum[1] += rgba[p + 1] as u64;
                sum[2] += rgba[p + 2] as u64;
                n += 1;
            }
        }
        (sum, n.max(1))
    };
    let corners = [(r, r), (w - 1 - r, r), (r, h - 1 - r), (w - 1 - r, h - 1 - r)];
    let mut sum = [0u64; 3];
    let mut n = 0u64;
    for (cx, cy) in corners {
        let (s, c) = patch(cx, cy);
        for k in 0..3 {
            sum[k] += s[k];
        }
        n += c;
    }
    let n = n.max(1) as f32;
    [sum[0] as f32 / n, sum[1] as f32 / n, sum[2] as f32 / n]
}

/// Mean source color per component id. Matte-space labels map onto source
/// pixels by nearest scaling, good enough for a color likeness check.
fn component_colors(
    bin: &[u8],
    mw: usize,
    mh: usize,
    rgba: &[u8],
    sw: usize,
    sh: usize,
    ids: &[u32],
    ncomp: usize,
) -> Vec<[f32; 3]> {
    let mut sum = vec![[0u64; 3]; ncomp];
    let mut cnt = vec![0u64; ncomp];
    for (i, &v) in bin.iter().enumerate() {
        if v == 0 {
            continue;
        }
        let c = ids[i] as usize;
        if c >= ncomp {
            continue;
        }
        let sx = ((i % mw) * sw / mw).min(sw - 1);
        let sy = ((i / mw) * sh / mh).min(sh - 1);
        let p = (sy * sw + sx) * 4;
        if p + 2 >= rgba.len() {
            continue;
        }
        sum[c][0] += rgba[p] as u64;
        sum[c][1] += rgba[p + 1] as u64;
        sum[c][2] += rgba[p + 2] as u64;
        cnt[c] += 1;
    }
    sum.iter()
        .zip(cnt.iter())
        .map(|(s, &c)| {
            let c = c.max(1) as f32;
            [s[0] as f32 / c, s[1] as f32 / c, s[2] as f32 / c]
        })
        .collect()
}

/// Smart edge trim: drop border-touching components whose color matches the
/// page/backdrop estimate within tolerance. Conservative on purpose: only
/// near-identical colors go, so a subject that happens to touch the frame
/// survives unless it is painted in backdrop color. Returns (mask, dropped).
pub fn drop_bg_colored_border(
    bin: &[u8],
    mw: usize,
    mh: usize,
    rgba: &[u8],
    sw: usize,
    sh: usize,
    tol: f32,
) -> (Vec<u8>, usize) {
    if bin.len() != mw * mh || mw == 0 || mh == 0 {
        return (vec![0u8; mw * mh], 0);
    }
    let (ids, sizes, touches) = label_components(bin, mw, mh);
    if sizes.is_empty() {
        return (bin.to_vec(), 0);
    }
    let bg = corner_bg_color(rgba, sw, sh);
    let means = component_colors(bin, mw, mh, rgba, sw, sh, &ids, sizes.len());
    let drop: Vec<bool> = touches
        .iter()
        .zip(means.iter())
        .map(|(&t, m)| {
            if !t {
                return false;
            }
            let d = ((m[0] - bg[0]).powi(2) + (m[1] - bg[1]).powi(2) + (m[2] - bg[2]).powi(2)).sqrt();
            d <= tol
        })
        .collect();
    let dropped = drop.iter().filter(|&&d| d).count();
    let out: Vec<u8> = bin
        .iter()
        .enumerate()
        .map(|(i, &v)| {
            if v != 0 && ids[i] != u32::MAX && drop[ids[i] as usize] {
                0
            } else {
                v
            }
        })
        .collect();
    (out, dropped)
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
    /// Subject coverage, 0..100 percent of the frame after cleanup.
    pub kept_pct: f32,
    /// Components dropped by orientation fix, border trim, and cleanup.
    pub removed: usize,
    /// True when the matte orientation was flipped (auto or forced).
    pub inverted: bool,
    /// True when the neural matte looked backwards on a flat page and the
    /// deterministic page-color mask took over instead.
    pub flat_bg: bool,
}

#[tauri::command]
pub fn cmd_rmbg_remove(
    model_path: Option<String>,
    rgba: Vec<u8>,
    width: u32,
    height: u32,
    cleanup: Option<bool>,
    smooth: Option<bool>,
    invert: Option<bool>,
    trim_borders: Option<bool>,
    keep_largest: Option<usize>,
    smart_trim: Option<bool>,
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
    // one piece, fix backwards orientation on flat graphics (logo on a
    // page: the model keeps the page), trim edge-touching leftovers on
    // request, drop isolated specks, keep the main subject on request,
    // fill enclosed holes (arches), then snap edges to the photo.
    // Frontend can still re-threshold live.
    let suggested = otsu_threshold(&soft);
    let bin: Vec<u8> = soft.iter().map(|&v| if v >= suggested { 255 } else { 0 }).collect();
    // Flat-page rescue: the neural matte owns the whole frame on uniform
    // pages (logo on white) instead of the subject. A page-color mask is
    // exact there, so it takes over; good photo mattes never trip the gate
    // and flow through untouched.
    let mut flat_bg = false;
    let bin = if border_fg_ratio(&bin, mw, mh) > 0.5 {
        match page_color_if_uniform(&rgba, w as usize, h as usize) {
            Some(page) => {
                flat_bg = true;
                flat_bg_mask(&rgba, w as usize, h as usize, page, 32.0, mw, mh)
            }
            None => bin,
        }
    } else {
        bin
    };
    let bridged = close_small_gaps(&bin, mw, mh);
    let (mut matte, auto_flipped) = match invert {
        Some(true) => (invert_mask(&bridged), true),
        Some(false) => (bridged, false),
        None => orient_subject(bridged, mw, mh),
    };
    let inverted = auto_flipped || invert == Some(true);
    let mut dropped: usize = 0;
    // Smart trim first: edge-touching pieces painted in backdrop color go,
    // real subjects stay even when they touch the frame.
    if smart_trim.unwrap_or(true) {
        let (m, d) = drop_bg_colored_border(&matte, mw, mh, &rgba, w as usize, h as usize, 24.0);
        matte = m;
        dropped += d;
    }
    if trim_borders.unwrap_or(false) {
        let (m, d) = drop_border_components(&matte, mw, mh);
        matte = m;
        dropped += d;
    }
    let (clean, removed) = if cleanup.unwrap_or(true) {
        clean_small_components(&matte, mw, mh, 0.004)
    } else {
        (matte, 0)
    };
    dropped += removed;
    let (subject, kdrop) = keep_largest_components(&clean, mw, mh, keep_largest.unwrap_or(0));
    dropped += kdrop;
    let holed = fill_enclosed_holes(&subject, mw, mh);
    let fg_after = holed.iter().filter(|&&v| v != 0).count();
    let kept_pct = 100.0 * fg_after as f32 / (mw * mh).max(1) as f32;
    let refined = if smooth.unwrap_or(true) {
        let guide = luma_at_size(&rgba, w, h, mw, mh);
        guided_refine(&holed, &guide, mw, mh, 4, 0.01)
    } else {
        soft.iter()
            .zip(holed.iter())
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
        removed: dropped,
        inverted,
        flat_bg,
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

    #[test]
    fn orientation_fix_and_subject_filters() {
        // Logo-on-page: everything fg except an enclosed pocket reads as a
        // backwards matte and flips; the flipped border is clean.
        let mut page = vec![255u8; 100];
        for y in 3..7 {
            for x in 3..7 {
                page[y * 10 + x] = 0;
            }
        }
        assert!(border_fg_ratio(&page, 10, 10) > 0.9);
        let (fixed, flipped) = orient_subject(page, 10, 10);
        assert!(flipped);
        assert!(border_fg_ratio(&fixed, 10, 10) < 0.15);
        // Correct photo matte (clean border, subject inside) passes through.
        let mut photo = vec![0u8; 100];
        for y in 2..8 {
            for x in 2..8 {
                photo[y * 10 + x] = 255;
            }
        }
        let (same, flipped) = orient_subject(photo.clone(), 10, 10);
        assert!(!flipped);
        assert_eq!(same, photo);
        // Forced orientations are honored.
        assert_eq!(invert_mask(&[0, 255, 0]), vec![255, 0, 255]);
        // Edge-touching slab goes with trim, centered block stays.
        let mut trim = vec![0u8; 100];
        for i in 0..10 {
            trim[i] = 255;
            trim[50 + i] = 255;
        }
        for y in 7..9 {
            for x in 4..6 {
                trim[y * 10 + x] = 255;
            }
        }
        let (t, d) = drop_border_components(&trim, 10, 10);
        assert_eq!(d, 2);
        assert_eq!(t.iter().filter(|&&v| v != 0).count(), 4);
        // Keep-largest isolates the hero component.
        let (k, d) = keep_largest_components(&trim, 10, 10, 1);
        assert_eq!(d, 2);
        assert_eq!(k.iter().filter(|&&v| v != 0).count(), 10);
        assert_eq!(keep_largest_components(&trim, 10, 10, 0).1, 0);
        assert_eq!(keep_largest_components(&trim, 10, 10, 9).1, 0);
    }

    #[test]
    fn smart_trim_keeps_subject_drops_backdrop() {
        // 32x32 white page, dark rect subject in the middle, one white
        // slab kept along the top edge: smart trim drops the slab only.
        let s = 32usize;
        let mut rgba = vec![255u8; s * s * 4];
        for y in 12..22 {
            for x in 12..22 {
                let p = (y * s + x) * 4;
                rgba[p] = 20;
                rgba[p + 1] = 20;
                rgba[p + 2] = 20;
            }
        }
        let bg = corner_bg_color(&rgba, s, s);
        assert!(bg[0] > 250.0 && bg[1] > 250.0 && bg[2] > 250.0);
        let mut bin = vec![0u8; s * s];
        for x in 0..s {
            bin[x] = 255;
        }
        for y in 12..22 {
            for x in 12..22 {
                bin[y * s + x] = 255;
            }
        }
        let (t, d) = drop_bg_colored_border(&bin, s, s, &rgba, s, s, 24.0);
        assert_eq!(d, 1);
        assert_eq!(t.iter().filter(|&&v| v != 0).count(), 100);
        // A subject touching the frame in its own color survives.
        for y in 0..s {
            for x in 0..s {
                bin[y * s + x] = 255;
            }
        }
        let (t, d) = drop_bg_colored_border(&bin, s, s, &rgba, s, s, 24.0);
        assert_eq!(d, 0);
        assert_eq!(t.iter().filter(|&&v| v != 0).count(), s * s);
    }

    #[test]
    fn flat_page_helpers_behave() {
        // Uniform page with a dark rect: page color detected, mask
        // keeps exactly the rect.
        let s = 48usize;
        let mut rgba = vec![253u8; s * s * 4];
        for y in 18..32 {
            for x in 18..32 {
                let p = (y * s + x) * 4;
                rgba[p] = 20;
                rgba[p + 1] = 30;
                rgba[p + 2] = 60;
            }
        }
        let page = page_color_if_uniform(&rgba, s, s).expect("uniform page");
        assert!(page[0] > 240.0);
        let m = flat_bg_mask(&rgba, s, s, page, 32.0, s, s);
        assert_eq!(m.iter().filter(|&&v| v != 0).count(), 196);
        // Half-dark frame is not a flat page.
        for y in 0..s {
            for x in 0..24 {
                let p = (y * s + x) * 4;
                rgba[p] = 10;
                rgba[p + 1] = 10;
                rgba[p + 2] = 10;
            }
        }
        assert_eq!(page_color_if_uniform(&rgba, s, s), None);
        assert_eq!(page_color_if_uniform(&[], 0, 0), None);
    }
}
