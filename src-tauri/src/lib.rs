use serde::{Deserialize, Serialize};
use std::ffi::{CStr, CString};
use std::os::raw::c_char;

#[derive(Debug, Serialize, Deserialize)]
struct MagnetInfo {
    info_hash: String,
    display_name: Option<String>,
    trackers: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct NativeError {
    error: String,
}

extern "C" {
    fn torreplo_core_version() -> *const c_char;
    fn torreplo_parse_magnet(input: *const c_char) -> *mut c_char;
    fn torreplo_free_string(value: *mut c_char);
}

#[tauri::command]
fn native_core_version() -> Result<String, String> {
    unsafe {
        let ptr = torreplo_core_version();
        if ptr.is_null() {
            return Err("C++ core returned a null version string".into());
        }
        Ok(CStr::from_ptr(ptr).to_string_lossy().into_owned())
    }
}

#[tauri::command]
fn parse_magnet(input: String) -> Result<MagnetInfo, String> {
    let input = CString::new(input).map_err(|_| "Magnet URI contains an invalid null byte".to_string())?;

    unsafe {
        let ptr = torreplo_parse_magnet(input.as_ptr());
        if ptr.is_null() {
            return Err("C++ core could not allocate a response".into());
        }

        let payload = CStr::from_ptr(ptr).to_string_lossy().into_owned();
        torreplo_free_string(ptr);

        if let Ok(error) = serde_json::from_str::<NativeError>(&payload) {
            return Err(error.error);
        }

        serde_json::from_str::<MagnetInfo>(&payload)
            .map_err(|error| format!("Invalid response from C++ core: {error}"))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![native_core_version, parse_magnet])
        .run(tauri::generate_context!())
        .expect("error while running Torreplo");
}
