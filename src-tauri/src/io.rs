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
    // HDR sources arrive as float buffers; tone-map so previews look right.
    img = crate::convert::tone_map_ldr(img);
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

// Data safety limits: prevent OOM and path traversal.
pub const MAX_TEXT_BYTES: usize = 200 * 1024 * 1024;
const ALLOWED_TEXT_EXT: [&str; 6] = [".avx", ".json", ".svg", ".txt", ".md", ".csv"];
const ALLOWED_IMAGE_EXT: [&str; 6] = [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"];

// Extensions allowed for text commands (.avx projects, SVG export, notes).
fn text_path_ok(path: &str) -> Result<(), String> {
    let p = path.trim();
    if p.is_empty() {
        return Err("Empty file path".into());
    }
    if p.len() > 1024 {
        return Err("File path too long".into());
    }
    if p.contains('\0') || p.chars().any(|c| c.is_control()) {
        return Err("File path contains invalid characters".into());
    }
    // Reject explicit traversal. Tauri save dialogs provide valid absolute
    // paths, but `..` segments are never needed for .avx/SVG/notes.
    let lower = p.to_lowercase().replace('\\', "/");
    if lower.split('/').any(|seg| seg == "..") {
        return Err("File path not allowed".into());
    }
    if !ALLOWED_TEXT_EXT.iter().any(|ext| lower.ends_with(ext)) {
        return Err("File format not supported for text save".into());
    }
    Ok(())
}

fn image_ext_ok(path: &str) -> Result<(), String> {
    let lower = path.to_lowercase();
    if ALLOWED_IMAGE_EXT.iter().any(|ext| lower.ends_with(ext)) {
        Ok(())
    } else {
        Err("Image format not supported (png/jpg/webp/bmp/tiff)".into())
    }
}

/// Dependency-free FNV-1a 64-bit. Used for .avx checksums and undo/redo
/// snapshot integrity so corruption is detected fast.
pub fn fnv1a_hex(bytes: &[u8]) -> String {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in bytes {
        h ^= *b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    format!("{h:016x}")
}

#[tauri::command]
pub fn cmd_write_text_file(path: String, contents: String) -> Result<(), String> {
    text_path_ok(&path)?;
    if contents.len() > MAX_TEXT_BYTES {
        return Err("Text payload exceeds 200MB limit".into());
    }
    if let Some(parent) = std::path::Path::new(&path).parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create folder: {e}"))?;
        }
    }
    std::fs::write(&path, contents).map_err(|e| format!("Failed to write file: {e}"))
}

#[tauri::command]
pub fn cmd_read_text_file(path: String) -> Result<String, String> {
    text_path_ok(&path)?;
    let meta = std::fs::metadata(&path).map_err(|e| format!("Failed to read file: {e}"))?;
    if meta.len() > MAX_TEXT_BYTES as u64 {
        return Err("File exceeds 200MB limit".into());
    }
    let bytes = std::fs::read(&path).map_err(|e| format!("Failed to read file: {e}"))?;
    String::from_utf8(bytes).map_err(|e| format!("File is not valid UTF-8 text: {e}"))
}

#[tauri::command]
pub fn cmd_write_text_atomic(path: String, contents: String) -> Result<(), String> {
    text_path_ok(&path)?;
    if contents.len() > MAX_TEXT_BYTES {
        return Err("Text payload exceeds 200MB limit".into());
    }
    let tmp = format!("{path}.tmp");
    if let Some(parent) = std::path::Path::new(&path).parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create folder: {e}"))?;
        }
    }
    std::fs::write(&tmp, &contents).map_err(|e| format!("Failed to write temp file: {e}"))?;
    // Validate temp size before replacing the original.
    let meta = std::fs::metadata(&tmp).map_err(|e| format!("Failed to verify temp file: {e}"))?;
    if meta.len() != contents.len() as u64 {
        let _ = std::fs::remove_file(&tmp);
        return Err("Temp file size mismatch, write aborted".into());
    }
    std::fs::rename(&tmp, &path).map_err(|e| format!("Failed to replace file: {e}"))?;
    Ok(())
}

/// Register the .avx extension as "Avero Project Design" so the file manager
/// Type column shows the real product name. Windows writes a per-user ProgID
/// under HKCU (no admin needed); other OSes rely on the installer bundle.
///
/// Icon policy: the .avx document icon IS the real Avero icon — the running
/// executable's own icon (built from logo.png / icon.ico). DefaultIcon points
/// at `"exe",0` so Explorer renders the authentic Avero mark, never a generic
/// text-file glyph.
#[tauri::command]
pub fn cmd_register_avx_association() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        register_avx_windows()?;
        notify_shell_assoc_changed();
        Ok("Avero Project Design registered for .avx".into())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok("File association is handled by the installer on this OS".into())
    }
}

