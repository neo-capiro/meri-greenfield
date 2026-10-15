/** R2: the canonical retention read gate in the artifact service and its recovery path. Unchanged when not suppressed; the
 * conversation the caller is bound to and the artifact a trusted scoped record resolves are both gated before object bytes are read
 * and again before release; inspect, download, revise, create and durable recovery refuse under suppression, barrier closure or an
 * unreadable journal with no object read or execution; another artifact's or tenant's suppression is irrelevant. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';import addFormats from 'ajv-formats';
import {canonicalSha256 as hash,validateShape as validatePublicShape} from '../../../packages/contracts/validate.mjs';
import {createArtifactValidators} from '../../../packages/contracts/artifacts-0.2/artifact-validation.mjs';
import {createArtifactService} from '../service.mjs';
import {createPostgresArtifactService} from '../postgres-service.mjs';
const pub=JSON.parse(readFileSync(new URL('../../../packages/contracts/meri.schema.json',import.meta.url))),schema=JSON.parse(readFileSync(new URL('../../../packages/contracts/artifacts-0.2/artifact.schema.json',import.meta.url)));
const ajv=addFormats(new Ajv({strict:true,allErrors:true}));ajv.addSchema(pub);ajv.addSchema(schema);
const validators=createArtifactValidators({canonicalSha256:hash,validatePublicShape,validateShape(n,v){const f=ajv.getSchema(`${schema.$id}#/$defs/${n}`);if(!f(v))throw Error(ajv.errorsText(f.errors));return v;}});
const id=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`,sha=b=>createHash('sha256').update(b).digest('hex');
const scope={tenantId:'t',kind:'client',resourceId:'c',policyRevision:'p'};
const context=(conversationId=id(1))=>({binding:{tenantId:'t',actorId:'a',conversationId,runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1},scopes:[{...scope}],evidence:[],assets:[],deadlineMs:200000,maxBytes:1048576});
const request=(text='one\n')=>({operation:'create_word',format:'txt',title:'Retention',content:{text}});
const key=s=>`${s.tenantId}:${s.kind}:${s.subjectId}`;
function fixture(){
 let clock=1000,seq=100;const events=[],records=new Map(),heads=new Map(),data=new Map();
 const gate={suppressed:new Set(),barrier:false,down:false,calls:[],onObjectRead:null,async assertServable(s){gate.calls.push({...s,stage:events.at(-1)?.stage??'start'});if(gate.down)throw Object.assign(Error('RETENTION_READ_UNAVAILABLE'),{code:'RETENTION_READ_UNAVAILABLE'});if(gate.barrier)throw Object.assign(Error('RETENTION_RECOVERY_BARRIER'),{code:'RETENTION_RECOVERY_BARRIER'});if(gate.suppressed.has(key(s)))throw Object.assign(Error('RETENTION_SUPPRESSED'),{code:'RETENTION_SUPPRESSED'});}};
 const authority=async x=>({receiptId:'fresh-receipt',decision:'allow',action:x.action,binding:structuredClone(x.binding),scopesSha256:hash(x.scopes),resourceSha256:hash(x.resource),requestSha256:x.requestSha256,expiresAtMs:x.deadlineMs});
 const ports={validators,now:()=>clock,ids:()=>({artifactId:id(seq++),versionId:id(seq++),objectId:id(seq++)}),authorize:async x=>{events.push({stage:'authorize'});return authority(x);},budget:{reserve:async x=>{events.push({stage:'reserve'});return {ticketId:'ticket',binding:x.binding,requestSha256:x.requestSha256,maxBytes:x.maxBytes,deadlineMs:x.deadlineMs};},settle:async x=>{events.push({stage:'settle',outcome:x.outcome});return {ticketId:x.ticketId,requestSha256:x.requestSha256,bytes:x.bytes,outcome:x.outcome,status:'settled'};}},
  objects:{put:async x=>{events.push({stage:'put'});const o={objectId:x.objectId,versionId:'storage-'+sha(x.bytes),sha256:sha(x.bytes),bytes:x.bytes.length,scopes:structuredClone(x.scopes)};data.set(hash(o),Buffer.from(x.bytes));return o;},get:async o=>{events.push({stage:'get'});await gate.onObjectRead?.();return Buffer.from(data.get(hash(o)));}},
  versions:{read:async k=>{events.push({stage:'read'});return structuredClone(records.get(typeof k==='string'?k:k.versionId));},commit:async x=>{events.push({stage:'commit'});if((heads.get(x.version.artifactId)??null)!==x.expectedParentVersionId)throw Object.assign(Error('stale'),{code:'STALE'});records.set(x.version.versionId,structuredClone({version:x.version,spec:x.spec,specSha256:x.specSha256,requestSha256:x.requestSha256,inspection:x.inspection}));heads.set(x.version.artifactId,x.version.versionId);return {status:'committed',versionId:x.version.versionId,requestSha256:x.requestSha256,versionSha256:hash(x.version)};}},
  executor:{execute:async({request:r})=>{events.push({stage:'execute'});const bytes=Buffer.from(r.content.text);return {bytes,inspection:{sha256:sha(bytes),bytes:bytes.length,format:r.format,nativeOpened:false,rendered:false,recalculated:false,members:[],details:{encoding:'UTF-8',whitespace:'unchanged'}}};}},retention:gate};
 const stages=from=>events.slice(from).map(e=>e.stage);
 return {ports,events,records,gate,stages,service:()=>createArtifactService(ports),evidenceFor(versionId,c,r){const record=records.get(versionId),requestSha256=hash({request:r,context:c,baseVersionId:null});return {invocationId:'owned_'+versionId,stage:'SETTLED',reservationId:'ticket',argumentsSha256:requestSha256,maxOutputBytes:1048576,completion:{resultSha256:hash({...record,expectedParentVersionId:null}),outputBytes:record.version.object.bytes}};}};
}
const conversation=c=>({tenantId:c.binding.tenantId,kind:'conversation',subjectId:c.binding.conversationId}),artifact=(c,v)=>({tenantId:c.binding.tenantId,kind:'artifact',subjectId:v.artifactId});
test('unsuppressed behaviour is unchanged; the gate sees the bound conversation and, once a trusted record resolved the version, the artifact too, before bytes and before release; other subjects are irrelevant',async()=>{
 const f=fixture(),s=f.service(),c=context(),out=await s.create(request(),c);assert.equal(out.version.object.sha256,sha(Buffer.from('one\n')));
 const start=f.events.length;f.gate.calls.length=0;const got=await s.download(out.version.versionId,c);assert.equal(got.bytes.toString(),'one\n');
 assert.deepEqual(f.gate.calls.map(x=>[x.kind,x.subjectId]),[['conversation',c.binding.conversationId],['conversation',c.binding.conversationId],['artifact',out.version.artifactId],['conversation',c.binding.conversationId],['artifact',out.version.artifactId]],'conversation before the record read; conversation and artifact after it and again before release');
 assert.deepEqual(f.stages(start),['authorize','read','authorize','get','authorize'],'the object is read only after the post-record gate');
 f.gate.suppressed.add(key({tenantId:'t',kind:'artifact',subjectId:id(999)}));f.gate.suppressed.add(key({tenantId:'other',kind:'conversation',subjectId:c.binding.conversationId}));
 assert.equal((await s.inspect(out.version.versionId,c)).inspection.currentBytesVerified,true,'another artifact or another tenant\'s same conversation id does not block');
 const revised=await s.revise(out.version.versionId,request('two\n'),c);assert.equal(revised.version.parentVersionId,out.version.versionId);
});
test('a suppressed conversation refuses inspect, download, revise and create with no object read or execution; a suppressed artifact refuses its versions while a new artifact in the conversation is still allowed; recovery is gated too',async()=>{
 const f=fixture(),s=f.service(),c=context(),out=await s.create(request(),c);
 f.gate.suppressed.add(key(conversation(c)));
 // Recovery keeps its existing public outcome (ARTIFACT_REPLAY_UNRESOLVED) and carries the retention refusal as its cause.
 const suppressedRefusal=e=>e.code==='RETENTION_SUPPRESSED'||e.code==='ARTIFACT_REPLAY_UNRESOLVED'&&e.cause?.code==='RETENTION_SUPPRESSED';
 for(const op of [()=>s.inspect(out.version.versionId,c),()=>s.download(out.version.versionId,c),()=>s.revise(out.version.versionId,request('two\n'),c),()=>s.create(request('three\n'),c),()=>s.recover(null,request(),c,{evidence:f.evidenceFor(out.version.versionId,c,request())})]){const start=f.events.length;await assert.rejects(op(),suppressedRefusal);assert.ok(!f.stages(start).some(x=>['get','execute','put','reserve'].includes(x)),'no bytes read, nothing executed, nothing reserved: '+f.stages(start).join(','));}
 f.gate.suppressed.clear();f.gate.suppressed.add(key(artifact(c,out.version)));
 for(const op of [()=>s.inspect(out.version.versionId,c),()=>s.download(out.version.versionId,c),()=>s.revise(out.version.versionId,request('two\n'),c),()=>s.recover(null,request(),c,{evidence:f.evidenceFor(out.version.versionId,c,request())})]){const start=f.events.length;await assert.rejects(op(),suppressedRefusal);assert.ok(!f.stages(start).some(x=>['get','execute','put'].includes(x)),f.stages(start).join(','));}
 const fresh=await s.create(request('new\n'),c);assert.notEqual(fresh.version.artifactId,out.version.artifactId,'a new artifact in the same conversation is not the suppressed one');assert.equal((await s.download(fresh.version.versionId,c)).bytes.toString(),'new\n');
 f.gate.suppressed.clear();const recovered=await s.recover(null,request(),c,{evidence:f.evidenceFor(out.version.versionId,c,request())});assert.equal(recovered.version.versionId,out.version.versionId,'the same recovery succeeds once released');
});
test('a suppression that lands while the object bytes are being read is caught before release; a closed barrier or an unreadable journal refuses; the PostgreSQL-backed service refuses a malformed gate at construction',async()=>{
 const f=fixture(),s=f.service(),c=context(),out=await s.create(request(),c);
 f.gate.onObjectRead=async()=>{f.gate.suppressed.add(key(artifact(c,out.version)));f.gate.onObjectRead=null;};
 await assert.rejects(s.download(out.version.versionId,c),/RETENTION_SUPPRESSED/,'bytes already read are not released');f.gate.suppressed.clear();
 f.gate.barrier=true;await assert.rejects(s.inspect(out.version.versionId,c),/RETENTION_RECOVERY_BARRIER/);await assert.rejects(s.create(request('x\n'),c),/RETENTION_RECOVERY_BARRIER/);f.gate.barrier=false;
 f.gate.down=true;await assert.rejects(s.download(out.version.versionId,c),/RETENTION_READ_UNAVAILABLE/,'an unreadable journal never means unsuppressed');f.gate.down=false;
 assert.equal((await s.download(out.version.versionId,c)).bytes.toString(),'one\n');
 assert.throws(()=>createArtifactService({...f.ports,retention:{}}),/ARTIFACT_CONFIGURATION/);
 assert.throws(()=>createPostgresArtifactService({pool:{},allocationJson:'{}',producerContext:{},descriptor:{},context:c,validators,authority:{check(){}},authorize(){},versions:f.ports.versions,objects:f.ports.objects,executor:f.ports.executor,now:()=>1,ids:()=>({}),newReservationId:()=>'r',limits:{maxRequestMs:1000,maxResponseBytes:1024},retention:{}}),/ARTIFACT_BUDGET_CONFIGURATION/,'the durable service propagates only a well-formed gate');
});
