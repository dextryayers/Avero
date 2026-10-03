// AVERO STUDIO - Core Engine entry point
// Shell, IO, PSD, color, RAW, native C/C++, stabilisasi, segmentasi.

mod commands;
mod convert;
mod document;
mod io;
mod models;
mod native;
mod pro;
mod ram;
pub mod segment;
mod system;

use commands::{app_ping, document_info, list_fonts_system};
use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // Second launch (double-click while running): forward the .avx or image path.
            if let Some(path) = io::find_avx_arg(&argv) {
                let _ = app.emit("avero:open-avx-path", path);
            } else if let Some(path) = io::find_image_arg(&argv) {
                let _ = app.emit("avero:open-image-path", path);
            }
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            app_ping,
            document_info,
            list_fonts_system,
            io::cmd_open_image_info,
            io::cmd_decode_image_to_dataurl,
            io::cmd_save_dataurl_to_file,
            io::cmd_read_text_file,
            io::cmd_write_text_file,
            io::cmd_write_text_atomic,
            io::cmd_register_avx_association,
            io::cmd_avx_assoc_status,
            io::cmd_register_image_association,
            io::cmd_startup_file,
            io::cmd_startup_image,
            io::cmd_path_exists,
            io::cmd_ensure_dir,
            convert::cmd_probe_image,
            convert::cmd_convert_image,
            convert::cmd_convert_batch,
            convert::cmd_convert_cancel,
            convert::cmd_export_pixels,
            io::cmd_history_budget,
            io::cmd_data_hash,
            io::cmd_snapshot_hash,
            pro::cmd_psd_layer_list,
            pro::cmd_raw_info,
            pro::cmd_image_histogram,
            native::cmd_native_info,
            native::cmd_native_apply_op,
            native::cmd_native_apply_filter,
            native::cmd_native_histogram,
            native::cmd_native_stats,
            native::cmd_native_pipeline,
            native::cmd_native_pipeline_light,
            native::cmd_native_pipeline_tiled,
            native::cmd_gpu_info,
            native::cmd_native_memory_budget,
            native::cmd_native_benchmark,
            native::cmd_avx_codec_info,
            native::cmd_avx_native_hash,
            native::cmd_avx_validate,
            native::cmd_rle_roundtrip,
            native::cmd_render_caps,
            native::cmd_lut_map,
            ram::cmd_ram_budget,
            ram::cmd_tile_plan,
            ram::cmd_export_plan,
            segment::cmd_segment_model_path,
            segment::cmd_segment_objects,
            segment::cmd_segment_stuff,
            segment::cmd_segment_text,
            segment::cmd_segment_models_status,
            models::cmd_model_manifest,
            models::cmd_model_status,
            models::cmd_delete_model,
            models::cmd_download_model,
            models::cmd_cancel_model_download,
            system::cmd_system_profile,
            system::cmd_engine_recommend
        ])
        .run(tauri::generate_context!())
        .expect("error while running AVERO STUDIO");
}
