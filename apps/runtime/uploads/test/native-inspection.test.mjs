/** Scanner and extractor ports: exact-original binding, native tool/image/definition provenance, ClamAV limit/encryption
 * alerts never reported clean, bounded failures and cancellation. The child runner is injected; a mocked success is not
 * evidence that any real tool, image or corpus qualifies. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {mkdtemp,rm,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createUploadNativeInspection,observeUploadTools,parseClamDetections,parseScannerVersion,parsePythonVersion,classifyScan,classifyScanExit} from '../native-inspection.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const DIGEST='sha256:'+'d'.repeat(64);
const ADMISSION=Object.freeze({role:'upload-native',imageDigest:DIGEST,qualificationId:'upload-native-'+'d'.repeat(7),sandbox:Object.freeze({nonRootUser:true}),toolRootsReadOnly:true});
const TOOLS=Object.freeze({scanner:Object.freeze({name:'clamav',version:'1.4.2',binarySha256:'a'.repeat(64)}),
 extractor:Object.freeze({name:'meri-upload-extractor',version:'3.13.16',binarySha256:'b'.repeat(64)}),pythonSha256:'c'.repeat(64)});
const SCAN_KEYS=['sourceSha256','sourceBytes','checkedAtMs','status','tool','definitionsSha256','reason'];
const EXTRACT_KEYS=['sourceSha256','sourceBytes','checkedAtMs','status','tool','segments','limitations'];
const DEFINITIONS_SHA='e'.repeat(64),DEFINITIONS_ROOT='/srv/defs';
const DEFINITIONS_DIR=DEFINITIONS_ROOT+'/snapshots/'+DEFINITIONS_SHA+'/database';
const definitions={async snapshot(){return {sha256:DEFINITIONS_SHA,publishedAt:new Date(0).toISOString(),publishedAtMs:0,version:'daily.cvd',databaseDirectory:DEFINITIONS_DIR};}};
const fileFor=(bytes,format='txt')=>({filename:'a.'+format,mimeType:'text/plain',bytes:bytes.length,sha256:hash(bytes),format,policyVersion:'upload-1'});
const child=(role,{exitCode=0,stdout='',receipt}={})=>({stdout:Buffer.from(stdout),receipt:receipt??{exitCode}});
const failChild=(stdout,exitCode=1)=>Object.assign(new Error('child'),{code:'ARTIFACT_PROCESS_FAILED',stdout:Buffer.from(stdout),receipt:{exitCode}});

async function build(run,{defs=definitions}={}){
 const tempRoot=await realpath(tmpdir());
 return {tempRoot,host:createUploadNativeInspection({admission:ADMISSION,tools:TOOLS,definitions:defs,definitionsRoot:'/srv/defs',extractorPath:'/opt/meri/extract.py',run,tempRoot,now:Date.now})};
}

test('scan parsing and classification keep max-limit alerts from ever reading clean',()=>{
 assert.deepEqual(parseClamDetections('/w/input.original: Eicar-Test-Signature FOUND\n'),[{file:'/w/input.original',signature:'Eicar-Test-Signature'}]);
 assert.deepEqual(classifyScan([]),{status:'clean',reason:null});
 assert.deepEqual(classifyScan([{signature:'Eicar-Test-Signature'}]),{status:'infected',reason:'MALWARE_DETECTED'});
 assert.deepEqual(classifyScan([{signature:'Heuristics.Encrypted.PDF'}]),{status:'unavailable',reason:'SCAN_LIMIT_REACHED'});
 assert.deepEqual(classifyScan([{signature:'Heuristics.Limits.Exceeded.MaxFileSize'}]),{status:'unavailable',reason:'SCAN_LIMIT_REACHED'});
 assert.deepEqual(classifyScan([{signature:'Heuristics.Limits.Exceeded.MaxScanTime'}]),{status:'unavailable',reason:'SCAN_LIMIT_REACHED'});
 assert.deepEqual(classifyScan([{signature:'Heuristics.Broken.Media.PDF'}]),{status:'unavailable',reason:'SCAN_LIMIT_REACHED'});
 // F5: only the proven ClamAV limit/encryption/broken-media prefixes are limit alerts. An alert outside them — the
 // unproven `Oversized.*` form the regex used to match, or a real malware signature — is malware, never a limit.
 assert.deepEqual(classifyScan([{signature:'Oversized.Zip'}]),{status:'infected',reason:'MALWARE_DETECTED'});
 assert.deepEqual(classifyScan([{signature:'Heuristics.Encrypted.PDF'},{signature:'Win.Trojan.Agent'}]),{status:'infected',reason:'MALWARE_DETECTED'});
 assert.equal(parseScannerVersion('ClamAV 1.4.2/27450/Tue\n'),'1.4.2');assert.equal(parsePythonVersion('Python 3.13.16\n'),'3.13.16');
 assert.equal(parseScannerVersion('garbage'),null);
});

test('a clean scan binds the exact original, the native tool and the resolved immutable definition snapshot',async()=>{
 const bytes=Buffer.from('hello world'),calls=[];
 const {host}=await build(async(role,options)=>{calls.push({role,options});return child(role);});
 const receipt=await host.scanner.scan({file:fileFor(bytes),bytes,limits:{originalBytes:1e7},deadlineMs:Date.now()+30000});
 assert.deepEqual(Object.keys(receipt),SCAN_KEYS);
 assert.equal(receipt.status,'clean');assert.equal(receipt.reason,null);
 assert.equal(receipt.sourceSha256,hash(bytes));assert.equal(receipt.sourceBytes,bytes.length);
 assert.equal(receipt.definitionsSha256,DEFINITIONS_SHA);assert.deepEqual(receipt.tool,TOOLS.scanner);
 assert.equal(calls[0].options.definitionsRoot,DEFINITIONS_DIR,'the child is bound to the exact resolved snapshot directory');
 assert.equal(host.describe().expectedImageDigest,DIGEST);
 assert.equal(host.describe().imageObserved,false,'the image digest is a declared expectation, never an observation of this host');
 assert.equal(host.describe().toolRootsReadOnly,true);
});

test('malware, limit alerts, original mismatch and stale definitions are honest non-clean outcomes',async()=>{
 const bytes=Buffer.from('payload'),file=fileFor(bytes),options={limits:{originalBytes:1e7},deadlineMs:Date.now()+30000};
 const infected=await build(async(role)=>Promise.reject(failChild('input.original: Eicar-Test-Signature FOUND\n')));
 assert.equal((await infected.host.scanner.scan({file,bytes,...options})).status,'infected');
 const limited=await build(async(role)=>Promise.reject(failChild('input.original: Heuristics.Encrypted.PDF FOUND\n')));
 const limitedReceipt=await limited.host.scanner.scan({file,bytes,...options});
 assert.equal(limitedReceipt.status,'unavailable');assert.equal(limitedReceipt.reason,'SCAN_LIMIT_REACHED');assert.equal(limitedReceipt.tool,null);
 const crashed=await build(async(role)=>Promise.reject(failChild('',2)));
 assert.equal((await crashed.host.scanner.scan({file,bytes,...options})).reason,'SCANNER_UNAVAILABLE');
 const mismatch=await build(async(role)=>child(role));
 assert.equal((await mismatch.host.scanner.scan({file,bytes:Buffer.from('other'),...options})).reason,'UPLOAD_ORIGINAL_MISMATCH');
 const stale=await build(async(role)=>child(role),{defs:{async snapshot(){throw Object.assign(Error('s'),{code:'UPLOAD_DEFINITIONS_STALE'});}}});
 const staleReceipt=await stale.host.scanner.scan({file,bytes,...options});
 assert.equal(staleReceipt.status,'unavailable');assert.equal(staleReceipt.reason,'UPLOAD_DEFINITIONS_STALE');
});

test('extraction returns the fixed child result re-anchored to the exact original and tool',async()=>{
 const bytes=Buffer.from('docx-bytes'),segment={ordinal:0,text:'hello',method:'native',confidence:null,location:{page:null,slide:null,sheet:null,rowStart:null,rowEnd:null}};
 const available=await build(async(role)=>child(role,{stdout:JSON.stringify({status:'available',segments:[segment],limitations:[]})}));
 const receipt=await available.host.extractor.extract({file:fileFor(bytes,'docx'),bytes,deadlineMs:Date.now()+30000});
 assert.deepEqual(Object.keys(receipt),EXTRACT_KEYS);
 assert.equal(receipt.status,'available');assert.equal(receipt.sourceSha256,hash(bytes));assert.deepEqual(receipt.tool,TOOLS.extractor);
 assert.deepEqual(receipt.segments,[segment]);assert.deepEqual(receipt.limitations,[]);
 const partial=await build(async(role)=>child(role,{stdout:JSON.stringify({status:'partial',segments:[segment],limitations:['OCR_LOW_CONFIDENCE']})}));
 assert.deepEqual((await partial.host.extractor.extract({file:fileFor(bytes,'docx'),bytes,deadlineMs:Date.now()+30000})).limitations,['OCR_LOW_CONFIDENCE']);
 const unavailable=await build(async(role)=>child(role,{stdout:JSON.stringify({status:'blocked',segments:[],limitations:['ENCRYPTED_DOCUMENT']})}));
 const blocked=await unavailable.host.extractor.extract({file:fileFor(bytes,'pdf'),bytes,deadlineMs:Date.now()+30000});
 assert.equal(blocked.status,'blocked');assert.deepEqual(blocked.tool,TOOLS.extractor);assert.deepEqual(blocked.segments,[]);
});

test('extraction refuses unsupported formats and a corrupt or failing child with no fabricated content',async()=>{
 const bytes=Buffer.from('zip-bytes');
 const ok=await build(async(role)=>child(role,{stdout:'{}'}));
 assert.deepEqual((await ok.host.extractor.extract({file:fileFor(bytes,'zip'),bytes,deadlineMs:Date.now()+30000})).limitations,['EXTRACTOR_UNAVAILABLE']);
 const broken=await build(async(role)=>child(role,{stdout:'not json'}));
 assert.deepEqual((await broken.host.extractor.extract({file:fileFor(bytes,'txt'),bytes,deadlineMs:Date.now()+30000})).limitations,['EXTRACTOR_RECEIPT_INVALID']);
 const crashed=await build(async(role)=>Promise.reject(failChild('',3)));
 const crashedReceipt=await crashed.host.extractor.extract({file:fileFor(bytes,'txt'),bytes,deadlineMs:Date.now()+30000});
 assert.deepEqual(Object.keys(crashedReceipt),EXTRACT_KEYS);assert.equal(crashedReceipt.status,'unavailable');
});

test('malformed child outcomes cannot erase limitations or release blocked content',async()=>{
 const bytes=Buffer.from('original'),segment={ordinal:0,text:'must not escape',method:'native',confidence:null,
  location:{page:null,slide:null,sheet:null,rowStart:null,rowEnd:null}};
 for(const patch of [
  {limitations:['not a limitation code']},{limitations:['OCR_LOW_CONFIDENCE','OCR_LOW_CONFIDENCE']},
  {limitations:Array.from({length:17},(_,i)=>`LIMIT_${i}`)},
  {status:'unknown'},{status:'blocked',limitations:['ENCRYPTED_DOCUMENT']},
  {status:'unavailable',limitations:['PARSER_ERROR']},{detail:'unexpected child payload'},
 ]){
  const childResult={status:'available',segments:[segment],limitations:[],...patch};
  const {host}=await build(async role=>child(role,{stdout:JSON.stringify(childResult)}));
  const receipt=await host.extractor.extract({file:fileFor(bytes),bytes,deadlineMs:Date.now()+30000});
  assert.equal(receipt.status,'unavailable');assert.deepEqual(receipt.segments,[]);
  assert.deepEqual(receipt.limitations,['EXTRACTOR_RECEIPT_INVALID']);
 }
});

test('receipts satisfy the invariants of A5 createUploadInspection scanReceipt/extractionReceipt',async()=>{
 // Traced from S/work/wave5-m5-upload-custody-20261027/apps/control/uploads/extraction.mjs (read-only reference).
 const bytes=Buffer.from('payload'),file=fileFor(bytes),options={limits:{originalBytes:1e7},deadlineMs:Date.now()+30000};
 const observed=(receipt,kind)=>{assert.ok(Number.isSafeInteger(receipt.checkedAtMs)&&receipt.checkedAtMs>=0);
  if(kind==='scan'){assert.equal(receipt.status!=='unavailable'&&(receipt.tool===null||!/^[a-f0-9]{64}$/u.test(receipt.definitionsSha256)),false);
   assert.equal(receipt.status!=='clean'&&receipt.reason===null,false);assert.equal(receipt.status==='clean'&&receipt.reason!==null,false);
   assert.equal(receipt.status==='unavailable'&&receipt.tool!==null,false);}
  else{assert.equal(receipt.status!=='available'&&receipt.limitations.length===0,false);
   assert.ok(receipt.limitations.length<=16&&new Set(receipt.limitations).size===receipt.limitations.length);
   assert.equal(['available','partial'].includes(receipt.status)&&receipt.tool===null,false);}};
 const clean=await build(async(role)=>child(role)),infected=await build(async(role)=>Promise.reject(failChild('input.original: Eicar-Test FOUND\n')));
 observed((await clean.host.scanner.scan({file,bytes,...options})),'scan');
 observed((await infected.host.scanner.scan({file,bytes,...options})),'scan');
 const segment={ordinal:0,text:'hi',method:'native',confidence:null,location:{page:null,slide:null,sheet:null,rowStart:null,rowEnd:null}};
 const partial=await build(async(role)=>child(role,{stdout:JSON.stringify({status:'available',segments:[segment],limitations:['OCR_LOW_CONFIDENCE']})}));
 const receipt=await partial.host.extractor.extract({file:fileFor(bytes,'txt'),bytes,deadlineMs:Date.now()+30000});
 observed(receipt,'extraction');
 assert.equal(receipt.status,'partial','available with limitations must be reported partial, not available');
});

test('cancellation propagates from the child instead of being reported as a result',async()=>{
 const bytes=Buffer.from('x');
 const cancelled=await build(async()=>Promise.reject(Object.assign(new Error('x'),{code:'ARTIFACT_CANCELLED'})));
 await assert.rejects(()=>cancelled.host.scanner.scan({file:fileFor(bytes),bytes,deadlineMs:Date.now()+30000}),{code:'ARTIFACT_CANCELLED'});
 const expired=await build(async(role)=>child(role));
 assert.equal((await expired.host.scanner.scan({file:fileFor(bytes),bytes,deadlineMs:Date.now()-1})).reason,'UPLOAD_EXPIRED');
});

test('tool identities require the fixed names and hashes, and are unavailable when unreadable',async()=>{
 const bytes=Buffer.from('x');
 const tempRoot=await realpath(tmpdir());
 assert.throws(()=>createUploadNativeInspection({admission:ADMISSION,tools:{...TOOLS,scanner:{...TOOLS.scanner,name:'other'}},definitions,definitionsRoot:'/srv/defs',extractorPath:'/opt/meri/extract.py',tempRoot}),{code:'UPLOAD_TOOL_IDENTITY'});
 assert.throws(()=>createUploadNativeInspection({admission:ADMISSION,tools:TOOLS,definitions,definitionsRoot:'/srv/defs',extractorPath:'/opt/meri/extract.py',tempRoot,now:'no'}),{code:'UPLOAD_INSPECTION_CONFIGURATION'});
 const observed=await observeUploadTools({tempRoot,definitionsRoot:'/srv/defs',extractorPath:'/opt/meri/extract.py',deadlineMs:Date.now()+30000,
  paths:{pythonExecutable:'/x/python',scanner:'/x/clamscan'},readFileImpl:async p=>Buffer.from('bin:'+p),
  run:async(role)=>child(role,{stdout:role==='scan'?'ClamAV 1.4.2/x/y\n':'Python 3.13.16\n'})});
 assert.equal(observed.scanner.version,'1.4.2');assert.equal(observed.extractor.version,'3.13.16');
 await assert.rejects(()=>observeUploadTools({tempRoot,definitionsRoot:'/srv/defs',extractorPath:'/opt/meri/extract.py',deadlineMs:Date.now()+30000,
  paths:{pythonExecutable:'/x/python',scanner:'/x/clamscan'},readFileImpl:async()=>{throw Error('missing');},run:async(role)=>child(role)}),{code:'UPLOAD_TOOL_UNAVAILABLE'});
});

test('scanner exit 1 with no parseable detection is unavailable, never clean',async()=>{
 // Negative witnesses: unknown, truncated or unparseable exit-1 output must not become a clean receipt.
 assert.deepEqual(classifyScanExit({exitCode:0,detections:[]}),{status:'clean',reason:null});
 assert.deepEqual(classifyScanExit({exitCode:1,detections:[]}),{status:'unavailable',reason:'SCANNER_OUTPUT_UNPARSED'});
 assert.deepEqual(classifyScanExit({exitCode:0,detections:[{signature:'Eicar-Test-Signature'}]}),{status:'unavailable',reason:'SCANNER_OUTPUT_UNEXPECTED'});
 assert.deepEqual(classifyScanExit({exitCode:2,detections:[]}),{status:'unavailable',reason:'SCANNER_UNAVAILABLE'});
 assert.deepEqual(classifyScanExit({exitCode:1,detections:[{signature:'Eicar-Test-Signature'}]}),{status:'infected',reason:'MALWARE_DETECTED'});
 assert.deepEqual(classifyScanExit({exitCode:1,detections:[{signature:'Heuristics.Encrypted.PDF'}]}),{status:'unavailable',reason:'SCAN_LIMIT_REACHED'});
 const bytes=Buffer.from('payload'),file=fileFor(bytes),options={limits:{originalBytes:1e7},deadlineMs:Date.now()+30000};
 for(const stdout of ['','\n','warn: something happened\n','input.original: Eicar-Test-Sign']){
  const {host}=await build(async()=>Promise.reject(failChild(stdout,1)));
  const receipt=await host.scanner.scan({file,bytes,...options});
  assert.equal(receipt.status,'unavailable',JSON.stringify(stdout));
  assert.equal(receipt.reason,'SCANNER_OUTPUT_UNPARSED',JSON.stringify(stdout));
  assert.equal(receipt.tool,null);
 }
 const truncated=await build(async(role)=>child(role,{stdout:'warning: database parse problem\n',exitCode:0}));
 const clean=await truncated.host.scanner.scan({file,bytes,...options});
 assert.equal(clean.status,'clean','a real exit 0 with no detection is clean');assert.deepEqual(clean.tool,TOOLS.scanner);
});

test('a definition store that resolves outside the configured root is not admitted',async()=>{
 const bytes=Buffer.from('payload'),file=fileFor(bytes),options={limits:{originalBytes:1e7},deadlineMs:Date.now()+30000};
 const outside=await build(async(role)=>child(role),{defs:{async snapshot(){return {sha256:DEFINITIONS_SHA,publishedAtMs:0,
  databaseDirectory:'/elsewhere/snapshots/'+DEFINITIONS_SHA+'/database'};}}});
 assert.equal((await outside.host.scanner.scan({file,bytes,...options})).reason,'UPLOAD_DEFINITIONS_UNAVAILABLE');
 const absent=await build(async(role)=>child(role),{defs:{async snapshot(){return {sha256:DEFINITIONS_SHA,publishedAtMs:0,databaseDirectory:null};}}});
 assert.equal((await absent.host.scanner.scan({file,bytes,...options})).reason,'UPLOAD_DEFINITIONS_UNAVAILABLE');
});

test('definition containment refuses sibling and normalized escape paths under actual host path semantics',async()=>{
 const bytes=Buffer.from('payload'),file=fileFor(bytes),deadlineMs=Date.now()+30000;
 const paths=['/srv/defs-evil/snapshots/x','/srv/defs/../defs-evil/snapshots/x','/srv/defs'];
 if(process.platform!=='win32')paths.push('/srv/defs\\evil/snapshots/x');
 for(const databaseDirectory of paths){let calls=0;
  const {host}=await build(async()=>{calls++;return child('scan');},{defs:{async snapshot(){return {sha256:DEFINITIONS_SHA,publishedAtMs:0,databaseDirectory};}}});
  assert.equal((await host.scanner.scan({file,bytes,deadlineMs})).reason,'UPLOAD_DEFINITIONS_UNAVAILABLE',databaseDirectory);
  assert.equal(calls,0,'an invalid directory never reaches the child');
 }
});

test('extractor configuration exit stays distinct and never exposes child detail',async()=>{
 const bytes=Buffer.from('payload'),file=fileFor(bytes),deadlineMs=Date.now()+30000;
 const {host}=await build(async()=>{throw failChild('{"detail":"private image path"}',3);});
 const receipt=await host.extractor.extract({file,bytes,deadlineMs});
 assert.equal(receipt.status,'unavailable');assert.deepEqual(receipt.limitations,['NATIVE_EXTRACTOR_CONFIGURATION']);
 assert.deepEqual(receipt.segments,[]);assert.equal(JSON.stringify(receipt).includes('private image path'),false);
 const ordinary=await build(async()=>{throw failChild('runtime error',2);});
 assert.deepEqual((await ordinary.host.extractor.extract({file,bytes,deadlineMs})).limitations,['EXTRACTOR_UNAVAILABLE']);
});

test('each scan is bound to the snapshot its own resolve returned, so a concurrent refresh cannot move it',async()=>{
 const bytes=Buffer.from('payload'),file=fileFor(bytes),options={limits:{originalBytes:1e7},deadlineMs:Date.now()+30000};
 const first='e'.repeat(64),second='f'.repeat(64),directory=id=>DEFINITIONS_ROOT+'/snapshots/'+id+'/database';
 let resolved=0;const seen=[];
 const store={async snapshot(){const id=resolved++===0?first:second;return {sha256:id,publishedAtMs:0,databaseDirectory:directory(id)};}};
 const {host}=await build(async(role,childOptions)=>{seen.push(childOptions.definitionsRoot);return child(role);},{defs:store});
 const before=await host.scanner.scan({file,bytes,...options}),after=await host.scanner.scan({file,bytes,...options});
 assert.equal(before.definitionsSha256,first);assert.equal(after.definitionsSha256,second);
 assert.deepEqual(seen,[directory(first),directory(second)],'each scan keeps the directory its own resolve returned');
});
