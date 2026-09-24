//! FFI ke native engine C (`image_ops.c`) dan C++ (`filters.cpp`).
//! Dipanggil dari Tauri command, lalu dari TypeScript.

use serde::{Deserialize, Serialize};

extern "C" {
    fn avero_c_gray(rgba: *mut u8, len: usize);
    fn avero_c_invert(rgba: *mut u8, len: usize);
    fn avero_c_brightness(rgba: *mut u8, len: usize, amount: i32);
    fn avero_c_contrast(rgba: *mut u8, len: usize, amount: i32);
    fn avero_c_threshold(rgba: *mut u8, len: usize, level: i32);
    fn avero_c_desaturate(rgba: *mut u8, len: usize, amount: i32);
    fn avero_c_engine_name() -> *const core::ffi::c_char;

    fn avero_cpp_box_blur(src: *const u8, dst: *mut u8, w: i32, h: i32, radius: i32);
    fn avero_cpp_sharpen(src: *const u8, dst: *mut u8, w: i32, h: i32, amount: f32);
    fn avero_cpp_unsharp(src: *const u8, dst: *mut u8, w: i32, h: i32, amount: f32, radius: i32);
    fn avero_cpp_emboss(src: *const u8, dst: *mut u8, w: i32, h: i32);
    fn avero_cpp_motion_blur(
        src: *const u8,
        dst: *mut u8,
        w: i32,
        h: i32,
        radius: i32,
        angle_deg: f32,
    );
    fn avero_cpp_engine_name() -> *const core::ffi::c_char;
}

fn cstr_to_string(p: *const core::ffi::c_char) -> String {
    if p.is_null() {
        return String::new();
    }
    unsafe { std::ffi::CStr::from_ptr(p).to_string_lossy().into_owned() }
}

fn check_rgba(rgba: &[u8]) -> Result<(), String> {
    if rgba.is_empty() {
        return Err("buffer kosong".into());
    }
    if rgba.len() % 4 != 0 {
        return Err(format!("len {} bukan kelipatan 4 (RGBA)", rgba.len()));
    }
    Ok(())
}

/// Operasi in-place C pada buffer RGBA8.
#[derive(Debug, Deserialize)]
#[serde(tag = "op", rename_all = "camelCase")]
pub enum NativeOp {
    Gray,
    Invert,
    Brightness { amount: i32 },
    Contrast { amount: i32 },
    Threshold { level: i32 },
    Desaturate { amount: i32 },
}

/// Operasi C++ yang butuh buffer sumber + tujuan (dua pass).
#[derive(Debug, Deserialize)]
#[serde(tag = "op", rename_all = "camelCase")]
pub enum NativeFilterOp {
    BoxBlur { radius: i32 },
    Sharpen { amount: f32 },
    Unsharp { amount: f32, radius: i32 },
    Emboss,
    MotionBlur { radius: i32, angle: f32 },
}

#[derive(Serialize)]
pub struct NativeInfo {
    pub c_engine: String,
    pub cpp_engine: String,
    pub languages: Vec<String>,
    pub ready: bool,
}

#[tauri::command]
pub fn cmd_native_info() -> NativeInfo {
    let c = cstr_to_string(unsafe { avero_c_engine_name() });
    let cpp = cstr_to_string(unsafe { avero_cpp_engine_name() });
    NativeInfo {
        c_engine: if c.is_empty() { "C core".into() } else { c },
        cpp_engine: if cpp.is_empty() { "C++ filters".into() } else { cpp },
        languages: vec!["C".into(), "C++".into(), "Rust".into(), "TypeScript".into()],
        ready: true,
    }
}

/// Jalankan operasi C in-place. Return buffer yang sama (sudah dimodifikasi).
#[tauri::command]
pub fn cmd_native_apply_op(rgba: Vec<u8>, op: NativeOp) -> Result<Vec<u8>, String> {
    check_rgba(&rgba)?;
    let mut buf = rgba;
    let len = buf.len();
    let ptr = buf.as_mut_ptr();
    unsafe {
        match op {
            NativeOp::Gray => avero_c_gray(ptr, len),
            NativeOp::Invert => avero_c_invert(ptr, len),
            NativeOp::Brightness { amount } => avero_c_brightness(ptr, len, amount.clamp(-100, 100)),
            NativeOp::Contrast { amount } => avero_c_contrast(ptr, len, amount.clamp(-100, 100)),
            NativeOp::Threshold { level } => avero_c_threshold(ptr, len, level.clamp(0, 255)),
            NativeOp::Desaturate { amount } => {
                avero_c_desaturate(ptr, len, amount.clamp(0, 100))
            }
        }
    }
    Ok(buf)
}

/// Jalankan filter C++. `width`/`height` wajib cocok dengan len = w*h*4.
#[tauri::command]
pub fn cmd_native_apply_filter(
    rgba: Vec<u8>,
    width: u32,
    height: u32,
    op: NativeFilterOp,
) -> Result<Vec<u8>, String> {
    check_rgba(&rgba)?;
    let w = width as i32;
    let h = height as i32;
    if w <= 0 || h <= 0 {
        return Err("dimensi tidak valid".into());
    }
    let expected = (w as usize) * (h as usize) * 4;
    if rgba.len() != expected {
        return Err(format!("len {} != w*h*4 {}", rgba.len(), expected));
    }

    let mut out = vec![0u8; rgba.len()];
    let src = rgba.as_ptr();
    let dst = out.as_mut_ptr();
    unsafe {
        match op {
            NativeFilterOp::BoxBlur { radius } => {
                avero_cpp_box_blur(src, dst, w, h, radius.clamp(0, 256))
            }
            NativeFilterOp::Sharpen { amount } => {
                avero_cpp_sharpen(src, dst, w, h, amount.clamp(0.0, 8.0))
            }
            NativeFilterOp::Unsharp { amount, radius } => avero_cpp_unsharp(
                src,
                dst,
                w,
                h,
                amount.clamp(0.0, 8.0),
                radius.clamp(1, 64),
            ),
            NativeFilterOp::Emboss => avero_cpp_emboss(src, dst, w, h),
            NativeFilterOp::MotionBlur { radius, angle } => {
                avero_cpp_motion_blur(src, dst, w, h, radius.clamp(1, 256), angle)
            }
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gray_darkens_color() {
        let mut px = vec![200u8, 100u8, 50u8, 255u8];
        let len = px.len();
        unsafe {
            avero_c_gray(px.as_mut_ptr(), len);
        }
        assert_eq!(px[0], px[1]);
        assert_eq!(px[1], px[2]);
        assert_eq!(px[3], 255);
    }

    #[test]
    fn reject_bad_len() {
        assert!(check_rgba(&[1, 2, 3]).is_err());
        assert!(check_rgba(&[1, 2, 3, 4]).is_ok());
    }
}
