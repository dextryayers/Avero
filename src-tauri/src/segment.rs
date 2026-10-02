// Plan5 Fase 0/1: YOLO11-seg inference (things) via ONNX Runtime.
// Pure helpers (letterbox math, NMS, mask assembly, labels, resize) are unit
// tested without a model; the ort session path needs yolo11n-seg.onnx on disk.
// Decode layout is YOLO-seg specific (4 box + 80 class + 32 mask channels);
// the Tauri command shape stays backbone-agnostic (detections + PNG masks).

use serde::{Deserialize, Serialize};
use std::sync::{Mutex, OnceLock};

pub const SEG_INPUT: u32 = 640;
pub const SEG_MASK_CHANNELS: usize = 32;
pub const SEG_NUM_CLASSES: usize = 80;
pub const SEG_CONF_DEFAULT: f32 = 0.35;
pub const SEG_NMS_IOU: f32 = 0.6;
pub const SEG_MAX_DET: usize = 64;
pub const SEG_MASK_PNG_SIDE: usize = 320;

pub const COCO_LABELS: [&str; 80] = [
    "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck",
    "boat", "traffic light", "fire hydrant", "stop sign", "parking meter", "bench",
    "bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra",
    "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
    "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove",
    "skateboard", "surfboard", "tennis racket", "bottle", "wine glass", "cup",
    "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
    "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch",
    "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse",
    "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink",
    "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier",
    "toothbrush",
];

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SegmentDetection {
    pub label: String,
    pub class_id: usize,
    pub score: f32,
    /// Box in input-image pixels.
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
    /// Bbox-sized grayscale PNG (white = object), base64.
    pub mask_png_base64: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SegmentResult {
    pub detections: Vec<SegmentDetection>,
    pub input_width: u32,
    pub input_height: u32,
    pub millis: u128,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SegmentModelStatus {
    pub found: bool,
    pub path: String,
}

/// Candidate dir for downloaded models: <exe-dir>/models.
pub fn default_model_path() -> String {
    let base = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    base.join("models")
        .join("yolo11n-seg.onnx")
        .to_string_lossy()
        .into_owned()
}

#[tauri::command]
pub fn cmd_segment_model_path() -> SegmentModelStatus {
    let path = default_model_path();
    let found = std::path::Path::new(&path).is_file();
    SegmentModelStatus { found, path }
}

// ---------------------------------------------------------------------------
// Pure math (unit-tested, no ort, no model).
// ---------------------------------------------------------------------------

#[derive(Clone, Copy, Debug)]
pub struct Letterbox {
    pub scale: f32,
    pub pad_x: f32,
    pub pad_y: f32,
}

pub fn letterbox_params(w: u32, h: u32, size: u32) -> Letterbox {
    let scale = size as f32 / w.max(h).max(1) as f32;
    let nw = w as f32 * scale;
    let nh = h as f32 * scale;
    Letterbox {
        scale,
        pad_x: (size as f32 - nw) / 2.0,
        pad_y: (size as f32 - nh) / 2.0,
    }
}

/// RGBA -> NCHW float tensor (letterboxed, /255, gray 114 pads like Ultralytics).
pub fn letterbox_rgb(rgba: &[u8], w: u32, h: u32, size: u32) -> Result<(Vec<f32>, Letterbox), String> {
    if rgba.len() != (w as usize) * (h as usize) * 4 {
        return Err(format!(
            "RGBA size mismatch: got {} bytes for {w}x{h}",
            rgba.len()
        ));
    }
    let lb = letterbox_params(w, h, size);
    let s = size as usize;
    let mut out = vec![0f32; 3 * s * s];
    for y in 0..s {
        for x in 0..s {
            let sx = ((x as f32 - lb.pad_x) / lb.scale).floor() as i64;
            let sy = ((y as f32 - lb.pad_y) / lb.scale).floor() as i64;
            let (r, g, b) = if sx >= 0 && sy >= 0 && (sx as u32) < w && (sy as u32) < h {
                let i = ((sy as usize) * (w as usize) + (sx as usize)) * 4;
                (rgba[i] as f32 / 255.0, rgba[i + 1] as f32 / 255.0, rgba[i + 2] as f32 / 255.0)
            } else {
                (114.0 / 255.0, 114.0 / 255.0, 114.0 / 255.0)
            };
            out[y * s + x] = r;
            out[s * s + y * s + x] = g;
            out[2 * s * s + y * s + x] = b;
        }
    }
    Ok((out, lb))
}

/// Map a letterboxed point back to input-image pixels.
pub fn unletterbox(lx: f32, ly: f32, lb: Letterbox, w: u32, h: u32) -> (f32, f32) {
    let x = ((lx - lb.pad_x) / lb.scale).clamp(0.0, w as f32);
    let y = ((ly - lb.pad_y) / lb.scale).clamp(0.0, h as f32);
    (x, y)
}

#[derive(Clone, Debug)]
pub struct RawDet {
    pub x1: f32,
    pub y1: f32,
    pub x2: f32,
    pub y2: f32,
    pub score: f32,
    pub class_id: usize,
    pub coeffs: [f32; SEG_MASK_CHANNELS],
}

/// Decode YOLO-seg output0, flat row-major [C][anchors], C = 4 + classes + 32.
pub fn decode_yolo_seg(output0: &[f32], anchors: usize, num_classes: usize, conf: f32) -> Vec<RawDet> {
    let mut out = Vec::new();
    if output0.len() < (4 + num_classes + SEG_MASK_CHANNELS) * anchors {
        return out;
    }
    for a in 0..anchors {
        let mut best = 0f32;
        let mut cls = 0usize;
        for c in 0..num_classes {
            let s = output0[(4 + c) * anchors + a];
            if s > best {
                best = s;
                cls = c;
            }
        }
        if best < conf {
            continue;
        }
        let cx = output0[a];
        let cy = output0[anchors + a];
        let w = output0[2 * anchors + a];
        let h = output0[3 * anchors + a];
        if w <= 0.0 || h <= 0.0 {
            continue;
        }
        let mut coeffs = [0f32; SEG_MASK_CHANNELS];
        for k in 0..SEG_MASK_CHANNELS {
            coeffs[k] = output0[(4 + num_classes + k) * anchors + a];
        }
        out.push(RawDet {
            x1: cx - w / 2.0,
            y1: cy - h / 2.0,
            x2: cx + w / 2.0,
            y2: cy + h / 2.0,
            score: best,
            class_id: cls,
            coeffs,
        });
    }
    out
}

pub fn iou(a: &RawDet, b: &RawDet) -> f32 {
    let ix1 = a.x1.max(b.x1);
    let iy1 = a.y1.max(b.y1);
    let ix2 = a.x2.min(b.x2);
    let iy2 = a.y2.min(b.y2);
    let iw = (ix2 - ix1).max(0.0);
    let ih = (iy2 - iy1).max(0.0);
    let inter = iw * ih;
    let ua = (a.x2 - a.x1).max(0.0) * (a.y2 - a.y1).max(0.0)
        + (b.x2 - b.x1).max(0.0) * (b.y2 - b.y1).max(0.0)
        - inter;
    if ua <= 0.0 {
        0.0
    } else {
        inter / ua
    }
}

pub fn nms_classwise(mut dets: Vec<RawDet>, iou_thr: f32, max_det: usize) -> Vec<RawDet> {
    dets.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    let mut kept: Vec<RawDet> = Vec::new();
    for d in dets {
        if kept.len() >= max_det {
            break;
        }
        let mut clash = false;
        for k in &kept {
            if k.class_id == d.class_id && iou(k, &d) > iou_thr {
                clash = true;
                break;
            }
        }
        if !clash {
            kept.push(d);
        }
    }
    kept
}

fn sigmoid(x: f32) -> f32 {
    1.0 / (1.0 + (-x).exp())
}

/// Assemble a grayscale mask from 32 coefficients + protos [pw*ph],
/// cropped to the proto-space box. Returns (pixels, w, h).
pub fn assemble_mask(
    coeffs: &[f32; SEG_MASK_CHANNELS],
    protos: &[f32],
    pw: usize,
    ph: usize,
    bx0: f32,
    by0: f32,
    bx1: f32,
    by1: f32,
) -> (Vec<u8>, usize, usize) {
    if pw == 0 || ph == 0 || protos.len() < pw * ph * SEG_MASK_CHANNELS {
        return (Vec::new(), 0, 0);
    }
    let x0 = (bx0.floor() as isize).clamp(0, pw as isize - 1) as usize;
    let y0 = (by0.floor() as isize).clamp(0, ph as isize - 1) as usize;
    let x1 = (bx1.ceil() as isize).clamp(1, pw as isize) as usize;
    let y1 = (by1.ceil() as isize).clamp(1, ph as isize) as usize;
    let cw = x1.saturating_sub(x0).max(1);
    let ch = y1.saturating_sub(y0).max(1);
    let mut out = vec![0u8; cw * ch];
    for y in 0..ch {
        for x in 0..cw {
            let gx = x0 + x;
            let gy = y0 + y;
            let mut acc = 0f32;
            for k in 0..SEG_MASK_CHANNELS {
                acc += coeffs[k] * protos[k * pw * ph + gy * pw + gx];
            }
            out[y * cw + x] = (sigmoid(acc) * 255.0).round().clamp(0.0, 255.0) as u8;
        }
    }
    (out, cw, ch)
}

/// Bilinear grayscale upscale (keeps soft edges for feathered cutouts).
pub fn upscale_gray(src: &[u8], sw: usize, sh: usize, dw: usize, dh: usize) -> Vec<u8> {
    if sw == 0 || sh == 0 || dw == 0 || dh == 0 || src.len() < sw * sh {
        return vec![];
    }
    let mut out = vec![0u8; dw * dh];
    for y in 0..dh {
        let gy = (y as f32 + 0.5) * sh as f32 / dh as f32 - 0.5;
        let y0 = (gy.floor() as isize).clamp(0, sh as isize - 1) as usize;
        let y1 = (y0 + 1).min(sh - 1);
        let fy = (gy - y0 as f32).clamp(0.0, 1.0);
        for x in 0..dw {
            let gx = (x as f32 + 0.5) * sw as f32 / dw as f32 - 0.5;
            let x0 = (gx.floor() as isize).clamp(0, sw as isize - 1) as usize;
            let x1 = (x0 + 1).min(sw - 1);
            let fx = (gx - x0 as f32).clamp(0.0, 1.0);
            let a = src[y0 * sw + x0] as f32;
            let b = src[y0 * sw + x1] as f32;
            let c = src[y1 * sw + x0] as f32;
            let d = src[y1 * sw + x1] as f32;
            let v = a * (1.0 - fx) * (1.0 - fy) + b * fx * (1.0 - fy) + c * (1.0 - fx) * fy + d * fx * fy;
            out[y * dw + x] = v.round().clamp(0.0, 255.0) as u8;
        }
    }
    out
}

/// Grayscale -> white RGBA PNG base64 (alpha carries the mask).
pub fn gray_to_png_base64(gray: &[u8], w: usize, h: usize) -> Result<String, String> {
    use image::{codecs::png::PngEncoder, ColorType, ImageEncoder};
    if gray.len() < w * h || w == 0 || h == 0 {
        return Err("empty mask".into());
    }
    let mut rgba = Vec::with_capacity(w * h * 4);
    for &g in gray.iter().take(w * h) {
        rgba.extend_from_slice(&[255, 255, 255, g]);
    }
    let mut buf = Vec::new();
    PngEncoder::new(&mut buf)
        .write_image(&rgba, w as u32, h as u32, ColorType::Rgba8.into())
        .map_err(|e| format!("png encode: {e}"))?;
    Ok(base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        &buf,
    ))
}

// ---------------------------------------------------------------------------
// ort session (cached per model path) + Tauri command.
// ---------------------------------------------------------------------------

/// Sessions cached per model path (YOLO + semantic + text live together).
static SESSION_CACHE: OnceLock<Mutex<std::collections::HashMap<String, ort::session::Session>>> =
    OnceLock::new();

fn session_lock(
) -> Result<std::sync::MutexGuard<'static, std::collections::HashMap<String, ort::session::Session>>, String> {
    SESSION_CACHE
        .get_or_init(|| Mutex::new(std::collections::HashMap::new()))
        .lock()
        .map_err(|e| format!("segment session lock poisoned: {e}"))
}

