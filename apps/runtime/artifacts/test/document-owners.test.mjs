/** SYNTHETIC: the two Meri-local owners of the documents family (lane X): the `artifacts.executor` declaration and the run-options
 * owner (`../run-options.mjs`), composed by `composeDocumentsFamily` and driven through the REAL runtime document application over
 * control's real action-session owner, a scripted Core artifact authority (lane D's wire), scripted Core current-tool-authority
 * ports, a production-shaped admitted run on a scripted product-budget pool, and a synthetic S3 client. No network, AWS,
 * PostgreSQL, Python or real credential; nothing is generated (the scripted budget refuses before any generator runs). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createActionSessionOwner} from '../../../control/action-host/session/owner.mjs';
import {ARTIFACT_AUTHORITY_CONTRACT,ARTIFACT_AUTHORITY_ROUTE,INTENT_OPERATIONS} from '../core-authority-wire.mjs';
import {compileRuntimeArtifactsConfiguration} from '../configuration.mjs';
import {composeDocumentsFamily} from '../authority-composition.mjs';
import {createRuntimeDocumentRunOptions,DOCUMENTS_PRODUCER_NAMESPACE} from '../run-options.mjs';
import {createRuntimeArtifactApplication} from '../application.mjs';
import {bindDocumentsSessions} from '../session-binding.mjs';
import {captureRuntimePorts} from '../../product-applications.mjs';
import {record as storedRecord,sqlFixture} from '../../../artifacts/storage/test/sql-fixture.mjs';
import {publicationFixture} from '../../../artifacts/storage/test/publication-fixture.mjs';
import {createRuntimeDocumentOptionsComposer} from '../composition.mjs';
import {createLocalArtifactExecutor} from '../../../artifacts/local-executor.mjs';
import {createLocalPreviewStore} from '../../../artifacts/preview/local-store.mjs';
import {createRendererPort} from '../../../artifacts/renderer.mjs';
import {syntheticAdmission,syntheticOfficeConverter} from '../../../artifacts/test/pdf-fixtures.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ARTIFACT_MIME_TYPES,artifactFilename} from '../../../../packages/contracts/artifacts-0.2/artifact-formats.mjs';
import {executionGrantFixture} from '../../../gateway/budget/test/execution-grant-fixture.mjs';
import {admittedSet,ISSUED_AT,RUN_BINDING,BUDGETS,POLICY_REVISION,CLIENT} from '../../native-authority/test/execution-capability-fixture.mjs';
const code=c=>e=>{assert.equal(e?.code,c,`expected ${c}, got ${e?.code} (${e?.message})`);return true;};
const ORIGIN='https://core.synthetic.invalid',SECRET='synthetic-core-service-secret',BEARER='synthetic-native-bearer-1',CONTROL='synthetic-marked-control-credential';
/** Core's artifact receipt wire pins UUID-shaped principal ids (lane D); the production-shaped run binding is re-keyed to them. */
const BINDING=Object.freeze({...RUN_BINDING,tenantId:'00000000-0000-4000-8000-00000000a001',actorId:'00000000-0000-4000-8000-00000000a002'});
const START=ISSUED_AT*1000+1000,scopes=[{tenantId:BINDING.tenantId,kind:'client',resourceId:CLIENT,policyRevision:POLICY_REVISION}];
const rev=label=>hash({synthetic:label}),limits={maxRequestMs:5000,maxRequestBytes:131072,maxResponseBytes:1048576};
const files={identity:'/run/meri/identity-credential',task:'/run/meri/task-capability',control:'/run/meri/control-capability',proxy:'/run/meri/proxy-credential',secret:'/run/meri/core-tool-service-secret'};
const nativeCandidate={identity:{origin:ORIGIN,credentialFile:files.identity},taskCapabilityFile:files.task,controlCapabilityFile:files.control,proxyCredentialFile:files.proxy};
const kmsKeyId='arn:aws:kms:us-east-1:111122223333:key/00000000-0000-4000-8000-000000000001';
const executorBlock={pythonExecutable:'/usr/bin/python3',pptxModulePath:'/opt/meri/node_modules/pptxgenjs',tempRoot:'/tmp'};
const artifacts=(extra={})=>({enabled:true,region:'us-east-1',bucket:'synthetic-artifact-bucket',prefix:'meri-artifacts',expectedBucketOwner:'111122223333',kmsKeyId,authority:{origin:ORIGIN,serviceSecretFile:files.secret},...extra});
const control=(extra={})=>({nativeCandidate,limits:{requestMs:5000,requestBytes:131072},native:{maxResponseBytes:1048576},...extra});
/** The production-shaped admitted run (model + task grants) whose allocation allows and charges the document operations, and
 * the registry tuple the documents owner receives for it. */