/// Tell Explorer to drop its cached Type/Icon for changed associations.
/// Without this, the Type column keeps showing the stale "AVX File" label and
/// the old generic glyph until the user reboots or rebuilds the icon cache.
#[cfg(target_os = "windows")]
fn notify_shell_assoc_changed() {
    #[link(name = "shell32")]
    extern "system" {
        fn SHChangeNotify(wEventId: u32, uFlags: u32, dwItem1: *const core::ffi::c_void, dwItem2: *const core::ffi::c_void);
    }
    const SHCNE_ASSOCCHANGED: u32 = 0x0800_0000;
    const SHCNF_IDLIST: u32 = 0x0000;
    unsafe {
        SHChangeNotify(
            SHCNE_ASSOCCHANGED,
            SHCNF_IDLIST,
            core::ptr::null(),
            core::ptr::null(),
        );
    }
}

#[cfg(target_os = "windows")]
fn register_avx_windows() -> Result<(), String> {
    use winreg::{enums::*, RegKey};
    let exe = std::env::current_exe().map_err(|e| format!("Cannot locate app binary: {e}"))?;
    let exe_s = exe.to_string_lossy().to_string();
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    // 1) Extension -> stable ProgID. Never change this key name: existing
    //    installs, Open-With entries and the installer all point at it.
    let (ext, _) = hkcu
        .create_subkey("Software\\Classes\\.avx")
        .map_err(|e| format!("Registry write failed: {e}"))?;
    ext.set_value("", &"AveroProjectDesign")
        .map_err(|e| format!("Registry write failed: {e}"))?;
    // Content Type pins the MIME so Explorer treats .avx as our project
    // kind even if another program previously claimed the extension.
    ext.set_value("Content Type", &"application/x-avero-studio")
        .map_err(|e| format!("Registry write failed: {e}"))?;
    // PerceivedType stays empty on purpose: .avx is NOT text/image, so
    // Explorer must not preview it like a generic document.
    // 2) ProgID display: THIS string is what Explorer shows in the Type column.
    //    Must stay exactly "Avero Project Design".
    let (prog, _) = hkcu
        .create_subkey("Software\\Classes\\AveroProjectDesign")
        .map_err(|e| format!("Registry write failed: {e}"))?;
    prog.set_value("", &"Avero Project Design")
        .map_err(|e| format!("Registry write failed: {e}"))?;
    prog.set_value("FriendlyTypeName", &"Avero Project Design")
        .map_err(|e| format!("Registry write failed: {e}"))?;
    // 3) Document icon = the authentic Avero icon (exe index 0, built from
    //    logo.png -> icon.ico). Quoted path survives spaces in install dir.
    let (icon, _) = hkcu
        .create_subkey("Software\\Classes\\AveroProjectDesign\\DefaultIcon")
        .map_err(|e| format!("Registry write failed: {e}"))?;
    icon.set_value("", &format!("\"{exe_s}\",0"))
        .map_err(|e| format!("Registry write failed: {e}"))?;
    // 4) Open verb: double-click / Enter / Open-With launches the Studio.
    let (cmd, _) = hkcu
        .create_subkey("Software\\Classes\\AveroProjectDesign\\shell\\open\\command")
        .map_err(|e| format!("Registry write failed: {e}"))?;
    cmd.set_value("", &format!("\"{exe_s}\" \"%1\""))
        .map_err(|e| format!("Registry write failed: {e}"))?;
    let (open_label, _) = hkcu
        .create_subkey("Software\\Classes\\AveroProjectDesign\\shell\\open")
        .map_err(|e| format!("Registry write failed: {e}"))?;
    let _ = open_label.set_value("", &"Open with AVERO STUDIO");
    // Friendly app name shown in the Open-With dialog.
    let (app, _) = hkcu
        .create_subkey("Software\\Classes\\AveroProjectDesign\\Application")
        .map_err(|e| format!("Registry write failed: {e}"))?;
    let _ = app.set_value("ApplicationCompany", &"AVERO STUDIO");
    let _ = app.set_value("ApplicationName", &"AVERO STUDIO");
    // 5) OpenWithProgids: advertise without hijacking. Explorer keeps the
    //    user's default but always offers AVERO STUDIO in Open-With.
    let (owp, _) = hkcu
        .create_subkey("Software\\Classes\\.avx\\OpenWithProgids")
        .map_err(|e| format!("Registry write failed: {e}"))?;
    let _ = owp.set_value("AveroProjectDesign", &0u32);
    // 6) Capabilities registration so Settings > Apps > Default apps can list us.
    let app_path = format!("Software\\Classes\\Applications\\{}", exe
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "avero-studio.exe".to_string()));
    if let Ok((cap, _)) = hkcu.create_subkey(&app_path) {
        let _ = cap.set_value("FriendlyAppName", &"AVERO STUDIO");
    }
    if let Ok((supported, _)) = hkcu.create_subkey(format!("{app_path}\\SupportedTypes")) {
        let _ = supported.set_value(".avx", &"");
    }
    if let Ok((shell_open, _)) = hkcu.create_subkey(format!("{app_path}\\shell\\open\\command")) {
        let _ = shell_open.set_value("", &format!("\"{exe_s}\" \"%1\""));
    }
    Ok(())
}

