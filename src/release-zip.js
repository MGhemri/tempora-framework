// ZIP STORE: fixed headers, sorted ASCII paths, CRC-32 and no platform metadata.
// No timestamps or compression library versions can change the archive bytes.
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function safeName(name){return /^[A-Za-z0-9_./-]+$/.test(name)&&!name.startsWith('/')&&!name.split('/').some(p=>!p||p==='.'||p==='..');}
function zip(files){
  const local=[],central=[];let offset=0;
  for(const name of Object.keys(files).sort()){
    if(!safeName(name))throw Error('Unsafe archive path');
    const bytes=Buffer.from(files[name]),n=Buffer.from(name),crc=crc32(bytes),h=Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt16LE(0x21,12);
    h.writeUInt32LE(crc,14);h.writeUInt32LE(bytes.length,18);h.writeUInt32LE(bytes.length,22);h.writeUInt16LE(n.length,26);
    const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt16LE(0x21,14);
    c.writeUInt32LE(crc,16);c.writeUInt32LE(bytes.length,20);c.writeUInt32LE(bytes.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);
    local.push(h,n,bytes);central.push(c,n);offset+=h.length+n.length+bytes.length;
  }
  if(local.length/3>65535)throw Error('Too many archive files');
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(local.length/3,8);end.writeUInt16LE(local.length/3,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,directory,end]);
}
function unzip(bytes){
  const files={};let offset=0;
  while(offset+30<=bytes.length&&bytes.readUInt32LE(offset)===0x04034b50){
    const method=bytes.readUInt16LE(offset+8),size=bytes.readUInt32LE(offset+18),rawSize=bytes.readUInt32LE(offset+22),n=bytes.readUInt16LE(offset+26),extra=bytes.readUInt16LE(offset+28);
    const name=bytes.subarray(offset+30,offset+30+n).toString('utf8'),start=offset+30+n+extra,end=start+size;
    if(method!==0||size!==rawSize||end>bytes.length||!safeName(name)||Object.hasOwn(files,name))throw Error('Invalid ZIP entry');
    const data=bytes.subarray(start,end);if(crc32(data)!==bytes.readUInt32LE(offset+14))throw Error('ZIP CRC mismatch');files[name]=data;offset=end;
  }
  // Reconstructing verifies the central directory and all deterministic headers too.
  if(!zip(files).equals(bytes))throw Error('Non-canonical or damaged release ZIP');
  return files;
}
module.exports={zip,unzip,crc32};