function admittedRun(){
 const base=admittedSet({binding:BINDING}),operations=['create_word','create_excel'].map(id=>({id,version:'0.2.0'}));
 const budgets={...base.allocation.budgets,maxToolCalls:8},manifest={...base.allocation.manifest,budgets,allowedOperations:[...base.allocation.manifest.allowedOperations,...operations]};
 const allocation={...base.allocation,budgets,manifest,manifestSha256:hash(manifest),schedule:{...base.allocation.schedule,operations:[...base.allocation.schedule.operations,...operations.map(operation=>({operation,chargeMicrousd:2500}))]}};
 const facts=base.facts.map(x=>({...x,allocationSha256:hash(allocation)}));
 const set={allocation,allocationJson:JSON.stringify(allocation),facts,grantFactsJsons:facts.map(x=>JSON.stringify(x))};
 const f=executionGrantFixture({allocation:set.allocation,facts:set.facts,expiresAtMs:START+800000,clock:START}),task=set.facts[1];
 const tuple={pool:f.pool,binding:BINDING,original:{binding:BINDING,executionId:hash(BINDING),expiresAtMs:START+800000},allocationJson:set.allocationJson,grantFactsJsons:set.grantFactsJsons,grantId:task.grantId,taskCapability:'synthetic-task-capability',scopes};
 assert.equal(createHash('sha256').update(tuple.taskCapability).digest('hex'),task.capabilitySha256,'the fixture task grant is this capability');
 return {set,f,task,tuple};
}
/** Scripted Core current-tool-authority ports over the task capability (the decision-gated owners no production code supplies). */
function authorityPorts({credential,calls}){
 const claims={capabilityId:'1b2c3d4e-0000-4000-8000-00000000000b',issuer:'capiro-core:synthetic',audience:'meri-gateway',binding:BINDING,actions:['tool.read'],scopes,issuedAt:new Date(START-1000).toISOString(),expiresAt:new Date(START+600000).toISOString(),policyRevision:POLICY_REVISION,budgets:BUDGETS};
 return {
  async verifyCapability(presented){calls.push(['verifyCapability']);if(presented!==credential)throw Error('SYNTHETIC_CAPABILITY_REFUSED');return JSON.stringify(claims);},
  async authorizeBusiness({operation,requiredGrants}){calls.push(['authorizeBusiness',operation.id]);const decisionId=randomUUID();
   return JSON.stringify({decision:{decisionId,actor:{tenantId:BINDING.tenantId,actorId:BINDING.actorId},operation:`${operation.id}@${operation.version}`,scopes,policyRevision:POLICY_REVISION,evaluatedAt:new Date(START).toISOString(),decision:'allowed',reasonCode:'SYNTHETIC_DOCUMENT_ONLY'},
    subject:{kind:'client',entityType:'client',entityIds:[CLIENT],tenantId:BINDING.tenantId,actorId:BINDING.actorId,authorizationDecisionId:decisionId,policyRevision:POLICY_REVISION,scopes,rosterVersionId:null},grants:[...requiredGrants]});},
  async authorizeSources({sourceRequirements}){calls.push(['authorizeSources']);return JSON.stringify({sourceIds:sourceRequirements.map(s=>s.sourceId),enabled:true,policyRevision:POLICY_REVISION,checkedAtMs:START});},
 };
}
function secretFiles(){const bytes={[files.identity]:CONTROL,[files.task]:'synthetic-task-capability',[files.control]:'synthetic-control-capability',[files.proxy]:'synthetic-proxy-credential',[files.secret]:SECRET};
 return {bytes,async readSecret(path){if(!Object.hasOwn(bytes,path))throw Object.assign(Error('RUNTIME_SECRET_FILE'),{code:'RUNTIME_SECRET_FILE'});return Buffer.from(bytes[path]+'\n');}};}
/** Scripted Core artifact receiver (lane D's wire) answering the session's principal, conversation and client. */
function scriptedCore(now){
 const core={calls:[],status:200,operations:['artifact.download','artifact.generate','artifact.inspect','artifact.preview-publish','artifact.revise']};
 core.fetch=async(url,init)=>{const request=JSON.parse(init.body);core.calls.push({url,request});assert.equal(url,ORIGIN+ARTIFACT_AUTHORITY_ROUTE);
  if(init.headers['x-internal-service-secret']!==SECRET||init.headers.authorization!=='Bearer '+BEARER)return Response.json({message:'refused'},{status:401});
  if(core.status!==200)return Response.json({message:'unavailable'},{status:core.status});
  const checkedAtMs=now();
  return Response.json({contract:ARTIFACT_AUTHORITY_CONTRACT,observationId:request.observationId,principal:{tenantId:BINDING.tenantId,actorId:BINDING.actorId},identityRevision:rev('identity'),conversationId:request.conversationId,
   selectedClientId:request.clientId,contextRevision:rev('context'),intent:request.intent,requestSha256:request.requestSha256,operations:core.operations,limits:null,authorityRevision:rev('authority'),checkedAtMs,expiresAtMs:checkedAtMs+60000});};
 return core;
}
/** Control's real process-local action-session owner: the session binds to the admitted run and its single client scope. */
async function liveSession(now){
 const stamp=()=>({checkedAtMs:now(),expiresAtMs:now()+120000});
 const sessions=createActionSessionOwner({mode:'process-local',now,limits:{maxSessions:8,maxRequestMs:3000,maxTtlMs:120000,maxFactBytes:65536},
  async verifyIdentity({credential}){if(credential!==BEARER)throw Error('SYNTHETIC_IDENTITY_REFUSED');return {principal:{tenantId:BINDING.tenantId,actorId:BINDING.actorId},identityRevision:'synthetic-identity-1',...stamp()};},
  async resolveContext({identity,identitySha256}){if(identitySha256!==hash(identity))throw Error('SYNTHETIC');return {identitySha256,binding:structuredClone(BINDING),scopes:structuredClone(scopes),selectedClientId:CLIENT,contextRevision:'synthetic-context-1',...stamp()};}});
 return {sessions,credential:(await sessions.issue({identityCredential:BEARER})).credential};
}
const createBody=operation=>({deliveryId:'synthetic-delivery-'+operation,request:{operation,format:operation==='create_excel'?'xlsx':'txt',title:'Synthetic',content:operation==='create_excel'?{sheets:[{name:'Data',rows:[[{value:'A'}]]}]}:{text:'Synthetic document body'}}});
function retainedDocument(operation,versionId){
 const r=storedRecord(12),spec=createBody(operation).request;
 r.version.versionId=versionId;r.version.binding=structuredClone(BINDING);r.version.scopes=structuredClone(scopes);r.version.object.scopes=structuredClone(scopes);
 r.spec=spec;r.specSha256=hash(spec);r.version.mimeType=ARTIFACT_MIME_TYPES[spec.format];r.version.filename=artifactFilename(spec);
 return r;
}

