// PSD Studio - Core Engine entry point
// Fase 0: shell + IPC base. Fase 1: image IO + document model.
// Fase 2: selection/mask/adjust/filter/text/shape + PSD layer list.
// Fase 3: color management stub, RAW info, histogram.

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
            pro::cmd_image_histogram
        ])
        .run(tauri::generate_context!())
        .expect("error while running PSD Studio");
}
