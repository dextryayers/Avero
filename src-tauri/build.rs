// Compile native C + C++ image engine bersama binary Tauri.
fn main() {
    println!("cargo:rerun-if-changed=native/image_ops.c");
    println!("cargo:rerun-if-changed=native/image_ops.h");
    println!("cargo:rerun-if-changed=native/filters.cpp");
    println!("cargo:rerun-if-changed=native/filters.hpp");

    let mut c = cc::Build::new();
    c.file("native/image_ops.c")
        .include("native")
        .warnings(true)
        .opt_level(3)
        .flag_if_supported("-O3")
        .cargo_metadata(true);
    if cfg!(target_os = "windows") {
        c.define("NOMINMAX", None).define("WIN32_LEAN_AND_MEAN", None);
    }
    c.compile("avero_c");

    let mut cpp = cc::Build::new();
    cpp.file("native/filters.cpp")
        .include("native")
        .cpp(true)
        .std("c++17")
        .opt_level(3)
        .flag_if_supported("-O3")
        .flag_if_supported("-march=native")
        .cargo_metadata(true);
    if cfg!(target_os = "windows") {
        cpp.define("NOMINMAX", None).define("WIN32_LEAN_AND_MEAN", None);
    }
    cpp.compile("avero_cpp");

    tauri_build::build()
}