test('configuration: the closed artifacts.executor block names image paths only (absolute POSIX, no traversal, bounded timeout) and composes nothing by itself',()=>{
 const base={...control({artifacts:artifacts({executor:executorBlock})})};
 const a=compileRuntimeArtifactsConfiguration(base);
 assert.deepEqual(a.executor,executorBlock);assert.ok(Object.isFrozen(a.executor));
 assert.deepEqual(compileRuntimeArtifactsConfiguration(control({artifacts:artifacts({executor:{...executorBlock,nodeExecutable:'/usr/local/bin/node',timeoutMs:60000}})})).executor,{...executorBlock,nodeExecutable:'/usr/local/bin/node',timeoutMs:60000});
 for(const [label,executor] of Object.entries({noPython:{pptxModulePath:executorBlock.pptxModulePath,tempRoot:'/tmp'},relative:{...executorBlock,tempRoot:'tmp'},traversal:{...executorBlock,pythonExecutable:'/usr/../bin/python3'},doubleSlash:{...executorBlock,pptxModulePath:'/opt//pptx'},
  timeoutZero:{...executorBlock,timeoutMs:0},timeoutHigh:{...executorBlock,timeoutMs:60001},extra:{...executorBlock,renderer:'/x'},notObject:'/usr/bin/python3'}))
  assert.throws(()=>compileRuntimeArtifactsConfiguration(control({artifacts:artifacts({executor})})),code('ARTIFACT_CONFIGURATION'),label);
 assert.equal(compileRuntimeArtifactsConfiguration(control({artifacts:artifacts()})).executor,undefined);
});

