// Avero Remove BG engine: three high precision ONNX models with per model
// precision profiles on one shared maximum performance pipeline. Each model
// is selectable in the UI as Avero Remove BG I, II, or III. All three use
// ImageNet normalize at a 1024 working square, robust percentile matte
// scaling, scored cutoff search, smart trim, size limited hole fill, soft
// gated guided refinement, alpha polish, and a full resolution edge snap,
// so results stay clean, neat, and highly precise while each backbone keeps
// its own strength. Graph input and output names are read from the session,
// never hardcoded, so all three exports work without per model hacks. Pure
// helpers are unit tested without a model. Model files resolve from
// <exe-dir>/models/ with fallbacks to the repo model/ folder for dev.

use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::sync::{Mutex, OnceLock};

use crate::segment::{guided_refine, upscale_gray};

/// Default file for backward compatibility (Avero Remove BG I).
pub const RMBG_FILE: &str = "model-rmbg-1.4.onnx";
/// Working square every bundled export expects. RMBG2-0 accepts dynamic
/// shapes but 1024 is its tuned size, so one size fits all three models.
pub const RMBG_INPUT: u32 = 1024;
/// ImageNet normalize shared by all three model families.
pub const RMBG_MEAN: [f32; 3] = [0.485, 0.456, 0.406];
pub const RMBG_STD: [f32; 3] = [0.229, 0.224, 0.225];

/// Registry entry for one selectable background removal model.
#[derive(Clone, Copy, Debug)]
pub struct RmbgModelDef {
    pub id: &'static str,
    pub label: &'static str,
    pub file: &'static str,
    pub input_size: u32,
    pub tagline: &'static str,
}

/// All selectable models in UI order. I is the fast balanced U2-Net,
// II is the high detail RMBG-2.0 backbone, III is the ultra precise
// BiRefNet backbone for hair and fine edges.
pub const RMBG_MODELS: [RmbgModelDef; 3] = [
    RmbgModelDef {
        id: "avero-1",
        label: "Avero Remove BG I",
        file: "model-rmbg-1.4.onnx",
        input_size: 1024,
        tagline: "Fast balanced cutout for everyday photos",
    },
    RmbgModelDef {
        id: "avero-2",
        label: "Avero Remove BG II",
        file: "RMBG2-0.onnx",
        input_size: 1024,
        tagline: "High detail backbone for portraits and products",
    },
    RmbgModelDef {
        id: "avero-3",
        label: "Avero Remove BG III",
        file: "BiReFNet.onnx",
        input_size: 1024,
        tagline: "Ultra precise backbone for hair and fine edges",
    },
];

/// Per model precision profile. Coarse backbones get stronger cleanup
/// and smoothing, fine backbones keep a light touch so hair and thin
/// edges survive. Every value is tuned for a clean neat matte.
#[derive(Clone, Copy, Debug)]
pub struct RmbgProfile {
    pub cleanup_frac: f32,
    pub trim_tol: f32,
    pub guide_radius: usize,
    pub guide_eps: f32,
    pub hole_max_frac: f32,
    pub polish_lo: u8,
    pub polish_hi: u8,
    pub threshold_bias: i16,
}

