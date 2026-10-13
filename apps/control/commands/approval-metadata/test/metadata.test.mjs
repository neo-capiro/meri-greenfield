import test from 'node:test';import assert from 'node:assert/strict';
import {setup,NOW,id,canonicalSha256,createMetadataPoolFixture} from './fixture.mjs';
import {createTaskCreateApprovalMetadataOwner,createPostgresApprovalMetadataStore} from '../index.mjs';
function readCall(f,p){return {proposalId:p.proposalId,commandSha256:p.commandSha256,operation:f.call.operation,action:f.call.action,binding:f.binding,deadlineMs:NOW+1000,signal:undefined};}
test('actual command interface prepares canonical immutable task proposal using concrete metadata owner/store',async()=>{
 const f=setup(),out=await f.tool.prepare(f.raw);assert.equal(out.status,'approval_required');assert.equal(out.proposal.command.arguments.title,'Review recommendation');assert.equal(f.effects(),0);assert.equal(f.sql.rows.size,1);
 assert.deepEqual(f.p.calls.map(x=>x.phase),['prepare','before_release']);
 const result=await f.tool.executeApproved(out.proposal,{},'synthetic');assert.deepEqual(result,{status:'indeterminate',outcome:null});assert.equal(f.effects(),1);
 assert.deepEqual(f.p.calls.map(x=>x.phase),['prepare','before_release','before_read','read_release']);
});
test('each explicit prepare has new IDs; no implicit deduplication or mutation',async()=>{
 const f=setup(),a=await f.tool.prepare(f.raw),b=await f.tool.prepare(f.raw);assert.notEqual(a.proposal.proposalId,b.proposal.proposalId);assert.notEqual(a.proposal.command.idempotencyKey,b.proposal.command.idempotencyKey);assert.equal(f.sql.rows.size,2);assert.equal(f.effects(),0);
});
test('immutable prepared result and stored request survive caller edits',async()=>{
 const f=setup(),r=await f.owner.prepare(f.call);f.raw.title='changed';assert.equal(r.request.title,' Review recommendation ');assert(Object.isFrozen(r.request));assert.equal([...f.sql.rows.values()][0].payload.record.request.title,' Review recommendation ');
});
for(const key of ['input','inputSha256','binding','operation','action'])test(`direct substituted ${key} is refused before policy/SQL`,async()=>{
 const f=setup(),call=structuredClone({...f.call,signal:undefined});call[key]=key==='inputSha256'?'a'.repeat(64):key==='action'?'task.update':{};await assert.rejects(f.owner.prepare(call));assert.equal(f.p.calls.length,0);assert.equal(f.sql.calls.length,0);
});
for(const key of ['scopes','requiredApprover','proposalExpiresAt','binding','selectionSha256'])test(`fresh release cannot rewrite policy ${key}`,async()=>{
 const f=setup();f.p.state.mutate=(r,c)=>{if(c.phase==='before_release')r[key]=key==='scopes'?[]:key==='requiredApprover'?{tenantId:'tenant',actorId:'other'}:key==='proposalExpiresAt'?new Date(NOW+50000).toISOString():key==='selectionSha256'?'a'.repeat(64):{...f.binding,writerFence:2};};
 await assert.rejects(f.owner.prepare(f.call),e=>e.outcome==='STORED_NOT_RELEASED');assert.equal(f.sql.rows.size,1);assert.equal(f.effects(),0);
});
test('denied initial policy does not allocate or insert',async()=>{const f=setup();f.p.state.denyPhase='prepare';await assert.rejects(f.owner.prepare(f.call),e=>e.outcome==='NOT_STORED');assert.equal(f.sql.calls.length,0);});
test('missing authorized read is unavailable, not an absent success',async()=>{const f=setup();await assert.rejects(f.owner.read(readCall(f,{proposalId:id(70),commandSha256:'a'.repeat(64)})),e=>e.outcome==='READ_UNAVAILABLE');assert.equal(f.effects(),0);});
test('read binds full original actor/run/binding and command hash',async()=>{
 const f=setup(),out=await f.tool.prepare(f.raw),base=readCall(f,out.proposal);
 for(const call of [{...base,commandSha256:'a'.repeat(64)},{...base,binding:{...base.binding,actorId:'other'}},{...base,binding:{...base.binding,writerFence:2}}])await assert.rejects(f.owner.read(call));
});
test('lost insert acknowledgment retains possible row and UNKNOWN without retry',async()=>{
 const f=setup(),original=f.sql.pool.connect;f.sql.pool.connect=async()=>{const c=await original();return {...c,async query(q){await c.query(q);throw new Error('private database canary');}};};
 const store=createPostgresApprovalMetadataStore({pool:f.sql.pool}),owner=createTaskCreateApprovalMetadataOwner({store,commandContext:f.commandContext,preparePolicy:f.p.preparePolicy,now:()=>NOW,newId:()=>id(80)});
 await assert.rejects(owner.prepare(f.call),e=>e.outcome==='UNKNOWN'&&!e.message.includes('canary'));assert.equal(f.sql.rows.size,1);assert.equal(f.sql.calls.filter(x=>typeof x==='object').length,1);
});
test('current read release denial retains immutable metadata and prevents executor call',async()=>{
 const f=setup(),p=await f.tool.prepare(f.raw);f.p.state.denyPhase='read_release';await assert.rejects(f.tool.executeApproved(p.proposal,{},'synthetic'));assert.equal(f.effects(),0);assert.equal(f.sql.rows.size,1);
});
test('metadata pool configuration requires finite bounds before any connect',()=>{
 const f=createMetadataPoolFixture();for(const key of ['connectionTimeoutMillis','query_timeout']){const pool={...f.pool,options:{...f.pool.options,[key]:0}};assert.throws(()=>createPostgresApprovalMetadataStore({pool}));}assert.deepEqual(f.calls,[]);
});
test('query ACK corruption is UNKNOWN and borrowed client is evicted without pool close',async()=>{
 const f=setup(),original=f.sql.pool.connect;f.sql.pool.connect=async()=>{const c=await original();return{...c,async query(q){const r=await c.query(q);r.rows[0].payload_sha256='b'.repeat(64);return r;}};};
 const store=createPostgresApprovalMetadataStore({pool:f.sql.pool}),owner=createTaskCreateApprovalMetadataOwner({store,commandContext:f.commandContext,preparePolicy:f.p.preparePolicy,now:()=>NOW});
 await assert.rejects(owner.prepare(f.call),e=>e.outcome==='UNKNOWN');assert.equal(f.sql.rows.size,1);assert(f.sql.releases[0]);
});
test('known policy deadline published before parked receipt bounds call with no insert',async()=>{
 const f=setup(),started=Date.now(),owner=createTaskCreateApprovalMetadataOwner({store:f.store,commandContext:f.commandContext,preparePolicy:async({limitDeadline})=>{limitDeadline(started+25);return new Promise(()=>{});}});
 await assert.rejects(owner.prepare({...f.call,deadlineMs:started+1000}),e=>e.message==='DEADLINE'&&e.outcome==='NOT_STORED');assert.equal(f.sql.calls.length,0);
});
test('late acquired SQL client issues no query after cancellation and is released',async()=>{
 const f=setup(),p=await f.owner.prepare(f.call),payload=[...f.sql.rows.values()][0].payload;let resolve,queries=0,released=0,cancel=false;
 const pool={options:{connectionTimeoutMillis:100,query_timeout:100},connect:()=>new Promise(r=>{resolve=r;})};
 const store=createPostgresApprovalMetadataStore({pool}),pending=store.insert(payload,()=>{if(cancel)throw new Error('cancel');});cancel=true;resolve({query:async()=>{queries++;},release(){released++;}});
 await assert.rejects(pending,e=>e.outcome==='NOT_STORED');assert.equal(queries,0);assert.equal(released,1);assert(p.proposalId);
});
test('canonical native pool query bound 6000 is admitted without connecting',()=>{
 const f=createMetadataPoolFixture();f.pool.options.query_timeout=6000;assert.doesNotThrow(()=>createPostgresApprovalMetadataStore({pool:f.pool}));assert.deepEqual(f.calls,[]);
 f.pool.options.query_timeout=6001;assert.throws(()=>createPostgresApprovalMetadataStore({pool:f.pool}));
});
test('statement timeout preserves a caller pool bound shorter than local 5000 cap',async()=>{
 const f=setup();await f.owner.prepare(f.call);const query=f.sql.calls.find(x=>typeof x==='object');assert.equal(query.query_timeout,1000);
});
test('sanitizing a trusted-error class never invokes a hostile message accessor',async()=>{
 const {CommandError}=await import('../../protocol.mjs'),f=setup();let reads=0;
 const error=new CommandError('DEADLINE');Object.defineProperty(error,'message',{get(){reads++;return 'SECRET';}});
 const owner=createTaskCreateApprovalMetadataOwner({store:f.store,commandContext:f.commandContext,preparePolicy:async()=>{throw error;},now:()=>NOW});
 await assert.rejects(owner.prepare(f.call),e=>e.outcome==='NOT_STORED'&&!e.message.includes('SECRET'));assert.equal(reads,0);assert.equal(f.sql.calls.length,0);
});
