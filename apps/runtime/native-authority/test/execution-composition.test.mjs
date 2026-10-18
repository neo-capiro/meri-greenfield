/** SYNTHETIC owners and a scripted product-budget pool under the ACTUAL execution composition: state gating, the executor
 * context, the deferred per-capability executor's pre-SQL refusals, the ACTIVE-grant requirement and the P-INT-9 mount. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {productFailure} from '../../../control/product-access/errors.mjs';
import {createCommandToolInterface} from '../../../control/commands/tool-interface.mjs';
import {createIntentExecutionOwner} from '../execution-composition.mjs';
import {productionToken,productionTrust,productionProposal,admittedSet,CASES,ISSUED_AT,RUN_BINDING,CLIENT} from './execution-capability-fixture.mjs';
const code=c=>e=>e?.code===c||productFailure(e)?.code===c;
function scriptedPool(allocationRow){
 const s={connects:0,statements:[]};
 const pool={options:{connectionTimeoutMillis:2000,query_timeout:5000},async connect(){s.connects++;return {async query(sql,params){s.statements.push(sql.split(/\s+/).slice(0,4).join(' '));
  if(sql.startsWith('BEGIN')||sql.startsWith('SET LOCAL')||sql==='COMMIT'||sql==='ROLLBACK')return {rows:[]};
  if(sql.startsWith('SELECT allocation,allocation_sha256 FROM meri_product_budget.tool_run_allocations'))return {rows:allocationRow?[structuredClone(allocationRow)]:[]};
  // No budget row: bindTrustedGrant's lock refuses; nothing here can create or activate a grant.
  if(sql.startsWith('SELECT'))return {rows:[]};
  throw Error('unexpected SQL '+sql);},release(){}};}};
 return {pool,s};
}
function owners({enabled=true,omit=[],allocation=true}={}){
 const set=admittedSet(),row={allocation:set.allocation,allocation_sha256:hash(set.allocation)},sql=scriptedPool(allocation?row:null),calls=[];
 const allocations={async read({binding,allocationKey}){calls.push(['allocations.read',allocationKey]);return {run:{},record:{state:'ADMITTED',binding,allocationSha256:hash(set.allocation),resource:{grantFactsJsons:set.grantFactsJsons}}};}};
 const all={trust:productionTrust(),core:{origin:'https://core.example.test',getCredentials:async()=>{calls.push(['core.getCredentials']);throw Error('not reached');}},allocations,pool:sql.pool,
  selectionFor:async({binding})=>{calls.push(['selectionFor',binding.runId]);return {reference:CLIENT,clientId:CLIENT};},
  preparePolicy:async()=>{calls.push(['preparePolicy']);throw Error('not reached');},authorizeBusiness:async()=>{throw Error('not reached');},authorizeSources:async()=>{throw Error('not reached');},
  currentRights:async()=>{throw Error('not reached');},source:{origin:'https://core.example.test',getServiceSecret:async()=>'service-secret'},sourceEnabled:true};
 for(const k of omit)delete all[k];
 const owner=createIntentExecutionOwner({enabled,...all,now:()=>ISSUED_AT*1000+1000,fetchImpl:async()=>{calls.push(['fetch']);throw Error('not reached');}});
 return {owner,sql,calls,set};
}
const approvals={approvalStore:{getCurrent:async()=>{throw Error('not reached');}},readDecision:async()=>{throw Error('not reached');}};
test('disabled and incomplete owners refuse every port before any effect, naming what is missing',async()=>{
 for(const [options,state] of [[{enabled:false},'disabled'],[{omit:['authorizeBusiness','currentRights']},'unavailable'],[{},'unavailable']]){
  const {owner,sql,calls}=owners(options),proposal=productionProposal(CASES.clientAndDueDate);
  assert.equal(owner.state(),state);
  await assert.rejects(owner.contextFor(proposal),code('EXECUTION_OWNER_UNAVAILABLE'));
  await assert.rejects(owner.commandOptionsFor({proposal}),code('EXECUTION_OWNER_UNAVAILABLE'));
  await assert.rejects(owner.issueExecution({proposal,principal:proposal.requiredApprover}),code('EXECUTION_OWNER_UNAVAILABLE'));
  await assert.rejects(owner.intentMountFor({binding:RUN_BINDING,original:{binding:RUN_BINDING}}),code('UNAVAILABLE'));
  assert.equal(sql.s.connects,0);assert.deepEqual(calls,[]);
 }
 const {owner}=owners({omit:['authorizeBusiness','currentRights']});owner.bindApprovals(approvals);
 assert.deepEqual(owner.missing(),['authorizeBusiness','currentRights']);assert.equal(owner.state(),'unavailable');
 assert.deepEqual(owners().owner.missing(),['approvals']);
 assert.ok(owners({omit:['sourceEnabled']}).owner.missing().includes('sourceEnabled'));
});
test('composed: the executor context is the proposal run with the run selection; approvals bind once',async()=>{
 const {owner,calls}=owners();owner.bindApprovals(approvals);assert.equal(owner.state(),'composed');
 assert.throws(()=>owner.bindApprovals(approvals),code('EXECUTION_CONFIGURATION'));
 const proposal=productionProposal(CASES.clientAndDueDate),context=await owner.contextFor(proposal);
 assert.deepEqual(context,{binding:RUN_BINDING,clientResolution:{reference:CLIENT,clientId:CLIENT}});
 const options=await owner.commandOptionsFor({proposal});createCommandToolInterface(options);
 assert.equal(options.action,'task.create');assert.deepEqual(options.operation,{id:'create_task',version:'0.2.0'});assert.deepEqual(options.commandContext,context);
 assert.deepEqual(calls.map(c=>c[0]),['selectionFor','selectionFor']);
});
test('the deferred executor refuses a token for another proposal or request before any SQL',async()=>{
 const {owner,sql}=owners();owner.bindApprovals(approvals);
 const t=productionToken('clientAndDueDate'),options=await owner.commandOptionsFor({proposal:t.proposal});
 const other=productionToken('clientAndDueDate',{proposal:productionProposal({...CASES.clientAndDueDate,title:'Another task'},{n:2})});
 await assert.rejects(options.executor.execute({proposal:t.proposal,execution:other.execution},other.credential),code('EXECUTION_CAPABILITY_MISMATCH'));
 await assert.rejects(options.executor.execute({proposal:t.proposal,execution:{...t.execution,requestId:'00000000-0000-4000-8000-000000000005'}},t.credential),code('EXECUTION_CAPABILITY_MISMATCH'));
 await assert.rejects(options.executor.execute({proposal:t.proposal,execution:t.execution},t.credential+'x'),code('EXECUTION_CAPABILITY_REFUSED'));
 assert.equal(sql.s.connects,0);
});
test('a matching token without an ACTIVE grant row never executes: bindTrustedGrant refuses and nothing is inserted',async()=>{
 const {owner,sql,calls}=owners();owner.bindApprovals(approvals);
 const t=productionToken('clientAndDueDate'),options=await owner.commandOptionsFor({proposal:t.proposal});
 await assert.rejects(options.executor.execute({proposal:t.proposal,execution:t.execution},t.credential),code('EXECUTION_GRANT_UNAVAILABLE'));
 assert.ok(sql.s.statements.some(x=>x.startsWith('SELECT allocation,allocation_sha256')));
 assert.equal(sql.s.statements.some(x=>/^(INSERT|UPDATE)/u.test(x)),false);assert.equal(calls.some(c=>c[0]==='fetch'),false);
});
test('P-INT-9 mount: prepare-only create_task for the exact admitted run; foreign or unadmitted runs are UNAVAILABLE',async()=>{
 const {owner}=owners();owner.bindApprovals(approvals);
 const mount=await owner.intentMountFor({binding:RUN_BINDING,original:{binding:RUN_BINDING}});
 // Availability needs the result-release authority only to exist; its current rights are checked on capture/release.
 const availability=await mount.readAvailability({});
 assert.deepEqual(availability.operations,[{id:'create_task',version:'0.2.0'}]);assert.deepEqual(availability.binding,RUN_BINDING);
 await assert.rejects(owner.intentMountFor({binding:RUN_BINDING,original:{binding:{...RUN_BINDING,writerFence:2}}}),code('UNAVAILABLE'));
 const missing=owners({allocation:false});missing.owner.bindApprovals(approvals);
 await assert.rejects(missing.owner.intentMountFor({binding:RUN_BINDING,original:{binding:RUN_BINDING}}),code('UNAVAILABLE'));
});
test('control-startup helper: one owner per control over the trusted context; disabled without an execution block, unavailable without Core owners',async()=>{
 const {createControlIntentExecution}=await import('../execution-composition.mjs');
 const {createProductPortsFactory,PRODUCT_FAMILIES}=await import('../../product-ports/index.mjs');
 const {captureRuntimePorts}=await import('../../product-applications.mjs');
 const gate={async admit(){throw Error('not used');},async recheck(){throw Error('not used');}};
 const t=productionTrust(),reads=[];
 const context=intents=>Object.freeze({configuration:{sourceEnabled:true,limits:{requestMs:5000,requestBytes:65536},native:{maxResponseBytes:262144},intents},
  pool:{options:{connectionTimeoutMillis:2000,query_timeout:5000},connect(){throw Error('no SQL');}},client:{},native:{call:async()=>{throw Error('no native');}},now:()=>ISSUED_AT*1000,
  canonicalProductPorts:captureRuntimePorts({conversationMembership:gate})});
 const run=intents=>{const helper=createControlIntentExecution({readSecret:async f=>{reads.push(f);return Buffer.from('secret');}}),ctx=context(intents);
  const ports=createProductPortsFactory({families:PRODUCT_FAMILIES.map(([n,f])=>[n,n==='intents'?helper.family:f])})(ctx);return {helper,ports,ctx};};
 const early=createControlIntentExecution({readSecret:async()=>Buffer.from('')});assert.equal(early.state(),'unbuilt');
 await assert.rejects(early.intentMountFor({binding:RUN_BINDING,original:{binding:RUN_BINDING}}),code('UNAVAILABLE'));
 const plain=run({enabled:true});assert.equal(plain.helper.state(),'disabled');assert.ok(plain.ports.intentApplication);
 const withBlock=run({enabled:true,execution:{coreOrigin:'https://core.example.test',issuer:t.issuer,keys:t.keys,serviceSecretFile:'/run/meri/core-service-secret'}});
 assert.equal(withBlock.helper.state(),'unavailable');assert.deepEqual(withBlock.helper.missing(),['core','preparePolicy','authorizeBusiness','authorizeSources','currentRights']);
 await assert.rejects(withBlock.helper.intentMountFor({binding:RUN_BINDING,original:{binding:RUN_BINDING}}),code('UNAVAILABLE'));
 assert.throws(()=>withBlock.helper.family(context({enabled:true})),code('EXECUTION_CONFIGURATION'));
 assert.deepEqual(reads,[],'no secret is read at composition');
});
