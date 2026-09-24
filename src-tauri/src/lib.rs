// AVERO STUDIO - Core Engine entry point
// Fase 0-3: shell, IO, PSD, color, RAW.
// Fase 4: AI model dir + status offline.
// Fase 5-6: stabilisasi, test, rilis.

mod ai;
mod commands;
mod document;
mod io;
mod pro;

use commands::{app_ping, document_info, list_fonts_system};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            app_ping,
            document_info,
            list_fonts_system,
            io::cmd_open_image_info,
            io::cmd_decode_image_to_dataurl,
            io::cmd_save_dataurl_to_file,
            pro::cmd_psd_layer_list,
            pro::cmd_raw_info,
            pro::cmd_image_histogram,
            ai::cmd_ai_model_dir,
            ai::cmd_ai_models_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running AVERO STUDIO");
}
