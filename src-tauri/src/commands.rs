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
        name: "PSD Studio".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
    }
}

#[tauri::command]
pub fn document_info() -> serde_json::Value {
    serde_json::json!({
        "maxCanvas": 16384,
        "supportedImport": ["png","jpg","jpeg","webp","bmp","tiff","tif","gif","psd"],
        "supportedExport": ["png","jpg","webp","tiff","bmp"],
        "colorModes": ["8bit-sRGB"],
        "phase": "fase-1-mvp"
    })
}

#[tauri::command]
pub fn list_fonts_system() -> Vec<String> {
    // Fase 1 stub: enumerasi font penuh masuk Fase 2.
    // Kembalikan list kosong agar frontend fallback ke system-ui.
    Vec::new()
}
