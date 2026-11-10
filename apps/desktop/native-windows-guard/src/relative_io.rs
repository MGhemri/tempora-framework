//! Windows-only test probe: relative creation of an exclusive file under a
//! previously pinned directory HANDLE. NOT a production scientific writer.
use std::ffi::{c_void,OsStr};
use std::fs::File;
use std::io::Write;
use std::os::windows::ffi::OsStrExt;
use std::os::windows::io::FromRawHandle;
use std::ptr::null_mut;
type Handle=isize;
const INVALID_HANDLE_VALUE:Handle=-1;
const GENERIC_WRITE:u32=0x40000000;
const SYNCHRONIZE:u32=0x00100000;
const FILE_SHARE_READ:u32=1;
const FILE_CREATE:u32=2;
const FILE_NON_DIRECTORY_FILE:u32=0x40;
const FILE_SYNCHRONOUS_IO_NONALERT:u32=0x20;
const FILE_OPEN_REPARSE_POINT:u32=0x00200000;
const OBJ_CASE_INSENSITIVE:u32=0x40;
#[repr(C)]
struct UnicodeString{length:u16,maximum_length:u16,buffer:*mut u16}
#[repr(C)]
struct ObjectAttributes{
 length:u32,root_directory:Handle,object_name:*mut UnicodeString,
 attributes:u32,security_descriptor:*mut c_void,
 security_quality_of_service:*mut c_void
}
#[repr(C)]
struct IoStatusBlock{status:isize,information:usize}
#[link(name="ntdll")]
extern "system"{
 fn NtCreateFile(file_handle:*mut Handle,desired_access:u32,
  object_attributes:*mut ObjectAttributes,io_status:*mut IoStatusBlock,
  allocation_size:*mut i64,file_attributes:u32,share_access:u32,
  create_disposition:u32,create_options:u32,ea_buffer:*mut c_void,
  ea_length:u32)->i32;
}
fn safe_leaf(name:&str)->bool{
 if name.is_empty()||name.len()>120||name.starts_with('.')||
    name.ends_with('.')||name.ends_with(' ')||
    !name.bytes().all(|b|b.is_ascii_lowercase()||b.is_ascii_digit()||
      b==b'.'||b==b'_'||b==b'-'){return false;}
 let base=name.split('.').next().unwrap_or("");
 !matches!(base,"con"|"prn"|"aux"|"nul"|"clock$"|
 "com1"|"com2"|"com3"|"com4"|"com5"|"com6"|"com7"|"com8"|"com9"|
 "lpt1"|"lpt2"|"lpt3"|"lpt4"|"lpt5"|"lpt6"|"lpt7"|"lpt8"|"lpt9")
}
pub(crate) fn exclusive_sync_at(parent:Handle,name:&str,bytes:&[u8])
 ->Result<(),&'static str>{
 if !safe_leaf(name){return Err("NATIVE_COMMIT_LEAF_UNSAFE");}
 let mut wide:Vec<u16>=OsStr::new(name).encode_wide().collect();
 let byte_len=wide.len().checked_mul(2).ok_or("NATIVE_COMMIT_LEAF_UNSAFE")?;
 if byte_len>u16::MAX as usize-2{return Err("NATIVE_COMMIT_LEAF_UNSAFE");}
 wide.push(0);
 let mut unicode=UnicodeString{length:byte_len as u16,
  maximum_length:(byte_len+2) as u16,buffer:wide.as_mut_ptr()};
 let mut attrs=ObjectAttributes{length:std::mem::size_of::<ObjectAttributes>() as u32,
  root_directory:parent,object_name:&mut unicode,
  attributes:OBJ_CASE_INSENSITIVE,security_descriptor:null_mut(),
  security_quality_of_service:null_mut()};
 let mut status=IoStatusBlock{status:0,information:0};
 let mut handle:Handle=INVALID_HANDLE_VALUE;
 let result=unsafe{NtCreateFile(&mut handle,GENERIC_WRITE|SYNCHRONIZE,
  &mut attrs,&mut status,null_mut(),0,FILE_SHARE_READ,FILE_CREATE,
  FILE_NON_DIRECTORY_FILE|FILE_SYNCHRONOUS_IO_NONALERT|FILE_OPEN_REPARSE_POINT,
  null_mut(),0)};
 if result<0||handle==INVALID_HANDLE_VALUE{
  return Err("NATIVE_COMMIT_RELATIVE_CREATE_FAILED");
 }
 // Own the kernel handle exactly once; write/flush never reopen by path.
 let mut file=unsafe{File::from_raw_handle(handle as *mut c_void)};
 file.write_all(bytes).map_err(|_|"NATIVE_COMMIT_WRITE_FAILED")?;
 file.sync_all().map_err(|_|"NATIVE_COMMIT_FILE_FLUSH_FAILED")?;
 Ok(())
}
#[cfg(test)]
mod tests{
 use super::*;
 use std::{fs,path::PathBuf,ptr::null_mut};
 const FILE_ADD_FILE:u32=2;
 const FILE_READ_ATTRIBUTES:u32=0x80;
 const OPEN_EXISTING:u32=3;
 const FILE_FLAG_BACKUP_SEMANTICS:u32=0x02000000;
 const FILE_FLAG_OPEN_REPARSE_POINT:u32=0x00200000;
 #[link(name="kernel32")]
 extern "system"{
  fn CreateFileW(name:*const u16,access:u32,share:u32,
   security:*mut c_void,creation:u32,flags:u32,template:Handle)->Handle;
  fn CloseHandle(handle:Handle)->i32;
 }
 #[test]
 fn invalid_child_names_fail_closed(){
  for bad in ["",".","..","../outside","..\\outside","x/y","x\\y",
   "x:stream","con","nul.txt","com1.json",".hidden","trailing.","x "]{
   assert!(!safe_leaf(bad),"accepted: {bad}");
  }
  for good in ["owner.txt","corpus.json","journal.json","manifest.json",
   "envelope.json","safe-name_2.json"]{
   assert!(safe_leaf(good),"rejected: {good}");
  }
 }
 #[test]
 fn nt_handle_relative_create_is_exclusive(){
  let dir=std::env::temp_dir().join(format!(
   "tempora-relative-test-{}-{}",std::process::id(),
   std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap()
    .as_nanos()));
  fs::create_dir(&dir).unwrap();
  let wide:Vec<u16>=dir.as_os_str().encode_wide()
   .chain(std::iter::once(0)).collect();
  let h=unsafe{CreateFileW(wide.as_ptr(),FILE_READ_ATTRIBUTES|FILE_ADD_FILE,
   FILE_SHARE_READ,null_mut(),OPEN_EXISTING,
   FILE_FLAG_BACKUP_SEMANTICS|FILE_FLAG_OPEN_REPARSE_POINT,0)};
  assert_ne!(h,INVALID_HANDLE_VALUE);
  exclusive_sync_at(h,"owner.txt",b"synthetic").unwrap();
  assert_eq!(fs::read(dir.join("owner.txt")).unwrap(),b"synthetic");
  assert_eq!(exclusive_sync_at(h,"owner.txt",b"overwritten"),
   Err("NATIVE_COMMIT_RELATIVE_CREATE_FAILED"));
  assert_eq!(fs::read(dir.join("owner.txt")).unwrap(),b"synthetic");
  assert_eq!(exclusive_sync_at(h,"../outside",b"escape"),
   Err("NATIVE_COMMIT_LEAF_UNSAFE"));
  unsafe{CloseHandle(h);}
  fs::remove_dir_all(dir).unwrap();
 }
}
