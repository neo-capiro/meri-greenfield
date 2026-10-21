/** Product accounting SQL is an explicit scripted boundary, not a live database.
 * Real analysis/current-authority/budget owners run with synthetic sandbox ports. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {artifactValidators as v,resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createPostgresAnalysisExecutor} from '../postgres-analysis.mjs';
import {productFixture,NOW} from '../../gateway/budget/product-scripted-fixture.mjs';

function setup(){
 const db=productFixture(),operation={id:'run_analysis',version:'0.2.0'},entry=resolveOperationContract(operation).descriptor;
 const descriptor={operation,requiredGrants:entry.requiredGrants,sourceRequirements:entry.sourceRequirements};
 db.allocation.manifest.allowedOperations=[operation];db.allocation.manifest.requiredSources=descriptor.sourceRequirements;
 db.allocation.manifestSha256=v.hash(db.allocation.manifest);db.allocation.schedule.operations=[{operation,chargeMicrousd:10}];db.invocation.allocationSha256=v.hash(db.allocation);
 db.f.state.grants=[...descriptor.requiredGrants];
 const authorize=db.f.ports.authorizeBusiness;
 db.f.ports.authorizeBusiness=async(...args)=>{const row=JSON.parse(await authorize(...args));row.decision.operation='run_analysis@0.2.0';return JSON.stringify(row);};
 db.f.ports.authorizeSources=async()=>JSON.stringify({sourceIds:descriptor.sourceRequirements.map(source=>source.sourceId),enabled:true,policyRevision:db.f.claims.policyRevision,checkedAtMs:db.now()});
 const {invocationId:ignored,...grant}=db.invocation,binding=structuredClone(db.f.binding),scopes=structuredClone(db.f.claims.scopes);
 const context={binding,scopes,evidence:[],assets:[],deadlineMs:NOW+7000,maxBytes:1024,
  analysisAdmission:{receiptSha256:'2'.repeat(64),manifestSha256:'3'.repeat(64),imageDigest:'sha256:'+'4'.repeat(64)}};
 const object=digit=>({objectId:randomUUID(),versionId:'immutable-'+digit,sha256:digit.repeat(64),bytes:12,scopes});
 const call={deliveryId:'product-analysis',request:{operation:'run_analysis',format:'sandbox',title:'Bounded product analysis',content:{program:object('1'),inputs:[],outputs:['facts.json']}}};
 let dispatches=0;
 const options={pool:db.pool,allocationJson:JSON.stringify(db.allocation),producerContext:{context:grant,producer:db.producer},descriptor,context,validators:v,
  authority:db.f.authority,verifyAdmission:async({intentSha256,admission})=>({allowed:true,intentSha256,...admission,expiresAtMs:context.deadlineMs}),
  port:{async execute({intentSha256,admission}){dispatches++;return {intentSha256,admissionReceiptSha256:admission.receiptSha256,manifestSha256:admission.manifestSha256,imageDigest:admission.imageDigest,outputs:[{name:'facts.json',object:object('2')}]};}},
  now:db.now,newReservationId:randomUUID,limits:{maxRequestMs:9000,maxResponseBytes:65536},namespace:'product',sourceEnabled:true};
 return {db,call,options,dispatches:()=>dispatches};
}

test('general analysis product namespace reserves, settles and reconciles only the canonical product budget tables',async()=>{
 const x=setup(),owner=createPostgresAnalysisExecutor(x.options);assert.equal(x.db.commands.length,0);
 await owner.bindTrustedGrant(JSON.stringify(x.db.invocation));
 const result=await owner.execute(x.call,x.db.credential);
 assert.equal(result.inspectionStatus,'pending');assert.equal(result.publicationStatus,'pending');assert.equal(x.dispatches(),1);
 assert.equal(x.db.state().budget.consumed_micro_usd,'10');assert.equal(x.db.state().reservations.size,1);
 assert.equal([...x.db.state().reservations.values()][0].state,'SETTLED');
 assert.ok(x.db.commands.some(({sql})=>sql.startsWith('INSERT INTO meri_product_budget.tool_reservations')));
 assert.ok(x.db.commands.some(({sql})=>sql.startsWith('UPDATE meri_product_budget.budget SET consumed_micro_usd')));
 assert.equal(x.db.commands.some(({sql})=>sql.includes('meri_qualification.')),false);
 await assert.rejects(owner.execute(x.call,x.db.credential));assert.equal(x.dispatches(),1);
 const historical=await owner.reconcileInvocation(x.call);assert.equal(historical.stage,'SETTLED');assert.equal(historical.resultDelivered,false);
});

test('analysis namespace is a closed trusted choice and malformed names are refused before SQL',()=>{
 const x=setup();
 for(const namespace of ['meri_product_budget','other','product;DROP SCHEMA',null,{}])
  assert.throws(()=>createPostgresAnalysisExecutor({...x.options,namespace}),/ANALYSIS_BUDGET_CONFIGURATION/);
 assert.doesNotThrow(()=>createPostgresAnalysisExecutor({...x.options,namespace:undefined}));
 assert.doesNotThrow(()=>createPostgresAnalysisExecutor({...x.options,namespace:'qualification'}));
 assert.equal(x.db.commands.length,0);
});
