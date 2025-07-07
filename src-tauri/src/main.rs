// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;
use std::env;
use tauri::Manager;

#[tauri::command]
fn start_python_server() {
    std::thread::spawn(|| {
        // Get the current directory (src-tauri) and go up one level to project root
        let current_dir = env::current_dir().expect("Failed to get current directory");
        let project_root = current_dir.parent().expect("Failed to get project root");
        
        Command::new(".venv/bin/python")
            .arg("src/fidu_core/main.py")
            .current_dir(project_root)
            .spawn()
            .expect("Failed to start Python server");
    });
}

fn main() {
  tauri::Builder::default()
    .setup(|app| {
      start_python_server();
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![start_python_server])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