pub fn profile_for_model(model_id: &str) -> RmbgProfile {
    match model_id {
        "avero-2" => RmbgProfile {
            cleanup_frac: 0.002,
            trim_tol: 22.0,
            guide_radius: 4,
            guide_eps: 0.01,
            hole_max_frac: 0.015,
            polish_lo: 12,
            polish_hi: 240,
            threshold_bias: -4,
        },
        "avero-3" => RmbgProfile {
            cleanup_frac: 0.0012,
            trim_tol: 18.0,
            guide_radius: 3,
            guide_eps: 0.008,
            hole_max_frac: 0.012,
            polish_lo: 10,
            polish_hi: 242,
            threshold_bias: -8,
        },
        _ => RmbgProfile {
            cleanup_frac: 0.004,
            trim_tol: 26.0,
            guide_radius: 5,
            guide_eps: 0.015,
            hole_max_frac: 0.02,
            polish_lo: 16,
            polish_hi: 238,
            threshold_bias: 0,
        },
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RmbgStatus {
    pub found: bool,
    pub path: String,
    pub size_mb: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RmbgModelStatus {
    pub id: String,
    pub label: String,
    pub file: String,
    pub found: bool,
    pub path: String,
    pub size_mb: f64,
    pub input_size: u32,
    pub tagline: String,
}

/// Folder next to the executable that ships the ONNX files.
pub fn rmbg_models_dir() -> std::path::PathBuf {
    let base = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    base.join("models")
}

/// Every location searched for a model file, in priority order.
/// Walks up ancestors from both the executable and the working directory
/// so the repo model/ folder is found no matter which directory the app
/// was launched from. An AVERO_MODELS_DIR override wins when set.
fn candidate_paths_for(file: &str) -> Vec<std::path::PathBuf> {
    let mut out: Vec<std::path::PathBuf> = Vec::with_capacity(24);
    let mut push_unique = |p: std::path::PathBuf| {
        if !out.iter().any(|q| q == &p) {
            out.push(p);
        }
    };
    if let Ok(dir) = std::env::var("AVERO_MODELS_DIR") {
        let d = dir.trim();
        if !d.is_empty() {
            push_unique(std::path::PathBuf::from(d).join(file));
        }
    }
    // Next to the executable, both plural and singular variants.
    push_unique(rmbg_models_dir().join(file));
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            push_unique(dir.join("model").join(file));
            // Walk up from the executable (covers target/debug -> repo root).
            let mut cur = dir.to_path_buf();
            for _ in 0..8 {
                push_unique(cur.join("model").join(file));
                push_unique(cur.join("models").join(file));
                match cur.parent() {
                    Some(p) => cur = p.to_path_buf(),
                    None => break,
                }
            }
        }
    }
    // Walk up from the working directory (covers any launch directory).
    if let Ok(cwd) = std::env::current_dir() {
        let mut cur = cwd.clone();
        for _ in 0..8 {
            push_unique(cur.join("model").join(file));
            push_unique(cur.join("models").join(file));
            match cur.parent() {
                Some(p) => cur = p.to_path_buf(),
                None => break,
            }
        }
    }
    out
}

/// Expected models folder shown in the UI when files are missing.
#[tauri::command]
pub fn cmd_rmbg_models_dir() -> String {
    rmbg_models_dir().to_string_lossy().into_owned()
}

/// First existing path for a file, if any.
fn find_model_file(file: &str) -> Option<std::path::PathBuf> {
    candidate_paths_for(file)
        .into_iter()
        .find(|p| p.is_file())
}

/// Canonical expected path used in messages when a file is missing.
pub fn expected_rmbg_path_for(file: &str) -> String {
    rmbg_models_dir()
        .join(file)
        .to_string_lossy()
        .into_owned()
}

/// Candidate model path for the legacy single model API.
pub fn default_rmbg_path() -> String {
    if let Some(p) = find_model_file(RMBG_FILE) {
        return p.to_string_lossy().into_owned();
    }
    expected_rmbg_path_for(RMBG_FILE)
}

/// Resolve a user supplied model reference (absolute path, file name,
// or registry id) to an existing file when possible.
fn resolve_rmbg_file(requested_path: Option<&str>, requested_id: Option<&str>) -> Option<String> {
    if let Some(id) = requested_id {
        let clean = id.trim();
        if !clean.is_empty() {
            if let Some(def) = RMBG_MODELS.iter().find(|m| m.id == clean) {
                if let Some(p) = find_model_file(def.file) {
                    return Some(p.to_string_lossy().into_owned());
                }
                return Some(expected_rmbg_path_for(def.file));
            }
        }
    }
    if let Some(p) = requested_path {
        let clean = p.trim();
        if !clean.is_empty() && clean != "null" {
            let pb = std::path::PathBuf::from(clean);
            if pb.is_file() {
                return Some(clean.to_owned());
            }
            // Bare file name: search known folders.
            if let Some(name) = pb.file_name().and_then(|n| n.to_str()) {
                if let Some(found) = find_model_file(name) {
                    return Some(found.to_string_lossy().into_owned());
                }
            }
            return Some(clean.to_owned());
        }
    }
    // Default: first available model in registry order.
    for def in RMBG_MODELS.iter() {
        if let Some(p) = find_model_file(def.file) {
            return Some(p.to_string_lossy().into_owned());
        }
    }
    Some(default_rmbg_path())
}

fn status_for_def(def: &RmbgModelDef) -> RmbgModelStatus {
    match find_model_file(def.file) {
        Some(p) => {
            let size_mb =
                std::fs::metadata(&p).map(|m| m.len() as f64 / 1048576.0).unwrap_or(0.0);
            RmbgModelStatus {
                id: def.id.to_string(),
                label: def.label.to_string(),
                file: def.file.to_string(),
                found: size_mb > 1.0,
                path: p.to_string_lossy().into_owned(),
                size_mb,
                input_size: def.input_size,
                tagline: def.tagline.to_string(),
            }
        }
        None => RmbgModelStatus {
            id: def.id.to_string(),
            label: def.label.to_string(),
            file: def.file.to_string(),
            found: false,
            path: expected_rmbg_path_for(def.file),
            size_mb: 0.0,
            input_size: def.input_size,
            tagline: def.tagline.to_string(),
        },
    }
}

#[tauri::command]
pub fn cmd_rmbg_models_status() -> Vec<RmbgModelStatus> {
    RMBG_MODELS.iter().map(status_for_def).collect()
}

#[tauri::command]
pub fn cmd_rmbg_status() -> RmbgStatus {
    let s = status_for_def(&RMBG_MODELS[0]);
    RmbgStatus {
        found: s.found,
        path: s.path,
        size_mb: s.size_mb,
    }
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
            "Background removal model not found at {model_path}. Place the ONNX file in <exe-dir>/models/."
        ));
    }
    let session = ort::session::Session::builder()
        .map_err(|e| format!("ort builder: {e}"))?
        .with_optimization_level(ort::session::builder::GraphOptimizationLevel::Level3)
        .map_err(|e| format!("ort opt level: {e}"))?
        .with_memory_pattern(true)
        .map_err(|e| format!("ort memory pattern: {e}"))?
        .with_intra_threads(rmbg_threads())
        .map_err(|e| format!("ort threads: {e}"))?
        .with_inter_threads(1)
        .map_err(|e| format!("ort inter threads: {e}"))?
        .with_parallel_execution(false)
        .map_err(|e| format!("ort execution mode: {e}"))?
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

