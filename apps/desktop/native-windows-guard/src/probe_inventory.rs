//! Strictly read-only incident inventory for the *synthetic probe* namespace.
//! Never repairs a lock or promotes a pending directory. Not a recovery API
//! for TEMPORA's scientific transactions/.
use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::Path;

const LIMIT: usize = 100;
const MANIFEST_LIMIT: u64 = 4096;

#[derive(Serialize)]
pub struct ProbeInventory {
    schema_version: &'static str,
    lock_status: &'static str,
    committed_verified: usize,
    pending_complete: usize,
    pending_incomplete: usize,
    unsafe_entries: usize,
    requires_manual_attention: bool,
    inspected_only: bool,
    files_modified: bool,
    production_recovery_authorized: bool,
}

fn directory_state(path: &Path) -> Result<bool, &'static str> {
    match fs::symlink_metadata(path) {
        Ok(meta) => {
            if !meta.file_type().is_dir() || meta.file_type().is_symlink() {
                return Err("NATIVE_PROBE_DIRECTORY_UNSAFE");
            }
            crate::native::inspect(path)
                .map_err(|_| "NATIVE_PROBE_DIRECTORY_UNSAFE")?;
            Ok(true)
        }
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(_) => Err("NATIVE_PROBE_DIRECTORY_UNSAFE"),
    }
}
fn read_manifest(dir: &Path) -> Result<Value, &'static str> {
    let file = dir.join("manifest.json");
    let info = fs::symlink_metadata(&file).map_err(|_| "NATIVE_PROBE_MANIFEST_MISSING")?;
    if !info.file_type().is_file() || info.file_type().is_symlink() ||
        info.len() == 0 || info.len() > MANIFEST_LIMIT {
        return Err("NATIVE_PROBE_MANIFEST_UNSAFE");
    }
    // This read is bounded by the stat size; all paths remain advisory,
    // not a forensic atomic snapshot or sufficient evidence for a replay.
    use std::io::Read;
    let mut contents = Vec::new();
    fs::File::open(file).map_err(|_| "NATIVE_PROBE_MANIFEST_UNSAFE")?
        .take(MANIFEST_LIMIT+1).read_to_end(&mut contents)
        .map_err(|_| "NATIVE_PROBE_MANIFEST_UNSAFE")?;
    if contents.len() as u64 > MANIFEST_LIMIT {
        return Err("NATIVE_PROBE_MANIFEST_UNSAFE");
    }
    serde_json::from_slice(&contents).map_err(|_| "NATIVE_PROBE_MANIFEST_UNSAFE")
}
fn check_candidate(dir: &Path) -> Result<bool, &'static str> {
    if !directory_state(dir)? {
        return Err("NATIVE_PROBE_DIRECTORY_UNSAFE");
    }
    let manifest = match read_manifest(dir) {
        Ok(value) => value,
        Err("NATIVE_PROBE_MANIFEST_MISSING") => return Ok(false),
        Err(error) => return Err(error),
    };
    if manifest.get("synthetic").and_then(Value::as_bool) != Some(true) ||
       manifest.get("published").and_then(Value::as_bool) != Some(false) {
        return Err("NATIVE_PROBE_MANIFEST_UNSAFE");
    }
    match manifest.get("kind").and_then(Value::as_str) {
        Some("NTFS_SCIENTIFIC_TRANSPORT_PROBE") => {
            crate::scientific_envelope::verify(dir)
                .map_err(|_| "NATIVE_PROBE_TRANSPORT_UNVERIFIED")?;
        }
        Some("NTFS_HANDLE_RENAME_PROBE") => {
            for name in ["corpus.json","journal.json"] {
                let meta = fs::symlink_metadata(dir.join(name))
                    .map_err(|_| "NATIVE_PROBE_CONTENT_UNSAFE")?;
                if !meta.file_type().is_file() || meta.file_type().is_symlink() ||
                   meta.len() == 0 || meta.len() > 4096 {
                    return Err("NATIVE_PROBE_CONTENT_UNSAFE");
                }
            }
        }
        _ => return Err("NATIVE_PROBE_MANIFEST_UNSAFE"),
    }
    Ok(true)
}
fn inventory_children(
    dir: &Path, committed: bool, report: &mut ProbeInventory,
) -> Result<(), &'static str> {
    if !directory_state(dir)? { return Ok(()); }
    let mut inspected = 0;
    for item in fs::read_dir(dir).map_err(|_| "NATIVE_PROBE_ENUM_FAILED")? {
        inspected += 1;
        if inspected > LIMIT {
            return Err("NATIVE_PROBE_INVENTORY_LIMIT");
        }
        let entry = item.map_err(|_| "NATIVE_PROBE_ENUM_FAILED")?;
        let name = entry.file_name();
        let display = name.to_string_lossy();
        if display.len() != 32 || !display.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase()) {
            report.unsafe_entries += 1;
            continue;
        }
        match check_candidate(&entry.path()) {
            Ok(true) if committed => report.committed_verified += 1,
            Ok(true) => report.pending_complete += 1,
            Ok(false) if !committed => report.pending_incomplete += 1,
            _ => report.unsafe_entries += 1,
        }
    }
    Ok(())
}
pub fn inspect(root: &Path) -> Result<ProbeInventory, &'static str> {
    crate::native::inspect(root)?;
    let lock = root.join(".native-probe-lock");
    let lock_status = if directory_state(&lock)? {
        let owner = lock.join("owner.txt");
        let metadata = fs::symlink_metadata(&owner)
            .map_err(|_| "NATIVE_PROBE_OWNER_UNSAFE")?;
        if !metadata.file_type().is_file() || metadata.file_type().is_symlink()
            || metadata.len() != 32 {
            return Err("NATIVE_PROBE_OWNER_UNSAFE");
        }
        let id = fs::read_to_string(owner).map_err(|_| "NATIVE_PROBE_OWNER_UNSAFE")?;
        if id.len() != 32 || !id.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase()) {
            return Err("NATIVE_PROBE_OWNER_UNSAFE");
        }
        "reserved"
    } else { "absent" };
    let mut report = ProbeInventory {
        schema_version: "tempora-native-probe-inventory-v1",
        lock_status,
        committed_verified: 0,
        pending_complete: 0,
        pending_incomplete: 0,
        unsafe_entries: 0,
        requires_manual_attention: false,
        inspected_only: true,
        files_modified: false,
        production_recovery_authorized: false,
    };
    inventory_children(&root.join(".native-probe-pending"),false,&mut report)?;
    inventory_children(&root.join("native-probe-complete"),true,&mut report)?;
    report.requires_manual_attention = report.lock_status != "absent" ||
        report.pending_complete > 0 || report.pending_incomplete > 0 ||
        report.unsafe_entries > 0;
    Ok(report)
}
