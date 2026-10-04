use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{Emitter, Manager, State};

#[derive(Serialize, Clone)]
struct OpenedFile {
    name: String,
    path: String,
    text: String,
}

// a .panel file passed on the command line (Windows/Linux) or via an Apple Event (macOS)
// before the webview was ready to listen for it
#[derive(Default)]
struct PendingOpen(Mutex<Option<PathBuf>>);

// the commands take paths from the webview, so they only ever touch the file types the editor works with
const ALLOWED_EXTENSIONS: [&str; 4] = ["panel", "json", "yaml", "yml"];

fn check_extension(path: &Path) -> Result<(), String> {
    let ok = path
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| ALLOWED_EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()));
    if ok {
        Ok(())
    } else {
        Err(format!("unsupported file type: {}", path.display()))
    }
}

fn load(path: &Path) -> Result<OpenedFile, String> {
    check_extension(path)?;
    let text = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    Ok(OpenedFile {
        name: path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default(),
        path: path.to_string_lossy().into_owned(),
        text,
    })
}

#[tauri::command]
fn read_text(path: String) -> Result<OpenedFile, String> {
    load(Path::new(&path))
}

#[tauri::command]
fn write_text(path: String, text: String) -> Result<(), String> {
    // write next to the target and rename, so a crash mid-save never leaves a truncated file
    let target = PathBuf::from(&path);
    check_extension(&target)?;
    let mut tmp_name = target.file_name().map(OsString::from).unwrap_or_default();
    tmp_name.push(".tmp-save");
    let tmp = target.with_file_name(tmp_name);
    std::fs::write(&tmp, text).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &target).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        e.to_string()
    })
}

// WKWebView ignores window.print(), so the page asks the native side to open the print dialog
#[tauri::command]
fn print_page(webview: tauri::Webview) -> Result<(), String> {
    webview.print().map_err(|e| e.to_string())
}

#[tauri::command]
fn take_opened_file(pending: State<'_, PendingOpen>) -> Option<OpenedFile> {
    let path = pending.0.lock().ok()?.take()?;
    load(&path).ok()
}

fn panel_arg() -> Option<PathBuf> {
    std::env::args_os()
        .skip(1)
        .map(PathBuf::from)
        .find(|p| p.extension().is_some_and(|e| e == "panel") && p.is_file())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .manage(PendingOpen(Mutex::new(panel_arg())))
        .invoke_handler(tauri::generate_handler![read_text, write_text, take_opened_file, print_page])
        .build(tauri::generate_context!())
        .expect("error while building the panel editor");

    app.run(|handle, event| {
        #[cfg(any(target_os = "macos", target_os = "ios"))]
        if let tauri::RunEvent::Opened { urls } = &event {
            let Some(path) = urls.iter().find_map(|u| u.to_file_path().ok()) else {
                return;
            };
            // the event is only a nudge: on a cold start nobody listens yet, so the path waits in
            // PendingOpen and the frontend takes it once its listener is up
            if let Some(pending) = handle.try_state::<PendingOpen>() {
                if let Ok(mut slot) = pending.0.lock() {
                    *slot = Some(path);
                }
            }
            let _ = handle.emit("open-file", ());
        }
        let _ = (handle, event);
    });
}
