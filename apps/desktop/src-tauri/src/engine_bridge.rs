// TEMPORA Desktop: fixed Node worker invocation, bundled for Windows release.
// This module never accepts executable paths or commands from the WebView.
use serde::Serialize;
use serde_json::{json, Value};
use std::fs;
use std::io::{Read, Write};
use std::path::Path;
use std::process::{Command, Stdio};
use std::thread;
use std::time::Duration;
use tauri::Manager;
use wait_timeout::ChildExt;

const MAX_DOCUMENT: u64 = 3 * 1024 * 1024;
const MAX_REQUEST: usize = 4 * 1024 * 1024;
const MAX_OUTPUT: u64 = 3 * 256 * 1024 + 4096;
const WORKER_TIMEOUT: Duration = Duration::from_secs(12);
const PROTOCOL: &str = "1.0.0";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CanonicalValidation {
    pub file_name: String,
    pub engine_version: String,
    pub valid: bool,
    pub errors: Vec<Value>,
    pub warnings: Vec<Value>,
    pub sha256: String,
    pub note: String,
    pub overview: ResearchOverview,
}

// Bounded structural evidence overview for the scientific workspace.
// The canonical validity decision continues to come ONLY from TEMPORA Engine.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EvidenceRow {
    pub id: String,
    pub title: String,
    pub status: String,
    pub evidence_count: usize,
    pub source_refs: Vec<String>,
    pub subject_ref: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResearchOverview {
    pub event_count: usize,
    pub source_count: usize,
    pub claim_count: usize,
    pub unsupported_claim_count: usize,
    pub events: Vec<EvidenceRow>,
    pub sources: Vec<EvidenceRow>,
    pub claims: Vec<EvidenceRow>,
}

fn safe_label(value: Option<&str>) -> String {
    value.unwrap_or("—").chars().take(140).collect()
}

fn overview_rows(corpus: &Value, key: &str) -> Vec<EvidenceRow> {
    corpus.get(key).and_then(Value::as_array).into_iter()
        .flat_map(|items| items.iter().take(20))
        .map(|item| {
            let title = item.get("title").and_then(|title| {
                title.as_str().or_else(|| title.as_object()
                    .and_then(|translations| translations.values().find_map(Value::as_str)))
            });
            EvidenceRow {
                id: safe_label(item.get("id").and_then(Value::as_str)),
                title: safe_label(title.or_else(|| item.get("predicate").and_then(Value::as_str))),
                status: safe_label(item.get("assertion_status").or_else(|| item.get("editorial_status")).and_then(Value::as_str)),
                evidence_count: item.pointer("/provenance/evidence").and_then(Value::as_array).map_or(0, Vec::len),
                source_refs: item.pointer("/provenance/evidence").and_then(Value::as_array)
                    .into_iter().flat_map(|evidence| evidence.iter().take(20))
                    .filter_map(|entry| entry.pointer("/source/id").and_then(Value::as_str))
                    .map(|id| safe_label(Some(id))).collect(),
                subject_ref: item.pointer("/subject/id").and_then(Value::as_str).map(|id| safe_label(Some(id))),
            }
        }).collect()
}

fn research_overview(corpus: &Value) -> ResearchOverview {
    let count = |key: &str| corpus.get(key).and_then(Value::as_array).map_or(0, Vec::len);
    let unsupported_claim_count = corpus.get("claims").and_then(Value::as_array)
        .map_or(0, |claims| claims.iter().filter(|claim| {
            claim.pointer("/provenance/evidence").and_then(Value::as_array).map_or(true, Vec::is_empty)
        }).count());
    ResearchOverview {
        event_count: count("events"),
        source_count: count("sources"),
        claim_count: count("claims"),
        unsupported_claim_count,
        events: overview_rows(corpus, "events"),
        sources: overview_rows(corpus, "sources"),
        claims: overview_rows(corpus, "claims"),
    }
}

fn document_payload(path: &Path) -> Result<(String, Value), String> {
    let extension = path.extension().and_then(|s| s.to_str()).unwrap_or("").to_ascii_lowercase();
    if extension != "json" && extension != "geojson" {
        return Err("INVALID_EXTENSION: Select a JSON or GeoJSON file".into());
    }
    let metadata = fs::metadata(path).map_err(|_| "FILE_UNAVAILABLE".to_owned())?;
    if !metadata.is_file() || metadata.len() == 0 || metadata.len() > MAX_DOCUMENT {
        return Err("DOCUMENT_LIMIT: file must be 1 byte to 3 MiB".into());
    }
    let bytes = fs::read(path).map_err(|_| "FILE_READ_FAILED".to_owned())?;
    if bytes.len() as u64 > MAX_DOCUMENT { return Err("DOCUMENT_LIMIT".into()); }
    let corpus: Value = serde_json::from_slice(&bytes).map_err(|_| "INVALID_JSON".to_owned())?;
    if !corpus.is_object() { return Err("INVALID_CORPUS: expected JSON object".into()); }
    let name = path.file_name().and_then(|s| s.to_str()).unwrap_or("document.json").to_owned();
    Ok((name, corpus))
}

