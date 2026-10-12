import test from 'node:test';
import assert from 'node:assert/strict';
import {createTaskLookupDelivery} from '../delivery.mjs';
import {NOW,id,context,readContext,envelope,hash,validateShape,deferred} from '../../../../docs/qualification/candidates/task-slice-20261012/control-review/fixture.mjs';

function harness(options={}){
 const c=context(),original=structuredClone(c),s={now:NOW,calls:[],record:null,claimed:false,state:null,events:null,auth:[]};
 const ack=(b,state)=>({lookupId:b.context.lookupId,bindingSha256:b.bindingSha256,state});
 const store={
  async claim(b,event,check){s.calls.push('claim');check();if(s.claimed)throw new Error('Synthetic duplicate');s.claimed=true;s.state='CLAIMED';s.started=structuredClone(event);s.binding=structuredClone(b);return ack(b,'CLAIMED');},
  async markDispatching(b,check){s.calls.push('markDispatching');check();s.state='DISPATCHING';return ack(b,'DISPATCHING');},
  async complete(b,record,check){s.calls.push('complete');check();s.record=structuredClone(record);s.state='RESULT';return ack(b,'RESULT');},
  async recordError(b,event,check){s.calls.push('recordError');check();s.state='ERROR';s.events=structuredClone(event);return ack(b,'ERROR');},
  async read(selection,check){s.calls.push('read');check();s.readSelection=structuredClone(selection);return s.record===null?null:structuredClone(s.record);}
 };
 const gateway={async executeOwned(raw,credential,delivery,signal){s.calls.push('gateway');s.gateway={raw,credential,delivery,signal};const r=JSON.parse(raw).arguments;const {clientId:ignored,...request}=r;return JSON.stringify(envelope(request,original));}};
 const authorize=async call=>{s.calls.push(call.phase);s.auth.push(call);return {authorized:true,bindingSha256:call.binding.bindingSha256,expiresAtMs:NOW+9000};};
 Object.assign(store,options.store?.(s,{...store})??{});Object.assign(gateway,options.gateway?.(s,{...gateway})??{});
 const delivery=createTaskLookupDelivery({gateway,store,authorize:options.authorize?.(s,authorize)??authorize,clock:()=>s.now});
 return {c,s,store,gateway,delivery,lookup:(extra={})=>delivery.lookup({request:{},context:c,credential:'synthetic-capability',...extra}),read:(extra={})=>delivery.read({resultReference:c.resultReference,context:readContext(),...extra})};
}
const reject=async(p,code)=>{await assert.rejects(p,e=>{assert.equal(typeof e.message,'string');if(code)assert.equal(e.code,code);return true;});};
const count=(h,n)=>h.s.calls.filter(x=>x===n).length;

