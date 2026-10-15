import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createDownloadLinkApplication,createSuppressionGeneration,createRuntimeArtifactApplication} from '../index.mjs';
import {createServingGate} from '../../../control/retention/reconciliation.mjs';
import {createRetentionReadGate} from '../../../control/retention/suppression.mjs';
import {workbookDraft} from '../../../control/document-application/local/workbook/flow.mjs';
import {fixture} from './fixture.mjs';
import {createSignedDownloadCodec} from '../../../artifacts/storage/signed-download.mjs';

const T=1_800_000_000_000,key=Buffer.alloc(32,5),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const tenantId='tenant-a',conversationId='00000000-0000-4000-8000-0000000000c1',artifactId='00000000-0000-4000-8000-0000000000a1',versionId='00000000-0000-4000-8000-0000000000b1';
const binding=actorId=>({tenantId,actorId,conversationId,runId:'00000000-0000-4000-8000-0000000000d1',attemptId:'00000000-0000-4000-8000-0000000000e1',workerId:'00000000-0000-4000-8000-0000000000f1',writerFence:1});
function journalOf(rows=new Map()){return {rows,get:async key=>rows.get(key)??null};}
function harness({bytes=Buffer.from('synthetic workbook bytes'),servedBytes=bytes,inspectSha=sha(bytes)}={}){
 const clock={t:T},calls=[],journal=journalOf(),serving=createServingGate();
 const documents={async handle(request){const path=new URL(request.url).pathname,body=await request.text();calls.push({path,authorization:request.headers.get('authorization'),length:request.headers.get('content-length'),body});
  if(Number(request.headers.get('content-length'))!==Buffer.byteLength(body))return Response.json({error:{code:'INVALID_CONTENT_LENGTH'}},{status:400});
  if(path==='/api/documents/inspect')return calls.inspectRefused?Response.json({error:{code:'ACCESS_DENIED'}},{status:403}):Response.json({version:{versionId:JSON.parse(body).versionId,artifactId,binding:{tenantId,conversationId},object:{sha256:inspectSha,bytes:bytes.length}},inspection:{}});
  if(path==='/api/documents/download'){calls.onDownload?.();return new Response(servedBytes,{status:200,headers:{'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','content-disposition':'attachment; filename="w.xlsx"','cache-control':'no-store'}});}
  return Response.json({error:{code:'NOT_FOUND'}},{status:404});}};
 const actors={'action_session_a':'actor-a','action_session_b':'actor-b'};
 const sessions={async authenticateSession({credential}){if(!actors[credential])throw Object.assign(Error('SESSION_REFUSED'),{code:'SESSION_REFUSED'});return {credential};},
  async readCurrentState({authentication}){return {binding:binding(actors[authentication.credential]),scopes:[{kind:'client',tenantId,resourceId:'client-1',policyRevision:'a'.repeat(64)}],selectedClientId:'client-1',expiresAtMs:T+600000};}};
 const app=createDownloadLinkApplication({documents,sessions,key,generation:createSuppressionGeneration({journal,serving}),now:()=>clock.t,ttlMs:60000,maxRequestMs:5000});
 const post=(route,body,credential='action_session_a')=>app.handle(new Request('https://control.synthetic.invalid/api/documents/'+route,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(body)}));
 const issue=async()=>{const r=await post('links/issue',{versionId});assert.equal(r.status,200,await r.clone().text());return r.json();};
 return {clock,calls,journal,serving,app,post,issue,bytes,documents};
}
const code=async r=>(await r.json()).error.code;
const download=calls=>calls.filter(c=>c.path==='/api/documents/download').length;

