// Plan5 Fase 0.4: real-model proof. Runs YOLO11n-seg on a real photo and
// asserts genuine detections (labels + scores + non-empty masks).
// Needs AVERO_SEG_MODEL (yolo11n-seg.onnx) and AVERO_SEG_IMAGE (photo).
// Skips gracefully without them so plain `cargo test` stays green offline.
use avero_studio_lib::segment;

fn env_or_skip(var: &str) -> Option<String> {
    match std::env::var(var) {
        Ok(v) if !v.trim().is_empty() && std::path::Path::new(&v).is_file() => Some(v),
        Ok(v) => {
            println!("SKIP: {var} points nowhere: {v}");
            None
        }
        Err(_) => {
            println!("SKIP: {var} not set");
            None
        }
    }
}

#[test]
fn yolo11n_seg_detects_real_objects() {
    let Some(model) = env_or_skip("AVERO_SEG_MODEL") else {
        return;
    };
    let Some(image_path) = env_or_skip("AVERO_SEG_IMAGE") else {
        return;
    };
    let img = image::open(&image_path).expect("read test image").to_rgba8();
    let (w, h) = (img.width(), img.height());
    assert!(w >= 64 && h >= 64, "test image suspiciously small");

    let t0 = std::time::Instant::now();
    let res = segment::cmd_segment_objects(model, img.into_raw(), w, h, Some(0.35))
        .expect("segment command");
    let total_ms = t0.elapsed().as_millis();
    println!(
        "PROOF: {} detections in {} ms (infer {} ms) on {w}x{h}",
        res.detections.len(),
        total_ms,
        res.millis
    );
    assert!(
        !res.detections.is_empty(),
        "no objects detected in test photo"
    );
    for d in res.detections.iter().take(8) {
        println!(
            "  - {} #{:>2} score={:.2} box=({:.0},{:.0},{:.0}x{:.0}) mask={}b",
            d.label,
            d.class_id,
            d.score,
            d.x,
            d.y,
            d.w,
            d.h,
            d.mask_png_base64.len()
        );
        assert!(!d.label.is_empty());
        assert!(d.score >= 0.35);
        assert!(d.w >= 2.0 && d.h >= 2.0);
        assert!(!d.mask_png_base64.is_empty());
        // mask PNG must decode to a non-empty bbox image
        use base64::Engine as _;
        let raw =
            base64::engine::general_purpose::STANDARD.decode(&d.mask_png_base64).unwrap();
        let mimg = image::load_from_memory(&raw).unwrap().to_luma8();
        assert!(mimg.width() >= 2 && mimg.height() >= 2);
        assert!(mimg.pixels().any(|p| p[0] > 10), "empty mask");
    }
}
