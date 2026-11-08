mod engine_bridge;
#[cfg(test)]
mod visualization_contracts;
use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::Path;
use tauri_plugin_dialog::DialogExt;

const MAX_BYTES: u64 = 8 * 1024 * 1024;
const PREVIEW_LIMIT: usize = 7;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PreviewRow {
    id: String,
    title: String,
    kind: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DocumentPreview {
    file_name: String,
    format: String,
    bytes: u64,
    records: usize,
    sources: usize,
    assertions: usize,
    rows: Vec<PreviewRow>,
    note: String,
}

fn summarize_record(value: &Value) -> PreviewRow {
    let id = value
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or("—")
        .chars()
        .take(80)
        .collect();
    let title = value
        .get("title")
        .and_then(|v| {
            v.as_str().or_else(|| {
                v.as_object()
                    .and_then(|map| map.values().find_map(Value::as_str))
            })
        })
        .or_else(|| value.get("name").and_then(Value::as_str))
        .unwrap_or("Untitled / Sans titre")
        .chars()
        .take(140)
        .collect();
    let kind = value
        .get("kind")
        .and_then(Value::as_str)
        .or_else(|| value.get("type").and_then(Value::as_str))
        .unwrap_or("record")
        .chars()
        .take(40)
        .collect();
    PreviewRow { id, title, kind }
}

// The structural preview is not canonical validation. Generic fields take
// precedence; legacy ALNOP fields are explicit compatibility fallbacks.
fn preview_text(value: &Value) -> Option<&str> {
    if let Some(s) = value.as_str() {
        return if s.trim().is_empty() { None } else { Some(s) };
    }
    value.as_object().and_then(|map| {
        map.iter()
            .filter_map(|(_, v)| v.as_str())
            .find(|s| !s.trim().is_empty())
    })
}
fn summarize_feature(feature: &Value) -> PreviewRow {
    let properties = feature.get("properties").unwrap_or(&Value::Null);
    let select = |keys: &[&str]| -> Option<&str> {
        keys.iter().find_map(|key| properties.get(*key).and_then(preview_text))
    };
    let id = feature.get("id").and_then(Value::as_str)
        .or_else(|| properties.get("id").and_then(Value::as_str))
        .unwrap_or("—").chars().take(80).collect();
    let title = select(&["title", "name", "nom_operation"])
        .unwrap_or("Untitled / Sans titre").chars().take(140).collect();
    let kind = select(&["kind", "event_type", "type", "type_action"])
        .or_else(|| feature.get("geometry")
            .and_then(|geometry| geometry.get("type"))
            .and_then(Value::as_str))
        .unwrap_or("record").chars().take(40).collect();
    PreviewRow { id, title, kind }
}

fn parse_preview(file_name: String, bytes: &[u8]) -> Result<DocumentPreview, String> {
    if bytes.len() as u64 > MAX_BYTES {
        return Err("File exceeds the 8 MiB preview limit / Fichier trop volumineux".into());
    }
    let json: Value = serde_json::from_slice(bytes)
        .map_err(|_| "Invalid JSON document / Document JSON invalide".to_owned())?;
    let geo = json.get("type").and_then(Value::as_str) == Some("FeatureCollection");
    let values = if geo {
        json.get("features").and_then(Value::as_array)
    } else {
        json.as_array()
            .or_else(|| json.get("events").and_then(Value::as_array))
            .or_else(|| json.get("records").and_then(Value::as_array))
            .or_else(|| json.get("operations").and_then(Value::as_array))
    };
    let rows = values
        .map(|list| list.iter().take(PREVIEW_LIMIT).map(|item| {
            if geo { summarize_feature(item) } else { summarize_record(item) }
        }).collect())
        .unwrap_or_default();
    let count = values.map_or(0, Vec::len);
    let count_items = |key: &str| {
        json.get(key)
            .and_then(Value::as_array)
            .map_or(0, Vec::len)
    };
    Ok(DocumentPreview {
        file_name,
        format: if geo { "GeoJSON" } else { "JSON" }.into(),
        bytes: bytes.len() as u64,
        records: count,
        sources: count_items("sources"),
        assertions: count_items("claims") + count_items("assertions"),
        rows,
        note: "Structural preview only. This is NOT TEMPORA canonical validation or historical fact verification.".into(),
    })
}

fn read_selected(path: &Path) -> Result<DocumentPreview, String> {
    let ext = path.extension().and_then(|x| x.to_str()).unwrap_or("");
    if !matches!(ext.to_ascii_lowercase().as_str(), "json" | "geojson") {
        return Err("Select a .json or .geojson document / Sélectionnez un document JSON".into());
    }
    let metadata = fs::metadata(path).map_err(|_| "Cannot inspect selected file".to_owned())?;
    if !metadata.is_file() || metadata.len() > MAX_BYTES {
        return Err("File unavailable or larger than 8 MiB".into());
    }
    let bytes = fs::read(path).map_err(|_| "Cannot read selected file".to_owned())?;
    let file_name = path
        .file_name()
        .and_then(|x| x.to_str())
        .unwrap_or("document.json")
        .to_owned();
    parse_preview(file_name, &bytes)
}

#[tauri::command]
async fn select_document(app: tauri::AppHandle) -> Result<Option<DocumentPreview>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let selected = app
            .dialog()
            .file()
            .add_filter("Historical documents", &["json", "geojson"])
            .blocking_pick_file();
        match selected {
            Some(file) => {
                let path = file
                    .into_path()
                    .map_err(|_| "Only local file paths are supported".to_owned())?;
                read_selected(&path).map(Some)
            }
            None => Ok(None),
        }
    })
    .await
    .map_err(|_| "Native file operation failed".to_owned())?
}