/// First existing .avx path in a CLI arg list (double-click / Open With).
/// Pure helper so the rule is unit-tested; the command applies it to real args.
pub fn find_avx_arg(args: &[String]) -> Option<String> {
    for arg in args.iter().skip(1) {
        let t = arg.trim().trim_matches('"').to_string();
        if t.to_lowercase().ends_with(".avx") && std::path::Path::new(&t).exists() {
            return Some(t);
        }
    }
    None
}

const IMAGE_EXTS: &[&str] = &[
    "jpg", "jpeg", "png", "webp", "bmp", "tiff", "tif", "gif",
];

pub fn is_image_path(path: &str) -> bool {
    let lower = path.to_lowercase();
    IMAGE_EXTS.iter().any(|ext| lower.ends_with(&format!(".{ext}")))
}

pub fn find_image_arg(args: &[String]) -> Option<String> {
    for arg in args.iter().skip(1) {
        let t = arg.trim().trim_matches('"').to_string();
        if is_image_path(&t) && std::path::Path::new(&t).exists() {
            return Some(t);
        }
    }
    None
}

#[tauri::command]
pub fn cmd_startup_image() -> Option<String> {
    find_image_arg(&std::env::args().collect::<Vec<_>>())
}

#[tauri::command]
pub fn cmd_register_image_association() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        register_image_windows()?;
        Ok("Image file associations registered".into())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok("File association is handled by the installer on this OS".into())
    }
}

#[cfg(target_os = "windows")]
fn register_image_windows() -> Result<(), String> {
    use winreg::{enums::*, RegKey};
    let exe = std::env::current_exe().map_err(|e| format!("Cannot locate app binary: {e}"))?;
    let exe_s = exe.to_string_lossy().to_string();
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    // Non-invasive: NEVER overwrite the user's default .png/.jpg handler.
    // We only advertise AVERO STUDIO in Open-With via OpenWithProgids, so the
    // Type column of photos stays owned by the user's viewer.
    for ext in IMAGE_EXTS {
        if let Ok((owp, _)) = hkcu.create_subkey(&format!("Software\\Classes\\.{ext}\\OpenWithProgids")) {
            let _ = owp.set_value("AveroImageFile", &0u32);
        }
    }
    let (prog, _) = hkcu
        .create_subkey("Software\\Classes\\AveroImageFile")
        .map_err(|e| format!("Registry write failed: {e}"))?;
    prog.set_value("", &"Avero Image")
        .map_err(|e| format!("Registry write failed: {e}"))?;
    let (icon, _) = hkcu
        .create_subkey("Software\\Classes\\AveroImageFile\\DefaultIcon")
        .map_err(|e| format!("Registry write failed: {e}"))?;
    icon.set_value("", &format!("\"{exe_s}\",0"))
        .map_err(|e| format!("Registry write failed: {e}"))?;
    let (cmd, _) = hkcu
        .create_subkey("Software\\Classes\\AveroImageFile\\shell\\open\\command")
        .map_err(|e| format!("Registry write failed: {e}"))?;
    cmd.set_value("", &format!("\"{exe_s}\" \"%1\""))
        .map_err(|e| format!("Registry write failed: {e}"))?;
    notify_shell_assoc_changed();
    Ok(())
}

/// File the app was launched with (double-clicked .avx), if any.
#[tauri::command]
pub fn cmd_startup_file() -> Option<String> {
    find_avx_arg(&std::env::args().collect::<Vec<_>>())
}

#[derive(serde::Serialize)]
pub struct HistoryBudget {
    pub width: u32,
    pub height: u32,
    pub snapshot_mb: f64,
    pub max_history_full: u32,
    pub max_history_large: u32,
    pub recommended_cap: u32,
    pub tiled: bool,
}

#[tauri::command]
pub fn cmd_history_budget(width: u32, height: u32) -> Result<HistoryBudget, String> {
    let w = width.clamp(1, 16384);
    let h = height.clamp(1, 16384);
    let bytes = (w as u64) * (h as u64) * 4;
    let mb = bytes as f64 / 1024.0 / 1024.0;
    let large = (w as u64) * (h as u64) > 8 * 1024 * 1024;
    Ok(HistoryBudget {
        width: w,
        height: h,
        snapshot_mb: mb,
        max_history_full: 15,
        max_history_large: 8,
        recommended_cap: if large { 8 } else { 15 },
        tiled: large || mb > 16.0,
    })
}

