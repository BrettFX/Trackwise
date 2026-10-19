use std::path::Path;
use std::process::Command;

/// Write an email draft (.eml) to a temp file and open it with the OS default
/// handler (Outlook, Mail, Thunderbird, ...). Under WSL the file is handed to
/// Windows via explorer.exe so the Windows default mail client picks it up.
#[tauri::command]
fn open_mail_draft(file_name: String, contents: String) -> Result<(), String> {
    let safe_name = Path::new(&file_name)
        .file_name()
        .and_then(|n| n.to_str())
        .filter(|n| !n.is_empty())
        .ok_or("invalid file name")?
        .to_string();

    let dir = std::env::temp_dir().join("trackwise-share");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(safe_name);
    std::fs::write(&path, contents).map_err(|e| e.to_string())?;

    open_with_default_app(&path)
}

#[cfg(target_os = "windows")]
fn open_with_default_app(path: &Path) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    Command::new("cmd")
        .args(["/C", "start", ""])
        .arg(path)
        .creation_flags(0x0800_0000) // CREATE_NO_WINDOW
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
fn open_with_default_app(path: &Path) -> Result<(), String> {
    Command::new("open").arg(path).spawn().map(|_| ()).map_err(|e| e.to_string())
}

#[cfg(all(unix, not(target_os = "macos")))]
fn open_with_default_app(path: &Path) -> Result<(), String> {
    if std::env::var_os("WSL_DISTRO_NAME").is_some() {
        let out = Command::new("wslpath")
            .arg("-w")
            .arg(path)
            .output()
            .map_err(|e| e.to_string())?;
        let win_path = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if out.status.success() && !win_path.is_empty() {
            // explorer.exe often exits non-zero even on success, so only spawn errors count.
            return Command::new("explorer.exe")
                .arg(win_path)
                .spawn()
                .map(|_| ())
                .map_err(|e| e.to_string());
        }
    }
    Command::new("xdg-open").arg(path).spawn().map(|_| ()).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![open_mail_draft])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