test('issue binds the version bytes, actor, scope and generation; redeem releases the canonical download bytes and headers',async()=>{
 const h=harness(),issued=await h.issue();assert.equal(issued.versionId,versionId);assert.equal(issued.expiresAtMs,T+60000);
 const r=await h.post('links/redeem',{token:issued.token});assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),h.bytes);
 assert.equal(r.headers.get('content-disposition'),'attachment; filename="w.xlsx"');assert.equal(r.headers.get('cache-control'),'no-store');
 assert.deepEqual(h.calls.map(c=>c.path),['/api/documents/inspect','/api/documents/inspect','/api/documents/download']);assert.ok(h.calls.every(c=>c.authorization==='Bearer action_session_a'));
 // The existing download route and every other path go to the wrapped application unchanged.
 const direct=new Request('https://control.synthetic.invalid/api/documents/download',{method:'POST',headers:{authorization:'Bearer action_session_a','content-type':'application/json','content-length':String(Buffer.byteLength(JSON.stringify({versionId})))},body:JSON.stringify({versionId})});
 assert.equal((await h.app.handle(direct)).status,200);assert.equal(h.calls.at(-1).body,JSON.stringify({versionId}));
});
test('an expired link is refused before any authority or byte read',async()=>{
 const h=harness(),{token}=await h.issue();h.calls.length=0;h.clock.t=T+60000;const r=await h.post('links/redeem',{token});
 assert.equal(r.status,410);assert.equal(await code(r),'DOWNLOAD_LINK_EXPIRED');assert.equal(h.calls.length,0);
});
test('a tampered or foreign-key token is refused without reading bytes',async()=>{
 const h=harness(),{token}=await h.issue(),[payload,signature]=token.split('.');h.calls.length=0;
 const altered=Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(payload,'base64url')),suppressionGeneration:99})).toString('base64url');
 const foreign=createSignedDownloadCodec({key:Buffer.alloc(32,6),now:()=>T}).issue(JSON.parse(Buffer.from(payload,'base64url')));
 for(const t of [`${altered}.${signature}`,`${payload}.${signature.slice(0,-2)}xx`,foreign,'not-a-token']){const r=await h.post('links/redeem',{token:t});assert.equal(r.status,403);assert.equal(await code(r),'DOWNLOAD_LINK_INVALID');}
 assert.equal(h.calls.length,0);
});
test('an advanced suppression generation revokes the link; current suppression and a closed barrier refuse',async()=>{
 const h=harness(),{token}=await h.issue(),artifactKey=`${tenantId}:artifact:${artifactId}`;
 // Suppressed and released again: the subject is servable but its generation advanced past the one signed into the link.
 h.journal.rows.set(artifactKey,{state:'RELEASED',ledgerSequence:7});let r=await h.post('links/redeem',{token});assert.equal(r.status,410);assert.equal(await code(r),'DOWNLOAD_LINK_REVOKED');
 h.journal.rows.set(artifactKey,{state:'SUPPRESSED',ledgerSequence:8});r=await h.post('links/redeem',{token});assert.equal(await code(r),'RETENTION_SUPPRESSED');
 h.journal.rows.delete(artifactKey);h.serving.disable();r=await h.post('links/redeem',{token});assert.equal(r.status,503);assert.equal(await code(r),'RETENTION_RECOVERY_BARRIER');
 assert.equal(download(h.calls),0);
 // A link issued after a release carries the new generation and redeems.
 h.serving.enable();h.journal.rows.set(artifactKey,{state:'RELEASED',ledgerSequence:7});const fresh=await h.issue();assert.equal((await h.post('links/redeem',{token:fresh.token})).status,200);
});
test('a revocation that lands during the canonical download is caught before release',async()=>{
 const h=harness(),{token}=await h.issue();h.calls.onDownload=()=>h.journal.rows.set(`${tenantId}:conversation:${conversationId}`,{state:'RELEASED',ledgerSequence:2});
 const r=await h.post('links/redeem',{token});assert.equal(r.status,410);assert.equal(await code(r),'DOWNLOAD_LINK_REVOKED');assert.equal(download(h.calls),1);
});
test('another authenticated actor cannot redeem the link',async()=>{
 const h=harness(),{token}=await h.issue();h.calls.length=0;const r=await h.post('links/redeem',{token},'action_session_b');
 assert.equal(r.status,403);assert.equal(await code(r),'DOWNLOAD_LINK_ACTOR');assert.equal(h.calls.length,0);
 assert.equal(await code(await h.post('links/redeem',{token},'action_session_unknown')),'SESSION_REFUSED');
});
test('changed bytes are refused whether the version record or the served bytes differ from the signed hash',async()=>{
 const changed=harness({servedBytes:Buffer.from('different bytes')}),{token}=await changed.issue();let r=await changed.post('links/redeem',{token});assert.equal(r.status,409);assert.equal(await code(r),'DOWNLOAD_LINK_BYTES');
 const swapped=harness(),issued=await swapped.issue();const other=harness({inspectSha:'c'.repeat(64)});
 r=await other.post('links/redeem',{token:issued.token});assert.equal(await code(r),'DOWNLOAD_LINK_BYTES');assert.equal(download(other.calls),0);
});
test('canonical refusals pass through unchanged; malformed requests are closed codes',async()=>{
 const h=harness();h.calls.inspectRefused=true;const r=await h.post('links/issue',{versionId});assert.equal(r.status,403);assert.equal(await code(r),'ACCESS_DENIED');
 assert.equal((await h.post('links/issue',{versionId,extra:1})).status,400);assert.equal((await h.post('links/redeem',{})).status,400);
 assert.equal((await h.app.handle(new Request('https://control.synthetic.invalid/api/documents/links/issue',{method:'GET'}))).status,405);
 assert.throws(()=>createDownloadLinkApplication({documents:h.documents,sessions:{},key,generation:async()=>0,maxRequestMs:1000}),/DOWNLOAD_LINK_CONFIGURATION/u);
});

test('real canonical owners: a link issued for a generated workbook redeems its exact bytes and is revoked by a suppression cycle',{timeout:30000},async()=>{
 const x=await fixture('create_excel'),journal=journalOf(),serving=createServingGate();
 try{
  const original=await (await x.send('create',{deliveryId:'link-original',request:workbookDraft()})).json();assert.ok(original.version,JSON.stringify(original));
  const documents=createRuntimeArtifactApplication({sessions:x.f.sessions,optionsOwner:x.owner,now:x.f.now,limits:x.f.limits,retention:createRetentionReadGate({journal,serving})});
  const app=createDownloadLinkApplication({documents,sessions:x.f.sessions,key,generation:createSuppressionGeneration({journal,serving}),now:x.f.now,maxRequestMs:x.f.limits.maxRequestMs});
  const post=(route,body)=>app.handle(new Request('https://control.synthetic.invalid/api/documents/'+route,{method:'POST',headers:{authorization:'Bearer '+x.session.credential,'content-type':'application/json'},body:JSON.stringify(body)}));
  const direct=Buffer.from(await (await post('download',{versionId:original.version.versionId})).arrayBuffer());assert.equal(sha(direct),original.version.object.sha256);
  const issued=await (await post('links/issue',{versionId:original.version.versionId})).json();assert.ok(issued.token,JSON.stringify(issued));
  const redeemed=await post('links/redeem',{token:issued.token});assert.equal(redeemed.status,200);assert.deepEqual(Buffer.from(await redeemed.arrayBuffer()),direct);
  journal.rows.set(`${original.version.binding.tenantId}:artifact:${original.version.artifactId}`,{state:'RELEASED',ledgerSequence:1});
  const revoked=await post('links/redeem',{token:issued.token});assert.equal(revoked.status,410);assert.equal(await code(revoked),'DOWNLOAD_LINK_REVOKED');
 }finally{await x.close();}
});
