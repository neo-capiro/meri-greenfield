/** Reconciliation join and drift detection; the repository run asserts the recorded R2 counts. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {reconcile,loadInputs,run,parseArguments} from './reconcile.mjs';
const op=(id,extra={})=>({operation:{id,version:'0.2.0'},availability:'unimplemented',qualification:'pending',handler:null,sideEffect:'none',approvalBoundary:'none',sourceRequirements:[],aliases:[],requirementIds:['R-01'],ticketIds:['REL-02'],gateIds:['RG-01'],fixtureIds:[],replacement:null,...extra});
const ledger=(sheet,rows)=>({sheet,planSha256:'p',workbookSha256:'w',sourceCommit:'c',records:rows});
function synthetic(){
 const catalog={catalogId:'meri.retrieval',catalogVersion:'0.2.15',contractVersion:'0.2.0',sourceRegistryCommit:'x',originals:[{id:'cap_a',disposition:'selected',replacement:{id:'op_a',version:'0.2.0'},state:'mapped'},{id:'cap_b',disposition:'deferred',replacement:null,state:'deferred'}],operations:[op('op_a'),op('op_b',{handler:{sourceSha256:'h'},availability:'enabled',qualification:'qualified'})]};
 const r2={capabilities:ledger('Capabilities',[{row:1,fields:{ID:'cap_a',Category:'c'},acceptedScope:{disposition:'selected'},runtimeParity:'NOT_QUALIFIED',replacementOperation:null,replacementState:'s'},{row:2,fields:{ID:'cap_b'},acceptedScope:{disposition:'deferred'},runtimeParity:'NOT_QUALIFIED',replacementOperation:null,replacementState:'s'}]),
  skills:ledger('Current workflows',[{row:1,fields:{ID:'quick_skill.one',Category:'k'},integrationDisposition:'selected'}]),requirements:ledger('Tool contracts',[{row:1,fields:{'Requirement ID':'R-01',Contract:'x'},integrationState:'PENDING'}]),gates:ledger('Qualification',[{row:1,fields:{'Gate ID':'RG-01',Measure:'m'},integrationState:'PENDING'}]),tickets:ledger('Deployment work',[{row:1,fields:{'Ticket ID':'REL-02',Phase:'p'},integrationState:'PENDING'}]),'audit-findings':ledger('Routing audit',[{row:1,fields:{'Finding ID':'A-01',Finding:'f','Requirement IDs':'R-01','Ticket IDs':'REL-02'},integrationState:'PENDING'}])};
 const capabilitiesDoc={capabilities:[{name:'cap_a'},{name:'cap_b'}]};
 const skills=[{skillId:'quick_skill.one',skillVersion:'1.0.0'}];
 const manifests=[{skillId:'quick_skill.one',skillVersion:'1.0.0',manifestSha256:'m',manifest:{allowedOperations:[{id:'op_a',version:'0.2.0'},{id:'op_b',version:'0.2.0'}],requiredSources:[{sourceId:'mail'}]}}];
 const adapters=[{family:'mail',text:"const operations=['op_b'];"}];
 return {catalog,r2,capabilitiesDoc,skills,manifests,adapters};
}
test('agreeing synthetic ledgers and source produce no drift and exact counts',()=>{
 const r=reconcile(synthetic());
 assert.deepEqual(r.drift,[]);
 assert.equal(r.counts.capabilities.total,2);assert.equal(r.counts.capabilities.selectedWithReplacement,1);assert.equal(r.counts.capabilities.replacementBound,1);
 assert.equal(r.counts.operations.handlerBound,1);assert.equal(r.counts.operations.discoverable,1);assert.equal(r.counts.operations.withAdapterFamily,1);assert.equal(r.counts.operations.referencedBySkills,2);assert.equal(r.counts.operations.referencedByCapabilityReplacement,1);
 assert.equal(r.counts.skills.allowedOperationsInCatalog,2);assert.equal(r.counts.skills.allowedOperationsHandlerBound,1);
 assert.deepEqual(r.operations.find(o=>o.operation.id==='op_b').adapterFamilies,['mail']);
});
test('every drift class is detected and nothing is invented to hide it',()=>{
 const i=synthetic();
 i.catalog.originals[0].replacement={id:'op_missing',version:'0.2.0'};i.r2.capabilities.records[1].acceptedScope.disposition='selected';i.r2.capabilities.records.push({row:3,fields:{ID:'cap_ghost'},acceptedScope:{disposition:'selected'},runtimeParity:'NOT_QUALIFIED',replacementOperation:null,replacementState:'s'});
 i.manifests[0].manifest.allowedOperations.push({id:'op_absent',version:'0.2.0'});i.catalog.operations[0].requirementIds=['R-99'];i.r2['audit-findings'].records[0].fields['Ticket IDs']='REL-77';i.skills=[];
 const kinds=reconcile(i).drift.map(d=>d.kind);
 for(const k of ['capability-replacement-not-in-catalog','capability-disposition-mismatch','capability-missing-in-catalog-originals','skill-operation-not-in-catalog','operation-unknown-ledger-id','finding-unknown-ticket','skill-manifest-not-selectable'])assert.ok(kinds.includes(k),k);
});
test('repository run reproduces the recorded R2 counts and writes both outputs',async()=>{
 const root=new URL('../../../',import.meta.url).pathname,inputs=await loadInputs(root),r=reconcile(inputs);
 assert.equal(r.counts.capabilities.total,139);assert.equal(r.counts.capabilities.selected,96);assert.equal(r.counts.capabilities.deferred,43);assert.equal(r.counts.operations.total,97);assert.equal(r.counts.skills.manifests,14);assert.equal(r.counts.skills.ledgerRows,14);
 assert.equal(r.counts.ledgers.requirements.records,12);assert.equal(r.counts.ledgers.gates.records,12);assert.equal(r.counts.ledgers.tickets.records,9);assert.equal(r.counts.ledgers.findings.records,10);
 const out=mkdtempSync(join(tmpdir(),'meri-r2-reconciliation-'));await run({repo:root,out});
 assert.ok(existsSync(join(out,'RECONCILIATION.json'))&&existsSync(join(out,'REPORT.md')));
 assert.equal(JSON.parse(readFileSync(join(out,'RECONCILIATION.json'),'utf8')).counts.capabilities.total,139);
});
test('arguments refuse without --out and reject unknown flags',()=>{assert.throws(()=>parseArguments([]),/--out/u);assert.throws(()=>parseArguments(['--out','/x','--nope']),/unknown argument/u);assert.deepEqual(parseArguments(['--help']),{help:true});});