#[tauri::command]
pub fn cmd_data_hash(contents: String) -> String {
    fnv1a_hex(contents.as_bytes())
}

/// Check whether a path exists (used to pick a collision-free project folder name).
#[tauri::command]
pub fn cmd_path_exists(path: String) -> bool {
    if path.trim().is_empty() || path.len() > 1024 {
        return false;
    }
    std::path::Path::new(&path).exists()
}

/// Create the dedicated project folder (called on Create New Project).
/// Creates the folder + an `images/` subfolder as the home for project images.
/// Menolak path kosong, karakter kontrol, dan traversal `..`.
#[tauri::command]
pub fn cmd_ensure_dir(path: String) -> Result<String, String> {
    let p = path.trim();
    if p.is_empty() {
        return Err("Empty folder path".into());
    }
    if p.len() > 1024 {
        return Err("Folder path too long".into());
    }
    if p.contains('\0') || p.chars().any(|c| c.is_control()) {
        return Err("Folder path contains invalid characters".into());
    }
    let lower = p.to_lowercase().replace('\\', "/");
    if lower.split('/').any(|seg| seg == "..") {
        return Err("Folder path not allowed".into());
    }
    std::fs::create_dir_all(p).map_err(|e| format!("Failed to create folder: {e}"))?;
    // Dedicated images folder, like Word keeps assets inside the project folder.
    let images = std::path::Path::new(p).join("images");
    std::fs::create_dir_all(&images).map_err(|e| format!("Failed to create images folder: {e}"))?;
    Ok(p.to_string())
}

#[tauri::command]
pub fn cmd_snapshot_hash(rgba: Vec<u8>) -> Result<String, String> {
    if rgba.is_empty() || rgba.len() % 4 != 0 {
        return Err("Invalid RGBA buffer".into());
    }
    if rgba.len() > 256 * 1024 * 1024 {
        return Err("Snapshot exceeds 256MB limit".into());
    }
    Ok(fnv1a_hex(&rgba))
}

#[tauri::command]
pub fn cmd_save_dataurl_to_file(data_url: String, path: String) -> Result<(), String> {
    image_ext_ok(&path)?;
    let (_, b64) = data_url.split_once(",").ok_or("Invalid data URL")?;
    if b64.len() > 110_000_000 {
        return Err("Image payload exceeds size limit".into());
    }
    let bytes = B64.decode(b64.trim()).map_err(|e| e.to_string())?;
    if bytes.len() > 80_000_000 {
        return Err("Decoded image exceeds 80MB limit".into());
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_file_roundtrip_avx() {
        let dir = std::env::temp_dir().join("avero-avx-io-test");
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("roundtrip.avx");
        let payload = "{\"magic\":\"AVX1\",\"version\":1}";
        cmd_write_text_file(path.to_string_lossy().into(), payload.into()).unwrap();
        let back = cmd_read_text_file(path.to_string_lossy().into()).unwrap();
        assert_eq!(back, payload);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn text_file_rejects_unknown_extension() {
        assert!(cmd_write_text_file("test.exe".into(), "x".into()).is_err());
        assert!(cmd_read_text_file("test.exe".into()).is_err());
        assert!(cmd_write_text_file("".into(), "x".into()).is_err());
    }

    #[test]
    fn text_file_read_missing_file_fails() {
        let path = std::env::temp_dir().join("avero-missing.avx");
        assert!(cmd_read_text_file(path.to_string_lossy().into()).is_err());
    }

    #[test]
    fn find_avx_arg_picks_existing_avx_only() {
        let dir = std::env::temp_dir().join("avero-avx-arg-test");
        std::fs::create_dir_all(&dir).unwrap();
        let good = dir.join("project.avx");
        std::fs::write(&good, "x").unwrap();
        let gs = good.to_string_lossy().to_string();
        // skips exe itself, ignores non-avx and missing files
        assert_eq!(
            find_avx_arg(&["app".into(), "notes.txt".into(), gs.clone()]),
            Some(gs.clone())
        );
        assert_eq!(find_avx_arg(&["app".into(), "notes.txt".into()]), None);
        assert_eq!(
            find_avx_arg(&["app".into(), "C:\\nope\\missing.avx".into()]),
            None
        );
        // quoted paths from Windows shell
        assert_eq!(
            find_avx_arg(&["app".into(), format!("\"{gs}\"")]),
            Some(gs)
        );
        let _ = std::fs::remove_file(&good);
    }
}
