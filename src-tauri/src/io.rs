use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use serde::Serialize;
use std::io::Cursor;

#[derive(Serialize)]
pub struct ImageInfo {
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub file_size: u64,
    pub color_type: String,
}

fn detect_format(path: &str) -> String {
    let lower = path.to_lowercase();
    if lower.ends_with(".png") {
        "png".into()
    } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        "jpeg".into()
    } else if lower.ends_with(".webp") {
        "webp".into()
    } else if lower.ends_with(".bmp") {
        "bmp".into()
    } else if lower.ends_with(".tiff") || lower.ends_with(".tif") {
        "tiff".into()
    } else if lower.ends_with(".gif") {
        "gif".into()
    } else if lower.ends_with(".psd") {
        "psd".into()
    } else {
        "unknown".into()
    }
}

#[tauri::command]
pub fn cmd_open_image_info(path: String) -> Result<ImageInfo, String> {
    let format = detect_format(&path);

    if format == "psd" {
        let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
        let psd_file =
            psd::Psd::from_bytes(&bytes).map_err(|e| format!("PSD parse error: {e:?}"))?;
        let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
        return Ok(ImageInfo {
            width: psd_file.width(),
            height: psd_file.height(),
            format: "psd".into(),
            file_size: meta.len(),
            color_type: "rgba8".into(),
        });
    }

    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    let reader = image::ImageReader::open(&path).map_err(|e| e.to_string())?;
    let reader = reader.with_guessed_format().map_err(|e| e.to_string())?;
    let (w, h) = reader.into_dimensions().map_err(|e| e.to_string())?;
    Ok(ImageInfo {
        width: w,
        height: h,
        format,
        file_size: meta.len(),
        color_type: "rgba8".into(),
    })
}

#[tauri::command]
pub fn cmd_decode_image_to_dataurl(path: String, max_side: Option<u32>) -> Result<String, String> {
    let format = detect_format(&path);

    if format == "psd" {
        let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
        let psd_file =
            psd::Psd::from_bytes(&bytes).map_err(|e| format!("PSD parse error: {e:?}"))?;
        let w = psd_file.width();
        let h = psd_file.height();
        let rgba = psd_file
            .flatten_layers_rgba(&|(_, _)| true)
            .map_err(|e| format!("PSD flatten error: {e:?}"))?;
        let img = image::RgbaImage::from_raw(w, h, rgba).ok_or("PSD rasterize failed")?;
        let img = downscale_if_needed(image::DynamicImage::ImageRgba8(img), max_side);
        let mut buf = Cursor::new(Vec::new());
        img.write_to(&mut buf, image::ImageFormat::Png)
            .map_err(|e| e.to_string())?;
        let b64 = B64.encode(buf.into_inner());
        return Ok(format!("data:image/png;base64,{b64}"));
    }

    let mut img = image::ImageReader::open(&path)
        .map_err(|e| e.to_string())?
        .with_guessed_format()
        .map_err(|e| e.to_string())?
        .decode()
        .map_err(|e| e.to_string())?;
    img = downscale_if_needed(img, max_side);
    let mut buf = Cursor::new(Vec::new());
    img.write_to(&mut buf, image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;
    let b64 = B64.encode(buf.into_inner());
    Ok(format!("data:image/png;base64,{b64}"))
}

fn downscale_if_needed(img: image::DynamicImage, max_side: Option<u32>) -> image::DynamicImage {
    let limit = max_side.unwrap_or(2048).clamp(256, 4096);
    let (w, h) = (img.width(), img.height());
    let m = w.max(h);
    if m <= limit {
        return img;
    }
    let scale = limit as f32 / m as f32;
    let nw = ((w as f32 * scale) as u32).max(1);
    let nh = ((h as f32 * scale) as u32).max(1);
    img.resize(nw, nh, image::imageops::FilterType::Triangle)
}

#[tauri::command]
pub fn cmd_save_dataurl_to_file(data_url: String, path: String) -> Result<(), String> {
    let (_, b64) = data_url.split_once(",").ok_or("Invalid data URL")?;
    let bytes = B64.decode(b64.trim()).map_err(|e| e.to_string())?;
    let img = image::load_from_memory(&bytes).map_err(|e| e.to_string())?;
    let lower = path.to_lowercase();
    if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        img.save_with_format(&path, image::ImageFormat::Jpeg)
            .map_err(|e| e.to_string())?;
    } else if lower.ends_with(".webp") {
        img.save_with_format(&path, image::ImageFormat::WebP)
            .map_err(|e| e.to_string())?;
    } else if lower.ends_with(".bmp") {
        img.save_with_format(&path, image::ImageFormat::Bmp)
            .map_err(|e| e.to_string())?;
    } else if lower.ends_with(".tiff") || lower.ends_with(".tif") {
        img.save_with_format(&path, image::ImageFormat::Tiff)
            .map_err(|e| e.to_string())?;
    } else {
        img.save_with_format(&path, image::ImageFormat::Png)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
