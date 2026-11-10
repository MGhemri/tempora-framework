//! Read-only preflight for an SDK-approved TEMPORA canonical v3 transaction.
//! Never creates, renames, overwrites, publishes or approves a transaction.
//! This checks the byte transport and journal/identity relationship, NOT the
//! SDK's canonical semantic digest, Windows atomicity or power-loss durability.
use serde::Deserialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::Read;
use std::os::windows::ffi::OsStrExt;
use std::os::windows::io::FromRawHandle;
use std::path::Path;
use std::ptr::null_mut;
use std::ffi::c_void;

// All source objects remain open without FILE_SHARE_WRITE or
// FILE_SHARE_DELETE until the verified buffers have been committed to the
// synthetic destination. This is NOT a production write authorization.
type Handle = isize;
const INVALID_HANDLE_VALUE: Handle = -1;
const GENERIC_READ: u32 = 0x8000_0000;
const FILE_READ_ATTRIBUTES: u32 = 0x80;
const FILE_SHARE_READ: u32 = 0x1;
const OPEN_EXISTING: u32 = 3;
const FILE_FLAG_BACKUP_SEMANTICS: u32 = 0x0200_0000;
const FILE_FLAG_OPEN_REPARSE_POINT: u32 = 0x0020_0000;
const FILE_ATTRIBUTE_DIRECTORY: u32 = 0x10;
const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
const FILE_ATTRIBUTE_TAG_INFO_CLASS: i32 = 9;
#[repr(C)]
#[derive(Default)]
struct FileAttributeTagInfo { attributes: u32, tag: u32 }
#[link(name = "kernel32")]
extern "system" {
    fn CreateFileW(name: *const u16, access: u32, share: u32,
        security: *mut c_void, creation: u32, flags: u32,
        template: Handle) -> Handle;
    fn CloseHandle(handle: Handle) -> i32;
    fn GetFileInformationByHandleEx(handle: Handle, kind: i32,
        info: *mut c_void, size: u32) -> i32;
}
pub(crate) fn open_pinned(path: &Path, directory: bool) -> Result<File, &'static str> {
    let encoded: Vec<u16> = path.as_os_str().encode_wide()
        .chain(std::iter::once(0)).collect();
    let raw = unsafe {
        CreateFileW(encoded.as_ptr(),
            if directory { FILE_READ_ATTRIBUTES } else { GENERIC_READ },
            FILE_SHARE_READ, null_mut(), OPEN_EXISTING,
            FILE_FLAG_OPEN_REPARSE_POINT | if directory {FILE_FLAG_BACKUP_SEMANTICS} else {0}, 0)
    };
    if raw == INVALID_HANDLE_VALUE { return Err("NATIVE_ENVELOPE_HANDLE_OPEN_FAILED"); }
    let mut tag = FileAttributeTagInfo::default();
    let ok = unsafe { GetFileInformationByHandleEx(raw,
        FILE_ATTRIBUTE_TAG_INFO_CLASS, (&mut tag as *mut FileAttributeTagInfo).cast(),
        std::mem::size_of::<FileAttributeTagInfo>() as u32) };
    if ok == 0 || (tag.attributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0 ||
       tag.tag != 0 || ((tag.attributes & FILE_ATTRIBUTE_DIRECTORY) != 0) != directory {
        unsafe { CloseHandle(raw); }
        return Err("NATIVE_ENVELOPE_REPARSE_OR_UNSAFE");
    }
    // Each kernel HANDLE is owned exactly once by File from this point on.
    Ok(unsafe { File::from_raw_handle(raw as *mut c_void) })
}


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
pub(crate) fn bounded_json(pinned: &mut File) -> Result<Vec<u8>, &'static str> {
    let length = pinned.metadata().map_err(|_| "NATIVE_ENVELOPE_FILE_UNSAFE")?.len();
    if length == 0 || length > LIMIT { return Err("NATIVE_ENVELOPE_FILE_UNSAFE"); }
    let mut bytes=Vec::new();
    pinned.take(LIMIT + 1).read_to_end(&mut bytes)
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
    // Private ownership deliberately keeps source directory and file handles
    // open until the caller drops VerifiedTransport AFTER its commit attempt.
    _pinned_sources: [File; 4],
    // Pin each ancestor, including the drive root, through native commit.
    _pinned_ancestors: crate::native::PinnedPath,
}
pub fn load_verified(dir: &Path) -> Result<VerifiedTransport, &'static str> {
    // Check every parent and the directory itself with existing Win32 handle
    // inspection. It does not make file opens or subsequent writes atomic.
    let pinned_ancestors = crate::native::inspect_pinned(dir)?;
    let pinned_directory = open_pinned(dir, true)?;
    let mut pinned_envelope = open_pinned(&dir.join("envelope.json"), false)?;
    let mut pinned_corpus = open_pinned(&dir.join("corpus.json"), false)?;
    let mut pinned_journal = open_pinned(&dir.join("journal.json"), false)?;
    let metadata = bounded_json(&mut pinned_envelope)?;
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
    let corpus_bytes = bounded_json(&mut pinned_corpus)?;
    let journal_bytes = bounded_json(&mut pinned_journal)?;
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
        _pinned_sources: [pinned_directory, pinned_envelope, pinned_corpus, pinned_journal],
        _pinned_ancestors: pinned_ancestors,
    })
}
pub fn verify(dir: &Path) -> Result<(), &'static str> {
    load_verified(dir).map(|_| ())
}
