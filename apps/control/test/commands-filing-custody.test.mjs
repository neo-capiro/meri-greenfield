/** Synthetic artifact reads, broker and HTTP ports through the real filing resolver and command executor; no network or DB. */
import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,id,NOW} from './commands-fixture.mjs';
import {createCommandHttpSource} from '../commands/source-http.mjs';
import {createArtifactFilingResolver} from '../../artifacts/filing.mjs';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
function setup({lostRegistration=false}={}){
 const f=fixture('artifact.file'),calls=[];
 const version=v.version({contractVersion:'0.1.0',artifactId:id(90),versionId:id(91),parentVersionId:null,binding:f.binding,scopes:f.scopes,evidence:[],filename:'synthetic.txt',mimeType:'text/plain',generationStatus:'draft',previewStatus:'pending',createdAt:new Date(NOW).toISOString(),object:f.command.attachments[0]});
 const resolveAttachments=createArtifactFilingResolver({validators:v,now:()=>f.state.now,
  versions:{async findByObject(){return version.versionId;}},artifacts:{async download(){return {version,bytes:Buffer.from('ab')};},async inspect(){return {version};}},
  readContext:async()=>({binding:f.binding,scopes:f.scopes,evidence:[],assets:[],deadlineMs:NOW+60000,maxBytes:65536}),
  attachments:{async register(request){calls.push({request,journalState:[...f.pg.rows.values()][0]?.state??null,reserves:f.state.reserves??0});
   if(lostRegistration)throw Error('synthetic registration ACK lost');return {attachmentId:id(40),sha256:request.object.sha256,bytes:request.bytes.length,expiresAtMs:NOW+60000};}}});
 const source=createCommandHttpSource({origin:'https://source.invalid',now:()=>f.state.now,maxResponseBytes:65536,resolveAttachments,
  getCredentials:async({binding})=>({binding,bearerToken:'synthetic',serviceSecret:'synthetic',expiresAtMs:NOW+60000}),
  fetchImpl:async()=>{f.state.fetches++;return new Response(JSON.stringify({tool:'save_chat_attachments',status:'saved',generatedAt:new Date(NOW).toISOString(),clientId:id(9),clientName:'Synthetic',location:'/files',savedCount:1,pendingCount:0,failedCount:0,
   files:[{attachmentId:id(40),fileName:'synthetic.txt',status:'saved',documentId:id(92),location:'/files/92',indexingStatus:'pending',reused:false}]}),{headers:{'content-type':'application/json'}});}});
 const run=()=>f.create({source}).execute(f.call(),'synthetic');return {...f,source,calls,run};
}
test('synthetic: HTTP preparation cannot register attachments before the command claim',async()=>{
 const f=setup();const authority=await f.authority.check({credential:'synthetic',descriptor:f.descriptor,input:f.command,signal:new AbortController().signal,limitDeadline(){}});
 await f.source.prepare({command:f.command,context:f.context,authority,deadlineMs:NOW+1000,signal:new AbortController().signal});
 assert.equal(f.calls.length,0);assert.equal(f.pg.rows.size,0);assert.equal(f.state.fetches,0);
});
test('synthetic: completed filing and concurrent duplicate delivery register and save only once',async()=>{
 const f=setup();const results=await Promise.all([f.run(),f.run()]);assert.ok(results.some(r=>r.status==='observed'));
 assert.equal((await f.run()).status,'observed');assert.equal(f.calls.length,1);assert.equal(f.state.fetches,1);assert.equal(f.state.reserves,1);
 assert.equal(f.calls[0].journalState,'CLAIMED');assert.equal(f.calls[0].reserves,1);
});
test('synthetic: lost registration ACK becomes durable UNKNOWN and replay never registers again',async()=>{
 const f=setup({lostRegistration:true});await assert.rejects(f.run(),/COMMAND_OUTCOME_UNKNOWN/);
 assert.equal([...f.pg.rows.values()][0].state,'UNKNOWN');assert.equal(f.calls.length,1);assert.equal(f.state.uncertain,1);assert.equal(f.state.fetches,0);
 assert.equal((await f.run()).status,'indeterminate');assert.equal(f.calls.length,1);assert.equal(f.state.reserves,1);
});
test('synthetic: lost claim ACK, failed budget reservation and revoked current authority prevent registration',async()=>{
 for(const fault of ['claim','budget','authority']){const f=setup();
  if(fault==='claim')f.state.loseAck='claim';
  if(fault==='budget')f.state.reserveHook=async()=>{throw Error('synthetic reserve failure');};
  if(fault==='authority')f.state.reserveHook=async({reservationId})=>{f.state.revoked=true;return JSON.stringify({reservationId,decision:'reserved'});};
  await assert.rejects(f.run());assert.equal(f.calls.length,0,fault);assert.equal(f.state.fetches,0);
  f.state.revoked=false;assert.equal((await f.run()).status,'indeterminate');assert.equal(f.calls.length,0,fault+' replay');
 }
});
