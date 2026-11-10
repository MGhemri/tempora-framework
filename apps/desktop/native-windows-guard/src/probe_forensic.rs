//! Read-only forensic inventory for the isolated native NTFS probe.
//! This is NOT scientific recovery: no deletion, promotion, replay, writer
//! lease reclamation or assertion about power-loss durability.
use serde_json::{json, Value};
use std::fs;
use std::path::Path;

const LIMIT: usize = 100;
fn name_ok(name: &str) -> bool {
    name.len() == 32 && name.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
fn dir_exists_safe(path: &Path) -> Result<bool, &'static str> {
    match fs::symlink_metadata(path) {
        Ok(m) if m.file_type().is_dir() => Ok(true),
        Ok(_) => Err("NATIVE_PROBE_DIRECTORY_UNSAFE"),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(_) => Err("NATIVE_PROBE_DIRECTORY_UNREADABLE"),
    }
}
fn listing(dir: &Path) -> Result<Vec<String>, &'static str> {
    if !dir_exists_safe(dir)? { return Ok(Vec::new()); }
    let entries=fs::read_dir(dir).map_err(|_| "NATIVE_PROBE_DIRECTORY_UNREADABLE")?;
    let mut names=Vec::new();
    for entry in entries {
        let entry=entry.map_err(|_| "NATIVE_PROBE_DIRECTORY_UNREADABLE")?;
        if names.len()>=LIMIT {return Err("NATIVE_PROBE_REPORT_LIMIT");}
        let name=entry.file_name().into_string()
            .map_err(|_| "NATIVE_PROBE_NAME_UNSAFE")?;
        if !name_ok(&name) || !entry.file_type()
            .map_err(|_| "NATIVE_PROBE_DIRECTORY_UNREADABLE")?.is_dir() {
            return Err("NATIVE_PROBE_NAME_UNSAFE");
        }
        names.push(name);
    }
    names.sort();
    Ok(names)
}
fn verified_probe(path: &Path) -> bool {
    // Each completed probe contains the SDK byte transport AND a separate
    // marker. Neither the marker nor sdk_validated are authenticity proofs.
    let doc = match crate::scientific_envelope::load_verified(path) {
        Ok(value) => value,
        Err(_) => return false,
    };
    let mut pinned = match crate::scientific_envelope::open_pinned(
        &path.join("manifest.json"), false,
    ) {
        Ok(file) => file,
        Err(_) => return false,
    };
    let manifest = match crate::scientific_envelope::bounded_json(&mut pinned) {
        Ok(v) if v.len()<4096 => v,
        _ => return false,
    };
    let meta: Value=match serde_json::from_slice(&manifest) {
        Ok(value)=>value,
        Err(_)=>return false,
    };
    let _=doc;
    meta.get("kind").and_then(Value::as_str)==Some("NTFS_SCIENTIFIC_TRANSPORT_PROBE")
        && meta.get("synthetic").and_then(Value::as_bool)==Some(true)
        && meta.get("published").and_then(Value::as_bool)==Some(false)
}
pub fn inspect(root: &Path) -> Result<Value, &'static str> {
    crate::native::inspect(root)?;
    let lock=root.join(".native-probe-lock");
    let lock_status=if dir_exists_safe(&lock)? {
        if fs::symlink_metadata(lock.join("owner.txt"))
            .map(|m| m.file_type().is_file() && m.len()==32)
            .unwrap_or(false) {"reserved"} else {"unsafe"}
    } else {"absent"};
    let pending=root.join(".native-probe-pending");
    let complete=root.join("native-probe-complete");
    let pending_before=listing(&pending)?;
    let completed_before=listing(&complete)?;
    let mut pending_verified=Vec::new();
    let mut pending_incomplete=Vec::new();
    let mut completed_verified=Vec::new();
    let mut completed_invalid=Vec::new();
    for id in &pending_before {
        let item=pending.join(id);
        if verified_probe(&item) {pending_verified.push(id.clone());}
        else {pending_incomplete.push(id.clone());}
    }
    for id in &completed_before {
        let item=complete.join(id);
        if verified_probe(&item) {completed_verified.push(id.clone());}
        else {completed_invalid.push(id.clone());}
    }
    // One additional bounded comparison catches directory entries added or
    // removed mid-inspection. It is not an atomic NTFS snapshot.
    if pending_before!=listing(&pending)? || completed_before!=listing(&complete)? {
        return Err("NATIVE_PROBE_SNAPSHOT_CHANGED");
    }
    // Fail closed when a result is questionable; no recovery is attempted.
    let review=lock_status!="absent" || !pending_before.is_empty() ||
        !completed_invalid.is_empty();
    Ok(json!({
        "schema_version":"tempora-native-probe-forensic-v1",
        "writer_lock_status":lock_status,
        "pending_verified_for_review":pending_verified,
        "pending_incomplete":pending_incomplete,
        "committed_verified":completed_verified,
        "committed_invalid":completed_invalid,
        "requires_manual_attention":review,
        "inspected_only":true,
        "files_modified":false,
        "recovery_performed":false,
        "durability_certified":false,
        "scientific_approval":false,
        "published":false
    }))
}