/// Bilinear sample of one RGBA channel row (kept for tests and reference,
/// the hot preprocess path inlines this math inside a rayon row loop).
#[allow(dead_code)]
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
// Parallel over output rows with rayon for maximum throughput on
// multicore machines. Bilinear sampling keeps matte edges smooth.
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
    let wf = w as f32;
    let hf = h as f32;
    let sf = s as f32;
    out.par_chunks_mut(s)
        .enumerate()
        .for_each(|(row, chunk)| {
            let plane = row / s;
            let y = row % s;
            let sy = (y as f32 + 0.5) * hf / sf - 0.5;
            let y0f = sy.floor();
            let mut y0 = y0f as i64;
            if y0 < 0 {
                y0 = 0;
            } else if y0 > h as i64 - 1 {
                y0 = h as i64 - 1;
            }
            let y0u = y0 as usize;
            let y1u = (y0u + 1).min(h as usize - 1);
            let fy = (sy - y0f).clamp(0.0, 1.0);
            let mean = RMBG_MEAN[plane];
            let std = RMBG_STD[plane];
            let wi = w as usize;
            for x in 0..s {
                let sx = (x as f32 + 0.5) * wf / sf - 0.5;
                let x0f = sx.floor();
                let mut x0 = x0f as i64;
                if x0 < 0 {
                    x0 = 0;
                } else if x0 > w as i64 - 1 {
                    x0 = w as i64 - 1;
                }
                let x0u = x0 as usize;
                let x1u = (x0u + 1).min(wi - 1);
                let fx = (sx - x0f).clamp(0.0, 1.0);
                let base = plane;
                let t0 = rgba[(y0u * wi + x0u) * 4 + base] as f32 / 255.0;
                let t1 = rgba[(y0u * wi + x1u) * 4 + base] as f32 / 255.0;
                let b0 = rgba[(y1u * wi + x0u) * 4 + base] as f32 / 255.0;
                let b1 = rgba[(y1u * wi + x1u) * 4 + base] as f32 / 255.0;
                let top = t0 * (1.0 - fx) + t1 * fx;
                let bot = b0 * (1.0 - fx) + b1 * fx;
                let v = top * (1.0 - fy) + bot * fy;
                chunk[x] = (v - mean) / std;
            }
        });
    Ok((out, [1usize, 3, s, s]))
}

/// Raw model plane -> soft 0..255 alpha matte. Accepts EITHER logits or
/// probabilities: values outside 0..1 go through sigmoid first, then a
/// robust percentile stretch maps the matte to the full range.
/// Percentiles (not min and max) suppress single outlier pixels that would
/// otherwise amplify noise across the whole matte. Flat uncertain outputs
/// with almost no contrast return an empty matte instead of stretched noise,
// which keeps backgrounds clean instead of messy.
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
        raw.iter().map(|&v| v.clamp(0.0, 1.0)).collect()
    };
    let n = prob.len();
    // Tiny inputs (unit tests, thumbnails): exact min-max stretch keeps
    // the classic mapping precise.
    if n < 1024 {
        let mut lo2 = f32::INFINITY;
        let mut hi2 = f32::NEG_INFINITY;
        for &v in &prob {
            lo2 = lo2.min(v);
            hi2 = hi2.max(v);
        }
        let span = (hi2 - lo2).max(1e-6);
        return prob
            .iter()
            .map(|&v| (((v - lo2) / span) * 255.0 + 0.5).clamp(0.0, 255.0) as u8)
            .collect();
    }
    // Robust stretch between the 1st and 99th percentile.
    let mut sorted = prob.clone();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let p1 = sorted[(n.saturating_sub(1)) * 1 / 100];
    let p99 = sorted[(n.saturating_sub(1)) * 99 / 100];
    let span = p99 - p1;
    // Flat matte: no confident subject anywhere, keep it empty and clean.
    if span < 0.08 {
        // Genuine bimodal mattes never trip this gate because their
        // percentile span is wide. Only uncertain noise does.
        let mean: f32 = prob.iter().sum::<f32>() / n.max(1) as f32;
        if mean < 0.35 || mean > 0.65 {
            return vec![0u8; n];
        }
        // Near 0.5 mean with tiny span is pure uncertainty: empty matte.
        return vec![0u8; n];
    }
    let inv = 1.0 / span.max(1e-6);
    prob.iter()
        .map(|&v| ((((v - p1) * inv) * 255.0 + 0.5).clamp(0.0, 255.0)) as u8)
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
    // Absolute floor scales with matte size so 1024px mattes drop visible
    // dots even when the subject is huge, while tiny test mattes behave.
    let absolute = ((w * h) / 16384).max(32);
    let relative = ((total_fg as f32 * min_frac).ceil() as usize).max(1);
    let min_area = absolute.max(relative);
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

/// Page removal by flood fill: BFS from every frame border pixel over
/// source colors near the seed, at matte size. Unlike a global color
/// cutoff it survives page gradients, vignette, and JPEG shading: the
/// fill spreads through near colors and stops at the subject edge.
/// Foreground is whatever the page fill never reaches.
pub fn flood_page_mask(
    rgba: &[u8],
    sw: usize,
    sh: usize,
    seed: [f32; 3],
    tol: f32,
    mw: usize,
    mh: usize,
) -> Vec<u8> {
    if mw == 0 || mh == 0 || sw == 0 || sh == 0 || rgba.len() < sw * sh * 4 {
        return vec![0u8; mw * mh];
    }
    let near = |x: usize, y: usize| {
        let sx = (x * sw / mw).min(sw - 1);
        let sy = (y * sh / mh).min(sh - 1);
        let p = (sy * sw + sx) * 4;
        ((rgba[p] as f32 - seed[0]).powi(2)
            + (rgba[p + 1] as f32 - seed[1]).powi(2)
            + (rgba[p + 2] as f32 - seed[2]).powi(2))
            .sqrt()
            <= tol
    };
    let mut reached = vec![false; mw * mh];
    let mut stack: Vec<usize> = Vec::new();
    for x in 0..mw {
        stack.push(x);
        stack.push((mh - 1) * mw + x);
    }
    for y in 0..mh {
        stack.push(y * mw);
        stack.push(y * mw + mw - 1);
    }
    while let Some(i) = stack.pop() {
        if reached[i] || !near(i % mw, i / mw) {
            continue;
        }
        reached[i] = true;
        let x = i % mw;
        let y = i / mw;
        if x > 0 {
            stack.push(i - 1);
        }
        if x + 1 < mw {
            stack.push(i + 1);
        }
        if y > 0 {
            stack.push(i - mw);
        }
        if y + 1 < mh {
            stack.push(i + mw);
        }
    }
    reached.iter().map(|&r| if r { 0 } else { 255 }).collect()
}

