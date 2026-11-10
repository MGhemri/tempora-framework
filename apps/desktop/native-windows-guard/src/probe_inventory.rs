//! Consultative, read-only native NTFS probe inventory.
//! Counts only: never authorizes production recovery or exposes corpus data.
use serde::Serialize;
use serde_json::Value;
use std::{fs, path::Path};
use std::os::windows::fs::MetadataExt;

const LIMIT: usize=100;
const REPARSE:u32=0x400;
#[derive(Serialize)]
pub struct Inventory {
    schema_version:&'static str,
    lock_status:&'static str,
    committed_verified:usize,
    pending_complete:usize,
    pending_incomplete:usize,
    unsafe_entries:usize,
    requires_manual_attention:bool,
    inspected_only:bool,
    files_modified:bool,
    production_recovery_authorized:bool,
}
fn safe_dir(dir:&Path)->Result<bool,&'static str>{
    match fs::symlink_metadata(dir){
        Ok(m) => {
            if !m.file_type().is_dir() || m.file_attributes()&REPARSE!=0 {
                return Err("NATIVE_PROBE_DIRECTORY_UNSAFE");
            }
            crate::native::inspect(dir).map_err(|_|"NATIVE_PROBE_DIRECTORY_UNSAFE")?;
            Ok(true)
        }
        Err(e) if e.kind()==std::io::ErrorKind::NotFound=>Ok(false),
        Err(_)=>Err("NATIVE_PROBE_DIRECTORY_UNREADABLE"),
    }
}
fn is_id(name:&str)->bool{
    name.len()==32 && name.bytes().all(|b| b.is_ascii_digit()||(b'a'..=b'f').contains(&b))
}
fn verified(dir:&Path)->Result<bool,&'static str>{
    if !safe_dir(dir)? {return Err("NATIVE_PROBE_DIRECTORY_UNSAFE");}
    let mut manifest=match crate::scientific_envelope::open_pinned(&dir.join("manifest.json"),false){
        Ok(file)=>file,
        Err(_)=>return Ok(false),
    };
    let bytes=crate::scientific_envelope::bounded_json(&mut manifest)
        .map_err(|_|"NATIVE_PROBE_MANIFEST_UNSAFE")?;
    if bytes.len()>4096 {return Err("NATIVE_PROBE_MANIFEST_UNSAFE");}
    let meta:Value=serde_json::from_slice(&bytes)
        .map_err(|_|"NATIVE_PROBE_MANIFEST_UNSAFE")?;
    if meta.get("synthetic").and_then(Value::as_bool)!=Some(true)||
       meta.get("published").and_then(Value::as_bool)!=Some(false){
        return Err("NATIVE_PROBE_MANIFEST_UNSAFE");
    }
    match meta.get("kind").and_then(Value::as_str){
        Some("NTFS_SCIENTIFIC_TRANSPORT_PROBE")=>{
            crate::scientific_envelope::load_verified(dir)
                .map_err(|_|"NATIVE_PROBE_TRANSPORT_INVALID")?;
        }
        Some("NTFS_HANDLE_RENAME_PROBE")=>{
            for name in ["corpus.json","journal.json"]{
                let data=fs::symlink_metadata(dir.join(name))
                    .map_err(|_|"NATIVE_PROBE_CONTENT_INVALID")?;
                if !data.file_type().is_file()||data.file_attributes()&REPARSE!=0||
                   data.len()==0||data.len()>4096 {
                    return Err("NATIVE_PROBE_CONTENT_INVALID");
                }
            }
        }
        _=>return Err("NATIVE_PROBE_MANIFEST_UNSAFE")
    }
    Ok(true)
}
fn children(dir:&Path,completed:bool,report:&mut Inventory)->Result<(),&'static str>{
    if !safe_dir(dir)? {return Ok(());}
    let mut names=Vec::new();
    for item in fs::read_dir(dir).map_err(|_|"NATIVE_PROBE_ENUM_FAILED")? {
        let item=item.map_err(|_|"NATIVE_PROBE_ENUM_FAILED")?;
        if names.len()>=LIMIT{return Err("NATIVE_PROBE_INVENTORY_LIMIT");}
        names.push(item.file_name());
        let name=item.file_name();
        let id=match name.to_str(){Some(n) if is_id(n)=>n,_=>{
            report.unsafe_entries+=1;continue;
        }};
        let _=id;
        match verified(&item.path()){
            Ok(true) if completed=>report.committed_verified+=1,
            Ok(true)=>report.pending_complete+=1,
            Ok(false) if !completed=>report.pending_incomplete+=1,
            _=>report.unsafe_entries+=1,
        }
    }
    // Detect a changed set of directory entries before issuing a report.
    let mut after=Vec::new();
    for item in fs::read_dir(dir).map_err(|_|"NATIVE_PROBE_ENUM_FAILED")?{
        let item=item.map_err(|_|"NATIVE_PROBE_ENUM_FAILED")?;
        if after.len()>=LIMIT{return Err("NATIVE_PROBE_INVENTORY_LIMIT");}
        after.push(item.file_name());
    }
    names.sort();after.sort();
    if names!=after{return Err("NATIVE_PROBE_SNAPSHOT_CHANGED");}
    Ok(())
}
pub fn inspect(root:&Path)->Result<Inventory,&'static str>{
    let _pinned=crate::native::inspect_pinned(root)?;
    let lock=root.join(".native-probe-lock");
    let lock_status=if safe_dir(&lock)?{
        let mut owner=crate::scientific_envelope::open_pinned(&lock.join("owner.txt"),false)
            .map_err(|_|"NATIVE_PROBE_OWNER_UNSAFE")?;
        let bytes=crate::scientific_envelope::bounded_json(&mut owner)
            .map_err(|_|"NATIVE_PROBE_OWNER_UNSAFE")?;
        if bytes.len()!=32 || !bytes.iter().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase()){
            return Err("NATIVE_PROBE_OWNER_UNSAFE");
        }
        "reserved"
    } else {"absent"};
    let mut report=Inventory{schema_version:"tempora-native-probe-inventory-v1",
        lock_status,committed_verified:0,pending_complete:0,
        pending_incomplete:0,unsafe_entries:0,requires_manual_attention:false,
        inspected_only:true,files_modified:false,production_recovery_authorized:false};
    children(&root.join(".native-probe-pending"),false,&mut report)?;
    children(&root.join("native-probe-complete"),true,&mut report)?;
    report.requires_manual_attention=lock_status!="absent" ||
        report.pending_complete>0||report.pending_incomplete>0||report.unsafe_entries>0;
    Ok(report)
}
