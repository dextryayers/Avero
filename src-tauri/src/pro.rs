use serde::Serialize;

#[derive(Serialize)]
pub struct PsdLayerInfo {
    pub index: usize,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub opacity: u8,
    pub visible: bool,
    pub kind: String,
}

#[tauri::command]
pub fn cmd_psd_layer_list(path: String) -> Result<Vec<PsdLayerInfo>, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let psd = psd::Psd::from_bytes(&bytes).map_err(|e| format!("PSD parse error: {e:?}"))?;
    let mut out = Vec::new();
    for (i, layer) in psd.layers().iter().enumerate() {
        out.push(PsdLayerInfo {
            index: i,
            name: layer.name().to_string(),
            width: layer.width() as u32,
            height: layer.height() as u32,
            opacity: layer.opacity(),
            visible: layer.visible(),
            kind: format!("{:?}", layer.blend_mode()),
        });
    }
    Ok(out)
}

#[derive(Serialize)]
pub struct RawInfo {
    pub is_raw: bool,
    pub format: String,
    pub file_size: u64,
    pub note: String,
}

#[tauri::command]
pub fn cmd_raw_info(path: String) -> Result<RawInfo, String> {
    let lower = path.to_lowercase();
    let raw_exts = [
        "cr2", "cr3", "nef", "arw", "raf", "rw2", "dng", "orf", "pef",
    ];
    let ext = lower.rsplit('.').next().unwrap_or("").to_string();
    let is_raw = raw_exts.contains(&ext.as_str());
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    Ok(RawInfo {
        is_raw,
        format: ext,
        file_size: meta.len(),
        note: if is_raw {
            "RAW terdeteksi. Fase 3: decode preview via pipeline umum, develop non-destructive di panel RAW.".to_string()
        } else {
            "Bukan file RAW.".to_string()
        },
    })
}

#[derive(Serialize)]
pub struct HistogramBin {
    pub r: Vec<u32>,
    pub g: Vec<u32>,
    pub b: Vec<u32>,
    pub lum: Vec<u32>,
    pub width: u32,
    pub height: u32,
}

#[tauri::command]
pub fn cmd_image_histogram(path: String) -> Result<HistogramBin, String> {
    let img = image::ImageReader::open(&path)
        .map_err(|e| e.to_string())?
        .with_guessed_format()
        .map_err(|e| e.to_string())?
        .decode()
        .map_err(|e| e.to_string())?;
    let small = img.thumbnail(256, 256);
    let rgb = small.to_rgb8();
    let (w, h) = (rgb.width(), rgb.height());
    let mut r = vec![0u32; 256];
    let mut g = vec![0u32; 256];
    let mut b = vec![0u32; 256];
    let mut lum = vec![0u32; 256];
    for p in rgb.pixels() {
        r[p[0] as usize] += 1;
        g[p[1] as usize] += 1;
        b[p[2] as usize] += 1;
        let l = (0.299 * p[0] as f32 + 0.587 * p[1] as f32 + 0.114 * p[2] as f32) as usize;
        lum[l.min(255)] += 1;
    }
    Ok(HistogramBin {
        r,
        g,
        b,
        lum,
        width: w,
        height: h,
    })
}
