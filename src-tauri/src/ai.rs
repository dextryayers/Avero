use serde::Serialize;
use std::path::PathBuf;

#[derive(Serialize)]
pub struct AiModelStatus {
    pub id: String,
    pub file: String,
    pub exists: bool,
    pub size: u64,
    pub dir: String,
}

fn model_dir() -> PathBuf {
    dirs_fallback()
}

fn dirs_fallback() -> PathBuf {
    if let Some(home) = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
    {
        home.join(".avero-studio").join("models")
    } else {
        PathBuf::from(".avero-studio-models")
    }
}

#[tauri::command]
pub fn cmd_ai_model_dir() -> Result<String, String> {
    let dir = model_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    dir.to_str()
        .map(|s| s.to_string())
        .ok_or("Invalid path".into())
}

#[tauri::command]
pub fn cmd_ai_models_status() -> Result<Vec<AiModelStatus>, String> {
    let dir = model_dir();
    let files = [
        "u2net.onnx",
        "sam-mobile.onnx",
        "lama.onnx",
        "esrgan-x4.onnx",
    ];
    let mut out = Vec::new();
    for f in files {
        let p = dir.join(f);
        let (exists, size) = match std::fs::metadata(&p) {
            Ok(m) => (true, m.len()),
            Err(_) => (false, 0),
        };
        out.push(AiModelStatus {
            id: f.replace(".onnx", ""),
            file: f.to_string(),
            exists,
            size,
            dir: dir.to_string_lossy().to_string(),
        });
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn model_dir_is_nonempty() {
        let d = model_dir().to_string_lossy().to_string();
        assert!(!d.is_empty());
    }

    #[test]
    fn model_status_lists_four() {
        let v = cmd_ai_models_status().unwrap_or_default();
        assert_eq!(v.len(), 4);
    }
}