/// Mean color of the center patch: the subject usually lives there. Page
/// mode is rejected when the center looks like the page seed (white dress
/// on a white page), where flooding would eat the subject itself.
pub fn center_patch_mean(rgba: &[u8], w: usize, h: usize) -> [f32; 3] {
    if w == 0 || h == 0 || rgba.len() < w * h * 4 {
        return [0.0, 0.0, 0.0];
    }
    let (x0, x1) = (w * 45 / 100, w * 55 / 100);
    let (y0, y1) = (h * 45 / 100, h * 55 / 100);
    let mut sum = [0u64; 3];
    let mut n = 0u64;
    for y in y0..=y1.min(h - 1) {
        for x in x0..=x1.min(w - 1) {
            let p = (y * w + x) * 4;
            sum[0] += rgba[p] as u64;
            sum[1] += rgba[p + 1] as u64;
            sum[2] += rgba[p + 2] as u64;
            n += 1;
        }
    }
    let n = n.max(1) as f32;
    [sum[0] as f32 / n, sum[1] as f32 / n, sum[2] as f32 / n]
}

/// Quality score of a binary subject mask: centered and coherent wins,
/// frame-touching sprawl and fragmentation lose. Drives automatic cutoff
/// selection so one click lands on the subject instead of the brightest
/// blob. Coverage outside a sane band is penalized so empty noise and full
/// frame floods never win, which keeps results clean rather than messy.
pub fn mask_quality(bin: &[u8], w: usize, h: usize) -> f32 {
    if bin.len() != w * h || w < 8 || h < 8 {
        return f32::MIN;
    }
    let total = (w * h) as f32;
    let fg = bin.iter().filter(|&&v| v != 0).count();
    if fg == 0 || fg == w * h {
        return f32::MIN;
    }
    let coverage = fg as f32 / total;
    // Sane subject band: below 2% is specks, above 92% is background flood.
    if coverage < 0.02 || coverage > 0.92 {
        return f32::MIN + coverage * 10.0;
    }
    let (_, sizes, _) = label_components(bin, w, h);
    let largest = sizes.iter().max().copied().unwrap_or(0) as f32 / fg as f32;
    let fragments = sizes.len() as f32;
    // Fragmentation penalty grows slowly so hair detail is not punished,
    // but shattered noise with dozens of pieces loses decisively.
    let frag_penalty = (fragments / 6.0).min(2.0);
    let border = border_fg_ratio(bin, w, h);
    let (x0, x1) = (w * 40 / 100, w * 60 / 100);
    let (y0, y1) = (h * 40 / 100, h * 60 / 100);
    let mut cfg = 0usize;
    let mut cn = 0usize;
    for y in y0..=y1.min(h - 1) {
        for x in x0..=x1.min(w - 1) {
            cn += 1;
            if bin[y * w + x] != 0 {
                cfg += 1;
            }
        }
    }
    let center = if cn == 0 { 0.0 } else { cfg as f32 / cn as f32 };
    // Coverage sweet spot bonus: subjects around 5 to 70 percent score best.
    let coverage_bonus = if coverage >= 0.05 && coverage <= 0.70 {
        0.5
    } else {
        0.0
    };
    3.0 * center + 2.0 * largest - 3.0 * border - 0.6 * frag_penalty + coverage_bonus
}

/// Pick the cutoff whose mask scores best: Otsu plus scaled fallbacks in
/// both directions plus fixed anchors for dark and bright subjects.
/// A too-high Otsu that keeps only bright blobs (white shirt on dark suit)
/// loses to a lower cutoff that recovers the coherent centered subject;
/// a too-low Otsu that floods the background loses on border contact and
/// fragmentation. Returns the winning threshold.
#[allow(dead_code)]
pub fn pick_threshold(soft: &[u8], w: usize, h: usize) -> u8 {
    pick_threshold_with_bias(soft, w, h, 0)
}

