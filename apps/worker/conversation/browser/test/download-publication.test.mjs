/** The real browser download caller over the real ArtifactService publication owner: a file leaving the browser
 * output directory becomes one immutable artifact version and exactly one browser.download receipt. The external
 * boundaries (authority, retention, receipts) are inert; the store, validators and version CAS are the canonical ones. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readdir,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {artifactHarness,context} from '../../../../artifacts/test/artifact-harness.mjs';
import {createDownloadPort} from '../downloads.mjs';
import {validateBrowserPolicy} from '../policy.mjs';
import {createBrowserArtifactPort} from '../../../../runtime/artifacts/browser-artifacts.mjs';

const sha256=b=>createHash('sha256').update(b).digest('hex');

test('an accepted download is published once and receipted with its exact version',async t=>{
 const {service}=await artifactHarness(t),ctx=context();
 const dir=await realpath(await mkdtemp(join(tmpdir(),'meri-browser-download-')));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const body=Buffer.from('hello browser import\n','utf8');
 await writeFile(join(dir,'notes.txt'),body);
 const receipts=[];
 const port=createDownloadPort({binding:ctx.binding,policy:validateBrowserPolicy({enabled:true,allowedOrigins:['https://app.capiro.example']}),
  policySha256:'a'.repeat(64),sourceScopes:ctx.scopes,paths:{output:dir},
  artifacts:createBrowserArtifactPort({service,deadlineMs:()=>Date.now()+60000,maxBytes:8388608}),
  receipts:{async record(r){receipts.push(r);}},now:Date.now,assertCurrent:async()=>{}});
 const stored=await port.accept({filename:'notes.txt',url:'https://app.capiro.example/files/notes.txt'});
 assert.equal(stored.sha256,sha256(body));
 assert.equal(stored.bytes,body.length);
 assert.equal(stored.mimeType,'text/plain; charset=utf-8');
 assert.equal(receipts.length,1);
 assert.equal(receipts[0].kind,'browser.download');
 assert.equal(receipts[0].reference,stored.versionId);
 assert.equal(receipts[0].sha256,sha256(body));
 assert.deepEqual(await readdir(dir),[],'the local file leaves the output directory');
 const read=await service.download(stored.versionId,ctx);
 assert.deepEqual(Buffer.from(read.bytes),body);
});

test('a second download of the same name is refused while a new name publishes its own version',async t=>{
 const {service}=await artifactHarness(t),ctx=context();
 const dir=await realpath(await mkdtemp(join(tmpdir(),'meri-browser-download-')));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const port=createDownloadPort({binding:ctx.binding,policy:validateBrowserPolicy({enabled:true,allowedOrigins:['https://app.capiro.example']}),
  policySha256:'a'.repeat(64),sourceScopes:ctx.scopes,paths:{output:dir},
  artifacts:createBrowserArtifactPort({service,deadlineMs:()=>Date.now()+60000,maxBytes:8388608}),
  receipts:{async record(){}},now:Date.now,assertCurrent:async()=>{}});
 await writeFile(join(dir,'notes.txt'),'first\n');
 const first=await port.accept({filename:'notes.txt',url:'https://app.capiro.example/a'});
 await writeFile(join(dir,'notes.txt'),'second\n');
 await assert.rejects(()=>port.accept({filename:'notes.txt',url:'https://app.capiro.example/b'}),/BROWSER_DOWNLOAD_DUPLICATE/u);
 await writeFile(join(dir,'other.txt'),'other\n');
 const other=await port.accept({filename:'other.txt',url:'https://app.capiro.example/c'});
 assert.notEqual(other.versionId,first.versionId);
 assert.deepEqual(Buffer.from((await service.download(other.versionId,ctx)).bytes),Buffer.from('other\n'));
});
