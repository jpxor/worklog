#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod evidence;
mod mcp;
mod reminders;
mod storage;
mod system_trash;
use std::sync::Mutex;
use storage::Store;
use tauri::Manager;

#[tauri::command]
async fn mcp_control(
    action: String,
    config: Option<mcp::Config>,
    sharing: tauri::State<'_, std::sync::Arc<Mutex<mcp::Controller>>>,
    store: tauri::State<'_, Mutex<Store>>,
) -> Result<serde_json::Value, String> {
    let sharing = sharing.inner().clone();
    let workspace = store.lock().map_err(|_| "Store lock failed")?.shared();
    tauri::async_runtime::spawn_blocking(move || {
        sharing
            .lock()
            .map_err(|_| "MCP control lock failed")?
            .control(&action, config, workspace)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn dispatch(
    action: String,
    payload: serde_json::Value,
    state: tauri::State<'_, Mutex<Store>>,
) -> Result<serde_json::Value, String> {
    // Keep filesystem and Git work off the UI thread; one lock serializes mutations.
    let store = state
        .inner()
        .lock()
        .map_err(|_| "Storage lock failed")?
        .shared();
    tauri::async_runtime::spawn_blocking(move || {
        let mut guard = store
            .lock()
            .map_err(|_| "Storage lock failed".to_string())?;
        guard.dispatch(&action, payload)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn read_document(
    root: String,
    path: String,
    state: tauri::State<'_, Mutex<Store>>,
) -> Result<tauri::ipc::Response, String> {
    let store = state
        .inner()
        .lock()
        .map_err(|_| "Storage lock failed")?
        .shared();
    tauri::async_runtime::spawn_blocking(move || {
        let guard = store
            .lock()
            .map_err(|_| "Storage lock failed".to_string())?;
        guard
            .read_document(&root, &path)
            .map(tauri::ipc::Response::new)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn export_report(path: String, content: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || storage::write_export(&path, &content))
        .await
        .map_err(|e| e.to_string())?
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let path = app.path().app_data_dir()?;
            reminders::start(app.handle(), &path)?;
            app.manage(std::sync::Arc::new(Mutex::new(mcp::Controller::new(
                path.clone(),
            ))));
            app.manage(Mutex::new(Store::new(path)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            dispatch,
            export_report,
            read_document,
            mcp_control,
            reminders::reminder_settings
        ])
        .run(tauri::generate_context!())
        .expect("Failed to start WorkLog");
}
