//! Synthetic-only native commit proof on Windows NTFS.
//! Never handles scientific source data or a TEMPORA canonical transaction.
//! Uses directory HANDLEs held through SetFileInformationByHandle(FileRenameInfo).
//! No claim of post-power-loss durability or formal resistance to every race.
use std::ffi::{c_void, OsStr};
use std::fs;
use std::os::windows::ffi::OsStrExt;
use std::path::Path;
use std::ptr::null_mut;

type Handle = isize;
const INVALID_HANDLE_VALUE: Handle = -1isize;
const FILE_READ_ATTRIBUTES: u32 = 0x0080;
const FILE_ADD_SUBDIRECTORY: u32 = 0x0004;
const FILE_ADD_FILE: u32 = 0x0002;
const DELETE: u32 = 0x0001_0000;
const FILE_SHARE_READ: u32 = 1;
const FILE_SHARE_WRITE: u32 = 2;
const OPEN_EXISTING: u32 = 3;
const FILE_FLAG_BACKUP_SEMANTICS: u32 = 0x0200_0000;
const FILE_FLAG_OPEN_REPARSE_POINT: u32 = 0x0020_0000;
const FILE_ATTRIBUTE_DIRECTORY: u32 = 0x0010;
const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;
const FILE_ATTRIBUTE_TAG_INFO_CLASS: i32 = 9;
const FILE_RENAME_INFO_CLASS: i32 = 3;
const BCRYPT_USE_SYSTEM_PREFERRED_RNG: u32 = 2;

