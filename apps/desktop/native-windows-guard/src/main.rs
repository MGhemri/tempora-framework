//! M1.5 Windows destination preflight: read-only, fail-closed.
//! Opens *every* existing path prefix with OPEN_REPARSE_POINT, and checks
//! local fixed NTFS using a HANDLE. It never creates or changes a file.
//! This does not eliminate a race between this process and the Node writer.
#[cfg(windows)]
mod native_commit;
#[cfg(windows)]
mod scientific_envelope;
#[cfg(windows)]
mod native {
    use std::ffi::{c_void, OsStr};
    use std::os::windows::ffi::OsStrExt;
    use std::path::{Component, Path, PathBuf, Prefix};
    use std::ptr::{null, null_mut};

    type Handle = isize;
    const INVALID_HANDLE_VALUE: Handle = -1isize;
    const FILE_READ_ATTRIBUTES: u32 = 0x0080;
    const FILE_SHARE_READ: u32 = 0x0001;
    const FILE_SHARE_WRITE: u32 = 0x0002;
    const OPEN_EXISTING: u32 = 3;
    const FILE_FLAG_BACKUP_SEMANTICS: u32 = 0x02000000;
    const FILE_FLAG_OPEN_REPARSE_POINT: u32 = 0x00200000;
    const FILE_ATTRIBUTE_DIRECTORY: u32 = 0x0010;
    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;
    const FILE_ATTRIBUTE_TAG_INFO_CLASS: i32 = 9;
    const DRIVE_FIXED: u32 = 3;

    #[repr(C)]
    #[derive(Default)]
    struct FileAttributeTagInfo {
        file_attributes: u32,
        reparse_tag: u32,
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn CreateFileW(
            name: *const u16, access: u32, share: u32, security: *mut c_void,
            creation: u32, flags: u32, template: Handle,
        ) -> Handle;
        fn CloseHandle(handle: Handle) -> i32;
        fn GetFileInformationByHandleEx(
            handle: Handle, info_class: i32, info: *mut c_void, size: u32,
        ) -> i32;
        fn GetVolumeInformationByHandleW(
            handle: Handle, volume: *mut u16, volume_len: u32,
            serial: *mut u32, component_len: *mut u32, flags: *mut u32,
            filesystem: *mut u16, filesystem_len: u32,
        ) -> i32;
        fn GetDriveTypeW(root: *const u16) -> u32;
    }

