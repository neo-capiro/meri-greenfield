/** The runtime selector against a mocked canonical custody constructor. No storage, renderer or authority is qualified. */
import test,{mock} from 'node:test';import assert from 'node:assert/strict';
import {record,NOW} from '../../../artifacts/storage/test/sql-fixture.mjs';
const made=[];let recoveryFailure=false;
mock.module('../../../artifacts/preview/postgres-composition.mjs',{namedExports:{createPostgresS3PreviewCustody(options){
 const calls=[];const owner={options,calls,previews:Object.fromEntries(['read','claim','assertCurrent','recordObject','commit'].map(name=>[name,async(...args)=>{calls.push([name,...args]);return null;}])),
  recovery:{async reconcileExclusive(){calls.push(['recovery']);if(recoveryFailure)throw Error('synthetic recovery unavailable');}}};made.push(owner);return owner;
}}});
const {createRuntimePreviewCustody}=await import('../preview-custody.mjs');
function fixture(){const source=record(),events=[];let revoked=false;
 const now=()=>NOW,context={binding:source.version.binding,scopes:source.version.scopes,evidence:[],assets:[],maxBytes:8388608,deadlineMs:NOW+1000};
 const versions={async read(){events.push('source');if(revoked)throw Error('synthetic suppressed');return structuredClone(source);}},journal={async exclusive(fn){events.push('exclusive');return fn();}};
 const factory=createRuntimePreviewCustody({versions,journal,retention:{},versionsPool:{},evidenceS3:{},now,maxRequestMs:100});return {source,events,context,factory,revoke:()=>{revoked=true;}};}
test('current source selects tenant/artifact and restores through the existing journal; a new request selects anew',async()=>{
 const f=fixture(),start=made.length,p=f.factory(f.context);assert.equal(made.length,start);
 await p.read(f.source.version.versionId);assert.deepEqual(f.events,['source','exclusive']);const owner=made.at(-1);
 assert.equal(owner.options.tenantId,f.source.version.binding.tenantId);assert.equal(owner.options.artifactId,f.source.version.artifactId);assert.equal(owner.options.enabled,true);
 assert.deepEqual(owner.calls.map(x=>x[0]),['recovery','read']);await p.read(f.source.version.versionId);assert.equal(made.length,start+1);
 await f.factory(f.context).read(f.source.version.versionId);assert.equal(made.length,start+2);
});
for(const key of ['tenantId','actorId','conversationId'])test(`selector refuses foreign ${key} before custody construction`,async()=>{
 const f=fixture(),start=made.length,context=structuredClone(f.context);context.binding[key]=key==='conversationId'?'33333333-3333-4333-8333-999999999999':'other';
 if(key==='tenantId')context.scopes=context.scopes.map(scope=>({...scope,tenantId:'other'}));
 await assert.rejects(f.factory(context).read(f.source.version.versionId));assert.equal(made.length,start);
});
test('physical receipt remains recordable after suppression but unselected or foreign claims cannot select custody',async()=>{
 const f=fixture(),p=f.factory(f.context),claim={versionId:f.source.version.versionId,artifactId:f.source.version.artifactId,tenantId:f.context.binding.tenantId,conversationId:f.context.binding.conversationId};
 assert.throws(()=>p.claim(claim));await p.read(claim.versionId);f.revoke();await p.recordObject(claim,{versionId:'exact-object-receipt'});
 assert.equal(made.at(-1).calls.at(-1)[0],'recordObject');assert.throws(()=>p.recordObject({...claim,tenantId:'other'},{}));
 await assert.rejects(f.factory(f.context).read(claim.versionId),/synthetic suppressed/);
});
test('failed recovery never opens serving or caches an owner',async()=>{
 const f=fixture(),p=f.factory(f.context);recoveryFailure=true;try{await assert.rejects(p.read(f.source.version.versionId),/recovery unavailable/);assert.deepEqual(made.at(-1).calls.map(x=>x[0]),['recovery']);}finally{recoveryFailure=false;}
 await p.read(f.source.version.versionId);assert.deepEqual(made.at(-1).calls.map(x=>x[0]),['recovery','read']);
});
