import test from 'node:test';import assert from 'node:assert/strict';
import {candidateFixture} from './prepared-candidate-fixture.mjs';
import {compilePreparedRunConfigurationSha256} from '../prepared-run-configuration.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const hashOf=configuration=>compilePreparedRunConfigurationSha256(configuration);
const rendered=(change)=>{const {configuration}=candidateFixture(),c=configuration.nativeCandidate,allocation=JSON.parse(c.allocationJson);change(c,allocation);c.allocationJson=JSON.stringify(allocation);return configuration;};

test('binding configuration identity survives a re-render of credentials and deadlines',()=>{
 const baseline=hashOf(candidateFixture().configuration);
 const rerendered=rendered((c,allocation)=>{
  // A later render mints new grants and re-stamps every deadline; keep the fixture's own ordering constraints.
  const later=c.runtime.deadlineMs-1000;
  allocation.schedule.expiresAt=new Date(later).toISOString();
  c.runtime.deadlineMs=later;
  const renamed=new Map(c.grantIntents.map((intent,i)=>[intent.grantId,id(910+i)]));
  c.grantId=renamed.get(c.grantId);
  c.grantIntents=c.grantIntents.map((intent,i)=>({...intent,grantId:renamed.get(intent.grantId),capabilitySha256:String(i+1).repeat(64),expiresAtMs:later}));
  assert.ok(c.grantId);
 });
 assert.equal(hashOf(rerendered),baseline);
});
test('binding configuration identity still follows the reviewed workload',()=>{
 const baseline=hashOf(candidateFixture().configuration);
 const changed=[
  ['schedule revision',(c,a)=>{a.schedule.revision='e'.repeat(64);}],
  ['schedule charge',(c,a)=>{a.schedule.operations=a.schedule.operations.map((o,i)=>i===0?{...o,chargeMicrousd:o.chargeMicrousd+1}:o);}],
 ];
 const seen=new Set([baseline]);
 for(const [label,change] of changed){const next=hashOf(rendered(change));assert.notEqual(next,baseline,label);assert.ok(!seen.has(next),label+' collides');seen.add(next);}
});
