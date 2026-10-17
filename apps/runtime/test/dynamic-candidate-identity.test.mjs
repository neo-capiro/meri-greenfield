import test from 'node:test';
import assert from 'node:assert/strict';
import {createPreparedCandidateIdentity} from '../prepared-candidate.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {binding,id,versions} from '../../control/conversations/test/application-fixture.mjs';

const at=Date.now(),clientId=id(5),conversationId=id(730),policyRevision='a'.repeat(64),configurationSha256='b'.repeat(64);
const dynamicBinding={...binding,conversationId,runId:id(731),attemptId:id(732),workerId:id(733)};
const principal={tenantId:binding.tenantId,actorId:binding.actorId};

function setup({factWindowMs}={}){
 const state={record:null,claims:0,contexts:0,revoked:false,saved:null,selections:0};
 const initialBindings={async readConversation(){return state.record;},async claim(input){state.claims++;assert.equal(input.conversationId,conversationId);assert.equal(input.selectedClientId,clientId);state.record={schemaVersion:1,state:'ADMITTED',binding:dynamicBinding,selectedClientId:clientId,policyRevision,versions,configurationSha256,createdAtMs:at,expiresAtMs:input.proposedExpiresAtMs};return {record:state.record,created:true};}};
 const successor={...dynamicBinding,runId:id(734),attemptId:id(735),workerId:id(736),writerFence:2},scopes=[{kind:'client',tenantId:principal.tenantId,resourceId:clientId,policyRevision}];
 const identityContext=createPreparedCandidateIdentity({store:{async readOptional(){return state.saved;}},identity:{origin:'https://authority.synthetic.invalid',commandContext:{binding,clientResolution:{reference:clientId,clientId}},async fetchImpl(url,options){if(state.revoked)return Response.json({error:'denied'},{status:403});const input=JSON.parse(options.body),base={principal,identityRevision:'native-1',checkedAtMs:at,expiresAtMs:at+1000};if(url.endsWith('/identity'))return Response.json(base);state.contexts++;return Response.json({...base,identitySha256:input.identitySha256,conversationId,selectedClientId:clientId,contextRevision:'native-context-1'});}},qualification:{policyRevision},now:()=>at,limits:{maxRequestMs:500,maxFactBytes:131072},nextRunOwner:{async selectRun(){state.selections++;return {binding:successor};},async currentRun(request){assert.deepEqual(request,successor);return {binding:successor,policyRevision,scopes};}},initialBindings,configurationSha256,versions,proposeInitialExpiry(){return at+800;},...(factWindowMs===undefined?{}:{factWindowMs})});
 const resolve=async()=>{const identity=await identityContext.verifyIdentity({credential:'native-bearer',deadlineMs:at+500});return identityContext.resolveContext({identityCredential:'native-bearer',identity,identitySha256:canonicalSha256(identity),hints:{conversationId,clientId},deadlineMs:at+500});};
 return {state,resolve,acceptOriginal(){state.saved={run:{binding:dynamicBinding,policyRevision,versions,scopes}};},successor};
}

test('verified Core conversation receives one durable original binding across session retries',async()=>{const f=setup(),first=await f.resolve(),second=await f.resolve();assert.deepEqual(first.binding,dynamicBinding);assert.deepEqual(second.binding,first.binding);assert.equal(f.state.claims,1);assert.equal(f.state.contexts,4);});
test('revoked Core context cannot read or claim the initial Meri binding',async()=>{const f=setup();f.state.revoked=true;await assert.rejects(f.resolve());assert.equal(f.state.claims,0);});
test('changed durable policy pin refuses replay without minting a second binding',async()=>{const f=setup();await f.resolve();f.state.record={...f.state.record,policyRevision:'changed'};await assert.rejects(f.resolve());assert.equal(f.state.claims,1);});
test('accepted original selects its current successor without minting a second original',async()=>{const f=setup();await f.resolve();f.acceptOriginal();const selected=await f.resolve();assert.deepEqual(selected.binding,f.successor);assert.equal(f.state.claims,1);assert.equal(f.state.selections,1);});
// The context expiry becomes the action-session lifetime. Run facts must carry the run's validity (the durable binding's
// expiry, else the run window), never this call's request budget, which expired every live session ~3s after issue.
test('run facts bound the context expiry by run validity, not by the request budget',async()=>{
 const clipped=await setup().resolve();assert.equal(clipped.expiresAtMs,at+500);           // legacy static profile: request budget
 const f=setup({factWindowMs:900000}),original=await f.resolve();assert.equal(original.expiresAtMs,at+800);   // durable binding expiry
 f.acceptOriginal();const selected=await f.resolve();assert.equal(selected.expiresAtMs,at+1000);              // Core receipt expiry
 assert.throws(()=>setup({factWindowMs:0}),/PREPARED_CANDIDATE_REFUSED/);
});