test('run-options owner: unavailable without Core authority ports; registers the registry tuple exactly; answers the closed run facts per intent; releases',async()=>{
 const bare=createRuntimeDocumentRunOptions({now:()=>START,limits:{maxRequestMs:1000,maxFactBytes:65536}});
 assert.equal(bare.state(),'unavailable');assert.deepEqual(bare.missing(),['authorityPorts']);
 const {set,f,task,tuple}=admittedRun(),calls=[];
 const ports=authorityPorts({credential:tuple.taskCapability,calls});
 const owner=createRuntimeDocumentRunOptions({now:()=>START,limits:{maxRequestMs:1000,maxFactBytes:65536},authorityPorts:ports});
 assert.equal(owner.state(),'composed');assert.deepEqual(owner.missing(),[]);
 const call=(intent,body,extra={})=>({binding:BINDING,scopes,selectedClientId:CLIENT,intent,body,requestSha256:hash({intent,body}),authority:{operations:INTENT_OPERATIONS[intent],limits:null,expiresAtMs:START+60000},deadlineMs:START+5000,...extra});
 assert.equal(await owner.read(call('create',createBody('create_word'))),null,'no registered run');
 assert.equal(await bare.read(call('create',createBody('create_word'))),null);
 // Registration validates the tuple like the general-reads task tuple: the task grant, its capability, the run scopes and the pool.
 for(const [label,change] of Object.entries({otherGrant:t=>{t.grantId=set.facts[0].grantId;},foreignCapability:t=>{t.taskCapability='other';},foreignScope:t=>{t.scopes=[{...scopes[0],policyRevision:'c'.repeat(64)}];},twoClients:t=>{t.scopes=[scopes[0],{...scopes[0],resourceId:'00000000-0000-4000-8000-00000000d002'}];},
  noPool:t=>{t.pool={};},expired:t=>{t.original={...t.original,expiresAtMs:START};},otherOriginal:t=>{t.original={...t.original,binding:{...BINDING,writerFence:2}};},extra:t=>{t.extra=1;}})){
  const t={...tuple};change(t);assert.throws(()=>owner.register(t),code('ARTIFACT_RUN_OPTIONS_REFUSED'),label);
 }
 const handle=owner.register(tuple);assert.equal(owner.size(),1);
 const retainedId='00000000-0000-4000-8000-00000000f001';
 owner.bindVersionReader({pool:tuple.pool,versions:{async read(id){assert.equal(id,retainedId);return retainedDocument('create_word',id);}}});
 assert.equal(owner.register({...tuple}),handle,'idempotent for the same run facts');
 assert.throws(()=>owner.register({...tuple,original:{...tuple.original,executionId:'other'}}),code('ARTIFACT_RUN_OPTIONS_CONFLICT'));
 // Null (503 UNAVAILABLE) for another run, other scopes, another selected client, an unknown intent or an aborted request.
 assert.equal(await owner.read(call('create',createBody('create_word'),{binding:{...BINDING,writerFence:2}})),null);
 assert.equal(await owner.read(call('create',createBody('create_word'),{scopes:[{...scopes[0],policyRevision:'c'.repeat(64)}]})),null);
 assert.equal(await owner.read(call('create',createBody('create_word'),{selectedClientId:'00000000-0000-4000-8000-00000000d002'})),null);
 assert.equal(await owner.read(call('delete',createBody('create_word'))),null);
 const aborted=new AbortController();aborted.abort();assert.equal(await owner.read(call('create',createBody('create_word'),{signal:aborted.signal})),null);
 await assert.rejects(owner.read({...call('create',createBody('create_word')),extra:1}),code('ACCESS_DENIED'));
 // The closed shape, per intent: the admitted allocation, the task grant as producer context, the operation's descriptor.
 const expectedDescriptor=id=>{const d=set.allocation.manifest;return {operation:{id,version:'0.2.0'}};};
 for(const [intent,body,operation] of [['create',createBody('create_word'),'create_word'],['create',createBody('create_excel'),'create_excel'],['revise',{...createBody('create_excel'),baseVersionId:'00000000-0000-4000-8000-00000000f001'},'create_excel'],
  ['inspect',{versionId:'00000000-0000-4000-8000-00000000f001'},'create_word'],['download',{versionId:'00000000-0000-4000-8000-00000000f001'},'create_word'],['create',{deliveryId:'x',request:{operation:'create_powerpoint'}},'create_powerpoint']]){
  const r=await owner.read(call(intent,body));
  assert.deepEqual(Object.keys(r).sort(),['allocationJson','assets','authority','credential','descriptor','evidence','maxBytes','producerContext','sourceEnabled']);
  assert.equal(r.allocationJson,set.allocationJson);assert.deepEqual(r.producerContext,{context:task,producer:{namespace:DOCUMENTS_PRODUCER_NAMESPACE,executionId:hash(BINDING)}});
  assert.deepEqual(r.descriptor.operation,expectedDescriptor(operation).operation,`${intent} ${operation}`);assert.deepEqual(Object.keys(r.descriptor).sort(),['operation','requiredGrants','sourceRequirements']);
  assert.deepEqual([r.evidence,r.assets,r.maxBytes,r.credential,r.sourceEnabled],[[],[],262144,tuple.taskCapability,true]);assert.equal(typeof r.authority.check,'function');
 }
 // authority.check is the gateway's current tool authority over the task capability: Core's ports plus currentRun on the admitted run.
 const r=await owner.read(call('create',createBody('create_word'))),before=f.commands.length;calls.length=0;
 const checked=await r.authority.check({credential:tuple.taskCapability,descriptor:r.descriptor,input:{synthetic:true},limitDeadline:()=>{}});
 assert.equal(checked.decision.decision,'allowed');assert.equal(checked.decision.operation,'create_word@0.2.0');assert.deepEqual(checked.binding,BINDING);assert.equal(checked.policyRevision,POLICY_REVISION);
 assert.ok(checked.deadlineMs>START&&checked.deadlineMs<=START+600000);
 assert.deepEqual(calls,[['verifyCapability'],['authorizeBusiness','create_word'],['authorizeSources']]);
 assert.ok(f.commands.slice(before).some(c=>c.sql.startsWith('SELECT * FROM meri_product_budget.budget')),'currentRun read the admitted run through the product budget');
 await assert.rejects(r.authority.check({credential:'other',descriptor:r.descriptor,input:{},limitDeadline:()=>{}}),e=>e?.message==='ACCESS_DENIED'||e?.code==='ACCESS_DENIED');
 f.state().budget.quarantined=true;await assert.rejects(r.authority.check({credential:tuple.taskCapability,descriptor:r.descriptor,input:{},limitDeadline:()=>{}}),e=>e?.message==='ACCESS_DENIED'||e?.code==='ACCESS_DENIED');f.state().budget.quarantined=false;
 handle.release();assert.equal(owner.size(),0);assert.equal(await owner.read(call('create',createBody('create_word'))),null,'released');
 for(const bad of [{authorityPorts:{verifyCapability(){}}},{limits:{maxRequestMs:0,maxFactBytes:1}},{now:1}])
  assert.throws(()=>createRuntimeDocumentRunOptions({now:()=>START,limits:{maxRequestMs:1000,maxFactBytes:65536},...bad}),code('ARTIFACT_RUN_OPTIONS_CONFIGURATION'));
});

