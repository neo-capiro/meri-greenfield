import test from 'node:test';
import assert from 'node:assert/strict';
import {createDownloadLinkApplication,createSuppressionGeneration,createRuntimeArtifactApplication} from '../index.mjs';
import {createServingGate} from '../../../control/retention/reconciliation.mjs';
import {createRetentionReadGate} from '../../../control/retention/suppression.mjs';
import {workbookDraft} from '../../../control/document-application/local/workbook/flow.mjs';
import {fixture} from './fixture.mjs';
import {createSignedDownloadCodec} from '../../../artifacts/storage/signed-download.mjs';
import {T,key,sha,tenantId,conversationId,artifactId,versionId,journalOf,harness} from './link-fixture.mjs';

const code=async r=>(await r.json()).error.code;
const download=calls=>calls.filter(c=>c.path==='/api/documents/download').length;
const hardened=r=>{assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('referrer-policy'),'no-referrer');assert.equal(r.headers.get('x-content-type-options'),'nosniff');};

test('issue verifies inspect and exact-version download authority, then binds bytes, actor, scope and generation; redeem releases the canonical bytes',async()=>{
 const h=harness(),issuedResponse=await h.post('links/issue',{versionId});assert.equal(issuedResponse.status,200);hardened(issuedResponse);const issued=await issuedResponse.json();assert.equal(issued.versionId,versionId);assert.equal(issued.expiresAtMs,T+60000);
 assert.deepEqual(Object.keys(issued).sort(),['expiresAtMs','token','versionId']);
 const r=await h.post('links/redeem',{token:issued.token});assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),h.bytes);hardened(r);
 assert.equal(r.headers.get('content-disposition'),'attachment; filename="w.xlsx"');
 // Issue and redeem each run the canonical inspect and the canonical download under the caller's own session.
 assert.deepEqual(h.calls.map(c=>c.path),['/api/documents/inspect','/api/documents/download','/api/documents/inspect','/api/documents/download']);assert.ok(h.calls.every(c=>c.authorization==='Bearer action_session_a'));
 // The existing download route and every other path go to the wrapped application unchanged.
 const direct=new Request('https://control.synthetic.invalid/api/documents/download',{method:'POST',headers:{authorization:'Bearer action_session_a','content-type':'application/json','content-length':String(Buffer.byteLength(JSON.stringify({versionId})))},body:JSON.stringify({versionId})});
 assert.equal((await h.app.handle(direct)).status,200);assert.equal(h.calls.at(-1).body,JSON.stringify({versionId}));
});
test('an expired link is refused before any artifact read',async()=>{
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
 const h=harness(),{token}=await h.issue(),artifactKey=`${tenantId}:artifact:${artifactId}`;h.calls.length=0;
 // Suppressed and released again: the subject is servable but its generation advanced past the one signed into the link.
 h.journal.rows.set(artifactKey,{state:'RELEASED',ledgerSequence:7});let r=await h.post('links/redeem',{token});assert.equal(r.status,410);assert.equal(await code(r),'DOWNLOAD_LINK_REVOKED');
 h.journal.rows.set(artifactKey,{state:'SUPPRESSED',ledgerSequence:8});r=await h.post('links/redeem',{token});assert.equal(await code(r),'RETENTION_SUPPRESSED');
 h.journal.rows.delete(artifactKey);h.serving.disable();r=await h.post('links/redeem',{token});assert.equal(r.status,503);assert.equal(await code(r),'RETENTION_RECOVERY_BARRIER');
 assert.equal(download(h.calls),0);
 // A link issued after a release carries the new generation and redeems.
 // Issuing while suppressed or behind the barrier signs nothing.
 assert.equal(await code(await h.post('links/issue',{versionId})),'RETENTION_RECOVERY_BARRIER');h.serving.enable();
 h.journal.rows.set(artifactKey,{state:'SUPPRESSED',ledgerSequence:8});assert.equal(await code(await h.post('links/issue',{versionId})),'RETENTION_SUPPRESSED');
 h.journal.rows.set(artifactKey,{state:'RELEASED',ledgerSequence:9});const fresh=await h.issue();assert.equal((await h.post('links/redeem',{token:fresh.token})).status,200);
});
test('a revocation that lands during the canonical download is caught before release',async()=>{
 const h=harness(),{token}=await h.issue();h.calls.length=0;h.calls.onDownload=()=>h.journal.rows.set(`${tenantId}:conversation:${conversationId}`,{state:'RELEASED',ledgerSequence:2});
 const r=await h.post('links/redeem',{token});assert.equal(r.status,410);assert.equal(await code(r),'DOWNLOAD_LINK_REVOKED');assert.equal(download(h.calls),1);hardened(r);
});
test('another authenticated actor cannot redeem the link',async()=>{
 const h=harness(),{token}=await h.issue();h.calls.length=0;const r=await h.post('links/redeem',{token},'action_session_b');
 assert.equal(r.status,403);assert.equal(await code(r),'DOWNLOAD_LINK_ACTOR');assert.equal(h.calls.length,0);
 assert.equal(await code(await h.post('links/redeem',{token},'action_session_unknown')),'SESSION_REFUSED');
});
test('changed bytes are refused whether the version record or the served bytes differ from the signed hash',async()=>{
 // No link is signed for bytes that do not match the version record.
 const mismatched=harness({servedBytes:Buffer.from('different bytes')});let r=await mismatched.post('links/issue',{versionId});assert.equal(r.status,409);assert.equal(await code(r),'DOWNLOAD_LINK_BYTES');
 const changed=harness(),{token}=await changed.issue();changed.served.bytes=Buffer.from('different bytes');r=await changed.post('links/redeem',{token});assert.equal(r.status,409);assert.equal(await code(r),'DOWNLOAD_LINK_BYTES');
 const swapped=harness(),issued=await swapped.issue();const other=harness({inspectSha:'c'.repeat(64)});
 r=await other.post('links/redeem',{token:issued.token});assert.equal(await code(r),'DOWNLOAD_LINK_BYTES');assert.equal(download(other.calls),0);
});
test('canonical refusals pass through unchanged; malformed requests are closed codes',async()=>{
 const h=harness();h.calls.inspectRefused=true;const r=await h.post('links/issue',{versionId});assert.equal(r.status,403);assert.equal(await code(r),'ACCESS_DENIED');hardened(r);h.calls.inspectRefused=false;
 assert.equal((await h.post('links/issue',{versionId,extra:1})).status,400);assert.equal((await h.post('links/redeem',{})).status,400);
 assert.equal((await h.app.handle(new Request('https://control.synthetic.invalid/api/documents/links/issue',{method:'GET'}))).status,405);
 assert.throws(()=>createDownloadLinkApplication({documents:h.documents,sessions:{},key,generation:async()=>0,maxRequestMs:1000}),/DOWNLOAD_LINK_CONFIGURATION/u);
});