fn ensure_session(model_path: &str) -> Result<(), String> {
    let mut guard = session_lock()?;
    if guard.contains_key(model_path) {
        return Ok(());
    }
    if !std::path::Path::new(model_path).is_file() {
        return Err(format!(
            "Segment model not found at {model_path}. Place the .onnx in <exe-dir>/models/ (one-time download)."
        ));
    }
    let session = ort::session::Session::builder()
        .map_err(|e| format!("ort builder: {e}"))?
        .with_optimization_level(ort::session::builder::GraphOptimizationLevel::Level3)
        .map_err(|e| format!("ort opt level: {e}"))?
        .with_intra_threads(4)
        .map_err(|e| format!("ort threads: {e}"))?
        .commit_from_file(model_path)
        .map_err(|e| format!("load model {model_path}: {e}"))?;
    guard.insert(model_path.to_string(), session);
    Ok(())
}

/// Borrow a loaded session for one inference. The returned guard keeps the
/// session alive; extracted tensors must be copied before it drops.
fn use_session<R>(model_path: &str, f: impl FnOnce(&mut ort::session::Session) -> Result<R, String>) -> Result<R, String> {
    ensure_session(model_path)?;
    let mut guard = session_lock()?;
    let session = guard
        .get_mut(model_path)
        .ok_or("segment session missing after load")?;
    f(session)
}

