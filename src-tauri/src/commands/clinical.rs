use crate::managers::audio::AudioRecordingManager;
use std::sync::Arc;
use tauri::{AppHandle, Manager};

#[tauri::command]
#[specta::specta]
pub fn clinical_toggle_recording(app: AppHandle) {
    crate::signal_handle::send_transcription_input(&app, "transcribe", "Consult workspace");
}

#[tauri::command]
#[specta::specta]
pub fn clinical_is_recording(app: AppHandle) -> bool {
    app.state::<Arc<AudioRecordingManager>>().is_recording()
}

/// Fixed loopback destination and disabled redirects keep clinical source text local.
#[tauri::command]
#[specta::specta]
pub async fn clinical_generate(
    model: String,
    system: String,
    prompt: String,
) -> Result<String, String> {
    if model.trim().is_empty() {
        return Err("A local model is required".into());
    }
    let client = reqwest::Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|_| "Could not initialise local inference".to_string())?;
    if model.contains(":cloud") {
        return Err("Cloud models are disabled in Consult".into());
    }
    let model_info: serde_json::Value = client
        .post("http://127.0.0.1:11434/api/show")
        .json(&serde_json::json!({ "model": model }))
        .send()
        .await
        .map_err(|_| "Local model unavailable".to_string())?
        .error_for_status()
        .map_err(|_| "Install the selected local model".to_string())?
        .json()
        .await
        .map_err(|_| "Invalid local model information".to_string())?;
    if model_info
        .get("remote_host")
        .and_then(|v| v.as_str())
        .is_some_and(|v| !v.is_empty())
    {
        return Err("Remote models are disabled in Consult".into());
    }
    let response = client
        .post("http://127.0.0.1:11434/api/chat")
        .json(
            &serde_json::json!({ "model": model, "stream": false, "messages": [
            { "role": "system", "content": system }, { "role": "user", "content": prompt }
        ], "options": { "temperature": 0 } }),
        )
        .send()
        .await
        .map_err(|_| {
            "Local model unavailable. Start Ollama and install the selected model.".to_string()
        })?;
    if !response.status().is_success() {
        return Err(format!(
            "Local inference returned HTTP {}",
            response.status()
        ));
    }
    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|_| "Invalid local model response".to_string())?;
    body["message"]["content"]
        .as_str()
        .map(String::from)
        .ok_or_else(|| "Missing local model output".into())
}

#[tauri::command]
#[specta::specta]
pub async fn clinical_deidentify(text: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|_| "Could not initialise OpenMed".to_string())?;
    let response = client
        .post("http://127.0.0.1:8766/deidentify")
        .json(&serde_json::json!({ "text": text }))
        .send()
        .await
        .map_err(|_| "Start the local OpenMed worker".to_string())?;
    if !response.status().is_success() {
        return Err("OpenMed request failed".into());
    }
    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|_| "Invalid OpenMed response".to_string())?;
    body["text"]
        .as_str()
        .map(String::from)
        .ok_or_else(|| "Missing redacted text".into())
}