fn message(id: &str, operation: &str, payload: Value) -> Result<Vec<u8>, String> {
    let mut bytes = serde_json::to_vec(&json!({
        "protocol_version": PROTOCOL,
        "request_id": id,
        "operation": operation,
        "payload": payload,
    })).map_err(|_| "REQUEST_SERIALIZATION_FAILED".to_owned())?;
    if bytes.len() > MAX_REQUEST { return Err("FRAME_LIMIT: request exceeds 4 MiB".into()); }
    bytes.push(b'\n');
    Ok(bytes)
}

fn parse_response(stdout: &[u8], expected_id: &str) -> Result<Value, String> {
    if stdout.len() as u64 > MAX_OUTPUT { return Err("RESPONSE_LIMIT".into()); }
    let lines: Vec<&[u8]> = stdout.split(|b| *b == b'\n').filter(|line| !line.is_empty()).collect();
    if lines.len() != 1 { return Err("PROTOCOL_FRAME_COUNT".into()); }
    let response: Value = serde_json::from_slice(lines[0]).map_err(|_| "PROTOCOL_INVALID_JSON".to_owned())?;
    if response.get("protocol_version").and_then(Value::as_str) != Some(PROTOCOL)
        || response.get("request_id").and_then(Value::as_str) != Some(expected_id) {
        return Err("PROTOCOL_MISMATCH".into());
    }
    if response.get("ok").and_then(Value::as_bool) != Some(true) {
        let code = response.pointer("/error/code").and_then(Value::as_str).unwrap_or("WORKER_REJECTED");
        return Err(format!("ENGINE_{code}"));
    }
    response.get("result").cloned().ok_or_else(|| "PROTOCOL_MISSING_RESULT".into())
}

fn engine_runtime(app: &tauri::AppHandle) -> Result<(std::path::PathBuf, std::path::PathBuf, std::path::PathBuf), String> {
    if cfg!(debug_assertions) {
        let desktop = Path::new(env!("CARGO_MANIFEST_DIR")).parent().ok_or("BRIDGE_PATH")?;
        let worker = desktop.join("bridge").join("worker.cjs");
        if !worker.is_file() { return Err("ENGINE_WORKER_MISSING".into()); }
        return Ok((std::path::PathBuf::from("node"), worker, desktop.to_path_buf()));
    }
    #[cfg(target_os = "windows")]
    {
        let resource = app.path().resource_dir().map_err(|_| "ENGINE_RESOURCE_UNAVAILABLE")?;
        let runtime = resource.join("engine");
        let node = runtime.join("node.exe");
        let worker = runtime.join("worker.cjs");
        let package = runtime.join("node_modules").join("tempora-framework").join("package.json");
        if !node.is_file() || !worker.is_file() || !package.is_file() {
            return Err("ENGINE_RUNTIME_NOT_BUNDLED".into());
        }
        return Ok((node, worker, runtime));
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Err("ENGINE_RUNTIME_NOT_BUNDLED".into())
    }
}

fn invoke_worker(request: &[u8], id: &str, app: &tauri::AppHandle) -> Result<Value, String> {
    let (node, worker, runtime) = engine_runtime(app)?;
    // Fixed executable and worker script: UI controls neither executable nor arguments.
    let mut child = Command::new(&node)
        .arg(&worker)
        .current_dir(&runtime)
        .env_remove("NODE_OPTIONS")
        .env_remove("NODE_PATH")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| "ENGINE_NODE_NOT_INSTALLED".to_owned())?;
    let stdout = child.stdout.take().ok_or("ENGINE_STDOUT_MISSING")?;
    let reader = thread::spawn(move || {
        let mut output = Vec::new();
        stdout.take(MAX_OUTPUT + 1).read_to_end(&mut output).map(|_| output)
    });

    let write_result = child.stdin.take().ok_or("ENGINE_STDIN_MISSING")?
        .write_all(request);
    if write_result.is_err() {
        let _ = child.kill();
        let _ = child.wait();
        let _ = reader.join();
        return Err("ENGINE_WRITE_FAILED".into());
    }
    let status = child.wait_timeout(WORKER_TIMEOUT).map_err(|_| "ENGINE_WAIT_FAILED".to_owned())?;
    let status = match status {
        Some(status) => status,
        None => {
            let _ = child.kill();
            let _ = child.wait();
            let _ = reader.join();
            return Err("ENGINE_TIMEOUT".into());
        }
    };
    let output = reader.join().map_err(|_| "ENGINE_READ_FAILED".to_owned())?
        .map_err(|_| "ENGINE_READ_FAILED".to_owned())?;
    if !status.success() { return Err("ENGINE_EXIT_FAILED".into()); }
    parse_response(&output, id)
}

