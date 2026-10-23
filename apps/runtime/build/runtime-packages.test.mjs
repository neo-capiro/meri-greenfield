/** Offline vendor integrity and architecture checks; pip owns installation/resolution. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const lock=JSON.parse(fs.readFileSync(path.join(root,'infra/product-preview/runtime-wheels.lock.json')));
const directory=path.join(root,'infra/product-preview/runtime-packages/wheels');

test('retained wheels match every upstream identity, size and SHA256 without extra archives',()=>{
  assert.equal(lock.platform,'linux/arm64');assert.equal(lock.pythonMinor,'3.13');
  assert.equal(lock.wheels.length,22);assert.equal(new Set(lock.wheels.map(row=>row.name.toLowerCase())).size,22);
  assert.deepEqual(fs.readdirSync(directory).sort(),lock.wheels.map(row=>row.file).sort());
  for(const row of lock.wheels){
    assert.match(row.url,/^https:\/\/files\.pythonhosted\.org\/packages\//);
    assert(row.file.endsWith('none-any.whl')||(row.file.includes('cp313-cp313-manylinux')&&row.file.includes('aarch64')));
    const bytes=fs.readFileSync(path.join(directory,row.file));
    assert.equal(bytes.length,row.bytes,row.name);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256,row.name);
  }
});
test('wheel metadata versions and compiled payloads are actually ARM64',()=>{
  const source=String.raw`
import email,json,pathlib,struct,sys,zipfile
lock=json.loads(pathlib.Path(sys.argv[1]).read_text());count=0
for row in lock['wheels']:
 with zipfile.ZipFile(pathlib.Path(sys.argv[2])/row['file']) as archive:
  metadata=[name for name in archive.namelist() if name.endswith('.dist-info/METADATA')]
  assert len(metadata)==1
  parsed=email.message_from_bytes(archive.read(metadata[0]))
  assert parsed['Version']==row['version']
  assert parsed['Name'].lower().replace('-','_')==row['name'].lower().replace('-','_')
  for name in archive.namelist():
   if '.so' in pathlib.PurePosixPath(name).name:
    with archive.open(name) as member: header=member.read(64)
    if header[:4]==b'\x7fELF':
     assert header[4:6]==b'\x02\x01' and struct.unpack_from('<H',header,18)[0]==183,name
     count+=1
assert count>0
print(json.dumps({'arm64ELFPayloads':count,'wheelMetadata':len(lock['wheels'])}))
`;
  const result=JSON.parse(execFileSync('python',['-I','-B','-c',source,path.join(root,'infra/product-preview/runtime-wheels.lock.json'),directory],{encoding:'utf8',timeout:30000,maxBuffer:65536}));
  assert.equal(result.wheelMetadata,22);assert(result.arm64ELFPayloads>0);
});