test('run-options read family follows the retained version for Excel and Word, with no caller-supplied operation',async()=>{
 const {tuple}=admittedRun(),owner=createRuntimeDocumentRunOptions({now:()=>START,limits:{maxRequestMs:1000,maxFactBytes:65536},authorityPorts:authorityPorts({credential:tuple.taskCapability,calls:[]})});
 const excelId='00000000-0000-4000-8000-00000000f101',wordId='00000000-0000-4000-8000-00000000f102';
 const records=new Map([[excelId,retainedDocument('create_excel',excelId)],[wordId,retainedDocument('create_word',wordId)]]),reads=[];let refusal=null,park=null;
 const versions={async read(id,signal){reads.push([id,signal]);if(refusal)throw Object.assign(Error(refusal),{code:refusal});if(park)await park.enter();return structuredClone(records.get(id));}};
 owner.bindVersionReader({pool:tuple.pool,versions});const handle=owner.register(tuple);
 const call=(intent,body,extra={})=>({binding:BINDING,scopes,selectedClientId:CLIENT,intent,body,requestSha256:hash({intent,body}),authority:{operations:INTENT_OPERATIONS[intent],limits:null,expiresAtMs:START+60000},deadlineMs:START+5000,...extra});
 for(const intent of ['inspect','download','preview','preview-publish'])for(const [id,expected] of [[excelId,'create_excel'],[wordId,'create_word']]){
  const result=await owner.read(call(intent,{versionId:id}));assert.equal(result?.descriptor.operation.id,expected,`${intent} ${expected}`);
 }
 assert.equal(reads.length,8);
 assert.equal((await owner.read(call('inspect',{versionId:wordId,request:{operation:'create_excel'}}))).descriptor.operation.id,'create_word','a forged operation field cannot override the retained family; the HTTP body is rejected downstream');
 const foreign=retainedDocument('create_excel',excelId);foreign.version.binding.conversationId='00000000-0000-4000-8000-00000000f999';records.set(excelId,foreign);
 assert.equal(await owner.read(call('inspect',{versionId:excelId})),null,'another conversation cannot select a family');
 const otherActor=retainedDocument('create_excel',excelId);otherActor.version.binding.actorId='00000000-0000-4000-8000-00000000f997';records.set(excelId,otherActor);
 assert.equal(await owner.read(call('inspect',{versionId:excelId})),null,'another actor cannot select a family');
 const otherScope=retainedDocument('create_excel',excelId);otherScope.version.scopes[0].resourceId='00000000-0000-4000-8000-00000000f998';records.set(excelId,otherScope);
 assert.equal(await owner.read(call('inspect',{versionId:excelId})),null,'another selected client cannot select a family');
 const tampered=retainedDocument('create_excel',excelId);tampered.specSha256='f'.repeat(64);records.set(excelId,tampered);
 assert.equal(await owner.read(call('download',{versionId:excelId})),null,'a mismatched retained spec cannot select a family');
 const wrongMime=retainedDocument('create_excel',excelId);wrongMime.version.mimeType=ARTIFACT_MIME_TYPES.txt;records.set(excelId,wrongMime);
 assert.equal(await owner.read(call('inspect',{versionId:excelId})),null,'the immutable operation and MIME must agree');
 records.set(excelId,retainedDocument('create_excel',excelId));
 for(const code of ['RETENTION_SUPPRESSED','ARTIFACT_PUBLICATION_UNAVAILABLE']){refusal=code;
  assert.equal(await owner.read(call('download',{versionId:excelId})),null,`${code} cannot be bypassed for family selection`);}
 refusal=null;
 const aborted=new AbortController();aborted.abort();const before=reads.length;
 assert.equal(await owner.read(call('download',{versionId:wordId},{signal:aborted.signal})),null);assert.equal(reads.length,before);
 let entered,continueRead;const atReader=new Promise(resolve=>{entered=resolve;}),resumeReader=new Promise(resolve=>{continueRead=resolve;});
 park={enter:async()=>{entered();await resumeReader;}};
 const pending=owner.read(call('inspect',{versionId:wordId}));await atReader;handle.release();continueRead();
 assert.equal(await pending,null,'release during canonical lookup cannot return stale run options');
});

test('run-options reader can recompose on one pool before registration, but cannot switch custody during an active run',()=>{
 const {tuple}=admittedRun(),owner=createRuntimeDocumentRunOptions({now:()=>START,limits:{maxRequestMs:1000,maxFactBytes:65536},authorityPorts:authorityPorts({credential:tuple.taskCapability,calls:[]})});
 const first={read:async()=>{}},second={read:async()=>{}};
 owner.bindVersionReader({pool:tuple.pool,versions:first});owner.bindVersionReader({pool:tuple.pool,versions:first});
 owner.bindVersionReader({pool:tuple.pool,versions:second});
 const handle=owner.register(tuple);
 assert.throws(()=>owner.bindVersionReader({pool:tuple.pool,versions:first}),code('ARTIFACT_RUN_OPTIONS_CONFLICT'));
 handle.release();owner.bindVersionReader({pool:tuple.pool,versions:first});
});