    struct OwnedHandle(Handle);
    impl Drop for OwnedHandle {
        fn drop(&mut self) {
            unsafe { CloseHandle(self.0); }
        }
    }
    fn wide(value: &OsStr) -> Vec<u16> {
        value.encode_wide().chain(std::iter::once(0)).collect()
    }
    fn inspect_directory(path: &Path) -> Result<OwnedHandle, &'static str> {
        let name = wide(path.as_os_str());
        let raw = unsafe {
            CreateFileW(
                name.as_ptr(), FILE_READ_ATTRIBUTES,
                FILE_SHARE_READ | FILE_SHARE_WRITE, null_mut(), OPEN_EXISTING,
                FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT, 0,
            )
        };
        if raw == INVALID_HANDLE_VALUE {
            return Err("NATIVE_DIRECTORY_OPEN_FAILED");
        }
        let handle = OwnedHandle(raw);
        let mut info = FileAttributeTagInfo::default();
        let ok = unsafe {
            GetFileInformationByHandleEx(
                handle.0, FILE_ATTRIBUTE_TAG_INFO_CLASS,
                (&mut info as *mut FileAttributeTagInfo).cast::<c_void>(),
                std::mem::size_of::<FileAttributeTagInfo>() as u32,
            )
        };
        if ok == 0
            || info.file_attributes & FILE_ATTRIBUTE_DIRECTORY == 0
            || info.file_attributes & FILE_ATTRIBUTE_REPARSE_POINT != 0
            || info.reparse_tag != 0
        {
            return Err("NATIVE_DIRECTORY_REPARSE_OR_UNSAFE");
        }
        Ok(handle)
    }
    pub fn inspect(root: &Path) -> Result<(), &'static str> {
        if !root.is_absolute() {
            return Err("NATIVE_PATH_NOT_ABSOLUTE");
        }
        let mut components = root.components();
        let disk = match components.next() {
            Some(Component::Prefix(prefix)) => match prefix.kind() {
                Prefix::Disk(drive) => drive,
                _ => return Err("NATIVE_DEVICE_OR_NETWORK_PATH"),
            },
            _ => return Err("NATIVE_DEVICE_OR_NETWORK_PATH"),
        };
        if !matches!(components.next(), Some(Component::RootDir)) {
            return Err("NATIVE_PATH_NOT_ABSOLUTE");
        }
        // Reject dangerous path syntax instead of relying on canonicalize(),
        // which would already resolve a junction or symlink.
        let drive_root = format!("{}:\\", (disk as char).to_ascii_uppercase());
        let mut current = PathBuf::from(&drive_root);
        let disk_wide = wide(OsStr::new(&drive_root));
        if unsafe { GetDriveTypeW(disk_wide.as_ptr()) } != DRIVE_FIXED {
            return Err("NATIVE_VOLUME_NOT_LOCAL_FIXED");
        }
        // Keep handles open throughout inspection so directories cannot be
        // renamed by another process using ordinary share-delete semantics.
        // All handles close before Node writes: no atomic-write guarantee.
        let mut handles = Vec::new();
        handles.push(inspect_directory(&current)?);
        let mut segments = 0;
        for component in components {
            match component {
                Component::Normal(name) => {
                    segments += 1;
                    if segments > 64 { return Err("NATIVE_PATH_DEPTH_LIMIT"); }
                    current.push(name);
                    handles.push(inspect_directory(&current)?);
                }
                _ => return Err("NATIVE_PATH_COMPONENT_UNSAFE"),
            }
        }
        if segments == 0 { return Err("NATIVE_VOLUME_ROOT_FORBIDDEN"); }
        let handle = handles.last().ok_or("NATIVE_PATH_COMPONENT_UNSAFE")?;
        let mut filesystem = [0u16; 32];
        let ok = unsafe {
            GetVolumeInformationByHandleW(
                handle.0, null_mut(), 0, null_mut(), null_mut(),
                null_mut(), filesystem.as_mut_ptr(), filesystem.len() as u32,
            )
        };
        if ok == 0 {
            return Err("NATIVE_VOLUME_INSPECTION_FAILED");
        }
        let len = filesystem.iter().position(|c| *c == 0).unwrap_or(filesystem.len());
        if String::from_utf16_lossy(&filesystem[..len]).to_uppercase() != "NTFS" {
            return Err("NATIVE_VOLUME_NOT_NTFS");
        }
        Ok(())
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        #[test]
        fn local_temporary_directory_qualifies_if_ntfs() {
            let dir = std::env::temp_dir();
            assert_eq!(inspect(&dir), Ok(()));
        }
        #[test]
        fn network_and_device_paths_fail_closed() {
            assert_eq!(inspect(Path::new(r"\\server\share\folder")),
                Err("NATIVE_DEVICE_OR_NETWORK_PATH"));
            assert_eq!(inspect(Path::new(r"\\?\C:\Windows")),
                Err("NATIVE_DEVICE_OR_NETWORK_PATH"));
        }
        #[test]
        fn volume_root_and_traversal_are_denied() {
            assert_eq!(inspect(Path::new(r"C:\")),
                Err("NATIVE_VOLUME_ROOT_FORBIDDEN"));
            assert!(inspect(Path::new(r"C:\Windows\..\Temp")).is_err());
        }
        #[test]
        fn missing_destination_is_rejected() {
            let missing = std::env::temp_dir()
                .join(format!("tempora-guard-does-not-exist-{}", std::process::id()));
            assert!(inspect(&missing).is_err());
        }
    }
}
fn main() {
    let args: Vec<_> = std::env::args_os().collect();
    #[cfg(windows)]
    if args.len() == 4 && args[1] == "--synthetic-transport-commit" {
        let target = std::path::Path::new(&args[2]);
        let source = std::path::Path::new(&args[3]);
        match native_commit::synthetic_transport_commit(target, source) {
            Ok(id) => {
                println!("NATIVE_SYNTHETIC_TRANSPORT_COMMITTED:{id}");
                return;
            }
            Err(code) => {
                // Only the enum is logged; no source bytes or paths.
                eprintln!("NATIVE_SYNTHETIC_TRANSPORT_REJECTED:{code}");
                std::process::exit(3);
            }
        }
    }
    if args.len() != 3 {
        eprintln!("NATIVE_GUARD_USAGE");
        std::process::exit(3);
    }
    #[cfg(windows)]
    {
        let root = std::path::Path::new(&args[2]);
        if args[1] == "--inspect" {
            if native::inspect(root).is_ok() {
                println!("NATIVE_DESTINATION_OK");
                return;
            }
            eprintln!("NATIVE_DESTINATION_REJECTED");
            std::process::exit(3);
        }
        if args[1] == "--verify-envelope" {
            if scientific_envelope::verify(root).is_ok() {
                println!("NATIVE_ENVELOPE_VERIFIED");
                return;
            }
            eprintln!("NATIVE_ENVELOPE_REJECTED");
            std::process::exit(3);
        }
        if args[1] == "--synthetic-commit" {
            match native_commit::synthetic_commit(root) {
                Ok(id) => {
                    println!("NATIVE_SYNTHETIC_COMMITTED:{id}");
                    return;
                }
                Err(code) => {
                    // Static error enum only; never log a filesystem path.
                    eprintln!("NATIVE_SYNTHETIC_COMMIT_REJECTED:{code}");
                    std::process::exit(3);
                }
            }
        }
        eprintln!("NATIVE_GUARD_USAGE");
        std::process::exit(3);
    }
    #[cfg(not(windows))]
    {
        eprintln!("NATIVE_GUARD_WINDOWS_REQUIRED");
        std::process::exit(3);
    }
}
