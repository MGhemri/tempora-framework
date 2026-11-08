import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,symlink,rm,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {appendFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {preflightSelectedFile,MAX_BYTES}=require('../../bridge/visualization/file-preflight.cjs');

async function temporary(run){
  const dir=await mkdtemp(join(tmpdir(),'tempora-j8e-'));
  try{return await run(dir);}finally{await rm(dir,{recursive:true,force:true});}
}
test('J8E streams raw bytes with deterministic SHA and no canonical interpretation',async()=>{
  await temporary(async dir=>{
    const name=join(dir,'fictional.geojson');
    const bytes=Buffer.from('{"type":"FeatureCollection","features":[],"description":"épreuve"}\n','utf8');
    await writeFile(name,bytes);
    const before=await readFile(name);
    const result=await preflightSelectedFile(name,{chunkBytes:7});
    assert.equal(result.byte_count,bytes.length);
    assert.equal(result.raw_sha256,createHash('sha256').update(bytes).digest('hex'));
    assert.equal(result.canonical_validated,false);
    assert.equal(result.interpretation,'raw-file-bytes-only');
    assert.equal(result.format,'geojson');
    assert.equal(result.selectedPath,undefined);
    assert.deepEqual(await readFile(name),before);
    assert.deepEqual(await preflightSelectedFile(name,{chunkBytes:23}),{...result});
    assert.ok(Object.isFrozen(result));
  });
});
test('J8E refuses oversized input without reading entire document into the renderer',async()=>{
  await temporary(async dir=>{
    const file=join(dir,'big.json');
    await writeFile(file,Buffer.alloc(1025));
    await assert.rejects(preflightSelectedFile(file,{maxBytes:1024}),/PREFLIGHT_INPUT_LIMIT/);
    assert.ok(MAX_BYTES<=64*1024*1024);
    await assert.rejects(preflightSelectedFile(file,{maxBytes:MAX_BYTES+1}),/PREFLIGHT_INVALID_LIMIT/);
    await assert.rejects(preflightSelectedFile(file,{chunkBytes:1024*1024+1}),/PREFLIGHT_INVALID_LIMIT/);
  });
});
test('J8E blocks non-picker-looking paths, wrong formats, empty files and options',async()=>{
  await temporary(async dir=>{
    const data=join(dir,'data.json'),empty=join(dir,'empty.json'),txt=join(dir,'data.txt');
    await writeFile(data,'{}');
    await writeFile(empty,'');
    await writeFile(txt,'{}');
    await assert.rejects(preflightSelectedFile('data.json'),/PREFLIGHT_NATIVE_PICKER_PATH_REQUIRED/);
    await assert.rejects(preflightSelectedFile(txt),/PREFLIGHT_UNSUPPORTED_FORMAT/);
    await assert.rejects(preflightSelectedFile(empty),/PREFLIGHT_INPUT_LIMIT/);
    await assert.rejects(preflightSelectedFile(data,{other:1}),/PREFLIGHT_INVALID_OPTIONS/);
    await assert.rejects(preflightSelectedFile(data,{signal:{}}),/PREFLIGHT_INVALID_SIGNAL/);
    const controller=new AbortController();
    controller.abort();
    await assert.rejects(preflightSelectedFile(data,{signal:controller.signal}),/PREFLIGHT_CANCELLED/);
  });
});
test('J8E refuses symlink redirection and never reports historical confidence',async()=>{
  await temporary(async dir=>{
    const data=join(dir,'data.json'),link=join(dir,'redirect.json');
    await writeFile(data,'{}');
    await symlink(data,link);
    await assert.rejects(preflightSelectedFile(link),/PREFLIGHT_NOT_REGULAR_FILE/);
    const result=await preflightSelectedFile(data);
    assert.equal(Object.hasOwn(result,'historical_confidence'),false);
    assert.equal(Object.hasOwn(result,'canonical_sha256'),false);
  });
});

test('J8E detects file size mutation during chunk streaming and never returns a misleading digest',async()=>{
  await temporary(async dir=>{
    const file=join(dir,'changed-during-read.json');
    await writeFile(file,Buffer.from('{"safe":"synthetic"}'));
    let polls=0;
    const signal={
      get aborted(){
        if(++polls===3)appendFileSync(file,' ');
        return false;
      }
    };
    await assert.rejects(preflightSelectedFile(file,{signal,chunkBytes:2}),
      /PREFLIGHT_FILE_CHANGED/);
    assert.ok(polls>=3);
  });
});