test('issue requires exact-version download authority, not only inspect: a denied canonical download signs nothing',async()=>{
 const h=harness();h.calls.downloadRefused=true;const r=await h.post('links/issue',{versionId});assert.equal(r.status,403);hardened(r);
 const body=await r.json();assert.equal(body.error.code,'ACCESS_DENIED');assert.equal(Object.hasOwn(body,'token'),false);
 assert.deepEqual(h.calls.map(c=>c.path),['/api/documents/inspect','/api/documents/download']);assert.ok(h.calls.every(c=>c.body===JSON.stringify({versionId})));
});
test('a link is processed only for an authenticated caller and only from a JSON body, never a URL',async()=>{
 const h=harness(),{token}=await h.issue();h.calls.length=0;
 const raw=(path,init)=>h.app.handle(new Request('https://control.synthetic.invalid/api/documents/'+path,init));
 let r=await raw('links/redeem',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token})});assert.equal(r.status,401);assert.equal(await code(r),'UNAUTHENTICATED');hardened(r);
 r=await raw('links/redeem?token='+token,{method:'POST',headers:{authorization:'Bearer action_session_a','content-type':'application/json'},body:JSON.stringify({token})});assert.equal(r.status,400);assert.equal(await code(r),'INVALID_REQUEST');hardened(r);
 r=await raw('links/redeem',{method:'POST',headers:{authorization:'Bearer action_session_a','content-type':'text/plain'},body:JSON.stringify({token})});assert.equal(r.status,415);assert.equal(await code(r),'UNSUPPORTED_MEDIA_TYPE');
 // A token placed in the path is not a link route: it is delegated unchanged to the canonical application (whose route admission
 // answers NOT_FOUND) and is never parsed, verified or redeemed here.
 r=await raw('links/redeem/'+token,{method:'POST',headers:{authorization:'Bearer action_session_a','content-type':'application/json'},body:'{}'});assert.notEqual(r.status,200);
 assert.deepEqual(h.calls.map(c=>c.path),['/api/documents/links/redeem/'+token]);assert.equal((await r.text()).includes(token),false);
});
test('link lifetime is short and bounded: the configured TTL, never beyond five minutes or the current session expiry',async()=>{
 assert.equal((await harness().issue()).expiresAtMs,T+60000);
 assert.equal((await harness({ttlMs:300000}).issue()).expiresAtMs,T+300000);
 assert.equal((await harness({sessionExpiresAtMs:T+30000}).issue()).expiresAtMs,T+30000);
 const ending=harness({sessionExpiresAtMs:T});assert.equal(await code(await ending.post('links/issue',{versionId})),'SESSION_REFUSED');
 const h=harness();for(const ttlMs of [999,300001,1.5])assert.throws(()=>createDownloadLinkApplication({documents:h.documents,sessions:{authenticateSession(){},readCurrentState(){}},key,generation:async()=>0,ttlMs,maxRequestMs:1000}),/DOWNLOAD_LINK_CONFIGURATION/u);
});