test('retained Word and Excel traverse Core authority, canonical publication/retention and runtime HTTP for inspect, download and preview',{timeout:30000},async t=>{
 const root=await mkdtemp(join(tmpdir(),'meri-read-family-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const now=Date.now,live=await liveSession(now);t.after(()=>live.sessions.revoke(live.credential));
 const db=sqlFixture(),publication=publicationFixture(BINDING.tenantId,now);
 const versions=db.create({now,tenantId:BINDING.tenantId,publication:publication.publication,maxRequestMs:1000});
 const previews=await createLocalPreviewStore({root:join(root,'previews'),canonicalSha256:hash});t.after(()=>previews.dispose());
 const executor=createLocalArtifactExecutor({pythonExecutable:process.env.MERI_DOCUMENT_PYTHON??'/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3',nodeExecutable:process.execPath,pptxModulePath:join(root,'unused-presentation-module'),tempRoot:root});
 const objectsById=new Map(),objects={async put({objectId,bytes,scopes:objectScopes}){const copy=Buffer.from(bytes),sha256=createHash('sha256').update(copy).digest('hex');objectsById.set(objectId,copy);return {objectId,versionId:'synthetic-native-'+objectId,sha256,bytes:copy.length,scopes:objectScopes};},async get(object){return Buffer.from(objectsById.get(object.objectId));}};
 const specs=[{operation:'create_word',format:'docx',title:'Retained brief',content:{blocks:[{kind:'paragraph',runs:[{text:'Retained Word content'}]}]}},createBody('create_excel').request],records=[];
 for(const spec of specs){
  const generated=await executor.execute({request:spec,assets:[],deadlineMs:now()+20000,maxBytes:262144}),versionId=randomUUID(),r=retainedDocument(spec.operation,versionId);
  r.spec=spec;r.specSha256=hash(spec);r.requestSha256=hash({spec,versionId});r.inspection=generated.inspection;
  r.version.artifactId=randomUUID();r.version.object=await objects.put({objectId:randomUUID(),bytes:generated.bytes,scopes:structuredClone(scopes)});
  r.version.mimeType=ARTIFACT_MIME_TYPES[spec.format];r.version.filename=artifactFilename(spec);
  await versions.commit({...r,expectedParentVersionId:null});records.push({record:r,bytes:generated.bytes});
 }
 const {tuple}=admittedRun(),core=scriptedCore(now),secrets=secretFiles(),composed=await composeDocumentsFamily({configuration:control({artifacts:artifacts()}),now,readSecret:secrets.readSecret,fetchImpl:core.fetch,executor,authorityPorts:authorityPorts({credential:tuple.taskCapability,calls:[]})});
 composed.runOptions.bindVersionReader({pool:db.pool,versions});const registered=composed.runOptions.register({...tuple,pool:db.pool,original:{...tuple.original,expiresAtMs:now()+60000}});t.after(()=>registered.release());
 const renderer=createRendererPort({admission:syntheticAdmission(),transformer:syntheticOfficeConverter()});
 const compose=createRuntimeDocumentOptionsComposer({storage:{versions,objects},executor,budgetPool:db.pool,sessions:live.sessions,now,previews,renderer,namespace:'product'});
 const owner={async resolve(call){const trusted=await composed.authority.resolve({...call,sessions:live.sessions});if(trusted===null)return null;const {recheck,...options}=trusted;return {documentOptions:compose(options),recheck};}};
 const app=createRuntimeArtifactApplication({sessions:live.sessions,optionsOwner:owner,now,limits,retention:db.retention});
 const send=(intent,body)=>app.handle(new Request('https://control.synthetic.invalid/api/documents/'+intent,{method:'POST',headers:{authorization:'Bearer '+live.credential,'content-type':'application/json'},body:JSON.stringify(body)}));
 for(const {record:r,bytes}of records){
  const body={versionId:r.version.versionId},inspection=await send('inspect',body),read=await inspection.json();assert.equal(inspection.status,200,JSON.stringify(read));assert.equal(read.inspection.currentBytesVerified,true);assert.equal(read.version.mimeType,r.version.mimeType);
  const downloaded=await send('download',body);assert.equal(downloaded.status,200);assert.equal(downloaded.headers.get('content-type'),r.version.mimeType);assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),bytes);
  const published=await send('preview-publish',body),receipt=await published.json();assert.equal(published.status,200,JSON.stringify(receipt));assert.equal(receipt.preview.versionId,r.version.versionId);
  const preview=await send('preview',body);assert.equal(preview.status,200);assert.equal(preview.headers.get('content-type'),'application/pdf');assert.equal(Buffer.from(await preview.arrayBuffer()).subarray(0,5).toString(),'%PDF-');
 }
 const excel=records[1].record,selected={versionId:excel.version.versionId};
 const readsBefore=db.events.length;assert.equal((await send('inspect',{...selected,request:{operation:'create_word'}})).status,400);assert.equal(db.events.length,readsBefore,'malformed body performs no retained metadata lookup');
 db.suppressed.add(`${BINDING.tenantId}:artifact:${excel.version.artifactId}`);assert.notEqual((await send('download',selected)).status,200);db.suppressed.clear();
 publication.state.deny=true;assert.notEqual((await send('inspect',selected)).status,200);publication.state.deny=false;
 const persisted=db.state.versions.get(excel.version.versionId),original=persisted.record;persisted.record=structuredClone(original);persisted.record.version.binding.conversationId=randomUUID();persisted.record_sha256=hash(persisted.record);
 assert.notEqual((await send('download',selected)).status,200,'cross-conversation retained metadata releases neither a family nor bytes');Object.assign(db.state.versions.get(excel.version.versionId),{record:original,record_sha256:hash(original)});
 assert.equal((await send('download',selected)).status,200,'restoring valid custody restores ordinary readback');
});

