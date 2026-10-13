import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,id} from '../action-followthrough/test/fixture.mjs';
import {createActionApplication} from './index.mjs';
const prefix='https://application.invalid/api/action-followthrough/';
const clone=structuredClone,turn=()=>new Promise(r=>setImmediate(r));
const gate=()=>{let enter,release;const entered=new Promise(r=>enter=r),blocked=new Promise(r=>release=r);return{enter,release,entered,blocked};};
function request(route,body,options={}){return new Request(prefix+route,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer synthetic-session',...options.headers},body:JSON.stringify(body),...options});}
async function fixture(changes={}){
 const t=await setup(),state={resolves:0,queries:0,reads:0,authorizations:0,approved:false,revoked:false,serial:100,disposed:0},hooks={};
 const stored=[...t.pool.lookups.values()][0].record.binding.context;
 const lookup={async lookup(call){state.queries++;if(hooks.lookup)return hooks.lookup(call);return t.lookup.lookup(call);},async read(call){state.reads++;if(hooks.read)return hooks.read(call);return t.lookup.read(call);}};
 t.pool.pool.end=()=>{state.disposed++;};
 const resolveSession=async call=>{
  state.resolves++;if(hooks.resolve)await hooks.resolve(call);
  if(state.revoked||call.credential!=='synthetic-session')throw Object.assign(Error('SECRET_SESSION_DETAIL'),{code:'ACCESS_DENIED'});
  const n=state.serial;state.serial+=10;
  const lookupContext={...clone(stored),lookupId:id(n),resultReference:id(n+1),requestId:id(n+2),slots:{started:{eventId:id(n+3),sequence:n},terminal:{eventId:id(n+4),sequence:n+1}},deliveryJson:JSON.stringify({...JSON.parse(stored.deliveryJson),deliveryId:`delivery-${n}`})};
  const session={lookup,lookupContext,lookupCredential:t.issued.credential,readContext:t.readContext,commandOptions:t.commandOptions,
   async authorizeExecution({proposal,signal,deadlineMs}){state.authorizations++;if(hooks.authorize)await hooks.authorize({proposal,signal,deadlineMs});
    if(!state.approved)throw Object.assign(Error('SECRET_APPROVAL_DETAIL'),{code:'ACCESS_DENIED'});
    Object.assign(t.f.execution,{proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:proposal.command.idempotencyKey});
    Object.assign(t.f.decision,{proposalId:proposal.proposalId,commandSha256:proposal.commandSha256});
    return {execution:clone(t.f.execution),credential:'synthetic'};},expiresAtMs:t.clock()+5000,checkedAtMs:t.clock()};
  if(hooks.session)hooks.session(session,call);return session;
 };
 const config={resolveSession,now:t.clock,limits:{maxRequestMs:1000,maxRequestBytes:65536,maxResponseBytes:65536},...changes};
 const app=createActionApplication(config);
 const call=async(route,body,options)=>{const response=await app.handle(request(route,body,options));const text=await response.text();return{response,text,value:JSON.parse(text)};};
 const prepared=async()=>{const d=await call('draft',{selection:t.wanted,edits:{title:'Explicit task'}});assert.equal(d.response.status,200,d.text);const p=await call('prepare',{draft:d.value});assert.equal(p.response.status,200,p.text);return p.value;};
 return{t,state,hooks,app,config,lookup,call,prepared};
}
function refused(r){assert.notEqual(r.response.status,200,r.text);assert.deepEqual(Object.keys(r.value),['error']);assert.deepEqual(Object.keys(r.value.error).sort(),['code','outcome']);assert.equal(r.text.includes('SECRET_'),false);assert.equal(r.response.headers.get('access-control-allow-origin'),null);}

test('application independent actual query -> edited draft -> proposal -> explicit execution and replay',async()=>{
 const f=await fixture(),q=await f.call('query',{request:{limit:20}});assert.equal(q.response.status,200,q.text);assert.ok(q.value.observation);assert.equal(q.value.acceptedTasks,false);assert.equal(f.state.queries,1);assert.equal(f.state.reads,1);
 const selection={resultReference:q.value.resultReference,resultSha256:q.value.resultSha256,actionId:q.value.observation.result.actions[0].id};
 const d=await f.call('draft',{selection,edits:{title:'User edited task',dueDate:'2026-11-05'}});assert.equal(d.response.status,200,d.text);assert.equal(d.value.task.title,'User edited task');
 const p=await f.call('prepare',{draft:d.value});assert.equal(p.response.status,200,p.text);assert.equal(p.value.status,'approval_required');assert.equal(f.t.f.state.fetches,0);
 const denied=await f.call('execute',{proposal:p.value.proposal});refused(denied);assert.equal(f.t.f.state.fetches,0);
 f.state.approved=true;const result=await f.call('execute',{proposal:p.value.proposal});assert.equal(result.response.status,200,result.text);assert.equal(result.value.status,'observed');assert.equal(f.t.f.state.fetches,1);
 const replay=await f.call('execute',{proposal:p.value.proposal});assert.equal(replay.response.status,200,replay.text);assert.deepEqual(replay.value,result.value);assert.equal(f.t.f.state.fetches,1);assert.equal(f.state.disposed,0);
});
for(const [name,route,body]of [['query authority','query',{request:{limit:20},tenantId:'evil'}],['caller execution','execute',{proposal:{},execution:{},credential:'evil'}],['draft approver','draft',{selection:{},requiredApprover:'evil'}],['prepare approval','prepare',{draft:{},approved:true}]])
 test(`application independent closed ${name}`,async()=>{const f=await fixture(),r=await f.call(route,body);refused(r);assert.equal(f.t.f.state.fetches,0);assert.equal(f.state.queries,0);});
for(const [name,options]of [['wrong method',{method:'PUT'}],['wrong content type',{headers:{authorization:'Bearer synthetic-session','content-type':'text/plain'}}],['missing credential',{headers:{'content-type':'application/json'}}],['wrong auth scheme',{headers:{'content-type':'application/json',authorization:'Basic synthetic-session'}}]])
 test(`application independent ${name} before session ports`,async()=>{const f=await fixture(),r=await f.call('query',{request:{limit:20}},options);refused(r);assert.equal(f.state.resolves,0);});
test('application independent unknown route and query-string route refuse',async()=>{const f=await fixture();for(const route of ['unknown','query?clientId=evil']){const r=await f.call(route,{request:{limit:20}});refused(r);}assert.equal(f.state.resolves,0);});
for(const raw of ['{"request":','[]','null','{"request":{}} trailing'])test(`application independent malformed JSON ${raw}`,async()=>{const f=await fixture(),r=await f.call('query',{}, {body:raw});refused(r);assert.equal(f.state.queries,0);});
test('application independent byte cap handles multibyte UTF8 before session',async()=>{const f=await fixture({limits:{maxRequestMs:1000,maxRequestBytes:64,maxResponseBytes:65536}}),r=await f.call('query',{request:{q:'é'.repeat(32)}});refused(r);assert.equal(f.state.resolves,0);});
test('application independent body stream cancelled with no later session',async()=>{
 const f=await fixture(),ac=new AbortController();let cancelled=0;const stream=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{"request":'));},cancel(){cancelled++;}});
 const work=f.call('query',{}, {body:stream,duplex:'half',signal:ac.signal});await turn();ac.abort();const r=await work;refused(r);await turn();assert.equal(f.state.resolves,0);assert.equal(cancelled,1);
});
test('application independent revoked opaque session and source denial leak no details',async()=>{const f=await fixture();f.state.revoked=true;const r=await f.call('draft',{selection:f.t.wanted});refused(r);assert.equal(f.state.reads,0);assert.equal(f.t.metadataCalls(),0);});
test('application independent stale or expired resolved session refuses before read',async()=>{for(const change of [s=>s.expiresAtMs=0,s=>s.checkedAtMs=0]){const f=await fixture();f.hooks.session=change;const r=await f.call('draft',{selection:f.t.wanted});refused(r);assert.equal(f.state.reads,0);}});
test('application independent cancelled parked session cannot begin domain work',async()=>{const f=await fixture(),g=gate(),ac=new AbortController();f.hooks.resolve=async()=>{g.enter();await g.blocked;};const work=f.call('draft',{selection:f.t.wanted},{signal:ac.signal});await g.entered;ac.abort();refused(await work);g.release();await turn();assert.equal(f.state.reads,0);assert.equal(f.t.metadataCalls(),0);});
test('application independent known short session expiry clips metadata original deadline',async()=>{
 const f=await fixture();let bound;f.hooks.session=s=>s.expiresAtMs=f.t.clock()+50;f.t.hooks.metadata=call=>{bound=call.deadlineMs;f.t.f.state.now+=51;};
 const d=await f.call('draft',{selection:f.t.wanted});assert.equal(d.response.status,200,d.text);const start=f.t.clock(),r=await f.call('prepare',{draft:d.value});refused(r);assert.ok(bound<=start+50);assert.equal(f.t.f.state.fetches,0);
});
test('application independent query known stored release failure remains RESULT_NOT_RELEASED',async()=>{const f=await fixture();f.hooks.read=async()=>{throw Object.assign(Error('SECRET_READ'),{code:'ACCESS_DENIED',outcome:'NOT_DISPATCHED'});};const r=await f.call('query',{request:{limit:20}});refused(r);assert.equal(r.value.error.outcome,'RESULT_NOT_RELEASED');assert.equal(f.state.queries,1);});
test('application independent opaque query UNKNOWN is preserved without redispatch',async()=>{const f=await fixture();f.hooks.lookup=async()=>{throw Object.assign(Error('SECRET_SQL'),{code:'LOOKUP_UNAVAILABLE',outcome:'UNKNOWN'});};const r=await f.call('query',{request:{limit:20}});refused(r);assert.equal(r.value.error.outcome,'UNKNOWN');assert.equal(f.state.queries,1);});
test('application independent forged proposal never reaches source',async()=>{const f=await fixture(),p=await f.prepared();f.state.approved=true;const proposal=clone(p.proposal);proposal.command.arguments.title='Tampered';const r=await f.call('execute',{proposal});refused(r);assert.equal(f.t.f.state.fetches,0);});
test('application independent conflicting server client binding refuses',async()=>{const f=await fixture();f.hooks.session=s=>s.lookupContext.selectedClientId=id(99);const r=await f.call('draft',{selection:f.t.wanted});refused(r);assert.equal(f.t.metadataCalls(),0);});
test('application independent current canonical read revocation blocks prepare',async()=>{const f=await fixture(),d=await f.call('draft',{selection:f.t.wanted});assert.equal(d.response.status,200);f.t.identity.revoke(f.t.issued.credential);const p=await f.call('prepare',{draft:d.value});refused(p);assert.equal(f.t.metadataCalls(),0);});
test('application independent late execution cancellation cannot return success or retry',async()=>{
 const f=await fixture(),p=await f.prepared(),g=gate(),ac=new AbortController();f.state.approved=true;
 const execute=f.t.commandOptions.executor.execute;f.t.commandOptions.executor={async execute(...args){const result=await execute(...args);g.enter();await g.blocked;return result;}};
 const work=f.call('execute',{proposal:p.proposal},{signal:ac.signal});await g.entered;ac.abort();const r=await work;refused(r);assert.notEqual(r.value.error.outcome,'NOT_DISPATCHED');g.release();await turn();assert.equal(f.t.f.state.fetches,1);assert.equal(f.state.authorizations,1);
});
test('application independent false Content-Length cannot evade streaming byte bound',async()=>{const f=await fixture({limits:{maxRequestMs:1000,maxRequestBytes:64,maxResponseBytes:65536}});const r=await f.call('query',{request:{q:'x'.repeat(100)}},{headers:{authorization:'Bearer synthetic-session','content-type':'application/json','content-length':'1'}});refused(r);assert.equal(f.state.resolves,0);});
test('application independent invalid UTF8 is refused rather than replacement decoded',async()=>{const f=await fixture();const bytes=new Uint8Array([...new TextEncoder().encode('{"request":{"status":"'),255,...new TextEncoder().encode('"}}')]);const r=await f.call('query',{}, {body:bytes});refused(r);assert.equal(f.state.resolves,0);});
test('application independent duplicate credential header cannot resolve an identity',async()=>{const f=await fixture(),headers=new Headers({'content-type':'application/json'});headers.append('authorization','Bearer synthetic-session');headers.append('authorization','Bearer another');const r=await f.call('draft',{selection:f.t.wanted},{headers});refused(r);assert.equal(f.state.reads,0);});