#[repr(C)]
#[derive(Default)]
struct FileAttributeTagInfo {
    attributes: u32,
    tag: u32,
}
#[repr(C)]
struct RenameInfo {
    flags: u32,
    root_directory: Handle,
    filename_length: u32,
    filename: [u16; 1],
}
#[link(name = "kernel32")]
extern "system" {
    fn CreateFileW(
        name: *const u16, access: u32, share: u32, security: *mut c_void,
        creation: u32, flags: u32, template: Handle,
    ) -> Handle;
    fn CloseHandle(handle: Handle) -> i32;
    fn GetLastError() -> u32;
    fn GetFileInformationByHandleEx(
        handle: Handle, info_class: i32, info: *mut c_void, size: u32,
    ) -> i32;
    fn SetFileInformationByHandle(
        handle: Handle, info_class: i32, info: *const c_void, size: u32,
    ) -> i32;
}
#[link(name = "bcrypt")]
extern "system" {
    fn BCryptGenRandom(algorithm: Handle, buffer: *mut u8, count: u32, flags: u32) -> i32;
}
struct Owned(Handle);
impl Drop for Owned {
    fn drop(&mut self) {
        unsafe { CloseHandle(self.0); }
    }
}
fn wide(value: &OsStr) -> Vec<u16> {
    value.encode_wide().chain(std::iter::once(0)).collect()
}
fn open_directory(path: &Path, delete: bool, add_subdir: bool, add_file: bool)
    -> Result<Owned, &'static str> {
    let encoded = wide(path.as_os_str());
    // Intentionally exclude FILE_SHARE_DELETE: other processes cannot
    // rename these specific directory objects while we retain the handles.
    let raw = unsafe {
        CreateFileW(
            encoded.as_ptr(),
            FILE_READ_ATTRIBUTES | if delete { DELETE } else { 0 }
                | if add_subdir { FILE_ADD_SUBDIRECTORY } else { 0 }
                | if add_file { FILE_ADD_FILE } else { 0 },
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            null_mut(), OPEN_EXISTING,
            FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT, 0,
        )
    };
    if raw == INVALID_HANDLE_VALUE {
        return Err("NATIVE_COMMIT_HANDLE_OPEN_FAILED");
    }
    let handle = Owned(raw);
    let mut info = FileAttributeTagInfo::default();
    let success = unsafe {
        GetFileInformationByHandleEx(
            handle.0, FILE_ATTRIBUTE_TAG_INFO_CLASS,
            (&mut info as *mut FileAttributeTagInfo).cast(),
            std::mem::size_of::<FileAttributeTagInfo>() as u32,
        )
    };
    if success == 0 || info.attributes & FILE_ATTRIBUTE_DIRECTORY == 0
        || info.attributes & FILE_ATTRIBUTE_REPARSE_POINT != 0 || info.tag != 0
    {
        return Err("NATIVE_COMMIT_REPARSE_OR_UNSAFE");
    }
    Ok(handle)
}
fn create_or_open(directory: &Path, add_subdir: bool) -> Result<Owned, &'static str> {
    match fs::create_dir(directory) {
        Ok(()) => (),
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => (),
        Err(_) => return Err("NATIVE_COMMIT_DIRECTORY_CREATION_FAILED"),
    }
    open_directory(directory, false, add_subdir, false)
}
fn random_id() -> Result<String, &'static str> {
    let mut bytes = [0u8; 16];
    let status = unsafe {
        BCryptGenRandom(0, bytes.as_mut_ptr(), bytes.len() as u32, BCRYPT_USE_SYSTEM_PREFERRED_RNG)
    };
    if status < 0 { return Err("NATIVE_COMMIT_RANDOM_FAILED"); }
    Ok(bytes.iter().map(|v| format!("{v:02x}")).collect())
}
fn rename_with_pinned_destination(
    source: Handle, target_path: &Path,
) -> Result<(), &'static str> {
    if !target_path.is_absolute() {
        return Err("NATIVE_COMMIT_FILENAME_UNSAFE");
    }
    // Win32 FileRenameInfo with RootDirectory has rejected the relative
    // variant with ERROR_INVALID_PARAMETER on the actual Windows runner.
    // Use its documented absolute-path variant with RootDirectory=NULL,
    // while still holding both parent directory handles against renames.
    // This is a native visibility proof, NOT yet handle-relative security.
    let chars: Vec<u16> = target_path.as_os_str().encode_wide().collect();
    // Allocate aligned storage for FILE_RENAME_INFO's trailing flexible WCHAR array.
    let count_bytes = std::mem::size_of::<RenameInfo>()
        .checked_add(chars.len() * 2)
        .ok_or("NATIVE_COMMIT_BUFFER_LIMIT")?;
    let mut storage = vec![0u64; count_bytes.div_ceil(8)];
    let size = count_bytes.try_into().map_err(|_| "NATIVE_COMMIT_BUFFER_LIMIT")?;
    let record = storage.as_mut_ptr().cast::<RenameInfo>();
    unsafe {
        (*record).flags = 0; // ReplaceIfExists = FALSE
        (*record).root_directory = 0;
        (*record).filename_length = (chars.len() * 2) as u32;
        std::ptr::copy_nonoverlapping(chars.as_ptr(), (*record).filename.as_mut_ptr(), chars.len());
        if SetFileInformationByHandle(source, FILE_RENAME_INFO_CLASS, record.cast(), size) == 0 {
            // Only expose the categorical Win32 error; no source/target path.
            return Err(match GetLastError() {
                5 => "NATIVE_COMMIT_RENAME_ACCESS_DENIED",
                32 => "NATIVE_COMMIT_RENAME_SHARING_VIOLATION",
                87 => "NATIVE_COMMIT_RENAME_INVALID_PARAMETER",
                183 => "NATIVE_COMMIT_RENAME_ALREADY_EXISTS",
                _ => "NATIVE_COMMIT_RENAME_FAILED",
            });
        }
    }
    Ok(())
}
// Reopen each staged file using the Win32 no-reparse, no-share-write/delete
// primitive; compare EXACT bytes against the verified source buffers.
// This tests the data actually written, not merely its pre-write hash.
// The handles close before directory rename: TOCTOU/power-loss P0 remain.
fn verify_staged_bytes(directory: &Path, name: &str, expected: &[u8])
    -> Result<(), &'static str>
{
    let mut file=crate::scientific_envelope::open_pinned(&directory.join(name), false)
        .map_err(|_| "NATIVE_COMMIT_STAGED_UNSAFE")?;
    let bytes=crate::scientific_envelope::bounded_json(&mut file)
        .map_err(|_| "NATIVE_COMMIT_STAGED_UNSAFE")?;
    if bytes != expected { return Err("NATIVE_COMMIT_STAGED_MISMATCH"); }
    Ok(())
}
// Only reached by explicit synthetic CLI mode. Simulates a killed native
// process at auditable points. Never used by the distributed application.
fn crash_probe(phase: &str, code: i32) {
    if std::env::var("TEMPORA_NATIVE_TEST_CRASH_POINT").ok().as_deref() == Some(phase) {
        std::process::exit(code);
    }
}
fn commit_probe(
    root: &Path,
    verified: Option<&crate::scientific_envelope::VerifiedTransport>,
) -> Result<String, &'static str> {
    if std::env::var_os("TEMPORA_NATIVE_SYNTHETIC_TEST").as_deref()
        != Some(OsStr::new("1"))
    {
        return Err("NATIVE_COMMIT_SYNTHETIC_GATE_CLOSED");
    }
    // Keep every destination ancestor pinned through sync and native rename.
    let _destination_ancestors = crate::native::inspect_pinned(root)?;
    let root_handle = open_directory(root, false, false, false)?;
    let lock = root.join(".native-probe-lock");
    fs::create_dir(&lock).map_err(|_| "NATIVE_COMMIT_WRITER_BUSY")?;
    // On every failure retain the lock and the pending data for forensic review.
    let lock_handle = open_directory(&lock, false, false, true)?;
    let _ = &lock_handle;
    let pending_root = root.join(".native-probe-pending");
    let completed_root = root.join("native-probe-complete");
    let pending_root_handle = create_or_open(&pending_root, true)?;
    let completed_root_handle = create_or_open(&completed_root, true)?;
    let _ = (&root_handle, &pending_root_handle);
    let id = random_id()?;
    crate::relative_io::exclusive_sync_at(lock_handle.0, "owner.txt", id.as_bytes())?;
    crash_probe("after_lock", 81);
    // Deterministic test-only pause: permits a second Windows process to try
    // replacing the already-pinned source while this transaction is active.
    // Hard-capped; cannot be enabled without the synthetic-test gate above.
    if let Some(pause) = std::env::var("TEMPORA_NATIVE_TEST_HOLD_MS").ok()
        .and_then(|v| v.parse::<u64>().ok())
    {
        if pause > 0 && pause <= 4_000 {
            std::thread::sleep(std::time::Duration::from_millis(pause));
        }
    }
    let pending = pending_root.join(&id);
    fs::create_dir(&pending).map_err(|_| "NATIVE_COMMIT_COLLISION")?;
    let pending_handle = open_directory(&pending, true, false, true)?;
    if let Some(documents) = verified {
        // The real SDK-approved transport is copied only to an explicitly
        // nonproduction probe namespace; never to scientific transactions/.
        // Bytes are the SAME snapshot independently checked by Rust.
        crate::relative_io::exclusive_sync_at(pending_handle.0, "corpus.json", &documents.corpus)?;
        crash_probe("after_corpus", 82);
        crate::relative_io::exclusive_sync_at(pending_handle.0, "journal.json", &documents.journal)?;
        crate::relative_io::exclusive_sync_at(pending_handle.0, "envelope.json", &documents.envelope)?;
        crate::relative_io::exclusive_sync_at(pending_handle.0, "manifest.json",
            br#"{"synthetic":true,"published":false,"kind":"NTFS_SCIENTIFIC_TRANSPORT_PROBE"}"#)?;
        // Adversarial fixture only. Always behind the synthetic test gate:
        // simulate tampering after writes, before native visibility.
        if std::env::var_os("TEMPORA_NATIVE_TEST_CORRUPT_STAGED")
            .as_deref() == Some(OsStr::new("1")) {
            fs::write(pending.join("journal.json"), b"{}")
                .map_err(|_| "NATIVE_COMMIT_TEST_CORRUPTION_FAILED")?;
        }
        verify_staged_bytes(&pending, "corpus.json", &documents.corpus)?;
        verify_staged_bytes(&pending, "journal.json", &documents.journal)?;
        verify_staged_bytes(&pending, "envelope.json", &documents.envelope)?;
        verify_staged_bytes(&pending, "manifest.json",
            br#"{"synthetic":true,"published":false,"kind":"NTFS_SCIENTIFIC_TRANSPORT_PROBE"}"#)?;
    } else {
        crate::relative_io::exclusive_sync_at(pending_handle.0, "corpus.json", br#"{"synthetic":true,"schema_version":"probe-only"}"#)?;
        crate::relative_io::exclusive_sync_at(pending_handle.0, "journal.json", br#"{"synthetic":true,"approval":false}"#)?;
        crate::relative_io::exclusive_sync_at(pending_handle.0, "manifest.json", br#"{"synthetic":true,"published":false,"kind":"NTFS_HANDLE_RENAME_PROBE"}"#)?;
    }
    // File handles were closed after sync_all; the directory handles remain
    // held without FILE_SHARE_DELETE during the relative rename.
    rename_with_pinned_destination(pending_handle.0, &completed_root.join(&id))?;
    crash_probe("after_rename", 83);
    // Do not claim NTFS power-failure durability. Remove only our own
    // successful synthetic test lock, never a scientific writer reservation.
    drop(pending_handle);
    drop(lock_handle);
    fs::remove_file(lock.join("owner.txt"))
        .map_err(|_| "NATIVE_COMMIT_LOCK_RELEASE_FAILED")?;
    fs::remove_dir(&lock).map_err(|_| "NATIVE_COMMIT_LOCK_RELEASE_FAILED")?;
    Ok(id)
}

pub fn synthetic_commit(root: &Path) -> Result<String, &'static str> {
    commit_probe(root, None)
}
pub fn synthetic_transport_commit(
    root: &Path, source: &Path,
) -> Result<String, &'static str> {
    // The gate is checked before even opening a scientific envelope.
    if std::env::var_os("TEMPORA_NATIVE_SYNTHETIC_TEST").as_deref()
        != Some(OsStr::new("1"))
    {
        return Err("NATIVE_COMMIT_SYNTHETIC_GATE_CLOSED");
    }
    // Independent read-only verification, NO Node-provided "validated"
    // boolean can bypass byte digests. This is not cryptographic proof of
    // who originally authorized a corpus: production writer remains absent.
    let documents = crate::scientific_envelope::load_verified(source)?;
    // Prevent accidental use of real research data in this test-only probe.
    // This marker is NOT an authentication mechanism; a forged unsigned
    // corpus can still imitate the demonstration profile.
    let corpus: serde_json::Value = serde_json::from_slice(&documents.corpus)
        .map_err(|_| "NATIVE_PROBE_CORPUS_INVALID")?;
    if corpus.pointer("/profile/id").and_then(serde_json::Value::as_str)
        != Some("synthetic-history") ||
       corpus.pointer("/profile/namespace").and_then(serde_json::Value::as_str)
        != Some("SYNTHETIC_HISTORY") ||
       corpus.get("events").and_then(serde_json::Value::as_array)
        .is_none_or(|events| events.iter().any(|event|
            event.get("namespace").and_then(serde_json::Value::as_str)
                != Some("SYNTHETIC_HISTORY"))) {
        return Err("NATIVE_PROBE_ONLY_SYNTHETIC_PROFILE");
    }
    commit_probe(root, Some(&documents))
}
