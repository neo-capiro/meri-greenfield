/** Independent actual Fetch flow. Synthetic ports do not establish native durability. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createLocalActionDemo} from './demo.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';

const root=fileURLToPath(new URL('../../../../',import.meta.url));
const clone=v=>JSON.parse(JSON.stringify(v));
async function setup(t,options={}){const d=await createLocalActionDemo({mode:'synthetic-local',...options});t.after(()=>d.close());return d;}
async function wire(d,route,body,options={}){
 const headers={'content-type':'application/json',authorization:`Bearer ${d.credential}`,...options.headers};
 const response=await d.app.handle(new Request(`http://synthetic.invalid/api/action-followthrough/${route}`,{method:'POST',headers,body:JSON.stringify(body),signal:options.signal}));
 const text=await response.text();assert.ok(!text.includes(d.credential));
 return {status:response.status,body:JSON.parse(text),headers:response.headers};
}
function refusal(r){assert.ok(r.status>=400&&r.status<600,`expected refusal, got ${r.status}`);assert.deepEqual(Object.keys(r.body),['error']);assert.deepEqual(Object.keys(r.body.error).sort(),['code','outcome']);}
async function selected(d){const q=await wire(d,'query',{request:{limit:5}});assert.equal(q.status,200);assert.equal(q.body.classification,'recommendations');assert.equal(q.body.acceptedTasks,false);const row=q.body.observation.result.actions[0];assert.ok(row);return {q:q.body,selection:{resultReference:q.body.resultReference,resultSha256:q.body.resultSha256,actionId:row.id}};}
async function proposal(d){const {q,selection}=await selected(d);const draft=await wire(d,'draft',{selection,edits:{title:'Explicit independently reviewed task'}});assert.equal(draft.status,200);const prepared=await wire(d,'prepare',{draft:draft.body});assert.equal(prepared.status,200);assert.equal(prepared.body.status,'approval_required');return {q,selection,draft:draft.body,proposal:prepared.body.proposal};}

test('independent full wire flow: recommendation, draft, pending refusal, explicit approval, one effect and replay',async t=>{
 const d=await setup(t);const p=await proposal(d);assert.equal(d.stats().taskEffects,0);assert.equal(d.stats().metadataRows,1);assert.equal(d.stats().sourceReads,1);
 refusal(await wire(d,'execute',{proposal:p.proposal}));assert.equal(d.stats().taskEffects,0);
 await d.approve(p.proposal);const done=await wire(d,'execute',{proposal:p.proposal});assert.equal(done.status,200);assert.equal(done.body.status,'observed');assert.equal(d.stats().taskEffects,1);
 const replay=await wire(d,'execute',{proposal:p.proposal});assert.equal(replay.status,200);assert.deepEqual(replay.body,done.body);assert.equal(d.stats().taskEffects,1);assert.equal(d.stats().commandRows,1);
 assert.equal(p.q.events.length,2);assert.equal(p.q.events[0].type,'tool.started');assert.equal(p.q.events[1].type,'tool.completed');assert.equal(p.q.observation.result.actions[0].acceptedAsTask,false);
});
for(const mode of [undefined,'production','local','synthetic'])test(`independent mode ${String(mode)} refuses`,async()=>{await assert.rejects(createLocalActionDemo({mode}));});
for(const ttlMs of [0,-1,30001,Infinity,1.5])test(`independent invalid ttl ${ttlMs} refuses`,async()=>{await assert.rejects(createLocalActionDemo({mode:'synthetic-local',ttlMs}));});
test('independent opaque credentials are distinct between sessions and absent from stats',async t=>{const a=await setup(t),b=await setup(t);assert.notEqual(a.credential,b.credential);assert.ok(a.credential.length>=32);assert.ok(!JSON.stringify(a.stats()).includes(a.credential));refusal(await wire(b,'query',{request:{}},{headers:{authorization:`Bearer ${a.credential}`}}));assert.equal(b.stats().sourceReads,0);});
for(const auth of ['','Bearer invalid','Basic synthetic'])test(`independent invalid authorization ${auth||'empty'}`,async t=>{const d=await setup(t);refusal(await wire(d,'query',{request:{}},{headers:{authorization:auth}}));assert.equal(d.stats().sourceReads,0);assert.equal(d.stats().taskEffects,0);});
for(const field of ['tenantId','actorId','clientId','scopes','approval','credential'])test(`independent query body ${field} never grants authority`,async t=>{const d=await setup(t);refusal(await wire(d,'query',{request:{},[field]:'synthetic-policy-canary'}));assert.equal(d.stats().sourceReads,0);});
test('independent query request cannot select another client',async t=>{const d=await setup(t);refusal(await wire(d,'query',{request:{clientId:'00000000-0000-4000-8000-000000009999'}}));assert.equal(d.stats().sourceReads,0);});
test('independent cross-session retained selection refuses even with valid second credential',async t=>{const a=await setup(t),b=await setup(t);const p=await selected(a);refusal(await wire(b,'draft',{selection:p.selection}));assert.equal(b.stats().taskEffects,0);assert.equal(b.stats().metadataRows,0);});
test('independent cross-session proposal approval and execution refuse',async t=>{const a=await setup(t),b=await setup(t),p=await proposal(a);await assert.rejects(b.approve(p.proposal));refusal(await wire(b,'execute',{proposal:p.proposal}));assert.equal(b.stats().taskEffects,0);});
test('independent revoked session denies reads and trusted approval',async t=>{const d=await setup(t),p=await proposal(d);d.revoke();refusal(await wire(d,'query',{request:{}}));await assert.rejects(d.approve(p.proposal));assert.equal(d.stats().sourceReads,1);assert.equal(d.stats().taskEffects,0);});
test('independent preparation policy revocation prevents metadata insert',async t=>{const d=await setup(t),p=await selected(d),draft=await wire(d,'draft',{selection:p.selection});assert.equal(draft.status,200);d.denyPreparation();refusal(await wire(d,'prepare',{draft:draft.body}));assert.equal(d.stats().metadataRows,0);assert.equal(d.stats().taskEffects,0);});
test('independent current client denial invalidates retained source read',async t=>{const d=await setup(t),p=await selected(d);d.denyClient();refusal(await wire(d,'draft',{selection:p.selection}));assert.equal(d.stats().metadataRows,0);assert.equal(d.stats().taskEffects,0);});
test('independent revoked exact approval refuses before task effect',async t=>{const d=await setup(t),p=await proposal(d);await d.approve(p.proposal);d.revokeApproval(p.proposal.proposalId);refusal(await wire(d,'execute',{proposal:p.proposal}));assert.equal(d.stats().taskEffects,0);});
test('independent tampered proposal neither approves nor executes',async t=>{const d=await setup(t),p=await proposal(d),changed=clone(p.proposal);changed.command.arguments.title='Substituted task';await assert.rejects(d.approve(changed));refusal(await wire(d,'execute',{proposal:changed}));assert.equal(d.stats().taskEffects,0);});
test('independent selection hash tampering refuses',async t=>{const d=await setup(t),p=await selected(d);p.selection.resultSha256='f'.repeat(64);refusal(await wire(d,'draft',{selection:p.selection}));assert.equal(d.stats().metadataRows,0);});
test('independent no HTTP approval route',async t=>{const d=await setup(t);refusal(await wire(d,'approve',{approved:true}));assert.equal(d.stats().approvals,0);assert.equal(d.stats().taskEffects,0);});
test('independent pre-aborted Request does not run source',async t=>{const d=await setup(t),a=new AbortController();a.abort();refusal(await wire(d,'query',{request:{}},{signal:a.signal}));assert.equal(d.stats().sourceReads,0);});
test('independent session expiry refuses subsequent requests',async t=>{const d=await setup(t,{ttlMs:150});await new Promise(r=>setTimeout(r,175));refusal(await wire(d,'query',{request:{}}));assert.equal(d.stats().sourceReads,0);assert.equal(d.stats().taskEffects,0);});
test('independent close is idempotent and leaves session unavailable',async t=>{const d=await setup(t);d.close();d.close();assert.equal(d.stats().closed,true);refusal(await wire(d,'query',{request:{}}));assert.equal(d.stats().sourceReads,0);});
test('independent success response prevents caching and adds no permissive CORS',async t=>{const d=await setup(t),r=await wire(d,'query',{request:{}});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('access-control-allow-origin'),null);});

for(const args of [['--help'],['--unknown'],[],['--run','--help']])test(`independent CLI admission ${args.join(' ')||'empty'}`,()=>{
 const r=spawnSync(process.execPath,['scripts/local-followthrough/run.mjs',...args],{cwd:root,env:{...process.env,MERI_REVIEW_SOURCE_ROOT:'/definitely-unavailable-review-root'},encoding:'utf8',timeout:10000,maxBuffer:65536});assert.equal(r.error,undefined);assert.equal(r.signal,null);assert.equal(r.status,args.length===1&&args[0]==='--help'?0:2);assert.ok(!r.stderr.includes('/definitely-unavailable-review-root'));assert.ok(!r.stdout.includes('credential'));
});
test('independent explicit CLI synthetic run succeeds without exposing bearer secrets',()=>{
 const r=spawnSync(process.execPath,['scripts/local-followthrough/run.mjs','--run'],{cwd:root,env:{...process.env,MERI_REVIEW_SOURCE_ROOT:root},encoding:'utf8',timeout:20000,maxBuffer:262144});assert.equal(r.error,undefined);assert.equal(r.signal,null);assert.equal(r.status,0,r.stderr);assert.equal(r.stderr,'');assert.ok(!/Bearer |"credential"|"token"/.test(r.stdout));const receipt=JSON.parse(r.stdout);assert.equal(receipt.mode,'synthetic-local');
});

test('independent recomputed tampered command digest does not match retained metadata',async t=>{const d=await setup(t),p=await proposal(d),changed=clone(p.proposal);changed.command.arguments.title='Rehashed substituted task';changed.commandSha256=canonicalSha256(changed.command);await assert.rejects(d.approve(changed));refusal(await wire(d,'execute',{proposal:changed}));assert.equal(d.stats().taskEffects,0);});
test('independent revoked session after explicit approval still denies execution',async t=>{const d=await setup(t),p=await proposal(d);await d.approve(p.proposal);d.revoke();refusal(await wire(d,'execute',{proposal:p.proposal}));assert.equal(d.stats().taskEffects,0);});
for(const mode of ['revoke','expire'])test(`independent ${mode} during body acquisition refuses before source`,async t=>{
 const d=await setup(t,mode==='expire'?{ttlMs:150}:{});let control;const stream=new ReadableStream({start(c){control=c;}});
 const promise=d.app.handle(new Request('http://synthetic.invalid/api/action-followthrough/query',{method:'POST',duplex:'half',headers:{authorization:`Bearer ${d.credential}`,'content-type':'application/json'},body:stream}));
 if(mode==='expire')await new Promise(r=>setTimeout(r,175));else d.revoke();control.enqueue(new TextEncoder().encode(JSON.stringify({request:{}})));control.close();const response=await promise;refusal({status:response.status,body:await response.json()});assert.equal(d.stats().sourceReads,0);assert.equal(d.stats().taskEffects,0);
});
test('independent fresh repeated queries preserve distinct result references and event slots',async t=>{const d=await setup(t),a=await selected(d),b=await selected(d);assert.notEqual(a.q.resultReference,b.q.resultReference);assert.notEqual(a.q.lookupId,b.q.lookupId);assert.ok(b.q.events[0].sequence>a.q.events[1].sequence);assert.equal(d.stats().sourceReads,2);assert.equal(d.stats().lookupRows,2);assert.equal(d.stats().taskEffects,0);});