// Native picker is the only input authority; no user-supplied path reaches the worker.
#[tauri::command]
async fn validate_corpus_native(app: tauri::AppHandle) -> Result<Option<engine_bridge::CanonicalValidation>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let selected = app.dialog().file()
            .add_filter("TEMPORA canonical corpus", &["json", "geojson"])
            .blocking_pick_file();
        match selected {
            Some(file) => {
                let path = file.into_path().map_err(|_| "LOCAL_FILE_ONLY".to_owned())?;
                engine_bridge::validate_selected_corpus(&path, &app).map(Some)
            }
            None => Ok(None),
        }
    }).await.map_err(|_| "ENGINE_TASK_FAILED".to_owned())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![select_document, validate_corpus_native])
        .run(tauri::generate_context!())
        .expect("Unable to start TEMPORA Desktop");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn previews_canonical_collection_without_modifying_it() {
        let source = br#"{"events":[{"id":"E1","title":{"en":"Synthetic event"}}],"sources":[{"id":"S1"}]}"#;
        let original = source.to_vec();
        let preview = parse_preview("sample.json".into(), source).unwrap();
        assert_eq!(preview.records, 1);
        assert_eq!(preview.sources, 1);
        assert_eq!(preview.rows[0].id, "E1");
        assert_eq!(source, original.as_slice());
    }

    #[test]
    fn rejects_invalid_json_and_oversized_documents() {
        assert!(parse_preview("broken.json".into(), b"{invalid").is_err());
        let oversized = vec![b' '; MAX_BYTES as usize + 1];
        assert!(parse_preview("huge.json".into(), &oversized).is_err());
    }

    #[test]
    fn generic_geojson_properties_take_priority_over_alnop_compatibility() {
        let source = br#"{"type":"FeatureCollection","features":[
          {"type":"Feature","id":"GEN_1","properties":{
            "title":{"en":"Synthetic event","es":"Evento sintetico"},
            "kind":"archival_record","nom_operation":"Legacy name","type_action":"legacy_kind"
          },"geometry":{"type":"Point","coordinates":[0,0]}},
          {"type":"Feature","properties":{"id":"OP_ALNOP",
            "nom_operation":"Operation fictive","type_action":"fictional_event"
          },"geometry":{"type":"Point","coordinates":[0,0]}}
        ]}"#;
        let preview = parse_preview("generic.geojson".into(), source).unwrap();
        assert_eq!(preview.records, 2);
        assert_eq!(preview.rows[0].id, "GEN_1");
        assert_eq!(preview.rows[0].title, "Synthetic event");
        assert_eq!(preview.rows[0].kind, "archival_record");
        assert_eq!(preview.rows[1].title, "Operation fictive");
        assert_eq!(preview.rows[1].kind, "fictional_event");
    }

    #[test]
    fn generic_record_collection_precedes_legacy_operations() {
        let source = br#"{"records":[{"id":"R1","title":"Generic record"}],
            "operations":[{"id":"O1","title":"Legacy operation"}]}"#;
        let preview = parse_preview("mixed.json".into(), source).unwrap();
        assert_eq!(preview.records, 1);
        assert_eq!(preview.rows[0].id, "R1");
    }

    #[test]
    fn interprets_geojson_features_as_preview_rows() {
        let source = br#"{"type":"FeatureCollection","features":[{"type":"Feature","id":"F1"}]}"#;
        let preview = parse_preview("places.geojson".into(), source).unwrap();
        assert_eq!(preview.format, "GeoJSON");
        assert_eq!(preview.records, 1);
    }
}