// Literal outcomes from the approved API, not a second implementation of delivery policy.
test('independent actual delivery uses exact owned gateway seam once and returns only immutable references',async()=>{
 const h=harness(),out=await h.lookup();assert.equal(count(h,'gateway'),1);
 assert.deepEqual(JSON.parse(h.s.gateway.raw),{operation:{id:'actions.query',version:'0.2.0'},arguments:{clientId:h.c.selectedClientId}});
 assert.equal(h.s.gateway.credential,'synthetic-capability');assert.equal(h.s.gateway.delivery,h.c.deliveryJson);
 assert.deepEqual(Object.keys(out).sort(),['lookupId','resultReference','resultSha256','classification','acceptedTasks','events'].sort());
 assert.equal(out.classification,'recommendations');assert.equal(out.acceptedTasks,false);assert.equal(out.resultReference,h.c.resultReference);
 assert.equal(out.resultSha256,hash(envelope()));assert.deepEqual(out.events.map(x=>x.type),['tool.started','tool.completed']);
 for(const e of out.events){validateShape('UIEvent',e);assert.deepEqual(e.binding,h.c.binding);assert.deepEqual(e.scopes,h.c.scopes);}
 assert.equal(out.events[0].eventId,h.c.slots.started.eventId);assert.equal(out.events[1].eventId,h.c.slots.terminal.eventId);
 assert.equal(out.events[1].data.resultReference,out.resultReference);assert.equal(out.events[0].data.requestId,h.c.requestId);
 assert.ok(h.s.calls.indexOf('markDispatching')<h.s.calls.indexOf('gateway'));assert.ok(h.s.calls.indexOf('complete')<h.s.calls.indexOf('before_release'));
});
test('independent read rechecks current access and preserves exact stored observation without redispatch',async()=>{
 const h=harness();const out=await h.lookup(),read=await h.read();assert.equal(count(h,'gateway'),1);assert.deepEqual(read.observation,envelope());assert.deepEqual(read.events,out.events);assert.equal(read.resultSha256,out.resultSha256);
 assert.deepEqual(h.s.readSelection,{tenantId:h.c.binding.tenantId,resultReference:h.c.resultReference});assert.ok(h.s.calls.includes('before_read'));assert.equal(h.s.calls.at(-1),'before_release');
 assert.equal(read.observation.result.evidenceReady,false);assert.deepEqual(read.observation.result.negativeAssertion,{kind:'none'});
});
test('independent exact duplicate delivery never invokes gateway twice',async()=>{const h=harness();await h.lookup();await reject(h.lookup());assert.equal(count(h,'gateway'),1);});
test('independent concurrent same lookup has only one successful claim and one gateway call',async()=>{const h=harness();const all=await Promise.allSettled([h.lookup(),h.lookup()]);assert.equal(all.filter(x=>x.status==='fulfilled').length,1);assert.equal(count(h,'gateway'),1);});
for(const phase of ['before_claim','before_dispatch','before_store','before_release'])test(`independent revocation at ${phase} refuses release and downstream work`,async()=>{
 const h=harness({authorize:(s,good)=>async call=>{if(call.phase===phase){s.calls.push(phase);throw new Error('private-policy-canary');}return good(call);}});
 await assert.rejects(h.lookup(),e=>!String(e.message).includes('private-policy-canary'));
 if(['before_claim','before_dispatch'].includes(phase))assert.equal(count(h,'gateway'),0);
 if(phase==='before_claim')assert.equal(count(h,'claim'),0);if(phase==='before_store')assert.equal(count(h,'complete'),0);
});
for(const phase of ['before_read','before_release'])test(`independent reconnect revocation at ${phase} does not expose stored content`,async()=>{
 let reading=false;const h=harness({authorize:(s,good)=>async call=>{if(reading&&call.phase===phase)throw new Error('private-reader-canary');return good(call);}});await h.lookup();reading=true;
 await assert.rejects(h.read(),e=>!String(e.message).includes('private-reader-canary'));assert.equal(count(h,'gateway'),1);
 if(phase==='before_read')assert.equal(count(h,'read'),0);
});
test('independent recovered current binding stays distinct from immutable producer provenance',async()=>{
 const h=harness();await h.lookup();const c=readContext();c.currentBinding.attemptId=id(83);c.currentBinding.workerId=id(84);c.currentBinding.writerFence=2;
 const out=await h.read({context:c});assert.deepEqual(out.events[0].binding,h.c.binding);assert.deepEqual(out.observation.binding,h.c.binding);
 const auth=h.s.auth.filter(x=>x.phase==='before_release').at(-1);assert.deepEqual(auth.binding.current,c.currentBinding);assert.deepEqual(auth.binding.original.context.binding,h.c.binding);
});
for(const field of ['tenantId','actorId','conversationId','runId','attemptId','workerId','writerFence'])test(`independent wrong stored original ${field} cannot pass immutable result digest checks`,async()=>{
 const h=harness();await h.lookup();h.s.record.observation.binding[field]=field==='writerFence'?2:'different';await reject(h.read());assert.equal(count(h,'gateway'),1);
});
test('independent cross-tenant read refuses even if policy callback returns allowed',async()=>{const h=harness();await h.lookup();const c=readContext();c.currentBinding.tenantId='other-tenant';await reject(h.read({context:c}));});
test('independent stored digest and completed event reference substitutions refuse',async()=>{
 for(const change of [r=>r.resultSha256='a'.repeat(64),r=>r.events[1].data.resultReference=id(90),r=>r.events[1].sequence++,r=>r.events[0].data.requestId=id(91)]){const h=harness();await h.lookup();change(h.s.record);await reject(h.read());}
});
test('independent all model authority and selection fields stay outside the raw request',async()=>{
 for(const extra of [{clientId:id(90)},{binding:{}},{tenantId:'other'},{authorized:true},{scopes:[]},{deliveryJson:'x'},{resultReference:id(90)}]){const h=harness();await reject(h.lookup({request:extra}));assert.equal(count(h,'gateway'),0);assert.equal(count(h,'claim'),0);}
});
test('independent hostile request/context and thrown accessor never execute getters',async()=>{
 let effects=0;const bad={};Object.defineProperty(bad,'limit',{enumerable:true,get(){effects++;return 1;}});
 const proxy=new Proxy({},{get(){effects++;return undefined;},ownKeys(){effects++;return [];},getPrototypeOf(){effects++;return Object.prototype;}});
 for(const request of [bad,proxy]){const h=harness();await reject(h.lookup({request}));assert.equal(count(h,'gateway'),0);}
 const thrown={};Object.defineProperty(thrown,'code',{get(){effects++;return 'DEADLINE';}});Object.defineProperty(thrown,'message',{get(){effects++;return 'private';}});
 const h=harness({authorize:()=>async()=>{throw thrown;}});await reject(h.lookup());assert.equal(effects,0);
});
test('independent caller mutations during claim cannot alter selected request or original provenance',async()=>{
 const gate=deferred();let entered;const began=new Promise(r=>entered=r);const h=harness({store:(s,base)=>({claim:async(...args)=>{entered();await gate.promise;return base.claim(...args);}})});
 const request={limit:1};const run=h.lookup({request});await began;request.limit=50;h.c.binding.actorId='changed';h.c.selectedClientId=id(90);gate.resolve();const out=await run;
 assert.equal(JSON.parse(h.s.gateway.raw).arguments.limit,1);assert.equal(JSON.parse(h.s.gateway.raw).arguments.clientId,id(10));assert.equal(out.events[0].binding.actorId,'synthetic-actor');
});
for(const method of ['claim','markDispatching','complete'])test(`independent uncertain ${method} acknowledgment does not redispatch`,async()=>{
 const h=harness({store:(s,base)=>({[method]:async(...args)=>{await base[method](...args);throw new Error('lost-ack-private-canary');}})});
 await reject(h.lookup());await reject(h.lookup());assert.equal(count(h,'gateway'),method==='complete'?1:0);
});
for(const method of ['claim','markDispatching','complete'])test(`independent post-${method} deadline prevents later effects and release`,async()=>{
 const h=harness({store:(s,base)=>({[method]:async(...args)=>{const result=await base[method](...args);s.now=NOW+10001;return result;}})});
 await reject(h.lookup());if(method!=='complete')assert.equal(count(h,'gateway'),0);
});
test('independent post-gateway deadline suppresses durable result publication',async()=>{
 const h=harness({gateway:(s,base)=>({executeOwned:async(...args)=>{const v=await base.executeOwned(...args);s.now=NOW+10001;return v;}})});await reject(h.lookup());assert.equal(count(h,'complete'),0);
});
test('independent early expiry from authority bounds a parked store and late acknowledgment',async()=>{
 const gate=deferred();let entered;const began=new Promise(r=>entered=r);
 const h=harness({authorize:(s,good)=>async call=>{const r=await good(call);return {...r,expiresAtMs:NOW+30};},store:()=>({claim:async b=>{entered();return gate.promise;}})});
 const run=h.lookup();await began;await reject(run);gate.resolve({lookupId:h.c.lookupId,bindingSha256:'a'.repeat(64),state:'CLAIMED'});await new Promise(r=>setImmediate(r));assert.equal(count(h,'gateway'),0);
});
test('independent cancellation while gateway parks has no late publication or result event',async()=>{
 const gate=deferred();let entered;const began=new Promise(r=>entered=r);const h=harness({gateway:s=>({executeOwned:async()=>{s.calls.push('gateway');entered();return gate.promise;}})}),controller=new AbortController();
 const run=h.lookup({signal:controller.signal});await began;controller.abort();await reject(run);gate.resolve(JSON.stringify(envelope()));await new Promise(r=>setImmediate(r));assert.equal(count(h,'complete'),0);assert.equal(count(h,'recordError'),0);
});
test('independent missing result is unavailable and never causes a lookup',async()=>{const h=harness();await reject(h.read());assert.equal(count(h,'gateway'),0);assert.equal(count(h,'claim'),0);});

test('independent returned source scopes cannot substitute different policy or widen UI-event provenance',async()=>{
 for(const mutate of [o=>o.subject.scopes[0].policyRevision='different-policy',o=>o.subject.scopes.push({...o.subject.scopes[0],resourceId:id(91)})]){
  const h=harness({gateway:()=>({executeOwned:async()=>{const o=envelope();mutate(o);o.result.subject=structuredClone(o.subject);return JSON.stringify(o);}})});
  await assert.rejects(h.lookup());assert.equal(count(h,'complete'),0);
 }
});
test('independent recovered reader policy receives original source scopes and current scope selection separately',async()=>{
 const h=harness();await h.lookup();const c=readContext();c.currentBinding.actorId='delegated-reader';c.scopes[0].policyRevision='current-reader-policy';
 const out=await h.read({context:c});const a=h.s.auth.at(-1).binding;
 assert.deepEqual(a.original.context.scopes,h.c.scopes);assert.deepEqual(a.scopes,c.scopes);assert.equal(a.current.actorId,'delegated-reader');assert.deepEqual(out.observation.subject.scopes,h.c.scopes);
});