test('startup composition composes both Meri-local owners from the declaration and the Core authority ports, naming each gap by key; nothing spawns, reads or connects',async()=>{
 const s=secretFiles(),fetches=[],fetchImpl=async()=>{fetches.push(1);throw Error('not reached');},ports=authorityPorts({credential:'x',calls:[]}),now=()=>START;
 const missing=async(configuration,extra={})=>(await composeDocumentsFamily({configuration,readSecret:s.readSecret,fetchImpl,...extra})).missing;
 assert.deepEqual(await missing(control({artifacts:artifacts()})),['runOptions.authorityPorts','artifacts.executor'],'the production registration today');
 assert.deepEqual(await missing(control({artifacts:artifacts({executor:executorBlock})})),['runOptions.authorityPorts']);
 assert.deepEqual(await missing(control({artifacts:artifacts()}),{authorityPorts:ports}),['artifacts.executor']);
 assert.deepEqual(await missing(control({artifacts:artifacts({executor:executorBlock})}),{authorityPorts:ports,executor:{execute(){}}}),[],'a supplied executor wins over the declaration');
 const composed=await composeDocumentsFamily({configuration:control({artifacts:artifacts({executor:executorBlock})}),readSecret:s.readSecret,fetchImpl,authorityPorts:ports,now});
 assert.deepEqual(composed.missing,[]);assert.equal(composed.authority.origin,ORIGIN);assert.equal(typeof composed.runOptions.register,'function');assert.equal(composed.runOptions.state(),'composed');
 assert.equal(fetches.length,0,'no network at composition');
 const supplied=await composeDocumentsFamily({configuration:control({artifacts:artifacts()}),readSecret:s.readSecret,fetchImpl,runOptions:{read(){}},executor:{execute(){}}});
 assert.deepEqual(supplied.missing,[]);assert.equal(supplied.runOptions,null,'startup-supplied owners are not re-composed');
 await assert.rejects(composeDocumentsFamily({configuration:control({artifacts:artifacts()}),readSecret:s.readSecret,authorityPorts:{verifyCapability(){}}}),code('ARTIFACT_AUTHORITY_CONFIGURATION'));
 await assert.rejects(composeDocumentsFamily({configuration:control({artifacts:artifacts({executor:{...executorBlock,timeoutMs:0}})}),readSecret:s.readSecret}),code('ARTIFACT_AUTHORITY_CONFIGURATION'));
 // The composed family constructs the pinned S3 client without any request and never touches the pool at construction.
 const sharedPool=Object.freeze({connect:()=>assert.fail('no SQL')}),familyContext=()=>Object.freeze({configuration:{...control({artifacts:artifacts({executor:executorBlock})}),sessions:{maxSessions:10,maxTtlMs:30000},versions:{}},pool:sharedPool,now});
 const realFamily=composed.family(familyContext());
 assert.deepEqual(Object.keys(realFamily.ports),['artifactStore','artifactOptionsOwner']);
 const recomposed=composed.family(familyContext());
 assert.notEqual(realFamily.ports.artifactStore.versions,recomposed.ports.artifactStore.versions,'distinct trusted contexts may recompose the canonical reader on one pool before any run is registered');
});

