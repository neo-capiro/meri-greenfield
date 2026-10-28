/** Actual conversation owner, persisted request bytes, durable readback and execution context for the Work selector.
 * Real Fetch route, real service, real store over the scripted PostgreSQL protocol, process-local session owner.
 * No model call, provider, target, database or network fixture. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {allocatedApplicationFixture,applicationFixture,binding,id} from './application-fixture.mjs';
import {createPostgresConversationStore} from '../postgres-store.mjs';
import {MODEL_CATALOG} from '../../../../packages/contracts/test/model-selection-fixture.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {WORK_ENTRIES,WORK_JOB_KINDS,MAX_WORK_ITEMS} from '../../../../packages/contracts/work-selection.mjs';

const work=(entry,jobKind,over={})=>({entry,jobKind,deliverables:['brief'],dependencies:[],...over});
/** The same submission with the work member removed entirely (an inert-JSON body, not an undefined value). */
const withoutWork=({work:_dropped,...rest})=>rest;
const pairs=[];for(const entry of WORK_ENTRIES)for(const jobKind of WORK_JOB_KINDS)pairs.push({entry,jobKind});
/** The durable row the store actually inserted, addressed by the request identity the client submitted. */
const rowFor=(f,requestId)=>[...f.state.runs.values()].find(row=>row.request_id===requestId);

test('every canonical entry and job kind crosses the real submit route and is retained byte-exactly',async()=>{
 for(const {entry,jobKind} of pairs){const f=await allocatedApplicationFixture();try{
  const input={...f.input,work:work(entry,jobKind)};
  const response=await f.post('submit',input);assert.equal(response.status,200,`${entry}/${jobKind}`);
  const body=await response.json();assert.equal(body.replayed,false);assert.equal(body.requestId,input.requestId);
  assert.equal(f.state.starts,1);
  const stored=rowFor(f,input.requestId);assert.deepEqual(stored.request.work,input.work);
  assert.deepEqual(Object.keys(stored.request.work).sort(),['deliverables','dependencies','entry','jobKind']);
  assert.equal(stored.request_sha256,hash(stored.request));
  assert.deepEqual((await f.service.history({credential:f.credential})).request.work,input.work);
  const loaded=await f.service.loadForExecution({credential:f.credential,binding});
  assert.deepEqual(loaded.request.work,input.work);
  assert.equal(Object.hasOwn(loaded.request.work,'allowedTools'),false);
 }finally{f.close();}}
});

test('the persisted hash, exact replay and every changed work field under one request identity',async()=>{
 const f=await allocatedApplicationFixture();try{
  const input={...f.input,work:work('start-work','deliverable',{deliverables:['draft','final'],dependencies:['review']})};
  await f.service.allocateInput({credential:f.credential,input});
  const first=await f.service.submit({credential:f.credential,input});assert.equal(first.replayed,false);assert.equal(f.state.starts,1);
  const stored=rowFor(f,input.requestId);
  assert.equal(stored.request_sha256,hash(stored.request));
  // The work fields are inside the persisted bytes, not alongside them: dropping them changes the recorded hash.
  assert.notEqual(stored.request_sha256,hash({...stored.request,work:undefined}));
  assert.deepEqual(stored.request.work,input.work);
  const repeat=await f.service.submit({credential:f.credential,input});
  assert.equal(repeat.replayed,true);assert.deepEqual(rowFor(f,input.requestId).request.work,input.work);
  // An exact replay re-releases the same run identity; it never creates a second run or request row.
  assert.equal(f.state.starts,2);assert.equal(f.state.runs.size,1);
  for(const changed of [{...input,work:{...input.work,jobKind:'audit'}},{...input,work:{...input.work,entry:'delegate'}},
   {...input,work:{...input.work,deliverables:['final','draft']}},{...input,work:{...input.work,deliverables:['draft','final','extra']}},
   {...input,work:{...input.work,dependencies:[]}},{...input,work:{...input.work,deliverables:['Draft','final']}},withoutWork(input),f.input])
   await assert.rejects(f.service.submit({credential:f.credential,input:changed}),{code:'INITIAL_INPUT_CONFLICT'});
  // Every changed or removed work field is refused under the same request identity. On the canonical first-turn
  // path the whole original input is pinned, so the refusal is the allocation pin's INITIAL_INPUT_CONFLICT; the
  // retained-row REQUEST_REPLAY_REFUSED comparison of the same fields (service.mjs:107) guards the successor
  // fence, which the next-run suites own. The real route refuses it too and no second run appears.
  const refused=await f.post('submit',{...input,work:{...input.work,jobKind:'audit'}});
  assert.notEqual(refused.status,200);
  assert.equal(f.state.starts,2);assert.equal(f.state.runs.size,1);
 }finally{f.close();}
});

