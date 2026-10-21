/** Actual SDK MCP discovery → control intent mount → fixed artifact generator/storage.
 * Identity/current authority and SQL accounting are synthetic local fixtures; sandbox
 * pending references below are explicitly synthetic owner responses. No provider,
 * admitted sandbox execution, native Office render or production qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {artifactValidators as v} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createLocalDocumentFixture} from '../../../../control/document-application/local/fixture.mjs';
import {createPostgresArtifactService} from '../../../../artifacts/postgres-service.mjs';
import {createDocumentIntentPreparer} from '../../../../control/intents/document-preparer.mjs';
import {createAnalysisIntentPreparer} from '../../../../control/intents/analysis-preparer.mjs';
import {mount} from '../../../../control/intents/test/fixture.mjs';
import {mountIntents} from './fixture.mjs';

const python=process.env.MERI_DOCUMENT_PYTHON??'/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const pptxModulePath=process.env.MERI_PPTXGENJS??'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/pptxgenjs';
// Ordinary governed-intent eligibility, with neither a selected skill nor its plugin.
const policy={governedIntents:true,skillPlugin:false};
const DRAFT_NOTICE='PREPARED DRAFT: an immutable draft version was created for the user to review. Nothing else has been changed; filing or sharing it is a separate request.';
const PENDING_NOTICE='ANALYSIS OUTPUTS PENDING: the admitted analysis owner returned durable output references. Inspection and publication remain pending; do not say these outputs are published or filed.';
const pptx={operation:'create_powerpoint',format:'pptx',title:'SDK strategy draft',content:{slides:[{title:'Evidence',bullets:['Review the selected client evidence']} ]}};
const zip={operation:'run_analysis',format:'zip',title:'SDK analysis draft',content:{tables:[{name:'data',columns:['amount'],rows:[[2],[5]]}],source:'data',steps:[{kind:'derive',name:'projected',left:'amount',operator:'multiply',right:3}]}};
const operation=id=>({id,version:'0.2.0'});
const payload=response=>JSON.parse(response.content[0].text);

async function setup(t,id){
 const f=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable:python,operation:id,...(id==='create_powerpoint'?{pptxModulePath}:{})});
 t.after(async()=>{await f.close();assert.deepEqual(f.stats().cleanup,{executorDirectoriesAbsent:true,storeRemoved:true});});
 const {binding,scopes}=f.artifactOptions.context;
 const owner=createPostgresArtifactService(f.artifactOptions),writes={execute:(call,signal)=>owner.execute(call,f.credential,signal)};
 const preparer=id==='run_analysis'
  ?createAnalysisIntentPreparer({binding,descriptor:f.artifactOptions.descriptor,artifact:{context:f.artifactOptions.context,writes}})
  :createDocumentIntentPreparer({binding,descriptor:f.artifactOptions.descriptor,writes});
 const controlled=mount({binding,scopes,preparers:[preparer],now:f.now});
 return {f,binding,scopes,port:controlled.mount,now:f.now,deadlineMs:f.artifactOptions.context.deadlineMs};
}
function outputPort(x,id,result){
 return {async readAvailability(){const at=x.now();return {binding:x.binding,operations:[operation(id)],checkedAtMs:at,expiresAtMs:x.deadlineMs};},async prepare(){return structuredClone(result);}};
}
function withheld(response,tool){
 assert.equal(response.isError,true);assert.deepEqual(response.content,[{type:'text',text:`INVALID_RESULT: mcp__meri_intents__${tool} returned a result that was not a prepared proposal or draft, so it was withheld. Nothing has been applied.`}]);
}

for(const [id,tool,request,mime] of [
 ['create_powerpoint','request_document',pptx,'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
 ['run_analysis','request_analysis',zip,'application/zip'],
])test(`ordinary no-skill MCP discovers ${id}, prepares its canonical immutable draft and withholds foreign or applied output`,async t=>{
 const x=await setup(t,id),m=await mountIntents(x,{policy});let prepared;
 try{
  const {tools}=await m.client.listTools();assert.deepEqual(tools.map(t=>t.name),[tool]);
  assert.deepEqual(tools[0].inputSchema.properties.operation.enum,[id]);assert.equal(tools[0].annotations.readOnlyHint,false);
  assert.deepEqual([...m.runtime.sdkOptions.allowedTools],[`mcp__meri_intents__${tool}`]);
  const response=await m.call(tool,{operation:id,arguments:request});assert.equal(response.isError,undefined);prepared=payload(response);
  assert.equal(response.content[1].text,DRAFT_NOTICE);assert.equal(prepared.status,'draft');
  assert.equal(prepared.version.mimeType,mime);assert.equal(prepared.version.generationStatus,'draft');assert.equal(prepared.version.previewStatus,'pending');
  assert.deepEqual(prepared.version.binding,x.binding);assert.deepEqual(prepared.version.scopes,x.scopes);
  const bytes=await x.f.artifactOptions.objects.get(prepared.version.object);assert.equal(bytes.subarray(0,2).toString(),'PK');
  const stored=await x.f.artifactOptions.versions.read(prepared.version.versionId);assert.deepEqual(stored.version,prepared.version);
  assert.equal(stored.inspection.nativeOpened,false);assert.equal(stored.inspection.rendered,false);
  assert.equal(x.f.stats().generations,1);assert.equal(x.f.stats().versionCharges,1);
  const [receipt]=m.runtime.receipts();assert.equal(receipt.outcome,'prepared');assert.equal(receipt.status,'draft');assert.equal(receipt.reference,prepared.version.versionId);
 }finally{await m.close();}
 for(const [label,change] of [
  ['foreign client',v=>{v.version.scopes[0].resourceId=randomUUID();}],
  ['foreign user',v=>{v.version.binding.actorId=randomUUID();}],
  ['foreign tenant',v=>{v.version.binding.tenantId=randomUUID();}],
  ['applied generation',v=>{v.version.generationStatus='published';}],
 ])await t.test(label,async()=>{
  const invalid=structuredClone(prepared);change(invalid);const n=await mountIntents(x,{policy,port:outputPort(x,id,invalid)});
  try{withheld(await n.call(tool,{operation:id,arguments:request}),tool);assert.deepEqual(n.runtime.receipts(),[]);}
  finally{await n.close();}
 });
 assert.equal(x.f.stats().generations,1,'worker rejection never re-enters the artifact generator');
});

test('synthetic admitted-owner pending output keeps exact inspection/publication notice and cannot masquerade as a draft',async t=>{
 const x=await setup(t,'run_analysis');
 // Closed, schema-valid owner facts for the SDK status boundary only. These
 // references are never advertised as actual sandbox execution evidence.
 const admission={receiptSha256:'2'.repeat(64),manifestSha256:'3'.repeat(64),imageDigest:'sha256:'+'4'.repeat(64)};
 const context=v.context({...x.f.artifactOptions.context,deadlineMs:x.now()+5000,analysisAdmission:admission});
 const source={objectId:randomUUID(),versionId:'synthetic-program-v1',sha256:'6'.repeat(64),bytes:16,scopes:x.scopes};
 const args={operation:'run_analysis',format:'sandbox',title:'Synthetic admitted owner boundary',content:{program:source,inputs:[],outputs:['facts.json']}};
 const request={operation:'run_analysis',arguments:args};
 const pending={status:'analysis_pending',binding:x.binding,scopes:x.scopes,result:{
  intentSha256:v.hash({...args.content,binding:x.binding,scopes:x.scopes,deadlineMs:context.deadlineMs,maxBytes:context.maxBytes}),admissionReceiptSha256:'2'.repeat(64),manifestSha256:'3'.repeat(64),imageDigest:'sha256:'+'4'.repeat(64),
  outputs:[{name:'facts.json',object:{objectId:randomUUID(),versionId:'synthetic-immutable-v1',sha256:'5'.repeat(64),bytes:16,scopes:x.scopes}}],
  inspectionStatus:'pending',publicationStatus:'pending',
 }};
 pending.result=v.analysisResult(pending.result);v.assertArtifactOutput('run_analysis',pending.result,args,context);
 const m=await mountIntents(x,{policy,port:outputPort(x,'run_analysis',pending)});
 try{
  const response=await m.call('request_analysis',request);assert.equal(response.isError,undefined);assert.deepEqual(payload(response),pending);
  assert.equal(response.content[1].text,PENDING_NOTICE);assert.equal(response.content.length,2);
  assert.equal(Object.hasOwn(payload(response),'version'),false);assert.equal(Object.hasOwn(payload(response),'artifactId'),false);
  assert.equal(m.runtime.receipts()[0].status,'analysis_pending');assert.equal(m.runtime.receipts()[0].reference,pending.result.intentSha256);
 }finally{await m.close();}
 for(const [label,change] of [
  ['foreign current client',v=>{v.scopes=[{...v.scopes[0],resourceId:randomUUID()}];}],
  ['foreign output scope',v=>{v.result.outputs[0].object.scopes=[{...v.scopes[0],resourceId:randomUUID()}];}],
  ['foreign user',v=>{v.binding.actorId=randomUUID();}],
  ['published claim',v=>{v.result.publicationStatus='published';}],
  ['inspected claim',v=>{v.result.inspectionStatus='passed';}],
  ['fabricated artifact version',v=>{v.version={versionId:randomUUID()};}],
 ])await t.test(label,async()=>{
  const invalid=structuredClone(pending);change(invalid);const n=await mountIntents(x,{policy,port:outputPort(x,'run_analysis',invalid)});
  try{withheld(await n.call('request_analysis',request),'request_analysis');assert.deepEqual(n.runtime.receipts(),[]);}
  finally{await n.close();}
 });
 assert.equal(x.f.stats().generations,0);assert.equal(x.f.stats().versionCharges,0,'synthetic pending responses never enter the ZIP owner');
});
