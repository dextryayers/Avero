// AVERO STUDIO - Core Engine entry point
// Shell, IO, PSD, color, RAW, native C/C++, stabilisasi.

mod commands;
mod document;
mod io;
mod native;
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
            native::cmd_native_info,
            native::cmd_native_apply_op,
            native::cmd_native_apply_filter,
            native::cmd_native_histogram,
            native::cmd_native_stats,
            native::cmd_native_pipeline,
            native::cmd_native_benchmark
        ])
        .run(tauri::generate_context!())
        .expect("error while running AVERO STUDIO");
}