test('a restarted store instance reads the same retained work, history and execution context',async()=>{
 const f=await allocatedApplicationFixture();try{
  const input={...f.input,work:work('delegate','scheduled',{deliverables:['run-book'],dependencies:['gate']})};
  await f.service.allocateInput({credential:f.credential,input});await f.service.submit({credential:f.credential,input});
  const before=await f.service.history({credential:f.credential});
  const restarted=createPostgresConversationStore({pool:f.pool,modelCatalog:MODEL_CATALOG});
  const after=await restarted.read(binding,{after:0,limit:10},()=>{});
  assert.deepEqual(after.request,before.request);assert.deepEqual(after.run,before.run);
  assert.deepEqual(after.request.work,input.work);
  assert.deepEqual((await restarted.findRequest(binding,input.requestId,()=>{})).request.work,input.work);
  // The scheduled job kind is a label only: no occurrence, consent or hash-policy authority is invented anywhere.
  assert.deepEqual(Object.keys(after.request.work).sort(),['deliverables','dependencies','entry','jobKind']);
  for(const key of ['scheduledOrigin','consentId','hashPolicyRevision','approval','allowedTools'])assert.equal(Object.hasOwn(after.request.work,key),false);
  for(const key of ['scheduledOrigin','consentId','hashPolicyRevision'])assert.equal(Object.hasOwn(after.request,key),false);
  assert.equal(f.state.starts,1);
 }finally{f.close();}
});

test('malformed and authority-smuggling work is refused before any run row, dispatch or readback',async()=>{
 const f=await applicationFixture({initialInput:true});try{
  const smuggle=['scheduledOrigin','consentId','hashPolicyRevision','allowedTools','capabilities','depth','concurrency','budget','approval','tenantId','runId','clientId','skillId'];
  const malformed=[{entry:'start',jobKind:'research',deliverables:[],dependencies:[]},{entry:'start-work',jobKind:'review',deliverables:[],dependencies:[]},
   {entry:'start-work',jobKind:'research',deliverables:[''],dependencies:[]},{entry:'start-work',jobKind:'research',deliverables:[0],dependencies:[]},
   {entry:'start-work',jobKind:'research',deliverables:Array(MAX_WORK_ITEMS+1).fill('x'),dependencies:[]},
   {entry:'start-work',jobKind:'research',deliverables:['a','a'],dependencies:[]},{entry:'start-work',jobKind:'research',deliverables:'brief',dependencies:[]},
   {entry:'start-work',jobKind:'research',deliverables:[],dependencies:{}},{entry:'start-work',jobKind:'research',deliverables:[],dependencies:['']},
   {entry:'start-work',jobKind:'research',deliverables:['a']},{},{},[],'start-work',null,
   ...smuggle.map(key=>({entry:'start-work',jobKind:'research',deliverables:[],dependencies:[],[key]:'x'}))];
  for(const value of malformed){const input={...f.input,work:value};
   await assert.rejects(f.service.allocateInput({credential:f.credential,input}),{code:'INVALID_REQUEST'});
   await assert.rejects(f.service.submit({credential:f.credential,input}),{code:'INVALID_REQUEST'});}
  // Accessor and inherited members are never read: the selector is closed over own data properties only.
  let hits=0;const accessor=work('start-work','research');Object.defineProperty(accessor,'extra',{enumerable:true,get(){hits++;throw Error('private');}});
  await assert.rejects(f.service.allocateInput({credential:f.credential,input:{...f.input,work:accessor}}));assert.equal(hits,0);
  await assert.rejects(f.service.allocateInput({credential:f.credential,input:{...f.input,work:Object.create(work('start-work','research'))}}));
  const response=await f.post('submit',{...f.input,work:{...work('start-work','research'),allowedTools:['*']}});
  assert.equal(response.status,400);assert.equal((await response.json()).error.code,'INVALID_REQUEST');
  assert.equal(f.state.starts,0);assert.equal(f.state.runs.size,0);
  assert.equal(await f.store.findRequest(binding,f.input.requestId,()=>{}),null);
 }finally{f.close();}
});

test('ordinary, upload, procedure and report inputs keep their existing shape and gain no work member',async()=>{
 const uploadSource={async admit(){return {};},async read(){return {};}};
 const cases=[{name:'ordinary',options:{},extra:{}},
  {name:'uploads',options:{serviceOptions:{uploadInputSource:uploadSource}},extra:{uploads:[{uploadId:id(701),sha256:'a'.repeat(64)}]}},
  {name:'procedure',options:{},extra:{procedure:{source:'firm',recordId:id(700),version:2,manifestDigest:'a'.repeat(64)}}},
  {name:'report',options:{serviceOptions:{documentRevisionSource:async()=>({})}},extra:{documentRevision:{artifactId:id(800),versionId:id(801),objectSha256:'a'.repeat(64)}}}];
 for(const {name,options,extra} of cases){const f=await applicationFixture({initialInput:true,...options});try{
  const input={...f.input,...extra};await f.service.allocateInput({credential:f.credential,input});
  const result=await f.service.submit({credential:f.credential,input});
  assert.equal(result.replayed,false,name);
  const saved=await f.store.findRequest(binding,input.requestId,()=>{});
  assert.equal(Object.hasOwn(saved.request,'work'),false,`${name} gains no work member`);
  for(const [key,value] of Object.entries(extra))assert.deepEqual(saved.request[key],value,name);
  const page=await f.service.history({credential:f.credential});assert.deepEqual(page.request,saved.request);
  const loaded=await f.service.loadForExecution({credential:f.credential,binding});
  assert.equal(Object.hasOwn(loaded.request,'work'),false,name);
  for(const [key,value] of Object.entries(extra))assert.deepEqual(loaded.request[key],value,name);
  assert.equal(f.state.starts,1,name);
 }finally{f.close();}}
});
