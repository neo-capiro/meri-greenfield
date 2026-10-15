import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,realpath,symlink,access} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {DEFAULT_BROWSER_POLICY} from '../policy.mjs';
import {binding,enabledPolicy,recorders,openFragment,sourceScopes,APPROVED,clock} from './fixtures.mjs';
import {downloadIdempotencyKey} from '../downloads.mjs';
import {ooxml,pdf,zip} from '../../../../artifacts/structure/test/fixtures.mjs';
import {REVIEW_PROBES} from '../../../../artifacts/structure/test/review-probes.mjs';
const workspace=async()=>{const root=await realpath(await mkdtemp(join(tmpdir(),'meri-browser-dl-')));const cwd=join(root,binding.conversationId);await mkdir(join(cwd,'.browser','output'),{recursive:true});return {root,cwd,output:join(cwd,'.browser','output')};};
const within=async fn=>{const w=await workspace();try{await fn(w);}finally{await rm(w.root,{recursive:true,force:true});}};
const src=name=>`${APPROVED[1]}/opp/${name}`;
test('downloads reach the artifact owner with canonical MIME, checksum and source scopes, then leave the browser output directory',()=>within(async({cwd,output})=>{
 const {cap,r}=openFragment({cwd}),bytes=pdf();await writeFile(join(output,'notice.pdf'),bytes);
 const stored=await cap.downloads.accept({filename:'notice.pdf',url:`${src('notice.pdf')}?token=SECRET`});
 assert.equal(stored.mimeType,'application/pdf');assert.equal(stored.bytes,bytes.length);assert.match(stored.versionId,/^00000099-/);
 assert.equal(r.ingested.length,1);const request=r.ingested[0];
 assert.deepEqual(request.scopes,sourceScopes);assert.deepEqual(request.binding,binding);assert.equal(request.format,'pdf');assert.equal(request.sha256,stored.sha256);assert.deepEqual(request.source,{kind:'browser-download',origin:'https://notices.example',urlHost:'notices.example',acquiredAtMs:clock(),policySha256:cap.policySha256});
 assert.equal(request.idempotencyKey,downloadIdempotencyKey(binding,'notice.pdf',stored.sha256));
 assert.equal(r.receipts.at(-1).kind,'browser.download');assert.equal(r.receipts.at(-1).reference,stored.versionId);assert.ok(!JSON.stringify(r.receipts).includes('SECRET'));
 await assert.rejects(access(join(output,'notice.pdf')));
}));
test('download sources follow the effective destination policy: allowlist only, platform limits always',()=>within(async({cwd,output})=>{
 const {cap,r}=openFragment({cwd});await writeFile(join(output,'ok.pdf'),pdf());
 const refuse=url=>assert.rejects(cap.downloads.accept({filename:'ok.pdf',url}),e=>e.code==='BROWSER_DOWNLOAD_SOURCE',String(url));
 for(const url of [`${APPROVED[2]}/ok.pdf`,'https://unlisted.example/ok.pdf','http://notices.example/ok.pdf','http://169.254.169.254/ok.pdf','http://127.0.0.1/ok.pdf','http://[fd00:ec2::254]/ok.pdf','http://localhost/ok.pdf','https://u:p@notices.example/ok.pdf','file:///tmp/ok.pdf','data:application/pdf,x','about:blank','not a url',undefined])await refuse(url);
 const none=openFragment({cwd,policy:DEFAULT_BROWSER_POLICY}).cap;
 await assert.rejects(none.downloads.accept({filename:'ok.pdf',url:src('ok.pdf')}),e=>e.code==='BROWSER_DOWNLOAD_SOURCE','an empty allowlist admits no download source');
 assert.equal(r.ingested.length,0);await access(join(output,'ok.pdf'));
}));
test('downloads require structural validity: corrupt ZIP-prefix bytes are not a DOCX, and wrong, macro or CRC-broken packages refuse',()=>within(async({cwd,output})=>{
 const {cap,r}=openFragment({cwd,policy:enabledPolicy({downloads:{enabled:true,formats:['pdf','txt','docx','xlsx','pptx','zip'],maxBytes:8192,maxFiles:50}})});
 const crcBroken=ooxml('docx');crcBroken[crcBroken.indexOf('word/document.xml')+'word/document.xml'.length+4]^=0xff;
 const bad={'prefix.docx':Buffer.from('PK\x03\x04rest','latin1'),'plainzip.docx':zip({'a.txt':'hello'}),'swapped.docx':ooxml('xlsx'),'crc.docx':crcBroken,
  'macro.docx':zip({'[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.ms-word.document.macroEnabled.main+xml"/></Types>','_rels/.rels':'<Relationships><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>','word/document.xml':'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>','word/vbaProject.bin':'x'}),
  'trunc.xlsx':ooxml('xlsx').subarray(0,60),'noxref.pdf':Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n'),'html.pdf':Buffer.from('<html>not a pdf</html>'),'nul.txt':Buffer.from('a\0b')};
 for(const [name,bytes] of Object.entries(bad)){await writeFile(join(output,name),bytes);await assert.rejects(cap.downloads.accept({filename:name,url:src(name)}),e=>e.code==='BROWSER_DOWNLOAD_TYPE',name);}
 assert.equal(r.ingested.length,0);
 const good={'a.docx':ooxml('docx'),'b.xlsx':ooxml('xlsx'),'c.pptx':ooxml('pptx'),'d.zip':zip({'x.txt':'x','y/z.txt':'z'}),'e.pdf':pdf(),'f.txt':Buffer.from('plain synthetic text\n')};
 for(const [name,bytes] of Object.entries(good)){await writeFile(join(output,name),bytes);await cap.downloads.accept({filename:name,url:src(name)});}
 assert.equal(r.ingested.length,6);
}));
test('the download port refuses every malformed probe from dot corrected review H1/H2 before ingest, with the closed structural reason',()=>within(async({cwd,output})=>{
 const {cap,r}=openFragment({cwd,policy:enabledPolicy({downloads:{enabled:true,formats:['pdf','docx','zip'],maxBytes:8192,maxFiles:50}})});
 for(const [i,probe] of REVIEW_PROBES.entries()){
  const name=`probe-${i}.${probe.format}`;await writeFile(join(output,name),probe.bytes());
  await assert.rejects(cap.downloads.accept({filename:name,url:src(name)}),e=>e.code==='BROWSER_DOWNLOAD_TYPE'&&e.detail===probe.reason,probe.id);
 }
 assert.equal(r.ingested.length,0);assert.equal(r.receipts.length,0);
}));
test('concurrent downloads cannot exceed maxFiles or ingest one filename twice; a refusal before ingest releases its slot',()=>within(async({cwd,output})=>{
 let release;const gate=new Promise(res=>{release=res;});const r=recorders(),slow={async ingest(request){await gate;return r.artifactPort.ingest(request);}};
 const {cap}=openFragment({cwd,r,artifacts:slow});
 for(let i=0;i<5;i++)await writeFile(join(output,`f${i}.pdf`),pdf(`f${i}`));
 const calls=[0,1,2,3,4].map(i=>cap.downloads.accept({filename:`f${i}.pdf`,url:src(`f${i}.pdf`)}));
 const dup=cap.downloads.accept({filename:'f0.pdf',url:src('f0.pdf')});
 release();const results=await Promise.allSettled([...calls,dup]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,2);assert.equal(r.ingested.length,2,'maxFiles 2 holds under concurrency');
 assert.deepEqual(results.filter(x=>x.status==='rejected').map(x=>x.reason.code).sort(),['BROWSER_DOWNLOAD_DUPLICATE','BROWSER_DOWNLOAD_LIMIT','BROWSER_DOWNLOAD_LIMIT','BROWSER_DOWNLOAD_LIMIT']);
 const fresh=openFragment({cwd});
 await assert.rejects(fresh.cap.downloads.accept({filename:'missing.pdf',url:src('missing.pdf')}),e=>e.code==='BROWSER_DOWNLOAD_MISSING');
 await fresh.cap.downloads.accept({filename:'f2.pdf',url:src('f2.pdf')});await fresh.cap.downloads.accept({filename:'f3.pdf',url:src('f3.pdf')});
 assert.equal(fresh.r.ingested.length,2,'the failed pre-ingest attempt did not consume a slot');
 const unknown=openFragment({cwd,artifacts:{async ingest(){throw new Error('ack lost');}}});await writeFile(join(output,'u.pdf'),pdf('u'));
 await assert.rejects(unknown.cap.downloads.accept({filename:'u.pdf',url:src('u.pdf')}),/ack lost/);
 await assert.rejects(unknown.cap.downloads.accept({filename:'u.pdf',url:src('u.pdf')}),e=>e.code==='BROWSER_DOWNLOAD_DUPLICATE','an attempted ingest with an unknown outcome keeps its claim');
}));
test('downloads refuse wrong types, sizes, names, symlinks and the file limit before any artifact effect',()=>within(async({root,cwd,output})=>{
 const {cap,r}=openFragment({cwd,policy:enabledPolicy({downloads:{enabled:true,formats:['pdf','txt'],maxBytes:1024,maxFiles:2}})}),put=(name,bytes)=>writeFile(join(output,name),bytes);
 const refuse=(args,code)=>assert.rejects(cap.downloads.accept(args),e=>e.code===code,code);
 await put('ok.pdf',pdf());await put('big.txt','x'.repeat(1025));await put('bad.txt',Buffer.from([0xff,0xfe]));await put('run.exe','MZ');
 await refuse({filename:'run.exe',url:src('run.exe')},'BROWSER_DOWNLOAD_TYPE');await refuse({filename:'bad.txt',url:src('bad.txt')},'BROWSER_DOWNLOAD_TYPE');await refuse({filename:'big.txt',url:src('big.txt')},'BROWSER_DOWNLOAD_SIZE');
 for(const filename of ['../ok.pdf','sub/ok.pdf','.hidden.pdf','a..pdf'])await refuse({filename,url:src('x.pdf')},'BROWSER_DOWNLOAD_NAME');
 await refuse({filename:'missing.pdf',url:src('missing.pdf')},'BROWSER_DOWNLOAD_MISSING');
 await writeFile(join(root,'outside.pdf'),pdf());await symlink(join(root,'outside.pdf'),join(output,'link.pdf'));await refuse({filename:'link.pdf',url:src('link.pdf')},'BROWSER_DOWNLOAD_PATH');
 const aborted=new AbortController();aborted.abort();await assert.rejects(cap.downloads.accept({filename:'ok.pdf',url:src('ok.pdf')},{signal:aborted.signal}),e=>e.code==='BROWSER_DOWNLOAD_CANCELLED');
 assert.equal(r.ingested.length,0);
 await put('two.pdf',pdf('2'));await cap.downloads.accept({filename:'ok.pdf',url:src('ok.pdf')});await cap.downloads.accept({filename:'two.pdf',url:src('two.pdf')});
 await put('three.pdf',pdf('3'));await refuse({filename:'three.pdf',url:src('three.pdf')},'BROWSER_DOWNLOAD_LIMIT');
 const liar=openFragment({cwd,artifacts:{async ingest(x){return {versionId:'v',sha256:'0'.repeat(64),bytes:x.bytes.length};}}}).cap;
 await assert.rejects(liar.downloads.accept({filename:'three.pdf',url:src('three.pdf')}),e=>e.code==='BROWSER_DOWNLOAD_INGEST');
 const off=openFragment({cwd,policy:enabledPolicy({downloads:{enabled:false,formats:['pdf'],maxBytes:1024,maxFiles:1}}),artifacts:undefined,sourceScopes:undefined}).cap;
 await assert.rejects(off.downloads.accept({filename:'three.pdf',url:src('three.pdf')}),e=>e.code==='BROWSER_DOWNLOADS_DISABLED');
}));
