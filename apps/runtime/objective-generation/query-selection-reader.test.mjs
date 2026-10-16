/** Synthetic trusted-port receipts only. No proxy, issuer store, SQL, provider or credential file is opened. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createObjectiveQuerySelectionReader} from './query-selection-reader.mjs';

const id=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const sha=value=>createHash('sha256').update(value).digest('hex');
const NOW=Date.parse('2026-10-16T12:00:00Z');
function fixture(){
 const binding={tenantId:'synthetic-tenant',actorId:'synthetic-actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
 const acceptedRequest={requestId:id(5),prompt:'Synthetic first prompt'},sourceRequestSha256=hash(acceptedRequest);
 const proxyUrl='https://proxy.synthetic.invalid/',credential='SYNTHETIC_MODEL_ONLY_'+('a'.repeat(32)),capabilitySha256=sha(credential);
 const task={grantId:id(6),capabilitySha256:'b'.repeat(64),expiresAtMs:NOW+10000},model={grantId:id(7),capabilitySha256,expiresAtMs:task.expiresAtMs};
 const intent={issuanceKey:hash(binding),binding,requestSha256:sourceRequestSha256,expiresAtMs:task.expiresAtMs};
 const facts={original:{binding,executionKey:hash(binding),expiresAtMs:task.expiresAtMs},grantId:task.grantId,
  grantIntents:[task,model],objectiveGeneration:{sourceAdmission:{generationJobId:id(8)}},
  objectiveStrategy:{executionSelection:{provider:'bedrock',model:'meri-sonnet-qualification'}}};
 const entry={issuance:{...intent,grantId:task.grantId,capabilitySha256:task.capabilitySha256,factsSha256:hash(facts)},...facts,factsSha256:hash(facts)};
 const selected={...intent,grantId:model.grantId,capabilitySha256:model.capabilitySha256};
 const attestation={binding,grantId:model.grantId,capabilitySha256:model.capabilitySha256,proxyUrl,
  provider:'bedrock',model:'meri-sonnet-qualification',upstreamModelId:'bedrock/invoke/us.anthropic.claude-sonnet-4-6',
  configSha256:'c'.repeat(64),checkedAtMs:NOW,expiresAtMs:NOW+5000};
 const state={at:NOW,entry,selected,credential,attestation,factsReady:true,proxyReady:true,factReads:0,modelReads:0,resolves:0,attests:0,onAttest:null};
 const preparedFacts={available(){return state.factsReady;},async read(){state.factReads++;return structuredClone(state.entry);}};
 const modelIssuer={async read(){state.modelReads++;return {state:'ISSUED',issuance:structuredClone(state.selected)};},async resolve(){state.resolves++;return state.credential;}};
 const proxyAttestation={available(){return state.proxyReady;},async read(){state.attests++;state.onAttest?.();return structuredClone(state.attestation);}};
 const options={preparedFacts,modelIssuer,proxyAttestation,enabled:true,now:()=>state.at,maxRequestMs:1000};
 const query={binding,sourceRequestSha256,proxyUrl,proxyCredentialSha256:capabilitySha256};
 return {state,options,query,make:()=>createObjectiveQuerySelectionReader(options)};
}

test('query selection releases only current independently attested model and bounded receipt',async()=>{
 const f=fixture(),reader=f.make();assert.equal(reader.available(),true);
 const result=await reader.read(f.query);
 assert.deepEqual(Object.keys(result).sort(),['binding','sourceRequestSha256','proxyUrl','proxyCredentialSha256','provider','model','checkedAtMs','expiresAtMs'].sort());
 assert.equal(result.model,'meri-sonnet-qualification');assert.equal(result.expiresAtMs,NOW+5000);
 assert.equal(JSON.stringify(result).includes(f.state.credential),false);
 assert.equal(f.state.factReads,2);assert.equal(f.state.modelReads,2);assert.equal(f.state.resolves,2);assert.equal(f.state.attests,1);
});

test('disabled or absent trusted ports refuse without reading issuer, proxy or facts',async()=>{
 const f=fixture();for(const options of [{...f.options,enabled:false},{...f.options,proxyAttestation:undefined},{...f.options,modelIssuer:undefined},{...f.options,preparedFacts:undefined}]){
  const reader=createObjectiveQuerySelectionReader(options);assert.equal(reader.available(),false);await assert.rejects(reader.read(f.query));
 }
 assert.deepEqual([f.state.factReads,f.state.modelReads,f.state.resolves,f.state.attests],[0,0,0,0]);
});

test('prepared facts and product proxy readiness both gate reads before effects',async()=>{
 const f=fixture(),reader=f.make();
 f.state.factsReady=false;assert.equal(reader.available(),false);await assert.rejects(reader.read(f.query));
 f.state.factsReady=true;f.state.proxyReady=false;assert.equal(reader.available(),false);await assert.rejects(reader.read(f.query));
 assert.deepEqual([f.state.factReads,f.state.modelReads,f.state.resolves,f.state.attests],[0,0,0,0]);
 f.state.proxyReady=true;assert.equal(reader.available(),true);await reader.read(f.query);
 assert.deepEqual([f.state.factReads,f.state.modelReads,f.state.resolves,f.state.attests],[2,2,2,1]);
});
test('proxy readiness loss during attestation withholds the selection',async()=>{
 const f=fixture();f.state.onAttest=()=>{f.state.proxyReady=false;};
 await assert.rejects(f.make().read(f.query));assert.equal(f.state.attests,1);
});

for(const [name,change] of [
 ['source request substitution',f=>{f.query.sourceRequestSha256='d'.repeat(64);}],
 ['proxy URL substitution',f=>{f.query.proxyUrl='https://other.synthetic.invalid/';}],
 ['presented credential digest substitution',f=>{f.query.proxyCredentialSha256='d'.repeat(64);}],
 ['changed immutable facts hash',f=>{f.state.entry.objectiveStrategy.executionSelection.model='other';}],
 ['model grant substituted in issued facts',f=>{f.state.entry.grantIntents[1].grantId=id(99);}],
 ['model issuer uncertain',f=>{f.options.modelIssuer.read=async()=>({state:'UNKNOWN'});}],
 ['model issuer identity drift',f=>{f.state.selected.grantId=id(99);}],
 ['protected material revoked',f=>{f.options.modelIssuer.resolve=async()=>{throw Error('REVOKED');};}],
 ['protected credential differs',f=>{f.state.credential='DIFFERENT_SYNTHETIC_ONLY_'+('z'.repeat(32));}],
 ['proxy grant differs',f=>{f.state.attestation.grantId=id(99);}],
 ['proxy mapping differs',f=>{f.state.attestation.model='other-model';}],
 ['proxy upstream mapping absent',f=>{f.state.attestation.upstreamModelId='';}],
 ['proxy config digest malformed',f=>{f.state.attestation.configSha256='not-a-digest';}],
 ['proxy attestation stale',f=>{f.state.attestation.checkedAtMs=NOW-1;}],
 ['proxy attestation expired',f=>{f.state.attestation.expiresAtMs=NOW;}],
 ['facts changed after attestation',f=>{f.state.onAttest=()=>{f.state.entry.objectiveStrategy.executionSelection.model='other';f.state.entry.factsSha256=hash(Object.fromEntries(Object.entries(f.state.entry).filter(([k])=>!['issuance','factsSha256'].includes(k))));f.state.entry.issuance.factsSha256=f.state.entry.factsSha256;};}],
 ])test('query selection refuses '+name,async()=>{const f=fixture();change(f);await assert.rejects(f.make().read(f.query));});

test('cancelled and expired selection refuse before any trusted port',async()=>{
 const f=fixture(),aborted=new AbortController();aborted.abort();await assert.rejects(f.make().read({...f.query,signal:aborted.signal}));
 f.state.at=NOW+10000;await assert.rejects(f.make().read(f.query));assert.equal(f.state.modelReads,0);assert.equal(f.state.attests,0);
});
