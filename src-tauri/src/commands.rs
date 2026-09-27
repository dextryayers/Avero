use serde::Serialize;

#[derive(Serialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub os: String,
    pub arch: String,
}

#[tauri::command]
pub fn app_ping() -> AppInfo {
    AppInfo {
        name: "AVERO STUDIO".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
    }
}

#[tauri::command]
pub fn document_info() -> serde_json::Value {
    serde_json::json!({
        "maxCanvas": 16384,
        "supportedImport": ["png","jpg","jpeg","webp","bmp","tiff","tif","gif","psd","cr2","nef","arw","raf","dng"],
        "supportedExport": ["png","jpg","webp","tiff","bmp"],
        "colorModes": ["8bit-sRGB","8bit-AdobeRGB","8bit-ProPhoto","16bit-sim"],
        "phase": "phase-3-color-raw"
    })
}

#[tauri::command]
pub fn list_fonts_system() -> Vec<String> {
    // Phase 2: common cross-platform font list. Full OS enumeration via fontconfig/directwrite lands in 1.0.
    vec![
        "Inter".into(),
        "system-ui".into(),
        "Arial".into(),
        "Helvetica".into(),
        "Segoe UI".into(),
        "Ubuntu".into(),
        "Noto Sans".into(),
        "JetBrains Mono".into(),
        "Consolas".into(),
        "Georgia".into(),
        "Times New Roman".into(),
    ]
}
