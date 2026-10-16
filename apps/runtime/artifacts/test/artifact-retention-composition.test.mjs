/** Synthetic replies only; actual signed-download/generation/startup with two independent in-process owners, no network or DB. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createDownloadLinkApplication} from '../download-links.mjs';
import {createSuppressionGeneration} from '../suppression-generation.mjs';
import {createRetentionStartup} from '../../../control/retention/startup.mjs';
import {composeStartup,ownership,owners,owner} from '../../../control/retention/test/fixture.mjs';
import {harness,key,tenantId,conversationId,artifactId,versionId} from './link-fixture.mjs';

for(const duringDownload of [false,true])test(`composed download/retention: an unseen suppression restored ${duringDownload?'during download response':'before redemption'} cannot release a prior link`,async()=>{
 const f=composeStartup(),h=harness(),subject={tenantId,kind:'artifact',subjectId:artifactId};
 owners.set(`${tenantId}:artifact:${artifactId}`,owner);owners.set(`${tenantId}:conversation:${conversationId}`,owner);
 const other=createRetentionStartup({journal:f.journal,watermark:f.watermark,ledgerSink:f.sink,ownership,purge:{enabled:false},now:f.clock.now});
 await f.startup.start();await other.start();const saved=f.backup();let interrupt=false,interruptions=0;
 const suppressAndRestore=async()=>{interruptions++;await other.suppression.suppress({principal:f.principal,subject,reason:'synthetic other-owner decision'});f.restore(saved);};
 const documents={async handle(request){const response=await h.documents.handle(request);
  if(interrupt&&new URL(request.url).pathname==='/api/documents/download'){interrupt=false;await suppressAndRestore();}return response;}};
 const app=createDownloadLinkApplication({documents,sessions:h.sessions,key,now:f.clock.now,maxRequestMs:1000,
  generation:createSuppressionGeneration({journal:f.startup.journal,serving:f.startup.serving})});
 const post=(route,body)=>app.handle(new Request(`https://synthetic.invalid/api/documents/links/${route}`,{method:'POST',headers:{authorization:'Bearer action_session_a','content-type':'application/json'},body:JSON.stringify(body)}));
 const issued=await post('issue',{versionId});assert.equal(issued.status,200);const {token}=await issued.json();h.calls.length=0;
 if(duringDownload)interrupt=true;else await suppressAndRestore();
 // This owner has never observed the decision: only the current outside-rollback ledger can expose it.
 assert.equal(f.startup.serving.state().highWater,0);
 const refused=await post('redeem',{token});assert.equal(refused.status,503);assert.equal((await refused.json()).error.code,'RETENTION_READ_UNAVAILABLE');
 assert.equal(refused.headers.get('cache-control'),'no-store');assert.equal(interruptions,1);assert.equal(f.startup.serving.isEnabled(),false);
 const downloads=()=>h.calls.filter(call=>call.path==='/api/documents/download').length;
 assert.equal(downloads(),duringDownload?1:0);assert.equal((await f.watermark.read()).sequence,0);assert.equal((await f.ledger.head()).sequence,1);
 await f.startup.ensureServing();await assert.rejects(f.startup.gate.assertServable(subject),/RETENTION_SUPPRESSED/);
 const suppressed=await post('redeem',{token});assert.equal(suppressed.status,410);assert.equal((await suppressed.json()).error.code,'RETENTION_SUPPRESSED');assert.equal(downloads(),duringDownload?1:0);
 await f.startup.suppression.release({principal:f.principal,subject,reason:'synthetic authorized release'});
 const revoked=await post('redeem',{token});assert.equal(revoked.status,410);assert.equal((await revoked.json()).error.code,'DOWNLOAD_LINK_REVOKED');assert.equal(downloads(),duringDownload?1:0);
 const fresh=await post('issue',{versionId});assert.equal(fresh.status,200);const freshToken=(await fresh.json()).token;
 const served=await post('redeem',{token:freshToken});assert.equal(served.status,200);assert.deepEqual(Buffer.from(await served.arrayBuffer()),h.bytes);
 assert.equal(f.journal.lock.state().writer,false);assert.equal(f.journal.lock.state().waiting,0);assert.equal(f.deletes.length,0);assert.equal(f.rowPurges.length,0);
});
