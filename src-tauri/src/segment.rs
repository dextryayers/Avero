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

static SESSION_CACHE: OnceLock<Mutex<Option<(String, ort::session::Session)>>> = OnceLock::new();

fn session_lock(
) -> Result<std::sync::MutexGuard<'static, Option<(String, ort::session::Session)>>, String> {
    SESSION_CACHE
        .get_or_init(|| Mutex::new(None))
        .lock()
        .map_err(|e| format!("segment session lock poisoned: {e}"))
}

fn ensure_session(model_path: &str) -> Result<(), String> {
    let mut guard = session_lock()?;
    let stale = guard.as_ref().map(|(p, _)| p != model_path).unwrap_or(true);
    if !stale {
        return Ok(());
    }
    if !std::path::Path::new(model_path).is_file() {
        return Err(format!(
            "YOLO model not found at {model_path}. Place yolo11n-seg.onnx in <exe-dir>/models/ (one-time download)."
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
    *guard = Some((model_path.to_string(), session));
    Ok(())
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

    ensure_session(&model_path)?;
    // Borrowed ort outputs cannot outlive the session lock, so extract owned
    // copies inside this scope; the lock (and session borrow) ends with it.
    let (det_data, det_dims, proto_data, proto_dims): (Vec<f32>, Vec<usize>, Vec<f32>, Vec<usize>) = {
        let mut guard = session_lock()?;
        let session = guard
            .as_mut()
            .map(|(_, s)| s)
            .ok_or("segment session missing after load")?;

        let input_tensor =
            ort::value::Tensor::from_array(arr).map_err(|e| format!("ort input tensor: {e}"))?;
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
        (det_data, det_dims, proto_data, proto_dims)
    };

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
            // cap PNG size, keep aspect
            let sc = (SEG_MASK_PNG_SIDE as f32 / bw.max(bh)).min(1.0);
            let mw = ((bw * sc).round() as usize).max(2);
            let mh = ((bh * sc).round() as usize).max(2);
            let up = upscale_gray(&crop, cw, ch, mw, mh);
            let png = gray_to_png_base64(&up, mw, mh).ok()?;
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
}