test('through the real documents app: create reaches the run budget and generator; reads fail closed when retained publication custody is unavailable',async()=>{
 const now=()=>START,s=secretFiles(),core=scriptedCore(now),live=await liveSession(now),{f,tuple}=admittedRun(),calls=[],generated=[];
 const ports=authorityPorts({credential:tuple.taskCapability,calls}),executor={async execute(value){generated.push(value);throw Error('not reached');}};
 const configuration={...control({artifacts:artifacts()}),sessions:{maxSessions:10,maxTtlMs:30000},versions:{}};
 const mount=async(options)=>{const composed=await composeDocumentsFamily({configuration,readSecret:s.readSecret,fetchImpl:core.fetch,now,...options});
  const context=Object.freeze({configuration,pool:f.pool,now}),family=composed.family(context);
  if(family.ports.artifactOptionsOwner)assert.equal(bindDocumentsSessions(context,live.sessions),true);
  const app=createRuntimeArtifactApplication({sessions:live.sessions,now,limits,optionsOwner:captureRuntimePorts(family.ports).artifactOptionsOwner});
  return {composed,family,send:(intent,body)=>app.handle(new Request('https://control.synthetic.invalid/api/documents/'+intent,{method:'POST',headers:{authorization:'Bearer '+live.credential,'content-type':'application/json'},body:JSON.stringify(body)}))};};
 const unavailable=async(label,options)=>{const m=await mount(options);assert.equal(Object.keys(m.family.ports).includes('artifactOptionsOwner'),false,label);
  const response=await m.send('create',createBody('create_word'));assert.equal(response.status,503,label);assert.deepEqual(await response.json(),{error:{code:'UNAVAILABLE',outcome:'NOT_DISPATCHED'}});};
 await unavailable('no owners',{});await unavailable('executor only',{executor});await unavailable('run options only',{authorityPorts:ports});
 assert.equal(core.calls.length,0,'nothing reached Core without the owners');
 const m=await mount({authorityPorts:ports,executor});assert.deepEqual(m.composed.missing,[]);
 // Registered run absent: Core is observed, the run owner answers null, the application answers 503 and nothing else runs.
 let response=await m.send('create',createBody('create_word'));assert.equal(response.status,503,'unregistered run');assert.deepEqual(await response.json(),{error:{code:'UNAVAILABLE',outcome:'NOT_DISPATCHED'}});
 assert.equal(core.calls.length,1);assert.deepEqual(calls,[]);
 const handle=m.composed.runOptions.register(tuple);
 const closed=async(intent,body,expectedOperation)=>{core.calls.length=0;calls.length=0;generated.length=0;const before=f.commands.length,reservations=f.state().reservations.size;
  const response=await m.send(intent,body),json=await response.json();
  assert.notEqual(response.status,200,intent);assert.equal(typeof json.error?.code,'string');
  if(['inspect','download'].includes(intent)){
   assert.equal(response.status,503,`${intent}: unretained versions are unavailable before descriptor selection`);
   assert.equal(core.calls.length,1,`${intent}: Core observed the caller before the canonical version lookup`);
  }else{
   assert.notEqual(response.status,503,`${intent}: the owners were present (${JSON.stringify(json)})`);
   assert.ok(core.calls.length>=2,`${intent}: Core observed at resolve and admission (${core.calls.length})`);
  }
  assert.ok(core.calls.every(c=>c.request.intent===intent&&c.request.clientId===CLIENT));
  if(['create','revise'].includes(intent)&&body.baseVersionId===undefined){
   assert.ok(f.commands.slice(before).some(c=>c.sql.startsWith('SELECT * FROM meri_product_budget.budget')),`${intent}: the admitted run was read through the product budget (${JSON.stringify(json)}; authority calls ${JSON.stringify(calls)})`);
   // The gateway authority (Core ports + currentRun on the admitted run) decided, a reservation was taken on the run's own
   // allocation for the task grant, and only then the generator ran (the fake refuses, so the outcome is closed, never 200).
   assert.deepEqual(calls.slice(0,3),[['verifyCapability'],['authorizeBusiness',expectedOperation],['authorizeSources']],`${intent}: ${JSON.stringify(json)} calls ${JSON.stringify(calls)} statements ${JSON.stringify(f.statements().slice(before))}`);
   assert.equal(f.state().reservations.size,reservations+1,`${intent}: one reservation on the run allocation (${JSON.stringify(json)}; calls ${JSON.stringify(calls)}; generated ${generated.length}; statements ${JSON.stringify(f.statements().slice(before).filter(x=>!/^(BEGIN|SET|COMMIT|ROLLBACK|SELECT clock)/.test(x)))})`);
   const reservation=[...f.state().reservations.values()].pop();assert.equal(reservation.grant_id,tuple.grantId);assert.equal(reservation.run_id,BINDING.runId);assert.deepEqual(reservation.operation,{id:expectedOperation,version:'0.2.0'});
   assert.equal(generated.length,1,`${intent}: the generator ran once, after the reservation`);assert.equal(generated[0].request.operation,expectedOperation);
   assert.equal(reservation.state,'UNKNOWN','the refused generation leaves the reservation UNKNOWN (never refunded here)');
   // Stand in for the budget recovery that reconciles an UNKNOWN reservation; one UNKNOWN per grant blocks the next reservation.
   Object.assign(reservation,{state:'SETTLED',charged_micro_usd:reservation.hold_micro_usd,output_bytes:'0',settled_at:new Date(START)});
  }else{
   // A revision reaches the real S3/PG versions owner after Core admission. Reads resolve their family through the same
   // publication/retention owner, which refuses without custody. Neither path reserves or generates.
   assert.equal(generated.length,0,`${intent}: nothing is generated for a read or a revision whose base cannot be read`);assert.equal(f.state().reservations.size,reservations,`${intent}: no reservation`);
   assert.equal(f.statements().slice(before).some(x=>/^(INSERT|UPDATE)/u.test(x)),false,`${intent}: no budget effect`);
  }
  return json;};
 await closed('create',createBody('create_word'),'create_word');
 await closed('create',createBody('create_excel'),'create_excel');
 await closed('revise',{...createBody('create_excel'),baseVersionId:'00000000-0000-4000-8000-00000000f001'},'create_excel');
 await closed('inspect',{versionId:'00000000-0000-4000-8000-00000000f001'},'create_word');
 await closed('download',{versionId:'00000000-0000-4000-8000-00000000f001'},'create_word');
 // Core refusing at admission stops everything before the run owner's authority is consulted.
 core.status=403;core.calls.length=0;calls.length=0;response=await m.send('create',createBody('create_word'));assert.equal(response.status,403);assert.deepEqual(calls,[]);core.status=200;
 handle.release();response=await m.send('create',createBody('create_word'));assert.equal(response.status,503,'released run: unavailable again');
 live.sessions.revoke(live.credential);
});
