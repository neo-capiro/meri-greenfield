import test from 'node:test';
import assert from 'node:assert/strict';
import {createConversationIdentity} from '../conversation-identity.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {binding,id,versions} from '../../control/conversations/test/application-fixture.mjs';

const at=Date.now(),clientId=id(5),conversationId=id(730),policyRevision='a'.repeat(64),configurationSha256='b'.repeat(64);
const dynamicBinding={...binding,conversationId,runId:id(731),attemptId:id(732),workerId:id(733)};
const principal={tenantId:binding.tenantId,actorId:binding.actorId};

function setup({factWindowMs=900000}={}){
 const state={record:null,claims:0,contexts:0,revoked:false,saved:null,selections:0,existingSelections:0,readError:null};
 const initialBindings={async rebind(){assert.fail('Live and started originals do not rebind');},async readConversation(){return state.record;},async claim(input){state.claims++;assert.equal(input.conversationId,conversationId);assert.equal(input.selectedClientId,clientId);state.record={schemaVersion:1,state:'ADMITTED',binding:dynamicBinding,selectedClientId:clientId,policyRevision,versions,configurationSha256,createdAtMs:at,expiresAtMs:input.proposedExpiresAtMs};return {record:state.record,created:true};}};
 const successor={...dynamicBinding,runId:id(734),attemptId:id(735),workerId:id(736),writerFence:2},scopes=[{kind:'client',tenantId:principal.tenantId,resourceId:clientId,policyRevision}];
 const identityContext=createConversationIdentity({store:{async readOptional(){if(state.readError)throw state.readError;return state.saved;}},identity:{origin:'https://authority.synthetic.invalid',async fetchImpl(url,options){if(state.revoked)return Response.json({error:'denied'},{status:403});const input=JSON.parse(options.body),base={principal,identityRevision:'native-1',checkedAtMs:at,expiresAtMs:at+1000};if(url.endsWith('/identity'))return Response.json(base);state.contexts++;return Response.json({...base,identitySha256:input.identitySha256,conversationId,selectedClientId:clientId,contextRevision:'native-context-1'});}},qualification:{policyRevision},now:()=>at,limits:{maxRequestMs:500,maxFactBytes:131072},nextRunOwner:{async selectExistingRun(input){state.existingSelections++;assert.equal(input.conversationId,conversationId);if(input.runId!==undefined&&input.runId!==successor.runId)throw Error('NEXT_RUN_NOT_LATEST');return {binding:successor,reserved:false};},async selectRun(){state.selections++;return {binding:successor};},async currentRun(request){assert.deepEqual(request,successor);return {binding:successor,policyRevision,scopes};}},initialBindings,configurationSha256,versions,proposeInitialExpiry(){return at+800;},...(factWindowMs===undefined?{}:{factWindowMs})});
 const resolve=async()=>{const identity=await identityContext.verifyIdentity({credential:'native-bearer',deadlineMs:at+500});return identityContext.resolveContext({identityCredential:'native-bearer',identity,identitySha256:canonicalSha256(identity),hints:{conversationId,clientId},deadlineMs:at+500});};
 const resolveBrowser=async(runId)=>{const identity=await identityContext.verifyIdentity({credential:'native-bearer',deadlineMs:at+500});return identityContext.resolveBrowserContext({identityCredential:'native-bearer',identity,identitySha256:canonicalSha256(identity),hints:{conversationId,clientId,...(runId?{runId}:{})},deadlineMs:at+500});};
 return {state,resolve,resolveBrowser,acceptOriginal(){state.saved={run:{binding:dynamicBinding,policyRevision,versions,scopes}};},successor};
}

test('verified Core conversation receives one durable original binding across session retries',async()=>{const f=setup(),first=await f.resolve(),second=await f.resolve();assert.deepEqual(first.binding,dynamicBinding);assert.deepEqual(second.binding,first.binding);assert.equal(f.state.claims,1);assert.equal(f.state.contexts,4);});
test('revoked Core context cannot read or claim the initial Meri binding',async()=>{const f=setup();f.state.revoked=true;await assert.rejects(f.resolve());assert.equal(f.state.claims,0);});
test('changed durable policy pin refuses replay without minting a second binding',async()=>{const f=setup();await f.resolve();f.state.record={...f.state.record,policyRevision:'changed'};await assert.rejects(f.resolve());assert.equal(f.state.claims,1);});
test('accepted original selects its current successor without minting a second original',async()=>{const f=setup();await f.resolve();f.acceptOriginal();const selected=await f.resolve();assert.deepEqual(selected.binding,f.successor);assert.equal(f.state.claims,1);assert.equal(f.state.selections,1);});

for(const code of ['STORE_CORRUPT','STORE_UNAVAILABLE','STORE_COMMIT_UNKNOWN'])test(`canonical ${code} never falls back to an original or a new claim`,async()=>{
 const f=setup();await f.resolve();f.acceptOriginal();f.state.readError=Object.assign(Error(code),{code});
 await assert.rejects(f.resolve());assert.equal(f.state.claims,1);assert.equal(f.state.selections,0);
});
for(const [name,change] of [
 ['binding',run=>run.binding={...run.binding,actorId:id(790)}],
 ['scopes',run=>run.scopes=[{...run.scopes[0],resourceId:id(791)}]],
 ['policy',run=>run.policyRevision='foreign-policy'],
 ['versions',run=>run.versions={...run.versions,sdk:'foreign-sdk'}],
])test(`corrupt accepted original ${name} cannot select a successor or mint another original`,async()=>{
 const f=setup();await f.resolve();f.acceptOriginal();f.state.saved=structuredClone(f.state.saved);change(f.state.saved.run);
 await assert.rejects(f.resolve());assert.equal(f.state.claims,1);assert.equal(f.state.selections,0);
});
// Session expiry follows durable run/Core validity, never this operation's request budget.
test('run facts bound the context expiry by run validity, not by the request budget',async()=>{
 const f=setup({factWindowMs:900000}),original=await f.resolve();assert.equal(original.expiresAtMs,at+800);   // durable binding expiry
 f.acceptOriginal();const selected=await f.resolve();assert.equal(selected.expiresAtMs,at+1000);              // Core receipt expiry
 assert.throws(()=>setup({factWindowMs:0}),/CONVERSATION_IDENTITY_REFUSED/);
});

test('browser context reads existing current selection without claiming, rebinding or reserving a turn',async()=>{
 const f=setup();await assert.rejects(f.resolveBrowser());assert.equal(f.state.claims,0);assert.equal(f.state.selections,0);
 await f.resolve();f.acceptOriginal();const current=await f.resolveBrowser(f.successor.runId);
 assert.deepEqual(current.binding,f.successor);assert.equal(f.state.existingSelections,1);assert.equal(f.state.selections,0);assert.equal(f.state.claims,1);
 await assert.rejects(f.resolveBrowser(dynamicBinding.runId));assert.equal(f.state.selections,0);
 f.state.revoked=true;const before=f.state.existingSelections;await assert.rejects(f.resolveBrowser());assert.equal(f.state.existingSelections,before);
});
