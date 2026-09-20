// Prevents an extra console window on Windows in release. It has to be here,
// in the binary crate root, and not in `lib.rs`: `windows_subsystem` only
// reaches the linker for the crate being linked, and `mirror_lib` is compiled
// to an rlib/staticlib/cdylib with no link step for the executable, so an
// attribute there has no effect at all.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    mirror_lib::run()
}
