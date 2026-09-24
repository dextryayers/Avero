//! FFI ke native engine C (`image_ops.c`) dan C++ (`filters.cpp`).
//! Dipanggil dari Tauri command, lalu dari TypeScript.

use serde::{Deserialize, Serialize};

#[repr(C)]
extern "C" {
    fn avero_c_gray(rgba: *mut u8, len: usize);
    fn avero_c_invert(rgba: *mut u8, len: usize);
    fn avero_c_brightness(rgba: *mut u8, len: usize, amount: i32);
    fn avero_c_contrast(rgba: *mut u8, len: usize, amount: i32);
    fn avero_c_threshold(rgba: *mut u8, len: usize, level: i32);
    fn avero_c_desaturate(rgba: *mut u8, len: usize, amount: i32);
    fn avero_c_engine_name() -> *const core::ffi::c_char;
}

unsafe extern "C" {
    fn avero_box_blur(src: *const u8, dst: *mut u8, w: i32, h: i32, radius: i32);
    fn avero_sharpen(src: *const u8, dst: *mut u8, w: i32, h: i32, amount: f32);
    fn avero_unsharp_mask(src: *const u8, dst: *mut u8, w: i32, h: i32, amount: f32, radius: i32);
    fn avero_emboss(src: *const u8, dst: *mut u8, w: i32, h: i32);
    fn avero_motion_blur(src: *const u8, dst: *mut u8, w: i32, h: i32, radius: i32, angle_deg: f32);
    fn avero_engine_name_cpp() -> *const core::ffi::c_char;
}

// C++ namespace menghasilkan mangled symbol; beri wrapper C di sisi link
// lewat forward dari filters.cpp yang diekspor via extern "C" jika perlu.
// Untuk C++ kita pakai wrapper C yang di-declare di filters.hpp berupa
// fungsi namespace. Agar link stabil, kita panggil via shim C berikut:

#[no_mangle]
pub extern "C" fn avero_box_blur_shim(src: *const u8, dst: *mut u8, w: i32, h: i32, radius: i32) {
    cpp_box_blur(src, dst, w, h, radius);
}

#[no_mangle]
pub extern "C" fn avero_sharpen_shim(src: *const u8, dst: *mut u8, w: i32, h: i32, amount: f32) {
    cpp_sharpen(src, dst, w, h, amount);
}

#[no_mangle]
pub extern "C" fn avero_unsharp_shim(
    src: *const u8,
    dst: *mut u8,
    w: i32,
    h: i32,
    amount: f32,
    radius: i32,
) {
    cpp_unsharp(src, dst, w, h, amount, radius);
}

#[no_mangle]
pub extern "C" fn avero_emboss_shim(src: *const u8, dst: *mut u8, w: i32, h: i32) {
    cpp_emboss(src, dst, w, h);
}

#[no_mangle]
pub extern "C" fn avero_motion_blur_shim(
    src: *const u8,
    dst: *mut u8,
    w: i32,
    h: i32,
    radius: i32,
    angle_deg: f32,
) {
    cpp_motion_blur(src, dst, w, h, radius, angle_deg);
}

unsafe extern "C" {
    #[link_name = "avero::box_blur"]
    fn cpp_box_blur(src: *const u8, dst: *mut u8, w: i32, h: i32, radius: i32);
}

// Catatan: link_name C++ mangled tidak stabil antar toolchain.
// Gunakan file cxx bridge atau extern "C" di .cpp. Kita perbaiki dengan
// wrapper C yang diekspor dari filters.cpp.