#[tauri::command]
pub fn cmd_segment_objects(
    model_path: String,
    rgba: Vec<u8>,
    width: u32,
    height: u32,
    conf: Option<f32>,
) -> Result<SegmentResult, String> {
    let t0 = std::time::Instant::now();
    let w = width.max(8).min(4096);
    let h = height.max(8).min(4096);
    if rgba.len() != (w as usize) * (h as usize) * 4 {
        return Err(format!(
            "RGBA size mismatch: got {} bytes for {w}x{h}",
            rgba.len()
        ));
    }
    let conf_thr = conf.unwrap_or(SEG_CONF_DEFAULT).clamp(0.05, 0.95);

    let (input, lb) = letterbox_rgb(&rgba, w, h, SEG_INPUT)?;
    let s = SEG_INPUT as usize;
    let arr = ([1usize, 3, s, s], input);

    // Borrowed ort outputs cannot outlive the session lock, so extract owned
    // copies inside use_session; the lock ends with it.
    let (det_data, det_dims, proto_data, proto_dims): (Vec<f32>, Vec<usize>, Vec<f32>, Vec<usize>) =
        use_session(&model_path, |session| {
            let input_tensor = ort::value::Tensor::from_array(arr)
                .map_err(|e| format!("ort input tensor: {e}"))?;
            let outputs = session
                .run(ort::inputs!["images" => input_tensor])
                .map_err(|e| format!("segment inference: {e}"))?;

            // Detections = rank-3 output [1, C, anchors]; protos = rank-4 [1, 32, PH, PW].
            let mut det_data: Vec<f32> = Vec::new();
            let mut det_dims: Vec<usize> = Vec::new();
            let mut proto_data: Vec<f32> = Vec::new();
            let mut proto_dims: Vec<usize> = Vec::new();
            for (name, value) in outputs.iter() {
                let (dims, data) = value
                    .try_extract_tensor::<f32>()
                    .map_err(|e| format!("extract {name}: {e}"))?;
                let dims: Vec<usize> = dims.iter().map(|&d| d as usize).collect();
                let data: Vec<f32> = data.to_vec();
                if dims.len() == 3 {
                    det_dims = dims;
                    det_data = data;
                } else if dims.len() == 4 {
                    proto_dims = dims;
                    proto_data = data;
                }
            }
            if det_data.is_empty() || proto_data.is_empty() {
                return Err("unexpected YOLO outputs (need rank-3 detections + rank-4 protos)".into());
            }
            Ok((det_data, det_dims, proto_data, proto_dims))
        })?;

    let ch = det_dims[1];
    let anchors = det_dims[2];
    let nc = ch.saturating_sub(4 + SEG_MASK_CHANNELS);
    // Hard compatibility gate: a different backbone (or a detect-only export
    // without mask channels) fails loudly here instead of decoding garbage.
    if nc != SEG_NUM_CLASSES {
        return Err(format!(
            "unexpected class count {nc} (need {SEG_NUM_CLASSES} for yolo11n-seg, got {ch} channels)"
        ));
    }
    let pw = proto_dims[3];
    let ph = proto_dims[2];

    let dets = decode_yolo_seg(&det_data, anchors, nc, conf_thr);
    let kept = nms_classwise(dets, SEG_NMS_IOU, SEG_MAX_DET);

    // full-frame luminance guide for edge refinement
    let uw = w as usize;
    let uh = h as usize;
    let guide_full: Vec<u8> = {
        let mut g = vec![0u8; uw * uh];
        for i in 0..uw * uh {
            let r = rgba[i * 4] as u32;
            let gg = rgba[i * 4 + 1] as u32;
            let b = rgba[i * 4 + 2] as u32;
            g[i] = ((r * 299 + gg * 587 + b * 114) / 1000) as u8;
        }
        g
    };

    use rayon::prelude::*;
    let mut out: Vec<SegmentDetection> = kept
        .par_iter()
        .filter_map(|d| {
            // letterbox box -> input-image box
            let (x0, y0) = unletterbox(d.x1, d.y1, lb, w, h);
            let (x1, y1) = unletterbox(d.x2, d.y2, lb, w, h);
            let bw = (x1 - x0).max(1.0);
            let bh = (y1 - y0).max(1.0);
            // drop specks under 0.3% of the frame (plan5 Fase 4)
            if bw * bh < (w as f32) * (h as f32) * 0.003 {
                return None;
            }
            // proto-space crop of the letterboxed box
            let pbx0 = (d.x1 / SEG_INPUT as f32) * pw as f32;
            let pby0 = (d.y1 / SEG_INPUT as f32) * ph as f32;
            let pbx1 = (d.x2 / SEG_INPUT as f32) * pw as f32;
            let pby1 = (d.y2 / SEG_INPUT as f32) * ph as f32;
            let (crop, cw, ch) = assemble_mask(&d.coeffs, &proto_data, pw, ph, pbx0, pby0, pbx1, pby1);
            if crop.is_empty() {
                return None;
            }
            // cap PNG size, keep aspect, then snap edges to the photo
            let sc = (SEG_MASK_PNG_SIDE as f32 / bw.max(bh)).min(1.0);
            let mw = ((bw * sc).round() as usize).max(2);
            let mh = ((bh * sc).round() as usize).max(2);
            let up = upscale_gray(&crop, cw, ch, mw, mh);
            let ix0 = (x0.floor() as isize).clamp(0, uw as isize - 1) as usize;
            let iy0 = (y0.floor() as isize).clamp(0, uh as isize - 1) as usize;
            let ix1 = (x1.ceil() as isize).clamp(1, uw as isize) as usize;
            let iy1 = (y1.ceil() as isize).clamp(1, uh as isize) as usize;
            let gw = (ix1 - ix0).max(1);
            let gh = (iy1 - iy0).max(1);
            let mut gcrop = vec![0u8; gw * gh];
            for y in 0..gh {
                for x in 0..gw {
                    gcrop[y * gw + x] = guide_full[(iy0 + y) * uw + (ix0 + x)];
                }
            }
            let refined = guided_refine(&up, &upscale_gray(&gcrop, gw, gh, mw, mh), mw, mh, 4, 0.01);
            let png = gray_to_png_base64(&refined, mw, mh).ok()?;
            let label = COCO_LABELS.get(d.class_id).copied().unwrap_or("object");
            Some(SegmentDetection {
                label: label.to_string(),
                class_id: d.class_id,
                score: d.score,
                x: x0,
                y: y0,
                w: bw,
                h: bh,
                mask_png_base64: png,
            })
        })
        .collect();
    // biggest first: the UI activates the largest object
    out.sort_by(|a, b| {
        (b.w * b.h)
            .partial_cmp(&(a.w * a.h))
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    out.truncate(24);

    Ok(SegmentResult {
        detections: out,
        input_width: w,
        input_height: h,
        millis: t0.elapsed().as_millis(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn coco_labels_cover_80_classes_with_spot_checks() {
        assert_eq!(COCO_LABELS.len(), 80);
        assert_eq!(COCO_LABELS[0], "person");
        assert_eq!(COCO_LABELS[2], "car");
        assert_eq!(COCO_LABELS[14], "bird");
        assert_eq!(COCO_LABELS[16], "dog");
        assert_eq!(COCO_LABELS[79], "toothbrush");
    }

    #[test]
    fn letterbox_centers_and_maps_back() {
        // 800x600 into 640: scale 0.8, pads x=0, y=80
        let lb = letterbox_params(800, 600, 640);
        assert!((lb.scale - 0.8).abs() < 1e-6);
        assert!((lb.pad_x - 0.0).abs() < 1e-6);
        assert!((lb.pad_y - 80.0).abs() < 1e-6);
        let (x, y) = unletterbox(320.0, 80.0 + 240.0, lb, 800, 600);
        assert!((x - 400.0).abs() < 1e-3);
        assert!((y - 300.0).abs() < 1e-3);
    }

    #[test]
    fn letterbox_rgb_pads_gray_and_maps_red() {
        // 2x1 red image into 4: scale 2, pads y=1
        let rgba = vec![255u8, 0, 0, 255, 255, 0, 0, 255];
        let (t, lb) = letterbox_rgb(&rgba, 2, 1, 4).unwrap();
        assert!((lb.scale - 2.0).abs() < 1e-6);
        // row 0 is padding gray 114, rows 1-2 carry red (R=1, G=B=0)
        assert!((t[0] - 114.0 / 255.0).abs() < 1e-6);
        assert!((t[4] - 1.0).abs() < 1e-6);
        assert!((t[16 + 4] - 0.0).abs() < 1e-6);
        assert!((t[32 + 4] - 0.0).abs() < 1e-6);
        assert_eq!(t.len(), 3 * 16);
    }

    #[test]
    fn letterbox_rgb_rejects_bad_size() {
        assert!(letterbox_rgb(&[0u8; 10], 2, 1, 4).is_err());
    }

    #[test]
    fn decode_picks_best_class_over_conf() {
        // 116 channels x 2 anchors, row-major per channel
        let anchors = 2;
        let mut out = vec![0f32; 116 * anchors];
        // anchor 0: box + person(0) 0.9 + coeff0 5.0
        out[0] = 100.0;
        out[anchors] = 100.0;
        out[2 * anchors] = 40.0;
        out[3 * anchors] = 30.0;
        out[4 * anchors] = 0.9;
        out[(84) * anchors] = 5.0;
        // anchor 1: weak dog(16) 0.1 -> dropped
        out[1] = 10.0;
        out[anchors + 1] = 10.0;
        out[2 * anchors + 1] = 8.0;
        out[3 * anchors + 1] = 8.0;
        out[(4 + 16) * anchors + 1] = 0.1;
        let dets = decode_yolo_seg(&out, anchors, 80, 0.35);
        assert_eq!(dets.len(), 1);
        assert_eq!(dets[0].class_id, 0);
        assert!((dets[0].score - 0.9).abs() < 1e-6);
        assert!((dets[0].x1 - 80.0).abs() < 1e-6);
        assert!((dets[0].coeffs[0] - 5.0).abs() < 1e-6);
    }

    #[test]
    fn nms_keeps_best_per_class_and_all_across_classes() {
        let mk = |x1: f32, score: f32, cls: usize| RawDet {
            x1,
            y1: 0.0,
            x2: x1 + 10.0,
            y2: 10.0,
            score,
            class_id: cls,
            coeffs: [0.0; SEG_MASK_CHANNELS],
        };
        let kept = nms_classwise(vec![mk(0.0, 0.9, 0), mk(1.0, 0.8, 0), mk(1.0, 0.7, 1)], 0.6, 64);
        // same-class overlap suppressed, other class kept
        assert_eq!(kept.len(), 2);
        assert_eq!(kept[0].score, 0.9);
        assert_eq!(kept[1].class_id, 1);
    }

    #[test]
    fn iou_unit_square_overlap() {
        let mk = |x1: f32, x2: f32| RawDet {
            x1,
            y1: 0.0,
            x2,
            y2: 10.0,
            score: 1.0,
            class_id: 0,
            coeffs: [0.0; SEG_MASK_CHANNELS],
        };
        assert!((iou(&mk(0.0, 10.0), &mk(0.0, 10.0)) - 1.0).abs() < 1e-6);
        assert!((iou(&mk(0.0, 10.0), &mk(5.0, 15.0)) - 0.333).abs() < 0.01);
        assert_eq!(iou(&mk(0.0, 5.0), &mk(6.0, 10.0)), 0.0);
    }

    #[test]
    fn assemble_mask_biases_and_crops() {
        // protos: channel 0 all ones (4x4), rest zeros
        let mut protos = vec![0f32; 32 * 16];
        for i in 0..16 {
            protos[i] = 1.0;
        }
        let mut coeffs = [0f32; SEG_MASK_CHANNELS];
        coeffs[0] = 10.0; // sigmoid(10) ~ 1
        let (m, w, h) = assemble_mask(&coeffs, &protos, 4, 4, 1.0, 1.0, 3.0, 3.0);
        assert_eq!((w, h), (2, 2));
        assert!(m.iter().all(|&v| v == 255));
        // negative bias -> zeros
        coeffs[0] = -10.0;
        let (m2, _, _) = assemble_mask(&coeffs, &protos, 4, 4, 0.0, 0.0, 4.0, 4.0);
        assert!(m2.iter().all(|&v| v == 0));
    }

    #[test]
    fn upscale_identity_and_growth() {
        let src = vec![10u8, 20, 30, 40];
        let same = upscale_gray(&src, 2, 2, 2, 2);
        assert_eq!(same, src);
        let big = upscale_gray(&src, 2, 2, 4, 4);
        assert_eq!(big.len(), 16);
        assert_eq!(big[0], 10);
        assert_eq!(big[15], 40);
    }

    #[test]
    fn gray_png_roundtrip_dimensions() {
        let gray = vec![0u8, 128, 255, 64];
        let b64 = gray_to_png_base64(&gray, 2, 2).unwrap();
        assert!(!b64.is_empty());
        use base64::Engine as _;
        let raw = base64::engine::general_purpose::STANDARD.decode(&b64).unwrap();
        // PNG signature
        assert_eq!(&raw[0..8], &[137, 80, 78, 71, 13, 10, 26, 10]);
        assert!(gray_to_png_base64(&[], 0, 0).is_err());
    }

    #[test]
    fn default_model_path_points_at_exe_models_dir() {
        let p = default_model_path();
        assert!(p.ends_with("yolo11n-seg.onnx"));
        assert!(p.contains("models"));
    }

    #[test]
    fn ade_labels_ground_truth_spot_checks() {
        assert_eq!(ADE_LABELS.len(), 150);
        assert_eq!(ADE_LABELS[25], "house");
        assert_eq!(ADE_LABELS[1], "building");
        assert_eq!(ADE_LABELS[2], "sky");
        assert_eq!(ADE_LABELS[6], "road");
        assert_eq!(ADE_LABELS[21], "water");
        // stuff targets reference real class ids
        for (id, _) in STUFF_TARGETS {
            assert!((id as usize) < 150);
            assert_ne!(ADE_LABELS[id as usize], "");
        }
        assert!(!ADE_LABELS.iter().any(|l| l.contains("cloud")));
    }

    #[test]
    fn connected_components_splits_and_filters() {
        // plus shape + isolated dot + single speck (filtered)
        let mut bin = vec![0u8; 8 * 8];
        let on = |x: usize, y: usize, b: &mut Vec<u8>| b[y * 8 + x] = 255;
        on(1, 1, &mut bin);
        on(2, 1, &mut bin);
        on(1, 2, &mut bin);
        on(6, 6, &mut bin);
        on(7, 6, &mut bin);
        on(0, 7, &mut bin);
        let regs = connected_components(&bin, 8, 8, 2);
        assert_eq!(regs.len(), 2);
        assert_eq!((regs[0].x0, regs[0].y0, regs[0].x1, regs[0].y1), (1, 1, 3, 3));
        assert_eq!(regs[0].count, 3);
        assert_eq!((regs[1].x0, regs[1].y0, regs[1].x1, regs[1].y1), (6, 6, 8, 7));
        // empty / degenerate inputs never panic
        assert!(connected_components(&[], 0, 0, 1).is_empty());
        assert!(connected_components(&[0u8; 4], 2, 2, 99).is_empty());
    }

    #[test]
    fn guided_filter_preserves_aligned_edges() {
        // mask and guide share one hard edge: the filter must keep it sharp
        // (a plain blur would smear both sides toward mid gray).
        let w = 12;
        let h = 12;
        let mut mask = vec![0u8; w * h];
        let mut guide = vec![0u8; w * h];
        for y in 0..h {
            for x in 0..w {
                if x >= 6 {
                    mask[y * w + x] = 255;
                    guide[y * w + x] = 255;
                }
            }
        }
        let out = guided_refine(&mask, &guide, w, h, 2, 0.01);
        assert_eq!(out.len(), w * h);
        let col = |x: usize| -> f32 {
            (0..h).map(|y| out[y * w + x] as f32).sum::<f32>() / h as f32
        };
        assert!(col(5) < 100.0, "dark side smeared: {}", col(5));
        assert!(col(6) > 155.0, "bright side smeared: {}", col(6));
        let mean: f32 = out.iter().map(|&v| v as f32).sum::<f32>() / (w * h) as f32;
        assert!((mean - 127.5).abs() < 12.0, "mean drifted: {mean}");
    }

    #[test]
    fn box_blur_uniform_stays_put() {
        let src = vec![100f32; 25];
        let out = box_blur(&src, 5, 5, 2);
        assert_eq!(out.len(), 25);
        assert!(out.iter().all(|&v| (v - 100.0).abs() < 0.01));
        assert!(box_blur(&[], 0, 0, 2).is_empty());
    }
}

// ---------------------------------------------------------------------------
// Plan5 Fase 2: semantic stuff (ADE20K) - house, sky, clouds, land, water.
// ---------------------------------------------------------------------------

pub const SEG_ADE_INPUT: u32 = 512;
pub const SEG_ADE_CLASSES: usize = 150;

/// Ground truth order from the mmseg ADE20K dataset definition
/// (xueyingliu/SegFormer_onnx mmseg/datasets/ade.py, 0-based).
pub const ADE_LABELS: [&str; 150] = [
    "wall", "building", "sky", "floor", "tree", "ceiling", "road", "bed",
    "windowpane", "grass", "cabinet", "sidewalk", "person", "earth", "door",
    "table", "mountain", "plant", "curtain", "chair", "car", "water", "painting",
    "sofa", "shelf", "house", "sea", "mirror", "rug", "field", "armchair", "seat",
    "fence", "desk", "rock", "wardrobe", "lamp", "bathtub", "railing", "cushion",
    "base", "box", "column", "signboard", "chest of drawers", "counter", "sand",
    "sink", "skyscraper", "fireplace", "refrigerator", "grandstand", "path",
    "stairs", "runway", "case", "pool table", "pillow", "screen door", "stairway",
    "river", "bridge", "bookcase", "blind", "coffee table", "toilet", "flower",
    "book", "hill", "bench", "countertop", "stove", "palm", "kitchen island",
    "computer", "swivel chair", "boat", "bar", "arcade machine", "hovel", "bus",
    "towel", "light", "truck", "tower", "chandelier", "awning", "streetlight",
    "booth", "television receiver", "airplane", "dirt track", "apparel", "pole",
    "land", "bannister", "escalator", "ottoman", "bottle", "buffet", "poster",
    "stage", "van", "ship", "fountain", "conveyer belt", "canopy", "washer",
    "plaything", "swimming pool", "stool", "barrel", "basket", "waterfall",
    "tent", "bag", "minibike", "cradle", "oven", "ball", "food", "step", "tank",
    "trade name", "microwave", "pot", "animal", "bicycle", "lake", "dishwasher",
    "screen", "blanket", "sculpture", "hood", "sconce", "vase", "traffic light",
    "tray", "ashcan", "fan", "pier", "crt screen", "plate", "monitor",
    "bulletin board", "shower", "radiator", "glass", "clock", "flag",
];

/// Curated stuff targets (class id, display label). Things (person, car, ...)
/// are owned by YOLO instances and excluded here to avoid duplicate layers.
pub const STUFF_TARGETS: [(u8, &str); 23] = [
    (25, "House"), (1, "Building"), (2, "Sky"), (6, "Road"), (9, "Grass"),
    (4, "Tree"), (21, "Water"), (16, "Mountain"), (26, "Sea"), (29, "Field"),
    (11, "Sidewalk"), (13, "Earth"), (46, "Sand"), (60, "River"), (68, "Hill"),
    (72, "Palm"), (52, "Path"), (32, "Fence"), (61, "Bridge"), (84, "Tower"),
    (48, "Skyscraper"), (128, "Lake"), (94, "Land"),
];

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StuffRegion {
    pub label: String,
    pub class_id: usize,
    pub coverage: f32,
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
    pub mask_png_base64: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StuffResult {
    pub regions: Vec<StuffRegion>,
    pub input_width: u32,
    pub input_height: u32,
    pub millis: u128,
}

/// Connected component region, half-open [x0,x1) x [y0,y1).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct CcRegion {
    pub x0: usize,
    pub y0: usize,
    pub x1: usize,
    pub y1: usize,
    pub count: usize,
}

/// 4-connected components over a binary (nonzero = foreground) mask.
pub fn connected_components(binary: &[u8], w: usize, h: usize, min_pixels: usize) -> Vec<CcRegion> {
    if w == 0 || h == 0 || binary.len() < w * h {
        return Vec::new();
    }
    let mut seen = vec![false; w * h];
    let mut out = Vec::new();
    let mut stack = Vec::new();
    for y in 0..h {
        for x in 0..w {
            let s = y * w + x;
            if binary[s] == 0 || seen[s] {
                continue;
            }
            let (mut x0, mut y0, mut x1, mut y1) = (x, y, x + 1, y + 1);
            let mut count = 0usize;
            stack.clear();
            stack.push(s);
            seen[s] = true;
            while let Some(p) = stack.pop() {
                let px = p % w;
                let py = p / w;
                count += 1;
                if px < x0 { x0 = px; }
                if py < y0 { y0 = py; }
                if px + 1 > x1 { x1 = px + 1; }
                if py + 1 > y1 { y1 = py + 1; }
                if px > 0 {
                    let q = p - 1;
                    if binary[q] != 0 && !seen[q] { seen[q] = true; stack.push(q); }
                }
                if px + 1 < w {
                    let q = p + 1;
                    if binary[q] != 0 && !seen[q] { seen[q] = true; stack.push(q); }
                }
                if py > 0 {
                    let q = p - w;
                    if binary[q] != 0 && !seen[q] { seen[q] = true; stack.push(q); }
                }
                if py + 1 < h {
                    let q = p + w;
                    if binary[q] != 0 && !seen[q] { seen[q] = true; stack.push(q); }
                }
            }
            if count >= min_pixels.max(1) {
                out.push(CcRegion { x0, y0, x1, y1, count });
            }
        }
    }
    out
}

/// Box blur via integral image (clamped edges), the workhorse of guided filter.
fn box_blur(src: &[f32], w: usize, h: usize, r: usize) -> Vec<f32> {
    if w == 0 || h == 0 {
        return Vec::new();
    }
    let mut sat = vec![0f32; (w + 1) * (h + 1)];
    for y in 0..h {
        let mut row = 0f32;
        for x in 0..w {
            row += src[y * w + x];
            sat[(y + 1) * (w + 1) + (x + 1)] = sat[y * (w + 1) + (x + 1)] + row;
        }
    }
    let at = |x: isize, y: isize| -> f32 {
        let x = x.clamp(0, w as isize) as usize;
        let y = y.clamp(0, h as isize) as usize;
        sat[y * (w + 1) + x]
    };
    let ri = r as isize;
    let mut out = vec![0f32; w * h];
    for y in 0..h {
        for x in 0..w {
            // Inclusive clamped window [xa..xb]x[ya..yb]; SAT uses +1 edges.
            let xa = (x as isize - ri).max(0);
            let xb = (x as isize + ri).min(w as isize - 1);
            let ya = (y as isize - ri).max(0);
            let yb = (y as isize + ri).min(h as isize - 1);
            let sum = at(xb + 1, yb + 1) - at(xa, yb + 1) - at(xb + 1, ya) + at(xa, ya);
            let area = ((xb - xa + 1) * (yb - ya + 1)) as f32;
            out[y * w + x] = sum / area.max(1.0);
        }
    }
    out
}

/// Guided filter: snap a soft mask to the guide image edges.
/// mask/guide are 0-255 grayscale of identical size. Returns refined 0-255.
pub fn guided_refine(mask: &[u8], guide: &[u8], w: usize, h: usize, radius: usize, eps: f32) -> Vec<u8> {
    assert_eq!(mask.len(), w * h);
    assert_eq!(guide.len(), w * h);
    let n = w * h;
    let guide_f: Vec<f32> = guide.iter().map(|&v| v as f32 / 255.0).collect();
    let mask_f: Vec<f32> = mask.iter().map(|&v| v as f32 / 255.0).collect();
    let mean_i = box_blur(&guide_f, w, h, radius);
    let mean_p = box_blur(&mask_f, w, h, radius);
    let mut corr_i = vec![0f32; n];
    let mut corr_ip = vec![0f32; n];
    for i in 0..n {
        corr_i[i] = guide_f[i] * guide_f[i];
        corr_ip[i] = guide_f[i] * mask_f[i];
    }
    let corr_i = box_blur(&corr_i, w, h, radius);
    let corr_ip = box_blur(&corr_ip, w, h, radius);
    let mut a = vec![0f32; n];
    let mut b = vec![0f32; n];
    for i in 0..n {
        let var_i = (corr_i[i] - mean_i[i] * mean_i[i]).max(0.0);
        let cov = corr_ip[i] - mean_i[i] * mean_p[i];
        a[i] = cov / (var_i + eps);
        b[i] = mean_p[i] - a[i] * mean_i[i];
    }
    let mean_a = box_blur(&a, w, h, radius);
    let mean_b = box_blur(&b, w, h, radius);
    let mut out = vec![0u8; n];
    for i in 0..n {
        out[i] = ((mean_a[i] * guide_f[i] + mean_b[i]).clamp(0.0, 1.0) * 255.0 + 0.5) as u8;
    }
    out
}

/// ImageNet normalize + NCHW f32 tensor for 512-square semantic input.
fn semantic_input(rgba: &[u8], w: u32, h: u32) -> Result<Vec<f32>, String> {
    const MEAN: [f32; 3] = [0.485, 0.456, 0.406];
    const STD: [f32; 3] = [0.229, 0.224, 0.225];
    let s = SEG_ADE_INPUT as usize;
    let mut out = vec![0f32; 3 * s * s];
    for y in 0..s {
        for x in 0..s {
            // plain resize (SegFormer export expects square 512)
            let sx = ((x as f32 + 0.5) * w as f32 / s as f32 - 0.5).round() as i64;
            let sy = ((y as f32 + 0.5) * h as f32 / s as f32 - 0.5).round() as i64;
            let sx = sx.clamp(0, w as i64 - 1) as usize;
            let sy = sy.clamp(0, h as i64 - 1) as usize;
            let i = (sy * w as usize + sx) * 4;
            for c in 0..3 {
                out[c * s * s + y * s + x] = (rgba[i + c] as f32 / 255.0 - MEAN[c]) / STD[c];
            }
        }
    }
    Ok(out)
}

/// Class map from a semantic model, accepting EITHER float logits
/// [1,150,H,W] (argmax here) OR int64 class ids [1,H,W]/[1,1,H,W] (some mmseg
/// exports bake argmax into the graph, as this one does).
/// Returns (classes, w, h).
fn run_class_map(
    model_path: &str,
    input_name: &str,
    tensor: Vec<f32>,
    dims: [usize; 4],
    num_classes: usize,
) -> Result<(Vec<u8>, usize, usize), String> {
    use_session(model_path, |session| {
        let input_tensor = ort::value::Tensor::from_array((dims, tensor))
            .map_err(|e| format!("ort input tensor: {e}"))?;
        let outputs = session
            .run(ort::inputs![input_name => input_tensor])
            .map_err(|e| format!("segment inference: {e}"))?;
        let mut float_out: Option<(Vec<usize>, Vec<f32>)> = None;
        let mut int_out: Option<(Vec<usize>, Vec<i64>)> = None;
        for (name, value) in outputs.iter() {
            if let Ok((shape, data)) = value.try_extract_tensor::<f32>() {
                let shape: Vec<usize> = shape.iter().map(|&d| d as usize).collect();
                if shape.len() == 4 {
                    float_out = Some((shape, data.to_vec()));
                }
            } else if let Ok((shape, data)) = value.try_extract_tensor::<i64>() {
                let shape: Vec<usize> = shape.iter().map(|&d| d as usize).collect();
                if shape.len() == 3 || shape.len() == 4 {
                    int_out = Some((shape, data.to_vec()));
                }
            } else {
                return Err(format!("extract {name}: unsupported tensor type"));
            }
        }
        if let Some((shape, data)) = float_out {
            if shape.len() != 4 || shape[1] != num_classes {
                return Err(format!("unexpected semantic dims: {shape:?}"));
            }
            let (lw, lh) = (shape[3], shape[2]);
            let mut cls = vec![0u8; lw * lh];
            for y in 0..lh {
                for x in 0..lw {
                    let mut best = f32::NEG_INFINITY;
                    let mut bi = 0usize;
                    for c in 0..num_classes {
                        let v = data[c * lw * lh + y * lw + x];
                        if v > best {
                            best = v;
                            bi = c;
                        }
                    }
                    cls[y * lw + x] = bi.min(255) as u8;
                }
            }
            return Ok((cls, lw, lh));
        }
        if let Some((shape, data)) = int_out {
            let (lw, lh) = (shape[shape.len() - 1], shape[shape.len() - 2]);
            let mut cls = vec![0u8; lw * lh];
            for (i, v) in data.iter().enumerate().take(lw * lh) {
                cls[i] = (*v).clamp(0, 255) as u8;
            }
            return Ok((cls, lw, lh));
        }
        Err("no rank-3/4 output from semantic model".to_string())
    })
}

#[tauri::command]
pub fn cmd_segment_stuff(
    model_path: String,
    rgba: Vec<u8>,
    width: u32,
    height: u32,
) -> Result<StuffResult, String> {
    let t0 = std::time::Instant::now();
    let w = width.max(8).min(4096);
    let h = height.max(8).min(4096);
    if rgba.len() != (w as usize) * (h as usize) * 4 {
        return Err(format!("RGBA size mismatch: got {} bytes for {w}x{h}", rgba.len()));
    }
    let input = semantic_input(&rgba, w, h)?;
    let (cls, lw, lh) = run_class_map(&model_path, "img", input, [1, 3, 512, 512], SEG_ADE_CLASSES)?;
    // nearest upscale to input size (labels must not blend)
    let uw = w as usize;
    let uh = h as usize;
    let mut full = vec![0u8; uw * uh];
    for y in 0..uh {
        for x in 0..uw {
            let sx = ((x as f32 + 0.5) * lw as f32 / uw as f32 - 0.5).round() as isize;
            let sy = ((y as f32 + 0.5) * lh as f32 / uh as f32 - 0.5).round() as isize;
            let sx = sx.clamp(0, lw as isize - 1) as usize;
            let sy = sy.clamp(0, lh as isize - 1) as usize;
            full[y * uw + x] = cls[sy * lw + sx];
        }
    }
    // grayscale guide for refinement (luminance of the input)
    let guide: Vec<u8> = {
        let mut g = vec![0u8; uw * uh];
        for i in 0..uw * uh {
            let r = rgba[i * 4] as u32;
            let gg = rgba[i * 4 + 1] as u32;
            let b = rgba[i * 4 + 2] as u32;
            g[i] = ((r * 299 + gg * 587 + b * 114) / 1000) as u8;
        }
        g
    };
    let frame_area = (uw * uh) as f32;
    let mut regions: Vec<StuffRegion> = Vec::new();
    use rayon::prelude::*;
    let per_class: Vec<(u8, &str, Vec<CcRegion>)> = STUFF_TARGETS
        .par_iter()
        .map(|&(cid, _label)| {
            let mut bin = vec![0u8; uw * uh];
            for i in 0..uw * uh {
                if full[i] == cid {
                    bin[i] = 255;
                }
            }
            let min_px = ((frame_area * 0.005).round() as usize).max(64);
            let mut regs = connected_components(&bin, uw, uh, min_px);
            regs.sort_by(|a, b| {
                let ca = (a.x1 - a.x0) * (a.y1 - a.y0);
                let cb = (b.x1 - b.x0) * (b.y1 - b.y0);
                cb.cmp(&ca)
            });
            regs.truncate(8);
            (cid, "", regs)
        })
        .collect();
    for (cid, _l, regs) in per_class {
        let label = STUFF_TARGETS.iter().find(|(c, _)| *c == cid).map(|(_, l)| *l).unwrap_or("Region");
        for r in regs {
            let bw = (r.x1 - r.x0).max(1);
            let bh = (r.y1 - r.y0).max(1);
            // crop binary mask + guide, refine edges, cap PNG size
            let mut crop = vec![0u8; bw * bh];
            let mut gcrop = vec![0u8; bw * bh];
            for y in 0..bh {
                for x in 0..bw {
                    let gx = r.x0 + x;
                    let gy = r.y0 + y;
                    crop[y * bw + x] = if full[gy * uw + gx] == cid { 255 } else { 0 };
                    gcrop[y * bw + x] = guide[gy * uw + gx];
                }
            }
            let sc = (SEG_MASK_PNG_SIDE as f32 / bw.max(bh) as f32).min(1.0);
            let mw = ((bw as f32 * sc).round() as usize).max(2);
            let mh = ((bh as f32 * sc).round() as usize).max(2);
            let small = upscale_gray(&crop, bw, bh, mw, mh);
            let gsmall = upscale_gray(&gcrop, bw, bh, mw, mh);
            let refined = guided_refine(&small, &gsmall, mw, mh, 4, 0.01);
            let png = gray_to_png_base64(&refined, mw, mh).unwrap_or_default();
            if png.is_empty() {
                continue;
            }
            regions.push(StuffRegion {
                label: label.to_string(),
                class_id: cid as usize,
                coverage: (bw * bh) as f32 / frame_area,
                x: r.x0 as f32,
                y: r.y0 as f32,
                w: bw as f32,
                h: bh as f32,
                mask_png_base64: png,
            });
        }
    }
    // Clouds: bright blobs inside the sky mask (ADE20K has no cloud class).
    {
        let mut sky = vec![0u8; uw * uh];
        let mut guide = vec![0u8; uw * uh];
        for i in 0..uw * uh {
            if full[i] == 2 {
                let r = rgba[i * 4] as u32;
                let g = rgba[i * 4 + 1] as u32;
                let b = rgba[i * 4 + 2] as u32;
                let lum = (r * 299 + g * 587 + b * 114) / 1000;
                guide[i] = lum as u8;
                if lum > 195 {
                    sky[i] = 255;
                }
            }
        }
        let min_px = ((frame_area * 0.002).round() as usize).max(32);
        let mut regs = connected_components(&sky, uw, uh, min_px);
        regs.sort_by(|a, b| {
            let ca = (a.x1 - a.x0) * (a.y1 - a.y0);
            let cb = (b.x1 - b.x0) * (b.y1 - b.y0);
            cb.cmp(&ca)
        });
        regs.truncate(8);
        for r in regs {
            let bw = (r.x1 - r.x0).max(1);
            let bh = (r.y1 - r.y0).max(1);
            let mut crop = vec![0u8; bw * bh];
            let mut gcrop = vec![0u8; bw * bh];
            for y in 0..bh {
                for x in 0..bw {
                    crop[y * bw + x] = sky[(r.y0 + y) * uw + (r.x0 + x)];
                    gcrop[y * bw + x] = guide[(r.y0 + y) * uw + (r.x0 + x)];
                }
            }
            let sc = (SEG_MASK_PNG_SIDE as f32 / bw.max(bh) as f32).min(1.0);
            let mw = ((bw as f32 * sc).round() as usize).max(2);
            let mh = ((bh as f32 * sc).round() as usize).max(2);
            let refined = guided_refine(
                &upscale_gray(&crop, bw, bh, mw, mh),
                &upscale_gray(&gcrop, bw, bh, mw, mh),
                mw,
                mh,
                4,
                0.01,
            );
            let png = gray_to_png_base64(&refined, mw, mh).unwrap_or_default();
            if png.is_empty() {
                continue;
            }
            regions.push(StuffRegion {
                label: "Clouds".to_string(),
                class_id: 200,
                coverage: (bw * bh) as f32 / frame_area,
                x: r.x0 as f32,
                y: r.y0 as f32,
                w: bw as f32,
                h: bh as f32,
                mask_png_base64: png,
            });
        }
    }
    regions.sort_by(|a, b| {
        (b.w * b.h)
            .partial_cmp(&(a.w * a.h))
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    regions.truncate(24);
    Ok(StuffResult {
        regions,
        input_width: w,
        input_height: h,
        millis: t0.elapsed().as_millis(),
    })
}

// ---------------------------------------------------------------------------
// Plan5 Fase 3: DBNet text detection (boxes; OCR content is plan6).
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TextBox {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
    pub score: f32,
    pub mask_png_base64: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TextResult {
    pub boxes: Vec<TextBox>,
    pub input_width: u32,
    pub input_height: u32,
    pub millis: u128,
}

pub const TEXT_MAX_SIDE: u32 = 960;
pub const TEXT_PROB_THRESH: f32 = 0.3;

/// White bbox mask PNG (text boxes are rectangles by design here).
fn white_rect_png(w: usize, h: usize) -> Result<String, String> {
    gray_to_png_base64(&vec![255u8; w * h], w, h)
}

#[tauri::command]
pub fn cmd_segment_text(
    model_path: String,
    rgba: Vec<u8>,
    width: u32,
    height: u32,
) -> Result<TextResult, String> {
    let t0 = std::time::Instant::now();
    let w = width.max(8).min(4096);
    let h = height.max(8).min(4096);
    if rgba.len() != (w as usize) * (h as usize) * 4 {
        return Err(format!("RGBA size mismatch: got {} bytes for {w}x{h}", rgba.len()));
    }
    // work scale (no upscale) + pad to multiples of 32
    let sc = (TEXT_MAX_SIDE as f32 / w.max(h) as f32).min(1.0);
    let ww = ((w as f32 * sc).round() as usize).max(32);
    let hh = ((h as f32 * sc).round() as usize).max(32);
    let pw = ((ww + 31) / 32) * 32;
    let ph = ((hh + 31) / 32) * 32;
    const MEAN: [f32; 3] = [0.485, 0.456, 0.406];
    const STD: [f32; 3] = [0.229, 0.224, 0.225];
    let mut input = vec![0f32; 3 * pw * ph];
    for y in 0..ph {
        for x in 0..pw {
            let sx = ((x as f32 + 0.5) * ww as f32 / pw as f32 - 0.5).round() as i64;
            let sy = ((y as f32 + 0.5) * hh as f32 / ph as f32 - 0.5).round() as i64;
            let sx = sx.clamp(0, ww as i64 - 1) as usize;
            let sy = sy.clamp(0, hh as i64 - 1) as usize;
            let ox = ((sx as f32 + 0.5) / sc).round() as i64;
            let oy = ((sy as f32 + 0.5) / sc).round() as i64;
            let ox = ox.clamp(0, w as i64 - 1) as usize;
            let oy = oy.clamp(0, h as i64 - 1) as usize;
            let i = (oy * w as usize + ox) * 4;
            for c in 0..3 {
                input[c * pw * ph + y * pw + x] = (rgba[i + c] as f32 / 255.0 - MEAN[c]) / STD[c];
            }
        }
    }
    let (map, map_dims) = use_session(&model_path, |session| {
        let tensor = ort::value::Tensor::from_array(([1usize, 3, ph, pw], input))
            .map_err(|e| format!("ort input tensor: {e}"))?;
        let outputs = session
            .run(ort::inputs!["x" => tensor])
            .map_err(|e| format!("text inference: {e}"))?;
        let mut best: Option<(Vec<f32>, Vec<usize>)> = None;
        for (name, value) in outputs.iter() {
            let (shape, data) = value
                .try_extract_tensor::<f32>()
                .map_err(|e| format!("extract {name}: {e}"))?;
            let shape: Vec<usize> = shape.iter().map(|&d| d as usize).collect();
            if shape.len() == 4 {
                best = Some((data.to_vec(), shape));
            }
        }
        best.ok_or_else(|| "no rank-4 output from text model".to_string())
    })?;
    let mw = map_dims[3];
    let mh = map_dims[2];
    if map.len() < mw * mh {
        return Err("text map truncated".into());
    }
    // threshold -> components -> expand 1.5x -> score by mean prob
    let mut bin = vec![0u8; mw * mh];
    for i in 0..mw * mh {
        if map[i] >= TEXT_PROB_THRESH {
            bin[i] = 255;
        }
    }
    let min_px = ((mw * mh) as f32 * 0.0002).round() as usize;
    let regs = connected_components(&bin, mw, mh, min_px.max(16));
    // map stride back to input pixels
    let stride_x = pw as f32 / mw as f32 / sc;
    let stride_y = ph as f32 / mh as f32 / sc;
    let mut boxes: Vec<TextBox> = Vec::new();
    for r in regs {
        let mut sum = 0f64;
        let mut cnt = 0usize;
        for y in r.y0..r.y1 {
            for x in r.x0..r.x1 {
                sum += map[y * mw + x] as f64;
                cnt += 1;
            }
        }
        if cnt == 0 {
            continue;
        }
        let score = (sum / cnt as f64) as f32;
        let cx = (r.x0 + r.x1) as f32 / 2.0;
        let cy = (r.y0 + r.y1) as f32 / 2.0;
        let bw = (r.x1 - r.x0) as f32 * 1.5;
        let bh = (r.y1 - r.y0) as f32 * 1.5;
        let x0 = ((cx - bw / 2.0) * stride_x).clamp(0.0, w as f32);
        let y0 = ((cy - bh / 2.0) * stride_y).clamp(0.0, h as f32);
        let x1 = ((cx + bw / 2.0) * stride_x).clamp(0.0, w as f32);
        let y1 = ((cy + bh / 2.0) * stride_y).clamp(0.0, h as f32);
        let fw = (x1 - x0).max(2.0);
        let fh = (y1 - y0).max(2.0);
        let mw2 = (fw.min(160.0).round() as usize).max(2);
        let mh2 = (fh.min(160.0).round() as usize).max(2);
        let png = white_rect_png(mw2, mh2)?;
        boxes.push(TextBox {
            x: x0,
            y: y0,
            w: fw,
            h: fh,
            score,
            mask_png_base64: png,
        });
    }
    boxes.sort_by(|a, b| {
        (b.w * b.h)
            .partial_cmp(&(a.w * a.h))
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    boxes.truncate(24);
    Ok(TextResult {
        boxes,
        input_width: w,
        input_height: h,
        millis: t0.elapsed().as_millis(),
    })
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SegmentModelsStatus {
    pub yolo: SegmentModelStatus,
    pub stuff: SegmentModelStatus,
    pub text: SegmentModelStatus,
}

fn status_for(file: &str) -> SegmentModelStatus {
    let base = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    let path = base.join("models").join(file).to_string_lossy().into_owned();
    let found = std::path::Path::new(&path).is_file();
    SegmentModelStatus { found, path }
}

#[tauri::command]
pub fn cmd_segment_models_status() -> SegmentModelsStatus {
    SegmentModelsStatus {
        yolo: status_for("yolo11n-seg.onnx"),
        stuff: status_for("segformer-b1-ade.onnx"),
        text: status_for("dbnet.onnx"),
    }
}