test('authority revoked, scope changed or session expired during the final body and suppression reads releases no bytes',async()=>{
 const afterDownload=(h,change)=>{h.calls.onDownload=()=>{h.calls.armed=true;};h.journal.rows.onGet=()=>{if(h.calls.armed)change(h);};};
 const cases=[
  ['revoked during the final suppression read',h=>afterDownload(h,h=>{h.authority.revoked=true;}),403,'SESSION_REFUSED'],
  ['revoked during the body read',h=>{h.calls.onBodyRead=()=>{h.authority.revoked=true;};},403,'SESSION_REFUSED'],
  ['scope policy changed during the body read',h=>{h.calls.onBodyRead=()=>{h.authority.policyRevision='b'.repeat(64);};},403,'DOWNLOAD_LINK_ACTOR'],
  ['session expiry passed during the final suppression read',h=>afterDownload(h,h=>{h.authority.expiresAtMs=T+1;h.clock.t=T+2;}),403,'SESSION_REFUSED'],
 ];
 for(const [label,arm,status,expected] of cases){
  const h=harness(),{token}=await h.issue();h.calls.length=0;arm(h);const r=await h.post('links/redeem',{token});
  assert.equal(r.status,status,label);assert.equal(r.headers.get('content-type'),'application/json; charset=utf-8',label);assert.equal(await code(r),expected,label);
  assert.equal(download(h.calls),1,label+': the canonical download ran, its bytes were withheld');
 }
});
test('the version suppressed during the final body read, or the link expiring during it, releases no bytes',async()=>{
 const h=harness(),{token}=await h.issue();h.calls.length=0;h.calls.onBodyRead=()=>h.journal.rows.set(`${tenantId}:artifact:${artifactId}`,{state:'SUPPRESSED',ledgerSequence:4});
 let r=await h.post('links/redeem',{token});assert.equal(r.status,410);assert.equal(await code(r),'RETENTION_SUPPRESSED');assert.equal(download(h.calls),1);
 const short=harness({ttlMs:1000}),issued=await short.issue();assert.equal(issued.expiresAtMs,T+1000);short.calls.onBodyRead=()=>{short.clock.t=T+1000;};
 r=await short.post('links/redeem',{token:issued.token});assert.equal(r.status,410);assert.equal(await code(r),'DOWNLOAD_LINK_EXPIRED');
});
test('authority revoked or the version suppressed during issuance reads signs no link',async()=>{
 const revoked=harness();revoked.calls.onBodyRead=()=>{revoked.authority.revoked=true;};let r=await revoked.post('links/issue',{versionId});assert.equal(r.status,403);assert.equal(Object.hasOwn(await r.json(),'token'),false);
 const suppressed=harness();suppressed.calls.onBodyRead=()=>suppressed.journal.rows.set(`${tenantId}:artifact:${artifactId}`,{state:'SUPPRESSED',ledgerSequence:5});r=await suppressed.post('links/issue',{versionId});assert.equal(r.status,410);assert.equal(await code(r),'RETENTION_SUPPRESSED');
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

// Linearization point (download-links.mjs module comment): the final authority read, bracketed by the pre-download generation and the
// final generation read. `authority.onRead(n)` fires on each current-authority read; issue and redeem each read authority twice (at
// the start and at the final read), so read 2 after the download is the final authority read.
const duringFinalAuthorityRead=(h,change)=>{h.calls.onDownload=()=>{h.calls.armed=true;};h.authority.onRead=n=>{if(h.calls.armed&&n===2)change(h);};};
const artifactRow=(h,row)=>h.journal.rows.set(`${tenantId}:artifact:${artifactId}`,row);
const finalReadCases=[
 ['suppression committed during the final authority read',h=>artifactRow(h,{state:'SUPPRESSED',ledgerSequence:11}),410,'RETENTION_SUPPRESSED'],
 ['suppression and release committed during the final authority read',h=>artifactRow(h,{state:'RELEASED',ledgerSequence:12}),410,'DOWNLOAD_LINK_REVOKED'],
 ['recovery barrier closed during the final authority read',h=>h.serving.disable(),503,'RETENTION_RECOVERY_BARRIER'],
];
test('a suppression or barrier closure committed during the final authority read releases no bytes',async()=>{
 for(const [label,change,status,expected] of finalReadCases){
  const h=harness(),{token}=await h.issue();h.calls.length=0;h.authority.reads=0;duringFinalAuthorityRead(h,change);
  const r=await h.post('links/redeem',{token});assert.equal(r.status,status,label);hardened(r);assert.equal(r.headers.get('content-type'),'application/json; charset=utf-8',label);
  assert.equal(await code(r),expected,label);assert.equal(h.authority.reads,2,label+': the change landed during the final authority read');assert.equal(download(h.calls),1,label+': the canonical download ran, its bytes were withheld');
 }
});
test('a suppression or barrier closure committed during the final authority read signs no link',async()=>{
 for(const [label,change,status,expected] of finalReadCases){
  const h=harness();duringFinalAuthorityRead(h,change);const r=await h.post('links/issue',{versionId});assert.equal(r.status,status,label);hardened(r);
  const body=await r.json();assert.equal(body.error.code,expected,label);assert.equal(Object.hasOwn(body,'token'),false,label);assert.equal(h.authority.reads,2,label);
 }
});
test('authority revoked during the post-body generation read signs and releases nothing',async()=>{
 // The generation read that precedes the final authority read (the last generation read at the previous pin).
 const armed=h=>{h.calls.onDownload=()=>{h.calls.armed=true;};h.journal.rows.onGet=()=>{if(h.calls.armed&&!h.authority.revoked){h.authority.revoked=true;}};};
 const issuing=harness();armed(issuing);let r=await issuing.post('links/issue',{versionId});assert.equal(r.status,403);const body=await r.json();assert.equal(body.error.code,'SESSION_REFUSED');assert.equal(Object.hasOwn(body,'token'),false);
 const redeeming=harness(),{token}=await redeeming.issue();redeeming.calls.length=0;armed(redeeming);r=await redeeming.post('links/redeem',{token});assert.equal(r.status,403);assert.equal(await code(r),'SESSION_REFUSED');assert.equal(download(redeeming.calls),1);
});
test('linearization order: the final generation read is the last awaited read and follows the final authority read',async()=>{
 // Pins the documented order. A suppression committed after the final authority read is still observed (tests above); an authority
 // change committed after the final authority read, while the final generation read is pending, is ordered after the read, exactly
 // like a revocation committed just after a completed download. Session expiry is still checked synchronously after that read.
 const order=[],h=harness(),{token}=await h.issue();h.calls.length=0;h.authority.reads=0;
 h.calls.onDownload=()=>{h.calls.armed=true;};h.authority.onRead=n=>{if(h.calls.armed)order.push('authority:'+n);};
 h.journal.rows.onGet=()=>{if(!h.calls.armed)return;order.push('generation');if(h.authority.reads===2)h.authority.revoked=true;};
 let r=await h.post('links/redeem',{token});assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),h.bytes);
 assert.deepEqual(order,['generation','generation','authority:2','generation','generation'],'two subjects (conversation, artifact): post-body generation, final authority, final generation');
 const expiring=harness({sessionExpiresAtMs:T+3000}),issued=await expiring.issue();expiring.calls.length=0;expiring.authority.reads=0;
 expiring.calls.onDownload=()=>{expiring.calls.armed=true;};expiring.journal.rows.onGet=()=>{if(expiring.calls.armed&&expiring.authority.reads===2)expiring.clock.t=T+3000;};
 r=await expiring.post('links/redeem',{token:issued.token});assert.equal(r.status,403);assert.equal(await code(r),'SESSION_REFUSED');
});
