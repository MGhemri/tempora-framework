#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;

#[derive(Serialize)]
struct RuntimeInfo {
    app: &'static str,
    version: &'static str,
    platform: &'static str,
    engine: &'static str,
}

#[tauri::command]
fn runtime_info() -> RuntimeInfo {
    RuntimeInfo {
        app: "TEMPORA Studio",
        version: env!("CARGO_PKG_VERSION"),
        platform: std::env::consts::OS,
        engine: "not-connected",
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![runtime_info])
        .run(tauri::generate_context!())
        .expect("error while running TEMPORA Studio");
}
