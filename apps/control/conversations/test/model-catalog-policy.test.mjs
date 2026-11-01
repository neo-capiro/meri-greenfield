/** The deployed first-chat model catalog (infra/product-preview/first-chat/policy.json) through the real conversation
 * service and store over scripted SQL: explicit selection of the served default, omitted selection inheriting the
 * conversation's admitted model, refusal of every unqualified row and effort, the immutable admitted selection through
 * reload and replay, and the per-run SDK limits the loaded configuration carries. No provider or database is involved. */
import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createConversationService} from '../service.mjs';
import {createPostgresConversationStore} from '../postgres-store.mjs';
import {initialInputFixture} from './initial-input-fixture.mjs';
import {binding,scopes,versions,id} from './store-fixture.mjs';
import {hash} from '../boundary.mjs';
import {resolveSdkModelConfiguration,SDK_USAGE_BASIS} from '../usage.mjs';
import {USER_PREFERENCE_DEFAULTS} from '../../../../packages/contracts/user-preferences-application/document.mjs';
import {productFailure} from '../../product-access/errors.mjs';
const policy=JSON.parse(await readFile(new URL('../../../../infra/product-preview/first-chat/policy.json',import.meta.url),'utf8')),catalog=policy.models;
const SONNET=catalog.defaultSelection,OPUS={provider:'bedrock',modelId:'us.anthropic.claude-opus-4-6',effort:null};
const intent={requestId:id(60),prompt:'Reply exactly: model selection two. Do not use tools or delegate.'};
function fixture(){
 const f=initialInputFixture(),state=Object.assign(f.state,{context:structuredClone({binding,scopes,selectedClientId:id(5)}),ttl:30000,starts:[]});let serial=200;
 const sessions={async authenticateSession(){return {principal:{tenantId:state.context.binding.tenantId,actorId:state.context.binding.actorId,conversationId:state.context.binding.conversationId,runId:state.context.binding.runId},checkedAtMs:f.now(),expiresAtMs:f.now()+state.ttl};},async readCurrentState({authentication}){return {authenticationSha256:hash(authentication),...structuredClone(state.context),checkedAtMs:f.now(),expiresAtMs:f.now()+state.ttl};}};
 const store=createPostgresConversationStore({pool:f.pool,modelCatalog:catalog,now:f.now}),service=createConversationService({sessions,store,versions,modelCatalog:catalog,now:f.now,newId:()=>id(serial++),dispatcher:{async start({binding}){state.starts.push(binding);},async cancel(){}}}),args=input=>({credential:'synthetic',input});
 return {...f,state,store,service,allocate:(i=intent)=>service.allocateInput(args(i)),admit:(i=intent)=>service.admitInput(args(i)),history:()=>service.history({credential:'synthetic'}),load:()=>service.loadForExecution({credential:'synthetic',binding}),
  setDefault:selection=>{const document={...USER_PREFERENCE_DEFAULTS,defaultModel:selection};state.userPreferences.set([binding.tenantId,binding.actorId].join(':'),{document,document_sha256:hash(document)});}};
}
const code=error=>productFailure(error)?.code??error?.code??error?.message;

test('M2: the explicit served selection is admitted exactly, including effort:null, and survives reload and replay unchanged',async()=>{
 const f=fixture(),input={...intent,modelSelection:SONNET};
 const allocated=await f.allocate(input);assert.deepEqual(allocated.allocation.modelSelection,SONNET);
 const admitted=await f.admit(input);assert.deepEqual(admitted.request.modelSelection,SONNET);
 assert.deepEqual((await f.history()).request.modelSelection,SONNET);
 f.setDefault(OPUS);// A later default change can never rewrite the admitted request.
 assert.deepEqual((await f.admit(input)).request.modelSelection,SONNET);assert.equal((await f.admit(input)).replayed,true);
 await assert.rejects(f.admit({...intent,modelSelection:{...SONNET,effort:'high'}}),error=>['INITIAL_INPUT_CONFLICT','MODEL_SELECTION_UNAVAILABLE','REQUEST_REPLAY_REFUSED'].includes(code(error)));
 assert.equal(f.state.runs.size,1);
});

