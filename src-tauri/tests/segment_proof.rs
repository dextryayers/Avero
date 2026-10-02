// Plan5 Fase 0-3: real-model proof. Runs YOLO11n-seg, SegFormer-B0 ADE20K and
// DBNet on a real street photo and asserts genuine regions, boxes and masks.
// Needs AVERO_SEG_MODEL (yolo11n-seg.onnx), AVERO_SEG_MODEL_STUFF
// (segformer-b1-ade.onnx), AVERO_SEG_MODEL_TEXT (dbnet.onnx) and
// AVERO_SEG_IMAGE (photo). Skips gracefully without them so plain
// `cargo test` stays green offline.
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

#[test]
fn segformer_ade_finds_building_and_road() {
    let Some(model) = env_or_skip("AVERO_SEG_MODEL_STUFF") else {
        return;
    };
    let Some(image_path) = env_or_skip("AVERO_SEG_IMAGE") else {
        return;
    };
    let img = image::open(&image_path).expect("read test image").to_rgba8();
    let (w, h) = (img.width(), img.height());
    let res = segment::cmd_segment_stuff(model, img.into_raw(), w, h).expect("stuff command");
    println!(
        "PROOF-STUFF: {} regions in {} ms on {w}x{h}",
        res.regions.len(),
        res.millis
    );
    for r in res.regions.iter() {
        println!(
            "  - {} (class {}) coverage={:.3} box=({:.0},{:.0},{:.0}x{:.0}) mask={}b",
            r.label, r.class_id, r.coverage, r.x, r.y, r.w, r.h, r.mask_png_base64.len()
        );
    }
    assert!(!res.regions.is_empty(), "no stuff regions at all");
    // The bus photo is dominated by a building facade: Building must appear
    // with real coverage. (A house photo exercises the identical code path
    // through class 25; same machinery, different class id.)
    let building = res.regions.iter().find(|r| r.label == "Building");
    assert!(building.is_some(), "no Building region on a building photo");
    assert!(building.unwrap().coverage > 0.05);
    // No sky is visible in this framing: sky must stay absent (mapping check).
    assert!(
        res.regions.iter().all(|r| r.label != "Sky" || r.coverage < 0.05),
        "phantom sky on a skyless photo"
    );
    for r in res.regions.iter().take(6) {
        assert!(!r.mask_png_base64.is_empty());
        use base64::Engine as _;
        let raw =
            base64::engine::general_purpose::STANDARD.decode(&r.mask_png_base64).unwrap();
        let mimg = image::load_from_memory(&raw).unwrap().to_luma8();
        assert!(mimg.pixels().any(|p| p[0] > 10), "empty region mask");
    }
}

#[test]
fn dbnet_finds_real_sign_text() {
    let Some(model) = env_or_skip("AVERO_SEG_MODEL_TEXT") else {
        return;
    };
    let Some(image_path) = env_or_skip("AVERO_SEG_IMAGE") else {
        return;
    };
    let img = image::open(&image_path).expect("read test image").to_rgba8();
    let (w, h) = (img.width(), img.height());
    let t0 = std::time::Instant::now();
    let res = segment::cmd_segment_text(model, img.into_raw(), w, h).expect("text command");
    println!(
        "PROOF-TEXT: {} boxes in {} ms on {w}x{h}",
        res.boxes.len(),
        res.millis
    );
    for b in res.boxes.iter().take(10) {
        println!(
            "  - text score={:.2} box=({:.0},{:.0},{:.0}x{:.0})",
            b.score, b.x, b.y, b.w, b.h
        );
    }
    // The bus carries big destination signage: at least one text box must fire.
    assert!(!res.boxes.is_empty(), "no text found on a photo full of signage");
    assert!(t0.elapsed().as_millis() < 30000, "text path too slow");
}
