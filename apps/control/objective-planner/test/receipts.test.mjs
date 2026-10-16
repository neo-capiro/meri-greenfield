// Synthetic source controls only; trusted Core identity, stored creation custody and SQL are not exercised.
import test from 'node:test';import assert from 'node:assert/strict';
import {work,workflowId,requestId,selection,materializationInput,hash} from '../identity.mjs';
import {strategyApplication,plannerObservation} from '../core-receipts.mjs';
import {fixture,id,clone,at} from './fixtures.mjs';
test('actual ObjectiveReceipt shape binds requested revision and actual saved StrategyVersion, not model completion',()=>{
 const f=fixture(),out=strategyApplication({receipt:f.receipt,status:'completed',canonical:f.canonical});assert.equal(out.strategyId,id(5));assert.equal(out.strategyVersionId,id(10));assert.equal(out.strategyReceiptSha256,hash(f.receipt));
 for(const receipt of [{state:'completed',result:{strategyId:id(5)}},{...f.receipt,result:null}])assert.throws(()=>strategyApplication({receipt,status:'completed',canonical:f.canonical}));
 for(const status of ['queued','running','failed'])assert.throws(()=>strategyApplication({receipt:f.receipt,status,canonical:f.canonical}));
});
for(const key of ['clientId','objectiveId','objectiveRevisionId','objectiveVersion'])test('Strategy source mismatch refuses: '+key,()=>{const f=fixture();f.receipt.source[key]=key==='objectiveVersion'?2:id(90);assert.throws(()=>strategyApplication({receipt:f.receipt,status:'completed',canonical:f.canonical}),/SOURCE_STALE/);});
for(const key of ['sourceDigest','coverageDigest','inputDigest','contextPacketId'])test('uncorrelated Strategy result refuses: '+key,()=>{const f=fixture();f.receipt.result[key]=key==='contextPacketId'?'other':'f'.repeat(64);assert.throws(()=>strategyApplication({receipt:f.receipt,status:'completed',canonical:f.canonical}),/INVALID_RECEIPT/);});
test('incomplete context, stale failure, provider envelopes and invalid timestamps refuse',()=>{
 for(const edit of [r=>r.context.state='incomplete',r=>r.context.issues.push({group:'context',code:'missing',message:'Missing'}),r=>r.failure={code:'FAILED',message:'failed'},r=>r.providerData={},r=>r.result.savedAt='tomorrow']){const f=fixture();edit(f.receipt);assert.throws(()=>strategyApplication({receipt:f.receipt,status:'completed',canonical:f.canonical}));}
});
test('canonical intent + original actor retain one request/workflow identity when job/version changes',()=>{
 const f=fixture(),changed={...f.work,generationJobId:id(99),strategyVersionId:id(98)};assert.equal(workflowId(f.work),workflowId(changed));assert.equal(f.work.plannerRequestId,changed.plannerRequestId);assert.notEqual(hash(f.work),hash(changed));
 const next=clone(f.work);next.canonical.requestedIntentId=id(97);next.plannerRequestId=requestId({canonical:next.canonical,actorId:next.actorId});assert.notEqual(workflowId(next),workflowId(f.work));
});
test('caller selection cannot supply actor, outputs, authority, credentials or a model result',()=>{
 const wanted={canonicalPlanId:id(1),requestedIntentId:id(7),generationJobId:id(11)};assert.deepEqual(selection(wanted),wanted);
 for(const extra of [{actorId:'other'},{canonical:{}},{grantId:id(50)},{result:{}},{credential:'synthetic'},{projectId:id(6)}])assert.throws(()=>selection({...wanted,...extra}));
});
test('noncanonical Strategy, changed effect ID and unsupported epoch refuse before effect selection',()=>{
 for(const edit of [w=>w.strategyId=id(99),w=>w.plannerRequestId=id(99),w=>w.canonical.epoch=2,w=>w.canonical.snapshotHash='broken',w=>w.actorId='']){const w=fixture().work;edit(w);assert.throws(()=>work(w));}
});
test('materializer input is exactly existing saved-version request with no model query, group cap or reservation alias',()=>{
 const f=fixture();assert.deepEqual(materializationInput(f.work),{requestId:f.work.plannerRequestId,generationJobId:id(11),expected:{strategyId:id(5),strategyVersionId:id(10),objectiveRevisionId:id(8)}});
 assert.notEqual(f.observation.projects[0].output.id,f.canonical.canonicalProjectId,'legacy output is not the reserved canonical project');
});
for(const key of ['generationJobId','generationRequestId','clientId','objectiveId','objectiveVersion','objectiveRevisionId','strategyId','strategyVersionId','snapshotDigest'])test('Planner observation pins actual source: '+key,()=>{const f=fixture();f.observation.source[key]=key==='objectiveVersion'?2:key==='snapshotDigest'?'f'.repeat(64):id(90);assert.throws(()=>plannerObservation(f.observation,f.work),/SOURCE_STALE/);});
test('current human edits, task regrouping and unavailable outputs are retained without recreation',()=>{
 const f=fixture(),original=hash(f.observation);f.observation.replayed=true;f.observation.observedAt=new Date(Date.parse(at)+1000).toISOString();f.observation.tasks[0].currentGroupKeys=['manual-shared-group'];f.observation.tasks[0].output.currentVersion=7;f.observation.tasks[1].output={availability:'unavailable',id:null,createdVersion:1,currentVersion:null};f.observation.status='partial';
 const out=plannerObservation(f.observation,f.work);assert.deepEqual(out,f.observation);assert.notEqual(hash(out),original,'current projection hash changes; never an immutable creation ACK');assert.equal(out.tasks[1].output.id,null);
});
test('closed nested observation rejects injected authority, duplicate outputs and inconsistent source counts',()=>{
 for(const edit of [r=>r.projects[0].credential='synthetic',r=>r.context[0].authority={},r=>r.tasks[1].output.id=r.tasks[0].output.id,r=>r.tasks[0].output.currentVersion=null,r=>r.counts.contextNodes=0,r=>r.edges[0].dependsOnSourceNodeId=id(99),r=>r.exclusions.push({sourceNodeId:id(20),reason:'ARCHIVED_SOURCE_NODE'}),r=>r.issues[0].payload={}]){const f=fixture();edit(f.observation);assert.throws(()=>plannerObservation(f.observation,f.work));}
});
test('context-only plan retains its issues and project without inventing actionable tasks',()=>{
 const f=fixture(),r=f.observation;r.tasks=[];r.edges=[];r.projects[0].originalNodeIds=[];r.issues=[{code:'NO_ACTIONABLE_WORK',sourceNodeIds:[],message:'Synthetic no work'}];r.counts={savedNodes:1,actionableNodes:0,contextNodes:1,archivedNodes:0,createdProjects:1,createdTasks:0};assert.deepEqual(plannerObservation(r,f.work),r);
});
