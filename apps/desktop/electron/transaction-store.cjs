'use strict';

// ASSIST-M1.5 isolated transaction-store prototype. NOT connected to Electron
// or the scientific worker; the caller must supply a validated SDK result.
// Directory rename is one logical visibility point, not a power-loss guarantee.
const fs = require('node:fs');
const path = require('node:path');
const {createHash, randomBytes} = require('node:crypto');

const HASH = /^[a-f0-9]{64}$/;
const ID = /^[a-f0-9]{32}$/;
const MAX_DOCUMENT_BYTES = 16 * 1024 * 1024;
const REQUIRED = ['batch_id','source_sha256','base_sha256','mapping_sha256','output_sha256'];
const ERR = code => Object.assign(new Error(code), {code});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const plain = obj => obj && typeof obj === 'object' && !Array.isArray(obj)
  && (Object.getPrototypeOf(obj) === Object.prototype || Object.getPrototypeOf(obj) === null);
function safeRoot(root) {
  if (typeof root !== 'string' || !path.isAbsolute(root)) throw ERR('TRANSACTION_ROOT_INVALID');
  const info = fs.lstatSync(root);
  if (!info.isDirectory() || info.isSymbolicLink()) throw ERR('TRANSACTION_ROOT_UNSAFE');
  if (fs.realpathSync(root) !== path.resolve(root)) throw ERR('TRANSACTION_ROOT_UNSAFE');
  return root;
}
function safeSubdir(parent, name, create=true) {
  const dir = path.join(parent, name);
  if (create) {
    try { fs.mkdirSync(dir, {mode:0o700}); }
    catch(e) { if(e.code!=='EEXIST') throw e; }
  }
  const st=fs.lstatSync(dir);
  if(!st.isDirectory() || st.isSymbolicLink() || fs.realpathSync(dir)!==path.resolve(dir))
    throw ERR('TRANSACTION_DIRECTORY_UNSAFE');
  return dir;
}
// Detect directory replacement with another *ordinary* directory at the
// same path, not just symlink/junction redirection. It is a best-effort
// filesystem identity guard, NOT a Windows handle-based security primitive.
function directoryIdentity(dir) {
  // bigint avoids precision loss for 64-bit Windows file IDs.
  const stat=fs.lstatSync(dir,{bigint:true});
  if(!stat.isDirectory()||stat.isSymbolicLink()||
     fs.realpathSync(dir)!==path.resolve(dir))
    throw ERR('TRANSACTION_DIRECTORY_UNSAFE');
  return Object.freeze({dev:stat.dev,ino:stat.ino});
}
function assertDirectoryIdentity(dir,identity) {
  const now=directoryIdentity(dir);
  // On a filesystem where Node exposes no stable file ID, refuse to claim
  // that a renamed/replaced directory is still the originally chosen one.
  if(typeof now.ino!=='bigint'||now.ino===0n||
     typeof identity?.ino!=='bigint'||identity.ino===0n||
     now.ino!==identity.ino||now.dev!==identity.dev)
    throw ERR('TRANSACTION_DIRECTORY_IDENTITY_CHANGED');
}
function jsonBytes(value) {
  if (!plain(value)) throw ERR('TRANSACTION_DOCUMENT_INVALID');
  const bytes = Buffer.from(JSON.stringify(value)+'\n','utf8');
  if (bytes.length > MAX_DOCUMENT_BYTES) throw ERR('TRANSACTION_DOCUMENT_LIMIT');
  return bytes;
}
function validateInput({corpus,journal,identity}, canonical) {
  if (!canonical || typeof canonical.validateCorpus !== 'function' ||
      typeof canonical.digest !== 'function') throw ERR('TRANSACTION_CANONICAL_ADAPTER_REQUIRED');
  if (!plain(identity) || !plain(corpus) || !plain(journal)) throw ERR('TRANSACTION_INPUT_INVALID');
  if (!REQUIRED.every(k => typeof identity[k]==='string' && HASH.test(identity[k])))
    throw ERR('TRANSACTION_DIGEST_INVALID');
  if (Object.keys(identity).some(k=>!REQUIRED.includes(k))) throw ERR('TRANSACTION_IDENTITY_EXTRA');
  const validation=canonical.validateCorpus(corpus);
  if (!validation || validation.valid !== true) throw ERR('TRANSACTION_CORPUS_INVALID');
  if (canonical.digest(corpus) !== identity.output_sha256)
    throw ERR('TRANSACTION_CANONICAL_DIGEST_MISMATCH');
  if (journal.output_sha256 !== identity.output_sha256 ||
      journal.base_sha256 !== identity.base_sha256 ||
      journal.decision !== 'accepted_for_local_staging' ||
      journal.scientific_approval !== false ||
      journal.batch_id !== identity.batch_id)
    throw ERR('TRANSACTION_JOURNAL_MISMATCH');
  // This layer checks byte identity and envelope. Full canonical validation
  // remains the mandatory responsibility of the trusted SDK adapter.
  return {corpusBytes:jsonBytes(corpus),journalBytes:jsonBytes(journal)};
}
function writeExclusive(dir,name,bytes) {
  const file=path.join(dir,name);
  const fd=fs.openSync(file,fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_WRONLY,0o600);
  try { let offset=0; while(offset<bytes.length) offset+=fs.writeSync(fd,bytes,offset,bytes.length-offset); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
}
function readBounded(file) {
  // O_NOFOLLOW is available on Unix; on Windows we also inspect both the
  // path (lstat) and the opened handle (fstat). This reduces but cannot
  // eliminate all Windows filesystem races without a native handle API.
  const before=fs.lstatSync(file,{bigint:true});
  if(!before.isFile()||before.isSymbolicLink()||
     before.size>BigInt(MAX_DOCUMENT_BYTES))
    throw ERR('TRANSACTION_FILE_UNSAFE');
  const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
  try {
    const opened=fs.fstatSync(fd,{bigint:true});
    if(!opened.isFile()||opened.size>BigInt(MAX_DOCUMENT_BYTES)||
       (before.ino!==0n&&opened.ino!==0n&&before.ino!==opened.ino))
      throw ERR('TRANSACTION_FILE_UNSAFE');
    // Never use readFileSync(fd): another process could append after fstat,
    // causing unbounded memory allocation before the size check.
    const chunks=[],chunk=Buffer.allocUnsafe(64*1024);
    let total=0;
    while(true){
      const remaining=MAX_DOCUMENT_BYTES+1-total;
      if(remaining<=0)throw ERR('TRANSACTION_DOCUMENT_LIMIT');
      const read=fs.readSync(fd,chunk,0,Math.min(chunk.length,remaining),null);
      if(read===0)break;
      total+=read;
      if(total>MAX_DOCUMENT_BYTES)throw ERR('TRANSACTION_DOCUMENT_LIMIT');
      chunks.push(Buffer.from(chunk.subarray(0,read)));
    }
    return Buffer.concat(chunks,total);
  } finally {fs.closeSync(fd);}
}
function readVerified(dir,name,expected) {
  const bytes=readBounded(path.join(dir,name));
  if(sha(bytes)!==expected)throw ERR('TRANSACTION_INTEGRITY_MISMATCH');
  return JSON.parse(bytes.toString('utf8'));
}
// Exclusive filesystem reservation shared by independent TEMPORA processes.
// The directory is never deleted on startup. After a crash, an operator must
// inspect and recover it explicitly; a PID or age is not proof of ownership.
const LOCK_NAME='.writer-lock';
function withWriterReservation(root,work) {
  const lock=path.join(root,LOCK_NAME),nonce=randomBytes(16).toString('hex');
  try {fs.mkdirSync(lock,{mode:0o700});}
  catch(e) {
    if(e.code==='EEXIST')throw ERR('TRANSACTION_WRITER_BUSY');
    throw e;
  }
  // Bind cleanup to the original lock DIRECTORY, not only its JSON nonce.
  // A copied owner.json in a replacement directory must never authorize
  // unlinking a lock that this process did not create.
  const lockIdentity=directoryIdentity(lock);
  const rootIdentity=directoryIdentity(root);
  const ownerFile=path.join(lock,'owner.json');
  const owner=Buffer.from(JSON.stringify({schema_version:'1.0.0',nonce})+'\n');
  let owned=false;
  try {
    writeExclusive(lock,'owner.json',owner);
    owned=true;
    return work();
  } finally {
    // If an adversary replaced the lock or changed ownership, leave it as
    // evidence and fail closed. No blind recursive removal.
    if(owned) {
      try{
        assertDirectoryIdentity(root,rootIdentity);
        assertDirectoryIdentity(lock,lockIdentity);
      }catch{
        throw ERR('TRANSACTION_WRITER_OWNERSHIP_LOST');
      }
      const files=fs.readdirSync(lock);
      if(files.length!==1||files[0]!=='owner.json'||
         !readBounded(ownerFile).equals(owner))
        throw ERR('TRANSACTION_WRITER_OWNERSHIP_LOST');
      fs.unlinkSync(ownerFile);
      fs.rmdirSync(lock);
    }
    // If owner writing failed, leave a reservation for manual recovery.
  }
}

// Inspection only: never delete, rename or reclaim a reservation.
function inspectWriterReservation(root) {
  safeRoot(root);
  const lock=path.join(root,LOCK_NAME);
  try {fs.lstatSync(lock);}
  catch(e) {
    if(e.code==='ENOENT')return Object.freeze({status:'absent'});
    throw e;
  }
  try {
    const stat=fs.lstatSync(lock);
    if(!stat.isDirectory()||stat.isSymbolicLink()||
       fs.realpathSync(lock)!==path.resolve(lock))
      return Object.freeze({status:'unsafe'});
    const names=fs.readdirSync(lock);
    if(names.length!==1||names[0]!=='owner.json')
      return Object.freeze({status:'unsafe'});
    const bytes=readBounded(path.join(lock,'owner.json'));
    if(bytes.length>1024)return Object.freeze({status:'unsafe'});
    const owner=JSON.parse(bytes.toString('utf8'));
    if(!plain(owner)||owner.schema_version!=='1.0.0'||
       typeof owner.nonce!=='string'||!ID.test(owner.nonce))
      return Object.freeze({status:'unsafe'});
    return Object.freeze({status:'reserved'});
  } catch {return Object.freeze({status:'unsafe'});}
}

function createTransaction(root, {corpus,journal,identity}, canonical) {
  // A write destination must be a dedicated local directory, never the
  // filesystem root or a Windows UNC/device path. Network/mapped drives
  // remain a separate qualification gate, not a trust guarantee here.
  if(typeof root!=='string'||!path.isAbsolute(root))
    throw ERR('TRANSACTION_ROOT_INVALID');
  const normalized=path.resolve(root);
  if(normalized===path.parse(normalized).root||
     (process.platform==='win32'&&
      (root.startsWith('\\\\')||root.startsWith('\\\\?\\'))))
    throw ERR('TRANSACTION_ROOT_UNSAFE');
  safeRoot(root);
  const {corpusBytes,journalBytes}=validateInput({corpus,journal,identity}, canonical);
  return withWriterReservation(root,()=>{
  // Reject an exact replay while holding the cross-process reservation.
  // A different reviewed selection may legitimately yield a different
  // output for the same source batch, so compare all identity digests.
  const prior=inspectTransactions(root,canonical);
  if(prior.invalid.length)throw ERR('TRANSACTION_PREEXISTING_INVALID');
  // Orphaned pending folders indicate an incomplete or interrupted commit.
  // Never silently create another transaction until they are reviewed.
  if(prior.pending.length)throw ERR('TRANSACTION_PENDING_RECOVERY_REQUIRED');
  for(const id of prior.complete) {
    const file=path.join(root,'transactions',id,'manifest.json');
    const existing=JSON.parse(readBounded(file).toString('utf8'));
    if(REQUIRED.every(k=>existing[k]===identity[k]))
      throw ERR('TRANSACTION_ALREADY_COMMITTED');
  }
  const pendingRoot=safeSubdir(root,'.pending');
  const transactions=safeSubdir(root,'transactions');
  const transaction_id=randomBytes(16).toString('hex');
  const pending=path.join(pendingRoot,transaction_id);
  fs.mkdirSync(pending,{mode:0o700});
  // Snapshot the actual directories after the writer reservation is held.
  const rootIdentity=directoryIdentity(root);
  const pendingRootIdentity=directoryIdentity(pendingRoot);
  const transactionRootIdentity=directoryIdentity(transactions);
  const pendingIdentity=directoryIdentity(pending);
  let committed=false;
  try {
    const manifest={
      schema_version:'1.0.0',transaction_id,
      ...identity,engine_version:'3.0.0',
      corpus_file_sha256:sha(corpusBytes),journal_sha256:sha(journalBytes),
      published:false,scientific_approval:false
    };
    const manifestBytes=jsonBytes(manifest);
    writeExclusive(pending,'corpus.json',corpusBytes);
    writeExclusive(pending,'journal.json',journalBytes);
    writeExclusive(pending,'manifest.json',manifestBytes);
    readVerified(pending,'corpus.json',manifest.corpus_file_sha256);
    readVerified(pending,'journal.json',manifest.journal_sha256);
    readVerified(pending,'manifest.json',sha(manifestBytes));
    // Re-check every path component immediately before the visible rename.
    // These checks narrow the substitution window but do not eliminate
    // Windows reparse-point TOCTOU without native handle-based APIs.
    safeRoot(root);
    safeSubdir(root,'.pending',false);
    safeSubdir(root,'transactions',false);
    assertDirectoryIdentity(root,rootIdentity);
    assertDirectoryIdentity(pendingRoot,pendingRootIdentity);
    assertDirectoryIdentity(transactions,transactionRootIdentity);
    assertDirectoryIdentity(pending,pendingIdentity);
    // A non-existing directory is the single logical commit marker.
    const destination=path.join(transactions,transaction_id);
    if(fs.existsSync(destination))throw ERR('TRANSACTION_COLLISION');
    fs.renameSync(pending,destination);
    committed=true;
    return Object.freeze({schema_version:'1.0.0',scope:'local_canonical_import',
      transaction_id,batch_id:identity.batch_id,
      source_sha256:identity.source_sha256,base_sha256:identity.base_sha256,
      output_sha256:identity.output_sha256,journal_sha256:manifest.journal_sha256,
      saved_to_disk:true,integrity_verified:true,published:false,scientific_approval:false});
  } finally {
    // Deliberately leave failed .pending directories for explicit recovery.
    // Never delete a partially written transaction automatically.
    if (!committed) { /* preserve evidence */ }
  }
  });
}
function inspectTransactions(root, canonical) {
  if (!canonical || typeof canonical.validateCorpus !== 'function' ||
      typeof canonical.digest !== 'function') throw ERR('TRANSACTION_CANONICAL_ADAPTER_REQUIRED');
  safeRoot(root);
  const transactionsPath=path.join(root,'transactions'),pendingPath=path.join(root,'.pending');
  const hasTransactions=fs.existsSync(transactionsPath),hasPending=fs.existsSync(pendingPath);
  if(!hasTransactions && !hasPending)return Object.freeze({complete:[],invalid:[],pending:[]});
  const transactions=hasTransactions?safeSubdir(root,'transactions',false):null;
  const pendingRoot=hasPending?safeSubdir(root,'.pending',false):null;
  const complete=[],invalid=[],pending=[];
  for(const id of (transactions?fs.readdirSync(transactions):[]).sort()) {
    if(!ID.test(id)){ invalid.push(id);continue; }
    try {
      const dir=path.join(transactions,id),st=fs.lstatSync(dir);
      if(!st.isDirectory()||st.isSymbolicLink()||
        fs.realpathSync(dir)!==path.resolve(dir))throw ERR('TRANSACTION_DIRECTORY_UNSAFE');
      const expectedFiles=['corpus.json','journal.json','manifest.json'];
      const actualFiles=fs.readdirSync(dir).sort();
      if(actualFiles.length!==expectedFiles.length||
         actualFiles.some((name,i)=>name!==expectedFiles[i]))
        throw ERR('TRANSACTION_UNEXPECTED_CONTENTS');
      const mf=readBounded(path.join(dir,'manifest.json'));
      const manifest=JSON.parse(mf.toString('utf8'));
      if(!plain(manifest)||manifest.transaction_id!==id||!HASH.test(manifest.corpus_file_sha256)||
         !HASH.test(manifest.journal_sha256)||manifest.published!==false||
         manifest.scientific_approval!==false||
         !REQUIRED.every(k=>typeof manifest[k]==='string'&&HASH.test(manifest[k])))
        throw ERR('TRANSACTION_MANIFEST_INVALID');
      const corpus=readVerified(dir,'corpus.json',manifest.corpus_file_sha256);
      const journal=readVerified(dir,'journal.json',manifest.journal_sha256);
      if(!plain(corpus)||!plain(journal)||journal.batch_id!==manifest.batch_id||
        journal.base_sha256!==manifest.base_sha256||
        journal.decision!=='accepted_for_local_staging'||
        journal.scientific_approval!==false||
        journal.output_sha256!==manifest.output_sha256)throw ERR('TRANSACTION_JOURNAL_MISMATCH');
      const validation=canonical.validateCorpus(corpus);
      if(!validation||validation.valid!==true||canonical.digest(corpus)!==manifest.output_sha256)
        throw ERR('TRANSACTION_CANONICAL_DIGEST_MISMATCH');
      complete.push(id);
    } catch {invalid.push(id);}
  }
  for(const id of (pendingRoot?fs.readdirSync(pendingRoot):[]).sort())pending.push(id);
  return Object.freeze({complete,invalid,pending});
}
// Read-only forensic classification of orphaned commits. A structurally
// complete pending directory is NOT automatically recoverable or approved.
function inspectPendingEvidence(root,canonical) {
  if(!canonical||typeof canonical.validateCorpus!=='function'||
     typeof canonical.digest!=='function')
    throw ERR('TRANSACTION_CANONICAL_ADAPTER_REQUIRED');
  safeRoot(root);
  const location=path.join(root,'.pending');
  try {fs.lstatSync(location);}
  catch(e) {
    if(e.code==='ENOENT')
      return Object.freeze({verified_for_review:[],incomplete:[],unsafe:[]});
    throw e;
  }
  const pending=safeSubdir(root,'.pending',false);
  const verified_for_review=[],incomplete=[],unsafe=[];
  const expected=['corpus.json','journal.json','manifest.json'];
  for(const id of fs.readdirSync(pending).sort()) {
    try {
      if(!ID.test(id))throw ERR('TRANSACTION_DIRECTORY_UNSAFE');
      const dir=path.join(pending,id),stat=fs.lstatSync(dir);
      if(!stat.isDirectory()||stat.isSymbolicLink()||
         fs.realpathSync(dir)!==path.resolve(dir))
        throw ERR('TRANSACTION_DIRECTORY_UNSAFE');
      const names=fs.readdirSync(dir).sort();
      if(names.some(n=>!expected.includes(n)))
        throw ERR('TRANSACTION_UNEXPECTED_CONTENTS');
      if(names.length!==expected.length||
         expected.some(n=>!names.includes(n))) {
        incomplete.push(id);
        continue;
      }
      const manifest=JSON.parse(readBounded(path.join(dir,'manifest.json')).toString('utf8'));
      if(!plain(manifest)||manifest.transaction_id!==id||
         !HASH.test(manifest.corpus_file_sha256)||
         !HASH.test(manifest.journal_sha256)||
         manifest.published!==false||manifest.scientific_approval!==false||
         !REQUIRED.every(k=>typeof manifest[k]==='string'&&HASH.test(manifest[k])))
        throw ERR('TRANSACTION_MANIFEST_INVALID');
      const corpus=readVerified(dir,'corpus.json',manifest.corpus_file_sha256);
      const journal=readVerified(dir,'journal.json',manifest.journal_sha256);
      if(!plain(corpus)||!plain(journal)||
         journal.batch_id!==manifest.batch_id||
         journal.base_sha256!==manifest.base_sha256||
         journal.output_sha256!==manifest.output_sha256||
         journal.decision!=='accepted_for_local_staging'||
         journal.scientific_approval!==false)
        throw ERR('TRANSACTION_JOURNAL_MISMATCH');
      if(canonical.validateCorpus(corpus)?.valid!==true||
         canonical.digest(corpus)!==manifest.output_sha256)
        throw ERR('TRANSACTION_CANONICAL_DIGEST_MISMATCH');
      verified_for_review.push(id);
    }catch{unsafe.push(id);}
  }
  return Object.freeze({verified_for_review,incomplete,unsafe});
}

module.exports={createTransaction,inspectTransactions,inspectWriterReservation,inspectPendingEvidence};
