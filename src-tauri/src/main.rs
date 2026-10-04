// hides the extra console window on Windows release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    panel_editor_lib::run()
}
