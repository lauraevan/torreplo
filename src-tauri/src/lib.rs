use serde::{Deserialize, Serialize};
use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::time::Duration;
use url::Url;

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

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AddonStream {
    name: Option<String>,
    title: Option<String>,
    description: Option<String>,
    url: Option<String>,
    #[serde(rename = "infoHash")]
    info_hash: Option<String>,
    #[serde(rename = "fileIdx")]
    file_idx: Option<u64>,
    sources: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct AddonStreamResponse {
    streams: Vec<AddonStream>,
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

fn build_stream_endpoint(addon_url: &str, media_type: &str, id: &str) -> Result<Url, String> {
    let mut base = Url::parse(addon_url.trim()).map_err(|error| format!("Invalid addon URL: {error}"))?;

    if !matches!(base.scheme(), "http" | "https") {
        return Err("Addon URL must use http or https".into());
    }

    base.set_query(None);
    base.set_fragment(None);

    let mut path = base.path().trim_end_matches('/').to_string();
    if path.ends_with("/manifest.json") {
        path.truncate(path.len() - "/manifest.json".len());
    } else if path == "/manifest.json" {
        path.clear();
    }
    base.set_path(&path);

    {
        let mut segments = base
            .path_segments_mut()
            .map_err(|_| "Addon URL cannot be used as a base URL".to_string())?;
        segments.pop_if_empty();
        segments.push("stream");
        segments.push(media_type);
        segments.push(&format!("{id}.json"));
    }

    Ok(base)
}

#[tauri::command]
async fn resolve_addon_streams(
    addon_url: String,
    media_type: String,
    id: String,
) -> Result<Vec<AddonStream>, String> {
    let media_type = media_type.trim().to_lowercase();
    if !matches!(media_type.as_str(), "movie" | "series") {
        return Err("Media type must be movie or series".into());
    }

    let id = id.trim();
    if id.is_empty() {
        return Err("Enter a media or video ID".into());
    }

    let endpoint = build_stream_endpoint(&addon_url, &media_type, id)?;
    let client = reqwest::Client::builder()
        .user_agent("Torreplo/0.1")
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|error| format!("Could not create HTTP client: {error}"))?;

    let response = client
        .get(endpoint.clone())
        .send()
        .await
        .map_err(|error| format!("Addon request failed: {error}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Addon returned HTTP {} for {}",
            response.status(),
            endpoint
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("Could not read addon response: {error}"))?;

    if bytes.len() > 5 * 1024 * 1024 {
        return Err("Addon response is unexpectedly large".into());
    }

    let response: AddonStreamResponse = serde_json::from_slice(&bytes)
        .map_err(|error| format!("Addon returned invalid stream JSON: {error}"))?;

    Ok(response.streams)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            native_core_version,
            parse_magnet,
            resolve_addon_streams
        ])
        .run(tauri::generate_context!())
        .expect("error while running Torreplo");
}
