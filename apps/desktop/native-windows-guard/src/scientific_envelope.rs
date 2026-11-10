//! Read-only preflight for an SDK-approved TEMPORA canonical v3 transaction.
//! Never creates, renames, overwrites, publishes or approves a transaction.
//! This checks the byte transport and journal/identity relationship, NOT the
//! SDK's canonical semantic digest, Windows atomicity or power-loss durability.
use serde::Deserialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;

const LIMIT: u64 = 16 * 1024 * 1024;
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Identity {
    batch_id: String,
    source_sha256: String,
    base_sha256: String,
    mapping_sha256: String,
    output_sha256: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Envelope {
    schema_version: String,
    identity: Identity,
    corpus_file_sha256: String,
    journal_file_sha256: String,
    sdk_validated: bool,
    scientific_approval: bool,
    published: bool,
}
fn sha256(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn is_sha(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
}
fn bounded_json(dir: &Path, name: &str) -> Result<Vec<u8>, &'static str> {
    let target = dir.join(name);
    let metadata = fs::symlink_metadata(&target).map_err(|_| "NATIVE_ENVELOPE_FILE_MISSING")?;
    if !metadata.file_type().is_file() || metadata.len() == 0 || metadata.len() > LIMIT {
        return Err("NATIVE_ENVELOPE_FILE_UNSAFE");
    }
    // File may grow after metadata: read at most LIMIT+1 bytes, never read_to_end.
    let mut reader = std::io::BufReader::new(
        fs::File::open(&target).map_err(|_| "NATIVE_ENVELOPE_FILE_UNSAFE")?
    );
    let mut bytes = Vec::new();
    use std::io::Read;
    reader.take(LIMIT + 1).read_to_end(&mut bytes)
        .map_err(|_| "NATIVE_ENVELOPE_READ_FAILED")?;
    if bytes.is_empty() || bytes.len() as u64 > LIMIT {
        return Err("NATIVE_ENVELOPE_FILE_LIMIT");
    }
    Ok(bytes)
}
pub struct VerifiedTransport {
    pub corpus: Vec<u8>,
    pub journal: Vec<u8>,
    pub envelope: Vec<u8>,
}
pub fn load_verified(dir: &Path) -> Result<VerifiedTransport, &'static str> {
    // Check every parent and the directory itself with existing Win32 handle
    // inspection. It does not make file opens or subsequent writes atomic.
    crate::native::inspect(dir)?;
    let metadata = bounded_json(dir, "envelope.json")?;
    let envelope: Envelope = serde_json::from_slice(&metadata)
        .map_err(|_| "NATIVE_ENVELOPE_SCHEMA_INVALID")?;
    if envelope.schema_version != "tempora-scientific-transport-v1" ||
       !envelope.sdk_validated || envelope.scientific_approval || envelope.published {
        return Err("NATIVE_ENVELOPE_FLAGS_INVALID");
    }
    let ids = [
        &envelope.identity.batch_id, &envelope.identity.source_sha256,
        &envelope.identity.base_sha256, &envelope.identity.mapping_sha256,
        &envelope.identity.output_sha256, &envelope.corpus_file_sha256,
        &envelope.journal_file_sha256,
    ];
    if ids.iter().any(|v| !is_sha(v)) {
        return Err("NATIVE_ENVELOPE_DIGEST_INVALID");
    }
    let corpus_bytes = bounded_json(dir, "corpus.json")?;
    let journal_bytes = bounded_json(dir, "journal.json")?;
    if sha256(&corpus_bytes) != envelope.corpus_file_sha256 ||
       sha256(&journal_bytes) != envelope.journal_file_sha256 {
        return Err("NATIVE_ENVELOPE_BYTES_CHANGED");
    }
    let corpus: Value = serde_json::from_slice(&corpus_bytes)
        .map_err(|_| "NATIVE_ENVELOPE_CORPUS_INVALID")?;
    if corpus.get("schema_version").and_then(Value::as_str) != Some("3.0.0") ||
       !corpus.is_object() {
        return Err("NATIVE_ENVELOPE_CORPUS_INVALID");
    }
    let journal: Value = serde_json::from_slice(&journal_bytes)
        .map_err(|_| "NATIVE_ENVELOPE_JOURNAL_INVALID")?;
    if journal.get("decision").and_then(Value::as_str) != Some("accepted_for_local_staging") ||
       journal.get("scientific_approval").and_then(Value::as_bool) != Some(false) ||
       journal.get("batch_id").and_then(Value::as_str) != Some(envelope.identity.batch_id.as_str()) ||
       journal.get("base_sha256").and_then(Value::as_str) != Some(envelope.identity.base_sha256.as_str()) ||
       journal.get("output_sha256").and_then(Value::as_str) != Some(envelope.identity.output_sha256.as_str()) {
        return Err("NATIVE_ENVELOPE_JOURNAL_MISMATCH");
    }
    // Return precisely the bytes checked above. Never reopen the source
    // after validation: an attacker could replace files between the two
    // reads even in an explicitly synthetic experiment.
    Ok(VerifiedTransport {
        corpus: corpus_bytes,
        journal: journal_bytes,
        envelope: metadata,
    })
}
pub fn verify(dir: &Path) -> Result<(), &'static str> {
    load_verified(dir).map(|_| ())
}
