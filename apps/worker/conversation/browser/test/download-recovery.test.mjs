/** Worker-side reconciliation: a LOST receipt/pointer acknowledgement after a committed publication is retried
 * through the SAME download port and the SAME deterministic identity, reconciling the original immutable version
 * and writing ONE receipt. Real publication owner (PG adapter over the inert SQL fixture + real journal), real
 * download port; only SQL/S3/Core and the receipt transport are inert. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readdir,realpath,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createLocalArtifactStore} from '../../../../artifacts/local-store.mjs';
import {sqlFixture,NOW} from '../../../../artifacts/storage/test/sql-fixture.mjs';
import {validators} from '../../../../artifacts/test/artifact-harness.mjs';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {createBrowserArtifactPublication} from '../../../../runtime/browser-artifact-publication.mjs';
import {createDownloadPort} from '../downloads.mjs';
import {validateBrowserPolicy} from '../policy.mjs';

const binding={tenantId:'synthetic-tenant',actorId:'synthetic-actor',
 conversationId:'33333333-3333-4333-8333-000000000001',runId:'33333333-3333-4333-8333-000000000002',
 attemptId:'33333333-3333-4333-8333-000000000003',workerId:'33333333-3333-4333-8333-000000000004',writerFence:1};
const scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:'synthetic-client',policyRevision:'synthetic-policy'}];
const body=Buffer.from('downloaded filing bytes\n');

async function fixture(t){
 const f=sqlFixture();
 const dir=await realpath(await mkdtemp(join(tmpdir(),'meri-download-recovery-'))),root=join(dir,'store');
 const store=await createLocalArtifactStore({root,canonicalSha256:hash});
 t.after(async()=>{await store.dispose();await rm(dir,{recursive:true,force:true});});
 const versions=f.create(),state={now:NOW};
 const authorize=async({action,resource,binding:b,scopes:s,requestSha256,deadlineMs})=>({receiptId:'synthetic-authority',
  decision:'allow',action,binding:b,scopesSha256:hash(s),resourceSha256:hash(resource),requestSha256,
  expiresAtMs:Math.min(deadlineMs,state.now+30000)});
 const resolve=async()=>({documentOptions:{artifactOptions:{context:{binding,scopes,evidence:[],assets:[],
  deadlineMs:state.now+60000,maxBytes:8388608},validators,authorize,versions,objects:store.objects,
  executor:{async execute(){throw Error('synthetic: ingest never renders')}},now:()=>state.now,
  ids:()=>({artifactId:'synthetic',versionId:'synthetic',objectId:'synthetic'})}},
  async recheck(){}});
 const publication=createBrowserArtifactPublication({resolve,
  sessions:{nativeCredentialFor:()=>({credential:'synthetic-bearer',expiresAtMs:state.now+30000})},
  now:()=>state.now,requestMs:30000});
 const artifacts={async ingest(request,{signal}={}){
  return publication.ingest({binding:request.binding,scopes:request.scopes,filename:request.filename,
   format:request.format,mimeType:request.mimeType,bytes:request.bytes,origin:request.source.origin,
   policySha256:request.source.policySha256,deadlineMs:state.now+60000,
   idempotencyKey:request.idempotencyKey},{signal});}};
 const receipts={calls:0,fail:false,events:[]};
 const receiptPort={async record(value){receipts.calls++;
  if(receipts.fail){receipts.fail=false;throw Object.assign(Error('synthetic lost receipt ack'),{code:'BROWSER_RECEIPT_UNKNOWN'});}
  if(!receipts.events.some(e=>e.reference===value.reference))receipts.events.push(value);}};
 const port=createDownloadPort({binding,policy:validateBrowserPolicy({enabled:true,allowedOrigins:['https://app.capiro.example']}),
  policySha256:'a'.repeat(64),sourceScopes:scopes,paths:{output:dir},artifacts,receipts:receiptPort,
  now:()=>state.now,assertCurrent:async()=>{}});
 return {f,port,receipts,dir,state,body};
}

test('a lost receipt acknowledgement keeps the file and reconciles ONE version and ONE receipt on retry',async t=>{
 const o=await fixture(t);
 await writeFile(join(o.dir,'filing.txt'),body);
 o.receipts.fail=true;
 await assert.rejects(()=>o.port.accept({filename:'filing.txt',url:'https://app.capiro.example/f/filing.txt'}),
  error=>error.code==='BROWSER_DOWNLOAD_RECEIPT_UNKNOWN');
 assert.equal(o.f.state.versions.size,1,'the publication committed exactly once');
 assert.ok((await readdir(o.dir)).includes('filing.txt'),'the source file is retained on an unknown receipt');
 const done=await o.port.accept({filename:'filing.txt',url:'https://app.capiro.example/f/filing.txt'});
 assert.equal(done.reconciled,true,'the retry reconciles the original version');
 assert.equal(o.f.state.versions.size,1,'no second version');
 assert.equal(o.f.durable.state.index.decisions.length,1,'no second publication decision');
 assert.equal(o.receipts.events.length,1,'one durable receipt');
 assert.equal(o.receipts.events[0].reference,done.versionId);
 assert.equal((await readdir(o.dir)).includes('filing.txt'),false,'the file leaves only after the receipt is confirmed');
});

test('a retry with different bytes under the claimed name is refused, and the original stays intact',async t=>{
 const o=await fixture(t);
 await writeFile(join(o.dir,'filing.txt'),body);
 o.receipts.fail=true;
 await assert.rejects(()=>o.port.accept({filename:'filing.txt',url:'https://app.capiro.example/f/filing.txt'}),
  error=>error.code==='BROWSER_DOWNLOAD_RECEIPT_UNKNOWN');
 await writeFile(join(o.dir,'filing.txt'),Buffer.from('different bytes\n'));
 await assert.rejects(()=>o.port.accept({filename:'filing.txt',url:'https://app.capiro.example/f/filing.txt'}),
  /BROWSER_DOWNLOAD_DUPLICATE/u);
 assert.equal(o.f.state.versions.size,1);
 assert.equal(o.receipts.events.length,0);
});