test('M3: an omitted selection resolves from the actor default once and is pinned as explicit data in the admitted request',async()=>{
 const f=fixture();await f.allocate();const admitted=await f.admit();
 assert.deepEqual(admitted.request.modelSelection,SONNET,'the stored request is explicit even when the wire body omitted modelSelection');
 assert.deepEqual(await f.store.readModelSelection(binding,()=>{}),SONNET);
});

test('the loaded execution configuration forwards the admitted selection, the usage basis and the tenant per-run limits',async()=>{
 const f=fixture();await f.allocate();await f.admit();
 const loaded=await f.load();
 assert.deepEqual(loaded.model,resolveSdkModelConfiguration(SONNET,{maxTurns:20,maxBudgetMicroUsd:2000000,monthlyCapMicroUsd:100000000}));
 assert.equal(loaded.model.provider,'bedrock');assert.equal(loaded.model.model,SONNET.modelId);assert.equal(loaded.model.effort,null);assert.equal(loaded.model.region,'us-east-1');
 assert.equal(loaded.model.maxTurns,20);assert.equal(loaded.model.maxCostMicroUSD,2000000,'the SDK budget is the tenant per-run estimate cap in micro-USD');
 assert.deepEqual(loaded.model.usageBasis,SDK_USAGE_BASIS);assert.equal(loaded.model.usageBasis.priceRevision,'sdk-list-estimate-0.3.295','the cap is an SDK list-price estimate, never a provider bill');
});

for(const [name,modelSelection] of [
 ['the unqualified Opus row at its default effort',OPUS],
 ['the unqualified Opus row at an explicit effort',{...OPUS,effort:'max'}],
 ['an explicit Sonnet effort that is only pending',{...SONNET,effort:'high'}],
 ['an explicit Sonnet effort that is only pending (max)',{...SONNET,effort:'max'}],
 ['a Claude API row the catalog does not serve',{provider:'claude-api',modelId:'claude-sonnet-4-6',effort:null}],
 ['an invented model',{...SONNET,modelId:'us.anthropic.claude-invented'}],
])test(`M6: ${name} is refused before allocation, admission or dispatch`,async()=>{
 const f=fixture();
 await assert.rejects(f.allocate({...intent,modelSelection}),error=>code(error)==='MODEL_SELECTION_UNAVAILABLE');
 assert.equal(f.allocations.size,0);assert.equal(f.state.runs.size,0);assert.equal(f.state.starts.length,0);
 // A stored personal default that is no longer available refuses the omitted-selection path instead of silently falling back.
 f.setDefault(modelSelection);await assert.rejects(f.allocate(),error=>code(error)==='MODEL_SELECTION_UNAVAILABLE');
 assert.equal(f.allocations.size,0);
});

test('a Release flip of the Opus row admits it without any code change; the pending Sonnet efforts stay refused until merged into the served row',async()=>{
 const flipped=structuredClone(catalog);const opus=flipped.models.find(m=>m.modelId===OPUS.modelId);opus.available=true;opus.unavailableReason=null;
 const f=fixture(),store=createPostgresConversationStore({pool:f.pool,modelCatalog:flipped,now:f.now});let serial=300;
 const sessions={async authenticateSession(){return {principal:{tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,runId:binding.runId},checkedAtMs:f.now(),expiresAtMs:f.now()+30000};},async readCurrentState({authentication}){return {authenticationSha256:hash(authentication),...structuredClone(f.state.context),checkedAtMs:f.now(),expiresAtMs:f.now()+30000};}};
 const service=createConversationService({sessions,store,versions,modelCatalog:flipped,now:f.now,newId:()=>id(serial++),dispatcher:{async start(){},async cancel(){}}});
 await assert.rejects(service.allocateInput({credential:'synthetic',input:{...intent,modelSelection:{...SONNET,effort:'high'}}}),error=>code(error)==='MODEL_SELECTION_UNAVAILABLE');
 assert.equal(f.allocations.size,0,'a refused selection allocates nothing, so the run is still free for an admitted one');
 const selection={...OPUS,effort:'high'},input={...intent,modelSelection:selection};
 await service.allocateInput({credential:'synthetic',input});const admitted=await service.admitInput({credential:'synthetic',input});
 assert.deepEqual(admitted.request.modelSelection,selection);
 const loaded=await service.loadForExecution({credential:'synthetic',binding});assert.equal(loaded.model.model,OPUS.modelId);assert.equal(loaded.model.effort,'high');
});