pub fn validate_selected_corpus(path: &Path, app: &tauri::AppHandle) -> Result<CanonicalValidation, String> {
    let (file_name, corpus) = document_payload(path)?;
    let health = invoke_worker(&message("health_01", "health", json!({}))?, "health_01", app)?;
    let version = health.get("engine_version").and_then(Value::as_str).ok_or("ENGINE_NO_VERSION")?;
    if version != "3.0.0" { return Err("ENGINE_VERSION_MISMATCH".into()); }

    let validation = invoke_worker(
        &message("validation_01", "corpus.validate", json!({"corpus": &corpus}))?, "validation_01", app
    )?;
    let digest = invoke_worker(
        &message("digest_01", "corpus.digest", json!({"corpus": &corpus}))?, "digest_01", app
    )?;
    let valid = validation.get("valid").and_then(Value::as_bool).ok_or("ENGINE_INVALID_RESULT")?;
    let errors = validation.get("errors").and_then(Value::as_array).cloned().ok_or("ENGINE_NO_DIAGNOSTICS")?;
    let warnings = validation.get("warnings").and_then(Value::as_array).cloned().unwrap_or_default();
    let sha256 = digest.get("sha256").and_then(Value::as_str).ok_or("ENGINE_NO_DIGEST")?.to_owned();
    if sha256.len() != 64 || !sha256.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("ENGINE_INVALID_DIGEST".into());
    }
    Ok(CanonicalValidation {
        file_name, engine_version: version.to_owned(), valid, errors, warnings, sha256,
        note: "Canonical schema validation only; historical claims still require source review.".into(),
        overview: research_overview(&corpus),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_response_with_wrong_request_id_or_untrusted_frame() {
        assert!(parse_response(br#"{"protocol_version":"1.0.0","request_id":"different","ok":true,"result":{}}"#, "expected").is_err());
        assert!(parse_response(b"{}\n{}\n", "id").is_err());
    }
    #[test]
    fn request_has_fixed_version_and_size_bound() {
        let result = message("abc_123", "health", json!({})).unwrap();
        let v: Value = serde_json::from_slice(&result).unwrap();
        assert_eq!(v["protocol_version"], PROTOCOL);
        assert_eq!(v["request_id"], "abc_123");
        assert!(message("id", "corpus.digest", json!({"x":"a".repeat(4 * 1024 * 1024)})).is_err());
    }
    #[test]
    fn scientific_overview_is_bounded_and_never_guesses_historical_truth() {
        let source = json!({
            "events": [{"id":"E1","title":{"fr":"Événement fictif"},"editorial_status":"proposed",
                "provenance":{"evidence":[]}}],
            "sources": [{"id":"S1","title":{"fr":"Source fictive"},"provenance":{"evidence":[]}}],
            "claims": [{"id":"C1","predicate":"unknown","assertion_status":"unverified",
                "provenance":{"evidence":[]}}]
        });
        let overview = research_overview(&source);
        assert_eq!(overview.event_count, 1);
        assert_eq!(overview.source_count, 1);
        assert_eq!(overview.claim_count, 1);
        assert_eq!(overview.unsupported_claim_count, 1);
        assert_eq!(overview.events[0].title, "Événement fictif");
        assert_eq!(overview.claims[0].status, "unverified");
        assert!(overview.claims[0].source_refs.is_empty());
    }
    #[test]
    fn scientific_overview_links_only_declared_references() {
        let corpus = json!({"claims":[{"id":"C1","subject":{"id":"E1"},
            "provenance":{"evidence":[{"source":{"id":"S1"}},{"source":{"id":"S2"}}]}}]});
        let overview = research_overview(&corpus);
        assert_eq!(overview.claims[0].subject_ref.as_deref(), Some("E1"));
        assert_eq!(overview.claims[0].source_refs, vec!["S1", "S2"]);
        assert_eq!(overview.claims[0].evidence_count, 2);
    }
    #[test]
    fn scientific_overview_limits_rows_to_twenty() {
        let corpus = json!({"events": (0..40).map(|n| json!({"id":n.to_string()})).collect::<Vec<_>>()});
        let overview = research_overview(&corpus);
        assert_eq!(overview.event_count, 40);
        assert_eq!(overview.events.len(), 20);
    }
    #[test]
    fn malformed_or_oversized_documents_are_not_read_as_corpora() {
        let dir = std::env::temp_dir().join(format!("tempora-engine-test-{}", std::process::id()));
        let _ = fs::create_dir_all(&dir);
        let file = dir.join("bad.json");
        fs::write(&file, b"this is not JSON").unwrap();
        assert!(document_payload(&file).is_err());
        let _ = fs::remove_file(file);
        let _ = fs::remove_dir(dir);
    }
}