/// Same as pick_threshold with a per model bias in matte levels. Negative
/// bias recovers faint hair on fine backbones, positive bias suppresses
/// noise on coarse backbones.
pub fn pick_threshold_with_bias(soft: &[u8], w: usize, h: usize, bias: i16) -> u8 {
    let t0 = otsu_threshold(soft) as i16;
    let raw = [
        t0 + 48,
        t0 + 24,
        t0 * 5 / 4,
        t0,
        t0 * 3 / 4,
        t0 / 2,
        t0 / 3,
        200,
        160,
        120,
        80,
        48,
    ];
    let mut best = (t0 + bias).clamp(1, 254) as u8;
    let mut best_score = f32::MIN;
    let mut seen = [false; 256];
    for t in raw {
        let t = (t + bias).clamp(10, 245) as u8;
        if seen[t as usize] {
            continue;
        }
        seen[t as usize] = true;
        let bin: Vec<u8> = soft.iter().map(|&v| if v >= t { 255 } else { 0 }).collect();
        let bridged = close_small_gaps(&bin, w, h);
        let s = mask_quality(&bridged, w, h);
        if s > best_score {
            best_score = s;
            best = t;
        }
    }
    best
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
/// near-identical colors go, the dominant subject never drops, and slivers
/// with tiny border contact survive so cropped portraits stay intact.
/// Returns (mask, dropped).
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
    let total_fg: usize = sizes.iter().sum();
    let largest = sizes.iter().max().copied().unwrap_or(0);
    // Border contact length per component: a subject cropped by the frame
    // touches along a short run, a backdrop slab hugs a long run.
    let mut border_px = vec![0usize; sizes.len()];
    for y in 0..mh {
        for x in 0..mw {
            if x != 0 && y != 0 && x != mw - 1 && y != mh - 1 {
                continue;
            }
            let i = y * mw + x;
            if bin[i] != 0 && ids[i] != u32::MAX {
                border_px[ids[i] as usize] += 1;
            }
        }
    }
    let bg = corner_bg_color(rgba, sw, sh);
    let means = component_colors(bin, mw, mh, rgba, sw, sh, &ids, sizes.len());
    let drop: Vec<bool> = touches
        .iter()
        .enumerate()
        .map(|(c, &t)| {
            if !t {
                return false;
            }
            // Never drop the dominant mass: it is the subject by definition.
            if sizes[c] == largest && sizes[c] * 2 > total_fg {
                return false;
            }
            // Tiny border kiss (under 4 percent of component perimeter)
            // means a cropped subject, not a backdrop slab.
            let perim = (sizes[c] as f32).sqrt() * 4.0 + 4.0;
            let contact = border_px[c] as f32 / perim.max(1.0);
            if contact < 0.04 && sizes[c] > total_fg / 8 {
                return false;
            }
            let m = means[c];
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
/// remains unreached is a hole. Kept for compatibility, the live pipeline
/// uses the size limited variant below so large see through gaps stay clean.
#[allow(dead_code)]
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

/// Fill only small enclosed holes (sensor dust, lace gaps, small windows).
/// Large see through areas between limbs or under arms stay transparent,
/// which is what keeps cutouts neat instead of messy. max_frac caps hole
/// area as a fraction of foreground area.
pub fn fill_small_enclosed_holes(bin: &[u8], w: usize, h: usize, max_frac: f32) -> Vec<u8> {
    if bin.len() != w * h || w == 0 || h == 0 {
        return vec![0u8; w * h];
    }
    let fg = bin.iter().filter(|&&v| v != 0).count();
    if fg == 0 {
        return bin.to_vec();
    }
    let max_hole = ((fg as f32 * max_frac).ceil() as usize).max(24);
    // Label background components on the inverted mask.
    let inv: Vec<u8> = bin.iter().map(|&v| if v == 0 { 255 } else { 0 }).collect();
    let (ids, sizes, _) = label_components(&inv, w, h);
    if sizes.is_empty() {
        return bin.to_vec();
    }
    // Background touching the frame is outside air, never a hole.
    let n = w * h;
    let mut touches = vec![false; sizes.len()];
    for y in 0..h {
        for x in 0..w {
            if x != 0 && y != 0 && x != w - 1 && y != h - 1 {
                continue;
            }
            let i = y * w + x;
            if inv[i] != 0 && ids[i] != u32::MAX {
                touches[ids[i] as usize] = true;
            }
        }
    }
    let fill: Vec<bool> = sizes
        .iter()
        .zip(touches.iter())
        .map(|(&s, &t)| !t && s <= max_hole)
        .collect();
    if !fill.iter().any(|&f| f) {
        return bin.to_vec();
    }
    // Silence unused warning for n in release builds with tiny mattes.
    let _ = n;
    bin.iter()
        .enumerate()
        .map(|(i, &v)| {
            if v == 0 && inv[i] != 0 && ids[i] != u32::MAX && fill[ids[i] as usize] {
                255
            } else {
                v
            }
        })
        .collect()
}

/// Gate a soft matte by a binary subject mask: soft gradients survive
/// inside the subject for natural hair falloff, everything outside is
/// hard zero so the background stays perfectly clean.
pub fn gate_soft_by_binary(soft: &[u8], bin: &[u8]) -> Vec<u8> {
    if soft.len() != bin.len() {
        return soft.to_vec();
    }
    soft.iter()
        .zip(bin.iter())
        .map(|(&s, &b)| if b == 0 { 0 } else { s })
        .collect()
}

/// Polish a soft alpha matte: crush near zero noise to transparent and
/// snap near opaque cores to solid, while preserving the mid transition
/// band that carries soft hair and edge falloff. This removes haze and
/// isolated dots without hardening real edges.
pub fn polish_alpha_matte(matte: &[u8], lo: u8, hi: u8) -> Vec<u8> {
    if matte.is_empty() || lo >= hi {
        return matte.to_vec();
    }
    let lo_f = lo as f32;
    let hi_f = hi as f32;
    let span = (hi_f - lo_f).max(1.0);
    matte
        .iter()
        .map(|&v| {
            let f = v as f32;
            if f <= lo_f {
                0
            } else if f >= hi_f {
                255
            } else {
                // Smoothstep remap inside the transition band.
                let t = (f - lo_f) / span;
                let s = t * t * (3.0 - 2.0 * t);
                (s * 255.0 + 0.5).clamp(0.0, 255.0) as u8
            }
        })
        .collect()
}

/// Threads sized to the machine (2..8): large backbones at 1024px are
/// thread hungry, 4 fixed threads underfeeds modern CPUs.
fn rmbg_threads() -> usize {
    std::thread::available_parallelism()
        .map(|n| (n.get() / 2).clamp(2, 8))
        .unwrap_or(4)
}
/// Luma guide at matte size for edge aware smoothing (bilinear).
/// Parallel over rows with rayon for maximum throughput.
pub fn luma_at_size(rgba: &[u8], w: u32, h: u32, tw: usize, th: usize) -> Vec<u8> {
    const LUMA: [f32; 3] = [0.299, 0.587, 0.114];
    let wu = w.max(1) as usize;
    let hu = h.max(1) as usize;
    if rgba.len() < wu * hu * 4 || tw == 0 || th == 0 {
        return vec![0u8; tw.max(1) * th.max(1)];
    }
    let mut out = vec![0u8; tw * th];
    out.par_chunks_mut(tw)
        .enumerate()
        .for_each(|(y, row)| {
            let gy = (y as f32 + 0.5) * hu as f32 / th as f32 - 0.5;
            let y0 = (gy.floor() as isize).clamp(0, hu as isize - 1) as usize;
            let y1 = (y0 + 1).min(hu - 1);
            let fy = (gy - y0 as f32).clamp(0.0, 1.0);
            for (x, v) in row.iter_mut().enumerate() {
                let gx = (x as f32 + 0.5) * wu as f32 / tw as f32 - 0.5;
                let x0 = (gx.floor() as isize).clamp(0, wu as isize - 1) as usize;
                let x1 = (x0 + 1).min(wu - 1);
                let fx = (gx - x0 as f32).clamp(0.0, 1.0);
                let i00 = (y0 * wu + x0) * 4;
                let i10 = (y0 * wu + x1) * 4;
                let i01 = (y1 * wu + x0) * 4;
                let i11 = (y1 * wu + x1) * 4;
                let p00 = rgba[i00] as f32 * LUMA[0]
                    + rgba[i00 + 1] as f32 * LUMA[1]
                    + rgba[i00 + 2] as f32 * LUMA[2];
                let p10 = rgba[i10] as f32 * LUMA[0]
                    + rgba[i10 + 1] as f32 * LUMA[1]
                    + rgba[i10 + 2] as f32 * LUMA[2];
                let p01 = rgba[i01] as f32 * LUMA[0]
                    + rgba[i01 + 1] as f32 * LUMA[1]
                    + rgba[i01 + 2] as f32 * LUMA[2];
                let p11 = rgba[i11] as f32 * LUMA[0]
                    + rgba[i11 + 1] as f32 * LUMA[1]
                    + rgba[i11 + 2] as f32 * LUMA[2];
                let mix = p00 * (1.0 - fx) * (1.0 - fy)
                    + p10 * fx * (1.0 - fy)
                    + p01 * (1.0 - fx) * fy
                    + p11 * fx * fy;
                *v = mix.round().clamp(0.0, 255.0) as u8;
            }
        });
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
    /// Registry id of the model that produced this matte.
    #[serde(default)]
    pub model_id: String,
    /// Display label of the model that produced this matte.
    #[serde(default)]
    pub model_label: String,
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
    model_id: Option<String>,
) -> Result<RmbgResult, String> {
    let t0 = std::time::Instant::now();
    let w = width.max(8).min(4096);
    let h = height.max(8).min(4096);
    if rgba.len() != (w as usize) * (h as usize) * 4 {
        return Err(format!("RGBA size mismatch: got {} bytes for {w}x{h}", rgba.len()));
    }
    let path = resolve_rmbg_file(model_path.as_deref(), model_id.as_deref())
        .unwrap_or_else(default_rmbg_path);
    let (used_id, used_label) = RMBG_MODELS
        .iter()
        .find(|m| {
            path.ends_with(m.file)
                || model_id.as_deref().unwrap_or("") == m.id
        })
        .map(|m| (m.id.to_string(), m.label.to_string()))
        .unwrap_or(("avero-1".to_string(), "Avero Remove BG I".to_string()));
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
    let profile = profile_for_model(&used_id);
    let soft = normalize_mask(&plane);
    // Precision matte pipeline, tuned per model:
    // 1. Best cutoff from scored candidates with model bias.
    // 2. Flat page rescue for logos on uniform pages.
    // 3. Gap bridging so hairlines stay one piece.
    // 4. Orientation fix, smart border trim, speck cleanup.
    // 5. Small hole fill only, so see through gaps stay transparent.
    // 6. Soft gated guided refine: hair translucency survives inside the
    //    subject while the outside stays hard zero and perfectly clean.
    // 7. Alpha polish plus an optional full resolution edge snap.
    // Frontend can still re-threshold live with the suggested value.
    let suggested = pick_threshold_with_bias(&soft, mw, mh, profile.threshold_bias);
    let bin: Vec<u8> = soft.iter().map(|&v| if v >= suggested { 255 } else { 0 }).collect();
    // Flat-page rescue: the neural matte owns the whole frame on uniform
    // pages (logo on white) instead of the subject. Page removal by flood
    // fill takes over there; good photo mattes never trip the gate and
    // flow through untouched. The rescue is self-validating: it must keep
    // a sane subject fraction and the center must differ from the page,
    // otherwise the neural matte stands.
    let mut flat_bg = false;
    let bin = if border_fg_ratio(&bin, mw, mh) > 0.5 {
        let sw = w as usize;
        let sh = h as usize;
        let seed = page_color_if_uniform(&rgba, sw, sh).unwrap_or_else(|| corner_bg_color(&rgba, sw, sh));
        let center = center_patch_mean(&rgba, sw, sh);
        let center_d = ((center[0] - seed[0]).powi(2)
            + (center[1] - seed[1]).powi(2)
            + (center[2] - seed[2]).powi(2))
        .sqrt();
        let page_mask = flood_page_mask(&rgba, sw, sh, seed, 40.0, mw, mh);
        let fg = page_mask.iter().filter(|&&v| v != 0).count();
        let frac = fg as f32 / (mw * mh).max(1) as f32;
        if frac > 0.02 && frac < 0.85 && center_d > 60.0 {
            flat_bg = true;
            page_mask
        } else {
            bin
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
    // Smart trim first with per model tolerance: edge-touching pieces
    // painted in backdrop color go, real subjects stay even at the frame.
    if smart_trim.unwrap_or(true) {
        let (m, d) = drop_bg_colored_border(&matte, mw, mh, &rgba, w as usize, h as usize, profile.trim_tol);
        matte = m;
        dropped += d;
    }
    if trim_borders.unwrap_or(false) {
        let (m, d) = drop_border_components(&matte, mw, mh);
        matte = m;
        dropped += d;
    }
    let (clean, removed) = if cleanup.unwrap_or(true) {
        clean_small_components(&matte, mw, mh, profile.cleanup_frac)
    } else {
        (matte, 0)
    };
    dropped += removed;
    let (subject, kdrop) = keep_largest_components(&clean, mw, mh, keep_largest.unwrap_or(0));
    dropped += kdrop;
    let holed = fill_small_enclosed_holes(&subject, mw, mh, profile.hole_max_frac);
    let fg_after = holed.iter().filter(|&&v| v != 0).count();
    let kept_pct = 100.0 * fg_after as f32 / (mw * mh).max(1) as f32;
    // Orient the soft matte the same way as the binary mask. Without this,
    // flipped cases (page rescue, backwards mattes) would gate low subject
    // values against the subject region and produce faint messy cutouts.
    let oriented_soft: Vec<u8> = if inverted {
        soft.iter().map(|&v| 255 - v).collect()
    } else {
        soft.clone()
    };
    let refined = if smooth.unwrap_or(true) {
        let guide = luma_at_size(&rgba, w, h, mw, mh);
        let gated = gate_soft_by_binary(&oriented_soft, &holed);
        let guided = guided_refine(&gated, &guide, mw, mh, profile.guide_radius, profile.guide_eps);
        polish_alpha_matte(&guided, profile.polish_lo, profile.polish_hi)
    } else {
        gate_soft_by_binary(&oriented_soft, &holed)
    };
    let upscaled = upscale_gray(&refined, mw, mh, w as usize, h as usize);
    // Full resolution edge snap for crisp precise contours on typical
    // photo sizes. Large posters skip this pass to protect performance.
    let mask = if smooth.unwrap_or(true) && (w as usize) * (h as usize) <= 4_000_000 {
        let guide_full = luma_at_size(&rgba, w, h, w as usize, h as usize);
        let snapped = guided_refine(&upscaled, &guide_full, w as usize, h as usize, 2, 0.01);
        polish_alpha_matte(&snapped, profile.polish_lo, profile.polish_hi)
    } else {
        polish_alpha_matte(&upscaled, profile.polish_lo, profile.polish_hi)
    };
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
        model_id: used_id,
        model_label: used_label,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_path_points_at_exe_models() {
        let p = default_rmbg_path();
        assert!(p.ends_with("model-rmbg-1.4.onnx"));
        assert!(p.contains("model"));
        assert_eq!(RMBG_INPUT, 1024);
        assert_eq!(RMBG_MODELS.len(), 3);
        assert_eq!(RMBG_MODELS[0].id, "avero-1");
        assert_eq!(RMBG_MODELS[1].id, "avero-2");
        assert_eq!(RMBG_MODELS[2].id, "avero-3");
        assert_eq!(RMBG_MODELS[0].file, "model-rmbg-1.4.onnx");
        assert_eq!(RMBG_MODELS[1].file, "RMBG2-0.onnx");
        assert_eq!(RMBG_MODELS[2].file, "BiReFNet.onnx");
        let all = RMBG_MODELS.iter().map(status_for_def).collect::<Vec<_>>();
        assert_eq!(all.len(), 3);
        assert_eq!(all[0].label, "Avero Remove BG I");
        // Resolver prefers registry ids and falls back in order.
        let r = resolve_rmbg_file(None, Some("avero-2"));
        assert!(r.unwrap().ends_with("RMBG2-0.onnx"));
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
        let m = flood_page_mask(&rgba, s, s, page, 40.0, s, s);
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

    #[test]
    fn flood_page_survives_gradient_and_validates() {        // Page with a horizontal shade gradient plus a dark rect: flood
        // from the borders absorbs the whole gradient, keeps the rect.
        let s = 48usize;
        let mut rgba = vec![0u8; s * s * 4];
        for y in 0..s {
            for x in 0..s {
                let v = 250u8.saturating_sub((x as u8) / 3);
                let p = (y * s + x) * 4;
                rgba[p] = v;
                rgba[p + 1] = v;
                rgba[p + 2] = v;
                rgba[p + 3] = 255;
            }
        }
        for y in 18..32 {
            for x in 18..32 {
                let p = (y * s + x) * 4;
                rgba[p] = 20;
                rgba[p + 1] = 30;
                rgba[p + 2] = 60;
            }
        }
        let seed = corner_bg_color(&rgba, s, s);
        let m = flood_page_mask(&rgba, s, s, seed, 40.0, s, s);
        assert_eq!(m.iter().filter(|&&v| v != 0).count(), 196);
        // Center check distinguishes subject from page-colored subject.
        let center = center_patch_mean(&rgba, s, s);
        let d = ((center[0] - seed[0]).powi(2)
            + (center[1] - seed[1]).powi(2)
            + (center[2] - seed[2]).powi(2))
        .sqrt();
        assert!(d > 60.0);
        // All-white frame: nothing to keep, center matches the seed.
        let white = vec![255u8; s * s * 4];
        let seed = corner_bg_color(&white, s, s);
        let m = flood_page_mask(&white, s, s, seed, 40.0, s, s);
        assert_eq!(m.iter().filter(|&&v| v != 0).count(), 0);
        let center = center_patch_mean(&white, s, s);
        let d = ((center[0] - seed[0]).powi(2)
            + (center[1] - seed[1]).powi(2)
            + (center[2] - seed[2]).powi(2))
        .sqrt();
        assert!(d < 60.0);
    }

    #[test]
    fn cutoff_pick_recovers_mid_tone_subject() {
        // Portrait-like trimodal matte: dark bg (30), mid suit (120)
        // centered, bright blob (230) sprawling to the borders. A naive
        // high cutoff keeps only the blob; the picker must go lower and
        // recover the centered suit without flooding the background.
        let (w, h) = (60usize, 60usize);
        let mut soft = vec![30u8; w * h];
        for y in 15..45 {
            for x in 20..40 {
                soft[y * w + x] = 120;
            }
        }
        for y in 30..60 {
            for x in 0..60 {
                soft[y * w + x] = 230;
            }
        }
        // Centered coherent mask outscores border sprawl.
        let mut good = vec![0u8; w * h];
        for y in 15..45 {
            for x in 20..40 {
                good[y * w + x] = 255;
            }
        }
        let mut bad = vec![0u8; w * h];
        for y in 30..60 {
            for x in 0..60 {
                bad[y * w + x] = 255;
            }
        }
        assert!(mask_quality(&good, w, h) > mask_quality(&bad, w, h));
        // Empty and full masks score worst.
        assert_eq!(mask_quality(&vec![0u8; w * h], w, h), f32::MIN);
        assert_eq!(mask_quality(&vec![255u8; w * h], w, h), f32::MIN);
        // The picker recovers the suit: mid-tone pixels kept, bg dropped.
        let t = pick_threshold(&soft, w, h);
        assert!(t <= 120, "picked={t}");
        let bin: Vec<u8> = soft.iter().map(|&v| if v >= t { 255 } else { 0 }).collect();
        assert_eq!(bin[20 * w + 25], 255);
        assert_eq!(bin[5 * w + 5], 0);
    }

    #[test]
    fn profiles_tune_each_model_for_precision() {
        let p1 = profile_for_model("avero-1");
        let p2 = profile_for_model("avero-2");
        let p3 = profile_for_model("avero-3");
        // Coarse backbone cleans harder and smooths wider, fine backbones
        // keep a light touch for hair detail.
        assert!(p1.cleanup_frac > p2.cleanup_frac);
        assert!(p2.cleanup_frac > p3.cleanup_frac);
        assert!(p1.guide_radius >= p2.guide_radius);
        assert!(p2.guide_radius >= p3.guide_radius);
        assert!(p1.trim_tol > p3.trim_tol);
        assert_eq!(p1.threshold_bias, 0);
        assert!(p3.threshold_bias < 0);
        // Unknown ids fall back to the balanced profile.
        assert_eq!(profile_for_model("other").cleanup_frac, p1.cleanup_frac);
    }

    #[test]
    fn small_holes_fill_large_gaps_stay_clean() {
        // 40x40 solid block with a 4x4 pinhole and a 16x16 courtyard:
        // the pinhole fills, the courtyard stays transparent and clean.
        let (w, h) = (40usize, 40usize);
        let mut bin = vec![255u8; w * h];
        for y in 8..12 {
            for x in 8..12 {
                bin[y * w + x] = 0;
            }
        }
        for y in 20..36 {
            for x in 20..36 {
                bin[y * w + x] = 0;
            }
        }
        let out = fill_small_enclosed_holes(&bin, w, h, 0.02);
        // Pinhole (16px) filled.
        assert_eq!(out[9 * w + 9], 255);
        // Courtyard (256px, far above 2 percent of fg) stays open.
        assert_eq!(out[28 * w + 28], 0);
        // Outer background untouched.
        assert_eq!(out[0], 255);
    }

    #[test]
    fn alpha_polish_keeps_band_crushes_noise() {
        let m = vec![0u8, 5, 11, 64, 128, 200, 241, 243, 255];
        let p = polish_alpha_matte(&m, 12, 240);
        assert_eq!(p[0], 0);
        assert_eq!(p[1], 0);
        assert_eq!(p[2], 0);
        assert_eq!(p[8], 255);
        assert_eq!(p[7], 255);
        assert_eq!(p[6], 255);
        // Mid band survives for soft edges.
        assert!(p[3] > 0 && p[3] < 255);
        assert!(p[4] > 0 && p[4] < 255);
        // Monotonic through the band.
        assert!(p[3] < p[4]);
        assert!(p[4] < p[5]);
    }

    #[test]
    fn soft_gate_keeps_inside_zero_outside() {
        let soft = vec![10u8, 120, 200, 30];
        let bin = vec![0u8, 255, 255, 0];
        assert_eq!(gate_soft_by_binary(&soft, &bin), vec![0, 120, 200, 0]);
    }

    #[test]
    fn robust_normalize_rejects_flat_noise() {
        // Large flat uncertain plane: no stretched speck noise allowed.
        let flat = vec![0.5f32; 2048];
        assert_eq!(normalize_mask(&flat), vec![0u8; 2048]);
        // Large confident bimodal plane: full range preserved.
        let mut two = vec![0.1f32; 1024];
        two.extend(vec![0.9f32; 1024]);
        let m = normalize_mask(&two);
        assert_eq!(m[0], 0);
        assert_eq!(m[2047], 255);
    }

    #[test]
    fn quality_rejects_flood_and_fragments() {
        let (w, h) = (40usize, 40usize);
        // 95 percent flood: rejected even though it is one piece.
        let flood = vec![255u8; w * h];
        assert_eq!(mask_quality(&flood, w, h), f32::MIN);
        // Coherent centered block outscores shattered specks at same area.
        let mut solid = vec![0u8; w * h];
        for y in 12..28 {
            for x in 12..28 {
                solid[y * w + x] = 255;
            }
        }
        let mut specks = vec![0u8; w * h];
        let mut n = 0;
        for y in (0..h).step_by(2) {
            for x in (0..w).step_by(2) {
                if n < 256 {
                    specks[y * w + x] = 255;
                    n += 1;
                }
            }
        }
        assert!(mask_quality(&solid, w, h) > mask_quality(&specks, w, h));
    }
}
