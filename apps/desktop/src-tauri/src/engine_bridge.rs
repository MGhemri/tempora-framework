// TEMPORA Desktop: development-only, fixed worker invocation.
// A production build fails closed until the Node runtime and dependencies are bundled.
use serde::Serialize;
use serde_json::{json, Value};
use std::fs;
use std::io::{Read, Write};
use std::path::Path;
use std::process::{Command, Stdio};
use std::thread;
use std::time::Duration;
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

#[cfg(debug_assertions)]
fn invoke_worker(request: &[u8], id: &str) -> Result<Value, String> {
    let desktop = Path::new(env!("CARGO_MANIFEST_DIR")).parent().ok_or("BRIDGE_PATH")?;
    let worker = desktop.join("bridge").join("worker.cjs");
    if !worker.is_file() { return Err("ENGINE_WORKER_MISSING".into()); }

    // Fixed executable and script; the WebView cannot choose executable, arguments or paths.
    let mut child = Command::new("node")
        .arg(&worker)
        .current_dir(desktop)
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

#[cfg(not(debug_assertions))]
fn invoke_worker(_request: &[u8], _id: &str) -> Result<Value, String> {
    // Do not silently use the user's Node installation in a production executable.
    Err("ENGINE_RUNTIME_NOT_BUNDLED".into())
}

pub fn validate_selected_corpus(path: &Path) -> Result<CanonicalValidation, String> {
    let (file_name, corpus) = document_payload(path)?;
    let health = invoke_worker(&message("health_01", "health", json!({}))?, "health_01")?;
    let version = health.get("engine_version").and_then(Value::as_str).ok_or("ENGINE_NO_VERSION")?;
    if version != "3.0.0" { return Err("ENGINE_VERSION_MISMATCH".into()); }

    let validation = invoke_worker(
        &message("validation_01", "corpus.validate", json!({"corpus": &corpus}))?, "validation_01"
    )?;
    let digest = invoke_worker(
        &message("digest_01", "corpus.digest", json!({"corpus": &corpus}))?, "digest_01"
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
