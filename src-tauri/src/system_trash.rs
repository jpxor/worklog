use std::path::Path;

#[cfg(not(target_os = "windows"))]
pub fn move_to_bin(path: &Path) -> Result<(), String> {
    trash::delete(path).map_err(|error| error.to_string())
}

#[cfg(target_os = "windows")]
pub fn move_to_bin(path: &Path) -> Result<(), String> {
    // A fresh thread gives the Shell its own STA, independent of Tauri's worker
    // pool. RECYCLEONDELETE requires recycling rather than a silent hard delete.
    let path = path.canonicalize().map_err(|error| error.to_string())?;
    std::thread::spawn(move || {
        use windows::{
            core::HSTRING,
            Win32::{System::Com::*, UI::Shell::*},
        };
        struct ComGuard;
        impl Drop for ComGuard {
            fn drop(&mut self) {
                unsafe { CoUninitialize() }
            }
        }
        unsafe {
            CoInitializeEx(None, COINIT_APARTMENTTHREADED)
                .ok()
                .map_err(|error| error.to_string())?;
            let _com = ComGuard;
            let operation: IFileOperation =
                CoCreateInstance(&FileOperation, None, CLSCTX_INPROC_SERVER)
                    .map_err(|error| error.to_string())?;
            operation
                .SetOperationFlags(
                    FOF_NO_UI
                        | FOF_ALLOWUNDO
                        | FOF_WANTNUKEWARNING
                        | FOFX_RECYCLEONDELETE
                        | FOFX_EARLYFAILURE,
                )
                .map_err(|error| error.to_string())?;
            let raw = path.to_string_lossy();
            let shell_path = if let Some(unc) = raw.strip_prefix(r"\\?\UNC\") {
                format!(r"\\{unc}")
            } else {
                raw.strip_prefix(r"\\?\").unwrap_or(&raw).to_string()
            };
            let item: IShellItem = SHCreateItemFromParsingName(&HSTRING::from(shell_path), None)
                .map_err(|error| error.to_string())?;
            operation
                .DeleteItem(&item, None)
                .map_err(|error| error.to_string())?;
            operation
                .PerformOperations()
                .map_err(|error| error.to_string())?;
            if operation
                .GetAnyOperationsAborted()
                .map_err(|error| error.to_string())?
                .as_bool()
                || path.exists()
            {
                return Err("Windows could not move this item to the Recycle Bin".into());
            }
            Ok(())
        }
    })
    .join()
    .map_err(|_| "The Recycle Bin operation failed".to_string())?
}
